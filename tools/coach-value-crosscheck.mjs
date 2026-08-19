#!/usr/bin/env node
/* tools/coach-value-crosscheck.mjs — DOES THE COACH AGREE WITH THE CARD?
 *
 * PART B §9. The Match-Day Coach is the one part of the game that already
 * prices a cricketer against the real ball model: it reads SKILLS directly,
 * never OVR, and its `rpd` (runs per dismissal) and `bowl` figures are what it
 * uses to choose an XI. That makes it an independent second opinion about who
 * is better, arrived at by a completely different route from FO_VAL_W.
 *
 * The test is deliberately asymmetric, as the brief frames it. A one-off
 * disagreement means nothing - the coach knows about the pitch and the card
 * does not, and that is the card being general rather than wrong. What would
 * be a finding is a SYSTEMATIC contradiction: the candidate card puts one man
 * eight or ten points clear and the coach picks the other one over and over,
 * across pitches, in a direction that has a name.
 *
 * So the coach is asked for its own worth on a squad of deliberately varied
 * cricketers, at five pitches, and the pairs where the card and the coach
 * disagree by a wide margin are counted and printed with their reason.
 *
 *   node tools/coach-value-crosscheck.mjs
 */
import vm from 'node:vm';
import fs from 'node:fs';
import { makeHarness } from './realism-lib.mjs';

const H = makeHarness();
const g = k => vm.runInContext(k, H.ctx);
const pairsFile = 'docs/fast-bowler-generation/pair-tests.json';
const P = JSON.parse(fs.readFileSync(pairsFile, 'utf8'));
const { OLD, NEW } = P.weights, { MIX_OLD, MIX_NEW } = P.mix;

g('try{ window.FO_VAL_C = FO_VAL_C; window.FO_VAL_W = FO_VAL_W; window.FO_VAL_MIX = FO_VAL_MIX; }catch(e){}');
// the OLD arm has to be the OLD law all the way down, and the experience layer
// lives in the engine rather than in a weight - so it is switched off with the
// old weights and back on with the new ones
const expOff = v => g(`__foExpOvrOff=${v ? 1 : 0};1`);
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

// ---------------------------------------------------------------------------
// A SQUAD BUILT TO DISAGREE. Every man is an extreme of one kind, because a
// squad of ordinary cricketers would agree about everything and prove nothing.
// ---------------------------------------------------------------------------
const mk = (name, role, bt, sk, extra) => H.mk(Object.assign(
  { name, role, bowlTypeFull: bt, skills: sk }, extra || {}));
const SQUAD = [
  mk('elite bat poor hands', 'topOrderBat', 'none',
    { vsPace: 86, vsSpin: 84, power: 78, rotation: 84, temperament: 78, fielding: 26, catching: 24 }),
  mk('good bat elite hands', 'topOrderBat', 'none',
    { vsPace: 70, vsSpin: 68, power: 64, rotation: 68, temperament: 62, fielding: 94, catching: 92 }),
  mk('ordinary bat', 'middleOrderBat', 'none',
    { vsPace: 62, vsSpin: 60, power: 58, rotation: 60, temperament: 58, fielding: 55, catching: 55 }),
  mk('cool head', 'middleOrderBat', 'none',
    { vsPace: 64, vsSpin: 62, power: 58, rotation: 62, temperament: 96, fielding: 55, catching: 55 }),
  mk('no nerve', 'middleOrderBat', 'none',
    { vsPace: 72, vsSpin: 70, power: 66, rotation: 70, temperament: 18, fielding: 55, catching: 55 }),
  mk('spin merchant bat', 'middleOrderBat', 'none',
    { vsPace: 48, vsSpin: 88, power: 60, rotation: 66, temperament: 62, fielding: 55, catching: 55 }),
  mk('pace merchant bat', 'middleOrderBat', 'none',
    { vsPace: 88, vsSpin: 48, power: 60, rotation: 66, temperament: 62, fielding: 55, catching: 55 }),
  mk('keeper bat', 'wicketkeeper', 'none',
    { vsPace: 78, vsSpin: 76, rotation: 76, power: 70, catching: 58, keeping: 52, stumping: 50 }),
  mk('gloveman', 'wicketkeeper', 'none',
    { vsPace: 34, vsSpin: 32, rotation: 34, power: 30, catching: 94, keeping: 92, stumping: 90 }),
  mk('strike quick', 'seamFast', 'seamFast',
    { wicket: 86, economy: 48, discipline: 56, moveTurn: 74, variation: 64, stamina: 72 }),
  mk('miser', 'seamMedium', 'seamMedium',
    { wicket: 48, economy: 86, discipline: 80, moveTurn: 56, variation: 54, stamina: 66 }),
  mk('fast-medium', 'seamFastMedium', 'seamFastMedium',
    { wicket: 70, economy: 68, discipline: 66, moveTurn: 68, variation: 62, stamina: 66 }),
  mk('workhorse', 'seamMedium', 'seamMedium',
    { wicket: 58, economy: 64, discipline: 68, moveTurn: 56, variation: 52, stamina: 94 }),
  mk('finger spinner', 'fingerSpin', 'fingerSpin',
    { wicket: 66, economy: 70, discipline: 66, moveTurn: 72, variation: 60, stamina: 50 }),
  mk('wrist spinner', 'wristSpin', 'wristSpin',
    { wicket: 74, economy: 54, discipline: 48, moveTurn: 76, variation: 78, stamina: 48 }),
  mk('all-rounder', 'allRounder', 'seamMedium',
    { vsPace: 68, vsSpin: 66, power: 62, rotation: 66, temperament: 64,
      wicket: 62, economy: 64, discipline: 60, moveTurn: 58, variation: 56, stamina: 66 })
];

