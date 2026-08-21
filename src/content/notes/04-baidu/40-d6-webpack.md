---
title: "④ Webpack 3 → 5 迁移"
tier: must
section: 百度
icon: landmark
day: 6
level: A
status: done
---

# Webpack 迁移这条怎么讲

> 🔴 **必看**。**这里给概念层和口播稿，五个数字的核准各自跳到对应的速查篇。**

## 30 秒口播稿（改一改就能用）

> 这是个跑了几年的老项目，构建还停在 Webpack 3，本地改一行代码要等几分钟，包也在慢慢变大。我把它迁到了 5。
>
> **迁移本身的难点不是改配置，是十来个包不兼容**——有的被官方替代品换掉，有的直接被 Webpack 5 内置能力取代可以删掉，还有自研插件因为底层钩子库换了大版本全要改写。**最有意思的一类是 Webpack 5 不再自动注入 Node polyfill**，升级后报的是「Can't resolve 'crypto'」，看着像依赖装漏了，其实是它停掉了一个我们从来不知道存在的行为。
>
> **结果是包体积降了大约 15%，本地热构建时间降了 70%**——前者主要来自那些不再注入的 polyfill 和更强的 tree shaking，后者来自 Webpack 5 的文件系统持久化缓存。

## 一、先把四个术语定义清楚

**① 打包器（bundler）在干什么**

浏览器不能直接跑几百个 `import` 互相引用的源文件（请求太多、老浏览器还不认 ES 模块）。**打包器从入口文件出发，顺着 `import` 把所有依赖找齐，转换成浏览器能跑的形式，合并成少数几个文件。**

```
Entry 入口
  → Loader 链处理（倒序应用：use: ['style-loader','css-loader'] 从 css-loader 开始跑）
    → 分析 import/require，找依赖
      → 递归构建【依赖图 dependency graph】
        → Plugin 在各个生命周期钩子点介入
          → 按 splitChunks 规则分组打包成 chunk
            → Output 到 dist
```

| 概念 | 一句话 |
|---|---|
| **Module（模块）** | 一切都是模块，JS/CSS/图片都是 |
| **Loader** | 把非 JS 资源转成 JS 能识别的模块，作用在**单个文件**上 |
| **Plugin** | 挂在构建生命周期的钩子上，作用在**整个构建**上 |
| **Chunk** | 一组模块打包在一起的输出单元，通常一个 chunk = 一个 `.js` 文件 |

> ⭐ **「loader 和 plugin 差在哪」是高频题**：**loader 是文件级的转换器，plugin 是构建级的扩展点。** loader 只能改一个文件的内容；plugin 能加文件、能改整个产物、能改 chunk 怎么分组。

**② polyfill 是什么，为什么 Webpack 会「自动注入」**

**polyfill = 用能跑的代码，补上一个环境里缺失的能力。**

Node 里有 `crypto`、`path`、`buffer` 这些**内置模块**，浏览器里没有。**Webpack 4 及以前，你在浏览器代码里 `require('crypto')`，它会悄悄替你换成一个用 JS 重写的浏览器版实现**，塞进包里。

⭐ **Webpack 5 停掉了这个行为**，理由是：**大多数时候你只是不小心引到了一个 Node-only 的库，而它偷偷替你塞了几十 KB 进包。**

> **所以这一个变化同时是「体积下降的主要来源」和「不兼容报错的一大类」** —— 一件事两个面，这个故事性正是它值得在面试里讲的原因。

**③ tree shaking（摇树）**

**把「引进来了但从来没用到」的代码从产物里删掉。**

名字来源是「摇一摇树，枯叶掉下来」。**它依赖 ES 模块的静态结构**——`import { a } from 'x'` 在不运行代码的情况下就能看出你只用了 `a`；而 `require('x').a` 是运行时才知道的，**摇不动。**

**④ contenthash 与长效缓存**

产物文件名写成 `main.a3f9c2.js`，**那串哈希是文件内容算出来的**。

- 内容没变 → 哈希不变 → **文件名不变 → 浏览器直接用缓存，一个字节都不下载**
- 内容变了 → 哈希变 → 文件名变 → 浏览器当成新文件下载

> ⭐ **这就叫「长效缓存」（long-term caching）**：给这些文件设一年的缓存过期时间也安全，**因为一旦变了文件名就换了。**

## 二、Webpack 5 的五个关键变化

