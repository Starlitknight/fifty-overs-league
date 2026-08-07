// world-youth-redeal.test.mjs — A BOY IS ALWAYS WEAKER THAN A SENIOR, and the
// one-time redeal that makes it true of the crops already dealt. The pricing
// half is pure (no database); the redeal half runs on a real Postgres.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { makeRecruit, foundAcademy, redealYouth } from '../youth.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DB = 'foredeal_test';
let pool, host;
const UID = '22222222-2222-2222-2222-222222222222';

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: EPOCH + 1 * DAY, host });
  await pool.query(`INSERT INTO claims(user_id, country_id, slot, display_name) VALUES ($1,'eng',1,'Tester')`, [UID]);
});
after(async () => { if (pool) await pool.end(); });

test('the best boy can push out a fringe man, and cannot walk into the first XI', () => {
  // WHAT THIS RULE USED TO SAY, AND WHY IT CHANGED.
  //
  // It used to demand that the strongest boy an academy can produce rate below
  // the WEAKEST senior anywhere in the world - the youth and senior
  // distributions were not allowed to touch at any point. That reads as
  // prudence, and it quietly cost the game the thing a squad is for.
  //
  // A squad's total strength is normalised to its budget, so ANY widening of
  // the spread inside a squad lowers its tail: lifting a first choice pulls
  // everyone else down. A no-overlap rule therefore pins the tail, and pinning
  // the tail flattens the squad. Measured under the old rule: six batsmen
  // inside two points of overall, at every club in the world, which is exactly
  // how it read - the same player, dealt four times.
  //
  // The rule now says what it always meant. A jewel is exciting because he can
  // displace your fifteenth man, not because he is instantly your best: he may
  // out-rate a fringe senior - a real club's fifteenth man IS comparable to a
  // top academy graduate - and he must still rate below the MEDIAN senior, so
  // no boy walks straight into a first XI.
  const medians = [];
  let minSenior = Infinity;
  for (let s = 0; s < 12; s++) {
    const sq = host.genSquad('rdl|club' + s, 'England', 'balanced', 'general');
    const r = sq.map(p => p.rating || 0).sort((a, b) => a - b);
    medians.push(r[Math.floor(r.length / 2)]);
    minSenior = Math.min(minSenior, r[0]);
  }
  const minMedian = Math.min(...medians);
  // the ceiling: full level-5 academies (best tier odds) plus forced jewels
  // at every age - the strongest boys the generator can produce
  let maxBoy = 0;
  for (let s = 0; s < 8; s++) {
    const boys = foundAcademy(host, 'eng', s, 5, 'rdlck' + s);
    maxBoy = Math.max(maxBoy, ...boys.map(b => b.rating || 0));
  }
  for (let s = 0; s < 24; s++) {
    const b = makeRecruit(host, 'England', 'balanced', 'jewel', 'rdlj|' + s);
    if (b) maxBoy = Math.max(maxBoy, b.rating || 0);
  }
  assert.ok(maxBoy < minMedian,
    'strongest possible boy (' + maxBoy + ') must rate below the median senior (' + minMedian + ')');
  // and the overlap is deliberate, not accidental: if the squads ever go flat
  // again the tail will climb back above the academy and this will say so.
  assert.ok(minSenior < maxBoy,
    'a fringe senior (' + minSenior + ') is meant to be reachable by the best boy (' + maxBoy +
    ') - if it is not, the squad spread has collapsed again');
});

test('the redeal replaces every list, clears the old paperwork, and fires once', async () => {
  const before9 = (await pool.query(
    `SELECT slot, youth FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  assert.equal(before9.length, 16);

  // paperwork of the old world: an unanswered scout report, a prebanked
  // candidate, a named colts squad - all priced or named under the old crop
  const boy0 = before9[0].youth[0];
  await pool.query(
    `INSERT INTO academy_scouts(country_id, slot, world_day, nation, tier, fee, recruit)
          VALUES ('eng', 1, 1, 'eng', 'average', 0, $1::jsonb)`, [JSON.stringify(boy0)]);
  await pool.query(
    `INSERT INTO academy_candidates(country_id, slot, world_day, nation, tier, recruit)
          VALUES ('eng', 1, 2, 'eng', 'average', $1::jsonb)`, [JSON.stringify(boy0)]);
  await pool.query(
    `INSERT INTO colts_squads(country_id, slot, season_no, names)
          VALUES ('eng', 1, 1, $1::jsonb)`,
    [JSON.stringify(before9[0].youth.slice(0, 15).map(y => y.name))]);

  const dealt = await redealYouth(pool, host, 'eng');
  assert.equal(dealt, 16 * 16, 'sixteen fresh boys at each of sixteen clubs');

  const after9 = (await pool.query(
    `SELECT slot, youth FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  for (let i = 0; i < 16; i++) {
    assert.equal(after9[i].youth.length, 16, 'slot ' + after9[i].slot + ' holds sixteen boys');
    const oldNames = new Set(before9[i].youth.map(y => y.name));
    const kept = after9[i].youth.filter(y => oldNames.has(y.name)).length;
    // seeded name banks may re-draw a name; the crop itself must be new
    assert.ok(kept <= 2, 'slot ' + after9[i].slot + ': the old crop is gone (' + kept + ' name collisions)');
  }
  // every dealt boy sits under the recalibrated ceiling
  const top = (await pool.query(
    `SELECT max((y->>'rating')::numeric) mx FROM clubs, jsonb_array_elements(youth) y
      WHERE country_id='eng'`)).rows[0];
  assert.ok(Number(top.mx) < 28000, 'strongest dealt boy rates ' + top.mx + ', under the senior floor');

  const paper = (await pool.query(
    `SELECT (SELECT count(*) FROM academy_scouts WHERE country_id='eng' AND decision IS NULL) sc,
            (SELECT count(*) FROM academy_candidates WHERE country_id='eng') ca,
            (SELECT count(*) FROM colts_squads WHERE country_id='eng') cs`)).rows[0];
  assert.equal(Number(paper.sc), 0, 'unanswered scout reports are gone');
  assert.equal(Number(paper.ca), 0, 'prebanked candidates are gone');
  assert.equal(Number(paper.cs), 0, 'named colts squads are gone');

  // by decree, once: a second firing deals nothing and disturbs nobody
  const again = await redealYouth(pool, host, 'eng');
  assert.equal(again, 0, 'the redeal is a one-time decree');
  const same = (await pool.query(
    `SELECT youth FROM clubs WHERE country_id='eng' AND slot=$1`, [after9[0].slot])).rows[0];
  assert.deepEqual(same.youth.map(y => y.name), after9[0].youth.map(y => y.name));
});
