// world-notifications.test.mjs — THE GAME LEARNS TO SPEAK.
//
// The world had a bell that was gated on the retired private-league mode, knew
// about friendly challenges and nothing else, and kept what you had read in
// localStorage - so a manager could be relegated, sold a player, called up for
// his country and left with an unanswered scout on the table without the game
// saying a word, and reading his news on a phone left it unread on a laptop.
//
// What replaces it copies From the Pavilion's split, because it is the split
// that makes a management game playable:
//
//   NEWS is what happened, and it goes stale once read.
//   ASKS are what is waiting on you, and being READ does not answer them -
//   only DOING them does.
//
// And it obeys the law 037 set for the club feed: nothing is stored that the
// record already knows. The one exception is the read watermark, because
// whether you have read something is a decision and no derivation recovers it.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runDue } from '../tick.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DB = 'fonotif_test';
const UID = '77777777-7777-7777-7777-777777777777';
let pool, host;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;
const START = 101;

const ask = (n, kind) => n.asks.filter(a => a.kind === kind)[0];
// THE BELL KEEPS THE BROADCAST'S CLOCK (069): a played round is silent until
// its window closes, so every read here happens on the WORLD clock, that
// evening - not on the wall clock, which sits months before the test world.
const NOWMS = EPOCH + START * DAY + 20 * 3600000;
async function atWorld(sql) {
  const c = await pool.connect();
  try {
    await c.query(`SELECT set_config('world.now_ms', $1, false)`, [String(NOWMS)]);
    return await c.query(sql);
  } finally {
    await c.query(`SELECT set_config('world.now_ms', '', false)`).catch(() => {});
    c.release();
  }
}
const notif = async () => (await atWorld('SELECT world_my_notifications(60) n')).rows[0].n;

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: T0, host });
  await pool.query(
    `INSERT INTO claims(user_id, country_id, slot, display_name, levelled) VALUES ($1,'eng',1,'Tester',true)`, [UID]);
  await pool.query(`CREATE OR REPLACE FUNCTION _uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${UID}'::uuid $$`);
  await runDue(pool, host, 'eng', { now: EPOCH + START * DAY + 14 * 3600000 - 3600000 + 4 * 60000 });
});
after(async () => { if (pool) await pool.end(); });

test('a signed-out reader is told nothing, and is not an error', async () => {
  await pool.query(`CREATE OR REPLACE FUNCTION _uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$`);
  const n = await notif();
  assert.equal(n.ok, true, 'the door does not slam');
  assert.equal(n.signedIn, false);
  assert.equal(n.unread, 0);
  assert.deepEqual(n.asks, []);
  await pool.query(`CREATE OR REPLACE FUNCTION _uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${UID}'::uuid $$`);
});

test('the match you played is the news, and it knows whether you won', async () => {
  const n = await notif();
  const m = n.news.filter(x => x.kind === 'match');
  assert.ok(m.length >= 1, 'the round that was played is in the news');
  assert.ok(/^(You beat |You lost to |Round \d+ ended level)/.test(m[0].title),
    'and it is written from this club\'s side: ' + m[0].title);
  assert.ok(m[0].body && m[0].body.length > 5, 'with the umpire\'s own line under it');
  assert.ok(m[0].go && m[0].go.indexOf('#/') === 0, 'and a door to walk through');
});

test('an unanswered scout is an ASK, and reading it does not answer him', async () => {
  await pool.query(
    `INSERT INTO academy_scouts(country_id, slot, world_day, nation, tier, fee, recruit, decision)
     VALUES ('eng',1,$1,'aus','good',45000,'{"name":"Ollie Vance"}'::jsonb,NULL)`, [START]);
  let n = await notif();
  const a = ask(n, 'scout-waiting');
  assert.ok(a, 'the boy on the table is an ask');
  assert.ok(a.body.indexOf('Ollie Vance') >= 0, 'and he is named: ' + a.body);
  assert.ok(a.body.indexOf('Australia') >= 0, 'with where he was found');

  // READING IS NOT ANSWERING. This is the whole difference between an ask and
  // a piece of news, and the thing the old localStorage bell got wrong.
  await atWorld('SELECT world_notifications_seen()');
  n = await notif();
  assert.ok(ask(n, 'scout-waiting'), 'he is still waiting after the bell was opened');
  assert.ok(n.unread >= 1, 'and he still counts toward the badge');

  // ANSWERING IS ANSWERING. The ask is derived from a null decision, so it
  // cannot survive the decision being made - there is nothing to clean up.
  await pool.query(`UPDATE academy_scouts SET decision='release' WHERE country_id='eng' AND slot=1`);
  n = await notif();
  assert.ok(!ask(n, 'scout-waiting'), 'and he is gone the moment he is answered');
});

test('news goes stale when it is read; the watermark is the whole mechanism', async () => {
  await pool.query('DELETE FROM notif_seen');
  let n = await notif();
  const freshBefore = n.news.filter(x => x.fresh).length;
  assert.ok(freshBefore >= 1, 'unread news to begin with (' + freshBefore + ')');
  await atWorld('SELECT world_notifications_seen()');
  n = await notif();
  const stale = n.news.filter(x => x.fresh);
  assert.equal(stale.length, 0,
    'nothing already banked is fresh after reading: ' + stale.map(x => x.kind).join(', '));
  // the news itself is not deleted - it is history, and history stays
  assert.ok(n.news.length >= 1, 'the news is still there to re-read');
});

