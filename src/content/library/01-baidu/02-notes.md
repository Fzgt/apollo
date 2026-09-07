---
title: 白屏 · 提现 · jsBridge
section: 百度
icon: landmark
---

# 百度 Bullet 3-5 —— 白屏事故 / 提现并发 / jsBridge

> 百度这段技术密度最高(虚拟列表、Webpack 迁移、P2 事故复盘都是硬货),但当时做完就忘。这几篇按简历 bullet 拆开,**把每条背后的底层机制彻底讲清楚**,让你面试时能一层一层往下答。
>
> 每条 bullet 分五段:**原文** / **核心技术点** / **实现原理** / **你当时大概是怎么做的** / **面试预期追问**。编号和顺序照现简历 Baidu section —— 虚拟列表 / Webpack / 白屏 / 提现 / jsBridge;开头引的是**该条更早的措辞**,和现简历有出入处以站内笔记为准。
>
> 百度的代码不在本机,这几篇全靠笔记 + 回忆,所以分量比另外两份重。
>
> **已处理(2026-08-19)**:提现那条原本带着 `without a single dollar of financial loss`。零资损是财务对账的结论,不是前端能测出来的东西 —— 已经不在简历上,换成请求锁、幂等 key、不确定按失败处理这三个可证的动作。下面正文里引的原句已同步更新。

---

## Bullet 3:P2 白屏事故复盘 —— 依赖锁定与预发布验证


> 旧版原文：First to diagnose a P2 white screen on Haokan Video’s search page (100M+ DAU): mismatched Node versions regenerated package-lock.json, pulling a breaking minor bump — version locks and release checks followed.

### 核心技术点

#### ① 依赖版本管理的层次
```
package.json         语义化范围声明("^1.2.3")
    ↓
package-lock.json    实际锁定版本("1.2.3")+ 完整依赖树 + 完整性 hash
    ↓
node_modules         实际安装的物理文件
```

#### ② Semver(语义化版本)
- **`MAJOR.MINOR.PATCH`** = `1.2.3`
- **PATCH**(1.2.**3**):bug 修复,兼容
- **MINOR**(1.**2**.3):新功能,兼容
- **MAJOR**(**1**.2.3):破坏性变化,不兼容
- **范围声明符**:
  - `1.2.3`:精确
  - `~1.2.3`:允许 patch 更新(1.2.x)
  - `^1.2.3`:允许 minor + patch 更新(1.x.x,MAJOR 不变)
  - `*`:任意版本(不要用)

#### ③ package-lock.json 是干嘛的
- **锁定版本**:即使 package.json 是 `^1.2.3`,lock 记录了实际装的是 `1.2.5`(以及所有依赖的依赖)
- **保证团队一致性**:所有人 `npm install` 装出来的 node_modules 完全一样
- **提供完整性校验**:每个包的 tar 包 sha512 hash,防止 registry 被篡改

#### ④ 事故根因链条(⭐ 逐层拆解)
你的描述:"Node.js 版本不一致导致 package-lock.json 重新生成,引发依赖小版本升级引入的 breaking change"

拆开看:
1. **不同开发者/CI 机器 Node 版本不一致**(如 dev: v14, CI: v16, 某同事: v18)
2. **npm 版本随 Node 变**(npm 6 vs npm 7 vs npm 8/9,lock 文件格式不同)
3. **某开发者本地 `npm install` 加了新包**
4. **他的 npm 版本(比 lock 生成时新)看到旧 lock 格式,或者算法不同,重新生成 lock**
5. **重新生成时,`^1.2.3` 被解析为最新 1.x.x**(比如 1.5.0)
6. **1.5.0 里有个 minor 更新引入了行为变化**(理论上 minor 应该兼容,但实际"意外破坏"经常发生)
7. **改动 commit 到主分支**
8. **CI build → 部署 → 生产白屏**

#### ⑤ 预防方案(简历"依赖版本锁定 + 强制预发布验证")

