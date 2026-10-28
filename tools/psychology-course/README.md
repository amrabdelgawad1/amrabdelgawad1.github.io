# Psychology and Therapy course: content, checks and upload (/app/psychology)

## Where things live

The lessons, quizzes, exams, playbooks and glossary are **not in this repo**. The repo is public, so anything here can be read by anyone.

- The player (`app/psychology/`: `index.html`, `gate.js`, `player.js`, `psy.css`, `strings.js`) and a small public `app/psychology/course.js` (title, access switch, module count) stay here.
- All lesson content is one file, `psy/content.json`, in the private Supabase storage bucket `course-content`.
- `gate.js` downloads it only after `learn_can_open('psy')` says yes: Amr, or active team members with both **Learning Hub** and **Psychology course** switched on in /app > Invite and access. The bucket rules refuse the file to everyone else on their own.
- The editable source (the single-file player with everything inside, `Psychology-Course-Player.html`) is kept as `_src/psy-player.html` in the same bucket. Only Amr can read that folder.
- Progress (ticks, quiz and exam scores, notes, drawings, language) saves on the device at once and to the `learn_progress` table, course `psy`, so it follows the person to other devices.
- Database rules: `supabase/migrations/20261028180000_course_content_lock.sql` (the lock) and `20261028230000_members_access_psy.sql` (lets the `psy` switch be saved).

## Giving someone the course

In /app > Invite and access, tick both **Learning Hub** and **Psychology course** for that team member.

## Changing content

1. Download `psy/content.json` (or `_src/psy-player.html`) from Supabase > Storage > course-content into a folder outside this repo.
2. Edit it there.
3. Build and check: `node tools/psychology-course/build-content.js <content.json or player.html> ~/course-out`. It refuses to write anything if it finds en or em dashes, English and Arabic answer keys that differ, a wrong pass mark, or script-like markup, and it lists any unknown helpline number.
4. Upload `~/course-out/content.json` to the `psy` folder in Supabase > Storage > course-content (replace). People see the new content the next time they open the course.

## Local test (no Supabase needed)

1. `bash tools/psychology-course/make-test-page.sh ~/course-out/content.json` (writes `app/psychology/_test.html` and `_test-content.json`; git ignores both).
2. From the repo root: `python3 -m http.server 8765`, then open `http://localhost:8765/app/psychology/_test.html`.
3. Delete the two `_test` files when done.
