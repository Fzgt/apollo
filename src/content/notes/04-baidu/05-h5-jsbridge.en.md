---
title: "⑤ H5 and the JSBridge"
section: Baidu
---

# ⑤ H5 and the JSBridge

> **Resume line**
>
> Delivered the Xiaodu App's **H5 smart-home module in Vue 2 on Webpack 3**, **embedded in the native shell**: **iOS/Android sharing through jsBridge**, device detail pages, and **event tracking on the Baidu Statistics API**.

## What this line has to show

This is the lightest of the five lines. Do not spend time on it. The goal is to tell it cleanly without stalling and survive one layer of follow-up.

Its one piece of real substance is the jsBridge: an H5 page runs in a WebView sandbox, cannot reach the WeChat SDK or the system share sheet, and can only hand "I want to share" over to native. How that hand-off works — and specifically how the callback crosses the language boundary — is where the questions land.

## Why a hybrid app

Three benefits. Changing H5 does not require shipping a release or waiting for app store review, so iteration is fast. One codebase serves iOS and Android. Campaign pages, features and A/B tests can be changed at any time.

State the costs too: performance is below native, you inherit WebView differences, and your capabilities are bounded by what the bridge exposes — anything native has not surfaced simply cannot be done from H5. That last one is the essential constraint.

## How JS calls native, and native calls JS

The underlying problem is that H5 runs inside a WebView sandbox and native is a separate world. To share, to read Bluetooth, to open the camera, H5 can only ask native to do it.

There are four approaches for JS calling native, roughly in historical order. The earliest sets the location to a custom-scheme URL with parameters encoded into it, and native intercepts the navigation — the downside is that it is asynchronous with no return value and handles one call at a time. The second does the same through a hidden iframe to avoid navigating the main page, with the same downside. The third overrides the native handler for JavaScript dialogs and intercepts there, common on Android and distinctly a hack.

The modern mainstream is the fourth: injecting a native object. On Android an interface injection attaches a native object to the global scope and JavaScript calls its methods directly. On iOS a WebKit message handler registers a named channel and JavaScript posts an object to it.

Native calling JS is similar on both platforms: evaluate a string of JavaScript that calls a function attached to the global scope. There is a detail here worth having ready — this requires H5 to have attached that function in advance, which is why the bridge layer initialises very early in the page.

## How the callback crosses the boundary — the crux

You cannot pass a function across the boundary. You can only pass an id that both sides can match on.

Concretely: each call takes an incrementing id, stores that call's `resolve` and `reject` in a table keyed by the id, and sends the id, the method name and the parameters to native. When native finishes it calls a globally attached function with the same id; that function looks up the entry, calls `resolve` or `reject`, and deletes the entry.

A few details are worth being able to state. The promise executor does not resolve immediately — it stores `resolve` and `reject` and calls them only when native comes back, which is the standard way to wrap an async callback in a promise. The id is the only link between request and response; native knows nothing but that number. And the entry must be deleted after use, because a table that only grows is a memory leak.

There is also a serialisation boundary: only what JSON can express crosses it — strings, numbers, booleans, arrays, plain objects. Functions, Dates, `undefined` and circular references do not. On Android the payload is often serialised to a string before it is passed at all.

The value of wrapping this layer is that the frontend never handles the iOS/Android difference: it calls one method and gets a promise.

## What if an older app build lacks a bridge method

This question tests whether you have thought about rollout and compatibility. Not having an answer makes it look like you only ever wrote the happy path.

Four approaches. Feature detection: ask native whether a method is supported before calling it. Version checks: native injects the app version into the user agent or a global, and the frontend picks a path from it. A timeout fallback: every bridge call must have a timeout. And graceful degradation: sharing falls back to copying a link, device detail falls back to a read-only view.

The timeout matters most. A cross-process call has no connection-closed signal the way TCP does — you cannot detect that the other side is not answering. Without a timeout the promise never settles, and the UI spins forever.

## Analytics, which comes up alongside

The analytics product is embedded as an async SDK snippet. Page views are reported automatically, and custom events are triggered by pushing an array onto a global queue.

One uncommon but discriminating follow-up: how do you keep reports from being lost? The answer is a one-pixel image request rather than an XHR, for two reasons. Image requests are inherently cross-origin and are not subject to the same-origin policy, so the server needs no CORS configuration. And they survive page unload far better — when the user closes the tab or navigates away, an XHR is usually killed.

The modern and better answer is the browser's beacon API, which exists specifically for reliable reporting during unload and does not block it. Raising that yourself earns credit.

The page-view definition also gets one layer of follow-up: in a single-page app a route change does not reload the page, so the analytics SDK does not report another page view by default and you have to call the page-view method manually. The same product instrumented differently can report page views several times apart — which is the same question as the five million page views in the virtualized feed line.

## The 30-second answer

> The smart-home module in the Xiaodu app is H5, running inside the native app's WebView. Hybrid was chosen because changing H5 does not require shipping a release, and one codebase covers iOS and Android. I built the device detail pages, the analytics, and native sharing through the jsBridge — inside the WebView sandbox H5 cannot reach the WeChat SDK, so "I want to share" has to be handed to native. The real difficulty in that bridge is the callback: you cannot pass a function across the boundary, so each call takes an incrementing id, the promise's resolve is stored in a table under that id, and when native finishes it calls back with the same id so the right promise can be settled.

## Self-check

1. Can you name three benefits and three costs of the hybrid approach?
2. Can you name the four ways JS calls native and say which is the modern mainstream?
3. Can you walk the full id-correlated callback path, including why the entry must be deleted?
4. Can you say what the serialisation boundary refuses to carry?
5. Can you explain why every bridge call needs a timeout?
6. Can you explain why analytics uses an image request rather than an XHR, and name the modern replacement?
