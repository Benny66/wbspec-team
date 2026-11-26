## Context

当前仓库是一个空脚手架：`openspec/config.yaml` 的 `context` 为空，`openspec/specs/` 与 `openspec/changes/` 均为空，`.codebuddy/skills/` 下有 OpenSpec 生成的四个 skill（`openspec-explore`、`openspec-propose`、`openspec-apply-change`、`openspec-archive-change`）及对应的四个 `/opsx:*` 命令。OpenSpec CLI 版本 1.3.1，仅支持 `spec-driven` 一个 schema（proposal → specs → design → tasks）。

这四个 skill 解决的是"每个阶段怎么做"，但没有解决三件事：

1. **谁来推进**——需要人依次手动触发，且要知道什么时候该触发哪个。
2. **谁验收**——OpenSpec 没有实现后的验证环节，apply 完成即视为完成。
3. **怎么复用**——skill 与项目绑定，换一个仓库要重新配置，且技术栈约定无处存放。

CodeBuddy 侧可用的载体有四类：`agentic` 子代理（描述驱动、自动委派、独立上下文、执行中不可干预）、`manual` 子代理（用户选中、替代主 Agent）、Skill（模型自主触发、主上下文）、Slash Command（用户显式触发）。运行时 Team Mode 虽然真并行，但会话结束即消亡，不能作为可交付物。

关键约束：子代理之间不共享上下文，只共享磁盘。因此整套协作必须建立在"文件即总线"之上——这也是 OpenSpec 产物天然适合作为交接协议的原因。

## Goals / Non-Goals

**Goals:**

- 用户只表达一次需求即可驱动完整流程，中途仅在规格批准处停顿一次。
- 五个角色边界清晰、可独立替换，单个角色改动不影响其他角色。
- 交付前必须经过可执行的构建与测试，失败可定位、可修复、有轮次上限。
- 角色文件可跨项目复用；技术栈差异下沉到项目级配置。
- 与 OpenSpec 官方生成物解耦，升级 OpenSpec 不破坏本专家。

**Non-Goals:**

- 不做运行时并行团队（不依赖 `team_create` 与会话级成员），不追求多 agent 同时写代码。
- 不修改、不 fork OpenSpec 的四个官方 skill。
- 不实现自定义 workflow schema，沿用 `spec-driven`。
- 不追求零人工确认（明确保留规格批准这一道闸门）。
- 不覆盖部署、灰度、线上联调等交付后环节。

## Decisions

### D1：载体选择——用户级角色文件，而非运行时团队

采用 `~/.codebuddy/agents/workbuddy-*.md` 五个 Markdown 文件。

| 备选 | 否决理由 |
|---|---|
| 运行时 Team Mode（`team_create` + 成员） | 会话级生命周期，无法提交、无法分发给他人，与"可复用专家"目标冲突 |
| 纯 Skill 编排 | 全部在主上下文执行，长流程会污染主会话，且无法约束各阶段工具权限 |
| 单个 manual Agent 内联四阶段 | 上下文压力最大，阶段间无隔离，任一阶段跑偏会带偏后续 |

选择角色文件的理由：可进 git、可版本化、有独立上下文、可限制工具集。代价是依赖 CodeBuddy 的 subagent 机制，见 D2 与风险表。

### D2：编排主体——编排逻辑下沉为 skill，专家为叶子角色

探针实测结论（见 D10）：agentic 子代理的可用工具集里**没有 `task`**，任何子代理都无法再派发子代理。编排逻辑不能住在子代理里，必须留在能派发的主会话中。

最终形态是"一个编排 skill + 两个入口 + 四个叶子专家"：

```
用户 ──┬─ /workbuddy <需求>        （命令入口）
       └─ 选中 workbuddy-lead      （manual 角色入口）
                    │
                    ▼
        workbuddy-orchestrator (skill，在主上下文执行)
                    │ task 派发，每次一个新会话
          ┌─────────┼─────────┬──────────┐
          ▼         ▼         ▼          ▼
      explorer  architect  builder  checker   ← 叶子，无派发能力
```

`workbuddy-lead` 保留为 manual 入口，但只做三件事：加载 skill、检查派发能力、执行 skill 中的阶段规则。若该会话没有 `task` 工具，它必须停下并让用户改用 `/workbuddy`，不得退化为自己内联实现——静默降级会让"独立验收"形同虚设。

否决"由主 Craft Agent 按 description 自动委派四个专家"：自动委派取决于描述匹配，用户说"帮我加个登录"时是否进入 spec 流程不可控。流程入口必须显式（敲命令或选角色），而不是概率性的描述命中。

