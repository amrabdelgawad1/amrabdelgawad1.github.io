-- Phase 3: the team overview. One row per active team member for the last 1, 7 or 30 days (Cairo days, today
-- included): on shift now, hours and days worked, calls (dials, conversations, offers, appointments, open shifts
-- included), end-of-day notes missing, deals (open, under contract, closed in the period, follow-ups late), learning
-- (lessons done, recordings and drills sent) and when they were last active. Course progress comes from the
-- existing learner progress functions. Never pay, rates or anything encrypted.
-- Who: Amr, and managers who may see everyone's hours ('team'). Deal numbers only for those who may see the team's
-- deals (Amr; managers with Deal tools and the authenticator code); for anyone else they come back empty.
-- Safe to run more than once.
create or replace function public.portal_team_overview(p_days integer default 7)
returns table(user_id uuid, name text, role text, on_shift boolean, worked_seconds integer, days_worked integer,
              dials integer, conversations integer, offers integer, appointments integer, notes_missing integer,
              deals_open integer, deals_contract integer, deals_closed integer, followups_late integer,
              lessons integer, drills integer, last_active timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_from_day date; v_from timestamptz; v_deals boolean;
begin
  if not (coalesce(public.is_tracker_admin(), false) or (public.portal_role() = 'manager' and public.portal_can('team'))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_days not in (1, 7, 30) then raise exception 'Pick today, 7 days or 30 days' using errcode = '22023'; end if;
  v_from_day := v_today - (p_days - 1);
  v_from := v_from_day::timestamp at time zone 'Africa/Cairo';
  v_deals := coalesce(public.deals_team_viewer(), false);
  return query
  with s as (
    select x.user_id, count(*)::integer n, count(distinct x.shift_date)::integer days, coalesce(sum(x.work_seconds), 0)::integer work,
           coalesce(sum(x.dials), 0)::integer dials, coalesce(sum(x.conversations), 0)::integer conv, coalesce(sum(x.appointments), 0)::integer appt,
           count(*) filter (where nullif(btrim(coalesce(x.brief, '')), '') is null)::integer missing, max(x.ended_at) last_end
      from public.shifts x where x.shift_date >= v_from_day and not x.owner and x.user_id is not null group by x.user_id),
  d as (
    select x.owner, count(*) filter (where x.stage not in ('closed', 'passed'))::integer open,
           count(*) filter (where x.stage = 'contract')::integer contract,
           count(*) filter (where x.stage = 'closed' and coalesce(x.closed_on, (x.updated_at at time zone 'Africa/Cairo')::date) >= v_from_day)::integer closed,
           count(*) filter (where x.stage not in ('closed', 'passed') and x.follow_up < v_today)::integer late
      from public.deals x where v_deals group by x.owner)
  select m.user_id, m.name, coalesce(m.role, 'member'),
         exists (select 1 from public.live_status l where l.user_id = m.user_id),
         coalesce(s.work, 0), coalesce(s.days, 0),
         coalesce(s.dials, 0) + public.portal_open_taps(m.user_id, v_from, 'dial'),
         coalesce(s.conv, 0) + public.portal_open_taps(m.user_id, v_from, 'conversation'),
         (select count(*)::integer from public.call_events c where c.user_id = m.user_id and c.kind = 'offer' and c.at >= v_from),
         coalesce(s.appt, 0) + public.portal_open_taps(m.user_id, v_from, 'appointment'),
         coalesce(s.missing, 0),
         case when v_deals then coalesce(d.open, 0) end, case when v_deals then coalesce(d.contract, 0) end,
         case when v_deals then coalesce(d.closed, 0) end, case when v_deals then coalesce(d.late, 0) end,
         (select count(*)::integer from public.course_item_done k where k.user_id = m.user_id and k.done_at >= v_from),
         (select count(*)::integer from public.hub_uploads u where u.user_id = m.user_id and u.created_at >= v_from)
           + (select count(*)::integer from public.course_submissions c where c.user_id = m.user_id and c.status <> 'draft' and coalesce(c.last_submitted_at, c.submitted_at) >= v_from),
         greatest((select max(c.at) from public.call_events c where c.user_id = m.user_id),
                  (select max(x.ended_at) from public.shifts x where x.user_id = m.user_id),
                  (select max(l.started_at) from public.live_status l where l.user_id = m.user_id),
                  (select max(k.done_at) from public.course_item_done k where k.user_id = m.user_id))
    from public.members m
    left join s on s.user_id = m.user_id
    left join d on d.owner = m.user_id
   where m.active and m.user_id is not null
   order by m.name;
end $$;
revoke all on function public.portal_team_overview(integer) from public, anon;
grant execute on function public.portal_team_overview(integer) to authenticated;
