#!/usr/bin/env node
/* tools/role-mix-probe.mjs — WHAT IS A KEEPER'S SLOT WORTH, AND AN ALL-ROUNDER'S?
 *
 * FINAL CLOSURE §2-§4. The attribute weights are settled. What is not settled
 * is the ROLE MIXTURE - how much of each family a role's card is made of - and
 * two of them are visibly wrong:
 *
 *   wk   bat 1.00 / glove 1.20  puts an elite bat with mediocre gloves TEN
 *        points clear of a balanced keeper, and the engine measures the two of
 *        them level (+0.80 +- 2.21 runs).
 *   ar   bat 0.80 / bowl 0.80   puts a batting specialist SEVEN clear of a
 *        balanced all-rounder, and the engine mildly prefers the all-rounder.
 *
 * THE MEASUREMENT ONLY HAS TO RUN ONCE. A mixture changes the CARD and not the
 * cricket, so the honest design is: play each archetype in the same seat of the
 * same XI on the same seeds, bank what the engine says he is worth, and then
 * sweep the mixture arithmetically against that fixed measurement. Sweeping the
 * mixture inside the match loop would re-measure identical cricket six times
 * and invite the sweep to chase its own noise.
 *
 * REPLACEMENT VALUE, NOT ATTRIBUTE VALUE. A side must field a keeper; the
 * question is not "what is a point of keeping worth" but "how good is this man
 * at filling the keeper's slot". So every archetype is measured as the KEEPER
 * OF A LEGAL XI against the same opposition, and the byes, catches and
 * stumpings he actually produces are counted beside his runs.
 *
 *   node tools/role-mix-probe.mjs --wk --n=600
 *   node tools/role-mix-probe.mjs --ar --n=600
 */
import vm from 'node:vm';
import fs from 'node:fs';
import { makeHarness, summary, per50, arg, has } from './realism-lib.mjs';

const N = parseInt(arg('n', '600'), 10);
const H = makeHarness();
const g = k => vm.runInContext(k, H.ctx);

const WEIGHTS = {
  bat: { vsPace: 0.169, vsSpin: 0.111, power: 0.137, rotation: 0.165, temperament: 0.104 },
  bowl: { wicket: 0.368, economy: 0.287, discipline: 0.088, moveTurn: 0.029, variation: 0.042, stamina: 0.026 },
  field: { fielding: 0.077, catching: 0.029 },
  glove: { catching: 0.230, keeping: 0.021, stumping: 0.018 }
};
const OLD_W = {
  bat: { vsPace: 0.185, vsSpin: 0.145, power: 0.150, rotation: 0.150, temperament: 0.060 },
  bowl: { wicket: 0.415, economy: 0.240, discipline: 0.140, moveTurn: 0.090, variation: 0.060, stamina: 0.030 },
  field: { fielding: 0.200, catching: 0.110 },
  glove: { catching: 0.226, keeping: 0.045, stumping: 0.030 }
};
const OLD_MIX = { bat: { bat: 1, bowl: 0, field: 0.45, glove: 0 }, bowl: { bat: 0, bowl: 1, field: 0.45, glove: 0 },
  ar: { bat: 0.80, bowl: 0.80, field: 0.45, glove: 0 }, wk: { bat: 1, bowl: 0, field: 0, glove: 1.20 } };
const baseMix = (wkGlove, arBB) => ({
  bat: { bat: 1, bowl: 0, field: 1.00, glove: 0 },
  bowl: { bat: 0, bowl: 1, field: 1.00, glove: 0 },
  ar: { bat: arBB, bowl: arBB, field: 1.00, glove: 0 },
  wk: { bat: 1, bowl: 0, field: 0, glove: wkGlove }
});

