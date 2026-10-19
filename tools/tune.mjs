// 自動調整每個押注鍵的大燈機率，讓單押期望值都接近目標：node tools/tune.mjs 0.92
import { createRequire } from 'module';
const C = createRequire(import.meta.url)('../core.js');
const T = +process.argv[2] || 0.92, N = 1500000;
function rtp(k) {
  const bets = Array(8).fill(0); bets[k] = 1; const st = { snor: 0, jp: C.JP_SEED }; let won = 0;
  for (let g = 0; g < N; g++) { let mult = 1, r; do { r = C.play(bets, st, Math.random, mult); won += r.pay; mult++; } while (r.evo); }
  return won / N;
}
for (let it = 0; it < 4; it++) {
  const rs = [];
  for (let k = 0; k < 8; k++) { const r = rtp(k); rs.push(r); C.KEY_P[k].big = Math.max(0.0005, C.KEY_P[k].big + (T - r) / C.KEYS[k].mult); }
  C.build();
  console.log(it, rs.map(r => (r * 100).toFixed(1)).join(' '), '| big:', C.KEY_P.map(p => p.big.toFixed(5)).join(', '), '| 卡比獸', C.W[17].toFixed(4));
}
