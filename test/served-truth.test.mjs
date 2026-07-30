/* test/served-truth.test.mjs — THE LEAGUE FACTS COME FROM THE WORLD.
 *
 * The bug this locks down: a manager's front door said "3rd in the England
 * League · Round 3 of 18" with six form beads, on the morning of a world that
 * had been redealt and restarted and had not yet bowled a ball. Nothing was
 * wrong on the server. Two separate things on the device were:
 *
 *   1. THE CALENDAR ASSUMED THE WORLD BEGAN ON DAY 0. serverCal() worked the
 *      round out from the date alone, so a season restarted on world day 2
 *      read day 2 as the season's third day and announced round 3. The umpire
 *      records a start_day per season; the client never asked for it.
 *
 *   2. THE PAGE READ THE LOCAL BLOB. The table, the form strip and the round
 *      came from App.results / App.season - the retired single-player engine's
 *      record, which lives in this browser and survives a world restart.
 *
 * These tests drive the SHIPPED globals. The local blob is deliberately
 * poisoned in every one of them: if a served fact ever falls back to it again,
 * the poison shows up in the assertion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEngine } from './engine-vm.mjs';
import vm from 'node:vm';

const { ctx } = makeEngine();
const run = (src) => vm.runInContext(src, ctx);

const P = () => ctx.__foPlanet;
const DAY = 86400000;

/** A served snapshot in the shape computeLeague() publishes. */
function snapshot({ nat = 'eng', startDay, seasonNo = 1, roundsPlayed = 0, results = [] }) {
  const names = ['Essex', 'Orange Club', 'Mashed Potatoes', 'Thunder Emperor', 'Kent',
    'Durham', 'Middlesex', 'Nottinghamshire', 'Somerset', 'Surrey'];
  return {
    country: nat, seasonNo, startDay, rounds: 18, roundsPlayed,
    table: names.map((name, i) => ({
      slot: i, name, boss: i === 0, p: 0, w: 0, l: 0, t: 0, pts: 0, nrr: 0
    })),
    results, stats: {}, champion: null, generatedAtDay: startDay
  };
}

/** Seat this device in the served world, holding `snap`, and poison the local
 *  save with a season three rounds old and six results it never played.
 *  Each test seats a DIFFERENT nation: the feed caches one body per nation for
 *  the life of the page, exactly as it does in a browser, so re-seating the
 *  same nation would read the previous test's snapshot back. */
function seat(snap, { slot = 2 } = {}) {
  const nat = snap.country;
  ctx.localStorage.setItem('fo_world_lg_' + nat, JSON.stringify(snap));
  ctx.localStorage.setItem('fo_world_claim',
    JSON.stringify({ country: nat, slot, club: snap.table[slot].name }));
  run(`window.__foWorldClaim = { country: ${JSON.stringify(nat)}, slot: ${slot}, club: ${JSON.stringify(snap.table[slot].name)} };`);
  ctx.__poison = {
    round: 3,
    results: [0, 1, 2, 3, 4, 5].map(i => ({
      home: snap.table[slot].name, away: 'Ghost CC ' + i, round: i,
      result: { winner: i % 3 === 0 ? snap.table[slot].name : 'Ghost CC ' + i, text: 'ghost' }
    }))
  };
  run(`App.results = __poison.results.slice();
       App.season = App.season || {};
       App.season.round = __poison.round;
       App.season.schedule = App.season.schedule || new Array(18).fill(0).map(function () { return []; });`);
}

test('the world service and the served accessor both ship', () => {
  assert.equal(typeof ctx.__foServed, 'object', '__foServed must be installed');
  for (const f of ['on', 'rows', 'form', 'round', 'roundsPlayed', 'totalRounds',
                   'startDay', 'opensIn', 'ballAt', 'fixtures'])
    assert.equal(typeof ctx.__foServed[f], 'function', '__foServed.' + f);
  assert.equal(typeof P().anchorWorld, 'function', 'the planet must accept an anchor');
  assert.equal(typeof P().anchorOf, 'function');
});

