// Plays every quiz in Module 1 through the browser, all questions, as Omar (who has the checkpoint open).
// Checks each question renders with its options and gets feedback with an explanation.
//   node e2e-full.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch(e){ playwright = require('/opt/node22/lib/node_modules/playwright'); }
const BASE = process.env.BASE || 'http://localhost:8787/course/';
const file = JSON.parse(await fs.readFile(path.join(import.meta.dirname, 'data/module-1.json'), 'utf8'));
const mod = file.course.modules[0];
const quizzes = []; (function w(a){ for (const i of a) { if (i.quiz) quizzes.push(i); if (i.items) w(i.items); } })(mod.items);
const browser = await playwright.chromium.launch();
const p = await (await browser.newContext({ viewport:{ width:390, height:844 } })).newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.goto(BASE); await p.fill('#em', 'omar@test.local'); await p.fill('#pw', 'test'); await p.click('#signBtn'); await p.waitForSelector('main');
let total = 0;
for (const it of quizzes) {
  await p.evaluate(h => location.hash = h, '#/m/' + mod.id + '/q/' + it.id + '/new');
  for (let i = 0; i < it.quiz.questions.length; i++) {
    const q = it.quiz.questions[i];
    await p.waitForSelector('#qSubmit');
    assert.equal((await p.textContent('#qp')).trim(), q.prompt, it.id + ' question ' + (i + 1));
    assert.equal(await p.$$eval('.opt', o => o.length), q.options.length);
    // the right answer on every question but the second, so every quiz passes and the checkpoint stays open
    const wrong = i === 1;
    const picks = wrong ? q.options.filter(o => !o.correct).slice(0, 1) : q.options.filter(o => o.correct);
    for (const o of picks) await p.click('.opt:has(input[value="' + o.id + '"])');
    await p.click('#qSubmit'); await p.waitForSelector('.verdict');
    assert.equal(await p.textContent('.verdict b'), wrong ? 'Not quite' : 'Correct', it.id + ' q' + (i + 1));
    assert.equal((await p.textContent('.verdict p')).trim(), q.explanation);
    await p.click('#qNext'); total++;
  }
  await p.waitForSelector('.score');
  const want = Math.floor((it.quiz.questions.length - 1) * 100 / it.quiz.questions.length);
  assert.match(await p.textContent('.score .num'), new RegExp('^' + want + '%'));
  console.log('ok', it.id, it.quiz.questions.length, 'questions, scored', want + '%');
}
assert.equal(total, 231); assert.deepEqual(errors, []);
console.log('\nAll ' + total + ' questions played through the app.');
await browser.close();
