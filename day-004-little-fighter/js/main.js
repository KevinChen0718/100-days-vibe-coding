'use strict';
// 主程式 — 鍵盤輸入、畫面流程(標題/選角/戰鬥)、60FPS 固定步進迴圈

const cv = document.getElementById('game');
const g = cv.getContext('2d');

let screen = 'title';
let eng = null;
let paused = false;
let gframe = 0;

const sel = { vsAI: true, p1Idx: 0, p2Idx: 3, p1Done: false, p2Done: false, aiT: 0, startT: 0 };

// 標題示範角色與選角預覽
const demoFighters = [new Fighter('dan', 330, 1, 0), new Fighter('blaze', 630, -1, 1)];
demoFighters.forEach(f => { f.z = 415; });
const previews = CHAR_KEYS.map((k, i) => {
  const f = new Fighter(k, 0, 1, i % 2);
  f.pid = i; return f;
});

// 鍵位:code → [玩家, 動作]
const KEYMAP = {
  KeyW: [0, 'up'], KeyA: [0, 'left'], KeyS: [0, 'down'], KeyD: [0, 'right'],
  KeyJ: [0, 'atk'], KeyK: [0, 'jump'], KeyL: [0, 'def'],
  ArrowUp: [1, 'up'], ArrowLeft: [1, 'left'], ArrowDown: [1, 'down'], ArrowRight: [1, 'right'],
  Comma: [1, 'atk'], Period: [1, 'jump'], Slash: [1, 'def'],
};

function fightKey(pid, act, down) {
  if (!eng) return;
  const f = eng.fighters[pid];
  if (f.isAI) return;
  const inp = f.input;
  if (act === 'atk') { if (down) inp.atkE = 1; return; }
  if (act === 'jump') { if (down) inp.jumpE = 1; return; }
  if (act === 'def') {
    inp.def = down ? 1 : 0;
    if (down) inp.seq.push({ k: 'def', f: eng.frame });
    return;
  }
  inp[act] = down ? 1 : 0;
  if (down) {
    inp.seq.push({ k: act, f: eng.frame });
    if (act === 'left') inp.leftE = 1;
    if (act === 'right') inp.rightE = 1;
  }
}

function startFight() {
  eng = new Engine(CHAR_KEYS[sel.p1Idx], CHAR_KEYS[sel.p2Idx], { p2AI: sel.vsAI });
  eng.sfx = n => SFX.play(n);
  paused = false;
  screen = 'fight';
}

function resetSelect(vsAI) {
  sel.vsAI = vsAI;
  sel.p1Done = sel.p2Done = false;
  sel.aiT = 0; sel.startT = 0;
  screen = 'select';
}

window.addEventListener('keydown', e => {
  if (e.repeat) return;
  SFX.init();
  const mapped = KEYMAP[e.code];
  if (mapped || ['Enter', 'Escape', 'Space'].includes(e.code)) e.preventDefault();

  if (screen === 'title') {
    if (e.code === 'Digit1' || e.code === 'Numpad1') { SFX.play('confirm'); resetSelect(true); }
    if (e.code === 'Digit2' || e.code === 'Numpad2') { SFX.play('confirm'); resetSelect(false); }
    return;
  }
  if (screen === 'select') {
    if (e.code === 'Escape') { screen = 'title'; return; }
    if (!sel.p1Done) {
      if (e.code === 'KeyA') { sel.p1Idx = (sel.p1Idx + 3) % 4; SFX.play('select'); }
      if (e.code === 'KeyD') { sel.p1Idx = (sel.p1Idx + 1) % 4; SFX.play('select'); }
      if (e.code === 'KeyJ') { sel.p1Done = true; SFX.play('confirm'); }
    }
    if (!sel.vsAI && !sel.p2Done) {
      if (e.code === 'ArrowLeft') { sel.p2Idx = (sel.p2Idx + 3) % 4; SFX.play('select'); }
      if (e.code === 'ArrowRight') { sel.p2Idx = (sel.p2Idx + 1) % 4; SFX.play('select'); }
      if (e.code === 'Comma') { sel.p2Done = true; SFX.play('confirm'); }
    }
    return;
  }
  // fight
  if (e.code === 'KeyP') { paused = !paused; return; }
  if (e.code === 'Escape') { screen = 'title'; eng = null; return; }
  if (eng && eng.over) {
    if (e.code === 'KeyR') { SFX.play('confirm'); startFight(); return; }
    if (e.code === 'Enter') { SFX.play('confirm'); resetSelect(sel.vsAI); return; }
  }
  if (mapped && !paused) fightKey(mapped[0], mapped[1], true);
});

window.addEventListener('keyup', e => {
  const mapped = KEYMAP[e.code];
  if (mapped && screen === 'fight') fightKey(mapped[0], mapped[1], false);
});

function stepOnce() {
  gframe++;
  if (screen === 'title') {
    for (const f of demoFighters) f.stateTimer++;
    return;
  }
  if (screen === 'select') {
    for (const f of previews) f.stateTimer++;
    // 電腦選角小動畫
    if (sel.vsAI && sel.p1Done && !sel.p2Done) {
      sel.aiT++;
      if (sel.aiT % 7 === 0 && sel.aiT < 42) { sel.p2Idx = Math.floor(Math.random() * 4); SFX.play('select'); }
      if (sel.aiT >= 48) { sel.p2Done = true; SFX.play('confirm'); }
    }
    if (sel.p1Done && sel.p2Done) {
      sel.startT++;
      if (sel.startT > 34) startFight();
    }
    return;
  }
  if (screen === 'fight' && eng && !paused) eng.step();
}

let last = performance.now(), acc = 0;
const STEP = 1000 / 60;
function loop(now) {
  acc += Math.min(60, now - last);
  last = now;
  while (acc >= STEP) { stepOnce(); acc -= STEP; }

  if (screen === 'title') drawTitle(g, gframe, demoFighters);
  else if (screen === 'select') drawSelect(g, sel, gframe, previews);
  else if (screen === 'fight' && eng) {
    drawFight(g, eng, gframe);
    if (paused) {
      g.fillStyle = 'rgba(10,6,14,.55)'; g.fillRect(0, 0, W, H);
      g.textAlign = 'center'; g.fillStyle = '#fff';
      g.font = 'bold 40px system-ui, "PingFang TC", sans-serif';
      g.fillText('暫停', W / 2, H / 2);
      g.font = '17px system-ui, "PingFang TC", sans-serif';
      g.fillText('P — 繼續    Esc — 回標題', W / 2, H / 2 + 44);
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
