import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { readSession, writeSession } from '@/lib/session-state';
import type { DocSection } from '@/content/navigation';
import { useLang } from '@/lib/i18n';

interface DocsSidebarProps {
  sections: DocSection[];
  activeSection: string;
  activeItem?: string;
  onNavigate: (sectionId: string, itemId?: string) => void;
  /** 这份目录的身份（docs / library），展开状态按它分开存 */
  storageKey: string;
  /** 只有桌面端那份常驻侧栏才记自己的滚动位置；抽屉里那份每次都是新开的 */
  persistScroll?: boolean;
}

export function DocsSidebar({
  sections,
  activeSection,
  activeItem,
  onNavigate,
  storageKey,
  persistScroll = false,
}: DocsSidebarProps) {
  const { lang } = useLang();
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    const saved = readSession<unknown>(`sidebar:${storageKey}`, null);
    return Array.isArray(saved) ? (saved as string[]) : [activeSection];
  });

  useEffect(() => {
    writeSession(`sidebar:${storageKey}`, expandedSections);
  }, [storageKey, expandedSections]);

  const asideRef = useRef<HTMLElement>(null);
  const asideScroll = useRef(0);

  useLayoutEffect(() => {
    const el = asideRef.current;
    if (!el || !persistScroll) return;

    el.scrollTop = readSession<number>(`sidebar-scroll:${storageKey}`, 0);
    asideScroll.current = el.scrollTop;

    const save = () => writeSession(`sidebar-scroll:${storageKey}`, asideScroll.current);
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('pagehide', save);
      save();
    };
  }, [storageKey, persistScroll]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleSectionClick = (sectionId: string) => {
    toggleSection(sectionId);
    onNavigate(sectionId);
  };

  const handleItemClick = (sectionId: string, itemId: string) => {
    onNavigate(sectionId, itemId);
  };

  return (
    <aside
      ref={asideRef}
      onScroll={(e) => {
        asideScroll.current = e.currentTarget.scrollTop;
      }}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
    >
      <nav className="space-y-1 pb-4">
        {sections.map((section) => {
          const isExpanded = expandedSections.includes(section.id);
          const isActive = activeSection === section.id;
          const hasItems = section.items && section.items.length > 0;

          return (
            <div key={section.id}>
              <button
                onClick={() => handleSectionClick(section.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200',
                  isActive && !activeItem
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {section.icon && (
                  <span className="text-primary/70">{section.icon}</span>
                )}
                <span className="flex-1 text-sm">{section.title}</span>
                {hasItems && (
                  <motion.span
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </motion.span>
                )}
              </button>

              <AnimatePresence initial={false}>
                {hasItems && isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-6 mt-1 space-y-0.5 border-l border-border pl-3">
                      {section.items?.map((item) => {
                        const isItemActive = activeSection === section.id && activeItem === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleItemClick(section.id, item.id)}
                            className={cn(
                              'w-full flex items-start gap-2 text-left px-3 py-2 rounded-lg text-sm transition-all duration-200',
                              isItemActive
                                ? 'bg-primary/10 text-primary font-medium'
                                : item.tier === 'must'
                                  ? 'text-foreground/90 hover:bg-muted hover:text-foreground'
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                          >
                            {/* 必看用实心点，速查和拓展用空心点，日程页不带点 */}
                            {item.tier && (
                              <span
                                aria-hidden
                                className={cn(
                                  'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full border',
                                  item.tier === 'must'
                                    ? 'border-primary bg-primary'
                                    : 'border-muted-foreground/50 bg-transparent'
                                )}
                              />
                            )}
                            <span className="flex-1">{item.title}</span>
                            {/* 不在简历上的笔记单独标一下，别让它看起来像多出来的一条 bullet */}
                            {item.tier === 'extend' && (
                              <span className="mt-0.5 shrink-0 rounded border border-border px-1 text-[10px] leading-4 text-muted-foreground">
                                {lang === 'en' ? 'Extra' : '拓展'}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
