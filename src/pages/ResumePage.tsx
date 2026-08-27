import { useSearchParams } from 'react-router-dom';
import { Download, FileText, Languages } from 'lucide-react';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ResumeSheet } from '@/components/resume/ResumeSheet';
import { RESUME_PDF } from '@/content/resume';
import { cn } from '@/lib/utils';

/**
 * Resume页。正文是 HTML 重排的，版式对着 PDF 抄：Times 衬线、章节标题下一条细线、
 * 左标题右日期两栏、en dash 悬挂缩进。纸面在深色模式下也保持白底黑字——
 * Resume本来就是一张纸，跟着主题翻转反而不像了。
 *
 * 中英对照是预先写好的静态文本，不调翻译接口：这是个纯静态站，没有服务端，
 * 而机翻在这些句子上会出硬伤（"drops overlapping generations" 会被译反）。
 */

export default function ResumePage() {
  // 对照开关放进 URL 而不是组件 state：刷新不丢、能直接把链接发出去，
  // 也和站里其他页「URL 就是当前视图」的做法一致。
  const [searchParams, setSearchParams] = useSearchParams();
  const bilingual = searchParams.get('zh') === '1';

  const toggleBilingual = () => {
    const next = new URLSearchParams(searchParams);
    if (bilingual) next.delete('zh');
    else next.set('zh', '1');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 打印时只留纸面：导航、工具条、页脚全部收掉，页边距交给打印机 */}
      <style>{`
        @media print {
          nav, footer, [data-resume-toolbar] { display: none !important; }
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

      <div className="pt-24 md:pt-32">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6">
          {/* 工具条 */}
          <div
            data-resume-toolbar
            className="mb-6 flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">
                Resume
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Laid out against the PDF · the original is in the download
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleBilingual}
                aria-pressed={bilingual}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                  bilingual
                    ? 'border-transparent bg-sky-600 text-white hover:bg-sky-700'
                    : 'border-border bg-card text-foreground hover:bg-muted',
                )}
              >
                <Languages className="h-4 w-4" />
                {bilingual ? 'English only' : 'Side by side'}
              </button>
              <a
                href={RESUME_PDF}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <FileText className="h-4 w-4" />
                Open PDF
              </a>
              <a
                href={RESUME_PDF}
                download="Chris Sun Resume.pdf"
                className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            </div>
          </div>

          {/* 纸面 */}
          <div className="mb-16">
            <ResumeSheet bilingual={bilingual} />
          </div>
        </div>
      </div>

      <div data-resume-toolbar>
        <SiteFooter />
      </div>
    </div>
  );
}
