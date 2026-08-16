// finance-register.mjs — THE MONEY'S OWN REGISTER, read-only.
//
// The evidence instrument for the era-2 cutover (migration 101), run by the
// world-report workflow before and after the deploy. It writes nothing; it
// prints, for every club in the world, exactly the figures the cutover
// invariants are stated in:
//
//   bank(stored)    the treasury production last settled
//   bank(walked)    the same figure recomputed by THIS checkout's walk -
//                   run twice, and the register says whether the two walks
//                   agreed to the byte (the idempotency proof, live)
//   bill            the standing wage bill (seniors and boys)
//   wages/rounds    the walk's historical wage total and rounds charged
//   identity        whether the club's finance document reconciles to its
//                   bank through the ledger identity the economy suite holds
//
// ...plus the counts the cutover is judged by: matches, the distinct
// (club, season, round) wage obligations those matches imply (home AND
// away - the walk's own charging condition), and the wage_rounds rows that
// freeze them. Each country also emits one FINREG{...} line of JSON so a
// pre/post comparison can be scripted off the run logs.
//
// Run before the migration, this checkout's walk answers the old law (the
// wage_rounds read is a guarded try/catch and an absent table is an empty
// list), so bank(walked) == bank(stored) is ALSO the proof that the merge
// candidate reproduces production's books before it changes anything.
import { makePool } from './db.mjs';
import { computeFinance } from './economy.mjs';

export async function financeRegister(pool, { only = '' } = {}) {
  console.log('\n==================== FINANCE REGISTER (read-only) ====================');
  let mig = 'unknown';
  try {
    mig = (await pool.query(
      'SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1')).rows[0].name;
  } catch (e) {}
  let wrTotal = null;
  try {
    wrTotal = (await pool.query('SELECT count(*)::int AS n FROM wage_rounds')).rows[0].n;
  } catch (e) { wrTotal = null; }                 // pre-101: the table does not exist
  console.log('latest migration: ' + mig + ' | wage_rounds: ' +
    (wrTotal == null ? 'TABLE ABSENT (pre-101)' : wrTotal + ' rows'));

  const cs = (await pool.query(
    only ? 'SELECT id FROM countries WHERE id=$1' : 'SELECT id FROM countries ORDER BY id',
    only ? [only] : [])).rows;
  let worldBank = 0, worldClubs = 0, allIdentical = true, allIdentity = true;
  for (const c of cs) {
    const clubs = (await pool.query(
      `SELECT slot, name, bank,
              round(coalesce((SELECT sum((p->>'wage')::numeric) FROM jsonb_array_elements(squad) p), 0)
                  + coalesce((SELECT sum((y->>'wage')::numeric) FROM jsonb_array_elements(youth) y), 0))::bigint AS bill
         FROM clubs WHERE country_id=$1 ORDER BY slot`, [c.id])).rows;
    const nMatches = (await pool.query(
      'SELECT count(*)::int AS n FROM matches WHERE country_id=$1', [c.id])).rows[0].n;
    // the obligations the match record implies: one per club per round it
    // appears in, home or away - the walk's own charging condition
    const nOblig = (await pool.query(
      `SELECT count(*)::int AS n FROM (
         SELECT season_no, round, home_slot AS slot FROM matches WHERE country_id=$1
         UNION
         SELECT season_no, round, away_slot FROM matches WHERE country_id=$1) o`, [c.id])).rows[0].n;
    let nWr = null, wrDup = 0;
    try {
      nWr = (await pool.query(
        'SELECT count(*)::int AS n FROM wage_rounds WHERE country_id=$1', [c.id])).rows[0].n;
      wrDup = (await pool.query(
        `SELECT count(*)::int AS n FROM (
           SELECT slot, season_no, round FROM wage_rounds WHERE country_id=$1
           GROUP BY slot, season_no, round HAVING count(*) > 1) d`, [c.id])).rows[0].n;
    } catch (e) { nWr = null; }
    // the walk, twice - the live idempotency proof
    const w1 = await computeFinance(pool, c.id);
    const w2 = await computeFinance(pool, c.id);
    const identical = JSON.stringify(w1.map(r => [r.slot, r.bank, r.finance.wages])) ===
                      JSON.stringify(w2.map(r => [r.slot, r.bank, r.finance.wages]));
    if (!identical) allIdentical = false;
    const rows = clubs.map(k => {
      const r = w1.find(x => x.slot === k.slot) || { bank: null, finance: {} };
      const f = r.finance || {};
      // the ledger identity the economy suite holds, checked live
      const expect = (f.founded || 0) + (f.gate || 0) + (f.awayCut || 0) + (f.broadcast || 0)
        + (f.sponsor || 0) + (f.compensation || 0) + (f.media || 0) + (f.prize || 0)
        + (f.sponsorBonus || 0) + (f.feesIn || 0) + (f.writtenOff || 0) + (f.coltsPurse || 0)
        - (f.wages || 0) - (f.ops || 0) - (f.upkeep || 0) - (f.interest || 0)
        - (f.academyPaid || 0) - (f.seatsPaid || 0)
        - (f.feesOut || 0) - (f.scouting || 0) - (f.academySpend || 0);
      const identity = r.bank != null && Math.round(expect) === r.bank;
      if (!identity) allIdentity = false;
      worldBank += Number(k.bank || 0); worldClubs++;
      return {
        slot: k.slot, stored: Number(k.bank), walked: r.bank,
        bill: Number(k.bill), wages: f.wages ?? null, rounds: f.rounds ?? null,
        identity
      };
    });
    const drift = rows.filter(r => r.walked != null && r.stored !== r.walked).length;
    console.log('\n--- ' + c.id + ': matches ' + nMatches + ' | obligations ' + nOblig +
      ' | wage_rounds ' + (nWr == null ? 'ABSENT' : nWr) +
      (nWr != null && wrDup ? ' | !! DUPLICATE KEYS ' + wrDup : '') +
      ' | walk-twice ' + (identical ? 'IDENTICAL' : '!! DIVERGED') +
      ' | stored-vs-walked drift ' + drift + ' club(s)');
    for (const r of rows) {
      console.log('  slot ' + String(r.slot).padStart(2) +
        '  stored ' + String(r.stored).padStart(12) +
        '  walked ' + String(r.walked).padStart(12) +
        '  bill ' + String(r.bill).padStart(9) +
        '  wages ' + String(r.wages).padStart(13) +
        '  rounds ' + String(r.rounds).padStart(3) +
        (r.identity ? '' : '  !! IDENTITY FAILS'));
    }
    console.log('FINREG ' + JSON.stringify({
      country: c.id, matches: nMatches, obligations: nOblig, wageRounds: nWr,
      dupKeys: wrDup, walkTwice: identical, clubs: rows
    }));
  }
  console.log('\nworld: ' + worldClubs + ' clubs | stored banks sum ' + worldBank +
    ' | every walk idempotent: ' + (allIdentical ? 'YES' : 'NO') +
    ' | every ledger identity holds: ' + (allIdentity ? 'YES' : 'NO'));
  console.log('======================================================================');
}
