---
name: workbuddy-spec-pipeline
description: |
  规格驱动交付流水线的执行细则：wbspec 命令用法、阶段产物顺序、闸门摘要格式、验收证据契约、修复轮次上限、技术栈档案读写、中断恢复规则。
  触发词：交付流水线、规格产物、闸门、验收证据、修复轮次、技术栈档案、断点续跑
---

# 规格驱动交付流水线

本技能是主理人与成员的共用执行细则。主理人按阶段推进，成员按各自职责执行，所有交接通过磁盘上的 `openspec/` 产物完成。

## 零、运行环境

专家包自带工具 `wbspec`（`bin/wbspec`），安装后随 `bin/` 进入 PATH。它只用 Node 标准库，不联网、不安装任何依赖。

```bash
wbspec --version
```

PATH 未生效时用包内相对路径 `./bin/wbspec`。目标项目尚未初始化时先跑一次 `wbspec init`。

唯一外部依赖是 Node.js >= 18。**若环境没有 Node**，`wbspec` 会以退出码 127 结束并提示降级——此时按 `references/protocol/protocol.md` 第七节手工执行，其中「归档前备份」与「合并后对账单」两条不可省略。

## 一、产物与顺序

OpenSpec 的 `spec-driven` schema 固定四个产物，依赖关系如下：

```
proposal ──┬──▶ specs ──┐
           └──▶ design ─┴──▶ tasks
```

| 产物 | 内容 | 关键要求 |
|---|---|---|
| `proposal.md` | 为什么做、改什么、涉及哪些能力、影响面 | 不写实现细节 |
| `specs/<capability>/spec.md` | 需求与场景 | 用 SHALL/MUST；每条需求至少一个 WHEN/THEN 场景 |
| `design.md` | 技术决策、备选方案、风险、边界 | 必须回答"为什么这样选""不做什么""哪些文件别动" |
| `tasks.md` | 任务清单 | 每条可在单次会话完成，且写得出验证方式 |

命令：

```bash
wbspec init                            # 建 openspec/specs、changes、changes/archive
wbspec new <name>                      # 建变更目录与 .openspec.yaml
wbspec status <name> --json            # 产物状态 + 任务计数
wbspec validate <name>                 # 结构校验，一次列全问题
wbspec archive <name>                  # 校验 → 备份 → 合并 → 对账单 → 移动
wbspec archive <name> --skip-specs     # 纯工具/文档类变更，跳过规格合并
```

产物模板位于 `references/protocol/templates/`，写每一份产物前先读对应模板。

## 二、阶段与闸门

```
项目认路 → 澄清 → 规格 → [闸门] → 实现 → 验收 → 归档
                              ↑
                        全程唯一停点
```

闸门摘要必须四段齐全，缺一段就不算完成：

```
范围：<要做什么，3-5 条>
非目标：<明确不做什么，2-4 条>
任务分解：<分组概览 + 总条数>
风险与假设：<跳过的阶段、未决假设、需用户补齐的字段>
```

## 三、技术栈档案

存放位置：目标项目 `openspec/config.yaml` 的 `context` 段。

取值优先级：

1. 已有 `context` 中记录了语言框架、构建命令、测试命令 → 直接使用
2. 读项目清单文件推导：`package.json`、`go.mod`、`pyproject.toml`、`Cargo.toml`、`pom.xml`
3. 仍无法确定 → 一次性询问用户，只问一次

写回规则：

- 只写 `context` 段，保留文件其余内容
- 二次运行不重写，不产生重复条目
- 不删除、不重排用户手写的内容
- 无法确定的字段写「未知（需人工补充）」，不用推测值冒充确定值

最小字段集：语言与框架、构建命令、测试命令。

## 四、验收证据契约

验收结论只有四种：`通过` / `仅构建通过` / `失败` / `未验证`。

| 结论 | 含义 | 能否归档 |
|---|---|---|
| 通过 | 构建与测试都执行且退出码 0 | 可以 |
| 仅构建通过 | 构建 0，但项目没有测试命令 | 可以，但摘要必须标注"无测试覆盖" |
| 失败 | 任一已执行命令退出码非 0 | 不可以 |
| 未验证 | 构建都跑不起来 | 不可以 |

失败证据必须包含：执行的完整命令、退出码、失败用例名或错误文件与行号、关键输出片段（超长时保留首尾并标注截断）。

## 五、修复轮次

```
验收失败 → 证据回传锻工 → 修复 → 复验 → 轮次 +1
                                    │
                          满 3 轮仍失败 → 升级用户
```

升级报告必须含三块：失败摘要、已尝试的修复方向、至少两个可选后续方案（缩小范围 / 更换实现方案 / 人工介入）。

## 六、中断恢复

进度真源只有两个：`tasks.md` 的勾选状态、`wbspec status <name> --json` 的产物状态。

- 不依据对话记忆推断进度
- 恢复时先报「已完成 N / 剩余 M」
- 从第一个未勾选任务继续，不重做已完成任务
- 工具不可用时直接数 `tasks.md` 的 `- [x]` 与 `- [ ]`，并在报告中说明处于降级模式

## 七、归档

```bash
wbspec archive <name>                 # 归档并合并主规格
wbspec archive <name> --skip-specs    # 纯工具/文档类变更，跳过规格合并
```

归档前硬校验：任务全部勾选、验收结论为「通过」或「仅构建通过」、`wbspec validate` 无报错。

`archive` 自带三层保护，不要绕过：

1. 校验不过 → 中止，主规格零改动
2. 合并前把被修改的主规格备份为 `spec.md.bak`
3. 合并后输出对账单 `+N added / ~N modified / -N removed`，数字来自同一次计算

禁止手工移动目录或手工拼接主规格。降级模式下手工归档时，备份与对账单同样必须执行。

## 八、参考资产

| 资产 | 路径 | 何时读 |
|---|---|---|
| 协议说明 | `references/protocol/protocol.md` | 不确定状态怎么判、校验规则、合并语义、降级步骤时 |
| 产物模板 | `references/protocol/templates/*.md` | 写 proposal / specs / design / tasks 之前 |
| 依赖图 | `references/protocol/schema.json` | 通常无需直接读，`wbspec` 用它判断产物顺序 |
| 协议来源 | `references/protocol/SOURCE.md` | 需要说明版本与与上游的差异时 |

OpenSpec 官方四个技能已随包移植，放在 `references/openspec-skills/` 下，已清理与当前运行时不符的工具引用。按阶段查阅：

| 阶段 | 参考文档 | 用途 |
|---|---|---|
| 澄清 | `references/openspec-skills/explore.md` | 探索式提问、假设显式化、选项对比 |
| 规格 | `references/openspec-skills/propose.md` | 四件产物的写法与依赖顺序 |
| 实现 | `references/openspec-skills/apply.md` | 按任务推进、状态判定、中断处理 |
| 归档 | `references/openspec-skills/archive.md` | 归档前校验、规格同步、警告处理 |

## 九、与其他能力的关系

- 参考文档描述的是**单个阶段怎么做**；本流水线描述的是**阶段之间怎么衔接、谁来做、做完算不算完**。
- 两者不冲突：规格架构师可以参考官方写法，但阶段推进与验收结论由本流水线定义。
- 若目标项目里同时存在 OpenSpec 生成的 `.codebuddy/skills/openspec-*`，以本团队内置的定义为准，不去修改它们（上游 `openspec update --force` 会覆盖）。
- 文件格式与上游兼容，但**同一项目内二选一**：要么全程用 `wbspec`，要么全程用上游 CLI，不要交替调用，避免两边对格式细节的理解不同。
