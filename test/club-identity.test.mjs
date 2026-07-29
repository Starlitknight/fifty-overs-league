/* test/club-identity.test.mjs — ONE DEVICE, ONE CLUB.
 *
 * The bug this locks down: a manager opening the game saw two different
 * squads and two different fixture lists minutes apart, because between the
 * two renders the device was two different clubs.
 *
 * The cause was that identity was an INDEX. userTeam() returned
 * GD.teams[App.teamIx], and in a league GD.teams is replaced wholesale every
 * time a snapshot lands - while the snapshot carries the teamIx of WHOEVER
 * PUSHED IT (the founder, the resolver, another manager taking over a bot).
 * restoreFrom() adopted that index verbatim, so a restore could silently hand
 * you somebody else's club; the takeover splice and its ninety-minute
 * watchdog could do it again later in the same session.
 *
 * The fix is that the NAME is the identity, pinned on this device, and the
 * index is derived from it on every read. These tests drive the real shipped
 * globals through exactly the sequences that used to break.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEngine } from './engine-vm.mjs';

const { ctx } = makeEngine();
const run = (src) => ctx.eval ? ctx.eval(src) : evalIn(src);
import vm from 'node:vm';
function evalIn(src) { return vm.runInContext(src, ctx); }

/** A league world: ten clubs, mine among them, each with a real squad. */
function world(names) {
  return names.map((n, i) => ({
    name: n, ground: n + ' Park', founded: i < 4, bank: 300000, seats: 9000,
    supporters: 5000, mood: 3, homePitch: 'balanced', youth: [],
    players: [{ name: n + ' Player', role: 'opener', age: 25, rating: 40000, skills: {}, bowlTypeFull: 'none' }],
  }));
}
const LEAGUE = ['Somerset', 'Warwickshire', 'Thunder Emperor', 'Mashed Potatoes', 'Kent',
  'Durham', 'Middlesex', 'Nottinghamshire', 'Essex', 'Orange Club'];
const MINE = 'Mashed Potatoes';

/** Hand the engine a snapshot as restoreFrom sees one. */
function snapOf(teams, teamIx) {
  ctx.__t = { v: 2, seasonNo: 1, teamIx: teamIx, teams: teams, results: [], round: 1, season: null };
  return evalIn('restoreFrom(__t)');
}
const who = () => evalIn('(userTeam()||{}).name');
const ix = () => evalIn('App.teamIx');
const pinned = () => evalIn('foMyClub()');

test('the identity helpers ship', () => {
  for (const f of ['foMyClub', 'foSetMyClub', 'foMyClubIx', 'userTeam', 'restoreFrom']) {
    assert.equal(evalIn(`typeof ${f}`), 'function', `${f} is missing from the built game`);
  }
});

test('pinning a club makes userTeam() answer by name, not by index', () => {
  evalIn(`GD.teams = ${JSON.stringify(world(LEAGUE))}; App.teamIx = 0;`);
  evalIn(`foSetMyClub(${JSON.stringify(MINE)})`);
  assert.equal(pinned(), MINE);
  assert.equal(who(), MINE);
  assert.equal(ix(), LEAGUE.indexOf(MINE), 'the index is kept in step with the name');
});

test("a snapshot's own teamIx cannot hand you somebody else's club", () => {
  // THE ORIGINAL BUG, exactly: the founder pushed a season while sitting on
  // club 2 (Thunder Emperor). Every member restoring it used to become
  // Thunder Emperor.
  evalIn(`foSetMyClub(${JSON.stringify(MINE)})`);
  evalIn('App.teamIx = 0;');
  snapOf(world(LEAGUE), 2);
  // App.teamIx FIRST, before anything calls userTeam() and repairs it: plenty
  // of screens read the index straight (the fixture list asks "is this match
  // mine?" by comparing slot numbers), so the restore itself has to land it
  // on the right club rather than leave it for the next reader to notice.
  assert.equal(evalIn('App.teamIx'), LEAGUE.indexOf(MINE),
    'restoreFrom left the index on the pusher’s slot');
  assert.equal(evalIn(`GD.teams[App.teamIx].name`), MINE);
  assert.equal(who(), MINE, 'the restore adopted the pusher’s club');
});

