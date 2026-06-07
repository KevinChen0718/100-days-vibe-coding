// 里程票雷達（命令列入口）：跑一次掃描。用法：node radar.js
import { loadEnv } from './lib/env.js';
import { runScan } from './lib/scan.js';
import { SOURCE_MODE } from './sources/alaska.js';

loadEnv();
console.log(`📡 里程票雷達掃描開始（資料源：${SOURCE_MODE}）\n`);

const r = await runScan({ log: console.log });
console.log(`\n✓ 已更新 data.json（${r.data.results.length} 條航線）`);

if (r.alertCount === 0) {
  console.log('（沒有達標航線，不發通知）');
} else if (!r.notifyReady) {
  console.log(`\n🔔 有 ${r.alertCount} 筆達標，但你還沒設定通知管道。複製 .env.example 成 .env 再填即可。`);
}
