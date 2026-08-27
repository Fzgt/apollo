---
title: Phase 3 & 4 topic review
section: Course & old notes
---

# Phase 3 / 4 advanced practice — daily notes, reorganized and explained

> Note: the original notes were jotted down during the course and are fragmentary, with a lot of spoken shorthand. This version regroups them by topic and explains each point in full, so it can be read now without recalling the original context.

## 1. Serverless architecture (BFF/SFF, Cloudflare vs AWS, IPFS)

### 1. How BFF and SFF relate

**BFF** (Backend For Frontend): a backend layer built specifically for the frontend, which aggregates and trims the data from several microservices into exactly the shape the frontend needs, so the frontend does not have to stitch multiple endpoints together itself.

**SFF** (Serverless For Frontend): the same idea as BFF (a backend layer serving the frontend), except this layer is no longer a Node server you run yourself (a long-lived Express or Koa process) but a cloud vendor's serverless function (AWS Lambda, Cloudflare Workers). It starts when it is used, consumes nothing when it is not, and bills per invocation.

Why interviews ask about it: because "the resume needs a Node-related project", and SFF is the most natural place for a frontend developer to write Node — you are writing Node code, but to serve your own frontend, without taking on a complicated backend architecture.

### 2. How the three major clouds differ on serverless deployment

- **AWS Lambda**: the most complete, supporting essentially any kind of node_modules dependency. Deployment gives your Lambda an isolated sandbox — even a broken third-party package cannot affect the host machine, because AWS built an isolation layer for it.
- A plain Lambda is deployed only in the region you pick (the US or Australia, say), not globally. Serving users from nearby worldwide needs **Lambda@Edge** (deployed to global edge nodes) plus **Lambda Shield** (DDoS protection) to make a complete solution.
- **Cloudflare Workers**: the programming model closely resembles a frontend Service Worker (intercept a request, return a response). It is globally deployed by nature with DDoS protection included, so there is no assembling Edge and Shield separately as on AWS.
- Cloudflare's downsides: (1) some dependencies are unsupported, especially packages wrapping low-level system APIs such as anything involving OpenGL, because the Workers runtime is leaner than Node; (2) cold starts are handled well, but the trade-offs against AWS cut both ways.
- Cloudflare's deployment mechanism is unusual: it has its own build step, so your JS and its node_modules dependencies are bundled into a single file and uploaded, rather than shipping a whole zip including the dependency directory as on AWS, or deploying from a Nest.js/Koa template.
- **Cloudflare Workers Pages**: a service for deploying static frontend sites, with CI/CD built in (authorize the Git repository and it builds and deploys automatically, with no pipeline to configure). A common combination is therefore the frontend on Workers Pages and the APIs on Cloudflare Workers — one vendor's ecosystem, and they fit together well.

### 3. IPFS and decentralized deployment

IPFS (InterPlanetary File System) is essentially a decentralized world hard drive — files live on nodes distributed globally rather than one central server, which in theory makes it very resistant to attack (take one node down and the others remain).

Many Web3 projects deploy their frontend to IPFS. Two practical problems follow: (1) the address IPFS gives you is a long hash, unfriendly and impossible to remember; (2) IPFS's own addressing protocol (finding which node holds the content for a given hash) is slow.

Cloudflare's role here: it synchronizes information about global IPFS nodes onto its own servers and accelerates the reverse lookup for you. Visiting a "Cloudflare domain + hash" address lets Cloudflare find and return the IPFS content faster — effectively a CDN-style caching layer on top of IPFS's natively slow addressing.

### 4. Service Worker and PWA

PWA (Progressive Web App): a set of standards for making a web page feel close to a native app (add to home screen, work offline, push notifications). The concept has cooled off, but it left behind something very useful — the Service Worker.

**Service Worker**: a separate thread running in the browser's background that can intercept network requests and cache for offline use. Even though PWA as a whole is no longer fashionable, the Service Worker itself is still widely used for exactly that one job.

**Workbox**: Google's library, currently the mainstream way to build Service Worker offline caching, hiding the complexity of writing that caching logic by hand.

