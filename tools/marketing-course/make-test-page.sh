# Builds app/course/_test.html (local only, never commit it): the course page with a stand-in owner, no sign-in and no Supabase.
cd "$(dirname "$0")/../../app/course" && sed -e '/guard.js/d' -e '/Content-Security-Policy/d' -e '/supabase-js/d' -e 's#<script src="player.js#<script>window.COURSE_TEST={owner:true}</script>\n&#' index.html > _test.html
