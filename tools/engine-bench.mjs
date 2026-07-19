/* tools/engine-bench.mjs — the engine-model benchmark gate.
 *
 * Run after ANY change to the engine's tuning model (FO_TUNE in the engine
 * file) or anything else that could shift match balance:
 *
 *     ./build.sh && node tools/engine-bench.mjs        (BENCH_N=24 for more seeds)
 *
 * Plays a matrix of full seeded matches through the SHIPPED build headless
 * (test/engine-vm.mjs — proven bit-identical to the browser), three pitches
 * x tuning off/on, then checks the TUNED model against target bands derived
 * from the modern-ODI audit. Exits non-zero if any band is missed, so it
 * can gate a release. Pure Node — no browser needed.
 *
 * The "off" rows (stock model via the __foTuneOff kill switch) are printed
 * for comparison but not gated — they show what the tuning layer is doing.
 */
import { makeEngine } from '../test/engine-vm.mjs';

const N = Math.max(4, parseInt(process.env.BENCH_N || '12', 10));

// target bands for the TUNED model (means over N seeded matches)
const TARGETS = {
  balanced: { par: [252, 292], wkts: [6.0, 9.5], spinShare: [0.30, 0.52] },
  dry: { par: [215, 268], wkts: [6.5, 10], spinShare: [0.44, 0.68] },
  green: { par: [210, 282], wkts: [6.5, 10], spinShare: [0.12, 0.42] }
};

import vm from 'node:vm';
const eng = makeEngine();

// runner that also reports spin/pace bowler-credited wickets
const richRunner = vm.runInContext(`
(function (aIx, bIx, pitch, weather, seed) {
  onMatchEnd = function () {};
  M = newMatch(GD.teams[aIx], GD.teams[bIx], pitch, (seed >>> 0) || 1);
  M.meta = { home: GD.teams[aIx].name, away: GD.teams[bIx].name, pitch: pitch, weather: weather || 'Sunny', comp: 'vm', isUser: false };
  M.isUserMatch = false; M.ordersMap = {};
  App.tossState = { stage: 'x' };
  applyToss(aiTossDecision());
  var g = 0;
  while (M && !M.done && g++ < 3000) { autoPick(); stepBall(); }
  if (!M || !M.done) return null;
  var spin = function (t) { return /spin/i.test(t || ''); };
  var sw = 0, pw = 0;
  M.innings.forEach(function (inn) {
    if (!inn) return;
    for (var nm in inn.bowlers) {
      var pl = (inn.bxi || []).find(function (x) { return x.name === nm; });
      var w = inn.bowlers[nm].w || 0;
      if (pl && spin(pl.bowlTypeFull || pl.bowlType)) sw += w; else pw += w;
    }
  });
  var i1 = M.innings[0];
  return JSON.stringify({ s1: i1.runs, wk1: i1.wkts, spinW: sw, paceW: pw });
})`, eng.ctx);

const seeds = Array.from({ length: N }, (_, i) => 1000 + i * 77);
const agg = list => {
  const n = list.length, m = k => list.reduce((a, x) => a + x[k], 0) / n;
  const sw = m('spinW'), pw = m('paceW');
  return { n, par: +m('s1').toFixed(1), wkts: +m('wk1').toFixed(2),
    spinW: +sw.toFixed(2), paceW: +pw.toFixed(2),
    spinShare: +(sw / Math.max(0.001, sw + pw)).toFixed(3) };
};
const res = {};
for (const pitch of ['balanced', 'dry', 'green']) {
  for (const mode of ['off', 'on']) {
    eng.setTuning(mode === 'on');
    const runs = seeds.map(s => { const j = richRunner(0, 1, pitch, 'Sunny', s); return j ? JSON.parse(j) : null; }).filter(Boolean);
    res[pitch + '_' + mode] = agg(runs);
  }
}
eng.setTuning(true);
const a = richRunner(0, 1, 'dry', 'Sunny', 4242), c = richRunner(0, 1, 'dry', 'Sunny', 4242);
res.deterministic = !!(a && c && a === c);

let fail = [];
if (!res.deterministic) fail.push('tuned model is not seed-deterministic');
for (const pitch of Object.keys(TARGETS)) {
  const t = TARGETS[pitch], r = res[pitch + '_on'];
  if (!r || r.n < N * 0.9) { fail.push(pitch + ': matches failed to complete'); continue; }
  const inBand = (v, [lo, hi]) => v >= lo && v <= hi;
  if (!inBand(r.par, t.par)) fail.push(pitch + ' par ' + r.par + ' outside [' + t.par + ']');
  if (!inBand(r.wkts, t.wkts)) fail.push(pitch + ' wkts ' + r.wkts + ' outside [' + t.wkts + ']');
  if (!inBand(r.spinShare, t.spinShare)) fail.push(pitch + ' spinShare ' + r.spinShare + ' outside [' + t.spinShare + ']');
}

const row = k => { const r = res[k]; return k.padEnd(14) + (r ? 'par ' + String(r.par).padEnd(7) + 'wkts ' + String(r.wkts).padEnd(6) + 'spinW ' + String(r.spinW).padEnd(6) + 'paceW ' + String(r.paceW).padEnd(6) + 'spinShare ' + r.spinShare : 'n/a'); };
console.log('engine-bench  N=' + N + ' seeds per cell   (off = stock model, for comparison)');
for (const pitch of ['balanced', 'dry', 'green']) { console.log(row(pitch + '_off')); console.log(row(pitch + '_on')); }
console.log('deterministic: ' + res.deterministic);
if (fail.length) { console.error('\nFAIL:\n  ' + fail.join('\n  ')); process.exit(1); }
console.log('\nPASS — tuned model inside all target bands.');
