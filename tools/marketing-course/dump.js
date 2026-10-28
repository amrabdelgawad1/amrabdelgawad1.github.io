global.window = global; const fs = require('fs'), dir = process.argv[2], id = process.argv[3];
eval(fs.readFileSync(dir + '/course.js', 'utf8'));
for (const f of [id + '.js', id + 'q.js']) eval(fs.readFileSync(dir + '/' + f, 'utf8'));
const m = COURSE.modules[id];
const out = { t:m.t, skill:m.skill, covers:m.covers, outcomes:m.outcomes, parts:m.parts.map(p => ({ t:p.t, s:p.s.map(s => ({ h:s.h, b:s.b })), ex:p.ex, b2b:p.b2b, terms:p.terms, q:p.q.map(q => ({ l:q.l, q:q.q, a:q.a, why:q.why, k:q.k })) })),
  assignment:{ t:m.assignment.t, brief:m.assignment.brief, tasks:m.assignment.tasks, key:m.assignment.key, rubric:m.assignment.rubric.map(r => r[0]) }, quiz:m.quiz.map(q => ({ q:q.q, o:q.o, why:q.why })) };
if (process.argv[4] === 'case') console.log(JSON.stringify({ title:COURSE.title, sub:COURSE.sub, stages:COURSE.stages, plan:COURSE.plan.map(p => p.t), case:COURSE.case }, null, 1));
else console.log(JSON.stringify(out, null, 1));
