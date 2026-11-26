// Plan Round 38 of the Portal Master Feature Plan (Nov 26 2026): automation. Amr only, except quiet hours.
//   #automations          A1  Rules: "when this happens, do that", on events the portal already records. Switch on and off,
//                             edit, test on a past event (nothing is done), and see each rule's runs.
//   #automations/log      A1  Run log for every rule (real runs and tests).
//   #automations/drafts   A1  Drafts waiting for Amr's OK. An automation never emails, texts or messages anyone outside the
//                             team, never changes money or pay and never deletes anything: those become drafts or tasks.
//   #automations/friday   A5  The Friday summary: on or off, the hour (Cairo), a test to Amr only, and the latest one.
//   Settings › Notifications  N7  Quiet hours (no phone alerts in that window; the bell still saves them).
// Phone alerts (N7): every bell already goes to the phone through the notifications_push trigger and push-send, following
// each person's notify_kind_prefs per kind. Round 38 adds quiet hours and the "Automations and Friday summary" kind.
// Database (migrations round38_n7_push_quiet_hours, round38_a1_automations, round38_a5_friday_summary):
//   notify_quiet_hours, automation_rules, automation_runs, automation_drafts, automation_recent(), automation_test(),
//   automation_run_now(), friday_summary_settings(), friday_summary_set(), friday_summary_test(); cron talents-friday-summary.
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, $, esc, safe, isOwner, card, empty, failed, pill, f, opt, plural, errText } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const toast = t => { if (window.PortalUI) window.PortalUI.toast(t); };
  const when = at => at ? new Date(at).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true, timeZone:'Africa/Cairo' }) : 'Never';
  const hourName = h => (h % 12 || 12) + ':00 ' + (h < 12 ? 'AM' : 'PM');

  // What a rule can listen for, and the fields it can check and use as {field} in its wording
  const FIELD = { deal:'Deal', from:'From stage', to:'To stage', person:'Person', is_me:'Done by me (yes or no)', hours:'Hours', dials:'Dials', conversations:'Conversations',
    appointments:'Appointments', offers:'Offers', day:'Day', owner_name:'Lead name', outcome:'Outcome', city:'City', state:'State', callback:'Callback', due:'Due',
    note:'Note', number:'Invoice number', company:'Client', amount:'Amount', paid_on:'Paid on', name:'Name', country:'Country', english:'English level',
    experience:'Experience', module:'Course part', lesson:'Lesson', title:'Task' };
  const TRIG = {
    deal_stage:['A deal moves to another stage', ['deal', 'from', 'to', 'person', 'is_me']],
    deal_closed:['A deal closes (closed, won, sold or funded)', ['deal', 'from', 'to', 'person', 'is_me']],
    deal_created:['A deal is added', ['deal', 'person', 'is_me']],
    clock_out:['Someone clocks out', ['person', 'hours', 'dials', 'conversations', 'appointments', 'offers', 'day']],
    lead_outcome:['A lead gets an outcome', ['owner_name', 'outcome', 'city', 'state', 'person']],
    callback_added:['A callback is set', ['callback', 'due', 'note', 'person']],
    invoice_sent:['An invoice is sent', ['number', 'company', 'amount', 'due']],
    payment_received:['A client payment comes in', ['number', 'company', 'amount', 'paid_on']],
    applicant_new:['Someone applies to join', ['name', 'country', 'city', 'english', 'experience']],
    lesson_done:['Someone finishes a lesson', ['person', 'module', 'lesson']],
    task_done:['A task is finished', ['person', 'title', 'due', 'is_me']]
  };
  const OPS = [['is', 'is'], ['is_not', 'is not'], ['has', 'has the words'], ['not_has', 'doesn’t have'], ['at_least', 'is at least'], ['at_most', 'is at most']];
  const ACTS = [['alert', 'Send a bell and phone alert'], ['task', 'Make a task'], ['note', 'Add a note'], ['tag', 'Add a tag'], ['move', 'Move the card'], ['draft', 'Draft a message for my OK']];
  const MOVES = [['todo', 'Tasks: To do'], ['doing', 'Tasks: Doing'], ['applied', 'Applicants: Applied'], ['screened', 'Applicants: Screened'], ['voice_test', 'Applicants: Voice test'], ['roleplay', 'Applicants: Roleplay'], ['offer', 'Applicants: Offer']];
  const S = { rules:[], members:[], edit:null, test:null, out:{} };

  const whoName = to => !to || to === 'owner' ? 'me' : to === 'person' ? 'the person in the event' : ((S.members.find(m => m.user_id === to) || {}).name || 'a team member');
  const condText = c => (FIELD[c.field] || c.field) + ' ' + ((OPS.find(o => o[0] === c.op) || OPS[0])[1]) + ' “' + c.value + '”';
  const actText = a => {
    if (a.type === 'alert') return 'Bell and phone alert to ' + whoName(a.to) + ': “' + (a.title || '') + '”';
    if (a.type === 'task') return 'Task for ' + whoName(a.to) + ': “' + (a.title || '') + '”' + (+a.due_days ? ', due in ' + plural(+a.due_days, 'day') : ', due today');
    if (a.type === 'note') return 'Note: “' + (a.text || '') + '”';
    if (a.type === 'tag') return 'Tag: #' + (a.tag || '');
    if (a.type === 'move') return 'Move the card to ' + ((MOVES.find(m => m[0] === a.to_stage) || [0, a.to_stage])[1]);
    if (a.type === 'draft') return 'Draft a ' + (a.channel === 'email' ? 'email' : a.channel === 'sms' ? 'text' : 'message') + (a.to_label ? ' to ' + a.to_label : '') + ' for your OK (nothing is sent)';
    return a.type;
  };
  const tabs = on => '<div class="lp-tabs r38-tabs">' + [['', 'Rules'], ['log', 'Run log'], ['drafts', 'Waiting for your OK'], ['friday', 'Friday summary']]
    .map(([k, t]) => '<a href="#automations' + (k ? '/' + k : '') + '" class="wk-seg' + (k === on ? ' on' : '') + '"' + (k === on ? ' aria-current="page"' : '') + '>' + t + '</a>').join('') + '</div>';

  V.automations = { title:'Automations', sec:'owner', async open(el){
    if (!isOwner()) { el.innerHTML = '<div class="p-wrap px"><p class="p-card p-empty">This page is only for Amr.</p></div>'; return; }
    const sub = location.hash.slice(1).split('/')[1] || '';
    el.innerHTML = '<div class="p-wrap px">' + PX.hero('Work', 'Automations', 'Simple rules: when something happens in the portal, the portal does the next step for you. Rules never email, text or message anyone outside the team, never touch money or pay, and never delete anything. Those wait here for your OK.') +
      tabs(sub) + '<div class="px-body" id="r38Body">' + PX.loading + '</div></div>';
    const B = $('r38Body');
    if (sub === 'log') return drawLog(B);
    if (sub === 'drafts') return drawDrafts(B);
    if (sub === 'friday') return drawFriday(B);
    return drawRules(B);
  } };

  // ---------------------------------------------------------------------------------------------------------- Rules
  async function loadRules(){
    const [r, m] = await Promise.all([safe(db().from('automation_rules').select('*').order('id')), safe(db().from('members').select('user_id,name,active').eq('active', true).order('name'))]);
    if (r.error) return r.error;
    S.rules = r.data || []; S.members = m.data || [];
    return null;
  }
  async function drawRules(B){
    const err = await loadRules(); if (err) { B.innerHTML = failed(err); return; }
    const on = S.rules.filter(x => x.is_on).length;
    B.innerHTML = '<div class="px-tools r38-top"><button type="button" class="p-btn" data-r38new>New rule</button><span class="p-hint">' + plural(S.rules.length, 'rule') + ', ' + on + ' switched on. The starter rules begin switched off.</span></div>' +
      (S.edit ? editor() : '') +
      (S.rules.length ? S.rules.map(ruleCard).join('') : card('Rules', '', empty('No rules yet.')));
  }
  function ruleCard(r){
    const t = TRIG[r.trigger_kind] || [r.trigger_kind, []];
    const test = S.test && S.test.id === r.id ? S.test : null;
    return '<section class="p-card r38-rule' + (r.is_on ? ' is-on' : '') + '" id="r38r' + r.id + '"><div class="p-card-head"><h2>' + esc(r.name) + '</h2><span>' +
      '<label class="r38-switch"><input type="checkbox" data-r38on="' + r.id + '"' + (r.is_on ? ' checked' : '') + ' aria-label="' + esc('Switch on: ' + r.name) + '"> ' + (r.is_on ? 'On' : 'Off') + '</label></span></div>' +
      (r.about ? '<p class="p-hint">' + esc(r.about) + '</p>' : '') +
      '<dl class="r38-dl"><dt>When</dt><dd>' + esc(t[0]) + '</dd>' +
      (r.conditions.length ? '<dt>Only if</dt><dd>' + r.conditions.map(c => esc(condText(c))).join('<br>') + '</dd>' : '') +
      '<dt>Then</dt><dd>' + r.actions.map(a => esc(actText(a))).join('<br>') + '</dd></dl>' +
      '<p class="p-hint">' + (r.runs ? 'Ran ' + plural(r.runs, 'time') + ', last ' + esc(when(r.last_run_at)) + ' Cairo time.' : 'Hasn’t run yet.') + '</p>' +
      '<div class="px-tools"><button type="button" class="p-btn is-ghost" data-r38edit="' + r.id + '">Edit</button><button type="button" class="p-btn is-ghost" data-r38test="' + r.id + '">Test on a past event</button>' +
      '<a class="p-btn is-ghost" href="#automations/log" data-r38logof="' + r.id + '">Runs</a>' + (r.starter_key ? '' : '<button type="button" class="p-btn is-ghost" data-r38del="' + r.id + '">Remove</button>') + '</div>' +
      (test ? testBox(r, test) : '') + '</section>';
  }
  function testBox(r, t){
    const pick = '<label class="sc-f">Pick a past event<select id="r38Ev">' + (t.events.length ? t.events.map(e => opt(e.ev_key, e.label + ' · ' + when(e.ev_at), e.ev_key === t.key)).join('') : opt('', 'No past events of this kind yet')) + '</select></label>';
    const res = t.result ? '<div class="r38-result" role="status">' + (t.result.error ? '<p class="p-hint is-bad">' + esc(t.result.error) + '</p>' : !t.result.matched ? '<p><b>No match.</b> This event doesn’t meet the rule’s “only if” conditions, so nothing would happen.</p>' :
      '<p><b>It matches.</b> Here is what would happen. Nothing was done.</p><ul>' + (t.result.steps.length ? t.result.steps.map(s => '<li' + (s.ok ? '' : ' class="is-bad"') + '>' + esc(s.text) + '</li>').join('') : '<li>No steps.</li>') + '</ul>') +
      (t.result.matched && r.is_on ? '<button type="button" class="p-btn is-ghost" data-r38runnow="' + r.id + '">Run it for real on this event</button>' : '') + '</div>' : '';
    return '<div class="r38-test"><h3>Test on a past event</h3>' + pick + '<div class="px-tools"><button type="button" class="p-btn" data-r38try="' + r.id + '"' + (t.events.length ? '' : ' disabled') + '>Test</button><button type="button" class="p-btn is-ghost" data-r38tclose>Close</button></div>' + res + '</div>';
  }

  // the editor (new rule or an existing one)
  const toSel = (id, v, withPerson) => '<select data-k="to" aria-label="Who">' + opt('owner', 'Me', !v || v === 'owner') + (withPerson ? opt('person', 'The person in the event', v === 'person') : '') +
    S.members.map(m => opt(m.user_id, m.name, v === m.user_id)).join('') + '</select>';
  function actRow(a, i){
    const t = a.type || 'alert', fx = '<p class="p-hint">Use {field} to put in a value from the event, like {person} or {amount}.</p>';
    let inner = '';
    if (t === 'alert') inner = f('To', toSel(i, a.to, true)) + f('Title', '<input type="text" data-k="title" maxlength="160" value="' + esc(a.title || '') + '">', 'px-wide') + f('More (optional)', '<input type="text" data-k="body" maxlength="300" value="' + esc(a.body || '') + '">', 'px-wide') + fx;
    if (t === 'task') inner = f('For', toSel(i, a.to, true)) + f('Due in (days)', '<input type="number" data-k="due_days" min="0" max="60" value="' + esc(a.due_days || 0) + '">') +
      f('Priority', '<select data-k="priority">' + [['normal', 'Normal'], ['high', 'High'], ['low', 'Low']].map(([k, l]) => opt(k, l, (a.priority || 'normal') === k)).join('') + '</select>') +
      f('Task', '<input type="text" data-k="title" maxlength="300" value="' + esc(a.title || '') + '">', 'px-wide') + f('Notes (optional)', '<input type="text" data-k="notes" maxlength="1000" value="' + esc(a.notes || '') + '">', 'px-wide') + fx;
    if (t === 'note') inner = f('Note', '<input type="text" data-k="text" maxlength="300" value="' + esc(a.text || '') + '">', 'px-wide') + '<p class="p-hint">Goes on the applicant, callback, task or lead. Deals and shifts can’t take notes from an automation, so you get a task to add it.</p>';
    if (t === 'tag') inner = f('Tag', '<input type="text" data-k="tag" maxlength="40" value="' + esc(a.tag || '') + '">') + '<p class="p-hint">Leads get the tag; applicants, callbacks and tasks get it in their notes.</p>';
    if (t === 'move') inner = f('Move to', '<select data-k="to_stage">' + MOVES.map(([k, l]) => opt(k, l, a.to_stage === k)).join('') + '</select>') + '<p class="p-hint">Works when the event has a card: an applicant card. Hired and Rejected stay your call.</p>';
    if (t === 'draft') inner = f('Kind', '<select data-k="channel">' + [['message', 'Message'], ['email', 'Email'], ['sms', 'Text']].map(([k, l]) => opt(k, l, (a.channel || 'message') === k)).join('') + '</select>') +
      f('To (who you’ll send it to)', '<input type="text" data-k="to_label" maxlength="200" value="' + esc(a.to_label || '') + '">') + f('Subject (optional)', '<input type="text" data-k="subject" maxlength="200" value="' + esc(a.subject || '') + '">', 'px-wide') +
      f('Message', '<textarea data-k="body" rows="3" maxlength="4000">' + esc(a.body || '') + '</textarea>', 'px-wide') + '<p class="p-hint">Only drafted. You copy it and send it yourself from Waiting for your OK.</p>' + fx;
    return '<fieldset class="r38-act" data-i="' + i + '"><legend>Step ' + (i + 1) + '</legend><div class="px-form">' + f('Do', '<select data-k="type" data-r38atype>' + ACTS.map(([k, l]) => opt(k, l, k === t)).join('') + '</select>') + inner + '</div>' +
      '<button type="button" class="p-btn is-ghost" data-r38adel="' + i + '">Remove this step</button></fieldset>';
  }
  function condRow(c, i, fields){
    return '<div class="r38-cond px-form" data-i="' + i + '">' + f('Field', '<select data-k="field">' + fields.map(k => opt(k, FIELD[k] || k, c.field === k)).join('') + '</select>') +
      f('Check', '<select data-k="op">' + OPS.map(([k, l]) => opt(k, l, (c.op || 'is') === k)).join('') + '</select>') +
      f('Value', '<input type="text" data-k="value" maxlength="120" value="' + esc(c.value || '') + '">') + '<button type="button" class="p-btn is-ghost" data-r38cdel="' + i + '">Remove</button></div>';
  }
  function editor(){
    const e = S.edit, fields = (TRIG[e.trigger_kind] || TRIG.applicant_new)[1];
    return '<section class="p-card r38-edit" id="r38Edit"><div class="p-card-head"><h2>' + (e.id ? 'Edit rule' : 'New rule') + '</h2><span></span></div><div class="px-form">' +
      f('Name', '<input type="text" id="r38Name" maxlength="120" value="' + esc(e.name || '') + '">', 'px-wide') +
      f('What it’s for (optional)', '<input type="text" id="r38About" maxlength="400" value="' + esc(e.about || '') + '">', 'px-wide') +
      f('When', '<select id="r38Trig">' + Object.entries(TRIG).map(([k, v]) => opt(k, v[0], k === e.trigger_kind)).join('') + '</select>', 'px-wide') + '</div>' +
      '<h3>Only if (optional)</h3>' + (e.conditions.length ? e.conditions.map((c, i) => condRow(c, i, fields)).join('') : '<p class="p-hint">No conditions: it runs on every event of this kind.</p>') +
      '<button type="button" class="p-btn is-ghost" data-r38cadd>Add a condition</button>' +
      '<h3>Then</h3>' + e.actions.map(actRow).join('') + (e.actions.length < 5 ? '<button type="button" class="p-btn is-ghost" data-r38aadd>Add a step</button>' : '') +
      '<p class="p-hint">Fields you can use: ' + fields.map(k => '{' + k + '}').join(' ') + '</p>' +
      '<div class="px-tools"><button type="button" class="p-btn" data-r38save>Save rule</button><button type="button" class="p-btn is-ghost" data-r38cancel>Cancel</button><span class="p-hint" id="r38Msg" role="status"></span></div></section>';
  }
  // read the editor back into S.edit (so a redraw keeps what was typed)
  function readEditor(){
    const box = $('r38Edit'); if (!box || !S.edit) return;
    S.edit.name = $('r38Name').value; S.edit.about = $('r38About').value; S.edit.trigger_kind = $('r38Trig').value;
    S.edit.conditions = [...box.querySelectorAll('.r38-cond')].map(r => ({ field:r.querySelector('[data-k="field"]').value, op:r.querySelector('[data-k="op"]').value, value:r.querySelector('[data-k="value"]').value }));
    S.edit.actions = [...box.querySelectorAll('.r38-act')].map(r => { const a = {}; r.querySelectorAll('[data-k]').forEach(x => { a[x.dataset.k] = x.type === 'number' ? +x.value : x.value; }); return a; });
  }
  const redrawEdit = () => { const box = $('r38Edit'); if (box) box.outerHTML = editor(); };

  // --------------------------------------------------------------------------------------------------------- Run log
  async function drawLog(B){
    const [r, x] = await Promise.all([safe(db().from('automation_runs').select('id,rule_id,at,event_kind,event_label,test,outcome,steps').order('at', { ascending:false }).limit(200)), safe(db().from('automation_rules').select('id,name'))]);
    if (r.error) { B.innerHTML = failed(r.error); return; }
    const names = {}; (x.data || []).forEach(z => names[z.id] = z.name);
    const only = S.logOf ? (r.data || []).filter(z => z.rule_id === S.logOf) : (r.data || []);
    const label = { done:['Done', 'ok'], test:['Test only', 'plain'], no_match:['No match', ''], error:['Problem', 'no'] };
    B.innerHTML = (S.logOf ? '<div class="px-tools"><span class="p-hint">Showing one rule: ' + esc(names[S.logOf] || '') + '</span><button type="button" class="p-btn is-ghost" data-r38logall>Show every rule</button></div>' : '') +
      card('Run log', plural(only.length, 'run'), only.length ? '<ul class="r38-log">' + only.map(z => '<li><div class="r38-logtop"><b>' + esc(names[z.rule_id] || 'A removed rule') + '</b> ' + pill.apply(null, label[z.outcome] || [z.outcome]) +
        '<small>' + esc(when(z.at)) + ' Cairo</small></div><p>' + esc(z.event_label || (TRIG[z.event_kind] || [z.event_kind])[0]) + '</p>' +
        ((z.steps || []).length ? '<ul>' + z.steps.map(s => '<li' + (s.ok ? '' : ' class="is-bad"') + '>' + esc(s.text) + '</li>').join('') + '</ul>' : '') + '</li>').join('') + '</ul>' : empty('No runs yet. Runs and tests show here.'));
  }

  // ------------------------------------------------------------------------------------------------ Waiting for your OK
  async function drawDrafts(B){
    const r = await safe(db().from('automation_drafts').select('*').order('created_at', { ascending:false }).limit(100));
    if (r.error) { B.innerHTML = failed(r.error); return; }
    const wait = (r.data || []).filter(d => d.status === 'waiting'), done = (r.data || []).filter(d => d.status !== 'waiting').slice(0, 20);
    const kind = c => c === 'email' ? 'Email' : c === 'sms' ? 'Text' : 'Message';
    const one = d => '<article class="r38-draft"><div class="r38-logtop"><b>' + esc(kind(d.channel)) + (d.to_label ? ' to ' + esc(d.to_label) : '') + '</b><small>' + esc(when(d.created_at)) + ' Cairo</small></div>' +
      (d.subject ? '<p><b>' + esc(d.subject) + '</b></p>' : '') + '<p class="r38-body">' + esc(d.body) + '</p>' +
      (d.status === 'waiting' ? '<div class="px-tools"><button type="button" class="p-btn is-ghost" data-r38copy="' + d.id + '">Copy the text</button><button type="button" class="p-btn" data-r38dset="' + d.id + '" data-to="done_by_me">I sent it myself</button>' +
        '<button type="button" class="p-btn is-ghost" data-r38dset="' + d.id + '" data-to="dismissed">Not needed</button></div>' : '<p class="p-hint">' + (d.status === 'done_by_me' ? 'You sent this yourself.' : 'Marked not needed.') + '</p>') + '</article>';
    S.drafts = r.data || [];
    B.innerHTML = card('Waiting for your OK', plural(wait.length, 'draft'), '<p class="p-hint">Automations only draft these. Nothing goes to a client, seller or anyone outside the team until you send it yourself.</p>' + (wait.length ? wait.map(one).join('') : empty('Nothing waiting.'))) +
      (done.length ? card('Handled lately', '', done.map(one).join('')) : '');
  }

  // --------------------------------------------------------------------------------------------------- Friday summary
  async function drawFriday(B){
    const r = await safe(db().rpc('friday_summary_settings'));
    if (r.error) { B.innerHTML = failed(r.error); return; }
    const s = r.data || { on:true, hour:17 };
    B.innerHTML = card('Friday summary', s.on ? pill('On', 'ok') : pill('Off', ''), '<p class="p-hint">One page for you every Friday, in the bell and by email: shifts and hours, calls by rep, deals, fees, invoices, cash this week, lessons, applicants, and what’s waiting for you. Only you get it.</p>' +
      '<div class="px-form"><label class="r38-switch"><input type="checkbox" id="r38FriOn"' + (s.on ? ' checked' : '') + '> Send me the Friday summary</label>' +
      f('At (Cairo time)', '<select id="r38FriHour">' + Array.from({ length:24 }, (_, h) => opt(h, hourName(h), +s.hour === h)).join('') + '</select>') + '</div>' +
      '<div class="px-tools"><button type="button" class="p-btn is-ghost" id="r38FriTest">Send a test to me now</button><span class="p-hint" id="r38FriMsg" role="status"></span></div>') +
      card('Latest summary', s.last ? esc(when(s.last.made_at)) + ' Cairo' + (s.last.test ? ' · test' : '') : '', s.last ? '<p class="p-hint">' + esc(s.last.subject || '') + '</p><iframe class="r38-frame" id="r38Frame" sandbox title="Latest Friday summary"></iframe>' : empty('None yet. The first one comes this Friday, or send a test.'));
    const fr = $('r38Frame');
    if (fr && s.last) { fr.srcdoc = s.last.html || ''; fr.addEventListener('load', () => { try { fr.style.height = Math.min(2400, fr.contentDocument.body.scrollHeight + 30) + 'px'; } catch(e) { fr.style.height = '900px'; } }); }
  }

  // ------------------------------------------------------------------------------------------------------- clicks
  const blankAct = t => t === 'task' ? { type:'task', to:'owner', title:'', due_days:1 } : t === 'draft' ? { type:'draft', channel:'message', body:'' } : t === 'move' ? { type:'move', to_stage:'screened' } : t === 'note' ? { type:'note', text:'' } : t === 'tag' ? { type:'tag', tag:'' } : { type:'alert', to:'owner', title:'' };
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-r38new],[data-r38edit],[data-r38cancel],[data-r38save],[data-r38cadd],[data-r38cdel],[data-r38aadd],[data-r38adel],[data-r38test],[data-r38tclose],[data-r38try],[data-r38runnow],[data-r38del],[data-r38logof],[data-r38logall],[data-r38copy],[data-r38dset],#r38FriTest');
    if (!b || !isOwner()) return;
    const B = $('r38Body'); if (!B) return;
    const d = b.dataset;
    if ('r38new' in d) { S.edit = { name:'', about:'', trigger_kind:'applicant_new', conditions:[], actions:[blankAct('alert')] }; await drawRules(B); $('r38Name').focus(); return; }
    if ('r38edit' in d) { const r = S.rules.find(x => x.id === +d.r38edit); S.edit = JSON.parse(JSON.stringify(r)); await drawRules(B); $('r38Edit').scrollIntoView({ block:'start' }); $('r38Name').focus(); return; }
    if ('r38cancel' in d) { S.edit = null; await drawRules(B); return; }
    if ('r38cadd' in d) { readEditor(); S.edit.conditions.push({ field:TRIG[S.edit.trigger_kind][1][0], op:'is', value:'' }); redrawEdit(); return; }
    if ('r38cdel' in d) { readEditor(); S.edit.conditions.splice(+d.r38cdel, 1); redrawEdit(); return; }
    if ('r38aadd' in d) { readEditor(); S.edit.actions.push(blankAct('alert')); redrawEdit(); return; }
    if ('r38adel' in d) { readEditor(); if (S.edit.actions.length > 1) S.edit.actions.splice(+d.r38adel, 1); redrawEdit(); return; }
    if ('r38save' in d) {
      readEditor(); const x = S.edit, msg = t => { const m = $('r38Msg'); if (m) m.textContent = t; };
      if (!x.name.trim()) return msg('Give the rule a name.');
      if (x.actions.some(a => (a.type === 'alert' || a.type === 'task') && !String(a.title || '').trim())) return msg('Every alert and task needs a title.');
      if (x.actions.some(a => a.type === 'draft' && !String(a.body || '').trim())) return msg('Write the draft message.');
      x.conditions = x.conditions.filter(c => String(c.value).trim() !== '');
      const row = { name:x.name.trim(), about:x.about.trim() || null, trigger_kind:x.trigger_kind, conditions:x.conditions, actions:x.actions, updated_at:new Date().toISOString() };
      b.disabled = true; msg('Saving…');
      const w = x.id ? await safe(db().from('automation_rules').update(row).eq('id', x.id)) : await safe(db().from('automation_rules').insert(row));
      b.disabled = false;
      if (w.error) return msg(errText(w, 'Couldn’t save. Try again.'));
      S.edit = null; toast(x.id ? 'Rule saved.' : 'Rule added, switched off. Test it, then switch it on.'); await drawRules(B); return;
    }
    if ('r38test' in d) {
      const r = S.rules.find(x => x.id === +d.r38test); if (!r) return;
      const ev = await safe(db().rpc('automation_recent', { p_kind:r.trigger_kind }));
      S.test = { id:r.id, events:ev.data || [], key:((ev.data || [])[0] || {}).ev_key, result:null };
      await drawRules(B); const box = $('r38r' + r.id); if (box) box.scrollIntoView({ block:'nearest' }); return;
    }
    if ('r38tclose' in d) { S.test = null; await drawRules(B); return; }
    if ('r38try' in d) {
      const key = $('r38Ev').value; if (!key) return;
      b.disabled = true; const x = await safe(db().rpc('automation_test', { p_rule:+d.r38try, p_key:key })); b.disabled = false;
      S.test.key = key; S.test.result = x.error ? { error:errText(x, 'Couldn’t test. Try again.') } : x.data;
      await drawRules(B); return;
    }
    if ('r38runnow' in d) {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? This does the steps for real'; return; }
      b.disabled = true; const x = await safe(db().rpc('automation_run_now', { p_rule:+d.r38runnow, p_key:S.test.key })); b.disabled = false;
      if (x.error) { toast(errText(x, 'Couldn’t run it. Try again.')); return; }
      S.test = null; toast('Done. See the run log.'); await drawRules(B); return;
    }
    if ('r38del' in d) {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? Remove it'; return; }
      const x = await safe(db().from('automation_rules').delete().eq('id', +d.r38del));
      if (x.error) { toast(errText(x, 'Couldn’t remove it.')); return; }
      toast('Rule removed.'); await drawRules(B); return;
    }
    if ('r38logof' in d) { S.logOf = +d.r38logof; return; }   // the link opens the log
    if ('r38logall' in d) { S.logOf = null; await drawLog(B); return; }
    if ('r38copy' in d) {
      const x = (S.drafts || []).find(z => z.id === +d.r38copy); if (!x) return;
      try { await navigator.clipboard.writeText((x.subject ? x.subject + '\n\n' : '') + x.body); toast('Copied.'); } catch(er) { toast('Couldn’t copy. Select the text instead.'); }
      return;
    }
    if ('r38dset' in d) {
      const x = await safe(db().from('automation_drafts').update({ status:d.to, decided_at:new Date().toISOString() }).eq('id', +d.r38dset));
      if (x.error) { toast(errText(x, 'Couldn’t save.')); return; }
      await drawDrafts(B); return;
    }
    if (b.id === 'r38FriTest') {
      b.disabled = true; PX.say('r38FriMsg', 'Sending…');
      const x = await safe(db().rpc('friday_summary_test')); b.disabled = false;
      PX.say('r38FriMsg', x.error ? errText(x, 'Couldn’t send it. Try again.') : 'Sent to you only. Check the bell and your email.');
      if (!x.error) setTimeout(() => drawFriday(B), 1200);
    }
  });
  document.addEventListener('change', async e => {
    const t = e.target;
    if (t.matches('[data-r38on]') && isOwner()) {
      const id = +t.dataset.r38on, on = t.checked;
      const x = await safe(db().from('automation_rules').update({ is_on:on, updated_at:new Date().toISOString() }).eq('id', id));
      if (x.error) { t.checked = !on; toast(errText(x, 'Couldn’t switch it.')); return; }
      const r = S.rules.find(z => z.id === id); if (r) r.is_on = on;
      const lab = t.closest('label'); if (lab) lab.lastChild.textContent = on ? ' On' : ' Off';
      const box = t.closest('.r38-rule'); if (box) box.classList.toggle('is-on', on);
      toast(on ? 'Switched on.' : 'Switched off.'); return;
    }
    if (t.matches('[data-r38atype]')) { readEditor(); const i = +t.closest('.r38-act').dataset.i; S.edit.actions[i] = Object.assign(blankAct(t.value), { type:t.value }); redrawEdit(); return; }
    if (t.id === 'r38Trig') { readEditor(); const fl = TRIG[S.edit.trigger_kind][1]; S.edit.conditions = S.edit.conditions.filter(c => fl.includes(c.field)); redrawEdit(); return; }
    if ((t.id === 'r38FriOn' || t.id === 'r38FriHour') && isOwner()) {
      const on = $('r38FriOn').checked, hr = +$('r38FriHour').value;
      const x = await safe(db().rpc('friday_summary_set', { p_on:on, p_hour:hr }));
      PX.say('r38FriMsg', x.error ? errText(x, 'Couldn’t save. Try again.') : on ? 'Saved. It comes every Friday at ' + hourName(hr) + ' Cairo time.' : 'Friday summary off.');
    }
  });

  // ---------------------------------------------------------------------------------------- N7 quiet hours (everyone)
  async function quietDraw(B){
    const sec = document.createElement('section'); sec.className = 'r23-set r38-quiet'; sec.setAttribute('aria-labelledby', 'r38QuietH');
    sec.innerHTML = '<h4 id="r38QuietH">Quiet hours</h4><p class="note">Loading…</p>';
    B.appendChild(sec);
    const r = await safe(db().from('notify_quiet_hours').select('*').maybeSingle());
    if (r.error) { sec.innerHTML = '<h4 id="r38QuietH">Quiet hours</h4><p class="note">This part isn’t set up yet.</p>'; return; }
    const q = r.data || { is_on:false, from_hour:22, to_hour:8 };
    const hrs = (id, v) => '<select id="' + id + '" aria-label="' + (id === 'r38QFrom' ? 'Quiet from' : 'Quiet until') + '">' + Array.from({ length:24 }, (_, h) => opt(h, hourName(h), +v === h)).join('') + '</select>';
    sec.innerHTML = '<h4 id="r38QuietH">Quiet hours</h4><p class="note">No phone alerts in these hours. The bell still keeps them for when you open the portal. Sign-in warnings and must-read announcements still come through.</p>' +
      '<label class="r22-npline"><input type="checkbox" id="r38QOn"' + (q.is_on ? ' checked' : '') + '> Use quiet hours</label>' +
      '<label class="r22-npline">from ' + hrs('r38QFrom', q.from_hour) + ' until ' + hrs('r38QTo', q.to_hour) + ' Cairo time</label><p class="note" id="r38QMsg" role="status"></p>' +
      '<details class="r38-steps"><summary>How to get alerts on your phone</summary><p><b>iPhone</b> (iOS 16.4 or later): open amrabdelgawad.site/app in Safari, tap Share, then Add to Home Screen. Open the portal from the new icon, sign in, and turn on phone alerts here. Alerts only work from that icon, not from Safari.</p>' +
      '<p><b>Android</b>: open amrabdelgawad.site/app in Chrome, tap the menu, then Install app (or Add to Home screen). Open it, sign in, turn on phone alerts here and tap Allow.</p>' +
      '<p>Then each kind of alert above follows your Phone ticks. If alerts stop, turn phone alerts off and on again on that phone.</p></details>';
  }
  document.addEventListener('change', async e => {
    if (!['r38QOn', 'r38QFrom', 'r38QTo'].includes(e.target.id)) return;
    const u = await db().auth.getUser();
    const row = { user_id:u.data && u.data.user && u.data.user.id, is_on:$('r38QOn').checked, from_hour:+$('r38QFrom').value, to_hour:+$('r38QTo').value, updated_at:new Date().toISOString() };
    if (!row.user_id) return;
    const x = await safe(db().from('notify_quiet_hours').upsert(row, { onConflict:'user_id' }));
    PX.say('r38QMsg', x.error ? 'Couldn’t save. Try again.' : row.is_on ? (row.from_hour === row.to_hour ? 'Pick two different hours.' : 'Saved. No phone alerts from ' + hourName(row.from_hour) + ' until ' + hourName(row.to_hour) + ' Cairo time.') : 'Quiet hours off.');
  });
  const R23 = window.R23Settings;
  if (R23 && R23.notify && !R23.notify.r38) {
    const orig = R23.notify;
    R23.notify = async function(B){ await orig(B); await quietDraw(B); };
    R23.notify.r38 = true;
    if (orig.r22) R23.notify.r22 = true;
  }
})();
