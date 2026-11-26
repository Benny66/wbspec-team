## 1. 协议资产冻结

- [x] 1.1 从上游 `schema.yaml` 提取产物依赖图，转成 `references/protocol/schema.json`（四产物 + apply 门槛），验证：`schema.json` 可被解析，产物顺序为 proposal → specs → design → tasks
- [x] 1.2 原样搬入四个模板到 `references/protocol/templates/`，验证：四文件与上游 `schemas/spec-driven/templates/` 的 sha256 逐一相等
- [x] 1.3 编写 `references/protocol/protocol.md`：目录布局、状态判定、五条校验规则、三种合并语义、降级步骤，验证：各成一节且含手工执行步骤
- [x] 1.4 编写 `references/protocol/SOURCE.md`：标明源自 `spec-driven` v1、上游 1.3.1、获取日期与 MIT 许可，验证：含版本号、许可名与差异对照表

## 2. wbspec 基础命令

- [x] 2.1 创建 `bin/wbspec` 入口与 `bin/wbspec.cjs` 实现，支持 `--version` / `--help`，验证：`wbspec --version` 输出 1.0.0 且退出码 0（拆成 sh + cjs 是为规避 `type: module` 目录下无扩展名脚本被当 ESM 执行的问题，已实测）
- [x] 2.2 实现 `init`：建 `specs/`、`changes/`、`changes/archive/`，已存在则跳过，验证：空项目执行后三目录存在；重复执行退出码仍为 0
- [x] 2.3 实现 `new <name>`：建目录 + 写两行 `.openspec.yaml`，重名时非 0 退出，验证：重名退出码 1 且既有变更未被覆盖
- [x] 2.4 实现 `status <name> --json`：输出产物状态、任务计数、`isComplete`、`remaining`，验证：完整变更输出四产物全 done、任务 2/2、`remaining=0`
- [x] 2.5 确认脚本只 require Node 内置模块，验证：实现文件仅 require `fs` 与 `path`，无三方包名

## 3. 结构校验

- [x] 3.1 实现主规格检查：缺 `## Purpose` 或 `## Requirements` 时报错，验证：缺 Purpose 时非 0 退出并指名该段落
- [x] 3.2 实现需求与场景检查：每条 `### Requirement:` 至少一个 `#### Scenario:`，验证：无场景的需求被点名
- [x] 3.3 实现场景层级检查：`### Scenario:` 等错误层级必须报错，验证：三井号场景判为错误
- [x] 3.4 实现 delta 标题检查：只允许 ADDED/MODIFIED/REMOVED 三种二级标题；RENAMED 显式拒绝并提示改用 REMOVED+ADDED，验证：RENAMED 与未知标题均报错
- [x] 3.5 实现收集式报错：一次列出全部问题后统一退出 1，且全程不写文件，验证：RENAMED 夹具同时报出两条问题；中止类用例执行后文件哈希不变

## 4. 归档与合并

- [x] 4.1 实现归档前置校验：校验不过或任务未勾选时中止，验证：失败后主规格哈希不变、变更目录未被移动、未产生 `.bak`
- [x] 4.2 实现主规格备份：被修改的文件先写 `.bak`，验证：归档后 `.bak` 存在且内容与合并前原文逐字节一致
- [x] 4.3 实现 ADDED 语义：追加到 Requirements 段末尾，验证：新需求出现在原需求之后，对账单显示 `+ 1 added`
- [x] 4.4 实现 MODIFIED 语义：按需求名原地替换整块，验证：被替换需求位置不变、旧内容消失、对账单显示 `~ 1 modified`
- [x] 4.5 实现 REMOVED 语义：删除同名块且其余顺序不变，验证：目标需求消失、其他需求保留、对账单显示 `- 1 removed`
- [x] 4.6 实现 RENAMED 拒绝：解析到 `## RENAMED Requirements` 时中止并提示改用 REMOVED+ADDED，验证：`validate` 与 `archive` 均非 0 退出且主规格无改动
- [x] 4.7 实现匹配失败中止：delta 声明 MODIFIED 但主规格无同名需求时报错，验证：退出非 0，主规格哈希不变，未产生 `.bak`
- [x] 4.8 实现先算后写：全部新内容算好后写入 `.tmp`，再统一 rename 覆盖，验证：中止类用例（校验失败、匹配失败、RENAMED）均在写盘前退出，主规格字节级不变
- [x] 4.9 实现对账单输出：`+N added` / `~N modified` / `-N removed` 与 Totals 行，验证：三项计数在三组合并用例中与预期一致
- [x] 4.10 实现归档移动：变更移入 `changes/archive/YYYY-MM-DD-<name>/`，验证：原路径消失、目标路径存在且带日期前缀

## 5. 测试夹具

- [x] 5.1 建立 `tests/fixtures/` 十个样本目录（空项目、完整变更、缺 Purpose、ADDED/MODIFIED/REMOVED 三例、匹配失败、RENAMED 拒绝、重名、任务格式错误），验证：目录数为 10
- [x] 5.2 编写 `tests/run.cjs`，对每个夹具执行命令并断言退出码、输出关键词与文件内容，验证：一次跑完 14 个用例并汇总
- [x] 5.3 为三个中止类夹具加入"前后 sha256 比对"（缺 Purpose、匹配失败、RENAMED 拒绝），验证：中止后主规格哈希不变
- [x] 5.4 跑通全部用例，验证：57 条断言全过，退出码 0

## 6. 替换与降级

- [x] 6.1 删除 `bin/vendor/openspec/` 与 `bin/openspec`，验证：包内不再存在 `vendor` 目录
- [x] 6.2 改写 `skills/workbuddy-spec-pipeline/SKILL.md`：命令换成 `wbspec`，新增无 Node 时的降级指引，并补充协议资产索引，验证：全文无 `openspec` 子命令调用
- [x] 6.3 改写 `agents/workbuddy-team-lead.md` 阶段 0 / 2 / 4 / 6 与中断恢复：用 `wbspec` 替代外部命令，验证：正文出现 `wbspec init`、`wbspec status`、`wbspec archive` 与降级说明
- [x] 6.4 更新 `scripts/validate_expert.py`：检查 `bin/wbspec` 可执行、实现文件仅用内置模块、协议四类资产齐全、包内无 `vendor/`，验证：170 项全过
- [x] 6.5 更新 `docs/install.md` 与 `README.md`：改为 wbspec 说明与降级说明，验证：两份文档不再出现 `bin/vendor`

## 7. 端到端与打包

- [x] 7.1 在空临时项目跑完整链路：`init → new → 写四件产物 → validate → archive`，验证：四产物齐全、主规格已创建、原变更已按日期归档
- [x] 7.2 对比真 CLI 兼容性：对 `wbspec` 产出的 delta 与主规格执行上游 `openspec validate`，验证：变更校验通过、主规格 `✓ spec/core`、上游 `show` 能解析需求与场景
- [x] 7.3 模拟无 Node 环境执行降级，验证：`wbspec` 退出码 127 并提示按 protocol.md 执行；手工归档后 `.bak` 与对账单均存在
- [x] 7.4 重新打包，验证：zip 123 KB（要求 ≤ 400 KB）、包内 28 个文件（要求 ≤ 30）
