// Checks the course database rules on the local test database (run seed.mjs first).
//   PGURL=... node test-sql.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.PGURL || 'postgres://postgres@localhost:54329/course' });
const id = n => '00000000-0000-4000-8000-00000000000' + n;
const AMR = id(1), LEARNER = id(2), MAYA = id(3), OMAR = id(4), NOCOURSE = id(5);
const file = JSON.parse(await fs.readFile(path.join(import.meta.dirname, 'data/module-1.json'), 'utf8'));
const mod = file.course.modules[0];
const flat = []; (function walk(items){ for (const it of items) { if (it.type === 'group') walk(it.items); else flat.push(it); } })(mod.items);
const lessons = flat.filter(i => i.type === 'lesson'), drill = flat.find(i => i.type === 'assignment'), cp = flat.find(i => i.type === 'checkpoint');

async function as(user, sql, args){
  const c = await pool.connect();
  try {
    await c.query('begin'); await c.query('set local role authenticated');
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub:user, role:'authenticated' })]);
    const r = await c.query(sql, args); await c.query('commit'); return r.rows;
  } catch(e){ await c.query('rollback'); throw e; } finally { c.release(); }
}
const one = async (u, sql, args) => (await as(u, sql, args))[0].r;
const fails = async (p, re) => { try { await p; } catch(e){ assert.match(e.message, re); return; } assert.fail('expected an error matching ' + re); };
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', n, name); };

await ok('no course switch: turned away', () => fails(one(NOCOURSE, 'select public.course_state(true) as r'), /no access/));
await ok('signed out: turned away', () => fails(one(null, 'select public.course_state(true) as r'), /no access|invalid input/));

const st = await one(LEARNER, 'select public.course_state(true) as r');
await ok('state has no answers, explanations or answer key', async () => {
  const s = JSON.stringify(st);
  assert.ok(!/"correct"\s*:/.test(s), 'correct leaked'); assert.ok(!/"explanation"/.test(s), 'explanation leaked'); assert.ok(!/reviewerAnswerKey/.test(s), 'answer key leaked');
  assert.equal(st.modules.length, 1); assert.equal(st.totalModules, 14); assert.equal(st.isAdmin, false);
  assert.ok(st.modules[0].open); assert.equal(st.modules[0].checkpointOpen, false);
  const got = []; (function walk(items){ for (const it of items) { if (it.items) walk(it.items); else got.push(it); } })(st.modules[0].items);
  assert.equal(got.find(i => i.id === lessons[3].id).bodyMarkdown, lessons[3].bodyMarkdown, 'lesson body present');
  assert.equal(got.find(i => i.id === lessons[3].id).quiz.questions.length, lessons[3].quiz.questions.length);
});
await ok('full content table is unreadable', () => fails(as(LEARNER, 'select * from public.course_modules'), /permission denied/));
await ok('no direct writes', () => fails(as(LEARNER, "insert into public.course_attempts (user_id, module_id, item_id, total, pass_mark, score, passed) values ($1, 'm1', '1.checkpoint', 25, 85, 100, true)", [LEARNER]), /permission denied/));
await ok('internal helpers not callable', () => fails(as(LEARNER, "select public.course_module_open($1, 'm1')", [LEARNER]), /permission denied/));
await ok("other people's attempts are invisible", async () => {
  assert.equal((await as(LEARNER, 'select count(*)::int as c from public.course_attempts where user_id = $1', [MAYA]))[0].c, 0);
  assert.ok((await as(AMR, 'select count(*)::int as c from public.course_attempts where user_id = $1', [MAYA]))[0].c > 0);
});
await ok('admin functions refused for learners', async () => {
  await fails(one(LEARNER, 'select public.course_admin_learners() as r'), /admin only/);
  await fails(one(LEARNER, 'select public.course_add_module($1::jsonb) as r', [JSON.stringify(file)]), /admin only/);
  await fails(one(LEARNER, "select public.course_admin_submission($1, 'm1', $2) as r", [OMAR, drill.id]), /admin only/);
});
await ok('checkpoint locked until lessons passed and drill submitted', async () => {
  await fails(one(LEARNER, 'select public.course_quiz_start($1, $2) as r', ['m1', cp.id]), /checkpoint locked/);
  const o = await one(OMAR, 'select public.course_state(true) as r'); assert.equal(o.modules[0].checkpointOpen, true);
});
await ok('progress: Maya 4 of 24, Omar 23 of 24', async () => {
  const r = await one(AMR, 'select public.course_admin_learners() as r');
  const m = r.find(x => x.userId === MAYA), o = r.find(x => x.userId === OMAR);
  assert.equal(m.done, 4); assert.equal(m.total, 24); assert.equal(o.done, 23); assert.equal(o.waiting, 1);
  assert.ok(!r.find(x => x.userId === NOCOURSE));
});

