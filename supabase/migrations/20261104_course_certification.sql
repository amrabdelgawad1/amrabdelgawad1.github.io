-- Acquisitions Playbook: certification (hand-off Part 5)
--  1. call scores record who scored them; readiness needs at least one human-scored certification call
--  2. a live-call readiness checklist an admin signs before certificate_issue can run
--  3. one-year certificates with a renewal flow on Lesson 20.5 (one new call 40+ and the 20.5 quiz)
-- Rules follow Lesson 20.1: three role-plays from the Lesson 20.4 briefs, each 40+ with no area below 3,
-- at least one 45+; one consented real call scored 40+ may replace one role-play.

-- ---------- 1. who scored a call ----------
alter table public.hub_uploads add column if not exists scored_by uuid;
alter table public.hub_uploads add column if not exists scored_at timestamptz;
update public.hub_uploads set scored_by = reviewed_by, scored_at = reviewed_at where score is not null and scored_by is null;

drop policy if exists "hub_uploads send" on public.hub_uploads;
create policy "hub_uploads send" on public.hub_uploads for insert to authenticated
  with check ((user_id = auth.uid()) and hub_can_send(course) and (status = 'waiting') and (score is null)
              and (reviewed_at is null) and (reviewed_by is null) and (scored_by is null) and (scored_at is null)
              and (path like (((auth.uid())::text || '/') || course) || '/%'));

