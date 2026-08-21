// a-club-can-always-field-a-side.test.mjs — THE ROSTER CONTINUITY INVARIANT.
//
// EVERY ACTIVE CLUB MUST ALWAYS BE ABLE TO FIELD A LEGAL XI, and until the
// repair this file guards, one could not.
//
// THE DEFECT, in one asymmetry. market.mjs guards SQUAD_FLOOR = 13 in two
// places and both are about a club CHOOSING to lose a man: a bot will not list
// itself below it, and a sale will not complete if the seller would drop under
// it. Retirement is not a transaction, passes neither guard, and youth.ageYouth
// had no replacement path at all - it filtered out everyone who reached
// RETIRE_AT and wrote the shorter squad back. The one mechanism that could have
// refilled is switched off for exactly the clubs it happens to: botBid returns 0
// for a posture of 'dangerous' or 'critical', before squad shortage is ever
// consulted, so a club in trouble cannot sign the eleventh man it needs.
//
// ELEVEN IS THE SIMULATOR'S OWN NUMBER, measured rather than chosen
// (tools/roster-legality.mjs): eleven men play, ten throw inside stepBall
// reading a striker that was never picked. Role does not enter into it - an
// eleven with no keeper plays, an eleven with no specialist bowler plays, and
// eleven batters play. So the invariant is a COUNT, and the repair stops at
// ROSTER_MIN = 11 rather than at SQUAD_FLOOR = 13: restoring to the transaction
// floor would hand a distressed club two free bench players it never earned.
//
// PROVING IT FAILS ON MAIN. The first test walks the OLD law by hand - the
// exact three lines ageYouth used to be - and asserts that it produces a club
// the engine cannot play. That is the regression: if a future change makes the
// old law safe again, this test says so out loud rather than passing quietly.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { ageYouth, ensurePlayableSquad, ROSTER_MIN, RETIRE_AT } from '../youth.mjs';
import { SQUAD_FLOOR } from '../market.mjs';
import { botBid } from '../market.mjs';
import { POSTURE_POLICY } from '../botfinance.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DB = 'foroster_test';
let pool, host;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: T0, host });
});
after(async () => { if (pool) await pool.end(); });

const canPlay = squad => {
  const opp = host.derive(host.genSquad('roster|opp', 'England', 'balanced', 'general', 1, 'd2a') || []);
  try {
    const r = JSON.parse(host.runMatch({ name: 'Short', players: squad },
      { name: 'Opp', players: opp }, 'fair', 99, {}, 'Sunny', false));
    return !!(r && r.winner);
  } catch (e) { return false; }
};

// a squad of `n` men, all old enough that `retire` of them will hang up
const squadOf = (n, retiring) => {
  const men = host.derive(host.genSquad('roster|src', 'England', 'balanced', 'general', 1, 'd2a') || []);
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = JSON.parse(JSON.stringify(men[i % men.length]));
    p.name = 'Man ' + i;                       // distinct men, so nothing dedupes
    p.pid = 'r' + i;
    p.age = i < retiring ? RETIRE_AT : 26;     // the first `retiring` are done
    out.push(p);
  }
  return out;
};

test('the OLD law leaves a club that cannot take the field (fails on main)', async () => {
  // the three lines ageYouth was, before the repair: a year on, retire the old,
  // write it back. No replacement anywhere.
  const before11 = squadOf(12, 2);
  const older = before11.map(p => ({ ...p, age: (p.age || 27) + 1 }));
  const afterOld = older.filter(p => (p.age || 0) < RETIRE_AT);

  assert.equal(before11.length, 12, 'the club started with a side and a bench');
  assert.equal(afterOld.length, 10, 'two men retired and nothing replaced them');
  assert.ok(afterOld.length < ROSTER_MIN,
    'which is below the simulator\'s minimum of ' + ROSTER_MIN);
  assert.equal(canPlay(afterOld), false,
    'and the engine cannot play a side of ' + afterOld.length + ' - THIS is the defect');

  // and the same squad, repaired, plays
  const fixed = ensurePlayableSquad(host, 'eng', afterOld, 'proof|seed').squad;
  assert.equal(fixed.length, ROSTER_MIN, 'the repair restores exactly eleven');
  assert.equal(canPlay(fixed), true, 'and eleven men can take the field');
});