test('the money speaks for itself, and administration shouts', async () => {
  await pool.query(`UPDATE clubs SET bank=-40000, finance='{}'::jsonb WHERE country_id='eng' AND slot=1`);
  let a = ask(await notif(), 'money');
  assert.ok(a, 'an overdraft is an ask');
  assert.equal(a.urgent, false, 'in the red is a warning');
  assert.ok(a.title.indexOf('red') >= 0, a.title);

  await pool.query(`UPDATE clubs SET finance='{"admin":true}'::jsonb WHERE country_id='eng' AND slot=1`);
  a = ask(await notif(), 'money');
  assert.equal(a.urgent, true, 'administration is urgent');
  assert.ok(a.title.indexOf('administration') >= 0, a.title);

  await pool.query(`UPDATE clubs SET bank=500000, finance='{}'::jsonb WHERE country_id='eng' AND slot=1`);
  assert.ok(!ask(await notif(), 'money'), 'and a club in the black is not nagged');
});

test('the academy asks: a side it cannot field; the boys leave quietly (070)', async () => {
  const club = (await pool.query(`SELECT youth FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  // a full academy of sixteen-year-olds: nobody short
  const young = (club.youth || []).map(y => Object.assign({}, y, { age: 16 }));
  await pool.query(`UPDATE clubs SET youth=$1::jsonb WHERE country_id='eng' AND slot=1`,
    [JSON.stringify(young)]);
  let n = await notif();
  assert.ok(!ask(n, 'colts-short'), 'a full academy is not short');
  assert.ok(!ask(n, 'boys-leaving'), 'and nobody is about to walk');

  // one of them turns twenty: 070 retired the warning - the squad room says
  // his age beside his promote button, and the bell says nothing
  young[0].age = 20;
  await pool.query(`UPDATE clubs SET youth=$1::jsonb WHERE country_id='eng' AND slot=1`,
    [JSON.stringify(young)]);
  assert.ok(!ask(await notif(), 'boys-leaving'), 'a twenty-year-old no longer rings the bell (070)');

  // and an academy below the Colts Cup bar still says so
  await pool.query(`UPDATE clubs SET youth=$1::jsonb WHERE country_id='eng' AND slot=1`,
    [JSON.stringify(young.slice(0, 9))]);
  const short = ask(await notif(), 'colts-short');
  assert.ok(short, 'nine boys cannot field a Colts Cup side');
  assert.ok(short.body.indexOf('9') >= 0, 'and it says how many are there: ' + short.body);
  await pool.query(`UPDATE clubs SET youth=$1::jsonb WHERE country_id='eng' AND slot=1`,
    [JSON.stringify(club.youth)]);
});

test('every notification carries a door, and no notification is empty', async () => {
  // A notification that cannot be acted on is a notification that annoys.
  await pool.query(`UPDATE clubs SET bank=-1 WHERE country_id='eng' AND slot=1`);
  await pool.query(
    `INSERT INTO academy_scouts(country_id, slot, world_day, nation, tier, fee, recruit, decision)
     VALUES ('eng',1,$1,'nzl','average',45000,'{"name":"Reece Tallow"}'::jsonb,NULL)`, [START + 1]);
  const n = await notif();
  assert.ok(n.asks.length >= 2 && n.news.length >= 1, 'there is something of each to check');
  for (const x of n.asks.concat(n.news)) {
    assert.ok(x.kind, 'every entry is typed');
    assert.ok(x.title && x.title.length > 3, 'and titled: ' + JSON.stringify(x).slice(0, 90));
    assert.ok(x.go && /^#\//.test(x.go), x.kind + ' has a door: ' + x.go);
    assert.ok(String(x.title).indexOf('null') < 0 && String(x.body || '').indexOf('null') < 0,
      x.kind + ' printed a null: ' + x.title + ' / ' + x.body);
    assert.ok(String(x.title).indexOf('undefined') < 0, x.kind + ' printed an undefined');
  }
});

test('one manager never reads another manager\'s bell', async () => {
  const OTHER = '88888888-8888-8888-8888-888888888888';
  await pool.query(
    `INSERT INTO claims(user_id, country_id, slot, display_name, levelled) VALUES ($1,'eng',2,'Rival',true)`, [OTHER]);
  await pool.query(`CREATE OR REPLACE FUNCTION _uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${OTHER}'::uuid $$`);
  const n = await notif();
  assert.equal(n.claim.slot, 2, 'the rival reads his own club');
  assert.ok(!ask(n, 'scout-waiting'), 'and not the scout waiting at somebody else\'s academy');
  assert.ok(!ask(n, 'money'), 'nor the overdraft at somebody else\'s club');
  await pool.query(`CREATE OR REPLACE FUNCTION _uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${UID}'::uuid $$`);
});

test('the badge is asks plus fresh news, and nothing else', async () => {
  await pool.query('DELETE FROM notif_seen');
  const n = await notif();
  const fresh = n.news.filter(x => x.fresh).length;
  assert.equal(n.unread, n.asks.length + fresh,
    'the count on the bell is exactly what is waiting plus what is new');
});
