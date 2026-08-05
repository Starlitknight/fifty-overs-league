// world-coach-nets.test.mjs — THE HEAD COACH AND THE MATCH-DAY RULE (051).
// The two levers the classic management games run their nets on: a hired
// coach whose level multiplies every session, and Battrick's rule that the
// eleven who played bank the full session while the men left out train at
// half pace. The button, the books and the nets are held to one set of
// numbers.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { coachRate, academyRate } from '../living.mjs';
import { coachUpkeep, coachHire, COACH_STEP } from '../economy.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DB = 'focoach_test';
let pool, host;
const UID = '33333333-3333-3333-3333-333333333333';

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: EPOCH + 1 * DAY, host });
  await pool.query(`INSERT INTO claims(user_id, country_id, slot, display_name) VALUES ($1,'eng',1,'Tester')`, [UID]);
  await pool.query(`CREATE OR REPLACE FUNCTION _uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${UID}'::uuid $$`);
});
after(async () => { if (pool) await pool.end(); });

test('the button and the books quote the same coach prices', async () => {
  for (let lv = 1; lv <= 5; lv++) {
    const sql = (await pool.query(
      'SELECT coach_hire_cost($1, $2) hire, coach_upkeep($2) keep', [lv - 1, lv])).rows[0];
    assert.equal(Number(sql.hire), COACH_STEP[lv - 1], 'step to L' + lv);
    assert.equal(Number(sql.keep), coachUpkeep(lv), 'upkeep at L' + lv);
  }
  const full = (await pool.query('SELECT coach_hire_cost(0, 5) c')).rows[0];
  assert.equal(Number(full.c), coachHire(0, 5), 'the whole ladder sums the same');
});

test('hiring: upward only, priced, paid from a solvent treasury', async () => {
  await pool.query(`UPDATE clubs SET bank = 200000 WHERE country_id='eng' AND slot=1`);
  const r1 = (await pool.query(`SELECT world_set_coach(1) r`)).rows[0].r;
  assert.equal(r1.coach, 1);
  assert.equal(Number(r1.cost), COACH_STEP[0]);
  const c1 = (await pool.query(
    `SELECT coach, coach_paid, bank FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  assert.equal(c1.coach, 1);
  assert.equal(Number(c1.coach_paid), COACH_STEP[0]);
  assert.equal(Number(c1.bank), 200000 - COACH_STEP[0]);
  await assert.rejects(() => pool.query(`SELECT world_set_coach(1)`), /never let go/,
    'the same level again is a demotion in disguise');
  await assert.rejects(() => pool.query(`SELECT world_set_coach(5)`), /costs/,
    '80k in the bank does not hire the top man');
  await pool.query(`UPDATE clubs SET bank = -5 WHERE country_id='eng' AND slot=1`);
  await assert.rejects(() => pool.query(`SELECT world_set_coach(2)`), /red/,
    'a club in the red hires nobody');
  const st = (await pool.query(`SELECT world_my_status() s`)).rows[0].s;
  assert.equal(st.coach, 1, 'status carries the coach');
  assert.equal(Number(st.coachNextCost), COACH_STEP[1]);
  assert.equal(Number(st.coachUpkeep), coachUpkeep(1));
});

test('the match-day rule: the eleven who played bank double the bench', () => {
  const squad = host.genSquad('coach|nets', 'England', 'balanced', 'general').slice(0, 13);
  const xi = squad.slice(0, 11).map(p => p.name);
  const rested = p => Object.assign({}, p, { fatN: 0, fatWord: 'rested', fatigue: 'rested', trainProgress: {} });
  const sum = p => { let t = 0; const tp = p.trainProgress || {}; for (const k in tp) t += tp[k]; return t; };
  const withXi = host.trainRound(squad.map(rested), {}, 1, xi).players;
  const without = host.trainRound(squad.map(rested), {}, 1, null).players;
  for (let i = 0; i < squad.length; i++) {
    const banked = sum(withXi[i]);
    const full = sum(without[i]);
    // points already spent on a pop still count as banked work; compare
    // against the no-xi run, which is the full-rate baseline
    const played = xi.indexOf(squad[i].name) >= 0;
    if (full === 0) continue;                        // a Rest programme banks nothing either way
    const ratio = banked / full;
    if (played) assert.ok(ratio > 0.95, squad[i].name + ' played and banks in full (' + ratio.toFixed(2) + ')');
    else assert.ok(ratio > 0.4 && ratio < 0.6, squad[i].name + ' sat out and banks half (' + ratio.toFixed(2) + ')');
  }
});

test('the coach rate multiplies the session, and no coach is the unit', () => {
  assert.equal(coachRate(0), 1, 'no coach changes nothing - history replays as banked');
  assert.ok(Math.abs(coachRate(5) - 1.35) < 1e-9, 'the top man is worth +35%');
  for (let lv = 1; lv <= 5; lv++) assert.ok(coachRate(lv) > coachRate(lv - 1), 'each level buys more');
  const squad = host.genSquad('coach|rate', 'England', 'balanced', 'general').slice(0, 6);
  const rested = p => Object.assign({}, p, { fatN: 0, fatWord: 'rested', fatigue: 'rested', trainProgress: {} });
  const sum = ps => ps.reduce((t, p) => { const tp = p.trainProgress || {}; for (const k in tp) t += tp[k]; return t; }, 0);
  const plain = sum(host.trainRound(squad.map(rested), {}, academyRate(2) * coachRate(0), null).players);
  const coached = sum(host.trainRound(squad.map(rested), {}, academyRate(2) * coachRate(5), null).players);
  assert.ok(coached > plain * 1.2, 'a level-five coach visibly outworks none (' +
    (coached / Math.max(1, plain)).toFixed(2) + 'x)');
});
