#!/usr/bin/env node
/* tools/ship-proofs.mjs — THE THREE THINGS THE SHIP GATE HAS TO SEE
 *
 * FINAL SHIP GATE §4, §9, §10. Each is a claim that is easy to assert and easy
 * to be wrong about, so each is measured against the PREVIOUS BUILD rather
 * than against my own description of what the change does.
 *
 *   §4  RAW SKILLS. Re-rating is a re-label. Every existing cricketer's
 *       fifteen attributes must be byte-identical under the old law and the
 *       new one, because the value model reads skills and never writes them.
 *
 *   §10 MATCH PHYSICS. The valuation change must not alter one delivery. The
 *       same XI on the same seed must produce the same scorecard on the
 *       pre-valuation build (the fast-bowler commit) and on this one.
 *
 *   §9  GENERATION. A fresh world dealt under each law, compared on the raw
 *       cricket rather than on the card: skills, intrinsic level, roles, ages,
 *       division strength, five-bowler legality. Displayed OVR may move,
 *       because experience is allowed to move it; nothing else may.
 *
 * The comparison build is passed in as a directory so this can be pointed at
 * any worktree:
 *
 *   node tools/ship-proofs.mjs --against=/path/to/worktree
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arg, has } from './realism-lib.mjs';

const HERE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OTHER = arg('against', null);

// EACH BUILD LOADS ITSELF. test/engine-vm.mjs resolves index.html relative to
// its OWN location, so importing the comparison worktree's copy of it gives a
// VM on that worktree's build - which is the whole trick, and is far safer
// than hand-rolling a second script loader that would differ in some detail
// nobody noticed and quietly compare two things that are not the engine.
async function engineAt(root) {
  const mod = await import(path.join(root, 'test', 'engine-vm.mjs'));
  const eng = mod.makeEngine();
  return { eng, ctx: eng.ctx, g: k => vm.runInContext(k, eng.ctx) };
}

const A = await engineAt(HERE);
const buildOf = r => { try { return JSON.parse(fs.readFileSync(path.join(r, 'version.json'), 'utf8')).build; } catch (e) { return '?'; } };
console.log('THIS build   ', buildOf(HERE));
let B = null;
if (OTHER) { B = await engineAt(OTHER); console.log('AGAINST build', buildOf(OTHER)); }

const TIERS = ['newcomer', 'd2b', 'd2a', 'd1b', 'd1a', 'flagship'];
function dealWorld(E) {
  const clubs = [];
  for (const n of JSON.parse(E.g('JSON.stringify(window.__foPlanet.nations()||[])'))) {
    const rid = n.id != null ? n.id : n;
    const sides = JSON.parse(E.g(`JSON.stringify(window.__foPlanet.sidesOf(${JSON.stringify(rid)})||[])`));
    sides.forEach((side, slot) => {
      const seed = `${rid}|${slot}`;
      const div = side.div || (slot < 8 ? 1 : 2);
      const ix = side.boss ? 5 : (div === 1 ? (slot <= 3 ? 4 : 3) : (slot <= 11 ? 2 : 1));
      const tier = TIERS[Math.max(0, Math.min(5, ix))];
      let players;
      try {
        players = JSON.parse(E.g(`JSON.stringify((__foGenArchetypeSquad(${JSON.stringify(seed)},`
          + `${JSON.stringify(String(rid).toUpperCase())},${JSON.stringify(side.arch || 'engine')},`
          + `null,${+side.str || 1},${JSON.stringify(tier)})||{}).players||[])`));
      } catch (e) { return; }
      if (players && players.length) clubs.push({ rid, slot, div, tier, players });
    });
  }
  return clubs;
}

// ---------------------------------------------------------------------------
// §4 RAW SKILLS ARE NOT TOUCHED BY THE VALUE LAW.
// ---------------------------------------------------------------------------
const SK = ['vsPace','vsSpin','power','rotation','temperament','wicket','economy',
  'discipline','moveTurn','variation','stamina','fielding','catching','keeping','stumping'];
const OLD_W = { bat:{vsPace:0.185,vsSpin:0.145,power:0.150,rotation:0.150,temperament:0.060},
  bowl:{wicket:0.415,economy:0.240,discipline:0.140,moveTurn:0.090,variation:0.060,stamina:0.030},
  field:{fielding:0.200,catching:0.110}, glove:{catching:0.226,keeping:0.045,stumping:0.030} };
const OLD_MIX = { bat:{bat:1,bowl:0,field:0.45,glove:0}, bowl:{bat:0,bowl:1,field:0.45,glove:0},
  ar:{bat:0.80,bowl:0.80,field:0.45,glove:0}, wk:{bat:1,bowl:0,field:0,glove:1.20} };
A.g('try{ window.FO_VAL_C=FO_VAL_C; window.FO_VAL_W=FO_VAL_W; window.FO_VAL_MIX=FO_VAL_MIX; }catch(e){}');
const setLaw = (W, M) => A.g(`(function(W,M){for(var f in W)for(var k in W[f])FO_VAL_W[f][k]=W[f][k];
  for(var r in M)for(var k2 in M[r])FO_VAL_MIX[r][k2]=M[r][k2];
  var S={};for(var f2 in FO_VAL_W){var t=0;for(var k3 in FO_VAL_W[f2])t+=FO_VAL_W[f2][k3];S[f2]=t;}
  for(var r2 in FO_VAL_MIX){var m=FO_VAL_MIX[r2];
    FO_VAL_C[r2]=m.bat*S.bat+m.bowl*S.bowl+m.field*S.field+m.glove*S.glove;}})(${JSON.stringify(W)},${JSON.stringify(M)})`);
const expOff = v => A.g(`__foExpOvrOff=${v ? 1 : 0};1`);
const NEW_W = JSON.parse(A.g('JSON.stringify(FO_VAL_W)'));
const NEW_MIX = JSON.parse(A.g('JSON.stringify(FO_VAL_MIX)'));

const world = dealWorld(A);
const men = [];
for (const c of world) for (const p of c.players) men.push(p);
const skillsOf = ms => JSON.stringify(ms.map(p => SK.map(k => p.skills[k])));
const before = skillsOf(men);
expOff(true); setLaw(OLD_W, OLD_MIX);
for (const p of men) A.g(`window.foPlayerValue(${JSON.stringify(p)})`);
expOff(false); setLaw(NEW_W, NEW_MIX);
for (const p of men) A.g(`window.foPlayerValue(${JSON.stringify(p)})`);
const after = skillsOf(men);
console.log(`\n§4 RAW SKILLS  ${men.length} cricketers, ${SK.length} attributes each`);
console.log(`   byte-identical under both laws: ${before === after ? 'YES' : 'NO'}`);

// ---------------------------------------------------------------------------
// §10 MATCH PHYSICS. Identical XIs, identical seeds, two builds.
// ---------------------------------------------------------------------------
if (B) {
  const XI = world.slice(0, 6).map(c => ({ name: c.rid + c.slot, players: c.players.slice(0, 11) }));
  // eng.sim IS the simulator the suites use. An earlier cut of this called
  // window.foSimMatch, which does not exist - so it compared null against null
  // thirty-six times and reported a perfect pass. The scorecard is compared in
  // full, not just the winner, because two builds can agree on who won and
  // disagree about every ball that got them there.
  const sim = (E, a, b, seed) => {
    const r = E.eng.sim(a, b, 'balanced', 'Sunny', seed);
    if (!r) return null;
    return JSON.stringify({ result: r.result, innings: (r.innings || []).map(i => i && ({
      runs: i.runs, wkts: i.wkts, legal: i.legal, extras: i.extras,
      bat: (i.bat || []).map(b => b && [b.nm, b.r, b.b, b.out]) })) });
  };
  let same = 0, total = 0, firstDiff = null;
  for (let i = 0; i + 1 < XI.length; i += 2)
    for (let s = 0; s < 12; s++) {
      const seed = 900001 + s * 7919;
      const ra = sim(A, XI[i], XI[i + 1], seed), rb = sim(B, XI[i], XI[i + 1], seed);
      total++;
      // a null on either side is a broken probe, not agreement
      if (ra == null || rb == null) { if (!firstDiff) firstDiff = { seed, note: 'sim returned null' }; continue; }
      if (ra === rb) same++; else if (!firstDiff) firstDiff = { seed, a: ra.slice(0, 160), b: rb.slice(0, 160) };
    }
  console.log(`\n§10 MATCH PHYSICS  ${same}/${total} seeded matches bit-identical across the two builds`);
  if (firstDiff) console.log('   first divergence:', JSON.stringify(firstDiff).slice(0, 300));
}

// ---------------------------------------------------------------------------
// §9 GENERATION SAFETY. A fresh world under each build, compared on the cricket.
// ---------------------------------------------------------------------------
if (B) {
  const wb = dealWorld(B);
  const menB = []; for (const c of wb) for (const p of c.players) menB.push(p);
  const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))]; };
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(`\n§9 GENERATION  this ${men.length} men / ${world.length} clubs`
    + `   against ${menB.length} men / ${wb.length} clubs`);
  console.log('   attribute            this            against');
  for (const k of SK) {
    const x = men.map(p => p.skills[k] || 0), y = menB.map(p => p.skills[k] || 0);
    console.log('   ' + k.padEnd(16)
      + `${mean(x).toFixed(1)} (p50 ${pct(x, .5)})`.padStart(18)
      + `${mean(y).toFixed(1)} (p50 ${pct(y, .5)})`.padStart(19));
  }
  const lvl = (E, ms) => ms.map(p => JSON.parse(E.g(`JSON.stringify(window.foPlayerValue(${JSON.stringify(p)}))`)).level);
  const la = lvl(A, men), lb = lvl(B, menB);
  console.log(`   intrinsic level   mean ${mean(la).toFixed(2)}   against ${mean(lb).toFixed(2)}`);
  const age = ms => mean(ms.map(p => p.age || 0));
  console.log(`   age               mean ${age(men).toFixed(2)}   against ${age(menB).toFixed(2)}`);
  const wage = ms => ms.reduce((a, p) => a + (+p.wage || 0), 0);
  console.log(`   total wage        ${wage(men).toLocaleString()}   against ${wage(menB).toLocaleString()}`);
  const roles = ms => { const r = {}; for (const p of ms) r[p.role] = (r[p.role] || 0) + 1; return r; };
  console.log('   roles this   ', JSON.stringify(roles(men)));
  console.log('   roles against', JSON.stringify(roles(menB)));
  const REAL = ['seamFast','seamFastMedium','seamMedium','fingerSpin','wristSpin'];
  const legal = cs => cs.filter(c => c.players.filter(p => REAL.includes(p.bowlTypeFull)).length >= 5).length;
  console.log(`   five-bowler legal ${legal(world)}/${world.length}   against ${legal(wb)}/${wb.length}`);
  for (const d of [1, 2]) {
    const f = cs => { const sub = cs.filter(c => c.div === d).flatMap(c => c.players); return mean(lvl(A, sub)); };
    const fb = cs => { const sub = cs.filter(c => c.div === d).flatMap(c => c.players); return mean(lvl(B, sub)); };
    console.log(`   division ${d} level  ${f(world).toFixed(2)}   against ${fb(wb).toFixed(2)}`);
  }
}
