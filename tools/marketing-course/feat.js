// Tests the language switch, per-language drawings and answers, search, the floating pen and layout in both languages.
const { chromium } = require('playwright');
const S = process.argv[2], U = 'http://localhost:8765/app/course/_test.html';
(async () => {
  const b = await chromium.launch(), out = {};
  for (const [tag, w, h] of [['desk', 1366, 900], ['tab', 820, 1180], ['phone', 390, 844]]) {
    const ctx = await b.newContext({ viewport:{ width:w, height:h } }), p = await ctx.newPage(), errs = [], R = out[tag] = {};
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(U + '#/m01/1'); await p.waitForTimeout(700);
    await p.evaluate(() => { window.__noReload = 1; localStorage.removeItem('cp-lang'); });
    // 1. switch to Arabic in place
    await p.click('[data-lang="ar"]'); await p.waitForTimeout(300);
    R.noReload = await p.evaluate(() => window.__noReload === 1);
    R.dir = await p.evaluate(() => document.documentElement.dir + ' / main ' + document.getElementById('cpMain').lang);
    R.h1 = await p.textContent('.cp-h1');
    // 2. Arabic type-and-check on 1.1 Q1
    const A = await p.evaluate(() => COURSE.ar.modules.m01.parts[0].q[0].a);
    await p.fill('[data-ans="0"]', A); await p.click('[data-check="0"]'); await p.waitForTimeout(150);
    R.arModel = await p.textContent('[data-fb="0"] b');
    await p.fill('[data-ans="1"]', 'مش عارف'); await p.click('[data-check="1"]'); await p.waitForTimeout(150);
    R.arBlank = await p.textContent('[data-fb="1"] b');
    // 3. answers kept per language: English box for Q1 should be empty
    await p.click('[data-lang="en"]'); await p.waitForTimeout(300);
    R.enAnsEmpty = (await p.inputValue('[data-ans="0"]')) === '';
    // verdict-only answer in English: pick a question whose first key point is a verdict
    const vj = await p.evaluate(() => COURSE.modules.m01.parts[0].q.length - 1);
    await p.fill(`[data-ans="${vj}"]`, 'no'); await p.click(`[data-check="${vj}"]`); await p.waitForTimeout(150);
    R.enVerdictOnly = await p.textContent(`[data-fb="${vj}"] b`);
    // 4. drawings kept per language
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(100);
    await p.click('#cpPen'); await p.waitForTimeout(100);
    const box = await p.locator('.cp-lesson').boundingBox();
    await p.mouse.move(box.x + 40, box.y + 60); await p.mouse.down(); await p.mouse.move(box.x + 140, box.y + 90, { steps:6 }); await p.mouse.up();
    await p.click('[data-done]');
    await p.click('[data-lang="ar"]'); await p.waitForTimeout(300);
    R.draw = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('cp1:test:mkt2')); return { en:(d.pg['m01/1'] || []).length, ar:(d.pg['m01/1@ar'] || []).length }; });
    // 5. same spot: scroll English to section 3, switch, the same section should be near the top
    await p.click('[data-lang="en"]'); await p.waitForTimeout(300);
    await p.evaluate(() => { const el = document.querySelector('[data-a="s3"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 100); });
    await p.waitForTimeout(100);
    await p.click('[data-lang="ar"]'); await p.waitForTimeout(400);
    R.spot = await p.evaluate(() => Math.round(document.querySelector('[data-a="s3"]').getBoundingClientRect().top));
    // 6. search in Arabic: plain alef finds hamza forms
    if (w <= 900) await p.click('#cpFindBtn'); else await p.click('#cpQ');
    await p.fill('#cpQ', 'اعلان'); await p.waitForTimeout(250);
    R.findAlef = await p.evaluate(() => { const h = [...document.querySelectorAll('#cpRes .cp-hit mark')].map(m => m.textContent); return { n:h.length, sample:[...new Set(h)].slice(0, 4) }; });
    await p.fill('#cpQ', 'funnel'); await p.waitForTimeout(250);
    R.findTerm = await p.evaluate(() => [...document.querySelectorAll('#cpRes .cp-hit')].slice(0, 2).map(a => a.querySelector('.cp-rk').textContent + ' | ' + a.querySelector('b').textContent));
    await p.fill('#cpQ', 'CAC'); await p.waitForTimeout(250);
    await p.screenshot({ path:`${S}/f-${tag}-search.png` });
    await p.keyboard.press('Enter'); await p.waitForTimeout(600);
    R.jump = await p.evaluate(() => ({ hash:location.hash, marks:document.querySelectorAll('.cp-mark').length, flash:!!document.querySelector('.cp-flash') }));
    // 7. untranslated module in Arabic
    await p.goto(U + '#/m02/1'); await p.waitForTimeout(400);
    R.untranslated = await p.evaluate(() => ({ banner:!!document.querySelector('.cp-trans'), mainDir:document.getElementById('cpMain').dir, chrome:document.documentElement.dir }));
    // 8. layout: every Module 1 page in Arabic plus a sample in English, no sideways scroll; pen button visible and clear of the footer
    const over = [];
    for (const r of ['#/', '#/m01', '#/m01/1', '#/m01/2', '#/m01/3', '#/m01/4', '#/m01/5', '#/m01/assignment', '#/m01/quiz', '#/m02/1']) {
      await p.goto(U + r); await p.waitForTimeout(250);
      if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) over.push('ar ' + r);
    }
    R.fab = await p.evaluate(() => { const f = document.getElementById('cpPen').getBoundingClientRect(), ft = document.querySelector('.cp-foot'); const fr = ft && ft.getBoundingClientRect(); return { left:Math.round(f.left), bottom:Math.round(innerHeight - f.bottom), clearOfFooter:!fr || f.bottom <= fr.top || getComputedStyle(ft).position !== 'fixed' }; });
    await p.goto(U + '#/m01/2'); await p.waitForTimeout(300); await p.screenshot({ path:`${S}/f-${tag}-ar-part.png` });
    await p.click('[data-lang="en"]'); await p.waitForTimeout(300);
    for (const r of ['#/', '#/m01/2', '#/m05/3', '#/m16/quiz']) { await p.goto(U + r); await p.waitForTimeout(250); if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) over.push('en ' + r); }
    R.overflow = over; R.errs = errs;
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
