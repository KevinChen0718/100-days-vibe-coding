'use strict';
// 畫面渲染 + 音效 — 所有角色與場景皆 Canvas 向量手繪,零圖片素材
// 場景:黃昏競技場(原創繪製)。三層視差:天空(不動)/ 觀眾席(0.35x)/ 場地(1x)

let skyCache = null, midCache = null, groundCache = null;
const MID_W = Math.ceil(W + (STAGE_W - W) * 0.35) + 60;
const fighterUiTexture = typeof Image !== 'undefined' ? new Image() : null;
if (fighterUiTexture) fighterUiTexture.src = 'assets/ui-fighter-texture.webp';

function drawUiTexture(g, alpha = 0.32) {
  if (!fighterUiTexture || !fighterUiTexture.complete || !fighterUiTexture.naturalWidth) return;
  g.save();
  g.globalAlpha = alpha;
  g.drawImage(fighterUiTexture, 0, 0, W, H);
  g.restore();
}

function cutPanel(g, x, y, w, h, color, cut = 18) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x + cut, y);
  g.lineTo(x + w, y);
  g.lineTo(x + w - cut, y + h);
  g.lineTo(x, y + h);
  g.closePath();
  g.fill();
}

function keycap(g, key, x, y, color = '#f4eedf') {
  g.strokeStyle = color;
  g.lineWidth = 1.5;
  g.strokeRect(x, y, 24, 18);
  g.fillStyle = color;
  g.font = '900 10px "Arial Narrow", system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText(key, x + 12, y + 13);
}

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
  const red = '#e52b2d';
  const blue = '#1657c8';
  const cream = '#f7f0df';
  const teams = [eng.fighters.filter(f => f.team === 0), eng.fighters.filter(f => f.team === 1)];

  g.save();
  g.fillStyle = 'rgba(6,6,9,.88)';
  g.fillRect(0, 0, W, 108);
  drawUiTexture(g, 0.2);

  teams.forEach((members, team) => {
    const left = team === 0;
    const accent = left ? red : blue;
    const main = members[0];
    if (!main) return;
    const x = left ? 14 : W - 354;
    const y = 12;
    const w = 340;

    cutPanel(g, x, y, w, 76, 'rgba(8,8,12,.96)', 24);
    cutPanel(g, left ? x : x + 10, y, w - 10, 16, accent, 10);
    g.fillStyle = cream;
    g.textAlign = left ? 'left' : 'right';
    g.font = '950 18px Impact, "Arial Narrow", system-ui, sans-serif';
    g.fillText(`${main.c.name.toUpperCase()} · ${main.isAI ? 'CPU' : 'P' + (main.pid + 1)}`, left ? x + 18 : x + w - 18, y + 38);

    const hp = Math.max(0, main.hp / HP_MAX);
    const mp = Math.max(0, main.mp / MP_MAX);
    const bx = x + 18;
    const bw = w - 36;
    g.fillStyle = '#2c2c31';
    g.fillRect(bx, y + 48, bw, 12);
    g.fillStyle = red;
    g.fillRect(left ? bx : bx + bw * (1 - hp), y + 48, bw * hp, 12);
    g.fillStyle = '#242b3c';
    g.fillRect(bx, y + 64, bw, 6);
    g.fillStyle = blue;
    g.fillRect(left ? bx : bx + bw * (1 - mp), y + 64, bw * mp, 6);

    if (members.length > 1) {
      members.slice(1).forEach((f, i) => {
        const sy = 92 + i * 18;
        const shp = Math.max(0, f.hp / HP_MAX);
        g.fillStyle = 'rgba(6,6,9,.86)';
        g.fillRect(x + 12, sy, w - 24, 14);
        g.fillStyle = accent;
        g.fillRect(left ? x + 12 : x + 12 + (w - 24) * (1 - shp), sy, (w - 24) * shp, 3);
        g.fillStyle = cream;
        g.font = '800 9px "Arial Narrow", system-ui, sans-serif';
        g.textAlign = left ? 'left' : 'right';
        g.fillText(`${f.c.name.toUpperCase()} · ${f.isAI ? 'CPU' : 'P' + (f.pid + 1)}`, left ? x + 18 : x + w - 18, sy + 11);
      });
    }
  });

  const seconds = Math.max(0, 99 - Math.floor(eng.frame / 60));
  g.fillStyle = '#050507';
  g.beginPath();
  g.arc(W / 2, 46, 54, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = seconds < 15 ? red : '#f3c533';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(W / 2, 46, 50, 0, Math.PI * 2);
  g.stroke();
  g.textAlign = 'center';
  g.fillStyle = '#f3c533';
  g.font = '900 8px "Arial Narrow", system-ui, sans-serif';
  g.fillText('BATTLE / TEAM A · B', W / 2, 25);
  g.fillStyle = cream;
  g.font = '950 42px Impact, "Arial Narrow", system-ui, sans-serif';
  g.fillText(String(seconds).padStart(2, '0'), W / 2, 66);
  g.restore();
}