| 变化 | 影响 |
|---|---|
| **持久化缓存**（`cache: { type: 'filesystem' }`） | ⭐ **70% 提速的主要来源**——把每个模块编译后的中间结果存到磁盘，下次构建时没变的模块直接读缓存，**整条 loader 链都跳过** |
| **Node polyfill 移除** | ⭐ **体积下降的主要来源**，同时也是不兼容的一大类 |
| **Asset Modules** | 内置了四种资源处理类型，**替代 file-loader / url-loader / raw-loader**，那三个包可以直接删 |
| **Tree Shaking 增强** | 对 CommonJS 混用的处理更好，能摇掉更多死代码 |
| ⭐ **`moduleIds: 'deterministic'` 成为默认** | **长效缓存的前提**，见下 |

### ⭐ 为什么 `moduleIds` 这条这么重要

**Webpack 内部给每个模块编一个 id。Webpack 4 默认用自增数字**：第 1 个模块是 1，第 2 个是 2……

**问题**：你在中间插入了一个新依赖，**它后面所有模块的 id 全部往后移一位。** 模块 id 是写在产物文件里的 → **所有产物的内容都变了 → 所有 contenthash 都变了 → 用户的全站缓存一次性全部失效。**

**`deterministic` 改成按模块路径算一个短哈希当 id** —— **加一个模块不影响其他模块的 id。**

> ⭐ **这个例子很值得讲**：它说明**「文件名带 contenthash」只是长效缓存的必要条件，不是充分条件。** 底下的模块 id 不稳定，上面的哈希就是假的。

## 三、五个追问，跳到对应速查篇

| 问题 | 去哪 | 一句话预习 |
|---|---|---|
| **10+ 不兼容包，举个具体案例** | [#9](/docs?section=baidu&item=n09-incompatible) | 四类破坏性变化，**主推 Node polyfill 移除**（症状和原因对不上，有故事性） |
| **SplitChunks 改了什么？runtime chunk 解决什么？** | [#10 补充](/docs?section=baidu&item=n10b-splitchunks) | ⚠️ **`runtimeChunk` 不是 SplitChunks 的选项** |
| **contenthash 和长效缓存的关系** | [#10 补充 · 实践四](/docs?section=baidu&item=n10b-splitchunks) | 见上面 `moduleIds` 那节 |
| **文件系统缓存缓存的是什么？** | [#11](/docs?section=baidu&item=n11-build-time) | 每个模块编译后的中间结果。**缓存 key = 内容哈希 + loader 版本 + 配置哈希 + 依赖哈希** |
| **15% 的体积从哪来？** | [#10](/docs?section=baidu&item=n10-bundle-size) | ⚠️ **SplitChunks 不减少总体积**，它重新分配体积 |

## 四、两个必须自己先知道的口径

**① 70% 是「本地热构建」**

**「冷构建」= 缓存目录是空的那一次；「热构建」= 之后有缓存可用的那些次。**

⭐ **冷构建反而略慢**（要额外把缓存写到磁盘）。而且**这个提升在 CI 上默认拿不到**——CI 每次都是全新容器，缓存目录是空的，**每次都是冷构建**。要拿到得把 `node_modules/.cache/webpack` 显式配置成 CI 的缓存产物。

> **简历上写 `local` 那个词是准确的限定，不是凑字数。被追问「CI 上也快 70% 吗」，答「默认不，因为每次都是冷构建」——这个回答本身就是加分项。**

**② 简历那句话的因果是错配的（自己先知道，别等被抓）**

> `extracting vendor and runtime chunks and turning on persistent caching — bundle size down ~15%, local build times down 70%`

**破折号把两个动作和两个结果笼统绑在一起了**，但真实对应是：

| 动作 | 真实结果 |
|---|---|
| 拆分 vendor/runtime chunk | → **缓存命中率**（句子里没写这个结果） |
| 开持久化缓存 | → 构建时间 ✅ 这条对上了 |
| **（句子里没提的）polyfill 移除 + tree shaking** | → **体积 −15%** |

**推荐改法**（讨论见 [#10](/docs?section=baidu&item=n10-bundle-size)）：

> Led a Webpack 3-to-5 migration across 10+ incompatible packages: split vendor and runtime into separately-hashed chunks so a business change no longer invalidates them, dropped the automatic Node polyfills, and turned on the filesystem cache — bundle size down ~15%, warm local builds down 70%.

**三个动作各自对上自己的结果**，顺带把冷/热口径也补进去了。
