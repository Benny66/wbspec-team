# 协议来源与版本

| 项 | 值 |
|---|---|
| 上游项目 | OpenSpec（https://github.com/Fission-AI/OpenSpec） |
| 来源版本 | `@fission-ai/openspec` 1.3.1 |
| 来源文件 | `schemas/spec-driven/schema.yaml` 与 `schemas/spec-driven/templates/*.md` |
| 协议版本 | `spec-driven` schema v1 |
| 获取日期 | 2026-11-26 |
| 许可 | MIT |

## 搬运范围

- `templates/*.md`：四个填空模板，**逐字节复制**，未做改动（可用 sha256 与上游比对）。
- `schema.json`：从 `schema.yaml` 中提取产物 id、输出路径、依赖关系三项，转成 JSON 以便脚本读取。写作指令与示例**未搬入**，放在 `protocol.md` 中作为人读文档。
- `protocol.md`：目录布局、状态判定、校验规则、合并语义、降级步骤，依据上游行为整理并实测校对。

## 与上游的差异

| 项 | 上游 | 本协议 |
|---|---|---|
| RENAMED 合并 | 解析器会报 "no requirement entries parsed" | 显式拒绝，提示改用 REMOVED + ADDED |
| 交互式提示 | 有 | 无，全部非交互，失败即退出 |
| 遥测 | 有（匿名） | 无 |
| schema 扩展 | 支持自定义 schema | 只支持 `spec-driven` v1 |

## 冻结策略

协议资产随包分发，运行时**不向上游拉取任何内容**。

上游演进时，由维护者显式决定是否升级，并在本文件追加新的版本记录。不追新版是主动选择：稳定优先于新鲜。
