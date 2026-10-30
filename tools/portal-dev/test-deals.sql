-- Round 7 checks: the Deal CRM as a team and the weekly board, after supabase/migrations/20261030160000_portal_deals_team.sql.
-- Runs after test-roles.sql in test-roles.sh (same people: Amr O, agents A and N, manager M, F switched off).
-- N and M have Deal tools through their role; A doesn't. Every check prints "ok" or stops with "FAIL".
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
\set A '''00000000-0000-0000-0000-000000000001'''
\set N '''00000000-0000-0000-0000-000000000006'''
\set M '''00000000-0000-0000-0000-000000000007'''
select pg_temp.as_user(null, '', 'aal1');   -- seeding as the database, not as anyone

-- ---------- sample deals: everyone on their own passphrase today ----------
insert into public.deal_logs (user_id, tool, blob) values
 (:O, 'workspace', '{"v":2,"salt":"AMRSALTAMRSALT00","iv":"o1","ct":"amr deals"}'),
 (:O, 'land',      '{"v":2,"salt":"OLDLANDSALTOLD00","iv":"o2","ct":"old land log"}'),
 (:N, 'workspace', '{"v":2,"salt":"NEWSALTNEWSALT00","iv":"n1","ct":"n deals"}'),
 (:M, 'workspace', '{"v":2,"salt":"MGRSALTMGRSALT00","iv":"m1","ct":"m deals"}');
insert into public.deal_followups (user_id, deal_key, due) values (:N, 'd1', current_date), (:N, 'd2', current_date + 3), (:O, 'd9', current_date);

select pg_temp.ok((select user_id from public.portal_owner) = :O::uuid, 'Amr''s id found from the address inside is_tracker_admin()');
select pg_temp.ok((select count(*) from public.deal_logs where user_id is null) = 0, 'every deal row has an owner');

-- ---------- the existing own-row rule is unchanged (the calculators rely on it) ----------
set role authenticated;
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.deal_logs where tool = 'workspace') = 1, 'Amr''s own query by tool still returns exactly his one row');
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.deal_logs) = 1 and (select count(*) from public.deal_followups) = 2, 'an agent still reads only their own rows directly');

-- ---------- who may fetch whose deals (Deal CRM workspaces only) ----------
select pg_temp.ok((select count(*) from public.deal_team_rows(true)) = 1 and (select bool_and(holder = :N::uuid) from public.deal_team_rows(true)), 'agent asking for everyone gets only their own');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.deal_team_rows(true)) = 1, 'manager without the code: only their own');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.deal_team_rows(true)) = 3, 'manager with the code: everyone''s workspaces');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok((select count(*) from public.deal_team_rows(true)) = 3 and (select name from public.deal_team_rows(true) where holder = :N::uuid) = 'New N', 'Amr: everyone''s workspaces, with names');
select pg_temp.ok((select count(*) from public.deal_team_rows(false)) = 1, 'Amr''s own: his workspace, never the calculators'' rows');
select pg_temp.as_user(:A::uuid, 'a@example.com', 'aal2');
select pg_temp.ok(pg_temp.fails('select * from public.deal_team_rows(true)'), 'someone without Deal tools gets nothing');
select pg_temp.ok(public.deal_team_get() is null, 'and can''t read the team salt');

-- ---------- setting the team passphrase ----------
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok(public.deal_team_get() is null, 'no team passphrase yet');
select pg_temp.ok(pg_temp.fails($$select public.deal_team_start('TEAMSALTTEAMSALT', '{"salt":"TEAMSALTTEAMSALT","iv":"c","ct":"c"}')$$), 'an agent can''t set the team passphrase');
select pg_temp.ok(pg_temp.fails($$select public.deal_rekey('[]', 'TEAMSALTTEAMSALT')$$), 'an agent can''t move to a team key before Amr sets one');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok(pg_temp.err($$select public.deal_team_start('TEAMSALTTEAMSALT', '{"salt":"TEAMSALTTEAMSALT","iv":"c","ct":"c"}')$$) like '%Use Change passphrase%', 'Amr has deals on his own passphrase: starting fresh is refused');

