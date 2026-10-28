// Prints a module's lesson text compactly (for writing its recap): part, section index, heading, plain text, case box, terms.
global.window = global; const fs = require('fs'), dir = process.argv[2], id = process.argv[3];
eval(fs.readFileSync(dir + '/course.js', 'utf8')); eval(fs.readFileSync(dir + '/' + id + '.js', 'utf8'));
const m = COURSE.modules[id], txt = h => String(h || '').replace(/<li>/g, ' • ').replace(/<\/(p|h4|tr)>/g, ' | ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
console.log(m.n + ' ' + m.t);
m.parts.forEach((p, i) => { console.log(`\n## ${i + 1} ${p.t}`); p.s.forEach((s, j) => console.log(`[s${j}] ${s.h}: ${txt(s.b)}`)); console.log(`[ex] ${txt(p.ex)}`); console.log('[terms] ' + p.terms.map(t => t[0]).join('; ')); });
