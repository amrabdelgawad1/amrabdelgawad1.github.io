-- Phase 3: onboarding checklist (runs after test-call-scoring.sql). Every check prints "ok" or stops with "FAIL".
\set ON_ERROR_STOP on
set client_min_messages = notice;
create or replace function pg_temp.as_user(p_uid uuid, p_email text, p_aal text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'email', p_email, 'aal', p_aal, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.ok(p boolean, p_label text) returns void language plpgsql as $$
begin if p is not true then raise exception 'FAIL: %', p_label; end if; raise notice 'ok   %', p_label; end $$;
create or replace function pg_temp.fails(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;
create or replace function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return ''; exception when others then return sqlerrm; end $$;
\set O '''00000000-0000-0000-0000-00000000000a'''
\set N '''00000000-0000-0000-0000-000000000006'''
\set M '''00000000-0000-0000-0000-000000000007'''
select pg_temp.ok((select count(*) from public.onboarding_items) = 15 and (select count(*) from public.onboarding_items where auto is not null) = 8, 'the starting checklist: 15 items, 8 of them check themselves');

-- N's real progress: signed in, course open (agent set), one shift with 60 dials, a roleplay scored
delete from public.shifts where user_id is not null; delete from public.hub_uploads;
update auth.users set last_sign_in_at = now() where id = :N;
insert into public.shifts (name, owner, user_id, shift_date, started_at, ended_at, work_seconds, dials) values ('New N', false, :N, current_date, now() - interval '3 hours', now() - interval '1 hour', 7200, 60);
insert into public.hub_uploads (user_id, course, title, kind, path, mime, status, score) values (:N, 'calls', 'Roleplay', 'recording', '00000000-0000-0000-0000-000000000006/calls/o1.m4a', 'audio/mp4', 'approved', '{"cats":[3,3,3,3,3,3,3,3,3,3],"total":30}');

set role authenticated;
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok((select string_agg(title, ' | ' order by title) from public.portal_onboarding() where done) = 'Acquisitions course open | First 50 dials | First roleplay scored | First shift logged | Signed in to the portal',
  'N''s own checklist ticks itself from what N really did: signed in, course open, a shift, 50 dials, a roleplay scored');
select pg_temp.ok(pg_temp.fails('select * from public.portal_onboarding(''00000000-0000-0000-0000-000000000007'')'), 'N can''t read someone else''s');
select pg_temp.ok(pg_temp.fails($$insert into public.onboarding_ticks (user_id, item_id) select '00000000-0000-0000-0000-000000000006', id from public.onboarding_items where title = 'Agreement signed'$$), 'N can''t tick their own items');
select pg_temp.ok(pg_temp.fails('select * from public.portal_onboarding_summary()'), 'or see everyone''s progress');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal2');
select pg_temp.ok(pg_temp.fails('select * from public.portal_onboarding(''00000000-0000-0000-0000-000000000006'')'), 'a manager can''t read a rep''s checklist either');

select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
insert into public.onboarding_ticks (user_id, item_id, done_at) select :N, id, '2001-01-01' from public.onboarding_items where title = 'Agreement signed';
select pg_temp.ok((select done and done_at > now() - interval '1 minute' from public.portal_onboarding(:N::uuid) where title = 'Agreement signed'), 'Amr ticks Agreement signed (the real time is kept, whatever the page sends)');
select pg_temp.ok(pg_temp.err($$insert into public.onboarding_ticks (user_id, item_id) select '00000000-0000-0000-0000-000000000006', id from public.onboarding_items where auto = 'dials_50'$$) like '%ticks itself%', 'an item that checks itself can''t be ticked by hand');
select pg_temp.ok((select done = 6 and total = 15 from public.portal_onboarding_summary() where user_id = :N::uuid), 'summary: N has 6 of 15');
update public.onboarding_items set active = false where title = 'Dialer account ready';
select pg_temp.ok((select total = 14 from public.portal_onboarding_summary() where user_id = :N::uuid), 'turning an item off takes it out of everyone''s total');
insert into public.onboarding_items (grp, title) values ('Training', 'Shadowed two live calls');
select pg_temp.ok((select count(*) from public.portal_onboarding(:N::uuid) where title = 'Shadowed two live calls' and not done) = 1, 'Amr adds an item; it shows on everyone''s list');
delete from public.onboarding_ticks where user_id = :N::uuid;
select pg_temp.ok((select not done from public.portal_onboarding(:N::uuid) where title = 'Agreement signed'), 'and can untick');
reset role;
delete from public.onboarding_items where title = 'Shadowed two live calls'; update public.onboarding_items set active = true;
delete from public.shifts where user_id is not null; delete from public.hub_uploads; update auth.users set last_sign_in_at = null;
