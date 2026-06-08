// 資料來源 adapter。
// Day 2：mock 產生器（可被 overrides/<id>.json 的真資料覆蓋）。
// Day 3：接上「真實抓取」——直接 fetch Alaska（不開瀏覽器、不用登入），
//        其餘程式（scan / 門檻比對 / 通知 / 儀表板）完全不用動。
//
// Day 3 偵察 → 兩條真實資料路徑：
//   【主力】月曆端點 POST /search/api/shoulderDates（fareView:"as_awards"）
//       一次回錨點 ±15 天（≈31 天）的「每日最低獎勵票里程」，純 JSON、不分艙/航司。
//       → 一條航線一個請求就拿整段，避開下面那個限速地雷。這是預設走的路。
//   【次要】逐日端點 GET /search/results/__data.json
//       含 carrier / cabin / seatsRemaining 等細節（SvelteKit devalue 格式），
//       但有 token-bucket 限速（連發約 7~10 次就鎖成連續 406、冷卻數分鐘），
//       一次只能查一天。留給未來 #2 過濾航司 / #5 剩位提醒按需取用，預設不走。
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// ── 即時抓取設定 ──────────────────────────────────────────────
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 30000;
const THROTTLE_MS = 1500;       // 多個請求之間歇一下，別對 Alaska 猛打
const MAX_RETRIES = 1;          // 偶發錯誤給一次退避重試（硬限速救不了，不多試）
const RETRY_BACKOFF_MS = 2500;
const RETRY_STATUS = new Set([403, 406, 408, 425, 429, 500, 502, 503, 504]);
const CALENDAR_URL = 'https://www.alaskaair.com/search/api/shoulderDates';
const CALENDAR_WINDOW = 31;     // shoulderDates 一次回錨點 ±15 天 ≈ 31 天
// 次要（逐日詳細）路徑預設只追星宇（JX）；#2 會做成 per-route 可設定
const TRACKED_CARRIERS = ['JX'];
// RADAR_SOURCE=mock 可強制走假資料（離線開發 / demo 不想連網時用）
const LIVE = (process.env.RADAR_SOURCE ?? 'live') !== 'mock';

// 'mock' = 全假資料；'live' = 真實抓取
export const SOURCE_MODE = LIVE ? 'live' : 'mock';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function dateRange(start, end) {
  const out = [];
  const d = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  // 用本地日期格式化，不要走 toISOString()（UTC 會讓台北午夜倒退一天，害 override 對不上）
  const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  while (d <= last) {
    out.push(iso(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// ── 主力：月曆端點 shoulderDates（一次回多天，純 JSON，不受逐日端點的限速）──

function shoulderBody(route, anchorDate) {
  return JSON.stringify({
    origins: [route.from], destinations: [route.to], dates: [anchorDate],
    onba: false, dnba: false, numADTs: 1, numCHDs: 0,
    isAddingToAdultRes: false, sliceToSearch: 0, sliceSelections: [], selectedSegments: [],
    fareView: 'as_awards',                 // ← 里程模式（不是現金票）
    discount: {
      code: '', status: 0, expirationDate: new Date().toISOString(), message: '', memo: '', type: 0,
      searchContainsDiscountedFare: false, campaignName: '', campaignCode: '', distribution: 0,
      amount: 0, validationErrors: [], maxPassengers: 0, minPassengers: 0,
    },
    isAlaska: false, isWholeTripPricing: true,
  });
}

async function postShoulder(route, anchorDate) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt) await sleep(RETRY_BACKOFF_MS);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(CALENDAR_URL, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Content-Type': 'text/plain;charset=UTF-8',
          'Accept': 'application/json, */*',
          'Referer': 'https://www.alaskaair.com/search/results',
        },
        body: shoulderBody(route, anchorDate),
        signal: ctrl.signal,
      });
    } catch (e) { lastErr = e; clearTimeout(timer); continue; }
    clearTimeout(timer);
    if (res.ok) return await res.json();
    lastErr = new Error(`HTTP ${res.status}`);
    if (!RETRY_STATUS.has(res.status)) throw lastErr;
  }
  throw lastErr;
}

/**
 * 月曆抓取：一條航線打 1 個（區間 >31 天才多個）POST，拿整段「每日最低獎勵票里程」。
 * @returns {Promise<{date,miles}[]>} 只含「在 route 區間內且有位」的日期，已排序。
 */
