---
title: "② The Webpack 3 to 5 migration"
section: Baidu
---

# ② The Webpack 3 to 5 migration

> **Resume line**
>
> Led a **Webpack 3-to-5 migration across 10+ incompatible packages**, **extracting vendor and runtime chunks** and **turning on persistent caching** — **bundle size down ~15%**, **local build times down 70% on warm builds**.

## Terms, in one line each

**Bundler** — browsers cannot run hundreds of source files importing each other. A bundler starts at an entry, follows the imports to collect the dependency graph, transforms everything into something browsers run, and merges it into a handful of files. **In its world everything is a module** — JS, CSS, images.

**Loader** — a **per-file** transformer that turns a non-JS asset into a module.

**Plugin** — hooks into the **build lifecycle** and acts on the whole build.

**"What is the difference between a loader and a plugin" is a frequent question; answer in one line**: **a loader can only change the contents of one file; a plugin can add files, change the whole output, and decide how chunks are grouped.**

**Chunk** — one output unit of bundled modules; **usually one chunk is one js file.**

**Polyfill** — code that supplies a capability the environment lacks.

**Tree shaking** — removing code that was imported but **never used**. **It relies on ES modules being statically analysable**: a named import shows which export you use without running anything, while **references decided at runtime cannot be shaken.**

**Contenthash** — the hash in an output filename, **computed from the file's contents**. **Unchanged contents, unchanged hash, and the browser downloads nothing.** That mechanism is **long-term caching**.

**Minify vs compress** — **minify strips whitespace and shortens names**; **gzip compresses in transit**. **They are not the same, and any size number must state raw, minified or gzipped.**

**Cold build / warm build** — whether a usable cache exists. **The easiest thing to get wrong in this line.**

## What this line has to show

The sentence carries **five things that can be probed**, and they are not equally hard:

1. **10+ incompatible packages** — you need concrete cases; **without one, the number is hollow.**
2. **Extracting vendor and runtime chunks** — **it buys cache hit rate, not size; getting that backwards exposes you.**
3. **Persistent caching** — the trap is that **the cold build gets slower.**
4. **~15% size** — **three different units**, each of which can double or halve the number.
5. **70% local build time** — **`local` is a precise qualifier**, because CI does not get this by default.

## The 10+ packages: talk in categories, not a list of names

**Four categories beat ten package names.** The interviewer wants to hear that you understood where the breaking changes were, not that you have a good memory.

**Category one: plugins replaced by official ones.** `extract-text-webpack-plugin` → `mini-css-extract-plugin`, `CommonsChunkPlugin` → `SplitChunksPlugin`, `uglifyjs-webpack-plugin` → the built-in `TerserPlugin`. **Swap the package, rewrite the config: grunt work.**

**Category two: absorbed into built-in capability.** `file-loader` / `url-loader` / `raw-loader` were replaced by **Asset Modules**. **The most satisfying category — the dependency is deleted outright.**

**Category three: plugin APIs changed.** `tapable` went up a major version, and hook registration moved from `compiler.plugin('emit', fn)` to `compiler.hooks.emit.tap('Name', fn)`. **This is the time sink**, because what it hits is **in-house plugins and unmaintained niche ones** — the public ecosystem had long since caught up, but **internal plugins had no owner, no migration guide, and had to be fixed by reading their source.**

**Category four: Node polyfills removed. This is the one to lead with.**

## The lead case: Node polyfills removed

Straight after the upgrade:

```
Module not found: Error: Can't resolve 'crypto' in '/src/utils'

BREAKING CHANGE: webpack < 5 used to include polyfills for node.js core
modules by default. This is no longer the case.
```

**At first glance it looks like a missing dependency; in fact Webpack stopped doing something you never knew it did.**

Up to Webpack 4, importing `crypto` in browser code got **silently swapped for a JS reimplementation and shipped in your bundle.** Webpack 5 stopped, on the grounds that **most of the time you simply imported a Node-only library by accident and it quietly added tens of kilobytes for you.**

**Three ways to handle it; explaining the trade-off scores:**

```js
resolve: {
  fallback: {
    crypto: require.resolve('crypto-browserify'),  // ① fastest — puts the size back
    path: false,                                    // ② confirmed unreachable — biggest win
    // ③ replace the dependency — cleanest, slowest
  },
},
```

**Its extra value: it is also the main source of the 15% size reduction.** One change explaining two numbers, told together, sounds like someone who actually lived through the migration.

