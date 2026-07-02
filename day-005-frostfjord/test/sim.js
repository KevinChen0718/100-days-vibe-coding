/* 霜峽行動 — Node 回歸測試
 * 跑法：node test/sim.js
 * 1. 地圖合法性（列長、關鍵點可走）
 * 2. 視野錐雙區規則矩陣（站/蹲 × 近/遠 × 前/後）
 * 3. AI FSM：起疑 → 警戒 → 開槍
 * 4. 背後刀殺 / 正面刀不到
 * 5. 誘餌吸引
 * 6. 後勤通關：腳本化指令從頭跑到 WIN（驗證任務鏈與地圖幾何永遠可解）
 */
'use strict';

var D = require('../js/data.js');
var Engine = require('../js/engine.js');
var TILE = D.TILE, TUNING = D.TUNING, LEVEL1 = D.LEVEL1;
var H = Engine.helpers;

var passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ ' + msg); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

function px(c, r) { return { x: (c + 0.5) * TILE, y: (r + 0.5) * TILE }; }

function run(state, seconds) {
  var dt = 1 / 30;
  var steps = Math.ceil(seconds / dt);
  for (var i = 0; i < steps; i++) {
    Engine.update(state, dt);
    state.events.length = 0;
    if (state.result) return;
  }
}
function runUntil(state, cond, timeout) {
  var dt = 1 / 30, t = 0;
  while (t < timeout) {
    Engine.update(state, dt);
    state.events.length = 0;
    t += dt;
    if (cond(state)) return true;
    if (state.result) return cond(state);
  }
  return cond(state);
}

/* ---------- 1. 地圖合法性 ---------- */
section('地圖合法性');
ok(LEVEL1.map.length === 34, '地圖 34 列');
ok(LEVEL1.map.every(function (r) { return r.length === 50; }), '每列恰 50 字元');

LEVEL1.units.forEach(function (u) {
  ok(H.walkable(H.tileAt(LEVEL1.map, u.tx, u.ty)), '出生點可走：' + u.name + ' (' + u.tx + ',' + u.ty + ')');
});
LEVEL1.guards.forEach(function (g) {
  if (g.type === 'static') {
    ok(H.walkable(H.tileAt(LEVEL1.map, g.tx, g.ty)), '哨兵站位可走：' + g.id);
  } else {
    g.waypoints.forEach(function (wp) {
      ok(H.walkable(H.tileAt(LEVEL1.map, wp[0], wp[1])), '巡邏點可走：' + g.id + ' (' + wp[0] + ',' + wp[1] + ')');
    });
  }
});
LEVEL1.barrels.forEach(function (b) {
  ok(H.walkable(H.tileAt(LEVEL1.map, b.tx, b.ty)), '油桶位置可走 (' + b.tx + ',' + b.ty + ')');
});
LEVEL1.plantZone.forEach(function (z) {
  ok(H.walkable(H.tileAt(LEVEL1.map, z[0], z[1])), '放置區可走 (' + z[0] + ',' + z[1] + ')');
});
ok(H.boatable(H.tileAt(LEVEL1.map, Math.floor(LEVEL1.boat.tx), LEVEL1.boat.ty)), '小艇在水上');

/* 巡邏路線相鄰兩點之間必須有路 */
LEVEL1.guards.forEach(function (g) {
  if (g.type !== 'patrol') return;
  for (var i = 0; i + 1 < g.waypoints.length; i++) {
    var a = px(g.waypoints[i][0], g.waypoints[i][1]);
    var b = px(g.waypoints[i + 1][0], g.waypoints[i + 1][1]);
    var p = H.findPath(LEVEL1.map, a.x, a.y, b.x, b.y, H.walkable);
    ok(p !== null, '巡邏路線可達：' + g.id + ' 段 ' + i);
  }
});

/* 關鍵路徑 */
var wolfSpawn = px(4, 30), dockTile = px(21, 13), barrelPos = px(31, 5), zonePos = px(41, 5);
ok(H.findPath(LEVEL1.map, wolfSpawn.x, wolfSpawn.y, dockTile.x, dockTile.y, H.walkable) !== null, '狼出生點 → 南岸碼頭有路');
ok(H.findPath(LEVEL1.map, px(32, 9).x, px(32, 9).y, barrelPos.x, barrelPos.y, H.walkable) !== null, '島上登陸點 → 油桶有路');
ok(H.findPath(LEVEL1.map, barrelPos.x, barrelPos.y, zonePos.x, zonePos.y, H.walkable) !== null, '油桶 → 中繼站放置區有路');
var boatStart = { x: LEVEL1.boat.tx * TILE + TILE / 2, y: LEVEL1.boat.ty * TILE + TILE / 2 };
ok(H.findPath(LEVEL1.map, boatStart.x, boatStart.y, px(31, 9).x, px(31, 9).y, H.boatable) !== null, '小艇 → 北島西岸有水路');

