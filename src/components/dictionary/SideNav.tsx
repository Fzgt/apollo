import { cn } from "@/lib/utils";

/**
 * 生词页的左侧导航。
 *
 * 两份词表原来是页面顶部一条通栏页签，下面再跟一行标签胶囊——切词库和筛分类
 * 是两件事，却挤在一起，而且各占一整行高度，词表被压到很下面。
 * 挪到左边之后：上半截切词库，下半截筛分类，都不再和词表抢纵向空间。
 *
 * 窄屏没有侧栏，回落成页面顶部的横向胶囊，见 DictionaryPage。
 */
export interface SideNavItem {
  key: string;
  label: string;
  count?: number;
}

export function SideNav({
  sections,
}: {
  sections: Array<{
    title: string;
    items: SideNavItem[];
    activeKey: string | null;
    onSelect: (key: string) => void;
  }>;
}) {
  return (
    <nav className="sticky top-24 space-y-5">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {section.title}
          </p>
          {section.items.map((item) => {
            const active = section.activeKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => section.onSelect(item.key)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="truncate">{item.label}</span>
                {item.count !== undefined && (
                  <span className="shrink-0 text-xs tabular-nums opacity-60">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
