#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_CONTEXT = 200000;
const DEFAULT_PRICE_PER_MILLION = 3;
const DEFAULT_TIMEOUT_MS = 15000;
const PROTOCOL_VERSION = '2025-06-18';

function parseArgs(argv) {
  const options = {
    config: null,
    context: DEFAULT_CONTEXT,
    price: DEFAULT_PRICE_PER_MILLION,
    timeout: DEFAULT_TIMEOUT_MS / 1000,
    out: path.resolve(process.cwd(), 'tax-receipt.html'),
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--config') {
      options.config = requireValue(argv, i, arg);
      i += 1;
    } else if (arg === '--context') {
      options.context = parsePositiveNumber(requireValue(argv, i, arg), arg);
      i += 1;
    } else if (arg === '--price') {
      options.price = parsePositiveNumber(requireValue(argv, i, arg), arg);
      i += 1;
    } else if (arg === '--timeout') {
      options.timeout = parsePositiveNumber(requireValue(argv, i, arg), arg);
      i += 1;
    } else if (arg === '--out') {
      options.out = path.resolve(process.cwd(), requireValue(argv, i, arg));
      i += 1;
    } else {
      throw new Error(`未知參數：${arg}`);
    }
  }

  return options;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} 需要一個值`);
  }
  return value;
}

function parsePositiveNumber(value, flag) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${flag} 必須是大於 0 的數字`);
  }
  return number;
}

function printHelp() {
  console.log(`MCP Token Tax - 估算 MCP tool schema 佔用的 context token（估算值，約 ±20%）

用法：
  node mcp-tax.js [--config <path>] [--context 200000] [--price 3] [--timeout 15] [--out tax-receipt.html]

參數：
  --config   指定 MCP 設定檔；未指定時會掃描 ./.mcp.json、~/.claude.json、Claude Desktop config
  --context  context window token 數，預設 200000
  --price    API input token 假設價格，單位 USD / 1M tokens，預設 3
  --timeout  單一 stdio server 逾時秒數，預設 15
  --out      HTML 稅單輸出路徑，預設 ./tax-receipt.html
`);
}

function expandHome(filePath) {
  if (!filePath) return filePath;
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/')) return path.join(os.homedir(), filePath.slice(2));
  return filePath;
}

function defaultConfigCandidates() {
  return [
    path.resolve(process.cwd(), '.mcp.json'),
    path.join(os.homedir(), '.claude.json'),
    path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
  ];
}

function loadConfigFiles(options) {
  const candidates = options.config
    ? [path.resolve(process.cwd(), expandHome(options.config))]
    : defaultConfigCandidates();

  const files = [];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      files.push({ path: filePath, json });
    } catch (error) {
      files.push({ path: filePath, error: `JSON 解析失敗：${error.message}` });
    }
  }
  return files;
}

function collectServers(files) {
  const servers = [];
  const seen = new Set();

  for (const file of files) {
    if (file.error) {
      const name = path.basename(file.path);
      pushServer(seen, servers, {
        name,
        source: file.path,
        config: {},
        transport: 'error',
        unsupportedReason: file.error,
      });
      continue;
    }

    const entries = extractServerEntries(file.json);
    for (const entry of entries) {
      const normalized = normalizeServer(entry.name, entry.config, file.path);
      pushServer(seen, servers, normalized);
    }
  }

  return servers;
}

function pushServer(seen, servers, server) {
  if (seen.has(server.name)) return;
  seen.add(server.name);
  servers.push(server);
}

function extractServerEntries(json) {
  const entries = [];
  collectMcpServers(json && json.mcpServers, entries);

  const projects = json && json.projects;
  if (projects && typeof projects === 'object') {
    for (const projectConfig of Object.values(projects)) {
      collectMcpServers(projectConfig && projectConfig.mcpServers, entries);
    }
  }

  return entries;
}

