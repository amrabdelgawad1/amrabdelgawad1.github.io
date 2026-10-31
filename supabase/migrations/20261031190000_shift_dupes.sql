-- Fix: a rep who ends their shift on the tracker stayed in Live now, so Amr ended it again from Live now and the same
-- shift was saved twice. Two rules, enforced in the database so they hold for every way a shift is saved
-- (the rep's tracker, Amr's End in Live now, missed-shift requests):
--   1. Saving a shift clears that person's Live now row for the same shift (same start, within 2 seconds).
--   2. A shift for the same person with the same start (within 2 seconds) is never saved twice: the second copy is
--      skipped, so Amr's End on an already-saved shift just clears Live now.
-- Plus a one-time cleanup of Live now rows whose shift is already saved. Shifts already saved twice are NOT deleted
-- here; they are listed for Amr to remove himself. Safe to run more than once.
create or replace function public.shifts_no_twice()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is not null and new.started_at is not null and exists (
       select 1 from public.shifts x where x.user_id = new.user_id
          and x.started_at between new.started_at - interval '2 seconds' and new.started_at + interval '2 seconds') then
    delete from public.live_status l where l.user_id = new.user_id
       and l.started_at between new.started_at - interval '2 seconds' and new.started_at + interval '2 seconds';
    return null;   -- already saved: skip the copy
  end if;
  return new;
end $$;
revoke all on function public.shifts_no_twice() from public, anon, authenticated;
drop trigger if exists shifts_no_twice on public.shifts;
create trigger shifts_no_twice before insert on public.shifts for each row execute function public.shifts_no_twice();

create or replace function public.shifts_clear_live()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is not null and new.started_at is not null then
    delete from public.live_status l where l.user_id = new.user_id
       and l.started_at between new.started_at - interval '2 seconds' and new.started_at + interval '2 seconds';
  end if;
  return null;
end $$;
revoke all on function public.shifts_clear_live() from public, anon, authenticated;
drop trigger if exists shifts_clear_live on public.shifts;
create trigger shifts_clear_live after insert on public.shifts for each row execute function public.shifts_clear_live();

-- One-time: Live now rows for shifts that are already saved
delete from public.live_status l where exists (
  select 1 from public.shifts x where x.user_id = l.user_id
     and x.started_at between l.started_at - interval '2 seconds' and l.started_at + interval '2 seconds');
