# Handoff: portal round 8 (students, plan only)

Branch `portal-r8`, from `main` after #37. Not merged. **No code, no SQL to run, no payment code.**

## 1. What changed

One new file: `PORTAL-STUDENTS.md`, the plan for outside students. It covers:
- a separate `students` table, kept apart from `members` by a never-both guard
- course grants and requests, prices, orders and payment events
- how the existing course checks get a student path while every team check stays false for students
- sign-up and request to join
- every state of the locked card in `lockedFoot()` (price and Buy, Request access, pending, declined, checking a payment, refunded)
- the other pages that change
- what a payment provider needs, with options checked in October 2026
- a build order (8a to 8d) and the tests each step must pass

## 2. How I checked it

- Read the current checks it builds on: `portal_can`, `portal_member_can`, `learn_can_open`, `course_has_access`, `hub_can_send`, the storage policies, and `lockedFoot()` and its caller in `app/learn/hub.js`.
- Matched it against the Roles screen (07) and the Students filter on screen 8.
- Provider facts come from each provider's docs or integration pages; they're linked at the end of the plan.

## 3. SQL to run

None. Section 3.3 of the plan has two read-only audit queries. Running them now is optional; they must be answered before sign-up is switched on.

## 4. What Amr must do

Answer the eight decisions in section 9 of the plan: prices and currency, provider, how long access lasts, free by request, refund policy, language, the join page, and hiring a student. Nothing is built until he says go.

## 5. Judgement calls, and anything left

1. **Students never get team keys.** The course checks get a second path (`student_has()`) instead of putting students into `members` with a role, so no team check can ever be true for a student by mistake.
2. **Opening sign-up is the real risk.** Until now "signed in" meant "invited". The audit in 3.3 and a brand-new-account test come first, in round 8a, before anything is shown to students.
3. **A merchant of record in USD is recommended first,** because it handles tax and its docs list Egypt for bank payouts. Paymob can follow for EGP buyers, through the same two functions. Stripe needs a company abroad.
4. **The two new edge functions (`checkout`, `payment-webhook`) would live in this repo,** unlike `team-access`, so the reviewer can read them.
5. **Not legal or tax advice:** business registration and tax are for Amr to confirm with an accountant.
