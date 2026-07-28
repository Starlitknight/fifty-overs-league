// tick.mjs — the umpire. Settles every due, unsettled round for every
// country (P1: England), idempotently and crash-safely.
//
// Idempotency design (BLUEPRINT law 4):
//   - one ticks row per (country, world-day) is the idempotency key;
//     status 'done' short-circuits re-runs entirely.
//   - each match INSERT is its own transaction with the fixture UNIQUE
//     constraint + ON CONFLICT DO NOTHING: a tick killed mid-round leaves
//     the completed matches persisted; the re-run replays only the gap
//     (and replaying an already-persisted match writes nothing).
//   - money and standings derive from the matches table, never incremented
//     imperatively, so partial runs can never double-pay.
//   - recovery for a tick that never fired: runDue() walks every unsettled
//     day from the season's start to now — a dead cron is healed by the
//     next invocation, however late.
import { makePool } from './db.mjs';
import { makeHost, ENGINE_VERSION } from './enginehost.mjs';
import { EPOCH, dayIx, daySettled, seedOf, natHour, scheduleOf, ROUNDS } from './clock.mjs';
import { livingPatch, evolveCountry } from './living.mjs';
import { ensureYouth, ageYouth, playColtsRound, computeColts, coltRecords, UPKEEP_PER_ROUND } from './youth.mjs';

export function matchId(country, seasonNo, round, h, a) {
  return country + ':s' + seasonNo + ':r' + round + ':h' + h + 'a' + a;
}

