---
title: Webpack 3→5
section: 百度
icon: landmark
---

# 百度 Bullet 2 —— Webpack 3 → 5 迁移

> 百度这段技术密度最高(虚拟列表、Webpack 迁移、P2 事故复盘都是硬货),但当时做完就忘。这几篇按简历 bullet 拆开,**把每条背后的底层机制彻底讲清楚**,让你面试时能一层一层往下答。
>
> 每条 bullet 分五段:**原文** / **核心技术点** / **实现原理** / **你当时大概是怎么做的** / **面试预期追问**。编号和顺序照现简历 Baidu section —— 虚拟列表 / Webpack / 白屏 / 提现 / jsBridge;开头引的是**该条更早的措辞**,和现简历有出入处以站内笔记为准。
>
> 百度的代码不在本机,这几篇全靠笔记 + 回忆,所以分量比另外两份重。

---

## Bullet 2 ⭐ Webpack 3 → 5 迁移 —— 包体积 -15%,构建 -70%


> 旧版原文：Led a Webpack 3-to-5 migration across 10+ incompatible packages, extracting shared runtime through SplitChunksPlugin and turning on persistent caching — bundle size down ~15%, local build times down 70%.

### 核心技术点

#### ① Webpack 的核心概念
- **Entry**:入口(`src/index.js`)
- **Output**:产物(`dist/bundle.[contenthash].js`)
- **Loader**:预处理器,把非 JS 文件(css、image、ts)转成 JS 能识别的模块
  - `babel-loader` 转 JS/JSX/TS
  - `css-loader` 解析 CSS 依赖,`style-loader` 注入到 style 标签
  - `file-loader` / `url-loader` 处理图片(Webpack 5 内置 Asset Modules 替代了这俩)
- **Plugin**:扩展 build 过程的钩子,做各种事
  - `HtmlWebpackPlugin` 生成 HTML
  - `DefinePlugin` 注入环境变量
  - `MiniCssExtractPlugin` 把 CSS 单独抽成 .css 文件
- **Module**:一切都是模块,包括 JS/CSS/图片
- **Chunk**:一组模块打包在一起的文件(通常一个 chunk = 一个 .js 文件)

#### ② Webpack 5 的主要新特性(和 3→5 差异)
1. **Persistent Cache**(`cache: { type: 'filesystem' }`):把 build 中间结果缓存到磁盘,冷启动慢、热启动秒过
2. **Asset Modules**:内置 4 种资源类型(`asset/resource` / `asset/inline` / `asset/source` / `asset` 自动),替代 `file-loader` / `url-loader` / `raw-loader`
3. **Module Federation**:微前端方案,允许运行时动态加载其他项目的 chunk
4. **Tree Shaking 强化**:更精确的死代码消除,支持 `sideEffects: false` 精细化
5. **Node.js polyfill 移除**:5 不再自动打包 `crypto` / `stream` / `buffer` 等 Node 内置模块的 polyfill(3/4 会自动加,导致 bundle 变大)。用到的话要手动装 `browserify-*` 或用 `resolve.fallback`
6. **Long-term Caching 改进**:内置更好的 hashing 策略(`chunkIds: 'deterministic'`),小改动不会导致所有 hash 变化
7. **Output 更小**:内置代码优化改进
8. **配置删繁**:很多之前要手写的现在有更好的默认值

#### ③ SplitChunksPlugin(⭐ 你简历直接提到了)
- **它解决什么问题**:第三方库(react、lodash、antd)和业务代码打在一个 bundle 里,业务代码稍微改动就整个 bundle hash 变,用户要重下所有 vendor code
- **拆分策略**:把 vendor 和 runtime 单独拆出来,业务代码变化时 vendor chunk 不变,浏览器缓存命中
- **配置示例**:
```js
optimization: {
  splitChunks: {
    chunks: 'all', // 对所有 chunk(async + sync)都拆
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        priority: 10,
      },
      common: {
        minChunks: 2, // 至少被 2 个 chunk 引用
        name: 'common',
        priority: 5,
      },
    },
  },
  runtimeChunk: 'single', // runtime 单独一个 chunk
}
```