g('try{ window.FO_VAL_C = FO_VAL_C; window.FO_VAL_W = FO_VAL_W; window.FO_VAL_MIX = FO_VAL_MIX; }catch(e){}');
function setLaw(weights, mix) {
  g(`(function(W,M){ for (var f in W) for (var k in W[f]) FO_VAL_W[f][k] = W[f][k];
       for (var r in M) for (var k2 in M[r]) FO_VAL_MIX[r][k2] = M[r][k2];
       var S={}; for (var f2 in FO_VAL_W){ var t=0; for(var k3 in FO_VAL_W[f2]) t+=FO_VAL_W[f2][k3]; S[f2]=t; }
       for (var r2 in FO_VAL_MIX){ var m=FO_VAL_MIX[r2];
         FO_VAL_C[r2] = m.bat*S.bat + m.bowl*S.bowl + m.field*S.field + m.glove*S.glove; }
     })(${JSON.stringify(weights)},${JSON.stringify(mix)})`);
}
const ovrOf = p => Math.max(0, Math.min(100, Math.round(
  JSON.parse(g(`JSON.stringify(window.foPlayerValue(${JSON.stringify(p)}))`)).ovr)));

function marginOf(r) {
  let sc = null, co = null;
  for (const inn of [r.i1, r.i2]) {
    if (!inn) continue;
    if (inn.batTeam === 'A') sc = per50(inn.runs, inn.legal); else co = per50(inn.runs, inn.legal);
  }
  return (sc != null && co != null) ? sc - co : null;
}
const winOf = r => r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5);
// what side A's KEEPER did with the gloves, read off the fielding ledger the
// harness already collects: the keeper's catches and stumpings are labelled by
// post, and byes are banked per innings
function gloveWork(r, keeperName) {
  let ct = 0, st = 0, bye = 0;
  for (const inn of [r.i1, r.i2]) {
    if (!inn || inn.batTeam === 'A') continue;      // only when A is FIELDING
    // the PER-FIELDER ledger, not the event tally: inn.fielding is keyed by
    // name with {ct, st, ro}, which is the only place the keeper's own work is
    // separable from the cordon's. An earlier cut looked for a 'catch@keeper'
    // label in the event tally and found none, because the engine labels a
    // keeper's catch by his POST and the post is not called that.
    const fd = (inn.fielding || {})[keeperName];
    if (fd) { ct += fd.ct || 0; st += fd.st || 0; }
    const f = inn.fld || {};
    for (const k in f) if (/^bye/i.test(k)) bye += f[k];
  }
  return { ct, st, bye };
}

// ---------------------------------------------------------------------------
function measure(seat, spec, label) {
  const side = H.side('A', { slots: [Object.assign({ slot: seat }, spec)] });
  const man = side.players[seat];
  const B = H.side('B', {});
  const m = [], v = [], gw = { ct: 0, st: 0, bye: 0 };
  let runs = 0, balls = 0, outs = 0;
  for (let i = 0; i < N; i++) {
    const s = 940001 + i * 104729;
    const r = H.run(side, B, s, {});
    if (!r) continue;
    const mm = marginOf(r);
    if (mm != null) m.push(mm);
    v.push(winOf(r));
    const w = gloveWork(r, man.name);
    gw.ct += w.ct; gw.st += w.st; gw.bye += w.bye;
    for (const inn of [r.i1, r.i2]) {
      if (!inn || inn.batTeam !== 'A') continue;
      // the innings bat record keys a man by `nm`, not by a nested player
      for (const b of (inn.bat || [])) {
        if (b && b.nm === man.name) { runs += b.r || 0; balls += b.b || 0; if (b.out) outs++; }
      }
    }
  }
  const M = summary(m), V = summary(v);
  return { label, man, margin: M, win: V,
    ct: gw.ct / N, st: gw.st / N, bye: gw.bye / N,
    batRuns: runs / N, batBalls: balls / N, batAvg: outs ? runs / outs : runs };
}

const out = { n: N };

