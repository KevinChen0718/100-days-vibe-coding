/* =====================================================================
 * 票價軌跡 Fare Tracker — engine.js
 * ---------------------------------------------------------------------
 * 純運算核心：機場資料、票價歷史「模擬器」、買點分析。
 * 完全零依賴、零 DOM，可單獨在 Node 跑測試。
 *
 * ⚠️ 誠實聲明（沿用 Day 2 里程雷達的教訓）：
 *   這裡的票價是「可重現的模擬資料」，不是真實航空公司報價。
 *   假裝成真資料的看板比沒有看板更糟（會害人撲空）。
 *   所有產出都帶 source:'sim'，UI 會標「模擬」。
 *   要接真資料 → 換掉 getPriceHistory() 內部即可，其餘分析照用。
 * ===================================================================== */

(function (global) {
  'use strict';

  /* ---------- 機場資料庫（從台灣出發的熱門國際線）----------
   * base = 經濟艙來回參考票價（NT$），region 用於分群。
   * 數字是合理量級的「劇本基準」，非即時報價。            */
  const AIRPORTS = {
    TPE: { city: '台北 桃園', country: '台灣', flag: '🇹🇼', region: 'home' },
    KHH: { city: '高雄', country: '台灣', flag: '🇹🇼', region: 'home' },
    RMQ: { city: '台中', country: '台灣', flag: '🇹🇼', region: 'home' },

    // 東北亞
    NRT: { city: '東京 成田', country: '日本', flag: '🇯🇵', region: 'ne-asia', base: 9800 },
    HND: { city: '東京 羽田', country: '日本', flag: '🇯🇵', region: 'ne-asia', base: 11200 },
    KIX: { city: '大阪 關西', country: '日本', flag: '🇯🇵', region: 'ne-asia', base: 9500 },
    NGO: { city: '名古屋', country: '日本', flag: '🇯🇵', region: 'ne-asia', base: 9200 },
    FUK: { city: '福岡', country: '日本', flag: '🇯🇵', region: 'ne-asia', base: 8800 },
    CTS: { city: '札幌 新千歲', country: '日本', flag: '🇯🇵', region: 'ne-asia', base: 12500 },
    OKA: { city: '沖繩 那霸', country: '日本', flag: '🇯🇵', region: 'ne-asia', base: 7500 },
    ICN: { city: '首爾 仁川', country: '韓國', flag: '🇰🇷', region: 'ne-asia', base: 8500 },
    PUS: { city: '釜山', country: '韓國', flag: '🇰🇷', region: 'ne-asia', base: 8000 },
    HKG: { city: '香港', country: '香港', flag: '🇭🇰', region: 'ne-asia', base: 7000 },
    MFM: { city: '澳門', country: '澳門', flag: '🇲🇴', region: 'ne-asia', base: 6800 },

    // 東南亞
    BKK: { city: '曼谷 蘇凡納布', country: '泰國', flag: '🇹🇭', region: 'se-asia', base: 10500 },
    SIN: { city: '新加坡', country: '新加坡', flag: '🇸🇬', region: 'se-asia', base: 13500 },
    KUL: { city: '吉隆坡', country: '馬來西亞', flag: '🇲🇾', region: 'se-asia', base: 12000 },
    MNL: { city: '馬尼拉', country: '菲律賓', flag: '🇵🇭', region: 'se-asia', base: 9500 },
    SGN: { city: '胡志明市', country: '越南', flag: '🇻🇳', region: 'se-asia', base: 11000 },
    HAN: { city: '河內', country: '越南', flag: '🇻🇳', region: 'se-asia', base: 11500 },
    CGK: { city: '雅加達', country: '印尼', flag: '🇮🇩', region: 'se-asia', base: 14000 },
    DPS: { city: '峇里島 登巴薩', country: '印尼', flag: '🇮🇩', region: 'se-asia', base: 13000 },

    // 大洋洲
    SYD: { city: '雪梨', country: '澳洲', flag: '🇦🇺', region: 'oceania', base: 28000 },
    MEL: { city: '墨爾本', country: '澳洲', flag: '🇦🇺', region: 'oceania', base: 27000 },
    AKL: { city: '奧克蘭', country: '紐西蘭', flag: '🇳🇿', region: 'oceania', base: 30000 },

    // 北美
    LAX: { city: '洛杉磯', country: '美國', flag: '🇺🇸', region: 'n-america', base: 32000 },
    SFO: { city: '舊金山', country: '美國', flag: '🇺🇸', region: 'n-america', base: 33000 },
    SEA: { city: '西雅圖', country: '美國', flag: '🇺🇸', region: 'n-america', base: 34000 },
    JFK: { city: '紐約 甘迺迪', country: '美國', flag: '🇺🇸', region: 'n-america', base: 38000 },
    YVR: { city: '溫哥華', country: '加拿大', flag: '🇨🇦', region: 'n-america', base: 33000 },
    HNL: { city: '檀香山', country: '美國', flag: '🇺🇸', region: 'n-america', base: 22000 },

    // 歐洲 / 中東
    LHR: { city: '倫敦 希斯洛', country: '英國', flag: '🇬🇧', region: 'europe', base: 36000 },
    CDG: { city: '巴黎 戴高樂', country: '法國', flag: '🇫🇷', region: 'europe', base: 37000 },
    FRA: { city: '法蘭克福', country: '德國', flag: '🇩🇪', region: 'europe', base: 36500 },
    AMS: { city: '阿姆斯特丹', country: '荷蘭', flag: '🇳🇱', region: 'europe', base: 37000 },
    IST: { city: '伊斯坦堡', country: '土耳其', flag: '🇹🇷', region: 'europe', base: 30000 },
    DXB: { city: '杜拜', country: '阿聯', flag: '🇦🇪', region: 'mideast', base: 26000 },
  };

  const REGION_LABEL = {
    'ne-asia': '東北亞', 'se-asia': '東南亞', 'oceania': '大洋洲',
    'n-america': '北美', 'europe': '歐洲', 'mideast': '中東',
  };

  const CABINS = {
    economy:  { label: '經濟艙',   mult: 1.0 },
    premium:  { label: '豪華經濟', mult: 1.7 },
    business: { label: '商務艙',   mult: 3.4 },
    first:    { label: '頭等艙',   mult: 5.6 },
  };

  const TRIP_TYPES = {
    roundtrip: { label: '來回', mult: 1.0 },
    oneway:    { label: '單程', mult: 0.58 }, // 單程通常略高於來回的一半
  };

  /* ---------- 航空公司（type：full 全服務 / lcc 廉航；mult＝品牌票價水位）---------- */
  const AIRLINES = {
    ANY: { name: '不限航空', short: '不限', type: 'any',  mult: 1.0 },
    CI:  { name: '中華航空', short: '華航', type: 'full', mult: 1.05 },
    BR:  { name: '長榮航空', short: '長榮', type: 'full', mult: 1.06 },
    JX:  { name: '星宇航空', short: '星宇', type: 'full', mult: 1.07 },
    IT:  { name: '台灣虎航', short: '虎航', type: 'lcc',  mult: 0.78 },
    JL:  { name: '日本航空', short: 'JAL',  type: 'full', mult: 1.10 },
    NH:  { name: '全日空',   short: 'ANA',  type: 'full', mult: 1.12 },
    MM:  { name: '樂桃航空', short: '樂桃', type: 'lcc',  mult: 0.72 },
    KE:  { name: '大韓航空', short: '大韓', type: 'full', mult: 1.05 },
    OZ:  { name: '韓亞航空', short: '韓亞', type: 'full', mult: 1.03 },
    CX:  { name: '國泰航空', short: '國泰', type: 'full', mult: 1.05 },
    TG:  { name: '泰國航空', short: '泰航', type: 'full', mult: 1.00 },
    SQ:  { name: '新加坡航空', short: '新航', type: 'full', mult: 1.15 },
    TR:  { name: '酷航',     short: '酷航', type: 'lcc',  mult: 0.74 },
    VN:  { name: '越南航空', short: '越航', type: 'full', mult: 0.98 },
    VJ:  { name: '越捷航空', short: '越捷', type: 'lcc',  mult: 0.70 },
    PR:  { name: '菲律賓航空', short: '菲航', type: 'full', mult: 0.95 },
    GA:  { name: '印尼鷹航', short: '鷹航', type: 'full', mult: 1.00 },
    UA:  { name: '聯合航空', short: '聯合', type: 'full', mult: 1.04 },
    AA:  { name: '美國航空', short: '美航', type: 'full', mult: 1.03 },
    DL:  { name: '達美航空', short: '達美', type: 'full', mult: 1.05 },
    QF:  { name: '澳洲航空', short: '澳航', type: 'full', mult: 1.10 },
    NZ:  { name: '紐西蘭航空', short: '紐航', type: 'full', mult: 1.08 },
    EK:  { name: '阿聯酋航空', short: '阿聯酋', type: 'full', mult: 1.08 },
    TK:  { name: '土耳其航空', short: '土航', type: 'full', mult: 1.00 },
    LH:  { name: '漢莎航空', short: '漢莎', type: 'full', mult: 1.10 },
    AF:  { name: '法國航空', short: '法航', type: 'full', mult: 1.08 },
    KL:  { name: '荷蘭皇家航空', short: 'KLM', type: 'full', mult: 1.07 },
    BA:  { name: '英國航空', short: '英航', type: 'full', mult: 1.10 },
    // 以下廉航主要用於顯示「不限航空」實際抓到的最便宜航司名稱
    VZ:  { name: '泰國越捷', short: '泰越捷', type: 'lcc', mult: 0.68 },
    LJ:  { name: '真航空', short: '真航空', type: 'lcc', mult: 0.74 },
    '5J': { name: '宿霧太平洋', short: '宿霧', type: 'lcc', mult: 0.68 },
    AK:  { name: '亞洲航空', short: '亞航', type: 'lcc', mult: 0.66 },
    TW:  { name: '德威航空', short: '德威', type: 'lcc', mult: 0.74 },
    BX:  { name: '釜山航空', short: '釜山航', type: 'lcc', mult: 0.80 },
  };

  // 各目的地從台灣有哪些航空公司直飛（決定下拉選單；華航/長榮幾乎飛遍各線）
  const ROUTE_AIRLINES = {
    NRT: ['CI', 'BR', 'JX', 'IT', 'JL', 'NH', 'MM'],
    HND: ['CI', 'BR', 'JX', 'JL', 'NH'],
    KIX: ['CI', 'BR', 'JX', 'IT', 'JL', 'MM'],
    NGO: ['CI', 'BR', 'JX', 'IT', 'NH'],
    FUK: ['CI', 'BR', 'JX', 'IT'],
    CTS: ['CI', 'BR', 'IT'],
    OKA: ['CI', 'BR', 'IT', 'MM'],
    ICN: ['CI', 'BR', 'KE', 'OZ', 'IT'],
    PUS: ['CI', 'BR', 'KE', 'IT'],
    HKG: ['CI', 'BR', 'CX'],
    MFM: ['CI', 'BR', 'JX'],
    BKK: ['CI', 'BR', 'JX', 'TG'],
    SIN: ['CI', 'BR', 'JX', 'SQ', 'TR'],
    KUL: ['CI', 'BR', 'JX'],
    MNL: ['CI', 'BR', 'PR'],
    SGN: ['CI', 'BR', 'JX', 'VN', 'VJ'],
    HAN: ['CI', 'BR', 'VN', 'VJ'],
    CGK: ['CI', 'BR', 'GA'],
    DPS: ['CI', 'BR', 'GA'],
    SYD: ['CI', 'BR', 'QF'],
    MEL: ['CI', 'BR', 'QF'],
    AKL: ['CI', 'BR', 'NZ'],
    LAX: ['CI', 'BR', 'JX', 'UA', 'AA', 'DL'],
    SFO: ['CI', 'BR', 'JX', 'UA', 'DL'],
    SEA: ['CI', 'BR', 'JX', 'DL'],
    JFK: ['CI', 'BR', 'UA'],
    YVR: ['CI', 'BR'],
    HNL: ['CI', 'BR'],
    LHR: ['CI', 'BR', 'BA'],
    CDG: ['CI', 'BR', 'AF'],
    FRA: ['CI', 'BR', 'LH'],
    AMS: ['CI', 'BR', 'KL'],
    IST: ['CI', 'TK'],
    DXB: ['BR', 'EK'],
  };
  function airlinesFor(dest) {
    return ['ANY'].concat(ROUTE_AIRLINES[dest] || ['CI', 'BR']);
  }
  // 「不限航空」的票價水位＝該航線最便宜的航空（有廉航就壓低）
  function anyMult(dest) {
    const list = ROUTE_AIRLINES[dest] || ['CI', 'BR'];
    return Math.min.apply(null, list.map((c) => (AIRLINES[c] ? AIRLINES[c].mult : 1.0)));
  }

  /* ---------- 可重現亂數（同一條航線每次重整畫面都一樣）---------- */
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 本地日期工具（不用 toISOString，避免 UTC 倒退一天）---------- */
  function fmtDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function parseDate(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function todayLocal() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }
  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }
  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }

  /* ---------- 票價行為模型 ----------------------------------------- */

  // 出發日季節係數：暑假 / 過年 / 年末旺季貴，淡季便宜
  function seasonFactor(departDate) {
    const m = departDate.getMonth() + 1;
    if (m === 7 || m === 8) return 1.28;        // 暑假
    if (m === 1 || m === 2) return 1.22;        // 過年 / 寒假
    if (m === 12) return 1.18;                  // 年末
    if (m === 4 || m === 9 || m === 11) return 0.92; // 旅遊淡季
    return 1.0;
  }

  // 提前購買曲線：太早平平、約 7~9 週前最甜、出發前急漲
  function advancePurchaseFactor(daysToDep) {
    if (daysToDep > 150) return 1.06;
    if (daysToDep > 90)  return 1.0;
    if (daysToDep > 55)  return 0.9;   // 甜蜜點
    if (daysToDep > 35)  return 0.98;
    if (daysToDep > 21)  return 1.12;
    if (daysToDep > 10)  return 1.34;
    if (daysToDep > 3)   return 1.62;
    return 1.95;                       // 最後關頭
  }

  /**
   * 產生一條航線過去 90 天「每日最低票價」的觀測序列。
   * 追的是「同一趟未來行程」隨時間逼近出發日的價格變化。
   * @returns {Array<{date:string, price:number, sale:boolean, daysToDep:number}>}
   */
  function getPriceHistory(route, opts) {
    opts = opts || {};
    const N = opts.days || 90;
    const dest = AIRPORTS[route.destination];
    const cabin = CABINS[route.cabin] || CABINS.economy;
    if (!dest || !dest.base) return [];

    const depart = parseDate(route.departDate);
    const today = opts.today ? parseDate(opts.today) : todayLocal();

    // 航空公司票價水位（不限＝該線最便宜航空）
    const airCode = route.airline || 'ANY';
    const airMult = airCode === 'ANY' ? anyMult(route.destination)
      : (AIRLINES[airCode] ? AIRLINES[airCode].mult : 1.0);

    // 行程類型：來回 1.0、單程約 0.58
    const trip = TRIP_TYPES[route.tripType] || TRIP_TYPES.roundtrip;

    const base = dest.base * cabin.mult * airMult * trip.mult;

    // 季節：來回取去/回兩段平均，單程只看去程
    let season = seasonFactor(depart);
    if (route.tripType !== 'oneway' && route.returnDate) {
      season = (season + seasonFactor(parseDate(route.returnDate))) / 2;
    }

    const seed = hashStr(`${route.origin}-${route.destination}-${airCode}-${route.tripType || 'roundtrip'}-${route.departDate}-${route.returnDate || 'ow'}-${route.cabin}`);
    const rng = mulberry32(seed);

    const series = [];
    let walk = 0;
    for (let i = 0; i < N; i++) {
      const date = addDays(today, -(N - 1 - i));
      const daysToDep = daysBetween(date, depart);
      const ap = advancePurchaseFactor(daysToDep);

      // 有機隨機漫步，讓線條像真的有起伏（非純雜訊）
      walk += (rng() - 0.5) * 0.045;
      walk = Math.max(-0.13, Math.min(0.13, walk));

      // 偶發限時促銷（驟降）
      const sale = rng() < 0.06 ? -(0.08 + rng() * 0.12) : 0;

      // 週期性小波動（航司常週中放票）
      const weekly = Math.sin((i / 7) * 2 * Math.PI) * 0.018;

      let price = base * season * ap * (1 + walk + sale + weekly);
      price = Math.max(base * 0.55, price);        // 地板
      price = Math.round(price / 50) * 50;          // 取整到 50 元

      series.push({ date: fmtDate(date), price, sale: sale < 0, daysToDep });
    }
    return series;
  }

  /* ---------- 分析：把序列變成「現在該不該買」的判斷 ---------- */

  function percentileOf(sortedArr, v) {
    let lo = 0;
    for (let i = 0; i < sortedArr.length; i++) { if (sortedArr[i] < v) lo++; }
    return Math.round((lo / sortedArr.length) * 100);
  }

  function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

  function analyze(series, route) {
    if (!series.length) return null;
    const prices = series.map((p) => p.price);
    const sorted = prices.slice().sort((a, b) => a - b);
    const current = prices[prices.length - 1];

    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = Math.round(mean(prices));
    const median = sorted[Math.floor(sorted.length / 2)];
    const pct = percentileOf(sorted, current); // 0=史上最低、100=史上最高

    // 近 7 天 vs 前 7 天趨勢
    const last7 = prices.slice(-7);
    const prev7 = prices.slice(-14, -7);
    const trendPct = prev7.length
      ? Math.round(((mean(last7) - mean(prev7)) / mean(prev7)) * 100)
      : 0;
    const trend = trendPct > 1 ? 'up' : trendPct < -1 ? 'down' : 'flat';

    const daysToDep = series[series.length - 1].daysToDep;

    // 買點訊號
    let signal, signalLabel, advice;
    if (pct <= 25) {
      signal = 'great';
      signalLabel = '好價，建議入手';
    } else if (pct <= 50) {
      signal = 'good';
      signalLabel = '尚可，可考慮';
    } else if (pct <= 75) {
      signal = 'fair';
      signalLabel = '中等偏貴，再觀望';
    } else {
      signal = 'high';
      signalLabel = '偏貴，建議再等';
    }

    // 文字建議：百分位 + 距出發天數 + 趨勢一起講
    const pctTxt =
      pct <= 25 ? `目前價落在過去 90 天最低的 ${pct}% 區間，是相對甜蜜的價位` :
      pct <= 50 ? `目前價約位於過去 90 天的第 ${pct} 百分位，比平均略低一點` :
      pct <= 75 ? `目前價落在過去 90 天的第 ${pct} 百分位，偏中上` :
                  `目前價落在過去 90 天最高的前 ${100 - pct}%，相對偏貴`;
    let timeTxt;
    if (daysToDep <= 14) {
      timeTxt = `距出發只剩 ${daysToDep} 天，這段時間票價通常只漲不跌，若行程確定建議盡快下手`;
    } else if (daysToDep <= 35) {
      timeTxt = `距出發 ${daysToDep} 天，已進入價格容易往上走的階段，看到好價別猶豫太久`;
    } else if (daysToDep <= 90) {
      timeTxt = `距出發 ${daysToDep} 天，正處於常見的「提前購票甜蜜區」，適合盯緊低點`;
    } else {
      timeTxt = `距出發還有 ${daysToDep} 天，時間充裕，可以慢慢等促銷`;
    }
    const trendTxt =
      trend === 'down' ? `近一週均價下滑約 ${Math.abs(trendPct)}%，趨勢偏軟。` :
      trend === 'up'   ? `近一週均價上揚約 ${trendPct}%，趨勢轉強。` :
                         `近一週價格大致持平。`;
    advice = `${pctTxt}。${trendTxt}${timeTxt}。`;

    const hitTarget = route && route.target ? current <= route.target : false;
    const vsAvgPct = Math.round(((current - avg) / avg) * 100);

    return {
      current, min, max, avg, median, pct,
      trend, trendPct, daysToDep,
      signal, signalLabel, advice,
      hitTarget, vsAvgPct,
      saleDays: series.filter((p) => p.sale).length,
    };
  }

  /* ---------- 對外 API ---------- */
  const Engine = {
    AIRPORTS, REGION_LABEL, CABINS, TRIP_TYPES, AIRLINES, airlinesFor,
    getPriceHistory, analyze,
    fmtDate, parseDate, todayLocal, addDays, daysBetween,
    routeId(r) {
      return `${r.origin}-${r.destination}-${r.airline || 'ANY'}-${r.tripType || 'roundtrip'}-${r.departDate}-${r.returnDate || 'ow'}-${r.cabin}`;
    },
    // 給 UI 用的：把純數字變成 NT$ 字串
    money(n) { return 'NT$' + Math.round(n).toLocaleString('en-US'); },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  global.FareEngine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
