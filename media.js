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
      // A link anyone can open for `days` days (Voice Studio Share)
      async share(key, days, dl){
        try {
          const r = await fetch(BASE + '?share=' + encodeURIComponent(key) + '&days=' + (days || 7) + (dl ? '&dl=' + encodeURIComponent(dl) : ''), { method:'POST', headers:await auth() });
          return r.ok ? (await r.json()).url : null;
        } catch(e){ return null; }
      },
      // Same calls as db.storage.from(bucket), for code written against Supabase storage (Voice Studio).
      // Paths are bucket-relative, as before; they map to <bucket>/<path> in R2.
      bucket(name){
        const M = this, k = p => name + '/' + String(p).replace(/^\/+/, '');
        const wrap = async fn => { try { return await fn(); } catch(e){ return { data:null, error:{ message:String(e.message || e) } }; } };
        return {
          createSignedUrl:(p, secs, opt) => wrap(async () => {
            const dl = opt && opt.download ? (opt.download === true ? String(p).split('/').pop() : opt.download) : '';
            const u = secs && secs > 24 * 3600 ? await M.share(k(p), Math.ceil(secs / 86400), dl) : await M.url(k(p), false);
            if (!u) return { data:null, error:{ message:'Not signed in' } };
            return { data:{ signedUrl:u + (dl && u.includes('?t=') ? '&dl=' + encodeURIComponent(dl) : '') }, error:null };
          }),
          upload:(p, body, opt) => wrap(async () => {
            const r = await M.put(k(p), body, (opt && opt.contentType) || (body && body.type), { upsert:!!(opt && opt.upsert) });
            return r.error ? { data:null, error:r.error } : { data:{ path:p }, error:null };
          }),
          list:(dir, opt) => wrap(async () => {
            const pre = k(dir || '').replace(/\/?$/, '/');
            let rows = (await M.list(pre)).map(o => ({ name:o.name, id:o.name, updated_at:o.uploaded, created_at:o.uploaded, metadata:{ size:o.size } }));
            if (opt && opt.search) rows = rows.filter(o => o.name.startsWith(opt.search));
            if (opt && opt.sortBy) { const c = opt.sortBy.column === 'name' ? 'name' : 'updated_at', d = opt.sortBy.order === 'desc' ? -1 : 1; rows.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * d); }
            return { data:rows, error:null };
          }),
          remove:paths => wrap(async () => {
            for (const p of paths || []) { const r = await M.remove(k(p)); if (r.error) return { data:null, error:r.error }; }
            return { data:paths, error:null };
          }),
          copy:(from, to) => wrap(async () => { const r = await M.copy(k(from), k(to)); return r.error ? { data:null, error:r.error } : { data:{ path:to }, error:null }; }),
          move:(from, to) => wrap(async () => {
            const r = await M.copy(k(from), k(to)); if (r.error) return { data:null, error:r.error };
            const d = await M.remove(k(from)); return d.error ? { data:null, error:d.error } : { data:{ path:to }, error:null };
          }),
          download:p => wrap(async () => {
            const r = await fetch(BASE + enc(k(p)), { headers:await auth() });
            return r.ok ? { data:await r.blob(), error:null } : { data:null, error:{ message:'Not found' } };
          }),
        };
      },
    };
  };
})();
