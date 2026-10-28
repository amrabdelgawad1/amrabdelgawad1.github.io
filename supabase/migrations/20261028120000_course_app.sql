-- Acquisitions Playbook course app (/course)
--
-- Adds new tables, functions and storage policies only. Nothing that exists is changed, except
-- that members.access may now hold the value 'course' (the "Acquisitions course" switch in
-- Invite and access), handled in the last block.
--
-- How the content stays private:
--   * The full module JSON (answers, explanations, reviewer answer key) lives in course_modules,
--     which no browser can read. Learners get it through course_state(), which strips the answers.
--   * Grading happens here, in course_quiz_answer() and course_quiz_finish(). The browser only
--     sends the options picked and gets back right or wrong plus the explanation.
--   * Progress tables are readable by the learner (their own rows) and Amr. All writes go
--     through the functions below, which check the rules (order, unlocks, statuses).
--
-- Who gets in: course_has_access(). Today that's Amr, plus team members whose members.access
-- includes 'course'. Course tables point at auth.users only, never at members or companies,
-- so a separate student path can be added later by changing that one function.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.course_meta (
  id boolean primary key default true check (id),
  title text not null,
  total_modules int not null check (total_modules between 1 and 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_modules (
  id text primary key,                         -- 'm1'
  number int not null unique check (number >= 1),
  content jsonb not null,                      -- the module object from module-N.json, answers included
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- Lessons marked complete
create table if not exists public.course_item_done (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  item_id text not null,
  done_at timestamptz not null default now(),
  primary key (user_id, module_id, item_id)
);

-- One row per quiz attempt. answers: { "<question id>": { "picks": ["B"], "right": true, "at": "<time>" } }
create table if not exists public.course_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  item_id text not null,                       -- the lesson ('1.2.s2') or checkpoint ('1.checkpoint') the quiz belongs to
  total int not null,
  pass_mark int not null,
  answers jsonb not null default '{}'::jsonb,
  correct int,
  score int,                                   -- percent, set when finished
  passed boolean,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists course_attempts_user_item on public.course_attempts (user_id, module_id, item_id, finished_at desc);

-- The written drill. answers: { "1": "text", "2": "text", ... } keyed by task number.
-- history: every submit and review, oldest first.
create table if not exists public.course_submissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  item_id text not null,
  answers jsonb not null default '{}'::jsonb,
  file_path text,
  file_name text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'needs_changes', 'approved')),
  comment text,
  submitted_at timestamptz,                    -- first submit; stays set so the checkpoint stays open while they revise
  last_submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, module_id, item_id)
);

alter table public.course_meta enable row level security;
alter table public.course_modules enable row level security;
alter table public.course_item_done enable row level security;
alter table public.course_attempts enable row level security;
alter table public.course_submissions enable row level security;

revoke all on public.course_meta, public.course_modules, public.course_item_done, public.course_attempts, public.course_submissions from anon;
-- Writes only through the functions below
revoke insert, update, delete, truncate on public.course_meta, public.course_modules, public.course_item_done, public.course_attempts, public.course_submissions from authenticated;
-- The full content (with answers) is never readable directly, not even by Amr's browser session
revoke all on public.course_modules from authenticated;
-- Reading progress rows is allowed; the policies below decide whose
grant select on public.course_meta, public.course_item_done, public.course_attempts, public.course_submissions to authenticated;

-- ---------------------------------------------------------------------------
-- Who is who
-- ---------------------------------------------------------------------------

-- Amr. Uses the existing is_tracker_admin(); when the account has an authenticator,
-- the session must have passed it (aal2), the same as /app asks for.
create or replace function public.course_is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null
     and coalesce(public.is_tracker_admin(), false)
     and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
          or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'))
$$;

-- Approved learners. To add outside students later, add an "or exists (...)" here for their table.
create or replace function public.course_has_access()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and (
    public.course_is_admin()
    or exists (select 1 from public.members m
               where m.user_id = auth.uid() and m.active is true and to_jsonb(m.access) ? 'course')
  )
$$;

create or replace function public.course_require_access()
returns uuid language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.course_has_access() then
    raise exception 'course: no access' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

create or replace function public.course_require_admin()
returns uuid language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.course_is_admin() then
    raise exception 'course: admin only' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

-- ---------------------------------------------------------------------------
-- Reading the content
-- ---------------------------------------------------------------------------

-- Every item of a module in order, groups flattened. kind: lesson | assignment | checkpoint
create or replace function public.course_flat(p_content jsonb)
returns table (ord int, item_id text, kind text, parent_id text, item jsonb)
language sql immutable set search_path = public, pg_temp as $$
  with recursive t(item, parent_id, path) as (
    select e.value, null::text, array[e.ordinality::int]
      from jsonb_array_elements(coalesce(p_content -> 'items', '[]'::jsonb)) with ordinality e
    union all
    select c.value, t.item ->> 'id', t.path || c.ordinality::int
      from t, jsonb_array_elements(case when t.item ->> 'type' = 'group' then coalesce(t.item -> 'items', '[]'::jsonb) else '[]'::jsonb end) with ordinality c
  )
  select (row_number() over (order by path))::int, item ->> 'id', item ->> 'type', parent_id, item
    from t where item ->> 'type' <> 'group'