test('the calendar is anchored by the world, not assumed from the date', () => {
  // A world redealt and restarted on day 2: day 2 IS the opening day, so the
  // round played on it is round 1. The old arithmetic read day 2 as the
  // season's third day and answered 3 - the exact number on the screenshot.
  P().anchorWorld(2, 1);
  const cal = ctx.__foWT.serverCal(P().EPOCH + 2 * DAY);
  assert.equal(cal.seasonNo, 1);
  assert.equal(cal.dayInSeason, 0, 'day 2 is day ZERO of a season that opened on day 2');
  assert.equal(cal.round, 1, 'the opening day plays round 1, whatever the date says');

  // and the rest of the season walks from the same anchor: three rounds, a
  // rest day, three rounds - so world day 5 is the season's rest day
  assert.equal(ctx.__foWT.serverCal(P().EPOCH + 4 * DAY).round, 3);
  assert.equal(ctx.__foWT.serverCal(P().EPOCH + 5 * DAY).round, null, 'day 3 of a season rests');
  assert.equal(ctx.__foWT.serverCal(P().EPOCH + 6 * DAY).round, 4);

  // the world founded on day 0 is unchanged - the anchor is the general case,
  // not a special one
  P().anchorWorld(0, 1);
  assert.equal(ctx.__foWT.serverCal(P().EPOCH).round, 1);
  assert.equal(ctx.__foWT.serverCal(P().EPOCH + 2 * DAY).round, 3);
});

test('a season that has bowled no balls is round 1, with a poisoned save saying 3', () => {
  seat(snapshot({ nat: 'eng', startDay: 2 }));
  assert.equal(ctx.__foServed.on(), true, 'a claim plus a snapshot means the world speaks here');
  assert.equal(ctx.__foServed.roundsPlayed(), 0);
  assert.equal(ctx.__foServed.round(), 1, 'nothing played, so round 1 is next');
  assert.equal(ctx.__foServed.totalRounds(), 18);
  assert.equal(ctx.__foServed.startDay(), 2);
  // the local save still says three, and is still not consulted
  assert.equal(run('App.season.round'), 3);
});

test('the form strip is the banked cards and nothing else', () => {
  seat(snapshot({ nat: 'ire', startDay: 2 }));
  assert.equal(ctx.__foServed.form().length, 0,
    'a club that has played nothing has no form - not the six results in the local blob');
  assert.equal(run('App.results.length'), 6, 'the poison is genuinely there');

  // once the world HAS played, the strip is the world's, oldest first
  seat(snapshot({
    nat: 'aus', startDay: 2, roundsPlayed: 2,
    results: [
      { round: 1, home: 'Mashed Potatoes', away: 'Kent', winner: 'Kent' },
      { round: 0, home: 'Essex', away: 'Mashed Potatoes', winner: 'Mashed Potatoes' }
    ]
  }));
  assert.deepEqual([...ctx.__foServed.form()], ['W', 'L'], 'oldest first, by the world\'s round');
  assert.equal(ctx.__foServed.round(), 3, 'two played, so round three is next');
});

test('leagueRows() is the served table, for every caller in the game', () => {
  seat(snapshot({ nat: 'nzl', startDay: 2 }));
  const rows = run('leagueRows()');
  assert.equal(rows.length, 10);
  assert.equal(rows[0].nm, 'Essex');
  assert.ok(rows.every(r => r.p === 0 && r.pts === 0),
    'every club has played nothing, exactly as the world reports it');
  // the local implementation is kept for solo and practice worlds
  assert.equal(typeof run('leagueRows.__foServed'), 'number');
});

test('a fixture is dated by the world, at the nation\'s own hour', () => {
  seat(snapshot({ nat: 'eng', startDay: 2 }));   // England opens at 14:00 UTC
  const r1 = ctx.__foServed.ballAt(0);
  // England opens at 14:00 UTC; round 1 of a season starting on day 2 is day 2
  assert.equal(r1, P().EPOCH + 2 * DAY + 14 * 3600000);
  // round 4 is the season's fourth PLAYING day, which is world day 6 - the
  // rest day sits between, so it is not simply "three days later"
  assert.equal(ctx.__foServed.ballAt(3), P().EPOCH + 6 * DAY + 14 * 3600000);
});

