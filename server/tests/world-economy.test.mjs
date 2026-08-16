// world-economy.test.mjs — THE ERA-2 ECONOMY'S PROOF OBLIGATIONS.
//
// The redesign (server/financeconfig.mjs; the walk in server/economy.mjs)
// stands on these, each one a way the money could quietly go wrong:
//
//    1. media income is independent of attendance - a full house and an
//       empty one bank the identical installment;
//    2. equal clubs in a division receive identical media money, and a
//       season of installments sums to the grant to the exact dollar;
//    3. only the home club banks matchday money - no away share, no
//       per-head broadcast line, anywhere in the country's books;
//    4. the sponsor's guarantee sums to its share of the signed contract;
//    5. sponsor bonuses trigger on real conditions only: a win pays the
//       winner and never the loser, the title bonus goes to the champion;
//    6. wages are charged every round played, at the bill as it stands;
//    7. club operations are charged every round played, at the composed
//       rate for the club's ground and division;
//    8. academy upkeep is charged every round, at the level's rate;
//    9. a different season length neither creates nor destroys media or
//       sponsor money - the installment arithmetic sums exactly for any R;
//   10. the ledger's lines sum to the treasury's change, to the dollar;
//   11. settling twice never doubles a dollar;
//   12. the season's prizes and milestone bonuses cannot be paid twice;
//   13. transfers stay outside the operating lines - a sale moves feesIn
//       and nothing operating.
//
// The season here is FABRICATED: rows written straight into the matches
// table off the stored schedule, winners chosen by the test. The economy is
// a pure function of that record, so this is not a shortcut - it is the
// point. A fabricated record also lets one file hold a completed season,
// which a played fortnight cannot.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { computeFinance, settleMoney, foundingBankFor, econStature, academyUpkeep } from '../economy.mjs';
import {
  MEDIA_SEASON, SPONSOR_PACKAGES, sponsorSeasonValue, sponsorWinBonus,
  operationsPerRound, prizeFor, PRIZE_PLAYOFF_CHAMP, era2Season, ERA2_DAY
} from '../financeconfig.mjs';
import { FULL_MEMBERS as INIT_FULL } from '../init-world.mjs';
import { FULL_MEMBERS as CFG_FULL } from '../financeconfig.mjs';
import { EPOCH, DAY, ROUNDS } from '../clock.mjs';

const DB = 'foeconomy_test';
const UID = '77777777-7777-7777-7777-777777777777';
let pool, host, clubs, schedule, divisions;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;
const START = 101;                                   // era 2: START >= ERA2_DAY

