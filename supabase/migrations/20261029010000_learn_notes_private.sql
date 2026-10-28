-- learn_notes: what learners type into the course tools (Marketing cost-per-deal calculator,
-- Psychology thought record and goal planner).
--
-- Private to the learner. Unlike learn_progress, there is NO admin read rule here: the app never
-- shows one person's entries to anyone else, Amr included. (As the owner of the Supabase project,
-- Amr could still open the table in the Supabase dashboard; the app itself never reads other people's rows.)
--
-- One row per person, per course, per tool. A person can only save to a course they can open
-- (learn_can_open from 20261028180000_course_content_lock.sql), and a row is capped at about 500 KB.
-- Safe to run more than once. Nothing here touches members, learn_progress or the course content.

create table if not exists public.learn_notes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course text not null check (course in ('mkt', 'psy')),
  tool text not null check (tool ~ '^[a-z0-9_-]{1,32}$'),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 512000),
  updated_at timestamptz not null default now(),
  primary key (user_id, course, tool)
);

alter table public.learn_notes enable row level security;
revoke all on public.learn_notes from anon;
grant select, insert, update, delete on public.learn_notes to authenticated;

drop policy if exists "learn_notes own read" on public.learn_notes;
create policy "learn_notes own read" on public.learn_notes for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "learn_notes own insert" on public.learn_notes;
create policy "learn_notes own insert" on public.learn_notes for insert to authenticated
  with check (user_id = auth.uid() and public.learn_can_open(course));

drop policy if exists "learn_notes own update" on public.learn_notes;
create policy "learn_notes own update" on public.learn_notes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.learn_can_open(course));

drop policy if exists "learn_notes own delete" on public.learn_notes;
create policy "learn_notes own delete" on public.learn_notes for delete to authenticated
  using (user_id = auth.uid());
