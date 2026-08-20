import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { SiteNavbar } from '@/components/layout/SiteNavbar';
import { RouteMemory } from '@/components/layout/RouteMemory';
import { SITE_NAME, SITE_TAGLINE } from '@/content/site';
import NotFound from './pages/NotFound';

const HomePage = lazy(() => import('./pages/HomePage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));

/** 私人笔记站：设个标题，顺手挂上 noindex */
function PageMeta() {
  useEffect(() => {
    document.title = `${SITE_NAME} · ${SITE_TAGLINE}`;

    let robots = document.head.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = 'noindex, nofollow';
  }, []);

  return null;
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      加载中…
    </div>
  );
}

// 注：模板自带的 Toaster / Sonner / TooltipProvider 站里一处没用到，
// 却把整个 @radix-ui（180kB+）拖进首屏。真要用回来再挂。
const App = () => (
  <>
    <PageMeta />
    <RouteMemory />
    <SiteNavbar />
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </>
);

export default App;
