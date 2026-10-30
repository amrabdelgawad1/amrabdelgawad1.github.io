// Round 5 checks: Invite and access on roles (screen 8), at 390 and 1440, real CSP on.
//   python3 -m http.server 8702 &   (repo root)   then   node tools/portal-dev/people-r5.js http://localhost:8702 [screens folder]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [BASE, OUT] = process.argv.slice(2);
const STUB = fs.readFileSync(path.join(__dirname, 'stub-supabase.js'), 'utf8');
const O = { user:{ id:'o1', email:'owner@example.com' } };
const AGENT_NG = ['course', 'deals', 'learn'];
const MEMBERS = [
  { user_id:'u1', name:'Sara R.', email:'sara@example.com', active:true, role:'agent', access:[], not_given:AGENT_NG, company_id:1, created_at:'2026-09-01', agent_id:1 },
  { user_id:'u2', name:'Mona K.', email:'mona@example.com', active:true, role:'manager', access:[], not_given:[], company_id:1, created_at:'2026-10-02' },
  { user_id:'u3', name:'Youssef H.', email:'youssef@example.com', active:true, role:'agent', access:['learn', 'mkt'], not_given:['course', 'deals'], company_id:1, created_at:'2026-10-03' },
  { user_id:'u4', name:'Omar T.', email:'omar@example.com', active:true, role:'agent', access:[], not_given:[], company_id:1, created_at:'2026-10-05' },
  { user_id:'u5', name:'Abdullah M.', email:'abdullah@example.com', active:true, role:'agent', access:[], not_given:AGENT_NG, company_id:1, created_at:'2026-08-01' },
  { user_id:'u6', name:'Karim N.', email:'karim@example.com', active:false, role:'agent', access:[], not_given:AGENT_NG, company_id:1, created_at:'2026-07-01' }
];
const LOG = [
  { id:3, at:'2026-10-28T10:00:00Z', actor:'o1', target:'u3', change:{ access:{ from:[], to:['learn', 'mkt'] }, not_given:{ from:AGENT_NG, to:['course', 'deals'] } } },
  { id:2, at:'2026-10-20T10:00:00Z', actor:'o1', target:'u6', change:{ active:{ from:true, to:false } } },
  { id:1, at:'2026-10-05T10:00:00Z', actor:null, target:'u4', change:{ added:{ role:'agent', access:[], not_given:[], active:true } } }
];
const init = extra => Object.assign({ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:{ is_tracker_admin:true, portal_me:{ role:'owner', keys:['course','deals','learn','live','mkt','money','psy','requests','team'], needs_code:[] } },
  SB_FROM:{ members:MEMBERS, access_log:LOG, companies:[{ id:1, name:'Sample Co' }], agents:[], agent_companies:[] }, SB_INVOKE:{ 'team-access':{ sent:true } } }, extra || {});
