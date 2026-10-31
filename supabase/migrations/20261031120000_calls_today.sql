-- Phase 1: calls show up while the shift is still running.
-- Until now the team board and Amr's numbers only counted calls after a rep ended their shift (the end-of-shift
-- numbers in shifts). Now an open shift's taps (call_events) count too. Once the shift ends, its own numbers count
-- instead (the rep may have corrected them), so nothing is counted twice: a tap belongs to an ended shift when a
-- shift row of that person started at the same moment (within 2 seconds).
-- Safe to run more than once.

-- Taps from shifts that haven't ended yet (helper, not callable from the site)
create or replace function public.portal_open_taps(p_user uuid, p_since timestamptz, p_kind text)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.call_events c
   where c.user_id = p_user and c.kind = p_kind and c.shift_started_at >= p_since
     and not exists (select 1 from public.shifts s where s.user_id = c.user_id
                      and s.started_at between c.shift_started_at - interval '2 seconds' and c.shift_started_at + interval '2 seconds')
$$;
revoke all on function public.portal_open_taps(uuid, timestamptz, text) from public, anon, authenticated;

-- The weekly team board (round 7), now with open shifts' dials
create or replace function public.portal_team_board()
returns table(user_id uuid, name text, calls integer, lessons integer, drills integer, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_start timestamptz := date_trunc('week', now() at time zone 'America/New_York') at time zone 'America/New_York';
  v_day date := (date_trunc('week', now() at time zone 'America/New_York'))::date;
begin
  if not (coalesce(public.is_tracker_admin(), false) or public.portal_role() in ('manager', 'agent')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select m.user_id, m.name,
    coalesce((select sum(s.dials)::integer from public.shifts s where s.user_id = m.user_id and not s.owner and s.shift_date >= v_day), 0)
      + public.portal_open_taps(m.user_id, v_start, 'dial'),
    coalesce((select count(*)::integer from public.course_item_done d where d.user_id = m.user_id and d.done_at >= v_start), 0),
    coalesce((select count(*)::integer from public.hub_uploads u where u.user_id = m.user_id and u.created_at >= v_start), 0)
      + coalesce((select count(*)::integer from public.course_submissions c where c.user_id = m.user_id and c.status <> 'draft' and coalesce(c.last_submitted_at, c.submitted_at) >= v_start), 0),
    m.user_id = auth.uid()
  from public.members m
  where m.active
  order by 3 desc, 4 desc, 5 desc, 2;
end $$;
revoke all on function public.portal_team_board() from public;
grant execute on function public.portal_team_board() to authenticated;

-- Today's calls per person (Cairo day, like the shift dates): ended shifts' numbers plus open shifts' taps.
-- Offers only exist as taps. Amr, or a manager who can see Live now.
create or replace function public.portal_calls_today()
returns table(user_id uuid, name text, dials integer, conversations integer, offers integer, appointments integer, on_shift boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'Africa/Cairo')::date;
  v_since timestamptz := (now() at time zone 'Africa/Cairo')::date::timestamp at time zone 'Africa/Cairo';
begin
  if not (coalesce(public.is_tracker_admin(), false) or (public.portal_role() = 'manager' and public.portal_can('live'))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select x.user_id, x.name, x.dials, x.conversations, x.offers, x.appointments, x.on_shift from (
    select m.user_id, m.name,
      coalesce((select sum(s.dials)::integer from public.shifts s where s.user_id = m.user_id and not s.owner and s.shift_date = v_day), 0)
        + public.portal_open_taps(m.user_id, v_since, 'dial') as dials,
      coalesce((select sum(s.conversations)::integer from public.shifts s where s.user_id = m.user_id and not s.owner and s.shift_date = v_day), 0)
        + public.portal_open_taps(m.user_id, v_since, 'conversation') as conversations,
      (select count(*)::integer from public.call_events c where c.user_id = m.user_id and c.kind = 'offer' and c.at >= v_since) as offers,
      coalesce((select sum(s.appointments)::integer from public.shifts s where s.user_id = m.user_id and not s.owner and s.shift_date = v_day), 0)
        + public.portal_open_taps(m.user_id, v_since, 'appointment') as appointments,
      exists (select 1 from public.live_status l where l.user_id = m.user_id) as on_shift
    from public.members m where m.active) x
  where x.dials + x.conversations + x.offers + x.appointments > 0 or x.on_shift
  order by x.dials desc, x.name;
end $$;
revoke all on function public.portal_calls_today() from public, anon;
grant execute on function public.portal_calls_today() to authenticated;
