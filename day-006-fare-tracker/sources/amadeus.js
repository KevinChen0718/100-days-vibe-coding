/* =====================================================================
 * Amadeus Self-Service — Flight Offers Search adapter
 * ---------------------------------------------------------------------
 * 真正的 GDS 即時票價：可指定航空（含星宇 JX）、查確切日期、分艙等。
 * 需要 .env 的 AMADEUS_KEY / AMADEUS_SECRET（免費註冊 developers.amadeus.com）。
 * AMADEUS_HOST 預設 api.amadeus.com（正式、真資料）；test.api.amadeus.com 是樣本資料。
 * 文件：https://developers.amadeus.com/self-service/category/flights
 * ===================================================================== */

const https = require('https');

const CABIN = { economy: 'ECONOMY', premium: 'PREMIUM_ECONOMY', business: 'BUSINESS', first: 'FIRST' };

function httpsReq(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => { let j = null; try { j = JSON.parse(b); } catch (e) {} resolve({ status: res.statusCode, json: j, raw: b }); });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// token 有效約 30 分鐘，process 內快取重用
let tokenCache = { token: null, exp: 0 };
async function getToken(key, secret, host, now) {
  if (tokenCache.token && now < tokenCache.exp) return tokenCache.token;
  const body = `grant_type=client_credentials&client_id=${encodeURIComponent(key)}&client_secret=${encodeURIComponent(secret)}`;
  const res = await httpsReq({
    host, path: '/v1/security/oauth2/token', method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  if (res.json && res.json.access_token) {
    tokenCache = { token: res.json.access_token, exp: now + Math.max(60, (res.json.expires_in || 1799) - 60) * 1000 };
    return tokenCache.token;
  }
  return null;
}

/**
 * 查某航線（可指定航空、艙等、確切去回日）的最低票價。
 * @param {object} route { origin, destination, departDate, returnDate, tripType, airline, cabin }
 * @param {object} creds { key, secret, host }
 */
async function fetchCheapest(route, creds, opts = {}) {
  const host = creds.host || 'api.amadeus.com';
  const now = opts.now || Date.now();
  const token = await getToken(creds.key, creds.secret, host, now);
  if (!token) return { ok: false, error: 'auth_failed' };

  const oneway = route.tripType === 'oneway';
  const params = new URLSearchParams({
    originLocationCode: route.origin,
    destinationLocationCode: route.destination,
    departureDate: route.departDate,
    adults: '1',
    currencyCode: opts.currency || 'TWD',
    travelClass: CABIN[route.cabin] || 'ECONOMY',
    max: '20',
  });
  if (!oneway && route.returnDate) params.set('returnDate', route.returnDate);
  if (route.airline && route.airline !== 'ANY') params.set('includedAirlineCodes', route.airline);

  const res = await httpsReq({
    host, path: `/v2/shopping/flight-offers?${params.toString()}`, method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (res.status !== 200 || !res.json || !res.json.data) {
    const detail = res.json && res.json.errors && res.json.errors[0] && (res.json.errors[0].detail || res.json.errors[0].title);
    return { ok: false, status: res.status, error: detail || 'request_failed' };
  }
  const offers = res.json.data;
  if (!offers.length) return { ok: true, found: false };

  offers.sort((a, b) => parseFloat(a.price.grandTotal) - parseFloat(b.price.grandTotal));
  const best = offers[0];
  const out = best.itineraries[0].segments;
  const airline = (best.validatingAirlineCodes && best.validatingAirlineCodes[0]) || out[0].carrierCode;
  return {
    ok: true, found: true,
    price: Math.round(parseFloat(best.price.grandTotal)),
    currency: best.price.currency || opts.currency || 'TWD',
    airline,
    departure_at: out[0].departure.at || null,
    return_at: (best.itineraries[1] && best.itineraries[1].segments[0].departure.at) || null,
    stops: out.length - 1,
  };
}

module.exports = { fetchCheapest, CABIN };