test('restoring the same season over and over never moves you', () => {
  // the takeover watchdog re-splices for ninety minutes, calling
  // applySnapshot each time; a manager mid-session must not change clubs
  evalIn(`foSetMyClub(${JSON.stringify(MINE)})`);
  for (const pusherIx of [0, 7, 2, 9, 4, 1]) {
    snapOf(world(LEAGUE), pusherIx);
    assert.equal(who(), MINE, `restore with teamIx ${pusherIx} moved the club`);
  }
});

test('a reordered world still finds you — the index means nothing', () => {
  evalIn(`foSetMyClub(${JSON.stringify(MINE)})`);
  const shuffled = LEAGUE.slice().reverse();
  snapOf(world(shuffled), 0);
  assert.equal(who(), MINE);
  assert.equal(ix(), shuffled.indexOf(MINE), 'the index followed the club to its new slot');
});

test('a world that does not contain your club leaves the pin alone', () => {
  // a relaunched league, or a snapshot pushed before your join spliced you in:
  // fall back to the index rather than crash, and REMEMBER who you are, so the
  // next snapshot that does contain you puts you back
  evalIn(`foSetMyClub(${JSON.stringify(MINE)})`);
  const other = ['Alpha CC', 'Beta CC', 'Gamma CC'];
  snapOf(world(other), 1);
  assert.equal(pinned(), MINE, 'the snapshot overwrote this device’s club');
  assert.equal(who(), 'Beta CC', 'with no club of yours present, the old index still answers');
  snapOf(world(LEAGUE), 8);
  assert.equal(who(), MINE, 'the club did not come back when the league did');
});

test('a takeover renames a bot to your club, and you follow the name', () => {
  // foJoinRunningSeason rewrites a bot's name to yours across the whole
  // snapshot and pins the name before applying it
  evalIn(`foSetMyClub("Late Joiners CC")`);
  const taken = LEAGUE.slice(); taken[6] = 'Late Joiners CC';       // Middlesex was the bot
  snapOf(world(taken), 3);                                          // pusher sat on slot 3
  assert.equal(who(), 'Late Joiners CC');
  assert.equal(ix(), 6);
});

test('the pin survives a reload — it lives in its own storage key', () => {
  evalIn(`foSetMyClub(${JSON.stringify(MINE)})`);
  assert.equal(ctx.localStorage.getItem('fo_my_club'), MINE);
  // simulate a fresh page: forget the cached value, re-read from storage
  evalIn('FO_MY_CLUB = null; FO_MY_CLUB_READ = false;');
  assert.equal(pinned(), MINE);
  evalIn(`GD.teams = ${JSON.stringify(world(LEAGUE))}; App.teamIx = 0;`);
  assert.equal(who(), MINE);
});

test('a device with no club pinned behaves exactly as it always did', () => {
  evalIn('FO_MY_CLUB = null; FO_MY_CLUB_READ = true;');            // never pinned
  evalIn(`GD.teams = ${JSON.stringify(world(LEAGUE))};`);
  snapOf(world(LEAGUE), 5);
  assert.equal(ix(), 5, 'with nothing pinned the snapshot index is still honoured');
  assert.equal(who(), LEAGUE[5]);
});

test('founding a club pins it', () => {
  // founderConfirm builds the squad into a slot and names the club; from then
  // on the device is that club by name
  evalIn('FO_MY_CLUB = null; FO_MY_CLUB_READ = true;');
  evalIn(`GD.teams = ${JSON.stringify(world(LEAGUE))}; App.teamIx = 3;
    App.founder = { name: 'Wanderers CC', budget: 1000000,
      picked: [{ name: 'A B', role: 'opener', age: 24, rating: 40000, skills: {}, bowlTypeFull: 'none', fee: 0 }] };
    founderConfirm();`);
  assert.equal(pinned(), 'Wanderers CC');
  assert.equal(who(), 'Wanderers CC');
  // and a season pushed by anybody else cannot take it away
  const withMe = LEAGUE.slice(); withMe[3] = 'Wanderers CC';
  snapOf(world(withMe), 0);
  assert.equal(who(), 'Wanderers CC');
});
