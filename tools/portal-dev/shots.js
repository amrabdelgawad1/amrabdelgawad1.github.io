// Portal visual check: screenshots and computed styles of the signed-in pages in test mode, at 390 and 1440.
// Run it against two copies of the site (for example main and your branch) and compare with diff.py.
//   git worktree add ../before main && (cd ../before && python3 -m http.server 8701) &
//   python3 -m http.server 8702 &           (from the repo root)
//   node tools/portal-dev/shots.js http://localhost:8701 /tmp/before
//   node tools/portal-dev/shots.js http://localhost:8702 /tmp/after
//   python3 tools/portal-dev/diff.py /tmp/before /tmp/after
// Nothing leaves the machine: every outside request (fonts, Supabase) is blocked, so both sides use the same fallback.
// Course content is a small made-up sample here, never the real lessons. Screenshots go to the folder you name, not the repo.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [BASE, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive:true });
const PSY = { title:{ en:'Psychology and Therapy', ar:'' }, modules:Array.from({ length:27 }, (_, i) => ({ id:'m' + (i + 1), num:i + 1, title:{ en:'Sample module ' + (i + 1) }, parts:[ { n:1, t:{ en:'Part one' } } ],
  items:[ { id:(i + 1) + '.1', type:'lesson', title:{ en:'Sample lesson' } }, { id:(i + 1) + '.x', type:'exam', title:{ en:'Exam' }, exam:{ pass:16, q:{ en:[] } } } ] })) };
const S = [
  ['hub-owner', '/app/learn/', { HUB_TEST:{ owner:true, people:{ acq:3, mkt:1 }, waiting:4 } }],
  ['hub-agent', '/app/learn/', { HUB_TEST:{ open:['acq'], prog:{ acq:{ done:3, total:15 } } } }],
  ['hub-none',  '/app/learn/', { HUB_TEST:{ open:[] } }],
  ['hub-live',  '/app/learn/', {}],
  ['mkt-home',  '/app/course/', { COURSE_TEST:{ owner:true, content:'/__fake/mkt.json' } }],
  ['mkt-live',  '/app/course/', {}],
  ['psy-home',  '/app/psychology/', { PSY_TEST:{ owner:true, content:'/__fake/psy.json' } }],
  ['psy-live',  '/app/psychology/', {}],
  ['acq-live',  '/course/', {}],
  ['acq-signin', '/course/', { STUB:true }],
  ['acq-noaccess', '/course/', { STUB:true, SB_SESSION:{ user:{ id:'u1', email:'agent@example.com' } } }],
];
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const W of [390, 1440]) for (const [name, url, init] of S) {
    const ctx = await browser.newContext({ viewport:{ width:W, height:W < 768 ? 844 : 900 }, deviceScaleFactor:1, serviceWorkers:'block' });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());            // fonts and Supabase: same fallback on both sides
    await ctx.route('**/__fake/mkt.json', r => r.fulfill({ json:{ modules:{}, sources:{}, case:{ main:{ name:'Sample business', about:'A stand-in case file for the layout check.', facts:[['City','Sample'],['Team','4 people']] }, b2b:{ about:'A stand-in second case.' } } } }));
    await ctx.route('**/__fake/psy.json', r => r.fulfill({ json:PSY }));
    if (init.STUB) {
      const stub = fs.readFileSync(path.join(__dirname, 'stub-supabase.js'), 'utf8');
      await ctx.route('**/course/', async r => { const res = await r.fetch(); let b = await res.text();
        b = b.replace(/<script src="https:\/\/cdn\.jsdelivr[^>]*><\/script>/, '<script src="/__stub/sb.js"></script>').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
        r.fulfill({ response:res, body:b }); });
      await ctx.route('**/__stub/sb.js', r => r.fulfill({ contentType:'application/javascript', body:stub }));
    }
    await ctx.addInitScript(o => { Object.assign(window, o); try { localStorage.clear(); } catch(e){} }, init);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${W} ${name} PAGE ERROR ${e.stack.split('\n').slice(0,3).join(' | ')}`));
    page.on('console', m => { if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push(`${W} ${name} CONSOLE ${m.text()}`); });
    await page.goto(BASE + url, { waitUntil:'load' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path:path.join(OUT, `${name}-${W}.png`), fullPage:true });
    // computed styles of every element, to compare beyond pixels
    const css = await page.evaluate(() => [...document.querySelectorAll('body *')].map(e => { const s = getComputedStyle(e); return e.tagName + '.' + e.className + '|' + ['color','background-color','font-family','font-size','font-weight','border-top-color','border-radius','padding-top','margin-top','width','height'].map(p => s[p]).join(';'); }).join('\n'));
    fs.writeFileSync(path.join(OUT, `${name}-${W}.css.txt`), css);
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'errors.txt'), errors.join('\n'));
  await browser.close();
})();
