-- Round 1 rules (Oct 28): a passed quiz stays passed.
--
-- Before: a quiz counted as passed by its latest attempt, so practising a passed quiz and scoring lower
-- locked the checkpoint again. Now any finished attempt that passed counts, and keeps counting.
-- Started-over (abandoned) attempts still never count. course_state() also returns, per quiz,
-- "passed" (ever passed) and "best" (best score), so the app can show both.
--
-- Also: Admin's learner list shows the checkpoint as passed once it was ever passed (same rule), and
-- starting over removes an unfinished attempt that has no answers yet instead of keeping an empty
-- abandoned record. Attempts with answers are still kept as abandoned.
--
-- Changes four functions only. No tables or data change. Safe to run more than once.

create or replace function public.course_quiz_passed(p_user uuid, p_module text, p_item text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.course_attempts a
                  where a.user_id = p_user and a.module_id = p_module and a.item_id = p_item
                    and a.finished_at is not null and not a.abandoned and a.passed)
$$;
revoke execute on function public.course_quiz_passed(uuid, text, text) from public, anon, authenticated;

create or replace function public.course_state(p_content boolean default true)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  uid uuid := public.course_require_access();
  admin boolean := public.course_is_admin();
  mods jsonb;
  open_ids text[];
begin
  select coalesce(array_agg(m.id), '{}') into open_ids
    from public.course_modules m where admin or public.course_module_open(uid, m.id);

  select coalesce(jsonb_agg(
           (m.content - 'items') || jsonb_build_object(
             'id', m.id, 'number', m.number,
             'open', m.id = any(open_ids),
             'openForLearners', public.course_module_open(uid, m.id),
             'checkpointOpen', admin or public.course_checkpoint_open(uid, m.id),
             'items', case when p_content then coalesce((select jsonb_agg(public.course_public_item(i.value, m.id = any(open_ids)) order by i.ordinality)
                                  from jsonb_array_elements(coalesce(m.content -> 'items', '[]'::jsonb)) with ordinality i), '[]'::jsonb) end)
           order by m.number), '[]'::jsonb)
    into mods from public.course_modules m;

  return jsonb_build_object(
    'title', coalesce((select title from public.course_meta), 'Acquisitions Playbook'),
    'totalModules', coalesce((select total_modules from public.course_meta), 14),
    'isAdmin', admin,
    'me', jsonb_build_object('id', uid, 'name', (select m.name from public.members m where m.user_id = uid)),
    'modules', mods,
    'done', coalesce((select jsonb_object_agg(d.module_id || '/' || d.item_id, d.done_at) from public.course_item_done d where d.user_id = uid), '{}'::jsonb),
    -- Per quiz: the latest finished attempt, the best score, and an unfinished attempt to resume
    'quizzes', coalesce((
      select jsonb_object_agg(k.key, jsonb_build_object(
               'latest', (select jsonb_build_object('id', a.id, 'score', a.score, 'correct', a.correct, 'total', a.total, 'passed', a.passed, 'finishedAt', a.finished_at)
                            from public.course_attempts a where a.user_id = uid and a.module_id = k.module_id and a.item_id = k.item_id and a.finished_at is not null and not a.abandoned
                            order by a.finished_at desc limit 1),
               'tries', (select count(*) from public.course_attempts a where a.user_id = uid and a.module_id = k.module_id and a.item_id = k.item_id and a.finished_at is not null and not a.abandoned),
               'passed', public.course_quiz_passed(uid, k.module_id, k.item_id),
               'best', (select max(a.score) from public.course_attempts a where a.user_id = uid and a.module_id = k.module_id and a.item_id = k.item_id and a.finished_at is not null and not a.abandoned),
               'open', (select jsonb_build_object('id', a.id, 'answered', (select count(*) from jsonb_object_keys(a.answers)))
                          from public.course_attempts a where a.user_id = uid and a.module_id = k.module_id and a.item_id = k.item_id and a.finished_at is null
                          order by a.started_at desc limit 1)))
        from (select distinct a.module_id, a.item_id, a.module_id || '/' || a.item_id as key
                from public.course_attempts a where a.user_id = uid) k), '{}'::jsonb),
    'submissions', coalesce((
      select jsonb_object_agg(s.module_id || '/' || s.item_id, jsonb_build_object(
               'status', s.status, 'answers', s.answers, 'fileName', s.file_name, 'filePath', s.file_path,
               'comment', s.comment, 'submittedAt', s.submitted_at, 'lastSubmittedAt', s.last_submitted_at,
               'reviewedAt', s.reviewed_at, 'updatedAt', s.updated_at))
        from public.course_submissions s where s.user_id = uid), '{}'::jsonb)
  );
