'use strict';
// 寶可夢小瑪莉：畫面、演出、操作。機率在 core.js。
const { KEYS, LAMPS } = CORE;
const $ = id => document.getElementById(id);
const rnd = Math.random;
const sum = a => a.reduce((x, y) => x + y, 0);
const fmt = n => Math.floor(n).toLocaleString('zh-TW');
const SAVE_KEY = 'pk_mary_v1', START_CREDIT = 1000, COIN = 100, MAX_BET = 99, MAX_WIN = 9999999;

// ---------- 影片 ----------
const IDLE = ['01_idle', '15_idle_bulbasaur', '16_idle_pikachu', '17_idle_charizard_day', '18_idle_squirtle', '19_idle_eevee', '20_idle_snorlax', '73_idle_charmander', '74_idle_meowth', '75_idle_gengar'];
const WIN_CLIP = ['33_win_pikachu', '34_win_eevee', '30_win_bulbasaur', '31_win_charmander', '32_win_squirtle', '36_cap_meowth', '37_cap_gengar', '38_cap_mewtwo'];
const EVENT_CLIP = { train: '63_group_caterpie', rain: '10_zenkaiten', four: '56_chain_ride', small3: '56_chain_ride', big3: '56_chain_ride', corner: '56_chain_ride', jp: '11_jackpot', fly: '58_chain_hooh' };
const STREAK_CLIP = { 3: '68_round_dance', 5: '69_round_fly', 10: '65_premium_shiny' };
const clipSrc = n => `assets/clips/${n}.mp4`;

// ---------- 存檔 ----------
const STATS0 = () => ({ games: 0, freeGames: 0, coins: START_CREDIT, bet: 0, won: 0, wins: 0, maxWin: 0, streak: 0, maxStreak: 0,
  dbl: 0, dblWin: 0, dblLose: 0, dblPush: 0, dblRun: 0, dblBestRun: 0, lampHit: Array(24).fill(0), keyWin: Array(8).fill(0), events: {},
  jp: 0, jpBest: 0, wakes: 0, evoMax: 1, balls: 0, dex: {}, allBet: 0, playSec: 0, mewtwoBig: 0 });
function loadSave() {
  try {
    if (location.search.includes('reset')) localStorage.removeItem(SAVE_KEY);
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s && s.stats) { s.stats = Object.assign(STATS0(), s.stats); return s; }
  } catch (e) {}
  return { credit: START_CREDIT, win: 0, jp: CORE.JP_SEED, snor: 0, lastBets: Array(8).fill(0), stats: STATS0(), ach: {}, hist: [], mute: false, fast: false };
}
const S = loadSave();
if (S.pending) { S.win += S.pending; S.stats.won += S.pending; S.pending = 0; }   // 上次跑燈中離開：補發獎金
// 還沒開始的押分存成退回總分；跑燈中的押分已經扣掉
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...S, credit: S.credit + (st.busy ? 0 : sum(st.bets)) })); } catch (e) {} }

// 執行中狀態
const st = { bets: Array(8).fill(0), busy: false, auto: false, pos: 0, trail: [], dbl: null, cards: [], parts: [], runner: null, train: null, t: 0 };

// ---------- 音效 ----------
let AC = null, master = null;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination); } catch (e) { AC = null; }
}
function tone(f, dur, type = 'square', vol = 0.2, f2 = null, delay = 0) {
  if (!AC || S.mute) return;
  const t0 = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
let noiseBuf = null;
function noise(dur, vol = 0.2, hp = 800, delay = 0) {
  if (!AC || S.mute) return;
  if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
  const t0 = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + 0.02);
}
const NOTE = [523, 587, 659, 698, 784, 880, 988, 1047, 1175, 1319, 1397, 1568];
const SFX = {
  coin() { tone(1319, 0.08, 'square', 0.12); tone(1976, 0.25, 'square', 0.12, null, 0.07); },
  bet(k) { tone(NOTE[k] * 1.5, 0.05, 'square', 0.09); },
  clear() { tone(400, 0.12, 'triangle', 0.12, 200); },
  step(speed) { tone(1200 + speed * 900, 0.03, 'square', 0.06); },
  stop() { tone(196, 0.1, 'square', 0.16, 98); noise(0.06, 0.1, 1500); },
  small() { [784, 988, 1175].forEach((f, i) => tone(f, 0.12, 'square', 0.1, null, i * 0.07)); },
  win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => { tone(f, 0.16, 'square', 0.12, null, i * 0.09); tone(f / 2, 0.16, 'triangle', 0.1, null, i * 0.09); }); },
  big() { [523, 659, 784, 1047, 1319, 1047, 1319, 1568, 2093].forEach((f, i) => { tone(f, 0.2, 'square', 0.13, null, i * 0.1); tone(f / 2, 0.2, 'sawtooth', 0.06, null, i * 0.1); }); },
  miss() { tone(330, 0.15, 'triangle', 0.08, 220); },
  tally() { tone(2093, 0.03, 'square', 0.05); },
  lucky() { for (let i = 0; i < 6; i++) { tone(880, 0.12, 'sawtooth', 0.1, 1760, i * 0.16); tone(660, 0.12, 'square', 0.06, 1320, i * 0.16 + 0.08); } },
  train() { for (let i = 0; i < 6; i++) noise(0.08, 0.12, 300, i * 0.18); tone(880, 0.35, 'square', 0.1, 860, 0); tone(1100, 0.35, 'square', 0.08, 1080, 0.02); },
  send() { tone(600, 0.25, 'triangle', 0.12, 2400); },
  ball() { tone(300, 0.18, 'square', 0.12, 900); noise(0.15, 0.1, 2500, 0.2); tone(1568, 0.1, 'square', 0.1, null, 0.4); },
  evo() { for (let i = 0; i < 12; i++) tone(400 + i * 120, 0.1, 'triangle', 0.1, null, i * 0.06); tone(1568, 0.5, 'square', 0.12, 2093, 0.75); },
  snore() { tone(90, 0.6, 'sine', 0.25, 70); tone(110, 0.5, 'triangle', 0.06, 80, 0.1); },
  wake() { tone(120, 0.3, 'sawtooth', 0.2, 240); tone(240, 0.4, 'square', 0.12, 480, 0.25); },
  jp() { for (let k = 0; k < 3; k++) SFX.big(); noise(1.2, 0.2, 300); },
  dblTick() { tone(1500, 0.025, 'square', 0.07); },
  dblWin() { [784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.15, 'square', 0.12, null, i * 0.08)); },
  dblLose() { tone(392, 0.2, 'square', 0.12, 196); tone(196, 0.35, 'square', 0.12, 98, 0.18); },
  streak() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.1, 'square', 0.1, null, i * 0.05)); },
  ach() { tone(1047, 0.1, 'square', 0.1); tone(1568, 0.25, 'square', 0.1, null, 0.08); },
};

