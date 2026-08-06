// world-nets.test.mjs — THE MATCH-DAY RULE, AND THE COACH WHO IS GONE.
//
// The nets have one lever left and one that was withdrawn. The lever: the
// eleven who played bank the full session while the men left out train at
// half pace (051). The withdrawal: the head coach (056) - the hiring door is
// bolted and every club refunded, but coachRate() stays, because the rounds
// banked while a coach was on the staff must keep replaying at the rate they
// were actually worked. A withdrawn product never re-rates cricket already
// played, so that is asserted here rather than assumed.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { coachRate, academyRate } from '../living.mjs';
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

test('the coach is withdrawn: no door to hire one, and history still replays', async () => {
  // the door is gone
  await assert.rejects(() => pool.query(`SELECT world_set_coach(1)`), /world_set_coach/,
    'there is no hiring function left to call');
  // no club carries a coach or has paid for one
  const c = (await pool.query(
    `SELECT coalesce(sum(coach),0) lv, coalesce(sum(coach_paid),0) paid FROM clubs`)).rows[0];
  assert.equal(Number(c.lv), 0, 'nobody has a coach');
  assert.equal(Number(c.paid), 0, 'and nobody is out of pocket for one');
  // and the status no longer speaks of him
  const st = (await pool.query(`SELECT world_my_status() s`)).rows[0].s;
  assert.equal(st.coach, undefined, 'the status carries no coach');
  assert.equal(st.coachNextCost, undefined, 'nor a price for the next one');
  assert.equal(st.coachUpkeep, undefined, 'nor his wages');
  // THE HISTORY IS NOT REWRITTEN. A round banked at level five still replays
  // at level five - the rate a session was worked is a fact about that week.
  assert.equal(coachRate(0), 1, 'no coach is the unit, which is what every round banks now');
  assert.ok(Math.abs(coachRate(5) - 1.35) < 1e-9, 'and a round banked under the top man is still worth +35%');
  const squad = host.genSquad('coach|rate', 'England', 'balanced', 'general').slice(0, 6);
  const rested = p => Object.assign({}, p, { fatN: 0, fatWord: 'rested', fatigue: 'rested', trainProgress: {} });
  const sum = ps => ps.reduce((t, p) => { const tp = p.trainProgress || {}; for (const k in tp) t += tp[k]; return t; }, 0);
  const plain = sum(host.trainRound(squad.map(rested), {}, academyRate(2) * coachRate(0), null).players);
  const coached = sum(host.trainRound(squad.map(rested), {}, academyRate(2) * coachRate(5), null).players);
  assert.ok(coached > plain * 1.2, 'an old coached round still outworks an uncoached one (' +
    (coached / Math.max(1, plain)).toFixed(2) + 'x)');
});
