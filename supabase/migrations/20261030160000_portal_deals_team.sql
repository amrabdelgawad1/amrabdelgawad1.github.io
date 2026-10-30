-- Portal round 7: the Deal CRM as a team (one team passphrase), and the weekly team board.
--
-- The Deal CRM encrypts everything in the browser (AES-GCM, key from a passphrase with PBKDF2) before it reaches
-- deal_logs. The database never sees a passphrase or a key, and still doesn't after this. Amr's decision: ONE team
-- passphrase, so Amr and managers can open everyone's deals in their own browser. This file adds:
--   1. portal_owner: Amr's user id, found from the address already inside is_tracker_admin() (so it is never typed
--      into this repo). Used to give deals to Amr.
--   2. deal_logs.user_id and deal_followups.user_id (the owner of the deal): added only if missing, with any rows
--      that have none given to Amr. The existing row rules (each person their own rows) are NOT changed, because
--      the calculators read deal_logs by tool name alone and rely on getting only their own row.
--   3. deal_team: the team salt and a "team check" (a known value encrypted with the team key), so a mistyped
--      passphrase is caught before someone creates a workspace nobody else can open. Not a key, not a passphrase.
--   4. deal_team_rows(): the rows each person may fetch, decided here:
--        owner: everyone's · manager: everyone's, with the authenticator code · agent: their own.
--   5. deal_rekey(): change the passphrase in one step. The browser re-encrypts every row and checks each; this
--      saves them all in one transaction, refuses if any row changed meanwhile, and refuses if any row in scope
--      would be left on the old key. Never a mix. A save guard refuses workspaces saved on an old key.
--   6. Turning someone off gives their deals to Amr: only user_id (and the row's tool name) change, the encrypted
--      data stays exactly as it is.
--   7. portal_team_board(): this week's effort per active team member: calls logged (shifts.dials), lessons passed
--      (course_item_done), drills sent (recordings and written drills). Never hours, pay or deal money.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Amr's user id
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.portal_owner (
  only_one boolean primary key default true check (only_one),
  user_id uuid not null references auth.users(id) on delete cascade
);
alter table public.portal_owner enable row level security;
revoke all on public.portal_owner from anon, authenticated;

do $$
declare def text; addr text; uid uuid;
begin
  select pg_get_functiondef('public.is_tracker_admin()'::regprocedure) into def;
  addr := substring(def from '''([^'']+@[^'']+)''');
  if addr is null then raise exception 'portal_owner: no address found in is_tracker_admin(). Nothing changed.'; end if;
  select u.id into uid from auth.users u where lower(u.email) = lower(addr);
  if uid is null then raise exception 'portal_owner: the owner''s account was not found. Nothing changed.'; end if;
  insert into public.portal_owner (only_one, user_id) values (true, uid)
    on conflict (only_one) do update set user_id = excluded.user_id;
  raise notice 'portal_owner: set';
end $$;

create or replace function public.portal_owner_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select user_id from public.portal_owner where only_one
$$;
revoke all on function public.portal_owner_id() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Who owns each row (only added if missing; rows without one go to Amr)
-- ---------------------------------------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'deal_logs' and column_name = 'user_id') then
    alter table public.deal_logs add column user_id uuid references auth.users(id) on delete cascade default auth.uid();
    raise notice 'deal_logs: user_id added';
  end if;
  update public.deal_logs set user_id = public.portal_owner_id() where user_id is null;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'deal_followups' and column_name = 'user_id') then
    alter table public.deal_followups add column user_id uuid references auth.users(id) on delete cascade default auth.uid();
    raise notice 'deal_followups: user_id added';
  end if;
  update public.deal_followups set user_id = public.portal_owner_id() where user_id is null;
  -- the CRM saves with onConflict (user_id, tool)
  if not exists (
    select 1 from pg_index i join pg_class t on t.oid = i.indrelid
     where t.oid = 'public.deal_logs'::regclass and i.indisunique
       and (select array_agg(a.attname::text order by a.attname) from pg_attribute a where a.attrelid = t.oid and a.attnum = any(i.indkey)) = array['tool', 'user_id']
  ) then
    create unique index deal_logs_user_tool on public.deal_logs (user_id, tool);
    raise notice 'deal_logs: unique (user_id, tool) added';
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. The team salt and check
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.deal_team (
  only_one   boolean primary key default true check (only_one),
  salt       text not null,     -- base64, 16 bytes; every workspace is encrypted with PBKDF2(team passphrase, this salt)
  check_blob jsonb not null,    -- { v, kdf, salt, iv, ct } of {"team":"amrabdelgawad"}: opens only with the team key
  updated_at timestamptz not null default now(),
  set_by     uuid
);
alter table public.deal_team enable row level security;
revoke all on public.deal_team from anon, authenticated;