// ---------- 等待（快速模式會縮短）----------
const speedK = () => S.fast ? 0.55 : 1;
const sleep = ms => new Promise(r => setTimeout(r, ms * speedK()));

// ---------- 建畫面 ----------
const board = $('board'), lampEl = [];
const GRID = [];   // 燈號 → [row, col]
for (let c = 0; c < 7; c++) GRID.push([0, c]);
for (let r = 1; r < 6; r++) GRID.push([r, 6]);
for (let c = 6; c >= 0; c--) GRID.push([6, c]);
for (let r = 5; r >= 1; r--) GRID.push([r, 0]);
const SP_INFO = { ball: { spr: 'ball', txt: '收服' }, evo: { spr: 'stone', txt: '進化' }, lucky: { spr: 'zard', txt: '傳說' }, snor: { img: 6, txt: 'Zz…' } };
function sprURL(name, P = 6) {
  const rows = SPR[name][0], c = document.createElement('canvas');
  c.width = rows[0].length * P; c.height = rows.length * P; const x = c.getContext('2d');
  rows.forEach((row, r) => [...row].forEach((ch, i) => { if (ch !== '.') { x.fillStyle = PX[ch]; x.fillRect(i * P, r * P, P, P); } }));
  return c.toDataURL();
}
LAMPS.forEach((L, i) => {
  const d = document.createElement('div'); d.className = 'lamp'; d.dataset.i = i;
  d.style.gridRow = GRID[i][0] + 1; d.style.gridColumn = GRID[i][1] + 1;
  if (CORE.CORNERS.includes(i)) d.classList.add('corner');
  const img = document.createElement('img'); img.alt = '';
  if (L.sp) {
    const info = SP_INFO[L.sp]; d.classList.add('sp-' + L.sp);
    img.src = info.img ? `assets/sym/s${info.img}.webp` : sprURL(info.spr); img.style.imageRendering = info.img ? '' : 'pixelated';
    img.style.width = img.style.height = '58%'; img.style.transform = 'translateY(-10%)';
    d.append(img); d.insertAdjacentHTML('beforeend', `<i class="bulb"></i><b class="sptxt">${info.txt}</b>`);
  } else {
    img.src = `assets/sym/s${KEYS[L.k].img}.webp`;
    if (L.s) d.classList.add('small');
    d.append(img);
    d.insertAdjacentHTML('beforeend', `<i class="bulb"></i><b class="mul${L.m >= 50 ? ' big' : ''}">${L.s ? '小' : ''}×${L.m}</b>`);
  }
  board.append(d); lampEl.push(d);
});
const keyEl = KEYS.map((K, k) => {
  const b = document.createElement('button'); b.className = 'key'; b.title = `${K.name} ×${K.mult}（按 ${k + 1}）`;
  b.innerHTML = `<span class="bet">00</span><img src="assets/sym/s${K.img}.webp" alt=""><span class="nm">${K.name}</span><span class="x">×${K.mult}</span>`;
  $('keys').append(b);
  let hold = null, rep = null;
  const down = e => { e.preventDefault(); addBet(k); hold = setTimeout(() => { rep = setInterval(() => addBet(k), 70); }, 380); };
  const up = () => { clearTimeout(hold); clearInterval(rep); hold = rep = null; };
  b.addEventListener('pointerdown', down); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, up));
  b.addEventListener('contextmenu', e => e.preventDefault());
  return b;
});
for (let i = 0; i < 22; i++) $('bulbs').append(document.createElement('i'));
for (let i = 0; i < CORE.SNOR_NEED; i++) $('snorBar').append(document.createElement('i'));

// 說明：倍率表、傳說表
$('payTable').innerHTML = '<tr><th>押注鍵</th><th>大燈</th><th>小燈</th><th>盞數</th></tr>' + KEYS.map((K, k) => {
  const n = LAMPS.filter(l => !l.sp && l.k === k && !l.s).length, sm = LAMPS.find(l => !l.sp && l.k === k && l.s);
  return `<tr><td><img src="assets/sym/s${K.img}.webp" alt=""> ${K.name}</td><td>×${K.mult}</td><td>×${sm.m}</td><td>${n}</td></tr>`;
}).join('');
const LUCKY_DESC = { train: '連續 3–6 盞燈全賠（超夢不上車）', rain: '隨機 4–6 盞燈', four: '4 盞皮卡丘大燈', small3: '妙蛙種子、小火龍、傑尼龜', big3: '喵喵、耿鬼、超夢', corner: '四個角落的燈', jp: '全押才有：拿走彩金池', fly: '什麼都沒有…' };
const luckTot = sum(CORE.LUCKY.map(e => e.w));
$('luckyTable').innerHTML = CORE.LUCKY.map(e => `<tr><td><b>${e.name}</b></td><td>${LUCKY_DESC[e.id]}</td><td>${(e.w / luckTot * 100).toFixed(e.w < 1 ? 1 : 0)}%</td></tr>`).join('');

