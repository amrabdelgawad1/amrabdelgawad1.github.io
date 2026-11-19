// Shared parts for every signed-in page (round 23, plan items I2, I5, I6). Loaded by /app, /cash, the Learning Hub and the courses.
//
//   PortalUI.toast(text, { ms })                      a short note at the bottom of the screen
//   PortalUI.undo({ text, hide, restore, commit })    I5: the 10-second Undo bar. hide() takes the item off the screen now;
//                                                     commit() really deletes or moves it after 10 seconds; Undo calls restore()
//                                                     and nothing is changed. Leaving the page commits straight away.
//   PortalUI.when(date, { date, time, zone })         I6: "Nov 18, 2:40 PM EST" in the person's own time zone (AM/PM always,
//                                                     the zone shown). zone:false hides the zone, date:false shows time only.
//   PortalUI.zone()                                   the person's time zone (Settings › My profile can pin one; else the device's)
//   PortalUI.confirm(o) / PortalUI.prompt(o)          the on-page ask() box, or the browser's own when ask.js isn't on the page
// Styles: /portal-ui.css (.pui-*). Arabic for the words here: app/ar-more.js and the courses' own dictionaries.
(function(){
  'use strict';
  if (window.PortalUI) return;
  const AR = () => { try { return (localStorage.getItem('appLang') === 'ar') || document.documentElement.lang === 'ar'; } catch (e) { return false; } };
  const W = { undo: ['Undo', 'تراجع'], undone: ['Put back.', 'تمت الاستعادة.'], failed: ['Couldn’t save that change. It was put back.', 'تعذّر حفظ التغيير، فأُعيد كما كان.'] };
  const w = k => W[k][AR() ? 1 : 0];

  // ---------- the bar ----------
  let bar, txt, btn, timer = null, pending = null;
  function build(){
    bar = document.createElement('div'); bar.className = 'pui-bar'; bar.setAttribute('role', 'status'); bar.setAttribute('aria-live', 'polite'); bar.hidden = true;
    txt = document.createElement('span'); txt.className = 'pui-bar-t';
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'pui-bar-b';
    const fill = document.createElement('i'); fill.className = 'pui-bar-fill'; fill.setAttribute('aria-hidden', 'true');
    bar.append(txt, btn, fill); document.body.appendChild(bar);
    btn.addEventListener('click', () => {
      const p = pending; pending = null; clearTimeout(timer);
      if (p && p.restore) { try { p.restore(); } catch (e) {} show(w('undone'), 2500); } else hide();
    });
  }
  function hide(){ if (bar) { bar.hidden = true; bar.classList.remove('is-run'); } }
  function show(text, ms, withUndo){
    if (!bar) build();
    txt.textContent = text; btn.hidden = !withUndo; btn.textContent = w('undo');
    bar.style.setProperty('--pui-ms', (ms || 4000) + 'ms');
    bar.hidden = false; bar.classList.remove('is-run'); void bar.offsetWidth; if (withUndo) bar.classList.add('is-run');
    clearTimeout(timer);
    timer = setTimeout(() => { if (withUndo) flush(); hide(); }, ms || 4000);
  }
  async function flush(){
    const p = pending; pending = null; if (!p) return;
    try { const r = await p.commit(); if (r && r.error) throw r.error; if (p.done) p.done(); }
    catch (e) { try { p.restore && p.restore(); } catch (er) {} show(w('failed'), 5000); }
  }
  window.addEventListener('pagehide', () => { if (pending) flush(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && pending) flush(); });

  // ---------- time (I6) ----------
  const deviceZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } };
  const zone = () => { try { return localStorage.getItem('portalZone') || deviceZone(); } catch (e) { return deviceZone(); } };
  const ZONE_NAME = { 'Africa/Cairo': 'Cairo', 'America/New_York': 'New York', 'America/Chicago': 'Chicago', 'America/Denver': 'Denver', 'America/Los_Angeles': 'Los Angeles', 'Europe/London': 'London', 'UTC': 'UTC' };
  function zoneShort(z, d){
    try {
      const p = new Intl.DateTimeFormat('en-US', { timeZone: z, timeZoneName: 'short' }).formatToParts(d || new Date()).find(x => x.type === 'timeZoneName');
      const s = p ? p.value : '';
      return /^GMT[+-]/.test(s) && ZONE_NAME[z] ? ZONE_NAME[z] : s;   // "GMT+2" reads worse than "Cairo"
    } catch (e) { return ''; }
  }
  function when(d, o){
    o = o || {}; if (d == null || d === '') return '';
    const x = d instanceof Date ? d : new Date(d); if (isNaN(x)) return '';
    const z = o.tz || zone(), opt = { timeZone: z, hour12: true };
    if (o.date !== false) { opt.month = 'short'; opt.day = 'numeric'; if (o.year || x.getFullYear() !== new Date().getFullYear()) opt.year = 'numeric'; }
    if (o.time !== false) { opt.hour = 'numeric'; opt.minute = '2-digit'; }
    let s; try { s = new Intl.DateTimeFormat('en-US', opt).format(x); } catch (e) { s = x.toLocaleString('en-US', { hour12: true }); }
    s = s.replace(/\b(a|p)\.?m\.?\b/gi, m => m[0].toUpperCase() + 'M');
    if (o.time !== false && o.zone !== false) { const zs = zoneShort(z, x); if (zs) s += ' ' + zs; }
    return s;
  }

  window.PortalUI = {
    toast(text, o){ show(text, (o && o.ms) || 4000, false); },
    undo(o){
      if (pending) flush();                     // a second delete commits the first one
      try { o.hide && o.hide(); } catch (e) {}
      pending = o; show(o.text, o.ms || 10000, true);
    },
    // I5, part 2: one call for "delete this row, with Undo". rows: the elements to take off the screen (default: the
    // button's row). run(): the real delete, after 10 seconds (return the Supabase result; an error puts the row back).
    // after(): what the page did before once a delete finished (reload, redraw).
    del(btn, o){
      const rows = (o.rows || [btn.closest(o.sel || '.p-row, li, tr, [data-cl], .p-card') || btn]).filter(Boolean);
      const label = btn.textContent;
      btn.disabled = true;
      this.undo({ text: o.text || (AR() ? 'تم الحذف.' : 'Deleted.'),
        hide: () => rows.forEach(r => { r.hidden = true; }),
        restore: () => { rows.forEach(r => { r.hidden = false; }); btn.disabled = false; if (btn.dataset.sure) { btn.dataset.sure = ''; btn.textContent = o.label || label; } },
        commit: o.run, done: o.after });
    },
    when, zone, deviceZone, zoneShort,
    setZone(z){ try { if (z) localStorage.setItem('portalZone', z); else localStorage.removeItem('portalZone'); } catch (e) {} },
    confirm(o){
      o = Object.assign({}, o);
      if (AR() || document.documentElement.dir === 'rtl') { if (!o.ok) o.ok = 'موافق'; if (!o.cancel) o.cancel = 'إلغاء'; }
      return window.ask ? window.ask(o) : Promise.resolve(window.confirm([o.title, o.msg].filter(Boolean).join('\n\n')));
    },
    prompt(o){ return window.ask ? window.ask(Object.assign({}, o, { input: o.input || {} })) : Promise.resolve(window.prompt([o.title, o.msg].filter(Boolean).join('\n\n'), (o.input && o.input.value) || '')); }
  };
})();
