---
title: "⑤ H5 and the JSBridge"
section: Baidu
---

# ⑤ H5 and the JSBridge

> **Resume line**
>
> Delivered the Xiaodu App's **H5 smart-home module in Vue 2 on Webpack 3**, **embedded in the native shell**: **iOS/Android sharing through jsBridge**, device detail pages, and **event tracking on the Baidu Statistics API**.

## What this bullet is about

⚠️ **This is the lightest of the five; do not spend time on it.** The goal is **to tell it clearly without stumbling**, and to survive one follow-up.

Its only technically interesting point is the **jsBridge**: **H5 runs inside a WebView sandbox, so it cannot reach the WeChat SDK or the system share sheet and has to hand "I want to share" over to native.** And how it hands it over — **especially how a callback crosses the language boundary** — is where the follow-up lands.

## The 30-second version

> The smart-home module in the Xiaodu App is H5, running in the native app's WebView. **Hybrid was chosen because changing H5 does not require shipping an app release, and one codebase covers iOS and Android.**
>
> I built the device detail pages, the analytics tracking, and the native share flow through the jsBridge — **inside the WebView sandbox H5 cannot reach the WeChat SDK, so "I want to share" has to be handed to native.**
>
> **The genuinely hard part of the bridge layer is the callback**: functions cannot cross the language boundary, so each call generates an incrementing id, the Promise's resolve is stored in a table, native calls back carrying that id when it is done, and the id finds the matching Promise.

## 1. Why hybrid

| Benefit | Note |
|---|---|
| **Fast iteration** | Changing H5 needs no release and no app-store review |
| **Cross-platform** | One codebase for iOS and Android |
| **Dynamic operations** | Campaign pages, features and A/B tests can change at any time |

**The costs**: worse performance than native, exposure to WebView differences, and ⭐ **capabilities limited to whatever the bridge exposes** — if native has not exposed it, H5 simply cannot do it.

## 2. How JS calls native and native calls JS

**The fundamental problem**: H5 runs in the WebView **sandbox**, which is **a different world** from native. To share, to read Bluetooth, to open the camera, **H5 can only ask native to do it.**

**JS → native, four approaches (chronologically):**

| Approach | How | Drawback |
|---|---|---|
| **URL scheme** | `location.href = 'xiaodu://share?title=xxx'`, with native watching for and intercepting URL changes | ⚠️ **Asynchronous with no return value**, and only one call at a time |
| **iframe.src** | The same, but through an iframe so the main page does not navigate | The same |
| **Intercepting `window.prompt`** | Native overrides `onJsPrompt` (common on Android) | Distinctly a hack |
| ⭐ **Injecting a native object** (the modern mainstream) | Android: `addJavascriptInterface(obj, 'AndroidBridge')` → `window.AndroidBridge.share(...)`<br>iOS: `WKUserContentController.add(handler, name)` → `window.webkit.messageHandlers.iosBridge.postMessage({...})` | |

**Native → JS**: `evaluateJavascript('window.someFn(data)')` (similar on both platforms), which ⭐ **requires H5 to have attached the function to `window` in advance** — which is also why the bridge layer must be initialised very early in the page.

## 3. ⭐ How a callback crosses the language boundary (the point)

⭐ **A function cannot cross the boundary; only an id that can be matched up can.**

```js
class JSBridge {
  callbacks = new Map(); callId = 0;

  call(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.callId;                    // ⭐ an incrementing id ties request to response
      this.callbacks.set(id, { resolve, reject }); // store how to continue
      const payload = { id, method, params };
      isIOS ? window.webkit.messageHandlers.iosBridge.postMessage(payload)
            : window.AndroidBridge.call(JSON.stringify(payload));
    });
  }

  _onNativeCallback(id, data, error) {             // native calls back into this
    const cb = this.callbacks.get(id); if (!cb) return;
    error ? cb.reject(error) : cb.resolve(data);
    this.callbacks.delete(id);                     // delete once used, or it leaks
  }
}
```

