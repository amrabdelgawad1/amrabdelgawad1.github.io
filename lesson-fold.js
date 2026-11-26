// Round 32 (plan I17): lighter lessons. "Why it matters" (Key idea) and "Example" boxes fold away, in every course player
// (/course for Acquisitions, /app/course for Marketing, /app/psychology for Psychology) and in the course builder's preview.
//
//   LessonFold.apply(root, { get, set, lang })
//     root  the lesson text (#content, #lessonText, .cp-page). The lesson text itself is never changed:
//           each box only gets a small Hide/Show button in its label row.
//     get   () => the saved state for this lesson ({ "0":1, "2":1 } = boxes 1 and 3 folded), or null
//     set   (state or null) => save it on the learner's account (each player passes its own synced store)
//     lang  'en' | 'ar' for the button words
//   LessonFold.reveal(el)  opens the box holding el without saving (search hits, jumps to the example)
//
// Every box is open on a learner's first visit to a lesson. After that, each box keeps the learner's choice.
// Printing always shows every box in full (lesson-fold.css hides folded content on screens only).
(function(){
  'use strict';
  if (window.LessonFold) return;
  const W = { hide:['Hide', 'إخفاء'], show:['Show', 'إظهار'], hideBox:['Hide this box', 'إخفاء هذا الصندوق'], showBox:['Show this box', 'إظهار هذا الصندوق'] };
  // Which boxes fold: every example box, and "Why it matters" boxes (Psychology calls them "Key idea").
  const WHY = /^(why it matters|key idea|لماذا يهم|فكرة أساسية)/i, EXAMPLE = /^(example|مثال)/i;
  const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();

  function headOf(box){ const h = box.firstElementChild; return h && h.matches('.label, .bl, .cp-kick') ? h : null; }
  function foldable(box){
    if (box.closest('.quiz, .q, .exam, .lqa')) return false;          // quiz questions styled as cases are not lesson boxes
    const h = headOf(box); if (!h) return false;
    if (box.children.length < 2) return false;                         // nothing under the label to fold
    const label = norm(h.textContent);
    if (box.classList.contains('case') || box.classList.contains('cp-box')) return true;   // example boxes (Marketing's B2B box is a second example)
    if (box.classList.contains('key')) return WHY.test(label);
    return WHY.test(label) || EXAMPLE.test(label);
  }
  function boxes(root){
    return [...root.querySelectorAll('.box, .case, .cp-box')].filter(b => b.classList.contains('lf') || foldable(b));
  }
  function setOpen(box, open, ar){
    box.classList.toggle('lf-shut', !open);
    const b = box.querySelector(':scope > .lf-head > .lf-btn'); if (!b) return;
    const i = ar ? 1 : 0, label = box.getAttribute('data-lf-label') || '';
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    b.setAttribute('aria-label', (open ? W.hideBox[i] : W.showBox[i]) + (label ? ': ' + label : ''));
    b.querySelector('.lf-w').textContent = open ? W.hide[i] : W.show[i];
  }
  // Adds the classes and button. Safe to run on a detached copy (the builder preview) and again on the live page.
  function mark(root, ar){
    boxes(root).forEach(box => {
      if (box.classList.contains('lf')) return;
      const h = headOf(box); box.classList.add('lf'); h.classList.add('lf-head'); box.setAttribute('data-lf-label', norm(h.textContent).slice(0, 60));
      const b = (root.ownerDocument || document).createElement('button');
      b.type = 'button'; b.className = 'lf-btn';
      b.innerHTML = '<span class="lf-w"></span>' + CHEV;
      h.appendChild(b); setOpen(box, true, ar);
    });
  }
  function apply(root, o){
    if (!root || !root.querySelectorAll) return;
    o = o || {}; const ar = o.lang === 'ar';
    mark(root, ar);
    let st = null; try { st = o.get ? o.get() : null; if (typeof st === 'string') st = JSON.parse(st); } catch(e){ st = null; }
    st = st && typeof st === 'object' ? st : {};
    boxes(root).forEach((box, i) => {
      if (!box._lfBound) setOpen(box, !st[i], ar);                   // first visit: nothing saved, so every box is open
      if (box._lfBound) return; box._lfBound = true;
      const toggle = () => {
        const open = box.classList.contains('lf-shut');
        setOpen(box, open, ar);
        if (!o.set) return;
        if (open) delete st[i]; else st[i] = 1;
        try { o.set(Object.keys(st).length ? Object.assign({}, st) : null); } catch(e){}
      };
      box.querySelector(':scope > .lf-head > .lf-btn').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggle(); });
      // the label row is a bigger target for a finger or mouse; the button stays the one for the keyboard
      box.querySelector(':scope > .lf-head').addEventListener('click', e => { if (!e.target.closest('a, button, input, textarea, select')) toggle(); });
    });
  }
  function reveal(el){ const box = el && el.closest && el.closest('.lf.lf-shut'); if (box) setOpen(box, true, (box.closest('[lang]') || document.documentElement).lang === 'ar'); }

  window.LessonFold = { apply, reveal, mark };
})();
