// Every figure in a recap must appear in that module's lessons, questions, assignment or the case file.
const fs = require('fs'), vm = require('vm'), dir = process.argv[2];
const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
const run = f => vm.runInContext(fs.readFileSync(dir + '/' + f, 'utf8'), ctx);
run('course.js'); ctx.COURSE = ctx.window.COURSE;
const ids = fs.readdirSync(dir).filter(f => /^m\d\dr\.js$/.test(f)).map(f => f.slice(0, 3)), out = [];
const nums = s => (String(s).match(/\d[\d,.]*/g) || []).map(x => x.replace(/[.,]$/, '').replace(/,/g, ''));
for (const id of ids) {
  run(id + '.js'); run(id + 'q.js'); run(id + 'r.js');
  const m = ctx.COURSE.modules[id], { recap, ...rest } = m;
  const have = new Set(nums(JSON.stringify(rest) + JSON.stringify(ctx.COURSE.case)));
  const texts = []; (function walk(o){ if (typeof o === "string") texts.push(o); else if (o && typeof o === "object") Object.values(o).forEach(walk); })(recap);
  const missing = [...new Set(nums(texts.join(" | ")))].filter(n => !have.has(n));
  if (missing.length) out.push(id + ': ' + missing.join(' '));
}
console.log(out.join('\n') || 'All recap figures found in their modules.');
