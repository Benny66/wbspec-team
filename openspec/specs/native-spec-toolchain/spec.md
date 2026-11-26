# native-spec-toolchain Specification

## Purpose

TBD - created by archiving change replace-vendored-cli-with-wbspec. Update Purpose after archive.

## Requirements

### Requirement: 零三方依赖且可离线运行

`wbspec` MUST 是单个可执行文件，只使用 Node 标准库，MUST NOT 引入任何 npm 依赖、MUST NOT 发起网络请求。

#### Scenario: 干净环境直接可用

- **WHEN** 在只有 Node（>= 18）的机器上运行 `wbspec --version`
- **THEN** 输出工具版本并返回退出码 0，不触发任何安装步骤

#### Scenario: 无网络时功能完整

- **WHEN** 机器处于断网状态
- **THEN** 五个命令都能正常执行，行为与联网时一致

### Requirement: 初始化与创建变更

`wbspec init` MUST 创建 `openspec/specs/`、`openspec/changes/`、`openspec/changes/archive/` 三个目录，已存在时跳过而不是报错。`wbspec new <name>` MUST 创建变更目录并写入含 `schema` 与 `created` 两行的 `.openspec.yaml`。

#### Scenario: 空项目初始化

- **WHEN** 在没有任何 `openspec/` 目录的项目里执行 `wbspec init`
- **THEN** 三个目录被创建，命令返回退出码 0

#### Scenario: 重复初始化幂等

- **WHEN** 对已初始化的项目再次执行 `wbspec init`
- **THEN** 不报错、不覆盖已有内容，退出码仍为 0

#### Scenario: 变更重名被拒绝

- **WHEN** 执行 `wbspec new` 且目标目录已存在
- **THEN** 命令以非 0 退出码结束并说明重名，不覆盖已有变更

### Requirement: 状态查询

`wbspec status <name> --json` MUST 输出机器可读结果，包含四个产物的完成状态、任务总数与已完成数、是否达到实现条件。

#### Scenario: 完整变更

- **WHEN** 四个产物齐全且任务全部勾选
- **THEN** 输出的 `isComplete` 为 true，`remaining` 为 0

#### Scenario: 变更目录不存在

- **WHEN** 指定的变更名在 `changes/` 下不存在
- **THEN** 命令以非 0 退出码结束并给出可读错误，不输出伪造状态

### Requirement: 结构校验

`wbspec validate <name>` MUST 检查协议规定的结构约束，一次性列出全部问题而不是遇到第一个就停，发现问题时 MUST 以非 0 退出码结束，MUST NOT 自动修改任何文件。

#### Scenario: 主规格缺必需段落

- **WHEN** 待合并的主规格缺少 `## Purpose` 或 `## Requirements`
- **THEN** 校验输出指明缺失的段落名并返回非 0

#### Scenario: 需求缺场景

- **WHEN** 某个 `### Requirement:` 下没有任何 `#### Scenario:`
- **THEN** 校验指出该需求名并返回非 0

#### Scenario: 全部通过

- **WHEN** 结构完整且无约束违反
- **THEN** 校验返回退出码 0，且不修改任何文件

### Requirement: 安全归档

`wbspec archive <name>` MUST 依次执行：校验 → 备份被修改的主规格 → 按 delta 语义合并 → 输出对账单 → 将变更移入 `changes/archive/<YYYY-MM-DD>-<name>/`。任一前置校验失败时 MUST 中止，且 MUST NOT 留下任何文件改动。

#### Scenario: 校验失败时零改动

- **WHEN** 归档前的校验未通过
- **THEN** 命令中止并返回非 0，主规格、变更目录、archive 目录均保持原样

#### Scenario: 合并对账单

- **WHEN** 合并成功完成
- **THEN** 输出包含 `+N added`、`~N modified`、`-N removed` 与合计行的对账单

#### Scenario: 主规格备份

- **WHEN** 归档会修改某个已存在的主规格
- **THEN** 合并前生成该文件的 `.bak` 副本，合并后可据此回滚

#### Scenario: 归档目录命名

- **WHEN** 归档成功
- **THEN** 变更目录被移动到 `changes/archive/<YYYY-MM-DD>-<name>/`，原路径不再存在

### Requirement: 运行时缺失时的降级

当运行环境没有 Node 时，流程 MUST NOT 直接终止，而是按 `references/protocol/` 中的规则手工执行同等操作。手工归档 MUST 同样执行备份与对账单，MUST NOT 跳过。

#### Scenario: 无 Node 环境继续工作

- **WHEN** 执行 `wbspec` 时提示找不到 Node
- **THEN** 主理人转为按协议文档手工执行，并向用户说明当前处于降级模式

#### Scenario: 降级模式下的归档强度

- **WHEN** 在降级模式下归档
- **THEN** 主规格先被备份，合并后仍输出四项计数的对账单
