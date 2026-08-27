import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, ArrowRight, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Note } from '@/content/collection';

interface SearchResult {
  sectionId: string;
  itemId: string;
  title: string;
  sectionTitle: string;
  /** 命中的正文片段，标题命中时为空 */
  excerpt: string;
  type: 'title' | 'heading' | 'content';
}

interface DocsSearchProps {
  /** 搜索范围。两个 tab 各搜各的 */
  notes: Note[];
  /** 当前正文语言：搜的就是屏幕上那一版，搜英文不该命中中文原文 */
  lang: 'zh' | 'en';
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (sectionId: string, itemId?: string) => void;
}

const MAX_RESULTS = 12;

/** 取命中位置前后各 40 字，够看清上下文又不撑破弹层 */
function excerptAround(text: string, index: number, length: number) {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + length + 40);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ')}${
    end < text.length ? '…' : ''
  }`;
}

export function DocsSearch({ notes, lang, isOpen, onClose, onNavigate }: DocsSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    /** 没翻的那一篇仍按中文搜，不然它在英文模式下彻底搜不到 */
    const view = (note: Note) =>
      lang === 'en' && note.contentEn
        ? {
            title: note.titleEn ?? note.title,
            sectionTitle: note.sectionEn ?? note.section,
            content: note.contentEn,
          }
        : { title: note.title, sectionTitle: note.section, content: note.content };

    if (!q) {
      return notes.slice(0, MAX_RESULTS).map((note) => ({
        sectionId: note.sectionId,
        itemId: note.itemId,
        title: view(note).title,
        sectionTitle: view(note).sectionTitle,
        excerpt: '',
        type: 'title' as const,
      }));
    }

    const found: SearchResult[] = [];

    for (const note of notes) {
      if (found.length >= MAX_RESULTS) break;

      const { title, sectionTitle, content } = view(note);
      const base = { sectionId: note.sectionId, itemId: note.itemId, title, sectionTitle };

      if (title.toLowerCase().includes(q)) {
        found.push({ ...base, excerpt: '', type: 'title' });
        continue;
      }

      // 优先命中标题行，其次才是正文任意位置
      const headingLine = content
        .split('\n')
        .find((line) => line.startsWith('#') && line.toLowerCase().includes(q));

      if (headingLine) {
        found.push({ ...base, excerpt: headingLine.replace(/^#+\s*/, ''), type: 'heading' });
        continue;
      }

      const idx = content.toLowerCase().indexOf(q);
      if (idx !== -1) {
        found.push({ ...base, excerpt: excerptAround(content, idx, q.length), type: 'content' });
      }
    }

    return found;
  }, [notes, query, lang]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // 等弹层挂载完再聚焦，否则动画期间拿不到焦点
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
          break;
        case 'Enter': {
          e.preventDefault();
          const hit = results[selectedIndex];
          if (hit) {
            onNavigate(hit.sectionId, hit.itemId);
            onClose();
          }
          break;
        }
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onNavigate, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.15 }}
            role="dialog"
            aria-modal="true"
            aria-label="Search notes"
            className="fixed left-1/2 top-[15vh] z-50 w-[92vw] max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search titles and body text…"
                className="h-14 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
              <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground sm:block">
                ESC
              </kbd>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No matches
                </p>
              ) : (
                results.map((hit, index) => (
                  <button
                    key={`${hit.sectionId}-${hit.itemId}-${index}`}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => {
                      onNavigate(hit.sectionId, hit.itemId);
                      onClose();
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      index === selectedIndex ? 'bg-muted' : 'hover:bg-muted/50'
                    )}
                  >
                    {hit.type === 'heading' ? (
                      <Hash className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {hit.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {hit.excerpt || hit.sectionTitle}
                      </span>
                    </span>
                    <ArrowRight
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-opacity',
                        index === selectedIndex ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
