---
title: "② The Webpack 3 → 5 migration"
section: Baidu
---

# ② The Webpack 3 → 5 migration

> **Resume line**
>
> Led a **Webpack 3-to-5 migration across 10+ incompatible packages**, **extracting vendor and runtime chunks** and **turning on persistent caching** — **bundle size down ~15%**, **local build times down 70% on warm builds**.

## What this bullet is about

**There are five things that can be probed here, and they are not equally hard:**

| Point | Where the difficulty is |
|---|---|
| `10+ incompatible packages` | ⭐ **You need concrete cases**; without them the number is empty |
| `extracting vendor and runtime chunks` | ⭐ **What splitting buys is cache hit rate, not size** — get that backwards and you are exposed |
| `persistent caching` | ⭐ **Cold builds actually get slower**, which is the easiest place to fall over |
| `bundle size down ~15%` | Three terms (which files / which compression / which mode) and **each can double or halve the number** |
| `local build times down 70%` | ⭐ The word `local` is a precise qualifier — **you do not get this on CI by default** |

## The 30-second version

> This was a project several years old whose build was still on Webpack 3: changing one line locally meant waiting minutes, and the bundle was slowly growing. I moved it to 5.
>
> **The hard part of the migration was not editing config, it was that a dozen packages were incompatible** — some were replaced by official successors, some had been absorbed into Webpack 5's built-in capabilities and could simply be deleted, and our in-house plugins all had to be rewritten because the underlying hook library went through a major version. ⭐ **The most interesting category was Webpack 5 no longer injecting Node polyfills automatically**: after the upgrade the error reads "Can't resolve 'crypto'", **which looks like a missing dependency but is actually the removal of a behaviour we never knew existed.**
>
> **The result was bundle size down about 15% and warm local builds down 70%** — **the first mostly from those no-longer-injected polyfills plus stronger tree shaking, the second from Webpack 5's filesystem persistent cache.**

## 1. Four terms defined first

**① What a bundler does**

A browser cannot run hundreds of source files importing each other. **A bundler starts at an entry point, follows the `import`s to collect the dependencies, converts them into something a browser can run, and merges them into a handful of files.**

| Concept | In one line |
|---|---|
| **Module** | Everything is a module: JS, CSS, images |
| **Loader** | Converts a non-JS asset into a module JS can consume; acts on **a single file** |
| **Plugin** | Hooks into the build lifecycle; acts on **the whole build** |
| **Chunk** | An output unit of modules bundled together, usually one chunk = one `.js` |

⭐ **"What is the difference between a loader and a plugin" comes up constantly: a loader is a file-level transformer, a plugin is a build-level extension point.** A loader can only change the contents of one file; a plugin can add files, change the whole output and change how chunks are grouped.

**② Polyfills, and why Webpack used to "inject" them**

**A polyfill supplies, in code that does run, a capability the environment is missing.**

Node has **built-in modules** like `crypto`, `path` and `buffer`; browsers do not. ⭐ **In Webpack 4 and earlier, `require('crypto')` in browser code was quietly swapped for a browser implementation rewritten in JS and packed into the bundle.**

⭐ **Webpack 5 stopped doing this**, on the grounds that **most of the time you have merely imported a Node-only library by accident, and it has silently added tens of KB to your bundle.**

**③ Tree shaking**

**Tree shaking removes code that was imported but never used.** ⭐ **It depends on the static structure of ES modules** — `import { a } from 'x'` reveals without running anything that you only use `a`, whereas `require('x').a` is only known at runtime and **cannot be shaken**.

**④ contenthash and long-term caching**

Output files are named like `main.a3f9c2.js`, and ⭐ **that hash is computed from the file's contents**: contents unchanged → hash unchanged → **the browser reuses its cache and downloads nothing**; contents changed → filename changes → downloaded as a new file. **That is long-term caching.**

## 2. ⭐ The 10+ incompatible packages: answer by category, not by listing names

