-- Phase 3: the team overview (runs after test-commissions.sql). Every check prints "ok" or stops with "FAIL".
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
select salt as ts from public.deal_team \gset
delete from public.live_status; delete from public.shifts where user_id is not null; delete from public.call_events;
-- N: today one shift (no note), 3 days ago one with a note, 20 days ago one; an open offer tap now; on shift now
insert into public.shifts (name, owner, user_id, shift_date, started_at, ended_at, work_seconds, dials, conversations, appointments, brief) values
  ('New N', false, :N, (now() at time zone 'Africa/Cairo')::date, now() - interval '6 hours', now() - interval '4 hours', 7200, 30, 4, 1, null),
  ('New N', false, :N, (now() at time zone 'Africa/Cairo')::date - 3, now() - interval '75 hours', now() - interval '72 hours', 10800, 50, 6, 2, 'Good day.'),
  ('New N', false, :N, (now() at time zone 'Africa/Cairo')::date - 20, now() - interval '480 hours', now() - interval '478 hours', 7200, 20, 1, 0, 'Old.');
insert into public.live_status (user_id, mode, started_at) values (:N, 'run', date_trunc('second', now()) - interval '30 minutes');
insert into public.call_events (user_id, kind, shift_started_at, at) values
  (:N, 'dial', date_trunc('second', now()) - interval '30 minutes', now() - interval '5 minutes'),
  (:N, 'offer', date_trunc('second', now()) - interval '30 minutes', now() - interval '4 minutes');
set role authenticated;
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
insert into public.deals (id, kind, state, county, stage, follow_up, enc) values
  ('d-t1', 'land', 'OH', 'ross', 'offer', (now() at time zone 'Africa/Cairo')::date - 2, jsonb_build_object('v', 2, 'salt', :'ts', 'iv', 'i-t1', 'ct', 'x')),
  ('d-t2', 'land', 'OH', 'pike', 'contract', null, jsonb_build_object('v', 2, 'salt', :'ts', 'iv', 'i-t2', 'ct', 'x')),
  ('d-t3', 'house', 'OH', 'vinton', 'closed', null, jsonb_build_object('v', 2, 'salt', :'ts', 'iv', 'i-t3', 'ct', 'x'));
select pg_temp.ok(pg_temp.fails('select * from public.portal_team_overview()'), 'a rep can''t read the team overview');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails('select * from public.portal_team_overview()'), 'a manager without the authenticator code can''t either');

select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok(pg_temp.fails('select * from public.portal_team_overview(3)'), 'only today, 7 or 30 days');
select pg_temp.ok((select on_shift and worked_seconds = 18000 and days_worked = 2 and dials = 81 and conversations = 10 and offers = 1 and appointments = 3 and notes_missing = 1
  from public.portal_team_overview(7) where user_id = :N::uuid), 'N, 7 days: on shift, 5 hours over 2 days, 81 dials (open shift included), 10 conversations, 1 offer, 3 appointments, 1 note missing');
select pg_temp.ok((select worked_seconds = 7200 and dials = 31 and days_worked = 1 from public.portal_team_overview(1) where user_id = :N::uuid), 'today only: 2 hours, 31 dials');
select pg_temp.ok((select worked_seconds = 25200 and days_worked = 3 from public.portal_team_overview(30) where user_id = :N::uuid), '30 days: 7 hours over 3 days');
select pg_temp.ok((select deals_open = 2 and deals_contract = 1 and deals_closed = 1 and followups_late = 1 from public.portal_team_overview(7) where user_id = :N::uuid), 'N''s deals: 2 open, 1 under contract, 1 closed this week, 1 follow-up late');
select pg_temp.ok((select last_active > now() - interval '10 minutes' from public.portal_team_overview(7) where user_id = :N::uuid), 'last active: a few minutes ago');
select pg_temp.ok(not exists (select 1 from public.portal_team_overview(7) where user_id = '00000000-0000-0000-0000-000000000005'), 'someone turned off isn''t listed');
select pg_temp.ok((select count(*) from public.portal_team_overview(7) where on_shift) = 1, 'only N is on shift');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal2');
select pg_temp.ok((select dials = 81 from public.portal_team_overview(7) where user_id = :N::uuid), 'a manager with the code sees the team''s numbers');
reset role;
delete from public.live_status; delete from public.shifts where user_id is not null; delete from public.call_events; delete from public.deals where id like 'd-t%';
