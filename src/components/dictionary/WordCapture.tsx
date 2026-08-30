import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { BookMarked, Check, Plus, X } from 'lucide-react';
import { captureWord, queueSnapshot, queueServerSnapshot, subscribeQueue } from '@/lib/word-queue';
import { isDefined } from '@/content/dictionary';
import { UI } from '@/content/ui';
import { useLang } from '@/lib/i18n';

/** 在输入框里敲 `w` 是打字，不是快捷键 */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * 全站的生词捕获。
 *
 * 读着读着卡住一个词，要能就地敲进去——为一个单词跳去另一个页面，
 * 十次里有九次就不记了。所以这层挂在路由外面：按 `w` 或点右下角那颗按钮，
 * 弹一个只有一行输入的小框，回车即存，框不关，可以连着敲第二个。
 *
 * 存进去的只是词本身。释义、中文、例句是后面整理时补的，不在这一步拦人。
 */
export function WordCapture() {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState('');
  const [flash, setFlash] = useState<{ term: string; kind: 'added' | 'duplicate' | 'known' } | null>(
    null
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const { pathname, search } = useLocation();
  const { t } = useLang();

  const queue = useSyncExternalStore(subscribeQueue, queueSnapshot, queueServerSnapshot);

  const open = useCallback((seed = '') => {
    setValue(seed);
    setIsOpen(true);
  }, []);

  // `w` 开框。选中的那几个字直接带进去，省一次手打
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        return;
      }
      if (isOpen || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== 'w' && event.key !== 'W') return;
      if (isTyping(event.target)) return;

      const selected = window.getSelection()?.toString().trim() ?? '';
      event.preventDefault();
      // 整段选中不是要查词，只带短的那种
      open(selected.length > 0 && selected.length <= 40 ? selected : '');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, open]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // 提示自己消失，不然它会一直挂在那儿假装是状态
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 2400);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const submit = () => {
    const term = value.trim();
    if (!term) return;
    if (isDefined(term)) {
      setFlash({ term, kind: 'known' });
      setValue('');
      return;
    }
    const result = captureWord(term, `${pathname}${search}`);
    if (result === 'empty') return;
    setFlash({ term, kind: result });
    setValue('');
  };

  // 分享出去的简历页不该带着我的生词按钮
  if (pathname === '/cv') return null;

  return (
    <>
      <button
        type="button"
        onClick={() => open()}
        aria-label={t(UI.capture.open)}
        className="fixed bottom-5 right-5 z-40 hidden size-11 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-lg backdrop-blur transition-colors hover:border-foreground/30 hover:text-foreground md:flex"
      >
        <Plus className="size-5" />
        {queue.length > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1 text-[11px] font-semibold leading-5 text-primary-foreground tabular-nums">
            {queue.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-start justify-center bg-background/70 px-4 pt-[22vh] backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.15 }}
              role="dialog"
              aria-modal="true"
              aria-label={t(UI.capture.dialog)}
              className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
            >
              <div className="flex items-center gap-3 border-b border-border px-4">
                <BookMarked className="size-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={t(UI.capture.placeholder)}
                  aria-label={t(UI.capture.field)}
                  className="h-14 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label={t(UI.capture.close)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs text-muted-foreground">
                <span className="min-w-0 truncate">
                  {flash?.kind === 'added' && (
                    <span className="flex items-center gap-1.5 text-foreground">
                      <Check className="size-3.5" />
                      {t(UI.capture.added(flash.term))}
                    </span>
                  )}
                  {flash?.kind === 'duplicate' && t(UI.capture.duplicate(flash.term))}
                  {flash?.kind === 'known' && t(UI.capture.known(flash.term))}
                  {!flash && t(UI.capture.idle)}
                </span>
                <Link
                  to="/words"
                  onClick={() => setIsOpen(false)}
                  className="shrink-0 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
                >
                  {queue.length > 0
                    ? t(UI.capture.waiting(queue.length))
                    : t(UI.capture.goToDictionary)}
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
