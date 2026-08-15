// no-old-rung-survives.test.mjs — THE OLD RATING UNIVERSE CANNOT COME BACK.
//
// B2 replaced one mechanism with another, and the replaced one is the kind that
// creeps back: calibrate() was a small, obvious, working function that reached a
// stated club strength in four lines, and every argument for calling it again is
// locally reasonable. The reasons it must not be called are not local at all.
//
//   IT AIMED AT A DEAD QUANTITY. Its target was a RATING - BASE_XI x a ladder
//   multiplier, anchored at 36,000, "the old world's median XI rating". Rating
//   is the canonical card times a thousand now, so the world's median XI reads
//   about 60,000 and 36,000 describes a club of part-timers. Any surviving
//   caller does not merely use an old constant; it drags whatever it touches
//   down onto a scale nothing else in the game is on.
//
//   IT FLATTENED THE MEN. Four passes of multiply-every-skill-and-re-measure,
//   clamping each attribute at 2 and 99 every pass, is what pressed the world's
//   fielding into a band from 20 to 56 and made the spatial fielding contest
//   unreachable. B1 measured that; B2's whole generation model exists because of
//   it.
//
//   IT WAS A FEEDBACK LOOP. It fed a rating target back into the skills the
//   rating was computed from, so widening any input bell made it scale harder,
//   which narrowed the bell again.
//
// The last production caller was tick.mjs levelNewClaims - a club somebody had
// just claimed, levelled at BASE_XI x NAT_STR x HUMAN_STR (28,628 in a full
// member, 25,336 in an associate). It is laid on the newcomer TIER now, by the
// identical engine function that lays a newly founded club.
//
// So this file reads the source. A behaviour test can only catch a rung that
// changed an outcome it happens to look at; this catches the mechanism coming
// back at all, which is the thing that has to be prevented.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeHost } from '../enginehost.mjs';
import { countryConfigs, squadFor, tierOfClub, TIER_XI_BAND } from '../init-world.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HERE, '..');
// every module the umpire actually runs. Tests are excluded on purpose: a test
// is allowed to name a retired constant in order to say it is retired.
const PRODUCTION = fs.readdirSync(SERVER)
  .filter(f => f.endsWith('.mjs'))
  .map(f => ({ name: f, src: fs.readFileSync(path.join(SERVER, f), 'utf8') }));

