-- Phase 3: call scoring and roleplay (runs after test-team-overview.sql). Every check prints "ok" or stops with "FAIL".
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
delete from public.notifications;

set role authenticated;
-- scenarios: Amr writes them; the team reads the active ones
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails($$insert into public.roleplay_scenarios (title) values ('Made up')$$), 'a rep can''t write a scenario');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
insert into public.roleplay_scenarios (title, kind, level, seller, know, goal, hidden) values
  ('Inherited land', 'land', 'easy', 'Linda, inherited 12 acres', 'Ross County, OH. Taxes behind.', 'Get her number and a callback.', 'She wants $40,000 but will take $25,000.'),
  ('Old one', 'land', 'hard', 'x', '', '', 'secret');
update public.roleplay_scenarios set active = false where title = 'Old one';
select id as sid from public.roleplay_scenarios where title = 'Inherited land' \gset
select pg_temp.ok((select count(*) from public.roleplay_scenarios) = 2, 'Amr adds scenarios and sees them all, active or not');
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok((select count(*) = 1 and bool_and(title = 'Inherited land') from public.roleplay_scenarios), 'a rep sees only the active one');
update public.roleplay_scenarios set active = true, hidden = 'changed';
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.roleplay_scenarios where active) = 1 and not exists (select 1 from public.roleplay_scenarios where hidden = 'changed'), 'and a rep''s change does nothing');
select pg_temp.as_user(:X::uuid, 'x@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.roleplay_scenarios) = 0, 'a learner who isn''t on the calling team sees none');

-- sending a call for scoring
select pg_temp.ok(pg_temp.fails($$insert into public.hub_uploads (user_id, course, title, kind, path, mime) values ('00000000-0000-0000-0000-000000000002', 'calls', 'x', 'recording', '00000000-0000-0000-0000-000000000002/calls/a.m4a', 'audio/mp4')$$), 'a learner can''t send a call for scoring');
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
insert into storage.objects (bucket_id, name) values ('hub-uploads', '00000000-0000-0000-0000-000000000006/calls/r1.m4a');
insert into public.hub_uploads (user_id, course, title, kind, path, mime, scenario_id) values (:N, 'calls', 'Roleplay: Inherited land', 'recording', '00000000-0000-0000-0000-000000000006/calls/r1.m4a', 'audio/mp4', :sid);
select pg_temp.ok((select count(*) from public.hub_uploads where course = 'calls' and scenario_id = :sid) = 1, 'a rep sends a roleplay for a scenario');
select pg_temp.ok(pg_temp.fails($$insert into public.hub_uploads (user_id, course, title, kind, path, mime, real_call) values ('00000000-0000-0000-0000-000000000006', 'calls', 'Real', 'recording', '00000000-0000-0000-0000-000000000006/calls/r2.m4a', 'audio/mp4', true)$$), 'a real call without consent is refused');
insert into public.hub_uploads (user_id, course, title, kind, path, mime, real_call, consent) values (:N, 'calls', 'Real call', 'recording', '00000000-0000-0000-0000-000000000006/calls/r2.m4a', 'audio/mp4', true, true);
select pg_temp.ok(pg_temp.fails(format($$insert into public.hub_uploads (user_id, course, title, kind, path, mime, real_call, consent, scenario_id) values ('00000000-0000-0000-0000-000000000006', 'calls', 'Mix', 'recording', '00000000-0000-0000-0000-000000000006/calls/r3.m4a', 'audio/mp4', true, true, %s)$$, :sid)), 'a real call can''t also be a roleplay');
select pg_temp.ok(pg_temp.fails($$insert into public.hub_uploads (user_id, course, title, kind, path, mime) values ('00000000-0000-0000-0000-000000000006', 'calls', 'x', 'recording', '00000000-0000-0000-0000-000000000007/calls/a.m4a', 'audio/mp4')$$), 'only into their own folder');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.hub_uploads where course = 'calls') = 0, 'a manager doesn''t see a rep''s calls');

-- scoring
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select string_agg(title, ' | ' order by id) from public.notifications) = 'New N sent a call to score | New N sent a call to score', 'Amr hears about both calls');
select public.hub_review((select id from public.hub_uploads where title = 'Real call'), 'approved', '{"cats":[4,4,3,5,4,3,4,2,4,5]}');
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok((select score ->> 'total' = '38' from public.hub_uploads where title = 'Real call'), 'the rep sees the score: 38 of 50');
select pg_temp.ok((select title = 'Your call was scored: 38 of 50' and link = '/app/#scoring' and body = 'Real call · Real call' from public.notifications), 'and is told, with a link to Call scoring');
reset role;
delete from public.hub_uploads where course = 'calls'; delete from storage.objects where name like '%/calls/%'; delete from public.roleplay_scenarios; delete from public.notifications;
