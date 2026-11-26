// Arabic check (Round 33 part 2, P3). Lists English text in the portal's scripts that has no Arabic version.
// Run by .github/smoke.mjs (check 8) and by hand: node .github/ar-check.mjs
// A text counts as covered when it is a key in the Arabic dictionary (app/i18n.js, app/ar-more.js and the round files
// that add to AppLang.AR / AppLang.TPL), or is listed in app/ar-skip.json (names, brands, codes, client documents).
// To fix a gap: add the Arabic to app/ar-more.js, or add the text to app/ar-skip.json if it is not shown as words.
// Finds user-facing English text in portal scripts. Exact strings and templates ("Bell sent to {}").
import fs from 'fs';
import vm from 'vm';
function extract(src){
  const out = new Set();
  const add = t => { t = t.replace(/\\u2019/g,'’').replace(/\\u2026/g,'…').replace(/\\n/g,' ').replace(/\\'/g,"'").replace(/\\"/g,'"').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
    t = t.replace(/^[·:,(\-–|>\s]+/, '').replace(/[·:,(\-–|\s]+$/, '').trim();
    if (t.length < 3 || !/[A-Za-z]{2}/.test(t)) return;
    if (!/[A-Z]/.test(t) && !/ /.test(t)) return;               // single lowercase word: usually code
    if (/^[a-z0-9_.\-#\[\]=*]+$/.test(t)) return;
    if (/[;=<>{}]|=>|\$|\(\)|\.(js|css|html|png|json|mp4)\b|https?:|\bvar\(|\d+px|rgba?\(|^#[\w-]|^\.[\w-]|\bfunction\b|document\.|window\.|\bnull\b|\bundefined\b/.test(t.replace(/\{\}/g,''))) return;
    if (/^(GET|POST|PATCH|DELETE|Enter|Tab|Escape|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Backspace|Content-Type|Bearer|Authorization|application\/\w+|text\/\w+|USD|EGP|AM|PM|UTC|America\/\w+|Africa\/\w+|Europe\/\w+|Asia\/\w+)$/.test(t)) return;
    if (/^[A-Z][a-z]+[A-Z]\w*$/.test(t) || /^[a-z]+[A-Z0-9]\w*$/.test(t) || /^[a-z]{2}-[A-Z]{2}$/.test(t) || /^(DOMContentLoaded|Escape|Enter|Tab)$/.test(t)) return;                // camelCase identifiers
    if (/^[\w-]+(\.[\w-]+)+$/.test(t)) return;                  // dotted ids
    if (/^\{\}( \{\})*$/.test(t)) return;
    if (/[؀-ۿ]/.test(t)) return;
    out.add(t);
  };
  const piece = s => s.split(/<[^>]*>/).forEach(add);
  // strip comments (roughly) so notes in code aren't counted
  src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  // template literals with ${}: each tag-free piece, with ${} as {}
  src.replace(/`((?:\\.|[^`\\])*)`/g, (m, body) => {
    // replace nested ${...} (one level of braces) with a slot marker
    let b = '', depth = 0;
    for (let i = 0; i < body.length; i++){ if (body[i]==='$' && body[i+1]==='{' && depth===0){ depth=1; i++; b+='\u0001'; continue; } if (depth){ if(body[i]==='{')depth++; else if(body[i]==='}'){depth--; } continue; } b+=body[i]; }
    b.split(/<[^>]*>/).forEach(p => { if (/\u0001/.test(p)) { const t = p.replace(/\u0001/g,'{}'); if (t.replace(/\{\}/g,'').trim()) add(t); } else add(p); });
    return '';
  });
  // concatenation chains on one line: 'a ' + x + ' b'
  src.split('\n').forEach(line => {
    const re = /(['"])((?:\\.|(?!\1)[^\\\n])*)\1/g; let r; const lits = [];
    while ((r = re.exec(line))) lits.push({ s: r[2], a: r.index, b: re.lastIndex });
    for (let i = 0; i < lits.length; i++){
      let t = lits[i].s, j = i, chained = false;
      while (j + 1 < lits.length){ const gap = line.slice(lits[j].b, lits[j+1].a); if (/^\s*\+[^'"+;]*\+\s*$/.test(gap) && !/[?:]/.test(gap)) { t += '{}' + lits[j+1].s; j++; chained = true; } else break; }
      const after = line.slice(lits[j].b); const before = line.slice(0, lits[i].a);
      if (!chained && /^\s*\+\s*[\w.(]/.test(after) && !/^\s*\+\s*['"]/.test(after)) { t = t + '{}'; chained = true; }
      if (/[\w)\]]\s*\+\s*$/.test(before) && !/['"]\s*\+\s*$/.test(before)) { t = '{}' + t; chained = true; }
      if (chained) piece(t); else piece(lits[i].s);
      i = j;
    }
  });
  return [...out];
}
function loadDict(dir){
  const AR = {}, TPL = {}; const L = { AR, RULES: [], TPL };
  const ctx = { window: { AppLang: L }, localStorage: { getItem: () => null, setItem(){} }, document: { readyState:'complete', documentElement:{}, addEventListener(){}, querySelector:()=>null, body:null }, console, requestAnimationFrame(){}, MutationObserver: function(){ this.observe=()=>{}; }, NodeFilter:{} };
    const i18n = fs.readFileSync(dir + '/i18n.js', 'utf8'); const m = i18n.match(/const AR = (\{[\s\S]*?\n  \});/);
  if (m) Object.assign(AR, vm.runInNewContext('(' + m[1] + ')'));
  for (const f of fs.readdirSync(dir).filter(f => /\.js$/.test(f))) { const s = fs.readFileSync(dir + '/' + f, 'utf8'); if (f !== 'i18n.js' && /Object\.assign\(L\.(AR|TPL)/.test(s)) vm.runInNewContext(s, ctx); }
  return L;
}

const ROOT = new URL('..', import.meta.url).pathname;
export function arGaps(){
  const L = loadDict(ROOT + 'app');
  const skip = new Set(JSON.parse(fs.readFileSync(ROOT + 'app/ar-skip.json', 'utf8')).skip);
  const files = fs.readdirSync(ROOT + 'app').filter(f => f.endsWith('.js') && !/^(i18n|ar-more|r23-ar|sw)\.js$/.test(f)).map(f => 'app/' + f)
    .concat(['app/learn/hub.js', 'portal-shell.js', 'portal-ui.js', 'client/client.js', 'cash/cash.js', 'cash/team.js']).filter(f => fs.existsSync(ROOT + f));
  const gaps = [];
  for (const f of files) {
    const src = fs.readFileSync(ROOT + f, 'utf8');
    if (/Object\.assign\(L\.(AR|TPL)/.test(src) && !/PX|PortalShell/.test(src.slice(0, 2000))) continue;   // a dictionary file
    for (const t of extract(src)) if (t !== 'use strict' && L.AR[t] == null && L.TPL[t] == null && !skip.has(t)) gaps.push(f + ': ' + t);
  }
  return { gaps, files: files.length, keys: Object.keys(L.AR).length + Object.keys(L.TPL).length };
}
if (process.argv[1] && process.argv[1].endsWith('ar-check.mjs')) {
  const r = arGaps();
  console.log(r.gaps.length ? r.gaps.join('\n') : 'Every label has Arabic (' + r.files + ' files, ' + r.keys + ' entries).');
  process.exit(r.gaps.length ? 1 : 0);
}
