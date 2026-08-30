---
title: "④ 关卡可通过性扫描"
tier: must
section: WinterFell
icon: gamepad-2
day: 12
level: B
status: done
---

# ④ 关卡可通过性扫描

> **简历原句**
>
> **Checked the level generator by machine rather than by playing it**: across **1,020 generated layouts**, every step tested against **how far the craft can move sideways at that stage’s speed**, **every layout had a way through**.
>
> ---
>
> 关卡生成器交给机器检验，而不是靠试玩：1,020 个生成的布局逐步校验，按该阶段速度下飞行器能横向移动多远来判定 —— 每个布局都存在一条走得通的路。

> ℹ️ **「no gap narrower than 15 units」和随机散布对照组都不在简历上**。两处都仍要会答：15 单位是判定阈值，对照组是「这个扫描到底有没有区分力」的答案。

## 这条 bullet 在讲什么

⭐ **核心是一个心智转换：「这关能不能过」是布局的几何性质，不是游戏运行的结果。那就别去跑游戏，直接算几何。**

**而且它不是「随机试几条路径」，是精确算出「所有能活下来的位置」** —— ⭐ **这是从「测试」升级到「证明」。**

## 一、要解决什么

**障碍物是程序生成的（procedurally generated）**：每次开局，代码按噪声和随机种子摆一批方块。

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

> **`reach`（可达集）= 玩家现在可能待着、并且一路没撞过东西的所有横向位置。**

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

**7919 是个质数（prime）**，用来让不同区段和不同次数的种子不撞车。

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

---

## 七、⚠️ 先破除一个误解：gap 不是障碍物间距

**「gap」很容易被理解成「两个障碍物之间的间距」。不是。**

**它是那个区间扫描算出来的量**（`fairness.mjs:307-308`）：

```js
const widest = reach.reduce((m, [a, b]) => Math.max(m, b - a), 0);
if (widest < tightest) tightest = widest;
```

| 变量 | 含义 |
|---|---|
| `reach` | 当前这一步，**所有还活着的可达区间**（每个区间是一段安全的横向范围） |
| `widest` | **这一步里最宽的那个**可达区间有多宽 |
| `tightest` | 整个区段扫下来，**`widest` 的最小值** |

> ⭐ **所以它的准确含义是：在整条赛道上，「玩家能站的最宽的那块安全地带」最窄的时候，有多宽。**

## 八、为什么先取最大、再取最小

**这是最容易绕晕的一步，走个例子就清楚了。**

假设某一步扫描后是这样：

```
reach = [-60,-51.5]  [-28.5,-11.5]  [+11.5,+60]
          宽 8.5        宽 17          宽 48.5
```

**这一步取最宽的那个（48.5），不是最窄的（8.5）。**

**为什么？因为玩家只需要一条路能走通。** 旁边那个 8.5 的窄缝存不存在无所谓 —— **他可以待在 48.5 那条宽的里面**。所以这一步的「难度」是 48.5。

**然后整段取最小值**：一条赛道扫两千个单位，大部分时候最宽通道可能有 40、50 单位，很宽松。**但某一处收窄到 15** —— **那一处就是这段赛道的难度上限**，因为玩家必须在那里精确操作。

> ⭐ **一句话：它衡量的是「这条路最难走的那一刻，有多难走」。**

## 九、「units」是什么单位

**是游戏世界的坐标单位，不是像素、不是米。**

**给几个同尺度的参照，这些数字能让「15」变得可感知：**

| 量 | 值 | 出处 |
|---|---|---|
| 赛道总宽 | **120** | `FIELD_WIDTH` |
| 一个区段的长度 | **2000** | `SECTION_LENGTH` |
| **一个 2.5 宽的方块的碰撞半径** | **≈ 11.5** | `generateObstacles.ts:511` 的注释 |
| **生成器保证的走廊半宽** | `{ floor: 7, min: 11, max: 18 }` | `LANE_HALF` |
| 横向速度 | 64 | `LATERAL_SPEED` |
| 前向采样步长 | 10 | 扫描里的 `STEP` |
| 雾的可见距离 | ≈ 600 | |

**把 15 放进这个尺度里看**：它**比一个大方块的碰撞半径（11.5）大一点点**，落在**走廊半宽的下限区间（11–18）** 里。

> **所以 15 units 大约是「一个多一点的大方块宽度」的通行空间。挤，但过得去** —— **而这正是难度设计想要的：最紧的时候刚好还有得走。**

## 十、⚠️ 15 不是设定的阈值，是测出来的结果

**这是这条最容易答错的地方。**

**代码里没有任何地方写着「gap 必须 ≥ 15」** —— 没有这个常量，没有这个断言。`tightest` 是从无穷大开始，**被扫描过程中的实际值一路压下来的**。

**所以正确的因果方向是：**

```
❌ 我们设了 15 的下限，生成器满足了它
✅ 扫了 1020 个布局，测出最窄处是 15
```

