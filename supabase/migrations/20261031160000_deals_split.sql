-- Phase 2: the deals split (DATA-MODEL.md section 4).
-- Each real deal in the Deal CRM is mirrored into public.deals. The working fields are readable to the database
-- (kind, county, state, acreage, numbers, stage, follow-up, result), so it can count, sort, match and later drive the
-- Today screen, the pipeline board and commissions. Who and where exactly (the deal's name, the location as typed,
-- the seller's name, phone and email, and notes) is encrypted in the browser with the team passphrase (enc); the
-- database never sees it. The encrypted workspace in deal_logs stays the source the calculators read, so nothing is
-- removed by this step. Practice deals stay out.
-- Who sees which deals: Amr, and managers with the authenticator code, see everyone's; anyone else their own.
-- deal_events records every new deal, stage change and result, written only by the database.
-- Safe to run more than once.
create table if not exists public.deals (
  id text primary key,                               -- the CRM's own id for the deal
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('land', 'house')),
  state text,                                        -- two-letter code, upper case
  county text,                                       -- lower case, without "county"
  acreage numeric,
  value numeric,                                     -- after-repair or market value (ARV)
  max_offer numeric,                                 -- maximum allowable offer (MAO)
  paid numeric, sold numeric, profit numeric,        -- from the result, once there is one
  stage text not null default 'lead' check (stage in ('lead', 'talking', 'offer', 'contract', 'closed', 'passed')),
  follow_up date,
  result text check (result in ('sold', 'assigned', 'kept', 'passed', 'elsewhere')),
  closed_on date,
  created_at timestamptz not null default now(),
  enc jsonb not null,                                -- { v, kdf, salt, iv, ct }: name, loc, contact, notes
  updated_at timestamptz not null default now()
);
create index if not exists deals_owner on public.deals (owner);
create index if not exists deals_open on public.deals (stage, follow_up) where stage not in ('closed', 'passed');
alter table public.deals enable row level security;
revoke all on public.deals from anon, authenticated;
grant select, insert, update, delete on public.deals to authenticated;

drop policy if exists "deals read" on public.deals;
create policy "deals read" on public.deals for select to authenticated
  using (public.portal_can('deals') and (owner = auth.uid() or public.deals_team_viewer()));
drop policy if exists "deals add" on public.deals;
create policy "deals add" on public.deals for insert to authenticated
  with check (public.portal_can('deals') and owner = auth.uid());
drop policy if exists "deals change" on public.deals;
create policy "deals change" on public.deals for update to authenticated
  using (public.portal_can('deals') and (owner = auth.uid() or coalesce(public.is_tracker_admin(), false)))
  with check (public.portal_can('deals') and (owner = auth.uid() or coalesce(public.is_tracker_admin(), false)));
drop policy if exists "deals remove" on public.deals;
create policy "deals remove" on public.deals for delete to authenticated
  using (public.portal_can('deals') and (owner = auth.uid() or coalesce(public.is_tracker_admin(), false)));

-- Saved only on the team key; place tidied; a result moves the stage; the created date can't be rewritten
create or replace function public.deals_check()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_salt text := (select salt from public.deal_team where only_one);
begin
  if tg_op = 'INSERT' or new.enc is distinct from old.enc then
    if v_salt is null then raise exception 'Set the team passphrase in the Deal CRM first' using errcode = '22023'; end if;
    if not (new.enc ? 'ct' and new.enc ? 'iv') or (new.enc ->> 'salt') is distinct from v_salt then
      raise exception 'This deal isn''t encrypted with the team passphrase. Lock the CRM and open it again.' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  new.state := case when btrim(coalesce(new.state, '')) ~* '^[a-z]{2}$' then upper(btrim(new.state)) end;
  new.county := nullif(btrim(regexp_replace(lower(coalesce(new.county, '')), '\s+(county|parish)$', '')), '');
  if new.result in ('sold', 'assigned', 'kept') then new.stage := 'closed';
  elsif new.result in ('passed', 'elsewhere') then new.stage := 'passed'; end if;
  if new.stage in ('closed', 'passed') then new.follow_up := null; end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.deals_check() from public, anon, authenticated;
drop trigger if exists deals_check on public.deals;
create trigger deals_check before insert or update on public.deals for each row execute function public.deals_check();

