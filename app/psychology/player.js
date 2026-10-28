// Psychology and Therapy course player (/app/psychology/). gate.js runs first: it checks the sign-in and the
// "Psychology course" switch, downloads the lessons from the private bucket, sets window.COURSE and window.LH_STORE
// (progress saved to the learn_progress table, course "psy"), then loads this file.
(function () {
'use strict';
var C = window.COURSE, T = window.I18N;
var root = document.documentElement, app = document.getElementById('app');

/* ---------- storage: localStorage by default, or the Learning Hub's own store ---------- */
var Store = (function () {
  /* Account sync: if the Learning Hub page defines window.LH_STORE = { load(): Promise<object>, save(key, value), saveMany(object) (optional) },
     progress is read from and written to the user's account. Otherwise everything stays in this browser (localStorage). */
  var ext = window.LH_STORE, mem = {}, PFX = 'lh-psy:', queue = {}, timer = null;
  function local() { var o = {}; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(PFX) === 0) o[k.slice(PFX.length)] = localStorage.getItem(k); } } catch (e) {} return o; }
  function flush() {
    timer = null; var q = queue; queue = {}; var keys = Object.keys(q); if (!keys.length) return;
    try { if (ext.saveMany) ext.saveMany(q); else keys.forEach(function (k) { ext.save(k, q[k]); }); } catch (e) {}
  }
  return {
    init: function () {
      if (ext && ext.load) {
        return Promise.resolve().then(function () { return ext.load(); }).then(function (d) {
          mem = d || {};
          /* first sign-in only: if the account has no course data yet, carry over progress made in this browser */
          if (!Object.keys(mem).length) { var lo = local(); Object.keys(lo).forEach(function (k) { mem[k] = lo[k]; queue[k] = lo[k]; }); flush(); }
        }, function () { mem = local(); ext = null; });
      }
      mem = local();
      return Promise.resolve();
    },
    get: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    set: function (k, v) {
      mem[k] = v;
      if (ext && (ext.save || ext.saveMany)) { queue[k] = v; flush(); /* gate.js keeps it on the device at once and sends it to the account a moment later */ return; }
      try { localStorage.setItem(PFX + k, v); } catch (e) {}
    },
    flush: function () { if (ext && timer) { clearTimeout(timer); flush(); } },
    keys: function () { return Object.keys(mem); },
    del: function (k) { delete mem[k]; if (ext && (ext.save || ext.saveMany)) { queue[k] = ''; flush(); /* gate.js keeps it on the device at once and sends it to the account a moment later */ return; } try { localStorage.removeItem(PFX + k); } catch (e) {} }
  };
})();
window.addEventListener('pagehide', function () { Store.flush(); });
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') Store.flush(); });

var lang = 'en';
function t(k) { return (T[lang] && T[lang][k]) || T.en[k] || k; }
function L(o) { if (o == null) return ''; if (typeof o === 'string') return o; return o[lang] != null && o[lang] !== '' ? o[lang] : o.en; }
function has(o) { return o && typeof o === 'object' && o[lang] != null && o[lang] !== ''; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function fmt(s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k]; }); }

/* ---------- icons ---------- */
var I = {
  search: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  moon: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 20l1-4L16 5l3 3L8 19l-4 1z"/><path d="M14 7l3 3"/></svg>',
  hl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M9 15l-2 5h6l-1-3"/><path d="M8 14l8-10 4 3-8 10z"/><path d="M4 21h16" opacity=".5"/></svg>',
  er: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M7 20h12"/><path d="M4.5 15.5l9-9a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11 19H8z"/><path d="M9 11l5 5"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-2" transform="translate(0 -6)"/></svg>',
  redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M15 7l5 5-5 5"/><path d="M20 12H10a6 6 0 0 0 0 12h2" transform="translate(0 -6)"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  blank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="3" width="14" height="18"/></svg>',
  lines: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="3" width="14" height="18"/><path d="M8 8h8M8 12h8M8 16h8"/></svg>',
  gridi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="3" width="14" height="18"/><path d="M5 9h14M5 15h14M10 3v18M15 3v18"/></svg>',
  marker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3 21h6"/><path d="M14.5 4.5l5 5L10 19H5v-5z"/><path d="M12 7l5 5"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
};

/* ---------- thumbnails ---------- */
function shapeSVG(th) {
  var s = th.shape || { x: 60, y: 6, d: 30, rot: 0 };
  var x = lang === 'ar' ? (100 - s.x - s.d) : s.x;
  return '<svg class="shape" viewBox="0 0 100 100" style="left:' + x + 'cqw;top:' + s.y + 'cqw;width:' + s.d + 'cqw;height:' + s.d + 'cqw;transform:rotate(' + (s.rot || 0) + 'deg)">' +
    '<circle cx="50" cy="50" r="49" fill="#16233A" fill-opacity=".9" stroke="#F4A340" stroke-width="1.6" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/></svg>';
}
function thumb(th) {
  if (!th) return '';
  var ar = lang === 'ar', d = th[lang] || th.en;
  var tl = d.title.length > (ar ? 16 : 14) ? ' long' : '';
  var nl = String(th.num).length > 3 ? ' long' : '';
  return '<div class="th' + (ar ? ' ar' : '') + '" role="img" aria-label="' + esc(d.title) + '"><div class="grid"></div>' + shapeSVG(th) + '<div class="bar"></div>' +
    '<div class="tag"><b>' + esc(d.tag) + '</b><span>' + esc(th.code || '') + '</span></div>' +
    '<div class="title' + tl + '">' + esc(d.title) + '</div>' +
    '<div class="sub">' + esc(d.sub) + '</div>' + (d.foot ? '<div class="foot">' + esc(d.foot) + '</div>' : '') +
    '<div class="num' + nl + '">' + esc(th.num) + '</div><div class="lab">' + esc(d.label) + '</div></div>';
}

window.LH_renderThumb = function (th, lg) { var o = lang; lang = lg; var h = thumb(th); lang = o; return h; };

/* ---------- progress ---------- */
function isDone(m, it) { return Store.get('done:' + m.id + ':' + it.id) === '1'; }
function setDone(m, it, v) { Store.set('done:' + m.id + ':' + it.id, v ? '1' : '0'); }
function cnt(m, items) { var d = 0; items.forEach(function (it) { if (isDone(m, it)) d++; }); return { d: d, n: items.length, p: items.length ? Math.round(100 * d / items.length) : 0 }; }
function modProg(m) { return cnt(m, m.items); }
function partItems(m, p) { return m.items.filter(function (x) { return x.part === p.id; }); }
function allProg() { var d = 0, n = 0; C.modules.forEach(function (m) { var p = modProg(m); d += p.d; n += p.n; }); return { d: d, n: n, p: n ? Math.round(100 * d / n) : 0 }; }
function progHTML(p, showOf) { return '<div class="prog"><div class="bar"><i style="width:' + p.p + '%"></i></div><span class="pct">' + p.p + '%</span>' + (showOf ? '<span class="of">' + fmt(t('of'), { d: p.d, n: p.n }) + '</span>' : '') + '</div>'; }
function findMod(id) { for (var i = 0; i < C.modules.length; i++) if (C.modules[i].id === id) return C.modules[i]; return null; }
function findPart(m, id) { for (var i = 0; i < m.parts.length; i++) if (m.parts[i].id === id) return m.parts[i]; return null; }
function partName(p) { return p.n === 'X' ? t('practice') : p.n === 'E' ? t('checkpoint') : fmt(t('partN'), { n: p.n }); }
function itemLabel(m, it) {
  var p = findPart(m, it.part);
  if (it.type === 'section') return partName(p) + ' · ' + fmt(t('sectionN'), { n: it.label });
  return partName(p);
}
function firstOpen(m, items) { for (var i = 0; i < items.length; i++) if (!isDone(m, items[i])) return items[i]; return items[0]; }

/* ---------- router ---------- */
function go(h) { if (location.hash === h) render(); else location.hash = h; }
window.addEventListener('hashchange', function () { Pad.close(); Find.close(); Ink.detach(); render(); window.scrollTo(0, 0); });

function render() {
  Ink.detach();
  var parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'review' || parts[0] === 'mistakes') return Rev.render(parts[0], parts[1] || '', parts[2] || '');
  if (parts[0] === 'glossary') return Find.glossary();
  var m = parts[0] ? findMod(parts[0]) : null;
  if (!m) return renderHome();
  Store.set('last', location.hash);
  var it = null;
  if (parts[1]) m.items.forEach(function (x) { if (x.id === parts[1]) it = x; });
  if (!it) return renderModule(m);
  return renderItem(m, it);
}

