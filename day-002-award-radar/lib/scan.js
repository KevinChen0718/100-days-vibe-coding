// 掃描核心：被 radar.js（命令列）和 serve.js（API）共用。
// 讀 watchlist → 查每條航線 → 比對門檻 → 寫 data.json → 達標就通知。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { queryRoute, SOURCE_MODE } from '../sources/alaska.js';
import { notify, notifyEnabled } from '../notify/index.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CABIN_NAME = { economy: '經濟艙', business: '商務艙' };
const nowTaipei = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }) + ' (UTC+8)';

// 通知去重狀態：記「上次通知過的 routeId|cabin → {min, hitDates}」。
// 只在「第一次達標 / 變更便宜 / 多了新日期」時才通知，避免排程每 3 小時對同一張票重複 ping。
const STATE_PATH = join(ROOT, 'notify-state.json');
function readNotifyState() {
  try { return JSON.parse(readFileSync(STATE_PATH, 'utf8')); } catch { return {}; }
}
function writeNotifyState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export function readWatchlist() {
  return JSON.parse(readFileSync(join(ROOT, 'watchlist.json'), 'utf8'));
}
export function writeWatchlist(wl) {
  writeFileSync(join(ROOT, 'watchlist.json'), JSON.stringify(wl, null, 2) + '\n', 'utf8');
}

export async function runScan({ log = () => {}, sendAlerts = true } = {}) {
  const watchlist = readWatchlist();
  const results = [];
  const alerts = [];

  for (const route of watchlist.routes) {
    const daily = await queryRoute(route);
    const cabins = {};
    for (const cabin of ['economy', 'business']) {
      const cab = daily[cabin];
      if (!cab) continue;
      const days = cab.days;
      const threshold = route.cabins[cabin].threshold;
      const min = Math.min(...days.map(d => d.miles));
      const minDates = days.filter(d => d.miles === min).map(d => d.date);
      const hitDays = days.filter(d => d.miles <= threshold).map(d => d.date);
      const hit = hitDays.length > 0;
      cabins[cabin] = { source: cab.source, threshold, days, min, minDates, hitDays, hit };
      const mark = cab.source === 'mock' ? '（模擬）' : '';
      log(`  ${route.from}→${route.to} ${CABIN_NAME[cabin]}${mark}：${hit
        ? `🎯 ${hitDays.length} 天達標（最低 ${min.toLocaleString()}）`
        : `最低 ${min.toLocaleString()}，差 ${(min - threshold).toLocaleString()}`}`);
      // 只有真實資料才發通知；模擬資料絕不發，免得害人撲空
      if (hit && cab.source === 'real') alerts.push({ route, cabin, threshold, min, hitDays });
    }
    results.push({
      routeId: route.id, from: route.from, to: route.to,
      fromName: route.fromName, toName: route.toName,
      tripType: route.tripType || 'oneway',
      dateStart: route.dateStart, dateEnd: route.dateEnd, cabins,
    });
  }

  const data = { scannedAt: nowTaipei(), source: SOURCE_MODE, results };
  writeFileSync(join(ROOT, 'data.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');

  let notified = 0, suppressed = 0;
  if (sendAlerts && notifyEnabled()) {
    const prior = readNotifyState();
    const newState = { ...prior };   // 預設保留（抓不到 / mock 的航線狀態不動，免得誤判「票沒了」）
    // 1) 真資料但這次沒達標 → 票沒了，清掉紀錄（之後再達標會當「新」通知）
    for (const r of results) for (const cabin of ['economy', 'business']) {
      const c = r.cabins[cabin];
      if (c && c.source === 'real' && !c.hit) delete newState[`${r.routeId}|${cabin}`];
    }
    // 2) 達標的 → 去重判斷要不要通知
    for (const a of alerts) {
      const key = `${a.route.id}|${a.cabin}`;
      const p = prior[key];
      const newDates = p ? a.hitDays.filter(d => !p.hitDates.includes(d)) : a.hitDays;
      const worthy = !p || a.min < p.min || newDates.length > 0;   // 第一次 / 變便宜 / 多新日期
      if (worthy) {
        const sent = await notify(formatAlert(a));
        if (sent.length) {
          notified++; newState[key] = { min: a.min, hitDates: a.hitDays };
          log(`  ✔ 已通知（${sent.join('、')}）：${a.route.from}→${a.route.to} ${CABIN_NAME[a.cabin]}`);
        }
        // 送失敗 → 不更新 state，下次重試
      } else {
        suppressed++; newState[key] = p;   // 與上次相同，安靜，保留原紀錄
        log(`  · ${a.route.from}→${a.route.to} ${CABIN_NAME[a.cabin]}：與上次通知相同，略過（去重）`);
      }
    }
    writeNotifyState(newState);
  }
  return { data, alertCount: alerts.length, notified, suppressed, notifyReady: notifyEnabled() };
}

function formatAlert({ route, cabin, threshold, min, hitDays }) {
  const days = hitDays.map(d => d.slice(5)).join('、');
  return [
    `🎯 發現里程優惠票！`,
    `${route.fromName}→${route.toName}（${route.from}→${route.to}）`,
    `${CABIN_NAME[cabin]}：${min.toLocaleString()} 點（你的門檻 ${threshold.toLocaleString()}）`,
    `達標日期：${days}`,
    `快去 Alaska 訂：https://www.alaskaair.com/`,
  ].join('\n');
}
