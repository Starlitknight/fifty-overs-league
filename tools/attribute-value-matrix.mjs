#!/usr/bin/env node
/* tools/attribute-value-matrix.mjs — WHAT IS A POINT WORTH, AND WHERE?
 *
 * PHASE 3 §4-§7. The single-context probe this replaces
 * (tools/attribute-value-probe.mjs) answered "what is a point of vsSpin
 * worth" with one number measured against one attack on one pitch, and the
 * brief is right that the answer was an artefact: a batsman's vsSpin is
 * worth almost nothing against a pace-heavy side and cannot be priced from
 * that fixture alone. So every attribute is measured across a CROSS of
 * contexts and reported twice - raw per context, and weighted by how often
 * the generated world actually serves that context up.
 *
 * THE DESIGN IS A STAR, NOT A FULL CROSS, and that is a deliberate trade.
 * A full 5 pitches x 3 attacks x 3 levels is 45 cells per attribute; at the
 * sample size needed to resolve a small attribute that is several million
 * matches. Instead each context dimension is varied ONE AT A TIME from a
 * reference cell (balanced pitch, balanced attack, ordinary league), which
 * is 1 + 4 + 2 + 2 = 9 cells and measures every main effect the weighting
 * in §7 actually consumes. Interactions between pitch and attack are NOT
 * measured and are not claimed.
 *
 * MATCH STATE COMES FREE. Batting first / chasing / chasing something hard
 * is not a knob - it is the toss and the first innings - so it is recovered
 * by SPLITTING the reference cell's own paired seeds after the fact, using
 * the CONTROL run to classify each seed so the treatment cannot move a seed
 * between buckets.
 *
 * CURRENCY: match margin per 50 overs (what A scored minus what A conceded),
 * because a batting point shows up as runs made and a bowling point as runs
 * prevented and margin is the only thing that prices both. Win probability
 * is carried alongside as the secondary.
 *
 * RESUMABLE BY CONSTRUCTION. One JSON file per cell under
 * docs/player-value-realism/cells/. A cell already on disk is skipped, so
 * the run can be killed and restarted for ever and only loses the cell it
 * was in the middle of. --shard=k/n splits the work across processes.
 *
 *   node tools/attribute-value-matrix.mjs --list
 *   node tools/attribute-value-matrix.mjs --shard=0/4 --n=400
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeHarness, summary, per50, arg, has } from './realism-lib.mjs';

const OUT = path.resolve('docs/player-value-realism/cells');
const N_REF = parseInt(arg('n', '400'), 10);
const N_CTX = parseInt(arg('nctx', '200'), 10);
// A +10 STEP IS BELOW THE ENGINE'S RESOLUTION for the small attributes - a
// match is quantised, so a ten-point move on moveTurn flips no ball at all in
// most matches and duly measures 0.00+-0.00. The sweep runs at +30 from 45 to
// 75, which is three times the signal for the same sample and is still two
// ordinary cricketers. Per-point figures are the difference divided by 30.
const STEP = 30, BASE = 45;

// ---------------------------------------------------------------------------
// WHO OWNS WHICH ATTRIBUTE. A point of wicket-threat is worth nothing to a man
// who never bowls and a point of keeping nothing to anyone but the keeper, so
// each attribute is measured on the man whose job it is.
//   slot 2  a top-order batsman        slot 5  the keeper
//   slot 6  the strike bowler          slot 0  the armband
// `kind` says where the number lives: a skill, or a card field (exp / capt).
// `pin` pins the swept man's bowling type so that changing the ATTACK context
// changes his colleagues and not him.
// ---------------------------------------------------------------------------
const ATTRS = [
  { attr: 'vsPace', slot: 2, kind: 'skills', fam: 'bat' },
  { attr: 'vsSpin', slot: 2, kind: 'skills', fam: 'bat' },
  { attr: 'power', slot: 2, kind: 'skills', fam: 'bat' },
  { attr: 'rotation', slot: 2, kind: 'skills', fam: 'bat' },
  { attr: 'temperament', slot: 2, kind: 'skills', fam: 'bat' },
  { attr: 'wicket', slot: 6, kind: 'skills', fam: 'bowl', pin: 'seamFastMedium' },
  { attr: 'economy', slot: 6, kind: 'skills', fam: 'bowl', pin: 'seamFastMedium' },
  { attr: 'discipline', slot: 6, kind: 'skills', fam: 'bowl', pin: 'seamFastMedium' },
  { attr: 'moveTurn', slot: 6, kind: 'skills', fam: 'bowl', pin: 'seamFastMedium' },
  { attr: 'variation', slot: 6, kind: 'skills', fam: 'bowl', pin: 'seamFastMedium' },
  { attr: 'fielding', slot: 2, kind: 'skills', fam: 'field' },
  { attr: 'catching', slot: 2, kind: 'skills', fam: 'field' },
  { attr: 'keeping', slot: 5, kind: 'skills', fam: 'glove' },
  { attr: 'stumping', slot: 5, kind: 'skills', fam: 'glove' },
  { attr: 'catching_wk', slot: 5, kind: 'skills', key: 'catching', fam: 'glove' },
  { attr: 'exp_bat', slot: 2, kind: 'exp', fam: 'secondary' },
  { attr: 'exp_bowl', slot: 6, kind: 'exp', fam: 'secondary', pin: 'seamFastMedium' },
  { attr: 'capt', slot: 0, kind: 'capt', fam: 'secondary' },
  // STAMINA IS SIX QUESTIONS, NOT ONE. The brief asks for it by role, and the
  // role fatigue phase already proved the workload law is not the same for a
  // quick as for a spinner - so a single "stamina is worth x" would be an
  // average over people whose jobs cost them different amounts.
  { attr: 'stamina_bat', slot: 2, kind: 'skills', key: 'stamina', fam: 'stamina', refOnly: 1 },
  { attr: 'stamina_fast', slot: 6, kind: 'skills', key: 'stamina', fam: 'stamina', pin: 'seamFast', refOnly: 1 },
  { attr: 'stamina_fastmed', slot: 6, kind: 'skills', key: 'stamina', fam: 'stamina', pin: 'seamFastMedium', refOnly: 1 },
  { attr: 'stamina_med', slot: 6, kind: 'skills', key: 'stamina', fam: 'stamina', pin: 'seamMedium', refOnly: 1 },
  { attr: 'stamina_spin', slot: 6, kind: 'skills', key: 'stamina', fam: 'stamina', pin: 'fingerSpin', refOnly: 1 },
  { attr: 'stamina_wk', slot: 5, kind: 'skills', key: 'stamina', fam: 'stamina', refOnly: 1 }
];

// ---------------------------------------------------------------------------
// THE CONTEXTS. One reference, then one dimension moved at a time.
// The attack shape is applied to BOTH sides: "a spin-heavy world" is a world
// where spin is what gets bowled, which is the exposure question §6 is about,
// not a one-sided fixture. The swept bowler's own type is pinned so the
// dimension moves his colleagues and the opposition, never him.
// ---------------------------------------------------------------------------
const PACE = ['seamFast', 'seamFastMedium', 'seamMedium', 'seamFastMedium', 'fingerSpin'];
const BAL = ['seamFastMedium', 'seamFast', 'seamMedium', 'fingerSpin', 'wristSpin'];
const SPIN = ['fingerSpin', 'wristSpin', 'fingerSpin', 'seamFastMedium', 'seamMedium'];
const REF = { tag: 'ref', pitch: 'balanced', attack: 'balanced', lvl: 1.00 };
const CTX = [
  REF,
  { tag: 'pitch-green', pitch: 'green', attack: 'balanced', lvl: 1.00 },
  { tag: 'pitch-flat', pitch: 'flat', attack: 'balanced', lvl: 1.00 },
  { tag: 'pitch-slow', pitch: 'slow', attack: 'balanced', lvl: 1.00 },
  { tag: 'pitch-dry', pitch: 'dry', attack: 'balanced', lvl: 1.00 },
  { tag: 'attack-pace', pitch: 'balanced', attack: 'pace', lvl: 1.00 },
  { tag: 'attack-spin', pitch: 'balanced', attack: 'spin', lvl: 1.00 },
  { tag: 'lvl-weak', pitch: 'balanced', attack: 'balanced', lvl: 0.72 },
  { tag: 'lvl-elite', pitch: 'balanced', attack: 'balanced', lvl: 1.22 },
  // TWO-PACED AND CRACKED ARE NOT EXOTICA. tools/world-distribution-probe
  // enumerates every fixture of a season in all sixteen nations and finds them
  // at 10.4% and 5.5% of the world's pitches - a sixth of all cricket played.
  // A "world-weighted" value that skipped them would be weighted over 84% of
  // the world and called a whole number.
  //
  // FLAT, by the same count, is 0.0%: no groundsman's leaning in the game
  // produces it, and it exists only when a manager calls for it. It is kept
  // in the raw table for that reason and carries weight ZERO in §7.
  { tag: 'pitch-twopaced', pitch: 'twoPaced', attack: 'balanced', lvl: 1.00 },
  { tag: 'pitch-cracked', pitch: 'cracked', attack: 'balanced', lvl: 1.00 }
];
const TYPES = { balanced: BAL, pace: PACE, spin: SPIN };

// ---------------------------------------------------------------------------
// ROUND TWO. The star above answers most of the phase, and two places where it
// does not are worth naming rather than papering over.
//
// EXPOSURE, PROPERLY. The "spin-heavy" attack is three spinners in five, and
// "pace-heavy" is one - so the spin share only moves from about 20% of the
// overs to about 60%, and a three-fold change in exposure is not much of a
// lever to hang §6's conclusion on. ALL-pace and ALL-spin attacks take it to
// 0% and 100%, which is not a world that exists but IS the clean reading of
// what a point of vsSpin is worth per ball of spin faced. The world weighting
// in §7 then interpolates back to the share the world actually bowls.
//
// AND THE THIN ONES GET MORE SAMPLE. At N=400 the standard error on a
// per-point figure is about 0.06 runs, which resolves wicket-threat fine and
// tells you nothing whatever about experience. The attributes whose reference
// cell came back under two standard errors are re-run at N=1000 rather than
// reported as though a point estimate inside the noise meant something.
const ALLPACE = ['seamFast', 'seamFastMedium', 'seamMedium', 'seamFast', 'seamFastMedium'];
const ALLSPIN = ['fingerSpin', 'wristSpin', 'fingerSpin', 'wristSpin', 'fingerSpin'];
TYPES.allpace = ALLPACE; TYPES.allspin = ALLSPIN;
const EXPOSURE = [
  { tag: 'attack-allpace', pitch: 'balanced', attack: 'allpace', lvl: 1.00 },
  { tag: 'attack-allspin', pitch: 'balanced', attack: 'allspin', lvl: 1.00 }
];
const EXPOSURE_ATTRS = ['vsPace', 'vsSpin'];
// EVERYTHING gets the deep re-run in the end, not only the thin ones. The
// weights fitted in §10 are ratios between these numbers, and a ratio of two
// quantities each carrying a 0.06 standard error is not a weight, it is a
// guess with a decimal point on it. N=1000 halves that.
const DEEP_ATTRS = ATTRS.map(a => a.attr);
const N_DEEP = parseInt(arg('ndeep', '1000'), 10);
const N_EXP = parseInt(arg('nexp', '600'), 10);

const H = makeHarness();

function sideWith(spec, ctx, lvl) {
  const slot = { slot: spec.slot };
  if (spec.kind === 'exp') slot.exp = lvl;
  else if (spec.kind === 'capt') slot.capt = lvl;
  else slot.skills = { [spec.key || spec.attr]: lvl };
  if (spec.pin) slot.bowlTypeFull = spec.pin;
  return H.side('A', { slots: [slot], bowlTypes: TYPES[ctx.attack], lvl: ctx.lvl });
}

// margin = what A scored per 50 minus what A conceded per 50
function marginOf(r) {
  let scored = null, conceded = null;
  for (const inn of [r.i1, r.i2]) {
    if (!inn) continue;
    if (inn.batTeam === 'A') scored = per50(inn.runs, inn.legal);
    else conceded = per50(inn.runs, inn.legal);
  }
  return (scored != null && conceded != null) ? scored - conceded : null;
}
const winOf = r => r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5);

function runCell(spec, ctx, nOverride) {
  const N = nOverride || (ctx.tag === 'ref' ? N_REF : N_CTX);
  const B = H.side('B', { bowlTypes: TYPES[ctx.attack], lvl: ctx.lvl });
  const lo = sideWith(spec, ctx, BASE), hi = sideWith(spec, ctx, BASE + STEP);
  const opts = { pitch: ctx.pitch };
  const per = [];
  for (let i = 0; i < N; i++) {
    const s = 940001 + i * 104729;
    const r1 = H.run(lo, B, s, opts), r2 = H.run(hi, B, s, opts);
    if (!r1 || !r2) continue;
    const m1 = marginOf(r1), m2 = marginOf(r2);
    if (m1 == null || m2 == null) continue;
    // classified off the CONTROL run only, so the treatment can never move a
    // seed from one bucket to another and manufacture a state effect
    const aFirst = !!(r1.i1 && r1.i1.batTeam === 'A');
    per.push({ d: m2 - m1, w: winOf(r2) - winOf(r1), aFirst, target: r1.i1 ? r1.i1.runs : 0 });
  }
  const D = summary(per.map(x => x.d)), W = summary(per.map(x => x.w));
  const cell = {
    attr: spec.attr, fam: spec.fam, ctx: ctx.tag, pitch: ctx.pitch,
    attack: ctx.attack, lvl: ctx.lvl, step: STEP, base: BASE, n: per.length,
    dMargin: D, perPoint: D.mean / STEP, dWin: W
  };
  if (ctx.tag === 'ref') {
    // MATCH STATE, recovered by splitting the same seeds. "Difficult" is the
    // top half of the targets A was actually set, measured on the control.
    const chase = per.filter(x => !x.aFirst);
    const tgts = chase.map(x => x.target).sort((a, b) => a - b);
    const med = tgts.length ? tgts[Math.floor(tgts.length / 2)] : 0;
    const mk = arr => { const s = summary(arr.map(x => x.d));
      return { n: arr.length, mean: s.mean, se: s.se, perPoint: s.mean / STEP }; };
    cell.state = {
      battingFirst: mk(per.filter(x => x.aFirst)),
      chase: mk(chase),
      hardChase: mk(chase.filter(x => x.target >= med)),
      easyChase: mk(chase.filter(x => x.target < med)),
      medianTarget: med
    };
  }
  return cell;
}

// ---------------------------------------------------------------------------
const CELLS = [];
for (const spec of ATTRS)
  for (const ctx of CTX) {
    if (spec.refOnly && ctx.tag !== 'ref') continue;
    CELLS.push({ spec, ctx, file: path.join(OUT, `${spec.attr}__${ctx.tag}.json`) });
  }
for (const spec of ATTRS) {
  if (EXPOSURE_ATTRS.includes(spec.attr))
    for (const ctx of EXPOSURE)
      CELLS.push({ spec, ctx, n: N_EXP, file: path.join(OUT, `${spec.attr}__${ctx.tag}.json`) });
  if (DEEP_ATTRS.includes(spec.attr))
    CELLS.push({ spec, ctx: REF, n: N_DEEP, file: path.join(OUT, `${spec.attr}__deep.json`) });
}

if (has('list')) {
  const done = CELLS.filter(c => fs.existsSync(c.file)).length;
  console.log(`${CELLS.length} cells, ${done} done, ${CELLS.length - done} to go`);
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
const sh = String(arg('shard', '0/1')).split('/');
const [SI, SN] = [parseInt(sh[0], 10), parseInt(sh[1], 10)];
let did = 0;
for (let i = 0; i < CELLS.length; i++) {
  if (i % SN !== SI) continue;
  const c = CELLS[i];
  if (fs.existsSync(c.file)) continue;
  const t0 = Date.now();
  const cell = runCell(c.spec, c.ctx, c.n);
  if (c.n) cell.n_target = c.n;
  // a deep re-run IS the reference context, at more sample; it is labelled
  // apart so the aggregate can prefer it without ever averaging the two and
  // double-counting the same seeds
  if (c.file.endsWith('__deep.json')) cell.ctx = 'deep';
  // written whole, never appended, so a killed run leaves no half file
  fs.writeFileSync(c.file, JSON.stringify(cell, null, 1));
  did++;
  console.log(`${c.spec.attr} @ ${c.ctx.tag}: ${cell.perPoint.toFixed(4)} runs/pt `
    + `(n=${cell.n}, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
console.log(`shard ${SI}/${SN}: ${did} cells written`);
