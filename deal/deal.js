// Round 25 (B3, B5, B6, B4): the public deal page. Reads only the public copy Amr published (deal_page_get), never the
// encrypted deal. #s=SLUG shows the deal; &t=TOKEN (from a deal email) marks that buyer's email as opened and clicked.
// "I'm interested" and "Make an offer" call deal_page_reply (spam guard: private.form_guard, plus limits per page).
// #u=TOKEN is the unsubscribe link in every deal email (deal_unsubscribe). SQL: portal-backups docs/sql/2026-11-22-round25-selling.sql.
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const startedAt = new Date().toISOString();
  const cfg = window.TRACKER_CONFIG || {};
  const db = window.supabase && cfg.supabaseUrl ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth:{ persistSession:false } }) : null;
  const PUB = 'https://vepqjjophogryvbkfgcu.supabase.co/storage/v1/object/public/deal-pages/';
  const h = new URLSearchParams(location.hash.slice(1));
  const slug = (h.get('s') || '').toLowerCase().replace(/[^a-z0-9]/g, ''), token = (h.get('t') || '').replace(/[^A-Za-z0-9_-]/g, ''), unsub = (h.get('u') || '').replace(/[^A-Za-z0-9_-]/g, '');
  const money = n => n > 0 ? '$' + Math.round(n).toLocaleString('en-US') : '';
  const trim = n => String(Math.round(n * 100) / 100);
  const day = s => { try { return new Date(String(s).slice(0, 10) + 'T00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }); } catch (e) { return s; } };
  const prettyPhone = d => d && d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : d;
  let kind = 'offer', deal = null;

  async function startUnsub(){
    $('dLoad').hidden = true; $('dUnsub').hidden = false;
    $('dUnsubGo').onclick = async () => {
      $('dUnsubGo').disabled = true;
      const r = db ? await db.rpc('deal_unsubscribe', { p_token:unsub }) : { error:true };
      const m = $('dUnsubM'); m.hidden = false;
      if (r.error || !r.data || !r.data.ok) { m.textContent = 'This link has expired. Reply to the email with "unsubscribe" and we will take you off the list.'; $('dUnsubGo').disabled = false; return; }
      $('dBrand').textContent = r.data.brand;
      $('dUnsubGo').hidden = true; m.textContent = 'Done. You will not get deal emails from ' + r.data.brand + ' anymore.';
    };
  }

  async function start(){
    if (unsub) return startUnsub();
    if (!slug || !db) { $('dLoad').hidden = true; $('dGone').hidden = false; return; }
    const r = await db.rpc('deal_page_get', { p_slug:slug, p_token:token || null });
    $('dLoad').hidden = true;
    if (r.error || !r.data || !r.data.found) { $('dGone').hidden = false; return; }
    deal = r.data; draw();
  }

  function draw(){
    const d = deal;
    document.title = d.title + ' · ' + d.brand;
    $('dBrand').textContent = d.brand; $('dPill').hidden = false;
    $('dTitle').textContent = d.title;
    $('dPlace').textContent = [d.address, d.place].filter(Boolean).join(', ') + (d.ptype ? ' · ' + d.ptype : '');
    $('dPrice').textContent = money(+d.price) || 'Make an offer';
    // photos
    const ph = Array.isArray(d.photos) ? d.photos : [];
    if (ph.length) {
      $('dGal').hidden = false;
      const show = i => { $('dMain').src = PUB + ph[i]; $('dMain').alt = 'Photo ' + (i + 1) + ' of ' + ph.length; [...$('dThumbs').children].forEach((b, j) => b.setAttribute('aria-current', String(i === j))); };
      $('dThumbs').hidden = ph.length < 2;
      ph.forEach((p, i) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Show photo ' + (i + 1)); const im = document.createElement('img'); im.src = PUB + p; im.alt = ''; im.loading = 'lazy'; b.append(im); b.onclick = () => show(i); $('dThumbs').append(b); });
      show(0);
    }
    // facts
    const f = [];
    const add = (l, v) => { if (v) f.push([l, v]); };
    if (d.kind === 'land') { add('Acres', +d.acres > 0 ? trim(+d.acres) : ''); if (+d.acres > 0 && +d.price > 0) add('Per acre', money(d.price / d.acres)); }
    else {
      add('Value after repairs', money(+d.arv)); add('Repair estimate', money(+d.repairs));
      if (+d.beds > 0 || +d.baths > 0) add('Beds / baths', (+d.beds > 0 ? trim(+d.beds) : '-') + ' / ' + (+d.baths > 0 ? trim(+d.baths) : '-'));
      add('Square feet', +d.sqft > 0 ? Math.round(+d.sqft).toLocaleString('en-US') : ''); add('Year built', d.year_built || ''); add('Rehab level', d.rehab || '');
    }
    if (d.close_by) add('Close by', day(d.close_by));
    $('dFacts').innerHTML = '';
    f.forEach(x => { const el = document.createElement('div'), s = document.createElement('span'), b = document.createElement('b'); s.textContent = x[0]; b.textContent = x[1]; el.append(s, b); $('dFacts').append(el); });
    if (d.description) { $('dAboutW').hidden = false; $('dAbout').textContent = d.description; }
    if (d.terms) { $('dTermsW').hidden = false; $('dTerms').textContent = d.terms; }
    if (d.close_by) $('fClose').value = String(d.close_by).slice(0, 10);
    $('fClose').min = new Date().toISOString().slice(0, 10);
    // map: an area circle when the street address is hidden
    if (d.lat != null && d.lng != null) {
      $('dMapW').hidden = false; $('dMapN').textContent = d.approx ? 'The circle shows the general area. We share the exact address with serious buyers.' : '';
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
      s.onload = () => {
        const m = L.map('dMap', { scrollWheelZoom:false }).setView([+d.lat, +d.lng], d.approx ? 12 : 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:18, attribution:'&copy; OpenStreetMap contributors' }).addTo(m);
        if (d.approx) L.circle([+d.lat, +d.lng], { radius:1600, color:'#94650C', fillColor:'#E3AA35', fillOpacity:.25 }).addTo(m);
        else L.circleMarker([+d.lat, +d.lng], { radius:9, color:'#14213D', fillColor:'#E3AA35', fillOpacity:1, weight:3 }).addTo(m);
      };
      document.body.append(s);
    }
    const you = d.you || {};
    if (you.offered) { $('dYou').hidden = false; $('dYou').textContent = 'We have your offer. Send another if you want to change it.'; }
    else if (you.interested) { $('dYou').hidden = false; $('dYou').textContent = 'We know you are interested. Send an offer when you are ready.'; }
    $('dFoot').textContent = d.brand + (d.phone ? ' · ' + prettyPhone(d.phone) : '') + ' · Off-market deal. Buyers do their own due diligence.';
    $('dDeal').hidden = false;
  }

  document.querySelector('.tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-k]'); if (!b) return;
    kind = b.dataset.k;
    document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    $('dForm').classList.toggle('interest', kind === 'interest');
    $('fGo').textContent = kind === 'offer' ? 'Send my offer' : 'Tell them I’m interested';
  });

  $('dForm').addEventListener('submit', async e => {
    e.preventDefault();
    const say = t => { $('fMsg').textContent = t; $('fMsg').hidden = !t; };
    const fail = (id, t) => { say(t); $(id).focus(); };
    say('');
    const amt = +String($('fAmt').value).replace(/[$,\s]/g, ''), phone = $('fPhone').value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''), email = $('fEmail').value.trim();
    const pof = (document.querySelector('input[name=pof]:checked') || {}).value;
    if (kind === 'offer') {
      if (!(amt > 0)) return fail('fAmt', 'Please add your offer amount.');
      if (!$('fClose').value) return fail('fClose', 'Please pick the date you can close by.');
      if (pof == null) return say('Please say whether you have proof of funds ready.');
    }
    if ($('fName').value.trim().length < 2) return fail('fName', 'Please add your name.');
    if (!email && !phone) return fail('fEmail', 'Please add an email or a phone number.');
    if (email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return fail('fEmail', 'Please check your email.');
    if (phone && phone.length !== 10) return fail('fPhone', 'Please use a 10-digit US phone number.');
    $('fGo').disabled = true;
    const note = [$('fCo').value.trim() ? 'Company: ' + $('fCo').value.trim() : '', $('fNote').value.trim()].filter(Boolean).join('\n');
    const { error } = await db.rpc('deal_page_reply', { p_slug:slug, p_token:token || null, p_kind:kind, p_name:$('fName').value, p_email:email, p_phone:phone,
      p_amount:kind === 'offer' ? amt : null, p_close_on:kind === 'offer' ? $('fClose').value : null, p_pof:kind === 'offer' ? pof === '1' : null, p_note:note,
      p_website:$('fWebsite').value, p_started_at:startedAt });
    $('fGo').disabled = false;
    if (error) return say(error.code === '22023' ? error.message : 'Something went wrong sending this. Please try again in a minute.');
    $('dForm').hidden = true; document.querySelector('.tabs').hidden = true; $('dYou').hidden = true;
    $('fDoneT').textContent = kind === 'offer' ? 'Your offer of ' + money(amt) + ' is in. We’ll get back to you soon.' : 'We’ll reach out soon with the details.';
    $('fDone').hidden = false; $('fDone').focus();
  });

  start();
})();
