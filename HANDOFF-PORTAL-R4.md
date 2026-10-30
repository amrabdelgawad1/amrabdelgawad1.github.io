# Handoff: portal round 4 (Team home and Admin side)

Branch `portal-r4-homes`. Not merged. No SQL.

## 1. What changed

### `/app` now opens on a home

| Who | Lands on | What it is |
|---|---|---|
| Team member (agent or manager) | `#home`, Team home (screens 6 and 4) | Hero "Hi, {name}" with the clock state and a **Clock in / Clock out** button, **Continue learning**, **Your areas**, **Not open for you yet** (locked courses). |
| Amr | `#admin`, Admin overview (screen 5) | "N things need you today" with three numbers, and one box each for People, Learning, Deals, Money and Site. |
| Amr | `#portal`, Portal view (screen 1), through the new **Portal / Admin** switch in the bar | Greeting, today's numbers, six area cards, **Waiting for you** (reviews and missed-shift requests, each with its action). |
| Amr and managers | `#progress`, Learner progress | Name, course, modules passed, last active. Pass counts only (`portal_learner_progress`), never notes or practice work. A manager without the authenticator code is told they need it. |

- **The clock button is the tracker's own.** It presses the same Run / Off controls, so everything still applies: the end-of-shift note, saving offline, a shift ended on another device. No second copy of the clock logic. People with no company yet see "Amr needs to set the company…" and no button.
- **Continue learning** shows the first course open to them: Acquisitions from `course_state` (current module and its title), Marketing or Psychology from their own `learn_progress` row. A bar shows modules passed.
- **Your areas** (agent): My deals, Learning Hub, My hours, Calculators. Managers also get Team and shifts (with the request count) and Learner progress.

### The sidebar (Admin side)

The old drawer is **regrouped, not rebuilt**: same links, same pages, same `data-sec` rules, in screen 5's groups, in the dark look.

- **Amr:** Overview · People (Live now, Team and shifts with names, Missed-shift requests, Invite and access) · Learning (Learning Hub, Learner progress, Review center) · Deals (Deal CRM, Land calculator, House calculator) · Money (Cash, Income, Expenses, My time, Payments (later)) · Site (Visits, Emails, Zoho Campaigns).
- **Managers get the smaller side:** Portal, My hours · People · Learning (Learning Hub, Learner progress) · Deals. No Money, no Site, no Invite.
- **Agents get no sidebar.** They move around from their Team home and the Apps menu (screen 6 has no sidebar).
- A group heading hides itself when nothing under it shows. Counts are round numbers, as in the design, with "N waiting" read out to screen readers.

### The two fixes from the round 3 review

1. **Page name font.** `hub.css` sets every `h1`, `h2` and `h3` on `/app` to Bodoni with `!important` and a high-specificity rule, which beat my round 3 override. The fix uses id-level selectors (`h1#title`, `#pView`), so the bar title and all the new headings are Bricolage Grotesque, and card titles and text are Inter. The checks now read the **computed font**, which round 3's checks didn't.
2. **ADMIN on phones.** It shows as a compact label next to the logo, with the Portal / Admin switch beside it. To fit at 390, the page name and the theme switch hide on phones for Amr; the switch says where you are.

### Also

- `hub.css`: the old look forced square corners on everything (`border-radius:0 !important`). That one rule now stops at the portal parts (`#pView`, the bar, the sidebar counts). The old pages keep their square look until round 6.
- Old links all still work: `#track`, `#live`, `#people`, `#review`, `#learn` (→ `/app/learn/`), `#overview` and the rest. Someone opening a page they can't see lands on their home, as before.

### Files

`app/portal-home.js` (new) · `app/app.js?v=55` · `app/app.css?v=20` · `app/review.js?v=5` · `app/index.html` (view panel, regrouped sidebar) · `portal.css?v=3` · `portal-shell.js?v=2` (the switch, the compact label) · `hub.css?v=5` · `cash/index.html` (`hub.css` version) · `app/sw.js` `talents-v87` · `course/sw.js` `course-v12` · the four course and Hub pages (version bumps) · `tools/portal-dev/homes-r4.js` (new).

## 2. How I tested

**`homes-r4.js`: 108 of 108 checks pass**, at 390 and 1440, with the real CSP on. It covers:
- Landings for Amr and members, and the switch state on each side.
- Computed fonts: the bar title and hero are Bricolage, not Bodoni.
- The ADMIN label and Apps button showing, and round corners.
- The overview numbers and its five boxes, and the exact sidebar for Amr and for managers.
- The six Portal cards and the waiting list.
- The Learner progress table, for Amr and for managers.
- Agents: no sidebar; areas, locked courses and continue learning are right.
- **Clock in really starts a shift** (it writes `live_status`), and the button turns to Clock out. With no company yet there's no button.
- Old links, and agents bounced from `#live`.
- Screen fit, 40px tap targets and no console errors throughout.

The earlier checks were rerun on this branch: round 3 shell, 152 of 152; round 2 pages, 14 of 14. One round 2 check was updated on purpose: agents no longer have a sidebar.

Screenshots are on `portal-screens` under `r4/`.

## 3. SQL to run

None. Everything reads functions and tables that already exist (round 2).

## 4. What Amr must do

Nothing. After merging, his `/app` opens on the Admin overview, and the switch takes him to the Portal view.

## 5. Judgement calls, and anything left

1. **Deal numbers** (follow-ups due, open deals, under contract) aren't shown anywhere yet. They live in the private Deal CRM (round 7). The Deals box and card link to the CRM and the calculators instead of showing made-up numbers. The Portal hero shows shift requests where the design has follow-ups.
2. **The weekly team board** on the Team home is round 7, as the brief orders it.
3. **"Courses and access"** in the design's sidebar is the Learning Hub link (its owner view shows who has each course). Real per-course access editing comes with round 5.
4. The Team home's areas are a list on phones (screen 4) and cards on PC (screen 6).
5. **Still the old look until round 6:** the pages behind the sidebar links (Live now, Team, Requests, Cash and so on), the theme switch on PC, and Amr's "A" avatar.