// the fabricated season's winners, deterministic: the LOWER slot wins every
// league match (so slot 0 takes 14 wins and slot 7 none), the higher seed
// wins each playoff tie
const winnerOf = (h, a) => (h < a ? h : a);

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: T0, host });
  await pool.query(
    `INSERT INTO claims(user_id, country_id, slot, display_name, levelled) VALUES ($1,'eng',1,'Treasurer',true)`, [UID]);
  await pool.query(`CREATE OR REPLACE FUNCTION _uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${UID}'::uuid $$`);
  clubs = (await pool.query(
    `SELECT slot, name, is_boss, seats, academy FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  const sea = (await pool.query(
    `SELECT schedule, divisions FROM seasons WHERE country_id='eng' AND season_no=1`)).rows[0];
  schedule = sea.schedule; divisions = sea.divisions;
  // the whole league season, straight off the stored schedule
  let n = 0;
  const put = (round, h, a, winner) => pool.query(
    `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed,
                         engine_version, pitch, orders, result, home_name, away_name)
     VALUES ($1,'eng',1,$2,$3,$4,$5,'test','fair','{}'::jsonb,$6::jsonb,$7,$8)`,
    ['econ-' + (n++), round, h, a, 1000 + n,
     JSON.stringify({ winner: winner == null ? null : clubs[winner].name }),
     clubs[h].name, clubs[a].name]);
  for (let round = 1; round <= ROUNDS; round++) {
    for (const dv of ['1', '2']) {
      for (const [h, a] of schedule[dv][round - 1]) await put(round, h, a, winnerOf(h, a));
    }
  }
  // the playoffs: top four of each division by the fabricated results. The
  // lower slot won everything, so each division's table is its slots in order.
  for (const dv of ['1', '2']) {
    const mem = divisions[dv].map(Number).sort((x, y) => x - y);
    await put(15, mem[0], mem[3], winnerOf(mem[0], mem[3]));
    await put(15, mem[1], mem[2], winnerOf(mem[1], mem[2]));
    await put(16, mem[0], mem[1], winnerOf(mem[0], mem[1]));
  }
});
after(async () => { if (pool) await pool.end(); });

// one settle of the completed season, shared by most tests below
let fin = null, leds = null;
const settled = async () => {
  if (fin) return;
  const rows = await computeFinance(pool, 'eng',
    { ledgerSlots: clubs.map(c => c.slot), now: EPOCH + (START + 40) * DAY });
  fin = rows; leds = Object.fromEntries(rows.map(r => [r.slot, r.ledger || []]));
};

test('this world settles under era 2, and the config lists agree', async () => {
  assert.ok(era2Season(START), 'a season starting day ' + START + ' is past the era line (' + ERA2_DAY + ')');
  // financeconfig restates init-world's member list because of an import
  // cycle; the two must never drift
  assert.deepEqual(CFG_FULL.slice().sort(), INIT_FULL.slice().sort());
  await settled();
  assert.equal(fin[0].finance.era, 2);
});

test('1+2: media money never reads the turnstiles, and a season sums to the grant', async () => {
  await settled();
  // slot 0 won all 14 and drew the biggest crowds; slot 7 lost all 14. Their
  // media lines are identical anyway - that is the whole point of the line.
  const mediaOf = s => leds[s].filter(l => l.kind === 'media').map(l => l.amount);
  assert.deepEqual(mediaOf(0), mediaOf(7), 'a full house and an empty one bank the same installment');
  for (const c of clubs) {
    const dv = divisions['2'].map(Number).includes(c.slot) ? 2 : 1;
    const lines = mediaOf(c.slot);
    assert.equal(lines.length, ROUNDS, 'slot ' + c.slot + ': one installment per league round, playoffs pay none');
    assert.equal(lines.reduce((a, b) => a + b, 0), MEDIA_SEASON[dv],
      'slot ' + c.slot + ': a season of installments IS the division grant, to the dollar');
  }
});

test('3: matchday money lands only at the ground that hosted', async () => {
  await settled();
  for (const c of clubs) {
    assert.equal(c && fin.find(r => r.slot === c.slot).finance.awayCut, 0);
    assert.equal(fin.find(r => r.slot === c.slot).finance.broadcast, 0);
    assert.equal(leds[c.slot].filter(l => l.kind === 'gate-away').length, 0);
    assert.equal(leds[c.slot].filter(l => l.kind === 'broadcast').length, 0);
    // 7 home league fixtures, plus any playoff tie the slot hosted
    const gates = leds[c.slot].filter(l => l.kind === 'gate');
    assert.ok(gates.length >= 7, 'slot ' + c.slot + ' hosted its seven Sundays');
    for (const g of gates) assert.ok(g.amount > 0);
  }
});

test('4: the guarantee sums to its share of the signed deal', async () => {
  await settled();
  for (const c of clubs) {
    const f = fin.find(r => r.slot === c.slot).finance;
    const sp = leds[c.slot].filter(l => l.kind === 'sponsor');
    assert.equal(sp.length, ROUNDS, 'installments on league rounds only');
    const G = Math.round(f.sponsorValue * SPONSOR_PACKAGES.balanced.guaranteed);
    assert.equal(sp.reduce((a, l) => a + l.amount, 0), G,
      'slot ' + c.slot + ': the season paid the guarantee exactly');
    assert.equal(f.sponsorPackage, 'balanced', 'nobody picked, so everybody signed the default');
  }
});

test('5: bonuses trigger on the record and nothing else', async () => {
  await settled();
  // slot 0 won every round: 14 win bonuses, the playoff-qualification is
  // balanced's (none), and no title bonus either - balanced carries none
  const bon = s => leds[s].filter(l => l.kind === 'sponsor-bonus');
  const f0 = fin.find(r => r.slot === 0).finance;
  const winB = sponsorWinBonus(f0.sponsorValue, 'balanced');
  assert.equal(bon(0).filter(l => /the win/.test(l.label)).length, ROUNDS, 'a win a round, a bonus a round');
  assert.equal(bon(0).filter(l => /the win/.test(l.label)).reduce((a, l) => a + l.amount, 0), ROUNDS * winB);
  // slot 7 never won: not a dollar of win bonus
  assert.equal(bon(7).length, 0, 'the loser earned nothing');
  // balanced carries no playoff or title money, so none was paid to anybody
  for (const c of clubs) {
    assert.equal(bon(c.slot).filter(l => /playoff|champions/.test(l.label)).length, 0,
      'no milestone money under a deal that carries none');
  }
});

test('6+7+8: wages, operations and upkeep are charged every round played, at their stated rates', async () => {
  await settled();
  const bills = (await pool.query(
    `SELECT slot, (SELECT sum((p->>'wage')::numeric) FROM jsonb_array_elements(squad) p) AS bill
       FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  for (const c of clubs) {
    const f = fin.find(r => r.slot === c.slot).finance;
    const dv = divisions['2'].map(Number).includes(c.slot) ? 2 : 1;
    const wage = leds[c.slot].filter(l => l.kind === 'wages');
    const ops = leds[c.slot].filter(l => l.kind === 'ops');
    const up = leds[c.slot].filter(l => l.kind === 'upkeep');
    assert.equal(wage.length, f.rounds, 'a wage line every round played');
    assert.equal(ops.length, f.rounds, 'an operations line every round played');
    assert.equal(up.length, f.rounds, 'an upkeep line every round played');
    const bill = Math.round(Number(bills.find(b => b.slot === c.slot).bill));
    for (const l of wage) assert.equal(-l.amount, bill, 'the bill as it stands');
    for (const l of ops) assert.equal(-l.amount, operationsPerRound(c.seats, dv, 1),
      'the composed rate for ' + c.seats + ' seats in division ' + dv);
    for (const l of up) assert.equal(-l.amount, academyUpkeep(c.academy));
    // playoff participants played 16 rounds and paid 16 rounds; the rest 14
    assert.ok(f.rounds === ROUNDS || f.rounds === ROUNDS + 1 || f.rounds === ROUNDS + 2);
  }
});

