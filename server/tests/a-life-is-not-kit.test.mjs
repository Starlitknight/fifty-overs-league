// tests/a-life-is-not-kit.test.mjs — WHAT HE HAS DONE LEAVES THE HOT ROW.
//
// clubs.squad is read and rewritten on every tick of every day, and on a club
// that has played a season thirty per cent of it was `career` and `mile` -
// every run the man has ever scored and the story of how. No ball of cricket
// consults either. Both grow: the story keeps up to sixty entries and a world
// forty days old is six deep, so the share climbs rather than settles.
//
// So the past moved to a card of its own, keyed by the id the cricketer carries
// - which is the thing that makes it work, because a history keyed by id
// follows the MAN. A transfer is then a squad changing and not a life being
// copied, and two cricketers who share a name cannot inherit each other's runs.
//
// What must stay true: the roster still draws what it drew, a man's page still
// shows his whole story, nothing of a life is lost when he is sold, and a
// settle that changed nothing still writes nothing.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runDue } from '../tick.mjs';
import { evolveCountry } from '../living.mjs';
import { stripCold, hydrateCold, readHistory, writeHistory, coldOf } from '../player-history.mjs';
import { backfillHistory } from '../backfill-history.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DB = 'folife_test';
const T0 = EPOCH + 100 * DAY + 12 * 3600000;
let pool, host, day = 0;

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: T0, host });
  // enough cricket that men have books and stories worth splitting
  for (day = 1; day <= 12; day++) await runDue(pool, host, 'eng', { now: T0 + day * DAY });
});
after(async () => { await pool.end(); });

const squadOf = async (slot = 1) => (await pool.query(
  `SELECT squad FROM clubs WHERE country_id='eng' AND slot=$1`, [slot])).rows[0].squad;
