// Checks for app/course/tools.js: the calculator math, then both courses' tools in a real browser
// (English and Arabic, phone and desktop width), with screenshots in tools/course-tools/shots/ (git ignores them).
// Usage, from the repo root:  python3 -m http.server 8765 &   then   node tools/course-tools/check.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:8765/tools/course-tools/test.html';
const SHOTS = new URL('./shots/', import.meta.url).pathname; mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; };
const near = (a, b) => Math.abs(a - b) < 1e-6;

const browser = await chromium.launch();
const errs = [];
const page = async (w, h, url) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto(url); return p;
};

// ---------- 1. math ----------
{
  const p = await page(1200, 900, BASE + '?course=mkt');
  const r = await p.evaluate(() => {
    const { calc, verdict, totalOf } = LH_TOOLS._test;
    return {
      a: calc({ spend: '4500', leads: '180', appts: '36', deals: '3', profit: '12000', target: '4' }),
      blank: calc({ spend: '', leads: '', appts: '', deals: '', profit: '' }),
      noDeals: calc({ spend: '3000', leads: '120', appts: '12', deals: '0', profit: '10000' }),
      commas: calc({ spend: '$4,500', leads: '180', appts: '36', deals: '3', profit: '12,000' }),
      v: [verdict(4000, 12000), verdict(8000, 12000), verdict(13000, 12000), verdict(NaN, 1000), verdict(500, 0)],
      tot: totalOf({ ch: [{ spend: '4500', leads: '180', appts: '36', deals: '3', profit: '12000' }, { spend: '6000', leads: '90', appts: '27', deals: '2', profit: '15000' }] })
    };
  });
  ok(r.a.cpl === 25 && r.a.cpa === 125 && r.a.cpd === 1500, 'cost per lead 25, per appointment 125, per deal 1500');
  ok(near(r.a.l2a, 0.2) && near(r.a.a2d, 1 / 12), 'rates: 20% leads to appointments, 1 in 12 appointments to deals');
  ok(r.a.net === 31500 && near(r.a.roi, 7), 'profit after marketing 31,500 and return 700%');
  ok(r.a.plan && r.a.plan.appts === 48 && r.a.plan.leads === 240 && r.a.plan.budget === 6000, 'plan for 4 deals: 48 appointments, 240 leads, 6,000 budget');
  ok(r.blank.net === 0 && r.blank.cpl === null || Number.isNaN(r.blank.cpl), 'blank channel gives no rates and no error');
  ok(r.noDeals.cpd === null || Number.isNaN(r.noDeals.cpd), 'no deals: cost per deal is left blank, not infinite');
  ok(r.noDeals.net === -3000, 'no deals: profit after marketing is minus the spend');
  ok(r.commas.cpl === 25, 'typed "$4,500" and "12,000" read as numbers');
  ok(JSON.stringify(r.v) === JSON.stringify(['healthy', 'thin', 'losing', null, null]), 'verdict: healthy, thin, losing, and none without numbers');
  ok(r.tot.spend === 10500 && r.tot.deals === 5 && r.tot.cpd === 2100 && r.tot.profit === 13200, 'all channels: 10,500 spent, 5 deals, 2,100 per deal, blended profit 13,200');
  await p.context().close();
}

// ---------- 2. marketing calculator in the browser ----------
for (const lang of ['en', 'ar']) for (const [w, h, tag] of [[390, 844, 'phone'], [1280, 900, 'desktop']]) {
  const p = await page(w, h, `${BASE}?course=mkt&lang=${lang}#/tools`);
  ok(await p.locator('.lt-tool').count() === 1, `mkt ${lang} ${tag}: tools page lists 1 tool`);
  await p.click('.lt-tool');
  await p.waitForSelector('.lt-ch');
  await p.click('[data-act="example"]');
  ok(await p.locator('.lt-ch').count() === 4, `mkt ${lang} ${tag}: example loads 4 channels`);
  const first = p.locator('.lt-ch').first();
  await first.locator('[data-k="spend"]').fill('9000');
  ok(await first.locator('[data-k="spend"]').evaluate(el => el === document.activeElement), `mkt ${lang} ${tag}: typing keeps focus in the field`);
  const cpd = await first.locator('.lt-stat.key b').textContent();
  ok(/3,000/.test(cpd), `mkt ${lang} ${tag}: cost per deal updates to 3,000 as you type (shows "${cpd.trim()}")`);
  ok(await first.locator('.lt-plan').count() === 1, `mkt ${lang} ${tag}: plan backward shows for the channel with a target`);
  const scroll = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(scroll <= 0, `mkt ${lang} ${tag}: no sideways scrolling`);
  if (lang === 'ar') ok(await p.locator('#cpMain .lt-root').getAttribute('dir') === 'rtl', `mkt ar ${tag}: page is right to left`);
  await p.screenshot({ path: `${SHOTS}mkt-${lang}-${tag}.png`, fullPage: true });
  await p.reload(); await p.waitForSelector('.lt-ch');
  ok(await p.locator('.lt-ch').first().locator('[data-k="spend"]').inputValue() === '9000', `mkt ${lang} ${tag}: numbers are still there after a reload`);
  await p.context().close();
}

