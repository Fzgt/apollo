---
title: "④ Webpack 3 → 5 迁移"
tier: must
section: 百度
icon: landmark
day: 6
level: A
status: done
---

# ④ Webpack 3 → 5 迁移

> **简历原句**
>
> Led a **Webpack 3-to-5 migration across 10+ incompatible packages**, **extracting vendor and runtime chunks** and **turning on persistent caching** — **bundle size down ~15%**, **local build times down 70% on warm builds**.
>
> ---
>
> 主导 Webpack 3 到 5 的迁移，处理 10 多个不兼容的包，拆出 vendor 与 runtime chunk 并开启持久化缓存 —— 包体积下降约 15%，本地热构建时间下降 70%。

## 这条 bullet 在讲什么

**这条有五个可被追问的点，而它们的难度完全不一样：**

| 点 | 难在哪 |
|---|---|
| `10+ incompatible packages` | ⭐ **要举得出具体案例**，答不出案例这个数就是空的 |
| `extracting vendor and runtime chunks` | ⭐ **拆分买到的不是体积，是缓存命中率** —— 讲反就露馅 |
| `persistent caching` | ⭐ **冷构建反而更慢**，这是最容易翻车的口径 |
| `bundle size down ~15%` | 三个口径（算哪些文件 / 压缩方式 / 构建模式）**每一个都能让数字翻倍或减半** |
| `local build times down 70%` | ⭐ `local` 这个词是准确的限定 —— **CI 上默认拿不到** |

## 30 秒口播稿

> 这是个跑了几年的老项目，构建还停在 Webpack 3，本地改一行代码要等几分钟，包也在慢慢变大。我把它迁到了 5。
>
> **迁移本身的难点不是改配置，是十来个包不兼容** —— 有的被官方替代品换掉，有的直接被 Webpack 5 内置能力取代可以删掉，还有自研插件因为底层钩子库换了大版本全要改写。⭐ **最有意思的一类是 Webpack 5 不再自动注入 Node polyfill**，升级后报的是「Can't resolve 'crypto'」，**看着像依赖装漏了，其实是它停掉了一个我们从来不知道存在的行为。**
>
> **结果是包体积降了大约 15%，本地热构建时间降了 70%** —— **前者主要来自那些不再注入的 polyfill 和更强的 tree shaking，后者来自 Webpack 5 的文件系统持久化缓存。**

## 一、先把四个术语定义清楚

**① 打包器在干什么**

浏览器不能直接跑几百个 `import` 互相引用的源文件。**打包器从入口出发，顺着 `import` 把依赖找齐，转换成浏览器能跑的形式，合并成少数几个文件。**

| 概念 | 一句话 |
|---|---|
| **Module** | 一切都是模块，JS/CSS/图片都是 |
| **Loader** | 把非 JS 资源转成 JS 能识别的模块，作用在**单个文件**上 |
| **Plugin** | 挂在构建生命周期的钩子上，作用在**整个构建**上 |
| **Chunk** | 一组模块打包在一起的输出单元，通常一个 chunk = 一个 `.js` |

⭐ **「loader 和 plugin 差在哪」是高频题：loader 是文件级的转换器，plugin 是构建级的扩展点。** loader 只能改一个文件的内容；plugin 能加文件、能改整个产物、能改 chunk 怎么分组。

**② polyfill，以及为什么 Webpack 会「自动注入」**

**polyfill = 用能跑的代码补上一个环境里缺失的能力。**

Node 里有 `crypto`、`path`、`buffer` 这些**内置模块**，浏览器里没有。⭐ **Webpack 4 及以前，你在浏览器代码里 `require('crypto')`，它会悄悄替你换成一个用 JS 重写的浏览器版实现塞进包里。**

⭐ **Webpack 5 停掉了这个行为**，理由是：**大多数时候你只是不小心引到了一个 Node-only 的库，而它偷偷替你塞了几十 KB 进包。**

