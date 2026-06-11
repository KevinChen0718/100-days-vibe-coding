'use strict';
// 畫面渲染 + 音效 — 所有角色與場景皆 Canvas 向量手繪,零圖片素材
// 場景:黃昏競技場(原創繪製)。三層視差:天空(不動)/ 觀眾席(0.35x)/ 場地(1x)

let skyCache = null, midCache = null, groundCache = null;
const MID_W = Math.ceil(W + (STAGE_W - W) * 0.35) + 60;

function buildStage() {
  // --- 天空層:黃昏 + 體育場燈塔 ---
  skyCache = document.createElement('canvas');
  skyCache.width = W; skyCache.height = 310;
  let g = skyCache.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 310);
  sky.addColorStop(0, '#241a3e'); sky.addColorStop(0.6, '#8a4a3e'); sky.addColorStop(1, '#d8924c');
  g.fillStyle = sky; g.fillRect(0, 0, W, 310);
  // 燈塔(壓在看台屋頂上方,避免穿過 HUD)
  for (const lx of [150, 810]) {
    const gl = g.createRadialGradient(lx, 136, 4, lx, 136, 55);
    gl.addColorStop(0, 'rgba(255,240,200,.8)'); gl.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(lx, 136, 55, 0, 7); g.fill();
    g.fillStyle = '#1c1626';
    g.fillRect(lx - 22, 128, 44, 12);
    g.fillRect(lx - 3, 140, 6, 12);
    for (let i = 0; i < 3; i++) { g.fillStyle = '#ffeeb8'; g.fillRect(lx - 18 + i * 13, 130.5, 9, 7); }
  }
  // 月亮
  g.fillStyle = 'rgba(255,244,214,.9)';
  g.beginPath(); g.arc(700, 70, 26, 0, 7); g.fill();
  g.fillStyle = 'rgba(36,26,62,.35)';
  g.beginPath(); g.arc(710, 62, 22, 0, 7); g.fill();

  // --- 觀眾席層(慢速視差) ---
  midCache = document.createElement('canvas');
  midCache.width = MID_W; midCache.height = 310;
  g = midCache.getContext('2d');
  // 看台屋頂
  g.fillStyle = '#332840';
  g.fillRect(0, 150, MID_W, 24);
  // 三排階梯看台 + 觀眾(固定亂數的彩色小點)
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const crowdCols = ['#d8a06a', '#b86a5a', '#7a9a6a', '#6a7ab8', '#c8c87a', '#9a6ab8', '#5aa7a0'];
  for (let row = 0; row < 3; row++) {
    const y0 = 174 + row * 42;
    g.fillStyle = row % 2 ? '#473a58' : '#3e3450';
    g.fillRect(0, y0, MID_W, 42);
    for (let x = 8; x < MID_W; x += 13) {
      if (rnd() < 0.82) {
        g.fillStyle = crowdCols[Math.floor(rnd() * crowdCols.length)];
        g.beginPath(); g.arc(x + rnd() * 5, y0 + 18 + rnd() * 14, 4.6, 0, 7); g.fill();
      }
    }
  }
  // 圍欄 + 標語布條(原創文字)
  g.fillStyle = '#5a4a30';
  g.fillRect(0, 296, MID_W, 14);
  g.fillStyle = '#c8b890';
  g.fillRect(0, 292, MID_W, 5);
  const banners = ['加油!', 'FIGHT!', '齊打交', 'GO GO', '快撿武器'];
  g.font = 'bold 13px system-ui, "PingFang TC", sans-serif';
  for (let i = 0; i < 8; i++) {
    const bx = 40 + i * (MID_W / 8);
    g.fillStyle = ['#b84a3a', '#3a6ab8', '#3a8a5a'][i % 3];
    g.fillRect(bx, 258, 92, 26);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.fillText(banners[i % banners.length], bx + 46, 276);
  }

  // --- 場地層(競技場地板,跟攝影機 1:1) ---
  groundCache = document.createElement('canvas');
  groundCache.width = STAGE_W; groundCache.height = H - 300;
  g = groundCache.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H - 300);
  gr.addColorStop(0, '#b89464'); gr.addColorStop(1, '#8a6a44');
  g.fillStyle = gr; g.fillRect(0, 0, STAGE_W, H - 300);
  // 場地白線(大圈 + 中線,畫在地板上要壓扁)
  g.strokeStyle = 'rgba(255,255,250,.5)'; g.lineWidth = 5;
  g.save();
  g.translate(STAGE_W / 2, 110); g.scale(1, 0.34);
  g.beginPath(); g.arc(0, 0, 330, 0, 7); g.stroke();
  g.beginPath(); g.arc(0, 0, 36, 0, 7); g.stroke();
  g.restore();
  g.beginPath(); g.moveTo(STAGE_W / 2, 12); g.lineTo(STAGE_W / 2, H - 302); g.stroke();
  // 邊界線
  g.strokeStyle = 'rgba(255,255,250,.35)'; g.lineWidth = 4;
  g.strokeRect(30, 8, STAGE_W - 60, H - 316);
  // 沙地噪點與磨痕
  seed = 23;
  for (let i = 0; i < 240; i++) {
    const x = rnd() * STAGE_W, y = rnd() * (H - 300);
    g.fillStyle = `rgba(60,40,20,${0.04 + rnd() * 0.08})`;
    g.beginPath(); g.arc(x, y, 1 + rnd() * 2.5, 0, 7); g.fill();
  }
  for (let i = 0; i < 26; i++) {
    const x = rnd() * STAGE_W, y = 20 + rnd() * (H - 330);
    g.strokeStyle = `rgba(70,50,30,${0.1 + rnd() * 0.12})`;
    g.lineWidth = 2 + rnd() * 3;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + 20 + rnd() * 30, y + (rnd() - 0.5) * 14, x + 50 + rnd() * 40, y + (rnd() - 0.5) * 20);
    g.stroke();
  }
}

