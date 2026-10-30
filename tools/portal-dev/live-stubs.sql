-- Local test only, NOT a migration. Stand-ins for the parts of the live database that aren't in supabase/migrations,
-- copied from the reviewer's exports of Oct 30 2026 (DB-EXPORT-R2 and R2b). The owner's address is a fake one here.
-- Runs after tools/course-dev/stubs.sql and the repo migrations, before the migration under test.

-- members, as live: role only allowed 'member' (the live rule is named members_role_check, the same name as the new one), plus the Deal tools columns
alter table public.members add column if not exists role text not null default 'member';
alter table public.members add column if not exists deals_until date;
alter table public.members add column if not exists deals_mfa boolean not null default false;
alter table public.members add column if not exists agent_id bigint;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.members'::regclass and conname = 'members_role_check') then
    alter table public.members add constraint members_role_check check (role = 'member');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.members'::regclass and conname = 'members_access_check') then
    alter table public.members add constraint members_access_check
      check (access <@ array['psy','mkt','learn','course','live','requests','team','money','deals']::text[]);
  end if;
end $$;

-- is_tracker_admin as live: the owner's address in the token AND the authenticator done
create or replace function public.is_tracker_admin()
returns boolean language sql stable set search_path to '' as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'owner@example.com' and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function public.has_access(p_section text)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.members m
    where m.user_id = auth.uid() and m.active and p_section = any(m.access)
      and (p_section in ('live', 'requests') or coalesce(auth.jwt() ->> 'aal', '') = 'aal2'))
$$;

create table if not exists public.shifts (
  id bigint generated always as identity primary key, name text, shift_date date, work_seconds int, break_seconds int,
  started_at timestamptz, ended_at timestamptz, company_id bigint, source text, user_id uuid, owner boolean not null default false);
create table if not exists public.shift_requests (
  id bigint generated always as identity primary key, user_id uuid, name text, shift_date date, work_seconds int, break_seconds int,
  started_at timestamptz, ended_at timestamptz, company_id bigint, status text not null default 'pending', reason text,
  shift_id bigint, decided_at timestamptz, created_at timestamptz default now());
create table if not exists public.live_status (user_id uuid primary key, mode text, started_at timestamptz);

alter table public.members enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_requests enable row level security;
alter table public.live_status enable row level security;
grant select, insert, update, delete on public.members, public.shifts, public.shift_requests, public.live_status to authenticated;

drop policy if exists "Access: live members" on public.members;
create policy "Access: live members" on public.members for select to authenticated using (public.has_access('live'));
drop policy if exists "Member reads self" on public.members;
create policy "Member reads self" on public.members for select to authenticated using (user_id = auth.uid());
drop policy if exists "Owner manages members" on public.members;
create policy "Owner manages members" on public.members for all to authenticated using (public.is_tracker_admin()) with check (public.is_tracker_admin());

drop policy if exists "Access: live status" on public.live_status;
create policy "Access: live status" on public.live_status for select to authenticated using (public.has_access('live'));
drop policy if exists "Owner reads status" on public.live_status;
create policy "Owner reads status" on public.live_status for select to authenticated using (public.is_tracker_admin());

drop policy if exists "Access: requests" on public.shift_requests;
create policy "Access: requests" on public.shift_requests for select to authenticated using (public.has_access('requests'));
drop policy if exists "Member reads own requests" on public.shift_requests;
create policy "Member reads own requests" on public.shift_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists "Owner reads requests" on public.shift_requests;
create policy "Owner reads requests" on public.shift_requests for select to authenticated using (public.is_tracker_admin());

drop policy if exists "Access: shifts" on public.shifts;
create policy "Access: shifts" on public.shifts for select to authenticated
  using (public.has_access('money') or ((not owner) and public.has_access('team')));
drop policy if exists "Admin manages shifts" on public.shifts;
create policy "Admin manages shifts" on public.shifts for all to authenticated using (public.is_tracker_admin()) with check (public.is_tracker_admin());

-- the stray policy found live
drop policy if exists "learn: own rows" on public.learn_progress;
create policy "learn: own rows" on public.learn_progress for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.decide_shift_request(p_id bigint, p_approve boolean, p_reason text default null::text)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare
 r public.shift_requests; v_shift bigint;
begin
 if not public.is_tracker_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
 select * into r from public.shift_requests where id = p_id for update;
 if r.id is null then raise exception 'Request not found' using errcode = 'P0002'; end if;
 if r.status <> 'pending' then raise exception 'Already decided' using errcode = '22023'; end if;
 if p_approve then
 insert into public.shifts (name, shift_date, work_seconds, break_seconds, started_at, ended_at, company_id, source, user_id)
 values (r.name, r.shift_date, r.work_seconds, r.break_seconds, r.started_at, r.ended_at, r.company_id, 'manual', r.user_id)
 returning id into v_shift;
 update public.shift_requests set status = 'approved', shift_id = v_shift, decided_at = now() where id = p_id;
 else
 update public.shift_requests set status = 'rejected', reason = nullif(btrim(coalesce(p_reason, '')), ''), decided_at = now() where id = p_id;
 end if;
 return v_shift;
end;
$function$;

create or replace function public.deal_access_status()
returns text language sql stable security definer set search_path to '' as $function$
 select case
 when public.is_tracker_admin() then 'ok'
 when coalesce(auth.jwt() ->> 'email', '') = 'owner@example.com' then 'mfa'
 when m.user_id is null then 'none'
 when m.deals_until is not null and m.deals_until < (now() at time zone 'Africa/Cairo')::date then 'expired'
 when m.deals_mfa and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then 'mfa'
 else 'ok'
 end
 from (select 1) one
 left join public.members m on m.user_id = auth.uid() and m.active and 'deals' = any(m.access);
$function$;
grant execute on function public.has_access(text), public.decide_shift_request(bigint, boolean, text), public.deal_access_status() to authenticated;

-- ---------- round 7 ----------
-- shifts carry the optional numbers from the end-of-shift brief (cash/team.js reads them)
alter table public.shifts add column if not exists dials integer;
alter table public.shifts add column if not exists conversations integer;
alter table public.shifts add column if not exists appointments integer;
-- The Deal CRM tables. ASSUMED from the CRM's own calls (not exported yet): deal_logs is read by tool and saved with
-- onConflict (user_id, tool); deal_followups is written as { deal_key, due } and cleared by user_id. Each person their
-- own rows. The reviewer compares these with the live definitions before running round 7.
create table if not exists public.deal_logs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tool text not null, blob jsonb, updated_at timestamptz not null default now(),
  unique (user_id, tool));
create table if not exists public.deal_followups (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_key text not null, due date);
alter table public.deal_logs enable row level security;
alter table public.deal_followups enable row level security;
grant select, insert, update, delete on public.deal_logs, public.deal_followups to authenticated;
drop policy if exists "deal_logs own rows" on public.deal_logs;
create policy "deal_logs own rows" on public.deal_logs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "deal_followups own rows" on public.deal_followups;
create policy "deal_followups own rows" on public.deal_followups for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
