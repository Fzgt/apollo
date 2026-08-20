---
title: "Day 5 · 把约定变成约束"
tier: must
section: BioMap · Day 5
icon: microscope
day: 5
level: B
status: done
---

# Day 5 · 把约定变成约束

> 🔴 **必看**。covers bullet ②（ESLint 边界）和 ④（MSW + 设计系统）。**这两条表面没关系，其实是同一个思想的两次应用**——合起来讲比分开讲各强一倍。

## ⭐ 统领这一天的一句话

> **「文档是约定，ESLint 是约束。」**
>
> 约定靠人记得住，约束靠工具挡得住。团队一大、人一换，约定就会漂——**唯一不漂的是「做不到」。**

| | 约定（会漂） | 约束（挡得住） |
|---|---|---|
| **架构边界** | README 里画一张依赖方向图 | `import/no-restricted-paths`——**违规直接编译报错** |
| **前后端解耦** | "接口先约定好，后端慢慢写" | **MSW 拦在网络层**——前端跑的是真实请求路径 |

**面试里先抛这句话，再用两个例子落地。** 这比逐条介绍 ESLint 规则高一个层次——**展示的是判断力，不是工具熟练度。**

## 一、ESLint 怎么强制依赖方向

`.eslintrc.cjs:116-124` 注释里画了图，`:126-172` 把它变成五个 zone：

```
app/ ──→ features/ ──→ components/ hooks/ lib/ types/ utils/
箭头方向是允许的依赖方向，反向一律禁止。
```

| Zone | 挡住什么 |
|---|---|
| **1–3** | **feature 之间互相引用** |
| **4** | features 引 app —— 下层反向依赖上层 |
| **5** | 共享层引 features/app —— **共享层被业务污染** |

外加 `import/no-cycle: 'error'`（`:182`）。

**为什么这三条值钱**：

- **feature 隔离防的是大泥球**——blog 引了 comments 一个工具函数、comments 引了 blog 一个类型，**两个 feature 就焊死了**：想删 comments 删不掉，想让新人只改 blog 他得先读懂 comments。**要通信只能通过上层编排或下沉共享层**，这样每个 feature 才是**可独立删除、可独立理解**的
- **共享层不能反向引**——`components/Button` 一旦引了 `features/blog`，它就不再通用了
- **`no-cycle` 防的是真实运行时 bug**——模块初始化顺序不确定，**可能拿到 `undefined`**

**生产级**：**规则必须进 CI**（不进 CI 等于没有，和 [Day 4 的 CI gate](/docs?section=beyz&item=d4-deploy) 同一个道理）；规模大了上 **`dependency-cruiser`**（能生成依赖图、定义更复杂的架构规则）或 Nx 的 tag 约束；**规则要和目录结构一起演进**，加了新 feature 就要加 zone，否则慢慢变成摆设。

## 二、⭐ 为什么 MSW 优于假 fetch（题眼：拦截位置决定测什么）

```
组件 → 自定义 hook → API 函数 → axios/fetch → ❶ HTTP 网络层 → 服务器
      ↑ mock 这里    ↑ 这里      ↑ 这里         ↑ MSW 拦这里
```

| Mock 的位置 | 下面这些还是不是真的 |
|---|---|
| mock 掉 hook | ❌ API 函数、请求组装、拦截器、序列化全跳过 |
| mock 掉 API 函数 | ❌ axios 实例、baseURL、header、拦截器、错误映射全跳过 |
| `jest.mock('axios')` | ⚠️ 请求配置和拦截器逻辑还是没跑到 |
| **MSW（网络层）** | ✅ **上面全部真实执行**，只有最后一跳没出去 |

> **一句话：MSW 拦在网络层，所以你测的是真实的请求路径。**
>
> **这和 [Periplus 的 scripted seam](/docs?section=periplus&item=n14-server-tests) 是完全同一个原则**——`ScriptedClient` 只覆写 `_chat`，schema 校验和重试都还在真跑；抓网页换的是 httpx 的传输层，robots、限流、重定向全是真测的。**两个项目串起来讲：「seam 要放在最接近进程边界的位置，越靠外，被测的真实代码越多。」**

**三条 MSW 独有的收益**：**同一套 handler 浏览器和 Node 通用**（`setupWorker` 给开发和 Storybook，`setupServer` 给测试，**mock 逻辑只写一份**）；**前端能独立跑起来**（这就是简历 `let frontend delivery run independent of backend progress` 的字面意思）；**`@mswjs/data` 给的是有状态的 mock**——POST 一条评论 GET 就能查到，**能测完整交互流程而不只是渲染**。

**已经做对的一条**：`setup-tests.ts:37` 的 `onUnhandledRequest: 'error'`——**没匹配 handler 的请求直接报错，不会静默穿透到真实网络**。

> ⚠️ **必须主动交代的风险**：**MSW 的 mock 会和真实接口漂移。** 后端改了字段名，你的测试全绿、线上全炸。**生产级**：handler 从 OpenAPI 生成，再配契约测试（**MSW 保证前端"按约定跑得通"，契约测试保证"约定没被后端改掉"**）。**说出这一点比只讲好处更能证明你真用过。**

## 三、设计系统（简版，面试价值低于前两块）

| 工具 | 一句话 |
|---|---|
| **Radix UI** | **给行为不给样式**——键盘导航、焦点管理、ARIA、点外面关闭，**这些是最容易做错也最不该重复造的部分** |
| **CVA** | 把 `size × variant × state` 写成类型安全的配置，`VariantProps` 自动导出类型，**不用手拼 className** |
| **design tokens** | 单一来源，主题切换只换 token |
| **Storybook** | 组件的独立开发环境和文档，**配合 MSW 就能脱离后端做交互演示** |

**`asChild` 值得单独提**：用 Radix 的 `Slot` 把样式"套"到子元素上，`<Button asChild><Link/></Button>` 渲染出来是 `<a>` 而不是 `<button>` 套 `<a>`——**语义和无障碍都正确**。

> 「整套的目的是**让『用错』变难**，和 ESLint 边界是同一个思路。」
