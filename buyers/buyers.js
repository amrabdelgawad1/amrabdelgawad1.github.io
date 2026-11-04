// "Join the cash buyers list" form at /buyers/. Anyone can fill it in; it can only call buyer_signup()
// (supabase/migrations/20261105010000_buyer_signups.sql), which checks the fields, stops spam and saves one row.
// Amr reads sign-ups in Admin > Logs > Buyer sign-ups.
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const startedAt = new Date().toISOString();
  const cfg = window.TRACKER_CONFIG || {};
  const db = window.supabase && cfg.supabaseUrl ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth:{ persistSession:false } }) : null;

  const num = v => { const n = Number(String(v).replace(/[^0-9.]/g, '')); return String(v).trim() && isFinite(n) ? n : null; };
  const say = t => { $('bMsg').textContent = t; $('bMsg').hidden = !t; };

  $('bForm').addEventListener('submit', async e => {
    e.preventDefault();
    say('');
    const kinds = [...document.querySelectorAll('input[name=kind]:checked')].map(x => x.value);
    const states = $('bStates').value.split(/[\s,;/]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
    const badState = states.find(s => !/^[A-Z]{2}$/.test(s));
    const digits = $('bPhone').value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');

    if ($('bName').value.trim().length < 2) return fail('bName', 'Please add your name.');
    if (digits.length !== 10) return fail('bPhone', 'Please add a 10-digit US phone number.');
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test($('bEmail').value.trim())) return fail('bEmail', 'Please check your email.');
    if (!kinds.length) return say('Pick land, houses, or both.');
    if (badState) return fail('bStates', '“' + badState + '” isn’t a two-letter state code. Use codes like OH, NC, TX.');
    const min = num($('bMin').value), max = num($('bMax').value);
    if (min != null && max != null && min > max) return fail('bMin', 'The lowest price is above the highest.');
    if (!db) return say('The form couldn’t load. Please refresh the page or email me instead.');

    $('bGo').disabled = true; $('bGo').textContent = 'Sending…';
    const { error } = await db.rpc('buyer_signup', {
      p_name: $('bName').value, p_company: $('bCompany').value, p_phone: digits, p_email: $('bEmail').value,
      p_kinds: kinds, p_states: states, p_areas: $('bAreas').value, p_price_min: min, p_price_max: max,
      p_funding: $('bFunding').value || null, p_close_days: num($('bClose').value), p_per_year: $('bYear').value || null,
      p_notes: $('bNotes').value, p_texts_ok: $('bTexts').checked, p_started_at: startedAt, p_website: $('bWebsite').value
    });
    $('bGo').disabled = false; $('bGo').textContent = 'Join the buyers list';
    if (error) return say(error.code === '22023' ? error.message : 'Something went wrong sending this. Please try again in a minute.');
    $('bForm').hidden = true; $('bDone').hidden = false; $('bDone').focus();
  });

  function fail(id, text){ say(text); $(id).focus(); }
})();
