# Handoff: portal round 3 (`portal-shell.js`, the shared top bar)

Branch `portal-r3-shell`. Not merged. No SQL.

## 1. What changed

### `portal-shell.js` (new)

One script draws the same bar on every signed-in page: logo, page name, **Apps** (screen 2), the person's initials and name, and the orange **ADMIN** label for Amr on `/app`.

- **It joins the page's own header** instead of replacing it. The course pages keep their menu button, search, progress, language buttons and "View as learner" in the bar, and their scripts still find them by id. Links the bar replaces ("Back to app", "All courses") are hidden, not removed.
- **One Supabase client per page.** The page passes its own in; the shell never creates one, never signs anyone in, and signs out only from its own account menu (pages without one).
- **The Apps menu lists only what the person can open**, from `portal_me()` (round 2). Groups: Work, Learning, Team, Money. The current app is highlighted.
  - Agent: My hours, Deal CRM, both calculators, Learning Hub.
  - Manager: the agent list plus Team and shifts.
  - Amr: everything, plus Review center, Invite and access, Cash ("Only you") and the footer line from the design.
- **Counts only for people allowed to see them:** "N waiting" on Review center (Amr), "N request(s)" on Team and shifts (Amr and managers). A dot on the Apps button means something is waiting. `/app` passes on counts it already makes (`PortalShell.setCount`), so there's no second query.
- **"Needs your code"**: when every key that opens an item is still waiting on the authenticator (`needs_code`), the item stays listed with that note instead of disappearing (reviewer note from round 2).
- **Keyboard:** Apps is a real button (`aria-expanded`, `aria-controls`). Enter opens it and moves focus inside; Escape closes it and gives focus back; a click outside closes it.
- **No inline styles anywhere** (`/course/` forbids them). All styles are in `portal.css`.
- **Test mode:** `window.PORTAL_TEST = { role, keys, needs_code, name, counts }`. The Hub and course players also pass their own test modes through.

### Pages

| Page | Change |
|---|---|
| `/app/` (`index.html`, `app.js?v=54`, `app.css?v=19`, `review.js?v=4`) | The header is now the portal bar: menu button (until round 4 replaces the drawer), "A" + page name, ADMIN for Amr, Apps, theme switch, account circle + name. The account circle keeps its own menu (`account.js`). `app.js` tells the bar which app is open on every hash change and passes on the requests count; `review.js` passes on the review count. Loads Bricolage Grotesque for the page name. |
| `/app/learn/` (`hub.js?v=4`) | Bar with the Hub's own brand; "Back to app" moves into Apps. |
| `/app/course/` (`player.js?v=14`), `/app/psychology/` (`gate.js?v=5`) | Bar around the course's own controls; "All courses" moves into Apps. |
| `/course/` (`app.js?v=7`) | Bar around the course's own controls. Its account button stays (install, sign out) and now shows the person's name next to it. |
| `/cash/` | Nothing. It only runs inside `/app` (round 0 finding 5), so it gets the bar from `/app`. |
| `portal.css?v=2` | The bar on a page's own header, the Apps panel, the account menu, phone rules. |
| Service workers | `app/sw.js` `talents-v85` and `course/sw.js` `course-v11`; both now cache `/portal.css?v=2` and `/portal-shell.js?v=1`. |

### Tests

`tools/portal-dev/shell-r3.js`: every page, as owner, manager, agent and switched off, at 390 and 1440, with each page's **real Content-Security-Policy on**. The stand-in Supabase is served from the site, so `script-src 'self'` allows it.

## 2. How I tested

**152 of 152 checks pass** (`node tools/portal-dev/shell-r3.js`). Ten states at two widths, covering `/app` as owner, manager, agent and switched off; the Learning Hub as owner and agent; Marketing; Psychology; and Acquisitions signed in and signed out. Each state checks:

- one Apps button once the page knows who you are, and none before (signed out, switched off)
- nothing wider than the screen, and the bar 56 to 70px tall
- Enter opens the menu and moves focus inside; Escape closes it and returns focus
- the exact list of apps for that person, and the menu fits on the screen
- bar buttons at least 40px; no console errors (so no CSP violations)

The round 2 page checks still pass (14 of 14).

Screenshots of every state, closed and with Apps open, are on `portal-screens` under `r3/`.

## 3. SQL to run

None.

## 4. What Amr must do

Nothing.

## 5. Judgement calls, and anything left

1. **The Portal / Admin switch isn't in this round.** There is no Portal view to switch to until round 4 builds the Team home and Admin side. A switch that leads nowhere would be worse than none. The shell already has the styles (`.p-mode`); round 4 turns it on. The ADMIN label is in.
2. **Search box:** only the course pages have search today, and they keep theirs. `/app` gets one when there's something to search (people in round 5, deals in round 7).
3. **Calculators are two items** ("Land calculator", "House calculator") instead of the design's single "Land and house calculators". The design's item would need one place that leads to both, and the calculators must stay as they are.
4. **`/app` still has its drawer and theme switch** until round 4 (sidebar) and round 6 (restyle, dark mode dropped). The bar itself is light only. The drawer starts below the bar.
5. **On phones**, course pages drop the progress track (the % stays) and "View as learner" (it's also in the course sidebar), so everything fits at 390.
6. **Not mine to fix in this round:** the course pages' EN / ع language buttons are 34 to 35px wide (the page's own; round 6). Amr's avatar on `/app` shows "A" (set by `app.js` and `account.js`); the other pages show "AA" as in the design. Round 6 can make them match.
7. The Deal CRM and calculators don't get the bar here: the CRM file is private (round 7), and the calculators stay as they are.
