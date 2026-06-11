'use strict';
// 簡易 AI — 跟玩家用同一套輸入介面(填 f.input),不開外掛
// 行為:對齊縱深 → 接近 → 連打;會撿武器、丟石頭、喝汽水、閃飛行道具

function aiAct(eng, f) {
  const inp = f.input;
  inp.left = inp.right = inp.up = inp.down = inp.def = 0;
  if (f.busy) return; // 出招/受擊中不用思考
  if (f.aiCool > 0) f.aiCool--;

  const e = eng.nearestEnemy(f);
  if (!e) return;
  const dx = e.x - f.x, adx = Math.abs(dx), dz = e.z - f.z;
  const R = () => Math.random();

  // 偶爾換一個縱深偏移,走位不要像木頭
  if (--f.aiZoffT <= 0) { f.aiZoff = (R() - 0.5) * 30; f.aiZoffT = 90 + R() * 120; }

  // 1. 躲飛行道具:有彈接近且縱深對齊 → 上下閃或防禦
  for (const p of eng.projs) {
    if (p.team === f.team) continue;
    const coming = Math.sign(f.x - p.x) === Math.sign(p.vx);
    if (!coming || Math.abs(p.x - f.x) > 240 || Math.abs(p.z - f.z) > 34) continue;
    if (Math.abs(p.x - f.x) < 110 && R() < 0.5) { inp.def = 1; f.facing = Math.sign(p.x - f.x) || f.facing; return; }
    if (f.z < (315 + 515) / 2) inp.down = 1; else inp.up = 1;
    return;
  }

  // 2. 手上有汽水且狀態差、敵人不在近處 → 喝掉
  if (f.weapon && WEAPONS[f.weapon.kind].drink) {
    if ((f.mp < 220 || f.hp < 260) && adx > 160) { inp.atkE = 1; f.aiCool = 30; return; }
  }
  // 3. 手上有石頭、對齊了 → 丟過去
  if (f.weapon && f.weapon.kind === 'stone' && Math.abs(dz) < 14 && adx > 90 && adx < 380 && f.aiCool <= 0) {
    f.facing = Math.sign(dx) || f.facing;
    inp.atkE = 1; f.aiCool = 36; return;
  }

  // 4. 空手且附近有掉在地上的武器 → 過去撿
  if (!f.weapon) {
    let best = null, bd = 260;
    for (const it of eng.items) {
      if (it.dead || it.heldBy !== null || it.flying || it.y > 0) continue;
      const d = Math.abs(it.x - f.x) + Math.abs(it.z - f.z) * 2;
      if (d < bd) { bd = d; best = it; }
    }
    if (best && adx > 70) { // 敵人貼臉就別撿了,先打
      const ix = best.x - f.x, iz = best.z - f.z;
      if (Math.abs(ix) < 26 && Math.abs(iz) < 18) { inp.atkE = 1; f.aiCool = 12; return; }
      if (ix > 8) inp.right = 1; else if (ix < -8) inp.left = 1;
      if (iz > 6) inp.down = 1; else if (iz < -6) inp.up = 1;
      return;
    }
  }

  // 5. 對手倒地 → 拉開一點距離等他起來
  if (e.state === 'lying' || e.invuln > 0) {
    if (adx < 130) { if (dx > 0) inp.left = 1; else inp.right = 1; }
    return;
  }

  // 6. 搓必殺:對齊、距離適中、MP 夠(拿著武器時不搓)
  if (!f.weapon && Math.abs(dz) < 14 && f.aiCool <= 0) {
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

  // 7. 近身輸出(出手距離跟著武器走;拳頭實際範圍 54,別站在打不到的距離空揮)
  const range = f.weapon && WEAPONS[f.weapon.kind].heavy ? WEAPONS[f.weapon.kind].reach - 6 : 54;
  if (adx < range && Math.abs(dz) < 16) {
    f.facing = Math.sign(dx) || f.facing;
    if (f.aiCool <= 0) {
      const roll = R();
      if (roll < 0.72) { inp.atkE = 1; f.aiCool = 12 + R() * 12; }
      else if (roll < 0.8) { inp.def = 1; f.aiCool = 18; }
      else if (roll < 0.88) { inp.jumpE = 1; f.aiCool = 20; }
      else {
        if (dx > 0) inp.left = 1; else inp.right = 1;
        inp.up = dz > 0 ? 1 : 0; inp.down = dz < 0 ? 1 : 0;
        f.aiCool = 12;
      }
    }
    return;
  }

  // 8. 對齊縱深 + 接近(跟隊友錯開一點縱深,別疊在一起)
  let targetZ = e.z + f.aiZoff * 0.3;
  const mate = eng.fighters.find(o => o !== f && o.team === f.team && o.hp > 0);
  if (mate && Math.abs(mate.z - targetZ) < 24) targetZ += (f.pid % 2 === 0 ? -30 : 30);
  if (f.z < targetZ - 8) inp.down = 1;
  else if (f.z > targetZ + 8) inp.up = 1;
  if (adx > 42) {
    if (dx > 0) inp.right = 1; else inp.left = 1;
    if (adx > 280) inp.runWish = 1;
  }
  if (e.y > 20 && adx < 120 && R() < 0.05) { inp.jumpE = 1; f.aiCool = 10; }
}

if (typeof module !== 'undefined') module.exports = { aiAct };
