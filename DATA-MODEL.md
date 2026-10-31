# Portal data model (Phase 0)

One database, where every record links to the others. This file maps what exists today and where each later phase plugs in, so new rounds add tables instead of rebuilding. Status: **live** (in the database now), **planned** (not built), and the phase it comes with.

## 1. How it links

```
person ──┬── shifts (hours + end-of-day report) ── call events (Phase 1)
         │
         ├── deals (Deal CRM) ── buyer matches ── buyers (Phase 2)
         │       └── closed deal ── commission ── Cash
         │
         ├── course progress, drills, feedback (Learning)
         │
         └── (students) course grants ── orders (payments)

client (later) ── the reps working for them ── their calls and deals ── weekly client report
```

## 2. People

| Table | Status | What it holds | Links |
|---|---|---|---|
| `auth.users` | live | every sign-in account (Supabase) | everything below by `user_id` |
| `members` | live | team members: role (manager, agent), extras (`access`), `not_given`, active | the team side; `portal_can()` |
| `portal_owner` | live | Amr's user id (found from `is_tracker_admin()`) | deals move to it on turn-off |
| `students` | planned (students plan) | outside learners, kept apart from `members` | `student_courses`, `orders` |
| `clients` | planned (when the first outsourcing client signs) | `id, name, active` | `members.client_id` (which client a rep works for) |
| `access_log` | live | every role and access change | `actor`, `target` |

## 3. Work: hours, calls, end-of-day

| Table | Status | What it holds |
|---|---|---|
| `live_status` | live | who is clocked in right now |
| `shifts` | live | each shift: hours, breaks, the end-of-day brief, and dials, conversations and appointments (the end-of-day numbers) |
| `shift_requests` | live | missed-shift requests and decisions |
| `call_events` | **Phase 1** | one row per tap: `user_id, at, kind` (dial, conversation, offer, appointment), the shift it belongs to, and later `lead_id` and `client_id`. The end-of-shift numbers are filled from these. No phone numbers or names. |
| `dnc_numbers` | Phase 1 or 2 | do-not-call list: a hash of the number, the reason, when, who added it |

## 4. Deals and buyers

Today the Deal CRM keeps each person's whole workspace (deals, sellers, buyers, settings) as **one encrypted blob** per person (`deal_logs`), with the team passphrase (round 7). The database can't search, count or match it.

Phase 2 splits it, as the blueprint suggests:

| Table | Status | Readable to the database | Encrypted in the browser |
|---|---|---|---|
| `deals` | built | `id, owner (user_id), client_id, kind (land or house), county, state, acreage, price fields (value, max offer, paid, sold), stage, follow_up, created, updated, closed_on, result` | `enc`: seller name, phone, email, street address, notes |
| `deal_events` | built | stage changes and results, for countdowns and reports | |
| `buyers` | built | `id, owner, counties[], states[], kinds[], price_min, price_max, exit, proof_of_funds (yes/no), active` | `enc`: name, phone, email, notes |
| `buyer_matches` | Phase 2 | which buyers fit a deal (computed in the database) | |
| `deal_followups` | live | follow-up dates (`deal_key`, `due`), already readable | |

**How the split works (built Oct 31, `20261031160000_deals_split.sql`):**
1. On the team passphrase, the Deal CRM keeps one row per real deal in `deals`, in step with the workspace every time a deal is saved: readable fields as they are; the deal's name, location as typed, seller contact and notes encrypted with the team key (`enc`). Practice deals stay out. Deleting a deal deletes its row.
2. The encrypted workspace in `deal_logs` stays the source the calculators read. Nothing is removed from it in this step, so it can be undone by dropping the two tables.
3. `deal_events` is written only by the database: a new deal, each stage change, each result.
4. Changing the team passphrase re-encrypts deal rows in the same single step as workspaces and buyers; turning someone off gives their deal rows to Amr.

The calculators keep their look. Only where they save deals changes.

## 5. Money

| Table | Status | What it holds |
|---|---|---|
| `cash_entries` | live | Amr's income and expenses (Cash page) |
| `payslips`, `fx_rates`, `tracker_settings` | live | team pay and rates (owner only) |
| `commissions` | live | `deal_id, user_id, rep_name, profit, percent, amount, status (owed or paid), paid_on, cash_entry_id`; each one an expense line in Cash; reps read theirs through `portal_my_commissions` |
| `orders`, `course_prices` | students plan | course purchases (hosted checkout and webhook only) |

## 6. Learning

All live: `course_*` (Acquisitions), `learn_progress` (Marketing and Psychology, own rows only), `hub_uploads` (recordings and files), `course_submissions` (written drills), and the review feedback. Phase 2 or 3 adds `certificates` (`user_id, course, issued_on, code`).

## 7. Logs

All live since Phase 0:
- `app_errors`: browser errors
- `activity_events`: sign-ins, deal saves, decisions, drills sent
- `change_log`: what shipped
- `access_log`: role and access changes

## Rules every new table follows

1. RLS on, with no direct grants unless a policy needs them. Reads and writes go through checks in the database: `portal_can()`, the owner check, or own rows.
2. Every row has an owner (`user_id`). "Mine vs everyone's" is decided in the database.
3. Personal data (seller and buyer names, phones, addresses) is encrypted in the browser, or never stored.
4. Each migration runs on staging first, then live, and gets a line in `change_log`.