test('9: the installment arithmetic cannot create or destroy a dollar at any season length', () => {
  // the walk pays installment r as round(G*r/R) - round(G*(r-1)/R); prove
  // the telescoping sum lands on G exactly for awkward G and every R in reach
  for (const R of [10, 12, 14, 18, 22]) {
    for (const G of [1650000, 2750000, 1234567, 999999, 1]) {
      let sum = 0;
      for (let r = 1; r <= R; r++) sum += Math.round(G * r / R) - Math.round(G * (r - 1) / R);
      assert.equal(sum, G, 'G=' + G + ' over R=' + R);
    }
  }
});

test('10: the statement IS the treasury - every ledger walks to the bank', async () => {
  await settled();
  for (const r of fin) {
    let run = 0;
    for (const l of leds[r.slot]) {
      run += l.amount;
      assert.equal(l.balance, run, 'slot ' + r.slot + ' seq balance holds');
    }
    assert.equal(run, r.bank, 'slot ' + r.slot + ': the last balance is the bank');
    const f = r.finance;
    const expect = f.founded + f.gate + f.awayCut + (f.broadcast || 0) + f.sponsor + (f.compensation || 0)
      + (f.media || 0) + (f.prize || 0) + (f.sponsorBonus || 0)
      + (f.feesIn || 0) + f.writtenOff
      - f.wages - (f.ops || 0) - f.upkeep - f.interest - f.academyPaid - f.seatsPaid
      - (f.feesOut || 0) - (f.scouting || 0) - (f.academySpend || 0);
    assert.equal(r.bank, Math.round(expect), 'slot ' + r.slot + ': the books add up');
    assert.equal(f.founded, foundingBankFor(r.slot, clubs[r.slot].is_boss, true));
  }
});

