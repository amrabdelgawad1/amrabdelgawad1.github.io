// Local test mode: builds the local database and loads the course kit into it.
// The kit is read from KIT (a course-kit folder outside the repo) and copied into data/, which is gitignored.
//
//   KIT=/path/to/course-kit PGURL=postgres://postgres@localhost:54329/course node seed.mjs [--fresh]
//
// Test accounts (password "test" in test mode):
//   amr@test.local      the owner (is_tracker_admin)
//   learner@test.local  a team member with the "Acquisitions course" switch on, no progress
//   maya@test.local     a team member partway through Module 1 (4 of 24 done, like the design)
//   omar@test.local     a team member who finished everything but the checkpoint
//   nocourse@test.local a team member without the switch (should be turned away)
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const HERE = import.meta.dirname, ROOT = path.resolve(HERE, '../..'), DATA = path.join(HERE, 'data');
const KIT = process.env.KIT;
const pool = new pg.Pool({ connectionString: process.env.PGURL || 'postgres://postgres@localhost:54329/course' });
const q = (s, a) => pool.query(s, a);

const U = {
  amr:      ['00000000-0000-4000-8000-000000000001', 'amr@test.local', 'Amr Abdelgawad'],
  learner:  ['00000000-0000-4000-8000-000000000002', 'learner@test.local', 'Test Learner'],
  maya:     ['00000000-0000-4000-8000-000000000003', 'maya@test.local', 'Maya Hassan'],
  omar:     ['00000000-0000-4000-8000-000000000004', 'omar@test.local', 'Omar Farouk'],
  nocourse: ['00000000-0000-4000-8000-000000000005', 'nocourse@test.local', 'No Course']
};

async function as(user, sql, args){
  const c = await pool.connect();
  try {
    await c.query('begin'); await c.query('set local role authenticated');
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub:user[0], role:'authenticated', aal:'aal1' })]);
    const r = await c.query(sql, args); await c.query('commit'); return r;
  } catch(e){ await c.query('rollback'); throw e; } finally { c.release(); }
}

if (process.argv.includes('--fresh')) {
  await q('drop schema if exists public cascade; create schema public; grant usage on schema public to anon, authenticated; grant all on schema public to postgres;');
  await q('drop schema if exists auth cascade; drop schema if exists storage cascade;');
  await fs.rm(path.join(DATA, 'storage'), { recursive:true, force:true });
}
await q(await fs.readFile(path.join(HERE, 'stubs.sql'), 'utf8'));
for (const f of (await fs.readdir(path.join(ROOT, 'supabase/migrations'))).filter(f => f.endsWith('.sql')).sort())
  await q(await fs.readFile(path.join(ROOT, 'supabase/migrations', f), 'utf8'));

for (const [id, email, name] of Object.values(U)) {
  await q('insert into auth.users (id, email) values ($1, $2) on conflict do nothing', [id, email]);
}
await q('insert into public.tracker_admins values ($1) on conflict do nothing', [U.amr[0]]);
for (const k of ['learner', 'maya', 'omar', 'nocourse'])
  await q(`insert into public.members (user_id, name, email, company_id, active, access) values ($1, $2, $3, 1, true, $4)
           on conflict (user_id) do update set access = excluded.access`, [U[k][0], U[k][2], U[k][1], k === 'nocourse' ? ['learn'] : ['course']]);

// Content: copy the kit into data/ and load it the way Admin > Add module does
await fs.mkdir(DATA, { recursive:true });
if (KIT) {
  await fs.copyFile(path.join(KIT, 'content/module-1.json'), path.join(DATA, 'module-1.json'));
  for (const dir of ['thumbnails', 'source-images']) await fs.cp(path.join(KIT, dir), path.join(DATA, 'kit-' + dir), { recursive:true });
}
const file = JSON.parse(await fs.readFile(path.join(DATA, 'module-1.json'), 'utf8'));
const added = (await as(U.amr, 'select public.course_add_module($1::jsonb) as r', [JSON.stringify(file)])).rows[0].r;
for (const m of added) {
  for (const img of m.images) {
    const src = img.startsWith('source-images/') ? path.join(DATA, 'kit-' + img) : path.join(DATA, 'kit-thumbnails', img);
    const name = 'content/' + m.id + '/' + img;
    await fs.mkdir(path.dirname(path.join(DATA, 'storage', name)), { recursive:true });
    await fs.copyFile(src, path.join(DATA, 'storage', name));
    await q("insert into storage.objects (bucket_id, name, owner) values ('course', $1, $2) on conflict do nothing", [name, U.amr[0]]);
  }
  console.log('Loaded module', m.number, m.title, '·', m.lessons, 'lessons ·', m.questions, 'questions ·', m.images.length, 'images');
}

// Progress for the sample learners, played through the real functions
const mod = file.course.modules[0];
const flat = []; (function walk(items){ for (const it of items) { if (it.type === 'group') walk(it.items); else flat.push(it); } })(mod.items);
const lessons = flat.filter(i => i.type === 'lesson');
async function playQuiz(user, item, rightCount){
  await q('delete from public.course_attempts where user_id = $1 and item_id = $2', [user[0], item.id]);
  const st = (await as(user, 'select public.course_quiz_start($1, $2, true) as r', [mod.id, item.id])).rows[0].r;
  let i = 0;
  for (const qu of item.quiz.questions) {
    const right = qu.options.filter(o => o.correct).map(o => o.id), wrong = qu.options.filter(o => !o.correct).map(o => o.id).slice(0, 1);
    await as(user, 'select public.course_quiz_answer($1, $2, $3) as r', [st.attempt, qu.id, i++ < rightCount ? right : wrong]);
  }
  return (await as(user, 'select public.course_quiz_finish($1) as r', [st.attempt])).rows[0].r;
}
for (const u of [U.maya, U.omar]) {
  await q('delete from public.course_item_done where user_id = $1', [u[0]]);
  await q('delete from public.course_submissions where user_id = $1', [u[0]]);
}
// Maya: 1.1 done and passed (18 of 20), Session 1 done and passed (20 of 24), like the approved design
await as(U.maya, 'select public.course_mark_done($1, $2)', [mod.id, lessons[0].id]);
await playQuiz(U.maya, lessons[0], 18);
await as(U.maya, 'select public.course_mark_done($1, $2)', [mod.id, lessons[1].id]);
await playQuiz(U.maya, lessons[1], 20);
// Omar: every lesson done and passed, the drill submitted, the checkpoint not yet taken
for (const l of lessons) { await as(U.omar, 'select public.course_mark_done($1, $2)', [mod.id, l.id]); await playQuiz(U.omar, l, l.quiz.questions.length); }
const drill = flat.find(i => i.type === 'assignment');
const ans = Object.fromEntries(drill.tasks.map((t, i) => [String(i + 1), 'Sample answer for task ' + (i + 1) + '. Written in plain words for the test account.']));
await as(U.omar, 'select public.course_save_answers($1, $2, $3::jsonb, true)', [mod.id, drill.id, JSON.stringify(ans)]);

await fs.writeFile(path.join(DATA, 'accounts.txt'), Object.values(U).map(u => u[1]).join('\n') + '\n(password: test)\n');
console.log('Seeded. Accounts:', Object.values(U).map(u => u[1]).join(', '), '(password: test)');
await pool.end();
