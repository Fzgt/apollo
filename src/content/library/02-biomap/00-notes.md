---
title: BioMap · 四条 bullet
section: BioMap
icon: microscope
---

# BioMap —— 简历四条 bullet

> ⚠️ **这是按旧顺序保存的历史资料。现版简历顺序是：① 架构边界 ② 设计系统 ③ TanStack Query ④ LIMS。**当前面试口径以「计划」里的四篇重写版为准；下面的「Bullet 1–4」只表示旧版编号。
>
> 结构对齐 **简历的 BioMap 四条**，一条不多一条不少。每条分四段：**原文** / **在哪看** / **怎么讲** / **可能的追问**。
> 那条「工具链 + Docker/Nginx/Jenkins」已经不在简历上，整节删除。

## 读哪个仓库 —— 别搞错

| 旧版 bullet | 代码在哪 |
|---|---|
| ① LIMS + Luckysheet + CLI | `~/Desktop/BioMap/biomap-web-lims`、`~/Desktop/BioMap/biomap-cli` —— **BioMap 真代码** |
| ② Digital OS 架构 + ESLint 模块边界 | `~/Desktop/projects/github/Prometheus` |
| ③ TanStack Query 三层 + prefetch | `~/Desktop/projects/github/Prometheus` |
| ④ Radix + Storybook + CVA + MSW | `~/Desktop/projects/github/Prometheus` |

**LIMS / Luckysheet / CLI 看 BioMap 的仓库，其余三条一律看 Prometheus。** Prometheus 是这套架构（bulletproof-react 那一路）的参照实现，本文所有 ② ③ ④ 的行号都指它。

---
## Bullet 1:LIMS 平台 + Luckysheet SDK + CLI

> 旧版原文：Developed the LIMS platform in Vue 3 and TypeScript for sample management and SOP workflows, integrating the Luckysheet SDK and a CLI for one-command project scaffolding.

### 在哪看 ⭐(2026-08-18 更新：代码找到了，不再靠回忆)

`~/Desktop/BioMap/biomap-web-lims/src/views/sop/sop-edit/`

| 环节 | 文件 | 关键行 |
|---|---|---|
| 拿到 Luckysheet | `index.vue` | `:35` `const luckysheet = window.luckysheet` —— **全局变量，不是 npm import** |
| 挂载容器 | `index.vue` | `:9` 一个裸 `<div id="luckysheet" ref="lucky">`，Vue 不管里面 |
| 创建实例 | `index.vue` | `:208-211` `initSop()` → `luckysheet.create(initOptions(metaData))` |
| 初始数据 | `index.vue` | `:102-127` `loadExcelMetadata()`，三条来源：SOP 模板 / 流程创建 / 流程编辑，取不到就落 `metaExcel` 兜底 |
| 表格 → 应用 的桥 | `index.vue` | `:133-178` `cellRightClickConfig.customs` 三个自定义右键项：`SOP 配置JSON字段` / `SOP 配置数据验证` / `SOP Mark Fields`，各自 `openModal` 打开 Vue 弹窗 |
| 应用 → 表格 的桥 | `index.vue` | `:53-56` `setSheetSopJson()` 和 `:61-68` `setMark()`，用 `luckysheet.setCellValue()` 写回单元格 |
| 落库 | `index.vue` | `:95-100` `handleUpdate()` → `getAllSheets()`，**先把每个 sheet 的 `data` 置 `undefined`** 再存 |
| 防抖保存 | `index.vue` | `:74-93` `debounce(..., 2000, {leading:false})`，`hook.updated` 触发 |
| 尺寸自适应 | `index.vue` | `:186-206` `useResizeObserver` + `debounce(600)` + **「微抖动」判据**（宽度变化 < 20px 不重建） |
| 单元格扩展属性 | `MarkModal.vue` | 整个文件，把 `sopExpandProperty` 写进单元格 |

### 怎么讲（按真实实现，别再用上一版那段猜测）

**这份笔记上一版写的「把实例挂 ref 里、用 watch 监听 props 调命令式方法」是猜的，实际不是这样。** 真实做法：