- **关键概念**:
  - **cacheGroups**:定义拆分规则,`priority` 决定同时匹配时用哪个
  - **runtimeChunk**:webpack 的运行时代码(module 注册、chunk 加载逻辑)单独拆,避免每个 bundle 都带一份
  - **minChunks**:模块被多少个 chunk 引用才拆
  - **minSize / maxSize**:控制 chunk 大小

#### ④ Persistent Cache(简历"启用持久化缓存")
```js
cache: {
  type: 'filesystem', // 缓存到磁盘(.webpack/cache/)
  buildDependencies: {
    config: [__filename], // config 变了 invalidate
  },
}
```
- 首次 build:5min(编译所有 module 存磁盘)
- 二次 build:30sec(只编译变动 module,其他读磁盘)
- **60–80% 的构建速度提升就来自这个**

#### ⑤ Tree Shaking
- **原理**:ESM(import/export)是**静态可分析**的,Webpack 在 build 时能知道"哪些 export 从没被 import 过",打包时排除掉
- **前提**:必须是 ESM,CommonJS(require)动态导入不能 tree-shake
- **副作用标记**:`package.json` 里 `"sideEffects": false` 或 `"sideEffects": ["*.css"]` 告诉 Webpack "这个包/文件即使没被 import 也可以安全删掉/不能删"
- **效果**:import 一个包里的一个函数,只打这一个,不打整个包

#### ⑥ 迁移中"10+ 个不兼容 loader/plugin"具体指什么
Webpack 3 → 4/5 有几个大的破坏性变化,受影响的:
- **ExtractTextPlugin**(webpack 3)→ **MiniCssExtractPlugin**(4+)
- **CommonsChunkPlugin**(3)→ **SplitChunksPlugin**(4+)
- **UglifyJSPlugin**(3)→ **TerserPlugin**(4+),Webpack 5 内置
- **file-loader** / **url-loader** → 内置 **Asset Modules**(Webpack 5)
- **awesome-typescript-loader** → **ts-loader** / **babel-loader + @babel/preset-typescript**
- 各种插件的 API 从 `apply(compiler)` + 直接 hook 改成 tapable v2 的 `.tap` / `.tapPromise`

### 实现原理

#### Webpack 到底怎么打包(高层流程)
1. **Entry** 开始,读入口文件
2. 交给 **Loader 链**处理(倒序应用,如 `use: ['style-loader', 'css-loader']` 从 css-loader 开始)
3. **AST 分析** import/require,找出依赖
4. 递归对每个依赖重复 1–3,构建**依赖图(dependency graph)**
5. 应用 **Plugin**(在各种 hook 点执行)
6. 根据 splitChunks 规则**分组打包**成 chunk
7. Output 到 `dist/`

#### Persistent Cache 的失效逻辑
Webpack 5 用**内容哈希 + 依赖哈希**判定 cache 是否有效:
- 每个 module 的 cache key = 内容 hash + loader 版本 hash + config hash + 依赖模块 hash
- 任何一个变了就 miss,重新编译
- `buildDependencies` 让你显式声明"这些文件变了要 invalidate 全部 cache"(如 `webpack.config.js`)

#### 为什么打包体积能减少 15%
- **Tree Shaking 增强**:Webpack 5 对 CommonJS interop 处理更好,能 shake 掉更多死代码
- **不再自动加 Node polyfill**:如果你的代码只在浏览器跑,不用 crypto/stream,减少几十 KB
- **更好的 Long-term Caching**:hash 策略更精确,同样的代码 hash 不变,能命中 CDN 缓存
- **代码 minify 改进**:内置 Terser 版本更新
- **Asset Modules 更精细**:小图片 base64 内联,大图片单独文件,不用 loader 中间转一遍

### 你当时大概是怎么做的

1. **准备**:锁定 Node 版本,备份现有 config
2. **升级 Webpack**:`yarn add webpack@5 webpack-cli@5 -D`
3. **一个一个替换 loader/plugin**:
   - `extract-text-webpack-plugin` → `mini-css-extract-plugin`
   - `uglifyjs-webpack-plugin` 删掉(用内置 Terser)
   - `file-loader` / `url-loader` 删掉,配 Asset Modules
