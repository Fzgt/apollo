---
title: "#10 补充 · SplitChunks 实践"
section: Day 1 · 数字口径
icon: calculator
day: 1
level: 前置
status: done
---

# #10 补充 · SplitChunks 的常见优化实践

> 简历上关于 SplitChunks 只写了「抽出共享 runtime」，但**那其实不是 SplitChunksPlugin 干的事**，而且真正的收益也不在那儿。这一篇把这套东西完整讲一遍，用来回忆当时到底还做了什么。

## 对应简历原句

Baidu 第 4 条 bullet（v40）：

> Led a Webpack 3-to-5 migration across 10+ incompatible packages, **extracting shared runtime through SplitChunksPlugin** and turning on persistent caching — bundle size down ~15%, local build times down 70%.

---

## 零、先纠正一个精度问题

**`runtimeChunk` 不是 `SplitChunksPlugin` 的配置项。** 它俩是 `optimization` 下面**两个并列的独立选项**：

```js
optimization: {
  splitChunks: { ... },      // ← SplitChunksPlugin
  runtimeChunk: 'single',    // ← 独立选项，跟 splitChunks 没关系
}
```

所以 `extracting shared runtime through SplitChunksPlugin` 严格说是**把两件事安在了一个插件头上**。

**这不是硬伤**（懂 webpack 的人知道你在说什么），但**如果面试官正好很熟 webpack，这句话会露一下**。改法很简单：`extracting the webpack runtime and vendor chunks`——不点插件名就没问题了。

---

## 一、SplitChunks 到底解决什么问题

**先破除一个最常见的误解：它不是用来减小体积的。**

Webpack 默认一个 entry 打成一个 bundle。问题出在**缓存**：

```
bundle.[hash].js   ←  react + lodash + antd + 你的业务代码，全在里面
```

你改了一行业务代码 → 整个 bundle 的 contenthash 变了 → **用户要把 react、lodash、antd 全部重新下载一遍**，哪怕它们一个字节都没变。

**拆分之后：**

```
vendors.[hash].js   ←  react + lodash + antd     （很久不变）
main.[hash].js      ←  你的业务代码              （天天变）
```

改业务代码只有 `main` 的 hash 变，`vendors` 命中浏览器缓存。

> **所以 SplitChunks 的产出是「缓存命中率」，不是「更小的包」。**
> 总下载量在**首次访问**时基本不变（甚至因为每个 chunk 有额外的包装代码而**略微增大**），收益全在**后续访问**。
>
> 唯一真正减少总量的情况是**去重**：同一个模块被打进了多个 chunk，提取公共部分才真的省下体积。

---

## 二、默认配置先读懂

Webpack 5 的默认值（不写任何配置时就是这样）：

```js
splitChunks: {
  chunks: 'async',            // ⚠️ 只处理异步 chunk
  minSize: 20000,             // 小于 20KB 不值得单独拆
  minChunks: 1,               // 被引用几次才考虑拆
  maxInitialRequests: 30,     // 入口最多并行请求几个 chunk
  maxAsyncRequests: 30,
  cacheGroups: {
    defaultVendors: {
      test: /[\\/]node_modules[\\/]/,
      priority: -10,
      reuseExistingChunk: true,
    },
    default: {
      minChunks: 2,           // 被 2 个以上 chunk 用到才提
      priority: -20,
      reuseExistingChunk: true,
    },
  },
}
```

**四个核心概念：**

| 概念 | 作用 |
|---|---|
| `cacheGroups` | 分组规则。一个模块可能同时匹配多个组，`priority` 高的赢 |
| `test` | 匹配哪些模块（正则匹配路径，或写成函数） |
| `minChunks` | 被多少个 chunk 引用才提取 |
| `minSize` / `maxSize` | 太小的不值得拆（多一个请求）；太大的继续切 |

---

## 三、实践一：`chunks: 'all'`（最常见的第一个改动）

**默认 `chunks: 'async'` 意味着只拆动态 `import()` 出来的部分，同步 import 的完全不管。**

