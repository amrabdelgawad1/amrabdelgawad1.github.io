-- Review center: recordings and files learners send for review from any Learning Hub course,
-- and Amr's scores and time-stamped comments on them.
--
-- hub_uploads           one row per recording or file a learner sends
-- hub_upload_comments   comments on an upload, optionally pinned to a second in the recording
-- storage "hub-uploads" private bucket; files live at <user id>/<course>/<file>
--
-- Learners send and read only their own uploads and the comments on them. Only Amr (is_tracker_admin)
-- reads everyone's, scores them and approves or returns them. Safe to run more than once.

-- Who may send for a course: the Acquisitions course uses its own switch; the other courses need
-- Learning Hub plus the course's switch (learn_can_open). Amr always can.
create or replace function public.hub_can_send(p_course text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select case p_course
    when 'acq' then coalesce(public.is_tracker_admin(), false) or exists (
      select 1 from public.members m where m.user_id = auth.uid() and m.active is true and to_jsonb(m.access) ? 'course')
    when 'mkt' then public.learn_can_open('mkt')
    when 'psy' then public.learn_can_open('psy')
    else false end
$$;
revoke all on function public.hub_can_send(text) from public;
grant execute on function public.hub_can_send(text) to authenticated;

create table if not exists public.hub_uploads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course      text not null check (course in ('acq', 'mkt', 'psy')),
  module      text,                       -- e.g. 'm5'
  item        text,                       -- e.g. '5.2.s2'
  title       text not null default '' check (length(title) <= 200),
  kind        text not null check (kind in ('recording', 'file')),
  path        text not null unique,
  file_name   text check (length(file_name) <= 200),
  mime        text check (length(mime) <= 100),
  size_bytes  bigint check (size_bytes >= 0),
  duration_s  numeric check (duration_s >= 0),
  note        text check (length(note) <= 2000),
  real_call   boolean not null default false,  -- a real seller call, not a role-play
  consent     boolean not null default false,  -- the learner confirmed everyone on the call agreed to be recorded
  status      text not null default 'waiting' check (status in ('waiting', 'approved', 'redo')),
  score       jsonb,                       -- {"cats":[1..5 x 10], "total":n} on the 50-point call scorecard
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint hub_uploads_consent check (not real_call or consent)
);
create index if not exists hub_uploads_user on public.hub_uploads (user_id, created_at desc);
create index if not exists hub_uploads_status on public.hub_uploads (status, created_at desc);

