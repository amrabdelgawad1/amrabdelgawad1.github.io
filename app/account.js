// Talents app: the account circle (My profile, Settings, Sign out), profile photos, and Settings.
// Settings shows what each person may use: everyone gets My profile, Password and Appearance;
// Amr also gets Agents, Dollar rates and Backup. The database decides what each person can really change.
(function(){
  const T = window.TalentsApp; if (!T) return;
  const { db, toast, esc, initials } = T;
  const $ = id => document.getElementById(id);
  const ROLES = { member:'Team member', operator:'Operator', leader:'Team leader' };
  // What each role can also see in the app (look only), on top of their own clock, history, payslips and Settings
  const ROLE_ACCESS = { member:[], leader:['live', 'requests', 'team'], operator:['live', 'requests', 'team', 'money'] };
  const SECTION_NAMES = { live:'Live now', requests:'Missed-shift requests', team:'Team', money:'Money' };
  const roleSees = r => ROLE_ACCESS[r].length ? 'Also sees ' + ROLE_ACCESS[r].map(s => SECTION_NAMES[s]).join(', ') + ' (look only).' : 'Sees only their own profile, history and payslips.';
  const pad2 = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const today = () => iso(new Date());
  const usd = n => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const hm = s => Math.floor(s / 3600) + 'h ' + pad2(Math.floor(s % 3600 / 60)) + 'm';
  const day = d => new Date(d + 'T00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  const key = s => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const photoUrl = p => p ? db.storage.from('avatars').getPublicUrl(p).data.publicUrl : null;
  const avatar = (name, url, size) => '<span class="av' + (name === myName() && isOwner() ? ' owner' : '') + '"' + (size ? ' style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * .36) + 'px"' : '') + '>' +
    (url ? '<img src="' + esc(url) + '" alt="" />' : esc(name === myName() && isOwner() ? 'A' : initials(name))) + '</span>';
  const ICON = {
    user:'<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    gear:'<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
    out:'<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/></svg>',
    x:'<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    chev:'<svg class="i chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    back:'<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    cam:'<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    plus:'<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
  };

  // ---------- who is signed in ----------
  let mine = { name:'', phone:'', photo:null }; // this person's profile row
  let agents = [], links = [], cos = [];          // owner: agents, agent ↔ company links, companies
  const isOwner = () => T.role === 'owner';
  const myName = () => isOwner() ? (mine.name || 'Amr Abdelgawad') : (T.profile && T.profile.name) || '';
  let card = null; // team member: their agent number, role, agent photo, company and pay (my_card)
  const myRole = () => isOwner() ? 'owner' : (card && card.role) || 'member';
  const myAgent = () => agents.find(a => key(a.name) === key(myName()));

  // Photos for Live now: people with an account by user id, /tracker agents by name
  const byUser = new Map(), byName = new Map();
  window.TalentsPhotos = { v:0, find: (uid, name) => (uid && byUser.get(uid)) || byName.get(key(name)) || null };
  async function loadPhotos(){
    const [p, a] = await Promise.all([db.from('profiles').select('user_id,photo_path'), db.from('agents').select('name,photo_path')]);
    byUser.clear(); byName.clear();
    if (!p.error) p.data.forEach(r => { if (r.photo_path) byUser.set(r.user_id, photoUrl(r.photo_path)); });
    if (!a.error) a.data.forEach(r => { if (r.photo_path) byName.set(key(r.name), photoUrl(r.photo_path)); });
    window.TalentsPhotos.v++;
  }

  async function loadMine(){
    const { data } = await db.from('profiles').select('*').eq('user_id', T.user.id).maybeSingle();
    mine = { name: data && data.display_name || '', phone: data && data.phone || '', photo: data && data.photo_path || null };
    drawCircle();
  }
  // Their own photo first, else the one Amr set on their agent
  const myPhoto = () => photoUrl(mine.photo) || (card && photoUrl(card.photo_path)) || null;
  function drawCircle(){
    const url = myPhoto(), b = $('me');
    b.innerHTML = url ? '<img src="' + esc(url) + '" alt="" />' : esc(isOwner() ? 'A' : initials(myName()));
    b.classList.toggle('has-photo', !!url);
    if (!isOwner() && $('mcAv')) $('mcAv').innerHTML = url ? '<img src="' + esc(url) + '" alt="" />' : esc(initials(myName()));
  }

  // ---------- team member: details card and payslips on their page ----------
  async function loadCard(){
    const [c, r] = await Promise.all([db.rpc('my_card'), db.rpc('fx_rate_on')]);
    card = !c.error && (Array.isArray(c.data) ? c.data[0] : c.data) || null;
    const rate = Number(r.data) || 0, pay = card && card.pay_rate != null ? Number(card.pay_rate) : null;
    $('mcName').textContent = (card && card.agent_no ? pad2(card.agent_no) + ' · ' : '') + myName();
    const co = (card && card.company_name) || (T.profile || {}).company_name;
    $('mcChips').innerHTML = '<span class="pill p-ok">' + ROLES[myRole()] + '</span>' + (co ? '<span class="pill p-plain">' + esc(co) + '</span>' : '');
    $('mcRate').hidden = pay == null;
    if (pay != null) {
      $('mcPay').innerHTML = usd(pay) + '<span> / hour</span>';
      $('mcPayEgp').textContent = rate ? '= EGP ' + Math.round(pay * rate).toLocaleString('en-US') + ' at today’s rate' : '';
    }
    if (T.setGoal) T.setGoal(card && card.weekly_goal);
    drawCircle();
  }
  $('mcSettings').addEventListener('click', () => openSettings('profile'));

  // Signed payslips Amr uploaded, newest first; Cycle 1 is the oldest
  const fmtDay = d => new Date(d + 'T00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  const cycleText = p => fmtDay(p.period_start) + ' – ' + fmtDay(p.period_end);
  async function loadSlips(){
    const box = $('slipList'); if (!box) return;
    const { data, error } = await db.from('payslips').select('id,period_start,period_end,file_path,file_type,note').order('period_start');
    if (error) { box.innerHTML = '<p class="empty">Couldn’t load your payslips. Pull to refresh.</p>'; return; }
    box.innerHTML = data.length ? data.map((p, i) => ({ p, n: i + 1 })).reverse().map(({ p, n }) =>
      '<button type="button" class="slip" data-slip="' + p.id + '"><span class="slip-ic" aria-hidden="true">' + (p.file_type === 'application/pdf' ? 'PDF' : 'IMG') + '</span>' +
      '<span class="n"><b>Cycle ' + n + '</b><small>' + esc(cycleText(p)) + (p.note ? ' · ' + esc(p.note) : '') + '</small></span><span class="slip-open">Open</span></button>').join('')
      : '<p class="empty">No payslips yet. Amr adds each signed payslip here after a pay cycle.</p>';
    slips = data;
  }
  let slips = [];
  // Payslips are private files: open each one through a link that works for a few minutes
  async function openSlip(path){
    const w = window.open('', '_blank');
    const { data, error } = await db.storage.from('payslips').createSignedUrl(path, 300);
    if (error || !data) { if (w) w.close(); toast('Couldn’t open that payslip. Try again.'); return; }
    if (w) w.location.href = data.signedUrl; else location.href = data.signedUrl;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-slip]'); if (!b || b.closest('.sheet')) return;
    const p = slips.find(x => x.id === Number(b.dataset.slip)); if (p) openSlip(p.file_path);
  });

  let started = false; // once per sign-in, whichever comes first: the event or this file loading late
  document.addEventListener('talents-signed-out', () => { started = false; card = null; });
  async function onSignedIn(){
    if (started) return; started = true;
    closeMenu(); closeSheet();
    await loadMine();
    if (isOwner()) await loadAgents();
    else { loadCard(); loadSlips(); }
    await loadPhotos();
  }
  document.addEventListener('talents-signed-in', onSignedIn);

  // ---------- the menu under the circle ----------
  const menu = document.createElement('div');
  menu.className = 'acct-menu'; menu.id = 'acctMenu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
  document.body.appendChild(menu);
  function openMenu(){
    const role = isOwner() ? 'Owner' : ROLES[myRole()];
    menu.innerHTML = '<div class="who">' + avatar(myName(), photoUrl(mine.photo), 42) + '<div><b>' + esc(myName()) + '</b><small>' + esc(role) + '</small></div></div>' +
      '<button type="button" class="ai" role="menuitem" data-go="profile">' + ICON.user + 'My profile</button>' +
      '<button type="button" class="ai" role="menuitem" data-go="settings">' + ICON.gear + 'Settings</button>' +
      '<div class="sep"></div><button type="button" class="ai out" role="menuitem" data-go="out">' + ICON.out + 'Sign out</button>';
    menu.hidden = false; $('me').setAttribute('aria-expanded', 'true');
    menu.querySelector('.ai').focus();
  }
  function closeMenu(){ menu.hidden = true; $('me').setAttribute('aria-expanded', 'false'); }
  $('me').addEventListener('click', e => { e.stopPropagation(); if (!T.role) return; menu.hidden ? openMenu() : closeMenu(); });
  document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
  menu.addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    closeMenu();
    if (b.dataset.go === 'out') T.signOut();
    else openSettings(b.dataset.go === 'profile' ? 'profile' : (isOwner() ? 'agents' : 'profile'));
  });

  // ---------- the Settings window ----------
  const sheet = document.createElement('div');
  sheet.className = 'sheet-shade'; sheet.hidden = true;
  sheet.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="Settings"><button type="button" class="sheet-x" data-close aria-label="Close">' + ICON.x + '</button>' +
    '<div class="set"><nav aria-label="Settings sections"><h2>Settings</h2><div id="setTabs"></div></nav><div class="set-body" id="setBody"></div></div></div>';
  document.body.appendChild(sheet);
  let tab = 'profile', agentOpen = new Set(), agentView = null, lastFocus = null;
  const TABS = () => isOwner()
    ? [['profile','My profile'], ['agents','Agents'], ['rates','Dollar rates'], ['password','Password'], ['look','Appearance'], ['backup','Backup']]
    : [['profile','My profile'], ['password','Password'], ['look','Appearance']];
  function openSettings(t){
    lastFocus = document.activeElement;
    tab = t; agentView = null;
    sheet.hidden = false; document.body.classList.add('sheet-open');
    drawTabs(); drawBody();
  }
  // From a person's Team page: open their profile in Settings, at the Payslips box
  window.TalentsAccount = {
    async openPayslips(name){
      if (!isOwner()) return;
      await loadAgents();
      const a = agents.find(x => key(x.name) === key(name));
      if (!a) { toast('There’s no agent called ' + name + ' in Settings › Agents yet.'); return; }
      lastFocus = document.activeElement;
      tab = 'agents'; agentView = a.id;
      sheet.hidden = false; document.body.classList.add('sheet-open');
      drawTabs();
      const p = drawAgentProfile();
      const box = $('agSlips'); if (box) { box.scrollIntoView({ block:'start' }); $('psFrom').focus({ preventScroll:true }); }
      await p;
    }
  };
  function closeSheet(){
    if (sheet.hidden) return;
    sheet.hidden = true; document.body.classList.remove('sheet-open');
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  sheet.addEventListener('mousedown', e => { if (e.target === sheet) closeSheet(); });
  sheet.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!menu.hidden) closeMenu(); else if (!document.querySelector('dialog[open]')) closeSheet(); });
  function drawTabs(){
    $('setTabs').innerHTML = TABS().map(([k, l]) => '<button type="button" data-tab="' + k + '"' + (tab === k ? ' aria-current="true"' : '') + '>' + l + '</button>').join('');
  }
  $('setTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; agentView = null; drawTabs(); drawBody(); });
  const head = (t, sub) => '<div class="set-head"><h3>' + t + '</h3>' + (sub ? '<p class="note">' + sub + '</p>' : '') + '</div>';
  async function drawBody(){
    const B = $('setBody');
    B.scrollTop = 0;
    if (tab === 'profile') return drawProfile();
    if (tab === 'agents') return agentView ? drawAgentProfile() : drawAgents();
    if (tab === 'rates') return drawRates();
    if (tab === 'password') {
      B.innerHTML = head('Password', 'At least 8 characters. You stay signed in on this device.') +
        '<form class="form narrow" id="pwChange" novalidate><label class="label">New password<input class="field" type="password" id="npw1" autocomplete="new-password" /></label>' +
        '<label class="label">Type it again<input class="field" type="password" id="npw2" autocomplete="new-password" /></label><p class="err" id="npwErr"></p><button class="btn" type="submit">Change password</button></form>';
      return;
    }
    if (tab === 'look') {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      B.innerHTML = head('Appearance') + '<fieldset class="choices"><legend class="label">Colours</legend>' +
        [['light','Light', !dark], ['dark','Dark', dark]].map(([v, l, on]) => '<label class="choice"><input type="radio" name="look" value="' + v + '"' + (on ? ' checked' : '') + ' /><b>' + l + '</b></label>').join('') + '</fieldset>';
      return;
    }
    if (tab === 'backup') {
      B.innerHTML = head('Backup', 'Saves every table to one file on this device. Keep it in Drive › Portfolio Work › Backups.') + '<div><button class="btn" type="button" data-backup>Download a backup</button></div>';
    }
  }

  // ---------- My profile ----------
  async function drawProfile(){
    const B = $('setBody'), own = isOwner(), url = myPhoto();
    B.innerHTML = head('My profile') +
      '<div class="photo-row">' + avatar(myName(), url, 92) + '<div class="photo-side"><b class="big">' + esc(myName()) + '</b>' +
      '<div class="chips">' + (own ? '<span class="pill p-ok">Owner</span>' : '<span class="pill p-pau">' + ROLES[myRole()] + '</span>' + ((T.profile || {}).company_name ? '<span class="pill p-off">' + esc(T.profile.company_name) + '</span>' : '')) + '</div>' +
      '<div class="acts"><label class="btn small file-btn">' + ICON.cam + 'Upload photo<input type="file" accept="image/*" data-photo="me" hidden /></label>' + (mine.photo ? '<button class="btn ghost small" type="button" data-unphoto>Remove</button>' : '') + '</div></div></div>' +
      (own ? '' : '<div class="tiles four" id="myStats"><div class="tile"><p>Pay rate</p><strong class="num">…</strong></div><div class="tile"><p>Hours this month</p><strong class="num">…</strong></div><div class="tile in"><p>Earned this month</p><strong class="num">…</strong></div><div class="tile due"><p>Not paid yet</p><strong class="num">…</strong></div></div>') +
      '<form class="form" id="profForm" novalidate><div class="two">' +
        '<label class="label">Name shown in the app<input class="field" id="pfName" maxlength="80" value="' + esc(myName()) + '"' + (own ? '' : ' readonly') + ' /></label>' +
        '<label class="label">Email (sign-in)<input class="field" value="' + esc(T.user.email || '') + '" readonly /></label>' +
        '<label class="label">Phone / WhatsApp<input class="field" id="pfPhone" maxlength="40" inputmode="tel" placeholder="+20 …" value="' + esc(mine.phone) + '" /></label>' +
        (own ? '' : '<label class="label">Role<input class="field" value="' + ROLES[myRole()] + '" readonly /></label>') +
      '</div>' + (own ? '' : '<p class="note">Only Amr can change your name, role and pay.</p>') +
      '<p class="err" id="pfErr"></p><div><button class="btn" type="submit">Save</button></div></form>';
    if (!own) {
      const { data } = await db.rpc('my_shifts');
      const box = $('myStats'); if (!box || !data) return;
      const month = today().slice(0, 7), thisMonth = data.filter(r => r.shift_date.slice(0, 7) === month);
      const val = r => r.work_seconds / 3600 * Number(r.pay_rate || 0);
      const last = data.find(r => r.pay_rate != null);
      const v = box.querySelectorAll('strong');
      v[0].textContent = last ? usd(Number(last.pay_rate)) + '/h' : '—';
      v[1].textContent = hm(thisMonth.reduce((a, r) => a + r.work_seconds, 0));
      v[2].textContent = usd(thisMonth.reduce((a, r) => a + val(r), 0));
      v[3].textContent = usd(data.filter(r => !r.paid).reduce((a, r) => a + val(r), 0));
    }
  }
  async function saveProfile(form){
    const err = m => { $('pfErr').textContent = m; };
    const name = $('pfName').value.trim().replace(/\s+/g, ' '), phone = $('pfPhone').value.trim();
    if (isOwner() && name.length < 2) return err('Type your name.');
    const row = { user_id: T.user.id, phone: phone || null, updated_at: new Date().toISOString() };
    if (isOwner()) row.display_name = name;
    const btn = form.querySelector('[type=submit]'); btn.setAttribute('aria-busy', 'true');
    const { error } = await db.from('profiles').upsert(row);
    btn.removeAttribute('aria-busy');
    if (error) return err('Couldn’t save it. Check your connection and try again.');
    if (isOwner()) mine.name = name;
    mine.phone = phone; drawCircle(); toast('Profile saved');
  }

  // Shrink a picture to a 320px square JPEG before it's uploaded
  function squareJpeg(file){
    return new Promise((resolve, reject) => {
      const img = new Image(), src = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas');
        c.width = c.height = 320;
        c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 320, 320);
        URL.revokeObjectURL(src);
        c.toBlob(b => b ? resolve(b) : reject(new Error('No picture')), 'image/jpeg', .85);
      };
      img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('Not a picture')); };
      img.src = src;
    });
  }
  async function uploadPhoto(file, who){
    if (!file || !/^image\//.test(file.type)) { toast('Pick a picture (JPG or PNG).'); return; }
    let blob; try { blob = await squareJpeg(file); } catch(e) { toast('That picture couldn’t be opened. Try another one.'); return; }
    const agent = who !== 'me' ? agents.find(a => a.id === Number(who)) : null;
    const path = (agent ? 'agents/' + agent.id : T.user.id + '/me') + '-' + Date.now() + '.jpg';
    toast('Uploading…');
    const up = await db.storage.from('avatars').upload(path, blob, { contentType:'image/jpeg' });
    if (up.error) { toast('Couldn’t upload it. Try again.'); return; }
    const old = agent ? agent.photo_path : mine.photo;
    const { error } = agent
      ? await db.from('agents').update({ photo_path: path }).eq('id', agent.id)
      : await db.from('profiles').upsert({ user_id: T.user.id, photo_path: path, updated_at: new Date().toISOString() });
    if (error) { db.storage.from('avatars').remove([path]); toast('Couldn’t save the photo. Try again.'); return; }
    if (old) db.storage.from('avatars').remove([old]);
    if (agent) agent.photo_path = path; else { mine.photo = path; drawCircle(); }
    await loadPhotos(); drawBody(); toast('Photo updated');
  }
  async function removePhoto(){
    const old = mine.photo;
    const { error } = await db.from('profiles').upsert({ user_id: T.user.id, photo_path: null, updated_at: new Date().toISOString() });
    if (error) { toast('Couldn’t remove it. Try again.'); return; }
    if (old) db.storage.from('avatars').remove([old]);
    mine.photo = null; drawCircle(); await loadPhotos(); drawBody(); toast('Photo removed');
  }

  // ---------- Agents (owner) ----------
  async function loadAgents(){
    const [a, l, c, m] = await Promise.all([
      db.from('agents').select('id,name,active,role,phone,notes,photo_path,created_at,weekly_goal').order('id'),
      db.from('agent_companies').select('agent_id,company_id'),
      db.from('companies').select('id,name').order('name'),
      db.from('members').select('user_id,name,email,active,agent_id,created_at')
    ]);
    if (a.error) { agents = []; return false; }
    agents = a.data; links = l.data || []; cos = c.data || []; members = m.error ? [] : m.data;
    return true;
  }
  // The app login that belongs to an agent: linked to them, else one with the same name
  let members = [];
  const loginOf = a => members.find(x => x.agent_id === a.id) || members.find(x => !x.agent_id && key(x.name) === key(a.name)) || null;
  // Invites and sign-in links go through the same service as Invite and access
  async function callAccess(body){
    const { data, error } = await db.functions.invoke('team-access', { body });
    if (error) {
      let msg = 'Something went wrong. Try again.';
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch(e){}
      return { error: msg };
    }
    return data || {};
  }
  const linkOut = {}; // agent id → a sign-in link to copy or WhatsApp
  function loginBox(a){
    const m = loginOf(a), out = linkOut[a.id];
    const shown = out ? '<div class="linkout"><span class="note">' + esc(out.note) + '</span><input class="field" readonly value="' + esc(out.link) + '" aria-label="Sign-in link" />' +
      '<div class="acts"><button class="btn ghost small" type="button" data-copy-link="' + a.id + '">Copy link</button><a class="btn wa small" target="_blank" rel="noopener" href="' + esc(out.wa) + '">Send on WhatsApp</a></div></div>' : '';
    if (m && m.active) return '<div class="login-box"><b>App login</b><p class="note">Login: ' + esc(m.email || 'their email') + ', added ' + new Date(m.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) + '. If they never set a password or forgot it, send a sign-in link.</p>' +
      '<div class="acts"><button class="btn ghost small" type="button" data-a-link="' + a.id + '" data-via="email">Email a sign-in link</button><button class="btn ghost small" type="button" data-a-link="' + a.id + '" data-via="whatsapp">WhatsApp a sign-in link</button></div>' + shown + '</div>';
    if (m) return '<div class="login-box"><b>App login</b><p class="note">Their access was removed. Restore it from Invite and access in the menu.</p></div>';
    return '<form class="login-box" data-a-invite="' + a.id + '" novalidate><b>App login</b><p class="note">Give ' + esc(a.name.split(' ')[0]) + ' their own login for the clock, their history and payslips. Their earlier shifts join their history.</p>' +
      '<label class="label">Their email<input class="field" type="email" autocomplete="off" placeholder="name@example.com" /></label><p class="err"></p>' +
      '<div class="acts"><button class="btn small" type="submit" data-via="email">Email an invite</button><button class="btn wa small" type="submit" data-via="whatsapp">WhatsApp an invite link</button></div>' + shown + '</form>';
  }
  function showLinkOut(a, link, note){
    const first = a.name.split(' ')[0];
    const msg = 'Hi ' + first + ', here is your link for the Amr Abdelgawad Talents app: ' + link + '\n\nOpen it, choose a password, then add the app to your home screen. The link works once.';
    linkOut[a.id] = { link, note, wa:'https://wa.me/?text=' + encodeURIComponent(msg) };
  }
  const agentNo = a => pad2(a.id);
  const coNames = a => links.filter(x => x.agent_id === a.id).map(x => (cos.find(c => c.id === x.company_id) || {}).name).filter(Boolean);
  async function drawAgents(){
    const B = $('setBody');
    if (!await loadAgents()) { B.innerHTML = head('Agents') + '<p class="empty">Couldn’t load agents. Check your connection.</p>'; return; }
    B.innerHTML = '<div class="set-head row-head"><div><h3>Agents</h3><p class="note">Tap a name to change it. A new name also shows on their past shifts.</p></div><button class="btn small" type="button" data-add-agent>' + ICON.plus + 'Add agent</button></div>' +
      '<div class="ag-list">' + agents.map(a => {
        const open = agentOpen.has(a.id), names = coNames(a);
        return '<div class="ag' + (a.active ? '' : ' off') + '"><button type="button" class="ag-head" aria-expanded="' + open + '" data-toggle="' + a.id + '">' + avatar(a.name, photoUrl(a.photo_path), 38) +
          '<span class="ag-name"><b>' + agentNo(a) + ' · ' + esc(a.name) + '</b><small>' + esc(ROLES[a.role] || ROLES.member) + (names.length ? ' · ' + esc(names.join(', ')) : '') + ' · ' + (loginOf(a) && loginOf(a).active ? 'Has an app login' : 'No app login yet') + '</small></span>' +
          (a.active ? '' : '<span class="pill p-off">Off</span>') + ICON.chev + '</button>' +
          (open ? '<div class="ag-body"><div class="two">' +
            '<label class="label">Name<input class="field" maxlength="80" value="' + esc(a.name) + '" data-a-name="' + a.id + '" /></label>' +
            '<label class="label">Role<select class="field" data-a-role="' + a.id + '">' + Object.keys(ROLES).map(k => '<option value="' + k + '"' + (a.role === k ? ' selected' : '') + '>' + ROLES[k] + '</option>').join('') + '</select><small class="note">' + roleSees(a.role || 'member') + '</small></label>' +
            '<label class="label">Phone / WhatsApp<input class="field" maxlength="40" inputmode="tel" value="' + esc(a.phone || '') + '" data-a-phone="' + a.id + '" /></label>' +
            '<label class="label">Weekly goal (hours)<input class="field" type="number" min="1" max="120" step="0.5" inputmode="decimal" placeholder="No goal" value="' + (a.weekly_goal != null ? esc(String(Number(a.weekly_goal))) : '') + '" data-a-goal="' + a.id + '" /><small class="note">They see a progress bar under their clock. Leave empty for no goal.</small></label>' +
            '<div class="label">Works for<div class="chips">' + cos.map(c => '<button type="button" class="chip" aria-pressed="' + links.some(x => x.agent_id === a.id && x.company_id === c.id) + '" data-a-co="' + a.id + ':' + c.id + '">' + esc(c.name) + '</button>').join('') + '</div></div>' +
          '</div>' + loginBox(a) + '<div class="ag-foot"><button type="button" class="switch" role="switch" aria-checked="' + a.active + '" aria-label="' + esc(a.name) + ' active" data-a-active="' + a.id + '"></button><span>' + (a.active ? 'Active on /tracker' : 'Switched off') + '</span>' +
          '<label class="btn ghost small file-btn">' + ICON.cam + 'Photo<input type="file" accept="image/*" data-photo="' + a.id + '" hidden /></label>' +
          '<button class="btn ghost small" type="button" data-a-view="' + a.id + '">View profile</button></div></div>' : '') + '</div>';
      }).join('') + (agents.length ? '' : '<p class="empty">No agents yet. Add your first one.</p>') + '</div>' +
      '<p class="note">Switched-off agents drop out of the /tracker name list but keep their history. Numbers are never reused.</p>';
  }
  async function drawAgentProfile(){
    const B = $('setBody'), a = agents.find(x => x.id === agentView);
    if (!a) { agentView = null; return drawAgents(); }
    B.innerHTML = '<div><button class="btn ghost small" type="button" data-a-back>' + ICON.back + 'Agents</button></div>' +
      '<div class="photo-row">' + avatar(a.name, photoUrl(a.photo_path), 92) + '<div class="photo-side"><b class="big">' + agentNo(a) + ' · ' + esc(a.name) + '</b>' +
      '<div class="chips"><span class="pill p-pau">' + ROLES[a.role] + '</span>' + (a.active ? '' : '<span class="pill p-off">Switched off</span>') + coNames(a).map(n => '<span class="pill p-off">' + esc(n) + '</span>').join('') + '</div></div></div>' +
      '<div class="tiles four" id="agStats"><div class="tile"><p>Pay rate</p><strong class="num">…</strong></div><div class="tile"><p>Hours this month</p><strong class="num">…</strong></div><div class="tile in"><p>Earned this month</p><strong class="num">…</strong></div><div class="tile due"><p>Not paid yet</p><strong class="num">…</strong></div></div>' +
      '<div class="two"><div class="box"><div class="kv"><span>Phone</span><span>' + esc(a.phone || '—') + '</span></div><div class="kv"><span>Added</span><span>' + day(a.created_at.slice(0, 10)) + '</span></div><div class="kv"><span>Shifts this month</span><span id="agCount">…</span></div></div>' +
      '<div class="box" id="agRecent"><p class="note">Recent shifts</p></div></div>' +
      '<label class="label">Weekly goal (hours)<input class="field" type="number" min="1" max="120" step="0.5" inputmode="decimal" placeholder="No goal" value="' + (a.weekly_goal != null ? esc(String(Number(a.weekly_goal))) : '') + '" data-a-goal="' + a.id + '" /><small class="note">' + esc(a.name.split(' ')[0]) + ' sees a progress bar under their clock. Leave empty for no goal.</small></label>' +
      '<label class="label">Notes (only you see these)<textarea class="field" rows="3" maxlength="2000" data-a-notes="' + a.id + '" placeholder="e.g. strong on objections, prefers mornings">' + esc(a.notes || '') + '</textarea></label>' +
      '<div class="box" id="agSlips"><b>Payslips</b><p class="note">Upload each signed payslip (PDF or photo). ' + esc(a.name.split(' ')[0]) + ' sees them in the app as Cycle 1, Cycle 2…</p><div id="agSlipList"><p class="empty">Loading…</p></div>' +
        '<form class="form" id="slipAdd" data-agent="' + a.id + '" novalidate><div class="two"><label class="label">Cycle from<input class="field" type="date" id="psFrom" /></label><label class="label">Cycle to<input class="field" type="date" id="psTo" /></label></div>' +
        '<label class="label">Signed payslip (PDF, JPG or PNG, up to 10 MB)<input class="field" type="file" id="psFile" accept="application/pdf,image/jpeg,image/png,image/webp" /></label>' +
        '<label class="label">Note (optional, they see it)<input class="field" id="psNote" maxlength="300" placeholder="e.g. includes a $5 bonus" /></label>' +
        '<p class="err" id="psErr"></p><div><button class="btn small" type="submit">Upload payslip</button></div></form></div>' +
      '<div class="acts"><a class="btn ghost small" href="#team/' + encodeURIComponent(a.name) + '" data-close>Open all their hours</a></div>';
    drawAgentSlips(a);
    const { data } = await db.from('shifts').select('name,shift_date,work_seconds,pay_rate,paid').eq('owner', false).order('shift_date', { ascending:false }).limit(1000);
    if (agentView !== a.id || !data) return;
    const list = data.filter(s => key(s.name) === key(a.name)), month = today().slice(0, 7), now = list.filter(s => s.shift_date.slice(0, 7) === month);
    const val = s => s.work_seconds / 3600 * Number(s.pay_rate || 0), v = $('agStats').querySelectorAll('strong');
    v[0].textContent = list[0] && list[0].pay_rate != null ? usd(Number(list[0].pay_rate)) + '/h' : '—';
    v[1].textContent = hm(now.reduce((x, s) => x + s.work_seconds, 0));
    v[2].textContent = usd(now.reduce((x, s) => x + val(s), 0));
    v[3].textContent = usd(list.filter(s => !s.paid).reduce((x, s) => x + val(s), 0));
    $('agCount').textContent = now.length;
    $('agRecent').innerHTML = '<p class="note">Recent shifts</p>' + (list.length ? list.slice(0, 4).map(s => '<div class="kv"><span>' + day(s.shift_date) + '</span><span>' + hm(s.work_seconds) + (s.paid ? '' : ' · unpaid') + '</span></div>').join('') : '<p class="empty">No shifts yet.</p>');
  }
  // An agent's payslips in their profile: Cycle 1 is the oldest; open or delete each
  let agentSlips = [], slipDel = null;
  async function drawAgentSlips(a){
    const { data, error } = await db.from('payslips').select('id,period_start,period_end,file_path,file_type,note').eq('agent_id', a.id).order('period_start');
    if (agentView !== a.id || !$('agSlipList')) return;
    if (error) { $('agSlipList').innerHTML = '<p class="empty">Payslips aren’t set up yet. Run the latest SQL in Supabase.</p>'; return; }
    agentSlips = data;
    $('agSlipList').innerHTML = data.length ? data.map((p, i) => '<div class="slip-row"><span class="slip-ic" aria-hidden="true">' + (p.file_type === 'application/pdf' ? 'PDF' : 'IMG') + '</span><span class="n"><b>Cycle ' + (i + 1) + '</b><small>' + esc(cycleText(p)) + (p.note ? ' · ' + esc(p.note) : '') + '</small></span>' +
      '<span class="acts"><button class="btn ghost small" type="button" data-ps-open="' + p.id + '">Open</button>' +
      (slipDel === p.id ? '<button class="btn small danger" type="button" data-ps-del-yes="' + p.id + '">Yes, delete</button><button class="btn ghost small" type="button" data-ps-del-no>Keep</button>' : '<button class="btn ghost small" type="button" data-ps-del="' + p.id + '">Delete</button>') + '</span></div>').join('')
      : '<p class="empty">No payslips yet.</p>';
    // The next cycle starts the day after the last one ended
    if ($('psFrom') && !$('psFrom').value && data.length) { const d = new Date(data[data.length - 1].period_end + 'T00:00'); d.setDate(d.getDate() + 1); $('psFrom').value = iso(d); }
  }
  async function uploadSlip(form){
    const a = agents.find(x => x.id === Number(form.dataset.agent)), err = m => { $('psErr').textContent = m; };
    const from = $('psFrom').value, to = $('psTo').value, f = $('psFile').files[0], note = $('psNote').value.trim();
    if (!from || !to) return err('Pick the first and last day of the cycle.');
    if (to < from) return err('The cycle ends before it starts. Check the dates.');
    if (!f) return err('Choose the signed payslip file.');
    const TYPES = { 'application/pdf':'pdf', 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' };
    if (!TYPES[f.type]) return err('Use a PDF, JPG or PNG file.');
    if (f.size > 10 * 1024 * 1024) return err('That file is over 10 MB. Try a smaller scan or photo.');
    err('');
    const btn = form.querySelector('[type=submit]'); btn.setAttribute('aria-busy', 'true');
    const path = a.id + '/' + from + '_to_' + to + '-' + Date.now() + '.' + TYPES[f.type];
    const up = await db.storage.from('payslips').upload(path, f, { contentType: f.type });
    if (up.error) { btn.removeAttribute('aria-busy'); return err('Couldn’t upload the file. Try again.'); }
    const { error } = await db.from('payslips').insert({ agent_id: a.id, period_start: from, period_end: to, file_path: path, file_type: f.type, note: note || null });
    btn.removeAttribute('aria-busy');
    if (error) { db.storage.from('payslips').remove([path]); return err('Couldn’t save the payslip. Try again.'); }
    $('psFrom').value = ''; $('psTo').value = ''; $('psFile').value = ''; $('psNote').value = '';
    toast('Payslip added for ' + day(from) + ' – ' + day(to)); drawAgentSlips(a);
  }
  async function deleteSlip(id){
    const p = agentSlips.find(x => x.id === id), a = agents.find(x => x.id === agentView);
    const { error } = await db.from('payslips').delete().eq('id', id);
    slipDel = null;
    if (error) { toast('Couldn’t delete it. Try again.'); return drawAgentSlips(a); }
    if (p) db.storage.from('payslips').remove([p.file_path]);
    toast('Payslip deleted'); drawAgentSlips(a);
  }

  async function addAgent(){
    const name = await window.ask({ title:'Add an agent', input:{ label:'Their full name', placeholder:'First and last name', minLength:2, error:'Type their full name.' }, ok:'Add agent' });
    if (!name || name.trim().length < 2) return;
    const { data, error } = await db.from('agents').insert({ name: name.trim().replace(/\s+/g, ' ') }).select('id').single();
    if (error) { toast('Couldn’t add them. Try again.'); return; }
    agentOpen.add(data.id); toast('Agent ' + pad2(data.id) + ' added. Pick the company they work for.'); drawAgents();
  }

  // ---------- Dollar rates (owner) ----------
  let rates = [], delAsk = null;
  const rateOn = d => { let hit = null; rates.forEach(r => { if (r.from_date <= d) hit = r; }); return hit || rates[0] || null; };
  async function drawRates(){
    const B = $('setBody');
    const { data, error } = await db.from('fx_rates').select('*').order('from_date');
    if (error) { B.innerHTML = head('Dollar rates') + '<p class="empty">Dollar rates aren’t set up yet. Run the latest SQL in Supabase.</p>'; return; }
    rates = data.map(r => Object.assign(r, { rate: Number(r.rate) }));
    const cur = rateOn(today());
    const rows = rates.slice().reverse().map(r => {
      const next = rates[rates.indexOf(r) + 1];
      const to = next ? day(iso(new Date(new Date(next.from_date + 'T00:00').getTime() - 864e5))) : 'now';
      const from = r.from_date <= '2020-01-01' ? 'The start' : day(r.from_date);
      return '<div class="rate-row"><span class="rr-when"><b>' + from + ' → ' + to + '</b></span><input class="field" type="number" min="1" step="0.01" value="' + r.rate + '" data-r-edit="' + r.id + '" aria-label="Rate from ' + from + '" />' +
        (delAsk === r.id ? '<span class="acts"><button class="btn small danger" type="button" data-r-del-yes="' + r.id + '">Yes, delete</button><button class="btn ghost small" type="button" data-r-del-no>Keep</button></span>'
          : rates.length > 1 ? '<button class="btn ghost small" type="button" data-r-del="' + r.id + '">Delete</button>' : '<span></span>') + '</div>';
    }).join('');
    B.innerHTML = head('Dollar rates', 'Each rate counts from its date until the next one. When you add income or an expense, you pick which rate it uses, and it keeps that rate.') +
      '<div class="two"><div class="box hi"><p class="note">Rate in use today</p><strong class="big-num num">' + (cur ? cur.rate : '—') + '</strong><span class="note">EGP = $1' + (cur && cur.from_date > '2020-01-01' ? ' · since ' + day(cur.from_date) : '') + '</span></div>' +
      '<form class="box form" id="rateAdd" novalidate><b>Set a new rate</b><div class="two"><label class="label">From date<input class="field" type="date" id="nrDate" value="' + today() + '" /></label><label class="label">EGP per $1<input class="field" type="number" min="1" step="0.01" id="nrRate" placeholder="53.50" /></label></div><p class="err" id="nrErr"></p><div><button class="btn small" type="submit">Add rate</button></div></form></div>' +
      '<div class="box">' + rows + '</div>';
  }

  // ---------- events inside Settings ----------
  sheet.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    if (f.id === 'profForm') return saveProfile(f);
    if (f.id === 'slipAdd') return uploadSlip(f);
    if (f.dataset.aInvite) {
      const a = agents.find(x => x.id === Number(f.dataset.aInvite)), email = f.querySelector('input').value.trim(), err = f.querySelector('.err');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Type their full email, like name@example.com.'; return; }
      const co = links.find(x => x.agent_id === a.id);
      if (!co) { err.textContent = 'Pick the company they work for first (Works for, above).'; return; }
      // One login per email: say so plainly instead of a failed send
      const taken = members.find(x => (x.email || '').toLowerCase() === email.toLowerCase());
      if (taken) { err.textContent = 'That email already has a login (' + taken.name + (taken.active ? '' : ', access removed') + '). Use a different email, or ask Claude to move that login to ' + a.name.split(' ')[0] + '.'; return; }
      err.textContent = '';
      const btn = f.querySelector('[data-via="' + inviteVia + '"]'); btn.setAttribute('aria-busy', 'true');
      const r = await callAccess({ action:'invite', name:a.name, email, company_id: co.company_id, via: inviteVia });
      btn.removeAttribute('aria-busy');
      if (r.error) { err.textContent = r.error; return; }
      // Remember which agent this login belongs to (number, role, photo and payslips follow it)
      await db.from('members').update({ agent_id: a.id, access: ROLE_ACCESS[a.role || 'member'] }).ilike('email', email);
      const joined = r.linked_shifts ? ' ' + r.linked_shifts + ' earlier shift' + (r.linked_shifts === 1 ? '' : 's') + ' joined their history.' : '';
      if (r.sent) { delete linkOut[a.id]; toast('Invite emailed to ' + email + '.' + joined); }
      else if (r.link) { showLinkOut(a, r.link, 'Send this to ' + a.name.split(' ')[0] + '. It works once and expires in 24 hours.' + joined); toast('Invite link ready.' + joined); }
      T.agentsChanged(); return drawAgents();
    }
    if (f.id === 'pwChange') {
      const a = $('npw1').value, b = $('npw2').value, err = m => { $('npwErr').textContent = m; };
      if (a.length < 8) return err('Use at least 8 characters.');
      if (a !== b) return err('The two passwords don’t match.');
      const btn = f.querySelector('[type=submit]'); btn.setAttribute('aria-busy', 'true');
      const { error } = await db.auth.updateUser({ password: a });
      btn.removeAttribute('aria-busy');
      if (error) return err(/same/i.test(error.message) ? 'That’s your current password. Pick a new one.' : /reauth|recent/i.test(error.message) ? 'For safety, sign out and back in, then change it.' : 'Couldn’t change it. Try again.');
      $('npw1').value = ''; $('npw2').value = ''; toast('Password changed');
      return;
    }
    if (f.id === 'rateAdd') {
      const d = $('nrDate').value, r = parseFloat($('nrRate').value), err = m => { $('nrErr').textContent = m; };
      if (!d) return err('Pick the date the rate starts.');
      if (!(r > 0)) return err('Type the rate, like 53.50.');
      if (rates.some(x => x.from_date === d)) return err('A rate already starts that day. Change it in the list below.');
      const { error } = await db.from('fx_rates').insert({ from_date: d, rate: r });
      if (error) return err('Couldn’t save it. Try again.');
      toast('From ' + day(d) + ': ' + r + ' EGP = $1'); T.fxChanged(); drawRates();
    }
  });
  let inviteVia = 'email';
  sheet.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (b.type === 'submit' && d.via) { inviteVia = d.via; return; } // the form's submit handler sends it
    if ('unphoto' in d) return removePhoto();
    if (d.aLink) {
      const a = agents.find(x => x.id === Number(d.aLink)), m = loginOf(a);
      b.setAttribute('aria-busy', 'true');
      const r = await callAccess({ action:'link', user_id: m.user_id, via: d.via });
      b.removeAttribute('aria-busy');
      if (r.error) { toast(r.error); return; }
      if (r.sent) { toast('Sign-in link emailed to ' + m.email); return; }
      showLinkOut(a, r.link, 'A new sign-in link for ' + a.name.split(' ')[0] + ', for a forgotten password or a new phone. It works once and expires in an hour.');
      return drawAgents();
    }
    if (d.copyLink) {
      const out = linkOut[Number(d.copyLink)]; if (!out) return;
      try { await navigator.clipboard.writeText(out.link); toast('Link copied'); } catch(err) { const i = b.closest('.linkout').querySelector('input'); i.select(); toast('Press and hold to copy the link'); }
      return;
    }
    if (d.psOpen) { const p = agentSlips.find(x => x.id === Number(d.psOpen)); if (p) openSlip(p.file_path); return; }
    if (d.psDel) { slipDel = Number(d.psDel); return drawAgentSlips(agents.find(x => x.id === agentView)); }
    if ('psDelNo' in d) { slipDel = null; return drawAgentSlips(agents.find(x => x.id === agentView)); }
    if (d.psDelYes) return deleteSlip(Number(d.psDelYes));
    if ('backup' in d) { $('backupBtn').click(); return; }
    if ('addAgent' in d) return addAgent();
    if (d.toggle) { const id = Number(d.toggle); agentOpen.has(id) ? agentOpen.delete(id) : agentOpen.add(id); return drawAgents(); }
    if (d.aView) { agentView = Number(d.aView); return drawAgentProfile(); }
    if ('aBack' in d) { agentView = null; return drawAgents(); }
    if (d.aActive) {
      const a = agents.find(x => x.id === Number(d.aActive)), next = !a.active;
      const { error } = await db.from('agents').update({ active: next }).eq('id', a.id);
      if (error) { toast('Couldn’t change it. Try again.'); return; }
      toast(a.name + (next ? ' is back on /tracker' : ' was switched off')); T.agentsChanged(); return drawAgents();
    }
    if (d.aCo) {
      const [aid, cid] = d.aCo.split(':').map(Number), on = links.some(x => x.agent_id === aid && x.company_id === cid);
      const { error } = on ? await db.from('agent_companies').delete().eq('agent_id', aid).eq('company_id', cid) : await db.from('agent_companies').insert({ agent_id: aid, company_id: cid });
      if (error) { toast('Couldn’t change it. Try again.'); return; }
      return drawAgents();
    }
    if (d.rDel) { delAsk = Number(d.rDel); return drawRates(); }
    if ('rDelNo' in d) { delAsk = null; return drawRates(); }
    if (d.rDelYes) {
      const { error } = await db.from('fx_rates').delete().eq('id', Number(d.rDelYes));
      delAsk = null;
      toast(error ? 'Couldn’t delete it. Try again.' : 'Rate deleted. Entries already saved keep their own rate.');
      T.fxChanged(); return drawRates();
    }
  });
  sheet.addEventListener('change', async e => {
    const t = e.target, d = t.dataset;
    if (d.photo) { const f = t.files && t.files[0]; t.value = ''; return uploadPhoto(f, d.photo); }
    if (t.name === 'look') { const dark = t.value === 'dark'; if ((document.documentElement.getAttribute('data-theme') === 'dark') !== dark) { const tg = document.querySelector('.top [data-theme-toggle]'); if (tg) tg.click(); } return; }
    if (d.aName) {
      const a = agents.find(x => x.id === Number(d.aName)), v = t.value.trim().replace(/\s+/g, ' ');
      if (v === a.name) return;
      if (v.length < 2) { t.value = a.name; toast('A name needs at least 2 letters.'); return; }
      const { error } = await db.rpc('rename_agent', { p_id: a.id, p_name: v });
      if (error) { t.value = a.name; toast('Couldn’t rename them. Try again.'); return; }
      toast('Renamed to ' + v + ', past shifts too'); T.agentsChanged(); await loadPhotos(); return drawAgents();
    }
    if (d.aRole) {
      const a = agents.find(x => x.id === Number(d.aRole));
      const { error } = await db.from('agents').update({ role: t.value }).eq('id', a.id);
      if (error) { t.value = a.role; toast('Couldn’t change it. Try again.'); return; }
      // Their app login gets the sections that come with the role
      const m = loginOf(a);
      if (m) {
        const { error: e2 } = await db.from('members').update({ access: ROLE_ACCESS[t.value] }).eq('user_id', m.user_id);
        if (e2) { toast(a.name + ' is now ' + ROLES[t.value] + ', but their access couldn’t be changed. Set it in Invite and access.'); return drawAgents(); }
      }
      toast(a.name + ' is now ' + ROLES[t.value] + '. ' + roleSees(t.value)); return drawAgents();
    }
    if (d.aPhone) {
      const a = agents.find(x => x.id === Number(d.aPhone));
      const { error } = await db.from('agents').update({ phone: t.value.trim() || null }).eq('id', a.id);
      toast(error ? 'Couldn’t save the phone number.' : 'Phone saved'); if (!error) a.phone = t.value.trim() || null;
      return;
    }
    if (d.aGoal) {
      const a = agents.find(x => x.id === Number(d.aGoal)), raw = t.value.trim(), v = raw === '' ? null : Math.round(parseFloat(raw) * 2) / 2;
      if (v !== null && !(v >= 1 && v <= 120)) { t.value = a.weekly_goal != null ? Number(a.weekly_goal) : ''; toast('Type hours between 1 and 120, or leave it empty.'); return; }
      const { error } = await db.from('agents').update({ weekly_goal: v }).eq('id', a.id);
      if (error) { t.value = a.weekly_goal != null ? Number(a.weekly_goal) : ''; toast('Couldn’t save the goal. Try again.'); return; }
      a.weekly_goal = v; t.value = v == null ? '' : v;
      toast(v == null ? 'Weekly goal removed' : a.name.split(' ')[0] + '’s goal: ' + v + ' hours a week'); return;
    }
    if (d.aNotes) {
      const a = agents.find(x => x.id === Number(d.aNotes));
      const { error } = await db.from('agents').update({ notes: t.value.trim() || null }).eq('id', a.id);
      toast(error ? 'Couldn’t save the note.' : 'Note saved'); if (!error) a.notes = t.value.trim() || null;
      return;
    }
    if (d.rEdit) {
      const r = rates.find(x => x.id === Number(d.rEdit)), v = parseFloat(t.value);
      if (!(v > 0)) { t.value = r.rate; toast('Type a rate above 0.'); return; }
      const { error } = await db.from('fx_rates').update({ rate: v }).eq('id', r.id);
      if (error) { t.value = r.rate; toast('Couldn’t change it. Try again.'); return; }
      r.rate = v; toast('Rate changed to ' + v + '. Entries already saved keep their own rate.'); T.fxChanged(); return drawRates();
    }
  });
  sheet.addEventListener('click', e => { if (e.target.closest('a[data-close]')) closeSheet(); });
  // The app may have signed in before this file finished loading
  if (T.role && T.user) onSignedIn();
})();