**A. 依赖版本锁定**:
1. **Node 版本锁定**:
   - `package.json` 加 `"engines": { "node": "16.x" }`(和 npm/yarn 一起)
   - `.nvmrc` 文件写死版本,`nvm use` 自动切
   - **Volta** 更强:`package.json` 里 `"volta": { "node": "16.20.0", "npm": "8.19.4" }`,自动切且强制
2. **Lock 文件强制**:
   - CI 用 `npm ci` 不用 `npm install`(严格按 lock 装,lock 和 package.json 不一致直接失败)
   - Yarn 用 `--frozen-lockfile`
3. **pnpm** 一定程度上更严格(严格 hoisting)
4. **CI 检查 lock 文件是否被随意改**:PR check 里 diff `package-lock.json`

**B. 强制预发布验证**:
1. **Staging/Canary 环境**:先部署到内部环境,QA 验证
2. **烟雾测试(Smoke Test)**:自动化脚本跑核心路径,通过才允许上线
3. **灰度发布(Canary Release)**:先 1% 流量,监控错误率,渐进放大
4. **回滚机制**:一键回滚到上一个 release
5. **Feature Flag**:代码上线不代表功能启用,可以用 flag 控制,出问题秒关

#### ⑥ 白屏事故的定位思路
用户报告"打不开某个页面"时的排查:
1. **能不能复现?**(哪个浏览器、哪个用户、哪个地区)
2. **看监控**:Sentry 看错误详情、堆栈、release 版本
3. **看 CDN 日志**:资源是不是 404?
4. **看 Console**:错误信息是什么?SyntaxError / TypeError / ChunkLoadError?
5. **定位到具体 JS 文件行数**(sourcemap)
6. **定位到具体依赖/代码变化**(git blame + release diff)
7. **验证根因**:本地复现、二分定位
8. **修复**:回滚 or 前向修复
9. **复盘**:根因、影响、时间线、改进项

#### ⑦ ChunkLoadError —— 白屏的另一常见根因
和你的场景不完全一样,但值得知道:发布时旧用户还在用旧 HTML,里面引用了旧的 chunk 文件名(hash),而新版本发布把旧 chunk 从 CDN 删了 → chunk 加载失败 → 白屏。

**解决**:
- CDN 上保留旧版本一段时间(不立刻删)
- 前端捕获 `ChunkLoadError` → 提示用户刷新 → 刷新后拿到最新 HTML

### 实现原理

#### `npm install` vs `npm ci` 的差异
| | `npm install` | `npm ci` |
|---|---|---|
| 更新 lock | 会(允许 semver 范围内漂移) | 不会 |
| package.json vs lock 不一致 | 修改 lock 让它一致 | 直接失败退出 |
| node_modules 存在 | 增量装 | 先删再装 |
| 速度 | 慢(要解析、比较) | 快(严格按 lock) |
| 场景 | 本地开发 | CI/CD |

**面试问"CI 用哪个",一定要答 `npm ci`**。

#### 为什么 minor 版本升级也可能 breaking
理论上 semver 说 minor 是兼容的,但实际:
- 修 bug 时可能改变了默认行为
- TypeScript 类型定义更严格,编译报错
- 内部实现变化影响性能特征
- 依赖的依赖被更新(transitive)

**教训**:任何依赖升级都要跑一遍测试,即使 patch。

### 你当时大概是怎么做的

1. **发现**:白屏 → 大概率 error 上报激增 → 你是第一个 dig 深的
2. **定位**:
   - 打开 Sentry,看 error 详情 → 某个 `TypeError: xxx is not a function`
   - 对照 sourcemap 定位到源码行数
   - 想:"我本地能跑,线上不行,差异在哪?"
   - `git log` 看最近改动 → 发现 `package-lock.json` 无关代码 PR 里被改了
   - 对比 lock 差异 → 某个依赖从 1.2.3 → 1.5.0
   - 查这个依赖的 changelog → 1.4.0 有个 breaking(可能是接口签名变了)
