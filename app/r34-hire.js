// Round 34 of the Portal Master Feature Plan (Nov 24 2026): hiring. Owner pages sit in People and access.
//   #jobs        R1  Job posts: the jobs on amrabdelgawad.site/join (job_posts). Open ones show there with an apply form that
//                    says which job; closed ones stay here with their applicants. Copy a direct link per job.
//   #hiring      R2  Applicant board: Applied, Screened, Voice test, Roleplay, Offer, Hired, Rejected as columns (same board as
//                    the client pipeline: drag, arrows, swipe). A card opens the applicant with the voice test player.
//                R3  The voice test is recorded on /join/ (join/join.js); here Amr plays it (private bucket voice-tests).
//                R8  Hire: one form makes the account (the same team-access invite as Invite and access, so email or a WhatsApp
//                    link only when Amr presses it), sets the access template, picks course modules with a finish date, puts
//                    the first shift on the schedule and saves the onboarding plan (hire_finish). Onboarding then shows each
//                    plan, and the new person sees theirs on their home page.
//   #handbook    R9  Required pages: Amr marks a page as needing a sign-off; team members type their name to sign (handbook_sign,
//                    also saved in Agreements as consent records). Amr sees who signed which version and can ask again.
//   #offboarding R11 Finish: final pay (offboard_final_pay, from Payroll's own items), a saved copy of their record in Files,
//                    exit notes, and one button that signs them out on every device, switches off every tool and blocks the
//                    sign-in (offboard_cut + team-access remove). Undo gives the old access back.
// Nothing here emails or texts an applicant by itself. Bells stay inside the portal.
// Database: job_posts, job_applications (+ stage, post_id, voice_*), private.voice_tickets, handbook_signoffs, onboarding_plans,
// offboardings (+ exit_notes, access_before, cut_at, record_path); functions apply_for_job, voice_test_ticket, hire_finish,
// onboarding_plan, handbook_sign, my_handbook_signoffs, handbook_signoff_status, handbook_set_required, offboard_final_pay,
// offboard_record, offboard_cut, offboard_restore.
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, $, esc, safe, isOwner, isoDay, fmtDay, usd, plural, card, empty, failed, pill, f, opt, say, errText, table, tr, zonedToUtc } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const when = (at, o) => window.PortalUI ? window.PortalUI.when(at, Object.assign({ zone:false }, o || {})) : new Date(at).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true });
  const zone = () => window.PortalUI ? window.PortalUI.zone() : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zoneName = () => (window.PortalUI && window.PortalUI.zoneShort && window.PortalUI.zoneShort(zone(), new Date())) || zone();
  const day = d => d ? fmtDay(d, { month:'short', day:'numeric', year:'numeric' }) : '';
  const first = n => String(n || '').trim().split(/\s+/)[0] || 'them';
  const toast = t => { if (T().toast) T().toast(t); else if (window.PortalUI) window.PortalUI.toast(t); };
  const sure = (b, t) => { if (b.dataset.sure === '1') return true; const o = b.textContent; b.dataset.sure = '1'; b.textContent = t; setTimeout(() => { if (b.isConnected && b.dataset.sure === '1') { b.dataset.sure = ''; b.textContent = o; } }, 4000); return false; };
  const ask = o => window.PortalUI ? window.PortalUI.confirm(o) : Promise.resolve(window.confirm(o.title));
  const hashParts = () => (location.hash || '').replace(/^#/, '').split('/');
  const fmtSecs = s => s ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : '';
  const val = id => { const el = $(id); return el ? el.value.trim() : ''; };
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return isoDay(d); };

  const STAGES = [['applied', 'Applied'], ['screened', 'Screened'], ['voice_test', 'Voice test'], ['roleplay', 'Roleplay'], ['offer', 'Offer'], ['hired', 'Hired'], ['rejected', 'Rejected']];
  const STAGE = {}; STAGES.forEach(([k, v]) => STAGE[k] = v);
  const DEFAULT_MODULES = ['m1', 'm5', 'm10'];   // Foundations, The Call, Handling the No's
  let modulesCache = null;
  async function modules(){
    if (modulesCache) return modulesCache;
    const r = await safe(db().from('course_modules').select('id,number,title:content->>title').order('number'));
    modulesCache = r.data || [];
    return modulesCache;
  }

  // ======================================================================
  // R1  Job posts
  // ======================================================================
  const slugOf = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'job';
  V.jobs = { title:'Job posts', sec:'owner', app:'people', async open(el, ok){
    const body = PX.page(el, 'People', 'Job posts', 'The jobs on amrabdelgawad.site/join. Open jobs show there with the apply form and the voice test; closed ones stay here with their applicants.');
    const S = { edit:null };
    let posts = [], apps = [];
    async function load(){
      const [p, a] = await Promise.all([safe(db().from('job_posts').select('*').order('sort').order('id')), safe(db().from('job_applications').select('id,post_id,stage').limit(5000))]);
      if (!ok()) return;
      if (p.error) { body.innerHTML = failed(p.error); return; }
      posts = p.data || []; apps = a.data || []; draw();
    }
    function form(p){
      p = p || { open:true, place:'Remote', sort:posts.length + 1 };
      return '<form class="px-form r34-form" id="r34jForm" data-id="' + (p.id || '') + '" novalidate>' +
        f('Job title', '<input type="text" id="r34jTitle" maxlength="120" value="' + esc(p.title || '') + '">', 'px-wide') +
        f('Link name', '<input type="text" id="r34jSlug" maxlength="60" value="' + esc(p.slug || '') + '" placeholder="made from the title">') +
        f('Kind of job', '<input type="text" id="r34jKind" maxlength="60" value="' + esc(p.kind || '') + '" placeholder="Calling rep">') +
        f('Where', '<input type="text" id="r34jPlace" maxlength="80" value="' + esc(p.place || '') + '">') +
        f('Pay', '<input type="text" id="r34jPay" maxlength="160" value="' + esc(p.pay || '') + '">') +
        f('Hours', '<input type="text" id="r34jHours" maxlength="160" value="' + esc(p.hours || '') + '">') +
        f('Order on the page', '<input type="number" id="r34jSort" value="' + esc(p.sort || 0) + '">') +
        f('Short summary', '<textarea id="r34jSum" rows="2" maxlength="600">' + esc(p.summary || '') + '</textarea>', 'px-wide') +
        f('What the job is (one point per line)', '<textarea id="r34jBody" rows="5" maxlength="8000">' + esc(p.body || '') + '</textarea>', 'px-wide') +
        f('What they need (one point per line)', '<textarea id="r34jNeeds" rows="4" maxlength="4000">' + esc(p.needs || '') + '</textarea>', 'px-wide') +
        f('Voice test: the text they read out loud', '<textarea id="r34jScript" rows="4" maxlength="1500">' + esc(p.voice_script || '') + '</textarea>', 'px-wide') +
        '<label class="p20-chk px-wide"><input type="checkbox" id="r34jVoice"' + (p.voice_required ? ' checked' : '') + '> The voice test is needed to apply</label>' +
        '<label class="p20-chk px-wide"><input type="checkbox" id="r34jOpen"' + (p.open ? ' checked' : '') + '> Open: show it on the Join page</label>' +
        '<div class="wk-row px-wide"><button class="p-btn" type="submit">Save job post</button><button class="p-btn is-ghost" type="button" data-r34jx>Cancel</button></div>' +
        '<p class="p-hint px-wide" id="r34jMsg" role="status"></p></form>';
    }
    function draw(){
      const count = (id, st) => apps.filter(a => a.post_id === id && (!st || a.stage === st)).length;
      const loose = apps.filter(a => !a.post_id).length;
      body.innerHTML = '<div class="px-tools"><button type="button" class="p-btn" id="r34jNew">+ New job post</button><a class="p-btn is-ghost" href="/join/" target="_blank" rel="noopener">See the Join page</a><a class="p-btn is-ghost" href="#hiring">Applicant board</a><span class="p-hint" id="r34jTop" role="status"></span></div>' +
        (S.edit === 'new' ? card('New job post', '', form(null)) : '') +
        (posts.length ? posts.map(p => S.edit === p.id ? card('Edit: ' + p.title, '', form(p)) :
          '<section class="p-card r34-job"><div class="p-card-head"><h2>' + esc(p.title) + '</h2><span>' + pill(p.open ? 'Open' : 'Closed', p.open ? 'ok' : 'plain') + '</span></div>' +
          '<p class="p-hint">' + esc([p.kind, p.place, p.pay].filter(Boolean).join(' · ')) + '</p>' +
          (p.summary ? '<p>' + esc(p.summary) + '</p>' : '') +
          '<div class="r34-counts">' + STAGES.map(([k, v]) => '<span><b>' + count(p.id, k) + '</b>' + esc(v) + '</span>').join('') + '</div>' +
          '<p class="p-hint">' + (p.voice_required ? 'Voice test needed to apply' : 'Voice test optional') + ' · link amrabdelgawad.site/join/#' + esc(p.slug) + '</p>' +
          '<div class="px-tools"><a class="p-btn is-ghost" href="#hiring/job/' + p.id + '">See applicants (' + count(p.id) + ')</a><button type="button" class="p-btn is-ghost" data-r34jedit="' + p.id + '">Edit</button>' +
            '<button type="button" class="p-btn is-ghost" data-r34jopen="' + p.id + '" data-to="' + !p.open + '">' + (p.open ? 'Close it' : 'Open it again') + '</button>' +
            '<button type="button" class="p-btn is-ghost" data-r34jcopy="' + esc(p.slug) + '">Copy link</button>' +
            (count(p.id) ? '' : '<button type="button" class="p-btn is-ghost r34-no" data-r34jdel="' + p.id + '">Delete</button>') + '</div></section>').join('')
          : card('No job posts yet', '', empty('Add the first job. It shows on amrabdelgawad.site/join as soon as it is open.'))) +
        (loose ? '<p class="p-hint">' + plural(loose, 'applicant') + ' applied before job posts existed (or with no job picked). They are on the Applicant board under All jobs.</p>' : '');
    }
    await load();
    body.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'r34jNew') { S.edit = 'new'; draw(); $('r34jTitle').focus(); return; }
      if (b.hasAttribute('data-r34jx')) { S.edit = null; draw(); return; }
      if (b.dataset.r34jedit) { S.edit = +b.dataset.r34jedit; draw(); $('r34jTitle').focus(); return; }
      if (b.dataset.r34jopen) {
        b.disabled = true; const x = await safe(db().from('job_posts').update({ open:b.dataset.to === 'true', updated_at:new Date().toISOString() }).eq('id', +b.dataset.r34jopen));
        if (x.error) { b.disabled = false; say('r34jTop', errText(x, 'Couldn’t change it. Try again.')); return; }
        await load(); say('r34jTop', b.dataset.to === 'true' ? 'Open again: it shows on the Join page.' : 'Closed: it no longer shows on the Join page.'); return;
      }
      if (b.dataset.r34jcopy) {
        const link = 'https://amrabdelgawad.site/join/#' + b.dataset.r34jcopy;
        try { await navigator.clipboard.writeText(link); say('r34jTop', 'Link copied: ' + link); } catch(er) { say('r34jTop', link); }
        return;
      }
      if (b.dataset.r34jdel) {
        if (!sure(b, 'Sure? Delete')) return;
        const x = await safe(db().from('job_posts').delete().eq('id', +b.dataset.r34jdel));
        if (x.error) { say('r34jTop', errText(x, 'Couldn’t delete it.')); return; }
        await load(); say('r34jTop', 'Job post deleted.');
      }
    });
    body.addEventListener('input', e => { if (e.target.id === 'r34jTitle' && $('r34jSlug') && !$('r34jForm').dataset.id && !$('r34jSlug').dataset.touched) $('r34jSlug').value = slugOf(e.target.value); if (e.target.id === 'r34jSlug') e.target.dataset.touched = '1'; });
    body.addEventListener('submit', async e => {
      if (e.target.id !== 'r34jForm') return; e.preventDefault();
      const id = +e.target.dataset.id || null, title = val('r34jTitle');
      if (title.length < 2) { say('r34jMsg', 'Give the job a title.'); $('r34jTitle').focus(); return; }
      const slug = slugOf(val('r34jSlug') || title);
      if (posts.some(p => p.slug === slug && p.id !== id)) { say('r34jMsg', 'Another job already uses the link name “' + slug + '”. Pick another.'); $('r34jSlug').focus(); return; }
      const row = { title, slug, kind:val('r34jKind') || null, place:val('r34jPlace') || null, pay:val('r34jPay') || null, hours:val('r34jHours') || null, sort:+val('r34jSort') || 0,
        summary:val('r34jSum') || null, body:val('r34jBody') || null, needs:val('r34jNeeds') || null, voice_script:val('r34jScript') || null,
        voice_required:$('r34jVoice').checked, open:$('r34jOpen').checked, updated_at:new Date().toISOString() };
      say('r34jMsg', 'Saving…');
      const x = id ? await safe(db().from('job_posts').update(row).eq('id', id)) : await safe(db().from('job_posts').insert(row));
      if (x.error) { say('r34jMsg', errText(x, 'Couldn’t save it. Try again.')); return; }
      S.edit = null; await load(); say('r34jTop', 'Saved.' + (row.open ? ' It shows on the Join page.' : ''));
    });
  }};

  // ======================================================================
  // R8  The plan form: used by Hire (new account) and by Onboarding (someone already on the team)
  // ======================================================================
  function planForm(o){
    // o: { app, name, email, member, plan, mods, companies }
    const pl = o.plan || {}, start = pl.start_on || addDays(isoDay(new Date()), 1), due = pl.modules_due || addDays(start, 14);
    const picked = new Set(pl.modules && pl.modules.length ? pl.modules : DEFAULT_MODULES);
    const tpls = (window.PeopleAccess && window.PeopleAccess.templates) || [];
    const sh = o.shift || null;
    const shDate = sh ? isoDay(new Date(new Date(sh.starts_at).toLocaleString('en-US', { timeZone:zone() }))) : '';
    const hm = at => { try { return new Intl.DateTimeFormat('en-GB', { timeZone:zone(), hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(new Date(at)); } catch(e) { return ''; } };
    return '<form class="px-form r34-form" id="r34Plan" data-app="' + (o.app || '') + '" data-user="' + esc(o.member ? o.member.user_id : '') + '" novalidate>' +
      (o.member ? '<p class="p-hint px-wide">' + esc(o.member.name) + ' is already in Invite and access' + (o.member.active ? '' : ' (access is off)') + ', so this only saves the onboarding plan.</p>' :
        f('Full name', '<input type="text" id="r34pName" maxlength="80" value="' + esc(o.name || '') + '">') +
        f('Email', '<input type="email" id="r34pEmail" maxlength="120" value="' + esc(o.email || '') + '">') +
        f('Works for', '<select id="r34pCo">' + opt('', 'Pick later') + (o.companies || []).map(c => opt(c.id, c.name)).join('') + '</select>') +
        '<fieldset class="r34-fs px-wide"><legend>Start as</legend><label class="p20-chk"><input type="radio" name="r34pTpl" value=""> Agent (everything the role comes with)</label>' +
          tpls.map(t => '<label class="p20-chk' + (t.off ? ' is-off' : '') + '"><input type="radio" name="r34pTpl" value="' + esc(t.id) + '"' + (t.off ? ' disabled' : '') + (t.id === 'caller' ? ' checked' : '') + '> ' + esc(t.name) + ' <small>' + esc(t.sub) + '</small></label>').join('') + '</fieldset>') +
      f('Start date', '<input type="date" id="r34pStart" value="' + esc(start) + '">') +
      f('Finish the modules by', '<input type="date" id="r34pDue" value="' + esc(due) + '">') +
      '<fieldset class="r34-fs px-wide"><legend>Acquisitions course modules to finish</legend><div class="r34-mods">' +
        (o.mods || []).map(m => '<label class="p20-chk"><input type="checkbox" name="r34pMod" value="' + esc(m.id) + '"' + (picked.has(m.id) ? ' checked' : '') + '> ' + esc(m.number + '. ' + (m.title || m.id)) + '</label>').join('') + '</div></fieldset>' +
      '<fieldset class="r34-fs px-wide"><legend>First shift <small>(your time, ' + esc(zoneName()) + ')</small></legend><div class="r34-row3">' +
        f('Day', '<input type="date" id="r34pDay" value="' + esc(shDate) + '">') + f('Starts', '<input type="time" id="r34pFrom" value="' + esc(sh ? hm(sh.starts_at) : '') + '">') + f('Ends', '<input type="time" id="r34pTo" value="' + esc(sh ? hm(sh.ends_at) : '') + '">') +
      '</div><p class="p-hint">Leave the day empty to add the first shift later in Schedule and time off.</p></fieldset>' +
      f('Note for them (they see it on their plan)', '<textarea id="r34pNote" rows="2" maxlength="1000">' + esc(pl.note || '') + '</textarea>', 'px-wide') +
      '<div class="wk-row px-wide">' + (o.member ? '<button class="p-btn" type="submit" data-via="none">Save the plan</button>' :
        '<button class="p-btn" type="submit" data-via="email">Send email invite and hire</button><button class="p-btn is-ghost" type="submit" data-via="whatsapp">Get WhatsApp link and hire</button>') +
        '<button class="p-btn is-ghost" type="button" data-r34px>Cancel</button></div>' +
      (o.member ? '' : '<p class="p-hint px-wide">The invite goes out only when you press one of these buttons. The email button sends their sign-in link from your connected Gmail; the WhatsApp button only makes a link for you to send.</p>') +
      '<p class="p-hint px-wide" id="r34pMsg" role="status"></p><div id="r34pLink" class="px-wide" hidden></div></form>';
  }
  let planVia = 'email';
  document.addEventListener('click', e => { const b = e.target.closest('#r34Plan [type=submit]'); if (b) planVia = b.dataset.via; }, true);
  // returns { user_id, link } or throws a message
  async function savePlan(form){
    const app = +form.dataset.app || null;
    let uid = form.dataset.user || '', link = null, name = '';
    if (!uid) {
      name = val('r34pName').replace(/\s+/g, ' '); const email = val('r34pEmail').toLowerCase(), co = +val('r34pCo') || null;
      if (name.length < 2) throw 'Enter their full name.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw 'Enter a valid email.';
      const tplId = (form.querySelector('input[name=r34pTpl]:checked') || {}).value || '';
      say('r34pMsg', 'Making their account…');
      const r = await T().callAccess({ action:'invite', name, email, company_id:co, via:planVia === 'email' ? 'email' : 'whatsapp' });
      if (r.error) throw r.error;
      uid = r.user_id; link = r.link || null;
      const PA = window.PeopleAccess, tpl = tplId && PA ? PA.tplOf(tplId) : null;
      if (tpl) {
        const d = { role:'agent', ticks:new Set(), tap:false, mfa:false, rem:true }; PA.applyTpl(d, tpl);
        const plan = PA.planOf({ access:[], not_given:[] }, d);
        const x = await safe(db().from('members').update({ role:plan.role, access:plan.access, not_given:plan.not_given, deals_mfa:d.mfa, tap_counter:d.tap, deals_remember:d.rem }).eq('user_id', uid));
        if (x.error) toast(first(name) + ' starts as an Agent. Set ' + tpl.name + ' in Invite and access.');
      }
      form.dataset.user = uid;   // pressing again only saves the plan
      form.dataset.tpl = tplId;
    }
    const dayV = val('r34pDay'), from = val('r34pFrom'), to = val('r34pTo');
    let s = null, en = null;
    if (dayV) {
      if (!from || !to) throw 'Add the first shift’s start and end, or leave the day empty.';
      s = zonedToUtc(dayV, from, zone()); en = zonedToUtc(dayV, to, zone());
      if (en <= s) en = new Date(en.getTime() + 864e5);   // a night shift ends the next day
    }
    say('r34pMsg', 'Saving the plan…');
    const x = await safe(db().rpc('hire_finish', { p_user:uid, p_app:app, p_template:form.dataset.tpl || null, p_start:val('r34pStart') || null,
      p_modules:[...form.querySelectorAll('input[name=r34pMod]:checked')].map(c => c.value), p_due:val('r34pDue') || null,
      p_shift_start:s ? s.toISOString() : null, p_shift_end:en ? en.toISOString() : null, p_company:+val('r34pCo') || null, p_note:val('r34pNote') || null, p_bell:true }));
    if (x.error) throw errText(x, 'The account is made, but the plan didn’t save. Press the button again.');
    return { user_id:uid, link, name };
  }
  function linkBox(name, link){
    const msg = 'Hi ' + first(name) + ', welcome to the team. Here is your link for the portal: ' + link + '\n\nOpen it, choose a password, then add the app to your home screen. The link works once.';
    return '<p class="p-hint">Send this to ' + esc(first(name)) + '. It works once and expires in 24 hours. Nothing has been sent yet.</p>' +
      '<label class="p-vh" for="r34pLinkV">Sign-in link</label><input class="r34-in" id="r34pLinkV" readonly value="' + esc(link) + '">' +
      '<div class="wk-row"><button type="button" class="p-btn is-ghost" data-r34copylink>Copy link</button><a class="p-btn is-ghost" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(msg) + '">Open WhatsApp with this message</a></div>';
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-r34copylink]'); if (!b) return;
    try { await navigator.clipboard.writeText($('r34pLinkV').value); toast('Link copied'); } catch(er) { $('r34pLinkV').select(); }
  });

  // ======================================================================
  // R2 + R3  Applicant board
  // ======================================================================
  V.hiring = { title:'Applicant board', sec:'owner', app:'people', async open(el, ok){
    const body = PX.page(el, 'People', 'Applicant board', 'Everyone who applied on the Join page, by stage. Drag a card left or right (or use the arrows); drag the board or swipe to scroll. Open a card to play the voice test, add notes or hire.');
    const S = { open:null, job:'all', q:'', hire:null };
    const hp = hashParts();
    if (hp[1] === 'job' && hp[2]) S.job = hp[2]; else if (+hp[1]) S.open = +hp[1];
    let A = [], P = [], M = [], audio = {};
    async function load(){
      const [a, p, m] = await Promise.all([safe(db().from('job_applications').select('*').order('created_at', { ascending:false }).limit(1000)),
        safe(db().from('job_posts').select('id,title,slug,open').order('sort')), safe(db().from('members').select('user_id,name,email,active'))]);
      if (!ok()) return;
      if (a.error) { body.innerHTML = failed(a.error); return; }
      A = a.data || []; P = p.data || []; M = m.data || []; draw();
    }
    const postOf = a => P.find(p => p.id === a.post_id);
    const memberOf = a => a.hired_user ? M.find(m => m.user_id === a.hired_user) : M.find(m => m.email && a.email && m.email.toLowerCase() === a.email.toLowerCase());
    const shown = () => A.filter(a => (S.job === 'all' || (S.job === 'none' ? !a.post_id : String(a.post_id) === S.job)) && (!S.q || [a.name, a.email, a.phone, a.country].join(' ').toLowerCase().includes(S.q)));
    function cardHtml(a){
      const i = STAGES.findIndex(s => s[0] === a.stage), p = postOf(a);
      return '<article class="p20-lead' + (S.open === a.id ? ' on' : '') + '" draggable="true" data-r34app="' + a.id + '" tabindex="0" aria-label="' + esc(a.name + ', ' + STAGE[a.stage]) + '">' +
        '<b>' + esc(a.name) + '</b>' +
        '<small>' + esc([a.country, a.english && a.english + ' English'].filter(Boolean).join(' · ')) + '</small>' +
        (p && S.job === 'all' ? '<small>' + esc(p.title) + '</small>' : '') +
        '<small>' + (a.voice_path ? '<span class="r34-voice">Voice test ' + esc(fmtSecs(a.voice_seconds)) + '</span> · ' : a.sample_link ? 'Voice link · ' : '') + 'Applied ' + esc(fmtDay(a.created_at, { month:'short', day:'numeric' })) + '</small>' +
        '<span class="p20-move">' + (i > 0 ? '<button type="button" class="p20-arrow" data-r34mv="' + a.id + '" data-to="' + STAGES[i - 1][0] + '" aria-label="Move to ' + esc(STAGES[i - 1][1]) + '">‹</button>' : '<span></span>') +
        (i < STAGES.length - 1 ? '<button type="button" class="p20-arrow" data-r34mv="' + a.id + '" data-to="' + STAGES[i + 1][0] + '" aria-label="Move to ' + esc(STAGES[i + 1][1]) + '">›</button>' : '') + '</span></article>';
    }
    function panel(a){
      const p = postOf(a), m = memberOf(a), sc = a.scores || {}, scN = Object.keys(sc).filter(k => typeof sc[k] === 'number');
      const tot = scN.reduce((t, k) => t + sc[k], 0);
      const wa = String(a.phone || '').replace(/[^\d]/g, '');
      return '<section class="p-card r34-panel" id="r34Panel"><div class="p-card-head"><h2>' + esc(a.name) + '</h2><span>' + pill(STAGE[a.stage], a.stage === 'hired' ? 'ok' : a.stage === 'rejected' ? 'no' : 'plain') + ' <button type="button" class="p-btn is-ghost" data-r34close>Close</button></span></div>' +
        '<p class="p-hint">' + esc([p ? p.title : 'No job picked', 'applied ' + when(a.created_at), a.stage_at && a.stage !== 'applied' ? STAGE[a.stage] + ' since ' + fmtDay(a.stage_at, { month:'short', day:'numeric' }) : ''].filter(Boolean).join(' · ')) + '</p>' +
        '<div class="r34-two"><div>' +
          '<h3 class="r20-h">Voice test</h3>' + (a.voice_path ? '<div class="r34-audio" data-r34audio="' + a.id + '">' + (audio[a.id] ? '<audio controls preload="metadata" src="' + esc(audio[a.id]) + '"></audio>' : '<button type="button" class="p-btn" data-r34play="' + a.id + '">Play the voice test (' + esc(fmtSecs(a.voice_seconds) || 'recorded') + ')</button>') + '</div>' +
              (p && p.id ? '<details class="r34-script"><summary>The text they read</summary><p data-r34script="' + p.id + '"></p></details>' : '')
            : a.sample_link ? '<p><a href="' + esc(a.sample_link) + '" target="_blank" rel="noopener noreferrer">Open their voice note link</a></p>' : empty('No voice test.')) +
          '<h3 class="r20-h">About them</h3><dl class="p20-dl">' + [['Email', a.email], ['Phone / WhatsApp', a.phone], ['Country', [a.city, a.country].filter(Boolean).join(', ')], ['English', a.english], ['Hours a week', a.hours], ['Can start', a.start_when], ['Experience', a.experience], ['Why this job', a.why], ['Referred by', a.referred_by]]
            .filter(x => x[1]).map(([k, v]) => '<dt>' + esc(k) + '</dt><dd class="px-pre">' + esc(v) + '</dd>').join('') + '</dl>' +
        '</div><div>' +
          '<form class="px-form" id="r34AForm" data-id="' + a.id + '" novalidate>' +
            f('Stage', '<select id="r34aStage">' + STAGES.map(([k, v]) => opt(k, v, k === a.stage)).join('') + '</select>') +
            f('Your note (only you)', '<textarea id="r34aNote" rows="3" maxlength="500">' + esc(a.note || '') + '</textarea>', 'px-wide') +
            (a.stage === 'rejected' ? f('Why not (only you)', '<input type="text" id="r34aWhy" maxlength="300" value="' + esc(a.reject_reason || '') + '">', 'px-wide') : '') +
            '<div class="wk-row px-wide"><button class="p-btn is-ghost" type="submit">Save</button><span class="p-hint" id="r34aMsg" role="status"></span></div></form>' +
          (scN.length ? '<p class="p-hint">Interview scorecard: <b>' + tot + ' of ' + scN.length * 5 + '</b>' + (a.interviewed_at ? ' · ' + esc(fmtDay(a.interviewed_at, { month:'short', day:'numeric' })) : '') + '</p>' : '') +
          '<div class="px-tools">' + (m ? '<a class="p-btn is-ghost" href="#people/' + esc(m.user_id) + '">In Invite and access' + (m.active ? '' : ' (access off)') + '</a><a class="p-btn is-ghost" href="#onboarding">Onboarding</a>' : '') +
            (a.stage !== 'hired' || !m ? '<button type="button" class="p-btn" data-r34hire="' + a.id + '">' + (m ? 'Make their onboarding plan' : 'Hire') + '</button>' : '') +
            '<a class="p-btn is-ghost" href="#applications">Interview scorecard</a>' +
            (a.email ? '<button type="button" class="p-btn is-ghost" data-r34copy="' + esc(a.email) + '">Copy email</button>' : '') +
            (wa.length >= 8 ? '<a class="p-btn is-ghost" href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">Open WhatsApp chat</a>' : '') +
            '<button type="button" class="p-btn is-ghost r34-no" data-r34del="' + a.id + '">Delete applicant</button></div>' +
          '<p class="p-hint">Nothing here messages the applicant. Copy and WhatsApp only open things for you.</p>' +
        '</div></div>' +
        (S.hire === a.id ? '<h3 class="r20-h" id="r34HireH">' + (m ? 'Onboarding plan for ' + esc(a.name) : 'Hire ' + esc(a.name)) + '</h3><div id="r34HireBox"><p class="p-loading">Loading…</p></div>' : '') +
        '</section>';
    }
    function tiles(){
      const wk = Date.now() - 7 * 864e5, q = Date.now() - 90 * 864e5, list = shown();
      const t = (v, l, sub) => '<div class="px-tile"><b>' + esc(v) + '</b><span>' + esc(l) + '</span>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
      return '<div class="px-tiles">' + t(list.filter(a => new Date(a.created_at) >= wk).length, 'applied this week') +
        t(list.filter(a => a.stage === 'applied').length, 'not looked at yet', plural(list.filter(a => a.stage === 'applied' && a.voice_path).length, 'with a voice test')) +
        t(list.filter(a => ['screened', 'voice_test', 'roleplay', 'offer'].includes(a.stage)).length, 'in progress') +
        t(list.filter(a => a.stage === 'hired' && new Date(a.stage_at) >= q).length, 'hired in 90 days') + '</div>';
    }
    function draw(){
      const sel = S.open && A.find(a => a.id === S.open), list = shown();
      body.innerHTML = tiles() +
        '<div class="px-tools r34-tools"><label class="sc-f">Job<select id="r34Job">' + opt('all', 'All jobs', S.job === 'all') + P.map(p => opt(p.id, p.title + (p.open ? '' : ' (closed)'), String(p.id) === S.job)).join('') + opt('none', 'No job picked', S.job === 'none') + '</select></label>' +
          '<label class="sc-f">Find<input type="search" id="r34Q" value="' + esc(S.q) + '" placeholder="Name, email or phone"></label>' +
          '<a class="p-btn is-ghost" href="#jobs">Job posts</a><a class="p-btn is-ghost" href="#applications">List view</a><span class="p-hint" id="r34bMsg" role="status"></span></div>' +
        (sel ? panel(sel) : '') +
        '<div class="p20-board r34-board" id="r34Board">' + STAGES.map(([k, v]) => { const c = list.filter(a => a.stage === k);
          return '<section class="p20-col" data-r34col="' + k + '"><header><b>' + esc(v) + '</b><span>' + c.length + '</span></header><div class="p20-cards">' +
            (c.length ? c.map(cardHtml).join('') : '<p class="p20-drop">' + (k === 'hired' ? 'Drop here to hire' : 'Drop a card here') + '</p>') + '</div></section>'; }).join('') + '</div>' +
        (A.length ? '' : '<p class="p-hint">No applications yet. Share amrabdelgawad.site/join, or open Job posts to add jobs.</p>');
      wireBoard();
      if (sel && S.hire === sel.id) hireBox(sel);
      if (sel) fillScript(sel);
    }
    async function fillScript(a){
      const box = body.querySelector('[data-r34script]'); if (!box) return;
      const r = await safe(db().from('job_posts').select('voice_script').eq('id', a.post_id).maybeSingle());
      if (box.isConnected) box.textContent = (r.data && r.data.voice_script) || 'No text saved on this job.';
    }
    async function hireBox(a){
      const box = $('r34HireBox'); if (!box) return;
      const m = memberOf(a);
      const [mods, plan] = await Promise.all([modules(), m ? safe(db().rpc('onboarding_plan', { p_user:m.user_id })) : Promise.resolve({ data:null })]);
      if (!box.isConnected) return;
      box.innerHTML = planForm({ app:a.id, name:a.name, email:a.email, member:m || null, plan:plan.data && plan.data.plan, shift:plan.data && plan.data.shift, mods, companies:T().companies || [] });
      const n = $('r34pName') || $('r34pStart'); if (n) n.focus();
    }
    async function move(id, to){
      const a = A.find(x => x.id === id); if (!a || a.stage === to) return;
      if (to === 'hired' && !memberOf(a)) { S.open = id; S.hire = id; draw(); const h = $('r34HireH'); if (h) h.scrollIntoView({ behavior:'smooth', block:'start' }); say('r34bMsg', 'Fill in the hire form to move ' + first(a.name) + ' to Hired.'); return; }
      const prev = a.stage; a.stage = to; a.stage_at = new Date().toISOString(); draw();
      const x = await safe(db().from('job_applications').update({ stage:to }).eq('id', id));
      if (x.error) { a.stage = prev; draw(); say('r34bMsg', errText(x, 'Couldn’t move it. Try again.')); return; }
      if (to === 'rejected') { S.open = id; draw(); const w = $('r34aWhy'); if (w) w.focus(); say('r34bMsg', 'Moved to Rejected. Nothing was sent to them.'); }
    }
    function wireBoard(){
      const b = $('r34Board'); if (!b) return;
      let dragId = null;
      b.addEventListener('dragstart', e => { const c = e.target.closest('[data-r34app]'); if (!c) return; dragId = +c.dataset.r34app; c.classList.add('drag'); try { e.dataTransfer.setData('text/plain', String(dragId)); e.dataTransfer.effectAllowed = 'move'; } catch(er) {} });
      b.addEventListener('dragend', e => { const c = e.target.closest('[data-r34app]'); if (c) c.classList.remove('drag'); b.querySelectorAll('.p20-col.over').forEach(x => x.classList.remove('over')); });
      b.addEventListener('dragover', e => { const col = e.target.closest('[data-r34col]'); if (!col || dragId == null) return; e.preventDefault(); b.querySelectorAll('.p20-col.over').forEach(x => x !== col && x.classList.remove('over')); col.classList.add('over');
        const r = b.getBoundingClientRect(); if (e.clientX > r.right - 60) b.scrollLeft += 18; else if (e.clientX < r.left + 60) b.scrollLeft -= 18; });
      b.addEventListener('drop', e => { const col = e.target.closest('[data-r34col]'); if (!col || dragId == null) return; e.preventDefault(); const id = dragId; dragId = null; move(id, col.dataset.r34col); });
      b.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.target.closest('[data-r34app], button, a, input')) return; down = { b, x:e.clientX, s:b.scrollLeft }; b.classList.add('grab'); });
    }
    let down = null;
    const onMove = e => { if (!ok()) return off(); if (down) down.b.scrollLeft = down.s - (e.clientX - down.x); };
    const onUp = () => { if (down) down.b.classList.remove('grab'); down = null; if (!ok()) off(); };
    const off = () => { removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); };
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);
    await load();
    if (S.open) { const pnl = $('r34Panel'); if (pnl) pnl.scrollIntoView({ block:'start' }); }
    body.addEventListener('click', async e => {
      const mv = e.target.closest('[data-r34mv]'); if (mv) { e.stopPropagation(); move(+mv.dataset.r34mv, mv.dataset.to); return; }
      if (e.target.closest('[data-r34close]')) { S.open = null; S.hire = null; history.replaceState(null, '', '#hiring'); draw(); return; }
      if (e.target.closest('[data-r34px]')) { S.hire = null; draw(); return; }
      const pl = e.target.closest('[data-r34play]');
      if (pl) {
        const a = A.find(x => x.id === +pl.dataset.r34play); if (!a) return;
        pl.disabled = true; pl.textContent = 'Loading…';
        const s = await db().storage.from('voice-tests').createSignedUrl(a.voice_path, 3600);
        if (s.error || !s.data) { pl.disabled = false; pl.textContent = 'Couldn’t load it. Try again'; return; }
        audio[a.id] = s.data.signedUrl;
        const box = pl.closest('[data-r34audio]'); box.innerHTML = '<audio controls preload="auto" src="' + esc(s.data.signedUrl) + '"></audio>';
        const au = box.querySelector('audio'); au.play().catch(() => {});
        return;
      }
      const h = e.target.closest('[data-r34hire]'); if (h) { S.open = +h.dataset.r34hire; S.hire = S.open; draw(); const hh = $('r34HireH'); if (hh) hh.scrollIntoView({ behavior:'smooth', block:'start' }); return; }
      const cp = e.target.closest('[data-r34copy]'); if (cp) { try { await navigator.clipboard.writeText(cp.dataset.r34copy); say('r34aMsg', 'Email copied.'); } catch(er) { say('r34aMsg', cp.dataset.r34copy); } return; }
      const dl = e.target.closest('[data-r34del]');
      if (dl) {
        if (!sure(dl, 'Sure? This removes the voice test too')) return;
        const a = A.find(x => x.id === +dl.dataset.r34del); if (!a) return;
        dl.disabled = true;
        if (a.voice_path) await db().storage.from('voice-tests').remove([a.voice_path]);
        const x = await safe(db().from('job_applications').delete().eq('id', a.id));
        if (x.error) { dl.disabled = false; say('r34aMsg', errText(x, 'Couldn’t delete it.')); return; }
        S.open = null; S.hire = null; history.replaceState(null, '', '#hiring'); await load(); say('r34bMsg', 'Applicant deleted.'); return;
      }
      const c = e.target.closest('[data-r34app]');
      if (c && !e.target.closest('button')) { S.open = +c.dataset.r34app; S.hire = null; history.replaceState(null, '', '#hiring/' + S.open); draw(); window.scrollTo({ top:0, behavior:'smooth' }); }
    });
    body.addEventListener('keydown', e => { const c = e.target.closest && e.target.closest('[data-r34app]'); if (c && e.key === 'Enter') c.click(); });
    body.addEventListener('change', e => { if (e.target.id === 'r34Job') { S.job = e.target.value; history.replaceState(null, '', S.job === 'all' ? '#hiring' : '#hiring/job/' + S.job); draw(); } });
    let qt = 0;
    body.addEventListener('input', e => { if (e.target.id !== 'r34Q') return; clearTimeout(qt); const v = e.target.value; qt = setTimeout(() => { S.q = v.trim().toLowerCase(); draw(); const q = $('r34Q'); if (q) { q.focus(); q.setSelectionRange(v.length, v.length); } }, 250); });
    body.addEventListener('submit', async e => {
      if (e.target.id === 'r34AForm') {
        e.preventDefault();
        const a = A.find(x => x.id === +e.target.dataset.id); if (!a) return;
        const stage = val('r34aStage');
        if (stage === 'hired' && a.stage !== 'hired' && !memberOf(a)) { S.hire = a.id; draw(); say('r34bMsg', 'Fill in the hire form to move ' + first(a.name) + ' to Hired.'); return; }
        const row = { note:val('r34aNote') || null, stage };
        if ($('r34aWhy')) row.reject_reason = val('r34aWhy') || null;
        const x = await safe(db().from('job_applications').update(row).eq('id', a.id));
        if (x.error) { say('r34aMsg', errText(x, 'Couldn’t save. Try again.')); return; }
        const moved = a.stage !== stage; Object.assign(a, row); if (moved) a.stage_at = new Date().toISOString();
        if (moved) draw();
        say('r34aMsg', 'Saved.'); return;
      }
      if (e.target.id === 'r34Plan') {
        e.preventDefault();
        const form = e.target, btns = form.querySelectorAll('button'); btns.forEach(x => x.disabled = true);
        try {
          const r = await savePlan(form);
          const a = A.find(x => x.id === +form.dataset.app);
          await load();
          S.open = a ? a.id : null; S.hire = null; draw();
          const pnl = $('r34Panel');
          if (pnl) pnl.insertAdjacentHTML('afterbegin', '<div class="p-card r34-done"><p><b>' + esc(r.name || (a && a.name) || 'They') + ' is hired.</b> Their account is in Invite and access and their onboarding plan is saved. ' +
            '<a href="#onboarding">See Onboarding</a> · <a href="#people/' + esc(r.user_id) + '">Access and role</a></p>' + (r.link ? linkBox(r.name || (a && a.name), r.link) : planVia === 'email' && r.name ? '<p class="p-hint">The invite email went to their address.</p>' : '') + '</div>');
        } catch(err) {
          btns.forEach(x => x.disabled = false); say('r34pMsg', typeof err === 'string' ? err : 'Something went wrong. Try again.');
        }
      }
    });
  }};

  // ======================================================================
  // R8  Onboarding page: each person's plan; the new person's own plan on their home page
  // ======================================================================
  const O = window.Onboarding;
  if (O && !O.r34) {
    const open0 = O.open, card0 = O.card;
    O.r34 = true;
    O.open = async function(el, isCurrent){
      await open0.call(this, el, isCurrent);
      if (!isCurrent()) return;
      const host = $('obBody'); if (!host) return;
      const wrap = document.createElement('div'); wrap.id = 'r34Plans'; host.insertAdjacentElement('afterbegin', wrap);
      await drawPlans(wrap, isCurrent);
    };
    async function drawPlans(wrap, isCurrent, editId){
      wrap.innerHTML = '<p class="p-loading">Loading plans…</p>';
      const me = (T().user || {}).id;
      const ppl = await safe(db().from('members').select('user_id,name,email,active,created_at').eq('active', true).order('name'));
      if (!isCurrent()) return;
      const list = (ppl.data || []).filter(p => p.user_id !== me);
      const plans = await Promise.all(list.map(p => safe(db().rpc('onboarding_plan', { p_user:p.user_id })).then(r => [p.user_id, r.data || {}])));
      if (!isCurrent()) return;
      const by = {}; plans.forEach(([k, v]) => by[k] = v);
      const rows = list.map(p => {
        const d = by[p.user_id] || {}, pl = d.plan, mods = d.modules || [], hb = d.handbook || {}, sh = d.shift || d.next_shift;
        const lessons = mods.reduce((t, m) => t + +m.lessons, 0), done = mods.reduce((t, m) => t + +m.done, 0);
        return tr(['<b>' + esc(p.name) + '</b>' + (pl && pl.start_on ? '<br><small>Starts ' + esc(day(pl.start_on)) + '</small>' : ''),
          pl ? (mods.length ? esc(done + ' of ' + lessons + ' lessons') + '<br><small>' + esc(mods.map(m => m.number).join(', ')) + (pl.modules_due ? ' · by ' + esc(fmtDay(pl.modules_due, { month:'short', day:'numeric' })) : '') + '</small>' : 'None picked') : '<span class="p-hint">No plan</span>',
          hb.required ? esc(hb.signed + ' of ' + hb.required) : '<span class="p-hint">No required pages</span>',
          sh ? esc(when(sh.starts_at)) : '<span class="p-hint">Not scheduled</span>',
          '<button type="button" class="p-btn is-ghost" data-r34plan="' + esc(p.user_id) + '">' + (pl ? 'Change plan' : 'Make a plan') + '</button>']);
      });
      wrap.innerHTML = card('Onboarding plans', 'Course modules, handbook sign-offs and first shift',
        (list.length ? table(['Person', 'Course modules', 'Handbook signed', 'First or next shift', ''], rows) : empty('No one on the team yet. Hire someone from the Applicant board.')) +
        '<p class="p-hint">New hires get a plan from the Applicant board’s Hire form. Required handbook pages are set in the Handbook. <a href="#hiring">Applicant board</a></p>' +
        '<div id="r34PlanEdit"></div>');
      wrap.onclick = async e => {
        const b = e.target.closest('[data-r34plan]');
        if (b) {
          const p = list.find(x => x.user_id === b.dataset.r34plan), d = by[b.dataset.r34plan] || {};
          const box = $('r34PlanEdit'); box.innerHTML = '<p class="p-loading">Loading…</p>';
          const mods = await modules();
          box.innerHTML = card('Plan for ' + p.name, '', planForm({ member:p, plan:d.plan, shift:d.shift, mods, companies:T().companies || [] }));
          box.scrollIntoView({ behavior:'smooth', block:'start' }); return;
        }
        if (e.target.closest('[data-r34px]')) { $('r34PlanEdit').innerHTML = ''; }
      };
      wrap.onsubmit = async e => {
        if (e.target.id !== 'r34Plan') return; e.preventDefault();
        const btns = e.target.querySelectorAll('button'); btns.forEach(x => x.disabled = true);
        try { await savePlan(e.target); await drawPlans(wrap, isCurrent); toast('Plan saved.'); }
        catch(err) { btns.forEach(x => x.disabled = false); say('r34pMsg', typeof err === 'string' ? err : 'Something went wrong. Try again.'); }
      };
    }
    // the person's own home page: their plan under "Your onboarding"
    O.card = async function(dbx, el, isCurrent){
      await card0.call(this, dbx, el, isCurrent);
      if (!el || !isCurrent() || isOwner()) return;
      const r = await safe(dbx.rpc('onboarding_plan'));
      if (!isCurrent() || r.error || !r.data || !r.data.plan) return;
      const d = r.data, pl = d.plan, mods = d.modules || [], hb = d.handbook || {}, sh = d.shift && new Date(d.shift.ends_at) > new Date() ? d.shift : d.next_shift;
      const modsLeft = mods.some(m => +m.done < +m.lessons), signLeft = hb.required && hb.signed < hb.required;
      if (!modsLeft && !signLeft && !sh && !pl.note) return;
      const html = '<section class="p-card r34-mine" aria-labelledby="r34MineH"><div class="p-card-head"><h2 id="r34MineH">Your plan</h2><span>' + (pl.start_on ? 'Start ' + esc(day(pl.start_on)) : '') + '</span></div>' +
        (pl.note ? '<p class="r34-note">' + esc(pl.note) + '</p>' : '') +
        (mods.length ? '<h3 class="r20-h">Course modules' + (pl.modules_due ? ' to finish by ' + esc(fmtDay(pl.modules_due, { month:'short', day:'numeric' })) : '') + '</h3>' +
          mods.map(m => '<a class="p-row r34-mod" href="/course/"><span><b>' + esc('Module ' + m.number + ': ' + (m.title || '')) + '</b><small>' + esc(m.done + ' of ' + m.lessons + ' lessons') + '</small></span>' +
            (+m.done >= +m.lessons ? '<span class="p-pill is-ok">Done</span>' : '<span class="p-pill is-plain">Open</span>') + '</a>').join('') : '') +
        (hb.required ? '<a class="p-row r34-mod" href="#handbook"><span><b>Handbook pages to sign</b><small>' + esc(hb.signed + ' of ' + hb.required + ' signed') + '</small></span>' + (signLeft ? '<span class="p-pill">Sign</span>' : '<span class="p-pill is-ok">Done</span>') + '</a>' : '') +
        (sh ? '<a class="p-row r34-mod" href="#schedule"><span><b>' + (d.shift && sh === d.shift ? 'Your first shift' : 'Your next shift') + '</b><small>' + esc(when(sh.starts_at, { zone:true }) + ' to ' + when(sh.ends_at, { date:false, zone:false })) + '</small></span></a>' : '') +
        '</section>';
      el.insertAdjacentHTML('beforeend', html); el.hidden = false;
    };
  }

  // ======================================================================
  // R9  Handbook sign-off
  // ======================================================================
  const HB = V.handbook;
  if (HB && !HB.r34) {
    const open0 = HB.open;
    V.handbook = Object.assign({}, HB, { r34:true, async open(el, ok){
      await open0.call(this, el, ok);
      if (!ok()) return;
      const owner = isOwner(), host = el.querySelector('.px-body'); if (!host) return;
      const pageId = () => { const a = el.querySelector('.wk-hb-link.on'); return a ? +a.dataset.hb : +(hashParts()[1] || 0); };
      let mine = [], status = [], busy = false;
      async function load(){
        if (owner) { const r = await safe(db().rpc('handbook_signoff_status')); status = r.data || []; }
        else { const r = await safe(db().rpc('my_handbook_signoffs')); mine = r.data || []; }
      }
      const reqOf = id => owner ? (status.find(s => s.page_id === id) || {}).required : mine.some(m => m.page_id === id);
      function marks(){
        el.querySelectorAll('.wk-hb-link[data-hb]').forEach(a => {
          const id = +a.dataset.hb, m = mine.find(x => x.page_id === id), s = status.find(x => x.page_id === id);
          let t = '';
          if (!owner && m) t = m.needs_sign ? 'Sign' : 'Signed';
          if (owner && s && s.required) t = (s.people || []).filter(p => p.signed_at).length + ' of ' + (s.people || []).length + ' signed';
          let tag = a.querySelector('.r34-tag');
          if (!t) { if (tag) tag.remove(); return; }
          if (!tag) { tag = document.createElement('span'); tag.className = 'r34-tag'; a.appendChild(tag); }
          if (tag.textContent !== t) tag.textContent = t;
          const due = !owner && !!m && m.needs_sign; if (tag.classList.contains('is-due') !== due) tag.classList.toggle('is-due', due);
        });
      }
      function banner(){
        let b = $('r34HbTop');
        const due = mine.filter(m => m.needs_sign);
        if (owner || !due.length) { if (b) b.remove(); return; }
        const key = due.map(m => m.page_id).join(',');
        if (b && b.dataset.key === key) return;
        if (!b) { b = document.createElement('div'); b.id = 'r34HbTop'; host.insertAdjacentElement('afterbegin', b); }
        b.className = 'p-card r34-hbtop'; b.dataset.key = key;
        b.innerHTML = '<p><b>' + esc(plural(due.length, 'handbook page needs', 'handbook pages need')) + ' your signature.</b> Read each one, then type your full name at the bottom to sign it.</p><div class="px-tools">' +
          due.map(m => '<a class="p-btn is-ghost" href="#handbook/' + m.page_id + '" data-hb="' + m.page_id + '">' + esc(m.title) + '</a>').join('') + '</div>';
      }
      function memberBox(art, id){
        const m = mine.find(x => x.page_id === id); if (!m) return;
        art.querySelectorAll('#hbRead, .wk-hb-ok').forEach(x => x.hidden = true);
        const name = (T().me && T().me.name) || '';
        art.insertAdjacentHTML('beforeend', '<div class="r34-sign" data-r34sign="' + id + '">' + (m.needs_sign ?
          '<h3 class="r20-h">Sign this page</h3><p class="p-hint">This page needs your signature. Type your full name as it shows in the portal to confirm you read and understood it.</p>' +
          '<div class="wk-row"><label class="sc-f">Your full name<input type="text" class="r34-in" id="r34HbName" maxlength="80" autocomplete="name" placeholder="' + esc(name) + '"></label><button type="button" class="p-btn" id="r34HbSign">Sign this page</button></div><p class="p-hint" id="r34HbMsg" role="status"></p>'
          : '<p>' + pill('Signed', 'ok') + ' <span class="p-hint">' + esc('You signed this page ' + when(m.signed_at) + ' as “' + (m.typed_name || '') + '”.') + '</span></p>') + '</div>');
      }
      function ownerBox(art, id){
        const s = status.find(x => x.page_id === id); if (!s) return;
        const ppl = s.people || [], signed = ppl.filter(p => p.signed_at);
        art.insertAdjacentHTML('beforeend', '<div class="r34-sign" data-r34sign="' + id + '"><h3 class="r20-h">Sign-off</h3>' +
          '<label class="p20-chk"><input type="checkbox" id="r34HbReq"' + (s.required ? ' checked' : '') + '> New hires and the team must sign this page</label>' +
          '<label class="p20-chk"><input type="checkbox" id="r34HbTell"> Also ring their bell in the portal (nothing is emailed)</label>' +
          (s.required ? '<p class="p-hint">' + esc(signed.length + ' of ' + ppl.length + ' signed' + (s.sign_from ? ' since you asked again on ' + when(s.sign_from) : '')) + '</p>' +
            (ppl.length ? '<div class="r34-signed">' + ppl.map(p => '<div class="p-row"><span><b>' + esc(p.name) + '</b>' + (p.signed_at ? '<small>' + esc('Signed ' + when(p.signed_at) + ' as “' + (p.typed || '') + '”' + (p.version && s.updated_at && new Date(p.version) < new Date(s.updated_at) ? ' · on an older version of the page' : '')) + '</small>' : '') + '</span>' +
              (p.signed_at ? pill('Signed', 'ok') : pill('Not yet', 'plain')) + '</div>').join('') + '</div>' : '') +
            '<div class="wk-row"><button type="button" class="p-btn is-ghost" id="r34HbAgain">Ask everyone to sign again</button><a class="p-btn is-ghost" href="#consents">Agreements</a></div>' : '') +
          '<p class="p-hint" id="r34HbMsg" role="status"></p></div>');
      }
      function apply(){
        if (busy) return;
        busy = true; try { apply1(); } finally { busy = false; }
      }
      function apply1(){
        const art = el.querySelector('.wk-hb-page'), id = pageId();
        marks(); banner();
        if (!art || !id || art.querySelector('#hbForm')) return;
        const cur = art.querySelector('[data-r34sign]');
        if (cur && +cur.dataset.r34sign === id) return;
        if (cur) cur.remove();
        if (owner) ownerBox(art, id); else if (reqOf(id)) memberBox(art, id);
      }
      await load(); if (!ok()) return;
      apply();
      const mo = new MutationObserver(() => { if (!document.body.contains(el)) { mo.disconnect(); return; } apply(); });
      mo.observe(host, { childList:true, subtree:true });
      host.addEventListener('click', async e => {
        if (e.target.id === 'r34HbSign') {
          const id = pageId(), nm = val('r34HbName');
          if (nm.length < 2) { say('r34HbMsg', 'Type your full name to sign.'); $('r34HbName').focus(); return; }
          e.target.disabled = true;
          const x = await safe(db().rpc('handbook_sign', { p_page:id, p_name:nm, p_ua:navigator.userAgent.slice(0, 300) }));
          if (x.error) { e.target.disabled = false; say('r34HbMsg', errText(x, 'Couldn’t sign it. Try again.')); return; }
          await load(); const c = el.querySelector('[data-r34sign]'); if (c) c.remove(); apply(); toast('Signed. Thank you.'); return;
        }
        if (e.target.id === 'r34HbAgain') {
          if (!sure(e.target, 'Sure? Everyone signs again')) return;
          const id = pageId(); e.target.disabled = true;
          const x = await safe(db().rpc('handbook_set_required', { p_page:id, p_on:true, p_again:true, p_tell:!!($('r34HbTell') && $('r34HbTell').checked) }));
          if (x.error) { e.target.disabled = false; say('r34HbMsg', errText(x, 'Couldn’t do that. Try again.')); return; }
          await load(); const c = el.querySelector('[data-r34sign]'); if (c) c.remove(); apply(); say('r34HbMsg', 'Done. Everyone needs to sign this page again.');
        }
      });
      host.addEventListener('change', async e => {
        if (e.target.id !== 'r34HbReq') return;
        const id = pageId(), on = e.target.checked; e.target.disabled = true;
        const x = await safe(db().rpc('handbook_set_required', { p_page:id, p_on:on, p_again:false, p_tell:on && !!($('r34HbTell') && $('r34HbTell').checked) }));
        e.target.disabled = false;
        if (x.error) { e.target.checked = !on; say('r34HbMsg', errText(x, 'Couldn’t change it. Try again.')); return; }
        await load(); const c = el.querySelector('[data-r34sign]'); if (c) c.remove(); apply(); say('r34HbMsg', on ? 'This page now needs a sign-off.' : 'This page no longer needs a sign-off. Earlier signatures are kept.');
      });
    } });
  }

  // ======================================================================
  // R11  Offboarding: final pay, saved record, exit notes, sign out everywhere and access off
  // ======================================================================
  const OF = V.offboarding;
  if (OF && !OF.r34) {
    const open0 = OF.open;
    V.offboarding = Object.assign({}, OF, { r34:true, async open(el, ok){
      await open0.call(this, el, ok);
      if (!ok()) return;
      const secs = [...el.querySelectorAll('section[data-off]')]; if (!secs.length) return;
      const ids = secs.map(s => s.dataset.off);
      const [o, sv] = await Promise.all([safe(db().from('offboardings').select('user_id,name,last_day,finished_at,exit_notes,cut_at,cut_sessions,record_path,record_at').in('user_id', ids)),
        safe(db().from('exit_surveys').select('user_id,submitted_at').in('user_id', ids))]);
      if (!ok()) return;
      const rows = {}; (o.data || []).forEach(r => rows[r.user_id] = r);
      const survey = new Set((sv.data || []).filter(s => s.submitted_at).map(s => s.user_id));
      for (const sec of secs) {
        const r = rows[sec.dataset.off]; if (!r) continue;
        const box = document.createElement('div'); box.className = 'r34-off'; box.dataset.r34off = r.user_id;
        sec.appendChild(box); draw(box, r, survey.has(r.user_id));
        if (!r.finished_at || !r.cut_at) pay(box, r.user_id);
      }
      const pb = el.querySelector('.px-body'); if (pb) pb.addEventListener('click', e => click(e, el, ok));
    } });
    function draw(box, r, answered){
      box.innerHTML = '<h3 class="px-h3">Finish</h3>' +
        '<div class="r34-offgrid">' +
          '<div class="r34-offc"><h4>Final pay</h4><div data-r34pay><p class="p-loading">Working it out…</p></div><a class="p-btn is-ghost" href="#payroll">Open Payroll</a></div>' +
          '<div class="r34-offc"><h4>Their record</h4>' + (r.record_path ? '<p class="p-hint">Saved ' + esc(when(r.record_at)) + ' in Files.</p><button type="button" class="p-btn is-ghost" data-r34recopen="' + esc(r.record_path) + '">Open the saved copy</button>' : '<p class="p-hint">Shifts, pay, onboarding, sign-offs, agreements and the list of their documents, saved as one file in Files. Their documents stay in Person files.</p>') +
            '<button type="button" class="p-btn is-ghost" data-r34rec="' + esc(r.user_id) + '">' + (r.record_path ? 'Save a new copy' : 'Save a copy of their record') + '</button></div>' +
          '<div class="r34-offc r34-wide"><h4>Exit notes <small>(only you)</small></h4><textarea class="r34-in" rows="3" maxlength="4000" data-r34notes>' + esc(r.exit_notes || '') + '</textarea><button type="button" class="p-btn is-ghost" data-r34notesave="' + esc(r.user_id) + '">Save notes</button></div>' +
          '<div class="r34-offc r34-wide r34-cut"><h4>Sign-in and access</h4>' + (r.cut_at ?
            '<p>' + pill('Access off', 'no') + ' <span class="p-hint">' + esc('Since ' + when(r.cut_at) + '. Signed out of ' + plural(r.cut_sessions || 0, 'device') + '; every tool switched off; the sign-in is blocked.') + '</span></p>' +
            '<button type="button" class="p-btn is-ghost" data-r34undo="' + esc(r.user_id) + '">Undo: give their access back</button>'
            : (answered ? '' : '<p class="p-hint r34-warn">The exit survey isn’t answered yet. Once access is off they can’t answer it.</p>') +
              '<p class="p-hint">One step: signs them out on every phone and computer, switches off every tool (courses, Deal CRM, call counter, phone alerts) and blocks the sign-in. Their shifts, notes and history stay.</p>' +
              '<button type="button" class="p-btn is-danger" data-r34cut="' + esc(r.user_id) + '" data-name="' + esc(r.name || '') + '">Sign out on every device and turn off access</button>') + '</div>' +
        '</div><p class="p-hint" data-r34offmsg role="status"></p>';
    }
    async function pay(box, uid){
      const x = await safe(db().rpc('offboard_final_pay', { p_user:uid }));
      const t = box.querySelector('[data-r34pay]'); if (!t) return;
      if (x.error || !x.data) { t.innerHTML = '<p class="p-hint">' + esc(errText(x, 'Couldn’t work it out.')) + '</p>'; return; }
      const d = x.data;
      t.innerHTML = '<p class="r34-big">' + esc(usd(d.total)) + '</p><p class="p-hint">' + esc('Owed up to the pay cycle ending ' + fmtDay(d.through, { month:'short', day:'numeric' }) + ': ' +
        plural(+d.shift_count, 'unpaid shift') + ' (' + d.hours + ' h) ' + usd(d.shifts) + (+d.bonuses ? ', bonuses ' + usd(d.bonuses) : '') + (+d.commissions ? ', commissions ' + usd(d.commissions) : '') + (+d.deductions ? ', deductions −' + usd(d.deductions) : '') + '.') + '</p>' +
        '<p class="p-hint">Pay it from Payroll as usual; the money itself moves outside the portal.</p>';
    }
    async function click(e, el, ok){
      const b = e.target.closest('button'); if (!b) return;
      const box = b.closest('[data-r34off]'); if (!box) return;
      const msg = t => { const m = box.querySelector('[data-r34offmsg]'); if (m) m.textContent = t; };
      const uid = box.dataset.r34off;
      if (b.dataset.r34notesave) {
        b.disabled = true; const x = await safe(db().from('offboardings').update({ exit_notes:box.querySelector('[data-r34notes]').value.trim() || null }).eq('user_id', uid)); b.disabled = false;
        msg(x.error ? errText(x, 'Couldn’t save. Try again.') : 'Notes saved.'); return;
      }
      if (b.dataset.r34rec) {
        b.disabled = true; msg('Saving their record…');
        const r = await safe(db().rpc('offboard_record', { p_user:uid }));
        if (r.error || !r.data) { b.disabled = false; msg(errText(r, 'Couldn’t read their record. Try again.')); return; }
        const nm = ((r.data.person || {}).name || 'person').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const path = 'mine/offboarding/' + nm + '-' + isoDay(new Date()) + '-' + Date.now().toString(36) + '.json';
        const up = await db().storage.from('files').upload(path, new Blob([JSON.stringify(r.data, null, 2)], { type:'application/json' }), { contentType:'application/json', upsert:false });
        if (up.error) { b.disabled = false; msg('Couldn’t save the file: ' + (up.error.message || 'try again.')); return; }
        const at = new Date().toISOString();
        await safe(db().from('offboardings').update({ record_path:path, record_at:at }).eq('user_id', uid));
        V.offboarding.open(el, ok); toast('Their record is saved in Files.'); return;
      }
      if (b.dataset.r34recopen) {
        const s = await db().storage.from('files').createSignedUrl(b.dataset.r34recopen, 300);
        if (s.data) window.open(s.data.signedUrl, '_blank', 'noopener'); else msg('Couldn’t open it. It may have been deleted in Files.');
        return;
      }
      if (b.dataset.r34cut) {
        const name = b.dataset.name || 'them';
        const yes = await ask({ title:'Sign ' + first(name) + ' out everywhere and turn off access?', msg:'Every phone and computer they use is signed out, every tool is switched off and they can’t sign in again. Their shifts and history stay. You can undo this here.', ok:'Turn off access', cancel:'Not now', danger:true });
        if (!yes) return;
        b.disabled = true; msg('Signing them out…');
        const x = await safe(db().rpc('offboard_cut', { p_user:uid }));
        if (x.error) { b.disabled = false; msg(errText(x, 'Couldn’t do it. Try again.')); return; }
        const r = await T().callAccess({ action:'remove', user_id:uid });
        if (r && r.error) { b.disabled = false; msg('Signed out of ' + plural(x.data || 0, 'device') + ' and tools off, but blocking the sign-in failed: ' + r.error + ' Press again.'); return; }
        V.offboarding.open(el, ok); toast(first(name) + ' is signed out everywhere and their access is off.'); return;
      }
      if (b.dataset.r34undo) {
        if (!sure(b, 'Sure? Give access back')) return;
        b.disabled = true;
        const x = await safe(db().rpc('offboard_restore', { p_user:uid }));
        if (x.error) { b.disabled = false; msg(errText(x, 'Couldn’t undo it. Try again.')); return; }
        const r = await T().callAccess({ action:'restore', user_id:uid });
        if (r && r.error) { b.disabled = false; msg('Tools are back, but the sign-in is still blocked: ' + r.error + ' Turn it back on in Invite and access.'); return; }
        V.offboarding.open(el, ok); toast('Access is back as it was.');
      }
    }
  }
})();