// the comments in this repo explain at length why things were removed, and that
// prose is the documentation rather than a violation - so every scan below reads
// the CODE, with the comments taken out first
const codeOf = src => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
  .filter(l => !/^\s*\/\//.test(l)).join('\n');

test('no production module calls a calibration pass', () => {
  const guilty = [];
  for (const { name, src } of PRODUCTION) {
    if (/\bcalibrate\s*\(/.test(codeOf(src))) guilty.push(name);
  }
  assert.deepEqual(guilty, [],
    'calibrate() is retired; a squad is laid on a tier (init-world tierOfClub, engine foLayOnTier)');
});

test('and the constants of the old rating ladder are gone from the umpire', () => {
  // THE NAMES, because a name is how a dead idea gets re-imported. Each of these
  // was a figure on the pre-B2 rating scale, and none of them can be given a
  // meaning in the canonical world without redefining the canonical world.
  const RETIRED = ['BASE_XI', 'HUMAN_STR', 'PT4', 'NAT_TEAM_XI', 'ASSOC_TEAM_XI', 'nationTeamStr'];
  const guilty = [];
  for (const { name, src } of PRODUCTION) {
    const code = codeOf(src);
    for (const r of RETIRED)
      if (new RegExp('\\b' + r + '\\b').test(code)) guilty.push(name + ' still names ' + r);
  }
  assert.deepEqual(guilty, [], 'the old ladder is not reachable from production code');
});

test('and no rung number of the old world is written down as a target', () => {
  // The literals themselves. 36,000 was the median XI; 28,628 and 25,336 were
  // the newcomer's rung in a full member and an associate; 26,000 was where the
  // old ladder inverted. A number is only evidence when it appears as a target,
  // so this looks for it in code rather than in the prose that buried it.
  const DEAD = [36000, 28628, 25336, 25704];
  const guilty = [];
  for (const { name, src } of PRODUCTION) {
    const code = codeOf(src);
    for (const d of DEAD)
      if (new RegExp('\\b' + d + '\\b').test(code)) guilty.push(name + ' still writes ' + d);
  }
  assert.deepEqual(guilty, [], 'no module aims at a rung of the retired ladder');
});

// ---- AND THE PATH ITSELF, MEASURED RATHER THAN READ ------------------------
//
// The source scan says the mechanism is gone. This says the REPLACEMENT does
// what the mechanism was there for, on the club a person actually claims, with
// no database in the way: every seat in the world, laid on the newcomer curve,
// has to land in the newcomer's band and stay the same fifteen men.
test('a club claimed from any seat on earth lands in the newcomer world', () => {
  const host = makeHost();
  const cfgs = countryConfigs(host);
  const xiCard = sq => {
    const o = host.pkOvr(sq).slice().sort((a, b) => b - a).slice(0, 11);
    return o.reduce((s, v) => s + v, 0) / o.length;
  };
  // A CLAIMED CLUB CARRIES SOMEBODY ELSE'S AGE STRUCTURE, and the band it is
  // measured against was taken over squads the generator dealt fresh. A mark is
  // a peak now, so a man's place is his tier's mark adjusted for how far through
  // his career he is - which means a flagship squad of thirty-four-year-olds
  // re-laid onto the newcomer rung lands a little under a newcomer squad of
  // twenty-five-year-olds, and correctly so. One card of slack either side
  // covers the age mixes the 256 seats actually contain; measured, the worst is
  // 30.8 against a band that starts at 31, and the claim being made here - that
  // a seat cannot carry its old strength through a claim - is untouched by it.
  const [lo, hi] = [TIER_XI_BAND.newcomer[0] - 1, TIER_XI_BAND.newcomer[1] + 1];
  const out = [];
  let seats = 0, richest = 0;
  for (const cfg of cfgs) {
    for (const club of cfg.clubs) {
      const men = squadFor(host, cfg, club, 1);
      richest = Math.max(richest, xiCard(men));
      const laid = host.layOnTier(men, 'newcomer', 'claim|' + cfg.id + '|' + club.slot);
      const xi = xiCard(laid);
      if (!(xi >= lo && xi <= hi))
        out.push(cfg.id + ':' + club.slot + ' (' + tierOfClub(cfg, club) + ') -> ' + xi.toFixed(1));
      seats++;
    }
  }
  assert.equal(seats, 256, 'every seat in the world was tried');
  assert.ok(richest > hi + 20, 'and the seats really do differ: the best deals ' + richest.toFixed(1));
  assert.deepEqual(out, [], 'every claimed seat lands in the newcomer band ' + lo + '-' + hi);
});

test('and levelling him twice is levelling him once, to a card', () => {
  // THE PROPERTY calibrate() COULD NOT HAVE. It measured a squad and pushed it
  // at a target, so a second pass on an already-levelled squad was a second
  // push, and a third was a third. The laying reads each man's mark off the
  // tier's curve from a seed that is the club, and hands the marks out in order,
  // so every pass fits the same man to the same mark.
  //
  // TO A CARD, and the distinction is honest rather than convenient: the fit
  // bisects a factor and then rounds every attribute to an integer, so
  // re-solving from already-rounded skills can land a point either side. It
  // jitters inside one card and never walks - measured to six passes below, the
  // number of skill points that move settles at about a dozen and no card ever
  // moves by more than one. calibrate()'s second pass, by contrast, moved a
  // squad's whole XI.
  const host = makeHost();
  const cfg = countryConfigs(host).find(c => c.id === 'eng');
  const club = cfg.clubs.find(c => c.slot === 4);
  const men = squadFor(host, cfg, club, 1);
  let prev = host.layOnTier(men, 'newcomer', 'claim|eng|4');
  const first = host.pkOvr(prev);
  for (let pass = 2; pass <= 6; pass++) {
    const next = host.layOnTier(JSON.parse(JSON.stringify(prev)), 'newcomer', 'claim|eng|4');
    assert.deepEqual(next.map(p => p.name), prev.map(p => p.name),
      'pass ' + pass + ' kept the same men in the same order');
    const cards = host.pkOvr(next);
    cards.forEach((c, i) => assert.ok(Math.abs(c - first[i]) <= 1,
      'pass ' + pass + ': ' + next[i].name + ' moved from ' + first[i] + ' to ' + c));
    prev = next;
  }
});

test('and it is the same fifteen men who walked in', () => {
  // The board's investment raises the squad; it does not replace it. A levelling
  // that redealt the club would satisfy every band above and be the worst bug
  // this path could have.
  const host = makeHost();
  const cfg = countryConfigs(host).find(c => c.id === 'aus');
  const club = cfg.clubs.find(c => c.boss);           // the richest seat there is
  const before = squadFor(host, cfg, club, 1);
  const after = host.layOnTier(JSON.parse(JSON.stringify(before)), 'newcomer', 'claim|aus|0');
  assert.deepEqual(after.map(p => p.name), before.map(p => p.name), 'the same names');
  assert.deepEqual(after.map(p => p.age), before.map(p => p.age), 'the same ages');
  assert.deepEqual(after.map(p => p.role), before.map(p => p.role), 'the same roles');
  assert.deepEqual(after.map(p => p.bowlTypeFull), before.map(p => p.bowlTypeFull), 'the same attack');
  assert.deepEqual(after.map(p => !!p.keeper), before.map(p => !!p.keeper), 'the same gloves');
  // and he really has been brought down to earth
  const card = sq => host.pkOvr(sq).slice().sort((a, b) => b - a).slice(0, 11)
    .reduce((s, v) => s + v, 0) / 11;
  assert.ok(card(before) - card(after) > 25,
    'a flagship squad claimed as a new club is a new club (' +
    card(before).toFixed(1) + ' -> ' + card(after).toFixed(1) + ')');
});