function renderHome() {
  var p = allProg(), last = Store.get('last');
  var h = '<div class="wrap"><section class="hero"><div><p class="eyebrow mag">' + esc(L(C.track)) + '</p><h1>' + esc(L(C.title)) + '</h1><p class="lede">' + esc(L(C.desc)) + '</p></div>' +
    '<div>' + progHTML(p, true) + '<div class="resume"><button class="btn" id="resume" type="button">' + esc(last ? t('cont') : t('start')) + '</button>' + Rev.buttons('') + '<span class="revbtns"><button class="btn ghost" type="button" data-go="#/glossary">' + esc(t('glossary')) + '</button></span></div></div></section>';
  h += '<div class="grid-mods">';
  var cards = C.modules.map(function (m) { return { n: m.num, m: m }; }).concat(C.upcoming.map(function (u) { return { n: u.num, u: u }; }));
  cards.sort(function (a, b) { return a.n - b.n; });
  cards.forEach(function (c) {
    if (c.u) { var u = c.u; h += '<div class="mcard soon" aria-disabled="true"><div class="ph">' + esc(t('soon')) + '</div><div class="body"><span class="eyebrow">' + esc(fmt(t('moduleN'), { n: u.num })) + '</span><span class="mt">' + esc(L(u.title)) + '</span></div></div>'; return; }
    var m = c.m, mp = modProg(m), np = m.parts.filter(function (x) { return /^\d+$/.test(String(x.n)); }).length;
    h += '<button class="mcard" type="button" data-go="#/' + m.id + '">' + thumb(m.thumb) + '<div class="body"><span class="eyebrow">' + esc(fmt(t('moduleN'), { n: m.num })) + ' · ' + esc(m.code) + '</span><span class="mt">' + esc(L(m.title)) + '</span><span class="meta">' + esc(fmt(t('meta'), { p: np, s: m.items.filter(function (x) { return x.type === 'section'; }).length })) + '</span>' + progHTML(mp) + '</div></button>';
  });
  h += '</div><p class="license">' + esc(t('license')) + '</p></div>';
  app.innerHTML = h;
  document.getElementById('resume').onclick = function () { go(last || '#/' + C.modules[0].id); };
  bindGo();
}

function sideHTML(m, cur) {
  var mp = modProg(m), curPart = cur ? cur.part : null;
  var h = '<aside class="side" id="side"><div class="sh"><p class="eyebrow">' + esc(fmt(t('moduleN'), { n: m.num })) + ' · ' + esc(m.code) + '</p><div class="mt" data-go="#/' + m.id + '">' + esc(L(m.title)) + '</div>' + progHTML(mp, true) + '</div>';
  h += '<a class="it ov' + (!cur ? ' cur' : '') + '" data-go="#/' + m.id + '"><span class="n">○</span><span>' + esc(t('overview')) + '</span></a>';
  m.parts.forEach(function (p) {
    var its = partItems(m, p), pc = cnt(m, its), open = p.id === curPart;
    h += '<div class="part' + (open ? ' open' : '') + (pc.d === pc.n ? ' pdone' : '') + '"><button class="ph" type="button" data-part="' + p.id + '"><span class="pn">' + esc(partName(p)) + '</span><span class="pt">' + esc(L(p.title)) + '</span><span class="pc">' + pc.d + '/' + pc.n + '</span></button><div class="pis">';
    its.forEach(function (it) {
      h += '<a class="it' + (isDone(m, it) ? ' done' : '') + (cur === it ? ' cur' : '') + '" data-go="#/' + m.id + '/' + it.id + '"><span class="st"></span>' + (it.type === 'section' ? '<span class="n">' + esc(it.label) + '</span>' : '') + '<span>' + esc(L(it.title)) + '</span></a>';
    });
    h += '</div></div>';
  });
  h += '<a class="back" data-go="#/">' + esc(t('allModules')) + '</a></aside><div class="drawer-bg" id="dbg"></div>';
  return h;
}

function renderModule(m) {
  var mp = modProg(m), first = firstOpen(m, m.items);
  var h = '<div class="wrap"><div class="layout">' + sideHTML(m, null) + '<div class="main">' +
    '<button class="btn ghost sm mobile-toc" id="toc" type="button">' + I.menu + '&nbsp;' + esc(t('contents')) + '</button>' +
    '<div class="crumbs"><a data-go="#/">' + esc(t('course')) + '</a><span class="sep">/</span><span>' + esc(fmt(t('moduleN'), { n: m.num })) + '</span></div>' +
    '<div class="thumbwrap">' + thumb(m.thumb) + '</div>' +
    '<div class="item-head"><p class="eyebrow mag">' + esc(fmt(t('moduleN'), { n: m.num })) + ' · ' + esc(m.code) + '</p><h1>' + esc(L(m.title)) + '</h1><p class="lede">' + esc(L(m.desc)) + '</p>' + (m.checked ? '<p class="checked">' + esc(fmt(t('checked'), { d: monthName(m.checked) })) + '</p>' : '') + '</div>' +
    '<div class="content">' + progHTML(mp, true) + '<p style="margin:14px 0 22px"><button class="btn" type="button" data-go="#/' + m.id + '/' + first.id + '">' + esc(mp.d ? t('cont') : t('begin')) + '</button>' + Rev.buttons(m.id) + '</p>' +
    (has(m.overview) || lang === 'en' ? L(m.overview) : '<div class="note-ar">' + esc(t('arPending')) + '</div><div class="fallback-en" lang="en">' + L(m.overview) + '</div>') + '</div>' +
    '<h2 class="sec-title" id="parts">' + esc(t('partsTitle')) + '</h2><div class="pcards">';
  m.parts.forEach(function (p) {
    var its = partItems(m, p), pc = cnt(m, its), nxt = firstOpen(m, its);
    h += '<button class="pcard" type="button" data-go="#/' + m.id + '/' + nxt.id + '"><div class="pthumb">' + thumb(p.thumb) + '</div><div class="pbody"><span class="eyebrow mag">' + esc(partName(p)) + '</span><span class="mt">' + esc(L(p.title)) + '</span><span class="meta">' + esc(L(p.desc)) + '</span>' +
      (its.length > 1 ? '<span class="secs">' + its.map(function (x) { return '<i class="' + (isDone(m, x) ? 'd' : '') + '">' + esc(x.type === 'section' ? x.label : L(x.title)) + '</i>'; }).join('') + '</span>' : '') + progHTML(pc) + '</div></button>';
  });
  h += '</div></div></div></div>';
  app.innerHTML = h;
  bindGo(); bindDrawer(); bindSide();
}

function renderItem(m, it) {
  var idx = m.items.indexOf(it), prev = m.items[idx - 1], next = m.items[idx + 1], p = findPart(m, it.part);
  var pits = partItems(m, p), isFirst = pits[0] === it, done = isDone(m, it);
  var isQ = it.type === 'exam' || it.type === 'quiz';
  var body = isQ ? examHTML(m, it) : L(it.html);
  var nextLabel = next ? (next.part !== it.part ? fmt(t('nextPart'), { p: partName(findPart(m, next.part)) }) : t('next')) : t('backToModule');
  var h = '<div class="wrap"><div class="layout">' + sideHTML(m, it) + '<div class="main">' +
    '<button class="btn ghost sm mobile-toc" id="toc" type="button">' + I.menu + '&nbsp;' + esc(t('contents')) + '</button>' +
    '<div class="crumbs"><a data-go="#/">' + esc(t('course')) + '</a><span class="sep">/</span><a data-go="#/' + m.id + '">' + esc(fmt(t('moduleN'), { n: m.num })) + '</a><span class="sep">/</span><span>' + esc(partName(p)) + '</span></div>' +
    (isFirst ? '<div class="thumbwrap sm">' + thumb(p.thumb) + '</div>' : '<div class="partstrip"><span class="eyebrow">' + esc(partName(p)) + '</span><span>' + esc(L(p.title)) + '</span></div>') +
    '<div class="item-head"><p class="eyebrow mag">' + esc(itemLabel(m, it)) + '</p><h1>' + esc(L(it.title)) + '</h1></div>' +
    (has(it.html) || isQ || lang === 'en' ? '' : '<div class="note-ar">' + esc(t('arPending')) + '</div>') +
    '<div class="content' + (lang === 'ar' && !isQ && !has(it.html) ? ' fallback-en" lang="en' : '') + '" id="content">' + body + '</div>' +
    '<div class="itemnav"><button class="btn ghost sm" type="button" ' + (prev ? 'data-go="#/' + m.id + '/' + prev.id + '"' : 'data-go="#/' + m.id + '"') + '>' + esc(prev ? t('prev') : t('overview')) + '</button>' +
    '<div class="mid"><button class="btn' + (done ? ' done' : '') + '" id="doneBtn" type="button">' + esc(done ? t('completed') : t('markComplete')) + '</button></div>' +
    '<button class="btn sm" type="button" id="nextBtn" data-go="' + (next ? '#/' + m.id + '/' + next.id : '#/' + m.id) + '">' + esc(nextLabel) + '</button></div>' +
    '</div></div></div>';
  var tools = it.type === 'section' || it.type === 'playbook';
  if (tools) h += '<div class="fabs"><button class="fab ink' + (Ink.has(m, it) ? ' has' : '') + '" id="inkBtn" type="button" aria-label="' + esc(t('pen')) + '">' + I.marker + '<span class="lbl">' + esc(t('pen')) + '</span><span class="dot"></span></button>' +
    '<button class="fab' + (Pad.hasInk(m, it) ? ' has' : '') + '" id="fab" type="button" aria-label="' + esc(t('scratch')) + '">' + I.pen + '<span class="lbl">' + esc(t('scratch')) + '</span><span class="dot"></span></button></div>';
  app.innerHTML = h;
  bindGo(); bindDrawer(); bindSide(); enhance(m, it);
  document.getElementById('doneBtn').onclick = function () { setDone(m, it, !isDone(m, it)); render(); };
  document.getElementById('nextBtn').addEventListener('click', function () { if (!isQ && !isDone(m, it)) setDone(m, it, true); }, true);
  if (isQ) bindExam(m, it);
  Find.highlight();
  if (tools) {
    document.getElementById('fab').onclick = function () { Ink.stop(); Pad.open(m, it); };
    Ink.attach(m, it, document.getElementById('content'));
    document.getElementById('inkBtn').onclick = function () { Ink.toggle(); };
  }
}