end $$;
revoke all on function public.course_state(boolean) from public, anon;
grant execute on function public.course_state(boolean) to authenticated;

create or replace function public.course_admin_learners()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.course_require_admin();
  return coalesce((
    with people as (
      select m.user_id from public.members m where m.active is true and to_jsonb(m.access) ? 'course'
      union select user_id from public.course_item_done
      union select user_id from public.course_attempts
      union select user_id from public.course_submissions
    ), cur as (
      -- current module: the lowest-numbered open module whose checkpoint isn't passed yet, else the last open one
      select p.user_id,
             coalesce((select m.id from public.course_modules m, public.course_flat(m.content) f
                        where f.kind = 'checkpoint' and public.course_module_open(p.user_id, m.id)
                          and not public.course_quiz_passed(p.user_id, m.id, f.item_id)
                        order by m.number limit 1),
                      (select m.id from public.course_modules m where public.course_module_open(p.user_id, m.id) order by m.number desc limit 1)) as module_id
        from people p
    )
    select jsonb_agg(jsonb_build_object(
             'userId', c.user_id,
             'name', coalesce(mem.name, u.email),
             'email', u.email,
             'hasAccess', coalesce(mem.active is true and to_jsonb(mem.access) ? 'course', false),
             'module', (select number from public.course_modules where id = c.module_id),
             'moduleId', c.module_id,
             'done', pr.done, 'total', pr.total,
             'lastActive', greatest(
                (select max(done_at) from public.course_item_done d where d.user_id = c.user_id),
                (select max(updated_at) from public.course_attempts a where a.user_id = c.user_id),
                (select max(updated_at) from public.course_submissions s where s.user_id = c.user_id)),
             'checkpoint', (select jsonb_build_object('module', m.number, 'score', a.score, 'passed', public.course_quiz_passed(c.user_id, m.id, f.item_id), 'at', a.finished_at)
                              from public.course_attempts a join public.course_modules m on m.id = a.module_id
                              join lateral public.course_flat(m.content) f on f.item_id = a.item_id and f.kind = 'checkpoint'
                             where a.user_id = c.user_id and a.finished_at is not null and not a.abandoned
                             order by a.finished_at desc limit 1),
             'waiting', (select count(*) from public.course_submissions s where s.user_id = c.user_id and s.status = 'submitted'))
           order by coalesce(mem.name, u.email))
      from cur c
      join auth.users u on u.id = c.user_id
      left join public.members mem on mem.user_id = c.user_id
      left join lateral public.course_module_progress(c.user_id, c.module_id) pr on true
  ), '[]'::jsonb);
end $$;

create or replace function public.course_quiz_start(p_module text, p_item text, p_restart boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  uid uuid := public.course_require_access();
  it jsonb := public.course_open_item(uid, p_module, p_item, array['lesson', 'checkpoint']);
  q jsonb := it -> 'quiz';
  att public.course_attempts;
begin
  if q is null then raise exception 'course: no quiz here' using errcode = 'P0002'; end if;
  if p_restart then
    delete from public.course_attempts
     where user_id = uid and module_id = p_module and item_id = p_item and finished_at is null and answers = '{}'::jsonb;
    update public.course_attempts a
       set correct = (select count(*) from jsonb_each(a.answers) e where (e.value ->> 'right')::boolean),
           score = floor((select count(*) from jsonb_each(a.answers) e where (e.value ->> 'right')::boolean) * 100.0 / greatest(a.total, 1)),
           passed = false, abandoned = true, finished_at = now(), updated_at = now()
     where a.user_id = uid and a.module_id = p_module and a.item_id = p_item and a.finished_at is null;
  end if;
  select * into att from public.course_attempts
   where user_id = uid and module_id = p_module and item_id = p_item and finished_at is null
   order by started_at desc limit 1;
  if att.id is null then
    insert into public.course_attempts (user_id, module_id, item_id, total, pass_mark)
    values (uid, p_module, p_item, jsonb_array_length(q -> 'questions'), coalesce((q ->> 'passMark')::int, 80))
    returning * into att;
  end if;
  return jsonb_build_object('attempt', att.id, 'startedAt', att.started_at, 'answered', coalesce((
    select jsonb_object_agg(e.key, (e.value - 'at') || jsonb_build_object('explanation', qq.value ->> 'explanation'))
      from jsonb_each(att.answers) e
      join jsonb_array_elements(q -> 'questions') qq on qq.value ->> 'id' = e.key), '{}'::jsonb));
end $$;
