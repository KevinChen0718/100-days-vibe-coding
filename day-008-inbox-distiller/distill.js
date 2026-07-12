#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG_FILE = 'wiki.config.json';
const LEDGER_DIR = '.inbox-distiller';
const LEDGER_FILE = 'ledger.json';
const DEFAULT_TIMEOUT_SECONDS = 120;
const BINARY_EXTENSIONS = new Set([
  '.7z',
  '.aac',
  '.avi',
  '.avif',
  '.bmp',
  '.doc',
  '.docx',
  '.flac',
  '.gif',
  '.gz',
  '.heic',
  '.ico',
  '.jpeg',
  '.jpg',
  '.m4a',
  '.mkv',
  '.mov',
  '.mp3',
  '.mp4',
  '.ogg',
  '.pdf',
  '.png',
  '.ppt',
  '.pptx',
  '.rar',
  '.tif',
  '.tiff',
  '.webm',
  '.webp',
  '.xls',
  '.xlsx',
  '.zip',
]);

const DEFAULT_CONFIG = {
  inbox: 'inbox',
  knowledge: 'knowledge',
  index: '目錄.md',
  journal: '日誌.md',
  agent: 'claude',
  maxPerRun: 5,
};

function parseArgs(argv) {
  const options = {
    vault: null,
    init: false,
    dryRun: false,
    timeout: DEFAULT_TIMEOUT_SECONDS,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--vault') {
      options.vault = requireValue(argv, i, arg);
      i += 1;
    } else if (arg === '--init') {
      options.init = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--timeout') {
      options.timeout = parsePositiveNumber(requireValue(argv, i, arg), arg);
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
  console.log(`Inbox Distiller - 把 Obsidian inbox 交給 agent 蒸餾成 LLM Wiki

用法：
  node distill.js --vault ~/vault [--init] [--dry-run] [--timeout 120]

參數：
  --vault    Obsidian vault 路徑
  --init     在 vault 內建立標準 JSON 設定與基本資料夾
  --dry-run  只列出會處理的檔案與會呼叫的 agent，不寫 ledger、不呼叫 agent
  --timeout  單檔 agent 逾時秒數，預設 120
  --help     顯示說明
`);
}

function expandHome(filePath) {
  if (!filePath) return filePath;
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/')) return path.join(os.homedir(), filePath.slice(2));
  return filePath;
}

function requireVault(vaultArg) {
  if (!vaultArg) {
    throw new Error('請用 --vault 指定 Obsidian vault 路徑');
  }
  return path.resolve(process.cwd(), expandHome(vaultArg));
}

function initVault(vault) {
  fs.mkdirSync(vault, { recursive: true });
  const configPath = path.join(vault, CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8');
  }

  const config = loadConfig(vault);
  const paths = resolveConfigPaths(vault, config);
  fs.mkdirSync(paths.inboxDir, { recursive: true });
  fs.mkdirSync(paths.knowledgeDir, { recursive: true });

  console.log(`已初始化：${vault}`);
  console.log(`設定檔：${configPath}`);
  console.log('提醒：wiki.config.json 是標準 JSON，不能放 // 註解；欄位說明請看 README 的 config 表。');
}

function loadConfig(vault) {
  const configPath = path.join(vault, CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`${CONFIG_FILE} 不是合法 JSON：${error.message}`);
  }

  const config = { ...DEFAULT_CONFIG, ...parsed };
  validateConfig(config);
  return config;
}

function validateConfig(config) {
  for (const field of ['inbox', 'knowledge', 'index', 'journal', 'agent']) {
    if (typeof config[field] !== 'string' || !config[field].trim()) {
      throw new Error(`${CONFIG_FILE} 的 ${field} 必須是非空字串`);
    }
  }

  if (!Number.isInteger(config.maxPerRun) || config.maxPerRun <= 0) {
    throw new Error(`${CONFIG_FILE} 的 maxPerRun 必須是大於 0 的整數`);
  }
}

