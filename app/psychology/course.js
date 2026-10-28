// Psychology and Therapy course: the small public part only (title, access switch, module count).
// The lessons, quizzes, exams, playbooks and glossary are NOT on this website. They live in the private Supabase
// storage bucket "course-content" (psy/content.json) and download only after the access check in gate.js:
// Amr, or team members with both "Learning Hub" and "Psychology course" switched on in /app > Invite and access.
// To change content, see tools/psychology-course/README.md.
window.PSY_COURSE = {
  id:'psy', access:'psy', team:true,
  title:'Psychology and Therapy',
  sub:'From the foundations of psychology to therapy models, crisis skills, ethics and coaching practice. For learning only: it does not replace professional training or supervision.',
  modules:27
};
