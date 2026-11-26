## 1. 前置探针（验证设计地基）

- [x] 1.1 用一个一次性 agentic 角色验证自定义 agent 能否被 `task` 派发：`subagent_name` 直接解析 `.codebuddy/agents/` 下文件，派发成功
- [x] 1.2 在同一子代理中读取 `.codebuddy/skills/openspec-propose/SKILL.md`，可读，确认 skill 对子代理可见
- [x] 1.3 依据探针结论调整编排形态：子代理无 `task` 工具、无法嵌套派发，改为「编排 skill + `/workbuddy` 命令 + manual 入口」三件套，结论已回写 design.md（D2 与 D10）

## 2. 角色文件

- [x] 2.1 编写 `workbuddy-lead.md`：`agentMode: manual`，加载编排 skill，自带派发能力检查（缺失时停止并指向命令入口，不静默降级）
- [x] 2.2 编写 `workbuddy-explorer.md`：工具集仅 `Read, Glob, Grep`，只读探查，最多三个关键问题，其余转显式假设
- [x] 2.3 编写 `workbuddy-architect.md`：按依赖顺序产出四件产物，自检 `openspec status` 全部 done，产物满足「可被陌生人执行」标准
- [x] 2.4 编写 `workbuddy-builder.md`：只做本批任务，每完成一条立即勾选，遇设计冲突停止并报告
- [x] 2.5 编写 `workbuddy-checker.md`：工具集仅 `Read, Glob, Grep, Bash`，无写权限，只输出证据
- [x] 2.6 为四个 `agentic` 角色补 `description` 前置约束：仅在 workbuddy-lead 或 /workbuddy 流程派发时调用，不响应直接请求
- [x] 2.7 核对五个文件字段完整性：explorer / architect / builder / checker 均声明 `tools` 且工具名经实测；`lead` 因必须保留派发能力而不声明 `tools`，避免按名单裁剪误删（理由记入 design D10）

## 3. 流水线编排

- [x] 3.1 编排 skill 中固定阶段顺序与派发规则：探索 → 规格 → 闸门 → 实现 → 验收 → 归档，禁止跳阶
- [x] 3.2 实现 change 名称推导规则：动词开头 kebab-case；重名时询问继续还是新建，不静默覆盖；无法推导时先提开放式问题
- [x] 3.3 定义闸门摘要模板：范围、非目标、任务分解概览、风险与假设四块必填，跳过探索或未决假设必须显式披露
- [x] 3.4 定义三条回退边及触发条件：需求不成立终止、设计不可行回到 architect、验收失败回到 builder
- [x] 3.5 实现断点续跑：只依据 `tasks.md` 勾选状态与 `openspec status --json`，从第一个未勾选任务继续（实测已勾选任务未被重做）
- [x] 3.6 实现归档步骤：先校验产物与任务完成状态，再 `openspec archive <name> -y`；纯工具类变更使用 `--skip-specs`

## 4. 验收闸门

- [x] 4.1 定义失败证据结构：命令、退出码、失败位置、关键输出片段；输出超长时保留首尾并标注截断
- [x] 4.2 实现四态结论：通过 / 仅构建通过 / 失败 / 未验证；后两者不得表述为通过（实测两类降级均正确输出）
- [x] 4.3 实现三轮上限计数与升级报告模板：失败摘要、已尝试方向、至少两个可选方案
- [x] 4.4 归档前硬校验：最后一次验收非「通过」或「仅构建通过」时阻止归档

## 5. 技术栈档案

- [x] 5.1 实现探测优先级：已有 `context` → 清单文件（`package.json` / `go.mod` / `pyproject.toml` / `Cargo.toml` / `pom.xml`）→ 询问一次
- [x] 5.2 实现写回逻辑：只写 `openspec/config.yaml` 的 `context` 段，保留其余内容，二次运行不重写（实测 CLI 可正常解析并注入指令）
- [x] 5.3 实现最小字段集与缺失标注：语言框架、构建命令、测试命令三项，缺失项写「未知（需人工补充）」并在闸门摘要提示

## 6. 端到端验证

- [x] 6.1 在只有构建、没有测试的 Node 沙箱中跑通：checker 正确输出「仅构建通过」，并指出构建脚本只是占位输出、无实质验证力
- [x] 6.2 验证档案复用：`context` 已存在时流程跳过写入，`openspec instructions` 能读取并注入该段内容
- [x] 6.3 人为注入语法错误后复验：checker 输出「失败」并定位到 `scripts/build.js:1` 根因，退出码 1，且按规程未继续跑测试（三轮升级为提示词逻辑，仅做了文本核对，未做真实失败循环实测）
- [x] 6.4 断点续跑实测：builder 只被派发任务 2.1，完成后仅勾选该条，未重做已完成的 1.1 与 1.2，未改动任务范围外文件

## 7. 分发与回滚

- [x] 7.1 记录安装与卸载方式：五个角色文件、编排 skill、命令入口的路径与同步命令，写在 `docs/install.md`
