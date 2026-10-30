// Invite and access (/app/#people, Amr only), rebuilt on roles (round 5, screen 8).
//   #people          the people list (filters All, Agents, Managers, Off) and the first person
//   #people/<user>   one person
// For each person: their role (Owner and Student can't be chosen here), extras as tick boxes, what they'll see, the
// access log, Save, and Turn off / Turn back on. The database is the lock: members can only be changed by Amr
// ("Owner manages members"), and every change is logged by the members_access_log trigger
// (supabase/migrations/20261030120000_portal_roles.sql). Turning off and invites go through the team-access function,
// unchanged. Styles: app.css (#pPeople, .pp-*) on top of /portal.css.
(function(){
  'use strict';
  const T = () => window.TalentsApp || {};
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const initials = n => String(n || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const first = n => String(n || '').trim().split(/\s+/)[0] || 'them';
  const when = d => { try { return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric' }); } catch(e) { return ''; } };
  const since = d => { try { return new Date(d).toLocaleDateString('en-US', { month:'short', year:'numeric' }); } catch(e) { return ''; } };

  // Same as portal_role_keys() in the database
  const ROLE_KEYS = { agent:['course', 'deals', 'learn'], manager:['course', 'deals', 'learn', 'live', 'requests', 'team'] };
  const ROLE_NAME = { agent:'Agent', manager:'Manager' };
  // The tick boxes. learn (the Learning Hub) follows the courses: on when any course is on.
  const EXTRAS = [
    { key:'course', name:'Real Estate Acquisitions course' },
    { key:'deals', name:'Deal CRM and calculators' },
    { key:'mkt', name:'Marketing course' },
    { key:'psy', name:'Psychology and Therapy course' }
  ];
  const KEY_NAME = { course:'Acquisitions course', deals:'Deal CRM and calculators', learn:'Learning Hub', mkt:'Marketing course', psy:'Psychology course',
    live:'Live now', requests:'Missed-shift requests', team:'Everyone’s hours', money:'Money' };
  const CONTROLLED = ['course', 'deals', 'learn', 'mkt', 'psy', 'money'];

  let people = [], log = [], filter = 'all', q = '', current = '', draft = null, busy = false;
  const keysOf = (role, access, notGiven) => {
    const out = new Set((ROLE_KEYS[role] || []).filter(k => !(notGiven || []).includes(k)));
    (access || []).forEach(k => out.add(k)); out.delete('money');
    return out;
  };
  const person = id => people.find(p => p.user_id === id);

  // ---------- frame (drawn once) ----------
  function frame(){
    const box = $('pPeople');
    if (box.dataset.built) return;
    box.dataset.built = '1';
    box.innerHTML = '<div class="p-main"><div class="p-wrap pp">' +
      '<header class="pp-head"><div><span class="p-kick">People</span><h1>Invite and access</h1></div>' +
        '<button type="button" class="p-btn" id="ppInviteBtn" aria-expanded="false" aria-controls="ppInvite">+ Invite someone</button></header>' +
      '<section class="p-card pp-invite" id="ppInvite" hidden aria-labelledby="ppInvT"><h2 id="ppInvT">Invite someone</h2>' +
        '<form id="ppInvForm" class="pp-form" novalidate>' +
          '<label>Full name<input class="pp-field" id="ppInvName" maxlength="80" autocomplete="off" placeholder="Sara Nabil"></label>' +
          '<label>Email<input class="pp-field" id="ppInvEmail" type="email" autocomplete="off" placeholder="sara@email.com"></label>' +
          '<label>Works for<select class="pp-field" id="ppInvCo"></select></label>' +
          '<fieldset class="pp-inline"><legend>Role</legend><label><input type="radio" name="ppInvRole" value="agent" checked> Agent</label><label><input type="radio" name="ppInvRole" value="manager"> Manager</label></fieldset>' +
          '<p class="pp-note">New people get everything their role comes with. You can change it after.</p>' +
          '<p class="pp-err" id="ppInvErr" role="alert"></p>' +
          '<div class="pp-btns"><button class="p-btn" type="submit" data-via="email">Send email invite</button><button class="p-btn is-ghost" type="submit" data-via="whatsapp">Get WhatsApp link</button></div>' +
        '</form>' +
        '<div class="pp-link" id="ppLink" hidden><p><b id="ppLinkFor"></b></p><p class="pp-note" id="ppLinkNote"></p>' +
          '<label class="p-vh" for="ppLinkVal">Sign-in link</label><input class="pp-field" id="ppLinkVal" readonly>' +
          '<div class="pp-btns"><button class="p-btn is-ghost" type="button" id="ppLinkCopy">Copy link</button><a class="p-btn is-ghost" id="ppLinkWa" target="_blank" rel="noopener">Send on WhatsApp</a></div></div>' +
      '</section>' +
      '<div class="pp-cols" id="ppCols">' +
        '<section class="p-card pp-list" aria-label="People">' +
          '<div class="pp-filters" role="group" aria-label="Show"></div>' +
          '<label class="p-vh" for="ppQ">Find a person</label><input class="pp-field pp-q" id="ppQ" type="search" placeholder="Find a person" autocomplete="off">' +
          '<div id="ppRows"><p class="p-empty">Loading…</p></div>' +
        '</section>' +
        '<section class="p-card pp-detail" id="ppDetail" aria-live="polite"></section>' +
      '</div></div></div>';
    $('ppInviteBtn').addEventListener('click', () => { const open = $('ppInvite').hidden; $('ppInvite').hidden = !open; $('ppInviteBtn').setAttribute('aria-expanded', open); if (open) $('ppInvName').focus(); });
    $('ppQ').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); drawList(); });
    box.querySelector('.pp-filters').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; drawList(); } });
    $('ppRows').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) go(b.dataset.id); });
    bindInvite();
    bindDetail();
  }

  // ---------- data ----------
  async function load(){
    const db = T().db;
    const [m, l] = await Promise.all([
      db.from('members').select('*').order('active', { ascending:false }).order('name'),
      db.from('access_log').select('*').order('at', { ascending:false }).limit(500)
    ]);
    if (m.error) throw m.error;
    people = (m.data || []).filter(p => p.user_id);
    log = l.error ? [] : (l.data || []);
  }

  // ---------- list ----------
  function counts(){
    return { all:people.length, agent:people.filter(p => p.active && p.role !== 'manager').length, manager:people.filter(p => p.active && p.role === 'manager').length, off:people.filter(p => !p.active).length };
  }
  function shown(){
    return people.filter(p => filter === 'all' || (filter === 'off' ? !p.active : p.active && (filter === 'manager' ? p.role === 'manager' : p.role !== 'manager')))
      .filter(p => !q || (p.name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q));
  }
  function drawList(){
    const c = counts();
    $('pPeople').querySelector('.pp-filters').innerHTML = [['all', 'All'], ['agent', 'Agents'], ['manager', 'Managers'], ['off', 'Off']]
      .map(([f, t]) => '<button type="button" data-f="' + f + '" aria-pressed="' + (filter === f) + '">' + t + ' ' + c[f] + '</button>').join('');
    const list = shown();
    $('ppRows').innerHTML = list.length ? '<ul class="pp-rows">' + list.map(p =>
      '<li><button type="button" class="pp-row" data-id="' + esc(p.user_id) + '"' + (p.user_id === current ? ' aria-current="true"' : '') + '>' +
        '<span class="pp-av' + (p.active ? '' : ' is-off') + '" aria-hidden="true">' + esc(initials(p.name)) + '</span>' +
        '<span class="pp-who"><b>' + esc(p.name) + '</b><small>' + (p.active ? 'Since ' + esc(since(p.created_at)) : 'Turned off' + (offAt(p) ? ' ' + esc(when(offAt(p))) : '')) + '</small></span>' +
        (p.active ? '<span class="p-pill' + (p.role === 'manager' ? ' is-dark' : '') + '">' + ROLE_NAME[p.role === 'manager' ? 'manager' : 'agent'] + '</span>' : '<span class="p-pill is-no">Off</span>') +
      '</button></li>').join('') + '</ul>'
      : '<p class="p-empty">' + (people.length ? 'No one matches.' : 'No one yet. Invite your first team member.') + '</p>';
  }
  const offAt = p => { const x = log.find(l => l.target === p.user_id && l.change && l.change.active && l.change.active.to === false); return x && x.at; };

  // ---------- one person ----------
  function go(id){
    if (draft && draft.dirty && draft.id !== id) {
      window.ask({ title:'Leave without saving?', msg:'Your changes to ' + first((person(draft.id) || {}).name) + '’s access aren’t saved yet.', ok:'Leave', cancel:'Keep editing' })
        .then(yes => { if (yes) { draft = null; location.hash = '#people/' + encodeURIComponent(id); } });
      return;
    }
    location.hash = '#people/' + encodeURIComponent(id);
  }
  function startDraft(p){
    const keys = keysOf(p.role, p.access, p.not_given);
    draft = { id:p.user_id, role:p.role === 'manager' ? 'manager' : 'agent', ticks:new Set(EXTRAS.map(e => e.key).filter(k => keys.has(k) && (k === 'course' || k === 'deals' || keys.has('learn')))),
      company:p.company_id, until:p.deals_until || '', mfa:!!p.deals_mfa, dirty:false };
  }
  // What the boxes add up to: role keys minus not_given, plus extras
  function planOf(p, d){
    const roleKeys = ROLE_KEYS[d.role];
    const want = new Set(d.ticks);
    if (want.has('course') || want.has('mkt') || want.has('psy')) want.add('learn');
    const notGiven = roleKeys.filter(k => ['course', 'deals', 'learn'].includes(k) && !want.has(k));
    const access = (p.access || []).filter(k => !CONTROLLED.includes(k)).concat([...want].filter(k => !roleKeys.includes(k)));
    return { role:d.role, access:[...new Set(access)].sort(), not_given:notGiven.sort(), keys:keysOf(d.role, access, notGiven) };
  }
  function seeList(p, plan){
    const k = plan.keys, out = ['Clock in and my hours'];
    if (k.has('live')) out.push('Live now');
    if (k.has('requests')) out.push(plan.role === 'manager' ? 'Missed-shift requests (approves them)' : 'Missed-shift requests');
    if (k.has('team')) out.push('Everyone’s hours (with their code)');
    if (k.has('deals')) out.push(plan.role === 'manager' ? 'Deal CRM' : 'My deals', 'Calculators');
    if (k.has('course')) out.push('Acquisitions course');
    if (k.has('learn') && k.has('mkt')) out.push('Marketing course');
    if (k.has('learn') && k.has('psy')) out.push('Psychology course');
    if (plan.role === 'manager') out.push('Learner progress');
    return out;
  }
  function drawDetail(){
    const box = $('ppDetail'), p = person(current);
    $('ppCols').classList.toggle('is-detail', !!p);
    if (!p) { box.innerHTML = '<p class="p-empty">Pick someone on the left to see and change what they can open.</p>'; return; }
    if (!draft || draft.id !== p.user_id) startDraft(p);
    const d = draft, plan = planOf(p, d), roleKeys = ROLE_KEYS[d.role], fn = first(p.name), off = !p.active;
    const roleCard = (v, name, sub, disabled) => '<label class="pp-role' + (disabled ? ' is-disabled' : '') + '"><input type="radio" name="ppRole" value="' + v + '"' + (d.role === v ? ' checked' : '') + (disabled || off ? ' disabled' : '') + '><span><b>' + name + '</b><small>' + sub + '</small></span></label>';
    const extra = e => {
      const inRole = roleKeys.includes(e.key);
      const given = d.ticks.has(e.key), locked = inRole && given && !(p.not_given || []).includes(e.key);
      const note = inRole ? (given ? 'Comes with ' + ROLE_NAME[d.role] : 'Comes with ' + ROLE_NAME[d.role] + ', not turned on yet') : '';
      return '<label class="pp-extra' + (locked ? ' is-locked' : '') + '"><input type="checkbox" value="' + e.key + '"' + (given ? ' checked' : '') + (locked || off ? ' disabled' : '') + '><span>' + esc(e.name) + '</span>' + (note ? '<small>' + esc(note) + '</small>' : '') + '</label>';
    };
    const cos = (T().companies || []).map(c => '<option value="' + c.id + '"' + (String(c.id) === String(d.company) ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
    box.innerHTML =
      '<button type="button" class="pp-back" data-back>← All people</button>' +
      '<div class="pp-top"><span class="pp-av big' + (off ? ' is-off' : '') + '" aria-hidden="true">' + esc(initials(p.name)) + '</span><div><h2>' + esc(p.name) + '</h2><p>' + esc(p.email || '') + ' · ' + (off ? 'Off' : 'Active') + '</p></div></div>' +
      (off ? '<p class="pp-offnote">' + esc(fn) + '’s access is turned off. They can’t sign in or open anything. Their shifts and history are kept.</p>' : '') +
      '<fieldset class="pp-sec"><legend>Role</legend><div class="pp-roles">' +
        roleCard('owner', 'Owner', 'Only you', true) + roleCard('manager', 'Manager', 'Runs the team, no money or access', false) +
        roleCard('agent', 'Agent', 'Own shifts, own deals, assigned courses', false) + roleCard('student', 'Student', 'Only their courses (coming later)', true) +
      '</div></fieldset>' +
      '<fieldset class="pp-sec"><legend>Extras</legend>' + EXTRAS.map(extra).join('') + '</fieldset>' +
      (plan.keys.has('deals') ? '<fieldset class="pp-sec pp-small"><legend>Deal tools</legend>' +
        '<label class="pp-inline-l">Deal tools until <input type="date" class="pp-field pp-date" data-until value="' + esc(d.until) + '"' + (off ? ' disabled' : '') + '></label>' +
        '<label class="pp-check"><input type="checkbox" data-mfa' + (d.mfa ? ' checked' : '') + (off ? ' disabled' : '') + '> Ask for an authenticator code to open them</label>' +
        '<p class="pp-note">Leave the date empty for no end.</p></fieldset>' : '') +
      '<fieldset class="pp-sec pp-small"><legend>Work</legend><label class="pp-inline-l">Works for <select class="pp-field" data-co' + (off ? ' disabled' : '') + '>' + cos + '</select></label></fieldset>' +
      '<section class="pp-see" aria-label="What ' + esc(fn) + ' will see"><h3>What ' + esc(fn) + ' will see</h3><div class="pp-chips">' + (off ? '<span>Nothing while turned off</span>' : seeList(p, plan).map(t => '<span>' + esc(t) + '</span>').join('')) + '</div></section>' +
      '<section class="pp-log" aria-label="Access log"><h3>Access log</h3>' + logHtml(p) + '</section>' +
      '<div class="pp-foot">' + (off
        ? '<button type="button" class="p-btn" data-act="restore">Turn ' + esc(fn) + '’s access back on</button>'
        : '<button type="button" class="p-btn" data-act="save"' + (d.dirty ? '' : ' disabled') + '>Save changes</button><button type="button" class="p-btn is-danger" data-act="remove">Turn off ' + esc(fn) + '’s access</button>' +
          '<span class="pp-note">Turning off closes everything at once.</span>') + '</div>' +
      (off ? '' : '<div class="pp-signin"><span class="pp-note">New phone or forgotten password?</span><button type="button" class="p-btn is-ghost" data-act="link" data-via="email">Email a sign-in link</button><button type="button" class="p-btn is-ghost" data-act="link" data-via="whatsapp">WhatsApp a sign-in link</button></div>');
  }
  function logHtml(p){
    const rows = log.filter(l => l.target === p.user_id).slice(0, 12);
    if (!rows.length) return '<p class="p-empty">No changes recorded yet. Changes from now on show here.</p>';
    const me = T().user && T().user.id;
    const by = a => !a ? 'the system' : a === me ? 'Amr' : first((person(a) || {}).name) || 'someone';
    const diff = (a, b) => ({ add:(b || []).filter(k => !(a || []).includes(k)), drop:(a || []).filter(k => !(b || []).includes(k)) });
    const lines = l => {
      const c = l.change || {}, out = [];
      if (c.added) out.push('Invited as ' + (ROLE_NAME[c.added.role] || 'Agent'));
      if (c.role) out.push('Role set to ' + (ROLE_NAME[c.role.to] || c.role.to));
      if (c.access) { const x = diff(c.access.from, c.access.to); x.add.forEach(k => out.push((KEY_NAME[k] || k) + ' added')); x.drop.forEach(k => out.push((KEY_NAME[k] || k) + ' removed')); }
      if (c.not_given) { const x = diff(c.not_given.from, c.not_given.to); x.drop.forEach(k => out.push((KEY_NAME[k] || k) + ' turned on')); x.add.forEach(k => out.push((KEY_NAME[k] || k) + ' held back')); }
      if (c.active) out.push(c.active.to ? 'Access turned back on' : 'Access turned off');
      if (c.deals_until) out.push(c.deals_until.to ? 'Deal tools end on ' + when(c.deals_until.to + 'T12:00') : 'Deal tools end date removed');
      if (c.deals_mfa) out.push(c.deals_mfa.to ? 'Authenticator code asked for Deal tools' : 'No authenticator code for Deal tools');
      return out.length ? out : ['Changed'];
    };
    return '<ul class="pp-loglist">' + rows.map(l => '<li><time datetime="' + esc(l.at) + '">' + esc(when(l.at)) + '</time><span>' + esc(lines(l).join(', ')) + ' by ' + esc(by(l.actor)) + '</span></li>').join('') + '</ul>';
  }

  function bindDetail(){
    const box = $('ppDetail');
    box.addEventListener('change', e => {
      const t = e.target; if (!draft) return;
      if (t.name === 'ppRole') draft.role = t.value;
      else if (t.matches('.pp-extra input')) t.checked ? draft.ticks.add(t.value) : draft.ticks.delete(t.value);
      else if (t.matches('[data-until]')) draft.until = t.value;
      else if (t.matches('[data-mfa]')) draft.mfa = t.checked;
      else if (t.matches('[data-co]')) draft.company = Number(t.value);
      else return;
      draft.dirty = true;
      const keep = t.matches('input[type=radio], input[type=checkbox]') ? (t.name || t.value || '') : '';
      drawDetail();
      // keep the keyboard where it was
      const again = keep && box.querySelector(t.name === 'ppRole' ? 'input[name=ppRole][value="' + t.value + '"]' : t.matches('[data-mfa]') ? '[data-mfa]' : 'input[value="' + t.value + '"]');
      if (again) again.focus();
    });
    box.addEventListener('click', async e => {
      if (e.target.closest('[data-back]')) { location.hash = '#people'; current = ''; draft = null; drawDetail(); drawList(); return; }
      const b = e.target.closest('[data-act]'); if (!b || busy) return;
      const p = person(current); if (!p) return;
      const act = b.dataset.act;
      if (act === 'save') return save(p, b);
      if (act === 'remove') {
        const yes = await window.ask({ title:'Turn off ' + p.name + '’s access?', msg:'They won’t be able to sign in or open anything, all at once. Their shifts and history stay in your records. You can turn it back on later.', ok:'Turn off access', cancel:'Keep access', danger:true });
        if (!yes) return;
      }
      busy = true; b.setAttribute('aria-busy', 'true');
      const r = await T().callAccess({ action:act, user_id:p.user_id, via:b.dataset.via || null });
      busy = false; b.removeAttribute('aria-busy');
      if (r.error) { T().toast(r.error); return; }
      if (act === 'link') { r.sent ? T().toast('Sign-in link emailed to ' + p.email) : showLink(p.name, r.link, 'A new sign-in link for ' + first(p.name) + ', for a forgotten password or a new phone. It works once and expires in an hour.'); return; }
      T().toast(act === 'remove' ? first(p.name) + '’s access is off.' : first(p.name) + '’s access is back on.');
      draft = null; await refresh();
    });
  }
  async function save(p, btn){
    const d = draft, plan = planOf(p, d), db = T().db;
    busy = true; btn.setAttribute('aria-busy', 'true');
    const row = { role:plan.role, access:plan.access, not_given:plan.not_given, company_id:d.company || p.company_id, deals_until:d.until || null, deals_mfa:d.mfa };
    const { error } = await db.from('members').update(row).eq('user_id', p.user_id);
    // Settings > Agents shows the same role on their agent card
    if (!error && p.agent_id) await db.from('agents').update({ role:plan.role === 'manager' ? 'leader' : 'member' }).eq('id', p.agent_id).then(x => x, () => {});
    busy = false; btn.removeAttribute('aria-busy');
    if (error) { T().toast('Couldn’t save that. Try again.'); return; }
    T().toast(first(p.name) + '’s access is saved.');
    draft = null; await refresh();
  }

  // ---------- invite ----------
  let via = 'email';
  function showLink(name, link, note){
    $('ppInvite').hidden = false; $('ppInviteBtn').setAttribute('aria-expanded', 'true');
    $('ppLink').hidden = false; $('ppLinkFor').textContent = name; $('ppLinkNote').textContent = note; $('ppLinkVal').value = link;
    const msg = 'Hi ' + first(name) + ', here is your link for the Amr Abdelgawad Talents tracker: ' + link + '\n\nOpen it, choose a password, then add the app to your home screen. The link works once.';
    $('ppLinkWa').href = 'https://wa.me/?text=' + encodeURIComponent(msg);
    $('ppLink').scrollIntoView({ block:'nearest' });
  }
  function bindInvite(){
    const f = $('ppInvForm');
    f.querySelectorAll('[data-via]').forEach(b => b.addEventListener('click', () => { via = b.dataset.via; }));
    $('ppLinkCopy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('ppLinkVal').value); T().toast('Link copied'); } catch(e) { $('ppLinkVal').select(); T().toast('Press and hold to copy the link'); }
    });
    ['ppInvName', 'ppInvEmail'].forEach(id => $(id).addEventListener('input', () => $('ppInvErr').textContent = ''));
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const name = $('ppInvName').value.trim().replace(/\s+/g, ' '), email = $('ppInvEmail').value.trim(), co = Number($('ppInvCo').value) || null;
      const role = (f.querySelector('input[name=ppInvRole]:checked') || {}).value || 'agent';
      if (name.length < 2) { $('ppInvErr').textContent = 'Enter their full name.'; $('ppInvName').focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('ppInvErr').textContent = 'Enter a valid email.'; $('ppInvEmail').focus(); return; }
      const btn = f.querySelector('[data-via="' + via + '"]'); btn.setAttribute('aria-busy', 'true');
      const r = await T().callAccess({ action:'invite', name, email, company_id:co, via });
      if (!r.error && role === 'manager') {
        // team-access makes them an Agent (the column default); the role is set right after, by Amr, and logged
        const { error } = await T().db.from('members').update({ role:'manager' }).ilike('email', email.replace(/[\\%_]/g, '\\$&'));   // exact match, any case: _ and % are wildcards in ilike
        if (error) T().toast(first(name) + ' is invited as an Agent. Set Manager on their row.');
      }
      btn.removeAttribute('aria-busy');
      if (r.error) { $('ppInvErr').textContent = r.error; return; }
      const joined = r.linked_shifts ? ' ' + r.linked_shifts + ' earlier shift' + (r.linked_shifts === 1 ? '' : 's') + ' joined their history.' : '';
      if (r.sent) { $('ppLink').hidden = true; T().toast('Invite emailed to ' + email + '.' + joined); }
      else showLink(name, r.link, 'Send this to ' + first(name) + '. It works once and expires in 24 hours.' + joined);
      $('ppInvName').value = ''; $('ppInvEmail').value = '';
      await refresh();
    });
  }

  async function refresh(){
    try { await load(); } catch(e) { $('ppRows').innerHTML = '<p class="p-empty">Couldn’t load people. Check your connection and try again.</p>'; return; }
    drawList(); drawDetail();
  }

  window.PortalPeople = {
    async open(id){
      frame();
      T().fillCompanies($('ppInvCo'), $('ppInvCo').value || ((T().companies || [])[0] || {}).id);
      if (id !== current) { current = id; if (!draft || draft.id !== id) draft = null; }
      if (!people.length || !id) await refresh(); else { drawList(); drawDetail(); }
      // On a wide screen, open the first person when none is picked; on a phone, the list comes first
      if (!current && people.length && matchMedia('(min-width: 900px)').matches) { current = shown()[0] ? shown()[0].user_id : ''; drawList(); drawDetail(); }
    }
  };
})();
