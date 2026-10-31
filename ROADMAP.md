# Portal roadmap: five phases, four gates

Each phase opens only when the one before passes its gate. A gate is passed by real use, not by merged code.

## Phase 0. Foundation (mostly done)
One shell and menu, roles in the database, linked data model, staging copy, backups, logs, shared theme.
Encryption split done for buyers and deals (working fields readable, personal details encrypted).

**Gate 0:** a rep signs in on phone and PC and sees only their own data. Database half passed Oct 31 on live as Kyle Miller (17 tables, 0 rows of anyone else's). Still needed: Kyle signs in once on a phone and once on a PC.

## Phase 1. Daily work
Done: call counter and Calls today, do-not-call list, feedback button, pinned announcement, Today screen (today's numbers, callbacks due, deals needing action, next lesson, on the Team home), end-of-day reports (the rep's clock-out note and numbers; Amr's Admin overview lists today or yesterday for everyone: sent, no report, on shift, didn't work).
Not built:
- Pipeline board: stages from new lead to closed, countdowns for inspection period and closing.
- Notifications: access requests, drills submitted, deal stage changes, payments in.

**Gate 1:** every rep logs every call for two straight weeks.

## Phase 2. Deals and money
Done: buyers list and matching ("Buyers who fit" on every deal).
Done: the deals split (`DATA-MODEL.md` section 4).
Not built: deal folder (contract, title company, comps, due diligence checklist), deal sheet maker (one-page PDF for buyers), commissions per rep per deal feeding Cash.

**Gate 2:** first deal matched to a buyer from the list.

## Phase 3. Grow the team
Team overview, call scoring with the ACQ 22 50-point scorecard, roleplay practice, certificates after Module 15, onboarding checklist per new hire, script and objection library.
Paid sign-up goes live here, only once the legal pages (terms, refund, privacy) and staging are in place.

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
