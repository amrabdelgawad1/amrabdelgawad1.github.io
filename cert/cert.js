// Certificate check: looks up a code with certificate_check and shows the certificate.
(function(){
  'use strict';
  // The site's public Supabase settings (same as every other page). The key only reaches certificate_check,
  // which returns no name for revoked certificates.
  var cfg = window.TRACKER_CONFIG || {}, URL_ = cfg.supabaseUrl, KEY = cfg.supabaseKey;
  var $ = function(id){ return document.getElementById(id); };
  var CODE_RE = /^ACQ-[0-9A-F]{5}-[0-9A-F]{5}$/;

  function fmt(d){
    if (!d) return '';
    var t = new Date(d + 'T12:00:00');
    return isNaN(t) ? d : t.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  }
  function status(kind, title, text){
    var s = $('status'); s.className = 'status ' + kind; s.hidden = false;
    $('stTitle').textContent = title; $('stText').textContent = text || '';
  }
  function clean(v){ return String(v || '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, ''); }

  function show(c){
    $('cert').hidden = false; $('actions').hidden = false;
    $('certName').textContent = c.name || '';
    $('fIssued').textContent = fmt(c.issued_on);
    $('fValid').textContent = fmt(c.valid_until);
    $('fRenewed').textContent = c.renewed_on ? fmt(c.renewed_on) : 'Not yet';
    $('fCode').textContent = c.code;
    document.title = (c.name ? c.name + ' · ' : '') + 'Acquisitions Playbook certificate';
  }

  function check(code){
    $('cert').hidden = true; $('actions').hidden = true;
    if (!URL_ || !KEY) { status('err', 'Couldn’t check right now', 'The checker isn’t connected. Try again later.'); return; }
    if (!CODE_RE.test(code)) { status('err', 'That code doesn’t look right', 'Codes look like ACQ-3F9A2-7C1D0: ACQ, then two groups of five letters and numbers.'); return; }
    status('warn', 'Checking…', '');
    fetch(URL_ + '/rest/v1/rpc/certificate_check', {
      method:'POST',
      headers:{ 'apikey':KEY, 'Authorization':'Bearer ' + KEY, 'Content-Type':'application/json' },
      body:JSON.stringify({ p_code:code })
    }).then(function(r){ if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function(rows){
        var c = rows && rows[0];
        $('checked').textContent = 'Checked ' + new Date().toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
        if (!c) { status('err', 'No certificate with that code', 'Check the code and try again. If it still doesn’t match, the certificate may not exist.'); return; }
        if (c.status === 'revoked') { status('err', 'This certificate was revoked', 'Code ' + c.code + ' is no longer valid.'); return; }
        show(c);
        if (c.status === 'renewal_due') {
          $('fValidLabel').textContent = 'Expired';
          status('warn', 'Renewal due', 'This certificate was valid until ' + fmt(c.valid_until) + '. It is renewed with one new scored call and the Lesson 20.5 quiz.');
        } else {
          $('fValidLabel').textContent = 'Valid until';
          status('ok', 'Valid certificate', 'Issued to ' + c.name + ' and current until ' + fmt(c.valid_until) + '.');
        }
      })
      .catch(function(){ status('err', 'Couldn’t check right now', 'Check your connection and try again.'); });
  }

  $('lookup').addEventListener('submit', function(e){
    e.preventDefault();
    var code = clean($('code').value);
    history.replaceState(null, '', '?c=' + encodeURIComponent(code));
    check(code);
  });
  $('printBtn').addEventListener('click', function(){ window.print(); });
  $('copyBtn').addEventListener('click', function(){
    var b = this, link = location.origin + location.pathname + location.search;
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function(){ b.textContent = 'Link copied'; setTimeout(function(){ b.textContent = 'Copy link'; }, 2000); })
      .catch(function(){ b.textContent = link; });
  });

  var start = clean(new URLSearchParams(location.search).get('c'));
  if (start) { $('code').value = start; check(start); }
})();
