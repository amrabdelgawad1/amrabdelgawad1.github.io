// Test stand-in for supabase-js: window.SB_SESSION decides signed in or out; every rpc says "no access".
window.supabase = { createClient: () => ({
  auth: {
    getSession: async () => ({ data:{ session: window.SB_SESSION || null } }),
    onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } }),
    mfa: { getAuthenticatorAssuranceLevel: async () => ({ data:{ currentLevel:'aal1', nextLevel:'aal1' } }), listFactors: async () => ({ data:{ totp:[] } }) },
    signOut: async () => ({}), signInWithPassword: async () => ({ error:{ message:'Invalid login' } })
  },
  rpc: async () => ({ data:null, error:{ message:'course: no access' } }),
  from: () => { const q = { select:() => q, eq:() => q, in:() => q, order:() => q, limit:() => q, maybeSingle: async () => ({ data:null }), then:(r) => r({ data:[] }) }; return q; },
  storage: { from: () => ({ download: async () => ({ error:{ message:'not found' } }), createSignedUrl: async () => ({ error:{} }) }) }
}) };
