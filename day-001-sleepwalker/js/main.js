/*
 * 夢遊先生 Mr. Sleepwalker — 主控制器
 * 遊戲迴圈、輸入（滑鼠/觸控拖曳）、UI、過關存檔、音效。
 */
(function () {
  'use strict';

  var Engine = window.SleepwalkerEngine;
  var Sprites = window.SleepwalkerSprites;
  var LEVELS = window.SleepwalkerLevels.LEVELS;
  var W = 960, H = 620;
  var STEP_MS = 1000 / 60;
  var PROGRESS_KEY = 'snoozleberg_progress_v1';
  var SOUND_KEY = 'snoozleberg_sound_v1';

  var canvas, ctx, dpr = 1;
  var game = null;
  var currentIndex = 0;
  var appState = 'title';        // title | playing
  var showHint = false;
  var acc = 0, last = 0;
  var speedMult = 1;     // 快轉倍率（1×/2×/3×）
  var prevState = 'ready';
  var prevLaunched = false;

  // 拖曳狀態
  var drag = { id: null, offx: 0, offy: 0 };
  var hoverId = null;

  // ---- 進度存檔 ----
  function getUnlocked() {
    var v = parseInt(localStorage.getItem(PROGRESS_KEY) || '0', 10);
    return isNaN(v) ? 0 : v;
  }
  function setUnlocked(i) {
    if (i > getUnlocked()) localStorage.setItem(PROGRESS_KEY, String(i));
  }

  // ---- 音效（WebAudio，無外部檔）----
  var audioCtx = null;
  var soundOn = localStorage.getItem(SOUND_KEY) !== 'off';
  function ensureAudio() {
    if (!audioCtx && window.AudioContext) audioCtx = new AudioContext();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (audioCtx && window.SleepwalkerMusic) window.SleepwalkerMusic.attach(audioCtx);
  }
  function musicSync() {
    if (!window.SleepwalkerMusic) return;
    if (soundOn && audioCtx) window.SleepwalkerMusic.start();
    else window.SleepwalkerMusic.stop();
  }
  function beep(freq, dur, type, vol, when) {
    if (!soundOn || !audioCtx) return;
    var t0 = audioCtx.currentTime + (when || 0);
    var o = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function sndWin() { [523, 659, 784, 1047].forEach(function (f, i) { beep(f, 0.25, 'triangle', 0.18, i * 0.1); }); }
  function sndLose() { beep(330, 0.25, 'sawtooth', 0.15, 0); beep(180, 0.4, 'sawtooth', 0.15, 0.12); }
  function sndBounce() { beep(420, 0.12, 'square', 0.12); beep(760, 0.12, 'square', 0.1, 0.05); }
  function sndDrop() { beep(180, 0.07, 'sine', 0.1); }
  function sndClick() { beep(620, 0.05, 'triangle', 0.08); }

  // ---- DOM ----
  var el = {};
  function $(id) { return document.getElementById(id); }

  function setupCanvas() {
    canvas = $('cv');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clientToWorld(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) / r.width * W,
      y: (clientY - r.top) / r.height * H
    };
  }

  // ---- 關卡流程 ----
  function loadLevel(i) {
    currentIndex = i;
    game = new Engine.Game(LEVELS[i]);
    prevState = 'ready';
    prevLaunched = false;
    showHint = false;
    appState = 'playing';
    hideOverlay('all');
    updateTopbar();
    updateControls();
    musicSync();
  }
  function startWalk() {
    if (!game || game.state !== 'ready') return;
    ensureAudio();
    game.start();   // 放走後仍可即時移動「還沒被先生碰到」的道具
    updateControls();
  }
  function resetLevel() {
    if (!game) return;
    game.reset();
    prevState = 'ready';
    hideOverlay('win'); hideOverlay('lose');
    updateControls();
  }
  function nextLevel() {
    if (currentIndex + 1 < LEVELS.length) loadLevel(currentIndex + 1);
    else showFinale();
  }

  function onWin() {
    setUnlocked(currentIndex + 1);
    sndWin();
    $('winText').textContent = '過關！';
    $('winSub').textContent = LEVELS[currentIndex].name + ' 完成';
    var isLast = currentIndex + 1 >= LEVELS.length;
    $('btnNext').textContent = isLast ? '看結局' : '下一關 →';
    showOverlay('win');
  }
  function onLose(reason) {
    sndLose();
    $('loseText').textContent = reason || '先生醒了！';
    showOverlay('lose');
  }

  // ---- 畫面（overlay）----
  function showOverlay(name) { $(name + 'Screen').classList.add('show'); }
  function hideOverlay(name) {
    if (name === 'all') {
      ['title', 'levelSelect', 'win', 'lose', 'finale'].forEach(function (n) {
        var e = $(n + 'Screen'); if (e) e.classList.remove('show');
      });
    } else { var e = $(name + 'Screen'); if (e) e.classList.remove('show'); }
  }

  function updateTopbar() {
    var lv = LEVELS[currentIndex];
    $('chapter').textContent = lv.chapter;
    $('lvname').textContent = 'L' + lv.id + ' · ' + lv.name;
    $('hintline').textContent = lv.story;
  }
  function updateControls() {
    var ready = game && game.state === 'ready';
    $('btnStart').disabled = !ready;
    $('btnStart').textContent = ready ? '放他走 ▶' : '走路中…';
    $('btnSound').textContent = soundOn ? '♪ 開' : '♪ 關';
  }

  function buildLevelSelect() {
    var grid = $('lvGrid');
    grid.innerHTML = '';
    var unlocked = getUnlocked();
    LEVELS.forEach(function (lv, i) {
      var b = document.createElement('button');
      b.className = 'lvbtn' + (i > unlocked ? ' locked' : '');
      b.innerHTML = '<span class="lvnum">' + lv.id + '</span><span class="lvtag">' + lv.name + '</span>';
      if (i <= unlocked) {
        b.addEventListener('click', function () { sndClick(); hideOverlay('levelSelect'); loadLevel(i); });
      } else {
        b.innerHTML = '<span class="lvnum">🔒</span><span class="lvtag">' + lv.name + '</span>';
      }
      grid.appendChild(b);
    });
  }

  function showFinale() {
    appState = 'title';
    showOverlay('finale');
    sndWin();
  }

  // ---- 主迴圈 ----
  function frame(ts) {
    if (!last) last = ts;
    var dt = ts - last; last = ts;
    if (dt > 250) dt = 250;       // 切回分頁時別爆衝

    if (appState === 'playing' && game && game.state === 'walking') {
      acc += dt * speedMult;
      var guard = 0;
      while (acc >= STEP_MS && guard < 24) {
        game.step();
        acc -= STEP_MS;
        guard++;
        if (game.walker.launched && !prevLaunched) sndBounce();
        prevLaunched = game.walker.launched;
        if (game.state !== 'walking') break;
      }
      // 狀態轉變
      if (prevState === 'walking' && game.state === 'won') onWin();
      else if (prevState === 'walking' && game.state === 'lost') onLose(game.failReason);
      prevState = game.state;
    }

    render();
    requestAnimationFrame(frame);
  }

  function render() {
    var time = performance.now();
    if (!game) {
      // 標題畫面用第二章屋頂當底
      Sprites.drawBackground(ctx, { theme: 'roof' }, W, H, time);
      return;
    }
    var lv = LEVELS[currentIndex];
    Sprites.drawBackground(ctx, lv, W, H, time);
    Sprites.drawSolids(ctx, game.staticSolids, W, H, time);
    if (Sprites.drawProps) Sprites.drawProps(ctx, lv.props, time);
    game.movers.forEach(function (mv) { Sprites.drawMover(ctx, mv); });
    Sprites.drawBed(ctx, lv.bed);
    game.hazards.forEach(function (hz) { Sprites.drawHazard(ctx, hz, time); });
    game.portals.forEach(function (pt) { Sprites.drawPortal(ctx, pt, time); });
    Sprites.drawExit(ctx, game.exit, time);

    // 提示：解法位置的虛影
    if (showHint && game.state === 'ready') {
      ctx.save();
      ctx.globalAlpha = 0.32;
      lv.solution.forEach(function (sol) {
        var m = null;
        for (var i = 0; i < game.movables.length; i++) if (game.movables[i].id === sol.id) m = game.movables[i];
        if (!m) return;
        Sprites.drawMovable(ctx, { type: m.type, x: sol.x, y: sol.y, w: m.w, h: m.h });
      });
      ctx.restore();
    }

    game.movables.forEach(function (m) {
      Sprites.drawMovable(ctx, m, { hover: hoverId === m.id, dragging: drag.id === m.id });
    });
    Sprites.drawWalker(ctx, game.walker, time, game.state);
  }

  // ---- 輸入 ----
  function movableById(id) {
    if (!game) return null;
    for (var i = 0; i < game.movables.length; i++) if (game.movables[i].id === id) return game.movables[i];
    return null;
  }
  function pointerDown(e) {
    if (appState !== 'playing' || !game) return;
    if (game.state === 'won' || game.state === 'lost') return;
    var p = clientToWorld(e.clientX, e.clientY);
    var m = game.movableAt(p.x, p.y);
    if (m && !m.locked) {        // 被先生碰過的道具已固定、不能再抓
      ensureAudio();
      drag.id = m.id;
      drag.offx = p.x - m.x;
      drag.offy = p.y - m.y;
      hoverId = m.id;
      e.preventDefault();
    }
  }
  function pointerMove(e) {
    if (appState !== 'playing' || !game) return;
    var p = clientToWorld(e.clientX, e.clientY);
    if (drag.id) {
      var dm = movableById(drag.id);
      if (!dm || dm.locked) { drag.id = null; }   // 拖到一半被先生碰到就放手
      else { game.setMovable(drag.id, p.x - drag.offx, p.y - drag.offy); e.preventDefault(); }
    } else if (game.state === 'ready' || game.state === 'walking') {
      var m = game.movableAt(p.x, p.y);
      var grabbable = m && !m.locked;
      hoverId = grabbable ? m.id : null;
      canvas.style.cursor = grabbable ? 'grab' : 'default';
    } else {
      hoverId = null;
      canvas.style.cursor = 'default';
    }
  }
  function pointerUp() {
    if (drag.id) { sndDrop(); drag.id = null; }
  }

  function bindInput() {
    canvas.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerUp);

    $('btnStart').addEventListener('click', function () { sndClick(); startWalk(); });
    $('btnReset').addEventListener('click', function () { sndClick(); resetLevel(); });
    $('btnHint').addEventListener('click', function () { sndClick(); showHint = !showHint; });
    $('btnSpeed').addEventListener('click', function () {
      speedMult = speedMult >= 3 ? 1 : speedMult + 1;
      sndClick(); $('btnSpeed').textContent = speedMult + '×';
    });
    $('btnMenu').addEventListener('click', function () { sndClick(); buildLevelSelect(); showOverlay('levelSelect'); });
    $('btnSound').addEventListener('click', function () {
      soundOn = !soundOn; localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off');
      ensureAudio(); updateControls(); musicSync(); if (soundOn) sndClick();
    });

    $('btnPlay').addEventListener('click', function () { ensureAudio(); sndClick(); hideOverlay('title'); loadLevel(0); });
    $('btnPlayResume').addEventListener('click', function () { ensureAudio(); sndClick(); hideOverlay('title'); loadLevel(getUnlocked() < LEVELS.length ? getUnlocked() : 0); });
    $('btnSelectFromTitle').addEventListener('click', function () { sndClick(); buildLevelSelect(); showOverlay('levelSelect'); });
    $('btnNext').addEventListener('click', function () { sndClick(); hideOverlay('win'); nextLevel(); });
    $('btnRetry').addEventListener('click', function () { sndClick(); hideOverlay('lose'); resetLevel(); });
    $('btnCloseSelect').addEventListener('click', function () { sndClick(); hideOverlay('levelSelect'); });
    $('btnFinaleMenu').addEventListener('click', function () { sndClick(); hideOverlay('finale'); buildLevelSelect(); showOverlay('levelSelect'); });

    window.addEventListener('keydown', function (e) {
      if (appState !== 'playing' || !game) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (game.state === 'ready') startWalk();
        else if (game.state === 'won') { hideOverlay('win'); nextLevel(); }
        else if (game.state === 'lost') { hideOverlay('lose'); resetLevel(); }
      } else if (e.key === 'r' || e.key === 'R') {
        resetLevel();
      } else if (e.key === 'h' || e.key === 'H') {
        showHint = !showHint;
      }
    });
  }

  // ---- 啟動 ----
  // 自動化測試掛勾（對玩家無影響）
  window.__snooze = {
    load: function (i) { loadLevel(i); },
    solve: function () {
      if (!game) return;
      LEVELS[currentIndex].solution.forEach(function (s) { game.setMovable(s.id, s.x, s.y); });
    },
    start: function () { startWalk(); },
    state: function () { return game ? game.state : null; },
    index: function () { return currentIndex; },
    fast: function () { speedMult = 3; },
    count: LEVELS.length
  };

  function init() {
    el.cache = true;
    setupCanvas();
    bindInput();
    // 標題畫面顯示「繼續」與否
    if (getUnlocked() > 0) $('btnPlayResume').style.display = 'inline-flex';
    showOverlay('title');
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
