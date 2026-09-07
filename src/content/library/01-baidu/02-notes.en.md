---
title: White screen · withdrawal · jsBridge
section: Baidu
icon: landmark
---

# Baidu bullets 3-5 — white screen / withdrawal / jsBridge

> Why this exists: the Baidu period is the technically densest (the virtualized list, the Webpack migration and the P2 incident review are all real substance), but it was done and then forgotten. These notes split it by resume bullet and **explain the underlying mechanism of each one properly**, so an interview can go layer by layer.
>
> Every bullet has five parts: **the text** / **the core technical points** / **how it works** / **what you most likely did at the time** / **follow-ups to expect**. The numbering and order follow the current resume's Baidu section — virtualized list / Webpack / white screen / withdrawal / jsBridge; every quote at the top of a bullet is **that bullet's earlier wording**, and where it differs from the current resume, the notes on this site win.
>
> Also: the Baidu code is not on this machine, so these notes rest entirely on memory — which makes them carry more weight than the other two.
>
> **Handled 2026-08-19**: the withdrawal bullet used to carry `without a single dollar of financial loss`. Zero financial loss is a conclusion from finance reconciliation, not something the frontend can measure — it's off the resume, replaced by three provable actions: the request lock, the idempotency key, and treating an uncertain outcome as a failure. The quote below has been updated to match.

---

## Bullet 3: the P2 white-screen review — dependency pinning and pre-release verification


> Older resume text: First to diagnose a P2 white screen on Haokan Video's search page (100M+ DAU): mismatched Node versions regenerated package-lock.json, pulling a breaking minor bump — version locks and release checks followed.

### Core technical points

#### ① The layers of dependency version management
```
package.json         the semver range you declare ("^1.2.3")
    ↓
package-lock.json    the version actually pinned ("1.2.3") + the full dependency tree + integrity hashes
    ↓
node_modules         the physical files actually installed
```