4. **重构 splitChunks**:从 CommonsChunkPlugin 改到 splitChunks + cacheGroups
5. **启用 persistent cache**:加 `cache: { type: 'filesystem' }`
6. **修复 Node polyfill 缺失**:如果业务代码用了 `Buffer` / `process` 等,加 `resolve.fallback` 或换用浏览器版本
7. **测试**:build 产物对比、bundle size 对比、启动测试、E2E 跑一遍
8. **量化**:webpack-bundle-analyzer 看包体积变化,`time yarn build` 测时长

### 面试预期追问

**基础:**
- **Loader 和 Plugin 区别?**
  → Loader 处理**单个文件**的转换(css → js);Plugin 是**整个 build 过程**的扩展(自定义任何 hook)。
- **Loader 执行顺序?**
  → 从右到左(数组末尾先执行)。`['style-loader', 'css-loader']` 先 css-loader 处理成 JS,再 style-loader 注入 DOM。
- **Chunk 和 Bundle 区别?**
  → Chunk 是 Webpack 内部概念(打包过程中的一个模块组);Bundle 是最终产物(一个或多个 chunk 生成的 .js 文件)。

**深入:**
- **SplitChunksPlugin 里 `chunks: 'all'` / `'async'` / `'initial'` 有什么区别?**
  → `initial` 只对入口 chunk 生效;`async` 只对动态 import 生效;`all` 对所有都生效(推荐)。
- **runtimeChunk 为什么单独拆?**
  → runtime 代码包含 chunk id → 文件名的映射,任何 chunk 新增/移除都会改这个映射。不拆的话每次改动都改 runtime,连带 entry chunk hash 变。拆出来后 vendor / entry hash 更稳定,cache 命中率更高。
- **Tree Shaking 什么情况下失败?**
  → ① CommonJS 模块(动态 require)。② 有副作用的 import(`import 'polyfill'` 不能 shake)。③ `package.json` 没标 `"sideEffects": false`,Webpack 保守不 shake。④ 用了 `import * as ns` 后动态 `ns[key]` 访问。
- **`import()` 动态引入怎么实现的?**
  → Webpack 把 `import('./foo')` 编译成运行时通过 `__webpack_require__.e(chunkId)` 加载 chunk,返回 Promise。chunk 加载完成后 resolve module。
- **HMR 是怎么工作的?**
  → dev server 起 WebSocket 连接,监听文件变化 → 编译改动 module → 通过 WS 通知客户端 → 客户端下载新 module → 用 `module.hot.accept` 注册的回调替换旧 module。React 用 react-refresh 保留组件 state。

**极端:**
- **Webpack 5 和 Vite 你怎么选?**
  → Vite 开发时用 ESM + esbuild(冷启动秒开),生产用 Rollup。适合现代浏览器项目。Webpack 5 更成熟、生态大、兼容老浏览器好。新项目用 Vite,大老项目留 Webpack。
- **持久化缓存有什么坑?**
  → 缓存污染(某些情况下命中错误 cache 导致 build 错)。解决:cache key 加版本号,遇到问题 bump。CI 里如果不清 cache 会累积失效。
- **Module Federation 是什么?**
  → 微前端方案。一个应用可以在运行时**动态加载**另一个应用暴露的模块(共享 React 实例、共享 UI 组件)。适合大组织多团队协作。

---

## 面试前 Checklist(这条)

### 必须能画出来
- [ ] Webpack build 流程:Entry → Loader → AST → 依赖图 → Plugin → Chunk → Output

### 必须能背下来
- [ ] SplitChunks 里 vendor / common / runtime 各拆的目的
- [ ] Persistent Cache 首次慢、二次快的原因

### 必须能开口就讲(30 秒)
- [ ] Webpack 5 相比 3 有什么大改动?(cache、asset modules、tree shaking、no Node polyfill、hash 稳定)