也就是说，如果你的应用没怎么用动态导入，**默认配置几乎什么都没拆**。

```js
splitChunks: { chunks: 'all' }
```

改成 `'all'`，初始 chunk 里的 `node_modules` 才会被提出去。**大多数项目「配了 splitChunks 但没效果」，原因就是这一行。**

---

## 四、实践二：别打成一个大 vendor

这是最容易被忽略、但收益最直接的一条。

**朴素做法**（webpack 3 时代 `CommonsChunkPlugin` 的典型用法，也是很多教程的写法）：

```js
cacheGroups: {
  vendor: { test: /[\\/]node_modules[\\/]/, name: 'vendors' }
}
```

把**所有** `node_modules` 打成一个 `vendors.js`。

**问题**：这个文件可能有 1MB。**只要升级任何一个依赖——哪怕是个只用了一次的小工具库——整个 vendors 的 hash 就变，用户重下 1MB。** 你为了缓存做的拆分，被最不常用的那个包给毁了。

**更好的做法：按「变化频率」分层。**

```js
cacheGroups: {
  // 框架层：几乎不变，单独一个 chunk
  framework: {
    test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types)[\\/]/,
    name: 'framework',
    priority: 40,
    enforce: true,        // 忽略 minSize/maxSize 等限制，强制拆
  },
  // 大库层：体积超过阈值的第三方各自独立
  lib: {
    test: (module) =>
      module.size() > 160000 && /node_modules/.test(module.identifier()),
    name: (module) => { /* 按包名生成稳定的 chunk 名 */ },
    priority: 30,
    minChunks: 1,
    reuseExistingChunk: true,
  },
  // 其余共用代码
  commons: {
    minChunks: 2,
    priority: 20,
  },
}
```

**这套分层策略正是 Next.js 内部用的**，能提一句「这是 Next.js 的默认策略」会显得你不是临时查的。

**核心思想一句话**：**按变化频率分组，让不变的和常变的不要绑在同一个文件里。**

---

## 五、实践三：`runtimeChunk: 'single'`

**先讲清楚 runtime 是什么。**

Webpack 打包后会注入一小段自己的代码，负责：模块注册表、`__webpack_require__` 实现、**异步 chunk 的加载逻辑和 chunk → 文件名的映射表**。

**关键在最后那个映射表**。它长这样：

```js
// 大意
{ 3: "vendors.a1b2c3.js", 4: "framework.d4e5f6.js", ... }
```

**任何一个 chunk 的 contenthash 变了，这张表就变了。** 而这段 runtime 默认是打在 entry chunk 里的——于是：

> 改任何一个 chunk → 映射表变 → **entry chunk 的 hash 也跟着变** → 用户连 entry 一起重下。

**解法**：把 runtime 抽成独立文件。

```js
optimization: { runtimeChunk: 'single' }
```

抽出来的是个**几 KB 的小文件**。之后 chunk hash 变化只影响它，entry chunk 保持稳定。

**简历里 `extracting shared runtime` 说的就是这个**——收益是保护 entry chunk 的缓存，代价是多一个 HTTP 请求（几 KB，通常还会被内联进 HTML）。

---

## 六、实践四：contenthash + 确定性的 module id

**这一条是长效缓存的前提，缺了它前面全白做。**

首先文件名必须带 contenthash：

```js
output: { filename: '[name].[contenthash].js' }
```

**但 webpack 4 有个坑**：module id 默认是**自增数字**。你在依赖图中间插入一个新模块，**它后面所有模块的 id 全部移位** → 所有 chunk 的内容都变了 → **所有 contenthash 变了** → 缓存全失效。

**你什么业务代码都没改，只是加了一个依赖，用户却要重下所有文件。**

Webpack 4 的解法是 `HashedModuleIdsPlugin`（用模块路径的 hash 当 id，不受插入影响）。

**而 Webpack 5 默认就是 `deterministic`：**

```js
optimization: {
  moduleIds: 'deterministic',
  chunkIds: 'deterministic',
}
```

