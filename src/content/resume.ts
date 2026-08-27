/**
 * 简历正文。以 `~/Desktop/resumes/400297972/Chris Sun Resume.pdf` 为准，
 * 那份 PDF 是唯一事实来源——改简历先改 PDF，再把文字同步过来，不要反过来。
 * public/Chris-Sun-Resume.pdf 是同一份文件的拷贝，供下载按钮用。
 *
 * zh 字段是人工写的中英对照，不是机翻：机翻会把 "every layout had a way
 * through" 译成「每个布局都有一条路」这种丢掉「可通行」判定的说法。
 * 英文改了就要顺手改 zh，两边成对放在一起就是为了让漏改看得见。
 */

export const RESUME_PDF = '/Chris-Sun-Resume.pdf';

export const RESUME_HEADER = {
  name: 'Chris Sun',
  contacts: [
    { label: 'fzgt320@gmail.com', href: 'mailto:fzgt320@gmail.com' },
    { label: '(+61) 0400 297 972', href: 'tel:+61400297972' },
    { label: 'github.com/Fzgt', href: 'https://github.com/Fzgt' },
    { label: 'linkedin.com/in/fzgt', href: 'https://linkedin.com/in/fzgt' },
  ],
  /** 抬头第三行：工作权限与地点。不是链接，单独一行 */
  tagline: {
    en: 'Full working rights (Subclass 485) · Sydney, NSW · Open to relocating',
    zh: '完全工作权限（485 签证）· 悉尼 新南威尔士 · 可接受搬迁',
  },
};

export const SECTION_TITLES = {
  skills: { en: 'Technical Skills', zh: '技术栈' },
  education: { en: 'Education', zh: '教育背景' },
  experience: { en: 'Experience', zh: '工作经历' },
  projects: { en: 'Projects', zh: '项目' },
};

/** 技能行的值全是技术名词，不翻；只翻左边那个分类标签 */
export const SKILLS: { label: string; labelZh: string; value: string }[] = [
  {
    label: 'Programming Languages',
    labelZh: '编程语言',
    value: 'TypeScript, JavaScript, Python',
  },
  {
    label: 'Frontend',
    labelZh: '前端',
    value:
      'React, Next.js, Vue, Angular, Tailwind, TanStack Query, Zustand, R3F, Three.js',
  },
  {
    label: 'Backend & Data',
    labelZh: '后端与数据',
    value:
      'Node.js, NestJS, FastAPI, Django, PostgreSQL, pgvector, MongoDB, WebSockets',
  },
  {
    label: 'Engineering',
    labelZh: '工程化',
    value:
      'Playwright, Jest, Vitest, Webpack, Vite, Jenkins, GitHub Actions, Docker, AWS, Cloudflare',
  },
  {
    label: 'AI',
    labelZh: '人工智能',
    value:
      'LLM Integration, Streaming Responses, Structured Outputs, Embeddings, Vector Search, RAG',
  },
];

/** 英中成对。放一个对象里而不是两个平行数组，是为了让它们不可能错位 */
export type Bilingual = { en: string; zh: string };

export type EntryBlock = {
  /** 左上：学校 / 公司 / 项目名 */
  title: Bilingual;
  /** 右上：日期，或项目的技术栈。日期和技术栈都不用翻 */
  meta: string;
  /** 左下：学位 / 职位 */
  subtitle?: Bilingual;
  /** 右下：地点 */
  subMeta?: Bilingual;
  bullets?: Bilingual[];
};

export const EDUCATION: EntryBlock[] = [
  {
    title: { en: 'University of Technology Sydney (UTS)', zh: '悉尼科技大学' },
    meta: 'Aug 2024 – Jun 2026',
    subtitle: {
      en: 'Master of Information Technology, Enterprise Software Development',
      zh: '信息技术硕士，企业软件开发方向',
    },
    subMeta: { en: 'Sydney, Australia', zh: '澳大利亚 悉尼' },
  },
  {
    title: {
      en: 'Shandong Technology and Business University',
      zh: '山东工商学院',
    },
    meta: 'Sep 2017 – Jun 2021',
    subtitle: {
      en: 'Bachelor of Science, Information and Computing Science',
      zh: '理学学士，信息与计算科学',
    },
    subMeta: { en: 'Shandong, China', zh: '中国 山东' },
  },
];

