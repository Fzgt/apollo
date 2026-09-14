---
title: "② Webpack 3 → 5 迁移"
tier: must
section: 百度
icon: landmark
day: 6
level: A
status: done
---

# ② Webpack 3 → 5 迁移

> **简历原句**
>
> Led a **Webpack 3-to-5 migration across 10+ incompatible packages**, **extracting vendor and runtime chunks** and **turning on persistent caching** — **bundle size down ~15%**, **local build times down 70% on warm builds**.
>
> ---
>
> 主导 Webpack 3 到 5 的迁移，处理 10 多个不兼容的包，拆出 vendor 与 runtime chunk 并开启持久化缓存 —— 包体积下降约 15%，本地热构建时间下降 70%。

## 先把词说清

**bundler（打包器）**：浏览器不能直接跑几百个互相 `import` 的源文件。打包器从入口出发顺着 `import` 找齐依赖，转换成浏览器能跑的形式，合并成少数几个文件。**在它的世界里一切都是模块**——JS、CSS、图片都是。

**loader**：**文件级**的转换器，把非 JS 资源转成模块。

**plugin**：挂在**构建生命周期钩子**上，作用在整个构建上。

**「loader 和 plugin 差在哪」是高频题，一句话答完**：**loader 只能改一个文件的内容，plugin 能加文件、能改整个产物、能决定 chunk 怎么分组。**

**chunk**：一组模块打包在一起的输出单元，**通常一个 chunk 对应一个 js 文件**。

**polyfill（垫片）**：用能跑的代码补上环境里缺失的能力。

**tree shaking（摇树）**：把引进来了但**从来没用到**的代码从产物里删掉。**依赖 ES 模块的静态结构**：具名 import 不运行代码就能看出你只用了哪一个导出，**运行时才决定的引用方式摇不动**。

**contenthash**：产物文件名里那串**由文件内容算出来**的哈希。**内容没变哈希就不变，浏览器直接用缓存，一个字节都不下载。**这个机制叫 **long-term caching（长效缓存）**。

**minify vs compress**：**minify 是删空格、改短变量名**；**gzip 是压缩传输**。**两个不是一回事，报体积时必须说清是 raw、minified 还是 gzipped。**

**cold build / warm build（冷构建 / 热构建）**：有没有可用的缓存。**这条 bullet 里最容易翻车的口径。**

## 这条要讲清什么

这句话里有**五个可被追问的点**，而它们的难度完全不一样：

1. **十几个不兼容的包**——要举得出具体案例，**答不出案例这个数就是空的**。
2. **拆 vendor 和 runtime chunk**——**买到的不是体积而是缓存命中率，讲反就露馅**。
3. **持久化缓存**——坑在于**冷构建反而更慢**。
4. **体积降 15%**——有**三个口径**，每一个都能让数字翻倍或者减半。
5. **本地构建时间降 70%**——**`local` 这个词是准确的限定**，因为 CI 上默认拿不到这个收益。

## 十几个不兼容的包：按类讲，别背包名清单

**列十个包名不如讲四类原因。**面试官要听的是你理解了破坏性变化在哪，不是你记性好。

**第一类：插件被官方替代。** `extract-text-webpack-plugin` → `mini-css-extract-plugin`，`CommonsChunkPlugin` → `SplitChunksPlugin`，`uglifyjs-webpack-plugin` → 内置 `TerserPlugin`。**换包加改配置，属于体力活。**

**第二类：被内置能力取代。** `file-loader` / `url-loader` / `raw-loader` 被 **Asset Modules** 收编。**这是最爽的一类，整个依赖直接删掉。**

**第三类：插件接口变了。** 底层的 `tapable` 升了大版本，注册钩子的写法从 `compiler.plugin('emit', fn)` 换成 `compiler.hooks.emit.tap('Name', fn)`。**这一类最花时间**，因为受影响的是**自研插件和没人维护的小众插件**——官方生态早就跟上了，但公司内部自己写的那些没人管，**没有升级文档，只能自己读源码改**。

**第四类：Node polyfill 移除。这是最值得主讲的一类。**

## 主讲案例：Node polyfill 移除

升级之后直接报错：

```
Module not found: Error: Can't resolve 'crypto' in '/src/utils'

BREAKING CHANGE: webpack < 5 used to include polyfills for node.js core
modules by default. This is no longer the case.
```

