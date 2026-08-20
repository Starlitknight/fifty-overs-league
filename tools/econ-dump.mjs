/* tools/econ-dump.mjs — WHAT THE TREASURY ACTUALLY LOOKS LIKE AT THE MOMENT
 *                       THE SOLVENCY ASSERTION FIRES
 *
 * FINAL ECONOMY ACCEPTANCE §1 and §3. The p3 contract fails by $54,167 on one
 * club and the honest question is whether that club is BROKE or merely POORER,
 * which no single bank figure can answer. So this is called from inside the
 * real p3 fixture - the same world, the same cricket, the same day - and
 * prints the whole book: every income line, every cost line, the wage bill,
 * the interest, and whether administration has actually been reached.
 *
 * It then plays the SEASON OUT. A fortnight is a snapshot and a snapshot
 * cannot tell a dip from a spiral: a club that is $50k the wrong side of a
 * buffer in April and back in the black by September has a cash-flow shape,
 * not an insolvency. The per-round walk below is what distinguishes them, and
 * it is why this reports minimum cash as well as closing cash.
 *
 * Nothing here is part of the suite. It runs only under FO_ECON_DUMP, writes
 * to stdout and to docs/, and asserts nothing - the test's own assertion is
 * left to fire exactly as it would have.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeFinance, DEBT_LIMIT, stature } from '../server/economy.mjs';
import { runTick, settleMoney } from '../server/tick.mjs';
import { EPOCH, DAY, dayOfRound } from '../server/clock.mjs';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..',
  'docs', 'fast-bowler-generation');
const $ = n => '$' + Math.round(+n || 0).toLocaleString();
const lines = [];
const say = s => { console.log(s); lines.push(s); };

export async function econDump(pool, host, country, money, opts = {}) {
  const tag = process.env.FO_ECON_TAG || 'head';
  const fin = await computeFinance(pool, country);
  const byslot = {};
  for (const r of fin) byslot[r.slot | 0] = r.finance;
  const clubs = (await pool.query(
    `SELECT slot, name, bank, squad, academy, is_boss FROM clubs WHERE country_id=$1 ORDER BY slot`,
    [country])).rows;

  // THE SQUADS AS THEY STAND AT THIS EXACT MOMENT, kept because the p3 file
  // does not stop here: later tests retire men and empty rosters on purpose,
  // so by the time the run ends the clubs this assertion is about no longer
  // have anybody in them. Re-pricing the payroll under the old law needs the
  // men who were on it when the bank read what it read.
  try {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `econ-squads-${tag}.json`), JSON.stringify(
      (await pool.query(`SELECT slot, name, bank, squad FROM clubs WHERE country_id=$1 ORDER BY slot`,
        [country])).rows));
  } catch (e) { console.log('econ-dump squads write failed:', e.message); }

  say(`\n=== ${tag}: ${country.toUpperCase()} TREASURY AT THE SOLVENCY ASSERTION ===`);
  say(`   the floor the test holds: ${$(-DEBT_LIMIT / 2)}   administration at: ${$(-DEBT_LIMIT)}`);
  say('  slot club              div  bank         wage/rd   ops/rd  upkeep  media/rd  gate(avg)  sponsor  rounds  admin');
  for (const c of clubs) {
    const f = byslot[c.slot | 0] || {};
    const rounds = Math.max(1, f.rounds || 1);
    say('  ' + String(c.slot).padStart(4) + ' ' + String(c.name).slice(0, 17).padEnd(18)
      + String(c.slot < 8 ? 1 : 2).padStart(3)
      + $(c.bank).padStart(13)
      + $(f.wageBill).padStart(10)
      + $((f.ops || 0) / rounds).padStart(9)
      + $((f.upkeep || 0) / rounds).padStart(8)
      + $((f.media || 0) / rounds).padStart(10)
      + $((f.gate || 0) / Math.max(1, f.homeMatches || 1)).padStart(11)
      + $((f.sponsor || 0) / rounds).padStart(9)
      + String(rounds).padStart(8)
      + (f.administration ? '  YES' : '   no'));
  }
  // THE WHOLE PLANET, because sixteen clubs cannot measure an incidence.
  // England is the country this fixture settles deeply, but the planet season
  // played all sixteen nations, and "how many clubs are in trouble" is a
  // question with 256 answers rather than 16. One club in sixteen is noise;
  // one club in 256 is a rate.
  const all = (await pool.query(
    `SELECT country_id, slot, bank FROM clubs ORDER BY country_id, slot`)).rows
    .map(r => ({ c: r.country_id, s: r.slot | 0, b: Number(r.bank) }));
  const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
  const banks = all.map(r => r.b);
  say(`\n  === THE WHOLE PLANET AT THIS MOMENT: ${all.length} clubs in `
    + `${new Set(all.map(r => r.c)).size} countries ===`);
  say(`      p05 ${$(q(banks, .05))}   median ${$(q(banks, .5))}   p95 ${$(q(banks, .95))}`);
  const neg = all.filter(r => r.b < 0), below = all.filter(r => r.b <= -DEBT_LIMIT / 2),
    ruin = all.filter(r => r.b <= -DEBT_LIMIT);
  say(`      overdrawn ${neg.length}/${all.length} (${(100 * neg.length / all.length).toFixed(1)}%)`
    + `   past the test floor ${below.length} (${(100 * below.length / all.length).toFixed(1)}%)`
    + `   in administration ${ruin.length} (${(100 * ruin.length / all.length).toFixed(1)}%)`);
  const bySlot = {};
  for (const r of all) { (bySlot[r.s] = bySlot[r.s] || []).push(r.b); }
  say('      by seat (the same seat in every country):');
  say('        slot ' + Object.keys(bySlot).map(s => String(s).padStart(8)).join(''));
  say('        med  ' + Object.keys(bySlot).map(s =>
    (Math.round(q(bySlot[s], .5) / 1000) + 'k').padStart(8)).join(''));
  say('        <0   ' + Object.keys(bySlot).map(s =>
    String(bySlot[s].filter(v => v < 0).length).padStart(8)).join(''));

  // THE FULL BOOK OF THE WORST CLUB, and of the two clubs either side of it,
  // because a single club's numbers say nothing without the neighbours that
  // took the same weather.
  const sorted = clubs.slice().sort((a, b) => Number(a.bank) - Number(b.bank));
  for (const c of sorted.slice(0, 3)) {
    const f = byslot[c.slot | 0] || {};
    say(`\n  --- FULL BOOK: slot ${c.slot} ${c.name} (division ${c.slot < 8 ? 1 : 2},`
      + ` stature ${stature(c.slot, c.is_boss).toFixed(2)}) ---`);
    say(`      founded on ${$(f.founded)}   now ${$(c.bank)}   over ${f.rounds} rounds`
      + `   (${f.homeMatches} home)`);
    const IN = ['gate', 'awayCut', 'broadcast', 'sponsor', 'sponsorBonus', 'media', 'prize',
      'compensation', 'feesIn'];
    const OUTL = ['wages', 'ops', 'upkeep', 'interest', 'academySpend', 'scouting',
      'feesOut', 'seatsPaid', 'coltsPurse'];
    let ti = 0, to = 0;
    for (const k of IN) if (f[k]) { say(`      + ${k.padEnd(14)} ${$(f[k]).padStart(13)}`); ti += +f[k]; }
    for (const k of OUTL) if (f[k]) { say(`      - ${k.padEnd(14)} ${$(f[k]).padStart(13)}`); to += +f[k]; }
    say(`      = in ${$(ti)}  out ${$(to)}  net ${$(ti - to)}`
      + `   wage share of cost ${(100 * (+f.wages || 0) / Math.max(1, to)).toFixed(1)}%`);
    say(`      supporters ${f.supporters}  seats ${f.seats}  mood ${f.moodWord}`
      + `  attendance ${f.avgAttendance}  academy L${f.academyLevel}`
      + `  written off ${$(f.writtenOff)}  admin ${f.administration ? 'YES' : 'no'}`);
    // WHO IS ON THE WAGE BILL. The decomposition the brief asks for needs the
    // men, not the total.
    const men = (c.squad || []).slice().sort((a, b) => (+b.wage || 0) - (+a.wage || 0));
    say('      top of the wage bill: ' + men.slice(0, 6).map(p =>
      `${p.name} ${p.role || '?'} ovr ${p.rating != null ? Math.round(p.rating / 1000) : '?'} ${$(p.wage)}`).join('; '));
    say(`      squad ${men.length}   payroll ${$(men.reduce((a, p) => a + (+p.wage || 0), 0))}`);
  }

  // -------------------------------------------------------------------------
  // §3 PLAY THE SEASON OUT. A fortnight cannot tell a dip from a spiral.
  // -------------------------------------------------------------------------
  if (opts.seasonOut) {
    const seas = (await pool.query(
      `SELECT season_no, start_day FROM seasons WHERE country_id=$1 ORDER BY season_no DESC LIMIT 1`,
      [country])).rows[0];
    const walk = {};
    for (const c of clubs) walk[c.slot] = { name: c.name, min: Number(c.bank), last: Number(c.bank),
      minRound: 0, adminRounds: 0 };
    let played = 0;
    for (let guard = 0; guard < 20; guard++) {
      const done = Number((await pool.query(
        `SELECT coalesce(max(round),0) AS r FROM matches WHERE country_id=$1 AND season_no=$2`,
        [country, seas.season_no])).rows[0].r);
      const next = done + 1;
      if (next > 18) break;
      const day = seas.start_day + dayOfRound(next);
      await runTick(pool, host, country, day, { now: EPOCH + day * DAY + 18 * 3600000 });
      played++;
      const row = (await pool.query(
        `SELECT slot, bank FROM clubs WHERE country_id=$1 ORDER BY slot`, [country])).rows;
      for (const m of row) {
        const w = walk[m.slot]; const b = Number(m.bank);
        w.last = b;
        if (b < w.min) { w.min = b; w.minRound = next; }
        if (b <= -DEBT_LIMIT) w.adminRounds++;
      }
    }
    say(`\n  === THE REST OF THE SEASON: ${played} further rounds played ===`);
    say('  slot club                 at assertion      minimum (rd)        at season end   admin rds');
    for (const c of clubs) {
      const w = walk[c.slot];
      say('  ' + String(c.slot).padStart(4) + ' ' + String(c.name).slice(0, 18).padEnd(20)
        + $(c.bank).padStart(14) + (`${$(w.min)} (${w.minRound})`).padStart(20)
        + $(w.last).padStart(20) + String(w.adminRounds).padStart(11));
    }
    const under = Object.values(walk).filter(w => w.last < 0);
    const deepEnd = Object.values(walk).filter(w => w.min <= -DEBT_LIMIT / 2);
    const ruined = Object.values(walk).filter(w => w.min <= -DEBT_LIMIT);
    say(`\n  clubs closing the season under water: ${under.length}/16`
      + `   ever below the test floor: ${deepEnd.length}/16`
      + `   ever in administration: ${ruined.length}/16`);
    const finEnd = await computeFinance(pool, country);
    say('  closing wage bill/round across the sixteen: '
      + $(finEnd.reduce((a, r) => a + (+r.finance.wageBill || 0), 0)));

    // §5 A NORMAL BAD SEASON, subtracted rather than simulated. Three things
    // go wrong for a club that has a poor year and none of them is exotic: a
    // fifth fewer people come through the gate, the final table pays it
    // nothing, and the sponsor's win bonuses go unearned. Each of those is a
    // line the books already record, so the stressed season is arithmetic on
    // measured money and not a second model that could be wrong on its own.
    //
    // THE LINES ARE CUMULATIVE AND HAD TO BE PUT BACK ON A PER-SEASON FOOTING.
    // computeFinance reports a club's whole life, and this fixture has played
    // roughly two and a half seasons - so a first cut of this subtracted two
    // and a half seasons of gate money from one season's closing cash and
    // reported eleven clubs ruined by a bad year, which is nonsense and was
    // printed once before it was caught. Every line below is a RATE times the
    // eighteen rounds of one season.
    const SEASON = 18;
    say('\n  === A NORMAL BAD SEASON: gate -20%, no prize cheque, no win bonuses ===');
    say('  slot club                 actual end     stressed end   still solvent');
    let stressedUnder = 0, stressedRuined = 0;
    const stress = [];
    for (const r of finEnd) {
      const f = r.finance, w = walk[r.slot | 0], rounds = Math.max(1, f.rounds || 1);
      const hit = SEASON * (0.20 * (+f.gate || 0) + (+f.prize || 0) + (+f.sponsorBonus || 0)) / rounds;
      const end = w.last - hit;
      if (end < 0) stressedUnder++;
      if (end <= -DEBT_LIMIT) stressedRuined++;
      stress.push({ slot: r.slot, name: w.name, end: w.last, stressed: end, hit });
      say('  ' + String(r.slot).padStart(4) + ' ' + String(w.name).slice(0, 18).padEnd(20)
        + $(w.last).padStart(15) + $(end).padStart(17)
        + (end <= -DEBT_LIMIT ? '   ADMINISTRATION' : end < 0 ? '   overdrawn' : '   yes').padStart(18));
    }
    say(`  under water after a bad season: ${stressedUnder}/16`
      + `   in administration: ${stressedRuined}/16`);
    // and the raw lines, kept so the stress can be re-cut without re-playing
    try {
      fs.writeFileSync(path.join(OUT, `econ-finance-${tag}.json`), JSON.stringify(
        finEnd.map(r => ({ slot: r.slot, name: (walk[r.slot | 0] || {}).name,
          end: (walk[r.slot | 0] || {}).last, min: (walk[r.slot | 0] || {}).min,
          adminRounds: (walk[r.slot | 0] || {}).adminRounds, f: r.finance }))));
    } catch (e) { console.log('econ-dump finance write failed:', e.message); }
  }

  try {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `econ-dump-${tag}.txt`), lines.join('\n') + '\n');
  } catch (e) { console.log('econ-dump write failed:', e.message); }
}
