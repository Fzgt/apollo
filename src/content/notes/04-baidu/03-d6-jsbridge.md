---
title: "Day 6 · H5 与 JSBridge"
tier: ref
section: 百度 · Day 6–7
icon: landmark
day: 6
level: B
status: done
---

# Day 6 · H5 与 JSBridge（速查）

> ⚪ **B 级**，计划里明确写了「只要 30 秒版 + 一层追问」。别在这条上花时间。

## 30 秒版

> 小度 App 里的智能家居模块是 H5 做的，跑在原生 App 的 WebView 里。**选混合应用是因为改 H5 不用发版 App，而且 iOS/Android 一套代码。** 我做的是设备详情页、埋点，以及通过 jsBridge 调起原生的分享能力——H5 跑在 WebView 沙箱里碰不到微信 SDK，**只能把「我要分享」这件事交给原生去做**。

## 为什么是混合应用

| 收益 | 说明 |
|---|---|
| **快速迭代** | 改 H5 不用发版、不用等审核 |
| **跨端** | iOS/Android 一套代码 |
| **动态运营** | 活动页、专题、AB 测试随时改 |

**代价**：性能不如原生、依赖 WebView 的差异、**能力受限于 bridge 提供了什么**。

## Q1：JS 调 Native / Native 调 JS 怎么实现

**根本问题**：H5 跑在 WebView 沙箱里，和原生是**两个世界**。要分享、要读蓝牙、要调相机，**H5 只能「求」原生做**。

**JS → Native，四种方案（按年代）**：

| 方案 | 做法 | 缺点 |
|---|---|---|
| **URL Scheme** | `location.href = 'xiaodu://share?title=xxx'`，原生监听 URL 变化拦截 | **异步无返回值**，一次只能一个调用 |
| **iframe.src** | 同上，但用 iframe 避免主页面跳转 | 同上 |
| **`window.prompt` 拦截** | 原生重写 `onJsPrompt`（Android 常用） | hack 味重 |
| **注入原生对象** ✅ 现代主流 | Android：`addJavascriptInterface(obj, 'AndroidBridge')` → `window.AndroidBridge.share(...)`<br>iOS：`WKUserContentController.add(handler, name)` → `window.webkit.messageHandlers.iosBridge.postMessage({...})` | |

**Native → JS**：`evaluateJavascript('window.someFn(data)')`（两端都类似），**需要 H5 提前把函数挂在 `window` 上**。

## Q2：callback 怎么跨语言传？序列化边界在哪

> ⭐ **题眼：函数不能跨语言传，只能传「一个能对上号的 id」。**

通用封装的做法：

```js
class JSBridge {
  callbacks = new Map(); callId = 0;
  call(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.callId;                    // ⭐ 用自增 id 关联请求和响应
      this.callbacks.set(id, { resolve, reject });
      const payload = { id, method, params };
      isIOS ? window.webkit.messageHandlers.iosBridge.postMessage(payload)
            : window.AndroidBridge.call(JSON.stringify(payload));
    });
  }
  _onNativeCallback(id, data, error) {             // 原生反向调这个
    const cb = this.callbacks.get(id); if (!cb) return;
    error ? cb.reject(error) : cb.resolve(data);
    this.callbacks.delete(id);
  }
}
```

**序列化边界**：**只能传 JSON 能表达的东西**——字符串、数字、布尔、数组、普通对象。函数、Date、undefined、循环引用全都过不去。Android 那边还经常是 `JSON.stringify` 成字符串再传。

> **封装这一层的价值**：前端不用管 iOS/Android 的差异，统一 `bridge.call('share', {...})` 拿到一个 Promise。

## Q3：老版本 App 没有某个 bridge 方法怎么办

**这一问考的是「你有没有想过灰度和兼容」**，答不上会显得只写过 happy path。

| 做法 | 说明 |
|---|---|
| **能力探测** | 调之前先问原生「你支不支持这个方法」，而不是直接调 |
| **版本号判断** | 原生把 App 版本注入到 UA 或 `window` 上，前端按版本决定走哪条路 |
| **超时兜底** | ⭐ **bridge 调用要设超时**——老版本原生收到不认识的方法可能**什么都不做也不回调**，前端会永远 pending |
| **降级路径** | 分享降级成「复制链接」，设备详情降级成纯展示 |

> **超时兜底那条最重要**：跨进程调用**没有 TCP 那样的连接断开信号**，对面不响应你是察觉不到的。**没有超时就是永久 pending。**

## Q4（会顺带问）：埋点怎么做的

**百度统计**：嵌一段异步 SDK，页面浏览自动上报，自定义事件 `_hmt.push(['_trackEvent', category, action, label, value])`。

**冷问：怎么保证请求不丢？** 用 **1×1 的 `hm.gif` 图片请求**而不是 XHR——图片请求**天然跨域不受同源策略限制**，而且**页面卸载时存活率更高**。（现代更好的做法是 `navigator.sendBeacon`，浏览器专门为「卸载时可靠上报」提供的 API。）

> PV 口径和统计链路详见 [#4 · 5M+ daily page views](/docs?section=baidu&item=n04-daily-pv)。
