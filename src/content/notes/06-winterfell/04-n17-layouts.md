---
title: "③ 1,020 generated layouts"
tier: ref
section: WinterFell
icon: gamepad-2
day: 12
level: B
status: done
---

# 怎么证明一关随机生成的关卡能过

> ⚪ **速查**。这条讲的是一个**程序化生成 + 不可能手工验证**的问题，技术含量全在那个扫描算法上。

## 一、要解决什么

**障碍物是程序生成的**：每次开局，代码按噪声和随机种子摆一批方块。

**于是有个要命的问题：你没法保证生成出来的关卡是能过的。**

某一次随机可能刚好摆出一堵横跨整条赛道的墙 —— **玩家撞上去，死得毫无办法**。**这不是「难」，这是 bug。**

**怎么验证？**

| 做法 | 为什么不行 |
|---|---|
| 手动试玩 | 每局都是新的随机布局，**试一百遍也只覆盖一百个样本**，而且你不知道有没有试到坏的 |
| 在无界面浏览器里自动试玩 | **这条路被明确否掉了**，见下 |
| **直接分析布局的几何** | ✅ 这条 bullet 的做法 |

**`bench/fairness.mjs` 的文件头写得很直白：**

> *"Whether a run is winnable is **a property of the layout, not of the renderer**, so this measures the layout directly instead of playtesting."*
>
> （一局能不能赢是**布局的性质，不是渲染器的性质**，所以这个脚本直接测量布局，而不是试玩。）

> ⭐ **关键的心智转换：「这关能不能过」是布局的几何性质，不是游戏运行的结果。那就别去跑游戏，直接算几何。**

**为什么不能自动试玩**（同一段注释，值得背下来）：

> *"Playtesting this in headless Chromium does not work — **WebGL there falls back to software rasterisation**, frames take seconds, and the run either crawls or **teleported the player straight through the field**."*

**翻译**：无界面环境里没有真 GPU，WebGL 退化成**用 CPU 模拟**，一帧要几秒。而游戏是按「距离上一帧过了多久」来推进玩家位置的 —— **一帧几秒意味着玩家一帧直接穿过整个障碍场**。**试玩测出来的结果毫无意义。**

## 二、⭐ 核心算法：区间集合前向扫描

**这是这条 bullet 最值钱的部分。** 它不是「随机试几条路径」，而是**精确算出「所有能活下来的位置」**。

### 先建立画面

赛道宽 120（左右各 60），每个区段长 2000。**从上往下俯视，玩家从下往上飞。**

**扫描沿赛道每前进 10 个单位做一步，每一步维护一个东西：**

> **`reach` = 玩家现在可能待着、并且一路没撞过东西的所有横向位置。**

**它是一组区间**，因为障碍物会把它切开。

### 三步循环（`fairness.mjs:271-307`）

```js
let reach = [[-60, 60]];                    // 起点：整条赛道都能待

for (let z = 起点; z > 终点; z -= 10) {
    // ① 生长：这 10 个单位的前进距离里，飞行器能左右挪多远
    const grow = 10 * reachAt(section);
    reach = reach.map(([a, b]) => [a - grow, b + grow]);

    // ② 挖洞：把这一段里每个障碍物的碰撞半径从可达区间里减掉
    for (const p of near) { /* 区间被切成两半 */ }

    // ③ 合并重叠的区间
    reach = reach.filter(...).sort(...).reduce(...)
}
```

| 步骤 | 在做什么 |
|---|---|
| **① 生长** | 玩家在这 10 个单位里能横向挪多远？**每个可达区间向两边各扩这么多** |
| **② 挖洞** | 这一段里的障碍物，**把它们的碰撞半径从可达区间里减掉** —— 一个区间可能被切成两个 |
| **③ 合并** | 生长会让相邻区间重叠，**不合并的话区间列表会指数级膨胀**（代码注释专门说明了这一点） |

> ⭐ **如果某一步之后 `reach` 变成空集 → 这个布局无解，玩家必死。**

### 走一遍

```
起点          reach = [ -60 ────────────────── +60 ]   宽 120

前进 10       每个区间向两边各扩 0.49（这一步能挪的横向距离）
              然后减掉这一段里障碍物的碰撞半径

              障碍 A 在 x=0，半径 11.5
              reach = [ -60 ─── -11.5 ]  [ +11.5 ─── +60 ]
                          宽 48.5            宽 48.5

再前进        障碍 B 在 x=-40，半径 11.5
              reach = [-60,-51.5]  [-28.5,-11.5]  [+11.5,+60]
                        宽 8.5        宽 17         宽 48.5
```

> ⭐ **这个算法的漂亮之处**：它一次扫描就回答了「有没有路」，**而且回答的是所有路径，不是采样几条。这是从「测试」升级到「证明」。**
>
> **每个区间还有额外含义**（`:309-316` 的注释）：**两个区间意味着中间有个必须绕开的障碍，玩家可以选左边或右边**。所以区间**个数**衡量的是「有几条路」——「**处处只有一条路是公平的，但那是排队不是赛道**」。

## 三、`at that level's speed` —— 一个被修过两次的坑

