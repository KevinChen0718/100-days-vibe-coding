/* 霜峽行動 — 主迴圈、輸入、鏡頭 */
'use strict';

(function () {
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var VW = 960, VH = 640;
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = VW * dpr; canvas.height = VH * dpr;
  canvas.style.width = VW + 'px'; canvas.style.height = VH + 'px';
  ctx.scale(dpr, dpr);

  var GAME = {
    phase: 'briefing', // briefing | play | over
    state: Engine.create(LEVEL1),
    camX: 0, camY: 0,
    showCones: true,
    decoyAim: false,
    quicksave: null,
    mouseX: 0, mouseY: 0,
    overDelay: 0,
    saveFlash: 0,
    saveFlashText: '',
    lastFuseTick: -1
  };

  var WORLD_W = LEVEL1.map[0].length * TILE;
  var WORLD_H = LEVEL1.map.length * TILE;

  function selectedUnit() { return Engine.unitById(GAME.state, GAME.state.selected); }

  function toWorld(ev) {
    var rect = canvas.getBoundingClientRect();
    var sx = ev.clientX - rect.left, sy = ev.clientY - rect.top;
    return { x: sx + GAME.camX, y: sy + GAME.camY, sx: sx, sy: sy };
  }

  function guardAt(wx, wy) {
    var best = null, bestD = 20;
    GAME.state.guards.forEach(function (g) {
      if (!g.alive) return;
      var d = Math.hypot(g.x - wx, g.y - wy);
      if (d < bestD) { bestD = d; best = g; }
    });
    return best;
  }

  function restart() {
    GAME.state = Engine.create(LEVEL1);
    GAME.phase = 'play';
    GAME.decoyAim = false;
    GAME.overDelay = 0;
    GAME.lastFuseTick = -1;
    snapCamera();
  }

  function quickSave() {
    if (GAME.phase !== 'play') return;
    GAME.quicksave = Engine.save(GAME.state);
    try { localStorage.setItem('frostfjord-save', GAME.quicksave); } catch (e) {}
    GAME.saveFlash = 2; GAME.saveFlashText = '✓ 已快速存檔（L 讀取）';
  }

  function quickLoad() {
    var snap = GAME.quicksave;
    if (!snap) { try { snap = localStorage.getItem('frostfjord-save'); } catch (e) {} }
    if (!snap) { GAME.state.hint = '還沒有存檔（按 K 存檔）'; return; }
    GAME.state = Engine.load(snap);
    GAME.phase = 'play';
    GAME.decoyAim = false;
    GAME.overDelay = 0;
    GAME.saveFlash = 2; GAME.saveFlashText = '✓ 已讀取存檔';
    snapCamera();
  }

  function snapCamera() {
    var u = selectedUnit();
    var fx = u.inBoat ? GAME.state.boat.x : u.x;
    var fy = u.inBoat ? GAME.state.boat.y : u.y;
    GAME.camX = Math.max(0, Math.min(WORLD_W - VW, fx - VW / 2));
    GAME.camY = Math.max(0, Math.min(WORLD_H - VH, fy - VH / 2));
  }

  /* ---------- 滑鼠 ---------- */
  canvas.addEventListener('mousemove', function (ev) {
    var p = toWorld(ev);
    GAME.mouseX = p.x; GAME.mouseY = p.y;
  });

  canvas.addEventListener('contextmenu', function (ev) {
    ev.preventDefault();
    if (GAME.phase !== 'play') return;
    Engine.toggleCrouch(GAME.state, GAME.state.selected);
  });

  canvas.addEventListener('mousedown', function (ev) {
    if (ev.button !== 0) return;
    Sound.unlock();
    if (GAME.phase === 'briefing') { restart(); return; }
    if (GAME.phase === 'over') return;
    var p = toWorld(ev);
    var st = GAME.state;
    var u = selectedUnit();

    if (GAME.decoyAim) {
      Engine.throwDecoy(st, st.selected, p.x, p.y);
      GAME.decoyAim = false;
      return;
    }
    // 點頭像換人
    if (p.sy < 72 && p.sx < 12 + 3 * 56) {
      var idx = Math.floor((p.sx - 12) / 56);
      if (idx >= 0 && idx < st.units.length && st.units[idx].alive) {
        st.selected = st.units[idx].id;
        return;
      }
    }
    var g = guardAt(p.x, p.y);
    if (g && !u.inBoat) {
      if (u.kind === 'wolf') { Engine.orderKnife(st, u.id, g.id); st.hint = '狼正在繞到 ' + g.id + ' 背後…'; return; }
      if (u.kind === 'fox') { Engine.orderShoot(st, u.id, g.id); return; }
      st.hint = '海豹沒有武器——換狼（刀）或狐（槍）';
      return;
    }
    if (u.inBoat) {
      Engine.orderBoatMove(st, p.x, p.y);
      return;
    }
    Engine.orderMove(st, u.id, p.x, p.y);
  });

  /* ---------- 鍵盤 ---------- */
  document.addEventListener('keydown', function (ev) {
    var k = ev.key.toLowerCase();
    var st = GAME.state;
    if (ev.key === 'Enter') {
      Sound.unlock();
      if (GAME.phase === 'briefing' || GAME.phase === 'over') restart();
      return;
    }
    if (GAME.phase !== 'play') {
      if (k === 'l' && GAME.phase === 'over') quickLoad();
      return;
    }
    if (k === '1' || k === '2' || k === '3') {
      var u2 = st.units[parseInt(k, 10) - 1];
      if (u2 && u2.alive) st.selected = u2.id;
    } else if (k === 'c') {
      Engine.toggleCrouch(st, st.selected);
    } else if (k === 'e') {
      Engine.pickDrop(st, st.selected);
    } else if (k === 'f') {
      Engine.interact(st, st.selected);
    } else if (k === 'q') {
      var u3 = selectedUnit();
      if (u3.kind !== 'wolf') { st.hint = '誘餌發聲器是狼的裝備'; return; }
      GAME.decoyAim = !GAME.decoyAim;
      st.hint = GAME.decoyAim ? '點擊地面丟出誘餌（再按 Q 取消）' : '';
    } else if (k === 'v') {
      GAME.showCones = !GAME.showCones;
    } else if (k === 'k') {
      quickSave();
    } else if (k === 'l') {
      quickLoad();
    } else if (k === 'r') {
      restart();
    } else if (k === 'm') {
      Sound.toggleMute();
    }
  });

  /* ---------- 迴圈 ---------- */
  var lastT = 0;
  function loop(ts) {
    var dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016);
    lastT = ts;
    var st = GAME.state;

    if (GAME.phase === 'play') {
      Engine.update(st, dt);

      // 引擎事件 → 音效
      st.events.forEach(function (e) { Sound.play(e); });
      st.events.length = 0;

      // 引信滴答
      st.barrels.forEach(function (b) {
        if (b.fuse > 0) {
          var sec = Math.ceil(b.fuse);
          if (sec !== GAME.lastFuseTick) { GAME.lastFuseTick = sec; Sound.play('tick'); }
        }
      });

      if (st.result) {
        GAME.overDelay += dt;
        if (GAME.overDelay > 1.2) {
          GAME.phase = 'over';
          Sound.play(st.result === 'win' ? 'win' : 'fail');
        }
      }

      // 鏡頭跟隨
      var u = selectedUnit();
      var fx2 = u.inBoat ? st.boat.x : u.x;
      var fy2 = u.inBoat ? st.boat.y : u.y;
      var tx = Math.max(0, Math.min(WORLD_W - VW, fx2 - VW / 2));
      var ty = Math.max(0, Math.min(WORLD_H - VH, fy2 - VH / 2));
      GAME.camX += (tx - GAME.camX) * Math.min(1, dt * 5);
      GAME.camY += (ty - GAME.camY) * Math.min(1, dt * 5);
    }

    GAME.saveFlash = Math.max(0, GAME.saveFlash - dt);

    var hoverG = GAME.phase === 'play' ? guardAt(GAME.mouseX, GAME.mouseY) : null;
    var selU = selectedUnit();
    Renderer.draw(ctx, st, {
      w: VW, h: VH,
      camX: GAME.camX, camY: GAME.camY,
      phase: GAME.phase,
      showCones: GAME.showCones,
      hoverGuard: hoverG ? hoverG.id : null,
      decoyAim: GAME.decoyAim,
      aimUnit: GAME.decoyAim ? selU : null,
      mouseWX: GAME.mouseX, mouseWY: GAME.mouseY,
      saveFlash: GAME.saveFlash,
      saveFlashText: GAME.saveFlashText,
      hasSave: !!GAME.quicksave
    });

    requestAnimationFrame(loop);
  }

  snapCamera();
  requestAnimationFrame(loop);
})();
