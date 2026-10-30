# Portal map (round 0)

What exists today on the signed-in side of amrabdelgawad.site, who can open what, and what will be hard. This is the plan for rounds 1 to 8. Read from `main` at `f593fe2` (PR #29).

---

## 1. Findings that change the plan

Read these first. Each one changes how a later round should be built.

1. **A role system already exists, in `agents.role`, not `members`.** Settings > Agents (`app/account.js`) gives each agent a role: `member` (Team member), `leader` (Team leader) or `operator` (Operator). Changing it rewrites that person's `members.access` from `ROLE_ACCESS` (`account.js` line 10): leader = `live`, `requests`, `team`; operator = leader plus `money`. Linking a login to an agent also overwrites `access` (line 485). Round 2 must replace this, not add a second role system next to it. Proposal in section 6.
2. **Money is not owner-only today.** `money` is a switch any member can have ("look only", with an authenticator code), and the Operator role grants it. The new table makes Cash and payroll owner-only. Anyone with `money` today would lose it. **Amr must decide** (section 9, question 1).
3. **Call data exists.** When someone ends a shift, the brief has optional Dials, Conversations and Appointments boxes (`app/app.js` lines 292 to 330). They are stored on `shifts` (`dials`, `conversations`, `appointments`) and already feed Amr's scoreboard in `cash/team.js`. So the weekly board can show "Calls logged" (dials) in round 7. It must come from a `security definer` function that returns only those counts, because `shifts` also holds hours and pay.
4. **`learn_progress` holds private practice.** The Psychology player saves the scratch pad (`pad:` keys) and pen drawings (`ink:` keys) into `learn_progress.data`, and Amr can read every row of `learn_progress` today (policy `learn_progress own read`). Thought records and goal plans are safe in `learn_notes`. Managers must **never** get read on `learn_progress`; their learner progress has to come from a function that returns pass counts only. **Amr should decide** whether his own read should be narrowed too (question 2).
5. **`/cash/` is not a standalone page on the live site.** `cash/early.js` sends anyone who opens `/cash/` on amrabdelgawad.site to `/app/#overview`. The cash pages only run inside an iframe in `/app` (`?embed=1`), where their own header is hidden. So in round 3 the shared top bar belongs to `/app` (the parent), and the cash frame gets no bar of its own.
6. **The deal pages are not like the rest.** `/app/deals/`, `/land-calculator/` and `/house-calculator/` have **no Content-Security-Policy meta tag**, use an **inline** `<script>DealGateStart(...)</script>`, and `deal-gate.js` replaces the whole page with `document.write()` of the HTML downloaded from the private `deal-tools` folder. Nothing in the repo can add the shared bar to the Deal CRM; the CRM file itself has to load `portal-shell.js` (round 7). The calculators stay exactly as they are (rule 5). Moving the inline call into a small file is a wrapper change only; I'd do it in round 7 and ask first.
7. **`/course/` blocks inline styles.** Its CSP has `style-src 'self' https://fonts.googleapis.com` with no `'unsafe-inline'`. The shared bar must use classes only (no `style=""` attributes, no `element.style`), or it will look broken there. `/course/` also has its own sign-in, authenticator and service worker.
8. **Managers need new write powers that are owner-only today.** Approving shift requests (`decide_shift_request`, not in the repo) and scoring in the Review center (`hub_review`, in the repo) both check `is_tracker_admin()`. Members with `requests` today are "look only". Round 2 (or the round that turns these on) has to change those functions; for `decide_shift_request` the reviewer must export it first.
9. **The design and the brief disagree in two places.** Screen 8 shows filters "Agents / Students / Off" and a student in the people list; the brief says "All, Agents, Managers, Off" and students kept in a separate table. I'll follow the brief (students are not in `members`). Screen 8's sidebar also differs from screen 5 (no icons, "Visits and emails" as one link); I'll follow screen 5 everywhere.
10. **Two Learning Hubs.** `/app/learn/` (`app/learn/hub.js`) is the course list. `app/learn.js` still serves `/app/#learn/<id>/...` (the older in-app tracks with the quick calculators). `/app/#learn` alone already redirects to `/app/learn/`. Old `#learn/<id>` links must keep working.
11. **Dark mode.** `/app` and `/cash` load `theme.js`, `theme-switch.css` and `daylight-dark.css` (a light/dark switch). The portal design is light only. Restyling those pages in round 6 drops dark mode unless Amr wants it kept (question 4).

---

## 2. Every signed-in page

"Opens with" is the check that lets someone in today. Owner means `is_tracker_admin()`.

| Page | URL | Code | CSS | Opens with | Reads | Writes |
|---|---|---|---|---|---|---|
| Talents app shell, sign-in, authenticator | `/app/` | `app/index.html`, `app/app.js` | `app.css?v=18`, `../theme-switch.css`, `../daylight-dark.css`, `../ask.css`, `../brand.css`, `../hub.css`, `learn.css`, `review.css` | signed in; owner, or active member (`my_profile`) | `is_tracker_admin`, `my_profile`, `members.access` | none |
| My tracker (clock in, history, briefs, requests) | `/app/#track` | `app/app.js` | as above | every active member (not stored in `access`) | `live_status` (own), `my_shifts`, `my_briefs`, `shift_requests` (own), `fx_rate_on`, `company_names` | `live_status`, `member_log_shift`, `member_add_brief`, `member_request_shift` |
| Live now | `#live` | `app/app.js` `loadLive` | as above | owner or `live` | `live_status`, `members`, `code_live_status`, `shifts` | owner: `owner_control_member`, `owner_control_code` |
| Missed-shift requests | `#requests` | `app/app.js` `loadOwnerRequests` | as above | owner or `requests` | `shift_requests` (all) | owner: `decide_shift_request` |
| Team emails | `#emails` | `app/app.js` `loadEmails` | as above | owner | `agent_summaries`, `tracker_settings` | `send_agent_summary` |
| Website visitors | `#visits` | `app/app.js` `loadVisits` | as above | owner | `visit_stats` | none |
| Invite and access | `#people` | `app/app.js` `loadPeople` | as above | owner | `members`, `companies` | `members` (access, `deals_until`, `deals_mfa`, `company_id`) directly; `team-access` edge function (invite, link, remove, restore) |
| Review center | `#review`, `#review/<user>` | `app/review.js` | `review.css?v=1` | owner (menu); database: `is_tracker_admin` | `hub_uploads`, `hub_upload_comments`, `learn_progress`, `members`, `course_admin_learners`, `course_admin_waiting`, bucket `hub-uploads` | `hub_review`, `hub_upload_comments` |
| Old in-app learning tracks | `#learn/<id>/...` | `app/learn.js` | `learn.css?v=4` | owner, or `learn` plus the course key | `learn_progress` (own) | `learn_progress` (own) |
| Cash: Overview, Income, Expenses, My time, Team (`#team/<name>` + payslips bar) | `/app/#overview` etc., framed `/cash/?embed=1` | `cash/index.html`, `cash/cash.js`, `cash/team.js`, `cash/early.js` | `../style.css`, `look.css?v=16`, theme files, `../hub.css` | owner; `money` (look only) for Overview/Income/Expenses; `team` (look only) for Team; `My time` owner | `cash_entries`, `shifts`, `companies`, `fx_rates`, `tracker_settings`, `agents`, `agent_companies`, `payslips`, `company_code_status` | owner only: `cash_entries`, `shifts`, `tracker_settings`, `agents`, `agent_companies`, `payslips`, `set_company_code`, bucket `payslips` |
| Account menu, My profile, Settings (Agents, Dollar rates, Backup) | sheet inside `/app` | `app/account.js` | `app.css` | everyone (profile, password); owner (Agents, rates, backup) | `profiles`, `agents`, `agent_companies`, `members`, `payslips`, `fx_rates`, `my_card`, buckets `avatars`, `payslips` | `profiles`, `agents` (owner), `members.access` and `agent_id` (owner), `rename_agent`, `team-access` |
| Learning Hub home | `/app/learn/` | `app/learn/index.html`, `hub.js` | `/app/course/course.css?v=9`, `hub.css?v=1` | owner, or `learn_can_open('learn')`, or any open course | `is_tracker_admin`, `learn_can_open`, `course_has_access`, `course_state`, `learn_progress` (own); owner: `members`, `hub_uploads` count, `course_admin_waiting` | none |
| Marketing course player | `/app/course/` | `app/course/player.js`, `tools.js`, `strings.js`, `marketing/course.js` | `course.css?v=9`, `tools.css?v=1` | owner, or `learn_can_open('mkt')`; refuses non-owners while `COURSE.team` is false | `is_tracker_admin`, `learn_can_open`, bucket `course-content/mkt`, `learn_progress`, `learn_notes` | `learn_progress`, `learn_notes`, `hub_uploads` |
| Psychology course player | `/app/psychology/` | `app/psychology/gate.js`, `player.js`, `course.js`, `strings.js`, `../course/tools.js` | `../course/course.css?v=9`, `psy-content.css?v=2`, `../course/tools.css?v=1` | owner, or `learn_can_open('psy')` | as Marketing, folder `psy` | `learn_progress` (incl. `pad:` and `ink:`), `learn_notes` |
| Acquisitions course app | `/course/` | `course/app.js`, `practice.js`, `md.js`, `admin.js`, `sw.js` | `course.css?v=2`, `hub.css?v=5` | `course_has_access()` (switch `course` only, no `learn` needed) | `course_state`, `course_attempt_result`, bucket `course`, `hub_uploads` (own) | `course_*` functions, `hub_uploads`, bucket `hub-uploads` |
| Acquisitions admin | `/course/#/admin...` | `course/admin.js` | as above | `course_is_admin()` (owner with authenticator, aal2) | `course_admin_*` | `course_review`, `course_add_module`, bucket `course` |
| Deal CRM | `/app/deals/` | `app/deals/index.html`, `/deal-gate.js`; real code `deal-tools/crm.html` (private) | its own inline styles | `deal_access_status` (owner, or `deals` with `deals_until` and `deals_mfa`) | unknown (in the private file) | unknown |
| Land and house calculators | `/land-calculator/`, `/house-calculator/` | `deal-gate.js`; real code in `deal-tools` | own | same as Deal CRM | unknown | unknown |
| Old redirects | `/tracker/` → `/app/?from=tracker`; `/tracker/admin/` → `/cash/#team` | static | inline | none | none | none |

Public pages (`/`, `/cv/`, `/book/`, `/call/`, `/sample-report/`) are out of scope.

---

## 3. Every place that decides who sees what

### In the browser (tidiness only)

| Where | What it decides |
|---|---|
| `app/app.js` `route()` (line 111) | owner vs member vs no access vs switched off; owner needs the authenticator first |
| `app/app.js` `startMember()` (line 171) | members with no extras get one page and no menu |
| `app/app.js` `SECTION`, `SECTION_NAMES`, `COURSE_KEYS`, `canSee()`, `hasMenu()` (lines 487 to 497) | which menu links and pages show; `owner` pages are Amr's alone; `hub` link shows with `learn` or any course key |
| `app/app.js` `menuRoute()` (line 556) | unknown or forbidden page falls back to `#live` (owner) or `#track` |
| `app/app.js` `loadPeople()` (line 904) | the access tick list, course ticks greyed until `learn` is on, Deal tools end date and two-step |
| `app/index.html` drawer `data-sec` attributes (lines 281 to 307) | which link belongs to which switch |
| `app/account.js` `ROLE_ACCESS`, `isOwner()`, `TABS()` (lines 10, 37, 154) | agent roles, Settings tabs |
| `app/learn.js` `TRACKS[].key`, `canOpen` | old in-app track locks |
| `app/learn/hub.js` `start()`, `canOpen`, `owner` (lines 128 to 150) | hub cards open or locked; owner tools and counts; "View as learner" |
| `app/course/player.js` `OWNER_ONLY`, `owner` (lines 8, 622 to 663) | Marketing course team switch, owner side view |
| `app/psychology/gate.js` (lines 80 to 100) | Psychology open or refused |
| `course/app.js` `S.isAdmin` (lines 306, 924, 998) | admin links and routes |
| `cash/cash.js` `openDash()` (line 99) | `look-only` class hides add, edit and pay for non-owners |
| `cash/early.js` | `/cash/` outside the app frame goes to `/app/` |
| `deal-gate.js` | Deal tools open, expired, need two-step, or none |

### In the database (the real lock)

| Function or policy | Where | Rule |
|---|---|---|
| `is_tracker_admin()` | not in repo | Amr |
| `my_profile()`, `my_card()`, `company_names()` | not in repo | own row, names only |
| RLS on `members`, `live_status`, `shifts`, `shift_requests`, `companies`, `agents`, `agent_companies`, `cash_entries`, `payslips`, `tracker_settings`, `profiles`, `fx_rates`, `code_live_status`, `site_visits` | not in repo | unknown; includes the "look only" and authenticator rules for `team` and `money` |
| `decide_shift_request`, `owner_control_*`, `agent_summaries`, `send_agent_summary`, `visit_stats`, `member_*`, `deal_access_status`, `can_use_deal_tools` | not in repo | unknown |
| `team-access` edge function | not in repo | invite, link, remove, restore |
| `learn_can_open(key)` | `20261028180000` | owner, or active with `learn` and `key` |
| `course_is_admin()`, `course_has_access()`, `course_require_*` | `20261028120000` | owner with aal2; or active with `course` |
| `hub_can_send(course)`, `hub_review()`, `hub_uploads` / `hub_upload_comments` policies | `20261029060000`, `20261029070000` | sender needs the course; only owner reads all and scores |
| `learn_progress` policies | `20261028233000` | own rows; owner reads all |
| `learn_notes` policies | `20261029010000` | own rows only, nobody else |
| `course-content`, `course`, `hub-uploads` bucket policies | migrations above | per course key; owner writes |
| `members_access_check` constraint | live only; widened by `20261028220000`, `20261028230000` | allowed values in `access` |
| `members` columns used by the site | live only | `user_id`, `name`, `email`, `company_id`, `active`, `access`, `created_at`, `agent_id`, `deals_until`, `deals_mfa` |

---

## 4. Where each new screen's numbers come from

| Screen piece | Source today | Gap |
|---|---|---|
| Clocked in now | `live_status` + `code_live_status` (as `loadLive`) | none |
| Missed-shift requests waiting | `shift_requests` count `status = 'pending'` (as `countRequests`) | none |
| Review center waiting | `hub_uploads` waiting count + `course_admin_waiting` (as hub `loadOwner`) | none |
| On the team, who has which course | `members` (owner read) | none |
| Learner progress | owner: `course_admin_learners` + `learn_progress` | manager needs a pass-count function (finding 4) |
| Deal follow-ups due, open deals, under contract | inside the private Deal CRM | need the CRM file and its table names (round 7) |
| Cash this month | `cash_entries` | none (owner) |
| Visits this week | `visit_stats(p_hours := 168)` | none |
| Emails and sign-ups | `agent_summaries`; sign-ups source unknown | ask Amr what "sign-ups" means (newsletter?) |
| Course payments | nothing | placeholder "Not set up yet" |
| Team home: hours today, clock in or out | `live_status` own row, `drawClock` | reuse, don't rewrite |
| Continue learning (course, module, lesson, %) | Acquisitions: `course_state`; Marketing and Psychology: `learn_progress` own row + device copy | "last lesson" isn't stored for Acquisitions; I'll use the first open item from `course_state` |
| Weekly board: calls, lessons passed, drills sent | `shifts.dials`; `course_item_done` / quiz passes; `hub_uploads` + `course_submissions` | one new `security definer` function returning names and three counts only |
| Search box | nothing | round 3 ships it only on pages that can search (people, deals); hidden elsewhere |

---

## 5. Shared pieces: how they'll fit

- **One Supabase client per page.** Every page makes its own today (`app.js` → `window.TalentsApp.db`, `hub.js`, `player.js`, `gate.js`, `course/app.js`, `cash.js`, `deal-gate.js` → `window.DealGate.db`). `portal-shell.js` will not create a client. Each page passes its client in (`PortalShell.start({ db, page, ... })`) after its own sign-in check, so nobody gets a second session or a surprise sign-out.
- **Bar on signed-out screens.** The bar draws only after the page knows who you are. Sign-in, authenticator and "no access" screens keep their current look.
- **Course pages** keep their progress bar, language button and "View as learner" inside the bar through a slot (`PortalShell.slot()`), as the brief asks.
- **Classes only** in the shell (finding 7). The Apps menu is a real `<button aria-expanded>` with a list of `<a>`.
- **Apps menu data** comes from one call, `portal_my_apps()` (round 3, or computed from `portal_can` per key), plus counts only for what the person may see.
- **Test mode.** `window.PORTAL_TEST = { role, extras, counts }` read by `portal-shell.js` and the new homes, same idea as `window.HUB_TEST`.

---

## 6. Roles in the database (round 2 proposal)

- `members.role text not null default 'agent' check (role in ('manager','agent'))`.
- **Backfill from what exists**, so nobody's access changes:
  - linked agent with `agents.role = 'leader'` → `manager`
  - linked agent with `operator` → `manager`, and `money` stays in `access` as a legacy extra until Amr decides (finding 2)
  - everyone else → `agent`
  - then `access` keeps everything that isn't already a role key. Nothing is removed from `access` in round 2.
- **But "agent" grants more than today.** The suggested agent keys are `deals`, `learn`, `course`. Today many members have only the tracker. If round 2 turns on `deals` and `course` for every agent, people gain the Deal CRM and the Acquisitions course overnight. That breaks "keep exactly the access they have today". Two ways out:
  - **A (my pick):** `portal_role_keys('agent')` returns the keys, but the backfill marks today's people with an opt-out list (`members.not_given text[]`) holding any agent key they don't have today. New invites get the full agent set. The preview on screen 8 shows unticked boxes for those.
  - **B:** ship agent keys as `{}` until Amr has looked at each person, then fill them in.
  I'll build A unless the reviewer or Amr prefers B.
- `agents.role` stops writing `members.access`. Settings > Agents shows the role read-only with "Change it in Invite and access". `ROLE_ACCESS` goes.
- `portal_role()`, `portal_role_keys(role)`, `portal_can(key)` as in the brief. `portal_can` keeps the existing rules: courses `mkt` and `psy` still need `learn`; `course` doesn't; `deals` also respects `deals_until` (and leaves the two-step check to `deal_access_status`).
- `learn_can_open` and `course_has_access` are rewritten to call `portal_can`, with the same answers. `course_is_admin` stays as is (owner plus authenticator).
- `access_log` (id, at, actor, target, change jsonb) written by an `after update or insert` trigger on `members` comparing `role`, `access`, `active`, `deals_until`, `deals_mfa`. The actor is `auth.uid()`; changes made by the `team-access` function (service role) are logged with actor null, shown as "System".
- SQL test script runs on the local Postgres from `tools/course-dev/` (it already stubs `auth.uid()`, `members` and `is_tracker_admin()`), checking owner, manager, agent and switched-off answers for every key.
- **Before round 2 runs live**, the reviewer runs the read-only query in `HANDOFF-PORTAL-R0.md` so we can list every person's current `access` and agent role, and spot anyone who won't map cleanly.

---

## 7. Hard parts, by round

| Round | Hard part | Plan |
|---|---|---|
| 1 | Loading `portal.css` before `course.css` on four pages without any visible change | Move tokens and shared components only; page CSS keeps overriding. Pixel diff before and after at 390 and 1440 with Playwright |
| 2 | Old tables' rules aren't in the repo; `money` and Operator; agent defaults wider than today | Section 6; reviewer exports policies for `members` first |
| 2/4 | Manager approving requests and scoring | Needs `decide_shift_request` (not in repo) and `hub_review` changed; ask reviewer to export the first |
| 3 | `/course/` CSP, its own sign-in and service worker; cash in an iframe; six different page headers | Classes only; slot for course controls; shell on `/app` parent for cash |
| 4 | `app/index.html` is one page with ten panels and a drawer; Admin side must regroup `OWNER_PAGES` without rebuilding | Keep panels and hash routes; replace the drawer with the dark sidebar on PC and a sheet on phones; map old hashes 1 to 1 |
| 4 | Screen 5 "Learner progress" and "Courses and access" aren't separate pages today | Learner progress = Review center's people view; Courses and access = Invite and access filtered to courses. Links, not new pages |
| 5 | Invite flow and "turn off" live in `team-access` (not in repo); turn off must also move open deals | Write exactly what the function must change; deal move waits for the CRM tables (round 7) |
| 6 | `cash/index.html` is 1,140 lines with its own look, dark mode and `style.css` | One area per commit; keep `look-only` behaviour |
| 7 | Deal CRM code is private, uses `document.write`, no CSP | Ask Amr for `crm.html` in the round 6 handoff; restyle that file; "own only" in RLS on its tables |
| 7 | Board without leaking pay or hours | One function returning name, dials, lessons passed, drills sent for this week |
| all | Service workers | Bump `talents-v83` and `course-v9` every round that changes a cached file; add `portal.css` and `portal-shell.js` to both `SHELL` lists |

---

## 8. Old links that must keep working

`/app/#track`, `#live`, `#requests`, `#emails`, `#people`, `#visits`, `#learn` (→ `/app/learn/`), `#learn/<id>/...`, `#review`, `#review/<user>`, `#mytime`, `#overview`, `#team`, `#team/<name>`, `#income`, `#expense`; `/app/?from=tracker`; `/cash/#...` (→ `/app/#...`); `/tracker/`, `/tracker/admin/`; `/course/#/...` including `#/admin...` and `#/install`; sign-in links with `#type=...` and `#error_description=...` in the hash (read at the top of `app.js`).

---

## 9. Decisions from Amr (Oct 30)

1. **Money:** owner only. Operator becomes Manager without money. Round 2 does **not** drop `money` from anyone's `access`; the reviewer confirms names and removes it in the same SQL run. `portal_can('money')` returns true for the owner only, whatever `access` says.
2. **Scratch pad and pen drawings:** private to the learner. Round 2 moves `pad:` and `ink:` out of anything Amr can read (or narrows the owner read on `learn_progress`). Amr and managers get learner progress only from a pass-count function.
3. **Current team keeps exactly what they have.** Option A from section 6: a `not_given` list on today's members for any agent key they don't have. New invites get the full Agent set.
4. **Dark mode:** dropped in restyled pages. All colors live as tokens in `portal.css` so dark mode can come back later.
5. **"Sign-ups" removed.** The newsletter is in Zoho Campaigns, not Supabase. The Site box shows Visits and Team emails, plus a plain "Open Zoho Campaigns" link.
6. **Screen 8:** follow the brief. No students in the members list; filters are All, Agents, Managers, Off.