const text = (p, sel) => p.evaluate(s => (document.querySelector(s) || {}).innerText || '', sel);
const pick = async (p, id) => { if (await p.isVisible('.pp-back')) { await p.click('.pp-back'); await p.waitForTimeout(200); } await p.click('.pp-row[data-id="' + id + '"]'); await p.waitForTimeout(400); };
const writes = p => p.evaluate(() => SB_CALLS.filter(c => c[0] === 'update' || c[0] === 'invoke').map(c => c[1] + ':' + JSON.stringify(c[2])));
const T = [
  { name:'list', run: async (p, ok, W) => {
      ok(await p.evaluate(() => [...document.querySelectorAll('.pp-filters button')].map(b => b.textContent).join(',')) === 'All 6,Agents 4,Managers 1,Off 1', 'filters: All 6, Agents 4, Managers 1, Off 1');
      ok(/Mona K\.[\s\S]*Manager/.test(await text(p, '#ppRows')) && /Karim N\.\s*Turned off Oct 20\s*Off/.test(await text(p, '#ppRows')), 'role pills, and when someone was turned off');
      await p.click('.pp-filters [data-f="manager"]');
      ok(await p.evaluate(() => [...document.querySelectorAll('.pp-row b')].map(b => b.textContent).join(',')) === 'Mona K.', 'Managers filter shows only managers');
      await p.click('.pp-filters [data-f="off"]');
      ok(await p.evaluate(() => [...document.querySelectorAll('.pp-row b')].map(b => b.textContent).join(',')) === 'Karim N.', 'Off filter shows only people turned off');
      await p.click('.pp-filters [data-f="all"]'); await p.fill('#ppQ', 'you');
      ok(await p.evaluate(() => [...document.querySelectorAll('.pp-row b')].map(b => b.textContent).join(',')) === 'Youssef H.', 'find a person by name');
      await p.fill('#ppQ', '');
      if (W > 900) ok(!!(await p.$('.pp-row[aria-current="true"]')), 'on PC the first person opens straight away');
      else ok(await p.isHidden('#ppDetail'), 'on a phone the list comes first');
    } },
  { name:'agent-today', run: async (p, ok) => {
      await pick(p, 'u1');
      ok(await p.evaluate(() => document.querySelector('input[name=ppRole][value=agent]').checked && document.querySelector('input[name=ppRole][value=owner]').disabled && document.querySelector('input[name=ppRole][value=student]').disabled), 'Agent chosen; Owner and Student can’t be picked');
      const ex = await text(p, '#ppDetail .pp-sec:nth-of-type(2)');
      ok(/Acquisitions course\s*Comes with Agent, not turned on yet/.test(ex) && /calculators\s*Comes with Agent, not turned on yet/.test(ex), 'today’s agent: role keys not turned on yet, and can be ticked');
      ok(await p.evaluate(() => ['course', 'deals', 'mkt', 'psy'].every(k => { const i = document.querySelector('.pp-extra input[value="' + k + '"]'); return !i.checked && !i.disabled; })), 'nothing ticked, everything can be ticked');
      ok(/^Clock in and my hours$/.test((await text(p, '.pp-chips')).trim()), 'What Sara will see: only her hours');
      ok(await p.isDisabled('[data-act="save"]'), 'Save waits for a change');
      await p.check('.pp-extra input[value="course"]'); await p.check('.pp-extra input[value="mkt"]');
      const see = await text(p, '.pp-chips');
      ok(/Acquisitions course/.test(see) && /Marketing course/.test(see) && !/Psychology/.test(see), 'preview follows the ticks');
      await p.click('[data-act="save"]'); await p.waitForTimeout(600);
      const w = await writes(p);
      ok(w.some(x => x === 'members:{"role":"agent","access":["mkt"],"not_given":["deals"],"company_id":1,"deals_until":null,"deals_mfa":false}'), 'saves role, extras and not_given in one change: ' + w.join(' '));
      ok(w.some(x => x === 'agents:{"role":"member"}'), 'agent card role kept in step');
    } },
  { name:'manager', run: async (p, ok) => {
      await pick(p, 'u2');
      ok(await p.evaluate(() => ['course', 'deals'].every(k => { const i = document.querySelector('.pp-extra input[value="' + k + '"]'); return i.checked && i.disabled; })), 'role-included extras are ticked and greyed');
      ok(/Comes with Manager/.test(await text(p, '#ppDetail .pp-sec:nth-of-type(2)')), 'says they come with Manager');
      const see = await text(p, '.pp-chips');
      ok(/Live now/.test(see) && /approves them/.test(see) && /Everyone’s hours/.test(see) && /Learner progress/.test(see) && !/Money/.test(see), 'manager preview: Live now, approves requests, hours, learner progress, no money');
    } },
  { name:'role-change', run: async (p, ok) => {
      await pick(p, 'u4');
      await p.check('input[name=ppRole][value=manager]');
      ok(/Live now/.test(await text(p, '.pp-chips')) && await p.isEnabled('[data-act="save"]'), 'switching to Manager updates the preview');
      await p.click('[data-act="save"]'); await p.waitForTimeout(600);
      ok((await writes(p)).some(x => /^members:\{"role":"manager","access":\[\],"not_given":\[\]/.test(x)), 'saves the new role');
    } },
  { name:'log', run: async (p, ok) => {
      await pick(p, 'u3');
      const l = await text(p, '.pp-log');
      ok(/Oct 28\s*Learning Hub added, Marketing course added, Learning Hub turned on by Amr|Marketing course added/.test(l) && /by Amr/.test(l), 'access log in words, with who: ' + l.split('\n').slice(1, 2).join(''));
      await pick(p, 'u4');
      ok(/Invited as Agent by the system/.test(await text(p, '.pp-log')), 'an invite from the invite service is logged');
    } },
  { name:'turn-off', run: async (p, ok) => {
      await pick(p, 'u5');
      await p.click('[data-act="remove"]'); await p.waitForTimeout(300);
      ok(/Turn off Abdullah M\.’s access\?/.test(await p.evaluate(() => (document.querySelector('dialog.ask[open]') || {}).innerText || '')), 'asks before turning off');
      await p.click('dialog.ask[open] .ask-ok'); await p.waitForTimeout(600);
      ok((await writes(p)).some(x => x === 'team-access:{"body":{"action":"remove","user_id":"u5","via":null}}'), 'turns off through team-access, as before');
      await pick(p, 'u6');
      ok(/turned off/.test(await text(p, '.pp-offnote')) && await p.isVisible('[data-act="restore"]') && await p.evaluate(() => [...document.querySelectorAll('#ppDetail input')].every(i => i.disabled)), 'someone off: says so, can be turned back on, nothing else editable');
    } },
  { name:'invite', run: async (p, ok) => {
      await p.click('#ppInviteBtn');
      await p.fill('#ppInvName', 'Laila B.'); await p.fill('#ppInvEmail', 'laila@example.com'); await p.check('input[name=ppInvRole][value=manager]');
      await p.click('#ppInvForm [data-via="email"]'); await p.waitForTimeout(700);
      const w = await writes(p);
      ok(w.some(x => x === 'team-access:{"body":{"action":"invite","name":"Laila B.","email":"laila@example.com","company_id":1,"via":"email"}}') && w.some(x => x === 'members:{"role":"manager"}'), 'invite goes through team-access unchanged, then the role is set: ' + w.join(' '));
      await p.click('#ppInviteBtn'); await p.click('#ppInviteBtn'); await p.fill('#ppInvName', 'X'); await p.click('#ppInvForm [data-via="email"]');
      ok(/full name/.test(await text(p, '#ppInvErr')), 'checks the name first');
    } },
  { name:'phone-back', phoneOnly:true, run: async (p, ok) => {
      await pick(p, 'u1');
      ok(await p.isHidden('.pp-list') && await p.isVisible('.pp-back'), 'phone: the person replaces the list, with a way back');
      await p.click('.pp-back'); await p.waitForTimeout(300);
      ok(await p.isVisible('.pp-list') && await p.isHidden('#ppDetail'), 'phone: back to the list');
    } },
  { name:'deep-link', url:'/app/#people/u3', run: async (p, ok) => {
      ok(/Youssef H\./.test(await text(p, '.pp-top')), '#people/<user> opens that person');
    } },
  { name:'agent-blocked', url:'/app/#people', init:{ SB_SESSION:{ user:{ id:'u1', email:'sara@example.com' } }, SB_AAL:'aal1',
      SB_RPC:{ is_tracker_admin:false, my_profile:[{ name:'Sara R.', company_id:1, active:true }], portal_me:{ role:'agent', keys:['course','deals','learn'], needs_code:[] }, my_shifts:[], my_briefs:[], company_names:[] } }, run: async (p, ok) => {
      ok(await p.evaluate(() => location.hash) === '#home', 'an agent opening #people lands on their home');
    } }
];
(async () => {
  const browser = await chromium.launch(); let bad = 0; const log = [];
  for (const W of [390, 1440]) for (const t of T) {
    if (t.phoneOnly && W > 900) continue;
    const ctx = await browser.newContext({ viewport:{ width:W, height:W < 768 ? 844 : 900 }, serviceWorkers:'block', isMobile:W < 768, hasTouch:W < 768 });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await ctx.route(u => /\/app\/(index\.html)?$/.test(new URL(u).pathname), async r => {
      const res = await r.fetch(); const b = await res.text();
      r.fulfill({ response:res, body:b.replace(/<script src="https:\/\/cdn\.jsdelivr[^>]*><\/script>/, '<script src="/__stub/sb.js"></script>') });
    });
    await ctx.route('**/__stub/sb.js', r => r.fulfill({ contentType:'application/javascript', body:STUB }));
    await ctx.addInitScript(o => { Object.assign(window, JSON.parse(JSON.stringify(o))); try { localStorage.clear(); } catch(e){} }, t.init || init());
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push('PAGE ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
    await p.goto(BASE + (t.url || '/app/#people')); await p.waitForTimeout(1500);
    const tag = W + ' ' + t.name;
    const ok = (c, msg) => { if (!c) bad++; const l = (c ? 'ok   ' : 'FAIL ') + tag + ': ' + msg; log.push(l); console.log(l); };
    try { await t.run(p, ok, W); } catch(e) { ok(false, 'check crashed: ' + e.message.split('\n')[0]); }
    if (OUT) { fs.mkdirSync(OUT, { recursive:true }); await p.screenshot({ path:path.join(OUT, t.name + '-' + W + '.png'), fullPage:true }); }
    const wide = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(wide <= W, 'nothing wider than the screen (' + wide + 'px)');
    const small = await p.evaluate(() => [...document.querySelectorAll('#pPeople button, #pPeople a, #pPeople label')].filter(e => e.offsetParent && !e.closest('.pp-loglist') && !e.classList.contains('p-vh')).map(e => { const r = e.getBoundingClientRect(); return [Math.round(Math.min(r.width, r.height)), (e.textContent || '').trim().slice(0, 20)]; }).filter(x => x[0] < 40));
    ok(!small.length, 'tap targets at least 40px' + (small.length ? ' (small: ' + small.map(x => x.join(' ')).join(', ') + ')' : ''));
    ok(!errs.length, 'no console errors' + (errs.length ? ' (' + errs.join(' / ') + ')' : ''));
    await ctx.close();
  }
  if (OUT) fs.writeFileSync(path.join(OUT, 'people-r5-output.txt'), log.join('\n') + '\n');
  await browser.close(); console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
})();
