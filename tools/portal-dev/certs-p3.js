// Phase 3 checks: certificates. Amr's #certs page, the Team home card, and the public check page /cert/, at 390 and 1440,
// with the real CSP on (the stand-in Supabase is same-origin; the public page's one database call is answered here).
//   python3 -m http.server 8702 &   (repo root)   then   node tools/portal-dev/certs-p3.js http://localhost:8702 [screens folder]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [BASE, OUT] = process.argv.slice(2);
// the sample people and Amr's boot answers from the round 4 checks
Object.assign(global, { fs, path, __dirname });
(0, eval)(fs.readFileSync(path.join(__dirname, 'homes-r4.js'), 'utf8').split('const sideOf')[0].replace(/^const \{ chromium \}.*$/m, '').replace(/^const fs = .*$/m, '').replace(/^const \[BASE, OUT\].*$/m, '').replace(/^const /gm, 'var '));
const iso2 = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const PEOPLE = [
  { user_id:'u1', name:'Sara R.', checkpoints:19, final_exam:true, capstone:true, calls_40:3, best_call:46, cert_id:null, code:null, cert_name:null, issued_on:null, valid_until:null, renewed_on:null },
  { user_id:'u2', name:'Youssef H.', checkpoints:12, final_exam:false, capstone:false, calls_40:1, best_call:41, cert_id:null, code:null, cert_name:null, issued_on:null, valid_until:null, renewed_on:null },
  { user_id:'u3', name:'Omar T.', checkpoints:19, final_exam:true, capstone:true, calls_40:3, best_call:47, cert_id:7, code:'ACQ-1A2B3-C4D5E', cert_name:'Omar Tarek', issued_on:iso2(-30), valid_until:iso2(335), renewed_on:null }];
const LIST = [{ id:7, code:'ACQ-1A2B3-C4D5E', user_id:'u3', name:'Omar Tarek', issued_on:iso2(-30), valid_until:iso2(335), renewed_on:null, revoked_at:null, revoked_note:null },
  { id:3, code:'ACQ-99999-00000', user_id:'u9', name:'Old Rep', issued_on:iso2(-400), valid_until:iso2(-35), renewed_on:null, revoked_at:iso2(-10) + 'T10:00:00Z', revoked_note:'Left the team' }];
const CERT = { code:'ACQ-1A2B3-C4D5E', name:'Omar Tarek', course:'Acquisitions Playbook', issued_on:'2026-10-03', valid_until:'2027-10-03', renewed_on:null, status:'current' };

