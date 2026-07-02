#!/usr/bin/env node
/* =====================================================================
 * scan-v2.js — 真實票價抓取排程入口（2026-07-02 進版）
 * ---------------------------------------------------------------------
 * 原 scan.js 一字未動；要回退，把 scripts/scan-cron 指回 scan.js 即可。
 * v2 比 v1 多三件事：
 *   1. 過期航線不再查：departDate 已過就標 expired，不打 API。
 *   2. 連續查無退避：同一條連 3 次「查無資料」→ 之後每 7 天才再探一次。
 *      （TPE→LAX、指定星宇那兩條每天白打 16 次 API，就是這個洞。）
 *   3. 逾時 + 重試：單條查詢 35 秒沒回應就中止；連線層失敗等 3 秒重試一次。
 *      （v1 完全沒 timeout，網路抖動會讓整輪掃描掛住。）
 * 資料格式與 data.json 完全相容，只多記 failStreak 一個欄位。
 * ===================================================================== */

const fs = require('fs');
const path = require('path');
const E = require('./engine.js');
const { fetchReal, sources } = require('./sources/resolve.js');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data.json');
const WATCH = path.join(ROOT, 'watchlist.json');

const FETCH_TIMEOUT_MS = 35000; // 單條查詢逾時
const RETRY_WAIT_MS = 3000;     // 連線層失敗的重試間隔
const FAIL_STREAK_LIMIT = 3;    // 連續「查無」幾次後開始退避
const REPROBE_DAYS = 7;         // 退避後隔幾天再探一次

function loadJson(p, dflt) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return dflt; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function daysBetween(from, to) {
  const a = Date.parse(from), b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity;
  return (b - a) / 86400000;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      const timer = setTimeout(
        () => resolve({ ok: false, status: 'timeout', error: `逾時 ${ms}ms 沒回應` }), ms);
      if (timer.unref) timer.unref(); // 不讓計時器拖住程式收尾
    }),
  ]);
}

async function fetchWithRetry(route) {
  let res;
  try { res = await withTimeout(fetchReal(route), FETCH_TIMEOUT_MS); }
  catch (e) { res = { ok: false, error: e.message }; }
  if (!res.ok) { // 只有連線層失敗才重試；「查無資料」是明確答案不用再問
    await sleep(RETRY_WAIT_MS);
    try { res = await withTimeout(fetchReal(route), FETCH_TIMEOUT_MS); }
    catch (e) { res = { ok: false, error: e.message }; }
  }
  return res;
}

async function main() {
  const srcs = sources();
  if (!srcs.length) {
    console.error('✗ 沒有設定任何資料來源。請複製 .env.example 成 .env，填入 AMADEUS_KEY/SECRET 或 TP_TOKEN。');
    process.exit(1);
  }
  console.log('資料來源：' + srcs.join(' → ') + '（v2：過期跳過／查無退避／逾時重試）\n');

  const watch = (loadJson(WATCH, { routes: [] }).routes) || [];
  if (!watch.length) {
    console.error('✗ watchlist.json 沒有航線。新增幾條再跑。');
    process.exit(1);
  }

  const prev = loadJson(DATA, { routes: {} });
  const t = E.fmtDate(E.todayLocal());
  const out = { generatedAt: new Date().toISOString(), date: t, source: 'travelpayouts', routes: {} };
  let okCount = 0, skipCount = 0;

  for (const r0 of watch) {
    const r = Object.assign({ airline: 'ANY', tripType: 'roundtrip', cabin: 'economy' }, r0);
    const id = E.routeId(r);
    const tag = `${r.origin}→${r.destination} ${r.airline} ${r.departDate}`;
    const rec = (prev.routes && prev.routes[id]) || { source: 'real', history: [] };

    // v2-1：出發日已過 → 標 expired、不打 API（歷史軌跡保留給前端看）
    if (r.departDate && r.departDate < t) {
      rec.source = 'none'; rec.current = null; rec.note = 'expired';
      out.routes[id] = rec;
      skipCount++;
      console.log(`跳過 ${tag} ... 出發日已過（expired），建議從 watchlist 移除`);
      continue;
    }

    // v2-2：連續查無 ≥ ${FAIL_STREAK_LIMIT} 次 → 每 ${REPROBE_DAYS} 天才再探一次
    const streak = rec.failStreak || 0;
    if (streak >= FAIL_STREAK_LIMIT && rec.lastTry && daysBetween(rec.lastTry, t) < REPROBE_DAYS) {
      out.routes[id] = rec;
      skipCount++;
      console.log(`跳過 ${tag} ... 已連續 ${streak} 次查無（${rec.note || 'no_data'}），上次 ${rec.lastTry}、滿 ${REPROBE_DAYS} 天再探`);
      continue;
    }

    process.stdout.write(`抓 ${tag} ... `);
    try {
      const res = await fetchWithRetry(r);
      if (res.ok && res.found) {
        rec.source = 'real';
        rec.current = res.price;
        rec.currency = res.currency;
        rec.provider = res.provider;
        rec.foundAirline = res.airline;
        rec.foundDepart = (res.departure_at || '').slice(0, 10) || null;
        rec.foundReturn = (res.return_at || '').slice(0, 10) || null;
        rec.history = (rec.history || []).filter((h) => h.date !== t); // 同日重跑覆蓋
        rec.history.push({ date: t, price: res.price });
        rec.history = rec.history.slice(-90);
        rec.lastOk = t;
        rec.failStreak = 0;
        delete rec.note;
        okCount++;
        console.log(`OK  ${res.price} ${res.currency}${res.airline ? ' (' + res.airline + ')' : ''} [${res.provider}]`);
      } else if (res.ok) {
        // 明確查無（含「指定航空沒資料」）→ 標記非真實、累計退避次數
        rec.source = 'none'; rec.current = null; rec.note = res.note || 'no_data'; rec.lastTry = t;
        rec.failStreak = streak + 1;
        console.log(`查無資料（${res.note || 'no_data'}）${rec.failStreak >= FAIL_STREAK_LIMIT ? `→ 連 ${rec.failStreak} 次，進入 ${REPROBE_DAYS} 天退避` : ''}`);
      } else {
        // 連線/HTTP 錯誤視為暫時性：保留上次的真實價，只記 note、不累計退避
        rec.note = 'error:' + (res.status || '?'); rec.lastTry = t;
        if (rec.current == null) rec.source = 'none';
        console.log('失敗', res.status || '', res.error || '');
      }
    } catch (e) {
      rec.note = 'exception';
      console.log('例外', e.message);
    }
    out.routes[id] = rec;
    await sleep(1200); // 禮貌限速，避免連發被擋
  }

  fs.writeFileSync(DATA, JSON.stringify(out, null, 2));
  console.log(`\n✓ 寫入 ${path.basename(DATA)}：共 ${watch.length} 條，成功 ${okCount} 條、略過 ${skipCount} 條（省 API）。`);
}

main().catch((e) => { console.error('scan 失敗：', e); process.exit(1); });
