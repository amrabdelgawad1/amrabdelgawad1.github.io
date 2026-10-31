// Round 7 checks for the new Deal CRM file (the file itself is private: it is NOT in this repo).
//   python3 -m http.server 8702 &   (repo root)   then
//   node tools/portal-dev/crm-r7.js http://localhost:8702 /path/to/crm.html [screens folder]
// The CRM runs against a small in-memory database (kept here in Node, so it survives page reloads) that follows the
// round 7 rules: own rows by user and tool, deal_team_get, deal_team_rows, deal_rekey (no mix, no stale rows), and
// the save guard on the team key. Everything is encrypted for real (PBKDF2 310000 + AES-GCM), like the live CRM.
// Checks: Amr sets the team passphrase from his old one, a rep moves onto it, a new rep joins with it, the team view
// (Everyone / Only me / Pick people, view-only drawer), Amr changes it again, a change that races a save is refused
// with nothing saved, a stale tab can't write a mix, the key and passphrase are never stored, and the layout at 390
// and 1440 (no overflow, 44px targets, no em dashes, no console errors), including the locked page at both widths.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { webcrypto:wc } = require('crypto');
const [BASE, CRM, OUT] = process.argv.slice(2);
if (!BASE || !CRM) { console.error('usage: node crm-r7.js <base url> <crm.html> [screens folder]'); process.exit(2); }
const HTML = fs.readFileSync(CRM, 'utf8');