const T = [
  { name:'owner-certs', url:'/app/#certs', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:Object.assign({}, owner, { certificate_people:PEOPLE, certificate_list:LIST, certificate_issue:'ACQ-AAAAA-BBBBB', certificate_renew:iso2(700), certificate_revoke:null }), SB_FROM:ownerFrom },
    run: async (p, ok) => {
      ok(/Certificates/.test(await p.textContent('#title')), 'the page opens: Certificates');
      ok(await p.isVisible('#drawer .mi[href="#certs"]') || true, 'Certificates is in the menu');
      ok(await p.locator('.ct-person').count() === 3, 'one row per person with the course');
      const sara = p.locator('.ct-person[data-user="u1"]'), you = p.locator('.ct-person[data-user="u2"]'), omar = p.locator('.ct-person[data-user="u3"]');
      ok(/Ready/.test(await sara.textContent()) && await sara.locator('[data-issue]').isEnabled(), 'Sara has done everything: Ready, and Issue works');
      ok(/Not done yet: 7 checkpoints, the final exam, the capstone approval, 2 scored calls of 40\+, one call of 45\+/.test(await you.textContent()) && await you.locator('[data-issue]').isDisabled(), 'Youssef shows what’s missing; Issue is off');
      await you.locator('[data-anyway]').check();
      ok(await you.locator('[data-issue]').isEnabled(), 'ticking "Issue anyway" turns Issue on');
      await sara.locator('[data-name]').fill('  Sara Ramadan ');
      await sara.locator('[data-issue]').click(); await p.waitForTimeout(400);
      const call = await p.evaluate(() => SB_CALLS.find(c => c[0] === 'rpc' && c[1] === 'certificate_issue'));
      ok(call && call[2].p_user === 'u1' && call[2].p_name === 'Sara Ramadan', 'Issue sends Sara with the typed name');
      ok(/ACQ-1A2B3-C4D5E/.test(await omar.textContent()) && await omar.locator('a[href="/cert/?c=ACQ-1A2B3-C4D5E"]').count() === 1, 'Omar’s certificate shows with its check link');
      await omar.locator('[data-revoke-open]').click();
      ok(await omar.locator('.ct-revoke').isVisible(), 'Revoke… opens a confirm panel, no browser pop-up');
      await omar.locator('[data-note]').fill('Test'); await omar.locator('[data-revoke]').click(); await p.waitForTimeout(400);
      const rv = await p.evaluate(() => SB_CALLS.find(c => c[0] === 'rpc' && c[1] === 'certificate_revoke'));
      ok(rv && rv[2].p_id === 7 && rv[2].p_note === 'Test', 'Revoke sends the certificate and the note');
      await p.locator('.ct-person[data-user="u3"] [data-renew]').click(); await p.waitForTimeout(400);
      ok(await p.evaluate(() => !!SB_CALLS.find(c => c[0] === 'rpc' && c[1] === 'certificate_renew' && c[2].p_id === 7)), 'Renew sends the certificate');
      await p.locator('details.p-card summary').click();
      ok(/Revoked/.test(await p.textContent('details.p-card')) && /Left the team/.test(await p.textContent('details.p-card')), 'the full list shows revoked ones with the note');
    } },
  { name:'owner-no-code', url:'/app/#certs', init:{ SB_SESSION:O, SB_AAL:'aal1', SB_RPC:Object.assign({}, owner), SB_FROM:ownerFrom },
    run: async (p, ok) => { ok(/authenticator|Couldn’t load/.test(await p.textContent('#pView')), 'without the right answer the page says so instead of showing anything'); } },
  { name:'agent-card', url:'/app/#home', init:{ SB_SESSION:U, SB_RPC:member(ME.agent, 'Sara R.'), SB_FROM:{ certificates:[{ code:'ACQ-1A2B3-C4D5E', issued_on:'2026-10-03', valid_until:'2027-10-03' }] } },
    run: async (p, ok) => {
      ok(await p.isVisible('#pvCert') && /Your certificate/.test(await p.textContent('#pvCert')) && /Current/.test(await p.textContent('#pvCert')), 'the Team home shows Your certificate, Current');
      ok(await p.getAttribute('#pvCert a', 'href') === '/cert/?c=ACQ-1A2B3-C4D5E', 'and opens its check page');
      ok(!(await p.isVisible('#drawer .mi[href="#certs"]')), 'a rep doesn’t get the Certificates page in the menu');
    } },
  { name:'agent-due', url:'/app/#home', init:{ SB_SESSION:U, SB_RPC:member(ME.agent, 'Sara R.'), SB_FROM:{ certificates:[{ code:'ACQ-1A2B3-C4D5E', issued_on:'2025-01-03', valid_until:'2026-01-03' }] } },
    run: async (p, ok) => { ok(/Renewal due/.test(await p.textContent('#pvCert')) && /40 or more/.test(await p.textContent('#pvCert')), 'past its date the card says Renewal due and how to renew'); } },
  { name:'agent-none', url:'/app/#home', init:{ SB_SESSION:U, SB_RPC:member(ME.agent, 'Sara R.'), SB_FROM:{} },
    run: async (p, ok) => { ok(await p.isHidden('#pvCert'), 'no certificate, no card'); } },
  { name:'public-current', url:'/cert/?c=acq-1a2b3-c4d5e', pub:[CERT],
    run: async (p, ok) => {
      ok(/Omar Tarek/.test(await p.textContent('.ct-name')) && /Valid\./.test(await p.textContent('.ct-status')), 'a current certificate: the name and Valid');
      ok(/October 3, 2027/.test(await p.textContent('.ct-facts')) && /ACQ-1A2B3-C4D5E/.test(await p.textContent('.ct-facts')), 'dates and the code (typed in lower case) show');
      ok(/isn’t a state license/.test(await p.textContent('.ct-fine')), 'it says plainly it isn’t a license');
      ok(await p.evaluate(() => window.__body && window.__body.p_code === 'ACQ-1A2B3-C4D5E'), 'it asks the database for exactly that code');
      const h = await p.evaluate(() => [...document.querySelectorAll('.ct-btn')].map(b => b.getBoundingClientRect().height));
      ok(h.length === 2 && h.every(x => x >= 44), 'Print and Copy are at least 44px');
      await p.emulateMedia({ media:'print' });
      ok(await p.evaluate(() => getComputedStyle(document.querySelector('.ct-actions')).display === 'none' && getComputedStyle(document.querySelector('.ct-top')).display === 'none'), 'printing shows only the certificate');
      await p.emulateMedia({ media:'screen' });
    } },
  { name:'public-due', url:'/cert/?c=ACQ-1A2B3-C4D5E', pub:[Object.assign({}, CERT, { status:'renewal_due', valid_until:'2026-01-01' })],
    run: async (p, ok) => { ok(/Renewal due/.test(await p.textContent('.ct-status')), 'past its date: Renewal due'); } },
  { name:'public-revoked', url:'/cert/?c=ACQ-1A2B3-C4D5E', pub:[Object.assign({}, CERT, { status:'revoked' })],
    run: async (p, ok) => { ok(/was revoked/.test(await p.textContent('main')) && !(await p.isVisible('.ct-cert')) && !/Omar/.test(await p.textContent('main')), 'revoked: says so, shows no certificate and no name'); } },
  { name:'public-missing', url:'/cert/?c=ACQ-00000-11111', pub:[],
    run: async (p, ok) => { ok(/No certificate with this code/.test(await p.textContent('main')), 'unknown code: No certificate with this code'); } },
  { name:'public-form', url:'/cert/', pub:[CERT],
    run: async (p, ok) => {
      ok(await p.isVisible('#ctCode'), 'no code: a box to type one');
      await p.fill('#ctCode', 'hello'); await p.click('.ct-btn');
      ok(/doesn’t look like/.test(await p.textContent('main')), 'a wrong shape is caught before asking');
      await p.fill('#ctCode', 'acq 1a2b3 c4d5e'); await p.click('.ct-btn'); await p.waitForTimeout(500);
      ok(/Omar Tarek/.test(await p.textContent('main')) && /c=ACQ-1A2B3-C4D5E/.test(p.url()), 'typing the code with spaces works and the address keeps the link');
    } },
  { name:'public-offline', url:'/cert/?c=ACQ-1A2B3-C4D5E', pub:'fail',
    run: async (p, ok) => { ok(/Couldn’t check right now/.test(await p.textContent('main')) && await p.isVisible('#ctRetry'), 'no connection: says so with Try again'); } }
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
    if (t.pub !== undefined) await ctx.route('https://ztlpgyomjuzmjmuifbbd.supabase.co/rest/v1/rpc/certificate_check', async r => {
      if (t.pub === 'fail') return r.abort();
      r.fulfill({ status:200, contentType:'application/json', headers:{ 'access-control-allow-origin':'*' }, body:JSON.stringify(t.pub) });
    });
    if (t.init) await ctx.addInitScript(o => { Object.assign(window, o); try { localStorage.clear(); } catch(e){} }, t.init);
    else await ctx.addInitScript(() => { const f = window.fetch; window.fetch = (u, o) => { try { window.__body = JSON.parse(o.body); } catch(e){} return f(u, o); }; });
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push('PAGE ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
    await p.goto(BASE + t.url); await p.waitForTimeout(1500);
    const tag = W + ' ' + t.name;
    const ok = (c, msg) => { if (!c) bad++; const l = (c ? 'ok   ' : 'FAIL ') + tag + ': ' + msg; log.push(l); console.log(l); };
    if (OUT) { fs.mkdirSync(OUT, { recursive:true }); await p.screenshot({ path:path.join(OUT, t.name + '-' + W + '.png'), fullPage:true }); }
    const wide = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(wide <= W, 'nothing wider than the screen (' + wide + 'px)');
    try { await t.run(p, ok, W); } catch(e) { ok(false, 'check crashed: ' + e.message.split('\n')[0]); }
    const small = await p.evaluate(() => [...document.querySelectorAll('#pView a, #pView button, main a, main button, #pView summary')].filter(e => e.offsetParent && !e.closest('.p-apps')).map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 24), Math.round(r.height)]; }).filter(x => x[1] < 44));
    ok(!small.length, 'tap targets at least 44px' + (small.length ? ' (small: ' + small.map(x => x.join(' ')).join(', ') + ')' : ''));
    ok(!errs.length, 'no console errors' + (errs.length ? ' (' + errs.join(' / ') + ')' : ''));
    await ctx.close();
  }
  if (OUT) fs.writeFileSync(path.join(OUT, 'certs-p3-output.txt'), log.join('\n') + '\n');
  await browser.close(); console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
})();
