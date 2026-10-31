# Portal roadmap: five phases, four gates

Each phase opens only when the one before passes its gate. A gate is passed by real use, not by merged code.

## Phase 0. Foundation (done)
One shell and menu, roles in the database, linked data model, staging copy, backups, logs, shared theme.
Encryption split done for buyers and deals (working fields readable, personal details encrypted).

**Gate 0: passed Oct 31.** A rep signs in on phone and PC and sees only their own data: on live as Kyle Miller, 17 tables with 0 rows of anyone else's, and sign-ins recorded from an Android phone (07:50) and a Windows PC (07:51).

## Phase 1. Daily work
Done: call counter and Calls today, do-not-call list, feedback button, pinned announcement, Today screen (today's numbers, callbacks due, deals needing action, next lesson, on the Team home), end-of-day reports (the rep's clock-out note and numbers; Amr's Admin overview lists today or yesterday for everyone: sent, no report, on shift, didn't work).
Done too: pipeline board (a Board view in the Deal CRM, New lead to Closed and passed; contract, inspection and closing dates on each deal under contract, with countdowns on the board, the list, the Today screen and Amr's Admin overview).
Not built:
- Notifications: access requests, drills submitted, deal stage changes, payments in.

**Gate 1:** every rep logs every call for two straight weeks.

## Phase 2. Deals and money
Done: buyers list and matching ("Buyers who fit" on every deal).
Done: the deals split (`DATA-MODEL.md` section 4).
Not built: deal folder (contract, title company, comps, due diligence checklist), deal sheet maker (one-page PDF for buyers), commissions per rep per deal feeding Cash (counted only when a deal closes in the Deal CRM).

**Gate 2:** first deal matched to a buyer from the list.

## Phase 3. Grow the team
Team overview, call scoring with the ACQ 22 50-point scorecard, roleplay practice, onboarding checklist per new hire, script and objection library.
Certificates wait until the Acquisitions modules are settled (more may be added); they'll be issued after the last module rather than Module 15.
Paid sign-up goes live here, only once the legal pages (terms, refund, privacy) and staging are in place. On hold for now (Oct 31): Amr is working on the students plan and the legal pages.

**Gate 3:** first outsourcing client signs (served with manual reports at first).

## Phase 4. Sell the service
Client view and automatic weekly client reports, built around what the first client actually asks for.

## Not building
- Our own dialer or phone system (calls stay on Phound or the client's dialer; results are logged here)
- Our own email or text sending (use GHL or a sending service)
- Our own payment handling (hosted checkout only)
- A full accounting system (Cash plus commissions is enough)
- A client view before the first paying client
- More courses before the current three are finished and tested with real learners
- AI features for their own sake

## Success measures
- Every call logged, every rep, every day
- Amr checks the whole team in under 10 minutes a day from one screen
- End-of-day reports every working day per rep
- Each rep finishes the Acquisitions course and certifies
- First deal closed with a buyer from the portal's list
- Problems found in logs and staging before users report them
- First client getting reports built from portal data
- First paid student completing a course

If a measure stays off target for two weeks, fix that before building anything new.
Anything asked for that isn't on this list gets added here with a phase before it is built.
