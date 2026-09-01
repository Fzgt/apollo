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
> Delivered the Xiaodu App's **H5 smart-home module in Vue 2 on Webpack 3**, **embedded in the native shell**: **iOS/Android sharing through jsBridge**, device detail pages, and **event tracking on the Baidu Statistics API**.
>
> ---
>
> 用 Vue 2（Webpack 3）交付小度 App 的 H5 智能家居模块，嵌在原生壳里：通过 jsBridge 调起 iOS/Android 分享、设备详情页，以及走百度统计 API 的事件埋点。

## 先把词说清

**H5**：国内对「跑在浏览器 / WebView 里的移动网页」的通俗叫法。**英文面试别说 H5，说 a mobile web page 或 a web view module。**

**WebView**：原生 App 里内嵌的浏览器控件。**H5 就跑在它里面。**

**hybrid app（混合应用）**：原生壳 + 内嵌网页的应用形态。

**sandbox（沙箱）**：WebView 里的 JS **拿不到原生能力**——碰不到微信 SDK、系统分享面板、蓝牙、相机。

**JSBridge（桥接层）**：让 WebView 里的 JS 和原生代码互相调用的那层协议 + 封装。

**correlation id（关联 id）**：请求和响应之间对上号用的那个编号。**这条 bullet 的技术核心。**

## 这条要讲清什么

**这是五条里分量最轻的一条，别在它上面花时间。**目标是能讲清、不卡壳，一层追问答得上就够。

**它唯一有技术含量的点是 jsBridge**：H5 跑在 WebView 沙箱里，**只能把「我要分享」这件事交给原生去做**。而**怎么交，尤其是回调怎么跨语言传，就是这条会被追的地方**。

## 为什么是混合应用

**三个收益**：改 H5 **不用发版、不用等应用商店审核**，迭代快；iOS 和 Android **一套代码**，省一半人力；活动页、专题、AB 测试随时可以改。

**代价也要说**：性能不如原生；要吃 WebView 的差异；**能力受限于 bridge 提供了什么——原生没暴露的能力，H5 就是做不了**。**最后这一条是本质约束。**

## JS 调原生、原生调 JS 怎么实现

**根本问题是：H5 跑在 WebView 的沙箱里，和原生是两个世界。**

**JS 调原生按年代有四种方案：**

1. **改地址栏**——把参数编码进一个自定义协议的 URL（`myapp://share?title=...`），原生监听 URL 变化拦截。**缺点是异步无返回值，一次只能一个调用。**
2. **隐藏 iframe** 做同样的事，避免主页面跳转，**缺点相同**。
3. **原生重写 `prompt` / `alert` 的处理函数来拦截**，Android 上常见，**hack 味很重**。
4. **注入原生对象——现代主流。**

```js
// Android：@JavascriptInterface 注入，JS 直接调它的方法
window.NativeBridge.postMessage(JSON.stringify(payload));

// iOS：WKWebView 的 messageHandlers 通道
window.webkit.messageHandlers.nativeBridge.postMessage(payload);
```

**原生调 JS** 两端都类似：**执行一段 JS 字符串，调用挂在全局上的函数**（`evaluateJavascript` / `evaluateJavaScript`）。

**这里有个必答的细节：需要 H5 提前把函数挂在全局上，这也是为什么 bridge 层要在页面很早就初始化。**

## 回调怎么跨语言传，这是题眼

**函数不能跨语言传，只能传一个能对上号的 id。**

```ts
const callbacks = new Map<number, { resolve: Fn; reject: Fn }>();
let seq = 0;

function callNative(method: string, params: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    callbacks.set(id, { resolve, reject });   // ① 存进表，不立刻 resolve
    postToNative({ id, method, params });     // ② 只把 id 发过去
    setTimeout(() => {                        // ③ 必须有超时兜底
      if (callbacks.delete(id)) reject(new Error('bridge timeout'));
    }, 5000);
  });
}

// 原生处理完，带着同一个 id 回调这个全局函数
window.__onNativeCallback = ({ id, data, error }) => {
  const cb = callbacks.get(id);
  if (!cb) return;
  callbacks.delete(id);                       // ④ 用完必须删，否则内存泄漏
  error ? cb.reject(error) : cb.resolve(data);
};
```

**四个细节要能说出来：**

**①** `Promise` 构造函数里**不立刻 resolve**，而是把 `resolve` / `reject` 存进表里等原生回来才调——**这是把异步回调包装成 Promise 的标准写法**。

**②** **id 是请求和响应之间唯一的纽带**，原生那边只认这个数字。

