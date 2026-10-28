// Visits every page of every built module on three screen sizes; checks errors, overflow, locks and a full quiz pass.
const { chromium } = require('playwright');
(async () => {
  const S = process.argv[2], mods = process.argv[3].split(','), b = await chromium.launch(), U = 'http://localhost:8765/app/course/_test.html', out = {};
  for (const [w, h, tag] of [[1366, 900, 'desk'], [820, 1180, 'tablet'], [390, 844, 'phone']]) {
    const ctx = await b.newContext({ viewport:{ width:w, height:h } }); const p = await ctx.newPage(); const errs = [], over = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    const visit = async hash => { await p.goto(U + hash); await p.waitForTimeout(120); if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) over.push(hash); };
    await visit('#/'); await p.waitForTimeout(500);
    let pages = 1;
    for (const id of mods) {
      const n = await p.evaluate(id => COURSE.modules[id].parts.length, id);
      await visit('#/' + id); pages++;
      for (let i = 1; i <= n; i++) { await visit(`#/${id}/${i}`); pages++; }
      await visit(`#/${id}/assignment`); await visit(`#/${id}/quiz`); pages += 2;
      if (tag === 'desk') { await p.goto(U + `#/${id}/2`); await p.waitForTimeout(150); await p.screenshot({ path:`${S}/${id}-${tag}-part2.png` }); }
    }
    // learner view: module 2 locked until module 1 checkpoint is passed
    await p.goto(U + '#/'); await p.waitForTimeout(200); if (await p.isVisible('#cpAsLearner')) await p.check('#cpAsLearner'); else { await p.click('#cpMenu'); await p.check('[data-learner]'); } await p.goto(U + '#/' + mods[1]); await p.waitForTimeout(150);
    const lockedBefore = (await p.textContent('#cpMain')).includes('is locked');
    await p.goto(U + '#/' + mods[0] + '/quiz'); await p.click('[data-qstart]');
    const answers = await p.evaluate(id => COURSE.modules[id].quiz.map(q => q.c), mods[0]);
    for (const c of answers) { for (const x of c) await p.click(`.cp-opt input[value="${x}"]`); await p.click('[data-qsubmit]'); await p.click('[data-qnext]'); }
    await p.waitForTimeout(150); const score = (await p.textContent('.cp-score')).trim(), msg = await p.textContent('.cp-quiz h2');
    await p.goto(U + '#/' + mods[1]); await p.waitForTimeout(150); const openAfter = !(await p.textContent('#cpMain')).includes('is locked');
    if (tag !== 'desk') await p.screenshot({ path:`${S}/${mods[1]}-${tag}-overview.png` });
    out[tag] = { pages, errs, overflow:over, lockedBefore, score, msg, openAfter }; await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
