---
title: 项目走查
section: WinterFell
icon: gamepad-2
---

# WinterFell 项目学习笔记(对齐简历 v66 五条 bullet)

> 仓库:`~/Desktop/projects/github/CG-WinterFell`,remote `git@github.com:Fzgt/CG-WinterFell.git`,线上 https://cg-winter-fell.vercel.app
> 栈:React 19 + @react-three/fiber v9 + three r0.174(`three/webgpu` 入口) + WebGPU + cannon-es + Zustand + TypeScript + Vite
> 简历版本对齐:**v66**(2026-08-27)。**WinterFell 在 v66 提到了 Periplus 前面,并多了一条开场 bullet**(「这是个什么游戏」——二十个场景、按飞行距离实时生成、每局换种子),对应本文第 0 节。原来的四条仍在,但全部改写成了大白话。
> **v66 撤下的三处**:三角形涨 2.6×、「不低于 15 单位」、随机散布对照组,以及 TSL / WebGPURenderer / program key 这些术语。**数字和术语都仍要会答**,下面各节原样保留。
> 历史:v28 修正过 draw call 129→76 与 15 单位;v27 印的 175→32 与 14 units 都是错的,详见第 2、3 节。
> 本文是"项目走查":文件路径 + 具体机制 + 预期追问。通用图形学概念在 `../concepts/LEARNING_NOTES_WINTERFELL_GRAPHICS_CONCEPTS.md`。

---

## 0. 三十秒讲清这个项目是什么

**简历原文(v66 新增的开场条):** *Built a browser racing game: steer a craft through fields of neon obstacles across twenty scenes, with the terrain, skyline and obstacles all generated on the fly from how far you have traveled, on a fresh seed each run.*

浏览器里的第三人称竞速/闪避游戏。**一条线性路线,不是循环**:20 个场景,每段 1800 单位,全程约 3.5 公里,速度只随关卡爬升一次,终点是 UTS 前庭,飞行器停下。分数是存活距离(米)。

一句必须记住的事实:**仓库里没有任何模型、贴图、音频资源文件**。天际线、鲸、涡轮、路标字母全是运行时用几何体拼的,声音全部由 Web Audio 振荡器合成(`src/utils/audio.ts`)。被问"美术资源哪来的",答案是"没有美术资源,全是代码生成"——这句本身就是加分项。

三人团队,你负责渲染管线、性能与关卡生成这条主线。

---

## 1. Bullet 1 — 一个渲染器,两个后端

**简历原文(v66):** *Made the neon glow work on machines without WebGPU: it is built on the newer three.js node pipeline, so one renderer drives WebGPU where the browser has it and falls back to WebGL2 where it does not.*

> v28 原文（术语版，被追问时按这个深度讲）：*Built the bloom pass on three.js’s TSL node pipeline, which a classic WebGLRenderer cannot execute…*

### 代码出处

- `src/components/PostFX.tsx` — bloom 本体。关键三行 import:
  ```
  import { PostProcessing } from 'three/webgpu';
  import { pass } from 'three/tsl';
  import { bloom } from 'three/addons/tsl/display/BloomNode.js';
  ```
- `src/Game.tsx:198-220` — 渲染器创建;`src/hooks/useWebGPURenderer.ts` — `useWebGPUSupport()` 探测。

### 讲清楚这条的逻辑链(顺序不能乱)

1. **霓虹世界靠的是辉光,不是自发光材质本身。** emissive 材质单独看是平的,让它"发光"的是 bloom 后处理。所以 bloom 不是锦上添花,是这个项目的视觉主体。
2. **常规做法是 `postprocessing` 这个包,但它是 WebGL-only。** 走那条路,WebGPU 后端就没有 bloom。
3. **所以 bloom 建在 three 自己的 TSL 节点管线上**(`pass()` 取场景 pass,`bloom()` 叠加,`PostProcessing.outputNode` 输出)。TSL = Three.js Shading Language,是节点式着色器描述,由 three 在运行时编译成 WGSL 或 GLSL。
4. **代价:传统 `WebGLRenderer` 执行不了节点管线。** 于是不做"两个渲染器分支",而是**统一用 `WebGPURenderer`**,靠它的 `forceWebGL` 参数选后端:
   ```
   const renderer = new WebGPURenderer({ forceWebGL: !isWebGPUSupported, ... });
   ```
   有 WebGPU 走 WebGPU,没有走 WebGPURenderer 自带的 **WebGL2 后端**。同一份节点图,两个后端都能编译。
