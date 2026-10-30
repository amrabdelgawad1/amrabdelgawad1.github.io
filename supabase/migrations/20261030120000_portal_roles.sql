-- Portal round 2: roles.
--
-- Everyone gets one role (owner, manager, agent; students come later in their own table) plus optional extras.
--   owner    Amr only: is_tracker_admin(). Never stored on members.
--   manager  agent keys + live, requests, team. Approves missed-shift requests. No money, no invite and access.
--   agent    deals, learn, course. Their own tracker is always on (not a key).
-- members.access stays as the list of EXTRAS. members.not_given lists role keys this person does NOT get,
-- so today's team keeps exactly what they had (decision 3): the backfill puts every agent key they lacked in not_given.
-- New invites get the full agent set (not_given defaults to empty).
--
-- One check everywhere: portal_can(key). has_access, learn_can_open, course_has_access and hub_can_send now call it,
-- so they can't disagree. Rules kept from today:
--   * money is owner only, whatever access says (decision 1)
--   * the authenticator (aal2) is needed for every key except live, requests and the learning and deal keys,
--     which have their own rules (courses never asked for it; Deal tools use deals_mfa in deal_access_status)
--   * a course other than Acquisitions needs learn as well
-- Also here:
--   * decide_shift_request: managers can approve too, never their own request
--   * deal_access_status: reads the role (edited in place, so the owner's address in it is never retyped)
--   * learn_progress: own rows only, nobody else, Amr included (decision 2). Amr and managers see progress through
--     portal_learner_progress(), which returns pass counts, never the saved data (scratch pad, drawings, notes).
--   * access_log: every change to someone's role or access, who made it and when. Written by a trigger only.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. members.role: reuse the existing column (it only allowed 'member'), in an order no row can fail
-- ---------------------------------------------------------------------------------------------------------------
do $$
declare c record;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'members' and column_name = 'role') then
    alter table public.members add column role text;
  end if;
  -- a) drop every check on role except the new one
  for c in
    select con.conname from pg_constraint con
     where con.conrelid = 'public.members'::regclass and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ~ '\mrole\M'
       -- the live rule that only allowed 'member' is ALSO named members_role_check: drop it unless it's already the new one
       and (con.conname <> 'members_role_check' or pg_get_constraintdef(con.oid) !~ 'manager')
  loop
    execute format('alter table public.members drop constraint %I', c.conname);
    raise notice 'members: dropped %', c.conname;
  end loop;
  -- b) old values become agent
  update public.members set role = 'agent' where role is null or role not in ('manager', 'agent');
  -- c) default and not null
  alter table public.members alter column role set default 'agent';
  alter table public.members alter column role set not null;
  -- d) the new rule
  if not exists (select 1 from pg_constraint where conrelid = 'public.members'::regclass and conname = 'members_role_check') then
    alter table public.members add constraint members_role_check check (role in ('manager', 'agent'));
  end if;
end $$;

-- The invite function (team-access, not in this repo) may still send role = 'member'. Turn that, or no role, into agent
-- before the rule is checked, so invites never fail.
create or replace function public.portal_role_default()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.role is null or new.role = 'member' then new.role := 'agent'; end if;
  return new;
end $$;
drop trigger if exists members_role_default on public.members;
create trigger members_role_default before insert or update of role on public.members
  for each row execute function public.portal_role_default();

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Role keys, and what a member row adds up to
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.portal_role_keys(p_role text)
returns text[] language sql immutable set search_path = '' as $$
  select case p_role
    when 'agent'   then array['course', 'deals', 'learn']
    when 'manager' then array['course', 'deals', 'learn', 'live', 'requests', 'team']
    else array[]::text[] end
$$;

-- Role keys minus what they weren't given, plus extras. Money never counts for a member.
create or replace function public.portal_keys_of(p_role text, p_access text[], p_not_given text[])
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array(
    select k from (
      select unnest(public.portal_role_keys(p_role)) as k
      except select unnest(coalesce(p_not_given, '{}'::text[]))
      union  select unnest(coalesce(p_access, '{}'::text[]))
    ) x where k is not null and k <> 'money' order by k
  ), '{}'::text[])
