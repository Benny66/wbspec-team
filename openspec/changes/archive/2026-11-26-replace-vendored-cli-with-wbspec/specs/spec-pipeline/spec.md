## MODIFIED Requirements

### Requirement: 断点续跑

流程 MUST 以 `tasks.md` 的勾选状态作为进度真源。会话中断后重新启动时，系统 MUST 从第一个未完成任务继续，MUST NOT 重做已完成任务。进度判定 MUST 使用包内自带的 `wbspec status`，不依赖外部安装的工具。

#### Scenario: 中断后继续

- **WHEN** 用户在实现到一半后关闭会话，之后重新提出继续
- **THEN** 系统读取 `tasks.md`，报告已完成与剩余任务数，并从第一个 `- [ ]` 开始执行

#### Scenario: 进度不复算

- **WHEN** 系统恢复运行时
- **THEN** 它不依据对话记忆推断进度，只依据 `tasks.md` 与 `wbspec status --json` 的实际状态

#### Scenario: 工具不可用时的判定

- **WHEN** 运行环境没有 Node，`wbspec` 无法执行
- **THEN** 系统直接按 `tasks.md` 的勾选状态判断进度，并说明当前处于降级模式

### Requirement: 归档由 CLI 执行

归档 MUST 通过包内自带的 `wbspec archive <change>` 完成，MUST NOT 手工移动目录、MUST NOT 手工拼接主规格。归档前 MUST 先通过 `wbspec validate`，并校验任务全部勾选。归档过程 MUST 先备份将被修改的主规格，合并后 MUST 输出四项计数的对账单。

#### Scenario: 正常归档

- **WHEN** 所有任务已勾选、验收通过且结构校验无误
- **THEN** 系统执行归档，变更被移入 `openspec/changes/archive/YYYY-MM-DD-<name>/`，主规格同步更新并输出对账单

#### Scenario: 未完成时归档被阻止

- **WHEN** 存在未勾选任务或校验失败
- **THEN** 系统不执行归档、不留下任何文件改动，报告未完成项并要求处理

#### Scenario: 无规格变更的归档

- **WHEN** 该变更为纯工具或文档类改动，不涉及规格变化
- **THEN** 系统使用跳过规格同步的归档方式，并在报告中说明

#### Scenario: 合并对不上号

- **WHEN** delta 中声明的需求在主规格里找不到对应名字
- **THEN** 归档中止，指出该需求名，主规格保持备份前状态

#### Scenario: 降级模式下归档

- **WHEN** 运行环境缺少 Node，只能按协议手工归档
- **THEN** 系统仍先备份主规格，合并后仍输出对账单，不因降级而降低强度
