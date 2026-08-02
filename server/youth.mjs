// youth.mjs — THE YOUTH ACADEMY
//
// docs/ACADEMY.md is the authority. In short: a manager scouts one boy per
// rest day from a nation of his choosing, sees everything about him, and
// either signs him onto the wage bill or lets him go. He trains in the
// ordinary nets on the ordinary curve. He leaves at twenty-one whether or not
// anyone gave him a senior shirt.
//
// THERE IS NO POTENTIAL ATTRIBUTE. Nothing here stores what a boy will become,
// because nothing knows: what he becomes is what the shipped training law does
// to the skills he already has, and that law is not ours to touch. A tier only
// decides WHERE HE STARTS. Everything the manager needs in order to judge him
// is therefore on the card in front of him - his skills, his rating, his age -
// which is the whole of the game the academy plays.
//
// The consequence is worth stating plainly, because it is the design and not
// an accident: the nets move a boy about a tenth of his rating over four
// seasons, so they CONFIRM a signing rather than transform it. A boy who
// arrives forty per cent short of your first XI will still be short of it when
// he turns twenty-one. That is why a dud is readable at the moment you sign
// him, and why age is half the read - a sixteen-year-old rates lower than a
// twenty-year-old of the same tier and is the better prospect, because he has
// five seasons of academy in front of him rather than one.
import { countryConfigs } from './init-world.mjs';

// a boy is sixteen to twenty when he is found, and he is gone at twenty-one
export const RECRUIT_MIN_AGE = 16;
export const RECRUIT_AGES = 5;                // 16, 17, 18, 19, 20
export const LEAVE_AT = 21;
// the Colts Cup bar, and so also what the world founds an academy with and
// what the umpire keeps an UNMANAGED club topped up to
export const ACADEMY_FLOOR = 15;
// a senior staff is twenty men, the same number world_colt refuses to exceed
export const SQUAD_CAP = 20;
// and a cricketer does not go on forever
export const RETIRE_AT = 38;
// what a level costs is the books' business, not the academy's
export { academyUpkeep, ACADEMY_BUILD, SCOUT_FEE_ABROAD, PROMOTE_FEE } from './economy.mjs';