export const EXPERIENCE: EntryBlock[] = [
  {
    title: { en: 'Beyz', zh: '' },
    meta: 'Jan 2024 – Oct 2024',
    subtitle: { en: 'Full-stack Engineer', zh: '全栈工程师' },
    subMeta: { en: 'Canada, Remote', zh: '加拿大 远程' },
    bullets: [
      {
        en: 'Built the real-time interview copilot end to end: tab and system audio through getDisplayMedia, streamed over a WebSocket to Deepgram and answered by GPT-4o token by token as each utterance ends.',
        zh: '端到端实现实时面试 copilot：用 getDisplayMedia 捕获标签页与系统音频，经 WebSocket 推流到 Deepgram；每说完一句就触发 GPT-4o 逐 token 作答。',
      },
      {
        en: 'Minted 60-second usage-scoped Deepgram keys per session behind a plan gate, socket alive across pauses.',
        zh: '为每个会话签发 60 秒、只带用量上报权限的 Deepgram 临时密钥，签发前先过套餐校验；麦克风暂停期间连接保持存活。',
      },
      {
        en: 'Owned the paid conversion path — Stripe Checkout, trials and lifetime purchases on Next.js and Drizzle — with entitlements written only by signature-verified webhooks: no event can downgrade a lifetime purchase.',
        zh: '独立负责付费转化链路 —— 基于 Next.js 与 Drizzle 的 Stripe Checkout、试用与买断。权益只由验签通过的 webhook 写入：没有任何一个事件能把买断降级。',
      },
      {
        en: 'Sole author of a NestJS service for subscription emails and scheduled payment reminders, Dockerized and deployed to EC2 through GitHub Actions, and of the repo’s first CI gate on every push.',
        zh: '独立开发了一个 NestJS 服务，负责订阅邮件与定时付款提醒 —— 容器化，经 GitHub Actions 部署到 EC2；同时搭起了这个仓库的第一道 CI 关卡：每次 push 都跑。',
      },
    ],
  },
  {
    title: { en: 'BioMap', zh: '百图生科' },
    meta: 'Apr 2022 – Oct 2022',
    subtitle: { en: 'Frontend Engineer', zh: '前端工程师' },
    subMeta: { en: 'Beijing, China', zh: '中国 北京' },
    bullets: [
      {
        en: 'Led the React 18 and TypeScript architecture for Digital OS, the team’s core consumer-facing product, enforcing feature boundaries with five custom ESLint import zones: no feature can reach into another.',
        zh: '主导团队核心对客产品 Digital OS 的 React 18 + TypeScript 架构，用五条自定义 ESLint import 分区把模块边界从「约定」变成「约束」：任何 feature 都伸不进另一个。',
      },
      {
        en: 'Built the design system on Radix UI, Storybook and CVA over MSW mocks, variants typed off the styles.',
        zh: '在 MSW mock 之上用 Radix UI、Storybook 与 CVA 搭起设计系统，变体类型直接从样式推出来。',
      },
      {
        en: 'Layered TanStack Query in three tiers — API functions, queryOptions factories, typed hooks — single-source cache keys, mutation-driven invalidation and hover prefetch: detail pages open instantly, with no request at all.',
        zh: '把 TanStack Query 分成三层 —— API 函数、queryOptions 工厂、带类型的 hook —— 缓存键单一来源、由 mutation 驱动失效、悬停预取：详情页秒开，而且一个请求都不发。',
      },
      {
        en: 'Developed the LIMS platform in Vue 3 and TypeScript for sample management and SOP workflows, extending the Luckysheet SDK with custom cell actions and a per-cell JSON contract, plus a scaffolding CLI.',
        zh: '用 Vue 3 与 TypeScript 开发 LIMS 平台的样本管理与 SOP 流程，扩展 Luckysheet SDK：自定义单元格操作与单元格级 JSON 契约，另配一条命令初始化项目的脚手架 CLI。',
      },
    ],
  },
  {
    title: { en: 'Baidu', zh: '百度' },
    meta: 'Jul 2021 – Apr 2022',
    subtitle: { en: 'Frontend Engineer', zh: '前端工程师' },
    subMeta: { en: 'Beijing, China', zh: '中国 北京' },
    bullets: [
      {
        en: 'Built a virtualized React feed serving 5M+ daily page views on a custom useVirtualList hook over IntersectionObserver: live DOM nodes stay near 100 at any scroll depth, scroll from 30 to a stable 60 FPS.',
        zh: '基于自研 useVirtualList hook（底层用 IntersectionObserver）实现承载日均 500 万+ PV 的 React 虚拟列表信息流：任意滚动深度下存活 DOM 节点都稳定在 100 上下，滚动帧率从 30 回到稳定 60。',
      },
      {
        en: 'Led a Webpack 3-to-5 migration across 10+ incompatible packages, extracting vendor and runtime chunks and turning on persistent caching — bundle size down ~15%, local build times down 70% on warm builds.',
        zh: '主导 Webpack 3 到 5 的迁移，处理 10 多个不兼容的包，拆出 vendor 与 runtime chunk 并开启持久化缓存 —— 包体积下降约 15%，本地热构建时间下降 70%。',
      },
      {
        en: 'First to diagnose a P2 white screen on Haokan Video’s search page (30M+ DAU): mismatched Node versions regenerated package-lock.json, pulling a breaking minor bump — version locks and release checks followed.',
        zh: '第一个定位出好看视频搜索页（3000 万+ DAU）P2 白屏事故的根因：Node 版本不一致导致 package-lock.json 被重新生成，放进来一个带破坏性改动的小版本升级 —— 随后落地了版本锁定与发布前检查。',
      },
      {
        en: 'Built the withdrawal client on a path peaking above 2,000 QPS: request locking drops in-flight duplicates, client-generated idempotency keys survive reloads, and uncertain outcomes surface as failures, never successes.',
        zh: '在峰值超过 2,000 QPS 的链路上实现提现客户端：请求锁丢弃在途的重复请求，前端生成的幂等键在页面刷新后依然有效，结果不确定时一律按失败提示，绝不显示成功。',
      },
      {
        en: 'Delivered the Xiaodu App’s H5 smart-home module in Vue 2 on Webpack 3, embedded in the native shell: iOS/Android sharing through jsBridge, device detail pages, and event tracking on the Baidu Statistics API.',
        zh: '用 Vue 2（Webpack 3）交付小度 App 的 H5 智能家居模块，嵌在原生壳里：通过 jsBridge 调起 iOS/Android 分享、设备详情页，以及走百度统计 API 的事件埋点。',
      },
    ],
  },
];

