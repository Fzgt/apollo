---
title: "③ P2 白屏事故"
tier: must
section: 百度
icon: landmark
day: 7
level: A
status: done
---

# ③ P2 白屏事故

> **简历原句**
>
> **First to diagnose a P2 white screen** on Haokan Video's search page (**30M+ DAU**): **mismatched Node versions regenerated package-lock.json**, pulling a **breaking minor bump** — **version locks and release checks followed**.
>
> ---
>
> 第一个定位出好看视频搜索页（3000 万+ DAU）P2 白屏事故的根因：Node 版本不一致导致 package-lock.json 被重新生成，放进来一个带破坏性改动的小版本升级 —— 随后落地了版本锁定与发布前检查。

## 先把词说清

**semver（Semantic Versioning，语义化版本）**：版本号读作 **主版本.次版本.修订号（major.minor.patch）**。**major 变 = 有破坏性改动；minor 变 = 加了功能但兼容；patch 变 = 只修 bug。**

**`package.json` 里写的不是一个版本，是一个允许范围：**

```jsonc
{
  "lodash": "4.17.21",    // 锁死，只装这一个
  "lodash": "~4.17.21",   // tilde（波浪号）：只放行 patch → 4.17.x
  "lodash": "^4.17.21"    // caret（尖号）：放行 minor → 4.x.x  ← npm 默认给你写这个
}
```

**尖号是这次事故的起点**：它赌的是 minor 一定兼容，**而这个赌注每年都有人输**。库作者认为是「加功能」的改动，**在你的用法下就是破坏性的**。

**lockfile（锁文件，`package-lock.json`）**：`package.json` 写的是范围，**锁文件写的是上次实际装的那一个确切版本**，连它的依赖的依赖也一起钉死。**它存在的全部意义就是 reproducible build（可复现构建）。**

**P2**：事故定级，**数字越小越严重**。定级取决于影响面。

**DAU（Daily Active Users，日活跃用户）**：**产品级指标**，不是你模块的指标。

## 这条要讲清什么

它讲的不是「我修了一个 bug」，是「**我把一个 bug 变成了一类 bug 的终结**」。

**这条 bullet 的价值全在最后半句：版本锁定和发布前检查。**只讲排查过程会浪费掉它——**表面看是某个库出了问题，实际是我们的锁文件根本没锁住**，而后者会以**任何一个依赖**的形式再来一次。

## 为什么 Node 版本不一致会把锁文件搞坏

**这是整条链的关键一环。**

锁文件里有个 **`lockfileVersion` 字段，它的格式随 npm 大版本变**；而 **npm 版本是跟着 Node 版本走的**，装 Node 就带一个 npm。

于是链条是这样：

```
某人的 Node 版本 ≠ 团队版本
  → 他的 npm 版本也不同
  → npm 看到一个 lockfileVersion 对不上的锁文件
  → 按自己的规则「重新生成」一份
  → 重新生成时去 registry 拿符合 ^ 范围的最新版本
  → 那个最新版本带了破坏性改动
  → 上线白屏
```

**关键一环是「重新生成」：锁文件不是被人手动改的，是被工具在他毫不知情的情况下重写的。**

**这也是为什么修法的第一条是锁 Node 版本——不锁住 Node，就锁不住 npm，就锁不住锁文件。**

## `npm ci` 和 `npm install` 的区别

- **`npm install`** 可以**修改**锁文件：发现 `package.json` 和锁文件对不上时会**更新锁文件**。
- **`npm ci`** **只读**锁文件，对不上就**直接报错退出**，而且会**先删掉整个 `node_modules` 从头装**。

**CI 里必须用 `npm ci`，名字里那两个字母就是 Continuous Integration 的意思。用 `install` 等于允许 CI 悄悄改变依赖版本。**

## 排查过程怎么组织

用 **观察 → 假设 → 验证 → 修复 → 预防** 五步讲，**重点在最后两步的分离**。

**观察**：搜索页白屏，控制台报错指向某个第三方库的一个方法不存在。

**假设**：表层假设是那个库有 bug，或者我们用错了接口。**但发布内容里没人动过它**——**这一步的关键是注意到症状和这次改动对不上。这是整个排查最有价值的一个动作，讲的时候要突出。**

**验证**：对比发布前后 `node_modules` 里实际装的版本，发现它悄悄涨了一个 minor；再往上追，**锁文件在那次提交里被整体重写了**。

**修复**：回滚锁文件，锁死那个依赖的版本。**这一步让这次好。**

**预防**：锁 Node 版本，CI 改用 `npm ci`，加发布前的预发布验证。**这一步让这类不再来。**

