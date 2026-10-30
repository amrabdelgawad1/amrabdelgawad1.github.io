# Handoff: portal round 2 (roles in the database)

Branch `portal-r2-roles`. Not merged. **Run the SQL first, then merge** (section 4 says why).

## 1. What changed

### Database: `supabase/migrations/20261030120000_portal_roles.sql`

| Piece | What it does |
|---|---|
| `members.role` | **Reuses the existing column** (reviewer note). Order: drop every check on `role` → set old values (`member`, empty) to `agent` → default `agent`, not null → add `members_role_check (role in ('manager','agent'))`. No row can fail the new check. |
| `members_role_default` trigger | Turns `member` or an empty role into `agent` **before** the check. Without it, the `team-access` invite function (not in the repo) would fail if it still sends `role: 'member'`. |
| `members.not_given` | Role keys a person does **not** get. Added once, filled so today's team keeps exactly what they had: all 4 people get `{course,deals,learn}` (decision 3). New invites start empty, so they get the full Agent set. |
| `portal_role_keys(role)` | agent = `course`, `deals`, `learn`; manager = agent + `live`, `requests`, `team`. |
| `portal_keys_of(role, access, not_given)` | Role keys minus `not_given`, plus extras. **Never `money`** (decision 1). |
| `portal_key_needs_code(key)` | The authenticator rule: every key needs aal2 **except** `live`, `requests` and the learning and deal keys (see 5.1). |
| `portal_role()` | `owner` / `manager` / `agent` / null (switched off, not a member, or Amr without his code). |
| `portal_can(key)`, `portal_member_can(key)` | The one check. Owner = `is_tracker_admin()`. |
| `portal_me()` | For the pages: `{ role, keys, needs_code }`. `needs_code` lists keys waiting on the authenticator, so round 3 can say "Needs your authenticator code" instead of hiding them (reviewer note 1). |
| `portal_people()` | Amr only: everyone with role, extras, `not_given` and the keys it adds up to. |
| `has_access`, `learn_can_open`, `course_has_access`, `hub_can_send` | Rebuilt on `portal_can`, so they can't disagree. Same answers for everyone today (tested). `has_access` keeps the code rule and is now also true for Amr (harmless: every policy using it already lets him in). |
| `decide_shift_request` | Same body as live. Two changes: Amr **or a manager** may decide, and nobody but Amr decides their own request. |
| `deal_access_status` | Counts the role's `deals` key. **Edited in place**: the migration reads the live definition and swaps only `'deals' = any(m.access)`. The owner's address stays exactly as it is in the database and never appears in the repo. If that text isn't found, it stops with a clear message and changes nothing. |
| `learn_progress` | Drops the stray `learn: own rows` policy (reviewer note 3; it matched the four repo policies, so nothing changes for anyone). Narrows `learn_progress own read` to **own rows only**. Amr no longer reads anyone's saved course data, including the Psychology scratch pad and drawings (decision 2). |
| `portal_learner_progress()` | Amr, or a manager with the code: per learner and course, **pass counts only** (`passed`, `sent`, `updated_at`). Marketing = quiz best of 80 or more, assignments done. Psychology = exam done, or 16 of 20 or more. Same rules as the Learning Hub's own counts. |
| `access_log` + `members_access_log` trigger | One line per change to `role`, `access`, `not_given`, `active`, `deals_until`, `deals_mfa`, or a new member: who (`actor`), whose (`target`), what (`from` / `to`), when. Amr reads it. Nobody writes it except the trigger. Changes made by `team-access` or the SQL editor have no actor (shown as "System" later). |

### Pages

| File | Change |
|---|---|
| `app/app.js` (`?v=53`) | A team member's menu comes from `portal_me()` (role keys + extras). If the database isn't updated yet, it falls back to `members.access` as before. Invite and access shows "Agent · extras: ..." and no longer offers a Money tick. |
| `app/account.js` (`?v=11`) | Settings > Agents: roles are **Agent** and **Manager**. An old Operator shows as Manager. Changing it sets the login's `members.role`. It **no longer rewrites `access`** (that was the old `ROLE_ACCESS`). Linking a login to an agent copies the role, not access. A member's own role label comes from `portal_me()`. |
| `app/review.js` (`?v=3`) | Progress from `portal_learner_progress()` instead of reading `learn_progress`. Psychology now shows "N of 27 modules passed" with a bar (it used to say only "Studying"). |
| `app/learn/hub.js` (`?v=3`) | Amr's "N people have access" counts come from `portal_people()` (role + extras). Falls back to `members.access` on an older database. |
| `app/index.html`, `app/learn/index.html`, `app/sw.js` | Versions bumped; `talents-v83` → `talents-v84`. |

### Tests (`tools/portal-dev/`)

- `test-roles.sh` + `test-roles.sql` + `live-stubs.sql`: throwaway local Postgres. It loads every repo migration plus stand-ins for the live-only tables and functions, copied from your two exports (with a fake owner address). It seeds people like today's team and runs the migration **twice**.
- `smoke-r2.js` + `stub-supabase.js`: the changed pages in Chromium with a stand-in Supabase.