### D3：角色切分——四阶段五角色，归档降级为 CLI

| 角色 | 阶段 | 输入 | 输出 |
|---|---|---|---|
| orchestrator（skill） | 编排 | 用户需求 | 阶段派发、闸门摘要、最终报告 |
| explorer | 探索 | 需求描述 + 现有代码 | 澄清结论（回传编排者，必要时落盘为假设清单） |
| architect | 规格 | 澄清结论 + 项目档案 | `proposal.md`、`specs/**`、`design.md`、`tasks.md` |
| builder | 实现 | 四件产物 + 项目档案 | 代码改动 + `tasks.md` 勾选 |
| checker | 验收 | 代码改动 + 项目档案 | 验证报告（通过 / 证据化失败） |

与"照搬 OpenSpec 四个 skill"的差异：

- **archive 不设角色**。`openspec archive <name> -y` 已内置规格同步与校验，`--skip-specs` 可关闭同步，一条命令替代原 skill 的全部手工步骤（原 skill 还引用了本仓库不存在的 `openspec-sync-specs`）。
- **新增 checker**。OpenSpec 的 apply 结束即完成，没有验收环节；"必须自检"是无法用原四角色满足的硬需求。
- **explore 保留但不阻塞**。一句话需求必然模糊，explorer 的职责是把模糊点压缩成最多三个关键问题，或直接产出显式假设交由闸门批准；不允许演变成开放式长谈。

### D4：门禁等级——L1 单闸门

| 等级 | 确认点 | 判断 |
|---|---|---|
| L0 全自动 | 0 | 需求理解偏差无人拦截，返工集中在最贵的阶段 |
| **L1 单闸门** | 1（规格批准） | **采用**：一句需求仍是入口，闸门落在成本最低的规格处 |
| L2 多闸门 | 2–3 | 打断过密，与"一句话"体验冲突 |
| L3 现状 | 每阶段 | 无自动化收益 |

闸门摘要固定包含四块：范围（做什么）、非目标（不做什么）、任务分解概览、风险与假设。未决假设必须显式列出，不得隐去——这是 L1 闸门唯一的纠偏机会。

### D5：交接协议——文件即总线

角色之间不传对话，只传路径。每个角色的读写范围固定：

| 角色 | 必须读取 | 允许写入 |
|---|---|---|
| explorer | 需求、相关源码 | 无（结论回传 lead） |
| architect | 澄清结论、`openspec/config.yaml` | `openspec/changes/<name>/` 下全部产物 |
| builder | 四件产物、项目源码 | 应用代码、`tasks.md` 勾选 |
| checker | 应用代码、项目档案 | 无（报告回传 lead） |

由此产生一条对 architect 的硬要求：产物必须"能被陌生人执行"。`design.md` 要写清为什么这样选、明确不做什么、哪些文件不要动，因为 builder 拿不到任何探索期讨论。

### D6：验收与回退——证据驱动 + 三轮上限

checker 只报告不修复。这不是分工洁癖，而是防止"自己改代码让自己通过"绕过验收。

回退路径三条，均回到 lead 再派发，不跨角色直连：

```
checker 失败 ──证据──▶ lead ──▶ builder（同一 change，最多 3 轮）
builder 发现设计不可行 ──▶ lead ──▶ architect（更新 design/tasks）
explorer 发现需求不成立 ──▶ lead ──▶ 终止并说明
```

轮次以"验证尝试次数"计，第 3 轮仍失败则停止自动修复，升级给用户并给出至少两个可选方案。

### D7：技术栈档案——写入项目 config.yaml 的 context

`openspec/config.yaml` 的 `context` 段当前为空，正好作为注入点。取值优先级：已有档案 → 项目清单文件（`package.json`/`go.mod`/`pyproject.toml`/`Cargo.toml`/`pom.xml`）→ 询问一次。

选择"档案落在项目"而非"落在角色文件"的原因：角色要跨项目复用，硬编码技术栈会使角色绑定单一栈；而 checker 必须知道构建与测试命令，两者只能靠项目级档案调和。写入必须幂等，且不覆盖用户手写内容。

### D8：命名空间与防覆盖

- 角色统一 `workbuddy-` 前缀，安装在用户级 `~/.codebuddy/agents/`。
- 不修改 `.codebuddy/skills/openspec-*`；`openspec init --tools codebuddy` 与 `openspec update --force` 会重新生成这些文件，任何改动都会丢失。
- 档案写入只动 `openspec/config.yaml` 的 `context` 段，其余保留。

### D9：移植修正

