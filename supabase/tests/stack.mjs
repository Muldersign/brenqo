// Local stand-in for a Supabase project, for end-to-end tests:
// fresh database (stub + migrations) → PostgREST → a small gateway that
// serves /rest/v1 (PostgREST), /auth/v1/user (decodes our test JWTs) and
// /storage/v1 (accepts uploads). Usage: node supabase/tests/stack.mjs
import { spawn, execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import http from 'node:http';
import { readdirSync } from 'node:fs';

const PG = process.env.PGURL ?? 'postgresql://postgres@%2Ftmp:54329';
const POSTGREST = process.env.POSTGREST_BIN ?? '/var/tmp/postgrest';
const SECRET = 'brenqo-e2e-secret-brenqo-e2e-secret-0123456789';
const GATEWAY_PORT = Number(process.env.GATEWAY_PORT ?? 54400);
const REST_PORT = GATEWAY_PORT + 1;
const DB = 'brenqo_e2e';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export function sign(claims) {
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims })}`;
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
}

const psql = (db, args) => execFileSync('psql', [`${PG}/${db}`, '-v', 'ON_ERROR_STOP=1', '-q', ...args], { stdio: 'pipe' });
psql('postgres', ['-c', `drop database if exists ${DB} with (force)`, '-c', `create database ${DB}`]);
psql(DB, ['-f', 'supabase/tests/supabase-stub.sql']);
for (const f of readdirSync('supabase/migrations').sort()) psql(DB, ['-f', `supabase/migrations/${f}`]);

const users = [
  { id: '00000000-0000-0000-0000-0000000000a1', email: 'glenn@muldersign.nl', name: 'Glenn Mulder' },
  { id: '00000000-0000-0000-0000-0000000000b2', email: 'femke@vzveendam.nl', name: 'Femke' },
];
for (const u of users) psql(DB, ['-c', `insert into auth.users (id, email, raw_user_meta_data) values ('${u.id}', '${u.email}', '{"name":"${u.name}"}')`]);

const rest = spawn(POSTGREST, [], {
  env: {
    ...process.env,
    PGRST_DB_URI: `${PG.replace('postgres@', 'authenticator@')}/${DB}`,
    PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: SECRET, PGRST_SERVER_PORT: String(REST_PORT), PGRST_LOG_LEVEL: 'error',
  },
  stdio: 'inherit',
});

const gateway = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/auth/v1/user') {
    const token = (req.headers.authorization ?? '').replace('Bearer ', '');
    try {
      const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      const u = users.find((x) => x.id === claims.sub);
      if (!u) throw new Error('unknown');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', user_metadata: { name: u.name }, app_metadata: {}, created_at: new Date().toISOString() }));
    } catch {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end('{"message":"invalid token"}');
    }
    return;
  }
  if (url.pathname.startsWith('/storage/v1/')) {
    req.resume();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ Key: url.pathname.split('/object/')[1] ?? '', Id: 'x' }));
    return;
  }
  if (url.pathname.startsWith('/rest/v1/')) {
    const headers = { ...req.headers };
    delete headers.host;
    const up = http.request({ host: '127.0.0.1', port: REST_PORT, path: url.pathname.slice('/rest/v1'.length) + url.search, method: req.method, headers }, (r) => {
      res.writeHead(r.statusCode ?? 500, r.headers);
      r.pipe(res);
    });
    up.on('error', (e) => { res.writeHead(502); res.end(String(e)); });
    req.pipe(up);
    return;
  }
  res.writeHead(404);
  res.end();
});
gateway.listen(GATEWAY_PORT);

const anonKey = sign({ role: 'anon' });
const serviceKey = sign({ role: 'service_role' });
console.log(JSON.stringify({
  url: `http://localhost:${GATEWAY_PORT}`, anonKey, serviceKey,
  users: users.map((u) => ({ ...u, token: sign({ sub: u.id, role: 'authenticated', email: u.email, aud: 'authenticated' }) })),
}));
process.on('SIGTERM', () => { rest.kill(); gateway.close(); process.exit(0); });
