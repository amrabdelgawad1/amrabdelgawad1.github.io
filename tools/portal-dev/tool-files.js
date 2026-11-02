// Tool files checks (Admin > Logs > Tool files), at 390 and 1440, real CSP on, storage kept in memory by the stub.
//   python3 -m http.server 8702 &   (repo root)   then   node tools/portal-dev/tool-files.js http://localhost:8702 [screens folder]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [BASE, OUT] = process.argv.slice(2);
const STUB = fs.readFileSync(path.join(__dirname, 'stub-supabase.js'), 'utf8');
const O = { user:{ id:'o1', email:'owner@example.com' } };
const owner = { is_tracker_admin:true, portal_me:{ role:'owner', keys:['course','deals','learn','live','mkt','money','psy','requests','team'], needs_code:[] } };
const pad = 'x'.repeat(30000);
const GUARDED = '<!doctype html><html><head></head><body><script>if(!/^(amrabdelgawad\\.site|localhost)$/.test(location.hostname)||!/^\\/app\\/deals\\//.test(location.pathname)||!window.DealGate){}</script>' + pad + '</body></html>';
const NO_GUARD = '<!doctype html><html><head></head><body>' + pad + '</body></html>';
const store = () => ({ 'crm.html':{ text:'<html>old crm</html>', updated_at:'2026-11-01T02:48:11Z' }, 'land-calculator-v2.html':{ text:'<html>old land</html>', updated_at:'2026-11-01T18:46:00Z' },
  'house-calculator-v2.html':{ text:'<html>old house</html>', updated_at:'2026-11-01T18:46:01Z' }, 'crm-before-guard-2026-11-01.html':{ text:'<html>older</html>', updated_at:'2026-11-01T02:48:11Z' } });
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const file = (name, text) => ({ name, mimeType:'text/html', buffer:Buffer.from(text) });

const T = [
  { name:'files-live', run: async (p, ok) => {
    const t = await p.evaluate(() => document.getElementById('pLogs').innerText);
    ok(/Tool files/.test(t) && /Deal CRM[\s\S]*Land calculator[\s\S]*House calculator/.test(t) && /Live now/.test(t), 'the three tools, each with what’s live now');
    ok(/crm-before-guard-2026-11-01\.html/.test(t), 'backups listed');
    await p.setInputFiles('input[data-tf="crm.html"]', file('crm.html', NO_GUARD)); await p.waitForTimeout(400);
    ok(/portal guard is missing/.test(await p.evaluate(() => document.getElementById('pLogs').innerText)) && await p.isDisabled('[data-go="crm.html"]'), 'a build without the portal guard is refused');
    await p.setInputFiles('input[data-tf="crm.html"]', file('crm.html', GUARDED)); await p.waitForTimeout(400);
    const t2 = await p.evaluate(() => document.getElementById('pLogs').innerText);
    ok(t2.includes(sha(GUARDED)) && !(await p.isDisabled('[data-go="crm.html"]')), 'a guarded build: its sha256 shows and Put it live is on');
    await p.fill('input[data-want="crm.html"]', 'abc123'); await p.waitForTimeout(900);
    ok(/Doesn’t match the build/.test(await p.evaluate(() => document.getElementById('pLogs').innerText)) && await p.isDisabled('[data-go="crm.html"]'), 'a pasted hash that differs blocks it');
    await p.fill('input[data-want="crm.html"]', sha(GUARDED).toUpperCase()); await p.waitForTimeout(900);
    ok(/Matches the build/.test(await p.evaluate(() => document.getElementById('pLogs').innerText)), 'the right hash (any case) matches');
    await p.click('[data-go="crm.html"]'); await p.waitForTimeout(1200);
    const st = await p.evaluate(() => ({ live:SB_STORE['crm.html'] && SB_STORE['crm.html'].text, backups:Object.keys(SB_STORE).filter(n => /^crm-before-\d{4}-\d\d-\d\d-\d{4}\.html$/.test(n)).map(n => SB_STORE[n].text) }));
    ok(st.live === await p.evaluate(g => g, GUARDED) && st.backups.length === 1 && st.backups[0] === '<html>old crm</html>', 'live: the new file in place, the old one kept as crm-before-<date-time>.html');
    ok(/Live and checked/.test(await p.evaluate(() => document.getElementById('pLogs').innerText)), 'it says it read the file back and it matched');
    ok(await p.evaluate(() => SB_STORE['land-calculator-v2.html'].text === '<html>old land</html>'), 'the other tools are untouched');
  } },
  { name:'files-fail', run: async (p, ok) => {
    await p.evaluate(() => { window.SB_STORE_FAIL = 'upload'; });
    await p.setInputFiles('input[data-tf="land-calculator-v2.html"]', file('land.html', GUARDED.replace('\\/app\\/deals\\/', '(land|house)-calculator'))); await p.waitForTimeout(400);
    await p.click('[data-go="land-calculator-v2.html"]'); await p.waitForTimeout(1200);
    const st = await p.evaluate(() => ({ live:SB_STORE['land-calculator-v2.html'] && SB_STORE['land-calculator-v2.html'].text, n:Object.keys(SB_STORE).filter(n => /^land-calculator-v2-before-/.test(n)).length }));
    ok(st.live === '<html>old land</html>' && st.n === 0, 'a failed upload puts the old file back');
    ok(/old file is back in place, so nothing changed/.test(await p.evaluate(() => document.getElementById('pLogs').innerText)), 'and says nothing changed');
  } }
];

(async () => {
  const browser = await chromium.launch(); let bad = 0; const log = [];
  for (const W of [390, 1440]) for (const t of T) {
    const ctx = await browser.newContext({ viewport:{ width:W, height:W < 768 ? 844 : 900 }, serviceWorkers:'block', isMobile:W < 768, hasTouch:W < 768 });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await ctx.route(u => /\/app\/(index\.html)?$/.test(new URL(u).pathname), async r => {
      const res = await r.fetch(); let b = await res.text();
      r.fulfill({ response:res, body:b.replace(/<script src="https:\/\/cdn\.jsdelivr[^>]*><\/script>/, '<script src="/__stub/sb.js"></script>') });
    });
    await ctx.route('**/__stub/sb.js', r => r.fulfill({ contentType:'application/javascript', body:STUB }));
    await ctx.addInitScript(o => { Object.assign(window, o); try { localStorage.clear(); } catch(e){} }, { SB_SESSION:O, SB_AAL:'aal2', SB_RPC:owner, SB_FROM:{ members:[], companies:[], live_status:[] }, SB_STORE:store() });
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push('PAGE ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
    await p.goto(BASE + '/app/#logs/files'); await p.waitForTimeout(1800);
    const tag = W + ' ' + t.name;
    const ok = (c, msg) => { if (!c) bad++; const l = (c ? 'ok   ' : 'FAIL ') + tag + ': ' + msg; log.push(l); console.log(l); };
    const wide = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(wide <= W, 'nothing wider than the screen (' + wide + 'px)');
    try { await t.run(p, ok, W); } catch(e) { ok(false, 'check crashed: ' + e.message.split('\n')[0]); }
    if (OUT) { fs.mkdirSync(OUT, { recursive:true }); await p.screenshot({ path:path.join(OUT, t.name + '-' + W + '.png'), fullPage:true }); }
    ok(!errs.length, 'no console errors' + (errs.length ? ' (' + errs.join(' / ') + ')' : ''));
    await ctx.close();
  }
  await browser.close(); console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
})();
