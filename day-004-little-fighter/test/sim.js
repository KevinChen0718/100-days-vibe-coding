'use strict';
// Node 模擬測試:讓 AI 互打,驗證引擎在所有角色組合下跑幾千幀不出錯
// 用法:node test/sim.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const vmCtx = { console, Math, JSON };
vm.createContext(vmCtx);
for (const f of ['js/data.js', 'js/engine.js', 'js/ai.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  vm.runInContext(src, vmCtx, { filename: f });
}
const ctx = {
  CHARS: vm.runInContext('CHARS', vmCtx),
  CHAR_KEYS: vm.runInContext('CHAR_KEYS', vmCtx),
  Engine: vm.runInContext('Engine', vmCtx),
  STAGE_W: vm.runInContext('STAGE_W', vmCtx),
};

let fail = 0;
const assert = (cond, msg) => {
  if (!cond) { console.error('  ✗ ' + msg); fail++; }
};
const vs1 = (a, b, opts = {}) => new ctx.Engine(
  [{ key: a, team: 0, isAI: opts.ai !== false }, { key: b, team: 1, isAI: opts.ai !== false }],
  opts);

// 1. 全角色組合 AI 互打 1200 幀:不噴錯、數值不 NaN、有造成傷害
console.log('— 5x5 角色組合 AI 互打 —');
for (const a of ctx.CHAR_KEYS) {
  for (const b of ctx.CHAR_KEYS) {
    const eng = vs1(a, b);
    let threw = null;
    try { for (let i = 0; i < 1200; i++) eng.step(); }
    catch (e) { threw = e; }
    assert(!threw, `${a} vs ${b} 噴錯:${threw && threw.stack}`);
    if (threw) continue;
    for (const f of eng.fighters) {
      assert(Number.isFinite(f.x) && Number.isFinite(f.z) && Number.isFinite(f.y), `${a} vs ${b}:座標出現 NaN`);
      assert(Number.isFinite(f.hp) && f.hp >= 0 && f.hp <= 500, `${a} vs ${b}:HP 越界 ${f.hp}`);
      assert(f.hpRec >= f.hp, `${a} vs ${b}:暗紅條低於 HP`);
    }
    const dmg = 1000 - eng.fighters[0].hp - eng.fighters[1].hp;
    assert(dmg > 0, `${a} vs ${b}:打了 1200 幀沒人掉血`);
  }
}
console.log('  25 種組合全數跑完');

// 2. 長局打到 KO + 2v2 群架
console.log('— 長局與 2v2 —');
{
  const eng = vs1('davis', 'firen');
  let i = 0;
  for (; i < 9000 && !eng.over; i++) eng.step();
  assert(eng.over, '9000 幀內沒分出勝負');
  if (eng.over) console.log(`  1v1 第 ${i} 幀 KO,${eng.winText}`);
  let threw = null;
  try { for (let j = 0; j < 300; j++) eng.step(); } catch (e) { threw = e; }
  assert(!threw, `KO 後繼續 step 噴錯:${threw && threw.stack}`);
}
{
  const eng = new ctx.Engine([
    { key: 'davis', team: 0, isAI: true }, { key: 'woody', team: 0, isAI: true },
    { key: 'freeze', team: 1, isAI: true }, { key: 'dennis', team: 1, isAI: true },
  ], {});
  let itemsSeen = 0, i = 0, threw = null;
  try {
    for (; i < 18000 && !eng.over; i++) {
      eng.step();
      itemsSeen = Math.max(itemsSeen, eng.items.length);
      if (i % 50 === 0) {
        assert(eng.camX >= -1 && eng.camX <= ctx.STAGE_W - 960 + 1, `攝影機出界 camX=${eng.camX}`);
        for (const f of eng.fighters) assert(Number.isFinite(f.x + f.z + f.y + f.hp), '2v2 出現 NaN');
      }
    }
  } catch (e) { threw = e; }
  assert(!threw, `2v2 噴錯:${threw && threw.stack}`);
  assert(eng.over, '2v2 在 18000 幀內沒分出勝負');
  assert(itemsSeen > 0, '整場 2v2 沒有任何武器掉落');
  if (eng.over) console.log(`  2v2 第 ${i} 幀結束,${eng.winText}`);
}

// 3. 全角色全招式表:每一招都搓得出來、MP 有扣
console.log('— 招式表逐招驗證 —');
const DIR_EV = { '>': 'right', '^': 'up', 'v': 'down' };
for (const key of ctx.CHAR_KEYS) {
  const c = ctx.CHARS[key];
  const tried = [];
  for (const [mk, mv] of Object.entries(c.moves)) {
    const eng = vs1(key, 'davis', { ai: false, noItems: true });
    eng.intro = 0;
    const f = eng.fighters[0];
    f.input.seq.push({ k: 'def', f: eng.frame }, { k: DIR_EV[mk[0]], f: eng.frame });
    if (mk[1] === 'A') f.input.atkE = 1; else f.input.jumpE = 1;
    const mpBefore = f.mp, hpBefore = f.hp;
    eng.step();
    assert(f.busy, `${key} 的 ${mk}(${mv.name})沒觸發(state=${f.state})`);
    if (mv.mp > 0) assert(f.mp < mpBefore, `${key} 的 ${mk} 沒扣 MP`);
    if (mv.hpCost) assert(f.hp <= hpBefore - mv.hpCost + 1, `${key} 的 ${mk} 沒扣 HP`);
    let threw = null;
    try { for (let i = 0; i < 90; i++) eng.step(); } catch (e) { threw = e; }
    assert(!threw, `${key} 的 ${mk} 後續噴錯:${threw && threw.stack}`);
    tried.push(mk);
  }
  console.log(`  ${c.name}:${tried.join(' ')} ✓`);
}

// 4. 連發氣功波(D>A 後連按 A)
{
  const eng = vs1('davis', 'firen', { ai: false, noItems: true });
  eng.intro = 0;
  const f = eng.fighters[0];
  eng.fighters[1].x = f.x + 500;
  f.input.seq.push({ k: 'def', f: eng.frame }, { k: 'right', f: eng.frame });
  f.input.atkE = 1;
  eng.step();
  for (let i = 0; i < 14; i++) { f.input.atkE = 1; eng.step(); }
  for (let i = 0; i < 10; i++) eng.step();
  assert(eng.projs.length >= 2, `連發氣功波只有 ${eng.projs.length} 顆`);
  console.log(`  連發氣功波 ${eng.projs.length} 顆 ✓`);
}

// 5. 暈眩 → 抓住 → 毆打/過肩摔
console.log('— 抓投系統 —');
{
  const eng = vs1('davis', 'dennis', { ai: false, noItems: true });
  eng.intro = 0;
  const [a, b] = eng.fighters;
  a.x = 800; b.x = 850; a.z = b.z = 400; a.facing = 1;
  // 連刺拳 4 下把對方打暈(單發刺拳不擊倒)
  let guard = 0;
  while (b.state !== 'stunned' && guard++ < 600) {
    if (!a.busy && ['idle', 'hurt'].includes(b.state) || b.state === 'idle') {
      if (!a.busy) a.input.atkE = 1;
    }
    eng.step();
    b.x = Math.min(b.x, a.x + 52); // 防止被推出拳距
  }
  assert(b.state === 'stunned', `連打 4 下沒進暈眩(state=${b.state}, guard=${guard})`);
  // 走過去抓
  guard = 0;
  while (a.state !== 'catching' && guard++ < 120) { a.input.right = 1; eng.step(); }
  assert(a.state === 'catching' && b.state === 'caught', `沒抓住(a=${a.state}, b=${b.state})`);
  // 毆打一拳
  const hpBefore = b.hp;
  a.input.atkE = 1; eng.step();
  assert(b.hp < hpBefore, '抓住毆打沒掉血');
  // 過肩摔
  a.input.atkE = 1; a.input.right = 1; eng.step();
  assert(b.state === 'fall' || b.state === 'lying', `過肩摔沒把人摔飛(b=${b.state})`);
  console.log('  打暈 ✓ 抓住 ✓ 毆打 ✓ 過肩摔 ✓');
}

// 6. 倒地受身:落下時按跳不躺地
{
  const eng = vs1('davis', 'dennis', { ai: false, noItems: true });
  eng.intro = 0;
  const [a, b] = eng.fighters;
  eng.applyHit(b, a, { dmg: 10, kb: 5, down: true });
  assert(b.state === 'fall', '沒被擊倒');
  b.input.jump = 1; // 按住跳 = 受身(hitstop 硬直也不會吃掉輸入)
  let flipped = false, lied = false;
  for (let i = 0; i < 80; i++) {
    eng.step();
    if (b.state === 'flip') flipped = true;
    if (b.state === 'lying') lied = true;
  }
  assert(flipped, '受身沒觸發');
  assert(!lied, '受身後還是躺地了');
  console.log('  倒地受身 ✓');
}

// 7. 武器系統(撿/揮/丟/喝/擊倒掉裝/冰劍召喚)
console.log('— 武器系統 —');
const giveItem = (eng, f, kind) => {
  const it = eng.spawnItem(kind, f.x + 5, f.z, 0);
  return it;
};
{
  const eng = vs1('davis', 'firen', { ai: false, noItems: true });
  eng.intro = 0;
  const [f, e] = eng.fighters;
  e.x = f.x + 60; e.z = f.z; f.facing = 1;
  const it = giveItem(eng, f, 'bat');
  f.input.atkE = 1; eng.step();
  assert(f.weapon === it, `按攻擊沒撿起球棒(state=${f.state})`);
  const hpBefore = e.hp, durBefore = it.dur;
  f.input.atkE = 1; eng.step();
  assert(f.state === 'weaponatk', `拿球棒按攻擊沒進 weaponatk(state=${f.state})`);
  for (let i = 0; i < 40; i++) eng.step();
  assert(e.hp < hpBefore, '球棒揮擊沒造成傷害');
  assert(it.dur < durBefore, '球棒命中後耐久沒遞減');
  eng.applyHit(f, e, { dmg: 10, kb: 3, down: true });
  assert(f.weapon === null, '被擊倒沒有掉武器');
  // 拿武器時 防→前→攻 = 用力丟出去
  const eng2 = vs1('davis', 'firen', { ai: false, noItems: true });
  eng2.intro = 0;
  const [f2, e2] = eng2.fighters;
  e2.x = f2.x + 300; e2.z = f2.z;
  giveItem(eng2, f2, 'knife');
  f2.input.atkE = 1; eng2.step();
  assert(f2.weapon, '小刀沒撿起來');
  f2.input.seq.push({ k: 'def', f: eng2.frame }, { k: 'right', f: eng2.frame });
  f2.input.atkE = 1; eng2.step();
  assert(f2.state === 'throwitem', `防前攻沒觸發丟武器(state=${f2.state})`);
  const hpB2 = e2.hp;
  for (let i = 0; i < 50; i++) eng2.step();
  assert(e2.hp < hpB2, '丟出去的小刀沒打中人');
  console.log('  球棒撿揮耐久 ✓ 擊倒掉裝 ✓ 防前攻擲刀 ✓');
}
{
  const eng = vs1('freeze', 'davis', { ai: false, noItems: true });
  eng.intro = 0;
  const f = eng.fighters[0];
  eng.fighters[1].x = f.x + 400;
  f.input.seq.push({ k: 'def', f: eng.frame }, { k: 'down', f: eng.frame });
  f.input.jumpE = 1; eng.step();
  let found = false;
  for (let i = 0; i < 40; i++) { eng.step(); if (eng.items.some(it => it.kind === 'icesword')) found = true; }
  assert(found, '冰劍沒召喚出來');
  console.log('  召喚冰劍 ✓');
}

// 8. 機制抽查(冰凍/防禦減傷/搓招同幀回歸)
console.log('— 機制抽查 —');
{
  const eng = vs1('freeze', 'davis', { ai: false, noItems: true });
  eng.intro = 0;
  const [f1, f2] = eng.fighters;
  f1.x = 800; f2.x = 1000; f1.z = f2.z = 400; f1.facing = 1;
  f1.input.seq.push({ k: 'def', f: eng.frame }, { k: 'right', f: eng.frame });
  f1.input.atkE = 1;
  let frozeSeen = false;
  for (let i = 0; i < 120; i++) { eng.step(); if (f2.state === 'frozen') frozeSeen = true; }
  assert(frozeSeen, '冰凍波打中沒有冰凍');

  const eng2 = vs1('davis', 'davis', { ai: false, noItems: true });
  eng2.intro = 0;
  const [a1, a2] = eng2.fighters;
  a1.x = 900; a2.x = 950; a1.z = a2.z = 400; a1.facing = 1;
  a2.input.def = 1; a2.facing = -1; eng2.step();
  const hpBefore = a2.hp;
  a1.input.atkE = 1;
  for (let i = 0; i < 30; i++) { eng2.step(); a2.input.def = 1; }
  const lost = hpBefore - a2.hp;
  assert(lost > 0 && lost < 8, `防禦減傷異常(掉了 ${lost.toFixed(1)})`);

  const eng3 = vs1('davis', 'davis', { ai: false, noItems: true });
  eng3.intro = 0;
  const f3 = eng3.fighters[0];
  f3.input.def = 1; eng3.step();
  f3.input.seq.push({ k: 'def', f: eng3.frame }, { k: 'right', f: eng3.frame });
  f3.input.def = 0; f3.input.atkE = 1;
  eng3.step();
  assert(f3.state === 'cast', `放開防禦同幀搓招被吃掉(state=${f3.state})`);
  console.log(`  冰凍 ✓ 防禦減傷(只掉 ${lost.toFixed(1)})✓ 同幀搓招 ✓`);
}

console.log(fail === 0 ? '\n全部通過 ✓' : `\n${fail} 項失敗 ✗`);
process.exit(fail === 0 ? 0 : 1);
