-- Phase 1: the do-not-call list. When a seller asks not to be called again (or a number is wrong, or on the
-- National Do Not Call Registry), a rep adds it; anyone on the team can check a number before dialing; Amr sees
-- the whole list in Admin > Logs and can download it for the dialer.
-- The number itself is stored (digits only), because it has to be matched and exported. Nobody but Amr can read
-- the list: reps only add and get a yes or no for one number at a time.
-- Safe to run more than once.
create table if not exists public.dnc_numbers (
  phone text primary key,                -- digits only; US numbers without the leading 1
  reason text not null check (reason in ('asked', 'wrong_number', 'registry', 'attorney', 'other')),
  note text,
  added_by uuid default auth.uid(),
  added_at timestamptz not null default now()
);
alter table public.dnc_numbers enable row level security;
revoke all on public.dnc_numbers from anon, authenticated;

create or replace function public.dnc_normal(p text)
returns text language sql immutable set search_path = '' as $$
  select case when length(d) = 11 and left(d, 1) = '1' then substr(d, 2) else d end
    from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;

create or replace function public.dnc_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.is_tracker_admin(), false)
      or exists (select 1 from public.members m where m.user_id = auth.uid() and m.active)
$$;
revoke all on function public.dnc_allowed() from public, anon, authenticated;

-- Add a number (or update its reason). Returns the stored digits.
create or replace function public.dnc_add(p_phone text, p_reason text, p_note text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v text := public.dnc_normal(p_phone);
begin
  if not public.dnc_allowed() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if length(v) < 7 or length(v) > 15 then raise exception 'That doesn''t look like a phone number' using errcode = '22023'; end if;
  insert into public.dnc_numbers (phone, reason, note) values (v, p_reason, left(nullif(btrim(coalesce(p_note, '')), ''), 200))
    on conflict (phone) do update set reason = excluded.reason, note = coalesce(excluded.note, public.dnc_numbers.note);
  return v;
end $$;

-- Is this number on the list? (one number at a time; never the list)
create or replace function public.dnc_check(p_phone text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.dnc_allowed() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return exists (select 1 from public.dnc_numbers d where d.phone = public.dnc_normal(p_phone));
end $$;

-- Amr: the whole list, newest first
create or replace function public.portal_dnc()
returns table(phone text, reason text, note text, who text, added_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce(public.is_tracker_admin(), false) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query select d.phone, d.reason, d.note, coalesce(m.name, case when d.added_by = public.portal_owner_id() then 'Amr' end, 'Someone'), d.added_at
    from public.dnc_numbers d left join public.members m on m.user_id = d.added_by order by d.added_at desc;
end $$;

-- Amr: take a number off (for example, added by mistake)
create or replace function public.dnc_remove(p_phone text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.is_tracker_admin(), false) then raise exception 'Not allowed' using errcode = '42501'; end if;
  delete from public.dnc_numbers where phone = public.dnc_normal(p_phone);
  return found;
end $$;

revoke all on function public.dnc_add(text, text, text), public.dnc_check(text), public.portal_dnc(), public.dnc_remove(text) from public, anon;
grant execute on function public.dnc_add(text, text, text), public.dnc_check(text), public.portal_dnc(), public.dnc_remove(text) to authenticated;
