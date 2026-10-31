-- Phase 1: contract dates on deals (runs after test-shift-dupes.sql). Every check prints "ok" or stops with "FAIL".
\set ON_ERROR_STOP on
set client_min_messages = notice;
create or replace function pg_temp.as_user(p_uid uuid, p_email text, p_aal text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'email', p_email, 'aal', p_aal, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.ok(p boolean, p_label text) returns void language plpgsql as $$
begin if p is not true then raise exception 'FAIL: %', p_label; end if; raise notice 'ok   %', p_label; end $$;
create or replace function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return ''; exception when others then return sqlerrm; end $$;
\set N '''00000000-0000-0000-0000-000000000006'''
\set M '''00000000-0000-0000-0000-000000000007'''
select salt as ts from public.deal_team \gset
select set_config('x.ts', :'ts', false);
set role authenticated;
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
insert into public.deals (id, kind, state, stage, contract_on, inspection_ends, closing_on, enc)
  values ('d-c1', 'land', 'OH', 'contract', current_date - 3, current_date + 4, current_date + 25, jsonb_build_object('v', 2, 'salt', :'ts', 'iv', 'i-c1', 'ct', 'deal C1'));
select pg_temp.ok((select contract_on = current_date - 3 and inspection_ends = current_date + 4 and closing_on = current_date + 25 from public.deals where id = 'd-c1'), 'a rep saves contract, inspection and closing dates');
select pg_temp.ok(pg_temp.err($$update public.deals set inspection_ends = current_date - 10 where id = 'd-c1'$$) like '%inspection period%', 'an inspection end before the contract date is refused');
select pg_temp.ok(pg_temp.err($$update public.deals set closing_on = current_date - 10 where id = 'd-c1'$$) like '%Closing%', 'a closing before the contract date is refused');
select pg_temp.ok(pg_temp.err($$update public.deals set closing_on = null, inspection_ends = null where id = 'd-c1'$$) = '', 'dates can be cleared');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.deals where id = 'd-c1') = 0, 'the dates follow the deal''s rules: a manager without the code doesn''t see them');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.deals where id = 'd-c1') = 1, 'with the code they do');
reset role;
delete from public.deals where id = 'd-c1';