**③ tree shaking（摇树）**

**把「引进来了但从来没用到」的代码从产物里删掉。** ⭐ **它依赖 ES 模块的静态结构** —— `import { a } from 'x'` 不运行代码就能看出你只用了 `a`；而 `require('x').a` 是运行时才知道的，**摇不动**。

**④ contenthash 与长效缓存**

产物文件名写成 `main.a3f9c2.js`，⭐ **那串哈希是文件内容算出来的**：内容没变 → 哈希不变 → **浏览器直接用缓存，一个字节都不下载**；内容变了 → 文件名变 → 当成新文件下载。**这就叫长效缓存。**

## 二、⭐ 10+ 不兼容包：按类讲，别背包名清单

**列十个包名不如讲四类原因。面试官要听的是你理解了破坏性变化在哪，不是你记性好。**

| 类别 | 例子 | 处理方式 |
|---|---|---|
| **1. 插件被官方替代** | `ExtractTextPlugin`→`MiniCssExtractPlugin`、`CommonsChunkPlugin`→`SplitChunksPlugin`、`UglifyJSPlugin`→`TerserPlugin` | 换包 + 改配置 |
| **2. 被内置能力取代** | `file-loader`/`url-loader`/`raw-loader` → **Asset Modules** | ⭐ **最爽的一类 —— 整个依赖直接删掉** |
| **3. 插件 API 变了** | tapable v1 → v2 | ⚠️ **最花时间** —— 见下 |
| **4. Node polyfill 移除** | `crypto`、`stream`、`buffer` | **最值得主讲** —— 见下 |

**第 3 类为什么最花时间**：

```js
compiler.plugin('emit', (compilation, callback) => { ... })                    // 老写法
compiler.hooks.emit.tapAsync('MyPlugin', (compilation, callback) => { ... })   // 新写法
```

⭐ **受影响的是自研插件和没人维护的小众插件** —— 官方生态早就跟上了，**但公司内部自己写的那些没人管，没有升级文档，只能自己读源码改。**

### ⭐ 主讲案例：Node polyfill 移除（它的报错和原因对不上，有故事性）

升级后直接报：

```
Module not found: Error: Can't resolve 'crypto' in '...'
BREAKING CHANGE: webpack < 5 used to include polyfills for node.js core
modules by default. This is no longer the case.
```

⭐ **第一眼像是依赖装漏了，实际是 webpack 主动停止了一个你从来不知道存在的行为。**

**三种处理方式，能说清取舍是加分项：**

| 做法 | 代价 |
|---|---|
| `resolve.fallback: { crypto: require.resolve('crypto-browserify') }` | 最快，**但把体积加回来了** |
| `resolve.fallback: { crypto: false }` | 确认浏览器端走不到那段代码时用，⭐ **体积收益最大** |
| 换掉那个依赖 | 最干净，最费时间 |

⭐ **这个案例的额外价值：它同时是「体积为什么降了 15%」的主要来源 —— 同一个变更解释了两个数字，串起来讲显得你真的经历过这次迁移。**

### 备用案例：`CommonsChunkPlugin` → `SplitChunksPlugin`

**它不是「改个名字」，是心智模型整个换了：**

| | 思路 |
|---|---|
| `CommonsChunkPlugin` | ⭐ **命令式** —— 你指定「把这几个 entry 的公共部分抽到名叫 vendor 的 chunk 里」，抽几层要自己一层层写 |
| `SplitChunksPlugin` | ⭐ **声明式** —— 你写规则（什么样的模块归哪组、优先级、多小不拆），webpack 自动分组 |

**所以迁移是把「我指定要哪些 chunk」重写成「我描述什么样的模块该被拆出去」。**

> **`10+` 数的是什么**：建议口径是**包数**（`package.json` diff 里增删换掉的条目），**因为它是唯一有客观依据的算法**。