/* ============ 角色繪製 ============ */
function poseOf(f, frame) {
  const t = f.stateTimer;
  const p = { legF: 0.16, legB: -0.16, armF: 0.45, armB: -0.3, lean: 0,
              crouch: 0, armFLen: 18, armBLen: 18, rot: 0, bob: 0, kick: 0, alpha: 1, jitter: 0 };
  switch (f.state) {
    case 'idle': // 格鬥架式:雙拳抬起、腳步張開,跟著呼吸微晃
      p.bob = Math.sin(frame * 0.09 + f.pid * 2) * 1.8;
      p.armF = 1.0 + Math.sin(frame * 0.09 + f.pid * 2) * 0.06; p.armFLen = 13;
      p.armB = 0.78; p.armBLen = 11;
      p.legF = 0.3; p.legB = -0.3; p.lean = 0.05;
      break;
    case 'walk': { const s = Math.sin(t * 0.28);
      p.legF = s * 0.55; p.legB = -s * 0.55; p.armF = 0.4 - s * 0.5; p.armB = -0.2 + s * 0.5; break; }
    case 'run': { const s = Math.sin(t * 0.38);
      p.legF = s * 0.9; p.legB = -s * 0.9; p.armF = 0.5 - s * 0.8; p.armB = -0.3 + s * 0.8; p.lean = 0.22; break; }
    case 'jump': p.legF = 0.65; p.legB = -0.45; p.armF = 2.4; p.armB = -0.6; break;
    case 'attack1': { const k = atkProg(t, 5, 10);
      p.armF = 1.45; p.armFLen = 16 + k * 12; p.lean = 0.12 * k; p.armB = -0.5; break; }
    case 'attack2': { const k = atkProg(t, 5, 10);
      p.armB = 1.45; p.armBLen = 16 + k * 12; p.lean = 0.12 * k; p.armF = -0.4; break; }
    case 'attack3': { const k = atkProg(t, 8, 14);
      p.kick = k; p.legF = 1.5 * k; p.lean = -0.18 * k; p.armF = 0.9; p.armB = -0.7; break; }
    case 'runattack': { const k = atkProg(t, 5, 14);
      p.armF = 1.5; p.armFLen = 16 + k * 13; p.lean = 0.3; p.legF = 0.5; p.legB = -0.7; break; }
    case 'jumpattack': case 'leapatk':
      p.kick = 1; p.legF = 1.45; p.legB = -0.5; p.lean = 0.22; p.armF = 1.0; p.armB = -0.8; break;
    case 'risekick':
      if (f.mv && f.mv.backflip) { p.rot = -t * 0.45; p.kick = 1; p.legF = 1.3; p.armF = 1.6; p.armB = -1.2; }
      else { p.armF = 3.0; p.armFLen = 26; p.lean = -0.12; p.legF = 0.7; p.legB = -0.5; }
      break;
    case 'dashatk': { const s = Math.sin(t * 0.9);
      p.kick = 1; p.legF = 1.35 + s * 0.2; p.legB = -0.35; p.lean = 0.3; p.armF = 1.6; p.armB = -1.1; break; }
    case 'turnkick': p.kick = 1; p.legF = 1.5; p.lean = 0.1 + Math.sin(t * 0.8) * 0.1; p.armF = 1.6; p.armB = -1.4; break;
    case 'teleport': p.alpha = t < 8 ? 1 - t / 9 : (t - 8) / 6; p.armF = 1.2; p.armB = 1.0; break;
    case 'explode': { const k = Math.min(1, t / 12);
      p.armF = 2.0 * k; p.armB = -2.0 * k; p.lean = -0.1; p.legF = 0.5; p.legB = -0.5; break; }
    case 'cast': { const k = Math.min(1, t / 10);
      p.armF = 1.5 * k; p.armB = 1.4 * k; p.armFLen = 24; p.armBLen = 24; p.lean = 0.1; break; }
    case 'weaponatk': {
      const sw = f.weapon ? WEAPONS[f.weapon.kind].swing : { a0: 7, a1: 14 };
      const k = atkProg(t, sw.a0, sw.a1);
      p.armF = -0.7 + k * 2.5; p.armFLen = 20; p.lean = 0.1 + k * 0.12; p.armB = -0.6; break; }
    case 'throwitem': p.armF = t < 7 ? -0.6 : 1.75; p.armFLen = t < 7 ? 16 : 23; p.lean = t < 7 ? -0.1 : 0.2; break;
    case 'drink': p.armF = 2.45; p.armFLen = 12; p.lean = -0.06; p.bob = Math.sin(t * 0.3) * 0.8; break;
    case 'defend': p.armF = 1.15; p.armB = 0.95; p.armFLen = 13; p.armBLen = 13; p.crouch = 4; p.lean = 0.06; break;
    case 'hurt': p.lean = -0.3; p.armF = 2.0; p.armB = -1.2; p.legF = 0.4; break;
    case 'fall': p.rot = -Math.min(1.35, t * 0.09); p.armF = 2.2; p.armB = -1.6; p.legF = 0.8; p.legB = -0.4; break;
    case 'flip': p.rot = t * 0.6; p.legF = 0.9; p.legB = -0.7; p.armF = 1.4; p.armB = -1.4; break;
    case 'lying': p.rot = -1.45; p.armF = 0.4; p.armB = -0.3; p.legF = 0.25; p.legB = -0.1; break;
    case 'stunned': p.lean = Math.sin(t * 0.16) * 0.2; p.armF = 0.25; p.armB = -0.2;
      p.bob = Math.sin(t * 0.3) * 1.2; break;
    case 'catching': p.armF = 1.3; p.armFLen = 20; p.armB = -0.6; p.lean = 0.08; break;
    case 'caught': p.armF = 2.3; p.armB = -2.0; p.legF = 0.5; p.legB = -0.3;
      p.jitter = Math.sin(t * 0.7) * 1.5; p.lean = -0.12; break;
    case 'frozen': p.armF = 0.6; p.armB = -0.4; break;
    case 'win': p.armF = 2.9; p.bob = -Math.abs(Math.sin(t * 0.18)) * 7; p.armB = -0.5; break;
  }
  return p;
}
function atkProg(t, a0, a1) { return Math.max(0, Math.min(1, (t - a0 + 3) / (a1 - a0 + 2))); }

// 90 年代格鬥 sprite 風:擬真比例 + 黑邊描線,先畫進半解析度離屏再 2 倍放大
// (關閉平滑)→ 像素顆粒感。畫的內容仍是原創角色,只是風格語彙向那個年代靠。
const PIX = typeof document !== 'undefined' ? document.createElement('canvas') : null;
if (PIX) { PIX.width = 112; PIX.height = 104; }

