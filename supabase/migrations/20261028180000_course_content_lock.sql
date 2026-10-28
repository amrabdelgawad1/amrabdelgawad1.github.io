-- Course content lock and per-course access.
--
-- What this does:
-- 1. Adds learn_can_open(course): true for Amr (is_tracker_admin()), or for an active team member
--    whose members.access holds BOTH 'learn' (the Learning Hub switch) AND the course's own switch.
--    Course switches today: 'mkt' (Marketing). The Acquisitions course keeps its own switch 'course'
--    and its own checks (course_has_access() in 20261028120000_course_app.sql).
-- 2. Creates the private storage bucket "course-content". Lesson files live there as
--    <course switch>/content.json (for example mkt/content.json), never on the public website.
--    Anyone may read a course's folder only if learn_can_open(<folder>) is true.
--    The folder "_src" (the editable source files) is Amr's alone.
--    Only Amr can add, replace or delete files.
--
-- Safe to run more than once. Nothing here touches members, learn_progress or anyone's saved work.

create or replace function public.learn_can_open(p_course text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.is_tracker_admin(), false)
      or exists (select 1 from public.members m
                 where m.user_id = auth.uid() and m.active is true
                   and to_jsonb(m.access) ? 'learn'
                   and to_jsonb(m.access) ? p_course);
$$;
revoke all on function public.learn_can_open(text) from public;
grant execute on function public.learn_can_open(text) to authenticated;

insert into storage.buckets (id, name, public)
values ('course-content', 'course-content', false)
on conflict (id) do update set public = false;

drop policy if exists "course-content read" on storage.objects;
create policy "course-content read" on storage.objects for select to authenticated
using (
  bucket_id = 'course-content'
  and (
    coalesce(public.is_tracker_admin(), false)
    or ((storage.foldername(name))[1] <> '_src' and public.learn_can_open((storage.foldername(name))[1]))
  )
);

drop policy if exists "course-content owner insert" on storage.objects;
create policy "course-content owner insert" on storage.objects for insert to authenticated
with check (bucket_id = 'course-content' and coalesce(public.is_tracker_admin(), false));

drop policy if exists "course-content owner update" on storage.objects;
create policy "course-content owner update" on storage.objects for update to authenticated
using (bucket_id = 'course-content' and coalesce(public.is_tracker_admin(), false))
with check (bucket_id = 'course-content' and coalesce(public.is_tracker_admin(), false));

drop policy if exists "course-content owner delete" on storage.objects;
create policy "course-content owner delete" on storage.objects for delete to authenticated
using (bucket_id = 'course-content' and coalesce(public.is_tracker_admin(), false));
