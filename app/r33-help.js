// Round 33 part 1 of the Portal Master Feature Plan (Nov 22 2026): P2 help center.
//   #help              the help center: search, articles grouped by area, "Start here" for new people
//   #help/<slug>       one article
//   #help/for/<page>   the article for a page (what the ? button in the top bar opens from pages outside /app)
//   #helpedit          Amr only: write, edit, hide and delete articles, pick who sees each one and which pages'
//                      ? button opens it, with version history like the Handbook (put an older version back)
//   PortalHelp.open(page)   the ? button on /app: the page's article in a side panel, without leaving the page
//   R33Help.search(db)      help articles in global search (team-plus.js buildIndex)
// Who sees what: the database decides (help_articles rules: owner-only articles and articles that need an access
// key the person doesn't have never reach their browser). On top of that, a team member only sees articles for
// pages they can open. Database: help_articles, help_article_versions (+ trigger help_keep_version).
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, $, esc, safe, isOwner, fmtDay, fmtTime, plural, card, empty, failed, pill, f, opt, errText } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const ar = () => !!(window.AppLang && window.AppLang.lang === 'ar');
  const when = t => fmtDay(t, { month:'short', day:'numeric', year:'numeric' }) + ', ' + fmtTime(t);
  const AREAS = ['Getting started', 'Team and shifts', 'Payroll and Earnings', 'My lists and calling', 'Deal CRM', 'Contracts', 'Learning Hub', 'Files', 'Messages and the bell', 'Me area', 'Settings and Devices', 'Cash and clients'];
  // Access keys an article can ask for (Invite and access switches)
  const KEYS = [['team', 'Team'], ['live', 'Live now'], ['requests', 'Missed-shift requests'], ['teamview', 'Team overview (managers)'], ['deals', 'Deal tools'], ['learn', 'Learning Hub'], ['course', 'Acquisitions course'], ['mkt', 'Marketing course'], ['psy', 'Psychology course'], ['voice', 'Voice Studio']];
  // Pages that aren't links in the menu
  const EXTRA = [['home', 'Team home'], ['admin', 'Command center'], ['app:deals', 'Deal CRM'], ['app:learn', 'Learning Hub and courses'], ['app:calc', 'Land and house calculators'], ['settings', 'Settings'], ['devices', 'Settings, Devices'], ['install', 'Putting the portal on a phone'], ['search', 'Search'], ['help', 'Help center']];
  const ALWAYS = ['home', 'settings', 'devices', 'install', 'search', 'help'];

  // ---------- which pages this person can open ----------
  const drawer = () => $('drawer');
  function menuLink(href){
    const d = drawer(); if (!d || d.hidden) return null;
    const a = d.querySelector('.mi[href="' + href + '"]'); if (!a) return null;
    const r = a.closest('.mi-row') || a;
    return a.hidden || r.hidden ? null : a;
  }
  function canOpen(key){
    if (isOwner()) return true;
    if (ALWAYS.includes(key)) return true;
    if (key === 'app:deals' || key === 'app:calc') return !!menuLink('/app/deals/') || !!menuLink('/land-calculator/');
    if (key === 'app:learn') return !!menuLink('/app/learn/');
    if (key === 'admin' || key === 'portal') return false;
    return !!menuLink('#' + key);
  }
  const shows = a => isOwner() || !(a.pages || []).length || a.pages.some(canOpen);

  // ---------- articles ----------
  let cache = null, cacheAt = 0;
  async function load(force){
    if (!force && cache && Date.now() - cacheAt < 60000) return cache;
    const r = await safe(db().from('help_articles').select('id,slug,area,title,summary,body,title_ar,summary_ar,body_ar,pages,needs,owner_only,sort,published,updated_at').order('sort').order('title'));
    if (r.error) return { error:r.error };
    cache = { list:r.data || [] }; cacheAt = Date.now();
    return cache;
  }
  const visible = list => list.filter(a => (a.published || isOwner()) && shows(a));
  const tx = (a, k) => (ar() && a[k + '_ar']) || a[k] || '';
  // The best article for a page: for Amr, his own (owner-only) article first, then one for a given access, then the rest
  function forPage(list, key){
    const c = visible(list).filter(a => a.published && (a.pages || []).includes(key));
    if (!c.length) return null;
    const rank = a => isOwner() ? (a.owner_only ? 0 : (a.needs || []).length ? 1 : 2) : 0;
    return c.sort((a, b) => rank(a) - rank(b) || a.sort - b.sort)[0];
  }

  // ---------- the article body: ## headings, - bullets, 1. steps, [links](#page), empty line between paragraphs ----------
  const safeHref = u => /^#[a-z0-9\/_-]*$/i.test(u) || /^\/(?![\/\\])[a-z0-9\/_.#=-]*$/i.test(u) ? u : '';
  const inline = s => esc(s).replace(/\[([^\]]{1,80})\]\(([^)\s]{1,120})\)/g, (m, t, u) => { const h = safeHref(u.replace(/&amp;/g, '&')); return h ? '<a href="' + esc(h) + '">' + t + '</a>' : t; });
  function render(text){
    const out = []; let list = null, para = [];
    const endPara = () => { if (para.length) { out.push('<p>' + para.join(' ') + '</p>'); para = []; } };
    const endList = () => { if (list) { out.push('<' + list.tag + '>' + list.items.map(i => '<li>' + i + '</li>').join('') + '</' + list.tag + '>'); list = null; } };
    String(text || '').split('\n').forEach(raw => {
      const l = raw.trim();
      if (!l) { endPara(); endList(); return; }
      let m;
      if ((m = l.match(/^#{2,3}\s+(.*)$/))) { endPara(); endList(); out.push('<h3>' + inline(m[1]) + '</h3>'); return; }
      if ((m = l.match(/^[-*]\s+(.*)$/)) || (m = l.match(/^\d+[.)]\s+(.*)$/))) {
        const tag = /^\d/.test(l) ? 'ol' : 'ul';
        endPara(); if (list && list.tag !== tag) endList();
        if (!list) list = { tag, items:[] };
        list.items.push(inline(m[1])); return;
      }
      endList(); para.push(inline(l));
    });
    endPara(); endList();
    return '<div class="r33-body">' + out.join('') + '</div>';
  }
  const areaOf = a => tx(a, 'area') || a.area;

  // Links inside an article: #settings opens Settings; the rest are ordinary links
  function wireLinks(box, after){
    box.addEventListener('click', e => {
      const a = e.target.closest('.r33-body a[href]'); if (!a) return;
      const h = a.getAttribute('href');
      if (h === '#settings' || h === '#devices') { e.preventDefault(); if (after) after(); const b = $('mcSettings'); if (b) b.click(); return; }
      if (after) after();
    });
  }

  // ======================================================================
  // #help: the help center
  // ======================================================================
  function articleHtml(a, list){
    const same = visible(list).filter(x => x.id !== a.id && x.published && x.area === a.area);
    return '<article class="p-card r33-art">' +
      '<p class="r33-crumb"><a href="#help">Help center</a> › ' + esc(areaOf(a)) + (!a.published ? ' ' + pill('Hidden from the team', 'plain') : a.owner_only ? ' ' + pill('Only you', 'plain') : '') + '</p>' +
      '<h2 class="r33-h">' + esc(tx(a, 'title')) + '</h2>' + (tx(a, 'summary') ? '<p class="r33-sum">' + esc(tx(a, 'summary')) + '</p>' : '') +
      render(tx(a, 'body')) +
      '<p class="p-hint r33-upd">Last updated ' + esc(when(a.updated_at)) + '</p>' +
      (isOwner() ? '<p class="wk-row"><a class="p-btn is-ghost" href="#helpedit/' + a.id + '">Edit this article</a></p>' : '') +
      '</article>' +
      (same.length ? card('More in ' + areaOf(a), '', same.map(x => '<a class="p-row r33-link" href="#help/' + esc(x.slug) + '"><span><b>' + esc(tx(x, 'title')) + '</b><br><small>' + esc(tx(x, 'summary')) + '</small></span></a>').join('')) : '');
  }
  const norm = s => String(s || '').toLowerCase();
  function match(a, q){
    const words = norm(q).split(/\s+/).filter(Boolean);
    const hay = norm([a.title, a.summary, a.area, a.body, a.title_ar, a.summary_ar, a.body_ar].join(' '));
    return words.every(w => hay.includes(w));
  }
  V.help = { title:'Help center', sec:'everyone', async open(el, ok){
    const parts = location.hash.slice(1).split('/');
    const body = PX.page(el, 'Help', 'Help center', 'Short how-tos for every part of the portal. Tap the ? at the top of any page to open the one for that page.');
    const r = await load(true);
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    const list = r.list;
    // #help/for/<page>: the page's article, or the list if there isn't one yet
    if (parts[1] === 'for') {
      let key = ''; try { key = decodeURIComponent(parts[2] || ''); } catch(e) {}
      const a = forPage(list, key);
      if (a) { history.replaceState(null, '', '#help/' + a.slug); body.innerHTML = articleHtml(a, list); wireLinks(body); return; }
      history.replaceState(null, '', '#help');
    } else if (parts[1]) {
      let slug = ''; try { slug = decodeURIComponent(parts[1]); } catch(e) {}
      const a = visible(list).find(x => x.slug === slug);
      body.innerHTML = a ? articleHtml(a, list) : '<p class="p-card p-empty">This article isn’t here, or it isn’t for your pages. <a href="#help">See all help articles</a>.</p>';
      wireLinks(body); return;
    }
    const all = visible(list).filter(a => a.published || isOwner());
    const member = T().role === 'member';
    body.innerHTML = '<div class="p-card r33-top"><form class="r33-q" role="search"><input id="r33Q" type="search" placeholder="Search help" aria-label="Search help" autocomplete="off"></form>' +
      '<div class="wk-row">' + (member ? '<a class="p-btn is-ghost" href="#home">Take the Start here tour</a>' : '') +
      (isOwner() ? '<a class="p-btn" href="#helpedit">Edit articles</a>' : '') + '<a class="p-btn is-ghost" href="#help/install-app">Put the portal on your phone</a></div></div>' +
      '<div id="r33List"></div>';
    const draw = () => {
      const q = ($('r33Q') || {}).value || '';
      const shown = q.trim() ? all.filter(a => match(a, q)) : all;
      const areas = AREAS.concat([...new Set(shown.map(a => a.area))].filter(x => !AREAS.includes(x)));
      $('r33List').innerHTML = shown.length ? areas.map(ar0 => {
        const items = shown.filter(a => a.area === ar0); if (!items.length) return '';
        return card(areaOf(items[0]), plural(items.length, 'article'), items.map(a => '<a class="p-row r33-link" href="#help/' + esc(a.slug) + '"><span><b>' + esc(tx(a, 'title')) + '</b><br><small>' + esc(tx(a, 'summary')) + '</small></span>' +
          (!a.published ? pill('Hidden', 'plain') : a.owner_only && isOwner() ? pill('Only you', 'plain') : '') + '</a>').join(''));
      }).join('') : '<p class="p-card p-empty">Nothing found. Try another word, or ask Amr in Messages.</p>';
    };
    draw();
    $('r33Q').addEventListener('input', draw);
    body.querySelector('.r33-q').addEventListener('submit', e => e.preventDefault());
  } };

  // ======================================================================
  // #helpedit: Amr writes and edits articles
  // ======================================================================
  function pageChoices(){
    const seen = new Set(), out = [];
    const add = (k, t) => { if (!k || seen.has(k)) return; seen.add(k); out.push([k, t]); };
    EXTRA.forEach(([k, t]) => add(k, t));
    const d = drawer();
    if (d) d.querySelectorAll('.mi[href^="#"]').forEach(a => {
      const k = a.getAttribute('href').slice(1).split('/')[0];
      const t = (a.dataset.orig || [...a.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ')).trim();
      add(k, t || k);
    });
    // pages grouped under one menu entry (nav.js) keep their own key
    [['mytime', 'My time'], ['requests', 'Missed-shift requests'], ['schedule', 'Schedule'], ['payroll', 'Payroll'], ['commissions', 'Commissions'], ['billing', 'Hours vs billing'], ['track', 'My hours'], ['notify', 'Notification settings']].forEach(([k, t]) => add(k, t));
    return out;
  }
  V.helpedit = { title:'Edit help articles', sec:'owner', async open(el, ok){
    if (!isOwner()) { el.innerHTML = '<div class="p-wrap px"><p class="p-card p-empty">This page is only for Amr.</p></div>'; return; }
    const body = PX.page(el, 'Help', 'Edit help articles', 'Write short how-tos in plain words. Pick who sees each one and which pages’ ? button opens it. Every save keeps the old words in Version history.');
    let id = location.hash.slice(1).split('/')[1] || '';
    const r = await load(true);
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    const list = r.list;
    const pages = pageChoices();
    function drawList(){
      body.innerHTML = '<div class="p-card r33-top"><div class="wk-row"><a class="p-btn" href="#helpedit/new">New article</a><a class="p-btn is-ghost" href="#help">See the help center</a></div>' +
        '<p class="p-hint">' + plural(list.length, 'article') + ' · ' + list.filter(a => !a.published).length + ' hidden · ' + list.filter(a => a.owner_only).length + ' only for you</p></div>' +
        AREAS.concat([...new Set(list.map(a => a.area))].filter(x => !AREAS.includes(x))).map(ar0 => {
          const items = list.filter(a => a.area === ar0); if (!items.length) return '';
          return card(ar0, plural(items.length, 'article'), items.map(a => '<a class="p-row r33-link" href="#helpedit/' + a.id + '"><span><b>' + esc(a.title) + '</b><br><small>' +
            esc(a.owner_only ? 'Only you' : (a.needs || []).length ? 'Team members with ' + a.needs.map(k => (KEYS.find(x => x[0] === k) || [k, k])[1]).join(' or ') : 'Everyone on the team') +
            ' · opens from ' + plural((a.pages || []).length, 'page') + '</small></span>' + (!a.published ? pill('Hidden', 'plain') : '') + '</a>').join(''));
        }).join('');
    }
    function drawForm(a){
      const isNew = !a; a = a || { area:'Getting started', title:'', summary:'', body:'', pages:[], needs:[], owner_only:false, published:true, sort:100 };
      const who = a.owner_only ? 'me' : (a.needs || []).length ? 'some' : 'all';
      body.innerHTML = '<form class="p-card r33-form" id="r33Form" novalidate>' +
        '<p class="r33-crumb"><a href="#helpedit">All articles</a>' + (isNew ? '' : ' › <a href="#help/' + esc(a.slug) + '">See it as the team does</a>') + '</p>' +
        '<div class="r33-grid">' +
        f('Title', '<input name="title" required maxlength="160" value="' + esc(a.title) + '">', 'px-wide') +
        f('Area', '<input name="area" list="r33Areas" required maxlength="60" value="' + esc(a.area) + '"><datalist id="r33Areas">' + AREAS.map(x => opt(x, x)).join('') + '</datalist>') +
        f('Order in its area (lower comes first)', '<input name="sort" type="number" min="0" max="9999" value="' + esc(a.sort) + '">') +
        f('One-line summary', '<input name="summary" maxlength="400" value="' + esc(a.summary) + '">', 'px-wide') +
        f('Words', '<textarea name="body" rows="16" maxlength="20000">' + esc(a.body) + '</textarea>', 'px-wide') + '</div>' +
        '<p class="p-hint">## starts a heading, - a bullet, 1. a step. [Link text](#page) links to a portal page. Leave an empty line between paragraphs.</p>' +
        '<fieldset class="r33-fs"><legend>Who sees it</legend>' +
        '<label class="r33-opt"><input type="radio" name="who" value="all"' + (who === 'all' ? ' checked' : '') + '> Everyone on the team</label>' +
        '<label class="r33-opt"><input type="radio" name="who" value="some"' + (who === 'some' ? ' checked' : '') + '> Only team members with any of these switched on</label>' +
        '<div class="r33-checks" id="r33Needs">' + KEYS.map(([k, t]) => '<label class="r33-opt"><input type="checkbox" name="need" value="' + k + '"' + ((a.needs || []).includes(k) ? ' checked' : '') + '> ' + esc(t) + '</label>').join('') + '</div>' +
        '<label class="r33-opt"><input type="radio" name="who" value="me"' + (who === 'me' ? ' checked' : '') + '> Only me</label></fieldset>' +
        '<fieldset class="r33-fs"><legend>Opens from these pages’ ? button</legend><div class="r33-checks r33-pages">' +
        pages.map(([k, t]) => '<label class="r33-opt"><input type="checkbox" name="page" value="' + esc(k) + '"' + ((a.pages || []).includes(k) ? ' checked' : '') + '> ' + esc(t) + '</label>').join('') +
        (a.pages || []).filter(k => !pages.some(p => p[0] === k)).map(k => '<label class="r33-opt"><input type="checkbox" name="page" value="' + esc(k) + '" checked> ' + esc(k) + '</label>').join('') +
        '</div></fieldset>' +
        '<label class="r33-opt"><input type="checkbox" name="published"' + (a.published ? ' checked' : '') + '> Published (untick to hide it from the team while you work on it)</label>' +
        '<div class="wk-row"><button type="submit" class="p-btn">Save article</button><button type="button" class="p-btn is-ghost" id="r33Prev">Preview</button>' +
        (isNew ? '' : '<button type="button" class="p-btn is-ghost" id="r33Hist">Version history</button><button type="button" class="p-btn is-ghost r33-del" id="r33Del">Delete</button>') +
        '<span class="p-hint" id="r33Msg" role="status"></span></div></form><div id="r33Out"></div>';
      const form = $('r33Form'), out = $('r33Out'), msg = t => { $('r33Msg').textContent = t; };
      const needsBox = () => { $('r33Needs').hidden = form.querySelector('input[name="who"]:checked').value !== 'some'; };
      needsBox(); form.addEventListener('change', e => { if (e.target.name === 'who') needsBox(); });
      $('r33Prev').addEventListener('click', () => { out.innerHTML = '<article class="p-card r33-art"><p class="r33-crumb">Preview</p><h2 class="r33-h">' + esc(form.title.value) + '</h2><p class="r33-sum">' + esc(form.summary.value) + '</p>' + render(form.body.value) + '</article>'; });
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const who2 = form.querySelector('input[name="who"]:checked').value;
        const needs = who2 === 'some' ? [...form.querySelectorAll('input[name="need"]:checked')].map(x => x.value) : [];
        if (who2 === 'some' && !needs.length) { msg('Tick at least one switch, or pick “Everyone on the team”.'); return; }
        const row = { title:form.title.value.trim(), area:form.area.value.trim(), summary:form.summary.value.trim(), body:form.body.value.replace(/\r/g, '').trim(),
          sort:Math.max(0, Math.min(9999, parseInt(form.sort.value, 10) || 100)), needs, owner_only:who2 === 'me', published:form.published.checked,
          pages:[...form.querySelectorAll('input[name="page"]:checked')].map(x => x.value) };
        if (row.title.length < 2) { msg('Write a title first.'); return; }
        if (row.area.length < 2) { msg('Pick an area.'); return; }
        // no long dashes in the portal's wording: they become commas
        ['title', 'summary', 'body'].forEach(k => { row[k] = row[k].replace(/\s*[\u2013\u2014]\s*/g, ', '); });
        const b = form.querySelector('button[type="submit"]'); b.disabled = true; msg('Saving…');
        let res;
        if (isNew) {
          let slug = row.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'article';
          if (slug.length < 2) slug = 'article-' + slug;
          if (list.some(x => x.slug === slug)) slug = (slug + '-' + Date.now().toString(36)).slice(0, 60);
          res = await safe(db().from('help_articles').insert(Object.assign({ slug }, row)).select('id').single());
        } else res = await safe(db().from('help_articles').update(row).eq('id', a.id).select('id').single());
        b.disabled = false;
        if (res.error) { msg(errText(res, 'Couldn’t save. Try again.')); return; }
        cache = null;
        if (window.PortalUI) window.PortalUI.toast('Article saved');
        history.replaceState(null, '', '#helpedit/' + res.data.id);
        await V.helpedit.open(el, ok);
      });
      if (isNew) return;
      $('r33Del').addEventListener('click', ev => {
        const btn = ev.currentTarget;
        if (btn.dataset.sure !== '1') { btn.dataset.sure = '1'; btn.textContent = 'Sure? Click again'; setTimeout(() => { if (btn.isConnected) { btn.dataset.sure = ''; btn.textContent = 'Delete'; } }, 4000); return; }
        const go = () => safe(db().from('help_articles').delete().eq('id', a.id)).then(x => { cache = null; return x; });
        const at = list.indexOf(a);
        history.replaceState(null, '', '#helpedit');
        if (window.PortalUI) {
          // the article leaves the list now; Undo within 10 seconds brings it back and nothing is deleted
          window.PortalUI.undo({ text:'Article deleted', hide:() => { list.splice(at, 1); drawList(); },
            restore:() => { list.splice(at, 0, a); if (ok() && location.hash === '#helpedit') drawList(); },
            commit:go, done:() => {} });
        } else go().then(() => V.helpedit.open(el, ok));
      });
      let vers = [];
      $('r33Hist').addEventListener('click', async () => {
        if (out.dataset.hist === '1') { out.innerHTML = ''; out.dataset.hist = ''; return; }
        out.dataset.hist = '1'; out.innerHTML = card('Version history', '', '<p class="p-loading">Loading…</p>');
        const v = await safe(db().from('help_article_versions').select('id,title,summary,body,area,pages,needs,owner_only,published,saved_at').eq('article_id', a.id).order('saved_at', { ascending:false }).limit(100));
        if (v.error) { out.innerHTML = failed(v.error); return; }
        vers = v.data || [];
        out.innerHTML = card('Version history', plural(vers.length, 'older version'),
          (vers.length ? vers.map(x => '<div class="p-row r17-ver"><span><b>' + esc(x.title) + '</b><br><small>Saved ' + esc(when(x.saved_at)) + '</small></span>' +
            '<span class="r17-acts"><button type="button" class="p-btn is-ghost" data-r33v="' + x.id + '">View</button><button type="button" class="p-btn is-ghost" data-r33back="' + x.id + '">Put this version back</button></span></div>' +
            '<div class="r33-verbody" id="r33v' + x.id + '" hidden>' + render(x.body) + '</div>').join('')
            : empty('No older versions yet. Each time you save, the words before the save are kept here.')) +
          '<p class="p-hint">Putting a version back keeps the current words as a version too.</p>');
      });
      out.addEventListener('click', async e => {
        const v = e.target.closest('[data-r33v]'); if (v) { const box = $('r33v' + v.dataset.r33v); if (box) { box.hidden = !box.hidden; v.textContent = box.hidden ? 'View' : 'Hide'; } return; }
        const b = e.target.closest('[data-r33back]'); if (!b) return;
        if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? Click again'; setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.textContent = 'Put this version back'; } }, 4000); return; }
        const x = vers.find(y => y.id === +b.dataset.r33back); if (!x) return;
        b.disabled = true;
        const res = await safe(db().from('help_articles').update({ title:x.title, summary:x.summary || '', body:x.body || '', area:x.area || a.area, pages:x.pages || [], needs:x.needs || [], owner_only:!!x.owner_only, published:x.published !== false }).eq('id', a.id));
        if (res.error) { b.disabled = false; b.textContent = errText(res, 'Couldn’t put it back. Try again.'); return; }
        cache = null;
        await V.helpedit.open(el, ok);
      });
    }
    if (id === 'new') drawForm(null);
    else if (id) { const a = list.find(x => String(x.id) === id); if (a) drawForm(a); else { history.replaceState(null, '', '#helpedit'); drawList(); } }
    else drawList();
  } };

  // ======================================================================
  // The ? button on /app: the page's article in a side panel
  // ======================================================================
  let panel = null, lastFocus = null;
  function closePanel(){
    if (!panel || panel.hidden) return;
    panel.hidden = true; document.body.classList.remove('r33-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function ensurePanel(){
    if (panel) return panel;
    panel = document.createElement('div'); panel.className = 'r33-panel'; panel.hidden = true;
    panel.innerHTML = '<div class="r33-shade" data-r33x></div><aside class="r33-sheet" role="dialog" aria-modal="true" aria-labelledby="r33PanelH">' +
      '<div class="r33-sheet-head"><b id="r33PanelH">Help</b><button type="button" class="r33-x" data-r33x aria-label="Close help">&times;</button></div><div class="r33-sheet-body" id="r33PanelB"></div></aside>';
    document.body.appendChild(panel);
    panel.addEventListener('click', e => {
      if (e.target.closest('[data-r33x]')) { closePanel(); return; }
      const a = e.target.closest('a[href]'); if (a && !a.closest('.r33-body')) closePanel();
    });
    wireLinks(panel.querySelector('#r33PanelB'), closePanel);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
    return panel;
  }
  async function openPanel(key){
    const p = ensurePanel(), b = p.querySelector('#r33PanelB');
    lastFocus = document.activeElement;
    p.hidden = false; document.body.classList.add('r33-open');
    b.innerHTML = '<p class="p-loading">Loading…</p>';
    p.querySelector('.r33-x').focus();
    const r = await load(false);
    if (r.error) { b.innerHTML = failed(r.error); return; }
    const a = forPage(r.list, key);
    const menu = T().role === 'owner' || T().role === 'member';
    const foot = menu ? '<p class="r33-foot"><a class="p-btn is-ghost" href="#help">All help articles</a>' + (isOwner() && a ? '<a class="p-btn is-ghost" href="#helpedit/' + a.id + '">Edit</a>' : '') + '</p>' : '';
    if (!a) {
      b.innerHTML = '<p class="p-empty">There’s no help article for this page yet.' + (isOwner() ? ' Write one in Edit help articles and tick this page.' : ' Ask Amr in Messages if something isn’t clear.') + '</p>' + foot;
      return;
    }
    $('r33PanelH').textContent = tx(a, 'title');
    b.innerHTML = (tx(a, 'summary') ? '<p class="r33-sum">' + esc(tx(a, 'summary')) + '</p>' : '') + render(tx(a, 'body')) + foot;
  }
  window.PortalHelp = { open(key){ key = key || 'home'; if (key === 'help' || key === 'helpedit') { location.hash = '#help'; return; } openPanel(key); }, close:closePanel };
  addEventListener('hashchange', closePanel);

  // ======================================================================
  // P16: on phones, a table that isn't already in a scroll box gets one, so it scrolls sideways instead of squashing
  // ======================================================================
  (function wrapTables(){
    const view = $('pView'); if (!view || !window.matchMedia) return;
    const phone = matchMedia('(max-width:640px)');
    const OK = '.p-tablewrap, .r22-np, .vs-tablewrap, .r33-wrap, .hist-scroll';
    let t = 0;
    const run = () => {
      if (!phone.matches) return;
      view.querySelectorAll('table').forEach(tb => {
        if (tb.closest(OK)) return;
        const p = tb.parentElement; if (!p) return;
        const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll') return;
        const w = document.createElement('div'); w.className = 'r33-wrap'; p.insertBefore(w, tb); w.appendChild(tb);
      });
    };
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(run, 120); }).observe(view, { childList:true, subtree:true });
    if (phone.addEventListener) phone.addEventListener('change', run);
  })();

  // ======================================================================
  // Global search (team-plus.js): one row per article this person may read
  // ======================================================================
  window.R33Help = { async search(){
    const r = await load(false); if (r.error) return [];
    return visible(r.list).filter(a => a.published || isOwner()).map(a => ({ kind:'Help', title:tx(a, 'title'), sub:areaOf(a) + (tx(a, 'summary') ? ' · ' + tx(a, 'summary') : ''), text:[a.body, a.body_ar, a.summary].filter(Boolean).join(' '), href:'#help/' + a.slug }));
  } };
})();
