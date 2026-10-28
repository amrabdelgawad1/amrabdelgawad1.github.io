# Handoff: Acquisitions Playbook course app, round 1 (phone)

Branch `course-app-phone`. Not merged, not deployed. Everything below is for the reviewer and for Amr.

## 1. Status in one minute

| Done means (from the brief) | Status |
| --- | --- |
| The five approved screens match the screenshots at 390px | Done. Side-by-side comparisons were checked; differences listed in section 7 |
| Module 1 fully playable from `module-1.json` (11 lessons, 231 questions, drill, checkpoint) | Done in test mode. A browser script plays all 231 questions through the app (`tools/course-dev/e2e-full.mjs`) |
| Progress saves and survives a reload | Done in test mode (checked by `e2e.mjs`) |
| Installs to a phone home screen | Manifest, service worker and icons in place; install prompt and iPhone steps built. **Not tried on a real phone yet** |
| Only approved users get in | Done in the database rules; checked in test mode (19 database checks) |
| Answers graded on the server | Done. Grading is in Postgres functions; the browser never receives a correct option |
| `HANDOFF.md` complete | This file |
| **Applied to and tested on the real Supabase project** | **Not done.** This session's network couldn't reach Supabase (see section 5) |

## 2. What I found in the repo

- A static GitHub Pages site: plain HTML, CSS and JavaScript, no build step. Pushing to `main` deploys (`.github/workflows/static.yml`).
- Supabase project `ztlpgyomjuzmjmuifbbd`, loaded with supabase-js 2.45.4 from jsdelivr. URL and public key in `tracker/config.js`.
- Sign-in: email and password. Amr is `is_tracker_admin()` with an authenticator code. Team members are rows in `members` with `active` and an `access` array, switched on in `/app` > Invite and access. Invites come from the `team-access` edge function.
- The SQL for the existing tables and the `team-access` function are **not** in the repo, so I couldn't read them. I only rely on `is_tracker_admin()`, `members.user_id`, `members.active`, `members.access` and `members.name`.

## 3. What I built, and where it lives

All of it is at `/course/`, one page with hash routes, built the same way as the rest of the site (no framework, no build).

| Screen | Route | Code |
| --- | --- | --- |
| Sign in, authenticator code, not-on-the-course | (no route) | `course/app.js`: `signInView`, `mfaView`, `noAccessView` |
| Course home | `#/` | `homeView` |
| Module page | `#/m/m1` | `moduleView` |
| Lesson (term cards, tables, guide-page viewer) | `#/m/m1/l/1.2.s2` | `lessonView`, `openViewer`; Markdown in `course/md.js` |
| Quiz question and feedback | `#/m/m1/q/1.2.s2` (`/new` starts over) | `quizStart`, `questionView` |
| Result | `#/m/m1/r/<attempt id>` | `resultView` |
| Checkpoint (locked and open) | `#/m/m1/c/1.checkpoint` | `checkpointView` |
| Written drill | `#/m/m1/a/1.assignment` | `assignmentView` |
| Locked module | `#/locked/2` | `lockedView` |
| Install | `#/install`, plus a card on home | `installView`, `installCard` |
| Menu | (sheet) | `openMenu` |
| Admin: learners and drills waiting | `#/admin` | `course/admin.js`: `homeView` |
| Admin: one learner | `#/admin/u/<user id>` | `learnerView` |
| Admin: one quiz attempt | `#/admin/u/<user id>/a/<attempt id>` | `attemptView` |
| Admin: review a drill (answers, answer key, approve or return) | `#/admin/u/<user id>/s/m1/1.assignment` | `submissionView` |
| Admin: add a module and its images | `#/admin/add` | `addView`, `showImages` |

Other files:

