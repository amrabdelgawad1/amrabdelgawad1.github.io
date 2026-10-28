// Arabic content audit: node audit-ar.js <marketing dir> m01 [m02 …]
global.window = global; const fs = require('fs'), dir = process.argv[2], ids = process.argv.slice(3);
eval(fs.readFileSync(dir + '/course.js', 'utf8')); eval(fs.readFileSync(dir + '/ar/course.ar.js', 'utf8'));
// same folding and matching as player.js
const FOLD = { 'أ':'ا', 'إ':'ا', 'آ':'ا', 'ٱ':'ا', 'ة':'ه', 'ى':'ي', 'ؤ':'و', 'ئ':'ي', '٫':'.', '٬':',', '٪':'%', '،':',', '’':"'", '‘':"'", '`':"'" };
const foldChar = ch => { const l = ch.toLowerCase(), c = l.charCodeAt(0); if ((c >= 0x64B && c <= 0x65F) || c === 0x670 || c === 0x640) return ''; if (c >= 0x660 && c <= 0x669) return String(c - 0x660); if (c >= 0x6F0 && c <= 0x6F9) return String(c - 0x6F0); return FOLD[l] || l; };
const fold = s => { let o = ''; for (const ch of String(s)) o += foldChar(ch); return o; };
const norm = s => ' ' + fold(s).replace(/'/g, ' ').replace(/(\d),(?=\d)/g, '$1').replace(/[^a-z0-9.%\sء-ي]/g, ' ').replace(/\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
const BLANK = / (i )?(don t|do not) know | no idea | not sure | (انا )?(مش عارف|معرفش|ماعرفش|مش متاكد|لا اعرف|مش فاكر|معنديش فكره) /g;
const VERDICT = /^ (yes|no|yeah|yep|nope|nah|not really|maybe|true|false|correct|نعم|لا|اه|ايوه|ايوا|اكيد|لا طبعا|ممكن)( (yes|no|لا|نعم))? $/;
const hit0 = (ans, w) => { const s = norm(w).trim(); if (!s) return false; if (w[0] === '=') return ans.includes(' ' + s + ' '); if (/^[\d.]+%?$/.test(s)) return new RegExp('(^|[^\\d.])' + s.replace(/[.%]/g, m => '\\' + m) + '(?![\\d])').test(ans); return ans.includes(s); };
const score = (q, text) => { const raw = norm(text), core = raw.replace(BLANK, ' ').replace(/\s+/g, ' '); const ans = core.trim() && !VERDICT.test(core) ? raw : ' '; return q.k.filter(([l, any]) => any.some(w => hit0(ans, w))); };
const P = []; let nq = 0;
for (const id of ids) {
  for (const f of [id + '.js', id + 'q.js']) eval(fs.readFileSync(dir + '/' + f, 'utf8'));
  for (const f of ['ar/' + id + '.ar.js', 'ar/' + id + 'q.ar.js']) eval(fs.readFileSync(dir + '/' + f, 'utf8'));
  const E = COURSE.modules[id], A = COURSE.ar.modules[id], tag = id;
  if (A.parts.length !== E.parts.length) P.push(tag + ' part count ' + A.parts.length + ' vs ' + E.parts.length);
  E.parts.forEach((p, i) => { const a = A.parts[i], pt = tag + ' ' + E.n + '.' + (i + 1);
    if (!a) return;
    if (a.s.length !== p.s.length) P.push(pt + ' sections ' + a.s.length + ' vs ' + p.s.length);
    if (!!a.b2b !== !!p.b2b) P.push(pt + ' b2b box mismatch');
    if (!a.ex || !a.t) P.push(pt + ' missing title or case');
    if (!a.q || a.q.length !== p.q.length) { P.push(pt + ' questions ' + (a.q || []).length + ' vs ' + p.q.length); return; }
    a.q.forEach((q, j) => { nq++;
      if (!(q.q && q.a && q.why && q.k && q.k.length)) P.push(pt + ' Q' + (j + 1) + ' missing a field');
      if (q.k.length !== p.q[j].k.length) P.push(pt + ' Q' + (j + 1) + ' key points ' + q.k.length + ' vs ' + p.q[j].k.length + ' in English');
      q.k.forEach(([l, any]) => any.forEach(w => { const s = norm(w).trim(); if (w[0] !== '=' && !/^[\d.]+%?$/.test(s) && s.length < 3) P.push(pt + ' Q' + (j + 1) + ' key too short: "' + w + '"'); }));
      const got = score(q, q.a); if (got.length < q.k.length) P.push(pt + ' Q' + (j + 1) + ' model answer misses: ' + q.k.filter(k => !got.includes(k)).map(k => k[0]).join(' | '));
      for (const b of ['مش عارف', 'معرفش', 'لا أعرف', 'مش متأكد', "I don't know", 'لا', 'أيوه']) { const g = score(q, b); if (g.length) P.push(pt + ' Q' + (j + 1) + ' "' + b + '" earns: ' + g.map(k => k[0]).join(' | ')); }
      for (const b of ['الماركتينج مهم للبيزنس', 'العميل', 'الإعلانات']) { const g = score(q, b); if (g.length * 2 >= q.k.length && q.k.length > 1) P.push(pt + ' Q' + (j + 1) + ' junk "' + b + '" earns ' + g.length + '/' + q.k.length); }
    });
  });
  if (A.quiz.length !== E.quiz.length) P.push(tag + ' quiz ' + A.quiz.length + ' vs ' + E.quiz.length);
  A.quiz.forEach((q, i) => { if (q.o.length !== E.quiz[i].o.length) P.push(tag + ' quiz Q' + (i + 1) + ' options ' + q.o.length + ' vs ' + E.quiz[i].o.length); if (!q.why) P.push(tag + ' quiz Q' + (i + 1) + ' no why'); });
  const as = A.assignment; if (as.tasks.length !== E.assignment.tasks.length || as.rubric.length !== E.assignment.rubric.length) P.push(tag + ' assignment tasks or rubric count mismatch');
  const txt = JSON.stringify(A); if (/—/.test(txt)) P.push(tag + ' has an em dash');
  if (/[a-z]{3,}\s+[a-z]{3,}\s+[a-z]{3,}\s+[a-z]{3,}\s+[a-z]{3,}/i.test(txt.replace(/<dt>[^<]*<\/dt>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/“[^”]*”/g, ' ').replace(/\([^)]*\)/g, ' '))) P.push(tag + ' check: a long run of English words outside quotes or brackets');
  console.log(tag + ': ' + A.parts.length + ' parts, ' + A.parts.reduce((n, p) => n + (p.q || []).length, 0) + ' Arabic questions, quiz ' + A.quiz.length);
}
console.log(P.length ? 'PROBLEMS (' + P.length + '):\n' + P.join('\n') : 'No problems found (' + nq + ' questions checked).');
