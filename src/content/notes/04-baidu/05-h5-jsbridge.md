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

## 这条要讲清什么

这是五条里分量最轻的一条，别在它上面花时间。目标是能讲清、不卡壳，一层追问答得上就够。

它唯一有技术含量的点是 jsBridge：H5 跑在 WebView 沙箱里，碰不到微信 SDK、碰不到系统分享面板，只能把「我要分享」这件事交给原生去做。而怎么交，尤其是回调怎么跨语言传，就是这条会被追的地方。

## 为什么是混合应用

三个收益。改 H5 不用发版、不用等应用商店审核，迭代快。iOS 和 Android 一套代码，省一半人力。活动页、专题、AB 测试随时可以改，运营侧可以动态调整。

代价也要说：性能不如原生，要吃 WebView 的差异，而且能力受限于 bridge 提供了什么——原生没暴露的能力，H5 就是做不了。最后这一条是本质约束。

## JS 调原生、原生调 JS 怎么实现

根本问题是：H5 跑在 WebView 的沙箱里，和原生是两个世界。要分享、要读蓝牙、要调相机，H5 只能求原生做。

JS 调原生按年代有四种方案。最早是改地址栏，把参数编码进一个自定义协议的 URL 里，原生监听 URL 变化拦截下来；缺点是异步无返回值，一次只能一个调用。第二种是用一个隐藏 iframe 做同样的事，避免主页面跳转，缺点相同。第三种是原生重写弹窗提示的处理函数来拦截，Android 上常见，hack 味很重。

现代主流是第四种：注入原生对象。Android 通过接口注入把一个原生对象挂到全局上，JS 直接调它的方法；iOS 通过 WebKit 的消息处理器注册一个通道，JS 往那个通道 post 一个对象。

原生调 JS 两端都类似：执行一段 JS 字符串，调用挂在全局上的函数。这里有个必答的细节：需要 H5 提前把函数挂在全局上，这也是为什么 bridge 层要在页面很早就初始化。

## 回调怎么跨语言传，这是题眼

函数不能跨语言传，只能传一个能对上号的 id。

具体做法是：每次调用生成一个自增 id，把这次调用的 resolve 和 reject 存进一张以 id 为键的表里，然后把 id、方法名、参数打包发给原生。原生处理完之后，带着同一个 id 回调挂在全局上的那个函数，从表里取出对应的 resolve 或 reject 调用，然后把这一项从表里删掉。

几个细节要能说出来。Promise 构造函数里不立刻 resolve，而是把 resolve 和 reject 存进表里等原生回来才调，这是把异步回调包装成 Promise 的标准写法。id 是请求和响应之间唯一的纽带，原生那边只认这个数字。用完必须从表里删掉，不删就是一张只增不减的表，也就是内存泄漏。

还有一个序列化边界：只能传 JSON 能表达的东西，字符串、数字、布尔、数组、普通对象。函数、Date、undefined、循环引用全都过不去。Android 那边还经常是先序列化成字符串再传。

封装这一层的价值是：前端不用管 iOS 和 Android 的差异，统一调一个方法拿到一个 Promise。

## 老版本 App 没有某个 bridge 方法怎么办

这一问考的是你有没有想过灰度和兼容，答不上会显得只写过顺利路径。

四种做法。能力探测：调之前先问原生支不支持这个方法，而不是直接调。版本号判断：原生把 App 版本注入到 UA 或者全局上，前端按版本决定走哪条路。超时兜底：bridge 调用必须设超时。降级路径：分享降级成复制链接，设备详情降级成纯展示。

超时兜底那条最重要。跨进程调用没有 TCP 那样的连接断开信号，对面不响应你是察觉不到的——没有超时就是永久 pending，那个 Promise 永远不会 settle，用户界面就一直转圈。

## 埋点顺带会问

百度统计的接入方式是嵌一段异步 SDK，页面浏览自动上报，自定义事件通过往全局队列 push 一个数组来触发。

一个冷门但有区分度的追问：怎么保证上报请求不丢。答案是用一像素的图片请求而不是 XHR，两个原因。第一，图片请求天然跨域，不受同源策略限制，服务端不需要配 CORS。第二，页面卸载时存活率更高——用户点了关闭或者跳走，XHR 大概率被浏览器掐掉。

现代更好的做法是用浏览器专门为卸载时可靠上报提供的 beacon 接口，它还不阻塞卸载。能主动提这个是加分项。

PV 口径也会被追一层：单页应用里路由切换不重新加载页面，统计 SDK 默认不会再报一次 PV，必须手动调页面浏览上报方法。同一个产品埋点方式不同，PV 能差好几倍——这一点和虚拟列表那条里五百万 PV 的口径是同一个问题。

## 英文怎么说

两句最容易说错的。「函数不能跨语言传，只能传一个能对上号的 id」说 you can't pass a function across the boundary, only a correlation id。「没有超时就是永久 pending」说 without a timeout the promise never settles。

其他常用词：混合应用是 hybrid app，原生是 native，沙箱是 sandbox，发版和过审是 ship a release 和 app store review，桥接层是 bridge layer，注入原生对象是 inject a native object，回调是 callback，关联 id 是 correlation id，序列化边界是 serialisation boundary，能力探测是 feature detection，超时兜底是 timeout fallback，降级是 graceful degradation，灰度发布是 staged rollout 或 canary rollout，埋点是 analytics tracking 或 instrumentation，上报是 report 或 send a beacon，页面卸载是 page unload，同源策略是 same-origin policy。

## 30 秒回答

> 小度 App 里的智能家居模块是 H5 做的，跑在原生 App 的 WebView 里。选混合应用是因为改 H5 不用发版，而且 iOS 和 Android 一套代码。我做的是设备详情页、埋点，以及通过 jsBridge 调起原生的分享能力——H5 在 WebView 沙箱里碰不到微信 SDK，只能把「我要分享」这件事交给原生。jsBridge 这层真正的难点是回调：函数不能跨语言传，所以每次调用生成一个自增 id，把 Promise 的 resolve 存在一张表里，原生处理完带着这个 id 回调回来，再按 id 找到对应的 Promise。

## 自检

1. 能否说出混合应用的三个收益和三个代价？
2. 能否讲出 JS 调原生的四种方案，并说明现代主流是哪一种？
3. 能否完整讲出回调用 id 关联的那条链路，包括为什么必须从表里删掉？
4. 能否说出序列化边界传不了哪些东西？
5. 能否说明为什么 bridge 调用必须设超时？
6. 能否解释为什么埋点用图片请求而不是 XHR，以及现代的替代方案？