**Listing ten package names is worth less than explaining four categories of cause. The interviewer wants to hear that you understood where the breaking changes were, not that you have a good memory.**

| Category | Examples | How it was handled |
|---|---|---|
| **1. Plugin replaced officially** | `ExtractTextPlugin`→`MiniCssExtractPlugin`, `CommonsChunkPlugin`→`SplitChunksPlugin`, `UglifyJSPlugin`→`TerserPlugin` | Swap the package and rewrite the config |
| **2. Absorbed into built-in capability** | `file-loader`/`url-loader`/`raw-loader` → **Asset Modules** | ⭐ **The most satisfying category — the dependency is simply deleted** |
| **3. Plugin API changed** | tapable v1 → v2 | ⚠️ **The most time-consuming** — see below |
| **4. Node polyfills removed** | `crypto`, `stream`, `buffer` | **The one worth leading with** — see below |

**Why category 3 costs the most time**:

```js
compiler.plugin('emit', (compilation, callback) => { ... })                    // the old form
compiler.hooks.emit.tapAsync('MyPlugin', (compilation, callback) => { ... })   // the new form
```

⭐ **What is affected is in-house plugins and unmaintained niche ones** — the official ecosystem caught up long ago, **but the ones written inside the company have no owner and no upgrade guide, so you read the source and rewrite them yourself.**

### ⭐ The case to lead with: Node polyfills removed (the error and the cause do not match, which makes it a story)

Straight after the upgrade:

```
Module not found: Error: Can't resolve 'crypto' in '...'
BREAKING CHANGE: webpack < 5 used to include polyfills for node.js core
modules by default. This is no longer the case.
```

⭐ **At first glance it looks like a missing dependency; in fact webpack deliberately stopped a behaviour you never knew existed.**

**Three ways to handle it; being able to state the trade-off is what earns the credit:**

| Approach | Cost |
|---|---|
| `resolve.fallback: { crypto: require.resolve('crypto-browserify') }` | Fastest, **but it puts the weight back** |
| `resolve.fallback: { crypto: false }` | For when you have confirmed the browser never reaches that code; ⭐ **the biggest size win** |
| Replace the dependency | Cleanest, slowest |

⭐ **The extra value of this case: it is also the main source of the 15% size reduction — one change explains two numbers, and telling them together shows you actually lived through the migration.**

### Backup case: `CommonsChunkPlugin` → `SplitChunksPlugin`

**It is not a rename, the whole mental model changed:**

| | Its model |
|---|---|
| `CommonsChunkPlugin` | ⭐ **Imperative** — you specify "pull what these entries share into a chunk called vendor", and each extra level has to be written out by hand |
| `SplitChunksPlugin` | ⭐ **Declarative** — you write rules (which modules belong to which group, priorities, minimum size to split) and webpack groups them |

**So the migration is rewriting "the chunks I want" into "what kind of module should be split out".**

> **What `10+` counts**: the recommended basis is **packages** (entries added, removed or replaced in the `package.json` diff), **because it is the only definition with an objective source.**

## 3. ⭐ What SplitChunks actually buys (get this backwards and you are exposed)

⭐ **First, kill the most common misconception: it is not there to reduce size.**

By default webpack packs one entry into one bundle, and the problem is **caching**:

```
bundle.[hash].js   ←  react + lodash + antd + all of your application code, together
```

**You change one line of application code → the whole bundle's contenthash changes → the user re-downloads react, lodash and antd**, even though not one byte of them changed.

**After splitting**: `vendors.[hash].js` (rarely changes) + `main.[hash].js` (changes daily) — an application change moves only `main`'s hash.

⭐ **So the product of SplitChunks is "cache hit rate", not "a smaller bundle".** Total download on a first visit is roughly unchanged (and can be **slightly larger**, since each chunk carries extra wrapper code); **all the benefit is on subsequent visits.** The only case where the total genuinely shrinks is **deduplication**.

