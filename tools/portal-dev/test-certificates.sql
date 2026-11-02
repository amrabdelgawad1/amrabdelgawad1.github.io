-- Phase 3: course certificates (runs after test-gate1.sql). Every check prints "ok" or stops with "FAIL".
\set ON_ERROR_STOP on
set client_min_messages = notice;
create or replace function pg_temp.as_user(p_uid uuid, p_email text, p_aal text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'email', p_email, 'aal', p_aal, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false) $$;
create or replace function pg_temp.ok(p boolean, p_label text) returns void language plpgsql as $$
begin if p is not true then raise exception 'FAIL: %', p_label; end if; raise notice 'ok   %', p_label; end $$;
create or replace function pg_temp.fails(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;
create or replace function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return ''; exception when others then return sqlerrm; end $$;
\set O '''00000000-0000-0000-0000-00000000000a'''
\set A '''00000000-0000-0000-0000-000000000001'''
\set N '''00000000-0000-0000-0000-000000000006'''
\set M '''00000000-0000-0000-0000-000000000007'''

-- N has the Acquisitions course; A doesn't
update public.members set access = array_append(access, 'course') where user_id = :N::uuid and not ('course' = any(access));
update public.members set access = array_remove(access, 'course') where user_id = :A::uuid;
delete from public.hub_uploads; delete from public.course_attempts; delete from public.course_submissions; delete from public.notifications;
-- N's work: checkpoints 1 to 19 passed (and one later failed retake of 3, which doesn't undo it), the final exam, the capstone,
-- three calls: 44 and 46 (no part below 3) count, 47 with a 2 doesn't
insert into public.course_attempts (user_id, module_id, item_id, total, pass_mark, correct, score, passed, finished_at)
select :N::uuid, 'm' || g, g || '.checkpoint', 25, 85, 23, 92, true, now() - interval '2 days' from generate_series(1, 19) g;
insert into public.course_attempts (user_id, module_id, item_id, total, pass_mark, correct, score, passed, finished_at)
values (:N::uuid, 'm20', '20.checkpoint', 50, 85, 45, 90, true, now()), (:N::uuid, 'm3', '3.checkpoint', 25, 85, 10, 40, false, now());
-- A (no course) and an old 80% pass mark: 82% marked passed doesn't count toward the 85% Lesson 20.1 asks for
insert into public.course_attempts (user_id, module_id, item_id, total, pass_mark, correct, score, passed, finished_at)
values (:A::uuid, 'm1', '1.checkpoint', 25, 80, 20, 82, true, now());
insert into public.course_submissions (user_id, module_id, item_id, status, submitted_at) values (:N::uuid, 'm20', '20.assignment', 'approved', now());
insert into public.hub_uploads (user_id, course, title, kind, path, mime, status, score) values
 (:N::uuid, 'acq', 'Cert call 1', 'recording', '00000000-0000-0000-0000-000000000006/acq/c1.m4a', 'audio/mp4', 'approved', '{"cats":[4,4,5,4,5,4,4,5,4,5],"total":44}'),
 (:N::uuid, 'calls', 'Cert call 2', 'recording', '00000000-0000-0000-0000-000000000006/calls/c2.m4a', 'audio/mp4', 'approved', '{"cats":[5,5,5,4,5,4,5,4,4,5],"total":46}'),
 (:N::uuid, 'calls', 'Cert call 3', 'recording', '00000000-0000-0000-0000-000000000006/calls/c3.m4a', 'audio/mp4', 'approved', '{"cats":[5,5,5,5,5,5,5,5,5,2],"total":47}'),
 (:N::uuid, 'calls', 'Sent back', 'recording', '00000000-0000-0000-0000-000000000006/calls/c4.m4a', 'audio/mp4', 'redo', '{"cats":[5,5,5,5,5,5,5,5,5,5],"total":50}');

set role authenticated;
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select checkpoints = 19 and final_exam and capstone and calls_40 = 2 and best_call = 46 from public.certificate_readiness(:N::uuid)),
  'readiness: 19 checkpoints, final exam, capstone approved, two approved calls of 40+ with no part below 3 (best 46; a sent-back 50 doesn''t count)');
select pg_temp.ok((select checkpoints = 0 from public.certificate_readiness(:A::uuid)), 'a checkpoint passed at an old 80% mark (82%) doesn''t count: Lesson 20.1 asks for 85%');
select pg_temp.ok((select count(*) = 1 from public.certificate_people() where user_id = :N::uuid) and not exists (select 1 from public.certificate_people() where user_id = :A::uuid),
  'Amr''s list shows people with the Acquisitions course only');
