---
title: "③ The design system and MSW"
section: BioMap
---

# ③ The design system and MSW

> **Resume line**
>
> Built a **design system on Radix UI, Storybook and CVA**, plus an **MSW mock layer** that let **frontend delivery run independent of backend progress**.

## What this bullet is about

**The two halves are not worth the same; do not split your effort evenly:**

| | Interview value | Why |
|---|---|---|
| **The design system** | Medium | It is a "do you know which tool and why" question; explaining it clearly is enough |
| ⭐ **MSW** | **High** | **It is a design question with a definite right answer** — "where you intercept decides what you are testing" — and it strings together with [the seams in Periplus](/docs?section=periplus&item=scripted-seams) into one general principle |

⭐ **It is also the second application of the same idea as [② Architectural boundaries](/docs?section=biomap&item=architecture-boundaries)**: there it was "make the wrong dependency direction impossible", here it is "make front-end delivery independent of back-end progress" — **both replace a convention held up by human discipline with a constraint held up by a tool.**

## The 30-second version

> The design system half is standard equipment: **Radix supplies behaviour and no styling** (keyboard navigation, focus management, accessibility — the parts that are easiest to get wrong), **CVA turns the size × variant × state combinations into one typed configuration**, and Storybook gives components a standalone development environment.
>
> ⭐ **MSW is the part worth talking about.** It differs fundamentally from the usual way of faking an API: **it does not replace your code, it intercepts at the network layer.** A Service Worker registered in the browser catches the request after it has been sent and returns fake data — **your API functions, axios interceptors, header assembly and error mapping all really run; only the final hop never leaves.**
>
> **Swap the hook for a fake one, or replace axios wholesale, and all of that code is skipped — what you are testing is no longer the real request path.**
>
> Paired with its in-memory database, **the fake API is stateful: POST a comment and a GET will find it** — so with no back-end endpoint written yet, the front end can be developed, demoed and tested through a whole interaction flow.

## 1. ⭐ Why MSW beats a fake fetch (the point: where you intercept decides what you are testing)

### First, what MSW is

**MSW (Mock Service Worker) is a mocking tool**, but it differs fundamentally from the usual approach: ⭐ **it does not replace your code, it intercepts at the network layer.**

- In the browser it registers a **Service Worker** (a browser-provided proxy sitting between the page and the network) that **catches the request after it goes out and returns the fake data you wrote**
- In a test environment (Node) it takes over the underlying HTTP module directly

⭐ **The key point: your code has no idea it exists** — every request that should be sent is sent, only the last hop never leaves.

### Where you intercept decides what you test

```
component → custom hook → API function → axios/fetch → ❶ network layer → server
           ↑ mock here    ↑ or here      ↑ or here      ↑ MSW intercepts here
```

| Where the mock sits | Is everything below it still real |
|---|---|
| **Fake the hook** | ❌ API functions, request assembly, interceptors, serialisation — **all skipped** |
| **Fake the API function** | ❌ The axios instance, base URL, headers, interceptors, error mapping — **all skipped** |
| **Replace axios wholesale** | ⚠️ Request configuration and interceptor logic **still never run** |
| ⭐ **MSW (the network layer)** | ✅ **Everything above really executes**; only the final hop never leaves |

⭐ **In one line: MSW intercepts at the network layer, so what you test is the real request path.**

> ⭐ **This is exactly the same principle as [the scripted seam in Periplus](/docs?section=periplus&item=scripted-seams)** — there, replacing the model call **overrides only the one method that sends the request**, so prompt assembly, format validation and repair retries all still really run; on the web-scraping side what is swapped is the HTTP client's transport layer, so **robots parsing, rate limiting and redirect following are all genuinely tested**.
>
> **Strung together, the two projects give you a general principle you can say out loud: "Put the substitution point as close to the process boundary as possible. The further out it sits, the more real code is under test."**

### Three benefits unique to MSW

| Benefit | Note |
|---|---|
| **One set of mocks for both browser and tests** | Development and Storybook use the browser build, tests use the Node build, and **the mock logic is written once** |
| **The front end can run entirely on its own** | With no back-end endpoint written, the front end can already be developed, demoed and screenshotted — ⭐ **that is the literal meaning of `let frontend delivery run independent of backend progress`** |
| ⭐ **The fake data is stateful** | It uses an **in-memory database**, not hard-coded JSON. **POST a comment and a GET will find it** — **so you can test a whole interaction flow, not just rendering** |