## 三、⭐ SplitChunks 到底买到了什么（讲反就露馅）

⭐ **先破除最常见的误解：它不是用来减小体积的。**

Webpack 默认一个 entry 打成一个 bundle，问题出在**缓存**：

```
bundle.[hash].js   ←  react + lodash + antd + 你的业务代码，全在里面
```

**你改了一行业务代码 → 整个 bundle 的 contenthash 变了 → 用户要把 react、lodash、antd 全部重新下载一遍**，哪怕它们一个字节都没变。

**拆分之后**：`vendors.[hash].js`（很久不变）+ `main.[hash].js`（天天变）—— 改业务代码只有 `main` 的哈希变。

⭐ **所以 SplitChunks 的产出是「缓存命中率」，不是「更小的包」。** 首次访问的总下载量基本不变（甚至因为每个 chunk 有额外包装代码而**略微增大**），**收益全在后续访问**。唯一真正减少总量的情况是**去重**。

### 三条实践

**① `chunks: 'all'`** —— 默认值是 `'async'`，**只拆动态 `import()` 出来的部分，同步 import 的完全不管**。⭐ **大多数项目「配了 splitChunks 但没效果」，原因就是这一行。**

**② 别打成一个大 vendor** —— 把所有 `node_modules` 打成一个 1MB 的 `vendors.js`，⭐ **只要升级任何一个依赖，哪怕是个只用一次的小工具库，整个 vendors 的哈希就变，用户重下 1MB**。正确做法是**按变化频率分层**：框架层（react 这些，几乎不变）/ 大库层（超过阈值的各自独立）/ 其余共用代码。**这套分层正是 Next.js 内部用的。**

⭐ **核心思想一句话：按变化频率分组，让不变的和常变的不要绑在同一个文件里。**

**③ `runtimeChunk: 'single'`** —— **runtime 是 webpack 注入的一小段自己的代码**：模块注册表、`__webpack_require__`、⭐ **以及 chunk → 文件名的映射表**。

⭐ **关键在那张映射表：任何一个 chunk 的 contenthash 变了，这张表就变。而这段 runtime 默认打在 entry chunk 里 —— 于是改任何一个 chunk，entry 的哈希也跟着变，用户连 entry 一起重下。**

抽成独立文件后它只是个**几 KB 的小文件**，chunk 哈希变化只影响它。**简历里 `runtime chunks` 说的就是这个。**

## 四、⭐ 长效缓存的前提：确定性的 module id

**这一条缺了，前面全白做。**

**Webpack 内部给每个模块编一个 id。Webpack 4 默认用自增数字**：第 1 个模块是 1，第 2 个是 2……

⚠️ **问题**：你在中间插入一个新依赖，**它后面所有模块的 id 全部往后移一位**。模块 id 写在产物里 → **所有产物内容都变了 → 所有 contenthash 都变了 → 用户的全站缓存一次性全部失效。**

⭐ **你什么业务代码都没改，只是加了一个依赖，用户却要重下所有文件。**

**Webpack 5 默认 `moduleIds: 'deterministic'`** —— 按模块路径算一个短哈希当 id，**加一个模块不影响其他模块的 id**。

> ⭐ **这个例子很值得讲：它说明「文件名带 contenthash」只是长效缓存的必要条件，不是充分条件。底下的模块 id 不稳定，上面的哈希就是假的。** 这也是 3 → 5 升级白拿的收益。

### ⭐ 怎么验证缓存策略有效（这个方法比列配置强得多）

```bash
npm run build && ls dist/*.js > before.txt
# 改一行业务代码
npm run build && ls dist/*.js > after.txt
diff before.txt after.txt
```

⭐ **拆分做得好的话，diff 里应该只有业务 chunk 的文件名变了**，`framework`、`vendors` 一个都不动。

