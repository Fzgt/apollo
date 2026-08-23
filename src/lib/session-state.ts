/**
 * 顶栏切页时把每个页签的状态留在 sessionStorage 里：停在哪个地址、
 * 侧边栏展开了哪几组、滚到哪儿。只活到这个浏览器标签页关掉为止。
 */

const PREFIX = 'apollo:';

export function readSession<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    // 无痕模式、存储被禁、旧数据坏了：一律当作没存过
    return fallback;
  }
}

export function writeSession(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* 存不进去就算了，不值得为它报错 */
  }
}

/** 顶栏页签。记的是「这个页签最后停在哪个完整地址」 */
const TAB_ROOTS = ['/docs', '/library', '/questions', '/blog', '/'] as const;

function tabRootOf(pathname: string): string | undefined {
  return TAB_ROOTS.find((root) =>
    root === '/' ? pathname === '/' : pathname === root || pathname.startsWith(`${root}/`)
  );
}

export function rememberTabUrl(pathname: string, search: string): void {
  const root = tabRootOf(pathname);
  if (root) writeSession(`tab:${root}`, pathname + search);
}

/** 顶栏链接真正要跳的地址：上次停的那个，没记过就是页签根路径 */
export function lastTabUrl(root: string): string {
  const saved = readSession<unknown>(`tab:${root}`, null);
  return typeof saved === 'string' && saved.startsWith(root) ? saved : root;
}

const SCROLL_KEY = 'scroll';
/** 每篇笔记/每篇文章都是一个地址，攒太多没意义，留最近这些 */
const SCROLL_LIMIT = 60;

type ScrollMap = Record<string, number>;

function scrollMap(): ScrollMap {
  const map = readSession<ScrollMap>(SCROLL_KEY, {});
  return map && typeof map === 'object' ? map : {};
}

export function readScroll(key: string): number {
  const top = scrollMap()[key];
  return typeof top === 'number' && top > 0 ? top : 0;
}

export function writeScroll(key: string, top: number): void {
  const map = scrollMap();
  delete map[key];
  map[key] = Math.round(top);

  const keys = Object.keys(map);
  for (const stale of keys.slice(0, Math.max(0, keys.length - SCROLL_LIMIT))) {
    delete map[stale];
  }
  writeSession(SCROLL_KEY, map);
}