$$;

-- Keys that also need the authenticator code (aal2). Anything new needs it until said otherwise.
create or replace function public.portal_key_needs_code(p_key text)
returns boolean language sql immutable set search_path = '' as $$
  select p_key not in ('live', 'requests', 'learn', 'mkt', 'psy', 'course', 'deals')
$$;

-- 3. members.not_given: added once, with the backfill that keeps today's access exactly as it is
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'members' and column_name = 'not_given') then
    alter table public.members add column not_given text[] not null default '{}'::text[];
    update public.members m
       set not_given = coalesce(array(select k from unnest(public.portal_role_keys(m.role)) k
                                       where not (k = any(coalesce(m.access, '{}'::text[]))) order by k), '{}'::text[]);
    raise notice 'members: not_given added and filled for % rows', (select count(*) from public.members);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.members'::regclass and conname = 'members_not_given_check') then
    alter table public.members add constraint members_not_given_check
      check (not_given <@ array['course', 'deals', 'learn', 'live', 'requests', 'team']::text[]);
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Who am I, and can I
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.portal_role()
returns text language sql stable security definer set search_path = '' as $$
  select case when coalesce(public.is_tracker_admin(), false) then 'owner'
    else (select m.role from public.members m where m.user_id = auth.uid() and m.active) end
$$;

-- A member's check, without the owner shortcut (course_has_access keeps its own owner rule)
create or replace function public.portal_member_can(p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
     where m.user_id = auth.uid() and m.active
       and p_key = any(public.portal_keys_of(m.role, m.access, m.not_given))
       and (not public.portal_key_needs_code(p_key) or coalesce(auth.jwt() ->> 'aal', '') = 'aal2'))
$$;

create or replace function public.portal_can(p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.is_tracker_admin(), false) or public.portal_member_can(p_key)
$$;

