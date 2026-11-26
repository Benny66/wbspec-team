## Why

上一版为了让专家开箱即用，把整个 OpenSpec npm 包塞进了 `bin/`：压缩后 3.4 MB、解包 16 MB、2750 个文件。而专家真正用到的只有其中 7.4 KB 的协议定义——`schema.yaml` 154 行加四个模板。用一整套整装工具去跑七个简单操作，代价与收益严重不成比例，也让上架审核多出一堆需要解释的文件。

同时这仍然是一种外部依赖：用户装的其实是第三方 CLI，它的行为、体积、遥测都不在我们控制范围内。

OpenSpec 真正值钱的是协议，不是实现。把协议搬过来、实现自己写，才能既是"站在巨人肩膀上"，又不被巨人的体重拖住。

## What Changes

- **移除** `bin/vendor/openspec/`（16 MB）与 `bin/openspec` 包装脚本。
- **新增** `bin/wbspec`：单文件、只用标准库的 Node 工具，提供 `init` / `new` / `status` / `validate` / `archive` 五个命令。
- **新增** `skills/workbuddy-spec-pipeline/references/protocol/`：冻结的协议资产——产物依赖图（`schema.json`）、四个模板、结构校验规则、delta 合并规则。
- **归档语义升级**：`wbspec archive` 先备份主规格，再按 ADDED / MODIFIED / REMOVED / RENAMED 合并，输出对账单，最后移入 `changes/archive/`；校验不通过时**零改动中止**。
- **保留** `openspec/` 目录名与全部文件格式，专家写出的内容仍可被真 CLI 读取与校验。
- **新增降级路径**：运行环境没有 Node 时，按 `protocol.md` 手工执行；归档同样强制备份与对账单。
- **改写**主理人 MD 与流水线 SKILL 中的调用方式，不再引用外部 `openspec` 命令。

## Capabilities

### New Capabilities

- `native-spec-toolchain`: 自建工具的五个命令——输入输出契约、失败时的退出行为、零依赖约束、运行时缺失时的降级。
- `spec-protocol`: 冻结的协议定义——目录布局、产物依赖图、结构校验规则、delta 合并语义、与上游的版本对应关系。

### Modified Capabilities

- `spec-pipeline`: 归档方式由外部 `openspec` 命令改为 `wbspec archive`；新增归档前校验与合并对账单要求；新增无运行时时的降级要求。

## Impact

- 包体积从 3.4 MB 降到约 250 KB，文件数从 2750 降到约 20。
- 新增对 Node（>= 18，仅标准库）的显式要求；无 Node 时走降级路径，不阻断使用。
- 改动范围：`bin/`、`skills/workbuddy-spec-pipeline/`、`agents/workbuddy-team-lead.md`、`scripts/validate_expert.py`、`docs/install.md`。
- 不影响 `agents/` 中的其余四个成员、`avatars/`、`settings.json`、`plugin.json` 的结构字段。
- 已归档的 `openspec/specs/` 主规格不变。
