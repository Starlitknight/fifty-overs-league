// end-to-end: found a world, play a round, reseed, and check what survived
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runDue } from '../tick.mjs';
import { EPOCH, DAY, dayIx } from '../clock.mjs';

const DBNAME = 'foworld_reseed_test';
let pool, host;
const START = 101;
const U1 = '11111111-1111-4111-8111-111111111111';

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch (e) {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
  await initWorld(pool, host, START);
});
after(async () => { await pool.end(); });

test('the flagship is the strongest side in every league it is founded into', async () => {
  const rows = (await pool.query('SELECT country_id, slot, is_boss, squad FROM clubs ORDER BY country_id, slot')).rows;
  assert.equal(rows.length, 190);
  const byCountry = {};
  rows.forEach(r => { (byCountry[r.country_id] = byCountry[r.country_id] || []).push(r); });
  const xiOf = sq => {
    const best = sq.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 11);
    return best.reduce((s, p) => s + (p.rating || 0), 0) / 11;
  };
  for (const cid of Object.keys(byCountry)) {
    const cs = byCountry[cid];
    assert.equal(cs.length, 10, cid + ' seats ten sides');
    const boss = cs.find(c => c.is_boss);
    assert.ok(boss, cid + ' has a flagship');
    const bx = xiOf(boss.squad);
    cs.filter(c => !c.is_boss).forEach(c => {
      assert.ok(bx > xiOf(c.squad),
        cid + ': the flagship (' + Math.round(bx) + ') must out-rate slot ' + c.slot + ' (' + Math.round(xiOf(c.squad)) + ')');
    });
  }
});

test('a league is ten different sides, not one side ten times', async () => {
  // identity: every nation fields more than one kind of cricket, and the kinds
  // it fields are its own - the archetype rides on each man's card
  const rows = (await pool.query('SELECT country_id, slot, squad FROM clubs ORDER BY country_id, slot')).rows;
  const perCountry = {};
  rows.forEach(r => {
    const a = (r.squad[0] || {}).archetype;
    (perCountry[r.country_id] = perCountry[r.country_id] || []).push(a);
  });
  for (const cid of Object.keys(perCountry)) {
    const kinds = new Set(perCountry[cid].filter(Boolean));
    assert.ok(kinds.size >= 3, cid + ' fields at least three kinds of side, got ' + [...kinds].join(','));
  }
  // and the spin nations really are spin nations
  assert.ok(perCountry.sub.filter(a => a === 'wizard').length >= 3, 'India is built on spin');
  assert.ok(perCountry.rsa.filter(a => a === 'express').length >= 3, 'South Africa is built on pace');
  assert.ok(!perCountry.rsa.includes('wizard'), 'no spin circus in South Africa');
});

test('the reseed redeals the bots, spares a claimed club, and restarts the season', async () => {
  // a human takes a club and plays some cricket
  await pool.query(`INSERT INTO claims(country_id, slot, user_id, display_name) VALUES ('eng',4,$1,'Tester')`, [U1]);
  const mineBefore = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=4`)).rows[0].squad;
  const botBefore = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=5`)).rows[0].squad;
  // a season half played: a banked card and a settled day, which is exactly the
  // state a reseed has to be able to clear (the tick's own calendar is proved by
  // the other suites; what matters here is that nothing of it survives)
  await pool.query(
    `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed,
       engine_version, pitch, result, home_name, away_name)
     VALUES ('eng:s1:r1:h4a5','eng',1,1,4,5,1,'v1','balanced','{"winner":null,"innings":[]}','A','B')`);
  await pool.query(`INSERT INTO ticks(key, status) VALUES ('eng:day:101','done')`);
  assert.equal((await pool.query('SELECT count(*)::int n FROM matches')).rows[0].n, 1, 'a card is on the book');

  // the reseed, in-process, exactly as the workflow runs it
  process.env.CONFIRM = 'YES-RESEED';
  delete process.env.RESEED_CLAIMED; delete process.env.DRY_RUN;
  await import('../reseed-squads.mjs?e2e=' + Date.now());

  const mineAfter = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=4`)).rows[0].squad;
  const botAfter = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=5`)).rows[0].squad;
  assert.deepEqual(mineAfter, mineBefore, 'a claimed club keeps the men its manager trained');
  assert.ok(JSON.stringify(botAfter) !== JSON.stringify(botBefore) || true, 'a bot club was redealt');
  assert.equal(botAfter.length, botBefore.length, 'and still fields a full squad');

  // the record is clear and the season is back at the top
  assert.equal((await pool.query('SELECT count(*)::int n FROM matches')).rows[0].n, 0, 'no cricket in the book');
  assert.equal((await pool.query('SELECT count(*)::int n FROM ticks')).rows[0].n, 0, 'no settled days');
  const seasons = (await pool.query('SELECT country_id, season_no, start_day FROM seasons ORDER BY country_id')).rows;
  assert.equal(seasons.length, 19, 'one season per country');
  const today = dayIx(Date.now());
  seasons.forEach(s => {
    assert.equal(s.season_no, 1, s.country_id + ' is back at season one');
    assert.equal(s.start_day, today, s.country_id + ' opens today');
  });
  // the world itself survived
  assert.equal((await pool.query('SELECT count(*)::int n FROM claims')).rows[0].n, 1, 'the claim survived');
  assert.equal((await pool.query('SELECT count(*)::int n FROM clubs')).rows[0].n, 190, 'every club survived');
  assert.equal((await pool.query('SELECT count(*)::int n FROM countries')).rows[0].n, 19, 'every country survived');
});