// ---------------------------------------------------------------------------
// §2-§3 THE KEEPERS.
// ---------------------------------------------------------------------------
if (has('wk') || has('all')) {
  const WK = [
    ['A elite bat / mediocre gloves', { skills: { vsPace: 86, vsSpin: 84, rotation: 84, power: 76, temperament: 74, catching: 52, keeping: 48, stumping: 46 } }],
    ['B balanced keeper-bat',         { skills: { vsPace: 62, vsSpin: 60, rotation: 60, power: 56, temperament: 58, catching: 80, keeping: 76, stumping: 74 } }],
    ['C weak bat / elite gloves',     { skills: { vsPace: 34, vsSpin: 32, rotation: 34, power: 30, temperament: 40, catching: 94, keeping: 92, stumping: 90 } }],
    ['D elite keeper-bat',            { skills: { vsPace: 84, vsSpin: 82, rotation: 82, power: 74, temperament: 76, catching: 90, keeping: 88, stumping: 86 } }],
    ['E poor keeper',                 { skills: { vsPace: 36, vsSpin: 34, rotation: 36, power: 32, temperament: 38, catching: 40, keeping: 36, stumping: 34 } }],
    ['F ordinary league keeper',      { skills: { vsPace: 55, vsSpin: 54, rotation: 54, power: 50, temperament: 54, catching: 62, keeping: 58, stumping: 56 } }]
  ];
  const rows = WK.map(([label, spec]) => measure(5, spec, label));
  console.log(`\n=== §2 KEEPERS IN A LEGAL XI (N=${N}, same seat, same opposition, same seeds) ===`);
  console.log('  keeper                          margin/50     win%   ct/inn  st/inn  byes   bat runs  avg');
  for (const r of rows)
    console.log('  ' + r.label.padEnd(30) + (r.margin.mean.toFixed(2) + '±' + r.margin.se.toFixed(2)).padStart(14)
      + (100 * r.win.mean).toFixed(1).padStart(8) + r.ct.toFixed(2).padStart(9) + r.st.toFixed(2).padStart(8)
      + r.bye.toFixed(2).padStart(7) + r.batRuns.toFixed(1).padStart(10) + r.batAvg.toFixed(1).padStart(6));
  // the mixture sweep, against that ONE measurement
  console.log(`\n=== THE wk GLOVE MULTIPLIER, SWEPT AGAINST THAT MEASUREMENT ===`);
  const MULTS = [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0];
  setLaw(OLD_W, OLD_MIX);
  const oldOvr = rows.map(r => ovrOf(r.man));
  const sweep = [];
  for (const mult of MULTS) {
    setLaw(WEIGHTS, baseMix(mult, 0.80));
    const o = rows.map(r => ovrOf(r.man));
    // how well does the card track the engine? Pearson r over the six, plus
    // the biggest single mis-ordering in RUNS the card is wrong by, converted
    // at the measured 1.13 runs per overall at the keeper seat
    const mm = rows.map(r => r.margin.mean);
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const mo = mean(o), mM = mean(mm);
    const cov = o.reduce((a, x, i) => a + (x - mo) * (mm[i] - mM), 0);
    const so = Math.sqrt(o.reduce((a, x) => a + (x - mo) ** 2, 0));
    const sM = Math.sqrt(mm.reduce((a, x) => a + (x - mM) ** 2, 0));
    const r = cov / Math.max(1e-9, so * sM);
    // worst pair: |card gap in runs - measured gap in runs|
    let worst = 0, worstPair = '';
    for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
      const cardRuns = (o[i] - o[j]) * 1.13, engRuns = mm[i] - mm[j];
      if (Math.abs(cardRuns - engRuns) > worst) {
        worst = Math.abs(cardRuns - engRuns);
        worstPair = rows[i].label.slice(0, 1) + 'v' + rows[j].label.slice(0, 1);
      }
    }
    sweep.push({ mult, ovr: o, r, worst, worstPair });
    console.log(`  x${mult.toFixed(1)}  ` + o.map((x, i) => `${rows[i].label.slice(0, 1)}=${String(x).padStart(2)}`).join(' ')
      + `   r=${r.toFixed(3)}  worst mis-price ${worst.toFixed(1)} runs (${worstPair})`);
  }
  console.log('  OLD   ' + oldOvr.map((x, i) => `${rows[i].label.slice(0, 1)}=${String(x).padStart(2)}`).join(' '));
  out.wk = { rows: rows.map(r => ({ label: r.label, margin: r.margin, win: r.win, ct: r.ct, st: r.st, bye: r.bye, batRuns: r.batRuns })), specs: rows.map(r => r.man), oldOvr, sweep };
}

