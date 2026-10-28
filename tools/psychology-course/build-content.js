// Builds psy/content.json for the private "course-content" bucket and runs the content checks.
// Usage: node tools/psychology-course/build-content.js <source> <out folder>
//   <source> is either a content.json (downloaded from Supabase > Storage > course-content > psy) or a
//   standalone Psychology-Course-Player.html (the single-file version with window.COURSE inside).
// Writes <out>/content.json. Nothing is written inside this repo: the repo is public.
const fs = require('fs'), path = require('path');
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('Usage: node build-content.js <content.json | player.html> <out folder>'); process.exit(1); }
let text = fs.readFileSync(src, 'utf8'), C;
if (/\.html?$/i.test(src)) {
  const a = text.indexOf('window.COURSE='); if (a < 0) throw new Error('No window.COURSE in ' + src);
  const b = text.indexOf(';window.I18N=', a), e = b > 0 ? b : text.indexOf(';</script>', a);
  C = JSON.parse(text.slice(a + 'window.COURSE='.length, e));
} else C = JSON.parse(text);

// ---------- checks ----------
const problems = [], warn = [];
const walk = (o, p, f) => { if (typeof o === 'string') f(o, p); else if (Array.isArray(o)) o.forEach((v, i) => walk(v, p + '[' + i + ']', f)); else if (o && typeof o === 'object') Object.keys(o).forEach(k => walk(o[k], p + '.' + k, f)); };
if (!Array.isArray(C.modules) || C.modules.length !== 27) problems.push('Expected 27 modules, found ' + (C.modules || []).length);
walk(C, 'COURSE', (s, p) => {
  if (/[–—]/.test(s)) problems.push('Dash (en or em) at ' + p);
  if (/\b(delve|leverage|robust|comprehensive|seamless(ly)?|results-driven|proven ability)\b/i.test(s.replace(/<[^>]+>/g, ' ')) && !/\.ar\b/.test(p)) warn.push('AI-sounding word at ' + p);
  if (/<script|on\w+\s*=|javascript:/i.test(s)) problems.push('Script-like markup at ' + p);
});
(C.modules || []).forEach(m => m.items.forEach(it => {
  if (it.type !== 'quiz' && it.type !== 'exam') return;
  const en = it.exam.q.en, ar = it.exam.q.ar, where = 'Module ' + m.num + ' ' + it.id;
  if (!ar || en.length !== ar.length) problems.push(where + ': English and Arabic have a different number of questions');
  en.forEach((q, i) => {
    if (!(q.ans >= 0 && q.ans < q.opts.length)) problems.push(where + ' Q' + (i + 1) + ': answer out of range');
    if (ar && ar[i] && ar[i].ans !== q.ans) problems.push(where + ' Q' + (i + 1) + ': English and Arabic answers differ');
    if (ar && ar[i] && ar[i].opts.length !== q.opts.length) problems.push(where + ' Q' + (i + 1) + ': option count differs');
  });
  if (!(it.exam.pass > 0 && it.exam.pass <= en.length)) problems.push(where + ': pass mark ' + it.exam.pass + ' of ' + en.length);
}));
// Egyptian helplines: flag any 5-digit hotline-looking number that is not one of the checked ones
const OK = new Set(['16328', '16023', '16000', '15115']);
walk(C, 'COURSE', (s, p) => { (s.match(/(?:hotline|helpline|line|الخط|خط)[^0-9]{0,40}(1\d{4})/gi) || []).forEach(x => { const n = x.match(/1\d{4}$/)[0]; if (!OK.has(n)) warn.push('Unknown helpline ' + n + ' at ' + p); }); });

warn.slice(0, 20).forEach(w => console.log('Check: ' + w));
if (problems.length) { problems.slice(0, 50).forEach(x => console.error('Problem: ' + x)); console.error(problems.length + ' problem(s). Nothing written.'); process.exit(1); }
fs.mkdirSync(out, { recursive:true });
fs.writeFileSync(path.join(out, 'content.json'), JSON.stringify(C));
console.log('OK: ' + C.modules.length + ' modules, ' + (fs.statSync(path.join(out, 'content.json')).size / 1e6).toFixed(1) + ' MB -> ' + path.join(out, 'content.json'));
