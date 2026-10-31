-- Phase 1: end-of-day reports (runs after test-today.sql). Every check prints "ok" or stops with "FAIL".
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
\set M '''00000000-0000-0000-0000-000000000007'''
-- Today (Cairo): N has two ended shifts, one with a note and one without; A has one shift with a note; M didn't work.
-- Yesterday: N sent a note. Someone turned off (F) worked but must not be listed.
delete from public.live_status;
delete from public.shifts where user_id is not null;
delete from public.call_events;
insert into public.shifts (name, owner, user_id, shift_date, started_at, ended_at, work_seconds, dials, conversations, appointments, brief) values
  ('New N', false, :N, (now() at time zone 'Africa/Cairo')::date, now() - interval '8 hours', now() - interval '6 hours', 7200, 30, 4, 1, 'Two good talks, one appointment.'),
  ('New N', false, :N, (now() at time zone 'Africa/Cairo')::date, now() - interval '5 hours', now() - interval '4 hours', 3600, 10, 1, 0, '   '),
  ('Agent A', false, :A, (now() at time zone 'Africa/Cairo')::date, now() - interval '7 hours', now() - interval '3 hours', 14400, 55, 6, 2, 'Slow morning, better after lunch.'),
  ('New N', false, :N, (now() at time zone 'Africa/Cairo')::date - 1, now() - interval '30 hours', now() - interval '26 hours', 14400, 40, 5, 1, 'Yesterday was fine.'),
  ('Off F', false, '00000000-0000-0000-0000-000000000005', (now() at time zone 'Africa/Cairo')::date, now() - interval '3 hours', now() - interval '2 hours', 3600, 5, 0, 0, null);
insert into public.call_events (user_id, kind, shift_started_at, at) values (:N, 'offer', now() - interval '8 hours', now() - interval '1 minute');
set role authenticated;
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select status from public.portal_eod() where user_id = :N::uuid) = 'missing', 'N worked two shifts but one has no note: missing (a blank note doesn''t count)');
select pg_temp.ok((select worked_seconds = 10800 and shifts = 2 and with_report = 1 and dials = 40 and conversations = 5 and offers = 1 and appointments = 1 from public.portal_eod() where user_id = :N::uuid), 'N: 3 hours, 40 dials, 5 conversations, 1 offer, 1 appointment');
select pg_temp.ok((select jsonb_array_length(reports) = 1 and reports -> 0 ->> 'note' = 'Two good talks, one appointment.' from public.portal_eod() where user_id = :N::uuid), 'N''s note is listed, the blank one isn''t');
select pg_temp.ok((select status from public.portal_eod() where user_id = :A::uuid) = 'sent', 'A sent one');
select pg_temp.ok((select status from public.portal_eod() where user_id = :M::uuid) = 'off', 'M didn''t work: off');
select pg_temp.ok((select count(*) from public.portal_eod() where user_id = '00000000-0000-0000-0000-000000000005') = 0, 'someone turned off isn''t listed');
select pg_temp.ok((select user_id from public.portal_eod() limit 1) = :N::uuid, 'missing reports come first');
select pg_temp.ok((select status = 'sent' and reports -> 0 ->> 'note' = 'Yesterday was fine.' from public.portal_eod((now() at time zone 'Africa/Cairo')::date - 1) where user_id = :N::uuid), 'yesterday: N sent theirs');
select pg_temp.ok(pg_temp.fails($$select * from public.portal_eod((now() at time zone 'Africa/Cairo')::date + 1)$$) and pg_temp.fails($$select * from public.portal_eod((now() at time zone 'Africa/Cairo')::date - 30)$$), 'only today and the last two weeks');
reset role;
insert into public.live_status (user_id, mode, started_at) values (:M, 'run', now() - interval '1 hour');
insert into public.call_events (user_id, kind, shift_started_at) select :M::uuid, 'dial', date_trunc('second', now()) - interval '1 hour' from generate_series(1, 3);
set role authenticated;
select pg_temp.ok((select status = 'on_shift' and dials = 3 from public.portal_eod() where user_id = :M::uuid), 'M clocked in: on shift, live dials count');
select pg_temp.ok((select status from public.portal_eod((now() at time zone 'Africa/Cairo')::date - 1) where user_id = :M::uuid) = 'off', 'being on shift now doesn''t change yesterday');
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails('select * from public.portal_eod()'), 'a rep can''t read the team''s reports');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails('select * from public.portal_eod()'), 'a manager without the authenticator code can''t either');
reset role;
set role anon;
select set_config('request.jwt.claims', '{}', false);
select pg_temp.ok(pg_temp.fails('select * from public.portal_eod()'), 'not signed in: nothing');
reset role;
delete from public.live_status;
