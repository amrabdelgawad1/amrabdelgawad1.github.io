-- Hand-off Part 6. Applied as three migrations: security_pin_search_path_private,
-- perf_rls_initplan_public (public and storage policies), perf_index_foreign_keys. See supabase/SECURITY_NOTES.md.

-- search_path on the functions the advisor flagged
alter function private.course_add_arabic(p_module text, p_map jsonb) set search_path = 'public', 'pg_temp';
alter function private.course_insert_item(p_module text, p_before text, p_item jsonb) set search_path = 'public', 'pg_temp';
alter function private.course_renumber_text(t text, p_map jsonb, p_cells boolean) set search_path = 'public', 'pg_temp';
alter function private.course_set_fields(p_module text, p_map jsonb) set search_path = 'public', 'pg_temp';
alter function private.email_wrap(p_title text, p_body text) set search_path = 'public', 'pg_temp';
alter function private.h(p text) set search_path = 'public', 'pg_temp';
alter function private.hm(p_secs bigint) set search_path = 'public', 'pg_temp';
alter function private.last_week_from() set search_path = 'public', 'pg_temp';
alter function private.totals_at(p_mode text, p_work integer, p_break integer, p_seg timestamp with time zone, p_end timestamp with time zone) set search_path = 'public', 'pg_temp';
alter function private.usd(p numeric) set search_path = 'public', 'pg_temp';

-- every private function closed to the API roles
do $$ declare r record; begin
  for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;
revoke usage on schema private from public, anon, authenticated;

-- RLS: evaluate auth.<fn>() once per query, not per row (run once per schema: public, storage)
do $$
declare r record; nq text; nw text;
begin
  for r in select schemaname, tablename, policyname, qual, with_check from pg_policies
            where schemaname in ('public', 'storage')
              and (coalesce(qual,'') || coalesce(with_check,'')) ~ '(?<!select )auth\.(uid|jwt|role|email)\(\)' loop
    nq := regexp_replace(r.qual, '(?<!select )auth\.(uid|jwt|role|email)\(\)', '(select auth.\1())', 'g');
    nw := regexp_replace(r.with_check, '(?<!select )auth\.(uid|jwt|role|email)\(\)', '(select auth.\1())', 'g');
    execute format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename)
         || case when r.qual is not null then ' using (' || nq || ')' else '' end
         || case when r.with_check is not null then ' with check (' || nw || ')' else '' end;
  end loop;
end $$;

-- index every public foreign key that has no covering index
do $$
declare r record; cols text;
begin
  for r in
    select c.conrelid::regclass tbl, c.conname, c.conrelid, c.conkey
      from pg_constraint c join pg_namespace ns on ns.oid = (select relnamespace from pg_class where oid = c.conrelid)
     where c.contype = 'f' and ns.nspname = 'public'
       and not exists (select 1 from pg_index i where i.indrelid = c.conrelid
                         and (i.indkey::int2[])[0:array_length(c.conkey,1)-1] @> c.conkey
                         and (i.indkey::int2[])[0:array_length(c.conkey,1)-1] <@ c.conkey)
  loop
    select string_agg(quote_ident(a.attname), ', ' order by k.ord) into cols
      from unnest(r.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = r.conrelid and a.attnum = k.attnum;
    execute format('create index if not exists %I on %s (%s)', left(r.conname || '_idx', 63), r.tbl, cols);
  end loop;
end $$;