// ---------- 燈 ----------
function lightRun(i) {
  st.trail.unshift(i); if (st.trail.length > 3) st.trail.length = 3;
  for (const el of lampEl) el.classList.remove('on', 't1', 't2');
  st.trail.forEach((j, n) => lampEl[j].classList.add(['on', 't1', 't2'][n]));
}
function clearLamps() { st.trail = []; for (const el of lampEl) { el.classList.remove('on', 't1', 't2', 'hit', 'paid'); el.querySelector('.plus')?.remove(); } }
function markHit(i, pay) {
  const el = lampEl[i]; el.classList.add('hit'); if (pay > 0) el.classList.add('paid');
  el.querySelector('.plus')?.remove();
  if (pay > 0) el.insertAdjacentHTML('beforeend', `<b class="plus">+${fmt(pay)}</b>`);
}
// 跑到目標燈：先加速、高速跑 laps 圈、最後減速停格
async function runTo(target, short = false) {
  const n = 24, d = (target - st.pos + n) % n;
  const laps = short ? 1 : 2 + (rnd() * 2 | 0), total = laps * n + d + (short && d < 6 ? n : 0);
  st.runner = { t0: st.t };
  for (let s = 1; s <= total; s++) {
    st.pos = (st.pos + 1) % n; lightRun(st.pos);
    const left = total - s;
    let ms = short ? 24 : 30;
    if (!short && s < 9) ms = 150 - s * 13;
    if (left < 13) ms = 30 + (13 - left) ** 2 * (short ? 1.1 : 1.7);
    SFX.step(Math.min(1, 40 / ms));
    await sleep(ms);
  }
  st.runner = null;
  lampEl.forEach(el => el.classList.remove('t1', 't2'));
  SFX.stop();
}

// ---------- 中央螢幕：影片 ----------
const vid = $('vid');
let vidLock = false;   // 事件影片播放中，不換成待機
function playClip(name, lock = true) {
  vidLock = lock; vid.src = clipSrc(name); vid.currentTime = 0;
  const p = vid.play(); if (p) p.catch(() => {});
}
function idleClip() { let n; do n = IDLE[rnd() * IDLE.length | 0]; while (IDLE.length > 1 && vid.src.endsWith(n + '.mp4')); playClip(n, false); }
vid.addEventListener('ended', idleClip);
vid.addEventListener('error', () => setTimeout(idleClip, 800));

