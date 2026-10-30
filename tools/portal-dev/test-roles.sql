-- Round 2 checks: who can do what after supabase/migrations/20261030120000_portal_roles.sql.
-- Run by test-roles.sh on a throwaway local Postgres. Every check prints "ok" or stops with "FAIL".
\set ON_ERROR_STOP on
set client_min_messages = notice;

create or replace function pg_temp.as_user(p_uid uuid, p_email text, p_aal text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'email', p_email, 'aal', p_aal, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.ok(p boolean, p_label text) returns void language plpgsql as $$
begin if p is not true then raise exception 'FAIL: %', p_label; end if; raise notice 'ok   %', p_label; end $$;
create or replace function pg_temp.fails(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;
create or replace function pg_temp.keys(p_uid uuid) returns text[] language sql as $$
  select array(select k from unnest(array['course','deals','learn','live','mkt','money','psy','requests','team']) k where public.portal_can(k) order by k) $$;

\set O '''00000000-0000-0000-0000-00000000000a'''
\set A '''00000000-0000-0000-0000-000000000001'''
\set X '''00000000-0000-0000-0000-000000000002'''
\set L '''00000000-0000-0000-0000-000000000003'''
\set T '''00000000-0000-0000-0000-000000000004'''
\set F '''00000000-0000-0000-0000-000000000005'''
\set N '''00000000-0000-0000-0000-000000000006'''
\set M '''00000000-0000-0000-0000-000000000007'''

-- ---------- the backfill ----------
select pg_temp.ok((select bool_and(role = 'agent') from public.members where user_id in (:A, :X, :L, :T, :F)), 'everyone on the team today is an agent');
select pg_temp.ok((select not_given from public.members where user_id = :A) = array['course','deals','learn'], 'A had nothing: every agent key goes in not_given');
select pg_temp.ok((select not_given from public.members where user_id = :X) = array['course','deals'], 'X had learn: only course and deals go in not_given');
select pg_temp.ok(pg_temp.fails($$update public.members set role = 'owner' where user_id = '00000000-0000-0000-0000-000000000001'$$), 'role owner can''t be stored');
select pg_temp.ok((select role from public.members where user_id = :N) = 'agent', 'an invite sent with role member becomes agent');
select pg_temp.ok((select not_given from public.members where user_id = :N) = '{}', 'a new invite gets the full agent set');

-- ---------- what each person can do ----------
select pg_temp.as_user(:A::uuid, 'a@example.com', 'aal1');
select pg_temp.ok(pg_temp.keys(:A) = '{}', 'A (agent, had nothing): still nothing');
select pg_temp.ok(public.portal_role() = 'agent', 'A role is agent');
select pg_temp.ok(public.deal_access_status() = 'none', 'A: no Deal tools');

select pg_temp.as_user(:X::uuid, 'x@example.com', 'aal1');
select pg_temp.ok(pg_temp.keys(:X) = array['learn','mkt'], 'X (had learn and mkt): same two');
select pg_temp.ok(public.learn_can_open('mkt') and not public.learn_can_open('psy'), 'X opens Marketing, not Psychology');
select pg_temp.ok(not public.course_has_access() and public.hub_can_send('mkt') and not public.hub_can_send('acq'), 'X: no Acquisitions, can send for Marketing');

select pg_temp.as_user(:L::uuid, 'l@example.com', 'aal1');
select pg_temp.ok(pg_temp.keys(:L) = array['live'], 'L (had live): live, without the code, as before');
select pg_temp.ok(public.has_access('live') and not public.has_access('requests'), 'L: has_access agrees');

select pg_temp.as_user(:T::uuid, 't@example.com', 'aal1');
select pg_temp.ok(not public.has_access('team'), 'T (had team): needs the code first, as before');
select pg_temp.ok(public.portal_me() -> 'needs_code' = '["team"]'::jsonb and public.portal_me() -> 'keys' = '["team"]'::jsonb, 'T: portal_me says team is waiting on the code');
select pg_temp.as_user(:T::uuid, 't@example.com', 'aal2');
select pg_temp.ok(public.has_access('team') and public.portal_me() -> 'needs_code' = '[]'::jsonb, 'T with the code: team opens');

select pg_temp.as_user(:F::uuid, 'f@example.com', 'aal2');
select pg_temp.ok(pg_temp.keys(:F) = '{}' and public.portal_role() is null, 'F (switched off): nothing, no role');

select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok(pg_temp.keys(:N) = array['course','deals','learn'], 'N (new invite): the agent set');
select pg_temp.ok(public.course_has_access() and public.hub_can_send('acq') and not public.learn_can_open('mkt'), 'N: Acquisitions yes, Marketing no');
select pg_temp.ok(public.deal_access_status() = 'ok', 'N: Deal tools open through the role');
select pg_temp.ok(not public.has_access('live'), 'N: no Live now');

select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal1');
select pg_temp.ok(public.portal_role() = 'manager', 'M role is manager');
select pg_temp.ok(pg_temp.keys(:M) = array['course','deals','learn','live','requests'], 'M without the code: everything but team');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal2');
select pg_temp.ok(pg_temp.keys(:M) = array['course','deals','learn','live','requests','team'], 'M with the code: team too, never money');

select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal1');
select pg_temp.ok(pg_temp.keys(:O) = '{}' and public.deal_access_status() = 'mfa', 'Amr without the code: nothing yet, Deal tools ask for it');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok(pg_temp.keys(:O) = array['course','deals','learn','live','mkt','money','psy','requests','team'] and public.portal_role() = 'owner', 'Amr with the code: everything');
select pg_temp.ok(public.portal_keys_of('agent', array['money'], '{}') = array['course','deals','learn'], 'money as an extra counts for nobody');

-- ---------- rows people can read ----------
set role authenticated;
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.shifts) = 1, 'manager with the code sees team shifts, not Amr''s own');
select pg_temp.ok((select count(*) from public.shift_requests) = 3, 'manager sees every missed-shift request');
select pg_temp.ok((select count(*) from public.learn_progress) = 0, 'manager reads no learn_progress rows');
select pg_temp.ok((select count(*) from public.portal_learner_progress()) = 2, 'manager gets progress for active members only');
select pg_temp.ok((select count(*) from public.access_log) = 0, 'manager can''t read the access log');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.shifts) = 0, 'manager without the code sees no shifts');
select pg_temp.ok(pg_temp.fails('select * from public.portal_learner_progress()'), 'manager without the code: no learner progress');

