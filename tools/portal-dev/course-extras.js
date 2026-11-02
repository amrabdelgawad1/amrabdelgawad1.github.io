// Acquisitions extras in /course/: the daily drill (Home card and #/drill), "Hear it on a real call" on a lesson,
// Daily drill in the sidebar, Admin's most-missed questions and the fast-track switch, at 390 and 1440, real CSP on.
//   python3 -m http.server 8702 &   (repo root)   then   node tools/portal-dev/course-extras.js http://localhost:8702 [screens folder]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [BASE, OUT] = process.argv.slice(2);
const STUB = fs.readFileSync(path.join(__dirname, 'stub-supabase.js'), 'utf8');
const q = (id, prompt, type) => ({ id, type:type || 'single', number:1, prompt, options:[{ id:'A', text:'Yes' }, { id:'B', text:'No' }] });
const MODS = [
  { id:'m1', number:1, title:'Foundations', open:true, openForLearners:true, checkpointOpen:false, items:[
    { id:'1.1', type:'lesson', title:'1.1 What Acquisitions Is', shortTitle:'1.1 What It Is', bodyMarkdown:'Plain English.\n\n**بالعربي، باختصار**\n\nالـ MAO هو أعلى سعر نقدر ندفعه.', quiz:{ id:'quiz-1.1', passMark:80, count:2, questions:[q('m1-q1', 'Q one'), q('m1-q2', 'Q two')] } },
    { id:'1.checkpoint', type:'checkpoint', title:'Module 1 Checkpoint', quiz:{ id:'cp1', passMark:85, count:0, questions:[] } }] },
  { id:'m2', number:2, title:'How People Decide', open:false, openForLearners:false, checkpointOpen:false, items:[] }];
