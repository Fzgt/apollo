---
title: "② TSL 节点管线与双后端"
tier: must
section: WinterFell
icon: gamepad-2
day: 12
level: B
status: done
---

# ② TSL 节点管线与双后端

> **简历原句**
>
> **Made the neon glow work on machines without WebGPU**: it is built on the **newer three.js node pipeline**, so **one renderer drives WebGPU where the browser has it** and **falls back to WebGL2 where it does not**.
>
> ---
>
> 让霓虹辉光在没有 WebGPU 的机器上照样成立：它建在 three.js 较新的节点管线上，所以同一个渲染器在浏览器支持时走 WebGPU，不支持时回退到 WebGL2。

简历这句写的是大白话，术语全收在这篇正文里。TSL、WebGPURenderer、「传统渲染器根本跑不了」这些说法不出现在纸上，但被问到就从这里答。

## 这条要讲清什么

它是「为什么不用现成方案」的最好例子，因为理由是硬的：不是我想自己写，是现成的库在这个渲染器上根本跑不起来。

而更值得讲的是立意那一半。常见做法是检测不到 WebGPU 就退回一个简化版，结果是一部分用户看到的其实是另一个游戏。这套的做法是让回退路径拿到同一个画面。

## 先说什么是辉光

辉光是一种后处理效果：把画面里特别亮的像素晕开，模拟人眼看强光时的光晕。

为什么这个游戏离不开它：霓虹风格的世界里，发光材质本身渲染出来是平的一块亮色，看不出它在发光。周围那圈光晕才是「发光」的视觉信号。所以这不是锦上添花的特效，是这个美术方向能不能成立的前提——讲的时候要先把这句说清楚，否则听起来像是在为一个可选特效做工程。

## 硬理由

常用的那个后处理库只支持 WebGL，而这个游戏是用 WebGPU 渲染器渲染的。两者对不上，不是配置问题，是根本跑不了。

three.js 的 TSL 节点管线能跑：同一套节点在 WebGPU 后端和这个渲染器自带的 WebGL2 回退上都成立。

节点管线是 three.js 较新的着色器写法：你用 JavaScript 把效果描述成一张节点图，three.js 再把它编译成对应后端的着色器语言——WebGPU 用一种，WebGL 用另一种。所以同一份描述能跑在两个后端上，这才是它值钱的地方。

## 一个渲染器，两个后端

实现上是创建 WebGPU 渲染器时传一个强制走 WebGL 的开关，取值就是能力检测的反面：浏览器支持 WebGPU 就走 WebGPU，不支持就让它走自带的 WebGL2 实现。

这里有个说法必须准确：不是 WebGPU 一套代码、WebGL 另一套代码，是同一个渲染器内部切后端。说成两个渲染器就错了，而且错得很显眼。

简历那句「效果在回退路径上照样成立，而不是悄悄降级」是这条的题眼。常见的做法是检测不到就退回一个简化版，结果是一部分用户看到的其实是另一个游戏；这套的做法是让回退路径拿到同一个画面。

## 顺带一个细节

后处理组件把渲染优先级设成大于零，就把渲染权从渲染框架手里接管过来了，框架不再自己调渲染，最终上屏的是合成后的画面。

这是「后处理为什么要设优先级」的答案：后处理必须是最后一步，它要拿到已经渲染好的画面再加工。这个追问不算高频，但它能顺手证明你知道后处理在管线里的位置。

## 英文怎么说

两句最容易说错的。「同一个渲染器内部切后端」说 one renderer with two backends，不要说 two renderers。「效果在回退路径上照样成立」直接用简历原句 the look survives the fallback instead of quietly degrading。

其他常用词：辉光是 bloom，后处理是 post-processing，渲染通道是 pass，节点管线是 node pipeline，着色器是 shader，后端是 backend，回退是 fallback，悄悄降级是 quietly degrade，能力检测是 feature detection，渲染优先级是 render priority，接管渲染是 take over the render loop，合成后的画面是 the composited output，发光材质是 emissive material。

## 30 秒回答

> 这是个霓虹风格的跑酷游戏，发光材质本身渲染出来是平的一块亮色，真正让它亮起来的是周围那圈光晕。问题在于常用的后处理库只支持 WebGL，而我们整个游戏是走 WebGPU 渲染的。所以光晕是用 three.js 的节点管线写的——同一套节点描述，three.js 会把它编译成对应后端的着色器代码，WebGPU 用一种、WebGL2 用另一种。这样没有 WebGPU 的机器拿到的是同一个画面，而不是悄悄丢掉这个效果。

## 自检

1. 能否说清为什么辉光是这个美术方向的前提，而不是可选特效？
2. 能否说出不用现成后处理库的硬理由？
3. 能否解释节点管线为什么能同时支持两个后端？
4. 能否准确说成「一个渲染器两个后端」，而不是两个渲染器？
5. 能否说明后处理为什么要设渲染优先级？
