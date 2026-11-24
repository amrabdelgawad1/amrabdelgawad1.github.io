// "Request course access" form at /signup/ (round 35, plan S3). It can only call signup_request_submit()
// (talents-database migration round35_public_site): checks the fields, runs the shared spam guard (form 'signup'),
// saves one request and rings Amr's bell. Amr approves in /app > Sign-up requests, which sends the normal invite.
// Nothing is emailed from here. One fetch, no Supabase library.
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const startedAt = new Date().toISOString();
  const cfg = window.TRACKER_CONFIG || {};
  const say = t => { $('sMsg').textContent = t; $('sMsg').hidden = !t; };
  const fail = (id, t) => { say(t); $(id).focus(); };
  // /signup/?course=mkt ticks that course
  try { const c = new URLSearchParams(location.search).get('course'); const box = c && document.querySelector('input[name=course][value="' + c.replace(/[^a-z]/g, '') + '"]'); if (box) box.checked = true; } catch(e) {}

  $('sForm').addEventListener('submit', async e => {
    e.preventDefault(); say('');
    const v = id => $(id).value.trim();
    const courses = [...document.querySelectorAll('input[name=course]:checked')].map(x => x.value);
    if (v('sName').length < 2) return fail('sName', 'Please add your full name.');
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v('sEmail'))) return fail('sEmail', 'Please check your email.');
    if (!courses.length) return say('Pick at least one course.');
    if (!cfg.supabaseUrl) return say('The form couldn’t load. Please refresh the page or email me instead.');
    $('sGo').disabled = true; $('sGo').textContent = 'Sending…';
    try {
      const r = await fetch(cfg.supabaseUrl + '/rest/v1/rpc/signup_request_submit', {
        method:'POST', headers:{ 'Content-Type':'application/json', apikey:cfg.supabaseKey, Authorization:'Bearer ' + cfg.supabaseKey },
        body:JSON.stringify({ p_name:v('sName'), p_email:v('sEmail'), p_courses:courses, p_why:v('sWhy'), p_website:$('sWebsite').value, p_started_at:startedAt })
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); return say(j.code === '22023' && j.message ? j.message + '.' : 'Something went wrong sending this. Please try again in a minute.'); }
      $('sForm').hidden = true; $('sDone').hidden = false; $('sDone').focus();
    } catch(x) { say('Couldn’t reach the server. Check your connection and try again.'); }
    finally { $('sGo').disabled = false; $('sGo').textContent = 'Send my request'; }
  });
})();
