// Acquisitions extras on the learner side (see 20261102020000_acq_extras.sql):
//   #/drill            the daily drill: five questions from lessons already passed, graded in the database
//   card on Home       today's drill and the streak, and a note when Amr turned on the fast track
//   box on a lesson    "Hear it on a real call": library entries Amr linked to this lesson, with their example calls
(function(){
  'use strict';
  const A = window.CourseApp;
  if (!A) return;
  const { esc, header, mount, msgView, rpc, errText, db } = A;
  const $ = id => document.getElementById(id);
  const days = n => n + (n === 1 ? ' day' : ' days');

  async function card(el){
    if (!el) return;
    let d; try { d = await rpc('course_drill_today'); } catch(e){ return; }
    if (!document.body.contains(el)) return;
    const n = (d.questions || []).length, streak = d.streak || 0;
    let h = '';
    if (d.done) h = '<section class="card stack drill-card" aria-labelledby="drH"><div class="between"><b id="drH">Daily drill: done for today</b><span class="small muted">' + (streak ? 'Streak: ' + days(streak) : '') + '</span></div>' +
      '<p class="note">' + d.score + ' of ' + d.total + ' right today. New questions tomorrow.</p></section>';
    else if (n) h = '<section class="card stack drill-card" aria-labelledby="drH"><div class="between"><b id="drH">Daily drill</b><span class="small muted">' + (streak ? 'Streak: ' + days(streak) : 'Start a streak') + '</span></div>' +
      '<p class="note">' + n + ' questions from lessons you’ve already passed. About two minutes, once a day, so nothing slips.</p>' +
      '<a class="btn dark" href="#/drill">Start today’s drill</a></section>';
    if (d.fastTrack) h += '<section class="card stack" aria-labelledby="ftH"><b id="ftH">Fast track is on</b><p class="note">Amr opened the Module 1 to 4 checkpoints for you. Take each one without the lessons; pass it and the next module opens. The lessons stay there if you want them.</p></section>';
    el.innerHTML = h;
  }

  async function drill(){
    const at = location.hash, head = header({ back:'#/', backLabel:'Back to course home', ctx:'Practice', title:'Daily drill' });
    msgView('Loading today’s drill…', { header:head });
    let d; try { d = await rpc('course_drill_today'); } catch(e){ return msgView(errText(e), { retry:true, at, header:head }); }
    if (d.done) return msgView('You’ve done today’s drill: ' + d.score + ' of ' + d.total + ' right. Come back tomorrow for five new questions.', { header:head, link:['#/', 'Course home'], at });
    const qs = d.questions || [];
    if (!qs.length) return msgView('Your drill starts once you’ve passed a lesson quiz. Questions come only from lessons you’ve finished.', { header:head, link:['#/', 'Course home'], at });
    const body = qs.map((q, i) => {
      const multi = q.type === 'multiple';
      return '<fieldset class="stack drill-q" data-q="' + esc(q.id) + '"><legend class="sub">' + (i + 1) + '. ' + esc(q.prompt) + '</legend>' + (multi ? '<p class="hint">Pick every answer that’s right.</p>' : '') +
        '<div class="opts' + (multi ? ' multi' : '') + '">' + q.options.map(o => '<label class="opt"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="dq' + i + '" value="' + esc(o.id) + '">' +
          '<span class="bdg" aria-hidden="true">' + esc(o.id) + '</span><span><span class="vh">Option ' + esc(o.id) + ': </span>' + esc(o.text) + '</span></label>').join('') + '</div><div class="drill-fb" aria-live="polite"></div></fieldset>';
    }).join('');
    mount(head + '<main id="main" class="col"><div class="page has-bar"><span class="label o">' + (d.streak ? 'Streak: ' + days(d.streak) : 'Daily drill') + '</span><h1>Today’s five</h1>' +
        '<p class="note">From lessons you’ve passed. Answer all five, then check them together.</p>' + body + '<p class="note" id="drMsg" role="status"></p></div></main>' +
      '<div class="bar-foot"><div class="col"><button class="btn orange lg" type="button" data-act="check" id="drCheck">Check my answers</button></div></div>',
      { title:'Daily drill', at, acts:{
        check: async b => {
          const picks = {}; let missing = 0;
          document.querySelectorAll('.drill-q').forEach(f => { const v = [...f.querySelectorAll('input:checked')].map(i => i.value); if (!v.length) missing++; picks[f.dataset.q] = v; });
          if (missing) { $('drMsg').textContent = 'Answer every question first (' + missing + ' left).'; return; }
          b.disabled = true; $('drMsg').textContent = 'Checking…';
          let r; try { r = await rpc('course_drill_submit', { p_picks:picks }); } catch(e){ b.disabled = false; $('drMsg').textContent = errText(e); return; }
          (r.results || []).forEach(x => {
            const f = document.querySelector('.drill-q[data-q="' + CSS.escape(x.id) + '"]'); if (!f) return;
            f.querySelectorAll('input').forEach(i => { i.disabled = true; });
            f.querySelector('.drill-fb').innerHTML = '<div class="verdict ' + (x.right ? 'ok' : 'no') + '"><b>' + (x.right ? 'Correct' : 'Not quite') + '</b><p>' + esc(x.explanation || '') + '</p>' +
              (x.right ? '' : '<p><a class="drill-back" href="#/m/' + esc(x.module) + '/l/' + esc(x.lesson) + '">Go back to Lesson ' + esc(x.lesson) + '</a></p>') + '</div>';
          });
          $('drMsg').textContent = r.correct + ' of ' + r.total + ' right. Streak: ' + days(r.streak || 1) + '.';
          b.outerHTML = '<a class="btn dark lg" href="#/">Done</a>';
        }
      } });
  }

  async function hear(el, it){
    if (!el || !it) return;
    const r = await db.rpc('library_for_lesson', { p_lesson:it.id }).then(x => x, () => ({}));
    if (!Array.isArray(r.data) || !r.data.length || !document.body.contains(el)) return;
    const urls = {};
    await Promise.all(r.data.flatMap(e => (e.calls || []).slice(0, 2)).map(async c => {
      const s = await db.storage.from('hub-uploads').createSignedUrl(c.path, 3600).then(x => x, () => ({}));
      if (s.data && s.data.signedUrl) urls[c.path] = s.data.signedUrl;
    }));
    if (!document.body.contains(el)) return;
    el.innerHTML = '<section class="stack hear" aria-labelledby="hearH"><h2 class="sub" id="hearH">Hear it on a real call</h2>' +
      r.data.map(e => '<div class="card stack"><span class="label o">' + (e.kind === 'objection' ? 'When a seller says' : 'Script') + '</span><b>' + esc(e.title) + '</b>' +
        (e.body ? '<p class="hear-say">' + esc(e.body) + '</p>' : '') + (e.why ? '<p class="note">' + esc(e.why) + '</p>' : '') +
        (e.why_ar ? '<p class="note" dir="rtl" lang="ar">' + esc(e.why_ar) + '</p>' : '') +
        (e.calls || []).slice(0, 2).filter(c => urls[c.path]).map(c => '<div class="stack" data-s="g4"><span class="small muted">' + esc(c.title) + ' · scored ' + esc(c.total) + ' of 50. Pause before the answer: what would you say?</span><audio controls preload="none" src="' + esc(urls[c.path]) + '"></audio></div>').join('') +
      '</div>').join('') + '</section>';
  }

  window.CourseExtras = { card, drill, hear };
})();
