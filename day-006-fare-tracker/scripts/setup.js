#!/usr/bin/env node
/* =====================================================================
 * scripts/setup.js — 首次上手設定精靈（npm run setup）
 * ---------------------------------------------------------------------
 * 零依賴、問答式引導填 .env：
 *   1. 說清楚兩個資料來源是什麼、去哪申請、各自的限制（誠實預期）。
 *   2. 逐項詢問金鑰，Enter 跳過；已設定的值不會被誤蓋。
 *   3. 寫入 .env（已被 .gitignore 忽略，金鑰不會進 git）。
 * 全程不打任何外部 API；要驗證 token 是否真的有效，跑 npm run check。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { loadEnv, valueState } = require('../lib/env.js');

const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');

const STATE_TXT = {
  set: '已設定',
  placeholder: '還是範例佔位字（等於沒設定）',
  unset: '未設定',
};

function line(s = '') { console.log(s); }

function mask(v) {
  const s = String(v || '');
  if (s.length <= 6) return '*'.repeat(s.length);
  return s.slice(0, 3) + '*'.repeat(Math.max(3, s.length - 6)) + s.slice(-3);
}

async function main() {
  line('=========================================');
  line(' 票價軌跡 Fare Tracker — 設定精靈');
  line('=========================================');
  line('');
  line('這個精靈幫你把 API 金鑰填進 .env（只存在你自己的電腦，已被 .gitignore 忽略）。');
  line('不填也能用：看板會以「模擬資料」完整運作；填了才會抓真實票價。');
  line('');
  line('兩個資料來源（擇一即可，都填更好）：');
  line('');
  line('  1. Travelpayouts（入門推薦，申請最快）');
  line('     - 給的是「該出發月的最低票價」快取，不是你指定日期的確切價。');
  line('     - 申請：https://www.travelpayouts.com 註冊 → Profile → API token。');
  line('');
  line('  2. Amadeus（進階，可查確切日期、指定航空含星宇、分艙等）');
  line('     - 申請：https://developers.amadeus.com 註冊 → 建立 App → 拿 API Key / Secret。');
  line('     - 誠實預期：免費註冊拿到的是 test 環境金鑰（樣本資料）；');
  line('       要「真資料」得申請 Production 金鑰，需要填帳單資料並通過審核，');
  line('       且免費額度有上限。不想跑這流程，用 Travelpayouts 就好。');
  line('');

  if (!process.stdin.isTTY) {
    line('偵測到目前不是互動式終端機，精靈無法問答。');
    line('手動設定方式：');
    line('  1. cp .env.example .env');
    line('  2. 打開 .env，把佔位字換成你的金鑰（留著佔位字會被當成未設定）');
    line('  3. npm run check 驗證 token 是否有效');
    process.exit(1);
  }

  const existing = loadEnv(ENV_PATH);
  const hasEnvFile = fs.existsSync(ENV_PATH);
  if (hasEnvFile) {
    line('偵測到已有 .env，目前狀態：');
    line(`  TP_TOKEN（Travelpayouts）：${STATE_TXT[valueState(existing.TP_TOKEN)]}`);
    line(`  AMADEUS_KEY：${STATE_TXT[valueState(existing.AMADEUS_KEY)]}`);
    line(`  AMADEUS_SECRET：${STATE_TXT[valueState(existing.AMADEUS_SECRET)]}`);
    line('（直接按 Enter 可保留現值，輸入新值會覆蓋。）');
    line('');
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a.trim())));

  const answers = {};

  line('--- Travelpayouts ---');
  const tp = await ask('貼上你的 TP_TOKEN（沒有就直接 Enter 跳過）：');
  if (tp) answers.TP_TOKEN = tp;

  line('');
  line('--- Amadeus（沒申請可直接 Enter 全部跳過）---');
  const ak = await ask('AMADEUS_KEY：');
  if (ak) answers.AMADEUS_KEY = ak;
  const as = await ask('AMADEUS_SECRET：');
  if (as) answers.AMADEUS_SECRET = as;
  let ahost = '';
  if (ak || as || valueState(existing.AMADEUS_KEY) === 'set') {
    ahost = await ask('Amadeus 環境（Enter＝正式環境 api.amadeus.com；只有 test 金鑰請輸入 test.api.amadeus.com）：');
    if (ahost) answers.AMADEUS_HOST = ahost;
  }
  rl.close();

  // 合併：新輸入 > 既有值；佔位字不寫回（等於清掉）
  const keys = ['AMADEUS_KEY', 'AMADEUS_SECRET', 'AMADEUS_HOST', 'TP_TOKEN'];
  const merged = {};
  for (const k of keys) {
    if (answers[k]) merged[k] = answers[k];
    else if (valueState(existing[k]) === 'set') merged[k] = existing[k];
  }
  // 保留 .env 裡使用者自己加的其他變數
  for (const k of Object.keys(existing)) {
    if (!keys.includes(k) && valueState(existing[k]) === 'set') merged[k] = existing[k];
  }

  const out = [
    '# 票價軌跡 Fare Tracker 的 API 金鑰（由 npm run setup 產生）',
    '# 這個檔已被 .gitignore 忽略，不會進 git。',
    '',
  ];
  for (const [k, v] of Object.entries(merged)) out.push(`${k}=${v}`);
  out.push('');
  fs.writeFileSync(ENV_PATH, out.join('\n'));

  line('');
  line(`已寫入 ${ENV_PATH}`);
  const set = Object.keys(merged).filter((k) => keys.includes(k));
  if (set.length) {
    line('目前設定：' + set.map((k) => `${k}=${mask(merged[k])}`).join('、'));
    line('');
    line('下一步：');
    line('  1. npm run check    — 各打一次 API，確認 token 真的有效（無效會直接告訴你）');
    line('  2. npm run serve    — 開看板 http://localhost:8760，新增航線就會抓真實價');
    line('  3. scripts/install-schedule.sh — （選用，macOS）裝每 3 小時自動掃描，軌跡才會長出來');
  } else {
    line('沒有填任何金鑰——看板仍可用，全部走「模擬」。之後想接真實價再跑一次 npm run setup。');
  }
}

main().catch((e) => { console.error('setup 失敗：' + e.message); process.exit(1); });
