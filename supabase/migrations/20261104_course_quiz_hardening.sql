-- Acquisitions Playbook: quiz and exam hardening (hand-off Part 4)
--  * every attempt gets its own drawn question set, stored privately with the answers
--  * options (and, for exams, questions) shuffled per attempt, seeded by the attempt id
--  * checkpoints draw 25 from a pool of 40+, the final exam draws 50 from 90+
--  * no right/wrong feedback on checkpoints or the final until the attempt is finished
--  * cooldowns: 30 min after a failed checkpoint, 24 h between final attempts,
--    and after 3 failed finals an admin unlocks the next try
-- Grading is always by option id, never by position.

-- ---------- storage ----------
alter table public.course_attempts add column if not exists mode text not null default 'practice'
  check (mode in ('practice', 'checkpoint', 'final'));

create table if not exists private.course_attempt_questions (
  attempt_id uuid not null references public.course_attempts(id) on delete cascade,
  ord        int  not null,
  qid        text not null,
  src_module text not null,
  src_item   text not null,
  question   jsonb not null,           -- full question, options already in display order, answers included
  primary key (attempt_id, qid)
);
create index if not exists course_attempt_questions_ord on private.course_attempt_questions (attempt_id, ord);
alter table private.course_attempt_questions enable row level security;
revoke all on private.course_attempt_questions from public, anon, authenticated;

create table if not exists private.course_exam_unlocks (
  id         bigserial primary key,
  user_id    uuid not null,
  module_id  text not null,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  note       text
);
alter table private.course_exam_unlocks enable row level security;
revoke all on private.course_exam_unlocks from public, anon, authenticated;
revoke all on sequence private.course_exam_unlocks_id_seq from public, anon, authenticated;

-- ---------- helpers ----------
-- Stable per-attempt order: the same seed always gives the same order.
create or replace function private.course_shuffle(p_arr jsonb, p_seed text)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(e.value order by md5(p_seed || ':' || coalesce(e.value ->> 'id', e.ordinality::text))), '[]'::jsonb)
    from jsonb_array_elements(coalesce(p_arr, '[]'::jsonb)) with ordinality e
$$;

create or replace function private.course_shuffle_options(p_q jsonb, p_seed text)
returns jsonb language sql immutable set search_path = '' as $$
  select p_q || jsonb_build_object('options', private.course_shuffle(p_q -> 'options', p_seed || ':' || (p_q ->> 'id')))
$$;

-- Public, seeded version of the quiz shape the app receives: options shuffled, no answers, no explanations.
create or replace function public.course_public_quiz(p_quiz jsonb, p_seed text)
returns jsonb language sql immutable set search_path = 'public', 'pg_temp' as $$
  select public.course_public_quiz(case when p_quiz is null or jsonb_typeof(p_quiz) <> 'object' then p_quiz else
    jsonb_set(p_quiz, '{questions}', coalesce((
      select jsonb_agg(private.course_shuffle_options(q.value, p_seed) order by q.ordinality)
        from jsonb_array_elements(coalesce(p_quiz -> 'questions', '[]'::jsonb)) with ordinality q), '[]'::jsonb)) end)
$$;
revoke all on function public.course_public_quiz(jsonb, text) from public, anon;

-- The final exam is the checkpoint of the last module.
create or replace function private.course_mode(p_module text, p_kind text)
returns text language sql stable set search_path = '' as $$
  select case when p_kind <> 'checkpoint' then 'practice'
              when (select m.number from public.course_modules m where m.id = p_module)
                 = (select max(m.number) from public.course_modules m) then 'final'
              else 'checkpoint' end
$$;

-- Draw this attempt's questions into private.course_attempt_questions. Returns how many were drawn.
create or replace function private.course_draw(p_attempt uuid, p_module text, p_item text, p_mode text)
returns int language plpgsql volatile set search_path = '' as $$
declare
  seed text := p_attempt::text;
  n_target int;
  n int;
