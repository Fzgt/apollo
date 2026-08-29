import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Search,
  SearchX,
} from 'lucide-react';
import { PostRow } from '@/components/blog/PostRow';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { BLOG_ISSUES_URL, BLOG_REPO } from '@/content/site';
import { useReadPosts } from '@/hooks/use-read-posts';
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
import { labelText } from '@/content/blog-en';

// 正文渲染（react-markdown + prism）和目录只在点开文章时才需要，
// 静态引入会让列表页白白多下 150kB+，所以拆成按需加载。
const MarkdownRenderer = lazy(() =>
  import('@/components/docs/MarkdownRenderer').then((m) => ({ default: m.MarkdownRenderer }))
);
const TableOfContents = lazy(() =>
  import('@/components/docs/TableOfContents').then((m) => ({ default: m.TableOfContents }))
);

/** 入场动画只给首屏这些条，再往下滚出来的不抖 */
const ENTRANCE_LIMIT = 20;

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
        active
          ? 'border-primary/50 bg-primary/15 font-medium text-primary'
          : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/30 hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function matchesQuery(post: BlogPostMeta, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    post.title,
    post.excerpt,
    ...(post.headings ?? []),
    `#${post.number}`,
    ...post.labels.map((l) => `${l.name} ${labelText(l.name)}`),
  ]
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
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [body, setBody] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [isBodyLoading, setIsBodyLoading] = useState(false);

  const { readPosts, markRead, toggleRead } = useReadPosts();
  const syncControllerRef = useRef<AbortController | null>(null);
  const entranceSettled = useRef(false);

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
        setSyncNote(error instanceof Error ? error.message : 'Sync failed');
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
            setIndexError(error instanceof Error ? error.message : 'Could not read the snapshot');
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

  useEffect(() => {
    entranceSettled.current = true;
  }, []);

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
          (!activeLabel || post.labels.some((label) => label.name === activeLabel)) &&
          (!unreadOnly || !readPosts.has(post.number))
      ),
    [posts, query, activeLabel, unreadOnly, readPosts]
  );

  const activePost = useMemo(
    () => (activeNumber ? posts.find((post) => post.number === activeNumber) : undefined),
    [posts, activeNumber]
  );

  const activeIndexInList = activePost ? posts.indexOf(activePost) : -1;
  const prevPost = activeIndexInList > 0 ? posts[activeIndexInList - 1] : null;
  const nextPost =
    activeIndexInList >= 0 && activeIndexInList < posts.length - 1
      ? posts[activeIndexInList + 1]
      : null;

  const openPost = useCallback(
    (number: number | null) => {
      const params = new URLSearchParams();
      if (number) params.set('post', String(number));
      setSearchParams(params, { replace: false });
      // 滚动位置交给 RouteMemory：回列表时还停在刚才那条上
    },
    [setSearchParams]
  );

  const resetFilters = useCallback(() => {
    setQuery('');
    setActiveLabel(null);
    setUnreadOnly(false);
  }, []);

  // 正文按需拉：内存里有就直接用，没有就取快照里的单篇文件
  useEffect(() => {
    if (!activeNumber) {
      setBody(null);
      setBodyError(null);
      return;
    }

    markRead(activeNumber);

    const controller = new AbortController();
    setIsBodyLoading(true);
    setBodyError(null);

    loadPostBody(activeNumber, controller.signal)
      .then((content) => {
        if (!controller.signal.aborted) setBody(content);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setBodyError(error instanceof Error ? error.message : 'Could not read the post body');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsBodyLoading(false);
      });

    return () => controller.abort();
  }, [activeNumber, markRead]);

  const isFiltered = visiblePosts.length !== posts.length;
  const syncedLabel = index
    ? `${index.source === 'live' ? 'Just synced from GitHub' : 'Snapshot'} · ${formatDate(index.syncedAt)}`
    : 'Loading…';

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-20 md:pt-24">
        <div
          className={cn(
            'container mx-auto px-4 sm:px-6 lg:px-4',
            activeNumber ? 'max-w-[1400px]' : 'max-w-5xl'
          )}
        >
          {/* 页头 */}
          <div className="flex flex-col gap-3 border-b border-border py-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">Blog</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Posts live in the issues of{' '}
                <a
                  href={BLOG_ISSUES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  {BLOG_REPO}
                </a>{' '}
                , synced automatically · {posts.length} posts
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
                {isSyncing ? 'Syncing' : 'Sync'}
              </button>
            </div>
          </div>

          {syncNote && (
            <p className="mt-3 text-xs text-muted-foreground">
              Live sync failed ({syncNote}); showing the build-time snapshot.
            </p>
          )}

          <div className="py-6">
            {indexError && !index && (
              <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                Could not read the post list: {indexError}
              </p>
            )}

            {!index && !indexError && (
              <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
            )}

            {/* 列表 */}
            {index && !activeNumber && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search titles, summaries, tags…"
                    aria-label="Search posts"
                    className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-28 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/40"
                  />
                  {posts.length > 0 && (
                    <div
                      title={
                        isFiltered
                          ? `${visiblePosts.length} of ${posts.length} posts`
                          : undefined
                      }
                      className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-baseline gap-1 text-xs tabular-nums"
                    >
                      {isFiltered && <span className="text-muted-foreground">showing</span>}
                      <motion.span
                        key={visiblePosts.length}
                        initial={{ opacity: 0, y: -3 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          'font-semibold',
                          isFiltered ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {visiblePosts.length}
                      </motion.span>
                      <span className="text-muted-foreground">
                        {isFiltered ? `/ ${posts.length}` : 'posts'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {labels.map((label) => {
                    const active = activeLabel === label.name;
                    return (
                      <Chip
                        key={label.name}
                        active={active}
                        onClick={() => setActiveLabel(active ? null : label.name)}
                      >
                        {label.color && (
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: `#${label.color}` }}
                          />
                        )}
                        {labelText(label.name)}
                        <span className="tabular-nums opacity-60">{label.count}</span>
                      </Chip>
                    );
                  })}
                  <span className="mx-1 h-4 w-px bg-border" />
                  <Chip
                    active={unreadOnly}
                    onClick={() => setUnreadOnly((prev) => !prev)}
                    title="Show unread only"
                  >
                    Unread only
                  </Chip>
                </div>

                {visiblePosts.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                    <SearchX className="size-8" />
                    <p className="text-sm">
                      {posts.length} posts in total, but none match the current filters
                    </p>
                    <button
                      onClick={resetFilters}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted hover:text-foreground"
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  <motion.div
                    layout
                    className="overflow-hidden rounded-xl border border-border bg-card"
                  >
                    {visiblePosts.map((post, rowIndex) => (
                      <PostRow
                        key={post.number}
                        post={post}
                        index={rowIndex}
                        animateEntrance={!entranceSettled.current && rowIndex < ENTRANCE_LIMIT}
                        isRead={readPosts.has(post.number)}
                        onOpen={openPost}
                        onToggleRead={toggleRead}
                      />
                    ))}
                  </motion.div>
                )}
              </div>
            )}

            {/* 正文 */}
            {index && activeNumber && (
              <div className="flex gap-8">
                <main className="min-w-0 flex-1">
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
                      All posts
                    </button>

                    {activePost && (
                      <div className="mb-6">
                        <h1 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">
                          {activePost.title}
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>#{activePost.number}</span>
                          <span>Written {formatDate(activePost.createdAt)}</span>
                          {activePost.updatedAt !== activePost.createdAt && (
                            <span>Updated {formatDate(activePost.updatedAt)}</span>
                          )}
                          {activePost.labels.map((label) => (
                            <span
                              key={label.name}
                              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
                            >
                              {label.color && (
                                <span
                                  className="size-2 shrink-0 rounded-full ring-1 ring-border"
                                  style={{ backgroundColor: `#${label.color}` }}
                                />
                              )}
                              {labelText(label.name)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {isBodyLoading && (
                      <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
                    )}

                    {bodyError && (
                      <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                        {bodyError}. You can open it{' '}
                        <a
                          href={`${BLOG_ISSUES_URL}/${activeNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-4"
                        >
                          on GitHub
                        </a>
                        .
                      </p>
                    )}

                    {!isBodyLoading && !bodyError && body !== null && (
                      <div className="pb-8">
                        <Suspense
                          fallback={<p className="text-sm text-muted-foreground">Rendering…</p>}
                        >
                          <MarkdownRenderer content={body} />
                        </Suspense>
                      </div>
                    )}

                    <div className="mt-8 border-t border-border pt-6">
                      {activePost && (
                        <a
                          href={activePost.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <ExternalLink className="h-4 w-4" />
                          on GitHub
                        </a>
                      )}

                      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                        {prevPost ? (
                          <button
                            onClick={() => openPost(prevPost.number)}
                            className="group flex flex-col items-start rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50"
                          >
                            <span className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
                              <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                              Previous
                            </span>
                            <span className="break-words font-medium text-foreground">
                              {prevPost.title}
                            </span>
                          </button>
                        ) : (
                          <div />
                        )}

                        {nextPost ? (
                          <button
                            onClick={() => openPost(nextPost.number)}
                            className="group flex flex-col items-start rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 sm:items-end sm:text-right"
                          >
                            <span className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
                              Next
                              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </span>
                            <span className="break-words font-medium text-foreground">
                              {nextPost.title}
                            </span>
                          </button>
                        ) : (
                          <div />
                        )}
                      </div>
                    </div>
                  </motion.article>
                </main>

                {body && (
                  <div className="hidden w-56 shrink-0 xl:block">
                    <div className="sticky top-36">
                      <Suspense fallback={null}>
                        <TableOfContents content={body} />
                      </Suspense>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
