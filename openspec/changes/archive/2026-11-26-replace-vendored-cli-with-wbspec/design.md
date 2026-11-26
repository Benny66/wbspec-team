## Context

上一版把 OpenSpec 的 npm 包整体放进 `bin/vendor/`，包体积 3.4 MB、2750 个文件。而专家实际只用到其中 7.4 KB 的协议定义：

```
OpenSpec 包 16 MB
├── dist/          1.6 MB   命令分发与输出格式化
├── node_modules/ 13.6 MB   依赖（zod / posthog / yaml / inquirer / ora ...）
└── schemas/      7.4 KB   ← 真正的资产
    └── spec-driven/
        ├── schema.yaml       6.8 KB / 154 行：四个产物、依赖、写作指令
        └── templates/*.md    1.6 KB：四个填空模板
```

实测确认，专家用到的七个操作里，六个是文件系统的平凡操作：

| 操作 | 上游实现 | 实际逻辑 |
|---|---|---|
| `init` | 建目录 | 三个 `mkdir` |
| `new change` | 建目录 + 写两行 yaml | 同上 |
| `status` | 检查产物文件是否存在且非空 | 文件存在性判断 |
| `instructions` | 拼装模板与指令文本 | 静态文本 |
| `instructions apply` | 列出上下文文件 + 数勾选 | 正则计数 |
| `validate` | 结构规则检查 | 三到五条规则 |
| `archive` | 移动 + delta 合并 | 唯一的算法 |

结论：协议值钱，实现不值钱。本项目自行实现，协议原样搬运。

## Goals / Non-Goals

**Goals:**

- 用一个零依赖的单文件工具替代 16 MB 的外部包，包体积降到约 250 KB。
- 归档具备事务性：校验不过、合并失败时不留任何改动。
- 与真 CLI 的文件格式保持兼容，用户随时可以换用上游工具。
- 没有 Node 时流程仍可走完，只是从"脚本执行"变成"按规则手工执行"。

**Non-Goals:**

- 不追求与上游 CLI 的输出逐字节一致（只保证结构与语义一致）。
- 不实现上游的交互式提示、多工具安装、遥测、schema 扩展机制。
- 不实现 `instructions` 命令——模板是静态资产，直接作为参考文档提供。
- 不做 schema 热更新或向上游拉取。

## Decisions

### D1：运行时选 Node

| 备选 | 否决理由 |
|---|---|
| Python3 | macOS/Linux 常见，Windows 不保证；与目标用户（前端/Node 生态）重合度低于 Node |
| POSIX sh | 最普适，但 delta 合并用 awk/sed 实现，可读性与正确性都会崩掉 |
| **Node（采用）** | 开发者环境覆盖率高；`bin/` 用 node shebang 与平台机制一致；标准库足够（`fs`/`path`/`crypto`） |

约束：只用标准库，不读任何三方包，不联网。`.openspec.yaml` 只有两行且格式固定，手写解析即可，不引入 YAML 库。

### D2：命令边界——可逆的交提示词，不可逆的交脚本

五个命令按"出错能不能改回来"划线：

```
可逆                                不可逆
─────────────                       ─────────────
init   建目录      ────┐
new    建变更       ├──▶ 脚本执行，出错重建即可
status 只读        ────┘
validate 只读      ────▶ 脚本执行，只报不改
archive 覆盖主规格 ────▶ 脚本执行，事务 + 备份 + 对账单
```

`validate` 与 `archive` 是唯一有实际风险的操作，也是脚本存在的理由。其余三个包进来只为调用统一，不承担正确性责任。

### D3：协议以数据形式冻结

`schema.yaml` 中真正被程序用到的只有产物 id、输出路径、依赖三项。把这三项转成 `schema.json`：

```json
{ "artifacts": [
  { "id": "proposal", "generates": "proposal.md",   "requires": [] },
  { "id": "specs",    "generates": "specs/**/*.md", "requires": ["proposal"] },
  { "id": "design",   "generates": "design.md",     "requires": ["proposal"] },
  { "id": "tasks",    "generates": "tasks.md",      "requires": ["specs","design"] }
], "apply": { "requires": ["tasks"] } }
```

写作指令与模板是给人（模型）看的，原样放 `references/protocol/templates/`，脚本不读。

选择转 JSON 而非在脚本里硬编码依赖关系：依赖图是协议的一部分，应与模板放在一起；脚本只做解释器。理由是升级时能只改数据不改代码。

### D4：校验一次报全，且只报不改

`validate` 遇到第一个问题就退出会让用户来回跑很多次。因此实现为收集式：遍历全部约束，一次性列出，最后统一返回退出码 1。任何情况下不写文件——修复是作者的事，不是校验器的事。

规则集（与上游行为对齐的部分）：

1. 主规格必须含 `## Purpose` 与 `## Requirements`
2. 每条 `### Requirement:` 至少一个 `#### Scenario:`
3. 场景标题必须恰好四个井号
4. delta 规格只能使用三种二级标题之一：ADDED / MODIFIED / REMOVED
5. `tasks.md` 中的任务必须是 `- [ ]` 或 `- [x]` 形式

**关于 RENAMED 的实测结论**：上游 `archive` 对 `## RENAMED Requirements` 会报 "no requirement entries parsed"——它的解析器要求每个需求块带场景，而改名块天然没有场景。也就是说这条语义在上游本身就不稳。