**被问「为什么定 15 这个阈值」，直接纠正这个前提：**

> 「15 不是我们定的阈值，**是扫描测出来的最坏值**。生成器那边约束的是走廊半宽这些参数，范围是 11 到 18；**15 是这些参数跑出来的布局在最紧处的实测结果。**」

> ⭐ **这个纠正很重要** —— 它把这条从「我们设了个标准」（弱）变成「**我们测出了实际水位**」（强），而且**避免了「那你为什么不设 20」这种没法答的追问**。

## 十一、生成器那一侧真正被约束的是什么

虽然 15 不是阈值，**但生成器确实在保证通行空间**（`generateObstacles.ts:508-516`）：

```js
/**
 * How far this block's centre has to sit from the lane centre.
 *
 * Its own footprint plus the lane, because a 2.5-wide slab carries an 11.5
 * radius: one placed just outside a nominal 15-unit lane reaches most of the
 * way back across it. The lane has to be as wide to fly as it is to look at.
 */
const clearFor = (shape, z) => laneHalfAt(z) + OBSTACLE_BASE_RADIUS * shape.width;
```

**这段注释里藏着一个很好的技术点：**

> 一个 2.5 宽的方块，碰撞半径是 11.5。把它摆在名义 15 宽的走廊**外面一点点**，**它的碰撞体积还是会伸进走廊里，几乎横穿过去。**

**所以「离走廊中心的最小距离」不能只算走廊半宽，必须加上方块自己的碰撞半径** —— 这就是那个加法。

> ⭐ **注释最后一句是题眼**：**「The lane has to be as wide to fly as it is to look at.」—— 走廊「看起来」有多宽，「飞起来」就得有多宽。**
>
> **这是个很典型的碰撞几何 bug**：只按物体中心点做布局，结果碰撞体积把通道吃掉了大半。**玩家看到一条路，撞上去才发现走不了。**

## 十二、⚠️ 关于「飞行器碰撞半径」要主动澄清

**扫描里减掉的是障碍物的半径，飞行器被当成了一个点。**

**这是个可以主动承认的简化：**

> 「扫描里飞行器是个点，减掉的只有障碍物的碰撞半径。**严格讲应该把飞行器半径也加进去**（几何上这叫闵可夫斯基和），**那样测出来的最窄处会比 15 再小一点。所以 15 是个偏乐观的数** —— 不过生成器那边的 `clearFor` 已经在方块和走廊之间留了各自的半径余量，实际游玩没有出现过挤不过去的情况。」

> ⭐ **主动指出自己测量方法的偏向（而且说清偏哪边），是这类数字最有说服力的答法。**

## 十三、这个数字的四个口径

| 问 | 答 |
|---|---|
| **单位含义** | 游戏世界坐标单位。参照：赛道宽 120、大方块碰撞半径 11.5、走廊半宽 11–18、雾距 ~600 |
| **阈值怎么定的** | ⚠️ **它不是阈值，是测出来的最坏值**。代码里没有 15 这个常量或断言 |
| **与飞行器碰撞半径的关系** | ⚠️ **扫描里飞行器是个点**，只减了障碍物半径 —— **所以 15 偏乐观**，主动说明 |
| **怎么测的** | 区间集合前向扫描：每步取最宽可达区间，整段取最小值 |
| **能否复现** | ✅ 起开发服务器 + `node bench/fairness.mjs`，报告表格里那一列 |

## 十四、本篇术语英文对照

| 中文 | 英文 |
|---|---|
| 程序化生成 | **procedural generation** |
| 种子 / 重新播种 | **seed · reseed** |
| 可通过性 | **solvability**（*winnable*） |
| 试玩 | **playtesting** |
| 前向扫描 | **forward sweep** |
| 区间集合 | **interval set** |
| 可达集 | **reachable set / reach** |
| 生长 ↔ 挖洞 ↔ 合并 | **grow · subtract · merge** |
| 空集 | **empty set**（*if reach goes empty, the layout is unwinnable*） |
| 横向可达范围 | **lateral reach** |
| 碰撞半径 | **collision radius** |
| 走廊 / 通道 | **lane · corridor**（半宽 = **half-width**） |
| 缺口 | **gap** |
| 采样 ↔ 穷举证明 | **sampling ↔ formal proof**（⚠️ 我们做的是前者） |
| 对照组 | **control**（*against a random-scatter control*） |
| 随机基线 | **random baseline** |
| 回归检查 | **regression check** |
| 闵可夫斯基和 | **Minkowski sum** |
| 常量副本失效 | ⭐ *a copy of a constant is a constant that goes stale* |

> ⭐ **三个最容易说错的**：
>
> 1. 心智转换那句：**"Whether a run is winnable is a property of the layout, not of the renderer — so measure the layout, don't playtest it."**
> 2. 「对照组」的意义：**the control is what this density can do; the gap between the two is what the layout adds**
> 3. 「这是采样不是证明」要主动说：**this is sampled validation, not a formal guarantee**
