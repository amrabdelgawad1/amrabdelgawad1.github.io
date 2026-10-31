# Where things stand (Oct 30, 2026, evening)

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

Each migration ran on staging first, then on live, and has a line in Admin > Logs > Changes.

## Waiting on Amr
1. **Backups:** private repo `amrabdelgawad1/portal-backups` has the nightly workflow. Add the secrets `SUPABASE_DB_URL` (Session pooler URI with the database password), `SUPABASE_SERVICE_ROLE_KEY` and, optionally, `BACKUP_PASSPHRASE`. Then run it once and check the summary says `RESTORE OK`. Steps are in that repo's README.
2. **Team passphrase** in the Deal CRM (Settings > Set the team passphrase), from round 7.
3. **The roadmap's five phases and four gates, as text.** The blueprint's diagram didn't come through, so Phase 1 so far covers only what the text names (call logging, end-of-day numbers).
4. **The students plan decisions** (section 9 of `PORTAL-STUDENTS.md`).

## Next, in order
1. Phase 1, rest:
   - "Calls today" on the Admin overview and the Team home, from `portal_calls()`
   - the weekly board reading taps live, instead of waiting for end-of-shift numbers
   - a do-not-call list (hashed numbers)
2. Phase 2, deals: split the Deal CRM into readable working fields and encrypted personal fields (plan in `DATA-MODEL.md` section 4), plus buyers and buyer matching. Staging first. The calculators keep their look.
3. Phase 3: commissions on Cash.

## How each round runs now
1. Build on a branch, with checks in `tools/portal-dev/`. `test-roles.sh` runs every database check, 132 at the moment.
2. Run the SQL on staging, then a read-only check as the owner (see `tools/staging/README.md`).
3. Run the SQL on live, and add a `change_log` line.
4. Open the PR, merge it, and confirm the Pages deploy succeeded.
