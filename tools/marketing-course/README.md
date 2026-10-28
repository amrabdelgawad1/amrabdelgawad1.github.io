# Marketing course: content, checks and upload (/app/course)

## Where the content lives

The lessons, questions, recaps, sources and case files are **not in this repo**. The repo is public, so anything here can be read by anyone.

- The course page (`app/course/`) and a small public `app/course/marketing/course.js` (title, pass mark, `team` switch, module plan) stay here.
- Everything else is one file, `mkt/content.json`, in the private Supabase storage bucket `course-content`. `player.js` downloads it only after `learn_can_open('mkt')` says yes: Amr, or active team members with both **Learning Hub** and **Marketing course** switched on in /app > Invite and access.
- The editable source files (`course.js`, `m01.js` to `m16r.js`, `ar/…`) are kept as `_src/mkt-source.zip` in the same bucket. Only Amr can read that folder.
- The database rules are in `supabase/migrations/20261028180000_course_content_lock.sql`.

## Changing content

1. Download `_src/mkt-source.zip` from Supabase > Storage > course-content and unzip it into a folder outside this repo, for example `~/course-src/marketing`.
2. Edit the files there. If you change the title, pass mark, stages or module plan, change `app/course/marketing/course.js` here to match (the build checks they agree).
3. Run the checks below against that folder.
4. Build: `node tools/marketing-course/build-content.js ~/course-src/marketing ~/course-out`. This writes `content.json` and `source.zip`.
5. Upload in Supabase > Storage > course-content: `content.json` to the `mkt` folder (replace), `source.zip` to `_src` as `mkt-source.zip` (replace). People see the new content the next time they open the course.

## Content audits (no browser needed)

Run from the folder that holds `marketing/` (your source folder's parent), with `T` set to this repo's `tools/marketing-course`:

- `node $T/audit.js marketing $(cd marketing; ls m??.js m??q.js)`: structure, sources, tone, quiz balance, answer keys (model answers pass, blank and junk answers don't).
- `node $T/audit-ar.js marketing m01`: an Arabic module against its English one.
- `node $T/audit-recap.js marketing` and `node $T/recapnums.js marketing`: recap links, tone, Arabic parity, and that every recap figure appears in its module.
- `lesson.js marketing m01` and `dump.js marketing m01` print a module's text (for writing or translating).

## Browser checks (Playwright, Chromium)

1. From the repo root: `python3 -m http.server 8765` and `bash tools/marketing-course/make-test-page.sh ~/course-src/marketing`. This builds `app/course/_test.html` and `_test-content.json` (git ignores both).
2. `node tools/marketing-course/smoke.js <screenshot dir> m01,m02,…,m16`: every page on desktop, tablet and phone; errors, sideways scrolling, learner lock, a full checkpoint pass.
3. `feat.js <dir>` (language switch, search, pen), `recap.js <dir> m01,…` and `recap-ar.js <dir>` (recap pages).
4. Delete `app/course/_test.html` and `_test-content.json` when you're done.

A blocked Google Fonts request shows up as one `ERR_TUNNEL_CONNECTION_FAILED` error in places without internet access; that's the font, not the course.
