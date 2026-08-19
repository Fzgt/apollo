/**
 * 编辑态的单一来源。
 *
 * 三层：内存（即时）→ localStorage（离线兜底）→ Neon（跨设备）。
 * 打字先落内存和本地，600ms 静默后才推服务端；服务端挂了不会吞掉输入。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EditContext, type EditContextValue } from '@/lib/edit-context';
import { API_ENABLED, fetchBlocks, getToken, login, resetBlock, saveBlock, setToken } from '@/lib/api';

const CACHE_KEY = 'apollo.edit.cache';
const DEBOUNCE_MS = 600;

function readCache(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeCache(blocks: Record<string, unknown>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(blocks));
  } catch {
    /* 配额满了就算了，服务端才是真相 */
  }
}

export function EditProvider({ children }: { children: ReactNode }) {
  const [blocks, setBlocks] = useState<Record<string, unknown>>(() =>
    typeof window === 'undefined' ? {} : readCache()
  );
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Set<string>());
  const latest = useRef(blocks);
  latest.current = blocks;

  const pull = useCallback(async () => {
    setLoading(true);
    try {
      const remote = await fetchBlocks();
      setBlocks((prev) => {
        const merged = { ...prev, ...remote };
        writeCache(merged);
        return merged;
      });
      setUnlocked(true);
      setError(null);
    } catch (e) {
      setUnlocked(false);
      setError(e instanceof Error ? e.message : '拉取失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 带着有效 token 回来的，直接进编辑态，不用再敲一次密码
  useEffect(() => {
    if (!API_ENABLED || !getToken()) return;
    void pull();
  }, [pull]);

  const flush = useCallback((key: string) => {
    const data = latest.current[key];
    pending.current.add(key);
    setStatus('saving');
    void saveBlock(key, data)
      .then(() => {
        pending.current.delete(key);
        if (pending.current.size === 0) setStatus('saved');
      })
      .catch((e: unknown) => {
        pending.current.delete(key);
        setStatus('error');
        setError(e instanceof Error ? e.message : '保存失败');
      });
  }, []);

  const set = useCallback(
    (key: string, data: unknown) => {
      setBlocks((prev) => {
        const next = { ...prev, [key]: data };
        latest.current = next;
        writeCache(next);
        return next;
      });

      if (!unlocked) return;

      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key);
          flush(key);
        }, DEBOUNCE_MS)
      );
    },
    [flush, unlocked]
  );

  const reset = useCallback(
    (key: string) => {
      setBlocks((prev) => {
        const next = { ...prev };
        delete next[key];
        latest.current = next;
        writeCache(next);
        return next;
      });
      if (unlocked) void resetBlock(key).catch(() => setStatus('error'));
    },
    [unlocked]
  );

  const unlock = useCallback(
    async (password: string) => {
      await login(password);
      await pull();
    },
    [pull]
  );

  const lock = useCallback(() => {
    setToken(null);
    setUnlocked(false);
    setStatus('idle');
  }, []);

  const get = useCallback(<T,>(key: string) => blocks[key] as T | undefined, [blocks]);

  // 拔网线／关标签页前把还没推的改动同步掉
  useEffect(() => {
    const onHide = () => {
      timers.current.forEach((timer, key) => {
        clearTimeout(timer);
        timers.current.delete(key);
        flush(key);
      });
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [flush]);

  const value = useMemo<EditContextValue>(
    () => ({ enabled: API_ENABLED, unlocked, loading, status, error, blocks, unlock, lock, get, set, reset }),
    [unlocked, loading, status, error, blocks, unlock, lock, get, set, reset]
  );

  return <EditContext.Provider value={value}>{children}</EditContext.Provider>;
}