1. **Luckysheet 是全局脚本，不是模块。** `window.luckysheet` 拿到，容器是一个 Vue 从不重渲染的裸 div —— 这就是命令式库和声明式框架的分界线：**把一块 DOM 整个划给它，Vue 不进去。**
2. **双向桥各走一条路**。表格 → 应用：靠 Luckysheet 的右键菜单扩展点 `cellRightClickConfig.customs`，点了就开 Vue 的 Modal。应用 → 表格：Modal 确认后调 `setCellValue()` 写回。**没有响应式绑定，两边靠事件和显式调用交换。**
3. **存的是配置不是数据**。`getAllSheets()` 拿到的对象里 `sheet.data` 是展开的整块单元格矩阵，体积极大；存之前挨个置 `undefined`，只留结构和自定义属性。这是这条 bullet 最值得讲的一个决定。
4. **保存靠 `hook.updated` + 2 秒防抖，`leading:false`** —— 用户连续编辑不会打接口，停手 2 秒才存一次。
5. **最脏的一个坑：Luckysheet 没有 resize API。** 容器尺寸变了只能整个 `create()` 重建。所以要 `useResizeObserver` + 600ms 防抖，还得加一条「宽度变化小于 20px 算抖动，不重建」的判据，再加 `isInit` 标志挡掉弹窗自身引起的尺寸变化 —— 否则右键开个弹窗，表格就整块闪一下、编辑状态全丢。

### 可能的追问

- **为什么不用 handsontable / ag-grid?** → Luckysheet 免费开源；ag-grid 企业版收费，handsontable 商用要授权。业务方要的是「像 Excel」——冻结行列、公式、多 sheet、导入导出 xlsx。
- **命令式 SDK 怎么和 Vue 共处?** → 见上面第 1、2 点。一句话版：**划一块 DOM 给它，交界处只走事件和显式调用，不试图把它塞进响应式系统。**
- **为什么右键菜单是集成点?** → 业务要的是「在某个单元格上挂 SOP 字段配置 / 校验规则 / Mark」，那是**单元格级别的元数据**，Luckysheet 本身不认识这些概念，只能借它的扩展点把自家 UI 挂上去。
- **为什么存之前要删 `sheet.data`?** → 那是渲染用的完整单元格矩阵，存进去 payload 会大一个量级，而且下次是靠模板 + 扩展属性重建的，不需要它。
- **重建整个表格的代价?** → 首屏要重新拉一次详情接口再 `create()`。所以才有防抖 + 抖动过滤 + `isInit`——这三层都是为了少重建。

---


### CLI（旧版 Bullet 1 后半句）

代码在 `~/Desktop/BioMap/biomap-cli`，实际长这样（不是上一版猜的那样）：

| 项 | 事实 |
|---|---|
| 包名 / 命令 | `@biomap/cli`，bin 是 **`bcli`** |
| 选项 | `bcli -c [name]` 建项目、`bcli -i <tpl>` 装模板、`-v` 版本（`index.js:11-20`，commander 的 `program.opts()` 取第一个键当命令分发） |
| 交互 | 用的是 **`prompts`**（不是 inquirer），`prompts.js` 里一份 `FRAMEWORKS` 列表 |
| 模板 | **只有三个**：`template-vue-ts-prettier`、`template-vue-ts-prettier-form-table`（带通用表单/表格）、`template-react-ts-prettier` |
| 着色 | `kolorist` |
| 版本 | 1.0.9 |

---

## Bullet 2:Feature-Driven 架构 + 自定义 ESLint 规则约束模块边界 ⭐

> 旧版原文：Led the React 18 and TypeScript architecture for Digital OS, the team's core consumer-facing product, enforcing feature boundaries with custom ESLint rules.

### 在哪看 ⭐(Prometheus 全部覆盖)
- **目录结构**:`src/` 下有 `app/`、`features/`、`components/`、`hooks/`、`lib/`、`types/`、`utils/`、`testing/`。每个 `features/*` 内部再分 `api/`、`components/`。
- **边界规则**:`.eslintrc.cjs:126-172`(`import/no-restricted-paths`,5 个 zone)
- **依赖方向图**:`.eslintrc.cjs:116-124`(注释里画了图)
- **命名规范**:`.eslintrc.cjs:261-269`(kebab-case 文件名)、`282-288`(kebab-case 文件夹)
- **import 顺序强制**:`.eslintrc.cjs:205-220`

### 怎么讲
- **Feature-Driven 的核心思想**:代码组织按"业务功能"划分,不按"技术类型"划分。
  - ❌ 传统:`components/` + `hooks/` + `services/` + `redux/`,一个功能改动要跨 4 个目录
  - ✅ Feature:`features/blog/`(内部含 api、components),一个功能一个目录内闭环
