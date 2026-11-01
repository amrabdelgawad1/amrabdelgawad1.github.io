-- Phase 3: script and objection library (runs after test-onboarding.sql). Every check prints "ok" or stops with "FAIL".
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
\set X '''00000000-0000-0000-0000-000000000002'''
\set N '''00000000-0000-0000-0000-000000000006'''
\set M '''00000000-0000-0000-0000-000000000007'''
delete from public.hub_uploads;

set role authenticated;
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails($$insert into public.library_entries (kind, title) values ('objection', 'x')$$), 'a rep can''t write the library');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
insert into public.library_entries (kind, section, title, body, why, why_ar, state_notes, parts, version) values
  ('objection', 'Price', 'Your offer is too low', 'I hear you. What number would work for you?', 'Gets their number first.', 'شرح', '[{"state":"oh","note":"Ohio sellers expect the auditor value."},{"state":"bad state","note":"x"},{"state":"NC","note":""}]', '{8,6,8}', 9),
  ('script', 'Opening', 'First call opener', 'Hi, this is ...', '', '', '[]', '{1}', 1),
  ('objection', 'Old', 'Turned off one', 'x', '', '', '[]', '{}', 1);
update public.library_entries set active = false where title = 'Turned off one';
select id as e1 from public.library_entries where title = 'Your offer is too low' \gset
select pg_temp.ok((select version = 1 and parts = '{6,8}' and state_notes = '[{"note": "Ohio sellers expect the auditor value.", "state": "OH"}]'::jsonb from public.library_entries where id = :e1),
  'Amr adds entries: version starts at 1, scorecard parts sorted, only real state notes kept');
update public.library_entries set why = 'Better why.' where id = :e1;
select pg_temp.ok((select version = 1 from public.library_entries where id = :e1), 'changing only the why keeps the version');
update public.library_entries set body = 'I hear you. If the price worked, would anything else stop us?' where id = :e1;
select pg_temp.ok((select version = 2 from public.library_entries where id = :e1) and (select body = 'I hear you. What number would work for you?' from public.library_versions where entry_id = :e1 and version = 1),
  'changing the wording raises the version and keeps the old wording');

select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.library_entries) = 2, 'a rep reads the active entries only');
insert into public.library_reads (entry_id, version, user_id, read_at) values (:e1, 1, '00000000-0000-0000-0000-000000000007', '2001-01-01');
select pg_temp.ok((select user_id = :N::uuid and read_at > now() - interval '1 minute' from public.library_reads), 'a read is always the rep''s own, now');
select pg_temp.ok((select r.version < e.version from public.library_reads r join public.library_entries e on e.id = r.entry_id), 'and it shows the entry was updated since');
insert into public.library_heard (entry_id) values (:e1); insert into public.library_heard (entry_id) values (:e1);
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal1');
insert into public.library_heard (entry_id) values (:e1);
select pg_temp.ok((select heard = 3 and mine = 1 from public.library_heard_counts(30) where entry_id = :e1), 'heard counts: 3 for the team, 1 mine');
select pg_temp.ok((select count(*) from public.library_heard) = 1, 'a person sees only their own taps');
select pg_temp.ok(pg_temp.fails('select * from public.library_heard_counts(3)'), 'only 7, 30 or 90 days');
select pg_temp.as_user(:X::uuid, 'x@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.library_entries) = 0 and pg_temp.fails('select * from public.library_heard_counts(30)'), 'a learner off the calling team sees nothing');

-- examples
reset role;
insert into public.hub_uploads (id, user_id, course, title, kind, path, mime, real_call, consent, status, score) values
  ('11111111-1111-1111-1111-111111111111', :N, 'calls', 'Great call', 'recording', '00000000-0000-0000-0000-000000000006/calls/g.m4a', 'audio/mp4', true, true, 'approved', '{"cats":[5,5,5,5,5,5,5,4,4,4],"total":47}'),
  ('22222222-2222-2222-2222-222222222222', :N, 'calls', 'OK call', 'recording', '00000000-0000-0000-0000-000000000006/calls/k.m4a', 'audio/mp4', true, true, 'approved', '{"cats":[4,4,4,4,4,4,4,4,4,4],"total":40}');
insert into storage.objects (bucket_id, name) values ('hub-uploads', '00000000-0000-0000-0000-000000000006/calls/g.m4a'), ('hub-uploads', '00000000-0000-0000-0000-000000000006/calls/k.m4a');
set role authenticated;
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok(pg_temp.err(format($$insert into public.library_examples (entry_id, upload_id) values (%s, '22222222-2222-2222-2222-222222222222')$$, :e1)) like '%45 or more%', 'a call under 45 can''t be an example');
insert into public.library_examples (entry_id, upload_id) values (:e1, '11111111-1111-1111-1111-111111111111');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal1');
select pg_temp.ok((select count(*) = 1 and bool_and(total = 47 and rep = 'New') from public.library_example_calls()), 'the team sees the example: 47, by the rep''s first name');
select pg_temp.ok((select count(*) from storage.objects where bucket_id = 'hub-uploads') = 1 and (select name from storage.objects where bucket_id = 'hub-uploads') like '%/g.m4a', 'and can play that recording, and no other');
reset role;
delete from public.library_examples; delete from public.hub_uploads; delete from storage.objects where bucket_id = 'hub-uploads';
delete from public.library_heard; delete from public.library_reads; delete from public.library_entries;
