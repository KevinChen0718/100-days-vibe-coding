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
const { fetchReal, sources } = require('./sources/resolve.js');

const ROOT = __dirname;
const PORT = process.env.PORT || 8760;
const WATCH = path.join(ROOT, 'watchlist.json');
const DATA = path.join(ROOT, 'data.json');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const loadJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return d; } };
const saveJson = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2));
const hasSource = () => sources().length > 0;
const norm = (r) => Object.assign({ airline: 'ANY', tripType: 'roundtrip', cabin: 'economy' }, r);

function readBody(req) {
  return new Promise((res) => {
    let b = ''; req.on('data', (c) => (b += c));
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
    const route = norm(await readBody(req));
    if (!route.origin || !route.destination || !route.departDate) return sendJson(res, { ok: false, error: 'bad_route' }, 400);
    const id = E.routeId(route);
    const wl = loadJson(WATCH, { routes: [] }); if (!wl.routes) wl.routes = [];
    if (!wl.routes.some((x) => E.routeId(norm(x)) === id)) {
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
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  const srcs = sources();
  console.log(`✈️  票價軌跡跑在 http://localhost:${PORT}`);
  console.log(`   資料來源：${srcs.length ? srcs.join(' → ') : '（未設定，全部走模擬）'}`);
});
