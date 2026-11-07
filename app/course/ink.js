/* Pen on the page + scratch pad, shared by the Psychology and Acquisitions courses.
   Moved out of app/psychology/player.js so both courses get the same tools and the same colors.
   No inline style="" in any HTML string: the Acquisitions page's security policy blocks them, so colors and sizes
   are set from script (element.style) or from classes in ink.css.

   Use:  var tools = CourseInk({ store:{ get(k), set(k, v) }, t:key => text (optional), rtl:() => bool (optional) });
         tools.Ink.attach(mod, item, hostElement); tools.Ink.toggle(); tools.Ink.detach();
         tools.Pad.open(mod, item, title); tools.Pad.close();
   mod and item only need an .id. What a learner draws is saved through store, keyed ink:<mod>:<item> and pad:<mod>:<item>. */
(function () {
  'use strict';

  /* 12 ready colors + one the learner picks. 'ink' follows the page's text color. */
  var PALETTE = [
    ['ink', 'Black'], ['#6B7079', 'Gray'], ['#DC2626', 'Red'], ['#EA580C', 'Orange'],
    ['#D97706', 'Amber'], ['#EAB308', 'Yellow'], ['#16A34A', 'Green'], ['#0D9488', 'Teal'],
    ['#2563EB', 'Blue'], ['#4F46E5', 'Indigo'], ['#7C3AED', 'Purple'], ['#C2187A', 'Pink']
  ];
  var EN = {
    tPen: 'Pen', tHl: 'Highlighter', tEr: 'Eraser', tUndo: 'Undo', tRedo: 'Redo', tClearInk: 'Clear the page',
    tClear: 'Clear this page', tDl: 'Download this page', clearInkQ: 'Clear everything you drew here?', clearQ: 'Clear this page?',
    clearYes: 'Clear', clearNo: 'Keep', done: 'Done', close: 'Close', scratch: 'Scratch pad', pen: 'Pen',
    padSaved: 'Saved', padHint: 'Only you can see this.', pPrev: 'Previous page', pNext: 'Next page', pAdd: 'Add a page',
    pageOf: 'Page {n} of {total}', bBlank: 'Blank', bLines: 'Lines', bGrid: 'Grid', custom: 'Pick any color', size: 'Size'
  };
  var I = {
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
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="3" width="14" height="18"/><path d="M5 9h14M5 15h14M10 3v18M15 3v18"/></svg>',
    pad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18"/><path d="M12 8h4M12 12h4M12 16h2"/></svg>',
    marker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3 21h6"/><path d="M14.5 4.5l5 5L10 19H5v-5z"/><path d="M12 7l5 5"/></svg>'
  };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var root = document.documentElement;
  function cssVar(names, fb) { var cs = getComputedStyle(root); for (var i = 0; i < names.length; i++) { var v = cs.getPropertyValue(names[i]).trim(); if (v) return v; } return fb; }
  function inkColor() { return cssVar(['--text', '--ink', '--p-ink'], '#14161B'); }
  function isDark() { var a = root.getAttribute('data-theme'); return a === 'dark' || (!a && matchMedia('(prefers-color-scheme: dark)').matches); }
  var okHex = function (c) { return /^#[0-9a-f]{6}$/i.test(c || ''); };

  window.CourseInk = function (opts) {
    var store = opts.store, rtl = opts.rtl || function () { return root.dir === 'rtl'; };
    function t(k) { var v = opts.t ? opts.t(k) : null; return (v && v !== k) ? v : (EN[k] || k); }
    function fmt(s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o[k]; }); }
    function col(c) { return c === 'ink' ? inkColor() : c; }

    /* The color row, used by both tools: 12 swatches and a "pick any color" swatch that keeps the last color picked. */
    function swatchesHTML() {
      return PALETTE.map(function (c) { return '<button class="sw" type="button" data-c="' + c[0] + '" title="' + esc(c[1]) + '" aria-label="' + esc(c[1]) + '"></button>'; }).join('') +
        '<label class="sw any" title="' + esc(t('custom')) + '"><input type="color" data-any aria-label="' + esc(t('custom')) + '"></label>';
    }
    function paintSwatches(box) {
      box.querySelectorAll('.sw[data-c]').forEach(function (b) { b.style.background = b.dataset.c === 'ink' ? inkColor() : b.dataset.c; });
      var pick = box.querySelector('[data-any]'), last = store.get('ink:any');
      pick.value = okHex(last) ? last : '#0EA5E9';
      if (okHex(last)) { pick.parentNode.style.background = last; pick.parentNode.classList.add('set'); }
    }
    function bindAny(box, set) {
      var pick = box.querySelector('[data-any]');
      pick.addEventListener('input', function () {
        if (!okHex(pick.value)) return;
        pick.parentNode.style.background = pick.value; pick.parentNode.classList.add('set');
        store.set('ink:any', pick.value); set(pick.value);
      });
      pick.addEventListener('click', function () { if (okHex(pick.value) && pick.parentNode.classList.contains('set')) set(pick.value); });
    }
    function markSwatches(box, color, erasing) {
      var preset = PALETTE.some(function (c) { return c[0] === color; });
      box.querySelectorAll('.sw[data-c]').forEach(function (b) { b.classList.toggle('on', !erasing && b.dataset.c === color); });
      var any = box.querySelector('.sw.any'); if (any) any.classList.toggle('on', !erasing && !preset && okHex(color));
    }
    function sizesHTML() { return [0, 1, 2].map(function (s) { return '<button class="sz" type="button" data-s="' + s + '" aria-label="' + esc(t('size')) + ' ' + (s + 1) + '"><i></i></button>'; }).join(''); }

    /* ---------- pen on the page ---------- */
    var Ink = (function () {
      var mod, item, host, cv, bar, on = false, data, undo = [], tool = 'pen', color = '#C2187A', size = 1, pid = null, sawPen = false, cur = null, erased = false, ro = null, dpr = 1, saveT;
      var SZ = { pen: [2, 3.5, 6], hl: [14, 20, 28], er: [12, 22, 36] };
      function key(m, it) { return 'ink:' + m.id + ':' + it.id; }
      function has(m, it) { try { var d = JSON.parse(store.get(key(m, it)) || 'null'); return !!(d && d.s && d.s.length); } catch (e) { return false; } }
      function blocks() { return [].slice.call(host.children).filter(function (e) { return e !== cv; }); }
      function hostRect() { return host.getBoundingClientRect(); }
      function anchorRect(i) { var b = blocks()[i]; if (!b) return null; var r = b.getBoundingClientRect(), hr = hostRect(); return { x: r.left - hr.left, y: r.top - hr.top, w: Math.max(r.width, 1), h: Math.max(r.height, 1) }; }
      function toAbs(s) { var a = anchorRect(s.a); if (!a) return null; var out = []; for (var i = 0; i < s.p.length; i += 3) out.push(a.x + s.p[i] * a.w, a.y + s.p[i + 1] * a.h, s.p[i + 2]); return out; }
      function fit() {
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
      function redraw() {
        if (!cv) return; var x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); x.setTransform(dpr, 0, 0, dpr, 0, 0);
        data.s.forEach(function (s) { var p = toAbs(s); if (p) path(x, s, p); });
        if (cur) path(x, cur, cur.abs);
      }
      function save() { clearTimeout(saveT); saveT = setTimeout(function () { store.set(key(mod, item), data.s.length ? JSON.stringify(data) : ''); var b = document.getElementById('inkBtn'); if (b) b.classList.toggle('has', data.s.length > 0); }, 200); }
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
        var a = cur.abs, cy = 0, n = a.length / 3; for (var i = 0; i < a.length; i += 3) cy += a[i + 1]; cy /= n;
        var bl = blocks(), hr = hostRect(), best = 0, bd = 1e9;
        bl.forEach(function (b, j) { var r = b.getBoundingClientRect(), top = r.top - hr.top, bot = top + r.height; var d = cy < top ? top - cy : cy > bot ? cy - bot : 0; if (d < bd) { bd = d; best = j; } });
        var ar = anchorRect(best), p = [];
        if (!ar) { cur = null; redraw(); return; }
        for (var k = 0; k < a.length; k += 3) p.push(Math.round((a[k] - ar.x) / ar.w * 10000) / 10000, Math.round((a[k + 1] - ar.y) / ar.h * 10000) / 10000, Math.round(a[k + 2] * 100) / 100);
        undo.push(data.s.slice()); if (undo.length > 80) undo.shift();
        data.s = data.s.concat([{ a: best, t: cur.t, c: cur.c, w: cur.w, p: p }]); cur = null; redraw(); save(); ui();
      }
      function erase(q) {
        var r = SZ.er[size] / 2, before = data.s.length;
        data.s = data.s.filter(function (s) { var p = toAbs(s); if (!p) return true; var rr = r + s.w / 2; for (var i = 0; i < p.length; i += 3) { var dx = p[i] - q[0], dy = p[i + 1] - q[1]; if (dx * dx + dy * dy <= rr * rr) return false; } return true; });
        if (data.s.length !== before) { erased = true; redraw(); }
      }
      function setColor(c) { color = c; if (tool === 'er') tool = 'pen'; ui(); }
      function buildBar() {
        bar = document.createElement('div'); bar.className = 'inkbar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', t('pen'));
        bar.innerHTML = '<div class="g"><button class="tb" type="button" data-t="pen" title="' + esc(t('tPen')) + '">' + I.pen + '</button><button class="tb" type="button" data-t="hl" title="' + esc(t('tHl')) + '">' + I.hl + '</button><button class="tb" type="button" data-t="er" title="' + esc(t('tEr')) + '">' + I.er + '</button></div>' +
          '<div class="g sws">' + swatchesHTML() + '</div>' +
          '<div class="g">' + sizesHTML() + '</div>' +
          '<div class="g"><button class="tb" type="button" data-a="undo" title="' + esc(t('tUndo')) + '">' + I.undo + '</button><button class="tb" type="button" data-a="clear" title="' + esc(t('tClearInk')) + '">' + I.trash + '</button>' +
          '<span class="confirm"><span>' + esc(t('clearInkQ')) + '</span><button class="btn sm" type="button" data-a="yes">' + esc(t('clearYes')) + '</button><button class="btn ghost sm" type="button" data-a="no">' + esc(t('clearNo')) + '</button></span>' +
          '<button class="btn sm" type="button" data-a="done">' + esc(t('done')) + '</button></div>';
        paintSwatches(bar); bindAny(bar, setColor);
        bar.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          if (b.dataset.t) tool = b.dataset.t;
          else if (b.dataset.c) { setColor(b.dataset.c); return; }
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
        markSwatches(bar, color, tool === 'er');
        bar.querySelectorAll('[data-s]').forEach(function (b) { b.classList.toggle('on', +b.dataset.s === size); });
        bar.querySelector('[data-a=undo]').disabled = !undo.length;
      }
      function attach(m, it, el) {
        if (host) detach();
        mod = m; item = it; host = el; undo = [];
        try { data = JSON.parse(store.get(key(m, it)) || 'null') || { s: [] }; } catch (e) { data = { s: [] }; }
        if (!data.s) data = { s: [] };
        host.classList.add('inkhost');
        cv = document.createElement('canvas'); cv.className = 'inklayer'; host.appendChild(cv);
        cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
        if (window.ResizeObserver) { ro = new ResizeObserver(function () { fit(); }); ro.observe(host); }
        window.addEventListener('resize', fit);
        requestAnimationFrame(fit); setTimeout(fit, 400);
      }
      function start() { if (!cv) return; on = true; host.classList.add('inking'); if (!bar) buildBar(); bar.classList.add('show'); var b = document.getElementById('inkBtn'); if (b) b.classList.add('active'); ui(); }
      function stop() { on = false; if (host) host.classList.remove('inking'); if (bar) bar.classList.remove('show'); var b = document.getElementById('inkBtn'); if (b) b.classList.remove('active'); }
      function toggle() { if (on) stop(); else start(); }
      function detach() { stop(); if (ro) { ro.disconnect(); ro = null; } window.removeEventListener('resize', fit); if (bar) { bar.remove(); bar = null; } if (cv) cv.remove(); cv = null; host = null; }
      return { attach: attach, detach: detach, toggle: toggle, stop: stop, has: has, isOn: function () { return on; }, redraw: function () { if (cv) redraw(); } };
    })();

    /* ---------- scratch pad ---------- */
    var Pad = (function () {
      var W = 1000, H = 1400;
      var el = null, mod, item, doc, page, undo = [], redo = [], tool = 'pen', color = 'ink', size = 1, bgc, base, live, scale = 1, dpr = 1;
      var drawing = null, pid = null, sawPen = false, erased = null, saveT = null, keyBound = false;
      var SIZES = { pen: [2.2, 4, 8], hl: [18, 28, 40], er: [16, 28, 48] };
      function key() { return 'pad:' + mod.id + ':' + item.id; }
      function load() {
        var raw = store.get(key()), d = null;
        try { d = raw ? JSON.parse(raw) : null; } catch (e) {}
        if (!d || !d.pages || !d.pages.length) d = { pages: [{ bg: 'lines', s: [] }], cur: 0 };
        return d;
      }
      function hasInk(m, it) { var raw = store.get('pad:' + m.id + ':' + it.id); if (!raw) return false; try { return JSON.parse(raw).pages.some(function (p) { return p.s.length; }); } catch (e) { return false; } }
      function persist() { var any = doc.pages.some(function (p) { return p.s.length; }); store.set(key(), any || doc.pages.length > 1 ? JSON.stringify(doc) : ''); }
      function save() {
        clearTimeout(saveT);
        saveT = setTimeout(function () {
          persist();
          var sv = el && el.querySelector('.saved'); if (sv) sv.textContent = t('padSaved');
          var f = document.getElementById('fab'); if (f) f.classList.toggle('has', hasInk(mod, item));
        }, 250);
      }
      function setColor(c) { color = c; if (tool === 'er') tool = 'pen'; ui(); }
      function build() {
        el = document.createElement('div'); el.className = 'pad'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
        var ar = rtl();
        el.innerHTML = '<div class="sheet"><div class="ph"><span class="pt"></span><span class="saved"></span><button type="button" data-a="close" aria-label="' + esc(t('close')) + '">' + I.close + '</button></div>' +
          '<div class="tools"><div class="g"><button class="tb" type="button" data-t="pen" title="' + esc(t('tPen')) + '">' + I.pen + '</button><button class="tb" type="button" data-t="hl" title="' + esc(t('tHl')) + '">' + I.hl + '</button><button class="tb" type="button" data-t="er" title="' + esc(t('tEr')) + '">' + I.er + '</button></div>' +
          '<div class="g sws">' + swatchesHTML() + '</div>' +
          '<div class="g">' + sizesHTML() + '</div>' +
          '<div class="g"><button class="tb" type="button" data-a="undo" title="' + esc(t('tUndo')) + '">' + I.undo + '</button><button class="tb" type="button" data-a="redo" title="' + esc(t('tRedo')) + '">' + I.redo + '</button></div>' +
          '<div class="g"><button class="tb" type="button" data-b="blank" title="' + esc(t('bBlank')) + '">' + I.blank + '</button><button class="tb" type="button" data-b="lines" title="' + esc(t('bLines')) + '">' + I.lines + '</button><button class="tb" type="button" data-b="grid" title="' + esc(t('bGrid')) + '">' + I.grid + '</button></div></div>' +
          '<div class="stage"><div class="paper"><canvas class="c-bg"></canvas><canvas class="c-base"></canvas><canvas class="c-live"></canvas></div></div>' +
          '<div class="foot"><button class="tb" type="button" data-a="pprev" title="' + esc(t('pPrev')) + '">' + (ar ? I.next : I.prev) + '</button><span class="pg"></span><button class="tb" type="button" data-a="pnext" title="' + esc(t('pNext')) + '">' + (ar ? I.prev : I.next) + '</button><button class="tb" type="button" data-a="padd" title="' + esc(t('pAdd')) + '">' + I.plus + '</button>' +
          '<span class="sp hint">' + esc(t('padHint')) + '</span>' +
          '<span class="confirm"><span>' + esc(t('clearQ')) + '</span><button class="btn sm" type="button" data-a="clearyes">' + esc(t('clearYes')) + '</button><button class="btn ghost sm" type="button" data-a="clearno">' + esc(t('clearNo')) + '</button></span>' +
          '<button class="tb" type="button" data-a="clear" title="' + esc(t('tClear')) + '">' + I.trash + '</button><button class="tb" type="button" data-a="dl" title="' + esc(t('tDl')) + '">' + I.dl + '</button></div></div>';
        document.body.appendChild(el);
        paintSwatches(el); bindAny(el, setColor);
        bgc = el.querySelector('.c-bg'); base = el.querySelector('.c-base'); live = el.querySelector('.c-live');
        el.addEventListener('click', function (e) {
          if (e.target === el) { close(); return; }
          var b = e.target.closest('button'); if (!b) return;
          if (b.dataset.t) { tool = b.dataset.t; ui(); }
          else if (b.dataset.c) setColor(b.dataset.c);
          else if (b.dataset.s) { size = +b.dataset.s; ui(); }
          else if (b.dataset.b) { snap(); page.bg = b.dataset.b; drawBg(); save(); ui(); }
          else action(b.dataset.a);
        });
        var paper = el.querySelector('.paper');
        paper.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
        paper.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
        live.addEventListener('pointerdown', down); live.addEventListener('pointermove', move);
        live.addEventListener('pointerup', up); live.addEventListener('pointercancel', up); live.addEventListener('lostpointercapture', up);
        if (!keyBound) {
          keyBound = true;
          window.addEventListener('resize', function () { if (isOpen()) layout(); });
          document.addEventListener('keydown', function (e) {
            if (!isOpen()) return;
            if (e.key === 'Escape') close();
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); action(e.shiftKey ? 'redo' : 'undo'); }
          });
        }
      }
      function isOpen() { return !!el && el.classList.contains('open'); }
      function action(a) {
        if (a === 'close') { close(); return; }
        if (a === 'undo' && undo.length) { redo.push(page.s); page.s = undo.pop(); redraw(); save(); }
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
        markSwatches(el, color, tool === 'er');
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
        scale = Math.max(0.1, Math.min((r.width - 24) / W, (r.height - 24) / H));
        var cw = Math.floor(W * scale), ch = Math.floor(H * scale);
        var paper = el.querySelector('.paper'); paper.style.width = cw + 'px'; paper.style.height = ch + 'px';
        dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        [bgc, base, live].forEach(function (c) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); var x = c.getContext('2d'); x.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0); x.lineCap = 'round'; x.lineJoin = 'round'; });
        drawBg(); redraw();
      }
      function drawBg() {
        var x = bgc.getContext('2d'); x.clearRect(0, 0, W, H);
        var line = cssVar(['--border', '--line', '--p-line'], '#E4E1D9'), accent = cssVar(['--mag', '--orange-btn', '--p-accent'], '#C2410C');
        x.lineWidth = 1.2; x.strokeStyle = line; x.globalAlpha = 1;
        if (page.bg === 'lines') { for (var y = 110; y < H - 20; y += 52) { x.beginPath(); x.moveTo(40, y); x.lineTo(W - 40, y); x.stroke(); } x.strokeStyle = accent; x.globalAlpha = .35; x.beginPath(); var mx = rtl() ? W - 110 : 110; x.moveTo(mx, 30); x.lineTo(mx, H - 30); x.stroke(); x.globalAlpha = 1; }
        if (page.bg === 'grid') { for (var gy = 50; gy < H; gy += 50) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); } for (var gx = 50; gx < W; gx += 50) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke(); } }
      }
      function strokePath(x, s) {
        var p = s.p, n = p.length / 3;
        x.strokeStyle = col(s.c); x.fillStyle = col(s.c);
        if (s.t === 'hl') { x.globalAlpha = .32; x.globalCompositeOperation = isDark() ? 'screen' : 'multiply'; } else { x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
        if (n === 1) { x.beginPath(); x.arc(p[0], p[1], s.w / 2, 0, Math.PI * 2); x.fill(); }
        else if (s.t === 'hl' || !s.pr) {
          x.lineWidth = s.w; x.lineCap = s.t === 'hl' ? 'square' : 'round'; x.beginPath(); x.moveTo(p[0], p[1]);
          for (var i = 1; i < n - 1; i++) { x.quadraticCurveTo(p[i * 3], p[i * 3 + 1], (p[i * 3] + p[i * 3 + 3]) / 2, (p[i * 3 + 1] + p[i * 3 + 4]) / 2); }
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
        drawing = { t: tool, c: tool === 'hl' && color === 'ink' ? '#EAB308' : color, w: SIZES[tool][size], p: q.slice(), pr: e.pointerType === 'pen' };
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
          var p = drawing.p; if (Math.abs(q[0] - p[p.length - 3]) + Math.abs(q[1] - p[p.length - 2]) < 1.2) return;
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
        page.s = page.s.filter(function (s) { var p = s.p, rr = r + s.w / 2; for (var i = 0; i < p.length; i += 3) { var dx = p[i] - q[0], dy = p[i + 1] - q[1]; if (dx * dx + dy * dy <= rr * rr) return false; } return true; });
        if (page.s.length !== before) { erased = true; redraw(); }
      }
      function download() {
        var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d');
        x.fillStyle = cssVar(['--panel', '--card', '--p-card'], '#FFFFFF'); x.fillRect(0, 0, W, H);
        x.drawImage(bgc, 0, 0, W, H); x.drawImage(base, 0, 0, W, H);
        try { var a = document.createElement('a'); a.download = 'scratch-' + mod.id + '-' + item.id + '-p' + (doc.cur + 1) + '.png'; a.href = c.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
      }
      function open(m, it, title) {
        if (el) { el.remove(); el = null; }
        mod = m; item = it; doc = load(); build();
        el.querySelector('.pt').textContent = t('scratch') + (title ? ' · ' + title : '');
        el.classList.add('open'); document.body.style.overflow = 'hidden';
        setPage(); requestAnimationFrame(layout);
        var first = el.querySelector('[data-t=pen]'); if (first) first.focus();
      }
      function close() { if (!isOpen()) return; clearTimeout(saveT); persist(); el.classList.remove('open'); document.body.style.overflow = ''; var f = document.getElementById('fab'); if (f) { f.classList.toggle('has', hasInk(mod, item)); f.focus(); } }
      return { open: open, close: close, hasInk: hasInk, isOpen: isOpen };
    })();

    return { Ink: Ink, Pad: Pad, icons: I, palette: PALETTE };
  };
})();
