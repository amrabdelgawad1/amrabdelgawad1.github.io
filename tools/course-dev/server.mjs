// Local test mode for /course. Not deployed and not used by the live site.
//
// Serves the repo at http://localhost:8787 and stands in for the parts of Supabase the course uses,
// on a local Postgres that has supabase/migrations applied (see seed.mjs):
//   /sb/auth/v1/...     sign-in with any test account (password: "test")
//   /sb/rest/v1/rpc/... runs the real course_* SQL functions as the "authenticated" role,
//                       with the signed-in user's id, so row-level security and grading are the real thing
//   /sb/storage/v1/...  the private "course" bucket, files kept in data/storage/, policies checked in Postgres
// /tracker/config.js and the page's Content-Security-Policy are rewritten to point at /sb.
//
// Run:  PGURL=postgres://postgres@localhost:54329/course node server.mjs
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DATA = path.join(import.meta.dirname, 'data');
const PORT = Number(process.env.PORT || 8787);
const ORIGIN = 'http://localhost:' + PORT;
const LIVE_SB = 'https://ztlpgyomjuzmjmuifbbd.supabase.co';
const pool = new pg.Pool({ connectionString: process.env.PGURL || 'postgres://postgres@localhost:54329/course' });
const SECRET = crypto.randomBytes(16).toString('hex');

const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.pdf':'application/pdf', '.ico':'image/x-icon', '.gif':'image/gif', '.m4a':'audio/mp4', '.woff2':'font/woff2' };

const b64u = s => Buffer.from(s).toString('base64url');
function jwtFor(u){
  const now = Math.floor(Date.now() / 1000);
  return [b64u(JSON.stringify({ alg:'HS256', typ:'JWT' })),
          b64u(JSON.stringify({ sub:u.id, email:u.email, role:'authenticated', aal:'aal1', amr:[{ method:'password', timestamp:now }], iat:now, exp:now + 3600 })),
          'local-test-signature'].join('.');
}
function claimsFrom(req){
  const t = (req.headers.authorization || '').replace(/^Bearer /, '');
  try { const c = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()); return c.sub ? c : null; } catch(e){ return null; }
}
const userJson = u => ({ id:u.id, aud:'authenticated', role:'authenticated', email:u.email, app_metadata:{ provider:'email' }, user_metadata:{}, factors:[], created_at:new Date().toISOString() });
function session(u){
  return { access_token:jwtFor(u), token_type:'bearer', expires_in:3600, expires_at:Math.floor(Date.now() / 1000) + 3600, refresh_token:'r-' + u.id, user:userJson(u) };
}

// Runs fn(client) in a transaction as the signed-in user, the way PostgREST does
async function asUser(claims, fn){
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query('set local role ' + (claims ? 'authenticated' : 'anon'));
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims || {})]);
    const r = await fn(c);
    await c.query('commit');
    return r;
  } catch(e){ await c.query('rollback').catch(() => {}); throw e; }
  finally { c.release(); }
}

const argCache = new Map();
async function rpcArgs(name){
  if (argCache.has(name)) return argCache.get(name);
  const { rows } = await pool.query(
    `select p.proargnames as names, array(select format_type(t, null) from unnest(p.proargtypes) t) as types, p.pronargs as n
       from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = $1`, [name]);
  if (!rows.length) return null;
  const a = { names:(rows[0].names || []).slice(0, rows[0].n), types:rows[0].types };
  argCache.set(name, a); return a;
}