create or replace function public.hub_review(p_id uuid, p_status text, p_score jsonb)
returns void language plpgsql security definer set search_path = 'public', 'pg_temp' as $$
declare n int;
begin
  if not coalesce(public.is_tracker_admin(), false) then raise exception 'hub: admin only' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('waiting', 'approved', 'redo') then raise exception 'hub: bad status' using errcode = '22023'; end if;
  if p_score is not null then
    if coalesce(jsonb_typeof(p_score -> 'cats'), '') <> 'array' or jsonb_array_length(p_score -> 'cats') <> 10
       or exists (select 1 from jsonb_array_elements(p_score -> 'cats') c
                   where jsonb_typeof(c) <> 'number' or (c #>> '{}') !~ '^[1-5]$') then
      raise exception 'hub: the scorecard needs 10 scores from 1 to 5' using errcode = '22023';
    end if;
    p_score := jsonb_build_object('cats', p_score -> 'cats',
      'total', (select sum((c #>> '{}')::int) from jsonb_array_elements(p_score -> 'cats') c));
  end if;
  update public.hub_uploads
     set status = p_status, score = p_score,
         reviewed_at = case when p_status = 'waiting' then null else now() end,
         reviewed_by = case when p_status = 'waiting' then null else auth.uid() end,
         scored_by   = case when p_score is null then null else auth.uid() end,
         scored_at   = case when p_score is null then null else now() end
   where id = p_id;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'hub: not found' using errcode = '22023'; end if;
end $$;

-- ---------- settings ----------
create table if not exists private.course_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
alter table private.course_settings enable row level security;
revoke all on private.course_settings from public, anon, authenticated;
-- "The compliance quiz": change this list to change what the checklist auto-checks.
insert into private.course_settings (key, value) values
  ('compliance_items', '["m4/4.10", "m5/7.8", "m18/13.checkpoint"]'::jsonb)
on conflict (key) do nothing;

-- A call that meets the certification bar: approved, full 10-area scorecard, 40+, no area below 3
create or replace function private.cert_call_ok(h public.hub_uploads)
returns boolean language sql immutable set search_path = '' as $$
  select h.status = 'approved' and h.score is not null
     and jsonb_typeof(h.score -> 'cats') = 'array' and jsonb_array_length(h.score -> 'cats') = 10
     and (h.score ->> 'total') ~ '^[0-9]+$' and (h.score ->> 'total')::integer >= 40
     and not exists (select 1 from jsonb_array_elements_text(h.score -> 'cats') c where c !~ '^[0-9]+$' or c::integer < 3)
$$;

create or replace function private.cert_compliance_ok(p_user uuid)
returns boolean language sql stable set search_path = '' as $$
  select not exists (
    select 1 from jsonb_array_elements_text(coalesce((select s.value from private.course_settings s where s.key = 'compliance_items'), '[]')) ref
     where not public.course_quiz_passed(p_user, split_part(ref, '/', 1), split_part(ref, '/', 2)))
$$;

-- ---------- 2. live-call readiness checklist ----------
create table if not exists public.certificate_live_checks (
  user_id       uuid primary key,
  disclosure_ok boolean not null default false,  -- disclosure read correctly on a recorded call
  call_ok       boolean not null default false,  -- one call 40+ with no area below 3
  crm_ok        boolean not null default false,  -- CRM notes clean on a practice queue
  note          text,
  signed_by     uuid,
  signed_at     timestamptz,
  updated_by    uuid,
  updated_at    timestamptz not null default now()
);
alter table public.certificate_live_checks enable row level security;
drop policy if exists "live checks read" on public.certificate_live_checks;
create policy "live checks read" on public.certificate_live_checks for select to authenticated
  using (user_id = auth.uid() or coalesce(public.course_is_admin(), false));
revoke insert, update, delete on public.certificate_live_checks from public, anon, authenticated;

-- ---------- readiness ----------
drop function if exists public.certificate_readiness(uuid);
create function public.certificate_readiness(p_user uuid)
returns table(checkpoints integer, checkpoints_needed integer, final_exam boolean, capstone boolean,
              calls_40 integer, best_call integer, roleplays integer, real_calls integer, calls_45 integer,
              human_scored integer, compliance boolean, live_signed boolean, ready boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  last_num int := (select max(m.number) from public.course_modules m);
  final_mod text := (select m.id from public.course_modules m order by m.number desc limit 1);
  rp_item text := (select f.item_id from public.course_modules m, public.course_flat(m.content) f
                    where m.id = (select m2.id from public.course_modules m2 order by m2.number desc limit 1)
                      and f.item ->> 'title' ~* 'certification role-?plays' limit 1);
begin
  if not coalesce(public.course_is_admin(), false) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  with ok as (
    select h.*, (h.score ->> 'total')::integer total,
           coalesce(h.course = 'acq' and h.module = final_mod and h.item = rp_item, false) is_rp,
           coalesce(h.course = 'calls' and h.real_call and h.consent, false) is_real
      from public.hub_uploads h
     where h.user_id = p_user and private.cert_call_ok(h)),
  counted as (   -- the three that count: every qualifying role-play, plus at most one real call
    select * from ok where is_rp
    union all (select * from ok where is_real order by total desc limit 1)),
  pick as (select * from counted order by total desc limit 3),
  v as (
    select
      (select count(distinct a.module_id)::integer from public.course_attempts a
         join public.course_modules cm on cm.id = a.module_id
        where a.user_id = p_user and a.passed and a.score >= 85 and a.finished_at is not null and not a.abandoned
          and cm.number between 1 and last_num - 1 and a.item_id = cm.number::text || '.checkpoint') cps,
      (last_num - 1) cps_needed,
      exists (select 1 from public.course_attempts a join public.course_modules cm on cm.id = a.module_id
               where a.user_id = p_user and cm.number = last_num and a.item_id = cm.number::text || '.checkpoint'
                 and a.passed and a.score >= 85 and a.finished_at is not null and not a.abandoned) fin,
      exists (select 1 from public.course_submissions s join public.course_modules cm on cm.id = s.module_id
               where s.user_id = p_user and cm.number = last_num and s.item_id = cm.number::text || '.assignment'
                 and s.status = 'approved') cap,
      (select count(*)::integer from pick) c40,
      (select max(total) from pick) best,
      (select count(*)::integer from ok where is_rp) rps,
      (select count(*)::integer from ok where is_real) reals,
      (select count(*)::integer from pick where total >= 45) c45,
      (select count(*)::integer from pick where scored_by is not null) human,
      private.cert_compliance_ok(p_user) comp,
      exists (select 1 from public.certificate_live_checks l where l.user_id = p_user and l.signed_at is not null) signed)
  select v.cps, v.cps_needed, v.fin, v.cap, v.c40, v.best, v.rps, v.reals, v.c45, v.human, v.comp, v.signed,
         (v.cps >= v.cps_needed and v.fin and v.cap and v.c40 >= 3 and v.c45 >= 1 and v.human >= 1 and v.comp and v.signed)
    from v;
end $$;
revoke all on function public.certificate_readiness(uuid) from public, anon;
grant execute on function public.certificate_readiness(uuid) to authenticated;

-- Admin: read and sign the live-call checklist. Signing needs all three boxes and the compliance quizzes.
create or replace function public.certificate_live_get(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare l public.certificate_live_checks;
begin
  if not coalesce(public.course_is_admin(), false) then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into l from public.certificate_live_checks where user_id = p_user;
  return jsonb_build_object(
    'complianceQuiz', private.cert_compliance_ok(p_user),
    'complianceItems', coalesce((select s.value from private.course_settings s where s.key = 'compliance_items'), '[]'::jsonb),
    'disclosure', coalesce(l.disclosure_ok, false), 'call', coalesce(l.call_ok, false), 'crm', coalesce(l.crm_ok, false),
    'note', l.note, 'signedAt', l.signed_at, 'signedBy', public.notify_name(l.signed_by), 'updatedAt', l.updated_at);
end $$;

create or replace function public.certificate_live_sign(p_user uuid, p_disclosure boolean, p_call boolean, p_crm boolean, p_note text default null, p_sign boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not coalesce(public.course_is_admin(), false) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_sign and not (coalesce(p_disclosure, false) and coalesce(p_call, false) and coalesce(p_crm, false)) then
    raise exception 'Tick all three before you sign.' using errcode = '22023';
  end if;
  if p_sign and not private.cert_compliance_ok(p_user) then
    raise exception 'They haven''t passed the compliance quizzes yet.' using errcode = '22023';
  end if;
  insert into public.certificate_live_checks as l (user_id, disclosure_ok, call_ok, crm_ok, note, signed_by, signed_at, updated_by, updated_at)
  values (p_user, coalesce(p_disclosure, false), coalesce(p_call, false), coalesce(p_crm, false), nullif(btrim(coalesce(p_note, '')), ''),
          case when p_sign then me end, case when p_sign then now() end, me, now())
  on conflict (user_id) do update set
    disclosure_ok = excluded.disclosure_ok, call_ok = excluded.call_ok, crm_ok = excluded.crm_ok, note = excluded.note,
    -- changing any box un-signs; signing again re-stamps
    signed_by = case when p_sign then me
                     when excluded.disclosure_ok and excluded.call_ok and excluded.crm_ok
                          and l.disclosure_ok and l.call_ok and l.crm_ok then l.signed_by end,
    signed_at = case when p_sign then now()
                     when excluded.disclosure_ok and excluded.call_ok and excluded.crm_ok
                          and l.disclosure_ok and l.call_ok and l.crm_ok then l.signed_at end,
    updated_by = me, updated_at = now();
  return public.certificate_live_get(p_user);
end $$;
revoke all on function public.certificate_live_get(uuid), public.certificate_live_sign(uuid, boolean, boolean, boolean, text, boolean) from public, anon;
grant execute on function public.certificate_live_get(uuid), public.certificate_live_sign(uuid, boolean, boolean, boolean, text, boolean) to authenticated;

-- ---------- issue: only when every requirement is met and the checklist is signed ----------
create or replace function public.certificate_issue(p_user uuid, p_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text; v_today date := (now() at time zone 'Africa/Cairo')::date; v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
        r record;
begin
  if not coalesce(public.course_is_admin(), false) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if char_length(v_name) not between 2 and 80 then raise exception 'Type the name as it should appear (2 to 80 letters).' using errcode = '22023'; end if;
  if not exists (select 1 from public.members m where m.user_id = p_user and m.active and to_jsonb(m.access) ? 'course') then
    raise exception 'Pick someone with the Acquisitions course.' using errcode = '22023';
  end if;
  if exists (select 1 from public.certificates c where c.user_id = p_user and c.course = 'acq' and c.revoked_at is null) then
    raise exception 'They already have a current certificate. Renew it instead.' using errcode = '22023';
  end if;
  select * into r from public.certificate_readiness(p_user);
  if not r.live_signed then raise exception 'Sign the live-call readiness checklist first.' using errcode = '22023'; end if;
  if not r.ready then raise exception 'Not every certification requirement is met yet.' using errcode = '22023'; end if;
  loop
    v_code := 'ACQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5)) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    exit when not exists (select 1 from public.certificates c where c.code = v_code);
  end loop;
  insert into public.certificates (code, user_id, course, name, issued_on, valid_until, issued_by)
  values (v_code, p_user, 'acq', v_name, v_today, (v_today + interval '1 year')::date, auth.uid());
  perform public.notify(p_user, 'review_done', 'You’re certified: Acquisitions Playbook', 'Your course certificate is ready. Open it to see or share it.', '/cert/?c=' || v_code);
  return v_code;
end $$;

-- ---------- 3. renewal (Lesson 20.5) ----------
-- After the day of the last issue or renewal: one approved call scored 40+ (no area below 3) by a person,
-- and a pass on the Lesson 20.5 quiz.
create or replace function public.certificate_renewal_status(p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := coalesce(p_user, auth.uid());
  c public.certificates;
  since date;
  final_mod text := (select m.id from public.course_modules m order by m.number desc limit 1);
  law_item text;
  call_ok boolean;
  quiz_ok boolean;
begin
  if uid is null or (uid <> auth.uid() and not coalesce(public.course_is_admin(), false)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into c from public.certificates x where x.user_id = uid and x.course = 'acq' and x.revoked_at is null order by x.issued_on desc limit 1;
  if c.id is null then return jsonb_build_object('certified', false); end if;
  since := coalesce(c.renewed_on, c.issued_on);
  select f.item_id into law_item from public.course_modules m, public.course_flat(m.content) f
   where m.id = final_mod and f.item ->> 'title' ~* 'staying certified' limit 1;
  call_ok := exists (select 1 from public.hub_uploads h where h.user_id = uid and h.course in ('acq', 'calls')
                       and (h.course = 'acq' or (h.real_call and h.consent))
                       and private.cert_call_ok(h) and h.scored_by is not null
                       and (h.created_at at time zone 'Africa/Cairo')::date > since);
  quiz_ok := exists (select 1 from public.course_attempts a where a.user_id = uid and a.module_id = final_mod and a.item_id = law_item
                       and a.passed and a.finished_at is not null and not a.abandoned
                       and (a.finished_at at time zone 'Africa/Cairo')::date > since);
  return jsonb_build_object('certified', true, 'id', c.id, 'code', c.code, 'validUntil', c.valid_until, 'since', since,
    'due', c.valid_until < (now() at time zone 'Africa/Cairo')::date, 'lawLesson', law_item,
    'callOk', call_ok, 'quizOk', quiz_ok, 'canRenew', call_ok and quiz_ok);
end $$;
revoke all on function public.certificate_renewal_status(uuid) from public, anon;
grant execute on function public.certificate_renewal_status(uuid) to authenticated;

create or replace function public.certificate_renew(p_id bigint)
returns date language plpgsql security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'Africa/Cairo')::date; v_until date; v_user uuid; v_code text; st jsonb;
begin
  if not coalesce(public.course_is_admin(), false) then raise exception 'Not allowed' using errcode = '42501'; end if;
  select c.user_id into v_user from public.certificates c where c.id = p_id and c.revoked_at is null;
  if v_user is null then raise exception 'That certificate isn''t current.' using errcode = '22023'; end if;
  st := public.certificate_renewal_status(v_user);
  if (st ->> 'id')::bigint is distinct from p_id then raise exception 'That isn''t their latest certificate.' using errcode = '22023'; end if;
  if not (st ->> 'callOk')::boolean then raise exception 'They need one new call scored 40 or more since their last renewal.' using errcode = '22023'; end if;
  if not (st ->> 'quizOk')::boolean then raise exception 'They need to pass the Lesson 20.5 quiz again first.' using errcode = '22023'; end if;
  update public.certificates c set valid_until = (greatest(c.valid_until, v_today) + interval '1 year')::date, renewed_on = v_today
   where c.id = p_id and c.revoked_at is null returning c.valid_until, c.code into v_until, v_code;
  perform public.notify(v_user, 'review_done', 'Your certificate was renewed', 'Valid until ' || to_char(v_until, 'FMMonth FMDD, YYYY') || '.', '/cert/?c=' || v_code);
  return v_until;
end $$;

revoke all on function private.cert_call_ok(public.hub_uploads), private.cert_compliance_ok(uuid) from public, anon, authenticated;
