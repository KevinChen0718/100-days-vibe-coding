/*
 * 夢遊先生 Mr. Sleepwalker — 背景音樂
 * WebAudio 即時生成的「慵懶 lounge jazz 夜曲」（無外部音檔）。
 * 爵士味來自：走路低音(walking bass) + 2、4 拍和弦點綴(comp) + 固定旋律動機 + 搖擺(swing)。
 */
(function (root) {
  'use strict';

  var ctx = null, master = null, filter = null, delay = null, timer = null, playing = false;
  var nextBar = 0, bar = 0;
  var TEMPO = 88;                  // BPM，慵懶
  var BEAT = 60 / TEMPO;
  var BAR = BEAT * 4;
  var SWING = 0.06;                // 搖擺偏移（秒）
  var MASTER_VOL = 0.16;

  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // ii–V–I（C 大調）+ 轉回，每小節一個和弦
  // bass：四分音符走路低音；comp：2/4 拍輕和弦；mel：固定旋律動機（null = 休止）
  var PROG = [
    { bass: [38, 41, 45, 47], comp: [53, 57, 60], mel: [69, null, 72, null] },   // Dm7
    { bass: [43, 47, 50, 53], comp: [53, 55, 59], mel: [71, null, 74, 71] },      // G7
    { bass: [36, 40, 43, 45], comp: [52, 55, 59], mel: [72, null, 76, null] },    // Cmaj7
    { bass: [45, 49, 52, 55], comp: [55, 57, 61], mel: [73, null, 72, 69] }       // A7（轉回 Dm7）
  ];

  function attach(audioContext) { ctx = audioContext; }

  function ensureChain() {
    if (master) return;
    master = ctx.createGain();
    master.gain.value = 0.0001;
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2600;
    filter.Q.value = 0.4;
    // 輕微回聲增加空間感
    delay = ctx.createDelay();
    delay.delayTime.value = BEAT * 0.75;
    var fb = ctx.createGain(); fb.gain.value = 0.22;
    var wet = ctx.createGain(); wet.gain.value = 0.25;
    filter.connect(master);
    filter.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
    master.connect(ctx.destination);
  }

  // 撥奏式音色（顫音琴 vibraphone 感）：基音 + 弱八度，柔和起音、自然衰減
  function pluck(freq, start, dur, peak, type) {
    var o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    o2.type = 'sine'; o2.frequency.value = freq * 2; // 八度泛音
    var g2 = ctx.createGain(); g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(filter);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.start(start); o2.start(start);
    o.stop(start + dur + 0.05); o2.stop(start + dur + 0.05);
  }

  function bassNote(freq, start, dur, peak) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    o.connect(g); g.connect(filter);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.start(start); o.stop(start + dur + 0.05);
  }

  function scheduleBar(t) {
    var c = PROG[bar % PROG.length];
    for (var b = 0; b < 4; b++) {
      var bt = t + b * BEAT;
      // 走路低音：每拍一顆
      bassNote(midi(c.bass[b]), bt, BEAT * 0.92, 0.13);
      // comp：2、4 拍輕和弦點綴（帶 swing）
      if (b === 1 || b === 3) {
        c.comp.forEach(function (n) { pluck(midi(n), bt + SWING, BEAT * 0.7, 0.035); });
      }
      // 旋律動機
      var mn = c.mel[b];
      if (mn != null) pluck(midi(mn), bt + (b % 2 ? SWING : 0), BEAT * 1.1, 0.06);
    }
    bar++;
  }

  function loop() {
    if (!playing) return;
    var now = ctx.currentTime;
    while (nextBar < now + 0.4) { scheduleBar(nextBar); nextBar += BAR; }
  }

  function start() {
    if (!ctx || playing) return;
    ensureChain();
    playing = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.linearRampToValueAtTime(MASTER_VOL, ctx.currentTime + 1.5);
    nextBar = ctx.currentTime + 0.15; bar = 0;
    timer = setInterval(loop, 80);
    loop();
  }

  function stop() {
    if (!playing) return;
    playing = false;
    if (timer) { clearInterval(timer); timer = null; }
    if (master) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    }
  }

  root.SleepwalkerMusic = {
    attach: attach, start: start, stop: stop,
    isPlaying: function () { return playing; }
  };
})(typeof window !== 'undefined' ? window : this);