select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.shifts) = 0 and (select count(*) from public.shift_requests) = 1, 'agent sees no shifts, only their own request');
select pg_temp.ok(pg_temp.fails('select * from public.portal_learner_progress()'), 'agent: no learner progress');
select pg_temp.ok(pg_temp.fails($$insert into public.access_log (target, change) values ('00000000-0000-0000-0000-000000000006', '{}')$$), 'nobody writes the access log');

select pg_temp.as_user(:X::uuid, 'x@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.learn_progress) = 1, 'a learner reads their own progress');

select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.learn_progress where user_id <> auth.uid()) = 0, 'Amr reads nobody else''s saved course data (scratch pad, drawings)');
select pg_temp.ok((select passed from public.portal_learner_progress() where user_id = :X and course = 'mkt2') = 1, 'pass count: Marketing, 1 of 2 quizzes at 80 or more');
select pg_temp.ok((select sent from public.portal_learner_progress() where user_id = :X and course = 'mkt2') = 1, 'pass count: Marketing, 1 assignment sent');
select pg_temp.ok((select passed from public.portal_learner_progress() where user_id = :A and course = 'psy') = 2, 'pass count: Psychology, exam done + 17 of 20 pass, 12 of 20 doesn''t');
select pg_temp.ok((select count(*) from public.portal_people()) = 7, 'Amr gets everyone with their role and keys');
reset role;

-- ---------- missed-shift requests ----------
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal2');
select pg_temp.ok(pg_temp.fails('select public.decide_shift_request((select id from public.shift_requests where name = ''A day''), true)'), 'agent can''t decide a request');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails('select public.decide_shift_request((select id from public.shift_requests where name = ''M day''), true)'), 'manager can''t decide their own request');
select pg_temp.ok(pg_temp.fails('select public.decide_shift_request((select id from public.shift_requests where name = ''A day''), true)'), 'manager without the code can''t approve');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal2');
select pg_temp.ok(pg_temp.fails('select public.decide_shift_request((select id from public.shift_requests where name = ''M day''), true)'), 'manager with the code still can''t decide their own request');
select pg_temp.ok(public.decide_shift_request((select id from public.shift_requests where name = 'A day'), true) is not null, 'manager with the code approves someone else''s request');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select public.decide_shift_request((select id from public.shift_requests where name = 'M day'), false, 'Not this day');
select pg_temp.ok((select status from public.shift_requests where name = 'M day') = 'rejected', 'Amr decides the manager''s request');

-- ---------- access log ----------
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
update public.members set access = array['mkt','learn'] where user_id = :A;
update public.members set name = name where user_id = :A;   -- no access change, no log line
select pg_temp.ok((select count(*) from public.access_log where target = :A) = 1, 'one log line for one access change');
select pg_temp.ok((select actor from public.access_log where target = :A) = :O::uuid
  and (select change -> 'access' -> 'to' from public.access_log where target = :A) = '["mkt","learn"]'::jsonb, 'the log line says who and what');
select pg_temp.ok((select count(*) from public.access_log where target = :N and change ? 'added') = 1, 'a new invite is logged');
select pg_temp.as_user(:A::uuid, 'a@example.com', 'aal1');
select pg_temp.ok(public.learn_can_open('mkt'), 'A opens Marketing once Amr ticks it');
