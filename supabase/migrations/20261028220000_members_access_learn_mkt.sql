-- members.access: allow 'learn' (Learning Hub) and 'mkt' (Marketing course)
--
-- /app > Invite and access already shows these two switches, but the live members_access_check rule
-- only listed live, requests, team, money, deals (and course since Oct 28), so turning them on for a
-- team member was refused. This adds the two values to that rule. It only widens what can be saved;
-- nobody gets anything until Amr ticks the switch. Safe to run more than once.

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
    foreach v in array array['learn', 'mkt'] loop
      if def not like '%''' || v || '''%' then
        def := regexp_replace(def, 'ARRAY\[', 'ARRAY[''' || v || '''::text, ');
      end if;
    end loop;
    if def <> c.def then
      execute format('alter table public.members drop constraint %I', c.conname);
      execute format('alter table public.members add constraint %I %s', c.conname, def);
      raise notice 'members: % is now %', c.conname, def;
    end if;
  end loop;
end $$;