3. **修复**:
   - 短期:pin lock 里那个依赖到旧版本
   - 长期:推动流程改进
4. **复盘 & 改进**:
   - 全公司/团队加 `"engines"` + Volta 强制 Node 版本
   - CI 用 `npm ci`
   - PR 检查:package-lock diff 要独立 review
   - 预发布环境必过烟雾测试才准上线

### 面试预期追问

- **为什么不所有依赖都 pin 死?**
  → 完全 pin 意味着安全 patch 不会自动进来。折中:`^` 允许 minor + patch,但 lock 文件严格锁定当前实际版本。定期(如每月)run `npm outdated` 计划性升级。
- **`npm install` 和 `yarn install` 生成的 lock 兼容吗?**
  → **不兼容**。团队要么全 npm 要么全 yarn。混用会导致 lock 冲突。
- **P2 事故是什么级别?**
  → 通常公司分 P0(全线故障)/ P1(核心功能不可用)/ P2(部分功能受影响,DAU 亿级也算 P2 因为影响大)/ P3+(次要)。
- **为什么第一个发现的是你?**
  → 主动追根因(不是"重装解决"),对整个 build/deploy pipeline 熟悉。这一点值得在面试时强调 —— **ownership + system thinking**。
- **复盘会怎么开?**
  → **Blameless Postmortem**(无罪化复盘)原则:
    1. 时间线(什么时候发生、什么时候发现、什么时候修复)
    2. 根因(为什么发生)
    3. 影响(多少用户、多少收入)
    4. 改进项(具体行动、负责人、deadline)
    5. **不追责个人**,追问"为什么系统允许这事发生"

---


## Bullet 4:提现功能 QPS 2000+ —— 高并发场景下的前端防御


> 旧版原文：Built the withdrawal client on a path peaking above 2,000 QPS: request locking drops in-flight duplicates, client-generated idempotency keys survive reloads, and uncertain outcomes surface as failures, never successes.

### 核心技术点

#### ① 防抖(Debounce)vs 节流(Throttle)—— 常混
- **Debounce**:多次触发,**最后一次触发后 n 毫秒才执行**。用户不停按按钮,只有停手 300ms 才真正调用。
  - 场景:搜索框输入、resize、按钮防连点(第一版)
- **Throttle**:多次触发,**每 n 毫秒最多执行一次**。用户不停触发,匀速执行。
  - 场景:滚动 scroll、鼠标 mousemove
- **提现按钮用哪个?**
  - Debounce 有个问题:"最后一次才生效"意味着用户点了 100 次,只有第 100 次触发 300ms 后发请求。用户可能觉得"没反应"再点更多次。
  - **更好的做法**:**首次立即执行 + 后续 lock**(下面 ② 讲)。这是"leading edge"防抖 + 请求锁的组合。

#### ② 请求锁(Request Locking / In-flight Tracking)
问题:用户点提现 → 发请求 → **请求返回之前**用户又点 → 发第二个请求 → 后端可能扣两次款。

解决方案:在**请求发出到响应回来的整个窗口内**,拦截后续的相同请求。

```js
let inFlight = false;

async function withdraw() {
  if (inFlight) return; // 锁住,直接忽略
  inFlight = true;
  try {
    const res = await api.withdraw();
    handleSuccess(res);
  } catch (err) {
    handleError(err);
  } finally {
    inFlight = false; // 解锁
  }
}
```
更完整的做法:**按参数 key 去重**(同一笔提现锁,不同笔可以并发):
```js
const inFlightMap = new Map();

async function withdraw(orderId) {
  if (inFlightMap.has(orderId)) return inFlightMap.get(orderId);
  const promise = api.withdraw(orderId);
  inFlightMap.set(orderId, promise);
  try {
    return await promise;
  } finally {
    inFlightMap.delete(orderId);
  }
}
```
这个模式叫"**Promise 去重**",React Query / SWR 内部就是这么做的。