### One setting already done right

```js
server.listen({ onUnhandledRequest: 'error' })
```

**"Any request that matches no handler is an error."**

⭐ **Without it, an endpoint you forgot to mock silently hits the real network** — **and the test result becomes non-deterministic** (passing on a good connection, failing on a bad one).

### ⚠️ The risk you must raise yourself

> ⭐ **MSW mocks drift from the real API. The back end renames one field, your tests stay green, and production breaks.**

**The production-grade fix**: **generate** the mocks from the back end's OpenAPI schema (guaranteeing the shapes match), plus **contract testing** — ⭐ **MSW guarantees the front end works against the agreed contract; contract tests guarantee the contract has not been quietly changed by the back end.**

> **Saying this proves you have actually used it, far more than listing MSW's benefits does.**

## 2. The design system: what each of the four tools solves

| Tool | In one line |
|---|---|
| **Radix UI** | ⭐ **Behaviour only, no styling** (this kind of library is called **headless**) — keyboard navigation, focus management, accessibility attributes, click-outside-to-close: **the parts that are easiest to get wrong and least worth rebuilding**. All the styling is yours |
| **CVA** | Turns the "size × variant × state" combinations into one configuration with **types exported automatically** — no hand-assembling class-name strings |
| **design tokens** | Colours, spacing and radii **defined once**; switching themes swaps only that definition |
| **Storybook** | A standalone development environment and documentation for components; **with MSW it can demo interactions without any back end** |

### ⭐ Why headless instead of an off-the-shelf component library

**This is the most likely follow-up in this half.**

**Off-the-shelf libraries (Ant Design, MUI) give you behaviour plus styling.** The problem: **when the product has its own design language, you spend enormous time overriding their styles** — and overrides are fragile, **a library upgrade can break all of them**.

⭐ **Libraries like Radix cut between "the parts that are hard to get right" and "the parts that must be customised"**: behaviour, focus management and accessibility, where **getting it wrong genuinely locks users out**, go to the library; styling, which **has to follow the product**, you write yourself. **That cut is itself the answer.**

### `asChild` is worth mentioning on its own

It lets you apply the styling onto a child element, so `<Button asChild><Link/></Button>` **renders a single `<a>` tag rather than an `<a>` nested inside a `<button>`**.

⭐ **The latter is invalid HTML** — an interactive element may not contain another interactive element, and both screen readers and keyboard operation break. **Being able to say why it may not nest is worth far more than knowing there is an `asChild` prop.**

> ⭐ **The whole design system has the same purpose as [② Architectural boundaries](/docs?section=biomap&item=architecture-boundaries): make misuse hard.** Components have accessibility built in, so the person using them does not have to remember `aria` attributes; variants are constrained by types, so a misspelled variant name is a compile error.

## Glossary

| 中文 | English |
|---|---|
| 假接口 / 打桩 | **mock** (verb *to mock*) |
| 拦截 | **intercept** (*MSW intercepts at the network layer*) |
| 网络层 | **the network layer** |
| 请求路径 | **request path** (*you exercise the real request path*) |
| 拦截器 | **interceptor** |
| 序列化 | **serialisation** |
| 有状态的假数据 | **stateful mocks** |
| 内存数据库 | **in-memory database** |
| 未匹配的请求 | **unhandled request** |
| 漂移 | **drift** (⭐ *mocks drift from the real API*) |
| 契约测试 | **contract testing** |
| 自动生成 | **generated** (*generated from the OpenAPI schema*) |
| 无头组件库 | **headless UI library** |
| 行为 ↔ 样式 | **behaviour ↔ styling** |
| 焦点管理 | **focus management** |
| 键盘导航 | **keyboard navigation** |
| 无障碍 | **accessibility (a11y)** |
| 屏幕阅读器 | **screen reader** |
| 变体 | **variant** (CVA = class variance authority) |
| 设计令牌 | **design tokens** |
| 覆盖样式 | **override styles** |

> ⭐ **The three easiest to get wrong**:
>
> 1. "Intercepts at the network layer" — the point of the whole bullet
> 2. "The mocks and the real API diverge" uses **drift**: *mocks drift from the real API*
> 3. "Behaviour but no styling" is **behaviour without styling**, and that kind of library is **headless**
