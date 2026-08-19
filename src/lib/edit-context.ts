/**
 * 编辑态的 context 与 hook。
 * 和 EditProvider 分开放：组件文件只导出组件，热更新才不会整页刷。
 */

import { createContext, useCallback, useContext } from 'react';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface EditContextValue {
  /** 是否配了 API：没配就是纯只读站 */
  enabled: boolean;
  unlocked: boolean;
  loading: boolean;
  status: SaveStatus;
  error: string | null;
  /** 已存的块，key -> data；没有的键表示「还是 markdown 里的原样」 */
  blocks: Record<string, unknown>;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  get: <T>(key: string) => T | undefined;
  set: (key: string, data: unknown) => void;
  reset: (key: string) => void;
}

export const EditContext = createContext<EditContextValue | null>(null);


export function useEditStore(): EditContextValue {
  const ctx = useContext(EditContext);
  if (!ctx) throw new Error('useEditStore 必须在 EditProvider 内使用');
  return ctx;
}

/** 订阅单个块：没存过就退回 markdown 里的种子 */
export function useBlock<T>(key: string, seed: T): [T, (next: T) => void, boolean, () => void] {
  const { blocks, set, reset } = useEditStore();
  const stored = blocks[key] as T | undefined;
  const dirty = stored !== undefined;
  const setValue = useCallback((next: T) => set(key, next), [key, set]);
  const resetValue = useCallback(() => reset(key), [key, reset]);
  return [dirty ? (stored as T) : seed, setValue, dirty, resetValue];
}
