// Round 4 checks: the Team home, Amr's Portal view and Admin overview, Learner progress, the dark sidebar and the
// Portal / Admin switch, as owner, manager, agent, at 390 and 1440. Real CSP on (the stand-in Supabase is same-origin).
//   python3 -m http.server 8702 &   (repo root)   then   node tools/portal-dev/homes-r4.js http://localhost:8702 [screens folder]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [BASE, OUT] = process.argv.slice(2);
const iso = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const STUB = fs.readFileSync(path.join(__dirname, 'stub-supabase.js'), 'utf8');
const O = { user:{ id:'o1', email:'owner@example.com' } }, U = { user:{ id:'u1', email:'sara@example.com' } };
const ME = { manager:{ role:'manager', keys:['course','deals','learn','live','requests','team'], needs_code:['team'] }, agent:{ role:'agent', keys:['course','deals','learn'], needs_code:[] } };
const member = (me, name, co) => ({ is_tracker_admin:false, my_profile:[{ name, company_id:co === undefined ? 1 : co, company_name:'Sample Co', active:true }], portal_me:Object.assign({ name }, me),
  company_names:[], my_shifts:[], my_briefs:[], my_card:{ role:'member' }, fx_rate_on:50,
  course_state:{ totalModules:15, modules:[{ id:'m1', number:1, title:'Finding sellers', openForLearners:true }, { id:'m2', number:2, title:'Getting their number', openForLearners:true }, { id:'m3', number:3, title:'Offers', openForLearners:false }] },
  portal_learner_progress:[{ user_id:'u2', name:'Youssef H.', course:'mkt2', passed:2, sent:1, updated_at:new Date().toISOString() }] });
const EOD = [{ user_id:'u1', name:'Sara R.', status:'missing', worked_seconds:10800, shifts:2, with_report:1, dials:40, conversations:5, offers:1, appointments:1, reports:[{ note:'Two good talks.\nOne appointment set.' }] },
  { user_id:'u3', name:'Omar T.', status:'on_shift', worked_seconds:0, shifts:0, with_report:0, dials:12, conversations:1, offers:0, appointments:0, reports:[] },
  { user_id:'u2', name:'Youssef H.', status:'sent', worked_seconds:14400, shifts:1, with_report:1, dials:55, conversations:6, offers:0, appointments:2, reports:[{ note:'<b>Slow</b> morning.' }] },
  { user_id:'u4', name:'Mona K.', status:'off', worked_seconds:0, shifts:0, with_report:0, dials:0, conversations:0, offers:0, appointments:0, reports:[] }];
const owner = { is_tracker_admin:true, portal_eod:EOD, portal_me:{ role:'owner', keys:['course','deals','learn','live','mkt','money','psy','requests','team'], needs_code:[] }, course_admin_waiting:[{ userId:'u1', title:'Module 1 drill' }], visit_stats:{ visitors:1234 },
  course_admin_learners:[{ userId:'u1', name:'Sara R.', done:3, total:15, module:2, lastActive:new Date().toISOString() }],
  portal_learner_progress:[{ user_id:'u2', name:'Youssef H.', course:'mkt2', passed:2, sent:1, updated_at:new Date().toISOString() }] };
const ownerFrom = { commissions:[{ amount:2000, status:'owed' }, { amount:500.5, status:'owed' }], deals:[{ inspection_ends:iso(3), closing_on:iso(10) }, { inspection_ends:iso(-5), closing_on:iso(30) }, { inspection_ends:null, closing_on:null }], members:[{ user_id:'u1', name:'Sara R.', active:true }, { user_id:'u2', name:'Youssef H.', active:true }], companies:[], live_status:[{ user_id:'u1' }],
  shift_requests:[{ id:1, name:'Sara R.', shift_date:'2026-10-27', user_id:'u1' }], hub_uploads:[{ id:'h1', user_id:'u2', title:'Call recording', course:'mkt', module:'m3' }], code_live_status:[] };

const sideOf = p => p.evaluate(() => { const d = document.getElementById('drawer'); if (!d || d.hidden) return null;
  const out = []; let g = '';
  d.querySelectorAll('.sec, .mi').forEach(e => { if (e.hidden || e.closest('[hidden]') || e.closest('.bottom') || e.closest('.sub')) return; if (e.classList.contains('sec')) g = e.textContent.trim(); else out.push((g ? g + ':' : '') + e.textContent.trim().replace(/\s*\d+( waiting)?$/, '')); });
  return out; });
const fontOf = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontFamily : ''; }, sel);
const tvRows = [{ user_id:'oid', name:'Amr', role:'owner', on_shift:false, worked_seconds:0, days_worked:0, dials:0, conversations:0, offers:0, appointments:0, notes_missing:0, deals_open:1, deals_contract:0, deals_closed:0, followups_late:0, lessons:0, drills:0, last_active:null },
  { user_id:'u1', name:'Sara R.', role:'agent', on_shift:true, worked_seconds:18000, days_worked:2, dials:81, conversations:10, offers:1, appointments:3, notes_missing:1, deals_open:2, deals_contract:1, deals_closed:1, followups_late:1, lessons:4, drills:1, last_active:new Date(Date.now() - 300000).toISOString() },
  { user_id:'u2', name:'Youssef H.', role:'manager', on_shift:false, worked_seconds:3600, days_worked:1, dials:12, conversations:2, offers:0, appointments:0, notes_missing:0, deals_open:0, deals_contract:0, deals_closed:0, followups_late:0, lessons:0, drills:0, last_active:new Date(Date.now() - 3 * 86400000).toISOString() }];
const scRows = [
  { id:'c3', user_id:'u1', title:'Roleplay: Inherited land', status:'waiting', score:null, real_call:false, scenario_id:1, created_at:'2026-10-30T10:00:00Z' },
  { id:'c2', user_id:'u1', title:'Ross County seller', status:'approved', score:{ cats:[5,4,4,5,4,4,4,2,4,4], total:40 }, real_call:true, scenario_id:null, created_at:'2026-10-28T10:00:00Z' },
  { id:'c1', user_id:'u1', title:'Roleplay: Inherited land', status:'approved', score:{ cats:[4,3,3,4,3,3,3,2,3,2], total:30 }, real_call:false, scenario_id:1, created_at:'2026-10-20T10:00:00Z' }];
