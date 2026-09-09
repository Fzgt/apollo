---
title: The virtualized list
section: Baidu
icon: landmark
---

# Baidu bullet 1 — the virtualized list

> Why this exists: the Baidu period is the technically densest (the virtualized list, the Webpack migration and the P2 incident review are all real substance), but it was done and then forgotten. These notes split it by resume bullet and **explain the underlying mechanism of each one properly**, so an interview can go layer by layer.
>
> Every bullet has five parts: **the text** / **the core technical points** / **how it works** / **what you most likely did at the time** / **follow-ups to expect**. The numbering and order follow the current resume's Baidu section — virtualized list / Webpack / white screen / withdrawal / jsBridge; every quote at the top of a bullet is **that bullet's earlier wording**, and where it differs from the current resume, the notes on this site win.
>
> Also: the Baidu code is not on this machine, so these notes rest entirely on memory — which makes them carry more weight than the other two.

---

## Bullet 1 ⭐ the virtualized list — DOM nodes constant at ~100, 30 FPS → 60 FPS


> Older resume text: Built a virtualized React feed serving 5M+ daily page views on a custom useVirtualList hook over IntersectionObserver: live DOM nodes stay near 100 at any scroll depth, scroll from 30 to a stable 60 FPS.

> 📄 **The full technical write-up lives on the blog: [Virtualized list — 500+ DOM nodes to a constant, 30 to 60 FPS](https://apollo-five-omega.vercel.app/blog?post=21)**
> 
> It additionally covers, and this note does not repeat: why `index` is a valid key here, the "write-then-read" forced-synchronous-layout trap around `getBoundingClientRect`, how to verify that off-screen nodes are really destroyed, and the real JS budget under the RAIL model.
> 
> This note is about **how to answer** — the build-vs-buy reasoning, the two hard parts, expected follow-ups, and the pre-interview checklist.
>
> (React 16.8 / Webpack 4 and Haokan Video are not on the resume. You can still add them when talking, but the paper does not promise them.)

**This is the technically densest line on your resume, and interviewers will dig at it until it breaks. This is the section I go deepest on.**

### Core technical points

#### ① Why 500 DOM nodes drop frames
The browser rendering pipeline (**memorise this**):

```
JS → Style → Layout → Paint (record draw commands)
   → Layerize → Raster → Composite → Display
```

Every frame (16.67ms if you want to hold 60 FPS) has to get through the whole pipeline.

- **JS**: runs your code, React triggers reconciliation, state updates
- **Style**: computes the final CSS properties of every element (inheritance, cascade, selector matching)
- **Layout (reflow)**: computes the **geometry** of every element (position, size). ⭐ 500 DOM nodes means 500 geometry calculations, and a single layout can take 5–10ms
- **Paint**: ⚠️ **does not draw pixels**. It produces a **display list of draw commands** ("rounded rect here, line of text there"). Cost grows with the number and complexity of display items
- **Layerize**: decides how many compositing layers to cut. ⚠️ **Layers are not produced by Paint — this is its own step, and it comes *after* Paint.** [Chrome's official RenderingNG architecture doc](https://developer.chrome.com/docs/chromium/renderingng-architecture) lists the stages as `… Layout → Pre-paint → Paint → Commit → Layerize → Raster …`; layerization consumes the display list that paint produced (handled by PaintArtifactCompositor)
- **Raster**: actually executes the draw commands into **bitmap tiles**, on raster threads or the GPU. **Text rasterisation, shadows and rounded corners are slow here, not in paint**
- **Composite**: the compositor thread turns the rastered tiles into **draw quads**, packs them into a compositor frame and hands it to the GPU process to put on screen

**The one sentence to memorise**: Paint records draw commands, Raster rasterises them into bitmap tiles, and Composite has the compositor thread assemble the tiles into a frame for the GPU. **"Paint draws the pixels" and "Paint produces the layers" are both wrong, and they are the two lines interviewers use to tell whether you memorised this or understand it.**

**⚠️ The famous old diagram contradicts this — get ahead of it.** The Chrome frame-pipeline diagram that every blog post uses draws the main thread as `Recalc Styles → Layout → Update Layer Tree → Paint → Composite` — **layerization before Paint**. The diagram is not wrong; it shows the architecture *before* the CompositeAfterPaint rewrite, when the browser decided the layers first and then recorded draw commands into each one separately. After the rewrite the `Update Layer Tree` stage does not exist at all: the whole document is painted into one display list first, and PaintArtifactCompositor decides the layers from it.

If an interviewer waves that diagram at you: "That diagram predates CompositeAfterPaint. The old architecture really did layerize first and paint second; now it is the other way round — paint produces the display list, layers are decided from it, and `Update Layer Tree` is gone." **Naming CompositeAfterPaint is worth more than the ordering itself** — anyone can get the order backwards, but few know why it changed.

**⚠️ This is not a first-render problem, it is an accumulation problem — getting the causality wrong gives you away.**

The first screen mounts about a dozen cards and a hundred-odd nodes — **no different from the optimised version, and perfectly smooth.** The dropped frames are scrolled into existence:

1. **The DOM only grows** — infinite scroll appends a page at a time and never unmounts the cards that scrolled away. Ten screens is two hundred-odd items; a few minutes of flicking is five hundred or more.
2. **Per-frame cost grows linearly with node count** — Style has to compute styles for every node and Layout has to compute geometry for every node. At 500 nodes a single layout is 5–10ms, and with JS and raster on top the 16.7ms frame budget is gone.
3. **So it feels gradual** — the user's experience is "smooth when I open it, stuttery after two or three minutes, unusable after that", **not broken on arrival**. Say this line; it shows you watched the problem happen rather than memorised it.
4. **Memory climbs with it** — kilobytes per node, and five hundred cards plus their images is tens of MB, which on low-end devices adds GC pauses on top.

**The causality in one line**: DOM count grows without bound as more pages load → per-frame Style/Layout cost grows linearly → a frame exceeds 16.7ms → the further you scroll, the worse it gets. **What a virtualized list changes is that growth relationship, not any single number.**

#### ② The core idea of a virtualized list
**A user can only see four to six cards on screen at once**, so keep only those in the DOM and let the rest merely "pretend" to exist.

```
data (1000+ items, unbounded)
    ↓
visible region ← the user sees 4–6 cards at a time
    ↓
the DOM holds the visible cards + a few overscan cards above and below ≈ 9
```

The number of rendered cards is computed:

```
rendered cards = cards visible on screen + overscan × 2
```

Five on screen and two buffered on each side is `5 + 4 = 9 cards`.

⚠️ **Use "how many fit on a screen" as the input, not a pixel value.** The interviewer will ask how many cards fit on a screen, never how tall a card is; quoting a specific px only makes you accountable for it.

⚠️ **"Cards" are not "nodes", and the 100 on your résumé counts nodes.** One feed card contains an outer wrapper, a thumbnail wrapper, the cover image, a badge, the title, an author row, the avatar, the author name, a play/like count and an overflow button — **about ten elements at a minimum**. So **9 cards × ~10 elements ≈ 100 nodes**, and that is what `live DOM nodes stay near 100` refers to.

**Three numbers, do not mix them up**:
- items of data: 1000+, **unbounded**
- **cards mounted at once: ~9**
- **DOM nodes: ~100 (= 9 cards × about ten elements each)**

**Fixed height is the premise here.** In this feed the article cards and the video cards share one height, so each card's offset is a straight multiplication. Asked "what if heights vary": place cards using an estimated height, measure the real height once a card mounts, cache it, and backfill the offsets of the cards below — at the cost of a scrollbar length that jitters.

**Overscan is a trade-off, not something to minimise**: drop it to 0 and you hold fewer nodes, but during a fast flick the next card is not mounted yet and the user sees blank space first (a blank flash); push it to 5–10 and scrolling is smooth, but the node count and memory climb back up. When asked "why not set overscan to 0 and hold even fewer nodes", the answer is the blank flash.

While scrolling:
1. Compute the scroll position
2. Work out that cards 300–308 should be showing
3. Unmount the cards that have scrolled out of the buffer and mount the ones coming in
4. Use `translateY` to put each card at the scroll offset it belongs to

#### ③ The spacer trick that keeps the scrollbar honest
The problem: there are only nine cards in the DOM, so how does the browser know the scrollbar should be as long as 1000 rows?

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
| `transform` / `opacity` | **No Layout**; "composite only" needs the element to own a compositor layer |

⚠️ **One fact about this implementation first, or everything below reads backwards.** In the hook, `offsetTop = i * itemHeight` is item i's absolute position in the **whole list**, independent of `scrollTop` — so **once a card mounts, its transform value never changes until it's recycled**, and what moves while you scroll is the native `scrollTop`. There is **no "transform changing every frame" here**.

**So where does `transform` beat `top`? At the moment a new card mounts.** The window slides down and 9 cards need positioning: with `top` that one pass goes through layout (reflow); with `transform` it never enters layout. **One reflow saved per window shift — not per frame.**

⭐ **Don't say "GPU accelerated".** The follow-up is "so did you promote it to its own layer?", and that's where people fall over. The accurate version is three sentences:

- **Layout is always skipped** — that is the entire advantage of `transform` over `top`, promoted or not.
- **If it is promoted** (`will-change: transform`, a 3D transform, an animation the compositor takes over), changing the matrix can run entirely on the compositor thread, so the animation survives a blocked main thread — **but only if that element really has its own layer**.
- **If it isn't promoted**, the content shares a layer with everything else, so moving it means re-rastering that layer's tiles, and the main thread is involved again.

**Promotion buys nothing here and actively costs**: the transform value never changes, so there is no matrix to re-apply; putting `will-change: transform` on dozens of cards only buys dozens of layers and a pile of GPU memory. Promotion pays off when one element's transform changes repeatedly — animation, dragging, hand-rolled momentum scrolling.

**The scroll itself is GPU-accelerated for free**: native container scrolling is the compositor thread translating already-rastered tiles, with nothing required from you and nothing to do with `transform`.

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
1. **Fewer DOM nodes**: from over five hundred down to a constant hundred or so (9 cards rendered × about ten elements per card), so layout time falls from ~10ms to ~0.5ms and the JS/Layout part of the frame is freed
2. **`translateY` instead of `top`**: every time the window shifts, positioning the newly mounted cards doesn't trigger layout — one reflow saved per window shift (not per frame; a card's transform value never changes once mounted)
3. **`passive: true`**: the scroll event no longer blocks compositing
4. **IntersectionObserver instead of scroll checks**: no `getBoundingClientRect` per scroll, so no forced synchronous layout (FSL)

### The build-vs-buy call: why not an off-the-shelf library (⭐ likely the opening question)

The wheel already exists — why did you build one? Miss this and the depth later still costs you.

**Two answers to rule out first:**

- **Never say "it didn't exist yet."** react-window `1.0.0` shipped on **2018-07-22**; the stable version in use through all of 2021 was `1.8.6` (2020-10-29), with 1.8.7 not landing until 2022-04. By the time you wrote that code it had been out for three years and sitting on an eighteen-month-old stable release.
- **Never say "there was no alternative."** There were at least four in 2021, and an interviewer can name two off the top of their head.

| Library | Version available in 2021 | Shape | What matters for this case |
|---|---|---|---|
| **react-window** | 1.8.6 (2020-10) | component | The industry default. **Requires its own fixed-height scroll container** |
| **react-virtualized** | 9.22.3 (2020-12) | component | Same author, full-featured; **has `WindowScroller`, so it can ride page scroll** |
| **react-virtual** | 2.x (updated through 2021) | **headless hook** | Returns indexes and offsets only; the DOM and the container stay yours — **the same shape as your `useVirtualList`** |
| **react-virtuoso** | 2.x | component | Built around automatic measurement of variable heights |

(`@tanstack/react-virtual` is only the renamed package, from **2022-02**, and v3 is later still. In 2021 there was only react-virtual v2 — don't conflate the two.)

**react-window's core constraint**: it wants a fixed-height scroll container — `<FixedSizeList height={600} itemCount={...} itemSize={80}>` — with the scrollbar on that div, not on the page.

**This case**: an H5 home feed inside the Xiaodu App, where the whole page scrolls. Pull-to-refresh, the sticky header and infinite loading all hang off page scroll. Moving the scroll into a fixed-height div means reworking all of them.

**Open with these two sentences and stop:**

> I looked at react-window and react-virtualized at the time. react-window takes over the scroll container, which fights page-level scrolling; react-virtualized's WindowScroller solves that, but the library carries far more than I needed — not worth pulling in for one home feed. The core logic was about a hundred lines, so writing it myself stayed more controllable.

**Three follow-ups, with answers ready:**

- **"What about fixed heights?"** → Fixed height isn't the problem; that's exactly what react-window is best at. The problem is that it takes over the scroll container.
- **"What about react-virtual? It's headless, it doesn't take the container."** → Concede it: "That was 2.x at the time — not yet under TanStack, API still moving. I wasn't going to put it in production."
  ⚠️ This is the sharpest counter — react-virtual `2.10.0`'s types carry both `windowRef` (window scrolling) and `measureRef` (automatic measurement), so it **answers both** of the reasons above. The only honest reply is that you wouldn't bet on a library whose API was still shifting. Don't try to argue past it.
- **"How would you choose today?"** → Today, `@tanstack/react-virtual` — headless, actively maintained, window scrolling and dynamic heights both covered. Back then the options either took the container, were too heavy, or weren't stable.

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
- **Why not react-window?** (the build-vs-buy section above — likely the opening question; get this one fluent first)
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

---

## Checklist before the interview (this bullet)

### Must be able to draw
- [ ] The structure of a virtualized list: the outer spacer (container height = totalHeight), the inner absolute items with translateY
- [ ] The browser rendering pipeline: JS → Style → Layout → Paint → Composite

### Must know by heart
- [ ] `transform`/`opacity` don't trigger layout; `top`/`width` do layout + paint. "Composite only" requires the element to own a compositor layer
- [ ] 16.67ms per frame; over that, you drop one
- [ ] IntersectionObserver is asynchronous, non-blocking and doesn't force layout; a scroll listener plus getBoundingClientRect does force layout
- [ ] `passive: true` lets the browser scroll without waiting for your JS

### Must be able to say on demand (30 seconds each)
- [ ] Why is a virtualized list fast? (three reasons: fewer DOM nodes, positioning doesn't reflow, IntersectionObserver doesn't block — all main-thread savings, don't say GPU)
- [ ] Why not react-window? (the "choosing" section above)


---

## Further reading (optional)
- Read the source of `react-window` or `@tanstack/virtual` — a couple of hundred lines, and everything falls into place
- Google Web Fundamentals' "Rendering Performance" series
- The official Chrome DevTools Performance panel tutorial
