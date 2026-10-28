// Screenshots of every /course screen from the local test mode (server.mjs running, seed.mjs loaded).
// They show course content, so they're written to OUT (default: data/screens/, gitignored), never to the repo.
//   OUT=/some/folder WIDTH=390 node shots.mjs [only-these-names...]
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch(e){ playwright = require('/opt/node22/lib/node_modules/playwright'); }

const BASE = process.env.BASE || 'http://localhost:8787/course/';
const OUT = process.env.OUT || path.join(import.meta.dirname, 'data/screens');
const W = Number(process.env.WIDTH || 390), H = Number(process.env.HEIGHT || 844);
const only = process.argv.slice(2);
await fs.mkdir(OUT, { recursive:true });

const browser = await playwright.chromium.launch();
async function as(email, ua){
  const ctx = await browser.newContext({ viewport:{ width:W, height:H }, deviceScaleFactor:2, isMobile:W < 768, hasTouch:W < 768,
    userAgent:ua || 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto(BASE);
  if (email) {
    await page.fill('#em', email); await page.fill('#pw', 'test'); await page.click('#signBtn');
    await page.waitForSelector('main');
  }
  return page;
}
async function settle(page){
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { for (const i of document.images) if (!i.complete) await new Promise(r => { i.onload = i.onerror = r; }); });
  await page.waitForTimeout(150);
}
async function shot(page, name, full){
  if (only.length && !only.includes(name)) return;
  await settle(page);
  await page.screenshot({ path:path.join(OUT, name + '.png'), fullPage:!!full });
  console.log('saved', name);
}
const go = async (page, hash) => { await page.evaluate(h => location.hash = h, hash); await page.waitForTimeout(250); await settle(page); };

// Signed out
let p = await as(null);
await page_wait(p, '#signForm');
await shot(p, '00-sign-in');
async function page_wait(pg, sel){ await pg.waitForSelector(sel); }

// Maya: partway through Module 1, like the approved design
p = await as('maya@test.local');
await shot(p, '01-course-home');
await shot(p, '01-course-home-full', true);
await go(p, '#/m/m1');
await shot(p, '02-module');
await shot(p, '02-module-full', true);
await go(p, '#/m/m1/l/1.2.s2');
await shot(p, '03-lesson');
await shot(p, '03-lesson-full', true);
await p.click('[data-act="view"]'); await p.waitForTimeout(300);
await shot(p, '03b-guide-page');
await p.keyboard.press('Escape');
// Quiz: answer 8 right, then pick on question 9 and submit
await go(p, '#/m/m1/q/1.2.s2/new');
await p.waitForSelector('.opts');
for (let i = 0; i < 8; i++) {
  await p.click('.opt >> nth=0'); await p.click('#qSubmit'); await p.waitForSelector('#qNext'); await p.click('#qNext'); await p.waitForSelector('#qSubmit');
}
await shot(p, '04-quiz-question');
await p.click('.opt >> nth=1');
await shot(p, '04b-quiz-picked');
await p.click('#qSubmit'); await p.waitForSelector('#qNext');
await shot(p, '04c-quiz-feedback');
// finish the rest
for (;;) {
  const last = await p.$eval('#qNext', b => /result/.test(b.textContent));
  await p.click('#qNext');
  if (last) break;
  await p.waitForSelector('#qSubmit'); await p.click('.opt >> nth=1'); await p.click('#qSubmit'); await p.waitForSelector('#qNext');
}
await p.waitForSelector('.score');
await shot(p, '05-result');
await shot(p, '05-result-full', true);
await go(p, '#/m/m1/c/1.checkpoint');
await shot(p, '06-checkpoint-locked', true);
await go(p, '#/m/m1/a/1.assignment');
await shot(p, '07-assignment');
await shot(p, '07-assignment-full', true);
await go(p, '#/locked/2');
await shot(p, '08-module-locked');
await go(p, '#/install');
await shot(p, '09-install');
await go(p, '#/');
await p.click('[data-act="menu"]'); await p.waitForTimeout(200);
await shot(p, '10-menu');

// Omar: everything done but the checkpoint
p = await as('omar@test.local');
await go(p, '#/m/m1/c/1.checkpoint');
await shot(p, '11-checkpoint-open');
await go(p, '#/m/m1/a/1.assignment');
await shot(p, '12-assignment-submitted');

// No access
p = await as('nocourse@test.local');
await shot(p, '13-no-access');

// Amr: admin
p = await as('amr@test.local');
await go(p, '#/admin');
await shot(p, '20-admin', true);
await go(p, '#/admin/u/00000000-0000-4000-8000-000000000004');
await shot(p, '21-admin-learner', true);
const att = await p.$eval('a.item[href*="/a/"]', a => a.getAttribute('href'));
await go(p, att);
await shot(p, '22-admin-attempt');
await go(p, '#/admin/u/00000000-0000-4000-8000-000000000004/s/m1/1.assignment');
await shot(p, '23-admin-review', true);
await go(p, '#/admin/add');
await shot(p, '24-admin-add-module');

// iPhone: the install steps
p = await as('learner@test.local', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
await shot(p, '14-home-new-learner-iphone', true);
await go(p, '#/install');
await shot(p, '09b-install-iphone');

await browser.close();
