---
title: "② The Webpack 3 to 5 migration"
section: Baidu
---

# ② The Webpack 3 to 5 migration

> **Resume line**
>
> Led a **Webpack 3-to-5 migration across 10+ incompatible packages**, **extracting vendor and runtime chunks** and **turning on persistent caching** — **bundle size down ~15%**, **local build times down 70% on warm builds**.

## What this line has to show

There are five things in that sentence someone can dig into, and they are not equally hard. Ten-plus incompatible packages needs concrete cases — without a case the number is empty. Extracting vendor and runtime chunks buys cache hit rate, not size, and getting that backwards exposes you. Persistent caching has a trap: the cold build actually gets slower, and that is the easiest thing here to misstate. "Size down 15%" has three definitions — which files you count, which compression, which build mode — and each one can double or halve the number. And in "local build times down 70%", the word *local* is a precise qualifier, because CI does not get that win by default.

## Four terms, defined first

**What a bundler does.** The browser cannot run hundreds of source files importing each other. A bundler starts from an entry point, follows the imports to collect the dependency graph, transforms everything into a form the browser can run, and merges it into a handful of files. In its world everything is a module — JavaScript, CSS, images. A loader is a file-level transformer that turns a non-JS asset into a module. A plugin hooks into the build lifecycle and acts on the build as a whole. A chunk is one output unit of bundled modules, usually one `.js` file.

"What is the difference between a loader and a plugin" comes up constantly. One sentence: a loader can only change the contents of one file, a plugin can add files, rewrite the whole output, and decide how chunks are grouped.

**Polyfills, and why Webpack used to inject them.** A polyfill is working code that fills in a capability the environment lacks. Node has built-in modules like `crypto`, `path` and `buffer`; browsers do not. In Webpack 4 and earlier, importing `crypto` in browser code silently substituted a JavaScript reimplementation and bundled it. Webpack 5 stopped doing this, on the reasoning that most of the time you have simply reached a Node-only library by accident, and it has been quietly adding tens of kilobytes on your behalf.

**Tree shaking.** Removing code that was imported but never used. It depends on the static structure of ES modules: a named import tells you which export is used without running anything, whereas a reference resolved at runtime cannot be shaken.

**Contenthash and long-term caching.** The hash in an output filename is computed from the file's contents. Contents unchanged, hash unchanged, and the browser serves from cache without downloading a byte. Contents changed, filename changed, and it downloads as a new file. That mechanism is long-term caching.

## The incompatible packages: talk in categories, not a list of names

Listing ten package names is worth less than explaining four categories. The interviewer wants to hear that you understood where the breaking changes were, not that you have a good memory.

The first category is plugins replaced by official successors: the CSS extraction plugin, the common-chunk plugin and the minifier all got new implementations. Swap the package, rewrite the config — mechanical work.

The second is capabilities absorbed into core: the file and URL loaders were replaced by Asset Modules. This is the satisfying category, because the dependency simply disappears.

The third is plugins whose API changed, because the underlying hook library went up a major version and hook registration moved from an old method call to a hooks object with tap-style methods. This one eats the most time, because what it hits is in-house plugins and unmaintained niche ones. The official ecosystem had long since caught up; the plugins written inside the company had no owner and no upgrade guide, so the only option was reading the source and rewriting.

The fourth is the removal of Node polyfills, and it is the one worth leading with.

## The lead case: Node polyfills removed

After the upgrade it fails with "cannot resolve crypto", followed by a breaking-change note saying Webpack used to include polyfills for Node core modules by default and no longer does.

At first glance that reads like a missing dependency. In fact Webpack deliberately stopped a behaviour you never knew existed. That is what makes the case memorable: the error and the cause do not match.

There are three ways to handle it, and being able to explain the trade-offs earns credit. Configure a fallback pointing at the browser implementation — fastest, but you have just added the size back. Configure the fallback as `false` — for when you have confirmed the browser never reaches that code, and this is where the size win is largest. Or replace the dependency — cleanest, and slowest.

This case has an extra payoff: it is also the main source of the 15% size reduction. One change explains two numbers, and telling it that way makes it clear you actually lived through the migration.

## The backup case: the common-chunk plugin becoming SplitChunks

This was not a rename, it was a change of mental model. The old plugin was imperative: you named the entries whose shared code should be extracted into a chunk called vendor, and if you wanted several layers you wrote them one at a time. The new plugin is declarative: you write rules — which modules belong to which group, at what priority, below what size not to split — and webpack does the grouping.

