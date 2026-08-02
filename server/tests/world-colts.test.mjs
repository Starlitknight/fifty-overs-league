// world-colts.test.mjs — THE COLTS CUP, end to end on a real Postgres.
//
// Founds a world, runs the four days of Colts Week on the real engine, and
// holds the competition to the rules docs/ACADEMY.md states: sixteen clubs in
// one hat, a bracket that holds, fifteen men under twenty-one or forfeit, a
// squad the manager may name and the umpire will name for him, and a purse
// that reaches the bank through the books rather than beside them.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runColtsCup } from '../tick.mjs';
import { computeFinance } from '../economy.mjs';
import { coltsEligible, coltsSide, computeColts, COLTS_STAGES, COLTS_FLOOR, COLTS_CEILING, COLTS_PURSE }
  from '../youth.mjs';
import { EPOCH, DAY, COLTS_DAYS, natHour } from '../clock.mjs';

const DB = 'focolts_test';
let pool, host, startDay;
const UID = '22222222-2222-2222-2222-222222222222';
// the morning after a stage's window has shut, in England's hour
const afterStage = st => EPOCH + (startDay + COLTS_DAYS[st]) * DAY + (natHour('eng') + 4) * 3600000;

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  const r = await initWorld(pool, { now: EPOCH + 1 * DAY, host });
  startDay = r.startDay;
  await pool.query(`INSERT INTO claims(user_id, country_id, slot, display_name) VALUES ($1,'eng',3,'Tester')`, [UID]);
  await pool.query(`CREATE OR REPLACE FUNCTION _uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${UID}'::uuid $$`);
});
after(async () => { if (pool) await pool.end(); });

const clubRow = slot => pool.query(
  `SELECT slot, name, squad, youth FROM clubs WHERE country_id='eng' AND slot=$1`, [slot]).then(r => r.rows[0]);

test('eligibility is every man under 21 on the books, from either list', async () => {
  const c = await clubRow(1);
  const elig = coltsEligible(c);
  assert.ok(elig.length >= COLTS_FLOOR, 'a founded club can raise a side: ' + elig.length);
  for (const p of elig) assert.ok(p.age < 21, p.name + ' is ' + p.age);
  // the academy's boys are all there, and any young professional too
  const boys = (c.youth || []).length;
  const youngPros = (c.squad || []).filter(p => p.age < 21).length;
  assert.equal(elig.length, boys + youngPros, 'both lists count toward the fifteen');
  // and the order is fixed - youngest first - so the umpire's autopick replays
  for (let i = 1; i < elig.length; i++) assert.ok(elig[i].age >= elig[i - 1].age, 'youngest first');
  // SQL agrees with the JavaScript, which is the whole point of having both
  const sql = (await pool.query(`SELECT public.world_colts_eligible('eng', 1) AS r`)).rows[0].r;
  assert.equal(sql.eligible, elig.length, 'the page and the umpire count the same men');
  assert.equal(sql.canField, true);
  assert.deepEqual(sql.men.map(m => m.name), elig.map(p => p.name), 'and in the same order');
});

test('the umpire names a side when nobody did, and honours one when somebody did', async () => {
  const c = await clubRow(1);
  const auto = coltsSide(c, null);
  assert.ok(auto.length >= COLTS_FLOOR && auto.length <= COLTS_CEILING,
    'the umpire names between fifteen and eighteen, got ' + auto.length);
  const elig = coltsEligible(c);
  // a named squad is used as named
  const named = elig.slice(-COLTS_FLOOR).map(p => p.name);
  const picked = coltsSide(c, named);
  assert.deepEqual(picked.map(p => p.name).sort(), named.slice().sort(), 'his men, not the youngest');
  // a squad that has shrunk below the bar is topped up rather than refused -
  // he named a side, and a boy turning 21 is not his fault
  const thin = named.slice(0, 3);
  const topped = coltsSide(c, thin);
  assert.equal(topped.length, COLTS_FLOOR, 'topped up to a legal side');
  for (const n of thin) assert.ok(topped.some(p => p.name === n), n + ' kept his place');
  // and a club that cannot raise fifteen gets no side at all
  assert.equal(coltsSide({ squad: [], youth: [] }, null), null);
});