function drawFighter(g, f, frame, scale = 1) {
  const c = f.c;
  const p = poseOf(f, frame);
  const flash = f.hitFlash > 0;
  const col = (x) => flash ? '#ffffff' : x;

  // --- 半解析度離屏:0.5 倍畫骨架 ---
  const px = PIX.getContext('2d');
  px.clearRect(0, 0, 112, 104);
  px.save();
  px.translate(56, 96);
  px.scale(f.facing * 0.5, 0.5);
  if (p.rot) { px.translate(0, f.state === 'lying' ? -10 : -32); px.rotate(p.rot); px.translate(0, f.state === 'lying' ? 10 : 32); }
  px.translate(p.jitter, p.bob + p.crouch);
  px.rotate(p.lean * 0.5);
  drawBody(px, f, c, p, frame, col);
  px.restore();

  // --- 放大 2 倍貼回世界(不平滑 → 顆粒) ---
  g.save();
  g.translate(f.x, f.z - f.y);
  let alpha = p.alpha;
  if (f.invuln > 0 && Math.floor(frame / 4) % 2 === 0) alpha *= 0.45;
  g.globalAlpha = Math.max(0.05, alpha);
  if (f.state === 'explode') { // 自爆蓄力紅光(不像素化)
    const k = Math.min(1, f.stateTimer / 12);
    g.fillStyle = `rgba(255,90,30,${0.25 * k})`;
    g.beginPath(); g.arc(0, -42 * scale, (52 + k * 32) * scale, 0, 7); g.fill();
  }
  const sm = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  g.drawImage(PIX, 0, 0, 112, 104, -112 * scale, -192 * scale, 224 * scale, 208 * scale);
  g.imageSmoothingEnabled = sm;

  if (f.state === 'frozen') {
    g.globalAlpha = 0.55 * alpha; g.fillStyle = '#a8d8f8';
    rr(g, -24 * scale, -94 * scale, 48 * scale, 98 * scale, 9); g.fill();
    g.globalAlpha = 0.9 * alpha; g.strokeStyle = '#e8f6ff'; g.lineWidth = 2;
    rr(g, -24 * scale, -94 * scale, 48 * scale, 98 * scale, 9); g.stroke();
    g.beginPath(); g.moveTo(-11 * scale, -82 * scale); g.lineTo(-2 * scale, -58 * scale); g.lineTo(-9 * scale, -34 * scale); g.stroke();
  }
  g.restore();
}

