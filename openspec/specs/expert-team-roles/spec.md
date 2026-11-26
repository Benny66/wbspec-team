# expert-team-roles Specification

## Purpose
TBD - created by archiving change add-workbuddy-expert-team. Update Purpose after archive.
## Requirements
### Requirement: 固定角色编制

系统 SHALL 提供五个角色，职责不可合并、不可越界：`workbuddy-lead`（编排与用户交互）、`workbuddy-explorer`（需求澄清）、`workbuddy-architect`（产出规格文档）、`workbuddy-builder`（写代码）、`workbuddy-checker`（验收）。

#### Scenario: 角色清单完整

- **WHEN** 用户安装本专家
- **THEN** `~/.codebuddy/agents/` 下存在五个 `workbuddy-*.md` 文件，且每个文件都有 `name`、`description`、`agentMode`、`tools` 四个字段

#### Scenario: 角色职责不重叠

- **WHEN** 检视任一角色文件的系统提示词
- **THEN** 该文件只声明一个阶段的主要职责，不包含其他阶段的核心动作

### Requirement: 派发模式与调用链

`workbuddy-lead` MUST 以 `manual` 模式注册，作为用户唯一直接对话的入口；其余四个角色 MUST 以 `agentic` 模式注册，且 MUST 只由 lead 派发，不被用户直接选中。

#### Scenario: 用户对话进入 lead

- **WHEN** 用户从 Agent 选择框选中 `workbuddy-lead` 并提出需求
- **THEN** 由 lead 承接该需求并按流水线推进，用户无需手动切换角色

#### Scenario: 专家角色不被用户直接选中

- **WHEN** 用户打开 Agent 选择框
- **THEN** `workbuddy-explorer`、`workbuddy-architect`、`workbuddy-builder`、`workbuddy-checker` 不作为常规入口出现在可选列表中

### Requirement: 角色工具边界

各角色的可用工具 MUST 按职责最小化授权：`explorer` 与 `architect` MUST NOT 具备写应用代码的能力；`checker` MUST NOT 具备修复代码的能力，只能报告；`lead` MUST NOT 直接编写应用代码。

#### Scenario: 探索阶段不产生代码

- **WHEN** explorer 执行需求澄清
- **THEN** 项目中除 `openspec/` 目录外无任何文件被修改

#### Scenario: 验收角色不自行修复

- **WHEN** checker 发现构建或测试失败
- **THEN** 它只输出失败证据并将结论交回 lead，不修改任何源文件

### Requirement: 上下文隔离下的文件交接

角色之间 MUST 只通过磁盘上的 OpenSpec 产物交接信息，MUST NOT 依赖前序角色的对话历史。任一角色 MUST 仅凭 `openspec/changes/<name>/` 下的文件即可完成其阶段工作。

#### Scenario: 无历史上下文也能实现

- **WHEN** builder 在全新会话中只获得 change 名称
- **THEN** 它能通过 `proposal.md`、`specs/`、`design.md`、`tasks.md` 完成实现，无需向用户追问前序讨论内容

#### Scenario: 交接物缺失即阻塞

- **WHEN** builder 所需的某个产物文件缺失或为空
- **THEN** 它停止执行并报告缺失项，而不是自行补写或猜测内容

