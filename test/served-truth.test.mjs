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
import { readFileSync } from 'node:fs';

const { ctx } = makeEngine();
const run = (src) => vm.runInContext(src, ctx);

const P = () => ctx.__foPlanet;
const DAY = 86400000;

/** A served snapshot in the shape computeLeague() publishes. */
function snapshot({ nat = 'eng', startDay, seasonNo = 1, roundsPlayed = 0, results = [] }) {
  const names = ['Essex', 'Orange Club', 'Mashed Potatoes', 'Thunder Emperor', 'Kent',
    'Durham', 'Middlesex', 'Nottinghamshire', 'Somerset', 'Surrey'];
  return {
    country: nat, seasonNo, startDay, rounds: 14, roundsPlayed,
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

  // and the rest of the season walks from the same anchor - the pyramid week
  // is Mon Tue . Thu Fri, so the season's third day (a Wednesday) rests and
  // its fourth plays round 3
  assert.equal(ctx.__foWT.serverCal(P().EPOCH + 3 * DAY).round, 2);
  assert.equal(ctx.__foWT.serverCal(P().EPOCH + 4 * DAY).round, null, 'day 2 of a season rests - internationals');
  assert.equal(ctx.__foWT.serverCal(P().EPOCH + 5 * DAY).round, 3);

  // the world founded on day 0 is unchanged - the anchor is the general case,
  // not a special one
  P().anchorWorld(0, 1);
  assert.equal(ctx.__foWT.serverCal(P().EPOCH).round, 1);
  assert.equal(ctx.__foWT.serverCal(P().EPOCH + 3 * DAY).round, 3);
});

test('a season that has bowled no balls is round 1, with a poisoned save saying 3', () => {
  seat(snapshot({ nat: 'eng', startDay: 2 }));
  assert.equal(ctx.__foServed.on(), true, 'a claim plus a snapshot means the world speaks here');
  assert.equal(ctx.__foServed.roundsPlayed(), 0);
  assert.equal(ctx.__foServed.round(), 1, 'nothing played, so round 1 is next');
  assert.equal(ctx.__foServed.totalRounds(), 14);
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

// ---- ANY CRICKETER IN THE WORLD -------------------------------------------
// findPlayer searches the clubs THIS DEVICE holds, which is right for training
// and orders and wrong for reading. A national squad is fifteen men from ten
// clubs, and nineteen nations' squads are browsable: a foreign cricketer has
// to open too.
test('a cricketer this device employs opens by name alone', () => {
  assert.equal(typeof ctx.foFindAnyPlayer, 'function');
  const mine = run('(GD.teams[App.teamIx].players[0]||{}).name');
  assert.ok(mine, 'this device employs somebody');
  const hit = ctx.foFindAnyPlayer(mine);
  assert.ok(hit && hit.p, 'found without being told which club');
  assert.equal(hit.p.name, mine);
});

test('a foreign cricketer opens when the link names his club', () => {
  // a real man from a real Pakistan club, derived exactly as the umpire
  // generated him - the same call the theatre replays a match with
  const squad = ctx.__foWT.serverSquad('pak', 4);
  assert.ok(squad && squad.length >= 11, 'Pakistan slot 4 has a squad');
  const him = squad[3].name;
  assert.equal(run(`(typeof findPlayer === 'function' && findPlayer(${JSON.stringify(him)})) ? 1 : 0`), 0,
    'and he plays in no club this device holds');

  const hit = ctx.foFindAnyPlayer(him, 'pak', 4);
  assert.ok(hit && hit.p, 'yet he opens');
  assert.equal(hit.p.name, him);
  assert.ok(hit.p.rating > 0 && hit.p.role, 'as a whole cricketer, not a name');
  assert.equal(hit.world.rid, 'pak');
  assert.equal(hit.world.slot, 4);
  assert.ok(hit.team && hit.team.name, 'and his club is named');
});

test('a bare foreign name is not guessed at', () => {
  const him = ctx.__foWT.serverSquad('pak', 4)[3].name;
  assert.equal(ctx.foFindAnyPlayer(him), null,
    'nineteen leagues hold thousands of men - without his club, showing one would be showing the wrong one');
  assert.equal(ctx.foFindAnyPlayer(him, 'pak', 7), null, 'and he is not at that club either');
  assert.equal(ctx.foFindAnyPlayer('', 'pak', 4), null);
  assert.equal(ctx.foFindAnyPlayer(null), null);
});

/* ---- THE SQUAD IS THE WORLD'S, SIGNED IN OR NOT ---------------------------
 * The eleven a manager saw was the eleven his BROWSER made up at founding -
 * men who play for no club on earth - and it stayed that way through every
 * login. The served squad reached the device down one road only, world_my_
 * status, which is an authenticated call; a browser holding a claim but no
 * live session therefore adopted nothing, ever, and painted its own invention
 * back at him forever.
 *
 * world_squads is public, exactly like the standings. These lock the pull to
 * that road: no session in any of them, and the men it hands over are men the
 * device could not have invented.                                          */
// the real adopter, kept so the stubs below can hand it back - a stub left
// standing would quietly answer for every later test in this file
const REAL_ADOPT = ctx.__foAdoptWorldSquad;
const restoreAdopt = () => { ctx.__foAdoptWorldSquad = REAL_ADOPT; };

function stubSquadFetch(rows, seenUrls) {
  ctx.fetch = (url, opts) => {
    if (seenUrls) seenUrls.push({ url, opts });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(rows) });
  };
}
const XV = names => names.map((name, i) => ({
  name, age: 25 + (i % 7), rating: 80 - i, batting: 60, bowling: 40,
  keeper: i === 3, role: 'opener', type: 'none'
}));

