// Phase 1 checks: the call counter on My hours, at 390 and 1440, real CSP on.
//   python3 -m http.server 8702 &   (repo root)   then   node tools/portal-dev/calls-p1.js http://localhost:8702 [screens folder]
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


const START = new Date(Date.now() - 2 * 3600e3).toISOString();
const LIVE = [{ user_id:'u1', mode:'run', started_at:START, work_seconds:3000, break_seconds:0, seg_at:new Date(Date.now() - 3600e3).toISOString(), updated_at:new Date().toISOString() }];
const TAPS = [{ id:1, kind:'dial', at:START }, { id:2, kind:'dial', at:START }, { id:3, kind:'dial', at:START }, { id:4, kind:'conversation', at:START }];
const agent = member(ME.agent, 'Sara R.');
const START_ISO = START;
const T = [
  { name:'calls-on', url:'/app/#track', init:{ SB_SESSION:U, SB_RPC:agent, SB_FROM:{ live_status:LIVE, call_events:TAPS } }, run: async (p, ok, W) => {
    await p.waitForTimeout(2000);
    const t = await p.evaluate(() => document.getElementById('tCalls').hidden ? '' : document.getElementById('tCalls').innerText);
    ok(/Calls this shift/.test(t) && /3\s*Dials/.test(t) && /1\s*Conversations/.test(t) && /0\s*Offers/.test(t) && /0\s*Appointments/.test(t), 'clocked in: the counter shows this shift’s taps');
    await p.click('#tCalls .call-tap[data-kind="dial"]'); await p.waitForTimeout(400);
    const t2 = await p.evaluate(() => document.getElementById('tCalls').innerText);
    const ins = await p.evaluate(() => (window.SB_CALLS || []).filter(c => c[0] === 'insert' && c[1] === 'call_events').map(c => c[2]));
    ok(/4\s*Dials/.test(t2) && ins.length === 1 && ins[0].kind === 'dial' && ins[0].shift_started_at === START_ISO, 'one tap adds a dial for this shift');
    ok(!JSON.stringify(ins).match(/phone|name|@/), 'nothing but the kind and the shift');
    const small = await p.evaluate(() => [...document.querySelectorAll('#tCalls button')].filter(b => b.getBoundingClientRect().height < 44).length);
    ok(small === 0, 'buttons at least 44px tall');
    await p.click('.ctl.off'); await p.waitForTimeout(600);
    const nums = await p.evaluate(() => [...document.querySelectorAll('input[type="number"], input[inputmode="numeric"]')].filter(i => i.offsetParent).map(i => i.value));
    ok(nums.slice(0, 3).join(',') === '4,1,', 'ending the shift: dials and conversations fill in from the counter (' + nums.join(',') + ')');
  } },
  { name:'calls-off', url:'/app/#track', init:{ SB_SESSION:U, SB_RPC:agent, SB_FROM:{ live_status:[], call_events:[] } }, run: async (p, ok) => {
    await p.waitForTimeout(2000);
    ok(await p.evaluate(() => document.getElementById('tCalls').hidden), 'not clocked in: no counter');
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
  if (OUT) fs.writeFileSync(path.join(OUT, 'calls-p1-output.txt'), log.join('\n') + '\n');
  await browser.close(); console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
})();
