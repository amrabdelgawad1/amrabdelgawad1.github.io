-- Phase 1 call counter checks, after supabase/migrations/20261031110000_call_events.sql (runs after test-logs.sql).
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
insert into public.call_events (kind, shift_started_at) select k, now() - interval '2 hours' from unnest(array['dial','dial','dial','conversation','offer','appointment']) k;
select pg_temp.ok((select count(*) from public.call_events) = 6, 'a rep taps calls and reads their own');
select pg_temp.ok(pg_temp.fails($$insert into public.call_events (kind, shift_started_at) values ('voicemail', now())$$), 'only dial, conversation, offer, appointment');
select pg_temp.ok(pg_temp.fails($$insert into public.call_events (user_id, kind, shift_started_at) values ('00000000-0000-0000-0000-000000000006', 'dial', now())$$), 'can''t tap for someone else');
select pg_temp.ok(pg_temp.fails($$insert into public.call_events (kind, at, shift_started_at) values ('dial', now() - interval '3 days', now() - interval '3 days')$$), 'can''t backfill old days');
delete from public.call_events where id = (select max(id) from public.call_events);
select pg_temp.ok((select count(*) from public.call_events) = 5, 'undo the last tap');
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.call_events) = 0, 'another rep sees none of them');
select pg_temp.ok(pg_temp.fails('select * from public.portal_calls(7)'), 'and can''t read the team''s counts');
select pg_temp.as_user(:F::uuid, 'f@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails($$insert into public.call_events (kind, shift_started_at) values ('dial', now())$$), 'someone turned off can''t tap');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select dials from public.portal_calls(7) where name = 'Agent A') = 3 and (select offers from public.portal_calls(7) where name = 'Agent A') = 1, 'Amr reads everyone''s counts per day');
reset role;
set role anon;
select pg_temp.ok(pg_temp.fails('select * from public.call_events'), 'nothing for someone signed out');
reset role;
