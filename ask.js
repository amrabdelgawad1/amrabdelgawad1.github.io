// On-page "Are you sure?" box for /app and /cash, in place of the browser's OK / Cancel pop-ups.
// ask({ title, msg, ok, cancel, danger }) resolves true or false.
// With input: { label, value, placeholder, type } it resolves the typed text, or null on Cancel.
(function(){
  let dlg, ttl, msg, inp, lbl, okB, noB, done = null;
  function build(){
    dlg = document.createElement('dialog'); dlg.className = 'ask';
    dlg.innerHTML = '<form method="dialog"><h3 class="ask-t"></h3><p class="ask-m"></p><label class="ask-l"><span></span><input class="ask-i" autocomplete="off"></label>' +
      '<div class="ask-b"><button type="button" class="ask-no"></button><button type="submit" class="ask-ok"></button></div></form>';
    document.body.appendChild(dlg);
    ttl = dlg.querySelector('.ask-t'); msg = dlg.querySelector('.ask-m'); lbl = dlg.querySelector('.ask-l');
    inp = dlg.querySelector('.ask-i'); okB = dlg.querySelector('.ask-ok'); noB = dlg.querySelector('.ask-no');
    const end = v => { const f = done; done = null; if (dlg.open) dlg.close(); if (f) f(v); };
    dlg.querySelector('form').addEventListener('submit', e => { e.preventDefault(); end(lbl.hidden ? true : inp.value); });
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
    lbl.hidden = !o.input;
    if (o.input) {
      lbl.querySelector('span').textContent = o.input.label || '';
      inp.type = o.input.type || 'text'; inp.inputMode = o.input.inputMode || '';
      inp.value = o.input.value || ''; inp.placeholder = o.input.placeholder || '';
    }
    okB.textContent = o.ok || 'OK'; noB.textContent = o.cancel || 'Cancel';
    okB.classList.toggle('danger', !!o.danger);
    return new Promise(res => {
      done = res;
      dlg.showModal();
      (o.input ? inp : o.danger ? noB : okB).focus();
    });
  };
})();
