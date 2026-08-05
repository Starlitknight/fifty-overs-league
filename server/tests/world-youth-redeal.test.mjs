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

test('no boy the hat can deal out-rates the weakest senior of any generated squad', () => {
  // the floor: the weakest senior across a spread of generated squads
  let minSenior = Infinity;
  for (let s = 0; s < 12; s++) {
    const sq = host.genSquad('rdl|club' + s, 'England', 'balanced', 'general');
    minSenior = Math.min(minSenior, ...sq.map(p => p.rating || Infinity));
  }
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
  assert.ok(maxBoy < minSenior,
    'strongest possible boy (' + maxBoy + ') must rate below the weakest senior (' + minSenior + ')');
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
