-- Gate 1 tracker (runs after test-library.sql). Every check prints "ok" or stops with "FAIL".
\set ON_ERROR_STOP on
set client_min_messages = notice;
create or replace function pg_temp.as_user(p_uid uuid, p_email text, p_aal text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'email', p_email, 'aal', p_aal, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.ok(p boolean, p_label text) returns void language plpgsql as $$
begin if p is not true then raise exception 'FAIL: %', p_label; end if; raise notice 'ok   %', p_label; end $$;
create or replace function pg_temp.fails(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;
\set O '''00000000-0000-0000-0000-00000000000a'''
\set X '''00000000-0000-0000-0000-000000000002'''
\set N '''00000000-0000-0000-0000-000000000006'''
\set M '''00000000-0000-0000-0000-000000000007'''
delete from public.shifts where user_id is not null; delete from public.call_events;
-- N: worked 10 days ago (20 dials), 3 days ago (no calls logged), today (30 dials)
insert into public.shifts (name, owner, user_id, shift_date, started_at, ended_at, work_seconds, dials) values
  ('New N', false, :N, (now() at time zone 'Africa/Cairo')::date - 10, now() - interval '240 hours', now() - interval '238 hours', 7200, 20),
  ('New N', false, :N, (now() at time zone 'Africa/Cairo')::date - 3, now() - interval '72 hours', now() - interval '70 hours', 7200, 0),
  ('New N', false, :N, (now() at time zone 'Africa/Cairo')::date, now() - interval '3 hours', now() - interval '1 hour', 7200, 30);
set role authenticated;
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails('select * from public.portal_gate1()'), 'only Amr sees the Gate 1 tracker');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select shift_days = 3 and missed_days = 1 and last_missed = (now() at time zone 'Africa/Cairo')::date - 3 and clean_days = 3 and worked_both_weeks from public.portal_gate1() where user_id = :N::uuid),
  'N: 3 shift days, 1 with no calls 3 days ago, clean for 3 days, worked in both weeks');
select pg_temp.ok((select clean_days = 0 and shift_days = 0 and not worked_both_weeks from public.portal_gate1() where user_id = :M::uuid), 'M hasn''t worked: 0 days');
select pg_temp.ok(not exists (select 1 from public.portal_gate1() where user_id = :X::uuid), 'a learner off the calling team isn''t counted');
reset role;
-- a call tap that day counts as logged even if the shift's numbers are empty
insert into public.call_events (user_id, kind, shift_started_at, at) values (:N, 'dial', now() - interval '72 hours', now() - interval '71 hours');
set role authenticated;
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select missed_days = 0 and clean_days = 11 from public.portal_gate1() where user_id = :N::uuid), 'a call tap that day counts: no missed days, clean for 11 days (since the first shift)');
reset role;
delete from public.shifts where user_id is not null; delete from public.call_events;
