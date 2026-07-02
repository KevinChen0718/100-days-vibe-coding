#!/usr/bin/env node
/* =====================================================================
 * serve.js — 本機伺服器（零依賴）
 * ---------------------------------------------------------------------
 * 1. 服務靜態檔（index.html / app.js / data.json …），帶 no-store 避免快取
 * 2. 提供 API 讓網頁「新增航線即自動抓真實價」：
 *      POST /api/track    body=route → 寫進 watchlist.json + 立刻抓一次真實價
 *      POST /api/untrack  body={id}  → 從 watchlist.json 與 data.json 移除
 *      GET  /api/ping                → 給前端偵測「有沒有後端」
 * 跑法：node serve.js （預設 http://localhost:8760）
 * ===================================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');
const E = require('./engine.js');
const { fetchReal, sources, creds } = require('./sources/resolve.js');
const { loadEnv, valueState } = require('./lib/env.js');
const { validateRoute, validateRouteId, MAX_ROUTES, MAX_BODY_BYTES } = require('./lib/validate.js');

const ROOT = __dirname;
const PORT = process.env.PORT || 8760;
// 預設只聽 127.0.0.1（本機）：/api/track 等寫入端點無認證，綁 0.0.0.0 等於
// 開放整個區網來燒你的 API 額度、改你的追蹤清單。真的要區網分享，
// 自己設 HOST=0.0.0.0 node serve.js（風險自負）。
const HOST = process.env.HOST || '127.0.0.1';
const WATCH = path.join(ROOT, 'watchlist.json');
const DATA = path.join(ROOT, 'data.json');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

// 讀 JSON 資料檔：檔案不存在 → 正常用預設值；檔案存在但壞掉（存檔到一半
// 斷電、手動改壞）→ 先備份原檔再用預設值，同時把救回方法印出來，
// 絕不默默把壞檔蓋掉害人丟資料。
function loadJson(p, d) {
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); } catch (e) { return d; } // 不存在：正常情況
  try { return JSON.parse(raw); } catch (e) {
    const bak = p + '.corrupt-' + Date.now();
    try { fs.copyFileSync(p, bak); } catch (e2) { /* 備份失敗就只警告 */ }
    console.error(`[警告] ${path.basename(p)} 不是有效的 JSON（可能上次寫檔被中斷）。`);
    console.error(`       原檔已備份成 ${path.basename(bak)}，先用空白資料繼續跑；`);
    console.error(`       想救回舊資料：打開備份檔修好 JSON 後，改名蓋回 ${path.basename(p)} 再重啟。`);
    return d;
  }
}
const saveJson = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2));
const hasSource = () => sources().length > 0;
const norm = (r) => Object.assign({ airline: 'ANY', tripType: 'roundtrip', cabin: 'economy' }, r);