test('11+12: settling a finished season twice pays every prize exactly once', async () => {
  await settled();
  const again = await computeFinance(pool, 'eng',
    { ledgerSlots: clubs.map(c => c.slot), now: EPOCH + (START + 40) * DAY });
  assert.deepEqual(again.map(r => r.bank), fin.map(r => r.bank), 'banks never drift');
  assert.deepEqual(again.map(r => r.ledger.length), fin.map(r => r.ledger.length),
    'not one line more on the second walk');
  // and the prize itself: exactly one table prize, plus exactly one playoff
  // purse for each division's champion (slot 0 and the top of division two)
  const d2champ = Math.min(...divisions['2'].map(Number));
  for (const c of clubs) {
    const pz = leds[c.slot].filter(l => l.kind === 'prize');
    const isChamp = c.slot === 0 || c.slot === d2champ;
    assert.equal(pz.length, isChamp ? 2 : 1,
      'slot ' + c.slot + ': one place in the table' + (isChamp ? ' and one playoff purse' : ''));
    const dv = divisions['2'].map(Number).includes(c.slot) ? 2 : 1;
    const mem = divisions[String(dv)].map(Number).sort((x, y) => x - y);
    const pos = mem.indexOf(c.slot) + 1;              // the lower slot won everything
    let want = prizeFor(dv, pos, 1);
    if (isChamp) want += PRIZE_PLAYOFF_CHAMP[dv];
    assert.equal(pz.reduce((a, l) => a + l.amount, 0), want,
      'slot ' + c.slot + ' finished ' + pos + ' in division ' + dv);
  }
  // settleMoney writes the same figures it computed
  await settleMoney(pool, 'eng');
  const banked = (await pool.query(
    `SELECT slot, bank FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  for (const b of banked) assert.equal(Number(b.bank), fin.find(r => r.slot === b.slot).bank);
});

test('13: a transfer moves the transfer lines and not one operating line', async () => {
  await settled();
  const before9 = fin.find(r => r.slot === 9).finance;
  // a sale, settled straight into the record the walk reads
  await pool.query(
    `INSERT INTO listings(country_id, slot, player, player_json, asking, reserve,
                          opened_day, closes_day, status, buyer_country, buyer_slot, fee, settled_day)
     VALUES ('eng', 9, 'Test Man', '{}'::jsonb, 100000, 100000, $1, $1, 'sold', 'bank', -1, 100000, $1)`,
    [START + 35]);
  const rows2 = await computeFinance(pool, 'eng', { now: EPOCH + (START + 40) * DAY });
  const after9 = rows2.find(r => r.slot === 9).finance;
  assert.equal(after9.feesIn, before9.feesIn + 100000, 'the fee is in the transfer line');
  for (const k of ['gate', 'media', 'sponsor', 'sponsorBonus', 'prize', 'wages', 'ops', 'upkeep']) {
    assert.equal(after9[k], before9[k], 'operating line ' + k + ' untouched by a sale');
  }
  assert.equal(rows2.find(r => r.slot === 9).bank, fin.find(r => r.slot === 9).bank + 100000);
  await pool.query(`DELETE FROM listings WHERE player='Test Man'`);
  fin = null; leds = null;                     // the record changed; later tests re-walk
});

test('a manager picks a shape and the walk honours it for the season it names', async () => {
  // the RPC: season 1 already has cricket, so a pick binds season 2
  const r1 = (await pool.query(`SELECT world_set_sponsor('contender') AS r`)).rows[0].r;
  assert.equal(r1.ok, true);
  assert.equal(r1.season, 2, 'a season with cricket in the record keeps its signed deal');
  assert.equal(r1.package, 'contender');
  await assert.rejects(pool.query(`SELECT world_set_sponsor('reckless')`), /safe, balanced and contender/);
  // a pick planted for season 1 itself changes the walked money: SAFE pays a
  // bigger guarantee and smaller win bonuses than the default it replaces
  await pool.query(
    `INSERT INTO sponsor_picks(country_id, slot, season_no, package) VALUES ('eng', 0, 1, 'safe')`);
  const rows = await computeFinance(pool, 'eng',
    { ledgerSlots: [0], now: EPOCH + (START + 40) * DAY });
  const f0 = rows.find(r => r.slot === 0).finance;
  assert.equal(f0.sponsorPackage, 'safe');
  const G = Math.round(f0.sponsorValue * SPONSOR_PACKAGES.safe.guaranteed);
  const led0 = rows.find(r => r.slot === 0).ledger;
  assert.equal(led0.filter(l => l.kind === 'sponsor').reduce((a, l) => a + l.amount, 0), G);
  assert.equal(led0.filter(l => l.kind === 'sponsor-bonus').reduce((a, l) => a + l.amount, 0),
    ROUNDS * sponsorWinBonus(f0.sponsorValue, 'safe'));
  await pool.query(`DELETE FROM sponsor_picks WHERE country_id='eng' AND slot=0`);
});

test('a world founded before the era line keeps the founding economy, exactly', async () => {
  // Scotland has no cricket yet; hand it an era-1 calendar and a fabricated
  // round, and the walk must produce the OLD lines: a split gate, a per-head
  // broadcast fee, no media, no operations.
  await pool.query(`UPDATE seasons SET start_day=5 WHERE country_id='sco' AND season_no=1`);
  const sco = (await pool.query(
    `SELECT slot, name FROM clubs WHERE country_id='sco' ORDER BY slot`)).rows;
  const sea = (await pool.query(
    `SELECT schedule FROM seasons WHERE country_id='sco' AND season_no=1`)).rows[0];
  let n = 0;
  for (const dv of ['1', '2']) {
    for (const [h, a] of sea.schedule[dv][0]) {
      await pool.query(
        `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed,
                             engine_version, pitch, orders, result, home_name, away_name)
         VALUES ($1,'sco',1,1,$2,$3,$4,'test','fair','{}'::jsonb,$5::jsonb,$6,$7)`,
        ['sco-econ-' + (n++), h, a, 500 + n,
         JSON.stringify({ winner: sco[h].name }), sco[h].name, sco[a].name]);
    }
  }
  const rows = await computeFinance(pool, 'sco', { now: EPOCH + 10 * DAY });
  for (const r of rows) {
    const f = r.finance;
    assert.equal(f.era, 1, 'slot ' + r.slot + ' still settles under the founding law');
    assert.equal(f.media, 0); assert.equal(f.ops, 0); assert.equal(f.prize, 0);
    if (f.homeMatches > 0) assert.ok(f.broadcast > 0, 'the van still pays by the head in era 1');
    if (f.rounds > f.homeMatches) assert.ok(f.awayCut > 0, 'the third still travels in era 1');
    assert.equal(f.founded, foundingBankFor(r.slot, r.slot === 0, false), 'era-1 founding capital untouched');
  }
  await pool.query(`DELETE FROM matches WHERE country_id='sco'`);
  await pool.query(`UPDATE seasons SET start_day=$1 WHERE country_id='sco' AND season_no=1`, [START]);
});