- `course/course.css`: every style, with the approved colors as variables at the top.
- `course/manifest.webmanifest`, `course/sw.js`, `course/icon-*.png`: the installable app "Acquisitions Playbook", scope `/course/`, white "AP" on `#C24E1C`.
- `app/app.js`, `app/index.html`, `app/sw.js`: the "Acquisitions course" switch in Invite and access, and a "Course" link in the `/app` menu (shown to Amr and to anyone with the switch on). App version bumped so installed copies update.
- `supabase/migrations/20261028120000_course_app.sql`: the database (section 4).
- `tools/course-dev/`: the local test mode and the checks (section 6). Not used by the live site.

### How content reaches a learner

1. Amr uploads `module-N.json` on Admin > Add a module. `course_add_module()` checks its shape (ids, types, every question has options and at least one correct answer, single choice has exactly one) and stores it in `course_modules`. Nobody's browser can read that table.
2. Amr then picks the module's images on the same screen. They're matched by file name and stored in the private bucket `course` under `content/<module id>/`.
3. The app calls `course_state()`, which returns the course with `correct`, `explanation` and `reviewerAnswerKey` removed. Locked modules come back as an outline only (titles, no lessons or questions).
4. Images are shown through signed links that last 6 hours.

Adding Module 2 is exactly this: upload the file and its images. No code changes. Modules 2 to 14 show as locked placeholders until their file exists.

## 4. Database

One migration: `supabase/migrations/20261028120000_course_app.sql`. It's safe to run more than once.

### Tables (all new)

| Table | Holds | Who can read it |
| --- | --- | --- |
| `course_meta` | Course title, number of modules (14) | Anyone with course access |
| `course_modules` | The full module JSON, answers included | Nobody directly. Only through the functions below |
| `course_item_done` | Lessons marked complete | The learner (own rows) and Amr |
| `course_attempts` | Every quiz attempt: answers with time per answer, score, pass, start and finish | The learner (own rows) and Amr |
| `course_submissions` | Drill answers, file path, status (draft, submitted, needs_changes, approved), Amr's comment, full history | The learner (own rows) and Amr |

No browser can insert, update or delete rows directly. All writes go through `security definer` functions that check the rules.

### Functions

| Function | For |
| --- | --- |
| `course_has_access()`, `course_is_admin()` | Who gets in. Admin is `is_tracker_admin()`, plus a passed authenticator code if Amr's account has one (same as `/app`) |
| `course_state(p_content)` | Everything the app shows; `p_content = false` for the quick refresh after each action |
| `course_mark_done` | Mark a lesson complete or not |
| `course_quiz_start`, `course_quiz_answer`, `course_quiz_finish`, `course_attempt_result` | Quizzes. Grading happens here |
| `course_save_answers`, `course_set_file` | The drill |
| `course_admin_learners`, `course_admin_waiting`, `course_admin_learner`, `course_admin_attempt`, `course_admin_submission`, `course_review`, `course_add_module` | Admin (each one refuses anyone but Amr) |
| `course_flat`, `course_public_quiz`, `course_public_item`, `course_quiz_passed`, `course_checkpoint_open`, `course_module_open`, `course_module_progress`, `course_open_item` | Internal helpers. The ones that take a user id can't be called from a browser |

### Storage

The migration creates one private bucket, `course`, with a 10 MB limit and only PDF, image, Word and Excel types allowed:

- `content/<module id>/...`: thumbnails and guide pages. Readable with course access; only Amr can write.
- `uploads/<user id>/<item id>/...`: drill files. Each learner can write and delete only their own folder, and not once the drill is approved. Amr can read them all.

### `members.access`

The last block lets `members.access` hold `'course'`. If a check constraint lists the allowed values, it adds `'course'` next to `'learn'`. If `access` is an enum array, it adds the value to the enum. If it's a plain text array, nothing changes. It prints a NOTICE saying what it did. This is the only thing that touches an existing table.

### Run notes (for the real project)

There is **no separate edge function to deploy**. Grading lives in the migration.

1. Supabase dashboard > SQL Editor > New query. Paste the whole migration and run it. Expect `NOTICE` lines; "does not exist, skipping" on a first run is normal.
2. Check it worked:
   ```sql
   select count(*) from pg_proc where proname like 'course\_%';   -- 27
   select id, public, file_size_limit from storage.buckets where id = 'course';
   ```