**第一眼看着像是依赖装漏了，实际是 Webpack 主动停止了一个你从来不知道存在的行为。**

Webpack 4 及以前，你在浏览器代码里引用 `crypto`，它会**悄悄替你换成一个用 JS 重写的浏览器版实现塞进包里**。Webpack 5 停掉了，理由是：**大多数时候你只是不小心引到了一个只能跑在 Node 上的库，而它偷偷替你塞了几十 KB 进包。**

**三种处理方式，能说清取舍是加分项：**

```js
resolve: {
  fallback: {
    crypto: require.resolve('crypto-browserify'),  // ① 最快，但把体积加回来了
    path: false,                                    // ② 确认走不到，体积收益最大
    // ③ 换掉那个依赖 —— 最干净也最费时间
  },
},
```

**这个案例的额外价值在于：它同时是体积为什么降了 15% 的主要来源。**同一个变更解释了两个数字，串起来讲显得你真的经历过这次迁移。

## 备用案例：CommonsChunkPlugin → SplitChunks

**它不是改个名字，是心智模型整个换了。**

**旧插件是命令式的**：你指定把这几个入口的公共部分抽到一个叫 vendor 的 chunk 里，想抽几层要自己一层层写。

**新插件是声明式的**：你写规则——什么样的模块归哪组、优先级多高、多小就不拆——**webpack 自动分组**。

所以迁移是**把「我指定要哪些 chunk」重写成「我描述什么样的模块该被拆出去」**。

### 当「最棘手的问题」讲

**它比 polyfill 那个更适合当棘手问题。** polyfill 有报错、有官方提示，改一行 `resolve.fallback` 就好。这个难在**不报错**：新旧插件之间没有一一对应的配置，构建照样通过、页面照样能跑，但拆出来的 chunk 已经跟原来不一样了。问题不在构建时暴露，而是后来才冒出来：缓存莫名失效、首屏变大、某个页面白屏。

**难点有三层：**

1. **旧配置翻译不过去。** Webpack 3 的常见写法是两个 CommonsChunkPlugin 叠在一起：一个用 `minChunks` 函数把 `node_modules` 抽成 vendor，另一个用 `name: 'manifest', minChunks: Infinity` 把 runtime 单独剥出来。到了 Webpack 5，前者对应 `cacheGroups`，后者对应 `runtimeChunk`。**简历里的 `runtime chunks` 就是从这里来的。** 旧写法是一条条命令，新写法是一组规则，没法逐行翻，只能先弄清旧配置实际拆出了什么，再用规则重新描述一遍。
2. **默认值会悄悄改结果。** `chunks` 默认 `'async'`，同步 import 完全不管；`minSize`、`maxInitialRequests` 的默认值也会让一部分规则不生效。**配置写对了，产物照样可能不对。**
3. **文件名变了。** 以前固定叫 `vendor.js`、`manifest.js`，现在 chunk 的名字和个数都由规则决定。凡是写死文件名的地方都会断：HTML 模板、服务端模板、预加载列表。

**怎么确认迁对了：不看配置，看产物。**

- 迁移前后各导出一份构建统计（`--json`），或者用 bundle analyzer 对比，看每个 chunk 里的模块有没有变：vendor 有没有被拆散，业务代码有没有混进 vendor。
- 改一行业务代码再构建，对比两次的文件名（下文「长效缓存」一节的方法），应该只有业务 chunk 的文件名变。

**两分钟的讲法。** 【】里填你的真实经历，想不起来就删，**不要编**：

1. **背景**：为什么非升不可【】，你负责哪一块【】。
2. **难在哪**：新旧插件没有一一对应，而且迁错了**不会报错**。
3. **怎么做**：先弄清旧配置实际拆出了什么，再用 `cacheGroups` 按变化频率分层，把 `manifest` 那段换成 `runtimeChunk: 'single'`。
4. **卡住的那一刻**：【上面三层里真实踩到的那一处，只讲发生过的】。
5. **怎么验证**：对比迁移前后的 chunk 组成，再做文件名 diff。
6. **结果**：业务代码发版，vendor 和 runtime 的哈希不再跟着变。
7. **复盘**：如果重来，动配置之前先把产物对比写成脚本，每改一步跑一次。

**可以直接说出口的英文：**