// ---------- 中央螢幕：特效畫布 ----------
const fx = $('fx'), ctx = fx.getContext('2d');
let FW = 300, FH = 300;
function fitFx() { const r = fx.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); FW = r.width; FH = r.height; fx.width = FW * dpr; fx.height = FH * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
new ResizeObserver(fitFx).observe(fx);
function card(text, sub = '', col = '#ffe14a', ms = 1500, size = 1) { st.cards.push({ text, sub, col, t0: st.t, dur: ms / 1000 * speedK(), size }); }
function burst(n, cols, x = FW / 2, y = FH / 2) {
  for (let i = 0; i < n; i++) { const a = rnd() * 6.283, s = 80 + rnd() * 320; st.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 1 + rnd(), col: cols[i % cols.length], r: 2 + rnd() * 3.5 }); }
}
function pix(name, frame, x, y, P, flip = false) {
  const fr = SPR[name], rows = fr[frame % fr.length], w = rows[0].length;
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < w; c++) {
    const ch = rows[r][flip ? w - 1 - c : c]; if (ch === '.') continue;
    ctx.fillStyle = PX[ch]; ctx.fillRect(Math.round(x + c * P), Math.round(y + r * P), P + 0.5, P + 0.5);
  }
}
function drawFx() {
  ctx.clearRect(0, 0, FW, FH);
  const t = st.t, P = Math.max(2, Math.round(FW / 110));
  // 跑燈時：皮卡丘在螢幕底下跑
  if (st.runner) {
    const x = ((t - st.runner.t0) * FW * 0.55) % (FW + 80) - 60;
    ctx.fillStyle = '#0007'; ctx.fillRect(0, FH - P * 12, FW, P * 12);
    pix('pika', (t * 10 | 0), x, FH - P * 11, P);
    pix('ball', 0, x - P * 12, FH - P * 8, P * 0.8);
  }
  // 開火車：皮卡丘拉著車廂
  if (st.train) {
    const tr = st.train, x = (t - tr.t0) * FW * 0.5 - 40;
    ctx.fillStyle = '#0008'; ctx.fillRect(0, FH - P * 13, FW, P * 13);
    pix('pika', (t * 12 | 0), x, FH - P * 11, P, true);
    for (let i = 0; i < tr.n; i++) {
      const cx = x - (i + 1) * P * 13, cy = FH - P * 10;
      ctx.fillStyle = ['#ff3a4c', '#3a8bff', '#2fe06a', '#ffc61a', '#c86bff', '#ff8a2a'][i % 6];
      ctx.fillRect(cx, cy, P * 11, P * 7); ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(cx + P * 2.5, cy + P * 7.5, P * 1.6, 0, 7); ctx.arc(cx + P * 8.5, cy + P * 7.5, P * 1.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `900 ${P * 4}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(i + 1, cx + P * 5.5, cy + P * 5);
    }
    if (rnd() < 0.3) st.parts.push({ x: x + P * 6, y: FH - P * 12, vx: -40 - rnd() * 40, vy: -60 - rnd() * 40, life: 0.8, col: '#ddd', r: 3 + rnd() * 3 });
  }
  // 卡比獸打呼
  if (st.snore && t - st.snore.t0 < 1.6) {
    const a = t - st.snore.t0;
    ctx.fillStyle = '#0008'; ctx.fillRect(0, FH * 0.3, FW, FH * 0.4);
    pix('snor', 0, FW / 2 - P * 9, FH / 2 - P * 6, P * 1.5);
    ctx.fillStyle = '#9fd8ff'; ctx.font = `900 ${P * 6}px system-ui`; ctx.textAlign = 'left';
    for (let i = 0; i < 3; i++) { const k = (a * 1.5 + i * 0.33) % 1; ctx.globalAlpha = 1 - k; ctx.fillText('Z', FW / 2 + P * 9 + k * P * 10, FH / 2 - P * 4 - k * P * 14); }
    ctx.globalAlpha = 1;
  }
  // 比大小數字
  if (st.dbl) {
    const d = st.dbl;
    ctx.fillStyle = '#000c'; ctx.fillRect(0, 0, FW, FH);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${FH * 0.08}px system-ui`; ctx.fillStyle = '#fff';
    ctx.fillText(`你猜「${d.big ? '大' : '小'}」　1–6 小・7 平手・8–13 大`, FW / 2, FH * 0.16);
    const big = d.n >= 8, col = d.n === 7 ? '#fff' : big ? '#ff6a5a' : '#5ab0ff';
    ctx.font = `900 ${FH * 0.42}px "Courier New", monospace`; ctx.fillStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = 24; ctx.fillText(d.n, FW / 2, FH * 0.52); ctx.shadowBlur = 0;
    if (d.res) {
      const k = Math.min(1, (t - d.res.t0) * 4);
      pix(d.res.win ? 'pika' : 'snor', (t * 6 | 0), FW / 2 - P * 9, FH * 0.72 + (1 - k) * 20, P * 1.5);
    }
  }
  // 粒子
  const dt = 1 / 60;
  for (let i = st.parts.length - 1; i >= 0; i--) {
    const p = st.parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.life -= dt;
    if (p.life <= 0) { st.parts.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, p.life); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, p.r, p.r);
  }
  ctx.globalAlpha = 1;
  // 字卡
  st.cards = st.cards.filter(c => t - c.t0 < c.dur);
  st.cards.forEach((c, i) => {
    const a = (t - c.t0) / c.dur, sc = a < 0.12 ? 0.4 + a / 0.12 * 0.75 : a < 0.2 ? 1.15 - (a - 0.12) / 0.08 * 0.15 : 1;
    const alpha = a > 0.85 ? (1 - a) / 0.15 : 1, y = FH * (0.42 + i * 0.2);
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(FW / 2, y); ctx.scale(sc, sc);
    ctx.fillStyle = '#000b'; const bh = FH * (c.sub ? 0.27 : 0.19) * c.size;
    ctx.fillRect(-FW / 2, -bh * 0.55, FW, bh);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = FH * 0.13 * c.size; ctx.font = `900 ${fs}px "PingFang TC", "Noto Sans TC", system-ui`;
    while (ctx.measureText(c.text).width > FW * 0.94 && fs > 10) { fs -= 2; ctx.font = `900 ${fs}px "PingFang TC", "Noto Sans TC", system-ui`; }
    ctx.lineWidth = fs * 0.16; ctx.strokeStyle = '#000'; ctx.strokeText(c.text, 0, c.sub ? -fs * 0.25 : 0);
    const g = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2); g.addColorStop(0, '#fff'); g.addColorStop(0.5, c.col); g.addColorStop(1, c.col);
    ctx.fillStyle = g; ctx.fillText(c.text, 0, c.sub ? -fs * 0.25 : 0);
    if (c.sub) { ctx.font = `700 ${fs * 0.42}px "PingFang TC", "Noto Sans TC", system-ui`; ctx.fillStyle = '#fff'; ctx.fillText(c.sub, 0, fs * 0.62); }
    ctx.restore();
  });
}
// 機台頂端的跑馬燈泡
function drawBulbs() {
  const bs = $('bulbs').children, n = bs.length, t = st.t;
  const mode = st.busy ? 2 : S.win > 0 ? 1 : 0;
  for (let i = 0; i < n; i++) {
    const on = mode === 2 ? ((i + (t * 14 | 0)) % 3 === 0) : mode === 1 ? ((t * 4 | 0) % 2 === i % 2) : ((i + (t * 3 | 0)) % 6 === 0);
    bs[i].classList.toggle('on', on);
  }
}
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; st.t += dt;
  if (!document.hidden) S.stats.playSec += dt;
  drawFx(); drawBulbs();
  requestAnimationFrame(frame);
}

// ---------- 介面更新 ----------
function msg(t) { $('msg').textContent = t; }
function renderLED() {
  $('ledJp').textContent = fmt(S.jp); $('ledWin').textContent = fmt(S.win); $('ledCredit').textContent = fmt(S.credit);
}
function renderBets() {
  const showLast = sum(st.bets) === 0;
  keyEl.forEach((b, k) => {
    const v = showLast ? S.lastBets[k] : st.bets[k], el = b.querySelector('.bet');
    el.textContent = String(v).padStart(2, '0'); el.classList.toggle('last', showLast);
  });
}
function renderCtrl() {
  const busy = st.busy, w = S.win > 0;
  $('bSmall').disabled = $('bBig').disabled = busy || !w || st.auto;
  $('bTake').disabled = busy || !w;
  $('bStart').disabled = busy || st.auto;
  $('bClear').disabled = busy || sum(st.bets) === 0;
  $('bAll').disabled = busy;
  $('bStart').classList.toggle('ready', !busy && !st.auto && (sum(st.bets) > 0 || w));
  $('bStart').querySelector('small').textContent = w ? '收分＋開始' : sum(st.bets) > 0 ? `押 ${sum(st.bets)} 分` : sum(S.lastBets) > 0 ? `續押 ${sum(S.lastBets)} 分` : '先押分';
  $('bAuto').classList.toggle('on', st.auto);
  $('bSound').textContent = S.mute ? '🔇 靜音' : '🔊 音效';
  $('bFast').textContent = S.fast ? '🐇 快速' : '🐢 一般速度';
  [...$('snorBar').children].forEach((el, i) => el.classList.toggle('on', i < S.snor));
  $('hudStreak').textContent = S.stats.streak >= 2 ? `🔥 連勝 ${S.stats.streak}` : '';
  $('hudStreak').style.display = S.stats.streak >= 2 ? '' : 'none';
}
function renderAll() { renderLED(); renderBets(); renderCtrl(); renderPanel(); }