function bindGo() {
  app.querySelectorAll('[data-go]').forEach(function (el) {
    el.addEventListener('click', function (e) { e.preventDefault(); go(el.getAttribute('data-go')); });
  });
}
function bindSide() {
  app.querySelectorAll('.side .part > .ph').forEach(function (b) {
    b.addEventListener('click', function () { b.parentElement.classList.toggle('open'); });
  });
}
function bindDrawer() {
  var b = document.getElementById('toc'), s = document.getElementById('side'), bg = document.getElementById('dbg');
  if (!b) return;
  function close() { s.classList.remove('open'); bg.classList.remove('open'); }
  b.onclick = function () { s.classList.add('open'); bg.classList.add('open'); };
  bg.onclick = close;
}
function enhance(m, it) {
  app.querySelectorAll('.content [data-k]').forEach(function (el) {
    var k = 'f:' + m.id + ':' + el.getAttribute('data-k'), v = Store.get(k);
    if (el.type === 'checkbox') { if (v === '1') el.checked = true; el.addEventListener('change', function () { Store.set(k, el.checked ? '1' : '0'); }); }
    else { if (v !== null) el.value = v; el.addEventListener('input', function () { Store.set(k, el.value); }); }
  });
}

/* ---------- pen on the page ---------- */
var Ink = (function () {
  var mod, item, host, cv, bar, on = false, data, undo = [], tool = 'pen', color = '#C2187A', size = 1, pid = null, sawPen = false, cur = null, erased = false, ro = null, dpr = 1, saveT;
  var SZ = { pen: [2, 3.5, 6], hl: [14, 20, 28], er: [12, 22, 36] };
  var COLORS = ['ink', '#C2187A', '#2563EB', '#2E7D57', '#D97706'];
  function key(m, it) { return 'ink:' + m.id + ':' + it.id; }
  function has(m, it) { try { var d = JSON.parse(Store.get(key(m, it)) || 'null'); return !!(d && d.s && d.s.length); } catch (e) { return false; } }
  function blocks() { return [].slice.call(host.children).filter(function (e) { return e !== cv; }); }
  function col(c) { return c === 'ink' ? (getComputedStyle(root).getPropertyValue('--text').trim() || '#0B0B0B') : c; }
  function hostRect() { return host.getBoundingClientRect(); }
  function anchorRect(i) { var b = blocks()[i]; if (!b) return null; var r = b.getBoundingClientRect(), hr = hostRect(); return { x: r.left - hr.left, y: r.top - hr.top, w: Math.max(r.width, 1), h: Math.max(r.height, 1) }; }
  function toAbs(s) { var a = anchorRect(s.a); if (!a) return null; var out = []; for (var i = 0; i < s.p.length; i += 3) out.push(a.x + s.p[i] * a.w, a.y + s.p[i + 1] * a.h, s.p[i + 2]); return out; }
  function size_() {
    if (!host || !cv) return;
    var w = host.clientWidth, h = host.scrollHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2, 14000 / Math.max(h, 1));
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    redraw();
  }
  function path(x, s, pts) {
    var n = pts.length / 3; x.strokeStyle = col(s.c); x.fillStyle = col(s.c); x.lineCap = 'round'; x.lineJoin = 'round';
    if (s.t === 'hl') { x.globalAlpha = .3; x.globalCompositeOperation = isDark() ? 'screen' : 'multiply'; x.lineCap = 'butt'; } else { x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
    if (n === 1) { x.beginPath(); x.arc(pts[0], pts[1], s.w / 2, 0, 7); x.fill(); }
    else { x.lineWidth = s.w; x.beginPath(); x.moveTo(pts[0], pts[1]); for (var i = 1; i < n - 1; i++) { x.quadraticCurveTo(pts[i * 3], pts[i * 3 + 1], (pts[i * 3] + pts[i * 3 + 3]) / 2, (pts[i * 3 + 1] + pts[i * 3 + 4]) / 2); } x.lineTo(pts[(n - 1) * 3], pts[(n - 1) * 3 + 1]); x.stroke(); }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  }
  function isDark() { var a = root.getAttribute('data-theme'); return a === 'dark' || (!a && matchMedia('(prefers-color-scheme: dark)').matches); }
  function redraw() {
    if (!cv) return; var x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    data.s.forEach(function (s) { var p = toAbs(s); if (p) path(x, s, p); });
    if (cur) path(x, cur, cur.abs);
  }
  function save() { clearTimeout(saveT); saveT = setTimeout(function () { Store.set(key(mod, item), JSON.stringify(data)); var b = document.getElementById('inkBtn'); if (b) b.classList.toggle('has', data.s.length > 0); }, 200); }
  function pos(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, (e.pointerType === 'pen' && e.pressure) ? e.pressure : 0.5]; }
  function down(e) {
    if (!on || pid !== null) return;
    if (e.pointerType === 'pen') { sawPen = true; cv.style.touchAction = 'pan-y'; }
    if (e.pointerType === 'touch' && sawPen) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); pid = e.pointerId; try { cv.setPointerCapture(pid); } catch (er) {}
    var q = pos(e);
    if (tool === 'er') { undo.push(data.s.slice()); erased = false; erase(q); return; }
    cur = { t: tool, c: color, w: SZ[tool][size], abs: q.slice() }; redraw();
  }
  function move(e) {
    if (e.pointerId !== pid) return; e.preventDefault();
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; if (!evs.length) evs = [e];
    evs.forEach(function (ev) { var q = pos(ev); if (tool === 'er') erase(q); else if (cur) { var a = cur.abs; if (Math.abs(q[0] - a[a.length - 3]) + Math.abs(q[1] - a[a.length - 2]) > 1) a.push(q[0], q[1], q[2]); } });
    if (cur) redraw();
  }
  function up(e) {
    if (e.pointerId !== pid) return; pid = null;
    if (tool === 'er') { if (!erased) undo.pop(); else save(); ui(); return; }
    if (!cur) return;
    var a = cur.abs, cx = 0, cy = 0, n = a.length / 3; for (var i = 0; i < a.length; i += 3) { cx += a[i]; cy += a[i + 1]; } cx /= n; cy /= n;
    var bl = blocks(), hr = hostRect(), best = 0, bd = 1e9;
    bl.forEach(function (b, j) { var r = b.getBoundingClientRect(), top = r.top - hr.top, bot = top + r.height; var d = cy < top ? top - cy : cy > bot ? cy - bot : 0; if (d < bd) { bd = d; best = j; } });
    var ar = anchorRect(best), p = [];
    for (var k = 0; k < a.length; k += 3) p.push(Math.round((a[k] - ar.x) / ar.w * 10000) / 10000, Math.round((a[k + 1] - ar.y) / ar.h * 10000) / 10000, Math.round(a[k + 2] * 100) / 100);
    undo.push(data.s.slice()); if (undo.length > 80) undo.shift();
    data.s = data.s.concat([{ a: best, t: cur.t, c: cur.c, w: cur.w, p: p }]); cur = null; redraw(); save(); ui();
  }
  function erase(q) {
    var r = SZ.er[size] / 2, before = data.s.length;
    data.s = data.s.filter(function (s) { var p = toAbs(s); if (!p) return true; var rr = r + s.w / 2; for (var i = 0; i < p.length; i += 3) { var dx = p[i] - q[0], dy = p[i + 1] - q[1]; if (dx * dx + dy * dy <= rr * rr) return false; } return true; });
    if (data.s.length !== before) { erased = true; redraw(); }
  }
  function buildBar() {
    bar = document.createElement('div'); bar.className = 'inkbar'; bar.setAttribute('role', 'toolbar');
    bar.innerHTML = '<button class="tb" data-t="pen" title="' + esc(t('tPen')) + '">' + I.pen + '</button><button class="tb" data-t="hl" title="' + esc(t('tHl')) + '">' + I.hl + '</button><button class="tb" data-t="er" title="' + esc(t('tEr')) + '">' + I.er + '</button><span class="sep"></span>' +
      COLORS.map(function (c) { return '<button class="sw" data-c="' + c + '" style="background:' + (c === 'ink' ? 'var(--text)' : c) + '" aria-label="' + c + '"></button>'; }).join('') + '<span class="sep"></span>' +
      '<button class="sz" data-s="0"><i style="width:4px;height:4px"></i></button><button class="sz" data-s="1"><i style="width:7px;height:7px"></i></button><button class="sz" data-s="2"><i style="width:11px;height:11px"></i></button><span class="sep"></span>' +
      '<button class="tb" data-a="undo" title="' + esc(t('tUndo')) + '">' + I.undo + '</button><button class="tb" data-a="clear" title="' + esc(t('tClearInk')) + '">' + I.trash + '</button>' +
      '<span class="confirm"><span>' + esc(t('clearInkQ')) + '</span><button class="btn sm" data-a="yes">' + esc(t('clearYes')) + '</button><button class="btn ghost sm" data-a="no">' + esc(t('clearNo')) + '</button></span>' +
      '<button class="btn sm" data-a="done">' + esc(t('done')) + '</button>';
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.t) tool = b.dataset.t;
      else if (b.dataset.c) { color = b.dataset.c; if (tool === 'er') tool = 'pen'; }
      else if (b.dataset.s) size = +b.dataset.s;
      else if (b.dataset.a === 'undo' && undo.length) { data.s = undo.pop(); redraw(); save(); }
      else if (b.dataset.a === 'clear') bar.querySelector('.confirm').classList.add('show');
      else if (b.dataset.a === 'no') bar.querySelector('.confirm').classList.remove('show');
      else if (b.dataset.a === 'yes') { undo.push(data.s.slice()); data.s = []; redraw(); save(); bar.querySelector('.confirm').classList.remove('show'); }
      else if (b.dataset.a === 'done') stop();
      ui();
    });
    document.body.appendChild(bar);
  }
  function ui() {
    if (!bar) return;
    bar.querySelectorAll('[data-t]').forEach(function (b) { b.classList.toggle('on', b.dataset.t === tool); });
    bar.querySelectorAll('[data-c]').forEach(function (b) { b.classList.toggle('on', b.dataset.c === color && tool !== 'er'); });
    bar.querySelectorAll('[data-s]').forEach(function (b) { b.classList.toggle('on', +b.dataset.s === size); });
    bar.querySelector('[data-a=undo]').disabled = !undo.length;
  }
  function attach(m, it, el) {
    mod = m; item = it; host = el; undo = [];
    try { data = JSON.parse(Store.get(key(m, it)) || 'null') || { s: [] }; } catch (e) { data = { s: [] }; }
    host.classList.add('inkhost');
    cv = document.createElement('canvas'); cv.className = 'inklayer'; host.appendChild(cv);
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { size_(); }); ro.observe(host); }
    window.addEventListener('resize', size_);
    requestAnimationFrame(size_); setTimeout(size_, 400);
  }
  function start() { if (!cv) return; on = true; host.classList.add('inking'); if (!bar) buildBar(); bar.classList.add('show'); var b = document.getElementById('inkBtn'); if (b) b.classList.add('active'); ui(); }
  function stop() { on = false; if (host) host.classList.remove('inking'); if (bar) bar.classList.remove('show'); var b = document.getElementById('inkBtn'); if (b) b.classList.remove('active'); }
  function toggle() { if (on) stop(); else start(); }
  function detach() { stop(); if (ro) { ro.disconnect(); ro = null; } window.removeEventListener('resize', size_); if (bar) { bar.remove(); bar = null; } cv = null; host = null; }
  return { attach: attach, detach: detach, toggle: toggle, stop: stop, has: has, redraw: function () { if (cv) redraw(); } };
})();