// ---------- 3. psychology tools in the browser ----------
for (const lang of ['en', 'ar']) for (const [w, h, tag] of [[390, 844, 'phone'], [1280, 900, 'desktop']]) {
  const p = await page(w, h, `${BASE}?course=psy&lang=${lang}#/tools`);
  ok(await p.locator('.lt-tool').count() === 2 && await p.locator('.lt-safe').count() === 1, `psy ${lang} ${tag}: 2 tools and the safety note`);
  await p.screenshot({ path: `${SHOTS}psy-${lang}-${tag}-home.png`, fullPage: true });
  // thought record
  await p.goto(`${BASE}?course=psy&lang=${lang}#/tools/thought/new`); await p.waitForSelector('.lt-form');
  await p.fill('[data-k="situation"]', 'Presentation at work went quiet');
  await p.fill('[data-k="feeling"]', 'Anxious');
  await p.locator('[data-k="before"]').fill('80');
  await p.fill('[data-k="thought"]', 'Everyone thinks I am bad at this');
  await p.locator('.lt-chips label').nth(2).click();
  await p.fill('[data-k="balanced"]', 'One quiet room is not proof of anything');
  await p.locator('[data-k="after"]').fill('45');
  await p.screenshot({ path: `${SHOTS}psy-${lang}-${tag}-thought.png`, fullPage: true });
  await p.click('.lt-form button[type="submit"]'); await p.waitForSelector('.lt-entry');
  const meta = await p.locator('.lt-entry .lt-meta').first().textContent();
  ok(/80 → 45/.test(meta), `psy ${lang} ${tag}: saved entry shows the 80 → 45 change ("${meta.trim()}")`);
  await p.click('.lt-entry'); await p.waitForSelector('.lt-form');
  ok(await p.locator('.lt-chips input:checked').count() === 1, `psy ${lang} ${tag}: thinking trap choice is kept`);
  // goal planner
  await p.goto(`${BASE}?course=psy&lang=${lang}#/tools/grow/new`); await p.waitForSelector('.lt-form');
  await p.fill('[data-k="goal"]', 'Run a 5k by March');
  await p.locator('[data-k="scale"]').fill('3');
  await p.fill('[data-k="step"]', 'Walk-run three times this week');
  await p.click('.lt-form button[type="submit"]'); await p.waitForSelector('.lt-entry');
  await p.click('.lt-entry'); await p.waitForSelector('[data-addcheck]');
  await p.fill('[data-ck="ckNote"]', 'Did two of three runs');
  await p.locator('[data-ck="ckScale"]').fill('4');
  await p.click('[data-addcheck]'); await p.waitForSelector('.lt-check');
  ok(await p.locator('.lt-check').count() === 1, `psy ${lang} ${tag}: check-in added`);
  await p.click('[data-state]');
  await p.screenshot({ path: `${SHOTS}psy-${lang}-${tag}-goal.png`, fullPage: true });
  await p.goto(`${BASE}?course=psy&lang=${lang}#/tools/grow`); await p.waitForSelector('.lt-entry');
  const gm = await p.locator('.lt-entry .lt-meta').first().textContent();
  ok(/4\/10/.test(gm), `psy ${lang} ${tag}: list shows the latest check-in score ("${gm.trim()}")`);
  // delete
  await p.goto(`${BASE}?course=psy&lang=${lang}#/tools/thought`); await p.waitForSelector('.lt-entry'); await p.click('.lt-entry');
  await p.click('[data-del]'); await p.waitForSelector('.lt-wrap, .cp-wrap');
  ok(await p.locator('.lt-entry').count() === 0, `psy ${lang} ${tag}: entry deleted`);
  const scroll = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(scroll <= 0, `psy ${lang} ${tag}: no sideways scrolling`);
  await p.context().close();
}

// ---------- 4. living inside a player (from the review of PR #22) ----------
{
  // A stand-in for Supabase whose read takes 600 ms (or fails like an offline phone), set before the page loads.
  const fakeDb = fail => `window.LH_DB = { uid:'u1', db:{ from:() => { const q = { select:() => q, eq:() => q,
      maybeSingle:() => new Promise(r => setTimeout(() => r(${fail ? "{ data:null, error:{ code:'', message:'Failed to fetch' } }" : '{ data:null, error:null }'}), 600)),
      upsert:() => Promise.resolve({ error:null }) }; return q; } } };`;
  const withDb = async (fail, url) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(fakeDb(fail));
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(url); return p;
  };
  // the learner opens a tool, then a lesson replaces the page before the account read comes back
  const p = await withDb(false, `${BASE}?course=psy#/tools/thought`);
  await p.evaluate(() => { document.getElementById('cpMain').innerHTML = '<p id="lesson">A lesson</p>'; });
  await p.waitForTimeout(1000);
  ok(await p.locator('#lesson').count() === 1 && await p.locator('.lt-form, .lt-entry, .lt-safe').count() === 0, 'slow account read: the tool does not draw over a lesson opened meanwhile');
  await p.evaluate(() => { location.hash = '#/tools'; }); await p.waitForSelector('.lt-safe');
  const main = await p.evaluate(() => { const m = document.getElementById('cpMain'); return { h: !!(m.onclick || m.oninput || m.onchange), dir: m.getAttribute('dir'), lang: m.getAttribute('lang') }; });
  ok(!main.h && main.dir === null && main.lang === null, 'tools leave no click/typing handlers and no language settings on the lesson area');
  await p.context().close();
  const q = await withDb(true, `${BASE}?course=mkt#/tools/cpd`);
  await q.waitForSelector('.lt-ch'); await q.waitForTimeout(200);
  const st = await q.locator('#ltStatus').textContent();
  ok(!/account/i.test(st) && /device/i.test(st), `offline read says "saved on this device", not "to your account" ("${st.trim()}")`);
  await q.context().close();
}

ok(errs.length === 0, 'no errors in the browser console' + (errs.length ? ': ' + [...new Set(errs)].join(' | ') : ''));
await browser.close();
console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
process.exit(fails ? 1 : 0);
