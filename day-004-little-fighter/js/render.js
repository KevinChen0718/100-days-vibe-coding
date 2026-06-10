'use strict';
// 畫面渲染 + 音效 — 所有角色與場景皆 Canvas 向量手繪,零圖片素材

/* ============ 場景(畫一次快取) ============ */
let stageCache = null;
function buildStage() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  // 黃昏天空
  const sky = g.createLinearGradient(0, 0, 0, 310);
  sky.addColorStop(0, '#2b1c4e'); sky.addColorStop(0.55, '#a14a3e'); sky.addColorStop(1, '#e8a04c');
  g.fillStyle = sky; g.fillRect(0, 0, W, 310);
  // 夕陽
  const sun = g.createRadialGradient(700, 280, 10, 700, 280, 120);
  sun.addColorStop(0, 'rgba(255,230,160,.95)'); sun.addColorStop(0.3, 'rgba(255,190,110,.55)'); sun.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = sun; g.beginPath(); g.arc(700, 280, 120, 0, 7); g.fill();
  g.fillStyle = '#ffe9b8'; g.beginPath(); g.arc(700, 280, 34, 0, 7); g.fill();
  // 遠山兩層
  g.fillStyle = '#4a2d4e';
  g.beginPath(); g.moveTo(0, 310);
  for (let x = 0; x <= W; x += 40) g.lineTo(x, 268 + Math.sin(x * 0.013) * 22 + Math.sin(x * 0.031) * 10);
  g.lineTo(W, 310); g.fill();
  g.fillStyle = '#5d3a44';
  g.beginPath(); g.moveTo(0, 310);
  for (let x = 0; x <= W; x += 30) g.lineTo(x, 288 + Math.sin(x * 0.02 + 2) * 14);
  g.lineTo(W, 310); g.fill();
  // 樹剪影
  const tree = (x, y, s) => {
    g.fillStyle = '#33232e';
    g.fillRect(x - 2 * s, y - 14 * s, 4 * s, 14 * s);
    g.beginPath(); g.arc(x, y - 20 * s, 11 * s, 0, 7); g.fill();
    g.beginPath(); g.arc(x - 8 * s, y - 13 * s, 7 * s, 0, 7); g.fill();
    g.beginPath(); g.arc(x + 8 * s, y - 13 * s, 7 * s, 0, 7); g.fill();
  };
  tree(90, 312, 1.5); tree(180, 308, 1.0); tree(870, 310, 1.7); tree(795, 306, 0.9);
  // 草地
  const gr = g.createLinearGradient(0, 300, 0, H);
  gr.addColorStop(0, '#8aa353'); gr.addColorStop(1, '#46602f');
  g.fillStyle = gr; g.fillRect(0, 300, W, H - 300);
  // 縱深線與草叢(固定亂數)
  g.strokeStyle = 'rgba(255,255,255,.05)';
  for (let i = 0; i < 6; i++) {
    g.beginPath(); g.moveTo(0, 330 + i * 38); g.lineTo(W, 330 + i * 38); g.stroke();
  }
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W, y = 312 + rnd() * 215, s = 0.6 + (y - 312) / 215;
    g.strokeStyle = `rgba(40,70,25,${0.25 + rnd() * 0.3})`;
    g.lineWidth = 1.5 * s;
    for (let b = -1; b <= 1; b++) {
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + b * 3 * s, y - 4 * s, x + b * 5 * s, y - 8 * s); g.stroke();
    }
  }
  return c;
}