async function fetchCalendar(route, dates, log) {
  const want = new Set(dates);
  const byDate = {};
  // 取錨點：每 ~30 天一個、放在窗格中央，覆蓋整段（多數區間只要 1 個）
  const anchors = [];
  for (let i = 0; i < dates.length; i += (CALENDAR_WINDOW - 1)) {
    anchors.push(dates[Math.min(i + Math.floor((CALENDAR_WINDOW - 1) / 2), dates.length - 1)]);
  }
  let ok = 0;
  for (const anchor of anchors) {
    let data;
    try { data = await postShoulder(route, anchor); ok++; }
    catch (e) {
      log?.(`    · ${route.from}→${route.to} @${anchor}：月曆查詢失敗（${e.message}）`);
      if (anchors.length > 1) await sleep(THROTTLE_MS);
      continue;
    }
    const list = data.calendarDates || data.shoulderDates || [];
    for (const d of list) {
      if (d.awardPoints == null) continue;       // 該日無位
      if (!want.has(d.date)) continue;           // 只留 route 區間內的日期
      byDate[d.date] = byDate[d.date] == null ? d.awardPoints : Math.min(byDate[d.date], d.awardPoints);
    }
    if (anchors.length > 1) await sleep(THROTTLE_MS);
  }
  if (ok === 0) throw new Error('月曆端點整條抓取失敗');
  return Object.keys(byDate).sort().map(date => ({ date, miles: byDate[date] }));
}

// ── 次要：逐日詳細端點 __data.json（含航司/艙等/剩位，但有限速；預設不走）──
// 留給未來 #2 過濾航司 / #5 剩位提醒按需取用。export 出去方便之後接。

// SvelteKit / devalue 把資料攤平成一個陣列，值之間用「索引」互相指；這個還原器組回物件樹。
function unflatten(values) {
  const hydrated = Array(values.length);
  function hydrate(index) {
    if (index === -1) return undefined;
    if (index === -2) return null;
    if (index === -3) return NaN;
    if (index === -4) return Infinity;
    if (index === -5) return -Infinity;
    if (index === -6) return -0;
    if (index in hydrated) return hydrated[index];
    const value = values[index];
    if (!value || typeof value !== 'object') {
      hydrated[index] = value;
    } else if (Array.isArray(value)) {
      if (typeof value[0] === 'string') hydrated[index] = value;   // 型別標記，用不到
      else { const arr = []; hydrated[index] = arr; for (const n of value) arr.push(hydrate(n)); }
    } else {
      const obj = {}; hydrated[index] = obj;
      for (const k in value) obj[k] = hydrate(value[k]);
    }
    return hydrated[index];
  }
  return hydrate(0);
}

function classifyCabin(cabins) {
  const c = (cabins || []).map(x => String(x).toUpperCase());
  if (c.some(x => x.includes('FIRST') || x.includes('BUSINESS'))) return 'business';
  if (c.some(x => x.includes('COACH') || x.includes('ECONOMY') || x.includes('MAIN'))) return 'economy';
  return null;
}

function extractFlights(text) {
  const dataArrays = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let obj; try { obj = JSON.parse(line); } catch { continue; }
    if (Array.isArray(obj.nodes)) for (const n of obj.nodes) if (n && Array.isArray(n.data)) dataArrays.push(n.data);
    if (Array.isArray(obj.data)) dataArrays.push(obj.data);   // streamed chunk
  }
  const flights = [];
  const seen = new Set();
  function walk(o, depth = 0) {
    if (!o || typeof o !== 'object' || depth > 14) return;
    if (o.solutions && o.segments) {
      const seg0 = o.segments[0] || {};
      const carrier = seg0.displayCarrier || seg0.publishingCarrier || {};
      for (const s of Object.values(o.solutions)) {
        if (!s || typeof s !== 'object' || s.atmosPoints == null) continue;
        const cabin = classifyCabin(s.cabins);
        if (!cabin) continue;
        const key = `${carrier.carrierCode}-${carrier.flightNumber}-${cabin}-${s.atmosPoints}`;
        if (seen.has(key)) continue;
        seen.add(key);
        flights.push({
          carrier: carrier.carrierCode, airline: carrier.carrierFullName, flight: carrier.flightNumber,
          cabin, miles: s.atmosPoints, cashUSD: s.grandTotal, seats: s.seatsRemaining,
        });
      }
    }
    for (const k in o) walk(o[k], depth + 1);
  }
  for (const da of dataArrays) { try { walk(unflatten(da)); } catch { /* 單塊壞掉就跳過 */ } }
  return flights;
}

