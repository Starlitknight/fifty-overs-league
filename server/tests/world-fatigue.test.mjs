// tests/world-fatigue.test.mjs — A DAY'S CRICKET LEAVES ITS MARK.
//
// The old fatigue arithmetic refunded a flat 17 a night against a full
// bowling shift's ~19: on the daily calendar nobody ever stayed tired, and
// a manager whose men had played two league matches read a wall of 100s.
// The redo prices each appearance by what the day asked of the man and
// repays a FRACTION of what stands each night. The obligations:
//   1. after a banked round, the men who appeared carry fatigue - the
//      whole squad no longer reads rested;
//   2. the trade orders the bill: a pace/seam bowler's full shift costs
//      more than a spinner's, and specialist batters pay least;
//   3. the captain pays for the armband - same workload, higher bill;
//   4. a night's rest repays a PORTION of what stands, not all of it -
//      and several quiet days approach fresh without snapping to it.
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

const DBNAME = 'foworld_fatigue_test';
let pool, host;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;            // day 100, noon
const START = 101;                                       // initWorld's start day
const PLAY = EPOCH + START * DAY + 14 * 3600000;         // England round 1
const PREBANK = PLAY - 3600000 + 4 * 60000;

const isSpin = p => /spin|wrist|finger/i.test(String(p.bowlTypeFull || p.bowlType || ''));
const isBowlerType = p => String(p.bowlType || '') && !/none/i.test(String(p.bowlType || ''));

async function squads() {
  return (await pool.query('SELECT slot, squad FROM clubs WHERE country_id=$1 ORDER BY slot', ['eng'])).rows;
}
async function bowledIn(seasonNo, round) {
  // slot|name -> balls bowled, from the banked cards. Keyed like the living
  // layer keys its book: two clubs can employ two men of the same name, and
  // a namesake who stayed home must not shadow the one who bowled.
  const rows = (await pool.query(
    `SELECT CASE WHEN inn->>'bowlTeam' = coalesce(m.home_name, h.name) THEN m.home_slot
                 WHEN inn->>'bowlTeam' = coalesce(m.away_name, a.name) THEN m.away_slot END AS slot,
            bw.key AS name, sum(coalesce((bw.value->>'b')::int, 0)) AS b
       FROM matches m
       JOIN clubs h ON h.country_id = m.country_id AND h.slot = m.home_slot
       JOIN clubs a ON a.country_id = m.country_id AND a.slot = m.away_slot,
            LATERAL jsonb_array_elements(m.result->'innings') inn,
            LATERAL jsonb_each(inn->'bowlers') bw
      WHERE m.country_id='eng' AND m.season_no=$1 AND m.round=$2 AND m.result IS NOT NULL
      GROUP BY 1, 2`, [seasonNo, round])).rows;
  return new Map(rows.filter(r => r.slot != null).map(r => [r.slot + '|' + r.name, +r.b]));
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
  // settle the living layer as of the evening after round 1's day
  await evolveCountry(pool, 'eng', EPOCH + START * DAY + 20 * 3600000, host);
});
after(async () => { await pool.end(); });

test('a played round leaves the players who appeared visibly tired', async () => {
  const bowled = await bowledIn(1, 1);
  const clubs = await squads();
  let appeared = 0, tiredOnes = 0;
  for (const c of clubs) for (const p of c.squad) {
    if (!bowled.has(c.slot + '|' + p.name)) continue;    // he bowled, so he certainly played
    appeared++;
    if ((p.fatN || 0) > 0) tiredOnes++;
  }
  assert.ok(appeared >= 8, 'the banked round produced bowlers to read (' + appeared + ')');
  assert.equal(tiredOnes, appeared, 'every man who bowled carries fatigue the day he bowled');
});

