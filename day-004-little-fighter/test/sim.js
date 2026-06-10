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
};

let fail = 0;
const assert = (cond, msg) => {
  if (!cond) { console.error('  ✗ ' + msg); fail++; }
};

// 1. 全部 4x4 角色組合,AI 互打 1200 幀:不噴錯、數值不 NaN、有造成傷害
console.log('— 4x4 角色組合 AI 互打 —');
for (const a of ctx.CHAR_KEYS) {
  for (const b of ctx.CHAR_KEYS) {
    const eng = new ctx.Engine(a, b, { p1AI: true, p2AI: true });
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
    console.log(`  ${a} vs ${b}:總傷害 ${Math.round(dmg)}${eng.over ? ',' + eng.winner.c.name + ' 勝' : ''}`);
  }
}

// 2. 長局:跑到分出勝負(上限 9000 幀)
console.log('— 長局打到 KO —');
{
  const eng = new ctx.Engine('dan', 'blaze', { p1AI: true, p2AI: true });
  let i = 0;
  for (; i < 9000 && !eng.over; i++) eng.step();
  assert(eng.over, '9000 幀內沒分出勝負(AI 可能互相打不到)');
  if (eng.over) console.log(`  第 ${i} 幀 KO,${eng.winner.c.name} 勝`);
  // KO 後繼續跑 300 幀也不出事
  let threw = null;
  try { for (let j = 0; j < 300; j++) eng.step(); } catch (e) { threw = e; }
  assert(!threw, `KO 後繼續 step 噴錯:${threw && threw.stack}`);
}

// 3. 必殺技直測:搓招輸入有觸發、MP 有扣、彈有飛
console.log('— 必殺技輸入判定 —');
for (const key of ctx.CHAR_KEYS) {
  const eng = new ctx.Engine(key, 'dan', {});
  eng.intro = 0;
  const f = eng.fighters[0];
  // 防→前→攻
  f.input.seq.push({ k: 'def', f: eng.frame }, { k: 'right', f: eng.frame });
  f.input.atkE = 1;
  eng.step();
  assert(f.state === 'cast', `${key} 搓波沒進 cast(state=${f.state})`);
  assert(f.mp < 500, `${key} 搓波沒扣 MP`);
  for (let i = 0; i < 15; i++) eng.step();
  assert(eng.projs.length > 0 || f.state !== 'cast', `${key} cast 後沒生成彈`);
  // 防→上→攻
  const eng2 = new ctx.Engine(key, 'dan', {});
  eng2.intro = 0;
  const f2 = eng2.fighters[0];
  f2.input.seq.push({ k: 'def', f: eng2.frame }, { k: 'up', f: eng2.frame });
  f2.input.atkE = 1;
  eng2.step();
  assert(['cast', 'uppercut', 'spinkick'].includes(f2.state), `${key} 絕招沒觸發(state=${f2.state})`);
  console.log(`  ${key}:波 ✓ 絕招 ✓`);
}

// 4. 冰凍與防禦
console.log('— 機制抽查 —');
{
  // 冰球凍人
  const eng = new ctx.Engine('frost', 'dan', {});
  eng.intro = 0;
  const [f1, f2] = eng.fighters;
  f1.x = 300; f2.x = 500; f1.z = f2.z = 400;
  f1.input.seq.push({ k: 'def', f: eng.frame }, { k: 'right', f: eng.frame });
  f1.input.atkE = 1;
  let frozeSeen = false;
  for (let i = 0; i < 120; i++) { eng.step(); if (f2.state === 'frozen') frozeSeen = true; }
  assert(frozeSeen, '冰球打中沒有冰凍');
  // 防禦減傷
  const eng2 = new ctx.Engine('dan', 'dan', {});
  eng2.intro = 0;
  const [a1, a2] = eng2.fighters;
  a1.x = 400; a2.x = 450; a1.z = a2.z = 400;
  a2.input.def = 1; a2.facing = -1; eng2.step(); // a2 進防禦面向 a1
  const hpBefore = a2.hp;
  a1.input.atkE = 1;
  for (let i = 0; i < 30; i++) { eng2.step(); a2.input.def = 1; }
  const lost = hpBefore - a2.hp;
  assert(lost > 0 && lost < 8, `防禦減傷異常(掉了 ${lost.toFixed(1)})`);
  assert(a2.state !== 'fall' && a2.state !== 'lying', '防禦中被擊倒了');
  console.log(`  冰凍 ✓  防禦減傷(只掉 ${lost.toFixed(1)})✓`);
}

// 5. 回歸:同一幀「放開防禦 + 按攻擊」不能吃掉搓招(真實鍵盤很常見)
{
  const eng = new ctx.Engine('dan', 'dan', {});
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
