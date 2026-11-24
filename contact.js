// Round 35 (plan S9): the site contact form. Any element with data-contact gets the form; data-contact="Hiring a team"
// presets the topic. It calls contact_submit() only (talents-database migration round35_public_site), which checks the
// fields, runs the shared spam guard (private.form_guard, form 'contact') and saves one row for Amr's portal inbox
// (/app/#inbox) with a bell. Nothing is emailed to the sender: Amr replies himself.
// No Supabase library needed: one fetch to the RPC with the public key from /tracker/config.js.
(function(){
  'use strict';
  const TOPICS = ['Hiring me', 'Hiring a team', 'Courses', 'Something else'];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  let n = 0;

  function mount(box){
    if (box.dataset.ready) return;
    box.dataset.ready = '1';
    const id = 'cf' + (++n), started = new Date().toISOString();
    const pre = TOPICS.includes(box.dataset.contact) ? box.dataset.contact : 'Hiring me';
    box.innerHTML =
      '<form class="cf" novalidate>' +
        '<div class="cf-row">' +
          '<label for="' + id + 'n"><span>Name</span><input id="' + id + 'n" name="name" maxlength="80" autocomplete="name" required></label>' +
          '<label for="' + id + 'e"><span>Email</span><input id="' + id + 'e" name="email" type="email" maxlength="120" autocomplete="email" required></label>' +
        '</div>' +
        '<div class="cf-row">' +
          '<label for="' + id + 'p"><span>Phone <small>(optional)</small></span><input id="' + id + 'p" name="phone" type="tel" maxlength="30" autocomplete="tel"></label>' +
          '<label for="' + id + 't"><span>What’s this about?</span><select id="' + id + 't" name="topic">' +
            TOPICS.map(t => '<option' + (t === pre ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></label>' +
        '</div>' +
        '<label for="' + id + 'm"><span>Message</span><textarea id="' + id + 'm" name="message" rows="5" maxlength="3000" required placeholder="A few lines about what you need."></textarea></label>' +
        '<label class="cf-hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>' +
        '<p class="cf-fine">Your message goes only to me. I keep it to reply to you, as the <a href="/privacy/">privacy policy</a> explains.</p>' +
        '<p class="cf-err" role="alert" hidden></p>' +
        '<button type="submit" class="btn btn-primary cf-go">Send message</button>' +
      '</form>' +
      '<div class="cf-done" tabindex="-1" hidden><p class="cf-done-h">Thanks, I got your message.</p><p>I read every one myself and reply by email, usually within a day.</p></div>';
    const f = box.querySelector('form'), err = box.querySelector('.cf-err'), go = box.querySelector('.cf-go');
    const say = t => { err.textContent = t; err.hidden = !t; };
    const fail = (name, t) => { say(t); f.elements[name].focus(); };
    f.addEventListener('input', () => say(''));
    f.addEventListener('submit', async e => {
      e.preventDefault(); say('');
      const v = k => f.elements[k].value.trim();
      if (v('name').length < 2) return fail('name', 'Please add your name.');
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v('email'))) return fail('email', 'Please check your email.');
      if (v('message').length < 5) return fail('message', 'Please write a short message.');
      const cfg = window.TRACKER_CONFIG || {};
      if (!cfg.supabaseUrl) return say('The form couldn’t load. Please refresh the page or email amr@amrabdelgawad.site.');
      go.disabled = true; go.textContent = 'Sending…';
      try {
        const r = await fetch(cfg.supabaseUrl + '/rest/v1/rpc/contact_submit', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', apikey:cfg.supabaseKey, Authorization:'Bearer ' + cfg.supabaseKey },
          body:JSON.stringify({ p_name:v('name'), p_email:v('email'), p_phone:v('phone'), p_topic:f.elements.topic.value, p_message:v('message'),
            p_page:location.pathname, p_website:f.elements.website.value, p_started_at:started })
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.code === '22023' && j.message ? j.message + '.' : 'Something went wrong sending this. Please try again in a minute, or email amr@amrabdelgawad.site.');
        }
        f.hidden = true; const d = box.querySelector('.cf-done'); d.hidden = false; d.focus();
      } catch(x) {
        say(x.message && !/fetch|network/i.test(x.message) ? x.message : 'Couldn’t reach the server. Check your connection and try again.');
      } finally { go.disabled = false; go.textContent = 'Send message'; }
    });
  }
  function all(){ document.querySelectorAll('[data-contact]').forEach(mount); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', all); else all();
})();
