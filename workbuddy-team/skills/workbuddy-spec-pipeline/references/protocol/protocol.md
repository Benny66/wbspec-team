# 规格协议（spec-driven v1）

本文件是 `wbspec` 的行为说明书。工具不可用时，按本文件手工执行同等操作。

## 一、目录布局

```
<项目根>/
├── openspec/
│   ├── specs/                      主规格：能力名 → 长期有效的需求
│   │   └── <capability>/spec.md
│   └── changes/
│       ├── <change-name>/          进行中的变更
│       │   ├── .openspec.yaml      schema 与创建日期，两行
│       │   ├── proposal.md
│       │   ├── specs/<cap>/spec.md delta 规格（可多个能力）
│       │   ├── design.md
│       │   └── tasks.md
│       └── archive/
│           └── <YYYY-MM-DD>-<change-name>/
```

`.openspec.yaml` 固定两行：

```yaml
schema: spec-driven
created: 2026-11-26
```

## 二、四个产物与依赖

```
proposal ──┬──▶ specs ──┐
           └──▶ design ─┴──▶ tasks ──▶ 可进入实现
```

| 产物 | 文件 | 依赖 |
|---|---|---|
| proposal | `proposal.md` | 无 |
| specs | `specs/**/*.md` | proposal |
| design | `design.md` | proposal |
| tasks | `tasks.md` | specs、design |

## 三、状态判定

- 某产物「完成」= 对应文件存在且非空（`specs` 指 `specs/` 下至少有一个 `.md`）
- 「可进入实现」= `tasks` 已完成
- 任务进度 = `tasks.md` 中 `- [x]` 的条数 ÷ `- [ ]` 与 `- [x]` 的总条数

没有别的状态来源。不依据对话记忆推断进度。

## 四、结构校验规则

校验失败即中止，列出**全部**问题后再退出，不修改任何文件。

1. 主规格必须同时含 `## Purpose` 与 `## Requirements` 两个二级标题
2. 每条 `### Requirement:` 下至少一个 `#### Scenario:`
3. 场景标题必须恰好四个井号（`### Scenario:` 判为错误）
4. delta 规格只能使用三种二级标题：`## ADDED Requirements`、`## MODIFIED Requirements`、`## REMOVED Requirements`
5. `tasks.md` 的任务行必须是 `- [ ]` 或 `- [x]`

`## RENAMED Requirements` 一律拒绝，改名请用 `REMOVED` + `ADDED` 表达。

## 五、delta 合并语义

合并以「需求名」为键，`### Requirement: <name>` 中的 `<name>` 就是键。

| 操作 | 行为 |
|---|---|
| ADDED | 追加到主规格 Requirements 段末尾 |
| MODIFIED | 用 delta 中的完整需求块，原地替换同名块（位置不变） |
| REMOVED | 删除同名块，其余顺序不变 |

铁律：

- MODIFIED / REMOVED 找不到同名需求 → **整体中止**，不写入任何内容
- 需求块范围 = 从 `### Requirement:` 起，到下一个 `### Requirement:` 或文件末尾
- 主规格不存在时按新能力创建：

```markdown
# <capability> Specification

## Purpose
TBD - created by archiving change <change-name>. Update Purpose after archive.
## Requirements
<合并后的需求块>
```

合并完成后必须输出对账单，三项计数必须来自同一次计算：

```
Specs to update:
  <capability>: create | update
Applying changes to openspec/specs/<capability>/spec.md:
  + N added
  ~ N modified
  - N removed
Totals: +N, ~N, -N
```

## 六、归档顺序

```
1. 校验        结构不通过 → 中止，零改动
2. 任务检查    存在未勾选任务 → 中止，零改动
3. 备份        每个将被修改的主规格 → spec.md.bak
4. 计算并暂存   全部新内容写入临时文件
5. 提交        临时文件 rename 覆盖
6. 移动变更    changes/<name>/ → changes/archive/<YYYY-MM-DD>-<name>/
7. 对账单      输出三项计数与合计
```

**先算后写**：任何一条 delta 对不上号，都在第 4 步之前中止，此时主规格尚未被触碰。

## 七、工具不可用时的手工执行

`wbspec` 依赖 Node。若环境中没有 Node，按下列步骤执行，强度不降：

1. **初始化**：`mkdir -p openspec/specs openspec/changes/archive`
2. **建变更**：`mkdir -p openspec/changes/<name>`，写入两行 `.openspec.yaml`
3. **状态**：用文件是否存在判断产物，用 `grep -c '^- \[x\]' tasks.md` 数进度
4. **校验**：按第四节五条规则逐条检查，写出问题清单
5. **归档**：
   - 先把每个将被修改的主规格复制为 `spec.md.bak`
   - 按第五节规则在内存里算出新内容
   - 全部算完再写盘（先写 `.tmp` 再 `mv`）
   - 最后 `mv openspec/changes/<name> openspec/changes/archive/<日期>-<name>`
   - 输出同样的对账单

手工执行时 MUST 保留备份与对账单，这是发现错误的唯一手段。

## 八、不要做的事

- 不要手工拼接主规格（会破坏需求块边界）
- 不要跳过备份直接覆盖主规格
- 不要在 `openspec/specs/` 里写 `## ADDED Requirements` 这类 delta 标题（那是变更目录的语法）
- 不要修改 `.codebuddy/skills/openspec-*`（若项目里存在，它们由上游工具生成）
