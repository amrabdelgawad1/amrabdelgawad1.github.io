// Acquisitions Playbook sales page (Round 37, plan S2 and S4).
// Outline and the free lesson 1.1 come from course_sales_outline() and course_sales_sample() (titles and that one lesson only).
// Price and checkout come from the course-checkout edge function, which talks to Polar with a secret token.
// Paying happens on Polar's page; when it sends the buyer back here with ?checkout_id=..., the function checks with Polar
// that the payment succeeded and only then opens the course (invite email for a new buyer). Plain fetch, no libraries.
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const cfg = window.TRACKER_CONFIG || {};
  const H = { 'Content-Type':'application/json', apikey:cfg.supabaseKey, Authorization:'Bearer ' + cfg.supabaseKey };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const say = t => { $('cMsg').textContent = t; $('cMsg').hidden = !t; };

  const rpc = async name => {
    const r = await fetch(cfg.supabaseUrl + '/rest/v1/rpc/' + name, { method:'POST', headers:H, body:'{}' });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  };
  const fn = async body => {
    const r = await fetch(cfg.supabaseUrl + '/functions/v1/course-checkout', { method:'POST', headers:H, body:JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && !j.state) throw new Error(j.error || 'Checkout is having trouble right now. Please try again in a minute.');
    return j;
  };

  // ---------- price and Buy ----------
  const money = (cents, cur) => {
    try { return new Intl.NumberFormat('en-US', { style:'currency', currency:String(cur || 'usd').toUpperCase(), minimumFractionDigits:cents % 100 ? 2 : 0 }).format(cents / 100); }
    catch(e) { return (cents / 100).toFixed(2) + ' ' + String(cur || '').toUpperCase(); }
  };
  const notOpen = () => {
    $('cPrice').textContent = 'Opening soon';
    $('cPriceSub').textContent = 'Checkout isn’t open yet. Ask for access and I’ll get back to you.';
    $('cGo').hidden = true; $('cAsk').hidden = false;
    document.querySelector('.em').hidden = true;
  };
  async function loadPrice(){
    try {
      const i = await fn({ action:'info' });
      if (!i.ready) return notOpen();
      $('cPrice').textContent = money(i.price_cents, i.currency);
      $('cPriceSub').textContent = i.interval ? 'per ' + i.interval + ', cancel any time' : 'one payment, the whole course';
      $('cTest').hidden = !i.sandbox;
      $('cGo').textContent = 'Buy the course'; $('cGo').disabled = false;
    } catch(e) { notOpen(); }
  }
  $('cGo').addEventListener('click', async () => {
    say('');
    const email = $('cEmail').value.trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) { say('Please check your email, or leave it empty.'); $('cEmail').focus(); return; }
    $('cGo').disabled = true; $('cGo').textContent = 'Opening checkout…';
    try {
      const r = await fn({ action:'start', email });
      if (!r.url || !/^https:\/\/([a-z0-9-]+\.)*polar\.sh\//.test(r.url)) throw new Error('Checkout couldn’t start. Please try again.');
      location.href = r.url;
    } catch(e) { say(e.message); $('cGo').disabled = false; $('cGo').textContent = 'Buy the course'; }
  });

  // ---------- back from Polar ----------
  function shown(title, text, wait){
    const d = $('cDone'); d.classList.toggle('wait', !!wait);
    $('cDoneT').textContent = title; $('cDoneP').innerHTML = text;
    d.hidden = false; $('cBuy').hidden = true; d.focus();
  }
  async function confirm(id, tries){
    shown('Checking your payment…', 'One moment while the payment is confirmed.', true);
    let r;
    try { r = await fn({ action:'confirm', checkout_id:id }); }
    catch(e) { return shown('We couldn’t check your payment yet', esc(e.message) + ' If you paid, your access will still open; email <a href="mailto:amr@amrabdelgawad.site">amr@amrabdelgawad.site</a> if it hasn’t within the hour.', true); }
    if (r.state === 'pending' && tries < 8) return setTimeout(() => confirm(id, tries + 1), 2500);
    if (r.state === 'granted' && r.new_account)
      return shown('You’re in', 'Thank you for buying the Acquisitions Playbook. An invite is on its way to <b>' + esc(r.email) + '</b>. Open it to set your password, then start Module 1. If it isn’t in your inbox in a few minutes, check spam.');
    if (r.state === 'granted')
      return shown('You’re in', 'Thank you. The course is open on your account (<b>' + esc(r.email) + '</b>). <a href="/app/learn/">Sign in and start Module 1</a>.');
    if (r.state === 'needs_look' || r.state === 'pending')
      return shown('Payment received', 'Thank you. Your access needs one quick step on my side, and you’ll get an email at the address you paid with, usually the same day. Questions: <a href="mailto:amr@amrabdelgawad.site">amr@amrabdelgawad.site</a>.', true);
    shown('Payment not finished', 'The checkout wasn’t completed, so nothing was charged. You can try again below.', true);
    $('cBuy').hidden = false;
  }

  // ---------- outline and sample ----------
  async function loadOutline(){
    try {
      const o = await rpc('course_sales_outline');
      const mods = o.modules || [];
      const lessons = mods.reduce((n, m) => n + (m.lessons || []).length, 0);
      $('cMods').textContent = mods.length + ' modules';
      $('cLessons').textContent = lessons + ' lessons';
      $('cOutlineNote').textContent = mods.length + ' modules, ' + lessons + ' lessons. Each lesson has a quiz and each module ends with a checkpoint.';
      $('cOutline').innerHTML = mods.map(m =>
        '<details><summary><span class="n">Module ' + esc(m.number) + '</span>' + esc(m.title) + '</summary>' +
        (m.about ? '<p class="about">' + esc(m.about) + '</p>' : '') +
        '<ul>' + (m.lessons || []).map(l => '<li>' + esc(l) + '</li>').join('') + '</ul></details>').join('');
    } catch(e) { $('cOutline').innerHTML = '<p class="fine">The outline couldn’t load. Refresh the page to try again.</p>'; }
  }
  // Small markdown reader for the sample: paragraphs, **bold**, numbered and bullet lists, pipe tables. Everything is escaped first.
  const inline = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  function md(src){
    const out = [], lines = String(src || '').replace(/\r/g, '').split('\n');
    for (let i = 0; i < lines.length;) {
      const l = lines[i];
      if (!l.trim()) { i++; continue; }
      if (/^\s*\|/.test(l)) {
        const rows = []; while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
        const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const body = rows.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r));
        const head = cells(body.shift() || '');
        out.push('<div class="tw"><table><thead><tr>' + head.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
          body.map(r => '<tr>' + cells(r).map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
        continue;
      }
      const ol = /^\s*\d+[.)]\s+/, ul = /^\s*[-*]\s+/;
      if (ol.test(l) || ul.test(l)) {
        const re = ol.test(l) ? ol : ul, tag = re === ol ? 'ol' : 'ul', items = [];
        while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ''));
        out.push('<' + tag + '>' + items.map(t => '<li>' + inline(t) + '</li>').join('') + '</' + tag + '>');
        continue;
      }
      const para = []; while (i < lines.length && lines[i].trim() && !/^\s*(\||\d+[.)]\s|[-*]\s)/.test(lines[i])) para.push(lines[i++]);
      out.push('<p>' + inline(para.join(' ')) + '</p>');
    }
    return out.join('');
  }
  async function loadSample(){
    try {
      const s = await rpc('course_sales_sample');
      if (!s || !s.body) throw new Error('empty');
      $('cSampleT').textContent = s.title || '1.1';
      $('cSample').innerHTML = md(s.body) + '<p class="more">In the course this lesson also has a short video, a quiz and practice questions.</p>';
    } catch(e) { $('cSampleBox').hidden = true; }
  }

  if (!cfg.supabaseUrl) { notOpen(); return; }
  const back = new URLSearchParams(location.search).get('checkout_id');
  loadOutline(); loadSample();
  if (back && /^[A-Za-z0-9_-]{8,80}$/.test(back)) { loadPrice(); confirm(back, 0); try { history.replaceState(null, '', location.pathname); } catch(e) {} }
  else loadPrice();
})();
