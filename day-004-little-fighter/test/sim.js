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
// vm 內的 const 不掛在 context 物件上,用表達式取出參照
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

// 1. 全部 4x4 角色組合,AI 互打 1200 幀:不噴錯、數值不 NaN、有造成傷害
console.log('— 4x4 角色組合 AI 互打 —');
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
    console.log(`  ${a} vs ${b}:總傷害 ${Math.round(dmg)}${eng.over ? ',' + eng.winText : ''}`);
  }
}

// 2. 長局:跑到分出勝負(上限 9000 幀)
console.log('— 長局打到 KO —');
{
  const eng = vs1('dan', 'blaze');
  let i = 0;
  for (; i < 9000 && !eng.over; i++) eng.step();
  assert(eng.over, '9000 幀內沒分出勝負(AI 可能互相打不到)');
  if (eng.over) console.log(`  第 ${i} 幀 KO,${eng.winText}`);
  let threw = null;
  try { for (let j = 0; j < 300; j++) eng.step(); } catch (e) { threw = e; }
  assert(!threw, `KO 後繼續 step 噴錯:${threw && threw.stack}`);
}

// 3. 2v2 群架:四隻 AI 打到分出勝負,攝影機不出界,武器有掉落
console.log('— 2v2 群架 —');
{
  const eng = new ctx.Engine([
    { key: 'dan', team: 0, isAI: true }, { key: 'blaze', team: 0, isAI: true },
    { key: 'frost', team: 1, isAI: true }, { key: 'bolt', team: 1, isAI: true },
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
  if (eng.over) console.log(`  第 ${i} 幀結束,${eng.winText}(場上最多同時 ${itemsSeen} 把武器)`);
}

// 4. 必殺技直測:搓招輸入有觸發、MP 有扣、彈有飛
console.log('— 必殺技輸入判定 —');
for (const key of ctx.CHAR_KEYS) {
  const eng = vs1(key, 'dan', { ai: false, noItems: true });
  eng.intro = 0;
  const f = eng.fighters[0];
  f.input.seq.push({ k: 'def', f: eng.frame }, { k: 'right', f: eng.frame });
  f.input.atkE = 1;
  eng.step();
  assert(f.state === 'cast', `${key} 搓波沒進 cast(state=${f.state})`);
  assert(f.mp < 500, `${key} 搓波沒扣 MP`);
  for (let i = 0; i < 15; i++) eng.step();
  assert(eng.projs.length > 0 || f.state !== 'cast', `${key} cast 後沒生成彈`);
  const eng2 = vs1(key, 'dan', { ai: false, noItems: true });
  eng2.intro = 0;
  const f2 = eng2.fighters[0];
  f2.input.seq.push({ k: 'def', f: eng2.frame }, { k: 'up', f: eng2.frame });
  f2.input.atkE = 1;
  eng2.step();
  assert(['cast', 'uppercut', 'spinkick'].includes(f2.state), `${key} 絕招沒觸發(state=${f2.state})`);
  console.log(`  ${key}:波 ✓ 絕招 ✓`);
}

// 5. 武器系統
console.log('— 武器系統 —');
const giveItem = (eng, f, kind) => {
  const it = { kind, x: f.x + 5, z: f.z, y: 0, vy: 0, vx: 0, heldBy: null,
               flying: false, spin: 0, dur: { bat: 8, knife: 10, stone: 2, soda: 1 }[kind], dead: false };
  eng.items.push(it);
  return it;
};
{
  // 撿球棒 → 揮擊有傷害、耐久遞減;被擊倒會掉武器
  const eng = vs1('dan', 'blaze', { ai: false, noItems: true });
  eng.intro = 0;
  const [f, e] = eng.fighters;
  e.x = f.x + 60; e.z = f.z; f.facing = 1;
  const it = giveItem(eng, f, 'bat');
  f.input.atkE = 1; eng.step();
  assert(f.weapon === it, `按攻擊沒撿起球棒(weapon=${f.weapon}, state=${f.state})`);
  const hpBefore = e.hp, durBefore = it.dur;
  f.input.atkE = 1; eng.step();
  assert(f.state === 'weaponatk', `拿球棒按攻擊沒進 weaponatk(state=${f.state})`);
  for (let i = 0; i < 40; i++) eng.step();
  assert(e.hp < hpBefore, '球棒揮擊沒造成傷害');
  assert(it.dur < durBefore, '球棒命中後耐久沒遞減');
  // 被擊倒掉武器
  eng.applyHit(f, e, { dmg: 10, kb: 3, down: true });
  assert(f.weapon === null, '被擊倒沒有掉武器');
  assert(!it.dead && it.heldBy === null, '掉落的武器狀態不對');
  console.log('  球棒:撿 ✓ 揮 ✓ 耐久 ✓ 擊倒掉落 ✓');
}
{
  // 石頭:丟出去會飛、命中擊倒
  const eng = vs1('dan', 'blaze', { ai: false, noItems: true });
  eng.intro = 0;
  const [f, e] = eng.fighters;
  e.x = f.x + 220; e.z = f.z; f.facing = 1;
  giveItem(eng, f, 'stone');
  f.input.atkE = 1; eng.step();
  assert(f.weapon, '石頭沒撿起來');
  f.input.atkE = 1; eng.step();
  assert(f.state === 'throwitem', `丟石頭沒進 throwitem(state=${f.state})`);
  const hpBefore = e.hp;
  for (let i = 0; i < 60; i++) eng.step();
  assert(e.hp < hpBefore, '石頭丟中沒掉血');
  assert(['fall', 'lying'].includes(e.state) || e.invuln > 0 || e.state === 'idle', `石頭命中後狀態怪(${e.state})`);
  console.log('  石頭:丟 ✓ 命中擊倒 ✓');
}
{
  // 汽水:喝了回 MP
  const eng = vs1('dan', 'blaze', { ai: false, noItems: true });
  eng.intro = 0;
  const f = eng.fighters[0];
  eng.fighters[1].x = f.x + 400;
  f.mp = 80;
  giveItem(eng, f, 'soda');
  f.input.atkE = 1; eng.step();
  f.input.atkE = 1; eng.step();
  assert(f.state === 'drink', `喝汽水沒進 drink(state=${f.state})`);
  for (let i = 0; i < 70; i++) eng.step();
  assert(f.mp > 280, `汽水沒回氣(mp=${Math.round(f.mp)})`);
  assert(f.weapon === null, '汽水喝完沒消失');
  console.log(`  汽水:喝 ✓ 回氣到 ${Math.round(f.mp)} MP ✓`);
}

// 6. 機制抽查
console.log('— 機制抽查 —');
{
  const eng = vs1('frost', 'dan', { ai: false, noItems: true });
  eng.intro = 0;
  const [f1, f2] = eng.fighters;
  f1.x = 800; f2.x = 1000; f1.z = f2.z = 400; f1.facing = 1;
  f1.input.seq.push({ k: 'def', f: eng.frame }, { k: 'right', f: eng.frame });
  f1.input.atkE = 1;
  let frozeSeen = false;
  for (let i = 0; i < 120; i++) { eng.step(); if (f2.state === 'frozen') frozeSeen = true; }
  assert(frozeSeen, '冰球打中沒有冰凍');

  const eng2 = vs1('dan', 'dan', { ai: false, noItems: true });
  eng2.intro = 0;
  const [a1, a2] = eng2.fighters;
  a1.x = 900; a2.x = 950; a1.z = a2.z = 400; a1.facing = 1;
  a2.input.def = 1; a2.facing = -1; eng2.step();
  const hpBefore = a2.hp;
  a1.input.atkE = 1;
  for (let i = 0; i < 30; i++) { eng2.step(); a2.input.def = 1; }
  const lost = hpBefore - a2.hp;
  assert(lost > 0 && lost < 8, `防禦減傷異常(掉了 ${lost.toFixed(1)})`);
  assert(a2.state !== 'fall' && a2.state !== 'lying', '防禦中被擊倒了');
  console.log(`  冰凍 ✓  防禦減傷(只掉 ${lost.toFixed(1)})✓`);
}

// 7. 回歸:同一幀「放開防禦 + 按攻擊」不能吃掉搓招(真實鍵盤很常見)
{
  const eng = vs1('dan', 'dan', { ai: false, noItems: true });
  eng.intro = 0;
  const f = eng.fighters[0];
  f.input.def = 1; eng.step();
  assert(f.state === 'defend', '按住防禦沒進防禦狀態');
  f.input.seq.push({ k: 'def', f: eng.frame }, { k: 'right', f: eng.frame });
  f.input.def = 0; f.input.atkE = 1;
  eng.step();
  assert(f.state === 'cast', `放開防禦同幀搓招被吃掉(state=${f.state})`);
  console.log('  放開防禦同幀搓招 ✓');
}

console.log(fail === 0 ? '\n全部通過 ✓' : `\n${fail} 項失敗 ✗`);
process.exit(fail === 0 ? 0 : 1);