**`reachAt` 是扫描的关键输入：每前进一个单位，飞行器能横向移动多少。**

```js
// fairness.mjs:59-63
const reachAt = section => {
    const z = -section * cfg.SECTION_LENGTH;
    const speed = levels.paletteFor(levels.levelAt(z)).speed;
    return LATERAL_SPEED / (speed * 60);
};
```

> **公式：横向能力 = 横向速度 ÷ 前进速度。前进越快，每前进一米能挪的横向距离越小。**

**生成器源码的注释给了具体数字**：开局速度下飞行器每前进一个单位能横向移动 **0.049**，到第六关只剩 **0.024** —— **掉了一半**。

> **所以同一个布局，在开局是公平的，到后期可能根本过不去。**

**⭐ 注释里记了两次真实的修改，这两条是很好的面试素材**（`fairness.mjs:50-57`）：

| 曾经的 bug | 后果 |
|---|---|
| 最早这里**写死了开局速度** | *"quietly validated the late game against reach it does not have"* —— **用飞行器没有的能力去验证了后期关卡** |
| 后来 `LATERAL_SPEED` 是**抄过来的常量副本**，值是 44，而游戏本体已经调到 64 | *"a copy of a constant is a constant that goes stale"* —— **验证工具在用一个不存在的飞行器验证关卡，而且一直是绿的** |

> ⭐ **第二条特别值得讲**：验证工具抄了一份常量，本体改了它没改，于是**验证工具本身静默失效了 —— 这比测试失败危险得多**，因为失败会报警，静默失效不会。
>
> **修法是改成从常量文件直接 import。**

## 四、`against a random-scatter control` —— 为什么需要对照组

```js
// fairness.mjs:135-140
/** The same blocks, thrown at the same ground with no rules at all. */
const shuffled = (obstacles, startZ, endZ) =>
    obstacles.map(p => ({ r: p.r, x: 随机, z: 随机 }));
```

**同样数量、同样大小的方块，完全随机地撒在同一段赛道上。**

**为什么需要它**（`:106-114` 的注释解释得很好）：

> *"Some x always gets lucky: with eighty blocks spread over a hundred and twenty units of width, a given strip is covered seven times in two thousand units, and **the largest gap among a hundred and twenty such strips is most of a sector by chance alone.**"*

**翻译**：赛道上**总有某条纵线运气好、恰好没被挡住** —— **这是概率必然，不是布局的功劳**。

**所以「有路可走」这件事本身不算成绩，必须和「同样密度随便撒」比：**

> *"The control is what this density can do; **the gap between the two is what the layout is adding.**"*
>
> （对照组代表这个密度本身能做到什么；**两者的差值才是布局的贡献。**）

> ⭐ **这是个通用的实验思维**：任何「我的算法达到了 X」的声明，都要问「**随机基线能达到多少**」。**没有对照组的指标，量的是问题的难度，不是解法的质量。**

## 五、1,020 这个数怎么来的

**公式很简单：**

```
布局总数 = 区段数 × 每个区段试多少次
```

```js
// fairness.mjs:23-24
const SECTIONS = Number(getArg('sections', 12));
const TRIALS   = Number(getArg('trials', 40));
```

**默认值 12 × 40 = 480。** 所以 1,020 是**带参数跑的**（`12 × 85 = 1020` 是最可能的组合，因为区段数用了默认值）。

⚠️ **跑之前把当时的参数记下来** —— 「1,020 是怎么来的」被问到时答不出参数很难看，**因为这是唯一一个你完全控制的输入**。

**每次试验是一次独立的重新播种**（`:260`）：

```js
mod.reseedRoute(section * 7919 + t);
```

**注释说明了为什么必须重新播种整条路线，而不是同一条路线多试几次：**

> *"sampling one seed many times would test one route many times and **say nothing about the one the player is actually handed**."*

**7919 是个质数**，用来让不同区段和不同次数的种子不撞车。

> ⭐ **顺带回答「失败的随机布局怎么复现」**：**种子是确定的**（`section * 7919 + t`），所以**给定同样的参数，扫描结果完全可复现** —— 第 3 个区段第 17 次试验，永远是同一个布局。

## 六、结论是怎么表述的

`fairness.mjs:416-421` 是简历那句话的原始出处：

```js
worst === 0
  ? `\nEvery layout sampled had a continuous path through it.`
  : `\nUp to ${worst}% of layouts had no path through — those runs end in a death the player could not avoid.`
```

> ⚠️ **注意是 `Every layout sampled`（所有被采样的布局），不是「所有可能的布局」。**

简历写的是 `every layout had a continuous path through it`，**省掉了 `sampled`** —— 严格说这是个从「1020 个样本」到「全部」的推广。

**被追问「你能保证所有随机布局都能过吗」，正确答法是：**

> 「**不能保证，这是采样验证不是形式化证明。** 1020 个布局全部有连续通路，覆盖了 12 个区段各 85 次独立重播种。要真正保证得对生成器做形式化约束 —— **我们做的是把它变成一个可以在 CI 里反复跑的回归检查。**」

**承认是采样，比含糊过去强得多。**
