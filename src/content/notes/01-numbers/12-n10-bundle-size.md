---
title: "#10 · ~15% bundle reduction"
section: Day 1 · 数字口径
icon: calculator
day: 1
level: 前置
status: done
---

# #10 · `bundle size down ~15%`

> **材料说明**：百度代码不在本机，材料是 `LEARNING_NOTES_BAIDU.md` + 回忆。
>
> 但这条是 20 条里**方法最容易复现的**——包体积测量的整套流程你今天就能在任意一个 webpack 项目上跑一遍。**说不出具体工具是不该发生的。**

## 对应简历原句

Baidu 第 4 条 bullet（v40）：

> Led a Webpack 3-to-5 migration across 10+ incompatible packages, extracting shared runtime through SplitChunksPlugin and turning on persistent caching — **bundle size down ~15%**, local build times down 70%.

---

## 一、怎么测（工具链）

### 工具一：`webpack-bundle-analyzer` —— 主力

```bash
npm i -D webpack-bundle-analyzer
```

```js
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
plugins: [new BundleAnalyzerPlugin()]
```

build 完自动开一个网页，画出**矩形树图**：每个方块是一个模块，面积就是体积，点进去能一层层下钻到具体是哪个 `node_modules` 包占了多大。

**它默认显示三个数字，这三个数字就是下面「压缩方式」那道审计题的答案**：

| 指标 | 含义 |
|---|---|
| **stat** | 打包前的原始大小 |
| **parsed** | 打包后（**minify 过**）的大小 |
| **gzip** | gzip 压缩后的大小 |

**报「降了 15%」时必须说清是哪一个。**

### 工具二：webpack 自己的 stats

```bash
webpack --json > stats.json
```

这份 JSON 里有每个 chunk、每个 module 的精确体积，是 analyzer 的数据源。**要做前后对比、要写脚本自动比，用这个。**

（`webpack --profile --progress` 则是在终端直接打印 chunk 列表和体积，快速看一眼够用。）

### 工具三：最土也最实在的办法

```bash
du -sh dist/
ls -lh dist/*.js
```

**做前后对比时，这个反而最不容易出错**——因为它量的就是「用户最终要下载的那堆文件」，没有任何解释空间。

### 工具四：CI 里做体积回归

`size-limit`、`bundlesize`、`statoscope`——在 CI 里设一个阈值，PR 让体积涨超过 N% 就红。

**这条能主动提就很加分**：它说明你想的不是「优化了一次」，而是**「优化完怎么不退回去」**。

### 对比方法（关键）

```
同一份业务代码
  ├── 用 webpack 3 的配置 build 一次  → 记录 dist 总大小
  └── 用 webpack 5 的配置 build 一次  → 记录 dist 总大小
```

**两次 build 必须是同一个 commit 的业务代码**，否则量的是业务代码的变化，不是构建工具的变化。

---

## 二、按「审什么」逐条过

审计表要的三件事：**比较范围、压缩方式、构建模式**。这三个每一个都能让 15% 这个数字翻倍或者减半。

### ① 比较范围：算的是哪些文件

| 要不要算 | 影响 |
|---|---|
| **JS** | 一定算 |
| **CSS** | 抽成独立文件后要不要计入？ |
| **图片 / 字体** | Asset Modules 改变了它们的输出方式，算不算？ |
| **sourcemap** | ⚠️ **算不算能让总数差一倍以上** |

**sourcemap 是最大的陷阱**——`.map` 文件常常比 `.js` 本身还大，但用户根本不下载它。

**正确口径：只算用户实际会下载的产物，不含 sourcemap。** 说的时候直接讲明：「不含 sourcemap 的 JS + CSS 总量」。

### ② 压缩方式：raw / gzip / brotli

**同一份产物，三种口径的降幅是不一样的。**

原因是 **gzip 会把一部分差异「吃掉」**：如果你减掉的是重复度高的代码，raw 降了 15%，gzip 后可能只降 8%——因为那部分重复内容本来就被压缩得很好。

**反过来**，如果你减掉的是一整个依赖（比如 Node polyfill），那 raw 和 gzip 的降幅会比较接近。

**推荐报 gzip 数字**，因为那是用户真实的下载量（服务器基本都开 gzip/brotli）。**但一定要说明报的是哪个。**

### ③ 构建模式：production / development

**只有 `mode: 'production'` 的数字有意义。** development 模式不做 minify、不做 tree shaking、还带 eval sourcemap，体积能大好几倍，量它没有任何价值。

**这个问题看起来很基础，但它是个筛人的问题**——答不上说明根本没自己跑过。

---

## 三、15% 是从哪来的（归因）

**必须能拆开讲，不能只说「升级到 5 就小了」。**

| 来源 | 说明 | 量级 |
|---|---|---|
| **Node polyfill 移除** | Webpack 3/4 自动注入 `crypto`/`stream`/`buffer` 等 polyfill，5 不再注入 | **可能是最大头**，几十 KB 起 |
| **Tree Shaking 增强** | 5 对 CommonJS interop 分析更好，`sideEffects` 标记更精细，能摇掉更多死代码 | 中 |
| **内置 Terser 版本更新** | 压缩算法本身有改进 | 小 |
| **Asset Modules** | 小图片自动内联 base64、大图单独出文件，不再经过 loader 中转 | 小 |
| **依赖顺带升级** | 换掉的那 10+ 个包，新版本本身可能更小 | 不确定 |

> **⚠️ 注意 `SplitChunksPlugin` 不在这张表里**——这是这条 bullet 最容易被问住的地方。
>
> **代码分割通常不减少总体积，它是重新分配体积。** 详见 [#10 补充 · SplitChunks 实践](/docs?section=numbers&item=n10b-splitchunks)。
>
> 简历那句 `extracting shared runtime through SplitChunksPlugin ... — bundle size down ~15%` 读起来像是拆分带来了体积下降，**如果面试官顺着这个逻辑问，你得能主动纠正**：拆分带来的是缓存命中率，体积下降来自上面那张表。**主动纠正这一点，比什么都能证明你真懂。**

---

## 四、一句话答法

> 用 `webpack-bundle-analyzer` 和 `dist` 目录总大小做的前后对比，同一个 commit 的业务代码分别用 3 和 5 的配置各 build 一次，production 模式，只算用户会下载的 JS 加 CSS、不含 sourcemap，报的是 gzip 后的数字。降幅主要来自 Webpack 5 不再自动注入 Node polyfill——我们有依赖引到了 crypto 和 stream，这块占了大头；其次是 tree shaking 对 CommonJS interop 的处理变好、内置 Terser 版本更新和 Asset Modules。**要说明一点：SplitChunks 不减少总体积，它改善的是缓存命中率，体积那 15% 不是它带来的。**