function send(res, status, body, type){
  const isBuf = Buffer.isBuffer(body);
  res.writeHead(status, { 'content-type': type || (isBuf ? 'application/octet-stream' : 'application/json'), 'access-control-allow-origin':'*', 'cache-control':'no-store' });
  res.end(isBuf ? body : body === undefined ? '' : typeof body === 'string' && type ? body : JSON.stringify(body));
}
const pgError = (res, e) => send(res, e.code === '42501' ? 403 : 400, { code:e.code, message:e.message, details:null, hint:null });
async function readBody(req){ const parts = []; for await (const p of req) parts.push(p); return Buffer.concat(parts); }
const sign = p => crypto.createHmac('sha256', SECRET).update(p).digest('hex').slice(0, 32);
const safe = p => { const f = path.join(DATA, 'storage', p); if (!f.startsWith(path.join(DATA, 'storage') + path.sep)) throw new Error('bad path'); return f; };

async function handleSb(req, res, url){
  const p = url.pathname.slice(3);
  const claims = claimsFrom(req);

  // ---- auth ----
  if (p === '/auth/v1/token') {
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    let u;
    if (url.searchParams.get('grant_type') === 'password') {
      if (body.password !== 'test') return send(res, 400, { error:'invalid_grant', error_description:'Invalid login credentials', msg:'Invalid login credentials' });
      u = (await pool.query('select id, email from auth.users where lower(email) = lower($1)', [body.email || ''])).rows[0];
    } else {
      u = (await pool.query('select id, email from auth.users where id::text = $1', [String(body.refresh_token || '').slice(2)])).rows[0];
    }
    if (!u) return send(res, 400, { error:'invalid_grant', error_description:'Invalid login credentials', msg:'Invalid login credentials' });
    return send(res, 200, session(u));
  }
  if (p === '/auth/v1/user') {
    if (!claims) return send(res, 401, { msg:'no session' });
    const u = (await pool.query('select id, email from auth.users where id = $1', [claims.sub])).rows[0];
    return u ? send(res, 200, userJson(u)) : send(res, 401, { msg:'no user' });
  }
  if (p === '/auth/v1/logout') return send(res, 204);

  // ---- rpc ----
  const m = p.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
  if (m) {
    if (!/^course_/.test(m[1])) return send(res, 404, { message:'Only course_* functions are available in test mode.' });
    const a = await rpcArgs(m[1]);
    if (!a) return send(res, 404, { code:'PGRST202', message:'Could not find the function public.' + m[1] });
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    const exprs = a.names.filter(n => n in body).map(n => {
      const t = a.types[a.names.indexOf(n)];
      const v = t === 'jsonb' ? `($1::jsonb -> '${n}')` : t.endsWith('[]') ? `array(select jsonb_array_elements_text($1::jsonb -> '${n}'))::${t}` : `($1::jsonb ->> '${n}')::${t}`;
      return `${n} => ${v}`;
    });
    try {
      const r = await asUser(claims, c => c.query(`select to_jsonb(public.${m[1]}(${exprs.join(', ')})) as r`, [JSON.stringify(body)]));
      return send(res, 200, r.rows[0].r);
    } catch(e){ return pgError(res, e); }
  }

  // ---- storage ----
  // sign several:  POST /storage/v1/object/sign/course {paths}
  // sign one:      POST /storage/v1/object/sign/course/<path>
  // fetch signed:  GET  /storage/v1/object/sign/course/<path>?token=
  // upload:        POST /storage/v1/object/course/<path>   (multipart)
  // remove:        DELETE /storage/v1/object/course {prefixes}
  const s = p.match(/^\/storage\/v1\/object(\/sign)?\/course(?:\/(.+))?$/);
  if (s) {
    const isSign = !!s[1], objPath = s[2] ? decodeURIComponent(s[2]) : null;
    const canRead = (c, name) => c.query("select exists (select 1 from storage.objects where bucket_id = 'course' and name = $1) as ok", [name]).then(r => r.rows[0].ok);
    if (isSign && req.method === 'GET' && objPath) {
      if (url.searchParams.get('token') !== sign(objPath)) return send(res, 400, { message:'bad token' });
      try { return send(res, 200, await fs.readFile(safe(objPath)), TYPES[path.extname(objPath).toLowerCase()]); } catch(e){ return send(res, 404, { message:'Object not found' }); }
    }
    if (isSign && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const paths = objPath ? [objPath] : (body.paths || []);
      const out = await asUser(claims, async c => { const o = []; for (const q of paths) o.push(await canRead(c, q) ? { path:q, signedURL:'/object/sign/course/' + q + '?token=' + sign(q), error:null } : { path:q, signedURL:null, error:'Either the object does not exist or you do not have access to it' }); return o; });
      if (objPath) return out[0].signedURL ? send(res, 200, { signedURL:out[0].signedURL }) : send(res, 400, { statusCode:'404', error:'not_found', message:out[0].error });
      return send(res, 200, out);
    }
    if (!isSign && req.method === 'POST' && objPath) {
      const raw = await readBody(req);
      const form = await new Request('http://x', { method:'POST', headers:{ 'content-type':req.headers['content-type'] }, body:raw }).formData().catch(() => null);
      const file = form ? [...form.values()].find(v => typeof v === 'object') : null;
      const buf = file ? Buffer.from(await file.arrayBuffer()) : raw;
      if (buf.length > 10 * 1024 * 1024) return send(res, 413, { statusCode:'413', error:'Payload too large', message:'The object exceeded the maximum allowed size' });
      try {
        await asUser(claims, async c => {
          const up = req.headers['x-upsert'] === 'true';
          await c.query(`insert into storage.objects (bucket_id, name, owner) values ('course', $1, $2)` + (up ? ' on conflict (bucket_id, name) do update set created_at = now()' : ''), [objPath, claims && claims.sub]);
        });
      } catch(e){ return send(res, 400, { statusCode:e.code === '23505' ? '409' : '403', error:e.code === '23505' ? 'Duplicate' : 'Unauthorized', message:e.code === '23505' ? 'The resource already exists' : 'new row violates row-level security policy' }); }
      await fs.mkdir(path.dirname(safe(objPath)), { recursive:true });
      await fs.writeFile(safe(objPath), buf);
      return send(res, 200, { Key:'course/' + objPath, Id:crypto.randomUUID() });
    }
    if (!isSign && req.method === 'DELETE') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const gone = await asUser(claims, c => c.query("delete from storage.objects where bucket_id = 'course' and name = any($1) returning name", [body.prefixes || []]));
      for (const r of gone.rows) await fs.rm(safe(r.name), { force:true });
      return send(res, 200, gone.rows.map(r => ({ name:r.name })));
    }
  }
  return send(res, 404, { message:'Not available in test mode: ' + req.method + ' ' + p });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, ORIGIN);
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin':'*', 'access-control-allow-headers':'*', 'access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS' }); return res.end(); }
    if (url.pathname.startsWith('/sb/')) return await handleSb(req, res, url);
    if (url.pathname === '/tracker/config.js') return send(res, 200, `window.TRACKER_CONFIG = { supabaseUrl: '${ORIGIN}/sb', supabaseKey: 'local-test-key' };`, TYPES['.js']);
    let f = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!f.startsWith(ROOT)) return send(res, 403, 'no', 'text/plain');
    if ((await fs.stat(f).catch(() => null))?.isDirectory()) f = path.join(f, 'index.html');
    let body = await fs.readFile(f);
    const ext = path.extname(f);
    if (ext === '.html') body = Buffer.from(body.toString().split(LIVE_SB).join(ORIGIN).replace(/\s*upgrade-insecure-requests/, '').replace(/wss:\/\/ztlpgyomjuzmjmuifbbd\.supabase\.co/g, ''));
    res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control':'no-store' });
    res.end(body);
  } catch(e){
    if (e.code === 'ENOENT') return send(res, 404, 'Not found', 'text/plain');
    console.error(e); send(res, 500, { message:String(e.message || e) });
  }
});
server.listen(PORT, () => console.log('Course test mode on ' + ORIGIN + '/course/  (accounts: see data/accounts.txt, password: test)'));