**③** **没有超时就是永久 pending**，那个 Promise 永远不会 settle，用户界面就一直转圈。**跨进程调用没有 TCP 那样的连接断开信号，对面不响应你是察觉不到的。**

**④** **用完必须从表里删掉**，不删就是一张只增不减的表，**也就是内存泄漏**。

**还有一个序列化边界（serialisation boundary）**：**只能传 JSON 能表达的东西**——字符串、数字、布尔、数组、普通对象。**函数、`Date`、`undefined`、循环引用全都过不去。**Android 那边还经常是先序列化成字符串再传。

**封装这一层的价值是：前端不用管 iOS 和 Android 的差异，统一调一个方法拿到一个 Promise。**

## 老版本 App 没有某个 bridge 方法怎么办

**这一问考的是你有没有想过灰度和兼容，答不上会显得只写过顺利路径。**

1. **能力探测（feature detection）**：调之前先问原生支不支持这个方法，而不是直接调。
2. **版本号判断**：原生把 App 版本注入到 UA 或者全局上，前端按版本决定走哪条路。
3. **超时兜底**：bridge 调用必须设超时。**（见上面代码里的 ③）**
4. **降级路径（graceful degradation）**：分享降级成复制链接，设备详情降级成纯展示。

## 埋点顺带会问

百度统计的接入方式是嵌一段异步 SDK，**页面浏览自动上报**，自定义事件通过往全局队列 `push` 一个数组来触发。

**一个冷门但有区分度的追问：怎么保证上报请求不丢。**

答案是**用 1×1 像素的图片请求而不是 XHR**，两个原因：

1. **图片请求天然跨域**，不受同源策略限制，**服务端不需要配 CORS**。
2. **页面卸载时存活率更高**——用户点了关闭或者跳走，**XHR 大概率被浏览器掐掉**。

**现代更好的做法是 `navigator.sendBeacon()`**，浏览器专门为卸载时可靠上报提供的接口，**它还不阻塞卸载**。**能主动提这个是加分项。**

**PV 口径也会被追一层**：**单页应用里路由切换不重新加载页面，统计 SDK 默认不会再报一次 PV，必须手动调页面浏览上报方法**。**同一个产品埋点方式不同，PV 能差好几倍**——这一点和虚拟列表那条里 500 万 PV 的口径是同一个问题。

## 英文怎么说

**两句最容易说错的。**「函数不能跨语言传，只能传一个能对上号的 id」说 **you can't pass a function across the boundary, only a correlation id**。「没有超时就是永久 pending」说 **without a timeout the promise never settles**。

**另外：英文面试里别说 "H5"**，说 **a mobile web page** 或 **a web view module**——H5 是中文语境的说法，英语母语者会听不懂。

**术语对照**：混合应用 hybrid app ／ 原生 native ／ 沙箱 sandbox ／ 发版 ship a release ／ 应用商店审核 app store review ／ 桥接层 bridge layer ／ 注入原生对象 inject a native object ／ 回调 callback ／ 关联 id correlation id ／ 序列化边界 serialisation boundary ／ 能力探测 feature detection ／ 超时兜底 timeout fallback ／ 降级 graceful degradation ／ 灰度发布 staged rollout、canary rollout ／ 埋点 analytics tracking、instrumentation ／ 上报 report、send a beacon ／ 页面卸载 page unload ／ 同源策略 same-origin policy。

## 30 秒回答

> 小度 App 里的智能家居模块是网页做的，跑在原生 App 的 WebView 里。选混合应用是因为改网页不用发版，而且 iOS 和 Android 一套代码。我做的是设备详情页、埋点，以及通过 jsBridge 调起原生的分享能力——网页在 WebView 沙箱里碰不到微信 SDK，只能把「我要分享」这件事交给原生。jsBridge 这层真正的难点是回调：函数不能跨语言传，所以每次调用生成一个自增 id，把 Promise 的 resolve 存在一张 Map 里，原生处理完带着这个 id 回调全局函数，再按 id 找到对应的 Promise。配套两条：必须设超时，否则跨进程没响应就是永久 pending；回调完必须从表里删掉，否则那张表只增不减。

## 自检

1. 能否说出混合应用的三个收益和三个代价？
2. 能否讲出 JS 调原生的四种方案，并说明现代主流是哪一种？
3. 能否完整讲出回调用 id 关联的那条链路，包括为什么必须从表里删掉？
4. 能否说出序列化边界传不了哪些东西？
5. 能否说明为什么 bridge 调用必须设超时？
6. 能否解释为什么埋点用图片请求而不是 XHR，以及 `sendBeacon` 这个现代替代？
7. 能否说清 SPA 里路由切换为什么要手动补 PV 上报？
