// Round 30 of the Portal Master Feature Plan (Nov 25 2026): the course builder, for every course. Amr only.
//   #builder                         CB1 builder home: pick a course, see its modules
//   #builder/<course>/<module>       one module: its lessons in order; add, move, hide or unhide them; versions; Publish
//   #builder/<course>/<module>/<l>   CB2 visual lesson editor with a live preview in that course's own look
//   Check course / before Publish    CB5 the course checker: course_check() rules for Acquisitions, the same idea for the others
// Where each course lives (unchanged by this round):
//   Acquisitions (acq)  course_modules, one row per module; lessons are Markdown (bodyMarkdown). Diagrams: course_diagrams.
//                       State sheets (13.2, 13.2b, 13.3): contract_states. Videos: R2 course/content/<module>/videos/<lesson>.mp4
//   Marketing (mkt)     one file, course-content/mkt/content.json: modules{m01..}, parts with HTML sections, Arabic in ar.modules
//   Psychology (psy)    one file, course-content/psy/content.json: modules[], items with html.en and html.ar (فصحى)
// Drafts are rows in course_builder_drafts (only Amr can read them), so learners see nothing until Publish.
// Publish writes to the same table or file the course reads, and keeps the version that was live in course_modules_history
// (Acquisitions through its trigger, the others through course_builder_history_add). Rollback puts a version back the same way.
// Hidden lessons are taken out of the live module and kept in course_builder_shelf, so Unhide puts them back where they were.
// Lesson ids never change (Voice Studio, videos and progress use them). A Publish that changes narrated text marks the lesson
// "needs re-voice" in course_builder_revoice for Round 31 (V1).
// Round 31 hooks (app/r31-course.js): hooks.quiz(ctx) opens the quiz builder, hooks.makeVideo(ctx) the Make the video panel,
// hooks.afterDraw(ctx, body) fills #r31Mod (module page: question bank, re-voice) and #r31Vid (lesson page: video builds).
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, esc, safe, card, empty, failed, pill, opt, plural } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const toast = t => { if (T().toast) T().toast(t); };
  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const AR_RE = /[؀-ۿ]/;
  const when = at => !at ? '' : window.PortalUI ? window.PortalUI.when(at, { zone:false }) :
    new Date(at).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true });
  const bucket = () => db().storage.from('course-content');
  const hooks = { quiz:null, makeVideo:null, afterDraw:null };
  window.CourseBuilder = { hooks };

  // ======================================================================
  // Small parsers: Markdown lessons (Acquisitions) and HTML lessons (Marketing, Psychology) as blocks
  // ======================================================================
  const BOX_LABELS = ['Why it matters', 'Example', 'Tip', 'Pro tip', 'Watch out', 'Common mistake', 'Legal flag', 'The rule', 'Key point', 'Remember', 'In short', 'Your work for this lesson'];
  const BOX_RE = new RegExp('^\\*\\*(' + BOX_LABELS.map(s => s.replace(/ /g, '\\s+')).join('|') + '|Linda\'s [^*]{1,40}?)([.:])\\*\\*\\s+([\\s\\S]+)$', 'i');
  const FIG_RE = /^!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"([^"]*)")?\s*\)$/;
  // bodyMarkdown -> [{ t, ... , raw }]. raw is kept, so blocks nobody touched go back exactly as they were.
  function mdBlocks(md){
    const chunks = String(md || '').replace(/\r/g, '').split(/\n{2,}/).map(s => s.replace(/^\n+|\s+$/g, '')).filter(s => s.trim());
    const out = [];
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i], one = !c.includes('\n');
      let m;
      if (one && (m = c.match(/^(#{1,6}) (.+)$/))) {
        if (/^بالعربي/.test(m[2].trim())) { const body = []; while (i + 1 < chunks.length && !isHead(chunks[i + 1])) body.push(chunks[++i]); out.push({ t:'ar', h:m[2], style:m[1], text:body.join('\n\n') }); continue; }
        out.push({ t:'h', text:m[2], style:m[1], raw:c }); continue;
      }
      if (one && (m = c.match(/^\*\*([^*]+)\*\*$/))) {
        if (/^بالعربي/.test(m[1].trim())) { const body = []; while (i + 1 < chunks.length && !isHead(chunks[i + 1])) body.push(chunks[++i]); out.push({ t:'ar', h:m[1], style:'**', text:body.join('\n\n') }); continue; }
        out.push({ t:'h', text:m[1], style:'**', raw:c }); continue;
      }
      if ((m = c.match(BOX_RE))) { out.push({ t:'box', label:m[1].replace(/\s+/g, ' '), sep:m[2], text:m[3], raw:c }); continue; }
      if (one && (m = c.match(FIG_RE))) { out.push({ t:'img', alt:m[1], src:m[2], cap:m[3] || '', raw:c }); continue; }
      if (/^\s*([-*] |\d+[.)] |\|)/.test(c)) { out.push({ t:'md', text:c, raw:c }); continue; }
      out.push({ t:'p', text:c, raw:c });
    }
    return out;
  }
  function isHead(c){ return !c.includes('\n') && (/^#{1,6} /.test(c) || /^\*\*[^*]+\*\*$/.test(c)); }
  function mdJoin(blocks){
    return blocks.map(b => {
      if (b.raw != null) return b.raw;
      if (b.t === 'h') return b.style && b.style !== '**' ? b.style + ' ' + b.text.trim() : '**' + b.text.trim() + '**';
      if (b.t === 'ar') return (b.style && b.style !== '**' ? b.style + ' ' + b.h.trim() : '**' + b.h.trim() + '**') + (b.text.trim() ? '\n\n' + b.text.trim() : '');
      if (b.t === 'box') return '**' + b.label + (b.sep || '.') + '** ' + b.text.trim();
      if (b.t === 'img') return '![' + (b.alt || '').replace(/[\]\n]/g, ' ') + '](' + b.src + (b.cap ? ' "' + b.cap.replace(/"/g, '”') + '"' : '') + ')';
      return String(b.text || '').trim();
    }).filter(Boolean).join('\n\n');
  }
  // Plain sentences of a lesson, for "did a narrated line change?"
  const mdLines = md => mdBlocks(md).map(b => b.t === 'img' ? '' : b.t === 'ar' ? b.h + ' ' + b.text : b.t === 'box' ? b.label + ' ' + b.text : b.text || '')
    .join('\n').replace(/[*_#|>`]/g, ' ').split(/\n+|(?<=[.!?؟])\s+/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 2);
  const htmlLines = html => { const d = document.createElement('div'); d.innerHTML = String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
    return [...d.querySelectorAll('p,li,h1,h2,h3,h4,h5,td,th,.label')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(s => s.length > 2); };

  // HTML -> one block per top-level element. raw is the element's HTML as it was; edited blocks get new html.
  function htmlBlocks(html){
    const d = document.createElement('div'); d.innerHTML = String(html || '');
    const out = [];
    [...d.childNodes].forEach(n => {
      if (n.nodeType === 3) { if (n.textContent.trim()) out.push({ t:'p', html:'<p>' + esc(n.textContent.trim()) + '</p>' }); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName.toLowerCase(), cls = n.className || '';
      const t = /^h[1-6]$/.test(tag) ? 'h' : tag === 'p' ? 'p' : /\bbox\b/.test(cls) ? 'box' : /\bcase\b/.test(cls) ? 'case' : /\bsummary\b/.test(cls) ? 'summary'
        : tag === 'figure' || tag === 'img' ? 'img' : tag === 'ul' || tag === 'ol' ? 'list' : /table/.test(cls) || tag === 'table' ? 'table' : 'html';
      out.push({ t, html:n.outerHTML });
    });
    return out;
  }
  const htmlJoin = blocks => blocks.map(b => b.html).join('\n\n');
  // What contenteditable leaves behind: no scripts, inline styles, event attributes or javascript: links
  function cleanHtml(html){
    const d = document.createElement('div'); d.innerHTML = html;
    d.querySelectorAll('script,style,iframe,object,embed,link,meta,font').forEach(e => e.tagName === 'FONT' ? e.replaceWith(...e.childNodes) : e.remove());
    d.querySelectorAll('*').forEach(e => {
      [...e.attributes].forEach(a => { if (/^on/i.test(a.name) || a.name === 'style' || a.name === 'contenteditable' || (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) e.removeAttribute(a.name); });
      if (e.tagName === 'SPAN' && !e.attributes.length) e.replaceWith(...e.childNodes);
    });
    return d.innerHTML.replace(/<br>\s*(<\/(p|li|div)>)/g, '$1').replace(/&nbsp;/g, ' ').trim();
  }
  const emDashes = s => (String(s).match(/\u2014/g) || []).length;
  // Egyptian words that should not be in فصحى text (Psychology): a hint, not proof
  const DIALECT = /(^|[\s،.])(عشان|علشان|إزاي|ازاي|كده|كدا|دلوقتي|بتاع|بتاعة|مش|اللي هو|إيه|ليه بقى|خلاص|برضه|بردو|زي ما|يعني إيه)(?=[\s،.؟!]|$)/;

  // ======================================================================
  // The three courses
  // ======================================================================
  const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Instrument+Serif:ital@1&family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,500;6..72,700&display=swap';
  const fileCache = {};   // content.json per course, downloaded once per visit (fresh again on Publish)
  async function readFile(course, fresh){
    if (!fresh && fileCache[course]) return fileCache[course];
    const [f, l] = await Promise.all([bucket().download(course + '/content.json'), bucket().list(course, { search:'content.json' })]);
    if (f.error || !f.data) throw new Error('Couldn’t open the ' + course + ' content file. Check you signed in with your authenticator code.');
    const data = JSON.parse(await f.data.text());
    const at = ((l.data || []).find(x => x.name === 'content.json') || {}).updated_at || null;
    return (fileCache[course] = { data, at });
  }
  async function writeFile(course, data){
    const r = await bucket().upload(course + '/content.json', new Blob([JSON.stringify(data)], { type:'application/json' }), { upsert:true, contentType:'application/json' });
    if (r.error) throw r.error;
    if (window.LearnOutline) { const o = window.LearnOutline.make(data); if (o) await bucket().upload(course + '/outline.json', new Blob([JSON.stringify(o)], { type:'application/json' }), { upsert:true, contentType:'application/json' }); }
    delete fileCache[course];
  }
  const L = (o, lang) => o == null ? '' : typeof o === 'string' ? (lang === 'ar' ? '' : o) : (o[lang] || '');

  const DG = {   // diagram kinds the Acquisitions lessons draw (course/app.js drawDiagram), and the fields of each row
    chain:{ list:'steps', label:'Number chain', fields:[['label', 'Label'], ['math', 'Math'], ['value', 'Value'], ['note', 'Note'], ['hi', 'Highlight']] },
    ladder:{ list:'steps', label:'Ladder', fields:[['t', 'Step'], ['s', 'Detail']] },
    flow:{ list:'nodes', label:'Flow', fields:[['t', 'Box'], ['s', 'Detail']], extra:[['links', 'Arrow labels, one per line'], ['foot', 'Line under it']] },
    columns:{ list:'cols', label:'Columns', fields:[['t', 'Heading'], ['s', 'Under the heading'], ['items', 'Points, one per line']] },
    timeline:{ list:'points', label:'Timeline', fields:[['when', 'When'], ['what', 'What'], ['who', 'Who'], ['hi', 'Highlight']] },
    steps:{ list:'steps', label:'Numbered steps', fields:[['t', 'Step'], ['s', 'Detail'], ['hi', 'Highlight']] },
    scale:{ list:'bands', label:'Scale', fields:[['range', 'Range'], ['t', 'Label'], ['s', 'Detail'], ['hi', 'Highlight']] }
  };
  const STATE_LESSONS = { '13.2':'OH', '13.2b':'MI', '13.3':'*' };   // course/app.js stateSheets()

  const C = {
    // ---------------- Acquisitions ----------------
    acq:{
      id:'acq', name:'Acquisitions', look:'Field binder look, /course', langs:['en'], md:true, canAddModule:true, canMove:true, canHide:true,
      async modules(){
        const r = await safe(db().rpc('portal_builder_modules')); if (r.error) throw r.error;
        return (r.data || []).map(m => ({ id:m.id, number:m.number, title:m.title || m.id, at:m.updated }));
      },
      async live(id){
        const [c, dg, sh, list] = await Promise.all([safe(db().rpc('portal_builder_module', { p_id:id })), safe(db().from('course_diagrams').select('item_id,position,spec').eq('module_id', id).order('position')),
          safe(db().from('course_builder_shelf').select('item_id,after_id,item').eq('course', 'acq').eq('module_id', id)), this.modules()]);
        if (c.error) throw c.error;
        const w = clone(c.data) || {}; w._diagrams = {}; (dg.data || []).forEach(r => { (w._diagrams[r.item_id] = w._diagrams[r.item_id] || []).push(r.spec); });
        // a lesson back in the live module (after a roll back) is not hidden any more
        w._hidden = (sh.data || []).filter(r => !this.find(w, r.item_id)).map(r => ({ after:r.after_id, item:r.item }));
        return { w, at:(list.find(m => m.id === id) || {}).at || null };
      },
      title:w => 'Module ' + w.number + ' · ' + (w.title || ''),
      // top-level entries, with the lessons of a group under it
      outline(w){
        return (w.items || []).map(it => ({ key:it.id, title:it.title || it.id, kind:it.type, edit:it.type === 'lesson', move:it.type === 'lesson' || it.type === 'group', hide:it.type === 'lesson' || it.type === 'group',
          kids:it.type === 'group' ? (it.items || []).map(k => ({ key:k.id, title:k.title || k.id, kind:k.type, edit:k.type === 'lesson' })) : null }));
      },
      find(w, key){ let hit = null; const walk = list => (list || []).forEach(x => { if (x.id === key) hit = x; else if (x.type === 'group') walk(x.items); }); walk(w.items); return hit; },
      move(w, key, dir){
        const a = w.items, i = a.findIndex(x => x.id === key), j = i + dir;
        if (i < 0 || j < 0 || j >= a.length || !/^(lesson|group)$/.test(a[j].type)) return false;
        [a[i], a[j]] = [a[j], a[i]]; return true;
      },
      hide(w, key){ const a = w.items, i = a.findIndex(x => x.id === key); if (i < 0) return false; w._hidden.push({ after:i ? a[i - 1].id : null, item:a[i] }); a.splice(i, 1); return true; },
      unhide(w, key){ const k = w._hidden.findIndex(h => h.item.id === key); if (k < 0) return false; const h = w._hidden.splice(k, 1)[0], a = w.items;
        const at = h.after ? a.findIndex(x => x.id === h.after) + 1 : 0; a.splice(at > 0 || !h.after ? at : a.length, 0, h.item); return true; },
      addLesson(w){
        const n = w.number, used = new Set(); const walk = l => (l || []).forEach(x => { used.add(x.id); if (x.type === 'group') walk(x.items); }); walk(w.items); (w._hidden || []).forEach(h => used.add(h.item.id));
        let k = 1; while (used.has(n + '.' + k)) k++;
        const id = n + '.' + k, it = { id, type:'lesson', title:id + ' New lesson', shortTitle:id + ' New lesson', bodyMarkdown:'Write the lesson here.' };
        const at = w.items.findIndex(x => x.type === 'assignment' || x.type === 'checkpoint');
        w.items.splice(at < 0 ? w.items.length : at, 0, it); return id;
      },
      newModule(list){
        const n = Math.max(0, ...list.map(m => m.number)) + 1; let k = n; const ids = new Set(list.map(m => m.id)); while (ids.has('m' + k)) k++;
        return { id:'m' + k, w:{ id:'m' + k, number:n, title:'New module', shortDescription:'', description:'', skillFocus:'', unlockRule:'',
          items:[{ id:n + '.1', type:'lesson', title:n + '.1 New lesson', shortTitle:n + '.1 New lesson', bodyMarkdown:'Write the lesson here.' }], _hidden:[], _diagrams:{} } };
      },
      link:(mid, key) => '/course/#/m/' + mid + '/l/' + key,
      narr(w, key, lang){ const it = this.find(w, key); return lang === 'en' && it ? mdLines(it.bodyMarkdown) : []; },
      async narrated(mid){   // lessons that have narration (Voice Studio jobs use course "re")
        const r = await safe(db().from('voice_jobs').select('target').eq('target->>course', 're').eq('target->>module', mid).limit(1000));
        return r.error ? null : new Set((r.data || []).map(x => x.target && x.target.lesson));
      },
      strip(w){ const c = clone(w); Object.keys(c).filter(k => k.charAt(0) === '_').forEach(k => delete c[k]); return c; },
      async check(mid, drafts){
        const map = {}; Object.keys(drafts).forEach(k => { map[k] = this.strip(drafts[k]); });
        const r = await safe(db().rpc('course_builder_check', { p_id:mid || null, p_drafts:map }));
        if (r.error) throw r.error;
        const out = (r.data || []).map(x => ({ module:x.module_id, item:x.item_id, severity:x.severity, issue:x.issue, label:'Module ' + x.module_no }));
        // a picture block whose file was never uploaded
        Object.keys(map).filter(k => !mid || k === mid).forEach(k => { const walk = l => (l || []).forEach(x => { if (x.type === 'group') walk(x.items);
          else if (String(x.bodyMarkdown || '').includes('(r2:course/pending')) out.unshift({ module:k, item:x.id, severity:'error', issue:'a picture block has no picture yet', label:'Module ' + map[k].number }); }); walk(map[k].items); });
        return out;
      },
      async publish(mid, w, live){
        const r = await safe(db().rpc('course_builder_publish_acq', { p_module:mid, p_content:this.strip(w) }));
        if (r.error) throw r.error;
        if (!same(w._diagrams || {}, (live && live._diagrams) || {})) {
          const d = await safe(db().from('course_diagrams').delete().eq('module_id', mid)); if (d.error) throw d.error;
          const rows = []; Object.keys(w._diagrams || {}).forEach(item => (w._diagrams[item] || []).forEach((spec, i) => rows.push({ module_id:mid, item_id:item, position:i + 1, spec, updated_at:new Date().toISOString() })));
          if (rows.length) { const x = await safe(db().from('course_diagrams').insert(rows)); if (x.error) throw x.error; }
        }
        for (const st of Object.keys(w._states || {})) {
          const x = await safe(db().from('contract_states').update({ sheet:w._states[st], updated_at:new Date().toISOString() }).eq('state', st)); if (x.error) throw x.error;
        }
        return r.data;
      },
      async rollback(mid, hist){ const r = await safe(db().rpc('course_builder_rollback_acq', { p_hist:hist })); if (r.error) throw r.error; },
      preview(w, key, lang, extra){
        const it = this.find(w, key) || {}, MD = window.CourseMarkdown;
        const body = MD ? MD.render(it.bodyMarkdown || '') : '<pre>' + esc(it.bodyMarkdown || '') + '</pre>';
        const dg = (w._diagrams || {})[key] || [];
        return { css:['/portal.css?v=13', '/course/course.css?v=11', '/course/read.css?v=3', '/course/theme.css?v=3'], bodyClass:'white', lang:'en',
          html:'<div class="app" id="app"><main id="main" class="col"><article class="lesson page"><span class="label o">Lesson ' + esc(key) + '</span><h1>' + esc((it.title || '').replace(new RegExp('^' + key.replace(/\./g, '\\.') + '\\s+'), '')) + '</h1>' +
            (extra.video ? '<p class="note">' + esc('Lesson video plays here (shown on the left).') + '</p>' : '') +
            '<div class="prose" id="lessonText">' + placeDiagrams(body, dg) + '</div>' + (extra.states || '') + '<p class="endmark">End of lesson</p></article></main></div>' };
      },
      videoKey:(mid, key) => 'course/content/' + mid + '/videos/' + key + '.mp4',
      imageKey:(mid, key, name) => picKey('acq', mid, key, name)
    },

    // ---------------- Marketing ----------------
    mkt:{
      id:'mkt', name:'Marketing', look:'Learning Hub look, /app/course', langs:['en', 'ar'], md:false, canAddModule:false, canMove:false, canHide:false,
      why:'Marketing saves each learner’s progress by part position, so parts can be added at the end but not moved or hidden.',
      async modules(){
        const f = await readFile('mkt'); const plan = ((window.COURSE && window.COURSE.id === 'mkt2' && window.COURSE.plan) || []).map(p => p.id);
        const ids = plan.filter(id => f.data.modules[id]).concat(Object.keys(f.data.modules).filter(id => !plan.includes(id)));
        return ids.map(id => { const m = f.data.modules[id]; return { id, number:m.n, title:m.t, at:f.at }; });
      },
      async live(id){ const f = await readFile('mkt'); return { w:{ en:clone(f.data.modules[id]), ar:clone(((f.data.ar || {}).modules || {})[id] || null) }, at:f.at }; },
      title:w => 'Module ' + w.en.n + ' · ' + w.en.t,
      outline:w => w.en.parts.map((p, i) => ({ key:String(i + 1), title:w.en.n + '.' + (i + 1) + ' ' + p.t, kind:'part', edit:true })),
      find:(w, key) => w.en.parts[+key - 1] || null,
      addLesson(w){
        const blank = h => ({ h, b:'<p>Write here.</p>', src:[] });
        w.en.parts.push({ t:'New part', mins:5, s:[blank('Why it matters')], ex:'<p>Write the example here.</p>', terms:[], q:[] });
        if (w.ar) w.ar.parts.push({ t:'', s:[{ h:'ليه ده مهم', b:'' }], ex:'', b2b:'', terms:[], q:[] });
        return String(w.en.parts.length);
      },
      link:(mid, key) => '/app/course/#/' + mid + '/' + key,
      narr:() => [],
      async narrated(){ return new Set(); },
      async check(mid, drafts){
        const f = await readFile('mkt'), out = [];
        const ids = mid ? [mid] : Object.keys(f.data.modules);
        ids.forEach(id => {
          const d = drafts[id], en = d ? d.en : f.data.modules[id], ar = d ? d.ar : ((f.data.ar || {}).modules || {})[id], lab = 'Module ' + (en && en.n);
          const add = (item, severity, issue) => out.push({ module:id, item, severity, issue, label:lab });
          if (!en) return add(null, 'error', 'module is missing from the content file');
          if (!en.t) add(null, 'error', 'module has no title');
          if (!(en.quiz || []).length) add(null, 'error', 'module has no checkpoint quiz');
          else if (window.R31Quiz) window.R31Quiz.mktIssues(en.quiz, ar && ar.quiz).forEach(x => add(null, x.severity, 'quiz: ' + x.issue));
          (en.parts || []).forEach((p, i) => {
            const k = String(i + 1);
            if (!String(p.t || '').trim()) add(k, 'error', 'part has no title');
            if (!(p.s || []).length) add(k, 'error', 'part has no sections');
            (p.s || []).forEach((s, j) => { if (!String(s.h || '').trim()) add(k, 'warn', 'section ' + (j + 1) + ' has no heading'); if (!String(s.b || '').replace(/<[^>]+>/g, '').trim()) add(k, 'error', 'section ' + (j + 1) + ' is empty'); });
            if (!String(p.ex || '').replace(/<[^>]+>/g, '').trim()) add(k, 'warn', 'part has no example');
            if (/Write (here|the example here)\./.test(JSON.stringify(p))) add(k, 'warn', 'still has placeholder text');
            if (emDashes(JSON.stringify(p))) add(k, 'warn', emDashes(JSON.stringify(p)) + ' em dash(es) in the English text');
            if (ar) {
              const a = (ar.parts || [])[i];
              if (!a) add(k, 'error', 'Arabic part is missing (the Arabic page would not open)');
              else {
                if ((a.s || []).length !== (p.s || []).length) add(k, 'error', 'Arabic has ' + (a.s || []).length + ' sections, English has ' + (p.s || []).length);
                if ((a.q || []).length !== (p.q || []).length) add(k, 'error', 'Arabic has ' + (a.q || []).length + ' questions, English has ' + (p.q || []).length);
                if ((a.terms || []).length !== (p.terms || []).length) add(k, 'warn', 'Arabic has ' + (a.terms || []).length + ' terms, English has ' + (p.terms || []).length);
                if (!AR_RE.test(a.t || '') || (a.s || []).some(s => !AR_RE.test(String(s.b || '')))) add(k, 'warn', 'Arabic is not written yet for part of it');
                if (emDashes(JSON.stringify(a))) add(k, 'warn', emDashes(JSON.stringify(a)) + ' em dash(es) in the Arabic text');
              }
            }
          });
        });
        return out;
      },
      async publish(mid, w){
        const f = await readFile('mkt', true), data = f.data;
        await keepVersion('mkt', mid, data.modules[mid] && data.modules[mid].n, { en:data.modules[mid] || null, ar:((data.ar || {}).modules || {})[mid] || null });
        data.modules[mid] = w.en; if (w.ar) { data.ar = data.ar || { modules:{} }; data.ar.modules[mid] = w.ar; }
        await writeFile('mkt', data);
      },
      async rollback(mid, hist){
        const v = await version(hist), f = await readFile('mkt', true), data = f.data;
        await keepVersion('mkt', mid, data.modules[mid] && data.modules[mid].n, { en:data.modules[mid] || null, ar:((data.ar || {}).modules || {})[mid] || null }, 'ROLLBACK');
        if (v.content.en) data.modules[mid] = v.content.en; if (v.content.ar) { data.ar = data.ar || { modules:{} }; data.ar.modules[mid] = v.content.ar; }
        await writeFile('mkt', data);
      },
      preview(w, key, lang){
        const i = +key - 1, en = w.en.parts[i] || {}, ar = w.ar && w.ar.parts[i], p = lang === 'ar' && ar ? Object.assign({}, en, ar, { s:(en.s || []).map((s, j) => Object.assign({}, s, (ar.s || [])[j])) }) : en;
        const f = fileCache.mkt && fileCache.mkt.data, src = list => (list || []).map(s => f && f.sources && f.sources[s] ? '<span class="chip src">' + esc(f.sources[s].t) + '</span>' : '').join('');
        return { css:['/portal.css?v=13', '/app/course/course.css?v=10', '/app/course/theme.css?v=1'], lang,
          html:'<div class="cp" id="cp"><div class="cp-body"><main class="cp-main" id="cpMain"><div class="cp-wrap"><span class="cp-kick">' + esc((lang === 'ar' ? 'الجزء ' : 'Part ') + w.en.n + '.' + key) + '</span><h1 class="cp-h1">' + esc(p.t || '') + '</h1>' +
            '<article class="cp-card cp-lesson"><div class="cp-page">' + (p.s || []).map(s => '<section class="cp-sec"><h3>' + esc(s.h || '') + ' ' + src(s.src) + '</h3>' + (s.b || '') + '</section>').join('') +
            '<section class="cp-box case"><span class="cp-kick">' + (lang === 'ar' ? 'مثال' : 'Example') + '</span>' + (p.ex || '') + '</section>' +
            (p.b2b ? '<section class="cp-box"><span class="cp-kick">B2B</span>' + p.b2b + '</section>' : '') +
            ((p.terms || []).length ? '<section class="cp-sec"><h3>' + (lang === 'ar' ? 'المصطلحات' : 'Terms') + '</h3><dl class="cp-terms">' + p.terms.map(([a, b]) => '<dt>' + esc(a) + '</dt><dd>' + esc(b) + '</dd>').join('') + '</dl></section>' : '') +
            '</div></article></div></main></div></div>' };
      },
      videoKey:() => null,
      imageKey:(mid, key, name) => picKey('mkt', mid, key, name)
    },

    // ---------------- Psychology ----------------
    psy:{
      id:'psy', name:'Psychology', look:'Learning Hub look, /app/psychology', langs:['en', 'ar'], md:false, canAddModule:true, canMove:true, canHide:true,
      async modules(){ const f = await readFile('psy'); return f.data.modules.map(m => ({ id:m.id, number:m.num, title:L(m.title, 'en'), at:f.at })); },
      async live(id){
        const f = await readFile('psy'), m = f.data.modules.find(x => x.id === id);
        const sh = await safe(db().from('course_builder_shelf').select('item_id,after_id,item').eq('course', 'psy').eq('module_id', id));
        const w = clone(m); w._hidden = (sh.data || []).filter(r => !this.find(w, r.item_id)).map(r => ({ after:r.after_id, item:r.item }));
        return { w, at:f.at };
      },
      title:w => 'Module ' + w.num + ' · ' + L(w.title, 'en'),
      outline(w){
        return (w.parts || []).map(p => ({ key:'part:' + p.id, title:(p.n ? p.n + '. ' : '') + L(p.title, 'en'), kind:'part', head:true,
          kids:(w.items || []).filter(it => it.part === p.id).map(it => ({ key:it.id, title:(it.label ? it.label + ' ' : '') + L(it.title, 'en'), kind:it.type,
            edit:it.type === 'section' || it.type === 'playbook', move:it.type === 'section' || it.type === 'playbook', hide:it.type === 'section' || it.type === 'playbook' })) }))
          .concat((w.items || []).some(it => !(w.parts || []).find(p => p.id === it.part)) ? [{ key:'part:?', title:'Not in a part', kind:'part', head:true,
            kids:w.items.filter(it => !(w.parts || []).find(p => p.id === it.part)).map(it => ({ key:it.id, title:L(it.title, 'en'), kind:it.type, edit:!!it.html })) }] : []);
      },
      find:(w, key) => (w.items || []).find(x => x.id === key) || null,
      move(w, key, dir){   // within its part, among sections and playbooks
        const a = w.items, i = a.findIndex(x => x.id === key); if (i < 0) return false;
        let j = i + dir; while (j >= 0 && j < a.length && a[j].part === a[i].part && !/^(section|playbook)$/.test(a[j].type)) j += dir;
        if (j < 0 || j >= a.length || a[j].part !== a[i].part) return false;
        const it = a.splice(i, 1)[0]; a.splice(j, 0, it); return true;
      },
      hide(w, key){ const a = w.items, i = a.findIndex(x => x.id === key); if (i < 0) return false; w._hidden.push({ after:i ? a[i - 1].id : null, item:a[i] }); a.splice(i, 1); return true; },
      unhide(w, key){ const k = w._hidden.findIndex(h => h.item.id === key); if (k < 0) return false; const h = w._hidden.splice(k, 1)[0], a = w.items;
        const at = h.after ? a.findIndex(x => x.id === h.after) + 1 : 0; a.splice(at > 0 || !h.after ? at : a.length, 0, h.item); return true; },
      addLesson(w, partKey){
        const part = (w.parts || []).find(p => 'part:' + p.id === partKey) || (w.parts || [])[0];
        if (!part) return null;
        const pn = part.n || String((w.parts || []).indexOf(part) + 1), used = new Set((w.items || []).concat((w._hidden || []).map(h => h.item)).map(x => x.id));
        let k = 1; while (used.has('s' + pn + '-' + k)) k++;
        const it = { id:'s' + pn + '-' + k, type:'section', part:part.id, label:pn + '.' + k, title:{ en:'New section', ar:'' }, html:{ en:'<p>Write the section here.</p>', ar:'' } };
        const a = w.items; let at = -1; a.forEach((x, i) => { if (x.part === part.id && /^(section|playbook)$/.test(x.type)) at = i; });
        a.splice(at < 0 ? a.length : at + 1, 0, it); return it.id;
      },
      newModule(list){
        const ids = new Set(list.map(m => m.id)); let k = list.length; while (ids.has('m' + k)) k++;
        const num = list.length;
        return { id:'m' + k, w:{ id:'m' + k, num, code:'', title:{ en:'New module', ar:'' }, desc:{ en:'', ar:'' }, overview:{ en:'', ar:'' },
          parts:[{ id:'p1', n:'1', title:{ en:'Part 1', ar:'' }, desc:{ en:'', ar:'' } }],
          items:[{ id:'s1-1', type:'section', part:'p1', label:'1.1', title:{ en:'New section', ar:'' }, html:{ en:'<p>Write the section here.</p>', ar:'' } }], checked:'', _hidden:[] } };
      },
      link:(mid, key) => '/app/psychology/#/' + mid + '/' + key,
      narr(w, key, lang){ const it = this.find(w, key); return it && it.html ? htmlLines(L(it.html, lang)) : []; },
      async narrated(mid){
        const r = await safe(db().from('voice_jobs').select('target').eq('target->>course', 'psy').eq('target->>module', mid).limit(1000));
        return r.error ? null : new Set((r.data || []).map(x => x.target && x.target.lesson));
      },
      async check(mid, drafts){
        const f = await readFile('psy'), out = [];
        const mods = f.data.modules.map(m => drafts[m.id] || m).concat(Object.keys(drafts).filter(id => !f.data.modules.find(m => m.id === id)).map(id => drafts[id]));
        mods.filter(m => !mid || m.id === mid).forEach(m => {
          const lab = 'Module ' + m.num, add = (item, severity, issue) => out.push({ module:m.id, item, severity, issue, label:lab }), seen = new Set();
          if (!L(m.title, 'en')) add(null, 'error', 'module has no English title');
          if (!L(m.title, 'ar')) add(null, 'warn', 'module has no Arabic title');
          (m.items || []).forEach(it => {
            if (seen.has(it.id)) add(it.id, 'error', 'two items have the id ' + it.id); seen.add(it.id);
            if (!(m.parts || []).find(p => p.id === it.part)) add(it.id, 'error', 'is in a part that does not exist (' + it.part + ')');
            if (it.type !== 'section' && it.type !== 'playbook') return;
            if (!L(it.title, 'en')) add(it.id, 'error', 'has no English title');
            if (!String(L(it.html, 'en')).replace(/<[^>]+>/g, '').trim()) add(it.id, 'error', 'English text is empty');
            if (!L(it.title, 'ar')) add(it.id, 'warn', 'has no Arabic title');
            const ar = String(L(it.html, 'ar'));
            // lines in quotes are spoken examples (a client or coach talking), so they may be in dialect on purpose
            const plain = ar.replace(/<[^>]+>/g, ' ').replace(/«[^»]*»/g, ' ').replace(/"[^"]*"/g, ' ').replace(/“[^”]*”/g, ' '), dia = plain.match(DIALECT);
            if (!ar.replace(/<[^>]+>/g, '').trim()) add(it.id, 'warn', 'Arabic text is not written yet');
            else if (dia) add(it.id, 'warn', 'Arabic looks like dialect outside a quote (“' + dia[2] + '”). Keep it فصحى unless it is a spoken line');
            if (it.type === 'section' && !/^\d+\.\d+$/.test(it.label || '')) add(it.id, 'warn', 'section number “' + (it.label || '') + '” is not like 2.3');
            const n = emDashes(JSON.stringify([it.title, it.html])); if (n) add(it.id, 'warn', n + ' em dash(es)');
            if (/Write the section here\./.test(JSON.stringify(it.html))) add(it.id, 'warn', 'still has placeholder text');
            if (/<img(?![^>]*(src=|data-r2=))/.test(L(it.html, 'en') + ar)) add(it.id, 'warn', 'a picture has no file');
          });
        });
        return out;
      },
      async publish(mid, w){
        const f = await readFile('psy', true), data = f.data, i = data.modules.findIndex(m => m.id === mid);
        const live = this.strip(w);
        if (i >= 0) { await keepVersion('psy', mid, data.modules[i].num, data.modules[i]); data.modules[i] = live; }
        else data.modules.push(live);
        await writeFile('psy', data);
      },
      async rollback(mid, hist){
        const v = await version(hist), f = await readFile('psy', true), data = f.data, i = data.modules.findIndex(m => m.id === mid);
        if (i >= 0) { await keepVersion('psy', mid, data.modules[i].num, data.modules[i], 'ROLLBACK'); data.modules[i] = v.content; } else data.modules.push(v.content);
        await writeFile('psy', data);
      },
      strip(w){ const c = clone(w); Object.keys(c).filter(k => k.charAt(0) === '_').forEach(k => delete c[k]); return c; },
      preview(w, key, lang){
        const it = this.find(w, key) || {}, html = L(it.html, lang);
        return { css:['/portal.css?v=13', '/app/course/course.css?v=10', '/app/psychology/psy-content.css?v=4', '/app/psychology/theme.css?v=2'], lang,
          html:'<div class="cp" id="cp"><div class="cp-body"><main class="cp-main" id="cpMain"><div class="cp-wrap cp-lesson"><span class="cp-kick">' + esc(it.label || '') + '</span><h1 class="cp-h1">' + esc(L(it.title, lang) || L(it.title, 'en')) + '</h1>' +
            // like the course (Round 32, E21): no Arabic yet shows the English with the course's own small note
            (!html && lang === 'ar' ? '<div class="note-ar">' + esc(((window.I18N || {}).ar || {}).arPending || 'الترجمة العربية لهذه الصفحة قيد الإعداد. يظهر النص بالإنجليزية مؤقتًا.') + '</div>' : '') +
            '<div class="content' + (!html && lang === 'ar' ? ' fallback-en" lang="en' : '') + '">' + (html || L(it.html, 'en') || '') + '</div></div></main></div></div>' };
      },
      videoKey:(mid, key) => 'psy/videos/' + mid + '/' + key + '.mp4',   // still in the course-content bucket (video.js)
      imageKey:(mid, key, name) => picKey('psy', mid, key, name)
    }
  };
  // The amr-media Worker only takes files under course/content/<module>/videos/ or narration/, so lesson pictures go in a
  // pictures folder there, named by course so the three courses never share a name.
  const picKey = (course, mid, key, name) => 'course/content/' + mid + '/videos/pictures/' + course + '-' + String(key).replace(/[^\w.-]/g, '-') + '-' + name;
  async function keepVersion(course, mid, number, content, op){
    if (!content) return;
    const r = await safe(db().rpc('course_builder_history_add', { p_course:course, p_module:mid, p_number:number == null ? null : +number || null, p_content:content, p_op:op || 'PUBLISH' }));
    if (r.error) throw r.error;
  }
  async function version(hist){ const r = await safe(db().rpc('course_builder_version', { p_hist:hist })); if (r.error || !r.data) throw (r.error || new Error('That version is gone.')); return r.data; }
  function placeDiagrams(html, list){
    if (!list.length) return html;
    const d = document.createElement('div'); d.innerHTML = html;
    list.forEach(spec => { const fig = document.createElement('figure'); fig.className = 'dg dg-' + spec.kind; fig.innerHTML = drawDiagram(spec) + (spec.title ? '<figcaption>' + esc(spec.title) + '</figcaption>' : '');
      const at = spec.after && [...d.children].find(el => el.textContent.trim().startsWith(spec.after)); if (at) at.after(fig); else d.prepend(fig); });
    return d.innerHTML;
  }
  // the same drawing as course/app.js drawDiagram(), so the preview matches the course
  function drawDiagram(d){
    const arrow = '<span class="dg-arrow" aria-hidden="true"></span>';
    if (d.kind === 'chain') return '<ol class="dg-chain">' + (d.steps || []).map(s => '<li class="dg-step' + (s.hi ? ' hi' : '') + '"><span class="dg-l">' + esc(s.label) + '</span>' + (s.math ? '<span class="dg-m">' + esc(s.math) + '</span>' : '') + '<b class="dg-v">' + esc(s.value) + '</b>' + (s.note ? '<span class="dg-n">' + esc(s.note) + '</span>' : '') + '</li>').join('') + '</ol>';
    if (d.kind === 'ladder') return '<ol class="dg-ladder">' + (d.steps || []).map(s => '<li><b>' + esc(s.t) + '</b><span>' + esc(s.s) + '</span></li>').join('') + '</ol>';
    if (d.kind === 'flow') return '<div class="dg-flow">' + (d.nodes || []).map((n, i) => (i ? '<span class="dg-link">' + arrow + '<small>' + esc((d.links || [])[i - 1] || '') + '</small></span>' : '') + '<div class="dg-node"><b>' + esc(n.t) + '</b><span>' + esc(n.s || '') + '</span></div>').join('') + '</div>' + (d.foot ? '<p class="dg-foot">' + esc(d.foot) + '</p>' : '');
    if (d.kind === 'columns') return '<div class="dg-cols">' + (d.cols || []).map(c => '<div class="dg-col"><b>' + esc(c.t) + '</b><span class="dg-cs">' + esc(c.s || '') + '</span><ul>' + (c.items || []).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>').join('') + '</div>';
    if (d.kind === 'timeline') return '<ol class="dg-time">' + (d.points || []).map(p => '<li class="' + (p.hi ? 'hi' : '') + '"><b>' + esc(p.when) + '</b><span>' + esc(p.what) + '</span>' + (p.who ? '<small>' + esc(p.who) + '</small>' : '') + '</li>').join('') + '</ol>';
    if (d.kind === 'steps') return '<ol class="dg-steps">' + (d.steps || []).map((s, i) => '<li' + (s.hi ? ' class="hi"' : '') + '><i>' + (i + 1) + '</i><b>' + esc(s.t) + '</b>' + (s.s ? '<span>' + esc(s.s) + '</span>' : '') + '</li>').join('') + '</ol>';
    if (d.kind === 'scale') return '<ol class="dg-scale">' + (d.bands || []).map(b => '<li' + (b.hi ? ' class="hi"' : '') + '><i>' + esc(b.range) + '</i><b>' + esc(b.t) + '</b><span>' + esc(b.s || '') + '</span></li>').join('') + '</ol>';
    return '';
  }

  // ======================================================================
  // State of the page
  // ======================================================================
  const S = { course:'acq', mods:[], drafts:{}, mid:null, w:null, live:null, liveAt:null, baseAt:null, key:null, lang:'en', timer:null, saving:null, problems:null, revoice:[], body:null, ok:() => true };
  const A = () => C[S.course];
  const go = (hash, replace) => { if (replace) history.replaceState(null, '', hash); else history.pushState(null, '', hash); route(); };
  const say = t => { const m = S.body && S.body.querySelector('#cbMsg'); if (m) m.textContent = t; };

  V.builder = { title:'Course builder', sec:'owner', async open(el, ok){
    S.body = PX.page(el, 'Learning', 'Course builder', 'Build and change every course on screen. Changes save as a draft that only you see. Learners see them after you press Publish, and the version that was live is kept so you can roll back.');
    S.ok = ok;
    S.body.onclick = onClick; S.body.oninput = onInput; S.body.onchange = onChange;
    route();
  }};
  addEventListener('popstate', () => { if (/^#builder(\/|$)/.test(location.hash) && S.body && document.contains(S.body)) route(); });

  async function route(){
    const [, c, mid, key] = location.hash.replace(/^#/, '').split('/').map(decodeURIComponent);
    await flush();
    if (c && C[c] && c !== S.course) { S.course = c; S.mods = []; S.mid = null; S.lang = 'en'; }
    if (c && C[c]) S.course = c;
    try {
      if (!S.mods.length || !mid) await loadCourse();
      if (!S.ok()) return;
      if (mid) { if (mid !== S.mid) await loadModule(mid); if (!S.ok()) return; }
      else { S.mid = null; S.w = null; }
      S.key = mid && key ? key : null;
      if (S.key && !A().find(S.w, S.key)) S.key = null;
      if (S.key && C[S.course].langs.indexOf(S.lang) < 0) S.lang = 'en';
      draw();
    } catch(e) { S.body.innerHTML = tabs() + failed(e); }
  }
  async function loadCourse(){
    S.body.innerHTML = tabs() + PX.loading;
    const [mods, dr] = await Promise.all([A().modules(), safe(db().from('course_builder_drafts').select('module_id,content,base_at,updated_at').eq('course', S.course))]);
    if (dr.error) throw dr.error;
    S.mods = mods; S.drafts = {}; S.draftAt = {};
    (dr.data || []).forEach(d => { S.drafts[d.module_id] = d.content; S.draftAt[d.module_id] = d.updated_at; });
    S.problems = null;
  }
  async function loadModule(mid){
    S.body.innerHTML = tabs() + PX.loading;
    const known = S.mods.find(m => m.id === mid);
    const l = known ? await A().live(mid) : { w:null, at:null };
    S.live = l.w; S.liveAt = l.at; S.mid = mid;
    const d = await safe(db().from('course_builder_drafts').select('content,base_at').eq('course', S.course).eq('module_id', mid).maybeSingle());
    S.w = d.data ? d.data.content : clone(l.w); S.baseAt = d.data ? d.data.base_at : l.at;
    if (!S.w) throw new Error('This module isn’t there any more.');
    if (S.course === 'acq') { S.w._hidden = S.w._hidden || []; S.w._diagrams = S.w._diagrams || {}; }
    if (S.course === 'psy') S.w._hidden = S.w._hidden || [];
    const rv = await safe(db().from('course_builder_revoice').select('item_id,lang,lines,marked_at').eq('course', S.course).eq('module_id', mid).is('cleared_at', null));
    S.revoice = rv.data || [];
  }
  const isDraft = mid => !!S.drafts[mid];

  // Save the draft a moment after the last change
  function touch(){ S.drafts[S.mid] = S.w; clearTimeout(S.timer); S.timer = setTimeout(saveDraft, 900); say('Saving…'); }
  async function saveDraft(){
    S.timer = null; if (!S.mid || !S.w) return;
    const row = { course:S.course, module_id:S.mid, content:S.w, base_at:S.baseAt, updated_at:new Date().toISOString() };
    const p = S.saving = safe(db().from('course_builder_drafts').upsert(row));
    const r = await p; if (S.saving === p) S.saving = null;
    if (r.error) { say('Couldn’t save the draft. ' + (r.error.message || 'Check your connection.')); return false; }
    S.drafts[S.mid] = S.w; S.draftAt[S.mid] = row.updated_at; say('Draft saved ' + when(row.updated_at) + '. Learners still see the live version.');
    const b = S.body.querySelector('#cbState'); if (b) b.outerHTML = statePill();
    return true;
  }
  async function flush(){ if (S.timer) { clearTimeout(S.timer); await saveDraft(); } else if (S.saving) await S.saving; }

  // ======================================================================
  // Drawing
  // ======================================================================
  function tabs(){
    return '<div class="px-tools cb-top"><div class="p-seg" role="tablist" aria-label="Course">' + Object.values(C).map(c => '<button type="button" role="tab" class="wk-seg' + (c.id === S.course ? ' on' : '') + '" aria-selected="' + (c.id === S.course) + '" data-course="' + c.id + '">' + esc(c.name) + '</button>').join('') + '</div>' +
      '<span class="cb-top-r"><button type="button" class="p-btn is-ghost" data-act="check">Check course</button></span></div>';
  }
  const statePill = () => '<span id="cbState">' + (S.mid && isDraft(S.mid) ? pill('Draft · not live', '') : pill('Same as live', 'plain')) + '</span>';
  function crumbs(){
    const out = ['<a href="#builder/' + S.course + '" data-nav="#builder/' + S.course + '">' + esc(A().name) + '</a>'];
    if (S.mid) out.push(S.key ? '<a href="#builder/' + S.course + '/' + S.mid + '" data-nav="#builder/' + S.course + '/' + S.mid + '">' + esc(A().title(S.w)) + '</a>' : '<b>' + esc(A().title(S.w)) + '</b>');
    if (S.key) out.push('<b>' + esc(lessonTitle()) + '</b>');
    return '<nav class="cb-crumbs" aria-label="Where you are">' + out.join('<span aria-hidden="true">›</span>') + '</nav>';
  }
  function draw(){
    const html = tabs() + (S.problems ? problemsCard() : '') + (S.key ? editorView() : S.mid ? moduleView() : homeView());
    S.body.innerHTML = html;
    if (S.key) afterEditor();
    if (S.mid && !S.key) loadVersions();
    if (hooks.afterDraw && S.mid) try { hooks.afterDraw(ctx(), S.body); } catch(e) { console.warn('builder hook', e); }
  }

  // ---------------- CB1: builder home ----------------
  function homeView(){
    const c = A(), drafts = Object.keys(S.drafts);
    return '<p class="cb-look">' + esc(c.name) + ' · ' + esc(c.look) + (c.langs.length > 1 ? ' · English and Arabic' : '') + '</p>' +
      card('Modules', plural(S.mods.length + drafts.filter(id => !S.mods.find(m => m.id === id)).length, 'module'),
        '<ol class="cb-mods">' + S.mods.map(m => '<li><a class="cb-mod" href="#builder/' + c.id + '/' + m.id + '" data-nav="#builder/' + c.id + '/' + m.id + '"><b>Module ' + esc(m.number) + '</b><span>' + esc(m.title) + '</span>' +
          (isDraft(m.id) ? pill('Draft', '') : '') + '<small>' + (isDraft(m.id) ? 'Draft saved ' + esc(when(S.draftAt[m.id])) : m.at ? 'Live since ' + esc(when(m.at)) : '') + '</small></a></li>').join('') +
          drafts.filter(id => !S.mods.find(m => m.id === id)).map(id => '<li><a class="cb-mod" href="#builder/' + c.id + '/' + id + '" data-nav="#builder/' + c.id + '/' + id + '"><b>New module</b><span>' + esc(C[S.course].title(S.drafts[id])) + '</span>' + pill('Draft, never published', '') + '</a></li>').join('') + '</ol>' +
        (c.canAddModule ? '<div class="cb-row"><button type="button" class="p-btn is-ghost" data-act="addmod">+ Add a module</button><span class="p-empty">It stays a draft until you publish it.</span></div>'
          : '<p class="p-empty">New Marketing modules are added to the course plan in the site code first, then filled in here.</p>'));
  }

  // ---------------- CB1: one module ----------------
  function moduleView(){
    const c = A(), list = c.outline(S.w), rv = new Set(S.revoice.map(r => r.item_id));
    const row = (x, top) => '<li class="cb-l' + (x.edit ? '' : ' is-fixed') + '"><span class="cb-lt">' + esc(x.title) + '</span>' + (x.kind !== 'lesson' && x.kind !== 'section' && x.kind !== 'part' ? pill(KIND[x.kind] || x.kind, 'plain') : '') + (rv.has(x.key) ? pill('Needs re-voice', 'no') : '') +
      '<span class="cb-la">' + (x.edit ? '<a class="p-btn is-ghost" href="#builder/' + c.id + '/' + S.mid + '/' + encodeURIComponent(x.key) + '" data-nav="#builder/' + c.id + '/' + S.mid + '/' + encodeURIComponent(x.key) + '">Edit</a>' : '') +
        (c.canMove && x.move ? '<button type="button" class="p-btn is-ghost cb-ic" data-move="-1" data-k="' + esc(x.key) + '" aria-label="Move up">↑</button><button type="button" class="p-btn is-ghost cb-ic" data-move="1" data-k="' + esc(x.key) + '" aria-label="Move down">↓</button>' : '') +
        (c.canHide && x.hide ? '<button type="button" class="p-btn is-ghost" data-hide="' + esc(x.key) + '">Hide</button>' : '') + '</span>' +
      (x.kids ? '<ol class="cb-kids">' + x.kids.map(k => row(k)).join('') + '</ol>' : '') + '</li>';
    const hidden = (S.w._hidden || []);
    const addBtn = key => '<button type="button" class="p-btn is-ghost" data-act="addlesson"' + (key ? ' data-part="' + esc(key) + '"' : '') + '>+ Add a ' + (S.course === 'mkt' ? 'part' : S.course === 'psy' ? 'section' : 'lesson') + '</button>';
    return crumbs() +
      card(c.title(S.w), statePill(),
        '<ol class="cb-lessons">' + list.map(x => x.head ? '<li class="cb-part"><b>' + esc(x.title) + '</b><ol class="cb-kids">' + (x.kids || []).map(k => row(k)).join('') + '</ol>' + (S.course === 'psy' ? '<div class="cb-row">' + addBtn(x.key) + '</div>' : '') + '</li>' : row(x, true)).join('') + '</ol>' +
        (S.course !== 'psy' ? '<div class="cb-row">' + addBtn() + '</div>' : '') +
        (c.why ? '<p class="p-empty">' + esc(c.why) + '</p>' : '') +
        (hidden.length ? '<h3 class="cb-h3">Hidden from learners</h3><ul class="cb-hidden">' + hidden.map(h => '<li><span>' + esc(S.course === 'psy' ? (h.item.label ? h.item.label + ' ' : '') + L(h.item.title, 'en') : h.item.title || h.item.id) + '</span><button type="button" class="p-btn is-ghost" data-unhide="' + esc(h.item.id) + '">Unhide</button></li>').join('') + '</ul>' : '') +
        publishBar()) +
      '<div id="r31Mod"></div>' +
      card('Versions', 'Kept on every Publish', '<div id="cbVersions">' + PX.loading + '</div>');
  }
  const KIND = { group:'Lesson group', assignment:'Written drill', checkpoint:'Checkpoint', quiz:'Quiz', exam:'Exam', playbook:'Playbook', notes:'Notes' };
  function publishBar(){
    return '<div class="cb-row cb-pub"><button type="button" class="p-btn" data-act="publish">Publish module</button>' +
      (isDraft(S.mid) && S.live ? '<button type="button" class="p-btn is-ghost" data-act="drop">Throw away the draft</button>' : '') +
      '<a class="p-btn is-ghost" target="_blank" rel="noopener" href="' + esc(A().link(S.mid, S.key || (A().outline(S.w).find(x => x.edit) || {}).key || '')) + '">Open in the course</a>' +
      '<p class="p-empty" id="cbMsg" role="status">' + (isDraft(S.mid) ? 'Draft saved ' + esc(when(S.draftAt[S.mid])) + '. Learners still see the live version.' : 'No changes yet. Edits save as a draft.') + '</p></div>';
  }
  async function loadVersions(){
    const box = S.body.querySelector('#cbVersions'); if (!box) return;
    const r = await safe(db().rpc('course_builder_versions', { p_course:S.course, p_module:S.mid }));
    if (!document.contains(box)) return;
    if (r.error) { box.innerHTML = failed(r.error); return; }
    const OP = { UPDATE:'Before a publish', PUBLISH:'Before a publish', ROLLBACK:'Before a roll back', DELETE:'Before it was removed' };
    box.innerHTML = (r.data || []).length ? '<ul class="cb-vers">' + r.data.map(v => '<li><span><b>' + esc(when(v.saved_at)) + '</b> · ' + esc(OP[v.op] || v.op) + '</span><button type="button" class="p-btn is-ghost" data-roll="' + v.hist_id + '">Roll back to this</button></li>').join('') + '</ul>'
      : empty('No earlier versions yet. Each Publish keeps the version that was live.');
  }

  // ---------------- CB2: lesson editor ----------------
  function lessonTitle(){
    const it = A().find(S.w, S.key);
    if (!it) return '';
    return S.course === 'acq' ? it.title : S.course === 'mkt' ? 'Part ' + S.w.en.n + '.' + S.key + ' · ' + it.t : (it.label ? it.label + ' ' : '') + L(it.title, 'en');
  }
  function editorView(){
    const c = A(), ar = S.lang === 'ar';
    const langs = c.langs.length > 1 ? '<div class="p-seg" role="group" aria-label="Language">' + c.langs.map(l => '<button type="button" class="wk-seg' + (l === S.lang ? ' on' : '') + '" aria-pressed="' + (l === S.lang) + '" data-lang="' + l + '">' + (l === 'ar' ? 'Arabic' : 'English') + '</button>').join('') + '</div>' : '';
    return crumbs() + '<div class="cb-ed">' +
      '<div class="cb-left">' +
        '<section class="p-card"><div class="cb-row cb-edtop">' + langs + statePill() + '</div>' + headFields() + '</section>' +
        '<section class="p-card"><div class="p-card-head"><h2>' + (ar ? 'Arabic text' : 'Lesson text') + '</h2><span>' + (ar ? 'Right to left' : '') + '</span></div><div id="cbBlocks"' + (ar ? ' dir="rtl" lang="ar"' : '') + '>' + blocksHtml() + '</div></section>' +
        (S.course === 'acq' ? diagramsCard() + statesCard() : '') +
        mediaCard() +
        '<section class="p-card">' + publishBar() + '</section>' +
      '</div>' +
      '<div class="cb-right"><div class="cb-prevhead"><b>Live preview</b><span>' + esc(c.look) + '</span></div><iframe id="cbPrev" class="cb-prev" title="Preview of the lesson" sandbox="allow-same-origin"></iframe></div>' +
    '</div>';
  }
  function headFields(){
    const it = A().find(S.w, S.key), ar = S.lang === 'ar', dir = ar ? ' dir="rtl"' : '';
    if (S.course === 'acq') return '<label class="sc-f">Title (starts with the lesson number)<input type="text" data-f="title" value="' + esc(it.title || '') + '"></label>' +
      '<label class="sc-f">Short title (menus and Voice Studio)<input type="text" data-f="shortTitle" value="' + esc(it.shortTitle || '') + '"></label>' +
      '<p class="p-empty">Lesson number ' + esc(S.key) + ' stays the same, so narration, videos and progress keep working.</p>';
    if (S.course === 'mkt') {
      const p = ar ? (S.w.ar && S.w.ar.parts[+S.key - 1]) : it;
      if (ar && !p) return '<p class="p-empty">This module has no Arabic yet. Arabic modules come from the Marketing source files.</p>';
      return '<label class="sc-f">' + (ar ? 'Arabic title' : 'Part title') + '<input type="text" data-f="t"' + dir + ' value="' + esc(p.t || '') + '"></label>' +
        (ar ? '' : '<label class="sc-f px-inline">Minutes<input type="number" min="1" max="120" data-f="mins" value="' + esc(it.mins || '') + '"></label>');
    }
    return '<label class="sc-f">' + (ar ? 'Arabic title' : 'Title') + '<input type="text" data-f="title"' + dir + ' value="' + esc(L(it.title, S.lang)) + '"></label>' +
      '<p class="p-empty">Section ' + esc(it.label || it.id) + ' keeps its number and id (' + esc(it.id) + '), so Voice Studio and videos keep working.</p>';
  }
  // the blocks of the text being edited, for this course and language
  function textOf(){
    const it = A().find(S.w, S.key);
    if (S.course === 'acq') return mdBlocks(it.bodyMarkdown);
    if (S.course === 'psy') return htmlBlocks(L(it.html, S.lang));
    return null;   // Marketing: drawn per section
  }
  const BT = { h:'Heading', p:'Paragraph', box:'Box', img:'Picture', md:'List or table', ar:'Arabic summary (فصحى)', case:'Example', summary:'Summary', list:'List', table:'Table', html:'Block' };
  function blockHtml(b, i, scope){
    const tools = '<span class="cb-bt"><b>' + esc(b.t === 'box' && b.label ? b.label : b.t === 'box' ? boxKind(b.html) : BT[b.t] || 'Block') + '</b>' +
      '<button type="button" class="cb-ic" data-bmove="-1" data-i="' + i + '" data-s="' + scope + '" aria-label="Move up">↑</button><button type="button" class="cb-ic" data-bmove="1" data-i="' + i + '" data-s="' + scope + '" aria-label="Move down">↓</button>' +
      '<button type="button" class="cb-ic cb-del" data-bdel="' + i + '" data-s="' + scope + '" aria-label="Remove this block">×</button></span>';
    const at = ' data-i="' + i + '" data-s="' + scope + '"';
    let inner;
    if (S.course === 'acq') {
      const rows = s => Math.min(16, Math.max(2, Math.ceil(String(s || '').length / 70) + (String(s || '').match(/\n/g) || []).length));
      if (b.t === 'h') inner = '<input type="text" data-b="text"' + at + ' value="' + esc(b.text) + '">';
      else if (b.t === 'box') inner = '<select data-b="label"' + at + '>' + BOX_LABELS.concat(BOX_LABELS.some(l => l.toLowerCase() === b.label.toLowerCase()) ? [] : [b.label]).map(l => opt(l, l, l.toLowerCase() === b.label.toLowerCase())).join('') + '</select><textarea data-b="text"' + at + ' rows="' + rows(b.text) + '">' + esc(b.text) + '</textarea>';
      else if (b.t === 'img') inner = imgFields(b, at);
      else if (b.t === 'ar') inner = '<input type="text" data-b="h" dir="rtl"' + at + ' value="' + esc(b.h) + '"><textarea data-b="text" dir="rtl" lang="ar"' + at + ' rows="' + rows(b.text) + '">' + esc(b.text) + '</textarea>';
      else inner = '<textarea data-b="text"' + at + ' rows="' + rows(b.text) + '"' + (b.t === 'md' ? ' class="cb-mono"' : '') + (AR_RE.test(b.text) && !/[A-Za-z]{4}/.test(b.text) ? ' dir="rtl"' : '') + '>' + esc(b.text) + '</textarea>';
    } else {
      if (b.t === 'img') { const d = document.createElement('div'); d.innerHTML = b.html; const im = d.querySelector('img') || {}, cap = d.querySelector('figcaption');
        inner = imgFields({ alt:im.getAttribute ? im.getAttribute('alt') || '' : '', src:im.getAttribute ? (im.getAttribute('data-r2') ? 'r2:' + im.getAttribute('data-r2') : im.getAttribute('src') || '') : '', cap:cap ? cap.textContent : '' }, at); }
      else inner = (b.t === 'box' ? '<select data-b="kind"' + at + '>' + [['key', 'Why it matters / key point'], ['tip', 'Tip'], ['warn', 'Watch out'], ['note', 'Note']].map(([k, l]) => opt(k, l, boxKind(b.html) === k)).join('') + '</select>' : '') +
        '<div class="cb-rich" contenteditable="true" spellcheck="true" data-b="html"' + at + '>' + b.html + '</div>';
    }
    return '<div class="cb-block cb-' + b.t + '">' + tools + inner + '</div>';
  }
  const boxKind = html => ((String(html).match(/class="box ([a-z]+)/) || [])[1]) || 'key';
  // a picture block waiting for its file: Markdown needs a link to keep the block, so it points at this until the upload
  const PENDING = 'r2:course/pending';
  function imgFields(b, at){
    if (b.src === PENDING) b = Object.assign({}, b, { src:'' });
    return '<div class="cb-img">' + (b.src ? '<img class="cb-thumb" alt="" ' + (/^r2:/.test(b.src) ? 'data-r2="' + esc(b.src.slice(3)) + '"' : 'src="' + esc(b.src) + '"') + '>' : '') +
      '<label class="sc-f">Describe the picture (for screen readers)<input type="text" data-b="alt"' + at + ' value="' + esc(b.alt || '') + '"></label>' +
      '<label class="sc-f">Caption (optional)<input type="text" data-b="cap"' + at + ' value="' + esc(b.cap || '') + '"></label>' +
      '<label class="p-btn is-ghost cb-file">' + (b.src ? 'Replace the picture' : 'Choose a picture') + '<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-up="1"' + at + ' hidden></label>' +
      '<span class="p-empty">' + (b.src ? esc(/^r2:/.test(b.src) ? 'Stored with the course videos (R2)' : b.src) : 'No picture yet') + '</span></div>';
  }
  function addMenu(scope){
    const opts = S.course === 'acq' ? [['h', 'Heading'], ['p', 'Paragraph'], ['why', 'Why it matters'], ['ex', 'Example'], ['tip', 'Tip'], ['img', 'Picture'], ['md', 'List'], ['ar', 'Arabic summary']]
      : [['h', 'Heading'], ['p', 'Paragraph'], ['why', 'Why it matters'], ['ex', 'Example'], ['tip', 'Tip'], ['warn', 'Watch out'], ['img', 'Picture'], ['list', 'List']].concat(S.course === 'psy' ? [['sum', 'Summary']] : []);
    return '<div class="cb-add"><span>Add</span>' + opts.map(([k, l]) => '<button type="button" class="p-btn is-ghost" data-add="' + k + '" data-s="' + scope + '">' + esc(l) + '</button>').join('') + '</div>';
  }
  function blocksHtml(){
    if (S.course === 'mkt') return mktHtml();
    const list = textOf();
    return list.map((b, i) => blockHtml(b, i, 'body')).join('') + addMenu('body') + quizHook();
  }
  function quizHook(){
    const it = A().find(S.w, S.key);
    const n = S.course === 'acq' ? ((it.quiz && it.quiz.questions) || []).length : S.course === 'mkt' ? ((S.w.en && S.w.en.quiz) || []).length : 0;
    if (S.course === 'psy') return '';
    return '<div class="cb-quiz" data-hook="quiz"><b>' + (S.course === 'acq' ? 'Quiz' : 'Module checkpoint quiz') + '</b><span>' + plural(n, 'question') + (S.course === 'acq' && it.quiz && it.quiz.passMark ? ' · pass mark ' + esc(it.quiz.passMark) + '%' : '') + '</span>' +
      (hooks.quiz ? '<button type="button" class="p-btn is-ghost" data-act="quiz">' + (S.course === 'acq' ? (n ? 'Edit the questions' : 'Add a quiz') : 'Edit the module quiz') + '</button>' : '<span class="p-empty">Questions are edited in the quiz builder.</span>') + '</div>';
  }
  // Marketing parts: sections (heading + text), the example box, an optional B2B box and the terms
  function mktPart(){ const en = A().find(S.w, S.key); return S.lang === 'ar' ? (S.w.ar && S.w.ar.parts[+S.key - 1]) : en; }
  function mktHtml(){
    const p = mktPart(), ar = S.lang === 'ar', dir = ar ? ' dir="rtl"' : '';
    if (!p) return empty('This module has no Arabic yet.');
    return (p.s || []).map((s, j) => '<div class="cb-sec"><div class="cb-bt"><b>Section ' + (j + 1) + '</b>' + (ar ? '' : '<button type="button" class="cb-ic" data-smove="-1" data-j="' + j + '" aria-label="Move up">↑</button><button type="button" class="cb-ic" data-smove="1" data-j="' + j + '" aria-label="Move down">↓</button><button type="button" class="cb-ic cb-del" data-sdel="' + j + '" aria-label="Remove this section">×</button>') + '</div>' +
        '<label class="sc-f">Heading<input type="text" data-sh="' + j + '"' + dir + ' value="' + esc(s.h || '') + '"></label>' +
        htmlBlocks(s.b).map((b, i) => blockHtml(b, i, 's' + j)).join('') + addMenu('s' + j) + '</div>').join('') +
      (ar ? '' : '<div class="cb-row"><button type="button" class="p-btn is-ghost" data-act="addsec">+ Add a section</button></div>') +
      '<div class="cb-sec"><div class="cb-bt"><b>' + (ar ? 'مثال (Example box)' : 'Example box') + '</b></div>' + htmlBlocks(p.ex).map((b, i) => blockHtml(b, i, 'ex')).join('') + addMenu('ex') + '</div>' +
      '<div class="cb-sec"><div class="cb-bt"><b>B2B box (optional)</b></div>' + htmlBlocks(p.b2b || '').map((b, i) => blockHtml(b, i, 'b2b')).join('') + addMenu('b2b') + '</div>' +
      '<div class="cb-sec"><div class="cb-bt"><b>Terms</b></div>' + (p.terms || []).map((t, k) => '<div class="cb-term"><input type="text" data-term="0" data-k="' + k + '"' + dir + ' value="' + esc(t[0]) + '" aria-label="Term"><input type="text" data-term="1" data-k="' + k + '"' + dir + ' value="' + esc(t[1]) + '" aria-label="Meaning">' + (ar ? '' : '<button type="button" class="cb-ic cb-del" data-tdel="' + k + '" aria-label="Remove this term">×</button>') + '</div>').join('') +
        (ar ? '' : '<button type="button" class="p-btn is-ghost" data-act="addterm">+ Add a term</button>') + '</div>' + quizHook();
  }
  function getScope(scope){   // [get, set] for the HTML text a block list belongs to
    const it = A().find(S.w, S.key);
    if (S.course === 'psy') return [() => L(it.html, S.lang), v => { it.html = Object.assign({ en:'', ar:'' }, typeof it.html === 'object' ? it.html : { en:it.html }); it.html[S.lang] = v; }];
    if (S.course === 'acq') return [() => it.bodyMarkdown || '', v => { it.bodyMarkdown = v; }];
    const p = mktPart(), m = scope.match(/^s(\d+)$/);
    if (m) return [() => (p.s[+m[1]] || {}).b || '', v => { p.s[+m[1]].b = v; }];
    return [() => p[scope] || '', v => { p[scope] = v; }];
  }
  function readBlocks(scope){ const [get] = getScope(scope); return S.course === 'acq' ? mdBlocks(get()) : htmlBlocks(get()); }
  function writeBlocks(scope, list){ const [, set] = getScope(scope); set(S.course === 'acq' ? mdJoin(list) : htmlJoin(list)); }
  function newBlock(k){
    const ar = S.lang === 'ar';
    if (S.course === 'acq') return { h:{ t:'h', text:'New heading', style:'**' }, p:{ t:'p', text:'Write here.' }, why:{ t:'box', label:'Why it matters', sep:'.', text:'Write why this matters.' },
      ex:{ t:'box', label:'Example', sep:'.', text:'Write the example.' }, tip:{ t:'box', label:'Tip', sep:'.', text:'Write the tip.' }, img:{ t:'img', alt:'', src:PENDING, cap:'' },
      md:{ t:'md', text:'- First point\n- Second point' }, ar:{ t:'ar', h:'بالعربي', style:'**', text:'اكتب الملخص هنا بالفصحى.' } }[k];
    const H = { h:ar ? '<h4>عنوان جديد</h4>' : '<h4>New heading</h4>', p:ar ? '<p>اكتب هنا.</p>' : '<p>Write here.</p>',
      why:'<div class="box key"><div class="label">' + (ar ? 'لماذا يهم' : 'Why it matters') + '</div>\n<p>' + (ar ? 'اكتب هنا.' : 'Write here.') + '</p></div>',
      ex:'<div class="case"><div class="label">' + (ar ? 'مثال' : 'Example') + '</div>\n<p>' + (ar ? 'اكتب المثال هنا.' : 'Write the example here.') + '</p></div>',
      tip:'<div class="box tip"><div class="label">' + (ar ? 'نصيحة' : 'Tip') + '</div>\n<p>' + (ar ? 'اكتب هنا.' : 'Write here.') + '</p></div>',
      warn:'<div class="box warn"><div class="label">' + (ar ? 'انتبه' : 'Watch out') + '</div>\n<p>' + (ar ? 'اكتب هنا.' : 'Write here.') + '</p></div>',
      sum:'<div class="summary"><div class="label">' + (ar ? 'الخلاصة' : 'Summary') + '</div>\n<ul><li>' + (ar ? 'النقطة الأولى' : 'First point') + '</li></ul></div>',
      list:'<ul><li>' + (ar ? 'النقطة الأولى' : 'First point') + '</li><li>' + (ar ? 'النقطة الثانية' : 'Second point') + '</li></ul>',
      img:'<figure class="md-fig"><img alt=""></figure>' }[k];
    return H && { t:k === 'img' ? 'img' : 'p', html:H };
  }

  // diagrams (Acquisitions): drawn from course_diagrams; edited here as plain fields
  function diagramsCard(){
    const list = (S.w._diagrams || {})[S.key] || [];
    return '<section class="p-card"><div class="p-card-head"><h2>Diagrams</h2><span>' + plural(list.length, 'diagram') + '</span></div>' +
      list.map((d, n) => { const k = DG[d.kind] || DG.steps, rows = d[k.list] || [];
        return '<div class="cb-sec"><div class="cb-bt"><b>' + esc(k.label) + '</b><button type="button" class="cb-ic cb-del" data-ddel="' + n + '" aria-label="Remove this diagram">×</button></div>' +
          '<div class="cb-row"><label class="sc-f px-inline">Kind<select data-dk="' + n + '">' + Object.keys(DG).map(x => opt(x, DG[x].label, x === d.kind)).join('') + '</select></label>' +
          '<label class="sc-f">Title (optional)<input type="text" data-dt="' + n + '" data-f="title" value="' + esc(d.title || '') + '"></label></div>' +
          '<label class="sc-f">Goes after the paragraph that starts with<input type="text" data-dt="' + n + '" data-f="after" value="' + esc(d.after || '') + '"></label>' +
          rows.map((r, j) => '<div class="cb-dgrow">' + k.fields.map(([f, l]) => f === 'hi' ? '<label class="px-check"><input type="checkbox" data-dr="' + n + '" data-j="' + j + '" data-f="hi"' + (r.hi ? ' checked' : '') + '> ' + esc(l) + '</label>'
            : f === 'items' ? '<label class="sc-f">' + esc(l) + '<textarea rows="3" data-dr="' + n + '" data-j="' + j + '" data-f="items">' + esc((r.items || []).join('\n')) + '</textarea></label>'
            : '<label class="sc-f">' + esc(l) + '<input type="text" data-dr="' + n + '" data-j="' + j + '" data-f="' + f + '" value="' + esc(r[f] || '') + '"></label>').join('') +
            '<button type="button" class="cb-ic cb-del" data-drdel="' + n + '" data-j="' + j + '" aria-label="Remove this row">×</button></div>').join('') +
          '<button type="button" class="p-btn is-ghost" data-dradd="' + n + '">+ Add a row</button>' +
          (k.extra || []).map(([f, l]) => '<label class="sc-f">' + esc(l) + (f === 'links' ? '<textarea rows="2" data-dt="' + n + '" data-f="links">' + esc((d.links || []).join('\n')) + '</textarea>' : '<input type="text" data-dt="' + n + '" data-f="' + f + '" value="' + esc(d[f] || '') + '">') + '</label>').join('') + '</div>';
      }).join('') + '<button type="button" class="p-btn is-ghost" data-act="adddg">+ Add a diagram</button></section>';
  }
  // live state sheets (lessons 13.2, 13.2b, 13.3): the Contracts page's sheets, edited here, published with the module
  let stateRows = null;
  function statesCard(){
    const want = STATE_LESSONS[S.key]; if (!want || +S.w.number !== 13) return '';
    if (!stateRows) return '<section class="p-card" id="cbStates"><div class="p-card-head"><h2>State sheets</h2></div>' + PX.loading + '</section>';
    const pick = want === '*' ? (S.stateSel || (stateRows[0] || {}).state) : want, r = stateRows.find(x => x.state === pick);
    const sh = Object.assign({}, r && r.sheet, (S.w._states || {})[pick]);
    const fld = (k, l) => '<label class="sc-f">' + esc(l) + '<textarea rows="2" data-st="' + esc(pick) + '" data-f="' + k + '">' + esc(sh[k] || '') + '</textarea></label>';
    return '<section class="p-card" id="cbStates"><div class="p-card-head"><h2>State sheet</h2><span>Same sheet as the Contracts page and the Deal CRM</span></div>' +
      (want === '*' ? '<label class="sc-f px-inline">State<select data-act="statesel">' + stateRows.map(x => opt(x.state, x.name || x.state, x.state === pick)).join('') + '</select></label>' : '') +
      (r ? fld('wholesaling', 'Wholesaling rule') + fld('disclosure', 'Disclosure state?') + fld('closing', 'Who closes') + fld('deed', 'Usual deed') +
        '<label class="sc-f px-inline">Checked on<input type="date" data-st="' + esc(pick) + '" data-f="checked_on" value="' + esc(String(sh.checked_on || '').slice(0, 10)) + '"></label>' +
        '<p class="p-empty">Changes go live with Publish, here and on the Contracts page.</p>' : empty('No sheet for this state on the Contracts page yet.')) + '</section>';
  }
  function statesPreview(){
    const want = STATE_LESSONS[S.key]; if (!want || +S.w.number !== 13 || !stateRows) return '';
    const pick = want === '*' ? (S.stateSel || (stateRows[0] || {}).state) : want, r = stateRows.find(x => x.state === pick); if (!r) return '';
    const sh = Object.assign({}, r.sheet, (S.w._states || {})[pick]);
    const line = (k, v) => v ? '<div class="ss-row"><span class="k">' + k + '</span><span class="v">' + esc(v) + '</span></div>' : '';
    return '<section class="stack ss"><h2 class="sub">State sheet from the Contracts page</h2><div class="ss-card"><div class="between"><b>' + esc(r.name || r.state) + '</b></div>' +
      line('Wholesaling rule', sh.wholesaling) + line('Disclosure state?', sh.disclosure) + line('Who closes', sh.closing) + line('Usual deed', sh.deed) + '</div></section>';
  }
  // video and pictures
  function mediaCard(){
    const k = A().videoKey(S.mid, S.key);
    return '<section class="p-card"><div class="p-card-head"><h2>Video</h2><span></span></div>' +
      (k ? '<div id="cbVideo">' + PX.loading + '</div>' : empty('Marketing lessons have no videos.')) +
      (k ? '<div class="cb-row" data-hook="make-video">' + (hooks.makeVideo ? '<button type="button" class="p-btn" data-act="makevideo">Make the video</button>' : '<span class="p-empty">Make the video comes with the video tools next.</span>') + '</div><div id="r31Vid"></div>' : '') + '</section>';
  }
  async function loadVideo(){
    const box = S.body.querySelector('#cbVideo'), k = A().videoKey(S.mid, S.key); if (!box || !k) return;
    let url = null;
    if (S.course === 'acq') url = window.AmrMedia ? await window.AmrMedia(db()).url(k, true) : null;
    else { const r = await safe(bucket().createSignedUrl(k, 15 * 60)); url = r.data && r.data.signedUrl;
      if (url) { try { const h = await fetch(url, { method:'HEAD' }); if (!h.ok) url = null; } catch(e) { url = null; } } }
    if (!document.contains(box)) return;
    box.innerHTML = url ? '<video class="cb-video" controls preload="metadata" playsinline src="' + esc(url) + '"></video><p class="p-empty">This lesson’s video. It is tied to lesson ' + esc(S.key) + ', so it keeps playing in the course after edits.</p>'
      : empty('No video for this lesson yet.');
  }

  // ---------------- preview ----------------
  let prevTimer = null;
  function preview(){ clearTimeout(prevTimer); prevTimer = setTimeout(drawPreview, 250); }
  async function drawPreview(){
    const fr = S.body.querySelector('#cbPrev'); if (!fr) return;
    const p = A().preview(S.w, S.key, S.lang, { states:S.course === 'acq' ? statesPreview() : '', video:!!S.body.querySelector('#cbVideo video') });
    // R2 pictures get their signed-in links before the page is drawn (the preview runs no scripts)
    const d = document.createElement('div'); d.innerHTML = p.html;
    const imgs = [...d.querySelectorAll('img[data-r2]')].filter(im => im.getAttribute('data-r2') !== 'course/pending');
    if (imgs.length && window.AmrMedia) { const M = window.AmrMedia(db()); await Promise.all(imgs.map(async im => { const u = await M.url(im.getAttribute('data-r2'), false); if (u) im.setAttribute('src', u); })); }
    const ar = p.lang === 'ar';
    // Round 32: the preview shows what learners get, the course's EN / ع switch (E21) and the folding boxes (I17)
    if (A().langs.length > 1) d.insertAdjacentHTML('afterbegin', '<div class="cb-pl"><div class="cp-langs" role="group" aria-label="Language">' +
      A().langs.map(l => '<button type="button" data-prevlang="' + l + '" aria-pressed="' + (l === S.lang) + '"' + (l === 'ar' ? ' lang="ar"' : ' lang="en"') + '>' + (l === 'ar' ? 'ع' : 'EN') + '</button>').join('') + '</div></div>');
    if (window.LessonFold) window.LessonFold.mark(d, ar);
    p.css = p.css.concat(['/lesson-fold.css?v=1']);
    fr.srcdoc = '<!DOCTYPE html><html lang="' + (ar ? 'ar' : 'en') + '"' + (ar ? ' dir="rtl"' : '') + '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="' + location.origin + '/" target="_blank">' +
      '<link rel="stylesheet" href="' + FONTS + '">' + p.css.map(h => '<link rel="stylesheet" href="' + h + '">').join('') + '<style>.cb-pl{display:flex;justify-content:flex-end;padding:10px 14px 0}</style></head><body' + (p.bodyClass ? ' class="' + p.bodyClass + '"' : '') + '>' + d.innerHTML + '</body></html>';
    fr.onload = () => { try {
      const doc = fr.contentDocument, h = doc.documentElement.scrollHeight; fr.style.height = Math.min(Math.max(h, 400), 4000) + 'px';
      // the preview runs no scripts of its own, so the builder wires the switch and the boxes from here (nothing is saved)
      if (window.LessonFold) window.LessonFold.apply(doc.body, { lang:ar ? 'ar' : 'en' });
      doc.querySelectorAll('[data-prevlang]').forEach(b => b.addEventListener('click', async () => { if (b.dataset.prevlang === S.lang) return; S.lang = b.dataset.prevlang; draw(); }));
    } catch(e){} };
  }
  async function afterEditor(){
    preview(); loadVideo();
    if (window.AmrMediaFill) window.AmrMediaFill(db(), S.body);
    if (S.course === 'acq' && STATE_LESSONS[S.key] && +S.w.number === 13 && !stateRows) {
      const r = await safe(db().from('contract_states').select('state,name,sheet,sort').order('sort').order('state'));
      stateRows = r.data || [];
      const box = S.body.querySelector('#cbStates'); if (box) box.outerHTML = statesCard();
      preview();
    }
  }
  // redraw only the lesson text, so typing never loses its place
  function redrawBlocks(){ const b = S.body.querySelector('#cbBlocks'); if (b) b.innerHTML = blocksHtml(); if (window.AmrMediaFill) window.AmrMediaFill(db(), b); preview(); }

  // ======================================================================
  // Events
  // ======================================================================
  async function onClick(e){
    const t = e.target.closest('[data-course],[data-nav],[data-act],[data-move],[data-hide],[data-unhide],[data-roll],[data-lang],[data-add],[data-bmove],[data-bdel],[data-smove],[data-sdel],[data-tdel],[data-ddel],[data-drdel],[data-dradd],[data-go]');
    if (!t || t.tagName === 'SELECT') return;
    if (t.dataset.course) { e.preventDefault(); await flush(); S.course = t.dataset.course; S.mods = []; S.mid = null; S.problems = null; S.lang = 'en'; return go('#builder/' + S.course); }
    if (t.dataset.nav) { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); return go(t.dataset.nav); }
    if (t.dataset.go) { e.preventDefault(); return go(t.dataset.go); }
    if (t.dataset.lang) { S.lang = t.dataset.lang; return draw(); }
    const c = A();
    if (t.dataset.move) { if (c.move(S.w, t.dataset.k, +t.dataset.move)) { touch(); draw(); } else toast('It can’t move further that way.'); return; }
    if (t.dataset.hide) { if (c.hide(S.w, t.dataset.hide)) { touch(); draw(); toast('Hidden. Learners stop seeing it after you publish.'); } return; }
    if (t.dataset.unhide) { if (c.unhide(S.w, t.dataset.unhide)) { touch(); draw(); toast('Back in the module. Learners see it after you publish.'); } return; }
    if (t.dataset.roll) return rollback(t, +t.dataset.roll);
    // blocks
    if (t.dataset.add) { const sc = t.dataset.s, list = readBlocks(sc), b = newBlock(t.dataset.add); if (!b) return; list.push(b); writeBlocks(sc, list); touch(); redrawBlocks(); return; }
    if (t.dataset.bmove) { const sc = t.dataset.s, list = readBlocks(sc), i = +t.dataset.i, j = i + +t.dataset.bmove; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; writeBlocks(sc, list); touch(); redrawBlocks(); return; }
    if (t.dataset.bdel) { if (t.dataset.sure !== '1') { t.dataset.sure = '1'; t.textContent = 'Sure?'; return; } const sc = t.dataset.s, list = readBlocks(sc); list.splice(+t.dataset.bdel, 1); writeBlocks(sc, list); touch(); redrawBlocks(); return; }
    if (t.dataset.smove) { const p = mktPart(), j0 = +t.dataset.j, j1 = j0 + +t.dataset.smove; if (j1 < 0 || j1 >= p.s.length) return;
      [p.s[j0], p.s[j1]] = [p.s[j1], p.s[j0]]; const a = S.w.ar && S.w.ar.parts[+S.key - 1]; if (a && a.s[j0] && a.s[j1]) [a.s[j0], a.s[j1]] = [a.s[j1], a.s[j0]]; touch(); redrawBlocks(); return; }
    if (t.dataset.sdel) { if (t.dataset.sure !== '1') { t.dataset.sure = '1'; t.textContent = 'Sure?'; return; } const p = mktPart(), j = +t.dataset.sdel; p.s.splice(j, 1); const a = S.w.ar && S.w.ar.parts[+S.key - 1]; if (a && a.s) a.s.splice(j, 1); touch(); redrawBlocks(); return; }
    if (t.dataset.tdel) { const p = mktPart(), k = +t.dataset.tdel; p.terms.splice(k, 1); const a = S.w.ar && S.w.ar.parts[+S.key - 1]; if (a && a.terms) a.terms.splice(k, 1); touch(); redrawBlocks(); return; }
    // diagrams
    const dl = () => (S.w._diagrams[S.key] = S.w._diagrams[S.key] || []);
    if (t.dataset.ddel) { if (t.dataset.sure !== '1') { t.dataset.sure = '1'; t.textContent = 'Sure?'; return; } dl().splice(+t.dataset.ddel, 1); if (!dl().length) delete S.w._diagrams[S.key]; touch(); redrawSide(); return; }
    if (t.dataset.drdel) { const d = dl()[+t.dataset.drdel], k = DG[d.kind]; (d[k.list] || []).splice(+t.dataset.j, 1); touch(); redrawSide(); return; }
    if (t.dataset.dradd) { const d = dl()[+t.dataset.dradd], k = DG[d.kind]; (d[k.list] = d[k.list] || []).push({}); touch(); redrawSide(); return; }
    const act = t.dataset.act;
    if (act === 'check') return runCheck(t);
    if (act === 'closecheck') { S.problems = null; return draw(); }
    if (act === 'publish') return publish(t);
    if (act === 'drop') return drop(t);
    if (act === 'addmod') return addModule();
    if (act === 'addlesson') { const key = c.addLesson(S.w, t.dataset.part); if (!key) return toast('Add a part to this module first.'); touch(); return go('#builder/' + S.course + '/' + S.mid + '/' + encodeURIComponent(key)); }
    if (act === 'addsec') { const p = mktPart(); p.s.push({ h:'New section', b:'<p>Write here.</p>', src:[] }); const a = S.w.ar && S.w.ar.parts[+S.key - 1]; if (a) a.s.push({ h:'', b:'' }); touch(); redrawBlocks(); return; }
    if (act === 'addterm') { const p = mktPart(); (p.terms = p.terms || []).push(['', '']); const a = S.w.ar && S.w.ar.parts[+S.key - 1]; if (a) (a.terms = a.terms || []).push(['', '']); touch(); redrawBlocks(); return; }
    if (act === 'adddg') { dl().push({ kind:'steps', title:'', after:'', steps:[{ t:'First step', s:'' }] }); touch(); redrawSide(); return; }
    if (act === 'quiz' && hooks.quiz) return hooks.quiz(ctx());
    if (act === 'makevideo' && hooks.makeVideo) return hooks.makeVideo(ctx());
  }
  const ctx = () => ({ course:S.course, module:S.mid, lesson:S.key, lang:S.lang, work:S.w, live:S.live, revoice:S.revoice, def:A(),
    isDraft:isDraft(S.mid), save:touch, flush, redraw:draw, refresh:() => { S.mods = []; S.mid = null; route(); } });
  function redrawSide(){ const y = scrollY; draw(); scrollTo(0, y); }

  function onInput(e){
    const t = e.target; if (!S.key) return;
    const it = A().find(S.w, S.key);
    if (t.dataset.f && !t.dataset.dt && !t.dataset.dr && !t.dataset.st) {
      const f = t.dataset.f;
      if (S.course === 'acq') it[f] = t.value;
      else if (S.course === 'psy') { it.title = typeof it.title === 'object' ? it.title : { en:it.title || '', ar:'' }; it.title[S.lang] = t.value; }
      else { const p = mktPart(); if (f === 'mins') it.mins = Math.max(1, +t.value || 1); else p[f] = t.value; }
      touch(); preview(); return;
    }
    if (t.dataset.b) { blockInput(t); return; }
    if (t.dataset.sh != null) { mktPart().s[+t.dataset.sh].h = t.value; touch(); preview(); return; }
    if (t.dataset.term != null) { const p = mktPart(); p.terms[+t.dataset.k][+t.dataset.term] = t.value; touch(); preview(); return; }
    if (t.dataset.dt != null) { const d = S.w._diagrams[S.key][+t.dataset.dt], f = t.dataset.f; if (f === 'links') d.links = t.value.split('\n').map(s => s.trim()).filter(Boolean); else if (t.value) d[f] = t.value; else delete d[f]; touch(); preview(); return; }
    if (t.dataset.dr != null) { const d = S.w._diagrams[S.key][+t.dataset.dr], k = DG[d.kind], row = d[k.list][+t.dataset.j], f = t.dataset.f;
      if (f === 'hi') { if (t.checked) row.hi = true; else delete row.hi; } else if (f === 'items') row.items = t.value.split('\n').map(s => s.trim()).filter(Boolean); else if (t.value) row[f] = t.value; else delete row[f];
      touch(); preview(); return; }
    if (t.dataset.st) { const s = (S.w._states = S.w._states || {}), r = (stateRows || []).find(x => x.state === t.dataset.st);
      s[t.dataset.st] = Object.assign({}, r && r.sheet, s[t.dataset.st], { [t.dataset.f]:t.value }); touch(); preview(); return; }
  }
  // one block changed: rebuild that text from all its blocks (untouched blocks keep their exact original text)
  function blockInput(t){
    const sc = t.dataset.s, i = +t.dataset.i, list = readBlocks(sc), b = list[i]; if (!b) return;
    if (S.course === 'acq') {
      b.raw = null;
      if (t.dataset.b === 'label') b.label = t.value; else b[t.dataset.b] = t.value;
      if (b.t === 'box' && !b.sep) b.sep = '.';
    } else if (t.dataset.b === 'html') b.html = cleanHtml(t.innerHTML);
    else if (t.dataset.b === 'kind') b.html = b.html.replace(/class="box [a-z]+/, 'class="box ' + t.value);
    else if (b.t === 'img') { const d = document.createElement('div'); d.innerHTML = b.html; const fig = d.firstElementChild, im = fig.querySelector('img') || fig;
      if (t.dataset.b === 'alt') im.setAttribute('alt', t.value);
      if (t.dataset.b === 'cap') { let c = fig.querySelector('figcaption'); if (!t.value && c) c.remove(); else if (t.value) { if (!c) { c = document.createElement('figcaption'); fig.appendChild(c); } c.textContent = t.value; } }
      b.html = fig.outerHTML; }
    writeBlocks(sc, list); touch();
    // Enter made a new paragraph (or a blank line split one): draw the blocks again so each edit lands in the right place
    if (readBlocks(sc).length !== list.length) redrawBlocks(); else preview();
  }
  async function onChange(e){
    const t = e.target;
    if (t.dataset.act === 'statesel') { S.stateSel = t.value; const box = S.body.querySelector('#cbStates'); if (box) box.outerHTML = statesCard(); preview(); return; }
    if (t.dataset.dk != null) { const d = S.w._diagrams[S.key][+t.dataset.dk], from = DG[d.kind], to = DG[t.value];
      if (from.list !== to.list) { d[to.list] = d[from.list] || []; delete d[from.list]; } d.kind = t.value; touch(); redrawSide(); return; }
    if (t.dataset.b === 'label' || t.dataset.b === 'kind') { blockInput(t); redrawBlocks(); return; }
    if (t.dataset.up) return upload(t);
    if (t.type === 'checkbox' && t.dataset.dr != null) onInput(e);
  }
  // a picture goes to R2 (never Supabase storage), then the block points at it
  async function upload(inp){
    const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) return toast('Use a PNG, JPG, WebP or GIF picture.');
    if (f.size > 8 * 1024 * 1024) return toast('That picture is over 8 MB. Make it smaller first.');
    if (!window.AmrMedia) return toast('The media helper didn’t load. Refresh and try again.');
    const name = Date.now().toString(36) + '.' + (f.type.split('/')[1] === 'jpeg' ? 'jpg' : f.type.split('/')[1]), key = A().imageKey(S.mid, S.key, name);
    say('Uploading the picture…');
    const r = await window.AmrMedia(db()).put(key, f, f.type, { upsert:false });
    if (r.error) return say('The picture didn’t upload. ' + (r.error.message || ''));
    const sc = inp.dataset.s, list = readBlocks(sc), b = list[+inp.dataset.i];
    if (S.course === 'acq') { b.raw = null; b.src = 'r2:' + key; }
    else { const d = document.createElement('div'); d.innerHTML = b.html; const fig = d.firstElementChild; let im = fig.tagName === 'IMG' ? fig : fig.querySelector('img');
      if (!im) { im = document.createElement('img'); fig.prepend(im); } im.removeAttribute('src'); im.setAttribute('data-r2', key); b.html = fig.outerHTML; }
    writeBlocks(sc, list); touch(); redrawBlocks(); say('Picture added. It is stored with the course videos.');
  }

  // ======================================================================
  // CB5: the checker, and Publish / drop / roll back
  // ======================================================================
  async function check(mid){
    const drafts = Object.assign({}, S.drafts); if (S.mid && S.w) drafts[S.mid] = S.w;
    return A().check(mid, drafts);
  }
  async function runCheck(btn){
    btn.disabled = true; btn.textContent = 'Checking…';
    try { S.problems = { list:await check(null), at:new Date(), scope:A().name }; }
    catch(e) { S.problems = { error:(e && e.message) || 'The checker didn’t run.', list:[], at:new Date(), scope:A().name }; }
    draw(); const p = S.body.querySelector('#cbProblems'); if (p) p.scrollIntoView({ block:'start' });
  }
  function problemsCard(){
    const P = S.problems, err = P.list.filter(x => x.severity === 'error'), warn = P.list.filter(x => x.severity !== 'error');
    const row = x => '<li class="cb-pr is-' + (x.severity === 'error' ? 'err' : 'warn') + '">' + pill(x.severity === 'error' ? 'Must fix' : 'Check', x.severity === 'error' ? 'no' : '') +
      '<span>' + esc(x.label + (x.item ? ' · ' + (S.course === 'mkt' ? 'part ' : '') + x.item : '')) + ': ' + esc(x.issue) + '</span>' +
      (x.item && !/^part:/.test(x.item) ? '<a href="#builder/' + S.course + '/' + x.module + '/' + encodeURIComponent(x.item) + '" data-go="#builder/' + S.course + '/' + x.module + '/' + encodeURIComponent(x.item) + '">Open</a>'
        : '<a href="#builder/' + S.course + '/' + x.module + '" data-go="#builder/' + S.course + '/' + x.module + '">Open</a>') + '</li>';
    return '<section class="p-card" id="cbProblems"><div class="p-card-head"><h2>Course check · ' + esc(P.scope) + '</h2><span>' + esc(when(P.at)) + ' · drafts included</span></div>' +
      (P.error ? empty(P.error) : !P.list.length ? empty('No problems found.') :
        '<p class="cb-sum">' + pill(plural(err.length, 'thing') + ' to fix', err.length ? 'no' : 'ok') + ' ' + pill(plural(warn.length, 'thing') + ' to check', warn.length ? '' : 'ok') + '</p>' +
        '<ul class="cb-probs">' + err.concat(warn).slice(0, 300).map(row).join('') + '</ul>' + (P.list.length > 300 ? empty('Showing the first 300.') : '')) +
      '<button type="button" class="p-btn is-ghost" data-act="closecheck">Close</button></section>';
  }

  async function publish(btn){
    await flush();
    if (!isDraft(S.mid)) { say('Nothing to publish: there is no draft. Learners already see this version.'); return; }
    if (btn.dataset.sure !== '1') {
      // CB5 runs on its own before Publish
      btn.disabled = true; btn.textContent = 'Checking…';
      let list; try { list = await check(S.mid); } catch(e) { btn.disabled = false; btn.textContent = 'Publish module'; return say('The check didn’t run, so nothing was published. ' + ((e && e.message) || '')); }
      S.problems = { list, at:new Date(), scope:A().title(S.w) };
      const err = list.filter(x => x.severity === 'error').length;
      let changed = false;
      if (S.live && S.course !== 'mkt') { try { const l = await A().live(S.mid); changed = !!(S.baseAt && l.at && new Date(l.at) > new Date(S.baseAt)); } catch(e){} }
      draw();
      const b = S.body.querySelector('[data-act="publish"]'); if (!b) return;
      b.dataset.sure = '1';
      b.textContent = err ? 'Publish anyway (' + plural(err, 'problem') + ' to fix)' : 'Sure? Publish to learners';
      say((err ? 'The check found ' + plural(err, 'thing') + ' to fix (listed above). ' : list.length ? 'The check found only things to look at. ' : 'The check passed. ') +
        (changed ? 'The live module changed after you started this draft (another publish). Publishing replaces it with your draft. ' : '') + 'Press again to publish.');
      return;
    }
    btn.disabled = true; btn.textContent = 'Publishing…'; say('Publishing…');
    try {
      const before = S.live, after = S.w, mid = S.mid, c = A();
      await c.publish(mid, after, before);
      await syncShelf(mid, after);
      const marked = await markRevoice(mid, before, after);
      await safe(db().from('course_builder_drafts').delete().eq('course', S.course).eq('module_id', mid));
      delete S.drafts[mid]; S.mods = []; S.mid = null; S.problems = null;
      toast('Published. Learners see it the next time they open the course.' + (marked ? ' ' + plural(marked, 'lesson') + ' marked “needs re-voice”.' : ''));
      route();
    } catch(e) { btn.disabled = false; btn.dataset.sure = ''; btn.textContent = 'Publish module'; say('Not published: ' + ((e && e.message) || 'try again.')); }
  }
  async function syncShelf(mid, w){
    if (!A().canHide) return;
    const rows = (w._hidden || []).map(h => ({ course:S.course, module_id:mid, item_id:h.item.id, after_id:h.after, item:h.item }));
    const d = await safe(db().from('course_builder_shelf').delete().eq('course', S.course).eq('module_id', mid)); if (d.error) throw d.error;
    if (rows.length) { const x = await safe(db().from('course_builder_shelf').insert(rows)); if (x.error) throw x.error; }
  }
  // lessons with narration whose narrated text changed: mark "needs re-voice" with the lines that changed
  async function markRevoice(mid, before, after){
    if (!before) return 0;
    const c = A(), have = await c.narrated(mid); if (have && !have.size) return 0;
    const keys = []; const walk = l => (l || []).forEach(x => { keys.push(x.key); if (x.kids) walk(x.kids); }); walk(c.outline(after));
    const rows = [];
    keys.forEach(key => c.langs.forEach(lang => {
      if (S.course === 'psy' && lang !== 'ar') return;   // Psychology is narrated in Arabic
      if (have && !have.has(key)) return;
      const old = c.narr(before, key, lang), now = c.narr(after, key, lang); if (!old.length || same(old, now)) return;
      const was = new Set(old), lines = now.filter(s => !was.has(s));
      rows.push({ course:S.course, module_id:mid, item_id:key, lang, lines:lines.length ? lines : ['(lines removed)'], marked_at:new Date().toISOString(), cleared_at:null });
    }));
    if (!rows.length) return 0;
    const r = await safe(db().from('course_builder_revoice').upsert(rows)); return r.error ? 0 : rows.length;
  }
  async function drop(btn){
    if (btn.dataset.sure !== '1') { btn.dataset.sure = '1'; btn.textContent = 'Sure? Throw it away'; return; }
    clearTimeout(S.timer); S.timer = null;
    const r = await safe(db().from('course_builder_drafts').delete().eq('course', S.course).eq('module_id', S.mid));
    if (r.error) return say('Couldn’t throw it away. Try again.');
    delete S.drafts[S.mid]; const mid = S.mid; S.mid = null; toast('Draft thrown away. The live version is unchanged.');
    if (!S.mods.find(m => m.id === mid)) return go('#builder/' + S.course, true);
    route();
  }
  async function rollback(btn, hist){
    if (btn.dataset.sure !== '1') { btn.dataset.sure = '1'; btn.textContent = 'Sure? Learners get this version'; return; }
    btn.disabled = true; btn.textContent = 'Rolling back…';
    try {
      await flush();
      await A().rollback(S.mid, hist);
      const mid = S.mid; S.mods = []; S.mid = null;
      toast('Rolled back. The version that was live is kept too.' + (isDraft(mid) ? ' Your draft is still there.' : ''));
      route();
    } catch(e) { btn.disabled = false; btn.dataset.sure = ''; btn.textContent = 'Roll back to this'; toast('Not rolled back: ' + ((e && e.message) || 'try again.')); }
  }
  async function addModule(){
    const c = A(); if (!c.newModule) return;
    const n = c.newModule(S.mods.concat(Object.keys(S.drafts).filter(id => !S.mods.find(m => m.id === id)).map(id => ({ id, number:S.course === 'acq' ? S.drafts[id].number : S.drafts[id].num }))));
    const r = await safe(db().from('course_builder_drafts').upsert({ course:S.course, module_id:n.id, content:n.w, base_at:null }));
    if (r.error) return toast('Couldn’t add it. ' + (r.error.message || ''));
    S.drafts[n.id] = n.w; go('#builder/' + S.course + '/' + n.id);
  }
  addEventListener('beforeunload', e => { if (S.timer) { saveDraft(); e.preventDefault(); e.returnValue = ''; } });
})();