5. **结论句(简历那半句的意思):** 降级降的是后端,不是画面。传统方案的降级会**悄悄丢掉 bloom**,用户看到的是一个失了神的场景却没有任何报错。

### 还要知道的一个细节

`PostFX` 用了 **render priority > 0**。在 r3f 里这意味着接管渲染:r3f 不再自己调 `gl.render`,屏幕上的是合成后的 pass。被问"后处理怎么接进 r3f 的",答这个。

### 预期追问

- **"WebGPU 相比 WebGL2 到底快在哪?"** → 命令缓冲与显式管线状态对象,driver 端的验证与状态切换开销小得多;计算着色器是原生的。但**这个项目在桌面 GPU 上两个后端都被合成器封顶(~120fps),FPS 分不出来**——如实说,这比编一个"快 30%"强得多。
- **"为什么不直接判断支持 WebGPU 就用 A 渲染器,不支持用 B?"** → 那要维护两套后处理实现,并且 WebGL 那套必然没有 TSL bloom。一个渲染器双后端的维护成本低一个数量级。
- **"TSL 是什么?"** → 见 concepts 笔记第 2 节。
- **"怎么测的降级路径?"** → URL flag `?renderer=webgl` 强制走 fallback,`bench/run.mjs` 里 WebGPU/WebGL × 实例化开关 = 四组对照。

---

## 2. Bullet 2 — 实例化障碍,以及它的代价

**简历原文(v66):** *Cut draw calls from 129 to 76 by collapsing each obstacle field into two instanced meshes, measured frame by frame in a headless Chromium harness: the cost is that off-screen obstacles can no longer be skipped one by one.*

> ⚠️ **v66 把「triangles submitted up 2.6×」撤下了**，代价那半句改成了大白话。**2.6 倍仍要会答**——一说 draw call 降了，「那代价呢」必然跟着来。

### 代码出处

- `src/components/ObstacleSection.tsx` — 两个 `instancedMesh`(body + 亮边框 frame),`setMatrixAt(i, ...)` 共享同一套 dummy 矩阵。
- `src/components/ObstacleField.tsx` — 三段 live section 的调度。
- `bench/run.mjs` — 无头 Chromium 逐帧采样 `renderer.info`(draw call / 三角形数),四组场景对照。

### ⚠️ 数字已订正(2026-08-17 实测,v28 已改)

**v27 印的 "175 to 32" 是错的,v28 已换成实测值。** 当天 `npm run dev` + `node bench/run.mjs` 实跑,四组对照的结果是:

| 场景 | 后端 | draw call | 三角形 |
|---|---|---|---|
| WebGPU + instancing | WebGPU | **76** | 69,112 |
| WebGPU, no instancing | WebGPU | **129** | 26,230 |
| WebGL + instancing | WebGPU(WebGL2 后端) | 76 | 67,838 |
| WebGL, no instancing | 同上 | 126 | 26,198 |

**真实数字:129 → 76,约 1.7 倍。** 20 秒连续游玩窗口里 draw call 在 **67–81** 之间浮动(几何体恒定 49、贴图 27),说明分段回收是有效的——成本不随距离增长。

**而且 bench 自己把取舍量化了,这比 draw call 数字值钱得多:** 三角形提交量 **26,230 → 69,112,涨了 2.6 倍**。单独的 mesh 是逐个视锥剔除的,`InstancedMesh` 是一个对象,只要有一部分在屏幕内整段都要提交。**面试就报这两组数:draw call 降 1.7 倍,三角形涨 2.6 倍,这个 scene 在桌面 GPU 上根本不是 draw-call bound。** 这句话说完,你就从"我会用 instancing"变成"我知道它在这个场景里其实没赚到"。

