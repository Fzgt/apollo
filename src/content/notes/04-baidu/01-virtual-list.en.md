---
title: "① The virtualized feed"
section: Baidu
---

# ① The virtualized feed

> **Resume line**
>
> Built a **virtualized React feed** serving **5M+ daily page views** on a custom **useVirtualList** hook over **IntersectionObserver**: **live DOM nodes stay near 100 at any scroll depth**, scroll **from 30 to a stable 60 FPS**.

## What this line has to show

Virtualized lists are a solved problem with libraries available, so "I built a virtualized list" is worth nothing on its own. What this line is worth is that you can account for all three numbers, and that their natures are completely different. Five million page views is the environment I worked in, not my result, and the number comes off an analytics report. A hundred nodes is my result, measured by me in DevTools. Thirty to sixty frames is also my result, also measured by me.

Blur those three together and you will be caught. Sort out the attribution first, then talk about the technique.

## First, why more nodes means dropped frames

The browser walks five steps to render a frame, and that pipeline is the foundation under every frontend performance problem. First it runs your JavaScript; that cost scales with code. Then it recalculates style — which CSS rules apply to each node — and that cost scales with node count. Then layout, also called reflow, computes each node's position and size; that also scales with node count, and it is the most expensive step. Then paint turns nodes into pixels, scaling with pixel area. Then compositing stitches the layers together for the GPU, scaling with layer count.

Layout is expensive because one node's position affects the position of every node after it, so the cost grows linearly with the total number of nodes.

That is why five hundred nodes drops frames. It is not that nodes consume memory. It is that every single frame recomputes layout for all five hundred.

## Why it lands exactly on 30

This number is not made up, and being able to explain it noticeably raises your credibility.

The display refreshes on a fixed cadence — 60 Hz means once every 16.67 milliseconds — and the browser has to hand over the frame before the next refresh. When a frame misses that deadline it is not delivered slightly late; it waits for the following refresh. So the real interval jumps from 16.67 ms to 33.3 ms, which is exactly 30 FPS.

Dropping frames is not a smooth slowdown. It is a staircase: sixty, or thirty, with jitter in between.

## The two layers of a virtualized list

The naive idea is to render only the ten visible rows, but then the scrollbar disappears — the page is only ten rows tall, so the browser believes that is all the content there is.

So it splits into two layers. The outer one is a container stretched to the full height, total rows times row height, and its only job is to keep the scrollbar honest; it is usually called a spacer. The inner layer is the dozen or so rows actually rendered, each absolutely positioned and moved into place with a vertical transform.

One sentence to remember it: the outer layer pretends to be ten thousand rows tall, the inner layer only draws the dozen you can see.

## Why transform and not top

This one is worth memorising. Changing `top`, `left`, `width` or `height` triggers layout, paint and composite — the whole pipeline, the most expensive path. Changing background colour or box shadow triggers paint and composite. Changing `transform` or `opacity` only triggers compositing: the GPU moves an already-painted layer and the CPU barely participates.

The reason is that changing `top` changes where the element sits in document flow, which affects other elements, so layout must run again. Changing `transform` moves a picture that has already been painted; in document flow the element never moved, so nothing else is affected and the browser can hand the translation straight to the GPU.

## Where "about 100" comes from

The number of rendered rows follows a formula: viewport height divided by row height rounded up, plus twice the overscan, plus one. With typical mobile values — a 600 viewport, 80-tall rows, an overscan of 3 — that is 8 plus 6 plus 1, roughly fifteen rows.

Note that this is rows, not nodes. One feed card is an outer container, an image wrapper, the image itself, a duration badge, a right column, a title, a footer, an author and a play count — eight or nine elements at minimum. Fifteen rows times eight or nine elements is about a hundred and ten, and that is the hundred on the resume.

Overscan is a trade-off, not something to minimise. At zero or one you get fewer nodes, but during fast scrolling the new rows have not mounted yet and the user sees blank space — the blank flash. At five to ten scrolling is smooth, but the node count and the memory come back. So "around a hundred" is itself the product of that trade-off. When someone asks why you did not set overscan to zero for fewer nodes, the answer is the blank flash.