// 角色本體(全尺寸座標,腳底 = 0,身高約 88px)
function drawBody(g, f, c, p, frame, col) {
  const O = '#181210'; // 描邊色
  g.lineCap = 'round'; g.lineJoin = 'round';
  // 帶手肘/膝蓋弧度與黑描邊的肢體
  const limb = (x0, y0, ang, len, w, color, bend = 0.3) => {
    const x1 = x0 + Math.sin(ang) * len, y1 = y0 + Math.cos(ang) * len;
    const mx = (x0 + x1) / 2 + Math.cos(ang) * bend * len * 0.5;
    const my = (y0 + y1) / 2 - Math.sin(ang) * bend * len * 0.5;
    g.strokeStyle = O; g.lineWidth = w + 3.5;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
    g.strokeStyle = col(color); g.lineWidth = w;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
    return [x1, y1];
  };
  const fist = (e, r) => {
    g.fillStyle = O; g.beginPath(); g.arc(e[0], e[1], r + 1.6, 0, 7); g.fill();
    g.fillStyle = col(c.skin); g.beginPath(); g.arc(e[0], e[1], r, 0, 7); g.fill();
  };
  const shoe = (e) => {
    g.fillStyle = O; g.beginPath(); g.ellipse(e[0] + 2.5, e[1], 8.2, 5.4, 0, 0, 7); g.fill();
    g.fillStyle = col(c.shoes); g.beginPath(); g.ellipse(e[0] + 2.5, e[1], 6.8, 4.2, 0, 0, 7); g.fill();
  };
  // 手臂打直(出拳/施法)時手肘弧度變小
  const armLenF = p.armFLen + 9, armLenB = p.armBLen + 9;
  const bendF = armLenF > 28 ? 0.07 : 0.38;
  const bendB = armLenB > 28 ? 0.07 : 0.38;

  // 後手
  let e = limb(-8, -57, p.armB, armLenB, 6.5, c.shirt, bendB);
  fist(e, 4.4);
  // 後腿 / 前腿(踢擊伸直,膝蓋弧度收掉)
  e = limb(-4.5, -32, p.legB, 33, 8, c.pants, 0.22);
  shoe(e);
  e = limb(4.5, -32, p.legF, p.kick ? 37 : 33, 8.5, c.pants, p.kick ? 0.05 : 0.22);
  shoe(e);
  // 軀幹:寬肩窄腰
  g.fillStyle = col(c.shirt);
  g.beginPath();
  g.moveTo(-12, -62);
  g.quadraticCurveTo(0, -66, 12, -62);
  g.lineTo(9, -36);
  g.quadraticCurveTo(0, -33, -9, -36);
  g.closePath();
  g.fill();
  g.strokeStyle = O; g.lineWidth = 2.4; g.stroke();
  g.fillStyle = 'rgba(0,0,0,.16)'; rr(g, -9, -40, 18, 5, 2); g.fill(); // 腰帶
  // 脖子 + 頭(擬真比例的小頭)
  const hx = 1 + p.lean * 5, hy = -72;
  g.strokeStyle = O; g.lineWidth = 7.5;
  g.beginPath(); g.moveTo(hx - 1, -62); g.lineTo(hx - 1, -65); g.stroke();
  g.strokeStyle = col(c.skin); g.lineWidth = 5;
  g.beginPath(); g.moveTo(hx - 1, -61); g.lineTo(hx - 1, -65); g.stroke();
  g.fillStyle = O; g.beginPath(); g.ellipse(hx, hy, 11, 12, 0, 0, 7); g.fill();
  g.fillStyle = col(c.skin); g.beginPath(); g.ellipse(hx, hy, 9.5, 10.5, 0, 0, 7); g.fill();
  // 髮型(沿用原本的造型,縮放到小頭)
  g.save();
  g.translate(hx, hy); g.scale(0.8, 0.8); g.translate(-hx, -hy + 1);
  drawHair(g, c, hx, hy, col);
  g.restore();
  if (c.band) {
    g.fillStyle = O; g.fillRect(hx - 10.5, hy - 6.5, 21, 5.5);
    g.fillStyle = col(c.band); g.fillRect(hx - 10, hy - 6, 20, 4.2);
  }
  // 臉
  const ko = f.hp <= 0, ouch = ['hurt', 'fall', 'caught'].includes(f.state);
  const dizzy = f.state === 'stunned';
  g.strokeStyle = '#241812'; g.fillStyle = '#241812'; g.lineWidth = 1.5;
  if (ko) {
    xEye(g, hx + 5.5, hy - 1); xEye(g, hx + 0.5, hy - 1);
  } else if (dizzy) {
    for (const ex of [hx + 0.5, hx + 5.5]) {
      g.beginPath(); g.arc(ex, hy - 1, 2.2, 0, 4.5 + Math.sin(frame * 0.2)); g.stroke();
    }
    g.beginPath(); g.arc(hx + 3, hy + 4.5, 1.8, 0, 7); g.fill();
  } else if (ouch) {
    g.beginPath(); g.moveTo(hx + 3.5, hy - 2.5); g.lineTo(hx + 7, hy - 1); g.stroke();
    g.beginPath(); g.moveTo(hx + 2, hy - 2.5); g.lineTo(hx - 1.5, hy - 1); g.stroke();
    g.beginPath(); g.arc(hx + 3, hy + 4.5, 2.2, 0, 7); g.fill();
  } else {
    // 戰鬥眉 + 雙眼
    g.beginPath(); g.moveTo(hx + 3.5, hy - 4); g.lineTo(hx + 7.5, hy - 3); g.stroke();
    g.beginPath(); g.moveTo(hx + 1.5, hy - 4); g.lineTo(hx - 2, hy - 3); g.stroke();
    g.beginPath(); g.arc(hx + 5.5, hy - 0.5, 1.4, 0, 7); g.fill();
    g.beginPath(); g.arc(hx + 0.5, hy - 0.5, 1.4, 0, 7); g.fill();
    g.beginPath(); g.moveTo(hx + 1.5, hy + 5); g.lineTo(hx + 5.5, hy + 5); g.stroke();
  }
  // 前手
  e = limb(8, -57, p.armF, armLenF, 7, c.shirt, bendF);
  fist(e, 4.8);
  if (f.weapon) drawHeldWeapon(g, f.weapon.kind, e[0], e[1], p.armF);
}
function xEye(g, x, y) {
  g.beginPath(); g.moveTo(x - 2.4, y - 2.4); g.lineTo(x + 2.4, y + 2.4);
  g.moveTo(x + 2.4, y - 2.4); g.lineTo(x - 2.4, y + 2.4); g.stroke();
}
function drawHair(g, c, hx, hy, col) {
  g.fillStyle = col(c.hair);
  if (c.hairKind === 'spiky') {
    g.beginPath(); g.arc(hx - 1, hy - 3, 13, Math.PI * 0.85, Math.PI * 2.06); g.fill();
    for (let i = 0; i < 4; i++) {
      const a = -2.4 + i * 0.5;
      g.beginPath();
      g.moveTo(hx + Math.cos(a) * 11 - 1, hy + Math.sin(a) * 11 - 3);
      g.lineTo(hx + Math.cos(a) * 20 - 3, hy + Math.sin(a) * 20 - 6);
      g.lineTo(hx + Math.cos(a + 0.4) * 11 - 1, hy + Math.sin(a + 0.4) * 11 - 3);
      g.fill();
    }
  } else if (c.hairKind === 'flame') {
    g.beginPath(); g.arc(hx - 1, hy - 3, 13, Math.PI * 0.8, Math.PI * 2.1); g.fill();
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(hx - 12 + i * 7, hy - 8);
      g.quadraticCurveTo(hx - 18 + i * 7, hy - 22 - i * 3, hx - 8 + i * 7, hy - 16 - i * 2);
      g.quadraticCurveTo(hx - 4 + i * 7, hy - 12, hx - 4 + i * 7, hy - 8);
      g.fill();
    }
  } else if (c.hairKind === 'side') {
    g.beginPath(); g.arc(hx - 1, hy - 2, 13.5, Math.PI * 0.75, Math.PI * 2.15); g.fill();
    g.beginPath(); g.moveTo(hx - 13, hy - 2); g.quadraticCurveTo(hx - 16, hy + 8, hx - 10, hy + 12);
    g.quadraticCurveTo(hx - 8, hy + 4, hx - 9, hy - 2); g.fill();
  } else {
    g.beginPath(); g.arc(hx - 0.5, hy - 4, 12.2, Math.PI * 0.95, Math.PI * 1.98); g.fill();
  }
}
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/* ============ 武器繪製 ============ */
function drawHeldWeapon(g, kind, ex, ey, ang) {
  g.save();
  g.translate(ex, ey);
  g.rotate(Math.PI / 2 - ang);
  weaponShape(g, kind);
  g.restore();
}
function weaponShape(g, kind) {
  if (kind === 'bat') {
    g.fillStyle = '#b9854a'; rr(g, -2, -3, 30, 6.5, 3); g.fill();
    g.fillStyle = '#caa06a'; rr(g, 16, -4, 14, 8.5, 4); g.fill();
    g.strokeStyle = '#7a5326'; g.lineWidth = 1; rr(g, -2, -3, 30, 6.5, 3); g.stroke();
  } else if (kind === 'knife') {
    g.fillStyle = '#4a3a2a'; rr(g, -3, -2.5, 9, 5, 2); g.fill();
    g.fillStyle = '#cfd6dd';
    g.beginPath(); g.moveTo(6, -2.8); g.lineTo(24, -1); g.lineTo(6, 2.8); g.closePath(); g.fill();
    g.strokeStyle = '#9aa2ab'; g.lineWidth = 0.8; g.stroke();
  } else if (kind === 'icesword') {
    g.fillStyle = '#3a4a6a'; rr(g, -4, -2.5, 10, 5, 2); g.fill();
    g.fillStyle = 'rgba(190,230,255,.95)';
    g.beginPath(); g.moveTo(6, -3.4); g.lineTo(30, -1); g.lineTo(6, 3.4); g.closePath(); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.stroke();
  } else if (kind === 'stone') {
    g.fillStyle = '#8a8f96';
    g.beginPath(); g.ellipse(5, 0, 8, 6.5, 0.4, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.25)';
    g.beginPath(); g.ellipse(3, -2, 3, 2, 0.4, 0, 7); g.fill();
  } else if (kind === 'soda') {
    g.fillStyle = '#e8533a'; rr(g, 0, -7, 9, 14, 2); g.fill();
    g.fillStyle = '#f4f0e8'; rr(g, 0, -3, 9, 5, 1); g.fill();
    g.fillStyle = '#c8c4bc'; rr(g, 0.5, -8.5, 8, 2.5, 1); g.fill();
  }
}
function drawItem(g, it, frame) {
  const sy = it.z - it.y;
  g.save();
  g.translate(it.x, sy - 8);
  if (it.flying) g.rotate(it.spin);
  else if (it.y <= 0) {
    const a = 0.25 + Math.sin(frame * 0.12) * 0.12;
    g.fillStyle = `rgba(255,235,150,${a})`;
    g.beginPath(); g.ellipse(0, 6, 22, 8, 0, 0, 7); g.fill();
    if (it.kind === 'bat') g.rotate(1.25);
    else if (it.kind === 'knife' || it.kind === 'icesword') g.rotate(1.5);
  }
  weaponShape(g, it.kind);
  g.restore();
}