function drawBanner(g, eng, frame) {
  const b = eng.banner;
  if (b.t <= 0) return;
  const isKO = b.text === 'K.O.!';
  const age = isKO ? Math.min(30, 9999 - b.t + 30) : 70 - b.t;
  const pop = Math.min(1, age / 8);
  const alpha = isKO ? 1 : Math.min(1, b.t / 14);
  g.save();
  g.translate(W / 2, 208);
  g.scale(0.6 + pop * 0.4 + (isKO ? Math.sin(frame * 0.12) * 0.03 : 0), 0.6 + pop * 0.4);
  g.globalAlpha = alpha;
  cutPanel(g, -280, -74, 250, 68, '#e52b2d', 28);
  cutPanel(g, 30, -74, 250, 68, '#1657c8', 28);
  g.font = '950 92px Impact, "Arial Narrow", system-ui, "PingFang TC", sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 12;
  g.strokeStyle = '#07070a';
  g.strokeText(b.text, 0, 0);
  g.fillStyle = isKO ? '#f3c533' : '#f7f0df';
  g.fillText(b.text, 0, 0);
  g.restore();
}

function drawFightCommandRail(g) {
  const cmds = [
    ['WASD / 方向鍵', '移動'],
    ['J / ,', '攻擊'],
    ['K / .', '跳躍'],
    ['L / /', '防禦'],
    ['P', '暫停'],
    ['ESC', '離開'],
  ];
  g.fillStyle = 'rgba(5,5,8,.95)';
  g.fillRect(0, H - 46, W, 46);
  cmds.forEach((cmd, i) => {
    const x = i * (W / cmds.length);
    const accent = i % 2 ? '#1657c8' : '#e52b2d';
    g.fillStyle = accent;
    g.fillRect(x, H - 46, W / cmds.length, 4);
    g.fillStyle = '#f7f0df';
    g.font = '900 10px "Arial Narrow", system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(cmd[0], x + W / cmds.length / 2, H - 25);
    g.fillStyle = 'rgba(247,240,223,.62)';
    g.font = '700 8px "PingFang TC", system-ui, sans-serif';
    g.fillText(cmd[1], x + W / cmds.length / 2, H - 11);
  });
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
  drawFightCommandRail(g);

  if (eng.over && eng.winText) {
    g.fillStyle = 'rgba(5,5,8,.86)'; g.fillRect(0, 118, W, 330);
    drawUiTexture(g, 0.28);
    cutPanel(g, 0, 164, W * 0.57, 156, '#e52b2d', 42);
    cutPanel(g, W * 0.47, 164, W * 0.53, 156, '#1657c8', 42);
    g.textAlign = 'center';
    g.fillStyle = '#f3c533';
    g.font = '900 11px "Arial Narrow", system-ui, sans-serif';
    g.fillText('MATCH RESULT / FINAL CALL', W / 2, 155);
    g.fillStyle = '#f7f0df';
    g.font = '950 54px Impact, "Arial Narrow", system-ui, "PingFang TC", sans-serif';
    g.lineWidth = 8;
    g.strokeStyle = '#050507';
    g.strokeText(eng.winText, W / 2, 250);
    g.fillText(eng.winText, W / 2, 250);
    g.fillStyle = '#050507';
    g.fillRect(W / 2 - 236, 338, 472, 52);
    g.fillStyle = '#f7f0df';
    g.font = '800 14px "Arial Narrow", system-ui, "PingFang TC", sans-serif';
    g.fillText('R  再戰一場      ENTER  重選角色', W / 2, 370);
  }
  g.restore();
}

