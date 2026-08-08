// tests/world-season-commentary.test.mjs — EVERY BALL, FOR THE WHOLE SEASON.
//
// Migration 066 turns the commentary bank's week into the season itself.
// The obligations:
//   1. a log well past seven days still serves - the age refusal is gone;
//   2. the broadcast embargo survives: before first ball, still nothing;
//   3. the rollover sweep clears a country's logs when its next season is
//      founded, and leaves other countries' books alone.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';

const DBNAME = 'foworld_seasonlog_test';
let pool;

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
});
after(async () => { if (pool) await pool.end(); });

test('an old log still serves: the seven-day refusal is gone', async () => {
  await pool.query(
    `INSERT INTO countries(id, name, play_hour_utc) VALUES ('eng','England',14), ('rsa','South Africa',11), ('aus','Australia',4)
     ON CONFLICT DO NOTHING`);
  await pool.query(
    `INSERT INTO seasons(country_id, season_no, start_day, schedule, divisions)
     VALUES ('eng', 1, 1, '[]'::jsonb, '{}'::jsonb) ON CONFLICT DO NOTHING`);
  await pool.query(
    `INSERT INTO match_logs(match_id, country_id, log, played_at)
     VALUES ('eng:s1:r1:m1', 'eng', '[{"no":"1.1","text":"a ball"}]'::jsonb, now() - interval '20 days')`);
  const r = await pool.query(`SELECT public.world_match_log('eng', 'eng:s1:r1:m1') AS v`);
  assert.ok(r.rows[0].v.log, 'the 20-day-old log must serve');
  assert.equal(r.rows[0].v.log[0].no, '1.1');
});

test('the broadcast embargo still holds before first ball', async () => {
  // a real world clock, so round_play_ms can speak: epoch now, and a season
  // starting three days out - round 1's first ball is in the future
  await pool.query(
    `INSERT INTO worlds(id, epoch_ms, cycle_days, league_rounds, engine_version)
     VALUES (1, $1, 21, 14, 'v1') ON CONFLICT (id) DO UPDATE SET epoch_ms = EXCLUDED.epoch_ms`,
    [Date.now() - 86400000]);
  const far = 3;   // day 3 of a world whose epoch was yesterday
  await pool.query(
    `INSERT INTO seasons(country_id, season_no, start_day, schedule, divisions)
     VALUES ('rsa', 9, $1, '[]'::jsonb, '{}'::jsonb) ON CONFLICT DO NOTHING`, [far]);
  await pool.query(
    `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed, engine_version, pitch, result)
     VALUES ('rsa:s9:r1:m1', 'rsa', 9, 1, 0, 1, 7, 'v1', 'balanced', '{"text":"secret"}'::jsonb)`);
  await pool.query(
    `INSERT INTO match_logs(match_id, country_id, log)
     VALUES ('rsa:s9:r1:m1', 'rsa', '[{"no":"1.1","text":"sealed"}]'::jsonb)`);
  const r = await pool.query(`SELECT public.world_match_log('rsa', 'rsa:s9:r1:m1') AS v`);
  assert.equal(r.rows[0].v.log, null, 'a future round must not leak its book');
});

test('the rollover sweep clears one country and spares the rest', async () => {
  await pool.query(
    `INSERT INTO match_logs(match_id, country_id, log)
     VALUES ('aus:s1:r1:m1', 'aus', '[{"no":"1.1"}]'::jsonb)`);
  // the sweep, as tick.mjs runs it at rollover
  await pool.query(`DELETE FROM match_logs WHERE country_id = $1`, ['eng']);
  const eng = await pool.query(`SELECT count(*)::int AS n FROM match_logs WHERE country_id='eng'`);
  const aus = await pool.query(`SELECT count(*)::int AS n FROM match_logs WHERE country_id='aus'`);
  assert.equal(eng.rows[0].n, 0, 'england swept');
  assert.equal(aus.rows[0].n, 1, 'australia untouched');
});