/* ============ 彈幕 ============ */
function drawProj(g, p, frame) {
  const sy = p.z - p.y;
  g.save(); g.translate(p.x, sy);
  if (p.kind === 'blast') {
    const r = p.big ? 22 : 16;
    const gl = g.createRadialGradient(0, 0, 2, 0, 0, r);
    gl.addColorStop(0, '#ffffff'); gl.addColorStop(0.45, '#8df0ff'); gl.addColorStop(1, 'rgba(80,200,255,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    g.strokeStyle = 'rgba(170,240,255,.6)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-Math.sign(p.vx) * (r - 2), -4); g.lineTo(-Math.sign(p.vx) * (r + 10), -4); g.stroke();
    g.beginPath(); g.moveTo(-Math.sign(p.vx) * (r - 2), 4); g.lineTo(-Math.sign(p.vx) * (r + 10), 4); g.stroke();
  } else if (p.kind === 'fire') {
    const r = 12, fl = Math.sin(frame * 0.6 + p.seed) * 3;
    g.fillStyle = 'rgba(255,120,30,.85)';
    g.beginPath(); g.arc(0, 0, r + fl * 0.4, 0, 7); g.fill();
    g.fillStyle = '#ffd23e'; g.beginPath(); g.arc(Math.sign(p.vx) * 2, 0, r * 0.55, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,90,20,.7)';
    g.beginPath();
    g.moveTo(-Math.sign(p.vx) * r, -4); g.quadraticCurveTo(-Math.sign(p.vx) * (r + 14 + fl), 0, -Math.sign(p.vx) * r, 4);
    g.fill();
  } else if (p.kind === 'ice') {
    g.rotate(frame * 0.15);
    g.fillStyle = 'rgba(190,230,255,.9)'; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); }
    g.closePath(); g.fill(); g.stroke();
  } else if (p.kind === 'homing') {
    const gl = g.createRadialGradient(0, 0, 2, 0, 0, 14);
    gl.addColorStop(0, '#eaffea'); gl.addColorStop(0.5, '#7ce87c'); gl.addColorStop(1, 'rgba(60,200,60,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill();
    g.strokeStyle = 'rgba(180,255,180,.8)'; g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i < 5; i++) g.lineTo((Math.sin(frame * 0.8 + i * 2.2) * 10), (Math.cos(frame * 1.1 + i * 1.7) * 10));
    g.stroke();
  } else if (p.kind === 'storm') {
    g.globalAlpha = 0.75 + Math.sin(frame * 0.2) * 0.15;
    for (let i = 0; i < 3; i++) {
      g.fillStyle = `rgba(215,240,255,${0.3 - i * 0.07})`;
      g.beginPath(); g.arc(Math.sin(frame * 0.1 + i * 2) * 10, Math.cos(frame * 0.13 + i) * 6, 22 + i * 8, 0, 7); g.fill();
    }
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(Math.sin(frame * 0.07 + i * 1.3) * 24, Math.cos(frame * 0.09 + i * 2.1) * 14, 1.8, 0, 7);
      g.fill();
    }
  } else if (p.kind === 'icicle') {
    // 從地面竄出的冰柱
    g.translate(0, p.y); // 回到地面錨點
    const hgt = 52 * Math.min(1, (p.life0 - p.life) / 6 + 0.2);
    g.fillStyle = 'rgba(200,235,255,.92)'; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5;
    for (const [ox, s] of [[-16, 0.7], [0, 1], [15, 0.8]]) {
      g.beginPath();
      g.moveTo(ox - 9 * s, 2); g.lineTo(ox, -hgt * s); g.lineTo(ox + 9 * s, 2);
      g.closePath(); g.fill(); g.stroke();
    }
  } else if (p.kind === 'inferno') {
    // 地獄火柱
    g.translate(0, p.y);
    g.globalAlpha = 0.85;
    for (let i = 0; i < 4; i++) {
      const fx = Math.sin(frame * 0.5 + i * 1.7) * 10;
      const hh = 55 + Math.sin(frame * 0.7 + i * 2.3) * 12;
      g.fillStyle = i % 2 ? 'rgba(255,140,40,.7)' : 'rgba(255,210,60,.6)';
      g.beginPath();
      g.moveTo(fx - 12 + i * 6, 2);
      g.quadraticCurveTo(fx - 16 + i * 6, -hh * 0.6, fx + i * 6 - 4, -hh);
      g.quadraticCurveTo(fx + 6 + i * 6, -hh * 0.5, fx + 8 + i * 6, 2);
      g.fill();
    }
  }
  g.restore();
}