-- Stage changes and results, for countdowns and reports. Only the database writes here.
create table if not exists public.deal_events (
  id bigserial primary key,
  deal_id text not null references public.deals(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null check (kind in ('created', 'stage', 'result')),
  from_value text, to_value text,
  by uuid default auth.uid()
);
create index if not exists deal_events_deal on public.deal_events (deal_id, at);
alter table public.deal_events enable row level security;
revoke all on public.deal_events from anon, authenticated;
grant select on public.deal_events to authenticated;
drop policy if exists "deal events read" on public.deal_events;
create policy "deal events read" on public.deal_events for select to authenticated
  using (exists (select 1 from public.deals x where x.id = deal_id));   -- the deals rules decide

create or replace function public.deals_log()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.deal_events (deal_id, kind, to_value) values (new.id, 'created', new.stage);
  else
    if new.stage is distinct from old.stage then
      insert into public.deal_events (deal_id, kind, from_value, to_value) values (new.id, 'stage', old.stage, new.stage);
    end if;
    if new.result is distinct from old.result then
      insert into public.deal_events (deal_id, kind, from_value, to_value) values (new.id, 'result', old.result, new.result);
    end if;
  end if;
  return null;
end $$;
revoke all on function public.deals_log() from public, anon, authenticated;
drop trigger if exists deals_log on public.deals;
create trigger deals_log after insert or update on public.deals for each row execute function public.deals_log();

-- Turning someone off gives their deal rows to Amr too (the buyers version, extended).
create or replace function public.portal_deals_to_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.portal_owner_id(); r record; v_name text; n int;
begin
  if old.active is true and new.active is false and v_owner is not null and new.user_id <> v_owner then
    for r in select d.tool from public.deal_logs d where d.user_id = new.user_id and d.tool !~ ':' loop
      v_name := r.tool || ':' || new.user_id::text; n := 1;
      while exists (select 1 from public.deal_logs x where x.user_id = v_owner and x.tool = v_name) loop
        n := n + 1; v_name := r.tool || ':' || new.user_id::text || ':' || n;
      end loop;
      update public.deal_logs d set user_id = v_owner, tool = v_name, updated_at = now()
       where d.user_id = new.user_id and d.tool = r.tool;
    end loop;
    update public.deal_followups f set user_id = v_owner where f.user_id = new.user_id;
    update public.buyers b set owner = v_owner where b.owner = new.user_id;
    update public.deals x set owner = v_owner where x.owner = new.user_id;
  end if;
  return new;
end $$;

-- Changing the team passphrase re-encrypts the deal rows in the same single step. Never a mix.
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
    -- a buyer (Phase 2): only Amr changes the team key, so only Amr re-encrypts buyers
    if r ? 'buyer' then
      if not v_owner then raise exception 'Not allowed: only Amr re-encrypts buyers' using errcode = '42501'; end if;
      if (r -> 'blob' ->> 'salt') is distinct from p_salt or (r -> 'blob' ->> 'ct') is null or (r -> 'blob' ->> 'iv') is null then
        raise exception 'rekey: every row must be encrypted with the new key' using errcode = '22023';
      end if;
      update public.buyers b set enc = r -> 'blob' where b.id = r ->> 'buyer' and b.enc ->> 'iv' = r ->> 'old_iv';
      if not found then raise exception 'rekey: a buyer changed while you were working. Nothing was saved. Reload and try again.' using errcode = '40001'; end if;
      n := n + 1;
      continue;
    end if;
    -- a deal row (Phase 2 deals split): the same rule as buyers
    if r ? 'deal' then
      if not v_owner then raise exception 'Not allowed: only Amr re-encrypts deals' using errcode = '42501'; end if;
      if (r -> 'blob' ->> 'salt') is distinct from p_salt or (r -> 'blob' ->> 'ct') is null or (r -> 'blob' ->> 'iv') is null then
        raise exception 'rekey: every row must be encrypted with the new key' using errcode = '22023';
      end if;
      update public.deals x set enc = r -> 'blob' where x.id = r ->> 'deal' and x.enc ->> 'iv' = r ->> 'old_iv';
      if not found then raise exception 'rekey: a deal changed while you were working. Nothing was saved. Reload and try again.' using errcode = '40001'; end if;
      n := n + 1;
      continue;
    end if;
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
  if v_owner and exists (select 1 from public.buyers b where (b.enc ->> 'salt') is distinct from p_salt) then
    raise exception 'rekey: % buyer(s) would be left on the old passphrase. Nothing was saved.',
      (select count(*) from public.buyers b where (b.enc ->> 'salt') is distinct from p_salt) using errcode = '22023';
  end if;
  if v_owner and exists (select 1 from public.deals x where (x.enc ->> 'salt') is distinct from p_salt) then
    raise exception 'rekey: % deal(s) would be left on the old passphrase. Nothing was saved.',
      (select count(*) from public.deals x where (x.enc ->> 'salt') is distinct from p_salt) using errcode = '22023';
  end if;
  return n;
end $$;
