/**
 * 编辑层的 API 客户端。
 *
 * 站本身是静态的（GitHub Pages），写入靠一个 Cloudflare Worker 转 Neon。
 * `VITE_API_BASE` 没配时整站退回只读：所有可编辑块照常按 markdown 渲染，
 * 不报错、不留空白，只是存不了。
 */

export const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
export const API_ENABLED = API_BASE.length > 0;

const TOKEN_KEY = 'apollo.edit.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 隐私模式下 localStorage 会抛，忽略即可 */
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_ENABLED) throw new ApiError('未配置 API 地址', 0);

  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    setToken(null);
    throw new ApiError('登录已过期，重新解锁', 401);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(text || `请求失败（${res.status}）`, res.status);
  }
  return (await res.json()) as T;
}

export async function login(password: string): Promise<string> {
  const { token } = await request<{ token: string }>('/api/session', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  setToken(token);
  return token;
}

export async function fetchBlocks(): Promise<Record<string, unknown>> {
  const { blocks } = await request<{ blocks: Record<string, unknown> }>('/api/blocks');
  return blocks;
}

export async function saveBlock(key: string, data: unknown): Promise<void> {
  await request('/api/blocks', {
    method: 'PUT',
    body: JSON.stringify({ key, data }),
  });
}

export async function resetBlock(key: string): Promise<void> {
  await request('/api/blocks', {
    method: 'DELETE',
    body: JSON.stringify({ key }),
  });
}
