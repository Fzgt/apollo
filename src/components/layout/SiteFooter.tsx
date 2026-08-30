import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import { REPO_URL, SITE_NAME, SITE_TAGLINE } from '@/content/site';
import { UI } from '@/content/ui';
import { useLang } from '@/lib/i18n';

export function SiteFooter() {
  const { t } = useLang();
  return (
    <footer className="border-t border-border bg-card py-3 dark:bg-background">
      <div className="container flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="leading-tight">
          <p className="font-medium text-foreground">{SITE_NAME}</p>
          <p className="mt-0.5 text-xs">
            {SITE_TAGLINE} · {t(UI.footer.private)}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/" className="transition-colors hover:text-foreground">
            {t(UI.nav.overview)}
          </Link>
          <Link to="/docs" className="transition-colors hover:text-foreground">
            {t(UI.nav.plan)}
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