/* ---------- 1.5 開場安全：30 秒不動，任何人都不能被發現 ---------- */
section('開場安全（出生點不在任何巡邏視野內）');
var stSafe = Engine.create(LEVEL1);
run(stSafe, 30);
ok(stSafe.result === null, '開場站著不動 30 秒 → 沒人陣亡');
ok(stSafe.guards.every(function (g) { return g.state === 'patrol'; }), '所有哨兵維持巡邏狀態（無人起疑）');
ok(stSafe.guards.every(function (g) { return g.meter < 0.05; }), '所有哨兵目擊值近乎為零');

/* ---------- 2. 視野錐雙區規則 ---------- */
section('視野錐雙區規則（哨兵面向南）');
var st = Engine.create(LEVEL1);
var g2 = Engine.guardById(st, 'g2'); // (21,18) 面南
g2.dir = Math.PI / 2; // 固定面南（不掃動）
var GP = { x: g2.x, y: g2.y };

function rateAt(c, r, crouch, carry) {
  var p = px(c, r);
  return H.visRate(st, g2, p.x, p.y, crouch, carry);
}
ok(rateAt(21, 21, false, false) === TUNING.rateNear, '近區站立 → 立刻發現（速率 ' + TUNING.rateNear + '）');
ok(rateAt(21, 21, true, false) === TUNING.rateNear, '近區蹲低 → 照樣發現（蹲也沒用）');
ok(rateAt(21, 24, false, false) === TUNING.rateFar, '遠區站立 → 緩慢發現');
ok(rateAt(21, 24, true, false) === 0, '遠區蹲低 → 隱形');
ok(rateAt(21, 24, true, true) === TUNING.rateCarry, '遠區搬東西 → 更顯眼（無法隱蔽）');
ok(rateAt(21, 16, false, false) === 0, '正後方站立 → 看不到（背後死角)');
ok(rateAt(10, 18, false, false) === 0, '側面 90 度 → 視野錐外');

/* 視線被牆擋 */
var stWall = px(39, 3), stEast = px(45, 3);
ok(!H.los(LEVEL1.map, stWall.x, stWall.y, stEast.x, stEast.y), '中繼站牆壁擋視線');
ok(H.los(LEVEL1.map, px(30, 7).x, px(30, 7).y, px(34, 7).x, px(34, 7).y), '開闊雪地視線暢通');

/* ---------- 3. FSM：起疑 → 警戒 → 開槍 ---------- */
section('AI 狀態機');
var st2 = Engine.create(LEVEL1);
var g2b = Engine.guardById(st2, 'g2');
g2b.sweep = null; g2b.dir = Math.PI / 2; g2b.homeDir = Math.PI / 2;
var wolf2 = Engine.unitById(st2, 'wolf');
// 把狼放到 g2 遠區正前方站著不動
var fp = px(21, 24);
wolf2.x = fp.x; wolf2.y = fp.y;
runUntil(st2, function (s) { return g2b.state !== 'patrol'; }, 2);
ok(g2b.state === 'sus' || g2b.state === 'alert', '遠區站立被看到 → 起疑（' + g2b.state + '）');
var sawAlert = runUntil(st2, function (s) { return g2b.state === 'alert'; }, 5);
ok(sawAlert, '持續暴露 → 升級警戒');
runUntil(st2, function (s) { return s.result === 'fail'; }, 8);
ok(st2.result === 'fail', '警戒後開槍 → 站著不動的隊員陣亡 → 任務失敗');

/* 蹲低潛行不會被發現 */
var st3 = Engine.create(LEVEL1);
var g2c = Engine.guardById(st3, 'g2');
g2c.sweep = null; g2c.dir = Math.PI / 2; g2c.homeDir = Math.PI / 2;
var wolf3 = Engine.unitById(st3, 'wolf');
wolf3.x = fp.x; wolf3.y = fp.y; wolf3.crouch = true;
run(st3, 4);
ok(g2c.state === 'patrol' && g2c.meter === 0, '遠區蹲低 4 秒 → 哨兵毫無察覺');

/* ---------- 4. 刀殺判定 ---------- */
section('刀殺');
var st4 = Engine.create(LEVEL1);
var g2d = Engine.guardById(st4, 'g2');
g2d.sweep = null; g2d.dir = Math.PI / 2; g2d.homeDir = Math.PI / 2;
var wolf4 = Engine.unitById(st4, 'wolf');
var behind = px(21, 16); // 哨兵背後（北側棧橋）
wolf4.x = behind.x; wolf4.y = behind.y;
Engine.orderKnife(st4, 'wolf', 'g2');
runUntil(st4, function (s) { return !g2d.alive; }, 6);
ok(!g2d.alive, '背後接近 → 刀殺成功');
ok(st4.bodies.length === 1, '留下一具屍體');

var st5 = Engine.create(LEVEL1);
var g2e = Engine.guardById(st5, 'g2');
g2e.sweep = null; g2e.dir = Math.PI / 2; g2e.homeDir = Math.PI / 2;
var wolf5 = Engine.unitById(st5, 'wolf');
var front = px(21, 19); // 正前方貼臉
wolf5.x = front.x; wolf5.y = front.y;
wolf5.action = { type: 'knife', guardId: 'g2' };
Engine.update(st5, 1 / 30);
ok(g2e.alive, '正面出刀 → 刀不到（哨兵還活著）');