$$;

-- A quiz with the answers taken out: no "correct" on options, no "explanation"
create or replace function public.course_public_quiz(p_quiz jsonb)
returns jsonb language sql immutable set search_path = public, pg_temp as $$
  select case when p_quiz is null or jsonb_typeof(p_quiz) <> 'object' then p_quiz else
    jsonb_set(p_quiz, '{questions}', coalesce((
      select jsonb_agg(
               (q.value - 'explanation') || jsonb_build_object('options', coalesce((
                 select jsonb_agg(o.value - 'correct' order by o.ordinality)
                   from jsonb_array_elements(coalesce(q.value -> 'options', '[]'::jsonb)) with ordinality o), '[]'::jsonb))
             order by q.ordinality)
        from jsonb_array_elements(coalesce(p_quiz -> 'questions', '[]'::jsonb)) with ordinality q), '[]'::jsonb))
  end
$$;

-- An item as a learner sees it. p_full = false gives an outline (for locked modules): no bodies, no questions.
create or replace function public.course_public_item(p_item jsonb, p_full boolean)
returns jsonb language plpgsql immutable set search_path = public, pg_temp as $$
declare
  r jsonb := p_item - 'reviewerAnswerKey';
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
    if p_full then
      r := jsonb_set(r, '{quiz}', public.course_public_quiz(p_item -> 'quiz'));
    else
      r := jsonb_set(r, '{quiz}', ((p_item -> 'quiz') - 'questions'));
    end if;
    r := jsonb_set(r, '{quiz,count}', to_jsonb(n));
  end if;
  if not p_full then
    r := r - 'bodyMarkdown' - 'tasks' - 'instructions' - 'sourceImages';
  end if;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- Progress rules
-- ---------------------------------------------------------------------------

-- Latest finished attempt of a quiz passed? (Unlimited retakes, the latest score counts.)
create or replace function public.course_quiz_passed(p_user uuid, p_module text, p_item text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select a.passed from public.course_attempts a
                    where a.user_id = p_user and a.module_id = p_module and a.item_id = p_item and a.finished_at is not null
                    order by a.finished_at desc limit 1), false)
$$;

