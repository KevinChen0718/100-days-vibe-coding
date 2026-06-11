'use strict';
// 主程式 — 鍵盤輸入、畫面流程(標題/選角/戰鬥)、60FPS 固定步進迴圈

const cv = document.getElementById('game');
const g = cv.getContext('2d');

let screen = 'title';
let eng = null;
let paused = false;
let gframe = 0;
let lastSpecs = null;

// mode:1 單人 1v1 / 2 雙人 1v1 / 3 單人 2v2 / 4 雙人 2v2
const sel = { mode: 1, humans: 1, p1Idx: 0, p2Idx: 3, p1Done: false, p2Done: false,
              cpuT: 0, cpuFlash: -1, cpuKeys: [], startT: 0 };

// 標題示範角色與選角預覽
const demoFighters = [
  new Fighter('davis', 150, 1, 0, 0), new Fighter('firen', 810, -1, 1, 1),
];
demoFighters.forEach(f => { f.z = 470; });
const previews = CHAR_KEYS.map((k, i) => new Fighter(k, 0, 1, i, i % 2));
const NCHAR = CHAR_KEYS.length;

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
  if (!f || f.isAI) return;
  const inp = f.input;
  if (act === 'atk') { if (down) inp.atkE = 1; return; }
  if (act === 'jump') { inp.jump = down ? 1 : 0; if (down) inp.jumpE = 1; return; }
  if (act === 'def') {
    inp.def = down ? 1 : 0;
    if (down) inp.seq.push({ k: 'def', f: eng.frame });
    return;
  }
  inp[act] = down ? 1 : 0;
  if (down) {
    inp.seq.push({ k: act, f: eng.frame }); // 上下左右都進搓招序列(防+下+跳 這類指令要用)
    if (act === 'left') inp.leftE = 1;
    if (act === 'right') inp.rightE = 1;
  }
}

// 依模式組出場名單(玩家固定排前面,fightKey 靠 index 對應)
function buildSpecs() {
  const p1 = CHAR_KEYS[sel.p1Idx], p2 = CHAR_KEYS[sel.p2Idx];
  const cpu = i => sel.cpuKeys[i];
  switch (sel.mode) {
    case 1: return [{ key: p1, team: 0 }, { key: cpu(0), team: 1, isAI: true }];
    case 2: return [{ key: p1, team: 0 }, { key: p2, team: 1 }];
    case 3: return [{ key: p1, team: 0 }, { key: cpu(0), team: 0, isAI: true },
                    { key: cpu(1), team: 1, isAI: true }, { key: cpu(2), team: 1, isAI: true }];
    case 4: return [{ key: p1, team: 0 }, { key: p2, team: 0 },
                    { key: cpu(0), team: 1, isAI: true }, { key: cpu(1), team: 1, isAI: true }];
  }
}
const cpuCount = () => ({ 1: 1, 2: 0, 3: 3, 4: 2 }[sel.mode]);

function startFight(specs) {
  lastSpecs = specs;
  eng = new Engine(specs, { seed: (Date.now() % 100000) + 7 });
  eng.sfx = n => { SFX.play(n); if (n === 'ko') SFX.bgmStop(); };
  paused = false;
  screen = 'fight';
  SFX.bgmStart();
}

function resetSelect(mode) {
  sel.mode = mode;
  sel.humans = (mode === 2 || mode === 4) ? 2 : 1;
  sel.p1Done = sel.p2Done = false;
  sel.cpuT = 0; sel.cpuFlash = -1; sel.cpuKeys = [];
  sel.startT = 0;
  screen = 'select';
  SFX.bgmStop();
}

window.addEventListener('keydown', e => {
  if (e.repeat) return;
  SFX.init();
  const mapped = KEYMAP[e.code];
  if (mapped || ['Enter', 'Escape', 'Space'].includes(e.code)) e.preventDefault();

  if (e.code === 'KeyM') { // 音樂開關(戰鬥中才有 BGM)
    if (SFX.bgmOn) SFX.bgmStop();
    else if (screen === 'fight' && !paused && !(eng && eng.over)) SFX.bgmStart();
    return;
  }

  if (screen === 'title') {
    const m = { Digit1: 1, Numpad1: 1, Digit2: 2, Numpad2: 2, Digit3: 3, Numpad3: 3, Digit4: 4, Numpad4: 4 }[e.code];
    if (m) { SFX.play('confirm'); resetSelect(m); }
    return;
  }
  if (screen === 'select') {
    if (e.code === 'Escape') { screen = 'title'; return; }
    if (!sel.p1Done) {
      if (e.code === 'KeyA') { sel.p1Idx = (sel.p1Idx + NCHAR - 1) % NCHAR; SFX.play('select'); }
      if (e.code === 'KeyD') { sel.p1Idx = (sel.p1Idx + 1) % NCHAR; SFX.play('select'); }
      if (e.code === 'KeyJ') { sel.p1Done = true; SFX.play('confirm'); }
    }
    if (sel.humans > 1 && !sel.p2Done) {
      if (e.code === 'ArrowLeft') { sel.p2Idx = (sel.p2Idx + NCHAR - 1) % NCHAR; SFX.play('select'); }
      if (e.code === 'ArrowRight') { sel.p2Idx = (sel.p2Idx + 1) % NCHAR; SFX.play('select'); }
      if (e.code === 'Comma') { sel.p2Done = true; SFX.play('confirm'); }
    }
    return;
  }
  // fight
  if (e.code === 'KeyP') {
    paused = !paused;
    if (paused) SFX.bgmStop(); else if (!(eng && eng.over)) SFX.bgmStart();
    return;
  }
  if (e.code === 'Escape') { screen = 'title'; eng = null; SFX.bgmStop(); return; }
  if (eng && eng.over) {
    if (e.code === 'KeyR') { SFX.play('confirm'); startFight(lastSpecs); return; }
    if (e.code === 'Enter') { SFX.play('confirm'); resetSelect(sel.mode); return; }
  }
  if (mapped && !paused) fightKey(mapped[0], mapped[1], true);
});

window.addEventListener('keyup', e => {
  const mapped = KEYMAP[e.code];
  if (mapped && screen === 'fight') fightKey(mapped[0], mapped[1], false);
});

function humansDone() { return sel.p1Done && (sel.humans < 2 || sel.p2Done); }

function stepOnce() {
  gframe++;
  if (screen === 'title') {
    for (const f of demoFighters) f.stateTimer++;
    return;
  }
  if (screen === 'select') {
    for (const f of previews) f.stateTimer++;
    if (humansDone() && sel.cpuKeys.length < cpuCount()) {
      // 電腦選角小動畫:輪盤閃幾下,逐一定下來
      sel.cpuT++;
      if (sel.cpuT % 6 === 0) { sel.cpuFlash = Math.floor(Math.random() * NCHAR); SFX.play('select'); }
      if (sel.cpuT >= 30) {
        sel.cpuKeys.push(CHAR_KEYS[Math.floor(Math.random() * NCHAR)]);
        sel.cpuT = 0; sel.cpuFlash = -1; SFX.play('confirm');
      }
    } else if (humansDone() && sel.cpuKeys.length >= cpuCount()) {
      sel.cpuT = 0; sel.cpuFlash = -1;
      sel.startT++;
      if (sel.startT > 40) startFight(buildSpecs());
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
