-- Phase 1: the Today screen. A rep's own numbers for today (Cairo day), counted the same way as Calls today on the
-- Admin overview: ended shifts' numbers plus the taps of a shift still running. Only the person asking, never anyone
-- else, and never hours or pay (those stay on My hours). Deals for the Today screen come straight from public.deals
-- under its own rules, so no function is needed for them. Safe to run more than once.
create or replace function public.portal_my_today()
returns table(dials integer, conversations integer, offers integer, appointments integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_day date := (now() at time zone 'Africa/Cairo')::date;
  v_since timestamptz := (now() at time zone 'Africa/Cairo')::date::timestamp at time zone 'Africa/Cairo';
begin
  if v_me is null or (not exists (select 1 from public.members m where m.user_id = v_me and m.active)
                      and not coalesce(public.is_tracker_admin(), false)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select coalesce((select sum(s.dials)::integer from public.shifts s where s.user_id = v_me and not s.owner and s.shift_date = v_day), 0)
           + public.portal_open_taps(v_me, v_since, 'dial'),
         coalesce((select sum(s.conversations)::integer from public.shifts s where s.user_id = v_me and not s.owner and s.shift_date = v_day), 0)
           + public.portal_open_taps(v_me, v_since, 'conversation'),
         (select count(*)::integer from public.call_events c where c.user_id = v_me and c.kind = 'offer' and c.at >= v_since),
         coalesce((select sum(s.appointments)::integer from public.shifts s where s.user_id = v_me and not s.owner and s.shift_date = v_day), 0)
           + public.portal_open_taps(v_me, v_since, 'appointment');
end $$;
revoke all on function public.portal_my_today() from public, anon;
grant execute on function public.portal_my_today() to authenticated;
