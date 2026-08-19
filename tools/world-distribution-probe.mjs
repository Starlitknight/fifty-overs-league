#!/usr/bin/env node
/* tools/world-distribution-probe.mjs — WHAT DOES THE WORLD ACTUALLY SERVE UP?
 *
 * PHASE 3 §7. A raw per-context value is not a weight. A point of vsSpin is
 * worth what it is worth against spin, TIMES how much spin a cricketer in this
 * world actually faces - and nobody knows that number by intuition, least of
 * all from the ten hard-coded grounds in the demo data.
 *
 * So it is asked of the shipped engine rather than assumed:
 *
 *   PITCH        __foPlanet.condOf is a pure function of (nation, home slot,
 *                season, round). Every fixture of a season in every nation is
 *                enumerated and the pitches tallied. No database needed and no
 *                sampling error - this IS the distribution.
 *   BOWLING TYPE squads are dealt by the engine's own generator across the
 *                tiers the world uses, and the bowlers' types are tallied by
 *                HEAD and, more usefully, by OVERS - a fifth bowler bowls as
 *                many overs as an opening bowler, so heads and overs agree
 *                here, but the head count is what a valuation would reach for
 *                by mistake if the two ever diverged.
 *   ROLE         the same deal, tallied by role.
 *
 * Chase and pressure frequency are NOT taken from here: they are properties of
 * matches rather than of the world's tables, and the attribute matrix already
 * splits its own reference cell by state on the seeds it actually played.
 *
 *   node tools/world-distribution-probe.mjs
 */
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';
import fs from 'node:fs';

const eng = makeEngine();
const g = k => vm.runInContext(k, eng.ctx);
const out = {};

// ---------------------------------------------------------------------------
// PITCHES. Every nation, every home slot, a full season of rounds.
// ---------------------------------------------------------------------------
const nations = g('(function(){try{var P=window.__foPlanet;return JSON.stringify((P.nations&&P.nations())||[])}catch(e){return "[]"}})()');
const NATS = JSON.parse(nations);
const pitch = {};
let fixtures = 0;
for (const n of NATS) {
  const rid = n.id != null ? n.id : n;
  const nSides = g(`(function(){try{return (window.__foPlanet.sidesOf(${JSON.stringify(rid)})||[]).length}catch(e){return 0}})()`);
  for (let slot = 0; slot < nSides; slot++)
    for (let round = 0; round < 14; round++) {
      const c = JSON.parse(g(`JSON.stringify(window.__foPlanet.condOf(${JSON.stringify(rid)},${slot},1,${round}))`));
      pitch[c.pitch] = (pitch[c.pitch] || 0) + 1;
      fixtures++;
    }
}
out.pitch = { fixtures, nations: NATS.length, counts: pitch,
  share: Object.fromEntries(Object.entries(pitch).map(([k, v]) => [k, v / fixtures])) };

// ---------------------------------------------------------------------------
// BOWLING TYPES AND ROLES. Not a sample of one archetype - EVERY SIDE THE
// WORLD HAS. The planet already knows each club's archetype and its standing,
// so each is dealt the squad the world would deal it and the types are tallied
// off the real population. An earlier cut of this probe generated 120 squads
// all on the "balanced" archetype and reported that the world contains no
// fast bowlers and no wrist spin at all, which is a fact about that one
// template rather than about the world.
// ---------------------------------------------------------------------------
const bt = {}, role = {}, btOvers = {};
let men = 0, squads = 0;
for (const n of NATS) {
  const rid = n.id != null ? n.id : n;
  const sides = JSON.parse(g(`JSON.stringify(window.__foPlanet.sidesOf(${JSON.stringify(rid)})||[])`));
  sides.forEach((side, slot) => {
    let players;
    try {
      players = JSON.parse(g(`JSON.stringify((__foGenArchetypeSquad(${7000 + slot},${JSON.stringify(String(rid).toUpperCase())},`
        + `${JSON.stringify(side.arch || 'engine')},null,${+side.str || 1},${JSON.stringify(side.tier || null)})||{}).players||[])`));
    } catch (e) { players = null; }
    if (!players || !players.length) return;
    squads++;
    for (const p of players) {
      men++;
      role[p.role] = (role[p.role] || 0) + 1;
      bt[p.bowlTypeFull || 'none'] = (bt[p.bowlTypeFull || 'none'] || 0) + 1;
    }
    // OVERS, not heads: the five men who actually bowl carry the fifty overs
    // between them, so the exposure a batsman meets is the type mix of the
    // FRONT LINE, not of the whole squad.
    const bowlers = players.filter(p => p.bowlTypeFull && p.bowlTypeFull !== 'none')
      .sort((a, b) => (b.skills.wicket + b.skills.economy) - (a.skills.wicket + a.skills.economy))
      .slice(0, 5);
    for (const p of bowlers) btOvers[p.bowlTypeFull] = (btOvers[p.bowlTypeFull] || 0) + 1;
  });
}
const tot = o => Object.values(o).reduce((a, b) => a + b, 0);
out.bowlType = { men, squads, heads: bt, frontLine: btOvers,
  frontShare: Object.fromEntries(Object.entries(btOvers).map(([k, v]) => [k, v / tot(btOvers)])) };
out.role = { men, counts: role };

// PACE VS SPIN, which is the one number §6 is waiting for
const isSpin = k => /Spin/.test(k);
const spinShare = tot(Object.fromEntries(Object.entries(btOvers).filter(([k]) => isSpin(k))))
  / Math.max(1, tot(btOvers));
out.exposure = { spinShare, paceShare: 1 - spinShare };

fs.writeFileSync('docs/player-value-realism/world-distribution.json', JSON.stringify(out, null, 1));
console.log('PITCH  ', JSON.stringify(out.pitch.share));
console.log('FRONT  ', JSON.stringify(out.bowlType.frontShare));
console.log('EXPOSURE spin', spinShare.toFixed(3), 'pace', (1 - spinShare).toFixed(3));
console.log('ROLES  ', JSON.stringify(out.role.counts));
