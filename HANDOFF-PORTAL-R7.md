# Handoff: portal round 7 (Deal CRM as a team, the weekly board)

Branch `portal-r7`, from `main` after #36. Not merged. **SQL to run, and a private file to upload.**

**The new `crm.html` is not in this PR.** The repo is public and GitHub Pages publishes the whole repo (the workflow uploads `.`), so a file under `tools/deal-tools/` would still be public at `amrabdelgawad.site/tools/deal-tools/crm.html`. It was sent separately in the conversation. Check it against this hash before you upload:

```
sha256  4c170152d178fb8d13b8dff7549322ed973f40841372391468a6b5b776092d0f   crm.html   80,453 bytes
```

## 1. What changed

### Database (`supabase/migrations/20261030160000_portal_deals_team.sql`)

1. **`portal_owner`**: Amr's user id. It's found from the email address already inside `is_tracker_admin()`, so the address is never typed into this repo. The migration stops if it can't find the address or the account.
2. **`deal_logs.user_id` and `deal_followups.user_id`**: added only if they're missing. Rows without one are given to Amr. A unique index on (`user_id`, `tool`) is added if missing, because the CRM saves with that conflict target. **The existing own-row policies are not changed.** The calculators read `deal_logs` by tool name alone, so they must keep getting only their own row.
3. **`deal_team`**: the team salt plus a team check. The check is a fixed value encrypted with the team key, so a mistyped passphrase is caught before anyone creates a workspace nobody else can open. It holds no key and no passphrase. RLS is on and nobody has grants on the table. It's read through `deal_team_get()`, which needs Deal tools.
4. **`deal_team_rows(p_everyone)`**: the rows each person may fetch, decided in the database:

   | Who | What they get |
   |---|---|
   | Amr | everyone's |
   | Manager with the authenticator code | everyone's |
   | Manager without the code, or anyone else | their own only |

   It returns Deal CRM workspaces only, never the calculators' land and house rows. Each row comes with the person's name and whether they're turned on.
5. **`deal_rekey(rows, salt, check)`**: changing the passphrase in one transaction. Never a mix:
   - Every row must already be on the new key.
   - Each row is matched on its old encryption value (iv). If someone saved meanwhile, the whole thing is refused.
   - Afterwards, if any workspace in scope is still on the old key, the whole thing is refused.

   Scope depends on who calls it:
   - **Amr:** every workspace on the current team key, plus his own workspace.
   - **Everyone else:** their own workspaces only. Their new key must be the team key, and they can't set the team check.
6. **Save guard** (trigger `deal_logs_team_key`): once a team key exists, a workspace can only be saved on it. A tab still holding an old key gets "This workspace is on an old passphrase…" instead of writing a mix.
7. **`deal_team_start`**: Amr's first team key, used only when he has no workspace yet.
8. **Turning someone off moves their deals to Amr** (trigger `members_deals_to_owner`):
   - Their `workspace` row becomes Amr's `workspace:<their id>`. Only `user_id` and the row name change; the encrypted data stays byte for byte the same.
   - Their follow-up dates move with them.
   - Turning them back on moves nothing back.
