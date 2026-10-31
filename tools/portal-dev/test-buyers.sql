-- Phase 2: buyers list and matching (runs after test-feedback.sql). Same people: Amr O, agents A (no Deal tools)
-- and N, manager M. Every check prints "ok" or stops with "FAIL".
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

set role authenticated;
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
insert into public.buyers (id, kinds, states, counties, price_min, price_max, enc) values
  ('b-n1', '{Land,boat}', '{oh,Ohio}', '{"Ross County"," polk "}', 20000, 80000, jsonb_build_object('v', 2, 'salt', :'ts', 'iv', 'i-n1', 'ct', 'buyer N1'));
select pg_temp.ok((select kinds = '{land}' and states = '{OH}' and counties @> '{ross,polk}' and cardinality(counties) = 2 from public.buyers where id = 'b-n1'), 'the buy box is tidied: kinds, states, counties');
select pg_temp.ok(pg_temp.err($$insert into public.buyers (id, enc) values ('b-x', '{"salt":"OTHER","iv":"i","ct":"c"}')$$) like '%team passphrase%', 'a buyer on another key is refused');
select pg_temp.ok(pg_temp.fails($$insert into public.buyers (id, owner, enc) values ('b-y', '00000000-0000-0000-0000-000000000007', jsonb_build_object('salt', current_setting('x.ts', true), 'iv', 'i', 'ct', 'c'))$$), 'can''t add a buyer for someone else');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal1');
insert into public.buyers (id, kinds, states, price_max, enc) values ('b-m1', '{house}', '{FL}', 300000, jsonb_build_object('v', 2, 'salt', :'ts', 'iv', 'i-m1', 'ct', 'buyer M1'));
select pg_temp.ok((select count(*) from public.buyers) = 1, 'a manager without the code sees only their own');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.buyers) = 2, 'with the code: everyone''s buyers');
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.buyers) = 1, 'a rep sees only their own');
update public.buyers set active = false where id = 'b-m1';
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal2');
select pg_temp.ok((select active from public.buyers where id = 'b-m1'), 'and can''t change someone else''s');
select pg_temp.as_user(:A::uuid, 'a@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.buyers) = 0 and pg_temp.fails($$insert into public.buyers (id, enc) values ('b-a', '{"salt":"x","iv":"i","ct":"c"}')$$), 'no Deal tools: nothing to read or add');

-- matching
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.buyers) = 2, 'Amr sees everyone''s buyers');
select pg_temp.ok((select fit from public.buyer_matches('land', 'OH', 'Ross County', 50000) where id = 'b-n1') = 'county', 'a land deal in Ross County, OH at $50,000 matches by county');
select pg_temp.ok((select count(*) from public.buyer_matches('land', 'OH', 'Athens', 50000) where id = 'b-n1') = 1, 'another Ohio county matches by state');
select pg_temp.ok((select count(*) from public.buyer_matches('land', 'OH', 'Ross', 95000)) = 0, 'over their price: no match');
select pg_temp.ok((select count(*) from public.buyer_matches('house', 'FL', 'Polk', 250000) where id = 'b-m1') = 1 and (select count(*) from public.buyer_matches('house', 'FL', 'Polk', 250000) where id = 'b-n1') = 0, 'houses match house buyers only');
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.buyer_matches('house', 'FL', 'Polk', 250000)) = 0, 'a rep matches only against their own buyers');

-- changing the team passphrase re-encrypts buyers in the same step
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
reset role;
select jsonb_agg(jsonb_build_object('holder', d.user_id, 'tool', d.tool, 'old_iv', d.blob ->> 'iv', 'blob', d.blob || jsonb_build_object('salt', 'TEAM3SALTTEAM300', 'iv', (d.blob ->> 'iv') || '-3')))::text as wrows
  from public.deal_logs d where d.tool like 'workspace%' and d.blob ? 'ct' and ((d.user_id = :O::uuid and d.tool = 'workspace') or d.blob ->> 'salt' = :'ts') \gset
select jsonb_agg(jsonb_build_object('buyer', b.id, 'old_iv', b.enc ->> 'iv', 'blob', b.enc || jsonb_build_object('salt', 'TEAM3SALTTEAM300', 'iv', (b.enc ->> 'iv') || '-3')))::text as brows from public.buyers b \gset
set role authenticated;
select pg_temp.ok(pg_temp.err(format($$select public.deal_rekey(%L::jsonb, 'TEAM3SALTTEAM300', '{"v":2,"salt":"TEAM3SALTTEAM300","iv":"c3","ct":"check 3"}')$$, :'wrows')) like '%buyer(s) would be left%', 'leaving the buyers on the old key is refused');
select pg_temp.ok(public.deal_team_get() ->> 'salt' = :'ts', 'and nothing changed');
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails(format($$select public.deal_rekey(%L::jsonb, %L)$$, :'brows', :'ts')), 'a rep can''t re-encrypt buyers');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select public.deal_rekey((:'wrows'::jsonb || :'brows'::jsonb), 'TEAM3SALTTEAM300', '{"v":2,"salt":"TEAM3SALTTEAM300","iv":"c3","ct":"check 3"}');
reset role;
select pg_temp.ok((select bool_and(enc ->> 'salt' = 'TEAM3SALTTEAM300') from public.buyers) and (select salt from public.deal_team) = 'TEAM3SALTTEAM300', 'workspaces and buyers move to the new key together');

-- turning someone off gives their buyers to Amr
update public.members set active = false where user_id = :N;
select pg_temp.ok((select owner from public.buyers where id = 'b-n1') = :O::uuid and (select enc ->> 'ct' from public.buyers where id = 'b-n1') = 'buyer N1', 'turning someone off gives their buyers to Amr, unchanged');
select pg_temp.ok((select count(*) from public.deal_logs where user_id = :O::uuid and tool = 'workspace:' || :N || ':2') = 1, 'turning the same person off a second time keeps both handed-over workspaces');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
set role authenticated;
select pg_temp.ok((select count(*) from public.deal_team_rows(true) where tool like 'workspace:%' and person = :N::uuid) = 2, 'both still show as theirs in the team view');
reset role;
update public.members set active = true where user_id = :N;
