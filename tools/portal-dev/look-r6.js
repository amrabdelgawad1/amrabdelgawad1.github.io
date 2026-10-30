// Round 6 checks: the remaining pages in the portal look, at 390 and 1440, real CSP on.
// For each area: it shows its data, no old-look fonts (Bodoni, Barlow, DM Serif) or colors (champagne gold, magenta,
// cream, the old blue) on anything visible, no dark-mode switch left, nothing wider than the screen, no console errors.
//   python3 -m http.server 8702 &   (repo root)   then   node tools/portal-dev/look-r6.js http://localhost:8702 [screens folder]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [BASE, OUT] = process.argv.slice(2);
const STUB = fs.readFileSync(path.join(__dirname, 'stub-supabase.js'), 'utf8');
const NOW = Date.now(), iso = ms => new Date(NOW - ms).toISOString();
const O = { user:{ id:'o1', email:'owner@example.com' } }, U = { user:{ id:'u1', email:'sara@example.com' } };
const OWNER_ME = { role:'owner', keys:['course','deals','learn','live','mkt','money','psy','requests','team'], needs_code:[] };
const FROM = {
  members:[{ user_id:'u1', name:'Sara R.', email:'sara@example.com', active:true, role:'agent', access:[], not_given:[], company_id:1, created_at:'2026-09-01' }],
  companies:[{ id:1, name:'Sample Co' }],
  live_status:[{ user_id:'u1', mode:'run', started_at:iso(7200e3), work_seconds:3600, break_seconds:300, seg_at:iso(1800e3), updated_at:iso(60e3) }],
  code_live_status:[],
  shift_requests:[{ id:1, user_id:'u1', name:'Sara R.', shift_date:'2026-10-27', work_seconds:28800, break_seconds:1800, started_at:'2026-10-27T13:00:00Z', ended_at:'2026-10-27T21:30:00Z', company_id:1, status:'pending', created_at:iso(86400e3), note:'Phone died' }],
  hub_uploads:[{ id:'h1', user_id:'u1', course:'mkt', module:'m3', title:'Call recording', kind:'recording', path:'u1/mkt/a.webm', status:'waiting', created_at:iso(3600e3) }],
  hub_upload_comments:[], tracker_settings:[{ key:'hourly_rate', value:'5' }], access_log:[], agents:[{ id:1, name:'Sara R.', active:true, role:'member', created_at:'2026-09-01' }], agent_companies:[], profiles:[], payslips:[],
  cash_entries:[{ id:1, kind:'income', entry_date:'2026-10-05', title:'Client A', category:'Team profit', amount:1200, currency:'USD', settled:true, created_at:'2026-10-05' },
                { id:2, kind:'expense', entry_date:'2026-10-07', title:'Software', category:'Tools', amount:80, currency:'USD', settled:true, created_at:'2026-10-07' }],
  shifts:[{ id:1, name:'Sara R.', shift_date:'2026-10-27', work_seconds:28800, break_seconds:0, company_id:1, source:'tracker', created_at:'2026-10-27T21:00:00Z', owner:false, dials:40, conversations:8, appointments:1, rate:5, user_id:'u1' }],
  fx_rates:[{ rate_date:'2026-10-01', rate:48 }]
};
const OWNER_RPC = { is_tracker_admin:true, portal_me:OWNER_ME, course_admin_waiting:[], course_admin_learners:[], portal_learner_progress:[], company_code_status:[],
  agent_summaries:[{ agent_id:1, name:'Sara R.', email:'sara@example.com', subject:'Your week at Sample Co', html:'<p>Hi Sara, here is your week.</p>', sent_at:null, rates:'$5.00' }],
  visit_stats:{ visitors:120, views:300, plays:4, booked:2, cv:7, sources:[{ name:'google.com', n:40 }], countries:[{ name:'US', n:60 }], uszones:[], devices:[{ name:'phone', n:70 }], hits:[] } };
const owner = { SB_SESSION:O, SB_AAL:'aal2', SB_RPC:OWNER_RPC, SB_FROM:FROM };
const agent = { SB_SESSION:U, SB_FROM:{ live_status:[] }, SB_RPC:{ is_tracker_admin:false, my_profile:[{ name:'Sara R.', company_id:1, company_name:'Sample Co', active:true }],
  portal_me:{ role:'agent', name:'Sara R.', keys:['course','deals','learn'], needs_code:[] }, company_names:[], fx_rate_on:48, my_card:{ role:'member' },
  my_shifts:[{ shift_date:'2026-10-27', work_seconds:28800, break_seconds:0, started_at:'2026-10-27T13:00:00Z', ended_at:'2026-10-27T21:00:00Z', company_name:'Sample Co', source:'tracker' }], my_briefs:[] } };