/* ============ HUD ============ */
function drawHUD(g, eng) {
  const slot = [0, 0];
  for (const f of eng.fighters) {
    const left = f.team === 0;
    const n = slot[f.team]++;
    const bw = 240;
    const bx = left ? 24 : W - 24 - bw - 64;
    const by = 12 + n * 64;
    g.fillStyle = 'rgba(20,16,24,.72)';
    rr(g, bx - 6, by, bw + 76, 58, 8); g.fill();
    const px = left ? bx + 22 : bx + bw + 48;
    g.save(); g.beginPath(); g.arc(px, by + 30, 19, 0, 7); g.clip();
    g.fillStyle = '#5a4a66'; g.fillRect(px - 20, by + 10, 40, 40);
    g.fillStyle = f.c.skin; g.beginPath(); g.arc(px, by + 34, 13, 0, 7); g.fill();
    g.fillStyle = f.c.hair; g.beginPath(); g.arc(px, by + 28, 13, Math.PI * 0.9, Math.PI * 2.1); g.fill();
    g.fillStyle = '#3a2a20';
    g.beginPath(); g.arc(px - 4.5, by + 35, 1.5, 0, 7); g.fill();
    g.beginPath(); g.arc(px + 4.5, by + 35, 1.5, 0, 7); g.fill();
    g.restore();
    g.strokeStyle = f.isAI ? '#9a8aa8' : (f.pid === 0 ? '#e85d4a' : '#4a90e8');
    g.lineWidth = 2.5;
    g.beginPath(); g.arc(px, by + 30, 19, 0, 7); g.stroke();
    const tag = f.isAI ? 'CPU' : `P${f.pid + 1}`;
    g.fillStyle = '#fff'; g.font = 'bold 13px system-ui, "PingFang TC", sans-serif';
    g.textAlign = left ? 'left' : 'right';
    g.fillText(`${f.c.name} · ${tag}`, left ? bx + 48 : bx + bw + 22, by + 16);
    const hx = left ? bx + 48 : bx + 16;
    g.fillStyle = '#241a1a'; rr(g, hx, by + 22, bw - 32, 12, 4); g.fill();
    const rec = Math.max(0, f.hpRec / HP_MAX), hp = Math.max(0, f.hp / HP_MAX);
    const w2 = bw - 32;
    g.fillStyle = '#7a2a24';
    if (rec > 0) { rr(g, left ? hx : hx + w2 * (1 - rec), by + 22, w2 * rec, 12, 4); g.fill(); }
    g.fillStyle = hp > 0.3 ? '#e8493c' : '#ff2d18';
    if (hp > 0) { rr(g, left ? hx : hx + w2 * (1 - hp), by + 22, w2 * hp, 12, 4); g.fill(); }
    g.fillStyle = '#161c28'; rr(g, hx, by + 39, w2, 8, 3); g.fill();
    const mp = f.mp / MP_MAX;
    g.fillStyle = '#3f8fe8';
    if (mp > 0) { rr(g, left ? hx : hx + w2 * (1 - mp), by + 39, w2 * mp, 8, 3); g.fill(); }
    if (f.weapon) {
      g.save(); g.translate(left ? bx + bw + 58 : bx - 14, by + 46); g.scale(0.8, 0.8);
      weaponShape(g, f.weapon.kind);
      g.restore();
    }
  }
}

function drawBanner(g, eng, frame) {
  const b = eng.banner;
  if (b.t <= 0) return;
  const isKO = b.text === 'K.O.!';
  const age = isKO ? Math.min(30, 9999 - b.t + 30) : 70 - b.t;
  const pop = Math.min(1, age / 8);
  const alpha = isKO ? 1 : Math.min(1, b.t / 14);
  g.save();
  g.translate(W / 2, 180);
  g.scale(0.6 + pop * 0.4 + (isKO ? Math.sin(frame * 0.12) * 0.03 : 0), 0.6 + pop * 0.4);
  g.globalAlpha = alpha;
  g.font = '900 84px system-ui, "PingFang TC", sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 10; g.strokeStyle = '#2a1408'; g.strokeText(b.text, 0, 0);
  const grad = g.createLinearGradient(0, -60, 0, 20);
  grad.addColorStop(0, isKO ? '#ffd23e' : '#fff'); grad.addColorStop(1, isKO ? '#ff5a1f' : '#ffd23e');
  g.fillStyle = grad; g.fillText(b.text, 0, 0);
  g.restore();
}

/* ============ 戰鬥畫面總成 ============ */
function drawFight(g, eng, frame) {
  if (!skyCache) buildStage();
  const cam = eng.camX;
  g.save();
  if (eng.shake > 0) g.translate((Math.random() - 0.5) * eng.shake * 2, (Math.random() - 0.5) * eng.shake);
  g.drawImage(skyCache, 0, 0);
  g.drawImage(midCache, -cam * 0.35, 0);
  g.drawImage(groundCache, -cam, 300);

  g.save();
  g.translate(-cam, 0);
  for (const f of eng.fighters) {
    g.fillStyle = 'rgba(0,0,0,.28)';
    const r = Math.max(8, 17 - f.y * 0.06);
    g.beginPath(); g.ellipse(f.x, f.z + 3, r, r * 0.32, 0, 0, 7); g.fill();
  }
  for (const p of eng.projs) {
    if (p.kind === 'icicle' || p.kind === 'inferno') continue;
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.beginPath(); g.ellipse(p.x, p.z + 3, 9, 3, 0, 0, 7); g.fill();
  }
  for (const it of eng.items) {
    if (it.heldBy !== null) continue;
    g.fillStyle = 'rgba(0,0,0,.2)';
    g.beginPath(); g.ellipse(it.x, it.z + 2, 10, 3.2, 0, 0, 7); g.fill();
  }
  const ents = [
    ...eng.fighters.map(f => ({ z: f.z, d: () => drawFighter(g, f, frame) })),
    ...eng.projs.map(p => ({ z: p.z, d: () => drawProj(g, p, frame) })),
    ...eng.items.filter(it => it.heldBy === null).map(it => ({ z: it.z, d: () => drawItem(g, it, frame) })),
  ].sort((a, b) => a.z - b.z);
  for (const e of ents) e.d();

  for (const p of eng.parts) {
    const a = p.life / p.max;
    g.globalAlpha = a;
    if (p.kind === 'spark') {
      g.fillStyle = p.color; g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    } else if (p.kind === 'flame') {
      g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.size * a + 1, 0, 7); g.fill();
    } else if (p.kind === 'ice') {
      g.fillStyle = p.color;
      g.save(); g.translate(p.x, p.y); g.rotate(p.life * 0.2);
      g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); g.restore();
    } else if (p.kind === 'star') {
      // 暈眩小星星
      g.strokeStyle = p.color; g.lineWidth = 1.5;
      g.save(); g.translate(p.x, p.y); g.rotate(p.life * 0.15);
      g.beginPath(); g.moveTo(-3, 0); g.lineTo(3, 0); g.moveTo(0, -3); g.lineTo(0, 3); g.stroke();
      g.restore();
    } else {
      g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.size * 1.5 * a, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }
  g.restore();

  drawHUD(g, eng);
  drawBanner(g, eng, frame);

  if (eng.over && eng.winText) {
    g.fillStyle = 'rgba(12,8,16,.55)'; g.fillRect(0, H / 2 - 4, W, 130);
    g.textAlign = 'center';
    g.fillStyle = '#ffd23e'; g.font = 'bold 40px system-ui, "PingFang TC", sans-serif';
    g.fillText(eng.winText, W / 2, H / 2 + 46);
    g.fillStyle = '#e8e0d0'; g.font = '17px system-ui, "PingFang TC", sans-serif';
    g.fillText('R — 再戰一場      Enter — 重選角色', W / 2, H / 2 + 86);
  }
  g.restore();
}

