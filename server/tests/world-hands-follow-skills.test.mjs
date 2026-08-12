// world-hands-follow-skills.test.mjs — THE NUMBER THE ENGINE FIELDS WITH IS
// THE NUMBER ON THE CARD.
//
// A cricketer carries his hands twice: in skills, and again at the top level
// as field and keeping, which jsDerive mirrors out of the skills when he is
// made. The ball engine reads the TOP LEVEL FIRST -
//   foFieldSkill(p) = p.field || p.skills.fielding || 50
// - so the two drifting apart is not cosmetic. It happened once: 084 rescaled
// the world's hands in skills and nothing re-derived the top level, so a world
// whose cards read a healthy 55 went on fielding at its old number, and the
// banked ball-by-ball came back three good pieces of fielding to 117 misfields
// across seven matches.
//
// And the nets are a derivation: living.mjs rebuilds a squad from baseSkills
// and replays the training it has done, so a migration that rewrites skills
// without rewriting baseSkills is undone by the first refold after it.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { makeHost } from '../enginehost.mjs';
import { initWorld } from '../init-world.mjs';
import { runDue } from '../tick.mjs';

const DB = 'fohands_test';
const T0 = Date.UTC(2026, 0, 1);
let pool, host;

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: T0, host });
});
after(async () => { await pool.end(); });

const everyMan = async () => {
  const r = await pool.query('SELECT country_id, slot, squad, youth FROM clubs');
  const out = [];
  for (const row of r.rows) {
    for (const p of (row.squad || [])) out.push({ ...p, __at: row.country_id + '/' + row.slot });
    for (const p of (row.youth || [])) out.push({ ...p, __at: row.country_id + '/' + row.slot + ' colt' });
  }
  return out;
};
const outOfStep = men => men.filter(p =>
  p.skills && p.skills.fielding != null && p.field !== p.skills.fielding);

test('a world is founded with its hands already in step', async () => {
  const men = await everyMan();
  assert.ok(men.length > 3000, 'a world to measure (' + men.length + ')');
  assert.deepEqual(outOfStep(men).map(p => p.__at + ' ' + p.name), []);
});

// EXACTLY WHAT 084 DID: rewrite the skill, leave the derived number and the
// baseline where they were.
test('a skills-only rescaling leaves the engine fielding at the old number', async () => {
  await pool.query(`
    UPDATE clubs SET squad = (
      SELECT coalesce(jsonb_agg(
        CASE WHEN p ? 'skills'
             THEN jsonb_set(p, '{skills,fielding}',
                    to_jsonb(least(99, ((p->'skills'->>'fielding')::int) + 20)))
             ELSE p END ORDER BY ord), '[]'::jsonb)
        FROM jsonb_array_elements(squad) WITH ORDINALITY AS t(p, ord))
     WHERE country_id = 'eng'`);
  const men = (await everyMan()).filter(p => p.__at.startsWith('eng/'));
  const bad = outOfStep(men);
  assert.ok(bad.length > 100,
    'the break is meant to bite: ' + bad.length + ' men out of step');
  bad.slice(0, 5).forEach(p => assert.ok(p.field < p.skills.fielding,
    'and the engine reads the LOWER number'));
});

test('091 puts the derived number and the baseline back on the skill', async () => {
  await pool.query('UPDATE clubs SET squad = world_sync_squad(squad)');
  await pool.query('UPDATE clubs SET youth = world_sync_squad(youth) WHERE youth IS NOT NULL');
  const men = await everyMan();
  assert.deepEqual(outOfStep(men).map(p => p.__at + ' ' + p.name), []);
  // the nets replay from baseSkills, so it has to carry the same scale or the
  // next refold hands back the man from before the rescaling
  const drift = men.filter(p => p.baseSkills && p.skills &&
    p.baseSkills.fielding !== p.skills.fielding);
  assert.deepEqual(drift.map(p => p.__at + ' ' + p.name), []);
});

test('and running it twice changes nothing', async () => {
  const before2 = JSON.stringify((await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=3`)).rows[0].squad);
  await pool.query('UPDATE clubs SET squad = world_sync_squad(squad)');
  const after2 = JSON.stringify((await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=3`)).rows[0].squad);
  assert.equal(after2, before2);
});

// THE STANDING GUARD. Every squad in the world passes through the settle, so
// that is where the two are held together - a repair that only ran once would
// let the next rescaling drift the same way.
test('a settle writes the hands back in step, whatever it was handed', async () => {
  await pool.query(`
    UPDATE clubs SET squad = (
      SELECT coalesce(jsonb_agg(jsonb_set(p, '{field}', '3'::jsonb) ORDER BY ord), '[]'::jsonb)
        FROM jsonb_array_elements(squad) WITH ORDINALITY AS t(p, ord))
     WHERE country_id = 'eng'`);
  assert.ok(outOfStep((await everyMan()).filter(p => p.__at.startsWith('eng/'))).length > 100,
    'broken on purpose before the settle');
  await runDue(pool, host, 'eng', { now: T0 + 4 * 86400000 });
  const men = (await everyMan()).filter(p => p.__at.startsWith('eng/') && !p.__at.endsWith('colt'));
  assert.deepEqual(outOfStep(men).map(p => p.__at + ' ' + p.name), []);
});