-- Amr's first team key: his own workspace is the scope (he can't open the others' personal ones)
select pg_temp.ok(pg_temp.err($$select public.deal_rekey('[]', 'TEAMSALTTEAMSALT', '{"salt":"TEAMSALTTEAMSALT","iv":"c","ct":"c"}')$$) like '%left on the old passphrase%', 'leaving his workspace on the old key is refused');
select pg_temp.ok(public.deal_team_get() is null and (select blob ->> 'iv' from public.deal_logs where user_id = :O::uuid and tool = 'workspace') = 'o1', 'and nothing was saved, not even the team key (no mix)');
select pg_temp.ok(pg_temp.err($$select public.deal_rekey('[{"holder":"00000000-0000-0000-0000-00000000000a","tool":"workspace","old_iv":"STALE","blob":{"salt":"TEAMSALTTEAMSALT","iv":"o1b","ct":"x"}}]', 'TEAMSALTTEAMSALT', '{"salt":"TEAMSALTTEAMSALT","iv":"c","ct":"c"}')$$) like '%changed while you were working%', 'a row changed meanwhile: refused');
select pg_temp.ok(pg_temp.err($$select public.deal_rekey('[{"holder":"00000000-0000-0000-0000-00000000000a","tool":"workspace","old_iv":"o1","blob":{"salt":"OTHERSALTOTHER00","iv":"o1b","ct":"x"}}]', 'TEAMSALTTEAMSALT', '{"salt":"TEAMSALTTEAMSALT","iv":"c","ct":"c"}')$$) like '%new key%', 'a row on the wrong key: refused');
select pg_temp.ok(pg_temp.fails($$select public.deal_rekey('[{"holder":"00000000-0000-0000-0000-00000000000a","tool":"land","old_iv":"o2","blob":{"salt":"TEAMSALTTEAMSALT","iv":"o2b","ct":"x"}},{"holder":"00000000-0000-0000-0000-00000000000a","tool":"workspace","old_iv":"o1","blob":{"salt":"TEAMSALTTEAMSALT","iv":"o1b","ct":"x"}}]', 'TEAMSALTTEAMSALT', '{"salt":"TEAMSALTTEAMSALT","iv":"c","ct":"c"}')$$), 'the calculators'' rows are never touched');
select pg_temp.ok(pg_temp.fails($$select public.deal_rekey('[{"holder":"00000000-0000-0000-0000-000000000007","tool":"workspace","old_iv":"m1","blob":{"salt":"TEAMSALTTEAMSALT","iv":"m1b","ct":"x"}},{"holder":"00000000-0000-0000-0000-00000000000a","tool":"workspace","old_iv":"o1","blob":{"salt":"TEAMSALTTEAMSALT","iv":"o1b","ct":"x"}}]', 'TEAMSALTTEAMSALT', '{"salt":"TEAMSALTTEAMSALT","iv":"c","ct":"c"}')$$), 'Amr can''t overwrite a workspace on someone''s personal passphrase');
select pg_temp.ok(public.deal_rekey('[{"holder":"00000000-0000-0000-0000-00000000000a","tool":"workspace","old_iv":"o1","blob":{"v":2,"salt":"TEAMSALTTEAMSALT","iv":"o1b","ct":"amr deals, team key"}}]',
  'TEAMSALTTEAMSALT', '{"v":2,"salt":"TEAMSALTTEAMSALT","iv":"c","ct":"team check"}') = 1, 'Amr''s workspace moves to the team key');
select pg_temp.ok(public.deal_team_get() ->> 'salt' = 'TEAMSALTTEAMSALT', 'team salt and check saved with it');
reset role;
select pg_temp.ok((select blob ->> 'ct' from public.deal_logs where user_id = :O::uuid and tool = 'land') = 'old land log', 'his calculator row is as it was');
set role authenticated;

