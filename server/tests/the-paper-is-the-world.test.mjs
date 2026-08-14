// tests/the-paper-is-the-world.test.mjs — THE PRESS RUN, AGAINST A REAL WORLD.
//
// gazette.mjs's editor is arithmetic and is held exactly elsewhere. This is the
// other half: that the desks read the SERVED record, that the press writes one
// issue a day, and - the thing that matters most - that every story it prints
// is traceable to a row. A newspaper that invents a result is worse than no
// newspaper, because a reader has no way to tell.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runDue } from '../tick.mjs';
import { printGazette } from '../gazette.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DB = 'fopaper_test';
const T0 = EPOCH + 100 * DAY + 12 * 3600000;
let pool, host, at;

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: T0, host });
  for (let d = 1; d <= 6; d++) await runDue(pool, host, 'eng', { now: T0 + d * DAY });
  at = T0 + 6 * DAY;
});
after(async () => { await pool.end(); });

const issue = async () => (await pool.query('SELECT * FROM gazette WHERE id=1')).rows[0];

test('the press prints an issue from the served world', async () => {
  const r = await printGazette(pool, at);
  assert.ok(r.printed, 'it went to press');
  const row = await issue();
  assert.ok(row, 'there is a paper');
  assert.equal(row.world_day, r.day, 'dated today');
  assert.ok(row.issue.lead || row.issue.thin, 'a lead, or an honest admission there is none');
});

// THE LAW EVERY DERIVATION HERE OBEYS. Two runs over one record must print one
// paper - otherwise two readers opening the app a second apart see different
// front pages, which is the single thing this was built not to do.
test('printing twice from one record prints one paper', async () => {
  await printGazette(pool, at);
  const a = await issue();
  const r = await printGazette(pool, at);
  const b = await issue();
  assert.equal(r.printed, false, 'the second run wrote nothing');
  assert.deepEqual(b.issue, a.issue, 'and the paper is the same paper');
  assert.deepEqual(b.printed_at, a.printed_at, 'right down to when it was printed');
});

// NOTHING IS INVENTED. Every headline the paper carries has to be a thing that
// happened, and the honest way to hold that is to check the stories against the
// record rather than to trust the prose.
test('every story the paper prints came off a row', async () => {
  await printGazette(pool, at);
  const iss = (await issue()).issue;
  const all = [iss.lead, iss.second].concat(iss.briefs || [], iss.back || []).filter(Boolean);
  assert.ok(all.length, 'a paper with stories in it');
  const names = new Set((await pool.query(
    `SELECT name FROM clubs`)).rows.map(r => r.name));
  const men = new Set((await pool.query(
    `SELECT p->>'name' n FROM clubs, jsonb_array_elements(squad) p`)).rows.map(r => r.n));
  for (const st of all) {
    assert.ok(st.facts, st.headline + ': a story with no facts behind it');
    const f = st.facts;
    if (f.home) assert.ok(names.has(f.home), 'the paper names a club nobody has: ' + f.home);
    if (f.away) assert.ok(names.has(f.away), 'the paper names a club nobody has: ' + f.away);
    if (f.man) assert.ok(men.has(f.man), 'the paper names a cricketer nobody has: ' + f.man);
  }
});

test('the paper carries no trace of any one reader', async () => {
  await printGazette(pool, at);
  const txt = JSON.stringify((await issue()).issue);
  for (const w of ['user_id', 'claim', 'myClub', 'reader'])
    assert.ok(!txt.includes(w), 'the issue mentions "' + w + '" - it is personal again');
});

// A DAY WITH NOTHING prints a thin paper that says so, never a blank page and
// never yesterday's dressed as today's.
test('a world with no cricket still goes to press', async () => {
  await pool.query('DELETE FROM matches');
  await pool.query('DELETE FROM nat_matches');
  const r = await printGazette(pool, at);
  const iss = (await issue()).issue;
  assert.equal(iss.thin, true, 'the paper admits it: ' + JSON.stringify(r));
  assert.equal(iss.day, r.day, 'and still knows what day it is');
});
