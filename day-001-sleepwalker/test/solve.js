/* 自動可解性測試：每關套用 solution 座標，模擬至結束，斷言通關。 */
var engine = require('../js/engine.js');
var LEVELS = require('../js/levels.js').LEVELS;

var pass = 0, fail = 0;
LEVELS.forEach(function (lv) {
  var r = engine.simulate(lv, lv.solution, 6000);
  var ok = r.state === 'won';
  if (ok) pass++; else fail++;
  console.log(
    (ok ? 'PASS' : 'FAIL') +
    '  L' + lv.id + ' ' + lv.name +
    '  -> ' + r.state +
    (r.reason ? ' (' + r.reason + ')' : '') +
    '  steps=' + r.steps
  );
});
console.log('\n結果：' + pass + ' 通過 / ' + fail + ' 失敗，共 ' + LEVELS.length + ' 關');
process.exit(fail ? 1 : 0);