function collectMcpServers(mcpServers, entries) {
  if (!mcpServers || typeof mcpServers !== 'object') return;
  for (const [name, config] of Object.entries(mcpServers)) {
    if (!config || typeof config !== 'object') continue;
    entries.push({ name, config });
  }
}

function normalizeServer(name, config, source) {
  const type = String(config.type || '').toLowerCase();
  const hasUrl = typeof config.url === 'string' || typeof config.endpoint === 'string';
  const urlish = type === 'http' || type === 'sse' || type === 'url' || hasUrl;

  if (typeof config.command === 'string' && config.command.trim()) {
    return {
      name,
      source,
      config,
      transport: 'stdio',
      command: config.command,
      args: Array.isArray(config.args) ? config.args.map(String) : [],
      env: config.env && typeof config.env === 'object' ? config.env : {},
      cwd: typeof config.cwd === 'string' ? expandHome(config.cwd) : undefined,
    };
  }

  return {
    name,
    source,
    config,
    transport: urlish ? 'remote' : 'unsupported',
    unsupportedReason: urlish ? 'v1 未計入（僅支援 stdio）' : '未計入（缺少 command）',
  };
}

async function inspectServers(servers, timeoutMs) {
  const results = [];
  for (const server of servers) {
    if (server.transport !== 'stdio') {
      results.push(makeSkippedResult(server, server.unsupportedReason));
      continue;
    }
    // MCP servers can be resource-heavy; probe sequentially to avoid noisy failures.
    results.push(await inspectStdioServer(server, timeoutMs));
  }
  return results;
}

function makeSkippedResult(server, reason) {
  return {
    name: server.name,
    source: server.source,
    status: server.transport === 'remote' ? 'skipped' : 'failed',
    reason,
    tools: [],
    toolCount: 0,
    tokens: 0,
  };
}

function inspectStdioServer(server, timeoutMs) {
  return new Promise((resolve) => {
    let child;
    let settled = false;
    let nextId = 1;
    let stdoutBuffer = '';
    let stderrBuffer = '';
    const pending = new Map();

    const finish = (result, killOptions = {}) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      for (const pendingRequest of pending.values()) {
        pendingRequest.reject(new Error(result.reason || 'server closed'));
      }
      pending.clear();
      if (child && !child.killed) {
        killChild(child, killOptions.group);
      }
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish(failedResult(server, formatFailureReason(`等了 ${formatTimeoutSeconds(timeoutMs)} 秒沒回應`, stderrBuffer)), { group: true });
    }, timeoutMs);

    try {
      child = spawn(server.command, server.args, {
        cwd: server.cwd || process.cwd(),
        env: { ...process.env, ...stringifyEnv(server.env) },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,
      });
    } catch (error) {
      finish(failedResult(server, `啟動失敗：${error.message}`));
      return;
    }

    child.on('error', (error) => {
      finish(failedResult(server, `啟動失敗：${error.message}`));
    });

    child.stderr.on('data', (chunk) => {
      stderrBuffer = trimBuffer(stderrBuffer + chunk.toString('utf8'));
    });

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString('utf8');
      let newlineIndex = stdoutBuffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = stdoutBuffer.slice(0, newlineIndex).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
        if (line) handleMessage(line);
        newlineIndex = stdoutBuffer.indexOf('\n');
      }
    });

    child.on('close', (code, signal) => {
      if (settled) return;
      finish(failedResult(
        server,
        formatFailureReason(`子行程提前結束（code=${code}, signal=${signal || 'none'}）`, stderrBuffer),
      ));
    });

    function handleMessage(line) {
      let message;
      try {
        message = JSON.parse(line);
      } catch (_error) {
        stderrBuffer = trimBuffer(`${stderrBuffer}\nstdout 非 JSON：${line}`.trim());
        return;
      }

      if (message.id === undefined || !pending.has(message.id)) return;
      const pendingRequest = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        pendingRequest.reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        pendingRequest.resolve(message.result || {});
      }
    }

    function request(method, params) {
      const id = nextId;
      nextId += 1;
      return new Promise((resolveRequest, rejectRequest) => {
        pending.set(id, { resolve: resolveRequest, reject: rejectRequest });
        writeJson({ jsonrpc: '2.0', id, method, params });
      });
    }

    function notify(method, params) {
      writeJson({ jsonrpc: '2.0', method, params });
    }

    function writeJson(payload) {
      if (!child || !child.stdin.writable) return;
      child.stdin.write(`${JSON.stringify(payload)}\n`);
    }

    (async () => {
      try {
        await request('initialize', {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'mcp-token-tax', version: '1.0.0' },
        });
        notify('notifications/initialized', {});
        const tools = await listAllTools(request);
        const enrichedTools = tools.map((tool) => ({
          ...tool,
          taxTokens: estimateToolTokens(tool),
        }));
        const tokens = enrichedTools.reduce((sum, tool) => sum + tool.taxTokens, 0);
        finish({
          name: server.name,
          source: server.source,
          status: 'ok',
          reason: '',
          tools: enrichedTools,
          toolCount: enrichedTools.length,
          tokens,
        });
      } catch (error) {
        finish(failedResult(server, formatFailureReason(error.message, stderrBuffer)));
      }
    })();
  });
}

