// Plan Round 36 (O5) of the Portal Master Feature Plan (Nov 25 2026): client portal, owner side. Amr only.
//   #clientaccess  Clients › Portal access. Per client: turn the portal on or off, pick which reps' hours and numbers
//                  the client sees, pick which call recordings to share, and add, link, switch off or restore client logins.
// What a client sees (decided Nov 25): hours and numbers only, plus shared recordings and sent invoices. No pay rates,
// no bill rates, no notes, no scores. The client's own pages are /client/ (client/client.js).
// Logins: a sign-in link Amr copies and sends himself (edge function client-access). Nothing emails or texts a client.
// Database (talents-database migration round36_client_portal): client_portal, client_portal_users, client_portal_recordings,
// client_company(), client_me(), client_numbers(), client_invoices(), client_recordings(), client_can_open() (storage),
// client_portal_recording_choices(). RLS is_tracker_admin() on the three tables.
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, $, esc, safe, isOwner, fmtDay, card, empty, failed, pill, f, opt, table, tr, say, errText } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const toast = t => { if (window.PortalUI) window.PortalUI.toast(t); };
  const day = d => d ? fmtDay(d, { month:'short', day:'numeric', year:'numeric' }) : '–';
  const when = at => at ? new Date(at).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true }) : 'Not yet';
  const mins = s => s ? Math.max(1, Math.round(s / 60)) + ' min' : '';
  const S = { co:null, out:{} };

  async function callAccess(body){
    const { data, error } = await db().functions.invoke('client-access', { body });
    if (error) {
      let msg = 'Something went wrong. Try again.';
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch(e){}
      if (/not found|404|Failed to send/i.test(error.message || '') && msg === 'Something went wrong. Try again.') msg = 'The sign-in link service isn’t set up yet.';
      return { error: msg };
    }
    return data || {};
  }
  const linkBox = (uid, name) => {
    const o = S.out[uid]; if (!o) return '';
    const text = 'Hi ' + (String(name).split(' ')[0] || '') + ', here is your sign-in link for your client portal at amrabdelgawad.site. Open it, choose a password, and you will see your team’s hours, numbers, shared calls and invoices: ' + o;
    return '<div class="r36-link"><p class="p-hint">Copy this and send it yourself. It works once; make a new one if it expires.</p><input class="field" readonly value="' + esc(o) + '" aria-label="Sign-in link" />' +
      '<div class="px-tools"><button type="button" class="p-btn is-ghost" data-r36copy="' + esc(uid) + '">Copy link</button>' +
      '<a class="p-btn is-ghost" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(text) + '">Open WhatsApp with this message</a></div></div>';
  };

  V.clientaccess = { title:'Client portal access', sec:'owner', async open(el){
    if (!isOwner()) { el.innerHTML = '<div class="p-wrap px"><p class="p-card p-empty">This page is only for Amr.</p></div>'; return; }
    el.innerHTML = '<div class="p-wrap px"><p class="p-card p-empty">Loading…</p></div>';
    const load = async () => {
      const [co, cp, us, ag, ac, rc] = await Promise.all([
        safe(db().from('companies').select('id,name').order('name')),
        safe(db().from('client_portal').select('company_id,is_on,rep_ids')),
        safe(db().from('client_portal_users').select('user_id,company_id,name,email,active,created_at,last_seen_at').order('created_at')),
        safe(db().from('agents').select('id,name,active').order('name')),
        safe(db().from('agent_companies').select('agent_id,company_id')),
        safe(db().rpc('client_portal_recording_choices'))
      ]);
      const bad = [co, cp, us, ag, rc].find(x => x.error);
      if (bad) { el.innerHTML = '<div class="p-wrap px">' + failed(bad.error) + '</div>'; return; }
      const cos = co.data || [];
      if (!cos.length) { el.innerHTML = '<div class="p-wrap px">' + card('Client portal access', '', empty('Add a client in Clients first.')) + '</div>'; return; }
      const fromHash = +(location.hash.slice(1).split('/')[1] || 0);
      if (fromHash && cos.some(c => c.id === fromHash)) S.co = fromHash;
      if (!cos.some(c => c.id === S.co)) S.co = cos[0].id;
      const set = (cp.data || []).find(x => x.company_id === S.co) || { company_id:S.co, is_on:false, rep_ids:[], none:true };
      const users = (us.data || []).filter(u => u.company_id === S.co);
      const linked = new Set((ac.data || []).filter(x => x.company_id === S.co).map(x => x.agent_id));
      const agents = (ag.data || []).filter(a => a.active || set.rep_ids.includes(a.id));
      const recs = rc.data || [];
      const coName = (cos.find(c => c.id === S.co) || {}).name || '';
      const live = !set.none && set.is_on;

      el.innerHTML = '<div class="p-wrap px r36">' +
        '<div class="px-tools r36-top">' + f('Client', '<select id="r36Co">' + cos.map(c => opt(c.id, c.name, c.id === S.co)).join('') + '</select>') +
          '<span class="r36-state">' + (set.none ? pill('Not set up', 'plain') : set.is_on ? pill('Portal on', 'ok') : pill('Portal off', 'plain')) + '</span></div>' +
        card('What ' + coName + ' sees', '', '<p class="p-hint">Signed in, they see the hours and numbers (dials, conversations, appointments, offers) of the reps you tick, the recordings you share, and invoices you’ve sent. Never pay rates, bill rates, notes, scores or anything about other clients.</p>' +
          '<label class="r36-switch"><input type="checkbox" id="r36On"' + (live ? ' checked' : '') + ' /> <span>Portal access is on for ' + esc(coName) + '</span></label>' +
          '<p class="p-hint">Off shuts every one of their logins out right away. Their logins and your picks stay, so you can turn it back on.</p>' +
          '<h3 class="r20-h">Reps they see</h3>' +
          (agents.length ? '<div class="r36-reps">' + agents.map(a => '<label class="r36-chk"><input type="checkbox" data-r36rep="' + a.id + '"' + ((set.none ? linked.has(a.id) : set.rep_ids.includes(a.id)) ? ' checked' : '') + ' /> <span>' + esc(a.name) + (linked.has(a.id) ? ' <small>works for them</small>' : '') + '</span></label>').join('') + '</div>' : empty('No reps yet.')) +
          '<div class="px-tools"><button type="button" class="p-btn" id="r36Save">Save</button><span class="p-hint" id="r36Msg" role="status"></span></div>') +
        card('Logins', users.length ? users.filter(u => u.active).length + ' on' : '', (users.length ? users.map(u =>
          '<div class="r36-user" data-uid="' + esc(u.user_id) + '"><div><b>' + esc(u.name) + '</b> ' + (u.active ? pill('Login on', 'ok') : pill('Login off', 'plain')) +
            '<div class="p-hint">' + esc(u.email) + ' · added ' + esc(day(u.created_at)) + ' · last opened ' + esc(when(u.last_seen_at)) + '</div></div>' +
            '<div class="px-tools">' + (u.active ? '<button type="button" class="p-btn is-ghost" data-r36link="' + esc(u.user_id) + '">New sign-in link</button><button type="button" class="p-btn is-ghost" data-r36off="' + esc(u.user_id) + '">Turn off</button>'
              : '<button type="button" class="p-btn is-ghost" data-r36back="' + esc(u.user_id) + '">Turn back on</button>') + '</div>' + linkBox(u.user_id, u.name) + '</div>').join('') : empty('No logins for ' + coName + ' yet.')) +
          '<form id="r36Add" class="r36-add" novalidate><h3 class="r20-h">Add a login</h3><div class="r36-grid">' +
            f('Their name', '<input id="r36Name" maxlength="120" autocomplete="off" />') + f('Their email', '<input id="r36Email" type="email" maxlength="200" autocomplete="off" placeholder="name@company.com" />') + '</div>' +
            '<div class="px-tools"><button type="submit" class="p-btn" id="r36AddBtn">Make a sign-in link</button><span class="p-hint" id="r36AddMsg" role="status"></span></div>' +
            '<p class="p-hint">This only makes a link for you to copy. Nothing is emailed or texted.' + (live ? '' : ' Their page stays closed until you turn portal access on above and save.') + '</p>' + (S.out.new ? linkBox('new', S.out.newName || '') : '') + '</form>') +
        card('Recordings they can play', recs.filter(r => (r.shared_with || []).includes(S.co)).length + ' shared', recs.length ?
          table(['Share', 'Call', 'Rep', 'Length', 'Recorded'], recs.map(r => tr(['<input type="checkbox" data-r36rec="' + esc(r.upload_id) + '" aria-label="Share ' + esc(r.title) + '"' + ((r.shared_with || []).includes(S.co) ? ' checked' : '') + ' />',
            esc(r.title), esc(r.rep || '–'), esc(mins(r.duration_s) || '–'), esc(when(r.recorded_at))]))) + '<p class="p-hint">Ticking shares it right away; unticking hides it from them. They see the call’s title and the rep’s first name, never the score.</p>'
          : empty('No call recordings yet. Reps add them from the Learning Hub or Deal CRM.')) +
        '<p class="p-hint r36-foot">They sign in at amrabdelgawad.site/app with their email and the password they choose, and land on their own page.</p>' +
        '</div>';

      $('r36Co').addEventListener('change', e => { S.co = +e.target.value; S.out = {}; history.replaceState(null, '', '#clientaccess/' + S.co); load(); });
      $('r36Save').addEventListener('click', async () => {
        const reps = [...el.querySelectorAll('[data-r36rep]:checked')].map(x => +x.dataset.r36rep);
        const y = await safe(db().from('client_portal').upsert({ company_id:S.co, is_on:$('r36On').checked, rep_ids:reps, updated_at:new Date().toISOString() }, { onConflict:'company_id' }));
        if (y.error) { say('r36Msg', errText(y, 'Couldn’t save it.')); return; }
        toast('Saved.'); load();
      });
      el.querySelectorAll('[data-r36rec]').forEach(b => b.addEventListener('change', async () => {
        b.disabled = true;
        const y = b.checked ? await safe(db().from('client_portal_recordings').insert({ company_id:S.co, upload_id:b.dataset.r36rec }))
          : await safe(db().from('client_portal_recordings').delete().eq('company_id', S.co).eq('upload_id', b.dataset.r36rec));
        b.disabled = false;
        if (y.error) { b.checked = !b.checked; toast(errText(y, 'Couldn’t change it.')); return; }
        toast(b.checked ? 'Shared with ' + coName + '.' : 'Hidden from ' + coName + '.');
      }));
      $('r36Add').addEventListener('submit', async e => {
        e.preventDefault();
        const name = $('r36Name').value.trim(), email = $('r36Email').value.trim();
        if (name.length < 2) { say('r36AddMsg', 'Add their full name.'); $('r36Name').focus(); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('r36AddMsg', 'Check their email.'); $('r36Email').focus(); return; }
        $('r36AddBtn').disabled = true; say('r36AddMsg', 'Making the link…');
        const r = await callAccess({ action:'invite', name, email, company_id:S.co });
        $('r36AddBtn').disabled = false;
        if (r.error) { say('r36AddMsg', r.error); return; }
        S.out = { new:r.link, newName:name }; load();
      });
      el.querySelectorAll('[data-r36link]').forEach(b => b.addEventListener('click', async () => {
        b.disabled = true; const r = await callAccess({ action:'link', user_id:b.dataset.r36link }); b.disabled = false;
        if (r.error) { toast(r.error); return; }
        S.out = { [b.dataset.r36link]:r.link }; load();
      }));
      el.querySelectorAll('[data-r36off]').forEach(b => b.addEventListener('click', async () => {
        if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? Turn off'; setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.textContent = 'Turn off'; } }, 4000); return; }
        b.disabled = true; const r = await callAccess({ action:'remove', user_id:b.dataset.r36off });
        if (r.error) { b.disabled = false; toast(r.error); return; }
        toast('Login turned off.'); load();
      }));
      el.querySelectorAll('[data-r36back]').forEach(b => b.addEventListener('click', async () => {
        b.disabled = true; const r = await callAccess({ action:'restore', user_id:b.dataset.r36back });
        if (r.error) { b.disabled = false; toast(r.error); return; }
        toast('Login turned back on.'); load();
      }));
      el.querySelectorAll('[data-r36copy]').forEach(b => b.addEventListener('click', async () => {
        const v = S.out[b.dataset.r36copy];
        try { await navigator.clipboard.writeText(v); toast('Link copied.'); } catch(e) { const i = b.closest('.r36-link').querySelector('input'); i.select(); toast('Press Ctrl+C or Copy to copy it.'); }
      }));
    };
    load();
  }};
})();
