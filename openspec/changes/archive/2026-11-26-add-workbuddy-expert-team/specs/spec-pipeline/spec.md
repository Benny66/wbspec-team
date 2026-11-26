## ADDED Requirements

### Requirement: 单句需求启动

用户只提供一句自然语言需求即可启动完整流程。系统 MUST 从该描述推导 kebab-case 的 change 名称并创建变更目录，MUST NOT 在无歧义情况下先追问名称。

#### Scenario: 一句话启动

- **WHEN** 用户说"帮我做一个带登录的待办应用"
- **THEN** 系统创建 `openspec/changes/<推导出的名称>/` 并进入探索阶段，不要求用户提供变更名

#### Scenario: 需求不可推导时澄清

- **WHEN** 用户只说"做点东西"这类无法推导目标的内容
- **THEN** 系统提出一个开放式问题澄清需求，且不创建空变更目录

#### Scenario: 同名变更已存在

- **WHEN** 推导出的 change 名称与现存活跃变更重复
- **THEN** 系统询问是继续该变更还是另起新名，不静默覆盖

### Requirement: 阶段顺序

流程 MUST 按 `探索 → 规格 → 批准闸门 → 实现 → 验收 → 归档` 的顺序推进。任一阶段未产出其必需产物时，后续阶段 MUST NOT 开始。

#### Scenario: 未批准不得实现

- **WHEN** 规格阶段刚完成、用户尚未批准
- **THEN** 系统停留在闸门处，不修改任何应用代码

#### Scenario: 规格缺失时阻塞

- **WHEN** `openspec status` 显示 `tasks` 尚未完成而 lead 试图进入实现阶段
- **THEN** 系统回到规格阶段补齐产物，而不是直接开始写代码

### Requirement: 唯一人工闸门

规格阶段完成时，系统 MUST 输出一页摘要供用户批准，内容包含：要做什么、明确不做什么、任务分解概览、主要风险与假设。除此之外的整条流水线 MUST NOT 请求用户确认，除非触发升级条件。

#### Scenario: 闸门输出摘要

- **WHEN** proposal、specs、design、tasks 全部就绪
- **THEN** 系统输出包含范围、非目标、任务数与风险假设的摘要，并明确等待用户批准

#### Scenario: 批准后不再打扰

- **WHEN** 用户回复批准
- **THEN** 系统连续执行实现、验收、归档，中途不再要求确认

#### Scenario: 闸门前的提问不含糊

- **WHEN** 摘要中存在未决假设
- **THEN** 该假设被显式列出而不是隐去，便于用户在该次批准中一并纠正

### Requirement: 失败回退边

流程 MUST 支持三条回退路径：需求本身不成立时终止并说明原因；实现暴露设计缺陷时回到规格阶段更新 `design.md` 与 `tasks.md`；验收失败时回到实现阶段。

#### Scenario: 设计缺陷回写规格

- **WHEN** builder 发现 `design.md` 中的方案无法实现
- **THEN** 流程回到 architect 更新设计文档，且更新后的设计被记录，避免下一轮重复撞墙

#### Scenario: 验收失败回到实现

- **WHEN** checker 报告失败证据
- **THEN** 流程回到 builder，且 builder 收到的输入包含失败命令与关键输出

#### Scenario: 终止条件

- **WHEN** 探索发现需求与现有系统能力冲突且无法通过本变更解决
- **THEN** 系统停止推进并说明冲突点，保留已产出文档供后续参考

### Requirement: 断点续跑

流程 MUST 以 `tasks.md` 的勾选状态作为进度真源。会话中断后重新启动时，系统 MUST 从第一个未完成任务继续，MUST NOT 重做已完成任务。

#### Scenario: 中断后继续

- **WHEN** 用户在实现到一半后关闭会话，之后重新提出继续
- **THEN** 系统读取 `tasks.md`，报告已完成与剩余任务数，并从第一个 `- [ ]` 开始执行

#### Scenario: 进度不复算

- **WHEN** 系统恢复运行时
- **THEN** 它不依据对话记忆推断进度，只依据 `tasks.md` 与 `openspec status --json` 的实际状态

### Requirement: 归档由 CLI 执行

归档 MUST 通过 `openspec archive <change> -y` 完成，MUST NOT 手工移动目录或手工拼接主规格。归档前 MUST 校验产物与任务完成状态。

#### Scenario: 正常归档

- **WHEN** 所有任务已勾选且验收通过
- **THEN** 系统执行归档命令，变更被移入 `openspec/changes/archive/YYYY-MM-DD-<name>/`，主规格同步更新

#### Scenario: 未完成时归档被阻止

- **WHEN** 存在未勾选任务或校验失败
- **THEN** 系统不执行归档，报告未完成项并要求处理

#### Scenario: 无规格变更的归档

- **WHEN** 该变更为纯工具或文档类改动，不涉及规格变化
- **THEN** 系统使用跳过规格同步的归档方式，并在报告中说明
