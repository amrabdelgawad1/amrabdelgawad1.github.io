-- Fix: clocking out clears Live now, and the same shift is never saved twice (runs after test-eod.sql).
\set ON_ERROR_STOP on
set client_min_messages = notice;
create or replace function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return ''; exception when others then return sqlerrm; end $$;
create or replace function pg_temp.ok(p boolean, p_label text) returns void language plpgsql as $$
begin if p is not true then raise exception 'FAIL: %', p_label; end if; raise notice 'ok   %', p_label; end $$;
\set A '''00000000-0000-0000-0000-000000000001'''
\set N '''00000000-0000-0000-0000-000000000006'''
delete from public.live_status; delete from public.shifts where user_id in (:A, :N);
-- A rep clocks in, then ends the shift on the tracker (the save goes through like member_log_shift)
insert into public.live_status (user_id, mode, started_at) values (:N, 'run', date_trunc('second', now()) - interval '3 hours');
insert into public.shifts (name, owner, user_id, shift_date, started_at, ended_at, work_seconds, brief, source)
  values ('New N', false, :N, current_date, date_trunc('second', now()) - interval '3 hours', now(), 10800, 'Good day.', 'tracker');
select pg_temp.ok(not exists (select 1 from public.live_status where user_id = :N), 'ending the shift on the tracker takes them out of Live now');
-- Amr presses End anyway (an old Live now page): the same shift comes in again, a second later
insert into public.shifts (name, owner, user_id, shift_date, started_at, ended_at, work_seconds, source)
  values ('New N', false, :N, current_date, date_trunc('second', now()) - interval '3 hours' + interval '1 second', now(), 10800, 'tracker');
select pg_temp.ok((select count(*) from public.shifts where user_id = :N) = 1 and (select brief from public.shifts where user_id = :N) = 'Good day.', 'the second copy is skipped; the one with the note stays');
-- The other order: Amr presses End first (no note), then the rep's phone saves with a note and numbers
delete from public.shifts where user_id = :N;
insert into public.shifts (name, owner, user_id, shift_date, started_at, ended_at, work_seconds, source)
  values ('New N', false, :N, current_date, date_trunc('second', now()) - interval '5 hours', now(), 18000, 'tracker');
insert into public.shifts (name, owner, user_id, shift_date, started_at, ended_at, work_seconds, brief, dials, conversations, appointments, source)
  values ('New N', false, :N, current_date, date_trunc('second', now()) - interval '5 hours', now(), 17900, 'Late note from my phone.', 22, 3, 1, 'tracker');
select pg_temp.ok((select count(*) from public.shifts where user_id = :N) = 1 and (select brief = 'Late note from my phone.' and dials = 22 and conversations = 3 and appointments = 1 and work_seconds = 18000 from public.shifts where user_id = :N),
  'Amr ended it first: still one shift, and the rep''s note and numbers are kept');
insert into public.shifts (name, owner, user_id, shift_date, started_at, ended_at, work_seconds, brief, source)
  values ('New N', false, :N, current_date, date_trunc('second', now()) - interval '5 hours', now(), 18000, 'A third try.', 'tracker');
select pg_temp.ok((select brief from public.shifts where user_id = :N) = 'Late note from my phone.', 'a note already saved is never replaced');
select pg_temp.ok((select pg_temp_err from (select pg_temp.err($i$insert into public.shifts (name, owner, user_id, shift_date, started_at, work_seconds, source) values ('New N', false, '00000000-0000-0000-0000-000000000006', current_date, date_trunc('second', now()) - interval '5 hours', 18000, 'manual')$i$) as pg_temp_err) e) like '%already saved%',
  'approving a missed-shift request for a shift that''s already saved says so');
-- A later, different shift the same day is still saved
insert into public.shifts (name, owner, user_id, shift_date, started_at, ended_at, work_seconds, source)
  values ('New N', false, :N, current_date, date_trunc('second', now()) - interval '1 hour', now(), 3600, 'tracker');
select pg_temp.ok((select count(*) from public.shifts where user_id = :N) = 2, 'a second shift with a different start is saved as normal');
-- Another person starting at the same moment is not affected
insert into public.shifts (name, owner, user_id, shift_date, started_at, ended_at, work_seconds, source)
  values ('Agent A', false, :A, current_date, date_trunc('second', now()) - interval '3 hours', now(), 10800, 'tracker');
select pg_temp.ok((select count(*) from public.shifts where user_id = :A) = 1, 'someone else starting at the same moment is saved');
-- Amr's own entries (no person on them) are never touched
insert into public.shifts (name, owner, shift_date, started_at, work_seconds) values ('Amr', true, current_date, date_trunc('second', now()) - interval '3 hours', 600),
  ('Amr', true, current_date, date_trunc('second', now()) - interval '3 hours', 600);
select pg_temp.ok((select count(*) from public.shifts where owner and started_at = date_trunc('second', now()) - interval '3 hours') = 2, 'entries without a person are saved as before');
-- Clocked in, nothing saved yet: Live now stays
insert into public.live_status (user_id, mode, started_at) values (:A, 'run', date_trunc('second', now()) - interval '20 minutes');
select pg_temp.ok(exists (select 1 from public.live_status where user_id = :A), 'someone still working stays in Live now');
delete from public.live_status; delete from public.shifts where owner and name = 'Amr' and work_seconds = 600;
