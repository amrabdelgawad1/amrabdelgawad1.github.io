// Call counter (Phase 1), on My hours while clocked in: one tap per dial, conversation, offer or appointment.
// Each tap is a row in call_events (who, when, kind, which shift; never a phone number or a name). The end-of-shift
// numbers are filled from these counts, and the rep can still change them before sending.
// Table and rules: supabase/migrations/20261031110000_call_events.sql. Styles: app.css (#tCalls).
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const KINDS = [['dial', 'Dials'], ['conversation', 'Conversations'], ['offer', 'Offers'], ['appointment', 'Appointments']];
  let shift = null, counts = null, mine = [], busy = false, loadedFor = null;
  const T = () => window.TalentsApp || {};

  function draw(){
    const box = $('tCalls'); if (!box) return;
    box.hidden = !shift;
    if (!shift) return;
    const c = counts || {};
    $('tCallsGrid').innerHTML = KINDS.map(([k, label]) =>
      '<button type="button" class="call-tap" data-kind="' + k + '"' + (counts ? '' : ' disabled') + '><b class="num">' + (c[k] || 0) + '</b><span>' + label + '</span><small>Tap +1</small></button>').join('');
    $('tCallsUndo').disabled = !mine.length || busy;
  }
  async function load(){
    const db = T().db, st = T().clockState ? T().clockState() : null;
    shift = st && st.live ? st.live.started_at : null;
    if (!shift || !db) { counts = null; mine = []; loadedFor = null; draw(); return; }
    if (loadedFor === shift) { draw(); return; }
    loadedFor = shift; counts = null; draw();
    const { data, error } = await db.from('call_events').select('id,kind,at').eq('shift_started_at', shift).order('id');
    if (loadedFor !== shift) return;
    if (error) { counts = {}; $('tCallsMsg').textContent = /does not exist|not find/i.test(error.message || '') ? 'The call counter isn’t set up yet.' : 'Couldn’t load your counts. Check your connection.'; draw(); return; }
    counts = {}; (data || []).forEach(r => { counts[r.kind] = (counts[r.kind] || 0) + 1; });
    mine = (data || []).filter(r => Date.now() - new Date(r.at) < 9 * 60e3).map(r => r.id);
    $('tCallsMsg').textContent = '';
    draw();
  }
  async function tap(kind){
    const db = T().db; if (!db || !shift || !counts) return;
    counts[kind] = (counts[kind] || 0) + 1; draw();     // at once; put back if the save fails
    const { data, error } = await db.from('call_events').insert({ kind, shift_started_at:shift }).select('id').single();
    if (error) { counts[kind]--; draw(); $('tCallsMsg').textContent = 'That tap didn’t save. Check your connection and tap again.'; return; }
    $('tCallsMsg').textContent = '';
    mine.push(data.id); draw();
  }
  async function undo(){
    const db = T().db, id = mine[mine.length - 1]; if (!db || !id || busy) return;
    busy = true; draw();
    const { data, error } = await db.from('call_events').delete().eq('id', id).select('kind');
    busy = false;
    if (error || !data || !data.length) { $('tCallsMsg').textContent = 'Couldn’t undo that one (taps can be undone for 10 minutes).'; mine.pop(); draw(); return; }
    mine.pop(); counts[data[0].kind] = Math.max(0, (counts[data[0].kind] || 0) - 1);
    $('tCallsMsg').textContent = 'Undone.'; draw();
  }

  // Do-not-call list: check one number, or add one (dnc_check, dnc_add; the list itself is Amr's)
  async function dnc(add){
    const db = T().db, phone = $('dncPhone').value.trim(), msg = t => { $('dncMsg').textContent = t; };
    if (!db) return;
    if (phone.replace(/\D/g, '').length < 7) return msg('Type the full phone number first.');
    msg(add ? 'Adding…' : 'Checking…');
    const r = add ? await db.rpc('dnc_add', { p_phone:phone, p_reason:$('dncReason').value }) : await db.rpc('dnc_check', { p_phone:phone });
    if (r.error) return msg(/doesn.t look like/.test(r.error.message || '') ? 'That doesn’t look like a phone number.' : 'Couldn’t reach the list. Check your connection.');
    if (add) { $('dncPhone').value = ''; return msg('Added. Nobody on the team should call that number again.'); }
    msg(r.data ? 'On the do-not-call list. Don’t call this number.' : 'Not on the list.');
  }

  document.addEventListener('click', e => {
    if (e.target.closest('#dncCheck')) { dnc(false); return; }
    if (e.target.closest('#dncAdd')) { dnc(true); return; }
    const b = e.target.closest('#tCalls .call-tap'); if (b) { tap(b.dataset.kind); return; }
    if (e.target.closest('#tCallsUndo')) undo();
  });
  setInterval(() => { if ($('tCalls') && !$('pTrack').hidden) load(); }, 1500);

  window.TalentsCalls = {
    // the end-of-shift numbers: today's counts where the rep hasn't typed their own
    fill(nums){
      if (!counts || !shift) return nums;
      const n = Object.assign({}, nums || {});
      [['dials', 'dial'], ['conversations', 'conversation'], ['appointments', 'appointment']].forEach(([to, k]) => {
        if ((n[to] == null || n[to] === '') && counts[k]) n[to] = counts[k];
      });
      return n;
    },
    get counts(){ return counts ? Object.assign({}, counts) : null; },
    reset(){ loadedFor = null; }
  };
})();