-- ---------- agents move themselves onto the team key; the save guard ----------
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok(public.deal_team_get() -> 'check' ->> 'ct' = 'team check', 'a team member reads the team check');
select pg_temp.ok(pg_temp.err($$insert into public.deal_logs (user_id, tool, blob) values ('00000000-0000-0000-0000-000000000006', 'workspace', '{"salt":"NEWSALTNEWSALT00","iv":"n9","ct":"x"}') on conflict (user_id, tool) do update set blob = excluded.blob$$) like '%old passphrase%', 'saving on a personal passphrase is refused now there is a team key');
select pg_temp.ok(pg_temp.err($$select public.deal_rekey('[{"holder":"00000000-0000-0000-0000-000000000006","tool":"workspace","old_iv":"n1","blob":{"salt":"MINEMINEMINE0000","iv":"x","ct":"x"}}]', 'MINEMINEMINE0000')$$) like '%use the team passphrase%', 'an agent can''t move to their own passphrase');
select pg_temp.ok(pg_temp.fails($$select public.deal_rekey('[{"holder":"00000000-0000-0000-0000-000000000007","tool":"workspace","old_iv":"m1","blob":{"salt":"TEAMSALTTEAMSALT","iv":"x","ct":"x"}}]', 'TEAMSALTTEAMSALT')$$), 'an agent can''t rewrite someone else''s row');
select pg_temp.ok(pg_temp.fails($$select public.deal_rekey('[]', 'TEAMSALTTEAMSALT', '{"salt":"TEAMSALTTEAMSALT","iv":"c","ct":"c"}')$$), 'an agent can''t set the team check');
select pg_temp.ok(public.deal_rekey('[{"holder":"00000000-0000-0000-0000-000000000006","tool":"workspace","old_iv":"n1","blob":{"v":2,"salt":"TEAMSALTTEAMSALT","iv":"n1b","ct":"n deals, team key"}}]', 'TEAMSALTTEAMSALT') = 1, 'an agent moves their own workspace to the team key');
select pg_temp.ok(pg_temp.err($$insert into public.deal_logs (user_id, tool, blob) values ('00000000-0000-0000-0000-000000000006', 'workspace', '{"v":2,"salt":"TEAMSALTTEAMSALT","iv":"n1c","ct":"n deals, saved"}') on conflict (user_id, tool) do update set blob = excluded.blob$$) = '', 'and saves normally on it');
select pg_temp.ok((select blob ->> 'iv' from public.deal_logs where tool = 'workspace') = 'n1c', 'the save landed');

-- ---------- Amr changes the team passphrase again: everyone on the team key moves together ----------
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select pg_temp.ok(pg_temp.err($$select public.deal_rekey('[{"holder":"00000000-0000-0000-0000-00000000000a","tool":"workspace","old_iv":"o1b","blob":{"v":2,"salt":"TEAM2SALTTEAM200","iv":"o1c","ct":"x"}}]', 'TEAM2SALTTEAM200', '{"v":2,"salt":"TEAM2SALTTEAM200","iv":"c2","ct":"c2"}')$$) like '%left on the old passphrase%', 'skipping New N''s workspace is refused');
select pg_temp.ok(public.deal_team_get() ->> 'salt' = 'TEAMSALTTEAMSALT', 'the team key stayed as it was');
select pg_temp.ok(public.deal_rekey(
  '[{"holder":"00000000-0000-0000-0000-00000000000a","tool":"workspace","old_iv":"o1b","blob":{"v":2,"salt":"TEAM2SALTTEAM200","iv":"o1c","ct":"amr, key 2"}},
    {"holder":"00000000-0000-0000-0000-000000000006","tool":"workspace","old_iv":"n1c","blob":{"v":2,"salt":"TEAM2SALTTEAM200","iv":"n1d","ct":"n, key 2"}}]',
  'TEAM2SALTTEAM200', '{"v":2,"salt":"TEAM2SALTTEAM200","iv":"c2","ct":"team check 2"}') = 2, 'every workspace on the team key moves in one step');
reset role;
select pg_temp.ok((select count(*) from public.deal_logs where blob ->> 'salt' = 'TEAM2SALTTEAM200') = 2
  and (select blob ->> 'salt' from public.deal_logs where user_id = :M::uuid) = 'MGRSALTMGRSALT00', 'both moved; the manager''s personal one is left for them to move');
set role authenticated;
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok(pg_temp.err($$insert into public.deal_logs (user_id, tool, blob) values ('00000000-0000-0000-0000-000000000006', 'workspace', '{"v":2,"salt":"TEAMSALTTEAMSALT","iv":"n1e","ct":"stale tab"}') on conflict (user_id, tool) do update set blob = excluded.blob$$) like '%old passphrase%', 'a tab still on the old team key can''t write a mix');
reset role;