> The hardest part wasn't the errors. It was the part that didn't error. CommonsChunkPlugin and SplitChunks don't map one-to-one. The old config was two plugin instances: one pulled `node_modules` into a vendor chunk, and the other split the runtime out as a manifest chunk. In Webpack 5 those become `cacheGroups` and `runtimeChunk`. The build passed, but the chunks came out different, and nothing told us. 【what actually broke】 So I stopped trusting the config and compared the output instead: the chunk contents before and after, then a filename diff after a one-line change. In the end, only the business chunk's hash changed.

至于「十几个」数的是什么，**建议口径是包数**，也就是 `package.json` 的 diff 里增删换掉的条目，**因为它是唯一有客观依据的算法**。

## SplitChunks 到底买到了什么

**先破除最常见的误解：它不是用来减小体积的。**

Webpack 默认一个入口打成一个 bundle，**问题出在缓存上**。react、lodash、antd 和你的业务代码全在一个文件里，**你改了一行业务代码，整个 bundle 的 contenthash 就变了**，用户要把那三个库全部重新下载一遍，**哪怕它们一个字节都没变**。

拆分之后，vendor 那份很久不变，业务那份天天变，**改业务代码只有业务那份的哈希变**。

**所以拆分的产出是缓存命中率，不是更小的包。**首次访问的总下载量基本不变，甚至因为每个 chunk 有额外的包装代码而**略微增大**，收益全在后续访问。**唯一真正减少总量的情况是去重。**

**三条实践值得记：**

```js
optimization: {
  splitChunks: {
    chunks: 'all',              // ① 关键：默认只拆动态导入，同步 import 完全不管
    cacheGroups: {
      framework: { test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                   name: 'framework', priority: 40 },        // ② 按变化频率分层
      lib:       { test: /[\\/]node_modules[\\/]/, minSize: 100_000,
                   name: m => hashOf(m), priority: 30 },
      commons:   { minChunks: 2, priority: 20 },
    },
  },
  runtimeChunk: 'single',       // ③ runtime 抽成独立文件
},
```

**① `chunks: 'all'`。** 默认值只拆动态导入出来的部分，**同步 `import` 的完全不管**——大多数项目「配了 splitChunks 但没效果」，**原因就是这一行**。

**② 别把所有依赖打成一个大 vendor。** 一个 1MB 的 vendor 文件，**只要升级任何一个依赖，哪怕是个只用一次的小工具库，整个文件的哈希就变，用户重下 1MB**。正确做法是**按变化频率分层**：框架层几乎不变，超过阈值的大库各自独立，剩下的归共用代码。**这套分层正是 Next.js 内部在用的。**核心思想一句话：**按变化频率分组，让不变的和常变的不要绑在同一个文件里。**

**③ runtime 要抽成独立文件。** runtime 是 webpack 注入的一小段自己的代码，包含**模块注册表、模块加载函数，以及 chunk 到文件名的映射表**。**关键就在那张映射表**：任何一个 chunk 的哈希变了，这张表就变；而这段 runtime **默认打在入口 chunk 里**，于是**改任何一个 chunk，入口的哈希也跟着变，用户连入口一起重下**。抽成独立文件之后它只是个几 KB 的小文件。**简历里 `runtime chunks` 说的就是这个。**

## 长效缓存的前提：确定性的模块 id

**这一条缺了，前面全白做。**

Webpack 内部给每个模块编一个 id，**Webpack 4 默认用自增数字**。问题是**你在中间插入一个新依赖，它后面所有模块的 id 全部往后移一位**。模块 id 是写在产物里的，于是**所有产物内容都变了，所有 contenthash 都变了，用户的全站缓存一次性全部失效**——**你什么业务代码都没改，只是加了一个依赖。**

Webpack 5 默认改成 **`moduleIds: 'deterministic'`**，按模块路径算一个短哈希当 id，**加一个模块不影响其他模块的 id**。

这个例子很值得讲，因为它说明**「文件名带 contenthash」只是长效缓存的必要条件不是充分条件：底下的模块 id 不稳定，上面的哈希就是假的。**这也是三升五白拿的收益之一。

**验证缓存策略有效的方法比列配置强得多**：构建一次记下产物文件名，改一行业务代码，再构建一次，**对比两份文件名列表**。

