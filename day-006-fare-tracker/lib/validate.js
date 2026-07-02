/* =====================================================================
 * lib/validate.js — API 輸入驗證（零依賴）
 * ---------------------------------------------------------------------
 * serve.js 的 /api/track、/api/untrack 是無認證的寫入端點，
 * 落地前一定要驗證：
 *   1. 防止任意字串塞進 watchlist.json（無界成長、燒 API 額度）。
 *   2. 防止非法 IATA 代碼寫進資料檔後，前端查 AIRPORTS 得到
 *      undefined 直接 TypeError、整個看板白掉。
 * 驗證失敗回傳繁體中文訊息，讓前端能直接顯示人話。
 * ===================================================================== */

const E = require('../engine.js');

const MAX_ROUTES = 200;          // watchlist 航線數上限（防無界成長）
const MAX_BODY_BYTES = 64 * 1024; // API request body 上限

const RE_IATA = /^[A-Z]{3}$/;
const RE_AIRLINE = /^[A-Z0-9]{2}$/;
const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_ROUTE_ID = /^[A-Za-z0-9-]{1,120}$/;

function fail(message) { return { ok: false, message }; }

function isRealDate(s) {
  if (!RE_DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * 驗證 + 清洗一條要追蹤的航線。
 * 成功回 { ok:true, route }（route 只含白名單欄位）；失敗回 { ok:false, message }。
 */
function validateRoute(raw) {
  if (!raw || typeof raw !== 'object') return fail('請帶 JSON 物件當作航線資料。');

  const origin = typeof raw.origin === 'string' ? raw.origin.trim().toUpperCase() : '';
  const destination = typeof raw.destination === 'string' ? raw.destination.trim().toUpperCase() : '';

  if (!RE_IATA.test(origin)) return fail('出發地要是 3 碼機場代碼（例如 TPE）。');
  if (!RE_IATA.test(destination)) return fail('目的地要是 3 碼機場代碼（例如 NRT）。');
  if (!E.AIRPORTS[origin]) return fail(`出發地 ${origin} 不在支援清單（目前支援台灣出發：TPE / KHH / RMQ）。`);
  if (!E.AIRPORTS[destination]) return fail(`目的地 ${destination} 不在支援清單，看板暫時只支援內建的 ${Object.keys(E.AIRPORTS).length} 個機場。`);
  if (origin === destination) return fail('出發地和目的地不能一樣。');

  const airline = typeof raw.airline === 'string' && raw.airline.trim()
    ? raw.airline.trim().toUpperCase() : 'ANY';
  if (airline !== 'ANY' && !RE_AIRLINE.test(airline)) {
    return fail('航空公司要是 2 碼 IATA 代碼（例如 BR / JX），或 ANY 表示不限。');
  }

  const tripType = typeof raw.tripType === 'string' && raw.tripType ? raw.tripType : 'roundtrip';
  if (!E.TRIP_TYPES[tripType]) return fail('行程類型只能是 roundtrip（來回）或 oneway（單程）。');

  const cabin = typeof raw.cabin === 'string' && raw.cabin ? raw.cabin : 'economy';
  if (!E.CABINS[cabin]) return fail('艙等只能是 economy / premium / business / first。');

  const departDate = typeof raw.departDate === 'string' ? raw.departDate.trim() : '';
  if (!isRealDate(departDate)) return fail('出發日期格式要是 YYYY-MM-DD，且要是存在的日期。');

  let returnDate = null;
  if (tripType !== 'oneway') {
    returnDate = typeof raw.returnDate === 'string' ? raw.returnDate.trim() : '';
    if (!returnDate) return fail('來回行程要填回程日期（YYYY-MM-DD）。');
    if (!isRealDate(returnDate)) return fail('回程日期格式要是 YYYY-MM-DD，且要是存在的日期。');
    if (returnDate <= departDate) return fail('回程日期要晚於出發日期。');
  }

  let target = null;
  if (raw.target != null && raw.target !== '') {
    const t = Number(raw.target);
    if (!Number.isFinite(t) || t <= 0 || t > 10000000) return fail('目標價要是 0 到 10,000,000 之間的數字。');
    target = Math.round(t);
  }

  // 只放行白名單欄位，其他一律丟掉（防任意欄位塞進 watchlist.json）
  return {
    ok: true,
    route: { origin, destination, airline, tripType, departDate, returnDate, cabin, target },
  };
}

/** 驗證 /api/untrack 的航線 id（routeId 產出的格式：字母數字與連字號） */
function validateRouteId(id) {
  if (typeof id !== 'string' || !RE_ROUTE_ID.test(id)) {
    return fail('id 格式不對：要是追蹤清單裡的航線 id 字串。');
  }
  return { ok: true, id };
}

module.exports = { validateRoute, validateRouteId, MAX_ROUTES, MAX_BODY_BYTES };
