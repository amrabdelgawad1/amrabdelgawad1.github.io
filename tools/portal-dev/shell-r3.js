// Round 3 checks: the shared top bar and Apps menu on every signed-in page, as owner, manager, agent and switched off,
// at 390 and 1440. Pages keep their real Content-Security-Policy: the stand-in Supabase is served from the site itself.
//   python3 -m http.server 8702 &   (repo root)   then   node tools/portal-dev/shell-r3.js http://localhost:8702 [screens folder]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [BASE, OUT] = process.argv.slice(2);
const STUB = fs.readFileSync(path.join(__dirname, 'stub-supabase.js'), 'utf8');
const O = { user:{ id:'o1', email:'owner@example.com' } }, U = { user:{ id:'u1', email:'sara@example.com' } };
const ME = {
  owner:{ role:'owner', keys:['course','deals','learn','live','mkt','money','psy','requests','team'], needs_code:[] },
  manager:{ role:'manager', name:'Mona K.', keys:['course','deals','learn','live','requests','team'], needs_code:['team'] },
  agent:{ role:'agent', name:'Sara R.', keys:['course','deals','learn'], needs_code:[] }
};
const member = me => ({ is_tracker_admin:false, my_profile:[{ name:me.name, company_id:1, company_name:'Sample Co', active:true }], portal_me:me,
  company_names:[], my_shifts:[], my_briefs:[], my_card:{ role:'member' }, fx_rate_on:50 });
const owner = { is_tracker_admin:true, portal_me:ME.owner, course_admin_waiting:[{}, {}], course_admin_learners:[], visit_stats:{}, portal_learner_progress:[] };
const ACQ = { title:'Acquisitions', totalModules:15, modules:[{ id:'m1', number:1, title:'Sample module', openForLearners:true, items:[] }] };

// name, url, window settings, who it is (for the expected Apps list)
const S = [
  ['app-owner', '/app/#live', { SB_SESSION:O, SB_AAL:'aal2', SB_RPC:owner, SB_FROM:{ shift_requests:[{}], hub_uploads:[{}, {}], companies:[], members:[] } }, 'owner'],
  ['app-manager', '/app/#live', { SB_SESSION:U, SB_RPC:Object.assign(member(ME.manager), {}), SB_FROM:{ shift_requests:[{}] } }, 'manager'],
  ['app-agent', '/app/', { SB_SESSION:U, SB_RPC:member(ME.agent) }, 'agent'],
  ['app-off', '/app/', { SB_SESSION:U, SB_RPC:{ is_tracker_admin:false, my_profile:[{ name:'Karim N.', active:false }] } }, 'off'],
  ['hub-owner', '/app/learn/', { HUB_TEST:{ owner:true, people:{ acq:2 }, waiting:4 }, PORTAL_TEST:{ role:'owner', counts:{ review:4, requests:1 } } }, 'owner'],
  ['hub-agent', '/app/learn/', { HUB_TEST:{ open:['acq'], prog:{ acq:{ done:3, total:15 } } }, PORTAL_TEST:Object.assign({}, ME.agent) }, 'agent'],
  ['mkt-agent', '/app/course/', { COURSE_TEST:{ content:'/__fake/mkt.json' }, PORTAL_TEST:Object.assign({}, ME.agent, { keys:['course','deals','learn','mkt'] }) }, 'agent'],
  ['psy-owner', '/app/psychology/', { PSY_TEST:{ owner:true, content:'/__fake/psy.json' }, PORTAL_TEST:{ role:'owner' } }, 'owner'],
  ['acq-agent', '/course/', { SB_SESSION:U, SB_RPC:{ course_state:ACQ, portal_me:ME.agent } }, 'agent'],
  ['acq-signedout', '/course/', { }, 'none']
];
// What the Apps menu should list for each person
const WANT = {
  owner:['Deal CRM','Land calculator','House calculator','Learning Hub','Review center','Team and shifts','Invite and access','Cash'],
  manager:['My hours','Deal CRM','Land calculator','House calculator','Learning Hub','Team and shifts'],
  agent:['My hours','Deal CRM','Land calculator','House calculator','Learning Hub']
};
const PSY = { title:{ en:'Psychology and Therapy', ar:'' }, modules:Array.from({ length:27 }, (_, i) => ({ id:'m' + (i + 1), num:i + 1, title:{ en:'Sample module ' + (i + 1) }, parts:[{ n:1, t:{ en:'Part one' } }],
  items:[{ id:(i + 1) + '.1', type:'lesson', title:{ en:'Sample lesson' } }, { id:(i + 1) + '.x', type:'exam', title:{ en:'Exam' }, exam:{ pass:16, q:{ en:[] } } }] })) };
const MKT = { modules:{}, sources:{}, case:{ main:{ name:'Sample business', about:'A stand-in case file.', facts:[['City','Sample']] }, b2b:{ about:'A stand-in second case.' } } };

