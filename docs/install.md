# WorkBuddy 交付团：打包与提审

本仓库交付的是一个 **Team 型专家包**，遵循《WorkBuddy 专家开发规范》v2.4。

## 产物位置

```
workbuddy-team/                          ~224 KB
├── .codebuddy-plugin/plugin.json        配置与市场展示信息
├── avatars/                             6 张 512×512 PNG
├── agents/                              主理人 + 4 名成员
├── bin/
│   ├── wbspec                           工具入口（sh，负责找 node 与传递参数）
│   └── wbspec.cjs                       实现，单文件，只用 Node 标准库
├── skills/workbuddy-spec-pipeline/
│   ├── SKILL.md                         流水线执行细则
│   └── references/
│       ├── protocol/                    冻结的协议资产
│       │   ├── schema.json              产物依赖图
│       │   ├── protocol.md              目录 · 校验 · 合并 · 降级
│       │   ├── SOURCE.md                来源与版本记录
│       │   └── templates/               四个填空模板（逐字节来自上游）
│       └── openspec-skills/             四个官方技能（命令已映射到 wbspec）
├── settings.json
└── README.md

dist/workbuddy-dev-team.zip              提交用压缩包
scripts/validate_expert.py               规范一致性自检
tests/                                   回归测试与夹具（不随包分发）
```

## 为什么自建工具，而不是内置上游 CLI

上游 `@fission-ai/openspec` 装完是 16 MB、2750 个文件；而它对本专家真正有用的部分只有 7.4 KB 的协议定义（`schema.yaml` 154 行 + 四个模板）。专家只用到七个操作，其中六个是建目录、读文件这类平凡动作。

于是取舍是：**搬规则，不搬实现**。

- 协议原样冻结进 `references/protocol/`，模板逐字节复制，可用 sha256 与上游比对。
- 实现自己写：`bin/wbspec`，一个文件、零三方依赖、不联网。
- 文件格式与上游兼容，用户装了真 CLI 也能 `validate` 通过（已实测双向兼容）。

包体积因此从 3.4 MB 降到 224 KB，文件数从 2750 降到 20。

## 工具能力

| 命令 | 作用 | 失败行为 |
|---|---|---|
| `wbspec init` | 建 `specs/`、`changes/`、`changes/archive/` | 已存在则跳过，退出码 0 |
| `wbspec new <name>` | 建变更目录与两行 `.openspec.yaml` | 重名退出码 1，不覆盖 |
| `wbspec status <name> --json` | 产物状态 + 任务计数 | 目录不存在退出码 1 |
| `wbspec validate <name>` | 结构校验，一次列全问题 | 有问题退出码 1，不改文件 |
| `wbspec archive <name>` | 校验 → 备份 → 合并 → 对账单 → 移动 | 任一步失败即中止，零改动 |

归档的三层保护：

1. 校验不过就中止，主规格字节级不变（测试用 sha256 前后比对验证）
2. 合并前把将被修改的主规格备份为 `spec.md.bak`
3. 合并后输出对账单 `+N added / ~N modified / -N removed`，数字来自同一次计算

不实现 `RENAMED` 合并：上游解析器对改名块本身就会报 "no requirement entries parsed"，与其做一个可能改错名字的合并，不如显式拒绝并提示改用 `REMOVED + ADDED`。

## 回归测试

```bash
node tests/run.cjs
```

13 个用例、54 条断言，覆盖：初始化幂等、状态计数、新建能力归档、缺 Purpose 中止、ADDED / MODIFIED / REMOVED 三种合并、对不上号中止、RENAMED 拒绝、重名拒绝、任务格式校验、依赖白名单、`--skip-specs`。

其中三个中止类用例做「执行前后 sha256 比对」，确保"中止 = 零改动"不是口头承诺。

## 规范一致性自检

```bash
python3 scripts/validate_expert.py
```

覆盖规范 10.1 的全部一致性约束与 10.2 的清单项，当前 170 项全部通过，包括：`agentName` / 文件名 / frontmatter / `settings.json` 四方一致、头像尺寸与体积、Agent MD 不含 `tools` 字段、`displayDescription.zh` 长度、主理人含「团队协作机制（铁律）」、协议资产完整、包内无 `vendor/`。

## 打包

```bash
cd <仓库根目录>
rm -rf dist && mkdir -p dist
zip -r dist/workbuddy-dev-team.zip workbuddy-team -x "*.DS_Store"
```

## 提交审核

1. 把 `dist/workbuddy-dev-team.zip` 提交到 WorkBuddy 专家市场。
2. 自动校验（格式、字段、文件完整性、一致性）→ 人工审核（内容质量、安全合规、头像合规）→ 上架。

## 上线前需要手动替换的字段

| 位置 | 字段 | 当前值 |
|---|---|---|
| `plugin.json` | `author.email` | `bennywen@example.com`（占位） |
| `avatars/*.png` | 头像插画 | 程序生成的几何图形，规范要求"漫画/插画风格"，人工审核可能要求替换 |

## 降级路径

唯一外部依赖是 Node.js >= 18。若环境没有 Node：

1. `wbspec` 以退出码 127 结束，并提示按 `references/protocol/protocol.md` 第七节执行。
2. 手工完成建目录、写产物、校验、归档；**归档前备份与合并后对账单不可省略**。

已实测：无 Node 时工具给出明确提示；手工归档能正常产出 `.bak` 与对账单。

## 与 OpenSpec 的关系

- 协议（目录结构、产物依赖、delta 语义、校验规则）来自 OpenSpec `spec-driven` v1，冻结在包内，运行时不再依赖上游。
- 文件格式保持兼容，但**同一项目内二选一**：要么全程 `wbspec`，要么全程上游 CLI。
- 不修改 `.codebuddy/skills/openspec-*`（若项目里存在，它们由上游工具生成，会被 `openspec update --force` 覆盖）。
