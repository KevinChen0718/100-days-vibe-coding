/* 霜峽行動 — 渲染層（全 Canvas 向量手繪，挪威冬夜） */
'use strict';

var Renderer = (function () {

  var terrain = null; // 預先繪好的地形離屏 canvas
  var W = 0, H = 0;   // 世界像素尺寸

  /* 決定性雜湊：地形變化不靠 random，重繪結果固定 */
  function hash(c, r) {
    var n = c * 374761393 + r * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  }

  /* ---------- 地形預繪 ---------- */
  function buildTerrain(state) {
    var map = state.map;
    W = map[0].length * TILE; H = map.length * TILE;
    terrain = document.createElement('canvas');
    terrain.width = W; terrain.height = H;
    var g = terrain.getContext('2d');

    for (var r = 0; r < map.length; r++) {
      for (var c = 0; c < map[0].length; c++) {
        var ch = map[r][c];
        var x = c * TILE, y = r * TILE;
        var hv = hash(c, r);
        if (ch === '~') {
          g.fillStyle = hv < 0.5 ? '#16304f' : '#183455';
          g.fillRect(x, y, TILE, TILE);
          if (hv > 0.72) { // 波光
            g.strokeStyle = 'rgba(120,160,200,0.25)';
            g.lineWidth = 1.5;
            g.beginPath();
            g.moveTo(x + 4, y + 10 + hv * 12);
            g.quadraticCurveTo(x + 16, y + 6 + hv * 12, x + 28, y + 10 + hv * 12);
            g.stroke();
          }
        } else if (ch === 'r') {
          g.fillStyle = '#aeb9c2';
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = 'rgba(90,100,110,0.25)'; // 車轍（跟著道路方向）
          var vert = (r > 0 && map[r - 1][c] === 'r') || (r < map.length - 1 && map[r + 1][c] === 'r');
          var horiz = (c > 0 && map[r][c - 1] === 'r') || (c < map[0].length - 1 && map[r][c + 1] === 'r');
          if (horiz || !vert) { g.fillRect(x, y + 8, TILE, 3); g.fillRect(x, y + 21, TILE, 3); }
          if (vert && !horiz) { g.fillRect(x + 8, y, 3, TILE); g.fillRect(x + 21, y, 3, TILE); }
        } else if (ch === 'D') {
          g.fillStyle = '#6b4f35';
          g.fillRect(x, y, TILE, TILE);
          g.strokeStyle = 'rgba(40,28,18,0.6)';
          g.lineWidth = 2;
          for (var p = 0; p < 4; p++) {
            g.beginPath(); g.moveTo(x, y + p * 8 + 4); g.lineTo(x + TILE, y + p * 8 + 4); g.stroke();
          }
          g.fillStyle = 'rgba(230,238,246,0.5)'; // 積雪
          g.fillRect(x + 2, y + 2, 8, 4);
        } else {
          // 雪地底（含 T R # b 的底色）
          var shade = 222 + Math.floor(hv * 18);
          g.fillStyle = 'rgb(' + (shade - 8) + ',' + shade + ',' + Math.min(255, shade + 10) + ')';
          g.fillRect(x, y, TILE, TILE);
          if (hv > 0.9) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x + hv * 20, y + hv * 14, 2, 2); }
        }
      }
    }
    // 第二輪：地物（畫在底色上）
    for (var r2 = 0; r2 < map.length; r2++) {
      for (var c2 = 0; c2 < map[0].length; c2++) {
        var ch2 = map[r2][c2];
        var x2 = c2 * TILE, y2 = r2 * TILE;
        if (ch2 === 'T') drawPine(g, x2 + 16, y2 + 16, hash(c2, r2));
        else if (ch2 === 'R') drawRock(g, x2 + 16, y2 + 16, hash(c2, r2));
        else if (ch2 === 'b') drawBush(g, x2 + 16, y2 + 16, hash(c2, r2));
      }
    }
    // 建築（牆面 + 雪頂）
    var lvl = state.level;
    lvl.hutRects.concat([lvl.shackRect]).forEach(function (rc) { drawBuilding(g, rc, false); });
    drawBuilding(g, lvl.stationRect, true);
    // 海岸線描邊
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 2;
    for (var r3 = 0; r3 < map.length; r3++) {
      for (var c3 = 0; c3 < map[0].length; c3++) {
        if (map[r3][c3] === '~') continue;
        if (map[r3][c3] === 'D') continue;
        var x3 = c3 * TILE, y3 = r3 * TILE;
        if (r3 > 0 && map[r3 - 1][c3] === '~') { g.beginPath(); g.moveTo(x3, y3 + 1); g.lineTo(x3 + TILE, y3 + 1); g.stroke(); }
        if (r3 < map.length - 1 && map[r3 + 1][c3] === '~') { g.beginPath(); g.moveTo(x3, y3 + TILE - 1); g.lineTo(x3 + TILE, y3 + TILE - 1); g.stroke(); }
        if (c3 > 0 && map[r3][c3 - 1] === '~') { g.beginPath(); g.moveTo(x3 + 1, y3); g.lineTo(x3 + 1, y3 + TILE); g.stroke(); }
        if (c3 < map[0].length - 1 && map[r3][c3 + 1] === '~') { g.beginPath(); g.moveTo(x3 + TILE - 1, y3); g.lineTo(x3 + TILE - 1, y3 + TILE); g.stroke(); }
      }
    }
  }

  function drawPine(g, cx, cy, hv) {
    g.fillStyle = '#3a2a1c';
    g.fillRect(cx - 2, cy + 6, 4, 8);
    var green = hv < 0.5 ? '#1f3d2f' : '#234534';
    for (var i = 0; i < 3; i++) {
      var w = 14 - i * 3.5, yy = cy + 4 - i * 8;
      g.fillStyle = green;
      g.beginPath(); g.moveTo(cx, yy - 10); g.lineTo(cx - w, yy); g.lineTo(cx + w, yy); g.closePath(); g.fill();
      g.fillStyle = 'rgba(238,244,248,0.8)'; // 積雪
      g.beginPath(); g.moveTo(cx, yy - 10); g.lineTo(cx - w * 0.5, yy - 5); g.lineTo(cx + w * 0.5, yy - 5); g.closePath(); g.fill();
    }
  }

  function drawRock(g, cx, cy, hv) {
    g.fillStyle = '#737d87';
    g.beginPath();
    g.moveTo(cx - 13, cy + 9);
    g.lineTo(cx - 9, cy - 6 - hv * 4);
    g.lineTo(cx + 2, cy - 11);
    g.lineTo(cx + 12, cy - 2);
    g.lineTo(cx + 13, cy + 9);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(235,242,248,0.85)';
    g.beginPath();
    g.moveTo(cx - 9, cy - 6 - hv * 4);
    g.lineTo(cx + 2, cy - 11);
    g.lineTo(cx + 9, cy - 4);
    g.lineTo(cx - 4, cy - 2);
    g.closePath(); g.fill();
  }

  function drawBush(g, cx, cy, hv) {
    g.fillStyle = '#2c4a38';
    g.beginPath();
    g.ellipse(cx - 6, cy + 2, 8, 7, 0, 0, 7);
    g.ellipse(cx + 5, cy, 9, 8, 0, 0, 7);
    g.ellipse(cx, cy + 5, 9, 6, 0, 0, 7);
    g.fill();
    g.fillStyle = 'rgba(235,242,248,0.6)';
    g.beginPath();
    g.ellipse(cx - 4, cy - 3, 5, 3, 0.3, 0, 7);
    g.ellipse(cx + 6, cy - 4, 4, 2.5, -0.2, 0, 7);
    g.fill();
  }

  function drawBuilding(g, rc, isStation) {
    var x = rc.c0 * TILE, y = rc.r0 * TILE;
    var w = (rc.c1 - rc.c0 + 1) * TILE, h = (rc.r1 - rc.r0 + 1) * TILE;
    g.fillStyle = isStation ? '#3d4450' : '#4a3a2c';
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(20,16,12,0.8)';
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, w - 2, h - 2);
    // 雪頂（上半斜面亮、下半暗）
    g.fillStyle = '#e8eef4';
    g.fillRect(x + 2, y + 2, w - 4, h * 0.45);
    g.fillStyle = isStation ? '#525c6b' : '#5d4a38';
    g.fillRect(x + 2, y + 2 + h * 0.45, w - 4, h * 0.55 - 4);
    g.fillStyle = 'rgba(232,238,244,0.5)';
    g.fillRect(x + 2, y + 2 + h * 0.45, w - 4, 4);
    // 暖黃窗
    g.fillStyle = 'rgba(255,200,90,0.9)';
    g.fillRect(x + w * 0.2, y + h * 0.62, 6, 6);
    if (w > 64) g.fillRect(x + w * 0.7, y + h * 0.62, 6, 6);
  }

  /* ---------- 視野錐 ---------- */
  function castRay(map, x, y, ang, maxD) {
    var step = 8;
    for (var d = step; d < maxD; d += step) {
      var px = x + Math.cos(ang) * d, py = y + Math.sin(ang) * d;
      var c = Math.floor(px / TILE), r = Math.floor(py / TILE);
      var ch = (r < 0 || r >= map.length || c < 0 || c >= map[0].length) ? '#' : map[r][c];
      if (ch === 'T' || ch === 'R' || ch === '#') return d;
    }
    return maxD;
  }

  function drawCone(ctx, state, gd) {
    var fov = TUNING.fovDeg * Math.PI / 180;
    if (gd.state === 'alert') fov *= 1.4;
    var color = gd.state === 'alert' ? '255,77,77' : gd.state === 'sus' ? '255,155,61' : '255,211,77';
    var rays = 26;
    var pts = [];
    for (var i = 0; i <= rays; i++) {
      var a = gd.dir - fov / 2 + fov * i / rays;
      var d = castRay(state.map, gd.x, gd.y, a, TUNING.farRange);
      pts.push([gd.x + Math.cos(a) * d, gd.y + Math.sin(a) * d, d]);
    }
    // 遠區
    ctx.fillStyle = 'rgba(' + color + ',0.10)';
    ctx.beginPath();
    ctx.moveTo(gd.x, gd.y);
    pts.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
    ctx.closePath(); ctx.fill();
    // 近區（顏色加重 → 「這圈蹲了也沒用」）
    ctx.fillStyle = 'rgba(' + color + ',0.16)';
    ctx.beginPath();
    ctx.moveTo(gd.x, gd.y);
    for (var j = 0; j <= rays; j++) {
      var a2 = gd.dir - fov / 2 + fov * j / rays;
      var d2 = Math.min(pts[j][2], TUNING.nearRange);
      ctx.lineTo(gd.x + Math.cos(a2) * d2, gd.y + Math.sin(a2) * d2);
    }
    ctx.closePath(); ctx.fill();
  }

  /* ---------- 人物 ---------- */
  function drawFigure(ctx, x, y, dir, opts) {
    // opts: {body, cap, crouch, carrying, rifle, dead, selected, alpha}
    ctx.save();
    ctx.translate(x, y);
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    // 影子
    ctx.fillStyle = 'rgba(10,15,30,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 6, 10, 4.5, 0, 0, 7); ctx.fill();
    if (opts.selected) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(0, 4, 13, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
    }
    var sc = opts.crouch ? 0.78 : 1;
    ctx.scale(1, sc);
    if (opts.dead) ctx.rotate(Math.PI / 2);
    // 身體
    ctx.fillStyle = opts.body;
    ctx.beginPath();
    ctx.ellipse(0, -2, opts.crouch ? 8 : 6.5, 9, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,12,18,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 步槍 / 武器指向
    if (opts.rifle) {
      ctx.strokeStyle = '#2a2018';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(dir) * 4, -2 + Math.sin(dir) * 4);
      ctx.lineTo(Math.cos(dir) * 16, -2 + Math.sin(dir) * 16);
      ctx.stroke();
    }
    // 扛著的東西
    if (opts.carrying === 'barrel') {
      ctx.fillStyle = '#8a3324';
      ctx.beginPath(); ctx.ellipse(0, -11, 7, 4.5, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#451a12'; ctx.lineWidth = 1; ctx.stroke();
    } else if (opts.carrying === 'body') {
      ctx.fillStyle = '#5c6b7e';
      ctx.beginPath(); ctx.ellipse(0, -11, 9, 4, 0.15, 0, 7); ctx.fill();
    }
    // 頭 + 帽
    ctx.fillStyle = '#d9b38c';
    ctx.beginPath(); ctx.arc(0, -9, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = opts.cap;
    ctx.beginPath(); ctx.arc(0, -10.5, 4.5, Math.PI, 2 * Math.PI); ctx.fill();
    ctx.fillRect(-4.5, -10.5, 9, 2);
    // 面向指示（小鼻尖）
    ctx.fillStyle = 'rgba(10,12,18,0.6)';
    ctx.beginPath();
    ctx.arc(Math.cos(dir) * 4, -9 + Math.sin(dir) * 2.5, 1.4, 0, 7);
    ctx.fill();
    ctx.restore();
  }

  var UNIT_STYLE = {
    wolf: { body: '#3c4f3a', cap: '#2e4d2b' },
    fox:  { body: '#6b4a32', cap: '#54381f' },
    seal: { body: '#2e4a5e', cap: '#1d3344' }
  };

  /* ---------- 主繪製 ---------- */
  function draw(ctx, state, view) {
    var cw = view.w, chh = view.h;
    ctx.clearRect(0, 0, cw, chh);
    if (!terrain) buildTerrain(state);

    ctx.save();
    ctx.translate(-view.camX, -view.camY);

    ctx.drawImage(terrain, 0, 0);

    // 雪地腳印
    state.footprints.forEach(function (f) {
      var a = Math.max(0, 0.28 * (1 - f.age / 22));
      ctx.fillStyle = 'rgba(120,140,165,' + a.toFixed(3) + ')';
      ctx.save();
      ctx.translate(f.x, f.y); ctx.rotate(f.dir);
      ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 1.8, 0, 0, 7); ctx.fill();
      ctx.restore();
    });

    // 放置區提示（搬油桶時脈動）
    var carryingBarrel = state.units.some(function (u) { return u.carrying && u.carrying.type === 'barrel'; });
    if (!state.station.destroyed) {
      var zone = state.level.plantZone;
      var pulse = carryingBarrel ? 0.35 + 0.25 * Math.sin(state.t * 5) : 0.18;
      ctx.strokeStyle = 'rgba(255,120,60,' + pulse + ')';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      zone.forEach(function (z) { ctx.strokeRect(z[0] * TILE + 3, z[1] * TILE + 3, TILE - 6, TILE - 6); });
      ctx.setLineDash([]);
    }

    // 視野錐（在所有單位下層）
    if (view.showCones) {
      state.guards.forEach(function (g) { if (g.alive) drawCone(ctx, state, g); });
    }

    // 屍體
    state.bodies.forEach(function (b) {
      if (b.carried) return;
      drawFigure(ctx, b.x, b.y, 0, { body: '#5c6b7e', cap: '#6e7a87', dead: true, alpha: b.hidden ? 0.35 : 0.9 });
    });

    // 油桶
    state.barrels.forEach(function (b) {
      if (b.exploded || b.carried) return;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = 'rgba(10,15,30,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 5, 8, 3.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#8a3324';
      ctx.fillRect(-7, -10, 14, 15);
      ctx.fillStyle = '#a04832';
      ctx.fillRect(-7, -10, 14, 4);
      ctx.strokeStyle = '#451a12';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-7, -10, 14, 15);
      ctx.beginPath(); ctx.moveTo(-7, -3); ctx.lineTo(7, -3); ctx.stroke();
      if (b.fuse > 0) {
        var blink = Math.sin(state.t * 12) > 0;
        if (blink) {
          ctx.fillStyle = '#ffdd55';
          ctx.beginPath(); ctx.arc(0, -13, 3, 0, 7); ctx.fill();
        }
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(b.fuse.toFixed(1), 0, -18);
      }
      ctx.restore();
    });

    // 誘餌
    state.decoys.forEach(function (d) {
      ctx.fillStyle = '#333a44';
      ctx.fillRect(d.x - 4, d.y - 4, 8, 8);
      var ph = 1 - (d.pulse / 1.2);
      ctx.strokeStyle = 'rgba(255,211,77,' + (0.5 * (1 - ph)).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(d.x, d.y, 6 + ph * 30, 0, 7); ctx.stroke();
      if (Math.sin(state.t * 10) > 0) {
        ctx.fillStyle = '#ff5544';
        ctx.beginPath(); ctx.arc(d.x, d.y - 5, 2, 0, 7); ctx.fill();
      }
    });

    // 小艇
    (function () {
      var b = state.boat;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.dir + Math.PI / 2);
      ctx.fillStyle = '#5d4326';
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.quadraticCurveTo(13, -8, 11, 14);
      ctx.lineTo(-11, 14);
      ctx.quadraticCurveTo(-13, -8, 0, -22);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2e2013';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#7a5c38';
      ctx.fillRect(-9, -4, 18, 4);
      ctx.fillRect(-8, 6, 16, 4);
      // 船上的人
      b.crew.forEach(function (id, i) {
        var u = null;
        for (var k = 0; k < state.units.length; k++) if (state.units[k].id === id) u = state.units[k];
        if (!u) return;
        ctx.fillStyle = UNIT_STYLE[u.kind].cap;
        ctx.beginPath(); ctx.arc(0, -10 + i * 9, 4, 0, 7); ctx.fill();
      });
      ctx.restore();
    })();

    // 敵兵
    state.guards.forEach(function (g) {
      if (!g.alive) return;
      drawFigure(ctx, g.x, g.y, g.dir, { body: '#5c6b7e', cap: '#6e7a87', rifle: true });
      // 狀態圖示
      if (g.state === 'sus') {
        ctx.fillStyle = '#ffb347';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', g.x, g.y - 22);
      } else if (g.state === 'alert') {
        ctx.fillStyle = '#ff5544';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', g.x, g.y - 22);
      } else if (g.meter > 0.03) {
        // 目擊值弧
        ctx.strokeStyle = 'rgba(255,180,60,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(g.x, g.y - 20, 7, -Math.PI / 2, -Math.PI / 2 + g.meter * 2 * Math.PI);
        ctx.stroke();
      }
      // 滑鼠懸停高亮
      if (view.hoverGuard === g.id) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(g.x, g.y, 16, 0, 7); ctx.stroke();
      }
    });

    // 我方
    state.units.forEach(function (u) {
      if (u.inBoat) return;
      var s = UNIT_STYLE[u.kind];
      drawFigure(ctx, u.x, u.y, u.dir, {
        body: s.body, cap: s.cap,
        crouch: u.crouch,
        carrying: u.carrying ? u.carrying.type : null,
        dead: !u.alive,
        selected: view.phase === 'play' && state.selected === u.id
      });
      if (state.selected === u.id && u.path && u.path.length) {
        var last = u.path[u.path.length - 1];
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(last.x, last.y, 5, 0, 7); ctx.stroke();
      }
    });

    // 中繼站天線 + 摧毀煙霧
    (function () {
      var rc = state.level.stationRect;
      var cx = (rc.c0 + rc.c1 + 1) / 2 * TILE, cy = rc.r0 * TILE + 6;
      if (!state.station.destroyed) {
        ctx.strokeStyle = '#252b35';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 26); ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - 6); ctx.lineTo(cx, cy - 26); ctx.lineTo(cx + 8, cy - 6);
        ctx.stroke();
        if (Math.sin(state.t * 4) > 0) {
          ctx.fillStyle = '#ff4444';
          ctx.beginPath(); ctx.arc(cx, cy - 26, 2.5, 0, 7); ctx.fill();
        }
      } else {
        var rcx = rc.c0 * TILE, rcy = rc.r0 * TILE;
        ctx.fillStyle = 'rgba(25,22,20,0.75)';
        ctx.fillRect(rcx, rcy, (rc.c1 - rc.c0 + 1) * TILE, (rc.r1 - rc.r0 + 1) * TILE);
        for (var si = 0; si < 3; si++) {
          var sx = cx - 20 + si * 20;
          var sy = rcy + 10 - ((state.t * 14 + si * 23) % 46);
          var sa = Math.max(0, 0.4 - (rcy + 10 - sy) / 46 * 0.4);
          ctx.fillStyle = 'rgba(90,90,95,' + sa.toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(sx, sy, 8 + (rcy + 10 - sy) / 5, 0, 7); ctx.fill();
        }
      }
    })();

    // 爆炸特效
    state.effects.forEach(function (e) {
      if (e.type !== 'boom') return;
      var p = e.t / 2.2;
      var rad = 20 + p * 130;
      ctx.strokeStyle = 'rgba(255,160,60,' + (0.8 * (1 - p)).toFixed(3) + ')';
      ctx.lineWidth = 6 * (1 - p) + 1;
      ctx.beginPath(); ctx.arc(e.x, e.y, rad, 0, 7); ctx.stroke();
      if (p < 0.3) {
        ctx.fillStyle = 'rgba(255,220,120,' + (1 - p / 0.3).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(e.x, e.y, 30 * (1 - p / 0.3) + 10, 0, 7); ctx.fill();
      }
    });

    // 誘餌瞄準模式
    if (view.decoyAim && view.aimUnit) {
      var au = view.aimUnit;
      ctx.strokeStyle = 'rgba(255,211,77,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(au.x, au.y, 6 * TILE, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(au.x, au.y); ctx.lineTo(view.mouseWX, view.mouseWY); ctx.stroke();
      ctx.setLineDash([]);
    }

    // 夜色
    ctx.fillStyle = 'rgba(12,22,48,0.30)';
    ctx.fillRect(view.camX, view.camY, cw, chh);

    ctx.restore();

    drawUI(ctx, state, view);
    if (view.phase === 'briefing') drawBriefing(ctx, state, view);
    if (view.phase === 'over') drawOver(ctx, state, view);
  }

  /* ---------- UI ---------- */
  function drawUI(ctx, state, view) {
    var cw = view.w;
    // 警戒紅暈
    var anyAlert = state.guards.some(function (g) { return g.alive && g.state === 'alert'; });
    if (anyAlert) {
      var a = 0.12 + 0.08 * Math.sin(state.t * 6);
      var grd = ctx.createRadialGradient(cw / 2, view.h / 2, view.h * 0.55, cw / 2, view.h / 2, view.h * 1.05);
      grd.addColorStop(0, 'rgba(255,40,40,0)');
      grd.addColorStop(1, 'rgba(255,40,40,' + a.toFixed(3) + ')');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, cw, view.h);
    }

    // 隊員頭像
    state.units.forEach(function (u, i) {
      var x = 12 + i * 56, y = 12;
      ctx.fillStyle = state.selected === u.id ? 'rgba(255,255,255,0.18)' : 'rgba(8,12,22,0.7)';
      ctx.fillRect(x, y, 48, 56);
      ctx.strokeStyle = state.selected === u.id ? '#ffd34d' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = state.selected === u.id ? 2 : 1;
      ctx.strokeRect(x, y, 48, 56);
      var s = UNIT_STYLE[u.kind];
      ctx.fillStyle = '#d9b38c';
      ctx.beginPath(); ctx.arc(x + 24, y + 22, 9, 0, 7); ctx.fill();
      ctx.fillStyle = s.cap;
      ctx.beginPath(); ctx.arc(x + 24, y + 19, 9, Math.PI, 2 * Math.PI); ctx.fill();
      ctx.fillRect(x + 15, y + 19, 18, 4);
      ctx.fillStyle = '#fff';
      ctx.font = '11px "Noto Sans TC",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(u.name, x + 24, y + 44);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '9px monospace';
      ctx.fillText(String(i + 1), x + 6, y + 10);
      // HP
      for (var h = 0; h < 3; h++) {
        ctx.fillStyle = h < u.hp ? '#e05548' : 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + 8 + h * 12, y + 49, 9, 3);
      }
      if (!u.alive) {
        ctx.fillStyle = 'rgba(180,30,30,0.55)';
        ctx.fillRect(x, y, 48, 56);
      }
      if (u.inBoat) {
        ctx.fillStyle = '#9fc3e0';
        ctx.font = '9px "Noto Sans TC",sans-serif';
        ctx.fillText('船上', x + 24, y + 8);
      }
      if (u.crouch) {
        ctx.fillStyle = '#9fe09f';
        ctx.font = '9px "Noto Sans TC",sans-serif';
        ctx.fillText('蹲', x + 42, y + 10);
      }
    });
    // 狐的子彈
    var fox = null;
    state.units.forEach(function (u) { if (u.kind === 'fox') fox = u; });
    if (fox && state.selected === 'fox') {
      ctx.fillStyle = 'rgba(8,12,22,0.7)';
      ctx.fillRect(12, 74, 104, 20);
      ctx.fillStyle = '#ffd34d';
      ctx.font = '11px "Noto Sans TC",sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('手槍子彈 × ' + fox.ammo, 18, 88);
    }

    // 任務目標
    var objs = state.level.objectives;
    var flagMap = { boat: state.flags.boatBoarded, island: state.flags.landedIsland, station: state.flags.stationDown, extract: state.flags.extracted };
    var ox = view.w - 196, oy = 12;
    ctx.fillStyle = 'rgba(8,12,22,0.7)';
    ctx.fillRect(ox, oy, 184, 18 + objs.length * 18);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(ox, oy, 184, 18 + objs.length * 18);
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 11px "Noto Sans TC",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('任務目標', ox + 8, oy + 14);
    objs.forEach(function (o, i) {
      var done = flagMap[o.id];
      ctx.fillStyle = done ? '#7fd87f' : 'rgba(255,255,255,0.75)';
      ctx.font = '11px "Noto Sans TC",sans-serif';
      ctx.fillText((done ? '✓ ' : '□ ') + o.text, ox + 8, oy + 32 + i * 18);
    });

    // 引信倒數（大字）
    state.barrels.forEach(function (b) {
      if (b.fuse > 0) {
        ctx.fillStyle = 'rgba(255,80,40,' + (0.7 + 0.3 * Math.sin(state.t * 10)).toFixed(3) + ')';
        ctx.font = 'bold 26px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('炸藥引爆 ' + b.fuse.toFixed(1) + 's', view.w / 2, 40);
      }
    });

    // 底部提示列
    ctx.fillStyle = 'rgba(8,12,22,0.78)';
    ctx.fillRect(0, view.h - 46, view.w, 46);
    ctx.fillStyle = '#cfd8e3';
    ctx.font = '12px "Noto Sans TC",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(state.hint || '', 14, view.h - 28);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px "Noto Sans TC",sans-serif';
    ctx.fillText('左鍵移動/攻擊　1-3 換人　C 蹲低　E 搬運　F 互動　Q 誘餌　V 視野　K/L 存/讀　R 重來　M 靜音', 14, view.h - 11);
    if (view.saveFlash > 0) {
      ctx.fillStyle = 'rgba(127,216,127,' + Math.min(1, view.saveFlash).toFixed(3) + ')';
      ctx.font = '12px "Noto Sans TC",sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(view.saveFlashText, view.w - 14, view.h - 28);
    }
  }

  function panel(ctx, view, w, h) {
    var x = (view.w - w) / 2, y = (view.h - h) / 2;
    ctx.fillStyle = 'rgba(6,10,20,0.92)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.fillStyle = '#0d1626';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    return { x: x, y: y };
  }

  function drawBriefing(ctx, state, view) {
    var br = state.level.briefing;
    var p = panel(ctx, view, 560, 460);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 24px "Noto Sans TC",sans-serif';
    ctx.fillText(br.title, view.w / 2, p.y + 52);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '13px "Noto Sans TC",sans-serif';
    ctx.fillText(br.date, view.w / 2, p.y + 78);
    ctx.fillStyle = '#cfd8e3';
    ctx.font = '14px "Noto Sans TC",sans-serif';
    br.text.forEach(function (line, i) {
      ctx.fillText(line, view.w / 2, p.y + 116 + i * 24);
    });
    ctx.fillStyle = '#7fd87f';
    ctx.font = 'bold 15px "Noto Sans TC",sans-serif';
    ctx.fillText('按 Enter 或點擊開始任務', view.w / 2, p.y + 420);
  }

  function drawOver(ctx, state, view) {
    var win = state.result === 'win';
    var p = panel(ctx, view, 480, 260);
    ctx.textAlign = 'center';
    ctx.fillStyle = win ? '#7fd87f' : '#e05548';
    ctx.font = 'bold 30px "Noto Sans TC",sans-serif';
    ctx.fillText(win ? '任務完成' : '任務失敗', view.w / 2, p.y + 64);
    ctx.fillStyle = '#cfd8e3';
    ctx.font = '14px "Noto Sans TC",sans-serif';
    if (win) {
      var kills = state.guards.filter(function (g) { return !g.alive; }).length;
      var mins = Math.floor(state.t / 60), secs = Math.floor(state.t % 60);
      ctx.fillText('中繼站已成廢鐵，德軍通訊中斷數小時。', view.w / 2, p.y + 108);
      ctx.fillText('耗時 ' + mins + ' 分 ' + secs + ' 秒　擊殺 ' + kills + ' 名哨兵', view.w / 2, p.y + 136);
    } else {
      ctx.fillText(state.failReason || '', view.w / 2, p.y + 108);
      ctx.fillText('提示：K 隨時存檔，L 讀檔重來', view.w / 2, p.y + 136);
    }
    ctx.fillStyle = '#7fd87f';
    ctx.font = 'bold 14px "Noto Sans TC",sans-serif';
    ctx.fillText(win ? '按 Enter 再玩一次' : '按 Enter 重新開始' + (view.hasSave ? '　按 L 讀取快速存檔' : ''), view.w / 2, p.y + 210);
  }

  return {
    draw: draw,
    rebuild: function () { terrain = null; },
    worldSize: function () { return { w: W, h: H }; }
  };
})();
