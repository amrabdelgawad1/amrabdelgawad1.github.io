-- Fixes from the security review of the library (Nov 1):
-- 1. An example call shows a neutral label to the team ("Real call, Oct 2026"), never the rep's own title, which can
--    name the seller's county.
-- 2. An example plays only while its call is still a real call with consent, approved and scored 45 or more, so a
--    recording that went back to "waiting" (and could be swapped by its owner) stops playing.
-- 3. A turned-off entry hides everything about it from the team: earlier wording and examples too.
-- Safe to run more than once.

alter table public.library_examples add column if not exists label text check (char_length(label) <= 80);

create or replace function public.library_examples_check()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_at timestamptz;
begin
  select h.created_at into v_at from public.hub_uploads h where h.id = new.upload_id and h.course = 'calls' and h.real_call and h.consent
     and h.status = 'approved' and h.score is not null and (h.score ->> 'total')::int >= 45;
  if not found then raise exception 'Only a real call scored 45 or more can be an example.' using errcode = '22023'; end if;
  new.label := 'Real call, ' || to_char(v_at at time zone 'Africa/Cairo', 'Mon YYYY');
  new.created_at := now();
  return new;
end $$;
update public.library_examples e set label = 'Real call, ' || to_char(h.created_at at time zone 'Africa/Cairo', 'Mon YYYY')
  from public.hub_uploads h where h.id = e.upload_id and e.label is null;

-- Is this example still good to play, and is its entry on (or is it Amr)?
create or replace function public.library_example_ok(p_entry bigint, p_upload uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.library_entries x join public.hub_uploads h on h.id = p_upload
                  where x.id = p_entry and (x.active or coalesce(public.is_tracker_admin(), false))
                    and h.course = 'calls' and h.real_call and h.consent and h.status = 'approved'
                    and h.score is not null and (h.score ->> 'total')::int >= 45)
$$;
revoke all on function public.library_example_ok(bigint, uuid) from public, anon, authenticated;

create or replace function public.library_example_calls()
returns table(entry_id bigint, upload_id uuid, path text, title text, total integer, rep text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.library_can_read() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select e.entry_id, h.id, h.path, coalesce(e.label, 'Real call'), (h.score ->> 'total')::integer, split_part(coalesce(public.notify_name(h.user_id), ''), ' ', 1), h.created_at
    from public.library_examples e join public.hub_uploads h on h.id = e.upload_id
   where public.library_example_ok(e.entry_id, e.upload_id)
   order by (h.score ->> 'total')::integer desc, h.created_at desc;
end $$;

create or replace function public.library_is_example(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.library_can_read() and exists (
    select 1 from public.library_examples e join public.hub_uploads h on h.id = e.upload_id
     where h.path = p_path and public.library_example_ok(e.entry_id, e.upload_id))
$$;

drop policy if exists "library versions read" on public.library_versions;
create policy "library versions read" on public.library_versions for select to authenticated
  using (coalesce(public.is_tracker_admin(), false) or (public.library_can_read()
         and exists (select 1 from public.library_entries x where x.id = entry_id and x.active)));
drop policy if exists "library examples read" on public.library_examples;
create policy "library examples read" on public.library_examples for select to authenticated
  using (coalesce(public.is_tracker_admin(), false) or (public.library_can_read()
         and exists (select 1 from public.library_entries x where x.id = entry_id and x.active)));
