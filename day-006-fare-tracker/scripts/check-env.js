#!/usr/bin/env node
/* =====================================================================
 * scripts/check-env.js — 設定健檢（npm run check）
 * ---------------------------------------------------------------------
 * 回答一個問題：「為什麼我的看板全是模擬？」
 *   1. 金鑰三態：有效 / 無效（401）/ 未設定（含佔位字沒改）。
 *      每個已設定的來源只打 1 次 API：
 *        - Amadeus 只打 oauth token 端點（不查票、不吃搜尋額度）
 *        - Travelpayouts 打一條已知航線（TPE→NRT 當月）
 *   2. 資料檔健檢：watchlist.json / data.json 是否為有效 JSON。
 * 有任何「無效」→ exit code 1（可以放進腳本判斷）。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { loadEnv, valueState } = require('../lib/env.js');
const { creds } = require('../sources/resolve.js');

const ROOT = path.join(__dirname, '..');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(new Error('逾時 20 秒沒回應')); });
  });
}
function httpPost(host, p, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      host, path: p, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(new Error('逾時 20 秒沒回應')); });
    req.write(body); req.end();
  });
}

async function checkTp(token) {
  try {
    const params = new URLSearchParams({
      origin: 'TPE', destination: 'NRT',
      departure_at: new Date().toISOString().slice(0, 7),
      currency: 'twd', market: 'tw', one_way: 'false',
      sorting: 'price', limit: '1', page: '1', token,
    });
    const r = await httpGet(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params}`);
    let j = null; try { j = JSON.parse(r.body); } catch (e) {}
    if (r.status === 200 && j && j.success) return { ok: true, msg: '有效（測試查詢 TPE→NRT 成功）' };
    if (r.status === 401 || r.status === 403) return { ok: false, msg: `無效（HTTP ${r.status}）→ token 打錯或被停用，去 travelpayouts.com Profile 重新複製一次` };
    return { ok: false, msg: `異常（HTTP ${r.status}）→ 可能是暫時性問題，等幾分鐘再試` };
  } catch (e) {
    return { ok: false, msg: `連不上 api.travelpayouts.com（${e.message}）→ 檢查網路 / 防火牆 / Proxy` };
  }
}

async function checkAmadeus(key, secret, host) {
  const h = host || 'api.amadeus.com';
  try {
    const body = `grant_type=client_credentials&client_id=${encodeURIComponent(key)}&client_secret=${encodeURIComponent(secret)}`;
    const r = await httpPost(h, '/v1/security/oauth2/token', body);
    let j = null; try { j = JSON.parse(r.body); } catch (e) {}
    if (r.status === 200 && j && j.access_token) {
      const envNote = h.startsWith('test.') ? '（注意：這是 test 環境＝樣本資料，不是真實票價）' : '（正式環境）';
      return { ok: true, msg: '有效' + envNote };
    }
    if (r.status === 401) {
      return { ok: false, msg: '無效（401）→ Key/Secret 打錯，或你拿的是 test 金鑰卻打正式環境。只有 test 金鑰的話，.env 加一行 AMADEUS_HOST=test.api.amadeus.com' };
    }
    return { ok: false, msg: `異常（HTTP ${r.status}）${j && j.error_description ? '：' + j.error_description : ''}` };
  } catch (e) {
    return { ok: false, msg: `連不上 ${h}（${e.message}）→ 檢查網路 / 防火牆 / Proxy` };
  }
}

function checkJsonFile(name) {
  const p = path.join(ROOT, name);
  if (!fs.existsSync(p)) return { ok: true, msg: '不存在（正常，會自動建立）' };
  try { JSON.parse(fs.readFileSync(p, 'utf8')); return { ok: true, msg: '正常' }; }
  catch (e) {
    return { ok: false, msg: `壞掉了（不是有效 JSON）→ 打開檔案修復，或把它改名備份後重來；serve.js 啟動時也會自動備份壞檔` };
  }
}

async function main() {
  console.log('票價軌跡 — 設定健檢\n');

  const env = loadEnv();
  const c = creds();
  let bad = 0;

  // --- Travelpayouts ---
  const tpState = valueState(process.env.TP_TOKEN || env.TP_TOKEN);
  if (!c.tpToken) {
    console.log(`Travelpayouts：未設定${tpState === 'placeholder' ? '（.env 裡還是「你的token貼這裡」佔位字，要換成真的）' : ''}`);
  } else {
    process.stdout.write('Travelpayouts：驗證中 ... ');
    const r = await checkTp(c.tpToken);
    console.log(r.msg);
    if (!r.ok) bad++;
  }

  // --- Amadeus ---
  if (!c.amaKey || !c.amaSecret) {
    const ks = valueState(process.env.AMADEUS_KEY || env.AMADEUS_KEY);
    console.log(`Amadeus：未設定${ks === 'placeholder' ? '（.env 裡還是佔位字）' : ''}`);
  } else {
    process.stdout.write('Amadeus：驗證中 ... ');
    const r = await checkAmadeus(c.amaKey, c.amaSecret, c.amaHost);
    console.log(r.msg);
    if (!r.ok) bad++;
  }

  // --- 資料檔 ---
  console.log('');
  for (const f of ['watchlist.json', 'data.json']) {
    const r = checkJsonFile(f);
    console.log(`${f}：${r.msg}`);
    if (!r.ok) bad++;
  }

  console.log('');
  if (!c.tpToken && !(c.amaKey && c.amaSecret)) {
    console.log('結論：目前沒有任何有效來源，看板會全部走「模擬」。跑 npm run setup 一步步設定。');
  } else if (bad) {
    console.log('結論：有項目需要處理（見上方訊息）。修好後再跑一次 npm run check。');
    process.exit(1);
  } else {
    console.log('結論：一切正常。npm run serve 開看板，或裝排程讓軌跡每天長：scripts/install-schedule.sh');
  }
}

main().catch((e) => { console.error('健檢失敗：' + e.message); process.exit(1); });
