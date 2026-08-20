---
title: "#17 · 1,020 generated layouts"
section: WinterFell · Day 12
icon: gamepad-2
tier: ref
day: 12
level: 前置
status: done
---

# #17 · `1,020 generated layouts`

> **材料说明**：WinterFell 在本机（`~/Desktop/projects/github/CG-WinterFell`），这条能指到行号。
>
> 这条 bullet 讲的是**怎么证明一个随机生成的关卡是可通过的**——一个「程序化生成 + 不可能手工验证」的问题。**技术含量全在那个扫描算法上。**

## 对应简历原句

WinterFell 第 3 条 bullet（v40）：

> **Swept the live generator across 1,020 generated layouts**, testing every step against the craft's lateral reach at that level's speed — every layout had a continuous path through it, no gap narrower than 15 units, against a random-scatter control.

（`15 units` 那半句见 [#20](/docs?section=winterfell&item=n20-gap)。）

---

## 一、这条在解决什么问题

障碍物是**程序化生成**的：每次开局，`generateSectionObstacles(section)` 按噪声和随机种子摆一批方块。

**于是有个要命的问题：你没法保证生成出来的关卡是能过的。**

某一次随机可能刚好摆出一堵横跨整条赛道的墙——玩家撞上去，**死得毫无办法**。这不是「难」，这是 bug。

**怎么验证？**

| 做法 | 为什么不行 |
|---|---|
| 手动试玩 | 每局都是新的随机布局，试一百遍也只覆盖一百个样本，而且你不知道试没试到坏的 |
| headless 里自动试玩 | **这条路被明确否掉了**，见下 |
| **直接分析布局几何** | ✅ 这条 bullet 的做法 |

`bench/fairness.mjs` 的文件头写得很直白：

> Whether a run is winnable is **a property of the layout, not of the renderer**, so this measures the layout directly instead of playtesting.

**关键的心智转换：「这关能不能过」是布局的几何性质，不是游戏运行的结果。** 那就别去跑游戏，直接算几何。

**为什么不 headless 试玩**（同一段注释，值得背下来）：

> Playtesting this in headless Chromium does not work — **WebGL there falls back to software rasterisation**, frames take seconds, and the run either crawls or (before delta clamping) **teleported the player straight through the field**.

**headless 环境没有真 GPU，WebGL 退化成软件光栅化，一帧要几秒。** 而游戏用 `delta` 推进位置，一帧几秒意味着玩家一帧直接穿过整个障碍场——**试玩测出来的结果毫无意义。**

---

## 二、核心算法：区间集合前向扫描（技术重点）

**这是这条 bullet 最值钱的部分。** 它不是「随机试几条路径」，而是**精确地算出「所有能活下来的位置」**。

`bench/fairness.mjs:271-307`：

```js
// 起点：整条赛道宽度都是可达的
let reach = [[-FIELD_WIDTH / 2, FIELD_WIDTH / 2]];

for (let z = startZ; z > endZ && !deadAt; z -= STEP) {
    // ① 生长：这一步前进距离内，飞行器能横向移动多少
    const grow = STEP * reachAt(section);
    reach = reach.map(([a, b]) => [a - grow, b + grow]);

    // ② 挖洞：把这一段里每个障碍物的footprint 从可达区间里减掉
    for (const p of near) { /* 区间被障碍物切成两半 */ }

    // ③ 合并重叠区间
    reach = reach.filter(...).sort(...).reduce(...)
}
```

**三步循环，每前进 `STEP = 10` 个单位做一次：**

| 步骤 | 含义 |
|---|---|
| **① 生长** | 玩家在这 10 个单位的前进距离里，能左右挪多远？每个可达区间向两边扩张这么多 |
| **② 挖洞** | 这一段里的障碍物，把它们的碰撞半径从可达区间里减掉——一个区间可能被切成两个 |
| **③ 合并** | 生长会让相邻区间重叠，不合并的话区间列表会**指数级膨胀**（代码注释专门说明了这一点） |

**如果某一步之后 `reach` 变成空集 → 这个布局无解，玩家必死。**

> **这个算法的漂亮之处**：它一次扫描就回答了「有没有路」，而且回答的是**所有**路径，不是采样几条。**这是从「测试」升级到「证明」。**
>
> 每个区间还有额外含义（`:309-316` 的注释）：**两个区间意味着中间有个必须绕开的障碍，玩家可以选左边或右边**。所以区间**个数**衡量的是「有几条路」——「处处只有一条路是公平的，但那是排队不是赛道」。

---

## 三、`at that level's speed` —— 一个被修过的坑

`reachAt` 是这个扫描的关键输入：**每前进一个单位，飞行器能横向移动多少。**

```js
// fairness.mjs:59-63
const reachAt = section => {
    const z = -section * cfg.SECTION_LENGTH;
    const speed = levels.paletteFor(levels.levelAt(z)).speed;
    return LATERAL_SPEED / (speed * 60);
};
```

**关键在于：这个值随关卡速度变化。**

```
横向能力 = LATERAL_SPEED / 前进速度
```

**前进越快，每前进一米能挪的横向距离越小。** 生成器源码 `generateObstacles.ts:198-202` 的注释给了具体数字：

> 开局速度下飞行器每前进一个单位能横向移动 **0.049**，到第六关只剩 **0.024**——**掉了一半**。

**所以同一个布局，在开局是公平的，到后期可能根本过不去。**

代码注释还记了两次真实的修改（`fairness.mjs:50-57`），**这两条是很好的面试素材**：

1. 最早这里**写死了开局速度**——「quietly validated the late game against reach it does not have」，**用飞行器没有的能力去验证了后期关卡**
2. 后来 `LATERAL_SPEED` 是**抄过来的常量副本**，值 44，而游戏本体已经调到 64——「a copy of a constant is a constant that goes stale」，改成从 `constants.ts` 直接 import

> **第二条特别值得讲**：验证工具抄了一份常量，本体改了它没改，于是**验证工具在用一个不存在的飞行器验证关卡，而且一直是绿的**。这是测试工具本身的静默失效，比测试失败危险得多。

---

## 四、`against a random-scatter control` —— 为什么需要对照组

`fairness.mjs:135-140`：

```js
/** The same blocks, thrown at the same ground with no rules at all. */
const shuffled = (obstacles, startZ, endZ) =>
    obstacles.map(p => ({ r: p.r, x: 随机, z: 随机 }));
```

**同样数量、同样大小的方块，完全随机地撒在同一段赛道上。**

**为什么需要它？** `:106-114` 的注释解释得很好：

> Some x always gets lucky: with eighty blocks spread over a hundred and twenty units of width, a given strip is covered seven times in two thousand units, and **the largest gap among a hundred and twenty such strips is most of a sector by chance alone.**

**翻译**：赛道上总有某条纵线运气好、恰好没被挡住——**这是概率必然，不是布局的功劳**。

所以「有路可走」这件事本身不算成绩，**必须和「同样密度随便撒」比**：

> The control is what this density can do; **the gap between the two is what the layout is adding.**

> **这是个通用的实验思维**：任何「我的算法达到了 X」的声明，都要问「随机基线能达到多少」。**没有对照组的指标，量的是问题的难度，不是解法的质量。**

---

## 五、1,020 这个数怎么来的

**公式很简单：**

```
布局总数 = SECTIONS × TRIALS
```

```js
// fairness.mjs:23-24
const SECTIONS = Number(getArg('sections', 12));
const TRIALS   = Number(getArg('trials', 40));
```

**默认值 12 × 40 = 480。** 所以 1,020 是**带参数跑的**：

```bash
npm run dev
node bench/fairness.mjs --sections 12 --trials 85    # 12 × 85 = 1020
```

（`12 × 85` 是最可能的组合，因为 `--sections` 用了默认值。**这一步是推算，跑之前把当时的参数记下来。**）

**要做的事**：把参数写进笔记，或者干脆重跑一次固定参数的，把命令记牢。**「1,020 是怎么来的」被问到时，答不出参数就很难看——因为这是唯一一个你完全控制的输入。**

**每个 trial 是一次独立的重新播种**（`:260`）：

```js
mod.reseedRoute(section * 7919 + t);
```

注释说明了为什么必须重新播种整条路线，而不是同一条路线多次投骰子：

> The layout's shape — where the lane crosses, where the field thickens — is now the run's seed rather than a constant, so **sampling one seed many times would test one route many times and say nothing about the one the player is actually handed.**

**7919 是个质数**，用来让 section 和 trial 的种子不撞车。

---

## 六、结论是怎么表述的

`fairness.mjs:416-421` 是简历那句话的原始出处：

```js
console.log(
    worst === 0
        ? `\nEvery layout sampled had a continuous path through it.`
        : `\nUp to ${worst}% of layouts had no path through — those runs end in a death the player could not avoid.`,
);
```

**注意 `Every layout sampled`——「所有被采样的布局」，不是「所有可能的布局」。**

简历写的是 `every layout had a continuous path through it`，**省掉了 `sampled`**。严格说这是个从「1020 个样本」到「全部」的推广。

**被追问「你能保证所有随机布局都能过吗」，正确答法是：**

> 「不能保证，这是采样验证不是形式化证明。1020 个布局全部有连续通路，覆盖了 12 个 section 各 85 次独立重播种。要真正保证得对生成器做形式化约束，我们做的是把它变成一个可以在 CI 里反复跑的回归检查。」

**承认是采样，比含糊过去强得多。**

---

## 七、按「审什么」逐条过

| 审什么 | 答案 |
|---|---|
| **数字从哪来** | `SECTIONS × TRIALS`，`bench/fairness.mjs:23-24` |
| **用什么参数跑的** | ⚠️ 默认是 12×40=480，1020 需要显式参数（推测 `--trials 85`）——**跑之前把参数记牢** |
| **怎么测的** | 不是试玩，是几何分析：区间集合前向扫描，`STEP = 10` 单位一次 |
| **能否复现** | ✅ `npm run dev` 起 Vite，然后 `node bench/fairness.mjs --sections N --trials M`。需要 playwright |
| **归因** | **你自己写的工具、自己跑的** ——这条和 [#14/#15](/docs?section=periplus&item=n14-server-tests) 一样是硬证据 |

---

## 八、一句话答法

> 障碍物是程序化生成的，每局布局都不一样，所以「这关能不能过」没法靠试玩验证——而且 headless Chromium 里 WebGL 退化成软件光栅，一帧几秒，玩家会直接穿过整个障碍场。关键是意识到可通过性是布局的几何性质，不是运行结果，所以直接分析几何：从整条赛道宽度出发，每前进十个单位就把可达区间按飞行器在**那一关速度下**的横向能力扩张一次，再减掉这一段障碍物的碰撞半径，区间集合变空就说明这个布局必死。1020 个布局是 section 数乘每 section 的独立重播种次数，全部有连续通路。而且是跟「同样的方块完全随机撒一遍」的对照组比的——因为总有某条纵线碰巧没被挡住，那是概率不是设计，**只有和随机基线的差值才是布局本身的贡献**。
