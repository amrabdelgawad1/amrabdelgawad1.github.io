// End-to-end checks in a real browser against the local test mode (server.mjs running, seed.mjs loaded).
//   node e2e.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch(e){ playwright = require('/opt/node22/lib/node_modules/playwright'); }

const BASE = process.env.BASE || 'http://localhost:8787/course/';
const DATA = path.join(import.meta.dirname, 'data');
const pool = new pg.Pool({ connectionString: process.env.PGURL || 'postgres://postgres@localhost:54329/course' });
const LEARNER = '00000000-0000-4000-8000-000000000002';
const browser = await playwright.chromium.launch();
const errors = [];
async function as(email, w){
  const ctx = await browser.newContext({ viewport:{ width:w || 390, height:844 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(email + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/403|400/.test(m.text())) errors.push(email + ': ' + m.text()); });
  await page.goto(BASE);
  await page.fill('#em', email); await page.fill('#pw', 'test'); await page.click('#signBtn');
  await page.waitForSelector('main');
  pages.push(page);
  return page;
}
const go = async (p, h) => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(300); };
const pages = [];
let n = 0; const ok = async (name, fn) => {
  try { await fn(); } catch(e){ let i = 0; for (const p of pages) await p.screenshot({ path:path.join(DATA, 'e2e-fail-' + (i++) + '.png') }).catch(() => {}); console.log('FAILED', name); throw e; }
  console.log('ok', ++n, name);
};

// Clean slate for the learner
await pool.query('delete from public.course_attempts where user_id = $1', [LEARNER]);
await pool.query('delete from public.course_item_done where user_id = $1', [LEARNER]);
await pool.query('delete from public.course_submissions where user_id = $1', [LEARNER]);

