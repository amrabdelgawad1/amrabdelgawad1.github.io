# Handoff: portal round 1 (`portal.css`)

Branch `portal-r1-css`. Not merged.

## What changed

| File | Change |
|---|---|
| `portal.css` (new) | Design tokens as `--p-*` and the shared pieces as `.p-*` classes: top bar, Apps menu, Admin label, Portal / Admin switch, search, avatar, icon tile, count, pills, buttons, page frame, dark hero with stat boxes, cards and rows, area cards, progress bar, locked note, table, dark admin sidebar. No element selectors (`body`, `a`, `h1`...), so loading it changes nothing by itself. |
| `app/course/course.css` (`?v=9` → `?v=10`) | Its token names now point at the portal tokens (`--accent:var(--p-accent)` and so on). Same values. |
| `course/hub.css` (`?v=5` → `?v=6`) | Same, for every Acquisitions token whose value matches the portal. Two that differ stay as they were (`--orange-softer`, `--hero-2`). |
| `app/learn/index.html`, `app/course/index.html`, `app/psychology/index.html`, `course/index.html` | Load `/portal.css?v=1` first, before the page's own CSS. |
| `course/sw.js` | `VERSION` `course-v9` → `course-v10`; `SHELL` now has `hub.css?v=6` and `/portal.css?v=1`. |
| `tools/portal-dev/` (new) | The visual check used below (`shots.js`, `diff.py`), a stand-in Supabase for test runs (`stub-supabase.js`), and `specimen.html`, a sample page of every shared piece with made-up numbers. |

`app/sw.js` is unchanged: none of its cached files changed. It caches `/portal.css` on first use like any other file under `/app/`.

### Why `--p-` names

`/course/` already uses `--body` as a text color and `--bg` as the page color, while the course players use `--body` as a font. Un-prefixed portal tokens would clash on whichever page loads them. With `--p-*`, a color lives in one place and each page keeps its own names pointing at it. Dark mode later is one more `:root` block for the `--p-*` colors.

## How I tested

`tools/portal-dev/shots.js` ran against `main` and this branch, served side by side. It covers 11 states at 390px and 1440px:

- Learning Hub as owner, as an agent with one course, with nothing open, and with no connection
- Marketing course home and its no-connection screen
- Psychology course home and its no-connection screen
- Acquisitions sign-in, "not on the course" and no-connection screens

Course content is a small made-up sample. Fonts and Supabase were blocked on both sides so the comparison is exact.

**Result: 44 of 44 identical.** That's 22 screenshots matching pixel for pixel, plus 22 computed-style dumps (color, background, font, size, border, radius, spacing, width and height of every element) matching exactly. No page errors and no console errors (the real Content-Security-Policy stayed on, except for the two stand-in Supabase runs).

Screenshots are on the `portal-screens` branch under `r1/` (linked in the PR), not in the site.

I also measured the new pieces on `specimen.html`: buttons, sidebar links and the avatar button are 44px tall, and the locked note is 52px.

## SQL to run

None.

## What Amr must do

Nothing.

## Left or unsure

- At 390px the **admin** version of the top bar (logo, Admin label, Portal / Admin switch, name) is 56px wider than the screen. The phone layout of the bar belongs to round 3 (`portal-shell.js`), which will fold the switch and the name on small screens. The team member bar (screen 4) fits.
- If `/portal.css` ever failed to load, the course pages would lose their colors, because their tokens now point at it. It is same-origin, in `/course/`'s offline cache, and cached by `/app/`'s service worker on first visit, so I think this is fine. Say if you'd rather each page keep a fallback value (`var(--p-accent, #C2410C)`).
- `app/learn/hub.css`, `app/course/tools.css` and `app/psychology/psy-content.css` still hold a few literal colors of their own (the locked card art greys, for example). I left them: they're unique to those pages.
