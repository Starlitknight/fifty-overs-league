// Engine realism probe #2 — phase run rates + pitch & weather A/B on fixed seeds.
import { openEngine } from './resolve.mjs';

const N = +(process.argv[2] || 100);
const { page, close } = await openEngine();

const run = (pitch, wx) => page.evaluate(async ({ N, pitch, wx }) => {
  const home = GD.teams[0], away = GD.teams[1];
  const keeperOf = t => (t.players.find(p => p.keeper) || t.players[0]).name;
  const mkOrd = t => ({ batOrder: [], captain: null, keeper: keeperOf(t), phaseIntent: { pp: 0, mid: 0, death: 1 }, compiled: [] });
  const acc = { n: 0, runs: 0, wkts: 0, pp: 0, mid: 0, death: 0, ppO: 0, midO: 0, deathO: 0, sub150: 0, over320: 0, chaseW: 0, spinW: 0, paceW: 0, spinO: 0, paceO: 0, spinR: 0, paceR: 0 };
  for (let s = 0; s < N; s++) {
    const r = window.__resolveMatch(home, away, mkOrd(home), mkOrd(away), { pitch, weather: wx, ground: home.ground, friendly: true, seed: 40000 + s * 104729 });
    const i1 = r.scorecard[0];
    acc.n++; acc.runs += i1.runs; acc.wkts += i1.wkts;
    if (i1.runs < 150) acc.sub150++; if (i1.runs > 320) acc.over320++;
    if (r.winner_team && r.winner_team !== i1.batTeam) acc.chaseW++;
    // phase rates from the worm: [overFloat, cumRuns, cumWkts] triples, innings 1
    const w = r.worm && r.worm[0];
    if (w && w.length) {
      const at = ov => { let best = [0, 0, 0]; for (const p of w) { if (p[0] <= ov) best = p; else break; } return best; };
      const e10 = at(10), e40 = at(40), end = w[w.length - 1];
      acc.pp += e10[1]; acc.ppO += Math.min(10, end[0]);
      acc.mid += Math.max(0, e40[1] - e10[1]); acc.midO += Math.max(0, Math.min(40, end[0]) - 10);
      acc.death += Math.max(0, end[1] - e40[1]); acc.deathO += Math.max(0, end[0] - 40);
    }
    // spin vs pace wickets/economy (1st innings bowling side)
    const away2 = GD.teams.find(t => t.name !== i1.batTeam) || away;
    for (const b of i1.bowling) {
      const pl = (away2.players || []).find(p => p.name === b.name) || (home.players || []).find(p => p.name === b.name);
      const cls = pl && pl.bowlType && (pl.bowlType.includes('pin')) ? 'spin' : 'pace';
      if (cls === 'spin') { acc.spinW += b.w; acc.spinO += b.balls / 6; acc.spinR += b.econ * b.balls / 6; }
      else { acc.paceW += b.w; acc.paceO += b.balls / 6; acc.paceR += b.econ * b.balls / 6; }
    }
  }
  return acc;
}, { N, pitch, wx });

console.log('=== pitches (sunny), n=' + N + ' each — 1st-innings ===');
console.log('pitch      mean  wkts  PP-rr mid-rr death-rr  <150  >320 chase%  spin(w/o econ) pace(w/o econ)');
for (const p of ['balanced', 'flat', 'green', 'dry', 'slow', 'cracked', 'twoPaced']) {
  const a = await run(p, 'Sunny');
  console.log(
    p.padEnd(10) + (a.runs / a.n).toFixed(0).padStart(4) +
    (a.wkts / a.n).toFixed(1).padStart(6) +
    (a.pp / a.ppO).toFixed(2).padStart(7) + (a.mid / a.midO).toFixed(2).padStart(7) + (a.death / a.deathO).toFixed(2).padStart(9) +
    (100 * a.sub150 / a.n).toFixed(0).padStart(5) + '%' + (100 * a.over320 / a.n).toFixed(0).padStart(5) + '%' +
    (100 * a.chaseW / a.n).toFixed(0).padStart(6) + '%' +
    ('  ' + (a.spinW / a.spinO * 6).toFixed(2) + '/' + (a.spinR / a.spinO).toFixed(2)).padStart(13) +
    ('  ' + (a.paceW / a.paceO * 6).toFixed(2) + '/' + (a.paceR / a.paceO).toFixed(2)).padStart(13)
  );
}
console.log('\n=== weather (balanced pitch) ===');
for (const wxx of ['Sunny', 'Overcast', 'Humid', 'Hot', 'Windy', 'Dew later']) {
  const a = await run('balanced', wxx);
  console.log(wxx.padEnd(10) + (a.runs / a.n).toFixed(0).padStart(4) + (a.wkts / a.n).toFixed(1).padStart(6) + ('chase ' + (100 * a.chaseW / a.n).toFixed(0) + '%').padStart(12));
}
await close();