The name Cloudflare Workers deliberately echoes the Service Worker developer experience (the same syntax, the same intercept-request-return-response model), only running on the server rather than in the browser.

### 5. Understanding the caching layers as a whole (the exercise set in the notes)

- **HTTP strong caching**: the browser decides from response headers (such as Cache-Control), and on a hit uses the local copy without sending a request at all.
- **Local storage (localStorage and friends)**: data you read and write manually in JS. It survives a page refresh, but you write the read/write logic yourself instead of the browser handling it as with HTTP caching.
- **Workbox / Service Worker caching**: in between. It intercepts the network request itself, so you control precisely whether a given request uses the cache and with what strategy, up to working fully offline (returning cached content when the request fails).
- The essential difference between the three is who decides whether to cache, at what granularity, and with how much control: HTTP caching is the least effort and the least flexible; localStorage is the most flexible but entirely hand-written; a Service Worker sits in between, precise but requiring interception logic.

---

## 2. Monorepo tooling (pnpm + lerna/nx/rush + a verdaccio private registry)

### 1. Why a monorepo

The situation: project A in the company needs project B (a component or utility library). If A and B are entirely separate repositories, then when B changes, A has to wait for B to go through the whole publish-a-new-version-to-npm-or-the-private-registry process, then run npm install again, before it can use the new code. That is slow, and coordinating it is expensive.

**A monorepo** puts A and B in one repository, so A symlinks directly to the local B. Nothing needs publishing anywhere, nothing needs waiting for, and a change to B is visible to A immediately — that is the core pain a monorepo removes.

### 2. What pnpm gives you

- **Speed**: content-addressed storage plus hard links reuse packages already downloaded, so the same version does not get downloaded again per project. Compared with npm or yarn, where one lodash may be physically copied into 100 projects, pnpm stores one copy and links the rest.
- **Hard links vs symlinks** (a concept the notes return to repeatedly): a hard link is another entrance to the same data on disk, and deleting one entrance does not stop the others from reading it; a symlink is a shortcut pointing at another link, and if what it points at goes away, it breaks too. pnpm uses hard links exactly to get "stored physically once, usable in many places".
- **Safety**: pnpm enforces strict dependency access. If A depends on B and B depends on C, and A's code imports C directly (without C being declared in A's package.json), pnpm treats that as illegal access — C only arrived through B, so if B's version changes, C may change or vanish, and A using it directly is unsafe. pnpm puts these undeclared, passively acquired packages in a `.pnpm` orphanage directory where your code cannot reach them normally, forcing you to declare dependencies explicitly.
- **Workspace support** (managing multiple packages): npm has no such concept, yarn's is mediocre, and pnpm's workspace is fairly complete, managing several sub-projects or sub-packages in one repository.

### 3. Common pnpm workspace commands

- `pnpm add -w <package>`: install at the root a package every sub-project shares (babel, eslint — tooling that should be on one version repository-wide).
- `pnpm add <package> --filter "<sub-project>" --workspace`: add another package from inside the repository as a dependency of one sub-project (usable without publishing, symlinked straight in).
- `link-workspace-packages=true`: with this on, packages inside the workspace can recognize and link to each other.
- `shared-workspace-lockfile=false`: by default the whole workspace shares one lockfile, which keeps versions consistent everywhere; but as the project grows, that lockfile becomes enormous and pnpm's dependency analysis time explodes (installing one package can take minutes). Turn it off and each sub-package gets its own lockfile, which is faster, at the cost of versions possibly diverging between packages and needing manual attention.

### 4. What lerna, nx and rush each do

These tools do not replace pnpm, they complement it — pnpm handles how dependencies are installed and shared, while lerna/nx/rush handle how multiple packages are versioned and published together.

- **lerna**: the veteran monorepo manager, mainly responsible for versioning many packages at once and publishing them in dependency order (`lerna publish` sorts out inter-package ordering automatically). Since version 3.0 it no longer supports publishing one specific package, and the notes suggest falling back on npm's own publishing for that case.
- **nx**: complements lerna, and its standout feature is generating a visual dependency graph of projects and packages (`nx graph`), which makes who-depends-on-whom obvious across the monorepo.
- **rush.js**: Microsoft's, and considerably heavier on process. The notes say "use rush.js when it finally comes to integrating publishing into the engineering process" — meaning that when the workspace approach has to become a company-wide standard, rush offers a more complete set of capabilities.

