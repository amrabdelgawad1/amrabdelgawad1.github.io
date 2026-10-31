-- Phase 1: notifications (runs after test-deal-dates.sql). Every check prints "ok" or stops with "FAIL".
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
\set F '''00000000-0000-0000-0000-000000000005'''
select salt as ts from public.deal_team \gset
delete from public.notifications;

set role authenticated;
-- access requests
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok(public.request_course_access('mkt') = 'sent', 'a rep asks for the Marketing course');
select pg_temp.ok(public.request_course_access('mkt') = 'already', 'asking again the same day doesn''t send a second one');
select pg_temp.ok(pg_temp.fails($$select public.request_course_access('nope')$$), 'only real courses');
select pg_temp.ok((select count(*) from public.notifications) = 0, 'the rep can''t read Amr''s notifications');
select pg_temp.ok(pg_temp.fails($$insert into public.notifications (user_id, kind, title) values ('00000000-0000-0000-0000-00000000000a', 'feedback', 'fake')$$), 'nobody can write a notification by hand');
select pg_temp.ok(pg_temp.fails($$select public.notify('00000000-0000-0000-0000-00000000000a', 'feedback', 'fake', null, null)$$), 'or call the notify function');
select pg_temp.as_user(:F::uuid, 'f@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails($$select public.request_course_access('mkt')$$), 'someone turned off can''t ask');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select count(*) = 1 and bool_and(kind = 'access_request' and title = 'New N asks for the Marketing course' and link = '/app/#people/00000000-0000-0000-0000-000000000006') from public.notifications), 'Amr gets it, with a link to that person');

-- missed-shift requests, both ways
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :N, 'role', 'authenticated')::text, false);
insert into public.shift_requests (user_id, name, shift_date, status) values (:N, 'New N', current_date - 1, 'pending');
select pg_temp.ok((select count(*) from public.notifications where user_id = :O::uuid and kind = 'shift_request' and title = 'Missed-shift request from New N') = 1, 'a missed-shift request tells Amr');
select set_config('request.jwt.claims', json_build_object('sub', :O, 'role', 'authenticated')::text, false);
update public.shift_requests set status = 'rejected', reason = 'No proof of the shift' where user_id = :N and status = 'pending' and shift_date = current_date - 1;
select pg_temp.ok((select count(*) from public.notifications where user_id = :N::uuid and kind = 'shift_decided' and title like 'Your missed shift for % was declined' and body = 'No proof of the shift') = 1, 'the rep hears it was declined, with the reason');

-- recordings: sent and reviewed
select set_config('request.jwt.claims', json_build_object('sub', :A, 'role', 'authenticated')::text, false);
insert into public.hub_uploads (user_id, course, title, kind, path, mime) values (:A, 'acq', 'Module 3 call', 'recording', 'test/n1.webm', 'audio/webm');
select pg_temp.ok((select count(*) from public.notifications where user_id = :O::uuid and kind = 'review_sent' and title = 'Agent A sent a recording to review' and body = 'Acquisitions · Module 3 call') = 1, 'a recording sent to review tells Amr');
select set_config('request.jwt.claims', json_build_object('sub', :O, 'role', 'authenticated')::text, false);
update public.hub_uploads set status = 'approved' where path = 'test/n1.webm';
select pg_temp.ok((select count(*) from public.notifications where user_id = :A::uuid and kind = 'review_done' and title = 'Your recording was reviewed: approved' and link = '/course/') = 1, 'the learner hears it was approved');

-- written drills
select set_config('request.jwt.claims', json_build_object('sub', :A, 'role', 'authenticated')::text, false);
insert into public.course_submissions (user_id, module_id, item_id, status, submitted_at) values (:A, 'm4', 'd1', 'submitted', now());
select pg_temp.ok((select count(*) from public.notifications where user_id = :O::uuid and title = 'Agent A sent a written drill' and body = 'Acquisitions · m4') = 1, 'a written drill tells Amr');
select set_config('request.jwt.claims', json_build_object('sub', :O, 'role', 'authenticated')::text, false);
update public.course_submissions set status = 'needs_changes' where user_id = :A and module_id = 'm4';
select pg_temp.ok((select count(*) from public.notifications where user_id = :A::uuid and title = 'Your written drill was sent back for changes') = 1, 'the learner hears it needs changes');

