-- Round 1 rules (Oct 28): a passed quiz stays passed.
--
-- Before: a quiz counted as passed by its latest attempt, so practising a passed quiz and scoring lower
-- locked the checkpoint again. Now any finished attempt that passed counts, and keeps counting.
-- Started-over (abandoned) attempts still never count. course_state() also returns, per quiz,
-- "passed" (ever passed) and "best" (best score), so the app can show both.
--
-- Changes two functions only. No tables or data change. Safe to run more than once.

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
