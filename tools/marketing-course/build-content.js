// Builds the locked Marketing course content: node tools/marketing-course/build-content.js <source folder> <out folder>
// The source folder holds the full course files (course.js, m01.js… m16r.js, ar/…), kept OFF the public repo.
// Writes <out>/content.json (everything except the small public part in app/course/marketing/course.js)
// and <out>/source.zip (the source files, for the owner-only "_src" folder in the bucket).
// Then upload: content.json -> course-content/mkt/content.json, source.zip -> course-content/_src/mkt-source.zip
// (Supabase > Storage > course-content, or the "Upload course content" steps in the README).
const fs = require('fs'), path = require('path'), vm = require('vm'), { execFileSync } = require('child_process');
const [src, out] = process.argv.slice(2).map(p => p && path.resolve(p));
if (!src || !out) { console.error('Usage: build-content.js <source folder> <out folder>'); process.exit(1); }
const PUBLIC = ['id', 'title', 'pass', 'team', 'access', 'sub', 'stages', 'plan'];

// Load the files in the same order the course page used to: course.js, each module (lesson, questions, recap), then Arabic
const ctx = vm.createContext({ window:{} }); ctx.window = ctx;
const run = f => vm.runInContext(fs.readFileSync(path.join(src, f), 'utf8'), ctx, { filename:f });
run('course.js'); ctx.COURSE = ctx.window.COURSE;
const mods = fs.readdirSync(src).filter(f => /^m\d\d\.js$/.test(f)).sort();
mods.forEach(f => { const id = f.slice(0, 3); [id + '.js', id + 'q.js', id + 'r.js'].forEach(x => fs.existsSync(path.join(src, x)) && run(x)); });
// Arabic: course.ar.js first, then each module's lesson, questions and recap (m01.ar.js, m01q.ar.js, m01r.ar.js…)
const arKey = f => f === 'course.ar.js' ? '' : f.slice(0, 3) + ({ '.':0, q:1, r:2 }[f[3]]);
const ar = fs.existsSync(path.join(src, 'ar')) ? fs.readdirSync(path.join(src, 'ar')).filter(f => f.endsWith('.js')).sort((a, b) => arKey(a).localeCompare(arKey(b))) : [];
ar.forEach(f => run('ar/' + f));
const C = ctx.COURSE;

// Pure data only: the page never runs downloaded code
const bad = []; (function walk(v, at){ if (typeof v === 'function' || v === undefined) bad.push(at); else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], at + '.' + k); })(C, 'COURSE');
if (bad.length) { console.error('Not plain data:', bad.slice(0, 10).join(', ')); process.exit(1); }

// The public course.js must match the source on the shared parts
const pub = vm.createContext({ window:{} }); pub.window = pub;
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../app/course/marketing/course.js'), 'utf8'), pub);
const P = pub.window.COURSE, diff = ['id', 'title', 'pass', 'sub'].filter(k => JSON.stringify(P[k]) !== JSON.stringify(C[k]));
if (JSON.stringify(P.plan) !== JSON.stringify(C.plan)) diff.push('plan');
if (JSON.stringify(P.stages) !== JSON.stringify(C.stages)) diff.push('stages');
if (diff.length) { console.error('app/course/marketing/course.js differs from the source on: ' + diff.join(', ') + '. Update one to match.'); process.exit(1); }
const missing = C.plan.filter(p => p.ready && !C.modules[p.id]).map(p => p.id);
if (missing.length) { console.error('Marked ready but no content: ' + missing.join(', ')); process.exit(1); }

const body = {}; Object.keys(C).filter(k => !PUBLIC.includes(k)).forEach(k => body[k] = C[k]);
fs.mkdirSync(out, { recursive:true });
fs.writeFileSync(path.join(out, 'content.json'), JSON.stringify(body));
try { fs.rmSync(path.join(out, 'source.zip'), { force:true }); execFileSync('zip', ['-qr', path.join(out, 'source.zip'), '.'], { cwd:src }); } catch(e) { console.error('Couldn’t make source.zip (is zip installed?): ' + e.message); }
console.log('content.json: ' + Math.round(fs.statSync(path.join(out, 'content.json')).size / 1024) + ' KB, ' + Object.keys(C.modules).length + ' modules, Arabic: ' + Object.keys((C.ar || {}).modules || {}).join(', '));