## The backup case: CommonsChunkPlugin → SplitChunks

**It is not a rename, it is a different mental model.**

**The old plugin was imperative**: you name the entries whose shared code goes into a chunk called vendor, and each additional layer is written out by hand.

**The new one is declarative**: you write rules — which modules go in which group, at what priority, below what size not to split — and **webpack groups them.**

So the migration rewrites **"which chunks I want" into "what kind of module should be split out".**

### Telling it as "the hardest problem"

**This works better than the polyfill case.** The polyfill case has an error message and an official hint, and one line of `resolve.fallback` fixes it. This one is hard because **nothing errors**: the two plugins have no one-to-one config mapping, the build still passes and the pages still run, but the chunks that come out are no longer the same. The problem does not surface at build time. It shows up later: caches invalidating for no clear reason, a bigger first load, a page going blank.

**The difficulty has three layers:**

1. **The old config does not translate.** A typical Webpack 3 setup stacks two CommonsChunkPlugin instances: one uses a `minChunks` function to pull `node_modules` into vendor, the other uses `name: 'manifest', minChunks: Infinity` to split the runtime out. In Webpack 5 the first becomes `cacheGroups` and the second becomes `runtimeChunk`. **That is where `runtime chunks` on the resume comes from.** The old style is a list of commands and the new one is a set of rules, so you cannot convert it line by line. You have to work out what the old config actually produced, then describe it again as rules.
2. **Defaults quietly change the result.** `chunks` defaults to `'async'`, which ignores synchronous imports entirely, and the defaults for `minSize` and `maxInitialRequests` can stop some rules from applying. **The config can be right and the output still wrong.**
3. **File names change.** They used to be fixed as `vendor.js` and `manifest.js`. Now the rules decide how many chunks there are and what they are called. Anything that hard-codes a file name breaks: HTML templates, server templates, preload lists.

**How to confirm the migration is right: check the output, not the config.**

- Export build stats (`--json`) before and after, or compare in bundle analyzer, and check whether the modules in each chunk changed: whether vendor got broken up, whether business code leaked into vendor.
- Change one line of business code, rebuild, and diff the two sets of file names (the method in the long-term caching section below). Only the business chunk's name should change.

**The two-minute version.** Fill the 【】 slots with what really happened. If you cannot remember, drop it. **Do not invent.**

1. **Context**: why the upgrade could not wait 【】, and which part you owned 【】.
2. **Why it was hard**: no one-to-one mapping, and a wrong migration **does not error**.
3. **What you did**: work out what the old config actually produced, regroup with `cacheGroups` by how often things change, and replace the manifest setup with `runtimeChunk: 'single'`.
4. **Where you got stuck**: 【the layer above you actually hit; only what happened】.
5. **How you verified**: compare chunk contents before and after, then the file-name diff.
6. **Result**: when business code ships, the vendor and runtime hashes no longer change.
7. **Looking back**: next time, script the output comparison before touching the config, and run it after every step.

**Lines you can say as is:**

> The hardest part wasn't the errors. It was the part that didn't error. CommonsChunkPlugin and SplitChunks don't map one-to-one. The old config was two plugin instances: one pulled `node_modules` into a vendor chunk, and the other split the runtime out as a manifest chunk. In Webpack 5 those become `cacheGroups` and `runtimeChunk`. The build passed, but the chunks came out different, and nothing told us. 【what actually broke】 So I stopped trusting the config and compared the output instead: the chunk contents before and after, then a filename diff after a one-line change. In the end, only the business chunk's hash changed.

As for what "10+" counts, **use package count** — entries added, removed or replaced in the `package.json` diff — **because it is the only definition with an objective basis.**

## What SplitChunks actually buys

**Kill the common misconception first: it is not a size reduction technique.**

By default one entry is one bundle, and **the problem is caching.** react, lodash, antd and your business code sit in one file, so **changing one line of business code changes the whole bundle's contenthash** and the user re-downloads all three libraries **even though not one byte of them changed.**

After splitting, the vendor part rarely changes and the business part changes daily, so **a business change only changes the business hash.**

**So splitting yields cache hit rate, not smaller bundles.** First-visit download is roughly unchanged, or **slightly larger** because each chunk carries wrapper code; the win is on every visit after. **The only case that genuinely reduces total size is deduplication.**

**Three practices worth remembering:**

