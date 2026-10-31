// Test stand-in for supabase-js (tools/portal-dev only, never on the site). Set these on window before the page runs:
//   SB_SESSION  { user:{ id, email } } or nothing for signed out
//   SB_AAL      'aal1' (default) or 'aal2'
//   SB_RPC      { function_name: data }   an unknown function answers { error:'no access' }
//   SB_FROM     { table: [rows] }         every table query returns these rows (filters are ignored)
//   SB_INVOKE   { function_name: data }   what an edge function (team-access) answers
// Calls are recorded in window.SB_CALLS so a test can check what the page asked for.
(function(){
  const calls = window.SB_CALLS = [];
  // Answers after a short wait, like the network: answering at once lets a page route before its later scripts have loaded
  const later = v => new Promise(r => setTimeout(() => r(v), 20));
  const res = (data, error) => later(error ? { data:null, error:{ message:error } } : { data, error:null, count:Array.isArray(data) ? data.length : null });
  function query(table){
    const rows = (window.SB_FROM || {})[table];
    let single = false;
    const q = {
      select(){ return q; }, eq(){ return q; }, neq(){ return q; }, not(){ return q; }, is(){ return q; }, in(){ return q; }, gte(){ return q; }, lte(){ return q; }, ilike(){ return q; },
      order(){ return q; }, limit(){ return q; }, range(){ return q; },
      maybeSingle(){ single = true; return q; }, single(){ single = true; return q; },
      insert(v){ calls.push(['insert', table, v]); return q; }, update(v){ calls.push(['update', table, v]); return q; },
      upsert(v){ calls.push(['upsert', table, v]); return q; }, delete(){ calls.push(['delete', table]); return q; },
      then(ok, bad){ const r = rows === undefined ? { data:single ? null : [], error:null, count:0 } : { data:single ? rows[0] || null : rows, error:null, count:rows.length }; return later(r).then(ok, bad); }
    };
    calls.push(['from', table]);
    return q;
  }
  window.supabase = { createClient: () => ({
    auth: {
      getSession: () => later({ data:{ session:window.SB_SESSION || null } }),
      getUser: async () => ({ data:{ user:(window.SB_SESSION || {}).user || null } }),
      onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data:{ currentLevel:window.SB_AAL || 'aal1', nextLevel:window.SB_AAL || 'aal1' } }),
        listFactors: async () => ({ data:{ totp:[] } })
      },
      signOut: async () => ({}), signInWithPassword: async () => ({ error:{ message:'Invalid login' } }), updateUser: async () => ({})
    },
    rpc: (name, args) => { calls.push(['rpc', name, args]); const r = window.SB_RPC || {}; return name in r ? res(r[name]) : res(null, 'course: no access'); },
    from: query,
    channel: () => { const c = { on: () => c, subscribe: () => c }; return c; }, removeChannel(){},
    functions: { invoke: async (n, o) => { calls.push(['invoke', n, o]); return later({ data:(window.SB_INVOKE || {})[n] || {}, error:null }); } },
    storage: { from: () => ({ download: async () => ({ error:{ message:'not found' } }), createSignedUrl: async () => ({ error:{} }),
      createSignedUrls: async () => ({ data:[] }), upload: async () => ({ error:null }), remove: async () => ({}) }) }
  }) };
})();
