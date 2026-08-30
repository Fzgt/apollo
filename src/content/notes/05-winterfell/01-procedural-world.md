---
title: "① 二十个场景与一次开局的种子"
tier: must
section: WinterFell
icon: gamepad-2
day: 12
level: B
status: done
---

# ① 二十个场景与一次开局的种子

> **简历原句**
>
> Built a browser racing game: steer a craft through **fields of neon obstacles across twenty scenes**, with the **terrain, skyline and obstacles all generated on the fly from how far you have traveled**, on a **fresh seed each run**.
>
> ---
>
> 做了一个浏览器竞速游戏：驾驶飞行器穿过二十个场景里的霓虹障碍场，地形、天际线与障碍全部按已行驶里程实时生成，每局一个新种子。

## 这条要讲清什么

三件事，一句话各一个：**二十个场景**是世界的编排，**「按里程生成」**是这些内容怎么来的，**每局一个新种子**是为什么两局不一样。手工摆场景做不出这个规模，所以全部是 z 的函数。

## 第一层：必须答顺

### 1. "twenty scenes" 是什么？和 level 是一回事吗？

不是。这是**两套独立的进度轴**，都按 1800 世界单位推进：

```ts
// levels.ts —— 只管调色板和速度，6 个循环，跑不完
export const LEVELS: Level[] = [
  { name: 'Signal',  neon: '#00e5ff', accent: '#ffe066', fog: '#04121a' },
  { name: 'Vapour',  neon: '#ff3ea5', accent: '#67ffe0', fog: '#170618' },
  // Circuit / Ember / Toxic / Nova
];
export const LEVEL_DISTANCE = 1800;
export const levelAt = (distance: number) =>
  Math.floor(Math.abs(distance) / LEVEL_DISTANCE);
```

```ts
// scenes.ts —— 管轨道两侧的景，20 个，不循环
export const SCENE_DISTANCE = 1800;

/** No loop: everything past the finale stays the finale's afterglow. */
export const sceneAt = (z: number): SceneSpec =>
  SCENES[Math.min(SCENES.length - 1, Math.floor(Math.abs(z) / SCENE_DISTANCE))];
```

- **Level = 颜色和速度**，6 个循环用，越跑越快，所以这局是无尽的。
- **Scene = 轨道旁边站着什么**：Neon City、Beacon Coast、Abyss Tunnel、Iron Harbor、The Watchers、Aurora Canyon……一直到第 20 个 The Terminus。

关键差别在最后一行：**scene 不循环**。`Math.min` 把索引钉在最后一个，所以跑过终点场景之后，世界停在它的余晖里，不会绕回 Neon City。**level 循环是为了无尽，scene 不循环是为了"你确实走到了尽头"**。

### 2. "generated on the fly from how far you have traveled" 具体指什么？

指世界里几乎所有东西都是 **world z 的函数**，没有预先摆好的关卡文件。

**景**（`Scenery.tsx`）按世界瓦片重建：跨过一个边界就把身后那一公里丢掉，在前方按那一段归属的 scene 建下一块。静态部分合并成少数几个 draw call，活的东西——鱼、鲸、水母、飞艇、踱步的战争机器、涡轮转子、灯塔光束——是小的 instanced mesh，逐帧动。

**障碍**（`generateObstacles.ts`）更彻底。原来是四种命名编队（scatter / gates / slalom / pillars），每 2000 单位换一种。代码注释写了为什么废掉：

> *"Every formation is a surprise exactly once."*

现在没有编队，只有**三个连续函数**，每 `SLICE_DEPTH` 采样一次：

- **lane**：保证能过去的那条通道，摆动速度不超过飞行器在那个速度下能横移的距离
- **pressure**：这一段的密度有多高
- **low/tall balance**：这一段是"看过去"的宽矮块，还是"绕过去"的窄高块

三条都是**周期不同的平滑噪声**，所以它们各自进出相位，没有哪一段像前一段；而且**三条都不知道 section 边界在哪，接缝因此消失**。

### 3. "a fresh seed each run" 解决的是什么问题？

**是 z 的函数，就意味着每局是同一条路。**这是上一版的真实缺陷，注释说得很直：

> *"The blocks moved between runs, because each one is placed with an unseeded roll, but the shape did not: the lane crossed the field at the same z, the knots sat in the same slices, the density peaked in the same places. **A player who dies twice in the same sector is meeting the same sector.**"*

修法是：整个场地挂在**一个整数**上，模块加载时抽一次——也就是每局一次，因为重开会重新加载页面。