function resolveConfigPaths(vault, config) {
  const inboxDir = resolveVaultRelativePath(vault, config.inbox);
  const knowledgeDir = resolveVaultRelativePath(vault, config.knowledge);
  const indexPath = resolveVaultRelativePath(vault, config.index);
  const journalPath = resolveVaultRelativePath(vault, config.journal);

  for (const target of [inboxDir, knowledgeDir, indexPath, journalPath]) {
    if (!isInside(vault, target)) {
      throw new Error(`${CONFIG_FILE} 只能指向 vault 內的相對路徑：${target}`);
    }
  }

  return {
    inboxDir,
    knowledgeDir,
    indexPath,
    journalPath,
    inboxRelativePath: normalizePath(path.relative(vault, inboxDir)),
    knowledgeRelativePath: normalizePath(path.relative(vault, knowledgeDir)),
    indexRelativePath: normalizePath(path.relative(vault, indexPath)),
    journalRelativePath: normalizePath(path.relative(vault, journalPath)),
    ledgerPath: path.join(vault, LEDGER_DIR, LEDGER_FILE),
  };
}

function resolveVaultRelativePath(vault, relativePath) {
  if (path.isAbsolute(relativePath)) {
    throw new Error(`${CONFIG_FILE} 只能指向 vault 內的相對路徑：${relativePath}`);
  }
  return path.resolve(vault, relativePath);
}

function isInside(parent, target) {
  const relative = path.relative(parent, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function loadLedger(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) {
    return { version: 1, entries: [] };
  }

  try {
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    if (!ledger || !Array.isArray(ledger.entries)) {
      throw new Error('缺少 entries 陣列');
    }
    return ledger;
  } catch (error) {
    throw new Error(`${LEDGER_FILE} 讀取失敗：${error.message}`);
  }
}

function saveLedger(ledgerPath, ledger) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
}

function collectInboxFiles(inboxDir, vault) {
  if (!fs.existsSync(inboxDir)) {
    return [];
  }

  const files = [];
  walk(inboxDir, (filePath) => {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return;
    const vaultRelativePath = normalizePath(path.relative(vault, filePath));
    const inboxRelativePath = normalizePath(path.relative(inboxDir, filePath));
    const content = fs.readFileSync(filePath);
    files.push({
      path: filePath,
      vaultRelativePath,
      inboxRelativePath,
      sha256: crypto.createHash('sha256').update(content).digest('hex'),
      isBinary: isBinaryFile(filePath, content),
    });
  });

  files.sort((a, b) => a.vaultRelativePath.localeCompare(b.vaultRelativePath, 'zh-Hant'));
  return files;
}

function walk(dir, visit) {
  for (const name of fs.readdirSync(dir).sort((a, b) => a.localeCompare(b, 'zh-Hant'))) {
    const filePath = path.join(dir, name);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath, visit);
    } else {
      visit(filePath);
    }
  }
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function shouldProcess(file, ledger) {
  return !ledger.entries.some((entry) => (
    entry.relativePath === file.vaultRelativePath
    && entry.sha256 === file.sha256
    && (entry.status === 'success' || entry.status === 'skipped_binary')
  ));
}

function isBinaryFile(filePath, content) {
  const extension = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(extension)) {
    return true;
  }

  const sample = content.subarray(0, 8192);
  return sample.includes(0);
}

function findDuplicateBasenames(files) {
  const groups = new Map();
  for (const file of files) {
    const basename = path.basename(file.vaultRelativePath);
    if (!groups.has(basename)) {
      groups.set(basename, []);
    }
    groups.get(basename).push(file.vaultRelativePath);
  }

  return [...groups.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([basename, paths]) => ({ basename, paths }));
}

function printDuplicateBasenameWarnings(files) {
  for (const duplicate of findDuplicateBasenames(files)) {
    console.log(`警告：同一輪處理清單有重複檔名 ${duplicate.basename}：${duplicate.paths.join('、')}。若 agent 用檔名當筆記名可能覆蓋，請用內容主題命名。`);
  }
}

function buildPrompt({ paths, file, date }) {
  return `你是 inbox-distiller，請把一個 Obsidian inbox 原始檔蒸餾成 LLM Wiki 筆記。

工作目錄已鎖在 vault 根目錄。請嚴格遵守：
- 原始檔唯讀，絕對不要修改、移動或刪除 inbox 內的檔案。
- 只把整理後的筆記寫進知識庫資料夾：${paths.knowledgeRelativePath}
- 必須建立或更新一篇繁體中文白話筆記，內容要保留可追溯的重點。
- 筆記內至少放一個 [[雙向連結]]，用來連到相關概念或目錄。
- 若知識庫已有同名但主題不同的筆記，請換一個不衝突的頁名，絕不可覆蓋無關筆記；同主題才可更新既有頁面。
- 在 ${paths.indexRelativePath} 加上一行：「[[頁名]] — 一句話」。
- 在 ${paths.journalRelativePath} 追加一段：「## ${date} 匯入 | ${path.basename(file.vaultRelativePath)}」。
- 完成後請在 stdout 印出一行：「NOTE: ${paths.knowledgeRelativePath}/你的筆記檔名.md」。

本次要處理的原始檔：
${file.vaultRelativePath}
`;
}

