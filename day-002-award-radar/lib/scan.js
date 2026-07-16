// 掃描核心：被 radar.js（命令列）和 serve.js（API）共用。
// 讀 watchlist → 查每條航線 → 比對門檻 → 寫 data.json → 達標就通知。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { carriersForRoute, fetchDateDetailed, queryRoute, SOURCE_MODE } from '../sources/alaska.js';
import { notify, notifyEnabled } from '../notify/index.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CABIN_NAME = { economy: '經濟艙', business: '商務艙' };
const STAGE2_BUDGET = 5;
const STAGE2_DELAY_MS = 2500;
const DATA_PATH = join(ROOT, 'data.json');
const nowTaipei = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }) + ' (UTC+8)';
const clockTaipei = () => {
  const d = new Date();
  return `${d.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// 通知去重狀態：記「上次通知過的 routeId|cabin → flights」。
// 只在「第一次確認 / 同航班變便宜 / 剩位跌到 2 席以下」時通知，避免排程每 3 小時重複 ping。
const STATE_PATH = join(ROOT, 'notify-state.json');
function readNotifyState() {
  try { return JSON.parse(readFileSync(STATE_PATH, 'utf8')); } catch { return {}; }
}
function writeNotifyState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}
function readPreviousData() {
  try { return JSON.parse(readFileSync(DATA_PATH, 'utf8')); } catch { return null; }
}

export function readWatchlist() {
  return JSON.parse(readFileSync(join(ROOT, 'watchlist.json'), 'utf8'));
}
export function writeWatchlist(wl) {
  writeFileSync(join(ROOT, 'watchlist.json'), JSON.stringify(wl, null, 2) + '\n', 'utf8');
}

export async function runScan({ log = () => {}, sendAlerts = true } = {}) {
  const watchlist = readWatchlist();
  const previousData = readPreviousData();
  const results = [];
  const stage2Tasks = [];
  const alerts = [];
  const mockAlerts = [];

  for (const route of watchlist.routes) {
    const daily = await queryRoute(route, { log });
    const cabins = {};
    for (const cabin of ['economy', 'business']) {
      const cab = daily[cabin];
      if (!cab) continue;
      const days = cab.days;
      const threshold = route.cabins[cabin].threshold;
      if (!days.length) {
        cabins[cabin] = { source: cab.source, threshold, days, min: null, minDates: [], hitDays: [], hit: false };
        log(`  ${route.from}→${route.to} ${CABIN_NAME[cabin]}：沒有可用日期`);
        continue;
      }
      const min = Math.min(...days.map(d => d.miles));
      const minDates = days.filter(d => d.miles === min).map(d => d.date);
      const hitDays = days.filter(d => d.miles <= threshold).map(d => d.date);
      const hit = hitDays.length > 0;
      cabins[cabin] = { source: cab.source, threshold, days, min, minDates, hitDays, hit };
      const mark = cab.source === 'mock' ? '（模擬）' : '';
      log(`  ${route.from}→${route.to} ${CABIN_NAME[cabin]}${mark}：${hit
        ? `🎯 ${hitDays.length} 天達標（最低 ${min.toLocaleString()}）`
        : `最低 ${min.toLocaleString()}，差 ${(min - threshold).toLocaleString()}`}`);
      for (const day of days.filter(d => d.miles <= threshold)) {
        day.confirmed = false;
        stage2Tasks.push({
          route, cabin, threshold, source: cab.source, day,
          priorUnconfirmed: wasPriorUnconfirmed(previousData, route.id, cabin, day.date),
        });
      }
    }
    results.push({
      routeId: route.id, from: route.from, to: route.to,
      fromName: route.fromName, toName: route.toName,
      tripType: route.tripType || 'oneway',
      dateStart: route.dateStart, dateEnd: route.dateEnd, cabins,
    });
  }

  await confirmCandidateDays(stage2Tasks, { alerts, mockAlerts, log });

  const data = { scannedAt: nowTaipei(), source: SOURCE_MODE, results };
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');

  let notified = 0, suppressed = 0;
  if (sendAlerts && notifyEnabled()) {
    const prior = readNotifyState();
    const newState = { ...prior };   // 預設保留（抓不到 / mock 的航線狀態不動，免得誤判「票沒了」）
    // 1) 真資料但這次沒達標 → 票沒了，清掉紀錄（之後再達標會當「新」通知）
    for (const r of results) for (const cabin of ['economy', 'business']) {
      const c = r.cabins[cabin];
      if (c && c.source === 'real' && !c.hit) delete newState[`${r.routeId}|${cabin}`];
    }
    // 2) 逐日確認過的真實航班 → 去重判斷要不要通知
    for (const a of alerts) {
      const key = `${a.route.id}|${a.cabin}`;
      const p = normalizeRouteState(prior[key]);
      const triggered = a.flights.filter(f => shouldNotifyFlight(p.flights[flightStateKey(a, f)], f));
      if (triggered.length) {
        const sent = await notify(formatAlert({ ...a, flights: triggered }));
        if (sent.length) {
          notified++;
          newState[key] = mergeFlightState(normalizeRouteState(newState[key]), a, triggered);
          log(`  ✔ 已通知（${sent.join('、')}）：${a.route.from}→${a.route.to} ${CABIN_NAME[a.cabin]}`);
        }
        // 送失敗 → 不更新 state，下次重試
      } else {
        suppressed++; newState[key] = prior[key];   // 與上次相同，安靜，保留原紀錄
        log(`  · ${a.route.from}→${a.route.to} ${CABIN_NAME[a.cabin]}：與上次通知相同，略過（去重）`);
      }
    }
    writeNotifyState(newState);
  }
  for (const a of mockAlerts) {
    log(`\n[模擬] 本來會發出的通知：\n${formatAlert(a)}\n`);
  }
  return { data, alertCount: alerts.length, mockAlertCount: mockAlerts.length, notified, suppressed, notifyReady: notifyEnabled() };
}

function wasPriorUnconfirmed(previousData, routeId, cabin, date) {
  const prior = previousData?.results?.find(r => r.routeId === routeId)?.cabins?.[cabin]?.days?.find(d => d.date === date);
  return prior?.confirmed === false;
}

async function confirmCandidateDays(tasks, { alerts, mockAlerts, log }) {
  if (!tasks.length) return;
  tasks.sort((a, b) =>
    (a.day.miles - b.day.miles) ||
    (Number(b.priorUnconfirmed) - Number(a.priorUnconfirmed)) ||
    a.day.date.localeCompare(b.day.date) ||
    a.route.id.localeCompare(b.route.id) ||
    a.cabin.localeCompare(b.cabin)
  );
  const selected = tasks.slice(0, STAGE2_BUDGET);
  const skipped = tasks.slice(STAGE2_BUDGET);
  for (const task of skipped) {
    log(`    · ${task.route.from}→${task.route.to} ${task.day.date} ${CABIN_NAME[task.cabin]}：本輪額度用完、留待下輪（候選 ${task.day.miles.toLocaleString()} 點）`);
  }

  let lastStart = 0;
  for (let i = 0; i < selected.length; i++) {
    const task = selected[i];
    const wait = Math.max(0, STAGE2_DELAY_MS - (Date.now() - lastStart));
    if (wait) await sleep(wait);
    lastStart = Date.now();
    const carriers = carriersForRoute(task.route);
    log(`    · ${clockTaipei()} Stage 2 逐日確認 ${i + 1}/${selected.length}：${task.route.from}→${task.route.to} ${task.day.date} ${CABIN_NAME[task.cabin]}（${carriers.join('、')}）`);
    let detailed;
    try {
      detailed = await fetchDateDetailed(task.route, task.day.date, carriers, { forceMock: task.source === 'mock' });
    } catch (e) {
      task.day.confirmed = false;
      log(`    · ${task.route.from}→${task.route.to} ${task.day.date}：逐日查詢失敗，待確認（${e.message}）`);
      continue;
    }
    const flights = detailed
      .filter(f => f.cabin === task.cabin && f.miles <= task.threshold && carriers.includes(String(f.carrier).toUpperCase()))
      .map(normalizeFlight)
      .sort((a, b) => (a.miles - b.miles) || String(a.departTime).localeCompare(String(b.departTime)));
    if (!flights.length) {
      task.day.confirmed = false;
      log(`    · ${task.route.from}→${task.route.to} ${task.day.date}：追蹤航司沒有 ≤ ${task.threshold.toLocaleString()} 點的 ${CABIN_NAME[task.cabin]}，不推播`);
      continue;
    }
    task.day.confirmed = true;
    task.day.flights = flights;
    task.day.confirmedAt = nowTaipei();
    log(`    · ${task.route.from}→${task.route.to} ${task.day.date}：已確認 ${flights.length} 班 ${carriers.join('、')} 航班達標`);
    const alert = { route: task.route, cabin: task.cabin, threshold: task.threshold, date: task.day.date, flights, confirmedAt: task.day.confirmedAt, source: task.source };
    if (task.source === 'real') alerts.push(alert);
    else mockAlerts.push(alert);
  }
}

function normalizeFlight(f) {
  return {
    carrier: f.carrier || '',
    flightNumber: f.flightNumber || f.flight || '',
    departTime: f.departTime || '',
    arriveTime: f.arriveTime || '',
    cabin: f.cabin,
    miles: Number(f.miles),
    seatsRemaining: f.seatsRemaining == null ? null : Number(f.seatsRemaining),
  };
}

function normalizeRouteState(state) {
  if (!state || typeof state !== 'object') return { flights: {} };
  if (state.flights && typeof state.flights === 'object') return state;
  const flights = {};
  if (Array.isArray(state.hitDates)) {
    for (const date of state.hitDates) flights[`legacy|${date}`] = { miles: state.min, seatsRemaining: null, lowSeatNotified: false };
  }
  return { flights };
}

function flightStateKey(alert, flight) {
  return `${alert.date}|${flight.carrier}|${flight.flightNumber}|${flight.departTime || ''}`;
}

function shouldNotifyFlight(priorFlight, flight) {
  if (!priorFlight) return true;
  if (Number.isFinite(flight.miles) && Number.isFinite(priorFlight.miles) && flight.miles < priorFlight.miles) return true;
  if (Number.isFinite(flight.seatsRemaining) && flight.seatsRemaining <= 2 && !priorFlight.lowSeatNotified) return true;
  return false;
}

function mergeFlightState(state, alert, flights) {
  const out = { flights: { ...state.flights } };
  for (const f of flights) {
    const key = flightStateKey(alert, f);
    const prior = out.flights[key] || {};
    out.flights[key] = {
      date: alert.date,
      carrier: f.carrier,
      flightNumber: f.flightNumber,
      departTime: f.departTime,
      cabin: alert.cabin,
      miles: f.miles,
      seatsRemaining: f.seatsRemaining,
      lowSeatNotified: prior.lowSeatNotified || (Number.isFinite(f.seatsRemaining) && f.seatsRemaining <= 2),
      notifiedAt: nowTaipei(),
    };
  }
  return out;
}

function formatSeats(seats) {
  return Number.isFinite(seats) ? `剩 ${seats} 席` : '剩位不明';
}

function formatFlightLine(f) {
  const flightNo = `${f.carrier}${f.flightNumber || ''}`;
  const time = f.departTime || f.arriveTime ? ` ${f.departTime || '—'}→${f.arriveTime || '—'}` : '';
  return `・${flightNo}${time}：${f.miles.toLocaleString()} 點，${formatSeats(f.seatsRemaining)}`;
}

function formatAlert({ route, cabin, threshold, date, flights, confirmedAt }) {
  return [
    `🎯 發現里程優惠票！`,
    `${route.fromName}→${route.toName}（${route.from}→${route.to}）`,
    `${CABIN_NAME[cabin]} ${date.slice(5)}（你的門檻 ${threshold.toLocaleString()} 點）`,
    ...flights.map(formatFlightLine),
    `確認時間：${confirmedAt}`,
    `快去 Alaska 訂：https://www.alaskaair.com/`,
  ].join('\n');
}
