// Portal shell: the same top bar on every signed-in page (logo, page name, Apps menu, the person's initials and name).
// Each page keeps its own header element and controls (course menu button, search, progress, language, "View as learner");
// the shell adds its pieces around them, so the pages' own scripts keep working by id.
//
//   PortalShell.start({
//     db,            the page's own Supabase client (the shell never makes one, never signs anyone in or out by itself)
//     header,        the page's header element
//     page,          which app this is, so the Apps menu marks it: hours | deals | calc | learn | review | team | people | cash
//     brand,         an element in the header to keep as the logo and name (course pages); otherwise the shell draws "A" + name
//     name,          the page name when the shell draws the brand (an element to reuse, or text)
//     hide,          elements the bar replaces (for example "Back to app" links); hidden, not removed, so page scripts still find them
//     me,            an existing account button to keep (it keeps its own menu); otherwise the shell adds one with
//                    "Go to the app" and "Sign out"
//     admin,         true on the owner's /app page: shows the orange ADMIN label
//     test           test mode: { role, keys, needs_code, name, counts:{ review, requests } } instead of asking the database
//   })
// window.PORTAL_TEST (same shape as test) overrides everything, for checks without signing in (tools/portal-dev).
//
// The Apps menu lists only what this person can open: portal_me() from supabase/migrations/20261030120000_portal_roles.sql.
// Hiding is for tidiness; the database checks every page and table again. Counts show only to people allowed to see them.
// Styles: /portal.css (.p-*). No inline styles anywhere: /course/ forbids them.
(function(){
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const svg = d => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  const IC = {
    apps:svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
    clock:svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    house:svg('<path d="M4 11l8-6.5 8 6.5"/><path d="M6 10v9.5h12V10"/>'),
    calc:svg('<rect x="6" y="3.5" width="12" height="17" rx="2"/><path d="M9 7.5h6M9 11.5h6M9 15.5h3"/>'),
    book:svg('<path d="M5 5.5h14v10H9l-4 3.5z"/>'),
    mic:svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
    person:svg('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5"/>'),
    invite:svg('<circle cx="10" cy="8.5" r="3.5"/><path d="M3.5 20c1-3.6 3.6-5.5 6.5-5.5 1.6 0 3 .5 4.2 1.4M18 9v6M15 12h6"/>'),
    cash:svg('<rect x="3" y="6.5" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.5"/>')
  };
  const COURSE_KEYS = ['course', 'mkt', 'psy'];

  // Every app, in the menu's order. can(me) decides if it's listed; needs = keys that open it (for "Needs your code").
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const APPS = [
    { id:'hours', group:'Work', name:'My hours', sub:'Clock in, shifts and requests', href:'/app/#track', icon:'clock', can:me => me.role !== 'owner' },
    { id:'deals', group:'Work', name:'Deal CRM', sub:'Leads, deals and follow-ups', href:'/app/deals/', icon:'house', needs:['deals'] },
    { id:'calc', group:'Work', name:'Land calculator', sub:'Opens in its own look', href:'/land-calculator/', icon:'calc', needs:['deals'] },
    { id:'calc-house', group:'Work', name:'House calculator', sub:'Opens in its own look', href:'/house-calculator/', icon:'calc', needs:['deals'] },
    { id:'learn', group:'Learning', name:'Learning Hub', sub:me => me.role === 'owner' ? 'All 3 courses' : 'Your courses and progress', href:'/app/learn/', icon:'book',
      can:me => me.role === 'owner' || me.keys.includes('learn') || COURSE_KEYS.some(k => me.keys.includes(k)) },
    { id:'review', group:'Learning', name:'Review center', sub:'Recordings and drills', href:'/app/#review', icon:'mic', can:me => me.role === 'owner',
      count:c => c.review ? { text:c.review + ' waiting' } : null },
    { id:'team', group:'Team', name:'Team and shifts', sub:'Live now, hours, requests', icon:'person', needs:['live', 'requests', 'team'], any:true,
      href:me => me.keys.includes('live') ? '/app/#live' : me.keys.includes('requests') ? '/app/#requests' : '/app/#team',
      count:(c, me) => c.requests && (me.role === 'owner' || me.keys.includes('requests')) ? { text:plural(c.requests, 'request', 'requests') } : null },
    { id:'people', group:'Team', name:'Invite and access', sub:'Who sees which area and course', href:'/app/#people', icon:'invite', can:me => me.role === 'owner' },
    { id:'cash', group:'Money', name:'Cash', sub:'Income, expenses, profit', href:'/app/#overview', icon:'cash', can:me => me.role === 'owner', note:'Only you' }
  ];
  const GROUPS = ['Work', 'Learning', 'Team', 'Money'];

  let me = null, counts = {}, opts = null, bars = [], loading = null, page = '';

  function listed(a){
    if (!me) return false;
    if (a.can) return a.can(me);
    if (me.role === 'owner') return true;
    return a.any ? a.needs.some(k => me.keys.includes(k)) : a.needs.every(k => me.keys.includes(k));
  }
  // "Needs your code": every key that would open it is still waiting on the authenticator
  const waitsForCode = a => me && me.role !== 'owner' && a.needs && a.needs.filter(k => me.keys.includes(k)).every(k => (me.needs_code || []).includes(k));
  const val = (v, ...args) => typeof v === 'function' ? v(...args) : v;
  const initials = n => String(n || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

  // ---------- data ----------
  async function load(){
    const t = window.PORTAL_TEST || (opts && opts.test);
    if (t) {
      me = { role:t.role || 'agent', keys:t.keys || (t.role === 'owner' ? ['course','deals','learn','live','mkt','money','psy','requests','team'] : ['course','deals','learn']),
        needs_code:t.needs_code || [], name:t.name || (t.role === 'owner' ? 'Amr' : 'Team member') };
      counts = t.counts || {};
      return;
    }
    const db = opts.db;
    const r = await db.rpc('portal_me');
    if (r.error || !r.data) { me = null; return; }
    me = Object.assign({ keys:[], needs_code:[] }, r.data);
    if (me.role === 'owner') me.name = opts.ownerName || 'Amr';
    drawAll();
    // Counts, only for people allowed to see them (the database refuses the rest anyway)
    const jobs = [];
    if (me.role === 'owner') jobs.push(Promise.all([
      db.from('hub_uploads').select('id', { count:'exact', head:true }).eq('status', 'waiting').then(x => x, () => ({})),
      db.rpc('course_admin_waiting').then(x => x, () => ({}))
    ]).then(([u, w]) => { counts.review = (u.count || 0) + ((w && Array.isArray(w.data)) ? w.data.length : 0); }));
    if (me.role === 'owner' || me.keys.includes('requests')) jobs.push(
      db.from('shift_requests').select('id', { count:'exact', head:true }).eq('status', 'pending').then(x => { counts.requests = x.count || 0; }, () => {}));
    await Promise.all(jobs).catch(() => {});
  }

  // ---------- drawing ----------
  function appsHtml(){
    const groups = GROUPS.map(g => {
      const items = APPS.filter(a => a.group === g && listed(a));
      if (!items.length) return '';
      return '<section class="p-apps-group" aria-label="' + esc(g) + '"><p class="p-apps-h" role="heading" aria-level="3">' + esc(g) + '</p>' + items.map(a => {
        const c = a.count ? a.count(counts, me) : null, code = waitsForCode(a);
        const right = code ? '<span class="p-pill is-plain">Needs your code</span>' : c ? '<span class="p-pill">' + esc(c.text) + '</span>' : a.note ? '<span class="p-app-note">' + esc(a.note) + '</span>' : '';
        return '<a class="p-app" href="' + esc(val(a.href, me)) + '"' + (a.id === page ? ' aria-current="page"' : '') + '>' +
          '<span class="p-ic">' + IC[a.icon] + '</span><span class="p-app-txt"><b>' + esc(a.name) + '</b><small>' + esc(val(a.sub, me)) + '</small></span>' + right + '</a>';
      }).join('') + '</section>';
    }).join('');
    return '<div class="p-apps-head"><p class="p-apps-title" role="heading" aria-level="2">Go to</p><a href="/app/">Portal home</a></div>' +
      '<div class="p-apps-grid">' + groups + '</div>' +
      (me.role === 'owner' ? '<p class="p-apps-foot">Team members only see the apps you switched on for them in Invite and access.</p>' : '');
  }
  function total(){
    // the dot on the Apps button: things waiting that this person handles
    let n = 0;
    APPS.forEach(a => { if (listed(a) && a.count) { const c = a.count(counts, me); if (c) n++; } });
    return n;
  }

  function mount(header, o){
    if (!header || header.dataset.portal) return;
    header.dataset.portal = '1';
    header.classList.add('p-shelled');
    const b = { header, o };
    // brand: the page's own (course pages), or the shell's "A" + page name
    if (o.brand) { b.brand = o.brand; o.brand.classList.add('p-brand-keep'); }
    else {
      const a = document.createElement('a'); a.className = 'p-brand'; a.href = '/app/';
      a.innerHTML = '<span class="p-logo" aria-hidden="true">A</span>';
      const name = o.name && o.name.nodeType ? o.name : Object.assign(document.createElement('span'), { textContent:o.name || 'Portal' });
      name.classList.add('p-name');
      const lead = o.lead || null;   // a button that stays first (the /app menu button)
      if (lead && lead.parentNode === header) lead.after(a); else header.prepend(a);
      a.after(name);
      b.brand = name; b.logo = a;
    }
    let after = b.brand;
    if (o.admin) {
      const tag = document.createElement('span'); tag.className = 'p-admin-tag'; tag.textContent = 'Admin';
      after.after(tag); after = tag;
    }
    // Apps button and menu
    const wrap = document.createElement('div'); wrap.className = 'p-apps-wrap';
    const id = 'pApps' + (bars.length + 1);
    wrap.innerHTML = '<button type="button" class="p-apps-btn" aria-expanded="false" aria-controls="' + id + '" aria-haspopup="true">' + IC.apps + '<span class="p-apps-label">Apps</span><span class="p-dot" hidden></span></button>' +
      '<nav class="p-apps" id="' + id + '" aria-label="Apps" hidden></nav>';
    after.after(wrap);
    b.btn = wrap.querySelector('button'); b.menu = wrap.querySelector('nav');
    b.btn.addEventListener('click', () => toggle(b, b.menu.hidden));
    b.menu.addEventListener('click', e => { if (e.target.closest('a')) toggle(b, false); });
    (o.hide || []).forEach(el => { if (el) { el.hidden = true; el.classList.add('p-replaced'); } });
    // me: the page's own account button (it keeps its menu), or the shell's
    if (o.me) {
      b.meName = document.createElement('span'); b.meName.className = 'p-me-name';
      o.me.classList.add('p-me-keep'); o.me.after(b.meName);
    } else {
      const m = document.createElement('div'); m.className = 'p-me-wrap';
      m.innerHTML = '<button type="button" class="p-me" aria-haspopup="true" aria-expanded="false"><span class="p-av"></span><span class="p-me-name"></span></button>' +
        '<div class="p-menu" hidden><a href="/app/">Go to the app</a><button type="button" data-out>Sign out</button></div>';
      header.append(m);
      b.meBtn = m.querySelector('.p-me'); b.meMenu = m.querySelector('.p-menu'); b.meName = m.querySelector('.p-me-name'); b.meAv = m.querySelector('.p-av');
      b.meBtn.addEventListener('click', () => meMenu(b, b.meMenu.hidden));
      b.meMenu.querySelector('[data-out]').addEventListener('click', async () => {
        try { if (o.db) await o.db.auth.signOut(); } catch(e){}
        location.href = '/app/';
      });
    }
    bars.push(b);
    draw(b);
  }
  function draw(b){
    const ok = !!me;
    b.btn.parentElement.hidden = !ok;
    if (!ok) return;
    b.menu.innerHTML = appsHtml();
    b.btn.querySelector('.p-dot').hidden = !total();
    b.btn.setAttribute('aria-label', 'Apps' + (total() ? ', something is waiting' : ''));
    if (b.meName) b.meName.textContent = me.name || '';
    if (b.meAv) b.meAv.textContent = me.role === 'owner' ? 'AA' : initials(me.name);
    if (b.meBtn) b.meBtn.setAttribute('aria-label', 'Your account' + (me.name ? ': ' + me.name : ''));
  }
  const drawAll = () => bars.forEach(draw);

  function toggle(b, open){
    if (open) closeAll();
    b.menu.hidden = !open; b.btn.setAttribute('aria-expanded', open);
    if (open) { const first = b.menu.querySelector('[aria-current="page"]') || b.menu.querySelector('a'); if (first) first.focus(); }
  }
  function meMenu(b, open){
    if (open) closeAll();
    b.meMenu.hidden = !open; b.meBtn.setAttribute('aria-expanded', open);
    if (open) b.meMenu.querySelector('a').focus();
  }
  function closeAll(focusBack){
    bars.forEach(b => {
      if (!b.menu.hidden) { b.menu.hidden = true; b.btn.setAttribute('aria-expanded', 'false'); if (focusBack) b.btn.focus(); }
      if (b.meMenu && !b.meMenu.hidden) { b.meMenu.hidden = true; b.meBtn.setAttribute('aria-expanded', 'false'); if (focusBack) b.meBtn.focus(); }
    });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(true); });
  document.addEventListener('click', e => { if (!e.target.closest('.p-apps-wrap, .p-me-wrap')) closeAll(false); });

  window.PortalShell = {
    // First call: draws the bar and loads who this is. Later calls with another header (a page that rebuilds its frame) reuse the data.
    start(o){
      opts = Object.assign({}, opts || {}, o);
      if (o.page) page = o.page;
      mount(o.header, o);
      if (!loading) loading = load().then(drawAll, () => {});
      return loading;
    },
    // The page moved to another app (/app's hash routes)
    setPage(p){ page = p || ''; drawAll(); },
    // A page that already counted something tells the bar (no second query): setCount('requests', 2), setCount('review', 4)
    setCount(name, n){ counts[name] = Number(n) || 0; drawAll(); },
    // Counts changed (a request was decided, a review approved)
    async refresh(){ if (!opts) return; loading = load().then(drawAll, () => {}); return loading; },
    get me(){ return me; }
  };
})();