// ---------- 押分與分數 ----------
function addBet(k) {
  if (st.busy) return;
  initAudio();
  if (S.win > 0) collect(true);
  if (st.bets[k] >= MAX_BET) { msg(`${KEYS[k].name}已經押滿 ${MAX_BET} 分`); return; }
  if (S.credit < 1) { msg('分數不夠了，按「投幣」加分'); return; }
  st.bets[k]++; S.credit--; SFX.bet(k);
  keyEl[k].classList.add('press'); setTimeout(() => keyEl[k].classList.remove('press'), 80);
  msg(''); renderLED(); renderBets(); renderCtrl();
}
function betAll() {
  if (st.busy) return; initAudio();
  if (S.win > 0) collect(true);
  const can = st.bets.filter(b => b < MAX_BET).length;
  if (S.credit < can) { msg('分數不夠全押，按「投幣」加分'); return; }
  st.bets = st.bets.map(b => Math.min(MAX_BET, b + 1)); S.credit -= can; SFX.bet(7);
  renderLED(); renderBets(); renderCtrl();
}
function clearBets() {
  if (st.busy) return;
  S.credit += sum(st.bets); st.bets = Array(8).fill(0); SFX.clear(); renderAll(); persist();
}
function insertCoin() {
  initAudio(); S.credit += COIN; S.stats.coins += COIN; SFX.coin(); msg(`投幣 ${COIN} 分`);
  renderLED(); renderPanel(); persist();
}
function collect(quiet = false) {
  if (S.win <= 0) return;
  S.credit += S.win; S.win = 0; S.stats.dblRun = 0;
  if (!quiet) SFX.coin();
  $('ledWinBox').classList.remove('flash');
  renderAll(); persist();
}

// ---------- 一局 ----------
async function start() {
  if (st.busy) return;
  initAudio();
  if (S.win > 0) collect(true);
  if (sum(st.bets) === 0) {
    const need = sum(S.lastBets);
    if (need > 0 && S.credit >= need) { st.bets = S.lastBets.slice(); S.credit -= need; }
    else if (need > 0) { msg('分數不夠續押，按「投幣」加分'); stopAuto(); return; }
    else { msg('先按下面的寶可夢押分'); stopAuto(); return; }
  }
  st.busy = true; msg(''); clearLamps(); renderAll();
  const bets = st.bets.slice(), B = sum(bets);
  S.lastBets = bets.slice(); S.stats.games++; S.stats.bet += B; S.jp += B * CORE.JP_RATE;
  if (bets.every(b => b > 0)) S.stats.allBet++;
  // 結果在跑燈前就全部決定好並存檔：跑到一半重新整理，獎金照樣入帳、押分也不會退回
  const rounds = []; let r, mult = 1;
  do { r = CORE.play(bets, S, rnd, mult); rounds.push(r); mult++; } while (r.evo);
  let total = Math.min(MAX_WIN, Math.floor(sum(rounds.map(x => x.pay))));
  S.pending = total; persist();
  renderLED();
  let bestKey = -1, bestPay = 0, event = null;
  for (const r of rounds) {
    await runTo(r.stop);
    const res = await present(r, bets);
    if (res.bestPay > bestPay) { bestPay = res.bestPay; bestKey = res.bestKey; }
    if (r.event) event = r.event;
    if (r.evo) { S.stats.freeGames++; S.stats.evoMax = Math.max(S.stats.evoMax, r.mult + 1); await evoShow(r.mult + 1); clearLamps(); }
  }
  const firstStop = rounds[0].stop;
  st.bets = Array(8).fill(0);
  S.pending = 0; S.win = total; S.stats.won += total;
  S.hist.unshift({ i: firstStop, p: total, e: event }); S.hist.length = Math.min(S.hist.length, 20);
  if (total > 0) {
    S.stats.wins++; S.stats.streak++; S.stats.maxStreak = Math.max(S.stats.maxStreak, S.stats.streak);
    if (total > S.stats.maxWin) S.stats.maxWin = total;
    await winShow(total, B, bestKey, event);
  } else {
    S.stats.streak = 0;
  }
  st.busy = false; checkAch(); renderAll(); persist();
  if (st.auto) { await sleep(total > 0 ? 900 : 450); if (st.auto) { collect(true); start(); } }
}

