'use strict';
// 簡易 AI — 跟玩家用同一套輸入介面(填 f.input),不開外掛
// 行為:對齊縱深 → 接近 → 連打,偶爾防禦/跳/搓必殺,看到飛行道具會閃

function aiAct(eng, f) {
  const inp = f.input;
  inp.left = inp.right = inp.up = inp.down = inp.def = 0;
  if (f.busy) return; // 出招/受擊中不用思考
  if (f.aiCool > 0) f.aiCool--;

  const e = eng.enemyOf(f);
  const dx = e.x - f.x, adx = Math.abs(dx), dz = e.z - f.z;
  const R = () => Math.random();

  // 偶爾換一個縱深偏移,走位不要像木頭
  if (--f.aiZoffT <= 0) { f.aiZoff = (R() - 0.5) * 30; f.aiZoffT = 90 + R() * 120; }

  // 1. 躲飛行道具:有彈接近且縱深對齊 → 上下閃或防禦
  for (const p of eng.projs) {
    if (p.owner === f.pid) continue;
    const coming = Math.sign(f.x - p.x) === Math.sign(p.vx);
    if (!coming || Math.abs(p.x - f.x) > 240 || Math.abs(p.z - f.z) > 34) continue;
    if (Math.abs(p.x - f.x) < 110 && R() < 0.5) { inp.def = 1; f.facing = Math.sign(p.x - f.x) || f.facing; return; }
    if (f.z < (315 + 515) / 2) inp.down = 1; else inp.up = 1;
    return;
  }

  // 2. 對手倒地 → 拉開一點距離等他起來
  if (e.state === 'lying' || e.invuln > 0) {
    if (adx < 130) { if (dx > 0) inp.left = 1; else inp.right = 1; }
    return;
  }

  // 3. 搓必殺:對齊、距離適中、MP 夠
  if (Math.abs(dz) < 14 && f.aiCool <= 0) {
    if (adx > 150 && adx < 430 && f.mp >= f.c.proj.mp && R() < 0.022) {
      inp.seq.push({ k: 'def', f: eng.frame }, { k: dx > 0 ? 'right' : 'left', f: eng.frame });
      inp.atkE = 1; f.aiCool = 50; return;
    }
    if (adx < 95 && f.mp >= f.c.spec2.mp && R() < 0.015) {
      f.facing = Math.sign(dx) || f.facing;
      inp.seq.push({ k: 'def', f: eng.frame }, { k: 'up', f: eng.frame });
      inp.atkE = 1; f.aiCool = 60; return;
    }
  }

  // 4. 近身輸出(54 是拳頭實際範圍,別站在打不到的距離空揮)
  if (adx < 54 && Math.abs(dz) < 16) {
    f.facing = Math.sign(dx) || f.facing;
    if (f.aiCool <= 0) {
      const roll = R();
      if (roll < 0.72) { inp.atkE = 1; f.aiCool = 12 + R() * 12; }
      else if (roll < 0.8) { inp.def = 1; f.aiCool = 18; }
      else if (roll < 0.88) { inp.jumpE = 1; f.aiCool = 20; }
      else { // 拉開
        if (dx > 0) inp.left = 1; else inp.right = 1;
        inp.up = dz > 0 ? 1 : 0; inp.down = dz < 0 ? 1 : 0;
        f.aiCool = 12;
      }
    }
    return;
  }

  // 5. 對齊縱深 + 接近
  const targetZ = e.z + f.aiZoff * 0.3;
  if (f.z < targetZ - 8) inp.down = 1;
  else if (f.z > targetZ + 8) inp.up = 1;
  if (adx > 42) {
    if (dx > 0) inp.right = 1; else inp.left = 1;
    if (adx > 280) inp.runWish = 1;
  }
  // 空中的對手跳過來 → 偶爾跳踢迎擊
  if (e.y > 20 && adx < 120 && R() < 0.05) { inp.jumpE = 1; f.aiCool = 10; }
}

if (typeof module !== 'undefined') module.exports = { aiAct };
