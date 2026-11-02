-- Acquisitions course extras:
--   1. Daily drill: five questions a day from lesson quizzes the learner has already passed, the same five all day,
--      graded in the database (the right option is never sent), with a streak.
--   2. Most-missed questions (Amr): each learner's first finished try at every quiz, which questions are missed most.
--   3. Fast track (Amr turns it on per person): the Module 1 to 4 checkpoints open without the lessons, so an
--      experienced rep proves it at 85% and moves on.
--   4. Real calls in lessons: a library entry can name the course lessons it goes with; the lesson page shows those
--      entries and their example calls (the same people and the same rules as the library: 45+, real, consented).
-- Safe to run more than once.

-- ---------- 1. Daily drill ----------
create table if not exists public.course_drill_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  total smallint not null check (total between 1 and 5),
  correct smallint not null check (correct between 0 and total),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.course_drill_days enable row level security;
revoke all on public.course_drill_days from anon, authenticated;
grant select on public.course_drill_days to authenticated;
drop policy if exists "drill days read" on public.course_drill_days;
create policy "drill days read" on public.course_drill_days for select to authenticated
  using (user_id = auth.uid() or coalesce(public.is_tracker_admin(), false));

-- Today's five, with the answers (only ever used inside the functions below)
create or replace function public.course_drill_pick(p_user uuid, p_day date)
returns table(qid text, module_id text, item_id text, q jsonb)
language sql stable security definer set search_path = '' as $$
  select qq.value ->> 'id', m.id, f.item_id, qq.value
    from public.course_modules m
    cross join lateral public.course_flat(m.content) f
    cross join lateral jsonb_array_elements(coalesce(f.item -> 'quiz' -> 'questions', '[]'::jsonb)) qq
   where f.kind = 'lesson' and qq.value ->> 'type' in ('single', 'multiple')
     and public.course_quiz_passed(p_user, m.id, f.item_id)
   order by md5(p_user::text || p_day::text || (qq.value ->> 'id'))
   limit 5
$$;
revoke all on function public.course_drill_pick(uuid, date) from public, anon, authenticated;

create or replace function public.course_drill_streak(p_user uuid)
returns integer language sql stable security definer set search_path = '' as $$
  -- days in a row ending today (or yesterday, if today's drill isn't done yet)
  with today as (select (now() at time zone 'Africa/Cairo')::date t),
  start as (select case when exists (select 1 from public.course_drill_days d, today where d.user_id = p_user and d.day = today.t) then today.t else today.t - 1 end s from today),
  r as (select (st.s - d.day) off, (row_number() over (order by d.day desc) - 1)::integer rn
          from public.course_drill_days d, start st where d.user_id = p_user and d.day <= st.s)
  select count(*)::integer from r where r.off = r.rn
$$;
revoke all on function public.course_drill_streak(uuid) from public, anon, authenticated;

-- What the learner sees: done today or not, the streak, and today's questions without the answers
create or replace function public.course_drill_today()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := public.course_require_access(); v_day date := (now() at time zone 'Africa/Cairo')::date; v_done public.course_drill_days;
begin
  select * into v_done from public.course_drill_days d where d.user_id = v_uid and d.day = v_day;
  return jsonb_build_object(
    'done', v_done.user_id is not null, 'score', v_done.correct, 'total', v_done.total,
    'streak', public.course_drill_streak(v_uid),
    'days', (select count(*) from public.course_drill_days d where d.user_id = v_uid),
    'fastTrack', exists (select 1 from public.course_fast_track t where t.user_id = v_uid),
    'questions', case when v_done.user_id is not null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', p.qid, 'module', p.module_id, 'lesson', p.item_id, 'type', p.q ->> 'type', 'prompt', p.q ->> 'prompt',
               'options', (select jsonb_agg(o.value - 'correct' order by o.ordinality) from jsonb_array_elements(p.q -> 'options') with ordinality o)))
        from public.course_drill_pick(v_uid, v_day) p), '[]'::jsonb) end);
end $$;
revoke all on function public.course_drill_today() from public, anon;
grant execute on function public.course_drill_today() to authenticated;

