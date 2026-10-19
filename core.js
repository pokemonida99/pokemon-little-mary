// 寶可夢小瑪莉：機率與派彩核心（瀏覽器與 tools/sim.mjs 共用，不碰畫面）
(function (G) {
  // 8 個押注鍵，倍率由低到高；img = assets/sym/s{img}.webp
  const KEYS = [
    { id: 'pika', name: '皮卡丘', img: 4, mult: 5, col: '#ffd23f' },
    { id: 'eevee', name: '伊布', img: 5, mult: 10, col: '#c98a4b' },
    { id: 'bulba', name: '妙蛙種子', img: 1, mult: 15, col: '#4fbf6f' },
    { id: 'charm', name: '小火龍', img: 2, mult: 20, col: '#ff8a2a' },
    { id: 'squirt', name: '傑尼龜', img: 3, mult: 20, col: '#4fb0ff' },
    { id: 'meowth', name: '喵喵', img: 7, mult: 30, col: '#f3d27a' },
    { id: 'gengar', name: '耿鬼', img: 8, mult: 40, col: '#9a5cff' },
    { id: 'mewtwo', name: '超夢', img: 9, mult: 100, col: '#e07bff' },
  ];
  const SMALL = 3;            // 小燈一律 ×3（超夢小燈例外 ×50）
  const MEWTWO_SMALL = 50;

  // 外圈 24 燈，從左上角順時針。k = 押注鍵，s = 小燈；sp = 特殊燈
  const L = (k, s) => ({ k, s: !!s, m: s ? (k === 7 ? MEWTWO_SMALL : SMALL) : KEYS[k].mult });
  const LAMPS = [
    L(7), L(0), L(5), L(5, 1), L(4), L(4, 1), L(1),          // 0–6  上排（左→右）
    L(0), L(6), L(6, 1), { sp: 'ball' }, L(2),               // 7–11 右欄（上→下）
    L(7, 1), L(0), L(3), L(3, 1), L(2, 1), { sp: 'snor' }, L(1), // 12–18 下排（右→左）
    L(0), L(1, 1), { sp: 'lucky' }, L(0, 1), { sp: 'evo' },  // 19–23 左欄（下→上）
  ];
  const CORNERS = [0, 6, 12, 18];

  // ---- 機率表（每局停在哪一燈）----
  // 每個押注鍵：大燈總機率 big、小燈總機率 small（同鍵多盞大燈平分）
  const KEY_P = [
    { big: 0.0878, small: 0.0550 },   // 皮卡丘 ×5   (4 盞大燈)
    { big: 0.0462, small: 0.0550 },   // 伊布   ×10  (2 盞)
    { big: 0.0309, small: 0.0550 },   // 妙蛙   ×15
    { big: 0.0217, small: 0.0550 },  // 小火龍 ×20
    { big: 0.0220, small: 0.0550 },  // 傑尼龜 ×20
    { big: 0.0141, small: 0.0550 },   // 喵喵   ×30
    { big: 0.0108, small: 0.0550 }, // 耿鬼   ×40
    { big: 0.00215, small: 0.0045 },   // 超夢   ×100 / 小 ×50
  ];
  const SP_P = { ball: 0.050, evo: 0.025, lucky: 0.030 };   // 卡比獸 = 剩下的機率
  const W = [];
  const SNOR = LAMPS.findIndex(l => l.sp === 'snor');
  function build() {   // 由 KEY_P / SP_P 算出每盞燈的停燈機率；卡比獸吃掉剩下的
    LAMPS.forEach((l, i) => {
      const n = l.sp ? 1 : LAMPS.filter(x => !x.sp && x.k === l.k && x.s === l.s).length;
      W[i] = l.sp ? (SP_P[l.sp] || 0) : (l.s ? KEY_P[l.k].small : KEY_P[l.k].big) / n;
    });
    W[SNOR] = 0; W[SNOR] = Math.max(0, 1 - W.reduce((a, b) => a + b, 0));
  }
  build();
  const PAYING = LAMPS.map((l, i) => i).filter(i => !LAMPS[i].sp);

  // 收服（精靈球）送燈：1–3 盞
  const BALL_N = { 1: 55, 2: 35, 3: 10 };
  // 卡比獸鬧鐘：累積 SNOR_NEED 次醒來，送 SNOR_GIFT 盞
  const SNOR_NEED = 10, SNOR_GIFT = 2;
  // 進化：免費同押注再跑一次，獎金倍率 +1（最高 ×4）
  const EVO_MAX = 4;
  // 傳說燈事件
  const LUCKY = [
    { id: 'train', name: '皮卡丘開火車', w: 34 },
    { id: 'rain', name: '流星雨', w: 22 },
    { id: 'four', name: '大四喜', w: 9 },
    { id: 'small3', name: '小三元', w: 9 },
    { id: 'big3', name: '大三元', w: 3 },
    { id: 'corner', name: '縱橫四海', w: 5 },
    { id: 'jp', name: '超夢覺醒 JACKPOT', w: 0.4 },
    { id: 'fly', name: '鳳王飛走了', w: 17.6 },
  ];
  const JP_RATE = 0.02, JP_SEED = 500;   // 每局押分的 2% 進彩金池

  function pickW(ws, rng) { let s = 0; for (const w of ws) s += w; let x = rng() * s; for (let i = 0; i < ws.length; i++) { x -= ws[i]; if (x < 0) return i; } return ws.length - 1; }
  function pickObj(obj, rng) { const ks = Object.keys(obj); return +ks[pickW(ks.map(k => obj[k]), rng)]; }
  const lampPay = (i, bets) => LAMPS[i].sp ? 0 : LAMPS[i].m * bets[LAMPS[i].k];
  // 依基本機率抽 n 盞不重複的派彩燈
  function sendLamps(n, rng, avoid = []) {
    const out = [];
    while (out.length < n) {
      const pool = PAYING.filter(i => !out.includes(i) && !avoid.includes(i));
      if (!pool.length) break;
      out.push(pool[pickW(pool.map(i => W[i]), rng)]);
    }
    return out;
  }
  const allBet = bets => bets.every(b => b > 0);

  // 跑一局。st = { snor, jp }（會被修改）；mult = 進化倍率
  // 回傳 { stop, type, lamps, event, pay, mult, evo, wake, jp }
  function play(bets, st, rng = Math.random, mult = 1) {
    const stop = pickW(W, rng), lamp = LAMPS[stop];
    const r = { stop, type: lamp.sp || 'pay', lamps: [], event: null, pay: 0, mult, evo: false, wake: false, jp: 0 };
    if (!lamp.sp) r.lamps.push(stop);
    else if (lamp.sp === 'ball') { r.lamps = sendLamps(pickObj(BALL_N, rng), rng); }
    else if (lamp.sp === 'evo') { r.evo = mult < EVO_MAX; if (!r.evo) r.lamps = sendLamps(2, rng); }
    else if (lamp.sp === 'snor') {
      st.snor = (st.snor || 0) + 1;
      if (st.snor >= SNOR_NEED) { st.snor = 0; r.wake = true; r.lamps = sendLamps(SNOR_GIFT, rng); }
    } else if (lamp.sp === 'lucky') {
      let ev = LUCKY[pickW(LUCKY.map(e => e.w), rng)];
      if (ev.id === 'jp' && !allBet(bets)) ev = LUCKY.find(e => e.id === 'rain');   // 沒全押：彩金變流星雨
      r.event = ev.id;
      if (ev.id === 'train') {
        const len = 3 + pickW([40, 30, 20, 10], rng);   // 3–6 節車廂
        const start = (stop + 1 + (rng() * 24 | 0)) % 24;
        const seq = []; for (let j = 0; seq.length < len && j < 24; j++) { const i = (start + j) % 24; if (!LAMPS[i].sp && LAMPS[i].k !== 7) seq.push(i); }   // 超夢不坐火車
        r.lamps = seq;
      } else if (ev.id === 'rain') r.lamps = sendLamps(4 + (rng() * 3 | 0), rng);
      else if (ev.id === 'four') r.lamps = PAYING.filter(i => LAMPS[i].k === 0 && !LAMPS[i].s);
      else if (ev.id === 'small3') r.lamps = [2, 3, 4].map(k => PAYING.find(i => LAMPS[i].k === k && !LAMPS[i].s));
      else if (ev.id === 'big3') r.lamps = [5, 6, 7].map(k => PAYING.find(i => LAMPS[i].k === k && !LAMPS[i].s));
      else if (ev.id === 'corner') r.lamps = CORNERS.slice();
      else if (ev.id === 'jp') { r.jp = st.jp; st.jp = JP_SEED; r.lamps = [0]; }
    }
    r.pay = r.lamps.reduce((a, i) => a + lampPay(i, bets), 0) * mult + r.jp;
    return r;
  }

  const api = { KEYS, LAMPS, CORNERS, W, SP_P, KEY_P, build, BALL_N, SNOR_NEED, SNOR_GIFT, EVO_MAX, LUCKY, JP_RATE, JP_SEED, SMALL, play, lampPay, sendLamps, allBet };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.CORE = api;
})(typeof window !== 'undefined' ? window : globalThis);