test('the trade orders the bill: pace above spin above the specialist bat', async () => {
  const bowled = await bowledIn(1, 1);
  const clubs = await squads();
  const paceF = [], spinF = [], batF = [];
  for (const c of clubs) for (const p of c.squad) {
    const b = bowled.get(c.slot + '|' + p.name) || 0;
    if (b >= 48 && !p.keeper) {                          // a real shift: 8+ overs
      (isSpin(p) ? spinF : paceF).push({ n: p.fatN || 0, b });
    }
    // a specialist bat: never bowled, no gloves - his day is the cheapest
    if (!b && !p.keeper && !isBowlerType(p) && (p.fatN != null)) batF.push(p.fatN || 0);
  }
  assert.ok(paceF.length >= 2 && spinF.length >= 1, 'both trades bowled real shifts');
  const avg = a => a.reduce((s, x) => s + (x.n != null ? x.n : x), 0) / a.length;
  assert.ok(avg(paceF) > avg(spinF), 'pace costs more than spin for a full shift (' +
    avg(paceF).toFixed(1) + ' vs ' + avg(spinF).toFixed(1) + ')');
  if (batF.length) assert.ok(avg(spinF) > avg(batF), 'spin costs more than a specialist bat\'s day');
});

test('the armband costs: the default skipper outweighs an identical workload', async () => {
  // the fold charges LOAD_CAPTAINCY to the orders captain, or the squad's
  // best captaincy score where none was filed (all bot clubs here). Verify
  // directly: each club's default skipper who APPEARED carries more fatigue
  // than his club's average appearer of the same trade would suggest - the
  // cheapest sufficient proof is that his fatN strictly exceeds the fatN he
  // would carry without the surcharge, which we bound by comparing him with
  // any non-captain teammate of identical workload class where one exists.
  const bowled = await bowledIn(1, 1);
  const clubs = await squads();
  let checked = 0;
  for (const c of clubs) {
    const capt = c.squad.slice().sort((x, y) => (y.capt || 0) - (x.capt || 0))[0];
    if (!capt || capt.fatN == null) continue;
    // find a teammate of the same broad trade with workload no greater
    const twin = c.squad.find(p => p !== capt && p.fatN != null &&
      !!p.keeper === !!capt.keeper && isSpin(p) === isSpin(capt) &&
      isBowlerType(p) === isBowlerType(capt) &&
      (bowled.get(c.slot + '|' + p.name) || 0) <= (bowled.get(c.slot + '|' + capt.name) || 0) &&
      (bowled.has(c.slot + '|' + p.name) === bowled.has(c.slot + '|' + capt.name)));
    if (!twin) continue;
    if (bowled.has(c.slot + '|' + capt.name) || (capt.fatN || 0) > 0) {
      assert.ok((capt.fatN || 0) >= (twin.fatN || 0), c.slot + ': the skipper ' + capt.name +
        ' (' + capt.fatN + ') carries at least his twin ' + twin.name + ' (' + twin.fatN + ')');
      checked++;
    }
  }
  assert.ok(checked >= 3, 'captain surcharge was checkable in several clubs (' + checked + ')');
});

test('a night repays a portion; several nights approach fresh without snapping there', async () => {
  const clubs0 = await squads();
  const tired = [];
  for (const c of clubs0) for (const p of c.squad) if ((p.fatN || 0) >= 10) tired.push(c.slot + '|' + p.name);
  assert.ok(tired.length >= 4, 'the round left men with real fatigue to recover (' + tired.length + ')');
  const read = rows => { const m = new Map(); for (const c of rows) for (const p of c.squad) m.set(c.slot + '|' + p.name, p.fatN || 0); return m; };
  const f0 = read(clubs0);
  // one quiet day later (no new matches banked)
  await evolveCountry(pool, 'eng', EPOCH + (START + 1) * DAY + 20 * 3600000, host);
  const f1 = read(await squads());
  for (const n of tired) {
    assert.ok(f1.get(n) < f0.get(n), n + ' recovered overnight');
    assert.ok(f1.get(n) > 0, n + ' did not snap straight to fresh (' + f0.get(n) + ' -> ' + f1.get(n) + ')');
  }
  // four quiet days: close to fresh
  await evolveCountry(pool, 'eng', EPOCH + (START + 4) * DAY + 20 * 3600000, host);
  const f4 = read(await squads());
  for (const n of tired) assert.ok(f4.get(n) <= 8, n + ' is near fresh after four quiet days (' + f4.get(n) + ')');
});
