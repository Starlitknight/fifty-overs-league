// tests/a-banked-match-is-not-revised.test.mjs — HISTORY IS NOT REWRITTEN BY
// WHAT HAPPENS AFTERWARDS.
//
// A spectator's broadcast does not store the match. It regenerates it: take the
// club's squad as the world serves it now, lay the banked LIVING PATCH over it,
// and re-run the recorded seed with the recorded orders and conditions. The
// same cricket must come out, ball for ball. That makes the patch a contract -
// it has to own everything about a cricketer that the engine reads and the
// world is later entitled to change - and for a long time it did not.
//
// WHAT IT MISSED, AND HOW IT WAS FOUND. Ageing was added, and one banked round
// stopped replaying. The patch recorded skills as a DELTA against `baseSkills`,
// which was sound while nothing edited that baseline; `foAgeDecline` edits it
// deliberately, because a thirty-four-year-old's decline is what he IS. So
// every skill a man had NOT trained had no entry in the patch, and the replay
// rebuilt it from today's aged baseline. The patch also never recorded AGE,
// which the ball model reads directly. Instrumented against the exact team
// objects the umpire handed the engine, a banked round with one year laid over
// it came back: eight fixtures of eight diverged, 240 men a year older and
// ninety of them a point weaker, from the first delivery.
//
// A transfer is the same defect wearing different clothes: it takes a man off
// the selling club's books, so the replay turns out an eleven with a hole in it
// and the buyer picks from a squad containing somebody who was elsewhere that
// afternoon. Two fixtures of eight, measured the same way.
//
// So this file holds the invariant itself rather than any one of its bugs: bank
// a round, then do to the world every violent thing the world does to a
// cricketer, and demand the same cricket every time.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runTick } from '../tick.mjs';
import { applyLiving } from '../living.mjs';
import { ageYouth } from '../youth.mjs';
import { EPOCH, DAY, dayOfRound } from '../clock.mjs';

const DBNAME = 'foworld_banked_test';
let pool, host, season, ROUND = 3;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
  await initWorld(pool, { now: T0, host });
  const s = (await pool.query(
    `SELECT season_no, start_day FROM seasons WHERE country_id='eng' ORDER BY season_no DESC LIMIT 1`)).rows[0];
  season = s;
  for (let r = 1; r <= ROUND; r++) {
    const day = s.start_day + dayOfRound(r);
    await runTick(pool, host, 'eng', day, { now: EPOCH + day * DAY + 18 * 3600000 });
  }
});
after(async () => { await pool.end(); });

// THE MATCH, not the paperwork. The canonical blob carries harmless noise - a
// database reorders JSON keys, a career rides along - so what is compared is
// every ball of cricket: the result, and both innings man by man.
const facts = j => {
  const o = JSON.parse(j);
  return JSON.stringify({ w: o.winner, t: o.text, m: o.mom,
    i: (o.innings || []).map(inn => inn && ({ bt: inn.batTeam, r: inn.runs, w: inn.wkts, l: inn.legal,
      bat: (inn.bat || []).map(b => [(b.p && b.p.name) || b.p, b.r, b.b, b.out]),
      bowl: Object.entries(inn.bowlers || {}).map(([k, v]) => [k, v.w, v.r, v.b]).sort() })) });
};
const squadOf = async slot => (await pool.query(
  `SELECT squad FROM clubs WHERE country_id='eng' AND slot=$1`, [slot])).rows[0].squad;
const fixtures = async () => (await pool.query(
  `SELECT seed, round, home_name, away_name, home_slot, away_slot, pitch, orders, living, result_canonical
     FROM matches WHERE country_id='eng' AND season_no=$1 AND round=$2 AND living IS NOT NULL
     ORDER BY home_slot`, [season.season_no, ROUND])).rows;

// exactly what a phone does: the served squad, the banked patch, the recorded
// seed, pitch, sheets and sky
async function replayAll() {
  const ms = await fixtures();
  const bad = [];
  for (const m of ms) {
    const cond = host.condFor('eng', m.home_slot, season.season_no, m.round);
    const rp = host.runMatch(
      { name: m.home_name, players: applyLiving(await squadOf(m.home_slot), m.living[m.home_name], host) },
      { name: m.away_name, players: applyLiving(await squadOf(m.away_slot), m.living[m.away_name], host) },
      m.pitch, Number(m.seed), m.orders, cond.weather);
    if (facts(rp) !== facts(m.result_canonical)) bad.push(m.home_name + ' v ' + m.away_name);
  }
  return { n: ms.length, bad };
}
async function demand(when) {
  const { n, bad } = await replayAll();
  assert.equal(n, 8, 'the round banked its eight fixtures');
  assert.deepEqual(bad, [], n - bad.length + '/' + n + ' replay ' + when + '; diverged: ' + bad.join(', '));
}

