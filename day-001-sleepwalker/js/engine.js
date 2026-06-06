/*
 * 夢遊先生 Mr. Sleepwalker — 物理引擎（純運算，不碰 DOM）
 * 可在瀏覽器與 Node 兩種環境執行，方便自動化關卡可解性測試。
 *
 * 座標系：左上角為原點，y 軸向下為正。單位：像素 / 每個固定步（60 步/秒）。
 *
 * 機制：
 *  - 夢遊先生自動往前走、碰牆轉身、會墜落（過高摔醒）。
 *  - 可移動物件：plank/box/spring/mattress（玩家拖放）。
 *  - 傳送門 portals：走進去從連結的另一個門冒出來（立體進出感）。
 *  - 移動平台 movers：會週期移動的升降梯/平台，站上去會被帶著走。
 */
(function (root) {
  'use strict';

  var CONFIG = {
    WALKER_W: 20,         // 夢遊先生較小，讓屋頂場景顯得寬闊豐富
    WALKER_H: 34,
    GRAVITY: 0.55,
    TERMINAL: 12,
    WALK_SPEED: 0.9,      // 夢遊：慢吞吞地走
    STEP_HEIGHT: 13,
    MAX_SAFE_FALL: 100,   // 較矮的人摔得更容易，落差更需要處理
    SPRING_POWER: 14.5,
    LAUNCH_VX: 4.6,
    ANIM_SPEED: 0.13,
    PORTAL_CD: 26,
    STEP_DT: 1 / 60
  };

  // 軟著陸的道具型別（遮陽棚 / 煙霧雲）：落到上面不受傷
  function isSoft(t) { return t === 'awning' || t === 'mattress' || t === 'smoke'; }

  var WW = CONFIG.WALKER_W;
  var WH = CONFIG.WALKER_H;

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function hOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x;
  }

  function Game(level) { this.load(level); }

  Game.prototype.load = function (level) {
    this.level = level;
    var world = level.world || {};
    this.W = world.w || 960;
    this.H = world.h || 620;

    this.walker = {
      x: level.bed.x,
      y: level.bed.y - WH,
      vy: 0,
      launchVx: 0,
      launched: false,
      facing: level.startFacing || 1,
      onGround: false,
      airborne: false,
      peakFeet: 0,
      walkAnim: 0,
      portalCd: 0,
      riding: null,
      slide: null      // 溜煙囪/滑水管過場狀態
    };

    this.staticSolids = (level.solids || []).map(function (s) {
      return { x: s.x, y: s.y, w: s.w, h: s.h, kind: s.kind || 'floor' };
    });
    this.movables = (level.movables || []).map(function (m, i) {
      return {
        id: m.id != null ? m.id : 'm' + i,
        type: m.type,
        x: m.x, y: m.y, w: m.w, h: m.h,
        soft: isSoft(m.type),
        spring: m.type === 'spring',
        locked: false      // 被先生碰到後就固定，不能再拖
      };
    });
    // 移動平台
    this.movers = (level.movers || []).map(function (mv, i) {
      var amp = mv.amp || 0;
      var phase = mv.phase || 0;
      var off = Math.sin(phase) * amp;
      var m = {
        id: 'mv' + i, _mover: true,
        axis: mv.axis || 'y', amp: amp, speed: mv.speed || 0.02, phase: phase,
        baseX: mv.x, baseY: mv.y, w: mv.w, h: mv.h,
        x: mv.x + (mv.axis === 'x' ? off : 0),
        y: mv.y + (mv.axis === 'x' ? 0 : off),
        dx: 0, dy: 0
      };
      return m;
    });
    // 傳送門
    this.portals = (level.portals || []).map(function (p) {
      return { id: p.id, x: p.x, y: p.y, w: p.w, h: p.h, link: p.link, exitFacing: p.exitFacing, color: p.color };
    });

    this.hazards = (level.hazards || []).map(function (h) {
      return { x: h.x, y: h.y, w: h.w, h: h.h, kind: h.kind || 'spike' };
    });
    this.exit = level.exit ? { x: level.exit.x, y: level.exit.y, w: level.exit.w, h: level.exit.h } : null;

    this.state = 'ready';
    this.failReason = '';
    this.time = 0;
  };

  Game.prototype.reset = function () { this.load(this.level); };
  Game.prototype.start = function () {
    if (this.state === 'ready') { this.state = 'walking'; this.walker.onGround = true; }
  };
  Game.prototype._box = function (w) { return { x: w.x, y: w.y, w: WW, h: WH }; };
  Game.prototype.allSolids = function () {
    return this.staticSolids.concat(this.movables, this.movers);
  };

  Game.prototype.setMovable = function (id, x, y) {
    var m = null;
    for (var i = 0; i < this.movables.length; i++) if (this.movables[i].id === id) { m = this.movables[i]; break; }
    if (!m) return;
    m.x = Math.max(0, Math.min(this.W - m.w, x));
    m.y = Math.max(0, Math.min(this.H - m.h, y));
  };
  Game.prototype.movableAt = function (px, py) {
    for (var i = this.movables.length - 1; i >= 0; i--) {
      var m = this.movables[i];
      if (px >= m.x && px <= m.x + m.w && py >= m.y && py <= m.y + m.h) return m;
    }
    return null;
  };
  Game.prototype._fail = function (reason) { this.state = 'lost'; this.failReason = reason; };

  Game.prototype._updateMovers = function () {
    for (var i = 0; i < this.movers.length; i++) {
      var m = this.movers[i];
      var off = Math.sin(this.time * m.speed + m.phase) * m.amp;
      var nx = m.baseX + (m.axis === 'x' ? off : 0);
      var ny = m.baseY + (m.axis === 'x' ? 0 : off);
      m.dx = nx - m.x; m.dy = ny - m.y;
      m.x = nx; m.y = ny;
    }
  };

  Game.prototype.step = function () {
    if (this.state !== 'walking') return;
    this.time++;
    var w = this.walker;

    this._updateMovers();
    if (w.portalCd > 0) w.portalCd--;

    // 溜煙囪/滑水管過場：鑽進入口下沉 → 從出口滑出 → 恢復（騰空，之後正常墜落計傷）
    if (w.slide) {
      var sl = w.slide; sl.t++;
      if (sl.phase === 'in') {
        var ecx = sl.entry.x + sl.entry.w / 2;
        w.x += (ecx - WW / 2 - w.x) * 0.35;
        w.y += 3.2;
        if (sl.t >= 14) {
          sl.phase = 'out'; sl.t = 0;
          w.x = sl.exit.x + sl.exit.w / 2 - WW / 2;
          w.y = sl.exit.y + sl.exit.h - WH;
          if (sl.exit.exitFacing) w.facing = sl.exit.exitFacing;
        }
      } else {
        w.x += w.facing * 2.4;
        if (sl.t >= 12) {
          w.slide = null; w.portalCd = CONFIG.PORTAL_CD;
          w.vy = 0; w.airborne = true; w.onGround = false; w.peakFeet = w.y + WH; w.riding = null;
        }
      }
      return;
    }

    // 乘載：若正站在移動平台上，跟著它一起移動
    if (w.riding) {
      var mv = w.riding, box0 = this._box(w);
      if (hOverlap(box0, mv) && (w.y + WH) <= mv.y + 8 && (w.y + WH) >= mv.y - 10) {
        w.x += mv.dx;
        w.y = mv.y - WH;
      } else {
        w.riding = null;
      }
    }

    w.vy += CONFIG.GRAVITY;
    if (w.vy > CONFIG.TERMINAL) w.vy = CONFIG.TERMINAL;

    var solids = this.allSolids();
    this._moveHorizontal(w, solids);
    if (this.state !== 'walking') return;
    this._moveVertical(w, solids);
    if (this.state !== 'walking') return;

    if (w.onGround) w.walkAnim += CONFIG.ANIM_SPEED;

    // 被先生碰到的道具就固定（不能再拖走/反覆挪用，杜絕「拖一塊板子當地板送到底」）
    var contact = { x: w.x - 3, y: w.y - 3, w: WW + 6, h: WH + 6 };
    for (var mi = 0; mi < this.movables.length; mi++) {
      var mo = this.movables[mi];
      if (!mo.locked && overlap(contact, mo)) mo.locked = true;
    }

    // 水管/煙囪滑道：走到入口 → 開始「溜下去」的物理過場（不是瞬間傳送）
    if (w.portalCd === 0 && this.portals.length) {
      var cx = w.x + WW / 2, cy = w.y + WH / 2;
      for (var p = 0; p < this.portals.length; p++) {
        var pt = this.portals[p];
        if (cx >= pt.x && cx <= pt.x + pt.w && cy >= pt.y && cy <= pt.y + pt.h) {
          var dest = null;
          for (var q = 0; q < this.portals.length; q++) if (this.portals[q].id === pt.link) dest = this.portals[q];
          if (dest) {
            w.slide = { phase: 'in', t: 0, entry: pt, exit: dest };
            w.vy = 0; w.riding = null; w.onGround = false; w.airborne = false;
            return;
          }
        }
      }
    }

    var box = this._box(w);
    for (var i = 0; i < this.hazards.length; i++) {
      if (overlap(box, this.hazards[i])) { this._fail(hazardReason(this.hazards[i])); return; }
    }
    if (this.exit && overlap(box, this.exit)) { this.state = 'won'; return; }
    if (w.y > this.H + 80) { this._fail('摔下去，先生醒了！'); return; }
  };

  Game.prototype._moveHorizontal = function (w, solids) {
    var dx = (w.airborne && w.launchVx) ? w.launchVx : w.facing * CONFIG.WALK_SPEED;
    w.x += dx;
    var box = this._box(w);
    var feet = w.y + WH;
    var wall = false;
    var stepTop = Infinity;
    for (var i = 0; i < solids.length; i++) {
      var s = solids[i];
      if (!overlap(box, s)) continue;
      if (s.soft) { if (s.y < feet && s.y < stepTop) stepTop = s.y; continue; }  // 軟物會被踩扁→可踩上、不擋路
      if (s.y < feet - CONFIG.STEP_HEIGHT) { wall = true; break; }
      else if (s.y < feet) { if (s.y < stepTop) stepTop = s.y; }
    }
    if (wall) { w.x -= dx; w.facing *= -1; w.launchVx = 0; return; }
    if (stepTop !== Infinity && stepTop < w.y + WH) w.y = stepTop - WH;
  };

  Game.prototype._moveVertical = function (w, solids) {
    var oldFeet = w.y + WH, oldHead = w.y;
    w.y += w.vy;
    var box = this._box(w);
    var newFeet = w.y + WH, newHead = w.y;
    var i, s;

    if (w.vy >= 0) {
      var best = null;
      for (i = 0; i < solids.length; i++) {
        s = solids[i];
        if (!hOverlap(box, s)) continue;
        if (oldFeet <= s.y + 0.5 && newFeet >= s.y) { if (best === null || s.y < best.y) best = s; }
      }
      if (best) {
        w.y = best.y - WH;
        if (best.spring) {
          w.vy = -CONFIG.SPRING_POWER;
          w.launchVx = w.facing * CONFIG.LAUNCH_VX;
          w.launched = true;
          w.onGround = false; w.airborne = true; w.riding = null;
          w.peakFeet = w.y + WH;
        } else {
          var fall = best.y - w.peakFeet;
          var safeLanding = best.soft || w.launched;
          w.vy = 0; w.launchVx = 0; w.launched = false;
          w.onGround = true;
          w._softLand = !!best.soft;       // 落在軟物上 → 輕柔回饋
          w.riding = best._mover ? best : null;
          if (w.airborne) {
            w.airborne = false;
            if (!safeLanding && fall > CONFIG.MAX_SAFE_FALL) { this._fail('先生摔太重，醒過來了！'); return; }
          }
        }
      } else {
        if (w.onGround) { w.onGround = false; w.airborne = true; w.peakFeet = oldFeet; }
        w.riding = null;
        if (w.airborne) w.peakFeet = Math.min(w.peakFeet, newFeet);
      }
    } else {
      var ceil = null;
      for (i = 0; i < solids.length; i++) {
        s = solids[i];
        if (!hOverlap(box, s)) continue;
        if (oldHead >= s.y + s.h - 0.5 && newHead <= s.y + s.h) { if (ceil === null || (s.y + s.h) > (ceil.y + ceil.h)) ceil = s; }
      }
      if (ceil) { w.y = ceil.y + ceil.h; w.vy = 0; }
      w.onGround = false; w.riding = null;
      if (!w.airborne) { w.airborne = true; w.peakFeet = Math.min(oldFeet, newFeet); }
      else w.peakFeet = Math.min(w.peakFeet, w.y + WH);
    }
  };

  function hazardReason(hz) {
    if (hz.kind === 'spike') return '踩到尖刺，先生痛醒了！';
    if (hz.kind === 'water') return '掉進水裡，先生嚇醒了！';
    if (hz.kind === 'fire') return '碰到火，先生驚醒了！';
    return '先生被嚇醒了！';
  }

  function simulate(level, placements, maxSteps) {
    maxSteps = maxSteps || 8000;
    var g = new Game(level);
    if (placements) placements.forEach(function (p) { g.setMovable(p.id, p.x, p.y); });
    g.start();
    for (var i = 0; i < maxSteps; i++) { g.step(); if (g.state !== 'walking') break; }
    return { state: g.state, reason: g.failReason, steps: g.time };
  }

  var api = { Game: Game, simulate: simulate, CONFIG: CONFIG, overlap: overlap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SleepwalkerEngine = api;
})(typeof window !== 'undefined' ? window : this);
