-- Phase 2: commissions (runs after test-deal-folder.sql). Every check prints "ok" or stops with "FAIL".
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
select salt as ts from public.deal_team \gset
select set_config('x.ts', :'ts', false);
delete from public.notifications;

set role authenticated;
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
insert into public.deals (id, kind, state, county, stage, enc) values
  ('d-c1', 'land', 'OH', 'ross', 'contract', jsonb_build_object('v', 2, 'salt', :'ts', 'iv', 'i-c1', 'ct', 'x')),
  ('d-c2', 'house', 'OH', 'pike', 'closed', jsonb_build_object('v', 2, 'salt', :'ts', 'iv', 'i-c2', 'ct', 'x'));

-- only Amr
select pg_temp.ok(pg_temp.fails($$insert into public.commissions (deal_id, user_id, amount) values ('d-c2', '00000000-0000-0000-0000-000000000006', 500)$$), 'a rep can''t add a commission, even for themselves');
select pg_temp.ok(pg_temp.err($$insert into public.commissions (deal_id, user_id, amount) values ('no-such-deal', '00000000-0000-0000-0000-000000000006', 500)$$) = 'Not allowed'
  and pg_temp.err($$insert into public.commissions (deal_id, user_id, amount) values ('d-c1', '00000000-0000-0000-0000-000000000006', 500)$$) = 'Not allowed', 'and the refusal says nothing about which deals exist or their stage');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal2');
select pg_temp.ok(pg_temp.fails($$insert into public.commissions (deal_id, user_id, amount) values ('d-c2', '00000000-0000-0000-0000-000000000006', 500)$$), 'neither can a manager');
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal1');
select pg_temp.ok(pg_temp.fails($$insert into public.commissions (deal_id, user_id, amount) values ('d-c2', '00000000-0000-0000-0000-000000000006', 500)$$), 'Amr without the authenticator code can''t either');

select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
-- only on a closed deal
select pg_temp.ok(pg_temp.err($$insert into public.commissions (deal_id, user_id, amount) values ('d-c1', '00000000-0000-0000-0000-000000000006', 500)$$) like '%once the deal is closed%', 'a deal under contract can''t get a commission yet');
select pg_temp.ok(pg_temp.err($$insert into public.commissions (deal_id, user_id, amount) values ('no-such-deal', '00000000-0000-0000-0000-000000000006', 500)$$) like '%Save the deal first%', 'nor a deal that isn''t saved');
select pg_temp.ok(pg_temp.err($$insert into public.commissions (deal_id, user_id) values ('d-c2', '00000000-0000-0000-0000-000000000006')$$) like '%Enter the commission%', 'no amount and no profit with a percentage: refused');
select pg_temp.ok(pg_temp.err($$insert into public.commissions (deal_id, user_id, amount) values ('d-c2', '00000000-0000-0000-0000-000000000099', 500)$$) <> '', 'only someone on the team');
-- profit and percentage
insert into public.commissions (deal_id, user_id, profit, percent, note) values ('d-c2', :N::uuid, 12345, 10, 'split with nobody');
select pg_temp.ok((select amount = 1234.50 and status = 'owed' and paid_on is null and deal_label = 'House, Pike, OH' from public.commissions where deal_id = 'd-c2'), 'profit $12,345 at 10%: $1,234.50 owed, labelled House, Pike, OH');
select pg_temp.ok((select c.kind = 'expense' and c.category = 'Commissions' and c.amount = 1234.50 and not c.settled and c.title = 'Commission: New N' and c.note = 'House, Pike, OH · split with nobody'
  from public.commissions k join public.cash_entries c on c.id = k.cash_entry_id where k.deal_id = 'd-c2'), 'it is in Cash as an unpaid expense, Commissions');