const S = [
  ['track', '/app/#track', agent, 'pTrack', /Sample Co/],
  ['live', '/app/#live', owner, 'pLive', /Sara R\./],
  ['requests', '/app/#requests', owner, 'pRequests', /Sara R\.[\s\S]*Phone died|Phone died/],
  ['visits', '/app/#visits', owner, 'pVisits', /120/],
  ['emails', '/app/#emails', owner, 'pEmails', /Sara R\./],
  ['review', '/app/#review', owner, 'pReview', /Call recording/],
  ['settings', '/app/#live', owner, 'setBody', /Agents|Sara R\./, async p => { await p.click('#me'); await p.click('[data-go="settings"]'); await p.waitForTimeout(500); }],
  ['update-toast', '/app/#live', owner, 'updateBar', /A new version of the app is ready/, async p => { await p.evaluate(() => { document.getElementById('updateBar').hidden = false; }); }],
  ['cash-overview', '/cash/?embed=1#overview', owner, 'dashView', /Client A|1,200|Income/],
  ['cash-income', '/cash/?embed=1#income', owner, 'dashView', /Client A/],
  ['cash-expense', '/cash/?embed=1#expense', owner, 'dashView', /Software/],
  ['cash-team', '/cash/?embed=1#team', owner, 'dashView', /Sara R\./],
  ['cash-mytime', '/cash/?embed=1#mytime', owner, 'dashView', /time|Time|hours/]
];
const OLD = ['rgb(201, 169, 110)', 'rgb(194, 24, 122)', 'rgb(138, 106, 53)', 'rgb(241, 235, 224)', 'rgb(228, 107, 176)', 'rgb(148, 101, 12)', 'rgb(227, 170, 53)', 'rgb(37, 99, 235)', 'rgb(251, 248, 242)', 'rgb(11, 11, 11)', 'rgb(224, 196, 142)'];
(async () => {
  const browser = await chromium.launch(); let bad = 0; const log = [];
  for (const W of [390, 1440]) for (const [name, url, init, panel, want, act] of S) {
    const ctx = await browser.newContext({ viewport:{ width:W, height:W < 768 ? 844 : 900 }, serviceWorkers:'block', isMobile:W < 768, hasTouch:W < 768 });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await ctx.route(u => /^\/(app|cash)\/(index\.html)?$/.test(new URL(u).pathname), async r => {
      const res = await r.fetch(); const b = await res.text();
      r.fulfill({ response:res, body:b.replace(/<script src="https:\/\/cdn\.jsdelivr[^>]*><\/script>/, '<script src="/__stub/sb.js"></script>') });
    });
    await ctx.route('**/__stub/sb.js', r => r.fulfill({ contentType:'application/javascript', body:STUB }));
    await ctx.addInitScript(o => { Object.assign(window, JSON.parse(JSON.stringify(o))); try { localStorage.clear(); localStorage.setItem('theme', 'dark'); } catch(e){} }, init);
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push('PAGE ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
    await p.goto(BASE + url); await p.waitForTimeout(1800);
    if (act) await act(p);
    await p.waitForTimeout(300);
    const tag = W + ' ' + name;
    const ok = (c, msg) => { if (!c) bad++; const l = (c ? 'ok   ' : 'FAIL ') + tag + ': ' + msg; log.push(l); console.log(l); };
    const t = await p.evaluate(id => { const e = document.getElementById(id); return e && !e.hidden ? e.innerText : ''; }, panel);
    ok(want.test(t), 'shows its data');
    const old = await p.evaluate(OLD => { const out = new Set();
      for (const e of document.querySelectorAll('body *')) {
        const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || !e.getClientRects().length || e.closest('.slip, [hidden]')) continue;
        const f = s.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        if (/Bodoni|Barlow|DM Serif/.test(f) && (e.innerText || '').trim()) out.add('font ' + f + ' on ' + e.tagName.toLowerCase() + '.' + String(e.className.baseVal != null ? e.className.baseVal : e.className).split(' ')[0]);
        for (const k of ['color', 'backgroundColor', 'borderTopColor']) if (OLD.includes(s[k]) && (k !== 'color' || (e.innerText || '').trim()) && (k !== 'borderTopColor' || parseFloat(s.borderTopWidth) > 0)) out.add(k + ' ' + s[k] + ' on ' + e.tagName.toLowerCase() + '.' + String(e.className.baseVal != null ? e.className.baseVal : e.className).split(' ')[0]);
      }
      return [...out].slice(0, 10); }, OLD);
    ok(!old.length, 'no old-look fonts or colors' + (old.length ? ' (' + old.join('; ') + ')' : ''));
    ok(await p.evaluate(() => !document.querySelector('[data-theme-toggle]') && document.documentElement.getAttribute('data-theme') !== 'dark'), 'light only: no dark-mode switch, and a saved dark choice is ignored');
    const wide = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(wide <= W, 'nothing wider than the screen (' + wide + 'px)');
    ok(!errs.length, 'no console errors' + (errs.length ? ' (' + errs.join(' / ') + ')' : ''));
    if (OUT) { fs.mkdirSync(OUT, { recursive:true }); await p.screenshot({ path:path.join(OUT, name + '-' + W + '.png'), fullPage:!/toast/.test(name) }); }
    await ctx.close();
  }
  if (OUT) fs.writeFileSync(path.join(OUT, 'look-r6-output.txt'), log.join('\n') + '\n');
  await browser.close(); console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
})();