const allEng = async () => (await pool.query(
  `SELECT slot, squad FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
const canon = v => JSON.stringify(v === undefined ? null : v, (k, val) =>
  (val && typeof val === 'object' && !Array.isArray(val))
    ? Object.keys(val).sort().reduce((o, kk) => { o[kk] = val[kk]; return o; }, {}) : val);

// ---- THE HOT ROW ------------------------------------------------------------

test('a persisted squad no longer carries a man\'s past', async () => {
  const rows = await allEng();
  let men = 0;
  for (const r of rows) for (const p of r.squad) {
    men++;
    assert.ok(!('career' in p), p.name + ' still carries his book on the hot row');
    assert.ok(!('mile' in p), p.name + ' still carries his story on the hot row');
    assert.ok(!('intl' in p), p.name + ' still carries his country book on the hot row');
  }
  assert.ok(men > 200, 'a country of cricketers to check: ' + men);
});

// AND EVERYTHING THE ENGINE READS IS STILL THERE. The whole risk of this change
// is taking one field too many: a squad blob is the ball engine's input.
test('and still carries everything a match is played from', async () => {
  const men = await squadOf();
  const KIT = ['name', 'pid', 'age', 'role', 'skills', 'baseSkills', 'rating',
    'bat', 'threat', 'capt', 'talents', 'exp', 'expWord', 'formIx', 'formWord',
    'fatN', 'fatWord', 'wage', 'fee', 'keeper', 'nat', 'hand'];
  for (const f of KIT) assert.ok(f in men[0], 'the hot row lost ' + f);
});

test('a cricketer who has played has a card, and it says what he did', async () => {
  const men = await squadOf();
  const rows = (await pool.query(
    'SELECT pid, career, intl, mile FROM player_history WHERE pid = ANY($1::text[])',
    [men.map(p => p.pid)])).rows;
  assert.equal(rows.length, men.length, 'one card a cricketer: ' + rows.length + ' vs ' + men.length);
  const played = rows.filter(r => r.career && r.career.m > 0);
  assert.ok(played.length >= 11, 'an XI have books by now: ' + played.length);
  assert.ok(played.some(r => (r.mile || []).length), 'and somebody has a story');
  for (const r of rows) {
    assert.ok(Array.isArray(r.mile), r.pid + ' has a story that is a list, never null');
    assert.ok(r.career && typeof r.career === 'object', r.pid + ' has a book, never null');
  }
});

// ---- THE PAGES --------------------------------------------------------------

test('the roster still draws a man\'s book, out of the one row it always fetched', async () => {
  const rows = (await pool.query(
    `SELECT players FROM world_squads WHERE country_id='eng' AND slot=1`)).rows;
  assert.equal(rows.length, 1, 'still one row a club');
  const men = rows[0].players;
  assert.ok(men.length >= 11);
  for (const p of men) assert.ok(p.career && typeof p.career === 'object',
    p.name + ' lost his book off the public card');
  const capped = men.filter(p => p.career.m > 0);
  assert.ok(capped.length >= 11, 'and the numbers are real: ' + capped.length);
});

test('a man\'s page still shows his whole story', async () => {
  const men = await squadOf();
  const him = men.find(p => p.pid);
  const rows = (await pool.query(
    'SELECT pid, name, mile, career FROM world_player_profile WHERE pid=$1', [him.pid])).rows;
  assert.equal(rows.length, 1, 'exactly one row for one id');
  assert.equal(rows[0].name, him.name, 'and it is the right man');
  const card = (await pool.query(
    'SELECT career, mile FROM player_history WHERE pid=$1', [him.pid])).rows[0];
  assert.equal(canon(rows[0].mile), canon(card.mile), 'the page reads the card');
  assert.equal(canon(rows[0].career), canon(card.career), 'both halves of it');
});

// NOBODY ELSE'S LIFE. The whole reason this is keyed by id: two cricketers at
// one club can share a name, and a history that followed the name would hand
// one man the other's runs.
test('one cricketer\'s history cannot arrive on another', async () => {
  const men = (await squadOf()).filter(p => p.pid);
  const a = men[0], b = men.find(p => p.pid !== a.pid);
  const both = await readHistory(pool, [a.pid, b.pid]);
  assert.equal(both.size, 2, 'two men, two cards');
  assert.notEqual(canon(both.get(a.pid)), canon(both.get(b.pid)),
    'two different cricketers do not share one life');
  const one = await readHistory(pool, [a.pid]);
  assert.equal(one.size, 1, 'asking for one returns one');
  assert.ok(one.has(a.pid));
});

// ---- THE ADAPTERS -----------------------------------------------------------

test('stripping a man does not empty the one the caller is holding', () => {
  const p = { name: 'X', pid: 'p1', rating: 9, career: { m: 4 }, mile: [{ d: 1 }], intl: { m: 1 } };
  const [hot] = stripCold([p]);
  assert.deepEqual(p.career, { m: 4 }, 'the object handed in is untouched');
  assert.deepEqual(p.mile, [{ d: 1 }], 'in both fields');
  assert.ok(!('career' in hot) && !('mile' in hot) && !('intl' in hot), 'and the copy is clean');
  assert.equal(hot.rating, 9, 'while everything else survives');
});

test('and hydrating puts it back exactly where it was', () => {
  const p = { name: 'X', pid: 'p1', rating: 9, career: { m: 4, runs: 90 }, mile: [{ d: 1 }] };
  const [hot] = stripCold([p]);
  const by = new Map([['p1', { career: { m: 4, runs: 90 }, intl: {}, mile: [{ d: 1 }] }]]);
  const [back] = hydrateCold([hot], by);
  assert.deepEqual(back.career, p.career);
  assert.deepEqual(back.mile, p.mile);
  assert.ok(!('intl' in back), 'an empty book is not a book, so it is not added');
});

test('a man with nothing to say strips and hydrates without inventing anything', () => {
  const p = { name: 'Y', pid: 'p2', rating: 3 };
  const [hot] = stripCold([p]);
  assert.deepEqual(hot, p, 'nothing to take means nothing copied');
  const [back] = hydrateCold([hot], new Map([['p2', { career: {}, intl: {}, mile: [] }]]));
  assert.ok(!('career' in back) && !('mile' in back), 'and an empty card adds no fields');
  assert.deepEqual(coldOf(p), { pid: 'p2', career: {}, intl: {}, mile: [] },
    'but he still gets a row - "he has done nothing" is an answer');
});

// ---- THE FOLD ---------------------------------------------------------------

test('the fold keeps writing a man\'s book as he plays', async () => {
  const men = await squadOf();
  const him = men.find(p => p.pid);
  const before = (await pool.query(
    'SELECT career, mile, updated_at FROM player_history WHERE pid=$1', [him.pid])).rows[0];
  for (let d = day; d <= day + 6; d++) await runDue(pool, host, 'eng', { now: T0 + d * DAY });
  day += 7;
  const after = (await pool.query(
    'SELECT career, mile FROM player_history WHERE pid=$1', [him.pid])).rows[0];
  assert.ok(after.career.m >= before.career.m, 'a book never goes backwards');
  const moved = (await pool.query(
    `SELECT count(*)::int c FROM player_history ph, clubs cl, jsonb_array_elements(cl.squad) p
      WHERE cl.country_id='eng' AND p->>'pid' = ph.pid AND (ph.career->>'m')::int > 0`)).rows[0].c;
  assert.ok(moved >= 11, 'a week of cricket left books on an XI at least: ' + moved);
});

// A SETTLE THAT CHANGED NOTHING WRITES NOTHING - the Phase 3 discipline, which
// this must not undo by rewriting every card three times an hour.
test('settling the same record twice writes no card at all', async () => {
  const now = T0 + day * DAY;
  await evolveCountry(pool, 'eng', now, host);
  const stamps = () => pool.query(
    'SELECT pid, updated_at FROM player_history ORDER BY pid').then(r => JSON.stringify(r.rows));
  const before = await stamps();
  await evolveCountry(pool, 'eng', now, host);
  assert.equal(await stamps(), before, 'not one card was touched by a fold of the same record');
});

// ---- THE MOVE ---------------------------------------------------------------

// A TRANSFER IS THE ONE PLACE THE SERVER GENUINELY NEEDS A CAREER: the living
// fold derives a man's book from the matches his CURRENT club has played, so
// what he did before is frozen onto him as a carry the moment he moves. That
// read used to come off the blob. It now comes off his card, and if it ever
// silently returned nothing a bought cricketer would arrive with a blank page.
test('a man sold keeps every run he ever made', async () => {
  const { closeListings } = await import('../market.mjs');
  const from = (await pool.query(
    `SELECT slot, squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  const cards = await readHistory(pool, from.squad.map(p => p.pid));
  const withBook = from.squad.find(p => {
    const c = cards.get(p.pid); return c && c.career && c.career.m > 0 && c.career.runs > 0;
  });
  assert.ok(withBook, 'somebody at this club has scored runs');
  const book = cards.get(withBook.pid).career;
  const story = cards.get(withBook.pid).mile;

  const openDay = T0 / DAY | 0;
  const ins = await pool.query(
    `INSERT INTO listings(country_id, slot, player, player_json, asking, reserve, opened_day, closes_day)
     VALUES ('eng',1,$1,$2::jsonb,900000,100000,$3,$4) RETURNING id`,
    [withBook.name, JSON.stringify(withBook), day, day + 1]);
  await pool.query(
    `INSERT INTO bids(listing_id, country_id, slot, amount) VALUES ($1,'eng',3,900000)`,
    [ins.rows[0].id]);
  const out = await closeListings(pool, { now: T0 + (day + 2) * DAY });
  const mine = out.find(x => x.id === ins.rows[0].id);
  assert.ok(mine && mine.sold, 'the window shut and he was sold: ' + JSON.stringify(mine));

  const buyer = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=3`)).rows[0].squad;
  const moved = buyer.find(p => p.name === withBook.name);
  assert.ok(moved, 'he is at his new club');
  // THE READ THAT USED TO COME OFF THE BLOB. His book is frozen onto him as a
  // carry the moment he moves, because his new club's fold only knows the
  // matches THAT club has played. The career it freezes is now fetched from his
  // card by id - and if that fetch ever quietly returned nothing, this is the
  // assertion that would go to zero.
  assert.ok(moved.carry && moved.carry.m > 0,
    'his record travelled with him as a carry: ' + JSON.stringify(moved.carry));
  assert.equal(moved.carry.runs, book.runs, 'every run of it');
  assert.equal(moved.carry.m, book.m, 'and every match');
  assert.ok(!('career' in moved), 'while the hot row he landed on stays hot');

  // and his story is still his - the card is keyed by the man, not by the shirt
  const after = (await pool.query(
    'SELECT mile FROM player_history WHERE pid=$1', [withBook.pid])).rows[0];
  assert.ok(after, 'his card survived the move');
  assert.equal(canon(after.mile), canon(story), 'with every line of his story intact');
});

// ---- THE BACKFILL -----------------------------------------------------------

// COVERAGE IS TOTAL, and it takes a backfill to make it so: the fold writes the
// cards of the country it settles, so a world where only England has played has
// three and a half thousand cricketers with nothing on file. They have nothing
// to say, but "nothing" is an answer and the page should not have to tell it
// from a missing row.
test('every man on the books has a card, and the backfill says so', async () => {
  const before = await backfillHistory(pool, { verify: true, quiet: true });
  assert.ok(before.missing > 1000, 'the unplayed world has no cards yet: ' + before.missing);
  const r = await backfillHistory(pool, { write: true, quiet: true });
  assert.ok(r.opened > 1000, 'the backfill opened them: ' + r.opened);
  const v = await backfillHistory(pool, { verify: true, quiet: true });
  assert.equal(v.missing, 0, 'nobody is without a card');
  assert.equal(v.dupes, 0, 'no id is held by two clubs');
  assert.equal(v.mismatched, 0, 'and nothing disagrees');
  assert.equal(v.ok, true);
});

// THE TRANSITION ITSELF, which is the only state this tool exists for: a world
// whose blobs still carry the old embedded fields. It has to lift them, agree
// with them, and do nothing at all the second time.
test('the backfill lifts embedded history onto its card, and is idempotent', async () => {
  const club = (await pool.query(
    `SELECT slot, squad FROM clubs WHERE country_id='eng' AND slot=7`)).rows[0];
  const him = club.squad.find(p => p.pid);
  // put him back the way he was before 094 - book and story on the hot row
  const legacy = { m: 9, runs: 404, balls: 500, hs: 88, wkts: 2, conc: 60, ovb: 42, bb: null };
  const legacyMile = [{ d: 3, k: 'debut', txt: 'Made his league debut' }];
  const rolled = club.squad.map(p => p.pid === him.pid
    ? { ...p, career: legacy, mile: legacyMile } : p);
  await pool.query(`UPDATE clubs SET squad=$1::jsonb WHERE country_id='eng' AND slot=7`,
    [JSON.stringify(rolled)]);

  const before = await backfillHistory(pool, { verify: true, quiet: true });
  assert.ok(before.comparable >= 1, 'there is now something to compare');
  assert.ok(before.mismatched >= 1, 'and the two spellings disagree until it is lifted');
  assert.equal(before.ok, false, 'which the verify refuses to pass');

  const first = await backfillHistory(pool, { write: true, quiet: true });
  assert.ok(first.written >= 1, 'the lift wrote him: ' + first.written);
  const card = (await pool.query(
    'SELECT career, mile FROM player_history WHERE pid=$1', [him.pid])).rows[0];
  assert.equal(canon(card.career), canon(legacy), 'exactly what was embedded');
  assert.equal(canon(card.mile), canon(legacyMile), 'both halves of it');

  const second = await backfillHistory(pool, { write: true, quiet: true });
  assert.equal(second.written, 0, 'a second run rewrites nothing: ' + second.written);
  assert.equal((await backfillHistory(pool, { verify: true, quiet: true })).ok, true,
    'and now the two spellings agree');
});

// AND IT NEVER WIPES WHAT IT CANNOT SEE. After the strip there is nothing
// embedded to lift, and a backfill that treated "no embedded history" as "an
// empty history" would put a blank book on top of every real one - the one way
// a backfill for a derived table can destroy something.
test('a backfill after the strip writes nothing over a real card', async () => {
  await evolveCountry(pool, 'eng', T0 + day * DAY, host);   // strips slot 7 again
  const men = await squadOf(7);
  assert.ok(men.every(p => !('career' in p)), 'the hot rows are hot again');
  const was = (await pool.query(
    'SELECT pid, career, mile FROM player_history ORDER BY pid')).rows;
  const r = await backfillHistory(pool, { write: true, quiet: true });
  assert.equal(r.written, 0, 'nothing to lift, so nothing written');
  const now = (await pool.query(
    'SELECT pid, career, mile FROM player_history ORDER BY pid')).rows;
  assert.equal(canon(now), canon(was), 'and not one card was touched');
});

// A CARD THAT GOES MISSING IS REBUILT, which is the whole rollback story: the
// history is DERIVED - living.mjs recomputes it from the entire match record on
// every settle and never reads it back - so losing this table costs one settle,
// not one memory.
test('a card that goes missing is rebuilt, not mourned', async () => {
  const cards = await readHistory(pool, (await squadOf()).map(p => p.pid));
  const pid = [...cards.keys()].find(k => cards.get(k).career && cards.get(k).career.m > 0);
  assert.ok(pid, 'somebody with a book to lose');
  const was = cards.get(pid);
  await pool.query('DELETE FROM player_history WHERE pid=$1', [pid]);
  const gone = await backfillHistory(pool, { verify: true, quiet: true });
  assert.ok(gone.missing >= 1, 'the verify says so rather than passing quietly');
  assert.equal(gone.ok, false, 'which is a refusal, not a warning');

  await evolveCountry(pool, 'eng', T0 + day * DAY, host);
  const back = (await pool.query(
    'SELECT career, mile FROM player_history WHERE pid=$1', [pid])).rows[0];
  assert.ok(back, 'one settle put him back');
  assert.equal(canon(back.career), canon(was.career), 'with the same book');
  assert.equal(canon(back.mile), canon(was.mile), 'and the same story');
});

// ---- SEMANTIC EQUALITY ------------------------------------------------------

test('the two spellings of one history are compared by meaning, not by bytes', async () => {
  const him = (await squadOf()).find(p => p.pid);
  const card = (await pool.query(
    'SELECT career FROM player_history WHERE pid=$1', [him.pid])).rows[0].career;
  // the same document with its keys in another order is the same document
  const shuffled = Object.keys(card).sort().reverse()
    .reduce((o, k) => { o[k] = card[k]; return o; }, {});
  assert.notEqual(JSON.stringify(shuffled), JSON.stringify(card),
    'the two really are spelled differently');
  assert.equal(canon(shuffled), canon(card), 'and the comparison sees through it');
  // which is also what the upsert uses, so re-writing a reordered document is a no-op
  const before = (await pool.query(
    'SELECT updated_at FROM player_history WHERE pid=$1', [him.pid])).rows[0].updated_at;
  await writeHistory(pool, [{ name: him.name, pid: him.pid, career: shuffled,
    intl: (await pool.query('SELECT intl FROM player_history WHERE pid=$1', [him.pid])).rows[0].intl,
    mile: (await pool.query('SELECT mile FROM player_history WHERE pid=$1', [him.pid])).rows[0].mile }]);
  const after = (await pool.query(
    'SELECT updated_at FROM player_history WHERE pid=$1', [him.pid])).rows[0].updated_at;
  assert.deepEqual(after, before, 'so a reordered document is not a change');
});

// ---- THE MEN WITHOUT IDS ----------------------------------------------------

test('a cricketer with no id yet is skipped, never written under a null', async () => {
  const r = await writeHistory(pool, [
    { name: 'Nameless', career: { m: 3 } },
    { name: 'Known', pid: 'zz-test-1', career: { m: 1 }, intl: {}, mile: [] }]);
  assert.equal(r.unidentified, 1, 'the man without an id is counted, not written');
  const nulls = (await pool.query(
    'SELECT count(*)::int c FROM player_history WHERE pid IS NULL')).rows[0].c;
  assert.equal(nulls, 0, 'and no row is keyed by nothing');
  await pool.query(`DELETE FROM player_history WHERE pid='zz-test-1'`);
});

test('two clubs claiming one id do not make the write fail', async () => {
  const r = await writeHistory(pool, [
    { name: 'A', pid: 'zz-test-2', career: { m: 1 }, intl: {}, mile: [] },
    { name: 'B', pid: 'zz-test-2', career: { m: 2 }, intl: {}, mile: [] }]);
  assert.equal(r.dupes, 1, 'the collision is reported rather than swallowed');
  assert.equal(r.rows, 1, 'and one row was sent, not two');
  await pool.query(`DELETE FROM player_history WHERE pid='zz-test-2'`);
});
