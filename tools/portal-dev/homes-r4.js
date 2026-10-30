// Round 4 checks: the Team home, Amr's Portal view and Admin overview, Learner progress, the dark sidebar and the
// Portal / Admin switch, as owner, manager, agent, at 390 and 1440. Real CSP on (the stand-in Supabase is same-origin).
//   python3 -m http.server 8702 &   (repo root)   then   node tools/portal-dev/homes-r4.js http://localhost:8702 [screens folder]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [BASE, OUT] = process.argv.slice(2);
const STUB = fs.readFileSync(path.join(__dirname, 'stub-supabase.js'), 'utf8');
const O = { user:{ id:'o1', email:'owner@example.com' } }, U = { user:{ id:'u1', email:'sara@example.com' } };
const ME = { manager:{ role:'manager', keys:['course','deals','learn','live','requests','team'], needs_code:['team'] }, agent:{ role:'agent', keys:['course','deals','learn'], needs_code:[] } };
const member = (me, name, co) => ({ is_tracker_admin:false, my_profile:[{ name, company_id:co === undefined ? 1 : co, company_name:'Sample Co', active:true }], portal_me:Object.assign({ name }, me),
  company_names:[], my_shifts:[], my_briefs:[], my_card:{ role:'member' }, fx_rate_on:50,
  course_state:{ totalModules:15, modules:[{ id:'m1', number:1, title:'Finding sellers', openForLearners:true }, { id:'m2', number:2, title:'Getting their number', openForLearners:true }, { id:'m3', number:3, title:'Offers', openForLearners:false }] },
  portal_learner_progress:[{ user_id:'u2', name:'Youssef H.', course:'mkt2', passed:2, sent:1, updated_at:new Date().toISOString() }] });
const owner = { is_tracker_admin:true, portal_me:{ role:'owner', keys:['course','deals','learn','live','mkt','money','psy','requests','team'], needs_code:[] }, course_admin_waiting:[{ userId:'u1', title:'Module 1 drill' }], visit_stats:{ visitors:1234 },
  course_admin_learners:[{ userId:'u1', name:'Sara R.', done:3, total:15, module:2, lastActive:new Date().toISOString() }],
  portal_learner_progress:[{ user_id:'u2', name:'Youssef H.', course:'mkt2', passed:2, sent:1, updated_at:new Date().toISOString() }] };
const ownerFrom = { members:[{ user_id:'u1', name:'Sara R.', active:true }, { user_id:'u2', name:'Youssef H.', active:true }], companies:[], live_status:[{ user_id:'u1' }],
  shift_requests:[{ id:1, name:'Sara R.', shift_date:'2026-10-27', user_id:'u1' }], hub_uploads:[{ id:'h1', user_id:'u2', title:'Call recording', course:'mkt', module:'m3' }], code_live_status:[] };

const sideOf = p => p.evaluate(() => { const d = document.getElementById('drawer'); if (!d || d.hidden) return null;
  const out = []; let g = '';
  d.querySelectorAll('.sec, .mi').forEach(e => { if (e.hidden || e.closest('[hidden]') || e.closest('.bottom') || e.closest('.sub')) return; if (e.classList.contains('sec')) g = e.textContent.trim(); else out.push((g ? g + ':' : '') + e.textContent.trim().replace(/\s*\d+( waiting)?$/, '')); });
  return out; });