## 2. How I tested

**Database: 52 of 52 checks pass** (`bash tools/portal-dev/test-roles.sh`), after running the migration twice:

- Backfill: everyone is `agent`; `not_given` matches what each person lacked; `role = 'owner'` is refused; an invite sent with `role: 'member'` becomes `agent`; a new invite gets the full set.
- Same as before for today's people: nothing → nothing; `learn`+`mkt` → those two; `live` without the code; `team` only with the code. Switched off → nothing.
- New invite: Acquisitions, Deal tools (through `deal_access_status`), calculators; not Marketing, not Live now.
- Manager: everything but `team` without the code, `team` with it, never money. Approves someone else's request, not their own. Sees team shifts but not Amr's own (`owner` rows stay hidden, reviewer note 2). Sees every request. Reads no `learn_progress` rows. Gets progress for active members only, and only with the code.
- Agent: no shifts, only their own request, can't decide, no progress function.
- Amr: nothing without his code (Deal tools asks for it), everything with it. Reads nobody else's `learn_progress` rows. Pass counts are correct on sample data.
- Access log: one line per real change, the right actor and values, a line for a new invite, nobody can insert directly.

**Pages: 14 of 14 checks pass** (`smoke-r2.js`, at 390 and 1440, no console errors):

- An agent's menu shows the Learning Hub and Deal tools, not Live now or owner pages.
- A manager's menu shows Live now, Missed-shift requests and Team, but not Money or Invite.
- On an older database, the menu still comes from the extras list.
- The Review center shows "3 of 16 modules passed · 2 assignments sent" and "5 of 27 modules passed".
- Invite and access shows "Agent · extras: none" with no Money tick.
- Changing an old Operator to Agent in Settings writes `agents.role` and `members.role` only, never `access`.
- The Hub's owner counts come from `portal_people()`.

**No visual change** on the Learning Hub, the course players or `/course/`: the round 1 comparison against `main` is still 44 of 44 identical.

## 3. SQL to run (in order)

1. `supabase/migrations/20261030120000_portal_roles.sql`, all of it, in the SQL Editor. Expected notices: `members: dropped <old role check>`, `members: not_given added and filled for 4 rows`, `deal_access_status: now reads the role`. If you see `deal_access_status: the access check was not where expected`, nothing was changed by that step; send me its definition.
2. Check it (read only):

```sql
select name, role, access, not_given, active from public.members order by name;
-- expect: 4 rows, role agent, access {}, not_given {course,deals,learn}

select pg_get_functiondef('public.deal_access_status()'::regprocedure) like '%portal_keys_of(m.role, m.access, m.not_given)%' as deal_check_updated;
-- expect: true

select policyname from pg_policies where schemaname = 'public' and tablename = 'learn_progress' order by 1;
-- expect: learn_progress own delete / own insert / own read / own update (no "learn: own rows")

select count(*) from public.access_log;   -- expect 0 (the backfill isn't logged)
```

Safe to run again: a second run changes nothing (tested).

## 4. What Amr must do

- Nothing in the app. Nobody's access changes.
- **Order matters:** run the SQL before merging. The new `account.js` writes `members.role = 'manager'` or `'agent'`, which the old database refuses (it only allows `member`). The other pages fall back on an old database.
- **Kyle Miller** (active, no agent profile) becomes an Agent with nothing extra, like everyone else. Nothing to do unless that login shouldn't exist.

## 5. Judgement calls, and anything left

1. **Which keys need the authenticator.** `has_access` asked for it on every key except `live` and `requests`, but in practice it only gated `team` and `money`. The course checks never asked for it, and Deal tools have their own `deals_mfa`. Asking for it on `learn`, `course`, `mkt`, `psy` and `deals` would suddenly put an authenticator in front of every learner. So `portal_can` asks for it on every key except `live`, `requests`, `learn`, `mkt`, `psy`, `course` and `deals`. Any new key needs it until it's added to that list. Say if you want courses or Deal tools behind it too: it's one line in `portal_key_needs_code`.
2. **Reviewer decision: managers need the code to approve requests** (changed on this branch by the reviewer). Was: managers approve requests without the code, because `requests` never needed it. Approving adds a shift, which feeds pay. If you'd rather approvals need the code, change `portal_can('requests')` in `decide_shift_request` to also check aal2. It's one line, and I'll add the test.
3. **Managers see learner progress only with the code** (I treated it like `team`: other people's records).
4. **`team-access`** (not in the repo): nothing must change for round 2, thanks to the role trigger. In round 5 it should accept a `role` (`agent` or `manager`) on invite. Today it gets the column default, `agent`.
5. **Invite and access** still shows only extras as ticks, with the role in the summary line. Ticking an agent key that's in `not_given` (Deal tools, Learning Hub, Acquisitions) works, because extras win. The full role screen (screen 8) is round 5.
6. Settings > Agents keeps `agents.role` values `member` / `leader` (shown as Agent / Manager) so its existing check still passes. Round 5 can make `members.role` the only one.
7. Students aren't in `members` and aren't in this round (round 8).
