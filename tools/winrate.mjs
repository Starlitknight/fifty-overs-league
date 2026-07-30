/* tools/winrate.mjs — WHAT DOES A RATING GAP ACTUALLY BUY YOU?
 *
 * Plays full seeded fifty-over matches through the SHIPPED engine (the same
 * headless VM the golden-master replay suite uses) between two sides whose XI
 * ratings sit at a known ratio, and reports the stronger side's win rate.
 *
 * Method
 *   - one baseline squad, taken from the game's own generator
 *   - the weaker side is that squad with every skill scaled by 1/(1+gap).
 *     A player's rating is a linear combination of his skills with no constant
 *     term, so scaling the skills scales the rating by the same factor - which
 *     is checked, not assumed, and printed as "measured".
 *   - every fixture is played TWICE, home and away, so home advantage cancels
 *   - ties and no-results are counted separately, never as half a win
 *
 *     node tools/winrate.mjs [SEEDS=200]
 */
import { makeEngine } from '../test/engine-vm.mjs';
import vm from 'node:vm';

const SEEDS = Math.max(10, parseInt(process.env.SEEDS || '200', 10));
const eng = makeEngine();
eng.setTuning(true);

// play one match between GD.teams[0] and GD.teams[1] and say who won
const play = vm.runInContext(`
(function (aIx, bIx, pitch, seed) {
  onMatchEnd = function () {};
  M = newMatch(GD.teams[aIx], GD.teams[bIx], pitch, (seed >>> 0) || 1);
  M.meta = { home: GD.teams[aIx].name, away: GD.teams[bIx].name, pitch: pitch,
             weather: 'Sunny', comp: 'vm', isUser: false };
  M.isUserMatch = false; M.ordersMap = {};
  App.tossState = { stage: 'x' };
  applyToss(aiTossDecision());
  var g = 0;
  while (M && !M.done && g++ < 4000) { autoPick(); stepBall(); }
  if (!M || !M.done || !M.result) return null;
  return JSON.stringify({ winner: M.result.winner || null,
                          s1: (M.innings[0] || {}).runs, s2: (M.innings[1] || {}).runs });
})`, eng.ctx);

// the XI rating a club page shows: the mean of the best eleven
const xiRating = players => {
  const best = players.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 11);
  return best.reduce((s, p) => s + (p.rating || 0), 0) / 11;
};

const ctx = eng.ctx;
// GD and jsDerive are top-level bindings in the engine's closure, not window
// properties, so they are reached the way the browser reaches them: by name.
const run = src => vm.runInContext(src, ctx);
const setSquads = (a, b) => { ctx.__A = a; ctx.__B = b; run('GD.teams[0].players = __A; GD.teams[1].players = __B;'); };
const teamName = ix => run('GD.teams[' + ix + '].name');
const BASE = JSON.parse(JSON.stringify(run('GD.teams[0].players')));

/** the same men, every skill scaled - which scales the rating by the same factor */
function scaled(players, f) {
  const out = JSON.parse(JSON.stringify(players));
  out.forEach(p => {
    for (const k in (p.skills || {})) p.skills[k] = Math.max(1, Math.min(99, Math.round(p.skills[k] * f)));
    p.formIx = 3; p.fatigue = 'rested';       // form and fatigue held level, so the
  });                                          // gap on trial is the rating gap alone
  ctx.__sc = out;
  run('__sc.forEach(function (p) { jsDerive(p); });');
  return ctx.__sc;
}

const PITCHES = ['balanced', 'dry', 'green'];
const GAPS = [0, 0.025, 0.05, 0.10, 0.15, 0.20, 0.30, 0.40, 0.50, 0.75, 1.00];
const rows = [];

for (const gap of GAPS) {
  const strong = scaled(BASE, 1);
  const weak = scaled(BASE, 1 / (1 + gap));
  const measured = xiRating(strong) / xiRating(weak);

  let w = 0, l = 0, t = 0, n = 0, marginFor = 0, marginAgainst = 0;
  for (let i = 0; i < SEEDS; i++) {
    // home and away, so the toss and the home side's advantage cancel out
    for (const homeIsStrong of [true, false]) {
      setSquads(homeIsStrong ? strong : weak, homeIsStrong ? weak : strong);
      // rotate the surface: a league is not played on one pitch, and a gap is
      // worth different amounts on a green top and a dry turner
      const pitch = PITCHES[i % PITCHES.length];
      const j = play(0, 1, pitch, 7001 + i * 131 + (homeIsStrong ? 0 : 1));
      if (!j) continue;
      const r = JSON.parse(j);
      n++;
      const strongName = teamName(homeIsStrong ? 0 : 1);
      if (!r.winner) t++;
      else if (r.winner === strongName) { w++; marginFor += Math.abs(r.s1 - r.s2); }
      else { l++; marginAgainst += Math.abs(r.s1 - r.s2); }
    }
  }
  const pct = x => (100 * x / Math.max(1, n));
  rows.push({ gap, measured: +measured.toFixed(3), n, w, l, t,
    win: +pct(w).toFixed(1), loss: +pct(l).toFixed(1), tie: +pct(t).toFixed(1),
    // the 95% interval on the win rate, so a number is not read as sharper than it is
    ci: +(196 * Math.sqrt((w / n) * (1 - w / n) / n)).toFixed(1) });
}

console.log('\nfifty-overs: win rate by rating gap   (' + (SEEDS * 2) + ' matches per row, ' +
  'home and away, pitches rotated)\n');
console.log('  gap    measured   stronger side wins        loses     ties');
for (const r of rows) {
  console.log('  ' + (('+' + Math.round(r.gap * 100) + '%').padEnd(7)) +
    (r.measured.toFixed(3) + 'x').padEnd(11) +
    (r.win.toFixed(1) + '% ±' + r.ci).padEnd(26) +
    (r.loss.toFixed(1) + '%').padEnd(13) + r.tie.toFixed(1) + '%');
}
console.log('');
