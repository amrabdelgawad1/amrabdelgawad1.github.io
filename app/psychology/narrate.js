// Owner only (Nov 2026): "Narrate in Arabic" under each Psychology section, and "Narrate this module in Arabic".
// Sends the section's Arabic (فصحى) text, turned into a speakable script, to Voice Studio (voice_jobs). The worker
// (Amr's PC or the Modal cloud) narrates it with his Arabic voice clip and saves
// psy/narration/ar/<module>/<section>.mp3 and .json (Arabic captions and chapters) in the "course-content" bucket,
// ready for the Psychology lesson videos. Nothing a learner sees changes, and the lesson text is only read.
(function(){
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); };
  var end = function (s) { return /[.!?:…؟]["'”’)]?$/.test(s) ? s : s + '.'; };
  var clean = function (t) { return String(t || '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s*(?:→|->)\s*/g, '، ثم ').replace(/\s+/g, ' ').replace(/\s+([.,،;:!?؟])/g, '$1').trim(); };

  // Section HTML -> narration script. Headings become "# " lines (spoken, and chapters in the video);
  // lists become sentences; tables are read row by row; tools, inputs, images and scripts are left out.
  function script(html) {
    var doc = new DOMParser().parseFromString('<div>' + (html || '') + '</div>', 'text/html');
    var root = doc.body.firstChild, out = [];
    root.querySelectorAll('script,style,img,svg,input,textarea,button,select,canvas,iframe,video,audio,figure').forEach(function (n) { n.remove(); });
    function walk(el) {
      Array.prototype.forEach.call(el.children, function (n) {
        var tag = n.tagName.toLowerCase();
        if (/^h[1-6]$/.test(tag)) { var h = clean(n.textContent); if (h) out.push('# ' + h.replace(/[.:،]$/, '')); return; }
        if (tag === 'ul' || tag === 'ol') { var items = []; n.querySelectorAll(':scope > li').forEach(function (li) { var x = clean(li.textContent); if (x) items.push(end(x)); }); if (items.length) out.push(items.join(' ')); return; }
        if (tag === 'table') {
          var rows = Array.prototype.slice.call(n.querySelectorAll('tr')), head = null;
          rows.forEach(function (tr) {
            var cells = Array.prototype.map.call(tr.children, function (c) { return clean(c.textContent); });
            if (!head && tr.querySelector('th')) { head = cells; return; }
            var row = cells.map(function (v, k) { return v ? ((head && head[k]) ? head[k] + ': ' : '') + end(v) : ''; }).filter(Boolean).join(' ');
            if (row) out.push(row);
          });
          return;
        }
        if (tag === 'p' || tag === 'blockquote') { var p = clean(n.textContent); if (p) out.push(p); return; }
        if (n.children.length) return walk(n);
        var t = clean(n.textContent); if (t) out.push(t);
      });
    }
    walk(root);
    return out.join('\n\n');
  }

  var L = function (o, k) { return o && typeof o === 'object' ? (o[k] || '') : (k === 'en' ? (o || '') : ''); };
  var words = { queued:'waiting for your PC or Modal', running:'being narrated', done:'narrated', failed:'failed', cancelled:'cancelled' };
  var notAllowed = function (e) { return /row-level|permission|policy|JWT|42501/i.test((e && e.message) || ''); };
  var job = function (m, it) {
    return { title:'Psychology ' + (it.label || it.id) + ' (AR) ' + L(it.title, 'en'), text:script(L(it.html, 'ar')), language:'ar', mood:'teaching',
      target:{ mode:'lesson', course:'psy', lang:'ar', module:m.id, lesson:it.id } };
  };
  async function latest(db, m, ids) {
    var r = await db.from('voice_jobs').select('id,status,progress,message,created_at,target').eq('target->>course', 'psy').eq('target->>module', m.id)
      .in('target->>lesson', ids).order('created_at', { ascending:false }).limit(300);
    var by = {}; (r.data || []).forEach(function (j) { var k = j.target.lesson; if (!by[k]) by[k] = j; });
    return by;
  }

  async function mount(box, o) {
    if (!box) return;
    var db = o.db, m = o.module, it = o.item;
    var sections = m.items.filter(function (x) { return x.type === 'section' && L(x.html, 'ar'); });
    if (!L(it.html, 'ar')) { box.innerHTML = '<div class="vbox narr"><span class="note">No Arabic text in this section yet, so there is nothing to narrate in Arabic.</span></div>'; return; }
    var draw = async function () {
      var by = await latest(db, m, sections.map(function (x) { return x.id; }));
      if (!document.contains(box)) return;
      var j = by[it.id], play = '';
      if (j && j.status === 'done') {
        var u = await db.storage.from('course-content').createSignedUrl('psy/narration/ar/' + m.id + '/' + it.id + '.mp3', 3600);
        if (u.data) play = '<audio controls preload="none" src="' + esc(u.data.signedUrl) + '"></audio>';
      }
      var done = sections.filter(function (x) { return by[x.id] && by[x.id].status === 'done'; }).length;
      var waiting = sections.filter(function (x) { return by[x.id] && /queued|running/.test(by[x.id].status); }).length;
      var chars = sections.reduce(function (n, x) { return n + script(L(x.html, 'ar')).length; }, 0);
      box.innerHTML = '<div class="vbox narr" dir="ltr">' +
        '<div class="row"><button type="button" class="btn ghost" id="arGo">' + (j ? 'Narrate this section again in Arabic' : 'Narrate this section in Arabic') + '</button>' +
        '<button type="button" class="btn ghost" id="arMod">Narrate this module in Arabic</button></div>' +
        '<span class="note" id="arState" role="status">' + (j ? 'This section: ' + esc(words[j.status] || j.status) + (j.status === 'running' ? ' (' + Math.round((j.progress || 0) * 100) + '%)' : '') + (j.status === 'failed' && j.message ? ' · ' + esc(j.message) : '') : 'This section is not narrated in Arabic yet.') +
        ' · Module ' + m.num + ': ' + done + ' of ' + sections.length + ' sections narrated' + (waiting ? ', ' + waiting + ' in the queue' : '') +
        ' · about ' + Math.max(1, Math.round(chars / 13 / 60)) + ' min of Arabic audio · <a href="/app/#voice">Open Voice Studio</a></span>' + play + '</div>';
      box.querySelector('#arGo').addEventListener('click', async function (ev) {
        ev.target.disabled = true;
        var r = await db.from('voice_jobs').insert(job(m, it));
        if (r.error) { box.querySelector('#arState').textContent = notAllowed(r.error) ? 'Not allowed here. Sign in to the portal with your authenticator code, then try again.' : 'Couldn’t send it. Try again.'; ev.target.disabled = false; return; }
        draw();
      });
      box.querySelector('#arMod').addEventListener('click', async function (ev) {
        var todo = sections.filter(function (x) { return !by[x.id] || /failed|cancelled/.test(by[x.id].status); });
        var st = box.querySelector('#arState');
        if (!todo.length) { st.textContent = 'Every section in this module is already narrated in Arabic or in the queue.'; return; }
        ev.target.disabled = true;
        var r = await db.from('voice_jobs').insert(todo.map(function (x) { return job(m, x); }));
        if (r.error) { st.textContent = notAllowed(r.error) ? 'Not allowed here. Sign in to the portal with your authenticator code, then try again.' : 'Couldn’t send them. Try again.'; ev.target.disabled = false; return; }
        st.textContent = todo.length + ' sections sent to Voice Studio. Your PC or Modal works through them in order.';
        setTimeout(function () { if (document.contains(box)) draw(); }, 2500);
      });
      if (j && (j.status === 'queued' || j.status === 'running')) setTimeout(function () { if (document.contains(box)) draw(); }, 8000);
    };
    draw();
  }

  window.PsyNarrate = { script:script, mount:mount };
})();