test('the next fixtures are the world\'s own draw, starting at the round it will play', () => {
  seat(snapshot({ nat: 'rsa', startDay: 2, roundsPlayed: 2 }));
  const fx = ctx.__foServed.fixtures(3);
  assert.equal(fx.length, 3);
  assert.equal(fx[0].round, 2, 'two rounds are banked, so the next one is index 2');
  assert.equal(fx[0].roundNo, 3);
  assert.ok(fx[0].opp.name && fx[0].opp.slot !== 2);
  assert.ok(fx.every(f => f.home.slot === 2 || f.away.slot === 2), 'every fixture is ours');
  assert.deepEqual([...fx].map(f => f.round), [2, 3, 4], 'consecutive, in the umpire\'s order');
});

test('no claim, no served truth: the solo world keeps its own league', () => {
  ctx.localStorage.removeItem('fo_world_claim');
  run('window.__foWorldClaim = null;');
  assert.equal(ctx.__foServed.on(), false);
  assert.equal(ctx.__foServed.rows().length, 0);
  assert.equal(ctx.__foServed.form().length, 0);
  assert.equal(ctx.__foServed.ballAt(0), null, 'nothing to date without a world');
});

// ---- THE RED STAR ---------------------------------------------------------
// The umpire names a fifteen for every nation before every round and the
// naming rides in the league snapshot. These prove the client reads it, and
// that a man who is NOT in the squad never gets a mark.
function withNat(nat) {
  const s = snapshot({ nat: 'pak', startDay: 2 });
  s.nat = nat;
  return s;
}

test('a named international is starred; nobody else is', () => {
  seat(withNat({
    round: 3,
    squad: [{ pick: 0, slot: 2, name: 'Ada Blake', age: 27, rating: 61000, keeper: true, bowler: false },
            { pick: 1, slot: 5, name: 'Cyrus Vale', age: 24, rating: 58000, keeper: false, bowler: true }],
    in: ['Cyrus Vale'], out: ['Otis Hall']
  }));
  const S = ctx.__foServed;
  assert.equal(S.natRound(), 3);
  assert.equal(S.natSquad().length, 2);
  assert.equal(S.isNat('Ada Blake'), true);
  assert.equal(S.isNat('Cyrus Vale'), true);
  assert.equal(S.isNat('Otis Hall'), false, 'a man just dropped is no longer an international');
  assert.equal(S.isNat(''), false);
  assert.equal(S.isNat(null), false);

  // exact by club: two men can share a name in one league and only one is capped
  assert.equal(S.isNatAt(2, 'Ada Blake'), true);
  assert.equal(S.isNatAt(7, 'Ada Blake'), false, 'the Ada Blake at another club is not the capped one');

  const mark = ctx.foNatStar('Ada Blake', 2);
  assert.match(mark, /fo-nat/, 'the star carries its class');
  assert.match(mark, /9733|★/, 'and is a star');
  assert.equal(ctx.foNatStar('Otis Hall', 2), '', 'an uncapped man gets no mark at all');
  assert.equal(ctx.foNatStar('Ada Blake', 7), '', 'nor does the wrong club\'s namesake');
});

test('no world, no star: the solo game is unmarked', () => {
  ctx.localStorage.removeItem('fo_world_claim');
  run('window.__foWorldClaim = null;');
  assert.equal(ctx.__foServed.on(), false);
  assert.equal(ctx.__foServed.natSquad().length, 0);
  assert.equal(ctx.__foServed.isNat('Ada Blake'), false);
  assert.equal(ctx.foNatStar('Ada Blake', 2), '',
    'a founding squad in a world nobody has joined has no internationals to mark');
});