#### ③ 幂等性(Idempotency)—— 真正的零资金损失靠这个
前端锁只能防"同一个 tab 快速点击",防不了:
- 网络超时前端重试
- 用户在不同设备/tab 同时操作
- 页面刷新后再点

**真正的零损失必须靠后端幂等**:
- 每个提现请求带一个**幂等 key**(前端生成的 UUID,或者用 orderId)
- 后端在数据库里存"已处理的幂等 key",同 key 重复请求返回上次结果,不再执行

前端能做的是:
- 提前生成幂等 key,存 sessionStorage(刷新也保持)
- 每次调用都带这个 key
- **配合后端才是完整方案**

#### ④ 错误兜底(Error Fallbacks)
金融场景的错误处理原则:**默认失败,只有明确成功才展示成功**。
- **明确失败**(HTTP 4xx/5xx、业务错误码):UI 显示错误 + 可重试按钮
- **不确定**(超时、网络中断、请求发出但没响应):**当作失败处理**,但提示用户"网络异常,请稍后查看提现记录",不要直接说"失败"(可能后端处理了)
- **明确成功**(2xx + 业务成功码):UI 展示成功

**为什么"不确定"要按失败处理?**
- 显示"失败"用户会去重试,重试有幂等 key 兜底,不会真扣两次
- 显示"成功"如果实际没到账,用户以为提了但没钱到账,炸锅

#### ⑤ QPS 2000+ 的前端角度理解
- **QPS = Queries Per Second**,每秒请求数
- 2000 QPS 通常是**后端指标**,不是前端。前端不"扛" QPS,前端"贡献" QPS(每个用户点一下就贡献 1 QPS)
- 前端能做的:
  - 减少不必要的请求(防抖 + 锁)
  - 排队/限流(不让活动开始那一瞬间 10 万人同时点)
  - CDN 缓存静态资源,减少动态请求

### 实现原理

#### 前端限流的高级做法 —— 令牌桶 / 漏桶
真正的高并发场景,前端会自己做"限流":
- **令牌桶**:每 100ms 生成一个 token,用户点击消耗 token,没 token 时按钮 disabled
- **漏桶**:请求进队列,以固定速率发送
- **代码示例**(令牌桶):
```js
let tokens = 5;
setInterval(() => tokens = Math.min(tokens + 1, 5), 200);

async function tryClick() {
  if (tokens === 0) return alert('操作太频繁');
  tokens--;
  await api.doSomething();
}
```

### 你当时大概是怎么做的

1. 按钮 onClick 加 `disabled` 状态(点击后立刻 disable,响应回来 enable)—— 视觉锁
2. 逻辑锁:内存里 `inFlightMap` 或 `Set`,同一 orderId 拦截
3. 前端生成 idempotency key(uuid),存 sessionStorage
4. API 层统一注入 idempotency key 到 header 或 body
5. 错误兜底:统一 error handler,超时/网络错误显示"稍后查看",4xx 显示业务错误
6. 全局 loading 状态防止用户误以为"没反应"

### 面试预期追问

- **防抖和节流具体怎么实现?**
  → 手写(高频面试题):
  ```js
  const debounce = (fn, ms) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  };
  
  const throttle = (fn, ms) => {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn(...args);
      }
    };
  };
  ```
  高级版本:防抖有 `leading` / `trailing` 选项,节流有 `requestAnimationFrame` 版本。
- **你怎么保证零资金损失的?**
  → 前端 3 层(视觉 disable + 内存锁 + idempotency key)+ 后端幂等 = 端到端保证。**前端只是"减少无效请求",真正的零损失是后端 + 前端配合**。
- **QPS 2000 对前端有什么挑战?**
  → 主要不是 QPS 本身,而是"活动开抢时的峰值",可能瞬间 10 万人涌入首屏。前端做:CDN、SSR/SSG 减少动态请求、按钮进入排队机制、失败降级到静态提示页。
- **如果用户在两个 tab 同时点提现怎么办?**
  → 前端内存锁跨 tab 无效,必须靠后端幂等或分布式锁(Redis SETNX + 过期时间)。

