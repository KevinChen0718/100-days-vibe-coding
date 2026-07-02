/* 霜峽行動 — WebAudio 合成音效（零素材檔） */
'use strict';

var Sound = (function () {
  var ctx = null, master = null, muted = false, windNode = null;

  function ensure() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    startWind();
    return true;
  }

  function beep(freq, dur, type, gain, slideTo) {
    if (!ensure() || muted) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(gain || 0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }

  function noise(dur, filterFreq, gain) {
    if (!ensure() || muted) return;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    var g = ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  function startWind() {
    if (muted || windNode) return;
    var len = ctx.sampleRate * 2;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 280; f.Q.value = 0.6;
    var g = ctx.createGain(); g.gain.value = 0.035;
    var lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.13; lg.gain.value = 0.02;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(); lfo.start();
    windNode = src;
  }

  var fx = {
    knife: function () { noise(0.12, 3200, 0.25); beep(900, 0.08, 'triangle', 0.08, 300); },
    shot: function () { noise(0.1, 1600, 0.5); beep(160, 0.12, 'square', 0.2, 60); },
    gshot: function () { noise(0.1, 1300, 0.5); beep(220, 0.12, 'square', 0.2, 70); },
    boom: function () { noise(1.3, 420, 0.8); beep(60, 1.4, 'sine', 0.5, 28); },
    fuse: function () { beep(880, 0.07, 'square', 0.12); },
    tick: function () { beep(1040, 0.05, 'square', 0.1); },
    beep: function () { beep(1300, 0.06, 'sine', 0.1); },
    sus: function () { beep(420, 0.18, 'sine', 0.1, 520); },
    alert: function () { beep(700, 0.1, 'square', 0.15); setTimeout(function () { beep(940, 0.16, 'square', 0.15); }, 90); },
    board: function () { noise(0.3, 700, 0.18); },
    splash: function () { noise(0.35, 900, 0.2); },
    decoy: function () { noise(0.08, 2500, 0.1); },
    dryfire: function () { beep(2000, 0.03, 'square', 0.08); },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f2, i) {
        setTimeout(function () { beep(f2, 0.3, 'triangle', 0.14); }, i * 140);
      });
    },
    fail: function () {
      [330, 262, 196].forEach(function (f2, i) {
        setTimeout(function () { beep(f2, 0.4, 'triangle', 0.14); }, i * 200);
      });
    }
  };

  return {
    play: function (name) { if (fx[name]) fx[name](); },
    unlock: ensure,
    toggleMute: function () {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    }
  };
})();