const scScen = [{ id:1, title:'Inherited land', kind:'land', level:'easy', seller:'Linda, inherited 12 acres', know:'Ross County, OH. Taxes are behind.', goal:'Her number and a callback time.', hidden:'She wants $40,000 but will take $25,000.', active:true }];
const obRows = [{ item_id:1, grp:'Paperwork', title:'Agreement signed', auto:null, done:true, done_at:'2026-10-30T10:00:00Z' }, { item_id:2, grp:'Paperwork', title:'Payment details on file (kept outside the portal)', auto:null, done:false, done_at:null },
  { item_id:4, grp:'Tools', title:'Signed in to the portal', auto:'signed_in', done:true, done_at:null }, { item_id:6, grp:'Tools', title:'Deal CRM opened with the team passphrase', auto:'crm_ready', done:false, done_at:null },
  { item_id:12, grp:'Going live', title:'First shift logged', auto:'first_shift', done:false, done_at:null }];
const lbRows = [
  { id:1, kind:'objection', section:'Price', title:'Your offer is too low', body:'I hear you. What number would work for you?', why:'Gets their number first.', why_ar:'يخلي البائع يقول رقمه الأول', state_notes:[{ state:'OH', note:'Ohio sellers expect the auditor value.' }], parts:[6, 8], applies:'both', sort:10, active:true, version:2 },
  { id:2, kind:'script', section:'Opening', title:'First call opener', body:'Hi, this is Sara with ...', why:'', why_ar:'', state_notes:[], parts:[1], applies:'both', sort:10, active:true, version:1 },
  { id:3, kind:'objection', section:'Timing', title:'It is already listed', body:'Got it. When does the listing end?', why:'', why_ar:'', state_notes:[], parts:[8], applies:'land', sort:20, active:true, version:1 }];