## How the three numbers are measured

**DOM node count.** The fastest and crudest way is to query every element on the page and count, but that counts the whole page and only counts elements, not text nodes. More accurate is counting the direct children of the list container. The best way is DevTools' Performance Monitor, which has a live curve literally labelled DOM Nodes: scroll while watching that line, and before the optimisation it climbs monotonically, after it is flat. A flat line is more convincing than any number — if you want to demo this live to an interviewer, use that. You can also take a heap snapshot in the Memory panel and search for detached nodes, to confirm scrolled-past rows are genuinely collected.

There is a measurement discrepancy you must raise yourself: querying all elements counts only element nodes, while DevTools' DOM Nodes counts every node including text and comments. On the same page those two can differ by almost a factor of two. The hundred on the resume is the element count inside the list container.

**Frame rate.** For a quick qualitative check, the live FPS overlay in the Rendering panel takes thirty seconds. The strongest evidence is a Performance recording: the FPS band at the top marks dropped frames in red, the Frames track shows each frame's real duration, and the Main track shows what the main thread was doing during the bad frames. Layouts per second and style recalcs per second in the Performance Monitor prove directly that the layout stage was being hammered. You can also count frames yourself with `requestAnimationFrame`, which has the advantage of running on a real device in real conditions — but it lives on the main thread too, so when the main thread is saturated it is delayed as well, and the number reads optimistic under load. A more useful lens than FPS is watching long tasks with `PerformanceObserver`: any single task holding the main thread for more than fifty milliseconds is a long task, one of them costs three frames, and it points straight at the code that blocked.

The best evidence puts node count, layout time and frame rate in the same Performance recording. That is a causal chain, rather than three isolated numbers.

**A frame rate is meaningless without the device and the scenario.** Say which machine it was measured on — the same page holds sixty on a flagship and struggles to hold thirty on a budget phone. If you used DevTools CPU throttling to simulate a slow device, say so; that is standard lab practice and saying it earns credit. Say whether it was a slow steady scroll or a fast fling — fast scrolling is the stress test, a slow scroll may never drop a frame at all. And say how deep you were when you measured: that pre-optimisation thirty was certainly measured after the list had accumulated hundreds of rows, because at twenty or thirty rows rendering everything is fine.

## How to defend the word "stable"

"A stable 60 FPS" is a stronger claim than "60 FPS" — it promises there is no variance. And frame rate is a metric you cannot meaningfully average: a steady thirty feels dull but even, while bouncing between ten and sixty for the same average of thirty feels obviously broken.

The jank users perceive comes from frame-time variance, not from the mean. That is why modern performance work looks at frame-duration percentiles, long-task counts and dropped-frame counts, and looks at INP in the field.

So the answer for "stable" is: during the scroll, the Performance recording shows no red dropped-frame markers and no frame over 16.67 ms in the Frames track — it does not mean the average reached sixty. Defining stable as "no long frames" rather than "a high average" is both accurate and professional.

## Which changes actually raised the frame rate

First, DOM went from five hundred-plus to a constant hundred or so, taking layout time from roughly ten milliseconds down to under one. The evidence is layouts per second in the Performance Monitor.

Second, `transform` replaced `top`, so positioning only composites — the GPU does it and the main thread is untouched. Paint events drop visibly in the recording.

Third, the scroll listener was made passive, which tells the browser you will not call `preventDefault`, so it can start scrolling immediately instead of waiting for your JavaScript. In the recording the scroll handler stops blocking compositing.

Fourth, `IntersectionObserver` replaced scroll events plus reading element geometry. Reading a geometric property in JavaScript forces the browser to run layout synchronously so it can give you an accurate answer — that is forced synchronous layout, also called layout thrashing. `IntersectionObserver` lets the browser compute this asynchronously on its own schedule and notify you, which sidesteps the whole thing.

