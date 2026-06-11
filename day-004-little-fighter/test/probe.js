'use strict';
// AI 行為探針:統計 AI 互打的狀態分布,調手感用
// 用法:node test/probe.js [角色A] [角色B] [--2v2]
const fs = require('fs'), vm = require('vm'), path = require('path');
const c = { console, Math, JSON };
vm.createContext(c);
for (const f of ['js/data.js', 'js/engine.js', 'js/ai.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), c, { filename: f });
const Engine = vm.runInContext('Engine', c);

const a = process.argv[2] || 'bolt', b = process.argv[3] || 'blaze';
const is2v2 = process.argv.includes('--2v2');
const specs = is2v2
  ? [{ key: a, team: 0, isAI: true }, { key: 'dan', team: 0, isAI: true },
     { key: b, team: 1, isAI: true }, { key: 'frost', team: 1, isAI: true }]
  : [{ key: a, team: 0, isAI: true }, { key: b, team: 1, isAI: true }];
const eng = new Engine(specs, {});

const states = {}; const snaps = []; let hits = 0;
const oldApply = eng.applyHit.bind(eng);
eng.applyHit = (...args) => { const r = oldApply(...args); if (r) hits++; return r; };
for (let i = 0; i < 1800; i++) {
  eng.step();
  const k = eng.fighters.map(f => f.state).join('/');
  states[k] = (states[k] || 0) + 1;
  if (i % 150 === 0) snaps.push(`f${i}  ` + eng.fighters.map(f =>
    `${f.key}(${Math.round(f.x)},${Math.round(f.z)})${f.state}${f.weapon ? '[' + f.weapon.kind + ']' : ''}`).join('  ') +
    `  projs=${eng.projs.length} items=${eng.items.length}`);
}
console.log('hits:', hits);
console.log(snaps.join('\n'));
console.log('--- 狀態組合 top10 ---');
for (const [k, v] of Object.entries(states).sort((x, y) => y[1] - x[1]).slice(0, 10)) console.log(v, k);