test('naming a squad is the caller\'s own club, fifteen to eighteen, boys only', async () => {
  const elig = coltsEligible(await clubRow(3));
  const names = elig.slice(0, Math.min(COLTS_CEILING, elig.length)).map(p => p.name);
  assert.ok(names.length >= COLTS_FLOOR, 'the club has a legal squad to name');
  const r = (await pool.query(`SELECT public.world_set_colts_squad($1::jsonb) AS r`,
    [JSON.stringify(names)])).rows[0].r;
  assert.equal(r.ok, true);
  assert.equal(r.named, names.length);
  // fourteen is not a side, nineteen is not a squad, and a man who is not a
  // boy of this club is not eligible however loudly he is named
  await assert.rejects(pool.query(`SELECT public.world_set_colts_squad($1::jsonb)`,
    [JSON.stringify(names.slice(0, 14))]), /fifteen men at least/);
  await assert.rejects(pool.query(`SELECT public.world_set_colts_squad($1::jsonb)`,
    [JSON.stringify(elig.map(p => p.name).concat(['A', 'B', 'C', 'D', 'E']))]), /eighteen men at most/);
  await assert.rejects(pool.query(`SELECT public.world_set_colts_squad($1::jsonb)`,
    [JSON.stringify(names.slice(0, 15).concat(['Nobody At All']))]), /not an under-21 on your books/);
  // and it reads back with the eligible list beside it
  const mine = (await pool.query(`SELECT public.world_my_colts_squad() AS r`)).rows[0].r;
  assert.equal(mine.named.length, names.length);
  assert.ok(mine.men.length >= COLTS_FLOOR);
});

test('a stage plays only once its day has shut, and re-running it plays nothing', async () => {
  // the morning of the last sixteen, before England's window closes
  const tooEarly = EPOCH + (startDay + COLTS_DAYS.r16) * DAY + 1 * 3600000;
  assert.deepEqual(await runColtsCup(pool, host, { now: tooEarly }), [],
    'no tie is played before its window shuts');

  const first = await runColtsCup(pool, host, { now: afterStage('r16') });
  const eng = first.filter(x => x.country === 'eng');
  assert.equal(eng.length, 1);
  assert.equal(eng[0].stage, 'r16');
  assert.equal(eng[0].played, 8, 'sixteen clubs, eight ties, no byes');

  const again = await runColtsCup(pool, host, { now: afterStage('r16') });
  assert.equal(again.filter(x => x.country === 'eng').length, 0, 'the tick key holds');
  const n = (await pool.query(
    `SELECT count(*)::int n FROM cup_matches WHERE comp='colts:eng' AND stage='r16'`)).rows[0].n;
  assert.equal(n, 8, 'and no tie was banked twice');
});

test('the bracket holds: the winners of ties 2k and 2k+1 meet next', async () => {
  const r16 = (await pool.query(
    `SELECT gi, a, b, result FROM cup_matches WHERE comp='colts:eng' AND stage='r16' ORDER BY gi`)).rows;
  const through = r16.map(m => (m.result.winner === m.b.name ? m.b : m.a).slot);
  await runColtsCup(pool, host, { now: afterStage('qf') });
  const qf = (await pool.query(
    `SELECT gi, a, b FROM cup_matches WHERE comp='colts:eng' AND stage='qf' ORDER BY gi`)).rows;
  assert.equal(qf.length, 4);
  qf.forEach((m, i) => {
    assert.equal(m.a.slot, through[i * 2], 'tie ' + i + ' takes the winner of r16 tie ' + (i * 2));
    assert.equal(m.b.slot, through[i * 2 + 1]);
  });
  // every club in the nation was in the hat exactly once
  const seen = new Set();
  for (const m of r16) { seen.add(m.a.slot); seen.add(m.b.slot); }
  assert.equal(seen.size, 16, 'both divisions, one hat, nobody drawn twice');
});

