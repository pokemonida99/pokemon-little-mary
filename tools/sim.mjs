// 期望值模擬：node tools/sim.mjs [局數]
import { createRequire } from 'module';
const C = createRequire(import.meta.url)('../core.js');
const N = +process.argv[2] || 3e6;

function run(bets) {
  const st = { snor: 0, jp: C.JP_SEED };
  const B = bets.reduce((a, b) => a + b, 0);
  let paid = 0, won = 0, hits = 0, maxPay = 0, jpHits = 0;
  for (let g = 0; g < N; g++) {
    st.jp += B * C.JP_RATE; paid += B;
    let mult = 1, sum = 0, r;
    do { r = C.play(bets, st, Math.random, mult); sum += r.pay; if (r.jp) jpHits++; mult++; } while (r.evo);
    won += sum; if (sum > 0) hits++; if (sum > maxPay) maxPay = sum;
  }
  return { rtp: won / paid, hit: hits / N, maxPay, jpHits };
}
console.log('停燈機率：', C.LAMPS.map((l, i) => `${i}:${l.sp || C.KEYS[l.k].name + (l.s ? '小' : '')}=${(C.W[i] * 100).toFixed(2)}%`).join('  '));
for (let k = 0; k < 8; k++) {
  const bets = Array(8).fill(0); bets[k] = 1;
  const r = run(bets);
  console.log(`只押 ${C.KEYS[k].name.padEnd(4, '　')} RTP ${(r.rtp * 100).toFixed(2)}%  中獎率 ${(r.hit * 100).toFixed(1)}%  最高 ${r.maxPay}`);
}
const r = run(Array(8).fill(1));
console.log(`全押各 1   RTP ${(r.rtp * 100).toFixed(2)}%  中獎率 ${(r.hit * 100).toFixed(1)}%  最高 ${r.maxPay}  彩金 ${r.jpHits} 次`);
