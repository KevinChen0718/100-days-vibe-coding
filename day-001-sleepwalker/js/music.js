/*
 * 夢遊先生 Mr. Sleepwalker — 背景音樂
 * 用 WebAudio 即時生成的慵懶夜曲爵士（無外部音檔），soft pad + 低音 + 稀疏旋律。
 * 向原作「jazzy 背景樂」致敬，但放慢、放軟，配合夢遊的氛圍。
 */
(function (root) {
  'use strict';

  var ctx = null, master = null, filter = null, timer = null, playing = false;
  var nextBar = 0, bar = 0;
  var BAR = 2.8;           // 一小節秒數（很慢，夢遊感）
  var MASTER_VOL = 0.13;

  // 夢遊夜曲和聲（mellow ii-V 循環）：每小節一個和弦的高聲部 + 低音根音
  var CHORDS = [
    { bass: 41, notes: [53, 57, 60, 64] },  // Fmaj7
    { bass: 38, notes: [50, 53, 57, 60] },  // Dm7
    { bass: 43, notes: [55, 58, 62, 65] },  // Gm7
    { bass: 36, notes: [48, 52, 55, 58] }   // C7 → 回到 F
  ];

  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function attach(audioContext) { ctx = audioContext; }

  function ensureChain() {
    if (master) return;
    master = ctx.createGain();
    master.gain.value = 0.0001;
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2100;     // 砍掉高頻，溫暖一點
    filter.Q.value = 0.3;
    filter.connect(master);
    master.connect(ctx.destination);
  }

  function tone(freq, start, dur, type, peak, atk) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    o.connect(g); g.connect(filter);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak, start + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  function scheduleBar(t) {
    var ch = CHORDS[bar % CHORDS.length];
    // soft pad（和弦，略微 detune 增加厚度）
    ch.notes.forEach(function (n, i) {
      var f = midi(n) * (1 + (i % 2 ? 0.001 : -0.001));
      tone(f, t, BAR * 1.05, 'triangle', 0.045, 0.6);
    });
    // 低音
    tone(midi(ch.bass), t, BAR * 0.9, 'sine', 0.10, 0.05);
    tone(midi(ch.bass + 7), t + BAR * 0.5, BAR * 0.4, 'sine', 0.05, 0.05);
    // 稀疏旋律（和弦音高八度，隨機點綴，像夜裡的鋼片琴）
    var beat = BAR / 4;
    var hi = ch.notes.map(function (n) { return n + 12; });
    for (var b = 0; b < 4; b++) {
      if (Math.random() < 0.4) {
        var n = hi[Math.floor(Math.random() * hi.length)];
        tone(midi(n), t + b * beat + (Math.random() * 0.05), 0.55, 'sine', 0.05, 0.015);
      }
    }
    bar++;
  }

  function loop() {
    if (!playing) return;
    var now = ctx.currentTime;
    while (nextBar < now + 0.35) {
      scheduleBar(nextBar);
      nextBar += BAR;
    }
  }

  function start() {
    if (!ctx || playing) return;
    ensureChain();
    playing = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.linearRampToValueAtTime(MASTER_VOL, ctx.currentTime + 1.8);
    nextBar = ctx.currentTime + 0.15;
    bar = 0;
    timer = setInterval(loop, 90);
    loop();
  }

  function stop() {
    if (!playing) return;
    playing = false;
    if (timer) { clearInterval(timer); timer = null; }
    if (master) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
    }
  }

  root.SleepwalkerMusic = {
    attach: attach, start: start, stop: stop,
    isPlaying: function () { return playing; }
  };
})(typeof window !== 'undefined' ? window : this);
