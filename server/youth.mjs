// youth.mjs — THE ACADEMY
//
// Every club runs one. It holds a few colts, it costs money to keep and more
// to improve, and once a season it produces a cricketer. The rules are the
// umpire's, not the manager's, so a club nobody logs into still brings boys
// through:
//
//   - the academy holds up to 2 + level colts (four at the default level two)
//   - a new boy arrives whenever there is room, one per intake window
//   - at the rollover every colt ages a year, and a colt who reaches 21 is
//     handed a senior shirt whether anyone was watching or not
//   - what a boy IS comes from the shipped generator seeded on
//     'youth|country|slot|season|index' - so re-running any tick produces the
//     same young cricketers, and nothing here can drift
//
// A better academy makes better boys: the level scales how much of a grown
// cricketer's skill a seventeen-year-old already has, and how close to ready
// he arrives.
import { countryConfigs } from './init-world.mjs';

export const CAP = lv => 2 + Math.max(1, Math.min(5, lv || 2));
const PROMOTE_AT = 21;
// a senior staff is twenty men, the same number world_colt refuses to exceed
export const SQUAD_CAP = 20;
// and a cricketer does not go on forever
export const RETIRE_AT = 38;
// what a level costs a round is the books' business, not the academy's
export { ACADEMY_UPKEEP } from './economy.mjs';

