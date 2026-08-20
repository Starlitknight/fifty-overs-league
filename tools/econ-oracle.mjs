#!/usr/bin/env node
/* tools/econ-oracle.mjs — IS THE SEAT MODEL THE GAME? (the honest version)
 *
 * tools/economy-validate.mjs asked this question already and answered it
 * against a TRANSCRIPT: three clubs whose books were dumped out of a world-p3
 * fixture months ago. That transcript is now worthless as an oracle, because
 * the world it came from predates two shipped laws - the play-off central
 * installment and OPS_TOPFLIGHT_ROUND at 30,000 - so every disagreement it
 * reports is a mixture of "the model is wrong" and "the game moved". You
 * cannot debug a model against a moving oracle.
 *
 * Worse, all three clubs in it were DIVISION ONE, slots 3, 6 and 7. Every one
 * of them sits ABOVE the econStature floor (slot 7 is 0.65, the floor is
 * 0.62), and for every one of them the club's rank in its division is within
 * a place or two of its rank in the country. So the transcript could not have
 * caught either of the things this phase turns out to hinge on: what the
 * floor does, and which ladder the crowd reads.
 *
 * So: build a world, settle it through the SHIPPED computeFinance, and compare
 * the model to it line by line - for all sixteen seats, both divisions.
 *
 *   node tools/econ-oracle.mjs               league season only (cleanest)
 *   node tools/econ-oracle.mjs --playoffs    with the two play-off rounds
 *   node tools/econ-oracle.mjs --era1        settle before the era line
 *
 * Nothing here is evidence about the economy. It is evidence about the tool.
 */
import { execSync } from 'node:child_process';
import { makePool } from '../server/db.mjs';
import { migrate } from '../server/migrate.mjs';
import { initWorld } from '../server/init-world.mjs';
import { makeHost } from '../server/enginehost.mjs';
import { computeFinance } from '../server/economy.mjs';
import { EPOCH, DAY, ROUNDS } from '../server/clock.mjs';

const DB = 'foecon_oracle';
const withPlayoffs = process.argv.includes('--playoffs');
const era1 = process.argv.includes('--era1');
// era 2 needs a season that opens on or after ERA2_DAY; era 1 needs one before
const START = era1 ? 5 : 101;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;

export const $ = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();

// THE FABRICATED SEASON. The lower slot wins every meeting, so each division's
// final table is simply its slots in order - which makes every club's finish,
// its win count and its national rank exactly computable, and that is what the
// model has to be fed to be compared fairly.
const winnerOf = (h, a) => (h < a ? h : a);

export async function buildWorld() {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  const pool = makePool(), host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: T0, host });
  await pool.query(`UPDATE seasons SET start_day=$1 WHERE country_id='eng' AND season_no=1`, [START]);
  const clubs = (await pool.query(
    `SELECT slot, name, is_boss, seats, academy, squad, youth FROM clubs
      WHERE country_id='eng' ORDER BY slot`)).rows;
  const sea = (await pool.query(
    `SELECT schedule, divisions FROM seasons WHERE country_id='eng' AND season_no=1`)).rows[0];
  let n = 0;
  const put = (round, h, a, winner) => pool.query(
    `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed,
                         engine_version, pitch, orders, result, home_name, away_name)
     VALUES ($1,'eng',1,$2,$3,$4,$5,'test','fair','{}'::jsonb,$6::jsonb,$7,$8)`,
    ['orc-' + (n++), round, h, a, 1000 + n,
     JSON.stringify({ winner: winner == null ? null : clubs[winner].name }),
     clubs[h].name, clubs[a].name]);
  for (let round = 1; round <= ROUNDS; round++) {
    for (const dv of ['1', '2']) {
      for (const [h, a] of sea.schedule[dv][round - 1]) await put(round, h, a, winnerOf(h, a));
    }
  }
  if (withPlayoffs) {
    for (const dv of ['1', '2']) {
      const mem = sea.divisions[dv].map(Number).sort((x, y) => x - y);
      await put(15, mem[0], mem[3], winnerOf(mem[0], mem[3]));
      await put(15, mem[1], mem[2], winnerOf(mem[1], mem[2]));
      await put(16, mem[0], mem[1], winnerOf(mem[0], mem[1]));
    }
  }
  const fin = await computeFinance(pool, 'eng',
    { ledgerSlots: clubs.map(c => c.slot), now: EPOCH + (START + 40) * DAY });
  return { pool, clubs, divisions: sea.divisions, fin };
}