**Line by line:**

- Inside `new Promise(...)` nothing **resolves immediately** — `resolve` and `reject` are stored in the table and **called only when native comes back**. This is the standard way to wrap an async callback into a Promise
- The `id` is **the only link between request and response** — the native side knows nothing but that number
- `_onNativeCallback` is attached to `window` so native's `evaluateJavascript` can reach it
- ⭐ `callbacks.delete(id)` cannot be skipped — **without it the table only ever grows**

**The serialisation boundary**: ⭐ **only what JSON can express crosses** — strings, numbers, booleans, arrays, plain objects. **Functions, Dates, undefined and circular references all fail.** On Android it is also common to `JSON.stringify` first and pass a string.

> **What wrapping this layer buys**: the front end never deals with the iOS/Android difference, calling `bridge.call('share', {...})` uniformly and getting back a Promise.

## 4. What if an older app version lacks a bridge method

⭐ **This question tests whether you have thought about staged rollouts and compatibility; not having an answer makes you look like you have only written the happy path.**

| Practice | Note |
|---|---|
| **Feature detection** | Ask native whether it supports the method before calling it, rather than calling blind |
| **Version checks** | Native injects the app version into the UA or onto `window`, and the front end branches on it |
| ⭐ **Timeout fallback** | **Bridge calls must have a timeout** — see below |
| **Graceful degradation** | Sharing degrades to "copy link", device detail degrades to a read-only view |

⭐ **The timeout is the most important one**: a cross-process call **has no connection-dropped signal the way TCP does**, so **you cannot tell that the other side never answered — without a timeout it is pending forever**, that Promise never settles, and the UI spins indefinitely.

## 5. The analytics question that comes with it

**Baidu Statistics**: embed an async SDK, page views are reported automatically, and custom events go through `_hmt.push(['_trackEvent', category, action, label, value])`.

**The cold question: how do you stop reports being lost?** ⭐ **Use a 1×1 `hm.gif` image request rather than XHR** — for two reasons:

1. **Image requests are inherently cross-origin**, unconstrained by the same-origin policy and needing no server-side CORS configuration
2. ⭐ **They survive page unload far better** — when the user closes the tab or navigates away, an XHR is very likely to be killed by the browser

> **The better modern approach is `navigator.sendBeacon`**, a browser API built specifically for reliable reporting during unload that also does not block it. **Volunteering this earns credit.**

**How PV is defined** (there will be one follow-up): ⭐ **in an SPA a route change does not reload the page, so the analytics SDK does not report another PV by default and `_trackPageview` has to be called manually.** The same product instrumented differently can report several times the PV — see the 5M PV section in [① The virtualized feed](/docs?section=baidu&item=virtual-list)).

## Glossary

| 中文 | English |
|---|---|
| 混合应用 | **hybrid app** |
| 原生 | **native** (*native sharing via jsBridge*) |
| 沙箱 | **sandbox** |
| 发版 / 过审 | ship a release · **app store review** |
| 桥接层 | **bridge layer** |
| 注入原生对象 | **inject a native object** |
| 回调 | **callback** |
| 关联 id / 请求编号 | **correlation id** |
| 序列化边界 | **serialisation boundary** |
| 能力探测 | **feature detection** |
| 超时兜底 | **timeout fallback** |
| 永久挂起 | **hang / pend forever** (*the promise never settles*) |
| 降级 | **graceful degradation** |
| 灰度发布 | **staged / canary rollout** |
| 埋点 | **analytics tracking · instrumentation** |
| 上报 | **report / send a beacon** (`navigator.sendBeacon`) |
| 页面卸载 | **page unload** |
| 同源策略 | **same-origin policy** |

> ⭐ **The two easiest to get wrong**:
>
> 1. "A function cannot cross the boundary, only an id that matches up" is **you can't pass a function across the boundary, only a correlation id**
> 2. "Without a timeout it is pending forever" is **without a timeout the promise never settles**