// the same 32-bit hash the client and the world generator use
function h32(s) {
  let h = 2166136261 >>> 0;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
const rnd01 = s => h32(s) / 4294967296;

// ---------------------------------------------------------------------------
// THE LOTTERY
//
// Four tiers. The headline rates - a jewel under one in a hundred, a good boy
// under one in twenty, average about forty-five per cent and the rest never
// worth a shirt - are the rates a LEVEL THREE academy turns out. A level one
// academy is meaner and a level five kinder, which is the whole of what a
// level buys you besides the bill.
// ---------------------------------------------------------------------------
export const TIERS = ['jewel', 'good', 'average', 'poor'];
const TIER_ODDS = {
  1: [0.002, 0.020, 0.380],
  2: [0.005, 0.035, 0.430],
  3: [0.009, 0.050, 0.470],
  4: [0.015, 0.070, 0.510],
  5: [0.025, 0.100, 0.550]
};
export function tierOdds(level) { return TIER_ODDS[Math.max(1, Math.min(5, +level || 2))]; }
export function tierOf(level, seed) {
  const [jewel, good, average] = tierOdds(level);
  const r = rnd01(seed + '|tier');
  if (r < jewel) return 'jewel';
  if (r < jewel + good) return 'good';
  if (r < jewel + good + average) return 'average';
  return 'poor';
}

// WHAT A TIER IS WORTH, in the only currency there is: how much of a grown
// cricketer the boy already is. `pools` is how many generated squads he is
// picked out of - three squads to find a jewel, one to find anybody - `rank`
// is where in that field he stands, and `share` is how much of that man has
// arrived. Measured against a real generated squad, this puts a jewel at
// roughly the median senior and a poor boy below the worst of them, which is
// exactly the read the manager is being asked to make.
const TIER_CUT = {
  jewel:   { pools: 3, rank: 'best',  share: 0.97 },
  good:    { pools: 1, rank: 'best',  share: 0.86 },
  average: { pools: 1, rank: 'mid',   share: 0.88 },
  poor:    { pools: 1, rank: 'worst', share: 0.85 }
};
// and a year of growing is worth five per cent of the man, so a sixteen-year-
// old of any tier reads lower than a twenty-year-old of the same one
const ageShare = age => 0.80 + 0.05 * (age - RECRUIT_MIN_AGE);

// A RECRUIT. A pure function of (nation, archetype, tier, seed), so the same
// boy appears on every re-run and the umpire and the manager never disagree
// about who walked through the door.
export function makeRecruit(host, nat, arch, tier, seed) {
  const cut = TIER_CUT[tier] || TIER_CUT.poor;
  let men = [];
  for (let i = 0; i < cut.pools; i++) {
    const got = host.genSquad(seed + '|pool' + i, nat, arch || 'balanced', 'general');
    if (got && got.length) men = men.concat(got);
  }
  if (!men.length) return null;
  men.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (a.name < b.name ? -1 : 1));
  const man = cut.rank === 'best' ? men[0]
            : cut.rank === 'mid' ? men[men.length >> 1]
            : men[men.length - 1];
  const age = RECRUIT_MIN_AGE + h32(seed + '|age') % RECRUIT_AGES;
  const share = cut.share * ageShare(age);

  const p = JSON.parse(JSON.stringify(man));
  const sk = {};
  for (const k in (p.skills || {})) sk[k] = Math.max(1, Math.round(p.skills[k] * share));
  p.skills = sk;
  p.age = age;
  p.colt = true;
  p.nat = nat;
  p.from = nat;                                   // where he was found, for his card
  if (typeof p.exp === 'number') p.exp = Math.max(1, Math.round(p.exp * share));
  // the fifteen skills are the man; his batting, his threat, his rating and
  // his WAGE are the engine's function of them, so let the engine work them
  // out rather than scaling the answers by hand. A boy is cheap because a boy
  // is small, not because anybody discounted him.
  const boy = host.derive([p])[0] || p;
  // the cricketer he was made IS the boy, not the man he was cut down from -
  // so the nets build on the boy, and nothing he does in the academy is ever
  // mistaken for training he has not done
  boy.baseSkills = JSON.parse(JSON.stringify(boy.skills || {}));
  boy.baseExp = boy.exp;
  delete boy.career; delete boy.formIx; delete boy.formWord;
  delete boy.fatN; delete boy.fatWord; delete boy.trainProgress;
  return boy;
}

// the nation config the world was founded from: an England boy is an England
// cricketer, and a nation's ARCHETYPE is its flavour - rsa turns out express
// bowlers, sub and slk turn out wizards. Every nation still produces every
// kind of cricketer; it only leans.
export function nationsOf(host) {
  return countryConfigs(host).map(r => ({ id: r.id, name: r.name, nat: r.nat, arch: r.arch }));
}
function archOf(host, country) {
  const r = countryConfigs(host).filter(x => x.id === country)[0];
  return r ? { nat: r.nat, arch: r.arch } : { nat: 'England', arch: 'balanced' };
}

// THE SEED A SCOUTING TRIP RUNS ON. One boy per club per world day per nation,
// and the academy level is in it - so a club that builds a better academy is
// not handed the same boys it would have been handed anyway.
export function scoutSeed(country, slot, worldDay, nation, level) {
  return 'scout|' + country + '|' + slot + '|d' + worldDay + '|' + nation + '|L' + level;
}
export function scoutRecruit(host, { country, slot, worldDay, nation, level }) {
  const cfg = archOf(host, nation);
  const seed = scoutSeed(country, slot, worldDay, nation, level);
  const tier = tierOf(level, seed);
  const boy = makeRecruit(host, cfg.nat, cfg.arch, tier, seed);
  return boy ? { tier, nation, recruit: boy } : null;
}

// ---------------------------------------------------------------------------
// FOUNDING AND KEEPING THE WORLD'S ACADEMIES STOCKED
//
// Every club in the world is founded with fifteen boys, so the first Colts Cup
// is a real competition rather than sixteen walkovers. After that the umpire
// keeps UNMANAGED clubs topped up to fifteen - they are the world's furniture
// and have to keep turning up - and never touches a club with a human in
// charge. A manager scouts, signs, pays, and forfeits if he lets the list slip.
// ---------------------------------------------------------------------------
export function foundAcademy(host, country, slot, level, tag) {
  const cfg = archOf(host, country);
  const out = [];
  // KEEP GOING UNTIL THERE ARE FIFTEEN. The name banks are finite, so two of
  // the first fifteen seeds sometimes turn out the same lad - and a club that
  // was founded with fourteen boys would forfeit its first Colts Cup tie
  // through no decision of anybody's. Walk on past the collision instead.
  for (let i = 0; out.length < ACADEMY_FLOOR && i < ACADEMY_FLOOR * 6; i++) {
    const seed = 'academy|' + country + '|' + slot + '|' + (tag || 'found') + '|' + i;
    const boy = makeRecruit(host, cfg.nat, cfg.arch, tierOf(level, seed), seed);
    if (boy && !out.some(y => y.name === boy.name)) out.push(boy);
  }
  return out;
}

