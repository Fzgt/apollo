import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { readScroll, rememberTabUrl, writeScroll } from '@/lib/session-state';

/**
 * 懒加载的路由要等 chunk 到位才撑得出高度，恢复滚动位置得多等几帧；
 * 等过这个数还没撑起来就放弃，免得页面在用户眼皮底下自己跳。
 */
const RESTORE_BUDGET_MS = 1200;

/** 滚到 target；页面还没长够高就逐帧重试，用户一动手就作罢 */
function restoreScroll(target: number): () => void {
  if (target <= 0) {
    window.scrollTo(0, 0);
    return () => {};
  }

  let frame = 0;
  let cancelled = false;
  const deadline = performance.now() + RESTORE_BUDGET_MS;

  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    cancelAnimationFrame(frame);
    window.removeEventListener('wheel', cancel);
    window.removeEventListener('touchstart', cancel);
    window.removeEventListener('keydown', cancel);
  };

  const tick = () => {
    if (cancelled) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max >= target) {
      window.scrollTo(0, target);
      cancel();
      return;
    }
    if (performance.now() >= deadline) {
      window.scrollTo(0, Math.max(max, 0));
      cancel();
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  window.addEventListener('wheel', cancel, { passive: true });
  window.addEventListener('touchstart', cancel, { passive: true });
  window.addEventListener('keydown', cancel);
  frame = requestAnimationFrame(tick);
  return cancel;
}

/**
 * 路由记忆：记下每个顶栏页签最后停在哪个地址，以及每个地址滚到了哪儿。
 * 页面里不要再自己 window.scrollTo(0, 0)，滚动这件事统一由这里管。
 */
export function RouteMemory() {
  const { pathname, search } = useLocation();
  const key = pathname + search;
  /** 当前滚动位置。切页时 DOM 已经换掉了，读 window.scrollY 会拿到被截断的值 */
  const scrollTop = useRef(0);

  useEffect(() => {
    // 浏览器自己的还原会和下面这套抢方向盘
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    const onScroll = () => {
      scrollTop.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    rememberTabUrl(pathname, search);
    scrollTop.current = 0;

    const stopRestore = restoreScroll(readScroll(key));
    const save = () => writeScroll(key, scrollTop.current);
    window.addEventListener('pagehide', save);

    return () => {
      stopRestore();
      window.removeEventListener('pagehide', save);
      save();
    };
  }, [key, pathname, search]);

  return null;
}
