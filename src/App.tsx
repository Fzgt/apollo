import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { SiteNavbar } from '@/components/layout/SiteNavbar';
import { RouteMemory } from '@/components/layout/RouteMemory';
import { WordCapture } from '@/components/dictionary/WordCapture';
import { SITE_NAME, SITE_TAGLINE } from '@/content/site';
import { UI } from '@/content/ui';
import { useLang } from '@/lib/i18n';
import NotFound from './pages/NotFound';

const HomePage = lazy(() => import('./pages/HomePage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const QuestionsPage = lazy(() => import('./pages/QuestionsPage'));
const ApplicationsPage = lazy(() => import('./pages/ApplicationsPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const ResumePage = lazy(() => import('./pages/ResumePage'));
const DictionaryPage = lazy(() => import('./pages/DictionaryPage'));
const SharedResumePage = lazy(() => import('./pages/SharedResumePage'));

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
  const { t } = useLang();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      {t(UI.common.loading)}
    </div>
  );
}

// 注：模板自带的 Toaster / Sonner / TooltipProvider 站里一处没用到，
// 却把整个 @radix-ui（180kB+）拖进首屏。真要用回来再挂。
/**
 * /cv 是对外分享的简历页：拿到链接的人不该看到复习笔记、资料、博客，
 * 也不该看到导航里那个指向仓库的 GitHub 图标。所以这条路径不挂导航栏。
 */
const CHROMELESS_ROUTES = ['/cv'];

const App = () => {
  const { pathname } = useLocation();
  const bare = CHROMELESS_ROUTES.includes(pathname);

  return (
  <>
    <PageMeta />
    <RouteMemory />
    {!bare && <SiteNavbar />}
    {!bare && <WordCapture />}
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/questions" element={<QuestionsPage />} />
        <Route path="/apply" element={<ApplicationsPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/words" element={<DictionaryPage />} />
        <Route path="/resume" element={<ResumePage />} />
        <Route path="/cv" element={<SharedResumePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </>
  );
};

export default App;
