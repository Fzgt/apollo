import { useCallback, useState } from 'react';

/**
 * 哪些文章读过。纯本地状态：站是静态的，没有账号也没有服务端，
 * 换台机器就重新算——这点比引一个后端划算。
 */
const STORAGE_KEY = 'apollo:blog:read';

function loadReadPosts(): Set<number> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is number => typeof value === 'number'));
  } catch {
    return new Set();
  }
}

function persist(next: Set<number>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // 无痕模式 / 存储配额满：读没读只是锦上添花，不值得为它报错
  }
}

export function useReadPosts() {
  const [readPosts, setReadPosts] = useState<Set<number>>(() =>
    typeof window === 'undefined' ? new Set() : loadReadPosts()
  );

  const markRead = useCallback((number: number) => {
    setReadPosts((prev) => {
      if (prev.has(number)) return prev;
      const next = new Set(prev).add(number);
      persist(next);
      return next;
    });
  }, []);

  const toggleRead = useCallback((number: number) => {
    setReadPosts((prev) => {
      const next = new Set(prev);
      if (!next.delete(number)) next.add(number);
      persist(next);
      return next;
    });
  }, []);

  const clearRead = useCallback(() => {
    setReadPosts(() => {
      const next = new Set<number>();
      persist(next);
      return next;
    });
  }, []);

  return { readPosts, markRead, toggleRead, clearRead };
}
