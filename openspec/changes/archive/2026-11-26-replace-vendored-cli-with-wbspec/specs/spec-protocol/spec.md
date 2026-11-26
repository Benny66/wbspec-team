## ADDED Requirements

### Requirement: 目录布局

协议 MUST 使用 `openspec/` 作为根目录，包含 `specs/`（主规格）、`changes/`（进行中的变更）、`changes/archive/`（已归档变更）。每个变更目录 MUST 包含 `.openspec.yaml`，其中至少记录 `schema` 与 `created`。

#### Scenario: 变更目录结构

- **WHEN** 新建一个变更
- **THEN** 目录内存在 `.openspec.yaml`，且后续产物 `proposal.md`、`specs/`、`design.md`、`tasks.md` 平级存放

#### Scenario: 与上游格式兼容

- **WHEN** 用真实 OpenSpec CLI 对专家产出的目录执行 `validate`
- **THEN** 结构可被识别，不因自定义字段或改名而失败

### Requirement: 产物依赖图

协议 MUST 规定四个产物及其依赖：`proposal` 无前置；`specs` 与 `design` 依赖 `proposal`；`tasks` 依赖 `specs` 与 `design`；进入实现阶段要求 `tasks` 完成。依赖图 MUST 以可被程序读取的形式冻结在 `references/protocol/schema.json`。

#### Scenario: 依赖未满足时阻塞

- **WHEN** `proposal.md` 缺失
- **THEN** `specs` 与 `design` 都被判定为未就绪，而不是仅缺一个

#### Scenario: 实现门槛

- **WHEN** `tasks.md` 尚未产出
- **THEN** 状态判定为不可进入实现阶段

### Requirement: 结构校验规则

协议 MUST 明确下列约束：主规格必须包含 `## Purpose` 与 `## Requirements` 两个段落；每条 `### Requirement:` MUST 至少带一个 `#### Scenario:`；场景 MUST 使用四个井号；delta 规格 MUST 使用 `## ADDED Requirements`、`## MODIFIED Requirements`、`## REMOVED Requirements` 三种二级标题之一。

`RENAMED` MUST 被显式拒绝并提示改用 `REMOVED` + `ADDED` 表达，MUST NOT 静默忽略或猜测改名意图。

#### Scenario: 段落缺失

- **WHEN** 主规格只有 `## Requirements` 没有 `## Purpose`
- **THEN** 校验失败并指出缺少 Purpose

#### Scenario: 场景层级错误

- **WHEN** 场景写成 `### Scenario:` 而不是 `#### Scenario:`
- **THEN** 校验失败，不静默通过

#### Scenario: 拒绝 RENAMED

- **WHEN** delta 中出现 `## RENAMED Requirements`
- **THEN** 校验失败并提示改用 REMOVED + ADDED

### Requirement: delta 合并语义

合并 MUST 按需求名匹配，只支持三种操作：`ADDED` 追加到主规格末尾；`MODIFIED` 用 delta 中的完整需求块原地替换主规格中的同名块；`REMOVED` 删除同名块。匹配不到同名需求时 MUST 报错中止，MUST NOT 猜测或追加。

#### Scenario: 修改保持位置

- **WHEN** delta 修改主规格中排在第二位的需求
- **THEN** 合并后该需求仍在第二位，内容被替换

#### Scenario: 新增追加到末尾

- **WHEN** delta 包含一条主规格中不存在的需求
- **THEN** 该需求被追加到 Requirements 段末尾

#### Scenario: 删除

- **WHEN** delta 声明 REMOVED 且主规格存在同名需求
- **THEN** 该需求块被整体移除，其余需求顺序不变

#### Scenario: 对不上号时中止

- **WHEN** delta 声明 MODIFIED 但主规格中找不到同名需求
- **THEN** 合并中止并指出该需求名，不写入任何内容

### Requirement: 协议冻结与来源标注

协议资产 MUST 标注来源与版本对应关系（源自 OpenSpec `spec-driven` schema v1），MUST NOT 在运行时向上游拉取更新。上游演进时由维护者显式决定是否升级。

#### Scenario: 离线可用

- **WHEN** 用户机器无法访问网络
- **THEN** 协议资产全部来自包内文件，行为不退化

#### Scenario: 版本可追溯

- **WHEN** 查看协议资产
- **THEN** 能明确指出它对应上游哪个 schema 版本与获取时间