select pg_temp.ok(pg_temp.err($$select public.certificate_issue('00000000-0000-0000-0000-000000000001', 'Agent A')$$) like '%Acquisitions course%', 'no certificate for someone without the course');
select pg_temp.ok(pg_temp.err($$select public.certificate_issue('00000000-0000-0000-0000-000000000006', ' x ')$$) like '%name%', 'the name must be typed');
select public.certificate_issue(:N::uuid, '  Nadia   Hassan ') as code \gset
select pg_temp.ok(:'code' ~ '^ACQ-[0-9A-F]{5}-[0-9A-F]{5}$', 'issued, with a code like ACQ-XXXXX-XXXXX');
select pg_temp.ok((select name = 'Nadia Hassan' and (valid_until - issued_on) in (365, 366) from public.certificates where code = :'code'), 'the name is tidied and it''s valid for a year');
select pg_temp.ok(pg_temp.err($$select public.certificate_issue('00000000-0000-0000-0000-000000000006', 'Nadia Hassan')$$) like '%Renew%', 'only one current certificate per person');
select pg_temp.ok(pg_temp.fails($$insert into public.certificates (code, name, valid_until) values ('ACQ-00000-00000', 'Fake', current_date + 1)$$)
  and pg_temp.fails($$update public.certificates set valid_until = current_date + 3000$$), 'not even Amr writes the table directly; only through the functions');

-- N sees their own, and their notification links to it
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok((select count(*) = 1 from public.certificates where user_id = :N::uuid), 'N reads their own certificate');
select pg_temp.ok((select count(*) = 1 from public.notifications where user_id = :N::uuid and link = '/cert/?c=' || :'code'), 'N got a notification that opens it');
select pg_temp.ok(pg_temp.fails($$select public.certificate_issue('00000000-0000-0000-0000-000000000006', 'Me')$$)
  and pg_temp.fails($$select * from public.certificate_readiness('00000000-0000-0000-0000-000000000006')$$)
  and pg_temp.fails('select * from public.certificate_list()'), 'N can''t issue, see readiness or the full list');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal2');
select pg_temp.ok((select count(*) = 0 from public.certificates) and pg_temp.fails('select * from public.certificate_people()'), 'a manager sees no one''s certificates');

-- the public check: anyone with the exact code
reset role; set role anon; select pg_temp.as_anon();
select pg_temp.ok((select name = 'Nadia Hassan' and status = 'current' and course = 'Acquisitions Playbook' from public.certificate_check(lower(:'code'))), 'anyone with the code (any case) sees the name, course and "current"');
select pg_temp.ok((select count(*) = 0 from public.certificate_check('ACQ-00000-00000')), 'a wrong code shows nothing');
select pg_temp.ok(pg_temp.fails('select * from public.certificates') and pg_temp.fails('select * from public.certificate_people()'), 'and nothing else is readable');
reset role; set role authenticated;

-- renew and revoke
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select id as cid from public.certificates where code = :'code' \gset
reset role; update public.certificates set issued_on = current_date - 400, valid_until = current_date - 5 where id = :cid; set role authenticated;
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select status = 'renewal_due' from public.certificate_check(:'code')), 'past its date it says renewal due');
select public.certificate_renew(:cid);
select pg_temp.ok((select status = 'current' and renewed_on is not null and valid_until > current_date + 360 from public.certificate_check(:'code')), 'renewing gives a year from today');
select public.certificate_revoke(:cid, 'Left the team');
select pg_temp.ok((select status = 'revoked' and name is null and issued_on is null and valid_until is null from public.certificate_check(:'code')), 'revoked: the link still works and says so, without the name or dates');
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails('select revoked_note from public.certificates') and pg_temp.fails('select * from public.certificates') and (select count(*) = 1 from public.certificates where revoked_at is not null), 'N sees their revoked one but never Amr''s note');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok(pg_temp.err(format('select public.certificate_renew(%s)', :cid)) like '%isn''t current%', 'a revoked one can''t be renewed');
select public.certificate_issue(:N::uuid, 'Nadia Hassan') as code2 \gset
select pg_temp.ok(:'code2' <> :'code' and (select count(*) = 2 from public.certificate_list()), 'after revoking, a new one can be issued; both stay on record');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal1');
reset role;
-- Amr with an authenticator must use it (course_is_admin)
insert into auth.mfa_factors (user_id, status) values (:O::uuid, 'verified');
set role authenticated; select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails($$select public.certificate_issue('00000000-0000-0000-0000-000000000006', 'Nadia Hassan')$$), 'Amr without his authenticator code can''t issue');
reset role;
delete from auth.mfa_factors where user_id = :O::uuid;
delete from public.certificates; delete from public.hub_uploads; delete from public.course_attempts; delete from public.course_submissions; delete from public.notifications;