const L = lessons[2], qs = L.quiz.questions;
const single = qs.find(q => q.type === 'single'), multi = flat.flatMap(i => i.quiz ? i.quiz.questions.map(q => [i, q]) : []).find(([, q]) => q.type === 'multiple');
await ok('grading: single choice', async () => {
  const s = await one(LEARNER, 'select public.course_quiz_start($1, $2, true) as r', ['m1', L.id]);
  await fails(one(LEARNER, 'select public.course_quiz_answer($1, $2, $3) as r', [s.attempt, single.id, ['A', 'B']]), /pick one/);
  await fails(one(LEARNER, 'select public.course_quiz_answer($1, $2, $3) as r', [s.attempt, single.id, ['Z']]), /pick an option/);
  await fails(one(LEARNER, 'select public.course_quiz_answer($1, $2, $3) as r', [s.attempt, 'not-a-question', ['A']]), /no such question/);
  const wrong = single.options.find(o => !o.correct).id, right = single.options.find(o => o.correct).id;
  const a = await one(LEARNER, 'select public.course_quiz_answer($1, $2, $3) as r', [s.attempt, single.id, [wrong]]);
  assert.equal(a.right, false); assert.equal(a.explanation, single.explanation); assert.ok(!('correct' in a));
  const again = await one(LEARNER, 'select public.course_quiz_answer($1, $2, $3) as r', [s.attempt, single.id, [right]]);
  assert.equal(again.right, false, 'an answer cannot be changed');
  await fails(one(LEARNER, 'select public.course_quiz_finish($1) as r', [s.attempt]), /answer every question/);
  await fails(one(MAYA, 'select public.course_quiz_answer($1, $2, $3) as r', [s.attempt, qs[1].id, ['A']]), /no such attempt/);
  const resumed = await one(LEARNER, 'select public.course_quiz_start($1, $2) as r', ['m1', L.id]);
  assert.equal(resumed.attempt, s.attempt); assert.equal(resumed.answered[single.id].right, false);
});
await ok('grading: multiple choice needs every correct option and nothing else', async () => {
  const [it, q] = multi;
  const want = q.options.filter(o => o.correct).map(o => o.id), other = q.options.filter(o => !o.correct).map(o => o.id);
  for (const [picks, expect] of [[want, true], [want.slice(0, -1).length ? want.slice(0, -1) : other.slice(0, 1), false], [want.concat(other.slice(0, 1)), false]]) {
    const s = await one(LEARNER, 'select public.course_quiz_start($1, $2, true) as r', ['m1', it.id]);
    const a = await one(LEARNER, 'select public.course_quiz_answer($1, $2, $3) as r', [s.attempt, q.id, picks]);
    assert.equal(a.right, expect, JSON.stringify(picks));
  }
});
async function take(user, item, rightCount){
  const s = await one(user, 'select public.course_quiz_start($1, $2, true) as r', ['m1', item.id]);
  let i = 0;
  for (const q of item.quiz.questions) {
    const right = q.options.filter(o => o.correct).map(o => o.id), wrong = [q.options.find(o => !o.correct).id];
    await one(user, 'select public.course_quiz_answer($1, $2, $3) as r', [s.attempt, q.id, i++ < rightCount ? right : wrong]);
  }
  return one(user, 'select public.course_quiz_finish($1) as r', [s.attempt]);
}
await ok('result: score, pass mark, review without the correct option', async () => {
  const r = await take(LEARNER, lessons[0], 15); // 15 of 20 = 75%
  assert.equal(r.score, 75); assert.equal(r.passed, false); assert.equal(r.review.length, 20);
  assert.ok(r.review.every(x => typeof x.explanation === 'string' && !('options' in x) && !('correct' in x)));
  const r2 = await take(LEARNER, lessons[0], 16); assert.equal(r2.score, 80); assert.equal(r2.passed, true);
});
await ok('checkpoint passes at 85%; the next module stays closed until module 2 exists', async () => {
  const f = await take(OMAR, cp, 21); assert.equal(f.score, 84); assert.equal(f.passed, false);
  const p = await take(OMAR, cp, 22); assert.equal(p.score, 88); assert.equal(p.passed, true);
  const after = await take(OMAR, cp, 10); assert.equal(after.passed, false);
});
await ok('module 2 opens after the module 1 checkpoint, and stays open', async () => {
  const m2 = structuredClone(mod); m2.id = 'm2-test'; m2.number = 2; m2.title = 'Test Module Two';
  (function re(items){ for (const it of items) { it.id = 'T' + it.id; if (it.quiz) it.quiz.questions.forEach(q => q.id = 'T' + q.id); if (it.items) re(it.items); } })(m2.items);
  await one(AMR, 'select public.course_add_module($1::jsonb) as r', [JSON.stringify({ course:{ title:file.course.title, totalModules:14, modules:[m2] } })]);
  const o = await one(OMAR, 'select public.course_state(true) as r'), l = await one(LEARNER, 'select public.course_state() as r');
  assert.equal(o.modules[1].open, true, 'Omar passed the checkpoint once, so module 2 is open');
  assert.equal(l.modules[1].open, false);
  assert.ok(!l.modules[1].items.some(i => i.bodyMarkdown), 'locked module: outline only');
  await fails(one(LEARNER, 'select public.course_quiz_start($1, $2) as r', ['m2-test', 'T1.1']), /module locked/);
  await as(AMR, "delete from public.course_modules where id = 'm2-test'").catch(async () => pool.query("delete from public.course_modules where id = 'm2-test'"));
  await pool.query("delete from public.course_modules where id = 'm2-test'");
});
await ok('add module: bad files are refused', async () => {
  const bad = structuredClone(mod); bad.items[0].quiz.questions[0].options.forEach(o => o.correct = false);
  await fails(one(AMR, 'select public.course_add_module($1::jsonb) as r', [JSON.stringify({ course:{ modules:[bad] } })]), /missing options or correct/);
  await fails(one(AMR, 'select public.course_add_module($1::jsonb) as r', [JSON.stringify({ nope:1 })]), /course.modules/);
});
await ok('drill: draft, submit, return, resubmit, approve, then locked', async () => {
  const ans = Object.fromEntries(drill.tasks.map((t, i) => [String(i + 1), 'answer ' + (i + 1)]));
  await fails(one(LEARNER, 'select public.course_save_answers($1, $2, $3::jsonb, true) as r', ['m1', drill.id, JSON.stringify({ 1:'only one' })]), /every task/);
  assert.equal((await one(LEARNER, 'select public.course_save_answers($1, $2, $3::jsonb, false) as r', ['m1', drill.id, JSON.stringify({ 1:'draft', 99:'ignored' })])).status, 'draft');
  await fails(one(AMR, 'select public.course_review($1, $2, $3, true, null) as r', [LEARNER, 'm1', drill.id]), /nothing waiting/);
  assert.equal((await one(LEARNER, 'select public.course_save_answers($1, $2, $3::jsonb, true) as r', ['m1', drill.id, JSON.stringify(ans)])).status, 'submitted');
  await fails(one(AMR, 'select public.course_review($1, $2, $3, false, $4) as r', [LEARNER, 'm1', drill.id, '  ']), /add a comment/);
  assert.equal((await one(AMR, 'select public.course_review($1, $2, $3, false, $4) as r', [LEARNER, 'm1', drill.id, 'Task 4: redo the MAO.'])).status, 'needs_changes');
  const s1 = await one(LEARNER, 'select public.course_state(true) as r');
  assert.equal(s1.submissions['m1/' + drill.id].status, 'needs_changes'); assert.equal(s1.submissions['m1/' + drill.id].comment, 'Task 4: redo the MAO.');
  await one(LEARNER, 'select public.course_save_answers($1, $2, $3::jsonb, true) as r', ['m1', drill.id, JSON.stringify(ans)]);
  const sub = await one(AMR, 'select public.course_admin_submission($1, $2, $3) as r', [LEARNER, 'm1', drill.id]);
  assert.equal(sub.answerKey.length, 7); assert.equal(sub.history.length, 3);
  await one(AMR, 'select public.course_review($1, $2, $3, true, null) as r', [LEARNER, 'm1', drill.id]);
  await fails(one(LEARNER, 'select public.course_save_answers($1, $2, $3::jsonb, false) as r', ['m1', drill.id, JSON.stringify(ans)]), /already approved/);
  await fails(as(LEARNER, 'select public.course_set_file($1, $2, $3, $4)', ['m1', drill.id, 'uploads/' + MAYA + '/x.pdf', 'x.pdf']), /bad file path|already approved/);
});
await ok('storage: content readable with access only; uploads only in your own folder', async () => {
  const name = 'content/m1/' + mod.thumbnail;
  assert.equal((await as(LEARNER, "select count(*)::int as c from storage.objects where name = $1", [name]))[0].c, 1);
  assert.equal((await as(NOCOURSE, "select count(*)::int as c from storage.objects where name = $1", [name]))[0].c, 0);
  await fails(as(LEARNER, "insert into storage.objects (bucket_id, name) values ('course', 'content/m1/evil.png')"), /row-level security/);
  await fails(as(LEARNER, "insert into storage.objects (bucket_id, name) values ('course', $1)", ['uploads/' + MAYA + '/1.assignment/x.pdf']), /row-level security/);
  await as(LEARNER, "insert into storage.objects (bucket_id, name) values ('course', $1)", ['uploads/' + LEARNER + '/1.assignment/mine.pdf']);
  assert.equal((await as(MAYA, "select count(*)::int as c from storage.objects where name like 'uploads/%'"))[0].c, 0);
  assert.equal((await as(AMR, "select count(*)::int as c from storage.objects where name like 'uploads/%'"))[0].c, 1);
  await pool.query("delete from storage.objects where name like 'uploads/%'");
});
await ok('admin sees one learner and one attempt in full', async () => {
  const l = await one(AMR, 'select public.course_admin_learner($1) as r', [MAYA]);
  assert.equal(l.attempts.length, 2);
  const a = await one(AMR, 'select public.course_admin_attempt($1) as r', [l.attempts[0].id]);
  assert.ok(a.questions[0].options.some(o => o.correct === true)); assert.ok(a.questions[0].answer.picks);
});
// Reset the learner account so screenshots start clean
await pool.query('delete from public.course_attempts where user_id = $1', [LEARNER]);
await pool.query('delete from public.course_submissions where user_id = $1', [LEARNER]);
await pool.query("delete from public.course_attempts where user_id = $1 and item_id = $2", [OMAR, cp.id]);
console.log('\nAll ' + n + ' checks passed.');
await pool.end();