So the migration was rewriting "I specify which chunks I want" into "I describe which modules should be split out".

As for what "10+" counts: the defensible definition is packages, meaning entries added, removed or replaced in the `package.json` diff, because that is the only count with an objective basis.

## What SplitChunks actually buys

Kill the common misconception first: it is not there to reduce size.

By default one entry becomes one bundle, and the problem is caching. React, lodash, antd and your business code all sit in one file. You change one line of business code, the whole bundle's contenthash changes, and users re-download all three libraries even though not one byte of them changed.

After splitting, the vendor file rarely changes and the business file changes daily, so a business edit only changes the business hash.

So the output of splitting is cache hit rate, not a smaller bundle. Total download on first visit is roughly unchanged — slightly larger, in fact, since each chunk carries its own wrapper code — and the entire benefit lands on subsequent visits. The one case where total size genuinely drops is deduplication.

Three practices worth remembering. First, set `chunks` to `all`. The default only splits what came out of dynamic imports and ignores synchronous imports entirely — that one line is why most projects "configured splitChunks and saw no effect".

Second, do not bundle every dependency into one giant vendor file. With a one-megabyte vendor bundle, upgrading any single dependency — even a tiny utility used once — changes the hash of the whole file and the user re-downloads a megabyte. The right approach is layering by rate of change: a framework layer that almost never moves, large libraries over a threshold standing alone, and everything else as shared code. That layering is exactly what Next.js does internally. One sentence: group by rate of change, so the stable and the volatile are never in the same file.

Third, extract the runtime into its own file. The runtime is a small piece of code webpack injects — the module registry, the module loader function, and the map from chunk to filename. That map is the point: when any chunk's hash changes, the map changes, and since the runtime is bundled into the entry chunk by default, changing any chunk also changes the entry's hash and the user re-downloads the entry too. Extracted, it is a few kilobytes of its own and chunk hash changes only touch it. That is what "runtime chunks" on the resume refers to.

## The precondition for long-term caching: deterministic module ids

Miss this one and everything above is wasted.

Webpack assigns each module an internal id, and Webpack 4 defaulted to auto-incrementing numbers. Insert a new dependency in the middle and every module after it shifts by one. Module ids are written into the output, so all output contents change, all contenthashes change, and every user's cache is invalidated at once — without you touching a single line of business code.

Webpack 5 defaults to deterministic module ids: a short hash of the module path, so adding a module does not disturb any other module's id.

This example is worth telling, because it shows that hashed filenames are a necessary but not sufficient condition for long-term caching. If the module ids underneath are unstable, the hashes on top are a lie. It is also one of the wins you get for free from 3 to 5.

There is a way to verify the caching strategy that is far better than reciting config: build once and record the output filenames, change one line of business code, build again, and diff the two lists. If splitting is done right, only the business chunk's filename should have changed; the framework and vendor chunks should be untouched. If everything changed, module ids are probably not deterministic. If the entry chunk changed too, the runtime was not extracted. If vendor changed, business code and dependencies landed in the same group. The value of this method is that it turns "long-term caching" from an abstract goal into something you can run, look at and screenshot.

Splitting can also go too far, and there are three constraints. There is a default cap on initial requests. Under HTTP/1.1 a domain gets six parallel connections, so twenty files just queue. And small files compress worse: gzip finds repetition using context, so splitting one hundred-kilobyte file into ten ten-kilobyte files produces a larger total after compression. That is why the minimum-size threshold exists.

## The 15%: how to measure, which definition, and where it came from

**Measuring.** A bundle analyzer draws a treemap where area is size and lets you drill into a specific package; by default it shows raw, minified and gzipped figures side by side. For scripted comparison, export the build stats as JSON. The crudest and most honest method is looking at the total size of the output directory — that is exactly the set of files the user downloads, with no room for interpretation. You can also put a size threshold in CI so a pull request goes red if the bundle grows past a percentage; raising that yourself earns real credit, because it shows you were thinking about how not to regress rather than about one optimisation.

When comparing, both builds must be the same commit of business code, or you are measuring product changes rather than build tooling.

**Three definitions.** Which files you count is the first trap: sourcemaps are often larger than the JavaScript, and the user never downloads them, so the correct definition is only what the user actually downloads, sourcemaps excluded. Compression is the second: gzip eats part of the difference, so if what you removed was highly repetitive code, raw size may drop 15% while gzipped only drops 8%. Report the gzipped number, since that is what the user really downloads, but say which one you are reporting. Build mode is the third: only production numbers mean anything, since development mode neither minifies nor tree-shakes and can be several times larger. That question looks basic, but it is a filter.

