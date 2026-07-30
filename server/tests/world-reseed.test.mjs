// end-to-end: found a world, play a round, reseed, and check what survived
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld, countryConfigs, squadFor } from '../init-world.mjs';
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

  // A REDEAL DEALS DIFFERENT MEN. This assertion used to end in "|| true",
  // which is not an assertion at all - and it was written that way because it
  // could not have passed: the squad seed was the constant 'world1|eng|5', so
  // reseeding re-derived the club from its position and wrote back the very
  // fifteen it already had. A manager who redealt the world to be rid of his
  // side got his side again, and nothing in the suite said so.
  const nm = sq => sq.map(p => p.name);
  assert.notDeepEqual(nm(botAfter), nm(botBefore),
    'a bot club was dealt NEW cricketers, not the same ones re-derived');
  assert.ok(nm(botAfter).filter(n => nm(botBefore).includes(n)).length <= 2,
    'it is a new squad, not a reshuffle - two draws from one name bank may ' +
    'collide on a name, but not on a side');
  assert.equal(botAfter.length, botBefore.length, 'and still fields a full squad');
  assert.equal(new Set(nm(botAfter)).size, botAfter.length, 'fifteen different men');
  assert.equal(
    (await pool.query('SELECT generation FROM worlds WHERE id=1')).rows[0].generation, 2,
    'the world moved to its second generation, which is what made them new');

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

test('a generation is stable inside itself, and never repeats across a redeal', async () => {
  // The two halves of the promise, stated as arithmetic on the seed rather
  // than on a database, so the property is provable rather than observed:
  //
  //   INSIDE a generation the deal is position-stable, which is what lets a
  //   country founded by a later expansion be the country it would have been
  //   on day one - and what lets a bug be reproduced a fortnight later.
  //
  //   ACROSS generations it is not, which is what makes a redeal a redeal.
  const host = makeHost();
  const cfg = countryConfigs(host).find(c => c.id === 'eng');
  const club = cfg.clubs.find(c => c.slot === 5);
  const names = gen => squadFor(host, cfg, club, gen).map(p => p.name);

  const g1 = names(1), g1again = names(1), g2 = names(2), g3 = names(3);
  assert.deepEqual(g1again, g1, 'ask the same generation twice, get the same eleven');
  assert.equal(g1.length, g1again.length);

  // Across generations the deal is independent, so the overlap is whatever
  // chance gives two draws from the same name bank - a stray shared name is
  // ordinary, a shared SQUAD is the bug. Both are stated.
  for (const [a, b, what] of [[g1, g2, '1→2'], [g2, g3, '2→3'], [g1, g3, '1→3']]) {
    assert.notDeepEqual(a, b, 'generation ' + what + ' is not a reprint');
    const shared = a.filter(n => b.includes(n)).length;
    assert.ok(shared <= 2, 'generation ' + what + ' shares at most a stray name, got ' + shared);
  }

  // and generation 1 IS the seed every club alive today was dealt from, so
  // adding the counter did not quietly redeal the running world
  assert.deepEqual(
    names(1),
    host.genSquad('world1|eng|5', cfg.nat, club.arch || cfg.arch, 'general', club.str || 1)
      .map(p => p.name),
    'generation one spells the old constant seed exactly');
});

test('a squad dealt from a new generation is still a squad that can play', async () => {
  // a redeal that produced eleven keepers and no bowlers would be worse than
  // the bug it fixes, so the shape is checked, not just the names
  const host = makeHost();
  for (const id of ['eng', 'sub', 'rsa']) {
    const cfg = countryConfigs(host).find(c => c.id === id);
    for (const club of [cfg.clubs[0], cfg.clubs[4]]) {
      const sq = squadFor(host, cfg, club, 7);
      assert.ok(sq.length >= 15, id + ':' + club.slot + ' has a full squad');
      assert.ok(sq.some(p => p.keeper), id + ':' + club.slot + ' has a keeper');
      assert.ok(sq.filter(p => p.bowlTypeFull && p.bowlTypeFull !== 'none').length >= 5,
        id + ':' + club.slot + ' has an attack');
      assert.ok(sq.every(p => p.name && p.rating > 0 && p.skills),
        'every man is whole - a name, a rating and his skills');
    }
  }
});
