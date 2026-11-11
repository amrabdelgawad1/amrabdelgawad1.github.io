// Round 9: two small pieces of the menu on /app.
// 1. The menu's groups (People, Numbers, Learning...) fold. Numbers, Money and Site start folded so the menu fits on
//    one screen; a tap on the heading opens or closes it, remembered on this device. The group holding the page you
//    are on is always open. Nothing is hidden for good: app.js still decides who sees which link.
// 2. On phones, a bottom tab bar with the main places (Portal, My hours or Team, Learning, Menu). It is built from
//    the links the menu already shows this person, so nobody gets a tab they can't open.
(function(){
  'use strict';
  const drawer = document.getElementById('drawer');
  if (!drawer) return;
  const KEY = 'p-nav-shut';
  let shut = null;
  try { shut = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e) {}
  if (!Array.isArray(shut)) shut = ['numbers', 'money', 'site'];

  const under = h => { const out = []; let n = h.nextElementSibling; while (n && !n.matches('.sec, .bottom')) { out.push(n); n = n.nextElementSibling; } return out; };
  function applyGroups(){
    drawer.querySelectorAll('.sec[data-nav]').forEach(h => {
      const rows = under(h);
      const here = rows.some(n => n.matches('.on') || n.querySelector('.on'));
      const isShut = shut.includes(h.dataset.nav) && !here;
      h.classList.toggle('is-shut', isShut);
      h.setAttribute('role', 'button'); h.tabIndex = 0;
      h.setAttribute('aria-expanded', String(!isShut));
      rows.forEach(n => n.classList.toggle('nav-shut', isShut));
    });
  }
  function toggle(h){
    const k = h.dataset.nav, open = h.classList.contains('is-shut');
    shut = shut.filter(x => x !== k); if (!open) shut.push(k);
    try { localStorage.setItem(KEY, JSON.stringify(shut)); } catch(e) {}
    applyGroups();
    if (!open) { h.classList.add('is-shut'); h.setAttribute('aria-expanded', 'false'); under(h).forEach(n => n.classList.add('nav-shut')); }
  }
  drawer.addEventListener('click', e => { const h = e.target.closest('.sec[data-nav]'); if (h) toggle(h); });
  drawer.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const h = e.target.closest('.sec[data-nav]'); if (h) { e.preventDefault(); toggle(h); }
  });

  // ---------- bottom tabs (phones; the CSS shows them at 640px and below) ----------
  const svg = d => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  const IC = {
    home: svg('<path d="M4 11l8-6.5 8 6.5"/><path d="M6 10v9.5h12V10"/>'),
    clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    team: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.2.1 3.8 1.6 4.5 4.3"/>'),
    book: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
    menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>')
  };
  const tabs = document.createElement('nav');
  tabs.className = 'p-tabs'; tabs.setAttribute('aria-label', 'Main'); tabs.hidden = true;
  document.body.appendChild(tabs);
  const shown = sel => { const a = drawer.querySelector(sel); return !!a && !a.hidden && !(a.closest('[data-sec]') || a).hidden; };
  let sig = '';
  function buildTabs(){
    const list = [];
    if (!drawer.hidden) {
      const owner = shown('a[href="#admin"]');
      if (owner) list.push(['#admin', 'Portal', 'home', ['#admin', '#portal']]);
      else if (shown('a[href="#home"]')) list.push(['#home', 'Portal', 'home', ['#home']]);
      if (owner && shown('a[href="#teamview"]')) list.push(['#teamview', 'Team', 'team', ['#teamview', '#live', '#team']]);
      else if (shown('a[href="#track"]')) list.push(['#track', 'My hours', 'clock', ['#track']]);
      if (shown('a[href="/app/learn/"]')) list.push(['/app/learn/', 'Learning', 'book', []]);
    }
    const on = list.length >= 2;
    const next = on ? list.map(t => t[0]).join('|') : '';
    if (next !== sig) {
      sig = next;
      tabs.innerHTML = !on ? '' : list.map(t => '<a class="p-tab" href="' + t[0] + '" data-on="' + t[3].join(' ') + '">' + IC[t[2]] + '<span>' + t[1] + '</span></a>').join('') +
        '<button class="p-tab" type="button" data-menu>' + IC.menu + '<span>Menu</span></button>';
      tabs.hidden = !on;
      document.body.classList.toggle('has-tabs', on);
    }
    const hash = (location.hash || '').split('/')[0];
    tabs.querySelectorAll('a.p-tab').forEach(a => {
      if ((a.dataset.on || '').split(' ').includes(hash)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  tabs.addEventListener('click', e => {
    if (!e.target.closest('[data-menu]')) return;
    const b = document.getElementById('burger'); if (b) b.click();
  });

  let t = 0;
  const refresh = () => { clearTimeout(t); t = setTimeout(() => { applyGroups(); buildTabs(); }, 30); };
  new MutationObserver(refresh).observe(drawer, { attributes:true, attributeFilter:['hidden', 'class'], subtree:true });
  addEventListener('hashchange', refresh);
  refresh();
})();

// Round 10: related pages are grouped. The menu shows one entry per group, and the pages of the group become tabs at
// the top of each of them. Nothing is removed: every page keeps its address (#requests, #schedule...), app.js still
// decides who can see what, and a tab only shows when its page's menu link is there for this person.
(function(){
  'use strict';
  const drawer = document.getElementById('drawer');
  if (!drawer) return;
  const GROUPS = [
    { lead:'#team', label:'Team and shifts', tabs:[['#team','Team hours'], ['#mytime','My time'], ['#requests','Requests'], ['#schedule','Schedule and time off']] },
    { lead:'#weekly', label:'Numbers', tabs:[['#weekly','Weekly summary'], ['#leaderboard','Leaderboard'], ['#funnel','Calls to deals'], ['#scripttest','Script testing'], ['#lists','Lead lists'], ['#profit','Profit per client'], ['#clientreport','Client report']] },
    { lead:'#people', label:'People and access', tabs:[['#people','People and access'], ['#person','Person files'], ['#applications','Applicants'], ['#onboarding','Onboarding'], ['#offboarding','Offboarding'], ['#referrals','Refer a friend']] },
    { lead:'#tasks', label:'Work', owner:true, tabs:[['#tasks','Tasks'], ['#messages','Messages'], ['#handbook','Handbook']] },
    { lead:'#review', label:'Reviews and scoring', tabs:[['#review','To score'], ['#scoring','Call scoring'], ['#progress','Learner progress'], ['#cotw','Call of the week'], ['#builder','Course builder']] },
    { lead:'#announcements', label:'Team updates', tabs:[['#announcements','Announcements'], ['#coaching','Coaching']] },
    { lead:'#overview', label:'Cash', tabs:[['#overview','Overview'], ['#income','Income'], ['#expense','Expenses'], ['#invoices','Invoices'], ['#receipts','Receipts'], ['#forecast','Forecast']] },
    { lead:'#visits', label:'Site and logs', tabs:[['#visits','Visits'], ['#emails','Team emails'], ['#whatsnew','What’s new'], ['#logs','Logs']] }
  ];
  const link = h => drawer.querySelector('.mi[href="' + h + '"]');
  const row = a => a && (a.closest('.mi-row') || a);
  const can = h => { const a = link(h), r = row(a); return !!a && !a.hidden && !(r && r.hidden) && !(r && r.closest('[hidden]') && r.closest('[hidden]') !== drawer); };
  // a page can sit in two places only once: if the lead is hidden for this person, the first page they can see leads
  function tidy(){
    const owner = (window.TalentsApp || {}).role === 'owner';
    // the team's menu is one plain list: no headings, nothing folded into groups (round 11)
    drawer.classList.toggle('is-flat', !owner && (window.TalentsApp || {}).role === 'member');
    GROUPS.forEach(g => {
      const seen = owner || !g.owner ? g.tabs.filter(t => can(t[0])) : [];
      const leadH = seen.length ? (can(g.lead) ? g.lead : seen[0][0]) : null;
      g.tabs.forEach(t => { const r = row(link(t[0])); if (r) r.classList.toggle('nav-grouped', !!leadH && t[0] !== leadH); });
      const la = leadH && link(leadH);
      if (la) {
        // the link's own words are its last text node that isn't inside a count bubble
        const tn = [...la.childNodes].reverse().find(n => n.nodeType === 3 && n.textContent.trim());
        if (tn) { if (!la.dataset.orig) la.dataset.orig = tn.textContent; tn.textContent = seen.length > 1 ? g.label : la.dataset.orig; }
      }
      g.on = leadH; g.seen = seen;
    });
    // a menu heading with nothing left under it (Numbers, now inside Team and shifts) hides
    drawer.querySelectorAll('.sec[data-nav]').forEach(h => {
      let n = h.nextElementSibling, any = false;
      while (n && !n.matches('.sec, .bottom')) { if (!n.hidden && !n.classList.contains('nav-grouped') && n.matches('.mi, .mi-row')) any = true; n = n.nextElementSibling; }
      h.classList.toggle('nav-grouped', !any);
    });
  }
  // the tab row, shared by every page; it sits above whichever page is open
  const bar = document.createElement('nav');
  bar.className = 'p-ptabs'; bar.setAttribute('aria-label', 'Pages in this section'); bar.hidden = true;
  const anchor = document.getElementById('pView');
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(bar, anchor);
  function draw(){
    tidy();
    const here = (location.hash || '').split('/')[0];
    const g = GROUPS.find(x => x.seen && x.seen.length > 1 && x.seen.some(t => t[0] === here));
    document.body.classList.toggle('has-ptabs', !!g);
    bar.hidden = !g;
    if (!g) return;
    bar.innerHTML = '<span class="p-ptabs-t">' + g.label + '</span><div class="p-ptabs-row">' + g.seen.map(t => '<a href="' + t[0] + '"' + (t[0] === here ? ' aria-current="page"' : '') + '>' + t[1] + '</a>').join('') + '</div>';
    const cur = bar.querySelector('[aria-current]'), rowEl = bar.querySelector('.p-ptabs-row'); if (cur && rowEl) rowEl.scrollLeft = Math.max(0, cur.offsetLeft - 24);
    // the group's menu entry stays lit on all of its pages
    drawer.querySelectorAll('.mi.grp-on').forEach(a => a.classList.remove('grp-on'));
    const la = g.on && link(g.on); if (la && g.on !== here) la.classList.add('grp-on');
  }
  let t = 0;
  const later = () => { clearTimeout(t); t = setTimeout(draw, 40); };
  new MutationObserver(later).observe(drawer, { attributes:true, attributeFilter:['hidden'], subtree:true });
  addEventListener('hashchange', later);
  later();
})();