### Three practices

**① `chunks: 'all'`** — the default is `'async'`, which **only splits what came out of a dynamic `import()` and ignores synchronous imports entirely**. ⭐ **In most projects where "splitChunks is configured but does nothing", this one line is the reason.**

**② Do not pack one giant vendor** — putting all of `node_modules` into a 1MB `vendors.js` means ⭐ **that upgrading any dependency, even a tiny utility used once, changes the whole vendors hash and the user re-downloads 1MB**. The right approach is **grouping by rate of change**: a framework layer (react and friends, essentially static) / a large-library layer (anything over a threshold gets its own chunk) / everything else shared. **That layering is exactly what Next.js does internally.**

⭐ **The core idea in one line: group by rate of change, so that things that never change are not tied to things that change daily.**

**③ `runtimeChunk: 'single'`** — **the runtime is a small piece of webpack's own code that it injects**: the module registry, `__webpack_require__`, ⭐ **and the chunk → filename mapping table.**

⭐ **That mapping table is the crux: if any chunk's contenthash changes, the table changes. And by default this runtime is packed into the entry chunk — so changing any chunk changes the entry's hash too, and the user re-downloads the entry as well.**

Pulled into its own file it is just **a few-KB file**, and chunk hash changes only affect it. **That is what `runtime chunks` on the resume refers to.**

## 4. ⭐ The precondition for long-term caching: deterministic module ids

**Miss this and everything above is wasted.**

**Webpack assigns each module an internal id. Webpack 4 defaulted to incrementing numbers**: the first module is 1, the second 2, and so on.

⚠️ **The problem**: insert a new dependency in the middle and **every module id after it shifts by one**. Module ids are written into the output → **all output contents change → all contenthashes change → the user's cache for the entire site is invalidated at once.**

⭐ **You changed no application code at all, you only added a dependency, and the user re-downloads every file.**

**Webpack 5 defaults to `moduleIds: 'deterministic'`** — a short hash of the module path is used as the id, so **adding a module does not affect any other module's id.**

> ⭐ **This example is well worth telling: it shows that "filenames carry a contenthash" is a necessary but not sufficient condition for long-term caching. If the module ids underneath are unstable, the hashes on top are a lie.** It is also a free win from the 3 → 5 upgrade.

### ⭐ How to verify the caching strategy works (far stronger than listing config)

```bash
npm run build && ls dist/*.js > before.txt
# change one line of application code
npm run build && ls dist/*.js > after.txt
diff before.txt after.txt
```

⭐ **If the splitting is right, the only filename that changed in the diff should be the application chunk**, with `framework` and `vendors` untouched.

| A large diff | Most likely cause |
|---|---|
| Every file changed | moduleIds is not deterministic |
| The entry chunk changed too | The runtime was not extracted |
| vendors changed too | Application code and dependencies landed in the same group |

⭐ **The value of this method: it turns the abstract goal of "long-term caching" into something you can run, look at and screenshot.**

### More splitting is not better (expected follow-up)

Three constraints: **`maxInitialRequests` defaults to 30**; **HTTP/1.1 allows only 6 concurrent connections per host**, so 20 files queue up instead; and ⭐ **small files compress worse** — gzip finds repetition using context, so **splitting one 100KB file into ten 10KB ones makes the gzipped total larger than the original.** **Which is why `minSize` (default 20KB) exists.**

## 5. The 15% size figure: three terms plus attribution

### How it was measured

| Tool | Use |
|---|---|
| ⭐ **`webpack-bundle-analyzer`** | A treemap where **area is size**, drillable down to a specific package. It shows three numbers by default: **stat (raw) / parsed (after minification) / gzip** |
| `webpack --json > stats.json` | The precise data source; **use this when scripting an automated comparison** |
| ⭐ `du -sh dist/` | **The crudest and the most honest** — it measures exactly the pile of files the user has to download, with no room for interpretation |
| `size-limit` / `bundlesize` | ⭐ **Set a threshold in CI so a PR goes red if size grows more than N%** — volunteering this earns a lot, **because it shows you are thinking not about "I optimised it once" but about "how it stays optimised"** |

