# Handoff: portal round 5 (Invite and access on roles)

Branch `portal-r5` (from `main` after round 4). Not merged. **No SQL. No change to `team-access`.**

## 1. What changed

### Invite and access (`/app/#people`), rebuilt to screen 8: `app/people.js` (new)

- **People list:** initials, name, "Since Sep 2026" (or "Turned off Oct 20", from the access log), and a role pill (Agent, Manager, Off). Filters **All, Agents, Managers, Off** with counts. Find a person by name or email. Students aren't here (brief: kept separate).
- **One person** (`#people/<user>` opens them directly; on PC the first person opens straight away; on a phone the person replaces the list, with "← All people"):
  - **Role:** four cards. Owner ("Only you") and Student ("coming later") show but can't be picked. Manager and Agent can.
  - **Extras** as tick boxes: Acquisitions course, Deal CRM and calculators, Marketing course, Psychology and Therapy course.
    - A box the role includes, and that's turned on, is **ticked and greyed** with "Comes with Agent" or "Comes with Manager", as the brief says.
    - A box the role includes but that is held back (today's team: everything in `not_given`, round 2 decision 3) is **unticked and can be ticked**, with "Comes with Agent, not turned on yet". That's how you turn on the Acquisitions course for today's agents.
    - The Learning Hub key follows the courses: on when any course is on.
  - **Deal tools** end date and "ask for an authenticator code" (the old switches, kept) show when Deal tools are on. **Works for** (company) is kept.
  - **What {name} will see:** chips built from role plus extras: Clock in and my hours, Live now, Missed-shift requests (approves them), Everyone's hours (with their code), Deal CRM or My deals, Calculators, each course, Learner progress.
  - **Access log**, from `access_log`, in words: "Marketing course added, Learning Hub turned on by Amr", "Role set to Manager by Amr", "Invited as Agent by the system", "Access turned off by Amr".
  - **Save changes:** one update to `members` (role, extras, `not_given`, company, Deal tools options), so it's one log line. It also keeps the person's agent card role in step. Disabled until something changes; leaving with unsaved changes asks first.
  - **Turn off {name}'s access**, with a confirm. It uses `team-access` `remove`, exactly as before. Someone who's off shows a red note, nothing editable, and **Turn {name}'s access back on** (`restore`). Email or WhatsApp a sign-in link is kept.
- **+ Invite someone:** name, email, works for, and **role (Agent or Manager)**. It calls `team-access` `invite` with exactly the same body as before. For a Manager, the page then sets `role = 'manager'` on the new row as Amr (allowed by "Owner manages members", and logged). New people get the full role set (`not_given` starts empty).

### Also

- `app/app.js?v=56`: the old access drop-down (about 117 lines) is removed; `callAccess`, `fillCompanies` and the companies list are shared with `people.js`. The sidebar marks Invite and access on `#people/<user>` too.
- `app/account.js?v=12`: Settings > Agents shows the role **read only**, with "Change it in Invite and access", which links to that person. One place for role and extras.
- `app/app.css?v=21`: the page's styles (`.pp-*`), the portal fonts, and focus on `#pPeople` (id-level, past `hub.css`).
- `hub.css?v=6`: its square-corner rule also stops at `#pPeople`.
- `app/index.html`, `cash/index.html` (`hub.css` version), `app/sw.js` `talents-v88`.
- Tests: `tools/portal-dev/people-r5.js` (new); the stand-in Supabase answers edge functions (`SB_INVOKE`); the round 2 Settings role check now expects the read-only role.

## 2. How I tested

**`people-r5.js`: 115 of 115 checks pass** at 390 and 1440, real CSP on. They cover:
- Filter counts and each filter, find a person, and the first person opening on PC versus the list first on a phone.
- Today's agent: role keys not on yet and tickable; ticking two courses updates the preview; Save writes exactly `{"role":"agent","access":["mkt"],"not_given":["deals"],...}` plus the agent card role.
- Manager: role extras ticked and greyed, and the manager preview (no money).
- Role change Agent → Manager saves the role.
- Access log in words with who.
- Turn off asks first, then calls `team-access` `remove`; someone off can only be turned back on.
- Invite as Manager calls `team-access` `invite` unchanged, then sets the role; the form checks the name.
- On a phone, the person replaces the list and back works. `#people/<user>` deep links work. An agent opening `#people` lands on their home.
- Screen fit, 40px tap targets and no console errors throughout.

Earlier suites, rerun on this branch: round 4 homes 108 of 108, round 3 shell 152 of 152, round 2 pages 14 of 14 (its two Settings and access-dropdown checks now check the new page).

Screenshots: `portal-screens` branch, `r5/`.

## 3. SQL to run

None. Saving writes `members` columns that exist since round 2 (`role`, `access`, `not_given`), as Amr, through the existing "Owner manages members" policy. The access log is written by the round 2 trigger.

## 4. What Amr must do

Nothing. To give today's agents their Acquisitions course or Deal tools: open them in Invite and access, tick the box ("Comes with Agent, not turned on yet"), and save.

## 5. `team-access`: no change needed now, and what to change later

Nothing in this round needs it. Inviting a Manager works by setting the role right after the invite. **Later, as a separate step**, so a Manager invite is one call and the log shows "Invited as Manager" in a single line:

1. `invite`: accept an optional `role` in the body (`'agent'` or `'manager'`; anything else → `'agent'`). Insert the `members` row with that `role` and `not_given = '{}'`. Return what it returns today.
2. `remove` and `restore`: no change. They already set `active`, which the trigger logs and which turns everything off at once.
3. In the brief's round 7 ("turning someone off moves their open deals to Amr"), `remove` (or a trigger on `members.active`) will also move that person's open deals to Amr. That needs the Deal CRM tables, so it waits for round 7.

When (1) is live, `people.js` can send `role` in the invite body and drop the follow-up update. It's a two-line change, safe either way.

## 6. Judgement calls, and anything left

1. **Held-back role keys can be ticked.** The brief says role-included boxes are ticked and greyed, and they are when turned on. But today's four agents have every agent key held back (round 2 decision 3). A greyed, unticked box would leave no way to turn them on, so those boxes stay tickable until they're on.
2. **Taking back one role key** (an agent without Deal tools, say) isn't offered once it's on. Roles define the defaults, as the brief says. If Amr wants it, it's one more state on the same boxes.
3. **"Turning off moves her open deals to you"** (screen 8) is not shown yet. Deals move in round 7. The note says "Turning off closes everything at once", which is true now.
4. The search box sits in the people list, not the top bar, because only this page searches people.
5. The rest of `/app` keeps its old look until round 6 (next PR, branched from this one).
