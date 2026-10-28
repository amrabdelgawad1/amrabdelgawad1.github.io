// Full content audit for built modules: structure, coverage, ordering, sources, tone, quiz balance, ready flags, keys.
const fs = require('fs'), vm = require('vm'), dir = process.argv[2], files = process.argv.slice(3);
const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(dir + '/course.js', 'utf8'), ctx); ctx.COURSE = ctx.window.COURSE;
for (const f of files) vm.runInContext(fs.readFileSync(dir + '/' + f, 'utf8'), ctx);
const C = ctx.COURSE, problems = [];
const FOLD = { 'أ':'ا', 'إ':'ا', 'آ':'ا', 'ٱ':'ا', 'ة':'ه', 'ى':'ي', 'ؤ':'و', 'ئ':'ي', '٫':'.', '٬':',', '٪':'%', '،':',', '’':"'", '‘':"'", '`':"'" };
const foldChar = ch => { const l = ch.toLowerCase(), c = l.charCodeAt(0); if ((c >= 0x64B && c <= 0x65F) || c === 0x670 || c === 0x640) return ''; if (c >= 0x660 && c <= 0x669) return String(c - 0x660); if (c >= 0x6F0 && c <= 0x6F9) return String(c - 0x6F0); return FOLD[l] || l; };
const fold = s => { let o = ''; for (const ch of String(s)) o += foldChar(ch); return o; };
const norm = s => ' ' + fold(s).replace(/'/g, ' ').replace(/(\d),(?=\d)/g, '$1').replace(/[^a-z0-9.%\sء-ي]/g, ' ').replace(/\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
const BLANK = / (i )?(don t|do not) know | no idea | not sure | (انا )?(مش عارف|معرفش|ماعرفش|مش متاكد|لا اعرف|مش فاكر|معنديش فكره) /g;
const VERDICT = /^ (yes|no|yeah|yep|nope|nah|not really|maybe|true|false|correct|نعم|لا|اه|ايوه|ايوا|اكيد|لا طبعا|ممكن)( (yes|no|لا|نعم))? $/;
const hit = (ans0, w) => { const c = ans0.replace(BLANK, ' ').replace(/\s+/g, ' '); const ans = c.trim() && !VERDICT.test(c) ? ans0 : ' '; return hit0(ans, w); };
const hit0 = (ans, w) => { const t = norm(w).trim(); if (!t) return false; if (w[0] === '=') return ans.includes(' ' + t + ' '); if (/^[\d.]+%?$/.test(t)) return new RegExp('(^|[^\\d.])' + t.replace(/[.%]/g, m => '\\' + m) + '(?![\\d])').test(ans); return ans.includes(t); };
const banned = /—|\b(leverag\w*|seamless\w*|results-driven|robust|unlock\w*|elevate\w*|delve\w*|game.changer|harness\w*|streamlin\w*|cutting-edge|best-in-class|synergy|empower\w*|supercharge\w*|deep dive|world-class)\b/i;
for (const p of C.plan) { const m = C.modules[p.id]; if (!!p.ready !== !!m) problems.push(p.id + ': ready flag ' + !!p.ready + ' but content ' + (m ? 'loaded' : 'missing')); }
for (const m of Object.values(C.modules)) {
  const tag = 'M' + m.n;
  ['skill','covers','outcomes','parts','assignment','quiz'].forEach(f => { if (!m[f]) problems.push(tag + ' missing ' + f); });
  let L = { b:0, a:0, t:0 };
  m.parts.forEach((p, i) => {
    const pt = m.n + '.' + (i + 1);
    if (!p.q || !p.q.length) { problems.push(pt + ' has no questions'); return; }
    p.q.forEach(q => L[q.l]++);
    if (!/^b+a+t+$/.test(p.q.map(q => q.l).join(''))) problems.push(pt + ' questions not ordered basic→applied→tough');
    p.s.forEach((x, j) => { if (!p.q.some(q => q.on === j)) problems.push(pt + ' section "' + x.h + '" has no question'); (x.src || []).forEach(t => { if (!C.sources[t]) problems.push(pt + ' unknown source ' + t); }); if (!x.src || !x.src.length) problems.push(pt + ' section without source'); });
    p.q.forEach((q, j) => { if (!(q.q && q.a && q.why && q.k && q.k.length && q.on !== undefined)) problems.push(pt + ' Q' + (j + 1) + ' missing a field');
      q.k.forEach(([l, any]) => any.forEach(w => { const t = norm(w).trim(); if (w[0] !== '=' && !/^[\d.]+%?$/.test(t) && t.length < 3) problems.push(pt + ' Q' + (j + 1) + ' key too short: "' + w + '"'); }));
      const miss = q.k.filter(([l, any]) => !any.some(w => hit(norm(q.a), w))); if (miss.length) problems.push(pt + ' Q' + (j + 1) + ' model answer misses key: ' + miss.map(x => x[0]).join(' | ')); });
    const txt = JSON.stringify(p); const bm = txt.match(banned); if (bm) problems.push(pt + ' tone: "' + bm[0] + '"');
  });
  const all = JSON.stringify([m.skill, m.covers, m.outcomes, m.assignment, m.quiz]); const bm = all.match(banned); if (bm) problems.push(tag + ' tone (module text): "' + bm[0] + '"');
  const pos = [0, 0, 0, 0]; m.quiz.forEach(q => q.c.forEach(c => pos[c]++));
  m.quiz.forEach((q, i) => { if (!q.c.every(c => c < q.o.length)) problems.push(tag + ' quiz Q' + (i + 1) + ' answer out of range'); });
  const total = m.parts.reduce((a, p) => a + p.q.length, 0);
  console.log(`${tag} ${m.t}: ${m.parts.length} parts, ${total} playbook (B${L.b} A${L.a} T${L.t}), quiz ${m.quiz.length} (multi ${m.quiz.filter(q => q.c.length > 1).length}, answer positions ${pos.join('/')}), rubric ${m.assignment.rubric.reduce((a, r) => a + r[1], 0)} pts`);
}
console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'No problems found.');
// Negative check: junk answers should not score half or more of the key points
const junk = ['I don t know', 'not sure', 'yes', 'marketing is important for business', 'the customer'];
let weak = [];
for (const m of Object.values(C.modules)) m.parts.forEach((p, i) => p.q.forEach((q, j) => junk.forEach(a => {
  const n = q.k.filter(([l, any]) => any.some(w => hit(norm(a), w))).length;
  if (n * 2 >= q.k.length && q.k.length > 1) weak.push(`${m.n}.${i + 1} Q${j + 1} gives ${n}/${q.k.length} to "${a}"`);
})));
console.log(weak.length ? 'Junk answers scoring half or more:\n' + weak.join('\n') : 'No junk answer scores half or more of any question’s key points.');
// Stricter: blank-style answers should earn no key point at all
const blank = ['I don t know', 'not sure', 'no idea', 'I do not know'];   // a bare yes or no may earn the verdict point only
let any1 = [];
for (const m of Object.values(C.modules)) m.parts.forEach((p, i) => p.q.forEach((q, j) => blank.forEach(a => {
  const got = q.k.filter(([l, any]) => any.some(w => hit(norm(a), w)));
  if (got.length) any1.push(`${m.n}.${i + 1} Q${j + 1} gives "${got.map(x => x[0]).join(' | ')}" to "${a}"`);
})));
console.log(any1.length ? 'Blank answers earning a point:\n' + any1.join('\n') : 'No blank answer earns any key point.');
