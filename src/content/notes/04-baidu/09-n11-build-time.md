---
title: "#11 · 70% build-time reduction"
section: 百度 · Day 6–7
icon: landmark
tier: ref
day: 6
level: 前置
status: done
---

# #11 · `local build times down 70%`

> **材料说明**：百度代码不在本机，材料是 `LEARNING_NOTES_BAIDU.md` + 回忆。
>
> 这条的技术解释很简单（persistent cache），**难的全在口径**——因为 persistent cache 的收益**完全取决于是冷构建还是热构建**，答错这一点，整个数字就是错的。

## 对应简历原句

Baidu 第 4 条 bullet（v40）：

> Led a Webpack 3-to-5 migration across 10+ incompatible packages, extracting vendor and runtime chunks and turning on persistent caching — bundle size down ~15%, **local build times down 70% on warm builds**.

---

> **2026-08-20 改过**：原句是 `extracting shared runtime through SplitChunksPlugin ... local build times down 70%.`。**两处已解决**——插件名归错（`runtimeChunk` 不是 SplitChunksPlugin 的选项）和 cold/warm 口径都修了。**因果错配仍在**：拆分买到的是缓存命中率，体积下降来自 polyfill 移除和 tree shaking，句子里没提。


## 一、这 70% 是从哪来的

主要来自 Webpack 5 的 **persistent cache**：

```js
cache: {
  type: 'filesystem',                 // 缓存写到磁盘（node_modules/.cache/webpack）
  buildDependencies: {
    config: [__filename],             // 配置文件变了就整体失效
  },
}
```

**它的工作方式**：把每个 module 编译后的中间结果存到磁盘。下次 build 时，没变的 module 直接从磁盘读，**跳过 loader 链**（babel 转译、TS 编译这些最贵的步骤）。

**失效逻辑**（能讲清楚是加分项）：每个 module 的 cache key = 内容 hash + loader 版本 hash + config hash + 依赖模块 hash。**任何一个变了就 miss，重新编译。**

`buildDependencies` 是让你显式声明「这些文件变了要整体失效」——比如 `webpack.config.js` 自己。

---

## 二、⚠️ 最关键的口径：冷构建还是热构建

**persistent cache 的特性是：第一次更慢，之后快很多。**

笔记里记的量级：

| | 耗时 |
|---|---|
| 首次 build（写缓存） | ~5 min |
| 二次 build（读缓存） | ~30 sec |

**所以「降了 70%」一定指的是热构建（warm build，有缓存的二次及以后构建）。**

**而冷构建（cold build，第一次或缓存被清掉之后）可能反而比升级前更慢**——因为要额外付出「把中间结果序列化写到磁盘」的开销。

> **这是这条最容易翻车的地方。** 面试官只要问一句「那第一次构建呢？」，答不上来就说明你没真正理解这个缓存。
>
> **主动说反而加分**：「冷构建其实略微变慢了，因为要写缓存；收益全在之后每一次热构建上。日常开发一天要 build 几十次，所以这个取舍很划算。」

---

## 三、⚠️ 第二个口径：local 还是 CI

**简历写的是 `local build times`——这个限定词是对的，而且很重要。**

**因为 persistent cache 在 CI 上默认是不生效的：**

```
CI 每次跑都是一个全新容器
  → node_modules/.cache/webpack 不存在
    → 每次都是冷构建
      → 不但没有 70% 提升，还比以前慢一点（要写缓存）
```

**要让它在 CI 上生效，必须把缓存目录做成 CI 的缓存产物**（GitHub Actions 的 `actions/cache`、GitLab CI 的 `cache:` 配置），把 `node_modules/.cache/webpack` 在 job 之间持久化。

> **能讲出这一层，说明你不只是照着文档抄了一段配置。** 而且它正好解释了简历为什么特意写 `local`——**这个词不是凑字数，是个准确的限定。**

---

## 四、怎么测（工具链）

### 工具一：`time` —— 最实在

```bash
time npm run build
```

**做前后对比时这个最不容易出错**，因为它量的就是「你从敲回车到能干别的事」这段真实时间。

### 工具二：`speed-measure-webpack-plugin` —— 定位瓶颈

```js
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
module.exports = new SpeedMeasurePlugin().wrap(config);
```

输出**每个 loader、每个 plugin 各花了多少时间**。

**这才是「优化构建速度」的正确工作流**：先测出是谁慢，再针对性优化。**上来就抄一堆配置是猜，不是优化。**

### 工具三：webpack 内置 stats

```js
stats: { timings: true }
```

或命令行 `webpack --progress --profile`，直接打印各阶段耗时。

### 工具四：Node 内置 profiler

```bash
node --cpu-prof ./node_modules/.bin/webpack
```

生成 `.cpuprofile`，丢进 Chrome DevTools 的 Performance 面板看火焰图。**排查诡异的慢（比如某个 loader 在做正则回溯）时用这个。**

---

## 五、按「审什么」逐条过

### ① cold 还是 warm

**warm。** 见第二节，并主动补一句冷构建反而略慢。

### ② local 还是 CI

**local。** 见第三节，并主动补一句 CI 要缓存 `node_modules/.cache/webpack` 才有效。

### ③ 样本与机器

**样本**——构建耗时波动很大，必须说清怎么取的：

- 至少跑 **3–5 次取中位数**，不要报最快的那次
- **第一次要丢掉**：OS 的 page cache、磁盘预热都会影响
- 每次之间清干净状态（要测冷构建就删 `node_modules/.cache`）

**机器**——构建是 CPU + 磁盘 IO 密集型：

- **CPU 核数**（webpack 部分阶段能并行）
- **内存**（大项目容易触发 GC 甚至 OOM）
- **磁盘**——**SSD 和机械盘差别巨大**，而 persistent cache 恰恰是读写磁盘的，**在机械盘上收益会明显打折**

**一句话**：「在我的开发机上，跑 5 次取中位数」——把机器和取数方法说出来，这个数就站得住。

---

## 六、一个更诚实的对比方式

**「webpack 3 无缓存」对比「webpack 5 有缓存」，严格说是在比两件事**：升级本身的收益 + 缓存的收益，混在一起了。

**更公平的做法是列个矩阵**：

| | webpack 3 | webpack 5 无缓存 | webpack 5 + persistent cache |
|---|---|---|---|
| **冷构建** | A | B | B′（略慢于 B） |
| **热构建** | A（3 没有持久缓存，每次都等于冷） | B | **C（快很多）** |

**那 70% 说的是 A → C。** 这里面：

- **A → B** 是 webpack 5 本身的性能改进
- **B → C** 是 persistent cache 的功劳

**如果被追问「多少是升级带来的、多少是缓存带来的」，能画出这张表就赢了**——就算你说「当时没有拆开测，主要归因是缓存」，也比答不上来强得多。

---

## 七、一句话答法

> 70% 指的是本地热构建，也就是有缓存的二次及以后构建，用 `time npm run build` 跑五次取中位数量的。主要来自 Webpack 5 的 filesystem persistent cache：把每个 module 编译后的中间结果存到磁盘，下次没变的直接读，跳过 babel 那些最贵的 loader。**要说清两件事：一是冷构建其实略微变慢了，因为要额外写缓存，收益全在后续每次热构建上；二是这个提升在 CI 上默认拿不到，因为 CI 每次都是全新容器、缓存目录不存在，得把 `node_modules/.cache/webpack` 显式做成 CI 缓存产物才行——简历上写 `local` 就是这个意思。** 严格讲这个对比里混了 webpack 5 自身的性能改进和缓存两部分收益，当时没有拆开单独测。
