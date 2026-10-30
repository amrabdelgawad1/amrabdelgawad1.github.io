# Handoff: portal round 6 (restyle the remaining pages)

Branch `portal-r6`, **branched from `portal-r5`**. Merge round 5 (#35) first, then this. Not merged. **No SQL.**

## 1. What changed

Only how pages look, never what they do. One area per commit:

| Commit | Area |
|---|---|
| 1/6 base | `hub.css`, the look file every `/app` and `/cash` page already loads, keeps all its variable names but takes its values from `/portal.css`: Bricolage Grotesque headings, Inter text, portal orange, paper and white, round corners. Its old square-corner rule and gold line on cards are gone. **Light only:** dark mode, its switch, `theme.js`, `daylight-dark.css`, `theme-switch.css`, `brand.css` gold and the gold line art (`hub-art.js`) come off `/app` and `/cash`. Settings loses its Appearance tab. A saved dark choice is ignored. `/cash` now loads `/portal.css` first. The cash "net" box uses the dark hero style. |
| 2/6 | Buttons, pills and focus everywhere: sentence-case buttons at 44px (40px small); soft round pills (Working, Unpaid, Received…); an orange focus ring. |
| 3/6 | My hours: Run / Pause / Break / Off in sentence case on white; Run when on is portal green; the weekly goal bar is solid orange. |
| 4/6 | Settings (plain active tab with an orange edge, no italic Bodoni), switches, Visits bar charts, agent numbers, the sign-in heading. |
| 5/6 | Cash (Overview, Income, Expenses, My time, Team): sentence-case toggles with the dark selected state, soft orange "You" and "Team" tags, an orange month outline. Charts: money in is green, kept is orange, out is red (they read the `--c-*` variables). The Review center comes along through steps 1 and 2. |
| 6/6 | **The update toast** ("A new version of the app is ready") and the plain toast: the portal's dark toast with an orange Update button (was black and gold). |

Live now, Missed-shift requests, Team emails and Visits needed no page-specific rules: they're built from cards, tiles, buttons and pills, which steps 1 and 2 cover.

All colors live in `/portal.css` tokens. `hub.css` only points at them, so dark mode can come back later as one block of `--p-*` values.

### Files

`hub.css?v=7` · `app/index.html` · `cash/index.html` · `app/account.js?v=13` · `app/sw.js` `talents-v89` (its offline list drops the theme files) · `course/sw.js` `course-v13` · `portal.css?v=4` links bumped on every page (the file itself is unchanged since round 5) · `tools/portal-dev/look-r6.js` (new). The theme files themselves stay in the repo: the public site still uses them.

## 2. How I tested

**`look-r6.js`: 130 of 130 checks pass**, at 390 and 1440, real CSP on, across 13 areas:
- My hours, Live now, Missed-shift requests, Visits, Team emails, Review center
- Settings and the update toast
- Cash Overview, Income, Expenses, Team and My time

For each area it checks:
- **it still shows its data**
- **no old-look font** (Bodoni, Barlow, DM Serif) on any visible text
- **no old-look color** (champagne gold, magenta, cream, the old blue, near-black) on any visible text, background or border
- no dark-mode switch, even with `theme=dark` saved on the device
- nothing wider than the screen, and no console errors

Every earlier suite was rerun on this branch: round 2 pages 14 of 14, round 3 shell 152 of 152, round 4 homes 108 of 108, round 5 people 115 of 115.

Screenshots of every area at both widths: `portal-screens` branch, `r6/`.

## 3. SQL to run

None.

## 4. What Amr must do

Nothing. Anyone who had picked dark mode sees the light portal look; nothing breaks.

## 5. Judgement calls, and anything left

1. **Restyled through `hub.css`'s variables rather than rewritten.** Every `/app` and `/cash` page and the cash charts already read those variables, so pointing them at the portal tokens restyles everything at once without touching markup or behaviour. The few rules that hard-coded the old look (uppercase letter-spaced buttons, italic tabs, gold gradients, black text on gold) were rewritten in place.
2. **Small uppercase labels stay** (tile and table headings like "WORKING", "AMOUNT"). They match the portal's kickers ("5 ON THE TEAM" on screen 5).
3. **Not covered here:** the Deal CRM and the calculators (round 7, and the calculators stay as they are), and the course language buttons (34 to 35px, noted in round 3). They're each page's own.
4. **The PR base is `portal-r5`**, so the diff shows only round 6. If GitHub doesn't switch it to `main` by itself when #35 is merged (it does when the `portal-r5` branch is deleted), change the base to `main` before merging.
