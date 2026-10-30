-- Phase 0 logs checks, after supabase/migrations/20261031090000_portal_logs.sql. Runs after test-deals.sql in
-- test-roles.sh (same people: Amr O, agents A and N, manager M). Every check prints "ok" or stops with "FAIL".
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

-- ---------- errors from the browser ----------
set role authenticated;
select pg_temp.as_user(:A::uuid, 'a@example.com', 'aal1');
select public.log_app_error('/app/#track', 'TypeError: x is undefined', '/app/app.js', 120, 'at f (app.js:120)', 'Chrome');
select public.log_app_error('/app/', repeat('long message ', 100));
select pg_temp.ok(pg_temp.fails('select * from public.app_errors'), 'an agent can''t read the error table');
select pg_temp.ok(pg_temp.fails('select * from public.portal_errors(7)'), 'or the errors page');
select public.log_app_error('/app/', 'spam ' || g) from generate_series(1, 40) g;
reset role;
select pg_temp.ok((select count(*) from public.app_errors where user_id = :A::uuid) = 30, 'at most 30 errors per person per hour');
select pg_temp.ok((select max(length(message)) from public.app_errors) <= 500, 'messages are trimmed');
set role anon;
select pg_temp.ok(pg_temp.fails($$select public.log_app_error('/', 'x')$$), 'someone signed out can''t write errors');
reset role;
set role authenticated;
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.portal_errors(7)) = 30 and (select who from public.portal_errors(7) limit 1) = 'Agent A', 'Amr sees the errors with names');

-- ---------- activity ----------
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
reset role;
select salt as team_salt from public.deal_team \gset
set role authenticated;
insert into public.deal_logs (user_id, tool, blob) values (:N, 'workspace', jsonb_build_object('v', 2, 'salt', :'team_salt', 'iv', 'i1', 'ct', 'c'))
  on conflict (user_id, tool) do update set blob = excluded.blob;
update public.deal_logs set blob = jsonb_build_object('v', 2, 'salt', :'team_salt', 'iv', 'i2', 'ct', 'c') where user_id = :N::uuid and tool = 'workspace';
reset role;
select pg_temp.ok((select count(*) from public.activity_events where kind = 'deal_saved' and target = :N::uuid) = 1, 'a Deal CRM save is noted once per 15 minutes');
select pg_temp.ok((select detail from public.activity_events where kind = 'deal_saved' and target = :N::uuid) = 'workspace', 'and only the row name, never the contents');
insert into public.shift_requests (user_id, name, status) values (:A, 'Log day', 'pending');
set role authenticated;
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select public.decide_shift_request((select id from public.shift_requests where user_id = :A::uuid and status = 'pending' limit 1), false, 'No');
reset role;
select pg_temp.ok((select count(*) from public.activity_events where kind = 'request_decided' and target = :A::uuid) = 1, 'a decided request is noted');
insert into public.hub_uploads (user_id, course, kind, mime, path, title) values (:N, 'mkt', 'recording', 'audio/webm', 'n/mkt/a.webm', 'Call');
select pg_temp.ok((select detail from public.activity_events where kind = 'drill_sent' and target = :N::uuid) = 'mkt recording', 'a sent recording is noted');
update public.members set access = access || '{live}' where user_id = :N::uuid;
set role authenticated;
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.portal_activity(7) where kind = 'deal_saved' and who = 'New N') = 1
  and (select count(*) from public.portal_activity(7) where kind = 'request_decided' and detail = 'Agent A: rejected') = 1
  and (select count(*) from public.portal_activity(7) where kind = 'access_changed') >= 1, 'Amr''s activity list: saves, decisions and access changes, with names');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal2');
select pg_temp.ok(pg_temp.fails('select * from public.portal_activity(7)'), 'a manager can''t read the activity list');
select pg_temp.ok(pg_temp.fails('select * from public.activity_events'), 'or the table');

-- ---------- change log ----------
select pg_temp.ok(pg_temp.fails($$select public.log_change('x')$$) and pg_temp.fails('select * from public.portal_changes()'), 'only Amr writes and reads the change log');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.portal_changes()) = 9, 'the releases so far are listed');
select public.log_change('Phase 0: logs', 'Errors, activity and changes', '20261031090000_portal_logs.sql', null);
select pg_temp.ok(exists (select 1 from public.portal_changes() where title = 'Phase 0: logs'), 'Amr adds a line');
reset role;