-- Send all five answers ({"question id": ["A"], ...}); graded here, the day saved once
create or replace function public.course_drill_submit(p_picks jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := public.course_require_access(); v_day date := (now() at time zone 'Africa/Cairo')::date;
        v_res jsonb := '[]'::jsonb; v_right integer := 0; v_n integer := 0; r record; v_picks text[]; v_want text[]; v_ok boolean;
begin
  if jsonb_typeof(p_picks) is distinct from 'object' then raise exception 'Answer every question first.' using errcode = '22023'; end if;
  for r in select * from public.course_drill_pick(v_uid, v_day) loop
    v_n := v_n + 1;
    if jsonb_typeof(p_picks -> r.qid) is distinct from 'array' or jsonb_array_length(p_picks -> r.qid) = 0 then
      raise exception 'Answer every question first.' using errcode = '22023';
    end if;
    select array_agg(distinct x order by x) into v_picks from jsonb_array_elements_text(p_picks -> r.qid) x;
    select coalesce(array_agg(o.value ->> 'id' order by o.value ->> 'id'), '{}') into v_want from jsonb_array_elements(r.q -> 'options') o where (o.value ->> 'correct')::boolean;
    v_ok := v_picks <@ v_want and v_want <@ v_picks;
    if v_ok then v_right := v_right + 1; end if;
    v_res := v_res || jsonb_build_array(jsonb_build_object('id', r.qid, 'right', v_ok, 'explanation', r.q ->> 'explanation', 'lesson', r.item_id, 'module', r.module_id));
  end loop;
  if v_n = 0 then raise exception 'No questions yet: pass a lesson quiz first.' using errcode = '22023'; end if;
  insert into public.course_drill_days (user_id, day, total, correct) values (v_uid, v_day, v_n, v_right) on conflict (user_id, day) do nothing;
  return jsonb_build_object('results', v_res, 'correct', (select d.correct from public.course_drill_days d where d.user_id = v_uid and d.day = v_day),
                            'total', v_n, 'streak', public.course_drill_streak(v_uid));
end $$;
revoke all on function public.course_drill_submit(jsonb) from public, anon;
grant execute on function public.course_drill_submit(jsonb) to authenticated;

-- ---------- 2. Most-missed questions (Amr) ----------
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
         (select qq.value ->> 'prompt' from public.course_modules m cross join lateral public.course_flat(m.content) f
            cross join lateral jsonb_array_elements(coalesce(f.item -> 'quiz' -> 'questions', '[]'::jsonb)) qq
           where m.id = g.module_id and f.item_id = g.item_id and qq.value ->> 'id' = g.qid limit 1),
         g.n, g.bad
    from agg g where g.n >= greatest(coalesce(p_min, 3), 1) and g.bad > 0
   order by g.bad::numeric / g.n desc, g.n desc
   limit 40;
end $$;
revoke all on function public.course_missed_questions(integer) from public, anon;
grant execute on function public.course_missed_questions(integer) to authenticated;

-- ---------- 3. Fast track ----------
create table if not exists public.course_fast_track (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid default auth.uid() references auth.users(id) on delete set null
);
alter table public.course_fast_track enable row level security;
revoke all on public.course_fast_track from anon, authenticated;
grant select on public.course_fast_track to authenticated;
drop policy if exists "fast track read" on public.course_fast_track;
create policy "fast track read" on public.course_fast_track for select to authenticated
  using (user_id = auth.uid() or coalesce(public.is_tracker_admin(), false));

create or replace function public.course_fast_track_set(p_user uuid, p_on boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.course_is_admin(), false) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_on then
    insert into public.course_fast_track (user_id) values (p_user) on conflict (user_id) do nothing;
  else
    delete from public.course_fast_track t where t.user_id = p_user;
  end if;
  return p_on;
end $$;
revoke all on function public.course_fast_track_set(uuid, boolean) from public, anon;
grant execute on function public.course_fast_track_set(uuid, boolean) to authenticated;

-- The checkpoint opens when every lesson quiz is passed and the written drill has been submitted, or, for
-- Modules 1 to 4, when Amr turned on the fast track for this person.
create or replace function public.course_checkpoint_open(p_user uuid, p_module text)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    (p_module in ('m1', 'm2', 'm3', 'm4') and exists (select 1 from public.course_fast_track t where t.user_id = p_user))
    or (
    not exists (select 1 from public.course_modules m, public.course_flat(m.content) f
                 where m.id = p_module and f.kind = 'lesson' and f.item ? 'quiz'
                   and not public.course_quiz_passed(p_user, p_module, f.item_id))
    and not exists (select 1 from public.course_modules m, public.course_flat(m.content) f
                     where m.id = p_module and f.kind = 'assignment'
                       and not exists (select 1 from public.course_submissions s
                                        where s.user_id = p_user and s.module_id = p_module and s.item_id = f.item_id and s.submitted_at is not null)))
$$;
revoke execute on function public.course_checkpoint_open(uuid, text) from public, anon, authenticated;

-- ---------- 4. Real calls in lessons ----------
alter table public.library_entries add column if not exists lessons text[] not null default '{}';
alter table public.library_entries drop constraint if exists library_entries_lessons;
alter table public.library_entries add constraint library_entries_lessons
  check (cardinality(lessons) <= 10 and array_to_string(lessons, ',') ~ '^([0-9]{1,2}\.[0-9]{1,2}(,[0-9]{1,2}\.[0-9]{1,2})*)?$');

-- A lesson's library entries and their example calls, for people who may read the library; nothing for anyone else
create or replace function public.library_for_lesson(p_lesson text)
returns table(entry_id bigint, kind text, title text, body text, why text, why_ar text, calls jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce(public.library_can_read(), false) then return; end if;
  return query
  select x.id, x.kind, x.title, x.body, x.why, x.why_ar,
         coalesce((select jsonb_agg(jsonb_build_object('path', h.path, 'title', coalesce(e.label, 'Real call'), 'total', (h.score ->> 'total')::integer) order by (h.score ->> 'total')::integer desc)
                     from public.library_examples e join public.hub_uploads h on h.id = e.upload_id
                    where e.entry_id = x.id and public.library_example_ok(e.entry_id, e.upload_id)), '[]'::jsonb)
    from public.library_entries x
   where x.active and p_lesson = any(x.lessons)
   order by x.sort, x.id;
end $$;
revoke all on function public.library_for_lesson(text) from public, anon;
grant execute on function public.library_for_lesson(text) to authenticated;