- 拆分做得好的话，**差异里应该只有业务 chunk 的文件名变了**，框架和 vendor 一个都不动。
- **所有文件都变了** → 模块 id 不是确定性的。
- **入口 chunk 跟着变** → runtime 没抽出去。
- **vendor 跟着变** → 业务代码和依赖被分到同一个组了。

**这个方法的价值在于它把「长效缓存」这个抽象目标变成了一个能跑、能看、能截图的验证。**

**拆分也不是越细越好，三条约束要知道**：初始请求数有默认上限；**HTTP/1.1 下每个域名只有六个并发连接**，拆成二十个文件反而排队；**小文件的压缩率更差**——gzip 靠上下文找重复，把一个 100KB 的文件拆成十个 10KB，**压完总和会比原来大**。所以 `minSize` 阈值是有道理的。

## 体积降 15%：怎么测、什么口径、归因给谁

**怎么测。** `webpack-bundle-analyzer` 画矩形树图，面积就是体积，能下钻到具体哪个包，**默认会同时显示原始、minified 和 gzip 后三个数**。要写脚本自动对比就导出 `--json` 构建统计。**最土也最实在的办法是直接看产物目录的总大小**——量的就是用户最终要下载的那堆文件，**没有解释空间**。

还可以**在 CI 里用 size-limit 这类工具设红线**，PR 让体积涨超过某个比例就红；**能主动提这一条很加分**，因为它说明你想的不是「优化了一次」，而是「**优化完怎么不退回去**」。

**对比的时候两次构建必须是同一个 commit 的业务代码**，否则量的是业务变化不是构建工具变化。

**三个口径：**

1. **算哪些文件。** **sourcemap 常常比 js 本身还大，但用户根本不下载它**，所以正确口径是**只算用户实际会下载的产物，不含 sourcemap**。
2. **压缩方式。** **gzip 会把一部分差异吃掉**——减掉的如果是重复度高的代码，原始体积降 15%、**gzip 后可能只降 8 个点**。推荐报 gzip 后的数（那是用户真实下载量），**但必须说明报的是哪个**。
3. **构建模式。** **只有 production 模式的数字有意义**，development 不压缩不摇树，体积能大好几倍。

**这个问题看起来基础，但它是个筛人的问题。**

**归因。** 最大头很可能是 **Node polyfill 移除**，几十 KB 起。**tree shaking 增强**是中等量级。**内置 Terser 版本更新和 Asset Modules** 是小头。依赖顺带升级的影响不确定。

**注意 SplitChunks 不在这份归因里——这是这条 bullet 最容易被问住的地方。**简历那句读起来像是拆分带来了体积下降，如果面试官顺着这个逻辑问，**你要主动纠正：拆分带来的是缓存命中率，体积下降来自上面那几项。主动纠正这一点，比什么都能证明你真懂。**

## 构建时间降 70%：两个口径

**收益从哪来。**

```js
cache: {
  type: 'filesystem',                       // 中间结果落盘
  buildDependencies: { config: [__filename] },  // 配置本身也是构建依赖，改了整体失效
},
```

把每个模块**编译后的中间结果存到磁盘**，下次没变的模块直接读，**跳过整条 loader 链**，也就是 babel 转译、TS 编译这些最贵的步骤。

**失效逻辑讲清楚是加分项**：每个模块的缓存 key 是**内容哈希 + loader 版本哈希 + 配置哈希 + 依赖模块哈希**的组合，**任何一个变了就 miss**。

**口径一：冷构建反而更慢。** 首次构建要写缓存，是**分钟量级**；二次构建读缓存，是**几十秒量级**。**所以降了 70% 一定指热构建，而冷构建可能比升级前更慢**——要额外付出**把中间结果序列化写到磁盘**的开销。

**面试官只要问一句「那第一次构建呢」，答不上就说明没真正理解这个缓存。主动说反而加分**：冷构建其实略微变慢了，收益全在之后每一次热构建上；日常开发一天要构建几十次，所以这个取舍很划算。

**口径二：`local` 是准确的限定。** **持久化缓存在 CI 上默认不生效**，因为 CI 每次都是全新容器，缓存目录不存在，**每次都是冷构建**——不但没有那 70% 的提升，还比以前慢一点。**要生效必须把缓存目录显式做成 CI 的缓存产物。**