⚠️ **On method**: the two builds must be **the same commit of application code**, or you are measuring product changes rather than build-tool changes.

### ⭐ Three terms, each of which can double or halve the number

| Term | The key point |
|---|---|
| **Which files count** | ⚠️ **Sourcemaps are the biggest trap** — `.map` files are often larger than the `.js`, **and users never download them**. The right definition: **only the output users actually download, sourcemaps excluded** |
| **Which compression** | ⭐ **gzip eats part of the difference** — if what you removed was highly repetitive code, raw might drop 15% while gzipped drops only 8%. **Report gzip (that is the real download), but always say which one you are reporting** |
| **Which build mode** | ⭐ **Only production numbers mean anything** — development does not minify or tree-shake and can be several times larger. **The question looks basic, but it is a filter** |

### Attribution: where the 15% came from

| Source | Magnitude |
|---|---|
| ⭐ **Node polyfills removed** | **Probably the largest** — tens of KB and up |
| **Stronger tree shaking** | Medium |
| Newer bundled Terser | Small |
| Asset Modules | Small |
| Dependencies upgraded along the way | Unclear |

> ⚠️ ⭐ **Note that `SplitChunks` is not in that table — which is the easiest place in this bullet to get caught.** The resume sentence reads as though splitting produced the size reduction, **and if the interviewer follows that logic you should correct it yourself: splitting produced cache hit rate, the size reduction came from the table above. Volunteering that correction proves you understand it better than anything else can.**

## 6. The 70% build-time figure: two things to qualify

### Where it comes from

```js
cache: {
  type: 'filesystem',                 // write the cache to disk
  buildDependencies: { config: [__filename] },   // a config change invalidates everything
}
```

**Each module's compiled intermediate result is stored on disk; next time, unchanged modules are read straight back, ⭐ skipping the entire loader chain** (babel transpilation, TS compilation — the expensive steps).

**How invalidation works** (explaining it earns credit): ⭐ **each module's cache key = content hash + loader version hash + config hash + dependency module hashes, and any one of them changing is a miss.**

### ⚠️ Qualifier one: cold builds actually get slower

| | Order of magnitude |
|---|---|
| First build (writing the cache) | ~5 min |
| Second build (reading the cache) | ~30 sec |

⭐ **So "down 70%" definitely refers to warm builds. And a cold build may be slower than before the upgrade** — it pays the extra cost of serialising intermediate results to disk.

> ⭐ **All the interviewer has to ask is "and the first build?"; not having an answer means you never really understood the cache. Volunteering it earns credit instead**: "The cold build actually got slightly slower; the win is on every warm build after it. **In day-to-day work you build dozens of times a day, so it is a good trade.**"

### ⚠️ Qualifier two: `local` is a precise word

⭐ **The persistent cache does nothing on CI by default: CI starts from a fresh container every time, the cache directory does not exist, and every build is cold** — so not only is there no 70% improvement, **it is slightly slower than before.**

**Making it work means explicitly persisting `node_modules/.cache/webpack` as a CI cache artifact** (`actions/cache` or equivalent).

> ⭐ **Being able to explain this shows you did not just copy a config block out of the docs. `local` on the resume is not filler, it is an accurate qualifier.**

### How it was measured

| Tool | Use |
|---|---|
| ⭐ `time npm run build` | **The most honest** — it measures the real interval between pressing enter and being able to do something else |
| `speed-measure-webpack-plugin` | Prints **how long each loader and each plugin took**. ⭐ **This is the correct workflow for build-speed work: measure who is slow first, then optimise that. Copying in a pile of config up front is guessing, not optimising** |
| `webpack --progress --profile` | Prints the time spent in each phase directly |
| `node --cpu-prof` | Produces a flame graph for **tracking down strange slowness** (a loader stuck in regex backtracking, say) |

