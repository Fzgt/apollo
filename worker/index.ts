/**
 * Apollo 编辑层 API。
 *
 * 站本身是 GitHub Pages 上的静态资源，没有服务端，
 * 所以写入单独放这个 Worker：它是唯一碰得到 Neon 连接串的地方，
 * 前端只拿得到一个短期 token。
 *
 * 环境变量（用 `wrangler secret put` 设，别写进仓库）：
 *   DATABASE_URL  Neon 连接串
 *   EDIT_PASSWORD 解锁编辑用的口令
 *   EDIT_SECRET   签 token 用的随机串
 */

import { neon } from '@neondatabase/serverless';

interface Env {
  DATABASE_URL: string;
  EDIT_PASSWORD: string;
  EDIT_SECRET: string;
  ALLOWED_ORIGINS?: string;
}

const DEFAULT_ORIGINS = [
  'https://fzgt.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天，够一轮面试季

const CREATE_TABLE = `
  create table if not exists blocks (
    key text primary key,
    data jsonb not null,
    updated_at timestamptz not null default now()
  )
`;

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : DEFAULT_ORIGINS;

  if (!origin || !allowed.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,PUT,DELETE,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

function json(body: unknown, init: ResponseInit = {}, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...cors, ...init.headers },
  });
}

const encoder = new TextEncoder();

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function issueToken(env: Env): Promise<string> {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  return `${exp}.${await hmac(env.EDIT_SECRET, exp)}`;
}

/** 定长比较，别让口令被时间差一位一位试出来 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verify(request: Request, env: Env): Promise<boolean> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;

  const [exp, sig] = auth.slice(7).split('.');
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;

  return safeEqual(sig, await hmac(env.EDIT_SECRET, exp));
}

type Sql = ReturnType<typeof neon>;

/** 第一次跑时表还不存在，建完重试一次，省掉手动初始化那步 */
async function withTable<T>(sql: Sql, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (String(e).includes('relation "blocks" does not exist')) {
      await sql(CREATE_TABLE);
      return run();
    }
    throw e;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin');
    const cors = corsHeaders(origin, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/api/session' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as { password?: string };
      if (!body.password || !safeEqual(body.password, env.EDIT_PASSWORD)) {
        return json({ error: '口令不对' }, { status: 401 }, cors);
      }
      return json({ token: await issueToken(env) }, {}, cors);
    }

    if (url.pathname !== '/api/blocks') {
      return json({ error: 'not found' }, { status: 404 }, cors);
    }

    if (!(await verify(request, env))) {
      return json({ error: '未授权' }, { status: 401 }, cors);
    }

    const sql = neon(env.DATABASE_URL);

    try {
      if (request.method === 'GET') {
        const rows = (await withTable(sql, () =>
          sql`select key, data from blocks`
        )) as { key: string; data: unknown }[];
        const blocks: Record<string, unknown> = {};
        for (const row of rows) blocks[row.key] = row.data;
        return json({ blocks }, {}, cors);
      }

      if (request.method === 'PUT') {
        const body = (await request.json()) as { key?: string; data?: unknown };
        if (!body.key || body.data === undefined) {
          return json({ error: '缺 key 或 data' }, { status: 400 }, cors);
        }
        await withTable(sql, () =>
          sql`
            insert into blocks (key, data, updated_at)
            values (${body.key}, ${JSON.stringify(body.data)}::jsonb, now())
            on conflict (key) do update
              set data = excluded.data, updated_at = now()
          `
        );
        return json({ ok: true }, {}, cors);
      }

      if (request.method === 'DELETE') {
        const body = (await request.json()) as { key?: string };
        if (!body.key) return json({ error: '缺 key' }, { status: 400 }, cors);
        await withTable(sql, () => sql`delete from blocks where key = ${body.key}`);
        return json({ ok: true }, {}, cors);
      }
    } catch (e) {
      return json({ error: String(e) }, { status: 500 }, cors);
    }

    return json({ error: 'method not allowed' }, { status: 405 }, cors);
  },
};
