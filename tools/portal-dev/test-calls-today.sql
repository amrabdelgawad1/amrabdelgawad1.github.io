-- Phase 1: open shifts count on the board and in today's calls, without counting twice (runs after test-calls.sql)
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
\set M '''00000000-0000-0000-0000-000000000007'''
-- Agent A: an ended shift today with 20 dials (its taps were 18, the rep corrected it), and an open shift with 5 dial taps
delete from public.call_events;
insert into public.shifts (name, owner, user_id, shift_date, started_at, dials, conversations, appointments)
  values ('Agent A', false, :A, (now() at time zone 'Africa/Cairo')::date, date_trunc('second', now()) - interval '5 hours', 20, 4, 1);
insert into public.call_events (user_id, kind, shift_started_at, at)
  select :A::uuid, 'dial', date_trunc('second', now()) - interval '5 hours', now() - interval '4 hours' from generate_series(1, 18);
insert into public.call_events (user_id, kind, shift_started_at)
  select :A::uuid, k, date_trunc('second', now()) - interval '1 hour' from unnest(array['dial','dial','dial','dial','dial','conversation','offer']) k;
insert into public.live_status (user_id, mode, started_at) values (:A, 'run', date_trunc('second', now()) - interval '1 hour') on conflict (user_id) do nothing;
set role authenticated;
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select dials from public.portal_calls_today() where name = 'Agent A') = 25, 'today: the ended shift''s 20 plus the open shift''s 5 taps (the ended shift''s 18 taps aren''t counted again)');
select pg_temp.ok((select conversations from public.portal_calls_today() where name = 'Agent A') = 5 and (select offers from public.portal_calls_today() where name = 'Agent A') = 1
  and (select appointments from public.portal_calls_today() where name = 'Agent A') = 1 and (select on_shift from public.portal_calls_today() where name = 'Agent A'), 'conversations, offers, appointments, and on shift');
select pg_temp.as_user(:A::uuid, 'a@example.com', 'aal1');
select pg_temp.ok((select calls from public.portal_team_board() where user_id = :A::uuid) = 25, 'the weekly board counts the open shift too');
select pg_temp.ok(pg_temp.fails('select * from public.portal_calls_today()'), 'an agent can''t read everyone''s day');
select pg_temp.ok(pg_temp.fails($$select public.portal_open_taps('00000000-0000-0000-0000-000000000001', now() - interval '1 day', 'dial')$$), 'or call the helper');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.portal_calls_today() where name = 'Agent A') = 1, 'a manager who sees Live now can');
reset role;