test('the repair adds exactly max(0, 11 - what is left), and never more', () => {
  // section 8's table, verbatim. An off-by-one here is a club with a free man.
  const cases = [
    [12, 1, 11, 0],   // 12 -> one retires -> 11: no emergency man
    [12, 2, 11, 1],   // 12 -> two retire  -> 10: one
    [11, 1, 11, 1],   // 11 -> one retires -> 10: one
    [15, 3, 12, 0],   // 15 -> three retire -> 12: none
    [15, 5, 11, 1],   // 15 -> five retire -> 10: one
    [15, 7, 11, 3],   // 15 -> seven retire -> 8: three
    [15, 0, 15, 0]    // nobody retires: nothing happens at all
  ];
  for (const [size, retiring, wantSize, wantAdded] of cases) {
    const sq = squadOf(size, retiring);
    const older = sq.map(p => ({ ...p, age: (p.age || 27) + 1 }));
    const left = older.filter(p => (p.age || 0) < RETIRE_AT);
    assert.equal(left.length, size - retiring,
      size + ' men, ' + retiring + ' retiring, leaves ' + (size - retiring));
    const fix = ensurePlayableSquad(host, 'eng', left, 'bound|' + size + '|' + retiring);
    assert.equal(fix.added.length, wantAdded,
      size + ' -> ' + retiring + ' retire -> ' + left.length
      + ': expected ' + wantAdded + ' emergency men, got ' + fix.added.length);
    assert.equal(fix.squad.length, wantSize,
      size + ' -> ' + retiring + ' retire: squad should end at ' + wantSize);
  }
});

test('the repair stops at eleven and not at the transaction floor of thirteen', () => {
  assert.equal(ROSTER_MIN, 11, 'the simulator minimum is eleven');
  assert.equal(SQUAD_FLOOR, 13, 'the transaction floor is untouched at thirteen');
  assert.ok(ROSTER_MIN < SQUAD_FLOOR, 'and they are deliberately different numbers');
  const fix = ensurePlayableSquad(host, 'eng', squadOf(8, 0), 'floor|seed');
  assert.equal(fix.squad.length, ROSTER_MIN,
    'a club repaired from eight lands on eleven, NOT on ' + SQUAD_FLOOR
    + ' - two extra men would be a subsidy, not a safety fix');
});

test('an emergency man cannot be worth having', () => {
  // section 5: if letting the squad rot paid, it would become the strategy.
  const fix = ensurePlayableSquad(host, 'eng', squadOf(6, 0), 'exploit|seed');
  assert.ok(fix.added.length >= 5, 'this club needed several men');
  for (const m of fix.added) {
    const card = (m.rating || 0) / 1000;
    assert.ok(card < 25,
      'an emergency man is a nobody: OVR ' + card.toFixed(0) + ' should be far under 25');
    assert.ok((m.wage || 0) <= 2000,
      'and he earns near the floor, not ' + m.wage);
    // he is a SENIOR, not a colt on the senior books
    assert.equal(m.colt, undefined, 'the academy flag is stripped');
    assert.equal(m.yseed, undefined, 'and so is the hidden growth seed');
  }
});

test('the rollover itself restores every club, and nothing it wrote can be short', async () => {
  // the real shipped path, on a real world: strip several clubs to the bone and
  // age the country a year.
  const clubs = (await pool.query(
    `SELECT slot, squad FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  for (const c of clubs.slice(0, 4)) {
    // twelve men, three of them at retirement age: the rollover will take them
    // to nine, which no engine can play
    const cut = (c.squad || []).slice(0, 12).map((p, i) =>
      ({ ...p, age: i < 3 ? RETIRE_AT - 1 : 26 }));
    await pool.query(`UPDATE clubs SET squad=$3::jsonb WHERE country_id=$1 AND slot=$2`,
      ['eng', c.slot, JSON.stringify(cut)]);
  }
  const out = await ageYouth(pool, 'eng', 1, host);
  assert.ok(out.retired >= 12, 'the men we aged did retire (' + out.retired + ')');
  assert.ok(out.emergency > 0, 'and the repair had to sign somebody');

  const after = (await pool.query(
    `SELECT slot, squad FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  const short = after.filter(c => (c.squad || []).length < ROSTER_MIN);
  assert.equal(short.length, 0,
    'no club is left under ' + ROSTER_MIN + ': ' + short.map(c => c.slot + '=' + c.squad.length).join(', '));
  // and the repaired clubs can actually play, which is the point of all of it
  for (const c of after.slice(0, 4)) {
    assert.equal(canPlay(host.derive(c.squad)), true,
      'slot ' + c.slot + ' (' + c.squad.length + ' men) can take the field');
  }
});

test('the market guards are exactly as they were', () => {
  // section 9: transaction safety is 13 and simulation safety is 11, and the
  // repair must not have blurred them. botBid still refuses a distressed club.
  assert.equal(SQUAD_FLOOR, 13);
  assert.equal(POSTURE_POLICY.dangerous.buys, 'none');
  assert.equal(POSTURE_POLICY.critical.buys, 'none');
  const listing = { id: 1, asking: 100000, buyerKey: 'eng:15' };
  const squad = squadOf(11, 0);
  const player = { rating: 60000, wage: 16000, role: 'batter', bowlTypeFull: 'none' };
  for (const posture of ['dangerous', 'critical']) {
    assert.equal(
      botBid(listing, squad, 5000000, player, { policy: POSTURE_POLICY[posture], perRoundIncome: 400000 }),
      0, 'a ' + posture + ' club still bids nothing, repair or no repair');
  }
  assert.ok(
    botBid(listing, squad, 5000000, player, { policy: POSTURE_POLICY.healthy, perRoundIncome: 400000 }) > 0,
    'and a healthy one still bids');
});
