# Students: the plan (portal round 8)

This is a plan only: no code, no SQL to run, and **no payment code**. It covers who a student is, how they get in, how they see locked courses with a price, and what a payment provider would need. The decisions only Amr can make are in section 9.

## 1. What a student is

A student is an outside learner. Students are **kept apart from the team**, so a student can never get a team switch by mistake (brief, section 3, and the Roles screen).

| | Student |
|---|---|
| Lands on | the Learning Hub (`/app/learn/`), straight away |
| Sees | only the courses they were given or bought; their own progress and feedback; locked cards for the other courses, with a price |
| Sends | recordings, files and written drills in the courses they have |
| Never sees | clock-in and hours, the Deal CRM, the team, the weekly board, live now, anything on the Admin side |
| Calculators | only if Amr gives them (later; see 6.5) |
| Psychology practice entries | private to them, like everyone else's |
| Turning off | one switch closes every course at once |

Students only ever get "mine". Everything is enforced in the database; hiding a button is only for tidiness.

## 2. Database

Plain rule: **students never touch `members`, its keys, `portal_can()` or `portal_role_keys()`.** Team checks keep returning false for a student, whatever is stored. Course checks get a second, separate path for students.

### 2.1 Tables

| Table | What it holds | Who writes it |
|---|---|---|
| `students` | `user_id` (primary key, `auth.users`), `name`, `email`, `active` (default true), `created_at`, `source` (`signup` or `invite`), `note` | the student's first sign-in creates the row through `student_start()`; Amr changes `active` and `note` |
| `student_courses` | `user_id`, `course` (`course`, `mkt` or `psy`, the same keys the team uses), `source` (`given` or `bought`), `order_id` (null when given), `granted_at`, `granted_by`, `expires_at` (null = no end), `revoked_at` | Amr through `student_grant()` / `student_revoke()`; the payment webhook (service role) for bought courses. Nobody writes it directly. |
| `student_requests` | `id`, `user_id`, `course`, `message` (short, optional), `status` (`pending`, `approved` or `declined`), `created_at`, `decided_at`, `decided_by`, `reason` | the student through `student_request()`; Amr through `decide_student_request()` |
| `course_prices` | `course`, `currency`, `amount` (in the smallest unit, for example cents or piasters), `active`, `provider`, `provider_product_id`, `updated_at` | Amr only. Anyone may read the active prices (the Learning Hub and a public page show them). |
| `orders` | `id`, `user_id`, `course`, `provider`, `provider_order_id` (unique), `amount`, `currency`, `status` (`paid`, `refunded` or `disputed`), `created_at`, `raw` (the provider's event, for support) | the payment webhook only (service role). The student reads their own; Amr reads all. |
| `payment_events` | `provider`, `event_id` (unique), `received_at`, `handled` | the payment webhook only. It makes every event count once, even when the provider sends it twice. |

All six tables have RLS on. Authenticated users get no direct insert, update or delete on any of them.

### 2.2 Functions (sketches, not to run)

```sql
-- Is this person an active student? (never true for a team member: see the guard in 2.3)
student_active() returns boolean
  = exists (select 1 from students s where s.user_id = auth.uid() and s.active)

-- Does this student have this course right now?
student_has(p_course text) returns boolean
  = student_active() and exists (select 1 from student_courses c
      where c.user_id = auth.uid() and c.course = p_course and c.revoked_at is null
        and (c.expires_at is null or c.expires_at > now()))

-- Role: 'student' joins the list the brief already names
portal_role() = case when is_tracker_admin() then 'owner'
                     when (active member) then members.role
                     when student_active() then 'student' end

-- The course checks get a student path. The team path is unchanged.
learn_can_open(p_course) = (portal_can('learn') and portal_can(p_course))
                           or (p_course = 'learn' and student_active())
                           or student_has(p_course)
course_has_access()       = (existing rule) or student_has('course')
hub_can_send(p_course)    = mkt and psy need no change (they call learn_can_open);
                            'acq' becomes portal_can('course') or student_has('course')

-- What the portal draws (portal_me already returns role and keys)
portal_me() for a student = { role:'student', name, keys:[their courses], needs_code:[] }

-- Sign-up and requests
student_start()                     creates the students row on first sign-in (refused if this user is a member)
student_request(p_course, p_message) one pending request per course; refused if they already have it
decide_student_request(p_id, p_approve, p_reason)   Amr only (is_tracker_admin); approving calls student_grant
student_grant(p_user, p_course, p_expires) / student_revoke(p_user, p_course)        Amr only
```

The storage policies on the course content folders already call `learn_can_open()` and `course_has_access()`, so students reach lesson files only through those same two checks. No storage policy changes are needed.

### 2.3 Guards

- **Never both.** A trigger on `members` refuses an insert if a `students` row exists for that user, and a trigger on `students` refuses one if a `members` row exists. Hiring a student onto the team is a later, explicit "Move to the team" step that switches the student off first.
- **Turning off.** `students.active = false` closes every course at once, because `student_has()` checks `active`. Their progress stays, so turning them back on restores everything.
- **Access log.** The `access_log` trigger is extended to `students` and `student_courses`: who changed what, when. A webhook grant is logged with "payment" as the actor.
- **Learner progress.** `portal_learner_progress()` already returns pass counts only. Amr sees students in it, marked as students. **Managers don't see students** (the brief: managers see "everyone on the team").
- **Review center.** Students' recordings and drills arrive like anyone else's; feedback goes back to them only. Nothing new is needed beyond `hub_can_send()`.
- **`learn_progress`** is already own rows only, for everyone, so psychology practice entries stay private.

## 3. Sign-up and request to join

Today the app is invite only: `/app/` signs in with a password, and a signed-in account that isn't on the team sees "This account isn't set up for the tracker." New team members come only through the `team-access` invite. Students need a way in without an invite.

### 3.1 The flow

1. **A public page** (`/learn/join/` or a section on the existing course page) shows the three courses with prices and two buttons: **Create an account** and **Sign in**.
2. **Create an account:** name, email and a password, with Supabase Auth email confirmation on. The account can't do anything until the email is confirmed.
3. **First sign-in:** `/app/` calls `portal_me()`. If the person is neither the owner nor a team member, it calls `student_start()`, which creates their `students` row, and sends them to the Learning Hub.
4. **In the Learning Hub,** every course is a locked card with its price and either **Buy** or **Request access** (section 4).
5. **Request access** sends one short request (optional message). It appears for Amr in Invite and access under a new **Students** filter, which screen 8 already shows ("All, Agents, Students, Off"). Approve opens the course and emails the student; Decline asks for a short reason, which the student sees on the card.
6. **Amr can still invite a student directly.** This is a Students option next to Invite someone. Changing `team-access` for this means the same as round 5: describe it, don't guess its code.

### 3.2 Things to switch on before launch (Supabase dashboard)

- **Authentication > Sign In / Providers > Allow new users to sign up:** on. It is probably off today because the app is invite only.
- **Confirm email:** on.
- **Custom SMTP:** Supabase's built-in sender has a low hourly limit and is meant for testing. Confirmation emails need a real sender, such as Zoho Mail or another SMTP provider.
- **A CAPTCHA** (Supabase supports hCaptcha and Turnstile) on sign-up, so bots can't fill the user list.
- **Redirect URLs:** add the join page and `/app/` for the confirmation link.

### 3.3 The one real risk, and the check before sign-up opens

Opening sign-up means anyone can hold a signed-in session. Every rule written so far assumed "signed in" meant "invited". Before switching sign-up on, run this audit on the live database. It lists policies that let any signed-in user in without checking who they are:

```sql
select schemaname, tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname in ('public', 'storage')
   and roles && array['authenticated', 'public']::name[]
   and coalesce(qual, '') || ' ' || coalesce(with_check, '') !~
       '(auth\.uid\(\)|is_tracker_admin|has_access|portal_can|portal_member_can|learn_can_open|course_has_access|hub_can_send|course_is_admin|student_has)';
```

Also list the functions any signed-in user can run, and read each one for a missing check:

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) args, p.prosecdef as definer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
 order by 1;