test('a club that cannot name fifteen forfeits, and the bracket says so', async () => {
  // strip one semi-finalist's books of every boy: no academy, no young pros
  const qf = (await pool.query(
    `SELECT gi, a, b, result FROM cup_matches WHERE comp='colts:eng' AND stage='qf' ORDER BY gi`)).rows;
  const victim = (qf[0].result.winner === qf[0].b.name ? qf[0].b : qf[0].a).slot;
  const survivor = (qf[1].result.winner === qf[1].b.name ? qf[1].b : qf[1].a).slot;
  await pool.query(
    `UPDATE clubs SET youth='[]'::jsonb,
       squad = (SELECT coalesce(jsonb_agg(p), '[]'::jsonb) FROM jsonb_array_elements(squad) p
                 WHERE (p->>'age')::numeric >= 21)
      WHERE country_id='eng' AND slot=$1`, [victim]);
  const stripped = await clubRow(victim);
  assert.ok(coltsEligible(stripped).length < COLTS_FLOOR, 'he genuinely cannot raise a side');

  await runColtsCup(pool, host, { now: afterStage('sf') });
  const sf = (await pool.query(
    `SELECT gi, a, b, result, forfeit FROM cup_matches WHERE comp='colts:eng' AND stage='sf' ORDER BY gi`)).rows;
  assert.equal(sf.length, 2);
  const tie = sf.find(m => m.a.slot === victim || m.b.slot === victim);
  assert.ok(tie, 'the stripped club still had a tie');
  assert.ok(tie.forfeit, 'and it is recorded as a forfeit');
  assert.deepEqual(tie.forfeit.short, [victim], 'naming who could not field a side');
  assert.notEqual(tie.result.winner, (tie.a.slot === victim ? tie.a : tie.b).name,
    'he did not go through');
  assert.match(tie.result.text, /could not name fifteen/);
  assert.equal((tie.result.innings || []).length, 0, 'and not a ball was bowled');
  assert.ok(survivor >= 0);
});

test('the final crowns a champion and the purse reaches the bank through the books', async () => {
  await runColtsCup(pool, host, { now: afterStage('final') });
  const board = (await pool.query(
    `SELECT body FROM snapshots WHERE key='colts/eng'`)).rows[0].body;
  assert.equal(board.stagesDone, 4, 'all four days are in the book');
  assert.ok(board.champion, 'the Colts Cup has a champion: ' + board.champion);
  assert.ok(board.finalist);
  assert.equal(board.stages.final.length, 1);

  // the purse: one winner, one beaten finalist, two losing semi-finalists
  const kinds = board.purse.map(p => p.kind).sort();
  assert.deepEqual(kinds, ['finalist', 'semi', 'semi', 'winner']);
  const champSlot = board.championSlot;
  assert.equal(board.purse.find(p => p.kind === 'winner').slot, champSlot);

  // AND IT IS MONEY, not a line in a report. The books walk the bracket, so
  // the champion's statement carries the purse and his bank is that much
  // larger than it would otherwise be.
  const fin = await computeFinance(pool, 'eng', { ledgerSlots: [champSlot] });
  const champ = fin.find(f => f.slot === champSlot);
  assert.equal(champ.finance.coltsPurse, COLTS_PURSE.winner, 'the winner banked the winner\'s purse');
  // and the beaten finalist banked his, which is a different number
  const finalTie = board.stages.final[0];
  const lostSlot = finalTie.winnerSlot === finalTie.homeSlot ? finalTie.awaySlot : finalTie.homeSlot;
  assert.equal(fin.find(f => f.slot === lostSlot).finance.coltsPurse, COLTS_PURSE.finalist);

  // recomputing the books pays it once, not twice
  const again = await computeFinance(pool, 'eng', { ledgerSlots: [champSlot] });
  assert.equal(again.find(f => f.slot === champSlot).finance.coltsPurse, COLTS_PURSE.winner);
  assert.equal(again.find(f => f.slot === champSlot).bank, champ.bank, 'and the bank is the same');
});

test('every boy carries what he actually did, and the board is re-derivable', async () => {
  const a = await computeColts(pool, 'eng', 1);
  const b = await computeColts(pool, 'eng', 1);
  assert.deepEqual(a, b, 'the board is a pure function of the banked ties');
  assert.deepEqual(COLTS_STAGES.filter(k => (a.stages[k] || []).length), COLTS_STAGES);
  // a boy who played has a record on his card
  const played = (await pool.query(
    `SELECT count(*)::int n FROM clubs, jsonb_array_elements(youth) y
      WHERE country_id='eng' AND y ? 'colts'`)).rows[0].n;
  assert.ok(played > 0, 'boys who played carry a Colts record');
  const bad = (await pool.query(
    `SELECT count(*)::int n FROM clubs, jsonb_array_elements(youth) y
      WHERE country_id='eng' AND (y->'colts'->>'m')::int = 0`)).rows[0].n;
  assert.equal(bad, 0, 'and nobody carries an empty one');
});