原 skill 中指向其他工具/技能的引用在 CodeBuddy 中不存在，移植时必须替换：

| 原文引用 | 处理 |
|---|---|
| `AskUserQuestion` tool | → `ask_followup_question` |
| `TodoWrite` tool | → `todo_write` |
| `Task` tool（`subagent_type: "general-purpose"`） | → `task`（`subagent_name` 为本环境可用角色） |
| `openspec-sync-specs` skill | → `openspec archive -y` 内置的规格同步 |
| 手工 `mkdir` + `mv` 归档 | → `openspec archive <name> -y` |

### D10：探针记录（实施期实测）

动手前先用四个一次性探针验证了整套设计的地基，结论如下：

| 探针 | 验证内容 | 结果 |
|---|---|---|
| P1 | 自定义 agent 能否被 `task` 派发 | 成功。`subagent_name` 直接解析 `.codebuddy/agents/` 下的文件 |
| P2 | 子代理能否读取 `.codebuddy/skills/` | 成功。`openspec-propose` 的 SKILL.md 可读 |
| P3 | `tools` 字段命名规则 | PascalCase 生效；**无效名被静默丢弃**，不报错 |
| P4 | 子代理能否再派发子代理 | 失败。子代理工具清单中无 `task`，PascalCase 的 `Task` 也未生效 |

P4 直接推翻原 D2，因此按预案把编排逻辑下沉为 skill（见 D2）。P3 的静默丢弃特性决定了：`tools` 字段写错不会报错，只会让角色少一个能力，因此 `workbuddy-lead` 不声明 `tools`（它必须保留派发能力，声明反而有裁剪风险），其余角色的工具名都经过实测确认。

## Risks / Trade-offs

**R1：子代理无法派发子代理**（已由 P4 证实）→ 已按预案降级为 D2 的 skill 形态。残余风险仅剩 manual 入口是否具备 `task`：`workbuddy-lead` 已内置检查，缺失时明确报错并指向 `/workbuddy`，不静默降级。

**R2：agentic 子代理可能被主 Agent 误触发** → 在四个专家的 `description` 中显式声明"仅由 workbuddy-lead 或 /workbuddy 流程派发时调用，不响应直接请求"，降低被无关需求命中的概率。

**R3：上下文隔离导致关键信息丢失** → 用 D5 的交接契约约束，并在 architect 的产物要求中加入"可被陌生人执行"标准。这是结构性代价，只能降低不能消除。

**R4：修复循环不收敛** → 三轮上限 + 强制升级。同时要求证据必须带定位信息，否则 builder 无法有效修复。

**R5：tasks.md 粒度太粗导致验收无从判断** → 在 tasks 模板层面要求每条任务包含可执行的验证方式；无法验证的任务必须拆细。

**R6：全局安装导致技术栈未知** → D7 的档案机制兜底；档案缺失时 checker 明确报告"未验证"，不允许默认通过。

**R7：`openspec update --force` 覆盖自定义内容** → 自定义一律放 `workbuddy-` 命名空间与 `.codebuddy/agents/`，不碰官方生成物。

**R8：全栈实现质量受模型能力限制** → 通过小粒度任务、每条可验证、失败必回传证据来控制，而不是靠更长的提示词。

## Migration Plan

纯增量变更，无数据迁移。

1. 角色文件与编排 skill 同时落两份：仓库内作为源（`agents/`、`.codebuddy/skills/workbuddy-orchestrator/`），复制到用户级（`~/.codebuddy/agents/`、`~/.codebuddy/skills/`）后跨项目可用。
2. 首次在目标项目运行时写入 `openspec/config.yaml` 的 `context`；写入前保留原文件内容，二次运行不重写。
3. 回滚方式：删除五个 `workbuddy-*.md`、`workbuddy-orchestrator/`、`workbuddy` 命令与 `context` 段新增内容即可，项目代码与既有 OpenSpec 产物不受影响。

## Open Questions

1. ~~`manual` 模式子代理能否使用 `task` 派发子代理？~~ 已由 P4 间接回答：子代理不具备 `task`，因此编排必须留在主上下文；D2 已据此调整。
2. ~~`agentic` 子代理能否加载 `.codebuddy/skills/`？~~ 已由 P2 证实可以，architect 可复用 `openspec-propose`，lead 可加载 `workbuddy-orchestrator`。
3. 团队共享时是否需要项目级角色副本（`.codebuddy/agents/` 入库）？当前两者都做：仓库保存源文件供 git 分发，用户级安装供本机跨项目使用；若后续要求团队配置强一致，需补充同步机制。
