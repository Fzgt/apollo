import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, RefreshCw, Search } from 'lucide-react';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';
import { TableOfContents } from '@/components/docs/TableOfContents';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { BLOG_ISSUES_URL, BLOG_REPO } from '@/content/site';
import {
  fetchLiveIndex,
  formatDate,
  getCachedLiveIndex,
  loadPostBody,
  loadSnapshotIndex,
  type BlogIndex,
  type BlogPostMeta,
} from '@/lib/blog';
import { cn } from '@/lib/utils';

/** 标签点显示 GitHub 上那个颜色；文字仍走主题色，白色标签在浅色背景上才不会消失 */
function LabelChip({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground',
        className
      )}
    >
      {color && (
        <span
          className="h-2 w-2 shrink-0 rounded-full ring-1 ring-border"
          style={{ backgroundColor: `#${color}` }}
        />
      )}
      {name}
    </span>
  );
}

function matchesQuery(post: BlogPostMeta, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [post.title, post.excerpt, `#${post.number}`, ...post.labels.map((l) => l.name)]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export default function BlogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeNumber = Number(searchParams.get('post')) || null;

  const [index, setIndex] = useState<BlogIndex | null>(() => getCachedLiveIndex());
  const [indexError, setIndexError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  /** 实时同步失败的原因；快照仍然在用，所以只是提示，不是错误页 */
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const [body, setBody] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [isBodyLoading, setIsBodyLoading] = useState(false);

  const syncControllerRef = useRef<AbortController | null>(null);

  const syncLive = useCallback(async () => {
    syncControllerRef.current?.abort();
    const controller = new AbortController();
    syncControllerRef.current = controller;

    setIsSyncing(true);
    setSyncNote(null);
    try {
      const live = await fetchLiveIndex(controller.signal);
      if (!controller.signal.aborted) {
        setIndex(live);
        setIndexError(null);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setSyncNote(error instanceof Error ? error.message : '同步失败');
      }
    } finally {
      if (!controller.signal.aborted) setIsSyncing(false);
    }
  }, []);

  // 先上快照（随站点发布，秒开），再后台向 GitHub 要最新的
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      if (!getCachedLiveIndex()) {
        try {
          const snapshot = await loadSnapshotIndex(controller.signal);
          if (!controller.signal.aborted) {
            setIndex((prev) => prev ?? snapshot);
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            setIndexError(error instanceof Error ? error.message : '快照读取失败');
          }
        }
      }
      if (!controller.signal.aborted) await syncLive();
    })();

    return () => {
      controller.abort();
      syncControllerRef.current?.abort();
    };
  }, [syncLive]);

  const posts = useMemo(() => index?.posts ?? [], [index]);

  const labels = useMemo(() => {
    const counts = new Map<string, { name: string; color: string; count: number }>();
    for (const post of posts) {
      for (const label of post.labels) {
        const entry = counts.get(label.name);
        if (entry) entry.count += 1;
        else counts.set(label.name, { name: label.name, color: label.color, count: 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [posts]);

  const visiblePosts = useMemo(
    () =>
      posts.filter(
        (post) =>
          matchesQuery(post, query) &&
          (!activeLabel || post.labels.some((label) => label.name === activeLabel))
      ),
    [posts, query, activeLabel]
  );

  const activePost = useMemo(
    () => (activeNumber ? posts.find((post) => post.number === activeNumber) : undefined),
    [posts, activeNumber]
  );

  const openPost = useCallback(
    (number: number | null) => {
      const params = new URLSearchParams();
      if (number) params.set('post', String(number));
      setSearchParams(params, { replace: false });
      window.scrollTo(0, 0);
    },
    [setSearchParams]
  );

  // 正文按需拉：内存里有就直接用，没有就取快照里的单篇文件
  useEffect(() => {
    if (!activeNumber) {
      setBody(null);
      setBodyError(null);
      return;
    }

    const controller = new AbortController();
    setIsBodyLoading(true);
    setBodyError(null);

    loadPostBody(activeNumber, controller.signal)
      .then((content) => {
        if (!controller.signal.aborted) setBody(content);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setBodyError(error instanceof Error ? error.message : '正文读取失败');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsBodyLoading(false);
      });

    return () => controller.abort();
  }, [activeNumber]);

  const syncedLabel = index
    ? `${index.source === 'live' ? '刚从 GitHub 同步' : '快照'} · ${formatDate(index.syncedAt)}`
    : '读取中…';

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-20 md:pt-24">
        <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-4">
          {/* 页头 */}
          <div className="flex flex-col gap-3 border-b border-border py-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">博客</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                文章写在{' '}
                <a
                  href={BLOG_ISSUES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  {BLOG_REPO}
                </a>{' '}
                的 issues 里，这里自动同步 · 共 {posts.length} 篇
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{syncedLabel}</span>
              <button
                onClick={syncLive}
                disabled={isSyncing}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
                {isSyncing ? '同步中' : '同步'}
              </button>
            </div>
          </div>

          {syncNote && (
            <p className="mt-3 text-xs text-muted-foreground">
              实时同步没成功（{syncNote}），当前显示的是构建时的快照。
            </p>
          )}

          <div className="flex gap-8 py-6">
            {/* 侧栏：搜索 + 标签 + 全部文章 */}
            <aside className="hidden w-64 shrink-0 lg:block xl:w-72">
              <div className="sticky top-24 max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto pb-8 pr-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索文章"
                    aria-label="搜索文章"
                    className="w-full rounded-lg border border-border bg-muted/50 py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
                  />
                </div>

                {labels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setActiveLabel(null)}
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-xs transition-colors',
                        activeLabel === null
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      全部
                    </button>
                    {labels.map((label) => (
                      <button
                        key={label.name}
                        onClick={() =>
                          setActiveLabel((prev) => (prev === label.name ? null : label.name))
                        }
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors',
                          activeLabel === label.name
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {label.color && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full ring-1 ring-border"
                            style={{ backgroundColor: `#${label.color}` }}
                          />
                        )}
                        {label.name}
                        <span className="opacity-60">{label.count}</span>
                      </button>
                    ))}
                  </div>
                )}

                <nav className="space-y-0.5">
                  {visiblePosts.map((post) => (
                    <button
                      key={post.number}
                      onClick={() => openPost(post.number)}
                      className={cn(
                        'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        post.number === activeNumber
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {post.title}
                    </button>
                  ))}
                  {visiblePosts.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">没有匹配的文章</p>
                  )}
                </nav>
              </div>
            </aside>

            {/* 正文 / 列表 */}
            <main className="min-w-0 flex-1">
              {indexError && !index && (
                <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                  文章列表没读出来：{indexError}
                </p>
              )}

              {!index && !indexError && (
                <p className="py-12 text-center text-sm text-muted-foreground">加载中…</p>
              )}

              {index && !activeNumber && (
                <div className="space-y-6">
                  {/* 小屏没有侧栏，搜索和标签在这里 */}
                  <div className="space-y-3 lg:hidden">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="搜索文章"
                        aria-label="搜索文章"
                        className="w-full rounded-lg border border-border bg-muted/50 py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setActiveLabel(null)}
                        className={cn(
                          'rounded-md border px-2 py-0.5 text-xs transition-colors',
                          activeLabel === null
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border bg-muted/50 text-muted-foreground'
                        )}
                      >
                        全部
                      </button>
                      {labels.map((label) => (
                        <button
                          key={label.name}
                          onClick={() =>
                            setActiveLabel((prev) => (prev === label.name ? null : label.name))
                          }
                          className={cn(
                            'rounded-md border px-2 py-0.5 text-xs transition-colors',
                            activeLabel === label.name
                              ? 'border-primary/40 bg-primary/10 text-primary'
                              : 'border-border bg-muted/50 text-muted-foreground'
                          )}
                        >
                          {label.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {visiblePosts.length === 0 ? (
                    <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                      没有匹配的文章。
                    </p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {visiblePosts.map((post) => (
                        <button
                          key={post.number}
                          onClick={() => openPost(post.number)}
                          // min-w-0：摘要用了 line-clamp（-webkit-box），
                          // 不给最小宽度归零的话，网格项会按不换行的宽度撑破小屏
                          className="group flex h-full w-full min-w-0 flex-col items-start rounded-xl border border-border bg-card p-5 text-left transition-colors hover:bg-muted/40"
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>#{post.number}</span>
                            <span>{formatDate(post.createdAt)}</span>
                          </div>
                          <h2 className="mb-2 w-full break-words font-semibold text-foreground group-hover:text-primary">
                            {post.title}
                          </h2>
                          {post.excerpt && (
                            <p className="mb-3 line-clamp-3 w-full break-words text-sm leading-6 text-muted-foreground">
                              {post.excerpt}
                            </p>
                          )}
                          {post.labels.length > 0 && (
                            <div className="mt-auto flex flex-wrap gap-1.5">
                              {post.labels.map((label) => (
                                <LabelChip key={label.name} name={label.name} color={label.color} />
                              ))}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {index && activeNumber && (
                <motion.article
                  key={activeNumber}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-none xl:max-w-4xl"
                >
                  <button
                    onClick={() => openPost(null)}
                    className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    全部文章
                  </button>

                  {activePost && (
                    <div className="mb-6">
                      <h1 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">
                        {activePost.title}
                      </h1>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>#{activePost.number}</span>
                        <span>写于 {formatDate(activePost.createdAt)}</span>
                        {activePost.updatedAt !== activePost.createdAt && (
                          <span>改于 {formatDate(activePost.updatedAt)}</span>
                        )}
                        {activePost.labels.map((label) => (
                          <LabelChip key={label.name} name={label.name} color={label.color} />
                        ))}
                      </div>
                    </div>
                  )}

                  {isBodyLoading && (
                    <p className="py-12 text-center text-sm text-muted-foreground">加载中…</p>
                  )}

                  {bodyError && (
                    <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                      {bodyError}。可以到{' '}
                      <a
                        href={`${BLOG_ISSUES_URL}/${activeNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-4"
                      >
                        GitHub 上看原文
                      </a>
                      。
                    </p>
                  )}

                  {!isBodyLoading && !bodyError && body !== null && (
                    <div className="pb-8">
                      <MarkdownRenderer content={body} />
                    </div>
                  )}

                  {activePost && (
                    <div className="mt-8 border-t border-border pt-6">
                      <a
                        href={activePost.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                        在 GitHub 上看这篇
                      </a>
                    </div>
                  )}
                </motion.article>
              )}
            </main>

            {/* 目录 */}
            {activeNumber && body && (
              <div className="hidden w-56 shrink-0 xl:block">
                <div className="sticky top-36">
                  <TableOfContents content={body} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
