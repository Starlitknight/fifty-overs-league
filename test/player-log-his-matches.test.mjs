// test/player-log-his-matches.test.mjs — A LOG IS A RECORD OF WHAT A MAN PLAYED.
//
// A cricketer scouted out of the academy this morning opened his page and
// found five matches his new club had played before he existed to it, every
// one of them marked "no recorded involvement" - which was true, and told him
// nothing, because he had not been there to be involved.
//
// A card names both elevens whatever they did with the day: the batting card
// seats all eleven in their order, and xi/bxi carry the teamsheets beside
// them. So the card can answer the question the log actually asks.
import { test } from 'node:test';
import assert from 'node:assert';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const line = (card, club, name) => eng.ctx.foPlayerMatchLine(card, { [club]: 1 }, name);

const A = { name: 'Ashgrove', ground: 'The Meadow', players: eng.genSquad(4711, 'England', 'balanced').players };
const B = { name: 'Barrowfield', ground: 'The Oval', players: eng.genSquad(9182, 'England', 'balanced').players };
const CARD = eng.sim(A, B, 'balanced', 'Sunny', 20260812);
const inns = CARD.innings;
const batted = inns.filter(i => i.batTeam === A.name)[0];
const bowled = inns.filter(i => i.bowlTeam === A.name)[0];

test('a man who was never in the side is not in his own log', () => {
  const l = line({ innings: inns }, A.name, 'Ollie Ogden');
  assert.equal(l.played, false, 'a name the card never mentions did not play');
  assert.equal(l.bat, ''); assert.equal(l.bowl, ''); assert.equal(l.ct, 0);
});

test('a man who was picked is in it, whatever the day gave him', () => {
  // every one of the eleven, including whoever never got to the crease
  batted.bat.forEach(b => {
    const l = line({ innings: inns }, A.name, b.p.name);
    assert.equal(l.played, true, b.p.name + ' was in the side');
  });
  assert.equal(batted.bat.length, 11, 'and the side was eleven men');
});

test('a card banked before the teamsheets were kept still knows who played', () => {
  // xi/bxi are recent; the batting card has seated all eleven since the first
  // ball of the world, which is what this leans on
  const noSheets = JSON.parse(JSON.stringify(inns)).map(i => { delete i.xi; delete i.bxi; return i; });
  batted.bat.forEach(b => assert.equal(line({ innings: noSheets }, A.name, b.p.name).played, true,
    b.p.name + ' is still known to have played'));
  assert.equal(line({ innings: noSheets }, A.name, 'Ollie Ogden').played, false);
});

test('and a teamsheet alone is enough for the side that only bowled', () => {
  const one = [Object.assign({}, bowled, { bxi: ['Ollie Ogden'] })];
  const l = line({ innings: one }, A.name, 'Ollie Ogden');
  assert.equal(l.played, true, 'named in the bowling eleven and nothing else');
  assert.equal(l.bowl, '', 'with nothing to show for it');
});

test('did not bat is not nought not out', () => {
  const dnb = batted.bat.filter(b => !(b.b > 0) && !b.out)[0];
  if (dnb) {
    const l = line({ innings: inns }, A.name, dnb.p.name);
    assert.equal(l.played, true, dnb.p.name + ' was in the side');
    assert.equal(l.bat, '', 'a man who never faced a ball has no figures, not "0* (0)"');
  }
  // and a man who did bat carries his
  const did = batted.bat.filter(b => b.b > 0)[0];
  assert.ok(did, 'somebody batted');
  const l2 = line({ innings: inns }, A.name, did.p.name);
  assert.match(l2.bat, /^\d+\*? \(\d+\)$/, 'his figures read as figures: ' + l2.bat);
});

test('the bowlers and the fielders carry theirs too', () => {
  const bowler = Object.keys(bowled.bowlers)[0];
  const l = line({ innings: inns }, A.name, bowler);
  assert.equal(l.played, true);
  assert.match(l.bowl, /^\d+-\d+ \(/, bowler + ' has an analysis: ' + l.bowl);
  const held = Object.keys(bowled.fielding || {}).filter(k => (bowled.fielding[k].ct | 0) > 0)[0];
  if (held) assert.ok(line({ innings: inns }, A.name, held).ct > 0, held + ' held one');
});
