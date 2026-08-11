// tests/world-star-mirror.test.mjs — A RIVAL WEARS THE SAME STARS.
//
// The Roster rates a man on a strip of ten stars, drawn from a COMPOSITE the
// orders room computes: sixty per cent the discipline aggregate, twenty
// technique, twenty power - or, for a bowler, sixty the bowling aggregate,
// twenty wicket threat, twenty economy.
//
// Those last forty per cent are raw skills, and raw skills do not cross the
// fence: 016 drew that line so a scout reads a man's class from the boundary
// and never the fifteen numbers underneath. So the composite itself is
// published, the way the overall rating already is - a single number that
// says how good he is and nothing about which skill got him there.
//
// Which means it has to AGREE. Two pages rating one cricketer differently is
// worse than one page not rating him at all, so this runs the real engine
// over the same squad and demands the same numbers, exactly as the guard on
// the card rating does. And it holds the line the composites travel across:
// a summary may go through, an ingredient may not.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DBNAME = 'foworld_stars_test';
let pool, host;

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
  await initWorld(pool, { now: EPOCH + 100 * DAY + 12 * 3600000, host });
});
after(async () => { await pool.end(); });

test('the composite the roster stars a man on is the engine own, to the decimal', async () => {
  const squad = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  const fromEngine = host.starComp(squad);
  const fromSql = (await pool.query(
    `SELECT (world_pk_num(x)->>'batComp')::numeric AS b,
            (world_pk_num(x)->>'bowlComp')::numeric AS w
       FROM jsonb_array_elements($1::jsonb) x`, [JSON.stringify(squad)])).rows;

  assert.equal(fromSql.length, fromEngine.length, 'a row per man');
  assert.ok(fromEngine.length >= 11, 'a squad to check (' + fromEngine.length + ')');
  fromSql.forEach((r, i) => {
    const e = fromEngine[i];
    assert.ok(Math.abs(Number(r.b) - e.bat) < 1e-6,
      'batting composite ' + i + ': sql ' + r.b + ' vs engine ' + e.bat);
    if (e.bowl == null) assert.equal(r.w, null, 'a man who does not bowl has no bowling stars');
    else assert.ok(Math.abs(Number(r.w) - e.bowl) < 1e-6,
      'bowling composite ' + i + ': sql ' + r.w + ' vs engine ' + e.bowl);
  });
});

// AND THE FUNCTION THEY WERE ADDED TO STILL DOES ITS FIRST JOB. world_pk_num
// has been rewritten four times since it was written - the card stretch (055),
// the all-rounder's line (057), the rounding parity (061), the inlining that
// saved it from a search_path it could not see (062). A migration that adds a
// field to it must build on the LAST of those, and the first draft of 082 built
// on the first: it passed every test above and quietly reverted all four. Only
// the card-rating mirror in world-p3 caught it, twenty tests into another file.
// It is guarded here too now, beside the thing that broke it.
test('adding to the card function does not undo the card function', async () => {
  const squad = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  const fromEngine = host.pkOvr(squad);
  const fromSql = (await pool.query(
    `SELECT (world_pk_num(x)->>'ovr')::int AS o FROM jsonb_array_elements($1::jsonb) x`,
    [JSON.stringify(squad)])).rows.map(r => r.o);
  assert.deepEqual(fromSql, fromEngine, 'every card rating is still the engine\'s own number');
});

test('the dossier carries the composites, and the ladder can be walked from them', async () => {
  const card = (await pool.query(
    `SELECT players FROM world_squads WHERE country_id='eng' AND slot=1`)).rows[0];
  const men = card.players;
  assert.ok(men.length >= 11);
  men.forEach(p => {
    assert.equal(typeof p.batComp, 'number', p.name + ' has a batting composite');
    // the same ladder the orders room walks: 15 or below is no stars, 92 is ten
    const stars = Math.max(0, Math.min(10, Math.round(((p.batComp - 15) / 77 * 10) * 2) / 2));
    assert.ok(stars >= 0 && stars <= 10, p.name + ' rates ' + stars);
  });
  // and a bowler's craft comes through, because the roster reads it to decide
  // which of his two composites to star him on
  assert.ok(men.some(p => p.bowlType), 'the dossier names a bowler his craft');
  men.filter(p => !p.bowlType).forEach(p =>
    assert.equal(p.bowlComp, null, p.name + ' does not bowl, so he has no bowling stars'));
});

test('a summary crosses the fence; an ingredient still does not', async () => {
  const card = (await pool.query(
    `SELECT players FROM world_squads WHERE country_id='eng' AND slot=1`)).rows[0];
  const leak = JSON.stringify(card.players);
  // the exact list 016 drew, unchanged - the composites are derived numbers
  // and must not have opened a door for the book underneath them
  for (const secret of ['skills', 'baseSkills', 'trainProgress', 'vsPace', 'vsSpin', 'wicket', 'economy',
    'discipline', 'moveTurn', 'variation', 'stamina', 'temperament', 'rotation', 'catching', 'stumping']) {
    assert.ok(leak.indexOf('"' + secret + '"') === -1, secret + ' must not cross the boundary');
  }
  for (const shown of ['ovr', 'batting', 'bowling', 'fielding', 'batComp', 'bowlComp', 'talents']) {
    assert.ok(leak.indexOf('"' + shown + '"') > -1, shown + ' is what a scout is allowed');
  }
});
