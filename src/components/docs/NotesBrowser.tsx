import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { DocsMobileNav } from '@/components/docs/DocsMobileNav';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';
import { DocsSearch } from '@/components/docs/DocsSearch';
import { TableOfContents } from '@/components/docs/TableOfContents';
import { StatusBadge } from '@/components/notes/StatusBadge';
import type { Note, NoteSection } from '@/content/collection';
import { toDocSections } from '@/content/navigation';
import { REPO_EDIT_BASE } from '@/content/site';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ChevronLeft, ChevronRight, Edit, Languages, Search } from 'lucide-react';

interface NotesBrowserProps {
  sections: NoteSection[];
  notes: Note[];
  getNote: (sectionId?: string, itemId?: string) => Note | undefined;
  /** 移动端抽屉标题 */
  navTitle: string;
  /** 复习计划才有进度/日程标签，资料那套没有 */
  showProgress?: boolean;
  /** 这套内容的身份（docs / library），侧边栏展开状态按它分开存 */
  storageKey: string;
}

/**
 * 「侧边栏 + 正文 + 目录」这一套笔记浏览界面。
 * /docs（复习计划）和 /library（面试资料）共用，只是喂进来的内容集合不同。
 */
export function NotesBrowser({
  sections,
  notes,
  getNote,
  navTitle,
  showProgress = false,
  storageKey,
}: NotesBrowserProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const docSections = useMemo(() => toDocSections(sections), [sections]);
  const flattenedNav = useMemo(
    () =>
      notes.map((note) => ({
        sectionId: note.sectionId,
        itemId: note.itemId,
        title: note.titleEn ?? note.title,
      })),
    [notes]
  );

  const [activeSection, setActiveSection] = useState(
    searchParams.get('section') || sections[0]?.id || 'overview'
  );
  const [activeItem, setActiveItem] = useState<string | undefined>(
    searchParams.get('item') || undefined
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const note = useMemo(
    () => getNote(activeSection, activeItem),
    [getNote, activeSection, activeItem]
  );

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('section', activeSection);
    if (note?.itemId) {
      params.set('item', note.itemId);
    }
    setSearchParams(params, { replace: true });
    // 滚动位置交给 RouteMemory：新的一篇从头看，看过的回到上次停的地方
  }, [activeSection, activeItem, note, setSearchParams]);

  // 站点只讲英文。还没翻的那一篇给中文原文兜底 —— 空页面比一页中文糟得多
  const hasEnglish = Boolean(note?.contentEn);
  const body = note?.contentEn ?? note?.content;

  // Cmd+K / Ctrl+K 打开搜索
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = useCallback((sectionId: string, itemId?: string) => {
    setActiveSection(sectionId);
    setActiveItem(itemId);
  }, []);

  const currentIndex = flattenedNav.findIndex(
    (nav) => nav.sectionId === note?.sectionId && nav.itemId === note?.itemId
  );
  const prevNav = currentIndex > 0 ? flattenedNav[currentIndex - 1] : null;
  const nextNav =
    currentIndex >= 0 && currentIndex < flattenedNav.length - 1
      ? flattenedNav[currentIndex + 1]
      : null;

  return (
    <div className="min-h-screen bg-background">
      <DocsSearch
        notes={notes}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigate}
      />

      <div className="pt-20 md:pt-24">
        <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-4">
          <div className="flex gap-8 py-4 sm:py-6">
            {/* 侧边栏：钉在视口里，导航树自己滚，不跟正文一起走 */}
            <div className="sticky top-[7.5rem] hidden h-[calc(100vh-8.5rem)] w-64 shrink-0 flex-col lg:flex lg:w-72">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="w-full mb-4 shrink-0 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-sm"
              >
                <Search className="w-4 h-4" />
                <span className="flex-1 text-left">Search notes</span>
                <kbd className="text-xs px-1.5 py-0.5 rounded bg-background border border-border">⌘K</kbd>
              </button>
              <DocsSidebar
                sections={docSections}
                activeSection={activeSection}
                activeItem={note?.itemId}
                onNavigate={handleNavigate}
                storageKey={storageKey}
                persistScroll
              />
            </div>

            {/* 正文 */}
            <main className="min-w-0 flex-1">
              <motion.article
                key={`${note?.sectionId}-${note?.itemId}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="max-w-none xl:max-w-4xl"
              >
                {showProgress && note && (
                  <div className="mb-6 flex flex-wrap items-center gap-2">
                    <StatusBadge status={note.status} />
                    {note.day >= 1 && note.day <= 14 && (
                      <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                        Day {note.day}
                      </span>
                    )}
                    {note.level && note.level !== '—' && (
                      <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                        Level {note.level}
                      </span>
                    )}
                  </div>
                )}

                {note && !hasEnglish && (
                  <div className="mb-6 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <Languages className="h-3.5 w-3.5 shrink-0" />
                    Not translated yet — showing the original Chinese draft.
                  </div>
                )}

                <div className="pb-8">
                  <MarkdownRenderer content={body ?? '# Page not found\n\nThat note does not exist.'} />
                </div>

                <div className="mt-8 border-t border-border pt-6 pb-24 lg:pb-0">
                  <div className="mb-8 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    {note && (
                      <a
                        href={`${REPO_EDIT_BASE}/${note.sourcePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        Edit this page on GitHub
                      </a>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                    {prevNav ? (
                      <button
                        onClick={() => handleNavigate(prevNav.sectionId, prevNav.itemId)}
                        className="group flex flex-col items-start rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50"
                      >
                        <span className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                          Previous
                        </span>
                        <span className="font-medium text-foreground break-words">{prevNav.title}</span>
                      </button>
                    ) : (
                      <div />
                    )}

                    {nextNav ? (
                      <button
                        onClick={() => handleNavigate(nextNav.sectionId, nextNav.itemId)}
                        className="group flex flex-col items-start rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 sm:items-end sm:text-right"
                      >
                        <span className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                          Next
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </span>
                        <span className="font-medium text-foreground break-words">{nextNav.title}</span>
                      </button>
                    ) : (
                      <div />
                    )}
                  </div>
                </div>
              </motion.article>
            </main>

            {/* 目录 */}
            <div className="hidden xl:block w-56 shrink-0">
              <div className="sticky top-36">
                <TableOfContents content={body ?? ''} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <DocsMobileNav
        sections={docSections}
        activeSection={activeSection}
        activeItem={note?.itemId}
        onNavigate={handleNavigate}
        title={navTitle}
        storageKey={storageKey}
        content={body}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      <SiteFooter />
    </div>
  );
}