// 查單一出發日的詳細航班（含航司/艙等/剩位）。次要工具，注意有限速。
export async function fetchDateDetailed(route, date) {
  const url = `https://www.alaskaair.com/search/results/__data.json`
    + `?O=${encodeURIComponent(route.from)}&D=${encodeURIComponent(route.to)}`
    + `&OD=${date}&A=1&C=0&L=0&RT=false&ShoppingMethod=onlineaward&locale=en-us`;
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt) await sleep(RETRY_BACKOFF_MS);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', 'Accept': 'text/sveltekit-data, */*', 'Referer': 'https://www.alaskaair.com/' },
        signal: ctrl.signal,
      });
    } catch (e) { lastErr = e; clearTimeout(timer); continue; }
    clearTimeout(timer);
    if (res.ok) return extractFlights(await res.text()).filter(f => TRACKED_CARRIERS.includes(f.carrier));
    lastErr = new Error(`HTTP ${res.status}`);
    if (!RETRY_STATUS.has(res.status)) throw lastErr;
  }
  throw lastErr;
}

// ── mock（保留：離線 / 即時抓取失敗時的 fallback）────────────────
const ECON_TIERS = [7500, 10000, 12500, 15000];                 // 星宇 intra-Asia 常見里程階梯（非官方）
const BIZ_TIERS = [15000, 18000, 22000, 25000, 30000];

function seeded(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function mockMiles(routeId, cabin, date) {
  const tiers = cabin === 'business' ? BIZ_TIERS : ECON_TIERS;
  return tiers[seeded(routeId + cabin + date) % tiers.length];
}

// mock 產生器：可被 overrides/<id>.json 的真值覆蓋
function queryMock(route, dates, cabins) {
  let override = null;
  const ovPath = join(ROOT, 'overrides', route.id + '.json');
  if (existsSync(ovPath)) {
    try { override = JSON.parse(readFileSync(ovPath, 'utf8')); }
    catch (e) { console.error(`  ! overrides/${route.id}.json 讀取失敗：`, e.message); }
  }
  const result = {};
  for (const cabin of cabins) {
    const realDays = override?.[cabin] && typeof override[cabin] === 'object' ? override[cabin] : null;
    const hasReal = realDays && Object.keys(realDays).length > 0;
    result[cabin] = {
      source: hasReal ? 'real' : 'mock',   // real=有真值 override；mock=亂編的，不可發通知
      days: dates.map(date => ({ date, miles: realDays?.[date] ?? mockMiles(route.id, cabin, date) })),
    };
  }
  return result;
}

/**
 * 查一條航線在日期區間內的每日里程。
 * 先試月曆即時抓取（source:'real'）；失敗才退回 mock（source:'mock'，絕不發通知）。
 *
 * 注意：月曆端點給的是「當天最低獎勵票里程」（不分艙/航司）——在星宇獨大的亞洲線上，
 * 這個最低價就是星宇經濟艙，因此對應到 economy。商務艙無法從這支端點分離，本版不提供
 * （要分艙得走次要的逐日端點 fetchDateDetailed，但有限速）。
 * @returns {Promise<{economy?:{source,days:{date,miles}[]}, business?:{...}}>}
 */
export async function queryRoute(route, { log = (m) => process.stdout.write(m + '\n') } = {}) {
  const dates = dateRange(route.dateStart, route.dateEnd);
  const cabins = ['economy', 'business'].filter(c => route.cabins?.[c]?.track);

  if (LIVE) {
    try {
      const days = await fetchCalendar(route, dates, log);
      const result = {};
      if (route.cabins?.economy?.track && days.length) {
        result.economy = { source: 'real', days };
      }
      if (route.cabins?.business?.track) {
        log?.(`    · ${route.from}→${route.to}：商務艙——月曆端點不分艙，本版未提供（見 README）`);
      }
      const lo = days.length ? Math.min(...days.map(d => d.miles)).toLocaleString() : '—';
      log?.(`    · ${route.from}→${route.to}：抓到 ${days.length} 天有位（最低 ${lo}）`);
      return result;   // 真的整段無位 → 回空物件（誠實），不退 mock
    } catch (e) {
      console.error(`  ! 即時抓取失敗，本條退回模擬：${e.message}`);
      // 落到 mock
    }
  }

  return queryMock(route, dates, cabins);
}
