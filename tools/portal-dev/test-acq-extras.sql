-- Acquisitions extras: daily drill, most-missed questions, fast track, real calls in lessons (runs after
-- test-certificates.sql). Every check prints "ok" or stops with "FAIL".
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

-- A two-lesson Module 1 (7 questions, one of them a typed one that the drill skips), a checkpoint, and an empty Module 2
delete from public.course_modules where id in ('m1', 'm2');
insert into public.course_modules (id, number, content) values
('m1', 1, $j${"title":"One","items":[
 {"id":"1.1","type":"lesson","title":"L1","bodyMarkdown":"x","quiz":{"passMark":80,"questions":[
   {"id":"q1","type":"single","prompt":"P1","explanation":"E1","options":[{"id":"A","text":"a","correct":true},{"id":"B","text":"b","correct":false}]},
   {"id":"q2","type":"single","prompt":"P2","explanation":"E2","options":[{"id":"A","text":"a","correct":false},{"id":"B","text":"b","correct":true}]},
   {"id":"q3","type":"multiple","prompt":"P3","explanation":"E3","options":[{"id":"A","text":"a","correct":true},{"id":"B","text":"b","correct":true},{"id":"C","text":"c","correct":false}]},
   {"id":"q4","type":"text","prompt":"P4","explanation":"E4","options":[]}]}},
 {"id":"1.2","type":"lesson","title":"L2","bodyMarkdown":"x","quiz":{"passMark":80,"questions":[
   {"id":"q5","type":"single","prompt":"P5","explanation":"E5","options":[{"id":"A","text":"a","correct":true},{"id":"B","text":"b","correct":false}]},
   {"id":"q6","type":"single","prompt":"P6","explanation":"E6","options":[{"id":"A","text":"a","correct":true},{"id":"B","text":"b","correct":false}]},
   {"id":"q7","type":"single","prompt":"P7","explanation":"E7","options":[{"id":"A","text":"a","correct":true},{"id":"B","text":"b","correct":false}]}]}},
 {"id":"1.assignment","type":"assignment","title":"D"},
 {"id":"1.checkpoint","type":"checkpoint","title":"C","quiz":{"passMark":85,"questions":[]}}]}$j$),
('m2', 2, '{"title":"Two","items":[]}');
delete from public.course_attempts; delete from public.course_submissions; delete from public.course_drill_days; delete from public.course_fast_track;

set role authenticated;
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok((select jsonb_array_length(public.course_drill_today() -> 'questions') = 0 and not (public.course_drill_today() ->> 'done')::boolean), 'no lesson quiz passed yet: no drill questions');
reset role;
-- N passed lesson 1.1 (first try missed q2) and 1.2; A missed q2 on a first try too, then passed
insert into public.course_attempts (user_id, module_id, item_id, total, pass_mark, correct, score, passed, finished_at, answers) values
 (:N::uuid, 'm1', '1.1', 4, 80, 3, 75, false, now() - interval '3 days', '{"q1":{"right":true},"q2":{"right":false},"q3":{"right":true}}'),
 (:N::uuid, 'm1', '1.1', 4, 80, 4, 100, true, now() - interval '2 days', '{"q1":{"right":true},"q2":{"right":true},"q3":{"right":true}}'),
 (:N::uuid, 'm1', '1.2', 3, 80, 3, 100, true, now() - interval '2 days', '{"q5":{"right":true},"q6":{"right":true},"q7":{"right":true}}'),
 (:A::uuid, 'm1', '1.1', 4, 80, 2, 50, false, now() - interval '1 day', '{"q1":{"right":true},"q2":{"right":false},"q3":{"right":false}}'),
 (:A::uuid, 'm1', '1.1', 4, 80, 4, 100, true, now(), '{"q1":{"right":true},"q2":{"right":true},"q3":{"right":true}}');
update public.members set access = array_append(access, 'course') where user_id = :A::uuid and not ('course' = any(access));
-- yesterday and the day before already drilled
insert into public.course_drill_days (user_id, day, total, correct) values
 (:N::uuid, (now() at time zone 'Africa/Cairo')::date - 1, 5, 4), (:N::uuid, (now() at time zone 'Africa/Cairo')::date - 2, 5, 5), (:N::uuid, (now() at time zone 'Africa/Cairo')::date - 4, 5, 5);

set role authenticated;
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select public.course_drill_today() as d \gset
select pg_temp.ok(jsonb_array_length((:'d')::jsonb -> 'questions') = 5 and ((:'d')::jsonb ->> 'streak')::int = 2, 'five questions from lessons passed before today, keyed module/lesson/question, typed ones skipped; streak 2');
select pg_temp.ok(position('correct' in (:'d')::jsonb::text) = 0 and position('explanation' in (:'d')::jsonb::text) = 0, 'no right answers or explanations are sent with the questions');
select pg_temp.ok(public.course_drill_today() -> 'questions' = (:'d')::jsonb -> 'questions', 'the same five all day');
select pg_temp.ok(pg_temp.fails($$select public.course_drill_submit('{"q1":["A"]}')$$), 'all five must be answered');
-- answer every question with "A": q1, q5, q6, q7 right; q2 and q3 (if picked) wrong
select public.course_drill_submit((select jsonb_object_agg(q ->> 'id', '["A"]'::jsonb) from jsonb_array_elements((:'d')::jsonb -> 'questions') q)) as r \gset
select pg_temp.ok(((:'r')::jsonb ->> 'total')::int = 5 and ((:'r')::jsonb ->> 'streak')::int = 3
  and ((:'r')::jsonb ->> 'correct')::int = (select count(*) from jsonb_array_elements((:'d')::jsonb -> 'questions') q where split_part(q ->> 'id', '/', 3) in ('q1', 'q5', 'q6', 'q7') and q ->> 'id' like 'm1/1._/q_'),
  'graded in the database; the streak goes to 3');