// 演出一個結果；回傳這段最大的單燈派彩（決定放哪隻的影片）
async function present(r, bets) {
  let bestKey = -1, bestPay = 0;
  const pay = i => CORE.lampPay(i, bets) * r.mult;
  const show = async (i, gap = 0) => {
    const p = pay(i); markHit(i, p); S.stats.lampHit[i]++;
    const L = LAMPS[i];
    if (p > 0) {
      S.stats.keyWin[L.k]++; S.stats.dex[L.k] = (S.stats.dex[L.k] || 0) + 1;
      if (L.k === 7 && !L.s) S.stats.mewtwoBig++;
      keyEl[L.k].classList.remove('won'); void keyEl[L.k].offsetWidth; keyEl[L.k].classList.add('won');
      if (p > bestPay) { bestPay = p; bestKey = L.k; }
      SFX.small();
    }
    if (gap) await sleep(gap);
  };
  const send = async (list, gap = 250) => { for (const i of list) { SFX.send(); await runTo(i, true); await show(i, gap); } };
  if (r.type === 'pay') {
    await show(r.stop);
    if (pay(r.stop) === 0) { SFX.miss(); }
  } else if (r.type === 'ball') {
    S.stats.lampHit[r.stop]++; S.stats.balls++; markHit(r.stop, 0);
    SFX.ball(); card('收服！', `送燈 ${r.lamps.length} 盞`, '#ff6b6b', 1300);
    burst(30, ['#ff3a4c', '#fff', '#111']); await sleep(1000);
    await send(r.lamps);
  } else if (r.type === 'snor') {
    S.stats.lampHit[r.stop]++; markHit(r.stop, 0);
    renderCtrl();
    if (r.wake) {
      S.stats.wakes++; SFX.wake(); playClip('20_idle_snorlax');
      card('卡比獸醒來了！', `送 ${r.lamps.length} 盞燈`, '#6fc3ff', 1600); burst(40, ['#6fc3ff', '#ffe3a8', '#fff']);
      await sleep(1300); await send(r.lamps);
    } else {
      SFX.snore(); st.snore = { t0: st.t };
      msg(`卡比獸睡著了… 鬧鐘 ${S.snor}/${CORE.SNOR_NEED}`); await sleep(500);
    }
  } else if (r.type === 'evo') {
    S.stats.lampHit[r.stop]++; markHit(r.stop, 0);
    if (!r.evo) { card('最終進化！', `已經 ×${r.mult}，改送 2 盞燈`, '#7dff9a', 1400); await sleep(1000); await send(r.lamps); }
  } else if (r.type === 'lucky') {
    S.stats.lampHit[r.stop]++; markHit(r.stop, 0);
    S.stats.events[r.event] = (S.stats.events[r.event] || 0) + 1;
    const ev = CORE.LUCKY.find(e => e.id === r.event);
    SFX.lucky(); playClip('03_cutin'); card('傳說燈！', '', '#ff9ad0', 1100); await sleep(1300);
    playClip(EVENT_CLIP[r.event]);
    if (r.event === 'train') {
      card(ev.name, `${r.lamps.length} 節車廂`, '#ffe14a', 1600); SFX.train();
      st.train = { t0: st.t, n: r.lamps.length };
      await sleep(600);
      // 車頭先跑到第一節，再一節一節亮
      await runTo(r.lamps[0], true);
      for (const i of r.lamps) { lightRun(i); await show(i, 0); tone(700, 0.08, 'square', 0.1); await sleep(220); }
      st.train = null;
    } else if (r.event === 'rain') {
      card(ev.name, `${r.lamps.length} 盞燈`, '#9fd8ff', 1500); await sleep(600);
      for (const i of r.lamps) { burst(12, ['#fff', '#9fd8ff', '#ffe14a']); await show(i, 260); tone(1800 + rnd() * 600, 0.15, 'triangle', 0.1, 600); }
    } else if (r.event === 'fly') {
      card(ev.name, '下次再來…', '#ff9a3a', 1800); SFX.miss(); await sleep(1400);
    } else if (r.event === 'jp') {
      card('超夢覺醒', `JACKPOT ${fmt(r.jp)} 分！`, '#e07bff', 3200, 1.15); SFX.jp();
      S.stats.jp++; S.stats.jpBest = Math.max(S.stats.jpBest, r.jp);
      for (let k = 0; k < 6; k++) { burst(50, ['#e07bff', '#ffe14a', '#fff', '#5dff7a']); await sleep(300); }
      for (const i of r.lamps) await show(i, 0);
      renderLED();
    } else {
      card(ev.name, LUCKY_DESC[r.event], '#ffe14a', 1700); await sleep(700);
      for (const i of r.lamps) await show(i, 0);
      for (let k = 0; k < 3; k++) { lampEl.forEach(el => el.classList.toggle('on', r.lamps.includes(+el.dataset.i) && k % 2 === 0)); await sleep(200); }
      lampEl.forEach(el => el.classList.remove('on'));
    }
  }
  return { bestKey, bestPay };
}
async function evoShow(mult) {
  SFX.evo(); playClip('66_upgrade_evolve');
  card('進化！', `免費再跑一次　獎金 ×${mult}`, '#7dff9a', 1800); burst(40, ['#7dff9a', '#ffe14a', '#fff']);
  await sleep(1700);
}
async function winShow(total, B, bestKey, event) {
  const ratio = total / B;
  $('ledWinBox').classList.remove('flash'); void $('ledWinBox').offsetWidth; $('ledWinBox').classList.add('flash');
  // 得分數字往上跳
  const steps = Math.min(24, Math.ceil(total / 5)), shownTarget = total;
  for (let s = 1; s <= steps; s++) { S.win = Math.round(shownTarget * s / steps); renderLED(); SFX.tally(); await sleep(22); }
  S.win = shownTarget; renderLED();
  if (ratio >= 20) { SFX.big(); card('大獎！', `${fmt(total)} 分`, '#ffe14a', 2400, 1.1); burst(80, ['#ffe14a', '#ff6a5a', '#5dff7a', '#fff']); }
  else if (ratio >= 5) { SFX.win(); card('中獎！', `${fmt(total)} 分`, '#5dff7a', 1700); burst(40, ['#5dff7a', '#ffe14a', '#fff']); }
  else if (ratio >= 1) SFX.win(); else SFX.small();
  if (!event && bestKey >= 0 && ratio >= 5) playClip(WIN_CLIP[bestKey]);
  const s = S.stats.streak;
  if (STREAK_CLIP[s] || (s > 10 && s % 5 === 0)) {
    await sleep(500); SFX.streak();
    card(s >= 10 ? '超級連勝！' : '連續中獎！', `${s} 連勝`, '#ff9a3a', 1800);
    if (STREAK_CLIP[s] && ratio < 5 && !event) playClip(STREAK_CLIP[s]);
  }
  msg(`得分 ${fmt(total)}：按「收分」入帳，或按「大／小」比大小翻倍`);
}

