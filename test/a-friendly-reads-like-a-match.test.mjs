/* A FRIENDLY'S SCORECARD IS A SCORECARD.
 *
 * A league match's record is regenerated from the banked seed, so its innings
 * are the engine's own objects. A friendly has no banked living patch, so its
 * record is REBUILT BY PARSING the umpire's commentary - and a rebuilt innings
 * must come out in the same shape the engine writes, because every scorecard
 * view reads that shape and nothing else.
 *
 * What went wrong, ball by ball, on a real phone:
 *   - the fall of wickets printed "undefined-0, undefined-7, ..." all the way
 *     down, because the walk pushed the wicket number as `wkt` while the
 *     engine writes `w` and the renderer reads `f.w`;
 *   - the bowling table was headed "Bowling ()", because the walk never set
 *     `bowlTeam` and the renderer prints it;
 *   - no bowler wore his type tag and no man his stars, because the walk
 *     built every player as a bare {name} and the decorations read the man
 *     himself - bowlTypeFull and hand for the tag, skills for the stars.
 *
 * So this file holds the contract: parse a friendly's log, and demand the
 * engine's innings shape back, with the served clubs' real men on the card.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const get = name => vm.runInContext(name, eng.ctx);

// the umpire's log for a tiny two-innings friendly, oldest events LAST because
// the RPC serves newest first and the parser reverses it back
const LOG = [
  // ---- second innings (newest first in the wire order) ----------------------
  { inn: 1, out: '4', txt: 'FOUR! Kane drives.', strikerNm: 'Kane Keeper', bowlerNm: 'Sam Seamer', no: '18.1' },
  { inn: 1, out: '1', txt: 'single.', strikerNm: 'Vic Vickers', bowlerNm: 'Sam Seamer', no: '17.6' },
  // ---- first innings --------------------------------------------------------
  { inn: 0, _top: true, out: '●', txt: 'End of over 2 (5 runs, 1 wkt) - Mashed Potatoes 9/1. Sam Seamer 1-5-1.', no: '' },
  { inn: 0, out: '', txt: 'Partnership ends at 9 - Bob Batter out for 8 (7). Mashed Potatoes 9/1.', no: '' },
  { inn: 0, out: 'wC', txt: 'OUT! caught.', strikerNm: 'Bob Batter', bowlerNm: 'Sam Seamer',
    ev: { fldNm: 'Frank Fielder' }, no: '2.3' },
  { inn: 0, out: '4', txt: 'FOUR!', strikerNm: 'Bob Batter', bowlerNm: 'Sam Seamer', no: '2.2' },
  { inn: 0, out: '2', txt: 'two runs.', strikerNm: 'Bob Batter', bowlerNm: 'Sam Seamer', no: '2.1' },
  { inn: 0, out: '2', txt: 'two more.', strikerNm: 'Bob Batter', bowlerNm: 'Spin Sirvan', no: '1.2' },
  { inn: 0, out: '1', txt: 'worked away.', strikerNm: 'Alf Opener', bowlerNm: 'Spin Sirvan', no: '1.1' },
  { inn: 0, out: '▶', txt: 'Toss: Somerset won the toss and chose to bowl. Played with sunny conditions and a balanced pitch.', no: '' },
].reverse().reverse();   // document the wire order without changing it

const REC = { id: 18,
  home: { name: 'Mashed Potatoes', slot: 8, country: 'eng' },
  away: { name: 'Somerset', slot: 9, country: 'eng' },
  playAtMs: 1786800000000, log: LOG };

// the served squads the parser trades names against - engine-shaped men, the
// way the adoption door in 52-served-truth hands them over
const MEN = {
  8: [{ name: 'Bob Batter', hand: 'R', bowlTypeFull: 'none', bowlType: null, role: 'batter',
        keeper: false, pid: 'p-bob', talents: [], skills: { vsPace: 40, vsSpin: 40, power: 40 } },
      { name: 'Alf Opener', hand: 'L', bowlTypeFull: 'none', bowlType: null, role: 'batter',
        keeper: false, pid: 'p-alf', talents: [], skills: { vsPace: 35, vsSpin: 35, power: 30 } }],
  9: [{ name: 'Sam Seamer', hand: 'R', bowlTypeFull: 'seamFast', bowlType: 'fast', role: 'bowler',
        keeper: false, pid: 'p-sam', talents: [], skills: { wicket: 60, economy: 55, stamina: 50 } },
      { name: 'Spin Sirvan', hand: 'L', bowlTypeFull: 'fingerSpin', bowlType: 'fingerSpin', role: 'bowler',
        keeper: false, pid: 'p-spin', talents: [], skills: { wicket: 55, economy: 60, stamina: 45 } }],
};
vm.runInContext('window.__foWT = window.__foWT || {}', eng.ctx);
eng.ctx.window.__foWT.serverSquad = (rid, slot) => (rid === 'eng' ? MEN[slot] : null) || null;

const rec = get('window.foMrRecFromFriendly')(REC, 'Somerset win by 6 wickets');
const inn0 = rec.innings[0];

test('the record exists and knows both sides', () => {
  assert.ok(rec && rec.friendly, 'a friendly record came back');
  assert.equal(inn0.batTeam, 'Mashed Potatoes');
  assert.equal(rec.result.winner, 'Somerset');
});

test('the fall of wickets speaks the engine\'s key, and it is a number', () => {
  assert.equal(inn0.fow.length, 1, 'one wicket fell');
  const f = inn0.fow[0];
  assert.equal(f.w, 1, 'the wicket number is `w` - the key every scorecard reads');
  assert.equal(f.sc, 9, 'at the score the umpire printed');
  assert.equal(f.who, 'Bob Batter');
  assert.ok(!('wkt' in f), 'and the misspelt key is gone, not kept alongside');
  // the exact line the phone printed as "undefined-0": rendered off this
  // entry it must carry no "undefined" anywhere
  assert.doesNotMatch(String(f.w) + '-' + String(f.sc), /undefined/);
});

test('the bowling table knows whose bowling it is', () => {
  assert.equal(inn0.bowlTeam, 'Somerset', 'the side not batting is bowling');
  assert.equal(rec.innings[1].bowlTeam, 'Mashed Potatoes');
});

test('the card carries the men, not just their names', () => {
  const sam = inn0.bowlers['Sam Seamer'];
  assert.ok(sam, 'the bowler is on the card');
  assert.equal(sam.p.bowlTypeFull, 'seamFast', 'his type tag can be drawn');
  assert.equal(sam.p.hand, 'R', 'and his arm');
  assert.ok(sam.p.skills, 'and his stars have skills to read');
  assert.equal(sam.p.pid, 'p-sam', 'and his page can be opened by id');
  const bob = inn0.bat.find(b => b.p.name === 'Bob Batter');
  assert.ok(bob.p.skills, 'a batter is enriched the same way');
  // his figures are still the umpire's, not the squad's
  assert.equal(bob.r, 8); assert.equal(bob.b, 7);
});

test('a man the world no longer holds stays a bare name, never a wrong man', () => {
  // Vic Vickers and Kane Keeper bat in the second innings but are in neither
  // served squad - sold, retired, or renamed since the friendly was played
  const inn1 = rec.innings[1];
  const vic = inn1.bat.find(b => b.p.name === 'Vic Vickers');
  assert.ok(vic, 'he is still on the card');
  assert.ok(!vic.p.skills, 'with nothing invented about him');
});

test('the parse survives a world with no served squads at all', () => {
  const noWT = get('window.foMrRecFromFriendly');
  eng.ctx.window.__foWT.serverSquad = () => { throw new Error('world offline'); };
  const rec2 = noWT(REC, '');
  assert.ok(rec2, 'the record still builds');
  assert.equal(rec2.innings[0].fow[0].w, 1, 'with the engine-shaped fall intact');
  assert.equal(rec2.innings[0].bowlTeam, 'Somerset');
  // restore for any later file sharing this VM
  eng.ctx.window.__foWT.serverSquad = (rid, slot) => (rid === 'eng' ? MEN[slot] : null) || null;
});
