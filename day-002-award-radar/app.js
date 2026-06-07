// 前端：讀 data.json（掃描結果）動態長出儀表板，並透過 API 新增 / 移除追蹤航線。
const $ = id => document.getElementById(id);
const fmtMD = d => d.slice(5).replace('-', '/');         // 2026-12-03 -> 12/03
const cabinName = c => (c === 'economy' ? '經濟艙' : '商務艙');

// ===== 儀表板渲染 =====
function barsHTML(days, threshold) {
  const ps = days.map(d => d.miles), mx = Math.max(...ps), mn = Math.min(...ps), rng = (mx - mn) || 1;
  const H = p => 18 + 82 * (p - mn) / rng;
  const thPos = Math.max(3, Math.min(99, H(threshold)));
  const bars = days.map(d =>
    `<div class="bar ${d.miles <= threshold ? 'hit' : ''}" title="${d.date}：${d.miles.toLocaleString()} 點"><i style="height:${H(d.miles)}%"></i></div>`
  ).join('');
  const axis = days.map(d =>
    `<span class="${d.miles <= threshold ? 'hit' : ''}">${Number(d.date.slice(8))}</span>`
  ).join('');
  return `<div class="bars"><div class="thline" style="bottom:${thPos}%"><span>門檻 ${threshold.toLocaleString()}</span></div>${bars}</div>`
       + `<div class="axis-days">${axis}</div>`;
}

function cabinHTML(cabin, c) {
  if (!c) return '';
  const isMock = c.source === 'mock';
  const pts = c.hit
    ? `${c.min.toLocaleString()} <small>點 · 最低在 ${c.minDates.map(fmtMD).join('、')}</small>`
    : `${c.min.toLocaleString()} <small>點 · 區間最低</small>`;
  let tag;
  if (isMock) {
    tag = `<span class="tag2 sim">⚠️ 模擬資料，示範用、不發通知</span>`;
  } else {
    tag = c.hit
      ? `<span class="tag hot">🎯 ${c.hitDays.map(fmtMD).join('、')} 達標！</span>` +
        (cabin === 'economy' ? `<button class="buy" onclick="goAlaska()">前往 Alaska</button>` : '')
      : `<span class="tag2">整段都在門檻之上，差 ${(c.min - c.threshold).toLocaleString()} 點</span>`;
  }
  const srcTag = isMock ? ' <span class="simtag">模擬</span>' : '';
  return `<div class="cab ${!isMock && c.hit ? 'hit' : ''} ${isMock ? 'ismock' : ''}">
    <div class="lbl"><span>${cabinName(cabin)}${srcTag}</span><span class="thresh" title="改門檻請編輯 watchlist.json">門檻 ≤ ${c.threshold.toLocaleString()}<span class="pen">✎</span></span></div>
    <div class="pts">${pts}</div>
    ${barsHTML(c.days, c.threshold)}
    ${tag}
  </div>`;
}

function cardHTML(r) {
  const anyHit = ['economy', 'business'].some(c => r.cabins[c]?.hit && r.cabins[c]?.source === 'real');
  const span = (r.cabins.economy?.days || r.cabins.business?.days || []).length;
  const cabs = ['economy', 'business'].map(c => cabinHTML(c, r.cabins[c])).join('');
  return `<div class="card ${anyHit ? 'hit' : ''}">
    <button class="untrack" onclick="removeRoute('${r.routeId}')" title="停止追蹤這條航線">停止追蹤</button>
    <div class="route"><span class="air">${r.from}</span><span class="arrow">→</span><span class="air">${r.to}</span>
      <span class="cn">${r.fromName} → ${r.toName}　·　${r.dateStart} ～ ${r.dateEnd}　·　${r.tripType === 'roundtrip' ? '來回' : '單程'}</span></div>
    <div class="meta">星宇 · 此刻掃描區間 ${span} 天</div>
    <div class="cabins">${cabs}</div>
  </div>`;
}

function renderStatus(data) {
  const total = data.results.length;
  const hits = data.results.reduce((n, r) => n + ['economy', 'business'].filter(c => r.cabins[c]?.hit && r.cabins[c]?.source === 'real').length, 0);
  const realCount = data.results.filter(r => ['economy', 'business'].some(c => r.cabins[c]?.source === 'real')).length;
  $('status').innerHTML =
    `<span>監控中 <b>${total}</b> 條航線</span>` +
    `<span>真實資料 <b>${realCount}</b> 條 · 其餘為模擬示範</span>` +
    `<span>上次掃描 <b>${data.scannedAt || '—'}</b></span>` +
    (hits ? `<span style="margin-left:auto;color:var(--clay-soft);font-weight:700">● ${hits} 筆真實達標</span>` : '');
}

async function load() {
  try {
    const data = await (await fetch('data.json?t=' + Date.now())).json();
    renderStatus(data);
    $('cards').innerHTML = data.results.map(cardHTML).join('') ||
      `<div class="card">追蹤清單是空的，點下方「＋新增追蹤航線」開始。</div>`;
  } catch (e) {
    $('status').innerHTML = '還沒有掃描資料';
    $('cards').innerHTML = `<div class="card">還沒有掃描結果。先在終端機跑一次 <code>node radar.js</code> 產生 data.json，再重新整理頁面。</div>`;
  }
}