const L = await as('learner@test.local');
await ok('wrong password is refused with a clear message', async () => {
  const ctx = await browser.newContext(); const p = await ctx.newPage(); await p.goto(BASE);
  await p.fill('#em', 'learner@test.local'); await p.fill('#pw', 'nope'); await p.click('#signBtn');
  await p.waitForFunction(() => document.getElementById('signErr').textContent.length > 0);
  assert.match(await p.textContent('#signErr'), /don’t match/);
  await ctx.close();
});
await ok('new learner: home says Start, 0 of 24', async () => {
  assert.match(await L.textContent('.prog-card'), /0%.*0 of 24 items/s);
  assert.match(await L.textContent('.prog-card .btn'), /Start: 1\.1/);
});
await ok('mark complete updates progress without a reload', async () => {
  await go(L, '#/m/m1/l/1.1');
  await L.click('[data-act="done"]');
  await L.waitForSelector('[data-act="done"][aria-pressed="true"]');
  await go(L, '#/');
  assert.match(await L.textContent('.prog-card'), /1 of 24 items/);
  await L.reload(); await L.waitForSelector('.prog-card');
  assert.match(await L.textContent('.prog-card'), /1 of 24 items/, 'survives a reload');
});
await ok('quiz by keyboard only: Tab to an option, Space to pick, Enter to submit', async () => {
  await go(L, '#/m/m1/q/1.1');
  await L.waitForSelector('.opts');
  await L.focus('.opt input'); await L.keyboard.press('Space');
  await L.waitForSelector('#qSubmit:not([disabled])');
  await L.focus('#qSubmit'); await L.keyboard.press('Enter');
  await L.waitForSelector('#qNext');
  assert.ok(await L.$('.verdict'));
  assert.equal(await L.evaluate(() => document.activeElement.id), 'qNext', 'focus moves to Next');
});
await ok('leaving mid-quiz and coming back resumes at the next question', async () => {
  await go(L, '#/m/m1');
  await go(L, '#/m/m1/q/1.1');
  await L.waitForSelector('.opts');
  assert.match(await L.textContent('.hdr .t'), /Question 2 of 20/);
});
await ok('finish the quiz: result, then Retake starts fresh', async () => {
  for (;;) {
    await L.click('.opt >> nth=0'); await L.click('#qSubmit'); await L.waitForSelector('#qNext');
    const last = /result/.test(await L.textContent('#qNext'));
    await L.click('#qNext');
    if (last) break;
    await L.waitForSelector('#qSubmit');
  }
  await L.waitForSelector('.score');
  const txt = await L.textContent('.score');
  assert.match(txt, /of 20 correct/);
  await L.click('.bar-foot a:text-is("Retake")');
  await L.waitForSelector('.opts');
  assert.match(await L.textContent('.hdr .t'), /Question 1 of 20/);
});
await ok('checkpoint stays locked and says why', async () => {
  await go(L, '#/m/m1/q/1.checkpoint');
  await L.waitForSelector('.checklist');
  assert.match(location_hash(await L.url()), /\/c\/1\.checkpoint/);
});
function location_hash(u){ return new URL(u).hash; }
await ok('drill: autosave, file upload (and a too-big file refused), submit', async () => {
  await go(L, '#/m/m1/a/1.assignment');
  await L.waitForSelector('textarea#a1');
  await L.fill('#a1', 'Draft answer one');
  await L.waitForFunction(() => /Draft saved/.test(document.getElementById('saveState').textContent), null, { timeout:8000 });
  const r = await pool.query('select answers, status from public.course_submissions where user_id = $1', [LEARNER]);
  assert.equal(r.rows[0].answers['1'], 'Draft answer one'); assert.equal(r.rows[0].status, 'draft');
  const big = path.join(DATA, 'big.pdf'); await fs.writeFile(big, Buffer.alloc(11 * 1024 * 1024));
  await L.setInputFiles('#upFile', big);
  assert.match(await L.textContent('#upErr'), /over 10 MB/);
  const small = path.join(DATA, 'crm-template.pdf'); await fs.writeFile(small, '%PDF-1.4 test file');
  await L.setInputFiles('#upFile', small);
  await L.waitForSelector('.fname');
  assert.match(await L.textContent('.fname'), /crm-template\.pdf/);
  await L.click('[data-act="submitDrill"]');
  assert.match(await L.textContent('#subErr'), /Still empty: task 2/);
  for (let i = 1; i <= 12; i++) await L.fill('#a' + i, 'Answer to task ' + i);
  await L.click('[data-act="submitDrill"]');
  await L.waitForSelector('.status.ok');
  assert.match(await L.textContent('.status.ok'), /Submitted/);
  assert.ok(await L.$('#subBtn[disabled]'));
});

