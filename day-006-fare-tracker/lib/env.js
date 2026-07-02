/* 零依賴 .env 讀取器（不裝 dotenv） */
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  const p = file || path.join(__dirname, '..', '.env');
  const out = {};
  try {
    fs.readFileSync(p, 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  } catch (e) { /* 沒有 .env 就回空物件 */ }
  return out;
}

/* ---------------------------------------------------------------------
 * 佔位字偵測：使用者 cp .env.example .env 之後沒改，值會是
 * 「你的token貼這裡」這種中文佔位字。真實 API token 一定是純 ASCII，
 * 所以「含任何非可見 ASCII 字元」就視為沒設定，避免拿佔位字去打 API
 * 吃 401、UI 又靜默退模擬讓人一頭霧水。
 * ------------------------------------------------------------------- */
function isPlaceholder(v) {
  if (v == null) return true;
  const s = String(v).trim();
  if (!s) return true;
  if (/[^\x20-\x7E]/.test(s)) return true; // 中文、全形、控制字元 → 佔位字
  return false;
}

/** 佔位字 / 空值 → undefined；有效值 → 去頭尾空白後回傳 */
function realValue(v) {
  return isPlaceholder(v) ? undefined : String(v).trim();
}

/** 給健檢用的三態：'set'（看起來有效）/ 'placeholder'（沒改佔位字）/ 'unset'（沒填） */
function valueState(v) {
  if (v == null || !String(v).trim()) return 'unset';
  return /[^\x20-\x7E]/.test(String(v).trim()) ? 'placeholder' : 'set';
}

module.exports = { loadEnv, isPlaceholder, realValue, valueState };