const STATE = admin => ({ title:'Acquisitions Playbook', totalModules:20, isAdmin:admin, me:{ id:'u1', name:'Sara R.' }, modules:MODS, done:{}, quizzes:{ 'm1/1.1':{ passed:true, best:100, tries:1, latest:{ id:'a1', score:100, passed:true } } }, submissions:{} });
const DRILL = { done:false, streak:3, days:5, fastTrack:true, questions:[q('m1/1.1/m1-q1', 'Is this the first?'), q('m1-q2', 'Pick both', 'multiple'), q('m1-q3', 'Third'), q('m1-q4', 'Fourth'), q('m1-q5', 'Fifth')].map(x => Object.assign(x, { module:'m1', lesson:'1.1' })) };
const RESULT = { correct:4, total:5, streak:4, results:DRILL.questions.map((x, i) => ({ id:x.id, right:i !== 1, explanation:'Because ' + i, module:'m1', lesson:'1.1' })) };
const HEAR = [{ entry_id:1, kind:'objection', title:'Your offer is too low', body:'I hear you. What number works for you?', why:'Gets their number first.', why_ar:'يخلي البايع يقول رقمه الأول', calls:[{ path:'u/calls/x.m4a', title:'Real call, Oct 2026', total:47 }] }];
const MISSED = [{ module_id:'m1', item_id:'1.1', question_id:'m1-q2', prompt:'Q two', tries:4, missed:3 }];
const LEARNER = { name:'Sara R.', email:'sara@example.com', modules:[{ number:1, title:'Foundations', open:true, done:2, total:5 }], submissions:[], attempts:[] };
const T = [
  { name:'home', url:'/course/#/', rpc:{ course_state:STATE(false), course_drill_today:DRILL },
    run: async (p, ok) => {
      ok(/Daily drill/.test(await p.textContent('#drillCard')) && /Streak: 3 days/.test(await p.textContent('#drillCard')), 'Home shows the drill card with the streak');
      ok(/Fast track is on/.test(await p.textContent('#drillCard')), 'and the fast-track note');
      ok(await p.locator('.cp-tool[href="#/drill"]').count() === 1, 'Daily drill is in the sidebar');
    } },
  { name:'home-done', url:'/course/#/', rpc:{ course_state:STATE(false), course_drill_today:{ done:true, score:4, total:5, streak:6, questions:[] } },
    run: async (p, ok) => { ok(/done for today/.test(await p.textContent('#drillCard')) && /4 of 5/.test(await p.textContent('#drillCard')), 'after the drill: done for today, 4 of 5'); } },
  { name:'drill', url:'/course/#/drill', rpc:{ course_state:STATE(false), course_drill_today:DRILL, course_drill_submit:RESULT },
    run: async (p, ok) => {
      ok(await p.locator('.drill-q').count() === 5, 'five questions');
      await p.click('#drCheck');
      ok(/Answer every question first \(5 left\)/.test(await p.textContent('#drMsg')), 'can’t check with blanks');
      const qs = p.locator('.drill-q'); for (let i = 0; i < 5; i++) await qs.nth(i).locator('label.opt').first().click();
      await p.click('#drCheck'); await p.waitForTimeout(300);
      const call = await p.evaluate(() => SB_CALLS.find(c => c[1] === 'course_drill_submit'));
      ok(call && Object.keys(call[2].p_picks).length === 5 && call[2].p_picks['m1/1.1/m1-q1'][0] === 'A', 'sends all five picks');
      ok(/4 of 5 right/.test(await p.textContent('#drMsg')) && await p.locator('.verdict.no').count() === 1 && /Go back to Lesson 1.1/.test(await p.textContent('.verdict.no')), 'shows the score, which were wrong and a link back to the lesson');
    } },
  { name:'lesson', url:'/course/#/m/m1/l/1.1', rpc:{ course_state:STATE(false), library_for_lesson:HEAR },
    run: async (p, ok) => {
      ok(/Hear it on a real call/.test(await p.textContent('#hearBox')) && /What number works/.test(await p.textContent('#hearBox')), 'the lesson shows its library entry');
      ok(await p.evaluate(() => [...document.querySelectorAll('.prose p')].some(x => x.getAttribute('dir') === 'auto' && getComputedStyle(x).direction === 'rtl')), 'the Arabic note reads right to left');
    } },
  { name:'lesson-none', url:'/course/#/m/m1/l/1.1', rpc:{ course_state:STATE(false) },
    run: async (p, ok) => { ok((await p.textContent('#hearBox')).trim() === '', 'no library access or no entries: nothing shows'); } },
  { name:'admin-missed', url:'/course/#/admin/missed', rpc:{ course_state:STATE(true), course_missed_questions:MISSED },
    run: async (p, ok) => { ok(/Missed by 3 of 4 \(75%\)/.test(await p.textContent('main')) && /Q two/.test(await p.textContent('main')), 'Admin: most-missed list with the rate'); } },
  { name:'admin-learner', url:'/course/#/admin/u/u1', rpc:{ course_state:STATE(true), course_admin_learner:LEARNER, course_fast_track_set:true }, from:{ course_fast_track:[] },
    run: async (p, ok) => {
      ok(/Turn the fast track on/.test(await p.textContent('#ftBtn')), 'the learner page shows the fast-track switch, off');
      await p.click('#ftBtn'); await p.waitForTimeout(300);
      const call = await p.evaluate(() => SB_CALLS.find(c => c[1] === 'course_fast_track_set'));
      ok(call && call[2].p_user === 'u1' && call[2].p_on === true && /off/.test(await p.textContent('#ftBtn')), 'turning it on sends the person, and the button flips');
    } }
];
(async () => {
  const browser = await chromium.launch(); let bad = 0; const log = [];
  for (const W of [390, 1440]) for (const t of T) {
    const ctx = await browser.newContext({ viewport:{ width:W, height:W < 768 ? 844 : 900 }, serviceWorkers:'block', isMobile:W < 768, hasTouch:W < 768 });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await ctx.route(u => /\/course\/(index\.html)?$/.test(new URL(u).pathname), async r => {
      const res = await r.fetch(); const b = await res.text();
      r.fulfill({ response:res, body:b.replace(/<script src="https:\/\/cdn\.jsdelivr[^>]*><\/script>/, '<script src="/__stub/sb.js"></script>') });
    });
    await ctx.route('**/__stub/sb.js', r => r.fulfill({ contentType:'application/javascript', body:STUB }));
    await ctx.addInitScript(o => { Object.assign(window, o); try { localStorage.clear(); } catch(e){} }, { SB_SESSION:{ user:{ id:'u1', email:'sara@example.com' } }, SB_AAL:'aal2', SB_RPC:t.rpc, SB_FROM:t.from || {} });
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push('PAGE ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
    await p.goto(BASE + t.url); await p.waitForTimeout(1500);
    const tag = W + ' ' + t.name;
    const ok = (c, msg) => { if (!c) bad++; const l = (c ? 'ok   ' : 'FAIL ') + tag + ': ' + msg; log.push(l); console.log(l); };
    if (OUT) { fs.mkdirSync(OUT, { recursive:true }); await p.screenshot({ path:path.join(OUT, 'course-' + t.name + '-' + W + '.png'), fullPage:true }); }
    const wide = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(wide <= W, 'nothing wider than the screen (' + wide + 'px)');
    try { await t.run(p, ok, W); } catch(e) { ok(false, 'check crashed: ' + e.message.split('\n')[0]); }
    const small = await p.evaluate(() => [...document.querySelectorAll('#drillCard a, #drillCard button, .drill-q label, #drCheck, #ftBtn, .bar-foot .btn')].filter(e => e.offsetParent).map(e => [e.textContent.trim().slice(0, 24), Math.round(e.getBoundingClientRect().height)]).filter(x => x[1] < 44));
    ok(!small.length, 'tap targets at least 44px' + (small.length ? ' (small: ' + small.map(x => x.join(' ')).join(', ') + ')' : ''));
    ok(!errs.length, 'no console errors' + (errs.length ? ' (' + errs.join(' / ') + ')' : ''));
    await ctx.close();
  }
  await browser.close(); console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
})();