// ---------------------------------------------------------------------------
// §4 THE ALL-ROUNDERS.
// ---------------------------------------------------------------------------
if (has('ar') || has('all')) {
  // seat 4 is the No.5 bat; giving him a bowling type makes him the side's
  // SIXTH bowling option, which is exactly the roster flexibility the mixture
  // is being asked to price
  const mkAr = (bat, bowl) => ({ role: 'allRounder', bowlTypeFull: 'seamMedium',
    skills: { vsPace: bat, vsSpin: bat - 2, rotation: bat - 2, power: bat - 6, temperament: bat - 4,
      wicket: bowl, economy: bowl - 2, discipline: bowl - 4, moveTurn: bowl - 4, variation: bowl - 6, stamina: bowl } });
  const AR = [
    ['20/70 bowling AR', mkAr(20, 70)], ['70/20 batting AR', mkAr(70, 20)],
    ['45/45', mkAr(45, 45)], ['55/55', mkAr(55, 55)], ['60/60', mkAr(60, 60)],
    ['65/55', mkAr(65, 55)], ['55/65', mkAr(55, 65)], ['70/70', mkAr(70, 70)],
    ['bat specialist 75', { skills: { vsPace: 75, vsSpin: 73, rotation: 73, power: 69, temperament: 71 } }],
    ['bat specialist 65', { skills: { vsPace: 65, vsSpin: 63, rotation: 63, power: 59, temperament: 61 } }]
  ];
  const rows = AR.map(([label, spec]) => measure(4, spec, label));
  console.log(`\n=== §4 ALL-ROUNDERS AT No.5, THE SIDE'S SIXTH BOWLING OPTION (N=${N}) ===`);
  console.log('  man                        margin/50     win%    bat runs   avg');
  for (const r of rows)
    console.log('  ' + r.label.padEnd(26) + (r.margin.mean.toFixed(2) + '±' + r.margin.se.toFixed(2)).padStart(14)
      + (100 * r.win.mean).toFixed(1).padStart(8) + r.batRuns.toFixed(1).padStart(11) + r.batAvg.toFixed(1).padStart(7));
  console.log(`\n=== THE ar bat/bowl MULTIPLIER, SWEPT AGAINST THAT MEASUREMENT ===`);
  const MULTS = [0.80, 0.90, 1.00, 1.10, 1.20];
  setLaw(OLD_W, OLD_MIX);
  const oldOvr = rows.map(r => ovrOf(r.man));
  const sweep = [];
  for (const mult of MULTS) {
    setLaw(WEIGHTS, baseMix(1.20, mult));
    const o = rows.map(r => ovrOf(r.man));
    const mm = rows.map(r => r.margin.mean);
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const mo = mean(o), mM = mean(mm);
    const cov = o.reduce((a, x, i) => a + (x - mo) * (mm[i] - mM), 0);
    const so = Math.sqrt(o.reduce((a, x) => a + (x - mo) ** 2, 0));
    const sM = Math.sqrt(mm.reduce((a, x) => a + (x - mM) ** 2, 0));
    const r = cov / Math.max(1e-9, so * sM);
    let worst = 0, worstPair = '';
    for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
      const cardRuns = (o[i] - o[j]) * 1.13, engRuns = mm[i] - mm[j];
      if (Math.abs(cardRuns - engRuns) > worst) {
        worst = Math.abs(cardRuns - engRuns); worstPair = rows[i].label + ' v ' + rows[j].label;
      }
    }
    sweep.push({ mult, ovr: o, r, worst, worstPair });
    console.log(`  x${mult.toFixed(2)}  ` + o.map(x => String(x).padStart(3)).join('')
      + `   r=${r.toFixed(3)}  worst ${worst.toFixed(1)} runs (${worstPair})`);
  }
  console.log('  OLD    ' + oldOvr.map(x => String(x).padStart(3)).join(''));
  console.log('  order: ' + rows.map(r => r.label).join(' | '));
  out.ar = { rows: rows.map(r => ({ label: r.label, margin: r.margin, win: r.win, batRuns: r.batRuns })), specs: rows.map(r => r.man), oldOvr, sweep };
}

fs.writeFileSync('docs/fast-bowler-generation/role-mix.json', JSON.stringify(out, null, 1));
