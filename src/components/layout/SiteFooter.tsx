import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import { REPO_URL, SITE_NAME, SITE_TAGLINE } from '@/content/site';

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card py-10 dark:bg-background">
      <div className="container flex flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-foreground">{SITE_NAME}</p>
          <p className="mt-1">{SITE_TAGLINE} · 私人笔记，不对外索引</p>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/" className="transition-colors hover:text-foreground">
            总览
          </Link>
          <Link to="/docs" className="transition-colors hover:text-foreground">
            复习
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
