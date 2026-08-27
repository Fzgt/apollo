import { motion } from 'framer-motion';
import {
  EDUCATION,
  EXPERIENCE,
  PROJECTS,
  RESUME_HEADER,
  SECTION_TITLES,
  SKILLS,
  type EntryBlock,
} from '@/content/resume';
import { cn } from '@/lib/utils';

/**
 * 简历纸面。版式对着 PDF 抄：Times 衬线、章节标题下一条细线、左标题右日期两栏、
 * en dash 悬挂缩进。纸面在深色模式下也保持白底黑字——简历本来就是一张纸，
 * 跟着主题翻转反而不像了。
 *
 * 抽成组件是因为有两个入口用它：站内的 /resume（带导航和中英对照开关），
 * 和对外分享的 /cv（不带任何站内链接，见 SharedResumePage）。
 */

/** 章节标题 + 下面那条通栏细线 */
function SectionHeading({
  en,
  zh,
  bilingual,
}: {
  en: string;
  zh: string;
  bilingual: boolean;
}) {
  return (
    <h2 className="mt-6 border-b border-[#b9b9b9] pb-1 text-[15px] font-normal uppercase tracking-[0.06em] text-[#1a1a1a] first:mt-0">
      {en}
      {bilingual && (
        <span className="ml-2 font-sans text-[13px] text-[#6b6b6b]">{zh}</span>
      )}
    </h2>
  );
}

/** 一条 en dash 项目符号：悬挂缩进，回行对齐正文而不是对齐破折号 */
function Bullet({
  en,
  zh,
  bilingual,
}: {
  en: string;
  zh: string;
  bilingual: boolean;
}) {
  return (
    <li className="relative pl-[1.15em] leading-[1.5] text-[#1a1a1a]">
      <span aria-hidden className="absolute left-0 top-0 select-none">
        –
      </span>
      {en}
      {bilingual && (
        <p
          lang="zh-CN"
          className="mt-1 font-sans text-[13px] leading-[1.75] text-[#4a4a4a] [text-wrap:pretty]"
        >
          {zh}
        </p>
      )}
    </li>
  );
}

/** 中文补在英文后面，跟原句同一行——地点、职位这类短语这样读最省地方 */
function Inline({ zh, bilingual }: { zh?: string; bilingual: boolean }) {
  if (!bilingual || !zh) return null;
  return (
    <span
      lang="zh-CN"
      className="ml-1.5 font-sans text-[12.5px] text-[#6b6b6b]"
    >
      {zh}
    </span>
  );
}

/** 公司 / 学校 / 项目一块：左上标题右上日期，左下职位右下地点 */
function Entry({
  entry,
  bilingual,
}: {
  entry: EntryBlock;
  bilingual: boolean;
}) {
  return (
    <div className="mt-3.5 break-inside-avoid first:mt-2">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[15px] font-semibold text-[#1a1a1a]">
          {entry.title.en}
          <Inline zh={entry.title.zh} bilingual={bilingual} />
        </h3>
        <span className="shrink-0 text-right text-[13.5px] text-[#1a1a1a]">
          {entry.meta}
        </span>
      </div>

      {(entry.subtitle || entry.subMeta) && (
        <div className="flex items-baseline justify-between gap-4 text-[13.5px] text-[#5b5b5b]">
          <span>
            {entry.subtitle?.en}
            <Inline zh={entry.subtitle?.zh} bilingual={bilingual} />
          </span>
          <span className="shrink-0 text-right">
            {entry.subMeta?.en}
            <Inline zh={entry.subMeta?.zh} bilingual={bilingual} />
          </span>
        </div>
      )}

      {entry.bullets && (
        <ul
          className={cn(
            'mt-1.5 text-[13.5px]',
            bilingual ? 'space-y-3' : 'space-y-1.5',
          )}
        >
          {entry.bullets.map((bullet) => (
            <Bullet
              key={bullet.en.slice(0, 40)}
              en={bullet.en}
              zh={bullet.zh}
              bilingual={bilingual}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export function ResumeSheet({ bilingual = false }: { bilingual?: boolean }) {
  return (
    <motion.article
      data-resume-sheet
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-lg border border-border bg-white px-8 py-10 shadow-sm sm:px-12 sm:py-12"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {/* 抬头 */}
      <header className="text-center">
        <h1 className="text-[30px] font-normal tracking-[0.04em] text-[#1a1a1a]">
          {RESUME_HEADER.name}
        </h1>
        <p className="mt-1.5 text-[13.5px] text-[#1a1a1a]">
          {RESUME_HEADER.contacts.map((contact, index) => (
            <span key={contact.href}>
              {index > 0 && (
                <span className="mx-2 text-[#8a8a8a]">|</span>
              )}
              <a
                href={contact.href}
                target={
                  contact.href.startsWith('http') ? '_blank' : undefined
                }
                rel="noopener noreferrer"
                className="text-[#1a5fb4] underline underline-offset-2 hover:text-[#0b3d84]"
              >
                {contact.label}
              </a>
            </span>
          ))}
        </p>
        <p className="mt-1 text-[13.5px] text-[#1a1a1a]">
          {RESUME_HEADER.tagline.en}
          <Inline zh={RESUME_HEADER.tagline.zh} bilingual={bilingual} />
        </p>
      </header>

      <SectionHeading {...SECTION_TITLES.skills} bilingual={bilingual} />
      <dl className="mt-2 space-y-1 text-[13.5px] text-[#1a1a1a]">
        {SKILLS.map((skill) => (
          <div key={skill.label} className="flex flex-wrap gap-x-1.5">
            <dt className="tracking-[0.02em]">
              {skill.label}
              <Inline zh={skill.labelZh} bilingual={bilingual} />:
            </dt>
            <dd>{skill.value}</dd>
          </div>
        ))}
      </dl>

      <SectionHeading
        {...SECTION_TITLES.education}
        bilingual={bilingual}
      />
      {EDUCATION.map((entry) => (
        <Entry key={entry.title.en} entry={entry} bilingual={bilingual} />
      ))}

      <SectionHeading
        {...SECTION_TITLES.experience}
        bilingual={bilingual}
      />
      {EXPERIENCE.map((entry) => (
        <Entry key={entry.title.en} entry={entry} bilingual={bilingual} />
      ))}

      <SectionHeading
        {...SECTION_TITLES.projects}
        bilingual={bilingual}
      />
      {PROJECTS.map((entry) => (
        <Entry key={entry.title.en} entry={entry} bilingual={bilingual} />
      ))}
    </motion.article>
  );
}