/* 屍體被看見 → 哨兵趕去查看 */
var st6 = Engine.create(LEVEL1);
var g1f = Engine.guardById(st6, 'g1');
st6.bodies.push({ x: px(10, 24).x, y: px(10, 24).y, carried: false, hidden: false, found: false });
var seen = runUntil(st6, function (s) { return s.bodies[0].found; }, 30);
ok(seen, '路中央的屍體會被巡邏哨兵發現');

/* ---------- 5. 誘餌 ---------- */
section('誘餌');
var st7 = Engine.create(LEVEL1);
var g2g = Engine.guardById(st7, 'g2');
g2g.sweep = null;
var wolf7 = Engine.unitById(st7, 'wolf');
wolf7.x = px(17, 17).x; wolf7.y = px(17, 17).y;
Engine.throwDecoy(st7, 'wolf', px(15, 19).x, px(15, 19).y);
var lured = runUntil(st7, function (s) { return g2g.state === 'sus'; }, 3);
ok(lured, '誘餌聲響 → 哨兵起疑離開崗位');

/* ---------- 6. 後勤通關（無哨兵，驗任務鏈幾何永遠可解） ---------- */
section('後勤通關腳本');
var W = Engine.create(LEVEL1);
W.guards.forEach(function (g) { g.alive = false; });

function moveAndWait(id, c, r, timeout) {
  var p = px(c, r);
  Engine.orderMove(W, id, p.x, p.y);
  var u = Engine.unitById(W, id);
  return runUntil(W, function () { return H.dist(u.x, u.y, p.x, p.y) < 8; }, timeout || 40);
}

ok(moveAndWait('wolf', 21, 13), '狼走到碼頭');
Engine.interact(W, 'wolf');
ok(Engine.unitById(W, 'wolf').inBoat, '狼上船');
ok(moveAndWait('fox', 21, 13), '狐走到碼頭');
Engine.interact(W, 'fox');
ok(moveAndWait('seal', 21, 13), '海豹走到碼頭');
Engine.interact(W, 'seal');
ok(W.boat.crew.length === 3, '三人都上船');
ok(W.flags.boatBoarded, '目標 1：奪取小艇 ✓');

Engine.orderBoatMove(W, px(31, 9).x, px(31, 9).y);
ok(runUntil(W, function (s) { return H.dist(s.boat.x, s.boat.y, px(31, 9).x, px(31, 9).y) < 8; }, 40), '小艇渡海到北島西岸');
Engine.interact(W, 'seal');
ok(W.flags.landedIsland, '目標 2：登上北島 ✓');
ok(!Engine.unitById(W, 'wolf').inBoat, '全員上岸');

ok(moveAndWait('wolf', 31, 5), '狼走到油桶');
Engine.pickDrop(W, 'wolf');
ok(Engine.unitById(W, 'wolf').carrying && Engine.unitById(W, 'wolf').carrying.type === 'barrel', '狼扛起油桶');
ok(moveAndWait('wolf', 41, 5, 60), '狼扛油桶走到中繼站');
Engine.interact(W, 'wolf');
ok(W.barrels.some(function (b) { return b.placed; }), '油桶就定位');
Engine.interact(W, 'wolf');
ok(W.barrels.some(function (b) { return b.fuse > 0; }), '引信點燃');
ok(moveAndWait('wolf', 33, 8, 20), '狼撤到安全距離');
run(W, TUNING.fuseTime + 1);
ok(W.station.destroyed, '目標 3：中繼站炸毀 ✓');
ok(Engine.unitById(W, 'wolf').alive, '狼活著（撤離及時）');

ok(moveAndWait('wolf', 32, 9), '狼回到岸邊');
Engine.interact(W, 'wolf');
ok(moveAndWait('fox', 32, 9), '狐回到岸邊');
Engine.interact(W, 'fox');
ok(moveAndWait('seal', 32, 9), '海豹回到岸邊');
Engine.interact(W, 'seal');
ok(W.boat.crew.length === 3, '三人重新上船');

Engine.orderBoatMove(W, boatStart.x, boatStart.y);
runUntil(W, function (s) { return s.result === 'win'; }, 40);
ok(W.result === 'win', '目標 4：返回南岸碼頭 → 任務完成 ✓✓✓');

/* ---------- 7. 快速存讀檔 ---------- */
section('快速存讀檔');
var st8 = Engine.create(LEVEL1);
Engine.orderMove(st8, 'wolf', px(10, 28).x, px(10, 28).y);
run(st8, 2);
var snap = Engine.save(st8);
var beforeX = Engine.unitById(st8, 'wolf').x;
run(st8, 3);
var restored = Engine.load(snap);
ok(Math.abs(Engine.unitById(restored, 'wolf').x - beforeX) < 0.001, '讀檔還原位置');
Engine.update(restored, 1 / 30);
ok(true, '讀檔後引擎可繼續推進');

/* ---------- 結果 ---------- */
console.log('\n========================');
console.log('通過 ' + passed + ' / ' + (passed + failed));
if (failed > 0) { console.log('有 ' + failed + ' 項失敗'); process.exit(1); }
console.log('全部通過');