/* ============ 角色繪製 ============ */
function poseOf(f, frame) {
  const t = f.stateTimer;
  const p = { legF: 0.16, legB: -0.16, armF: 0.45, armB: -0.3, lean: 0,
              crouch: 0, armFLen: 18, armBLen: 18, rot: 0, bob: 0, kick: 0 };
  switch (f.state) {
    case 'idle': p.bob = Math.sin(frame * 0.09 + f.pid * 2) * 1.6; p.armF = 0.55 + Math.sin(frame * 0.09) * 0.05; break;
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
    case 'jumpattack': p.kick = 1; p.legF = 1.45; p.legB = -0.5; p.lean = 0.22; p.armF = 1.0; p.armB = -0.8; break;
    case 'uppercut': p.armF = 3.0; p.armFLen = 26; p.lean = -0.12; p.legF = 0.7; p.legB = -0.5; break;
    case 'spinkick': { const s = Math.sin(t * 0.9);
      p.kick = 1; p.legF = 1.4 + s * 0.25; p.legB = -0.3; p.lean = 0.15; p.armF = 1.8; p.armB = -1.2; break; }
    case 'cast': { const k = Math.min(1, t / 10);
      p.armF = 1.5 * k; p.armB = 1.4 * k; p.armFLen = 24; p.armBLen = 24; p.lean = 0.1; break; }
    case 'defend': p.armF = 1.15; p.armB = 0.95; p.armFLen = 13; p.armBLen = 13; p.crouch = 4; p.lean = 0.06; break;
    case 'hurt': p.lean = -0.3; p.armF = 2.0; p.armB = -1.2; p.legF = 0.4; break;
    case 'fall': p.rot = -Math.min(1.35, t * 0.09); p.armF = 2.2; p.armB = -1.6; p.legF = 0.8; p.legB = -0.4; break;
    case 'lying': p.rot = -1.45; p.armF = 0.4; p.armB = -0.3; p.legF = 0.25; p.legB = -0.1; break;
    case 'frozen': p.armF = 0.6; p.armB = -0.4; break;
    case 'win': p.armF = 2.9; p.bob = -Math.abs(Math.sin(t * 0.18)) * 7; p.armB = -0.5; break;
  }
  return p;
}
function atkProg(t, a0, a1) { return Math.max(0, Math.min(1, (t - a0 + 3) / (a1 - a0 + 2))); }

