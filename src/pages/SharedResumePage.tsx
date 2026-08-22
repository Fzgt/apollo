import { Download } from 'lucide-react';
import { ResumeSheet } from '@/components/resume/ResumeSheet';
import { RESUME_HEADER, RESUME_PDF } from '@/content/resume';

/**
 * 对外分享的简历页（/cv）。
 *
 * 和站内的 /resume 是同一张纸，区别全在「周边」：
 *  - 不渲染站点导航和页脚——拿到链接的人点不到复习笔记、资料、博客，
 *    也点不到那个指向仓库的 GitHub 图标（App.tsx 里按路径把导航关掉了）；
 *  - 界面文案是英文的，因为这个链接是投给英文招聘方的；
 *  - 不放中英对照开关，纸面就是简历本身。
 *
 * ⚠️ 站点整体带 `X-Robots-Tag: noindex`，所以这个链接不会被搜索引擎收录——
 * 它是「发给谁谁才看得到」，不是公开主页。
 */
export default function SharedResumePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 打印时只留纸面 */}
      <style>{`
        @media print {
          [data-cv-toolbar] { display: none !important; }
          body { background: #fff !important; }
          [data-resume-sheet] {
            box-shadow: none !important;
            border: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: none !important;
          }
          @page { margin: 14mm 16mm; }
        }
      `}</style>

      <div className="container mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div
          data-cv-toolbar
          className="mb-6 flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {RESUME_HEADER.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Full-stack / AI Engineer · Sydney
            </p>
          </div>

          <a
            href={RESUME_PDF}
            download="Chris Sun Resume.pdf"
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
        </div>

        <ResumeSheet />
      </div>
    </div>
  );
}