const AMR = await as('amr@test.local');
await ok('admin: return with a comment (comment required), learner sees it', async () => {
  await go(AMR, '#/admin/u/' + LEARNER + '/s/m1/1.assignment');
  await AMR.waitForSelector('#cmt');
  assert.ok(await AMR.$('.key'), 'answer key shown');
  await AMR.click('[data-act="ret"]');
  assert.match(await AMR.textContent('#revErr'), /Add a comment/);
  await AMR.fill('#cmt', 'Task 4: show the MAO math.');
  await AMR.click('[data-act="ret"]');
  await AMR.waitForSelector('text=Returned. It comes back here');
  await go(L, '#/'); await L.reload(); await L.waitForSelector('.prog-card');
  await go(L, '#/m/m1/a/1.assignment'); await L.waitForSelector('.status.warm');
  assert.match(await L.textContent('.status.warm'), /Task 4: show the MAO math\./);
});
await ok('learner resubmits, admin approves, drill locks', async () => {
  await L.fill('#a4', 'ARV $210,000, buyer price $102,000, MAO $90,000');
  await L.click('[data-act="submitDrill"]'); await L.waitForSelector('.status.ok');
  await go(AMR, '#/admin'); await go(AMR, '#/admin/u/' + LEARNER + '/s/m1/1.assignment');
  await AMR.waitForSelector('[data-act="ok"]'); await AMR.click('[data-act="ok"]');
  await AMR.waitForSelector('text=Approved. Nothing more to do.');
  await go(L, '#/'); await L.reload(); await L.waitForSelector('.prog-card');
  await go(L, '#/m/m1/a/1.assignment'); await L.waitForSelector('.status.ok');
  assert.ok(await L.$('textarea[readonly]'));
  assert.equal(await L.$('[data-act="submitDrill"]'), null);
});
await ok('admin: open the learner file through a signed link', async () => {
  await AMR.evaluate(() => { window.open = u => { window.__opened = u; }; });
  await AMR.click('[data-act="open"]');
  await AMR.waitForFunction(() => window.__opened);
  const url = await AMR.evaluate(() => window.__opened);
  assert.match(url, /\/storage\/v1\/object\/sign\/course\/uploads\//);
  assert.match(await (await AMR.request.get(url)).text(), /PDF-1\.4 test file/);
  // and the learner can't open someone else's file
  const other = url.replace(LEARNER, '00000000-0000-4000-8000-000000000003');
  assert.notEqual((await AMR.request.get(other)).status(), 200);
});
await ok('admin: add module re-upload, then upload a missing image', async () => {
  await pool.query("delete from storage.objects where name = 'content/m1/m1-1-7.png'");
  await go(AMR, '#/admin/add');
  await AMR.setInputFiles('#jsonFile', path.join(DATA, 'module-1.json'));
  await AMR.waitForSelector('#addBtn');
  assert.match(await AMR.textContent('#jsonInfo'), /11 lessons · 231 questions · replaces/);
  await AMR.click('#addBtn');
  await AMR.waitForFunction(() => /1 of 32 images still needed/.test(document.getElementById('imgState').textContent));
  await AMR.setInputFiles('#imgFiles', path.join(DATA, 'kit-thumbnails/m1-1-7.png'));
  await AMR.waitForFunction(() => /All 32 images are uploaded/.test(document.getElementById('imgState').textContent));
});
await ok('admin: a broken module file is refused with the reason', async () => {
  const bad = JSON.parse(await fs.readFile(path.join(DATA, 'module-1.json'), 'utf8'));
  bad.course.modules[0].items[0].quiz.questions[0].options.forEach(o => o.correct = false);
  await fs.writeFile(path.join(DATA, 'bad.json'), JSON.stringify(bad));
  await go(AMR, '#/admin/add');
  await AMR.setInputFiles('#jsonFile', path.join(DATA, 'bad.json'));
  await AMR.click('#addBtn');
  await AMR.waitForFunction(() => document.getElementById('jsonErr').textContent.length > 0);
  assert.match(await AMR.textContent('#jsonErr'), /Not added: question m1-1-1-q01/);
});
await ok('learner cannot open admin', async () => {
  await go(L, '#/admin'); await L.waitForTimeout(300);
  assert.equal(new URL(L.url()).hash, '#/');
});
await ok('no horizontal scroll on any learner screen at 390px, and at 200% zoom (195px)', async () => {
  for (const w of [390, 195]) {
    const P = await as('maya@test.local', w);
    for (const h of ['#/', '#/m/m1', '#/m/m1/l/1.2.s2', '#/m/m1/l/1.7', '#/m/m1/l/1.1', '#/m/m1/q/1.3', '#/m/m1/c/1.checkpoint', '#/m/m1/a/1.assignment', '#/locked/2']) {
      await go(P, h); await P.waitForTimeout(200);
      const over = await P.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(over <= 0, w + 'px ' + h + ' scrolls sideways by ' + over + 'px');
    }
  }
});
await ok('sign out returns to sign in', async () => {
  await go(L, '#/'); await L.click('[data-act="menu"]'); await L.click('[data-m="out"]');
  await L.waitForSelector('#signForm');
});
assert.deepEqual(errors, [], 'no script errors (CSP violations show here too)');
console.log('\nAll ' + n + ' browser checks passed.');
await browser.close(); await pool.end();