function drawFighter(g, f, frame, scale = 1) {
  const c = f.c;
  const p = poseOf(f, frame);
  const flash = f.hitFlash > 0;
  const col = (x) => flash ? '#ffffff' : x;
  g.save();
  g.translate(f.x, f.z - f.y);
  if (f.invuln > 0 && Math.floor(frame / 4) % 2 === 0) g.globalAlpha = 0.45;
  g.scale(f.facing * scale, scale);
  if (p.rot) { g.translate(0, f.state === 'lying' ? -9 : -26); g.rotate(p.rot); g.translate(0, f.state === 'lying' ? 9 : 26); }
  g.translate(0, p.bob + p.crouch);
  g.rotate(p.lean * 0.5);

  g.lineCap = 'round';
  const limb = (x0, y0, ang, len, wdt, color) => {
    const x1 = x0 + Math.sin(ang) * len, y1 = y0 + Math.cos(ang) * len;
    g.strokeStyle = col(color); g.lineWidth = wdt;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    return [x1, y1];
  };
  // 後手
  let e = limb(-3, -40, p.armB, p.armBLen, 7, c.shirt);
  g.fillStyle = col(c.skin); g.beginPath(); g.arc(e[0], e[1], 4.2, 0, 7); g.fill();
  // 後腳
  e = limb(-2, -27, p.legB, 26, 8, c.pants);
  g.fillStyle = col(c.shoes); g.beginPath(); g.ellipse(e[0] + 2, e[1], 6.5, 4, 0, 0, 7); g.fill();
  // 前腳(踢擊時伸直加長)
  e = limb(2, -27, p.legF, p.kick ? 30 : 26, 8.5, c.pants);
  g.fillStyle = col(c.shoes); g.beginPath(); g.ellipse(e[0] + 2, e[1], 6.5, 4, 0, 0, 7); g.fill();
  // 軀幹
  g.fillStyle = col(c.shirt);
  rr(g, -9, -46, 18, 22, 6); g.fill();
  g.fillStyle = 'rgba(0,0,0,.12)'; rr(g, -9, -30, 18, 6, 3); g.fill(); // 腰帶陰影
  // 頭
  const hx = 1.5 + p.lean * 6, hy = -57;
  g.fillStyle = col(c.skin); g.beginPath(); g.arc(hx, hy, 13, 0, 7); g.fill();
  drawHair(g, c, hx, hy, col);
  if (c.band) { g.fillStyle = col(c.band); g.fillRect(hx - 13, hy - 7, 26, 4.5); }
  // 臉(KO 畫 X 眼)
  const ko = f.hp <= 0, ouch = f.state === 'hurt' || f.state === 'fall';
  g.strokeStyle = '#3a2a20'; g.fillStyle = '#3a2a20'; g.lineWidth = 1.6;
  if (ko) {
    xEye(g, hx + 7, hy - 1); xEye(g, hx + 1, hy - 1);
  } else if (ouch) {
    g.beginPath(); g.moveTo(hx + 5, hy - 3); g.lineTo(hx + 9, hy - 1); g.stroke();
    g.beginPath(); g.moveTo(hx + 3, hy - 3); g.lineTo(hx - 1, hy - 1); g.stroke();
    g.beginPath(); g.arc(hx + 4, hy + 5, 2.5, 0, 7); g.fill(); // 喊痛嘴
  } else {
    g.beginPath(); g.arc(hx + 7.5, hy - 1, 1.7, 0, 7); g.fill();
    g.beginPath(); g.arc(hx + 1.5, hy - 1, 1.7, 0, 7); g.fill();
    g.beginPath(); g.moveTo(hx + 3, hy + 5.5); g.lineTo(hx + 8, hy + 5.5); g.stroke();
  }
  // 前手
  e = limb(3, -40, p.armF, p.armFLen, 7.5, c.shirt);
  g.fillStyle = col(c.skin); g.beginPath(); g.arc(e[0], e[1], 4.6, 0, 7); g.fill();

  // 冰塊
  if (f.state === 'frozen') {
    g.globalAlpha = 0.55; g.fillStyle = '#a8d8f8';
    rr(g, -21, -78, 42, 82, 9); g.fill();
    g.globalAlpha = 0.9; g.strokeStyle = '#e8f6ff'; g.lineWidth = 2;
    rr(g, -21, -78, 42, 82, 9); g.stroke();
    g.beginPath(); g.moveTo(-10, -70); g.lineTo(-2, -50); g.lineTo(-8, -30); g.stroke();
    g.globalAlpha = 1;
  }
  g.restore();
}
function xEye(g, x, y) {
  g.beginPath(); g.moveTo(x - 2.4, y - 2.4); g.lineTo(x + 2.4, y + 2.4);
  g.moveTo(x + 2.4, y - 2.4); g.lineTo(x - 2.4, y + 2.4); g.stroke();
}
function drawHair(g, c, hx, hy, col) {
  g.fillStyle = col(c.hair);
  if (c.hairKind === 'spiky') {
    g.beginPath(); g.arc(hx - 1, hy - 3, 13, Math.PI * 0.85, Math.PI * 2.06);
    g.fill();
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
  } else { // buzz
    g.beginPath(); g.arc(hx - 0.5, hy - 4, 12.2, Math.PI * 0.95, Math.PI * 1.98); g.fill();
  }
}
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/* ============ 彈幕 ============ */
function drawProj(g, p, frame) {
  const sy = p.z - p.y;
  g.save(); g.translate(p.x, sy);
  if (p.kind === 'blast') {
    const gl = g.createRadialGradient(0, 0, 2, 0, 0, 16);
    gl.addColorStop(0, '#ffffff'); gl.addColorStop(0.45, '#8df0ff'); gl.addColorStop(1, 'rgba(80,200,255,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill();
    g.strokeStyle = 'rgba(170,240,255,.6)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-Math.sign(p.vx) * 14, -4); g.lineTo(-Math.sign(p.vx) * 26, -4); g.stroke();
    g.beginPath(); g.moveTo(-Math.sign(p.vx) * 14, 4); g.lineTo(-Math.sign(p.vx) * 26, 4); g.stroke();
  } else if (p.kind === 'fire') {
    const r = p.small ? 8 : 12, fl = Math.sin(frame * 0.6 + p.seed) * 3;
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
  }
  g.restore();
}

/* ============ HUD ============ */
function drawHUD(g, eng) {
  for (const f of eng.fighters) {
    const left = f.pid === 0;
    const bx = left ? 24 : W - 24 - 330;
    // 名牌
    g.fillStyle = 'rgba(20,16,24,.72)';
    rr(g, bx - 6, 14, 342, 64, 8); g.fill();
    // 頭像
    g.save(); g.beginPath(); g.arc(bx + 24, 46, 21, 0, 7); g.clip();
    g.fillStyle = '#5a4a66'; g.fillRect(bx + 3, 25, 42, 42);
    g.fillStyle = f.c.skin; g.beginPath(); g.arc(bx + 24, 50, 14, 0, 7); g.fill();
    g.fillStyle = f.c.hair; g.beginPath(); g.arc(bx + 24, 44, 14, Math.PI * 0.9, Math.PI * 2.1); g.fill();
    g.fillStyle = '#3a2a20';
    g.beginPath(); g.arc(bx + 19, 51, 1.6, 0, 7); g.fill();
    g.beginPath(); g.arc(bx + 29, 51, 1.6, 0, 7); g.fill();
    g.restore();
    g.strokeStyle = f.pid === 0 ? '#e85d4a' : '#4a90e8'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(bx + 24, 46, 21, 0, 7); g.stroke();
    // 名字
    g.fillStyle = '#fff'; g.font = 'bold 16px system-ui, "PingFang TC", sans-serif';
    g.textAlign = left ? 'left' : 'right';
    g.fillText(`${f.c.name} ${f.c.en}`, left ? bx + 54 : bx + 330, 32);
    // HP(含暗紅可回復段)
    const bw = 270, hx = left ? bx + 54 : bx + 60;
    g.fillStyle = '#241a1a'; rr(g, hx, 40, bw, 13, 4); g.fill();
    const rec = Math.max(0, f.hpRec / HP_MAX), hp = Math.max(0, f.hp / HP_MAX);
    g.fillStyle = '#7a2a24';
    if (rec > 0) { rr(g, left ? hx : hx + bw * (1 - rec), 40, bw * rec, 13, 4); g.fill(); }
    g.fillStyle = hp > 0.3 ? '#e8493c' : '#ff2d18';
    if (hp > 0) { rr(g, left ? hx : hx + bw * (1 - hp), 40, bw * hp, 13, 4); g.fill(); }
    // MP
    g.fillStyle = '#161c28'; rr(g, hx, 58, bw, 9, 3); g.fill();
    const mp = f.mp / MP_MAX;
    g.fillStyle = '#3f8fe8';
    if (mp > 0) { rr(g, left ? hx : hx + bw * (1 - mp), 58, bw * mp, 9, 3); g.fill(); }
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
  if (!stageCache) stageCache = buildStage();
  g.save();
  if (eng.shake > 0) g.translate((Math.random() - 0.5) * eng.shake * 2, (Math.random() - 0.5) * eng.shake);
  g.drawImage(stageCache, 0, 0);

  // 影子
  for (const f of eng.fighters) {
    g.fillStyle = 'rgba(0,0,0,.28)';
    const r = Math.max(8, 17 - f.y * 0.06);
    g.beginPath(); g.ellipse(f.x, f.z + 3, r, r * 0.32, 0, 0, 7); g.fill();
  }
  for (const p of eng.projs) {
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.beginPath(); g.ellipse(p.x, p.z + 3, 9, 3, 0, 0, 7); g.fill();
  }
  // 依縱深排序繪製
  const ents = [
    ...eng.fighters.map(f => ({ z: f.z, d: () => drawFighter(g, f, frame) })),
    ...eng.projs.map(p => ({ z: p.z, d: () => drawProj(g, p, frame) })),
  ].sort((a, b) => a.z - b.z);
  for (const e of ents) e.d();

  // 粒子
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
    } else { // dust
      g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.size * 1.5 * a, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }
  drawHUD(g, eng);
  drawBanner(g, eng, frame);

  if (eng.over && eng.winner) {
    g.fillStyle = 'rgba(12,8,16,.55)'; g.fillRect(0, H / 2 - 4, W, 130);
    g.textAlign = 'center';
    g.fillStyle = '#ffd23e'; g.font = 'bold 40px system-ui, "PingFang TC", sans-serif';
    g.fillText(`${eng.winner.c.name} 獲勝!`, W / 2, H / 2 + 46);
    g.fillStyle = '#e8e0d0'; g.font = '17px system-ui, "PingFang TC", sans-serif';
    g.fillText('R — 再戰一場      Enter — 重選角色', W / 2, H / 2 + 86);
  }
  g.restore();
}

/* ============ 標題畫面 ============ */
function drawTitle(g, frame, demoFighters) {
  if (!stageCache) stageCache = buildStage();
  g.drawImage(stageCache, 0, 0);
  g.fillStyle = 'rgba(15,8,20,.45)'; g.fillRect(0, 0, W, H);

  for (const f of demoFighters) drawFighter(g, f, frame, 1.35);

  g.textAlign = 'center';
  g.font = '900 76px system-ui, "PingFang TC", sans-serif';
  g.lineWidth = 12; g.strokeStyle = '#2a1408';
  g.strokeText('小朋友齊打交', W / 2, 150);
  const grad = g.createLinearGradient(0, 90, 0, 160);
  grad.addColorStop(0, '#ffe98a'); grad.addColorStop(1, '#ff7a2f');
  g.fillStyle = grad; g.fillText('小朋友齊打交', W / 2, 150);
  g.font = 'bold 22px system-ui, "PingFang TC", sans-serif';
  g.fillStyle = '#ffe9c8';
  g.fillText('致敬復刻版 — Little Fighters Tribute', W / 2, 192);

  if (Math.floor(frame / 30) % 2 === 0) {
    g.font = 'bold 26px system-ui, "PingFang TC", sans-serif';
    g.fillStyle = '#ffffff';
    g.fillText('按 1 — 單人挑戰電腦      按 2 — 雙人對戰', W / 2, 300);
  }
  g.font = '15px system-ui, "PingFang TC", sans-serif';
  g.fillStyle = 'rgba(255,240,220,.85)';
  g.fillText('P1:WASD 移動 / J 攻擊 / K 跳躍 / L 防禦        P2:方向鍵移動 / , 攻擊 / . 跳躍 / / 防禦', W / 2, 460);
  g.fillText('必殺技:防→前→攻(飛行道具)    防→上→攻(絕招)    雙擊方向 = 跑步', W / 2, 488);
  g.fillStyle = 'rgba(255,240,220,.5)';
  g.fillText('純手繪 Canvas 致敬之作,與原作《Little Fighter 2》無關', W / 2, 522);
}

/* ============ 選角畫面 ============ */
function drawSelect(g, sel, frame, previews) {
  if (!stageCache) stageCache = buildStage();
  g.drawImage(stageCache, 0, 0);
  g.fillStyle = 'rgba(15,8,20,.55)'; g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.font = '900 40px system-ui, "PingFang TC", sans-serif';
  g.fillStyle = '#ffe9c8'; g.fillText('選擇你的小朋友', W / 2, 64);

  const cw = 200, gap = 26, total = cw * 4 + gap * 3, x0 = (W - total) / 2;
  for (let i = 0; i < 4; i++) {
    const key = CHAR_KEYS[i], c = CHARS[key];
    const x = x0 + i * (cw + gap), y = 100, ch = 300;
    g.fillStyle = 'rgba(28,20,36,.85)';
    rr(g, x, y, cw, ch, 12); g.fill();
    // 游標框
    const p1on = sel.p1Idx === i, p2on = sel.p2Idx === i;
    if (p1on) { g.strokeStyle = sel.p1Done ? '#ffd23e' : '#e85d4a'; g.lineWidth = 4; rr(g, x - 3, y - 3, cw + 6, ch + 6, 14); g.stroke(); }
    if (p2on) { g.strokeStyle = sel.p2Done ? '#ffd23e' : '#4a90e8'; g.lineWidth = 4; rr(g, x + 3, y + 3, cw - 6, ch - 6, 10); g.stroke(); }
    // 角色預覽
    const pf = previews[i];
    pf.x = x + cw / 2; pf.z = y + 175;
    drawFighter(g, pf, frame, 1.5);
    g.font = 'bold 22px system-ui, "PingFang TC", sans-serif';
    g.fillStyle = '#fff'; g.fillText(`${c.name} ${c.en}`, x + cw / 2, y + 215);
    g.font = '14px system-ui, "PingFang TC", sans-serif';
    g.fillStyle = '#d8c8a8'; g.fillText(c.title, x + cw / 2, y + 238);
    g.fillStyle = '#a8c8e8';
    g.fillText(`波:${c.proj.name} ${c.proj.mp}MP`, x + cw / 2, y + 264);
    g.fillText(`絕:${c.spec2.name} ${c.spec2.mp}MP`, x + cw / 2, y + 284);
    // P1/P2 標籤
    g.font = 'bold 15px system-ui';
    if (p1on) { g.fillStyle = '#e85d4a'; g.fillText(sel.p1Done ? 'P1 ✓' : 'P1', x + 26, y + 24); }
    if (p2on) { g.fillStyle = '#4a90e8'; g.fillText(sel.p2Done ? (sel.vsAI ? 'CPU ✓' : 'P2 ✓') : (sel.vsAI ? 'CPU' : 'P2'), x + cw - 30, y + 24); }
  }
  g.font = '17px system-ui, "PingFang TC", sans-serif';
  g.fillStyle = 'rgba(255,240,220,.9)';
  const hint = sel.vsAI
    ? (sel.p1Done ? '電腦選角中…' : 'P1:A / D 移動游標,J 確認')
    : `${!sel.p1Done ? 'P1:A / D 移動,J 確認' : ''}${!sel.p1Done && !sel.p2Done ? '      ' : ''}${!sel.p2Done ? 'P2:← / → 移動,, 確認' : ''}`;
  g.fillText(hint || '準備開戰…', W / 2, 470);
  g.fillStyle = 'rgba(255,240,220,.5)';
  g.font = '14px system-ui, "PingFang TC", sans-serif';
  g.fillText('Esc — 回到標題', W / 2, 502);
}

/* ============ 音效(WebAudio 即時生成,零音檔) ============ */
const SFX = {
  ctx: null, master: null,
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
    const t = this.ctx.currentTime + delay;
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
    const t = this.ctx.currentTime + delay;
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
      case 'hit': this.noise(0.07, 'lowpass', 900, 300, 0.7); this.osc('square', 160, 70, 0.08, 0.4); break;
      case 'block': this.noise(0.05, 'highpass', 2500, 4000, 0.25); break;
      case 'thud': this.osc('sine', 95, 45, 0.14, 0.7); this.noise(0.1, 'lowpass', 500, 150, 0.5); break;
      case 'jump': this.osc('sine', 220, 430, 0.07, 0.12); break;
      case 'cast': this.osc('sawtooth', 180, 640, 0.13, 0.25); break;
      case 'shoot': this.osc('square', 320, 760, 0.1, 0.3); this.noise(0.08, 'bandpass', 1200, 2400, 0.2); break;
      case 'fire': this.noise(0.28, 'lowpass', 1400, 400, 0.5); this.osc('sawtooth', 140, 60, 0.25, 0.2); break;
      case 'ice': this.osc('triangle', 900, 1500, 0.09, 0.22); this.osc('triangle', 1200, 1900, 0.09, 0.18, 0.05); break;
      case 'freezeHit': this.osc('triangle', 1400, 500, 0.16, 0.3); this.noise(0.1, 'highpass', 3000, 5000, 0.2); break;
      case 'shatter': this.noise(0.16, 'highpass', 2400, 5500, 0.45); this.osc('triangle', 1800, 600, 0.12, 0.2); break;
      case 'ko': this.osc('sawtooth', 420, 70, 0.55, 0.5); this.noise(0.4, 'lowpass', 1000, 200, 0.5); break;
      case 'select': this.osc('square', 520, 660, 0.05, 0.15); break;
      case 'confirm': this.osc('square', 520, 780, 0.07, 0.2); this.osc('square', 780, 1040, 0.08, 0.2, 0.07); break;
    }
  },
};
