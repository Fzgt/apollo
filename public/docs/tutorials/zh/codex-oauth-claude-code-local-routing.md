# 用本地路由把 Codex 模型接到 Claude Code

这篇攻略整理自 [GitHub issue #1997](https://github.com/farion1231/cc-switch/issues/1997) 里的社区排障讨论，主要讲一个很容易踩坑的场景：你已经在 CC Switch 里登录了 ChatGPT / Codex OAuth，也添加了 Claude 供应商，但 Claude Code 里仍然提示需要登录、模型不存在，或者不知道到底有没有用上 Codex 模型。文中也补充了普通 GPT / OpenAI 兼容 API Key 供应商的配置方式。

先把结论放前面：

- 如果你用的是 **Codex OAuth 反向代理**，它应该作为 **Claude 供应商**来添加，而不是直接把 Codex 的配置写进 Claude Code。
- 如果供应商本身直接提供 GPT / OpenAI 兼容 API Key，不需要走 Codex OAuth 登录；在 Claude 供应商里选对 **API 格式**、填好 **模型映射**，再开启本地路由即可。
- Codex OAuth 或非 Anthropic 接口格式必须开启 **本地路由**，并启用 **Claude 应用路由**，让 Claude Code 请求先进入 CC Switch。
- 使用 Codex OAuth 时，建议从系统里的普通终端执行 `claude`，不要从 CC Switch 的某个 Codex OAuth 供应商卡片里点「打开终端」。
- Claude Code 里显示 `Sonnet`、`Opus`、`Haiku` 不代表没有用上 Codex；实际调用的上游模型取决于你在 CC Switch 供应商里配置的模型映射。
- `获取模型`失败、`/model` 显示 Claude 系列名称、用量日志里模型名不完全准确，这些都不一定影响实际使用。

## 这到底在转换什么

Claude Code 原生期望的是 Anthropic / Claude 这一套请求格式和环境变量。ChatGPT 账号里的 Codex 服务走的是另一套认证和接口语义，不能只靠一个 API Key 环境变量完整表达。

CC Switch 的本地路由在中间做了三件事：

1. 让 Claude Code 固定请求本机地址，例如 `http://127.0.0.1:15721`。
2. 根据当前启用的 Claude 供应商，把请求转发到 Codex OAuth 反向代理。
3. 负责协议格式转换、OAuth Token 管理、请求日志、热切换和故障转移。

所以这里说的“把 Codex 模型接到 Claude Code”，不是把 Claude Code 改造成 Codex 客户端，而是让 Claude Code 请求一个稳定的本地路由入口，再由 CC Switch 把请求转给 ChatGPT Codex 后端。

如果你的供应商直接给了 GPT 模型的 API Key 和 OpenAI 兼容端点，那就更简单：不需要 OAuth，也不需要 ChatGPT 账号授权。CC Switch 源码里 Claude 供应商的 `apiFormat` 会决定后端转换方式：`anthropic` 默认透传，`openai_chat` 转 OpenAI Chat Completions，`openai_responses` 转 OpenAI Responses API，`gemini_native` 转 Gemini Native。也就是说，普通 GPT 供应商只要选对接口格式，路由就能把 Claude Code 的 Anthropic 请求转换成上游 GPT 接口能理解的请求。

## 先判断你属于哪种场景

| 场景 | 是否需要本地路由 | 推荐启动方式 |
| --- | --- | --- |
| API Key 供应商，且提供 Anthropic Messages 接口 | 可选；只想写环境变量时可以不开 | 从 CC Switch 打开终端或普通终端都可以 |
| API Key 供应商，但只提供 OpenAI Chat / Responses 等非 Anthropic 接口 | 需要，用来做协议转换 | 按供应商配置决定；如果环境变量完整，CC Switch 打开终端通常可用 |
| Codex OAuth / Copilot 这类 OAuth 供应商 | 需要，而且要保持 Claude 应用路由开启 | 从普通终端手动运行 `claude` |

这张表的核心是：OAuth 类型供应商的凭证由 CC Switch 管理，不能像 API Key 那样简单注入到终端环境变量里。对 Codex OAuth 来说，普通终端 + 本地路由是最稳的路径。

## 如果供应商直接提供 GPT 模型

如果你用的是中转商、聚合服务或企业网关直接提供的 GPT / OpenAI 兼容模型，例如供应商给你的是 API Key、Base URL 和模型 ID，那么不要走下面的 Codex OAuth 登录流程。直接按这条路径配置：

1. 切换到 **Claude** 应用。
2. 点击右上角 **+** 添加供应商。
3. 选择对应预设；没有预设就选自定义或 OpenAI 兼容类配置。
4. 填写供应商给你的 API Key 和 Base URL。
5. 展开 **高级选项**，在 **API 格式**里选择供应商实际支持的接口格式。
6. 填好模型映射。
7. 保存供应商并点击 **启用**。
8. 打开 **设置 → 路由 → 本地路由**，开启 **路由总开关**和 **Claude** 应用路由。

API 格式按供应商文档来选：

| 供应商接口 | CC Switch 里选择 |
| --- | --- |
| Anthropic Messages 兼容接口 | `Anthropic Messages (原生)` |
| OpenAI `/v1/chat/completions` | `OpenAI Chat Completions (需开启路由)` |
| OpenAI `/v1/responses` | `OpenAI Responses API (需开启路由)` |
| Gemini Native `generateContent` | `Gemini Native generateContent (需开启路由)` |

模型映射写的是上游真实模型 ID。Claude Code 仍会用 `Sonnet`、`Opus`、`Haiku` 这些角色发起请求，CC Switch 会把这些角色映射到你填写的 GPT 模型：

| 映射项 | 建议填写 |
| --- | --- |
| 主模型 `ANTHROPIC_MODEL` | 主要使用的 GPT 模型，例如 `gpt-5.5` |
| Haiku `ANTHROPIC_DEFAULT_HAIKU_MODEL` | 便宜或快速模型，例如 `gpt-5.5-mini` |
| Sonnet `ANTHROPIC_DEFAULT_SONNET_MODEL` | 日常主力模型，例如 `gpt-5.5` |
| Opus `ANTHROPIC_DEFAULT_OPUS_MODEL` | 最强或长上下文模型，例如 `gpt-5.5` |

如果供应商只给一个 GPT 模型，可以四项都填同一个模型 ID。源码里的模型读取逻辑也是按这些环境变量取值：Haiku 优先读 `ANTHROPIC_DEFAULT_HAIKU_MODEL`，Sonnet 优先读 `ANTHROPIC_DEFAULT_SONNET_MODEL`，Opus 优先读 `ANTHROPIC_DEFAULT_OPUS_MODEL`，缺失时再回退到 `ANTHROPIC_MODEL`。

这个场景和 Codex OAuth 最大的区别是：凭证是普通 API Key，CC Switch 可以直接把它作为供应商配置保存和转发，不需要 OAuth 认证中心，也不会遇到“OAuth Token 不能靠环境变量注入”的问题。只要接口格式不是原生 Anthropic，就记得开启本地路由；否则 Claude Code 发出的 Anthropic 请求无法自动变成 OpenAI Chat 或 Responses 请求。

## 准备工作

建议使用 CC Switch v3.13.0 或更新版本。本文的菜单名称以 v3.14.1 之后的 UI 为准，旧版本里“本地路由”相关入口可能还叫“本地代理”或“代理接管”。

你还需要：

- 一个可用的 ChatGPT 账号，并且账号有 Codex 可用额度。
- 能访问 `auth.openai.com` 和 `chatgpt.com` 的网络环境。
- 已安装并能正常启动 Claude Code。

如果是首次安装 Claude Code，建议先在普通终端运行一次：

```bash
claude
```

这样可以确保 `~/.claude/settings.json` 已经生成。issue 讨论里有人遇到过首次安装后该文件不存在，导致路由接管写入失败的情况。

## 第一步：登录 ChatGPT / Codex OAuth

有两个入口可以开始登录：

1. 打开 **设置 → OAuth 认证中心**。
2. 找到 **ChatGPT (Codex OAuth)**。
3. 点击 **使用 ChatGPT 登录**。

或者：

1. 切换到 **Claude** 应用。
2. 点击右上角 **+** 添加供应商。
3. 选择 **Codex (ChatGPT Plus/Pro)** 或 UI 中对应的 Codex OAuth 预设。
4. 按界面引导登录 ChatGPT。

登录时会走 OpenAI Device Code 流程：CC Switch 显示验证码，你在浏览器打开授权页面，输入验证码并确认授权，CC Switch 随后自动轮询登录结果。

如果这里报 403 或认证失败，优先检查网络：

- 尝试切到新加坡或美国等可用节点。
- 临时把网络规则调成全局模式，排除分流规则没有命中 OpenAI 域名的问题。
- 确认浏览器能正常打开 `https://auth.openai.com/codex/device` 和 `https://chatgpt.com`。

这里的网络代理是“访问 OpenAI 的出站网络”，和 CC Switch 的“本地路由”不是同一个概念。

## 第二步：添加 Codex OAuth 型 Claude 供应商

登录成功后，在 **Claude** 应用里添加供应商：

1. 选择 Codex OAuth 相关预设。
2. 在账号下拉框里选择刚才登录的 ChatGPT 账号。
3. 检查模型映射。
4. 保存供应商。

默认模型映射通常类似：

| Claude 角色 | 上游 Codex 模型 |
| --- | --- |
| 主模型 | `gpt-5.5` 或当前预设默认值 |
| Sonnet | `gpt-5.5` 或当前预设默认值 |
| Opus | `gpt-5.5` 或当前预设默认值 |
| Haiku | `gpt-5.5-mini` 或当前预设默认值 |

这里不要手动把 Base URL 改成 `https://chatgpt.com/backend-api/codex`，也不需要自己改 API 格式。Codex OAuth 供应商会由 CC Switch 处理上游地址、认证和 `openai_responses` 格式转换。

如果点击「获取模型」时提示需要 API Key，或者上游不支持 `/models` 端点，不代表不能用。issue 讨论里的结论是：这个功能失败不影响你手动填写模型 ID，例如 `gpt-5.5` 或当前版本预设里的可用模型。

## 第三步：启用供应商和本地路由

保存供应商后：

1. 在 Claude 供应商列表里点击该 Codex OAuth 供应商的 **启用**。
2. 打开 **设置 → 路由 → 本地路由**。
3. 开启 **路由总开关**。
4. 在应用路由里开启 **Claude**。

旧版本或旧截图里，这一步可能写作：

- **设置 → 代理 → 本地代理**
- **代理总开关**
- **Claude 接管**

这些叫法指向的是同一类能力：让 Claude Code 的请求经过 CC Switch 的本地路由。

## 第四步：验证 Claude 配置是否被路由接管

在任意普通终端里执行：

```bash
cat ~/.claude/settings.json
```

你不需要整份文件完全一样，因为里面可能还有 MCP、插件或其他设置。重点检查 `env` 里是否包含类似内容：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:15721",
    "ANTHROPIC_AUTH_TOKEN": "PROXY_MANAGED"
  }
}
```

如果你修改过本地路由端口，`15721` 会变成你的自定义端口。只要 Claude Code 指向的是 CC Switch 本地路由地址，就说明方向对了。

## 第五步：从普通终端启动 Claude Code

进入你的项目目录，然后手动运行：

```bash
claude
```

不要从 Codex OAuth 供应商卡片里点「打开终端」启动这个会话。issue 里多位用户验证过：对 Codex OAuth 这类供应商，CC Switch 的快捷打开终端会尝试把单个供应商配置作为环境变量注入 Claude Code，但 OAuth 型配置不能这样完整注入，结果可能绕过本地路由，出现下面这类现象：

- `Not logged in · Please run /login`
- Claude Code 显示正在使用 `gpt-5.5`，但提示模型不存在或无权限
- 供应商在 CC Switch 里能查到用量，但 Claude Code 对话失败

从普通终端启动时，Claude Code 会读取 `~/.claude/settings.json`，请求本机路由地址。CC Switch 再用当前启用的 Codex OAuth 供应商去转发请求，这条链路才是正确的。

## 第六步：理解模型显示和实际模型

使用本地路由后，Claude Code 里仍可能显示 `Sonnet 4.6`、`Opus` 或 `Haiku`。这是因为 Claude Code 看到的是自己的模型角色，而不是 CC Switch 转发后的真实上游模型名。

实际请求会按 CC Switch 里的模型映射走。例如你把 Sonnet 角色映射到 `gpt-5.5`，那么 Claude Code 里选 Sonnet 时，CC Switch 会把请求转给映射后的 Codex 模型。

现阶段你需要接受几个显示层面的限制：

- `/model` 里看到的可能仍是 Claude 系列名称。
- 用量日志可能出现来自路由和会话日志的两条记录，字段显示不完全一致。
- OAuth 型供应商的日志里可能不总是展示最终的 ChatGPT 上游模型名。
- 上游模型的推理过程不一定会以 Claude Code 原生 thinking 的形式展示。

这些是显示和可观测性问题，不等于请求没有走到 Codex。排查时优先看三件事：本地路由是否开启、Claude 配置是否指向 `127.0.0.1:15721`、CC Switch 当前启用的 Claude 供应商是否是你的 Codex OAuth 供应商。

## 切换供应商时要不要重启

如果只是切换 CC Switch 里当前启用的 Claude 供应商：

- 不需要重启 Claude Code。
- 不需要重新开关本地路由。
- Claude Code 仍然请求同一个本地路由地址，CC Switch 会在后端热切换真实供应商。

如果你开启或关闭本地路由、修改路由端口、关闭 Claude 应用路由：

- 建议重启 Claude Code。
- 因为这类操作会改变 `~/.claude/settings.json` 或本地路由监听状态。

热切换很方便，但也要注意上下文窗口和成本。如果你从一个长上下文、低成本模型切到短上下文或高成本模型，正在跑的任务可能因为上下文限制或缓存失效产生额外开销。故障转移队列也有类似风险，建议把上下文窗口和价格接近的供应商放在同一组。

## 常见问题

### 已经 OAuth 成功，Claude Code 还是要求登录

大概率是启动方式不对。关闭当前 Claude Code，从普通终端重新运行 `claude`，不要点 CC Switch 供应商卡片里的「打开终端」。

同时检查 `~/.claude/settings.json` 里是否指向本地路由地址。

### Claude Code 提示 `gpt-5.5` 不存在或没有权限

如果你是通过 CC Switch 的快捷打开终端启动的，先改成普通终端启动。快捷打开终端可能把 `ANTHROPIC_MODEL=gpt-5.5` 等环境变量直接注入给 Claude Code，导致 Claude Code 按错误路径理解模型。

### `获取模型`提示需要 API Key

Codex OAuth 不是普通 API Key 供应商，且 OpenAI 的相关上游不一定提供 CC Switch 自动获取模型所需的 `/models` 端点。手动填写当前预设推荐的模型 ID 即可。

### OAuth 登录 403

这是出站网络问题，不是本地路由问题。尝试更换可用节点，临时使用全局代理规则，并确认 OpenAI 登录域名没有被分流到不可用线路。

### 开启本地路由后接管失败

先确认 `~/.claude/settings.json` 是否存在。首次安装 Claude Code 后可以先运行一次 `claude` 让它生成配置，再回到 CC Switch 重新开启 Claude 应用路由。

### 为什么本地路由值得开

在这个场景里，本地路由不是可有可无的开关。它带来的是：

- 协议兼容转换，让 Claude Code 能使用非 Anthropic 格式的上游。
- 稳定的本地入口，切换供应商时不用反复重启 Claude Code。
- 请求日志和用量统计，方便判断请求有没有进 CC Switch。
- 故障转移队列，在高优先级供应商失败时自动尝试备用供应商。

对 Codex OAuth 来说，本地路由基本就是整条链路的核心。

## 参考

- [GitHub issue #1997：添加 codex 作为 Claude Code 供应商后提示需要登录](https://github.com/farion1231/cc-switch/issues/1997)
- [添加供应商：Codex OAuth 反向代理](/zh/docs?section=providers&item=add#codex-oauth-反向代理claude-供应商)
- [应用路由文档](/zh/docs?section=proxy&item=routing)
- [故障转移文档](/zh/docs?section=proxy&item=failover)

感谢 issue 里参与排障和补充经验的 `codeasier`、`moxi000`、`lby-1`、`zl6977`、`farion1231` 以及其他社区用户。这个功能确实有一点“看起来只是代理，实际上是主菜”的味道，写清楚之后就顺多了。