const PITCHES = ['balanced', 'green', 'flat', 'dry', 'slow'];
// the coach's own currency, exactly as server/nations.mjs coverRank reads it:
// what a man is worth with the bat plus what his overs save
function coachWorth(pitch) {
  const plan = JSON.parse(g(`JSON.stringify(window.planMatchDay(`
    + `{team:{name:'X',players:${JSON.stringify(SQUAD)}},pitch:${JSON.stringify(pitch)},weather:'Sunny'}))`));
  const cards = (plan && plan.explanation && plan.explanation.cards) || [];
  const worth = {};
  for (const c of cards) worth[c.name] = (c.rpd || 0) + (c.bowl || 0) * 2;
  return worth;
}

expOff(true); setLaw(OLD, MIX_OLD); const oldOvr = Object.fromEntries(SQUAD.map(p => [p.name, ovrOf(p)]));
expOff(false); setLaw(NEW, MIX_NEW); const newOvr = Object.fromEntries(SQUAD.map(p => [p.name, ovrOf(p)]));

console.log('\n=== THE SQUAD, OLD CARD vs CANDIDATE CARD ===');
console.log('  cricketer                  OLD   CAND     d');
for (const p of SQUAD)
  console.log('  ' + p.name.padEnd(26) + String(oldOvr[p.name]).padStart(4)
    + String(newOvr[p.name]).padStart(7)
    + String(newOvr[p.name] - oldOvr[p.name] >= 0 ? '+' + (newOvr[p.name] - oldOvr[p.name])
      : (newOvr[p.name] - oldOvr[p.name])).padStart(6));

// ---------------------------------------------------------------------------
// EVERY PAIR, EVERY PITCH. A contradiction is: the card says one man is clear
// by GAP or more, and the coach prefers the other.
// ---------------------------------------------------------------------------
const GAP = 8;
const worths = Object.fromEntries(PITCHES.map(pi => [pi, coachWorth(pi)]));
function scan(ovr, label) {
  const rows = [];
  for (let i = 0; i < SQUAD.length; i++)
    for (let j = i + 1; j < SQUAD.length; j++) {
      const a = SQUAD[i].name, b = SQUAD[j].name;
      const d = ovr[a] - ovr[b];
      if (Math.abs(d) < GAP) continue;
      const hi = d > 0 ? a : b, lo = d > 0 ? b : a;
      let against = 0;
      for (const pi of PITCHES) {
        const W = worths[pi];
        if (W[hi] == null || W[lo] == null) continue;
        if (W[lo] > W[hi]) against++;
      }
      if (against >= 4) rows.push({ hi, lo, gap: Math.abs(d), against });
    }
  console.log(`\n=== ${label}: pairs the card separates by >=${GAP} where the coach `
    + `prefers the LOWER man on 4+ of 5 pitches ===`);
  if (!rows.length) { console.log('  none'); return rows; }
  rows.sort((x, y) => y.gap - x.gap);
  for (const r of rows)
    console.log(`  card says ${r.hi} > ${r.lo} by ${r.gap}; coach disagrees on ${r.against}/5 pitches`);
  return rows;
}
const oldRows = scan(oldOvr, 'OLD CARD');
const newRows = scan(newOvr, 'CANDIDATE CARD');
console.log(`\n  systematic contradictions: old ${oldRows.length}, candidate ${newRows.length}`);
fs.writeFileSync('docs/fast-bowler-generation/coach-crosscheck.json',
  JSON.stringify({ oldOvr, newOvr, worths, oldRows, newRows }, null, 1));
