---
title: "① The virtualized feed"
section: Baidu
---

# ① The virtualized feed

> **Resume line**
>
> Built a **virtualized React feed** serving **5M+ daily page views** on a custom **useVirtualList** hook over **IntersectionObserver**: **live DOM nodes stay near 100 at any scroll depth**, scroll **from 30 to a stable 60 FPS**.

## Terms, in one line each

**Virtualized list (windowing)** — render only the items visible in the viewport; the rest are faked with placeholder height.

**PV (page view)** — how many times the page was opened; **ten visits by one person counts ten**. Contrast **UV** (unique visitors), **DAU** (daily active users) and **impressions**. **These four differ by an order of magnitude, and mixing them will be caught.**

**Layout (reflow)** — the browser recomputing every node's position and size. **Cost grows linearly with node count, and it is the most expensive step.**

**Paint** — **does not draw pixels**. It produces a **display list of draw commands** ("rounded rect here, line of text there").

**Raster** — actually executing those commands into **bitmap tiles**, on raster threads or the GPU. **Text rasterisation, shadows and rounded corners are slow here.**

**Layerize** — deciding how many compositing layers to cut. **Layers are not produced by paint; this is its own step, and it comes after paint** — Chrome's official RenderingNG architecture doc lists the stages as `Layout → Pre-paint → Paint → Commit → Layerize → Raster`, and layerization consumes the display list paint produced.

**Composite** — the compositor thread turns rastered tiles into draw quads and assembles a frame for the GPU. **The cheapest step.**

**Forced synchronous layout (layout thrashing)** — reading a geometric property in JS (`offsetTop`, `getBoundingClientRect`) forces the browser to **run layout synchronously right now** to give you an accurate answer.

**IntersectionObserver** — a browser API that reports **asynchronously** when elements enter or leave the viewport, **without reading geometry**.

**Overscan** — a few extra items rendered above and below the viewport so fast scrolling does not outrun mounting.

**Long task** — one task holding the main thread for **over 50 ms**. **One long task means at least three dropped frames.**

**Passive listener** — telling the browser "I will not call `preventDefault`", so **scrolling can start without waiting for the JS to finish**.

## What this line has to show

Virtualized lists are a solved problem with libraries; **"I built a virtualized list" is worth nothing.** What this line is worth is that **you can account for all three numbers, and they are of completely different kinds**:

- **5M PV is my working environment, not my result** — the number comes from an analytics report.
- **~100 nodes is my result**, measured by me in DevTools.
- **30 → 60 FPS is my result**, also measured by me.

**Mixing the three will get you caught. Separate the attribution first, then talk about the technique.**

## Why more nodes means dropped frames

A browser frame goes through the following pipeline, and **that pipeline is the foundation of every frontend performance problem**:

1. **JS** — cost grows with code.
2. **Style** — which CSS rules apply to each node; **cost grows with node count.**
3. **Layout (reflow)** — positions and sizes; **cost grows with node count, and this is the expensive one.**
4. **Paint** — records draw commands; cost grows with the number and complexity of display items.
5. **Layerize** — decides how many compositing layers to cut.
6. **Raster** — executes the commands into bitmap tiles; cost grows with pixel area.
7. **Composite** — the compositor thread assembles the frame for the GPU; cost grows with layer count.

**Saying "five steps" passes unchallenged, but if you are asked what happens between Paint and Composite and cannot name Raster, it shows.**

⚠️ **Be ready to be challenged with the old diagram.** The Chrome frame-pipeline diagram everyone reproduces draws the main thread as `Recalc Styles → Layout → Update Layer Tree → Paint → Composite`, with **layerization before Paint**. The diagram is not wrong; it predates the CompositeAfterPaint rewrite, when layers were decided first and draw commands were recorded into each one separately. After the rewrite the `Update Layer Tree` stage is gone: the document is painted into one display list first, and PaintArtifactCompositor decides the layers from it. Name CompositeAfterPaint when challenged — **that sentence is worth more than getting the order right.**

