---
title: "④ 数字 · 10+ 不兼容包"
section: 百度
icon: landmark
tier: ref
day: 6
level: 前置
status: done
---

# #9 · `10+ incompatible packages`

> **材料说明**：百度代码不在本机，材料是 `LEARNING_NOTES_BAIDU.md` + 回忆。
>
> 这条和 [#2](/docs?section=beyz&item=n02-stripe-events) 性质接近——**是个计数声明，不是测量**。审计表要的不是「你怎么数的」，而是「**具体哪几类问题，能不能举 1–2 个代表案例**」。**答不出案例，这个 10+ 就是个空数。**

## 对应简历原句

Baidu 第 4 条 bullet（v40）：

> Led a Webpack 3-to-5 migration **across 10+ incompatible packages**, extracting vendor and runtime chunks and turning on persistent caching — bundle size down ~15%, local build times down 70% on warm builds.

---

> **2026-08-20 改过**：原句是 `extracting shared runtime through SplitChunksPlugin ... local build times down 70%.`。**两处已解决**——插件名归错（`runtimeChunk` 不是 SplitChunksPlugin 的选项）和 cold/warm 口径都修了。**因果错配仍在**：拆分买到的是缓存命中率，体积下降来自 polyfill 移除和 tree shaking，句子里没提。


## 一、先把「不兼容」分类，别背清单

**列十个包名不如讲四类原因。** 面试官要听的是你理解了这次升级的**破坏性变化在哪**，而不是你记性好。

Webpack 3 → 5 的不兼容，本质上就这四类：

### 类别 1：插件被官方替代（换包 + 改配置）

| Webpack 3 | Webpack 4/5 |
|---|---|
| `ExtractTextPlugin` | `MiniCssExtractPlugin` |
| `CommonsChunkPlugin` | `SplitChunksPlugin`（内置） |
| `UglifyJSPlugin` | `TerserPlugin`（Webpack 5 内置） |

### 类别 2：被 Webpack 5 内置能力取代（直接删掉）

`file-loader` / `url-loader` / `raw-loader` → **Asset Modules**（`asset/resource`、`asset/inline`、`asset/source`、`asset`）。

**这类是最爽的**——不是换个包，是**整个依赖可以删掉**，配置里改成内置类型就行。

### 类别 3：插件 API 变了（tapable v1 → v2）

老写法：

```js
compiler.plugin('emit', (compilation, callback) => { ... })
```

新写法：

```js
compiler.hooks.emit.tapAsync('MyPlugin', (compilation, callback) => { ... })
```

**受影响的是自研插件和那些没人维护的小众插件**——官方生态早就跟上了，但公司内部自己写的那些没人管。**这一类往往是最花时间的**，因为没有升级文档，只能自己读源码改。

### 类别 4：Node polyfill 移除引发的连锁

**这一类最值得讲，见下一节。**

---

## 二、准备两个代表案例（审计明确要求）

### 案例 A：`CommonsChunkPlugin` → `SplitChunksPlugin`

**为什么这个案例好**：它不是「改个名字」，而是**心智模型整个换了**。

| | 思路 |
|---|---|
| `CommonsChunkPlugin` | **命令式**：你指定「把这几个 entry 的公共部分抽到名叫 vendor 的 chunk 里」，抽几层要自己一层层写 |
| `SplitChunksPlugin` | **声明式**：你写规则（`cacheGroups`：什么样的模块归哪组、优先级多少、多小不拆），webpack 自动分组 |

**所以迁移不是替换一行配置，是把「我指定要哪些 chunk」重写成「我描述什么样的模块该被拆出去」。**

（拆分策略本身见 [#10 补充 · SplitChunks 实践](/docs?section=baidu&item=n10b-splitchunks)。）

### 案例 B：Node polyfill 移除（推荐主讲这个）

**为什么这个案例最好**：它的**报错现象和真实原因对不上**，是个有故事性的排查。

Webpack 3/4 会**自动**给浏览器环境注入 Node 核心模块的 polyfill——`crypto`、`stream`、`buffer`、`path` 这些。你的某个依赖里 `require('crypto')`，webpack 悄悄塞进来一个 `crypto-browserify`，你根本不知道。

**Webpack 5 把这个行为删掉了。** 于是升级后直接报：

```
Module not found: Error: Can't resolve 'crypto' in '...'
BREAKING CHANGE: webpack < 5 used to include polyfills for node.js core
modules by default. This is no longer the case.
```

**第一眼像是依赖装漏了**，实际是 webpack 主动停止了一个你从来不知道存在的行为。

三种处理方式，**能说清取舍是加分项**：

| 做法 | 代价 |
|---|---|
| `resolve.fallback: { crypto: require.resolve('crypto-browserify') }` | 最快，但把体积加回来了 |
| `resolve.fallback: { crypto: false }` | 确认浏览器端根本走不到那段代码时用，**体积收益最大** |
| 换掉那个依赖 | 最干净，最费时间 |

> **这个案例还有个额外价值**：它同时是 [#10](/docs?section=baidu&item=n10-bundle-size) 里「体积为什么降了 15%」的一个主要来源。**同一个变更同时解释了两个数字**，串起来讲会显得你真的经历过这次迁移。

---

## 三、这个数是怎么「数」出来的

**没有工具能测「不兼容包数」，它只有两个来源：**

1. **升级后跑一次 build，把报错和警告清单列出来**——这是迁移时的实际工作流：改配置 → build → 挂 → 修 → 再 build，直到通过
2. **`package.json` 的 diff**——那次迁移的 commit 里，`devDependencies` 增删了多少个包

**第二个才是能拿出来的证据。** 如果那个仓库还能访问，`git log` 找到迁移的 commit，`git show --stat` 看 `package.json` 的改动就是原始记录。

**但百度的代码不在本机，所以这条和 [#7](/docs?section=baidu&item=n07-qps)、[#8](/docs?section=baidu&item=n08-zero-loss) 一样，只能给口径不能给证据。** 好在这类计数声明面试官一般不会索要证据，**他们只会追案例**——所以上一节那两个案例才是重点。

---

## 四、按「审什么」逐条过

### ① 具体哪几类问题

见第一节四类。**按类讲，不要背包名清单。**

### ② 能否举 1–2 个代表案例

见第二节。**主讲 Node polyfill 那个，备用 CommonsChunkPlugin 那个。**

### ③ 「10+」的口径（审计表没写，但会被追）

**`10+` 数的是什么？**

- **包数**（`package.json` 里增删换掉的条目）
- 还是**改动点数**（一个包可能引发配置里好几处改动）

**建议口径：包数。** 因为它对应 `package.json` 的 diff，是唯一有客观依据的算法。

**另外一个措辞小问题**：`incompatible packages` 把 loader、plugin、普通依赖三种东西混在一个词里了。想更准可以改成 `10+ incompatible loaders and plugins`——但这个不算硬伤，优先级低于 [#8](/docs?section=baidu&item=n08-zero-loss)。

---

## 五、一句话答法

> 十来个不兼容的包不是一个个孤立的问题，是四类破坏性变化：官方替代品（ExtractText 换 MiniCssExtract、CommonsChunk 换 SplitChunks、UglifyJS 换 Terser）、被 Webpack 5 内置能力取代因而可以直接删掉的（file-loader / url-loader 换成 Asset Modules）、插件 API 从 tapable v1 换到 v2 导致自研插件全要改写、以及 Node polyfill 移除引发的连锁。最典型的是最后这类——Webpack 5 不再自动注入 crypto、stream 这些 polyfill，升级后报的是「Can't resolve 'crypto'」，看着像依赖装漏了，其实是 webpack 停掉了一个我们从来不知道存在的行为。这一条顺带也是体积降下来的主要原因之一。
