-- Phase 2: the deal folder. Each deal keeps its files (contract, title documents, comps, photos, inspection report)
-- and a due diligence checklist.
-- Files: encrypted in the browser with the team passphrase before upload (content and file name), so storage never
-- holds a readable contract. Readable to the database: which deal, what kind, size and when. Stored in the private
-- bucket deal-files as <deal id>/<random id>.
-- Checklist: one row per ticked item, readable (it says nothing about the seller), so progress can show without
-- unlocking the CRM.
-- Who: whoever may see the deal (its owner; Amr; managers with the authenticator code) may see its folder. Only the
-- deal's owner, or Amr, adds, removes or ticks. Safe to run more than once.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deal-files', 'deal-files', false, 10485760, array['application/octet-stream'])
on conflict (id) do nothing;

-- Can this person change this deal's folder? (its owner, or Amr; Deal tools on)
create or replace function public.deal_folder_can_write(p_deal text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.portal_can('deals'), false) and exists (
    select 1 from public.deals x where x.id = p_deal and (x.owner = auth.uid() or coalesce(public.is_tracker_admin(), false)))
$$;
revoke all on function public.deal_folder_can_write(text) from public, anon;
grant execute on function public.deal_folder_can_write(text) to authenticated;

create table if not exists public.deal_files (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null references public.deals(id) on delete cascade,
  owner uuid not null references auth.users(id) on delete cascade,       -- the deal's owner (set by the database)
  kind text not null check (kind in ('contract', 'title', 'comps', 'photo', 'inspection', 'other')),
  path text not null unique,                                               -- <deal id>/<random id> in deal-files
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  enc jsonb not null,                                                      -- { v, kdf, salt, iv, ct }: file name, type, content iv
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade
);
create index if not exists deal_files_deal on public.deal_files (deal_id, created_at);
alter table public.deal_files enable row level security;
revoke all on public.deal_files from anon, authenticated;
grant select, insert, delete on public.deal_files to authenticated;
drop policy if exists "deal files read" on public.deal_files;
create policy "deal files read" on public.deal_files for select to authenticated
  using (public.portal_can('deals') and exists (select 1 from public.deals x where x.id = deal_id));   -- the deals rules decide
drop policy if exists "deal files add" on public.deal_files;
create policy "deal files add" on public.deal_files for insert to authenticated
  with check (created_by = auth.uid() and public.deal_folder_can_write(deal_id));
drop policy if exists "deal files remove" on public.deal_files;
create policy "deal files remove" on public.deal_files for delete to authenticated
  using (public.deal_folder_can_write(deal_id));

create or replace function public.deal_files_check()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_salt text := (select salt from public.deal_team where only_one);
begin
  new.owner := (select x.owner from public.deals x where x.id = new.deal_id);
  if new.path is distinct from new.deal_id || '/' || split_part(new.path, '/', 2) or split_part(new.path, '/', 2) !~ '^[0-9a-f-]{36}$' then
    raise exception 'The file must be saved in its deal''s folder' using errcode = '22023';
  end if;
  if v_salt is null or not (new.enc ? 'ct' and new.enc ? 'iv') or (new.enc ->> 'salt') is distinct from v_salt then
    raise exception 'This file isn''t encrypted with the team passphrase. Lock the CRM and open it again.' using errcode = '22023';
  end if;
  new.created_at := now();
  return new;
end $$;
revoke all on function public.deal_files_check() from public, anon, authenticated;
drop trigger if exists deal_files_check on public.deal_files;
create trigger deal_files_check before insert on public.deal_files for each row execute function public.deal_files_check();

-- Storage: read a file when its deal_files row is visible; upload into a deal's folder you may change; remove the same
drop policy if exists deal_files_read on storage.objects;
create policy deal_files_read on storage.objects for select to authenticated
  using (bucket_id = 'deal-files' and exists (select 1 from public.deal_files f where f.path = name));
drop policy if exists deal_files_write on storage.objects;
create policy deal_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'deal-files' and public.deal_folder_can_write((storage.foldername(name))[1]));
drop policy if exists deal_files_delete on storage.objects;
create policy deal_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'deal-files' and public.deal_folder_can_write((storage.foldername(name))[1]));

-- The due diligence checklist: one row per ticked item
create table if not exists public.deal_checklist (
  deal_id text not null references public.deals(id) on delete cascade,
  item text not null check (item in ('title_search', 'back_taxes', 'liens', 'survey', 'access', 'zoning', 'utilities', 'flood',
                                     'comps', 'buyer', 'inspection', 'repairs', 'occupancy')),
  done_at timestamptz not null default now(),
  done_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (deal_id, item)
);
alter table public.deal_checklist enable row level security;
revoke all on public.deal_checklist from anon, authenticated;
grant select, insert, delete on public.deal_checklist to authenticated;
drop policy if exists "deal checklist read" on public.deal_checklist;
create policy "deal checklist read" on public.deal_checklist for select to authenticated
  using (public.portal_can('deals') and exists (select 1 from public.deals x where x.id = deal_id));
drop policy if exists "deal checklist tick" on public.deal_checklist;
create policy "deal checklist tick" on public.deal_checklist for insert to authenticated
  with check (done_by = auth.uid() and public.deal_folder_can_write(deal_id));
drop policy if exists "deal checklist untick" on public.deal_checklist;
create policy "deal checklist untick" on public.deal_checklist for delete to authenticated
  using (public.deal_folder_can_write(deal_id));

-- Changing the team passphrase re-encrypts each file's name and content key in the same single step as workspaces,
-- buyers and deals (deal_rekey, extended). File contents stay as they are: their key lives inside that metadata.
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
    -- a deal folder file's name and content key (Phase 2 deal folder): the same rule
    if r ? 'file' then
      if not v_owner then raise exception 'Not allowed: only Amr re-encrypts the deal folders' using errcode = '42501'; end if;
      if (r -> 'blob' ->> 'salt') is distinct from p_salt or (r -> 'blob' ->> 'ct') is null or (r -> 'blob' ->> 'iv') is null then
        raise exception 'rekey: every row must be encrypted with the new key' using errcode = '22023';
      end if;
      update public.deal_files f set enc = r -> 'blob' where f.id = (r ->> 'file')::uuid and f.enc ->> 'iv' = r ->> 'old_iv';
      if not found then raise exception 'rekey: a file changed while you were working. Nothing was saved. Reload and try again.' using errcode = '40001'; end if;
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
  if v_owner and exists (select 1 from public.deal_files f where (f.enc ->> 'salt') is distinct from p_salt) then
    raise exception 'rekey: % file(s) would be left on the old passphrase. Nothing was saved.',
      (select count(*) from public.deal_files f where (f.enc ->> 'salt') is distinct from p_salt) using errcode = '22023';
  end if;
  return n;
end $$;
revoke all on function public.deal_rekey(jsonb, text, jsonb) from public;
grant execute on function public.deal_rekey(jsonb, text, jsonb) to authenticated;
