// 資料來源 adapter。
// Day 2：mock 產生器（可被 overrides/<id>.json 的真資料覆蓋）。
// Day 3：把 queryRoute 換成全自動爬 Alaska / 接 API，其餘程式都不用動。
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// 星宇 intra-Asia 區域內常見里程階梯（mock 用，非官方保證）
const ECON_TIERS = [7500, 10000, 12500, 15000];
const BIZ_TIERS = [15000, 18000, 22000, 25000, 30000];

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

// 用字串產生穩定的偽隨機，讓 mock 每天固定、不會每次掃描亂跳
function seeded(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function mockMiles(routeId, cabin, date) {
  const tiers = cabin === 'business' ? BIZ_TIERS : ECON_TIERS;
  return tiers[seeded(routeId + cabin + date) % tiers.length];
}

/**
 * 查一條航線在日期區間內、各艙等每天的里程數。
 * @returns {Promise<{economy?:{date,miles}[], business?:{date,miles}[]}>}
 *   只回傳 watchlist 有勾選要追的艙等。
 */
export async function queryRoute(route) {
  // 真資料 override：若有 overrides/<id>.json，就用裡面的真值（我半自動查到的）
  let override = null;
  const ovPath = join(ROOT, 'overrides', route.id + '.json');
  if (existsSync(ovPath)) {
    try { override = JSON.parse(readFileSync(ovPath, 'utf8')); }
    catch (e) { console.error(`  ! overrides/${route.id}.json 讀取失敗：`, e.message); }
  }

  const dates = dateRange(route.dateStart, route.dateEnd);
  const result = {};
  for (const cabin of ['economy', 'business']) {
    if (!route.cabins?.[cabin]?.track) continue;
    const realDays = override?.[cabin] && typeof override[cabin] === 'object' ? override[cabin] : null;
    const hasReal = realDays && Object.keys(realDays).length > 0;
    result[cabin] = {
      source: hasReal ? 'real' : 'mock',   // real=有真值override；mock=亂編的，不可發通知
      days: dates.map(date => ({
        date,
        miles: realDays?.[date] ?? mockMiles(route.id, cabin, date),
      })),
    };
  }
  return result;
}

// 'mock' = 假資料；'live' = 真實抓取（Day 3 接上後改這裡）
export const SOURCE_MODE = 'mock';
