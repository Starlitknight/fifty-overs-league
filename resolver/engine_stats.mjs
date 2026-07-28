// Engine realism probe #1 — baseline distributions on a balanced pitch, sunny.
// Modern (2024-26) ODI benchmarks: 1st-inn par ~265-285, PP rr ~5.0-5.5,
// mid ~5.0-5.5, death ~7-8, ~7 wkts/inn, chase wins ~50-55%.
import { openEngine } from './resolve.mjs';

const N = +(process.argv[2] || 60);
const PITCH = process.argv[3] || 'balanced';
const WX = process.argv[4] || 'Sunny';

const { page, close } = await openEngine();
const out = await page.evaluate(async ({ N, PITCH, WX }) => {
  const home = GD.teams[0], away = GD.teams[1];
  const keeperOf = t => (t.players.find(p => p.keeper) || t.players[0]).name;
  const mkOrd = t => ({ batOrder: [], captain: null, keeper: keeperOf(t), phaseIntent: { pp: 0, mid: 0, death: 1 }, compiled: [] });
  const res = [];
  for (let s = 0; s < N; s++) {
    const r = window.__resolveMatch(home, away, mkOrd(home), mkOrd(away), { pitch: PITCH, weather: WX, ground: home.ground, friendly: true, seed: 90000 + s * 7919 });
    const i1 = r.scorecard[0], i2 = r.scorecard[1];
    // phase splits from the worm (runs per over cumulative or per-over?)
    res.push({
      t1: i1.runs, w1: i1.wkts, ov1: i1.legal / 6,
      t2: i2 ? i2.runs : null, w2: i2 ? i2.wkts : null, ov2: i2 ? i2.legal / 6 : null,
      firstBat: i1.batTeam, winner: r.winner_team, text: r.result_text,
      fow1: i1.fow ? i1.fow.length : 0,
      bat1: i1.batting.map(b => ({ r: b.r, b: b.b, out: b.out })),
      bowl1: i1.bowling.map(b => ({ w: b.w, econ: b.econ, balls: b.balls })),
      worm: r.worm || null,
    });
  }
  return res;
}, { N, PITCH, WX });
await close();

const t1s = out.map(r => r.t1).sort((a, b) => a - b);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const q = (a, p) => a[Math.floor(a.length * p)];
const full1 = out.filter(r => r.ov1 >= 49.9);
const allOut1 = out.filter(r => r.w1 >= 10);
let chaseW = 0, defW = 0, tie = 0;
for (const r of out) {
  if (!r.winner) { tie++; continue; }
  if (r.winner === r.firstBat) defW++; else chaseW++;
}
const hund = out.flatMap(r => r.bat1).filter(b => b.r >= 100).length;
const fifties = out.flatMap(r => r.bat1).filter(b => b.r >= 50 && b.r < 100).length;
const ducks = out.flatMap(r => r.bat1).filter(b => b.r === 0 && b.out !== 'not out').length;
const fiveFors = out.flatMap(r => r.bowl1).filter(b => b.w >= 5).length;

console.log(`pitch=${PITCH} wx=${WX} n=${out.length}`);
console.log(`1st innings: mean ${mean(t1s).toFixed(1)}  p10 ${q(t1s, .1)}  median ${q(t1s, .5)}  p90 ${q(t1s, .9)}  min ${t1s[0]} max ${t1s[t1s.length - 1]}`);
console.log(`1st inn wkts: mean ${mean(out.map(r => r.w1)).toFixed(2)}  all-out ${(100 * allOut1.length / out.length).toFixed(0)}%  batted 50ov ${(100 * full1.length / out.length).toFixed(0)}%`);
console.log(`2nd innings: mean ${mean(out.filter(r => r.t2 != null).map(r => r.t2)).toFixed(1)}`);
console.log(`results: chase wins ${(100 * chaseW / out.length).toFixed(0)}%  defend wins ${(100 * defW / out.length).toFixed(0)}%  no-result/tie ${tie}`);
console.log(`per innings(1st): 100s ${(hund / out.length).toFixed(2)}  50s ${(fifties / out.length).toFixed(2)}  ducks ${(ducks / out.length).toFixed(2)}  5-fors/match ${(fiveFors / out.length).toFixed(2)}`);
// worm-derived phase rates if the worm is per-over cumulative
const w0 = out.find(r => r.worm && r.worm.length);
if (w0) console.log('worm sample keys:', JSON.stringify(w0.worm).slice(0, 200));