select pg_temp.ok(pg_temp.fails($$insert into public.commissions (deal_id, user_id, amount) values ('d-c2', '00000000-0000-0000-0000-000000000006', 50)$$), 'one commission per rep per deal');
-- the commission typed directly wins over profit and percentage; a second rep on the same deal
insert into public.commissions (deal_id, user_id, profit, percent, amount) values ('d-c2', :M::uuid, 12345, 10, 300);
select pg_temp.ok((select amount = 300 from public.commissions where deal_id = 'd-c2' and user_id = :M::uuid), 'a typed commission is kept as typed');
select pg_temp.ok(pg_temp.fails($$update public.commissions set user_id = '00000000-0000-0000-0000-000000000001' where deal_id = 'd-c2' and amount = 300$$), 'the rep and the deal can''t be changed afterwards');

-- paid
update public.commissions set status = 'paid' where deal_id = 'd-c2' and user_id = :N::uuid;
select pg_temp.ok((select paid_on = (now() at time zone 'Africa/Cairo')::date from public.commissions where deal_id = 'd-c2' and user_id = :N::uuid), 'marking it paid sets today as the paid date');
select pg_temp.ok((select c.settled and c.settled_at is not null and c.entry_date = k.paid_on from public.commissions k join public.cash_entries c on c.id = k.cash_entry_id where k.deal_id = 'd-c2' and k.user_id = :N::uuid), 'and Cash shows it paid');
update public.commissions set amount = 1300 where deal_id = 'd-c2' and user_id = :N::uuid;
select pg_temp.ok((select c.amount = 1300 from public.commissions k join public.cash_entries c on c.id = k.cash_entry_id where k.deal_id = 'd-c2' and k.user_id = :N::uuid), 'changing the amount changes it in Cash');
-- from Cash: untick and tick
update public.cash_entries set settled = false, settled_at = null where id = (select cash_entry_id from public.commissions where deal_id = 'd-c2' and user_id = :N::uuid);
select pg_temp.ok((select status = 'owed' and paid_on is null from public.commissions where deal_id = 'd-c2' and user_id = :N::uuid), 'unticking it in Cash marks the commission owed again');
update public.cash_entries set settled = true, settled_at = '2026-10-20 10:00+02' where id = (select cash_entry_id from public.commissions where deal_id = 'd-c2' and user_id = :N::uuid);
select pg_temp.ok((select status = 'paid' and paid_on = '2026-10-20' from public.commissions where deal_id = 'd-c2' and user_id = :N::uuid), 'ticking it paid in Cash marks the commission paid that day');
select pg_temp.ok(pg_temp.err($$delete from public.cash_entries where category = 'Commissions'$$) like '%Remove it in the Deal CRM%', 'a commission''s Cash line can''t be deleted from Cash');
select pg_temp.ok(pg_temp.err($$update public.cash_entries set amount = 450 where category = 'Commissions'$$) like '%only tick it paid%', 'nor its amount changed there');
select pg_temp.ok(pg_temp.fails($$update public.cash_entries set recurring = true where category = 'Commissions'$$) and pg_temp.fails($$update public.cash_entries set entry_date = '2026-01-01' where category = 'Commissions'$$)
  and pg_temp.fails($$update public.cash_entries set kind = 'income' where category = 'Commissions'$$), 'nor made monthly, moved to another day, or turned into income');
update public.cash_entries set title = 'Commission: N, Pike house' where id = (select cash_entry_id from public.commissions where deal_id = 'd-c2' and user_id = :N::uuid);
select pg_temp.ok((select title = 'Commission: N, Pike house' from public.cash_entries where id = (select cash_entry_id from public.commissions where deal_id = 'd-c2' and user_id = :N::uuid)), 'its title can still be reworded in Cash');
update public.commissions set profit = 20000 where deal_id = 'd-c2' and user_id = :M::uuid;
select pg_temp.ok((select amount = 2000 and profit = 20000 and percent = 10 from public.commissions where deal_id = 'd-c2' and user_id = :M::uuid), 'changing the profit works the commission out again (10% of $20,000)');
update public.commissions set amount = 300 where deal_id = 'd-c2' and user_id = :M::uuid;
select pg_temp.ok((select count(*) from public.cash_entries where category = 'Commissions') = 2, 'both lines are still there');
select pg_temp.ok(pg_temp.fails($$update public.commissions set paid_on = '2099-01-01' where deal_id = 'd-c2' and user_id = '00000000-0000-0000-0000-000000000006'$$), 'no paid date in the future');

