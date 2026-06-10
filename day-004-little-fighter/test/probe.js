'use strict';
// 臨時探針:觀察 AI 互打的狀態分布(debug 用)
const fs = require('fs'), vm = require('vm'), path = require('path');
const c = { console, Math, JSON };
vm.createContext(c);
for (const f of ['js/data.js', 'js/engine.js', 'js/ai.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), c, { filename: f });
const Engine = vm.runInContext('Engine', c);

const eng = new Engine(process.argv[2] || 'bolt', process.argv[3] || 'blaze', { p1AI: true, p2AI: true });
const states = {}; const snaps = []; let hits = 0;
const oldApply = eng.applyHit.bind(eng);
eng.applyHit = (...a) => { const r = oldApply(...a); if (r) hits++; return r; };
for (let i = 0; i < 1200; i++) {
  eng.step();
  const [a, b] = eng.fighters;
  const k = a.state + '/' + b.state;
  states[k] = (states[k] || 0) + 1;
  if (i % 100 === 0) snaps.push(`f${i}  A(${Math.round(a.x)},${Math.round(a.z)}) ${a.state}  B(${Math.round(b.x)},${Math.round(b.z)}) ${b.state}  projs=${eng.projs.length}`);
}
console.log('hits:', hits);
console.log(snaps.join('\n'));
console.log('--- 狀態組合 top10 ---');
for (const [k, v] of Object.entries(states).sort((x, y) => y[1] - x[1]).slice(0, 10)) console.log(v, k);