/* ============ 標題畫面 ============ */
function drawTitle(g, frame, demoFighters) {
  if (!skyCache) buildStage();
  g.drawImage(skyCache, 0, 0);
  g.drawImage(midCache, 0, 0);
  g.drawImage(groundCache, 0, 300);
  g.fillStyle = 'rgba(15,8,20,.45)'; g.fillRect(0, 0, W, H);

  for (const f of demoFighters) drawFighter(g, f, frame, 1.3);

  g.textAlign = 'center';
  g.font = '900 72px system-ui, "PingFang TC", sans-serif';
  g.lineWidth = 12; g.strokeStyle = '#2a1408';
  g.strokeText('小朋友齊打交', W / 2, 128);
  const grad = g.createLinearGradient(0, 70, 0, 140);
  grad.addColorStop(0, '#ffe98a'); grad.addColorStop(1, '#ff7a2f');
  g.fillStyle = grad; g.fillText('小朋友齊打交', W / 2, 128);
  g.font = 'bold 20px system-ui, "PingFang TC", sans-serif';
  g.fillStyle = '#ffe9c8';
  g.fillText('致敬復刻版 — 角色與招式向原作看齊,美術原創', W / 2, 166);

  g.font = 'bold 23px system-ui, "PingFang TC", sans-serif';
  const blink = Math.floor(frame / 30) % 2 === 0;
  const modes = [
    '1 — 單人對決(你 vs 電腦)',
    '2 — 雙人對決(P1 vs P2)',
    '3 — 單人 2v2(你+電腦隊友 vs 電腦×2)',
    '4 — 雙人 2v2(你+P2 vs 電腦×2)',
  ];
  modes.forEach((m, i) => {
    g.fillStyle = blink || i % 2 ? 'rgba(255,255,255,.95)' : 'rgba(255,235,180,.95)';
    g.fillText(m, W / 2, 230 + i * 38);
  });

  g.font = '14px system-ui, "PingFang TC", sans-serif';
  g.fillStyle = 'rgba(255,240,220,.85)';
  g.fillText('P1:WASD 移動 / J 攻擊 / K 跳躍 / L 防禦        P2:方向鍵移動 / , 攻擊 / . 跳躍 / / 防禦', W / 2, 420);
  g.fillText('搓招照原作:防+方向+攻 或 防+方向+跳(選角畫面有每隻的招式表)    雙擊方向 = 跑步    M = 音樂', W / 2, 446);
  g.fillText('連打 4 下會把人打暈 → 走過去抓住 → 連按攻擊毆打,或按方向+攻擊過肩摔    倒地瞬間按跳 = 受身', W / 2, 472);
  g.fillStyle = 'rgba(255,240,220,.5)';
  g.fillText('純手繪 Canvas 致敬之作,玩法機制取自《Little Fighter 2》,素材皆為原創', W / 2, 518);
}

/* ============ 選角畫面 ============ */
function drawSelect(g, sel, frame, previews) {
  if (!skyCache) buildStage();
  g.drawImage(skyCache, 0, 0);
  g.drawImage(midCache, 0, 0);
  g.drawImage(groundCache, 0, 300);
  g.fillStyle = 'rgba(15,8,20,.55)'; g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.font = '900 36px system-ui, "PingFang TC", sans-serif';
  g.fillStyle = '#ffe9c8'; g.fillText('選擇你的小朋友', W / 2, 56);

  const n = CHAR_KEYS.length;
  const gap = 14, cw = Math.floor((W - 56 - gap * (n - 1)) / n), x0 = 28;
  for (let i = 0; i < n; i++) {
    const key = CHAR_KEYS[i], c = CHARS[key];
    const x = x0 + i * (cw + gap), y = 84, ch = 330;
    g.fillStyle = 'rgba(28,20,36,.85)';
    rr(g, x, y, cw, ch, 12); g.fill();
    const p1on = sel.p1Idx === i, p2on = sel.humans > 1 && sel.p2Idx === i;
    if (p1on) { g.strokeStyle = sel.p1Done ? '#ffd23e' : '#e85d4a'; g.lineWidth = 4; rr(g, x - 3, y - 3, cw + 6, ch + 6, 14); g.stroke(); }
    if (p2on) { g.strokeStyle = sel.p2Done ? '#ffd23e' : '#4a90e8'; g.lineWidth = 4; rr(g, x + 3, y + 3, cw - 6, ch - 6, 10); g.stroke(); }
    if (sel.cpuFlash === i) { g.strokeStyle = '#b89aff'; g.lineWidth = 3; rr(g, x + 6, y + 6, cw - 12, ch - 12, 8); g.stroke(); }
    const pf = previews[i];
    pf.x = x + cw / 2; pf.z = y + 150;
    drawFighter(g, pf, frame, 1.25);
    g.font = 'bold 19px system-ui, "PingFang TC", sans-serif';
    g.fillStyle = '#fff'; g.fillText(c.name, x + cw / 2, y + 182);
    g.font = '13px system-ui, "PingFang TC", sans-serif';
    g.fillStyle = '#d8c8a8'; g.fillText(c.zh, x + cw / 2, y + 202);
    // 招式表(原作指令);招多的角色(Woody 6 招)壓縮成單行
    const mvEntries = Object.entries(c.moves);
    const compact = mvEntries.length > 4;
    g.font = (compact ? '11px' : '12px') + ' system-ui, "PingFang TC", sans-serif';
    g.fillStyle = '#a8c8e8';
    let my = y + (compact ? 220 : 226);
    for (const [k, m] of mvEntries) {
      const keyTxt = '防' + (k[0] === '>' ? '→' : k[0] === '^' ? '↑' : '↓') + (k[1] === 'A' ? '攻' : '跳');
      if (compact) {
        g.fillText(`${keyTxt} ${m.name} ${m.mp}MP`, x + cw / 2, my);
        my += 19;
      } else {
        g.fillText(`${keyTxt} ${m.name}`, x + cw / 2, my);
        g.fillStyle = '#7a90a8';
        g.fillText(`${m.mp} MP${m.hpCost ? ' + ' + m.hpCost + ' HP' : ''}`, x + cw / 2, my + 13);
        g.fillStyle = '#a8c8e8';
        my += 30;
      }
      if (my > y + ch - 8) break;
    }
    g.font = 'bold 14px system-ui';
    if (p1on) { g.fillStyle = '#e85d4a'; g.fillText(sel.p1Done ? 'P1 ✓' : 'P1', x + 22, y + 22); }
    if (p2on) { g.fillStyle = '#4a90e8'; g.fillText(sel.p2Done ? 'P2 ✓' : 'P2', x + cw - 26, y + 22); }
  }
  g.font = '16px system-ui, "PingFang TC", sans-serif';
  g.fillStyle = 'rgba(255,240,220,.9)';
  let hint;
  if (!sel.p1Done) hint = 'P1:A / D 移動游標,J 確認';
  else if (sel.humans > 1 && !sel.p2Done) hint = 'P2:← / → 移動游標,, 確認';
  else if (sel.cpuT > 0) hint = '電腦選角中…';
  else if (sel.cpuKeys.length) hint = '電腦選了 ' + sel.cpuKeys.map(k => CHARS[k].name).join('、') + ',準備開戰!';
  else hint = '準備開戰…';
  g.fillText(hint, W / 2, 462);
  g.fillStyle = 'rgba(255,240,220,.5)';
  g.font = '13px system-ui, "PingFang TC", sans-serif';
  g.fillText('Esc — 回到標題', W / 2, 490);
}

