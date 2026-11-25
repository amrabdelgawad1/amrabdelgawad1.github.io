// Files that live in Cloudflare R2 (Nov 25, 2026): lesson videos and narration (course/content/<m>/videos|narration/...)
// and Voice Studio audio (voice/...). The amr-media Worker checks the signed-in person's Supabase token on every request.
//   const M = AmrMedia(db);
//   await M.url('course/content/m1/videos/1-1.mp4')    -> link for <video>/<audio>/<img>, or null if the file isn't there
//   await M.put(key, blob, type, { upsert:false })     -> { error }
//   await M.list('course/content/m1/narration/')        -> [{ name, size, uploaded }]
//   await M.copy(from, to), await M.remove(key)
(function(){
  const BASE = 'https://amr-media.amrabdelgawad423.workers.dev/';
  const enc = k => k.split('/').map(encodeURIComponent).join('/');
  window.AmrMedia = function(db){
    const token = async () => { try { const { data } = await db.auth.getSession(); return (data && data.session && data.session.access_token) || ''; } catch(e){ return ''; } };
    const auth = async () => ({ Authorization:'Bearer ' + await token() });
    return {
      base:BASE,
      inR2:key => /^course\/content\/m\d+\/(videos|narration)\//.test(key) || /^voice\//.test(key),
      async url(key, check = true){
        const t = await token(); if (!t) return null;
        const u = BASE + enc(key) + '?t=' + encodeURIComponent(t);
        if (!check) return u;
        try { const r = await fetch(BASE + enc(key), { method:'HEAD', headers:{ Authorization:'Bearer ' + t } }); return r.ok ? u : null; } catch(e){ return null; }
      },
      async put(key, body, type, opt = {}){
        try {
          const h = { ...(await auth()), 'Content-Type':type || (body && body.type) || 'application/octet-stream' };
          if (opt.upsert === false) h['x-upsert'] = 'false';
          const r = await fetch(BASE + enc(key), { method:'PUT', headers:h, body });
          return r.ok ? { error:null } : { error:{ message:await r.text() || ('Upload failed (' + r.status + ')') } };
        } catch(e){ return { error:{ message:String(e.message || e) } }; }
      },
      async list(prefix){
        try { const r = await fetch(BASE + '?list=' + encodeURIComponent(prefix), { headers:await auth() }); return r.ok ? await r.json() : []; } catch(e){ return []; }
      },
      async copy(from, to){
        try {
          const g = await fetch(BASE + enc(from), { headers:await auth() });
          if (!g.ok) return { error:{ message:'Not found' } };
          return this.put(to, await g.blob(), g.headers.get('Content-Type'));
        } catch(e){ return { error:{ message:String(e.message || e) } }; }
      },
      async remove(key){
        try { const r = await fetch(BASE + enc(key), { method:'DELETE', headers:await auth() }); return r.ok ? { error:null } : { error:{ message:'Delete failed' } }; } catch(e){ return { error:{ message:String(e.message || e) } }; }
      },
    };
  };
})();