create table if not exists public.hub_upload_comments (
  id         uuid primary key default gen_random_uuid(),
  upload_id  uuid not null references public.hub_uploads(id) on delete cascade,
  author     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  at_s       numeric check (at_s >= 0),    -- second in the recording, if pinned
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists hub_upload_comments_upload on public.hub_upload_comments (upload_id, created_at);

alter table public.hub_uploads enable row level security;
alter table public.hub_upload_comments enable row level security;
grant select, insert, delete on public.hub_uploads to authenticated;
grant select, insert, delete on public.hub_upload_comments to authenticated;
revoke update on public.hub_uploads from authenticated;   -- reviews go through hub_review() only
revoke update on public.hub_upload_comments from authenticated;
revoke all on public.hub_uploads from anon;
revoke all on public.hub_upload_comments from anon;

drop policy if exists "hub_uploads read" on public.hub_uploads;
create policy "hub_uploads read" on public.hub_uploads for select to authenticated
  using (user_id = auth.uid() or coalesce(public.is_tracker_admin(), false));
drop policy if exists "hub_uploads send" on public.hub_uploads;
create policy "hub_uploads send" on public.hub_uploads for insert to authenticated
  with check (user_id = auth.uid() and public.hub_can_send(course)
              and status = 'waiting' and score is null and reviewed_at is null and reviewed_by is null
              and path like auth.uid()::text || '/' || course || '/%');
drop policy if exists "hub_uploads remove" on public.hub_uploads;
create policy "hub_uploads remove" on public.hub_uploads for delete to authenticated
  using ((user_id = auth.uid() and status = 'waiting') or coalesce(public.is_tracker_admin(), false));

drop policy if exists "hub_comments read" on public.hub_upload_comments;
create policy "hub_comments read" on public.hub_upload_comments for select to authenticated
  using (coalesce(public.is_tracker_admin(), false)
         or exists (select 1 from public.hub_uploads u where u.id = upload_id and u.user_id = auth.uid()));
drop policy if exists "hub_comments write" on public.hub_upload_comments;
create policy "hub_comments write" on public.hub_upload_comments for insert to authenticated
  with check (author = auth.uid() and (coalesce(public.is_tracker_admin(), false)
              or exists (select 1 from public.hub_uploads u where u.id = upload_id and u.user_id = auth.uid())));
drop policy if exists "hub_comments remove" on public.hub_upload_comments;
create policy "hub_comments remove" on public.hub_upload_comments for delete to authenticated
  using (author = auth.uid() or coalesce(public.is_tracker_admin(), false));

-- Amr approves or returns an upload, with an optional scorecard
create or replace function public.hub_review(p_id uuid, p_status text, p_score jsonb)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare n int;
begin
  if not coalesce(public.is_tracker_admin(), false) then raise exception 'hub: admin only' using errcode = '42501'; end if;
  if p_status not in ('waiting', 'approved', 'redo') then raise exception 'hub: bad status' using errcode = '22023'; end if;
  if p_score is not null then
    if jsonb_typeof(p_score -> 'cats') <> 'array' or jsonb_array_length(p_score -> 'cats') <> 10
       or exists (select 1 from jsonb_array_elements(p_score -> 'cats') c
                   where jsonb_typeof(c) <> 'number' or (c #>> '{}')::numeric not in (1, 2, 3, 4, 5)) then
      raise exception 'hub: the scorecard needs 10 scores from 1 to 5' using errcode = '22023';
    end if;
    p_score := jsonb_build_object('cats', p_score -> 'cats',
      'total', (select sum((c #>> '{}')::int) from jsonb_array_elements(p_score -> 'cats') c));
  end if;
  update public.hub_uploads
     set status = p_status, score = p_score,
         reviewed_at = case when p_status = 'waiting' then null else now() end,
         reviewed_by = case when p_status = 'waiting' then null else auth.uid() end
   where id = p_id;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'hub: not found' using errcode = '22023'; end if;
end $$;
revoke all on function public.hub_review(uuid, text, jsonb) from public;
grant execute on function public.hub_review(uuid, text, jsonb) to authenticated;

-- Private bucket for the files: 50 MB each, audio, images, PDFs and Office files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hub-uploads', 'hub-uploads', false, 52428800, array[
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/mp3', 'audio/aac', 'audio/x-m4a', 'audio/m4a', 'audio/wav', 'audio/x-wav',
  'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "hub-uploads read" on storage.objects;
create policy "hub-uploads read" on storage.objects for select to authenticated
  using (bucket_id = 'hub-uploads' and ((storage.foldername(name))[1] = auth.uid()::text or coalesce(public.is_tracker_admin(), false)));
drop policy if exists "hub-uploads send" on storage.objects;
create policy "hub-uploads send" on storage.objects for insert to authenticated
  with check (bucket_id = 'hub-uploads' and (storage.foldername(name))[1] = auth.uid()::text
              and public.hub_can_send((storage.foldername(name))[2]));
drop policy if exists "hub-uploads remove" on storage.objects;
create policy "hub-uploads remove" on storage.objects for delete to authenticated
  using (bucket_id = 'hub-uploads' and (
    coalesce(public.is_tracker_admin(), false)
    or ((storage.foldername(name))[1] = auth.uid()::text
        and not exists (select 1 from public.hub_uploads u where u.path = name and u.status <> 'waiting'))));