(async () => {
  const browser = await chromium.launch(); let bad = 0; const log = [];
  const say = (ok, msg) => { if (!ok) bad++; log.push((ok ? 'ok   ' : 'FAIL ') + msg); console.log((ok ? 'ok   ' : 'FAIL ') + msg); };
  for (const W of [390, 1440]) for (const [name, url, init, who] of S) {
    const ctx = await browser.newContext({ viewport:{ width:W, height:W < 768 ? 844 : 900 }, serviceWorkers:'block', isMobile:W < 768, hasTouch:W < 768 });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    // swap the pinned supabase-js for the stand-in (same origin, so the page's CSP still applies unchanged)
    await ctx.route(u => /\/(app|course)\/((learn|course|psychology)\/)?(index\.html)?$/.test(new URL(u).pathname), async r => {
      const res = await r.fetch(); let b = await res.text();
      b = b.replace(/<script src="https:\/\/cdn\.jsdelivr[^>]*><\/script>/, '<script src="/__stub/sb.js"></script>');
      r.fulfill({ response:res, body:b });
    });
    await ctx.route('**/__stub/sb.js', r => r.fulfill({ contentType:'application/javascript', body:STUB }));
    await ctx.route('**/__fake/mkt.json', r => r.fulfill({ json:MKT }));
    await ctx.route('**/__fake/psy.json', r => r.fulfill({ json:PSY }));
    await ctx.addInitScript(o => { Object.assign(window, o); try { localStorage.clear(); } catch(e){} }, init);
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push('PAGE ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
    await p.goto(BASE + url); await p.waitForTimeout(1600);
    const tag = W + ' ' + name;
    const btn = p.locator('.p-apps-btn:visible');
    if (who === 'none' || who === 'off') {
      say(await btn.count() === 0, tag + ': no Apps menu before we know who this is');
    } else {
      say(await btn.count() === 1, tag + ': one Apps button');
      const wide = await p.evaluate(() => document.documentElement.scrollWidth);
      say(wide <= W, tag + ': nothing wider than the screen (' + wide + 'px)');
      const barH = await p.evaluate(() => Math.round(document.querySelector('.p-shelled').getBoundingClientRect().height));
      say(barH >= 56 && barH <= 70, tag + ': bar height ' + barH + 'px');
      if (OUT) { fs.mkdirSync(OUT, { recursive:true }); await p.screenshot({ path:path.join(OUT, name + '-' + W + '.png') }); }
      // keyboard: Enter opens and moves focus in, Escape closes and gives focus back
      await btn.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
      const st = await p.evaluate(() => { const m = document.querySelector('.p-apps:not([hidden])'); return m ? { items:[...m.querySelectorAll('.p-app b')].map(b => b.textContent),
        focusIn:m.contains(document.activeElement), pills:[...m.querySelectorAll('.p-pill, .p-app-note')].map(x => x.textContent), cur:(m.querySelector('[aria-current="page"] b') || {}).textContent || '',
        fits:m.getBoundingClientRect().right <= innerWidth && m.getBoundingClientRect().left >= 0 } : null; });
      say(!!st && st.focusIn, tag + ': Enter opens the menu and moves focus into it');
      say(!!st && JSON.stringify(st.items) === JSON.stringify(WANT[who]), tag + ': lists ' + (st ? st.items.join(', ') : 'nothing'));
      if (st) log.push('     notes: ' + (st.pills.join(', ') || 'none') + ' · current: ' + (st.cur || 'none'));
      say(!!st && st.fits, tag + ': menu fits on screen');
      if (OUT && st) await p.screenshot({ path:path.join(OUT, name + '-' + W + '-apps.png') });
      await p.keyboard.press('Escape'); await p.waitForTimeout(100);
      const closed = await p.evaluate(() => !document.querySelector('.p-apps:not([hidden])') && !!document.activeElement.closest('.p-apps-btn'));
      say(closed, tag + ': Escape closes it and focus goes back to Apps');
      const tap = await p.evaluate(() => [...document.querySelectorAll('.p-shelled button, .p-shelled a')].filter(e => e.offsetParent && !e.closest('.p-apps, .p-menu, .cp-langs')).map(e => { const r = e.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)) + ':' + (e.className || e.id); }).filter(x => +x.split(':')[0] < 40));
      say(!tap.length, tag + ': bar buttons at least 40px (the course language buttons are the page\'s own, left for round 6)' + (tap.length ? ' (small: ' + tap.join(', ') + ')' : ''));
    }
    say(!errs.length, tag + ': no console errors' + (errs.length ? ' (' + errs.join(' / ') + ')' : ''));
    await ctx.close();
  }
  if (OUT) fs.writeFileSync(path.join(OUT, 'shell-r3-output.txt'), log.join('\n') + '\n');
  await browser.close(); console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
})();
