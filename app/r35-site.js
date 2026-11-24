// Round 35 of the Portal Master Feature Plan (Nov 24 2026): public site.
//   #inbox      S9  Site messages, Amr only: what people send through the contact form on the main page and Hire a Team
//                   (/contact.js). New first. Mark read, Replied, Archive, Delete (with Undo). Reply opens your own email
//                   app with their address; nothing is sent from the portal and nobody gets an automatic reply.
//   #inbox/<id>     the bell link for one message: opens here on it and marks it read.
//   #signups    S3  Sign-up requests, Amr only: course access requests from /signup/. Approve fills the invite form in
//                   Invite and access as a Course student with only the courses they asked for; the request is marked
//                   approved once the invite goes out (people.js prefill). Decline only marks it; no email is sent.
//   Waiting     the command center's "Waiting for you" gets new messages and new requests (R35Site.waits).
//   Search      messages and requests are in Amr's search (R35Site.search, used by team-plus.js).
// Database (talents-database migration round35_public_site): contact_messages, signup_requests, contact_submit(),
// contact_inbox(), contact_set(), signup_request_submit(), signup_requests_admin(), signup_request_set().
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, esc, safe, card, empty, failed, isOwner } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const when = at => window.PortalUI ? window.PortalUI.when(at, { zone:false }) : new Date(at).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true });
  const para = s => esc(s).replace(/\n/g, '<br>');
  const toast = t => { if (T().toast) T().toast(t); };
  const COURSE = { course:'Acquisitions', mkt:'Marketing', psy:'Psychology' };
  const STATUS = { new:['New', ''], read:['Read', 'plain'], replied:['Replied', 'ok'], archived:['Archived', 'no'] };
  const seg = (list, cur, n) => '<div class="p-seg r35-seg" role="group" aria-label="Show">' + list.map(([k, l]) =>
    '<button type="button" class="p-seg-b" data-f="' + k + '" aria-pressed="' + (cur === k) + '">' + l + ' <b>' + n[k] + '</b></button>').join('') + '</div>';

  // ---------- Site messages ----------
  let msgs = [], mf = 'open';
  V.inbox = { title:'Site messages', sec:'owner', async open(el, ok){
    const body = PX.page(el, 'Work', 'Site messages', 'Messages from the contact form on your site. Only you see them, and nobody gets an automatic reply. Press Reply to answer from your own email.');
    const r = await safe(db().rpc('contact_inbox'));
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    msgs = r.data || [];
    const focus = +(location.hash.split('/')[1] || 0), m = focus && msgs.find(x => x.id === focus);
    if (m) { mf = m.status === 'archived' ? 'archived' : 'open'; if (m.status === 'new') setMsg(m, 'read', true); }
    drawMsgs(body, focus);
    body.onclick = e => clickMsg(e, body);
  }};
  function drawMsgs(body, focus){
    const n = { open:msgs.filter(m => m.status !== 'archived').length, new:msgs.filter(m => m.status === 'new').length, archived:msgs.filter(m => m.status === 'archived').length, all:msgs.length };
    const list = msgs.filter(m => mf === 'all' || (mf === 'archived' ? m.status === 'archived' : mf === 'new' ? m.status === 'new' : m.status !== 'archived'));
    body.innerHTML = seg([['open', 'Inbox'], ['new', 'New'], ['archived', 'Archived'], ['all', 'All']], mf, n) +
      (list.length ? '<div class="r35-list">' + list.map(m => msgItem(m, m.id === focus)).join('') + '</div>'
        : card('Nothing here', '', empty(mf === 'archived' ? 'No archived messages.' : 'No messages yet. They show here when someone uses the contact form.')));
    const f = focus && body.querySelector('[data-m="' + focus + '"]'); if (f) f.scrollIntoView({ block:'center' });
  }
  function msgItem(m, hot){
    const st = STATUS[m.status] || STATUS.new;
    const subject = 'Re: your message on amrabdelgawad.site';
    return '<section class="p-card r35-item' + (hot ? ' is-hot' : '') + (m.status === 'new' ? ' is-new' : '') + '" data-m="' + m.id + '">' +
      '<div class="r35-top"><b>' + esc(m.name) + '</b>' + PX.pill(st[0], st[1]) + (m.topic ? PX.pill(m.topic, 'plain') : '') + '<span class="r35-when">' + esc(when(m.created_at)) + '</span></div>' +
      '<p class="r35-meta"><a href="mailto:' + esc(m.email) + '">' + esc(m.email) + '</a>' + (m.phone ? ' · <a href="tel:' + esc(m.phone.replace(/[^\d+]/g, '')) + '">' + esc(m.phone) + '</a>' : '') +
        (m.page ? ' · sent from ' + esc(m.page === '/' ? 'the main page' : m.page.replace(/\/$/, '').replace(/^\//, '/')) : '') + '</p>' +
      '<p class="r35-body">' + para(m.message) + '</p>' +
      '<div class="r35-acts"><a class="p-btn" data-reply="' + m.id + '" href="mailto:' + esc(m.email) + '?subject=' + encodeURIComponent(subject) + '">Reply</a>' +
        (m.status !== 'replied' ? '<button type="button" class="p-btn is-ghost" data-st="replied" data-id="' + m.id + '">Mark replied</button>' : '') +
        (m.status === 'new' ? '<button type="button" class="p-btn is-ghost" data-st="read" data-id="' + m.id + '">Mark read</button>' : '<button type="button" class="p-btn is-ghost" data-st="new" data-id="' + m.id + '">Mark new</button>') +
        (m.status !== 'archived' ? '<button type="button" class="p-btn is-ghost" data-st="archived" data-id="' + m.id + '">Archive</button>' : '<button type="button" class="p-btn is-ghost" data-st="read" data-id="' + m.id + '">Back to inbox</button>') +
        '<button type="button" class="p-btn is-ghost r35-no" data-del="' + m.id + '">Delete</button></div></section>';
  }
  async function setMsg(m, st, quiet){
    const r = await safe(db().rpc('contact_set', { p_id:m.id, p_status:st }));
    if (r.error) { if (!quiet) toast('Couldn’t save that. Try again.'); return false; }
    m.status = st; return true;
  }
  async function clickMsg(e, body){
    const b = e.target.closest('[data-f],[data-st],[data-del]'); if (!b) return;
    if (b.dataset.f) { mf = b.dataset.f; return drawMsgs(body); }
    const id = +(b.dataset.id || b.dataset.del), m = msgs.find(x => x.id === id); if (!m) return;
    if (b.dataset.st) {
      b.disabled = true;
      if (await setMsg(m, b.dataset.st)) { drawMsgs(body); toast({ replied:'Marked replied.', read:'Marked read.', new:'Marked new.', archived:'Archived.' }[b.dataset.st]); }
      else b.disabled = false;
    } else if (b.dataset.del) {
      const keep = msgs.slice();
      const commit = () => safe(db().rpc('contact_set', { p_id:id, p_status:'remove' })).then(r => { if (r.error) { msgs = keep; drawMsgs(body); toast('Couldn’t delete it. It was put back.'); } });
      if (window.PortalUI && window.PortalUI.undo) window.PortalUI.undo({ text:'Message deleted.', hide:() => { msgs = msgs.filter(x => x.id !== id); drawMsgs(body); }, restore:() => { msgs = keep; drawMsgs(body); }, commit });
      else { msgs = msgs.filter(x => x.id !== id); drawMsgs(body); commit(); }
    }
  }

  // ---------- Sign-up requests ----------
  let reqs = [], rf = 'new';
  V.signups = { title:'Sign-up requests', sec:'owner', async open(el, ok){
    const body = PX.page(el, 'People', 'Sign-up requests', 'People asking for course access on amrabdelgawad.site/signup/. Approve fills the invite form with the courses they asked for; nothing is sent until you press Send. Decline sends nothing.');
    const r = await safe(db().rpc('signup_requests_admin'));
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    reqs = r.data || [];
    drawReqs(body);
    body.onclick = e => clickReq(e, body);
  }};
  function drawReqs(body){
    const n = { new:reqs.filter(q => q.status === 'new').length, approved:reqs.filter(q => q.status === 'approved').length, declined:reqs.filter(q => q.status === 'declined').length, all:reqs.length };
    const list = reqs.filter(q => rf === 'all' || q.status === rf);
    body.innerHTML = seg([['new', 'Waiting'], ['approved', 'Approved'], ['declined', 'Declined'], ['all', 'All']], rf, n) +
      (list.length ? '<div class="r35-list">' + list.map(reqItem).join('') + '</div>'
        : card('Nothing here', '', empty(rf === 'new' ? 'No requests waiting. The sign-up page is amrabdelgawad.site/signup/.' : 'No requests in this list.')));
  }
  function reqItem(q){
    const labels = (q.courses || []).map(c => COURSE[c] || c);
    const acct = q.member_id ? (q.member_active ? 'Already has an account' : 'Has a turned-off account') : '';
    return '<section class="p-card r35-item' + (q.status === 'new' ? ' is-new' : '') + '" data-r="' + q.id + '">' +
      '<div class="r35-top"><b>' + esc(q.name) + '</b>' + PX.pill(q.status === 'new' ? 'Waiting' : q.status === 'approved' ? 'Approved' : 'Declined', q.status === 'approved' ? 'ok' : q.status === 'declined' ? 'no' : '') +
        labels.map(l => PX.pill(l, 'plain')).join('') + '<span class="r35-when">' + esc(when(q.created_at)) + '</span></div>' +
      '<p class="r35-meta"><a href="mailto:' + esc(q.email) + '">' + esc(q.email) + '</a>' + (acct ? ' · <a href="#people/' + esc(q.member_id) + '">' + esc(acct) + '</a>' : '') + '</p>' +
      (q.why ? '<p class="r35-body">' + para(q.why) + '</p>' : '') +
      '<div class="r35-acts">' +
        (q.status === 'new' ? (q.member_id ? '<a class="p-btn" href="#people/' + esc(q.member_id) + '">Open their access</a><button type="button" class="p-btn is-ghost" data-rs="approved" data-id="' + q.id + '">Mark approved</button>'
            : '<button type="button" class="p-btn" data-approve="' + q.id + '">Approve</button>') +
          '<button type="button" class="p-btn is-ghost" data-rs="declined" data-id="' + q.id + '">Decline</button>'
          : '<button type="button" class="p-btn is-ghost" data-rs="new" data-id="' + q.id + '">Back to waiting</button>') +
        '<button type="button" class="p-btn is-ghost r35-no" data-rdel="' + q.id + '">Delete</button></div></section>';
  }
  async function setReq(q, st){
    const r = await safe(db().rpc('signup_request_set', { p_id:q.id, p_status:st }));
    if (r.error) { toast('Couldn’t save that. Try again.'); return false; }
    q.status = st; return true;
  }
  async function clickReq(e, body){
    const b = e.target.closest('[data-f],[data-rs],[data-rdel],[data-approve]'); if (!b) return;
    if (b.dataset.f) { rf = b.dataset.f; return drawReqs(body); }
    const id = +(b.dataset.id || b.dataset.rdel || b.dataset.approve), q = reqs.find(x => x.id === id); if (!q) return;
    if (b.dataset.approve) {
      if (!window.PortalPeople || !window.PortalPeople.prefill) { toast('Invite and access didn’t load. Refresh and try again.'); return; }
      const ticks = (q.courses || []).filter(c => COURSE[c]);
      window.PortalPeople.prefill({ name:q.name, email:q.email, ticks, labels:ticks.map(c => COURSE[c]), onDone:() => setReq(q, 'approved').then(ok => ok && toast(q.name.split(' ')[0] + '’s sign-up request is marked approved.')) });
      location.hash = '#people';
    } else if (b.dataset.rs) {
      b.disabled = true;
      if (await setReq(q, b.dataset.rs)) { drawReqs(body); toast({ approved:'Marked approved.', declined:'Declined. Nothing was sent to them.', new:'Back to waiting.' }[b.dataset.rs]); }
      else b.disabled = false;
    } else if (b.dataset.rdel) {
      const keep = reqs.slice();
      const commit = () => safe(db().rpc('signup_request_set', { p_id:id, p_status:'remove' })).then(r => { if (r.error) { reqs = keep; drawReqs(body); toast('Couldn’t delete it. It was put back.'); } });
      if (window.PortalUI && window.PortalUI.undo) window.PortalUI.undo({ text:'Request deleted.', hide:() => { reqs = reqs.filter(x => x.id !== id); drawReqs(body); }, restore:() => { reqs = keep; drawReqs(body); }, commit });
      else { reqs = reqs.filter(x => x.id !== id); drawReqs(body); commit(); }
    }
  }

  // ---------- command center and search ----------
  async function waits(d){
    if (!isOwner()) return [];
    const [m, r] = await Promise.all([safe((d || db()).rpc('contact_inbox')), safe((d || db()).rpc('signup_requests_admin'))]);
    const out = [], nm = (m.data || []).filter(x => x.status === 'new'), nr = (r.data || []).filter(x => x.status === 'new');
    if (nm.length) out.push({ tag:'Site', text:PX.plural(nm.length, 'new site message') + ', latest ' + nm[0].name.split(' ')[0], href:'#inbox', act:'Read' });
    if (nr.length) out.push({ tag:'Access', text:PX.plural(nr.length, 'sign-up request') + ' to decide', href:'#signups', act:'Decide' });
    return out;
  }
  async function search(d){
    if (!isOwner()) return [];
    const [m, r] = await Promise.all([safe((d || db()).rpc('contact_inbox')), safe((d || db()).rpc('signup_requests_admin'))]);
    return (m.data || []).map(x => ({ kind:'Site message', title:x.name + (x.topic ? ' · ' + x.topic : ''), sub:x.email, text:x.message, href:'#inbox/' + x.id }))
      .concat((r.data || []).map(x => ({ kind:'Sign-up request', title:x.name, sub:x.email + ' · ' + (x.courses || []).map(c => COURSE[c] || c).join(', '), text:x.why || '', href:'#signups' })));
  }
  // menu count bubbles (owner only): refreshed on load and on every page change
  let busyCnt = false;
  async function counts(){
    if (busyCnt || !T().db || !isOwner()) return; busyCnt = true;
    try {
      const [m, r] = await Promise.all([safe(db().rpc('contact_inbox')), safe(db().rpc('signup_requests_admin'))]);
      [['inboxCnt', (m.data || []).filter(x => x.status === 'new').length], ['signupCnt', (r.data || []).filter(x => x.status === 'new').length]].forEach(([id, n]) => {
        const el = document.getElementById(id); if (el) { el.textContent = n; el.hidden = !n; }
      });
    } finally { busyCnt = false; }
  }
  addEventListener('hashchange', () => setTimeout(counts, 400));
  setTimeout(counts, 2500);
  window.R35Site = { waits, search, counts };
})();