- **为什么需要 ESLint 强制?**:光靠"约定"没用,一定会有人在 `features/blog` 里 `import '../comments/xxx'`,几个月后就 spaghetti 了。ESLint 让违规在 IDE 里实时红波浪线,CI 阻止 merge,变成硬约束。
- **5 个 zone 的具体含义**(对着 `.eslintrc.cjs:129-170` 讲):
  1. `features/blog` 不能 import 其他 feature
  2. `features/comments` 不能 import 其他 feature
  3. `features/theme` 不能 import 其他 feature
  4. `features/*` 不能 import `app/`(features 是被使用的,不该知道上层)
  5. `components/hooks/lib/types/utils` 是最底层,不能反向 import `features/` 或 `app/`

### 可能的追问
- **Feature 之间需要共享逻辑怎么办?** → 提到 `components/` 或 `lib/` 层(下沉共享),或者通过 `app/` 层组合(上升)。绝不横向依赖。
- **为什么不用 monorepo(Nx/Turborepo)?** → 团队规模不够、构建复杂度不匹配。ESLint zone 是"轻量级 monorepo 隔离"。
- **`import/no-cycle` 为什么也开?** → 循环依赖会让模块初始化顺序不确定,可能拿到 undefined。见 `.eslintrc.cjs:174-182`。
- **文件名为什么强制 kebab-case?** → 跨平台一致性(macOS 大小写不敏感、Linux 敏感)+ 视觉上和组件名(PascalCase)区分,一眼能看出这是文件不是标识符。
- **这套架构参考了什么?** → bulletproof-react(alan2207/bulletproof-react),Prometheus 的 README 里说了。

---


## Bullet 3（历史版）: TanStack Query 三层 + 缓存失效 + Hover Prefetch ⭐

> 旧版原文：Layered TanStack Query in three tiers — API functions, queryOptions factories, typed hooks — single-source cache keys, mutation-driven invalidation, route preloading and hover prefetch: detail-page LCP under 500 ms.

### 在哪看 ⭐(Prometheus 是最全的一条)

#### 三层架构 —— 三个例子
| 层次 | 文件 | 行 |
|---|---|---|
| 分页查询 | `features/blog/api/get-posts.ts` | API fn: `50-54` / queryOptions: `72-77` / Hook: `96-104` |
| 单条查询 | `features/blog/api/get-post.ts` | API fn: `30-32` / queryOptions: `34-43` / Hook: `50-55` |
| 无限查询 | `features/blog/api/get-infinite-posts.ts` | API fn: `39-40` / infiniteQueryOptions: `54-66` / Hook: `77-78` |

#### 单一 cache key 来源
- `getPostsQueryOptions` 里的 `queryKey: ['posts', options]`(`get-posts.ts:74`)——**queryKey 只在 queryOptions 里定义,组件层不写**。
- 这样只要 queryKey 定义变了,所有引用它的地方自动同步,不会出现"两个地方各写一份 key 导致缓存不命中"的经典 bug。

#### mutation 触发缓存失效
- 例:`features/comments/api/create-comment.ts:96-98`
```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['comments', postId] });
}
```
- 评论创建成功 → invalidateQueries → React Query 自动把 `['comments', postId]` 标记为 stale → 页面上正在用这个 key 的 hook 自动重新请求 → UI 更新。**不需要手动更新 state。**

#### QueryConfig / MutationConfig 类型工具
- `src/lib/react-query.ts:74-86`(`ApiFnReturnType`)、`91-99`(`QueryConfig`)、`116-127`(`MutationConfig`)
- 作用:让调用方可以覆盖 `queryOptions` 的部分配置(如 `enabled`、`staleTime`),但**不能覆盖 `queryKey` / `queryFn`**(用 `Omit` 排除)。
- 用到的 TS 高级特性:`Awaited<ReturnType<T>>`、`Omit<X, K>`、`satisfies`(见 `react-query.ts:52` QueryClient 配置)。

#### 路由级预加载
❌ Prometheus 目前没做(是可以加的,用 React Router 7 的 `loader` 或 `route.lazy` 里 prefetch)。这一条**只能靠回忆 BioMap** 项目:那边用的是路由跳转前 `queryClient.prefetchQuery(queryOptions)`。

#### Hover Prefetch ⭐
- `features/blog/components/post-card.tsx:76-84`(`prefetchPost` 函数)
- `features/blog/components/post-card.tsx:97`(`onMouseEnter={prefetchPost}`)
- 原理详见 `post-card.tsx` 顶部注释(30-60 行):
  1. 鼠标悬停(通常 200–500ms 才点击)
  2. `queryClient.prefetchQuery(getPostQueryOptions(slug))` 拉数据写入缓存
  3. 用户真正点击 → 路由跳转 → 详情页 `usePost(slug)` 命中同一份 fresh 缓存 → 挂载时不再发第二个请求

