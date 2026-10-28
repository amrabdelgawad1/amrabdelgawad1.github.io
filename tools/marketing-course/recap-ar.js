// Arabic recap: Module 1 in Arabic (RTL, links work), Module 2 in English with the note, switching keeps your spot, search finds recap points.
const { chromium } = require('playwright');
(async () => { const S = process.argv[2], b = await chromium.launch(), U = 'http://localhost:8765/app/course/_test.html', out = {};
  for (const [w, h, tag] of [[1366, 900, 'desk'], [820, 1180, 'tab'], [390, 844, 'phone']]) {
    const p = await (await b.newContext({ viewport:{ width:w, height:h } })).newPage(), errs = [], r = {};
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.goto(U + '#/m01/recap'); await p.waitForTimeout(400);
    await p.evaluate(() => window.scrollTo(0, document.querySelector('[data-a="traps"]').offsetTop - 100));
    const before = await p.evaluate(() => document.querySelector('[data-a="traps"]').getBoundingClientRect().top);
    await p.click('[data-lang="ar"]'); await p.waitForTimeout(400);
    r.switch = await p.evaluate(b => ({ dir:document.getElementById('cpMain').dir, h2:document.querySelector('[data-a="traps"] h2').textContent, keptSpot:Math.abs(document.querySelector('[data-a="traps"]').getBoundingClientRect().top - b) < 4, firstIdea:document.querySelector('[data-a="i0_0"]').textContent.slice(0, 40), banner:!!document.querySelector('.cp-trans') }), before);
    await p.screenshot({ path:`${S}/recap-ar-${tag}.png` });
    await p.evaluate(() => window.scrollTo(0, document.querySelector('[data-a="check"]').offsetTop - 80)); await p.click('.cp-checks summary'); await p.screenshot({ path:`${S}/recap-ar-${tag}-2.png` });
    await p.click('[data-a="c0"] a[data-go]'); await p.waitForTimeout(500); r.arLink = await p.evaluate(() => location.hash + ' ' + (document.querySelector('.cp-flash') || {}).dataset?.a);
    await p.goto(U + '#/m02/recap'); await p.waitForTimeout(300);
    r.m02 = await p.evaluate(() => ({ banner:!!document.querySelector('.cp-trans'), dir:document.getElementById('cpMain').dir, side:document.querySelector('.cp-item[aria-current="page"]').textContent.trim() }));
    // search in Arabic for a recap-only phrase, and in English
    await p.goto(U + '#/'); await p.waitForTimeout(300);
    if (tag === 'desk') { await p.fill('#cpQ', 'نقطة ضعف'); } else { await p.click('#cpFindBtn'); await p.fill('#cpQ', 'نقطة ضعف'); }
    await p.waitForTimeout(200); r.searchAr = await p.evaluate(() => [...document.querySelectorAll('.cp-hit')].slice(0, 3).map(a => a.querySelector('.cp-rk').textContent + ' | ' + a.getAttribute('href')));
    await p.keyboard.press('Enter'); await p.waitForTimeout(600); r.jump = await p.evaluate(() => location.hash + ' marks:' + document.querySelectorAll('.cp-mark').length + ' open:' + !!document.querySelector('details[open]'));
    await p.click('[data-lang="en"]'); await p.waitForTimeout(300);
    r.over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); r.errs = errs; out[tag] = r;
  }
  console.log(JSON.stringify(out, null, 1)); await b.close(); })();