-- Anyone who may use Deal tools reads the salt and the check (not secret: useless without the passphrase)
create or replace function public.deal_team_get()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.portal_can('deals') then
    (select jsonb_build_object('salt', t.salt, 'check', t.check_blob, 'updated_at', t.updated_at) from public.deal_team t where t.only_one)
  end
$$;
revoke all on function public.deal_team_get() from public;
grant execute on function public.deal_team_get() to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Which rows each person may fetch
-- ---------------------------------------------------------------------------------------------------------------
-- Only Deal CRM workspaces ("workspace", or "workspace:<id>" for deals Amr took over). The calculators' own rows
-- (land, house) keep their own passphrases and are never part of this.
-- p_everyone false: only my own workspaces.
-- p_everyone true: everyone's, for Amr and managers with the code; an agent still gets only their own.
-- holder = who the row belongs to now; person = whose deals they were (differs after a turn-off moved them to Amr).
create or replace function public.deal_team_rows(p_everyone boolean default true)
returns table(holder uuid, person uuid, name text, active boolean, tool text, blob jsonb, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_team boolean := coalesce(public.is_tracker_admin(), false)
                    or (public.portal_role() = 'manager' and coalesce(auth.jwt() ->> 'aal', '') = 'aal2' and public.portal_can('deals'));
begin
  if v_me is null or not public.portal_can('deals') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select d.user_id,
         coalesce(nullif(substring(d.tool from '^[a-z]+:([0-9a-f-]{36})$'), '')::uuid, d.user_id),
         coalesce(m.name, case when d.user_id = public.portal_owner_id() then 'Amr' end, 'Someone'),
         coalesce(m.active, d.user_id = public.portal_owner_id()),
         d.tool, d.blob, d.updated_at
    from public.deal_logs d
    left join public.members m on m.user_id = coalesce(nullif(substring(d.tool from '^[a-z]+:([0-9a-f-]{36})$'), '')::uuid, d.user_id)
   where d.tool like 'workspace%' and (case when p_everyone and v_team then true else d.user_id = v_me end);
end $$;
revoke all on function public.deal_team_rows(boolean) from public;
grant execute on function public.deal_team_rows(boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Change the passphrase: every row in one transaction, never a mix
-- ---------------------------------------------------------------------------------------------------------------
-- p_rows: [{ "holder": uuid, "tool": text, "old_iv": text, "blob": {...} }], every row in scope, already re-encrypted
--   and checked in the browser. p_salt: the new team salt. p_check: the new check (Amr only; it sets the team key).
-- Scope (only Deal CRM workspaces, never the calculators' rows):
--   Amr: every workspace on the current team key, plus his own workspace (before the first team key, his own only).
--   Anyone else: their own workspaces, and their new key must be the team key (moving off a personal passphrase).
-- Workspaces still on someone's personal passphrase are outside Amr's scope (he can't open them); their owners move
-- them to the team key themselves, and until they do the database refuses their saves (see deal_logs_team_key).
create or replace function public.deal_rekey(p_rows jsonb, p_salt text, p_check jsonb default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_owner boolean := coalesce(public.is_tracker_admin(), false);
  v_team_salt text := (select salt from public.deal_team where only_one);
  r jsonb; n integer := 0; v_left integer; v_salt text; v_holder uuid;
begin
  if v_me is null or not public.portal_can('deals') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or p_salt is null or length(p_salt) < 16 then raise exception 'rekey: bad input' using errcode = '22023'; end if;
  if v_owner then
    if p_check is null or jsonb_typeof(p_check) <> 'object' or p_check ->> 'salt' is distinct from p_salt then raise exception 'rekey: the team check must use the new salt' using errcode = '22023'; end if;
  else
    if p_check is not null then raise exception 'Not allowed: only Amr sets the team passphrase' using errcode = '42501'; end if;
    if v_team_salt is null or p_salt <> v_team_salt then raise exception 'rekey: use the team passphrase' using errcode = '22023'; end if;
  end if;
  -- the new team key first, so the save guard below accepts the new rows (all one transaction)
  if v_owner then
    insert into public.deal_team (only_one, salt, check_blob, updated_at, set_by) values (true, p_salt, p_check, now(), v_me)
      on conflict (only_one) do update set salt = excluded.salt, check_blob = excluded.check_blob, updated_at = now(), set_by = v_me;
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    if (r -> 'blob' ->> 'salt') is distinct from p_salt or (r -> 'blob' ->> 'ct') is null or (r -> 'blob' ->> 'iv') is null then
      raise exception 'rekey: every row must be encrypted with the new key' using errcode = '22023';
    end if;
    v_holder := (r ->> 'holder')::uuid;
    if coalesce(r ->> 'tool', '') not like 'workspace%' then raise exception 'rekey: only Deal CRM workspaces' using errcode = '22023'; end if;
    select d.blob ->> 'salt' into v_salt from public.deal_logs d where d.user_id = v_holder and d.tool = r ->> 'tool';
    if not (case when v_owner then (v_holder = v_me and r ->> 'tool' = 'workspace') or v_salt is not distinct from v_team_salt
                 else v_holder = v_me end) then
      raise exception 'Not allowed: that workspace isn''t yours to change' using errcode = '42501';
    end if;
    update public.deal_logs d set blob = r -> 'blob', updated_at = now()
     where d.user_id = v_holder and d.tool = r ->> 'tool' and d.blob ->> 'iv' = r ->> 'old_iv';
    if not found then raise exception 'rekey: a row changed while you were working (%). Nothing was saved. Reload and try again.', r ->> 'tool' using errcode = '40001'; end if;
    n := n + 1;
  end loop;
  -- nothing in scope may be left on the old key
  select count(*) into v_left from public.deal_logs d
   where d.tool like 'workspace%' and d.blob ? 'ct' and (d.blob ->> 'salt') is distinct from p_salt
     and (case when v_owner then (d.user_id = v_me and d.tool = 'workspace') or (d.blob ->> 'salt') is not distinct from v_team_salt
               else d.user_id = v_me end);
  if v_left > 0 then raise exception 'rekey: % workspace(s) would be left on the old passphrase. Nothing was saved.', v_left using errcode = '22023'; end if;
  return n;
end $$;
revoke all on function public.deal_rekey(jsonb, text, jsonb) from public;
grant execute on function public.deal_rekey(jsonb, text, jsonb) to authenticated;

-- First team setup, when Amr has no deals yet: only the team salt and check
create or replace function public.deal_team_start(p_salt text, p_check jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.is_tracker_admin(), false) then raise exception 'Not allowed: only Amr sets the team passphrase' using errcode = '42501'; end if;
  if exists (select 1 from public.deal_team) then raise exception 'deal_team: already set. Change it from the CRM Settings.' using errcode = '22023'; end if;
  if exists (select 1 from public.deal_logs d where d.user_id = auth.uid() and d.tool = 'workspace' and d.blob ? 'ct' and (d.blob ->> 'salt') is distinct from p_salt) then
    raise exception 'deal_team: there are deals on another passphrase. Use Change passphrase instead.' using errcode = '22023';
  end if;
  if p_check ->> 'salt' is distinct from p_salt then raise exception 'deal_team: the check must use the salt' using errcode = '22023'; end if;
  insert into public.deal_team (only_one, salt, check_blob, set_by) values (true, p_salt, p_check, auth.uid());
end $$;
revoke all on function public.deal_team_start(text, jsonb) from public;
grant execute on function public.deal_team_start(text, jsonb) to authenticated;

-- Save guard: once there is a team key, a workspace can only be saved on it. A browser still holding an old key
-- (someone who had the CRM open while Amr changed the passphrase) is refused instead of writing a mix.
create or replace function public.deal_logs_team_key()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_salt text := (select salt from public.deal_team where only_one);
begin
  if new.tool like 'workspace%' and v_salt is not null and new.blob ? 'ct' and (new.blob ->> 'salt') is distinct from v_salt then
    raise exception 'This workspace is on an old passphrase. Lock the CRM and open it again with the team passphrase.' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function public.deal_logs_team_key() from public, anon, authenticated;
drop trigger if exists deal_logs_team_key on public.deal_logs;
create trigger deal_logs_team_key before insert or update of blob on public.deal_logs
  for each row execute function public.deal_logs_team_key();

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Turning someone off gives their deals to Amr (user_id and the row name change; the encrypted data doesn't)
-- ---------------------------------------------------------------------------------------------------------------
-- Their "workspace" row becomes Amr's "workspace:<their id>" (Amr already has his own "workspace"), and the same for
-- any other tool rows. Their follow-up dates move with them. Turning them back on doesn't move anything back.
create or replace function public.portal_deals_to_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.portal_owner_id();
begin
  if old.active is true and new.active is false and v_owner is not null and new.user_id <> v_owner then
    update public.deal_logs d set user_id = v_owner, tool = d.tool || ':' || new.user_id::text, updated_at = now()
     where d.user_id = new.user_id and d.tool !~ ':';
    update public.deal_followups f set user_id = v_owner where f.user_id = new.user_id;
  end if;
  return new;
end $$;
revoke all on function public.portal_deals_to_owner() from public, anon, authenticated;
drop trigger if exists members_deals_to_owner on public.members;
create trigger members_deals_to_owner after update of active on public.members
  for each row execute function public.portal_deals_to_owner();

-- ---------------------------------------------------------------------------------------------------------------
-- 7. This week's team board (effort only)
-- ---------------------------------------------------------------------------------------------------------------
-- Monday to Sunday, New York time (the team works US hours). Everyone on the team sees the same board, active
-- members only. Columns: calls logged (dials sent with end-of-shift briefs), lessons passed (lessons marked done),
-- drills sent (recordings and files sent, plus written drills submitted). Never hours, pay or deal money.
create or replace function public.portal_team_board()
returns table(user_id uuid, name text, calls integer, lessons integer, drills integer, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_start timestamptz := date_trunc('week', now() at time zone 'America/New_York') at time zone 'America/New_York';
  v_day date := (date_trunc('week', now() at time zone 'America/New_York'))::date;
begin
  if not (coalesce(public.is_tracker_admin(), false) or public.portal_role() in ('manager', 'agent')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select m.user_id, m.name,
    coalesce((select sum(s.dials)::integer from public.shifts s where s.user_id = m.user_id and not s.owner and s.shift_date >= v_day), 0),
    coalesce((select count(*)::integer from public.course_item_done d where d.user_id = m.user_id and d.done_at >= v_start), 0),
    coalesce((select count(*)::integer from public.hub_uploads u where u.user_id = m.user_id and u.created_at >= v_start), 0)
      + coalesce((select count(*)::integer from public.course_submissions c where c.user_id = m.user_id and c.status <> 'draft' and coalesce(c.last_submitted_at, c.submitted_at) >= v_start), 0),
    m.user_id = auth.uid()
  from public.members m
  where m.active
  order by 3 desc, 4 desc, 5 desc, 2;
end $$;
revoke all on function public.portal_team_board() from public;
grant execute on function public.portal_team_board() to authenticated;
