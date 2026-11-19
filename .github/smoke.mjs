// Smoke tests on every round (plan P8, round 23). Runs on every push and pull request (.github/workflows/smoke.yml)
// and can be run by hand: node .github/smoke.mjs
// It fails the check when a round would ship something broken that a quick look wouldn't catch:
//   1. a JavaScript file that doesn't parse (node --check)
//   2. a page that links a local script or stylesheet that isn't in the repo
//   3. /app: a file in index.html missing from the offline list in sw.js, or listed with a different ?v= number
//   4. a file changed since main whose ?v= number was not raised in app/index.html or app/sw.js, or sw.js VERSION not raised
//   5. a JSON file that doesn't parse
//   6. a time shown as "a" / "p" instead of AM / PM in a new or changed line (hour12 formats with 'a'/'p' suffixes)
//   7. a public page that saves to the database without /error-report.js (visitors' errors would never reach Logs)
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const errors = [], notes = [];
const err = m => errors.push(m);
const SKIP = new Set(['.git', 'node_modules']);
function walk(dir, out = []){
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n)) continue;
    const p = join(dir, n), s = statSync(p);
    if (s.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const files = walk(ROOT);
const rel = p => relative(ROOT, p).split('\\').join('/');

// 1. JavaScript parses
let js = 0;
for (const f of files.filter(f => /\.(m?js)$/.test(f) && !/\.min\.js$/.test(f))) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); js++; }
  catch (e) { err('JS does not parse: ' + rel(f) + '\n' + String(e.stderr || e.message).split('\n').slice(0, 4).join('\n')); }
}
notes.push(js + ' JavaScript files parse');