function formatFailureReason(reason, stderrBuffer) {
  return stderrBuffer ? `${reason}；stderr: ${stderrBuffer}` : reason;
}

function formatTimeoutSeconds(timeoutMs) {
  return String(timeoutMs / 1000);
}

function killChild(child, killGroup) {
  if (killGroup && child.pid) {
    try {
      process.kill(-child.pid, 'SIGTERM');
      return;
    } catch (_error) {
      // Fall back to killing the direct child if process-group signaling is unavailable.
    }
  }
  child.kill();
}

function stringifyEnv(env) {
  const result = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === null || value === undefined) continue;
    result[key] = String(value);
  }
  return result;
}

function trimBuffer(text) {
  return text.length > 1200 ? text.slice(-1200) : text;
}

async function listAllTools(request) {
  const tools = [];
  let cursor;
  do {
    const result = await request('tools/list', cursor ? { cursor } : {});
    if (Array.isArray(result.tools)) {
      tools.push(...result.tools);
    }
    cursor = result.nextCursor;
  } while (cursor);
  return tools;
}

function failedResult(server, reason) {
  return {
    name: server.name,
    source: server.source,
    status: 'failed',
    reason,
    tools: [],
    toolCount: 0,
    tokens: 0,
  };
}

function estimateToolTokens(tool) {
  const payload = {
    name: tool && tool.name,
    description: tool && tool.description,
    inputSchema: tool && tool.inputSchema,
  };
  return Math.ceil(JSON.stringify(payload).length / 4);
}

function summarize(results, context, pricePerMillion) {
  const totalTokens = results.reduce((sum, result) => sum + result.tokens, 0);
  const okResults = results.filter((result) => result.status === 'ok');
  const topServer = okResults.reduce((top, result) => {
    if (!top || result.tokens > top.tokens) return result;
    return top;
  }, null);
  const topTools = [];
  for (const result of okResults) {
    for (const tool of result.tools) {
      topTools.push({
        server: result.name,
        name: tool.name || '(unnamed)',
        tokens: tool.taxTokens || 0,
      });
    }
  }
  topTools.sort((a, b) => b.tokens - a.tokens);

  return {
    totalTokens,
    context,
    pricePerMillion,
    contextRate: totalTokens / context,
    costPer100Messages: totalTokens * 100 * pricePerMillion / 1000000,
    topServer,
    topTools: topTools.slice(0, 3),
  };
}