**Layout is expensive because one node's position affects the position of everything after it**, so the cost is linear in total nodes.

**That is why 500 nodes drops frames: not memory, but recomputing layout for all 500 every single frame.**

⚠️ **State the causality as accumulation, not as a first-render problem.** The first screen mounts nine cards and a hundred-odd nodes — identical to the optimised version, and perfectly smooth. It is infinite scroll appending without ever unmounting: DOM count grows without bound as pages load, per-frame Style/Layout cost grows linearly with it, and frames only start missing 16.7ms once it has grown enough — **the user's experience is "smooth on open, stuttery after two or three minutes", not broken on arrival.** Framing it as a first-render problem gives you away.

## Why exactly 30

**This number is not a shrug, and being able to derive it raises your credibility noticeably.**

A display refreshes on a fixed cadence: 60 Hz is every **16.67 ms**. The browser has to hand in the frame before the next refresh. **Miss it and the frame is not a little late — it waits for the next refresh signal entirely.** The real interval jumps from 16.67 ms to **33.3 ms, which is exactly 30 FPS.**

**So dropping frames is not a smooth slowdown, it is a step function: 60, or 30, with instability in between.**

## The two-layer structure

The naive move is to render only the ten visible items — but then **the scrollbar disappears**, because the page really is only ten items tall.

So it is two layers:

```jsx
// Outer spacer: its only job is to keep the scrollbar honest
<div style={{ height: total * ITEM_HEIGHT, position: 'relative' }}>
  {visible.map(item => (
    <div
      key={item.id}
      style={{
        position: 'absolute',
        top: 0,
        // ↓ positioned with transform, not top — composite only, no layout
        transform: `translateY(${item.index * ITEM_HEIGHT}px)`,
      }}
    >
      <FeedCard {...item} />
    </div>
  ))}
</div>
```

**One line to remember: the outer layer pretends to be ten thousand items tall, the inner layer draws only the dozen you can see.**

## Why transform and not top

**Memorise this one.**

- Changing `top` / `left` / `width` / `height` → **layout + paint + composite**, the whole pipeline, **the most expensive.**
- Changing background colour or shadow → **paint + composite**.
- Changing **`transform` or `opacity`** → **composite only**; the GPU moves the layer and **the CPU is barely involved.**

Because changing `top` changes the element's **position in document flow, which affects others, so layout must rerun**; changing `transform` **moves an already-rastered image**, and in document flow the element never moved, so nothing else is affected — the browser only updates that layer's transform matrix and reassembles the frame.

**The half-sentence that scores**: a transform change can run **entirely on the compositor thread, with no main-thread involvement** — when the main thread is blocked by a long task, a transform animation on a composited layer keeps running smoothly.

## Where "100" comes from

```
rendered cards = cards visible on screen + overscan × 2
```

This feed fits four to six cards on a screen; call it 5, with 2 buffered on each side — **5 + 4 ≈ 9 cards**.

**Use "how many fit on a screen" as the input, not a card height in pixels.** The interviewer will ask how many items fit on a screen, never how tall a card is; a specific px is just one more number you have to defend.

**Note those are cards, not nodes.** One feed card is an outer container, a cover container, the cover image, a badge, a title, an author row, an avatar, the author name, a play/like count and an overflow button — **about ten elements minimum.** 9 cards × ~10 elements ≈ **100**, which is the 100 on the resume.

**Fixed height is the premise.** Article cards and video cards share one height, which is what lets the offset be a straight multiplication. Asked "what if heights vary": place with an estimated height, measure the real height once the card mounts, cache it and backfill the offsets below — at the cost of a jittering scrollbar length.

**Overscan is a trade-off, not a "smaller is better".** At 0 or 1 you get fewer nodes but fast scrolling outruns mounting and **the user sees a blank flash.** At 5–10 scrolling is smooth but node count and memory climb back.

