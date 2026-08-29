/**
 * 生词队列。
 *
 * 站里没有后端，也不该为了记个单词加一个：往浏览器里塞一把能改仓库的 token，
 * 换来的只是省掉一次粘贴。所以敲进来的词先落在这台机器的 localStorage 里，
 * 攒够了一次性复制出去，释义补完后进 `content/dictionary` 成为正式词条。
 * 生词不进 issue——单词本就是仓库里这张表，不该有第二个存放处。
 *
 * 队列只是「待办」，不是单词本本身——词条一旦进了仓库，队列里那条就该消失。
 */

const KEY = 'apollo:word-queue';

export interface CapturedWord {
  /** 原样保留大小写，但比对和去重按小写 */
  term: string;
  /** 在哪一页遇到的，补释义时这是唯一的上下文来源 */
  from?: string;
  /** 捕获时刻，ISO 串 */
  at: string;
}

function read(): CapturedWord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CapturedWord =>
        Boolean(item) && typeof item.term === 'string' && typeof item.at === 'string'
    );
  } catch {
    // 无痕模式、存储被禁、旧数据坏了：一律当作空队列
    return [];
  }
}

const listeners = new Set<() => void>();

/** 缓存快照：useSyncExternalStore 要求同一份数据必须返回同一个引用 */
let snapshot: CapturedWord[] = [];
let loaded = false;

function refresh() {
  snapshot = read();
  loaded = true;
}

function write(next: CapturedWord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 存不进去也要让当前这一屏显示出来，不为它报错 */
  }
  snapshot = next;
  loaded = true;
  for (const listener of listeners) listener();
}

export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  // 另一个标签页里加的词，这一页也要跟着变
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      refresh();
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function queueSnapshot(): CapturedWord[] {
  if (!loaded) refresh();
  return snapshot;
}

/** 服务端/预渲染没有 localStorage，给一份恒定的空队列 */
const EMPTY: CapturedWord[] = [];
export function queueServerSnapshot(): CapturedWord[] {
  return EMPTY;
}

/**
 * 入队。已经在队列里的词只更新时间和出处，不重复排一条——
 * 同一个词在三篇笔记里绊到，想要的是一条词条，不是三条。
 * @returns 这次是新词还是撞上了旧的
 */
export function captureWord(term: string, from?: string): 'added' | 'duplicate' | 'empty' {
  const cleaned = term.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'empty';

  const current = queueSnapshot();
  const key = cleaned.toLowerCase();
  const existing = current.findIndex((item) => item.term.toLowerCase() === key);
  const at = new Date().toISOString();

  if (existing >= 0) {
    const next = [...current];
    next[existing] = { ...next[existing], at, from: from ?? next[existing].from };
    write(next);
    return 'duplicate';
  }

  write([...current, { term: cleaned, from, at }]);
  return 'added';
}

export function removeWord(term: string): void {
  const key = term.toLowerCase();
  write(queueSnapshot().filter((item) => item.term.toLowerCase() !== key));
}

export function clearQueue(): void {
  write([]);
}

/** 交出去时的样子：一行一个词，带出处，人和 agent 都读得动 */
export function queueAsText(words: CapturedWord[]): string {
  return words
    .map((word) => (word.from ? `- ${word.term} — seen in ${word.from}` : `- ${word.term}`))
    .join('\n');
}
