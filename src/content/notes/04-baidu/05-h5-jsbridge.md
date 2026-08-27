---
title: "⑤ H5 与 JSBridge"
tier: must
section: 百度
icon: landmark
day: 6
level: B
status: done
---

# ⑤ H5 与 JSBridge

> **简历原句**
>
> Delivered the Xiaodu App’s **H5 smart-home module in Vue 2 on Webpack 3**, **embedded in the native shell**: **iOS/Android sharing through jsBridge**, device detail pages, and **event tracking on the Baidu Statistics API**.
>
> ---
>
> 用 Vue 2（Webpack 3）交付小度 App 的 H5 智能家居模块，嵌在原生壳里：通过 jsBridge 调起 iOS/Android 分享、设备详情页，以及走百度统计 API 的事件埋点。

## 这条 bullet 在讲什么

⚠️ **这是五条里分量最轻的一条，别在它上面花时间。** 目标是**能讲清、不卡壳**，一层追问答得上就够。

它唯一有技术含量的点是 **jsBridge**：**H5 跑在 WebView 沙箱里，碰不到微信 SDK、碰不到系统分享面板，只能把「我要分享」这件事交给原生去做。** 而「怎么交」——尤其是**回调怎么跨语言传** —— 就是这条会被追的地方。

## 30 秒口播稿

> 小度 App 里的智能家居模块是 H5 做的，跑在原生 App 的 WebView 里。**选混合应用是因为改 H5 不用发版 App，而且 iOS 和 Android 一套代码。**
>
> 我做的是设备详情页、埋点，以及通过 jsBridge 调起原生的分享能力 —— **H5 在 WebView 沙箱里碰不到微信 SDK，只能把「我要分享」这件事交给原生**。
>
> **jsBridge 这层真正的难点是回调**：函数不能跨语言传，所以每次调用生成一个自增 id，把 Promise 的 resolve 存在一张表里，原生处理完带着这个 id 回调回来，再按 id 找到对应的 Promise。

## 一、为什么是混合应用

| 收益 | 说明 |
|---|---|
| **快速迭代** | 改 H5 不用发版、不用等应用商店审核 |
| **跨端** | iOS/Android 一套代码 |
| **动态运营** | 活动页、专题、AB 测试随时改 |

**代价**：性能不如原生、依赖 WebView 的差异、⭐ **能力受限于 bridge 提供了什么** —— 原生没暴露的能力，H5 就是做不了。

## 二、JS 调 Native / Native 调 JS 怎么实现

**根本问题**：H5 跑在 WebView **沙箱（sandbox）**里，和原生是**两个世界**。要分享、要读蓝牙、要调相机，**H5 只能「求」原生做**。

**JS → Native，四种方案（按年代）：**

| 方案 | 做法 | 缺点 |
|---|---|---|
| **URL Scheme** | `location.href = 'xiaodu://share?title=xxx'`，原生监听 URL 变化拦截 | ⚠️ **异步无返回值**，一次只能一个调用 |
| **iframe.src** | 同上，但用 iframe 避免主页面跳转 | 同上 |
| **`window.prompt` 拦截** | 原生重写 `onJsPrompt`（Android 常用） | hack 味重 |
| ⭐ **注入原生对象**（现代主流） | Android：`addJavascriptInterface(obj, 'AndroidBridge')` → `window.AndroidBridge.share(...)`<br>iOS：`WKUserContentController.add(handler, name)` → `window.webkit.messageHandlers.iosBridge.postMessage({...})` | |

**Native → JS**：`evaluateJavascript('window.someFn(data)')`（两端都类似），⭐ **需要 H5 提前把函数挂在 `window` 上** —— 这也是为什么 bridge 层要在页面很早就初始化。

## 三、⭐ callback 怎么跨语言传（题眼）

⭐ **函数不能跨语言传，只能传「一个能对上号的 id」。**

```js
class JSBridge {
  callbacks = new Map(); callId = 0;

  call(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.callId;                    // ⭐ 用自增 id 关联请求和响应
      this.callbacks.set(id, { resolve, reject }); // 把「怎么继续」存下来
      const payload = { id, method, params };
      isIOS ? window.webkit.messageHandlers.iosBridge.postMessage(payload)
            : window.AndroidBridge.call(JSON.stringify(payload));
    });
  }

  _onNativeCallback(id, data, error) {             // 原生反向调这个
    const cb = this.callbacks.get(id); if (!cb) return;
    error ? cb.reject(error) : cb.resolve(data);
    this.callbacks.delete(id);                     // 用完就删，否则是内存泄漏
  }
}
```

