#!/usr/bin/env node
'use strict';

/**
 * wbspec 回归测试。每个用例把 fixtures 下的样本复制到临时目录再执行，
 * 断言退出码、输出关键词与文件内容，归档类用例额外比对哈希以证明"中止 = 零改动"。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const WB = path.join(ROOT, 'workbuddy-team', 'bin', 'wbspec');
const FIXTURES = path.join(__dirname, 'fixtures');

let passed = 0;
const failures = [];

function check(condition, message) {
  if (condition) {
    passed += 1;
    process.stdout.write(`  ✓ ${message}\n`);
  } else {
    failures.push(message);
    process.stdout.write(`  ✗ ${message}\n`);
  }
}

function run(projectDir, args) {
  const result = spawnSync(WB, args, { cwd: projectDir, encoding: 'utf8' });
  return {
    code: result.status === null ? -1 : result.status,
    out: `${result.stdout || ''}${result.stderr || ''}`,
  };
}

function withFixture(name, fn) {
  const src = path.join(FIXTURES, name);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `wbspec-${name}-`));
  const dest = path.join(tmp, 'project');
  fs.cpSync(src, dest, { recursive: true });
  try {
    fn(dest);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function specPath(project, capability) {
  return path.join(project, 'openspec', 'specs', capability, 'spec.md');
}

function caseOne() {
  process.stdout.write('\n[1] init 建目录且幂等\n');
  withFixture('empty-project', (p) => {
    const first = run(p, ['init']);
    const second = run(p, ['init']);
    check(first.code === 0, '首次 init 退出码 0');
    check(second.code === 0, '重复 init 退出码仍为 0');
    check(fs.existsSync(path.join(p, 'openspec/specs')), 'specs/ 已创建');
    check(fs.existsSync(path.join(p, 'openspec/changes/archive')), 'changes/archive/ 已创建');
  });
}

function caseTwo() {
  process.stdout.write('\n[2] status 汇报完成度\n');
  withFixture('complete-change', (p) => {
    const r = run(p, ['status', 'demo', '--json']);
    check(r.code === 0, 'status 退出码 0');
    let data = null;
    try {
      data = JSON.parse(r.out.slice(r.out.indexOf('{')));
    } catch {
      data = null;
    }
    check(data !== null, '输出可被解析为 JSON');
    if (data) {
      check(data.isComplete === true, 'isComplete 为 true');
      check(data.tasks.complete === 2 && data.tasks.remaining === 0, '任务计数 2/2');
      check(data.artifacts.every((a) => a.status === 'done'), '四个产物均为 done');
    }
  });
}

function caseThree() {
  process.stdout.write('\n[3] archive 新建能力\n');
  withFixture('complete-change', (p) => {
    const r = run(p, ['archive', 'demo']);
    check(r.code === 0, 'archive 退出码 0');
    check(r.out.includes('hello') === false, '输出未误报其他能力');
    const main = specPath(p, 'demo');
    check(fs.existsSync(main), '主规格已创建');
    if (fs.existsSync(main)) {
      const text = read(main);
      check(text.includes('Demo SHALL work.'), '主规格含新增需求');
      check(/^## Purpose$/m.test(text), '主规格含 Purpose 段');
      check(/^## Requirements$/m.test(text), '主规格含 Requirements 段');
    }
    check(fs.existsSync(path.join(p, 'openspec/changes/archive')), 'archive 目录存在');
    const archived = fs.readdirSync(path.join(p, 'openspec/changes/archive'));
    check(archived.length === 1 && archived[0].endsWith('-demo'), '变更已按日期归档');
    check(!fs.existsSync(path.join(p, 'openspec/changes/demo')), '原变更目录已移除');
  });
}

function caseFour() {
  process.stdout.write('\n[4] 主规格缺 Purpose 时中止且零改动\n');
  withFixture('missing-purpose', (p) => {
    const main = specPath(p, 'hello');
    const before = hash(main);
    const r = run(p, ['archive', 'bad']);
    check(r.code === 1, 'archive 退出码 1');
    check(r.out.includes('Purpose'), '报错指出缺 Purpose');
    check(hash(main) === before, '主规格字节级未变');
    check(fs.existsSync(path.join(p, 'openspec/changes/bad')), '变更目录未被移动');
  });
}

function caseFive() {
  process.stdout.write('\n[5] ADDED 追加到末尾\n');
  withFixture('merge-added', (p) => {
    const r = run(p, ['archive', 'addc']);
    check(r.code === 0, 'archive 退出码 0');
    const text = read(specPath(p, 'hello'));
    check(text.includes('Beta SHALL b.'), '新增需求已写入');
    check(text.indexOf('Alpha SHALL a.') < text.indexOf('Beta SHALL b.'), '新增需求排在原需求之后');
    check(r.out.includes('+ 1 added'), '对账单显示 1 added');
  });
}

function caseSix() {
  process.stdout.write('\n[6] MODIFIED 原地替换\n');
  withFixture('merge-modified', (p) => {
    const main = specPath(p, 'hello');
    const before = read(main);
    const r = run(p, ['archive', 'modc']);
    check(r.code === 0, 'archive 退出码 0');
    const text = read(main);
    check(text.includes('Alpha SHALL upgraded.'), '需求内容已更新');
    check(!text.includes('Alpha SHALL a.'), '旧内容已被替换');
    check(text.indexOf('Alpha SHALL upgraded.') < text.indexOf('Beta SHALL b.'), '被替换需求位置不变');
    check(r.out.includes('~ 1 modified'), '对账单显示 1 modified');
    check(fs.existsSync(`${main}.bak`), '生成 .bak 备份');
    if (fs.existsSync(`${main}.bak`)) {
      check(read(`${main}.bak`) === before, '备份内容等于合并前原文');
    }
  });
}

function caseSeven() {
  process.stdout.write('\n[7] REMOVED 删除且顺序不变\n');
  withFixture('merge-removed', (p) => {
    const r = run(p, ['archive', 'delc']);
    check(r.code === 0, 'archive 退出码 0');
    const text = read(specPath(p, 'hello'));
    check(!text.includes('Beta SHALL b.'), '目标需求已删除');
    check(text.includes('Alpha SHALL a.'), '其他需求保留');
    check(r.out.includes('- 1 removed'), '对账单显示 1 removed');
  });
}

function caseEight() {
  process.stdout.write('\n[8] 对不上号时中止且零改动\n');
  withFixture('merge-unmatched', (p) => {
    const main = specPath(p, 'hello');
    const before = hash(main);
    const r = run(p, ['archive', 'ghostc']);
    check(r.code === 1, 'archive 退出码 1');
    check(r.out.includes('ghost'), '报错指名找不到的需求');
    check(hash(main) === before, '主规格字节级未变');
    check(!fs.existsSync(`${main}.bak`), '未产生备份文件');
  });
}

function caseNine() {
  process.stdout.write('\n[9] RENAMED 被拒绝\n');
  withFixture('renamed-rejected', (p) => {
    const r = run(p, ['validate', 'rnc']);
    check(r.code === 1, 'validate 退出码 1');
    check(r.out.includes('RENAMED'), '报错点明 RENAMED');
    check(r.out.includes('REMOVED + ADDED'), '给出替代写法建议');
  });
}

function caseTen() {
  process.stdout.write('\n[10] 重名变更被拒绝\n');
  withFixture('duplicate-change', (p) => {
    const r = run(p, ['new', 'demo']);
    check(r.code === 1, 'new 退出码 1');
    check(r.out.includes('已存在'), '提示变更已存在');
    check(fs.existsSync(path.join(p, 'openspec/changes/demo/proposal.md')), '既有变更未被覆盖');
  });
}

function caseEleven() {
  process.stdout.write('\n[11] 任务标记格式错误被拒绝\n');
  withFixture('empty-tasks', (p) => {
    const r = run(p, ['validate', 'tc']);
    check(r.code === 1, 'validate 退出码 1');
    check(r.out.includes('形式'), '提示任务格式要求');
  });
}

function caseTwelve() {
  process.stdout.write('\n[12] 只依赖 Node 标准库\n');
  const src = read(path.join(ROOT, 'workbuddy-team', 'bin', 'wbspec.cjs'));
  const requires = [...src.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
  check(requires.length > 0, '存在 require 调用');
  check(
    requires.every((m) => ['fs', 'path', 'crypto', 'os', 'child_process'].includes(m)),
    `仅使用内置模块（${[...new Set(requires)].join(', ')}）`,
  );
}

function caseThirteen() {
  process.stdout.write('\n[13] 无 delta 且 --skip-specs 可归档\n');
  withFixture('complete-change', (p) => {
    fs.rmSync(path.join(p, 'openspec/changes/demo/specs'), { recursive: true, force: true });
    const r = run(p, ['archive', 'demo', '--skip-specs']);
    check(r.code === 0, 'archive --skip-specs 退出码 0');
    check(r.out.includes('skipped'), '输出说明跳过了规格合并');
    check(!fs.existsSync(path.join(p, 'openspec/specs/demo/spec.md')), '未创建主规格');
  });
}

function caseFourteen() {
  process.stdout.write('\n[14] RENAMED 在归档阶段同样零改动中止\n');
  withFixture('renamed-rejected', (p) => {
    const main = specPath(p, 'hello');
    const before = hash(main);
    const r = run(p, ['archive', 'rnc']);
    check(r.code === 1, 'archive 退出码 1');
    check(hash(main) === before, '主规格字节级未变');
    check(fs.existsSync(path.join(p, 'openspec/changes/rnc')), '变更目录未被移动');
  });
}

const cases = [
  caseOne,
  caseTwo,
  caseThree,
  caseFour,
  caseFive,
  caseSix,
  caseSeven,
  caseEight,
  caseNine,
  caseTen,
  caseEleven,
  caseTwelve,
  caseThirteen,
  caseFourteen,
];

process.stdout.write(`wbspec 回归测试（工具: ${WB}）\n`);
for (const fn of cases) fn();

process.stdout.write(`\n结果: 通过 ${passed}，失败 ${failures.length}\n`);
if (failures.length) {
  for (const f of failures) process.stdout.write(`  ! ${f}\n`);
  process.exit(1);
}