/* ---------- exam ---------- */
var LET = { en: ['a', 'b', 'c', 'd'], ar: ['أ', 'ب', 'ج', 'د'] };
function examHTML(m, it) {
  var ex = it.exam, qs = ex.q[lang] || ex.q.en, last = Store.get(scoreKey(m, it));
  var h = L(ex.intro);
  if (last !== null) h += '<p class="small">' + esc(fmt(t('lastScore'), { n: last, total: qs.length })) + '</p>';
  h += '<div class="quiz' + (it.type === 'quiz' ? ' practice' : '') + '" id="quiz">';
  qs.forEach(function (q, i) {
    h += '<div class="q' + (q.k ? ' case' : '') + '" data-ans="' + q.ans + '" data-i="' + i + '"><div class="stem">' + (i + 1) + '. ' + (q.k ? '<span class="qtag">' + esc(t('caseTag')) + '</span>' : '') + q.stem + '</div><ol class="opts">';
    q.opts.forEach(function (o, j) {
      h += '<li><label><input type="radio" name="q' + i + '" value="' + j + '"><b>' + LET[lang][j] + ')</b><span>' + o + '</span></label></li>';
    });
    h += '</ol><div class="fb"><b>' + LET[lang][q.ans] + ')</b> ' + q.fb + '</div></div>';
  });
  h += '</div><div class="examctl"><button class="btn" id="checkBtn" type="button">' + esc(t('check')) + '</button><button class="btn ghost" id="resetBtn" type="button">' + esc(t('reset')) + '</button>' + (it.type === 'quiz' ? '<button class="btn ghost" id="shufBtn" type="button">' + esc(t('shuffle')) + '</button>' : '') + '<span class="result" id="result" aria-live="polite"></span></div>';
  return h;
}
function bindExam(m, it) {
  var qs = [].slice.call(document.querySelectorAll('#quiz .q')), res = document.getElementById('result'), pass = it.exam.pass;
  document.getElementById('checkBtn').onclick = function () {
    var left = qs.filter(function (q) { return !q.querySelector('input:checked'); }).length;
    if (left) { res.textContent = fmt(t('unanswered'), { n: left }); return; }
    var n = 0;
    qs.forEach(function (q) { var c = q.querySelector('input:checked').value === q.getAttribute('data-ans'); if (c) n++; q.classList.add('done'); q.classList.toggle('right', c); q.classList.toggle('wrong', !c); if (it.type === 'exam') Rev.record(m.id, it.id, q.getAttribute('data-i'), c, q); });
    Store.set(scoreKey(m, it), String(n));
    var ok = n >= pass;
    res.textContent = fmt(t('score'), { n: n, total: qs.length }) + ' ' + (ok ? t(it.type === 'quiz' ? 'quizPass' : 'passMsg') : t(it.type === 'quiz' ? 'quizFail' : 'fail'));
    if (ok && !isDone(m, it)) { setDone(m, it, true); var b = document.getElementById('doneBtn'); b.classList.add('done'); b.textContent = t('completed'); refreshSide(m, it); }
  };
  document.getElementById('resetBtn').onclick = function () {
    qs.forEach(function (q) { delete q._rec; q.classList.remove('done', 'right', 'wrong'); q.querySelectorAll('input').forEach(function (i) { i.checked = false; }); });
    res.textContent = '';
  };
  if (it.type === 'quiz') {
    qs.forEach(function (q) { q.querySelectorAll('input').forEach(function (inp) { inp.addEventListener('change', function () { var c = inp.value === q.getAttribute('data-ans'); q.classList.add('done'); q.classList.toggle('right', c); q.classList.toggle('wrong', !c); Rev.record(m.id, it.id, q.getAttribute('data-i'), c, q); }); }); });
    document.getElementById('shufBtn').onclick = function () {
      var box = document.getElementById('quiz'), arr = [].slice.call(box.children);
      for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp; }
      arr.forEach(function (q, k) { delete q._rec; q.classList.remove('done', 'right', 'wrong'); q.querySelectorAll('input').forEach(function (x) { x.checked = false; }); var st = q.querySelector('.stem'); st.innerHTML = st.innerHTML.replace(/^\d+\. /, (k + 1) + '. '); box.appendChild(q); });
      res.textContent = ''; window.scrollTo(0, box.getBoundingClientRect().top + window.scrollY - 90);
    };
  }
}
function scoreKey(m, it) { return it.type === 'quiz' ? 'quiz:' + m.id + ':' + it.id : 'exam:' + m.id; }
function refreshSide(m, it) {
  var s = document.getElementById('side'); if (!s) return;
  var tmp = document.createElement('div'); tmp.innerHTML = sideHTML(m, it);
  s.replaceWith(tmp.firstChild); bindGo();
}



