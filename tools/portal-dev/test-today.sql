-- Phase 1: the Today screen's own numbers (runs after test-deals-split.sql). Every check prints "ok" or stops with "FAIL".
\set ON_ERROR_STOP on
set client_min_messages = notice;
create or replace function pg_temp.as_user(p_uid uuid, p_email text, p_aal text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'email', p_email, 'aal', p_aal, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.ok(p boolean, p_label text) returns void language plpgsql as $$
begin if p is not true then raise exception 'FAIL: %', p_label; end if; raise notice 'ok   %', p_label; end $$;
create or replace function pg_temp.fails(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;
\set O '''00000000-0000-0000-0000-00000000000a'''
\set N '''00000000-0000-0000-0000-000000000006'''
\set M '''00000000-0000-0000-0000-000000000007'''
\set F '''00000000-0000-0000-0000-000000000005'''
-- Agent N: an ended shift today (12 dials, 3 conversations, 1 appointment) and an open shift with 4 dial taps and an offer.
-- Manager M: a shift today too, which N must never see in their own numbers.
delete from public.call_events where user_id in (:N, :M);
delete from public.shifts where user_id in (:N, :M);
insert into public.shifts (name, owner, user_id, shift_date, started_at, dials, conversations, appointments) values
  ('New N', false, :N, (now() at time zone 'Africa/Cairo')::date, date_trunc('second', now()) - interval '6 hours', 12, 3, 1),
  ('Manager M', false, :M, (now() at time zone 'Africa/Cairo')::date, date_trunc('second', now()) - interval '6 hours', 50, 9, 4);
insert into public.call_events (user_id, kind, shift_started_at)
  select :N::uuid, k, date_trunc('second', now()) - interval '1 hour' from unnest(array['dial','dial','dial','dial','offer']) k;
-- Yesterday (Cairo day): an offer tapped just before midnight must not count today
insert into public.call_events (user_id, kind, shift_started_at, at)
  values (:N, 'offer', ((now() at time zone 'Africa/Cairo')::date::timestamp at time zone 'Africa/Cairo') - interval '3 hours',
                       ((now() at time zone 'Africa/Cairo')::date::timestamp at time zone 'Africa/Cairo') - interval '1 minute');
set role authenticated;
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok((select dials from public.portal_my_today()) = 16, 'my calls today: the ended shift''s 12 plus 4 taps of the open shift');
select pg_temp.ok((select conversations = 3 and offers = 1 and appointments = 1 from public.portal_my_today()), 'conversations, offers and appointments (an offer from before Cairo midnight isn''t counted)');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal2');
select pg_temp.ok((select dials from public.portal_my_today()) = 50, 'a manager gets only their own, not the team''s');
select pg_temp.as_user(:F::uuid, 'f@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails('select * from public.portal_my_today()'), 'someone turned off gets nothing');
reset role;
set role anon;
select set_config('request.jwt.claims', '{}', false);
select pg_temp.ok(pg_temp.fails('select * from public.portal_my_today()'), 'not signed in: nothing');
reset role;
