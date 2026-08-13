// tests/the-morning-he-crosses.test.mjs — HE EARNS IT ON THE FOLD THAT
// JUSTIFIES IT, NOT THE ONE AFTER.
//
// A talent is a threshold, and the interesting number is the threshold itself.
// world-earned-talents banks a man half way and then well past; nobody had ever
// stood a cricketer EXACTLY on the line and settled twice, which is where a
// one-fold lag hides: the settle that first has the record for a crossing must
// be the settle that awards it, or the world's answer depends on how many times
// it was asked.
//
// It hid here for a while. The umpire reads the thresholds off the shipped
// engine, and a settle run without one has an empty table - so it wrote every
// man's progress and withheld every award, and the next settle that did hold
// the engine handed out talents the previous one already had the record for.
// Two folds of one record, two different worlds, and no complaint from either.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { evolveCountry, talentsEarned } from '../living.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DB = 'focross_test';
const T0 = EPOCH + 100 * DAY + 12 * 3600000;
let pool, host, T, season, club, other;

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: T0, host });
  T = host.talThresholds();
  season = (await pool.query(`SELECT season_no FROM seasons WHERE country_id='eng'`)).rows[0];
  club = (await pool.query(`SELECT slot, name, squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  other = (await pool.query(`SELECT slot, name FROM clubs WHERE country_id='eng' AND slot=2`)).rows[0];
});
after(async () => { await pool.end(); });

// a match whose only content is the tally it credits - the shape a hundred real
// rounds leave behind, without playing them
const bank = async (round, man, tal) => pool.query(
  `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed,
     engine_version, pitch, result, home_name, away_name)
   VALUES ($1,'eng',$2,$3,1,2,1,'v2','balanced',$4::jsonb,$5,$6)
   ON CONFLICT (id) DO UPDATE SET result = EXCLUDED.result`,
  [`eng:s${season.season_no}:r${round}:h1a2`, season.season_no, round,
   JSON.stringify({ winner: club.name, text: 'x', mom: null,
     innings: [{ batTeam: club.name, bowlTeam: other.name, runs: 200, wkts: 5, legal: 300,
                 bat: [], bowlers: {}, fielding: {} }],
     tal: { [club.name]: { [man]: tal } } }),
   club.name, other.name]);

const manOf = async name => (await pool.query(
  `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad.find(p => p.name === name);

// pick a man with room to learn the talent we are about to credit him with -
// and never one already spoken for, because a man earns one a career, and a
// second crossing on the same cricketer would prove nothing about the first
const spoken = new Set();
const learner = talent => {
  const p = club.squad.find(q => !spoken.has(q.name)
    && (q.talents || []).indexOf(talent) < 0 && host.talElig(q, talent));
  assert.ok(p, 'somebody at this club can still learn ' + talent);
  spoken.add(p.name);
  return p;
};
let crossed = null;                            // the man put exactly on the line

// ---- EXACTLY ON THE LINE -----------------------------------------------------

test('a man standing exactly on the threshold has it by the end of that fold', async () => {
  const him = crossed = learner('fastStarter');
  await bank(1, him.name, { fastStarter: T.fastStarter });
  await evolveCountry(pool, 'eng', T0 + 3 * DAY, host);
  const after = await manOf(him.name);
  assert.equal(after.talEarned, 'fastStarter',
    'the fold that first has the record for the crossing is the fold that awards it');
  assert.ok((after.talents || []).indexOf('fastStarter') >= 0, 'and it is on his card');
  assert.ok(!after.talProg || after.talProg.fastStarter == null,
    'what earned it stops being progress');
});

test('and settling again changes nothing about him', async () => {
  const before = await manOf(crossed.name);
  await evolveCountry(pool, 'eng', T0 + 3 * DAY, host);
  assert.deepEqual(await manOf(crossed.name), before, 'a second settle of one record is the same man');
});

// ONE SHORT IS STILL SHORT, and stays short however often it is asked. The
// counterpart to the test above: the line has to be a line, not a suggestion.
test('one trigger short is not a talent, and stays not one', async () => {
  const him = learner('anchor');
  await bank(2, him.name, { anchor: T.anchor - 1 });
  await evolveCountry(pool, 'eng', T0 + 4 * DAY, host);
  const first = await manOf(him.name);
  assert.equal(first.talProg.anchor, T.anchor - 1, 'the triggers are on his card');
  assert.ok((first.talents || []).indexOf('anchor') < 0, 'and one short is short');
  await evolveCountry(pool, 'eng', T0 + 4 * DAY, host);
  assert.deepEqual(await manOf(him.name), first, 'asking twice does not round him up');
});

// ---- AND THE WHOLE COUNTRY CONVERGES ON ONE FOLD -----------------------------

test('the second settle of a record moves nobody at all', async () => {
  const all = () => pool.query(
    `SELECT slot, squad FROM clubs WHERE country_id='eng' ORDER BY slot`).then(r => r.rows);
  await evolveCountry(pool, 'eng', T0 + 5 * DAY, host);
  const before = await all();
  await evolveCountry(pool, 'eng', T0 + 5 * DAY, host);
  assert.deepEqual(await all(), before, 'the settle is a pure function of the record');
});

// ---- THE HALF-FOLD --------------------------------------------------------
//
// The thresholds come off the shipped engine, never a copy, so there is exactly
// one way for them to go missing: a settle handed no engine. What must NOT
// happen then is the thing that did - the fold measuring every ratio against
// nothing, concluding "not yet" for the whole country and writing it down.

test('a fold with no thresholds declines to answer rather than answering no', () => {
  const q = { name: 'X', talents: [], talProg: { miser: 900 } };
  const untouched = talentsEarned({ ...q }, { miser: 900 }, {});
  assert.deepEqual(untouched, q, 'no engine, no verdict - his card is left exactly as it stood');
  // and with the real table the same record is a talent, which is the point:
  // the empty table was never a smaller answer, it was a different one
  const judged = talentsEarned({ name: 'X', talents: [] }, { miser: T.miser }, T);
  assert.equal(judged.talEarned, 'miser', 'the same record, read against the real thresholds');
});

test('a settle without the engine never contradicts one with it', async () => {
  const him = learner('miser');
  await bank(3, him.name, { miser: T.miser });
  await evolveCountry(pool, 'eng', T0 + 6 * DAY);            // no engine: says nothing
  const quiet = await manOf(him.name);
  assert.ok(!quiet.talEarned || quiet.talEarned !== 'miser',
    'the engineless settle has not awarded it, because it cannot know');
  assert.ok(!quiet.talProg || quiet.talProg.miser == null,
    'and it has not written half an answer down either');
  await evolveCountry(pool, 'eng', T0 + 6 * DAY, host);
  const said = await manOf(him.name);
  assert.equal(said.talEarned, 'miser', 'the settle that can read the thresholds awards it');
});