function printTerminalReport(results, summary) {
  console.log('MCP Token Tax 稅單（估算值，約 ±20%）');
  console.log('');
  console.log(`Context window: ${formatInteger(summary.context)} tokens`);
  console.log(`API input 計價假設: $${formatMoney(summary.pricePerMillion)} USD / 1M tokens`);
  console.log('');

  const rows = results.map((result) => {
    const label = summary.topServer && result.name === summary.topServer.name ? ' 頭號稅務大戶' : '';
    return [
      `${result.name}${label}`,
      result.status === 'ok' ? String(result.toolCount) : '-',
      result.status === 'ok' ? formatInteger(result.tokens) : '-',
      result.status === 'ok' ? formatPercent(result.tokens / summary.context) : '-',
      statusText(result),
    ];
  });
  rows.push([
    '總計',
    String(results.reduce((sum, result) => sum + result.toolCount, 0)),
    formatInteger(summary.totalTokens),
    formatPercent(summary.contextRate),
    '估算值（約 ±20%）',
  ]);

  printTable(['server', '工具數', '估算 token', '佔 context %', '狀態'], rows);
  console.log('');
  console.log('最重 tool 前 3 名（估算值，約 ±20%）');
  if (summary.topTools.length === 0) {
    console.log('  無可排行的 stdio tool');
  } else {
    summary.topTools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool.server} / ${tool.name}: ${formatInteger(tool.tokens)} tokens`);
    });
  }
  console.log('');
  console.log(`每 100 則訊息 ≈ $${formatMoney(summary.costPer100Messages)} USD`);
  console.log('訂閱制不直接按 token 計費，此為 API 等值換算');
}

function statusText(result) {
  if (result.status === 'ok') return 'OK';
  if (result.status === 'skipped') return result.reason;
  return `連不上：${result.reason}`;
}

function printTable(headers, rows) {
  const allRows = [headers, ...rows];
  const widths = headers.map((_, columnIndex) => {
    return Math.max(...allRows.map((row) => visibleWidth(row[columnIndex])));
  });
  const separator = widths.map((width) => '-'.repeat(width)).join('-+-');

  console.log(formatRow(headers, widths));
  console.log(separator);
  for (const row of rows) {
    console.log(formatRow(row, widths));
  }
}

function formatRow(row, widths) {
  return row.map((value, index) => {
    const text = String(value);
    return `${text}${' '.repeat(widths[index] - visibleWidth(text))}`;
  }).join(' | ');
}

function visibleWidth(text) {
  return String(text).replace(/\x1b\[[0-9;]*m/g, '').length;
}

function writeHtmlReceipt(outPath, results, summary) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, renderHtmlReceipt(results, summary), 'utf8');
}

function renderHtmlReceipt(results, summary) {
  const generatedAt = new Date().toLocaleString('zh-TW', { hour12: false });
  const rows = results.map((result) => renderServerRow(result, summary)).join('\n');
  const topTools = summary.topTools.length
    ? summary.topTools.map((tool, index) => `
          <li><span>${index + 1}. ${escapeHtml(tool.server)} / ${escapeHtml(tool.name)}</span><strong>${formatInteger(tool.tokens)} tokens</strong></li>`).join('')
    : '<li><span>無可排行的 stdio tool</span><strong>0 tokens</strong></li>';

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MCP Token Tax Receipt</title>
  <style>
    :root {
      --paper: #F7F0E4;
      --ink: #24352F;
      --muted: #6D6A5F;
      --primary: #D87C56;
      --secondary: #2D5F4E;
      --line: #DCCDB8;
      --soft: #FFF9EF;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: 'Noto Sans TC', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.55;
    }
    .page {
      width: min(960px, calc(100% - 32px));
      margin: 28px auto;
      padding: 28px;
      background: var(--soft);
      border: 2px solid var(--line);
      box-shadow: 0 18px 55px rgba(45, 95, 78, 0.16);
    }
    .stamp {
      display: inline-flex;
      align-items: center;
      border: 2px solid var(--primary);
      color: var(--primary);
      font-weight: 900;
      padding: 6px 12px;
      letter-spacing: 0.08em;
      transform: rotate(-2deg);
      text-transform: uppercase;
    }
    header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 20px;
      align-items: start;
      border-bottom: 2px dashed var(--line);
      padding-bottom: 22px;
    }
    h1 {
      margin: 14px 0 8px;
      font-size: clamp(34px, 6vw, 72px);
      line-height: 0.95;
      color: var(--secondary);
      letter-spacing: 0;
    }
    .subtitle {
      margin: 0;
      color: var(--muted);
      font-size: 16px;
    }
    .rate-box {
      min-width: 220px;
      border: 2px solid var(--secondary);
      padding: 16px;
      text-align: right;
      background: #FCF4E8;
    }
    .rate-box span {
      display: block;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }
    .rate-box strong {
      display: block;
      color: var(--primary);
      font-size: 54px;
      line-height: 1;
      margin-top: 6px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 22px 0;
    }
    .metric {
      border: 1px solid var(--line);
      padding: 14px;
      background: #FFFDF7;
    }
    .metric span {
      display: block;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }
    .metric strong {
      display: block;
      color: var(--secondary);
      font-size: 25px;
      margin-top: 4px;
    }
    .section-title {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: baseline;
      margin: 26px 0 12px;
      color: var(--secondary);
      border-bottom: 2px solid var(--secondary);
      padding-bottom: 8px;
    }
    .section-title h2 {
      margin: 0;
      font-size: 20px;
    }
    .section-title small {
      color: var(--muted);
      font-weight: 700;
    }
    .server-list {
      display: grid;
      gap: 10px;
    }
    .server-row {
      border: 1px solid var(--line);
      background: #FFFDF7;
      padding: 14px;
    }
    .server-head {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 14px;
      align-items: baseline;
    }
    .server-name {
      font-weight: 900;
      color: var(--ink);
      overflow-wrap: anywhere;
    }
    .badge {
      display: inline-block;
      margin-left: 8px;
      padding: 2px 7px;
      border-radius: 999px;
      background: var(--primary);
      color: #fff;
      font-size: 12px;
      vertical-align: middle;
    }
    .server-numbers {
      color: var(--muted);
      font-weight: 700;
      white-space: nowrap;
    }
    .bar {
      height: 12px;
      margin-top: 10px;
      background: #EFE2D0;
      border: 1px solid var(--line);
      overflow: hidden;
    }
    .bar > span {
      display: block;
      height: 100%;
      width: var(--w);
      background: linear-gradient(90deg, var(--secondary), var(--primary));
    }
    .reason {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .top-tools {
      margin: 0;
      padding: 0;
      list-style: none;
      border: 1px solid var(--line);
      background: #FFFDF7;
    }
    .top-tools li {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      padding: 12px 14px;
      border-bottom: 1px dashed var(--line);
    }
    .top-tools li:last-child { border-bottom: 0; }
    .top-tools span { overflow-wrap: anywhere; }
    .fine-print {
      margin-top: 24px;
      border-top: 2px dashed var(--line);
      padding-top: 16px;
      color: var(--muted);
      font-size: 13px;
    }
    .fine-print strong { color: var(--ink); }
    @media (max-width: 720px) {
      .page { width: min(100% - 18px, 960px); padding: 18px; margin: 10px auto; }
      header, .summary, .server-head { grid-template-columns: 1fr; }
      .rate-box { text-align: left; min-width: 0; }
      .server-numbers { white-space: normal; }
      .top-tools li { display: block; }
      .top-tools strong { display: block; margin-top: 4px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <div>
        <div class="stamp">Estimated Tax Bill</div>
        <h1>MCP Token 稅單</h1>
        <p class="subtitle">你每裝一個 MCP 工具，AI 開工前都得先讀完它的說明書。這張帳單算給你看：光是這些說明書，就先吃掉你多少對話空間（數字為估算，約 ±20%）。</p>
      </div>
      <aside class="rate-box">
        <span>腦容量稅率</span>
        <strong>${formatPercent(summary.contextRate)}</strong>
      </aside>
    </header>

    <section class="summary">
      <div class="metric"><span>說明書總重量（token）</span><strong>${formatInteger(summary.totalTokens)}</strong></div>
      <div class="metric"><span>AI 腦容量上限（token）</span><strong>${formatInteger(summary.context)}</strong></div>
      <div class="metric"><span>每聊 100 句先繳</span><strong>$${formatMoney(summary.costPer100Messages)} USD</strong></div>
    </section>

    <div class="section-title">
      <h2>誰在收稅</h2>
      <small>工具數・說明書重量・吃掉多少腦容量</small>
    </div>
    <section class="server-list">
${rows}
    </section>

    <div class="section-title">
      <h2>最貴的三本說明書</h2>
      <small>單一工具吃掉的空間排行</small>
    </div>
    <ol class="top-tools">
${topTools}
    </ol>

    <p class="fine-print">
      <strong>錢怎麼算的：</strong>這些說明書 AI 每則訊息都要重讀一次。假設走 API（輸入每百萬 token $${formatMoney(summary.pricePerMillion)} 美元），每聊 100 句 ≈ $${formatMoney(summary.costPer100Messages)} USD。<br>
      <strong>誠實註記：</strong>如果你是訂閱制（Claude Pro／Max 那種），不會真的按 token 扣錢，這金額是換算成 API 的參考值。另外有些走網路連線的 server（HTTP／SSE 型）這版還算不到，僅支援 stdio。<br>
      產生時間：${escapeHtml(generatedAt)}
    </p>
  </main>
</body>
</html>
`;
}

