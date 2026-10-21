// Talents app: the account circle (My profile, Settings, Sign out), profile photos, and Settings.
// Settings shows what each person may use: everyone gets My profile, Password and Appearance;
// Amr also gets Agents, Dollar rates and Backup. The database decides what each person can really change.
(function(){
  const T = window.TalentsApp; if (!T) return;
  const { db, toast, esc, initials } = T;
  const $ = id => document.getElementById(id);
  const ROLES = { member:'Team member', operator:'Operator', leader:'Team leader' };
  const pad2 = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const today = () => iso(new Date());
  const usd = n => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const hm = s => Math.floor(s / 3600) + 'h ' + pad2(Math.floor(s % 3600 / 60)) + 'm';
  const day = d => new Date(d + 'T00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  const key = s => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const photoUrl = p => p ? db.storage.from('avatars').getPublicUrl(p).data.publicUrl : null;
  const avatar = (name, url, size) => '<span class="av"' + (size ? ' style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * .36) + 'px"' : '') + '>' +
    (url ? '<img src="' + esc(url) + '" alt="" />' : esc(initials(name))) + '</span>';
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
  function drawCircle(){
    const url = photoUrl(mine.photo), b = $('me');
    b.innerHTML = url ? '<img src="' + esc(url) + '" alt="" />' : esc(isOwner() ? 'A' : initials(myName()));
    b.classList.toggle('has-photo', !!url);
  }

  document.addEventListener('talents-signed-in', async () => {
    closeMenu(); closeSheet();
    await loadMine();
    if (isOwner()) await loadAgents();
    await loadPhotos();
  });

  // ---------- the menu under the circle ----------
  const menu = document.createElement('div');
  menu.className = 'acct-menu'; menu.id = 'acctMenu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
  document.body.appendChild(menu);
  function openMenu(){
    const role = isOwner() ? 'Owner' : ROLES[(myAgent() || {}).role || 'member'];
    menu.innerHTML = '<div class="who">' + avatar(myName(), photoUrl(mine.photo), 42) + '<div><b>' + esc(myName()) + '</b><small>' + esc(role) + '</small></div></div>' +
      '<button type="button" class="ai" role="menuitem" data-go="profile">' + ICON.user + 'My profile</button>' +
      '<button type="button" class="ai" role="menuitem" data-go="settings">' + ICON.gear + 'Settings</button>' +
      '<div class="sep"></div><button type="button" class="ai out" role="menuitem" data-go="out">' + ICON.out + 'Sign out</button>';
    menu.hidden = false; $('me').setAttribute('aria-expanded', 'true');
    menu.querySelector('.ai').focus();
  }
  function closeMenu(){ menu.hidden = true; $('me').setAttribute('aria-expanded', 'false'); }
  $('me').addEventListener('click', e => { e.stopPropagation(); menu.hidden ? openMenu() : closeMenu(); });
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
    const B = $('setBody'), own = isOwner(), url = photoUrl(mine.photo);
    const ag = myAgent();
    B.innerHTML = head('My profile') +
      '<div class="photo-row">' + avatar(myName(), url, 92) + '<div class="photo-side"><b class="big">' + esc(myName()) + '</b>' +
      '<div class="chips">' + (own ? '<span class="pill p-ok">Owner</span>' : '<span class="pill p-pau">' + ROLES[(ag || {}).role || 'member'] + '</span>' + (T.profile.company_name ? '<span class="pill p-off">' + esc(T.profile.company_name) + '</span>' : '')) + '</div>' +
      '<div class="acts"><label class="btn small file-btn">' + ICON.cam + 'Upload photo<input type="file" accept="image/*" data-photo="me" hidden /></label>' + (mine.photo ? '<button class="btn ghost small" type="button" data-unphoto>Remove</button>' : '') + '</div></div></div>' +
      (own ? '' : '<div class="tiles four" id="myStats"><div class="tile"><p>Pay rate</p><strong class="num">…</strong></div><div class="tile"><p>Hours this month</p><strong class="num">…</strong></div><div class="tile in"><p>Earned this month</p><strong class="num">…</strong></div><div class="tile due"><p>Not paid yet</p><strong class="num">…</strong></div></div>') +
      '<form class="form" id="profForm" novalidate><div class="two">' +
        '<label class="label">Name shown in the app<input class="field" id="pfName" maxlength="80" value="' + esc(myName()) + '"' + (own ? '' : ' readonly') + ' /></label>' +
        '<label class="label">Email (sign-in)<input class="field" value="' + esc(T.user.email || '') + '" readonly /></label>' +
        '<label class="label">Phone / WhatsApp<input class="field" id="pfPhone" maxlength="40" inputmode="tel" placeholder="+20 …" value="' + esc(mine.phone) + '" /></label>' +
        (own ? '' : '<label class="label">Role<input class="field" value="' + ROLES[(ag || {}).role || 'member'] + '" readonly /></label>') +
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
    const [a, l, c] = await Promise.all([
      db.from('agents').select('id,name,active,role,phone,notes,photo_path,created_at').order('id'),
      db.from('agent_companies').select('agent_id,company_id'),
      db.from('companies').select('id,name').order('name')
    ]);
    if (a.error) { agents = []; return false; }
    agents = a.data; links = l.data || []; cos = c.data || [];
    return true;
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
          '<span class="ag-name"><b>' + agentNo(a) + ' · ' + esc(a.name) + '</b><small>' + esc(ROLES[a.role] || ROLES.member) + (names.length ? ' · ' + esc(names.join(', ')) : '') + '</small></span>' +
          (a.active ? '' : '<span class="pill p-off">Off</span>') + ICON.chev + '</button>' +
          (open ? '<div class="ag-body"><div class="two">' +
            '<label class="label">Name<input class="field" maxlength="80" value="' + esc(a.name) + '" data-a-name="' + a.id + '" /></label>' +
            '<label class="label">Role<select class="field" data-a-role="' + a.id + '">' + Object.keys(ROLES).map(k => '<option value="' + k + '"' + (a.role === k ? ' selected' : '') + '>' + ROLES[k] + '</option>').join('') + '</select></label>' +
            '<label class="label">Phone / WhatsApp<input class="field" maxlength="40" inputmode="tel" value="' + esc(a.phone || '') + '" data-a-phone="' + a.id + '" /></label>' +
            '<div class="label">Works for<div class="chips">' + cos.map(c => '<button type="button" class="chip" aria-pressed="' + links.some(x => x.agent_id === a.id && x.company_id === c.id) + '" data-a-co="' + a.id + ':' + c.id + '">' + esc(c.name) + '</button>').join('') + '</div></div>' +
          '</div><div class="ag-foot"><button type="button" class="switch" role="switch" aria-checked="' + a.active + '" aria-label="' + esc(a.name) + ' active" data-a-active="' + a.id + '"></button><span>' + (a.active ? 'Active on /tracker' : 'Switched off') + '</span>' +
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
      '<label class="label">Notes (only you see these)<textarea class="field" rows="3" maxlength="2000" data-a-notes="' + a.id + '" placeholder="e.g. strong on objections, prefers mornings">' + esc(a.notes || '') + '</textarea></label>' +
      '<div><a class="btn ghost small" href="#team/' + encodeURIComponent(a.name) + '" data-close>Open all their hours</a></div>';
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
  sheet.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if ('unphoto' in d) return removePhoto();
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
      toast(a.name + ' is now ' + ROLES[t.value]); return drawAgents();
    }
    if (d.aPhone) {
      const a = agents.find(x => x.id === Number(d.aPhone));
      const { error } = await db.from('agents').update({ phone: t.value.trim() || null }).eq('id', a.id);
      toast(error ? 'Couldn’t save the phone number.' : 'Phone saved'); if (!error) a.phone = t.value.trim() || null;
      return;
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
})();
