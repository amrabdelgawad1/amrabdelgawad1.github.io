// Learning Hub (#learn, Amr only for now): tracks to study, each with its tools and modules.
// #learn shows the tracks, #learn/<id> opens one. Modules are empty until the material is added:
// put them in a track's modules list (title + what it covers) and they show up in order.
(function(){
  const TRACKS = [
    { id:'acq', name:'Real Estate Acquisitions', short:'Acquisitions', tone:'gold', tag:'Team track',
      blurb:'From the first cold call to a signed contract: finding sellers, running numbers, making offers.',
      tools:[
        { href:'/land-calculator/', ic:'L', name:'Land calculator', sub:'Your full land deal tool' },
        { href:'/house-calculator/', ic:'H', name:'House calculator', sub:'Your full house deal tool' },
        { calc:'mao', ic:'$', name:'Quick max offer', sub:'ARV × 70% − repairs − fee' },
        { calc:'sf', ic:'%', name:'Seller-finance payment', sub:'Monthly payment on terms' }
      ],
      modules:[] },
    { id:'psy', name:'Psychology and Therapy', short:'Psychology', tone:'mag', tag:'Shared track',
      blurb:'Core skills for working with clients: listening, CBT basics, case formulation and ethics.',
      tools:[], modules:[] }
  ];
  const PARTS = ['Lesson', 'Playbook', 'My notes', 'Scratch pad', 'Exam'];

  const money = n => isFinite(n) ? '$' + Math.round(n).toLocaleString('en-US') : '–';
  const CALCS = {
    mao:{ t:'Quick max offer', f:[['arv','After repair value (ARV)',200000],['rep','Repairs',30000],['fee','Your fee',10000],['pct','Rule %',70]],
      calc:v => [money(v.arv * v.pct / 100 - v.rep - v.fee), money(v.arv) + ' × ' + v.pct + '% − ' + money(v.rep) + ' − ' + money(v.fee)] },
    sf:{ t:'Seller-finance payment', f:[['price','Price',120000],['down','Down payment',10000],['rate','Interest % per year',6],['yrs','Years',20]],
      calc:v => { const P = v.price - v.down, r = v.rate / 1200, n = v.yrs * 12, m = r ? P * r / (1 - Math.pow(1 + r, -n)) : P / n; return [money(m) + ' a month', 'On ' + money(P) + ' over ' + n + ' payments']; } }
  };

  const $ = id => document.getElementById(id);
  const tracksHtml = () => TRACKS.map(t => `
    <a class="card lh-track lh-${t.tone}" href="#learn/${t.id}">
      <span class="lh-chip">${t.tag}</span>
      <h2>${t.name}</h2>
      <p class="note">${t.blurb}</p>
      <p class="lh-meta"><span><b>${t.modules.length}</b> modules</span><span><b>${t.tools.length}</b> tools</span></p>
      <span class="label">${t.modules.length ? 'Open' : 'Material coming'}</span>
    </a>`).join('') + `
    <div class="lh-track lh-soon"><span class="label">Coming later</span><h2>New track</h2><p class="note">Lead management, cold-call scripts, GoHighLevel… a new track gets added here when its material is ready.</p></div>`;

  function home(){
    return `
    <section class="lh-head"><span class="label">Learning Hub</span><h2 class="lh-h1">Pick a track</h2>
      <p class="note">Each track has its modules and the tools that go with it. Your notes and progress will be yours only.</p></section>
    <div class="lh-tracks">${tracksHtml()}</div>
    <section class="card"><h2>What every module will have</h2>
      <p class="note">When the material is added, each module opens into these parts.</p>
      <div class="lh-parts">${PARTS.map((p, i) => `<span class="lh-part"><b>${i + 1}</b>${p}</span>`).join('')}</div></section>`;
  }

  function track(t){
    const tools = t.tools.length ? `<div class="lh-tools">${t.tools.map(x => x.href
        ? `<a class="lh-tool" href="${x.href}"><span class="lh-ic">${x.ic}</span><span><b>${x.name}</b><small>${x.sub}</small></span></a>`
        : `<button class="lh-tool" type="button" data-calc="${x.calc}"><span class="lh-ic">${x.ic}</span><span><b>${x.name}</b><small>${x.sub}</small></span></button>`).join('')}</div>`
      : '<p class="note">Tools for this track come with its material.</p>';
    const mods = t.modules.length
      ? t.modules.map((m, i) => `<div class="lh-mod"><span class="lh-n">${i + 1}</span><span><h3>${m.t}</h3><p class="note">${m.d || ''}</p></span></div>`).join('')
      : `<div class="lh-empty"><h3>No modules yet</h3><p class="note">The material for this track goes here. Each module will open into ${PARTS.join(', ').replace(/, ([^,]+)$/, ' and $1')}.</p></div>`;
    return `
    <nav class="lh-crumbs"><a href="#learn">Learning Hub</a><span>/</span><span class="label">${t.short}</span></nav>
    <section class="lh-head lh-${t.tone}"><span class="label">${t.tag}</span><h2 class="lh-h1">${t.name}</h2><p class="note">${t.blurb}</p></section>
    <section class="lh-sec lh-${t.tone}"><span class="label">Tools and calculators</span>${tools}</section>
    <section class="card lh-${t.tone}"><h2>Modules</h2>${mods}</section>`;
  }

  function open(id){
    const t = TRACKS.find(x => x.id === id);
    $('learnBody').innerHTML = t ? track(t) : home();
  }

  function openCalc(id){
    const c = CALCS[id];
    const box = document.createElement('div');
    box.className = 'lh-over';
    box.innerHTML = `<div class="lh-scrim" data-close></div><aside class="lh-drawer" role="dialog" aria-label="${c.t}">
      <button class="lh-x" type="button" data-close aria-label="Close">✕</button><span class="label">Calculator</span><h2>${c.t}</h2>
      ${c.f.map(([k, l, v]) => `<label class="label">${l}<input class="field" type="number" inputmode="decimal" data-k="${k}" value="${v}" /></label>`).join('')}
      <div class="lh-res"><span class="label">Result</span><strong></strong><small class="note"></small></div></aside>`;
    document.body.appendChild(box);
    const run = () => { const v = {}; box.querySelectorAll('input').forEach(i => v[i.dataset.k] = parseFloat(i.value) || 0); const [big, sub] = c.calc(v); box.querySelector('.lh-res strong').textContent = big; box.querySelector('.lh-res small').textContent = sub; };
    box.addEventListener('input', run); run();
    box.addEventListener('click', e => { if (e.target.closest('[data-close]')) box.remove(); });
    box.querySelector('input').focus();
  }

  document.addEventListener('click', e => { const b = e.target.closest('#pLearn [data-calc]'); if (b) openCalc(b.dataset.calc); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.lh-over').forEach(x => x.remove()); });
  window.TalentsLearn = { open };
})();
