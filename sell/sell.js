// Round 26 (S6, D1): the "we buy" page at /sell/. Anyone can fill it in. It can only call seller_page_info() (is the
// page open, and under which business name) and seller_lead_submit(), which checks the fields, stops spam
// (private.form_guard), checks the do-not-call list, records the consent and saves one row in the new seller leads
// inbox. Amr or a rep adds the lead to the Deal CRM board from the CRM Inbox; that encrypts it and deletes the plain row.
// Leads nobody adds are deleted after 30 days. SQL: portal-backups docs/sql/2026-11-19-round26-sellers.sql.
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const startedAt = new Date().toISOString();
  const cfg = window.TRACKER_CONFIG || {};
  const db = window.supabase && cfg.supabaseUrl ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth:{ persistSession:false } }) : null;
  const say = t => { $('sMsg').textContent = t; $('sMsg').hidden = !t; };
  const fail = (id, text) => { say(text); $(id).focus(); };
  const prettyPhone = d => d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : d;

  async function start(){
    let info = { open:false };
    if (db) { const r = await db.rpc('seller_page_info'); if (!r.error && r.data) info = r.data; }
    if (!info.open) { $('sClosed').hidden = false; return; }
    $('sBrand').textContent = info.brand;
    document.title = 'Sell your property for cash · ' + info.brand;
    document.querySelectorAll('.sB').forEach(e => { e.textContent = info.brand; });
    if (info.phone) { const a = document.createElement('a'); a.href = 'tel:+1' + info.phone; a.textContent = prettyPhone(info.phone); $('sFoot').append(' Rather talk now? Call ', a, '.'); }
    $('sOpen').hidden = false;
  }

  $('sForm').addEventListener('submit', async e => {
    e.preventDefault();
    say('');
    const digits = $('sPhone').value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    const email = $('sEmail').value.trim();
    const kind = (document.querySelector('input[name=kind]:checked') || {}).value || null;
    if ($('sName').value.trim().length < 2) return fail('sName', 'Please add your name.');
    if (digits.length !== 10) return fail('sPhone', 'Please add a 10-digit US phone number.');
    if (email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return fail('sEmail', 'Please check your email.');
    if ($('sAddr').value.trim().length < 4) return fail('sAddr', 'Please add the property address or parcel number.');
    if (!$('sConsent').checked) return fail('sConsent', 'Please tick the first box so we can contact you about the property.');
    if (!db) return say('The form couldn’t load. Please refresh the page and try again.');

    $('sGo').disabled = true; $('sGo').textContent = 'Sending…';
    const { error } = await db.rpc('seller_lead_submit', {
      p_name: $('sName').value, p_phone: digits, p_email: email, p_address: $('sAddr').value, p_city_state: $('sCity').value,
      p_kind: kind, p_timeline: $('sWhen').value || null, p_condition: $('sCond').value || null, p_asking: $('sAsk').value,
      p_why: $('sWhy').value, p_consent: $('sConsent').checked, p_texts_ok: $('sTexts').checked, p_started_at: startedAt,
      p_website: $('sWebsite').value, p_ua: navigator.userAgent
    });
    $('sGo').disabled = false; $('sGo').textContent = 'Send my details';
    if (error) return say(error.code === '22023' ? error.message : 'Something went wrong sending this. Please try again in a minute.');
    $('sForm').hidden = true; $('sDone').hidden = false; $('sDone').focus();
  });

  start();
})();