#### ② Semver
- **`MAJOR.MINOR.PATCH`** = `1.2.3`
- **PATCH** (1.2.**3**): bug fixes, compatible
- **MINOR** (1.**2**.3): new features, compatible
- **MAJOR** (**1**.2.3): breaking changes, incompatible
- **Range operators**:
  - `1.2.3`: exact
  - `~1.2.3`: patch updates allowed (1.2.x)
  - `^1.2.3`: minor and patch updates allowed (1.x.x, MAJOR fixed)
  - `*`: any version (don't)

#### ③ What package-lock.json is for
- **Pinning versions**: even when package.json says `^1.2.3`, the lock records that `1.2.5` was actually installed (and the same for every transitive dependency)
- **Keeping the team identical**: everyone's `npm install` produces exactly the same node_modules
- **Integrity checking**: a sha512 hash of each package tarball, so a tampered registry is caught

#### ④ The root-cause chain (⭐ layer by layer)
Your description: "mismatched Node versions regenerated package-lock.json, which pulled in a breaking change through a minor version bump"

Unpacked:
1. **Developers and CI machines are on different Node versions** (dev: v14, CI: v16, a colleague: v18)
2. **npm ships with Node**, so the npm version varies too (npm 6 vs 7 vs 8/9, with different lockfile formats)
3. **One developer runs `npm install` locally to add a package**
4. **Their npm (newer than the one that wrote the lock) sees an old lock format, or resolves differently, and regenerates the lock**
5. **On regeneration, `^1.2.3` resolves to the newest 1.x.x** (say 1.5.0)
6. **Something in 1.5.0 changed behaviour in a minor release** (in theory minor is compatible; in practice "accidental breakage" is common)
7. **The change is committed to the main branch**
8. **CI builds → deploys → white screen in production**

#### ⑤ Prevention (the resume's "version locks and release checks")

**A. Pinning dependency versions**:
1. **Pin Node**:
   - Add `"engines": { "node": "16.x" }` to `package.json` (alongside npm/yarn)
   - An `.nvmrc` file with the version, so `nvm use` switches automatically
   - **Volta** is stronger: `"volta": { "node": "16.20.0", "npm": "8.19.4" }` in `package.json`, switching automatically and enforcing it
2. **Enforce the lockfile**:
   - CI runs `npm ci`, not `npm install` (install strictly from the lock, and fail outright when the lock and package.json disagree)
   - Yarn uses `--frozen-lockfile`
3. **pnpm** is stricter to a degree (strict hoisting)
4. **Have CI check the lockfile isn't being changed casually**: diff `package-lock.json` in the PR check

**B. Enforced pre-release verification**:
1. **A staging/canary environment**: deploy internally first and let QA verify
2. **Smoke tests**: an automated script over the core paths, and nothing ships until it passes
3. **Canary release**: 1% of traffic first, watch the error rate, widen gradually
4. **A rollback path**: one click back to the previous release
5. **Feature flags**: shipping the code isn't enabling the feature, so a flag can kill it in seconds

#### ⑥ How to track down a white screen
When a user reports "this page won't open":
1. **Can you reproduce it?** (which browser, which user, which region)
2. **Check monitoring**: Sentry for the error detail, the stack, the release version
3. **Check CDN logs**: is an asset 404ing?
4. **Check the console**: what's the error? SyntaxError / TypeError / ChunkLoadError?
5. **Pin it to a file and line** (source maps)
6. **Pin it to a dependency or code change** (git blame plus the release diff)
7. **Confirm the root cause**: reproduce locally, bisect
8. **Fix**: roll back or fix forward
9. **Review**: root cause, impact, timeline, action items

#### ⑦ ChunkLoadError — the other common cause of a white screen
Not quite your case, but worth knowing: on release, users still on the old HTML reference old chunk filenames (with old hashes), and the new release has deleted those chunks from the CDN → the chunk fails to load → white screen.

**The fix**:
- Keep old versions on the CDN for a while rather than deleting immediately
- Catch `ChunkLoadError` on the frontend and prompt the user to reload, which fetches the newest HTML

### How it works

#### `npm install` vs `npm ci`
| | `npm install` | `npm ci` |
|---|---|---|
| Updates the lock | Yes (drift within the semver range is allowed) | No |
| package.json and lock disagree | Rewrites the lock to agree | Fails and exits |
| node_modules already exists | Installs incrementally | Deletes it first, then installs |
| Speed | Slow (resolution and comparison) | Fast (strictly from the lock) |
| Where | Local development | CI/CD |

**When asked "which one in CI", the answer is always `npm ci`.**

#### Why a minor bump can still break you
Semver says minor is compatible; in practice:
- Fixing a bug can change the default behaviour
- Stricter TypeScript definitions break compilation
- Internal changes shift the performance profile
- A transitive dependency gets updated

**The lesson**: run the tests on any dependency upgrade, even a patch.

### What you most likely did at the time

1. **Detection**: white screen → most likely a spike in error reports → you were the first to dig
2. **Diagnosis**:
   - Open Sentry, read the error → some `TypeError: xxx is not a function`
   - Map it back to a source line through the source map
   - Think: "it runs locally and not in production — what's different?"
   - `git log` over recent changes → find that `package-lock.json` was modified in a PR that had nothing to do with it
   - Diff the lock → one dependency went from 1.2.3 to 1.5.0
   - Read that dependency's changelog → 1.4.0 has a breaking change (perhaps a signature change)
3. **Fix**:
   - Short term: pin that dependency back to the old version in the lock
   - Long term: push for process changes
4. **Review and improvements**:
   - `"engines"` plus Volta across the team to force the Node version
   - `npm ci` in CI
   - PR rule: a package-lock diff gets its own review
   - Nothing ships until it passes smoke tests in the pre-release environment

### Follow-ups to expect

- **Why not pin every dependency exactly?**
  → Fully pinning means security patches never arrive on their own. The compromise: `^` allows minor and patch, while the lockfile pins exactly what's installed today. Then run `npm outdated` on a schedule (monthly, say) and upgrade deliberately.
- **Are the lockfiles from `npm install` and `yarn install` compatible?**
  → **No.** A team is either all npm or all yarn; mixing produces lockfile conflicts.
- **What severity is a P2?**
  → Companies usually run P0 (everything down) / P1 (a core feature unusable) / P2 (part of the product affected — with a hundred million DAU this still counts as P2 because the reach is large) / P3 and below (minor).
- **Why were you the first to find it?**
  → Because you chased the root cause instead of "reinstalling until it worked", and you knew the whole build/deploy pipeline. Worth emphasising in an interview — **ownership plus systems thinking**.
- **How do you run the review?**
  → A **blameless postmortem**:
    1. The timeline (when it happened, when it was noticed, when it was fixed)
    2. The root cause (why it happened)
    3. The impact (how many users, how much revenue)
    4. Action items (specific actions, an owner, a deadline)
    5. **No blaming individuals** — ask instead why the system allowed it

---


## Bullet 4: the withdrawal feature above 2000 QPS — frontend defence under high concurrency


> Older resume text: Built the withdrawal client on a path peaking above 2,000 QPS: request locking drops in-flight duplicates, client-generated idempotency keys survive reloads, and uncertain outcomes surface as failures, never successes.

### Core technical points

#### ① Debounce vs throttle — constantly confused
- **Debounce**: many triggers, but it **only runs n milliseconds after the last one**. However fast the user hammers the button, the call happens 300ms after they stop.
  - Good for: search input, resize, blocking double-clicks (the first version of it)
- **Throttle**: many triggers, but it **runs at most once every n milliseconds**. Continuous triggering produces an even rate.
  - Good for: scroll, mousemove
- **Which one for a withdrawal button?**
  - Debounce has a problem: "only the last one counts" means that if the user clicks 100 times, the request goes out 300ms after click 100. The user may feel nothing is happening and click more.
  - **The better shape**: **run immediately on the first click, then lock** (② below). That's leading-edge debounce combined with a request lock.

#### ② Request locking / in-flight tracking
The problem: the user clicks withdraw → a request goes out → **before it returns** the user clicks again → a second request goes out → the backend may debit twice.

The fix: block any identical request for **the whole window between the request leaving and the response arriving**.

```js
let inFlight = false;

async function withdraw() {
  if (inFlight) return; // locked, ignore it
  inFlight = true;
  try {
    const res = await api.withdraw();
    handleSuccess(res);
  } catch (err) {
    handleError(err);
  } finally {
    inFlight = false; // unlock
  }
}
```
A more complete version: **deduplicate by a key derived from the arguments** (lock one withdrawal, let different ones run concurrently):
```js
const inFlightMap = new Map();

async function withdraw(orderId) {
  if (inFlightMap.has(orderId)) return inFlightMap.get(orderId);
  const promise = api.withdraw(orderId);
  inFlightMap.set(orderId, promise);
  try {
    return await promise;
  } finally {
    inFlightMap.delete(orderId);
  }
}
```
This pattern is called **promise deduplication**, and it's exactly what React Query and SWR do internally.

#### ③ Idempotency — this is what actually gives you zero financial loss
A frontend lock only stops rapid clicking in one tab. It cannot stop:
- The frontend retrying after a network timeout
- The user acting from two devices or tabs at once
- The user reloading the page and clicking again

**Real zero-loss has to come from backend idempotency**:
- Every withdrawal request carries an **idempotency key** (a UUID generated by the frontend, or the orderId)
- The backend stores the keys it has already processed; a repeat of the same key returns the previous result instead of executing again

What the frontend can do:
- Generate the idempotency key up front and store it in sessionStorage (so it survives a reload)
- Send that key on every call
- **Only together with the backend is this a complete solution**

#### ④ Error fallbacks
The rule for error handling where money is involved: **fail by default, and only show success when success is certain**.
- **Certain failure** (HTTP 4xx/5xx, a business error code): show the error and a retry button
- **Uncertain** (timeout, network drop, request sent with no response): **treat it as a failure**, but tell the user "network problem, please check your withdrawal history shortly" rather than flatly saying "failed" (the backend may well have processed it)
- **Certain success** (2xx plus a success code): show success

**Why does "uncertain" have to be treated as failure?**
- Showing "failed" makes the user retry, and the retry is covered by the idempotency key, so nothing is debited twice
- Showing "success" when the money never arrived means the user believes they withdrew and sees no money — that blows up

#### ⑤ What 2000+ QPS means from the frontend's side
- **QPS = queries per second**
- 2000 QPS is usually a **backend** number, not a frontend one. The frontend doesn't "withstand" QPS, it "contributes" QPS (each user click contributes 1)
- What the frontend can do:
  - Cut unnecessary requests (debounce plus the lock)
  - Queue or rate-limit (don't let a hundred thousand people all click at the instant a campaign opens)
  - Serve static assets from a CDN so there are fewer dynamic requests

### How it works

#### The advanced version of frontend rate limiting — token bucket / leaky bucket
In a genuinely high-concurrency situation the frontend does its own rate limiting:
- **Token bucket**: a token is generated every 100ms, a click consumes one, and the button is disabled when there are none
- **Leaky bucket**: requests go into a queue and are sent at a fixed rate
- **Example** (token bucket):
```js
let tokens = 5;
setInterval(() => tokens = Math.min(tokens + 1, 5), 200);

async function tryClick() {
  if (tokens === 0) return alert('操作太频繁');
  tokens--;
  await api.doSomething();
}
```

### What you most likely did at the time

1. `disabled` on the button's onClick (disable immediately, re-enable on response) — the visual lock
2. The logical lock: an `inFlightMap` or `Set` in memory, blocking the same orderId
3. Generate an idempotency key (uuid) on the frontend and keep it in sessionStorage
4. Inject the idempotency key into the header or body in one place in the API layer
5. Error fallbacks: one error handler, showing "check back shortly" for timeouts and network errors and the business error for 4xx
6. A global loading state so the user never thinks nothing happened

### Follow-ups to expect

- **How exactly do you implement debounce and throttle?**
  → Write them by hand (a very common question):
  ```js
  const debounce = (fn, ms) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  };
  
  const throttle = (fn, ms) => {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn(...args);
      }
    };
  };
  ```
  The advanced versions: debounce with `leading` / `trailing` options, throttle built on `requestAnimationFrame`.
- **How did you guarantee zero financial loss?**
  → Three layers in the frontend (visual disable + an in-memory lock + an idempotency key) plus backend idempotency = an end-to-end guarantee. **The frontend only reduces useless requests; real zero-loss is the backend and frontend together.**
- **What does 2000 QPS actually challenge on the frontend?**
  → Not the QPS itself, but the peak when a campaign opens, when a hundred thousand people can hit the first screen at once. The frontend answers with a CDN, SSR/SSG to cut dynamic requests, a queue in front of the button, and degrading to a static notice page on failure.
- **What if the user clicks withdraw in two tabs at once?**
  → An in-memory lock doesn't cross tabs, so it has to be backend idempotency or a distributed lock (Redis SETNX with an expiry).

---


## Bullet 5: the Xiaodu App H5 smart-home module — jsBridge and hybrid apps


> Older resume text: Delivered the Xiaodu App's H5 smart-home module in Vue 2, adding native iOS/Android sharing via jsBridge, device detail pages and analytics tracking.

### Core technical points

#### ① Hybrid app architecture
- **What it is**: a native app embeds a WebView that loads H5 pages. Native owns the shell (launch, accounts, payments, the big features), H5 owns the business screens (fast iteration, consistent across platforms).
- **Why hybrid**:
  - Fast iteration (changing H5 doesn't need an app release)
  - Cross-platform (one set of H5 for iOS and Android)
  - Live operations (campaign pages, topic pages, A/B tests)
- **WebView**:
  - **iOS**: early on UIWebView (deprecated), now everything is **WKWebView** (WebKit, the Safari engine)
  - **Android**: early on the system WebView (WebKit before 4.4, Chromium from 4.4), later **X5 WebView** (Tencent's fork of Blink, which makes behaviour consistent across handsets)

#### ② jsBridge — how H5 and native talk
The problem: H5 runs inside the WebView sandbox, and native is **a different world**. To "share to WeChat", "read a Bluetooth device" or "open the camera", H5 can only ask native to do it.

**Four ways H5 can call native**:
1. **URL scheme** (the oldest): `location.href = 'xiaodu://share?title=xxx'` in H5; native watches URL changes, matches the scheme, intercepts, parses and executes. Downside: asynchronous with no return value, one call at a time.
2. **iframe.src** (a variant of the URL scheme): `iframe.src = 'xiaodu://...'`, using an iframe so the main page doesn't navigate.
3. **Intercepting `window.prompt`** (common on Android): H5 calls `window.prompt('xiaodu://...')` and native overrides the WebView's `onJsPrompt` to intercept it.
4. **Injecting a native object** (the modern mainstream):
   - **Android**: `webView.addJavascriptInterface(new NativeBridge(), 'AndroidBridge')`, then H5 calls `window.AndroidBridge.share(...)` directly
   - **iOS (WKWebView)**: `WKUserContentController.add(handler, name: 'iosBridge')`, then H5 calls `window.webkit.messageHandlers.iosBridge.postMessage({...})`, with the callback injected back through `evaluateJavaScript`

**Native calling H5** (the reverse):
- `webView.evaluateJavascript('window.somefn(data)', null)` (Android)
- `webView.evaluateJavaScript("window.somefn(...)")` (iOS)
- H5 has to have attached `window.somefn` beforehand

#### ③ A unified jsBridge wrapper
The standard industry approach: wrap a layer so the frontend never deals with the iOS/Android difference and just calls `bridge.call('share', {...})`.

Pseudocode:
```js
class JSBridge {
  callbacks = new Map();
  callId = 0;
  
  call(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.callId;
      this.callbacks.set(id, { resolve, reject });
      
      const payload = { id, method, params };
      
      if (isIOS) {
        window.webkit.messageHandlers.iosBridge.postMessage(payload);
      } else if (isAndroid) {
        window.AndroidBridge.call(JSON.stringify(payload));
      }
    });
  }
  
  // native calls this to fire the callback
  _onNativeCallback(id, data, error) {
    const cb = this.callbacks.get(id);
    if (!cb) return;
    error ? cb.reject(error) : cb.resolve(data);
    this.callbacks.delete(id);
  }
}
```
The key point: **the callId ties a response back to its request**, because the channel is asynchronous.

#### ④ How sharing is implemented natively
- **WeChat sharing**: native integrates the WeChat SDK; the bridge receives a "share" command → calls `WXApi.sendReq(...)`
- **Weibo/QQ**: the same, with their own SDKs
- **System share sheet**: `UIActivityViewController` on iOS, `Intent.ACTION_SEND` on Android

The frontend only calls `bridge.call('share', { title, desc, imageUrl, link })` and knows nothing about the destination channel.

#### ⑤ The Baidu Analytics API
- **What it is**: Baidu's own web analytics, roughly the domestic equivalent of Google Analytics
- **How it's added**:
  1. Embed the SDK script in the HTML (loaded asynchronously)
  2. Page views are reported automatically
  3. Custom events: `_hmt.push(['_trackEvent', 'category', 'action', 'label', value])`
- **An obscure interview question**: "how does Baidu Analytics avoid losing requests?" → it uses a 1x1 image, `<img src="https://hm.baidu.com/hm.gif?..." />`, rather than XHR, because an image request isn't subject to CORS and still goes out during unload (some browsers optimise this away; `navigator.sendBeacon` is better)

### How it works

#### The key differences between WKWebView and UIWebView
- **Process model**: WKWebView runs in its own process (isolated, so a crash doesn't take the app down); UIWebView runs in the app's main process
- **JS engine**: WKWebView uses Nitro (the same one as Safari, fast); UIWebView uses a restricted JavaScriptCore (slow)
- **Everyone large moved to WKWebView after iOS 8**

#### The traps in URL schemes
- **iOS**: `window.location.href = 'xiaodu://...'` navigates the page, and if the scheme isn't registered you get a white screen. Hence the iframe isolation
- **Rapid calls get dropped**: fire a URL scheme twice quickly and native may only receive it once. You need a queue plus a delay

### What you most likely did at the time

1. A Vue 2 project, vue-router for routing, vuex for state
2. A `utils/bridge.js` wrapper hiding the iOS/Android difference
3. UA sniffing: checking iOS/Android in `navigator.userAgent`
4. `import bridge from '@/utils/bridge'` in the page, then `bridge.call('share', {...})`
5. The device detail page: `bridge.call('getDeviceList')` for the device list → render
6. Baidu Analytics: load the SDK in main.js, report a pageview from a mixin's `mounted`, and push events with `_hmt.push` at the business points

### Follow-ups to expect

- **How do the iOS and Android bridge implementations differ?**
  → See ② above: iOS uses `messageHandlers`, Android uses `addJavascriptInterface`. Both are two-way and asynchronous.
- **Why does a bridge call return a Promise?**
  → The native → H5 callback is asynchronous, and without a Promise you're in callback hell. callId plus a Promise makes it look like a synchronous call from the H5 side.
- **An H5 page performs badly inside a native app — how do you fix it?**
  → ① An offline bundle (native ships the H5 assets, no network). ② Preloading the WebView (warm it up at app launch). ③ SSR / SSG for the first screen. ④ Inlining critical resources (fewer requests). ⑤ Trimming dependencies.
- **What are the security risks of AndroidBridge?**
  → Before API 17, `addJavascriptInterface` had an RCE hole (reflection could call arbitrary Java methods). From 17 it requires the `@JavascriptInterface` annotation. Expose only the methods you need and validate input strictly.
- **How do you handle behaviour that differs between iOS and Android?**
  → The bridge layer exposes one API and dispatches internally by platform, so the business layer never sees the difference. Special cases (the page being squeezed when the iOS keyboard appears) get a platform-specific fix.

---


## Checklist before the interview (the Baidu part)

### Must be able to draw
- [ ] The browser rendering pipeline: JS → Style → Layout → Paint → Composite
- [ ] The structure of a virtualized list: outer spacer + absolute items + translateY
- [ ] The two-way jsBridge: H5 ↔ WebView ↔ native
- [ ] The Webpack build flow: Entry → Loader → AST → dependency graph → Plugin → Chunk → Output

### Must know by heart
- [ ] `transform`/`opacity` are composite only; `top`/`width` trigger layout + paint + composite
- [ ] 16.67ms per frame; over that, you drop one
- [ ] IntersectionObserver is asynchronous, non-blocking and doesn't force layout; a scroll listener plus getBoundingClientRect does force layout
- [ ] `passive: true` lets the browser scroll without waiting for your JS
- [ ] `npm ci` in CI, `npm install` locally
- [ ] `^` allows minor and patch, `~` only patch
- [ ] MINOR is compatible in theory and broken often in practice
- [ ] What splitting vendor / common / runtime each achieves in SplitChunks
- [ ] Why the persistent cache makes the first build slow and the second fast

### Must be able to say on demand (30 seconds each)
- [ ] Why is a virtualized list fast? (three reasons: fewer DOM nodes, transform is cheap, IntersectionObserver doesn't block)
- [ ] What changed between Webpack 3 and 5? (cache, asset modules, tree shaking, no Node polyfills, stable hashes)
- [ ] How did you diagnose that white screen? (Sentry → source map → git diff → lockfile → the dependency's changelog)

## Topics worth a separate pass

In priority order:

1. **Browser rendering and the 60 FPS budget** (the foundation of the virtualized-list answer)
2. **Composite-only CSS properties** (a list to memorise)
3. **IntersectionObserver and how it compares to scroll listeners** (asked constantly)
4. **The full Webpack build flow and how the key plugins work**
5. **SplitChunksPlugin configuration in detail** (named on the resume)
6. **Semver and the lockfile mechanism** (the basis of the incident review)
7. **Using the Chrome DevTools Performance panel** (every frontend engineer should)
8. **Common jsBridge implementations** (always asked for hybrid-app roles, and your Baidu App experience is a plus)

## Further reading (optional)

- **Virtualized lists**: read the source of `react-window` or `@tanstack/virtual` — a couple of hundred lines, and everything falls into place
- **Webpack**: the "Concepts" and "Optimization" chapters of the official docs; Tobias Koppers's (Webpack's author) blog
- **Rendering**: Google Web Fundamentals' "Rendering Performance" series
- **Chrome DevTools**: the official Performance panel tutorial
