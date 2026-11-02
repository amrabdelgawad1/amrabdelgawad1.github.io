// Calculators in the portal (calc-frame.js): the portal bar on top, the calculator unchanged in a same-site frame.
//   python3 -m http.server 8702 &   (repo root)   then   node tools/portal-dev/calc-frame.js http://localhost:8702 [screens folder]
// The calculator here is a stand-in with the real guard's checks and its own dark look; the checks make sure it opens
// inside the frame with its guard passing and its own styles untouched by the portal's.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [BASE, OUT] = process.argv.slice(2);
const STUB = fs.readFileSync(path.join(__dirname, 'stub-supabase.js'), 'utf8');
const U = { user:{ id:'u1', email:'sara@example.com' } };
const rpc = { deal_access_status:'ok', is_tracker_admin:false, my_profile:[{ name:'Sara R.' }], portal_me:{ name:'Sara R.', role:'agent', keys:['deals','learn'], needs_code:[] } };
const CALC = n => '<!doctype html><html><head><title>' + n + ' Deal Calculator</title><style>body{margin:0;background:#0B0B0B;color:#F1EBE0;font:15px Georgia}h1{color:#C9A96E;font-size:40px}</style></head><body><script>' +
  'if(!/^(amrabdelgawad\\.site|www\\.amrabdelgawad\\.site|localhost|127\\.0\\.0\\.1)$/.test(location.hostname)||!/^\\/(land|house)-calculator\\//.test(location.pathname)||!window.DealGate||!window.DealGate.db){document.body.innerHTML="<p id=calcOutside>outside</p>";throw new Error("outside")}' +
  '</script><h1 id="calcH">' + n + ' calculator</h1><p id="calcWho"></p><script>document.getElementById("calcWho").textContent="Signed in: "+window.DealGate.name</script>' + 'x'.repeat(3000) + '</body></html>';
const STORE = () => ({ 'land-calculator-v2.html':{ text:CALC('Land'), updated_at:'2026-11-01T18:46:00Z' }, 'house-calculator-v2.html':{ text:CALC('House'), updated_at:'2026-11-01T18:46:00Z' } });

async function page(browser, W, url, init){
  const ctx = await browser.newContext({ viewport:{ width:W, height:W < 768 ? 844 : 900 }, serviceWorkers:'block', isMobile:W < 768, hasTouch:W < 768 });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await ctx.route(u => /^\/(land|house)-calculator\/(index\.html)?$/.test(new URL(u).pathname), async r => {
    const res = await r.fetch(); const b = await res.text();
    r.fulfill({ response:res, body:b.replace(/<script src="https:\/\/cdn\.jsdelivr[^>]*><\/script>/, '<script src="/__stub/sb.js"></script>') });
  });
  await ctx.route('**/__stub/sb.js', r => r.fulfill({ contentType:'application/javascript', body:STUB }));
  await ctx.addInitScript(o => { Object.assign(window, o); }, init);
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => { if (!/outside/.test(e.message)) errs.push('PAGE ' + e.message); });
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
  await p.goto(BASE + url); await p.waitForTimeout(2500);
  return { p, ctx, errs };
}
// What the calculator looks like inside a document: text, a few computed styles, its width
const look = doc => doc.evaluate(() => { const h = document.getElementById('calcH'), b = document.body; if (!h) return null; const s = getComputedStyle(h), sb = getComputedStyle(b);
  return { h:h.textContent, who:(document.getElementById('calcWho') || {}).textContent, hc:s.color, hf:s.fontSize + ' ' + s.fontFamily, bg:sb.backgroundColor, fc:sb.color, out:!!document.getElementById('calcOutside') }; });

(async () => {
  const browser = await chromium.launch(); let bad = 0;
  const ok = (c, msg) => { if (!c) bad++; console.log((c ? 'ok   ' : 'FAIL ') + msg); };
  for (const W of [390, 1440]) for (const [url, nm, id] of [['/land-calculator/', 'Land', 'calc'], ['/house-calculator/', 'House', 'calc-house']]) {
    const tag = W + ' ' + nm + ': ';
    const { p, ctx, errs } = await page(browser, W, url, { SB_SESSION:U, SB_AAL:'aal2', SB_RPC:rpc, SB_FROM:{}, SB_STORE:STORE() });
    const bar = await p.evaluate(() => ({ top:!!document.querySelector('header.p-top .p-apps-btn'), name:(document.querySelector('header.p-top .p-name') || {}).textContent, frame:!!document.querySelector('iframe.cf-frame') }));
    ok(bar.top && bar.frame && bar.name === nm + ' calculator', tag + 'the portal bar (Apps, name) on top, the calculator in the frame below');
    const f = p.frames().find(x => x !== p.mainFrame());
    const inside = f ? await look(f) : null;
    ok(inside && !inside.out && inside.h === nm + ' calculator' && inside.who === 'Signed in: Sara R.', tag + 'the calculator opens inside: its guard passes and it sees the gate (DealGate)');
    const fr = await p.evaluate(() => { const r = document.querySelector('iframe.cf-frame').getBoundingClientRect(); return { w:Math.round(r.width), bottom:Math.round(r.bottom), vh:innerHeight, sw:document.documentElement.scrollWidth }; });
    ok(fr.w === W && Math.abs(fr.bottom - fr.vh) <= 1 && fr.sw <= W, tag + 'the frame fills the rest of the screen, nothing wider than it (' + fr.w + 'x to ' + fr.bottom + ')');
    await p.click('.p-apps-btn'); await p.waitForTimeout(300);
    ok(await p.evaluate(i => { const a = document.querySelector('.p-apps a[aria-current="page"]'); return !!a && /calculator/.test(a.getAttribute('href')); }, id), tag + 'the Apps menu marks this calculator');
    await p.mouse.click(Math.round(W / 2), (W < 768 ? 844 : 900) - 40); await p.waitForTimeout(400);
    ok(await p.evaluate(() => document.querySelector('.p-apps').hidden), tag + 'a tap in the calculator closes the Apps menu');
    ok(inside && inside.bg === 'rgb(11, 11, 11)' && inside.hc === 'rgb(201, 169, 110)' && /Georgia/.test(inside.hf), tag + 'its own look inside: the portal styles don’t reach it');
    if (OUT) { fs.mkdirSync(OUT, { recursive:true }); await p.screenshot({ path:path.join(OUT, 'calc-' + nm + '-' + W + '.png') }); }
    ok(!errs.length, tag + 'no console errors' + (errs.length ? ' (' + errs.join(' / ') + ')' : ''));
    await ctx.close();
  }
  // Not signed in: no bar, the gate's own message, as before
  const n = await page(browser, 390, '/land-calculator/', { SB_SESSION:null, SB_RPC:rpc, SB_FROM:{}, SB_STORE:STORE() });
  ok(!(await n.p.$('iframe.cf-frame')) && /Sign in to your app first/.test(await n.p.textContent('#dgMsg')), 'not signed in: no frame, the gate asks to sign in');
  await n.ctx.close();
  await browser.close(); console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
})();
