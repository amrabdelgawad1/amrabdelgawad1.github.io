-- Phase 2: the buyers list and deal matching.
-- Each cash buyer's buy box is readable to the database (what they buy, where, price range), so a deal can be
-- matched against everyone's buyers. Who they are (name, phone, email, notes) is encrypted in the Deal CRM with the
-- team passphrase before it's saved (enc), like the deals themselves; the database never sees it.
-- Who sees which buyers: Amr, and managers with the authenticator code, see everyone's; anyone else their own.
-- Everyone with Deal tools adds and edits their own; Amr can edit any. Turning someone off gives their buyers to Amr.
-- Safe to run more than once.
create table if not exists public.buyers (
  id text primary key,                               -- the CRM's own id for the buyer
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kinds text[] not null default '{}',                -- land, house; empty = any
  states text[] not null default '{}',               -- two-letter codes, upper case; empty = any
  counties text[] not null default '{}',             -- lower case, without "county"; empty = any
  price_min numeric, price_max numeric,              -- null = no limit
  active boolean not null default true,
  enc jsonb not null,                                -- { v, kdf, salt, iv, ct }: name, phone, email, notes
  updated_at timestamptz not null default now()
);
create index if not exists buyers_owner on public.buyers (owner);
alter table public.buyers enable row level security;
revoke all on public.buyers from anon, authenticated;
grant select, insert, update, delete on public.buyers to authenticated;

-- Amr, or a manager with the authenticator code and Deal tools (the same rule as the team's deals in round 7)
create or replace function public.deals_team_viewer()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.is_tracker_admin(), false)
      or (public.portal_role() = 'manager' and coalesce(auth.jwt() ->> 'aal', '') = 'aal2' and public.portal_can('deals'))
$$;
revoke all on function public.deals_team_viewer() from public, anon;
grant execute on function public.deals_team_viewer() to authenticated;

drop policy if exists "buyers read" on public.buyers;
create policy "buyers read" on public.buyers for select to authenticated
  using (public.portal_can('deals') and (owner = auth.uid() or public.deals_team_viewer()));
drop policy if exists "buyers add" on public.buyers;
create policy "buyers add" on public.buyers for insert to authenticated
  with check (public.portal_can('deals') and owner = auth.uid());
drop policy if exists "buyers change" on public.buyers;
create policy "buyers change" on public.buyers for update to authenticated
  using (public.portal_can('deals') and (owner = auth.uid() or coalesce(public.is_tracker_admin(), false)))
  with check (public.portal_can('deals') and (owner = auth.uid() or coalesce(public.is_tracker_admin(), false)));
drop policy if exists "buyers remove" on public.buyers;
create policy "buyers remove" on public.buyers for delete to authenticated
  using (public.portal_can('deals') and (owner = auth.uid() or coalesce(public.is_tracker_admin(), false)));

-- Saved only on the team key, and the buy box kept tidy
create or replace function public.buyers_check()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_salt text := (select salt from public.deal_team where only_one);
begin
  if tg_op = 'INSERT' or new.enc is distinct from old.enc then
    if v_salt is null then raise exception 'Set the team passphrase in the Deal CRM first' using errcode = '22023'; end if;
    if not (new.enc ? 'ct' and new.enc ? 'iv') or (new.enc ->> 'salt') is distinct from v_salt then
      raise exception 'This buyer isn''t encrypted with the team passphrase. Lock the CRM and open it again.' using errcode = '22023';
    end if;
  end if;
  new.kinds := coalesce((select array_agg(distinct lower(btrim(k))) from unnest(new.kinds) k where lower(btrim(k)) in ('land', 'house')), '{}');
  new.states := coalesce((select array_agg(distinct upper(btrim(s))) from unnest(new.states) s where btrim(s) ~* '^[a-z]{2}$'), '{}');
  new.counties := coalesce((select array_agg(distinct x) from (select btrim(regexp_replace(lower(c), '\s+(county|parish)$', '')) x from unnest(new.counties) c) y where x <> ''), '{}');
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.buyers_check() from public, anon, authenticated;
drop trigger if exists buyers_check on public.buyers;
create trigger buyers_check before insert or update on public.buyers for each row execute function public.buyers_check();

-- Which buyers fit a deal: kind, place (county or state) and price. Runs with the caller's own rules (RLS), so
-- each person matches against the buyers they may see.
create or replace function public.buyer_matches(p_kind text, p_state text, p_county text, p_price numeric)
returns table(id text, owner uuid, kinds text[], states text[], counties text[], price_min numeric, price_max numeric, enc jsonb, fit text)
language sql stable set search_path = '' as $$
  select b.id, b.owner, b.kinds, b.states, b.counties, b.price_min, b.price_max, b.enc,
         case when cardinality(b.counties) > 0 and btrim(regexp_replace(lower(coalesce(p_county, '')), '\s+(county|parish)$', '')) = any(b.counties) then 'county'
              when cardinality(b.states) > 0 and upper(coalesce(p_state, '')) = any(b.states) then 'state'
              else 'anywhere' end
    from public.buyers b
   where b.active
     and (cardinality(b.kinds) = 0 or lower(coalesce(p_kind, '')) = any(b.kinds))
     and (p_price is null or ((b.price_min is null or p_price >= b.price_min) and (b.price_max is null or p_price <= b.price_max)))
     and ((cardinality(b.counties) = 0 and cardinality(b.states) = 0)
          or btrim(regexp_replace(lower(coalesce(p_county, '')), '\s+(county|parish)$', '')) = any(b.counties)
          or upper(coalesce(p_state, '')) = any(b.states))
   order by 9, b.updated_at desc
   limit 50
$$;
revoke all on function public.buyer_matches(text, text, text, numeric) from public, anon;
grant execute on function public.buyer_matches(text, text, text, numeric) to authenticated;

-- Turning someone off gives their buyers to Amr, next to their deals (round 7's trigger function, extended).
-- Also fixes turning the same person off a second time: Amr already holds "workspace:<their id>" from the first
-- time, so the new row becomes "workspace:<their id>:2" (then :3, ...) instead of failing on the duplicate name.
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
  end if;
  return new;
end $$;

-- Changing the team passphrase (round 7) now re-encrypts the buyers too, in the same single step. Never a mix.
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
  return n;
end $$;
revoke all on function public.deal_rekey(jsonb, text, jsonb) from public;
grant execute on function public.deal_rekey(jsonb, text, jsonb) to authenticated;

-- Who a handed-over workspace belonged to: "workspace:<id>" or, after a second turn-off, "workspace:<id>:<n>".
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
         coalesce(nullif(substring(d.tool from '^[a-z]+:([0-9a-f-]{36})(?::[0-9]+)?$'), '')::uuid, d.user_id),
         coalesce(m.name, case when d.user_id = public.portal_owner_id() then 'Amr' end, 'Someone'),
         coalesce(m.active, d.user_id = public.portal_owner_id()),
         d.tool, d.blob, d.updated_at
    from public.deal_logs d
    left join public.members m on m.user_id = coalesce(nullif(substring(d.tool from '^[a-z]+:([0-9a-f-]{36})(?::[0-9]+)?$'), '')::uuid, d.user_id)
   where d.tool like 'workspace%' and (case when p_everyone and v_team then true else d.user_id = v_me end);
end $$;
revoke all on function public.deal_team_rows(boolean) from public;
grant execute on function public.deal_team_rows(boolean) to authenticated;
