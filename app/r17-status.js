// Round 17 (Nov 17 2026), part 5: more on #status (Amr).
//   RentCast        lookups used and left this month. The house calculator counts them in this browser (it stops itself at
//                   48 a month on the free plan), so the number is for this device; other devices keep their own count.
//   Narration PC    is the voice worker online (heartbeat in the last 2 minutes), busy, and its GPU memory.
//   Restore a table open a backup, then "Put back missing rows" on one table: adds the rows from that night that are
//                   missing now. Rows that still exist are left as they are; nothing is deleted or changed. Asks you to type
//                   the table name first. Logged in Logs › Activity.
// Database: portal_restore_rows(table, rows) (owner only, up to 1000 rows per call), voice_worker.
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, esc, safe, isOwner, fmtDay, fmtTime, num, plural, card, pill, errText } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const LIMIT = 48;
  const ls = { keys(){ try { return Object.keys(localStorage); } catch (e) { return []; } }, get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } } };
  const monthNow = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

  // Find the calculator's RentCast counter: the key names come from the live calculator file when it can be read,
  // otherwise any saved key with "rentcast" in its name.
  async function rentcast(){
    let keys = ls.keys().filter(k => /rent\W?cast/i.test(k)), limit = LIMIT;
    try {
      const g = await db().storage.from('deal-tools').download('house-calculator-v2.html');
      if (!g.error && g.data) {
        const src = await g.data.text(), re = /localStorage\.(?:getItem|setItem)\(\s*(['"`])([^'"`]{2,60})\1/g; let m;
        while ((m = re.exec(src))) { const near = src.slice(Math.max(0, m.index - 300), m.index + 300); if (/rent\W?cast|lookup/i.test(near) && !keys.includes(m[2])) keys.push(m[2]); }
        const lim = src.match(/(?:limit|max|cap)\w*\s*[:=]\s*(\d{2,3})\b[^\n]{0,80}(?:rent|lookup)|(?:rent|lookup)[^\n]{0,80}(?:limit|max|cap)\w*\s*[:=]\s*(\d{2,3})\b/i);
        if (lim) limit = +(lim[1] || lim[2]) || LIMIT;
      }
    } catch (e) {}
    const mon = monthNow();
    for (const k of keys) {
      const raw = ls.get(k); if (raw == null) continue;
      if (/^\d+$/.test(raw)) return { used:+raw, limit, key:k, sure:/\d{4}-\d{2}/.test(k) ? k.includes(mon) : true };
      try {
        const v = JSON.parse(raw);
        if (typeof v === 'number') return { used:v, limit, key:k, sure:true };
        if (v && typeof v === 'object') {
          if (v[mon] != null && typeof v[mon] === 'number') return { used:v[mon], limit, key:k, sure:true };
          const month = v.month || v.m || v.period || v.ym, used = [v.count, v.used, v.n, v.calls, v.lookups].find(x => typeof x === 'number');
          if (used != null) return { used:String(month || mon).slice(0, 7) === mon ? used : 0, limit, key:k, sure:true };
          if (Array.isArray(v.log || v.calls || v.times)) { const arr = v.log || v.calls || v.times; return { used:arr.filter(t => String(typeof t === 'object' ? t.at || t.t || '' : new Date(t).toISOString()).slice(0, 7) === mon).length, limit, key:k, sure:true }; }
        }
        if (Array.isArray(v)) return { used:v.filter(t => { try { return new Date(typeof t === 'object' ? t.at || t.t : t).toISOString().slice(0, 7) === mon; } catch (e) { return false; } }).length, limit, key:k, sure:true };
      } catch (e) {}
    }
    return { used:null, limit, keys };
  }

  const st = V.status;
  if (st && !st.r17) {
    const open0 = st.open;
    V.status = Object.assign({}, st, { r17:true, async open(el, ok){
      await open0.call(this, el, ok);
      if (!ok() || !isOwner()) return;
      const body = el.querySelector('.px-body'); if (!body) return;
      const box = document.createElement('div'); box.id = 'r17More';
      const firstCard = body.querySelector('.p-card + .p-card') || body.firstChild; body.insertBefore(box, firstCard ? firstCard.nextSibling : null);
      box.innerHTML = card('More checks', '', '<p class="p-loading">Checking RentCast and the narration PC…</p>');
      const [rc, w] = await Promise.all([rentcast(), safe(db().from('voice_worker').select('id,name,last_seen,busy_job,gpu,version,free_vram_mb').order('last_seen', { ascending:false }).limit(5))]);
      if (!ok()) return;
      const rows = [];
      if (rc.used == null) rows.push(['RentCast lookups', 'ok', 'No lookups counted in this browser this month, so up to ' + rc.limit + ' are left here. The house calculator counts in each browser; open it on the device you use to see that device’s count.']);
      else { const left = Math.max(0, rc.limit - rc.used); rows.push(['RentCast lookups', left === 0 ? 'bad' : left < 10 ? 'warn' : 'ok', '<b>' + num(left) + ' of ' + rc.limit + ' left</b> this month (' + num(rc.used) + ' used in this browser). The calculator stops itself at ' + rc.limit + '.']); }
      const pcs = w.data || [];
      if (w.error) rows.push(['Narration PC', 'warn', 'Couldn’t read the voice worker.']);
      else if (!pcs.length) rows.push(['Narration PC', 'warn', 'No narration PC has connected yet.']);
      else pcs.forEach(p => { const secs = (Date.now() - new Date(p.last_seen)) / 1000, on = secs < 120;
        rows.push([p.name || p.id || 'Narration PC', on ? 'ok' : secs < 3600 ? 'warn' : 'bad', (on ? (p.busy_job ? 'Online, narrating now' : 'Online, waiting for work') : 'Offline since ' + fmtDay(p.last_seen, { month:'short', day:'numeric' }) + ', ' + fmtTime(p.last_seen)) +
          [p.gpu, p.free_vram_mb != null ? num(p.free_vram_mb) + ' MB GPU memory free' : '', p.version ? 'worker ' + p.version : ''].filter(Boolean).map(x => ' · ' + esc(x)).join('')]); });
      const L = { ok:['All good', 'ok'], warn:['Check', ''], bad:['Problem', 'no'] };
      box.innerHTML = card('More checks', 'RentCast and narration', rows.map(([n, l, t]) => '<div class="p-row r6-check"><span class="r6-dot is-' + l + '" aria-hidden="true"></span><span><b>' + esc(n) + '</b><br><small>' + t + '</small></span>' + pill(L[l][0], L[l][1]) + '</div>').join(''));

      // Restore: a button on each table of an opened backup
      const addBtns = () => body.querySelectorAll('#r6Tables [data-tn]').forEach(r => {
        if (r.querySelector('[data-restore]') || !window.__r6bk || !(window.__r6bk.tables[r.dataset.tn] || []).length) return;
        r.insertAdjacentHTML('beforeend', '<button type="button" class="p-btn is-ghost" data-restore="' + esc(r.dataset.tn) + '">Put back missing rows</button>');
      });
      const mo = new MutationObserver(() => { if (!document.body.contains(el)) { mo.disconnect(); return; } addBtns(); }); mo.observe(body, { childList:true, subtree:true });
      body.addEventListener('click', async e => {
        const b = e.target.closest('[data-restore]');
        if (b) { const t = b.dataset.restore, row = b.closest('[data-tn]'), n = (window.__r6bk.tables[t] || []).length;
          const old = body.querySelector('.r17-restore'); if (old) { const same = old.dataset.t === t; old.remove(); if (same) return; }
          row.insertAdjacentHTML('afterend', '<div class="r17-restore" data-t="' + esc(t) + '"><p><b>Put back missing rows in “' + esc(t) + '”?</b></p>' +
            '<p>This adds the rows from the backup made ' + esc(fmtDay(window.__r6bk.made, { month:'short', day:'numeric', year:'numeric' }) + ', ' + fmtTime(window.__r6bk.made)) + ' (' + plural(n, 'row') + ') that are missing from the table now. Rows that still exist stay exactly as they are. Nothing is deleted or changed.</p>' +
            '<label class="sc-f">Type the table name to confirm<input type="text" id="r17Type" autocomplete="off" spellcheck="false" placeholder="' + esc(t) + '"></label>' +
            '<div class="px-tools"><button type="button" class="p-btn" id="r17Go" disabled>Put back missing rows</button><button type="button" class="p-btn is-ghost" id="r17No">Cancel</button><span class="p-hint" id="r17Msg" role="status"></span></div></div>');
          return; }
        if (e.target.id === 'r17No') { const x = body.querySelector('.r17-restore'); if (x) x.remove(); return; }
        if (e.target.id === 'r17Go') {
          const wrap = body.querySelector('.r17-restore'), t = wrap.dataset.t, all = window.__r6bk.tables[t] || [], msg = wrap.querySelector('#r17Msg');
          if (wrap.querySelector('#r17Type').value.trim() !== t) return;
          e.target.disabled = true; let added = 0;
          for (let i = 0; i < all.length; i += 500) {
            msg.textContent = 'Checking rows ' + num(i + 1) + ' to ' + num(Math.min(all.length, i + 500)) + ' of ' + num(all.length) + '…';
            const r = await safe(db().rpc('portal_restore_rows', { p_table:t, p_rows:all.slice(i, i + 500) }));
            if (r.error) { msg.textContent = (added ? num(added) + ' rows put back, then it stopped: ' : '') + errText(r, 'Couldn’t put the rows back.'); return; }
            added += +r.data || 0;
          }
          msg.textContent = added ? num(added) + ' missing ' + (added === 1 ? 'row' : 'rows') + ' put back. The other ' + num(all.length - added) + ' were already there.' : 'Nothing was missing: every row from that backup is already in the table.';
        }
      });
      body.addEventListener('input', e => { if (e.target.id === 'r17Type') { const w2 = e.target.closest('.r17-restore'); body.querySelector('#r17Go').disabled = e.target.value.trim() !== w2.dataset.t; } });
    } });
  }
})();
