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

// ---- AND THE SCALE ITSELF ---------------------------------------------------
// 084 put the world's hands on a real scale and the first refold took it
// straight back off, because the nets replay from a baseline no migration had
// ever written. The live world proved it in the one place a refold cannot
// reach: a listing is a snapshot taken when a man was put up for sale, and of
// 74 men on both the market and their club's card, 73 disagreed about their own
// hands - by exactly one application of 084's map.
//
// resync-hands RE-DERIVES rather than re-stretching. Stretching again would
// need to know which men had already been stretched, and the two ranges
// overlap, so a wrong guess doubles a man's hands for ever.
test('a world wound back to the old scale is put back on the bell', async () => {
  const { resyncWorld } = await import('../resync-hands.mjs');
  // THE INVERSE OF 084'S MAP, on the skill and its baseline alike - which is
  // the live world's actual state, because the refold that lost the stretch
  // did it by copying the baseline over the skill.
  const old = v => Math.max(2, Math.round(36 + (v - 50) / 1.44));
  const rows = (await pool.query('SELECT country_id, slot, squad FROM clubs')).rows;
  for (const row of rows) {
    const squad = row.squad || [];
    squad.forEach(p => {
      ['fielding', 'catching'].forEach(k => {
        if (p.skills && p.skills[k] != null) p.skills[k] = old(p.skills[k]);
        if (p.baseSkills && p.baseSkills[k] != null) p.baseSkills[k] = old(p.baseSkills[k]);
      });
    });
    await pool.query('UPDATE clubs SET squad=$3::jsonb WHERE country_id=$1 AND slot=$2',
      [row.country_id, row.slot, JSON.stringify(squad)]);
  }
  const before = await resyncWorld(pool, host, { write: false, quiet: true });
  assert.ok(before.meanBefore < 40,
    'the world really is on the old scale: mean fielding ' + before.meanBefore);
  const done = await resyncWorld(pool, host, { write: true, quiet: true });
  assert.ok(done.meanAfter >= 45,
    'and the bell puts it back: mean fielding ' + done.meanAfter);
  assert.ok(done.moved > 1000, 'a whole world of numbers moved: ' + done.moved);
});

test('running it again moves nothing at all', async () => {
  const { resyncWorld } = await import('../resync-hands.mjs');
  const again = await resyncWorld(pool, host, { write: true, quiet: true });
  assert.equal(again.moved, 0, 'idempotent: it cannot be applied twice');
  assert.equal(again.clubs, 0);
});

test('and the hands are still in step with the numbers the engine fields with', async () => {
  const men = await everyMan();
  assert.deepEqual(outOfStep(men).map(p => p.__at + ' ' + p.name), []);
  // THE BASELINE IS ON THE BELL; THE SKILL IS THE BASELINE PLUS WHAT HE HAS
  // TRAINED. Those are not the same number and must not be: a man who has
  // earned a point of fielding stands above his own baseline, and the resync
  // lifts rather than levels precisely so it can never take that point back.
  const below = men.filter(p => p.baseSkills && p.skills &&
    p.baseSkills.fielding != null && p.skills.fielding < p.baseSkills.fielding);
  assert.deepEqual(below.map(p => p.__at + ' ' + p.name), [],
    'nobody sits below his own baseline');
  const trained = men.filter(p => p.baseSkills && p.skills &&
    p.skills.fielding > p.baseSkills.fielding);
  trained.forEach(p => assert.ok(p.skills.fielding - p.baseSkills.fielding < 15,
    p.name + ' is above his baseline by what the nets gave him, not by a scale'));
});