/* ============ 標題畫面 ============ */
function drawTitle(g, frame, demoFighters) {
  if (!skyCache) buildStage();
  g.drawImage(skyCache, 0, 0);
  g.drawImage(midCache, 0, 0);
  g.drawImage(groundCache, 0, 300);
  g.fillStyle = 'rgba(5,5,8,.7)';
  g.fillRect(0, 0, W, H);
  drawUiTexture(g, 0.56);

  for (const f of demoFighters) {
    const oldX = f.x, oldZ = f.z;
    f.x = f.pid === 0 ? 690 : 835;
    f.z = 365;
    drawFighter(g, f, frame, 1.85);
    f.x = oldX;
    f.z = oldZ;
  }

  cutPanel(g, 0, 0, 620, 126, '#e52b2d', 44);
  cutPanel(g, 0, 126, 535, 174, '#f7f0df', 54);
  g.textAlign = 'left';
  g.fillStyle = '#f3c533';
  g.font = '900 12px "Arial Narrow", system-ui, sans-serif';
  g.fillText('100 DAYS VIBE CODING · DAY 4 · FIGHT NIGHT', 34, 34);
  g.fillStyle = '#f7f0df';
  g.font = '950 44px Impact, "Arial Narrow", system-ui, "PingFang TC", sans-serif';
  g.fillText('小朋友齊打交', 34, 90);
  g.fillStyle = '#09090d';
  g.font = '950 58px Impact, "Arial Narrow", system-ui, sans-serif';
  g.fillText('LITTLE FIGHTERS', 34, 205);
  g.fillStyle = '#1657c8';
  g.font = '950 34px Impact, "Arial Narrow", system-ui, sans-serif';
  g.fillText('TRIBUTE / TOURNAMENT', 36, 248);
  g.fillStyle = '#35343b';
  g.font = '800 12px "Arial Narrow", system-ui, "PingFang TC", sans-serif';
  g.fillText('原創角色美術 · 五名選手 · 經典必殺輸入', 38, 278);

  const modes = [
    ['1', '單人對決', 'PLAYER  VS  CPU'],
    ['2', '雙人對決', 'PLAYER  VS  PLAYER'],
    ['3', '單人 2v2', 'PLAYER TEAM  VS  CPU'],
    ['4', '雙人 2v2', 'DUO TEAM  VS  CPU'],
  ];
  g.fillStyle = '#050507';
  g.fillRect(0, 352, W, 144);
  modes.forEach((m, i) => {
    const x = 18 + i * 234;
    const color = i % 2 ? '#1657c8' : '#e52b2d';
    cutPanel(g, x, 368, 222, 92, color, 22);
    g.fillStyle = '#f3c533';
    g.font = '950 31px Impact, "Arial Narrow", system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText(m[0], x + 18, 407);
    g.fillStyle = '#f7f0df';
    g.font = '900 16px "Arial Narrow", system-ui, "PingFang TC", sans-serif';
    g.fillText(m[1], x + 55, 404);
    g.font = '800 9px "Arial Narrow", system-ui, sans-serif';
    g.fillText(m[2], x + 55, 426);
    g.fillStyle = 'rgba(5,5,7,.54)';
    g.fillRect(x + 12, 441, 188, 4);
  });

  g.fillStyle = '#f7f0df';
  g.fillRect(0, 496, W, 44);
  g.fillStyle = '#09090d';
  g.font = '900 11px "Arial Narrow", system-ui, "PingFang TC", sans-serif';
  g.textAlign = 'center';
  g.fillText('按 1–4 選擇賽制　　P1：WASD / J K L　　P2：方向鍵 / , . /　　M 音樂', W / 2, 523);
}

