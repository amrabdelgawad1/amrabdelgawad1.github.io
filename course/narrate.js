// Admin only: "Narrate in my voice" on a lesson, "Narrate the whole module" on a module page.
// Sends the lesson's full text, turned into a speakable script, to Voice Studio (voice_jobs). The worker on
// Amr's PC narrates it and saves content/<module>/narration/<lesson>.mp3 / .wav / .json (captions and chapters)
// in the course bucket, ready for the new longer videos. Nothing a learner sees changes.
(function(){
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const end = s => /[.!?:…]["'”’)]?$/.test(s) ? s : s + '.';

  // Lesson Markdown -> narration script. "# " paragraphs are headings (spoken, and chapters in the video).
  // Tables are read row by row; images and bare links are left out; lists become sentences; formatting marks are dropped.
  function script(md){
    const clean = t => t.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/https?:\/\/\S+|www\.\S+/g, '').replace(/\\([\\`*_{}[\]()#+\-.!|])/g, '$1').replace(/[*_`]+/g, '')
      .replace(/[⁦-⁩]/g, '').replace(/\s*(?:→|->)\s*/g, ', then ')
      .replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').replace(/\b(and|or|see)\s*\.$/i, '').trim();
    const out = []; let para = [], head = null;
    const flush = () => { if (para.length) { out.push(para.join(' ')); para = []; } };
    const cells = l => l.replace(/^\||\|$/g, '').split('|').map(c => clean(c));
    String(md || '').split(/\r?\n/).forEach(raw => {
      const l = raw.trim();
      if (!l) { head = null; return flush(); }
      // tables are read row by row: "What they feel: ... What helps: ..."
      if (/^\|/.test(l)) {
        if (/^\|?\s*:?-{2,}/.test(l)) return;
        const c = cells(l);
        if (!head) { flush(); head = c; return; }
        const row = c.map((v, k) => v ? (head[k] ? head[k] + ': ' : '') + end(v) : '').filter(Boolean).join(' ');
        if (row) out.push(row);
        return;
      }
      head = null;
      if (/^#{1,6} /.test(l)) { flush(); const h = clean(l.replace(/^#+ /, '')); if (h) out.push('# ' + h); return; }
      if (/^\*\*[^*]+\*\*$/.test(l)) { flush(); const h = clean(l); if (h) out.push('# ' + h.replace(/[.:]$/, '')); return; }
      const item = l.match(/^(?:[-*]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/);
      const t = clean(item ? item[1] : l.replace(/^>\s?/, ''));
      if (t) para.push(item ? end(t) : t);
    });
    flush();
    // English narration: Arabic sections are left out (they get their own narration later, in فصحى)
    const arabic = t => { const L = t.replace(/[^\p{L}]/gu, ''); return L && (L.match(/[؀-ۿ]/g) || []).length / L.length > 0.3; };
    return out.filter(p => !arabic(p)).join('\n\n');
  }

  async function latest(db, mod, ids){
    const r = await db.from('voice_jobs').select('id,status,progress,message,created_at,target').eq('target->>module', mod.id)
      .in('target->>lesson', ids).order('created_at', { ascending:false }).limit(200);
    const by = {}; (r.data || []).forEach(j => { const k = j.target.lesson; if (!by[k]) by[k] = j; });
    return { by, error:r.error };
  }
  const job = (mod, it) => ({ title:'Lesson ' + it.id + ' ' + (it.shortTitle || it.title || ''), text:script(it.bodyMarkdown), language:'en', mood:'teaching',
    target:{ mode:'lesson', course:'re', module:mod.id, lesson:it.id } });
  const words = { queued:'waiting for your PC', running:'being narrated', done:'narrated', failed:'failed', cancelled:'cancelled' };
  const notAllowed = e => /row-level|permission|policy|JWT|42501/i.test((e && e.message) || '');

  // Copies narration/<lesson>.mp3/.json to narration/_versions/<lesson>/<time>.* (the same as Voice Studio does)
  async function keep(db, m, l){
    const st = db.storage.from('course'), dir = 'content/' + m + '/narration/', ver = dir + '_versions/' + l;
    const cur = await st.list('content/' + m + '/narration', { limit:1000, search:l + '.' }).catch(() => ({}));
    const mp3 = ((cur && cur.data) || []).find(o => o.name === l + '.mp3'); if (!mp3) return true;
    const tag = new Date(mp3.updated_at || mp3.created_at || Date.now()).toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const have = await st.list(ver, { limit:1000 }).catch(() => ({}));
    if (((have && have.data) || []).some(o => o.name === tag + '.mp3')) return true;
    const c = await st.copy(dir + l + '.mp3', ver + '/' + tag + '.mp3').catch(e => ({ error:e }));
    if (c && c.error) return false;
    await st.copy(dir + l + '.json', ver + '/' + tag + '.json').catch(() => null);
    return true;
  }

  async function lesson(db, mod, it, box){
    if (!box || !it.bodyMarkdown) return;
    const draw = async () => {
      const { by } = await latest(db, mod, [it.id]); const j = by[it.id];
      if (!document.contains(box)) return;
      let play = '';
      if (j && j.status === 'done') {
        const u = await db.storage.from('course').createSignedUrl('content/' + mod.id + '/narration/' + it.id + '.mp3', 3600);
        if (u.data) play = '<audio controls preload="none" src="' + esc(u.data.signedUrl) + '"></audio>';
      }
      box.innerHTML = '<div class="vbox narr"><button type="button" class="link-btn" id="narrGo">' + (j ? 'Narrate again in my voice' : 'Narrate in my voice') + '</button>' +
        '<span class="note" id="narrState" role="status">' + (j ? 'Voice Studio: ' + esc(words[j.status] || j.status) + (j.status === 'running' ? ' (' + Math.round((j.progress || 0) * 100) + '%)' : '') + (j.status === 'failed' && j.message ? ' · ' + esc(j.message) : '') : 'Admin only. Uses your cloned voice on your PC, no credits.') +
        ' · <a href="/app/#voice">Open Voice Studio</a></span>' + play + '</div>';
      box.querySelector('#narrGo').addEventListener('click', async ev => {
        ev.target.disabled = true;
        // keep the narration learners hear now, so it can be put back from Voice Studio (Projects, Versions)
        if (j && j.status === 'done' && !(await keep(db, mod.id, it.id))) { box.querySelector('#narrState').textContent = 'Couldn’t keep a copy of the current narration, so nothing was sent. Try again.'; ev.target.disabled = false; return; }
        const r = await db.from('voice_jobs').insert(job(mod, it));
        if (r.error) { box.querySelector('#narrState').textContent = notAllowed(r.error) ? 'Not allowed here. Sign in to the portal with your authenticator code, then try again.' : 'Couldn’t send it. Try again.'; ev.target.disabled = false; return; }
        draw();
      });
      if (j && (j.status === 'queued' || j.status === 'running')) setTimeout(() => { if (document.contains(box)) draw(); }, 8000);
    };
    draw();
  }

  async function module(db, mod, lessons, box){
    if (!box) return;
    const list = lessons.filter(it => it.bodyMarkdown);
    if (!list.length) return;
    const { by } = await latest(db, mod, list.map(it => it.id));
    if (!document.contains(box)) return;
    const done = list.filter(it => by[it.id] && by[it.id].status === 'done').length, waiting = list.filter(it => by[it.id] && /queued|running/.test(by[it.id].status)).length;
    const chars = list.reduce((n, it) => n + script(it.bodyMarkdown).length, 0);
    box.innerHTML = '<div class="vbox narr"><button type="button" class="link-btn" id="narrMod">Narrate the lessons not done yet</button>' +
      '<span class="note" id="narrModState" role="status">Voice Studio: ' + done + ' of ' + list.length + ' lessons narrated' + (waiting ? ', ' + waiting + ' in the queue' : '') +
      ' · whole module about ' + Math.round(chars / 15 / 60) + ' min of audio, about ' + Math.round(chars / 15 * 3 / 3600 * 10) / 10 + ' h on your PC · <a href="/app/#voice">Open Voice Studio</a></span></div>';
    box.querySelector('#narrMod').addEventListener('click', async ev => {
      const todo = list.filter(it => !by[it.id] || /failed|cancelled/.test(by[it.id].status));
      const st = box.querySelector('#narrModState');
      if (!todo.length) { st.textContent = 'Every lesson here is already narrated or in the queue.'; return; }
      ev.target.disabled = true;
      const r = await db.from('voice_jobs').insert(todo.map(it => job(mod, it)));
      if (r.error) { st.textContent = notAllowed(r.error) ? 'Not allowed here. Sign in to the portal with your authenticator code, then try again.' : 'Couldn’t send them. Try again.'; ev.target.disabled = false; return; }
      st.textContent = todo.length + ' lessons sent to Voice Studio. Your PC works through them in order.';
    });
  }

  window.CourseNarrate = { script, lesson, module };
})();
