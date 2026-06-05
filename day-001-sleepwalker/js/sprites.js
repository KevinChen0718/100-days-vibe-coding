/*
 * 夢遊先生 Mr. Sleepwalker — 繪圖模組（全部用 Canvas 向量畫，無外部圖檔）
 */
(function (root) {
  'use strict';

  var CFG = (root.SleepwalkerEngine && root.SleepwalkerEngine.CONFIG) || { WALKER_W: 26, WALKER_H: 46 };
  var WW = CFG.WALKER_W, WH = CFG.WALKER_H;

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

  // ---- 背景（依主題切換夜色）----
  var THEMES = {
    room:  { top: '#2b2440', bot: '#4a3a5c', glow: '#5a4a6e', tint: 'rgba(255,210,140,0.06)' },
    roof:  { top: '#0e1430', bot: '#27365e', glow: '#3a4d82', tint: 'rgba(150,190,255,0.05)' },
    sky:   { top: '#0a1228', bot: '#1d2c4a', glow: '#2e4068', tint: 'rgba(120,160,230,0.05)' },
    dawn:  { top: '#3a2f4e', bot: '#9a6b5a', glow: '#c98a5e', tint: 'rgba(255,180,120,0.08)' }
  };

  var STARS = [];
  (function seedStars() {
    // 固定亂數（避免 Math.random 不可重現），用簡單公式撒星星
    for (var i = 0; i < 70; i++) {
      var x = (i * 137.5) % 960;
      var y = ((i * 71.3) % 300);
      var s = ((i * 13) % 3) * 0.5 + 0.5;
      STARS.push({ x: x, y: y, s: s, ph: (i % 7) });
    }
  })();

  function drawBackground(ctx, level, W, H, time) {
    var th = THEMES[level.theme] || THEMES.roof;
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.top);
    g.addColorStop(1, th.bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 星星（dawn 時淡出）
    var starAlpha = level.theme === 'dawn' ? 0.25 : 1;
    for (var i = 0; i < STARS.length; i++) {
      var st = STARS[i];
      var tw = 0.5 + 0.5 * Math.sin(time * 0.003 + st.ph);
      ctx.globalAlpha = starAlpha * (0.3 + 0.7 * tw);
      ctx.fillStyle = '#fff';
      ctx.fillRect(st.x, st.y, st.s, st.s);
    }
    ctx.globalAlpha = 1;

    // 月亮
    var mx = 820, my = 90, mr = 46;
    var mg = ctx.createRadialGradient(mx, my, 4, mx, my, mr + 40);
    mg.addColorStop(0, 'rgba(255,247,224,0.55)');
    mg.addColorStop(1, 'rgba(255,247,224,0)');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(mx, my, mr + 40, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = level.theme === 'dawn' ? '#ffe6c0' : '#f6f0d8';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.beginPath(); ctx.arc(mx - 14, my - 8, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 10, my + 12, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 16, my - 14, 5, 0, Math.PI * 2); ctx.fill();

    // 遠方房屋剪影
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (var k = 0; k < 7; k++) {
      var bw = 120 + (k % 3) * 40;
      var bx = k * 150 - 40;
      var bh = 90 + (k % 4) * 35;
      ctx.fillRect(bx, H - bh - 8, bw, bh);
      // 屋頂
      ctx.beginPath();
      ctx.moveTo(bx - 8, H - bh - 8);
      ctx.lineTo(bx + bw / 2, H - bh - 44);
      ctx.lineTo(bx + bw + 8, H - bh - 8);
      ctx.closePath(); ctx.fill();
    }
    // 暖光罩
    ctx.fillStyle = th.tint;
    ctx.fillRect(0, 0, W, H);
  }

  // ---- 靜態地板 / 牆（木質）----
  function drawSolids(ctx, solids) {
    for (var i = 0; i < solids.length; i++) {
      var s = solids[i];
      var isWall = s.kind === 'wall';
      // 牆用磚色，地板用木色
      ctx.fillStyle = isWall ? '#3a3346' : '#6b4a36';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      if (!isWall) {
        // 木板頂面亮邊
        ctx.fillStyle = '#86603f';
        ctx.fillRect(s.x, s.y, s.w, 5);
        ctx.fillStyle = 'rgba(255,220,170,0.18)';
        ctx.fillRect(s.x, s.y, s.w, 2);
        // 木紋接縫
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 1;
        for (var x = s.x + 40; x < s.x + s.w; x += 56) {
          ctx.beginPath(); ctx.moveTo(x, s.y + 5); ctx.lineTo(x, s.y + s.h); ctx.stroke();
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(s.x, s.y, 3, s.h);
      }
    }
  }

  function drawBed(ctx, bed) {
    var x = bed.x - 64, y = bed.y - 34;
    // 床架
    ctx.fillStyle = '#7c4b34';
    roundRect(ctx, x, y, 96, 34, 6); ctx.fill();
    // 床墊
    ctx.fillStyle = '#e7e0d2';
    roundRect(ctx, x + 4, y + 6, 88, 16, 5); ctx.fill();
    // 棉被
    ctx.fillStyle = '#7d9bd1';
    roundRect(ctx, x + 40, y + 6, 52, 16, 5); ctx.fill();
    // 枕頭
    ctx.fillStyle = '#fff';
    roundRect(ctx, x + 8, y + 4, 26, 12, 4); ctx.fill();
    // 床頭板
    ctx.fillStyle = '#7c4b34';
    roundRect(ctx, x - 4, y - 14, 12, 48, 4); ctx.fill();
  }

  // ---- 出口（發光的門）----
  function drawExit(ctx, exit, time) {
    var x = exit.x, y = exit.y, w = exit.w, h = exit.h;
    var pulse = 0.55 + 0.25 * Math.sin(time * 0.004);
    var gg = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, 70);
    gg.addColorStop(0, 'rgba(255,224,150,' + pulse + ')');
    gg.addColorStop(1, 'rgba(255,224,150,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(x - 50, y - 50, w + 100, h + 80);
    // 門框
    ctx.fillStyle = '#5b3b27';
    roundRect(ctx, x - 4, y - 4, w + 8, h + 4, 6); ctx.fill();
    // 門
    var dg = ctx.createLinearGradient(x, y, x, y + h);
    dg.addColorStop(0, '#ffe9b8');
    dg.addColorStop(1, '#f0b65e');
    ctx.fillStyle = dg;
    roundRect(ctx, x, y, w, h, 5); ctx.fill();
    // 門把
    ctx.fillStyle = '#7c4b27';
    ctx.beginPath(); ctx.arc(x + w - 12, y + h / 2, 3.5, 0, Math.PI * 2); ctx.fill();
    // EXIT 字樣
    ctx.fillStyle = 'rgba(90,60,30,0.85)';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('出口', x + w / 2, y + 18);
    ctx.textAlign = 'left';
  }

  // ---- 危險物 ----
  function drawHazard(ctx, hz, time) {
    if (hz.kind === 'water') {
      var wg = ctx.createLinearGradient(0, hz.y, 0, hz.y + hz.h);
      wg.addColorStop(0, 'rgba(90,150,220,0.85)');
      wg.addColorStop(1, 'rgba(40,90,160,0.95)');
      ctx.fillStyle = wg;
      ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
      // 波紋
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var x = hz.x; x <= hz.x + hz.w; x += 4) {
        var yy = hz.y + 6 + Math.sin((x + time * 0.05) * 0.18) * 3;
        if (x === hz.x) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    } else if (hz.kind === 'spike') {
      ctx.fillStyle = '#c9ccd4';
      var n = Math.max(1, Math.floor(hz.w / 18));
      var sw = hz.w / n;
      for (var i = 0; i < n; i++) {
        var sx = hz.x + i * sw;
        ctx.beginPath();
        ctx.moveTo(sx, hz.y + hz.h);
        ctx.lineTo(sx + sw / 2, hz.y);
        ctx.lineTo(sx + sw, hz.y + hz.h);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (var j = 0; j < n; j++) {
        var sx2 = hz.x + j * sw;
        ctx.beginPath();
        ctx.moveTo(sx2 + sw / 2, hz.y);
        ctx.lineTo(sx2 + sw / 2 + 2, hz.y + hz.h);
        ctx.lineTo(sx2 + sw / 2 - 1, hz.y + hz.h);
        ctx.closePath(); ctx.fill();
      }
    } else if (hz.kind === 'fire') {
      ctx.fillStyle = 'rgba(255,120,40,0.9)';
      ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
    }
  }

  // ---- 可移動物件 ----
  function drawMovable(ctx, m, opts) {
    opts = opts || {};
    ctx.save();
    if (opts.dragging) {
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
    }
    if (m.type === 'plank') {
      var pg = ctx.createLinearGradient(0, m.y, 0, m.y + m.h);
      pg.addColorStop(0, '#c99257'); pg.addColorStop(1, '#9c6a38');
      ctx.fillStyle = pg;
      roundRect(ctx, m.x, m.y, m.w, m.h, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(80,50,20,0.5)'; ctx.lineWidth = 1;
      for (var gx = m.x + 18; gx < m.x + m.w; gx += 26) {
        ctx.beginPath(); ctx.moveTo(gx, m.y + 2); ctx.lineTo(gx, m.y + m.h - 2); ctx.stroke();
      }
    } else if (m.type === 'box') {
      var bg = ctx.createLinearGradient(0, m.y, 0, m.y + m.h);
      bg.addColorStop(0, '#cf9b5d'); bg.addColorStop(1, '#a06d39');
      ctx.fillStyle = bg;
      roundRect(ctx, m.x, m.y, m.w, m.h, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(90,55,20,0.6)'; ctx.lineWidth = 3;
      ctx.strokeRect(m.x + 4, m.y + 4, m.w - 8, m.h - 8);
      ctx.beginPath();
      ctx.moveTo(m.x + 4, m.y + 4); ctx.lineTo(m.x + m.w - 4, m.y + m.h - 4);
      ctx.moveTo(m.x + m.w - 4, m.y + 4); ctx.lineTo(m.x + 4, m.y + m.h - 4);
      ctx.stroke();
    } else if (m.type === 'spring') {
      // 底座 + 彈簧 + 上墊
      ctx.fillStyle = '#3b6e9c';
      roundRect(ctx, m.x, m.y + m.h - 4, m.w, 4, 2); ctx.fill();
      ctx.strokeStyle = '#9fb6cc'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (var s = 0; s <= 6; s++) {
        var sx = m.x + 6 + (m.w - 12) * (s / 6);
        ctx.moveTo(sx, m.y + 2); ctx.lineTo(sx, m.y + m.h - 4);
      }
      ctx.stroke();
      var sg = ctx.createLinearGradient(0, m.y, 0, m.y + 6);
      sg.addColorStop(0, '#ff8aa0'); sg.addColorStop(1, '#e85d7a');
      ctx.fillStyle = sg;
      roundRect(ctx, m.x - 2, m.y - 2, m.w + 4, 7, 3); ctx.fill();
    } else if (m.type === 'mattress') {
      var mg = ctx.createLinearGradient(0, m.y, 0, m.y + m.h);
      mg.addColorStop(0, '#7fb4e6'); mg.addColorStop(1, '#4f86c2');
      ctx.fillStyle = mg;
      roundRect(ctx, m.x, m.y, m.w, m.h, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
      for (var bx = m.x + 18; bx < m.x + m.w; bx += 28) {
        ctx.beginPath(); ctx.moveTo(bx, m.y + 3); ctx.lineTo(bx, m.y + m.h - 3); ctx.stroke();
      }
      // 鈕扣
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (var cx = m.x + 18; cx < m.x + m.w; cx += 28) {
        ctx.beginPath(); ctx.arc(cx, m.y + m.h / 2, 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // 可拖曳提示外框
    if (opts.hover || opts.dragging) {
      ctx.strokeStyle = opts.dragging ? 'rgba(255,224,150,0.95)' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      roundRect(ctx, m.x - 3, m.y - 3, m.w + 6, m.h + 6, 6); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ---- 夢遊先生本人 ----
  function drawWalker(ctx, w, time, state) {
    var cx = w.x + WW / 2;
    var top = w.y;
    var feet = w.y + WH;
    var face = w.facing;
    var moving = (state === 'walking');

    ctx.save();
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, feet + 2, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(cx, top);
    ctx.scale(face, 1);   // 依面向翻轉

    var swing = moving ? Math.sin(w.walkAnim) : 0;
    var bob = moving ? Math.abs(Math.sin(w.walkAnim)) * 1.5 : 0;
    var oy = -bob;

    // 腿
    ctx.strokeStyle = '#d9d2c4';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, 30 + oy); ctx.lineTo(-4 + swing * 6, 44 + oy);
    ctx.moveTo(5, 30 + oy); ctx.lineTo(5 - swing * 6, 44 + oy);
    ctx.stroke();
    // 拖鞋
    ctx.fillStyle = '#caa15a';
    roundRect(ctx, -10 + swing * 6, 43 + oy, 12, 4, 2); ctx.fill();
    roundRect(ctx, 0 - swing * 6, 43 + oy, 12, 4, 2); ctx.fill();

    // 身體（條紋睡衣）
    var bodyTop = 14 + oy;
    ctx.fillStyle = '#eef0ff';
    roundRect(ctx, -10, bodyTop, 20, 20, 7); ctx.fill();
    ctx.save();
    roundRect(ctx, -10, bodyTop, 20, 20, 7); ctx.clip();
    ctx.strokeStyle = 'rgba(120,150,220,0.55)';
    ctx.lineWidth = 2.5;
    for (var sy = bodyTop + 3; sy < bodyTop + 20; sy += 5) {
      ctx.beginPath(); ctx.moveTo(-10, sy); ctx.lineTo(10, sy); ctx.stroke();
    }
    ctx.restore();

    // 手臂前伸（夢遊招牌動作）
    ctx.strokeStyle = '#eef0ff';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(4, bodyTop + 5); ctx.lineTo(20, bodyTop + 2);
    ctx.moveTo(4, bodyTop + 9); ctx.lineTo(20, bodyTop + 7);
    ctx.stroke();
    // 手掌
    ctx.fillStyle = '#f3d2b3';
    ctx.beginPath(); ctx.arc(21, bodyTop + 2, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(21, bodyTop + 7, 3.2, 0, Math.PI * 2); ctx.fill();

    // 頭
    var hcx = 0, hcy = 4 + oy;
    ctx.fillStyle = '#f6d7b8';
    ctx.beginPath(); ctx.arc(hcx, hcy, 11, 0, Math.PI * 2); ctx.fill();
    // 閉眼（兩道弧）
    ctx.strokeStyle = '#5a4636';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(hcx + 3, hcy - 1, 2.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(hcx + 8, hcy - 1, 2.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    // 紅鼻 + 微笑
    ctx.fillStyle = '#e8a98b';
    ctx.beginPath(); ctx.arc(hcx + 9, hcy + 3, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9a6a4a';
    ctx.beginPath(); ctx.arc(hcx + 5, hcy + 5, 2.5, 0.1 * Math.PI, 0.6 * Math.PI); ctx.stroke();

    // 睡帽
    ctx.fillStyle = '#7d9bd1';
    ctx.beginPath();
    ctx.moveTo(hcx - 11, hcy - 4);
    ctx.quadraticCurveTo(hcx - 18, hcy - 26, hcx - 24, hcy - 30);
    ctx.quadraticCurveTo(hcx - 6, hcy - 20, hcx + 9, hcy - 9);
    ctx.closePath(); ctx.fill();
    // 帽緣
    ctx.fillStyle = '#fff';
    roundRect(ctx, hcx - 12, hcy - 11, 22, 5, 2.5); ctx.fill();
    // 帽尖毛球
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(hcx - 25, hcy - 31, 4, 0, Math.PI * 2); ctx.fill();

    ctx.restore();

    // Zzz（不翻轉，飄在頭右上）
    if (state !== 'won') {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '700 13px system-ui, sans-serif';
      var zb = Math.sin(time * 0.004);
      ctx.globalAlpha = 0.5 + 0.3 * zb;
      ctx.fillText('z', cx + 12, top - 6 + zb * 2);
      ctx.font = '700 10px system-ui, sans-serif';
      ctx.fillText('z', cx + 20, top - 14 + zb * 2);
      ctx.font = '700 8px system-ui, sans-serif';
      ctx.fillText('z', cx + 26, top - 21 + zb * 2);
      ctx.restore();
    }
  }

  root.SleepwalkerSprites = {
    drawBackground: drawBackground,
    drawSolids: drawSolids,
    drawBed: drawBed,
    drawExit: drawExit,
    drawHazard: drawHazard,
    drawMovable: drawMovable,
    drawWalker: drawWalker,
    roundRect: roundRect
  };
})(typeof window !== 'undefined' ? window : this);
