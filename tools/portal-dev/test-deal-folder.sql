-- Phase 2: the deal folder (runs after test-notifications.sql). Every check prints "ok" or stops with "FAIL".
\set ON_ERROR_STOP on
set client_min_messages = notice;
create or replace function pg_temp.as_user(p_uid uuid, p_email text, p_aal text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'email', p_email, 'aal', p_aal, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.ok(p boolean, p_label text) returns void language plpgsql as $$
begin if p is not true then raise exception 'FAIL: %', p_label; end if; raise notice 'ok   %', p_label; end $$;
create or replace function pg_temp.fails(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;
create or replace function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return ''; exception when others then return sqlerrm; end $$;
\set O '''00000000-0000-0000-0000-00000000000a'''
\set A '''00000000-0000-0000-0000-000000000001'''
\set N '''00000000-0000-0000-0000-000000000006'''
\set M '''00000000-0000-0000-0000-000000000007'''
select salt as ts from public.deal_team \gset
select set_config('x.ts', :'ts', false);

set role authenticated;
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
insert into public.deals (id, kind, state, stage, enc) values ('d-f1', 'land', 'OH', 'contract', jsonb_build_object('v', 2, 'salt', :'ts', 'iv', 'i-f1', 'ct', 'x'));
-- upload: storage object in the deal's folder, then its row
insert into storage.objects (bucket_id, name) values ('deal-files', 'd-f1/11111111-1111-1111-1111-111111111111');
insert into public.deal_files (deal_id, kind, path, size_bytes, enc) values ('d-f1', 'contract', 'd-f1/11111111-1111-1111-1111-111111111111', 2048, jsonb_build_object('v', 2, 'salt', :'ts', 'iv', 'f-1', 'ct', 'SELLER NAME CONTRACT.pdf'));
select pg_temp.ok((select owner = :N::uuid and kind = 'contract' from public.deal_files where deal_id = 'd-f1'), 'a rep adds a contract to their deal''s folder');
select pg_temp.ok(pg_temp.err($$insert into public.deal_files (deal_id, kind, path, size_bytes, enc) values ('d-f1', 'comps', 'd-f1/22222222-2222-2222-2222-222222222222', 10, '{"salt":"OTHER","iv":"i","ct":"c"}')$$) like '%team passphrase%', 'a file not on the team key is refused');
select pg_temp.ok(pg_temp.err($$insert into public.deal_files (deal_id, kind, path, size_bytes, enc) values ('d-f1', 'comps', 'other-deal/22222222-2222-2222-2222-222222222222', 10, jsonb_build_object('salt', current_setting('x.ts'), 'iv', 'i', 'ct', 'c'))$$) like '%its deal''s folder%', 'a file must sit in its own deal''s folder');
select pg_temp.ok(pg_temp.fails($$insert into public.deal_files (deal_id, kind, path, size_bytes, enc) values ('d-f1', 'comps', 'd-f1/33333333-3333-3333-3333-333333333333', 20000000, jsonb_build_object('salt', current_setting('x.ts'), 'iv', 'i', 'ct', 'c'))$$), 'nothing over 10 MB');
insert into public.deal_checklist (deal_id, item, done_at) values ('d-f1', 'title_search', '2001-01-01'), ('d-f1', 'back_taxes', default);
select pg_temp.ok((select done_at > now() - interval '1 minute' and done_by = :N::uuid from public.deal_checklist where deal_id = 'd-f1' and item = 'title_search'), 'a tick records who and the real time, whatever the page sends');
select pg_temp.ok((select count(*) from public.deal_checklist where deal_id = 'd-f1') = 2, 'the rep ticks two checklist items');
select pg_temp.ok(pg_temp.fails($$insert into public.deal_checklist (deal_id, item) values ('d-f1', 'made_up')$$), 'only real checklist items');
delete from public.deal_checklist where deal_id = 'd-f1' and item = 'back_taxes';
select pg_temp.ok((select count(*) from public.deal_checklist where deal_id = 'd-f1') = 1, 'and can untick one');

-- other people
select pg_temp.as_user(:A::uuid, 'a@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.deal_files) = 0 and (select count(*) from public.deal_checklist) = 0, 'no Deal tools: sees nothing');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.deal_files) = 0 and (select count(*) from storage.objects where bucket_id = 'deal-files') = 0, 'a manager without the code sees no files');
select pg_temp.ok(pg_temp.fails($$insert into storage.objects (bucket_id, name) values ('deal-files', 'd-f1/44444444-4444-4444-4444-444444444444')$$), 'and can''t upload into someone else''s deal');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.deal_files) = 1 and (select count(*) from public.deal_checklist) = 1 and (select count(*) from storage.objects where bucket_id = 'deal-files') = 1, 'with the code: sees the folder and can download the file');
select pg_temp.ok(pg_temp.fails($$insert into public.deal_checklist (deal_id, item) values ('d-f1', 'survey')$$), 'but can''t tick on someone else''s deal');
delete from public.deal_files where deal_id = 'd-f1';
select pg_temp.ok((select count(*) from public.deal_files where deal_id = 'd-f1') = 1, 'or remove their files');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.deal_files) = 1 and (select (enc ->> 'ct') = 'SELLER NAME CONTRACT.pdf' from public.deal_files limit 1), 'Amr sees it too (the name is ciphertext in real use)');

