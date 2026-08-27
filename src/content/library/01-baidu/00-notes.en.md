---
title: Baidu · the five bullets
section: Baidu
---

# Baidu — the five resume bullets (v40)

> Why this exists: the Baidu period is the technically densest (the virtualized list, the Webpack migration and the P2 incident review are all real substance), but it was done and then forgotten. This note splits it by bullet and **explains the underlying mechanism of each one properly**, so an interview can go layer by layer.
>
> Every bullet has five parts: **the text** / **the core technical points** / **how it works** / **what you most likely did at the time** / **follow-ups to expect**.
>
> **Reordered 2026-08-18: the numbering now matches the v40 resume** (the note used to put the virtualized list third and withdrawals second, the reverse of the resume; they've been swapped). Every quote at the top of a bullet is the **v40 text**.
>
> **Handled 2026-08-19**: the withdrawal bullet used to carry `without a single dollar of financial loss`. Zero financial loss is a conclusion from finance reconciliation, not something the frontend can measure — it's off the resume, replaced by three provable actions: the request lock, the idempotency key, and treating an uncertain outcome as a failure. The v40 quote below has been updated to match.
>
> Also: the Baidu code is not on this machine, so this section rests entirely on this note plus memory — which makes it carry more weight than the other two.

---

## Bullet 1: the Xiaodu App H5 smart-home module — jsBridge and hybrid apps

> v40 text: Delivered the Xiaodu App's H5 smart-home module in Vue 2, adding native iOS/Android sharing via jsBridge, device detail pages and analytics tracking.

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


## Bullet 2 ⭐ the virtualized list — DOM nodes constant at ~100, 30 FPS → 60 FPS

> v40 text: Built a virtualized React feed serving 5M+ daily page views on a custom useVirtualList hook over IntersectionObserver: live DOM nodes stay near 100 at any scroll depth, scroll from 30 to a stable 60 FPS.
>
> (v40 dropped the background details — React 16.8 / Webpack 4 / Haokan Video. You can still add them when talking, but the resume no longer promises them.)

**This is the technically densest line on your resume, and interviewers will dig at it until it breaks. This is the section I go deepest on.**

### Core technical points

#### ① Why 500 DOM nodes drop frames
The browser rendering pipeline (**memorise this**):

```
JS → Style (style calculation) → Layout → Paint → Composite
```

Every frame (16.67ms if you want to hold 60 FPS) has to get through the whole pipeline.

- **JS**: runs your code, React triggers reconciliation, state updates
- **Style**: computes the final CSS properties of every element (inheritance, cascade, selector matching)
- **Layout (reflow)**: computes the **geometry** of every element (position, size). ⭐ 500 DOM nodes means 500 geometry calculations, and a single layout can take 5–10ms
- **Paint**: draws the pixels of each layer. Text rasterisation, borders and shadows are all paint; shadows and rounded corners paint slowly
- **Composite**: merges the painted layers into the final image (on the GPU)

**Where 500 nodes hurt**:
- First render: Style + Layout + Paint all multiplied by 500, so the first screen can take hundreds of milliseconds
- Scrolling: each scroll may trigger layout (`sticky`, `getBoundingClientRect`), and with 500 nodes a single layout stutters
- Memory: each node costs kilobytes, so 500 of them can be several MB

#### ② The core idea of a virtualized list
**A user can only see 10–20 items in the viewport at once**, so keep only those in the DOM and let the rest merely "pretend" to exist.

```
data (1000 rows)
    ↓
visible region (0–800px) ← what the user sees
    ↓
the DOM holds the 10 visible items + 2 overscan above and below = about 14
```

**Two numbers that matter**:
- rows of data: 1000
- DOM nodes: ~14

While scrolling:
1. Compute the scroll position
2. Work out that rows 300–314 should be showing
3. Remove the DOM for the previously shown rows 280–294 and insert 300–314
4. Use `translateY` to put the new items at the right scroll offset

#### ③ The spacer trick that keeps the scrollbar honest
The problem: there are only 14 items in the DOM, so how does the browser know the scrollbar should be as long as 1000 rows?

The answer: **set the outer container's height to `1000 × itemHeight`** (the total height of every row) and position the inner items with `position: absolute` plus `translateY`.

```html
<div style="position: relative; height: 200000px"> <!-- 撑开滚动条 -->
  <div style="position: absolute; transform: translateY(60000px)">第 300 条</div>
  <div style="position: absolute; transform: translateY(60200px)">第 301 条</div>
  ...
</div>
```

#### ④ Why `transform: translateY` rather than `top`
**This gets asked every time. Memorise it.**

| Property | What it triggers |
|---|---|
| `top` / `left` / `width` / `height` / `margin` / `padding` | Layout (reflow, the most expensive) + Paint + Composite |
| `color` / `background` / `border-radius` | Paint (repaint) + Composite |
| `transform` / `opacity` | **Composite only** (GPU accelerated, skipping Layout and Paint) |

Scrolling means hundreds of position changes; with `top` each one is a layout plus a paint, and it locks up. With `transform` it's composite only, done on the GPU, with no pressure on the main thread.

**The mechanism**: `transform` creates a GPU compositor layer, the browser renders that element into its own GPU texture, and scrolling just moves the texture — no pixels are redrawn.

**The downside**: many layers also cost memory, so don't scatter `will-change: transform` everywhere.

#### ⑤ What IntersectionObserver is
The old way: listen for `scroll` and use `getBoundingClientRect()` inside the handler to decide whether an element is in the viewport. **Every scroll can trigger dozens of those checks, it loads the main thread, and `getBoundingClientRect` forces a layout.**

`IntersectionObserver`: a native browser API that calls you back asynchronously when **an element enters or leaves the viewport**, without blocking the main thread and without forcing layout.

```js
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      // the element entered the viewport
      loadMore(); // or trigger lazy loading
    }
  });
}, {
  root: null, // the viewport by default
  rootMargin: '100px', // fire 100px early
  threshold: 0 // fire as soon as any part is visible
});

observer.observe(document.querySelector('#loader'));
```

**How it's used in a virtualized list** (your case):
- One approach: observe every item and mount the ones entering the viewport
- Another: observe a single sentinel element at the bottom of the list and load the next page when it appears (**the classic infinite-scroll pattern**)
- Your resume says "a custom useVirtualList hook over IntersectionObserver" — most likely the second (a sentinel triggering loads) plus computing the visible range yourself for the windowing

#### ⑥ The 60 FPS budget (⭐ a core concept)
- 60 FPS = 1000ms / 60 = 16.67ms per frame
- What's actually left for JS is only ~10ms (the rest goes to Style/Layout/Paint/Composite and the browser itself)
- **Go over 16.67ms and you drop a frame**; consecutive drops are what a user calls "laggy"
- **The RAIL model**:
  - **R**esponse: respond to input within 100ms
  - **A**nimation: 16ms per frame
  - **I**dle: leave the main thread idle time for the browser
  - **L**oad: interactive within 1s

### How it works (in depth)

#### The skeleton of a full useVirtualList hook
```ts
function useVirtualList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 3
) {
  const [scrollTop, setScrollTop] = useState(0);

  // work out the index range of the visible items
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const endIndex = Math.min(items.length - 1, startIndex + visibleCount + overscan * 2);

  // build the visible items (with index and offset)
  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    visibleItems.push({
      index: i,
      item: items[i],
      offsetTop: i * itemHeight,
    });
  }

  // the total height keeps the scrollbar the right length
  const totalHeight = items.length * itemHeight;

  // scroll listener (throttled)
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return { containerRef, totalHeight, visibleItems };
}
```
Usage:
```tsx
const { containerRef, totalHeight, visibleItems } = useVirtualList(list, 80, 600);

return (
  <div ref={containerRef} style={{ height: 600, overflow: 'auto' }}>
    <div style={{ height: totalHeight, position: 'relative' }}>
      {visibleItems.map(({ index, item, offsetTop }) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${offsetTop}px)`,
            height: 80,
          }}
        >
          {renderItem(item)}
        </div>
      ))}
    </div>
  </div>
);
```

#### Handling variable item heights
The implementation above assumes every item is 80px, but in reality (feed cards, some with an image and some without) heights differ.

**Approach 1: estimate then measure**
- Start from an average height as the estimate
- After an item mounts, measure the real height with `ResizeObserver` or a ref's `.offsetHeight`
- Store it in a `sizeMap` and use the real heights for later offsets

**Approach 2: an offset table**
- Keep an array where `offsets[i]` is the accumulated height of the first i items
- Binary search: for a given scroll position, find the i where `offsets[i] <= scrollTop < offsets[i+1]`

TanStack Virtual does exactly this (`measureElement` is approaches 1 and 2 combined).

#### Why `passive: true` matters
The `passive: true` in `el.addEventListener('scroll', fn, { passive: true })`:
- Tells the browser "this handler will never call `event.preventDefault()`"
- So the browser can **start scrolling immediately** instead of waiting for your JS
- Without it, the browser has to run your handler first to see whether you'll preventDefault, which delays the scroll

**An obscure interview question**: "why is your useVirtualList scroll listener passive?" — answer with the paragraph above.

#### Attributing 30 FPS → 60 FPS to specific changes
An interviewer may ask "which step actually raised the frame rate?":
1. **Fewer DOM nodes**: from over five hundred down to a constant hundred or so (14–15 rows rendered × eight or nine elements per card), so layout time falls from ~10ms to ~0.5ms and the JS/Layout part of the frame is freed
2. **`translateY` instead of `top`**: each scroll is composite only, done on the GPU, with no main-thread cost
3. **`passive: true`**: the scroll event no longer blocks compositing
4. **IntersectionObserver instead of scroll checks**: no `getBoundingClientRect` per scroll, so no forced synchronous layout (FSL)

### What you most likely did at the time

1. Fetch data from the backend (paged, `page=1&size=20`)
2. Render page 1 for the first screen
3. `useVirtualList(list, itemHeight, ...)` gives you `visibleItems`
4. Put a sentinel `<div ref={loaderRef} />` at the bottom and observe it with IntersectionObserver
5. Sentinel enters the viewport → `fetchNextPage()` → append to the list → recompute visibleItems
6. Position each item with `translateY`
7. Add `passive: true` to the scroll listener

### Follow-ups to expect (⭐ frequent)

**The basic layer:**
- **Why transform rather than top?** (point ④ above)
- **How does IntersectionObserver differ from a scroll listener?** (point ⑤ above)
- **What does 60 FPS mean?** (16.67ms per frame; over that and you drop one)
- **What is passive: true for?** (above)

**The deeper layer:**
- **What if item heights aren't uniform?** (above — estimate and measure, or an offset table)
- **How do you handle keyboard navigation / focus in a virtualized list?**
  → The hard part: a recycled item's DOM disappears and focus is lost. Options: ① remember the focused index and restore it on remount. ② or use `contain: layout` to hide offscreen items without actually removing them.
- **How do you handle image lazy loading in a virtualized list?**
  → Native `loading="lazy"`, or an IntersectionObserver per image. In a virtualized list an item is only mounted when visible, so it's lazy by construction.
- **What about dynamic content whose height changes over time, like expanding comments?**
  → A ResizeObserver on each item; when the height changes, update the sizeMap and recompute the offsets.
- **Does a virtualized list conflict with SEO?**
  → It does. With virtualization, only the visible items are in the DOM and a crawler can't see the rest. For SEO you either skip virtualization or fall back to SSR (emit the full content in the HTML and virtualize after the client takes over).
- **Why not `content-visibility: auto`?**
  → It's a newer CSS feature where the browser itself skips layout/paint for invisible items. It's **the lighter alternative** to a virtualized list — fine for small and medium lists, but tens of thousands of rows still need virtualization.

**The hardest follow-ups:**
- **How did you measure the drop from five hundred-odd nodes to around a hundred?**
  → Chrome DevTools Performance → record a scroll → the Rendering panel → the DOM Nodes count. Or `document.querySelectorAll('*').length`.
- **How did you measure 30 → 60 FPS?**
  → Chrome DevTools Performance → record → look at the FPS chart. Or a `PerformanceObserver` watching long tasks (over 50ms).
- **What about the white flash during a fast scroll?**
  → Increase the overscan; or degrade to a static placeholder when the scroll is fast; or pre-render a skeleton.
- **Infinite scroll vs pagination — what's the trade-off?**
  → Infinite scroll: smooth, but hard to return to a specific position. Pagination: clear, and the URL can be shared or revisited. Hybrid: update a hash in the URL as you scroll so the back button works.

**Things you must be able to draw**:
- The structure of a virtualized list: the outer spacer (container height = totalHeight), the inner absolute items with translateY
- The browser rendering pipeline: JS → Style → Layout → Paint → Composite

---

## Bullet 3: the withdrawal feature above 2000 QPS — frontend defence under high concurrency

> v40 text: Built the withdrawal client on a path peaking above 2,000 QPS: request locking drops in-flight duplicates, client-generated idempotency keys survive reloads, and uncertain outcomes surface as failures, never successes.

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


## Bullet 4 ⭐ the Webpack 3 → 5 migration — bundle -15%, build -70%

> v40 text: Led a Webpack 3-to-5 migration across 10+ incompatible packages, extracting shared runtime through SplitChunksPlugin and turning on persistent caching — bundle size down ~15%, local build times down 70%.

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

---


## Bullet 5: the P2 white-screen review — dependency pinning and pre-release verification

> v40 text: First to diagnose a P2 white screen on Haokan Video's search page (100M+ DAU): mismatched Node versions regenerated package-lock.json, pulling a breaking minor bump — version locks and release checks followed.

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
