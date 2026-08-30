import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Lang } from "@/lib/i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Unicode-aware slug generator. Must stay in sync between the markdown
// renderer (which assigns heading IDs) and any TOC that links to them —
// previously diverged and silently broke zh/ja anchor jumps.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function scrollToAnchor(id: string, offset = 100): void {
  const element = document.getElementById(id);
  if (!element) return;
  const elementPosition = element.getBoundingClientRect().top;
  const offsetPosition = elementPosition + window.pageYOffset - offset;
  window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
}

export function displayDomain(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

/** 相对时间。列表里只给个量级，精确日期留给详情页 */
export function timeAgo(iso: string, lang: Lang = 'en'): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';

  const zh = lang === 'zh';
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 60) {
    const value = Math.max(1, minutes);
    return zh ? `${value} 分钟前` : `${value} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return zh ? `${hours} 小时前` : `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return zh ? `${days} 天前` : `${days} d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return zh ? `${months} 个月前` : `${months} mo ago`;
  const years = Math.floor(months / 12);
  return zh ? `${years} 年前` : `${years} y ago`;
}
