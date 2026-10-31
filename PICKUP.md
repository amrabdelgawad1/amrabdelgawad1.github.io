# Where things stand (Oct 31, 2026)

Pick up from here. Every item below is merged to `main` and live unless it says otherwise.

## Done and live
| Milestone | PR | Database |
|---|---|---|
| Staging: test copy of the live structure, no live data | #40 (`tools/staging/`) | Supabase project "staging (test copy of team-tracker)", ref `klwwylrqltuqvijzriov` |
| Logs: errors, activity, change log, Admin > Logs (`/app/#logs`) | #40 | `20261031090000_portal_logs.sql` |
| Data model doc (`DATA-MODEL.md`), sign-ins in the activity log | #41 | `20261031100000_portal_signins.sql` |
| Students plan (`PORTAL-STUDENTS.md`), plan only | #38 | none |
| Locked-CRM page check in `crm-r7.js` | #39 | none |
| Phase 1: call counter on My hours | #42 | `20261031110000_call_events.sql` |
| Phase 1: calls count while the shift runs; Calls today on the Admin overview | #44 | `20261031120000_calls_today.sql` |
| Phase 1: do-not-call list (reps check and add on My hours; Amr's list and CSV in Logs) | #45 | `20261031130000_dnc.sql` |
| Report a problem or idea (Apps menu, every page; Logs > Feedback) and one pinned announcement on the Team home | #46 | `20261031140000_feedback_announcements.sql` |
| Phase 2: buyers list in the database, `buyer_matches`, buyers move with the team passphrase change and to Amr on turn-off; fix for turning someone off twice | #48 | `20261031150000_buyers.sql` |
| Phase 2: the Deal CRM shares buyers with the team, shows "The team's buyers" (Amr, managers with the code) and "Buyers who fit" in every real deal | #49 (checks only) | none; private `deal-tools/crm.html` updated, see below |
| Phase 2: deals split, `deals` (working fields readable, the rest encrypted) and `deal_events` (history, kept on delete); passphrase change and turn-off carry them; `ROADMAP.md` | #50 | `20261031160000_deals_split.sql` (staging, then live). CRM file uploaded Oct 31 |
| Phase 1: Today screen on the Team home (today's numbers, callbacks due, deals needing action, next lesson); a Today row opens that deal in the CRM | #52 | `20261031170000_today.sql` (`portal_my_today`, staging then live). CRM file uploaded |
| Phase 1: end-of-day reports on the Admin overview (today or yesterday: sent, no report, on shift, didn't work, with hours, numbers and notes) | #54 | `20261031180000_eod.sql` (`portal_eod`) |
| Fix: clocking out on the tracker now clears Live now, and the same shift is never saved twice (Amr's End on an already-saved shift just clears Live now) | #54 | `20261031190000_shift_dupes.sql` (two triggers on `shifts`) |
| Phase 1: pipeline board. Deal CRM Board view (five stage columns) and List/Board switch; contract signed, inspection ends and closing dates on deals under contract, with countdowns in the CRM, on Today and on the Admin overview (Closing in 14 days, Inspection ending in 7 days) | #55 | `20261031200000_deal_dates.sql` (three date columns on `deals`, staging then live). CRM file uploaded |
| Phase 1: notifications. Bell in the shared top bar (`portal-shell.js`), Ask for access on locked courses (Team home, Learning Hub). Fix: the Review center opened empty when /app loaded straight onto #review (app.js now waits for every script before the first route) | #57 | `20261031210000_notifications.sql` (`notifications` table, triggers on shift_requests, hub_uploads, course_submissions, deal_events, feedback) |
| Phase 2: deal folder. Files on each deal (encrypted in the browser with a per-file key; name, type and key on the team key; private bucket `deal-files`), title company saved with the deal (encrypted), due diligence checklist (readable ticks, progress on the board). Passphrase change carries file names and keys | #59 | `20261031220000_deal_folder.sql` (`deal_files`, `deal_checklist`, bucket and storage rules, `deal_rekey` extended). CRM file updated |
| Phase 2: deal sheet maker. "Make a deal sheet" in every real deal's folder: one page for buyers (asking price, per acre or value after repairs and repairs, up to 4 folder photos decrypted in the browser, details, contact, as-is and assignment lines), Print or save as PDF (one Letter or A4 page) or Copy as text. Never on it: max offer, opening offer, what we pay, seller, notes, title company, file names. Street address and parcel only when ticked. Details saved inside the encrypted deal | #61 (checks only) | none; CRM file updated |
| Phase 2: commissions. On a closed deal (Deal CRM, Amr only): pick the rep, type the profit and a percentage (worked out) or the commission; owed or paid. Each one is an expense line in Cash (Commissions), kept in step both ways (paid either side; amount and date only from the CRM; can't be deleted from Cash). Reps see their own on the Team home (never profit or percent) and get a notification when added and paid. Admin Money box: commissions owed | #62 | `20261031230000_commissions.sql` (staging, then live). CRM file: see below |

Each migration ran on staging first, then on live, and has a line in Admin > Logs > Changes.

## Waiting on Amr
1. ~~Backups~~ **Done (Oct 31):** the secrets are in, and the nightly backup in `amrabdelgawad1/portal-backups` runs at 03:17 Cairo time. The first full run says `RESTORE OK` (61 tables, 44 storage files, 10.7 MB). Optional, still open: add `BACKUP_PASSPHRASE` to encrypt the copies.
2. ~~Team passphrase~~ **Done (Oct 31).**
3. ~~Roadmap as text~~ **Done (Oct 31):** see `ROADMAP.md`.
4. **The students plan decisions** (section 9 of `PORTAL-STUDENTS.md`).

## Next, in order (Amr's decisions, Oct 31)
1. ~~Phase 2: deal sheet maker~~ **Done (Oct 31).**
2. ~~Phase 2: commissions~~ **Done (Oct 31).**
3. Phase 3: team overview (every rep's calls, deals and course progress on one screen).
4. Phase 3: call scoring with the ACQ 22 50-point scorecard, and roleplay practice.
5. Phase 3: onboarding checklist per new hire, and the script and objection library.

Later, by Amr's choice:
- Certificates: wait until the Acquisitions modules are settled (more may be added), then issue after the last module, not Module 15.
- Paid sign-up for outside students: on hold while Amr works on the students plan and the legal pages.
- Phase 4 (client view, weekly client reports): after the first outsourcing client signs.
- Website: legal pages and a public outsourcing page, later.

## The private Deal CRM file
- **Waiting to upload (Oct 31):** the commissions CRM file, 158,642 bytes, sha256 `07c9f823688c94138a956128eaf2abab6a58abc72f5c7a059b9ec74aff7464da` (sources in `portal-backups` PR #7). Back up the live file as `crm-before-comm-2026-10-31.html` first.
- Live: `deal-tools/crm.html`, 150,218 bytes, sha256 `94e23d16dd0c429aba250a955e42794ea9ea1ee5eae5afb3f2ce14608f89fc4f` (Oct 31, deal sheet; sources merged in `portal-backups` PR #6). Use it as the base for the next change.
- Backups in the same bucket: `crm-before-sheet-2026-10-31.html` (deal folder file, `cd7a2820...`), `crm-before-folder-2026-10-31.html` (notifications bell file, `42cf7577...`), `crm-before-bell-2026-10-31.html` (pipeline board file, `5121442c...`), `crm-before-board-2026-10-31.html` (Today links file, `ce9bd876...`), `crm-before-today-2026-10-31.html` (deals split file, `275d95b6...`), `crm-before-split-2026-10-31.html` (Phase 2 buyers file, `b3f58ea6...`), `crm-before-p2-2026-10-30.html` (round 7 file, `bd9475d1...`) and `crm-before-r7-2026-10-30.html`.
- Build sources (never in this public repo): private repo `amrabdelgawad1/portal-backups`, folder `crm-build/`. Build with `python3 -I patch.py crm-src.html frame.html ext.js crm.html`, test with `node tools/portal-dev/crm-r7.js http://localhost:8702 crm.html` (191 checks).
- Uploading: Amr's own signed-in session (two-step) may write the bucket. How: on amrabdelgawad.site/app/ in his Chrome, make a client from `TRACKER_CONFIG`, add a file input, hand it the built file, check its sha256 in the page, `move` crm.html to the backup name, `upload` the new one, download it back and compare. Browsers may keep the old copy for up to an hour.
- How buyers work: your own buyers still live in your encrypted workspace (the calculators read them there). When the CRM is on the team passphrase it copies them to `public.buyers`: the buy box readable, name, phone, email and notes encrypted. Areas become counties ("Polk, Hillsborough") or states ("FL, GA"); if both are typed, only the counties count.

## Note: running SQL
The Supabase SQL editor sometimes keeps showing "Running..." after a migration has finished. Don't run it again blindly: read back what it created (tables, triggers, function bodies) to confirm, as on Oct 31 for the notifications migration.

## How each round runs now
1. Build on a branch, with checks in `tools/portal-dev/`. `test-roles.sh` runs every database check, 325 at the moment.
2. Run the SQL on staging, then a read-only check as the owner (see `tools/staging/README.md`).
3. Run the SQL on live, and add a `change_log` line.
4. Open the PR, merge it, and confirm the Pages deploy succeeded.