const T = [
  { name:'owner-back', url:'/app/#admin', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:Object.assign({}, owner, { portal_team_overview:tvRows, portal_onboarding_summary:[], library_heard_counts:[], library_example_calls:[] }), SB_FROM:Object.assign({}, ownerFrom, { library_entries:[] }) }, run: async (p, ok, W) => {
      await p.waitForTimeout(500);
      ok(await p.evaluate(() => { const b = document.querySelector('.p-back'); return !!b && b.hidden; }), 'no Back on the first page of the visit');
      await p.evaluate(() => { location.hash = '#teamview'; }); await p.waitForTimeout(400);
      await p.evaluate(() => { location.hash = '#library'; }); await p.waitForTimeout(400);
      ok(await p.isVisible('.p-back') && await p.getAttribute('.p-back', 'aria-label') === 'Back to the page before', 'after moving on, Back shows in the top bar');
      ok(await p.evaluate(() => document.querySelector('.p-back').getBoundingClientRect().height >= 44), 'Back is at least 44px');
      await p.click('.p-back'); await p.waitForTimeout(500);
      ok(await p.evaluate(() => location.hash) === '#teamview' && /Team overview/.test(await p.textContent('#title')), 'Back goes to the page before: Team overview');
      await p.click('.p-back'); await p.waitForTimeout(500);
      ok(await p.evaluate(() => location.hash) === '#admin' && await p.isHidden('.p-back'), 'and Back again to the Admin overview, where Back goes away');
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the top bar still fits with Back in it');
    } },
  { name:'agent-library', url:'/app/#library', init:{ SB_SESSION:U, SB_RPC:Object.assign(member(ME.agent, 'Sara R.'), { library_heard_counts:[{ entry_id:1, heard:12, mine:3 }], library_example_calls:[{ entry_id:1, upload_id:'x1', path:'u2/calls/g.m4a', title:'Great call', total:47, rep:'Youssef', created_at:'2026-10-29T10:00:00Z' }] }),
      SB_FROM:{ live_status:[], library_entries:lbRows, library_reads:[{ entry_id:1, version:1 }], library_versions:[{ entry_id:1, version:1, body:'Old wording.', replaced_at:'2026-10-30T10:00:00Z' }] } }, run: async (p, ok, W) => {
      await p.waitForSelector('.lb-entry', { timeout:8000 }).catch(() => {});
      let t = await p.evaluate(() => document.getElementById('lbList').innerText);
      ok(/Scripts and objections/.test(await p.textContent('#title')) && /PRICE|Price/.test(t) && /“Your offer is too low”[\s\S]*Updated[\s\S]*Heard 12[\s\S]*Example/.test(t), 'the library lists entries by section, with Updated, Heard and Example');
      await p.fill('#lbQ', 'listed'); await p.waitForTimeout(100);
      t = await p.evaluate(() => document.getElementById('lbList').innerText);
      ok(/already listed/.test(t) && !/too low/.test(t), 'quick find: “listed” finds the listing objection only');
      await p.fill('#lbQ', ''); await p.click('[data-filter="updated"]'); await p.waitForTimeout(100);
      t = await p.evaluate(() => document.getElementById('lbList').innerText);
      ok(/too low/.test(t) && !/opener|listed/.test(t), 'Updated shows only what changed since you read it');
      await p.click('[data-filter="all"]'); await p.click('[data-open="1"]'); await p.waitForTimeout(300);
      t = await p.evaluate(() => document.querySelector('.lb-entry.is-open').innerText);
      ok(/changed since you last read it/.test(t) && /What number would work for you\?/.test(t) && /Gets their number first/.test(t) && /OH Ohio sellers expect the auditor value/.test(t) && /Trains: Getting their number · Objection handling/.test(t),
        'an entry: the words, why it works, state notes, the scorecard parts it trains');
      ok(await p.evaluate(() => { const a = document.querySelector('.lb-ar'); return a && a.dir === 'rtl' && a.lang === 'ar'; }), 'the Arabic explanation reads right to left');
      ok(/Great call · Youssef · 47 of 50/.test(t) && await p.evaluate(() => !!document.querySelector('.lb-ex audio')), 'an example recording from the team’s best calls');
      ok(/Earlier wording \(1\)/.test(t), 'earlier wording is kept');
      ok(await p.evaluate(() => SB_CALLS.some(c => c[0] === 'upsert' && c[1] === 'library_reads' && c[2].entry_id === 1 && c[2].version === 2)), 'opening it marks the new version read');
      await p.click('[data-heard="1"]'); await p.waitForTimeout(200);
      ok(await p.evaluate(() => SB_CALLS.some(c => c[0] === 'insert' && c[1] === 'library_heard' && c[2].entry_id === 1)) && /13 times[\s\S]*4 on your calls[\s\S]*Counted/.test(await p.textContent('#lbHeard1')), 'A seller said this: counted, 13 for the team, 4 yours');
      ok(await p.getAttribute('.lb-entry.is-open a[href^="#scoring"]', 'href') === '#scoring/obj-1', 'Practice this opens Call scoring for this objection');
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'nothing wider than the screen');
      const small = await p.evaluate(() => [...document.querySelectorAll('#pView button, #pView a.p-btn, #pView input, #pView summary')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).map(e => e.id || e.className));
      ok(!small.length, 'buttons, chips and search at least 44px ' + small.join(' '));
      ok(!(await p.$('#lfSave')), 'a rep has no editor');
    } },
  { name:'agent-library-part', url:'/app/#library/part-6', init:{ SB_SESSION:U, SB_RPC:Object.assign(member(ME.agent, 'Sara R.'), { library_heard_counts:[], library_example_calls:[] }), SB_FROM:{ live_status:[], library_entries:lbRows } }, run: async (p, ok) => {
      await p.waitForSelector('.lb-entry', { timeout:8000 }).catch(() => {});
      const t = await p.evaluate(() => document.getElementById('pView').innerText);
      ok(/Showing what trains Getting their number/.test(t) && /too low/.test(t) && !/opener|listed/.test(t), 'from a weak scorecard part: only what trains it');
    } },
  { name:'agent-practice-obj', url:'/app/#scoring/obj-1', init:{ SB_SESSION:U, SB_RPC:member(ME.agent, 'Sara R.'), SB_FROM:{ live_status:[], roleplay_scenarios:scScen, hub_uploads:scRows, hub_upload_comments:[], library_entries:lbRows } }, run: async (p, ok) => {
      await p.waitForFunction(() => /Objection:/.test((document.getElementById('scTitle') || {}).value || ''), null, { timeout:8000 }).catch(() => {});
      ok(await p.inputValue('#scTitle') === 'Objection: Your offer is too low' && /answer to “Your offer is too low”/.test(await p.inputValue('#scNote')) && await p.getAttribute('[data-kind="roleplay"]', 'aria-pressed') === 'true', 'Practice this: a roleplay on that objection, title and note filled in');
      ok(await p.evaluate(() => [...document.querySelectorAll('.sc-cat.is-weak a')].map(a => a.getAttribute('href')).join(',')) === '#library/part-8,#library/part-10', 'the weakest parts link to the library for that part');
    } },
  { name:'owner-library', url:'/app/#library', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:Object.assign({}, owner, { library_heard_counts:[{ entry_id:1, heard:12, mine:0 }, { entry_id:3, heard:5, mine:0 }], library_example_calls:[] }),
      SB_FROM:Object.assign({}, ownerFrom, { library_entries:lbRows, library_reads:[], library_versions:[], hub_uploads:[{ id:'g1', title:'Great call', score:{ total:47 }, created_at:'2026-10-29T10:00:00Z', real_call:true, consent:true }, { id:'k1', title:'OK call', score:{ total:40 }, created_at:'2026-10-28T10:00:00Z', real_call:true, consent:true }] }) }, run: async (p, ok) => {
      await p.waitForSelector('#lfSave', { timeout:8000 }).catch(() => {});
      const t = await p.evaluate(() => document.getElementById('pView').innerText);
      ok(/What sellers say most[\s\S]*Your offer is too low[\s\S]*12[\s\S]*already listed[\s\S]*5/.test(t), 'Amr sees what sellers say most');
      await p.click('#lfSave'); await p.waitForTimeout(100);
      ok(/Give it a title/.test(await p.textContent('#lfMsg')), 'an entry needs a title');
      await p.fill('#lfTitle', 'I need to talk to my wife'); await p.fill('#lfSection', 'Decision makers'); await p.fill('#lfBody', 'Of course. When are you two talking tonight?');
      await p.fill('#lfStates', 'OH: test note\nnot a state line'); await p.check('.lb-partpick input[value="5"]'); await p.click('#lfSave'); await p.waitForTimeout(300);
      const ins = await p.evaluate(() => (SB_CALLS.find(c => c[0] === 'insert' && c[1] === 'library_entries') || [])[2]);
      ok(ins && ins.kind === 'objection' && ins.section === 'Decision makers' && JSON.stringify(ins.state_notes) === '[{"state":"OH","note":"test note"}]' && JSON.stringify(ins.parts) === '[5]', 'Amr adds an objection with a state note and the part it trains');
      await p.waitForSelector('[data-open="1"]', { timeout:5000 }).catch(() => {});
      await p.click('[data-open="1"]'); await p.waitForTimeout(200);
      ok(await p.evaluate(() => [...document.querySelectorAll('[data-expick] option')].map(o => o.textContent).join('|')).then(x => /Great call · 47 of 50/.test(x) && !/OK call/.test(x)), 'only calls scored 45 or more can be added as examples');
      await p.selectOption('[data-expick="1"]', 'g1'); await p.waitForTimeout(200);
      ok(await p.evaluate(() => SB_CALLS.some(c => c[0] === 'insert' && c[1] === 'library_examples' && c[2].upload_id === 'g1' && c[2].entry_id === 1)), 'Amr attaches the call as an example');
    } },
  { name:'owner-onboarding', url:'/app/#onboarding', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:Object.assign({}, owner, { portal_onboarding_summary:[{ user_id:'u1', name:'Sara R.', done:2, total:5, joined:'2026-10-28T10:00:00Z' }, { user_id:'u2', name:'Youssef H.', done:5, total:5, joined:'2026-09-01T10:00:00Z' }], portal_onboarding:obRows }),
      SB_FROM:Object.assign({}, ownerFrom, { onboarding_items:[{ id:1, grp:'Paperwork', title:'Agreement signed', auto:null, sort:10, active:true }, { id:4, grp:'Tools', title:'Signed in to the portal', auto:'signed_in', sort:10, active:true }] }) }, run: async (p, ok) => {
      await p.waitForSelector('.ob-head', { timeout:8000 }).catch(() => {});
      const t = await p.evaluate(() => document.getElementById('pView').innerText);
      ok(/Onboarding/.test(await p.textContent('#title')) && /Sara R\.[\s\S]*2 of 5/.test(t) && /Youssef H\.[\s\S]*All done/.test(t), 'Onboarding lists everyone with their progress: Sara 2 of 5, Youssef all done');
      await p.click('[data-open="u1"]'); await p.waitForSelector('.ob-list:not([hidden]) .ob-item', { timeout:5000 }).catch(() => {});
      const l = await p.evaluate(() => document.querySelector('.ob-list:not([hidden])').innerText);
      ok(/PAPERWORK|Paperwork/.test(l) && /Agreement signed\s*Ticked Oct 30/.test(l) && /Deal CRM opened with the team passphrase\s*Ticks itself once it’s done/.test(l), 'Sara’s checklist: grouped, ticked items with the day, self-checking items say so');
      ok(await p.evaluate(() => document.querySelector('.ob-item.is-auto input').disabled && !document.querySelector('[data-tick="2"]').disabled), 'self-checking items can’t be ticked; Amr’s can');
      await p.click('[data-tick="2"]'); await p.waitForTimeout(300);
      ok(await p.evaluate(() => SB_CALLS.some(c => c[0] === 'insert' && c[1] === 'onboarding_ticks' && c[2].user_id === 'u1' && c[2].item_id === 2)), 'ticking saves it for Sara');
      await p.click('.ob-edit summary'); await p.click('#obAdd'); await p.waitForTimeout(100);
      ok(/Write the item first/.test(await p.textContent('#obMsg')), 'adding an empty item says so');
      await p.fill('#obTitle', 'Shadowed two live calls'); await p.selectOption('#obGrp', 'Training'); await p.click('#obAdd'); await p.waitForTimeout(300);
      ok(await p.evaluate(() => SB_CALLS.some(c => c[0] === 'insert' && c[1] === 'onboarding_items' && c[2].title === 'Shadowed two live calls' && c[2].grp === 'Training')), 'Amr adds an item to the checklist');
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'nothing wider than the screen');
      const small = await p.evaluate(() => [...document.querySelectorAll('#pView button, #pView select, #pView input[type=text], #pView .ob-item, #pView summary')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).map(e => e.id || e.className));
      ok(!small.length, 'buttons, fields and ticks at least 44px ' + small.join(' '));
    } },
  { name:'agent-scoring', url:'/app/#scoring', init:{ SB_SESSION:U, SB_RPC:member(ME.agent, 'Sara R.'), SB_FROM:{ live_status:[], roleplay_scenarios:scScen, hub_uploads:scRows, hub_upload_comments:[{ upload_id:'c2', at_s:95, body:'Slow down before the offer.' }] } }, run: async (p, ok, W) => {
      await p.waitForSelector('#scSend', { timeout:8000 }).catch(() => {});
      const t = await p.evaluate(() => document.getElementById('pView').innerText);
      ok(/Call scoring/.test(await p.textContent('#title')) && /Send a call to score/.test(t), 'Call scoring opens from #scoring');
      ok(/35\s*average of your last 2/.test(t) && /40\s*best score/.test(t) && /2\s*calls scored/.test(t) && /Keep drilling the stages/.test(t), 'tiles: average 35 of the last 2, best 40, 2 scored, and the band');
      ok(await p.evaluate(() => [...document.querySelectorAll('.sc-cat.is-weak')].map(e => e.textContent).join('|')).then(x => /Objection handling/.test(x) && /Close and next step/.test(x)), 'the two weakest parts are flagged: Objection handling, Close and next step');
      ok(/1:35 Slow down before the offer\./.test(t) && /Waiting for Amr/.test(t) && /40 of 50/.test(t), 'each call: its score or that it is waiting, and Amr’s notes with the time');
      ok(/Inherited land/.test(t) && await p.evaluate(() => !document.querySelector('.sc-hidden').open), 'scenarios: the brief shows; the seller’s notes stay folded');
      await p.click('#scSend'); await p.waitForTimeout(100);
      ok(/Record the call or choose a recording first/.test(await p.textContent('#scMsg')), 'sending with nothing recorded says what to do');
      await p.setInputFiles('#scFile', { name:'call.m4a', mimeType:'audio/mp4', buffer:Buffer.from('fake audio') });
      await p.click('[data-kind="real"]'); await p.click('#scSend'); await p.waitForTimeout(100);
      ok(/agreed to be recorded/.test(await p.textContent('#scMsg')) && !(await p.evaluate(() => SB_CALLS.some(c => c[0] === 'insert' && c[1] === 'hub_uploads'))), 'a real call needs the consent tick; nothing is sent without it');
      await p.check('#scConsent'); await p.click('#scSend'); await p.waitForTimeout(500);
      const ins = await p.evaluate(() => (SB_CALLS.find(c => c[0] === 'insert' && c[1] === 'hub_uploads') || [])[2]);
      ok(ins && ins.course === 'calls' && ins.real_call === true && ins.consent === true && ins.kind === 'recording' && /^u1\/calls\/.+\.m4a$/.test(ins.path) && ins.scenario_id === null, 'sent: a real call, in the rep’s own calls folder');
      await p.waitForSelector('[data-practice="1"]', { timeout:5000 }).catch(() => {});
      await p.click('[data-practice="1"]'); await p.waitForTimeout(150);
      ok(await p.inputValue('#scScen') === '1' && await p.getAttribute('[data-kind="roleplay"]', 'aria-pressed') === 'true', 'Practice this one picks the scenario for a roleplay');
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'nothing wider than the screen');
      const small = await p.evaluate(() => [...document.querySelectorAll('#pView button, #pView select, #pView input[type=text], #pView .sc-tick, #pView summary')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).map(e => e.id || e.className));
      ok(!small.length, 'buttons, fields and ticks at least 44px ' + small.join(' '));
    } },
  { name:'owner-scoring', url:'/app/#scoring', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:owner, SB_FROM:Object.assign({}, ownerFrom, { roleplay_scenarios:scScen, hub_uploads:scRows, hub_upload_comments:[] }) }, run: async (p, ok) => {
      await p.waitForSelector('#sfSave', { timeout:8000 }).catch(() => {});
      const t = await p.evaluate(() => document.getElementById('pView').innerText);
      ok(/Team scores/.test(t) && /Sara R\.\s*40 of 50\s*35 · Keep drilling the stages/.test(t) && /1 call waiting to score/.test(t), 'Team scores: Sara’s last score, her average, and 1 call waiting');
      await p.click('#sfSave'); await p.waitForTimeout(100);
      ok(/Give it a title/.test(await p.textContent('#sfMsg')), 'a scenario needs a title');
      await p.fill('#sfTitle', 'Tired landlord'); await p.fill('#sfHidden', 'Will sell if the tenant leaves.'); await p.click('#sfSave'); await p.waitForTimeout(300);
      ok(await p.evaluate(() => SB_CALLS.some(c => c[0] === 'insert' && c[1] === 'roleplay_scenarios' && c[2].title === 'Tired landlord' && c[2].hidden === 'Will sell if the tenant leaves.')), 'Amr adds a scenario');
      await p.click('[data-sedit="1"]'); await p.waitForTimeout(100);
      ok(await p.inputValue('#sfTitle') === 'Inherited land' && await p.isVisible('#sfActive'), 'Edit loads it, with Show it to the team');
    } },
  { name:'owner-teamview', url:'/app/#teamview', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:Object.assign({}, owner, { portal_team_overview:tvRows }), SB_FROM:ownerFrom }, run: async (p, ok, W) => {
      await p.waitForSelector('.p-tv', { timeout:8000 }).catch(() => {});
      const t = await p.evaluate(() => document.getElementById('pView').innerText);
      ok(/Team overview/.test(await p.textContent('#title')) && /Team overview/.test(t), 'the Team overview opens from #teamview');
      ok(/Sara R\.\s*On shift/.test(t) && /5:00/.test(t) && /81 dials/.test(t) && /10 conversations · 1 offer · 3 appointments/.test(t) && /1 note missing/.test(t), 'Sara: on shift, 5:00 hours, 81 dials, the rest of her calls, 1 note missing');
      ok(/2 open[\s\S]*1 under contract · 1 closed[\s\S]*1 follow-up late/.test(t), 'her deals: 2 open, 1 under contract, 1 closed, 1 follow-up late');
      ok(/Acquisitions 3\/15/.test(t) && /4 lessons · 1 drill sent/.test(t), 'learning: lessons and drills, and course progress');
      ok(/Youssef H\.[\s\S]*Manager/.test(t) && /3 days ago/.test(t) && /All sent/.test(t), 'Youssef: manager, last active 3 days ago, every note sent');
      ok(!/\bAmr\b[\s\S]*0 dials/.test(t.split('Name')[1] || ''), 'Amr himself isn’t a row');
      ok(/1\s*on shift now/.test(t) && /93\s*calls in 7 days/.test(t) && /1\s*deals closed in 7 days/.test(t), 'totals: 1 on shift, 93 calls, 1 deal closed in 7 days');
      await p.click('[data-tv="30"]'); await p.waitForTimeout(400);
      ok(await p.evaluate(() => { const c = SB_CALLS.filter(x => x[0] === 'rpc' && x[1] === 'portal_team_overview'); return c.length >= 2 && c[c.length - 1][2].p_days === 30; }) && await p.getAttribute('[data-tv="30"]', 'aria-pressed') === 'true', '30 days asks for 30 days and shows as chosen');
      const wide = await p.evaluate(() => [...document.querySelectorAll('#pView *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.p-tablewrap')).slice(0, 4).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)).join(' | '));
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'nothing wider than the screen (the table scrolls inside its box) ' + wide);
      ok(await p.evaluate(() => [...document.querySelectorAll('[data-tv]')].every(b => b.getBoundingClientRect().height >= 44)), 'period buttons at least 44px');
    } },
  { name:'owner-admin', url:'/app/', init:{ SB_SESSION:O, SB_AAL:'aal2', SB_RPC:Object.assign({}, owner, { portal_gate1:[{ user_id:'u1', name:'Sara R.', shift_days:6, missed_days:1, last_missed:'2026-10-29', clean_days:3, worked_both_weeks:true }, { user_id:'u2', name:'Youssef H.', shift_days:9, missed_days:0, last_missed:null, clean_days:14, worked_both_weeks:true }] }), SB_FROM:ownerFrom }, run: async (p, ok, W) => {
      ok(await p.evaluate(() => location.hash) === '#admin', 'Amr lands on the Admin overview');
      ok(/Bricolage/.test(await fontOf(p, '#title')), 'page name in Bricolage Grotesque (was Bodoni): ' + (await fontOf(p, '#title')).split(',')[0]);
      ok(/Bricolage/.test(await fontOf(p, '#pView h1')), 'hero heading in Bricolage Grotesque');
      ok(W <= 420 ? await p.isHidden('.p-admin-tag') : await p.isVisible('.p-admin-tag'), W <= 420 ? 'ADMIN label hidden on a phone (the switch says Admin)' : 'ADMIN label shows');
      ok(await p.isVisible('.p-apps-btn'), 'Apps button shows');
      ok(await p.evaluate(() => getComputedStyle(document.querySelector('#pView .p-hero')).borderRadius) === '10px', 'portal corners are round (not the old square look)');
      ok(await p.evaluate(() => (document.querySelector('.p-mode [aria-current="page"]') || {}).textContent) === 'Admin', 'switch is on Admin');
      const t = await p.evaluate(() => document.getElementById('pView').innerText);
      ok(/3 things need you today/.test(t) && /Sara R\.|1 waiting/.test(t) && /1,234/.test(t) && /Zoho Campaigns/.test(t) && !/Emails and sign-ups/.test(t), 'overview numbers: 3 things (2 reviews, 1 request), 1,234 visits, Zoho link');
      ok(/People[\s\S]*Learning[\s\S]*Deals[\s\S]*Money[\s\S]*Site/i.test(t), 'boxes People, Learning, Deals, Money, Site');
      ok(/End-of-day reports\s*1 missing/.test(t), 'People box: 1 end-of-day report missing');
      const g = await p.evaluate(() => (document.querySelector('.p-g1') || {}).innerText || '');
      ok(/Gate 1[\s\S]*1 of 2 people are there/.test(g) && /Sara R\.[\s\S]*No calls logged Oct 29/.test(g) && /Youssef H\.[\s\S]*Ready/.test(g), 'Gate 1: 1 of 2 ready; Sara missed calls on Oct 29, Youssef ready');
      ok(/Commissions owed\s*\$2,500\.50 · 2 commissions/.test(t) && await p.evaluate(() => [...document.querySelectorAll('#pView a.p-row')].some(a => /Commissions owed/.test(a.textContent) && a.getAttribute('href') === '#expense')), 'Money box: $2,500.50 owed in 2 commissions, opening Expenses');
      ok(/Closing in the next 14 days\s*1 deal/.test(t) && /Inspection ending in 7 days\s*1 deal/.test(t), 'Deals box: 1 closing in 14 days, 1 inspection ending in 7 days, without unlocking the CRM');
      const eod = await p.evaluate(() => document.getElementById('pvEodBox').innerText);
      ok(/1 of 3 people who worked sent a report/.test(await p.textContent('#pvEodSum')), 'summary: 1 of 3 people who worked sent a report');
      ok(/Sara R\.\s*No report[\s\S]*3:00 worked · 40 dials · 5 conversations · 1 offer · 1 appointment[\s\S]*Two good talks\.\s*One appointment set\.[\s\S]*1 of 2 shifts without a note/.test(eod), 'missing first: hours, numbers, the note that came in, and what is missing');
      ok(/Omar T\.\s*On shift[\s\S]*Youssef H\.\s*Sent[\s\S]*Mona K\.\s*Didn’t work/.test(eod), 'then on shift, sent, and didn’t work');
      ok(await p.evaluate(() => !document.querySelector('#pvEodBox b b') && /<b>Slow<\/b>/.test(document.getElementById('pvEodBox').textContent)), 'notes are shown as plain text, never as page code');
      await p.click('[data-eod="-1"]'); await p.waitForTimeout(400);
      ok(await p.evaluate(() => { const c = SB_CALLS.filter(x => x[0] === 'rpc' && x[1] === 'portal_eod'); const a = c[c.length - 1][2]; return a && /^\d{4}-\d{2}-\d{2}$/.test(a.p_day); }) && await p.getAttribute('[data-eod="-1"]', 'aria-pressed') === 'true', 'Yesterday asks for the day before (Cairo date) and shows as chosen');
      if (W > 1000) { const s = await sideOf(p); ok(s && JSON.stringify(s) === JSON.stringify(['Overview','People:Team overview','People:Live now','People:Team and shifts','People:Missed-shift requests','People:Invite and access','People:Onboarding','Learning:Learning Hub','Learning:Learner progress','Learning:Review center','Learning:Call scoring','Learning:Scripts and objections','Deals:Deal CRM','Deals:Land calculator','Deals:House calculator','Money:Cash','Money:Income','Money:Expenses','Money:My time','Money:Payments (later)','Site:Visits','Site:Emails','Site:Logs','Site:Zoho Campaigns']), 'sidebar groups: ' + (s || []).join(' | ')); }
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
      if (W > 1000) { const s = await sideOf(p); ok(s && JSON.stringify(s) === JSON.stringify(['Portal','My hours','People:Team overview','People:Live now','People:Team and shifts','People:Missed-shift requests','Learning:Learning Hub','Learning:Learner progress','Learning:Call scoring','Learning:Scripts and objections','Deals:Deal CRM','Deals:Land calculator','Deals:House calculator']), 'smaller Admin side: ' + (s || []).join(' | ')); }
      await p.evaluate(() => { location.hash = '#progress'; }); await p.waitForTimeout(800);
      ok(/Youssef H\.\s+Marketing\s+2 of 16/.test(await p.evaluate(() => document.getElementById('pView').innerText)), 'manager sees learner progress');
    } },
  { name:'agent-home', url:'/app/', init:{ SB_SESSION:U, SB_RPC:member(ME.agent, 'Sara R.'), SB_FROM:{ live_status:[] } }, run: async (p, ok) => {
      ok(await p.evaluate(() => location.hash) === '#home', 'agent lands on the Team home');
      ok(await p.evaluate(() => document.getElementById('drawer').hidden && document.getElementById('burger').hidden), 'no sidebar or menu button for agents');
      const t = await p.evaluate(() => document.getElementById('pView').innerText);
      ok(/Hi, Sara/.test(t) && /not clocked in/.test(t), 'hero: name and clock state');
      ok(await p.evaluate(() => { const m = document.getElementById('pvMore'); return !!m && !m.open && !!document.getElementById('pvDue') && !m.contains(document.getElementById('pvDue')) && m.contains(document.querySelector('.p-areas')); }),
        'calling rep: a short home (clock, today, callbacks); lessons, areas and the board folded under More');
      await p.click('#pvMore summary'); await p.waitForTimeout(200);
      const t2 = await p.evaluate(() => document.getElementById('pView').innerText);
      ok(/Real Estate Acquisitions · Module 2/i.test(t2) && /Getting their number/.test(t2) && /7%/.test(t2), 'continue learning: Acquisitions module 2, 7%');
      ok(/My deals[\s\S]*Learning Hub[\s\S]*My hours[\s\S]*Calculators/.test(t2) && !/Team and shifts/.test(t2), 'areas: My deals, Learning Hub, My hours, Calculators');
      ok(/Marketing course · Locked[\s\S]*Ask for access/.test(t2) && /Psychology and Therapy course · Locked/.test(t2), 'locked courses listed, each with Ask for access');
      ok(/Bricolage/.test(await fontOf(p, '#pView h1')), 'hero heading in Bricolage Grotesque');
      await p.click('[data-clock="run"]'); await p.waitForTimeout(800);
      const up = await p.evaluate(() => SB_CALLS.some(c => c[0] === 'upsert' && c[1] === 'live_status'));
      ok(up && /clocked in/.test(await p.evaluate(() => document.getElementById('pvSub').textContent)) && await p.isVisible('[data-clock="off"]'), 'Clock in starts the shift (same code as the tracker) and the button turns to Clock out');
      ok(await p.isVisible('#pvClockBox a[href="#track"]') && /Log calls/.test(await p.textContent('#pvClockBox')), 'clocked in: a Log calls button next to Clock out');
      await p.evaluate(() => { location.hash = '#live'; }); await p.waitForTimeout(500);
      ok(await p.evaluate(() => location.hash) === '#home', 'an agent opening #live goes back to the Team home');
      await p.evaluate(() => { location.hash = '#track'; }); await p.waitForTimeout(500);
      ok(!(await p.evaluate(() => document.getElementById('pTrack').hidden)), 'old link #track still opens My hours');
    } },
  { name:'agent-today', url:'/app/', init:{ SB_SESSION:U, SB_RPC:Object.assign(member(ME.agent, 'Sara R.'), { portal_my_today:[{ dials:23, conversations:1, offers:2, appointments:1 }], portal_onboarding:obRows, portal_my_commissions:[{ id:1, deal_label:'House, Pike, OH', amount:1300, status:'owed', paid_on:null }, { id:2, deal_label:'Land, Ross, OH', amount:500, status:'paid', paid_on:'2026-10-20' }] }), SB_FROM:{ live_status:[], deals:[
      { id:'d1', kind:'land', county:'ross', state:'OH', stage:'offer', follow_up:iso(-3), updated_at:'2026-10-20T10:00:00Z' },
      { id:'d2', kind:'house', county:'polk', state:'FL', stage:'talking', follow_up:iso(0), updated_at:'2026-10-21T10:00:00Z' },
      { id:'d3', kind:'land', county:null, state:'TX', stage:'lead', follow_up:null, updated_at:'2026-10-22T10:00:00Z' },
      { id:'d4', kind:'house', county:'dayton', state:'OH', stage:'contract', follow_up:iso(5), inspection_ends:iso(2), closing_on:iso(15), updated_at:'2026-10-23T10:00:00Z' },
      { id:'d5', kind:'land', county:'athens', state:'OH', stage:'lead', follow_up:iso(4), updated_at:'2026-10-24T10:00:00Z' },
      { id:'d6', kind:'land', county:'pike', state:'OH', stage:'contract', follow_up:null, inspection_ends:iso(-2), closing_on:null, updated_at:'2026-10-25T10:00:00Z' }] } }, run: async (p, ok) => {
      await p.click('#pvMore summary').catch(() => {}); await p.waitForTimeout(200);
      const t = await p.evaluate(() => document.getElementById('pView').innerText);
      ok(/Today/.test(t) && /23\s*calls/.test(t) && /1\s*conversation\b/.test(t) && /3\s*offers and appointments/.test(t) && /0:00\s*hours today/.test(t), 'today’s numbers: 23 calls, 1 conversation, 3 offers and appointments, 0:00 hours');
      const due = await p.evaluate(() => document.getElementById('pvDue').innerText), act = await p.evaluate(() => document.getElementById('pvAct').innerText);
      ok(/Land · Ross, OH[\s\S]*3 days late[\s\S]*House · Polk, FL[\s\S]*Today/.test(due) && !/Athens|Dayton|TX/.test(due), 'callbacks due: the late one first, then today; future follow-ups left out');
      ok(/House · Dayton, OH[\s\S]*Inspection ends in 2 days[\s\S]*Land · TX[\s\S]*New lead · no follow-up/.test(act) && !/Athens|Ross|Polk/.test(act), 'needing action: under contract first with its countdown, then a deal with no follow-up');
      ok(/Land · Pike, OH[\s\S]*Inspection over/.test(act), 'a deal whose inspection is over and has no closing date says Inspection over');
      await p.waitForSelector('#pvCommWrap:not([hidden])', { timeout:5000 }).catch(() => {});
      const cm = await p.evaluate(() => document.getElementById('pvCommWrap').innerText);
      ok(/Your commissions\s*\$1,300\.00 owed/i.test(cm) && /House, Pike, OH\s*\$1,300\.00 · owed/.test(cm) && /Land, Ross, OH\s*\$500\.00 · paid Oct 20/.test(cm) && /Paid so far: \$500\.00/.test(cm), 'Your commissions: $1,300.00 owed, each deal with owed or paid, and paid so far');
      ok(!/profit|%/.test(cm), 'never the profit or a percentage');
      await p.waitForSelector('#pvOnb:not([hidden])', { timeout:5000 }).catch(() => {});
      ok(/Your onboarding\s*2 of 5 done/i.test(await p.evaluate(() => document.getElementById('pvOnb').innerText)) && await p.evaluate(() => [...document.querySelectorAll('#pvOnb input')].every(i => i.disabled)), 'Your onboarding on the Team home: 2 of 5 done, read only');
      ok(await p.evaluate(() => (document.querySelector('#pvDue a.p-row') || {}).getAttribute('href')) === '/app/deals/#id=d1', 'a row opens that deal in the CRM');
      ok(/2 deals/.test(await p.textContent('#pvDueN')) && /3 deals/.test(await p.textContent('#pvActN')), 'counts on both lists');
      ok(await p.evaluate(() => SB_CALLS.some(c => c[0] === 'rpc' && c[1] === 'portal_my_today') && SB_CALLS.some(c => c[0] === 'from' && c[1] === 'deals')), 'reads portal_my_today and the deals table');
      const hs = await p.evaluate(() => [...document.querySelectorAll('#pView h2')].map(h => h.textContent.replace(/\s+/g, ' ').trim()));
      ok(hs.findIndex(h => /^Today/.test(h)) >= 0 && hs.findIndex(h => /^Today/.test(h)) < hs.indexOf('Your areas') && hs.includes('Next lesson'), 'Today comes before Your areas, with the Next lesson: ' + hs.join(' | '));
    } },
  { name:'agent-today-empty', url:'/app/', init:{ SB_SESSION:U, SB_RPC:Object.assign(member(ME.agent, 'Sara R.'), { portal_my_today:[{ dials:0, conversations:0, offers:0, appointments:0 }] }), SB_FROM:{ live_status:[], deals:[] } }, run: async (p, ok) => {
      ok(await p.isHidden('#pvCommWrap'), 'no commissions yet: the section stays hidden');
      ok(await p.isHidden('#pvOnb'), 'no checklist to show: no onboarding card');
      ok(/No open deals yet/.test(await p.textContent('#pvDue')) && /1?\s*0\s*calls/.test(await p.evaluate(() => document.getElementById('pvTodayNums').innerText)), 'no deals yet: says so; zero calls');
    } },
  { name:'learner-today', url:'/app/', init:{ SB_SESSION:U, SB_RPC:Object.assign(member({ role:'agent', keys:['course','learn'], needs_code:[] }, 'Lina P.'), { portal_my_today:[{ dials:4, conversations:0, offers:0, appointments:0 }] }), SB_FROM:{ live_status:[] } }, run: async (p, ok) => {
      ok(!(await p.$('#pvDue')) && !(await p.evaluate(() => SB_CALLS.some(c => c[0] === 'from' && c[1] === 'deals'))), 'no Deal CRM access: no deal lists, and the deals table isn’t asked');
    } },
  { name:'agent-bell', url:'/app/', init:{ SB_SESSION:U, SB_RPC:Object.assign(member(ME.agent, 'Sara R.'), { request_course_access:'sent', notifications_read_all:2 }), SB_FROM:{ live_status:[], notifications:[
      { id:7, kind:'shift_decided', title:'Your missed shift for Oct 30 was approved', body:null, link:'/app/#track', created_at:new Date(Date.now() - 5 * 60e3).toISOString(), read_at:null },
      { id:6, kind:'review_done', title:'Your recording was reviewed: <b>approved</b>', body:'Acquisitions · Module 3 call', link:'//evil.example/x', created_at:new Date(Date.now() - 26 * 3600e3).toISOString(), read_at:null }] } }, run: async (p, ok, W) => {
      ok(await p.isVisible('.p-bell') && (await p.textContent('.p-bell .p-badge')).trim() === '2' && /2 new/.test(await p.getAttribute('.p-bell', 'aria-label')), 'the bell shows 2 new');
      await p.click('.p-bell'); await p.waitForTimeout(300);
      const t = await p.evaluate(() => document.querySelector('.p-notes').innerText);
      ok(/Your missed shift for Oct 30 was approved[\s\S]*\d+ min ago · New/.test(t) && /Acquisitions · Module 3 call[\s\S]*yesterday/.test(t), 'the panel lists them, newest first, with how long ago');
      ok(await p.evaluate(() => !document.querySelector('.p-notes b b') && /<b>approved<\/b>/.test(document.querySelector('.p-notes').textContent)), 'titles are plain text, never page code');
      ok(await p.evaluate(() => [...document.querySelectorAll('.p-notes a')].every(a => /^\/(?!\/)/.test(a.getAttribute('href')))), 'links only go to pages on this site (an outside link becomes /app/)');
      const r = await p.evaluate(() => { const n = document.querySelector('.p-notes').getBoundingClientRect(); return [n.left, n.right, document.documentElement.clientWidth]; });
      ok(r[0] >= 0 && r[1] <= r[2], 'the panel fits the screen (' + r.map(Math.round).join(', ') + ')');
      await p.click('[data-allread]'); await p.waitForTimeout(300);
      ok(await p.isHidden('.p-bell .p-badge') && await p.evaluate(() => SB_CALLS.some(c => c[0] === 'rpc' && c[1] === 'notifications_read_all')), 'Mark all read clears the badge');
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      ok(await p.isHidden('.p-notes'), 'Escape closes it');
      await p.click('#pvMore summary').catch(() => {}); await p.waitForTimeout(200);
      const ask = await p.$$('[data-ask]');
      ok(ask.length === 2, 'two locked courses, each with Ask for access');
      await ask[0].click(); await p.waitForTimeout(400);
      ok(/Sent to Amr/.test(await ask[0].textContent()) && await p.evaluate(() => SB_CALLS.some(c => c[0] === 'rpc' && c[1] === 'request_course_access' && c[2].p_course === 'mkt')), 'Ask for access sends the request for that course');
    } },
  { name:'agent-bell-empty', url:'/app/', init:{ SB_SESSION:U, SB_RPC:member(ME.agent, 'Sara R.'), SB_FROM:{ live_status:[], notifications:[] } }, run: async (p, ok) => {
      ok(await p.isHidden('.p-bell .p-badge'), 'nothing new: no badge');
      await p.click('.p-bell'); await p.waitForTimeout(300);
      ok(/Nothing new/.test(await p.textContent('.p-notes')) && !(await p.$('[data-allread]')), 'an empty panel says so, without Mark all read');
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
