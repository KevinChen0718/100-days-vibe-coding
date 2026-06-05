/* 追蹤指定關卡：每隔幾步印出位置與落地事件，方便調關。 */
var path = require('path');
var enginePath = path.join(__dirname, '..', 'js', 'engine.js');
var LEVELS = require('../js/levels.js').LEVELS;

var id = parseInt(process.argv[2] || '4', 10);
var lv = LEVELS.find(function (l) { return l.id === id; });

// 重新載入 engine 並打補丁，攔截落地/失敗事件
delete require.cache[require.resolve(enginePath)];
var engine = require(enginePath);
var Game = engine.Game;

var g = new Game(lv);
lv.solution.forEach(function (p) { g.setMovable(p.id, p.x, p.y); });

// 包裝 _moveVertical 印出落地
var origFail = g._fail.bind(g);
g._fail = function (r) { console.log('  >> FAIL @t=' + g.time + ' x=' + g.walker.x.toFixed(0) + ' y=' + g.walker.y.toFixed(0) + ' : ' + r); origFail(r); };

g.start();
var lastGround = true;
for (var i = 0; i < 2000; i++) {
  var wasAir = g.walker.airborne;
  g.step();
  var w = g.walker;
  if (i % 20 === 0) {
    console.log('t=' + g.time + ' x=' + w.x.toFixed(0) + ' y=' + w.y.toFixed(0) + ' vy=' + w.vy.toFixed(1) + ' face=' + w.facing + ' ground=' + w.onGround + ' air=' + w.airborne + ' peak=' + w.peakFeet.toFixed(0));
  }
  if (g.state !== 'walking') { console.log('END t=' + g.time + ' state=' + g.state + ' x=' + w.x.toFixed(0) + ' y=' + w.y.toFixed(0)); break; }
}
