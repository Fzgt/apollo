/**
 * 简历正文。以 `~/Desktop/resumes/400297972/Chris Sun Resume.pdf` 为准，
 * 那份 PDF 是唯一事实来源——改简历先改 PDF，再把文字同步过来，不要反过来。
 * public/Chris-Sun-Resume.pdf 是同一份文件的拷贝，供下载按钮用。
 *
 * zh 字段是人工写的中英对照，不是机翻：机翻会把 "a four-state machine drops
 * overlapping generations" 译成「产生重叠的世代」，意思正好反了。
 * 英文改了就要顺手改 zh，两边成对放在一起就是为了让漏改看得见。
 */

export const RESUME_PDF = '/Chris-Sun-Resume.pdf';

export const RESUME_HEADER = {
  name: 'Chris Sun',
  contacts: [
    { label: 'fzgt320@gmail.com', href: 'mailto:fzgt320@gmail.com' },
    { label: '(+61) 0400 297 972', href: 'tel:+61400297972' },
    { label: 'github.com/Fzgt', href: 'https://github.com/Fzgt' },
  ],
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
    value: 'TypeScript, JavaScript, Python, Go',
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
      'LLM Integration, RAG, Structured Outputs, Embeddings, Vector Search, Streaming, Evals',
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
        en: 'Built the real-time interview copilot end to end: tab and system audio captured through getDisplayMedia, streamed over a WebSocket to Deepgram’s live recognizer, with interim and finalized transcripts reconciled in the client and utterance-end events triggering GPT-4o answers streamed back token by token.',
        zh: '端到端实现实时面试 copilot：用 getDisplayMedia 捕获标签页与系统音频，经 WebSocket 推流到 Deepgram 的实时识别器；在客户端把临时转写与最终转写合并成一份文本，并由「一句话说完」事件触发 GPT-4o，答案逐 token 流式返回。',
      },
      {
        en: 'Kept the transcription credential out of the browser by minting 60-second, usage-scoped keys per session behind a plan gate, held the socket alive across microphone pauses, and logged per-request token usage that backs per-plan quotas; a four-state machine drops overlapping generations.',
        zh: '让转写凭证不落进浏览器：在套餐校验之后，为每个会话签发 60 秒、只带用量上报权限的临时密钥；麦克风暂停期间保持连接存活；按请求记录 token 用量，作为各套餐配额的依据。一个四状态机负责丢弃重叠的生成请求。',
      },
      {
        en: 'Owned the paid conversion path — Stripe Checkout, trials and lifetime purchases on Next.js, tRPC and Drizzle — with plan eligibility enforced in typed server actions and entitlements written only by signature-verified webhooks across six subscription events, none of which can downgrade a lifetime purchase.',
        zh: '独立负责付费转化链路 —— 基于 Next.js、tRPC 与 Drizzle 的 Stripe Checkout、试用与买断。套餐资格在带类型的 server action 里校验，权益只由验签通过的 webhook 写入，覆盖六个订阅事件，且其中没有任何一个能把买断降级。',
      },
      {
        en: 'Sole author of a NestJS and Fastify service for subscription emails and scheduled payment reminders — Dockerized, cron-triggered, deployed to EC2 under PM2 through GitHub Actions — and of the repo’s first CI gate: lint, typecheck and build on every push.',
        zh: '独立开发了一个 NestJS + Fastify 服务，负责订阅邮件与定时付款提醒 —— 容器化、cron 触发，经 GitHub Actions 部署到 EC2 并由 PM2 托管；同时搭起了这个仓库的第一道 CI 关卡：每次 push 都跑 lint、类型检查和构建。',
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
        en: 'Developed the LIMS platform in Vue 3 and TypeScript for sample management and SOP workflows, integrating the Luckysheet SDK and a CLI for one-command project scaffolding.',
        zh: '用 Vue 3 与 TypeScript 开发 LIMS 平台的样本管理与 SOP 流程，集成 Luckysheet SDK，并做了一条命令初始化项目的 CLI。',
      },
      {
        en: 'Led the React 18 and TypeScript architecture for Digital OS, the team’s core consumer-facing product, enforcing feature boundaries with custom ESLint rules.',
        zh: '主导团队核心对客产品 Digital OS 的 React 18 + TypeScript 架构，用自定义 ESLint 规则把模块边界从「约定」变成「约束」。',
      },
      {
        en: 'Layered TanStack Query in three tiers — API functions, queryOptions factories, typed hooks — single-source cache keys, mutation-driven invalidation and hover prefetch: detail pages open instantly, with no request at all.',
        zh: '把 TanStack Query 分成三层 —— API 函数、queryOptions 工厂、带类型的 hook —— 缓存键单一来源、由 mutation 驱动失效、悬停预取：详情页秒开，而且一个请求都不发。',
      },
      {
        en: 'Built a design system on Radix UI, Storybook and CVA, plus an MSW mock layer that let frontend delivery run independent of backend progress.',
        zh: '基于 Radix UI、Storybook 与 CVA 搭建设计系统，并用 MSW mock 层让前端交付不再被后端进度卡住。',
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
        en: 'Delivered the Xiaodu App’s H5 smart-home module in Vue 2, adding native iOS/Android sharing via jsBridge, device detail pages and analytics tracking.',
        zh: '用 Vue 2 交付小度 App 的 H5 智能家居模块，通过 jsBridge 调起 iOS/Android 原生分享，并完成设备详情页与埋点。',
      },
      {
        en: 'Built a virtualized React feed serving 5M+ daily page views on a custom useVirtualList hook over IntersectionObserver: live DOM nodes stay near 100 at any scroll depth, scroll from 30 to a stable 60 FPS.',
        zh: '基于自研 useVirtualList hook（底层用 IntersectionObserver）实现承载日均 500 万+ PV 的 React 虚拟列表信息流：任意滚动深度下存活 DOM 节点都稳定在 100 上下，滚动帧率从 30 回到稳定 60。',
      },
      {
        en: 'Built the withdrawal client on a path peaking above 2,000 QPS: request locking drops in-flight duplicates, client-generated idempotency keys survive reloads, and uncertain outcomes surface as failures, never successes.',
        zh: '在峰值超过 2,000 QPS 的链路上实现提现客户端：请求锁丢弃在途的重复请求，前端生成的幂等键在页面刷新后依然有效，结果不确定时一律按失败提示，绝不显示成功。',
      },
      {
        en: 'Led a Webpack 3-to-5 migration across 10+ incompatible packages, extracting vendor and runtime chunks and turning on persistent caching — bundle size down ~15%, local build times down 70% on warm builds.',
        zh: '主导 Webpack 3 到 5 的迁移，处理 10 多个不兼容的包，拆出 vendor 与 runtime chunk 并开启持久化缓存 —— 包体积下降约 15%，本地热构建时间下降 70%。',
      },
      {
        en: 'First to diagnose a P2 white screen on Haokan Video’s search page (30M+ DAU): mismatched Node versions regenerated package-lock.json, pulling a breaking minor bump — version locks and release checks followed.',
        zh: '第一个定位出好看视频搜索页（3000 万+ DAU）P2 白屏事故的根因：Node 版本不一致导致 package-lock.json 被重新生成，放进来一个带破坏性改动的小版本升级 —— 随后落地了版本锁定与发布前检查。',
      },
    ],
  },
];