**Sample size and machine**: ⭐ **run at least 3–5 times and take the median, discarding the first** (OS page cache and disk warm-up distort it). State the machine's core count, memory and ⭐ **especially the disk — the persistent cache is precisely a disk read/write, and the benefit shrinks noticeably on a spinning drive.**

### ⭐ A more honest way to compare

**"Webpack 3 without a cache" against "Webpack 5 with a cache" is strictly comparing two things at once**: the benefit of the upgrade plus the benefit of the cache.

| | webpack 3 | webpack 5, no cache | webpack 5 + cache |
|---|---|---|---|
| **Cold build** | A | B | B′ (slightly slower than B) |
| **Warm build** | A (3 has no persistent cache, so every build is cold) | B | **C (much faster)** |

⭐ **That 70% is A → C. Within it, A → B is webpack 5's own performance work and only B → C is the cache's doing.** When pushed on "how much came from the upgrade and how much from the cache", **being able to draw that table wins the exchange** — even answering "we never separated them at the time; the main attribution is the cache" beats having nothing.

## 7. ⚠️ The causal links in that resume sentence are mismatched (know it before they do)

> `extracting vendor and runtime chunks and turning on persistent caching — bundle size down ~15%, local build times down 70%`

**The dash loosely binds two actions to two results**, but the real mapping is:

| Action | Real result |
|---|---|
| Splitting the vendor/runtime chunks | → **cache hit rate** (a result the sentence never mentions) |
| Turning on the persistent cache | → build time ✅ this one lines up |
| ⭐ **(Not mentioned in the sentence) removing the polyfills + tree shaking** | → **size −15%** |

**Suggested rewrite:**

> Led a Webpack 3-to-5 migration across 10+ incompatible packages: split vendor and runtime into separately-hashed chunks so a business change no longer invalidates them, dropped the automatic Node polyfills, and turned on the filesystem cache — bundle size down ~15%, warm local builds down 70%.

**Each of the three actions now carries its own result**, and the cold/warm qualifier is folded in as well.

## Glossary

| 中文 | English |
|---|---|
| 打包器 | **bundler** |
| 依赖图 | **dependency graph** |
| 产物 / 输出 | **build output · artifacts** |
| 破坏性变化 | **breaking change** |
| 垫片 | **polyfill** |
| 摇树 | **tree shaking** |
| 死代码 | **dead code** |
| 代码分割 | **code splitting** |
| 拆出 vendor / runtime | **extract vendor and runtime chunks** |
| 内容哈希 | **contenthash** |
| 长效缓存 | **long-term caching** |
| 缓存失效 | **cache invalidation** (*a business change invalidates them*) |
| 缓存命中率 | **cache hit rate** |
| 确定性的模块 id | **deterministic module ids** |
| 移位 | **shift** (*inserting a module shifts every id after it*) |
| 持久化缓存 | **persistent / filesystem cache** |
| 冷构建 ↔ 热构建 | **cold build ↔ warm build** (the resume uses `warm`) |
| 中间产物 | **intermediate artifacts** |
| 源码映射 | **sourcemap** |
| 压缩 / 混淆 | **minify** (gzip is **compression** — a different thing) |
| 体积回归 | **size regression** (*fail the PR if the bundle grows*) |
| 反直觉的一句 | ⭐ *code splitting redistributes size, it doesn't reduce it* |

> ⭐ **The three easiest to get wrong**:
>
> 1. **minify ≠ compress** — minify strips whitespace and shortens names, gzip compresses the transfer; when quoting a size always say which of **raw / minified / gzipped** it is
> 2. "The cold build got slower" is **the cold build actually got slightly slower; the win is on every warm build after it**
> 3. "Splitting does not reduce size" is **splitting redistributes size; the 15% came from dropping the Node polyfills and better tree shaking**