/* ---------- search and glossary ---------- */
function monthName(ym) {
  var p = String(ym).split('-'), d = new Date(+p[0], (+p[1] || 1) - 1, 1);
  try { return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' }).format(d); } catch (e) { return ym; }
}
var Find = (function () {
  var idx = {}, el = null, pending = null;
  function norm(s) {   /* lower-case, strip Arabic diacritics, unify alef/ya/ta marbuta forms; returns text plus index map */
    var out = '', map = [];
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (/[ً-ْٰـ]/.test(c)) continue;
      if ((c === 'ا' || c === 'أ') && s[i + 1] === 'ل' && (i === 0 || /[\s(«"'،.:؛-]/.test(s[i - 1])) && /[ء-ي]/.test(s[i + 2] || '')) { i++; continue; }
      if (/[أإآٱ]/.test(c)) c = 'ا'; else if (c === 'ى') c = 'ي'; else if (c === 'ة') c = 'ه'; else if (c === 'ؤ') c = 'و'; else if (c === 'ئ') c = 'ي';
      out += c.toLowerCase(); map.push(i);
    }
    return { t: out, map: map };
  }
  function plain(h) { var d = document.createElement('div'); d.innerHTML = String(h).replace(/<\/(td|th|li|p|div|h\d|tr|caption)>/g, ' $&'); d.querySelectorAll('textarea,input,script,style').forEach(function (x) { x.remove(); }); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  function build() {
    if (idx[lang]) return idx[lang];
    var docs = [];
    C.modules.forEach(function (m) {
      if (m.overview) docs.push({ m: m, it: null, title: L(m.title), text: plain(L(m.overview)) });
      m.items.forEach(function (it) {
        if (it.type !== 'section' && it.type !== 'playbook') return;
        var txt = plain(L(it.html)); docs.push({ m: m, it: it, title: L(it.title), text: txt });
      });
    });
    docs.forEach(function (d) { d.nt = norm(d.text); d.nh = norm(d.title).t; });
    return (idx[lang] = docs);
  }
  function snippet(d, pos, len) {
    var a = d.nt.map[pos] || 0, b = d.nt.map[Math.min(pos + len - 1, d.nt.map.length - 1)] + 1, s0 = Math.max(0, a - 60), e0 = Math.min(d.text.length, b + 90);
    return (s0 > 0 ? '…' : '') + esc(d.text.slice(s0, a)) + '<mark>' + esc(d.text.slice(a, b)) + '</mark>' + esc(d.text.slice(b, e0)) + (e0 < d.text.length ? '…' : '');
  }
  function run(q) {
    var nq = norm(q.trim()).t; if (nq.length < 2) return { g: [], r: [] };
    var g = (C.glossary || []).filter(function (x) { return norm(x.en).t.indexOf(nq) >= 0 || norm(x.ar || '').t.indexOf(nq) >= 0; }).slice(0, 6);
    var r = [];
    build().forEach(function (d) {
      var p = d.nt.t.indexOf(nq), inT = d.nh.indexOf(nq) >= 0;
      if (p < 0 && !inT) return;
      var c = 0, k = p; while (k >= 0 && c < 50) { c++; k = d.nt.t.indexOf(nq, k + nq.length); }
      r.push({ d: d, p: p, score: (inT ? 100 : 0) + c + (d.it && d.it.type === 'section' ? 5 : 0) });
    });
    r.sort(function (a, b) { return b.score - a.score; });
    return { g: g, r: r.slice(0, 40), n: r.length };
  }
  function where(d) {
    var s = fmt(t('moduleN'), { n: d.m.num });
    if (!d.it) return s + ' · ' + t('overview');
    var p = findPart(d.m, d.it.part);
    return s + ' · ' + (d.it.type === 'section' ? fmt(t('sectionN'), { n: d.it.label }) : partName(p));
  }
  function open() {
    if (!el) {
      el = document.createElement('div'); el.className = 'findov'; el.setAttribute('role', 'dialog');
      document.body.appendChild(el);
      el.addEventListener('click', function (e) { if (e.target === el) close(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && el.classList.contains('open')) close(); });
    }
    el.innerHTML = '<div class="findbox"><div class="findhead">' + I.search + '<input id="findIn" type="search" autocomplete="off" placeholder="' + esc(t('searchPh')) + '"><button class="btn ghost sm" id="findX" type="button">' + esc(t('close')) + '</button></div><div class="findres" id="findRes"><p class="small"><a data-go="#/glossary" class="glink">' + esc(t('openGloss')) + '</a></p></div></div>';
    el.classList.add('open'); document.body.style.overflow = 'hidden';
    var inp = document.getElementById('findIn'), res = document.getElementById('findRes'), tmr = null;
    var last = sessionStorage.getItem('lh-find') || ''; inp.value = last;
    function show() {
      var q = inp.value; try { sessionStorage.setItem('lh-find', q); } catch (e) {}
      var o = run(q);
      if (q.trim().length < 2) { res.innerHTML = '<p class="small"><a data-go="#/glossary" class="glink">' + esc(t('openGloss')) + '</a></p>'; bind(); return; }
      var h = '';
      if (o.g.length) h += '<div class="fgroup"><div class="flbl">' + esc(t('inGloss')) + '</div>' + o.g.map(function (x) { return '<a class="fhit gl" data-go="#/glossary" data-q="' + esc(x.en) + '"><b>' + esc(lang === 'ar' ? (x.ar || x.en) : x.en) + '</b> <span class="alt">' + esc(lang === 'ar' ? x.en : (x.ar || '')) + '</span><span class="snip">' + esc(x.d[lang] || x.d.en) + '</span></a>'; }).join('') + '</div>';
      if (o.r.length) h += '<div class="fgroup"><div class="flbl">' + esc(fmt(t('resultsN'), { n: o.n })) + '</div>' + o.r.map(function (x) {
        var d = x.d, href = '#/' + d.m.id + (d.it ? '/' + d.it.id : '');
        return '<a class="fhit" data-go="' + href + '" data-hl="1"><span class="src">' + esc(where(d)) + '</span><b>' + esc(d.title) + '</b>' + (x.p >= 0 ? '<span class="snip">' + snippet(d, x.p, norm(q.trim()).t.length) + '</span>' : '') + '</a>';
      }).join('') + '</div>';
      if (!h) h = '<p class="small">' + esc(t('noHits')) + '</p>';
      res.innerHTML = h; bind();
    }
    function bind() {
      res.querySelectorAll('[data-go]').forEach(function (a) { a.addEventListener('click', function (e) {
        e.preventDefault(); var q = inp.value.trim();
        pending = a.hasAttribute('data-hl') ? q : null;
        if (a.getAttribute('data-q')) try { sessionStorage.setItem('lh-gloss', a.getAttribute('data-q')); } catch (er) {}
        close(); go(a.getAttribute('data-go'));
      }); });
    }
    inp.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(show, 160); });
    document.getElementById('findX').onclick = close;
    show(); setTimeout(function () { inp.focus(); inp.select(); }, 30);
  }
  function close() { if (el) el.classList.remove('open'); document.body.style.overflow = ''; }
  function highlight() {
    if (!pending) return; var q = pending; pending = null;
    var box = document.getElementById('content'); if (!box) return;
    var nq = norm(q).t, w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) {
      var nn = norm(n.nodeValue), p = nn.t.indexOf(nq); if (p < 0) continue;
      var a = nn.map[p], b = nn.map[p + nq.length - 1] + 1, r = document.createRange();
      r.setStart(n, a); r.setEnd(n, b); var mk = document.createElement('mark'); mk.className = 'hit';
      try { r.surroundContents(mk); } catch (e) { return; }
      var det = mk.closest('details'); if (det) det.open = true;
      setTimeout(function () { mk.scrollIntoView({ block: 'center' }); }, 60);
      setTimeout(function () { mk.classList.add('fade'); }, 4000);
      return;
    }
  }
  function glossary() {
    var list = (C.glossary || []).slice(), pre = '';
    try { pre = sessionStorage.getItem('lh-gloss') || ''; sessionStorage.removeItem('lh-gloss'); } catch (e) {}
    var key = function (x) { return lang === 'ar' ? (x.ar || x.en) : x.en; };
    list.sort(function (a, b) { return key(a).localeCompare(key(b), lang); });
    var h = '<div class="wrap revpage"><div class="crumbs"><a data-go="#/">' + esc(t('course')) + '</a><span class="sep">/</span><span>' + esc(t('glossary')) + '</span></div>' +
      '<div class="item-head"><p class="eyebrow mag">' + esc(fmt(t('termsN'), { n: list.length })) + '</p><h1>' + esc(t('glossary')) + '</h1><p class="lede">' + esc(t('glossLede')) + '</p></div>' +
      '<input class="gfilter" id="gIn" type="search" placeholder="' + esc(t('glossFilter')) + '" value="' + esc(pre) + '"><div class="glist" id="gList">';
    list.forEach(function (x) {
      h += '<div class="gterm" data-k="' + esc(norm(x.en + ' ' + (x.ar || '') + ' ' + (x.d[lang] || '')).t) + '"><div class="gt"><b>' + esc(key(x)) + '</b><span class="alt" dir="' + (lang === 'ar' ? 'ltr' : 'rtl') + '">' + esc(lang === 'ar' ? x.en : (x.ar || '')) + '</span></div><p>' + esc(x.d[lang] || x.d.en) + '</p><div class="gm">' +
        x.m.map(function (n) { var mm = null; C.modules.forEach(function (z) { if (z.num === n) mm = z; }); return mm ? '<button type="button" class="chip" data-go="#/' + mm.id + '">' + esc(fmt(t('moduleN'), { n: n })) + '</button>' : ''; }).join('') + '</div></div>';
    });
    h += '</div></div>';
    app.innerHTML = h; bindGo();
    var inp = document.getElementById('gIn'), rows = [].slice.call(document.querySelectorAll('.gterm'));
    function filt() { var q = norm(inp.value.trim()).t; rows.forEach(function (r) { r.style.display = !q || r.getAttribute('data-k').indexOf(q) >= 0 ? '' : 'none'; }); }
    inp.addEventListener('input', filt); filt();
  }
  return { open: open, close: close, highlight: highlight, glossary: glossary };
})();

/* ---------- review and mistakes ---------- */
var Rev = (function () {
  var DAY = 864e5, INT = [0, 1, 3, 7, 16, 35];
  function key(mid, iid, i) { return 'qs:' + mid + ':' + iid + ':' + i; }
  function stat(mid, iid, i) { var v = Store.get(key(mid, iid, i)); if (!v) return null; var a = v.split('|'); return { box: +a[0], r: +a[1], w: +a[2], ts: +a[3], last: +a[4] }; }
  function record(mid, iid, i, ok, el) {
    if (el) { if (el._rec) return; el._rec = 1; }
    var s = stat(mid, iid, i) || { box: 0, r: 0, w: 0, ts: 0, last: 1 };
    if (ok) { s.r++; s.box = Math.min(s.box + 1, INT.length - 1); } else { s.w++; s.box = 0; }
    s.ts = Date.now(); s.last = ok ? 1 : 0;
    Store.set(key(mid, iid, i), [s.box, s.r, s.w, s.ts, s.last].join('|'));
  }
  function qItems(m) { return m.items.filter(function (x) { return x.type === 'quiz' || x.type === 'exam'; }); }
  function pool(scope, onlyMiss) {
    var out = [];
    C.modules.forEach(function (m) {
      if (scope && m.id !== scope) return;
      qItems(m).forEach(function (it) {
        var tried = Store.get(scoreKey(m, it)) !== null, qs = it.exam.q[lang] || it.exam.q.en;
        qs.forEach(function (q, i) {
          var st = stat(m.id, it.id, i);
          if (onlyMiss ? (st && st.last === 0) : (st || tried)) out.push({ m: m, it: it, i: i, q: q, st: st });
        });
      });
    });
    return out;
  }
  function weight(x, now) {
    var st = x.st; if (!st) return 2;
    var due = st.ts + INT[st.box] * DAY <= now, w = st.last === 0 ? 8 : (st.w > 0 ? 3 : 1);
    return w * (due ? 2 : 0.25);
  }
  function pick(list, n) {
    var now = Date.now(), a = list.map(function (x) { return { x: x, k: Math.pow(Math.random(), 1 / weight(x, now)) }; });
    a.sort(function (p, q) { return q.k - p.k; });
    return a.slice(0, n).map(function (p) { return p.x; });
  }
  function counts(scope) { return { miss: pool(scope, true).length, all: pool(scope, false).length }; }
  function buttons(scope) {
    var c = counts(scope), base = scope ? '/' + scope : '';
    return '<span class="revbtns"><button class="btn ghost" type="button" data-go="#/review' + base + '">' + esc(t(scope ? 'reviewMod' : 'review')) + '</button>' +
      '<button class="btn ghost" type="button" data-go="#/mistakes' + base + '">' + esc(t('mistakes')) + (c.miss ? ' <span class="cnt">' + c.miss + '</span>' : '') + '</button></span>';
  }
  var cur = null;
  function render(mode, scope, size) {
    if (scope && !findMod(scope)) scope = '';
    var n = +size || +Store.get('revSize') || 20;
    var list = mode === 'mistakes' ? pool(scope, true) : pool(scope, false);
    var set = mode === 'mistakes' ? list.slice(0, 60) : pick(list, n);
    if (mode === 'mistakes') set = pick(set, set.length);
    cur = { mode: mode, scope: scope, set: set };
    var title = t(mode === 'mistakes' ? 'mistakes' : 'review');
    var h = '<div class="wrap revpage"><div class="crumbs"><a data-go="#/">' + esc(t('course')) + '</a><span class="sep">/</span><span>' + esc(title) + '</span></div>' +
      '<div class="item-head"><p class="eyebrow mag">' + esc(scope ? fmt(t('moduleN'), { n: findMod(scope).num }) : t('allMods')) + '</p><h1>' + esc(title) + '</h1><p class="lede">' + esc(t(mode === 'mistakes' ? 'mistakesLede' : 'reviewLede')) + '</p></div>';
    h += '<div class="revbar"><span class="lbl">' + esc(t('scope')) + '</span><span class="chips">' +
      '<button type="button" class="chip' + (!scope ? ' on' : '') + '" data-go="#/' + mode + '">' + esc(t('allMods')) + '</button>' +
      C.modules.map(function (m) { return '<button type="button" class="chip' + (scope === m.id ? ' on' : '') + '" data-go="#/' + mode + '/' + m.id + '">' + esc(fmt(t('moduleN'), { n: m.num })) + '</button>'; }).join('') + '</span></div>';
    if (mode === 'review') h += '<div class="revbar"><span class="lbl">' + esc(t('setSize')) + '</span><span class="chips">' + [10, 20, 40].map(function (k) { return '<button type="button" class="chip sz' + (k === n ? ' on' : '') + '" data-n="' + k + '">' + k + '</button>'; }).join('') + '</span></div>';
    if (!set.length) {
      h += '<div class="panel keep revempty"><p>' + esc(t(mode === 'mistakes' ? 'noMistakes' : 'noReview')) + '</p></div></div>';
      app.innerHTML = h; bindGo(); return;
    }
    h += '<div class="content"><div class="quiz practice" id="quiz">';
    set.forEach(function (x, k) {
      var q = x.q, p = findPart(x.m, x.it.part);
      h += '<div class="q' + (q.k ? ' case' : '') + '" data-ans="' + q.ans + '" data-k="' + k + '"><div class="src">' + esc(fmt(t('moduleN'), { n: x.m.num })) + ' · ' + esc(x.it.type === 'exam' ? t('exam') : partName(p)) + (x.st && x.st.w ? ' · <span class="missn">' + esc(fmt(t('missedN'), { n: x.st.w })) + '</span>' : '') + '</div><div class="stem">' + (k + 1) + '. ' + (q.k ? '<span class="qtag">' + esc(t('caseTag')) + '</span>' : '') + q.stem + '</div><ol class="opts">';
      q.opts.forEach(function (o, j) { h += '<li><label><input type="radio" name="r' + k + '" value="' + j + '"><b>' + LET[lang][j] + ')</b><span>' + o + '</span></label></li>'; });
      h += '</ol><div class="fb"><b>' + LET[lang][q.ans] + ')</b> ' + q.fb + ' <a class="srcl" data-go="#/' + x.m.id + '/' + x.it.id + '">' + esc(t('openSrc')) + '</a></div></div>';
    });
    h += '</div><div class="examctl"><button class="btn" id="checkBtn" type="button">' + esc(t('check')) + '</button><button class="btn ghost" id="newBtn" type="button">' + esc(t(mode === 'mistakes' ? 'refresh' : 'newSet')) + '</button><span class="result" id="result" aria-live="polite"></span></div></div></div>';
    app.innerHTML = h; bindGo();
    var qs = [].slice.call(document.querySelectorAll('#quiz .q')), res = document.getElementById('result');
    qs.forEach(function (q) {
      var x = set[+q.getAttribute('data-k')];
      q.querySelectorAll('input').forEach(function (inp) { inp.addEventListener('change', function () { var c = inp.value === q.getAttribute('data-ans'); q.classList.add('done'); q.classList.toggle('right', c); q.classList.toggle('wrong', !c); record(x.m.id, x.it.id, x.i, c, q); }); });
    });
    document.getElementById('checkBtn').onclick = function () {
      var left = qs.filter(function (q) { return !q.querySelector('input:checked'); }).length;
      if (left) { res.textContent = fmt(t('unanswered'), { n: left }); return; }
      var r = qs.filter(function (q) { return q.classList.contains('right'); }).length;
      res.textContent = fmt(t('score'), { n: r, total: qs.length }) + ' ' + (mode === 'mistakes' ? fmt(t('fixedN'), { n: r }) : t(r === qs.length ? 'revAll' : 'revSome'));
    };
    document.getElementById('newBtn').onclick = function () { render(mode, scope, n); window.scrollTo(0, 0); };
    app.querySelectorAll('.chip.sz').forEach(function (b) { b.onclick = function () { Store.set('revSize', b.getAttribute('data-n')); render(mode, scope, +b.getAttribute('data-n')); }; });
  }
  return { record: record, render: render, buttons: buttons };
})();

/* ---------- scratch pad ---------- */
var Pad = (function () {
  var W = 1000, H = 1400;
  var el = null, mod, item, doc, page, undo = [], redo = [], tool = 'pen', color = 'ink', size = 1, bgc, base, live, scale = 1, dpr = 1;
  var drawing = null, pid = null, sawPen = false, erased = null, saveT = null;
  var COLORS = [['ink', null], ['#C2187A', null], ['#2563EB', null], ['#2E7D57', null], ['#D97706', null]];
  var SIZES = { pen: [2.2, 4, 8], hl: [18, 28, 40], er: [16, 28, 48] };
  function key() { return 'pad:' + mod.id + ':' + item.id; }
  function load() {
    var raw = Store.get(key()), d = null;
    try { d = raw ? JSON.parse(raw) : null; } catch (e) {}
    if (!d || !d.pages || !d.pages.length) d = { pages: [{ bg: 'lines', s: [] }], cur: 0 };
    return d;
  }
  function hasInk(m, it) { var raw = Store.get('pad:' + m.id + ':' + it.id); if (!raw) return false; try { return JSON.parse(raw).pages.some(function (p) { return p.s.length; }); } catch (e) { return false; } }
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      Store.set(key(), JSON.stringify(doc));
      var sv = el && el.querySelector('.saved'); if (sv) { sv.textContent = t('padSaved'); }
      var f = document.getElementById('fab'); if (f) f.classList.toggle('has', hasInk(mod, item));
    }, 250);
  }
  function inkColor() { var c = getComputedStyle(root).getPropertyValue('--text').trim(); return c || '#0B0B0B'; }
  function col(c) { return c === 'ink' ? inkColor() : c; }

  function build() {
    el = document.createElement('div'); el.className = 'pad'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    var sw = COLORS.map(function (c) { return '<button class="sw" type="button" data-c="' + c[0] + '" aria-label="' + c[0] + '" style="background:' + (c[0] === 'ink' ? 'var(--text)' : c[0]) + '"></button>'; }).join('');
    el.innerHTML = '<div class="sheet"><div class="ph"><span class="pt"></span><span class="saved"></span><button type="button" data-a="close" aria-label="' + esc(t('close')) + '">' + I.close + '</button></div>' +
      '<div class="tools"><div class="g"><button class="tb" type="button" data-t="pen" title="' + esc(t('tPen')) + '">' + I.pen + '</button><button class="tb" type="button" data-t="hl" title="' + esc(t('tHl')) + '">' + I.hl + '</button><button class="tb" type="button" data-t="er" title="' + esc(t('tEr')) + '">' + I.er + '</button></div>' +
      '<div class="g">' + sw + '</div>' +
      '<div class="g"><button class="sz" type="button" data-s="0" title="S"><i style="width:5px;height:5px"></i></button><button class="sz" type="button" data-s="1" title="M"><i style="width:9px;height:9px"></i></button><button class="sz" type="button" data-s="2" title="L"><i style="width:14px;height:14px"></i></button></div>' +
      '<div class="g"><button class="tb" type="button" data-a="undo" title="' + esc(t('tUndo')) + '">' + I.undo + '</button><button class="tb" type="button" data-a="redo" title="' + esc(t('tRedo')) + '">' + I.redo + '</button></div>' +
      '<div class="g"><button class="tb" type="button" data-b="blank" title="' + esc(t('bBlank')) + '">' + I.blank + '</button><button class="tb" type="button" data-b="lines" title="' + esc(t('bLines')) + '">' + I.lines + '</button><button class="tb" type="button" data-b="grid" title="' + esc(t('bGrid')) + '">' + I.gridi + '</button></div></div>' +
      '<div class="stage"><div class="paper"><canvas class="c-bg"></canvas><canvas class="c-base"></canvas><canvas class="c-live"></canvas></div></div>' +
      '<div class="foot"><button class="tb" type="button" data-a="pprev" title="' + esc(t('pPrev')) + '">' + (lang === 'ar' ? I.next : I.prev) + '</button><span class="pg"></span><button class="tb" type="button" data-a="pnext" title="' + esc(t('pNext')) + '">' + (lang === 'ar' ? I.prev : I.next) + '</button><button class="tb" type="button" data-a="padd" title="' + esc(t('pAdd')) + '">' + I.plus + '</button>' +
      '<span class="sp hint">' + esc(t('padHint')) + '</span>' +
      '<span class="confirm"><span>' + esc(t('clearQ')) + '</span><button class="btn sm" type="button" data-a="clearyes">' + esc(t('clearYes')) + '</button><button class="btn ghost sm" type="button" data-a="clearno">' + esc(t('clearNo')) + '</button></span>' +
      '<button class="tb" type="button" data-a="clear" title="' + esc(t('tClear')) + '">' + I.trash + '</button><button class="tb" type="button" data-a="dl" title="' + esc(t('tDl')) + '">' + I.dl + '</button></div></div>';
    document.body.appendChild(el);
    bgc = el.querySelector('.c-bg'); base = el.querySelector('.c-base'); live = el.querySelector('.c-live');
    el.addEventListener('click', function (e) {
      if (e.target === el) { close(); return; }
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.t) { tool = b.dataset.t; ui(); }
      else if (b.dataset.c) { color = b.dataset.c; if (tool === 'er') tool = 'pen'; ui(); }
      else if (b.dataset.s) { size = +b.dataset.s; ui(); }
      else if (b.dataset.b) { snap(); page.bg = b.dataset.b; drawBg(); save(); ui(); }
      else action(b.dataset.a);
    });
    var paper = el.querySelector('.paper');
    paper.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    paper.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    live.addEventListener('pointerdown', down);
    live.addEventListener('pointermove', move);
    live.addEventListener('pointerup', up);
    live.addEventListener('pointercancel', up);
    live.addEventListener('lostpointercapture', up);
    window.addEventListener('resize', function () { if (isOpen()) layout(); });
    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      if (e.key === 'Escape') close();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); action(e.shiftKey ? 'redo' : 'undo'); }
    });
  }
  function isOpen() { return el && el.classList.contains('open'); }
  function action(a) {
    if (a === 'close') close();
    else if (a === 'undo' && undo.length) { redo.push(page.s); page.s = undo.pop(); redraw(); save(); }
    else if (a === 'redo' && redo.length) { undo.push(page.s); page.s = redo.pop(); redraw(); save(); }
    else if (a === 'pprev' && doc.cur > 0) { doc.cur--; setPage(); save(); }
    else if (a === 'pnext' && doc.cur < doc.pages.length - 1) { doc.cur++; setPage(); save(); }
    else if (a === 'padd') { doc.pages.push({ bg: page.bg, s: [] }); doc.cur = doc.pages.length - 1; setPage(); save(); }
    else if (a === 'clear') el.querySelector('.confirm').classList.add('show');
    else if (a === 'clearno') el.querySelector('.confirm').classList.remove('show');
    else if (a === 'clearyes') { snap(); page.s = []; redraw(); save(); el.querySelector('.confirm').classList.remove('show'); }
    else if (a === 'dl') download();
    ui();
  }
  function snap() { undo.push(page.s.slice()); if (undo.length > 80) undo.shift(); redo = []; }
  function setPage() { page = doc.pages[doc.cur]; undo = []; redo = []; drawBg(); redraw(); ui(); }
  function ui() {
    el.querySelectorAll('[data-t]').forEach(function (b) { b.classList.toggle('on', b.dataset.t === tool); });
    el.querySelectorAll('[data-c]').forEach(function (b) { b.classList.toggle('on', b.dataset.c === color && tool !== 'er'); });
    el.querySelectorAll('[data-s]').forEach(function (b) { b.classList.toggle('on', +b.dataset.s === size); });
    el.querySelectorAll('[data-b]').forEach(function (b) { b.classList.toggle('on', b.dataset.b === page.bg); });
    el.querySelector('[data-a=undo]').disabled = !undo.length;
    el.querySelector('[data-a=redo]').disabled = !redo.length;
    el.querySelector('[data-a=pprev]').disabled = doc.cur === 0;
    el.querySelector('[data-a=pnext]').disabled = doc.cur >= doc.pages.length - 1;
    el.querySelector('.pg').textContent = fmt(t('pageOf'), { n: doc.cur + 1, total: doc.pages.length });
    el.querySelector('.paper').classList.toggle('erasing', tool === 'er');
  }
  function layout() {
    var st = el.querySelector('.stage'), r = st.getBoundingClientRect();
    var aw = r.width - 24, ah = r.height - 24;
    scale = Math.max(0.1, Math.min(aw / W, ah / H));
    var cw = Math.floor(W * scale), ch = Math.floor(H * scale);
    var paper = el.querySelector('.paper'); paper.style.width = cw + 'px'; paper.style.height = ch + 'px';
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    [bgc, base, live].forEach(function (c) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); var x = c.getContext('2d'); x.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0); x.lineCap = 'round'; x.lineJoin = 'round'; });
    drawBg(); redraw();
  }
  function drawBg() {
    var x = bgc.getContext('2d'); x.clearRect(0, 0, W, H);
    var cs = getComputedStyle(root), line = cs.getPropertyValue('--border').trim() || '#D8CDB9', mag = cs.getPropertyValue('--mag').trim() || '#C2187A';
    x.lineWidth = 1.2; x.strokeStyle = line; x.globalAlpha = 1;
    if (page.bg === 'lines') { for (var y = 110; y < H - 20; y += 52) { x.beginPath(); x.moveTo(40, y); x.lineTo(W - 40, y); x.stroke(); } x.strokeStyle = mag; x.globalAlpha = .35; x.beginPath(); var mx = lang === 'ar' ? W - 110 : 110; x.moveTo(mx, 30); x.lineTo(mx, H - 30); x.stroke(); x.globalAlpha = 1; }
    if (page.bg === 'grid') { for (var gy = 50; gy < H; gy += 50) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); } for (var gx = 50; gx < W; gx += 50) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke(); } }
  }
  function strokePath(x, s) {
    var p = s.p, n = p.length / 3;
    x.strokeStyle = col(s.c); x.fillStyle = col(s.c);
    if (s.t === 'hl') { x.globalAlpha = .32; x.globalCompositeOperation = root.getAttribute('data-theme') === 'dark' || (matchMedia('(prefers-color-scheme: dark)').matches && root.getAttribute('data-theme') !== 'light') ? 'screen' : 'multiply'; }
    else { x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
    if (n === 1) { x.beginPath(); x.arc(p[0], p[1], s.w / 2, 0, Math.PI * 2); x.fill(); }
    else if (s.t === 'hl' || !s.pr) {
      x.lineWidth = s.w; x.lineCap = s.t === 'hl' ? 'square' : 'round'; x.beginPath(); x.moveTo(p[0], p[1]);
      for (var i = 1; i < n - 1; i++) { var mx = (p[i * 3] + p[i * 3 + 3]) / 2, my = (p[i * 3 + 1] + p[i * 3 + 4]) / 2; x.quadraticCurveTo(p[i * 3], p[i * 3 + 1], mx, my); }
      x.lineTo(p[(n - 1) * 3], p[(n - 1) * 3 + 1]); x.stroke(); x.lineCap = 'round';
    } else {
      for (var j = 1; j < n; j++) { var pr = (p[j * 3 - 1] + p[j * 3 + 2]) / 2; x.lineWidth = s.w * (0.35 + pr * 1.1); x.beginPath(); x.moveTo(p[j * 3 - 3], p[j * 3 - 2]); x.lineTo(p[j * 3], p[j * 3 + 1]); x.stroke(); }
    }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  }
  function redraw() { var x = base.getContext('2d'); x.clearRect(0, 0, W, H); page.s.forEach(function (s) { strokePath(x, s); }); }
  function pt(e) { var r = live.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / scale * 10) / 10, Math.round((e.clientY - r.top) / scale * 10) / 10, Math.round(((e.pointerType === 'pen' && e.pressure) ? e.pressure : 0.5) * 100) / 100]; }
  function down(e) {
    if (pid !== null) return;
    if (e.pointerType === 'pen') sawPen = true;
    if (e.pointerType === 'touch' && sawPen) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); pid = e.pointerId; try { live.setPointerCapture(pid); } catch (er) {}
    var q = pt(e);
    if (tool === 'er') { snap(); erased = false; eraseAt(q); return; }
    drawing = { t: tool, c: tool === 'hl' && color === 'ink' ? '#D97706' : color, w: SIZES[tool][size], p: q.slice(), pr: e.pointerType === 'pen' };
    drawLive();
  }
  function move(e) {
    if (e.pointerId !== pid) return;
    e.preventDefault();
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; if (!evs.length) evs = [e];
    evs.forEach(function (ev) {
      var q = pt(ev);
      if (tool === 'er') { eraseAt(q); return; }
      if (!drawing) return;
      var p = drawing.p, lx = p[p.length - 3], ly = p[p.length - 2];
      if (Math.abs(q[0] - lx) + Math.abs(q[1] - ly) < 1.2) return;
      p.push(q[0], q[1], q[2]);
    });
    if (drawing) drawLive();
  }
  function up(e) {
    if (e.pointerId !== pid) return;
    pid = null;
    if (tool === 'er') { if (!erased) undo.pop(); else save(); erased = null; ui(); return; }
    if (!drawing) return;
    snap(); page.s = page.s.concat([drawing]); drawing = null;
    live.getContext('2d').clearRect(0, 0, W, H); redraw(); save(); ui();
  }
  function drawLive() { var x = live.getContext('2d'); x.clearRect(0, 0, W, H); strokePath(x, drawing); }
  function eraseAt(q) {
    var r = SIZES.er[size] / 2, before = page.s.length;
    page.s = page.s.filter(function (s) {
      var p = s.p, rr = r + s.w / 2;
      for (var i = 0; i < p.length; i += 3) { var dx = p[i] - q[0], dy = p[i + 1] - q[1]; if (dx * dx + dy * dy <= rr * rr) return false; }
      return true;
    });
    if (page.s.length !== before) { erased = true; redraw(); }
  }
  function download() {
    var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d');
    x.fillStyle = getComputedStyle(root).getPropertyValue('--panel').trim() || '#FBF8F2'; x.fillRect(0, 0, W, H);
    var tmp = page; (function () { var sx = bgc.getContext('2d'); })();
    x.drawImage(bgc, 0, 0, W, H); x.drawImage(base, 0, 0, W, H);
    try { var a = document.createElement('a'); a.download = 'scratch-' + mod.id + '-' + item.id + '-p' + (doc.cur + 1) + '.png'; a.href = c.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
  }
  function open(m, it) {
    if (el) { el.remove(); el = null; }
    mod = m; item = it; doc = load(); build();
    el.querySelector('.pt').textContent = t('scratch') + ' · ' + itemLabel(m, it);
    el.classList.add('open'); document.body.style.overflow = 'hidden';
    setPage(); requestAnimationFrame(layout);
  }
  function close() { if (!isOpen()) return; clearTimeout(saveT); Store.set(key(), JSON.stringify(doc)); el.classList.remove('open'); document.body.style.overflow = ''; var f = document.getElementById('fab'); if (f) f.classList.toggle('has', hasInk(mod, item)); }
  return { open: open, close: close, hasInk: hasInk, isOpen: isOpen };
})();

