// tests/world-story.test.mjs — THE STORY SO FAR, WRITTEN DOWN.
//
// A cricketer's page had a heading called "The story so far" and nothing
// under it. What it read was p._career, a book the CHRONICLE writes as a
// match is watched on a device - so in the served world, where the umpire
// plays every round while nobody is looking, it was empty for every man
// alive, and the card fell through to its one stand-in line: "Next match ·
// League debut", printed to a man with two hundred appearances behind him.
//
// The record already knew all of it. living.mjs replays every match ever
// played on every settle, and it is the fold that decides a man's highest
// score and his best figures - so it writes down the round each of those
// things happened in on the way past. Being a derivation and not a diary,
// the whole of the past arrived filled the moment it was written.
//
// These hold that: after a round is banked and the world settles, the men
// who played carry moments; the moments are the ones the record actually
// supports; and nothing is invented for a man who has not played.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runDue } from '../tick.mjs';
import { evolveCountry } from '../living.mjs';
import { EPOCH, DAY, natHour } from '../clock.mjs';

const DBNAME = 'foworld_story_test';
let pool, host;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;
const START = 101;
const PLAY = EPOCH + START * DAY + 14 * 3600000;
const PREBANK = PLAY - 3600000 + 4 * 60000;

async function squads() {
  return (await pool.query('SELECT slot, squad FROM clubs WHERE country_id=$1 ORDER BY slot', ['eng'])).rows;
}
// every man in England who carries a story, with his club
async function storied() {
  const out = [];
  for (const c of await squads()) for (const p of c.squad) if (p.mile) out.push({ slot: c.slot, p });
  return out;
}

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
  await initWorld(pool, { now: T0, host });
  assert.equal(natHour('eng'), 14, 'the test clock assumes the 14:00 league');
  const out = await runDue(pool, host, 'eng', { now: PREBANK });
  assert.ok(out.some(x => x.prebanked > 0), 'round 1 prebanked');
  await evolveCountry(pool, 'eng', EPOCH + START * DAY + 20 * 3600000, host);
});
after(async () => { await pool.end(); });

test('a man who has played carries his moments, and one of them is his first cap', async () => {
  const men = await storied();
  assert.ok(men.length >= 40, 'a round of eight clubs leaves plenty of stories (' + men.length + ')');
  const debuts = men.filter(x => x.p.mile.some(m => m.k === 'debut'));
  assert.equal(debuts.length, men.length, 'every one of them made his debut in the round just played');
  const one = debuts[0].p.mile.filter(m => m.k === 'debut')[0];
  assert.match(one.txt, /Made his league debut/);
  assert.equal(one.s, 1, 'it is dated by season');
  assert.equal(one.r, 1, 'and by round');
  assert.ok(one.d > 0, 'and by the world day, so the page can print a date');
});

test('a moment is only written where the record supports it', async () => {
  const men = await storied();
  // the highest score a man is credited with is the highest score the fold
  // gave him: a story that disagreed with the record would be a second record
  let checked = 0;
  for (const { p } of men) {
    const hs = p.mile.filter(m => m.k === 'hs').pop();
    if (!hs) continue;
    checked++;
    const said = +(/of (\d+)$/.exec(hs.txt) || [])[1];
    assert.equal(said, p.career.hs, p.name + ': the story says ' + said + ', the record says ' + p.career.hs);
  }
  assert.ok(checked >= 8, 'enough men made a score to check (' + checked + ')');

  let bowled = 0;
  for (const { p } of men) {
    const bb = p.mile.filter(m => m.k === 'bb').pop();
    if (!bb) continue;
    bowled++;
    const m9 = /of (\d+)-(\d+)$/.exec(bb.txt);
    assert.ok(m9, bb.txt);
    assert.deepEqual({ w: +m9[1], r: +m9[2] }, p.career.bb,
      p.name + ': the story and the record disagree about his best figures');
  }
  assert.ok(bowled >= 8, 'enough men took a wicket to check (' + bowled + ')');
});

