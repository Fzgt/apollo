import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookMarked,
  BookOpen,
  CalendarCheck,
  FileText,
  Github,
  LayoutDashboard,
  Menu,
  MessageCircleQuestion,
  Languages,
  Moon,
  PawPrint,
  PenLine,
  Send,
  Sun,
  X,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useLang } from '@/lib/i18n';
import { REPO_URL, SITE_NAME } from '@/content/site';
import { UI } from '@/content/ui';
import { lastTabUrl } from '@/lib/session-state';
import { BuildStamp } from './BuildStamp';

/**
 * href 同时是页签的身份：路由记忆按它存「上次停在哪」。
 *
 * 七个两字词并排是认不出来的——尤其「复习」和「资料」，两页都是 markdown 笔记，
 * 光看词分不出差别。所以按各自真正的区别命名：
 * /docs 是按天排的复习计划（有日程有进度），/library 是按公司分的项目笔记（只有正文）。
 * 图标是第二条线索，扫一眼靠形状就能定位，不必逐字读。
 */
const NAV_LINKS = [
  { label: UI.nav.overview, href: '/', Icon: LayoutDashboard },
  { label: UI.nav.plan, href: '/docs', Icon: CalendarCheck },
  { label: UI.nav.notes, href: '/library', Icon: BookOpen },
  { label: UI.nav.questions, href: '/questions', Icon: MessageCircleQuestion },
  { label: UI.nav.fetch, href: '/fetch', Icon: PawPrint },
  { label: UI.nav.applications, href: '/apply', Icon: Send },
  { label: UI.nav.blog, href: '/blog', Icon: PenLine },
  { label: UI.nav.words, href: '/words', Icon: BookMarked },
  { label: UI.nav.resume, href: '/resume', Icon: FileText },
];

export function SiteNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { lang, toggleLang, t } = useLang();
  const { pathname } = useLocation();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  /*
   * 语言开关。按钮上写的是**切过去**的那一边，不是当前语言——写当前语言的话，
   * 中文界面上会出现一个写着「中文」的按钮，看着像标签不像开关。
   */
  const langButton = (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleLang}
      aria-label={t(UI.lang.switchTo)}
      title={t(UI.lang.switchTo)}
      className="flex items-center gap-1.5 rounded-lg bg-muted/80 px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
    >
      <Languages className="h-4 w-4" />
      <span className="whitespace-nowrap">
        {lang === 'en' ? t(UI.lang.toChinese) : t(UI.lang.toEnglish)}
      </span>
    </motion.button>
  );

  const themeButton = mounted && (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className="rounded-lg bg-muted/80 p-2 transition-colors hover:bg-muted"
      aria-label={t(UI.nav.toggleTheme)}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 text-foreground" />
      ) : (
        <Moon className="h-5 w-5 text-foreground" />
      )}
    </motion.button>
  );

  return (
    <>
      <nav
        className={cn(
          'fixed left-0 right-0 top-0 z-50 transition-all duration-300',
          isScrolled
            ? 'border-b border-border bg-background/80 shadow-sm backdrop-blur-xl'
            : 'bg-transparent'
        )}
      >
        <div className="container">
          <div className="flex h-16 items-center justify-between md:h-20">
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/logo-avatar.png"
                alt=""
                className="h-9 w-9 rounded-full object-cover ring-1 ring-border"
              />
              <span className="whitespace-nowrap text-lg font-bold text-foreground md:text-xl">
                {SITE_NAME}
              </span>
            </Link>

            <div className="ml-6 hidden items-center gap-1 md:flex">
              {NAV_LINKS.map(({ label, href, Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    to={lastTabUrl(href)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    {/* 选中态是一块底色，不是加粗——加粗会让整排字宽度跳一下 */}
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className="absolute inset-0 rounded-lg bg-muted"
                      />
                    )}
                    <Icon className="relative size-4 shrink-0" />
                    <span className="relative whitespace-nowrap">{t(label)}</span>
                  </Link>
                );
              })}
            </div>

            <div className="flex-1" />

            <div className="hidden items-center gap-3 md:flex">
              {/* 导航挤到 lg 以下就先让位，移动端菜单里还有一份 */}
              <BuildStamp className="hidden lg:flex" />
              {langButton}
              {themeButton}
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t(UI.nav.repo)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              {langButton}
              {themeButton}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-expanded={isMobileMenuOpen}
                aria-controls="site-mobile-menu"
                aria-label={t(isMobileMenuOpen ? UI.nav.closeMenu : UI.nav.openMenu)}
                className="p-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            id="site-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label={t(UI.nav.menu)}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-background pt-20 md:hidden"
          >
            <nav className="container flex flex-col gap-6 py-8">
              {NAV_LINKS.map(({ label, href, Icon }, index) => (
                <motion.div
                  key={href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link
                    to={lastTabUrl(href)}
                    aria-current={pathname === href ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 text-2xl font-semibold',
                      pathname === href ? 'text-primary' : 'text-foreground'
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="size-5 shrink-0" />
                    {t(label)}
                  </Link>
                </motion.div>
              ))}
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 pt-6 text-muted-foreground"
              >
                <Github className="h-5 w-5" />
                GitHub
              </a>
              <BuildStamp className="pt-2" />
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