The fourth one deserves emphasis because the warning is not your inference — the browser reports it. DevTools puts a yellow triangle on the main thread track saying forced reflow is a likely performance bottleneck. "Before the change DevTools was constantly reporting forced reflow, and after moving to IntersectionObserver the warning disappeared" is concrete evidence you can produce.

## 5M PV is the environment, not the result

The same virtualized list on a personal blog and on a feed serving five million daily page views mean completely different things as engineering. That number is my working environment, not my achievement. The resume uses `serving`, which is correct: it describes carrying the load without claiming to have created it. Do not upgrade it to "brought" or "grew" when speaking either.

Sort out the quantities first. Page views count every load, so one person refreshing ten times is ten. Unique visitors count that person once. Daily active users also count once. Impressions are a different thing entirely — one page load can produce dozens.

Here is where you can be caught: a feed scrolls dozens of items per load, so when page views are five million, impressions might be fifty million or more. If the number in your memory is actually impressions, then "page views" is the wrong term and the figure is inflated tenfold.

The number is also not measured, it is instrumented. No browser API can tell you how many times a page was opened today. The only way is to send a record on each load, aggregate the logs in a warehouse, and have BI report daily page views. The frontend only owns the first hop; the five million was read off a report, not computed by me — and that must be said, because it decides how the attribution is written. Internal products use internal instrumentation and internal dashboards, not the public analytics product. If you cannot remember what the internal platform was called, say "internal instrumentation and a BI dashboard" — inventing a system name and getting it wrong is far worse than not knowing.

One extra fact worth having: page views are structurally undercounted. Ad blockers block the analytics domain, users who bounce immediately leave before the SDK loads, and network calls fail. So real traffic is generally at or above the reported number, which makes the plus sign in "5M+" reasonable.

The correct attribution is "the feed I owned served five million-plus daily page views", not "I brought five million page views". The better answer translates scale into engineering constraints: at that volume a dropped frame affects millions of users, so changes ship behind a staged rollout and with performance monitoring — which is also why we did not simply pull in a third-party virtualization library and instead wrote a hook we controlled. That turns the number from a boast into the basis of a technical decision.

## Why write it rather than use a library

Honestly: at the time it was more a team constraint than a technical judgement. Bringing in a third-party library meant going through an approval process, and the requirement was well bounded with a fixed card structure. The cost of writing it is that dynamic heights, keyboard navigation and accessibility are all edges you have to cover yourself, and a mature library has already covered them. Today I would reach for TanStack Virtual first, unless its API blocked a customisation I actually needed.

Volunteering "today I would use the library" is far more credible than insisting hand-rolling was better.

One honest addition: the cards in this feed do not have uniform heights — some carry a cover image, some do not — so the visible count itself floats with scroll position. That is the second source of the "near" in "near 100". The standard handling for dynamic heights is an estimated height corrected by `ResizeObserver` measurements, or an offset table with a binary search.

## The 30-second answer

> This is a feed page at roughly five million daily page views. The problem is that infinite scroll grows the DOM without bound — ten screens in you have two hundred rows, and further in you are past five hundred and scrolling drops to thirty frames. The key insight is that the user can only see about a dozen rows at once, and the rest only need to appear to exist. So I wrote a `useVirtualList` that renders the visible window plus a few rows of buffer above and below, keeps the scrollbar honest with an outer container stretched to the full height, and positions each row with a vertical transform. The real win is not that there are fewer nodes, it is that the complexity changed class: before, DOM count grew with the number of loaded rows; after, it only grows with viewport height and is independent of the data. Ten thousand rows in, it is still the same twenty-odd nodes. Scrolling went back to a stable sixty.

## Self-check

1. Can you state the nature and the source of each of the three numbers?
2. Can you walk the five-step rendering pipeline and explain why layout scales with node count?
3. Can you explain why dropped frames land on thirty as a step rather than degrading smoothly?
4. Can you state the formula for rendered rows and explain why overscan cannot be zero?
5. Can you define "stable" as no long frames rather than a high average?
6. Can you give the four attributions and explain forced synchronous layout?
7. Can you separate page views, unique visitors, daily active users and impressions, and explain that page views are instrumented rather than measured?
