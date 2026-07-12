#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cliPath = path.join(root, 'distill.js');
const fakeAgentPath = path.join(__dirname, 'fake-agent.js');

function quoteArg(value) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function makeVault(name) {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), `inbox-distiller-${name}-`));
  fs.mkdirSync(path.join(vault, 'inbox'), { recursive: true });
  fs.mkdirSync(path.join(vault, 'knowledge'), { recursive: true });
  writeConfig(vault, `${quoteArg(process.execPath)} ${quoteArg(fakeAgentPath)}`);
  return vault;
}

function writeConfig(vault, agent) {
  fs.writeFileSync(path.join(vault, 'wiki.config.json'), `${JSON.stringify({
    inbox: 'inbox',
    knowledge: 'knowledge',
    index: '目錄.md',
    journal: '日誌.md',
    agent,
    maxPerRun: 5,
  }, null, 2)}\n`, 'utf8');
}

function runCli(vault, extraArgs = []) {
  return spawnSync(process.execPath, [
    cliPath,
    '--vault',
    vault,
    ...extraArgs,
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000,
  });
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function sha(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function snapshot(dir) {
  const files = {};
  if (!fs.existsSync(dir)) return files;

  function walk(current) {
    for (const name of fs.readdirSync(current).sort()) {
      const filePath = path.join(current, name);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walk(filePath);
      } else {
        files[path.relative(dir, filePath).split(path.sep).join('/')] = sha(filePath);
      }
    }
  }

  walk(dir);
  return files;
}

function assertNoStack(output) {
  assert.doesNotMatch(output, /\n\s*at\s+\S+/, 'output should not include a stack trace');
  assert.doesNotMatch(output, /Error:\s/, 'output should not print raw Error objects');
}

const vault = makeVault('main');
const inboxA = path.join(vault, 'inbox', 'alpha.md');
const inboxB = path.join(vault, 'inbox', 'beta.md');
fs.writeFileSync(inboxA, '# Alpha\n史料 A：第一段。\n', 'utf8');
fs.writeFileSync(inboxB, '# Beta\n史料 B：第二段。\n', 'utf8');
const originalA = fs.readFileSync(inboxA);
const originalB = fs.readFileSync(inboxB);

const first = runCli(vault);
assert.strictEqual(first.status, 0, first.stderr || first.stdout);
assert.match(first.stdout, /Inbox Distiller 收件匣摘要/);
assert.match(first.stdout, /本次處理 2 檔/);
assert.match(first.stdout, /成功 2 檔/);
assert.ok(fs.existsSync(path.join(vault, 'knowledge', 'alpha.md')), 'alpha note should be written by fake agent');
assert.ok(fs.existsSync(path.join(vault, 'knowledge', 'beta.md')), 'beta note should be written by fake agent');
assert.match(read(path.join(vault, 'knowledge', 'alpha.md')), /\[\[目錄\]\]/);
assert.match(read(path.join(vault, '目錄.md')), /\[\[alpha\]\] — fake agent 蒸餾摘要/);
assert.match(read(path.join(vault, '目錄.md')), /\[\[beta\]\] — fake agent 蒸餾摘要/);
assert.match(read(path.join(vault, '日誌.md')), /匯入 \| alpha\.md/);
assert.match(read(path.join(vault, '日誌.md')), /匯入 \| beta\.md/);
assert.ok(!fs.existsSync(path.join(vault, 'knowledge', '目錄.md')), 'index should be vault-relative, not forced under knowledge');
assert.ok(!fs.existsSync(path.join(vault, 'knowledge', '日誌.md')), 'journal should be vault-relative, not forced under knowledge');
assert.deepStrictEqual(fs.readFileSync(inboxA), originalA, 'alpha inbox file should remain bit-identical');
assert.deepStrictEqual(fs.readFileSync(inboxB), originalB, 'beta inbox file should remain bit-identical');
let ledger = readJson(path.join(vault, '.inbox-distiller', 'ledger.json'));
assert.strictEqual(ledger.entries.filter((entry) => entry.status === 'success').length, 2);
console.log('PASS 首跑 2 檔：筆記、目錄、日誌到位，inbox 原檔 bit 不變');

const beforeSecond = snapshot(vault);
const second = runCli(vault);
assert.strictEqual(second.status, 0, second.stderr || second.stdout);
assert.match(second.stdout, /本次處理 0 檔/);
assert.deepStrictEqual(snapshot(vault), beforeSecond, 'second run should not write files');
console.log('PASS 二跑 0 檔：success ledger 去重生效');

fs.writeFileSync(inboxA, '# Alpha\n史料 A：內容已更新。\n', 'utf8');
const changedA = fs.readFileSync(inboxA);
const changed = runCli(vault);
assert.strictEqual(changed.status, 0, changed.stderr || changed.stdout);
assert.match(changed.stdout, /本次處理 1 檔/);
assert.match(read(path.join(vault, 'knowledge', 'alpha.md')), /內容已更新/);
assert.deepStrictEqual(fs.readFileSync(inboxA), changedA, 'changed inbox file should remain bit-identical after processing');
ledger = readJson(path.join(vault, '.inbox-distiller', 'ledger.json'));
assert.strictEqual(ledger.entries.filter((entry) => entry.relativePath === 'inbox/alpha.md' && entry.status === 'success').length, 2);
console.log('PASS 內容變更：hash 改變會重新處理');

const inboxGamma = path.join(vault, 'inbox', 'gamma.md');
fs.writeFileSync(inboxGamma, '# Gamma\n這是 dry-run 候選。\n', 'utf8');
const beforeDryRun = snapshot(vault);
const dryRun = runCli(vault, ['--dry-run']);
assert.strictEqual(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
assert.match(dryRun.stdout, /Dry Run/);
assert.match(dryRun.stdout, /inbox\/gamma\.md/);
assert.deepStrictEqual(snapshot(vault), beforeDryRun, '--dry-run should not write any file');
assert.ok(!fs.existsSync(path.join(vault, 'knowledge', 'gamma.md')), 'dry-run should not call agent');
console.log('PASS dry-run：只列檔案與指令，不落檔、不呼叫 agent');

writeConfig(vault, `${quoteArg(process.execPath)} ${quoteArg(fakeAgentPath)} --fail`);
const failed = runCli(vault);
assert.strictEqual(failed.status, 1, failed.stderr || failed.stdout);
assert.match(`${failed.stdout}\n${failed.stderr}`, /fake agent planned failure/);
ledger = readJson(path.join(vault, '.inbox-distiller', 'ledger.json'));
const failedEntry = ledger.entries.find((entry) => entry.relativePath === 'inbox/gamma.md' && entry.status === 'failed');
assert.ok(failedEntry, 'failed entry should be recorded');
assert.ok(!fs.existsSync(path.join(vault, 'knowledge', 'gamma.md')), 'failed agent should not write note');

writeConfig(vault, `${quoteArg(process.execPath)} ${quoteArg(fakeAgentPath)}`);
const retry = runCli(vault);
assert.strictEqual(retry.status, 0, retry.stderr || retry.stdout);
assert.match(retry.stdout, /本次處理 1 檔/);
assert.ok(fs.existsSync(path.join(vault, 'knowledge', 'gamma.md')), 'failed item should be retried next run');
ledger = readJson(path.join(vault, '.inbox-distiller', 'ledger.json'));
assert.ok(ledger.entries.find((entry) => entry.relativePath === 'inbox/gamma.md' && entry.status === 'success'));
console.log('PASS agent 失敗：標 failed，下一次同 hash 會重試');

const missingVault = makeVault('missing');
fs.writeFileSync(path.join(missingVault, 'inbox', 'missing.md'), '# Missing\ncommand case\n', 'utf8');
writeConfig(missingVault, '__inbox_distiller_missing_command__');
const missing = runCli(missingVault);
const missingOutput = `${missing.stdout}\n${missing.stderr}`;
assert.strictEqual(missing.status, 1, missingOutput);
assert.match(missingOutput, /找不到 agent 指令/);
assertNoStack(missingOutput);
console.log('PASS missing command：人話錯誤、exit 非 0、沒有 stack');

const customPathVault = makeVault('custom-path');
fs.writeFileSync(path.join(customPathVault, 'inbox', 'custom.md'), '# Custom\nvault-relative path case\n', 'utf8');
fs.writeFileSync(path.join(customPathVault, 'wiki.config.json'), `${JSON.stringify({
  inbox: 'inbox',
  knowledge: 'knowledge',
  index: 'map/目錄.md',
  journal: 'logs/日誌.md',
  agent: `${quoteArg(process.execPath)} ${quoteArg(fakeAgentPath)}`,
  maxPerRun: 5,
}, null, 2)}\n`, 'utf8');
const customPath = runCli(customPathVault);
assert.strictEqual(customPath.status, 0, customPath.stderr || customPath.stdout);
assert.match(customPath.stdout, /本次處理 1 檔/);
assert.match(read(path.join(customPathVault, 'map', '目錄.md')), /\[\[custom\]\] — fake agent 蒸餾摘要/);
assert.match(read(path.join(customPathVault, 'logs', '日誌.md')), /匯入 \| custom\.md/);
assert.ok(!fs.existsSync(path.join(customPathVault, 'knowledge', 'map', '目錄.md')), 'custom index should resolve from vault root');
console.log('PASS vault 相對目錄／日誌：config.index 與 config.journal 從 vault 根目錄 resolve');

const duplicateVault = makeVault('duplicate');
fs.writeFileSync(path.join(duplicateVault, 'inbox', 'dup.md'), '# Dup A\n第一篇。\n', 'utf8');
fs.mkdirSync(path.join(duplicateVault, 'inbox', 'sub'), { recursive: true });
fs.writeFileSync(path.join(duplicateVault, 'inbox', 'sub', 'dup.md'), '# Dup B\n第二篇。\n', 'utf8');
const duplicate = runCli(duplicateVault);
assert.strictEqual(duplicate.status, 0, duplicate.stderr || duplicate.stdout);
assert.match(duplicate.stdout, /警告：同一輪處理清單有重複檔名 dup\.md/);
assert.match(duplicate.stdout, /本次處理 2 檔/);
console.log('PASS 重複 basename：同一輪處理清單會警告但不中斷');

const binaryVault = makeVault('binary');
writeConfig(binaryVault, '__inbox_distiller_missing_command__');
fs.writeFileSync(path.join(binaryVault, 'inbox', 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a, 0x1a]));
const binary = runCli(binaryVault);
assert.strictEqual(binary.status, 0, binary.stderr || binary.stdout);
assert.match(binary.stdout, /跳過（二進位）/);
assert.ok(!fs.existsSync(path.join(binaryVault, 'knowledge', 'image.md')), 'binary file should not call agent');
const binaryLedger = readJson(path.join(binaryVault, '.inbox-distiller', 'ledger.json'));
assert.ok(binaryLedger.entries.find((entry) => entry.relativePath === 'inbox/image.png' && entry.status === 'skipped_binary'));
console.log('PASS 二進位檔：預設跳過、記 skipped_binary、未呼叫 agent');

console.log('PASS 全部測試通過');