const fontOf = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontFamily : ''; }, sel);
const T = [
  { name:'owner-admin', url:'/app/', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:owner, SB_FROM:ownerFrom }, run: async (p, ok, W) => {
      ok(await p.evaluate(() => location.hash) === '#admin', 'Amr lands on the Admin overview');
      ok(/Bricolage/.test(await fontOf(p, '#title')), 'page name in Bricolage Grotesque (was Bodoni): ' + (await fontOf(p, '#title')).split(',')[0]);
      ok(/Bricolage/.test(await fontOf(p, '#pView h1')), 'hero heading in Bricolage Grotesque');
      ok(await p.isVisible('.p-admin-tag'), 'ADMIN label shows');
      ok(await p.isVisible('.p-apps-btn'), 'Apps button shows');
      ok(await p.evaluate(() => getComputedStyle(document.querySelector('#pView .p-hero')).borderRadius) === '10px', 'portal corners are round (not the old square look)');
      ok(await p.evaluate(() => (document.querySelector('.p-mode [aria-current="page"]') || {}).textContent) === 'Admin', 'switch is on Admin');
      const t = await p.evaluate(() => document.getElementById('pView').innerText);
      ok(/3 things need you today/.test(t) && /Sara R\.|1 waiting/.test(t) && /1,234/.test(t) && /Zoho Campaigns/.test(t) && !/Emails and sign-ups/.test(t), 'overview numbers: 3 things (2 reviews, 1 request), 1,234 visits, Zoho link');
      ok(/People[\s\S]*Learning[\s\S]*Deals[\s\S]*Money[\s\S]*Site/i.test(t), 'boxes People, Learning, Deals, Money, Site');
      if (W > 1000) { const s = await sideOf(p); ok(s && JSON.stringify(s) === JSON.stringify(['Overview','People:Live now','People:Team and shifts','People:Missed-shift requests','People:Invite and access','Learning:Learning Hub','Learning:Learner progress','Learning:Review center','Deals:Deal CRM','Deals:Land calculator','Deals:House calculator','Money:Cash','Money:Income','Money:Expenses','Money:My time','Money:Payments (later)','Site:Visits','Site:Emails','Site:Logs','Site:Zoho Campaigns']), 'sidebar groups: ' + (s || []).join(' | ')); }
    } },
  { name:'owner-portal', url:'/app/#portal', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:owner, SB_FROM:ownerFrom }, run: async (p, ok) => {
      ok(await p.evaluate(() => (document.querySelector('.p-mode [aria-current="page"]') || {}).textContent) === 'Portal', 'switch is on Portal');
      const t = await p.evaluate(() => document.getElementById('pView').innerText);
      ok(/Good (morning|afternoon|evening), Amr/.test(t) && /3 things waiting for you/.test(t), 'greeting and things waiting');
      ok((await p.$$('.p-acard')).length === 6, 'six area cards');
      ok(/Module 1 drill|Call recording, from Youssef H\./.test(t) && /Missed-shift request from Sara/.test(t), 'waiting list: reviews and requests');
    } },
  { name:'owner-oldlinks', url:'/app/#people', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:owner, SB_FROM:ownerFrom }, run: async (p, ok) => {
      ok(!(await p.evaluate(() => document.getElementById('pPeople').hidden)) && await p.evaluate(() => location.hash) === '#people', 'old link #people still opens Invite and access');
      await p.evaluate(() => { location.hash = '#review'; }); await p.waitForTimeout(600);
      ok(!(await p.evaluate(() => document.getElementById('pReview').hidden)), 'old link #review still opens the Review center');
      await p.evaluate(() => { location.hash = '#learn'; }); await p.waitForTimeout(800);
      ok(/\/app\/learn\/$/.test(await p.evaluate(() => location.pathname)), 'old link #learn still goes to the Learning Hub');
    } },
  { name:'owner-progress', url:'/app/#progress', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:owner, SB_FROM:ownerFrom }, run: async (p, ok) => {
      const t = await p.evaluate(() => document.getElementById('pView').innerText);
      ok(/Sara R\.\s+Acquisitions\s+3 of 15/.test(t) && /Youssef H\.\s+Marketing\s+2 of 16/.test(t), 'learner progress table, pass counts only');
    } },
  { name:'manager-home', url:'/app/', init:{ SB_SESSION:U, SB_RPC:member(ME.manager, 'Mona K.'), SB_FROM:{ shift_requests:[{ id:1 }], live_status:[] } }, run: async (p, ok, W) => {
      ok(await p.evaluate(() => location.hash) === '#home', 'manager lands on the Team home');
      ok(!(await p.$('.p-mode')) && !(await p.isVisible('.p-admin-tag')), 'no ADMIN label or switch (Amr only)');
      const t = await p.evaluate(() => document.getElementById('pView').innerText);
      ok(/Hi, Mona/.test(t) && /Team and shifts/.test(t) && /1 request/.test(t) && /Learner progress/.test(t), 'manager areas: Team and shifts with 1 request, Learner progress');
      if (W > 1000) { const s = await sideOf(p); ok(s && JSON.stringify(s) === JSON.stringify(['Portal','My hours','People:Live now','People:Team and shifts','People:Missed-shift requests','Learning:Learning Hub','Learning:Learner progress','Deals:Deal CRM','Deals:Land calculator','Deals:House calculator']), 'smaller Admin side: ' + (s || []).join(' | ')); }
      await p.evaluate(() => { location.hash = '#progress'; }); await p.waitForTimeout(800);
      ok(/Youssef H\.\s+Marketing\s+2 of 16/.test(await p.evaluate(() => document.getElementById('pView').innerText)), 'manager sees learner progress');
    } },
  { name:'agent-home', url:'/app/', init:{ SB_SESSION:U, SB_RPC:member(ME.agent, 'Sara R.'), SB_FROM:{ live_status:[] } }, run: async (p, ok) => {
      ok(await p.evaluate(() => location.hash) === '#home', 'agent lands on the Team home');
      ok(await p.evaluate(() => document.getElementById('drawer').hidden && document.getElementById('burger').hidden), 'no sidebar or menu button for agents');
      const t = await p.evaluate(() => document.getElementById('pView').innerText);
      ok(/Hi, Sara/.test(t) && /not clocked in/.test(t), 'hero: name and clock state');
      ok(/Real Estate Acquisitions · Module 2/i.test(t) && /Getting their number/.test(t) && /7%/.test(t), 'continue learning: Acquisitions module 2, 7%');
      ok(/My deals[\s\S]*Learning Hub[\s\S]*My hours[\s\S]*Calculators/.test(t) && !/Team and shifts/.test(t), 'areas: My deals, Learning Hub, My hours, Calculators');
      ok(/Marketing course · Ask Amr to open it/.test(t) && /Psychology and Therapy course · Ask Amr/.test(t), 'locked courses listed');
      ok(/Bricolage/.test(await fontOf(p, '#pView h1')), 'hero heading in Bricolage Grotesque');
      await p.click('[data-clock="run"]'); await p.waitForTimeout(800);
      const up = await p.evaluate(() => SB_CALLS.some(c => c[0] === 'upsert' && c[1] === 'live_status'));
      ok(up && /clocked in/.test(await p.evaluate(() => document.getElementById('pvSub').textContent)) && await p.isVisible('[data-clock="off"]'), 'Clock in starts the shift (same code as the tracker) and the button turns to Clock out');
      await p.evaluate(() => { location.hash = '#live'; }); await p.waitForTimeout(500);
      ok(await p.evaluate(() => location.hash) === '#home', 'an agent opening #live goes back to the Team home');
      await p.evaluate(() => { location.hash = '#track'; }); await p.waitForTimeout(500);
      ok(!(await p.evaluate(() => document.getElementById('pTrack').hidden)), 'old link #track still opens My hours');
    } },
  { name:'agent-nocompany', url:'/app/', init:{ SB_SESSION:U, SB_RPC:member(ME.agent, 'Omar T.', null), SB_FROM:{ live_status:[] } }, run: async (p, ok) => {
      ok(/Amr needs to set the company/.test(await p.evaluate(() => document.getElementById('pvSub').textContent)) && !(await p.$('[data-clock]')), 'no company yet: says so, no clock button');
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
    await ctx.addInitScript(o => { Object.assign(window, o); try { localStorage.clear(); } catch(e){} }, t.init);
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
    const small = await p.evaluate(() => [...document.querySelectorAll('#pView a, #pView button, .app-bar button, .app-bar a, #drawer .mi')].filter(e => e.offsetParent && !e.closest('.p-wait-row, td, .p-apps')).map(e => { const r = e.getBoundingClientRect(); return [Math.round(Math.min(r.width, r.height)), (e.textContent || e.className).trim().slice(0, 24)]; }).filter(x => x[0] < 40));
    ok(!small.length, 'tap targets at least 40px' + (small.length ? ' (small: ' + small.map(x => x.join(' ')).join(', ') + ')' : ''));
    ok(!errs.length, 'no console errors' + (errs.length ? ' (' + errs.join(' / ') + ')' : ''));
    await ctx.close();
  }
  if (OUT) fs.writeFileSync(path.join(OUT, 'homes-r4-output.txt'), log.join('\n') + '\n');
  await browser.close(); console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
})();