-- The checkpoint opens when every lesson quiz is passed and the written drill has been submitted.
create or replace function public.course_checkpoint_open(p_user uuid, p_module text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select
    not exists (select 1 from public.course_modules m, public.course_flat(m.content) f
                 where m.id = p_module and f.kind = 'lesson' and f.item ? 'quiz'
                   and not public.course_quiz_passed(p_user, p_module, f.item_id))
    and not exists (select 1 from public.course_modules m, public.course_flat(m.content) f
                     where m.id = p_module and f.kind = 'assignment'
                       and not exists (select 1 from public.course_submissions s
                                        where s.user_id = p_user and s.module_id = p_module and s.item_id = f.item_id and s.submitted_at is not null))
$$;

-- A module opens when the module before it (by number) has had its checkpoint passed.
-- Once a module is open it stays open, even if a later retake of that checkpoint scores lower.
create or replace function public.course_module_open(p_user uuid, p_module text)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  num int;
  prev public.course_modules;
begin
  select number into num from public.course_modules where id = p_module;
  if num is null then return false; end if;
  select * into prev from public.course_modules where number < num order by number desc limit 1;
  if prev.id is null then return true; end if;               -- the first module
  if prev.number <> num - 1 then return false; end if;       -- a module in between hasn't been added yet
  return exists (
    select 1 from public.course_attempts a, public.course_flat(prev.content) f
     where f.kind = 'checkpoint' and a.user_id = p_user and a.module_id = prev.id and a.item_id = f.item_id
       and a.finished_at is not null and a.passed);
end $$;

-- Items done out of items in a module. Counted items: each lesson, each lesson quiz (passed),
-- the drill (submitted or approved) and the checkpoint (passed). Module 1 has 24.
create or replace function public.course_module_progress(p_user uuid, p_module text, out done int, out total int)
language sql stable security definer set search_path = public, pg_temp as $$
  with f as (select f.* from public.course_modules m, public.course_flat(m.content) f where m.id = p_module)
  select
    ((select count(*) from f where f.kind = 'lesson'
             and exists (select 1 from public.course_item_done d where d.user_id = p_user and d.module_id = p_module and d.item_id = f.item_id))
   + (select count(*) from f where f.item ? 'quiz' and public.course_quiz_passed(p_user, p_module, f.item_id))
   + (select count(*) from f where f.kind = 'assignment'
             and exists (select 1 from public.course_submissions s where s.user_id = p_user and s.module_id = p_module
                            and s.item_id = f.item_id and s.status in ('submitted', 'approved'))))::int,
    ((select count(*) from f) + (select count(*) from f where f.kind = 'lesson' and f.item ? 'quiz'))::int
$$;

-- ---------------------------------------------------------------------------
-- What the app loads: the course, the modules (answers stripped) and the learner's own progress
-- ---------------------------------------------------------------------------

create or replace function public.course_state()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  uid uuid := public.course_require_access();
  admin boolean := public.course_is_admin();
  mods jsonb;
  open_ids text[];
begin
  select coalesce(array_agg(m.id), '{}') into open_ids
    from public.course_modules m where admin or public.course_module_open(uid, m.id);

  select coalesce(jsonb_agg(
           (m.content - 'items') || jsonb_build_object(
             'id', m.id, 'number', m.number,
             'open', m.id = any(open_ids),
             'openForLearners', public.course_module_open(uid, m.id),
             'checkpointOpen', admin or public.course_checkpoint_open(uid, m.id),
             'items', coalesce((select jsonb_agg(public.course_public_item(i.value, m.id = any(open_ids)) order by i.ordinality)
                                  from jsonb_array_elements(coalesce(m.content -> 'items', '[]'::jsonb)) with ordinality i), '[]'::jsonb))
           order by m.number), '[]'::jsonb)
    into mods from public.course_modules m;

  return jsonb_build_object(
    'title', coalesce((select title from public.course_meta), 'Acquisitions Playbook'),
    'totalModules', coalesce((select total_modules from public.course_meta), 14),
    'isAdmin', admin,
    'me', jsonb_build_object('id', uid, 'name', (select m.name from public.members m where m.user_id = uid)),
    'modules', mods,
    'done', coalesce((select jsonb_object_agg(d.module_id || '/' || d.item_id, d.done_at) from public.course_item_done d where d.user_id = uid), '{}'::jsonb),
    -- Per quiz: the latest finished attempt, the best score, and an unfinished attempt to resume
    'quizzes', coalesce((
      select jsonb_object_agg(k.key, jsonb_build_object(
               'latest', (select jsonb_build_object('id', a.id, 'score', a.score, 'correct', a.correct, 'total', a.total, 'passed', a.passed, 'finishedAt', a.finished_at)
                            from public.course_attempts a where a.user_id = uid and a.module_id = k.module_id and a.item_id = k.item_id and a.finished_at is not null
                            order by a.finished_at desc limit 1),
               'tries', (select count(*) from public.course_attempts a where a.user_id = uid and a.module_id = k.module_id and a.item_id = k.item_id and a.finished_at is not null),
               'open', (select jsonb_build_object('id', a.id, 'answered', (select count(*) from jsonb_object_keys(a.answers)))
                          from public.course_attempts a where a.user_id = uid and a.module_id = k.module_id and a.item_id = k.item_id and a.finished_at is null
                          order by a.started_at desc limit 1)))
        from (select distinct a.module_id, a.item_id, a.module_id || '/' || a.item_id as key
                from public.course_attempts a where a.user_id = uid) k), '{}'::jsonb),
    'submissions', coalesce((
      select jsonb_object_agg(s.module_id || '/' || s.item_id, jsonb_build_object(
               'status', s.status, 'answers', s.answers, 'fileName', s.file_name, 'filePath', s.file_path,
               'comment', s.comment, 'submittedAt', s.submitted_at, 'lastSubmittedAt', s.last_submitted_at,
               'reviewedAt', s.reviewed_at, 'updatedAt', s.updated_at))
        from public.course_submissions s where s.user_id = uid), '{}'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------------
-- Lessons
-- ---------------------------------------------------------------------------

-- Finds an item a learner may use right now, or raises. Returns the full item (answers included,
-- for use inside these functions only).
create or replace function public.course_open_item(p_user uuid, p_module text, p_item text, p_kinds text[])
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  it jsonb;
  k text;
  admin boolean := public.course_is_admin();
begin
  select f.item, f.kind into it, k
    from public.course_modules m, public.course_flat(m.content) f
   where m.id = p_module and f.item_id = p_item;
  if it is null or not (k = any(p_kinds)) then
    raise exception 'course: no such item' using errcode = 'P0002';
  end if;
  if not admin and not public.course_module_open(p_user, p_module) then
    raise exception 'course: module locked' using errcode = '42501';
  end if;
  if k = 'checkpoint' and not admin and not public.course_checkpoint_open(p_user, p_module) then
    raise exception 'course: checkpoint locked' using errcode = '42501';
  end if;
  return it;
end $$;

create or replace function public.course_mark_done(p_module text, p_item text, p_done boolean default true)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare uid uuid := public.course_require_access();
begin
  perform public.course_open_item(uid, p_module, p_item, array['lesson']);
  if p_done then
    insert into public.course_item_done (user_id, module_id, item_id) values (uid, p_module, p_item) on conflict do nothing;
  else
    delete from public.course_item_done where user_id = uid and module_id = p_module and item_id = p_item;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Quizzes (graded here, never in the browser)
-- ---------------------------------------------------------------------------

-- Starts an attempt, or resumes the unfinished one. p_restart throws away an unfinished attempt.
-- Returns the attempt id and, for questions already answered, the picks and their feedback.
create or replace function public.course_quiz_start(p_module text, p_item text, p_restart boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  uid uuid := public.course_require_access();
  it jsonb := public.course_open_item(uid, p_module, p_item, array['lesson', 'checkpoint']);
  q jsonb := it -> 'quiz';
  att public.course_attempts;
begin
  if q is null then raise exception 'course: no quiz here' using errcode = 'P0002'; end if;
  if p_restart then
    delete from public.course_attempts where user_id = uid and module_id = p_module and item_id = p_item and finished_at is null;
  end if;
  select * into att from public.course_attempts
   where user_id = uid and module_id = p_module and item_id = p_item and finished_at is null
   order by started_at desc limit 1;
  if att.id is null then
    insert into public.course_attempts (user_id, module_id, item_id, total, pass_mark)
    values (uid, p_module, p_item, jsonb_array_length(q -> 'questions'), coalesce((q ->> 'passMark')::int, 80))
    returning * into att;
  end if;
  return jsonb_build_object('attempt', att.id, 'startedAt', att.started_at, 'answered', coalesce((
    select jsonb_object_agg(e.key, (e.value - 'at') || jsonb_build_object('explanation', qq.value ->> 'explanation'))
      from jsonb_each(att.answers) e
      join jsonb_array_elements(q -> 'questions') qq on qq.value ->> 'id' = e.key), '{}'::jsonb));
end $$;

-- Grades one answer. Single choice takes exactly one option; multiple choice is right only with every
-- correct option and nothing else. Returns right or wrong and the explanation, never the correct option.
-- An answer can't be changed once submitted.
create or replace function public.course_quiz_answer(p_attempt uuid, p_question text, p_picks text[])
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  uid uuid := public.course_require_access();
  att public.course_attempts;
  q jsonb;
  ids text[];
  want text[];
  picks text[];
  right_ boolean;
begin
  select * into att from public.course_attempts where id = p_attempt and user_id = uid for update;
  if att.id is null then raise exception 'course: no such attempt' using errcode = 'P0002'; end if;
  if att.finished_at is not null then raise exception 'course: attempt finished' using errcode = '22023'; end if;

  select qq.value into q
    from public.course_modules m, public.course_flat(m.content) f, jsonb_array_elements(f.item -> 'quiz' -> 'questions') qq
   where m.id = att.module_id and f.item_id = att.item_id and qq.value ->> 'id' = p_question;
  if q is null then raise exception 'course: no such question' using errcode = 'P0002'; end if;

  if att.answers ? p_question then
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
  return jsonb_build_object('picks', to_jsonb(picks), 'right', right_, 'explanation', q ->> 'explanation');
end $$;

-- The result of an attempt: score, pass or fail, and every question marked right or wrong with its
-- explanation. The correct option is not included.
create or replace function public.course_attempt_result(p_attempt uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  uid uuid := public.course_require_access();
  att public.course_attempts;
begin
  select * into att from public.course_attempts where id = p_attempt and (user_id = uid or public.course_is_admin());
  if att.id is null then raise exception 'course: no such attempt' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'attempt', att.id, 'moduleId', att.module_id, 'itemId', att.item_id,
    'finished', att.finished_at is not null, 'startedAt', att.started_at, 'finishedAt', att.finished_at,
    'correct', att.correct, 'total', att.total, 'score', att.score, 'passMark', att.pass_mark, 'passed', att.passed,
    'review', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', qq.value ->> 'id', 'number', (qq.value ->> 'number')::int, 'prompt', qq.value ->> 'prompt',
                  'right', coalesce((att.answers -> (qq.value ->> 'id') ->> 'right')::boolean, false),
                  'answered', att.answers ? (qq.value ->> 'id'),
                  'explanation', qq.value ->> 'explanation') order by qq.ordinality), '[]'::jsonb)
                 from public.course_modules m, public.course_flat(m.content) f,
                      jsonb_array_elements(f.item -> 'quiz' -> 'questions') with ordinality qq
                where m.id = att.module_id and f.item_id = att.item_id));