test('the banked round replays ball for ball the day it is played', async () => {
  await demand('as banked');
  // AND IT IS NOT PASSING VACUOUSLY. Everything else held identical - the same
  // seed, the same pitch, the same sheets, the same sky - and ONLY the patch
  // withheld, the same fixtures have to play out differently. If they do not,
  // then the patch is not carrying the match and the check above is measuring
  // the seed. (The men are only three rounds old here, so this is a real ask:
  // it is form and legs that have moved, not yet a career.)
  const ms = await fixtures();
  let differs = 0;
  for (const m of ms) {
    const cond = host.condFor('eng', m.home_slot, season.season_no, m.round);
    const naive = host.runMatch(
      { name: m.home_name, players: await squadOf(m.home_slot) },
      { name: m.away_name, players: await squadOf(m.away_slot) },
      m.pitch, Number(m.seed), m.orders, cond.weather);
    if (facts(naive) !== facts(m.result_canonical)) differs++;
  }
  assert.ok(differs > 0, 'the patch is doing the work, not the seed alone');
});

test('the patch owns the skills outright, and the age with them', async () => {
  const m = (await fixtures())[0];
  const patch = m.living[m.home_name];
  const anyMan = Object.values(patch)[0];
  assert.ok(anyMan.sk && Object.keys(anyMan.sk).length > 8,
    'the whole skill map is written out, not a delta against a baseline the world may edit');
  assert.ok(anyMan.g > 0, 'and how old he was');
  assert.ok(anyMan.i && anyMan.i.r && anyMan.i.h,
    'and who he was, so a man who has since left can still be put on the field');
  // and it is genuinely the man who played: the patch agrees with the squad the
  // umpire picked from, attribute by attribute
  const now = await squadOf(m.home_slot);
  const him = now.find(p => patch[p.name]);
  for (const k in patch[him.name].sk)
    assert.equal(patch[him.name].sk[k], him.skills[k], him.name + ' ' + k);
});

test('A YEAR: the age tick and the decline that comes with it', async () => {
  const before0 = await squadOf(0);
  await ageYouth(pool, 'eng', season.season_no, makeHost());
  const after0 = await squadOf(0);
  // the world really did move - otherwise this test proves nothing
  const older = after0.filter(p => {
    const was = before0.find(q => q.name === p.name);
    return was && p.age > was.age;
  });
  assert.ok(older.length > 0, 'a year landed on somebody');
  const declined = after0.filter(p => {
    const was = before0.find(q => q.name === p.name);
    return was && Object.keys(p.skills).some(k => p.skills[k] < was.skills[k]);
  });
  assert.ok(declined.length > 0, 'and it cost somebody something');
  await demand('after a year and its decline');
});

test('DEVELOPMENT: the nets move a man on, and the record does not move with him', async () => {
  const sq = await squadOf(0);
  sq.forEach(p => { for (const k in p.skills) p.skills[k] = Math.min(120, p.skills[k] + 3); });
  const grown = host.derive(sq);
  grown.forEach((q, i) => Object.assign(sq[i], q));
  await pool.query(`UPDATE clubs SET squad=$1::jsonb WHERE country_id='eng' AND slot=0`,
    [JSON.stringify(sq)]);
  await demand('after a club trained hard');
});

test('A TRANSFER: a man is sold, and both his old club and his new one replay unchanged', async () => {
  const ms = await fixtures();
  const m0 = ms[0];
  const sellers = await squadOf(m0.home_slot);
  const buyerSlot = m0.home_slot === 15 ? 14 : 15;
  const buyers = await squadOf(buyerSlot);
  // somebody who actually played, so his absence would genuinely re-pick the XI
  const xi = JSON.parse(m0.result_canonical).innings.flatMap(i => (i && i.xi) || []);
  const mover = sellers.find(p => xi.includes(p.name));
  assert.ok(mover, 'a man who took the field in the fixture under test');
  await pool.query(`UPDATE clubs SET squad=$2::jsonb WHERE country_id='eng' AND slot=$1`,
    [m0.home_slot, JSON.stringify(sellers.filter(p => p.name !== mover.name))]);
  await pool.query(`UPDATE clubs SET squad=$2::jsonb WHERE country_id='eng' AND slot=$1`,
    [buyerSlot, JSON.stringify(buyers.concat([mover]))]);
  await demand('after a transfer took a man off the books');
});

test('RETIREMENT: the world forgets him entirely, and the match still remembers', async () => {
  const ms = await fixtures();
  const m0 = ms[0];
  const xi = JSON.parse(m0.result_canonical).innings.flatMap(i => (i && i.xi) || []);
  const sq = await squadOf(m0.away_slot);
  const hangsUp = sq.find(p => xi.includes(p.name));
  assert.ok(hangsUp, 'somebody who played for the away side');
  await pool.query(`UPDATE clubs SET squad=$2::jsonb WHERE country_id='eng' AND slot=$1`,
    [m0.away_slot, JSON.stringify(sq.filter(p => p.name !== hangsUp.name))]);
  await demand('after a man walked out of the world');
});