// 2. Local scripts and stylesheets exist
let links = 0;
for (const f of files.filter(f => f.endsWith('.html'))) {
  const html = readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const re = /<(?:script[^>]+src|link[^>]+href)="([^"#]+)"/g; let m;
  while ((m = re.exec(html))) {
    const url = m[1];
    if (/^(https?:)?\/\//.test(url) || /^(data|mailto|tel):/.test(url)) continue;
    if (/<link[^>]+rel="(canonical|alternate|preconnect|manifest|icon|apple-touch-icon)"/.test(html.slice(html.lastIndexOf('<', m.index), m.index + m[0].length + 200).split('>')[0] + '>')) continue;
    const path = url.split('?')[0];
    if (!/\.(js|css)$/.test(path)) continue;
    const target = path.startsWith('/') ? join(ROOT, path) : join(dirname(f), path);
    links++;
    if (!existsSync(target)) err(rel(f) + ' links ' + url + ' but ' + rel(target) + ' is not in the repo');
  }
}
notes.push(links + ' local script and style links checked');

// 3. app/index.html and app/sw.js agree
const appHtml = readFileSync(join(ROOT, 'app/index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const sw = readFileSync(join(ROOT, 'app/sw.js'), 'utf8');
const shellM = sw.match(/const SHELL = \[([\s\S]*?)\];/);
if (!shellM) err('app/sw.js: SHELL list not found');
const shell = shellM ? [...shellM[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : [];
const shellVer = new Map(shell.map(s => [s.split('?')[0].replace(/^\.\.\//, '/').replace(/^\//, '/'), (s.split('?v=')[1] || '')]));
const key = u => u.startsWith('../') ? '/' + u.slice(3) : u;
const used = [...appHtml.matchAll(/<(?:script[^>]+src|link[^>]+rel="stylesheet"[^>]+href)="([^"]+)"/g)].map(x => x[1]).filter(u => !/^(https?:)?\/\//.test(u));
for (const u of used) {
  const [p, v] = u.split('?v=');
  const k = key(p);
  const alt = k.startsWith('/') ? k : k;
  if (!shellVer.has(alt) && !shellVer.has('/' + alt) && !shellVer.has(alt.replace(/^\//, ''))) { if (!/guard\.js/.test(p)) err('app/sw.js SHELL is missing ' + u); continue; }
  const sv = shellVer.get(alt) ?? shellVer.get('/' + alt) ?? shellVer.get(alt.replace(/^\//, ''));
  if ((v || '') !== (sv || '')) err('Version mismatch for ' + p + ': index.html ?v=' + (v || '-') + ', sw.js ?v=' + (sv || '-'));
}
for (const s of shell) {
  const p = s.split('?')[0]; if (p === './' || p === 'index.html') continue;
  const t = p.startsWith('/') ? join(ROOT, p) : join(ROOT, 'app', p);
  if (!existsSync(t)) err('app/sw.js SHELL lists ' + s + ' but the file is missing');
}
notes.push(used.length + ' /app files match the offline list');

// 4. Changed files got a new ?v= (only when main is available to compare with)
function git(...a){ try { return execFileSync('git', a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch (e) { return null; } }
const base = process.env.SMOKE_BASE || (git('rev-parse', '--verify', 'origin/main') ? 'origin/main' : null);
if (base && git('merge-base', base, 'HEAD')) {
  const mb = git('merge-base', base, 'HEAD').trim();
  const changed = (git('diff', '--name-only', mb, 'HEAD') || '').split('\n').filter(Boolean);
  const oldSw = git('show', mb + ':app/sw.js') || '';
  const oldHtml = git('show', mb + ':app/index.html') || '';
  const ver = s => (s.match(/VERSION = '([^']+)'/) || [])[1];
  const appChanged = changed.filter(f => f.startsWith('app/') || ['portal.css', 'portal-shell.js', 'portal-ui.js', 'portal-ui.css', 'ask.js', 'ask.css', 'hub.css'].includes(f));
  if (appChanged.length && ver(oldSw) === ver(sw)) err('Files in /app changed but app/sw.js VERSION is still ' + ver(sw) + ' (raise it so open apps update)');
  for (const f of appChanged) {
    const name = f.startsWith('app/') ? f.slice(4) : '/' + f;
    const re = new RegExp('["\']' + (f.startsWith('app/') ? '' : '(?:\\.\\.)?') + name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/^\\\//, '/?') + '\\?v=(\\d+)');
    const now = appHtml.match(re), before = oldHtml.match(re);
    if (now && before && now[1] === before[1]) err(f + ' changed but its ?v=' + now[1] + ' in app/index.html was not raised');
  }
  // 6. AM/PM: a changed line that formats hours and ends a time with a bare a or p
  const diff = git('diff', '-U0', mb, 'HEAD', '--', '*.js') || '';
  diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).forEach(l => {
    if (/\?\s*'a'\s*:\s*'p'|\?\s*"a"\s*:\s*"p"/.test(l)) err('A time ends with "a"/"p" instead of AM/PM: ' + l.slice(1, 160).trim());
  });
  notes.push(changed.length + ' files changed since ' + base);
} else notes.push('main not available: version-raise check skipped');

// 5. JSON parses
for (const f of files.filter(f => f.endsWith('.json') || f.endsWith('.webmanifest'))) {
  try { JSON.parse(readFileSync(f, 'utf8')); } catch (e) { err('JSON does not parse: ' + rel(f) + ' (' + e.message + ')'); }
}

// 7. Public pages that send something to the database report their errors (P6, round 23 part 2): a page outside /app
//    and /course that loads tracker/config.js and isn't signed-in (no portal-shell.js) must load /error-report.js
let pub = 0;
for (const f of files.filter(f => f.endsWith('.html') && !/^(app|course|crm|cash|tracker|calc-build|house-calculator|land-calculator)\//.test(rel(f)))) {
  const html = readFileSync(f, 'utf8');
  if (!/tracker\/config\.js/.test(html) || /portal-shell\.js/.test(html)) continue;
  pub++;
  if (!/\/error-report\.js/.test(html)) err('Public page without error reports: ' + rel(f) + ' (add <script src="/error-report.js?v=N"></script> in <head>)');
}
notes.push(pub + ' public pages report their errors');

console.log(notes.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('\n' + errors.length + ' problem(s):\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('\nAll smoke tests passed.');