```js
optimization: {
  splitChunks: {
    chunks: 'all',              // ① the key line: the default only splits dynamic imports
    cacheGroups: {
      framework: { test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                   name: 'framework', priority: 40 },        // ② layer by change frequency
      lib:       { test: /[\\/]node_modules[\\/]/, minSize: 100_000,
                   name: m => hashOf(m), priority: 30 },
      commons:   { minChunks: 2, priority: 20 },
    },
  },
  runtimeChunk: 'single',       // ③ runtime in its own file
},
```

**① `chunks: 'all'`.** The default splits only what comes out of dynamic imports and **ignores synchronous imports entirely** — that single line is why most projects "configured splitChunks and saw no effect".

**② Do not bundle every dependency into one big vendor.** With a 1 MB vendor file, **upgrading any dependency at all — even a helper used once — changes the whole file's hash and re-downloads 1 MB.** The right approach is **layering by change frequency**: the framework layer almost never changes, large libraries above a threshold stand alone, and the rest becomes shared code. **This is the layout Next.js uses internally.** In one line: **group by change frequency, so the stable and the volatile are not tied to the same file.**

**③ Extract the runtime.** The runtime is a small piece of webpack's own code: the module registry, the module loading function, and **the chunk-to-filename map.** **The map is the point**: any chunk's hash changing changes the map, and **the runtime is bundled into the entry chunk by default**, so **changing any chunk changes the entry's hash and the user re-downloads the entry too.** Extracted, it is a few kilobytes on its own. **That is what `runtime chunks` on the resume means.**

## The precondition for long-term caching: deterministic module ids

**Without this, everything above is wasted.**

Webpack numbers modules internally, and **Webpack 4 defaulted to incrementing integers.** **Insert a new dependency in the middle and every module id after it shifts by one.** Module ids are written into the output, so **every output's contents change, every contenthash changes, and the user's entire cache is invalidated at once** — **without a single line of business code changing.**

Webpack 5 defaults to **`moduleIds: 'deterministic'`**, hashing the module path into a short id, **so adding a module does not move anyone else's id.**

This example is worth telling because it shows **"contenthash in the filename" is necessary but not sufficient: if the module ids underneath are unstable, the hash above them is a lie.** It is also one of the free wins of 3 → 5.

**Verifying the caching strategy beats listing config.** Build once and record the output filenames, change one line of business code, build again, **and diff the two filename lists.**

- Done well, **only the business chunk's filename should differ**; framework and vendor do not move.
- **Everything changed** → module ids are not deterministic.
- **The entry chunk changed too** → the runtime was not extracted.
- **Vendor changed too** → business code and dependencies landed in the same group.

**The value of this method is that it turns "long-term caching" from an abstract goal into something you can run, see and screenshot.**

**Finer is not better; know three constraints**: there is a default cap on initial requests; **HTTP/1.1 allows six connections per host**, so twenty files just queue; and **small files compress worse** — gzip finds repetition through context, so splitting one 100 KB file into ten 10 KB files **totals more after compression.** That is why `minSize` exists.

## The 15%: how it was measured, in what unit, credited to what

**How to measure.** `webpack-bundle-analyzer` draws a treemap where area is size and you can drill into individual packages; **it shows raw, minified and gzipped side by side.** For scripted comparison, export the `--json` stats. **The crudest and most solid method is the total size of the output directory** — exactly the files the user downloads, **with no room for interpretation.**

You can also **set a red line in CI with a tool like size-limit** so a PR fails if size grows past a threshold; **raising that unprompted scores well**, because it shows you thought about **not regressing**, not just optimising once.

**Both builds must be the same commit of business code**, or you are measuring product changes instead of tooling changes.

**Three units:**

1. **Which files.** **Sourcemaps are often larger than the JS and the user never downloads them**, so the correct unit is **only what users actually download, excluding sourcemaps.**
2. **Compression.** **gzip absorbs part of the difference** — if what you removed was highly repetitive code, a 15% raw reduction **may be only 8 points gzipped.** Reporting gzipped is preferable (it is real download weight), **but you must say which one you are reporting.**
3. **Build mode.** **Only production numbers mean anything**; development does not minify or tree-shake and can be several times larger.

**It looks like a basic question. It is a filtering question.**

**Attribution.** The largest share is probably **removing the Node polyfills**, tens of kilobytes upward. **Better tree shaking** is medium. **A newer built-in Terser and Asset Modules** are small. Incidental dependency upgrades are uncertain.

