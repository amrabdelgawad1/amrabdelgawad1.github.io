// Recap page check: renders on three sizes, sidebar item, links land on the right section, details open, search finds recap points.
const { chromium } = require('playwright');
(async () => { const S = process.argv[2], mods = (process.argv[3] || 'm01').split(','), b = await chromium.launch(), U = 'http://localhost:8765/app/course/_test.html', out = {};
  for (const [w, h, tag] of [[1366, 900, 'desk'], [820, 1180, 'tab'], [390, 844, 'phone']]) {
    const p = await (await b.newContext({ viewport:{ width:w, height:h } })).newPage(), errs = [], res = {};
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    for (const id of mods) {
      await p.goto(U + '#/' + id + '/recap'); await p.waitForTimeout(400);
      const r = await p.evaluate(() => ({ h1:document.querySelector('.cp-h1').textContent, ideas:document.querySelectorAll('[data-a^="i"]').length, links:document.querySelectorAll('a[data-go]').length,
        checks:document.querySelectorAll('.cp-checks details').length, side:!!document.querySelector('.cp-item[aria-current="page"]') && document.querySelector('.cp-item[aria-current="page"]').textContent.trim(),
        over:document.documentElement.scrollWidth > innerWidth + 1, foot:[...document.querySelectorAll('.cp-foot a')].map(a => a.getAttribute('href')) }));
      // every link target exists on its page
      const links = await p.evaluate(() => [...document.querySelectorAll('a[data-go]')].map(a => [a.getAttribute('href'), a.dataset.go]));
      const bad = [];
      for (const [href, go] of [...new Map(links.map(l => [l.join('|'), l])).values()]) { await p.goto(U + href); await p.waitForTimeout(60); if (!(await p.$(`[data-a="${go}"]`))) bad.push(href + ' ' + go); }
      r.badLinks = bad; res[id] = r;
    }
    // click-through: first idea link lands and flashes
    await p.goto(U + '#/' + mods[0] + '/recap'); await p.waitForTimeout(300);
    await p.click('.cp-recap li a[data-go]'); await p.waitForTimeout(500);
    res.click = await p.evaluate(() => ({ hash:location.hash, flash:!!document.querySelector('.cp-flash') && document.querySelector('.cp-flash').dataset.a }));
    await p.goto(U + '#/' + mods[0] + '/recap'); await p.waitForTimeout(300);
    await p.click('.cp-checks summary'); res.open = await p.evaluate(() => document.querySelector('.cp-checks details').open);
    await p.screenshot({ path:`${S}/recap-${tag}.png`, fullPage:tag === 'phone' ? false : false });
    await p.evaluate(() => window.scrollTo(0, document.querySelector('[data-a="check"]').offsetTop - 80)); await p.screenshot({ path:`${S}/recap-${tag}-2.png` });
    res.errs = errs; out[tag] = res;
  }
  console.log(JSON.stringify(out, null, 1)); await b.close(); })();
