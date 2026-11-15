// Voice Studio (Amr only, #voice): narration in Amr's cloned voice, made on his own PC instead of ElevenLabs.
// The page only adds jobs to the voice_jobs table; the worker on yukis-pc (voice-studio-worker, start-worker.bat)
// picks them up, narrates them and uploads the audio to the private "voice" bucket.
// Database: voice_jobs, voice_pronunciations, voice_worker, bucket "voice" (owner only through is_tracker_admin()).
(function(){
  'use strict';
  const PX = window.PX, V = window.PortalViews;
  if (!PX || !V) return;
  const { T, $, esc, safe, fmtDay, fmtTime, card, empty, failed, pill, f, opt, bar, widths, say, errText, page } = PX;
  const db = () => T().db;
  const MOOD_NAMES = { teaching:'Teaching (default)', warm:'Warm', serious:'Serious', energetic:'Energetic' };
  const STATUS = { queued:['Waiting', ''], running:['Making it', 'warn'], done:['Ready', 'ok'], failed:['Failed', 'bad'], cancelled:['Cancelled', ''] };
  let timer = null;

  const signedUrl = async (path, download) => {
    if (!path) return null;
    const r = await safe(db().storage.from('voice').createSignedUrl(path, 3600, download ? { download } : undefined));
    return r.data && r.data.signedUrl;
  };
  const ago = d => { const s = (Date.now() - new Date(d)) / 1000; return s < 90 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : fmtDay(d) + ' ' + fmtTime(d); };
  const mmss = s => { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const fileName = (t, ext) => (String(t || 'narration').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'narration') + '.' + ext;

  V.voice = { title:'Voice Studio', sec:'owner', async open(el, ok){
    if (timer) { clearInterval(timer); timer = null; }
    const body = page(el, 'Course tools', 'Voice Studio', 'Narration in your own cloned voice, made on your PC. No ElevenLabs credits. Keep the worker window open on yukis-pc while it works.');
    const [w, jobs, pron] = await Promise.all([
      safe(db().from('voice_worker').select('*').eq('id', 'main').maybeSingle()),
      safe(db().from('voice_jobs').select('id,title,status,progress,message,language,mood,duration_s,needs_review,output_mp3,output_wav,output_json,parent_id,redo_piece,created_at,finished_at').order('created_at', { ascending:false }).limit(30)),
      safe(db().from('voice_pronunciations').select('id,written,spoken,language').order('written'))]);
    if (!ok()) return;
    if (jobs.error) { body.innerHTML = failed(jobs.error); return; }
    const wk = w.data, online = wk && (Date.now() - new Date(wk.last_seen)) < 70000;
    const moods = (wk && wk.moods || ['teaching']).filter(m => !/_ar$/.test(m));
    const hasAr = wk && (wk.moods || []).includes('teaching_ar');

    const status = '<div class="p-row"><span>' + (online ? pill('Worker online', 'ok') : pill('Worker offline', 'bad')) +
      ' <small>' + (wk ? (online ? esc(wk.gpu || '') + (wk.busy_job ? ' · working on a narration' : ' · ready') : 'last seen ' + esc(ago(wk.last_seen))) : 'never connected') + '</small></span></div>' +
      (online ? '' : '<p class="p-empty">Jobs wait in the queue until the worker is on. On yukis-pc, double-click <b>start-worker.bat</b> in D:\\Work\\voice-cloning.</p>') +
      (wk ? '<p class="p-empty">Voices on the PC: ' + esc((wk.moods || []).join(', ') || 'none') + (hasAr ? '' : ' · no Arabic clip, so Arabic will carry an English accent') + '</p>' : '');

    const form = '<form class="px-form" id="vsForm" novalidate>' +
      f('Title', '<input type="text" id="vsTitle" maxlength="120" placeholder="e.g. Lesson 11.3 Small yeses and price">', 'px-wide') +
      f('Script', '<textarea id="vsText" rows="10" maxlength="200000" placeholder="Paste the script. Blank line = new paragraph. Start a paragraph with [warm], [serious], [energetic] or [teaching] to change the mood. English and Arabic can be mixed."></textarea>', 'px-wide') +
      f('Language', '<select id="vsLang">' + opt('auto', 'Detect each sentence', true) + opt('en', 'English') + opt('ar', 'Arabic') + '</select>') +
      f('Default mood', '<select id="vsMood">' + moods.map(m => opt(m, MOOD_NAMES[m] || m, m === 'teaching')).join('') + '</select>') +
      '<p class="p-empty px-wide" id="vsEst" role="status"></p>' +
      '<button class="p-btn" type="submit">Make narration</button><p class="p-empty" id="vsMsg" role="status"></p></form>';

    const rows = (jobs.data || []).map(j => {
      const [label, kind] = STATUS[j.status] || [j.status, ''];
      const live = j.status === 'queued' || j.status === 'running';
      return '<div class="p-row vs-job" data-id="' + j.id + '"><span><b>' + esc(j.title) + '</b> ' + pill(label, kind) +
        (j.needs_review && j.needs_review.length ? ' ' + pill(j.needs_review.length + ' to check', 'warn') : '') +
        '<br><small>' + esc(ago(j.created_at)) + (j.duration_s ? ' · ' + mmss(j.duration_s) : '') + (j.redo_piece != null ? ' · piece ' + j.redo_piece + ' redone' : '') +
        (j.message && j.status !== 'done' ? ' · ' + esc(j.message) : '') + '</small>' +
        (j.status === 'running' ? '<br>' + bar(Math.round((j.progress || 0) * 100), 100) : '') + '</span>' +
        '<span class="px-tools">' +
        (j.status === 'done' ? '<button class="p-btn is-ghost" type="button" data-act="play">Play</button><button class="p-btn is-ghost" type="button" data-act="mp3">MP3</button><button class="p-btn is-ghost" type="button" data-act="wav">WAV</button><button class="p-btn is-ghost" type="button" data-act="pieces">Pieces</button>' : '') +
        (live ? '<button class="p-btn is-ghost" type="button" data-act="cancel">Cancel</button>' : '') +
        '</span><div class="vs-more px-wide" hidden></div></div>';
    });

    const pronRows = (pron.data || []).map(p => '<div class="p-row"><span><b>' + esc(p.written) + '</b> → ' + esc(p.spoken) + ' <small>' + esc(p.language) + '</small></span>' +
      '<button class="p-btn is-ghost px-del" type="button" data-pron="' + p.id + '">Remove</button></div>');
    const pronForm = '<form class="px-form" id="vsPron" novalidate>' + f('Written', '<input type="text" id="vsPw" maxlength="80" placeholder="Hillsborough">') +
      f('Say it as', '<input type="text" id="vsPs" maxlength="120" placeholder="Hills burrow">') +
      f('Language', '<select id="vsPl">' + opt('en', 'English', true) + opt('ar', 'Arabic') + '</select>') +
      '<button class="p-btn" type="submit">Add</button><p class="p-empty" id="vsPmsg" role="status"></p></form>';

    body.innerHTML = card('Worker', '', status) + card('New narration', '', form) +
      card('Narrations', 'last 30', rows.length ? rows.join('') : empty('Nothing yet.')) +
      card('Pronunciations', 'how names and words are said', (pronRows.length ? pronRows.join('') : empty('None yet.')) + pronForm) +
      '<audio id="vsAudio" controls preload="none" hidden></audio>';
    widths(body);

    // rough time on the RTX 3050: about 15 characters a second of audio, about 3 seconds of work per second of audio
    const est = () => { const n = $('vsText').value.length; const secs = n / 15; say('vsEst', n ? n.toLocaleString() + ' characters · about ' + mmss(secs) + ' of audio · about ' + Math.max(1, Math.round(secs * 3 / 60)) + ' min to make' : ''); };
    $('vsText').addEventListener('input', est);

    $('vsForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const text = $('vsText').value.trim();
      if (!text) return say('vsMsg', 'Paste a script first.');
      const r = await safe(db().from('voice_jobs').insert({ title:$('vsTitle').value.trim() || text.slice(0, 50), text, language:$('vsLang').value, mood:$('vsMood').value }));
      if (r.error) return say('vsMsg', errText(r, 'Couldn’t add it. Try again.'));
      V.voice.open(el, ok);
    });

    body.querySelectorAll('.vs-job').forEach(row => row.addEventListener('click', async ev => {
      const b = ev.target.closest('button[data-act], button[data-redo]'); if (!b) return;
      const j = (jobs.data || []).find(x => x.id === row.dataset.id); if (!j) return;
      const more = row.querySelector('.vs-more');
      if (b.dataset.act === 'play') {
        const a = $('vsAudio'); const u = await signedUrl(j.output_mp3 || j.output_wav); if (!u) return;
        a.hidden = false; row.appendChild(a); a.src = u; a.play().catch(() => {});
      } else if (b.dataset.act === 'mp3' || b.dataset.act === 'wav') {
        const p = b.dataset.act === 'mp3' ? (j.output_mp3 || j.output_wav) : j.output_wav;
        const u = await signedUrl(p, fileName(j.title, p.split('.').pop())); if (u) location.href = u;
      } else if (b.dataset.act === 'cancel') {
        await safe(db().from('voice_jobs').update({ status:'cancelled', message:'Cancelled' }).eq('id', j.id).in('status', ['queued', 'running']));
        V.voice.open(el, ok);
      } else if (b.dataset.act === 'pieces') {
        if (!more.hidden) { more.hidden = true; return; }
        more.hidden = false; more.innerHTML = '<p class="p-loading">Loading…</p>';
        const u = await signedUrl(j.output_json); const m = u && await fetch(u).then(x => x.json()).catch(() => null);
        if (!m) { more.innerHTML = empty('Couldn’t load the pieces.'); return; }
        more.innerHTML = m.pieces.map(p => '<div class="p-row"><span><small>#' + p.i + ' · ' + mmss(p.start) + ' · ' + esc(p.mood) + (p.language === 'ar' ? ' · Arabic' : '') +
          (p.ok ? '' : ' · ' + esc(p.reason || 'check this one')) + '</small><br>' + esc(p.text) + '</span>' +
          '<button class="p-btn is-ghost" type="button" data-redo="' + p.i + '">Redo</button></div>').join('');
      } else if (b.dataset.redo != null) {
        // build on this exact version (a redo of a redo keeps the earlier fixes); the worker reuses every other piece
        const full = await safe(db().from('voice_jobs').select('text').eq('id', j.id).single());
        if (!full.data) { b.textContent = 'Couldn’t'; return; }
        const r = await safe(db().from('voice_jobs').insert({ title:j.title.replace(/ \(piece \d+ redone\)$/, '') + ' (piece ' + b.dataset.redo + ' redone)',
          text:full.data.text, language:j.language, mood:j.mood, parent_id:j.id, redo_piece:+b.dataset.redo }));
        if (r.error) { b.textContent = 'Couldn’t'; return; }
        V.voice.open(el, ok);
      }
    }));

    $('vsPron').addEventListener('submit', async ev => {
      ev.preventDefault(); const w1 = $('vsPw').value.trim(), s1 = $('vsPs').value.trim();
      if (!w1 || !s1) return say('vsPmsg', 'Fill in both.');
      const r = await safe(db().from('voice_pronunciations').upsert({ written:w1, spoken:s1, language:$('vsPl').value }, { onConflict:'written,language' }));
      if (r.error) return say('vsPmsg', errText(r, 'Couldn’t save it.'));
      V.voice.open(el, ok);
    });
    body.querySelectorAll('[data-pron]').forEach(b => b.addEventListener('click', async () => {
      await safe(db().from('voice_pronunciations').delete().eq('id', b.dataset.pron)); V.voice.open(el, ok);
    }));

    // keep the list fresh while something is waiting or being made (and the worker status current)
    const live = (jobs.data || []).some(j => j.status === 'queued' || j.status === 'running');
    timer = setInterval(async () => {
      if (!ok() || !document.body.contains(body)) { clearInterval(timer); timer = null; return; }
      const typing = document.activeElement && body.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      const playing = $('vsAudio') && !$('vsAudio').paused;
      if (!typing && !playing) V.voice.open(el, ok);
    }, live ? 5000 : 30000);
  } };
})();