/* ============ 音效 + BGM(WebAudio 即時生成,零音檔) ============ */
const SFX = {
  ctx: null, master: null, bgm: null,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);
    } catch (e) { /* 無聲也能玩 */ }
  },
  osc(type, f0, f1, dur, vol = 0.5, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + Math.max(0, delay);
    const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(gn); gn.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, type, f0, f1, vol = 0.5, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + Math.max(0, delay);
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const fl = this.ctx.createBiquadFilter(); fl.type = type;
    fl.frequency.setValueAtTime(f0, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(fl); fl.connect(gn); gn.connect(this.master);
    src.start(t);
  },
  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'whoosh': this.noise(0.09, 'bandpass', 1800, 500, 0.3); break;
      case 'swing': this.noise(0.13, 'bandpass', 900, 300, 0.4); break;
      case 'hit': this.noise(0.07, 'lowpass', 900, 300, 0.7); this.osc('square', 160, 70, 0.08, 0.4); break;
      case 'clang': this.osc('square', 620, 180, 0.1, 0.35); this.noise(0.08, 'highpass', 2200, 3600, 0.3); break;
      case 'slash': this.noise(0.07, 'highpass', 3200, 1500, 0.4); break;
      case 'block': this.noise(0.05, 'highpass', 2500, 4000, 0.25); break;
      case 'thud': this.osc('sine', 95, 45, 0.14, 0.7); this.noise(0.1, 'lowpass', 500, 150, 0.5); break;
      case 'jump': this.osc('sine', 220, 430, 0.07, 0.12); break;
      case 'cast': this.osc('sawtooth', 180, 640, 0.13, 0.25); break;
      case 'shoot': this.osc('square', 320, 760, 0.1, 0.3); this.noise(0.08, 'bandpass', 1200, 2400, 0.2); break;
      case 'fire': this.noise(0.28, 'lowpass', 1400, 400, 0.5); this.osc('sawtooth', 140, 60, 0.25, 0.2); break;
      case 'explode': this.noise(0.5, 'lowpass', 1600, 200, 0.8); this.osc('sine', 110, 35, 0.4, 0.7); break;
      case 'ice': this.osc('triangle', 900, 1500, 0.09, 0.22); this.osc('triangle', 1200, 1900, 0.09, 0.18, 0.05); break;
      case 'freezeHit': this.osc('triangle', 1400, 500, 0.16, 0.3); this.noise(0.1, 'highpass', 3000, 5000, 0.2); break;
      case 'shatter': this.noise(0.16, 'highpass', 2400, 5500, 0.45); this.osc('triangle', 1800, 600, 0.12, 0.2); break;
      case 'ko': this.osc('sawtooth', 420, 70, 0.55, 0.5); this.noise(0.4, 'lowpass', 1000, 200, 0.5); break;
      case 'select': this.osc('square', 520, 660, 0.05, 0.15); break;
      case 'confirm': this.osc('square', 520, 780, 0.07, 0.2); this.osc('square', 780, 1040, 0.08, 0.2, 0.07); break;
      case 'pickup': this.osc('square', 440, 880, 0.09, 0.22); break;
      case 'throwItem': this.noise(0.12, 'bandpass', 1400, 400, 0.35); break;
      case 'itemFall': this.osc('sine', 880, 440, 0.18, 0.12); break;
      case 'itemDrop': this.osc('sine', 130, 70, 0.08, 0.3); this.noise(0.05, 'lowpass', 700, 250, 0.25); break;
      case 'break': this.noise(0.14, 'bandpass', 2000, 600, 0.5); this.osc('square', 300, 90, 0.1, 0.25); break;
      case 'drinkOpen': this.noise(0.06, 'highpass', 3500, 5000, 0.2); this.osc('sine', 700, 1100, 0.05, 0.12, 0.06); break;
      case 'gulp': this.osc('sine', 300, 160, 0.09, 0.2); break;
    }
  },
  bgmStart() {
    if (!this.ctx || this.bgm) return;
    this.bgm = { step: 0, next: this.ctx.currentTime + 0.08, iv: setInterval(() => this.bgmTick(), 40) };
  },
  bgmStop() {
    if (this.bgm) { clearInterval(this.bgm.iv); this.bgm = null; }
  },
  get bgmOn() { return !!this.bgm; },
  bgmTick() {
    const b = this.bgm;
    if (!b || !this.ctx) return;
    const eighth = 60 / 132 / 2;
    while (b.next < this.ctx.currentTime + 0.18) {
      this.bgmStep(b.step % 32, b.next - this.ctx.currentTime);
      b.next += eighth; b.step++;
    }
  },
  bgmStep(s, d) {
    const i = s % 8;
    if (i === 0 || i === 3 || i === 6) this.osc('sine', 115, 42, 0.11, 0.42, d);
    if (i === 4) this.noise(0.07, 'bandpass', 1900, 900, 0.22, d);
    this.noise(0.022, 'highpass', 6500, 7500, i % 2 ? 0.04 : 0.07, d);
    const bass = [55, 0, 55, 65.4, 0, 55, 0, 73.4, 55, 0, 55, 65.4, 82.4, 0, 73.4, 65.4];
    const f = bass[s % 16];
    if (f) this.osc('sawtooth', f, f, 0.19, 0.14, d);
    if (s === 24) this.osc('square', 440, 440, 0.1, 0.07, d);
    if (s === 26) this.osc('square', 523, 523, 0.1, 0.07, d);
    if (s === 28) this.osc('square', 392, 392, 0.16, 0.07, d);
  },
};
