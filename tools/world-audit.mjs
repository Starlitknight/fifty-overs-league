#!/usr/bin/env node
/* tools/world-audit.mjs — WHAT THE WORLD ACTUALLY LOOKS LIKE.
 *
 * Reads a founded world out of Postgres and prints the population, club and
 * national-team audits: how many cricketers sit in each band of the 0-100 card
 * scale, what every squad averages, and who the world's best players are.
 *
 *   node tools/world-audit.mjs                 # human-readable
 *   node tools/world-audit.mjs --json          # machine-readable, for diffing
 *   PGDATABASE=foaudit node tools/world-audit.mjs
 *
 * IT MEASURES, IT NEVER GENERATES. Every OVR here comes from the SHIPPED
 * engine's own `foPkOvr` through enginehost, so this cannot hold a second
 * opinion of what a man is worth - which is the whole point of an audit. Run
 * it before and after a balance change and diff the two.
 */
import { makePool } from '../server/db.mjs';
import { makeHost } from '../server/enginehost.mjs';
import { nationMen, selectSquad, badgeUp } from '../server/nations.mjs';
import { isFullMember } from '../server/init-world.mjs';

const JSONOUT = process.argv.includes('--json');
const pool = makePool();
const host = makeHost();

const q = (n, xs) => {                    // the n-th quantile of a sorted copy
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * n)))];
};
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const r1 = x => Math.round(x * 10) / 10;

// THE BANDS ARE THE OWNER'S OWN, so the audit answers the question that was
// asked rather than one that happens to be easy to compute.
const BANDS = [[0, 20], [21, 40], [41, 60], [61, 80], [81, 90], [91, 94], [95, 97], [98, 100]];
const bandOf = o => BANDS.findIndex(([lo, hi]) => o >= lo && o <= hi);

// A CLUB'S TIER IS A FACT ABOUT THE WORLD, and until the migration writes one
// down it has to be inferred - slot 0 is the flagship, 1-7 the rest of the
// first division, 8-15 the second. Inferring it here is exactly the duplication
// the brief asks to be replaced by explicit metadata; this reads the column
// when it exists and falls back so the tool runs against an un-migrated world.
function tierOf(club) {
  if (club.strength_tier) return club.strength_tier;
  if (club.is_boss) return 'flagship';
  if (club.slot < 8) return 'div1';
  return 'div2';
}

const clubs = (await pool.query(
  `SELECT c.country_id, c.slot, c.name, c.is_boss, c.squad,
          co.name AS country_name
     FROM clubs c JOIN countries co ON co.id = c.country_id
    ORDER BY c.country_id, c.slot`)).rows;
if (!clubs.length) { console.error('no world found - found one first (node server/init-world.mjs)'); process.exit(1); }

// ---- every cricketer in the world, with the card the game shows -----------
const people = [];       // {name, ovr, country, club, slot, tier, age, role, rating, wage}
const clubRows = [];
for (const c of clubs) {
  const squad = c.squad || [];
  if (!squad.length) continue;
  const ovrs = host.pkOvr(squad);
  const tier = tierOf(c);
  squad.forEach((p, i) => {
    const o = ovrs[i] | 0;
    people.push({ name: p.name, ovr: o, country: c.country_id, countryName: c.country_name,
                  club: c.name, slot: c.slot, tier, age: p.age | 0, role: p.role,
                  keeper: !!p.keeper, bowls: !!p.bowlType, rating: p.rating | 0, wage: p.wage | 0 });
  });
  const os = ovrs.map(x => x | 0);
  clubRows.push({
    country: c.country_id, countryName: c.country_name, club: c.name, slot: c.slot, tier,
    size: squad.length, mean: r1(mean(os)), median: q(0.5, os),
    best: Math.max(...os), worst: Math.min(...os),
    n80: os.filter(x => x >= 80).length, n90: os.filter(x => x >= 90).length,
    keepers: squad.filter(p => p.keeper || p.role === 'wicketkeeper').length,
    bowlers: squad.filter(p => p.bowlType).length
  });
}

// ---- national squads, through the umpire's own selector ------------------
const natRows = [];
for (const id of [...new Set(clubs.map(c => c.country_id))]) {
  // THE SQUAD, NOT THE COUNTRY'S WHOLE POPULATION. nationMen returns every
  // eligible cricketer in the nation - 240 of them - and averaging that answers
  // "how good is this country's cricket", which is a different question from
  // "how good is its national side". The selector and the badge lift are the
  // umpire's own, so this is the fifteen that actually take the field.
  let men = [];
  try { men = badgeUp(id, selectSquad(await nationMen(pool, id))); } catch (e) { continue; }
  if (!men.length) continue;
  const os = host.pkOvr(men).map(x => x | 0);
  natRows.push({
    country: id, full: isFullMember(id), size: men.length,
    mean: r1(mean(os)), median: q(0.5, os), hi: Math.max(...os), lo: Math.min(...os),
    n80: os.filter(x => x >= 80).length, n85: os.filter(x => x >= 85).length,
    n90: os.filter(x => x >= 90).length, n95: os.filter(x => x >= 95).length
  });
}