3. Open the course signed in as Amr. Before merging you can do this locally against the real project: from the repo root, run `npx http-server -p 8080 -c-1`, then open `http://localhost:8080/course/`.
4. Admin > Add or update a module: choose `module-1.json`, press Add, then choose all 15 thumbnails and the 17 files in `source-images/` together. The list should end on "All 32 images are uploaded."
5. In `/app` > Invite and access, switch on **Acquisitions course** for a test team member. Sign in as them at `/course/`.

Or, with the Supabase CLI: `supabase link --project-ref ztlpgyomjuzmjmuifbbd`, then `supabase db push`.

## 5. What I applied and tested on the real project

**Nothing.** This session's network policy refused `api.supabase.com` and `ztlpgyomjuzmjmuifbbd.supabase.co` the whole time (proxy 403), including after `supabase.com` was added to the allowed list. The project host ends in `.co`, so it needs its own entry; network changes may also only reach new sessions.

So: no tables, policies or functions were created on the real project, no test learner account was made, and no admin check was run there. The token was never used, printed, or written to a file. **Rotate it anyway**, because it was pasted into the chat.

What to test on the real project once the migration is in (the local runs cover all of this, but on a stand-in for Supabase):

- [ ] Amr signs in at `/course/`, is asked for the authenticator code, and sees Admin in the menu
- [ ] A team member with the switch off gets "Not on the course yet"; switch it on and they get in
- [ ] A learner opens a lesson, marks it complete, takes a quiz, sees right or wrong with the explanation, reloads, and the progress is still there
- [ ] In the browser's network tab, `course_state` and `course_quiz_start` responses contain no `"correct"` and no `"explanation"`
- [ ] A learner can't call `course_admin_learners` (it returns "admin only")
- [ ] Drill: upload a PDF, submit, Amr returns it with a comment, the learner sees it, resubmits, Amr approves
- [ ] Install on an Android phone (Chrome's Install button) and an iPhone (Share > Add to Home Screen); it opens full screen

## 6. Running it locally (test mode)

Test mode runs the real migration on a local Postgres, and `tools/course-dev/server.mjs` stands in for Supabase's sign-in, functions and storage. The functions run as the `authenticated` role with row-level security on, so the rules being tested are the real ones. The app code has no test-only branches. The server rewrites `/tracker/config.js` and the page's security policy to point at itself, and serves the same supabase-js version from `node_modules` in case jsdelivr is unreachable.

**Its data is a gitignored copy of the real `module-1.json` and images**, copied from the kit into `tools/course-dev/data/` by the seed script. `.gitignore` also blocks `course-kit/` and any `module-*.json` anywhere, and the branch history was checked for kit text.

```bash
# 1. Postgres 16 on port 54329 (any local Postgres works)
initdb -D /tmp/coursepg -U postgres -A trust && pg_ctl -D /tmp/coursepg -o "-p 54329" start && createdb -p 54329 -U postgres course
# 2. Install, load the kit, run the server
cd tools/course-dev && npm install
KIT=/path/to/course-kit PGURL=postgres://postgres@localhost:54329/course node seed.mjs --fresh
PGURL=postgres://postgres@localhost:54329/course node server.mjs      # http://localhost:8787/course/
# 3. Checks (server running)
PGURL=... node test-sql.mjs     # 19 database rule checks
PGURL=... node e2e.mjs          # 16 browser checks
node e2e-full.mjs               # plays all 231 questions through the app
OUT=/somewhere/private node shots.mjs   # every screen at 390px
```

Test accounts (password `test`): `amr@test.local` (admin), `learner@test.local` (new), `maya@test.local` (4 of 24, like the design), `omar@test.local` (everything but the checkpoint), `nocourse@test.local` (switch off).

### Environment variables

| Name | Used by | What |
| --- | --- | --- |
| `PGURL` | test mode scripts | Local Postgres connection string |
| `KIT` | `seed.mjs` | Path to the course kit folder, outside the repo |
| `PORT`, `BASE` | `server.mjs`, test scripts | Test server port (8787) and URL |
| `OUT`, `WIDTH`, `HEIGHT` | `shots.mjs` | Where screenshots go, and the viewport |

The live site needs none. It uses `tracker/config.js`, which holds only the public URL and the publishable key.

### Results of the last run

- `test-sql.mjs`: 19 of 19. Covers: no access without the switch; no answers, explanations or answer key in what learners get; the content table unreadable; no direct writes; other people's rows invisible; admin refused for learners; checkpoint lock; progress counts (4 of 24, 23 of 24); single and multiple choice grading; answers can't be changed; 80% and 85% pass marks; Module 2 unlocking; bad module files refused; the drill's full return-and-approve cycle; storage folders.
- `e2e.mjs`: 16 of 16, with no script errors or security-policy violations. Covers: sign-in errors; Mark complete updating home without a reload and surviving one; a keyboard-only quiz; resume mid-quiz; Retake; checkpoint redirect; drill autosave, upload (and a file over 10 MB refused), submit, return, resubmit, approve; admin opening the file; Add module with a missing image; a broken file refused; learners kept out of admin; no sideways scrolling at 390px and at 200% zoom; sign out.
- `e2e-full.mjs`: all 231 questions answered through the screens; each prompt, option count, verdict and explanation checked.

## 7. Screenshots

They are **not in the repo**. The repo is public, and screenshots of lessons, questions and the review list would publish the course content and explanations. `tools/course-dev/shots.mjs` regenerates every screen at 390px into a gitignored folder. The round 1 set was sent to Amr directly, to forward to the reviewer.

The set includes: sign in, course home, module, lesson, guide-page viewer, quiz (unanswered, picked, feedback), result, checkpoint (locked and open), drill (empty and submitted), locked module, install (Android and iPhone), menu, no access, and admin (learners, learner, attempt, drill review, add module).

## 8. Where I went off the brief or the mockup, and why

**Agreed before building**
1. Grading is in Postgres functions, not an edge function. Same protection, one less thing to deploy.
2. Content lives only in Supabase and is added on Admin > Add a module, not as files in the repo.
3. Learners are team members with the "Acquisitions course" switch.
4. The route is `/course/`, installed as its own app.

**Content shown as the JSON has it (the JSON is the source of truth)**

5. The module description is the JSON's longer text, not the mockup's shorter one.
6. Session titles are the JSON's ("Session 1: The Lead and the Seller's Money"). The mockup's "Session 1: Stages 1 and 2" labels aren't in the data.
7. The lesson label line is "LESSON 3 OF 11 · ACQ 02". The mockup's "STAGES 3 AND 4" isn't in the data, and Session 2 is the third lesson, not the fourth (1.1, Session 1, Session 2).
8. Result review rows read "Q9 · " plus the full question. The mockup's short summaries ("Repairs come in at $74,000") aren't in the data.
9. Guide page buttons read "Guide page 6 · ACQ 02". The mockup's captions ("Stage 3") aren't in the data.
10. **Content question for the reviewer:** the drill instructions say to fix missed answers "in a different color". Plain text boxes can't do colors. Suggest rewording, for example "add what you missed under a line that starts FIX:".

**Rules I had to decide (please confirm)**

11. A lesson quiz counts as passed when its *latest* finished attempt passed, so a lower retake can close the checkpoint again until they pass. A *module*, once unlocked, stays unlocked even if a later checkpoint retake scores lower.
12. Scores round down: 21 of 25 is 84% and doesn't pass the 85% checkpoint.
13. Once an answer is submitted it can't be changed. Leaving mid-quiz keeps the attempt: coming back resumes at the next question. Retake discards an unfinished attempt. Only finished attempts count and show in Admin.
14. Drill: submitting needs all 12 tasks answered; the file is optional. Changing answers after submitting sets the status back to draft ("Changed since you submitted") until they submit again. The checkpoint stays open once the drill has been submitted once. For the "x of 24" count, the drill counts while submitted or approved, not while returned.
15. Amr's account skips every lock (to check content), and the module page says so.
16. The 24 items in Module 1 are: 11 lessons, 11 lesson quizzes, the drill and the checkpoint.

**Small design decisions on the approved screens**

17. On the module page, a lesson that hasn't been started shows its quiz in the same row ("Lesson + 18-question quiz"), as in the mockup. Its own quiz row appears once the lesson is current, done, or has an attempt.
18. The locked Module 2 and Module 3 rows are links to a locked-module screen; in the mockup they weren't clickable. The rest are behind "+ 11 more modules", which expands.
19. The menu (☰) is on course home and Admin. It has Course home, Admin (Amr only, with the count waiting), Install the app, Talents app, and Sign out. The back arrow on course home goes to `/app`.
20. When nothing has been done yet, the home button reads "Start: 1.1" instead of "Continue:".
21. The "Pass 80%" header label and the 80% / 85% marks come from each quiz's `passMark` in the JSON.
22. At 768px and up, the side padding is 32px, and the content is one centered column, up to 640px wide, until the round 2 desktop layout. Below 340px wide (a phone at 200% zoom), list thumbnails hide and bottom buttons stack, so nothing scrolls sideways.
23. The home-screen label is "Acquisitions" (`short_name`), because "Acquisitions Playbook" gets cut off under the icon on most phones. The full name shows everywhere else. It's one line in the manifest if you'd rather have the full name.
24. Fonts load from Google Fonts with system fallbacks.

## 9. Builder-designed screens (needs review)

All in the approved style and tokens:

- Sign in, authenticator code, and "Not on the course yet"
- Written drill: banner; label; instructions; status box (Submitted / Needs changes with Amr's note / Approved / Changed since you submitted); 12 task cards with labelled text boxes; file card (choose, replace, remove); autosave line; Save draft and Submit for review
- Checkpoint gate: locked (checklist of the 11 quizzes and the drill, each a link, and a "Next:" button) and open (rules, last score, Start / Continue / Take it again)
- Locked module: lock tile, reason, and the previous module's progress with a button to go there
- Install: an Android Install button when Chrome offers it; on iPhone, three steps with the Share icon; a dismissible card on home
- Menu sheet
- Guide-page viewer: full screen, the required note, pinch to zoom, and a zoom button
- Admin: learners (avatar, module, percent, last active, latest checkpoint, progress bar); drills waiting; one learner (progress per module, drills, attempts with score and time); one attempt (each question, their picks, correct options marked); drill review (answers, then the answer key, history, comment, Return with comment / Approve); Add a module (step 1 the file, step 2 the images, with uploaded/missing for each)

## 10. Not done yet

- **Applying and testing on the real Supabase project** (section 5).
- `/app` changes (switch and link) were not run, because test mode only stands in for the course functions. The change is small: one entry in `SECTION_NAMES`, one menu link, version bumps.
- A real-device install test on Android and iPhone.
- Offline use: the app's own files are cached, but lessons and progress need a connection.
- Desktop layout (round 2).
- No email when a drill is submitted (agreed; the count is on Admin).

## 11. Adding outside students later

Course access already depends only on `course_has_access()`, and every course table points at `auth.users`, not at `members` or companies. To add students:

1. Add a table, say `course_students (user_id uuid primary key references auth.users, name text, active boolean, invited_at timestamptz)`.
2. Add one line to `course_has_access()`: `or exists (select 1 from course_students s where s.user_id = auth.uid() and s.active)`.
3. Use `coalesce(members.name, course_students.name, email)` in the admin functions for names.
4. Add an invite path. It must run with the service-role key, so put it in an edge function like `team-access`, without creating a `members` row. Show a "Students" list on the course Admin page.

No progress tables change, and team members aren't affected.
