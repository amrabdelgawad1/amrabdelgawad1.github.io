// Learning Hub (#learn): tracks to study, each with its tools and modules.
// #learn shows the tracks, #learn/<id> opens one, #learn/<id>/<n>/<part> opens a module on one of its parts,
// and #learn/<id>/<n>/lesson/<k> opens lesson n.k.
// A track's modules come from window.LH_COURSES[id] (course-*.js); a track without one shows "Material coming".
// Each person's work (ticks, notes, scratch pad, exam scores, pen drawings) saves on the device at once,
// then to the learn_progress table so it follows them to other devices (stays on the device if the table isn't there yet).
(function(){
  const COURSES = window.LH_COURSES || {};
  const TRACKS = [
    { id:'acq', name:'Real Estate Acquisitions', short:'Acquisitions', tone:'gold', tag:'Team track',
      blurb:'From the first cold call to a signed contract: finding sellers, running numbers, making offers.',
      tools:[
        { href:'/land-calculator/', ic:'L', name:'Land calculator', sub:'Your full land deal tool' },
        { href:'/house-calculator/', ic:'H', name:'House calculator', sub:'Your full house deal tool' },
        { calc:'mao', ic:'$', name:'Quick max offer', sub:'ARV × 70% − repairs − fee' },
        { calc:'sf', ic:'%', name:'Seller-finance payment', sub:'Monthly payment on terms' }
      ] },
    { id:'mkt', name:'Marketing, A to Z', short:'Marketing', tone:'mag', tag:'Team track',
      blurb:'From knowing your customer to a full growth plan: positioning, copy, content, email, ads, SEO, outbound and real estate lead generation.',
      tools:[
        { calc:'funnel', ic:'▽', name:'Funnel math', sub:'Visitors to clients and revenue' },
        { calc:'ads', ic:'$', name:'Ad numbers', sub:'CTR, CPC, CPL, CAC and ROAS' },
        { calc:'ltv', ic:'∞', name:'Customer value', sub:'LTV, LTV:CAC and payback' },
        { calc:'reroi', ic:'R', name:'Seller-lead ROI', sub:'Cost per deal and return' }
      ] },
    { id:'psy', name:'Psychology and Therapy', short:'Psychology', tone:'mag', tag:'Shared track',
      blurb:'Core skills for working with clients: listening, CBT basics, case formulation and ethics.',
      tools:[] }
  ];
  TRACKS.forEach(t => t.modules = (COURSES[t.id] && COURSES[t.id].modules) || []);
  const PARTS = ['Lesson', 'Playbook', 'My notes', 'Scratch pad', 'Exam'];
  const SLUGS = ['lesson', 'playbook', 'notes', 'pad', 'exam'];
  const PASS = 80;

  const money = n => isFinite(n) ? '$' + Math.round(n).toLocaleString('en-US') : '–';
  const pct = n => isFinite(n) ? (Math.round(n * 10) / 10) + '%' : '–';
  const CALCS = {
    mao:{ t:'Quick max offer', f:[['arv','After repair value (ARV)',200000],['rep','Repairs',30000],['fee','Your fee',10000],['pct','Rule %',70]],
      calc:v => [money(v.arv * v.pct / 100 - v.rep - v.fee), money(v.arv) + ' × ' + v.pct + '% − ' + money(v.rep) + ' − ' + money(v.fee)] },
    sf:{ t:'Seller-finance payment', f:[['price','Price',120000],['down','Down payment',10000],['rate','Interest % per year',6],['yrs','Years',20]],
      calc:v => { const P = v.price - v.down, r = v.rate / 1200, n = v.yrs * 12, m = r ? P * r / (1 - Math.pow(1 + r, -n)) : P / n; return [money(m) + ' a month', 'On ' + money(P) + ' over ' + n + ' payments']; } },
    funnel:{ t:'Funnel math', f:[['vis','Visitors or people reached',2000],['lead','% who become leads',5],['call','% of leads who book a call',30],['win','% of calls who buy',25],['val','Value of one client ($)',1800]],
      calc:v => { const l = v.vis * v.lead / 100, c = l * v.call / 100, w = c * v.win / 100; return [(Math.round(w * 10) / 10) + ' clients', Math.round(l) + ' leads → ' + Math.round(c) + ' calls → ' + money(w * v.val) + ' revenue']; } },
    ads:{ t:'Ad numbers', f:[['spend','Ad spend ($)',600],['imp','Impressions',40000],['clk','Clicks',500],['leads','Leads',16],['cust','Customers',3],['rev','Revenue ($)',5400]],
      calc:v => [money(v.spend / v.leads) + ' per lead', 'CTR ' + pct(v.clk / v.imp * 100) + ' · CPC ' + money(v.spend / v.clk) + ' · CAC ' + money(v.spend / v.cust) + ' · ROAS ' + (Math.round(v.rev / v.spend * 10) / 10) + '×'] },
    ltv:{ t:'Customer value', f:[['rev','Revenue per month ($)',1800],['mar','Gross margin %',50],['mo','Months a customer stays',8],['cac','Cost to win one (CAC $)',600]],
      calc:v => { const l = v.rev * v.mar / 100 * v.mo, mm = v.rev * v.mar / 100; return [money(l) + ' lifetime value', 'LTV:CAC ' + (Math.round(l / v.cac * 10) / 10) + ' : 1 · pays back CAC in ' + (Math.round(v.cac / mm * 10) / 10) + ' months']; } },
    reroi:{ t:'Seller-lead ROI', f:[['spend','Marketing spend ($)',3000],['leads','Leads',30],['con','Contracts',2],['deals','Deals closed',1],['prof','Profit per deal ($)',15000]],
      calc:v => { const p = v.deals * v.prof; return [(Math.round((p - v.spend) / v.spend * 10) / 10) + '× return', money(v.spend / v.leads) + ' per lead · ' + money(v.spend / v.con) + ' per contract · ' + money(v.spend / v.deals) + ' per deal']; } }
  };

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  // ---------- each person's saved work ----------
  const app = () => window.TalentsApp || {};
  const uid = () => (app().user && app().user.id) || 'me';
  const store = {}; // course id -> { mods:{ [n]: { ticks, notes, pad, best, last, ink } } }
  const pending = {};
  const localKey = c => 'lh1:' + uid() + ':' + c;
  function data(c){
    if (!store[c]) { let d = null; try { d = JSON.parse(localStorage.getItem(localKey(c)) || 'null'); } catch(e){} store[c] = d && d.mods ? d : { mods:{} }; pull(c); }
    return store[c];
  }
  const mod = (c, n) => { const d = data(c); return d.mods[n] || (d.mods[n] = {}); };
  function save(c){
    const d = store[c]; d.at = Date.now();
    try { localStorage.setItem(localKey(c), JSON.stringify(d)); } catch(e){}
    clearTimeout(pending[c]); pending[c] = setTimeout(() => push(c), 1500);
  }
  let noTable = false;
  async function push(c){
    const db = app().db; if (!db || noTable || !app().user) return;
    const { error } = await db.from('learn_progress').upsert({ user_id:uid(), course:c, data:store[c], updated_at:new Date().toISOString() });
    if (error && /learn_progress/.test(error.message || '')) noTable = true;
  }
  async function pull(c){
    const db = app().db; if (!db || noTable || !app().user) return;
    const { data:row, error } = await db.from('learn_progress').select('data').eq('user_id', uid()).eq('course', c).maybeSingle();
    if (error) { if (/learn_progress/.test(error.message || '')) noTable = true; return; }
    if (row && row.data && row.data.mods && (row.data.at || 0) > (store[c].at || 0)) {
      store[c] = row.data; try { localStorage.setItem(localKey(c), JSON.stringify(row.data)); } catch(e){}
      if (location.hash.startsWith('#learn')) open();
    }
  }
  const mins = m => m.lessons.reduce((a, l) => a + l.mins, 0);
  const dur = n => n >= 60 ? Math.floor(n / 60) + ' h' + (n % 60 ? ' ' + n % 60 + ' min' : '') : n + ' min';
  const readCount = (c, n, m) => m.lessons.filter((l, k) => ((data(c).mods[n] || {}).read || {})[k]).length;
  const passed = (c, n) => ((data(c).mods[n] || {}).best || 0) >= PASS;
  const doneCount = t => t.modules.filter((m, i) => passed(t.id, i)).length;
  const bar = (a, b) => `<span class="lh-bar" role="progressbar" aria-valuenow="${a}" aria-valuemax="${b}"><i style="width:${b ? Math.round(a / b * 100) : 0}%"></i></span>`;

  // ---------- home and track pages ----------
  const tracksHtml = () => TRACKS.map(t => { const d = t.modules.length ? doneCount(t) : 0; return `
    <a class="card lh-track lh-${t.tone}" href="#learn/${t.id}">
      <span class="lh-chip">${t.tag}</span>
      <h2>${t.name}</h2>
      <p class="note">${t.blurb}</p>
      <p class="lh-meta"><span><b>${t.modules.length}</b> modules</span>${t.modules.length ? `<span><b>${t.modules.reduce((a, m) => a + m.lessons.length, 0)}</b> lessons</span><span><b>${Math.round(t.modules.reduce((a, m) => a + mins(m), 0) / 60)}</b> hours</span>` : ''}<span><b>${t.tools.length}</b> tools</span>${t.modules.length ? `<span><b>${d}</b> passed</span>` : ''}</p>
      ${t.modules.length ? bar(d, t.modules.length) : ''}
      <span class="label">${t.modules.length ? (d ? 'Continue' : 'Start') : 'Material coming'}</span>
    </a>`; }).join('') + `
    <div class="lh-track lh-soon"><span class="label">Coming later</span><h2>New track</h2><p class="note">Lead management, cold-call scripts, GoHighLevel… a new track gets added here when its material is ready.</p></div>`;

  function home(){
    return `
    <section class="lh-head"><span class="label">Learning Hub</span><h2 class="lh-h1">Pick a track</h2>
      <p class="note">Each track has its modules and the tools that go with it. Your notes, drawings and progress are yours only.</p></section>
    <div class="lh-tracks">${tracksHtml()}</div>
    <section class="card"><h2>What every module has</h2>
      <p class="note">Read the lesson, use the playbook, keep notes, practise on the scratch pad, then pass the exam (${PASS}% or more) to complete the module. Use the pen to draw or highlight on any page.</p>
      <div class="lh-parts">${PARTS.map((p, i) => `<span class="lh-part"><b>${i + 1}</b>${p}</span>`).join('')}</div></section>`;
  }

  const toolsHtml = t => t.tools.length ? `<div class="lh-tools">${t.tools.map(x => x.href
      ? `<a class="lh-tool" href="${x.href}"><span class="lh-ic">${x.ic}</span><span><b>${x.name}</b><small>${x.sub}</small></span></a>`
      : `<button class="lh-tool" type="button" data-calc="${x.calc}"><span class="lh-ic">${x.ic}</span><span><b>${x.name}</b><small>${x.sub}</small></span></button>`).join('')}</div>`
    : '<p class="note">Tools for this track come with its material.</p>';

  // The course's own introduction: who it's for, how to study it and what you'll be able to do
  function introHtml(t){
    const i = COURSES[t.id] && COURSES[t.id].intro; if (!i) return '';
    return `<section class="card lh-${t.tone} lh-intro"><h2>About this course</h2><p>${i.who}</p>
      <div class="lh-intro-cols"><div><h3>How to study it</h3><ol>${i.how.map(x => `<li>${x}</li>`).join('')}</ol></div>
      <div><h3>By the end you can</h3><ul>${i.outcomes.map(x => `<li>${x}</li>`).join('')}</ul></div></div></section>`;
  }

  function track(t){
    let mods;
    if (!t.modules.length) mods = `<div class="lh-empty"><h3>No modules yet</h3><p class="note">The material for this track goes here. Each module will open into ${PARTS.join(', ').replace(/, ([^,]+)$/, ' and $1')}.</p></div>`;
    else {
      const levels = COURSES[t.id].levels || [];
      const next = t.modules.findIndex((m, i) => !passed(t.id, i));
      mods = levels.map((lv, li) => {
        const list = t.modules.map((m, i) => [m, i]).filter(([m]) => m.lvl === li);
        return list.length ? `<h3 class="lh-lvl"><span class="label">Level ${li + 1}</span>${lv}</h3>` + list.map(([m, i]) => {
          const s = data(t.id).mods[i] || {}, st = passed(t.id, i) ? `<span class="pill p-ok">Passed ${s.best}%</span>` : i === next ? '<span class="pill p-due">Up next</span>' : s.last != null ? `<span class="pill p-due">Last try ${s.last}%</span>` : '';
          return `<a class="lh-mod" href="#learn/${t.id}/${i + 1}"><span class="lh-n">${i + 1}</span><span><h3>${m.t}</h3><p class="note">${m.d}</p>
            <ol class="lh-sub">${m.lessons.map((l, k) => `<li${(s.read || {})[k] ? ' class="done"' : ''}><b>${i + 1}.${k + 1}</b> ${l.t}</li>`).join('')}</ol>
            <p class="lh-meta"><span><b>${m.lessons.length}</b> lessons</span><span>${dur(mins(m))}</span><span><b>${readCount(t.id, i, m)}</b> read</span></p></span>${st}</a>`;
        }).join('') : '';
      }).join('');
    }
    const d = t.modules.length ? doneCount(t) : 0;
    return `
    <nav class="lh-crumbs"><a href="#learn">Learning Hub</a><span>/</span><span class="label">${t.short}</span></nav>
    <section class="lh-head lh-${t.tone}"><span class="label">${t.tag}</span><h2 class="lh-h1">${t.name}</h2><p class="note">${t.blurb}</p>
      ${t.modules.length ? `<p class="lh-meta"><span><b>${d}</b> of ${t.modules.length} modules passed</span></p>${bar(d, t.modules.length)}` : ''}</section>
    ${introHtml(t)}
    <section class="lh-sec lh-${t.tone}"><span class="label">Tools and calculators</span>${toolsHtml(t)}</section>
    <section class="card lh-${t.tone}"><h2>Modules</h2>${mods}</section>`;
  }

  // ---------- a module: five parts ----------
  // Answer options in a mixed but fixed order per question, so the right one isn't always in the same place
  function order(n, q, len){
    let x = (n + 1) * 7919 + (q + 1) * 104729; const r = () => (x = (x * 48271) % 2147483647) / 2147483647;
    const a = [...Array(len).keys()]; for (let i = len - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a;
  }
  function partHtml(t, n, m, part, k){
    const s = mod(t.id, n);
    if (part === 'lesson') { const l = m.lessons[k], rd = (s.read || {})[k], last = k === m.lessons.length - 1;
      return `<header class="lh-lhead"><span class="label">Lesson ${n + 1}.${k + 1} · ${l.mins} min</span><h3 class="lh-ltitle">${l.t}</h3></header>` +
      l.s.map(([h, b]) => `<section class="lh-sec-lesson"><h3>${h}</h3>${b}</section>`).join('') +
      (l.ex ? `<section class="lh-case"><span class="label">Worked example</span>${l.ex}</section>` : '') +
      (l.terms && l.terms.length ? `<section><h3>Key terms</h3><dl class="lh-terms">${l.terms.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl></section>` : '') +
      `<div class="lh-readrow">${rd ? '<span class="pill p-ok">Read ✓</span>' : ''}<a class="btn" href="#learn/${t.id}/${n + 1}/${last ? 'playbook' : 'lesson/' + (k + 2)}" data-read="${k}">${rd ? '' : 'Mark as read · '}${last ? 'Go to the playbook' : 'Next: lesson ' + (n + 1) + '.' + (k + 2)} →</a></div>`; }
    if (part === 'playbook') { const k = s.ticks || {}, d = m.playbook.steps.filter((x, i) => k[i]).length; return `<h3>${m.playbook.t}</h3>
      <p class="note">${d} of ${m.playbook.steps.length} done. Tick each step as you do it for real.</p>
      <ol class="lh-steps">${m.playbook.steps.map((x, i) => `<li><label><input type="checkbox" data-tick="${i}"${k[i] ? ' checked' : ''} /><span>${x}</span></label></li>`).join('')}</ol>`; }
    if (part === 'notes') return `<h3>My notes</h3><p class="note">Only you can see these. They save as you type.</p><textarea class="field lh-notes" data-notes rows="14" placeholder="What stood out, what to try, questions for Amr…"></textarea>`;
    if (part === 'pad') return `<h3>Scratch pad</h3><p class="note">Work through these for your own business or a client. They save as you type${m.calc ? '; the calculator helps with the numbers' : ''}.</p>
      ${m.calc ? `<button class="lh-tool lh-padcalc" type="button" data-calc="${m.calc}"><span class="lh-ic">=</span><span><b>${CALCS[m.calc].t}</b><small>Open the calculator</small></span></button>` : ''}
      ${m.pad.map((q, i) => `<label class="lh-q"><span>${q}</span><textarea class="field" rows="4" data-pad="${i}"></textarea></label>`).join('')}`;
    // exam (an answer sheet from an older version of the exam is dropped)
    if (s.review && s.review.length !== m.exam.length) delete s.review;
    const r = s.review;
    return `<h3>Exam</h3><p class="note">${m.exam.length} questions. Pass with ${PASS}% or more to complete the module.${s.best != null ? ' Your best so far: <b>' + s.best + '%</b>.' : ''}</p>
      <form class="lh-exam" data-exam>${m.exam.map(([q, opts, right, why], i) => `<fieldset class="lh-qz${r ? (r[i] === right ? ' ok' : ' no') : ''}"><legend><b>${i + 1}.</b> ${q}</legend>
        ${order(n, i, opts.length).map(j => `<label class="lh-opt${r && j === right ? ' right' : ''}"><input type="radio" name="q${i}" value="${j}"${r && r[i] === j ? ' checked' : ''}${r ? ' disabled' : ''} /><span>${opts[j]}</span></label>`).join('')}
        ${r ? `<p class="note lh-why">${r[i] === right ? 'Correct. ' : 'The answer is “' + opts[right] + '”. '}${why}</p>` : ''}</fieldset>`).join('')}
        <div class="lh-exam-end">${r ? `<p class="lh-score ${s.last >= PASS ? 'ok' : 'no'}"><b>${s.last}%</b> ${s.last >= PASS ? 'Passed. Well done.' : 'Not yet. Read the lesson again and retry.'}</p><button class="btn ghost" type="button" data-retry>Try again</button>` : '<button class="btn" type="submit">Check my answers</button>'}</div></form>`;
  }

  function module(t, n, part, k){
    const m = t.modules[n], i = Math.max(0, SLUGS.indexOf(part)), lv = (COURSES[t.id].levels || [])[m.lvl] || '';
    const base = `#learn/${t.id}/${n + 1}/`, rd = mod(t.id, n).read || {};
    k = Math.min(Math.max(0, k || 0), m.lessons.length - 1);
    return `
    <nav class="lh-crumbs"><a href="#learn">Learning Hub</a><span>/</span><a href="#learn/${t.id}">${t.short}</a><span>/</span><span class="label">Module ${n + 1}</span></nav>
    <section class="lh-head lh-${t.tone}"><span class="label">Module ${n + 1} · Level ${m.lvl + 1} · ${lv} · ${m.lessons.length} lessons · ${dur(mins(m))}</span><h2 class="lh-h1">${m.t}</h2><p class="note">${m.d}</p>
      <details class="lh-out"${i === 0 && k === 0 ? ' open' : ''}><summary>What you’ll be able to do</summary><ul>${m.outcomes.map(x => `<li>${x}</li>`).join('')}</ul></details>
      ${passed(t.id, n) ? `<span class="pill p-ok lh-passed">Passed ${mod(t.id, n).best}%</span>` : ''}</section>
    <div class="lh-bar2"><nav class="lh-tabs" role="tablist">${PARTS.map((p, k) => `<a role="tab" href="${base + SLUGS[k]}" aria-selected="${k === i}"><b>${k + 1}</b>${p}</a>`).join('')}</nav>
      <button class="btn ghost small lh-pen-on" type="button" data-pen aria-pressed="false">✎ Pen</button></div>
    ${i === 0 ? `<nav class="lh-lessons" aria-label="Lessons">${m.lessons.map((l, j) => `<a href="${base}lesson/${j + 1}"${j === k ? ' aria-current="page"' : ''}${rd[j] ? ' class="done"' : ''}><b>${n + 1}.${j + 1}</b><span>${l.t}</span></a>`).join('')}</nav>` : ''}
    <section class="card lh-${t.tone} lh-paper" data-part="${i === 0 ? 'lesson-' + (k + 1) : SLUGS[i]}"><div class="lh-page">${partHtml(t, n, m, SLUGS[i], k)}</div></section>
    <nav class="lh-pager">${i === 0 && k > 0 ? `<a class="btn ghost small" href="${base}lesson/${k}">← Lesson ${n + 1}.${k}</a>` : n > 0 ? `<a class="btn ghost small" href="#learn/${t.id}/${n}">← ${esc(t.modules[n - 1].t)}</a>` : '<span></span>'}
      ${i === 0 ? '' : i < 4 ? `<a class="btn small" href="${base + SLUGS[i + 1]}">Next: ${PARTS[i + 1]} →</a>` : n < t.modules.length - 1 ? `<a class="btn small" href="#learn/${t.id}/${n + 2}">Next module →</a>` : `<a class="btn small" href="#learn/${t.id}">Back to the track</a>`}</nav>`;
  }

  // Fills saved text into the page and wires saving (values go in as text, never as HTML)
  function wire(t, n){
    const box = $('learnBody'), s = mod(t.id, n), c = t.id;
    box.querySelectorAll('[data-read]').forEach(a => a.addEventListener('click', () => { (s.read = s.read || {})[a.dataset.read] = true; save(c); }));
    const notes = box.querySelector('[data-notes]');
    if (notes) { notes.value = s.notes || ''; notes.addEventListener('input', () => { s.notes = notes.value; save(c); }); }
    box.querySelectorAll('[data-pad]').forEach(a => { const k = a.dataset.pad; a.value = (s.pad || {})[k] || ''; a.addEventListener('input', () => { (s.pad = s.pad || {})[k] = a.value; save(c); }); });
    box.querySelectorAll('[data-tick]').forEach(b => b.addEventListener('change', () => { (s.ticks = s.ticks || {})[b.dataset.tick] = b.checked; save(c); open(); }));
    const ex = box.querySelector('[data-exam]');
    if (ex) {
      ex.addEventListener('submit', e => {
        e.preventDefault();
        const m = t.modules[n], ans = m.exam.map((q, i) => { const r = ex.querySelector(`input[name="q${i}"]:checked`); return r ? +r.value : -1; });
        const miss = ans.indexOf(-1); if (miss > -1) { app().toast ? app().toast('Answer question ' + (miss + 1) + ' first.') : alert('Answer question ' + (miss + 1) + ' first.'); return; }
        const score = Math.round(ans.filter((a, i) => a === m.exam[i][2]).length / m.exam.length * 100);
        s.review = ans; s.last = score; s.best = Math.max(s.best || 0, score); save(c); open();
      });
      const re = ex.querySelector('[data-retry]'); if (re) re.addEventListener('click', () => { delete s.review; save(c); open(); });
    }
    Pen.attach(box.querySelector('.lh-paper'), s, c);
  }

  // ---------- the pen: draw or highlight on any part, saved per person, per module and part ----------
  const Pen = (() => {
    const INKS = [['Gold', '#C9A96E'], ['Magenta', '#C2187A'], ['Ink', 'currentColor'], ['Highlight', 'rgba(228,180,90,.38)']];
    let paper, cv, ctx, strokes, rec, c, on = false, ink = 0, erase = false, cur = null, ro;
    const W = () => paper.clientWidth;
    function size(){
      const dpr = window.devicePixelRatio || 1, w = W(), h = paper.clientHeight;
      cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
    }
    function line(s){
      const w = W(), col = INKS[s.k][1];
      ctx.strokeStyle = col === 'currentColor' ? getComputedStyle(paper).color : col;
      ctx.lineWidth = (s.k === 3 ? 16 : 2.5); ctx.lineCap = ctx.lineJoin = 'round';
      ctx.beginPath(); s.p.forEach(([x, y], i) => i ? ctx.lineTo(x * w, y * w) : ctx.moveTo(x * w, y * w));
      if (s.p.length === 1) ctx.lineTo(s.p[0][0] * w + .1, s.p[0][1] * w);
      ctx.stroke();
    }
    function draw(){ ctx.clearRect(0, 0, cv.width, cv.height); strokes.forEach(line); }
    // Points are stored as fractions of the page width so drawings stay put when the page resizes
    const pt = e => { const r = cv.getBoundingClientRect(), w = W(); return [Math.round((e.clientX - r.left) / w * 1e4) / 1e4, Math.round((e.clientY - r.top) / w * 1e4) / 1e4]; };
    const keep = () => { rec[part()] = strokes; save(c); };
    const part = () => paper.dataset.part;
    function hit(p){
      const w = W();
      for (let i = strokes.length - 1; i >= 0; i--) if (strokes[i].p.some(([x, y]) => Math.hypot((x - p[0]) * w, (y - p[1]) * w) < 12)) { strokes.splice(i, 1); keep(); draw(); return; }
    }
    function down(e){ if (!on) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); const p = pt(e); if (erase) { hit(p); cur = 'erase'; return; } cur = { k:ink, p:[p] }; strokes.push(cur); draw(); }
    function move(e){ if (!on || !cur) return; const p = pt(e); if (cur === 'erase') return hit(p); cur.p.push(p); draw(); }
    function up(){ if (cur && cur !== 'erase') keep(); cur = null; }
    function bar(){
      const b = document.createElement('div'); b.className = 'lh-penbar'; b.hidden = true;
      b.innerHTML = INKS.map(([n, col], i) => `<button type="button" data-ink="${i}" aria-label="${n}" title="${n}" style="--ink:${col}" aria-pressed="${i === ink && !erase}"></button>`).join('') +
        `<button type="button" data-erase aria-pressed="${erase}">Eraser</button><button type="button" data-undo>Undo</button><button type="button" data-clear>Clear</button><button type="button" data-done>Done</button>`;
      b.addEventListener('click', e => {
        const x = e.target.closest('button'); if (!x) return;
        if (x.dataset.ink) { ink = +x.dataset.ink; erase = false; }
        if (x.hasAttribute('data-erase')) erase = !erase;
        if (x.hasAttribute('data-undo')) { strokes.pop(); keep(); draw(); }
        if (x.hasAttribute('data-clear') && strokes.length && confirm('Clear your drawings on this page?')) { strokes.length = 0; keep(); draw(); }
        if (x.hasAttribute('data-done')) toggle(false);
        b.querySelectorAll('[data-ink]').forEach(y => y.setAttribute('aria-pressed', +y.dataset.ink === ink && !erase));
        b.querySelector('[data-erase]').setAttribute('aria-pressed', erase);
      });
      return b;
    }
    function toggle(v){
      on = v; paper.classList.toggle('lh-drawing', on); cv.style.pointerEvents = on ? 'auto' : 'none';
      const btn = $('learnBody').querySelector('[data-pen]'); if (btn) btn.setAttribute('aria-pressed', on);
      const b = $('learnBody').querySelector('.lh-penbar'); if (b) b.hidden = !on;
    }
    function attach(p, s, course){
      if (ro) ro.disconnect();
      paper = p; c = course; rec = s.ink = s.ink || {}; strokes = rec[part()] = rec[part()] || []; erase = false;
      cv = document.createElement('canvas'); cv.className = 'lh-ink'; cv.setAttribute('aria-hidden', 'true'); ctx = cv.getContext('2d');
      paper.appendChild(cv); paper.before(bar());
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      ro = new ResizeObserver(size); ro.observe(paper); size();
      const btn = $('learnBody').querySelector('[data-pen]'); if (btn) btn.addEventListener('click', () => toggle(!on));
      toggle(on);
    }
    return { attach };
  })();

  function open(){
    const [, id, n, part, k] = location.hash.slice(1).split('/');
    const t = TRACKS.find(x => x.id === id), i = parseInt(n, 10) - 1;
    const box = $('learnBody'), y = window.scrollY, same = box.dataset.at === location.hash;
    if (t && t.modules[i]) { box.innerHTML = module(t, i, part || 'lesson', (parseInt(k, 10) || 1) - 1); wire(t, i); }
    else box.innerHTML = t ? track(t) : home();
    if (!same) window.scrollTo(0, 0); else window.scrollTo(0, y);
    box.dataset.at = location.hash;
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
  window.addEventListener('pagehide', () => Object.keys(pending).forEach(c => { clearTimeout(pending[c]); push(c); }));
  window.TalentsLearn = { open };
})();
