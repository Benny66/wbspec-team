#!/usr/bin/env node
'use strict';

/**
 * wbspec —— spec-driven 协议的最小实现
 * 只用 Node 标准库，不联网，不读写协议文件以外的任何路径。
 */

const fs = require('fs');
const path = require('path');

const VERSION = '1.0.0';
const ROOT = 'openspec';
const SCHEMA_NAME = 'spec-driven';

const DELTA_ADDED = '## ADDED Requirements';
const DELTA_MODIFIED = '## MODIFIED Requirements';
const DELTA_REMOVED = '## REMOVED Requirements';
const DELTA_RENAMED = '## RENAMED Requirements';

// ---------------------------------------------------------------- 基础工具

function fail(message, code = 1) {
  process.stderr.write(message.replace(/\n?$/, '\n'));
  process.exit(code);
}

function exists(p) {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readFileOrNull(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function relToCwd(p) {
  const r = path.relative(process.cwd(), p);
  return r === '' ? '.' : r;
}

function listMarkdown(dir) {
  if (!isDir(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdown(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out.sort();
}

// ---------------------------------------------------------------- 协议装载

function loadSchema() {
  const candidates = [
    path.join(__dirname, '..', 'skills', 'workbuddy-spec-pipeline', 'references', 'protocol', 'schema.json'),
    path.join(__dirname, '..', 'references', 'protocol', 'schema.json'),
  ];
  for (const p of candidates) {
    const raw = readFileOrNull(p);
    if (!raw) continue;
    try {
      const schema = JSON.parse(raw);
      if (!Array.isArray(schema.artifacts) || !schema.artifacts.length) continue;
      return schema;
    } catch (err) {
      fail(`wbspec: 协议文件解析失败 ${p}: ${err.message}`, 3);
    }
  }
  fail('wbspec: 找不到协议文件 schema.json，包可能不完整', 3);
}

// ---------------------------------------------------------------- 文本解析

function parseMainSpec(text) {
  const m = /^## Requirements[ \t]*$/m.exec(text);
  if (!m) return null;
  const head = text.slice(0, m.index).replace(/\s+$/, '');
  const body = text.slice(m.index + m[0].length);
  return { head, body };
}

function splitRequirementBlocks(body) {
  const re = /^### Requirement:[ \t]*(.+?)[ \t]*$/gm;
  const marks = [];
  let m;
  while ((m = re.exec(body)) !== null) {
    marks.push({ index: m.index, name: m[1].trim() });
  }
  const blocks = marks.map((mk, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : body.length;
    return { name: mk.name, text: body.slice(mk.index, end).replace(/\s+$/, '') };
  });
  return blocks;
}

function renderMainSpec(head, blocks) {
  const joined = blocks.map((b) => b.text).join('\n\n');
  return `${head}\n\n## Requirements\n\n${joined}\n`;
}

function newCapabilitySpec(capability, changeName, blocks) {
  const head = `# ${capability} Specification\n\n## Purpose\n\nTBD - created by archiving change ${changeName}. Update Purpose after archive.`;
  return renderMainSpec(head, blocks);
}

function parseDelta(text) {
  const result = { added: [], modified: [], removed: [], renamed: false, unknown: [] };
  const re = /^## (.+?)[ \t]*$/gm;
  const marks = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    marks.push({ index: m.index, title: m[1].trim() });
  }
  for (let i = 0; i < marks.length; i += 1) {
    const title = marks[i].title;
    const bodyStart = text.indexOf('\n', marks[i].index);
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
    const body = bodyStart === -1 ? '' : text.slice(bodyStart, end);
    const blocks = splitRequirementBlocks(body);
    if (title === 'ADDED Requirements') result.added.push(...blocks);
    else if (title === 'MODIFIED Requirements') result.modified.push(...blocks);
    else if (title === 'REMOVED Requirements') result.removed.push(...blocks);
    else if (title === 'RENAMED Requirements') result.renamed = true;
    else result.unknown.push(title);
  }
  return result;
}

function countTasks(text) {
  let complete = 0;
  let total = 0;
  for (const line of text.split('\n')) {
    const m = /^\s*- \[([ xX])\]/.exec(line);
    if (!m) continue;
    total += 1;
    if (m[1].toLowerCase() === 'x') complete += 1;
  }
  return { complete, total, remaining: total - complete };
}

// ---------------------------------------------------------------- 路径解析

function changeDir(name) {
  return path.join(process.cwd(), ROOT, 'changes', name);
}

function mainSpecPath(capability) {
  return path.join(process.cwd(), ROOT, 'specs', capability, 'spec.md');
}

function requireChange(name) {
  const dir = changeDir(name);
  if (!isDir(dir)) fail(`wbspec: 变更不存在: ${ROOT}/changes/${name}`, 1);
  return dir;
}

function artifactDone(dir, artifact) {
  const target = path.join(dir, artifact.generates);
  if (artifact.generates.includes('**')) {
    return listMarkdown(path.join(dir, 'specs')).length > 0;
  }
  if (!exists(target)) return false;
  try {
    return fs.statSync(target).size > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- 校验

function collectIssues(dir, options = {}) {
  const requireDeltas = options.requireDeltas !== false;
  const issues = [];

  const deltaFiles = listMarkdown(path.join(dir, 'specs'));
  if (!deltaFiles.length && requireDeltas) {
    issues.push('变更目录下没有任何 delta 规格（specs/<capability>/spec.md）');
  }

  for (const file of deltaFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const rel = relToCwd(file);

    if (new RegExp(`^${DELTA_RENAMED}[ \\t]*$`, 'm').test(text)) {
      issues.push(`${rel}: 不支持 RENAMED，请改用 REMOVED + ADDED 表达改名`);
    }

    const delta = parseDelta(text);
    for (const title of delta.unknown) {
      issues.push(`${rel}: 未知的 delta 标题 "## ${title}"，只允许 ADDED / MODIFIED / REMOVED`);
    }
    if (!delta.added.length && !delta.modified.length && !delta.removed.length) {
      issues.push(`${rel}: 没有解析到任何需求条目`);
    }

    issues.push(...checkScenarioLevel(rel, text));
    issues.push(...checkRequirementScenarios(rel, delta.added.concat(delta.modified)));

    for (const block of delta.removed) {
      if (!/\*\*Reason\*\*/i.test(block.text)) {
        issues.push(`${rel}: REMOVED 需求 "${block.name}" 缺少 **Reason**`);
      }
    }
  }

  for (const capability of touchedCapabilities(dir)) {
    const specPath = mainSpecPath(capability);
    if (!exists(specPath)) continue;
    const rel = relToCwd(specPath);
    const text = fs.readFileSync(specPath, 'utf8');
    if (!/^## Purpose[ \t]*$/m.test(text)) issues.push(`${rel}: 缺少 "## Purpose" 段落`);
    if (!/^## Requirements[ \t]*$/m.test(text)) issues.push(`${rel}: 缺少 "## Requirements" 段落`);
    const parsed = parseMainSpec(text);
    if (parsed) {
      const blocks = splitRequirementBlocks(parsed.body);
      issues.push(...checkRequirementScenarios(rel, blocks));
      issues.push(...checkScenarioLevel(rel, text));
    }
  }

  const tasksPath = path.join(dir, 'tasks.md');
  const tasksText = readFileOrNull(tasksPath);
  if (tasksText !== null) {
    const rel = relToCwd(tasksPath);
    let index = 0;
    for (const line of tasksText.split('\n')) {
      index += 1;
      if (!/^\s*[-*]\s*\[/.test(line)) continue;
      if (!/^\s*- \[[ xX]\]/.test(line)) {
        issues.push(`${rel}:${index}: 任务必须是 "- [ ]" 或 "- [x]" 形式`);
      }
    }
  }

  return issues;
}

function checkScenarioLevel(rel, text) {
  const issues = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (/^#{1,3} Scenario:/.test(line)) {
      issues.push(`${rel}:${i + 1}: 场景标题必须使用四个井号 "#### Scenario:"`);
    }
  });
  return issues;
}

function checkRequirementScenarios(rel, blocks) {
  const issues = [];
  for (const block of blocks) {
    if (!/^#### Scenario:/m.test(block.text)) {
      issues.push(`${rel}: 需求 "${block.name}" 缺少 "#### Scenario:"`);
    }
  }
  return issues;
}

function touchedCapabilities(dir) {
  const specRoot = path.join(dir, 'specs');
  if (!isDir(specRoot)) return [];
  return fs
    .readdirSync(specRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

// ---------------------------------------------------------------- 命令实现

function ensureRoot() {
  const root = path.join(process.cwd(), ROOT);
  for (const dir of ['specs', 'changes', 'changes/archive']) {
    ensureDir(path.join(root, dir));
  }
}

function cmdInit() {
  ensureRoot();
  process.stdout.write(`openspec/ 已就绪（${ROOT}/specs, ${ROOT}/changes, ${ROOT}/changes/archive）\n`);
}

function cmdNew(name) {
  if (!name) fail('wbspec: 用法 wbspec new <kebab-case-name>', 2);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    fail(`wbspec: 变更名不合法 "${name}"，只允许小写字母、数字与连字符`, 2);
  }
  ensureRoot();
  const dir = changeDir(name);
  if (exists(dir)) fail(`wbspec: 变更已存在: ${ROOT}/changes/${name}`, 1);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, '.openspec.yaml'), `schema: ${SCHEMA_NAME}\ncreated: ${today()}\n`, 'utf8');
  process.stdout.write(`已创建变更 ${ROOT}/changes/${name}（schema: ${SCHEMA_NAME}）\n`);
}

function buildStatus(name, schema) {
  const dir = requireChange(name);
  const artifacts = schema.artifacts.map((a) => ({
    id: a.id,
    outputPath: a.generates,
    status: artifactDone(dir, a) ? 'done' : 'pending',
    requires: a.requires || [],
  }));
  const doneIds = new Set(artifacts.filter((a) => a.status === 'done').map((a) => a.id));
  const tasksText = readFileOrNull(path.join(dir, 'tasks.md'));
  const tasks = tasksText === null ? { complete: 0, total: 0, remaining: 0 } : countTasks(tasksText);
  const applyRequires = (schema.apply && schema.apply.requires) || [];
  return {
    changeName: name,
    schemaName: SCHEMA_NAME,
    isComplete: applyRequires.every((id) => doneIds.has(id)),
    applyRequires,
    artifacts,
    tasks,
  };
}

function cmdStatus(name, asJson) {
  if (!name) fail('wbspec: 用法 wbspec status <name> [--json]', 2);
  const schema = loadSchema();
  const status = buildStatus(name, schema);
  if (asJson) {
    process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    return;
  }
  process.stdout.write(`变更: ${status.changeName}\n`);
  for (const a of status.artifacts) {
    process.stdout.write(`  ${a.status === 'done' ? '✓' : ' '} ${a.id.padEnd(9)} ${a.outputPath}\n`);
  }
  process.stdout.write(`任务: ${status.tasks.complete}/${status.tasks.total} 完成\n`);
  process.stdout.write(`可进入实现: ${status.isComplete ? '是' : '否'}\n`);
}

function cmdValidate(name) {
  if (!name) fail('wbspec: 用法 wbspec validate <name>', 2);
  const dir = requireChange(name);
  const issues = collectIssues(dir);
  if (issues.length) {
    process.stdout.write(`校验未通过（${issues.length} 项）:\n`);
    for (const issue of issues) process.stdout.write(`  ✗ ${issue}\n`);
    process.exit(1);
  }
  process.stdout.write(`校验通过: ${name}\n`);
}

function planMerge(changeName, dir) {
  const capabilities = touchedCapabilities(dir);
  const plans = [];
  const totals = { added: 0, modified: 0, removed: 0 };

  for (const capability of capabilities) {
    const deltaPath = path.join(dir, 'specs', capability, 'spec.md');
    if (!exists(deltaPath)) continue;
    const deltaText = fs.readFileSync(deltaPath, 'utf8');
    if (new RegExp(`^${DELTA_RENAMED}[ \\t]*$`, 'm').test(deltaText)) {
      fail(`wbspec: ${capability} 的 delta 含 RENAMED，请改用 REMOVED + ADDED`, 1);
    }
    const delta = parseDelta(deltaText);
    const specPath = mainSpecPath(capability);
    const existed = exists(specPath);

    let blocks = [];
    let head = null;
    if (existed) {
      const mainText = fs.readFileSync(specPath, 'utf8');
      const parsed = parseMainSpec(mainText);
      if (!parsed) fail(`wbspec: ${relToCwd(specPath)} 缺少 "## Requirements" 段落，无法合并`, 1);
      blocks = splitRequirementBlocks(parsed.body);
      head = parsed.head;
    }

    const indexByName = new Map(blocks.map((b, i) => [b.name, i]));
    const counts = { added: 0, modified: 0, removed: 0 };

    for (const mod of delta.modified) {
      const i = indexByName.get(mod.name);
      if (i === undefined) {
        fail(`wbspec: MODIFIED 找不到同名需求 "${mod.name}"（能力 ${capability}），已中止`, 1);
      }
      blocks[i] = { name: mod.name, text: mod.text };
      counts.modified += 1;
    }

    const removedNames = new Set();
    for (const rm of delta.removed) {
      if (!indexByName.has(rm.name) && !delta.modified.some((m) => m.name === rm.name)) {
        fail(`wbspec: REMOVED 找不到同名需求 "${rm.name}"（能力 ${capability}），已中止`, 1);
      }
      removedNames.add(rm.name);
      counts.removed += 1;
    }
    if (removedNames.size) {
      blocks = blocks.filter((b) => !removedNames.has(b.name));
    }

    for (const add of delta.added) {
      if (blocks.some((b) => b.name === add.name)) {
        fail(`wbspec: ADDED 的需求 "${add.name}" 在主规格中已存在（能力 ${capability}），已中止`, 1);
      }
      blocks.push({ name: add.name, text: add.text });
      counts.added += 1;
    }

    const content = existed
      ? renderMainSpec(head, blocks)
      : newCapabilitySpec(capability, changeName, blocks);

    totals.added += counts.added;
    totals.modified += counts.modified;
    totals.removed += counts.removed;
    plans.push({ capability, specPath, existed, content, counts });
  }

  return { plans, totals };
}

function cmdArchive(name, options) {
  if (!name) fail('wbspec: 用法 wbspec archive <name> [--skip-specs]', 2);
  const dir = requireChange(name);

  const skipSpecs = options.includes('--skip-specs');

  // 1. 校验
  const issues = collectIssues(dir, { requireDeltas: !skipSpecs });
  if (issues.length) {
    process.stdout.write(`归档中止，校验未通过（${issues.length} 项）:\n`);
    for (const issue of issues) process.stdout.write(`  ✗ ${issue}\n`);
    process.exit(1);
  }

  // 2. 任务检查
  const tasksText = readFileOrNull(path.join(dir, 'tasks.md'));
  if (tasksText !== null) {
    const { remaining } = countTasks(tasksText);
    if (remaining > 0) {
      fail(`wbspec: 还有 ${remaining} 条任务未完成，已中止`, 1);
    }
  }

  // 3. 计算（先算后写）
  let merge = { plans: [], totals: { added: 0, modified: 0, removed: 0 } };
  if (!skipSpecs) merge = planMerge(name, dir);

  // 4. 备份 + 暂存 + 提交
  for (const plan of merge.plans) {
    if (plan.existed) {
      const backup = `${plan.specPath}.bak`;
      fs.copyFileSync(plan.specPath, backup);
    }
    ensureDir(path.dirname(plan.specPath));
    const tmp = `${plan.specPath}.tmp`;
    fs.writeFileSync(tmp, plan.content, 'utf8');
  }
  for (const plan of merge.plans) {
    fs.renameSync(`${plan.specPath}.tmp`, plan.specPath);
  }

  // 5. 移动变更
  const archiveRoot = path.join(process.cwd(), ROOT, 'changes', 'archive');
  ensureDir(archiveRoot);
  const target = path.join(archiveRoot, `${today()}-${name}`);
  if (exists(target)) fail(`wbspec: 归档目标已存在: ${relToCwd(target)}`, 1);
  fs.renameSync(dir, target);

  if (merge.plans.length) {
    process.stdout.write('Specs to update:\n');
    for (const plan of merge.plans) {
      process.stdout.write(`  ${plan.capability}: ${plan.existed ? 'update' : 'create'}\n`);
    }
    for (const plan of merge.plans) {
      process.stdout.write(`Applying changes to ${relToCwd(plan.specPath)}:\n`);
      process.stdout.write(`  + ${plan.counts.added} added\n`);
      process.stdout.write(`  ~ ${plan.counts.modified} modified\n`);
      process.stdout.write(`  - ${plan.counts.removed} removed\n`);
    }
    const t = merge.totals;
    process.stdout.write(`Totals: +${t.added}, ~${t.modified}, -${t.removed}\n`);
  } else {
    process.stdout.write('Specs: skipped（本次未涉及规格变更）\n');
  }
  process.stdout.write(`变更已归档为 ${relToCwd(target)}\n`);
}

// ---------------------------------------------------------------- 入口

function usage() {
  process.stdout.write(
    [
      `wbspec ${VERSION} —— spec-driven 协议的最小实现`,
      '',
      '用法:',
      '  wbspec init                     初始化 openspec/ 目录',
      '  wbspec new <name>               创建变更',
      '  wbspec status <name> [--json]   查看产物与任务状态',
      '  wbspec validate <name>          结构校验',
      '  wbspec archive <name> [--skip-specs]  归档并合并主规格',
      '  wbspec --version | --help',
      '',
    ].join('\n'),
  );
}

function main(argv) {
  const args = argv.slice(2);
  if (!args.length || args[0] === '--help' || args[0] === '-h') {
    usage();
    return;
  }
  if (args[0] === '--version' || args[0] === '-v') {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  const command = args[0];
  const positional = args.slice(1).filter((a) => !a.startsWith('--'));
  const flags = args.slice(1).filter((a) => a.startsWith('--'));

  switch (command) {
    case 'init':
      return cmdInit();
    case 'new':
      return cmdNew(positional[0]);
    case 'status':
      return cmdStatus(positional[0], flags.includes('--json'));
    case 'validate':
      return cmdValidate(positional[0]);
    case 'archive':
      return cmdArchive(positional[0], flags);
    default:
      return fail(`wbspec: 未知命令 "${command}"，运行 wbspec --help`, 2);
  }
}

main(process.argv);
