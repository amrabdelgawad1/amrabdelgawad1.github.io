// "Join the team" form at /join/. Anyone can fill it in; it can only call apply_to_team()
// (supabase/migrations/20261109_portal_batch.sql), which checks the fields, stops spam and saves one row.
// Amr reads applications in /app > Applications, and gets a notification for each one.
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const startedAt = new Date().toISOString();
  const cfg = window.TRACKER_CONFIG || {};
  const db = window.supabase && cfg.supabaseUrl ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth:{ persistSession:false } }) : null;
  const say = t => { $('jMsg').textContent = t; $('jMsg').hidden = !t; };
  const fail = (id, t) => { say(t); $(id).focus(); };
  // ?ref=Name in a rep's share link fills "Did someone on the team send you?"
  try { const r = new URLSearchParams(location.search).get('ref'); if (r) $('jRef').value = r.slice(0, 80); } catch(e) {}

  $('jForm').addEventListener('submit', async e => {
    e.preventDefault(); say('');
    const v = id => $(id).value.trim();
    if (v('jName').length < 2) return fail('jName', 'Please add your full name.');
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v('jEmail'))) return fail('jEmail', 'Please check your email.');
    if (!v('jPhone')) return fail('jPhone', 'Please add a phone or WhatsApp number so I can reach you.');
    if (!$('jEnglish').value) return fail('jEnglish', 'Please pick your spoken English level.');
    if (v('jSample') && !/^https:\/\//i.test(v('jSample'))) return fail('jSample', 'The voice note link should start with https://');
    if (!db) return say('The form couldn’t load. Please refresh the page or email me instead.');
    $('jGo').disabled = true; $('jGo').textContent = 'Sending…';
    const { data, error } = await db.rpc('apply_to_team', {
      p_name:v('jName'), p_email:v('jEmail'), p_phone:v('jPhone'), p_country:v('jCountry'), p_city:v('jCity'), p_english:$('jEnglish').value,
      p_experience:v('jExp'), p_hours:$('jHours').value, p_start:$('jStart').value, p_why:v('jWhy'), p_referred_by:v('jRef'), p_sample:v('jSample'),
      p_website:$('jWebsite').value, p_started_at:startedAt
    });
    $('jGo').disabled = false; $('jGo').textContent = 'Send my application';
    if (error) return say(error.code === 'P0001' ? error.message : 'Something went wrong sending this. Please try again in a minute.');
    if (window.countEvent) window.countEvent('apply-team', 'Applied to join the team');
    $('jForm').hidden = true; $('jDone').hidden = false;
    if (data === 'already') $('jDone').querySelector('p').textContent = 'You already applied recently, thank you. I read every application myself and reply within a few days.';
    $('jDone').focus();
  });
})();