function resolveAgent(agent, input) {
  if (agent === 'claude') {
    return { command: 'claude', args: ['-p'], input, display: 'claude -p' };
  }
  if (agent === 'codex') {
    return { command: 'codex', args: ['exec'], input, display: 'codex exec' };
  }

  const parts = splitCommand(agent);
  if (parts.length === 0) {
    throw new Error(`${CONFIG_FILE} 的 agent 不能是空白`);
  }

  const usesPlaceholder = parts.some((part) => part.includes('{input}'));
  const args = parts.slice(1).map((part) => part.replace(/\{input\}/g, input));
  return {
    command: parts[0].replace(/\{input\}/g, input),
    args,
    input: usesPlaceholder ? '' : input,
    display: agent,
  };
}

function splitCommand(command) {
  const parts = [];
  let current = '';
  let quote = null;
  let escaped = false;

  for (const char of command.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }

  if (escaped) current += '\\';
  if (quote) {
    throw new Error(`${CONFIG_FILE} 的 agent 指令引號沒有關閉`);
  }
  if (current) parts.push(current);
  return parts;
}

function runAgent({ agent, vault, prompt, timeoutMs, env }) {
  return new Promise((resolve) => {
    let child;
    let settled = false;
    let stdout = '';
    let stderr = '';
    const command = resolveAgent(agent, prompt);

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, display: command.display, stdout, stderr });
    };

    const timer = setTimeout(() => {
      if (child && child.pid) {
        killChild(child);
      }
      finish({
        status: 'failed',
        error: `agent 等了 ${formatSeconds(timeoutMs)} 沒完成`,
      });
    }, timeoutMs);

    try {
      child = spawn(command.command, command.args, {
        cwd: vault,
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,
      });
    } catch (error) {
      finish({
        status: 'failed',
        error: `agent 啟動失敗：${error.message}`,
      });
      return;
    }

    child.on('error', (error) => {
      const message = error.code === 'ENOENT'
        ? `找不到 agent 指令：${command.command}。請先安裝，或修改 ${CONFIG_FILE} 的 agent。`
        : `agent 啟動失敗：${error.message}`;
      finish({ status: 'failed', error: message });
    });

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code, signal) => {
      if (code === 0) {
        finish({ status: 'success', note: extractNotePath(stdout) });
        return;
      }

      const reason = signal
        ? `agent 被 ${signal} 中止`
        : `agent 結束碼 ${code}`;
      finish({
        status: 'failed',
        error: formatAgentFailure(reason, stdout, stderr),
      });
    });

    child.stdin.end(command.input);
  });
}

function killChild(child) {
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch (_) {
    try {
      child.kill('SIGTERM');
    } catch (_) {
      // The process may already be gone.
    }
  }
}

function formatSeconds(timeoutMs) {
  const seconds = timeoutMs / 1000;
  return Number.isInteger(seconds) ? `${seconds} 秒` : `${seconds.toFixed(1)} 秒`;
}

function formatAgentFailure(reason, stdout, stderr) {
  const details = [];
  const cleanStderr = stderr.trim();
  const cleanStdout = stdout.trim();
  if (cleanStderr) details.push(`stderr: ${truncate(cleanStderr, 240)}`);
  if (cleanStdout) details.push(`stdout: ${truncate(cleanStdout, 240)}`);
  return details.length ? `${reason}；${details.join('；')}` : reason;
}