---


## Bullet 5:小度 App H5 智能家居模块 —— jsBridge + 混合应用


> 旧版原文：Delivered the Xiaodu App’s H5 smart-home module in Vue 2, adding native iOS/Android sharing via jsBridge, device detail pages and analytics tracking.

### 核心技术点

#### ① Hybrid App(混合应用)架构
- **是什么**:原生 App(Native)里嵌入 WebView 加载 H5 页面。原生做外壳(启动、账号、支付、大功能),H5 做业务(灵活迭代、跨端一致)。
- **为什么选混合**:
  - 快速迭代(改 H5 不用发版 App)
  - 跨端(iOS/Android 一套 H5)
  - 动态运营(活动页、专题、AB 测试)
- **WebView**:
  - **iOS**:早期 UIWebView(已废弃),现在都是 **WKWebView**(WebKit,基于 Safari 内核)
  - **Android**:早期是系统 WebView(4.4 前是 WebKit,4.4+ 是 Chromium),后来出 **X5 WebView**(腾讯魔改 Blink,统一多机型行为)

#### ② jsBridge —— H5 和原生怎么通信
问题:H5 跑在 WebView 沙箱里,和原生是**两个世界**。要"分享到微信"、"读取蓝牙设备"、"调起相机",H5 只能"求"原生做。

**H5 调原生的 4 种方案**:
1. **URL Scheme**(最古老):H5 里 `location.href = 'xiaodu://share?title=xxx'`,原生监听 URL 变化,匹配 scheme 后拦截 + 解析 + 执行。缺点:异步无返回值,一次只能一个调用。
2. **iframe.src 触发**(URL Scheme 变体):`iframe.src = 'xiaodu://...'`,用 iframe 是为了不让主页面跳转。
3. **`window.prompt` 拦截**(Android 常用):H5 调 `window.prompt('xiaodu://...')`,原生重写 WebView 的 `onJsPrompt` 拦截。
4. **注入原生对象**(现代主流):
   - **Android**:`webView.addJavascriptInterface(new NativeBridge(), 'AndroidBridge')`,H5 里 `window.AndroidBridge.share(...)` 直接调
   - **iOS(WKWebView)**:`WKUserContentController.add(handler, name: 'iosBridge')`,H5 里 `window.webkit.messageHandlers.iosBridge.postMessage({...})` 调,回调通过 `evaluateJavaScript` 反向注入

**原生调 H5**(反向):
- `webView.evaluateJavascript('window.somefn(data)', null)`(Android)
- `webView.evaluateJavaScript("window.somefn(...)")`(iOS)
- 需要 H5 提前挂 `window.somefn`

#### ③ 统一 jsBridge 封装
业界通用做法:封装一层,前端不管 iOS/Android 差异,统一调 `bridge.call('share', {...})`。

伪代码:
```js
class JSBridge {
  callbacks = new Map();
  callId = 0;
  
  call(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.callId;
      this.callbacks.set(id, { resolve, reject });
      
      const payload = { id, method, params };
      
      if (isIOS) {
        window.webkit.messageHandlers.iosBridge.postMessage(payload);
      } else if (isAndroid) {
        window.AndroidBridge.call(JSON.stringify(payload));
      }
    });
  }
  
  // 原生调用来触发回调
  _onNativeCallback(id, data, error) {
    const cb = this.callbacks.get(id);
    if (!cb) return;
    error ? cb.reject(error) : cb.resolve(data);
    this.callbacks.delete(id);
  }
}
```
关键点:**用 callId 关联请求和响应**,因为通信是异步的。

#### ④ 分享的原生实现
- **微信分享**:原生集成微信 SDK,jsBridge 收到"分享"指令 → 调 `WXApi.sendReq(...)`
- **微博/QQ**:同理,各自 SDK
- **系统分享**:iOS `UIActivityViewController`,Android `Intent.ACTION_SEND`

