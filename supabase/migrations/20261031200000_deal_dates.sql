-- Phase 1: the pipeline board. Three working dates on a deal under contract, readable like the other working fields
-- (they say nothing about the seller): when the contract was signed, when the inspection period ends, and the
-- closing date. The Deal CRM saves them; the board, the Today screen and the Admin overview count down to them.
-- A date can't come before the contract date. Safe to run more than once.
alter table public.deals add column if not exists contract_on date;
alter table public.deals add column if not exists inspection_ends date;
alter table public.deals add column if not exists closing_on date;
create index if not exists deals_closing on public.deals (closing_on) where stage = 'contract';

create or replace function public.deals_dates_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.contract_on is not null and new.inspection_ends is not null and new.inspection_ends < new.contract_on then
    raise exception 'The inspection period can''t end before the contract date' using errcode = '22023';
  end if;
  if new.contract_on is not null and new.closing_on is not null and new.closing_on < new.contract_on then
    raise exception 'Closing can''t come before the contract date' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function public.deals_dates_check() from public, anon, authenticated;
drop trigger if exists deals_dates_check on public.deals;
create trigger deals_dates_check before insert or update on public.deals for each row execute function public.deals_dates_check();