function truncate(text, maxLength) {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

function extractNotePath(stdout) {
  const match = stdout.match(/(?:NOTE|產出筆記)\s*[:：]\s*(.+)/i);
  return match ? match[1].trim().split(/\r?\n/)[0] : '-';
}

function updateLedger(ledger, file, result) {
  const now = new Date().toISOString();
  const nextEntry = {
    relativePath: file.vaultRelativePath,
    sha256: file.sha256,
    status: result.status,
    note: result.note || '-',
    error: result.error || '',
    updatedAt: now,
  };

  const index = ledger.entries.findIndex((entry) => (
    entry.relativePath === file.vaultRelativePath
    && entry.sha256 === file.sha256
  ));

  if (index >= 0) {
    ledger.entries[index] = { ...ledger.entries[index], ...nextEntry };
  } else {
    ledger.entries.push(nextEntry);
  }
}

function printSummary(rows, stats) {
  console.log('Inbox Distiller 收件匣摘要');
  console.log('| 檔名 | 狀態 | 產出筆記 |');
  console.log('|---|---|---|');
  if (rows.length === 0) {
    console.log('| - | 無待處理 | - |');
  } else {
    for (const row of rows) {
      console.log(`| ${row.file} | ${row.status} | ${row.note} |`);
    }
  }
  console.log(`統計：掃描 ${stats.total} 檔，待處理 ${stats.pending} 檔，本次處理 ${stats.processed} 檔，成功 ${stats.success} 檔，失敗 ${stats.failed} 檔，跳過 ${stats.skipped || 0} 檔。`);
}

function printDryRun(files, commandDisplay, stats) {
  console.log('Dry Run：只列出會處理的檔案，不寫 ledger，也不呼叫 agent。');
  console.log(`會呼叫：${commandDisplay}`);
  const rows = files.map((file) => ({
    file: file.vaultRelativePath,
    status: file.isBinary ? '跳過（二進位）' : '待處理',
    note: '-',
  }));
  printSummary(rows, stats);
}

async function run(options) {
  if (options.help) {
    printHelp();
    return 0;
  }

  const vault = requireVault(options.vault);
  if (options.init) {
    initVault(vault);
    return 0;
  }

  if (!fs.existsSync(vault)) {
    throw new Error(`找不到 vault：${vault}`);
  }

  const config = loadConfig(vault);
  const paths = resolveConfigPaths(vault, config);
  const ledger = loadLedger(paths.ledgerPath);
  const allFiles = collectInboxFiles(paths.inboxDir, vault);
  const pending = allFiles.filter((file) => shouldProcess(file, ledger));
  const selected = pending.slice(0, config.maxPerRun);
  const timeoutMs = options.timeout * 1000;
  const commandDisplay = resolveAgent(config.agent, '{input}').display;
  printDuplicateBasenameWarnings(selected);

  if (options.dryRun) {
    printDryRun(selected, commandDisplay, {
      total: allFiles.length,
      pending: pending.length,
      processed: selected.length,
      success: 0,
      failed: 0,
      skipped: selected.filter((file) => file.isBinary).length,
    });
    return 0;
  }

  const rows = [];
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of selected) {
    if (file.isBinary) {
      const result = {
        status: 'skipped_binary',
        note: '-',
        error: '跳過（二進位）',
      };
      updateLedger(ledger, file, result);
      skipped += 1;
      rows.push({
        file: file.vaultRelativePath,
        status: '跳過（二進位）',
        note: '-',
      });
      continue;
    }

    const prompt = buildPrompt({
      paths,
      file,
      date: new Date().toISOString().slice(0, 10),
    });
    const result = await runAgent({
      agent: config.agent,
      vault,
      prompt,
      timeoutMs,
      env: {
        INBOX_DISTILLER_VAULT: vault,
        INBOX_DISTILLER_FILE: file.vaultRelativePath,
        INBOX_DISTILLER_INBOX_FILE: file.inboxRelativePath,
        INBOX_DISTILLER_KNOWLEDGE: paths.knowledgeRelativePath,
        INBOX_DISTILLER_INDEX: paths.indexRelativePath,
        INBOX_DISTILLER_JOURNAL: paths.journalRelativePath,
      },
    });

    updateLedger(ledger, file, result);
    if (result.status === 'success') {
      success += 1;
    } else {
      failed += 1;
      console.error(`錯誤：${file.vaultRelativePath} ${result.error}`);
    }
    rows.push({
      file: file.vaultRelativePath,
      status: result.status === 'success' ? '完成' : '失敗',
      note: result.status === 'success' ? (result.note || '-') : result.error,
    });
  }

  if (selected.length > 0) {
    saveLedger(paths.ledgerPath, ledger);
  }

  printSummary(rows, {
    total: allFiles.length,
    pending: pending.length,
    processed: selected.length,
    success,
    failed,
    skipped,
  });

  return failed > 0 ? 1 : 0;
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`錯誤：${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  DEFAULT_CONFIG,
  buildPrompt,
  collectInboxFiles,
  findDuplicateBasenames,
  parseArgs,
  run,
  shouldProcess,
  splitCommand,
};