end $$;

-- Finishes an attempt once every question is answered, and returns the result.
create or replace function public.course_quiz_finish(p_attempt uuid)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  uid uuid := public.course_require_access();
  att public.course_attempts;
  n int;
  pct int;
begin
  select * into att from public.course_attempts where id = p_attempt and user_id = uid for update;
  if att.id is null then raise exception 'course: no such attempt' using errcode = 'P0002'; end if;
  if att.finished_at is null then
    if (select count(*) from jsonb_object_keys(att.answers)) < att.total then
      raise exception 'course: answer every question first' using errcode = '22023';
    end if;
    select count(*) into n from jsonb_each(att.answers) e where (e.value ->> 'right')::boolean;
    pct := floor(n * 100.0 / greatest(att.total, 1));
    update public.course_attempts
       set correct = n, score = pct, passed = pct >= att.pass_mark, finished_at = now(), updated_at = now()
     where id = att.id;
  end if;
  return public.course_attempt_result(p_attempt);
end $$;

-- ---------------------------------------------------------------------------
-- The written drill
-- ---------------------------------------------------------------------------

-- Saves answers as a draft, or submits them (p_submit). Approved work can't be changed.
-- Editing after a submit puts the status back to draft until they submit again.
create or replace function public.course_save_answers(p_module text, p_item text, p_answers jsonb, p_submit boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  uid uuid := public.course_require_access();
  it jsonb := public.course_open_item(uid, p_module, p_item, array['assignment']);
  n int := jsonb_array_length(coalesce(it -> 'tasks', '[]'::jsonb));
  clean jsonb;
  cur public.course_submissions;
  st text;
begin
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'course: bad answers' using errcode = '22023'; end if;
  select coalesce(jsonb_object_agg(e.key, left(e.value #>> '{}', 20000)), '{}'::jsonb) into clean
    from jsonb_each(p_answers) e
   where e.key ~ '^[0-9]+$' and e.key::int between 1 and n and jsonb_typeof(e.value) = 'string';
  select * into cur from public.course_submissions where user_id = uid and module_id = p_module and item_id = p_item for update;
  if cur.status = 'approved' then raise exception 'course: already approved' using errcode = '22023'; end if;
  if p_submit and (select count(*) from jsonb_each_text(clean) e where btrim(e.value) <> '') < n then
    raise exception 'course: answer every task first' using errcode = '22023';
  end if;
  st := case when p_submit then 'submitted'
             when cur.status = 'needs_changes' then 'needs_changes'
             when cur.status = 'submitted' and cur.answers is not distinct from clean then 'submitted'
             else 'draft' end;
  insert into public.course_submissions as s (user_id, module_id, item_id, answers, status, submitted_at, last_submitted_at, history)
  values (uid, p_module, p_item, clean, st,
          case when p_submit then now() end, case when p_submit then now() end,
          case when p_submit then jsonb_build_array(jsonb_build_object('event', 'submitted', 'at', now())) else '[]'::jsonb end)
  on conflict (user_id, module_id, item_id) do update
     set answers = excluded.answers,
         status = excluded.status,
         submitted_at = coalesce(s.submitted_at, excluded.submitted_at),
         last_submitted_at = coalesce(excluded.last_submitted_at, s.last_submitted_at),
         history = s.history || excluded.history,
         updated_at = now();
  return jsonb_build_object('status', st);
end $$;

-- Links the uploaded file (in storage, under uploads/<user id>/) to the submission. Null removes it.
create or replace function public.course_set_file(p_module text, p_item text, p_path text, p_name text)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  uid uuid := public.course_require_access();
  cur public.course_submissions;
begin
  perform public.course_open_item(uid, p_module, p_item, array['assignment']);
  if p_path is not null and p_path not like 'uploads/' || uid::text || '/%' then
    raise exception 'course: bad file path' using errcode = '22023';
  end if;
  select * into cur from public.course_submissions where user_id = uid and module_id = p_module and item_id = p_item for update;
  if cur.status = 'approved' then raise exception 'course: already approved' using errcode = '22023'; end if;
  insert into public.course_submissions as s (user_id, module_id, item_id, file_path, file_name)
  values (uid, p_module, p_item, p_path, left(p_name, 200))
  on conflict (user_id, module_id, item_id) do update
     set file_path = excluded.file_path, file_name = excluded.file_name, updated_at = now(),
         status = case when s.status = 'submitted' then 'draft' else s.status end;
end $$;

-- ---------------------------------------------------------------------------
-- Admin (Amr)
-- ---------------------------------------------------------------------------

-- Everyone with course access or course activity, with where they are.
create or replace function public.course_admin_learners()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.course_require_admin();
  return coalesce((
    with people as (
      select m.user_id from public.members m where m.active is true and to_jsonb(m.access) ? 'course'
      union select user_id from public.course_item_done
      union select user_id from public.course_attempts
      union select user_id from public.course_submissions
    ), cur as (
      -- current module: the lowest-numbered open module whose checkpoint isn't passed yet, else the last open one
      select p.user_id,
             coalesce((select m.id from public.course_modules m, public.course_flat(m.content) f
                        where f.kind = 'checkpoint' and public.course_module_open(p.user_id, m.id)
                          and not public.course_quiz_passed(p.user_id, m.id, f.item_id)
                        order by m.number limit 1),
                      (select m.id from public.course_modules m where public.course_module_open(p.user_id, m.id) order by m.number desc limit 1)) as module_id
        from people p
    )
    select jsonb_agg(jsonb_build_object(
             'userId', c.user_id,
             'name', coalesce(mem.name, u.email),
             'email', u.email,
             'hasAccess', coalesce(mem.active is true and to_jsonb(mem.access) ? 'course', false),
             'module', (select number from public.course_modules where id = c.module_id),
             'moduleId', c.module_id,
             'done', pr.done, 'total', pr.total,
             'lastActive', greatest(
                (select max(done_at) from public.course_item_done d where d.user_id = c.user_id),
                (select max(updated_at) from public.course_attempts a where a.user_id = c.user_id),
                (select max(updated_at) from public.course_submissions s where s.user_id = c.user_id)),
             'checkpoint', (select jsonb_build_object('module', m.number, 'score', a.score, 'passed', a.passed, 'at', a.finished_at)
                              from public.course_attempts a join public.course_modules m on m.id = a.module_id
                              join lateral public.course_flat(m.content) f on f.item_id = a.item_id and f.kind = 'checkpoint'
                             where a.user_id = c.user_id and a.finished_at is not null
                             order by a.finished_at desc limit 1),
             'waiting', (select count(*) from public.course_submissions s where s.user_id = c.user_id and s.status = 'submitted'))
           order by coalesce(mem.name, u.email))
      from cur c
      join auth.users u on u.id = c.user_id
      left join public.members mem on mem.user_id = c.user_id
      left join lateral public.course_module_progress(c.user_id, c.module_id) pr on true
  ), '[]'::jsonb);
end $$;

-- One learner: attempts and submissions, newest first.
create or replace function public.course_admin_learner(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.course_require_admin();
  return jsonb_build_object(
    'userId', p_user,
    'name', coalesce((select name from public.members where user_id = p_user), (select email from auth.users where id = p_user)),
    'email', (select email from auth.users where id = p_user),
    'modules', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'number', m.number, 'title', m.content ->> 'title',
                                   'open', public.course_module_open(p_user, m.id), 'done', pr.done, 'total', pr.total) order by m.number)
                           from public.course_modules m, public.course_module_progress(p_user, m.id) pr), '[]'::jsonb),
    'attempts', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'moduleId', a.module_id, 'itemId', a.item_id,
                                   'title', coalesce(f.item -> 'quiz' ->> 'title', f.item ->> 'title'), 'kind', f.kind,
                                   'score', a.score, 'correct', a.correct, 'total', a.total, 'passed', a.passed,
                                   'startedAt', a.started_at, 'finishedAt', a.finished_at) order by a.finished_at desc)
                            from public.course_attempts a
                            left join public.course_modules m on m.id = a.module_id
                            left join lateral public.course_flat(m.content) f on f.item_id = a.item_id
                           where a.user_id = p_user and a.finished_at is not null), '[]'::jsonb),
    'submissions', coalesce((select jsonb_agg(jsonb_build_object('moduleId', s.module_id, 'itemId', s.item_id, 'status', s.status,
                                   'title', f.item ->> 'title', 'submittedAt', s.last_submitted_at, 'reviewedAt', s.reviewed_at,
                                   'fileName', s.file_name) order by s.updated_at desc)
                               from public.course_submissions s
                               left join public.course_modules m on m.id = s.module_id
                               left join lateral public.course_flat(m.content) f on f.item_id = s.item_id
                              where s.user_id = p_user), '[]'::jsonb));