test('a device with a claim and no session asks the world for its squad', async () => {
  const seen = [];
  stubSquadFetch([{ name: 'Mashed Potatoes', players: XV(
    ['Noah Hale', 'Tommy Bickley', 'Oscar Wright', 'Harry Prentice', 'Alfie Marsh',
     'George Ashby', 'Freddie Lang', 'Charlie Wood', 'Jack Fenner', 'Sam Rowntree',
     'Ollie Deakin']) }], seen);
  ctx.localStorage.setItem('fo_world_claim',
    JSON.stringify({ country: 'sco', slot: 5, club: 'Mashed Potatoes' }));
  run(`window.__foWorldClaim = { country: 'sco', slot: 5, club: 'Mashed Potatoes' };`);

  const got = [];
  run(`window.__foAdoptWorldSquad = function (st) { __adopted.push(st); return true; };`,
      ctx.__adopted = got);
  ctx.__foPullServedSquad(true);
  await new Promise(r => setImmediate(r));

  assert.equal(seen.length, 1, 'exactly one ask');
  assert.match(seen[0].url, /\/rest\/v1\/world_squads\?/, 'the public squads view');
  assert.match(seen[0].url, /country_id=eq\.sco/);
  assert.match(seen[0].url, /slot=eq\.5/);
  assert.ok(seen[0].opts && seen[0].opts.headers && seen[0].opts.headers.apikey,
    'with the anon key the standings already use - and NO bearer token, ' +
    'because being logged in is not what makes a squad public');
  assert.equal(seen[0].opts.headers.Authorization, undefined);

  assert.equal(got.length, 1, 'and it hands the men to the existing adopter');
  assert.equal(got[0].claim.country, 'sco');
  assert.equal(got[0].claim.slot, 5);
  assert.equal(got[0].squad[0].name, 'Noah Hale');
  assert.equal(got[0].squad.length, 11);
});

test('half a squad is not a squad: nothing is adopted from a short answer', async () => {
  const got = []; run(`window.__foAdoptWorldSquad = function (st) { __adopted2.push(st); };`,
    ctx.__adopted2 = got);
  for (const rows of [[], null, [{ name: 'X', players: XV(['A', 'B', 'C']) }],
                      [{ name: 'X', players: null }]]) {
    stubSquadFetch(rows);
    ctx.__foPullServedSquad(true);
    await new Promise(r => setImmediate(r));
  }
  assert.equal(got.length, 0, 'an eleven or nothing - never a half-emptied club');
});