// ---- the population -------------------------------------------------------
const counts = BANDS.map(() => 0);
people.forEach(p => { const b = bandOf(p.ovr); if (b >= 0) counts[b]++; });
const elite = people.filter(p => p.ovr >= 90).sort((a, b) => b.ovr - a.ovr);

const report = {
  players: people.length, clubs: clubRows.length,
  population: BANDS.map(([lo, hi], i) => ({ band: lo + '-' + hi, n: counts[i],
    pct: r1(counts[i] / people.length * 100) })),
  elite: elite.map(p => ({ name: p.name, ovr: p.ovr, age: p.age, club: p.club,
                           country: p.country, tier: p.tier })),
  clubs_detail: clubRows,
  tiers: {}, nations: natRows,
  wages: { p50: q(0.5, people.map(p => p.wage)), p90: q(0.9, people.map(p => p.wage)),
           max: Math.max(...people.map(p => p.wage)) }
};
for (const t of [...new Set(clubRows.map(c => c.tier))]) {
  const rows = clubRows.filter(c => c.tier === t);
  report.tiers[t] = { teams: rows.length, avgTeamOvr: r1(mean(rows.map(c => c.mean))),
    weakestTeam: r1(Math.min(...rows.map(c => c.mean))),
    strongestTeam: r1(Math.max(...rows.map(c => c.mean))),
    avgBestPlayer: r1(mean(rows.map(c => c.best))) };
}

if (JSONOUT) { console.log(JSON.stringify(report, null, 1)); await pool.end(); process.exit(0); }

const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);
console.log('\n=== POPULATION (' + report.players + ' cricketers, ' + report.clubs + ' clubs) ===');
report.population.forEach(b => console.log('  ' + pad(b.band, 8) + num(b.n, 6) + '  ' +
  num(b.pct + '%', 7) + '  ' + '#'.repeat(Math.round(b.pct / 2))));
console.log('\n=== EVERY 90+ PLAYER IN THE WORLD (' + report.elite.length + ') ===');
if (!report.elite.length) console.log('  none.');
report.elite.slice(0, 60).forEach(p => console.log('  ' + num(p.ovr, 3) + '  ' + pad(p.name, 24) +
  ' age ' + num(p.age, 2) + '  ' + pad(p.club, 26) + ' ' + p.tier));

console.log('\n=== TIERS ===');
console.log('  ' + pad('tier', 12) + num('teams', 6) + num('avgOVR', 8) + num('weakest', 9) +
  num('strongest', 11) + num('avgBest', 9));
for (const [t, v] of Object.entries(report.tiers))
  console.log('  ' + pad(t, 12) + num(v.teams, 6) + num(v.avgTeamOvr, 8) + num(v.weakestTeam, 9) +
    num(v.strongestTeam, 11) + num(v.avgBestPlayer, 9));

console.log('\n=== NATIONAL SQUADS ===');
console.log('  ' + pad('nation', 8) + pad('kind', 11) + num('n', 3) + num('avg', 7) + num('med', 6) +
  num('hi', 5) + num('lo', 5) + num('80+', 6) + num('85+', 6) + num('90+', 6) + num('95+', 6));
natRows.sort((a, b) => b.mean - a.mean).forEach(n => console.log('  ' + pad(n.country, 8) +
  pad(n.full ? 'full member' : 'associate', 11) + num(n.size, 3) + num(n.mean, 7) + num(n.median, 6) +
  num(n.hi, 5) + num(n.lo, 5) + num(n.n80, 6) + num(n.n85, 6) + num(n.n90, 6) + num(n.n95, 6)));

console.log('\n=== CLUBS (worst and best ten by squad mean) ===');
const sorted = clubRows.slice().sort((a, b) => a.mean - b.mean);
const show = r => console.log('  ' + pad(r.country, 5) + pad(r.club, 26) + pad(r.tier, 10) +
  num(r.size, 3) + num(r.mean, 7) + num(r.median, 6) + num(r.best, 6) + num(r.worst, 6) +
  num(r.n80, 5) + num(r.n90, 4) + '   wk' + r.keepers + ' bowl' + r.bowlers);
console.log('  ' + pad('nat', 5) + pad('club', 26) + pad('tier', 10) + num('n', 3) + num('mean', 7) +
  num('med', 6) + num('best', 6) + num('worst', 6) + num('80+', 5) + num('90+', 4));
sorted.slice(0, 10).forEach(show);
console.log('  ...');
sorted.slice(-10).forEach(show);
console.log('\n  wages: median ' + report.wages.p50 + ', p90 ' + report.wages.p90 +
  ', max ' + report.wages.max);
await pool.end();