-- Everything the pages need about the signed-in person, in one call:
--   role, keys (every key they have, even if it still needs the code), needs_code (keys waiting on the authenticator)
create or replace function public.portal_me()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case
    when coalesce(public.is_tracker_admin(), false) then jsonb_build_object('role', 'owner',
      'keys', to_jsonb(array['course', 'deals', 'learn', 'live', 'mkt', 'money', 'psy', 'requests', 'team']), 'needs_code', '[]'::jsonb)
    else coalesce((
      select jsonb_build_object('role', m.role, 'name', m.name,
        'keys', to_jsonb(k.keys),
        'needs_code', to_jsonb(coalesce(array(select x from unnest(k.keys) x
                         where public.portal_key_needs_code(x) and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'), '{}'::text[])))
        from public.members m, lateral (select public.portal_keys_of(m.role, m.access, m.not_given) as keys) k
       where m.user_id = auth.uid() and m.active), jsonb_build_object('role', null, 'keys', '[]'::jsonb, 'needs_code', '[]'::jsonb))
  end
$$;

-- Amr only: everyone on the team with their role and what it adds up to (Learning Hub counts, Invite and access)
create or replace function public.portal_people()
returns table(user_id uuid, name text, email text, active boolean, role text, access text[], not_given text[], keys text[])
language sql stable security definer set search_path = '' as $$
  select m.user_id, m.name, m.email, m.active, m.role, m.access, m.not_given, public.portal_keys_of(m.role, m.access, m.not_given)
    from public.members m
   where coalesce(public.is_tracker_admin(), false)
   order by m.active desc, m.name
$$;

revoke all on function public.portal_role() from public;
revoke all on function public.portal_member_can(text) from public;
revoke all on function public.portal_can(text) from public;
revoke all on function public.portal_me() from public;
revoke all on function public.portal_people() from public;
grant execute on function public.portal_role_keys(text), public.portal_keys_of(text, text[], text[]), public.portal_key_needs_code(text),
  public.portal_role(), public.portal_member_can(text), public.portal_can(text), public.portal_me(), public.portal_people() to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. The existing checks, rebuilt on portal_can (same answers for everyone on the team today)
-- ---------------------------------------------------------------------------------------------------------------
-- Used by the members, live_status, shift_requests and shifts policies. Same rule as before for members
-- (code needed except for live and requests); it now also counts the role, and is true for Amr.
create or replace function public.has_access(p_section text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.portal_can(p_section)
$$;

create or replace function public.learn_can_open(p_course text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.portal_can('learn') and public.portal_can(p_course)
$$;
revoke all on function public.learn_can_open(text) from public;
grant execute on function public.learn_can_open(text) to authenticated;

-- Acquisitions: Amr (with the authenticator, course_is_admin) or a member with the course key. No Learning Hub needed.
create or replace function public.course_has_access()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and (public.course_is_admin() or public.portal_member_can('course'))
$$;

create or replace function public.hub_can_send(p_course text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select case p_course
    when 'acq' then public.portal_can('course')
    when 'mkt' then public.learn_can_open('mkt')
    when 'psy' then public.learn_can_open('psy')
    else false end
$$;
revoke all on function public.hub_can_send(text) from public;
grant execute on function public.hub_can_send(text) to authenticated;

-- Missed-shift requests: Amr or a manager (with the authenticator code) decides; nobody but Amr decides their own.
-- Same body as the live function, with the two checks changed.
create or replace function public.decide_shift_request(p_id bigint, p_approve boolean, p_reason text default null::text)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare
  r public.shift_requests; v_shift bigint;
  v_owner boolean := coalesce(public.is_tracker_admin(), false);
begin
  -- managers also need the authenticator code: an approval adds a shift, which feeds pay (reviewer decision)
  if not (v_owner or (public.portal_role() = 'manager' and public.portal_can('requests')
                      and coalesce(auth.jwt() ->> 'aal', '') = 'aal2')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into r from public.shift_requests where id = p_id for update;
  if r.id is null then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if not v_owner and r.user_id = auth.uid() then raise exception 'Not allowed: your own request' using errcode = '42501'; end if;
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

-- Deal tools: count the role's deals key too. Edited in place from the live definition, so the owner's address in it
-- stays exactly as it is in the database and never appears in this repo.
do $$
declare def text; nxt text;
begin
  select pg_get_functiondef('public.deal_access_status()'::regprocedure) into def;
  if def like '%portal_keys_of%' then raise notice 'deal_access_status: already reads the role'; return; end if;
  nxt := regexp_replace(def, '''deals''\s*=\s*any\s*\(\s*m\.access\s*\)',
                        '''deals'' = any(public.portal_keys_of(m.role, m.access, m.not_given))', 'i');
  if nxt = def then raise exception 'deal_access_status: the access check was not where expected. Nothing changed. Send its definition to the builder.'; end if;
  execute nxt;
  raise notice 'deal_access_status: now reads the role';
exception when undefined_function then
  raise notice 'deal_access_status: not in this database, skipped';
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. learn_progress: own rows only, for everyone (the scratch pad and drawings are saved here)
-- ---------------------------------------------------------------------------------------------------------------
drop policy if exists "learn: own rows" on public.learn_progress;          -- created by hand, never in the repo; same as the four below
drop policy if exists "learn_progress own read" on public.learn_progress;
create policy "learn_progress own read" on public.learn_progress for select to authenticated
  using (user_id = auth.uid());

-- A number from saved text, 0 when it isn't one
create or replace function public.portal_num(p text)
returns numeric language sql immutable set search_path = '' as $$
  select case when p ~ '^\s*-?\d+(\.\d+)?\s*$' then p::numeric else 0 end
$$;
-- Progress for Amr and managers (managers need Team, so the authenticator): pass counts per course, never the saved data.
--   mkt2  passed = modules with a quiz best of 80 or more; sent = assignments marked done
--   psy   passed = modules whose exam is done or scored 16 of 20 or more; sent = 0
create or replace function public.portal_learner_progress()
returns table(user_id uuid, name text, course text, passed int, sent int, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_owner boolean := coalesce(public.is_tracker_admin(), false);
begin
  if not (v_owner or (public.portal_role() = 'manager' and public.portal_can('team'))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select lp.user_id, m.name, lp.course,
    case lp.course
      when 'mkt2' then (select count(*)::int from jsonb_each(case when jsonb_typeof(lp.data -> 'm') = 'object' then lp.data -> 'm' else '{}'::jsonb end) e
                         where jsonb_typeof(e.value -> 'quiz' -> 'best') = 'number' and (e.value -> 'quiz' ->> 'best')::numeric >= 80)
      when 'psy' then (select count(*)::int from (
                         select distinct coalesce(substring(k from '^(?:exam|best):(m\d+)$'), substring(k from '^done:(m\d+):exam$')) as mid
                           from jsonb_object_keys(case when jsonb_typeof(lp.data -> 'kv') = 'object' then lp.data -> 'kv' else '{}'::jsonb end) k) ids
                        where ids.mid is not null and (
                          (lp.data -> 'kv' ->> ('done:' || ids.mid || ':exam')) = '1'
                          or greatest(public.portal_num(lp.data -> 'kv' ->> ('exam:' || ids.mid)), public.portal_num(lp.data -> 'kv' ->> ('best:' || ids.mid))) >= 16))
      else 0 end,
    case lp.course
      when 'mkt2' then (select count(*)::int from jsonb_each(case when jsonb_typeof(lp.data -> 'm') = 'object' then lp.data -> 'm' else '{}'::jsonb end) e
                         where (e.value -> 'asg' ->> 'done') = 'true')
      else 0 end,
    lp.updated_at
  from public.learn_progress lp
  left join public.members m on m.user_id = lp.user_id
  where lp.course in ('mkt2', 'psy')
    and (v_owner or (m.active and m.user_id is not null));
end $$;

revoke all on function public.portal_learner_progress() from public;
grant execute on function public.portal_learner_progress(), public.portal_num(text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Access log: who changed whose role or access, and when. Amr reads it; nobody writes it except the trigger.
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.access_log (
  id     bigint generated always as identity primary key,
  at     timestamptz not null default now(),
  actor  uuid,                      -- who made the change; empty = the invite system (team-access) or SQL
  target uuid not null,             -- whose access changed
  change jsonb not null             -- { field: { "from": ..., "to": ... } } or { "added": {...} }
);
create index if not exists access_log_target_at on public.access_log (target, at desc);
alter table public.access_log enable row level security;
revoke all on public.access_log from anon, authenticated;
grant select on public.access_log to authenticated;
drop policy if exists "access_log owner reads" on public.access_log;
create policy "access_log owner reads" on public.access_log for select to authenticated
  using (coalesce(public.is_tracker_admin(), false));

create or replace function public.portal_log_access()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ch jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    ch := jsonb_build_object('added', jsonb_build_object('role', new.role, 'access', new.access, 'not_given', new.not_given, 'active', new.active));
  else
    if new.role is distinct from old.role then ch := ch || jsonb_build_object('role', jsonb_build_object('from', old.role, 'to', new.role)); end if;
    if new.access is distinct from old.access then ch := ch || jsonb_build_object('access', jsonb_build_object('from', old.access, 'to', new.access)); end if;
    if new.not_given is distinct from old.not_given then ch := ch || jsonb_build_object('not_given', jsonb_build_object('from', old.not_given, 'to', new.not_given)); end if;
    if new.active is distinct from old.active then ch := ch || jsonb_build_object('active', jsonb_build_object('from', old.active, 'to', new.active)); end if;
    if new.deals_until is distinct from old.deals_until then ch := ch || jsonb_build_object('deals_until', jsonb_build_object('from', old.deals_until, 'to', new.deals_until)); end if;
    if new.deals_mfa is distinct from old.deals_mfa then ch := ch || jsonb_build_object('deals_mfa', jsonb_build_object('from', old.deals_mfa, 'to', new.deals_mfa)); end if;
    if ch = '{}'::jsonb then return new; end if;
  end if;
  insert into public.access_log (actor, target, change) values (auth.uid(), new.user_id, ch);
  return new;
end $$;
revoke all on function public.portal_log_access() from public, anon, authenticated;

drop trigger if exists members_access_log on public.members;
create trigger members_access_log after insert or update on public.members
  for each row execute function public.portal_log_access();
