#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { estimateToolTokens } = require('../mcp-tax.js');
const { tools } = require('./mock-server.js');

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-tax-test-'));
const configPath = path.join(tmp, 'mcp.json');
const htmlPath = path.join(tmp, 'tax-receipt.html');

const expectedTokens = tools.reduce((sum, tool) => sum + estimateToolTokens(tool), 0);

fs.writeFileSync(configPath, JSON.stringify({
  mcpServers: {
    mock: {
      command: process.execPath,
      args: [path.join(__dirname, 'mock-server.js')],
    },
    bad: {
      command: '__mcp_tax_missing_command__',
      args: [],
    },
    slow: {
      command: process.execPath,
      args: [path.join(__dirname, 'mock-slow-server.js')],
    },
  },
}, null, 2));

const result = spawnSync(process.execPath, [
  path.join(root, 'mcp-tax.js'),
  '--config', configPath,
  '--out', htmlPath,
  '--context', '1000',
  '--price', '3',
  '--timeout', '1',
], {
  cwd: root,
  encoding: 'utf8',
  timeout: 20000,
});

assert.strictEqual(result.status, 0, result.stderr || result.stdout);
assert.match(result.stdout, /MCP Token Tax 稅單/);
assert.match(result.stdout, /mock/);
assert.match(result.stdout, new RegExp(`mock[^\\n]*\\|\\s*2\\s*\\|\\s*${expectedTokens}`));
assert.match(result.stdout, /bad/);
assert.match(result.stdout, /失敗/);
assert.match(result.stdout, /slow/);
assert.match(result.stdout, /逾時/);
assert.match(result.stdout, /slow mock stderr marker/);
assert.match(result.stdout, /每 100 則訊息 ≈/);

assert.ok(fs.existsSync(htmlPath), 'tax-receipt.html should be written');
const html = fs.readFileSync(htmlPath, 'utf8');
assert.match(html, /MCP Token 稅單/);
assert.match(html, /mock/);
assert.match(html, new RegExp(`${expectedTokens}\\s*tokens`));
assert.match(html, /context 稅率/);
assert.match(html, /API 輸入計價/);
assert.match(html, /訂閱制不直接按 token 計費，此為 API 等值換算/);
assert.doesNotMatch(html, /https?:\/\//, 'HTML should not reference external resources');

console.log('PASS mock server 工具數與 token 估算正確');
console.log('PASS 壞 server 被標為失敗，整體仍正常完成');
console.log('PASS 慢 server 逾時時保留 stderr 內容');
console.log(`PASS HTML 稅單已產生：${htmlPath}`);