/* ---------- top bar ---------- */
function applyTheme() {
  var th = Store.get('theme'); if (th) root.setAttribute('data-theme', th); else root.removeAttribute('data-theme');
}
function applyLang() {
  lang = Store.get('lang') === 'ar' ? 'ar' : 'en';
  root.lang = lang; root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = L(C.title);
  document.getElementById('crumb').textContent = t('crumb');
  var lb = document.getElementById('langBtn'); lb.textContent = t('langBtn'); lb.title = t('langTitle'); lb.setAttribute('aria-label', t('langTitle'));
  var sb = document.getElementById('searchBtn'); sb.title = t('search'); sb.setAttribute('aria-label', t('search'));
  var tb = document.getElementById('themeBtn'); tb.title = t('theme'); tb.setAttribute('aria-label', t('theme'));
  var bb = document.getElementById('backBtn'); if (bb) { bb.title = t('back'); bb.setAttribute('aria-label', t('back')); }
}
document.getElementById('themeBtn').innerHTML = I.moon;
document.getElementById('themeBtn').onclick = function () {
  var cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  Store.set('theme', cur === 'dark' ? 'light' : 'dark'); applyTheme(); Ink.redraw();
};
document.getElementById('langBtn').onclick = function () {
  Store.set('lang', lang === 'ar' ? 'en' : 'ar'); applyLang(); render();
};
document.getElementById('crumb').onclick = function () { go('#/'); };
if (document.getElementById('backBtn')) document.getElementById('backBtn').onclick = function () { location.href = '/app/#learn'; };
document.getElementById('searchBtn').innerHTML = I.search;
document.getElementById('searchBtn').onclick = function () { Find.open(); };

/* One-time move: the mood module used to be "m3" and is now "m4"; keep that progress and free "m3" for Core Helping Skills. */
function migrate() {
  if (Store.get('mig:m3m4') === '1') return;
  Store.keys().forEach(function (k) {
    if (!/(^|:)m3(:|$)/.test(k) || /^mig:/.test(k)) return;
    var nk = k.replace(/(^|:)m3(:|$)/, '$1m4$2'), v = Store.get(k);
    if (Store.get(nk) === null && v !== '') Store.set(nk, v);
    Store.del(k);
  });
  var last = Store.get('last'); if (last && /^#\/m3(\/|$)/.test(last)) Store.set('last', last.replace('#/m3', '#/m4'));
  Store.set('mig:m3m4', '1');
}
Store.init().then(function () { migrate(); applyTheme(); applyLang(); render(); });
})();