**Attribution.** The largest share is probably the removed Node polyfills, tens of kilobytes at minimum. Improved tree shaking is a medium contribution. The updated built-in minifier and Asset Modules are small. Incidental dependency upgrades are unquantified.

Note that SplitChunks is not in that list, and this is where the line is easiest to get caught. The resume sentence reads as though splitting produced the size drop, so if an interviewer follows that logic, correct it yourself: splitting bought cache hit rate, and the size came from the items above. Volunteering that correction proves you understand this better than anything else could.

## The 70%: two definitions

**Where the win comes from.** Turning on the filesystem cache stores each module's compiled intermediate result on disk, so next time unchanged modules are read straight back, skipping the whole loader chain — Babel, TypeScript, the expensive steps. Explaining invalidation earns credit: each module's cache key combines its content hash, the loader version hashes, the config hash and the hashes of its dependencies, and any of them changing is a miss. The config file itself is registered as a build dependency, so editing config invalidates everything.

**Definition one: the cold build gets slower.** The first build writes the cache and runs in minutes; the second reads it and runs in tens of seconds. So "down 70%" necessarily refers to warm builds, and the cold build may be slower than before the upgrade — it pays the extra cost of serialising intermediate results to disk.

An interviewer only has to ask "what about the first build?" and not having an answer shows you never understood the cache. Volunteering it earns credit instead: the cold build did get slightly slower, and the win is on every warm build after it; in a day of development you build dozens of times, so it is a good trade.

**Definition two: *local* is a precise qualifier.** Persistent caching does not work on CI by default, because CI starts from a fresh container every time, the cache directory does not exist, and every build is cold — no 70%, and in fact slightly slower than before. To make it work you have to explicitly persist the cache directory as a CI cache artifact. Being able to explain that layer shows you did not just copy a config block out of the docs; *local* on the resume is not filler, it is an accurate qualifier.

**Measuring.** The most honest method is wrapping the whole build command in `time`, which measures exactly the period from hitting enter to being free again. To find out what is slow, use a build speed measurement plugin: it prints how long each loader and each plugin took. That is the correct workflow for build performance — measure who is slow, then optimise that. Copying a pile of config first is guessing, not optimising. Running the build with progress and profiling flags also prints per-stage timings, and for genuinely strange slowness — a loader doing catastrophic regex backtracking, say — a CPU profile and a flame graph will find it.

Report the sample and the machine. Run three to five times and take the median, discarding the first, because OS page cache and disk warm-up distort it. For the machine, give core count, memory and especially the disk — persistent caching is disk I/O, and on a spinning disk the win is noticeably smaller.

**A more honest comparison.** Comparing "Webpack 3 with no cache" against "Webpack 5 with cache" is strictly comparing two things at once: the upgrade itself, plus the cache. Webpack 3 has no persistent cache, so every build is effectively cold. Webpack 5 without the cache is at one level, cold and warm alike, and faster than 3. Webpack 5 with the cache is slightly slower cold and much faster warm. The 70% runs from "every Webpack 3 build" to "a warm Webpack 5 build", where one segment is Webpack 5's own performance work and the other is the cache. If someone asks how much came from which, being able to lay out those three levels wins the exchange — and even answering "we never separated them; I attribute most of it to the cache" is far better than having nothing.

## The resume sentence has its causes mismatched — know it first

The dash lumps two actions and two results together, but the real mapping is different. Extracting vendor and runtime chunks bought cache hit rate, a result the sentence never states. Turning on persistent caching bought build time — that one lines up. And the 15% actually came from the dropped Node polyfills and better tree shaking, two things the sentence does not mention.

The suggested rewrite pairs each action with its own result and folds in the cold/warm qualifier:

> Led a Webpack 3-to-5 migration across 10+ incompatible packages: split vendor and runtime into separately-hashed chunks so a business change no longer invalidates them, dropped the automatic Node polyfills, and turned on the filesystem cache — bundle size down ~15%, warm local builds down 70%.

## Self-check

1. Can you state the division of labour between a loader and a plugin?
2. Can you name the four categories of incompatibility and expand the Node polyfill one into a full case?
3. Can you explain that SplitChunks buys cache hit rate rather than size?
4. Can you explain why deterministic module ids are a precondition for long-term caching?
5. Can you name the three variables in a size figure and say which one to report?
6. Can you volunteer that cold builds got slower, and that CI does not get the win by default?
7. Can you point out the mismatched causes in the resume sentence and offer the rewrite?
