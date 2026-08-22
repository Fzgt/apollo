import { motion } from 'framer-motion';
import { Download, FileText } from 'lucide-react';
import { SiteFooter } from '@/components/layout/SiteFooter';
import {
  EDUCATION,
  EXPERIENCE,
  PROJECTS,
  RESUME_HEADER,
  RESUME_PDF,
  SKILLS,
  type EntryBlock,
} from '@/content/resume';

/**
 * 简历页。正文是 HTML 重排的，版式对着 PDF 抄：Times 衬线、章节标题下一条细线、
 * 左标题右日期两栏、en dash 悬挂缩进。纸面在深色模式下也保持白底黑字——
 * 简历本来就是一张纸，跟着主题翻转反而不像了。
 */

/** 章节标题 + 下面那条通栏细线 */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-6 border-b border-[#b9b9b9] pb-1 text-[15px] font-normal uppercase tracking-[0.06em] text-[#1a1a1a] first:mt-0">
      {children}
    </h2>
  );
}

/** 一条 en dash 项目符号：悬挂缩进，回行对齐正文而不是对齐破折号 */
function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="relative pl-[1.15em] leading-[1.5] text-[#1a1a1a]">
      <span aria-hidden className="absolute left-0 top-0 select-none">
        –
      </span>
      {children}
    </li>
  );
}

/** 公司 / 学校 / 项目一块：左上标题右上日期，左下职位右下地点 */
function Entry({ entry }: { entry: EntryBlock }) {
  return (
    <div className="mt-3.5 break-inside-avoid first:mt-2">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[15px] font-semibold text-[#1a1a1a]">{entry.title}</h3>
        <span className="shrink-0 text-right text-[13.5px] text-[#1a1a1a]">{entry.meta}</span>
      </div>

      {(entry.subtitle || entry.subMeta) && (
        <div className="flex items-baseline justify-between gap-4 text-[13.5px] text-[#5b5b5b]">
          <span>{entry.subtitle}</span>
          <span className="shrink-0 text-right">{entry.subMeta}</span>
        </div>
      )}

      {entry.bullets && (
        <ul className="mt-1.5 space-y-1.5 text-[13.5px]">
          {entry.bullets.map((bullet) => (
            <Bullet key={bullet.slice(0, 40)}>{bullet}</Bullet>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ResumePage() {
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
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">简历</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                版式对着 PDF 重排 · 原件在下载里
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={RESUME_PDF}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <FileText className="h-4 w-4" />
                在线打开 PDF
              </a>
              <a
                href={RESUME_PDF}
                download="Chris Sun Resume.pdf"
                className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                <Download className="h-4 w-4" />
                下载 PDF
              </a>
            </div>
          </div>

          {/* 纸面 */}
          <motion.article
            data-resume-sheet
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mb-16 rounded-lg border border-border bg-white px-8 py-10 shadow-sm sm:px-12 sm:py-12"
            style={{ fontFamily: '"Times New Roman", Times, "Songti SC", serif' }}
          >
            {/* 抬头 */}
            <header className="text-center">
              <h1 className="text-[30px] font-normal tracking-[0.04em] text-[#1a1a1a]">
                {RESUME_HEADER.name}
              </h1>
              <p className="mt-1.5 text-[13.5px] text-[#1a1a1a]">
                {RESUME_HEADER.contacts.map((contact, index) => (
                  <span key={contact.href}>
                    {index > 0 && <span className="mx-2 text-[#8a8a8a]">|</span>}
                    <a
                      href={contact.href}
                      target={contact.href.startsWith('http') ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className="text-[#1a5fb4] underline underline-offset-2 hover:text-[#0b3d84]"
                    >
                      {contact.label}
                    </a>
                  </span>
                ))}
              </p>
            </header>

            <SectionHeading>Technical Skills</SectionHeading>
            <dl className="mt-2 space-y-1 text-[13.5px] text-[#1a1a1a]">
              {SKILLS.map((skill) => (
                <div key={skill.label} className="flex flex-wrap gap-x-1.5">
                  <dt className="tracking-[0.02em]">{skill.label}:</dt>
                  <dd>{skill.value}</dd>
                </div>
              ))}
            </dl>

            <SectionHeading>Education</SectionHeading>
            {EDUCATION.map((entry) => (
              <Entry key={entry.title} entry={entry} />
            ))}

            <SectionHeading>Experience</SectionHeading>
            {EXPERIENCE.map((entry) => (
              <Entry key={entry.title} entry={entry} />
            ))}

            <SectionHeading>Projects</SectionHeading>
            {PROJECTS.map((entry) => (
              <Entry key={entry.title} entry={entry} />
            ))}
          </motion.article>
        </div>
      </div>

      <div data-resume-toolbar>
        <SiteFooter />
      </div>
    </div>
  );
}