```ts
let routeSeed = (Math.random() * 0xffffffff) | 0;

/** Deterministic 0..1 from two integers, and this run's seed. */
const hash2 = (a: number, b: number) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ Math.imul((b ^ routeSeed) + 0x165667b1, 0x27d4eb2f), 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};
```

种子折进**每一条噪声流共用的那个 hash**，一处就把 lane、pressure、低/高配比、护栏和事件全部重新播种。

**为什么用 XOR 折进去**：XOR 是一一映射，**不同的种子折完仍然不同**，所以不会把几条流拉到同一个相位上去。

### 4. 只换种子够不够？

不够，这是这条最值得讲的一层。注释说：

> *"Two draws from the same distribution look alike from inside the cockpit, because the thing the eye reports is the distribution."*

换种子只换到"这局拿到哪些方块"，换不掉"这是哪种路"。**洗过的牌还是同一副牌。**

所以又拿一部分常量当**这局的性格**，每个都是从 run seed 上掷一次、整条路握住不变：

- **periods**：一种风格能持续多长，±40%。有的局几百单位就换一次主意，有的局大半个 sector 只认一个调子
- **the mix**：这条路是宽矮的板，还是细高的塔
- **the corridor**：这局的通道大致偏宽还是偏窄
- **the railing**：多大比例是沿通道成墙，而不是散在四周

「性格」和「排列」的区分，是这条 bullet 真正的技术点。

### 5. 换了种子，公平性保证还成立吗？

成立，而且正是因为这个才要留一个重新播种的入口：

```ts
/**
 * The game never calls this — a restart reloads the page and the module picks
 * its own seed on the way up. It exists so the fairness sweep can walk many
 * routes rather than many rolls of the dice on one route.
 */
export const reseedRoute = (seed?: number) => {
  routeSeed = (seed ?? Math.random() * 0xffffffff) | 0;
  laneSamples.length = 1;
  laneDir = 1;
  laneHold = 0;
  spreads.clear();
};
```

游戏本身从不调它。它存在只为让公平性扫描能**走很多条路**，而不是在同一条路上掷很多次骰子——扫描结论详见 [④ 关卡可通过性扫描](/docs?section=winterfell&item=level-fairness)。

注意最后四行：**所有按 z 记忆化的东西必须跟着清掉**。lane 的采样是从起跑线走出来的，缓存的展度是从那些采样读的，不清就会拿旧路的数据去解释新路。

## 第二层：概念补充

### 为什么不做手工关卡？

二十个场景、无尽的里程，手工摆的成本是线性增长的，而玩家一局只看得到其中一段。函数生成的成本是常数，而且能保证**接缝处是连续的**——手工关卡的边界永远是硬接。代价是可控性变差，所以才需要那套公平性扫描当回归测试。

### 平滑噪声为什么用不同周期？

同周期的几条噪声会同时到峰值，世界就变成"一阵很密、一阵很空"的节拍。周期错开之后，它们进出相位，组合出来的形态不重复——这是用很少的参数拿到"看起来没有规律"的标准做法。

### `Math.min` 那个封顶有什么代价？

跑过第 20 个场景之后，世界不再变化。这是刻意的（"stays in its afterglow"），但意味着**很长的一局后半段视觉是静止的**，只有 level 的调色板还在循环。想继续给变化，要么加场景，要么让 scene 也循环——那就丢掉"终点"这个叙事。

## 30 秒回答

> 这是个浏览器里的竞速游戏：开一台飞行器穿过霓虹障碍场。世界不是手工摆的关卡，是里程的函数——每 1800 单位换一个场景，一共二十个，跑到第二十个之后不循环，世界停在终局的余晖里；调色板和速度是另一条轴，六种循环，越跑越快。障碍场没有预设编队，由三条周期不同的平滑噪声决定：保证能过的通道、这一段的密度、以及这段是宽矮块还是窄高块。因为全是 z 的函数，第一版每局都是同一条路，所以我把整个场地挂在一个每局抽一次的种子上，用 XOR 折进所有噪声流共用的 hash。光换种子只换到方块排列，所以另外拿几个常量当这局的性格——周期长度、板和塔的配比、通道宽窄、成墙比例——让两局是不同的路，而不是同一副牌洗一次。

## 自检

1. 能否说清 level 和 scene 是两条轴，以及为什么一个循环、一个不循环？
2. 能否说出决定障碍场的三条连续函数分别是什么？
3. 能否解释"废掉四种命名编队"的理由（*a surprise exactly once*）？
4. 能否说出种子为什么用 XOR 折进 hash，而不是加？
5. 能否讲清"排列"和"性格"的区别，以及为什么只换种子不够？
6. 能否说出 `reseedRoute` 为什么必须清掉 lane 采样和缓存的展度？