**Note that SplitChunks is not in that list — this is where the line is easiest to get caught.** The resume sentence reads as though splitting produced the size reduction, so if an interviewer follows that logic, **correct it yourself: splitting bought cache hit rate; the size came from the items above. Volunteering that correction proves comprehension better than anything else.**

## The 70%: two qualifiers

**Where the win comes from.**

```js
cache: {
  type: 'filesystem',                           // intermediate results to disk
  buildDependencies: { config: [__filename] },  // config is a build dependency too
},
```

Each module's **compiled intermediate result is stored on disk**, and unchanged modules are read back, **skipping the whole loader chain** — Babel transpilation, TS compilation, the expensive parts.

**Explaining invalidation scores**: a module's cache key combines **content hash + loader version hash + config hash + dependency module hashes**, and **any one changing is a miss.**

**Qualifier one: the cold build gets slower.** The first build writes the cache and runs in **minutes**; the second reads it and runs in **tens of seconds**. **So 70% necessarily means warm builds, and the cold build may be slower than before the upgrade** — you pay to **serialise intermediate results to disk.**

**One question — "and the first build?" — separates understanding from copying. Volunteering it scores**: the cold build did get slightly slower, and the win is on every warm build after; a normal day has dozens of builds, so the trade is clearly worth it.

**Qualifier two: `local` is precise.** **Persistent caching does not apply in CI by default**, because CI starts from a fresh container with no cache directory, so **every build is cold** — no 70%, and slightly slower than before. **Making it work requires explicitly caching that directory as a CI artefact.**

**Being able to explain that shows you did not just copy config out of the docs; `local` on the resume is not filler, it is an accurate qualifier.**

**How to measure.** The most solid is `time` around the whole build command — **the real interval between pressing enter and being able to do something else.** To find out what is slow, use `speed-measure-webpack-plugin`, which reports time per loader and per plugin. **That is the correct workflow for build speed: measure who is slow, then optimise that. Copying a pile of config up front is guessing, not optimising.** `--progress --profile` also prints per-stage timings. For weird slowness — a loader backtracking in a regex — take a CPU profile and read the flame graph.

**State the sample and the machine**: run three to five times and take the median, **discarding the first** (OS page cache and disk warm-up distort it). Give CPU cores and RAM, **and especially the disk — persistent caching is disk I/O, and the win shrinks noticeably on a spinning disk.**

**A more honest framing.** Comparing "webpack 3 without cache" to "webpack 5 with cache" is **comparing two things at once**: the upgrade plus the cache. Webpack 3 had no persistent cache, so every build was cold; webpack 5 without caching is the same cold and warm, somewhat faster than 3; webpack 5 with caching is slightly slower cold and much faster warm. **The 70% spans "every webpack 3 build" to "a warm webpack 5 build"**, one part of which is webpack 5's own performance work and the other the cache.

Asked "how much came from the upgrade and how much from the cache", **laying out those three tiers wins the exchange**; and even "I did not separate them at the time; I attribute it mainly to the cache" beats having no answer.

## The resume sentence mis-pairs cause and effect — know it first

The dash ties two actions to two results loosely, but **the real pairing is**:

- **Splitting vendor and runtime** → **cache hit rate** (a result the sentence never states)
- **Persistent caching** → **build time** (this one lines up)
- **The 15%** → really from **polyfill removal and better tree shaking** (actions the sentence never mentions)

The recommended rewrite pairs each action with its own result and folds in the cold/warm qualifier:

> Led a Webpack 3-to-5 migration across 10+ incompatible packages: **split vendor and runtime into separately-hashed chunks so a business change no longer invalidates them**, **dropped the automatic Node polyfills**, and **turned on the filesystem cache** — bundle size down ~15%, **warm** local builds down 70%.

## Self-check

1. Can you state the division of labour between loaders and plugins?
2. Can you give the four incompatibility categories, and expand the Node polyfill one into a full case (error text plus three fixes)?
3. Can you explain that SplitChunks buys cache hit rate, not size?
4. Can you explain why deterministic module ids are a precondition for long-term caching?
5. Can you name the three variables in a size figure and say which one to report?
6. Can you volunteer that the cold build got slower and that CI does not get the win by default?
7. Can you point out the resume sentence's mis-pairing and offer the rewrite?
8. Can you tell CommonsChunkPlugin → SplitChunks as a two-minute hardest-problem story, covering "the hard part is that nothing errors" and "verifying through the output"?
