// Engine realism probe #3 — factor A/B: fatigue, age, experience, captaincy,
// talents, keeping. Same seeds, one attribute flipped on team A only.
import { openEngine } from './resolve.mjs';

const N = +(process.argv[2] || 80);
const { page, close } = await openEngine();

const res = await page.evaluate(async ({ N }) => {
  const base = GD.teams[0], opp = GD.teams[1];
  const keeperOf = t => (t.players.find(p => p.keeper) || t.players[0]).name;
  const mkOrd = t => ({ batOrder: [], captain: null, keeper: keeperOf(t), phaseIntent: { pp: 0, mid: 0, death: 1 }, compiled: [] });
  const clone = t => JSON.parse(JSON.stringify({ name: t.name, ground: t.ground, players: t.players }));

  function play(A, seedBase) {
    const acc = { bat: 0, batN: 0, concede: 0, conN: 0, w: 0, l: 0 };
    for (let s = 0; s < N; s++) {
      const r = window.__resolveMatch(A, opp, mkOrd(A), mkOrd(opp), { pitch: 'balanced', weather: 'Sunny', ground: 'Neutral Ground', friendly: true, seed: seedBase + s * 7919 });
      for (const inn of r.scorecard) {
        if (!inn) continue;
        if (inn.batTeam === A.name) { acc.bat += inn.runs; acc.batN++; }
        else { acc.concede += inn.runs; acc.conN++; }
      }
      if (r.winner_team === A.name) acc.w++; else if (r.winner_team) acc.l++;
    }
    return acc;
  }

  const variants = {};
  const mk = (label, fn) => { const A = clone(base); A.players.forEach(fn); variants[label] = play(A, 60000); };

  mk('baseline        ', p => {});
  mk('all exhausted   ', p => { p.fatigue = 'exhausted'; });
  mk('all weary       ', p => { p.fatigue = 'weary'; });
  mk('all age 36      ', p => { p.age = 36; });
  mk('all age 22      ', p => { p.age = 22; });
  mk('all exp 95      ', p => { p.exp = 95; });
  mk('all exp 15      ', p => { p.exp = 15; });
  mk('no talents      ', p => { p.talents = []; });
  mk('capt 95 all     ', p => { p.capt = 95; });
  mk('capt 15 all     ', p => { p.capt = 15; });
  mk('keeping 90      ', p => { if (p.keeper) { p.keeping = 90; if (p.skills) { p.skills.keeping = 90; p.skills.catching = 90; p.skills.stumping = 90; } } });
  mk('keeping 25      ', p => { if (p.keeper) { p.keeping = 25; if (p.skills) { p.skills.keeping = 25; p.skills.catching = 25; p.skills.stumping = 25; } } });

  return variants;
}, { N });
await close();

const b = res['baseline        '];
console.log(`n=${N} matches per variant, balanced/sunny, neutral ground — team A modified only`);
console.log('variant           A bat avg   A concedes   win%    Δbat  Δconcede');
for (const [k, a] of Object.entries(res)) {
  const bat = a.bat / a.batN, con = a.concede / a.conN, wr = 100 * a.w / (a.w + a.l);
  const dBat = bat - b.bat / b.batN, dCon = con - b.concede / b.conN;
  console.log(k + bat.toFixed(1).padStart(9) + con.toFixed(1).padStart(12) + (wr.toFixed(0) + '%').padStart(8) + dBat.toFixed(1).padStart(9) + dCon.toFixed(1).padStart(9));
}