// Fill every UNMANAGED academy back to the floor. Idempotent by name, and
// keyed on the world day so a re-run of the same tick makes the same boys.
export async function stockAcademies(pool, host, country, { worldDay }) {
  const clubs = (await pool.query(
    `SELECT c.slot, c.academy, c.youth, (cl.user_id IS NOT NULL) AS managed
       FROM clubs c LEFT JOIN claims cl ON cl.country_id = c.country_id AND cl.slot = c.slot
      WHERE c.country_id = $1 ORDER BY c.slot`, [country])).rows;
  const cfg = archOf(host, country);
  let added = 0;
  for (const c of clubs) {
    if (c.managed) continue;                      // his academy is his own affair
    const youth = Array.isArray(c.youth) ? c.youth : [];
    if (youth.length >= ACADEMY_FLOOR) continue;
    let n = 0;
    while (youth.length < ACADEMY_FLOOR && n < ACADEMY_FLOOR * 3) {
      const seed = 'stock|' + country + '|' + c.slot + '|d' + worldDay + '|' + (n++);
      const boy = makeRecruit(host, cfg.nat, cfg.arch, tierOf(c.academy, seed), seed);
      if (boy && !youth.some(y => y && y.name === boy.name)) { youth.push(boy); added++; }
    }
    await pool.query('UPDATE clubs SET youth=$3::jsonb WHERE country_id=$1 AND slot=$2',
      [country, c.slot, JSON.stringify(youth)]);
  }
  return added;
}