### 怎么讲(高级问法)
- **为什么用 prefetchQuery 而不是自己 fetch?** → 结果自动写入 React Query 缓存,详情页的 useQuery 用同一个 queryKey 直接命中,不用自己搭桥。
- **prefetchQuery 会不会总是发请求?** → 不会；它会按 `staleTime` 判断缓存是否仍然 fresh。用户点击过快、预取失败或数据已 stale 时，详情页仍可能需要网络，不能把“零请求”说成每次点击的保证。

### 可能的追问
- **staleTime 和 gcTime 的区别?** → staleTime = 数据多久后变 stale(默认 0,任何 mount 都会 refetch);gcTime = 缓存多久后被垃圾回收(默认 5min)。Prometheus `react-query.ts:50` 把 staleTime 设成 1 分钟。
- **cache key 用对象作为一部分,为什么能命中?** → React Query 对 queryKey 做深比较(不是引用相等)。所以 `['posts', { page: 1 }]` 两次调用能命中同一个缓存。
- **无限查询和分页查询能不能共用 queryKey?** → **不能**。所以 `get-infinite-posts.ts:56` 特意加了 `'infinite'` 前缀区分,避免缓存互相覆盖。
- **Hover Prefetch 会不会浪费带宽?** → 用户 hover 但不点击时确实浪费。但一般情况下 hover→click 转化率高;而且 stale 数据缓存里也就多个几十 KB。可以通过 `hoverDelay`(如 100ms 后才 prefetch)进一步优化。
- **LCP 是什么?怎么测的?** → Largest Contentful Paint,首屏最大内容元素的渲染时间。用 Chrome DevTools Performance 或 web-vitals 库测量。目标 <2.5s(Core Web Vitals);本项目命中缓存后接近 0。

---


## Bullet 4:Radix UI 组件库 + Storybook + CVA + MSW Mock 层 ⭐

> 旧版原文：Built a design system on Radix UI, Storybook and CVA, plus an MSW mock layer that let frontend delivery run independent of backend progress.

### 在哪看 ⭐(Prometheus 全部覆盖)

#### Radix UI + 无障碍
- `src/components/ui/dialog/index.tsx`(整个文件)——Dialog 是 Radix 用法最完整的例子:Portal、Overlay、Content、Title、Description、Close、`data-[state=open]` 属性选择器做动画
- `src/components/ui/button/index.tsx:49-51`(`Slot` 用于 `asChild` 多态)
- 关键概念在 `dialog/index.tsx:1-63` 顶部注释里详细讲了(Radix 原语的分工:逻辑归框架,样式归开发者)

#### CVA 类型安全变体
- `src/components/ui/button/index.tsx:69-112`(`buttonVariants` 定义)
- `src/components/ui/button/index.tsx:127-132`(`ButtonProps` 用 `VariantProps<typeof buttonVariants>` 提取变体类型)
- `src/components/ui/badge/index.tsx:31-50`(Badge 的 CVA,更简单的例子)

#### Storybook
- `.storybook/main.ts`(整个)——配置(stories glob、addons、framework)
- `.storybook/preview.ts`(整个)——全局配置(引入 Tailwind CSS、backgrounds、controls matchers)
- `src/components/ui/button/button.stories.tsx`(整个)——7 个 story 覆盖 variant + size + disabled
- `src/components/ui/badge/badge.stories.tsx`(整个)——含 `render` 函数展示 AllVariants
- `src/components/ui/dialog/dialog.stories.tsx`(整个)——含 sr-only 标题的无障碍 case

#### MSW + @mswjs/data
- `src/testing/mocks/db.ts:42-66`(`models` 定义:`post` 和 `comment`)
- `src/testing/mocks/db.ts:69`(`factory(models)` 创建内存数据库)
- `src/testing/mocks/db.ts:85-106`(loadDb —— 浏览器用 localStorage / Node 用文件)
- `src/testing/mocks/db.ts:125-130`(persistDb —— 变更后写回)
- `src/testing/mocks/handlers/posts.ts` / `comments.ts` / `tags.ts`(handler 定义)
- `src/testing/mocks/browser.ts`(浏览器端 setup)
- `src/testing/mocks/server.ts`(Node 端 setup —— 测试用)

### 怎么讲

#### Radix + Tailwind + CVA 的分层理由
- **Radix**:管无障碍、键盘导航、状态、Portal、Focus trap。这些自己写非常难做对。
- **Tailwind**:管样式。原子类避免 CSS-in-JS 的运行时开销和 CSS 命名冲突。
- **CVA**:管"同一个组件的多个视觉变体"。传统写法是一堆 if/else 拼 className,CVA 让变体定义变成声明式的对象,还能通过 `VariantProps<typeof buttonVariants>` 反推出 TS 类型(`variant: 'default' | 'destructive' | ...`)。
- 三者搭配 = **shadcn/ui 的官方模式**。Prometheus 完全对照这个模式。

