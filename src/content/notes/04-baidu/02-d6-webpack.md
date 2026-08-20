---
title: "Day 6 · Webpack 3 → 5 迁移"
tier: must
section: 百度 · Day 6–7
icon: landmark
day: 6
level: A
status: done
---

# Day 6 · Webpack 迁移这条怎么讲

> 🔴 **必看**。⚠️ **这条 bullet 的五个数字 Day 1 全审过了**，这里只补概念层和口播稿，追问直接跳回去。

## 30 秒口播稿（改一改就能用）

> 这是个跑了几年的老项目，构建还停在 Webpack 3，本地改一行代码要等几分钟，包也在慢慢变大。我把它迁到了 5。
>
> **迁移本身的难点不是改配置，是十来个包不兼容**——有的被官方替代品换掉（ExtractText 换 MiniCssExtract、CommonsChunk 换 SplitChunks），有的直接被 Webpack 5 内置能力取代可以删掉（file-loader / url-loader 换成 Asset Modules），还有自研插件因为 tapable 从 v1 换到 v2 全要改写。**最有意思的一类是 Webpack 5 不再自动注入 Node polyfill**，升级后报的是「Can't resolve 'crypto'」，看着像依赖装漏了，其实是它停掉了一个我们从来不知道存在的行为。
>
> **结果是包体积降了大约 15%，本地热构建时间降了 70%**——前者主要来自那些不再注入的 polyfill 和更强的 tree shaking，后者来自 Webpack 5 的 filesystem 持久化缓存。

## 一、Webpack 在干什么（被问原理时的骨架）

```
Entry 入口
  → Loader 链处理（倒序应用：use: ['style-loader','css-loader'] 从 css-loader 开始）
    → AST 分析 import/require，找依赖
      → 递归构建【依赖图 dependency graph】
        → Plugin 在各个 hook 点介入
          → 按 splitChunks 规则分组打包成 chunk
            → Output 到 dist
```

| 概念 | 一句话 |
|---|---|
| **Loader** | 把非 JS 资源转成 JS 能识别的模块（作用在**单个文件**上） |
| **Plugin** | 挂在构建生命周期的 hook 上，做 loader 做不了的事（作用在**整个构建**上） |
| **Module** | 一切都是模块，JS/CSS/图片都是 |
| **Chunk** | 一组模块打包在一起的输出单元，通常一个 chunk = 一个 .js |

> **「loader 和 plugin 差在哪」是高频题**：**loader 是文件级的转换器，plugin 是构建级的扩展点。** loader 只能改一个文件的内容，plugin 能改整个产物、能加文件、能改 chunk 分组。

## 二、Webpack 5 的五个关键变化

| 变化 | 影响 |
|---|---|
| **Persistent Cache**（`cache: { type: 'filesystem' }`） | ⭐ **70% 构建提速的主要来源**——中间结果存磁盘，没变的 module 直接读，跳过 loader 链 |
| **Node polyfill 移除** | ⭐ **体积下降的主要来源**，同时也是不兼容的一大类 |
| **Asset Modules** | 内置四种资源类型，**替代 file-loader / url-loader / raw-loader** |
| **Tree Shaking 增强** | 对 CommonJS interop 处理更好，能摇掉更多死代码 |
| **`moduleIds: 'deterministic'` 成为默认** | ⭐ **长效缓存的前提**——Webpack 4 的自增 id 会因为插入模块而全体移位，导致所有 contenthash 变化 |

## 三、五个追问，直接跳回 Day 1

| 问题 | 去哪 | 一句话预习 |
|---|---|---|
| **10+ 不兼容包，举个具体案例** | [#9](/docs?section=numbers&item=n09-incompatible) | 讲四类破坏性变化，主推 **Node polyfill 移除**（症状和原因对不上，有故事性） |
| **SplitChunks 改了什么？runtime chunk 解决什么？** | [#10 补充](/docs?section=numbers&item=n10b-splitchunks) | ⚠️ **`runtimeChunk` 不是 SplitChunksPlugin 的选项**；抽出来是为了防止任何 chunk 变动都连累 entry 的 hash |
| **contenthash 和长效缓存的关系** | [#10 补充 · 实践四](/docs?section=numbers&item=n10b-splitchunks) | 文件名带 contenthash 只是前提，**还要 moduleIds 稳定**，否则加一个依赖全站缓存失效 |
| **filesystem cache 缓存的是什么？** | [#11](/docs?section=numbers&item=n11-build-time) | 每个 module 编译后的中间结果。**cache key = 内容 hash + loader 版本 + config hash + 依赖 hash** |
| **15% 的体积从哪来？** | [#10](/docs?section=numbers&item=n10-bundle-size) | ⚠️ **SplitChunks 不减少总体积**，它重新分配体积。降幅来自 polyfill 移除 + tree shaking + Terser |

## 四、两个必须自己先知道的口径

**① 70% 是「本地热构建」**

冷构建**反而略慢**（要额外写缓存），而且**这个提升在 CI 上默认拿不到**——CI 每次都是全新容器，得把 `node_modules/.cache/webpack` 显式做成 CI 缓存产物。**简历上写 `local` 那个词是准确的限定，不是凑字数。**

**② 简历那句话的因果是错配的**

> `extracting shared runtime through SplitChunksPlugin and turning on persistent caching — bundle size down ~15%, local build times down 70%`

**破折号把两个动作和两个结果笼统绑在一起**，但真实对应是：拆分 → **缓存命中率**（句子里没写）；持久化缓存 → 构建时间 ✅；**体积 → 来自 polyfill 移除和 tree shaking（句子里没提）**。

**推荐改法**（见 [#10](/docs?section=numbers&item=n10-bundle-size) 讨论）：

> Led a Webpack 3-to-5 migration across 10+ incompatible packages: split vendor and runtime into separately-hashed chunks so a business change no longer invalidates them, dropped the automatic Node polyfills, and turned on the filesystem cache — bundle size down ~15%, warm local builds down 70%.

**三个动作各自对上自己的结果**，顺带把 cold/warm 口径也补进去了。
