/* =====================================================================
 * Travelpayouts（Aviasales）Data API 抓取 adapter
 * ---------------------------------------------------------------------
 * 端點：GET https://api.travelpayouts.com/aviasales/v3/prices_for_dates
 * 回傳「快取的真實最低票價」（非即時報價，但是真實有人查到的價）。
 * token 來自 .env 的 TP_TOKEN（免費註冊 travelpayouts.com 後在 Profile 拿）。
 * 文件：https://support.travelpayouts.com/hc/en-us/articles/203956163
 * ===================================================================== */

const https = require('https');

const BASE = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates';

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) { /* 非 JSON（多半是被擋的 HTML） */ }
        resolve({ status: res.statusCode, json, raw: body });
      });
    }).on('error', reject);
  });
}

/**
 * 抓某航線、某出發日（可含回程）的最低票價。
 * @param {object} route { origin, destination, departDate, returnDate, tripType, airline }
 * @param {string} token Travelpayouts API token
 * @returns {Promise<{ok, found?, price?, currency?, airline?, error?, status?}>}
 */
async function fetchCheapest(route, token, opts = {}) {
  const currency = opts.currency || 'twd';
  const market = opts.market || 'tw';
  const oneway = route.tripType === 'oneway';

  // 用「出發月」查（YYYY-MM）。實測：給確切遠期日期常常 cache miss 回空，
  // 改用月份才抓得到「該月最低票價」這個對追蹤最實用的數字。
  const depMonth = (route.departDate || '').slice(0, 7);
  const retMonth = (route.returnDate || '').slice(0, 7);

  const params = new URLSearchParams({
    origin: route.origin,
    destination: route.destination,
    departure_at: depMonth,
    currency,
    market,
    one_way: oneway ? 'true' : 'false',
    sorting: 'price',
    limit: '30',
    page: '1',
    token,
  });
  if (!oneway && retMonth) params.set('return_at', retMonth);

  const { status, json } = await httpGetJson(`${BASE}?${params.toString()}`);
  if (status !== 200 || !json || !json.success) {
    return { ok: false, status, error: (json && json.error) || 'request_failed' };
  }

  let rows = json.data || [];
  // 指定航空 → 只認那家；資料源沒有它的票就老實回「查無」，
  // 絕不拿別家航空的便宜票頂替（否則會掛錯航空名、誤導使用者）。
  if (route.airline && route.airline !== 'ANY') {
    rows = rows.filter((r) => r.airline === route.airline);
    if (!rows.length) return { ok: true, found: false, note: 'no_airline_data' };
  }
  if (!rows.length) return { ok: true, found: false };

  rows.sort((a, b) => a.price - b.price);
  const best = rows[0];
  return {
    ok: true,
    found: true,
    price: best.price,
    currency: json.currency || currency,
    airline: best.airline || null,
    departure_at: best.departure_at || null,
    return_at: best.return_at || null,
    transfers: best.transfers,
  };
}

module.exports = { fetchCheapest };