| diff 出一大片 | 大概率原因 |
|---|---|
| 所有文件都变了 | moduleIds 不是 deterministic |
| entry chunk 跟着变 | runtime 没抽出去 |
| vendors 跟着变 | 业务代码和依赖被分到同一个组了 |

⭐ **这个方法的价值在于：它把「长效缓存」这个抽象目标变成了一个能跑、能看、能截图的验证。**

### 拆分不是越细越好（预期追问）

三条约束：**`maxInitialRequests` 默认 30**；**HTTP/1.1 下每个域名只有 6 个并发连接**，拆成 20 个文件反而排队；⭐ **小文件的压缩率更差** —— gzip 靠上下文找重复，**把一个 100KB 拆成 10 个 10KB，gzip 后总和会比原来大**。**所以 `minSize`（默认 20KB）是有道理的。**

## 五、15% 体积：三个口径 + 归因

### 怎么测

| 工具 | 用途 |
|---|---|
| ⭐ **`webpack-bundle-analyzer`** | 矩形树图，**面积就是体积**，能下钻到具体哪个包。默认显示 **stat（原始）/ parsed（minify 后）/ gzip** 三个数 |
| `webpack --json > stats.json` | 精确数据源，**要写脚本自动对比用这个** |
| ⭐ `du -sh dist/` | **最土也最实在** —— 量的就是用户最终要下载的那堆文件，没有解释空间 |
| `size-limit` / `bundlesize` | ⭐ **在 CI 里设阈值，PR 让体积涨超过 N% 就红** —— 能主动提这条很加分，**它说明你想的不是「优化了一次」，而是「优化完怎么不退回去」** |

⚠️ **对比方法**：两次 build 必须是**同一个 commit 的业务代码**，否则量的是业务变化不是构建工具变化。

### ⭐ 三个口径，每一个都能让数字翻倍或减半

| 口径 | 关键 |
|---|---|
| **算哪些文件** | ⚠️ **sourcemap 是最大的陷阱** —— `.map` 常常比 `.js` 还大，**但用户根本不下载它**。正确口径：**只算用户实际会下载的产物，不含 sourcemap** |
| **压缩方式** | ⭐ **gzip 会把一部分差异「吃掉」** —— 减掉的如果是重复度高的代码，raw 降 15%、gzip 后可能只降 8%。**推荐报 gzip（那是用户真实下载量），但必须说明报的是哪个** |
| **构建模式** | ⭐ **只有 production 的数字有意义** —— development 不 minify、不 tree shaking，体积能大好几倍。**这个问题看起来基础，但它是个筛人的问题** |

### 归因：15% 从哪来

| 来源 | 量级 |
|---|---|
| ⭐ **Node polyfill 移除** | **可能是最大头**，几十 KB 起 |
| **Tree Shaking 增强** | 中 |
| 内置 Terser 版本更新 | 小 |
| Asset Modules | 小 |
| 依赖顺带升级 | 不确定 |

> ⚠️ ⭐ **注意 `SplitChunks` 不在这张表里 —— 这是这条 bullet 最容易被问住的地方。** 简历那句读起来像是拆分带来了体积下降，**如果面试官顺着这个逻辑问，你要主动纠正：拆分带来的是缓存命中率，体积下降来自上面这张表。主动纠正这一点，比什么都能证明你真懂。**

## 六、70% 构建时间：两个口径

### 它从哪来

```js
cache: {
  type: 'filesystem',                 // 缓存写到磁盘
  buildDependencies: { config: [__filename] },   // 配置文件变了就整体失效
}
```

**把每个模块编译后的中间结果存到磁盘，下次没变的模块直接读，⭐ 跳过整条 loader 链**（babel 转译、TS 编译这些最贵的步骤）。

**失效逻辑**（讲清楚是加分项）：⭐ **每个模块的缓存 key = 内容哈希 + loader 版本哈希 + 配置哈希 + 依赖模块哈希，任何一个变了就 miss。**

### ⚠️ 口径一：冷构建反而更慢

