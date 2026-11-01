-- Gate 1 tracker: "every rep logs every call for two straight weeks".
-- For each active person on the calling team (Deal tools), over the last 14 Cairo days: the days they had a shift,
-- the shift days with no calls logged (no dials on the shift and no call taps that day), the last such day, and how
-- many days in a row they've been clean (days since the last missed shift day, or since their first shift, up to 14).
-- A day without a shift doesn't count either way. Gate 1 passes when everyone is clean for 14 days and worked in
-- both weeks. Amr only. Safe to run more than once.
create or replace function public.portal_gate1()
returns table(user_id uuid, name text, shift_days integer, missed_days integer, last_missed date, clean_days integer, worked_both_weeks boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'Africa/Cairo')::date;
begin
  if not coalesce(public.is_tracker_admin(), false) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  with people as (
    select m.user_id, m.name from public.members m
     where m.active and m.user_id is not null and 'deals' = any(public.portal_keys_of(m.role, m.access, m.not_given))),
  days as (
    select s.user_id, s.shift_date d, coalesce(sum(s.dials), 0) dials from public.shifts s
     where not s.owner and s.user_id is not null and s.shift_date > v_today - 14 group by s.user_id, s.shift_date),
  taps as (
    select c.user_id, (c.at at time zone 'Africa/Cairo')::date d, count(*) n from public.call_events c
     where c.at > (v_today - 14)::timestamp at time zone 'Africa/Cairo' group by 1, 2),
  marked as (
    select d.user_id, d.d, (d.dials > 0 or coalesce(t.n, 0) > 0) as logged
      from days d left join taps t on t.user_id = d.user_id and t.d = d.d),
  firsts as (select s.user_id, min(s.shift_date) first_day from public.shifts s where not s.owner and s.user_id is not null group by s.user_id)
  select p.user_id, p.name,
         coalesce((select count(*)::integer from marked k where k.user_id = p.user_id), 0),
         coalesce((select count(*)::integer from marked k where k.user_id = p.user_id and not k.logged), 0),
         (select max(k.d) from marked k where k.user_id = p.user_id and not k.logged),
         case when f.first_day is null then 0
              else least(14, v_today - greatest(coalesce((select max(k.d) from marked k where k.user_id = p.user_id and not k.logged), f.first_day - 1), f.first_day - 1))::integer end,
         exists (select 1 from marked k where k.user_id = p.user_id and k.d > v_today - 7)
           and exists (select 1 from marked k where k.user_id = p.user_id and k.d <= v_today - 7)
    from people p left join firsts f on f.user_id = p.user_id
   order by 6, p.name;
end $$;
revoke all on function public.portal_gate1() from public, anon;
grant execute on function public.portal_gate1() to authenticated;
