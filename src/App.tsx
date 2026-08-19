import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SiteNavbar } from '@/components/layout/SiteNavbar';
import { SITE_NAME, SITE_TAGLINE } from '@/content/site';
import { EditProvider } from '@/lib/edit-store';
import NotFound from './pages/NotFound';

const HomePage = lazy(() => import('./pages/HomePage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));

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

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      加载中…
    </div>
  );
}

const App = () => (
  <EditProvider>
    <TooltipProvider>
      <PageMeta />
      <ScrollToTop />
      <Toaster />
      <Sonner />
      <SiteNavbar />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </TooltipProvider>
  </EditProvider>
);

export default App;
