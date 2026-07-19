/* tools/engine-bench.mjs — the engine-model benchmark gate.
 *
 * Run after ANY change to the engine tuning layer (client/src/features/
 * engine-tuning.js) or to build inputs that could shift match balance:
 *
 *     ./build.sh && node tools/engine-bench.mjs        (BENCH_N=24 for more seeds)
 *
 * It plays a matrix of full seeded matches through the real engine —
 * three pitches x tuning off/on — using the built index.html headless,
 * then checks the TUNED model against target bands derived from the
 * modern-ODI audit. Exits non-zero if any band is missed, so it can gate
 * a release. Needs the environment's playwright + chromium (the same
 * ones the resolver probes use); it is not part of the fast unit-test
 * suite on purpose.
 *
 * The "off" rows (stock model via window.__foTuneOff) are printed for
 * comparison but not gated — they show what the tuning layer is doing.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// playwright normally lives in the (untracked) resolver/ probe workspace;
// fall back to a regular install if one exists
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = createRequire(path.join(root, 'resolver', 'package.json'))('playwright')); }
const N = Math.max(4, parseInt(process.env.BENCH_N || '12', 10));

// target bands for the TUNED model (means over N seeded matches)
const TARGETS = {
  balanced: { par: [252, 292], wkts: [6.0, 9.5], spinShare: [0.30, 0.52] },
  dry: { par: [215, 268], wkts: [6.5, 10], spinShare: [0.44, 0.68] },
  green: { par: [210, 282], wkts: [6.5, 10], spinShare: [0.12, 0.42] }
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 700 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { try { localStorage.setItem('fo_welcomed', '1'); localStorage.setItem('fo_club', '0'); } catch (e) {} });
await p.goto('file://' + root + '/index.html');
await p.waitForFunction(() => window.ballDist && window.ballDist.__foTuned && window.__foGame, { timeout: 20000 });

const res = await p.evaluate((N) => {
  const spin = t => /spin/i.test(t || '');
  function run(pitch, seed) {
    const r = __foGame.simWorld(GD.teams[0], GD.teams[1], pitch, 'Sunny', seed, {});
    if (!r) return null;
    const wk = (inn) => {
      let sw = 0, pw = 0;
      for (const nm in inn.bowlers) {
        const pl = (inn.bxi || []).find(x => x.name === nm);
        const w = inn.bowlers[nm].w || 0;
        if (pl && spin(pl.bowlTypeFull || pl.bowlType)) sw += w; else pw += w;
      }
      return { sw, pw };
    };
    const i1 = r.innings[0], i2 = r.innings[1];
    const w1 = wk(i1), w2 = i2 ? wk(i2) : { sw: 0, pw: 0 };
    return { s1: i1.runs, wk1: i1.wkts, spinW: w1.sw + w2.sw, paceW: w1.pw + w2.pw };
  }
  const seeds = Array.from({ length: N }, (_, i) => 1000 + i * 77);
  const agg = list => {
    const n = list.length, m = k => list.reduce((a, x) => a + x[k], 0) / n;
    const sw = m('spinW'), pw = m('paceW');
    return { n, par: +m('s1').toFixed(1), wkts: +m('wk1').toFixed(2),
      spinW: +sw.toFixed(2), paceW: +pw.toFixed(2),
      spinShare: +(sw / Math.max(0.001, sw + pw)).toFixed(3) };
  };
  const out = {};
  for (const pitch of ['balanced', 'dry', 'green']) {
    for (const mode of ['off', 'on']) {
      window.__foTuneOff = (mode === 'off') ? 1 : 0;
      out[pitch + '_' + mode] = agg(seeds.map(s => run(pitch, s)).filter(Boolean));
    }
  }
  // determinism: the tuned model must be seed-stable
  window.__foTuneOff = 0;
  const a = run('dry', 4242), c = run('dry', 4242);
  out.deterministic = !!(a && c && a.s1 === c.s1 && a.wk1 === c.wk1 && a.spinW === c.spinW);
  return out;
}, N);

await b.close();

let fail = [];
if (errs.length) fail.push('page errors: ' + errs.join(' | '));
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