| | 耗时量级 |
|---|---|
| 首次构建（写缓存） | ~5 min |
| 二次构建（读缓存） | ~30 sec |

⭐ **所以「降了 70%」一定指热构建。而冷构建可能比升级前更慢** —— 要额外付出把中间结果序列化写到磁盘的开销。

> ⭐ **面试官只要问一句「那第一次构建呢？」，答不上就说明没真正理解这个缓存。主动说反而加分**：「冷构建其实略微变慢了，收益全在之后每一次热构建上。**日常开发一天要 build 几十次，所以这个取舍很划算。**」

### ⚠️ 口径二：`local` 这个词是准确的限定

⭐ **persistent cache 在 CI 上默认不生效：CI 每次都是全新容器，缓存目录不存在，每次都是冷构建** —— 不但没有 70% 提升，**还比以前慢一点**。

**要生效必须把 `node_modules/.cache/webpack` 显式做成 CI 的缓存产物**（`actions/cache` 之类）。

> ⭐ **能讲出这一层，说明你不只是照着文档抄了一段配置。简历上写 `local` 不是凑字数，是个准确的限定。**

### 怎么测

| 工具 | 用途 |
|---|---|
| ⭐ `time npm run build` | **最实在** —— 量的就是「你从敲回车到能干别的事」这段真实时间 |
| `speed-measure-webpack-plugin` | 输出**每个 loader、每个 plugin 各花了多少时间**。⭐ **这才是优化构建速度的正确工作流：先测出是谁慢，再针对性优化。上来就抄一堆配置是猜，不是优化** |
| `webpack --progress --profile` | 直接打印各阶段耗时 |
| `node --cpu-prof` | 生成火焰图，**排查诡异的慢**（比如某个 loader 在做正则回溯） |

**样本和机器**：⭐ **至少跑 3–5 次取中位数，第一次要丢掉**（OS 的 page cache、磁盘预热会影响）。机器上要说 CPU 核数、内存、⭐ **尤其是磁盘 —— persistent cache 恰恰是读写磁盘的，在机械盘上收益明显打折**。

### ⭐ 一个更诚实的对比方式

**「webpack 3 无缓存」对比「webpack 5 有缓存」，严格说是在比两件事**：升级本身的收益 + 缓存的收益，混在一起了。

| | webpack 3 | webpack 5 无缓存 | webpack 5 + 缓存 |
|---|---|---|---|
| **冷构建** | A | B | B′（略慢于 B） |
| **热构建** | A（3 没有持久缓存，每次都等于冷） | B | **C（快很多）** |

⭐ **那 70% 说的是 A → C。其中 A → B 是 webpack 5 本身的性能改进，B → C 才是缓存的功劳。** 被追问「多少是升级带来的、多少是缓存带来的」，**能画出这张表就赢了** —— 就算答「当时没有拆开测，主要归因是缓存」，也比答不上来强得多。

## 七、⚠️ 简历那句话的因果是错配的（自己先知道）

> `extracting vendor and runtime chunks and turning on persistent caching — bundle size down ~15%, local build times down 70%`

**破折号把两个动作和两个结果笼统绑在一起了**，但真实对应是：

| 动作 | 真实结果 |
|---|---|
| 拆分 vendor/runtime chunk | → **缓存命中率**（句子里没写这个结果） |
| 开持久化缓存 | → 构建时间 ✅ 这条对上了 |
| ⭐ **（句子里没提的）polyfill 移除 + tree shaking** | → **体积 −15%** |

**推荐改法：**

> Led a Webpack 3-to-5 migration across 10+ incompatible packages: split vendor and runtime into separately-hashed chunks so a business change no longer invalidates them, dropped the automatic Node polyfills, and turned on the filesystem cache — bundle size down ~15%, warm local builds down 70%.

**三个动作各自对上自己的结果**，顺带把冷/热口径也补进去了。
