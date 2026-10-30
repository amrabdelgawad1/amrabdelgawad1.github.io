// Phase 0 checks: Amr's Logs page (Activity, Errors, Changes) and error reports from the shared top bar.
// At 390 and 1440, real CSP on.
//   python3 -m http.server 8702 &   (repo root)   then   node tools/portal-dev/logs-p0.js http://localhost:8702 [screens folder]
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



const now = Date.now(), ago = m => new Date(now - m * 60e3).toISOString();
const LOGS = Object.assign({}, owner, {
  portal_activity:[{ at:ago(5), who:'Sara R.', kind:'signed_in', detail:null }, { at:ago(20), who:'Amr', kind:'request_decided', detail:'Sara R.: approved' },
    { at:ago(60), who:'Youssef H.', kind:'deal_saved', detail:'workspace' }, { at:ago(90), who:'Amr', kind:'access_changed', detail:'Sara R.: {"access": {"to": ["learn"], "from": []}}' }],
  portal_errors:[{ at:ago(3), who:'Sara R.', page:'/app/#track', message:'TypeError: Cannot read properties of null', source:'/app/app.js?v=57', line:812, ua:'Chrome' }],
  portal_changes:[{ at:ago(1), title:'Phase 0: logs', detail:'Errors, activity and changes', sql_ran:'20261031090000_portal_logs.sql', link:'https://github.com/' }, { at:ago(600), title:'Round 7', detail:'Deal CRM as a team', sql_ran:'20261030160000_portal_deals_team.sql', link:null }]
});
const T = [
  { name:'logs-activity', url:'/app/#logs', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:LOGS, SB_FROM:ownerFrom }, run: async (p, ok) => {
    const t = await p.evaluate(() => document.getElementById('pLogs').hidden ? '' : document.getElementById('pLogs').innerText);
    ok(/Logs/.test(t) && /Signed in/.test(t) && /Decided a shift request/.test(t) && /Sara R\.: approved/.test(t) && /Saved deals/.test(t) && /Changed access/.test(t) && /Sara R\.: access added: learn/.test(t), 'Activity: sign-ins, decisions, saves and access changes, with names');
    ok(await p.evaluate(() => document.querySelector('#drawer .mi[href="#logs"]') && document.querySelector('#drawer .mi[href="#logs"]').classList.contains('on')), 'Logs is in the sidebar under Site, marked');
  } },
  { name:'logs-errors', url:'/app/#logs/errors', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:LOGS, SB_FROM:ownerFrom }, run: async (p, ok) => {
    const t = await p.evaluate(() => document.getElementById('pLogs').innerText);
    ok(/TypeError: Cannot read properties of null/.test(t) && /\/app\/app\.js\?v=57:812/.test(t) && /Sara R\./.test(t), 'Errors: message, file and line, who');
  } },
  { name:'logs-changes', url:'/app/#logs/changes', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:LOGS, SB_FROM:ownerFrom }, run: async (p, ok) => {
    const t = await p.evaluate(() => document.getElementById('pLogs').innerText);
    ok(/Phase 0: logs/.test(t) && /20261031090000_portal_logs\.sql/.test(t) && /Round 7/.test(t), 'Changes: what shipped and the SQL that ran');
    ok(await p.evaluate(() => document.querySelector('.lg-days').hidden), 'no period picker on Changes');
  } },
  { name:'logs-not-set-up', url:'/app/#logs', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:owner, SB_FROM:ownerFrom }, run: async (p, ok) => {
    ok(/Couldn’t load the log|aren’t set up/.test(await p.evaluate(() => document.getElementById('pLogs').innerText)), 'without the database part: a plain message, no crash');
  } },
  { name:'agent-no-logs', url:'/app/#logs', init:{ SB_SESSION:U, SB_RPC:member(ME.agent, 'Sara R.'), SB_FROM:{ live_status:[] } }, run: async (p, ok) => {
    ok(await p.evaluate(() => document.getElementById('pLogs').hidden && location.hash === '#home'), 'an agent asking for #logs lands on the Team home');
    ok(await p.evaluate(() => !document.querySelector('#drawer .mi[href="#logs"]') || document.querySelector('#drawer .mi[href="#logs"]').hidden), 'and has no Logs link');
  } },
  { name:'error-report', url:'/app/', init:{ SB_SESSION:U, SB_RPC:member(ME.agent, 'Sara R.'), SB_FROM:{ live_status:[] } }, run: async (p, ok) => {
    await p.evaluate(() => { for (let i = 0; i < 8; i++) setTimeout(() => { throw new Error('Test failure ' + (i % 6)); }, 0); setTimeout(() => { throw new Error('Test failure 0'); }, 0); });
    await p.waitForTimeout(600);
    const sent = await p.evaluate(() => (window.SB_CALLS || []).filter(c => c[0] === 'rpc' && c[1] === 'log_app_error').map(c => c[2]));
    ok(sent.length === 5, 'page errors are reported, at most 5 per page load (' + sent.length + ')');
    ok(new Set(sent.map(x => x.p_message)).size === sent.length, 'each message once');
    ok(sent.every(x => x.p_page && x.p_page.startsWith('/app/') && !/password|@/.test(JSON.stringify(x))), 'with the page, never form contents');
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
    p.on('pageerror', e => { if (!/Test failure/.test(e.message)) errs.push('PAGE ' + e.message); });
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|Test failure/.test(m.text())) errs.push(m.text()); });
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
  if (OUT) fs.writeFileSync(path.join(OUT, 'logs-p0-output.txt'), log.join('\n') + '\n');
  await browser.close(); console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
})();
