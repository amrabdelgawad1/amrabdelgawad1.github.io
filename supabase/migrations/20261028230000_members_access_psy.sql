-- members.access: allow 'psy' (Psychology course)
--
-- /app > Invite and access now shows a "Psychology course" switch. The members_access_check rule lists the
-- values a member's access may hold, so this adds 'psy' to it (same method as 20261028220000_members_access_learn_mkt.sql).
-- It only widens what can be saved; nobody gets anything until Amr ticks the switch.
-- The lessons are locked by learn_can_open('psy') and the "course-content" bucket rules from
-- 20261028180000_course_content_lock.sql: the folder name "psy" is the switch, so nothing else is needed there.
-- Safe to run more than once.

do $$
declare
  c record;
  def text;
  v text;
begin
  for c in
    select con.conname, pg_get_constraintdef(con.oid) as def
      from pg_constraint con
     where con.conrelid = 'public.members'::regclass and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ~ 'access\s*<@\s*ARRAY\['
  loop
    def := c.def;
    foreach v in array array['psy'] loop
      if def not like '%''' || v || '''%' then
        def := regexp_replace(def, 'ARRAY\[', 'ARRAY[''' || v || '''::text, ');
      end if;
    end loop;
    if def <> c.def then
      execute format('alter table public.members drop constraint %I', c.conname);
      execute format('alter table public.members add constraint %I %s', c.conname, def);
      raise notice 'members: % is now %', c.conname, def;
    else
      raise notice 'members: % already allows psy', c.conname;
    end if;
  end loop;
end $$;