### 必须由你主动说出口的那句取舍

> **一个 `InstancedMesh` 只有一个包围体。** 逐实例视锥剔除因此消失,提交给 GPU 的几何体反而变多。它换来的是 draw call 数量,不是"全面更快"。

README 第 75 行原话也是这个意思。**这句话不要等面试官挖出来**——主动说,它把"我会用 API"抬成"我知道这个 API 的代价"。

### 代码里两条容易被追问的实现细节

1. **为什么用 `useLayoutEffect` 而不是 `useEffect` 写矩阵?**(`ObstacleSection.tsx:56` 注释)→ `InstancedMesh` 创建时矩阵是空的,如果第一帧渲染跑在写矩阵之前,会闪一帧错误位置。
2. **为什么 `frustumCulled={false}`?**(同文件 125 行注释)→ `InstancedMesh` 第一次被剔除测试时才从实例矩阵算包围球**并缓存**;如果这个测试抢在写矩阵的 effect 前面,包围球就是原点上的一个点,整段障碍在相机飞过去的瞬间被剔掉——**障碍闪一下就永久消失**。三段 live section 本来就一直在相机附近,关掉剔除是正确的。
   > 这是全项目最好回答的一道"你踩过什么坑"——症状(障碍闪没了)、根因(包围球缓存时序)、修复(关剔除)、以及为什么关掉是安全的,四样齐全。

### 预期追问

- **"129 和 76 分别是整帧还是只障碍?"** → 整帧渲染器统计,含地面、天际线、飞行器等。
- **"为什么是两个 InstancedMesh 不是一个?"** → body 和亮边框材质不同(边框是发光的,吃 bloom)。材质不同就必须分开,但矩阵可以共享一套。
- **"三段 live section 怎么回收的?"** → `src/utils/obstacleRegistry.ts` 的 publish/get/release,按 section index 生成而不是全量存储。

---

## 3. Bullet 3 — 公平性是量出来的,不是玩出来的

**简历原文(v66):** *Checked the level generator by machine rather than by playing it: across 1,020 generated layouts, every step tested against how far the craft can move sideways at that stage’s speed, every layout had a way through.*

> ⚠️ **v66 把「no gap narrower than 15 units」和随机散布对照组一起撤下了**。两处仍要会答：「走得通」凭什么判定，答案就是那个阈值；对照组是「这个扫描有没有区分力」的答案。

### 代码出处

- `bench/fairness.mjs` — 通过 **Vite dev server 导入真实生成器**(不是复制一份逻辑),逐 section 步进检验。默认 `--sections 12 --trials 40`;简历那 1,020 个布局 = `--sections 20 --trials 51`。
- `src/utils/generateObstacles.ts` — 生成器本体(`generateSectionObstacles`、`laneAt`、`reseedRoute`)。
- `src/config/levels.ts`、`src/config/obstacles.ts` — 速度与密度参数。

### ⚠️ 数字已订正(2026-08-17 实测,跑了两遍,v28 已改)

- **"零个无路可走"—— 成立。** 每一段每一次抽样的 "Layouts with no way through" 都是 **0%**,报告末尾原话:*"Every layout sampled had a continuous path through it."* 这条放心说。
- **"最窄缝隙 14 units" 是错的,而且是看错了列。** 实测每段的 **Tightest gap 在 15–20 units 之间**(两轮的全局最小值分别是 15 和 16)。14 出现在**另一列** "Things in view / how wide" —— 那是"视野内障碍多宽",不是缝隙。
  → **正确说法:任何一段的最窄缝隙都没有低于 15 个世界单位。** 生成是随机的,每次跑数字会小幅浮动,所以**别报一个精确到个位的死数**,报"不低于 15"。
- **1,020 这个数要加一句限定。** 20×51 = 1020 没错,但**最后三段(17/18/19)是终点区,障碍数为 0**,所以真正有内容的布局是 17×51 = **867** 段。被追问就直说,这比被人算出来强。
- **随机对照组成立且有分辨力:** 平均"不碰操作可直飞"的距离 **1336 units,对照组 1226 units**;对照组还会掷出 121 units 宽的直通道(等于整段自己飞完)。