export const PROJECTS: EntryBlock[] = [
  {
    title: {
      en: 'WinterFell — WebGPU Neon Runner',
      zh: 'WinterFell —— WebGPU 霓虹跑酷',
    },
    meta: 'React Three Fiber · Three.js · WebGPU · TypeScript',
    bullets: [
      {
        en: 'Built a browser racing game: steer a craft through fields of neon obstacles across twenty scenes, with the terrain, skyline and obstacles all generated on the fly from how far you have traveled, on a fresh seed each run.',
        zh: '做了一个浏览器竞速游戏：驾驶飞行器穿过二十个场景的霓虹障碍阵；地形、天际线与障碍全部按已飞行的距离实时生成，每局换一个新种子。',
      },
      {
        en: 'Made the neon glow work on machines without WebGPU: it is built on the newer three.js node pipeline, so one renderer drives WebGPU where the browser has it and falls back to WebGL2 where it does not.',
        zh: '让霓虹辉光在没有 WebGPU 的机器上照样成立：它建在 three.js 较新的节点管线上，所以同一个渲染器在浏览器支持时走 WebGPU，不支持时回退到 WebGL2。',
      },
      {
        en: 'Cut draw calls from 129 to 76 by collapsing each obstacle field into two instanced meshes, measured frame by frame in a headless Chromium harness: the cost is that off-screen obstacles can no longer be skipped one by one.',
        zh: '把每一段障碍阵合并成两个实例化 mesh，draw call 从 129 降到 76 —— 由一个无头 Chromium 测量装置逐帧测得；代价是屏幕外的障碍不能再逐个跳过。',
      },
      {
        en: 'Checked the level generator by machine rather than by playing it: across 1,020 generated layouts, every step tested against how far the craft can move sideways at that stage’s speed, every layout had a way through.',
        zh: '关卡生成器交给机器检验，而不是靠试玩：1,020 个生成的布局逐步校验，按该阶段速度下飞行器能横向移动多远来判定 —— 每个布局都存在一条走得通的路。',
      },
      {
        en: 'Traced a freeze on every color change to the fog: rebuilding it as a new object made every material in the scene recompile its shader in one frame. Reusing one fog object and setting its color removed it.',
        zh: '把每次换配色时出现的卡顿定位到了雾：把它当成新对象重建，会让场景里每一个材质在同一帧内重新编译着色器。改成复用同一个雾对象、只改它的颜色，卡顿就消失了。',
      },
    ],
  },
  {
    title: {
      en: 'Periplus — LLM Research Pipeline',
      zh: 'Periplus —— LLM 研究流水线',
    },
    meta: 'Python · FastAPI · LLM Orchestration · pgvector',
    bullets: [
      {
        en: 'Six-stage LLM pipeline behind typed Pydantic stage contracts filled by schema-constrained JSON output, with run state and stage artifacts in PostgreSQL: a run that dies mid-pipeline resumes from the last completed stage.',
        zh: '六阶段 LLM 流水线，阶段之间只认带类型的 Pydantic 契约，由受 schema 约束的 JSON 输出填充；运行状态与阶段产物落在 PostgreSQL 里：流水线中途挂掉的运行可以从最后一个已完成阶段续跑。',
      },
      {
        en: 'Cached evidence embeddings in pgvector on an ivfflat cosine index, generated locally by MiniLM.',
        zh: '证据向量缓存在 pgvector 里，走 ivfflat 余弦索引，向量由本地 MiniLM 生成。',
      },
      {
        en: 'Put a scripted seam behind every external dependency — the model provider, search, httpx page fetch and the clock — so the whole system runs with no API keys and no network: 461 pytest tests, 1.5 seconds end to end.',
        zh: '在每个外部依赖背后都留了一道可脚本化的接缝 —— 模型服务、搜索、httpx 页面抓取和时钟 —— 所以整个系统不用 API key、不联网也能跑：461 个 pytest 测试，全程 1.5 秒。',
      },
      {
        en: 'Ran an offline eval harness against a frozen golden set, asserting ranges rather than literal output on evidence-gap rate, citation integrity and token cost: every prompt change lands as a before/after diff.',
        zh: '用离线评测装置跑冻结的黄金集，对证据缺口率、引用完整性与 token 成本断言范围而不是字面输出：每次提示词改动都以前后对比 diff 的形式落地。',
      },
    ],
  },
];