**能讲出这一层，说明你不只是照着文档抄了一段配置；简历上写 `local` 不是凑字数，是个准确的限定。**

**怎么测。** 最实在的是用 `time` 包住整条构建命令，**量的就是你从敲回车到能干别的事这段真实时间**。想知道慢在哪就用 `speed-measure-webpack-plugin`，它会输出每个 loader、每个 plugin 各花了多少时间——**这才是优化构建速度的正确工作流：先测出是谁慢，再针对性优化，上来就抄一堆配置是猜不是优化。**构建时带 `--progress --profile` 也能打印各阶段耗时。诡异的慢——比如某个 loader 在做正则回溯——用 CPU profile 生成火焰图排查。

**样本和机器都要交代**：至少跑三到五次取中位数，**第一次要丢掉**（操作系统的页缓存和磁盘预热会影响）。机器上要说 CPU 核数、内存，**尤其是磁盘——持久化缓存恰恰是读写磁盘的，在机械盘上收益明显打折。**

**一个更诚实的对比方式。** 拿「webpack 3 无缓存」对比「webpack 5 有缓存」，**严格说是在比两件事**：升级本身的收益，加上缓存的收益，混在一起了。webpack 3 没有持久缓存，每次都等于冷构建；webpack 5 不开缓存的冷热构建是同一个水平，比 3 快一些；webpack 5 开缓存之后冷构建略慢于不开，热构建快很多。**那 70% 说的是「webpack 3 的每次构建」到「webpack 5 的热构建」**，其中一段是 webpack 5 本身的性能改进，另一段才是缓存的功劳。

被追问「多少是升级带来的、多少是缓存带来的」，**能把这三档说清楚就赢了**；就算答「当时没有拆开测，主要归因是缓存」，也比答不上来强得多。

## 简历那句话的因果是错配的，自己先知道

破折号把两个动作和两个结果笼统绑在一起了，但**真实对应关系是**：

- **拆 vendor 和 runtime chunk** → **缓存命中率**（这个结果句子里根本没写）
- **开持久化缓存** → **构建时间**（这条对上了）
- **体积降 15%** → 真正来自 **polyfill 移除和 tree shaking 增强**（这两个动作句子里没提）

推荐的改法是把三个动作各自对上自己的结果，顺带把冷热口径补进去：

> Led a Webpack 3-to-5 migration across 10+ incompatible packages: **split vendor and runtime into separately-hashed chunks so a business change no longer invalidates them**, **dropped the automatic Node polyfills**, and **turned on the filesystem cache** — bundle size down ~15%, **warm** local builds down 70%.

## 英文怎么说

**最容易说错的三处。** **minify ≠ compress**：minify 是删空格改短变量名，gzip 是压缩传输，报体积时要说清是 **raw / minified / gzipped**。冷构建变慢说 **the cold build actually got slightly slower; the win is on every warm build after it**。拆分不减体积说 **splitting redistributes size; the 15% came from dropping the Node polyfills and better tree shaking**——**这句话本身就是一句很好的英文总结**。

**术语对照**：打包器 bundler ／ 依赖图 dependency graph ／ 产物 build output、artifacts ／ 破坏性变化 breaking change ／ 垫片 polyfill ／ 摇树 tree shaking ／ 死代码 dead code ／ 代码分割 code splitting ／ 长效缓存 long-term caching ／ 缓存失效 cache invalidation ／ 缓存命中率 cache hit rate ／ 确定性模块 id deterministic module ids ／ 冷热构建 cold build / warm build ／ 源码映射 sourcemap ／ 体积回归 size regression。

## 自检

1. 能否说出 loader 和 plugin 的分工？
2. 能否讲出四类不兼容，并把 Node polyfill 那一类展开成完整案例（报错原文 + 三种处理）？
3. 能否说清 SplitChunks 买到的是缓存命中率而不是体积？
4. 能否解释确定性模块 id 为什么是长效缓存的前提？
5. 能否说出体积口径的三个变量，并说明该报哪一个？
6. 能否主动说出冷构建变慢，以及 CI 上默认拿不到这个收益？
7. 能否指出简历那句话的因果错配，并给出改法？
8. 能否把 CommonsChunkPlugin → SplitChunks 讲成两分钟的棘手问题，说清「难在不报错」和「怎么靠产物验证」？
