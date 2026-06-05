/* 容差測試：把每個解法物件單獨上下左右偏移，量出仍能通關的範圍（玩家容錯）。 */
var engine = require('../js/engine.js');
var LEVELS = require('../js/levels.js').LEVELS;

function winsWith(lv, placements) {
  return engine.simulate(lv, placements, 6000).state === 'won';
}

// 求某物件沿某軸（'x' 或 'y'）相對解法的可容忍範圍
function tolerance(lv, idx, axis) {
  var base = lv.solution.map(function (p) { return { id: p.id, x: p.x, y: p.y }; });
  var lo = 0, hi = 0;
  for (var d = -2; d >= -60; d -= 2) {
    var pl = base.map(function (p) { return { id: p.id, x: p.x, y: p.y }; });
    pl[idx][axis] += d;
    if (winsWith(lv, pl)) lo = d; else break;
  }
  for (var u = 2; u <= 60; u += 2) {
    var pu = base.map(function (p) { return { id: p.id, x: p.x, y: p.y }; });
    pu[idx][axis] += u;
    if (winsWith(lv, pu)) hi = u; else break;
  }
  return { lo: lo, hi: hi, span: hi - lo };
}

var worst = 999;
LEVELS.forEach(function (lv) {
  var parts = [];
  var levelMin = 999;
  lv.solution.forEach(function (p, idx) {
    var tx = tolerance(lv, idx, 'x');
    var ty = tolerance(lv, idx, 'y');
    levelMin = Math.min(levelMin, tx.span, ty.span);
    parts.push(p.id + ' x[' + tx.lo + ',' + tx.hi + '] y[' + ty.lo + ',' + ty.hi + ']');
  });
  worst = Math.min(worst, levelMin);
  var flag = levelMin < 12 ? '  ⚠ 偏緊' : '';
  console.log('L' + lv.id + ' ' + lv.name + '  最小容差=' + levelMin + 'px' + flag);
  parts.forEach(function (s) { console.log('    ' + s); });
});
console.log('\n全部關卡最小容差：' + worst + 'px（建議 >=12px 才好玩）');