-- ---------- turning someone off gives their deals to Amr ----------
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
select blob ->> 'ct' as before_ct from public.deal_logs where user_id = :N::uuid and tool = 'workspace' \gset
update public.members set active = false where user_id = :N;
select pg_temp.ok((select count(*) from public.deal_logs where user_id = :N::uuid) = 0, 'their rows left them');
select pg_temp.ok((select blob ->> 'ct' from public.deal_logs where user_id = :O::uuid and tool = 'workspace:' || :N) = :'before_ct', 'Amr holds them, encrypted data unchanged');
select pg_temp.ok((select count(*) from public.deal_followups where user_id = :O::uuid) = 3, 'their follow-up dates moved too');
select pg_temp.ok((select count(*) from public.deal_logs where user_id = :O::uuid and tool = 'workspace') = 1, 'Amr''s own workspace untouched');
set role authenticated;
select pg_temp.ok((select person from public.deal_team_rows(true) where tool = 'workspace:' || :N) = :N::uuid
  and (select name from public.deal_team_rows(true) where tool = 'workspace:' || :N) = 'New N'
  and (select active from public.deal_team_rows(true) where tool = 'workspace:' || :N) is false, 'Amr''s CRM shows them as New N''s deals, turned off');
reset role;
update public.members set active = true where user_id = :N;
select pg_temp.ok((select count(*) from public.deal_logs where user_id = :N::uuid) = 0, 'turning them back on doesn''t move anything back');

-- ---------- the weekly board ----------
select pg_temp.as_user(null, '', 'aal1');
insert into public.shifts (name, owner, user_id, shift_date, dials) values
 ('New N', false, :N, (now() at time zone 'America/New_York')::date, 30), ('New N', false, :N, (now() at time zone 'America/New_York')::date, 10),
 ('New N', false, :N, (now() at time zone 'America/New_York')::date - 10, 99), ('Manager M', false, :M, (now() at time zone 'America/New_York')::date, 5),
 ('Amr', true, :O, (now() at time zone 'America/New_York')::date, 500);
insert into public.course_item_done (user_id, module_id, item_id, done_at) values
 (:N, 'm1', '1.1', now()), (:N, 'm1', '1.2', now()), (:N, 'm1', '1.3', now()), (:N, 'm1', '1.4', now() - interval '10 days');
insert into public.hub_uploads (user_id, course, kind, mime, path, title, created_at) values (:N, 'acq', 'recording', 'audio/webm', 'n/acq/a.webm', 'Call', now()), (:N, 'acq', 'recording', 'audio/webm', 'n/acq/b.webm', 'Old', now() - interval '10 days');
insert into public.course_submissions (user_id, module_id, item_id, status, submitted_at, last_submitted_at) values
 (:N, 'm1', '1.assignment', 'submitted', now(), now()), (:N, 'm2', '2.assignment', 'draft', null, null);
set role authenticated;
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok((select calls from public.portal_team_board() where user_id = :N::uuid) = 40, 'calls logged: this week''s dials only (40)');
select pg_temp.ok((select lessons from public.portal_team_board() where user_id = :N::uuid) = 3, 'lessons passed this week (3)');
select pg_temp.ok((select drills from public.portal_team_board() where user_id = :N::uuid) = 2, 'drills sent this week: 1 recording + 1 written drill, drafts don''t count');
select pg_temp.ok((select is_me from public.portal_team_board() where user_id = :N::uuid) and not (select is_me from public.portal_team_board() where user_id = :M::uuid), 'the board marks "you"');
select pg_temp.ok((select count(*) from public.portal_team_board()) = 6 and not exists (select 1 from public.portal_team_board() where user_id = :O::uuid), 'active team members only, not Amr''s own shifts');
select pg_temp.ok((select string_agg(parameter_name, ',' order by ordinal_position) from information_schema.parameters p join information_schema.routines r using (specific_name)
        where r.routine_name = 'portal_team_board' and p.parameter_mode = 'OUT') = 'user_id,name,calls,lessons,drills,is_me', 'the board returns effort only: no hours, pay or deal money');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal1');
select pg_temp.ok((select calls from public.portal_team_board() where user_id = :M::uuid) = 5, 'a manager sees the same board');
reset role;