/* ============ 選角畫面 ============ */
function drawSelectLegacy(g, sel, frame, previews) {
  if (!skyCache) buildStage();
  g.drawImage(skyCache, 0, 0);
  g.drawImage(midCache, 0, 0);
  g.drawImage(groundCache, 0, 300);
  g.fillStyle = 'rgba(8,12,28,.68)'; g.fillRect(0, 0, W, H);
  g.textAlign = 'left';
  g.fillStyle = '#f4cf76';
  g.font = '800 10px system-ui, "PingFang TC", sans-serif';
  g.fillText('FIGHTER SELECT', 32, 32);
  g.fillStyle = '#f4ead6';
  g.font = '900 31px system-ui, "PingFang TC", sans-serif';
  g.fillText('選擇你的角色', 30, 66);
  g.textAlign = 'right';
  g.fillStyle = 'rgba(244,234,214,.56)';
  g.font = '12px system-ui, "PingFang TC", sans-serif';
  g.fillText('每位角色都有不同的速度、連段與必殺技', W - 30, 55);

  const n = CHAR_KEYS.length;
  const gap = 10, cw = Math.floor((W - 56 - gap * (n - 1)) / n), x0 = 28;
  for (let i = 0; i < n; i++) {
    const key = CHAR_KEYS[i], c = CHARS[key];
    const x = x0 + i * (cw + gap), y = 86, ch = 344;
    g.fillStyle = 'rgba(9,14,30,.9)';
    rr(g, x, y, cw, ch, 8); g.fill();
    g.strokeStyle = 'rgba(244,234,214,.16)';
    rr(g, x + .5, y + .5, cw - 1, ch - 1, 8); g.stroke();
    g.fillStyle = i % 2 ? '#4b8fd8' : '#e8684a';
    g.fillRect(x, y, cw, 4);
    const p1on = sel.p1Idx === i, p2on = sel.humans > 1 && sel.p2Idx === i;
    if (p1on) { g.strokeStyle = sel.p1Done ? '#f4cf76' : '#e8684a'; g.lineWidth = 4; rr(g, x - 2, y - 2, cw + 4, ch + 4, 10); g.stroke(); }
    if (p2on) { g.strokeStyle = sel.p2Done ? '#f4cf76' : '#4b8fd8'; g.lineWidth = 4; rr(g, x + 3, y + 3, cw - 6, ch - 6, 7); g.stroke(); }
    if (sel.cpuFlash === i) { g.strokeStyle = '#9b7dd2'; g.lineWidth = 3; rr(g, x + 6, y + 6, cw - 12, ch - 12, 6); g.stroke(); }
    const pf = previews[i];
    pf.x = x + cw / 2; pf.z = y + 142;
    drawFighter(g, pf, frame, 1.25);
    g.textAlign = 'center';
    g.font = '800 19px system-ui, "PingFang TC", sans-serif';
    g.fillStyle = '#f4ead6'; g.fillText(c.name, x + cw / 2, y + 174);
    g.font = '12px system-ui, "PingFang TC", sans-serif';
    g.fillStyle = '#f4cf76'; g.fillText(c.zh, x + cw / 2, y + 194);
    // 招式表(原作指令);招多的角色(Woody 6 招)壓縮成單行
    const mvEntries = Object.entries(c.moves);
    const compact = mvEntries.length > 4;
    g.font = (compact ? '11px' : '12px') + ' system-ui, "PingFang TC", sans-serif';
    g.fillStyle = '#b9cbe4';
    let my = y + (compact ? 216 : 220);
    for (const [k, m] of mvEntries) {
      const keyTxt = '防' + (k[0] === '>' ? '→' : k[0] === '^' ? '↑' : '↓') + (k[1] === 'A' ? '攻' : '跳');
      if (compact) {
        g.fillText(`${keyTxt} ${m.name} ${m.mp}MP`, x + cw / 2, my);
        my += 19;
      } else {
        g.fillText(`${keyTxt} ${m.name}`, x + cw / 2, my);
        g.fillStyle = '#7f8ea7';
        g.fillText(`${m.mp} MP${m.hpCost ? ' + ' + m.hpCost + ' HP' : ''}`, x + cw / 2, my + 13);
        g.fillStyle = '#b9cbe4';
        my += 30;
      }
      if (my > y + ch - 8) break;
    }
    g.font = '800 12px system-ui';
    if (p1on) { g.textAlign = 'left'; g.fillStyle = '#e8684a'; g.fillText(sel.p1Done ? 'P1 READY' : 'P1', x + 12, y + 23); }
    if (p2on) { g.textAlign = 'right'; g.fillStyle = '#4b8fd8'; g.fillText(sel.p2Done ? 'P2 READY' : 'P2', x + cw - 12, y + 23); }
  }
  g.textAlign = 'center';
  g.fillStyle = 'rgba(9,14,30,.9)';
  rr(g, 176, 448, 608, 58, 7); g.fill();
  g.font = '700 15px system-ui, "PingFang TC", sans-serif';
  g.fillStyle = '#f4ead6';
  let hint;
  if (!sel.p1Done) hint = 'P1:A / D 移動游標,J 確認';
  else if (sel.humans > 1 && !sel.p2Done) hint = 'P2:← / → 移動游標,, 確認';
  else if (sel.cpuT > 0) hint = '電腦選角中…';
  else if (sel.cpuKeys.length) hint = '電腦選了 ' + sel.cpuKeys.map(k => CHARS[k].name).join('、') + ',準備開戰!';
  else hint = '準備開戰…';
  g.fillText(hint, W / 2, 472);
  g.fillStyle = 'rgba(244,234,214,.5)';
  g.font = '11px system-ui, "PingFang TC", sans-serif';
  g.fillText('A / D 移動　·　J 確認　·　Esc 返回標題', W / 2, 494);
}

