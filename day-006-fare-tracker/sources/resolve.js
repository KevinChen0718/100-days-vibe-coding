/* =====================================================================
 * 來源路由：依設定挑資料來源，回傳統一格式（多帶 provider 標明出處）
 * ---------------------------------------------------------------------
 * 優先 Amadeus（真實 GDS、可指定航空含星宇、查確切日期、分艙等）；
 * 沒設定 Amadeus 才退回 Travelpayouts（快取的「該月最低」）。
 * 兩個都沒設 → 回 no_source（前端走模擬）。
 * ===================================================================== */

const amadeus = require('./amadeus.js');
const tp = require('./travelpayouts.js');
const { loadEnv, realValue } = require('../lib/env.js');

function creds() {
  const env = loadEnv();
  // realValue：空值或「你的token貼這裡」這種佔位字一律視為未設定，
  // 避免佔位字被當有效 token 去打 API 吃 401。
  return {
    amaKey: realValue(process.env.AMADEUS_KEY || env.AMADEUS_KEY),
    amaSecret: realValue(process.env.AMADEUS_SECRET || env.AMADEUS_SECRET),
    amaHost: realValue(process.env.AMADEUS_HOST || env.AMADEUS_HOST),
    tpToken: realValue(process.env.TP_TOKEN || env.TP_TOKEN),
  };
}

function sources() {
  const c = creds();
  const list = [];
  if (c.amaKey && c.amaSecret) list.push('amadeus');
  if (c.tpToken) list.push('travelpayouts');
  return list;
}

async function fetchReal(route, opts = {}) {
  const c = creds();
  // 1) Amadeus（首選）
  if (c.amaKey && c.amaSecret) {
    const r = await amadeus.fetchCheapest(route, { key: c.amaKey, secret: c.amaSecret, host: c.amaHost }, opts);
    if (r.ok && r.found) return Object.assign({ provider: 'amadeus' }, r);
    if (r.ok) return { ok: true, found: false, note: 'no_data', provider: 'amadeus' };
    // Amadeus 連線/認證錯誤 → 不靜默吃掉，但若有 TP 就往下退
    if (!c.tpToken) return Object.assign({ provider: 'amadeus' }, r);
  }
  // 2) Travelpayouts（沒 Amadeus 或 Amadeus 出錯時）
  if (c.tpToken) {
    const r = await tp.fetchCheapest(route, c.tpToken, opts);
    if (r.ok) return Object.assign({ provider: 'travelpayouts' }, r);
    return Object.assign({ provider: 'travelpayouts' }, r);
  }
  return { ok: false, error: 'no_source' };
}

module.exports = { fetchReal, sources, creds };
