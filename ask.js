// On-page "Are you sure?" box for /app, /cash and /tracker, in place of the browser's OK / Cancel pop-ups.
// ask({ title, msg, ok, cancel, danger }) resolves true or false.
// With input: { label, value, placeholder, type } it resolves the typed text, or null on Cancel.
// input.multiline gives a bigger text box; input.minLength + input.error keep the box open until enough is typed.
(function(){
  let dlg, ttl, msg, inp, ta, lbl, err, okB, noB, done = null, need = 0, needMsg = '';
  function build(){
    dlg = document.createElement('dialog'); dlg.className = 'ask';
    dlg.innerHTML = '<form method="dialog" novalidate><h3 class="ask-t"></h3><p class="ask-m"></p><label class="ask-l"><span></span><input class="ask-i" autocomplete="off"><textarea class="ask-i ask-ta" rows="5"></textarea></label>' +
      '<p class="ask-e" role="alert" hidden></p><div class="ask-b"><button type="button" class="ask-no"></button><button type="submit" class="ask-ok"></button></div></form>';
    document.body.appendChild(dlg);
    ttl = dlg.querySelector('.ask-t'); msg = dlg.querySelector('.ask-m'); lbl = dlg.querySelector('.ask-l'); err = dlg.querySelector('.ask-e');
    inp = dlg.querySelector('input.ask-i'); ta = dlg.querySelector('.ask-ta'); okB = dlg.querySelector('.ask-ok'); noB = dlg.querySelector('.ask-no');
    const field = () => ta.hidden ? inp : ta;
    const end = v => { const f = done; done = null; if (dlg.open) dlg.close(); if (f) f(v); };
    dlg.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      if (lbl.hidden) return end(true);
      const v = field().value;
      if (v.trim().length < need) { err.textContent = needMsg; err.hidden = false; field().focus(); return; }
      end(v);
    });
    [inp, ta].forEach(el => el.addEventListener('input', () => { err.hidden = true; }));
    noB.addEventListener('click', () => end(lbl.hidden ? false : null));
    dlg.addEventListener('cancel', e => { e.preventDefault(); end(lbl.hidden ? false : null); }); // Esc
    dlg.addEventListener('click', e => { if (e.target === dlg) end(lbl.hidden ? false : null); }); // tap outside
  }
  window.ask = function(o){
    if (typeof o === 'string') o = { msg: o };
    if (!dlg) build();
    if (done) done(o.input ? null : false);
    ttl.textContent = o.title || ''; ttl.hidden = !o.title;
    msg.textContent = o.msg || ''; msg.hidden = !o.msg;
    lbl.hidden = !o.input; err.hidden = true;
    const multi = !!(o.input && o.input.multiline);
    inp.hidden = multi; ta.hidden = !multi;
    dlg.classList.toggle('wide', multi);
    need = (o.input && o.input.minLength) || 0; needMsg = (o.input && o.input.error) || 'Type a little more first.';
    if (o.input) {
      lbl.querySelector('span').textContent = o.input.label || '';
      const f = multi ? ta : inp;
      if (!multi) { inp.type = o.input.type || 'text'; inp.inputMode = o.input.inputMode || ''; }
      f.value = o.input.value || ''; f.placeholder = o.input.placeholder || '';
    }
    okB.textContent = o.ok || 'OK'; noB.textContent = o.cancel || 'Cancel';
    okB.classList.toggle('danger', !!o.danger);
    return new Promise(res => {
      done = res;
      dlg.showModal();
      (o.input ? (multi ? ta : inp) : o.danger ? noB : okB).focus();
    });
  };
})();