#### MSW 是什么
- 传统 mock:开发时用 `mockjs`,测试时用 Jest 的 `jest.mock`,两套逻辑。
- **MSW 的核心创新**:用 **Service Worker** 拦截真实的 `fetch/XHR` 请求,业务代码完全不知道自己在被 mock。同一份 handler 代码在开发环境和测试环境都能跑。
- **@mswjs/data 的作用**:让 mock 拥有真实的 CRUD 能力(不只是返回死数据),测试更真实。

#### 前后端解耦的实际意义
- 后端刚定完接口 schema 没实现 → 前端直接用 MSW mock 一份,业务逻辑照常写完
- 联调时把 mock 关掉(`main.tsx` 里控制 `enableMocking()`),业务代码零改动就切到真后端
- **效果:前后端可以真正并行,不再"等接口"**

### 可能的追问
- **CVA 和 tailwind-variants / stitches 的区别?** → CVA 是最轻量的(只做 className 拼装 + 类型推断);tailwind-variants 更专门为 Tailwind 优化;stitches 是 CSS-in-JS(有运行时)。本项目用 CVA 因为它零运行时。
- **Radix 为什么不自带样式?** → "headless UI" 理念:UI 库只管行为和无障碍,样式给开发者完全控制。避免"想改一点样式改不了"的痛。
- **MSW 的 Service Worker 在生产会不会拦截真实请求?** → 不会。`enableMocking()` 只在开发环境调用(通常靠 `import.meta.env.DEV` 判断)。生产 build 不会注册 Service Worker。
- **@mswjs/data 为什么不用 Faker?** → 两者结合的:`@mswjs/data` 提供数据库能力(CRUD、约束),`@ngneat/falso`(见 `package.json:20`)负责生成假数据填充。见 `src/testing/data-generators.ts`。
- **Storybook 的 `autodocs` tag 是什么?** → 加了 `tags: ['autodocs']` 后 Storybook 会自动生成一个 Docs 页,把 argTypes / stories 组合成文档。见 `button.stories.tsx:38`。
- **story 里的 args 和 render 什么时候用哪个?** → 简单组件用 args(自动渲染 `<Component {...args} />`);复合组件(如 Dialog 需要多个子组件组合)用 render(见 `dialog.stories.tsx`)。

---

---

## 面试前一晚过一遍的 Checklist

**BioMap 仓库（Bullet 1）**

- [ ] 打开 `biomap-web-lims/src/views/sop/sop-edit/index.vue`，不看注释讲清：全局 `window.luckysheet` + 裸 div、右键菜单 → Vue Modal → `setCellValue()` 这条双向桥
- [ ] 讲得出存之前把 `sheet.data` 置 `undefined` 的理由
- [ ] 讲得出「没有 resize API」逼出来的三层防护：600ms 防抖 + 宽度 <20px 算抖动 + `isInit`
- [ ] `biomap-cli`：说得清 `bcli -c` / `-i`、三个模板、以及它解决了什么重复劳动

**Prometheus（Bullet 2–4）**

- [ ] 打开 `.eslintrc.cjs`，不看注释讲清 5 个 zone 各是什么
- [ ] 打开 `get-posts.ts`，讲清「三层」分别是什么、为什么这样分
- [ ] 打开 `create-comment.ts`，讲清 `invalidateQueries` 的自动刷新机制
- [ ] 打开 `post-card.tsx`，讲清 Hover Prefetch 的时序（hover → prefetch → click → cache hit）
- [ ] 打开 `button/index.tsx`，讲清 CVA 的 `variants` / `VariantProps` / `Slot`(asChild)
- [ ] 打开 `dialog/index.tsx`，讲清 Radix 的 Portal / Overlay / focus 管理
- [ ] 打开 `db.ts`，讲清 `@mswjs/data` 的 `factory + models` + 浏览器/Node 双环境持久化
- [ ] `yarn dev` 跑起来，开 React Query DevTools，自己 hover 一张卡片验证 prefetch 生效
- [ ] `yarn storybook` 跑起来，3 个 story 都能打开

---

## 还撑不住的一条

**路由级预加载（Bullet 3 里的 `route preloading`）** —— Prometheus 只做了 hover prefetch，路由级 preload 没实现；BioMap 那边是路由跳转前 `queryClient.prefetchQuery(queryOptions)`，这条只能靠回忆讲，指不到行号。