test('a failed ask does not cost the device the rest of its session', async () => {
  const got = []; run(`window.__foAdoptWorldSquad = function (st) { __adopted3.push(st); };`,
    ctx.__adopted3 = got);
  ctx.fetch = () => { throw new Error('offline'); };
  ctx.__foPullServedSquad(true);
  await new Promise(r => setImmediate(r));
  assert.equal(got.length, 0);

  // the next ask must still go out: one bad minute used to wedge the in-flight
  // flag on and silence every later attempt
  stubSquadFetch([{ name: 'Mashed Potatoes', players: XV(
    ['Ada', 'Bea', 'Cal', 'Dai', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jed', 'Kit']) }]);
  ctx.__foPullServedSquad(true);
  await new Promise(r => setImmediate(r));
  assert.equal(got.length, 1, 'the world is asked again');
  assert.equal(got[0].squad.length, 11);
});

test('no claim, no ask: a solo device is not made to talk to the world', async () => {
  ctx.localStorage.removeItem('fo_world_claim');
  run(`window.__foWorldClaim = null;`);
  let asked = 0; ctx.fetch = () => { asked++; return new Promise(() => {}); };
  ctx.__foPullServedSquad(true);
  await new Promise(r => setImmediate(r));
  assert.equal(asked, 0);
});

/* ---- ONE DOOR, ONE SHAPE -------------------------------------------------
 * The world describes a cricketer at two resolutions. world_my_status sends
 * the engine's own player - fifteen skill facets, a numeric experience, a
 * bowling type. world_squads sends the public card: batting / bowling /
 * fielding summed up, form and experience as WORDS. Both were poured straight
 * into team.players, and every surface in the game reads the engine shape - so
 * a card landing there rendered NaN down the Bat column and sorted the squad
 * alphabetically, because Math.round(undefined) is how a missing skills block
 * announces itself.                                                        */
const CARD = {
  name: 'Noah Hale', nat: 'England', age: 29, batting: 47, bowling: 88, fielding: 75,
  ovr: 99, rating: 76902, type: 'seamFast', bowl: 'Left arm fast', hand: 'L',
  role: 'seamFast', keeper: false, exp: 'expert', form: 'shaky', fatigue: 'rested',
  wage: 3045, value: 349000, talents: ['bouncer'], career: { m: 1 }
};

test('a public card becomes an engine player, carrying the figures the world published', () => {
  const p = ctx.__foCardToPlayer(CARD);
  assert.ok(p.skills, 'he has a skills block at all - without one every aggregate is NaN');

  // the aggregates the whole game reads must give back the SERVED numbers, to
  // the number. Not close: the same. These are the game's own formulas.
  const S = p.skills;
  assert.equal(Math.round(.25 * S.vsPace + .25 * S.vsSpin + .2 * S.rotation +
    .15 * S.temperament + .15 * S.power), CARD.batting, 'aggBat is his published batting');
  assert.equal(Math.round((S.wicket + S.economy + S.discipline + S.moveTurn +
    S.variation + S.stamina) / 6), CARD.bowling, 'aggBowl is his published bowling');
  assert.equal(Math.round((S.fielding + S.catching) / 2), CARD.fielding,
    'aggField is his published fielding');
  assert.equal(Math.round((S.vsPace + S.vsSpin + S.temperament) / 3), CARD.batting,
    'and technique does not wander off on its own');

  // the fields the engine shape needs, translated rather than dropped
  assert.equal(p.bowlTypeFull, 'seamFast');
  assert.equal(p.bowlType, 'fast', 'he bowls, so the Bowl column is a figure and not a dash');
  assert.equal(p.btLabel, 'Left arm fast');
  assert.equal(p.fee, 349000, 'his value is the fee the rest of the game asks for');
  assert.equal(p.expWord, 'expert', 'the world\'s own word, kept verbatim');
  assert.equal(p.formWord, 'shaky');
  assert.equal(p.formIx, 2, 'and read back onto the scale the game colours by');
  assert.ok(Number.isFinite(p.exp) && p.exp > 0, 'experience is a number, not the word NaN');
  assert.equal(p.__card, 1, 'and he knows he is only a card');
  assert.equal(p.__ovr, 99);

  // a man who does not bowl is not given an attack
  const bat = ctx.__foCardToPlayer(Object.assign({}, CARD,
    { name: 'Oscar Wright', type: 'none', bowl: 'Does not bowl', bowling: 2 }));
  assert.equal(bat.bowlType, null, 'no bowling type, so no bowling figure is claimed for him');
  assert.equal(bat.btLabel, 'Does not bowl');
});

test('an engine player passing through the door is not touched', () => {
  const real = { name: 'Real', skills: { vsPace: 71 }, bowlType: 'fast', exp: 64 };
  assert.equal(ctx.__foCardToPlayer(real), real, 'the full shape is returned as it came');
  assert.equal(ctx.__foCardToPlayer(null), null);
  assert.equal(ctx.__foCardToPlayer({}), null, 'a nameless man is nobody');
});

test('every figure the squad page prints for a card is a real number', () => {
  // the exact failure in the screenshot: NaN down the Bat column, and a table
  // that claimed to be sorted by OVR sitting in alphabetical order because
  // (NaN - NaN) is not a comparison
  const p = ctx.__foCardToPlayer(CARD);
  const cols = ['aggBat', 'aggBowl', 'aggTech', 'aggField', 'aggKeep', 'foPkOvr'];
  for (const fn of cols) {
    const v = run(fn + '(__probeMan)', ctx.__probeMan = p);
    assert.ok(Number.isFinite(v), fn + ' returns a number for a card player, got ' + v);
  }
  assert.equal(run('foPkOvr(__probeMan)'), 99,
    'and his OVR is the world\'s own, not one re-derived from a flattened block');
});

test('a card never displaces the real thing, and the real thing always displaces a card', () => {
  // Both roads land here, unordered, whichever the network answers first.
  // Comparing NAMES alone made them indistinguishable, so whichever arrived
  // first won - and a card arriving first locked the full squad out for the
  // rest of the session.
  const men = n => Array.from({ length: 15 }, (_, i) =>
    ({ name: 'M' + i, age: 25, role: 'opener', keeper: i === 3, rating: 100 - i, wage: 9, value: 9,
       batting: 40, bowling: 10, fielding: 40, ovr: 50 - i, type: 'none', bowl: 'Does not bowl',
       exp: 'average', form: 'steady', nat: n }));
  const cards = men('England').map(ctx.__foCardToPlayer);
  const full = cards.map(c => Object.assign({}, c, { skills: Object.assign({}, c.skills, { vsPace: 71 }) }));
  full.forEach(p => { delete p.__card; delete p.__ovr; });

  restoreAdopt();
  ctx.localStorage.setItem('fo_world_claim', JSON.stringify({ country: 'eng', slot: 2, club: 'X' }));
  run(`window.__foWorldClaim = { country: 'eng', slot: 2, club: 'X' };`);
  const t = run('userTeam()');
  const claim = { country: 'eng', slot: 2, club: t.name };
  const apply = squad => {
    ctx.__st = { claim, squad };
    return run('__foAdoptWorldSquad(__st)');
  };
  const held = () => (run('userTeam()').players || []);

  assert.equal(apply(cards), true, 'the card squad is adopted when there is nothing better');
  assert.equal(held().length, 15);
  assert.ok(held()[0].__card, 'and it is known to be only a card');

  apply(full);
  assert.ok(!held().some(p => p.__card), 'the full squad displaces it, same men or not');
  assert.equal(held()[0].skills.vsPace, 71, 'and the real facets are what is held');

  apply(cards);
  assert.ok(!held().some(p => p.__card), 'the card cannot take it back');
  assert.equal(held()[0].skills.vsPace, 71, 'not one facet is lost to it');
});

// ---- ONE MARK, ONE COLOUR ---------------------------------------------------
// A screenshot of a live scorecard carried three of the same star: slate grey
// beside two batters, warm grey in the XI card, and the proper red under Did
// not bat. Measured in a browser against the shipped stylesheet:
//
//   batting row   rgb(121,128,142)  10.5px
//   XI card       rgb(179,171,153)  11px, squashed to a 13px column
//   everywhere    rgb(200,16,46)    13.1px
//
// Nothing was wrong with the star. It is a single <i>, and the surfaces it is
// dropped into style their own bare <i> - a dismissal line, a shirt number -
// with selectors three classes deep. A badge is one class and loses all of
// them. This is not one careless rule either: the build ships hundreds that
// end on a bare i, and the next surface will add another.
//
// So the mark cannot win on specificity and must not try. It holds what it is
// instead, and these two assertions are the whole guarantee: the hazard is
// real, and every declaration the star makes is one it keeps.
test('the international star cannot be repainted by the room it stands in', () => {
  const built = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const asset = built.match(/<script[^>]+src=["']([^"']*fo-[^"']+\.js)["']/);
  const css = asset
    ? built + readFileSync(new URL('../' + asset[1], import.meta.url), 'utf8')
    : built;

  // the rule as it actually ships, source concatenation and all
  const rule = /\.fo-nat\{((?:[^{}]|"\s*\+\s*"|\n|\s)*?)\}/.exec(css.replace(/"\s*\+\s*\n?\s*"/g, ''));
  assert.ok(rule, 'the star ships a rule of its own');
  const decls = rule[1].split(';').map(d => d.trim()).filter(Boolean);
  assert.ok(decls.length >= 8, 'and it says what the star is: ' + decls.length + ' declarations');
  const naked = decls.filter(d => !/!\s*important$/.test(d));
  assert.deepEqual(naked, [], 'every one of them is held against the room');

  // and the room really does reach for the element - a guard nobody can break
  // is a guard nobody needed
  const bareI = [...css.matchAll(/([^{}"';\n]+)\{([^{}"'\n]*)\}/g)]
    .filter(m => m[1].split(',').some(s => /(^|[\s>+~])i$/.test(s.trim())));
  const repaint = bareI.filter(m => /(^|;)\s*(color|font|font-size)\s*:/.test(m[2]));
  assert.ok(repaint.length > 5,
    'the build styles the bare element all over: ' + repaint.length + ' rules recolour or resize an <i>');
});