function drawSelect(g, sel, frame, previews) {
  if (!skyCache) buildStage();
  g.drawImage(skyCache, 0, 0);
  g.drawImage(midCache, 0, 0);
  g.drawImage(groundCache, 0, 300);
  g.fillStyle = 'rgba(5,5,8,.78)';
  g.fillRect(0, 0, W, H);
  drawUiTexture(g, 0.54);

  cutPanel(g, 0, 0, 585, 82, '#e52b2d', 38);
  cutPanel(g, 570, 0, 390, 82, '#1657c8', 38);
  g.fillStyle = '#f7f0df';
  g.textAlign = 'left';
  g.font = '950 35px Impact, "Arial Narrow", system-ui, "PingFang TC", sans-serif';
  g.fillText('選擇你的選手', 28, 51);
  g.textAlign = 'right';
  g.font = '900 12px "Arial Narrow", system-ui, sans-serif';
  g.fillText('FIGHTER SELECT / BUILD YOUR MATCH', W - 28, 48);

  const p1 = CHARS[CHAR_KEYS[sel.p1Idx]];
  const p2idx = sel.humans > 1 ? sel.p2Idx : (sel.cpuFlash >= 0 ? sel.cpuFlash : (sel.cpuKeys.length ? CHAR_KEYS.indexOf(sel.cpuKeys[0]) : (sel.p1Idx + 2) % NCHAR));
  const p2 = CHARS[CHAR_KEYS[p2idx]];

  const drawFeature = (side, idx, fighter, color, done, tag) => {
    const left = side === 0;
    const x = left ? 22 : 604;
    cutPanel(g, x, 100, 334, 264, 'rgba(5,5,8,.94)', 26);
    g.fillStyle = color;
    g.fillRect(left ? x : x + 324, 100, 10, 264);
    const pf = previews[idx];
    const oldX = pf.x, oldZ = pf.z;
    pf.x = left ? x + 86 : x + 248;
    pf.z = 288;
    pf.facing = left ? 1 : -1;
    drawFighter(g, pf, frame, 1.85);
    pf.x = oldX;
    pf.z = oldZ;

    g.textAlign = left ? 'left' : 'right';
    const tx = left ? x + 164 : x + 170;
    g.fillStyle = '#f3c533';
    g.font = '900 10px "Arial Narrow", system-ui, sans-serif';
    g.fillText(`${tag} / ${done ? 'READY' : 'SELECTING'}`, left ? tx : x + 170, 133);
    g.fillStyle = '#f7f0df';
    g.font = '950 35px Impact, "Arial Narrow", system-ui, sans-serif';
    g.fillText(fighter.name.toUpperCase(), left ? tx : x + 170, 176);
    g.fillStyle = color;
    g.font = '900 17px "Arial Narrow", system-ui, "PingFang TC", sans-serif';
    g.fillText(fighter.zh, left ? tx : x + 170, 201);

    const entries = Object.entries(fighter.moves).slice(0, 4);
    g.fillStyle = 'rgba(247,240,223,.72)';
    g.font = '800 10px "Arial Narrow", system-ui, "PingFang TC", sans-serif';
    entries.forEach(([key, move], i) => {
      const command = '防' + (key[0] === '>' ? '→' : key[0] === '^' ? '↑' : '↓') + (key[1] === 'A' ? '攻' : '跳');
      g.fillText(`${command}  ${move.name}  ${move.mp}MP`, left ? tx : x + 170, 232 + i * 23);
    });
  };

  drawFeature(0, sel.p1Idx, p1, '#e52b2d', sel.p1Done, 'PLAYER 1');
  drawFeature(1, p2idx, p2, '#1657c8', sel.humans > 1 ? sel.p2Done : sel.cpuKeys.length > 0, sel.humans > 1 ? 'PLAYER 2' : 'CPU RIVAL');

  g.fillStyle = '#f7f0df';
  g.fillRect(0, 382, W, 110);
  const stripX = 122;
  CHAR_KEYS.forEach((key, i) => {
    const c = CHARS[key];
    const x = stripX + i * 146;
    const p1on = sel.p1Idx === i;
    const p2on = sel.humans > 1 && sel.p2Idx === i;
    g.fillStyle = p1on ? '#e52b2d' : p2on ? '#1657c8' : '#111116';
    g.fillRect(x, 396, 132, 72);
    if (sel.cpuFlash === i) {
      g.strokeStyle = '#f3c533';
      g.lineWidth = 4;
      g.strokeRect(x - 3, 393, 138, 78);
    }
    g.fillStyle = '#f7f0df';
    g.font = '950 16px Impact, "Arial Narrow", system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(c.name.toUpperCase(), x + 66, 425);
    g.fillStyle = 'rgba(247,240,223,.7)';
    g.font = '800 10px "PingFang TC", system-ui, sans-serif';
    g.fillText(c.zh, x + 66, 446);
    g.fillStyle = '#f3c533';
    g.fillRect(x + 14, 456, 104, 3);
  });

  let hint;
  if (!sel.p1Done) hint = 'P1：A / D 選人　J 確認';
  else if (sel.humans > 1 && !sel.p2Done) hint = 'P2：← / → 選人　, 確認';
  else if (sel.cpuT > 0) hint = 'CPU 選手抽選中';
  else if (sel.cpuKeys.length) hint = '對戰名單完成，準備開戰';
  else hint = '準備開戰';
  g.fillStyle = '#050507';
  g.fillRect(0, 492, W, 48);
  g.fillStyle = '#f3c533';
  g.font = '900 12px "Arial Narrow", system-ui, "PingFang TC", sans-serif';
  g.textAlign = 'center';
  g.fillText(hint, W / 2, 515);
  g.fillStyle = 'rgba(247,240,223,.58)';
  g.font = '800 9px "Arial Narrow", system-ui, sans-serif';
  g.fillText('ESC  RETURN TO TITLE', W / 2, 531);
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