```

Every row from either query needs an answer before sign-up opens. The build round will add a check script that signs in as a brand-new account with no rows anywhere and confirms it can read nothing on the team side.

## 4. The locked card: price, Buy and Request access

`lockedFoot()` in `app/learn/hub.js` is the spot. Today it shows one line: "Locked. Ask Amr to open this course for you." The plan is to give it the course and the student's state, and pick one of these:

| State | What the card shows |
|---|---|
| Team member (today) | unchanged: "Locked. Ask Amr to open this course for you." |
| Student, course has a price | the price (for example "USD 49" or "EGP 1,500"), a **Buy** button, and a quiet "or request access" link |
| Student, no price set | **Request access** button |
| Request pending | "Requested on Nov 3. Amr will get back to you." No button. |
| Request declined | "Not open right now" plus Amr's reason, and Request again (after 7 days) |
| Payment started, not confirmed yet | "Checking your payment…", polling `student_has()` for a minute, then "We're still checking. Refresh in a few minutes." |
| Refunded or revoked | back to locked with a price |

Notes for the build:
- The card stays a `<div aria-disabled>` while locked. Buy and Request are real buttons inside it (44px, the portal's `.p-btn`), so the card itself never acts as a link.
- Prices come from `course_prices`, never from the page, and are shown in the student's currency where two exist (section 9).
- `HUB_TEST` grows `student:true`, `prices`, `requests` and `orders`, so every state above can be checked in Playwright at 390 and 1440 without signing in.
- The hero line changes for students: "3 courses · 1 open for you" works as it is. The owner's "For you" tools never show.

## 5. Other pages that change

| Page | Change |
|---|---|
| `/app/` | `portal_me()` role `student` goes straight to `/app/learn/`. The old "isn't set up" message becomes the student start for anyone not on the team. |
| `portal-shell.js` | The Apps list: **My hours** today shows to anyone who isn't the owner (`me.role !== 'owner'`); it must become managers and agents only. Students see the Learning Hub and Sign out, nothing else. |
| Invite and access (screen 8) | a **Students** filter: name, courses (given or bought, with dates), requests to decide, turn off. Students are never mixed into the team list. |
| Learner progress | Amr's view adds a Students section; managers' view doesn't change. |
| Course players | no change: they already ask `learn_can_open()` / `course_has_access()`. |
| Cash | later: income from `orders` can appear in Cash as one line per month (Amr's decision). |

## 6. Payments: what a provider would need

### 6.1 How a purchase works (no card data ever touches the site)

1. The student taps **Buy** on a locked card.
2. The page calls a new edge function, **`checkout`**, with the course only. The function checks the student is signed in and active, reads the price from `course_prices`, and asks the provider for a hosted checkout page. It tells the provider the `user_id` and course as custom data.
3. The student pays on the **provider's own page** (hosted checkout). The site never sees card numbers.
4. The provider calls a second edge function, **`payment-webhook`**, which:
   - checks the provider's signature on the request, and refuses anything unsigned
   - skips an event it has already seen (`payment_events.event_id` is unique)
   - checks the amount and currency against `course_prices`
   - writes the `orders` row and the `student_courses` grant, in one transaction
5. The provider sends the student back to the Learning Hub. **Being sent back proves nothing.** Only the webhook opens a course; the card waits for it (section 4).
6. **Refunds and disputes** arrive through the same webhook: the order becomes `refunded` or `disputed`, and the grant gets `revoked_at`. Progress is kept.

### 6.2 What any provider must offer

- **Hosted checkout** (a payment page or link on the provider's site), so card data never reaches us
- **Custom data on the order** (user id and course) that comes back in the webhook
- **Signed webhooks** for paid, refunded and disputed, with a unique event id
- **Test mode** with test cards, for Playwright and the reviewer
- **Payouts Amr can actually receive** from where he lives
- Receipts emailed to the buyer, and ideally tax handling for buyers abroad

### 6.3 Options (checked October 2026; confirm on each provider's own site before signing up)

| Provider | Good for | Watch out for |
|---|---|---|
| **A merchant of record** (Lemon Squeezy, Paddle and similar) | Buyers anywhere, in USD. As merchant of record, Lemon Squeezy is the legal seller and handles VAT and sales tax. Its docs list Egypt among the countries for bank payouts. | Fees are higher than a plain card processor (Lemon Squeezy is commonly quoted at 5% + 50¢). Payouts are twice a month with a holding period. |
| **Paymob** | Buyers in Egypt, in EGP: cards (Visa, Mastercard, Meeza), mobile wallets such as Vodafone Cash, and Fawry. | Needs a business registered in Egypt with completed KYC. Amr would handle tax on these sales himself. |
| **Stripe** | (only with a company abroad) | Stripe isn't directly available to residents of Egypt; it needs a registered company abroad, such as a US LLC. Not worth it for this alone. |

A sensible start is **one merchant of record in USD**: one integration, tax handled, and Egypt payouts. Paymob can be added later for Egyptian buyers, through the same `checkout` and `payment-webhook` functions with a `provider` column, if enough buyers ask to pay in EGP.

### 6.4 Secrets and keys

- The provider's API key and webhook secret live in **Supabase Edge Function secrets** only: never in the repo, a page or the database.
- Both functions go in this repo under `supabase/functions/`, unlike `team-access`, so they can be reviewed.
- The webhook uses the service role to write; nothing else does.

### 6.5 Later, not in the first build

- Coupons and free access codes (the provider's discount codes are enough at first)
- Bundles (all three courses)
- Payment plans
- The land and house calculators for students. `deal-gate.js` and `deal_access_status()` would need a calculators-only path, so a student can never load the CRM.

## 7. Build order (when Amr says go)

| Round | What | Ships to students? |
|---|---|---|
| 8a | Tables, functions and guards from section 2; the policy audit from 3.3 run and answered; SQL tests: student vs agent vs manager vs owner vs a brand-new account, turned off, expired, revoked | no |
| 8b | Sign-up, `student_start()`, `/app/` routing, the Apps list fix, and the locked card's **Request access** states; the Students filter in Invite and access | yes, free courses by request only |
| 8c | Prices in `course_prices`, the Buy button, `checkout` and `payment-webhook` in test mode, with the provider's test cards in Playwright | no, test mode only |
| 8d | Live keys, refunds and disputes tested, receipts checked, then switched on | yes, paid |

Each round gets its own PR and handoff, tested at 390 and 1440 with no console errors, as before.

## 8. Tests the build must include

- A **brand-new signed-in account** with no rows anywhere gets nothing on the team side: no members, shifts, live status, requests, deals, team board, money or access log.
- A **student** opens only their courses, in the players and in storage (lesson files), and sends drills only in those.
- A **student never passes a team check**, even with a `members.access` list written by hand (the never-both trigger refuses the row anyway).
- **Turned off, expired and revoked** each lock the course and keep the progress.
- The **webhook** refuses a bad signature, counts a repeated event once, refuses a wrong amount, and handles a refund.
- **Request access:** one pending request per course; only Amr decides.
- **The locked card** shows every state in section 4 at 390 and 1440, with 44px targets.

## 9. Decisions for Amr

1. **Prices:** how much each course costs, and in which currency: USD only, or USD and EGP.
2. **Provider:** start with a merchant of record in USD (recommended), Paymob in EGP, or both.
3. **How long access lasts:** forever, or a set time (for example 12 months). `expires_at` supports either.
4. **Free by request:** should Request access exist for every course, or only for some (for example Psychology), with Buy as the only way into the others?
5. **Refunds:** the policy text (for example 14 days, under 2 modules passed). It goes on the join page and the provider's checkout.
6. **Language:** sign-up and join pages in English only, or English and Arabic like the Marketing and Psychology courses.
7. **The join page:** a new `/learn/join/` page, or a section on an existing public page.
8. **Hiring a student:** keep "Move to the team" for later, or not at all.

Open questions for the build, not for Amr:
- `team-access` isn't in the repo. If direct student invites go through it, its change is described in that round's handoff, as in round 5.
- Supabase's own limits on sign-ups and emails depend on the project's plan; the reviewer should confirm them in the dashboard.
- Tax and business registration are Amr's to confirm with an accountant. This plan only notes what each provider asks for. It isn't legal or tax advice.

Sources (provider facts, checked October 2026):
- [Lemon Squeezy: supported countries](https://docs.lemonsqueezy.com/help/getting-started/supported-countries)
- [Lemon Squeezy: payments](https://docs.lemonsqueezy.com/help/payments)
- [Lemon Squeezy fees and payouts (third-party summary)](https://learnwithhasan.com/payment-gateways/lemonsqueezy/)
- [Paymob methods in Egypt (Moodle plugin page)](https://moodle.org/plugins/paygw_paymob/3.5.1/32623)
- [Paymob requirements (OpenEduCat integration page)](https://openeducat.org/pt-BR/integrations/paymob/)
- [Stripe and Egypt (guide)](https://foundlie-web.pages.dev/blog/stripe-guide-for-egyptians)