begin
  delete from private.course_attempt_questions where attempt_id = p_attempt;

  if p_mode = 'practice' then
    -- lesson quiz: every question, in the lesson's order; options shuffled
    insert into private.course_attempt_questions (attempt_id, ord, qid, src_module, src_item, question)
    select p_attempt, q.ordinality, q.value ->> 'id', p_module, p_item, private.course_shuffle_options(q.value, seed)
      from public.course_modules m, public.course_flat(m.content) f,
           jsonb_array_elements(coalesce(f.item -> 'quiz' -> 'questions', '[]'::jsonb)) with ordinality q
     where m.id = p_module and f.item_id = p_item;

  elsif p_mode = 'checkpoint' then
    -- pool: this checkpoint's questions + the module's drill banks; topped up with the module's
    -- lesson quiz questions only if that is still under 40. Draw max(25, checkpoint size).
    with cp as (
      select q.value, 1 tier from public.course_modules m, public.course_flat(m.content) f,
             jsonb_array_elements(coalesce(f.item -> 'quiz' -> 'questions', '[]'::jsonb)) q
       where m.id = p_module and f.item_id = p_item),
    dr as (
      select d.value, 1 tier, f.item_id src from public.course_modules m, public.course_flat(m.content) f,
             jsonb_array_elements(coalesce(f.item -> 'drillBank', '[]'::jsonb)) d
       where m.id = p_module),
    lq as (
      select q.value, 2 tier, f.item_id src from public.course_modules m, public.course_flat(m.content) f,
             jsonb_array_elements(coalesce(f.item -> 'quiz' -> 'questions', '[]'::jsonb)) q
       where m.id = p_module and f.kind = 'lesson'),
    pool as (
      select value, tier, p_item src from cp union all select value, tier, src from dr
      union all select value, tier, src from lq where (select count(*) from cp) + (select count(*) from dr) < 40),
    pick as (
      select value, src, row_number() over (order by tier, md5(seed || ':' || (value ->> 'id'))) rn from pool)
    insert into private.course_attempt_questions (attempt_id, ord, qid, src_module, src_item, question)
    select p_attempt, rn, value ->> 'id', p_module, src, private.course_shuffle_options(value, seed)
      from pick
     where rn <= greatest(25, (select count(*) from cp))
    on conflict do nothing;

  else
    -- final: the exam's own questions + every module checkpoint; round-robin across modules so
    -- the 50 cover the whole course, then shuffled into one order.
    n_target := greatest(50, coalesce((select jsonb_array_length(f.item -> 'quiz' -> 'questions')
                                         from public.course_modules m, public.course_flat(m.content) f
                                        where m.id = p_module and f.item_id = p_item), 0));
    with pool as (
      select m.id mid, f.item_id src, q.value
        from public.course_modules m, public.course_flat(m.content) f,
             jsonb_array_elements(coalesce(f.item -> 'quiz' -> 'questions', '[]'::jsonb)) q
       where f.kind = 'checkpoint'),
    ranked as (
      select *, row_number() over (partition by mid order by md5(seed || ':' || (value ->> 'id'))) r from pool),
    pick as (
      select * from ranked order by r, md5(seed || ':m:' || mid) limit n_target)
    insert into private.course_attempt_questions (attempt_id, ord, qid, src_module, src_item, question)
    select p_attempt, row_number() over (order by md5(seed || ':q:' || (value ->> 'id'))), value ->> 'id', mid, src,
           private.course_shuffle_options(value, seed)
      from pick
    on conflict do nothing;
  end if;

  select count(*) into n from private.course_attempt_questions where attempt_id = p_attempt;
  return n;
end $$;

-- Questions of an attempt, in display order (full form, answers included). Private only.
create or replace function private.course_attempt_qs(p_attempt uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(question order by ord), '[]'::jsonb) from private.course_attempt_questions where attempt_id = p_attempt
$$;

-- Cooldown / lock check before a new attempt. Raises with a readable message.
create or replace function private.course_exam_gate(p_user uuid, p_module text, p_item text, p_mode text)
returns void language plpgsql stable set search_path = '' as $$
declare
  last_fail timestamptz;
  last_try timestamptz;
  unlocked timestamptz;
  fails int;
