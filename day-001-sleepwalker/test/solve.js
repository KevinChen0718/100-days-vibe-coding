/*
 * 關卡驗證：
 *  1) 可解性 —— 套用 solution 座標能通關。
 *  2) 非平凡 —— 道具留在初始位置（沒擺）時「不能」通關（否則代表放著不動就能過）。
 *  3) 必要性 —— 每個道具單獨缺席（其他都擺對）時「不能」通關（否則代表該道具可省）。
 * 因為玩家放走後就鎖定道具，這三項一起確保關卡是真正要動腦的謎題。
 */
var engine = require('../js/engine.js');
var LEVELS = require('../js/levels.js').LEVELS;

function sim(level, placements) { return engine.simulate(level, placements, 9000); }

var fail = 0;
LEVELS.forEach(function (lv) {
  var msgs = [];
  // 1) 可解
  var solved = sim(lv, lv.solution).state === 'won';
  if (!solved) msgs.push('不可解(' + sim(lv, lv.solution).reason + ')');

  // 2) 非平凡：不擺任何道具（留初始位置）→ 不該贏
  var parked = sim(lv, null);
  if (parked.state === 'won') msgs.push('平凡(沒擺就過)');

  // 3) 必要性：把某道具移到畫面外（等於沒這個道具）、其他擺對 → 不該贏
  lv.solution.forEach(function (s) {
    var placements = lv.solution.map(function (x) {
      return x.id === s.id ? { id: x.id, x: -9999, y: -9999 } : x;
    });
    if (sim(lv, placements).state === 'won') msgs.push('道具[' + s.id + ']可省');
  });

  var ok = msgs.length === 0;
  if (!ok) fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  L' + lv.id + ' ' + lv.name +
    '  道具×' + lv.solution.length + (ok ? '' : '  → ' + msgs.join('；')));
});
console.log('\n結果：' + (LEVELS.length - fail) + ' / ' + LEVELS.length + ' 關通過（可解 + 非平凡 + 每個道具都必要）');
process.exit(fail ? 1 : 0);
