# Marketing course checks (/app/course)

Content audits (run from `app/course`, no browser needed):

- `node ../../tools/marketing-course/audit.js marketing $(cd marketing; ls m??.js m??q.js)`: structure, sources, tone, quiz balance, answer keys (model answers pass, blank and junk answers don't).
- `node ../../tools/marketing-course/audit-ar.js marketing m01`: an Arabic module against its English one.
- `node ../../tools/marketing-course/audit-recap.js marketing` and `recapnums.js marketing`: recap links, tone, Arabic parity, and that every recap figure appears in its module.
- `lesson.js marketing m01` and `dump.js marketing m01` print a module's text (for writing or translating).

Browser checks (Playwright, Chromium):

1. From the repo root: `python3 -m http.server 8765` and `bash tools/marketing-course/make-test-page.sh`.
2. `node tools/marketing-course/smoke.js <screenshot dir> m01,m02,…,m16`: every page on desktop, tablet and phone; errors, sideways scrolling, learner lock, a full checkpoint pass.
3. `feat.js <dir>` (language switch, search, pen), `recap.js <dir> m01,…` and `recap-ar.js <dir>` (recap pages).
4. Delete `app/course/_test.html` before committing.