begin
  if p_mode = 'checkpoint' then
    select max(a.finished_at) into last_fail from public.course_attempts a
     where a.user_id = p_user and a.module_id = p_module and a.item_id = p_item
       and a.finished_at is not null and not coalesce(a.passed, false);
    if last_fail is not null and last_fail > now() - interval '30 minutes'
       and not exists (select 1 from public.course_attempts a where a.user_id = p_user and a.module_id = p_module
                         and a.item_id = p_item and a.passed and a.finished_at > last_fail) then
      raise exception 'course: cooldown until %', to_char((last_fail + interval '30 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        using errcode = 'P0001';
    end if;
  elsif p_mode = 'final' then
    select max(u.granted_at) into unlocked from private.course_exam_unlocks u where u.user_id = p_user and u.module_id = p_module;
    select count(*) into fails from public.course_attempts a
     where a.user_id = p_user and a.module_id = p_module and a.item_id = p_item
       and a.finished_at is not null and not coalesce(a.passed, false)
       and a.finished_at > coalesce(unlocked, '-infinity');
    if fails >= 3 then
      raise exception 'course: final needs unlock' using errcode = 'P0001';
    end if;
    select max(a.finished_at) into last_try from public.course_attempts a
     where a.user_id = p_user and a.module_id = p_module and a.item_id = p_item and a.finished_at is not null;
    if last_try is not null and last_try > now() - interval '24 hours'
       and (unlocked is null or unlocked < last_try) then
      raise exception 'course: cooldown until %', to_char((last_try + interval '24 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        using errcode = 'P0001';
    end if;
  end if;
end $$;

revoke all on function private.course_shuffle(jsonb, text), private.course_shuffle_options(jsonb, text),
  private.course_mode(text, text), private.course_draw(uuid, text, text, text), private.course_attempt_qs(uuid),
  private.course_exam_gate(uuid, text, text, text) from public, anon, authenticated;

-- ---------- public RPCs ----------
create or replace function public.course_quiz_start(p_module text, p_item text, p_restart boolean default false)
returns jsonb language plpgsql security definer set search_path = 'public', 'pg_temp' as $$
declare
  uid uuid := public.course_require_access();
  it jsonb := public.course_open_item(uid, p_module, p_item, array['lesson', 'checkpoint']);
  q jsonb := it -> 'quiz';
  k text := it ->> 'type';
  md text := private.course_mode(p_module, it ->> 'type');
  att public.course_attempts;
  n int;
  exam boolean;
begin
  if q is null then raise exception 'course: no quiz here' using errcode = 'P0002'; end if;
  exam := md <> 'practice';
  if p_restart then
    delete from public.course_attempts
     where user_id = uid and module_id = p_module and item_id = p_item and finished_at is null and answers = '{}'::jsonb;
    -- a started exam that is abandoned counts as a failed try
    update public.course_attempts a
       set correct = (select count(*) from jsonb_each(a.answers) e where (e.value ->> 'right')::boolean),
           score = floor((select count(*) from jsonb_each(a.answers) e where (e.value ->> 'right')::boolean) * 100.0 / greatest(a.total, 1)),
           passed = false, abandoned = true, finished_at = now(), updated_at = now()
     where a.user_id = uid and a.module_id = p_module and a.item_id = p_item and a.finished_at is null;
  end if;
  select * into att from public.course_attempts
   where user_id = uid and module_id = p_module and item_id = p_item and finished_at is null
   order by started_at desc limit 1;
  if att.id is null then
    if not public.course_is_admin() then perform private.course_exam_gate(uid, p_module, p_item, md); end if;
    insert into public.course_attempts (user_id, module_id, item_id, total, pass_mark, mode)
    values (uid, p_module, p_item, 0, coalesce((q ->> 'passMark')::int, case when exam then 85 else 80 end), md)
    returning * into att;
    n := private.course_draw(att.id, p_module, p_item, md);
    update public.course_attempts set total = n where id = att.id returning * into att;
  elsif not exists (select 1 from private.course_attempt_questions x where x.attempt_id = att.id) then
    -- an attempt opened before this change: draw now, keeping the lesson's own question set
    n := private.course_draw(att.id, p_module, p_item, 'practice');
    update public.course_attempts set total = n where id = att.id returning * into att;
  end if;
  return jsonb_build_object(
    'attempt', att.id, 'startedAt', att.started_at, 'mode', att.mode, 'total', att.total, 'passMark', att.pass_mark,
    'questions', public.course_public_quiz(jsonb_build_object('questions', private.course_attempt_qs(att.id))) -> 'questions',
    'answered', coalesce((
      select jsonb_object_agg(e.key, case when att.mode = 'practice'
               then (e.value - 'at') || jsonb_build_object('explanation', x.question ->> 'explanation')
               else jsonb_build_object('picks', e.value -> 'picks', 'saved', true) end)
        from jsonb_each(att.answers) e
        join private.course_attempt_questions x on x.attempt_id = att.id and x.qid = e.key), '{}'::jsonb));
end $$;

create or replace function public.course_quiz_answer(p_attempt uuid, p_question text, p_picks text[])
returns jsonb language plpgsql security definer set search_path = 'public', 'pg_temp' as $$
declare
  uid uuid := public.course_require_access();
  att public.course_attempts;
  q jsonb;
  ids text[];
  want text[];
  picks text[];
  right_ boolean;
  exam boolean;
begin
  select * into att from public.course_attempts where id = p_attempt and user_id = uid for update;
  if att.id is null then raise exception 'course: no such attempt' using errcode = 'P0002'; end if;
  if att.finished_at is not null then raise exception 'course: attempt finished' using errcode = '22023'; end if;
  exam := att.mode <> 'practice';

  select x.question into q from private.course_attempt_questions x where x.attempt_id = att.id and x.qid = p_question;
  if q is null then raise exception 'course: no such question' using errcode = 'P0002'; end if;

  if att.answers ? p_question then  -- an answer, once given, stays
    if exam then return jsonb_build_object('picks', att.answers -> p_question -> 'picks', 'saved', true); end if;
    return ((att.answers -> p_question) - 'at') || jsonb_build_object('explanation', q ->> 'explanation');
  end if;

  select array_agg(o.value ->> 'id'), array_agg(o.value ->> 'id') filter (where (o.value ->> 'correct')::boolean)
    into ids, want from jsonb_array_elements(q -> 'options') o;
  select array_agg(distinct p order by p) into picks from unnest(p_picks) p where p is not null;
  if picks is null or not (picks <@ ids) then raise exception 'course: pick an option' using errcode = '22023'; end if;
  if q ->> 'type' = 'single' and cardinality(picks) <> 1 then raise exception 'course: pick one option' using errcode = '22023'; end if;

  right_ := picks <@ coalesce(want, '{}') and coalesce(want, '{}') <@ picks;
  update public.course_attempts
     set answers = answers || jsonb_build_object(p_question, jsonb_build_object('picks', to_jsonb(picks), 'right', right_, 'at', now())),
         updated_at = now()
   where id = att.id;
  if exam then
    return jsonb_build_object('picks', to_jsonb(picks), 'saved', true);
  end if;
  return jsonb_build_object('picks', to_jsonb(picks), 'right', right_, 'explanation', q ->> 'explanation');
end $$;

create or replace function public.course_attempt_result(p_attempt uuid)
returns jsonb language plpgsql stable security definer set search_path = 'public', 'pg_temp' as $$
declare
  uid uuid := public.course_require_access();
  att public.course_attempts;
  done boolean;
begin
  select * into att from public.course_attempts where id = p_attempt and (user_id = uid or public.course_is_admin());
  if att.id is null then raise exception 'course: no such attempt' using errcode = 'P0002'; end if;
  done := att.finished_at is not null;
  return jsonb_build_object(
    'attempt', att.id, 'moduleId', att.module_id, 'itemId', att.item_id, 'mode', att.mode,
    'finished', done, 'startedAt', att.started_at, 'finishedAt', att.finished_at,
    'correct', case when done then att.correct end, 'total', att.total,
    'score', case when done then att.score end, 'passMark', att.pass_mark, 'passed', case when done then att.passed end,
    'review', case when not done and att.mode <> 'practice' then '[]'::jsonb else
      coalesce(
        (select jsonb_agg(jsonb_build_object(
                  'id', x.qid, 'number', x.ord, 'prompt', x.question ->> 'prompt',
                  'right', coalesce((att.answers -> x.qid ->> 'right')::boolean, false),
                  'answered', att.answers ? x.qid,
                  'explanation', x.question ->> 'explanation') order by x.ord)
           from private.course_attempt_questions x where x.attempt_id = att.id),
        -- attempts from before per-attempt draws: read the lesson's own questions
        (select jsonb_agg(jsonb_build_object(
                  'id', qq.value ->> 'id', 'number', qq.ordinality, 'prompt', qq.value ->> 'prompt',
                  'right', coalesce((att.answers -> (qq.value ->> 'id') ->> 'right')::boolean, false),
                  'answered', att.answers ? (qq.value ->> 'id'),
                  'explanation', qq.value ->> 'explanation') order by qq.ordinality)
           from public.course_modules m, public.course_flat(m.content) f,
                jsonb_array_elements(f.item -> 'quiz' -> 'questions') with ordinality qq
          where m.id = att.module_id and f.item_id = att.item_id),
        '[]'::jsonb) end);
end $$;

create or replace function public.course_admin_attempt(p_attempt uuid)
returns jsonb language plpgsql stable security definer set search_path = 'public', 'pg_temp' as $$
declare att public.course_attempts;
begin
  perform public.course_require_admin();
  select * into att from public.course_attempts where id = p_attempt;
  if att.id is null then raise exception 'course: no such attempt' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'attempt', att.id, 'userId', att.user_id, 'moduleId', att.module_id, 'itemId', att.item_id, 'mode', att.mode,
    'score', att.score, 'correct', att.correct, 'total', att.total, 'passed', att.passed, 'passMark', att.pass_mark,
    'abandoned', att.abandoned, 'startedAt', att.started_at, 'finishedAt', att.finished_at,
    'title', (select coalesce(f.item -> 'quiz' ->> 'title', f.item ->> 'title') from public.course_modules m, public.course_flat(m.content) f
               where m.id = att.module_id and f.item_id = att.item_id),
    'lessonTitle', (select f.item ->> 'title' from public.course_modules m, public.course_flat(m.content) f
                     where m.id = att.module_id and f.item_id = att.item_id),
    'kind', (select f.kind from public.course_modules m, public.course_flat(m.content) f
              where m.id = att.module_id and f.item_id = att.item_id),
    'questions', coalesce(
       (select jsonb_agg(x.question || jsonb_build_object('answer', att.answers -> x.qid, 'source', x.src_module || '/' || x.src_item) order by x.ord)
          from private.course_attempt_questions x where x.attempt_id = att.id),
       (select jsonb_agg(qq.value || jsonb_build_object('answer', att.answers -> (qq.value ->> 'id')) order by qq.ordinality)
          from public.course_modules m, public.course_flat(m.content) f,
               jsonb_array_elements(f.item -> 'quiz' -> 'questions') with ordinality qq
         where m.id = att.module_id and f.item_id = att.item_id),
       '[]'::jsonb),
    'unlocks', (select coalesce(jsonb_agg(jsonb_build_object('at', u.granted_at, 'by', u.granted_by) order by u.granted_at), '[]'::jsonb)
                  from private.course_exam_unlocks u where u.user_id = att.user_id and u.module_id = att.module_id));
end $$;

-- Missed-question report: also finds prompts for questions drawn from pools
create or replace function public.course_missed_questions(p_min integer default 3)
returns table(module_id text, item_id text, question_id text, prompt text, tries integer, missed integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce(public.course_is_admin(), false) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  with firsts as (
    select distinct on (a.user_id, a.module_id, a.item_id) a.module_id, a.item_id, a.answers
      from public.course_attempts a where a.finished_at is not null and not a.abandoned
     order by a.user_id, a.module_id, a.item_id, a.finished_at),
  ans as (select f.module_id, f.item_id, k.key qid, (k.value ->> 'right')::boolean ok from firsts f cross join lateral jsonb_each(f.answers) k),
  agg as (select ans.module_id, ans.item_id, ans.qid, count(*)::integer n, count(*) filter (where not ans.ok)::integer bad from ans group by 1, 2, 3)
  select g.module_id, g.item_id, g.qid,
         coalesce(
           (select x.question ->> 'prompt' from private.course_attempt_questions x where x.qid = g.qid limit 1),
           (select qq.value ->> 'prompt' from public.course_modules m cross join lateral public.course_flat(m.content) f
              cross join lateral jsonb_array_elements(coalesce(f.item -> 'quiz' -> 'questions', '[]'::jsonb)) qq
             where m.id = g.module_id and f.item_id = g.item_id and qq.value ->> 'id' = g.qid limit 1)),
         g.n, g.bad
    from agg g where g.n >= greatest(coalesce(p_min, 3), 1) and g.bad > 0
   order by g.bad::numeric / g.n desc, g.n desc
   limit 40;
end $$;

-- Admin: allow one more final-exam try after three fails (also lifts the 24-hour wait)
create or replace function public.course_exam_unlock(p_user uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = 'public', 'pg_temp' as $$
declare
  admin_id uuid := auth.uid();
  final_mod text := (select m.id from public.course_modules m order by m.number desc limit 1);
begin
  perform public.course_require_admin();
  insert into private.course_exam_unlocks (user_id, module_id, granted_by, note) values (p_user, final_mod, admin_id, p_note);
  return jsonb_build_object('ok', true, 'user', p_user, 'module', final_mod);
end $$;
revoke all on function public.course_exam_unlock(uuid, text) from public, anon;
grant execute on function public.course_exam_unlock(uuid, text) to authenticated;

-- Exam status for the app: when the next try opens, and whether an admin must unlock it
create or replace function public.course_exam_status(p_module text, p_item text)
returns jsonb language plpgsql stable security definer set search_path = 'public', 'pg_temp' as $$
declare
  uid uuid := public.course_require_access();
  k text := (select f.kind from public.course_modules m, public.course_flat(m.content) f where m.id = p_module and f.item_id = p_item);
  md text := private.course_mode(p_module, coalesce(k, 'lesson'));
  msg text;
begin
  if md = 'practice' or public.course_is_admin() then return jsonb_build_object('mode', md, 'open', true); end if;
  begin
    perform private.course_exam_gate(uid, p_module, p_item, md);
  exception when others then msg := sqlerrm;
  end;
  return jsonb_build_object('mode', md, 'open', msg is null,
    'retryAt', substring(msg from 'cooldown until (\S+)'),
    'needsUnlock', coalesce(msg like '%needs unlock%', false));
end $$;
revoke all on function public.course_exam_status(text, text) from public, anon;
grant execute on function public.course_exam_status(text, text) to authenticated;

-- Checkpoint and final-exam questions never ship with the course content; only the count does.
create or replace function public.course_public_item(p_item jsonb, p_full boolean)
returns jsonb language plpgsql immutable set search_path = 'public', 'pg_temp' as $$
declare
  r jsonb := p_item - 'reviewerAnswerKey' - 'drillBank';
  kids jsonb;
  n int;
begin
  if p_item ->> 'type' = 'group' then
    select coalesce(jsonb_agg(public.course_public_item(c.value, p_full) order by c.ordinality), '[]'::jsonb)
      into kids from jsonb_array_elements(coalesce(p_item -> 'items', '[]'::jsonb)) with ordinality c;
    r := jsonb_set(r, '{items}', kids);
  end if;
  if r ? 'quiz' then
    n := jsonb_array_length(coalesce(p_item -> 'quiz' -> 'questions', '[]'::jsonb));
    if p_full and p_item ->> 'type' <> 'checkpoint' then
      r := jsonb_set(r, '{quiz}', public.course_public_quiz(p_item -> 'quiz'));
    else
      r := jsonb_set(r, '{quiz}', ((p_item -> 'quiz') - 'questions'));
    end if;
    r := jsonb_set(r, '{quiz,count}', to_jsonb(case when p_item ->> 'type' = 'checkpoint' then greatest(n, 25) else n end));
  end if;
  if not p_full then
    r := r - 'bodyMarkdown' - 'tasks' - 'instructions' - 'sourceImages';
  end if;
  return r;
end $$;

-- Existing attempts: record their mode
update public.course_attempts a set mode = private.course_mode(a.module_id,
  coalesce((select f.kind from public.course_modules m, public.course_flat(m.content) f where m.id = a.module_id and f.item_id = a.item_id), 'lesson'))
 where a.mode = 'practice';
