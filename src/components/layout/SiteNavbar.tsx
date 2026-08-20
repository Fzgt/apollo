import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Github, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { REPO_URL, SITE_NAME } from '@/content/site';
import { lastTabUrl } from '@/lib/session-state';

/** href 同时是页签的身份：路由记忆按它存「上次停在哪」 */
const NAV_LINKS = [
  { label: '总览', href: '/' },
  { label: '复习', href: '/docs' },
  { label: '资料', href: '/library' },
  { label: '博客', href: '/blog' },
];

export function SiteNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
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

  const themeButton = mounted && (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className="rounded-lg bg-muted/80 p-2 transition-colors hover:bg-muted"
      aria-label="切换主题"
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

            <div className="ml-8 hidden items-center gap-8 md:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  to={lastTabUrl(link.href)}
                  className={cn(
                    'font-medium transition-colors',
                    pathname === link.href
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex-1" />

            <div className="hidden items-center gap-3 md:flex">
              {themeButton}
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub 仓库（新窗口打开）"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              {themeButton}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-expanded={isMobileMenuOpen}
                aria-controls="site-mobile-menu"
                aria-label={isMobileMenuOpen ? '关闭导航菜单' : '打开导航菜单'}
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
            aria-label="导航菜单"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-background pt-20 md:hidden"
          >
            <nav className="container flex flex-col gap-6 py-8">
              {NAV_LINKS.map((link, index) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link
                    to={lastTabUrl(link.href)}
                    className="text-2xl font-semibold text-foreground"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
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
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