**修复和预防的分离是这条 bullet 的骨架。**面试里讲完修复一定要继续讲预防，否则这就只是一个「我会看报错」的故事。

## 「第一个定位到」怎么讲才不虚

**`First to diagnose` 是个强声明，会被追。**

**答法是**：当时还有别人在查，**我是最先把根因指到「锁文件被重新生成」这一层的**。

说清「第一个」指的是**定位到根因**，不是第一个发现故障——**这个区分能挡住大多数追问，而且它是诚实的**：发现白屏的通常是监控或者客服，不是开发。

## 预期追问

**为什么本地和测试环境没发现。** 因为出问题的人本地装的就是那个新版本，而它在他的环境下恰好没走到那条崩溃路径，或者他根本没打开那个页面。其他人拉代码之后重新装依赖，才把这个新版本扩散开。

**更本质的答案是：测试环境和生产环境如果不是用同一份锁文件、同一个 Node 版本装出来的，那测试就不构成保证。**这正是预防里那几条要解决的。

**怎么防止下次再发生（这一问就是简历后半句）：**

1. **锁 Node 版本**——`.nvmrc` 文件 + `package.json` 的 `engines` 字段，再在 CI 里校验一次。**不锁 Node 就锁不住 npm。**
2. **CI 改用 `npm ci`**——锁文件和 `package.json` 对不上时**直接报错**，而不是默默改掉。
3. **锁文件本身进 code review**——它平时不该整体重写，**大规模改动必须被人看见**。
4. **发布前用和生产完全一样的构建产物在 staging 跑一遍 smoke test。**
5. **关键依赖从 `^` 改成精确版本或 `~`**，升级走单独的 PR。

**为什么不干脆全部锁死精确版本。** **代价是安全补丁也进不来了。**常见的折中是关键依赖锁死，其余用 `~` 只放行 patch，再配一个自动升级机器人（Renovate / Dependabot）**把升级变成一个个可审查的 PR——让升级发生在你看得见的地方，而不是某个人装依赖的时候。**

## 三千万 DAU 这个数字怎么说

它和虚拟列表那条的 500 万 PV 一样，**是环境不是成果**，但它在这里的作用更明确：**它解释了为什么这是 P2 而不是 P3。**

**答法是**：好看视频是这个量级的产品，搜索页白屏影响面很大，所以定级是 P2；**这个数字我是从产品侧公开口径知道的，不是我测的。**

**注意 DAU 是产品级指标，和你负责的模块不是一回事，别让它听起来像「我的页面有三千万 DAU」。**

## 30 秒回答

> 好看视频的搜索页在一次发布后白屏，是个 P2 事故。根因链条是四层：有人本地的 Node 版本和团队不一致，他的 npm 版本跟着不同，装依赖时 package-lock.json 被重新生成了，锁文件里某个依赖的版本被 caret 范围放行到了一个带破坏性改动的新 minor 版本，上线就炸。表面看是某个库出了问题，实际是我们的锁文件根本没锁住。所以修完之后做的不是改那一个依赖，是锁 Node 版本、CI 里改用 npm ci、加发布前的 staging 验证——因为同样的机制会以任何一个依赖的形式再来一次。

## 英文怎么说

**最容易说错的三处。**「第一个定位到根因」说 **I was the first to trace it to the lockfile being regenerated**——用 **trace it to**，并强调是 **root cause** 而不是第一个发现故障。「锁文件被工具在他不知情的情况下重写」说 **the tool rewrote it without him realising**。**修这一次和消除这一类要分开说**：**the fix made this one go away; the version locks and release checks made the class of bug go away**。

**术语对照**：白屏 white screen ／ 事故定级 a P2 incident ／ 语义化版本 semantic versioning (semver) ／ 尖号 caret ／ 波浪号 tilde ／ 破坏性的小版本升级 a breaking minor bump ／ 锁文件 lockfile ／ 被重新生成 regenerated ／ 可复现构建 reproducible build ／ 版本锁定 version pinning ／ 预发布环境 staging ／ 冒烟测试 smoke test ／ 根因 root cause ／ 复现 reproduce ／ 回滚 roll back ／ 事后复盘 postmortem ／ 自动升级 PR automated dependency PRs。

## 自检

1. 能否说清 `^` 和 `~` 各放行什么？
2. 能否讲出「Node 版本 → npm 版本 → lockfileVersion 对不上 → 锁文件被重写」这条链的每一环？
3. 能否说出 `npm ci` 和 `npm install` 的区别，以及为什么 CI 必须用前者？
4. 能否把修复和预防分开讲，并说出预防的五条？
5. 能否把「第一个」限定成定位到根因，而不是第一个发现故障？
6. 能否说清三千万 DAU 是产品级指标，作用是解释事故定级？
