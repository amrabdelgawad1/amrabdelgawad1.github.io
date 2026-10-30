// Round 7 checks for the site: the weekly team board on the Team home, deal numbers on the Admin overview and the
// Portal view (or "Unlock the CRM to see deal numbers"), and the Cash Backup heading. At 390 and 1440, real CSP on.
//   python3 -m http.server 8702 &   (repo root)   then   node tools/portal-dev/site-r7.js http://localhost:8702 [screens folder]
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


const BOARD = [{ user_id:'u2', name:'Youssef H.', calls:120, lessons:4, drills:2, is_me:false }, { user_id:'u1', name:'Sara R.', calls:85, lessons:6, drills:3, is_me:true }, { user_id:'u3', name:'Mona K.', calls:0, lessons:0, drills:0, is_me:false }];
const agent = Object.assign(member(ME.agent, 'Sara R.'), { portal_team_board:BOARD });
const COUNTS = { open:7, due:2, contract:1, team:true, at:Date.now() };
const T = [
  { name:'agent-board', url:'/app/', init:{ SB_SESSION:U, SB_RPC:agent, SB_FROM:{ live_status:[] } }, run: async (p, ok) => {
    const t = await p.evaluate(() => document.getElementById('pvBoardWrap') && !document.getElementById('pvBoardWrap').hidden ? document.getElementById('pvBoardWrap').innerText : '');
    ok(/This week on the team/.test(t) && /Calls logged/i.test(t) && /Lessons passed/i.test(t) && /Drills sent/i.test(t), 'Team home shows this week’s board');
    ok(/Youssef H\.\s+120\s+4\s+2/.test(t) && /Sara R\. \(you\)\s+85\s+6\s+3/.test(t), 'the board rows, in the order the database gives, with "(you)"');
    ok(await p.evaluate(() => !!document.querySelector('#pvBoardBox tr.is-me')), 'their own row is highlighted');
    ok(!/hour|pay|\$/i.test(t), 'no hours, pay or money on the board');
  } },
  { name:'agent-noboard', url:'/app/', init:{ SB_SESSION:U, SB_RPC:member(ME.agent, 'Sara R.'), SB_FROM:{ live_status:[] } }, run: async (p, ok) => {
    ok(await p.evaluate(() => document.getElementById('pvBoardWrap').hidden), 'no board when the database gives none (older database or not allowed)');
  } },
  { name:'owner-admin-locked', url:'/app/', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:owner, SB_FROM:ownerFrom }, run: async (p, ok) => {
    const t = await p.evaluate(() => document.getElementById('pView').innerText);
    ok(/Unlock the CRM to see deal numbers/.test(t), 'Admin overview without an unlocked CRM: "Unlock the CRM to see deal numbers"');
    ok(!/Open deals|Under contract/.test(t), 'and no made-up numbers');
  } },
  { name:'owner-admin-counts', url:'/app/', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:owner, SB_FROM:ownerFrom, DEAL_COUNTS:COUNTS }, run: async (p, ok) => {
    const t = await p.evaluate(() => document.getElementById('pView').innerText);
    ok(/Follow-ups due\s*2 due/.test(t) && /Open deals\s*7/.test(t) && /Under contract\s*1/.test(t), 'Admin overview after unlocking: follow-ups due, open deals, under contract');
    ok(!/Unlock the CRM/.test(t), 'no unlock line then');
  } },
  { name:'owner-portal-locked', url:'/app/#portal', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:owner, SB_FROM:ownerFrom }, run: async (p, ok) => {
    const t = await p.evaluate(() => [...document.querySelectorAll('.p-acard')].find(a => /Deal CRM/.test(a.innerText)).innerText);
    ok(/Unlock the CRM to see deal numbers/.test(t) && /Unlock the CRM/.test(t), 'Portal Deal CRM card: unlock line');
  } },
  { name:'owner-portal-counts', url:'/app/#portal', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:owner, SB_FROM:ownerFrom, DEAL_COUNTS:COUNTS }, run: async (p, ok) => {
    const t = await p.evaluate(() => [...document.querySelectorAll('.p-acard')].find(a => /Deal CRM/.test(a.innerText)).innerText);
    ok(/7 open/.test(t) && /2 due/.test(t) && /1 under contract/.test(t), 'Portal Deal CRM card: the counts');
  } },
  { name:'cash-backup', url:'/cash/?embed=1#overview', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:owner, SB_FROM:{ cash_entries:[], fx_rates:[] } }, run: async (p, ok) => {
    const s = await p.evaluate(() => { const f = e => { const c = getComputedStyle(e); return [c.fontFamily, c.fontWeight, c.fontSize, c.color, c.letterSpacing].join('|'); };
      const b = document.querySelector('.backup-card h2'), o = document.querySelector('.card-title h2'); return b && o ? [f(b), f(o)] : null; });
    ok(s && s[0] === s[1], 'Cash: the Backup heading matches the other card headings' + (s ? ' (' + s.join(' vs ') + ')' : ''));
  } }
];

(async () => {
  const browser = await chromium.launch(); let bad = 0; const log = [];
  for (const W of [390, 1440]) for (const t of T) {
    const ctx = await browser.newContext({ viewport:{ width:W, height:W < 768 ? 844 : 900 }, serviceWorkers:'block', isMobile:W < 768, hasTouch:W < 768 });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await ctx.route(u => /^\/(app|cash)\/(index\.html)?$/.test(new URL(u).pathname), async r => {
      const res = await r.fetch(); let b = await res.text();
      r.fulfill({ response:res, body:b.replace(/<script src="https:\/\/cdn\.jsdelivr[^>]*><\/script>/, '<script src="/__stub/sb.js"></script>') });
    });
    await ctx.route('**/__stub/sb.js', r => r.fulfill({ contentType:'application/javascript', body:STUB }));
    await ctx.addInitScript(o => { Object.assign(window, o); try { localStorage.clear(); if (o.DEAL_COUNTS) sessionStorage.setItem('dealCounts', JSON.stringify(o.DEAL_COUNTS)); } catch(e){} }, t.init);
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
  if (OUT) fs.writeFileSync(path.join(OUT, 'site-r7-output.txt'), log.join('\n') + '\n');
  await browser.close(); console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
})();