-- the passphrase change takes file names along, in the same step
reset role;
select jsonb_agg(jsonb_build_object('holder', d.user_id, 'tool', d.tool, 'old_iv', d.blob ->> 'iv', 'blob', d.blob || jsonb_build_object('salt', 'TEAM5SALTTEAM500', 'iv', (d.blob ->> 'iv') || '-5')))::text as wrows
  from public.deal_logs d where d.tool like 'workspace%' and d.blob ? 'ct' and ((d.user_id = :O::uuid and d.tool = 'workspace') or d.blob ->> 'salt' = :'ts') \gset
select coalesce(jsonb_agg(jsonb_build_object('buyer', b.id, 'old_iv', b.enc ->> 'iv', 'blob', b.enc || jsonb_build_object('salt', 'TEAM5SALTTEAM500', 'iv', (b.enc ->> 'iv') || '-5'))), '[]')::text as brows from public.buyers b \gset
select coalesce(jsonb_agg(jsonb_build_object('deal', x.id, 'old_iv', x.enc ->> 'iv', 'blob', x.enc || jsonb_build_object('salt', 'TEAM5SALTTEAM500', 'iv', (x.enc ->> 'iv') || '-5'))), '[]')::text as drows from public.deals x \gset
select coalesce(jsonb_agg(jsonb_build_object('file', f.id, 'old_iv', f.enc ->> 'iv', 'blob', f.enc || jsonb_build_object('salt', 'TEAM5SALTTEAM500', 'iv', (f.enc ->> 'iv') || '-5'))), '[]')::text as frows from public.deal_files f \gset
set role authenticated;
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok(pg_temp.err(format($$select public.deal_rekey(%L::jsonb, 'TEAM5SALTTEAM500', '{"v":2,"salt":"TEAM5SALTTEAM500","iv":"c5","ct":"check 5"}')$$, (:'wrows'::jsonb || :'brows'::jsonb || :'drows'::jsonb)::text)) like '%file(s) would be left%', 'leaving file names on the old key is refused');
select public.deal_rekey((:'wrows'::jsonb || :'brows'::jsonb || :'drows'::jsonb || :'frows'::jsonb), 'TEAM5SALTTEAM500', '{"v":2,"salt":"TEAM5SALTTEAM500","iv":"c5","ct":"check 5"}');
select pg_temp.ok((select bool_and(enc ->> 'salt' = 'TEAM5SALTTEAM500') from public.deal_files), 'file names move to the new key with everything else');

-- removing: the rep removes their file; deleting the deal clears its folder rows
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
-- an object left by a failed upload (no row) is still visible to the owner, so it can be cleaned up
insert into storage.objects (bucket_id, name) values ('deal-files', 'd-f1/55555555-5555-5555-5555-555555555555');
delete from public.deal_files where deal_id = 'd-f1';
delete from storage.objects where bucket_id = 'deal-files' and name like 'd-f1/%';
reset role;
select pg_temp.ok((select count(*) from public.deal_files where deal_id = 'd-f1') = 0 and (select count(*) from storage.objects where bucket_id = 'deal-files') = 0, 'the owner removes the file and its stored copy, and a stray copy (counted with full access)');
set role authenticated;
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
delete from public.deals where id = 'd-f1';
reset role;
select pg_temp.ok((select count(*) from public.deal_checklist where deal_id = 'd-f1') = 0, 'deleting the deal clears its checklist');
set role anon;
select set_config('request.jwt.claims', '{}', false);
select pg_temp.ok(pg_temp.fails('select count(*) from public.deal_files') and pg_temp.fails('select count(*) from public.deal_checklist'), 'not signed in: nothing');
reset role;
