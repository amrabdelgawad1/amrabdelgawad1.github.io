-- learn_progress: let each signed-in person read and save their own course progress
--
-- The Learning Hub, the Marketing course and the Psychology course all save progress to learn_progress
-- (one row per person per course). On the live project the table refused signed-in users with
-- "permission denied for table learn_progress", so progress only stayed on each device.
-- This makes sure the table exists, gives signed-in users table access, and limits every row to its owner.
-- Safe to run more than once. Existing rows are kept.

create table if not exists public.learn_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  course text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, course)
);

-- upsert needs a unique key on (user_id, course); add one if the table was made without it
do $$
begin
  if not exists (
    select 1 from pg_index i join pg_class t on t.oid = i.indrelid
     where t.oid = 'public.learn_progress'::regclass and i.indisunique
       and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
             where a.attrelid = t.oid and a.attnum = any(i.indkey)) = array['course', 'user_id']
  ) then
    create unique index learn_progress_user_course on public.learn_progress (user_id, course);
  end if;
end $$;

alter table public.learn_progress enable row level security;
grant select, insert, update, delete on public.learn_progress to authenticated;

drop policy if exists "learn_progress own read" on public.learn_progress;
create policy "learn_progress own read" on public.learn_progress for select to authenticated
  using (user_id = auth.uid() or coalesce(public.is_tracker_admin(), false));
drop policy if exists "learn_progress own insert" on public.learn_progress;
create policy "learn_progress own insert" on public.learn_progress for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "learn_progress own update" on public.learn_progress;
create policy "learn_progress own update" on public.learn_progress for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "learn_progress own delete" on public.learn_progress;
create policy "learn_progress own delete" on public.learn_progress for delete to authenticated
  using (user_id = auth.uid());