// the same 32-bit hash the client and the world generator use
function h32(s) {
  let h = 2166136261 >>> 0;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

// A COLT IS A GROWN CRICKETER, NOT YET GROWN. The generator makes the man he
// will be; the academy decides how much of that man has arrived. Everything is
// a pure function of the seed, so the same boy appears on every re-run.
export function makeColt(host, country, arch, seed, level) {
  const src = host.genSquad(seed, country, arch || 'balanced', 'general') || [];
  if (!src.length) return null;
  const h = h32(seed);
  const p = JSON.parse(JSON.stringify(src[h % src.length]));
  const age = 17 + (h32(seed + '|age') % 4);            // 17-20
  // raw: a colt has between half and four-fifths of the man in him, and a
  // stronger academy turns them out closer to finished
  const share = 0.50 + 0.045 * Math.max(1, Math.min(5, level || 2)) + 0.035 * (age - 17);
  const scale = v => (typeof v === 'number' ? Math.max(1, Math.round(v * share)) : v);
  p.age = age;
  p.colt = true;
  p.promise = Math.round(share * 100);                   // how far along he is
  if (p.skills) { const s = {}; for (const k in p.skills) s[k] = scale(p.skills[k]); p.skills = s; }
  if (typeof p.exp === 'number') p.exp = scale(p.exp);    // a boy has seen nothing yet
  // the fifteen skills are the man; everything else on the card - his batting,
  // his threat, his rating, his price - is the ENGINE'S function of them, so
  // let the engine work it out rather than scaling the answers by hand
  // - the wage included: a boy is cheap because a boy is small, not because
  // anyone discounted him, and the club pays the academy's upkeep for him
  // until the day he is handed a senior shirt
  const colt = host.derive([p])[0] || p;
  // the cricketer he was made IS the boy, not the man he was cut down from -
  // so when he graduates the nets build on the colt, and nothing he does in
  // the academy is ever mistaken for training he has not done
  colt.baseSkills = JSON.parse(JSON.stringify(colt.skills || {}));
  colt.baseExp = colt.exp;
  delete colt.career; delete colt.formIx; delete colt.formWord;
  delete colt.fatN; delete colt.fatWord; delete colt.trainProgress;
  return colt;
}

// the same nation config the world was founded from, so an England colt is an
// England cricketer and a Kandahar colt is an Afghan one
function archOf(host, country) {
  const r = countryConfigs(host).filter(x => x.id === country)[0];
  return r ? { nat: r.nat, arch: r.arch } : { nat: 'England', arch: 'balanced' };
}

// Fill every academy to its capacity, one boy per call per club: a season's
// intake arrives over the season, not all on day one. Idempotent by name.
export async function ensureYouth(pool, host, country, { seasonNo, round }) {
  const clubs = (await pool.query(
    'SELECT slot, academy, youth FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  const cfg = archOf(host, country);
  let added = 0;
  for (const c of clubs) {
    const youth = Array.isArray(c.youth) ? c.youth : [];
    if (youth.length >= CAP(c.academy)) continue;
    const seed = 'youth|' + country + '|' + c.slot + '|s' + seasonNo + '|r' + round;
    const colt = makeColt(host, cfg.nat, cfg.arch, seed, c.academy);
    if (!colt) continue;
    // a name already on the books (a re-run) is never doubled
    if (youth.some(y => y && y.name === colt.name)) continue;
    youth.push(colt);
    await pool.query('UPDATE clubs SET youth=$3::jsonb WHERE country_id=$1 AND slot=$2',
      [country, c.slot, JSON.stringify(youth)]);
    added++;
  }
  return added;
}

// A SENIOR SHIRT, and a note of the round he first wore it. A man only ever
// works the rounds in the nets he was actually at the club for, so a boy who
// comes up in season three is not handed three seasons of other men's training.
function graduate(colt, seasonNo, round) {
  const q = Object.assign({}, colt, { joined: { s: seasonNo, r: round } });
  delete q.colt; delete q.promise;
  return q;
}

// THE ROLLOVER. A year on EVERYBODY - the colts and the professionals both -
// and then the three things a year does to a staff:
//
//   1. a man who has reached thirty-eight hangs them up. Without this nobody
//      ever leaves and a squad only ever grows.
//   2. a colt who has reached twenty-one is handed a senior shirt, with
//      nobody watching, exactly as before.
//   3. but a staff is twenty men. If there is no room, the boy comes up only
//      if he is better than the weakest professional on the books - who makes
//      way for him. If he is not, the club lets him go. That is the same
//      ceiling world_colt has always enforced on a manager doing it by hand;
//      it was the umpire doing it automatically that had no ceiling at all,
//      and squads grew without bound.
//
// Keyed by season, so a re-run never ages anybody twice.
const byStrength = (a, b) => (b.rating || 0) - (a.rating || 0) || (a.name < b.name ? -1 : 1);

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
  let promoted = 0, retired = 0, released = 0, madeWay = 0;
  for (const c of clubs) {
    // 1. a year on the professionals, and the oldest hang them up
    const aged = (c.squad || []).map(p => Object.assign({}, p, { age: (p.age || 27) + 1 }));
    let squad = aged.filter(p => (p.age || 0) < RETIRE_AT);
    retired += aged.length - squad.length;

    // 2. a year on the boys, and the twenty-one-year-olds come of age
    const youth = (Array.isArray(c.youth) ? c.youth : []).map(y => Object.assign({}, y, { age: (y.age || 18) + 1 }));
    const up = youth.filter(y => y.age >= PROMOTE_AT).slice().sort(byStrength);
    const stay = youth.filter(y => y.age < PROMOTE_AT);

    // 3. and room has to be found for them, or made, or not
    for (const boy of up) {
      if (squad.length < SQUAD_CAP) { squad.push(graduate(boy, seasonNo + 1, 1)); promoted++; continue; }
      const order = squad.slice().sort(byStrength);
      const weakest = order[order.length - 1];
      if (weakest && (boy.rating || 0) > (weakest.rating || 0)) {
        squad = squad.filter(p => p.name !== weakest.name);
        squad.push(graduate(boy, seasonNo + 1, 1));
        promoted++; madeWay++;
      } else {
        released++;                       // no room, and not yet worth making any
      }
    }
    await pool.query('UPDATE clubs SET youth=$3::jsonb, squad=$4::jsonb WHERE country_id=$1 AND slot=$2',
      [country, c.slot, JSON.stringify(stay), JSON.stringify(squad)]);
  }
  await pool.query(`UPDATE ticks SET status='done', finished_at=now() WHERE key=$1`, [key]);
  return { skipped: false, promoted, retired, released, madeWay };
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
