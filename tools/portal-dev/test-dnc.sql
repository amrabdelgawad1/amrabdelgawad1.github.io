-- Phase 1: do-not-call list checks (runs after test-calls-today.sql)
\set ON_ERROR_STOP on
set client_min_messages = notice;
create or replace function pg_temp.as_user(p_uid uuid, p_email text, p_aal text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'email', p_email, 'aal', p_aal, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.ok(p boolean, p_label text) returns void language plpgsql as $$
begin if p is not true then raise exception 'FAIL: %', p_label; end if; raise notice 'ok   %', p_label; end $$;
create or replace function pg_temp.fails(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;
\set O '''00000000-0000-0000-0000-00000000000a'''
\set A '''00000000-0000-0000-0000-000000000001'''
\set N '''00000000-0000-0000-0000-000000000006'''
\set F '''00000000-0000-0000-0000-000000000005'''
set role authenticated;
select pg_temp.as_user(:A::uuid, 'a@example.com', 'aal1');
select pg_temp.ok(public.dnc_add('+1 (813) 555-0142', 'asked', 'Seller asked twice') = '8135550142', 'a rep adds a number; it''s stored as 10 digits');
select pg_temp.ok(pg_temp.fails($$select public.dnc_add('12', 'asked')$$), 'something that isn''t a number is refused');
select pg_temp.ok(pg_temp.fails($$select public.dnc_add('8135550199', 'because')$$), 'only the known reasons');
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok(public.dnc_check('813-555-0142') and not public.dnc_check('8135550143'), 'another rep checks a number in any format');
select pg_temp.ok(pg_temp.fails('select * from public.portal_dnc()') and pg_temp.fails('select * from public.dnc_numbers'), 'but can''t read the list');
select pg_temp.ok(pg_temp.fails($$select public.dnc_remove('8135550142')$$), 'or take a number off');
select pg_temp.as_user(:F::uuid, 'f@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails($$select public.dnc_check('8135550142')$$), 'someone turned off can''t check');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select who from public.portal_dnc() where phone = '8135550142') = 'Agent A' and (select reason from public.portal_dnc() limit 1) = 'asked', 'Amr sees the list, who added it and why');
select pg_temp.ok(public.dnc_remove('(813) 555-0142'), 'Amr can take a number off');
select pg_temp.ok(not public.dnc_check('8135550142'), 'and then it''s not on the list');
reset role;
set role anon;
select pg_temp.ok(pg_temp.fails($$select public.dnc_check('8135550142')$$), 'nothing for someone signed out');
reset role;