9. **`portal_team_board()`**: this week's effort per active member, Monday to Sunday in New York time.
   - Columns: calls logged (`shifts.dials`, not Amr's own shifts), lessons passed (`course_item_done`), and drills sent (recordings and files from `hub_uploads`, plus written drills submitted, not drafts).
   - Amr, managers and agents can call it.
   - It returns `user_id, name, calls, lessons, drills, is_me` only. **Never hours, pay or deal money.**

### The Deal CRM (`crm.html`, private)

- **The key is never stored.** The old CRM cached the key in `sessionStorage` (`dealKey:<user>`). Now the key lives in memory only, and any old cached keys are deleted when the CRM opens. You type the passphrase each time you open the CRM.
- **Team passphrase:**
  - A new workspace uses the team salt and must pass the team check ("That isn't the team passphrase. Check it with Amr.").
  - Before Amr sets a team passphrase, a rep sees "Amr hasn't set the team passphrase yet."
  - The gate no longer says "including Amr".
- **Change passphrase** (Amr, Settings): this is "Set the team passphrase" the first time.
  1. Opens every workspace in scope with the current passphrase.
  2. Encrypts each one with the new passphrase and a new salt.
  3. Checks each one, using a key derived afresh from the new passphrase, against the original.
  4. Only then saves them all in one `deal_rekey` call.

  Any failure means nothing changes. Afterwards the old key is dropped from memory and the CRM reopens with the new passphrase.
- **Moving onto the team passphrase** (anyone whose workspace still uses their own passphrase): after they unlock, the CRM asks for the team passphrase, checks it, and moves their workspace with the same steps.
- **Screen 3 layout:**
  - `portal-shell.js` top bar with Apps, Search deals, Showing, and the account button.
  - Left sidebar:
    - Pipeline: Real deals or Practice, All open deals, New leads, Talking, Offer sent, Under contract, Closed and passed, with counts.
    - Work: Follow-ups, Cash buyers, Accuracy, Settings.
    - Tools: Land and House calculators.
  - Dark hero with "+ Add a deal".
  - Table: Property, Stage, Owner, Next step, Due ("Today" and "N days late" in red).
- **Showing: Everyone / Only me / Pick people** (Amr and managers):
  - Teammates' deals are decrypted in the browser with the same team key.
  - They open in a **view-only** drawer. The database lets only the owner change a deal.
  - Workspaces still on a personal passphrase get a note ("Rep 1's deals use their own passphrase…"), never a guess.
- **Counts for the portal homes:** after unlocking, the CRM leaves counts only in `sessionStorage` `dealCounts` (open, due, under contract). There are no names, places or money in it. It's removed by "Lock the CRM".
- Everything else is the original CRM, restyled: Follow-ups, Buyers, Accuracy, Settings, the drawer, practice mode, CSV and encrypted backup (now by `user_id` too).

### The site

- `app/portal-home.js?v=2`:
  - **Team home:** "This week on the team" board from `portal_team_board()`, with your own row highlighted. The section stays hidden if the function isn't there yet.
  - **Admin overview:** the Deals box shows Follow-ups due, Open deals and Under contract, or "Unlock the CRM to see deal numbers".
  - **Portal view:** the Deal CRM card shows the same counts, or the unlock line.
- `app/app.css?v=23`: keeps the board's table inside the phone width.
- `app/sw.js` `talents-v90`.
- **Cash:** the Backup heading now uses the same weight, size and spacing as the other card headings. It was lighter because it isn't inside `.card-title`.

## 2. How I tested

- **Database, throwaway Postgres 16 (`test-roles.sh`):**
  - 104 of 104 checks pass: round 2's 54 plus 50 new ones in `test-deals.sql`.
  - The migration runs twice cleanly.
  - Who fetches what: agent, manager with and without the code, Amr, and someone without Deal tools.
  - Team start refused while deals sit on another passphrase.
  - Rekey refuses: a skipped row, a stale row, the wrong key, the calculators' rows, and someone's personal workspace.
  - Rekey succeeds atomically and sets the team key in the same step.
  - Agents can't pick their own key, rewrite others' rows, or set the check.
  - The save guard refuses a stale tab.
  - The turn-off move keeps the ciphertext unchanged.
  - The board counts this week only: calls 40, lessons 3, drills 2, drafts don't count, and the OUT columns are exactly `user_id, name, calls, lessons, drills, is_me`.
- **CRM (`crm-r7.js`, 67 of 67)**: the private file is run against an in-memory database that follows the rules above, with real PBKDF2 and AES-GCM. In order:
  1. Amr's old passphrase opens his CRM, the table and counts are right, and the stage filter and search work.
  2. Amr sets the team passphrase. The wrong current one changes nothing. The calculators' row and Rep 1's personal workspace are untouched.
  3. Rep 1 moves onto the team passphrase.
  4. Rep 2 joins with it.
  5. Everyone, Only me and Pick people all work, and teammates' deals open view only.
  6. Amr's second change: a save racing it is refused with nothing saved. Then all 3 workspaces move, and the old passphrase stops working.
  7. A stale tab can't write a mix.
  8. A manager without the code sees only their own deals, with a note.
  9. There's no key or passphrase in `localStorage` or `sessionStorage` at any point.
  10. Layout at 390 and 1440: no overflow, 44px targets, no em dashes, no console errors.
- **Site (`site-r7.js`, 66 of 66):** the board, Admin and Portal deal numbers with and without an unlocked CRM, and the Cash Backup heading's computed style matching the other headings, at 390 and 1440, CSP on.
- **Earlier suites, all still passing:** round 2, round 3 shell, round 4 homes, round 5 people, round 6 look.
- Screenshots: `portal-screens` branch, `r7/`.

## 3. Before running the SQL: one export, please

`live-stubs.sql` **assumes** these from the CRM's own calls; they weren't in the earlier exports:
- `deal_logs (user_id, tool, blob, updated_at)` with a unique (`user_id`, `tool`)
- `deal_followups (user_id, deal_key, due)`
- each with an own-row policy

Please export the live definitions first:

```sql
select table_name, column_name, data_type, column_default from information_schema.columns
 where table_schema = 'public' and table_name in ('deal_logs', 'deal_followups') order by 1, ordinal_position;
select tablename, policyname, cmd, qual, with_check from pg_policies where tablename in ('deal_logs', 'deal_followups');
select indexrelid::regclass, pg_get_indexdef(indexrelid) from pg_index where indrelid in ('public.deal_logs'::regclass, 'public.deal_followups'::regclass);
select tgname from pg_trigger where tgrelid in ('public.deal_logs'::regclass, 'public.deal_followups'::regclass) and not tgisinternal;
select count(*), count(distinct user_id), count(*) filter (where tool like 'workspace%') from public.deal_logs;
```

If the policies read anything other than "own rows by `user_id`", or there's no `user_id`, the migration still works (it adds and backfills the column), but tell me and I'll check the calculators' reads against it.

## 4. Order

1. Run `supabase/migrations/20261030160000_portal_deals_team.sql` (safe to run twice). Look for `portal_owner: set` in the notices.
2. Upload the new `crm.html` to private storage at `deal-tools/crm.html`, replacing the old one. Keep a copy of the old one until step 3 of section 5 is done.
3. Merge this PR (site changes). The order between steps 2 and 3 doesn't matter: the site only reads `dealCounts` if it's there.

## 5. What Amr must do

1. Open the Deal CRM with his **current** passphrase, as today.
2. Go to **Settings > Set the team passphrase**. Type the current one and the new team passphrase twice. His deals move onto it in one step.
3. Give the team passphrase to his reps and managers. Anyone who already had a workspace on their own passphrase is asked to move onto the team one the next time they open the CRM. Until they do, the database won't save their changes, and Amr's CRM shows them as "uses their own passphrase".
4. To change it later: Settings > Change passphrase, then give the new one out. Every workspace on the team passphrase moves at once. Open CRM tabs are told to reopen with the new one.
5. If the team passphrase is lost, nobody can open the deals. Keep it in a password manager.

## 6. Judgement calls, and anything left

1. **The file isn't in the repo** (see the top). The reviewer uploads it; the PR carries its hash.
2. **The calculators may still cache the key.** They're unchanged and not in this repo, so I couldn't check them. If they keep a key in `sessionStorage` or `localStorage`, that breaks "never store the key", and only a calculator change can fix it. The CRM clears any `dealKey:*` entries it finds when it opens, and the save guard stops a calculator from writing a CRM workspace on the wrong key. Their own land and house rows keep whatever passphrase they used and are never touched by a passphrase change.
3. **Teammates' deals are view only**, even for Amr. Writing to someone else's row would mean widening the own-row policies the calculators rely on.
4. **Turned-off people's deals:** if they were already on the team key, Amr sees them as "Name (off)". If they never moved off a personal passphrase, nobody can open them, and they're listed as locked.
5. **Deal counts on /app** come from the last unlock in the same browser tab, because the database can't count encrypted deals. A different tab or a new session shows "Unlock the CRM to see deal numbers".
6. **The kanban drag and drop** is replaced by the screen 3 table for real deals. Stages change in the deal drawer. Practice mode keeps its board.
7. **"Next step"** is the first line of the deal's notes. The CRM has no separate next-step field, and I didn't invent one.
8. **`team-access` needs no change.** Turning someone off already updates `members.active`, which fires the move trigger.
