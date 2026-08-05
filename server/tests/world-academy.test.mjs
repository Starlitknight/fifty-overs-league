// world-academy.test.mjs — THE YOUTH ACADEMY, end to end on a real Postgres.
// Founds a world, claims a club, scouts, signs, promotes and builds, and holds
// the buttons and the books to the same prices. docs/ACADEMY.md is the law.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { layCandidates, stockAcademies, ageYouth, ACADEMY_FLOOR, tierOdds, tierOf }
  from '../youth.mjs';
import { EPOCH, DAY, REST_DAYS } from '../clock.mjs';
import { academyBuild, academyUpkeep, SCOUT_FEE_ABROAD, PROMOTE_FEE }
  from '../economy.mjs';

const DB = 'foacad_test';
let pool, host, startDay;
const UID = '11111111-1111-1111-1111-111111111111';

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  const r = await initWorld(pool, { now: EPOCH + 1 * DAY, host });
  startDay = r.startDay;
  await pool.query(`INSERT INTO claims(user_id, country_id, slot, display_name) VALUES ($1,'eng',1,'Tester')`, [UID]);
  await pool.query(`CREATE OR REPLACE FUNCTION _uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${UID}'::uuid $$`);
});
after(async () => { if (pool) await pool.end(); });

test('every club in the world is founded able to field a Colts Cup side', async () => {
  const rows = (await pool.query(
    `SELECT slot, jsonb_array_length(youth) n FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  assert.equal(rows.length, 16);
  for (const r of rows) assert.equal(r.n, ACADEMY_FLOOR, 'slot ' + r.slot + ' has fifteen boys');
  const ages = (await pool.query(
    `SELECT min((y->>'age')::int) lo, max((y->>'age')::int) hi
       FROM clubs, jsonb_array_elements(youth) y WHERE country_id='eng'`)).rows[0];
  assert.ok(ages.lo >= 16 && ages.hi <= 20, 'boys are 16 to 20, got ' + ages.lo + '-' + ages.hi);
});

test('the scout travels on rest days only, once, and the fee follows the passport', async () => {
  const restDay = startDay + REST_DAYS[0];
  const playDay = startDay + 0;                       // round 1: cricket on
  await pool.query(`UPDATE worlds SET epoch_ms=$1 WHERE id=1`,
    [EPOCH - (playDay - 0) * DAY + EPOCH * 0]);       // placeholder, reset below

  // drive world_day() by moving the world's epoch under a fixed now()
  const setDay = async d => {
    const now = Number((await pool.query('SELECT now_ms() n')).rows[0].n);
    await pool.query('UPDATE worlds SET epoch_ms=$1 WHERE id=1', [Math.floor(now - d * DAY)]);
  };
  await setDay(playDay);
  await assert.rejects(() => pool.query(`SELECT world_scout('eng')`), /rest days/,
    'no scouting on a match day');

  await setDay(restDay);
  await layCandidates(pool, host, 'eng', { worldDay: restDay, startDay, restDays: REST_DAYS });
  const laid = (await pool.query(
    `SELECT count(*)::int n FROM academy_candidates WHERE country_id='eng' AND slot=1 AND world_day=$1`,
    [restDay])).rows[0].n;
  assert.equal(laid, 16, 'one candidate per nation for the claimed club');
  const other = (await pool.query(
    `SELECT count(*)::int n FROM academy_candidates WHERE slot<>1`)).rows[0].n;
  assert.equal(other, 0, 'and none at all for clubs nobody manages');

  const bank0 = Number((await pool.query(`SELECT bank FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].bank);
  const away = (await pool.query(`SELECT world_scout('rsa') r`)).rows[0].r;
  assert.equal(away.ok, true);
  assert.equal(Number(away.fee), SCOUT_FEE_ABROAD, 'a trip abroad is paid for');
  assert.ok(away.recruit && away.recruit.name, 'and it produced a boy: ' + (away.recruit || {}).name);
  assert.ok(away.recruit.age >= 16 && away.recruit.age <= 20);
  const bank1 = Number((await pool.query(`SELECT bank FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].bank);
  assert.equal(bank0 - bank1, SCOUT_FEE_ABROAD, 'and the treasury paid it');

  await assert.rejects(() => pool.query(`SELECT world_scout('eng')`), /already made/,
    'one trip a rest day');
});

test('a boy is signed onto the wage bill, or let go and gone', async () => {
  const before = (await pool.query(`SELECT youth FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].youth;
  const r = (await pool.query(`SELECT world_recruit('sign') r`)).rows[0].r;
  assert.equal(r.ok, true);
  const after = (await pool.query(`SELECT youth FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].youth;
  assert.equal(after.length, before.length + 1, 'he is on the books');
  assert.ok(after.some(y => y.name === r.name));
  await assert.rejects(() => pool.query(`SELECT world_recruit('sign')`), /nobody waiting/,
    'and there is nobody left to answer for');
});

test('a senior shirt costs the same flat fee for every boy', async () => {
  const club = (await pool.query(`SELECT youth, squad, bank FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  const boy = club.youth[0];
  const bank0 = Number(club.bank), n0 = club.squad.length;
  const r = (await pool.query(`SELECT world_colt($1,'promote') r`, [boy.name])).rows[0].r;
  assert.equal(Number(r.fee), PROMOTE_FEE);
  const after = (await pool.query(`SELECT youth, squad, bank FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  assert.equal(after.squad.length, n0 + 1, 'he has a senior shirt');
  assert.equal(bank0 - Number(after.bank), PROMOTE_FEE, 'and it was paid for');
  assert.ok(!after.youth.some(y => y.name === boy.name), 'and he is out of the academy');
  assert.ok(after.squad.some(p => p.name === boy.name && !p.colt), 'no longer a colt');
});

test('the SQL and the JavaScript quote the same prices', async () => {
  for (const [from, to] of [[1, 2], [2, 3], [1, 5], [3, 5]]) {
    const sql = Number((await pool.query(`SELECT academy_build_cost($1,$2) c`, [from, to])).rows[0].c);
    assert.equal(sql, academyBuild(from, to), `build ${from}->${to}`);
  }
  const fee = Number((await pool.query(`SELECT academy_scout_fee('eng','rsa') f`)).rows[0].f);
  assert.equal(fee, SCOUT_FEE_ABROAD);
  assert.equal(Number((await pool.query(`SELECT academy_scout_fee('eng','eng') f`)).rows[0].f), 0);
  assert.equal(Number((await pool.query(`SELECT academy_promote_fee() f`)).rows[0].f), PROMOTE_FEE);
  const rest = (await pool.query(`SELECT world_rest_days() d`)).rows[0].d;
  assert.deepEqual(rest, REST_DAYS, 'the SQL rest days are the calendar rest days');
  for (let lv = 1; lv <= 5; lv++) {
    const a = (await pool.query(`SELECT (ARRAY[6000,14000,26000,44000,70000])[$1] u`, [lv])).rows[0].u;
    assert.equal(Number(a), academyUpkeep(lv), 'upkeep level ' + lv);
  }
});

test('building a level costs the ladder, and is never sold back', async () => {
  await pool.query(`UPDATE clubs SET bank=9000000 WHERE country_id='eng' AND slot=1`);
  const r = (await pool.query(`SELECT world_set_academy(3) r`)).rows[0].r;
  assert.equal(Number(r.cost), academyBuild(2, 3));
  const c = (await pool.query(`SELECT academy, bank, academy_paid FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  assert.equal(c.academy, 3);
  assert.equal(Number(c.bank), 9000000 - academyBuild(2, 3));
  await assert.rejects(() => pool.query(`SELECT world_set_academy(2)`), /never sold back/);
});

test('the umpire stocks a club nobody manages, and never one that is managed', async () => {
  await pool.query(`UPDATE clubs SET youth='[]'::jsonb WHERE country_id='eng' AND slot IN (1,2)`);
  await stockAcademies(pool, host, 'eng', { worldDay: startDay + REST_DAYS[1] });
  const rows = (await pool.query(
    `SELECT slot, jsonb_array_length(youth) n FROM clubs WHERE country_id='eng' AND slot IN (1,2) ORDER BY slot`)).rows;
  assert.equal(rows[0].n, 0, 'the managed club was left exactly as its manager left it');
  assert.equal(rows[1].n, ACADEMY_FLOOR, 'the bot club was put back on its feet');
});

test('a boy walks at twenty-one, and nobody is promoted behind the manager', async () => {
  await pool.query(
    `UPDATE clubs SET youth = jsonb_build_array(
        jsonb_build_object('name','Old Boy','age',20,'wage',900,'rating',3000,'skills','{}'::jsonb),
        jsonb_build_object('name','Young Boy','age',17,'wage',900,'rating',3000,'skills','{}'::jsonb))
      WHERE country_id='eng' AND slot=3`);
  const n0 = (await pool.query(`SELECT jsonb_array_length(squad) n FROM clubs WHERE country_id='eng' AND slot=3`)).rows[0].n;
  const out = await ageYouth(pool, 'eng', 1);
  assert.equal(out.promoted, 0, 'nothing is promoted automatically any more');
  const c = (await pool.query(`SELECT youth, squad FROM clubs WHERE country_id='eng' AND slot=3`)).rows[0];
  assert.equal(c.youth.length, 1, 'the twenty-year-old turned twenty-one and left');
  assert.equal(c.youth[0].name, 'Young Boy');
  assert.equal(c.youth[0].age, 18, 'and the other had a birthday');
  assert.equal(c.squad.length, n0, 'he was not quietly handed a senior shirt');
  assert.ok(!c.squad.some(p => p.name === 'Old Boy'), 'he is gone from the world');
});

test('a better academy really does find better boys', async () => {
  // the odds are a ladder, and the ladder is monotone in the level
  let lastJewel = 0, lastGood = 0;
  for (let lv = 1; lv <= 5; lv++) {
    const [j, g] = tierOdds(lv);
    assert.ok(j >= lastJewel, 'jewels no rarer at level ' + lv);
    assert.ok(g >= lastGood, 'good boys no rarer at level ' + lv);
    lastJewel = j; lastGood = g;
  }
  // and the roll actually honours them over a decent sample
  const N = 40000;
  for (const lv of [1, 5]) {
    let good = 0;
    for (let i = 0; i < N; i++) {
      const t = tierOf(lv, 'sample|' + lv + '|' + i);
      if (t === 'jewel' || t === 'good') good++;
    }
    const [j, g] = tierOdds(lv), want = (j + g) * N;
    assert.ok(Math.abs(good - want) < want * 0.25 + 40,
      'level ' + lv + ' turned out ' + good + ' good-or-better, expected about ' + Math.round(want));
  }
});

test('the scout hands over a report, not the file - and the signature is the reveal', async () => {
  // a fresh trip on the second rest day of the season (050: the fog)
  const d2 = startDay + REST_DAYS[1];
  const setDay = async d => {
    const now = Number((await pool.query('SELECT now_ms() n')).rows[0].n);
    await pool.query('UPDATE worlds SET epoch_ms=$1 WHERE id=1', [Math.floor(now - d * DAY)]);
  };
  await setDay(d2);
  await layCandidates(pool, host, 'eng', { worldDay: d2, startDay, restDays: REST_DAYS });
  const r = (await pool.query(`SELECT world_scout('eng') rep`)).rows[0].rep;
  assert.equal(r.ok, true);
  const rep = r.recruit;
  // ranges, never numbers: the file's skills stay sealed until the signature
  assert.equal(rep.scouted, true, 'the trip returns a report');
  assert.ok(!rep.skills, 'no skill is served as a number');
  assert.ok(rep.skillBands && Object.keys(rep.skillBands).length >= 10, 'a band per skill');
  assert.ok(rep.name && rep.age >= 16 && rep.age <= 20, 'the plain facts stay plain');
  // every band is honest: the truth (banked on the trip row) sits inside it
  const truth = (await pool.query(
    `SELECT recruit FROM academy_scouts WHERE country_id='eng' AND slot=1 AND world_day=$1`, [d2])).rows[0].recruit;
  for (const k of Object.keys(truth.skills || {})) {
    const b = rep.skillBands[k];
    assert.ok(b && b.lo <= truth.skills[k] && truth.skills[k] <= b.hi,
      k + ': ' + truth.skills[k] + ' inside [' + (b && b.lo) + ',' + (b && b.hi) + ']');
  }
  // the report is deterministic: read twice, worded once
  const p1 = (await pool.query(`SELECT world_my_academy() a`)).rows[0].a.pending.recruit;
  const p2 = (await pool.query(`SELECT world_my_academy() a`)).rows[0].a.pending.recruit;
  assert.deepEqual(p1, p2, 'the same trip serves the same report');
  assert.deepEqual(p1.skillBands, rep.skillBands, 'and it is the trip\'s own report');
  // a better academy reads the same boy sharper - build it and look again
  const lvl0 = (await pool.query(`SELECT academy FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].academy;
  await pool.query(`UPDATE clubs SET academy=5 WHERE country_id='eng' AND slot=1`);
  const sharp = (await pool.query(`SELECT world_my_academy() a`)).rows[0].a.pending.recruit;
  let narrower = 0;
  for (const k of Object.keys(rep.skillBands)) {
    const w0 = rep.skillBands[k].hi - rep.skillBands[k].lo, w5 = sharp.skillBands[k].hi - sharp.skillBands[k].lo;
    assert.ok(w5 <= w0, k + ': a level-five report is never blurrier');
    assert.ok(sharp.skillBands[k].lo <= truth.skills[k] && truth.skills[k] <= sharp.skillBands[k].hi,
      k + ': still honest at level five');
    if (w5 < w0) narrower++;
  }
  assert.ok(narrower >= 8, 'and most bands genuinely sharpened: ' + narrower);
  await pool.query(`UPDATE clubs SET academy=$1 WHERE country_id='eng' AND slot=1`, [lvl0]);
  // the signature is the reveal: the boy who joins is the boy who was laid out
  const signed = (await pool.query(`SELECT world_recruit('sign') s`)).rows[0].s;
  assert.equal(signed.ok, true);
  const youth = (await pool.query(`SELECT youth FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].youth;
  const boy = youth.filter(y => y.name === truth.name)[0];
  assert.ok(boy, 'he is on the books under his own name');
  assert.deepEqual(boy.skills, truth.skills, 'with his real skills, exactly as generated');
});
