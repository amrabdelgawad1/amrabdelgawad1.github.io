// Round 2 page checks with the stand-in Supabase (stub-supabase.js): the menu from portal_me(), the Review center's
// pass counts, Invite and access, and the Learning Hub counts from portal_people(). Usage, from the repo root:
//   python3 -m http.server 8702 &   then   node tools/portal-dev/smoke-r2.js http://localhost:8702 [screens folder]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [BASE, OUT] = process.argv.slice(2);
const STUB = fs.readFileSync(path.join(__dirname, 'stub-supabase.js'), 'utf8');
const U = { user:{ id:'u1', email:'sara@example.com' } }, O = { user:{ id:'o1', email:'owner@example.com' } };
const memberRpc = me => ({ is_tracker_admin:false, my_profile:[{ name:'Sara R.', company_id:1, company_name:'Sample Co', active:true }], portal_me:me,
  company_names:[], my_shifts:[], my_briefs:[], my_card:{ role:'member' }, fx_rate_on:50 });
const ownerRpc = { is_tracker_admin:true, course_admin_learners:[], course_admin_waiting:[], visit_stats:{},
  portal_learner_progress:[{ user_id:'u1', name:'Sara R.', course:'mkt2', passed:3, sent:2, updated_at:new Date().toISOString() },
                           { user_id:'u1', name:'Sara R.', course:'psy', passed:5, sent:0, updated_at:new Date().toISOString() }],
  portal_people:[{ user_id:'u1', name:'Sara R.', active:true, role:'agent', keys:['course','deals','learn'] }, { user_id:'u2', name:'Mona K.', active:true, role:'agent', keys:['learn','mkt'] }] };
const members = [{ user_id:'u1', name:'Sara R.', email:'sara@example.com', active:true, access:[], role:'agent', created_at:'2026-09-01', company_id:1 }];
// The menu as the person sees it (on phones it opens from the menu button; on PC it's always there)
const menu = async p => { if (await p.isVisible('#burger')) await p.click('#burger'); await p.waitForTimeout(300);
  return p.evaluate(() => [...document.querySelectorAll('#drawer .mi')].filter(a => !a.hidden && a.offsetParent).map(a => a.textContent.trim()).join(' | ')); };
const T = [
  { name:'agent-menu', url:'/app/', init:{ SB_SESSION:U, SB_RPC:memberRpc({ role:'agent', keys:['course','deals','learn'], needs_code:[] }) },
    check: menu,
    want: s => /Learning Hub/.test(s) && /Land calculator/.test(s) && !/Live now/.test(s) && !/Invite/.test(s) },
  { name:'manager-menu', url:'/app/', init:{ SB_SESSION:U, SB_RPC:memberRpc({ role:'manager', keys:['course','deals','learn','live','requests','team'], needs_code:['team'] }) },
    check: menu,
    want: s => /Live now/.test(s) && /Missed-shift/.test(s) && /Team/.test(s) && !/Income/.test(s) && !/Invite/.test(s) },
  { name:'old-database', url:'/app/', init:{ SB_SESSION:U, SB_RPC:Object.assign(memberRpc(null), { portal_me:undefined }), SB_FROM:{ members:[{ access:['live'] }] } },
    check: menu,
    want: s => /Live now/.test(s) && !/Learning Hub/.test(s) },
  { name:'review-progress', url:'/app/#review/u1', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:ownerRpc, SB_FROM:{ members, hub_uploads:[], companies:[] } },
    check: async p => p.evaluate(() => document.getElementById('reviewBody').innerText),
    want: s => /3 of 16 modules passed · 2 assignments sent/.test(s) && /5 of 27 modules passed/.test(s) },
  { name:'people-role', url:'/app/#people', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:ownerRpc, SB_FROM:{ members, companies:[{ id:1, name:'Sample Co' }] } },
    check: async p => { await p.waitForSelector('details.acc summary'); return p.evaluate(() => document.querySelector('details.acc summary').textContent + ' | ticks: ' + [...document.querySelectorAll('details.acc input')].map(i => i.value).join(',')); },
    want: s => s === 'Agent · extras: none | ticks: live,requests,team,deals,learn,mkt,psy,course' },
  { name:'agent-role', url:'/app/#live', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:ownerRpc, SB_FROM:{ companies:[{ id:1, name:'Sample Co' }], agent_companies:[],
      agents:[{ id:1, name:'Sara R.', active:true, role:'operator', created_at:'2026-09-01' }], members:[{ user_id:'u1', name:'Sara R.', email:'sara@example.com', active:true, agent_id:1, created_at:'2026-09-01' }] } },
    check: async p => {
      await p.click('#me'); await p.click('[data-go="settings"]'); await p.click('[data-toggle="1"]'); await p.waitForSelector('select[data-a-role]', { state:'attached' });
      const opts = await p.evaluate(() => [...document.querySelector('select[data-a-role]').options].map(o => (o.selected ? '*' : '') + o.textContent).join(','));
      await p.evaluate(() => { const s = document.querySelector('select[data-a-role]'); s.value = 'member'; s.dispatchEvent(new Event('change', { bubbles:true })); });
      await p.waitForTimeout(500);
      const writes = await p.evaluate(() => SB_CALLS.filter(c => c[0] === 'update').map(c => c[1] + ':' + JSON.stringify(c[2])).join(' '));
      return opts + ' | ' + writes; },
    // an old Operator shows as Manager; switching to Agent sets both, and never touches access
    want: s => s === 'Agent,*Manager | agents:{"role":"member"} members:{"role":"agent"}' },
  { name:'hub-owner-counts', url:'/app/learn/', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:Object.assign({ learn_can_open:true, course_has_access:true, course_state:null }, ownerRpc), SB_FROM:{ hub_uploads:[], learn_progress:[] } },
    check: async p => p.evaluate(() => [...document.querySelectorAll('.lh-own')].map(e => e.textContent.trim()).join(' | ')),
    want: s => s === '1 person has access | 1 person has access | No one else has access yet' }
];
(async () => {
  const browser = await chromium.launch(); let bad = 0;
  for (const W of [390, 1440]) for (const t of T) {
    const ctx = await browser.newContext({ viewport:{ width:W, height:900 }, serviceWorkers:'block' });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await ctx.route(u => /\/(app|course)\/(learn\/)?(index\.html)?$/.test(new URL(u).pathname), async r => {
      const res = await r.fetch(); let b = await res.text();
      b = b.replace(/<script src="https:\/\/cdn\.jsdelivr[^>]*><\/script>/, '<script src="/__stub/sb.js"></script>').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
      r.fulfill({ response:res, body:b });
    });
    await ctx.route('**/__stub/sb.js', r => r.fulfill({ contentType:'application/javascript', body:STUB }));
    await ctx.addInitScript(o => { Object.assign(window, o); try { localStorage.clear(); sessionStorage.clear(); } catch(e){} }, t.init);
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
    await p.goto(BASE + t.url); await p.waitForTimeout(1500);
    let got; try { got = await t.check(p); } catch(e) { got = 'CHECK FAILED: ' + e.message; }
    const pass = t.want(got) && !errs.length; if (!pass) bad++;
    console.log((pass ? 'ok   ' : 'FAIL ') + W + ' ' + t.name + (pass ? '' : '\n     got: ' + got + (errs.length ? '\n     errors: ' + errs.join(' / ') : '')));
    if (OUT) { fs.mkdirSync(OUT, { recursive:true }); await p.screenshot({ path:path.join(OUT, t.name + '-' + W + '.png'), fullPage:true }); }
    await ctx.close();
  }
  await browser.close(); process.exit(bad ? 1 : 0);
})();
