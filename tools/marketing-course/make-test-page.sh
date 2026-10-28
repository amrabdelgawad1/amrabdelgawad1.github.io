# Builds app/course/_test.html and _test-content.json (local only, never commit them): the course page with a
# stand-in owner, no sign-in and no Supabase, loading the content from the source folder instead of the bucket.
# Usage: bash tools/marketing-course/make-test-page.sh <source folder>   (the folder with course.js, m01.js…)
SRC="$(cd "${1:?Give the course source folder}" && pwd)"
cd "$(dirname "$0")/../../app/course" || exit 1
node ../../tools/marketing-course/build-content.js "$SRC" "$PWD/_test-build" >/dev/null && mv _test-build/content.json _test-content.json && rm -rf _test-build || exit 1
sed -e '/guard.js/d' -e '/Content-Security-Policy/d' -e '/supabase-js/d' -e 's#<script src="player.js#<script>window.COURSE_TEST={owner:true}</script>\n&#' index.html > _test.html
