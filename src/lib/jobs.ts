/**
 * 岗位数据层：每天早上 Argus 跑完一轮全澳抓取，把结果写成静态文件提交进来。
 *
 * 站点没有后端，所以数据只有构建期一条路 —— `public/data/jobs/`：
 *   index.json     每天一条汇总（各源抓到多少、新增多少、有没有挂）
 *   YYYY-MM-DD.json  那天 Indeed 的新岗位明细
 *
 * 为什么只有 Indeed 的明细：Seek / Jora / LinkedIn 的岗位都带得回 JD，
 * 进 Argus 打分排序更省事；Indeed 六成抓不到 JD，打分等于看着标题瞎猜，
 * 所以那部分直接把链接摆在这里，自己点开去投。
 */

export interface JobSourceStat {
  name: string;
  /** 这一轮从该站抓回来的条数（含重复） */
  fetched: number;
  /** 落库后真正新增的岗位数 */
  newJobs: number;
  state: 'ok' | 'failed';
  error: string | null;
}

export interface JobDayMeta {
  /** 悉尼时区的日期，YYYY-MM-DD */
  date: string;
  /** Argus 里的 scrape_runs.id，出问题时按它去翻日志 */
  runId: number | null;
  startedAt: string;
  durationMin: number | null;
  keywords: string[];
  sources: JobSourceStat[];
  /** 当天新增的来源记录数：同一岗位在两个站各登一次，算两条可投的链接 */
  newJobs: number;
  /** 跨站合并后真正的新岗位数，比 newJobs 小 */
  canonicalNew: number;
  /** 其中来自 Indeed 的，明细在当天那个文件里 */
  indeedNew: number;
  /** 其余三个站的新增，去 Argus 看 */
  otherNew: number;
  status: 'done' | 'failed' | 'partial';
  note: string | null;
}

export interface JobIndex {
  generatedAt: string;
  days: JobDayMeta[];
}

export interface IndeedJob {
  title: string;
  company: string;
  location: string;
  salary: string | null;
  url: string;
  /** 岗位发布时间（ISO），站上给了才有 */
  postedAt: string | null;
  quickApply: boolean;
}

export interface JobDayDetail {
  date: string;
  jobs: IndeedJob[];
}

function assetUrl(relativePath: string): string {
  return `${import.meta.env.BASE_URL}${relativePath}`;
}

/** 同一次会话里来回折叠不重复请求 */
const detailCache = new Map<string, JobDayDetail>();

export async function loadJobIndex(signal?: AbortSignal): Promise<JobIndex> {
  const response = await fetch(assetUrl('data/jobs/index.json'), { signal });
  if (!response.ok) throw new Error(`抓取记录读取失败（${response.status}）`);
  return (await response.json()) as JobIndex;
}

export async function loadJobDay(date: string, signal?: AbortSignal): Promise<JobDayDetail> {
  const cached = detailCache.get(date);
  if (cached) return cached;

  const response = await fetch(assetUrl(`data/jobs/${date}.json`), { signal });
  if (!response.ok) throw new Error(`${date} 的明细读取失败（${response.status}）`);
  const detail = (await response.json()) as JobDayDetail;
  detailCache.set(date, detail);
  return detail;
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 「8月22日 周五」——列表里日期要一眼分得开，年份同年不写 */
export function formatDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  // 用 UTC 构造再读 UTC 星期：日期串本身没有时区，交给本地时区会在
  // UTC+X 的机器上整体偏一天
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const thisYear = new Date().getFullYear();
  const prefix = y === thisYear ? '' : `${y}年`;
  return `${prefix}${m}月${d}日 ${weekday}`;
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** 「3 天前发布」——Indeed 的挂牌时间是决定要不要点进去的第一眼信息 */
export function postedLabel(job: IndeedJob): string | null {
  if (!job.postedAt) return null;
  const posted = new Date(job.postedAt);
  if (Number.isNaN(posted.getTime())) return null;

  const days = Math.floor((Date.now() - posted.getTime()) / 86_400_000);
  if (days <= 0) return '今天发布';
  if (days === 1) return '昨天发布';
  if (days < 30) return `${days} 天前发布`;
  return `${posted.getMonth() + 1}月${posted.getDate()}日发布`;
}