### 为什么必须是"量",不能靠试玩

`bench/fairness.mjs` 开头的注释就是答案,背下来:**无头 Chromium 里 WebGL 退化成软件光栅,一帧几秒**,跑起来要么爬要么(在加上 delta 钳制之前)直接把玩家瞬移穿过障碍场。所以**能不能通关是布局的属性,不是渲染器的属性**——直接测布局。

### 判据是什么

每一步问一句:以**该关卡速度**下飞行器的**横向可达距离**,还能不能落到一个安全位置。不是"有没有缝",是"够不够得着那条缝"。对照组是随机撒布的布局,用来证明"零死局"不是因为判据太松。

### 路线生成的四条硬规则(值得单独记,这是设计能力的证据)

1. 保证存在一条贯穿全程的通道,且这条通道的横移速率不超过该速度下飞行器能跟上的量。
2. 通道宽度对着**可视距离**解,不是对着分段解——否则会出现"看得见时已经来不及"。
3. 密度按**飞行时间预算**(38–76 块/秒)算,不是按距离算——速度上去后按距离算会突然变密。
4. 高度用宽度买(`width × height ≤ 1.05` 基础块),所以生成器不会掷出一堵横在地平线上的墙。

### 预期追问

- **"units 是什么单位?"** → 世界单位,与 1800/段、3.5km 全程同一坐标系。
- **"随机对照组的结果是什么?"** → 同样的方块数、同样的地面,随机撒:可直飞距离从 1336 掉到 1226,而且会掷出 121 units 宽的直通道——**对照组的意义就是证明判据有分辨力**,不是陪跑。
- **"为什么从 dev server 导入生成器而不是把逻辑抄进 bench?"** → 抄一份就会漂移,测的是副本不是产品代码。

---

## 4. Bullet 4 — 雾与 program key:一次整帧卡死

**简历原文(v66):** *Traced a freeze on every color change to the fog: rebuilding it as a new object made every material in the scene recompile its shader in one frame. Reusing one fog object and setting its color removed it.*

> ⚠️ **v66 撤下了「fog 属于材质的 program key」和那个统计每帧新建管线数的探针**。探针是这条唯一的证据来源，被追问「你怎么确认是重编译」时必须拿它出来。

**这是全篇最好的一条 debug 故事,而且是多数前端不知道的知识点。面试前把它讲顺。**

### 代码出处

`src/Game.tsx:112-129` 的 `LevelFog`,以及 `Game.tsx:233` 的调用点。修复后的形态:

```tsx
const LevelFog = ({ color }: { color: string }) => {
    const scene = useThree(state => state.scene);
    const fog = useRef<Fog | null>(null);
    useEffect(() => {
        if (!fog.current) fog.current = new Fog(color, 300, 1000);
        scene.fog = fog.current;
        return () => { if (scene.fog === fog.current) scene.fog = null; };
    }, [scene, color]);
    useEffect(() => { fog.current?.color.set(color); }, [color]);
    return null;
};
```

**一个 Fog 对象活到底,换色只 `color.set()`。**

### 四段式讲法(症状 → 根因 → 验证 → 修复)

1. **症状:** 卡顿精确落在场景切换点(换配色的那一帧)。画面停在旧配色上不动,而 HUD 的计数还在往前走——所以它不是"逻辑卡住",是渲染线程被占满。
2. **根因:** 原本写成 `<fog args={[color, 300, 1000]} />`。**JSX 属性变了,r3f 就重建这个 Fog 对象**;而 **fog 参与材质的 program key**——它是否存在、是什么类型,决定了着色器要编译出哪一份变体。换掉 Fog 对象 = 场景内**所有材质**的 program key 失效 = 全部在**同一帧内**重新编译。
3. **验证:** `bench/pipelines.mjs` 包住 device 的管线创建,**逐帧统计新建管线数**并对上帧时长。卡的那一帧管线新建数暴涨——直接锤死是着色器编译,不是别的。
4. **修复:** 单一 Fog 对象,只 mutate 颜色。program key 不变,一份着色器都不用重编。