**So "near 100" is itself the product of that trade-off** — asked "why not set overscan to zero and have fewer nodes", **the answer is the blank flash.**

## How the three numbers were measured

**DOM nodes.** The crudest way is `document.querySelectorAll('*').length`, but that counts the whole page **and elements only, not text nodes.** Better is counting the list container's direct children. **Best is DevTools → Performance Monitor, which has a live line literally called DOM Nodes**: scroll while watching it — **before, it climbs monotonically; after, it is flat.** A flat line is more convincing than any number; **use it if you demo live.** You can also take a heap snapshot in the Memory panel and search **detached DOM nodes** to verify that scrolled-past items are actually collected.

**One measurement discrepancy you must state unprompted**: `querySelectorAll('*')` counts elements only, while **DevTools' DOM Nodes counts all nodes including text and comments.** **On the same page the two can differ by nearly 2×.** The 100 on the resume is an element count inside the list container.

**Frame rate.** Qualitatively, the Rendering panel's live FPS meter takes thirty seconds. **The convincing evidence is a Performance recording**: the frame band at the top marks dropped frames in red, the Frames track shows each frame's real duration, and the Main track shows what the main thread was doing during them. **Layouts-per-second and style-recalcs-per-second in Performance Monitor prove directly that the layout stage was saturated.**

You can also count frames yourself with `requestAnimationFrame`, which has the advantage of running **on a real device in real conditions** — but **it runs on the main thread too, so when the main thread is saturated it is delayed as well, and the number is optimistic under load.**

**More useful than FPS: watch long tasks with `PerformanceObserver`.** Over 50 ms is a long task, one means three dropped frames, **and it points straight at the code that stalled.**

**The ideal evidence puts node count, layout time and frame rate in one Performance recording** — a causal chain, not three isolated numbers.

**A frame-rate number is meaningless without the device and the scenario.**

- **Which machine** — the same page holds 60 on a flagship and struggles to hold 30 on a low-end device. **If you used DevTools CPU throttling to simulate a low-end device, say so**; it is the standard lab technique and saying it helps you.
- **Slow scroll or fling scroll** — **fast scrolling is the stress test**; a slow scroll may never drop a frame.
- **How far down** — **the 30 FPS figure was certainly measured after hundreds of items had accumulated.** Freshly opened with twenty or thirty items, even full rendering is fine.

## How "stable" is defended

**"A stable 60 FPS" is a stronger claim than "60 FPS": it promises no variance.**

And frame rate **cannot be meaningfully averaged**: a steady 30 is slightly dull but even; bouncing between 10 and 60 also averages 30, **and the user feels obvious stutter.**

**Perceived jank comes from the variance in frame time, not the mean frame rate.** Modern performance work looks at **frame-time percentiles, long-task counts and dropped frames**, and **INP** in the field.

**So the answer for "stable"**: during the scroll, the Performance recording shows **no red dropped-frame markers** and **no frame over 16.67 ms in the Frames track** — **not that the average reached 60.** Defining stable as "no long frames" rather than "high average" is both accurate and professional.

## Which changes actually bought the frame rate

**One**, DOM went from 500-odd to a constant ~100, and **layout time dropped from ~10 ms to sub-millisecond**; the evidence is layouts-per-second in Performance Monitor.

**Two**, `transform` replaced `top`, so the work is **composite only**, done on the GPU, with no main-thread pressure; paint events in the recording drop noticeably.

**Three**, the scroll listener became **`{ passive: true }`**, telling the browser it will not prevent default, so **scrolling can begin without waiting for the JS**; scroll handling no longer blocks compositing.

**Four**, `IntersectionObserver` replaced "scroll event + read element position". The latter **forces synchronous layout on every scroll**: reading a geometric property in JS makes the browser **run layout immediately** to answer accurately. `IntersectionObserver` computes **asynchronously** on the browser's own schedule and then notifies you, skipping that entirely.

**The fourth deserves emphasis, because that warning is not your inference — the browser reports it**: DevTools marks a yellow triangle on the main thread reading **"Forced reflow is a likely performance bottleneck".**

