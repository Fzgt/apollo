---
title: "⑤ H5 and the JSBridge"
section: Baidu
---

# ⑤ H5 and the JSBridge

> **Resume line**
>
> Delivered the Xiaodu App's **H5 smart-home module in Vue 2 on Webpack 3**, **embedded in the native shell**: **iOS/Android sharing through jsBridge**, device detail pages, and **event tracking on the Baidu Statistics API**.

## Terms, in one line each

**H5** — the common Chinese term for "a mobile web page running in a browser or WebView". **In an English interview do not say "H5"; say a mobile web page, or a web view module.**

**WebView** — the browser control embedded inside a native app. **The web module runs inside it.**

**Hybrid app** — a native shell wrapping embedded web pages.

**Sandbox** — JS inside a WebView **cannot reach native capability**: no WeChat SDK, no system share sheet, no Bluetooth, no camera.

**JSBridge** — the protocol and wrapper that lets JS in the WebView and native code call each other.

**Correlation id** — the number that matches a response back to its request. **The technical core of this line.**

## What this line has to show

**This is the lightest of the five; do not spend time on it.** The goal is to tell it cleanly and survive one follow-up.

**Its only technical substance is the bridge**: the page runs in a WebView sandbox and **can only hand "I want to share" to native.** **How it hands it over — and specifically how a callback crosses a language boundary — is what gets probed.**

## Why hybrid

**Three benefits**: changing the web module **ships without a release or an app store review**; **one codebase** for iOS and Android; campaign pages, features and A/B tests can change at any time.

**State the costs too**: worse performance than native; WebView differences to absorb; **and capability is bounded by what the bridge exposes — if native did not expose it, the web module cannot do it.** **That last one is the fundamental constraint.**

## How JS calls native, and native calls JS

**The root problem: the page runs in a WebView sandbox, and native is a different world.**

**JS-to-native has four generations:**

1. **Change the address bar** — encode parameters into a custom-scheme URL (`myapp://share?title=...`) and have native intercept the navigation. **No return value, and only one call at a time.**
2. **A hidden iframe** doing the same, avoiding a main-frame navigation. **Same drawbacks.**
3. **Native overriding the `prompt` / `alert` handler** to intercept — common on Android, **and very much a hack.**
4. **Injecting a native object — the modern default.**

```js
// Android: injected via @JavascriptInterface; JS calls its methods directly
window.NativeBridge.postMessage(JSON.stringify(payload));

// iOS: a WKWebView messageHandlers channel
window.webkit.messageHandlers.nativeBridge.postMessage(payload);
```

**Native-to-JS** is similar on both: **evaluate a JS string that calls a function hanging off the global object** (`evaluateJavascript` / `evaluateJavaScript`).

**One detail you must have ready: the page has to install that function on the global object first, which is why the bridge layer initialises very early.**

## How a callback crosses the boundary — this is the crux

**You cannot pass a function across the boundary, only a correlation id.**

```ts
const callbacks = new Map<number, { resolve: Fn; reject: Fn }>();
let seq = 0;

function callNative(method: string, params: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    callbacks.set(id, { resolve, reject });   // ① stored, not resolved yet
    postToNative({ id, method, params });     // ② only the id crosses over
    setTimeout(() => {                        // ③ a timeout is mandatory
      if (callbacks.delete(id)) reject(new Error('bridge timeout'));
    }, 5000);
  });
}

// Native calls back into this global with the same id
window.__onNativeCallback = ({ id, data, error }) => {
  const cb = callbacks.get(id);
  if (!cb) return;
  callbacks.delete(id);                       // ④ delete or you leak
  error ? cb.reject(error) : cb.resolve(data);
};
```

**Four details to have ready:**

**①** The `Promise` executor **does not resolve immediately**; it stores `resolve` / `reject` and waits for native. **That is the standard way to wrap an async callback into a promise.**

**②** **The id is the only link between request and response**; native knows nothing else.

**③** **Without a timeout the promise never settles**, and the UI spins forever. **A cross-process call has no TCP-style disconnect signal — you cannot tell that the other side went quiet.**

**④** **The entry must be deleted after use**, or the map only grows — **a memory leak.**

**There is also a serialisation boundary**: **only what JSON can express** — strings, numbers, booleans, arrays, plain objects. **Functions, `Date`, `undefined` and cyclic references do not cross.** Android often serialises to a string first as well.

**The value of wrapping this layer: the frontend stops caring about iOS/Android differences and calls one method that returns a promise.**

## What if an older app build lacks a bridge method

**This question is about staged rollout and compatibility; failing it makes you look like someone who only wrote the happy path.**

1. **Feature detection** — ask native whether the method exists before calling it.
2. **Version checks** — native injects the app version into the UA or a global, and the web module branches on it.
3. **Timeout fallback** — every bridge call must have one. **(③ in the code above.)**
4. **Graceful degradation** — sharing falls back to copying a link; the device detail page falls back to display only.

## Analytics, which comes up alongside

Baidu Statistics is embedded as an async SDK: **page views report automatically**, and custom events fire by pushing an array into a global queue.

**An obscure but discriminating follow-up: how do you keep the report from being lost?**

The answer is **a 1×1 pixel image request rather than XHR**, for two reasons:

1. **An image request is inherently cross-origin**, unconstrained by same-origin policy, so **the server needs no CORS configuration.**
2. **It survives page unload far better** — when the user closes the tab or navigates away, **an XHR is very likely to be killed.**

**The modern and better answer is `navigator.sendBeacon()`**, purpose-built for reliable reporting during unload, **and it does not block unload.** **Raising it unprompted scores.**

**PV definition gets one more layer too**: **in an SPA a route change does not reload the page, so the SDK will not report a second page view by default and you must call its page-view method manually.** **The same product can differ several-fold in PV depending on how it is instrumented** — the same issue as the 5M PV in the virtualized feed note.

## The 30-second answer

> The smart-home module in the Xiaodu app is a web module running inside the native app's WebView. Hybrid was chosen because changing the web side ships without a release, and one codebase covers iOS and Android. I built the device detail pages, the analytics, and native sharing through the jsBridge — the page sits in a WebView sandbox and cannot reach the WeChat SDK, so "I want to share" has to be handed to native. The real difficulty in that bridge layer is the callback: you cannot pass a function across the boundary, so each call takes an incrementing id, the promise's resolve is stored in a map, and native calls back into a global with that id so the right promise can be found. Two things go with it: a timeout is mandatory, because a cross-process call with no response is a promise that never settles; and the entry must be deleted after use, or that map only grows.

## Self-check

1. Can you name three benefits and three costs of hybrid?
2. Can you give the four generations of JS-to-native, and say which is the modern default?
3. Can you narrate the full correlation-id callback chain, including why the entry must be deleted?
4. Can you say what cannot cross the serialisation boundary?
5. Can you explain why every bridge call needs a timeout?
6. Can you explain why analytics uses an image request rather than XHR, and name `sendBeacon` as the modern alternative?
7. Can you explain why an SPA route change needs a manual page-view report?
