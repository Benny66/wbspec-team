## ADDED Requirements

### Requirement: 技术栈档案的作用域

技术栈档案 MUST 按项目存储，位于该项目 `openspec/config.yaml` 的 `context` 段。角色文件本身 MUST NOT 硬编码任何具体技术栈。

#### Scenario: 角色可跨项目复用

- **WHEN** 同一套角色在 Go 项目与 Node 项目中使用
- **THEN** 角色文件内容完全一致，差异只体现在各自项目的 `openspec/config.yaml`

#### Scenario: 缺档案时的可见降级

- **WHEN** 项目尚未写入技术栈档案
- **THEN** 系统在开始实现前完成一次探测或询问，而不是按默认技术栈直接开工

### Requirement: 探测顺序

获取技术栈信息 MUST 按以下优先级：已有档案 → 项目清单文件（如 `package.json`、`go.mod`、`pyproject.toml`、`Cargo.toml`、`pom.xml`）→ 询问用户。前一级有确定答案时 MUST NOT 继续向下询问。

#### Scenario: 复用已有档案

- **WHEN** `openspec/config.yaml` 的 `context` 已包含构建与测试命令
- **THEN** 系统直接使用，不再读取清单文件或询问用户

#### Scenario: 从清单文件推导

- **WHEN** 档案缺失但项目根存在清单文件
- **THEN** 系统从该文件推导语言、框架、构建与测试命令，并在摘要中标注为"自动推导"

#### Scenario: 无法推导时询问

- **WHEN** 既无档案也无清单文件
- **THEN** 系统一次性询问技术栈与验证命令，且只问一次

### Requirement: 档案写回与幂等

探测结果 MUST 写回该项目 `openspec/config.yaml` 的 `context` 段，MUST 保留文件其余内容不变。同一项目重复运行 MUST NOT 反复重写或产生重复条目。

#### Scenario: 首次写入

- **WHEN** `context` 段为空且探测得到结果
- **THEN** 系统写入技术栈、构建命令、测试命令三项，文件其余部分保持原样

#### Scenario: 二次运行不重写

- **WHEN** 档案已存在并再次进入同一项目
- **THEN** 系统不修改 `config.yaml`，直接使用现有档案

#### Scenario: 不覆盖人工内容

- **WHEN** 用户在 `context` 中手写过约定
- **THEN** 系统只做追加或跳过，不删除、不重排用户已有内容

### Requirement: 档案内容的最小集

档案 MUST 至少包含：主要语言与框架、构建命令、测试命令。任一缺失时 MUST 标注为"未知"，MUST NOT 用推测值填充为确定值。

#### Scenario: 字段缺失标注

- **WHEN** 项目使用非标准构建方式，无法推断构建命令
- **THEN** 该字段写入"未知（需人工补充）"，并在闸门摘要中提示用户补齐
