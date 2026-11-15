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
  const isAB = j => j.target && j.target.mode === 'ab';
  const isLesson = j => j.target && j.target.mode === 'lesson';
  // Which side is "A" in a pair: fixed per job and pair, so a reload doesn't reshuffle
  const oursIsA = (id, i) => { let h = i * 31; for (const c of id) h = (h * 33 + c.charCodeAt(0)) >>> 0; return h % 2 === 0; };

  const signedUrl = async (path, download) => {
    if (!path) return null;
    const r = await safe(db().storage.from('voice').createSignedUrl(path, 3600, download ? { download } : undefined));
    return r.data && r.data.signedUrl;
  };
  const ago = d => { const s = (Date.now() - new Date(d)) / 1000; return s < 90 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : fmtDay(d) + ' ' + fmtTime(d); };
  const mmss = s => { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const fileName = (t, ext) => (String(t || 'narration').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'narration') + '.' + ext;

  // The blind test: each pair plays the same words twice, once ElevenLabs and once your clone, in a fixed random order.
  async function abTest(j, box){
    const u = await signedUrl(j.output_json); const man = u && await fetch(u).then(x => x.json()).catch(() => null);
    if (!man) { box.innerHTML = empty('Couldn’t load the test.'); return; }
    const votes = {}; const v = await safe(db().from('voice_ab_votes').select('pair,picked').eq('job_id', j.id));
    (v.data || []).forEach(x => votes[x.pair] = x.picked);
    const folder = j.output_json.replace(/pairs\.json$/, '');
    const score = () => {
      const all = Object.values(votes), n = all.length;
      if (!n) return 'Listen to each pair and pick the one that sounds better. Pick “Same” if you can’t tell.';
      const ours = all.filter(x => x === 'ours').length, same = all.filter(x => x === 'same').length, el = n - ours - same;
      const pct = Math.round((ours + same) / n * 100);
      return n + ' of ' + man.pairs.length + ' voted · yours better ' + ours + ' · same ' + same + ' · ElevenLabs better ' + el +
        ' · yours equal or better: ' + pct + '%' + (n === man.pairs.length ? (pct >= 50 ? ' · goal reached' : ' · goal is 50% or more') : '');
    };
    box.innerHTML = '<div class="vs-ab"><p class="p-empty" id="abScore">' + esc(score()) + '</p>' + man.pairs.map(p => {
      const a = oursIsA(j.id, p.i);
      return '<div class="p-row" data-pair="' + p.i + '"><span><small>Pair ' + (p.i + 1) + '</small><br>' +
        'A <audio controls preload="none" data-src="' + esc(folder + 'p' + p.i + '_' + (a ? 'o' : 'e') + p.ext) + '"></audio> ' +
        'B <audio controls preload="none" data-src="' + esc(folder + 'p' + p.i + '_' + (a ? 'e' : 'o') + p.ext) + '"></audio>' +
        '<br><small class="ab-reveal">' + (votes[p.i] ? 'A was ' + (a ? 'yours' : 'ElevenLabs') + ' · “' + esc(p.text) + '”' : '') + '</small></span>' +
        '<span class="px-tools"><button class="p-btn is-ghost" type="button" data-v="A">A better</button><button class="p-btn is-ghost" type="button" data-v="same">Same</button><button class="p-btn is-ghost" type="button" data-v="B">B better</button></span></div>';
    }).join('') + '</div>';
    box.querySelectorAll('audio[data-src]').forEach(async au => { const s2 = await signedUrl(au.dataset.src); if (s2) au.src = s2; });
    box.querySelectorAll('[data-pair]').forEach(row => row.addEventListener('click', async ev => {
      const b = ev.target.closest('button[data-v]'); if (!b) return;
      const i = +row.dataset.pair, a = oursIsA(j.id, i), p = man.pairs.find(x => x.i === i);
      const picked = b.dataset.v === 'same' ? 'same' : ((b.dataset.v === 'A') === a ? 'ours' : 'elevenlabs');
      const r = await safe(db().from('voice_ab_votes').upsert({ job_id:j.id, pair:i, picked }, { onConflict:'job_id,pair' }));
      if (r.error) { b.textContent = 'Couldn’t save'; return; }
      votes[i] = picked;
      row.querySelector('.ab-reveal').textContent = 'A was ' + (a ? 'yours' : 'ElevenLabs') + ' · “' + p.text + '”';
      box.querySelector('#abScore').textContent = score();
    }));
  }

  V.voice = { title:'Voice Studio', sec:'owner', async open(el, ok){
    if (timer) { clearInterval(timer); timer = null; }
    const body = page(el, 'Course tools', 'Voice Studio', 'Narration in your own cloned voice, made on your PC. No ElevenLabs credits. Keep the worker window open on yukis-pc while it works.');
    const [w, jobs, pron] = await Promise.all([
      safe(db().from('voice_worker').select('*').eq('id', 'main').maybeSingle()),
      safe(db().from('voice_jobs').select('id,title,status,progress,message,language,mood,target,duration_s,needs_review,output_mp3,output_wav,output_json,parent_id,redo_piece,created_at,finished_at').order('created_at', { ascending:false }).limit(30)),
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
        (j.status === 'done' && isAB(j) ? '<button class="p-btn" type="button" data-act="ab">Take the blind test</button>' : '') +
        (j.status === 'done' && !isAB(j) ? '<button class="p-btn is-ghost" type="button" data-act="play">Play</button><button class="p-btn is-ghost" type="button" data-act="mp3">MP3</button><button class="p-btn is-ghost" type="button" data-act="wav">WAV</button><button class="p-btn is-ghost" type="button" data-act="pieces">Pieces</button>' : '') +
        (live ? '<button class="p-btn is-ghost" type="button" data-act="cancel">Cancel</button>' : '') +
        '</span><div class="vs-more px-wide" hidden></div></div>';
    });

    const pronRows = (pron.data || []).map(p => '<div class="p-row"><span><b>' + esc(p.written) + '</b> → ' + esc(p.spoken) + ' <small>' + esc(p.language) + '</small></span>' +
      '<button class="p-btn is-ghost px-del" type="button" data-pron="' + p.id + '">Remove</button></div>');
    const pronForm = '<form class="px-form" id="vsPron" novalidate>' + f('Written', '<input type="text" id="vsPw" maxlength="80" placeholder="Hillsborough">') +
      f('Say it as', '<input type="text" id="vsPs" maxlength="120" placeholder="Hills burrow">') +
      f('Language', '<select id="vsPl">' + opt('en', 'English', true) + opt('ar', 'Arabic') + '</select>') +
      '<button class="p-btn" type="submit">Add</button><p class="p-empty" id="vsPmsg" role="status"></p></form>';

    const abForm = '<form class="px-form" id="vsAb" novalidate><p class="p-empty px-wide">Upload a voice-only ElevenLabs narration (at least a minute). Your PC makes the same sentences in your voice, then you listen to the pairs without knowing which is which.</p>' +
      f('ElevenLabs file (MP3 or WAV)', '<input type="file" id="vsAbFile" accept="audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav">', 'px-wide') +
      '<button class="p-btn" type="submit">Make the blind test</button><p class="p-empty" id="vsAbMsg" role="status"></p></form>';
    body.innerHTML = card('Worker', '', status) + card('New narration', '', form) +
      card('Narrations', 'last 30', rows.length ? rows.join('') : empty('Nothing yet.')) +
      card('Blind test', 'your voice vs ElevenLabs', abForm) +
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
      const b = ev.target.closest('button[data-act], button[data-redo]'); if (!b || b.closest('.vs-ab')) return;
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
      } else if (b.dataset.act === 'ab') {
        if (!more.hidden) { more.hidden = true; return; }
        more.hidden = false; more.innerHTML = '<p class="p-loading">Loading…</p>';
        abTest(j, more);
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
          text:full.data.text, language:j.language, mood:j.mood, parent_id:j.id, redo_piece:+b.dataset.redo, target:isLesson(j) ? j.target : null }));
        if (r.error) { b.textContent = 'Couldn’t'; return; }
        V.voice.open(el, ok);
      }
    }));

    $('vsAb').addEventListener('submit', async ev => {
      ev.preventDefault(); const file = $('vsAbFile').files[0];
      if (!file) return say('vsAbMsg', 'Choose the ElevenLabs file first.');
      if (file.size > 50 * 1024 * 1024) return say('vsAbMsg', 'That file is over 50 MB.');
      const ext = /\.wav$/i.test(file.name) ? 'wav' : 'mp3';
      const path = 'ab/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now()) + '/eleven.' + ext;
      say('vsAbMsg', 'Uploading…');
      const up = await safe(db().storage.from('voice').upload(path, file, { contentType:ext === 'wav' ? 'audio/wav' : 'audio/mpeg' }));
      if (up.error) return say('vsAbMsg', errText(up, 'The upload didn’t work. Try again.'));
      const r = await safe(db().from('voice_jobs').insert({ title:'Blind test: ' + file.name.replace(/\.[^.]+$/, ''), text:'Blind test against ElevenLabs', language:'en', mood:'teaching', target:{ mode:'ab', source:path } }));
      if (r.error) return say('vsAbMsg', errText(r, 'Couldn’t start it. Try again.'));
      V.voice.open(el, ok);
    });

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
      const playing = ($('vsAudio') && !$('vsAudio').paused) || [...body.querySelectorAll('audio')].some(a => !a.paused) || !!body.querySelector('.vs-more:not([hidden])');
      if (!typing && !playing) V.voice.open(el, ok);
    }, live ? 5000 : 30000);
  } };
})();