// ---------------------------------------------------------------------------
// THE ROLLOVER. A year on everybody, and then the two things a year does:
//
//   1. a man who has reached thirty-eight hangs them up.
//   2. a boy who has reached twenty-one LEAVES. Not promoted, not listed, not
//      placed elsewhere - gone, and the wages his club paid him were the price
//      of finding out. A week before the turning of the year the manager is
//      told which boys are about to walk, which is the whole of the warning he
//      gets and the whole of the warning he needs.
//
// Nothing is promoted automatically any more. A senior shirt costs a flat fee
// and is a decision, so the umpire has no business handing them out.
//
// Keyed by season, so a re-run never ages anybody twice.
// ---------------------------------------------------------------------------
export async function ageYouth(pool, country, seasonNo) {
  const key = country + ':youth:s' + seasonNo;
  const claim = await pool.query(
    `INSERT INTO ticks(key, status) VALUES ($1,'running')
     ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING status`, [key]);
  if (claim.rows[0].status === 'done') {
    return { skipped: true, promoted: 0, retired: 0, released: 0, madeWay: 0 };
  }
  const clubs = (await pool.query(
    'SELECT slot, squad, youth FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  let retired = 0, released = 0;
  for (const c of clubs) {
    // 1. a year on the professionals, and the oldest hang them up
    const aged = (c.squad || []).map(p => Object.assign({}, p, { age: (p.age || 27) + 1 }));
    const squad = aged.filter(p => (p.age || 0) < RETIRE_AT);
    retired += aged.length - squad.length;

    // 2. a year on the boys, and the twenty-one-year-olds walk out of the world
    const youth = (Array.isArray(c.youth) ? c.youth : [])
      .map(y => Object.assign({}, y, { age: (y.age || 18) + 1 }));
    const stay = youth.filter(y => y.age < LEAVE_AT);
    released += youth.length - stay.length;

    await pool.query('UPDATE clubs SET youth=$3::jsonb, squad=$4::jsonb WHERE country_id=$1 AND slot=$2',
      [country, c.slot, JSON.stringify(stay), JSON.stringify(squad)]);
  }
  await pool.query(`UPDATE ticks SET status='done', finished_at=now() WHERE key=$1`, [key]);
  return { skipped: false, promoted: 0, retired, released, madeWay: 0 };
}

// who walks at the next turning of the year - the list the warning is built
// from. A pure read of the boys on the books.
export function leavingAt(youth) {
  return (Array.isArray(youth) ? youth : []).filter(y => y && (y.age || 0) + 1 >= LEAVE_AT);
}

// ---------------------------------------------------------------------------
// LAYING OUT THE CANDIDATES
//
// The scout button has to answer instantly, and a recruit can only be made by
// the cricket engine, which the database cannot run. So the umpire lays out
// every boy a manager could possibly be shown - one per nation, for each rest
// day within reach - and world_scout only reveals the one he paid to see.
//
// Only CLAIMED clubs get candidates: nobody else presses the button, and
// laying them for two hundred and fifty bot clubs would be work for nothing.
// Everything is a pure function of (club, day, nation, level), so a re-run of
// any tick lays out exactly the same boys.
// ---------------------------------------------------------------------------
export async function layCandidates(pool, host, country, { worldDay, restDays, startDay, ahead = 2 }) {
  const clubs = (await pool.query(
    `SELECT c.slot, c.academy FROM clubs c
       JOIN claims cl ON cl.country_id = c.country_id AND cl.slot = c.slot
      WHERE c.country_id = $1 ORDER BY c.slot`, [country])).rows;
  if (!clubs.length) return 0;
  const nations = nationsOf(host);
  // the rest days from here on, today included, and only the next few
  const days = (restDays || [])
    .map(di => startDay + di)
    .filter(d => d >= worldDay)
    .slice(0, ahead);
  if (!days.length) return 0;
  let laid = 0;
  for (const c of clubs) {
    for (const day of days) {
      for (const n of nations) {
        const seed = scoutSeed(country, c.slot, day, n.id, c.academy);
        const tier = tierOf(c.academy, seed);
        const boy = makeRecruit(host, n.nat, n.arch, tier, seed);
        if (!boy) continue;
        const r = await pool.query(
          `INSERT INTO academy_candidates(country_id, slot, world_day, nation, tier, recruit)
                VALUES ($1,$2,$3,$4,$5,$6::jsonb)
           ON CONFLICT (country_id, slot, world_day, nation) DO NOTHING`,
          [country, c.slot, day, n.id, tier, JSON.stringify(boy)]);
        laid += r.rowCount;
      }
    }
  }
  // a boy nobody was ever going to be shown is not worth keeping
  await pool.query('DELETE FROM academy_candidates WHERE country_id=$1 AND world_day < $2',
    [country, worldDay - 1]);
  return laid;
}

// ===========================================================================
// THE COLTS CUP
//
// Nine fixtures, one on every second league round, played by the umpire on
// the real engine. Nobody picks the side and nobody submits anything: it is
// the colts plus the youngest men on the senior staff, which is what a
// Seconds side has always been. That is deliberate - a competition an
// offline manager cannot lose by being offline.
//
// The draw is the league's own first single round robin: the Colts round k
// is league round k's fixture list, played on league round 2k. So the boys
// meet every other club in the country exactly once, and there is no second
// schedule to keep honest.
//
// Nothing here touches a senior first-class record. Youth cricket is youth
// cricket; what it leaves behind is the table, the champion, and each boy's
// own Colts record, all recomputed from the banked scorecards.
// ===========================================================================
export const COLTS_ROUNDS = 9;
const COLTS_SQUAD = 13;                    // the boys, then the youngest men

export function coltsRoundOf(leagueRound) {
  return (leagueRound % 2 === 0 && leagueRound / 2 <= COLTS_ROUNDS) ? leagueRound / 2 : 0;
}
export function youthMatchId(country, seasonNo, round, h, a) {
  return country + ':s' + seasonNo + ':y' + round + ':h' + h + 'a' + a;
}

// THE SIDE, picked by nobody. Colts first - it is their competition - then
// the youngest senior professionals until there are enough men to field an
// eleven with something in reserve. Sorted so the engine's own autopick has
// the same thirteen in the same order on every replay.
export function coltsSquad(club) {
  const byAge = (a, b) => (a.age || 30) - (b.age || 30) || (a.name < b.name ? -1 : 1);
  const colts = (Array.isArray(club.youth) ? club.youth : []).slice().sort(byAge);
  const seniors = (club.squad || []).slice().sort(byAge);
  // an academy holds at most seven, so there is always room for the youngest
  // professionals to make the number up
  return colts.concat(seniors.slice(0, Math.max(0, COLTS_SQUAD - colts.length)));
}

// one Colts round, if this league round has one. Idempotent per fixture.
export async function playColtsRound(pool, host, country, season, leagueRound, seedOf, engineVersion) {
  const round = coltsRoundOf(leagueRound);
  if (!round) return 0;
  // the boys' fixtures mirror the seniors': both divisions of the pyramid
  // (a pre-pyramid season row still carries the flat array)
  const sched = season.schedule;
  const fixtures = Array.isArray(sched) ? (sched[round - 1] || [])
    : (((sched['1'] || [])[round - 1]) || []).concat(((sched['2'] || [])[round - 1]) || []);
  const clubs = (await pool.query(
    'SELECT slot, name, squad, youth FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  const bySlot = Object.fromEntries(clubs.map(c => [c.slot, c]));
  let played = 0;
  for (const [hs, as] of fixtures) {
    const id = youthMatchId(country, season.season_no, round, hs, as);
    if ((await pool.query('SELECT 1 FROM youth_matches WHERE id=$1', [id])).rowCount) continue;
    const home = bySlot[hs], away = bySlot[as];
    if (!home || !away) continue;
    const hSide = coltsSquad(home), aSide = coltsSquad(away);
    if (hSide.length < 11 || aSide.length < 11) continue;   // no side, no fixture
    const seed = seedOf(id);
    const resultJson = host.runMatch(
      { name: home.name + ' Colts', players: hSide }, { name: away.name + ' Colts', players: aSide },
      'balanced', seed, null);
    if (!resultJson) throw new Error('engine failed to complete ' + id);
    await pool.query(
      `INSERT INTO youth_matches(id, country_id, season_no, round, league_round, home_slot, away_slot,
                                 home_name, away_name, seed, engine_version, result, result_canonical)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::text) ON CONFLICT (id) DO NOTHING`,
      [id, country, season.season_no, round, leagueRound, hs, as,
       home.name + ' Colts', away.name + ' Colts', seed, engineVersion, resultJson, resultJson]);
    played++;
  }
  return played;
}

// THE TABLE AND THE CARD, derived purely from the banked youth scorecards -
// re-runnable, never drifting, and speaking the clubs' CURRENT names.
export async function computeColts(pool, country, seasonNo) {
  const clubs = (await pool.query(
    'SELECT slot, name, is_boss FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  const ms = (await pool.query(
    'SELECT * FROM youth_matches WHERE country_id=$1 AND season_no=$2 ORDER BY round, id',
    [country, seasonNo])).rows;
  const bySlot = Object.fromEntries(clubs.map(c => [c.slot, c]));
  const T = Object.fromEntries(clubs.map(c => [c.slot,
    { slot: c.slot, name: c.name, p: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0, of: 0, oa: 0 }]));
  const results = [], PS = {};
  for (const m of ms) {
    const r = m.result;
    const slotOf = nm => nm === m.home_name ? m.home_slot : nm === m.away_name ? m.away_slot : null;
    for (const inn of (r.innings || [])) {
      if (!inn) continue;
      const bs = slotOf(inn.batTeam), os = slotOf(inn.bowlTeam);
      if (bs == null || os == null) continue;
      T[bs].rf += inn.runs; T[bs].of += inn.wkts >= 10 ? 50 : inn.legal / 6;
      T[os].ra += inn.runs; T[os].oa += inn.wkts >= 10 ? 50 : inn.legal / 6;
      for (const b of (inn.bat || [])) {
        const nm = b.p && b.p.name; if (!nm) continue;
        const e = PS[nm] = PS[nm] || { name: nm, club: bySlot[bs].name, runs: 0, hs: 0, wkts: 0, conc: 0 };
        e.runs += (b.r || 0); if ((b.r || 0) > e.hs) e.hs = b.r || 0;
      }
      for (const nm in (inn.bowlers || {})) {
        const bw = inn.bowlers[nm];
        const e = PS[nm] = PS[nm] || { name: nm, club: bySlot[os].name, runs: 0, hs: 0, wkts: 0, conc: 0 };
        e.wkts += (bw.w || 0); e.conc += (bw.r || 0);
      }
    }
    for (const s of [m.home_slot, m.away_slot]) T[s].p++;
    const wSlot = r.winner == null ? null : slotOf(r.winner);
    if (wSlot == null) { T[m.home_slot].t++; T[m.away_slot].t++; T[m.home_slot].pts++; T[m.away_slot].pts++; }
    else { T[wSlot].w++; T[wSlot].pts += 2; T[wSlot === m.home_slot ? m.away_slot : m.home_slot].l++; }
    const sideOf = s2 => {
      const inn = (r.innings || []).find(x => x && slotOf(x.batTeam) === s2);
      if (!inn) return null;
      return { r: inn.runs, w: inn.wkts, ov: Math.floor(inn.legal / 6) + '.' + (inn.legal % 6) };
    };
    results.push({ id: m.id, round: m.round, leagueRound: m.league_round,
      home: bySlot[m.home_slot].name, away: bySlot[m.away_slot].name,
      hs: sideOf(m.home_slot), as: sideOf(m.away_slot),
      winner: wSlot == null ? null : bySlot[wSlot].name, text: r.text });
  }
  const table = Object.values(T).map(x => ({ ...x, nrr: x.of && x.oa ? +(x.rf / x.of - x.ra / x.oa).toFixed(3) : 0 }))
    .sort((a, b) => b.pts - a.pts || b.nrr - a.nrr || a.slot - b.slot);
  const players = Object.values(PS);
  return {
    country, seasonNo, rounds: COLTS_ROUNDS,
    roundsPlayed: ms.length ? Math.max(...ms.map(m => m.round)) : 0,
    table, results,
    runs: players.filter(p => p.runs > 0).sort((a, b) => b.runs - a.runs).slice(0, 5),
    wickets: players.filter(p => p.wkts > 0).sort((a, b) => b.wkts - a.wkts || a.conc - b.conc).slice(0, 5),
    champion: table[0] && table[0].p ? table[0].name : null
  };
}

// EVERY BOY'S OWN RECORD, recomputed from the same banked cards and written
// back onto the colt so his card can show what he has actually done. Pure
// function of the youth matches; running it twice writes the same numbers.
export async function coltRecords(pool, country, seasonNo) {
  const ms = (await pool.query(
    'SELECT home_slot, away_slot, home_name, away_name, result FROM youth_matches WHERE country_id=$1 AND season_no=$2',
    [country, seasonNo])).rows;
  const book = new Map();                                     // slot -> name -> record
  const rec = (slot, name) => {
    if (!book.has(slot)) book.set(slot, new Map());
    const m = book.get(slot);
    if (!m.has(name)) m.set(name, { m: 0, runs: 0, hs: 0, wkts: 0, conc: 0 });
    return m.get(name);
  };
  for (const mt of ms) {
    const slotOf = nm => nm === mt.home_name ? mt.home_slot : nm === mt.away_name ? mt.away_slot : null;
    const capped = new Set();                       // one cap a man a match, however many innings
    for (const inn of ((mt.result || {}).innings || [])) {
      if (!inn) continue;
      const bs = slotOf(inn.batTeam), os = slotOf(inn.bowlTeam);
      for (const b of (inn.bat || [])) {
        const nm = b.p && b.p.name; if (!nm || bs == null) continue;
        const e = rec(bs, nm); e.runs += (b.r || 0); if ((b.r || 0) > e.hs) e.hs = b.r || 0;
        capped.add(bs + '|' + nm);
      }
      for (const nm in (inn.bowlers || {})) {
        if (os == null) continue;
        const e = rec(os, nm); e.wkts += (inn.bowlers[nm].w || 0); e.conc += (inn.bowlers[nm].r || 0);
        capped.add(os + '|' + nm);
      }
    }
    for (const k of capped) { const ix = k.indexOf('|'); rec(+k.slice(0, ix), k.slice(ix + 1)).m++; }
  }
  const clubs = (await pool.query(
    'SELECT slot, youth FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  let touched = 0;
  for (const c of clubs) {
    const men = book.get(c.slot) || new Map();
    const youth = (Array.isArray(c.youth) ? c.youth : []).map(y => {
      const q = Object.assign({}, y), r = men.get(y.name);
      if (r && r.m) q.colts = r; else delete q.colts;
      return q;
    });
    await pool.query('UPDATE clubs SET youth=$3::jsonb WHERE country_id=$1 AND slot=$2',
      [country, c.slot, JSON.stringify(youth)]);
    touched++;
  }
  return touched;
}
