---
title: The Webpack 3→5 migration
section: Baidu
icon: landmark
---

# Baidu bullet 2 — the Webpack 3 → 5 migration

> Why this exists: the Baidu period is the technically densest (the virtualized list, the Webpack migration and the P2 incident review are all real substance), but it was done and then forgotten. These notes split it by resume bullet and **explain the underlying mechanism of each one properly**, so an interview can go layer by layer.
>
> Every bullet has five parts: **the text** / **the core technical points** / **how it works** / **what you most likely did at the time** / **follow-ups to expect**. The numbering and order follow the current resume's Baidu section — virtualized list / Webpack / white screen / withdrawal / jsBridge; every quote at the top of a bullet is **that bullet's earlier wording**, and where it differs from the current resume, the notes on this site win.
>
> Also: the Baidu code is not on this machine, so these notes rest entirely on memory — which makes them carry more weight than the other two.

---

## Bullet 2 ⭐ the Webpack 3 → 5 migration — bundle -15%, build -70%


> Older resume text: Led a Webpack 3-to-5 migration across 10+ incompatible packages, extracting shared runtime through SplitChunksPlugin and turning on persistent caching — bundle size down ~15%, local build times down 70%.

### Core technical points

#### ① Webpack's core concepts
- **Entry**: the entry point (`src/index.js`)
- **Output**: the artefact (`dist/bundle.[contenthash].js`)
- **Loader**: a preprocessor that turns non-JS files (css, images, ts) into modules JS understands
  - `babel-loader` for JS/JSX/TS
  - `css-loader` resolves CSS dependencies, `style-loader` injects it into a style tag
  - `file-loader` / `url-loader` for images (Webpack 5's built-in Asset Modules replaced both)
- **Plugin**: hooks into the build process to do anything
  - `HtmlWebpackPlugin` generates the HTML
  - `DefinePlugin` injects environment variables
  - `MiniCssExtractPlugin` pulls CSS out into its own .css file
- **Module**: everything is a module — JS, CSS, images
- **Chunk**: a group of modules bundled together (usually one chunk = one .js file)

#### ② The main new features in Webpack 5 (what changes from 3→5)
1. **Persistent cache** (`cache: { type: 'filesystem' }`): intermediate build results are cached to disk — a cold start is slow, a warm one is instant
2. **Asset Modules**: four built-in asset types (`asset/resource` / `asset/inline` / `asset/source` / `asset` for automatic), replacing `file-loader` / `url-loader` / `raw-loader`
3. **Module Federation**: the micro-frontend answer, letting one app load another project's chunks at runtime
4. **Stronger tree shaking**: more precise dead-code elimination, with finer-grained `sideEffects: false` support
5. **Node.js polyfills removed**: 5 no longer auto-bundles polyfills for Node built-ins like `crypto` / `stream` / `buffer` (3 and 4 added them automatically, inflating the bundle). If you need them, install `browserify-*` yourself or use `resolve.fallback`
6. **Better long-term caching**: a better built-in hashing strategy (`chunkIds: 'deterministic'`), so a small change doesn't change every hash
7. **Smaller output**: improvements to the built-in optimisations
8. **Less configuration**: much of what you used to write by hand now has a better default

#### ③ SplitChunksPlugin (⭐ named directly on your resume)
- **What it solves**: third-party libraries (react, lodash, antd) and your own code end up in one bundle, so any small change to your code changes the whole bundle hash and users re-download all the vendor code
- **The strategy**: split vendor and runtime out separately, so when your code changes the vendor chunk doesn't and the browser cache still hits
- **An example config**:
```js
optimization: {
  splitChunks: {
    chunks: 'all', // split every chunk (async and sync)
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        priority: 10,
      },
      common: {
        minChunks: 2, // referenced by at least 2 chunks
        name: 'common',
        priority: 5,
      },
    },
  },
  runtimeChunk: 'single', // the runtime gets its own chunk
}
```

- **The key concepts**:
  - **cacheGroups**: the split rules; `priority` decides which one wins when several match
  - **runtimeChunk**: webpack's runtime code (module registration, chunk loading logic) split out so every bundle doesn't carry a copy
  - **minChunks**: how many chunks must reference a module before it's split out
  - **minSize / maxSize**: control the chunk size

#### ④ Persistent cache (the resume's "turning on persistent caching")
```js
cache: {
  type: 'filesystem', // cached to disk (.webpack/cache/)
  buildDependencies: {
    config: [__filename], // invalidate when the config changes
  },
}
```
- First build: 5min (compile every module and write it to disk)
- Second build: 30sec (compile only what changed, read the rest from disk)
- **This is where the 60–80% speedup comes from**

#### ⑤ Tree shaking
- **How it works**: ESM (import/export) is **statically analysable**, so at build time Webpack can tell which exports were never imported and leave them out
- **The precondition**: it has to be ESM; CommonJS (`require`) with dynamic imports can't be shaken
- **Side-effect marking**: `"sideEffects": false` or `"sideEffects": ["*.css"]` in `package.json` tells Webpack whether a package or file can be safely dropped when nothing imports it
- **The result**: import one function from a package and only that function is bundled, not the whole package

#### ⑥ What "10+ incompatible loaders/plugins" actually means
Webpack 3 → 4/5 had several large breaking changes. The casualties:
- **ExtractTextPlugin** (webpack 3) → **MiniCssExtractPlugin** (4+)
- **CommonsChunkPlugin** (3) → **SplitChunksPlugin** (4+)
- **UglifyJSPlugin** (3) → **TerserPlugin** (4+), built into Webpack 5
- **file-loader** / **url-loader** → the built-in **Asset Modules** (Webpack 5)
- **awesome-typescript-loader** → **ts-loader** / **babel-loader + @babel/preset-typescript**
- Plugin APIs moved from `apply(compiler)` with direct hooks to tapable v2's `.tap` / `.tapPromise`

### How it works

#### What Webpack actually does when it bundles (the high-level flow)
1. Start at the **entry** and read the entry file
2. Hand it to the **loader chain** (applied in reverse, so `use: ['style-loader', 'css-loader']` starts with css-loader)
3. **Parse the AST** for import/require and find the dependencies
4. Repeat 1–3 for each dependency recursively, building the **dependency graph**
5. Run the **plugins** (at their various hook points)
6. **Group into chunks** according to the splitChunks rules
7. Write the output to `dist/`

#### How persistent cache invalidation works
Webpack 5 decides whether a cache entry is valid from **content hashes plus dependency hashes**:
- Each module's cache key = content hash + loader version hash + config hash + dependency module hashes
- Any change is a miss and the module is recompiled
- `buildDependencies` lets you declare explicitly that certain files invalidate the whole cache when they change (`webpack.config.js`)

#### Why the bundle shrinks by 15%
- **Stronger tree shaking**: Webpack 5 handles CommonJS interop better and can shake out more dead code
- **No automatic Node polyfills**: if your code only runs in a browser and never touches crypto/stream, that's tens of KB gone
- **Better long-term caching**: a more precise hash strategy means identical code keeps its hash and hits the CDN cache
- **Better minification**: a newer built-in Terser
- **Finer-grained Asset Modules**: small images inlined as base64, large ones emitted as files, with no loader round trip

### What you most likely did at the time

1. **Preparation**: pin the Node version, back up the existing config
2. **Upgrade Webpack**: `yarn add webpack@5 webpack-cli@5 -D`
3. **Replace the loaders/plugins one at a time**:
   - `extract-text-webpack-plugin` → `mini-css-extract-plugin`
   - drop `uglifyjs-webpack-plugin` (use the built-in Terser)
   - drop `file-loader` / `url-loader` and configure Asset Modules
4. **Rework splitChunks**: from CommonsChunkPlugin to splitChunks + cacheGroups
5. **Turn on the persistent cache**: add `cache: { type: 'filesystem' }`
6. **Fix the missing Node polyfills**: if the code uses `Buffer` / `process`, add `resolve.fallback` or switch to a browser build
7. **Test**: compare the output, compare bundle size, boot it, run the E2E suite
8. **Quantify**: webpack-bundle-analyzer for the size change, `time yarn build` for the duration

### Follow-ups to expect

**Basics:**
- **What's the difference between a loader and a plugin?**
  → A loader transforms **a single file** (css → js); a plugin extends **the whole build process** (any hook you like).
- **In what order do loaders run?**
  → Right to left (the last one in the array goes first). With `['style-loader', 'css-loader']`, css-loader turns it into JS first, then style-loader injects it into the DOM.
- **Chunk vs bundle?**
  → A chunk is a Webpack-internal concept (a group of modules during the build); a bundle is the final artefact (the .js file produced from one or more chunks).

**Deeper:**
- **What's the difference between `chunks: 'all'` / `'async'` / `'initial'` in SplitChunksPlugin?**
  → `initial` only applies to entry chunks; `async` only to dynamic imports; `all` applies to everything (and is what you want).
- **Why split the runtimeChunk out?**
  → The runtime holds the chunk id → filename mapping, and adding or removing any chunk changes that mapping. Without splitting, every change rewrites the runtime and drags the entry chunk hash with it. Split out, the vendor and entry hashes are far more stable and the cache hit rate goes up.
- **When does tree shaking fail?**
  → ① CommonJS modules (dynamic require). ② imports with side effects (`import 'polyfill'` can't be shaken). ③ no `"sideEffects": false` in `package.json`, so Webpack stays conservative. ④ `import * as ns` followed by dynamic `ns[key]` access.
- **How is dynamic `import()` implemented?**
  → Webpack compiles `import('./foo')` into a runtime call to `__webpack_require__.e(chunkId)` that loads the chunk and returns a Promise, resolving the module once the chunk arrives.
- **How does HMR work?**
  → The dev server opens a WebSocket, watches for file changes → compiles the changed module → notifies the client over the socket → the client downloads the new module → the callback registered with `module.hot.accept` swaps the old module out. React uses react-refresh to preserve component state.

**Hardest:**
- **Webpack 5 or Vite — how do you choose?**
  → Vite uses ESM plus esbuild in development (an instant cold start) and Rollup for production. It suits projects targeting modern browsers. Webpack 5 is more mature, has a larger ecosystem, and handles old browsers better. New project: Vite. Large legacy project: stay on Webpack.
- **What are the traps in persistent caching?**
  → Cache poisoning (in some cases a wrong cache entry hits and the build is wrong). The fix: put a version in the cache key and bump it when something goes wrong. And in CI, a cache that is never cleared accumulates stale entries.
- **What is Module Federation?**
  → The micro-frontend answer. One application can **load at runtime** the modules another application exposes (sharing the React instance, sharing UI components). It suits large organisations with several teams.