function goAlaska() { window.open('https://www.alaskaair.com/', '_blank'); }

// ===== 簡易 toast =====
let toastTimer;
function toast(msg) {
  let el = $('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
}

// ===== 新增 / 移除航線（走 API）=====
const AIRPORTS = [
  ['TPE', '臺北桃園'], ['HND', '東京羽田'], ['NRT', '東京成田'], ['KIX', '大阪關西'], ['FUK', '福岡'],
  ['NGO', '名古屋中部'], ['CTS', '札幌新千歲'], ['OKA', '沖繩那霸'], ['SIN', '新加坡'], ['BKK', '曼谷'],
  ['KUL', '吉隆坡'], ['MNL', '馬尼拉'], ['DAD', '峴港'], ['SGN', '胡志明市'], ['HAN', '河內'],
  ['PEN', '檳城'], ['MFM', '澳門'], ['HKG', '香港'], ['PVG', '上海浦東'], ['LAX', '洛杉磯'],
  ['SFO', '舊金山'], ['SEA', '西雅圖'], ['ONT', '安大略'],
];
function ac(input, boxId) {
  const q = input.value.trim().toUpperCase(), box = $(boxId);
  const hits = AIRPORTS.filter(a => a[0].includes(q) || a[1].includes(input.value.trim())).slice(0, 6);
  box.innerHTML = hits.map(a => `<div onclick="pick('${input.id}','${boxId}','${a[0]}','${a[1]}')"><span><b class="code">${a[0]}</b> ${a[1]}</span></div>`).join('');
  box.classList.toggle('show', hits.length > 0);
}
function pick(inId, boxId, code, name) { $(inId).value = code + ' ' + name; $(boxId).classList.remove('show'); upd(); }
function swap() { const f = $('from'), t = $('to');[f.value, t.value] = [t.value, f.value]; upd(); }
function flex(btn, mode) {[...btn.parentNode.children].forEach(b => b.classList.remove('active')); btn.classList.add('active'); window._flex = mode; upd(); }
window._flex = '這段區間';

const codeOf = raw => (raw.trim().split(/\s+/)[0] || '').toUpperCase();
const nameOf = raw => raw.trim().split(/\s+/).slice(1).join(' ') || raw.trim();

function whenText() {
  const d1 = $('d1').value, d2 = $('d2').value;
  if (window._flex === '整個月') return d1 ? d1.slice(0, 7) : '指定月份';
  if (window._flex === '精確日期') return d1;
  return d1 + ' ～ ' + d2;
}
function upd() {
  const from = $('from').value || '起點', to = $('to').value || '終點';
  const parts = [];
  if ($('cE').checked) parts.push('經濟艙 ≤ ' + Number($('tE').value || 0).toLocaleString() + ' 點');
  if ($('cB').checked) parts.push('商務艙 ≤ ' + Number($('tB').value || 0).toLocaleString() + ' 點');
  $('confirm').innerHTML = '📡 我會幫你盯：<b>' + from + ' → ' + to + '</b>，' + whenText() + '，'
    + (parts.join('、') || '（請至少選一個艙等）') + '，發現就通知你。';
}
function openModal() { $('mask').classList.add('open'); }
function closeModal() { $('mask').classList.remove('open'); }
function resetModal() { $('from').value = ''; $('to').value = ''; }

async function startTrack() {
  const from = codeOf($('from').value), to = codeOf($('to').value);
  if (!from || !to) { alert('請先選出發地和目的地'); return; }
  if (!$('cE').checked && !$('cB').checked) { alert('請至少選一個艙等'); return; }
  const d1 = $('d1').value, d2 = window._flex === '精確日期' ? $('d1').value : $('d2').value;
  const route = {
    id: `${from.toLowerCase()}-${to.toLowerCase()}-${d1.replaceAll('-', '').slice(4)}`,
    from, to, fromName: nameOf($('from').value), toName: nameOf($('to').value),
    dateStart: d1, dateEnd: d2,
    flexibility: window._flex === '整個月' ? 'month' : window._flex === '精確日期' ? 'exact' : 'range',
    cabins: {
      economy: { track: $('cE').checked, threshold: Number($('tE').value || 0) },
      business: { track: $('cB').checked, threshold: Number($('tB').value || 0) },
    },
  };
  try {
    const res = await fetch('/api/watchlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(route),
    });
    const out = await res.json();
    if (!res.ok) { alert(out.error || '加入失敗'); return; }
    closeModal(); resetModal();
    await load();
    toast(`✅ 已加入追蹤並掃描：${route.from} → ${route.to}`);
  } catch (e) {
    alert('加入失敗——儀表板要透過伺服器開啟（npm run serve），不能直接雙擊 index.html。\n' + e.message);
  }
}

async function removeRoute(id) {
  if (!confirm('停止追蹤這條航線？')) return;
  try {
    const res = await fetch('/api/watchlist/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!res.ok) { const o = await res.json(); alert(o.error || '移除失敗'); return; }
    await load();
    toast('已停止追蹤');
  } catch (e) { alert('移除失敗：' + e.message); }
}

$('mask').addEventListener('click', e => { if (e.target.id === 'mask') closeModal(); });
upd();
load();