> **这是 3 → 5 升级白拿的收益，而且和这条 bullet 直接相关**——「更好的 long-term caching」不是一句空话，指的就是这个。能讲清「为什么 webpack 4 时代 hash 会乱变」，比背 changelog 有说服力得多。

---

## 七、实践五：拆分不是越细越好

**三条约束：**

1. **`maxInitialRequests` / `maxAsyncRequests`**——限制并行请求数量，默认 30
2. **HTTP/1.1 下每个域名只有 6 个并发连接**，拆成 20 个文件反而排队
3. **小文件的压缩率更差**——gzip 靠上下文找重复，文件越小可利用的上下文越少。**把一个 100KB 拆成 10 个 10KB，gzip 后的总和会比原来大**

**所以 `minSize`（默认 20KB）是有道理的**：低于这个体积，多一个请求的开销大于缓存收益。

**面试官问「拆到多细合适」，答这三条约束就对了。**

---

## 八、实践六：CSS 也要拆

`MiniCssExtractPlugin` 把 CSS 抽成独立文件后，同样可以用 cacheGroup 管理：

```js
cacheGroups: {
  styles: {
    test: /\.css$/,
    name: 'styles',
    chunks: 'all',
    enforce: true,
  },
}
```

否则 CSS 会跟着 JS chunk 走，同样有「改一点全变」的问题。

---

## 九、怎么验证拆得好不好（这一节最实用）

**两个动作，今天就能在任何项目上做：**

### 验证一：看图

跑 `webpack-bundle-analyzer`，看树图：

- 有没有**同一个包出现在多个 chunk 里**（说明去重没做好）
- 有没有**某个 chunk 大得离谱**（说明该继续拆）
- 有没有**一堆几 KB 的碎片**（说明拆过头了）

### 验证二：改一行代码，diff 文件名 ⭐

**这是检验长效缓存做得好不好的黄金方法：**

```bash
npm run build && ls dist/*.js > before.txt
# 改一行业务代码（比如改个字符串）
npm run build && ls dist/*.js > after.txt
diff before.txt after.txt
```

**拆分做得好的话，`diff` 里应该只有业务 chunk 的文件名变了**，`framework`、`vendors` 那些一个都不动。

如果 diff 出来一大片，说明：

| 现象 | 大概率原因 |
|---|---|
| 所有文件都变了 | moduleIds 不是 deterministic（见实践四） |
| entry chunk 跟着变 | runtime 没抽出去（见实践三） |
| vendors 跟着变 | 业务代码和依赖被分到同一个 cacheGroup 了 |

> **这个方法的价值在于：它把「长效缓存」这个抽象目标，变成了一个能跑、能看、能截图的验证。** 面试里能描述这个验证过程，比列一堆配置项强得多。

---

## 十、面试预期追问

| 问题 | 要点 |
|---|---|
| SplitChunks 能减小包体积吗？ | **通常不能**，它重新分配体积、提升缓存命中率。只有去重的部分才真的减少总量 |
| `chunks: 'all'` 和 `'async'` 差别？ | `async` 只拆动态 import 出来的；`all` 连初始 chunk 一起拆。**大多数「配了没效果」都是这里** |
| runtimeChunk 是干什么的？ | 抽出模块注册表和 chunk 映射表，避免任何 chunk 变动都连累 entry 的 hash |
| 为什么 vendor 不能打成一个？ | 任何一个依赖升级都会让整个 vendor hash 变。按变化频率分层 |
| 拆到多细合适？ | 受 `maxInitialRequests`、HTTP/1.1 六并发、小文件 gzip 效率下降三条约束 |
| 怎么验证缓存策略有效？ | 改一行代码重新 build，diff 文件名列表，只该有业务 chunk 变 |
| Webpack 4 为什么 hash 老是乱变？ | moduleId 自增，插入模块导致后续全部移位。4 用 `HashedModuleIdsPlugin`，**5 默认 `deterministic`** |
