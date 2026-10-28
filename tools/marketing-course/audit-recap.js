// Recap audit: shape matches the module, every link points at a real section, tone rules, Arabic parity and figures.
const fs = require('fs'), vm = require('vm'), dir = process.argv[2];
const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
const run = f => vm.runInContext(fs.readFileSync(dir + '/' + f, 'utf8'), ctx);
run('course.js'); ctx.COURSE = ctx.window.COURSE; run('ar/course.ar.js');
const ids = fs.readdirSync(dir).filter(f => /^m\d\dr\.js$/.test(f)).map(f => f.slice(0, 3));
const bad = [], BANNED = /—|–|\b(delve|leverage|unlock|elevate|seamless|game-?changer|in today's|robust|harness|navigate the|it's worth noting|tapestry)\b/i;
const nums = s => (String(s).match(/\d[\d,.]*/g) || []).map(x => x.replace(/[.,]$/, '')).sort().join(' ');
let points = 0;
for (const id of ids) {
  run(id + '.js'); run(id + 'q.js'); run(id + 'r.js');
  if (fs.existsSync(dir + '/ar/' + id + '.ar.js')) { run('ar/' + id + '.ar.js'); run('ar/' + id + 'q.ar.js'); if (fs.existsSync(dir + '/ar/' + id + 'r.ar.js')) run('ar/' + id + 'r.ar.js'); }
  const m = ctx.COURSE.modules[id], r = m.recap, P = (p, sec, w) => { const part = m.parts[p - 1]; if (!part) return bad.push(`${id} ${w}: no part ${p}`); if (sec !== 'ex' && !part.s[sec]) bad.push(`${id} ${w}: part ${p} has no section ${sec}`); };
  if (r.ideas.length !== m.parts.length) bad.push(`${id}: ${r.ideas.length} idea groups for ${m.parts.length} parts`);
  r.ideas.forEach((pt, i) => { if (pt.length < 3 || pt.length > 6) bad.push(`${id} part ${i + 1}: ${pt.length} ideas`); pt.forEach((x, j) => { P(i + 1, x[1], 'idea ' + (i + 1) + '.' + j); points++; }); });
  r.nums.forEach((x, i) => P(x[2], x[3], 'num ' + i)); r.traps.forEach((x, i) => P(x[1], x[2], 'trap ' + i)); r.check.forEach((x, i) => P(x[2], x[3], 'check ' + i));
  if (r.check.length !== 5) bad.push(`${id}: ${r.check.length} self-checks`);
  const all = JSON.stringify(r); if (BANNED.test(all)) bad.push(`${id}: banned word or dash: ${all.match(BANNED)[0]}`);
  const ra = ctx.COURSE.ar.modules[id] && ctx.COURSE.ar.modules[id].recap;
  if (ra) {
    const shape = o => [o.ideas.map(p => p.length).join(','), o.nums.length, o.traps.length, o.check.length].join('|');
    const sa = [ra.ideas.map(p => p.length).join(','), ra.nums.length, ra.traps.length, ra.check.length].join('|');
    if (shape(r) !== sa) bad.push(`${id} ar: shape ${sa} vs ${shape(r)}`);
    if (/—|–/.test(JSON.stringify(ra))) bad.push(`${id} ar: em or en dash`);
    r.nums.forEach((x, i) => { if (nums(x[1]) !== nums(ra.nums[i][1])) bad.push(`${id} ar num ${i}: figures differ: [${nums(x[1])}] vs [${nums(ra.nums[i][1])}]`); });
    r.check.forEach((x, i) => { if (nums(x[1]) !== nums(ra.check[i][1])) bad.push(`${id} ar check ${i}: figures differ: [${nums(x[1])}] vs [${nums(ra.check[i][1])}]`); });
    r.ideas.forEach((pt, i) => pt.forEach((x, j) => { if (nums(x[0]) !== nums(ra.ideas[i][j])) bad.push(`${id} ar idea ${i + 1}.${j}: figures differ: [${nums(x[0])}] vs [${nums(ra.ideas[i][j])}]`); }));
    r.traps.forEach((x, i) => { if (nums(x[0]) !== nums(ra.traps[i])) bad.push(`${id} ar trap ${i}: figures differ`); });
  }
}
console.log(ids.length + ' recaps, ' + points + ' key ideas'); console.log(bad.length ? bad.join('\n') : 'No problems found.');