select pg_temp.ok(position('"correct": true' in (:'r')::text) = 0 and (select bool_and(x ? 'explanation') from jsonb_array_elements((:'r')::jsonb -> 'results') x), 'results give right or wrong and the explanation, never the right option');
select pg_temp.ok((public.course_drill_today() ->> 'done')::boolean and jsonb_array_length(public.course_drill_today() -> 'questions') = 0, 'done for today');
select pg_temp.ok(pg_temp.fails(format('select public.course_drill_submit(%L::jsonb)', (select jsonb_object_agg(q ->> 'id', '["B"]'::jsonb) from jsonb_array_elements((:'d')::jsonb -> 'questions') q)))
  and (select count(*) = 1 and min(correct) = ((:'r')::jsonb ->> 'correct')::int from public.course_drill_days where user_id = :N::uuid and day = (now() at time zone 'Africa/Cairo')::date), 'once done, a second try is refused, so other options can''t reveal the right one');
select pg_temp.ok(pg_temp.fails('insert into public.course_drill_days (user_id, day, total, correct) values (''00000000-0000-0000-0000-000000000006'', current_date + 1, 5, 5)'), 'no one writes drill days directly');
select pg_temp.ok((select count(*) = 0 from public.course_drill_days where user_id = :A::uuid) and pg_temp.fails('select * from public.course_missed_questions()'), 'N sees only their own days and can''t see most-missed');

-- most-missed: first tries only
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select missed = 2 and tries = 2 and prompt = 'P2' from public.course_missed_questions(2) where question_id = 'q2')
  and (select missed = 1 from public.course_missed_questions(2) where question_id = 'q3')
  and not exists (select 1 from public.course_missed_questions(2) where question_id = 'q1'), 'most-missed counts each learner''s first try: q2 missed 2 of 2, q3 1 of 2, q1 never');

-- fast track
select pg_temp.as_user(:A::uuid, 'a@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails($$select public.course_fast_track_set('00000000-0000-0000-0000-000000000001', true)$$), 'a learner can''t fast-track themselves');
reset role; select pg_temp.ok(not public.course_checkpoint_open(:A::uuid, 'm1'), 'without it, A''s Module 1 checkpoint is shut (no drill sent)'); set role authenticated;
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select public.course_fast_track_set(:A::uuid, true);
reset role; select pg_temp.ok(public.course_checkpoint_open(:A::uuid, 'm1') and public.course_checkpoint_open(:A::uuid, 'm4'), 'Amr turns on the fast track: checkpoints 1 to 4 open'); set role authenticated;
select pg_temp.as_user(:A::uuid, 'a@example.com', 'aal1');
select pg_temp.ok((public.course_drill_today() ->> 'fastTrack')::boolean and jsonb_array_length(public.course_drill_today() -> 'questions') = 0, 'A''s drill card knows about the fast track; A passed only today, so no drill until tomorrow');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select public.course_fast_track_set(:A::uuid, false);
reset role; select pg_temp.ok(not public.course_checkpoint_open(:A::uuid, 'm1'), 'and off again');

-- real calls in lessons
delete from public.library_examples; delete from public.library_entries; delete from public.hub_uploads;
insert into public.library_entries (kind, section, title, body, lessons) values ('objection', 'Price', 'Too low', 'Say this', '{10.2,10.1}'), ('script', 'Open', 'Opener', 'Hi', '{5.1}');
insert into public.hub_uploads (id, user_id, course, title, kind, path, mime, status, score, real_call, consent) values
 ('00000000-0000-0000-0000-0000000000c1', :N::uuid, 'calls', 'Great', 'recording', '00000000-0000-0000-0000-000000000006/calls/g.m4a', 'audio/mp4', 'approved', '{"cats":[5,5,5,5,5,4,4,4,4,5],"total":46}', true, true);
insert into public.library_examples (entry_id, upload_id) select id, '00000000-0000-0000-0000-0000000000c1' from public.library_entries where title = 'Too low';
select pg_temp.ok(pg_temp.fails($$insert into public.library_entries (kind, title, lessons) values ('script', 'Bad', '{ten}')$$), 'lessons must look like 10.2');
update public.library_entries set lessons = '{1.2}' where title = 'Opener';
set role authenticated;
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select count(*) = 1 and min(title) = 'Too low' and min(jsonb_array_length(calls)) = 1 from public.library_for_lesson('10.2')), 'Lesson 10.2 shows its entry and the 46 call');
select pg_temp.ok((select count(*) = 1 from public.library_for_lesson('1.2.s2')), 'an entry linked to 1.2 also shows on its sub-lesson 1.2.s2');
select pg_temp.as_user(:A::uuid, 'a@example.com', 'aal1');
select pg_temp.ok((select count(*) = 0 from public.library_for_lesson('10.2')), 'someone who can''t read the library sees nothing (no error)');
reset role;
delete from public.library_examples; delete from public.library_entries; delete from public.hub_uploads;
delete from public.course_attempts; delete from public.course_drill_days; delete from public.course_fast_track; delete from public.course_modules where id in ('m1', 'm2');
