'use strict';
// 簡易 AI — 跟玩家用同一套輸入介面(填 f.input),不開外掛
// 會撿武器、丟石頭、喝汽水、閃彈、按角色招式表搓招、抓暈眩的人、倒地受身

// 從招式表挑出 AI 用得上的招(一次性快取在 fighter 上)
function aiMoves(f) {
  if (f.aiMv) return f.aiMv;
  const mv = { poke: null, close: null, gap: null };
  for (const [key, m] of Object.entries(f.c.moves)) {
    if (m.kind === 'proj' && (!mv.poke || key === '>A')) mv.poke = { key, m };
    if (['uppercut', 'flipkick', 'turnkick', 'shrafe', 'explosion'].includes(m.kind) && !mv.close) mv.close = { key, m };
    if (['tigerdash', 'blazedash', 'dashspin', 'leapatk'].includes(m.kind) && !mv.gap) mv.gap = { key, m };
  }
  f.aiMv = mv;
  return mv;
}

// 依招式 key(像 '>A'、'^J')塞輸入序列
function castByKey(eng, f, key, dxSign) {
  const inp = f.input;
  const dir = key[0] === '^' ? 'up' : key[0] === 'v' ? 'down' : (dxSign > 0 ? 'right' : 'left');
  inp.seq.push({ k: 'def', f: eng.frame }, { k: dir, f: eng.frame });
  if (key[1] === 'A') inp.atkE = 1; else inp.jumpE = 1;
}

function aiAct(eng, f) {
  const inp = f.input;
  inp.left = inp.right = inp.up = inp.down = inp.def = 0;
  const R = () => Math.random();

  // 倒地瞬間受身(LF2 老手都會)
  if (f.state === 'fall' && f.y > 16 && R() < 0.05) { inp.jumpE = 1; return; }
  // 抓到人:毆打或摔出去
  if (f.state === 'catching') {
    if (f.aiCool > 0) { f.aiCool--; return; }
    if (R() < 0.5) { inp.atkE = 1; f.aiCool = 10; }
    else { inp.atkE = 1; if (f.facing > 0) inp.right = 1; else inp.left = 1; f.aiCool = 10; }
    return;
  }
  if (f.busy) return;
  if (f.aiCool > 0) f.aiCool--;

  const e = eng.nearestEnemy(f);
  if (!e) return;
  const dx = e.x - f.x, adx = Math.abs(dx), dz = e.z - f.z;
  const mv = aiMoves(f);

  if (--f.aiZoffT <= 0) { f.aiZoff = (R() - 0.5) * 30; f.aiZoffT = 90 + R() * 120; }

  // 跑步剎車:快貼到人就停(用防禦鍵停步,LF2 手感)
  if (f.state === 'run' && adx < 90 && Math.abs(dz) < 30) { inp.def = 1; return; }

  // 1. 躲飛行道具
  for (const p of eng.projs) {
    if (p.team === f.team || p.pierce) continue;
    const coming = Math.sign(f.x - p.x) === Math.sign(p.vx);
    if (!coming || Math.abs(p.x - f.x) > 240 || Math.abs(p.z - f.z) > 34) continue;
    if (Math.abs(p.x - f.x) < 110 && R() < 0.5) { inp.def = 1; f.facing = Math.sign(p.x - f.x) || f.facing; return; }
    if (f.z < (315 + 515) / 2) inp.down = 1; else inp.up = 1;
    return;
  }

  // 2. 敵人暈眩了 → 衝過去抓
  if (e.state === 'stunned' && adx < 200) {
    if (dx > 8) inp.right = 1; else if (dx < -8) inp.left = 1;
    if (dz > 6) inp.down = 1; else if (dz < -6) inp.up = 1;
    return;
  }

  // 3. 汽水回氣 / 丟石頭
  if (f.weapon && WEAPONS[f.weapon.kind].drink) {
    if ((f.mp < 220 || f.hp < 260) && adx > 160) { inp.atkE = 1; f.aiCool = 30; return; }
  }
  if (f.weapon && f.weapon.kind === 'stone' && Math.abs(dz) < 14 && adx > 90 && adx < 380 && f.aiCool <= 0) {
    f.facing = Math.sign(dx) || f.facing;
    inp.atkE = 1; f.aiCool = 36; return;
  }

  // 4. 空手且附近有武器 → 過去撿
  if (!f.weapon) {
    let best = null, bd = 260;
    for (const it of eng.items) {
      if (it.dead || it.heldBy !== null || it.flying || it.y > 0) continue;
      const d = Math.abs(it.x - f.x) + Math.abs(it.z - f.z) * 2;
      if (d < bd) { bd = d; best = it; }
    }
    if (best && adx > 70) {
      const ix = best.x - f.x, iz = best.z - f.z;
      if (Math.abs(ix) < 26 && Math.abs(iz) < 18) { inp.atkE = 1; f.aiCool = 12; return; }
      if (ix > 8) inp.right = 1; else if (ix < -8) inp.left = 1;
      if (iz > 6) inp.down = 1; else if (iz < -6) inp.up = 1;
      return;
    }
  }

  // 5. 對手倒地 → 拉開等他起來
  if (e.state === 'lying' || e.invuln > 0) {
    if (adx < 130) { if (dx > 0) inp.left = 1; else inp.right = 1; }
    return;
  }

  // 6. 搓招(空手才搓;照角色招式表)
  if (!f.weapon && Math.abs(dz) < 14 && f.aiCool <= 0) {
    if (mv.poke && adx > 150 && adx < 430 && f.mp >= mv.poke.m.mp && R() < 0.022) {
      castByKey(eng, f, mv.poke.key, dx); f.aiCool = 50; return;
    }
    if (mv.gap && adx > 100 && adx < 260 && f.mp >= mv.gap.m.mp && R() < 0.012) {
      f.facing = Math.sign(dx) || f.facing;
      castByKey(eng, f, mv.gap.key, dx); f.aiCool = 55; return;
    }
    if (mv.close && adx < 95 && f.mp >= mv.close.m.mp && R() < 0.015) {
      f.facing = Math.sign(dx) || f.facing;
      castByKey(eng, f, mv.close.key, dx); f.aiCool = 60; return;
    }
  }

  // 7. 近身輸出(出手距離跟著武器走)
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

  // 8. 對齊縱深 + 接近(跟隊友錯開)
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
