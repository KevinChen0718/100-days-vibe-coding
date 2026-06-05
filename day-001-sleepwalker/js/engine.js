/*
 * 夢遊先生 Mr. Sleepwalker — 物理引擎（純運算，不碰 DOM）
 * 設計成可在瀏覽器與 Node 兩種環境執行，方便自動化關卡可解性測試。
 *
 * 座標系：左上角為原點，y 軸向下為正。
 * 單位：像素 / 每個固定步（fixed step，預設 60 步/秒）。
 */
(function (root) {
  'use strict';

  // ---- 全域設定 ----
  var CONFIG = {
    WALKER_W: 26,
    WALKER_H: 46,
    GRAVITY: 0.6,
    TERMINAL: 13,
    WALK_SPEED: 1.5,
    STEP_HEIGHT: 16,      // 可自動跨上的小台階高度
    MAX_SAFE_FALL: 120,   // 超過這個落差會「摔醒」
    SPRING_POWER: 14.5,   // 彈簧床彈起初速（垂直）
    LAUNCH_VX: 5,         // 彈簧床附帶的向前彈力（水平），讓他像跳板一樣往前飛
    STEP_DT: 1 / 60
  };

  var WW = CONFIG.WALKER_W;
  var WH = CONFIG.WALKER_H;

  // ---- AABB 工具 ----
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function hOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x;
  }

  // ---- 遊戲主體 ----
  function Game(level) {
    this.load(level);
  }

  Game.prototype.load = function (level) {
    this.level = level;
    var world = level.world || {};
    this.W = world.w || 960;
    this.H = world.h || 620;

    var facing = level.startFacing || 1;
    this.walker = {
      x: level.bed.x,
      y: level.bed.y - WH,   // 站在床所在地板上，腳底 = bed.y
      vy: 0,
      launchVx: 0,           // 被彈簧床彈飛時的水平速度（0 = 用一般走路速度）
      launched: false,       // 正處於彈簧跳的飛行中 → 這次落地不計摔傷
      facing: facing,
      onGround: false,
      airborne: false,
      peakFeet: 0,
      walkAnim: 0
    };

    this.staticSolids = (level.solids || []).map(function (s) {
      return { x: s.x, y: s.y, w: s.w, h: s.h, kind: s.kind || 'floor' };
    });
    this.movables = (level.movables || []).map(function (m, i) {
      return {
        id: m.id != null ? m.id : 'm' + i,
        type: m.type,
        x: m.x, y: m.y, w: m.w, h: m.h,
        soft: m.type === 'mattress',
        spring: m.type === 'spring'
      };
    });
    this.hazards = (level.hazards || []).map(function (h) {
      return { x: h.x, y: h.y, w: h.w, h: h.h, kind: h.kind || 'spike' };
    });
    this.exit = level.exit ? { x: level.exit.x, y: level.exit.y, w: level.exit.w, h: level.exit.h } : null;

    this.state = 'ready';     // ready | walking | won | lost
    this.failReason = '';
    this.time = 0;
  };

  Game.prototype.reset = function () { this.load(this.level); };

  Game.prototype.start = function () {
    if (this.state === 'ready') {
      this.state = 'walking';
      this.walker.onGround = true;
    }
  };

  Game.prototype._box = function (w) {
    return { x: w.x, y: w.y, w: WW, h: WH };
  };

  Game.prototype.allSolids = function () {
    return this.staticSolids.concat(this.movables);
  };

  // 拖曳物件時呼叫：設定某可動物件位置（夾在世界範圍內）
  Game.prototype.setMovable = function (id, x, y) {
    var m = null;
    for (var i = 0; i < this.movables.length; i++) {
      if (this.movables[i].id === id) { m = this.movables[i]; break; }
    }
    if (!m) return;
    m.x = Math.max(0, Math.min(this.W - m.w, x));
    m.y = Math.max(0, Math.min(this.H - m.h, y));
  };

  Game.prototype.movableAt = function (px, py) {
    // 由上層（後畫）往下找，回傳被點到的可動物件
    for (var i = this.movables.length - 1; i >= 0; i--) {
      var m = this.movables[i];
      if (px >= m.x && px <= m.x + m.w && py >= m.y && py <= m.y + m.h) return m;
    }
    return null;
  };

  Game.prototype._fail = function (reason) {
    this.state = 'lost';
    this.failReason = reason;
  };

  // ---- 單一固定步模擬 ----
  Game.prototype.step = function () {
    if (this.state !== 'walking') return;
    this.time++;
    var w = this.walker;
    var solids = this.allSolids();

    // 重力
    w.vy += CONFIG.GRAVITY;
    if (w.vy > CONFIG.TERMINAL) w.vy = CONFIG.TERMINAL;

    this._moveHorizontal(w, solids);
    if (this.state !== 'walking') return;
    this._moveVertical(w, solids);
    if (this.state !== 'walking') return;

    // 行走動畫相位
    if (w.onGround) w.walkAnim += 0.25;

    // 危險物
    var box = this._box(w);
    for (var i = 0; i < this.hazards.length; i++) {
      if (overlap(box, this.hazards[i])) {
        this._fail(hazardReason(this.hazards[i]));
        return;
      }
    }
    // 出口
    if (this.exit && overlap(box, this.exit)) {
      this.state = 'won';
      return;
    }
    // 掉出世界
    if (w.y > this.H + 80) {
      this._fail('先生掉出去了！');
      return;
    }
  };

  Game.prototype._moveHorizontal = function (w, solids) {
    // 被彈簧床彈飛時用 launchVx（向前的拋物線），否則用固定走路速度
    var dx = (w.airborne && w.launchVx) ? w.launchVx : w.facing * CONFIG.WALK_SPEED;
    w.x += dx;
    var box = this._box(w);
    var feet = w.y + WH;
    var wall = false;
    var stepTop = Infinity;
    for (var i = 0; i < solids.length; i++) {
      var s = solids[i];
      if (!overlap(box, s)) continue;
      if (s.y < feet - CONFIG.STEP_HEIGHT) {
        wall = true;            // 高過台階上限 → 牆，撞牆轉身
        break;
      } else if (s.y < feet) {
        if (s.y < stepTop) stepTop = s.y;   // 小台階，可踏上去
      }
    }
    if (wall) {
      w.x -= dx;
      w.facing *= -1;
      w.launchVx = 0;          // 撞牆就中斷彈飛，恢復走路
      return;
    }
    if (stepTop !== Infinity && stepTop < w.y + WH) {
      w.y = stepTop - WH;       // 踏上小台階（只會往上，不會往下推）
    }
  };

  Game.prototype._moveVertical = function (w, solids) {
    var oldFeet = w.y + WH;
    var oldHead = w.y;
    w.y += w.vy;
    var box = this._box(w);
    var newFeet = w.y + WH;
    var newHead = w.y;
    var i, s;

    if (w.vy >= 0) {
      // 下墜：找落地面（橫向重疊、且這一步跨過了它的頂面）
      var best = null;
      for (i = 0; i < solids.length; i++) {
        s = solids[i];
        if (!hOverlap(box, s)) continue;
        if (oldFeet <= s.y + 0.5 && newFeet >= s.y) {
          if (best === null || s.y < best.y) best = s;
        }
      }
      if (best) {
        w.y = best.y - WH;
        if (best.spring) {
          w.vy = -CONFIG.SPRING_POWER;
          w.launchVx = w.facing * CONFIG.LAUNCH_VX;   // 同時往前彈
          w.launched = true;         // 彈跳飛行中，落地不算摔傷
          w.onGround = false;
          w.airborne = true;
          w.peakFeet = w.y + WH;     // 從彈起點重新計算落差
        } else {
          var landed = best.y;
          var fall = landed - w.peakFeet;
          var safeLanding = best.soft || w.launched;
          w.vy = 0;
          w.launchVx = 0;            // 落地，恢復走路
          w.launched = false;
          w.onGround = true;
          if (w.airborne) {
            w.airborne = false;
            if (!safeLanding && fall > CONFIG.MAX_SAFE_FALL) {
              this._fail('先生摔太重，醒過來了！');
              return;
            }
          }
        }
      } else {
        // 沒踩到東西 → 騰空
        if (w.onGround) {
          w.onGround = false;
          w.airborne = true;
          w.peakFeet = oldFeet;
        }
        if (w.airborne) w.peakFeet = Math.min(w.peakFeet, newFeet);
      }
    } else {
      // 上升：找天花板
      var ceil = null;
      for (i = 0; i < solids.length; i++) {
        s = solids[i];
        if (!hOverlap(box, s)) continue;
        if (oldHead >= s.y + s.h - 0.5 && newHead <= s.y + s.h) {
          if (ceil === null || (s.y + s.h) > (ceil.y + ceil.h)) ceil = s;
        }
      }
      if (ceil) {
        w.y = ceil.y + ceil.h;
        w.vy = 0;
      }
      w.onGround = false;
      if (!w.airborne) { w.airborne = true; w.peakFeet = Math.min(oldFeet, newFeet); }
      else w.peakFeet = Math.min(w.peakFeet, w.y + WH);
    }
  };

  function hazardReason(hz) {
    if (hz.kind === 'spike') return '先生踩到尖刺了！';
    if (hz.kind === 'water') return '先生掉進水裡了！';
    if (hz.kind === 'fire') return '先生碰到火了！';
    return '先生遇到危險了！';
  }

  // ---- 自動測試用：套用一組擺放方案後模擬到結束 ----
  function simulate(level, placements, maxSteps) {
    maxSteps = maxSteps || 5000;
    var g = new Game(level);
    if (placements) {
      placements.forEach(function (p) { g.setMovable(p.id, p.x, p.y); });
    }
    g.start();
    for (var i = 0; i < maxSteps; i++) {
      g.step();
      if (g.state !== 'walking') break;
    }
    return { state: g.state, reason: g.failReason, steps: g.time };
  }

  var api = { Game: Game, simulate: simulate, CONFIG: CONFIG, overlap: overlap };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.SleepwalkerEngine = api;
  }
})(typeof window !== 'undefined' ? window : this);
