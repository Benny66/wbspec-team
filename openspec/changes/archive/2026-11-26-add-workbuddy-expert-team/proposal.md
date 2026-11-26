## Why

把一句话需求变成可交付的全栈功能，中间需要探索、规格、实现、验证、归档五个环节。目前这些环节分散在四个 OpenSpec skill 里，必须由人逐个手动触发；同时 OpenSpec 自身缺了两件事——实现完没人验收，换个项目一切重来。结果是 spec 写得很完整，代码却停在"看起来写完了"的状态，且这套经验无法复制到下一个仓库。

## What Changes

- 新增 5 个 CodeBuddy agent 角色：`workbuddy-lead`（总编排，manual 模式，用户直接对话）、`workbuddy-explorer`、`workbuddy-architect`、`workbuddy-builder`、`workbuddy-checker`（均为 agentic，由 lead 派发）。
- 新增一条端到端流水线：一句话需求 → 探索澄清 → 规格产出 → **一次人工批准** → 分任务实现 → 构建与测试自检 → 归档。
- 新增质量闸门：实现完成后必须执行项目声明的构建与测试命令，失败时携带具体证据回传 builder 修复，最多 3 轮，超限升级给用户决策。
- 新增项目自动认路：首次在某个项目运行时识别技术栈与构建/测试命令，写入该项目的 `openspec/config.yaml` 的 `context` 段，后续角色无需重复探测。
- 角色文件安装到用户级 `~/.codebuddy/agents/`，统一使用 `workbuddy-` 前缀命名空间；不改动 OpenSpec 生成的四个 `openspec-*` skill，避免被 `openspec update --force` 覆盖。
- 移植 OpenSpec skill 时修正失效引用：`AskUserQuestion` → `ask_followup_question`、`TodoWrite` → `todo_write`、`subagent_type: "general-purpose"` → 本环境可用的角色、`openspec-sync-specs`（本仓库不存在）→ `openspec archive -y` 内置的规格同步。

## Capabilities

### New Capabilities

- `expert-team-roles`: 角色编制与职责边界——哪些角色、各自能调什么工具、由谁派发、上下文如何隔离。
- `spec-pipeline`: 阶段推进规则——从一句话需求到归档的状态流转、唯一人工闸门的位置、失败回退边与断点续跑。
- `delivery-quality-gate`: 交付验收规则——构建与测试的必执行性、失败证据格式、自修复轮次上限与升级路径。
- `project-stack-profiling`: 项目认路规则——技术栈的探测时机、探测来源、写回位置与缺失时的降级行为。

### Modified Capabilities

无。`openspec/specs/` 当前为空，本变更为纯增量，不修改任何既有规格。

## Impact

- 新增用户级角色文件 `~/.codebuddy/agents/workbuddy-*.md`（5 个），跨项目生效。
- 新增项目内配置写入 `openspec/config.yaml` 的 `context` 段（当前为空）。
- 复用现有 `.codebuddy/skills/openspec-*` 与 `skills/openspec-*`，只读引用，不做修改。
- 依赖：`openspec` CLI 1.3.1+；CodeBuddy 的 agent（subagent）机制与 `task` 派发能力。
- 不涉及任何应用代码改动，不影响现有构建产物。
