---
title: 复习总纲
section: 总览
icon: map
day: 0
level: -
status: done
---

# 简历面试复习总纲

对应简历 **v66**。bullet 总数 **20**：Beyz 3、BioMap 4、Baidu 5、WinterFell 5、Periplus 3。

笔记仍是 22 篇：Beyz ①② 现在合并成简历上的第一条，Periplus ⑤ 证据与判断分离已不在简历上——两处都留着，因为面试官照样会问。

## 推进顺序

| Day | 主题 | 级别 |
|---|---|---|
| 1 | 数字口径审计（必须最先做完） | 前置 |
| 2 | Beyz ① 实时 interview copilot | S |
| 3 | Beyz ② 凭证、状态机与用量 | S |
| 4 | Beyz ③ Stripe + ④ 服务/部署/CI | A |
| 5 | BioMap 全部四条 | B |
| 6 | Baidu ⑤ H5/JSBridge + ④ 提现 + ② Webpack | A |
| 7 | Baidu ① 虚拟列表 + ③ 生产白屏 | S |
| 8 | Periplus ① 六阶段与 typed contract | S |
| 9 | Periplus ⑤ 证据与裁决 | S |
| 10 | Periplus ② 持久化/resume + ③ scripted seam | S |
| 11 | Periplus ④ golden set 与 evals | S |
| 12 | WinterFell 四条 | B |
| 13 | 技能栏 Angular / Go / Django | A |
| 14 | 全份模拟面试 | — |

第一列是**推进顺序**，对应站内每篇笔记的 Day 标签，不是日历天数。有整块时间就往前赶，没有就按序号推。

## 相对 v1 的四处结构性修改

1. **数字口径审计从最后提到最前** —— 口径答不住会改简历措辞，改完再练才不返工。
2. **新增 Day 13 技能栏专项** —— 简历 Skills 行写着 Angular / Go / Django，v1 排期里一个字没提。
3. **Day 8–12 先读代码再写讲法** —— Periplus 和 WinterFell 的源码就在本机，凭记忆重建是面试翻车的主因。
4. **Periplus 从 3 段加到 4 段，BioMap 从 2 段压到 1 段** —— 按 S/A/B 分级重新分配。

## 优先级（时间不够时按这个砍）

**S 级**：Periplus 全部五条 · Beyz 实时 pipeline · Beyz 凭证与状态机 · 百度虚拟列表 · 百度白屏

**A 级**：Stripe entitlement · NestJS 服务与 CI/部署 · TanStack Query 与 LCP · React 架构边界 · Webpack 迁移 · 提现幂等 · 技能栏 Angular/Go/Django

**B 级**：LIMS/Luckysheet/脚手架 · 设计系统/Storybook/MSW · H5/JSBridge · WinterFell 四条

主投 AI Engineer / Full-stack AI 的话，时间往 **Periplus + Beyz** 压。WinterFell 用来证明底层性能分析能力，不该抢核心定位——但它那四条是**自己拿工具量出来的**，可信度最高，别讲成 B 级的敷衍版。
