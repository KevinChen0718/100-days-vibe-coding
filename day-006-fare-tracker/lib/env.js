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

module.exports = { loadEnv };