end $$;

-- One attempt in full, with the correct options (Amr only).
create or replace function public.course_admin_attempt(p_attempt uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare att public.course_attempts;
begin
  perform public.course_require_admin();
  select * into att from public.course_attempts where id = p_attempt;
  if att.id is null then raise exception 'course: no such attempt' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'attempt', att.id, 'userId', att.user_id, 'moduleId', att.module_id, 'itemId', att.item_id,
    'score', att.score, 'correct', att.correct, 'total', att.total, 'passed', att.passed, 'passMark', att.pass_mark,
    'startedAt', att.started_at, 'finishedAt', att.finished_at,
    'title', (select coalesce(f.item -> 'quiz' ->> 'title', f.item ->> 'title') from public.course_modules m, public.course_flat(m.content) f
               where m.id = att.module_id and f.item_id = att.item_id),
    'questions', (select coalesce(jsonb_agg(qq.value || jsonb_build_object('answer', att.answers -> (qq.value ->> 'id')) order by qq.ordinality), '[]'::jsonb)
                    from public.course_modules m, public.course_flat(m.content) f,
                         jsonb_array_elements(f.item -> 'quiz' -> 'questions') with ordinality qq
                   where m.id = att.module_id and f.item_id = att.item_id));
end $$;

-- One submission with the tasks and the reviewer answer key beside it (Amr only).
create or replace function public.course_admin_submission(p_user uuid, p_module text, p_item text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.course_submissions;
  it jsonb;
begin
  perform public.course_require_admin();
  select * into s from public.course_submissions where user_id = p_user and module_id = p_module and item_id = p_item;
  if s.user_id is null then raise exception 'course: no such submission' using errcode = 'P0002'; end if;
  select f.item into it from public.course_modules m, public.course_flat(m.content) f where m.id = p_module and f.item_id = p_item;
  return jsonb_build_object(
    'userId', s.user_id, 'moduleId', s.module_id, 'itemId', s.item_id,
    'name', coalesce((select name from public.members where user_id = s.user_id), (select email from auth.users where id = s.user_id)),
    'title', it ->> 'title', 'instructions', it ->> 'instructions', 'tasks', it -> 'tasks', 'answerKey', it -> 'reviewerAnswerKey',
    'attachTemplate', it ->> 'attachTemplate',
    'answers', s.answers, 'status', s.status, 'comment', s.comment, 'fileName', s.file_name, 'filePath', s.file_path,
    'submittedAt', s.submitted_at, 'lastSubmittedAt', s.last_submitted_at, 'reviewedAt', s.reviewed_at, 'history', s.history);
end $$;

-- Approve, or return with a comment. A comment is required to return work.
create or replace function public.course_review(p_user uuid, p_module text, p_item text, p_approve boolean, p_comment text)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  me uuid := public.course_require_admin();
  st text := case when p_approve then 'approved' else 'needs_changes' end;
  c text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if not p_approve and c is null then raise exception 'course: add a comment' using errcode = '22023'; end if;
  update public.course_submissions
     set status = st, comment = c, reviewed_at = now(), reviewed_by = me, updated_at = now(),
         history = history || jsonb_build_array(jsonb_build_object('event', st, 'at', now(), 'comment', c))
   where user_id = p_user and module_id = p_module and item_id = p_item and status = 'submitted';
  if not found then raise exception 'course: nothing waiting to review' using errcode = '22023'; end if;
  return jsonb_build_object('status', st);
end $$;

-- Adds or replaces modules from a module-N.json file ({ "course": { "title", "totalModules", "modules": [...] } }).
-- Checks the shape first. Returns, per module, the image files it expects, so the Admin screen
-- can ask for the matching thumbnails and guide pages.
create or replace function public.course_add_module(p_file jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  me uuid := public.course_require_admin();
  c jsonb := p_file -> 'course';
  m jsonb;
  bad text;
  out_ jsonb := '[]'::jsonb;
begin
  if c is null or jsonb_typeof(c -> 'modules') <> 'array' or jsonb_array_length(c -> 'modules') = 0 then
    raise exception 'course: the file needs course.modules' using errcode = '22023';
  end if;
  for m in select value from jsonb_array_elements(c -> 'modules') loop
    if coalesce(m ->> 'id', '') !~ '^[a-z0-9-]{1,20}$' or coalesce(m ->> 'number', '') !~ '^[0-9]{1,3}$' or coalesce(m ->> 'title', '') = ''
       or jsonb_typeof(m -> 'items') <> 'array' then
      raise exception 'course: each module needs id, number, title and items' using errcode = '22023';
    end if;
    if exists (select 1 from public.course_modules x where x.number = (m ->> 'number')::int and x.id <> m ->> 'id') then
      raise exception 'course: module number % is already used by another module', m ->> 'number' using errcode = '22023';
    end if;
    -- every item has an id and a known type; ids are unique
    select coalesce(f.item_id, '(missing id)') into bad from public.course_flat(m) f
     where f.item_id is null or f.kind is null or f.kind not in ('lesson', 'assignment', 'checkpoint') limit 1;
    if bad is not null then raise exception 'course: item % has a missing id or an unknown type', bad using errcode = '22023'; end if;
    if (select count(*) from public.course_flat(m)) <> (select count(distinct item_id) from public.course_flat(m)) then
      raise exception 'course: item ids repeat in module %', m ->> 'number' using errcode = '22023';
    end if;
    -- every question: an id, options with ids, at least one correct option; single choice has exactly one
    select qq.value ->> 'id' into bad
      from public.course_flat(m) f, jsonb_array_elements(coalesce(f.item -> 'quiz' -> 'questions', '[]'::jsonb)) qq
     where coalesce(qq.value ->> 'id', '') = '' or qq.value ->> 'type' not in ('single', 'multiple')
        or jsonb_typeof(qq.value -> 'options') <> 'array' or jsonb_array_length(qq.value -> 'options') < 2
        or (select count(*) from jsonb_array_elements(qq.value -> 'options') o where (o.value ->> 'correct')::boolean) not between 1 and
           case when qq.value ->> 'type' = 'single' then 1 else 99 end
     limit 1;
    if bad is not null then raise exception 'course: question % is missing options or correct answers', bad using errcode = '22023'; end if;
    if exists (select 1 from public.course_flat(m) f where f.kind = 'checkpoint' and f.item -> 'quiz' is null) then
      raise exception 'course: the checkpoint in module % has no quiz', m ->> 'number' using errcode = '22023';
    end if;

    insert into public.course_modules (id, number, content, updated_by) values (m ->> 'id', (m ->> 'number')::int, m, me)
    on conflict (id) do update set number = excluded.number, content = excluded.content, updated_at = now(), updated_by = me;

    out_ := out_ || jsonb_build_object(
      'id', m ->> 'id', 'number', (m ->> 'number')::int, 'title', m ->> 'title',
      'lessons', (select count(*) from public.course_flat(m) f where f.kind = 'lesson'),
      'questions', (select count(*) from public.course_flat(m) f, jsonb_array_elements(coalesce(f.item -> 'quiz' -> 'questions', '[]'::jsonb)) q),
      'images', (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from (
                   select m ->> 'thumbnail' as x
                   union all select e.value ->> 'thumbnail' from jsonb_path_query(m, 'strict $.**.items[*]') e(value)
                   union all select s from public.course_flat(m) f, jsonb_array_elements_text(coalesce(f.item -> 'sourceImages', '[]'::jsonb)) s) i
                 where x is not null));
  end loop;
  insert into public.course_meta (id, title, total_modules)
  values (true, coalesce(c ->> 'title', 'Acquisitions Playbook'), coalesce((c ->> 'totalModules')::int, 14))
  on conflict (id) do update set title = excluded.title, total_modules = excluded.total_modules, updated_at = now();
  return out_;
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security: learners read their own rows, Amr reads everyone's
-- ---------------------------------------------------------------------------

drop policy if exists course_meta_read on public.course_meta;
create policy course_meta_read on public.course_meta for select to authenticated using (public.course_has_access());

drop policy if exists course_item_done_read on public.course_item_done;
create policy course_item_done_read on public.course_item_done for select to authenticated
  using (user_id = auth.uid() or public.course_is_admin());

drop policy if exists course_attempts_read on public.course_attempts;
create policy course_attempts_read on public.course_attempts for select to authenticated
  using (user_id = auth.uid() or public.course_is_admin());

drop policy if exists course_submissions_read on public.course_submissions;
create policy course_submissions_read on public.course_submissions for select to authenticated
  using (user_id = auth.uid() or public.course_is_admin());

-- ---------------------------------------------------------------------------
-- Function permissions: signed-in users only (each function checks access itself)
-- ---------------------------------------------------------------------------

do $$
declare f text;
begin
  foreach f in array array[
    'course_is_admin()', 'course_has_access()', 'course_require_access()', 'course_require_admin()',
    'course_flat(jsonb)', 'course_public_quiz(jsonb)', 'course_public_item(jsonb, boolean)',
    'course_quiz_passed(uuid, text, text)', 'course_checkpoint_open(uuid, text)', 'course_module_open(uuid, text)',
    'course_module_progress(uuid, text)', 'course_state()', 'course_open_item(uuid, text, text, text[])',
    'course_mark_done(text, text, boolean)', 'course_quiz_start(text, text, boolean)', 'course_quiz_answer(uuid, text, text[])',
    'course_attempt_result(uuid)', 'course_quiz_finish(uuid)', 'course_save_answers(text, text, jsonb, boolean)',
    'course_set_file(text, text, text, text)', 'course_admin_learners()', 'course_admin_learner(uuid)',
    'course_admin_attempt(uuid)', 'course_admin_submission(uuid, text, text)', 'course_review(uuid, text, text, boolean, text)',
    'course_add_module(jsonb)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Internal helpers that take a user id: not callable from the browser, so nobody can ask about someone else
revoke execute on function public.course_quiz_passed(uuid, text, text) from authenticated;
revoke execute on function public.course_checkpoint_open(uuid, text) from authenticated;
revoke execute on function public.course_module_open(uuid, text) from authenticated;
revoke execute on function public.course_module_progress(uuid, text) from authenticated;
revoke execute on function public.course_open_item(uuid, text, text, text[]) from authenticated;

-- ---------------------------------------------------------------------------
-- Storage: one private bucket, "course"
--   content/<module id>/<file>          thumbnails and guide pages (Amr uploads, learners read)
--   uploads/<user id>/<item id>/<file>  drill files (each learner their own, Amr reads all)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course', 'course', false, 10485760, array[
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

drop policy if exists course_content_read on storage.objects;
create policy course_content_read on storage.objects for select to authenticated
  using (bucket_id = 'course' and (storage.foldername(name))[1] = 'content' and public.course_has_access());

drop policy if exists course_content_write on storage.objects;
create policy course_content_write on storage.objects for insert to authenticated
  with check (bucket_id = 'course' and (storage.foldername(name))[1] = 'content' and public.course_is_admin());

drop policy if exists course_content_update on storage.objects;
create policy course_content_update on storage.objects for update to authenticated
  using (bucket_id = 'course' and (storage.foldername(name))[1] = 'content' and public.course_is_admin());

drop policy if exists course_content_delete on storage.objects;
create policy course_content_delete on storage.objects for delete to authenticated
  using (bucket_id = 'course' and (storage.foldername(name))[1] = 'content' and public.course_is_admin());

drop policy if exists course_uploads_read on storage.objects;
create policy course_uploads_read on storage.objects for select to authenticated
  using (bucket_id = 'course' and (storage.foldername(name))[1] = 'uploads'
         and ((storage.foldername(name))[2] = auth.uid()::text or public.course_is_admin()));

drop policy if exists course_uploads_write on storage.objects;
create policy course_uploads_write on storage.objects for insert to authenticated
  with check (bucket_id = 'course' and (storage.foldername(name))[1] = 'uploads'
              and (storage.foldername(name))[2] = auth.uid()::text and public.course_has_access());

drop policy if exists course_uploads_delete on storage.objects;
create policy course_uploads_delete on storage.objects for delete to authenticated
  using (bucket_id = 'course' and (storage.foldername(name))[1] = 'uploads'
         and (storage.foldername(name))[2] = auth.uid()::text
         and not exists (select 1 from public.course_submissions s where s.file_path = name and s.status = 'approved'));

-- ---------------------------------------------------------------------------
-- members.access: allow the new value 'course'
-- If a check constraint lists the allowed values, add 'course' next to 'learn'.
-- If access is an enum array, add 'course' to the enum. Otherwise nothing to do.
-- ---------------------------------------------------------------------------

do $$
declare
  c record;
  def text;
  enum_type regtype;
begin
  for c in
    select con.conname, pg_get_constraintdef(con.oid) as def
      from pg_constraint con
     where con.conrelid = 'public.members'::regclass and con.contype = 'c'
       and pg_get_constraintdef(con.oid) like '%''learn''%'
       and pg_get_constraintdef(con.oid) not like '%''course''%'
  loop
    def := replace(c.def, '''learn''::text', '''learn''::text, ''course''::text');
    if def = c.def then
      def := replace(c.def, '''learn''', '''learn'', ''course''');
    end if;
    execute format('alter table public.members drop constraint %I', c.conname);
    execute format('alter table public.members add constraint %I %s', c.conname, def);
    raise notice 'members: added course to constraint %', c.conname;
  end loop;

  select t.typelem::regtype into enum_type
    from pg_attribute a join pg_type t on t.oid = a.atttypid
   where a.attrelid = 'public.members'::regclass and a.attname = 'access' and t.typcategory = 'A';
  if enum_type is not null and exists (select 1 from pg_type where oid = enum_type and typtype = 'e')
     and not exists (select 1 from pg_enum where enumtypid = enum_type and enumlabel = 'course') then
    execute format('alter type %s add value %L', enum_type, 'course');
    raise notice 'members: added course to enum %', enum_type;
  end if;
end $$;