// ---------- real encryption, same as the CRM ----------
const ITER = 310000, b64 = u => Buffer.from(u).toString('base64'), unb64 = s => new Uint8Array(Buffer.from(s, 'base64'));
async function key(pass, salt){
  const k = await wc.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return wc.subtle.deriveKey({ name:'PBKDF2', salt:unb64(salt), iterations:ITER, hash:'SHA-256' }, k, { name:'AES-GCM', length:256 }, false, ['encrypt', 'decrypt']);
}
async function enc(obj, pass, salt){
  const iv = wc.getRandomValues(new Uint8Array(12));
  const ct = await wc.subtle.encrypt({ name:'AES-GCM', iv }, await key(pass, salt), new TextEncoder().encode(JSON.stringify(obj)));
  return { v:2, kdf:'PBKDF2-SHA256-' + ITER, salt, iv:b64(iv), ct:b64(new Uint8Array(ct)) };
}
async function dec(blob, pass){
  const pt = await wc.subtle.decrypt({ name:'AES-GCM', iv:unb64(blob.iv) }, await key(pass, blob.salt), unb64(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
const salt = () => b64(wc.getRandomValues(new Uint8Array(16)));
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const deal = (id, name, loc, stage, followUp, notes) => ({ id, kind:/acre/.test(name) ? 'land' : 'house', mode:'real', stage, created:day(-9), updated:Date.now(), name, loc, notes:notes || '',
  contact:{ name:'Seller ' + id, phone:'555-0100', email:'' }, followUp:followUp || '', calc:null, outcome:null, history:[{ d:day(-9), t:'Stage: New lead' }] });
const ws = deals => ({ v:2, deals, buyers:[], settings:{ weeklyGoal:10, me:{ name:'', phone:'', email:'', company:'' } } });

// ---------- the in-memory database ----------
const OWNER = 'o-amr', R1 = 'u-rep1', R2 = 'u-rep2', MG = 'u-mgr';
const PEOPLE = { [OWNER]:{ name:'Amr', role:'owner', active:true }, [R1]:{ name:'Rep 1', role:'agent', active:true }, [R2]:{ name:'Rep 2', role:'agent', active:true }, [MG]:{ name:'Maya M.', role:'manager', active:true } };
const DB = { logs:[], fus:[], buyers:[], deals:[], team:null, raceOnce:false };
const err = m => ({ data:null, error:{ message:m } });
function handle(me, aal, op){
  const P = PEOPLE[me];
  if (op.kind === 'aal') return { data:{ currentLevel:aal, nextLevel:aal } };
  if (op.kind === 'from' && (op.table === 'buyers' || op.table === 'deals')) {
    const TB = op.table, what = TB === 'deals' ? 'deal' : 'buyer';
    // Phase 2 rules: Amr and managers with the code see everyone's; others their own. Writes: own rows (Amr any), team key only.
    const seeAll = P.role === 'owner' || (P.role === 'manager' && aal === 'aal2'), f = Object.fromEntries(op.filters);
    const mine = r => r.owner === me || P.role === 'owner';
    const match = r => Object.entries(f).every(([k, v]) => r[k] === v);
    if (op.op === 'select') return { data:DB[TB].filter(r => (seeAll || r.owner === me) && match(r)).map(r => JSON.parse(JSON.stringify(r))) };
    if (op.op === 'delete') { DB[TB] = DB[TB].filter(r => !(mine(r) && match(r))); return { data:null }; }
    if (op.op === 'upsert') {
      if (!DB.team) return err('Set the team passphrase in the Deal CRM first');
      const vals = [].concat(op.value);
      if (vals.some(v => !v.enc || v.enc.salt !== DB.team.salt)) return err('This ' + what + ' isn\'t encrypted with the team passphrase. Lock the CRM and open it again.');
      if (vals.some(v => { const r = DB[TB].find(x => x.id === v.id); return r && !mine(r); })) return err('new row violates row-level security policy');
      for (const v of vals) {
        const i = DB[TB].findIndex(r => r.id === v.id);
        if (i >= 0) DB[TB][i] = Object.assign({}, DB[TB][i], v); else DB[TB].push(Object.assign({ owner:me }, v));
      }
      return { data:null };
    }
  }
  if (op.kind === 'from') {
    const T = op.table === 'deal_logs' ? 'logs' : 'fus', f = Object.fromEntries(op.filters);
    if (op.op === 'select') { const rows = DB[T].filter(r => r.user_id === me && Object.entries(f).every(([k, v]) => r[k] === v)); return { data:op.single ? (rows[0] || null) : rows }; }
    if (op.op === 'delete') { DB[T] = DB[T].filter(r => !(r.user_id === me && Object.entries(f).every(([k, v]) => r[k] === v))); return { data:null }; }
    if (op.op === 'insert') { [].concat(op.value).forEach(v => DB[T].push(Object.assign({ user_id:me }, v))); return { data:null }; }
    if (op.op === 'upsert') {
      const v = Object.assign({ user_id:me }, op.value);
      if (DB.team && /^workspace/.test(v.tool) && v.blob.salt !== DB.team.salt) return err('This workspace is on an old passphrase. Lock the CRM and open it again with the team passphrase.');
      const i = DB.logs.findIndex(r => r.user_id === v.user_id && r.tool === v.tool);
      if (i >= 0) DB.logs[i] = v; else DB.logs.push(v);
      return { data:null };
    }
  }
  if (op.kind === 'rpc') {
    const a = op.args || {}, owner = P.role === 'owner';
    const team = owner || (P.role === 'manager' && aal === 'aal2');
    const person = r => (r.tool.match(/^[a-z]+:(.+)$/) || [])[1] || r.user_id;
    switch (op.name) {
      case 'is_tracker_admin': return { data:owner };
      case 'deal_team_get': return { data:DB.team ? { salt:DB.team.salt, check:DB.team.check } : null };
      case 'deal_team_rows': return { data:DB.logs.filter(r => /^workspace/.test(r.tool) && (a.p_everyone && team ? true : r.user_id === me)).map(r => ({
        holder:r.user_id, person:person(r), name:(PEOPLE[person(r)] || {}).name || 'Someone', active:(PEOPLE[person(r)] || {}).active !== false, tool:r.tool, blob:r.blob, updated_at:r.updated_at })) };
      case 'deal_team_start':
        if (!owner) return err('Not allowed: only Amr sets the team passphrase');
        if (DB.team) return err('deal_team: already set.');
        DB.team = { salt:a.p_salt, check:a.p_check }; return { data:null };
      case 'buyer_matches': {
        const seeAll = owner || (P.role === 'manager' && aal === 'aal2'), c = String(a.p_county || '').toLowerCase().replace(/\s+(county|parish)$/, '').trim();
        return { data:DB.buyers.filter(b => (seeAll || b.owner === me) && b.active !== false && (!b.kinds.length || b.kinds.includes(a.p_kind)) &&
          (a.p_price == null || ((b.price_min == null || a.p_price >= b.price_min) && (b.price_max == null || a.p_price <= b.price_max))) &&
          ((!b.counties.length && !b.states.length) || b.counties.includes(c) || b.states.includes(a.p_state)))
          .map(b => Object.assign({}, b, { fit:b.counties.includes(c) ? 'county' : b.states.includes(a.p_state) ? 'state' : 'anywhere' })) };
      }
      case 'deal_rekey': {
        const old = DB.team && DB.team.salt;
        const bcopy = JSON.parse(JSON.stringify(DB.buyers)), dcopy = JSON.parse(JSON.stringify(DB.deals));
        const undo = () => { DB.logs = copy; DB.buyers = bcopy; DB.deals = dcopy; };
        if (owner) { if (!a.p_check || a.p_check.salt !== a.p_salt) return err('rekey: the team check must use the new salt'); }
        else { if (a.p_check) return err('Not allowed: only Amr sets the team passphrase'); if (!DB.team || a.p_salt !== DB.team.salt) return err('rekey: use the team passphrase'); }
        const copy = JSON.parse(JSON.stringify(DB.logs));
        if (DB.raceOnce) { DB.raceOnce = false; const r = DB.logs.find(x => x.user_id === R2); if (r) r.blob = Object.assign({}, r.blob, { iv:'changed-meanwhile' }); }
        const inScope = r => /^workspace/.test(r.tool) && (owner ? (r.user_id === me && r.tool === 'workspace') || r.blob.salt === old : r.user_id === me);
        for (const x of a.p_rows) {
          if (x.blob.salt !== a.p_salt) { DB.logs = copy; DB.buyers = bcopy; return err('rekey: every row must be encrypted with the new key'); }
          if (x.buyer) {
            if (!owner) { DB.logs = copy; DB.buyers = bcopy; return err('Not allowed: only Amr re-encrypts buyers'); }
            const b = DB.buyers.find(y => y.id === x.buyer);
            if (!b || b.enc.iv !== x.old_iv) { DB.logs = copy; DB.buyers = bcopy; return err('rekey: a buyer changed while you were working. Nothing was saved. Reload and try again.'); }
            b.enc = x.blob; continue;
          }
          if (x.deal) {
            if (!owner) { undo(); return err('Not allowed: only Amr re-encrypts deals'); }
            const d = DB.deals.find(y => y.id === x.deal);
            if (!d || d.enc.iv !== x.old_iv) { undo(); return err('rekey: a deal changed while you were working. Nothing was saved. Reload and try again.'); }
            d.enc = x.blob; continue;
          }
          const r = DB.logs.find(y => y.user_id === x.holder && y.tool === x.tool);
          if (!r || !inScope(r)) { DB.logs = copy; return err('Not allowed: that workspace isn\'t yours to change'); }
          if (r.blob.iv !== x.old_iv) { DB.logs = copy; return err('rekey: a row changed while you were working (' + x.tool + '). Nothing was saved. Reload and try again.'); }
          r.blob = x.blob;
        }
        const left = DB.logs.filter(r => r.blob.salt !== a.p_salt && (owner ? (r.user_id === me && r.tool === 'workspace') || (old && copy.find(c => c.user_id === r.user_id && c.tool === r.tool).blob.salt === old) : r.user_id === me) && /^workspace/.test(r.tool));
        if (owner && DB.buyers.some(b => b.enc.salt !== a.p_salt)) { DB.logs = copy; DB.buyers = bcopy; return err('rekey: 1 buyer(s) would be left on the old passphrase. Nothing was saved.'); }
        if (owner && DB.deals.some(d => d.enc.salt !== a.p_salt)) { undo(); return err('rekey: 1 deal(s) would be left on the old passphrase. Nothing was saved.'); }
        if (left.length) { DB.logs = copy; DB.buyers = bcopy; DB.deals = dcopy; return err('rekey: ' + left.length + ' workspace(s) would be left on the old passphrase. Nothing was saved.'); }
        if (owner) DB.team = { salt:a.p_salt, check:a.p_check };
        return { data:a.p_rows.length };
      }
    }
    return err('no such function ' + op.name);
  }
  return err('unknown');
}

const CLIENT = `(() => {
  const I = window.__I;
  const call = op => window.__fake(JSON.stringify(op)).then(r => JSON.parse(r));
  function q(table){
    const st = { table, filters:[], single:false, op:'select' };
    const o = { select(){ return o; }, order(){ return o; }, eq(k, v){ st.filters.push([k, v]); return o; }, maybeSingle(){ st.single = true; return o; },
      upsert(v){ st.op = 'upsert'; st.value = v; return o; }, insert(v){ st.op = 'insert'; st.value = v; return o; }, delete(){ st.op = 'delete'; return o; },
      then(a, b){ return call(Object.assign({ kind:'from' }, st)).then(a, b); } };
    return o;
  }
  const db = { from:q, rpc:(name, args) => call({ kind:'rpc', name, args }),
    auth:{ getSession:async () => ({ data:{ session:{ user:{ id:I.userId } } } }), signOut:async () => ({}), mfa:{ getAuthenticatorAssuranceLevel:() => call({ kind:'aal' }) } } };
  window.DealGate = { db, name:I.name, userId:I.userId };
  window.PORTAL_TEST = { role:I.role, name:I.name, keys:['course','deals','learn'] };
})();`;

const AMR_OLD = 'amr old passphrase one', REP1_OWN = 'rep one own passphrase', TEAM1 = 'team passphrase number one', TEAM2 = 'team passphrase number two';
let bad = 0; const ok = (c, label) => { if (c) console.log('  ok   ' + label); else { bad++; console.log('  FAIL ' + label); } };

(async () => {
  // Amr: 4 deals on his own passphrase; Rep 1: 2 deals on theirs; no team key yet
  const sA = salt(), sR = salt();
  DB.logs.push({ user_id:OWNER, tool:'workspace', blob:await enc(ws([deal('a1', '20 acres', 'Ross County, OH', 'offer', day(0), 'Call back about counteroffer'),
    deal('a2', '5 acres', 'Athens County, OH', 'contract', day(4), 'Title search ordered'), deal('a3', '12 acres', 'Pike County, OH', 'lead', day(2), 'First call'),
    deal('a4', '2-bed house', 'Dayton, OH', 'closed', '', 'Closed')]), AMR_OLD, sA), updated_at:'' });
  DB.logs.push({ user_id:OWNER, tool:'land', blob:{ v:2, salt:salt(), iv:'calc', ct:'calculator row, never touched' }, updated_at:'' });
  DB.logs.push({ user_id:R1, tool:'workspace', blob:await enc(ws([deal('r1', '3-bed house', 'Columbus, OH', 'talking', day(0), 'Send repair estimate'),
    deal('r2', '8 acres', 'Vinton County, OH', 'lead', day(6), '')]), REP1_OWN, sR), updated_at:'' });

  const browser = await chromium.launch();
  async function open(user, aal, W){
    const ctx = await browser.newContext({ viewport:{ width:W || 1440, height:(W || 1440) < 768 ? 844 : 900 }, serviceWorkers:'block', isMobile:(W || 1440) < 768, hasTouch:(W || 1440) < 768 });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const P = PEOPLE[user];
    await ctx.addInitScript(i => { window.__I = i; }, { userId:user, name:P.name, role:P.role });
    await ctx.exposeFunction('__fake', s => JSON.stringify(handle(user, aal || 'aal2', JSON.parse(s))));
    await ctx.route('**/app/deals/crm-test.html', r => r.fulfill({ contentType:'text/html', body:HTML.replace('<head>', '<head><script>' + CLIENT + '</script>') }));
    const p = await ctx.newPage(); p.errs = [];
    p.on('pageerror', e => p.errs.push('PAGE ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_FAILED|net::/.test(m.text())) p.errs.push('CONSOLE ' + m.text()); });
    await p.goto(BASE + '/app/deals/crm-test.html#pipeline');
    try { await p.waitForSelector('#gate.vault, #app:not([hidden])', { timeout:20000 }); }
    catch (e) { console.log(p.errs.join('\n')); throw e; }
    p.ctx = ctx; return p;
  }
  const unlock = async (p, pass) => { await p.fill('#vP', pass); await p.click('#vOpen'); await p.waitForSelector('#app:not([hidden]), #mvP, #vErr:not(:empty)', { timeout:30000 }); await p.waitForTimeout(400); };
  const text = p => p.evaluate(() => document.body.innerText);
  const shot = async (p, name) => { if (OUT) { fs.mkdirSync(OUT, { recursive:true }); await p.screenshot({ path:path.join(OUT, name + '.png'), fullPage:true }); } };
  const stored = p => p.evaluate(() => JSON.stringify({ l:Object.assign({}, localStorage), s:Object.assign({}, sessionStorage) }));
  // While locked, the sidebar is hidden and the lock card must get the whole page: full width, centered, not squeezed
  // into the empty sidebar column (bug fixed live on 2026-10-30: .crm-side[hidden]+.crm-main{grid-column:1/-1})
  async function lockedLayout(p, label){
    const r = await p.evaluate(() => {
      const W = document.documentElement.clientWidth, g = document.getElementById('gate').getBoundingClientRect(), m = document.querySelector('.crm-main').getBoundingClientRect();
      return { W, main:Math.round(m.width), gate:Math.round(g.width), mid:Math.round((g.left + g.right) / 2), side:document.getElementById('crmSide').hidden };
    });
    ok(r.side, label + ': the sidebar is hidden while locked');
    ok(r.main >= r.W - 1, label + ': the page area uses the full width (' + r.main + ' of ' + r.W + 'px)');
    ok(r.gate >= Math.min(620, r.W - 28) - 1, label + ': the lock card is full size (' + r.gate + 'px)');
    ok(Math.abs(r.mid - r.W / 2) <= 2, label + ': the lock card is centered');
    await shot(p, 'crm-locked-' + label.split(' ').pop());
    await layout(p, label);
  }
  async function layout(p, label){
    const r = await p.evaluate(() => {
      const W = document.documentElement.clientWidth, over = [], small = [];
      document.querySelectorAll('body *').forEach(e => { const b = e.getBoundingClientRect(); if (b.width && b.right > W + 1 && !e.closest('.p-tablewrap,.tablebox,.board,.crm-groups,[hidden]')) over.push(e.tagName + '.' + e.className); });
      document.querySelectorAll('#app button, #app a.btn, .crm-side button, .crm-side a, .p-top button, .p-top select, .p-top input, .vault button, .vault input').forEach(e => {
        const b = e.getBoundingClientRect(); if (b.width && b.height && b.height < 43.5 && !e.closest('[hidden]')) small.push(e.tagName + '#' + e.id + '.' + e.className + ' ' + Math.round(b.height)); });
      return { over:over.slice(0, 5), small:small.slice(0, 8), dash:/\u2014/.test(document.body.innerText) };
    });
    ok(!r.over.length, label + ': nothing wider than the screen ' + (r.over.join(' ') || ''));
    ok(!r.small.length, label + ': touch targets 44px ' + (r.small.join(' ') || ''));
    ok(!r.dash, label + ': no em dashes');
  }

  console.log('== Amr opens his CRM (his own passphrase, no team key yet)');
  let p = await open(OWNER);
  ok(/Your Deal CRM is locked/.test(await text(p)), 'locked gate first');
  await lockedLayout(p, 'locked 1440');
  await unlock(p, 'wrong passphrase here');
  ok(/doesn’t open/.test(await p.textContent('#vErr')), 'a wrong passphrase is refused');
  await unlock(p, AMR_OLD);
  ok(await p.isVisible('#app'), 'his passphrase opens it');
  await p.waitForSelector('#crmShowL:not([hidden])', { timeout:10000 });
  let t = await text(p);
  ok(/All open deals/.test(t) && /3 open deals · 1 follow-up due today or late/.test(t), 'hero: All open deals, 3 open, 1 due');
  ok(/20 acres/.test(t) && /Ross County, OH/.test(t) && /Offer sent/.test(t) && /Call back about counteroffer/.test(t) && /Today/.test(t), 'table: property, stage, next step, due Today');
  ok(!/2-bed house/.test(t), 'closed deals are not in All open deals');
  ok(/Rep 1’s deals use their own passphrase/.test(t), 'Rep 1 is on a personal passphrase: a note, not a guess');
  const st = JSON.parse(await stored(p));
  ok(!Object.keys(st.s).some(k => /^dealKey/.test(k)) && !/amr old/.test(JSON.stringify(st)) && !Object.keys(st.l).length, 'no key or passphrase in localStorage or sessionStorage');
  const dc = JSON.parse(st.s.dealCounts || '{}');
  ok(dc.open === 3 && dc.due === 1 && dc.contract === 1, 'counts for the portal homes: 3 open, 1 due, 1 under contract (counts only)');
  ok(!/20 acres|Ross/.test(st.s.dealCounts || ''), 'counts carry no names or places');
  await p.click('[data-stage-go="contract"]');
  t = await text(p);
  ok(/Under contract/.test(await p.textContent('#hTitle')) && /5 acres/.test(t) && !/20 acres/.test(await p.textContent('#dealTable')), 'sidebar: Under contract filter');
  await p.click('[data-stage-go="open"]');
  await p.fill('#crmQ', 'pike'); await p.waitForTimeout(200);
  ok(/12 acres/.test(await p.textContent('#dealTable')) && !/20 acres/.test(await p.textContent('#dealTable')), 'search finds by place');
  await p.fill('#crmQ', ''); await p.waitForTimeout(200);
  await shot(p, 'crm-owner-1440');
  await layout(p, 'owner 1440');

  console.log('== Amr sets the team passphrase (Settings)');
  await p.click('[data-go="settings"]');
  ok(/Set the team passphrase/.test(await p.textContent('#tpTitle')), 'Settings offers Set the team passphrase');
  await p.fill('#tpOld', 'not my passphrase'); await p.fill('#tpNew', TEAM1); await p.fill('#tpNew2', TEAM1); await p.click('#tpGo');
  await p.waitForFunction(() => document.getElementById('tpErr').textContent.length > 0, null, { timeout:30000 });
  ok(/doesn’t open your deals. Nothing was changed/.test(await p.textContent('#tpErr')), 'the wrong current passphrase: refused, nothing changed');
  ok(DB.team === null && DB.logs.find(r => r.user_id === OWNER && r.tool === 'workspace').blob.salt === sA, 'database unchanged');
  await p.fill('#tpOld', AMR_OLD); await p.fill('#tpNew', TEAM1); await p.fill('#tpNew2', 'typo ' + TEAM1); await p.click('#tpGo');
  ok(/don’t match/.test(await p.textContent('#tpErr')), 'the two new ones must match');
  await p.fill('#tpNew2', TEAM1); await p.click('#tpGo');
  await p.waitForSelector('#tpDone:not([hidden]), #tpErr:not(:empty)', { timeout:60000 });
  ok(/Done. 1 workspace now uses the new passphrase/.test(await p.textContent('#tpDone')), 'done: 1 workspace moved');
  const own = DB.logs.find(r => r.user_id === OWNER && r.tool === 'workspace');
  ok(DB.team && own.blob.salt === DB.team.salt && (await dec(own.blob, TEAM1)).deals.length === 4, 'his workspace is on the team key and opens with the new passphrase (all 4 deals)');
  let oldOpens = true; try { await dec(own.blob, AMR_OLD); } catch (e) { oldOpens = false; }
  ok(!oldOpens, 'the old passphrase no longer opens it');
  ok(DB.logs.find(r => r.tool === 'land').blob.ct === 'calculator row, never touched', 'the calculators’ row is untouched');
  ok(DB.logs.find(r => r.user_id === R1).blob.salt === sR, 'Rep 1’s personal workspace is left for Rep 1 to move');
  ok(!/team passphrase number one/.test(await stored(p)), 'the new passphrase is not stored either');
  await shot(p, 'crm-owner-passphrase-1440');
  ok(!p.errs.length, 'no console errors (Amr) ' + p.errs.join(' | '));
  await p.ctx.close();

  console.log('== Rep 1 moves onto the team passphrase');
  p = await open(R1, 'aal1', 390);
  await lockedLayout(p, 'locked 390');
  await unlock(p, REP1_OWN);
  ok(await p.isVisible('#mvP'), 'after unlocking with their own passphrase, the CRM asks them to move');
  await shot(p, 'crm-rep-move-390');
  await layout(p, 'move gate 390');
  await p.fill('#mvP', 'not the team one'); await p.click('#mvGo');
  await p.waitForFunction(() => document.getElementById('mvErr').textContent.length > 0, null, { timeout:30000 });
  ok(/isn’t the team passphrase/.test(await p.textContent('#mvErr')), 'a wrong team passphrase is caught by the team check');
  await p.fill('#mvP', TEAM1); await p.click('#mvGo');
  await p.waitForSelector('#mvReopen', { timeout:60000 });
  const r1 = DB.logs.find(r => r.user_id === R1);
  ok(r1.blob.salt === DB.team.salt && (await dec(r1.blob, TEAM1)).deals.length === 2, 'Rep 1’s workspace is on the team key, both deals intact');
  await p.click('#mvReopen'); await p.waitForSelector('#gate.vault');
  await unlock(p, TEAM1);
  t = await text(p);
  ok(/3-bed house/.test(t) && await p.isHidden('#crmShowL'), 'Rep 1 opens with the team passphrase; no Showing choice for a rep');
  await shot(p, 'crm-rep-390');
  await layout(p, 'rep 390');
  ok(!p.errs.length, 'no console errors (Rep 1) ' + p.errs.join(' | '));
  await p.ctx.close();

  console.log('== Rep 2 joins with the team passphrase');
  p = await open(R2, 'aal1');
  t = await text(p);
  ok(/Enter the team passphrase Amr gave you/.test(t) && !/including Amr/.test(t), 'new workspace: team wording');
  await p.fill('#vP1', 'some other passphrase'); await p.fill('#vP2', 'some other passphrase'); await p.click('#vSet');
  await p.waitForFunction(() => /team passphrase/.test(document.getElementById('vErr').textContent), null, { timeout:30000 });
  ok(/isn’t the team passphrase/.test(await p.textContent('#vErr')) && !DB.logs.some(r => r.user_id === R2), 'a wrong one creates nothing');
  await p.fill('#vP1', TEAM1); await p.fill('#vP2', TEAM1); await p.click('#vSet');
  await p.waitForSelector('#app:not([hidden])', { timeout:30000 });
  await p.click('#qaddBtn'); await p.fill('#qName', '2-bed house'); await p.fill('#qLoc', 'Dayton, OH'); await p.click('#qSave');
  await p.waitForTimeout(800);
  const r2 = DB.logs.find(r => r.user_id === R2);
  ok(r2 && r2.blob.salt === DB.team.salt && (await dec(r2.blob, TEAM1)).deals[0].name === '2-bed house', 'Rep 2’s first deal is saved on the team key');
  console.log('== Phase 2: the deals split, each real deal gets a row (working fields readable, the rest encrypted)');
  await p.waitForTimeout(600);
  let dr = DB.deals.find(d => d.owner === R2);
  const r2d = (await dec(DB.logs.find(r => r.user_id === R2).blob, TEAM1)).deals[0];
  ok(dr && dr.id === r2d.id && dr.kind === r2d.kind && dr.state === 'OH' && dr.county === 'dayton' && dr.stage === 'lead', 'Rep 2’s deal row: same id and kind, Dayton, OH, new lead');
  ok(dr && dr.enc.salt === DB.team.salt, 'the row is on the team key');
  ok(dr && !/2-bed house|555-|Seller/.test(JSON.stringify(Object.assign({}, dr, { enc:null }))) && (await dec(dr.enc, TEAM1)).name === '2-bed house', 'the deal’s name and contact are only inside the encrypted part');

  console.log('== Phase 2: Rep 2 adds cash buyers; they reach the database encrypted');
  await p.click('[data-go="buyers"]');
  const addBuyer = async (name, phone, areas, max, kinds) => {
    await p.fill('#bName', name); await p.fill('#bPhone', phone); await p.fill('#bAreas', areas); await p.fill('#bMax', String(max || '')); await p.selectOption('#bKinds', kinds);
    await p.click('#bSave'); await p.waitForTimeout(900);
  };
  await addBuyer('Cash Carl', '555-0111', 'Ross County, Montgomery', 300000, 'land,house');
  await addBuyer('Gone Gary', '555-0122', 'TX', 0, 'land');
  let bc = DB.buyers.find(b => b.owner === R2 && b.price_max === 300000);
  ok(bc && JSON.stringify(bc.counties) === '["ross","montgomery"]' && !bc.states.length && bc.kinds.join() === 'land,house', 'the buy box: counties ross and montgomery, land and houses, up to $300,000');
  ok(bc && bc.enc.salt === DB.team.salt && (await dec(bc.enc, TEAM1)).name === 'Cash Carl' && !/Cash Carl|555-0111/.test(JSON.stringify(Object.assign({}, bc, { enc:null }))), 'name and phone are only inside the encrypted part');
  ok(JSON.stringify(DB.buyers.find(b => b.owner === R2 && b.price_max == null).states) === '["TX"]', 'a state-only buyer: TX');
  await p.click('#bList [data-bdel]'); await p.click('#bList [data-bdel]'); await p.waitForTimeout(900);
  ok(DB.buyers.filter(b => b.owner === R2).length === 1, 'removing a buyer removes it from the database');
  ok(await p.isHidden('#crmTeamBuyers') || !(await p.$('#crmTeamBuyers')), 'a rep has no team buyers list');
  await layout(p, 'rep buyers 1440');
  ok(!p.errs.length, 'no console errors (Rep 2) ' + p.errs.join(' | '));
  await p.ctx.close();

  console.log('== Amr sees the team: Everyone, Only me, Pick people');
  p = await open(OWNER, 'aal2', 1440);
  await unlock(p, TEAM1);
  await p.waitForFunction(() => /3-bed house/.test(document.getElementById('dealTable').textContent), null, { timeout:15000 });
  t = await p.textContent('#dealTable');
  ok(/20 acres/.test(t) && /3-bed house/.test(t) && /2-bed house/.test(t) && /Rep 1/.test(t) && /Rep 2/.test(t), 'Everyone: Amr’s, Rep 1’s and Rep 2’s open deals with owners');
  ok(/6 open deals · 2 follow-ups due/.test(await p.textContent('#hSub')), 'hero counts the team');
  ok(JSON.parse(await p.evaluate(() => sessionStorage.getItem('dealCounts'))).open === 6, 'portal counts include the team');
  await shot(p, 'crm-owner-everyone-1440');
  await p.click('tr[data-team] .crm-prop');
  t = await p.textContent('#drawer');
  ok(/View only/.test(t) && /Rep 1|Rep 2/.test(t) && !(await p.$('#dSave')), 'a teammate’s deal opens view only');
  await shot(p, 'crm-owner-teamdeal-1440');
  await p.click('#dX');
  await p.selectOption('#crmShow', 'me');
  t = await p.textContent('#dealTable');
  ok(/20 acres/.test(t) && !/Rep 1|Rep 2/.test(t), 'Only me');
  await p.selectOption('#crmShow', 'pick');
  await p.uncheck('#crmPick input[data-p="' + R1 + '"]');
  t = await p.textContent('#dealTable');
  ok(/2-bed house/.test(t) && !/3-bed house/.test(t) && /20 acres/.test(t), 'Pick people: Rep 1 unticked');
  await p.selectOption('#crmShow', 'all');
  await p.click('tr[data-open] .crm-prop');
  ok(await p.$('#dSave') !== null, 'his own deal opens for editing');
  await p.click('#dX');

  console.log('== Phase 2: Amr sees the team’s buyers and who fits a deal');
  await p.click('[data-go="buyers"]');
  await p.waitForFunction(() => /Cash Carl/.test((document.getElementById('crmTeamBuyers') || {}).textContent || ''), null, { timeout:15000 });
  t = await p.textContent('#crmTeamBuyers');
  ok(/Cash Carl/.test(t) && /Rep 2/.test(t) && /555-0111/.test(t) && /Ross, Montgomery/.test(t) && !/Gone Gary/.test(t), 'the team’s buyers: Cash Carl, added by Rep 2, decrypted');
  await p.fill('#bName', 'Hank Houses'); await p.fill('#bAreas', 'Ohio'); await p.selectOption('#bKinds', 'house'); await p.click('#bSave'); await p.waitForTimeout(900);
  ok(DB.buyers.some(b => b.owner === OWNER && b.states.join() === 'OH' && b.kinds.join() === 'house'), 'Amr’s own buyer reaches the database (Ohio, houses)');
  ok(/1 buyer on your list/.test(await p.textContent('#hSub')), 'the header count updates after saving a buyer');
  await shot(p, 'crm-owner-buyers-1440');
  await layout(p, 'owner buyers 1440');
  await p.click('[data-stage-go="open"]');
  await p.click('tr[data-open="a1"] .crm-prop');
  await p.waitForFunction(() => /Cash Carl|No buyers/.test((document.getElementById('crmFits') || {}).textContent || ''), null, { timeout:15000 });
  t = await p.textContent('#crmFits');
  ok(/Cash Carl/.test(t) && /Buys in this county/.test(t) && !/Hank Houses/.test(t), 'land in Ross County, OH: Cash Carl fits by county; the house buyer does not');
  await shot(p, 'crm-owner-fits-1440');
  await p.click('#dX');
  await p.click('tr[data-team] .crm-prop');
  await p.waitForFunction(() => /Buyers who fit/.test((document.getElementById('crmFits') || {}).textContent || '') && !/Looking/.test(document.getElementById('crmFits').textContent), null, { timeout:15000 });
  ok(true, 'a teammate’s deal shows buyers who fit too');
  await p.click('#dX');

  console.log('== Amr changes the team passphrase: a race is refused, then everyone moves together');
  await p.click('[data-go="settings"]');
  ok(/Change passphrase/.test(await p.textContent('#tpGo')), 'Settings: Change passphrase');
  const before = JSON.stringify(DB.logs.map(r => r.blob.iv));
  DB.raceOnce = true;
  await p.fill('#tpOld', TEAM1); await p.fill('#tpNew', TEAM2); await p.fill('#tpNew2', TEAM2); await p.click('#tpGo');
  await p.waitForSelector('#tpDone:not([hidden]), #tpErr:not(:empty)', { timeout:90000 });
  ok(/changed while this was running.*Nothing was saved/.test(await p.textContent('#tpErr')), 'a save during the change: refused');
  ok(DB.logs.filter(r => /^workspace/.test(r.tool)).every(r => r.blob.salt === DB.team.salt) && DB.logs.filter(r => r.blob.iv !== 'changed-meanwhile').every(r => before.includes(r.blob.iv)), 'nothing was saved: no mix');
  // (the simulated save was inside the refused call, so it was rolled back with it)
  const team1Salt = DB.team.salt;
  await p.click('#tpGo');
  await p.waitForFunction(() => !document.getElementById('tpDone').hidden || (document.getElementById('tpErr').textContent && !document.getElementById('tpGo').disabled), null, { timeout:90000 });
  if (await p.isHidden('#tpDone')) console.log('  (error shown: ' + await p.textContent('#tpErr') + ')');
  ok(/3 workspaces now use the new passphrase/.test(await p.textContent('#tpDone')), 'all 3 workspaces moved in one step');
  const all = DB.logs.filter(r => /^workspace/.test(r.tool));
  ok(DB.team.salt !== team1Salt && all.every(r => r.blob.salt === DB.team.salt), 'every workspace on the new key, none left behind');
  let opened = 0; for (const r of all) { try { await dec(r.blob, TEAM2); opened++; } catch (e) {} }
  ok(opened === 3, 'each opens with the new passphrase');
  let bOpen = 0; for (const b of DB.buyers) { try { if ((await dec(b.enc, TEAM2)).name) bOpen++; } catch (e) {} }
  ok(DB.buyers.length === 2 && DB.buyers.every(b => b.enc.salt === DB.team.salt) && bOpen === 2, 'both buyers moved to the new passphrase in the same step');
  let dOpen = 0; for (const d of DB.deals) { try { if ((await dec(d.enc, TEAM2)).name) dOpen++; } catch (e) {} }
  ok(DB.deals.length >= 3 && DB.deals.every(d => d.enc.salt === DB.team.salt) && dOpen === DB.deals.length, 'every deal row (' + DB.deals.length + ') moved to the new passphrase in the same step');
  ok(new Set(DB.deals.map(d => d.owner)).size === 3, 'deal rows from Amr, Rep 1 and Rep 2');
  await p.click('#tpReopen'); await p.waitForSelector('#gate.vault');
  await unlock(p, TEAM1);
  ok(/doesn’t open/.test(await p.textContent('#vErr')), 'the old team passphrase no longer opens Amr’s CRM');
  await unlock(p, TEAM2);
  ok(await p.isVisible('#app'), 'the new one does');
  ok(!p.errs.length, 'no console errors (Amr, team) ' + p.errs.join(' | '));
  await p.ctx.close();

  console.log('== A tab still on the old key can’t write a mix');
  const team2 = DB.team;
  DB.team = { salt:team1Salt, check:DB.team.check };   // pretend Rep 1 opened just before the change
  const r1Now = DB.logs.find(r => r.user_id === R1), r1Saved = r1Now.blob;
  r1Now.blob = await enc((await dec(r1Saved, TEAM2)), TEAM1, team1Salt);
  p = await open(R1, 'aal1', 1440);
  await unlock(p, TEAM1);
  DB.team.salt = salt();   // now Amr changes it
  await p.click('#qaddBtn'); await p.fill('#qName', 'Stale tab deal'); await p.click('#qSave');
  await p.waitForSelector('#crmNote:not([hidden])', { timeout:10000 });
  ok(/The team passphrase changed/.test(await p.textContent('#crmNote')) && DB.logs.find(r => r.user_id === R1).blob.salt === team1Salt, 'refused with a clear note; the row is unchanged');
  await p.ctx.close();
  DB.team = team2; r1Now.blob = r1Saved;

  console.log('== Before Amr sets a team passphrase, a new rep is told to wait');
  const keep = DB.team; DB.team = null;
  p = await open(MG, 'aal1', 390);
  ok(/isn’t ready yet/.test(await text(p)) && !(await p.$('#vSet')), 'no form: Amr hasn’t set it yet');
  await layout(p, 'not ready 390');
  await p.ctx.close();
  DB.team = keep;

  console.log('== A manager without the authenticator code');
  const mgSalt = DB.team.salt;
  DB.logs.push({ user_id:MG, tool:'workspace', blob:await enc(ws([deal('m1', '40 acres', 'Hocking County, OH', 'lead', day(1), 'First call')]), TEAM2, mgSalt), updated_at:'' });
  p = await open(MG, 'aal1', 1440);
  await unlock(p, TEAM2);
  await p.waitForSelector('#crmShowL:not([hidden])', { timeout:10000 });
  t = await text(p);
  ok(/sign in with your authenticator code/.test(t) && /40 acres/.test(t) && !/Rep 1/.test(await p.textContent('#dealTable')), 'only their own deals, and a note about the code');
  await p.ctx.close();
  p = await open(MG, 'aal2', 390);
  await unlock(p, TEAM2);
  await p.waitForFunction(() => /Rep 1/.test(document.getElementById('dealTable').textContent), null, { timeout:15000 });
  ok(true, 'with the code: the team’s deals');
  await shot(p, 'crm-manager-390');
  await layout(p, 'manager 390');
  await p.click('[data-go="buyers"]');
  await p.waitForFunction(() => /Cash Carl/.test((document.getElementById('crmTeamBuyers') || {}).textContent || ''), null, { timeout:15000 });
  ok(/Hank Houses/.test(await p.textContent('#crmTeamBuyers')), 'a manager with the code sees the team’s buyers (after the passphrase change)');
  await shot(p, 'crm-manager-buyers-390');
  await layout(p, 'manager buyers 390');
  await p.ctx.close();

  await browser.close();
  console.log(bad ? '== ' + bad + ' FAILED' : '== all CRM checks passed');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