test('nothing is invented: a man with no moments has no story at all', async () => {
  const all = [];
  for (const c of await squads()) for (const p of c.squad) all.push(p);
  const idle = all.filter(p => !p.mile);
  assert.ok(idle.length > 0, 'a squad of sixteen cannot all have played (' + idle.length + ')');
  // and the ones with nothing to say say nothing, rather than an empty list
  idle.forEach(p => assert.equal(p.mile, undefined, p.name + ' carries an empty story'));
  // a story is never a stub either: every line has words and a place in time
  for (const { p } of await storied()) {
    p.mile.forEach(m => {
      assert.ok(m.txt && m.txt.length > 4, p.name + ': a line with nothing in it');
      assert.ok(Number.isFinite(m.d), p.name + ': a line with no day');
    });
  }
});

test('the fold is a derivation: settling twice does not write the story twice', async () => {
  const before9 = new Map((await storied()).map(x => [x.slot + '|' + x.p.name, x.p.mile.length]));
  await evolveCountry(pool, 'eng', EPOCH + START * DAY + 21 * 3600000, host);
  const after9 = await storied();
  assert.equal(after9.length, before9.size, 'the same men are storied');
  after9.forEach(x => assert.equal(x.p.mile.length, before9.get(x.slot + '|' + x.p.name),
    x.p.name + ': his story grew on a settle that played no cricket'));
});

// THE REFOLD. evolveCountry runs inside a day's settle, behind a per-day lock
// that never reruns a day already marked done - so the day the fold learned to
// write a man's milestones, every club in the world went on serving the old
// shape until its next world day came due. A cricketer who had played a league
// match read as one who had never played. The living layer carries a version
// now, and runDue refolds each country once when it moves, outside that guard.
test('a fold that has moved is redone on the next tick, not the next world day', async () => {
  const { runDue } = await import('../tick.mjs');
  const { LIVING_VERSION } = await import('../living.mjs');
  const key = 'eng:fold:' + LIVING_VERSION;
  // the day is settled and locked; strip the fold's own guard and its output,
  // which is exactly the state a club is in the moment the fold's code changes
  await pool.query('DELETE FROM ticks WHERE key = $1', [key]);
  await pool.query(
    `UPDATE clubs SET squad = (
       SELECT jsonb_agg(p - 'mile') FROM jsonb_array_elements(squad) p)
     WHERE country_id = 'eng'`);
  assert.equal((await storied()).length, 0, 'nobody has a story to start with');

  const out = await runDue(pool, host, 'eng', { now: EPOCH + START * DAY + 22 * 3600000, world: false });
  assert.ok(out.some(x => x.refolded === LIVING_VERSION), 'the tick says it refolded');
  assert.ok((await storied()).length >= 40, 'and the stories are back without a new day');
  assert.equal((await pool.query('SELECT status FROM ticks WHERE key=$1', [key])).rows[0].status, 'done');

  // and it does not fire again: one refold per version, one cheap read after
  const again = await runDue(pool, host, 'eng', { now: EPOCH + START * DAY + 23 * 3600000, world: false });
  assert.ok(!again.some(x => x.refolded), 'the guard holds on the next tick');
});

// AND IT HAS TO REACH THE PAGE. world_my_status serves the club's squad blob
// whole, so a manager's own men carried their moments from the first settle.
// The public side is the only way a page reads a cricketer who is not yours,
// and it is a curated projection that names each field it publishes - so the
// story was empty on every other man in the world until it was named.
//
// It is no longer named on the ROSTER. A squad page draws a table with no
// milestones in it, and was fetching fifteen lives to do it; the story moved
// to world_player_profile, which one screen reads about one man when somebody
// opens him. The contract this test holds is unchanged - a man's moments are
// public, whole, and empty rather than absent - and only the door has moved.
test('the public dossier publishes a man moments, not just his own manager', async () => {
  const men = (await pool.query(
    `SELECT name, mile FROM world_player_profile WHERE country_id='eng' AND slot=0`)).rows;
  assert.ok(men.length >= 11, 'the club has a dossier: ' + men.length);
  const storied9 = men.filter(p => (p.mile || []).length);
  assert.ok(storied9.length >= 8, 'his moments come through the view (' + storied9.length + ')');
  assert.ok(storied9.every(p => p.mile.every(m => m.txt && Number.isFinite(m.d))),
    'whole, not flattened to a count');
  // a man with nothing to say still reads as an empty list rather than absent,
  // so the page never has to tell null from "he has not played"
  assert.ok(men.every(p => Array.isArray(p.mile)), 'every row carries the key');
});
