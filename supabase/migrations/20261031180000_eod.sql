-- Phase 1: end-of-day reports, one screen for Amr. A rep's end-of-day report is the note they send when they end a
-- shift ("How did today go?" plus their numbers), saved with the shift. This function lists every active team member
-- for one day (Cairo day, today or up to 14 days back): hours worked, numbers, every note they sent, and where they
-- stand: sent, missing (worked, but a shift has no note), on shift (still working today), or off (didn't work).
-- Never pay or rates. Amr, and managers who may see everyone's hours ('team'), can read it. Safe to run more than once.
create or replace function public.portal_eod(p_day date default null)
returns table(user_id uuid, name text, status text, worked_seconds integer, shifts integer, with_report integer,
              dials integer, conversations integer, offers integer, appointments integer, reports jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_day date := coalesce(p_day, (now() at time zone 'Africa/Cairo')::date);
  v_from timestamptz; v_to timestamptz;
begin
  if not (coalesce(public.is_tracker_admin(), false) or (public.portal_role() = 'manager' and public.portal_can('team'))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_day > v_today or v_day < v_today - 14 then raise exception 'Pick today or a day in the last two weeks' using errcode = '22023'; end if;
  v_from := v_day::timestamp at time zone 'Africa/Cairo';
  v_to := (v_day + 1)::timestamp at time zone 'Africa/Cairo';
  return query
  with s as (
    select x.user_id, count(*)::integer as n, coalesce(sum(x.work_seconds), 0)::integer as work,
           count(*) filter (where nullif(btrim(coalesce(x.brief, '')), '') is not null)::integer as briefed,
           coalesce(sum(x.dials), 0)::integer as dials, coalesce(sum(x.conversations), 0)::integer as conversations,
           coalesce(sum(x.appointments), 0)::integer as appointments,
           coalesce(jsonb_agg(jsonb_build_object('started_at', x.started_at, 'ended_at', x.ended_at, 'note', btrim(x.brief)) order by x.started_at)
                    filter (where nullif(btrim(coalesce(x.brief, '')), '') is not null), '[]'::jsonb) as notes
      from public.shifts x where x.shift_date = v_day and not x.owner and x.user_id is not null group by x.user_id)
  select m.user_id, m.name,
         case when coalesce(s.n, 0) = 0 and live.on then 'on_shift'
              when coalesce(s.n, 0) = 0 then 'off'
              when s.briefed < s.n then 'missing'
              when live.on then 'on_shift'
              else 'sent' end,
         coalesce(s.work, 0), coalesce(s.n, 0), coalesce(s.briefed, 0),
         coalesce(s.dials, 0) + case when live.on then public.portal_open_taps(m.user_id, v_from, 'dial') else 0 end,
         coalesce(s.conversations, 0) + case when live.on then public.portal_open_taps(m.user_id, v_from, 'conversation') else 0 end,
         (select count(*)::integer from public.call_events c where c.user_id = m.user_id and c.kind = 'offer' and c.at >= v_from and c.at < v_to),
         coalesce(s.appointments, 0) + case when live.on then public.portal_open_taps(m.user_id, v_from, 'appointment') else 0 end,
         coalesce(s.notes, '[]'::jsonb)
    from public.members m
    left join s on s.user_id = m.user_id
    cross join lateral (select v_day = v_today and exists (select 1 from public.live_status l where l.user_id = m.user_id) as on) live
   where m.active
   order by case when coalesce(s.n, 0) > 0 and s.briefed < s.n then 0 when live.on then 1 when coalesce(s.n, 0) > 0 then 2 else 3 end, m.name;
end $$;
revoke all on function public.portal_eod(date) from public, anon;
grant execute on function public.portal_eod(date) to authenticated;