因此 v1 **不支持 RENAMED**，遇到即报错并提示改用 `REMOVED` + `ADDED`。宁可拒绝，也不做一个可能错改名字的合并——改名失败的代价比少一个功能大得多。

### D5：归档做成事务，而不是一串写操作

朴素实现是"边合并边写盘"，中途失败会留下半合并的主规格。因此分四阶段：

```
1. 校验      全部通过才继续，否则 exit 1，零改动
2. 备份      被修改的每个主规格 → spec.md.bak
3. 计算+暂存  在内存里算出全部新内容，先写临时文件
4. 提交      全部临时文件就位后 rename 覆盖，再移动变更目录
```

关键点：**先算后写**。任何一个 delta 匹配不到需求名，在阶段 3 就中止，此时尚未覆盖任何文件，`.bak` 虽然已生成但主规格未被触碰。

对账单在阶段 3 结束时打印，与写盘结果来自同一份计算，不会出现"说改了 3 条实际改了 2 条"。

### D6：降级路径是流程的一部分，不是兜底口号

`wbspec` 启动时先检查 Node 是否存在。缺失时不是静默失败，而是给出可机读的提示，由主理人切换到手工模式：

```
wbspec 可用 ──▶ 正常执行
     │
     └─ 不可用 ──▶ 主理人按 protocol.md 手工执行
                    ├─ 归档必须备份
                    ├─ 合并后必须出对账单
                    └─ 向用户声明当前处于降级模式
```

降级不是"功能打折"，只是"执行者从脚本换成模型"。对账单与备份这两条强度不降——它们是发现错误的唯一手段。

### D7：目录名与格式不动

继续使用 `openspec/`，继续写 `.openspec.yaml`。理由：所有既有技能、命令、文档都指向这个路径；改名的收益只是"看起来自洽"，代价是断掉与上游的互操作。

兼容性口径：**结构兼容，不承诺逐字节一致**。用户若装了真 CLI，`validate` 能通过；但两边生成的空行、段落间距可能有细微差别。

### D8：用 fixture 换信任

自己写的实现，唯一能建立信任的方式是覆盖边界。测试目录：

```
tests/fixtures/
├── empty-project/             init 建三个目录
├── complete-change/           status 报 4/4
├── missing-purpose/           主规格缺 Purpose → archive 中止且零改动
├── merge-added/               ADDED 追加到末尾
├── merge-modified/            MODIFIED 原地替换，位置不变
├── merge-removed/             REMOVED 删除，其余顺序不变
├── merge-renamed/             RENAMED 只改名
├── merge-unmatched/           MODIFIED 找不到同名 → 中止，主规格字节级不变
├── duplicate-change/          new 拒绝重名
└── empty-tasks/               validate 报错
```

断言方式：对归档类 fixture 做"合并前哈希 vs 失败后哈希"比对，确保中止等于零改动。

### D9：与包校验脚本的关系

`scripts/validate_expert.py` 现有检查项包含"bin/openspec 存在""内置 CLI 存在"，需要改为检查 `bin/wbspec` 存在且可执行、`references/protocol/` 四类资产齐全、包内不存在 `vendor/`。

## Risks / Trade-offs

**R1：自己实现会有 bug** → 用 D8 的 fixture 覆盖四条合并语义与三种中止场景；宁可少支持（比如不实现 RENAMED 以外的复杂场景），也要每条都有断言。

**R2：Node 缺失** → D6 降级；降级路径本身也要在文档里写清步骤，而不是一句"手工执行"。

**R3：上游协议演进导致我们落后** → 协议冻结并标注来源版本；不追新版是主动选择，接受落后，换来稳定。

**R4：跨文件修改不是真原子** → 先用临时文件再 rename，缩小窗口；即使极端中断，`.bak` 提供回滚点。不追求文件系统级事务。

**R5：用户同时用真 CLI 可能冲突** → 两边都遵守同一目录结构，冲突概率低；文档说明"二选一，不要同时调用"。

**R6：`wbspec` 与 PATH 中已有命令重名** → 名字足够独特；如仍冲突，可改为 `wb-spec`，只影响包装脚本一行。

## Migration Plan

1. 删除 `bin/vendor/openspec/`（16 MB）与 `bin/openspec`。
2. 新增 `bin/wbspec`，`chmod +x`，确认 shebang 为 `#!/usr/bin/env node`。
3. 新增 `references/protocol/`：`schema.json`、`templates/`、`protocol.md`、`SOURCE.md`（版本与来源标注）。
4. 改写 `skills/workbuddy-spec-pipeline/SKILL.md`、`agents/workbuddy-team-lead.md`、`docs/install.md`、`scripts/validate_expert.py` 中的命令与检查项。
5. 重新打包，确认 zip 体积降到约 250 KB。

回滚：以上改动均在 git 内，`git checkout` 回到本变更前即可；主规格与用户项目不受影响（本变更为工具层替换）。

## Open Questions

1. `wbspec` 是否需要支持一次归档多个变更？（默认不支持，一次一个，符合"一次变更一次交付"的语义）
2. 归档后是否自动清理 `.bak`？（默认保留，作为回滚证据；下次归档同一文件时覆盖）
3. 是否需要 `wbspec sync` 单独做规格合并而不移动目录？（默认不需要，合并与归档绑定）