// ---------- 比大小 ----------
async function double(big) {
  if (st.busy || S.win <= 0 || st.auto) return;
  if (S.win * 2 > MAX_WIN) { msg('得分已經到上限，請收分'); return; }
  initAudio(); st.busy = true; renderCtrl();
  // 先決定結果並存檔（畫面晚一點才揭曉），避免看到快輸了就重新整理
  const n = 1 + (rnd() * 13 | 0), before = S.win, outcome = n === 7 ? 'push' : (n >= 8) === big ? 'win' : 'lose';
  S.stats.dbl++;
  if (outcome === 'push') S.stats.dblPush++;
  else if (outcome === 'win') {
    S.win = before * 2; S.stats.won += before; S.stats.dblWin++; S.stats.dblRun++;
    S.stats.dblBestRun = Math.max(S.stats.dblBestRun, S.stats.dblRun); S.stats.maxWin = Math.max(S.stats.maxWin, S.win);
  } else { S.win = 0; S.stats.won -= before; S.stats.dblLose++; S.stats.dblRun = 0; S.stats.streak = 0; }
  persist();
  st.dbl = { big, n: 1, res: null };
  for (let s = 0; s < 22; s++) { st.dbl.n = 1 + (rnd() * 13 | 0); SFX.dblTick(); await sleep(40 + s * s * 0.35); }
  st.dbl.n = n; SFX.stop();
  if (outcome === 'push') { card('平手', '分數不變', '#fff', 1200); msg('開出 7，平手！可以再比或收分'); }
  else if (outcome === 'win') {
    st.dbl.res = { win: true, t0: st.t }; SFX.dblWin(); card('猜中了！', `得分翻倍 ${fmt(S.win)}`, '#5dff7a', 1400); burst(40, ['#5dff7a', '#ffe14a']);
    msg(`猜中！得分 ${fmt(S.win)}，要再比還是收分？`);
  } else {
    st.dbl.res = { win: false, t0: st.t }; SFX.dblLose(); card('猜錯了…', '卡比獸把分數吃掉了', '#ff7a7a', 1500);
    msg('猜錯了，得分歸零');
  }
  renderLED(); await sleep(1300); st.dbl = null;
  st.busy = false; checkAch(); renderAll(); persist();
}

// ---------- 成就 ----------
const ACH = [
  ['first', '第一次中獎', '贏到任何分數', () => S.stats.wins >= 1],
  ['streak3', '三連勝', '連續中獎 3 局', () => S.stats.maxStreak >= 3],
  ['streak10', '停不下來', '連續中獎 10 局', () => S.stats.maxStreak >= 10],
  ['dex', '圖鑑完成', '8 種寶可夢都中過', () => KEYS.every((_, k) => S.stats.dex[k] > 0)],
  ['ball', '收服高手', '精靈球送燈 20 次', () => S.stats.balls >= 20],
  ['train', '皮卡丘開火車', '開出火車', () => S.stats.events.train > 0],
  ['four', '大四喜', '4 隻皮卡丘全亮', () => S.stats.events.four > 0],
  ['small3', '小三元', '御三家同時亮', () => S.stats.events.small3 > 0],
  ['big3', '大三元', '喵喵、耿鬼、超夢同時亮', () => S.stats.events.big3 > 0],
  ['corner', '縱橫四海', '四個角落全亮', () => S.stats.events.corner > 0],
  ['fly', '白高興一場', '鳳王飛走了', () => S.stats.events.fly > 0],
  ['jp', '超夢覺醒', '拿到彩金', () => S.stats.jp > 0],
  ['mewtwo', '超夢 ×100', '押中超夢大燈', () => S.stats.mewtwoBig > 0],
  ['evo4', '最終進化', '進化連發到 ×4', () => S.stats.evoMax >= 4],
  ['wake', '起床囉', '叫醒卡比獸', () => S.stats.wakes > 0],
  ['dbl5', '賭神', '比大小連贏 5 次', () => S.stats.dblBestRun >= 5],
  ['allbet', '全押派', '8 個鍵都押 50 局', () => S.stats.allBet >= 50],
  ['big1000', '一局千分', '一局贏 1,000 分以上', () => S.stats.maxWin >= 1000],
  ['g100', '老顧客', '玩 100 局', () => S.stats.games >= 100],
  ['g1000', '機台主人', '玩 1,000 局', () => S.stats.games >= 1000],
];
function checkAch() {
  for (const [id, name] of ACH) if (!S.ach[id] && ACH.find(a => a[0] === id)[3]()) { S.ach[id] = Date.now(); toast(`🏆 成就解鎖：${name}`); SFX.ach(); }
}
function toast(t) { const d = document.createElement('div'); d.textContent = t; $('toast').append(d); setTimeout(() => d.remove(), 3300); }