// WHAT THE CLUB ACTUALLY DID, in the terms the model takes. The wage bill is
// read off the settled books rather than re-derived, so a disagreement here
// can never be a disagreement about the squad.
// THE CROWD RANKS A CLUB AGAINST THE WHOLE COUNTRY, AND THE TWO DIVISIONS ARE
// POOLED ON RAW POINTS. economy.mjs's posMap() sorts `clubs` - all sixteen -
// by `b.pts - a.pts || b.played - a.played || a.slot - b.slot`, and nothing in
// that comparison knows which division a club plays in. So the champion of
// Division Two, on fourteen wins, stands SECOND in its country's table behind
// the Division One champion on fourteen wins - not ninth - and its supporters
// answer accordingly. The eighth club in Division One, on no wins at all,
// stands fifteenth. Assuming the national order was simply the slot order got
// the whole shape of the residual wrong: it overstated the bottom of Division
// One by up to 65% and understated the top of Division Two by 20%.
export function nationalRank(reals) {
  const order = reals.slice().sort((a, b) => (b.wins * 2) - (a.wins * 2) || a.slot - b.slot);
  const m = {}; order.forEach((x, i) => { m[x.slot] = i + 1; });
  return m;
}

export function realOf(r, divisions) {
  const f = r.finance;
  const dv = divisions['1'].map(Number).includes(r.slot) ? 1 : 2;
  const mem = divisions[String(dv)].map(Number).sort((a, b) => a - b);
  return {
    slot: r.slot, div: dv,
    pos: mem.indexOf(r.slot) + 1,               // where it finished in its division
    // the lower slot beats everyone below it - TWICE. Eight clubs over
    // fourteen rounds is a double round robin, so a club at index i takes
    // 2*(7-i) wins, not (7-i). Getting this wrong halves every sponsor win
    // bonus and hands the club the mood of a worse season than it had.
    wins: 2 * (7 - mem.indexOf(r.slot)),
    rounds: f.rounds, home: f.homeMatches,
    wageRound: f.rounds ? Math.round(f.wages / f.rounds) : 0,
    gate: f.gate, media: f.media, sponsor: f.sponsor, sponsorBonus: f.sponsorBonus,
    prize: f.prize, ops: f.ops, upkeep: f.upkeep, wages: f.wages, interest: f.interest,
    supporters: f.supporters, att: f.avgAttendance, seats: f.seats,
    bank: r.bank, founded: f.founded, era: f.era
  };
}

if (process.argv[1] && process.argv[1].endsWith('econ-oracle.mjs')) {
  const { pool, divisions, fin } = await buildWorld();
  const reals = fin.map(r => realOf(r, divisions)).sort((a, b) => a.slot - b.slot);
  const nat = nationalRank(reals);
  for (const R of reals) R.posCountry = nat[R.slot];
  console.log(`=== A SETTLED WORLD, era ${reals[0].era}, `
    + `${reals[0].rounds} rounds${withPlayoffs ? ' (play-offs included)' : ''} ===`);
  console.log('  slot div pos  natpos   seats   supp     att   wage/rd'
    + '      gate/yr    media/yr   sponsor/yr      ops/yr    NET/yr    end bank');
  for (const R of reals) {
    const rev = R.gate + R.media + R.sponsor + R.sponsorBonus + R.prize;
    const cost = R.wages + R.ops + R.upkeep + R.interest;
    console.log('  ' + String(R.slot).padStart(4) + String(R.div).padStart(4)
      + String(R.pos).padStart(4) + String(R.posCountry).padStart(8)
      + String(R.seats).padStart(8) + String(R.supporters).padStart(7)
      + String(R.att).padStart(8) + $(R.wageRound).padStart(10)
      + $(R.gate).padStart(13) + $(R.media).padStart(12) + $(R.sponsor + R.sponsorBonus).padStart(13)
      + $(R.ops).padStart(12) + $(rev - cost).padStart(10) + $(R.bank).padStart(12));
  }
  console.log(JSON.stringify(reals) && '');
  const fs = await import('node:fs');
  const tag = (era1 ? 'era1' : 'era2') + (withPlayoffs ? '-po' : '');
  fs.writeFileSync(`/tmp/econ-oracle-${tag}.json`, JSON.stringify(reals, null, 1));
  console.log(`\n  written: /tmp/econ-oracle-${tag}.json`);
  await pool.end();
}