-- what the rep sees
select pg_temp.as_user(:N::uuid, 'n@example.com', 'aal1');
select pg_temp.ok((select count(*) from public.commissions) = 0, 'a rep can''t read the commissions table');
select pg_temp.ok((select count(*) = 1 and bool_and(amount = 1300 and status = 'paid' and deal_label = 'House, Pike, OH') from public.portal_my_commissions()), 'their own commission, through portal_my_commissions');
select pg_temp.ok((select count(*) from public.cash_entries) = 0, 'and nothing in Cash');
select pg_temp.ok((select string_agg(title, ' | ' order by id) from public.notifications) = 'Commission added: $1,234.50 | Your commission of $1,234.50 was paid | Your commission of $1,300.00 was paid',
  'they were told: added, paid, and paid again after it was unticked and ticked in Cash');
select pg_temp.ok(not exists (select 1 from public.notifications where body ~ '12345|10%|profit'), 'the notifications never mention the profit or the percentage');
select pg_temp.as_user(:M::uuid, 'm@example.com', 'aal2');
select pg_temp.ok((select count(*) = 1 and bool_and(amount = 300 and status = 'owed') from public.portal_my_commissions()), 'the other rep sees only theirs');

-- removing
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
delete from public.commissions where deal_id = 'd-c2' and user_id = :M::uuid;
select pg_temp.ok((select count(*) from public.cash_entries where category = 'Commissions') = 1, 'removing a commission removes its Cash line');
select (select entry_date from public.cash_entries where id = (select cash_entry_id from public.commissions where user_id = :N::uuid)) as cday \gset
reset role;
delete from public.deals where id = 'd-c2';
select pg_temp.ok((select deal_id is null and deal_label = 'House, Pike, OH' and amount = 1300 from public.commissions where user_id = :N::uuid), 'a removed deal keeps its commission (money history), with its label');
select pg_temp.ok((select entry_date = :'cday'::date and title = 'Commission: N, Pike house' from public.cash_entries where id = (select cash_entry_id from public.commissions where user_id = :N::uuid)), 'and its Cash line keeps its day and title');
-- a rep's account removed: their commission and its Cash line stay
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'e1@example.com');
insert into public.members (user_id, name, email, active, access) values ('00000000-0000-0000-0000-0000000000e1', 'Gone G', 'e1@example.com', true, '{}');
insert into public.deals (id, kind, state, county, stage, owner, enc) values ('d-c3', 'land', 'OH', 'vinton', 'closed', '00000000-0000-0000-0000-0000000000e1', jsonb_build_object('v', 2, 'salt', :'ts', 'iv', 'i-c3', 'ct', 'x'));
set role authenticated;
select pg_temp.as_user(:O::uuid, 'owner@example.com', 'aal2');
insert into public.commissions (deal_id, user_id, amount, status) values ('d-c3', '00000000-0000-0000-0000-0000000000e1', 400, 'paid');
reset role;
delete from public.members where user_id = '00000000-0000-0000-0000-0000000000e1';
delete from public.deals where id = 'd-c3';
delete from auth.users where id = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.ok((select user_id is null and rep_name = 'Gone G' and amount = 400 and status = 'paid' from public.commissions where deal_label = 'Land, Vinton, OH')
  and (select settled and amount = 400 and title = 'Commission: Gone G' from public.cash_entries where id = (select cash_entry_id from public.commissions where deal_label = 'Land, Vinton, OH')), 'a removed account keeps its paid commission and its Cash line (the books don''t change)');
delete from public.commissions; delete from public.cash_entries where category = 'Commissions'; delete from public.deals where id = 'd-c1'; delete from public.notifications;