async function playRound(pool, host, country, season, round, opts) {
  const fixtures = season.schedule[round - 1];
  const clubs = (await pool.query('SELECT slot, name, ground, squad FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  const bySlot = Object.fromEntries(clubs.map(c => [c.slot, c]));
  // the joinable world: claimed clubs' submitted orders for THIS round ride
  // into the engine keyed by club name (missing/partial orders are fine -
  // the engine autopicks around them, exactly as it does for an absent user)
  const ordersMap = {};
  try {
    const or = await pool.query(
      `SELECT cl.name AS club, o.orders
         FROM claims c
         JOIN clubs cl ON cl.country_id=c.country_id AND cl.slot=c.slot
         JOIN orders o ON o.user_id=c.user_id AND o.country_id=c.country_id AND o.season_no=$2 AND o.round=$3
        WHERE c.country_id=$1`, [country, season.season_no, round]);
    or.rows.forEach(r => { ordersMap[r.club] = r.orders; });
  } catch (e) { /* pre-004 database: nobody has claimed anything */ }
  let played = 0;
  for (let i = 0; i < fixtures.length; i++) {
    if (opts && opts.failAfter != null && played >= opts.failAfter) throw new Error('injected-crash');
    const [hs, as] = fixtures[i];
    const id = matchId(country, season.season_no, round, hs, as);
    const exists = await pool.query('SELECT 1 FROM matches WHERE id=$1', [id]);
    if (exists.rowCount) continue;
    const home = bySlot[hs], away = bySlot[as];
    const seed = seedOf(id);
    const tieOrders = {};
    if (ordersMap[home.name]) tieOrders[home.name] = ordersMap[home.name];
    if (ordersMap[away.name]) tieOrders[away.name] = ordersMap[away.name];
    const resultJson = host.runMatch({ name: home.name, players: home.squad }, { name: away.name, players: away.squad }, 'balanced', seed, tieOrders);
    if (!resultJson) throw new Error('engine failed to complete ' + id);
    // the living state these men carried into the match, banked with it:
    // the theatre lays it back over the generated squads and replays the
    // identical game, however far the players travel afterwards
    const living = { [home.name]: livingPatch(home.squad), [away.name]: livingPatch(away.squad) };
    await pool.query(
      `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed, engine_version, pitch, orders, result, result_canonical, home_name, away_name, living)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::text,$13,$14,$15::jsonb) ON CONFLICT (id) DO NOTHING`,
      [id, country, season.season_no, round, hs, as, seed, ENGINE_VERSION, 'balanced', JSON.stringify(tieOrders), resultJson, resultJson, home.name, away.name, JSON.stringify(living)]);
    played++;
  }
  return played;
}

// standings derived purely from persisted matches — re-runnable, never drifts
export async function computeLeague(pool, country, seasonNo, now) {
  const season = (await pool.query('SELECT * FROM seasons WHERE country_id=$1 AND season_no=$2', [country, seasonNo])).rows[0];
  const clubs = (await pool.query('SELECT slot, name, ground, is_boss FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  const ms = (await pool.query('SELECT * FROM matches WHERE country_id=$1 AND season_no=$2 ORDER BY round, id', [country, season.season_no])).rows;
  const bySlot = Object.fromEntries(clubs.map(c => [c.slot, c]));
  const T = Object.fromEntries(clubs.map(c => [c.slot, { slot: c.slot, name: c.name, boss: c.is_boss, p: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0, of: 0, oa: 0 }]));
  const results = [];
  for (const m of ms) {
    const r = m.result, i1 = r.innings[0], i2 = r.innings[1];
    // names AS PLAYED map every innings to its slot, so a club renamed after
    // the fact keeps its whole record; snapshots then speak the CURRENT name
    const hN = m.home_name || bySlot[m.home_slot].name, aN = m.away_name || bySlot[m.away_slot].name;
    const slotOf = nm => nm === hN ? m.home_slot : nm === aN ? m.away_slot : clubs.find(c => c.name === nm)?.slot;
    for (const inn of [i1, i2]) {
      if (!inn) continue;
      const bs = slotOf(inn.batTeam), os = slotOf(inn.bowlTeam);
      if (bs == null || os == null) continue;
      T[bs].rf += inn.runs; T[bs].of += inn.wkts >= 10 ? 50 : inn.legal / 6;
      T[os].ra += inn.runs; T[os].oa += inn.wkts >= 10 ? 50 : inn.legal / 6;
    }
    for (const s of [m.home_slot, m.away_slot]) T[s].p++;
    if (r.winner === null) { T[m.home_slot].t++; T[m.away_slot].t++; T[m.home_slot].pts++; T[m.away_slot].pts++; }
    else { const ws = slotOf(r.winner); if (ws != null) { T[ws].w++; T[ws].pts += 2; T[ws === m.home_slot ? m.away_slot : m.home_slot].l++; } }
    const wSlot = r.winner === null ? null : slotOf(r.winner);
    // the card as a scoreboard reads it: each side's runs, wickets and overs,
    // so a results page can print 267/8 (49.5) rather than only a sentence
    const sideOf = s2 => {
      const inn = [i1, i2].find(x => x && slotOf(x.batTeam) === s2);
      if (!inn) return null;
      const ov = inn.wkts >= 10 ? null : Math.floor(inn.legal / 6) + '.' + (inn.legal % 6);
      return { r: inn.runs, w: inn.wkts, ov: inn.wkts >= 10 ? Math.floor(inn.legal / 6) + '.' + (inn.legal % 6) : ov };
    };
    results.push({ id: m.id, round: m.round, home: bySlot[m.home_slot].name, away: bySlot[m.away_slot].name,
      hs: sideOf(m.home_slot), as: sideOf(m.away_slot),
      winner: wSlot == null ? r.winner : bySlot[wSlot].name, text: r.text, seed: String(m.seed), engineVersion: m.engine_version });
  }
  const table = Object.values(T).map(x => ({ ...x, nrr: x.of && x.oa ? +(x.rf / x.of - x.ra / x.oa).toFixed(3) : 0 }))
    .sort((a, b) => b.pts - a.pts || b.nrr - a.nrr || a.slot - b.slot);
  // SEASON HONOURS: leaders straight from the banked scorecards - every run
  // and every wicket in the snapshot is one that genuinely happened
  const PS = {};
  const pAt = (nm, slot) => PS[nm] = PS[nm] || { name: nm, club: bySlot[slot].name, runs: 0, balls: 0, outs: 0, hs: 0, wkts: 0, conc: 0, bballs: 0, bb: null };
  for (const m of ms) {
    const r = m.result;
    const hN = m.home_name || bySlot[m.home_slot].name, aN = m.away_name || bySlot[m.away_slot].name;
    const slotOf = nm => nm === hN ? m.home_slot : nm === aN ? m.away_slot : clubs.find(c => c.name === nm)?.slot;
    for (const inn of r.innings) {
      if (!inn) continue;
      const bs = slotOf(inn.batTeam), os = slotOf(inn.bowlTeam);
      if (bs != null) for (const b of (inn.bat || [])) {
        const nm = (b.p && b.p.name) || b.p; if (!nm) continue;
        const e = pAt(nm, bs);
        e.runs += b.r || 0; e.balls += b.b || 0;
        if (b.out && b.out !== 'not out') e.outs++;
        if ((b.r || 0) > e.hs) e.hs = b.r || 0;
      }
      if (os != null) for (const nm of Object.keys(inn.bowlers || {})) {
        const bw = inn.bowlers[nm], e = pAt(nm, os);
        e.wkts += bw.w || 0; e.conc += bw.r || 0; e.bballs += bw.b || 0;
        if (!e.bb || (bw.w || 0) > e.bb.w || ((bw.w || 0) === e.bb.w && (bw.r || 0) < e.bb.r)) e.bb = { w: bw.w || 0, r: bw.r || 0 };
      }
    }
  }
  const ppl = Object.values(PS);
  const stats = {
    bat: ppl.filter(x => x.runs > 0).sort((a, b) => b.runs - a.runs || b.hs - a.hs).slice(0, 5)
      .map(x => ({ name: x.name, club: x.club, runs: x.runs, hs: x.hs, sr: x.balls ? +(100 * x.runs / x.balls).toFixed(1) : 0 })),
    bowl: ppl.filter(x => x.wkts > 0).sort((a, b) => b.wkts - a.wkts || a.conc - b.conc).slice(0, 5)
      .map(x => ({ name: x.name, club: x.club, wkts: x.wkts, econ: x.bballs ? +(6 * x.conc / x.bballs).toFixed(2) : 0, bb: x.bb })),
    sr: ppl.filter(x => x.balls >= 60).sort((a, b) => (b.runs / b.balls) - (a.runs / a.balls)).slice(0, 3)
      .map(x => ({ name: x.name, club: x.club, sr: +(100 * x.runs / x.balls).toFixed(1), runs: x.runs })),
    econ: ppl.filter(x => x.bballs >= 60).sort((a, b) => (a.conc / a.bballs) - (b.conc / b.bballs)).slice(0, 3)
      .map(x => ({ name: x.name, club: x.club, econ: +(6 * x.conc / x.bballs).toFixed(2), wkts: x.wkts }))
  };
  const roundsPlayed = ms.length ? Math.max(...ms.map(m => m.round)) : 0;
  const champion = roundsPlayed >= ROUNDS && table[0] ? table[0].name : null;
  return { country, seasonNo: season.season_no, startDay: season.start_day, rounds: ROUNDS, roundsPlayed, table, results, stats, champion, generatedAtDay: dayIx(now) };
}

// THE WORLD RANKINGS: rolling Elo over every banked match, recomputed from
// genesis each time - a pure function of the record, so it can never drift
// and a club rename never loses a point (ratings key by country:slot).
// League matches move 24 points' worth, Champions Cup ties 40; national XIs
// keep their own ladder from World Cup matches. Deterministic order: league
// by (season, round, country, home slot), cups by (season, stage, tie).
export async function computeRankings(pool, now) {
  const clubs = (await pool.query('SELECT country_id, slot, name, is_boss FROM clubs ORDER BY country_id, slot')).rows;
  const key = (c, s) => c + ':' + s;
  const R = {};
  clubs.forEach(c => R[key(c.country_id, c.slot)] = { country: c.country_id, slot: c.slot, name: c.name, boss: c.is_boss, rating: 1000, p: 0, w: 0, l: 0, t: 0 });
  const upd = (a, b, sa, K) => {
    const ea = 1 / (1 + Math.pow(10, (b.rating - a.rating) / 400));
    const d = K * (sa - ea);
    a.rating += d; b.rating -= d;
    a.p++; b.p++;
    if (sa === 0.5) { a.t++; b.t++; } else if (sa === 1) { a.w++; b.l++; } else { b.w++; a.l++; }
  };
  const ms = (await pool.query(
    'SELECT country_id, home_slot, away_slot, home_name, result FROM matches ORDER BY season_no, round, country_id, home_slot')).rows;
  for (const m of ms) {
    const a = R[key(m.country_id, m.home_slot)], b = R[key(m.country_id, m.away_slot)];
    if (!a || !b) continue;
    const hN = m.home_name || a.name, w = m.result.winner;
    upd(a, b, w === null ? 0.5 : w === hN ? 1 : 0, 24);
  }
  const wclm = (await pool.query(
    `SELECT a, b, result FROM cup_matches WHERE comp='wcl'
      ORDER BY season_no, CASE stage WHEN 'pi' THEN 0 WHEN 'r16' THEN 1 WHEN 'qf' THEN 2 WHEN 'sf' THEN 3 ELSE 4 END, gi`)).rows;
  for (const m of wclm) {
    if (m.a.slot == null || m.b.slot == null) continue;
    const a = R[key(m.a.country, m.a.slot)], b = R[key(m.b.country, m.b.slot)];
    if (!a || !b) continue;
    const w = m.result.winner;
    upd(a, b, w === null ? 0.5 : w === m.a.name ? 1 : 0, 40);
  }
  const countryRows = (await pool.query('SELECT id, name FROM countries')).rows;
  const N = {};
  countryRows.forEach(c => N[c.id] = { rating: 1000, p: 0, w: 0, l: 0, t: 0 });
  const wcm = (await pool.query(
    `SELECT a, b, result FROM cup_matches WHERE comp='wc'
      ORDER BY season_no, CASE stage WHEN 'r16' THEN 0 WHEN 'qf' THEN 1 WHEN 'sf' THEN 2 ELSE 3 END, gi`)).rows;
  for (const m of wcm) {
    const a = N[m.a.country], b = N[m.b.country];
    if (!a || !b) continue;
    const w = m.result.winner;
    const sa = w === null ? 0.5 : w === m.a.name ? 1 : 0;
    const ea = 1 / (1 + Math.pow(10, (b.rating - a.rating) / 400));
    const d = 40 * (sa - ea);
    a.rating += d; b.rating -= d;
    a.p++; b.p++;
    if (sa === 0.5) { a.t++; b.t++; } else if (sa === 1) { a.w++; b.l++; } else { b.w++; a.l++; }
  }
  const clubList = Object.values(R).sort((x, y) => y.rating - x.rating || x.country.localeCompare(y.country) || x.slot - y.slot)
    .map((x, i) => ({ rank: i + 1, country: x.country, slot: x.slot, name: x.name, boss: x.boss, rating: Math.round(x.rating), p: x.p, w: x.w, l: x.l, t: x.t }));
  const countries = countryRows.map(c => {
    const mine = Object.values(R).filter(x => x.country === c.id);
    const avg = mine.reduce((s, x) => s + x.rating, 0) / (mine.length || 1);
    return { id: c.id, name: c.name, clubRating: Math.round(avg), natRating: Math.round(N[c.id].rating), natP: N[c.id].p };
  }).sort((a, b) => b.clubRating - a.clubRating || b.natRating - a.natRating || a.id.localeCompare(b.id))
    .map((c, i) => ({ rank: i + 1, ...c }));
  return { clubs: clubList, countries, generatedAtDay: dayIx(now) };
}

// the honours book: an append-only memory of every crown. League snapshots
// only ever hold the LATEST season, so finished honours are merged in here
// the moment they exist and never lost. Idempotent by construction.
export async function rebuildHonours(pool) {
  const cur = (await pool.query(`SELECT body FROM snapshots WHERE key='honours'`)).rows[0];
  const H = (cur && cur.body) || { seasons: {} };
  const leagues = await pool.query(`SELECT body FROM snapshots WHERE key LIKE 'league/%'`);
  for (const r of leagues.rows) {
    const b = r.body;
    if (b && b.roundsPlayed >= ROUNDS && b.champion) {
      const sk = 's' + b.seasonNo;
      H.seasons[sk] = H.seasons[sk] || {};
      H.seasons[sk].league = H.seasons[sk].league || {};
      H.seasons[sk].league[b.country] = b.champion;
    }
  }
  const cups = await pool.query(`SELECT key, body FROM snapshots WHERE key LIKE 'cup/%' OR key LIKE 'worldcup/%'`);
  for (const r of cups.rows) {
    const m = /^(cup|worldcup)\/s(\d+)$/.exec(r.key);
    if (!m || !r.body || !r.body.champion) continue;
    const sk = 's' + m[2];
    H.seasons[sk] = H.seasons[sk] || {};
    H.seasons[sk][m[1] === 'cup' ? 'championsCup' : 'worldCup'] = r.body.champion;
  }
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ('honours', $1, now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`, [JSON.stringify(H)]);
  return H;
}

// the write side: latest season's league snapshot + the world summary
export async function rebuildSnapshots(pool, country, now) {
  const season = (await pool.query('SELECT * FROM seasons WHERE country_id=$1 ORDER BY season_no DESC LIMIT 1', [country])).rows[0];
  const league = await computeLeague(pool, country, season.season_no, now);
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ($1,$2,now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`, ['league/' + country, JSON.stringify(league)]);
  // the Colts Cup keeps its own table, and every boy's own record goes back
  // onto the boy - both derived from the banked youth cards, never incremented
  const colts = await computeColts(pool, country, season.season_no);
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ($1,$2,now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`, ['colts/' + country, JSON.stringify(colts)]);
  await coltRecords(pool, country, season.season_no);
  await rebuildWorldToday(pool, now);
  await rebuildHonours(pool);
  const rk = await computeRankings(pool, now);
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ('rankings', $1, now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`, [JSON.stringify(rk)]);
  return league;
}

// world/today aggregates EVERY league snapshot — one summary row per country,
// with its play hour so a client can render the staggered globe
export async function rebuildWorldToday(pool, now) {
  const leagues = await pool.query(`SELECT body FROM snapshots WHERE key LIKE 'league/%' ORDER BY key`);
  const today = {
    day: dayIx(now), engineVersion: ENGINE_VERSION,
    countries: leagues.rows.map(r => {
      const b = r.body;
      return { id: b.country, seasonNo: b.seasonNo, roundsPlayed: b.roundsPlayed, hourUtc: natHour(b.country), leader: b.table[0] ? b.table[0].name : null };
    })
  };
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ('world/today',$1,now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`, [JSON.stringify(today)]);
  return today;
}

// THE TREASURY, settled by the umpire and by nobody else. A club's money is
// a pure function of its whole record - what it was founded with, the gate it
// has taken at home, the share it has drawn away, and the wages it has paid
// its men, every round it has ever played, across every season. No device
// writes it, and re-running settles the same figure.
// One honest simplification: wages are charged at the bill as it stands
// today, so a squad that trains itself upward revises its own history
// slightly. Nothing spends money yet, and it keeps the figure recomputable.
const FOUNDING_BANK = 2500000, HOME_GATE = 240000, AWAY_SHARE = 60000;
export async function settleMoney(pool, country) {
  const clubs = (await pool.query(
    'SELECT slot, squad, academy, academy_paid FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  const ms = (await pool.query(
    'SELECT home_slot, away_slot FROM matches WHERE country_id=$1', [country])).rows;
  const home = {}, away = {};
  for (const m of ms) { home[m.home_slot] = (home[m.home_slot] || 0) + 1; away[m.away_slot] = (away[m.away_slot] || 0) + 1; }
  for (const c of clubs) {
    const wages = (c.squad || []).reduce((s, p) => s + (p.wage || 0), 0);
    const rounds = (home[c.slot] || 0) + (away[c.slot] || 0);
    // the academy is a standing cost and its upgrades are a spent fact, so the
    // bank is still a pure function of the record
    const academy = rounds * (c.academy || 2) * UPKEEP_PER_ROUND + (+c.academy_paid || 0);
    const bank = FOUNDING_BANK + (home[c.slot] || 0) * HOME_GATE + (away[c.slot] || 0) * AWAY_SHARE
      - rounds * wages - academy;
    await pool.query('UPDATE clubs SET bank=$3 WHERE country_id=$1 AND slot=$2', [country, c.slot, Math.round(bank)]);
  }
  return clubs.length;
}

export async function runTick(pool, host, country, day, { now = Date.now(), failAfter = null } = {}) {
  const key = country + ':day:' + day;
  const claim = await pool.query(
    `INSERT INTO ticks(key, status) VALUES ($1,'running')
     ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING status`, [key]);
  if (claim.rows[0].status === 'done') return { skipped: true };
  const season = (await pool.query('SELECT * FROM seasons WHERE country_id=$1 ORDER BY season_no DESC LIMIT 1', [country])).rows[0];
  if (!season) throw new Error('no season for ' + country);
  const round = day - season.start_day + 1;
  let played = 0;
  if (round >= 1 && round <= ROUNDS) {
    played = await playRound(pool, host, country, season, round, { failAfter });
    // the nets: whatever plan stands when a round settles is the work that
    // round did, banked so the squad's skills stay recomputable from genesis
    // the plan in force AND the academy in force: a building that changes the
    // rate has to be part of the record, or the squad stops being replayable
    await pool.query(
      `INSERT INTO training_rounds(country_id, slot, season_no, round, plan, academy)
       SELECT country_id, slot, $2, $3, coalesce(training, '{}'::jsonb), academy FROM clubs WHERE country_id=$1
       ON CONFLICT (country_id, slot, season_no, round) DO NOTHING`,
      [country, season.season_no, round]);
    // and the boys have their own fixture on every second league round
    await playColtsRound(pool, host, country, season, round, seedOf, ENGINE_VERSION);
  }
  // the day's cricket changes the men who played it: careers, form, tired
  // legs, and the work they did in the nets. A pure function of the record,
  // so re-running settles the same.
  await evolveCountry(pool, country, now, host);
  // the academy brings a boy in when there is room - the same boy on every
  // re-run, because his seed is the club, the season and the round
  try { await ensureYouth(pool, host, country, { seasonNo: season.season_no, round }); }
  catch (eY) { console.error('academy intake failed for ' + country + ' day ' + day + ':', eY.message); }
  await settleMoney(pool, country);
  await rebuildSnapshots(pool, country, now);
  await pool.query(`UPDATE ticks SET status='done', finished_at=now(), detail=$2 WHERE key=$1`,
    [key, JSON.stringify({ round: round >= 1 && round <= ROUNDS ? round : null, played })]);
  return { skipped: false, round, played };
}

// heal any gap: settle every due day since the season began
export async function runDue(pool, host, country, { now = Date.now(), failAfter = null } = {}) {
  const season = (await pool.query('SELECT * FROM seasons WHERE country_id=$1 ORDER BY season_no DESC LIMIT 1', [country])).rows[0];
  if (!season) return [];
  const out = [];
  for (let day = season.start_day; day <= dayIx(now); day++) {
    if (!daySettled(now, day, country)) break;
    if (day - season.start_day + 1 > ROUNDS) break;
    out.push({ day, ...(await runTick(pool, host, country, day, { now, failAfter })) });
  }
  return out;
}

// every country in the database, in id order — the whole planet, one call
// FRIENDLIES: manager v manager, one match, no stakes. The umpire plays every
// accepted friendly whose hour has struck - real squads, each manager's
// latest orders, seed from the friendly's own id - and lets stale offers
// lapse. League tables, rankings and honours never see these matches.
export async function runFriendlies(pool, host, opts = {}) {
  const now = opts.now ?? Date.now();
  // an offer nobody answered dies an hour before its match - never played
  await pool.query(`UPDATE friendlies SET status='expired'
    WHERE status='offered' AND play_at_ms - 3600000 <= $1`, [now]);
  const due = (await pool.query(
    `SELECT * FROM friendlies WHERE status='accepted' AND play_at_ms <= $1 ORDER BY id`, [now])).rows;
  const played = [];
  for (const f of due) {
    const hc = (await pool.query('SELECT name, squad FROM clubs WHERE country_id=$1 AND slot=$2', [f.c_country, f.c_slot])).rows[0];
    const ac = (await pool.query('SELECT name, squad FROM clubs WHERE country_id=$1 AND slot=$2', [f.o_country, f.o_slot])).rows[0];
    if (!hc || !ac) { await pool.query(`UPDATE friendlies SET status='expired' WHERE id=$1`, [f.id]); continue; }
    // the lineup set FOR this friendly wins; the manager's latest league
    // orders stand in; the engine picks for anyone silent
    const ordersMap = {};
    for (const [uid, fOrders, clubName] of [[f.challenger, f.c_orders, hc.name], [f.opponent, f.o_orders, ac.name]]) {
      if (fOrders) { ordersMap[clubName] = fOrders; continue; }
      if (!uid) continue;
      const o = (await pool.query(
        'SELECT orders FROM orders WHERE user_id=$1 ORDER BY submitted_at DESC LIMIT 1', [uid])).rows[0];
      if (o) ordersMap[clubName] = o.orders;
    }
    const seed = seedOf('friendly:' + f.id);
    const resultJson = host.runMatch({ name: hc.name, players: hc.squad }, { name: ac.name, players: ac.squad }, 'balanced', seed, ordersMap);
    if (!resultJson) throw new Error('engine failed friendly ' + f.id);
    const living = { [hc.name]: livingPatch(hc.squad), [ac.name]: livingPatch(ac.squad) };
    await pool.query(`UPDATE friendlies SET status='played', result=$2::jsonb, engine_version=$3, living=$4::jsonb WHERE id=$1`,
      [f.id, resultJson, ENGINE_VERSION, JSON.stringify(living)]);
    played.push(f.id);
  }
  return played;
}

// A LEAGUE EXISTS BEFORE IT PLAYS. Snapshots used to appear only when a
// round settled, so between founding and the first ball every nation served
// nothing and every device fell back to painted placeholder sides - wrong
// names, wrong clubs, sometimes the same club three times. A league that has
// not played is still a league: ten real clubs, all on nought. Publish it.
// A published table must also never outlive a name. A snapshot is otherwise
// only rebuilt when a round settles, so a club christened by its manager -
// or an anchor renamed by a migration - would keep its old name on every
// device until that night's cricket. Republish whenever the names drift.
export async function ensureSnapshots(pool, { now = Date.now() } = {}) {
  const cs = (await pool.query('SELECT id FROM countries ORDER BY id')).rows;
  const filled = [];
  for (const c of cs) {
    const have = await pool.query(`SELECT body FROM snapshots WHERE key=$1`, ['league/' + c.id]);
    if (have.rowCount) {
      const named = {};
      for (const r of (have.rows[0].body.table || [])) named[r.slot] = r.name;
      const live = (await pool.query('SELECT slot, name FROM clubs WHERE country_id=$1', [c.id])).rows;
      if (live.every(r => named[r.slot] === r.name)) continue;
    }
    await rebuildSnapshots(pool, c.id, now);
    filled.push(c.id);
  }
  return filled;
}

export async function runAllDue(pool, host, opts = {}) {
  const cs = await pool.query('SELECT id FROM countries ORDER BY id');
  const out = {};
  for (const row of cs.rows) out[row.id] = await runDue(pool, host, row.id, opts);
  return out;
}

// ============================================================================
// P4/P5 — THE CUP WINDOW, on the real engine. Seasons occupy days
// start_day..start_day+17; then five closing days:
//   +18  Champions Cup play-ins 18:00        World Cup —
//   +19  Champions Cup last-16 15:00         World Cup last-16 12:00
//   +20  Champions Cup quarters 15:00        World Cup quarters 12:00
//   +21  Champions Cup semis 20:00           World Cup semis 18:00
//   +22  THE FINALS: World Cup 18:00, Champions Cup 21:00
// A stage settles once its three-hour window closes (global UTC hours).
// Same laws as the leagues: idempotency keys per stage, results immutable,
// snapshots derived. Season s+1 begins at start_day + 25, forever.
// ============================================================================
const CUP_STAGES = {
  wcl: [['pi', 18, 18], ['r16', 19, 15], ['qf', 20, 15], ['sf', 21, 20], ['final', 22, 21]],
  wc: [['r16', 19, 12], ['qf', 20, 12], ['sf', 21, 18], ['final', 22, 18]]
};
const DAY_MS = 86400000;
function stageClosed(now, startDay, offset, hour) {
  return now >= EPOCH + (startDay + offset) * DAY_MS + (hour + 3) * 3600000;
}
const scoreOf = inn => inn ? inn.runs + (inn.wkts >= 10 ? ' all out' : '/' + inn.wkts) : '';

async function leagueChampions(pool, seasonNo, now) {
  const cs = await pool.query('SELECT id FROM countries ORDER BY id');
  const out = [];
  for (const row of cs.rows) {
    const b = await computeLeague(pool, row.id, seasonNo, now);
    if (!b || b.roundsPlayed < ROUNDS) return null;   // a league unfinished: no cup yet
    out.push({ country: b.country, slot: b.table[0].slot, name: b.table[0].name });
  }
  return out.length ? out : null;
}

async function buildNatSquads(pool, seasonNo) {
  const cs = await pool.query('SELECT c.id, c.name, (SELECT jsonb_agg(squad) FROM clubs cl WHERE cl.country_id=c.id) AS squads FROM countries c ORDER BY c.id');
  for (const c of cs.rows) {
    const all = (c.squads || []).flat().slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const bowlers = all.filter(p => p.bowlType && p.bowlType !== 'none').slice(0, 6);
    const keeper = all.filter(p => p.keeper)[0];
    const picked = [], seen = new Set();
    const take = p => { if (p && !seen.has(p.name)) { seen.add(p.name); picked.push(p); } };
    bowlers.forEach(take); take(keeper);
    for (const p of all) { if (picked.length >= 15) break; take(p); }
    await pool.query(
      `INSERT INTO nat_squads(country_id, season_no, squad) VALUES ($1,$2,$3)
       ON CONFLICT (country_id, season_no) DO NOTHING`,
      [c.id, seasonNo, JSON.stringify(picked)]);
  }
  const rows = await pool.query('SELECT n.country_id, c.name, n.squad FROM nat_squads n JOIN countries c ON c.id=n.country_id WHERE n.season_no=$1', [seasonNo]);
  const body = {};
  rows.rows.forEach(r => { body[r.country_id] = { nation: r.name, squad: r.squad.map(p => p.name) }; });
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ($1,$2,now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`, ['nats/s' + seasonNo, JSON.stringify(body)]);
}

async function squadFor(pool, comp, seasonNo, entrant) {
  if (comp === 'wc') {
    const r = await pool.query('SELECT squad FROM nat_squads WHERE country_id=$1 AND season_no=$2', [entrant.country, seasonNo]);
    return r.rows[0] && r.rows[0].squad;
  }
  const r = await pool.query('SELECT squad FROM clubs WHERE country_id=$1 AND slot=$2', [entrant.country, entrant.slot]);
  return r.rows[0] && r.rows[0].squad;
}

async function playStage(pool, host, comp, seasonNo, stage, pairs) {
  const winners = [];
  for (let gi = 0; gi < pairs.length; gi++) {
    const [A, B] = pairs[gi];
    const ex = await pool.query('SELECT result FROM cup_matches WHERE comp=$1 AND season_no=$2 AND stage=$3 AND gi=$4', [comp, seasonNo, stage, gi]);
    if (ex.rowCount) { const w = ex.rows[0].result.winner; winners.push(w === A.name ? A : B); continue; }
    const seed = seedOf(comp + '|s' + seasonNo + '|' + stage + '|' + gi);
    const sqA = await squadFor(pool, comp, seasonNo, A), sqB = await squadFor(pool, comp, seasonNo, B);
    const resultJson = host.runMatch({ name: A.name, players: sqA }, { name: B.name, players: sqB }, 'balanced', seed);
    if (!resultJson) throw new Error('engine failed cup match ' + comp + ':' + stage + ':' + gi);
    const living = { [A.name]: livingPatch(sqA), [B.name]: livingPatch(sqB) };
    await pool.query(
      `INSERT INTO cup_matches(comp, season_no, stage, gi, a, b, seed, engine_version, result, result_canonical, living)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::text,$11::jsonb) ON CONFLICT (comp, season_no, stage, gi) DO NOTHING`,
      [comp, seasonNo, stage, gi, JSON.stringify(A), JSON.stringify(B), seed, ENGINE_VERSION, resultJson, resultJson, JSON.stringify(living)]);
    const w = JSON.parse(resultJson).winner;
    winners.push(w === A.name ? A : B);
  }
  return winners;
}

async function rebuildCupSnapshot(pool, comp, seasonNo, now) {
  const rows = await pool.query('SELECT stage, gi, a, b, result FROM cup_matches WHERE comp=$1 AND season_no=$2 ORDER BY stage, gi', [comp, seasonNo]);
  const stages = {};
  let champion = null;
  rows.rows.forEach(r => {
    (stages[r.stage] = stages[r.stage] || []).push({
      gi: r.gi, a: r.a, b: r.b, winner: r.result.winner, text: r.result.text,
      as_: scoreOf(r.result.innings[0]), bs_: scoreOf(r.result.innings[1])
    });
    if (r.stage === 'final') champion = r.result.winner;
  });
  const body = { comp, seasonNo, stages, champion, engineVersion: ENGINE_VERSION, generatedAtDay: dayIx(now) };
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ($1,$2,now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`,
    [(comp === 'wcl' ? 'cup/s' : 'worldcup/s') + seasonNo, JSON.stringify(body)]);
  return body;
}

export async function runCupWindow(pool, host, { now = Date.now() } = {}) {
  // heal up to two seasons back: a dead cron across a rollover must not
  // orphan the previous season's cup
  const seasons = (await pool.query(
    `SELECT season_no, start_day FROM seasons WHERE country_id='eng' ORDER BY season_no DESC LIMIT 2`)).rows.reverse();
  if (!seasons.length) return { skipped: 'no seasons' };
  const all = {};
  for (const s of seasons) all['s' + s.season_no] = await runCupSeason(pool, host, s.season_no, s.start_day, now);
  return all;
}
async function runCupSeason(pool, host, seasonNo, startDay, now) {
  if (dayIx(now) < startDay + 18) return { skipped: 'league days' };
  const out = { wcl: [], wc: [] };
  let champs = null;

  for (const comp of ['wcl', 'wc']) {
    for (const [stage, offset, hour] of CUP_STAGES[comp]) {
      if (!stageClosed(now, startDay, offset, hour)) break;
      const key = comp + ':s' + seasonNo + ':' + stage;
      const claim = await pool.query(
        `INSERT INTO ticks(key, status) VALUES ($1,'running')
         ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING status`, [key]);
      if (claim.rows[0].status === 'done') { out[comp].push({ stage, skipped: true }); continue; }
      if (!champs) { champs = await leagueChampions(pool, seasonNo, now); if (!champs) return { blocked: 'leagues unfinished' }; }
      await buildNatSquads(pool, seasonNo);

      // the seeded field, the same construction every time
      let pairs;
      if (comp === 'wcl') {
        const seeded = champs.map(e => ({ ...e, sv: seedOf('wcl|s' + seasonNo + '|' + e.country) / 4294967296 }))
          .sort((a, b) => b.sv - a.sv);
        if (stage === 'pi') {
          const pi = seeded.slice(seeded.length - 6);
          pairs = [0, 1, 2].map(i => [pi[i], pi[5 - i]]);
        } else {
          const prev = { r16: 'pi', qf: 'r16', sf: 'qf', final: 'sf' }[stage];
          if (stage === 'r16') {
            const piRows = await pool.query(`SELECT a,b,result FROM cup_matches WHERE comp='wcl' AND season_no=$1 AND stage='pi' ORDER BY gi`, [seasonNo]);
            const piWinners = piRows.rows.map(r => r.result.winner === r.a.name ? r.a : r.b);
            const field = seeded.slice(0, seeded.length - 6).concat(piWinners);
            field.sort((a, b) => (seedOf('wcl|s' + seasonNo + '|' + b.country) - seedOf('wcl|s' + seasonNo + '|' + a.country)));
            pairs = []; for (let i = 0; i < field.length / 2; i++) pairs.push([field[i], field[field.length - 1 - i]]);
          } else {
            const rows = await pool.query('SELECT a,b,result FROM cup_matches WHERE comp=$1 AND season_no=$2 AND stage=$3 ORDER BY gi', [comp, seasonNo, prev]);
            const w = rows.rows.map(r => r.result.winner === r.a.name ? r.a : r.b);
            pairs = []; for (let i = 0; i < w.length; i += 2) pairs.push([w[i], w[i + 1]]);
          }
        }
      } else {
        const nats = (await pool.query('SELECT id, name FROM countries ORDER BY id')).rows
          .map(c => ({ country: c.id, name: c.name + ' XI', sv: seedOf('wc|s' + seasonNo + '|' + c.id) / 4294967296 }))
          .sort((a, b) => b.sv - a.sv).slice(0, 16);
        if (stage === 'r16') {
          pairs = []; for (let i = 0; i < 8; i++) pairs.push([nats[i], nats[15 - i]]);
        } else {
          const prev = { qf: 'r16', sf: 'qf', final: 'sf' }[stage];
          const rows = await pool.query('SELECT a,b,result FROM cup_matches WHERE comp=$1 AND season_no=$2 AND stage=$3 ORDER BY gi', [comp, seasonNo, prev]);
          const w = rows.rows.map(r => r.result.winner === r.a.name ? r.a : r.b);
          pairs = []; for (let i = 0; i < w.length; i += 2) pairs.push([w[i], w[i + 1]]);
        }
      }
      await playStage(pool, host, comp, seasonNo, stage, pairs);
      await rebuildCupSnapshot(pool, comp, seasonNo, now);
      await pool.query(`UPDATE ticks SET status='done', finished_at=now() WHERE key=$1`, [key]);
      out[comp].push({ stage, played: pairs.length });
    }
  }
  return out;
}

// season s+1 begins at start_day + 25 in every nation, forever
export async function rollSeasons(pool, { now = Date.now() } = {}) {
  const rows = await pool.query(
    `SELECT DISTINCT ON (country_id) country_id, season_no, start_day FROM seasons ORDER BY country_id, season_no DESC`);
  const rolled = [];
  for (const r of rows.rows) {
    if (dayIx(now) < r.start_day + 25) continue;
    await pool.query(
      `INSERT INTO seasons(country_id, season_no, start_day, schedule) VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING`,
      [r.country_id, r.season_no + 1, r.start_day + 25, JSON.stringify(scheduleOf(r.country_id, r.season_no + 1))]);
    // a year on every colt, and a senior shirt for anyone who has reached 21
    try { await ageYouth(pool, r.country_id, r.season_no); }
    catch (eA) { console.error('academy rollover failed for ' + r.country_id + ':', eA.message); }
    rolled.push(r.country_id + ':s' + (r.season_no + 1));
  }
  return rolled;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pool = makePool();
  const host = makeHost();
  (async () => {
    // a founded league is a league even before its first ball
    try {
      const filled = await ensureSnapshots(pool);
      if (filled.length) console.error('published tables for: ' + filled.join(', '));
    } catch (eS) { console.error('snapshots: ' + eS.message); }
    const all = await runAllDue(pool, host);
    const lines = [];
    for (const [country, r] of Object.entries(all)) {
      const fresh = r.filter(x => !x.skipped);
      if (fresh.length) lines.push(country + ': ' + fresh.map(x => 'day ' + x.day + ' round ' + x.round + ' (' + x.played + ' played)').join(', '));
    }
    const cups = await runCupWindow(pool, host);
    for (const [sk, c] of Object.entries(cups)) {
      if (c && (c.wcl || c.wc)) ['wcl', 'wc'].forEach(comp => {
        const fresh = (c[comp] || []).filter(x => !x.skipped);
        if (fresh.length) lines.push(sk + ' ' + comp + ': ' + fresh.map(x => x.stage + ' (' + x.played + ')').join(', '));
      });
    }
    const rolled = await rollSeasons(pool);
    if (rolled.length) lines.push('seasons rolled: ' + rolled.length);
    try {
      const fr = await runFriendlies(pool, host);
      if (fr.length) lines.push('friendlies played: ' + fr.length);
    } catch (eF) { lines.push('friendlies: ' + eF.message); }
    console.error(lines.length ? lines.join('\n') : 'nothing due anywhere');
    await pool.end();
  })().catch(e => { console.error(e); process.exit(1); });
}
