# Handoff: portal round 0 (map, no code)

Branch `portal-r0-map`. Not merged.

## What changed

- `PORTAL-MAP.md` (new): every signed-in page, its files, CSS, access check, tables and functions; every place that decides who sees what; where each new screen's numbers come from; the round 2 roles proposal; hard parts by round; old links; questions for Amr.
- `HANDOFF-PORTAL-R0.md` (this file).

No site files, CSS, JS or SQL changed. No service worker bump needed.

## How I checked

Read every file under `app/`, `course/`, `cash/`, `tracker/`, `deal-gate.js`, `guard.js` and all of `supabase/migrations/`, plus the eight design screens. Database calls were listed per file with a search of `.from(`, `.rpc(`, `storage.from(` and `functions.invoke(`.

## SQL to run

None to change anything. Before round 2, please run this **read-only** query and paste the result into the round 2 thread (names can be shortened):

```sql
select m.name, m.active, m.access, m.deals_until, m.deals_mfa, a.role as agent_role
from public.members m
left join public.agents a on a.id = m.agent_id
order by m.active desc, m.name;
```

Also export, for round 2:

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' and tablename = 'members';

select pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.members'::regclass and contype = 'c';

select pg_get_functiondef('public.is_tracker_admin()'::regprocedure);
select pg_get_functiondef(p.oid) from pg_proc p
where p.proname in ('decide_shift_request', 'deal_access_status', 'my_profile');
```

## What Amr must do

Nothing more. His answers are recorded in `PORTAL-MAP.md` section 9. Round 2 waits for the reviewer's database export above.

## Left or unsure

- The `team-access` edge function, the Deal CRM file and the older tables' rules aren't in the repo. The map marks what I couldn't see as "unknown".
- The brief and screen 8 disagree on the people filters and on students in the list. I'm following the brief.
