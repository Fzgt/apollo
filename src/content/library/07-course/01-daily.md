---
title: 今日知识点整理
section: 课程与旧笔记
icon: file-text
---

# 今日知识点整理

## 一、前端性能优化（虚拟列表相关）

- 浏览器渲染流水线：JS → Style → Layout → Paint → Composite，每帧预算16.67ms(60 FPS)
- 虚拟列表原理：数据层(`list`)只增不减，渲染层(`visibleItems`)只保留可视区域附近节点；靠React的`key` diff机制自动挂载/卸载DOM，不需要手写"销毁"逻辑
- 哨兵模式：底部放一个空`div`，配合`IntersectionObserver`触发下一页加载，和虚拟列表是"数据层"与"渲染层"两套独立机制的配合
- 为什么用`translateY`不用`top`：transform只触发Composite(GPU)，top触发完整的Layout+Paint+Composite
- 为什么index能当key：规则的本质是"key要能唯一稳定代表一条数据"，虚拟列表里list只做append、index天然稳定，用index完全正确
- `getBoundingClientRect`强制同步布局：读取几何信息类API会强制浏览器立刻执行积压的布局计算，"写-读"交替是性能陷阱

## 二、Debounce 手写实现

- 核心三要素：`leading`(立即执行)、`trailing`(停止后执行)、`cancel`(主动取消)
- 关键坑点：setTimeout回调执行完必须`timer=null`(否则leading只在整个生命周期生效一次)；leading和trailing要互斥(避免同一次触发执行两次)；cancel要挂在返回的函数上，不是挂在外层工厂函数上
- `clearTimeout`只对"还没到期、未进入宏任务队列"的定时器有效

## 三、并发控制与稳定性

- Promise去重(inFlightMap)：按参数key(如orderId)区分，同一订单去重，不同订单可并发——只在单进程内存中有效
- 幂等性：数据库持久化的幂等key表，能跨设备、跨进程、跨时间兜底，是"零资金损失"的最后一道防线，和inFlightMap是分层防御关系
- 排队/限流：虚拟排队、客户端抖动延迟、指数退避重试，本质是把并发请求在时间上错开
- SSE：单向服务器推送，基于HTTP，靠`Content-Type: text/event-stream` + `data:\n\n`格式约定，无需握手升级协议，断线自动重连+`Last-Event-ID`补发

## 四、线上问题排查

- Sentry原理：SDK自动捕获错误+堆栈，配合按release上传的source map，在服务端自动"翻译"压缩代码位置为可读源码位置，全程自动化
- Source map：不对外公开部署，只私密上传/存档，多种使用方式(浏览器自带调试、自建监控系统、Sentry)本质相同
- git bisect：自动化的二分查找工具，用于定位哪个commit引入了bug，`git bisect run`可完全自动化
- Feature Flag"秒关"：把"代码上线"和"功能生效"解耦，改远程配置即可关闭，不需要重新部署；灰度比例通过用户ID哈希取模实现，扩量时原有灰度用户保持不变

## 五、Beyz 项目技术栈理解

- tRPC：不是重量级RPC协议，本质是"编译时"通过`export type`/`import type`让前端直接借用后端函数类型，运行时依然是普通HTTP+JSON；前提是前后端代码需在同一仓库/monorepo能互相import类型，与是否用Next.js无必然关系
- React Hook Form：核心是"uncontrolled组件+ref取值"，输入过程不触发React渲染(绕开state)，只有提交或`useWatch`时才读取值，解决大表单卡顿问题
- Zod：解决"TypeScript只在编译时有效，运行时数据无法校验"的问题，一份schema同时产出运行时校验函数(`.parse`)和TS类型(`z.infer`)；配合RHF的`zodResolver`一行接入
- tRPC与Zod分工：tRPC管开发阶段前后端类型一致(防人为疏忽)，Zod管运行时数据真实性校验(防止绕过前端的恶意/异常请求，后端永远不能信任客户端输入)
- Server Action vs Route Handler：前者只服务自己的前端组件(类似tRPC体验，类型安全、少一层fetch)；后者是真正对外暴露的HTTP接口，第三方webhook等外部调用场景必须用后者

## 六、简历表达建议

- 虚拟列表那条"500+→20 DOM节点"的具体数字偏乐观，建议改为"累积节点持续增长 vs 控制在恒定范围(约100-150含overscan)"，并补充测量方法增加可信度
- 描述Feed流经历时要理清"最初版本"和"后续优化"的时间线，避免表述矛盾；嵌入原生App的技术细节不属于自己职责范围时，如实说明分工边界即可
- "Docker+EC2+CI部署"这类基础操作，作为简历亮点性价比低，建议压缩或换成更有技术含量的表达(如幂等性保证)
