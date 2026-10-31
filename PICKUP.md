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
| Phase 1: Today screen on the Team home (today's numbers, callbacks due, deals needing action, next lesson); a Today row opens that deal in the CRM | (this PR) | `20261031170000_today.sql` (`portal_my_today`). CRM file updated for the deal links |

Each migration ran on staging first, then on live, and has a line in Admin > Logs > Changes.

## Waiting on Amr
1. ~~Backups~~ **Done (Oct 31):** the secrets are in, and the nightly backup in `amrabdelgawad1/portal-backups` runs at 03:17 Cairo time. The first full run says `RESTORE OK` (61 tables, 44 storage files, 10.7 MB). Optional, still open: add `BACKUP_PASSPHRASE` to encrypt the copies.
2. ~~Team passphrase~~ **Done (Oct 31).**
3. ~~Roadmap as text~~ **Done (Oct 31):** see `ROADMAP.md`.
4. **The students plan decisions** (section 9 of `PORTAL-STUDENTS.md`).

## Next, in order
1. Gate 0: the database half passed on live (acting as Kyle Miller, 17 tables, nothing of anyone else's). Still needed: Kyle signs in once on a phone and once on a PC; check both in Admin > Logs (sign-ins).
2. Finish Phase 1: end-of-day report, pipeline board, notifications.
4. Rest of Phase 2: deal folder, deal sheet maker, commissions on Cash.
5. Students and paid sign-up, after Amr's decisions and the legal pages.

## The private Deal CRM file
- Live: `deal-tools/crm.html`, 99,004 bytes, sha256 `275d95b691c3aad09dd90b0b034b2776047b972b415cf38f2441bc44f900c0fb` (Oct 31, deals split; sources merged in `portal-backups` PR #1). Use it as the base for the next change.
- Backups in the same bucket: `crm-before-split-2026-10-31.html` (Phase 2 buyers file, `b3f58ea6...`), `crm-before-p2-2026-10-30.html` (round 7 file, `bd9475d1...`) and `crm-before-r7-2026-10-30.html`.
- Build sources (never in this public repo): private repo `amrabdelgawad1/portal-backups`, folder `crm-build/`. Build with `python3 -I patch.py crm-src.html frame.html ext.js crm.html`, test with `node tools/portal-dev/crm-r7.js http://localhost:8702 crm.html` (97 checks).
- Uploading: Amr's own signed-in session (two-step) may write the bucket. Browsers may keep the old copy for up to an hour.
- How buyers work: your own buyers still live in your encrypted workspace (the calculators read them there). When the CRM is on the team passphrase it copies them to `public.buyers`: the buy box readable, name, phone, email and notes encrypted. Areas become counties ("Polk, Hillsborough") or states ("FL, GA"); if both are typed, only the counties count.

## How each round runs now
1. Build on a branch, with checks in `tools/portal-dev/`. `test-roles.sh` runs every database check, 181 at the moment.
2. Run the SQL on staging, then a read-only check as the owner (see `tools/staging/README.md`).
3. Run the SQL on live, and add a `change_log` line.
4. Open the PR, merge it, and confirm the Pages deploy succeeded.
