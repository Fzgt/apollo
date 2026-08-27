import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Search, X } from 'lucide-react';
import { DocsSidebar } from './DocsSidebar';
import type { DocSection } from '@/content/navigation';
import { plainHeadingText, scanHeadings } from '@/lib/headings';
import { cn, scrollToAnchor } from '@/lib/utils';

interface DocsMobileNavProps {
  sections: DocSection[];
  activeSection: string;
  activeItem?: string;
  onNavigate: (sectionId: string, itemId?: string) => void;
  /** 抽屉头部的标题，缺省是「笔记」 */
  title?: string;
  /** 和桌面侧栏共用一份展开状态 */
  storageKey: string;
  /** 当前这一篇的原文，用来在手机上给出「本页目录」 */
  content?: string;
  /** 打开搜索面板。手机上没有 ⌘K，只能从这里进 */
  onOpenSearch?: () => void;
}

type Tab = 'toc' | 'notes';

export function DocsMobileNav({
  sections,
  activeSection,
  activeItem,
  onNavigate,
  title = 'Notes',
  storageKey,
  content,
  onOpenSearch,
}: DocsMobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('toc');

  // 和正文、桌面目录同一个纯函数，算出来的 id 必须逐字一致
  const headings = useMemo(
    () =>
      scanHeadings(content ?? '')
        .filter((h) => h.level <= 3)
        .map((h) => ({ id: h.id, text: plainHeadingText(h.text), level: h.level })),
    [content]
  );

  // 一篇没有小标题的短笔记不该显示空目录页签，直接落到笔记树
  const hasToc = headings.length > 0;
  const activeTab: Tab = hasToc ? tab : 'notes';

  const handleNavigate = (sectionId: string, itemId?: string) => {
    onNavigate(sectionId, itemId);
    setIsOpen(false);
  };

  const handleJump = (id: string) => {
    setIsOpen(false);
    // 等抽屉退场动画走完再滚，否则 overlay 还盖着、smooth 滚动会被打断
    setTimeout(() => scrollToAnchor(id), 200);
  };

  return (
    <>
      {/* 悬浮入口：贴着安全区，避开 iPhone 底部的 home indicator */}
      <button
        onClick={() => setIsOpen(true)}
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        className="lg:hidden fixed right-4 z-40 p-4 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="Open note navigation"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col bg-background border-r border-border shadow-xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
                <span className="font-semibold text-foreground">{title}</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Close note navigation"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {onOpenSearch && (
                <div className="shrink-0 px-4 pt-4">
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onOpenSearch();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Search className="h-4 w-4" />
                    <span className="flex-1 text-left">Search notes</span>
                  </button>
                </div>
              )}

              {hasToc && (
                <div className="mx-4 mt-4 flex shrink-0 rounded-lg bg-muted/50 p-1 text-sm">
                  {(
                    [
                      { id: 'toc', label: 'On this page' },
                      { id: 'notes', label: 'All notes' },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setTab(option.id)}
                      className={cn(
                        'flex-1 rounded-md py-1.5 font-medium transition-colors',
                        activeTab === option.id
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              {/* 抽屉里只有这一层滚动，页签切换不会把滚动位置带过去 */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                {activeTab === 'toc' ? (
                  <ul className="space-y-1">
                    {headings.map((heading) => (
                      <li key={heading.id} style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}>
                        <button
                          onClick={() => handleJump(heading.id)}
                          className="w-full rounded-md px-2 py-2 text-left text-sm leading-6 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          {heading.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <DocsSidebar
                    sections={sections}
                    activeSection={activeSection}
                    activeItem={activeItem}
                    onNavigate={handleNavigate}
                    storageKey={storageKey}
                  />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
