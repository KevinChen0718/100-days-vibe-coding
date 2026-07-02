/* =====================================================================
 * 票價軌跡 Fare Tracker — app.js
 * UI 渲染、互動、localStorage 持久化。畫圖純手刻 SVG，零圖表庫。
 * ===================================================================== */

(function () {
  'use strict';
  const E = window.FareEngine;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const STORE = 'fare-tracker:v3';

  // 外部來源字串（API 回的航空代碼、舊資料的機場代碼）進 innerHTML 前一律跳脫，
  // 防 stored-XSS；也讓「一筆髒資料」只是顯示怪，不會炸掉整頁。
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // 查機場：查無（舊資料裡的未知代碼）回一個佔位物件，不讓 undefined 往下炸
  function airport(code) {
    return E.AIRPORTS[code] || { city: code, country: '', flag: '', region: 'other' };
  }
  function cabinOf(r) { return E.CABINS[r.cabin] || E.CABINS.economy; }

  // 卡片折線顏色跟趨勢走（沿用 CSS 變數的色票）
  const COLOR = { up: '#C2553D', down: '#4F9D69', flat: '#D87C56' };

  let state = {
    routes: [],
    sort: 'signal',
    filters: { origin: 'all', region: 'all', country: 'all', dest: 'all', airline: 'all', trip: 'all' },
  };
  const REGION_ORDER = ['ne-asia', 'se-asia', 'oceania', 'n-america', 'europe', 'mideast'];
  function emptyFilters() { return { origin: 'all', region: 'all', country: 'all', dest: 'all', airline: 'all', trip: 'all' }; }

  /* ---------- 持久化 ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        state.routes = (JSON.parse(raw).routes || []).map(backfill);
        return;
      }
    } catch (e) { /* 忽略壞掉的舊資料 */ }
    state.routes = seedDefaults();
    save();
  }
  // 舊資料缺欄位時補上預設，避免新功能讀到 undefined
  function backfill(r) {
    if (!r.airline) r.airline = 'ANY';
    if (!r.tripType) r.tripType = 'roundtrip';
    if (r.tripType === 'roundtrip' && !r.returnDate) {
      r.returnDate = E.fmtDate(E.addDays(E.parseDate(r.departDate), 7));
    }
    r.id = E.routeId(r);
    return r;
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ routes: state.routes })); } catch (e) {}
  }

  // 第一次開啟鋪幾條熱門線，看板不空。這 4 條跟 watchlist.json 完全一致，
  // 接上 Travelpayouts（跑過 scan.js）後就全部顯示真實票價。
  function seedDefaults() {
    const mk = (o, d, dep, ret, cabin, airline, target) => {
      const r = {
        id: '', origin: o, destination: d, airline, tripType: 'roundtrip',
        departDate: dep, returnDate: ret, cabin, target, addedAt: 0,
      };
      r.id = E.routeId(r);
      return r;
    };
    return [
      mk('TPE', 'NRT', '2026-08-15', '2026-08-22', 'economy', 'ANY', 11000),
      mk('TPE', 'ICN', '2026-07-25', '2026-07-29', 'economy', 'ANY', 8000),
      mk('TPE', 'BKK', '2026-09-17', '2026-09-25', 'economy', 'ANY', 9500),
      mk('TPE', 'LAX', '2026-10-12', '2026-10-26', 'economy', 'ANY', 28000),
    ];
  }

  /* ---------- 真實資料（scan.js 產出的 data.json）---------- */
  let REAL = {};
  async function loadReal() {
    try {
      const res = await fetch('data.json', { cache: 'no-store' });
      if (!res.ok) return;
      const j = await res.json();
      REAL = j.routes || {};
    } catch (e) { REAL = {}; } // file:// 開、或還沒跑 scan.js → 全部走模擬
  }

  /* ---------- 後端同步（serve.js 在跑時才有；靜態開啟則自動降級為純模擬）---------- */
  let hasServer = false;
  let serverSources = []; // 後端回報的資料來源（空陣列＝沒設 token，全模擬）
  let fetchingRealId = null; // 正在向後端抓真實價的航線 id（給詳情頁顯示「抓取中」）
  async function pingServer() {
    try {
      const r = await fetch('/api/ping', { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        hasServer = !!j.ok;
        serverSources = Array.isArray(j.sources) ? j.sources : [];
      }
    } catch (e) { hasServer = false; }
  }
  async function syncTrack(route) {
    if (!hasServer) return null;
    try {
      const r = await fetch('/api/track', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(route),
      });
      return r.ok ? await r.json() : null;
    } catch (e) { return null; }
  }
  function syncUntrack(id) {
    if (!hasServer) return;
    fetch('/api/untrack', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    }).catch(() => {});
  }
  // 有後端時，追蹤清單以伺服器的 watchlist 為準（這樣換瀏覽器/換 port 都看得到同一份）
  async function loadWatchlist() {
    if (!hasServer) return;
    try {
      const r = await fetch('/api/watchlist', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (!Array.isArray(j.routes)) return;
      state.routes = j.routes.map((x) => {
        const route = Object.assign({ airline: 'ANY', tripType: 'roundtrip', cabin: 'economy' }, x);
        route.id = E.routeId(route);
        if (!route.addedAt) route.addedAt = 0;
        return route;
      });
      save();
    } catch (e) { /* 取不到就沿用 localStorage */ }
  }

  /* ---------- 取得某航線的序列 + 分析（有真實資料優先，否則模擬）---------- */
  function evalRoute(r) {
    const real = REAL[r.id];
    if (real && real.source === 'real' && real.current != null) {
      const hist = (real.history || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
      const series = hist.map((h) => ({
        date: h.date, price: h.price, sale: false,
        daysToDep: E.daysBetween(E.parseDate(h.date), E.parseDate(r.departDate)),
      }));
      if (!series.length) {
        const d = real.lastOk || E.fmtDate(E.todayLocal());
        series.push({ date: d, price: real.current, sale: false, daysToDep: E.daysBetween(E.parseDate(d), E.parseDate(r.departDate)) });
      }
      const stats = E.analyze(series, r);
      // 真實軌跡靠每天 scan 累積，太短時不給會誤導的買點百分位
      const accumulating = series.length < 14;
      return { route: r, series, stats, isReal: true, accumulating, real };
    }
    const series = E.getPriceHistory(r);
    const stats = E.analyze(series, r);
    return { route: r, series, stats, isReal: false, accumulating: false };
  }

  /* =====================================================================
   * SVG 畫圖
   * ===================================================================== */

  // 卡片用的迷你火花圖
  function sparkSVG(series, color) {
    const W = 300, H = 70, pad = 6;
    const prices = series.map((p) => p.price);
    const min = Math.min(...prices), max = Math.max(...prices), range = max - min || 1;
    const n = prices.length;
    if (n < 2) { // 真實資料第一天只有一點，畫個置中的點就好
      return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="none">
        <circle cx="${W / 2}" cy="${H / 2}" r="4" fill="${color}"/>
        <circle cx="${W / 2}" cy="${H / 2}" r="8" fill="${color}" opacity=".18"/></svg>`;
    }
    const X = (i) => pad + (i * (W - 2 * pad)) / (n - 1);
    const Y = (v) => H - pad - ((v - min) / range) * (H - 2 * pad);
    const pts = prices.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
    const line = pts.join(' ');
    const area = `M ${X(0)},${H} L ${pts.join(' L ')} L ${X(n - 1)},${H} Z`;
    const cx = X(n - 1), cy = Y(prices[n - 1]);
    const gid = 'sg' + Math.abs(hashColor(color + n));
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="none">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity=".22"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${gid})"/>
      <polyline points="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.4" fill="${color}"/>
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="${color}" opacity=".18"/>
    </svg>`;
  }
  function hashColor(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

  // 詳情用的大圖（含座標軸、目標線、最低/最高/現價標記）。回傳 {svg, geo}
  const BC = { W: 680, H: 240, padL: 54, padR: 16, padT: 14, padB: 26 };
  function bigChartSVG(series, target, color) {
    const { W, H, padL, padR, padT, padB } = BC;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    if (series.length < 2) { // 點太少畫不成線，顯示提示
      return {
        svg: `<svg id="bigChart" viewBox="0 0 ${W} ${H}" width="100%" style="display:block">
          <circle cx="${W / 2}" cy="${H / 2}" r="6" fill="${color}"/>
          <text x="${W / 2}" y="${H / 2 + 30}" text-anchor="middle" font-size="13" fill="#A89E94">真實軌跡累積中，明天起會長出折線</text>
        </svg>`,
        geo: { W, H, padL, padR, padT, padB, plotW, plotH, min: 0, max: 1, range: 1, n: 1 },
      };
    }
    const prices = series.map((p) => p.price);
    let min = Math.min(...prices), max = Math.max(...prices);
    const pad = (max - min) * 0.12 || max * 0.1;
    min = Math.max(0, min - pad); max = max + pad;
    const range = max - min || 1;
    const n = prices.length;
    const X = (i) => padL + (i * plotW) / (n - 1);
    const Y = (v) => padT + (1 - (v - min) / range) * plotH;

    // 水平格線 + y 軸標籤
    let grid = '';
    for (let g = 0; g <= 3; g++) {
      const val = min + (range * g) / 3;
      const y = Y(val);
      grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#EFE7DA" stroke-width="1"/>`;
      grid += `<text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#A89E94">${axisMoney(val)}</text>`;
    }
    // x 軸日期標籤（5 個）
    let xlab = '';
    for (let k = 0; k <= 4; k++) {
      const i = Math.round((k * (n - 1)) / 4);
      const d = E.parseDate(series[i].date);
      xlab += `<text x="${X(i).toFixed(1)}" y="${H - 7}" text-anchor="middle" font-size="11" fill="#A89E94">${d.getMonth() + 1}/${d.getDate()}</text>`;
    }

    const pts = prices.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
    const line = pts.join(' ');
    const area = `M ${X(0)},${Y(min)} L ${pts.join(' L ')} L ${X(n - 1)},${Y(min)} Z`;

    // 目標線
    let tgt = '';
    if (target) {
      const ty = Y(Math.max(min, Math.min(max, target)));
      tgt = `<line x1="${padL}" y1="${ty.toFixed(1)}" x2="${W - padR}" y2="${ty.toFixed(1)}" stroke="#4F9D69" stroke-width="1.5" stroke-dasharray="5 4"/>
        <text x="${W - padR}" y="${(ty - 6).toFixed(1)}" text-anchor="end" font-size="11" font-weight="700" fill="#4F9D69">目標 ${E.money(target)}</text>`;
    }

    // 最低 / 最高 / 現價 標記
    const iMin = prices.indexOf(Math.min(...prices));
    const iMax = prices.indexOf(Math.max(...prices));
    const iCur = n - 1;
    const dot = (i, c, r) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(prices[i]).toFixed(1)}" r="${r}" fill="${c}"/>`;

    const gid = 'bg' + Math.abs(hashColor(color + 'big'));
    const svg = `<svg id="bigChart" viewBox="0 0 ${W} ${H}" width="100%" style="display:block">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity=".20"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}${xlab}
      <path d="${area}" fill="url(#${gid})"/>
      <polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>
      ${tgt}
      ${dot(iMin, '#4F9D69', 4)}${dot(iMax, '#C2553D', 4)}
      ${dot(iCur, color, 5)}<circle cx="${X(iCur).toFixed(1)}" cy="${Y(prices[iCur]).toFixed(1)}" r="9" fill="${color}" opacity=".18"/>
      <line id="bcCross" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" stroke="${color}" stroke-width="1" stroke-dasharray="3 3" opacity="0"/>
      <circle id="bcDot" r="4.5" fill="#fff" stroke="${color}" stroke-width="2.5" opacity="0"/>
      <rect id="bcHit" x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="transparent"/>
    </svg>`;

    const geo = { W, H, padL, padR, padT, padB, plotW, plotH, min, max, range, n };
    return { svg, geo };
  }
  function axisMoney(n) {
    // 統一用千分位整數（取整到 100），避免 萬/k 混用看起來雜亂
    return (Math.round(n / 100) * 100).toLocaleString('en-US');
  }

  /* =====================================================================
   * 渲染：KPI、卡片、Modal
   * ===================================================================== */

  function render() {
    const evals = state.routes.map(evalRoute);
    renderKPIs(evals);
    renderFilterBar(evals);
    renderGrid(evals);
    $('#routeCount').textContent = evals.length ? `· 共 ${evals.length} 條` : '';
    $('#todayPill').textContent = '今日 ' + E.fmtDate(E.todayLocal());

    const realCount = evals.filter((e) => e.isReal).length;
    const badge = $('#srcBadge');
    if (badge) {
      if (realCount > 0) badge.textContent = `資料：${realCount} 真實 / ${evals.length - realCount} 模擬`;
      else if (hasServer && !serverSources.length) badge.textContent = '模擬資料 Demo · 未設定 token（終端機跑 npm run setup 可接真實價）';
      else badge.textContent = '模擬資料 Demo';
    }
  }

  /* ---------- 篩選 ---------- */
  function applyFilters(evals) {
    const f = state.filters;
    return evals.filter((e) => {
      const r = e.route, a = airport(r.destination);
      if (f.origin !== 'all' && r.origin !== f.origin) return false;
      if (f.region !== 'all' && a.region !== f.region) return false;
      if (f.country !== 'all' && a.country !== f.country) return false;
      if (f.dest !== 'all' && r.destination !== f.dest) return false;
      if (f.airline !== 'all' && (r.airline || 'ANY') !== f.airline) return false;
      if (f.trip !== 'all' && (r.tripType || 'roundtrip') !== f.trip) return false;
      return true;
    });
  }

  function renderFilterBar(evals) {
    const bar = $('#filterbar');
    if (!evals.length) { bar.innerHTML = ''; bar.style.display = 'none'; return; }
    bar.style.display = '';
    const uniq = (a) => [...new Set(a)];
    const f = state.filters;
    const opt = (v, label, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${label}</option>`;
    const sel = (id, label, cur, opts) =>
      `<div class="fsel"><label>${label}</label><select data-f="${id}">${opt('all', '全部', cur)}${opts}</select></div>`;

    // 目的地（城市）完整清單（非 home），用來建構 區域→國家→城市 階層
    const allDests = Object.entries(E.AIRPORTS).filter(([, a]) => a.region !== 'home');
    const regions = REGION_ORDER.filter((rg) => allDests.some(([, a]) => a.region === rg));
    // 國家：受「區域」收斂
    const countries = uniq(
      allDests.filter(([, a]) => f.region === 'all' || a.region === f.region).map(([, a]) => a.country)
    );
    // 城市：受「區域 + 國家」收斂
    const cities = allDests.filter(([, a]) =>
      (f.region === 'all' || a.region === f.region) && (f.country === 'all' || a.country === f.country)
    );

    // 出發地 / 航空 / 行程也用完整清單（選到沒在追的會落到空狀態，可一鍵新增）
    const origins = Object.entries(E.AIRPORTS).filter(([, a]) => a.region === 'home').map(([c]) => c);
    const airlines = Object.keys(E.AIRLINES);
    const trips = Object.keys(E.TRIP_TYPES);

    const filtered = applyFilters(evals);
    const active = Object.keys(f).some((k) => f[k] !== 'all');

    bar.innerHTML =
      `<span class="ftitle">🔍 篩選</span>` +
      sel('origin', '出發地', f.origin, origins.map((o) => opt(o, `${E.AIRPORTS[o].flag} ${E.AIRPORTS[o].city}`, f.origin)).join('')) +
      sel('region', '區域', f.region, regions.map((rg) => opt(rg, E.REGION_LABEL[rg] || rg, f.region)).join('')) +
      sel('country', '國家', f.country, countries.map((c) => opt(c, c, f.country)).join('')) +
      sel('dest', '目的地', f.dest, cities.map(([code, a]) => opt(code, `${a.flag} ${a.city}`, f.dest)).join('')) +
      sel('airline', '航空公司', f.airline, airlines.map((a) => opt(a, E.AIRLINES[a] ? E.AIRLINES[a].name : a, f.airline)).join('')) +
      sel('trip', '行程', f.trip, trips.map((tp) => opt(tp, E.TRIP_TYPES[tp] ? E.TRIP_TYPES[tp].label : tp, f.trip)).join('')) +
      `<button class="btn-clear" id="clearFilters"${active ? '' : ' hidden'}>清除篩選 ✕</button>` +
      `<span class="filter-count">顯示 <b>${filtered.length}</b> / ${evals.length} 條</span>`;

    $$('#filterbar select').forEach((s) => s.addEventListener('change', () => setFilter(s.dataset.f, s.value)));
    const clr = $('#clearFilters');
    if (clr) clr.addEventListener('click', () => { state.filters = emptyFilters(); render(); });
  }

  // 上層改變要把下層重設（區域變→國家/目的地歸零；國家變→目的地歸零）
  function setFilter(field, val) {
    state.filters[field] = val;
    if (field === 'region') { state.filters.country = 'all'; state.filters.dest = 'all'; }
    if (field === 'country') { state.filters.dest = 'all'; }
    render();
  }

  function renderKPIs(evals) {
    const withStats = evals.filter((e) => e.stats);
    const total = withStats.length;
    const deals = withStats.filter((e) => e.stats.hitTarget).length;

    let best = null;
    withStats.forEach((e) => { if (!best || e.stats.vsAvgPct < best.stats.vsAvgPct) best = e; });
    const avgPct = total ? Math.round(withStats.reduce((a, e) => a + e.stats.pct, 0) / total) : 0;

    const bestTxt = best
      ? `${esc(best.route.origin)}→${esc(best.route.destination)} ${best.stats.vsAvgPct <= 0 ? '比均價低' : '比均價高'} ${Math.abs(best.stats.vsAvgPct)}%`
      : '—';
    const bestVal = best ? (best.stats.vsAvgPct > 0 ? '+' : '') + best.stats.vsAvgPct + '%' : '—';

    $('#kpis').innerHTML = `
      <div class="kpi">
        <div class="label">✈️ 追蹤航線</div>
        <div class="value">${total}</div>
        <div class="sub">條國際線</div>
      </div>
      <div class="kpi green">
        <div class="label">🎯 已達目標價</div>
        <div class="value">${deals}</div>
        <div class="sub">跌破你設的目標</div>
      </div>
      <div class="kpi accent">
        <div class="label">🔥 今日最甜</div>
        <div class="value">${bestVal}</div>
        <div class="sub">${bestTxt}</div>
      </div>
      <div class="kpi">
        <div class="label">📊 平均買點水位</div>
        <div class="value">${avgPct}<span style="font-size:15px;font-weight:700">百分位</span></div>
        <div class="sub">越低越接近 90 天低點</div>
      </div>`;
  }

  function sortEvals(evals) {
    const arr = evals.filter((e) => e.stats);
    const bad = evals.filter((e) => !e.stats);
    const by = {
      signal: (a, b) => a.stats.pct - b.stats.pct,
      drop: (a, b) => a.stats.vsAvgPct - b.stats.vsAvgPct,
      price: (a, b) => a.stats.current - b.stats.current,
    }[state.sort];
    return arr.sort(by).concat(bad);
  }

  function renderGrid(evals) {
    const grid = $('#grid');
    if (!evals.length) {
      grid.innerHTML = `<div class="empty">
        <div class="big">🧭</div>
        <h3>還沒有追蹤任何航線</h3>
        <p>按右上角「新增追蹤航線」，挑一條你想飛的國際線開始盯價。</p>
        <button class="btn primary" onclick="document.getElementById('addBtn').click()">＋ 新增第一條航線</button>
      </div>`;
      return;
    }
    const shown = applyFilters(evals);
    if (!shown.length) {
      const f = state.filters;
      const destSel = f.dest !== 'all' ? E.AIRPORTS[f.dest] : null;
      const where = destSel ? ` ${destSel.flag} ${destSel.city}` : '符合條件';
      const addBtn = destSel
        ? `<button class="btn primary" id="addFromFilter">＋ 追蹤${destSel.flag} ${destSel.city}</button> `
        : `<button class="btn primary" id="addGeneric">＋ 新增航線</button> `;
      grid.innerHTML = `<div class="empty">
        <div class="big">🔍</div>
        <h3>還沒有追蹤${where}的航線</h3>
        <p>${destSel ? '這條還沒在你的清單裡，要不要加進來盯？' : '這個條件目前沒有追蹤中的航線，新增一條、或清除篩選看全部。'}</p>
        ${addBtn}<button class="btn ghost" onclick="document.getElementById('clearFilters')?.click()">清除篩選</button>
      </div>`;
      const af = $('#addFromFilter');
      if (af) af.addEventListener('click', () => openAdd({ dest: f.dest }));
      const ag = $('#addGeneric');
      if (ag) ag.addEventListener('click', () => openAdd());
      return;
    }
    grid.innerHTML = sortEvals(shown).map(cardHTML).join('');
    // 綁卡片事件
    $$('.card', grid).forEach((el) => {
      const id = el.dataset.id;
      el.addEventListener('click', (ev) => {
        if (ev.target.closest('.remove')) return;
        openDetail(id);
      });
      const rm = $('.remove', el);
      if (rm) rm.addEventListener('click', () => removeRoute(id));
    });
  }

  function cardHTML(e) {
    const r = e.route, s = e.stats;
    const dst = airport(r.destination), org = airport(r.origin);
    const head = `<div class="route-line">
        <span>${org.flag}</span><span class="iata">${esc(r.origin)}</span>
        <span class="arrow">→</span>
        <span>${dst.flag}</span><span class="iata">${esc(r.destination)}</span>
      </div>`;
    if (!s) {
      return `<div class="card" data-id="${esc(r.id)}">
        <div class="card-top">${head}<button class="remove" title="移除">✕</button></div>
        <div class="route-sub">${esc(dst.city)}</div>
        <p style="color:var(--muted);font-size:13px;margin-top:20px">這條航線暫無資料。</p>
      </div>`;
    }
    const tArrow = s.trend === 'up' ? '▲' : s.trend === 'down' ? '▼' : '▬';
    const tTxt = s.trend === 'flat' ? '持平' : Math.abs(s.trendPct) + '%';
    const deal = s.hitTarget ? `<div class="deal-flag">🎯 已達標</div>` : '';
    const targetTxt = r.target
      ? `<div class="target-info">目標 <b>${E.money(r.target)}</b><br>${s.hitTarget ? '<span style="color:var(--green);font-weight:700">已跌破！</span>' : '差 ' + E.money(Math.max(0, s.current - r.target))}</div>`
      : `<div class="target-info">未設目標價</div>`;
    const sourceTag = e.isReal ? `<span class="tag real">● 真實</span>` : `<span class="tag sim">● 模擬</span>`;
    // 真實航線顯示「實際抓到的航空」（不限航空時會是某家廉航/全服務；指定航空時就是那家）
    const airShort = (e.isReal && e.real && e.real.foundAirline)
      ? ((E.AIRLINES[e.real.foundAirline] || {}).short || e.real.foundAirline)
      : (E.AIRLINES[r.airline] || E.AIRLINES.ANY).short;
    const trendHTML = e.accumulating ? '' : `<span class="trend ${s.trend}">${tArrow} ${tTxt}</span>`;
    const subHTML = e.accumulating
      ? `<div class="vsavg">真實資料累積中（已記錄 ${e.series.length} 天）</div>`
      : `<div class="vsavg">vs 90 天均價 ${s.vsAvgPct > 0 ? '+' : ''}${s.vsAvgPct}%</div>`;
    const signalHTML = e.accumulating
      ? `<span class="signal acc">📡 累積中</span>`
      : `<span class="signal ${s.signal}">${s.signalLabel}</span>`;

    return `<div class="card" data-id="${esc(r.id)}">
      ${deal}
      <div class="card-top">
        <div>
          ${head}
          <div class="route-sub">${esc(org.city)} → ${esc(dst.city)}</div>
        </div>
        <button class="remove" title="移除">✕</button>
      </div>
      <div class="route-tags">
        ${sourceTag}
        <span class="tag air">${esc(airShort)}</span>
        <span class="tag cabin">${cabinOf(r).label}</span>
        <span class="tag ${r.tripType === 'oneway' ? 'ow' : ''}">${tripDateStr(r)}</span>
        <span class="tag">剩 ${s.daysToDep} 天</span>
      </div>
      <div class="price-row">
        <span class="price-now">${E.money(s.current)}</span>
        ${trendHTML}
      </div>
      ${subHTML}
      ${sparkSVG(e.series, COLOR[s.trend])}
      <div class="card-bottom">
        ${signalHTML}
        ${targetTxt}
      </div>
    </div>`;
  }

  /* ---------- 詳情 Modal ---------- */
  let curEval = null;
  function openDetail(id) {
    const r = state.routes.find((x) => x.id === id);
    if (!r) return;
    curEval = evalRoute(r);
    const s = curEval.stats;
    if (!s) return; // 髒資料算不出統計 → 卡片已顯示「暫無資料」，不開詳情
    const dst = airport(r.destination), org = airport(r.origin);
    const air = E.AIRLINES[r.airline] || E.AIRLINES.ANY;
    const trip = E.TRIP_TYPES[r.tripType] || E.TRIP_TYPES.roundtrip;
    const { svg } = bigChartSVG(curEval.series, r.target, COLOR[s.trend]);
    const acc = curEval.accumulating;

    const providerLabel = { amadeus: 'Amadeus', travelpayouts: 'Travelpayouts' };
    const provName = curEval.real && providerLabel[curEval.real.provider] || '真實資料';
    const sourceLine = curEval.isReal
      ? `<span class="tag real" style="vertical-align:middle">● 真實票價（${provName}）</span>`
      : `<span class="tag sim" style="vertical-align:middle">● 模擬資料</span>`;
    let realNote = '';
    if (curEval.isReal && curEval.real) {
      const rl = curEval.real;
      const an = rl.foundAirline ? esc((E.AIRLINES[rl.foundAirline] || {}).name || rl.foundAirline) : '';
      const dep = rl.foundDepart ? formatDateShort(rl.foundDepart) : '';
      const ret = rl.foundReturn ? '–' + formatDateShort(rl.foundReturn) : '';
      if (rl.provider === 'amadeus') {
        // Amadeus 是查你選的確切日期、真實 GDS 票價
        realNote = `<div class="real-note">✅ <b>Amadeus 即時票價</b>${an ? `，最低為 <b>${an}</b>` : ''}，依你選的日期查詢。屬 GDS 公佈票價，可能與航空官網促銷價略有差異。</div>`;
      } else {
        // Travelpayouts 是「該出發月最低」的快取價
        realNote = `<div class="real-note">ℹ️ 此為 <b>${r.departDate.slice(0, 7)} 出發月的最低票價</b>（Travelpayouts 快取）${an ? `，由 <b>${an}</b> 提供` : ''}${dep ? `，實際最低落在 <b>${dep}${ret}</b> 出發` : ''}。你設定的確切日期不一定剛好是這個價。</div>`;
      }
    } else if (!curEval.isReal && fetchingRealId === r.id) {
      realNote = `<div class="real-note">📡 正在抓真實價…（先顯示模擬，抓到會自動換成真實）</div>`;
    }
    const trendHTML = acc ? '' :
      `<span class="trend ${s.trend}">${s.trend === 'up' ? '▲' : s.trend === 'down' ? '▼' : '▬'} 近一週 ${s.trend === 'flat' ? '持平' : (s.trendPct > 0 ? '+' : '') + s.trendPct + '%'}</span>`;
    const signalHTML = acc ? `<span class="signal acc">📡 真實累積中</span>` : `<span class="signal ${s.signal}">${s.signalLabel}</span>`;
    const statGrid = curEval.isReal
      ? `<div class="stat-grid">
          <div class="stat"><div class="l">最新真實價</div><div class="v" style="color:var(--forest)">${E.money(s.current)}</div></div>
          <div class="stat"><div class="l">記錄最低</div><div class="v" style="color:var(--green)">${E.money(s.min)}</div></div>
          <div class="stat"><div class="l">記錄最高</div><div class="v" style="color:var(--red)">${E.money(s.max)}</div></div>
          <div class="stat"><div class="l">記錄天數</div><div class="v">${curEval.series.length}<span style="font-size:13px;font-weight:600;color:var(--muted)"> 天</span></div></div>
        </div>`
      : `<div class="stat-grid">
          <div class="stat"><div class="l">90 天最低</div><div class="v" style="color:var(--green)">${E.money(s.min)}</div></div>
          <div class="stat"><div class="l">90 天最高</div><div class="v" style="color:var(--red)">${E.money(s.max)}</div></div>
          <div class="stat"><div class="l">平均價</div><div class="v">${E.money(s.avg)}</div></div>
          <div class="stat"><div class="l">促銷天數</div><div class="v">${s.saleDays}<span style="font-size:13px;font-weight:600;color:var(--muted)"> 天</span></div></div>
        </div>`;
    const analysisHTML = acc
      ? `<div class="advice">📡 <b>真實資料累積中：</b>已記錄 ${curEval.series.length} 天。買點百分位要等軌跡夠長（約 14 天）才有意義，先讓 <code>scan.js</code> 每天跑、慢慢累積。目前最新真實票價 ${E.money(s.current)}。</div>`
      : `<div class="gauge">
          <div class="glabel"><span>現價在 90 天的位置（越左越甜）</span><span><b>第 ${s.pct} 百分位</b></span></div>
          <div class="gauge-bar"><div class="mark" style="left:${s.pct}%"></div></div>
        </div>
        <div class="advice">💡 <b>買點建議：</b>${s.advice}</div>`;

    $('#detailModal').innerHTML = `
      <div class="modal-head">
        <div>
          <h3>${org.flag} ${esc(r.origin)} <span style="color:var(--terracotta)">→</span> ${dst.flag} ${esc(r.destination)}</h3>
          <div class="sub">${esc(org.city)} → ${esc(dst.city)} · ${air.name} · ${trip.label} · ${cabinOf(r).label}</div>
          <div class="sub">${formatDateLong(r.departDate)} 出發${r.tripType !== 'oneway' && r.returnDate ? ` · ${formatDateLong(r.returnDate)} 回程` : ''}（剩 ${s.daysToDep} 天）　${sourceLine}</div>
        </div>
        <button class="modal-close" id="detailClose">✕</button>
      </div>
      <div class="modal-body">
        <div class="big-price">
          <span class="n">${E.money(s.current)}</span>
          ${trendHTML}
          ${signalHTML}
        </div>
        ${realNote}

        <div class="chart-box">
          <div class="chart-tip" id="chartTip"></div>
          ${svg}
        </div>

        ${statGrid}

        ${analysisHTML}

        <div class="target-edit">
          <label>🎯 目標價</label>
          <input type="number" id="editTarget" value="${r.target || ''}" placeholder="未設定" min="0" step="500">
          <button class="btn ghost" id="saveTarget">儲存目標</button>
          <span style="flex:1"></span>
          <button class="btn ghost" id="delRoute" style="color:var(--red);border-color:#eccfc8">移除追蹤</button>
        </div>
      </div>`;

    $('#detailBg').classList.add('open');
    $('#detailClose').addEventListener('click', closeDetail);
    $('#saveTarget').addEventListener('click', () => {
      const v = parseInt($('#editTarget').value, 10);
      r.target = isNaN(v) || v <= 0 ? null : v;
      save(); render(); openDetail(id);
    });
    $('#delRoute').addEventListener('click', () => { closeDetail(); removeRoute(id); });
    wireChartHover();
  }
  function closeDetail() { $('#detailBg').classList.remove('open'); curEval = null; }

  // 大圖滑鼠懸停：十字線 + tooltip
  function wireChartHover() {
    const svg = $('#bigChart'); if (!svg || !curEval || curEval.series.length < 2) return;
    const hit = $('#bcHit'), cross = $('#bcCross'), dot = $('#bcDot'), tip = $('#chartTip');
    const box = svg.parentElement;
    const g = bigChartSVG(curEval.series, curEval.route.target, '#000').geo; // 只取幾何
    const series = curEval.series;
    const X = (i) => g.padL + (i * g.plotW) / (g.n - 1);
    const Y = (v) => g.padT + (1 - (v - g.min) / g.range) * g.plotH;

    function move(clientX) {
      const rect = svg.getBoundingClientRect();
      const vbx = ((clientX - rect.left) / rect.width) * g.W;
      let i = Math.round(((vbx - g.padL) / g.plotW) * (g.n - 1));
      i = Math.max(0, Math.min(g.n - 1, i));
      const p = series[i];
      const px = X(i), py = Y(p.price);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('opacity', '.6');
      dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.setAttribute('opacity', '1');
      const d = E.parseDate(p.date);
      tip.innerHTML = `${d.getMonth() + 1}/${d.getDate()}　<b>${E.money(p.price)}</b>${p.sale ? ' 🔥' : ''}`;
      tip.style.left = (svg.offsetLeft + (px / g.W) * svg.clientWidth) + 'px';
      tip.style.top = (svg.offsetTop + (py / g.H) * svg.clientHeight) + 'px';
      tip.style.opacity = '1';
    }
    function leave() { cross.setAttribute('opacity', '0'); dot.setAttribute('opacity', '0'); tip.style.opacity = '0'; }

    svg.addEventListener('mousemove', (ev) => move(ev.clientX));
    svg.addEventListener('mouseleave', leave);
    svg.addEventListener('touchmove', (ev) => { if (ev.touches[0]) move(ev.touches[0].clientX); }, { passive: true });
    void hit;
  }

  function removeRoute(id) {
    state.routes = state.routes.filter((r) => r.id !== id);
    syncUntrack(id); // 後端在跑就一併從 watchlist 移除
    save(); render();
  }

  /* =====================================================================
   * 新增航線
   * ===================================================================== */
  function buildSelects(prefill) {
    const homes = Object.entries(E.AIRPORTS).filter(([, a]) => a.region === 'home');
    const dests = Object.entries(E.AIRPORTS).filter(([, a]) => a.region !== 'home');

    $('#fOrigin').innerHTML = homes.map(([c, a]) => `<option value="${c}">${a.flag} ${a.city} (${c})</option>`).join('');

    // 目的地依「區域 → 國家」分組（國家當小標，城市縮排）
    const byRegion = {};
    REGION_ORDER.forEach((rg) => { byRegion[rg] = []; });
    dests.forEach(([c, a]) => { (byRegion[a.region] = byRegion[a.region] || []).push([c, a]); });
    $('#fDest').innerHTML = REGION_ORDER.filter((rg) => (byRegion[rg] || []).length).map((rg) => {
      const items = byRegion[rg];
      const byCountry = {};
      items.forEach(([c, a]) => { (byCountry[a.country] = byCountry[a.country] || []).push([c, a]); });
      const inner = Object.keys(byCountry).map((ct) =>
        byCountry[ct].map(([c, a]) => `<option value="${c}">${a.flag} ${ct}・${a.city} (${c})</option>`).join('')
      ).join('');
      return `<optgroup label="${E.REGION_LABEL[rg] || rg}">${inner}</optgroup>`;
    }).join('');
    $('#fDest').value = 'KIX';
    if (prefill && prefill.dest && E.AIRPORTS[prefill.dest]) $('#fDest').value = prefill.dest;

    $('#fCabin').innerHTML = Object.entries(E.CABINS).map(([c, a]) => `<option value="${c}">${a.label}</option>`).join('');

    const t = E.todayLocal();
    $('#fDate').min = E.fmtDate(E.addDays(t, 1));
    $('#fDate').value = E.fmtDate(E.addDays(t, 60));
    $('#fReturn').min = E.fmtDate(E.addDays(t, 61));
    $('#fReturn').value = E.fmtDate(E.addDays(t, 67));
    setTrip('roundtrip');
    updateAirlines();
    $('#fTarget').value = '';
  }

  // 航空公司下拉跟著目的地走（只列實際有飛的航空）
  function updateAirlines() {
    const dest = $('#fDest').value;
    $('#fAirline').innerHTML = E.airlinesFor(dest).map((c) => {
      const a = E.AIRLINES[c];
      return `<option value="${c}">${a.name}${a.type === 'lcc' ? '（廉航）' : ''}</option>`;
    }).join('');
  }
  function getFormTrip() { const b = $('#fTrip button.on'); return b ? b.dataset.trip : 'roundtrip'; }
  function setTrip(type) {
    $$('#fTrip button').forEach((b) => b.classList.toggle('on', b.dataset.trip === type));
    $('#fReturnField').style.display = type === 'oneway' ? 'none' : '';
  }
  function syncReturnMin() {
    const dep = $('#fDate').value; if (!dep) return;
    const rEl = $('#fReturn');
    rEl.min = E.fmtDate(E.addDays(E.parseDate(dep), 1));
    if (!rEl.value || rEl.value <= dep) rEl.value = E.fmtDate(E.addDays(E.parseDate(dep), 7));
  }

  function openAdd(prefill) { buildSelects(prefill); $('#addBg').classList.add('open'); }
  function closeAdd() { $('#addBg').classList.remove('open'); }

  async function confirmAdd() {
    const trip = getFormTrip();
    const r = {
      origin: $('#fOrigin').value,
      destination: $('#fDest').value,
      airline: $('#fAirline').value,
      tripType: trip,
      departDate: $('#fDate').value,
      returnDate: trip === 'oneway' ? null : $('#fReturn').value,
      cabin: $('#fCabin').value,
      target: parseInt($('#fTarget').value, 10) || null,
      addedAt: Date.now(),
    };
    if (r.origin === r.destination) { alert('出發地和目的地不能一樣 🙂'); return; }
    if (!r.departDate || E.parseDate(r.departDate) <= E.todayLocal()) { alert('出發日期要選未來的日期'); return; }
    if (trip !== 'oneway' && (!r.returnDate || E.parseDate(r.returnDate) <= E.parseDate(r.departDate))) {
      alert('回程日期要晚於出發日期'); return;
    }
    r.id = E.routeId(r);
    if (state.routes.some((x) => x.id === r.id)) { alert('這條航線（含航空/日期/艙等）已經在追蹤清單了'); closeAdd(); return; }
    state.routes.unshift(r);
    save(); closeAdd();
    // 有後端 → 標記「抓取中」，先用模擬即時回饋，再向後端抓真實價、回來翻新
    if (hasServer) fetchingRealId = r.id;
    render();
    openDetail(r.id);
    if (hasServer) {
      const synced = await syncTrack(r);
      fetchingRealId = null;
      if (synced) await loadReal();
      render();
      // 詳情還開著且就是這條 → 重開以套用真實資料
      if ($('#detailBg').classList.contains('open') && curEval && curEval.route.id === r.id) openDetail(r.id);
    }
  }

  /* =====================================================================
   * 啟動
   * ===================================================================== */
  // 開頁時把「還沒抓過真實價」的航線補抓一次（含使用者之前手動加、還沒同步到後端的）
  async function backfillReal() {
    if (!hasServer) return;
    const pending = state.routes.filter((r) => !REAL[r.id]); // REAL 有 key（real 或試過 none）就跳過
    if (!pending.length) return;
    for (const r of pending) await syncTrack(r);
    await loadReal();
    render();
  }

  async function init() {
    load();
    await pingServer();   // 偵測有沒有後端（serve.js）
    await loadWatchlist(); // 有後端 → 追蹤清單以伺服器為準
    await loadReal();     // 載真實資料（沒有就全模擬）
    render();
    backfillReal();       // 背景補抓未同步的航線（不擋畫面）

    $('#addBtn').addEventListener('click', () => openAdd());
    $('#addClose').addEventListener('click', closeAdd);
    $('#addCancel').addEventListener('click', closeAdd);
    $('#addConfirm').addEventListener('click', confirmAdd);

    // 表單連動（綁一次就好，避免重複疊加 listener）
    $('#fDest').addEventListener('change', updateAirlines);
    $('#fDate').addEventListener('change', syncReturnMin);
    $$('#fTrip button').forEach((b) => b.addEventListener('click', () => setTrip(b.dataset.trip)));

    $$('#sortSeg button').forEach((b) => b.addEventListener('click', () => {
      $$('#sortSeg button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      state.sort = b.dataset.sort;
      render();
    }));

    // 點背景關閉 modal
    $('#detailBg').addEventListener('click', (e) => { if (e.target.id === 'detailBg') closeDetail(); });
    $('#addBg').addEventListener('click', (e) => { if (e.target.id === 'addBg') closeAdd(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDetail(); closeAdd(); } });
  }

  function formatDateShort(s) { const d = E.parseDate(s); return `${d.getMonth() + 1}/${d.getDate()}`; }
  function tripDateStr(r) {
    const dep = formatDateShort(r.departDate);
    if (r.tripType === 'oneway') return `單程 ${dep}`;
    return `來回 ${dep}–${formatDateShort(r.returnDate)}`;
  }
  function formatDateLong(s) {
    const d = E.parseDate(s);
    const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${wd}）`;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
