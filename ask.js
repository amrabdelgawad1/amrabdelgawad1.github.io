// On-page "Are you sure?" box for /app, /cash and /tracker, in place of the browser's OK / Cancel pop-ups.
// ask({ title, msg, ok, cancel, danger }) resolves true or false.
// With input: { label, value, placeholder, type } it resolves the typed text, or null on Cancel.
// input.multiline gives a bigger text box; input.minLength + input.error keep the box open until enough is typed;
// input.onCancel(text, nums) gets what was typed when they back out.
// input.numbers: [{ key, label, value }] adds optional number boxes above the text; it then resolves { text, nums } instead of the text.
(function(){
  let dlg, ttl, msg, inp, ta, lbl, err, okB, noB, nb, done = null, need = 0, needMsg = '', keep = null, numKeys = null;
  function build(){
    dlg = document.createElement('dialog'); dlg.className = 'ask';
    dlg.innerHTML = '<form method="dialog" novalidate><h3 class="ask-t"></h3><p class="ask-m"></p><div class="ask-nums" hidden></div><label class="ask-l"><span></span><input class="ask-i" autocomplete="off"><textarea class="ask-i ask-ta" rows="5"></textarea></label>' +
      '<p class="ask-e" role="alert" hidden></p><div class="ask-b"><button type="button" class="ask-no"></button><button type="submit" class="ask-ok"></button></div></form>';
    document.body.appendChild(dlg);
    ttl = dlg.querySelector('.ask-t'); msg = dlg.querySelector('.ask-m'); lbl = dlg.querySelector('.ask-l'); err = dlg.querySelector('.ask-e');
    inp = dlg.querySelector('input.ask-i'); ta = dlg.querySelector('.ask-ta'); okB = dlg.querySelector('.ask-ok'); noB = dlg.querySelector('.ask-no');
    nb = dlg.querySelector('.ask-nums');
    const field = () => ta.hidden ? inp : ta;
    const end = v => {
      if (v === null && keep) keep(field().value, nums()); // backed out: hand back what was typed so it isn't lost
      const f = done; done = null; keep = null; if (dlg.open) dlg.close(); if (f) f(v);
    };
    dlg.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      if (lbl.hidden) return end(true);
      const v = field().value;
      if (v.trim().length < need) { err.textContent = needMsg; err.hidden = false; field().focus(); return; }
      end(numKeys ? { text: v, nums: nums() } : v);
    });
    [inp, ta].forEach(el => el.addEventListener('input', () => { err.hidden = true; }));
    noB.addEventListener('click', () => end(lbl.hidden ? false : null));
    dlg.addEventListener('cancel', e => { e.preventDefault(); end(lbl.hidden ? false : null); }); // Esc
    dlg.addEventListener('click', e => { if (e.target === dlg) end(lbl.hidden ? false : null); }); // tap outside
  }
  // Whole numbers from the number boxes; an empty box is null
  function nums(){
    if (!numKeys) return null;
    const out = {};
    numKeys.forEach(k => { const v = parseInt(nb.querySelector('[name="' + k + '"]').value, 10); out[k] = isNaN(v) || v < 0 ? null : Math.min(v, 100000); });
    return out;
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
    keep = (o.input && o.input.onCancel) || null;
    need = (o.input && o.input.minLength) || 0; needMsg = (o.input && o.input.error) || 'Type a little more first.';
    const list = (o.input && o.input.numbers) || null;
    numKeys = list ? list.map(n => n.key) : null;
    nb.hidden = !list; nb.innerHTML = '';
    (list || []).forEach(n => {
      const l = document.createElement('label'); l.className = 'ask-num';
      const s = document.createElement('span'); s.textContent = n.label;
      const i = document.createElement('input'); i.className = 'ask-i'; i.type = 'number'; i.min = '0'; i.step = '1'; i.inputMode = 'numeric'; i.name = n.key;
      if (n.value != null) i.value = n.value;
      l.append(s, i); nb.appendChild(l);
    });
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
      (o.input ? (list ? nb.querySelector('input') : multi ? ta : inp) : o.danger ? noB : okB).focus();
    });
  };
})();
