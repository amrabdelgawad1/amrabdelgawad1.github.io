-- Feedback and announcement checks (runs after test-dnc.sql)
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
\set F '''00000000-0000-0000-0000-000000000005'''
set role authenticated;
select pg_temp.as_user(:A::uuid, 'a@example.com', 'aal1');
select public.send_feedback('problem', 'The clock froze on my phone', '/app/#track');
select public.send_feedback('idea', 'A button for voicemails', '/app/#track');
select pg_temp.ok(pg_temp.fails($$select public.send_feedback('idea', '   ')$$), 'empty feedback is refused');
select pg_temp.ok(pg_temp.fails('select * from public.feedback') and pg_temp.fails('select * from public.portal_feedback(30)'), 'a rep can''t read anyone''s feedback');
select public.send_feedback('idea', 'x' || g) from generate_series(1, 18) g;
select pg_temp.ok(pg_temp.fails($$select public.send_feedback('idea', 'one more')$$), 'at most 20 a day each');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.portal_feedback(30)) = 20 and exists (select 1 from public.portal_feedback(30) where who = 'Agent A' and kind = 'problem' and message = 'The clock froze on my phone'), 'Amr reads it all, with names');
select public.feedback_done((select id from public.portal_feedback(30) where kind = 'problem' limit 1));
select pg_temp.ok((select done from public.portal_feedback(30) where kind = 'problem'), 'and marks it done');
-- announcement
select pg_temp.as_user(:A::uuid, 'a@example.com', 'aal1');
select pg_temp.ok(public.portal_announcement() is null, 'no announcement yet');
select pg_temp.ok(pg_temp.fails($$select public.set_announcement('hi')$$), 'a rep can''t post one');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select public.set_announcement('Team call Monday at 9 am New York time.');
select pg_temp.as_user(:A::uuid, 'a@example.com', 'aal1');
select pg_temp.ok(public.portal_announcement() ->> 'message' = 'Team call Monday at 9 am New York time.', 'the team sees Amr''s announcement');
select pg_temp.as_user(:F::uuid, 'f@example.com', 'aal1');
select pg_temp.ok(public.portal_announcement() is null, 'someone turned off doesn''t');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select public.set_announcement('');
select pg_temp.ok(public.portal_announcement() is null, 'an empty one clears it');
reset role;
set role anon;
select pg_temp.ok(pg_temp.fails($$select public.send_feedback('idea', 'spam')$$), 'nothing for someone signed out');
reset role;
