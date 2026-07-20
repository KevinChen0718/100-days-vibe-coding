/* 霜峽行動 — 渲染層（全 Canvas 向量手繪，挪威冬夜） */
'use strict';

var Renderer = (function () {

  var terrain = null; // 預先繪好的地形離屏 canvas
  var W = 0, H = 0;   // 世界像素尺寸
  var frostUiTexture = typeof Image !== 'undefined' ? new Image() : null;
  if (frostUiTexture) frostUiTexture.src = 'assets/ui-frostfjord-texture.webp';

  function drawUiTexture(ctx, view, alpha) {
    if (!frostUiTexture || !frostUiTexture.complete || !frostUiTexture.naturalWidth) return;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 0.36 : alpha;
    ctx.drawImage(frostUiTexture, 0, 0, view.w, view.h);
    ctx.restore();
  }

  function cutPanel(ctx, x, y, w, h, color, cut) {
    cut = cut || 18;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - cut, y);
    ctx.lineTo(x + w, y + cut);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + cut, y + h);
    ctx.lineTo(x, y + h - cut);
    ctx.closePath();
    ctx.fill();
  }

  function keycap(ctx, key, x, y, dark) {
    ctx.strokeStyle = dark ? '#0b1729' : '#f4f0e8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, 24, 18);
    ctx.fillStyle = dark ? '#0b1729' : '#f4f0e8';
    ctx.font = '900 9px "Arial Narrow", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(key, x + 12, y + 13);
  }

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
  function drawUILegacy(ctx, state, view) {
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

    // 隊員列
    state.units.forEach(function (u, i) {
      var x = 14 + i * 68, y = 14, selected = state.selected === u.id;
      ctx.fillStyle = selected ? 'rgba(31,45,68,0.96)' : 'rgba(8,16,31,0.86)';
      ctx.fillRect(x, y, 60, 66);
      ctx.strokeStyle = selected ? '#e5bd5e' : 'rgba(224,232,240,0.24)';
      ctx.lineWidth = selected ? 3 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, 59, 65);
      ctx.fillStyle = selected ? '#e5bd5e' : 'rgba(224,232,240,0.12)';
      ctx.fillRect(x, y, 60, 4);

      var s = UNIT_STYLE[u.kind];
      ctx.fillStyle = '#d9b38c';
      ctx.beginPath(); ctx.arc(x + 30, y + 25, 10, 0, 7); ctx.fill();
      ctx.fillStyle = s.cap;
      ctx.beginPath(); ctx.arc(x + 30, y + 22, 10, Math.PI, 2 * Math.PI); ctx.fill();
      ctx.fillRect(x + 20, y + 22, 20, 4);
      ctx.fillStyle = '#f1eadc';
      ctx.font = '700 11px "Noto Sans TC",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(u.name, x + 30, y + 47);
      ctx.fillStyle = selected ? '#101828' : 'rgba(241,234,220,0.62)';
      ctx.fillRect(x + 6, y + 7, 13, 13);
      ctx.fillStyle = selected ? '#e5bd5e' : '#f1eadc';
      ctx.font = '800 9px monospace';
      ctx.fillText(String(i + 1), x + 12.5, y + 17);

      for (var h = 0; h < 3; h++) {
        ctx.fillStyle = h < u.hp ? '#d7604d' : 'rgba(255,255,255,0.14)';
        ctx.fillRect(x + 8 + h * 15, y + 56, 12, 4);
      }
      if (!u.alive) {
        ctx.fillStyle = 'rgba(108,20,24,0.7)';
        ctx.fillRect(x, y, 60, 66);
      }
      if (u.inBoat) {
        ctx.fillStyle = '#9fc3e0';
        ctx.font = '800 8px "Noto Sans TC",sans-serif';
        ctx.fillText('船上', x + 44, y + 16);
      }
      if (u.crouch) {
        ctx.fillStyle = '#8bc5a4';
        ctx.font = '800 8px "Noto Sans TC",sans-serif';
        ctx.fillText('蹲低', x + 43, y + 16);
      }
    });

    // 狐的子彈
    var fox = null;
    state.units.forEach(function (u) { if (u.kind === 'fox') fox = u; });
    if (fox && state.selected === 'fox') {
      ctx.fillStyle = 'rgba(8,16,31,0.88)';
      ctx.fillRect(82, 84, 124, 24);
      ctx.fillStyle = '#e5bd5e';
      ctx.font = '700 11px "Noto Sans TC",sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('手槍彈藥  ' + fox.ammo + ' / 6', 92, 100);
    }

    // 任務目標
    var objs = state.level.objectives;
    var flagMap = { boat: state.flags.boatBoarded, island: state.flags.landedIsland, station: state.flags.stationDown, extract: state.flags.extracted };
    var ox = view.w - 236, oy = 14, ow = 222;
    ctx.fillStyle = 'rgba(8,16,31,0.9)';
    ctx.fillRect(ox, oy, ow, 124);
    ctx.strokeStyle = 'rgba(224,232,240,0.25)';
    ctx.strokeRect(ox + 0.5, oy + 0.5, ow - 1, 123);
    ctx.fillStyle = '#e5bd5e';
    ctx.fillRect(ox, oy, 4, 124);
    ctx.font = '800 9px "Noto Sans TC",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('OPERATION STATUS', ox + 16, oy + 19);
    ctx.fillStyle = '#f1eadc';
    ctx.font = '800 13px "Noto Sans TC",sans-serif';
    ctx.fillText('任務目標', ox + 16, oy + 39);
    objs.forEach(function (o, i) {
      var done = flagMap[o.id];
      ctx.fillStyle = done ? '#8bc5a4' : 'rgba(241,234,220,0.75)';
      ctx.font = '700 10px "Noto Sans TC",sans-serif';
      ctx.fillText(done ? '完成' : '待辦', ox + 16, oy + 59 + i * 16);
      ctx.fillStyle = done ? 'rgba(139,197,164,0.9)' : 'rgba(241,234,220,0.78)';
      ctx.font = '10px "Noto Sans TC",sans-serif';
      ctx.fillText(o.text, ox + 54, oy + 59 + i * 16);
    });

    // 引信倒數（大字）
    state.barrels.forEach(function (b) {
      if (b.fuse > 0) {
        ctx.fillStyle = 'rgba(215,73,55,' + (0.78 + 0.22 * Math.sin(state.t * 10)).toFixed(3) + ')';
        ctx.fillRect(view.w / 2 - 128, 18, 256, 42);
        ctx.fillStyle = '#fff1dd';
        ctx.font = '800 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('引爆倒數  ' + b.fuse.toFixed(1) + ' s', view.w / 2, 46);
      }
    });

    // 底部提示列
    ctx.fillStyle = 'rgba(7,14,28,0.92)';
    ctx.fillRect(0, view.h - 58, view.w, 58);
    ctx.fillStyle = '#f1eadc';
    ctx.font = '700 12px "Noto Sans TC",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(state.hint || '選擇隊員，點擊地面下達移動命令。', 16, view.h - 35);
    ctx.fillStyle = 'rgba(241,234,220,0.55)';
    ctx.font = '9px "Noto Sans TC",sans-serif';
    ctx.fillText('滑鼠  移動 / 攻擊　　1–3  換人　　C  蹲低　　E  搬運　　F  互動　　Q  誘餌', 16, view.h - 15);
    ctx.textAlign = 'right';
    ctx.fillText('V  視野　　K / L  存讀　　R  重來　　M  靜音', view.w - 16, view.h - 15);
    if (view.saveFlash > 0) {
      ctx.fillStyle = 'rgba(139,197,164,' + Math.min(1, view.saveFlash).toFixed(3) + ')';
      ctx.font = '700 12px "Noto Sans TC",sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(view.saveFlashText, view.w - 16, view.h - 35);
    }
  }

  function panelLegacy(ctx, view, w, h) {
    var x = (view.w - w) / 2, y = (view.h - h) / 2;
    ctx.fillStyle = 'rgba(5,11,23,0.88)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.fillStyle = '#0b1729';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(224,232,240,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = '#e5bd5e';
    ctx.fillRect(x, y, 5, h);
    return { x: x, y: y };
  }

  function drawBriefingLegacy(ctx, state, view) {
    var br = state.level.briefing;
    var p = panel(ctx, view, 760, 500);
    var left = p.x + 38, top = p.y + 34;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#e5bd5e';
    ctx.font = '800 10px "Noto Sans TC",sans-serif';
    ctx.fillText('CLASSIFIED · FIELD BRIEFING 01', left, top);
    ctx.fillStyle = '#f1eadc';
    ctx.font = '900 30px "Noto Sans TC",sans-serif';
    ctx.fillText('霜峽行動', left, top + 42);
    ctx.fillStyle = 'rgba(241,234,220,0.58)';
    ctx.font = '800 12px "Noto Sans TC",sans-serif';
    ctx.fillText('OPERATION FROSTFJORD', left + 168, top + 40);
    ctx.fillStyle = '#e5bd5e';
    ctx.fillRect(left, top + 59, 452, 2);
    ctx.fillStyle = 'rgba(241,234,220,0.56)';
    ctx.font = '11px "Noto Sans TC",sans-serif';
    ctx.fillText(br.date + '　·　挪威海岸', left, top + 82);

    ctx.fillStyle = '#f1eadc';
    ctx.font = '700 14px "Noto Sans TC",sans-serif';
    ctx.fillText('德軍在北島架設無線電中繼站，增援部隊隨時可能抵達。', left, top + 118);
    ctx.fillStyle = 'rgba(241,234,220,0.72)';
    ctx.font = '13px "Noto Sans TC",sans-serif';
    ctx.fillText('三名隊員必須會合、奪艇渡海、炸毀中繼站，並全員撤離。', left, top + 143);

    ctx.fillStyle = 'rgba(229,189,94,0.12)';
    ctx.fillRect(left, top + 170, 684, 58);
    ctx.fillStyle = '#e5bd5e';
    ctx.font = '800 9px "Noto Sans TC",sans-serif';
    ctx.fillText('MISSION ROUTE', left + 16, top + 191);
    ctx.fillStyle = '#f1eadc';
    ctx.font = '700 13px "Noto Sans TC",sans-serif';
    ctx.fillText('會合　→　奪取小艇　→　渡海　→　炸毀中繼站　→　返回南岸', left + 16, top + 215);

    ctx.fillStyle = '#f1eadc';
    ctx.font = '800 12px "Noto Sans TC",sans-serif';
    ctx.fillText('行動小組', left, top + 260);
    var roster = [
      ['1', '狼', '刀殺 · 搬運 · 誘餌'],
      ['2', '狐', '手槍 · 遠距射擊'],
      ['3', '海豹', '駕駛小艇'],
    ];
    roster.forEach(function (r, i) {
      var rx = left + i * 226, ry = top + 278;
      ctx.fillStyle = 'rgba(241,234,220,0.055)';
      ctx.fillRect(rx, ry, 210, 70);
      ctx.strokeStyle = 'rgba(224,232,240,0.18)';
      ctx.strokeRect(rx + 0.5, ry + 0.5, 209, 69);
      ctx.fillStyle = '#e5bd5e';
      ctx.font = '900 17px monospace';
      ctx.fillText(r[0], rx + 14, ry + 28);
      ctx.fillStyle = '#f1eadc';
      ctx.font = '800 14px "Noto Sans TC",sans-serif';
      ctx.fillText(r[1], rx + 44, ry + 27);
      ctx.fillStyle = 'rgba(241,234,220,0.55)';
      ctx.font = '10px "Noto Sans TC",sans-serif';
      ctx.fillText(r[2], rx + 44, ry + 48);
    });

    ctx.fillStyle = 'rgba(139,197,164,0.12)';
    ctx.fillRect(left, top + 376, 684, 52);
    ctx.fillStyle = '#8bc5a4';
    ctx.font = '800 13px "Noto Sans TC",sans-serif';
    ctx.fillText('ENTER  或點擊畫面開始任務', left + 20, top + 408);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(241,234,220,0.52)';
    ctx.font = '10px "Noto Sans TC",sans-serif';
    ctx.fillText('近距離視野無法躲藏 · 遠距離蹲低可保持隱蔽', left + 664, top + 408);
  }

  function drawOverLegacy(ctx, state, view) {
    var win = state.result === 'win';
    var p = panel(ctx, view, 520, 286);
    ctx.textAlign = 'left';
    ctx.fillStyle = win ? '#8bc5a4' : '#d7604d';
    ctx.font = '800 10px "Noto Sans TC",sans-serif';
    ctx.fillText(win ? 'OPERATION COMPLETE' : 'OPERATION FAILED', p.x + 34, p.y + 38);
    ctx.fillStyle = '#f1eadc';
    ctx.font = '900 34px "Noto Sans TC",sans-serif';
    ctx.fillText(win ? '任務完成' : '任務失敗', p.x + 34, p.y + 82);
    ctx.fillStyle = 'rgba(241,234,220,0.7)';
    ctx.font = '14px "Noto Sans TC",sans-serif';
    if (win) {
      var kills = state.guards.filter(function (g) { return !g.alive; }).length;
      var mins = Math.floor(state.t / 60), secs = Math.floor(state.t % 60);
      ctx.fillText('中繼站已成廢鐵，德軍通訊中斷數小時。', p.x + 34, p.y + 122);
      ctx.fillStyle = 'rgba(229,189,94,0.12)';
      ctx.fillRect(p.x + 34, p.y + 146, 452, 48);
      ctx.fillStyle = '#e5bd5e';
      ctx.font = '800 13px "Noto Sans TC",sans-serif';
      ctx.fillText('耗時 ' + mins + ' 分 ' + secs + ' 秒　　擊殺 ' + kills + ' 名哨兵', p.x + 50, p.y + 176);
    } else {
      ctx.fillText(state.failReason || '', p.x + 34, p.y + 122);
      ctx.fillStyle = 'rgba(215,96,77,0.12)';
      ctx.fillRect(p.x + 34, p.y + 146, 452, 48);
      ctx.fillStyle = '#e5bd5e';
      ctx.font = '700 13px "Noto Sans TC",sans-serif';
      ctx.fillText('提示：K 隨時存檔，L 讀檔重來', p.x + 50, p.y + 176);
    }
    ctx.fillStyle = win ? '#8bc5a4' : '#f1eadc';
    ctx.font = '800 13px "Noto Sans TC",sans-serif';
    ctx.fillText(win ? 'ENTER  再玩一次' : 'ENTER  重新開始' + (view.hasSave ? '　　L  讀取快速存檔' : ''), p.x + 34, p.y + 240);
  }

  function drawUI(ctx, state, view) {
    var navy = '#0a1a32';
    var ink = '#09111f';
    var paper = '#f4f0e8';
    var ice = '#dbe8ef';
    var orange = '#ef5b2a';
    var green = '#507c68';
    var anyAlert = state.guards.some(function (g) { return g.alive && g.state === 'alert'; });
    var anySus = state.guards.some(function (g) { return g.alive && g.state === 'sus'; });

    drawUiTexture(ctx, view, 0.08);

    cutPanel(ctx, 0, 0, 252, 92, navy, 24);
    ctx.fillStyle = orange;
    ctx.fillRect(0, 0, 9, 92);
    ctx.fillStyle = paper;
    ctx.textAlign = 'left';
    ctx.font = '900 9px "Arial Narrow", system-ui, sans-serif';
    ctx.fillText('100 DAYS · DAY 5 / FIELD OPERATION', 20, 24);
    ctx.font = '950 25px Impact, "Arial Narrow", system-ui, "PingFang TC", sans-serif';
    ctx.fillText('霜峽行動', 20, 54);
    ctx.fillStyle = orange;
    ctx.font = '900 10px "Arial Narrow", system-ui, sans-serif';
    ctx.fillText('OPERATION FROSTFJORD', 20, 74);

    state.units.forEach(function (u, i) {
      var x = 278 + i * 108;
      var selected = state.selected === u.id;
      cutPanel(ctx, x, 12, 96, 68, selected ? orange : 'rgba(10,26,50,.94)', 13);
      ctx.fillStyle = selected ? ink : paper;
      ctx.font = '950 17px Impact, "Arial Narrow", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1), x + 10, 35);
      ctx.font = '900 13px "PingFang TC", system-ui, sans-serif';
      ctx.fillText(u.name, x + 32, 35);
      ctx.fillStyle = selected ? ink : 'rgba(244,240,232,.65)';
      ctx.font = '800 8px "Arial Narrow", system-ui, "PingFang TC", sans-serif';
      ctx.fillText(!u.alive ? 'KIA' : u.inBoat ? '船上' : u.crouch ? '隱蔽' : '行動中', x + 10, 53);
      for (var h = 0; h < 3; h++) {
        ctx.fillStyle = h < u.hp ? (selected ? ink : orange) : (selected ? 'rgba(9,17,31,.24)' : 'rgba(244,240,232,.18)');
        ctx.fillRect(x + 10 + h * 25, 62, 20, 4);
      }
    });

    var objectives = state.level.objectives;
    var flagMap = {
      boat: state.flags.boatBoarded,
      island: state.flags.landedIsland,
      station: state.flags.stationDown,
      extract: state.flags.extracted
    };
    cutPanel(ctx, view.w - 238, 0, 238, 154, 'rgba(10,26,50,.95)', 24);
    ctx.fillStyle = orange;
    ctx.fillRect(view.w - 238, 0, 238, 8);
    ctx.fillStyle = paper;
    ctx.textAlign = 'left';
    ctx.font = '950 14px Impact, "Arial Narrow", system-ui, "PingFang TC", sans-serif';
    ctx.fillText('任務進度', view.w - 218, 35);
    ctx.fillStyle = 'rgba(244,240,232,.58)';
    ctx.font = '900 8px "Arial Narrow", system-ui, sans-serif';
    ctx.fillText('MISSION OBJECTIVES', view.w - 218, 51);
    objectives.forEach(function (o, i) {
      var done = flagMap[o.id];
      ctx.fillStyle = done ? green : orange;
      ctx.fillRect(view.w - 218, 67 + i * 19, 12, 12);
      ctx.fillStyle = done ? paper : 'rgba(244,240,232,.82)';
      ctx.font = '800 10px "PingFang TC", system-ui, sans-serif';
      ctx.fillText(o.text, view.w - 196, 77 + i * 19);
    });

    var fox = state.units.filter(function (u) { return u.kind === 'fox'; })[0];
    if (fox && state.selected === 'fox') {
      cutPanel(ctx, 278, 86, 166, 28, navy, 8);
      ctx.fillStyle = '#f3c533';
      ctx.font = '900 10px "Arial Narrow", system-ui, "PingFang TC", sans-serif';
      ctx.fillText('手槍彈藥  ' + fox.ammo + ' / 6', 294, 104);
    }

    if (anyAlert || anySus) {
      var warning = anyAlert ? '敵軍發現你了' : '敵軍正在起疑';
      var wx = view.w / 2 - 142;
      cutPanel(ctx, wx, 118, 284, 46, anyAlert ? '#d9332f' : orange, 16);
      ctx.fillStyle = paper;
      ctx.font = '950 22px Impact, "Arial Narrow", system-ui, "PingFang TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(warning, view.w / 2, 148);
    } else {
      cutPanel(ctx, view.w / 2 - 108, 126, 216, 38, orange, 13);
      ctx.fillStyle = paper;
      ctx.font = '950 19px Impact, "Arial Narrow", system-ui, "PingFang TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('任務進行中', view.w / 2, 151);
    }

    state.barrels.forEach(function (b) {
      if (b.fuse <= 0) return;
      cutPanel(ctx, view.w / 2 - 150, 18, 300, 66, '#d9332f', 18);
      ctx.fillStyle = paper;
      ctx.font = '950 31px Impact, "Arial Narrow", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('引爆 ' + b.fuse.toFixed(1) + ' 秒', view.w / 2, 60);
    });

    ctx.fillStyle = 'rgba(7,18,34,.97)';
    ctx.fillRect(0, view.h - 58, view.w, 58);
    ctx.fillStyle = orange;
    ctx.fillRect(0, view.h - 58, view.w, 5);
    ctx.fillStyle = paper;
    ctx.textAlign = 'left';
    ctx.font = '800 11px "PingFang TC", system-ui, sans-serif';
    ctx.fillText(state.hint || '選擇隊員，點擊地面下達命令。', 18, view.h - 34);
    var commands = [
      ['1–3', '換人'],
      ['C', '蹲低'],
      ['E', '搬運'],
      ['F', '互動'],
      ['Q', '誘餌'],
      ['V', '視野'],
      ['K/L', '存讀']
    ];
    var startX = 360;
    commands.forEach(function (command, i) {
      var x = startX + i * 82;
      keycap(ctx, command[0], x, view.h - 31, false);
      ctx.fillStyle = 'rgba(244,240,232,.62)';
      ctx.font = '800 8px "PingFang TC", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(command[1], x + 31, view.h - 18);
    });
    if (view.saveFlash > 0) {
      cutPanel(ctx, view.w - 226, view.h - 102, 210, 34, green, 10);
      ctx.fillStyle = paper;
      ctx.font = '800 10px "PingFang TC", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(view.saveFlashText.replace('✓ ', ''), view.w - 121, view.h - 81);
    }
  }

  function drawBriefing(ctx, state, view) {
    var navy = '#0a1a32';
    var ink = '#09111f';
    var paper = '#f4f0e8';
    var orange = '#ef5b2a';
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, view.w, view.h);
    drawUiTexture(ctx, view, 0.56);

    cutPanel(ctx, 0, 0, 330, view.h, navy, 46);
    ctx.fillStyle = orange;
    ctx.fillRect(0, 0, 12, view.h);
    ctx.fillStyle = paper;
    ctx.textAlign = 'left';
    ctx.font = '900 10px "Arial Narrow", system-ui, sans-serif';
    ctx.fillText('CLASSIFIED / FIELD BRIEFING 01', 32, 42);
    ctx.font = '950 50px Impact, "Arial Narrow", system-ui, "PingFang TC", sans-serif';
    ctx.fillText('霜峽', 32, 108);
    ctx.fillText('行動', 32, 160);
    ctx.fillStyle = orange;
    ctx.font = '900 13px "Arial Narrow", system-ui, sans-serif';
    ctx.fillText('OPERATION FROSTFJORD', 34, 190);
    ctx.fillStyle = 'rgba(244,240,232,.68)';
    ctx.font = '800 11px "PingFang TC", system-ui, sans-serif';
    ctx.fillText(state.level.briefing.date, 34, 226);
    ctx.fillText('挪威海岸 / 夜間滲透', 34, 246);

    ctx.fillStyle = paper;
    ctx.font = '900 12px "PingFang TC", system-ui, sans-serif';
    ctx.fillText('任務目標', 34, 300);
    state.level.objectives.forEach(function (o, i) {
      ctx.fillStyle = orange;
      ctx.fillRect(34, 320 + i * 40, 18, 18);
      ctx.fillStyle = paper;
      ctx.font = '800 12px "PingFang TC", system-ui, sans-serif';
      ctx.fillText(o.text, 64, 334 + i * 40);
    });

    ctx.fillStyle = ink;
    ctx.font = '900 10px "Arial Narrow", system-ui, sans-serif';
    ctx.fillText('MISSION ROUTE / PRIMARY PATH', 382, 54);
    ctx.fillStyle = orange;
    ctx.font = '950 32px Impact, "Arial Narrow", system-ui, "PingFang TC", sans-serif';
    ctx.fillText('會合 → 奪艇 → 渡海 → 爆破 → 撤離', 380, 96);
    ctx.fillStyle = ink;
    ctx.font = '700 14px "PingFang TC", system-ui, sans-serif';
    ctx.fillText('德軍在北島架設無線電中繼站。三人必須全員生還，', 382, 138);
    ctx.fillText('炸毀目標後返回南岸碼頭，完成撤離。', 382, 162);

    var roster = [
      ['1', '狼', '近身刀殺 / 搬運 / 誘餌'],
      ['2', '狐', '手槍射擊 / 遠距壓制'],
      ['3', '海豹', '駕駛小艇 / 機動支援']
    ];
    roster.forEach(function (r, i) {
      var y = 214 + i * 86;
      cutPanel(ctx, 382, y, 520, 70, i === 0 ? orange : navy, 18);
      ctx.fillStyle = i === 0 ? ink : paper;
      ctx.font = '950 24px Impact, "Arial Narrow", system-ui, sans-serif';
      ctx.fillText(r[0], 402, y + 34);
      ctx.font = '900 18px "PingFang TC", system-ui, sans-serif';
      ctx.fillText(r[1], 452, y + 32);
      ctx.fillStyle = i === 0 ? 'rgba(9,17,31,.68)' : 'rgba(244,240,232,.62)';
      ctx.font = '800 11px "PingFang TC", system-ui, sans-serif';
      ctx.fillText(r[2], 452, y + 53);
    });

    cutPanel(ctx, 382, 500, 520, 82, ink, 22);
    ctx.fillStyle = orange;
    ctx.font = '950 20px Impact, "Arial Narrow", system-ui, "PingFang TC", sans-serif';
    ctx.fillText('ENTER / 點擊畫面　開始行動', 408, 538);
    ctx.fillStyle = 'rgba(244,240,232,.62)';
    ctx.font = '800 10px "PingFang TC", system-ui, sans-serif';
    ctx.fillText('遠距離蹲低可保持隱蔽；近距離視野無法躲藏。', 408, 561);
  }

  function drawOver(ctx, state, view) {
    var win = state.result === 'win';
    var ink = '#09111f';
    var paper = '#f4f0e8';
    var orange = '#ef5b2a';
    var red = '#d9332f';
    var green = '#507c68';
    ctx.fillStyle = win ? paper : ink;
    ctx.fillRect(0, 0, view.w, view.h);
    drawUiTexture(ctx, view, win ? 0.58 : 0.16);

    cutPanel(ctx, 0, 70, view.w, 240, win ? green : red, 56);
    ctx.textAlign = 'center';
    ctx.fillStyle = paper;
    ctx.font = '900 12px "Arial Narrow", system-ui, sans-serif';
    ctx.fillText(win ? 'OPERATION COMPLETE / ALL UNITS EXTRACTED' : 'OPERATION FAILED / FIELD REPORT', view.w / 2, 120);
    ctx.font = '950 74px Impact, "Arial Narrow", system-ui, "PingFang TC", sans-serif';
    ctx.fillText(win ? '任務完成' : '任務失敗', view.w / 2, 220);
    ctx.fillStyle = '#f3c533';
    ctx.fillRect(view.w / 2 - 190, 252, 380, 8);

    ctx.fillStyle = win ? ink : paper;
    ctx.font = '800 14px "PingFang TC", system-ui, sans-serif';
    if (win) {
      var kills = state.guards.filter(function (g) { return !g.alive; }).length;
      var mins = Math.floor(state.t / 60), secs = Math.floor(state.t % 60);
      ctx.fillText('中繼站已摧毀，三名隊員完成撤離。', view.w / 2, 356);
      ctx.font = '950 24px Impact, "Arial Narrow", system-ui, "PingFang TC", sans-serif';
      ctx.fillText('耗時 ' + mins + ' 分 ' + secs + ' 秒　/　擊殺 ' + kills + ' 名哨兵', view.w / 2, 402);
    } else {
      ctx.fillText(state.failReason || '行動中斷。', view.w / 2, 356);
      ctx.fillStyle = orange;
      ctx.font = '900 13px "PingFang TC", system-ui, sans-serif';
      ctx.fillText('提示：K 隨時存檔，L 讀取快速存檔。', view.w / 2, 398);
    }
    cutPanel(ctx, view.w / 2 - 248, 456, 496, 68, win ? ink : paper, 18);
    ctx.fillStyle = win ? paper : ink;
    ctx.font = '900 15px "Arial Narrow", system-ui, "PingFang TC", sans-serif';
    ctx.fillText(win ? 'ENTER　再次執行任務' : 'ENTER　重新開始' + (view.hasSave ? '　　L　讀取存檔' : ''), view.w / 2, 498);
  }

  return {
    draw: draw,
    rebuild: function () { terrain = null; },
    worldSize: function () { return { w: W, h: H }; }
  };
})();
