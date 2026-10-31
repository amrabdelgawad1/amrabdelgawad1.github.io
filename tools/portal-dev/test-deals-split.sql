-- Phase 2: the deals split (runs after test-buyers.sql). Same people: Amr O, agents A (no Deal tools) and N,
-- manager M. Every check prints "ok" or stops with "FAIL".
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
-- a rep saves a deal: readable fields tidied, sensitive fields only as ciphertext
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
insert into public.deals (id, kind, state, county, value, max_offer, stage, follow_up, enc) values
  ('d-n1', 'land', 'oh', 'Ross County', 60000, 18000, 'lead', current_date + 2, jsonb_build_object('v', 2, 'salt', :'ts', 'iv', 'i-n1', 'ct', 'deal N1'));
select pg_temp.ok((select state = 'OH' and county = 'ross' from public.deals where id = 'd-n1'), 'state and county are tidied');
select pg_temp.ok((select count(*) from public.deal_events where deal_id = 'd-n1' and kind = 'created') = 1, 'a new deal is recorded in deal_events');
select pg_temp.ok(pg_temp.err($$insert into public.deals (id, kind, enc) values ('d-x', 'land', '{"salt":"OTHER","iv":"i","ct":"c"}')$$) like '%team passphrase%', 'a deal on another key is refused');
select pg_temp.ok(pg_temp.fails($$insert into public.deals (id, kind, enc) values ('d-z', 'boat', jsonb_build_object('salt', current_setting('x.ts'), 'iv', 'i', 'ct', 'c'))$$), 'only land or house');
select pg_temp.ok(pg_temp.fails($$insert into public.deals (id, kind, stage, enc) values ('d-z', 'land', 'maybe', jsonb_build_object('salt', current_setting('x.ts'), 'iv', 'i', 'ct', 'c'))$$), 'only the CRM''s stages');
select pg_temp.ok(pg_temp.fails($$insert into public.deals (id, owner, kind, enc) values ('d-y', '00000000-0000-0000-0000-000000000007', 'land', jsonb_build_object('salt', current_setting('x.ts'), 'iv', 'i', 'ct', 'c'))$$), 'can''t add a deal for someone else');
select pg_temp.ok(pg_temp.fails($$insert into public.deal_events (deal_id, kind) values ('d-n1', 'stage')$$), 'nobody writes deal_events by hand');

-- stage changes and results
update public.deals set stage = 'offer' where id = 'd-n1';
select pg_temp.ok((select count(*) from public.deal_events where deal_id = 'd-n1' and kind = 'stage' and from_value = 'lead' and to_value = 'offer') = 1, 'a stage change is recorded');
update public.deals set result = 'assigned', paid = 15000, sold = 24000, profit = 9000, closed_on = current_date where id = 'd-n1';
select pg_temp.ok((select stage = 'closed' and follow_up is null from public.deals where id = 'd-n1'), 'a sale result closes the deal and clears the follow-up');
select pg_temp.ok((select count(*) from public.deal_events where deal_id = 'd-n1' and kind = 'result' and to_value = 'assigned') = 1, 'the result is recorded');
select pg_temp.ok(pg_temp.fails($$update public.deals set owner = '00000000-0000-0000-0000-000000000007' where id = 'd-n1'$$), 'a rep can''t hand a deal to someone else');

-- who sees what
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal1');
insert into public.deals (id, kind, state, county, stage, enc) values ('d-m1', 'house', 'FL', 'Polk', 'talking', jsonb_build_object('v', 2, 'salt', :'ts', 'iv', 'i-m1', 'ct', 'deal M1'));
select pg_temp.ok((select count(*) from public.deals) = 1, 'a manager without the code sees only their own');
select pg_temp.ok((select count(*) from public.deal_events) = 1, 'and only their own deal history');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.deals) = 2, 'with the code: everyone''s deals');
update public.deals set stage = 'lead' where id = 'd-n1';
select pg_temp.ok((select stage from public.deals where id = 'd-n1') = 'closed', 'but can''t change someone else''s');
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.deals) = 1 and (select count(*) from public.deal_events where deal_id = 'd-m1') = 0, 'a rep sees only their own deals and history');
select pg_temp.as_user(:A::uuid, 'a@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.deals) = 0 and pg_temp.fails($$insert into public.deals (id, kind, enc) values ('d-a', 'land', '{"salt":"x","iv":"i","ct":"c"}')$$), 'no Deal tools: nothing to read or add');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.deals) = 2 and (select count(*) from public.deal_events) >= 4, 'Amr sees every deal and its history');

-- changing the team passphrase re-encrypts deals in the same step
reset role;
select jsonb_agg(jsonb_build_object('holder', d.user_id, 'tool', d.tool, 'old_iv', d.blob ->> 'iv', 'blob', d.blob || jsonb_build_object('salt', 'TEAM4SALTTEAM400', 'iv', (d.blob ->> 'iv') || '-4')))::text as wrows
  from public.deal_logs d where d.tool like 'workspace%' and d.blob ? 'ct' and ((d.user_id = :O::uuid and d.tool = 'workspace') or d.blob ->> 'salt' = :'ts') \gset
select jsonb_agg(jsonb_build_object('buyer', b.id, 'old_iv', b.enc ->> 'iv', 'blob', b.enc || jsonb_build_object('salt', 'TEAM4SALTTEAM400', 'iv', (b.enc ->> 'iv') || '-4')))::text as brows from public.buyers b \gset
select jsonb_agg(jsonb_build_object('deal', x.id, 'old_iv', x.enc ->> 'iv', 'blob', x.enc || jsonb_build_object('salt', 'TEAM4SALTTEAM400', 'iv', (x.enc ->> 'iv') || '-4')))::text as drows from public.deals x \gset
set role authenticated;
select pg_temp.ok(pg_temp.err(format($$select public.deal_rekey(%L::jsonb, 'TEAM4SALTTEAM400', '{"v":2,"salt":"TEAM4SALTTEAM400","iv":"c4","ct":"check 4"}')$$, (:'wrows'::jsonb || :'brows'::jsonb)::text)) like '%deal(s) would be left%', 'leaving the deals on the old key is refused');
select pg_temp.ok(public.deal_team_get() ->> 'salt' = :'ts', 'and nothing changed');
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails(format($$select public.deal_rekey(%L::jsonb, %L)$$, :'drows', :'ts')), 'a rep can''t re-encrypt deals');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select public.deal_rekey((:'wrows'::jsonb || :'brows'::jsonb || :'drows'::jsonb), 'TEAM4SALTTEAM400', '{"v":2,"salt":"TEAM4SALTTEAM400","iv":"c4","ct":"check 4"}');
reset role;
select pg_temp.ok((select bool_and(enc ->> 'salt' = 'TEAM4SALTTEAM400') from public.deals) and (select bool_and(enc ->> 'salt' = 'TEAM4SALTTEAM400') from public.buyers), 'workspaces, buyers and deals move to the new key together');

-- turning someone off gives their deals to Amr, unchanged
update public.members set active = false where user_id = :N;
select pg_temp.ok((select owner from public.deals where id = 'd-n1') = :O::uuid and (select enc ->> 'ct' from public.deals where id = 'd-n1') = 'deal N1', 'turning someone off gives their deals to Amr, unchanged');
update public.members set active = true where user_id = :N;