function renderServerRow(result, summary) {
  const isTop = summary.topServer && result.name === summary.topServer.name;
  const rawWidth = summary.context > 0 ? result.tokens / summary.context * 100 : 0;
  const width = result.tokens > 0 ? Math.min(100, Math.max(0.5, rawWidth)) : 0;
  const numbers = result.status === 'ok'
    ? `${formatInteger(result.toolCount)} 個工具・${formatInteger(result.tokens)} tokens・吃掉 ${formatPercent(result.tokens / summary.context)} 腦容量`
    : statusText(result);
  const reason = result.status === 'ok' ? '' : `<p class="reason">${escapeHtml(result.reason)}</p>`;

  return `      <article class="server-row">
        <div class="server-head">
          <div class="server-name">${escapeHtml(result.name)}${isTop ? '<span class="badge">頭號稅務大戶</span>' : ''}</div>
          <div class="server-numbers">${escapeHtml(numbers)}</div>
        </div>
        <div class="bar" aria-label="${escapeHtml(result.name)} context usage"><span style="--w: ${width.toFixed(2)}%"></span></div>
        ${reason}
      </article>`;
}

function formatInteger(value) {
  return Math.round(value).toLocaleString('en-US');
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatMoney(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function printNoConfigMessage() {
  console.log('找不到 MCP 設定檔，沒有產生稅單。');
  console.log('');
  console.log('可建立 ./.mcp.json，範例：');
  console.log(JSON.stringify({
    mcpServers: {
      demo: {
        command: 'node',
        args: ['path/to/server.js'],
      },
    },
  }, null, 2));
  console.log('');
  console.log('也可以用 --config <path> 明確指定設定檔。');
}

async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    console.error('使用 --help 查看用法。');
    return 1;
  }

  if (options.help) {
    printHelp();
    return 0;
  }

  const files = loadConfigFiles(options);
  if (files.length === 0) {
    printNoConfigMessage();
    return 0;
  }

  const servers = collectServers(files);
  if (servers.length === 0) {
    console.log('找到設定檔，但沒有找到任何 mcpServers。');
    console.log('未產生稅單。');
    return 0;
  }

  const results = await inspectServers(servers, options.timeout * 1000);
  const summary = summarize(results, options.context, options.price);
  printTerminalReport(results, summary);
  writeHtmlReceipt(options.out, results, summary);
  console.log('');
  console.log(`HTML 稅單已寫出：${options.out}`);
  return 0;
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  collectServers,
  estimateToolTokens,
  extractServerEntries,
  main,
  normalizeServer,
  parseArgs,
  renderHtmlReceipt,
  summarize,
};