**逐行说明：**

- `new Promise(...)` 里**不立刻 resolve** —— 把 `resolve` 和 `reject` 存进表里，**等原生回来才调**。这是「把异步回调包装成 Promise」的标准写法
- `id` 是**请求和响应之间唯一的纽带** —— 原生那边只认这个数字
- `_onNativeCallback` 挂在 `window` 上，供原生 `evaluateJavascript` 调用
- ⭐ `callbacks.delete(id)` 不能省 —— **不删就是一张只增不减的表**

**序列化边界（serialisation boundary）**：⭐ **只能传 JSON 能表达的东西** —— 字符串、数字、布尔、数组、普通对象。**函数、Date、undefined、循环引用全都过不去。** Android 那边还经常是先 `JSON.stringify` 成字符串再传。

> **封装这一层的价值**：前端不用管 iOS/Android 的差异，统一 `bridge.call('share', {...})` 拿到一个 Promise。

## 四、老版本 App 没有某个 bridge 方法怎么办

⭐ **这一问考的是「你有没有想过灰度和兼容」，答不上会显得只写过顺利路径。**

| 做法 | 说明 |
|---|---|
| **能力探测（feature detection）** | 调之前先问原生「你支不支持这个方法」，而不是直接调 |
| **版本号判断** | 原生把 App 版本注入到 UA 或 `window` 上，前端按版本决定走哪条路 |
| ⭐ **超时兜底** | **bridge 调用必须设超时** —— 见下 |
| **降级路径（graceful degradation）** | 分享降级成「复制链接」，设备详情降级成纯展示 |

⭐ **超时兜底那条最重要**：跨进程调用**没有 TCP 那样的连接断开信号**，**对面不响应你是察觉不到的 —— 没有超时就是永久 pending**，那个 Promise 永远不会 settle，用户界面就一直转圈。

## 五、埋点顺带会问

**百度统计**：嵌一段异步 SDK，页面浏览自动上报，自定义事件 `_hmt.push(['_trackEvent', category, action, label, value])`。

**冷问：怎么保证上报请求不丢？** ⭐ **用 1×1 的 `hm.gif` 图片请求而不是 XHR** —— 两个原因：

1. **图片请求天然跨域**，不受同源策略限制，不需要服务端配 CORS
2. ⭐ **页面卸载时存活率更高** —— 用户点了关闭/跳走，XHR 大概率被浏览器掐掉

> **现代更好的做法是 `navigator.sendBeacon`**，浏览器专门为「卸载时可靠上报」提供的 API，还不阻塞卸载。**能主动提这个是加分项。**

**PV 的口径**（会被追一层）：⭐ **SPA 里路由切换不重新加载页面，统计 SDK 默认不会再报一次 PV，必须手动调 `_trackPageview`。** 同一个产品埋点方式不同，PV 能差好几倍 —— 详见 [① 虚拟列表](/docs?section=baidu&item=virtual-list)) 里 5M PV 那一节。

## 六、本篇术语英文对照

| 中文 | 英文 |
|---|---|
| 混合应用 | **hybrid app** |
| 原生 | **native**（*native sharing via jsBridge*） |
| 沙箱 | **sandbox** |
| 发版 / 过审 | ship a release · **app store review** |
| 桥接层 | **bridge layer** |
| 注入原生对象 | **inject a native object** |
| 回调 | **callback** |
| 关联 id / 请求编号 | **correlation id** |
| 序列化边界 | **serialisation boundary** |
| 能力探测 | **feature detection** |
| 超时兜底 | **timeout fallback** |
| 永久挂起 | **hang / pend forever**（*the promise never settles*） |
| 降级 | **graceful degradation** |
| 灰度发布 | **staged / canary rollout** |
| 埋点 | **analytics tracking · instrumentation** |
| 上报 | **report / send a beacon**（`navigator.sendBeacon`） |
| 页面卸载 | **page unload** |
| 同源策略 | **same-origin policy** |

> ⭐ **两个最容易说错的**：
>
> 1. 「函数不能跨语言传，只能传一个能对上号的 id」说 **you can't pass a function across the boundary, only a correlation id**
> 2. 「没有超时就是永久 pending」说 **without a timeout the promise never settles**
