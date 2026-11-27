# wbspec-team

一句话需求进，可验证的功能出。

一个 WorkBuddy **Team 型专家包**：把"探索 → 规格 → 批准 → 实现 → 验收 → 归档"六个阶段拆给五个角色，由主理人串联。你只说一次需求，并在规格写完后点一次头。

自带 `wbspec` 工具，**不依赖任何外部 CLI**。

## 团队

| 角色 | 称呼 | 职责 |
|---|---|---|
| 主理人 | 阿特 Atlas | 编排阶段、派发成员、汇总结果 |
| 需求澄清师 | 探路 Scout | 把模糊需求压成最多三个关键问题加一份假设清单 |
| 规格架构师 | 蓝图 Blue | 产出 proposal / specs / design / tasks 四件规格 |
| 全栈工程师 | 锻工 Forge | 按任务清单写代码，完成一条勾一条 |
| 验收工程师 | 验官 Verdict | 跑构建与测试，输出可定位的验收结论 |

`avatars/` 是同一套扁平漫画插画人物头像：主理人与 4 名成员各一张单人半身像，外加一张 5 人团队合影；按角色沿用专属渐变配色（阿特蓝 / 探路绿 / 蓝图靛紫 / 锻工橙 / 验官紫），均为 512×512 PNG，单张 ≤500KB。

## 流程

```
你说一句需求
    │
    ├─ 探路   澄清范围（可跳过，但假设必须写进闸门）
    ├─ 蓝图   写四件规格
    │
    ├─ 【停】范围 / 非目标 / 任务分解 / 风险与假设
    │        你点头 ← 全程唯一需要你说话的地方
    │
    ├─ 锻工   逐批实现，边做边勾
    ├─ 验官   构建 + 测试
    │    └ 失败 → 带证据回给锻工，最多 3 轮 → 仍不过就问你
    │
    └─ 归档   需求沉淀成长期文档
```

## 目录

```
workbuddy-team/                      可提交审核的专家包
├── .codebuddy-plugin/plugin.json    配置与市场展示信息
├── agents/                          主理人 + 4 名成员
├── avatars/                         6 张 512×512 PNG 人物头像（扁平漫画插画风）
├── bin/
│   ├── wbspec                       sh 入口
│   └── wbspec.cjs                   实现，只依赖 Node 标准库
├── skills/workbuddy-spec-pipeline/
│   ├── SKILL.md                     流水线执行细则
│   └── references/
│       ├── protocol/                冻结的协议：依赖图、模板、校验与合并规则
│       └── openspec-skills/         OpenSpec 四个官方技能的适配版
└── settings.json

tests/                              回归测试与夹具
scripts/validate_expert.py          专家包规范自检
docs/                               打包与提审说明
openspec/                           本项目自身的规格与变更记录
```

## 为什么自建 `wbspec`

上游 `@fission-ai/openspec` 装完 16 MB、2750 个文件，而专家真正用到的只有 7.4 KB 的协议（schema + 四个模板）。所以**搬规则不搬实现**：

- 协议冻结进 `references/protocol/`，模板逐字节复制
- 实现自己写：`bin/wbspec`，零三方依赖、不联网
- 文件格式与上游兼容，装了真 CLI 也能 `validate` 通过（已实测双向兼容）

包体积 3.4 MB → 约 1.93 MiB（28 个文件）：代码与协议合计约 81 KiB，其余约 1.85 MiB 是 6 张 512×512 漫画插画人物头像。

## 命令

```bash
wbspec init                  # 建 openspec/ 三目录
wbspec new <name>            # 建变更
wbspec status <name> --json  # 产物状态 + 任务计数
wbspec validate <name>       # 结构校验，一次列全问题
wbspec archive <name>        # 校验 → 备份 → 合并 → 对账单 → 移动
```

`archive` 的三层保护：校验不过即中止（主规格零改动）、合并前写 `.bak`、合并后输出 `+N / ~N / -N` 对账单。

不实现 `RENAMED` 合并——上游解析器对改名块本身就会报错，与其做个可能改错名字的合并，不如显式拒绝并提示改用 `REMOVED + ADDED`。

## 开发

```bash
node tests/run.cjs                  # 14 个用例 / 57 条断言
python3 scripts/validate_expert.py  # 规范一致性，170 项
```

打包提交：

```bash
mkdir -p dist && zip -r dist/workbuddy-dev-team.zip workbuddy-team -x "*.DS_Store"
```

## 前置条件

只有一个：Node.js >= 18。

没有 Node 时 `wbspec` 以退出码 127 结束并提示降级——按 `references/protocol/protocol.md` 手工执行，归档前的备份与合并后的对账单不可省略。

## 与 OpenSpec 的关系

协议（目录结构、产物依赖、delta 语义、校验规则）来自 OpenSpec `spec-driven` v1，冻结在包内，运行时不再依赖上游。文件格式保持兼容，但同一项目内二选一：要么全程 `wbspec`，要么全程上游 CLI。

## 许可

本仓库内的专家定义与 `wbspec` 实现原创。协议资产源自 [OpenSpec](https://github.com/Fission-AI/OpenSpec)（MIT），版权归其作者所有，详见 `workbuddy-team/skills/workbuddy-spec-pipeline/references/protocol/SOURCE.md`。
