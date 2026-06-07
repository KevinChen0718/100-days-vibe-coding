// 零依賴的本地伺服器：服務儀表板靜態檔 + 提供追蹤清單的小 API。
// 跑法：node serve.js   然後開 http://localhost:4173
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import { loadEnv } from './lib/env.js';
import { runScan, readWatchlist, writeWatchlist } from './lib/scan.js';

loadEnv();
const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4173;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const sendJSON = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};
const readBody = req => new Promise((resolve, reject) => {
  let d = ''; req.on('data', c => (d += c));
  req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
});

createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  try {
    // ===== API =====
    if (url === '/api/watchlist' && req.method === 'GET') {
      return sendJSON(res, 200, readWatchlist());
    }
    if (url === '/api/watchlist' && req.method === 'POST') {
      const route = await readBody(req);
      if (!route.from || !route.to || !route.id) return sendJSON(res, 400, { error: '缺少 from / to / id' });
      const wl = readWatchlist();
      if (wl.routes.some(r => r.id === route.id)) return sendJSON(res, 409, { error: `這條航線已在追蹤清單（${route.id}）` });
      wl.routes.push(route);
      writeWatchlist(wl);
      const r = await runScan();                     // 加完馬上重掃，讓儀表板立刻有結果
      console.log(`＋ 新增追蹤：${route.from}→${route.to}（${route.id}）`);
      return sendJSON(res, 200, { ok: true, route, scan: { alertCount: r.alertCount, notified: r.notified } });
    }
    if (url.startsWith('/api/watchlist/') && req.method === 'DELETE') {
      const id = decodeURIComponent(url.slice('/api/watchlist/'.length));
      const wl = readWatchlist();
      const before = wl.routes.length;
      wl.routes = wl.routes.filter(r => r.id !== id);
      if (wl.routes.length === before) return sendJSON(res, 404, { error: `找不到 ${id}` });
      writeWatchlist(wl);
      await runScan();
      console.log(`－ 停止追蹤：${id}`);
      return sendJSON(res, 200, { ok: true });
    }

    // ===== 靜態檔 =====
    let p = decodeURIComponent(url);
    if (p === '/') p = '/index.html';
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(buf);
  } catch (e) {
    if (url.startsWith('/api/')) return sendJSON(res, 500, { error: String(e.message || e) });
    res.writeHead(404); res.end('not found');
  }
}).listen(PORT, () => console.log(`🛰️  儀表板：http://localhost:${PORT}`));