### 预期追问

- **"什么是 program key?"** → 见 concepts 笔记第 3 节。一句话:three 按材质特性组合缓存编译好的着色器程序,fog/lights/skinning/morph/贴图槽这些都在这把钥匙里。
- **"那颜色变了着色器不用改吗?"** → 不用。颜色是 **uniform**,运行时上传;fog 的**有无与类型**才是编译期分支。这个区分是这条 bullet 的技术核心。
- **"为什么不用 `onBeforeCompile` / 材质预热?"** → 预热(`compileAsync`)能摊平首次编译,但这里的问题是**每次换色都重编一遍**,预热治不了根;根因是对象身份变了。
- **"r3f 里还有哪些属性是这种'一改就重建'的?"** → `args` 数组任一项变化都会重建实例,这是 r3f 的通用规则,不只是 fog。

---

## 5. 被换下去的那条(仍在 README,别当它不存在)

`bench/leak.mjs` 包住 GPU device 统计存活 buffer/texture,抓到**重开残留约 800 个、冷启动 463 个**。根因是 **r3f v9 不再在卸载时自动 dispose**,而这个项目的几何体大多是手搓的。处理方式是**重开改成重载文档,而不是重挂场景——那是绕过,不是修复**,结尾太弱,v27 从简历上换下来了。

**但 README 里还写着。** 如果面试官读了 README 问起来,如实说:定位到了、量化了、当时选了成本最低的规避方案,真正的修复是给自建几何体补 dispose 生命周期。承认这一点比硬圆强。

---

## 6. bench/ 七个脚本各答一个问题(被问"你怎么验证的"就报这个清单)

| 脚本 | 回答的问题 |
|---|---|
| `run.mjs` | 渲染方案的代价:WebGPU/WebGL × 实例化开关四组对照 |
| `leak.mjs` | 重开之后 GPU 资源有没有泄漏 |
| `jank.mjs` | 按距离定位最差帧落在哪 |
| `pipelines.mjs` | 每帧新建了多少管线(= 有没有在编译着色器) |
| `vberror.mjs` | 顶点缓冲相关报错定位 |
| `attrowner.mjs` | 属性归属追踪 |
| `probecost.mjs` | `?perf=1` 这个探针本身会不会改变被测对象 |

全部需要 playwright,且需要先 `npm run dev`。

**URL flag 全是 opt-in:** `?perf=1` `?renderer=webgl` `?instancing=off` `?immortal=1` `?craft=plane`;开发用 `?scenic=1` `?z=`(场景 n 的起点 = (n-1)×1800),代码里用 `DEV ONLY` 注释围起来。

---

## 7. 一条贯穿全项目的判断,单独记

> **帧率被合成器封顶(本机约 120fps),桌面 GPU 上各方案都顶格,所以 FPS 不是有用信号——draw call 和三角形数才是。**

README 第 75 行写了这句。它值钱的地方在于:大多数候选人做完优化就报"FPS 从 X 到 Y",而你能说清**为什么在这个环境里 FPS 根本测不出差别、以及应该改看什么**。这是"会测"和"知道测量本身是否成立"的区别。

---

## 8. 一周复习的最短路径

按性价比排序,不要按文件顺序读:

1. **第 4 节(雾/program key)** — 讲法背顺,这是最强的一条。
2. **第 2 节的两条实现细节** — 包围球缓存时序那个坑,以及必须主动说的剔除取舍。
3. **第 1 节的五步逻辑链** — 顺序讲对就够,不用背 TSL 的 API。
4. **第 3 节的四条路线规则 + "为什么必须量不能玩"**。
5. **第 7 节那句** — 随便哪条性能问题都能拿它收尾。

代码只需要真正打开四个文件:`src/Game.tsx`(LevelFog + 渲染器创建)、`src/components/PostFX.tsx`、`src/components/ObstacleSection.tsx`、`bench/fairness.mjs` 的头部注释。

---

相关:`../concepts/LEARNING_NOTES_WINTERFELL_GRAPHICS_CONCEPTS.md`、`../../periplus/`
