#!/usr/bin/env node
/* =====================================================================
 * scan.js — 真實票價抓取排程入口
 * ---------------------------------------------------------------------
 * 讀 watchlist.json 的航線 → 用 Travelpayouts 抓最低票價 →
 * 累積進 data.json（一天一個觀測點，軌跡圖靠時間慢慢長出來）。
 *
 * 用法：
 *   1. 複製 .env.example → .env，填入 TP_TOKEN
 *   2. node scan.js
 *   3. 把網頁用 server 開（讀得到 data.json），有抓到的航線會標「真實」
 * ===================================================================== */

const fs = require('fs');
const path = require('path');
const E = require('./engine.js');
const { fetchReal, sources } = require('./sources/resolve.js');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data.json');
const WATCH = path.join(ROOT, 'watchlist.json');

function loadJson(p, dflt) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return dflt; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const srcs = sources();
  if (!srcs.length) {
    console.error('✗ 沒有設定任何資料來源。請複製 .env.example 成 .env，填入 AMADEUS_KEY/SECRET 或 TP_TOKEN。');
    process.exit(1);
  }
  console.log('資料來源：' + srcs.join(' → ') + '\n');

  const watch = (loadJson(WATCH, { routes: [] }).routes) || [];
  if (!watch.length) {
    console.error('✗ watchlist.json 沒有航線。新增幾條再跑。');
    process.exit(1);
  }

  const prev = loadJson(DATA, { routes: {} });
  const t = E.fmtDate(E.todayLocal());
  const out = { generatedAt: new Date().toISOString(), date: t, source: 'travelpayouts', routes: {} };
  let okCount = 0;

  for (const r0 of watch) {
    const r = Object.assign({ airline: 'ANY', tripType: 'roundtrip', cabin: 'economy' }, r0);
    const id = E.routeId(r);
    const tag = `${r.origin}→${r.destination} ${r.airline} ${r.departDate}`;
    process.stdout.write(`抓 ${tag} ... `);

    const rec = (prev.routes && prev.routes[id]) || { source: 'real', history: [] };
    try {
      const res = await fetchReal(r);
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
        delete rec.note;
        okCount++;
        console.log(`OK  ${res.price} ${res.currency}${res.airline ? ' (' + res.airline + ')' : ''} [${res.provider}]`);
      } else if (res.ok) {
        // 明確查無（含「指定航空沒資料」）→ 標記非真實，清掉舊的真實價，讓前端退回模擬
        rec.source = 'none'; rec.current = null; rec.note = res.note || 'no_data'; rec.lastTry = t;
        console.log('查無資料（' + (res.note || 'no_data') + '）');
      } else {
        // 連線/HTTP 錯誤視為暫時性：保留上次的真實價，只記 note（別誤判「票沒了」）
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
  console.log(`\n✓ 寫入 ${path.basename(DATA)}：共 ${watch.length} 條，成功抓到 ${okCount} 條真實票價。`);
}

main().catch((e) => { console.error('scan 失敗：', e); process.exit(1); });