前端只管调 `bridge.call('share', { title, desc, imageUrl, link })`,不管落地渠道。

#### ⑤ 百度统计 API
- **是什么**:百度自家的 Web 分析,类似 Google Analytics 的国内版
- **接入方式**:
  1. HTML 里嵌一段 SDK 脚本(异步加载)
  2. 页面浏览自动上报
  3. 自定义事件:`_hmt.push(['_trackEvent', 'category', 'action', 'label', value])`
- **面试冷问**:"百度统计怎么保证请求不丢?" → 用 1x1 图片 `<img src="https://hm.baidu.com/hm.gif?..." />` 而不是 XHR,因为图片请求不受 CORS 限制,且 unload 时也能发出去(有些浏览器优化,更好是用 `navigator.sendBeacon`)

### 实现原理

#### WKWebView vs UIWebView 的关键区别
- **进程模型**:WKWebView 独立进程(隔离,崩了不影响 App),UIWebView 在 App 主进程
- **JS 引擎**:WKWebView 用 Nitro(Safari 同款,快),UIWebView 用受限 JavaScriptCore(慢)
- **iOS 8+ 后大厂都迁到 WKWebView**

#### URL Scheme 的坑
- **iOS**:`window.location.href = 'xiaodu://...'` 会触发页面跳转,如果 scheme 没注册会白屏。所以用 iframe 隔离
- **连续调用会丢**:两次快速调用 URL Scheme,原生可能只收到一次。要用队列 + 延迟

### 你当时大概是怎么做的

1. Vue 2 项目结构,路由 vue-router,状态 vuex
2. 封装 `utils/bridge.js`,统一 iOS/Android 差异
3. UA 检测:`navigator.userAgent` 里判 iOS/Android
4. 页面里 `import bridge from '@/utils/bridge'`,调 `bridge.call('share', {...})`
5. 设备详情页:调 `bridge.call('getDeviceList')` 拿设备列表 → 渲染
6. 百度统计:main.js 里加载 SDK,mixin 里在 `mounted` 时上报 pageview,业务点用 `_hmt.push` 打事件

### 面试预期追问

- **iOS 和 Android 的 bridge 实现差在哪?**
  → 见上面 ②,iOS 用 `messageHandlers`,Android 用 `addJavascriptInterface`。都是双向异步。
- **jsBridge 调用为什么要用 Promise?**
  → 原生 → H5 的回调是异步的,如果不用 Promise 就得回调地狱。用 callId + Promise 让 H5 侧看起来是"同步调用"。
- **H5 页面在原生 App 里性能不好怎么优化?**
  → ① 离线包(原生预置 H5 资源,不走网络)。② 预加载 WebView(App 启动就 warm up)。③ 首屏 SSR / SSG。④ 关键资源内联(减少请求数)。⑤ 精简依赖。
- **AndroidBridge 有什么安全风险?**
  → `addJavascriptInterface` 在 API < 17 时有 RCE 漏洞(反射调用任意 Java 方法)。17+ 加了 `@JavascriptInterface` 注解要求。建议只暴露必要的方法,输入严格校验。
- **怎么处理 iOS 和 Android 上不一致的行为?**
  → bridge 层统一 API,内部按平台分发。业务层不感知平台差异。特别情况(如 iOS 键盘弹起页面被挤压)加平台特定的 fix。

---


## 面试前 Checklist(这三条)

> 虚拟列表和 Webpack 的 checklist 在各自那篇里,不在这。

### 必须能画出来
- [ ] jsBridge 双向通信:H5 ↔ WebView ↔ 原生

### 必须能背下来
- [ ] `npm ci` 用于 CI,`npm install` 用于本地
- [ ] `^` 允许 minor + patch,`~` 只 patch
- [ ] Semver 里 MINOR 理论兼容但实际经常被破坏

### 必须能开口就讲(每个 30 秒简述)
- [ ] 那次白屏事故你怎么定位的?(Sentry → sourcemap → git diff → lock file → 依赖 changelog)
