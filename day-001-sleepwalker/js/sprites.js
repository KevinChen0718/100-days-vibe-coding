/*
 * 夢遊先生 Mr. Sleepwalker — 繪圖模組（手繪卡通屋頂夜景風）
 * 全部用 Canvas 向量繪製、無外部圖檔。向原作《Snoozleberg》的童趣夜色城市致敬，
 * 美術為原創（粗黑描邊 + 藍綠紫夜色 + 暖黃窗光 + 圓月光環）。
 */
(function (root) {
  'use strict';

  var CFG = (root.SleepwalkerEngine && root.SleepwalkerEngine.CONFIG) || { WALKER_W: 26, WALKER_H: 46 };
  var WW = CFG.WALKER_W, WH = CFG.WALKER_H;

  var OUT = '#1c2440';          // 粗描邊深藍
  var BUILDINGS = ['#5d86a6', '#6d77b4', '#4f7f8e', '#7e8ac6', '#56919e', '#8f8ad0'];
  var ROOFS = ['#3f5f7a', '#4b5388', '#365d6a', '#5a5f98', '#3c6b76', '#615f9c'];
  var SIGNS = ['HOTEL', 'CAFÉ', 'REST', 'EMBASSY', 'SUB', 'METRO'];

  function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function outline(ctx, w) { ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = w || 2.5; ctx.stroke(); }
  function pick(arr, s) { return arr[Math.abs(Math.round(s.x * 0.017 + s.y * 0.011)) % arr.length]; }

  // ---- 背景：夜空 + 圓月光環 + 星 + 遠景剪影 ----
  var STARS = [];
  (function () {
    for (var i = 0; i < 64; i++) {
      STARS.push({ x: (i * 149.3) % 960, y: (i * 83.7) % 320, s: 2 + (i % 3), ph: i % 7 });
    }
  })();
  var SKY = {
    room: ['#101a3a', '#1d2c52'], roof: ['#0d1430', '#22315c'],
    sky: ['#0a1228', '#1b2c52'], dawn: ['#241a44', '#7a5a86']
  };

  function drawBackground(ctx, level, W, H, time) {
    var sk = SKY[level.theme] || SKY.roof;
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sk[0]); g.addColorStop(1, sk[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    var starA = level.theme === 'dawn' ? 0.3 : 1;
    for (var i = 0; i < STARS.length; i++) {
      var st = STARS[i];
      var tw = 0.5 + 0.5 * Math.sin(time * 0.003 + st.ph);
      ctx.save();
      ctx.globalAlpha = starA * (0.35 + 0.65 * tw);
      ctx.fillStyle = '#7fe6e0';
      ctx.translate(st.x, st.y); ctx.rotate(0.785);
      ctx.fillRect(-st.s / 2, -st.s / 2, st.s, st.s);   // 旋 45° 的小方塊星
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // 圓月光環（藍綠新月）
    var mx = 150, my = 96, mr = 42;
    var mg = ctx.createRadialGradient(mx, my, 6, mx, my, mr + 46);
    mg.addColorStop(0, 'rgba(150,232,224,0.4)'); mg.addColorStop(1, 'rgba(150,232,224,0)');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr + 46, 0, 7); ctx.fill();
    ctx.fillStyle = level.theme === 'dawn' ? '#ffe7c2' : '#a7ece2';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
    ctx.fillStyle = sk[0];                          // 用天空色挖出新月
    ctx.beginPath(); ctx.arc(mx + 16, my - 10, mr - 4, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(167,236,226,0.7)'; ctx.lineWidth = 2;  // 外圈光環
    ctx.beginPath(); ctx.arc(mx + 5, my + 2, mr + 10, 0, 7); ctx.stroke();

    // 遠景城市剪影
    ctx.fillStyle = level.theme === 'dawn' ? 'rgba(60,40,70,0.5)' : 'rgba(40,46,84,0.55)';
    for (var k = 0; k < 8; k++) {
      var bw = 90 + (k % 3) * 46, bx = k * 132 - 30, bh = 120 + (k % 4) * 46, by = H - bh;
      ctx.fillRect(bx, by, bw, bh);
      ctx.beginPath(); ctx.moveTo(bx - 6, by); ctx.lineTo(bx + bw / 2, by - 30); ctx.lineTo(bx + bw + 6, by); ctx.closePath(); ctx.fill();
      if (k % 2) { ctx.beginPath(); ctx.moveTo(bx + bw / 2, by - 30); ctx.lineTo(bx + bw / 2, by - 54); ctx.lineWidth = 2; ctx.strokeStyle = ctx.fillStyle; ctx.stroke(); }
    }
  }

  function drawSmoke(ctx, x, y, time, seed) {
    for (var i = 0; i < 4; i++) {
      var t = (time * 0.02 + i * 1.7 + seed) % 8;
      var py = y - t * 12;
      var pr = 4 + t * 1.6;
      var px = x + Math.sin(t * 1.3 + seed) * (4 + t * 1.5);
      ctx.fillStyle = 'rgba(200,210,230,' + Math.max(0, 0.28 - t * 0.032) + ')';
      ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.fill();
    }
  }

  // ---- 平台 = 卡通建築（屋頂可踩，下面是樓身 + 窗 + 招牌）----
  function drawSolids(ctx, solids, W, H, time) {
    time = time || 0;
    var floors = solids.filter(function (s) { return s.kind !== 'wall'; }).slice().sort(function (a, b) { return a.y - b.y; });
    var walls = solids.filter(function (s) { return s.kind === 'wall'; });

    floors.forEach(function (s) {
      var col = pick(BUILDINGS, s), roof = pick(ROOFS, s);
      var bodyTop = s.y + 8;
      // 樓身
      ctx.fillStyle = col;
      ctx.fillRect(s.x, bodyTop, s.w, (H || 620) - bodyTop);
      ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(s.x, bodyTop); ctx.lineTo(s.x, (H || 620));
      ctx.moveTo(s.x + s.w, bodyTop); ctx.lineTo(s.x + s.w, (H || 620)); ctx.stroke();
      // 窗
      var cols = Math.max(1, Math.floor(s.w / 70));
      var gap = s.w / cols;
      for (var c = 0; c < cols; c++) {
        for (var r = 0; r < 2; r++) {
          var wx = s.x + c * gap + gap / 2 - 11, wy = bodyTop + 24 + r * 56;
          if (wy + 30 > (H || 620) - 6) break;
          var lit = ((c + r + Math.round(s.x)) % 3) === 0;
          ctx.fillStyle = lit ? '#f2dd72' : '#26305a';
          roundRect(ctx, wx, wy, 22, 30, 3); ctx.fill(); outline(ctx, 2);
          if (lit) { ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(wx + 11, wy); ctx.lineTo(wx + 11, wy + 30); ctx.stroke(); }
        }
      }
      // 招牌（較寬的樓才有）
      if (s.w >= 230) {
        var sign = SIGNS[Math.abs(Math.round(s.x * 0.03)) % SIGNS.length];
        var sw = Math.min(s.w - 40, 8 + sign.length * 22), sx = s.x + s.w / 2 - sw / 2, sy = bodyTop + 96;
        if (sy + 30 < (H || 620)) {
          ctx.fillStyle = '#2a2350'; roundRect(ctx, sx, sy, sw, 30, 6); ctx.fill(); outline(ctx, 2);
          ctx.fillStyle = '#ffd98a'; ctx.font = '700 18px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(sign, s.x + s.w / 2, sy + 16); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        }
      }
      // 屋頂（可踩面，略外伸 + 屋瓦紋）
      ctx.fillStyle = roof;
      roundRect(ctx, s.x - 5, s.y, s.w + 10, 14, 4); ctx.fill(); outline(ctx, 2.5);
      ctx.strokeStyle = 'rgba(180,220,230,0.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.x - 3, s.y + 3); ctx.lineTo(s.x + s.w + 3, s.y + 3); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
      for (var hx = s.x + 16; hx < s.x + s.w; hx += 22) { ctx.beginPath(); ctx.moveTo(hx, s.y + 7); ctx.lineTo(hx - 5, s.y + 13); ctx.stroke(); }
    });

    walls.forEach(function (s) {
      if (s.w > 400 && s.h < 40) return;   // 寬扁的上邊界（隱形），不畫
      if (s.h > 280) {                  // 邊界高樓
        ctx.fillStyle = '#2c3457'; ctx.fillRect(s.x, s.y, s.w, s.h);
      } else {                          // 煙囪（會冒煙，先生撞到會轉身）
        drawSmoke(ctx, s.x + s.w / 2, s.y - 4, time, s.x * 0.1);
        ctx.fillStyle = '#7a5040'; roundRect(ctx, s.x, s.y, s.w, s.h, 3); ctx.fill(); outline(ctx, 2.5);
        // 紅磚紋
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
        for (var by = s.y + 10; by < s.y + s.h; by += 12) { ctx.beginPath(); ctx.moveTo(s.x, by); ctx.lineTo(s.x + s.w, by); ctx.stroke(); }
        ctx.fillStyle = '#5e3c30'; ctx.fillRect(s.x - 4, s.y, s.w + 8, 9);
        ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.strokeRect(s.x - 4, s.y, s.w + 8, 9);
      }
    });
  }

  // ---- 屋頂裝飾（不可互動，純豐富畫面）----
  function drawProps(ctx, props, time) {
    if (!props) return;
    props.forEach(function (p) {
      if (p.type === 'antenna') {
        ctx.strokeStyle = '#aab4c4'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 46); ctx.stroke();
        ctx.lineWidth = 2;
        for (var a = 0; a < 4; a++) {
          var ay = p.y - 20 - a * 8, aw = 16 - a * 3;
          ctx.beginPath(); ctx.moveTo(p.x - aw, ay - 6); ctx.lineTo(p.x, ay); ctx.lineTo(p.x + aw, ay - 6); ctx.stroke();
        }
      } else if (p.type === 'dish') {
        ctx.strokeStyle = '#aab4c4'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 22); ctx.stroke();
        ctx.fillStyle = '#c6d0dc'; ctx.beginPath(); ctx.ellipse(p.x - 6, p.y - 24, 16, 11, -0.5, 0, 7); ctx.fill(); outline(ctx, 2);
      } else if (p.type === 'flowerpot') {
        ctx.fillStyle = '#b9603f'; roundRect(ctx, p.x - 12, p.y - 14, 24, 14, 3); ctx.fill(); outline(ctx, 2);
        var fc = ['#e7d34a', '#e88aa8', '#e7d34a'];
        for (var f = 0; f < 3; f++) {
          var fx = p.x - 8 + f * 8;
          ctx.strokeStyle = '#5a7d4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, p.y - 14); ctx.lineTo(fx, p.y - 26); ctx.stroke();
          ctx.fillStyle = fc[f]; ctx.beginPath(); ctx.arc(fx, p.y - 28, 5, 0, 7); ctx.fill(); outline(ctx, 1.5);
          ctx.fillStyle = '#fff7d0'; ctx.beginPath(); ctx.arc(fx, p.y - 28, 1.8, 0, 7); ctx.fill();
        }
      } else if (p.type === 'cat') {
        ctx.fillStyle = p.color || '#e09a4a';
        ctx.beginPath(); ctx.ellipse(p.x, p.y - 6, 14, 7, 0, 0, 7); ctx.fill(); outline(ctx, 2);   // 身體
        ctx.beginPath(); ctx.arc(p.x - 12, p.y - 12, 6, 0, 7); ctx.fill(); outline(ctx, 2);          // 頭
        ctx.beginPath(); ctx.moveTo(p.x - 16, p.y - 16); ctx.lineTo(p.x - 14, p.y - 22); ctx.lineTo(p.x - 11, p.y - 16); ctx.closePath(); ctx.fill();  // 耳
        ctx.beginPath(); ctx.moveTo(p.x - 9, p.y - 16); ctx.lineTo(p.x - 7, p.y - 22); ctx.lineTo(p.x - 4, p.y - 16); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = (p.color || '#e09a4a'); ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x + 13, p.y - 8); ctx.quadraticCurveTo(p.x + 24, p.y - 12, p.x + 20, p.y - 20); ctx.stroke();   // 尾
      } else if (p.type === 'clothesline') {
        ctx.strokeStyle = 'rgba(230,235,245,0.6)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo((p.x + p.x2) / 2, p.y + 16, p.x2, p.y2 != null ? p.y2 : p.y); ctx.stroke();
        var cols = ['#d96a6a', '#6a9ad9', '#e7d34a', '#7fb87f'];
        var n = Math.max(2, Math.floor((p.x2 - p.x) / 40));
        for (var c = 0; c < n; c++) {
          var tt = (c + 1) / (n + 1), lx = p.x + (p.x2 - p.x) * tt, ly = p.y + 16 * (1 - Math.pow(2 * tt - 1, 2)) + 2;
          ctx.fillStyle = cols[c % cols.length];
          roundRect(ctx, lx - 7, ly, 14, 18, 3); ctx.fill(); outline(ctx, 1.5);
        }
      } else if (p.type === 'smokestack') {
        drawSmoke(ctx, p.x, p.y - 8, time, p.x * 0.1);
        ctx.fillStyle = '#7a5040'; roundRect(ctx, p.x - 9, p.y - 8, 18, 30, 3); ctx.fill(); outline(ctx, 2);
        ctx.fillStyle = '#5e3c30'; ctx.fillRect(p.x - 12, p.y - 8, 24, 7); outline(ctx, 2);
      }
    });
  }

  function drawBed(ctx, bed) {
    var x = bed.x - 64, y = bed.y - 36;
    ctx.fillStyle = '#8a5236'; roundRect(ctx, x, y, 100, 36, 6); ctx.fill(); outline(ctx, 2.5);
    ctx.fillStyle = '#efe7d6'; roundRect(ctx, x + 4, y + 7, 92, 16, 5); ctx.fill();
    ctx.fillStyle = '#86a4d8'; roundRect(ctx, x + 42, y + 7, 54, 16, 5); ctx.fill();
    ctx.fillStyle = '#fff'; roundRect(ctx, x + 8, y + 5, 28, 13, 5); ctx.fill(); outline(ctx, 1.5);
    ctx.fillStyle = '#8a5236'; roundRect(ctx, x - 5, y - 16, 13, 52, 4); ctx.fill(); outline(ctx, 2.5);
  }

  // ---- 出口：暖黃的家窗 ----
  function drawExit(ctx, exit, time) {
    var x = exit.x, y = exit.y, w = exit.w, h = exit.h, cx = x + w / 2, cy = y + h / 2;
    var pulse = 0.5 + 0.22 * Math.sin(time * 0.004);
    var gg = ctx.createRadialGradient(cx, cy, 4, cx, cy, 80);
    gg.addColorStop(0, 'rgba(255,224,150,' + pulse + ')'); gg.addColorStop(1, 'rgba(255,224,150,0)');
    ctx.fillStyle = gg; ctx.fillRect(x - 56, y - 56, w + 112, h + 92);
    ctx.fillStyle = '#6a4a8a'; roundRect(ctx, x - 6, y - 6, w + 12, h + 8, 6); ctx.fill(); outline(ctx, 2.5);
    var dg = ctx.createLinearGradient(x, y, x, y + h);
    dg.addColorStop(0, '#ffe9a8'); dg.addColorStop(1, '#f2c25e');
    ctx.fillStyle = dg; roundRect(ctx, x, y, w, h, 4); ctx.fill(); outline(ctx, 2.5);
    ctx.strokeStyle = 'rgba(120,80,40,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y + h); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy); ctx.stroke();
    ctx.fillStyle = 'rgba(90,60,30,0.85)'; ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('家', cx, y - 10); ctx.textAlign = 'left';
  }

  function drawHazard(ctx, hz, time) {
    if (hz.kind === 'water' || hz.kind === 'pit') {
      var wg = ctx.createLinearGradient(0, hz.y, 0, hz.y + hz.h);
      wg.addColorStop(0, 'rgba(70,140,170,0.9)'); wg.addColorStop(1, 'rgba(30,70,130,0.95)');
      ctx.fillStyle = wg; ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
      ctx.strokeStyle = 'rgba(190,230,240,0.45)'; ctx.lineWidth = 2; ctx.beginPath();
      for (var x = hz.x; x <= hz.x + hz.w; x += 4) {
        var yy = hz.y + 7 + Math.sin((x + time * 0.05) * 0.17) * 3;
        if (x === hz.x) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      } ctx.stroke();
    } else if (hz.kind === 'spike') {
      // 鐵柵欄尖刺
      var n = Math.max(1, Math.floor(hz.w / 18)), sw = hz.w / n;
      for (var i = 0; i < n; i++) {
        var sx = hz.x + i * sw;
        ctx.fillStyle = '#aeb6c6';
        ctx.beginPath(); ctx.moveTo(sx, hz.y + hz.h); ctx.lineTo(sx + sw / 2, hz.y); ctx.lineTo(sx + sw, hz.y + hz.h); ctx.closePath(); ctx.fill(); outline(ctx, 1.5);
      }
    }
  }

  // ---- 可移動道具 ----
  function drawMovable(ctx, m, opts) {
    opts = opts || {};
    ctx.save();
    if (opts.dragging) { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6; }
    if (m.locked) ctx.globalAlpha = 0.92;

    var t = m.type;
    if (t === 'board' || t === 'plank') {
      // 木板：跨在缺口上當橋
      var pg = ctx.createLinearGradient(0, m.y, 0, m.y + m.h);
      pg.addColorStop(0, '#d2a063'); pg.addColorStop(1, '#9c6a38');
      ctx.fillStyle = pg; roundRect(ctx, m.x, m.y, m.w, m.h, 4); ctx.fill(); outline(ctx, 2.5);
      ctx.strokeStyle = 'rgba(80,50,20,0.5)'; ctx.lineWidth = 1;
      for (var gx = m.x + 18; gx < m.x + m.w; gx += 26) { ctx.beginPath(); ctx.moveTo(gx, m.y + 2); ctx.lineTo(gx, m.y + m.h - 2); ctx.stroke(); }
    } else if (t === 'antenna') {
      // 倒下的電視天線：當橋
      var cy0 = m.y + m.h / 2;
      ctx.fillStyle = '#9aa6b6'; roundRect(ctx, m.x, cy0 - 3, m.w, 6, 3); ctx.fill(); outline(ctx, 2);
      ctx.strokeStyle = '#c2ccd8'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      for (var ap = 0; ap < 4; ap++) {
        var axp = m.x + 14 + ap * ((m.w - 24) / 3), len = 9 - ap * 1.5;
        ctx.beginPath(); ctx.moveTo(axp, cy0 - 3 - len); ctx.lineTo(axp, cy0 + 3 + len); ctx.stroke();
      }
      ctx.fillStyle = '#8a96a6'; ctx.beginPath(); ctx.arc(m.x + m.w - 6, cy0, 4, 0, 7); ctx.fill(); outline(ctx, 1.5);
    } else if (t === 'crate' || t === 'box') {
      // 木箱 / 屋頂雜物
      var bg = ctx.createLinearGradient(0, m.y, 0, m.y + m.h);
      bg.addColorStop(0, '#d6a468'); bg.addColorStop(1, '#a4733e');
      ctx.fillStyle = bg; roundRect(ctx, m.x, m.y, m.w, m.h, 5); ctx.fill(); outline(ctx, 2.5);
      ctx.strokeStyle = 'rgba(80,50,20,0.55)'; ctx.lineWidth = 2.5;
      ctx.strokeRect(m.x + 5, m.y + 5, m.w - 10, m.h - 10);
      ctx.beginPath(); ctx.moveTo(m.x + 5, m.y + 5); ctx.lineTo(m.x + m.w - 5, m.y + m.h - 5);
      ctx.moveTo(m.x + m.w - 5, m.y + 5); ctx.lineTo(m.x + 5, m.y + m.h - 5); ctx.stroke();
    } else if (t === 'spring') {
      ctx.fillStyle = '#3b6e9c'; roundRect(ctx, m.x, m.y + m.h - 4, m.w, 5, 2); ctx.fill(); outline(ctx, 2);
      ctx.strokeStyle = '#9fb6cc'; ctx.lineWidth = 2.2;
      for (var s = 0; s <= 5; s++) { var spx = m.x + 7 + (m.w - 14) * (s / 5); ctx.beginPath(); ctx.moveTo(spx, m.y + 2); ctx.lineTo(spx, m.y + m.h - 4); ctx.stroke(); }
      var sg = ctx.createLinearGradient(0, m.y - 2, 0, m.y + 6);
      sg.addColorStop(0, '#ff8aa0'); sg.addColorStop(1, '#e85d7a');
      ctx.fillStyle = sg; roundRect(ctx, m.x - 3, m.y - 3, m.w + 6, 8, 3); ctx.fill(); outline(ctx, 2);
    } else {
      // 遮陽棚（awning / mattress）：軟著陸
      ctx.fillStyle = '#f4f0e6'; roundRect(ctx, m.x, m.y, m.w, m.h, 7); ctx.fill();
      ctx.save(); roundRect(ctx, m.x, m.y, m.w, m.h, 7); ctx.clip();
      var stripeW = 20;
      for (var i2 = 0; i2 * stripeW < m.w + stripeW; i2++) {
        ctx.fillStyle = (i2 % 2) ? '#e0584f' : '#f4f0e6';
        ctx.fillRect(m.x + i2 * stripeW, m.y, stripeW, m.h);
      }
      ctx.restore();
      roundRect(ctx, m.x, m.y, m.w, m.h, 7); outline(ctx, 2.5);
      ctx.fillStyle = '#e0584f';
      for (var scp = 0; scp * 16 < m.w; scp++) { ctx.beginPath(); ctx.arc(m.x + 8 + scp * 16, m.y + m.h, 8, 0, Math.PI); ctx.fill(); }
    }
    ctx.restore();

    if (m.locked) {
      // 已固定：小釘子標記
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(m.x + m.w / 2, m.y + m.h / 2, 2.5, 0, 7); ctx.fill();
    } else if (opts.hover || opts.dragging) {
      ctx.strokeStyle = opts.dragging ? 'rgba(255,224,150,0.95)' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      roundRect(ctx, m.x - 3, m.y - 3, m.w + 6, m.h + 6, 6); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  function hexA(hex, a) {
    var h = hex.replace('#', '');
    return 'rgba(' + parseInt(h.substring(0, 2), 16) + ',' + parseInt(h.substring(2, 4), 16) + ',' + parseInt(h.substring(4, 6), 16) + ',' + a + ')';
  }

  // ---- 水管口（傳送門）：走進去從另一個水管口出來 ----
  function drawPortal(ctx, p, time) {
    var cx = p.x + p.w / 2, cy = p.y + p.h / 2, col = p.color || '#9b8cff', rx = p.w / 2, ry = p.h / 2;
    // 光暈
    var g = ctx.createRadialGradient(cx, cy, 2, cx, cy, p.w * 1.7);
    g.addColorStop(0, hexA(col, 0.4 + 0.18 * Math.sin(time * 0.005))); g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g; ctx.fillRect(cx - p.w * 1.7, cy - p.w * 1.7, p.w * 3.4, p.w * 3.4);
    // 水管外環（金屬）
    ctx.fillStyle = '#7c8596'; roundRect(ctx, p.x - 6, p.y - 6, p.w + 12, p.h + 12, 12); ctx.fill(); outline(ctx, 2.5);
    ctx.fillStyle = '#9aa6b6'; roundRect(ctx, p.x - 2, p.y - 2, p.w + 4, p.h + 4, 10); ctx.fill();
    // 管內（發光漩渦）
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.clip();
    var sg = ctx.createRadialGradient(cx, cy, 2, cx, cy, ry * 1.4);
    sg.addColorStop(0, hexA(col, 0.9)); sg.addColorStop(0.6, 'rgba(10,8,24,0.95)'); sg.addColorStop(1, hexA(col, 0.5));
    ctx.fillStyle = sg; ctx.fillRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4);
    ctx.strokeStyle = hexA(col, 0.6); ctx.lineWidth = 2;
    for (var i = 1; i <= 3; i++) { var rr = ry * (i / 3.4); ctx.beginPath(); ctx.ellipse(cx, cy, rr * 0.8, rr, time * 0.02 * (i % 2 ? 1 : -1), 0, 5); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = '#4a5364'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.stroke();
    for (var k = 0; k < 3; k++) { var ang = time * 0.04 + k * 2.094; ctx.fillStyle = hexA(col, 0.9); ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * (rx + 2), cy + Math.sin(ang) * (ry + 2), 2, 0, 7); ctx.fill(); }
  }

  function drawMover(ctx, m) {
    var g = ctx.createLinearGradient(0, m.y, 0, m.y + m.h);
    g.addColorStop(0, '#8a93a6'); g.addColorStop(1, '#566072');
    ctx.fillStyle = g; roundRect(ctx, m.x, m.y, m.w, m.h, 5); ctx.fill(); outline(ctx, 2.5);
  }

  // ---- 夢遊先生（翹鬍子、垂睡帽、條紋睡衣、橘拖鞋；明顯搖晃）----
  function drawWalker(ctx, w, time, state) {
    var cx = w.x + WW / 2, top = w.y, feet = w.y + WH, face = w.facing, moving = (state === 'walking');

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(cx, feet + 2, 16, 4, 0, 0, 7); ctx.fill();

    var dreamRot = Math.sin(time * 0.0033 + cx * 0.01) * 0.16 + (moving ? Math.sin(w.walkAnim * 0.5) * 0.05 : 0);
    var dreamSway = Math.sin(time * 0.0026 + 1.2) * 6;
    var sc = WW / 26;   // 縮小整體繪製以符合較小的碰撞框
    ctx.translate(cx + dreamSway, top);
    ctx.translate(0, WH); ctx.rotate(dreamRot); ctx.translate(0, -WH);
    ctx.scale(face * sc, sc);

    var swing = moving ? Math.sin(w.walkAnim) : 0;
    var bob = (moving ? Math.abs(Math.sin(w.walkAnim)) * 1.4 : 0) + Math.sin(time * 0.003) * 2.2;
    var oy = -bob;
    var headTilt = Math.sin(time * 0.0029 + 0.6) * 0.12;

    // 腿 + 橘拖鞋
    ctx.strokeStyle = '#e9e2d2'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4, 30 + oy); ctx.lineTo(-4 + swing * 6, 43 + oy); ctx.moveTo(5, 30 + oy); ctx.lineTo(5 - swing * 6, 43 + oy); ctx.stroke();
    ctx.fillStyle = '#e8943a';
    roundRect(ctx, -11 + swing * 6, 42 + oy, 13, 5, 2.5); ctx.fill(); outline(ctx, 1.5);
    roundRect(ctx, -1 - swing * 6, 42 + oy, 13, 5, 2.5); ctx.fill(); outline(ctx, 1.5);

    // 身體（條紋睡衣）
    var bt = 13 + oy;
    ctx.fillStyle = '#eef0ff'; roundRect(ctx, -11, bt, 22, 21, 8); ctx.fill(); outline(ctx, 2.5);
    ctx.save(); roundRect(ctx, -11, bt, 22, 21, 8); ctx.clip();
    ctx.strokeStyle = 'rgba(110,140,210,0.6)'; ctx.lineWidth = 3;
    for (var sy = bt + 3; sy < bt + 21; sy += 5) { ctx.beginPath(); ctx.moveTo(-11, sy); ctx.lineTo(11, sy); ctx.stroke(); }
    ctx.restore();

    // 手臂前伸
    ctx.strokeStyle = '#eef0ff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(4, bt + 5); ctx.lineTo(19, bt + 3); ctx.moveTo(4, bt + 10); ctx.lineTo(19, bt + 8); ctx.stroke();
    ctx.fillStyle = '#f3cf9f'; ctx.beginPath(); ctx.arc(20, bt + 3, 3.4, 0, 7); ctx.fill(); outline(ctx, 1.5);
    ctx.beginPath(); ctx.arc(20, bt + 8, 3.4, 0, 7); ctx.fill(); outline(ctx, 1.5);

    // 頭（點頭晃）
    var hcx = 0, hcy = 3 + oy;
    ctx.save(); ctx.translate(hcx, hcy + 7); ctx.rotate(headTilt); ctx.translate(-hcx, -(hcy + 7));
    ctx.fillStyle = '#f3cf9f'; ctx.beginPath(); ctx.arc(hcx, hcy, 11.5, 0, 7); ctx.fill(); outline(ctx, 2.5);
    // 閉眼
    ctx.strokeStyle = '#5a4636'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(hcx + 3, hcy - 1, 2.6, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(hcx + 9, hcy - 1, 2.6, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
    // 翹鬍子
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hcx + 2, hcy + 6); ctx.quadraticCurveTo(hcx + 8, hcy + 5, hcx + 12, hcy + 2);
    ctx.moveTo(hcx + 2, hcy + 6); ctx.quadraticCurveTo(hcx + 8, hcy + 8, hcx + 12, hcy + 8); ctx.stroke();
    // 紅鼻
    ctx.fillStyle = '#e8a98b'; ctx.beginPath(); ctx.arc(hcx + 10, hcy + 3, 2, 0, 7); ctx.fill();
    // 垂睡帽
    ctx.fillStyle = '#7d9bd1';
    ctx.beginPath(); ctx.moveTo(hcx - 11, hcy - 5); ctx.quadraticCurveTo(hcx - 20, hcy - 30, hcx - 28, hcy - 30);
    ctx.quadraticCurveTo(hcx - 6, hcy - 22, hcx + 10, hcy - 9); ctx.closePath(); ctx.fill(); outline(ctx, 2.5);
    ctx.fillStyle = '#fff'; roundRect(ctx, hcx - 13, hcy - 12, 24, 6, 3); ctx.fill(); outline(ctx, 1.5);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hcx - 29, hcy - 31, 4.5, 0, 7); ctx.fill(); outline(ctx, 1.5);
    ctx.restore();
    ctx.restore();

    // Zzz
    if (state !== 'won') {
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.85)';
      var zb = Math.sin(time * 0.004);
      ctx.globalAlpha = 0.5 + 0.3 * zb;
      ctx.font = '700 13px system-ui'; ctx.fillText('z', cx + 13, top - 6 + zb * 2);
      ctx.font = '700 10px system-ui'; ctx.fillText('z', cx + 21, top - 14 + zb * 2);
      ctx.font = '700 8px system-ui'; ctx.fillText('z', cx + 27, top - 21 + zb * 2);
      ctx.restore();
    }
  }

  root.SleepwalkerSprites = {
    drawBackground: drawBackground, drawSolids: drawSolids, drawBed: drawBed,
    drawExit: drawExit, drawHazard: drawHazard, drawMovable: drawMovable,
    drawPortal: drawPortal, drawMover: drawMover, drawWalker: drawWalker,
    drawProps: drawProps, roundRect: roundRect
  };
})(typeof window !== 'undefined' ? window : this);