function readBody(req) {
  return new Promise((res) => {
    let b = '';
    req.on('data', (c) => {
      b += c;
      if (b.length > MAX_BODY_BYTES) { req.destroy(); res({}); } // 防超大 body 撐爆記憶體
    });
    req.on('end', () => { try { res(JSON.parse(b || '{}')); } catch (e) { res({}); } });
  });
}
function sendJson(res, obj, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

// 抓某航線真實價並寫進 data.json（serve 與 scan 共用同一份 data.json）
async function fetchAndStore(route) {
  const id = E.routeId(route);
  if (!hasSource()) return { id, found: false, error: 'no_source' };
  const data = loadJson(DATA, { routes: {} });
  if (!data.routes) data.routes = {};
  const rec = data.routes[id] || { source: 'real', history: [] };
  const t = E.fmtDate(E.todayLocal());
  try {
    const res = await fetchReal(route);
    if (res.ok && res.found) {
      rec.source = 'real'; rec.current = res.price; rec.currency = res.currency;
      rec.provider = res.provider;
      rec.foundAirline = res.airline;
      rec.foundDepart = (res.departure_at || '').slice(0, 10) || null;
      rec.foundReturn = (res.return_at || '').slice(0, 10) || null;
      rec.history = (rec.history || []).filter((h) => h.date !== t);
      rec.history.push({ date: t, price: res.price });
      rec.history = rec.history.slice(-90);
      rec.lastOk = t; delete rec.note;
      data.routes[id] = rec; saveJson(DATA, data);
      return { id, found: true, price: res.price, currency: res.currency, airline: res.airline };
    }
    // 抓不到也記一筆，前端據此退回模擬、且避免每次重整重抓。
    rec.lastTry = t;
    if (res.ok) { // 明確查無（含指定航空沒資料）
      rec.source = 'none'; rec.current = null; rec.note = res.note || 'no_data';
    } else {      // 暫時性錯誤：保留先前真實價（若有）
      rec.note = 'error:' + (res.status || '?');
      if (rec.current == null) rec.source = 'none';
    }
    data.routes[id] = rec; saveJson(DATA, data);
    return { id, found: false, note: rec.note };
  } catch (e) { return { id, found: false, error: 'exception' }; }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);

  // ---------- API ----------
  if (u.pathname === '/api/ping') return sendJson(res, { ok: true, hasToken: hasSource(), sources: sources() });

  if (u.pathname === '/api/watchlist') {
    const wl = loadJson(WATCH, { routes: [] });
    return sendJson(res, { ok: true, routes: (wl.routes || []).map(norm) });
  }

  if (u.pathname === '/api/track' && req.method === 'POST') {
    // 落地前驗證：白名單機場 / 2 碼航空 / 合法日期 / 只留白名單欄位。
    // 沒有這關，任意字串會寫進 watchlist.json → 燒 API 額度、
    // 前端查 AIRPORTS 拿到 undefined 直接整頁白掉。
    const v = validateRoute(await readBody(req));
    if (!v.ok) return sendJson(res, { ok: false, error: 'bad_route', message: v.message }, 400);
    const route = norm(v.route);
    const id = E.routeId(route);
    const wl = loadJson(WATCH, { routes: [] }); if (!wl.routes) wl.routes = [];
    if (!wl.routes.some((x) => E.routeId(norm(x)) === id)) {
      if (wl.routes.length >= MAX_ROUTES) {
        return sendJson(res, { ok: false, error: 'watchlist_full', message: `追蹤清單已達上限 ${MAX_ROUTES} 條，請先移除幾條再新增。` }, 400);
      }
      wl.routes.push({
        origin: route.origin, destination: route.destination, airline: route.airline,
        tripType: route.tripType, departDate: route.departDate, returnDate: route.returnDate || null,
        cabin: route.cabin, target: route.target || null,
      });
      saveJson(WATCH, wl);
    }
    const result = await fetchAndStore(route);
    return sendJson(res, { ok: true, ...result });
  }

  if (u.pathname === '/api/untrack' && req.method === 'POST') {
    const { id } = await readBody(req);
    const vid = validateRouteId(id);
    if (!vid.ok) return sendJson(res, { ok: false, error: 'bad_id', message: vid.message }, 400);
    const wl = loadJson(WATCH, { routes: [] });
    wl.routes = (wl.routes || []).filter((x) => E.routeId(norm(x)) !== id);
    saveJson(WATCH, wl);
    const data = loadJson(DATA, { routes: {} });
    if (data.routes && data.routes[id]) { delete data.routes[id]; saveJson(DATA, data); }
    return sendJson(res, { ok: true });
  }

  // ---------- 靜態檔 ----------
  let rel = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname);
  const fp = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  // dotfile 一律擋掉：.env（真實 token）、.gitignore 這類檔案絕不能被瀏覽器抓走
  const dotfile = path.relative(ROOT, fp).split(path.sep).some((seg) => seg.startsWith('.'));
  if (dotfile) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
});

// ---------- 啟動時的 token 健檢（只看設定檔，不打外部 API）----------
function printHealth() {
  const env = loadEnv();
  const stateTxt = { set: '已設定', placeholder: '還是佔位字（沒改）', unset: '未設定' };
  const tp = valueState(process.env.TP_TOKEN || env.TP_TOKEN);
  const amaK = valueState(process.env.AMADEUS_KEY || env.AMADEUS_KEY);
  const amaS = valueState(process.env.AMADEUS_SECRET || env.AMADEUS_SECRET);
  const srcs = sources();

  console.log(`   Amadeus：KEY ${stateTxt[amaK]}、SECRET ${stateTxt[amaS]}`);
  console.log(`   Travelpayouts：TOKEN ${stateTxt[tp]}`);
  if (srcs.length) {
    console.log(`   資料來源：${srcs.join(' → ')}（token 是否真的有效，跑 npm run check 打一次 API 確認）`);
  } else {
    console.log('   資料來源：無 → 看板全部走「模擬」。想接真實票價，跑 npm run setup 一步步設定。');
    if (tp === 'placeholder' || amaK === 'placeholder' || amaS === 'placeholder') {
      console.log('   提示：.env 裡還留著範例的佔位字（例如「你的token貼這裡」），要換成真的金鑰才會生效。');
    }
  }
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`✗ port ${PORT} 已被別的程式占用（可能有另一個 serve.js 還開著）。`);
    console.error(`  解法一：關掉占用的程式（查誰在用：lsof -i :${PORT}）`);
    console.error(`  解法二：換一個 port 跑：PORT=8761 node serve.js`);
  } else if (err.code === 'EACCES') {
    console.error(`✗ 沒有權限綁 port ${PORT}。1024 以下的 port 要系統權限，換大一點的：PORT=8760 node serve.js`);
  } else {
    console.error('✗ 伺服器啟動失敗：' + err.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`票價軌跡跑在 http://localhost:${PORT}`);
  if (HOST === '127.0.0.1') {
    console.log('   只聽本機（127.0.0.1）。要讓區網其他裝置看：HOST=0.0.0.0 node serve.js（API 無認證，自負風險）');
  } else {
    console.log(`   聽在 ${HOST} —— 注意：/api/track 等寫入端點沒有認證，同網段的人都打得進來。`);
  }
  printHealth();
});
