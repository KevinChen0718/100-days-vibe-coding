/* 霜峽行動 — 遊戲引擎（純邏輯、零 DOM，Node 可測）
 * 系統：A* 尋路、視野錐雙區偵測、敵兵三態 FSM（巡邏/起疑/警戒）、
 *       刀殺/手槍/搬運/誘餌/小艇/油桶引信、快速存讀檔。
 */
'use strict';

(function (root) {

if (typeof require !== 'undefined' && typeof module !== 'undefined') {
  var D = require('./data.js');
  var TILE = D.TILE, TUNING = D.TUNING;
} else {
  var TILE = root.TILE, TUNING = root.TUNING;
}

var FOV = TUNING.fovDeg * Math.PI / 180;
var REAR_ARC = TUNING.rearArcDeg * Math.PI / 180;

/* ---------- 幾何小工具 ---------- */
function dist(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
function norm(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
function angleDiff(a, b) { return norm(b - a); }

/* ---------- 地圖 ---------- */
function tileAt(map, c, r) {
  if (r < 0 || r >= map.length || c < 0 || c >= map[0].length) return '#';
  return map[r][c];
}
function walkable(ch) { return ch === '.' || ch === 'r' || ch === 'D' || ch === 'b'; }
function boatable(ch) { return ch === '~'; }
function blocksVision(ch) { return ch === 'T' || ch === 'R' || ch === '#'; }

function tileOfPx(x, y) { return { c: Math.floor(x / TILE), r: Math.floor(y / TILE) }; }
function centerOfTile(c, r) { return { x: (c + 0.5) * TILE, y: (r + 0.5) * TILE }; }

/* 視線：沿線每 8px 取樣，碰到遮蔽物即斷 */
function los(map, x0, y0, x1, y1) {
  var d = dist(x0, y0, x1, y1);
  var steps = Math.max(1, Math.ceil(d / 8));
  for (var i = 1; i < steps; i++) {
    var t = i / steps;
    var x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    var tl = tileOfPx(x, y);
    if (blocksVision(tileAt(map, tl.c, tl.r))) return false;
  }
  return true;
}

/* ---------- A* 尋路（8 方向，禁切角） ---------- */
function findPath(map, sx, sy, tx, ty, passFn) {
  var W = map[0].length, H = map.length;
  var s = tileOfPx(sx, sy), t = tileOfPx(tx, ty);
  if (!passFn(tileAt(map, t.c, t.r))) {
    // 目標不可走 → 找最近可走鄰格
    var best = null, bestD = 1e9;
    for (var rr = -2; rr <= 2; rr++) for (var cc = -2; cc <= 2; cc++) {
      var nc = t.c + cc, nr = t.r + rr;
      if (!passFn(tileAt(map, nc, nr))) continue;
      var dd = Math.abs(cc) + Math.abs(rr);
      if (dd < bestD) { bestD = dd; best = { c: nc, r: nr }; }
    }
    if (!best) return null;
    t = best;
  }
  if (s.c === t.c && s.r === t.r) return [];
  var key = function (c, r) { return r * W + c; };
  var open = [{ c: s.c, r: s.r, g: 0, f: 0, parent: null }];
  var seen = {}; seen[key(s.c, s.r)] = open[0];
  var closed = {};
  var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  var iter = 0;
  while (open.length && iter++ < 6000) {
    var bi = 0;
    for (var i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    var cur = open.splice(bi, 1)[0];
    if (cur.c === t.c && cur.r === t.r) {
      var path = [];
      var n = cur;
      while (n.parent) { var p = centerOfTile(n.c, n.r); path.unshift(p); n = n.parent; }
      return path;
    }
    closed[key(cur.c, cur.r)] = true;
    for (var di = 0; di < 8; di++) {
      var dc = dirs[di][0], dr = dirs[di][1];
      var nc2 = cur.c + dc, nr2 = cur.r + dr;
      if (!passFn(tileAt(map, nc2, nr2))) continue;
      if (dc !== 0 && dr !== 0) { // 禁切角
        if (!passFn(tileAt(map, cur.c + dc, cur.r)) || !passFn(tileAt(map, cur.c, cur.r + dr))) continue;
      }
      var k = key(nc2, nr2);
      if (closed[k]) continue;
      var g = cur.g + ((dc !== 0 && dr !== 0) ? 1.414 : 1);
      var ex = seen[k];
      if (ex && ex.g <= g) continue;
      var dx = Math.abs(t.c - nc2), dy = Math.abs(t.r - nr2);
      var h = Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
      var node = { c: nc2, r: nr2, g: g, f: g + h, parent: cur };
      if (ex) { ex.g = g; ex.f = g + h; ex.parent = cur; }
      else { seen[k] = node; open.push(node); }
    }
  }
  return null;
}

/* ---------- 建立關卡 ---------- */
function create(level) {
  var state = {
    t: 0,
    map: level.map,
    level: level,
    result: null,
    failReason: '',
    selected: level.units[0].id,
    units: level.units.map(function (u) {
      var p = centerOfTile(u.tx, u.ty);
      return {
        id: u.id, name: u.name, kind: u.kind,
        x: p.x, y: p.y, dir: -Math.PI / 2,
        hp: TUNING.unitHp, alive: true,
        crouch: false, inBoat: false,
        path: null, action: null, carrying: null,
        ammo: u.kind === 'fox' ? TUNING.pistolAmmo : 0,
        stepDist: 0, stepSide: 1, repathT: 0
      };
    }),
    guards: level.guards.map(function (g) {
      var pos;
      if (g.type === 'static') pos = centerOfTile(g.tx, g.ty);
      else pos = centerOfTile(g.waypoints[0][0], g.waypoints[0][1]);
      return {
        id: g.id, type: g.type,
        x: pos.x, y: pos.y,
        homeX: pos.x, homeY: pos.y,
        dir: g.dir || 0, homeDir: g.dir || 0,
        sweep: g.sweep || null,
        waypoints: g.waypoints || null, wpIndex: 1, wpDir: 1,
        state: 'patrol', meter: 0, alive: true,
        path: null, susPoint: null, susTimer: 0, susDwell: TUNING.susDwell,
        target: null, lastSeen: null, loseT: 0,
        aimT: 0, shotT: 0, repathT: 0, shouted: false
      };
    }),
    bodies: [],
    barrels: level.barrels.map(function (b, i) {
      var p = centerOfTile(b.tx, b.ty);
      return { id: 'b' + i, x: p.x, y: p.y, carried: false, placed: false, fuse: -1, exploded: false };
    }),
    boat: (function () {
      return { x: level.boat.tx * TILE + TILE / 2, y: level.boat.ty * TILE + TILE / 2, crew: [], path: null, dir: Math.PI / 2 };
    })(),
    decoys: [],
    footprints: [],
    effects: [],
    noises: [],
    events: [],
    station: { destroyed: false },
    flags: { boatBoarded: false, landedIsland: false, stationDown: false, extracted: false },
    hint: ''
  };
  return state;
}

function unitById(state, id) {
  for (var i = 0; i < state.units.length; i++) if (state.units[i].id === id) return state.units[i];
  return null;
}
function guardById(state, id) {
  for (var i = 0; i < state.guards.length; i++) if (state.guards[i].id === id) return state.guards[i];
  return null;
}

/* ---------- 玩家指令 ---------- */
function orderMove(state, unitId, x, y) {
  var u = unitById(state, unitId);
  if (!u || !u.alive || u.inBoat) return;
  u.action = null;
  u.path = findPath(state.map, u.x, u.y, x, y, walkable);
}

function orderKnife(state, unitId, guardId) {
  var u = unitById(state, unitId);
  if (!u || !u.alive || u.kind !== 'wolf' || u.inBoat || u.carrying) return;
  u.action = { type: 'knife', guardId: guardId };
  u.repathT = 0;
}

function orderShoot(state, unitId, guardId) {
  var u = unitById(state, unitId);
  if (!u || !u.alive || u.kind !== 'fox' || u.inBoat) return;
  if (u.ammo <= 0) { state.hint = '手槍沒子彈了'; state.events.push('dryfire'); return; }
  u.action = { type: 'shoot', guardId: guardId };
  u.repathT = 0;
}

function toggleCrouch(state, unitId) {
  var u = unitById(state, unitId);
  if (!u || !u.alive || u.inBoat) return;
  if (u.carrying) { state.hint = '搬著東西無法蹲低'; return; }
  u.crouch = !u.crouch;
}

function throwDecoy(state, unitId, x, y) {
  var u = unitById(state, unitId);
  if (!u || !u.alive || u.kind !== 'wolf' || u.inBoat) return;
  var d = dist(u.x, u.y, x, y);
  var max = 6 * TILE;
  if (d > max) { var k = max / d; x = u.x + (x - u.x) * k; y = u.y + (y - u.y) * k; }
  state.decoys.push({ x: x, y: y, life: TUNING.decoyLife, pulse: 0 });
  state.events.push('decoy');
}

function pickDrop(state, unitId) {
  var u = unitById(state, unitId);
  if (!u || !u.alive || u.kind !== 'wolf' || u.inBoat) return;
  if (u.carrying) {
    var c = u.carrying;
    if (c.type === 'body') {
      var b = state.bodies[c.index];
      b.x = u.x; b.y = u.y; b.carried = false;
      var tl = tileOfPx(u.x, u.y);
      b.hidden = tileAt(state.map, tl.c, tl.r) === 'b';
      state.hint = b.hidden ? '屍體藏進灌木了' : '屍體放在地上（會被看見）';
    } else {
      var br = state.barrels[c.index];
      br.x = u.x; br.y = u.y; br.carried = false;
      br.placed = inPlantZone(state, u.x, u.y);
      state.hint = br.placed ? '油桶就定位！按 F 點燃引信' : '油桶放下了';
    }
    u.carrying = null;
    return;
  }
  // 撿東西：優先屍體，再油桶
  for (var i = 0; i < state.bodies.length; i++) {
    var bd = state.bodies[i];
    if (!bd.carried && dist(u.x, u.y, bd.x, bd.y) <= TUNING.interactRange) {
      bd.carried = true; u.carrying = { type: 'body', index: i }; u.crouch = false;
      state.hint = '搬起屍體（速度變慢、無法蹲低）';
      return;
    }
  }
  for (var j = 0; j < state.barrels.length; j++) {
    var bl = state.barrels[j];
    if (!bl.carried && !bl.exploded && bl.fuse < 0 && dist(u.x, u.y, bl.x, bl.y) <= TUNING.interactRange) {
      bl.carried = true; bl.placed = false; u.carrying = { type: 'barrel', index: j }; u.crouch = false;
      state.hint = '扛起油桶（搬到中繼站旁）';
      return;
    }
  }
  state.hint = '附近沒有可搬的東西（狼專屬）';
}

function inPlantZone(state, x, y) {
  var tl = tileOfPx(x, y);
  var zone = state.level.plantZone;
  for (var i = 0; i < zone.length; i++) {
    if (Math.abs(zone[i][0] - tl.c) <= 1 && Math.abs(zone[i][1] - tl.r) <= 1) return true;
  }
  return false;
}

function interact(state, unitId) {
  var u = unitById(state, unitId);
  if (!u || !u.alive) return;
  var boat = state.boat;
  // 1) 在船上 → 靠岸下船
  if (u.inBoat) {
    var landing = findLanding(state);
    if (!landing) { state.hint = '這裡無法靠岸'; return; }
    var crew = boat.crew.slice();
    for (var i = 0; i < crew.length; i++) {
      var cu = unitById(state, crew[i]);
      cu.inBoat = false;
      cu.x = landing.x + (i - 1) * 12;
      cu.y = landing.y;
      cu.path = null;
    }
    boat.crew = []; boat.path = null;
    if (boat.y < 11 * TILE) state.flags.landedIsland = true;
    state.events.push('splash');
    state.hint = '上岸了';
    return;
  }
  // 2) 放置油桶（搬著油桶且站在中繼站旁）
  if (u.carrying && u.carrying.type === 'barrel' && inPlantZone(state, u.x, u.y)) {
    var br = state.barrels[u.carrying.index];
    br.x = u.x; br.y = u.y; br.carried = false; br.placed = true;
    u.carrying = null;
    state.hint = '油桶就定位！再按 F 點燃引信';
    return;
  }
  // 3) 點燃引信
  for (var j = 0; j < state.barrels.length; j++) {
    var bl = state.barrels[j];
    if (bl.placed && !bl.carried && bl.fuse < 0 && !bl.exploded &&
        dist(u.x, u.y, bl.x, bl.y) <= TUNING.interactRange) {
      bl.fuse = TUNING.fuseTime;
      state.events.push('fuse');
      state.hint = '引信點燃！' + TUNING.fuseTime + ' 秒後爆炸，快跑！';
      return;
    }
  }
  // 4) 上船
  if (dist(u.x, u.y, boat.x, boat.y) <= TUNING.boardRange) {
    u.inBoat = true; u.path = null; u.action = null; u.crouch = false;
    if (u.carrying) { pickDrop(state, u.id); } // 上船前放下
    boat.crew.push(u.id);
    state.flags.boatBoarded = true;
    state.events.push('board');
    state.hint = u.kind === 'seal' ? '海豹掌舵：點水面移動小艇' : '上船了（要海豹掌舵才能開）';
    return;
  }
  state.hint = '這裡沒有可互動的東西';
}

function findLanding(state) {
  var boat = state.boat;
  var bt = tileOfPx(boat.x, boat.y);
  var best = null, bestD = 1e9;
  for (var r = -2; r <= 2; r++) for (var c = -2; c <= 2; c++) {
    var ch = tileAt(state.map, bt.c + c, bt.r + r);
    if (!walkable(ch)) continue;
    var p = centerOfTile(bt.c + c, bt.r + r);
    var d = dist(boat.x, boat.y, p.x, p.y);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

function orderBoatMove(state, x, y) {
  var boat = state.boat;
  var seal = null;
  for (var i = 0; i < boat.crew.length; i++) {
    var u = unitById(state, boat.crew[i]);
    if (u && u.kind === 'seal' && u.alive) seal = u;
  }
  if (!seal) { state.hint = '需要海豹掌舵'; return; }
  boat.path = findPath(state.map, boat.x, boat.y, x, y, boatable);
}

/* ---------- 偵測 ---------- */
/* 回傳 0 = 看不到；>0 = 目擊值累積速率 */
function visRate(state, guard, x, y, crouched, carrying) {
  var d = dist(guard.x, guard.y, x, y);
  if (d > TUNING.farRange) return 0;
  var ang = Math.abs(angleDiff(guard.dir, Math.atan2(y - guard.y, x - guard.x)));
  var fov = guard.state === 'alert' ? FOV * 1.4 : FOV;
  if (ang > fov / 2) return 0;
  if (!los(state.map, guard.x, guard.y, x, y)) return 0;
  if (d <= TUNING.nearRange) return TUNING.rateNear;
  if (crouched && !carrying && guard.state !== 'alert') return 0; // 遠區蹲低 = 隱形
  return carrying ? TUNING.rateCarry : TUNING.rateFar;
}

function setSus(state, guard, x, y, dwell) {
  if (guard.state === 'alert' || !guard.alive) return;
  guard.state = 'sus';
  guard.susPoint = { x: x, y: y };
  guard.susTimer = 0;
  guard.susDwell = dwell || TUNING.susDwell;
  guard.path = findPath(state.map, guard.x, guard.y, x, y, walkable);
  state.events.push('sus');
}

function setAlert(state, guard, targetId, x, y) {
  if (!guard.alive) return;
  if (guard.state !== 'alert') {
    state.events.push('alert');
    // 呼喊：附近隊友起疑趕來
    state.noises.push({ x: guard.x, y: guard.y, radius: TUNING.shoutNoise, kind: 'shout', sx: x, sy: y });
  }
  guard.state = 'alert';
  guard.target = targetId;
  guard.lastSeen = { x: x, y: y };
  guard.loseT = 0;
}

/* ---------- 主迴圈 ---------- */
function update(state, dt) {
  if (state.result) return;
  state.t += dt;

  updateDecoys(state, dt);
  updateFuses(state, dt);
  updateUnits(state, dt);
  updateBoat(state, dt);
  updateGuards(state, dt);
  updateFootprints(state, dt);
  updateEffects(state, dt);

  checkResult(state);
}

function updateDecoys(state, dt) {
  for (var i = state.decoys.length - 1; i >= 0; i--) {
    var d = state.decoys[i];
    d.life -= dt; d.pulse -= dt;
    if (d.pulse <= 0) {
      d.pulse = 1.2;
      state.noises.push({ x: d.x, y: d.y, radius: TUNING.decoyNoise, kind: 'decoy', fresh: true });
      state.events.push('beep');
    }
    if (d.life <= 0) state.decoys.splice(i, 1);
  }
}

function updateFuses(state, dt) {
  for (var i = 0; i < state.barrels.length; i++) {
    var b = state.barrels[i];
    if (b.fuse >= 0 && !b.exploded) {
      b.fuse -= dt;
      if (b.fuse <= 0) explode(state, b);
    }
  }
}

function explode(state, barrel) {
  barrel.exploded = true; barrel.fuse = -1;
  state.effects.push({ type: 'boom', x: barrel.x, y: barrel.y, t: 0 });
  state.events.push('boom');
  state.noises.push({ x: barrel.x, y: barrel.y, radius: 9999, kind: 'boom', fresh: true });
  // 殺傷範圍
  state.units.forEach(function (u) {
    if (u.alive && !u.inBoat && dist(u.x, u.y, barrel.x, barrel.y) <= TUNING.blastRadius) {
      u.alive = false; u.hp = 0;
    }
  });
  state.guards.forEach(function (g) {
    if (g.alive && dist(g.x, g.y, barrel.x, barrel.y) <= TUNING.blastRadius) {
      g.alive = false;
      state.bodies.push({ x: g.x, y: g.y, carried: false, hidden: false, found: true });
    }
  });
  // 引爆判定：油桶在中繼站區 → 任務目標達成
  if (inPlantZone(state, barrel.x, barrel.y)) {
    state.station.destroyed = true;
    state.flags.stationDown = true;
    state.hint = '中繼站炸毀！全員回船，返回南岸碼頭';
  }
  // 連鎖引爆
  state.barrels.forEach(function (b2) {
    if (!b2.exploded && b2.fuse < 0 && !b2.carried &&
        dist(b2.x, b2.y, barrel.x, barrel.y) <= TUNING.blastRadius) b2.fuse = 0.35;
  });
}

function moveAlong(state, ent, speed, dt, emitSteps, unit) {
  if (!ent.path || !ent.path.length) return false;
  var wp = ent.path[0];
  var d = dist(ent.x, ent.y, wp.x, wp.y);
  if (d < 4) { ent.path.shift(); return ent.path.length > 0; }
  var vx = (wp.x - ent.x) / d, vy = (wp.y - ent.y) / d;
  var step = Math.min(speed * dt, d);
  ent.x += vx * step; ent.y += vy * step;
  ent.dir = Math.atan2(vy, vx);
  if (emitSteps && unit) {
    unit.stepDist += step;
    if (unit.stepDist > 20) {
      unit.stepDist = 0; unit.stepSide *= -1;
      var tl = tileOfPx(ent.x, ent.y);
      if (tileAt(state.map, tl.c, tl.r) === '.') {
        state.footprints.push({ x: ent.x - vy * 5 * unit.stepSide, y: ent.y + vx * 5 * unit.stepSide, dir: ent.dir, age: 0 });
        if (state.footprints.length > 500) state.footprints.shift();
      }
    }
  }
  return true;
}

function updateUnits(state, dt) {
  state.units.forEach(function (u) {
    if (!u.alive || u.inBoat) return;
    // 動作：刀殺 / 射擊
    if (u.action) {
      var g = guardById(state, u.action.guardId);
      if (!g || !g.alive) { u.action = null; }
      else if (u.action.type === 'knife') {
        var d = dist(u.x, u.y, g.x, g.y);
        if (d <= TUNING.knifeRange) {
          var rel = Math.abs(angleDiff(norm(g.dir + Math.PI), Math.atan2(u.y - g.y, u.x - g.x)));
          if (rel <= REAR_ARC / 2) {
            g.alive = false;
            state.bodies.push({ x: g.x, y: g.y, carried: false, hidden: false, found: false });
            state.noises.push({ x: g.x, y: g.y, radius: 1.5 * TILE, kind: 'shout', sx: g.x, sy: g.y, fresh: true });
            state.events.push('knife');
            state.hint = '無聲解決。記得把屍體拖走（E）';
          } else {
            state.hint = '正面刀不到——繞到背後';
          }
          u.action = null; u.path = null;
        } else {
          u.repathT -= dt;
          if (u.repathT <= 0) {
            u.repathT = 0.5;
            var bx = g.x - Math.cos(g.dir) * 22, by = g.y - Math.sin(g.dir) * 22;
            u.path = findPath(state.map, u.x, u.y, bx, by, walkable);
          }
          // 最後一步直線突進（A* 只到格子中心，貼身要靠這步）
          if ((!u.path || !u.path.length) && d < 2.5 * TILE) {
            var lv = Math.atan2(g.y - u.y, g.x - u.x);
            var sp = (u.crouch ? TUNING.crouchSpeed : TUNING.walkSpeed) * dt;
            u.x += Math.cos(lv) * sp; u.y += Math.sin(lv) * sp;
            u.dir = lv;
          }
        }
      } else if (u.action.type === 'shoot') {
        var d2 = dist(u.x, u.y, g.x, g.y);
        if (d2 <= TUNING.pistolRange && los(state.map, u.x, u.y, g.x, g.y)) {
          u.ammo--;
          g.alive = false;
          state.bodies.push({ x: g.x, y: g.y, carried: false, hidden: false, found: false });
          state.noises.push({ x: u.x, y: u.y, radius: TUNING.shotNoise, kind: 'shot', fresh: true });
          state.events.push('shot');
          u.dir = Math.atan2(g.y - u.y, g.x - u.x);
          u.action = null; u.path = null;
          state.hint = '目標倒下（剩 ' + u.ammo + ' 發）——槍聲會引來敵兵';
        } else {
          u.repathT -= dt;
          if (u.repathT <= 0) {
            u.repathT = 0.5;
            u.path = findPath(state.map, u.x, u.y, g.x, g.y, walkable);
          }
        }
      }
    }
    var speed = u.carrying ? TUNING.carrySpeed : (u.crouch ? TUNING.crouchSpeed : TUNING.walkSpeed);
    moveAlong(state, u, speed, dt, true, u);
    if (u.carrying) {
      var c = u.carrying;
      var obj = c.type === 'body' ? state.bodies[c.index] : state.barrels[c.index];
      obj.x = u.x; obj.y = u.y;
    }
  });
}

function updateBoat(state, dt) {
  var boat = state.boat;
  if (boat.path && boat.path.length) {
    moveAlong(state, boat, TUNING.boatSpeed, dt, false, null);
  }
  boat.crew.forEach(function (id) {
    var u = unitById(state, id);
    if (u) { u.x = boat.x; u.y = boat.y; }
  });
}

function updateGuards(state, dt) {
  // 取走本幀之前累積的噪音；處理中新產生的（呼喊）留到下一幀
  var noises = state.noises;
  state.noises = [];
  state.guards.forEach(function (g) {
    if (!g.alive) return;

    /* --- 知覺：找最顯眼的目標 --- */
    var bestRate = 0, seenX = 0, seenY = 0, seenId = null;
    state.units.forEach(function (u) {
      if (!u.alive || u.inBoat) return;
      var r = visRate(state, g, u.x, u.y, u.crouch, !!u.carrying);
      if (r > bestRate) { bestRate = r; seenX = u.x; seenY = u.y; seenId = u.id; }
    });
    // 小艇載人時也是目標（站立規則）
    if (state.boat.crew.length) {
      var rb = visRate(state, g, state.boat.x, state.boat.y, false, false);
      if (rb > bestRate) { bestRate = rb; seenX = state.boat.x; seenY = state.boat.y; seenId = state.boat.crew[0]; }
    }
    if (bestRate > 0) {
      g.meter = Math.min(1.2, g.meter + bestRate * dt);
      g.lastSeen = { x: seenX, y: seenY };
      if (g.meter >= 1) setAlert(state, g, seenId, seenX, seenY);
      else if (g.meter >= TUNING.susThreshold && g.state === 'patrol') setSus(state, g, seenX, seenY);
    } else {
      g.meter = Math.max(0, g.meter - TUNING.meterDecay * dt);
    }

    /* --- 發現屍體 --- */
    for (var bi = 0; bi < state.bodies.length; bi++) {
      var bd = state.bodies[bi];
      if (bd.found || bd.hidden || bd.carried) continue;
      if (visRate(state, g, bd.x, bd.y, false, false) > 0) {
        bd.found = true;
        setSus(state, g, bd.x, bd.y, 4.5);
        state.noises.push({ x: g.x, y: g.y, radius: TUNING.shoutNoise, kind: 'shout', sx: bd.x, sy: bd.y, fresh: true });
        state.events.push('alert');
      }
    }

    /* --- 聽覺 --- */
    for (var ni = 0; ni < noises.length; ni++) {
      var n = noises[ni];
      if (dist(g.x, g.y, n.x, n.y) > n.radius) continue;
      if (g.state === 'alert') continue;
      var px = n.kind === 'shout' && n.sx !== undefined ? n.sx : n.x;
      var py = n.kind === 'shout' && n.sy !== undefined ? n.sy : n.y;
      setSus(state, g, px, py, n.kind === 'decoy' ? 3.5 : TUNING.susDwell);
    }

    /* --- 狀態行為 --- */
    if (g.state === 'patrol') {
      if (g.type === 'static') {
        if (dist(g.x, g.y, g.homeX, g.homeY) > 6) {
          if (!g.path || !g.path.length) g.path = findPath(state.map, g.x, g.y, g.homeX, g.homeY, walkable);
          moveAlong(state, g, TUNING.guardSpeed, dt, false, null);
        } else if (g.sweep) {
          g.dir = g.homeDir + g.sweep.amp * Math.sin(state.t * 2 * Math.PI / g.sweep.period);
        }
      } else {
        if (!g.path || !g.path.length) {
          var wp = g.waypoints[g.wpIndex];
          var tgt = centerOfTile(wp[0], wp[1]);
          if (dist(g.x, g.y, tgt.x, tgt.y) < 6) {
            g.wpIndex += g.wpDir;
            if (g.wpIndex >= g.waypoints.length) { g.wpIndex = g.waypoints.length - 2; g.wpDir = -1; }
            if (g.wpIndex < 0) { g.wpIndex = 1; g.wpDir = 1; }
            wp = g.waypoints[g.wpIndex];
            tgt = centerOfTile(wp[0], wp[1]);
          }
          g.path = findPath(state.map, g.x, g.y, tgt.x, tgt.y, walkable);
        }
        moveAlong(state, g, TUNING.guardSpeed, dt, false, null);
      }
    } else if (g.state === 'sus') {
      if (g.path && g.path.length) {
        moveAlong(state, g, TUNING.guardSusSpeed, dt, false, null);
      } else {
        g.susTimer += dt;
        g.dir += Math.sin(state.t * 3) * 1.2 * dt + 0.6 * dt; // 東張西望
        if (g.susTimer >= g.susDwell && g.meter < 0.05) {
          g.state = 'patrol'; g.path = null; g.susPoint = null;
        }
      }
    } else if (g.state === 'alert') {
      var tu = unitById(state, g.target);
      if (!tu || !tu.alive) {
        g.state = 'sus'; g.susTimer = 0; g.path = null;
        if (g.lastSeen) g.path = findPath(state.map, g.x, g.y, g.lastSeen.x, g.lastSeen.y, walkable);
      } else {
        var visible = !tu.inBoat && visRate(state, g, tu.x, tu.y, tu.crouch, !!tu.carrying) > 0;
        if (tu.inBoat) visible = visRate(state, g, state.boat.x, state.boat.y, false, false) > 0;
        var tx = tu.inBoat ? state.boat.x : tu.x;
        var ty = tu.inBoat ? state.boat.y : tu.y;
        if (visible) { g.lastSeen = { x: tx, y: ty }; g.loseT = 0; } else { g.loseT += dt; }
        if (g.loseT > TUNING.loseSightTime) {
          g.state = 'sus'; g.susTimer = 0; g.meter = 0.5;
          g.path = findPath(state.map, g.x, g.y, g.lastSeen.x, g.lastSeen.y, walkable);
        } else {
          var dT = dist(g.x, g.y, tx, ty);
          if (visible && dT <= TUNING.shootRange) {
            g.path = null;
            g.dir = Math.atan2(ty - g.y, tx - g.x);
            g.aimT += dt;
            if (g.aimT >= TUNING.aimTime) {
              g.shotT -= dt;
              if (g.shotT <= 0) {
                g.shotT = TUNING.shotInterval;
                state.events.push('gshot');
                state.noises.push({ x: g.x, y: g.y, radius: TUNING.shotNoise, kind: 'shot', fresh: true });
                tu.hp -= 1;
                if (tu.hp <= 0) {
                  tu.alive = false;
                  state.result = 'fail';
                  state.failReason = tu.name + ' 陣亡。任何隊員倒下，任務即告失敗。';
                }
              }
            }
          } else {
            g.aimT = 0;
            g.repathT -= dt;
            if (g.repathT <= 0 || !g.path) {
              g.repathT = 0.7;
              g.path = findPath(state.map, g.x, g.y, g.lastSeen.x, g.lastSeen.y, walkable);
            }
            moveAlong(state, g, TUNING.guardAlertSpeed, dt, false, null);
          }
        }
      }
    }
  });
}

function updateFootprints(state, dt) {
  for (var i = state.footprints.length - 1; i >= 0; i--) {
    state.footprints[i].age += dt;
    if (state.footprints[i].age > 22) state.footprints.splice(i, 1);
  }
}

function updateEffects(state, dt) {
  for (var i = state.effects.length - 1; i >= 0; i--) {
    state.effects[i].t += dt;
    if (state.effects[i].t > 2.2) state.effects.splice(i, 1);
  }
}

function checkResult(state) {
  if (state.result) return;
  for (var i = 0; i < state.units.length; i++) {
    if (!state.units[i].alive) {
      state.result = 'fail';
      state.failReason = state.failReason || (state.units[i].name + ' 陣亡。任何隊員倒下，任務即告失敗。');
      return;
    }
  }
  if (state.station.destroyed) {
    var moor = state.level.moor;
    var mx = moor.tx * TILE + TILE / 2, my = moor.ty * TILE + TILE / 2;
    var allAboard = state.units.every(function (u) { return u.inBoat; });
    if (allAboard && dist(state.boat.x, state.boat.y, mx, my) < 2 * TILE) {
      state.flags.extracted = true;
      state.result = 'win';
    }
  }
}

/* ---------- 快速存讀檔 ---------- */
function save(state) {
  return JSON.stringify(state);
}
function load(json) {
  return JSON.parse(json);
}

var Engine = {
  create: create,
  update: update,
  orderMove: orderMove,
  orderKnife: orderKnife,
  orderShoot: orderShoot,
  orderBoatMove: orderBoatMove,
  toggleCrouch: toggleCrouch,
  throwDecoy: throwDecoy,
  pickDrop: pickDrop,
  interact: interact,
  save: save,
  load: load,
  unitById: unitById,
  guardById: guardById,
  helpers: {
    findPath: findPath, los: los, visRate: visRate, tileAt: tileAt,
    walkable: walkable, boatable: boatable, dist: dist,
    centerOfTile: centerOfTile, tileOfPx: tileOfPx, inPlantZone: inPlantZone
  }
};

if (typeof module !== 'undefined') module.exports = Engine;
else root.Engine = Engine;

})(typeof window !== 'undefined' ? window : globalThis);
