// Round 17 (Nov 17 2026), part 4: learner analytics for the Acquisitions course (Amr).
//   #learnstats  where people drop off (module by module), where each learner stopped, which quizzes they fail most,
//                and video watch time per lesson and per person (course_admin_videos). Learning Hub course videos
//                (Marketing, Psychology) are listed at the end.
// Database: portal_learn_analytics() (owner only) and course_admin_videos().
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, esc, safe, fmtDay, num, plural, card, empty, failed, pill, f, opt, table, tr, bar, widths } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const mins = m => { m = +m || 0; return m >= 60 ? Math.floor(m / 60) + 'h ' + Math.round(m % 60) + 'm' : (Math.round(m * 10) / 10) + ' min'; };
  const ago = t => { if (!t) return '–'; const d = Math.floor((Date.now() - new Date(t)) / 864e5); return d < 1 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; };

  V.learnstats = { title:'Learner analytics', sec:'owner', async open(el, ok){
    const body = PX.page(el, 'Learning', 'Learner analytics', 'Where learners drop off, which quizzes they fail most and how much of each video they watch, for the Acquisitions course.');
    const [a, v] = await Promise.all([safe(db().rpc('portal_learn_analytics')), safe(db().rpc('course_admin_videos'))]);
    if (!ok()) return;
    if (a.error) { body.innerHTML = failed(a.error); return; }
    const d = a.data || {}, mods = d.modules || [], quizzes = (d.quizzes || []).filter(q => +q.attempts > 0), vids = d.videos || [], per = v.data || [];
    const modName = id => { const m = mods.find(x => x.id === id); return m ? 'M' + m.number + ' ' + m.title : id; };
    const firstStart = Math.max(1, ...mods.map(m => +m.started || 0));
    // Biggest drop: the module after which the most people stop
    let drop = null; mods.forEach((m, i) => { const next = mods[i + 1]; if (next && +m.started > 0) { const lost = +m.started - +next.started; if (lost > 0 && (!drop || lost > drop.lost)) drop = { m, next, lost }; } });
    const totalWatch = vids.reduce((t, x) => t + (+x.watched_min || 0), 0);
    const failTotal = quizzes.reduce((t, q) => t + +q.fails, 0), attTotal = quizzes.reduce((t, q) => t + +q.attempts, 0);
    const tile = (val, label, sub) => '<div class="px-tile"><b>' + val + '</b><span>' + esc(label) + '</span>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
    // Per-person watch time
    const people = {}; per.forEach(x => { const p = people[x.userId] = people[x.userId] || { id:x.userId, min:0, videos:0, done:0, last:null }; p.min += (+x.watched || 0) / 60; p.videos++; if (x.completedAt) p.done++; if (!p.last || x.updatedAt > p.last) p.last = x.updatedAt; });
    const names = {}, mem = await safe(db().from('members').select('user_id,name')); if (!ok()) return;
    (mem.data || []).forEach(m => names[m.user_id] = m.name);
    const nm = id => names[id] || (id === (T().user || {}).id ? 'You' : 'A learner');

    body.innerHTML = '<div class="px-tiles">' +
        tile(num(d.learners || 0), 'learners', 'have opened at least one lesson') +
        tile(drop ? '−' + drop.lost : '–', 'biggest drop', drop ? 'after M' + drop.m.number + ' ' + drop.m.title : 'no drop yet') +
        tile(attTotal ? Math.round(failTotal / attTotal * 100) + '%' : '–', 'quiz tries failed', plural(attTotal, 'finished try', 'finished tries')) +
        tile(mins(totalWatch), 'video watched', plural(vids.length, 'video') + ' with views') + '</div>' +
      card('Where people drop off', 'started vs finished, module by module', mods.length ? '<div class="r17-funnel">' + mods.map(m =>
        '<div class="r17-frow"><span class="r17-fname"><b>M' + m.number + '</b> ' + esc(m.title) + '</span>' + bar(+m.started, firstStart) +
        '<span class="r17-fnum">' + num(m.started) + ' started · ' + num(m.finished) + ' finished' + (drop && drop.m.id === m.id ? ' ' + pill('Most stop after this', 'no') : '') + '</span></div>').join('') + '</div>'
        : empty('No modules yet.')) +
      card('Where each learner stopped', 'their last finished step', (d.stuck || []).length ? table(['Learner', 'Last step', 'Module', 'When'], d.stuck.map(s =>
        tr([esc(s.user || 'A learner'), esc(s.item), esc(modName(s.module)), esc(ago(s.at)) + (Date.now() - new Date(s.at) > 7 * 864e5 ? ' ' + pill('Quiet a week+', 'warn') : '')]))) : empty('Nobody has finished a step yet.')) +
      card('Quizzes failed most', 'by failed tries', quizzes.length ? table(['Quiz', 'Module', 'Tries', 'Failed', 'Fail rate', 'People', 'Avg score', 'Left midway'], quizzes.slice(0, 30).map(q =>
        tr([esc(q.title), 'M' + esc(q.number), num(q.attempts), num(q.fails), '<span class="r17-goal"><b>' + Math.round(q.fails / q.attempts * 100) + '%</b>' + bar(+q.fails, +q.attempts) + '</span>', num(q.people), q.avg == null ? '–' : esc(q.avg) + '%', num(q.abandoned)]))) : empty('No quiz tries yet.')) +
      card('Video watch time', 'per lesson', vids.length ? table(['Video', 'Module', 'Viewers', 'Watched on average', 'Got to on average', 'Finished', 'Total watched', 'Length'], vids.map(x =>
        tr([esc(x.title), 'M' + esc(x.number), num(x.viewers), '<span class="r17-goal"><b>' + (x.avg_pct == null ? '–' : x.avg_pct + '%') + '</b>' + bar(+x.avg_pct || 0, 100) + '</span>', (x.avg_furthest == null ? '–' : x.avg_furthest + '%'), num(x.completed), mins(x.watched_min), mins(x.duration_min)]))) : empty('No video views yet.')) +
      card('Video watch time', 'per person', Object.keys(people).length ? table(['Learner', 'Videos opened', 'Finished', 'Time watched', 'Last watched'], Object.values(people).sort((a, b) => b.min - a.min).map(p =>
        tr([esc(nm(p.id)), num(p.videos), num(p.done), mins(p.min), esc(ago(p.last))]))) : empty('No video views yet.')) +
      ((d.hub_videos || []).length ? card('Learning Hub course videos', 'Marketing and Psychology', table(['Course', 'Lesson', 'Viewers', 'Watched on average', 'Total watched'], d.hub_videos.map(x =>
        tr([esc({ mkt2:'Marketing', psy:'Psychology' }[x.course] || x.course), esc(x.module + ' · ' + x.item), num(x.viewers), x.avg_pct == null ? '–' : x.avg_pct + '%', mins(x.watched_min)])))) : '') +
      '<p class="p-hint">“Watched on average” counts seconds actually played; “got to” is the furthest point reached. Learner progress per person stays on <a href="#progress">Learner progress</a>.</p>';
    widths(body);
  }};
})();
