import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2, Lock, LockOpen, TriangleAlert } from 'lucide-react';
import { useEditStore } from '@/lib/edit-context';
import { cn } from '@/lib/utils';

/**
 * 导航栏上的锁。
 * 站是公开的，所以「能不能写」由一个口令决定，口令只在 Worker 那边校验。
 */
export function EditLock() {
  const { enabled, unlocked, loading, status, error, unlock, lock } = useEditStore();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!enabled) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFailed(null);
    try {
      await unlock(password);
      setPassword('');
      setOpen(false);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : '口令不对');
    } finally {
      setBusy(false);
    }
  };

  const statusLabel =
    status === 'saving' ? '保存中' : status === 'error' ? '未保存' : status === 'saved' ? '已保存' : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (unlocked ? lock() : setOpen((v) => !v))}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm transition-colors',
          unlocked
            ? 'text-primary hover:bg-primary/10'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
        aria-label={unlocked ? '锁定编辑' : '解锁编辑'}
        title={unlocked ? '点一下锁回只读' : '解锁后可以直接在页面上填写'}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : unlocked ? (
          <LockOpen className="h-4 w-4" />
        ) : (
          <Lock className="h-4 w-4" />
        )}
        {unlocked && statusLabel ? (
          <span
            className={cn(
              'hidden text-xs sm:inline',
              status === 'error' ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {statusLabel}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open && !unlocked ? (
          <motion.form
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            onSubmit={submit}
            className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-card p-3 shadow-xl"
          >
            <p className="mb-2 text-xs text-muted-foreground">输入口令后可直接在页面上填写</p>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/60 focus:outline-none"
              placeholder="口令"
            />
            {failed ? (
              <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
                <TriangleAlert className="h-3 w-3" /> {failed}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy || !password}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              解锁
            </button>
          </motion.form>
        ) : null}
      </AnimatePresence>

      {unlocked && status === 'error' && error ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}（改动已存在本机，联网后再改一次即可同步）
        </div>
      ) : null}
    </div>
  );
}