// ---------- 左側面板 ----------
const EV_NAME = Object.fromEntries(CORE.LUCKY.map(e => [e.id, e.name]));
function lampName(i) { const L = LAMPS[i]; return L.sp ? SP_INFO[L.sp].txt.replace('…', '') : KEYS[L.k].name + (L.s ? '小' : ''); }
function lampImg(i) { const L = LAMPS[i]; return L.sp ? (L.sp === 'snor' ? 'assets/sym/s6.webp' : lampEl[i].querySelector('img').src) : `assets/sym/s${KEYS[L.k].img}.webp`; }
function renderPanel() {
  const s = S.stats, net = S.credit + S.win + sum(st.bets) - s.coins;
  const min = Math.floor(s.playSec / 60);
  $('stats').innerHTML = [
    ['總局數', `${fmt(s.games)}（免費 ${fmt(s.freeGames)}）`],
    ['投入（投幣＋開機送分）', fmt(s.coins)],
    ['總押分', fmt(s.bet)],
    ['總贏分（含比大小）', fmt(s.won)],
    ['收支', `<span class="${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}${fmt(net)}</span>`],
    ['實際期望值', s.bet ? (s.won / s.bet * 100).toFixed(1) + '%' : '—'],
    ['中獎率', s.games ? (s.wins / s.games * 100).toFixed(1) + '%' : '—'],
    ['最大獎', fmt(s.maxWin)],
    ['連勝（目前／最長）', `${s.streak}／${s.maxStreak}`],
    ['比大小 勝／敗／和', `${s.dblWin}／${s.dblLose}／${s.dblPush}`],
    ['比大小最長連贏', s.dblBestRun],
    ['卡比獸醒來', s.wakes],
    ['進化最高', `×${s.evoMax}`],
    ['彩金（次數／最高）', `${s.jp}／${fmt(s.jpBest)}`],
    ['遊玩時間', `${min} 分鐘`],
  ].map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  $('hist').innerHTML = S.hist.map(h => `<span title="${lampName(h.i)}${h.e ? '・' + EV_NAME[h.e] : ''}"><img src="${lampImg(h.i)}" alt="">${h.p > 0 ? `<b class="w">${fmt(h.p)}</b>` : ''}</span>`).join('') || '<span>還沒開始</span>';
  $('dex').innerHTML = KEYS.map((K, k) => `<div class="${s.dex[k] ? 'got' : ''}"><img src="assets/sym/s${K.img}.webp" alt="">${s.dex[k] || 0}</div>`).join('')
    + `<div class="${s.wakes ? 'got' : ''}"><img src="assets/sym/s6.webp" alt="">${s.wakes}</div>`;
  $('hits').innerHTML = '<tr><th>寶可夢</th><th>大燈</th><th>小燈</th><th>押中</th></tr>' + KEYS.map((K, k) => {
    const big = LAMPS.reduce((a, L, i) => a + (!L.sp && L.k === k && !L.s ? s.lampHit[i] : 0), 0), sm = LAMPS.reduce((a, L, i) => a + (!L.sp && L.k === k && L.s ? s.lampHit[i] : 0), 0);
    return `<tr><td><img src="assets/sym/s${K.img}.webp" alt=""> ${K.name}</td><td>${big}</td><td>${sm}</td><td>${s.keyWin[k]}</td></tr>`;
  }).join('') + ['ball', 'evo', 'lucky', 'snor'].map(sp => { const i = LAMPS.findIndex(L => L.sp === sp); return `<tr><td><img src="${lampImg(i)}" alt="" style="image-rendering:pixelated"> ${SP_INFO[sp].txt.replace('…', '') === 'Zz' ? '卡比獸' : SP_INFO[sp].txt}</td><td colspan="3">${s.lampHit[i]}</td></tr>`; }).join('');
  $('events').innerHTML = CORE.LUCKY.map(e => `<span>${e.name}</span><span>${s.events[e.id] || 0}</span>`).join('');
  const got = ACH.filter(a => S.ach[a[0]]).length;
  $('achN').textContent = `${got}/${ACH.length}`;
  $('ach').innerHTML = ACH.map(([id, n, d]) => `<div class="${S.ach[id] ? 'got' : ''}">${S.ach[id] ? '🏆' : '🔒'} ${n}<small>${d}</small></div>`).join('');
}

// ---------- 自動 ----------
function stopAuto() { st.auto = false; renderCtrl(); }
function toggleAuto() {
  initAudio(); st.auto = !st.auto; renderCtrl();
  if (st.auto) { msg('自動續押中，再按一次停止'); if (!st.busy) { collect(true); start(); } } else msg('自動停止');
}

// ---------- 綁定 ----------
$('bCoin').onclick = insertCoin;
$('bAll').onclick = betAll;
$('bClear').onclick = clearBets;
$('bAuto').onclick = toggleAuto;
$('bSmall').onclick = () => double(false);
$('bBig').onclick = () => double(true);
$('bTake').onclick = () => { collect(); msg('已收分'); };
$('bStart').onclick = start;
$('bSound').onclick = () => { S.mute = !S.mute; initAudio(); renderCtrl(); persist(); };
$('bFast').onclick = () => { S.fast = !S.fast; renderCtrl(); persist(); };
$('btnReset').onclick = () => { if (confirm('確定要清除所有紀錄、成就和分數，重新開始嗎？')) { localStorage.removeItem(SAVE_KEY); location.reload(); } };
$('screen').addEventListener('click', () => { if (vidLock) idleClip(); });
document.addEventListener('keydown', e => {
  if (e.repeat && !/^[1-8]$/.test(e.key)) return;
  const k = e.key.toLowerCase();
  if (/^[1-8]$/.test(k)) addBet(+k - 1);
  else if (k === ' ' || k === 'enter') { e.preventDefault(); start(); }
  else if (k === 'c') insertCoin();
  else if (k === 'a') betAll();
  else if (k === 'z') double(false);
  else if (k === 'x') double(true);
  else if (k === 'q') { collect(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
window.addEventListener('pagehide', persist);

// 開機
st.pos = rnd() * 24 | 0; lightRun(st.pos);
fitFx(); renderAll(); idleClip(); requestAnimationFrame(frame);
msg(S.stats.games ? `歡迎回來！總分 ${fmt(S.credit)}` : '按下面的寶可夢押分，再按「開始」');
if (S.win > 0) $('ledWinBox').classList.add('flash');