export const PROJECTS: EntryBlock[] = [
  {
    title: {
      en: 'Periplus — Evidence-Grounded LLM Travel Research',
      zh: 'Periplus —— 证据可溯源的 LLM 旅行研究系统',
    },
    meta: 'Python · FastAPI · React · pgvector',
    bullets: [
      {
        en: 'Built a six-stage agentic workflow — research, verification, planning, writing, editing and illustration — where the orchestrator knows only typed stage contracts, carried through to the React client as types generated from the OpenAPI schema.',
        zh: '构建六阶段 agentic 工作流 —— 检索、核实、规划、写作、编辑与配图 —— 编排器只认识带类型的阶段契约；这套契约一路延伸到 React 客户端，类型由 OpenAPI schema 生成。',
      },
      {
        en: 'Split evidence from judgment: the research stage emits claims bound to exact source quotes, a separate verification stage rules on them, and application code — not prompts — enforces citation membership and freshness windows. A claim with no supporting quote never advances.',
        zh: '把证据和判断拆开：检索阶段产出的每条声明都绑定原文逐字引用，由独立的核实阶段裁决；引用归属和新鲜度窗口由应用代码强制，而不是靠提示词。没有支撑引用的声明永远进不了下一阶段。',
      },
      {
        en: 'Persisted run state, stage artifacts and a pgvector evidence cache in PostgreSQL under per-run token and time budgets. A run that dies mid-pipeline resumes from the last completed stage.',
        zh: '在每次运行各自的 token 与时间预算下，把运行状态、阶段产物和 pgvector 证据缓存持久化到 PostgreSQL。流水线中途挂掉的运行可以从最后一个已完成阶段续跑。',
      },
      {
        en: 'Put a scripted seam behind every external dependency — model provider, search, page fetch and clock — so the whole system runs with no API keys and no network: 406 server tests, about a second end to end.',
        zh: '在每个外部依赖背后都留了一道可脚本化的接缝 —— 模型服务、搜索、页面抓取和时钟 —— 所以整个系统不用 API key、不联网也能跑：406 个服务端测试，全程约一秒。',
      },
      {
        en: 'Scored the pipeline against a golden set, not by inspection. Each case freezes the brief, the retrieved pages and the clock, then asserts ranges rather than literal output on evidence-gap rate, citation integrity and token cost. A prompt or control-flow change lands as a before/after diff, every metric marked better or worse.',
        zh: '用黄金集给流水线打分，而不是靠肉眼看几个例子。每个用例冻结行程简报、检索到的页面和时钟，然后对证据缺口率、引用完整性与 token 成本断言范围而不是字面输出。一次提示词或控制流改动会以前后对比 diff 的形式落地，每项指标都标出变好还是变坏。',
      },
    ],
  },
  {
    title: {
      en: 'WinterFell — WebGPU Neon Runner',
      zh: 'WinterFell —— WebGPU 霓虹跑酷',
    },
    meta: 'React Three Fiber · Three.js · WebGPU · Cannon · TypeScript',
    bullets: [
      {
        en: 'Built the bloom pass on the three.js TSL node pipeline, which a classic WebGLRenderer cannot execute. A single WebGPURenderer drives WebGPU where present and its own WebGL2 backend where absent; the look survives the fallback instead of quietly degrading.',
        zh: '在 three.js 的 TSL 节点管线上实现辉光后处理 —— 这是传统 WebGLRenderer 跑不了的。同一个 WebGPURenderer 在支持 WebGPU 时走 WebGPU，不支持时走它自带的 WebGL2 后端；画面效果在回退路径上照样成立，而不是悄悄降级。',
      },
      {
        en: 'Collapsed each obstacle section into two InstancedMeshes sharing one matrix set: a headless Chromium harness sampling renderer stats every frame put draw calls down from 129 to 76 and triangles submitted up 2.6×, one bounding volume per mesh being the price of losing per-instance frustum culling.',
        zh: '把每一段障碍物合并成两个共享同一套矩阵的 InstancedMesh：一个逐帧采样渲染器统计数据的无头 Chromium 测量装置显示，draw call 从 129 降到 76，提交的三角形数上升 2.6 倍 —— 每个 mesh 只剩一个包围盒，这是失去逐实例视锥剔除的代价。',
      },
      {
        en: 'Swept the live generator across 1,020 generated layouts, testing every step against the craft’s lateral reach at that level’s speed — every layout had a continuous path through it, no gap narrower than 15 units, against a random-scatter control.',
        zh: '让线上那套生成器跑出 1,020 个关卡布局逐个扫描，按该关速度下飞行器的横向可达范围逐步校验 —— 每个布局都存在一条连续可通行的路径，且没有窄于 15 个单位的缺口，并与随机散布的对照组作了比较。',
      },
      {
        en: 'Traced a freeze landing exactly on each palette change to distance fog: declared as JSX it rebuilt the fog object, and fog belongs to a material’s program key, so the renderer recompiled every material in the scene inside one frame — a probe counting pipelines built per frame confirmed it; one mutated fog object removed it.',
        zh: '把每次换配色时精准出现的卡顿定位到了距离雾：以 JSX 声明会重建 fog 对象，而 fog 属于材质的 program key，于是渲染器在同一帧里重新编译了场景中的每一个材质 —— 一个统计每帧新建管线数的探针证实了这一点；改成复用同一个 fog 对象后卡顿消失。',
      },
    ],
  },
];
