import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  MapPin,
  Zap,
} from 'lucide-react';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ARGUS_URL } from '@/content/site';
import {
  formatDay,
  formatTime,
  loadJobDay,
  loadJobIndex,
  postedLabel,
  type IndeedJob,
  type JobDayDetail,
  type JobDayMeta,
  type JobIndex,
  type JobSourceStat,
} from '@/lib/jobs';
import { cn } from '@/lib/utils';

const SOURCE_LABEL: Record<string, string> = {
  seek: 'Seek',
  indeed: 'Indeed',
  jora: 'Jora',
  linkedin: 'LinkedIn',
};

function SourceChip({ stat }: { stat: JobSourceStat }) {
  const failed = stat.state !== 'ok';
  return (
    <span
      title={failed ? (stat.error ?? '这个源这一轮没跑通') : `抓回 ${stat.fetched} 条`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
        failed
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border bg-muted/50 text-muted-foreground'
      )}
    >
      {failed && <AlertTriangle className="size-3" />}
      <span className="font-medium text-foreground/80">
        {SOURCE_LABEL[stat.name] ?? stat.name}
      </span>
      {failed ? (
        <span>挂了</span>
      ) : (
        <span className="tabular-nums">
          {stat.fetched} → 新 {stat.newJobs}
        </span>
      )}
    </span>
  );
}

function JobRow({ job }: { job: IndeedJob }) {
  const posted = postedLabel(job);
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-1 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-medium text-foreground group-hover:text-primary">
          {job.title}
        </span>
        <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="text-foreground/70">{job.company || '公司未标'}</span>
        {job.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" />
            {job.location}
          </span>
        )}
        {job.salary && <span className="text-primary/80">{job.salary}</span>}
        {posted && <span>{posted}</span>}
        {job.quickApply && (
          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-primary">
            <Zap className="size-3" />
            快速申请
          </span>
        )}
      </div>
    </a>
  );
}

function DayCard({ day, defaultOpen }: { day: JobDayMeta; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [detail, setDetail] = useState<JobDayDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 明细按需拉：一天几十条不算大，但攒上几个月就没必要一次全下来
  useEffect(() => {
    if (!open || detail || day.indeedNew === 0) return;
    const controller = new AbortController();
    setLoading(true);
    loadJobDay(day.date, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setDetail(data);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : '明细读取失败');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, detail, day.date, day.indeedNew]);

  const failedSources = day.sources.filter((s) => s.state !== 'ok');

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full flex-col gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-foreground">{formatDay(day.date)}</h2>
            <span className="text-xs text-muted-foreground">
              {formatTime(day.startedAt)}
              {day.durationMin !== null && ` · ${day.durationMin} 分钟`}
            </span>
          </div>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180'
            )}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-muted-foreground">
            新增 <span className="font-semibold tabular-nums text-foreground">{day.newJobs}</span>
            {day.canonicalNew !== day.newJobs && (
              <span className="ml-1 text-xs opacity-70">（去重后 {day.canonicalNew}）</span>
            )}
          </span>
          <span className="text-muted-foreground">
            Indeed{' '}
            <span className="font-semibold tabular-nums text-primary">{day.indeedNew}</span>
          </span>
          <span className="text-muted-foreground">
            其余三站{' '}
            <span className="font-semibold tabular-nums text-foreground">{day.otherNew}</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {day.sources.map((stat) => (
            <SourceChip key={stat.name} stat={stat} />
          ))}
        </div>

        {(day.note || failedSources.length > 0) && (
          <p className="text-xs text-muted-foreground">
            {day.note ??
              `${failedSources.map((s) => SOURCE_LABEL[s.name] ?? s.name).join('、')} 这一轮没跑通`}
          </p>
        )}
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border-t border-border"
        >
          {day.indeedNew === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Indeed 这一轮没有新岗位。
              {day.otherNew > 0 && ` 其余三站的 ${day.otherNew} 条已经进库，去 Argus 里看。`}
            </p>
          ) : loading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">读取明细…</p>
          ) : error ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">{error}</p>
          ) : (
            <>
              <p className="border-b border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                Indeed 抓不全 JD，所以不进打分，链接直接摆这儿 · {detail?.jobs.length ?? 0} 条
              </p>
              {detail?.jobs.map((job) => (
                <JobRow key={job.url} job={job} />
              ))}
            </>
          )}

          {day.otherNew > 0 && day.indeedNew > 0 && (
            <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              Seek / Jora / LinkedIn 的 {day.otherNew} 条带 JD，已进 Argus 排队打分。
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default function JobsPage() {
  const [index, setIndex] = useState<JobIndex | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadJobIndex(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setIndex(data);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : '读取失败');
        }
      });
    return () => controller.abort();
  }, []);

  // 日期倒序：新的一天永远在最上面，往下滑是历史
  const days = useMemo(
    () => [...(index?.days ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [index]
  );

  const totals = useMemo(
    () =>
      days.reduce(
        (acc, day) => ({
          newJobs: acc.newJobs + day.newJobs,
          indeed: acc.indeed + day.indeedNew,
        }),
        { newJobs: 0, indeed: 0 }
      ),
    [days]
  );

  const openArgus = useCallback(() => {
    window.open(ARGUS_URL, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-20 md:pt-24">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-4">
          <div className="flex flex-col gap-3 border-b border-border py-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">岗位</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                每天早上八点，Argus 过一遍 Seek / Indeed / Jora / LinkedIn，全澳，
                前端 · 全栈 · 软件工程师
              </p>
            </div>
            <button
              onClick={openArgus}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:self-auto"
            >
              <ExternalLink className="size-3.5" />
              打开 Argus
            </button>
          </div>

          <div className="space-y-4 py-6">
            {error && (
              <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                {error}
              </p>
            )}

            {!index && !error && (
              <p className="py-12 text-center text-sm text-muted-foreground">加载中…</p>
            )}

            {index && days.length === 0 && (
              <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                还没有抓取记录。第一轮跑完就会出现在这里。
              </p>
            )}

            {days.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {days.length} 天 · 累计新增{' '}
                <span className="font-semibold tabular-nums text-foreground">
                  {totals.newJobs}
                </span>{' '}
                条，其中 Indeed{' '}
                <span className="font-semibold tabular-nums text-foreground">{totals.indeed}</span>{' '}
                条在这页可以直接点
              </p>
            )}

            {days.map((day, i) => (
              <DayCard key={day.date} day={day} defaultOpen={i === 0} />
            ))}
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