-- a rep's deal changing stage: kind, county and state only
select set_config('request.jwt.claims', json_build_object('sub', :N, 'role', 'authenticated')::text, false);
insert into public.deals (id, owner, kind, state, county, stage, enc) values ('d-nt', :N, 'land', 'OH', 'ross county', 'lead', jsonb_build_object('v', 2, 'salt', :'ts', 'iv', 'i-nt', 'ct', 'SECRET SELLER'));
update public.deals set stage = 'contract' where id = 'd-nt';
select pg_temp.ok((select count(*) from public.notifications where user_id = :O::uuid and kind = 'deal_stage' and title = 'New N''s land deal moved to Under contract' and body = 'Ross, OH' and link = '/app/deals/#id=d-nt') = 1, 'a rep''s deal moving to Under contract tells Amr: kind, county and state');
select pg_temp.ok((select count(*) from public.notifications where title like '%SECRET%' or body like '%SECRET%') = 0, 'nothing encrypted ever shows in a notification');
select pg_temp.ok((select count(*) from public.notifications where kind = 'deal_stage' and user_id = :O::uuid) = 1, 'a brand-new deal doesn''t notify, only the stage change');
-- clearing a result must never block the rep's save
select set_config('request.jwt.claims', json_build_object('sub', :N, 'role', 'authenticated')::text, false);
update public.deals set result = 'sold', paid = 1000, sold = 2000 where id = 'd-nt';
update public.deals set result = null, stage = 'contract' where id = 'd-nt';
select pg_temp.ok((select result is null and stage = 'contract' from public.deals where id = 'd-nt'), 'clearing a deal''s result saves (no notification gets in the way)');
select pg_temp.ok((select count(*) from public.notifications where user_id = :O::uuid and kind = 'deal_stage' and title like '%sold%') = 1, 'the sale itself still told Amr');
-- a background job (nobody signed in) changing Amr's own deal still doesn't notify Amr
reset role;
select set_config('request.jwt.claims', '{}', false);
insert into public.deals (id, owner, kind, state, stage, enc) values ('d-bg', :O, 'land', 'TX', 'lead', jsonb_build_object('v', 2, 'salt', :'ts', 'iv', 'i-bg', 'ct', 'x'));
update public.deals set stage = 'talking' where id = 'd-bg';
select pg_temp.ok((select count(*) from public.notifications where link = '/app/deals/#id=d-bg') = 0, 'a background change to Amr''s own deal doesn''t notify him');
-- Amr's own deal: he doesn't notify himself
select set_config('request.jwt.claims', json_build_object('sub', :O, 'role', 'authenticated')::text, false);
insert into public.deals (id, owner, kind, state, stage, enc) values ('d-no', :O, 'house', 'FL', 'lead', jsonb_build_object('v', 2, 'salt', :'ts', 'iv', 'i-no', 'ct', 'x'));
update public.deals set stage = 'offer' where id = 'd-no';
select pg_temp.ok((select count(*) from public.notifications where link = '/app/deals/#id=d-no') = 0, 'Amr''s own actions never notify Amr');

-- problems and ideas
select set_config('request.jwt.claims', json_build_object('sub', :M, 'role', 'authenticated')::text, false);
insert into public.feedback (user_id, kind, page, message) values (:M, 'problem', '/app/', 'The clock button is stuck');
select pg_temp.ok((select count(*) from public.notifications where user_id = :O::uuid and kind = 'feedback' and title = 'Problem reported by Manager M' and body = 'The clock button is stuck') = 1, 'a problem report tells Amr');

-- reading and marking
set role authenticated;
select pg_temp.as_user(:A::uuid, 'a@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.notifications) = 2 and (select count(*) from public.notifications where read_at is null) = 2, 'a learner sees only their own two');
update public.notifications set read_at = now() where id = (select min(id) from public.notifications);
select pg_temp.ok((select count(*) from public.notifications where read_at is null) = 1, 'and can mark one read');
select pg_temp.ok(pg_temp.fails($$update public.notifications set title = 'changed'$$), 'but can''t change what it says');
select pg_temp.ok(pg_temp.fails($$delete from public.notifications$$) or (select count(*) from public.notifications) = 2, 'or delete them');
select public.notifications_read_all() as marked \gset
select pg_temp.ok(:marked = 1 and (select count(*) from public.notifications where read_at is null) = 0, 'Mark all read');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.notifications where read_at is not null) = 0, 'marking theirs read doesn''t touch Amr''s');
reset role;
set role anon;
select set_config('request.jwt.claims', '{}', false);
select pg_temp.ok(pg_temp.fails('select count(*) from public.notifications') and pg_temp.fails($$select public.request_course_access('mkt')$$), 'not signed in: nothing');
reset role;
delete from public.deals where id in ('d-nt', 'd-no', 'd-bg');