### 5. The verdaccio private registry

**A private registry**: an npm package registry the company hosts internally and nobody outside can reach, holding the internal utility libraries that should not or cannot be published to public npm.

**verdaccio**: an open-source private npm registry proxy built on Node.js. Once installed it runs a service on the internal network (by default at http://localhost:4873), and pointing `.npmrc`'s registry at it lets the team install and publish internal packages exactly as they would with the official registry.

A deployment trap: the private registry must run long-term on a real server (an ECS instance, kept alive by a process manager such as pm2). If the network it sits on cannot reach the public internet, installing dependencies internally means talking to both the private registry and the public one, and speed becomes a serious problem.

As the number of packages in the registry grows into the thousands, pnpm's dependency analysis slows noticeably and installing one package can take minutes — which is why splitting the lockfile came up earlier as an optimization at scale.

---

## 3. A survey of React state management libraries

### 1. First distinguish two kinds of state: inside the component tree and outside it

**State inside the component tree**: the familiar useState/useReducer. It lives inside the React component tree and takes part in React's render scheduling (reconciliation).

**State outside the component tree**: the state lives in an ordinary JS object outside the React tree (an object floating free of React's management), and it connects to React components only through a specific mechanism (a Provider, or a subscription function). Redux, Zustand and Recoil are all of this kind.

Why use external state: (1) React hooks come with restrictions (no calling them inside an `if`, no calling them from an ordinary function) that external state does not have; (2) it makes global sharing much simpler, with no endless prop drilling or nested Contexts; (3) the state survives a component unmounting (useful for "remember what the user typed in the form last time"); (4) it can do fine-grained subscription — only components that actually read a slice re-render, rather than a whole subtree re-rendering as with Context.

### 2. The libraries one by one

- **Redux**: a clear structure that holds up on large projects, but a heavy way to write (the reducer / action / dispatch round trip is verbose), and centralized in style (all state crammed into one big store). It needs react-redux as a bridge to connect to components.
- **Mobx**: reactive tracking via Proxy, and simpler to write than Redux (no reducers). The notes are fairly negative about it: its update model conflicts with React's one-way data flow, changes are not transparent and are hard to trace, every function component that uses it has to be wrapped in an `@observer` decorator, and the closure-heavy style does not sit well with hooks. There was also mobx-state-tree (an attempt at nicer tree-shaped state management), but it used generator functions (yield), which had performance problems in V8, and the author was unwilling to change it, so it never became mainstream.
- **Recoil**: from the React team, built on atomic state management — state is split into independent minimal units (atoms) and a component subscribes only to the atom it needs, which removes the traditional layers of nested Context Providers.
- **Jotai**: positions itself as a simplified Recoil, with terser syntax and almost no learning cost coming from Recoil. Its ambition is broader: even in a project already using Redux or Mobx, Jotai can coexist and integrate on top rather than requiring a rewrite. Its implementation rests on `useState`, so it is entirely bound to React's hooks system — its limitation, since it only works inside React components and hooks.
- **Zustand**: by the same author as Jotai, tiny (on the order of 1kb), and its core idea leaves hooks entirely — the store it creates is an ordinary JS object usable anywhere, including outside React (inside a Three.js or Babylon.js scene, for instance). That is the biggest difference from Jotai.
- **Valtio**: the style resembles Vue's reactivity closely (anyone who has used Vue will find it natural), with good derived state (`derive`) and solid support for undo/redo — a good fit for inputs and rich text editors that need it, with helpers such as canRedo/canUndo for driving button states.
- **xState**: built on the finite state machine model, for cases where the state flow itself is complex (game logic, approval workflows, authentication flows, the full checkout process, order tracking). It expresses those transitions clearly as a machine instead of a scattering of if/else. It also has visual tooling — a VSCode extension turns a machine declared in code into a flow chart, and lets you drag out a flow chart to generate the machine code.

### 3. A simple way to choose

- A simple React project without complicated state flow → **Jotai** (light, atomic, enough)
- Managing state outside React (a 3D or game engine scene) → **Zustand** (it does not depend on hooks and works standalone)
- Lots of undo/redo interaction (a rich text editor) → **Valtio**
- Genuinely complex state flow (multi-stage approvals, an order state machine) → **xState**
- Async state around network requests (loading/success/failure/cache) → **React Query** (not strictly a state management library; it decouples async network state from component state, see the later section)
- Redux suits the old-school case of a very large project with strict team conventions; the notes rate Mobx poorly and do not recommend it for new projects.

### 4. State tearing

Background: React 18 introduced concurrent rendering, where a render can be interrupted and resumed (half-way through a render a more urgent update arrives, React handles the urgent one first and comes back to finish later).

The problem: if the state lives outside the React tree (the external state above — Redux, Zustand, Jotai), then during the gap between interruption and resumption that external state may have been changed elsewhere, so one render uses the old value in its first half and the new value in its second, and the page shows torn, inconsistent data.

Every external state library faces this, and the official answer is the `useSyncExternalStore` API — it reads state safely from an external source specifically to avoid tearing under concurrent rendering. Jotai reportedly avoids it with a double render, discarding the problematic render's result.

---

## 4. Webpack performance and code splitting (the key section)

### 1. Why split chunks at all (SplitChunksPlugin)

With no splitting configured, Webpack stuffs everything into one `main.js`, and on any sizeable project that file passes 4MB easily — at which point talking about performance optimization is meaningless, because the most basic step of not piling all the code into one file has not been taken. The notes put it bluntly: "if you have never configured SplitChunkPlugin, you have never cared about your project's performance".

### 2. What the Webpack runtime is, and why to extract it

Webpack's output actually places your code inside an object called `__webpack_modules__` (keys are module paths, values are the functions for those modules), which is then called through something like `__webpack_modules__['./src/index.js']`.

The Webpack runtime is the glue code Webpack injects, responsible for loading, resolving and scheduling modules — including the map from chunk id to file name. (In detail: extracting the runtime mainly prevents other chunks' hashes from changing whenever any chunk is added or removed, which protects browser cache hit rates.)

A single-entry (SPA) application generally does not need the runtime extracted unless the bundle is already fairly large (past 100kb or so), where it starts to pay. A multi-entry (MPA) application must extract it, because the entries share one runtime and would otherwise each carry a duplicate copy.

The extracted runtime file is small — the notes say around 23kb uncompressed and around 7kb gzipped — so the extra request costs very little and the benefit (protecting the cache on the big files) far outweighs it.

### 3. cacheGroups — the heart of the splitting configuration

cacheGroups is the core of the splitChunks configuration. Whatever rule you want Webpack to split by ("put everything from node_modules in a vendor bundle", "put the utilities shared across entries in a common bundle") is expressed as regex matching rules in cacheGroups.

- **minSize / maxSize**: control "smaller than this, do not split" and "larger than this, force a split". Both are fairly blunt instruments and their defaults are best left alone.
- **enforce**: apply a cacheGroups rule regardless of other priority rules. An example use: "strip console.log from .tsx files but keep it in .ts files" — a single minifier configuration would strip everything indiscriminately, so enforce plus loader rules is needed for a precise interception. Note that using enforce can disable other priority settings, so use it carefully and handle it first.
- **chunks: 'all'**: tells Webpack to include asynchronously (dynamically) imported code in the splitting analysis, not only synchronous imports.
- **priority**: when a module matches several cacheGroups rules, decides which one wins, avoiding conflicts. Watch the chunk output order as well — get it backwards and the script tags may be inserted in the wrong order, producing runtime errors (code that depends on something running before that something has loaded).
- **maxInitialRequests**: how many JS files may load in parallel for the entry (including the entry itself), default 4.
- **maxAsyncRequests**: how many on-demand async bundles may be split out, default 6.

### 4. Single entry vs multiple entries: completely different splitting behaviour

The notes stress this repeatedly, and it is the point most often misunderstood: SplitChunksPlugin decides whether to split based on whether code is shared **between chunks**.

In a single-entry (SPA) project, even if two different places import the same utils helper, as long as both end up in the same main chunk (never split into separate async chunks), Webpack will not pull utils out — from its point of view they were in the same bundle to begin with, so there is nothing to share.

Only when that utils is imported by two different **async** chunks (two lazily loaded route modules, say) does Webpack recognize shared code and extract it into a separate common chunk.

The practical conclusion: to get a piece of common code split out properly, first split the places that use it into separate async chunks with lazy or dynamic import. Otherwise, however correct your minChunks setting is, Webpack cannot see a sharing relationship at all.

### 5. Judging whether a bundle is "too big"

Using Google's performance guidance as a reference (the rules of thumb given in the notes):

- Between 30kb and 120kb gzipped: acceptable.
- Under 30kb gzipped: Webpack will not split it for you, because splitting adds an unnecessary request and costs more than it saves.
- Just over 30kb gzipped: the sweet spot.
- Approaching 120kb gzipped: Webpack warns and leans toward splitting it into two bundles.
- A main.js in the 8MB range: seriously over the line.

One addition: bundle size is only one dimension of page load speed. Loading JS and CSS blocks rendering (pending) in itself, so an acceptable size does not guarantee a good loading experience, and other metrics matter too. Large files such as video should be streamed in segments rather than requiring the whole file to download before playing.

---

## 5. React 18 concurrent rendering features

### 1. Urgent vs non-urgent updates

An ordinary useState/setState triggers an urgent update — executed immediately and reflected on the page immediately.

An update wrapped in `useTransition` is marked non-urgent — React prioritizes more urgent updates (whatever the user is typing right now) and defers the actual rendering work, so it does not block the current interaction.

### 2. Case 1: switching tabs

The situation: clicking a tab on the left loads a batch of new data and assets each time. Left alone, the loading can freeze the interface, and a user who then wants to click another tab cannot.

The fix: run the update that loads the new tab's content inside `startTransition`. Even when a switch has a lot of work to do, the user can still click other tabs smoothly (React marks the render as interruptible low priority), and the `isLoading` value destructured from `useTransition` can drive whether to show a loading state during the transition.

### 3. Case 2: filtering a large local dataset live

The situation: a table page where the user types a filter term and results update live, with a few hundred rows held locally. On a low-end device, re-filtering and re-rendering on every keystroke stutters.

- **Option one**: put the filtering and lookup logic inside `startTransition`. The input itself (the characters the user typed) stays high priority and responds immediately, while the filtering and result rendering drop to low priority. If the user types fast, React can even skip several intermediate filter renders and compute and show only the final settled result, cutting pointless repeated work.
- **Option two**: `useDeferredValue`. The hook gives you a delayed copy of a value, which updates to the latest only once all urgent updates are done. The effect resembles startTransition, only the usage differs (one wraps the update, the other wraps a value).

### 4. React 18 hooks at a glance

- `useTransition()` / `startTransition()`: mark an update as non-urgent, interruptible and deferrable.
- `useDeferredValue()`: get a delayed version of a value, which catches up once urgent updates are handled.
- `useId()`: generate an id unique to this component, commonly used to avoid name/id collisions between form fields (alongside ids generated by a UI library).
- `useInsertionEffect`: for css-in-js libraries to use internally (doing work at the moment style rules are inserted into the browser). Rarely needed in day-to-day work — a hook for building libraries.
- `useSyncExternalStore`: read state safely from an external data source (the external state libraries above), specifically to avoid tearing under concurrent rendering.

### 5. RSC (React Server Components) in brief

What the client receives is a description of DOM already computed on the server and ready to render (serialized). The client does not recompute that logic and just renders it — unlike the traditional model where the client receives data and works out the rendering itself. This reduces client-side computation and the amount of JS shipped.

### 6. Odds and ends

- Under React 18 StrictMode, useEffect runs twice in development. This is deliberate on React's part, meant to expose bugs where effects are not cleaned up properly (forgetting to clear a timer or subscription in the effect's return).
- **why-did-you-render**: a library specifically for debugging why a component re-rendered, useful for tracking down unnecessary re-renders.

---

## 6. Component library development (Storybook, Tailwind CSS)

### 1. What Storybook is

A tool for developing and showcasing UI components in isolation — outside any real business page you write a "story" for each component and preview it in its own playground under different props and states, which helps development, debugging and external documentation of a component library.

For a component used only within one project and not shared across teams, a stories folder in the project with Storybook for local preview is enough, without publishing a separate package; for something several teams share, it should be its own project published as a package.

`npx storybook init` installs the dependencies and generates two commands: one for local preview, and one that compiles the component documentation into static output you can deploy as a documentation site.

**MDX**: a file format that lets React components be embedded directly in Markdown. Storybook uses it for documentation, so prose and a live rendering of the component sit side by side.

Storybook with Webpack5's experimental lazy compilation noticeably improves local build speed, which suits projects with many components.

### 2. How Tailwind CSS works

Tailwind is the standard-bearer for atomic CSS — every style property (padding, colour) has its own reusable class name (`p-4`, `text-red-500`), different components in the project reuse the same set of class names, and the CSS that ships shrinks dramatically (officially, a reduction of about 70%).

A common misconception: "Tailwind shrinks the CSS but grows the HTML". The notes correct this — what actually grows is the JS, not the HTML, because a modern frontend project is mostly an SPA with a virtual DOM, the tags on the page are rendered by JS, and those long class-name strings are bundled into the JS file rather than written into static HTML.

A further optimization: write a postcss plugin that compiles those verbose atomic class names down to one- or two-letter names via a hashMap, which shrinks the JS further (by roughly 60%) and helps SSR especially. The notes add that no such plugin exists off the shelf, so it would have to be written.

Where Tailwind fits: it is a good fit for hand-writing mobile pages (usually not complex). On desktop, if you need a rich component library along the lines of antd, Tailwind has its own official (paid) component library, or you can pair it with headlessUI (free but with fewer components) or a more mature library such as Material UI or antd.

**Tailwind's JIT (Just-In-Time) mode**: older Tailwind only allowed the predefined size classes (`w-4`, `w-64`); JIT lets you write arbitrary values (`w-[1200px]`), and it is also the prerequisite for dynamic styles using calc().

---

## 7. Data fetching (React Query) and SSR/Next.js

### 1. What React Query solves

The core idea: manage async network request state (loading, success, failure, cached data) separately from a component's ordinary state, instead of hand-writing request logic and loading/error flags into a pile of useState calls.

- `useQuery`: issue a single query; `useQueries`: control several parallel queries.
- `useInfiniteQuery`: for infinite scroll and paginated loading (which lines up with the virtualized list and infinite scroll material learned earlier).
- Good support for SSR hydration and dehydration — the server fetches the data, renders HTML and sends it, and once the client takes over it inherits what the server already fetched instead of fetching again.

Where it fits: display-oriented sites with many reads and few writes (blogs, content sites) suit it well. A B2B admin system with a great many form submissions (POST requests) is less of a match — its strength is managing query caches, not complex form submission flows.

### 2. Next.js pros and cons (the notes are fairly blunt)

Pros: an excellent build toolchain (with SWC integrated) and a smooth local development experience.

Cons: the framework constrains you quite a bit — data prefetching is forced through its own conventional APIs (getServerSideProps and friends); its middleware runs inside the Edge Runtime (a lighter execution environment than full Node.js), so reaching for native Node capabilities such as the fs or os modules fails outright, because the Edge Runtime never implemented those APIs.

Next.js suits a startup team getting moving quickly, especially alongside its own Vercel ecosystem (one-click deployment, and the best support for new features such as RSC). Deployed somewhere other than Vercel, such as Alibaba Cloud, there is markedly more to think about and the constraints bite harder; choosing it purely to get SSR is not necessarily worth it and needs weighing up.

Vercel is a poor fit for business inside China — it has only 8 edge nodes globally, and neither access speed nor compliance works out well there.

### 3. Remix (another full-stack React framework)

Its defining feature is loading you do not notice (navigating between pages needs no refresh and no visible loading wait), which suits e-commerce and blogs — static-ish sites that need fast page transitions and SEO.

### 4. Route preloading

The goal: when the user clicks a link or switches module, they barely perceive any loading (no skeleton screen, no spinner).

How it differs from lazy loading: lazy loading starts fetching only once the user actually clicks and the route matches; preloading predicts where the user is likely to go and starts fetching quietly before the click, so the resources are ready when it comes.

- Preload trigger 1: `onMouseOver` (hovering over a module) starts fetching that module's resources.
- Preload trigger 2: `requestIdleCallback` (when the browser's main thread is idle) quietly preloads resources likely to be needed, without taking time away from urgent rendering.

The usual library is **loadable-components** (no longer actively maintained, but with no better replacement so far). Both triggers ultimately call the preload method it provides.

Alongside it, **webpack-stats-plugin**: this plugin reads the stats file Webpack generates (which records which chunks belong to which route), so on initial page load those chunks can be fetched ahead of time via `<script>` tags with defer. More precisely, that is preloading rather than lazy loading — but it presupposes that you have already split code per route with lazy.

---

## 8. Miscellaneous

- **Mock Service Worker (MSW)**: currently the go-to library for mocking API data at the major companies. Underneath it uses the browser's Service Worker to intercept real network requests and return your preset mock data, so debugging needs no real backend.
- **GraphQL**: typically used at the BFF layer, where its job is to cut down the number of endpoints — the frontend does not call several REST endpoints to assemble one page, and a single GraphQL query fetches exactly the fields it needs. ApolloGraphQL is the usual client library for using GraphQL with React or Vue.
- **Emotion CSS**: the css-in-js solution MUI (Material UI) wraps internally, letting component styles change dynamically through a styled function or a higher-order component.
- **PixiJS**: a WebGL-based 2D rendering library, good for polished covers, posters and marketing pages that need complex graphical effects (the kind of technology behind online design tools).
- **react-helmet-async**: manages the contents of the HTML `<head>` (title, meta, link) under SSR, which matters a great deal for SEO. Plain react-helmet is fine for CSR, but SSR requires the async version or you get a memory leak (documented in both community and official issues).
- **Class components**: the notes suggest React will gradually retire them, and new projects should use function components with hooks rather than choosing the class style.
- Why function components in TS no longer need the `React.FC` type: React's type definitions already treat a function component as an FC, so declaring it explicitly is redundant — an ordinary function with typed parameters is enough.
- **Recommended sources**: dev.to, bestofjs and Twitter (for the latest in the frontend ecosystem); ts-challenges (the TS type gymnastics repository on GitHub); bigfrontend.dev (a site for practising frontend implementation questions); web.dev (Google's own performance articles, and the metrics guidance such as LCP mentioned earlier is worth reading end to end).
- **Recommended books**: 《非暴力沟通》, 《疯狂的程序员》, 《编程之美》, 《编程珠玑》, 《自制编译器》 — 《编程之美》 covers scenario-style interview questions and is worth a look while preparing.
- **The three core stages of a modern JS engine's compilation**: Ignition (the bytecode interpreter), Sparkplug (a fast baseline compiler) and TurboFan (the optimizing compiler). When the cloud vendors compete on serverless cold-start speed, what they are really competing on is the efficiency of these stages.
- **On unit testing**: if a project prints console.error deliberately (testing an error branch) but the tests run under Node, the test framework may treat a console.error as an outright failure — configure Jest to mock or intercept all console.error calls to avoid the false negative. For a utility library other people depend on, aim for test coverage near 100%, because a bug there costs the trust of every downstream user, which is one of the main reasons to write unit tests at all.
- **Atomics**: the thread-locking APIs in JS, used with SharedArrayBuffer to synchronize between threads (the notes mark it "worth reading up on" — think of it as JS's low-level synchronization mechanism for multithreaded work).
- **webAI / TensorFlow.js**: loading and running someone else's already-trained machine learning model directly in the browser with JS.
- **RxJS**: a library for complex async programming and event streams (built on reactive programming, treating events and requests as composable, transformable streams of data).
- **YJS**: a library for collaborative editing and real-time data sync, solving how several users editing one document at once avoid conflicts and how their changes merge.
- **conclave**: a collaboration library built on WebRTC (peer-to-peer, so it does not necessarily relay through a central server).