**"Before the change DevTools kept reporting forced reflow, and after moving to IntersectionObserver the warning disappeared" — that is concrete, produceable evidence.**

## 5M PV is the environment, not the result

The same virtualized list on a personal blog and on a feed serving 5M daily page views **mean completely different things as engineering.** **That number is my working environment, not my achievement.**

**The resume's `serving` is the right word** — it describes carrying the load and claims no credit for it. **Do not say "brought" or "grew" out loud either.**

**Here is where you get caught**: one load of a feed scrolls past dozens of items, so **at 5M PV impressions may be 50M or more.** If the number you remember is actually impressions, **then "page views" is the wrong unit and the figure is inflated tenfold.**

**And this number was not measured, it was instrumented.** No browser API tells you how many times a page was opened today. **The only way is to send a record on each open, aggregate the logs in the warehouse, and read daily PV off a BI report.** The frontend owns only the first leg; **5M was read off a report, not computed by me** — say that plainly, because it decides how the attribution is phrased.

Internal products use **internal instrumentation and internal BI dashboards**, not the public Baidu Analytics product; **if you cannot recall the platform's name, say "internal instrumentation and a BI dashboard" and do not invent one** — being wrong is worse than not knowing.

**A related fact: PV is systematically undercounted.** Ad blockers block the analytics domain, users who bounce instantly leave before the SDK loads, and requests fail. **So real traffic is generally ≥ the reported PV, and writing 5M+ with the plus sign is legitimate.**

**The correct attribution** is "the feed I owned **serves** 5M+ daily page views", not "I brought 5M page views". **Better still, translate the scale into an engineering constraint**: at that volume **one dropped frame affects millions of users**, so changes ship behind a gradual rollout with performance monitoring — **which is also why we did not simply pull in a third-party virtualization library and instead wrote a hook we controlled.** That turns the number from a boast into the basis of a technical decision.

## Why write it instead of using a library

**Honestly: that was more a team constraint than a technical judgement.** Third-party dependencies went through an evaluation process, and the requirement was well bounded with a fixed card structure. Writing it cost us **dynamic heights, keyboard navigation and accessibility**, which mature libraries have already handled. **Today I would reach for TanStack Virtual first, unless its API blocked a customisation I needed.**

**Saying "today I would take the library" reads far more credible than defending "mine was better".**

One honest addition: **the card heights were never uniform** — some have cover images, some do not — so the visible count itself floats with scroll position. **That is the second source of the "near" in "near 100".** The standard treatment for dynamic heights is **estimated heights corrected by `ResizeObserver`**, or an offset table with binary search.

## The 30-second answer

> It is a feed page in the range of five million daily page views. The problem is that infinite scroll grows the DOM without bound — ten screens is two hundred-odd items, and after a while five hundred or more, and scrolling drops to thirty frames. The key realisation is that the user can only see four to six cards at once, and the rest only have to pretend to exist. So I wrote a useVirtualList that renders the visible window plus a few items of overscan, with an outer spacer holding the scrollbar honest and each item positioned by a transform translate. The real win is not the node count, it is the change in growth: before, DOM count grew with how much had been loaded; after, it is a function of viewport height and independent of data volume, so ten thousand items still means the same nine cards, around a hundred nodes. Scrolling returned to a stable sixty.

## Self-check

1. Can you state each of the three numbers' nature and source?
2. Can you walk the render pipeline (at least Paint → Layerize → Raster → Composite) and explain why layout scales with node count?
3. Can you explain why dropped frames step down to 30 rather than degrading smoothly?
4. Can you give the rendered-row formula and explain why overscan cannot be zero?
5. Can you define "stable" as "no long frames" rather than a high average?
6. Can you give the four attributions, and explain forced synchronous layout and how DevTools reports it?
7. Can you distinguish PV, UV, DAU and impressions, and explain that PV comes from instrumentation?
