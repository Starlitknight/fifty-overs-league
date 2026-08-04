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
import { EPOCH, dayIx, daySettled, seedOf, cupDraw, natHour, scheduleOf, seasonSchedules, ROUNDS, isWindowRound,
         CYCLE, LEAGUE_DAYS, roundOfDay, dayOfRound, CUP_DAYS, PLAYOFF_DAYS, FA_DAYS, TRANSITION_DAY,
         WINDOW_DAYS, isWorldCupSeason, REST_DAYS, COLTS_DAYS } from './clock.mjs';
import { livingPatch, evolveCountry } from './living.mjs';
import { calibrate, countryConfigs, BASE_XI, NAT_STR, HUMAN_STR } from './init-world.mjs';
import { stockAcademies, layCandidates, ageYouth, playColtsStage, computeColts, coltRecords,
         COLTS_STAGES, dealYouthToAll } from './youth.mjs';
import { settleMoney } from './economy.mjs';
import { runComps } from './comps.mjs';
import { ensureCallups, absentBySlot, coverSheet, runWindows, rebuildNations, seasonSquad,
         ensureNatSquad, natSquadNow } from './nations.mjs';
import { runMarket, settleMarket, rebuildMarket } from './market.mjs';
import { matchRating, ladderRating, strengthRating, ratingsOf, RANK_WINDOW, RANK_BASE } from './ratings.mjs';

export function matchId(country, seasonNo, round, h, a) {
  return country + ':s' + seasonNo + ':r' + round + ':h' + h + 'a' + a;
}

// what a round's fixtures ARE: rounds 1-14 come off both divisions' stored
// schedules; rounds 15 and 16 are THE PLAYOFFS, derived from the table the
// fourteen produced - 1v4 and 2v3 (higher seed hosts), then the two winners.
// Deterministic from the banked record, so a healed day derives the same ties.
async function fixturesFor(pool, country, season, round, now) {
  const sched = season.schedule;
  if (round <= ROUNDS) {
    if (Array.isArray(sched)) return sched[round - 1] || [];          // pre-pyramid season
    return (sched['1'][round - 1] || []).concat(sched['2'][round - 1] || []);
  }
  const board = await computeLeague(pool, country, season.season_no, now);
  if (board.roundsPlayed < ROUNDS) return [];                          // the fourteen are not done
  const out = [];
  for (const t of [board.table, board.table2]) {
    if (!t || t.length < 4) continue;
    if (round === 15) { out.push([t[0].slot, t[3].slot], [t[1].slot, t[2].slot]); continue; }
    // the final: the two semi winners of this division, higher table seed hosts
    const rank = Object.fromEntries(t.map((x, i) => [x.slot, i]));
    const semis = (await pool.query(
      `SELECT home_slot, away_slot, result FROM matches WHERE country_id=$1 AND season_no=$2 AND round=15`,
      [country, season.season_no])).rows.filter(m => rank[m.home_slot] != null);
    const clubNames = (await pool.query('SELECT slot, name FROM clubs WHERE country_id=$1', [country])).rows;
    const nameOf = Object.fromEntries(clubNames.map(c => [c.slot, c.name]));
    const wSlots = semis.map(m => {
      const w = m.result && m.result.winner;
      if (w === nameOf[m.away_slot]) return m.away_slot;
      return m.home_slot;                    // a tied semi sends the higher seed through
    });
    if (wSlots.length === 2) {
      const [a, b] = wSlots.sort((x, y) => rank[x] - rank[y]);
      out.push([a, b]);
    }
  }
  return out;
}

async function playRound(pool, host, country, season, round, opts) {
  const now = opts && opts.now;
  const fixtures = await fixturesFor(pool, country, season, round, now || Date.now());
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
  // THE WINDOW. On rounds 5, 9 and 13 the selectors have already named their
  // fifteen (runTick banks the squad before a ball is bowled), and those men
  // are not at their clubs today. The side that takes the field is the squad
  // minus whoever has gone; a sheet naming an absentee is covered rather than
  // torn up. Absence rides into the banked living patch so the broadcast
  // fields the same eleven the umpire did.
  const abroad = await absentBySlot(pool, country, season.season_no, round);
  // A BOT PLAYS ITS ARCHETYPE. A club nobody manages used to bat on the
  // engine's one default plan, so a Cavalier XI and a Stonewall XI played the
  // same innings. Each unmanaged club now files the sheet its identity would
  // write - the blade attacks the powerplay, the rock sees off the new ball,
  // the finisher keeps its powder dry for the death, the old guard never
  // panics. A CLAIMED club's own sheet always wins: the doctrine only speaks
  // where a manager has not.
  let played = 0;
  for (let i = 0; i < fixtures.length; i++) {
    if (opts && opts.failAfter != null && played >= opts.failAfter) throw new Error('injected-crash');
    const [hs, as] = fixtures[i];
    const id = matchId(country, season.season_no, round, hs, as);
    const exists = await pool.query('SELECT 1 FROM matches WHERE id=$1', [id]);
    if (exists.rowCount) continue;
    const home = bySlot[hs], away = bySlot[as];
    const seed = seedOf(id);
    const sideOf = club => {
      const gone = abroad.get(club.slot);
      if (!gone || !gone.size) return { players: club.squad, gone: [] };
      return { players: (club.squad || []).filter(p => !gone.has(p.name)),
               gone: (club.squad || []).filter(p => gone.has(p.name)) };
    };
    const H = sideOf(home), A = sideOf(away);
    const tieOrders = {};
    const fileSheet = (club, side) => {
      let o = ordersMap[club.name];
      if (!o) return;
      if (side.gone.length) o = coverSheet(o, side.players, side.gone);
      if (o) tieOrders[club.name] = o;
    };
    fileSheet(home, H); fileSheet(away, A);
    for (const club of [home, away]) {
      if (tieOrders[club.name]) continue;                  // a manager's sheet stands
      const doc = host.doctrineFor(country, club.slot);    // the planet's own table
      if (doc) tieOrders[club.name] = doc;
    }
    // the fixture's conditions: the home nation's climate, tilted by the home
    // club's own groundsman - deterministic, so the forecast a phone printed
    // is the pitch the umpire rolls out, and a healed day replays itself
    const cond = host.condFor(country, hs, season.season_no, round);
    const resultJson = host.runMatch({ name: home.name, players: H.players }, { name: away.name, players: A.players }, cond.pitch, seed, tieOrders, cond.weather);
    if (!resultJson) throw new Error('engine failed to complete ' + id);
    // the living state these men carried into the match, banked with it:
    // the theatre lays it back over the generated squads and replays the
    // identical game, however far the players travel afterwards
    const living = { [home.name]: livingPatch(home.squad, abroad.get(home.slot)),
                     [away.name]: livingPatch(away.squad, abroad.get(away.slot)) };
    // the mark this card is worth, worked out here and kept with it - see
    // ratingsOf. The ladder reads this and never opens the card again.
    let rat = null; try { rat = ratingsOf(resultJson); } catch (eR) {}
    await pool.query(
      `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed, engine_version, pitch, orders, result, result_canonical, home_name, away_name, living, ratings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::text,$13,$14,$15::jsonb,$16::jsonb) ON CONFLICT (id) DO NOTHING`,
      [id, country, season.season_no, round, hs, as, seed, ENGINE_VERSION, cond.pitch, JSON.stringify(tieOrders), resultJson, resultJson, home.name, away.name, JSON.stringify(living), rat ? JSON.stringify(rat) : null]);
    // THE COMMENTARY KEEPS FOR A WEEK. The engine's ball-by-ball is read off
    // the match just played and banked beside the card (never inside it - the
    // canonical result does not move). A failure here must not cost the round:
    // the scorecard is the record, the commentary is a luxury.
    try {
      if (host.lastMatchLog) {
        const log = host.lastMatchLog();
        if (log && log.length) {
          await pool.query(
            `INSERT INTO match_logs(match_id, country_id, log) VALUES ($1,$2,$3::jsonb)
             ON CONFLICT (match_id) DO NOTHING`,
            [id, country, JSON.stringify(log)]);
        }
      }
    } catch (eLg) { console.error('commentary bank failed for ' + id + ':', eLg.message); }
    played++;
  }
  return played;
}

// standings derived purely from persisted matches — re-runnable, never drifts
// THE EMBARGO. A round is prebanked the moment its window opens (that is the
// feed the live viewer reads), but it is not PUBLIC until the window closes:
// the table, the results, the stats and roundsPlayed must never spoil an
// afternoon still being broadcast. This is the last round whose day has
// settled - everything published reads matches only up to it.
export function settledRound(country, startDay, now) {
  const dayOfR = r => r <= ROUNDS ? dayOfRound(r) : (r === ROUNDS + 1 ? PLAYOFF_DAYS.semi : PLAYOFF_DAYS.final);
  let cut = 0;
  for (let r = 1; r <= ROUNDS + 2; r++) {
    const d = dayOfR(r);
    if (d == null) break;
    if (daySettled(now, startDay + d, country)) cut = r; else break;
  }
  return cut;
}
export async function computeLeague(pool, country, seasonNo, now) {
  const season = (await pool.query('SELECT * FROM seasons WHERE country_id=$1 AND season_no=$2', [country, seasonNo])).rows[0];
  const clubs = (await pool.query('SELECT slot, name, ground, is_boss FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  // ONLY THE COLUMNS THIS FUNCTION READS. `SELECT *` also dragged out
  // result_canonical - a full TEXT COPY of the same card - plus the living
  // patch and the filed orders, none of which a league table looks at. A card
  // is around 38 KB, so every row cost more than twice what it needed to, on a
  // read that runs for every nation on every tick and grows all season.
  const cut9 = settledRound(country, season.start_day, now || Date.now());
  const ms = (await pool.query(
    `SELECT id, round, home_slot, away_slot, home_name, away_name, seed, engine_version,
            (result - 'worm') AS result
       FROM matches WHERE country_id=$1 AND season_no=$2 AND round <= $3 ORDER BY round, id`,
    [country, season.season_no, cut9])).rows;
  const bySlot = Object.fromEntries(clubs.map(c => [c.slot, c]));
  // THE PYRAMID: the season row says who plays in which division this year
  // (membership is seasonal - promotion and relegation redraw it). A world
  // founded before divisions existed reads as one big first division.
  const divs = (season.divisions && season.divisions['1'])
    ? { 1: season.divisions['1'], 2: season.divisions['2'] || [] }
    : { 1: clubs.map(c => c.slot), 2: [] };
  const divOf = Object.fromEntries([...divs[1].map(s => [s, 1]), ...divs[2].map(s => [s, 2])]);
  const T = Object.fromEntries(clubs.map(c => [c.slot, { slot: c.slot, name: c.name, boss: c.is_boss, div: divOf[c.slot] || 1, p: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0, of: 0, oa: 0 }]));
  const results = [];
  for (const m of ms) {
    const r = m.result, i1 = r.innings[0], i2 = r.innings[1];
    // playoff rounds (15: semis, 16: the final) are real fixtures but never
    // table rounds - the table is the fourteen, the playoffs decide the crown
    const isPlayoff = m.round > ROUNDS;
    // names AS PLAYED map every innings to its slot, so a club renamed after
    // the fact keeps its whole record; snapshots then speak the CURRENT name
    const hN = m.home_name || bySlot[m.home_slot].name, aN = m.away_name || bySlot[m.away_slot].name;
    const slotOf = nm => nm === hN ? m.home_slot : nm === aN ? m.away_slot : clubs.find(c => c.name === nm)?.slot;
    if (!isPlayoff) {
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
    }
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
  const rankRows = rows => rows.map(x => ({ ...x, nrr: x.of && x.oa ? +(x.rf / x.of - x.ra / x.oa).toFixed(3) : 0 }))
    .sort((a, b) => b.pts - a.pts || b.nrr - a.nrr || a.slot - b.slot);
  const table = rankRows(Object.values(T).filter(x => x.div === 1));
  const table2 = rankRows(Object.values(T).filter(x => x.div === 2));
  // SEASON HONOURS: leaders straight from the banked scorecards - every run
  // and every wicket in the snapshot is one that genuinely happened
  const PS = {};
  // EVERY COLUMN A STATS CENTRE PRINTS, off the same banked cards the top
  // fives come from. The scorecard already carries fours, sixes, maidens and
  // a fielding block, so nothing here is a new measurement - it is the same
  // walk, counting what it was already reading past.
  const pAt = (nm, slot) => PS[nm] = PS[nm] || { name: nm, club: bySlot[slot].name, slot: slot,
    runs: 0, balls: 0, outs: 0, hs: 0, hsNo: false, wkts: 0, conc: 0, bballs: 0, bb: null,
    mB: {}, inns: 0, no: 0, f4: 0, f6: 0, ducks: 0, h50: 0, h100: 0,
    mdns: 0, w3: 0, w5: 0, mBw: {}, ckt: 0, fkt: 0, st: 0, ro: 0, mF: {} };
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
        e.f4 += b.f4 || 0; e.f6 += b.f6 || 0;
        e.inns++; e.mB[m.id] = 1;
        const dismissed = !!(b.out && b.out !== 'not out');
        if (dismissed) e.outs++; else e.no++;
        if ((b.r || 0) === 0 && dismissed) e.ducks++;
        if ((b.r || 0) >= 100) e.h100++; else if ((b.r || 0) >= 50) e.h50++;
        if ((b.r || 0) > e.hs) { e.hs = b.r || 0; e.hsNo = !dismissed; }
      }
      // WHO HELD THE CATCH, AND WHOSE GLOVES. The fielding block counts the
      // chances; only the dismissal line says whether the man behind them was
      // the keeper, and it says so with the dagger the scorebook has always
      // used. Stumpings and run-outs are the block's own count.
      if (os != null) {
        const glove = {};
        for (const b of (inn.bat || [])) {
          const o = b && b.out; if (!o) continue;
          const mC = /^c (\u2020?)(.+?) b /.exec(o);
          if (mC) glove[mC[2]] = (glove[mC[2]] || 0) + (mC[1] ? 1000 : 1);
        }
        const F = inn.fielding || {};
        for (const nm2 of Object.keys(F)) {
          const e2 = pAt(nm2, os), g = glove[nm2] || 0;
          e2.ckt += Math.floor(g / 1000); e2.fkt += g % 1000;
          e2.st += (F[nm2] && F[nm2].st) || 0; e2.ro += (F[nm2] && F[nm2].ro) || 0;
          e2.mF[m.id] = 1;
        }
      }
      if (os != null) for (const nm of Object.keys(inn.bowlers || {})) {
        const bw = inn.bowlers[nm], e = pAt(nm, os);
        e.wkts += bw.w || 0; e.conc += bw.r || 0; e.bballs += bw.b || 0;
        e.mdns += bw.mdn || 0; e.mBw[m.id] = 1;
        if ((bw.w || 0) >= 5) e.w5++; else if ((bw.w || 0) >= 3) e.w3++;
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
  // THE STATS CENTRE. The five-name honour boards above are a headline; this
  // is the whole league, every man who has done anything, with the columns a
  // scorer keeps. It rides in its own document rather than the league
  // snapshot, because every device fetches the league on every visit and
  // almost none of them are reading the averages column.
  const r1 = v => Math.round(v * 100) / 100;
  const statsFull = ppl.map(x => {
    const mats = new Set(Object.keys(x.mB).concat(Object.keys(x.mBw), Object.keys(x.mF)));
    return {
      name: x.name, club: x.club, slot: x.slot, div: divOf[x.slot] || 1, m: mats.size,
      inns: x.inns, no: x.no, runs: x.runs, hs: x.hs, hsNo: x.hsNo,
      ave: x.outs ? r1(x.runs / x.outs) : null, bf: x.balls,
      sr: x.balls ? r1(100 * x.runs / x.balls) : null,
      ducks: x.ducks, h50: x.h50, h100: x.h100, f4: x.f4, f6: x.f6,
      balls: x.bballs, mdns: x.mdns, conc: x.conc, wkts: x.wkts, bb: x.bb,
      bave: x.wkts ? r1(x.conc / x.wkts) : null,
      er: x.bballs ? r1(6 * x.conc / x.bballs) : null,
      bsr: x.wkts ? r1(x.bballs / x.wkts) : null,
      w3: x.w3, w5: x.w5, ckt: x.ckt, fkt: x.fkt, st: x.st, ro: x.ro
    };
  });
  const roundsPlayed = ms.length ? Math.max(0, ...ms.map(m => m.round).filter(r => r <= ROUNDS)) : 0;
  // THE CROWN IS WON ON FINALS NIGHT. The champion of a division is the winner
  // of its playoff final (round 16); the table's leader after the fourteen is
  // the SHIELD winner - both are honours, only one is the title. A season that
  // has not reached finals night yet has no champion, whatever the table says.
  const finalWinner = d => {
    const f = ms.filter(m => m.round === 16 && (divOf[m.home_slot] || 1) === d)
      .map(m => m.result && m.result.winner).filter(Boolean)[0];
    return f || null;
  };
  const champion = finalWinner(1);
  const champion2 = finalWinner(2);
  const shield = roundsPlayed >= ROUNDS && table[0] ? table[0].name : null;
  const shield2 = roundsPlayed >= ROUNDS && table2[0] ? table2[0].name : null;
  // THE NATION'S SIDE RIDES WITH ITS LEAGUE. Every surface that draws a
  // cricketer - the roster, his page, his card, a scorecard, the market - wants
  // to know whether he plays for his country, and every one of them already
  // holds this nation's league snapshot. Fifteen names is a cheap thing to
  // carry and saves each of them a second request.
  const nat = await natSquadNow(pool, country, season.season_no);
  return { country, seasonNo: season.season_no, startDay: season.start_day, rounds: ROUNDS, roundsPlayed,
    divisions: divs, table, table2, results, stats, statsFull,
    champion, champion2, shield, shield2,
    nat: { round: nat.round, squad: nat.squad, in: nat.in, out: nat.out },
    generatedAtDay: dayIx(now) };
}

// THE WORLD RANKINGS: every club on earth on one ladder, standing on the MATCH
// RATING the game has always written for its last three matches.
//
// That rating is not a new invention for this page. It is the figure on the
// Match ratings tab of every scorecard in Fifty Overs - six units a side
// against real-ODI par, on the club rating scale - averaged across the units
// both sides used. server/ratings.mjs holds the port and the reasoning.
//
// Three matches is the window, so the ladder is a record of how sides are
// playing NOW rather than of everything they ever did. A club that has not
// played three yet is presumed ordinary - 3,500, the middle of the scale - for
// the rest, so one freak night cannot outrank a season's work.
//
// Nothing is stored. The whole ladder is rebuilt from the banked cards each
// tick, and every match in the world is put on ONE clock first - season, then
// round, with a season's cup ties after its last league round, which is when
// they are played. Order matters here in a way it never did for a rolling
// rating: "the last three" is only meaningful if the three are the right ones.
// So it can never drift, and a club rename never costs a point - histories key
// by country:slot.
export async function computeRankings(pool, now) {
  const clubs = (await pool.query('SELECT country_id, slot, name, is_boss FROM clubs ORDER BY country_id, slot')).rows;
  const key = (c, s) => c + ':' + s;
  const R = {};
  clubs.forEach(c => R[key(c.country_id, c.slot)] = {
    country: c.country_id, slot: c.slot, name: c.name, boss: c.is_boss, hist: [], p: 0, w: 0, l: 0, t: 0
  });
  // ONE CLOCK FOR THE WHOLE WORLD. A season is a thousand ticks wide: league
  // round r sits at r, and the cup ties that close that season sit above 500,
  // in the order they were played. Every match therefore falls in the seat it
  // was played in, whichever competition it belonged to.
  const seq = (season, slot) => (season | 0) * 1000 + slot;
  const STAGE = { pi: 0, r16: 1, qf: 2, sf: 3, final: 4 };
  const events = [], natEvents = [];
  // THE LADDER IS BUILT FROM THE INNINGS AND NOTHING ELSE. A card carries a
  // `worm` - the run-rate curve a scorecard draws - which is a quarter of its
  // weight and says nothing about how a side played. Dropped in the database
  // rather than in Node, so it never crosses the wire.
  // THE CARD IS ONLY FETCHED WHEN ITS MARK IS MISSING. The CASE is evaluated
  // per row inside the database, so a match that already carries its rating
  // sends back a few dozen bytes and its 38 KB of ball-by-ball never crosses
  // the wire. A world banked before this existed is filled in by fillRatings
  // below, a batch a tick, and then costs nothing forever.
  const ms0 = (await pool.query(
    `SELECT season_no, round, country_id, home_slot, away_slot, home_name, away_name, ratings,
            CASE WHEN ratings IS NULL THEN (result - 'worm') END AS result FROM matches
      ORDER BY season_no, round, country_id, home_slot`)).rows;
  // the embargo holds here too: a prebanked round must not move the ladder
  // while its window is still being broadcast
  const starts9 = {};
  (await pool.query('SELECT country_id, season_no, start_day FROM seasons')).rows
    .forEach(s9 => { starts9[s9.country_id + ':' + s9.season_no] = s9.start_day; });
  const ms = ms0.filter(m9 => {
    const st9 = starts9[m9.country_id + ':' + m9.season_no];
    return st9 == null || (m9.round | 0) <= settledRound(m9.country_id, st9, now || Date.now());
  });
  ms.forEach((m, i) => events.push({
    at: seq(m.season_no, m.round | 0), i,
    ak: key(m.country_id, m.home_slot), bk: key(m.country_id, m.away_slot),
    an: m.home_name, bn: m.away_name, result: m.result, rat: m.ratings
  }));
  const wclm = (await pool.query(
    `SELECT season_no, stage, gi, a, b, result FROM cup_matches WHERE comp='wcl' ORDER BY season_no, stage, gi`)).rows;
  wclm.forEach((m, i) => {
    if (m.a.slot == null || m.b.slot == null) return;
    events.push({
      at: seq(m.season_no, 500 + (STAGE[m.stage] || 0) * 10), i: ms.length + i,
      ak: key(m.a.country, m.a.slot), bk: key(m.b.country, m.b.slot),
      an: m.a.name, bn: m.b.name, result: m.result
    });
  });
  // the nations climb their own ladder, off tours and the World Cup, on the
  // same clock and marked exactly the same way
  const countryRows = (await pool.query('SELECT id, name FROM countries')).rows;
  const N = {};
  countryRows.forEach(c => N[c.id] = { hist: [], p: 0, w: 0, l: 0, t: 0 });
  let tours = [];
  try {
    tours = (await pool.query(
      `SELECT season_no, round, a_country, b_country, a_name, b_name, result FROM nat_matches
        ORDER BY world_day, id`)).rows;
  } catch (eT) { tours = []; }                   // pre-023 database: no tours yet
  tours.forEach((m, i) => natEvents.push({
    at: seq(m.season_no, m.round | 0), i,
    ak: m.a_country, bk: m.b_country, an: m.a_name, bn: m.b_name, result: m.result
  }));
  const wcm = (await pool.query(
    `SELECT season_no, stage, gi, a, b, result FROM cup_matches WHERE comp='wc' ORDER BY season_no, stage, gi`)).rows;
  wcm.forEach((m, i) => natEvents.push({
    at: seq(m.season_no, 500 + (STAGE[m.stage] || 0) * 10), i: tours.length + i,
    ak: m.a.country, bk: m.b.country, an: m.a.name, bn: m.b.name, result: m.result
  }));

  // ONE BANKED CARD, MARKED FOR BOTH SIDES. The mark is the match rating and
  // nothing else - it says how well a side played, not whether it won, which is
  // what the game's own ratings tab has always said. Won-lost-tied is kept
  // alongside because a manager wants to see it, but it does not move the mark.
  const mark = (side, ev) => {
    const a = side[ev.ak], b = side[ev.bk];
    if (!a || !b) return;
    // the mark banked with the card, or the card itself when there is none
    const tr = (ev.rat && ev.rat.r) ? ev.rat.r : matchRating(ev.result);
    const an = ev.an || a.name || '', bn = ev.bn || b.name || '';
    const ra = tr[an], rb = tr[bn];
    if (!ra || !rb) return;                      // a card whose sides we cannot name
    a.hist.push(ra.rating); b.hist.push(rb.rating);
    a.p++; b.p++;
    const w = ev.rat ? (ev.rat.w || null) : ((ev.result && ev.result.winner) || null);
    if (w == null) { a.t++; b.t++; } else if (w === an) { a.w++; b.l++; } else { b.w++; a.l++; }
  };
  // the query order breaks every tie, so the sort is total and the ladder is
  // the same figure however the rows came back
  const byClock = (x, y) => x.at - y.at || x.i - y.i;
  events.sort(byClock).forEach(ev => mark(R, ev));
  natEvents.sort(byClock).forEach(ev => mark(N, ev));

  const rate = x => ladderRating(x.hist);
  const clubList = Object.values(R)
    .map(x => Object.assign({}, x, { rating: rate(x), form: x.hist.slice(-RANK_WINDOW) }))
    .sort((x, y) => y.rating - x.rating || y.p - x.p || x.country.localeCompare(y.country) || x.slot - y.slot)
    .map((x, i) => ({ rank: i + 1, country: x.country, slot: x.slot, name: x.name, boss: x.boss,
                      rating: x.rating, form: x.form, p: x.p, w: x.w, l: x.l, t: x.t }));
  // THE NATIONS ARE COMPARED ON STRENGTH, NOT FORM. Ten clubs' three-match form
  // averages straight back to fifty, so the club ladder's window is the wrong
  // lens on a whole league: here every mark a nation's clubs have ever earned
  // counts, and the same for its XI. Form for a club, a body of work for a country.
  const countries = countryRows.map(c => {
    const mine = Object.values(R).filter(x => x.country === c.id);
    const marks = mine.reduce((a, x) => a.concat(x.hist), []);
    return {
      id: c.id, name: c.name,
      clubRating: strengthRating(marks), clubP: marks.length,
      natRating: strengthRating(N[c.id].hist), natP: N[c.id].p
    };
  }).sort((a, b) => b.clubRating - a.clubRating || b.natRating - a.natRating || a.id.localeCompare(b.id))
    .map((c, i) => ({ rank: i + 1, ...c }));
  return { clubs: clubList, countries, window: RANK_WINDOW, base: RANK_BASE, generatedAtDay: dayIx(now) };
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
export async function rebuildSnapshots(pool, country, now, opts) {
  const season = (await pool.query('SELECT * FROM seasons WHERE country_id=$1 ORDER BY season_no DESC LIMIT 1', [country])).rows[0];
  const league = await computeLeague(pool, country, season.season_no, now);
  // the stats centre travels separately: a league snapshot is fetched by every
  // device on every visit, and the averages column is not
  const statsFull = league.statsFull || [];
  delete league.statsFull;
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ($1,$2,now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`, ['league/' + country, JSON.stringify(league)]);
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ($1,$2,now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`,
    ['stats/' + country, JSON.stringify({ country, seasonNo: season.season_no, roundsPlayed: league.roundsPlayed, players: statsFull })]);
  // the Colts Cup board is NOT rebuilt here. The boys play in week four and
  // nowhere else, so recomputing their bracket on every league round of every
  // nation was fourteen reads of a competition that had not moved. runColtsCup
  // owns it, and rebuilds it on the days it can have changed.
  // THE WORLD'S BOOKS ARE THE WORLD'S, NOT EACH NATION'S. Today's summary, the
  // honours and the rankings describe the whole planet, and this runs once per
  // country - so settling a tick rebuilt all three NINETEEN TIMES, and the
  // rankings walk every match ever played. Nineteen full reads of the world's
  // entire record, every hour, to write the same three documents nineteen
  // times over. runAllDue now does the world once, after the nations; every
  // other caller still gets the whole job by default, so a lone rebuild is
  // still a complete one.
  if (!opts || opts.world !== false) await rebuildWorld(pool, now);
  return league;
}

// A WORLD BANKED BEFORE THE MARK WAS KEPT. Every card played before this
// existed has no rating beside it, so the ladder still opens it - which is the
// very cost this was meant to end. Filling them is a one-off, but doing it in
// one go would pull the whole record at once, so it goes a batch at a time:
// after a handful of ticks every card has its mark and the query above stops
// fetching cards altogether. Bounded, idempotent, and safe to interrupt.
const RATING_BACKFILL = 120;
export async function fillRatings(pool, limit = RATING_BACKFILL) {
  let done = 0;
  try {
    const rows = (await pool.query(
      `SELECT id, (result - 'worm') AS result FROM matches
        WHERE ratings IS NULL ORDER BY season_no, round LIMIT $1`, [limit])).rows;
    for (const m of rows) {
      const rat = ratingsOf(m.result);
      if (!rat) continue;
      await pool.query('UPDATE matches SET ratings=$2 WHERE id=$1', [m.id, JSON.stringify(rat)]);
      done++;
    }
  } catch (e) { console.error('rating backfill failed:', e.message); }
  if (done) console.log('banked the mark for ' + done + ' older cards');
  return done;
}

// the three documents that describe the whole planet rather than one nation
export async function rebuildWorld(pool, now) {
  await fillRatings(pool);
  await rebuildWorldToday(pool, now);
  await rebuildHonours(pool);
  const rk = await computeRankings(pool, now);
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ('rankings', $1, now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`, [JSON.stringify(rk)]);
  return rk;
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

// THE TREASURY, settled by the umpire and by nobody else - now a ledger
// rather than four flat numbers. economy.mjs walks every round this country
// has ever played and derives the crowd, the mood, the gate, the sponsor, the
// wages, the upkeep and the interest from the record alone. Re-running still
// settles the same figure.
// The one honest simplification survives: wages are charged at the bill as it
// stands today, so a squad that trains itself upward revises its own history
// slightly - and what a manager has spent on his academy or his ground is
// carried from the founding, so nobody can hide a purchase in an overdraft.
export { settleMoney } from './economy.mjs';

export async function runTick(pool, host, country, day, { now = Date.now(), failAfter = null, world = true } = {}) {
  const key = country + ':day:' + day;
  const claim = await pool.query(
    `INSERT INTO ticks(key, status) VALUES ($1,'running')
     ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING status`, [key]);
  if (claim.rows[0].status === 'done') return { skipped: true };
  const season = (await pool.query('SELECT * FROM seasons WHERE country_id=$1 ORDER BY season_no DESC LIMIT 1', [country])).rows[0];
  if (!season) throw new Error('no season for ' + country);
  // WHICH ROUND IS THIS DAY? Not day+1 any more: the league runs three rounds
  // then rests, so the mapping is the calendar's to give.
  const round = roundOfDay(day - season.start_day);
  let played = 0;
  if (round) {
    // THE SELECTORS MEET BEFORE EVERY ROUND, not three times a year. Round
    // one's fifteen is named off the founding squads before a ball is bowled,
    // so a nation has a side from the first morning of the season; every round
    // after it they name it again, having watched the cricket since - the
    // previous day's tick evolved every man who played it before it closed.
    // Banked per round, so a healed day reads the decision back rather than
    // taking it again on form the selectors could not have known.
    if (round <= ROUNDS) {
      try { await ensureNatSquad(pool, country, season.season_no, round); }
      catch (eN) { console.error('selectors failed for ' + country + ' round ' + round + ':', eN.message); }
      // On a window round that same fifteen also takes its flights.
      if (isWindowRound(round)) {
        try { await ensureCallups(pool, country, season.season_no, round); }
        catch (eC) { console.error('selectors failed for ' + country + ' round ' + round + ':', eC.message); }
      }
    }
    played = await playRound(pool, host, country, season, round, { failAfter, now });
    // the nets: whatever plan stands when a round settles is the work that
    // round did, banked so the squad's skills stay recomputable from genesis
    // the plan in force AND the academy in force: a building that changes the
    // rate has to be part of the record, or the squad stops being replayable
    await pool.query(
      `INSERT INTO training_rounds(country_id, slot, season_no, round, plan, academy)
       SELECT country_id, slot, $2, $3, coalesce(training, '{}'::jsonb), academy FROM clubs WHERE country_id=$1
       ON CONFLICT (country_id, slot, season_no, round) DO NOTHING`,
      [country, season.season_no, round]);
    // THE ALMANACK SLIMS. Only the current round is ever replayed by a
    // broadcast (the spectator contract test 015 proves), so match rows more
    // than two rounds behind lose their replay blob and living patch - the
    // scorecard (result) is forever. This is what keeps a two-division world
    // smaller on disk than the one-division world it replaces.
    try {
      await pool.query(
        `UPDATE matches SET result_canonical=NULL, living=NULL
          WHERE country_id=$1 AND result_canonical IS NOT NULL
            AND (season_no < $2 OR (season_no = $2 AND round < $3 - 1))`,
        [country, season.season_no, round]);
    } catch (eSl) { console.error('almanack slimming failed for ' + country + ':', eSl.message); }
    // the week-old commentary is let go; the RPC refuses to serve past the
    // week anyway, so a late prune never leaks a stale book
    try {
      await pool.query(`DELETE FROM match_logs WHERE played_at < now() - interval '7 days'`);
    } catch (eLp) { /* pre-045 database: no commentary bank yet */ }
  }
  // THE MARKET. Bot clubs shed men on league rounds; the free-agent trickle
  // walks on EVERY day the world turns, rest days included - which is why
  // this stands outside the round gate. Both seeded, so the same world puts
  // up the same cricketers however often the day is settled.
  try { await runMarket(pool, country, season.season_no, round || 0, { now, host }); }
  catch (eM) { console.error('market listings failed for ' + country + ':', eM.message); }
  // the day's cricket changes the men who played it: careers, form, tired
  // legs, and the work they did in the nets. A pure function of the record,
  // so re-running settles the same.
  await evolveCountry(pool, country, now, host);
  // AND THE SELECTORS MEET AGAIN, now that they have seen it. "Between
  // matches" is meant literally: the side for the NEXT round is named here,
  // the moment this round's cricket has been read into the players, rather
  // than waiting for tomorrow's tick to open. So the snapshot published a few
  // lines below already carries the side that stands going into the next
  // round, and a manager looking on a rest day sees the current fifteen and
  // not last week's.
  if (round && round < ROUNDS) {
    try { await ensureNatSquad(pool, country, season.season_no, round + 1); }
    catch (eN2) { console.error('selectors failed for ' + country + ' round ' + (round + 1) + ':', eN2.message); }
  }
  // THE ACADEMIES. Two jobs, and they are deliberately different jobs: the
  // umpire keeps an UNMANAGED club stocked to fifteen boys so the Colts Cup
  // always has a field, and it lays out the candidates a MANAGED club's scout
  // could be sent to see. It never signs anybody for a human.
  // the founding deal first, so the sixteen are in place before the floor
  // check ever runs; it is a no-op forever after its one firing
  try { await dealYouthToAll(pool, host, country); }
  catch (eDl) { console.error('founding youth deal failed for ' + country + ':', eDl.message); }
  try { await stockAcademies(pool, host, country, { worldDay: day }); }
  catch (eY) { console.error('academy stocking failed for ' + country + ' day ' + day + ':', eY.message); }
  try {
    await layCandidates(pool, host, country, {
      worldDay: day, startDay: season.start_day, restDays: REST_DAYS
    });
  } catch (eC) { console.error('scouting candidates failed for ' + country + ' day ' + day + ':', eC.message); }
  await settleMoney(pool, country);
  await rebuildSnapshots(pool, country, now, { world: world });
  await pool.query(`UPDATE ticks SET status='done', finished_at=now(), detail=$2 WHERE key=$1`,
    [key, JSON.stringify({ round: round || null, played })]);
  return { skipped: false, round, played };
}

// heal any gap: settle every due day since the season began
// EVERY NEW MANAGER FOUNDS ON THE SAME FOOTING. A fresh claim inherits a bot
// squad at whatever rung the seating chart dealt that seat - a lottery no
// person chose. Before the next cricket is played, the club's OWN men (same
// names, same careers - the board's new investment raises the squad, it does
// not replace it) are scaled once onto the standard newcomer rung, and the
// claim is marked levelled so training and trading are never overwritten
// after that. Pre-parity claims default to levelled and are the reseed's
// business, not a surprise rewrite here.
async function levelNewClaims(pool, host, country) {
  let rows = [];
  try {
    rows = (await pool.query(
      `SELECT c.slot, cl.squad FROM claims c JOIN clubs cl
         ON cl.country_id=c.country_id AND cl.slot=c.slot
        WHERE c.country_id=$1 AND c.levelled=false`, [country])).rows;
  } catch (e) { return 0; }                    // pre-030 database: nothing to level
  if (!rows.length) return 0;
  const cfg = countryConfigs(host).find(c => c.id === country);
  for (const r of rows) {
    const target = BASE_XI * ((cfg && NAT_STR[cfg.id]) || 1) * HUMAN_STR;
    const men = calibrate(host, r.squad, target);
    await pool.query('UPDATE clubs SET squad=$3 WHERE country_id=$1 AND slot=$2',
      [country, r.slot, JSON.stringify(men)]);
    await pool.query('UPDATE claims SET levelled=true WHERE country_id=$1 AND slot=$2',
      [country, r.slot]);
  }
  return rows.length;
}

export async function runDue(pool, host, country, { now = Date.now(), failAfter = null, world = true } = {}) {
  const season = (await pool.query('SELECT * FROM seasons WHERE country_id=$1 ORDER BY season_no DESC LIMIT 1', [country])).rows[0];
  if (!season) return [];
  await levelNewClaims(pool, host, country);
  const out = [];
  for (let day = season.start_day; day <= dayIx(now); day++) {
    if (!daySettled(now, day, country)) break;
    // the league runs through the playoff final (di 25); the FA Cup Sundays
    // inside that span are the cup runner's business, and the closing week
    // (Champions Cup) is the cup window's
    if (day - season.start_day > PLAYOFF_DAYS.final) break;
    out.push({ day, ...(await runTick(pool, host, country, day, { now, failAfter, world })) });
  }
  // THE FIRST BALL IS THE SIMULATION. From the moment a nation's window
  // opens, its round is already played and banked - the match cards and the
  // ball-by-ball, nothing else - so a viewer reads the live match as a feed
  // of the umpire's own record instead of re-simulating it. Standings, the
  // squads' evolution and the public snapshot still settle when the window
  // closes, exactly as before, so nothing spoils early. The closing resolve
  // finds these matches already banked and skips them: playRound has always
  // been idempotent per match, and the engine deterministic, so the two
  // passes cannot disagree.
  try {
    const today = dayIx(now);
    const dToday = today - season.start_day;
    const winOpen = now >= EPOCH + today * 86400000 + natHour(country) * 3600000;
    if (winOpen && !daySettled(now, today, country) && dToday >= 0 && dToday <= PLAYOFF_DAYS.final) {
      const r9 = roundOfDay(dToday);
      if (r9) {
        if (r9 <= ROUNDS) {
          try { await ensureNatSquad(pool, country, season.season_no, r9); } catch (eN9) {}
          if (isWindowRound(r9)) { try { await ensureCallups(pool, country, season.season_no, r9); } catch (eC9) {} }
        }
        const pb = await playRound(pool, host, country, season, r9, { now });
        if (pb) out.push({ day: today, prebanked: pb });
      }
    }
  } catch (ePb) { console.error('prebank failed for ' + country + ':', ePb.message); }
  // A WORLD THAT WAS ALREADY PLAYING WHEN THE SELECTORS ARRIVED. runTick names
  // a side before each round and again after it, but a day already settled
  // short-circuits before reaching either - so a league that had banked rounds
  // before this existed would have no side named until its next round came
  // round, and a manager looking in between would be told his country has
  // picked nobody. Naming it here, outside the per-day guard, means every
  // nation always has a fifteen. Banked once per round, so on any tick that
  // actually played cricket this finds the squad already there and does
  // nothing; only a world that needs catching up pays for a republish.
  try {
    const playedRaw = (await pool.query(
      'SELECT COALESCE(MAX(round),0) AS r FROM matches WHERE country_id=$1 AND season_no=$2',
      [country, season.season_no])).rows[0].r | 0;
    // a prebanked round is not a played round until its window closes - the
    // selectors must not name the NEXT fifteen off cricket still on air
    const played = Math.min(playedRaw, settledRound(country, season.start_day, now));
    const stands = Math.min(played + 1, ROUNDS);
    const had = (await pool.query(
      'SELECT 1 FROM nat_squad WHERE country_id=$1 AND season_no=$2 AND round=$3',
      [country, season.season_no, stands])).rowCount;
    if (!had) {
      await ensureNatSquad(pool, country, season.season_no, stands);
      await rebuildSnapshots(pool, country, now, { world: world });   // so the side reaches the client
      out.push({ day: null, namedNatSquad: stands });
    }
  } catch (eNb) { console.error('standing squad failed for ' + country + ':', eNb.message); }
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
    // a friendly is played at the challenger's ground, in its weather
    const fCond = host.condFor(f.c_country, f.c_slot, 0, Number(f.id) || seed % 997);
    const resultJson = host.runMatch({ name: hc.name, players: hc.squad }, { name: ac.name, players: ac.squad }, fCond.pitch, seed, ordersMap, fCond.weather);
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
    // and one nation's snapshot failing must not stop the rest being published
    try { await rebuildSnapshots(pool, c.id, now); filled.push(c.id); }
    catch (e) { console.error('snapshot failed for ' + c.id + ':', e.message); }
  }
  return filled;
}

// ONE NATION'S BAD DAY IS NOT THE PLANET'S. This walked the countries in id
// order and let anything thrown out of one of them abort the whole call - so
// a single failure in, say, New Zealand silently stopped Pakistan, South
// Africa, Scotland, Sri Lanka, India, the United States, Wales, the West
// Indies and Zimbabwe from playing at all, while every nation alphabetically
// ahead of it carried on as though the world were fine. The tail of the
// alphabet simply stopped updating. Each country is now settled inside its
// own guard: the failure is reported against that country and the rest of
// the world plays on, and because the tick's idempotency row stays 'running'
// the next invocation retries exactly what was missed.
export async function runAllDue(pool, host, opts = {}) {
  const cs = await pool.query('SELECT id FROM countries ORDER BY id');
  const out = {};
  for (const row of cs.rows) {
    try {
      // the nations settle without touching the world's three documents...
      out[row.id] = await runDue(pool, host, row.id, { ...opts, world: false });
    } catch (e) {
      out[row.id] = [{ failed: true, error: e.message }];
      console.error('tick failed for ' + row.id + ':', e.message);
      if (opts && opts.failAfter != null) throw e;      // the crash tests mean it
    }
  }
  // ...and the world is written ONCE, after all of them, from the record they
  // have just finished writing. A nation that failed does not stop it: the
  // rankings and the honours are derived from what IS banked, so publishing
  // them is right whatever else went wrong.
  try { await rebuildWorld(pool, opts.now ?? Date.now()); }
  catch (e) { console.error('world rebuild failed:', e.message); }
  return out;
}

// ============================================================================
// THE CUP WINDOW, on the real engine (docs/PYRAMID.md §6-7).
//
// CHAMPIONS CUP — the sixteen national champions (each league's PLAYOFF
// winner), in the closing week: four groups of four seeded by nation tier
// (snake), group rounds Mon-Wed (di 28-30), quarters Fri (32), semis Sat
// (33), THE FINAL Sunday (34).
//
// WORLD CUP — every fourth season, played ON the international tour days:
// groups di 2/5/9, quarters 12, semis 16, the final 19. Other seasons those
// days carry bilateral tours as ever.
//
// A stage settles once its three-hour window closes (global UTC hours).
// Same laws as the leagues: idempotency keys per stage, results immutable,
// snapshots derived. Season s+1 begins at start_day + CYCLE, forever.
// ============================================================================
const CUP_STAGES = {
  wcl: [['g1', CUP_DAYS.g1, 15], ['g2', CUP_DAYS.g2, 15], ['g3', CUP_DAYS.g3, 15],
        ['qf', CUP_DAYS.qf, 15], ['sf', CUP_DAYS.sf, 18], ['final', CUP_DAYS.final, 18]],
  wc: [['g1', WINDOW_DAYS[0], 12], ['g2', WINDOW_DAYS[1], 12], ['g3', WINDOW_DAYS[2], 12],
       ['qf', WINDOW_DAYS[3], 12], ['sf', WINDOW_DAYS[4], 12], ['final', WINDOW_DAYS[5], 12]]
};
const DAY_MS = 86400000;
function stageClosed(now, startDay, offset, hour) {
  return now >= EPOCH + (startDay + offset) * DAY_MS + (hour + 3) * 3600000;
}
const scoreOf = inn => inn ? inn.runs + (inn.wkts >= 10 ? ' all out' : '/' + inn.wkts) : '';

// each nation's champion: the winner of its Division One playoff final
async function leagueChampions(pool, seasonNo, now) {
  const cs = await pool.query('SELECT id FROM countries ORDER BY id');
  const out = [];
  for (const row of cs.rows) {
    const b = await computeLeague(pool, row.id, seasonNo, now);
    if (!b || !b.champion) return null;               // finals night not banked: no cup yet
    const seat = b.table.find(t => t.name === b.champion) || b.table[0];
    out.push({ country: b.country, slot: seat.slot, name: b.champion });
  }
  return out.length ? out : null;
}

// SNAKE SEEDING into four groups of four by nation tier - deterministic and
// knowable offline the moment the entrants are: pot 1 heads the groups, pot 2
// comes back the other way, and so on.
function snakeGroups(entrants, tierOf) {
  const seeded = entrants.slice().sort((a, b) => (tierOf(b) - tierOf(a)) || (a.country < b.country ? -1 : 1));
  const groups = [[], [], [], []];
  seeded.forEach((e, i) => {
    const pot = Math.floor(i / 4), ix = i % 4;
    groups[pot % 2 ? 3 - ix : ix].push(e);
  });
  return groups;
}
// a 4-team single round robin over three days: day 1: 1v4 2v3, day 2: 1v3 4v2, day 3: 1v2 3v4
const GROUP_ROUNDS = { g1: [[0, 3], [1, 2]], g2: [[0, 2], [3, 1]], g3: [[0, 1], [2, 3]] };
// the group tables, from the banked group-stage cards
async function groupTables(pool, comp, seasonNo, groups) {
  const rows = (await pool.query(
    `SELECT stage, gi, a, b, result FROM cup_matches WHERE comp=$1 AND season_no=$2 AND stage IN ('g1','g2','g3')`,
    [comp, seasonNo])).rows;
  const T = {};
  groups.forEach((g, gix) => g.forEach(e => { T[e.name] = { e, g: gix, pts: 0, diff: 0 }; }));
  for (const m of rows) {
    const r = m.result, i0 = r.innings && r.innings[0], i1 = r.innings && r.innings[1];
    const ra = i0 && i0.batTeam === m.a.name ? i0.runs : (i1 ? i1.runs : 0);
    const rb = i0 && i0.batTeam === m.b.name ? i0.runs : (i1 ? i1.runs : 0);
    if (!T[m.a.name] || !T[m.b.name]) continue;
    T[m.a.name].diff += ra - rb; T[m.b.name].diff += rb - ra;
    if (r.winner === null) { T[m.a.name].pts++; T[m.b.name].pts++; }
    else T[r.winner === m.a.name ? m.a.name : m.b.name].pts += 2;
  }
  return groups.map((g, gix) => Object.values(T).filter(x => x.g === gix)
    .sort((x, y) => y.pts - x.pts || y.diff - x.diff || (x.e.name < y.e.name ? -1 : 1))
    .map(x => x.e));
}

// THE WORLD CUP SIDE IS THE SEASON'S SIDE. It used to be fifteen names picked
// by raw rating the morning of the draw, which meant the men who had played
// for their country all year could find themselves left at home by the same
// selectors. Now it is the squad of the season's last international window -
// the side that actually toured - looked up in the squads as they stand.
async function buildNatSquads(pool, seasonNo) {
  const cs = await pool.query('SELECT id, name FROM countries ORDER BY id');
  for (const c of cs.rows) {
    const picked = await seasonSquad(pool, c.id, seasonNo);
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
    // a cup tie is staged in the first-drawn side's conditions - its country's
    // climate without any groundsman tilt (slot 0 hosts, the neutral big ground)
    const cCond = host.condFor(A.country || 'eng', 0, seasonNo, seed % 997);
    const resultJson = host.runMatch({ name: A.name, players: sqA }, { name: B.name, players: sqB }, cCond.pitch, seed, undefined, cCond.weather);
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
  const out = { wcl: [], wc: [] };
  let champs = null;

  // the World Cup only exists every fourth season; the Champions Cup always
  const comps = isWorldCupSeason(seasonNo) ? ['wc', 'wcl'] : ['wcl'];
  for (const comp of comps) {
    // entrants: the sixteen nations (wc) or the sixteen playoff champions (wcl)
    let groups = null;
    for (const [stage, offset, hour] of CUP_STAGES[comp]) {
      if (!stageClosed(now, startDay, offset, hour)) break;
      const key = comp + ':s' + seasonNo + ':' + stage;
      const claim = await pool.query(
        `INSERT INTO ticks(key, status) VALUES ($1,'running')
         ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING status`, [key]);
      if (claim.rows[0].status === 'done') { out[comp].push({ stage, skipped: true }); continue; }
      if (!groups) {
        let entrants;
        if (comp === 'wcl') {
          if (!champs) { champs = await leagueChampions(pool, seasonNo, now); if (!champs) return { blocked: 'finals unplayed' }; }
          entrants = champs;
        } else {
          entrants = (await pool.query('SELECT id, name FROM countries ORDER BY id')).rows
            .map(c => ({ country: c.id, name: c.name + ' XI' }));
          await buildNatSquads(pool, seasonNo);
        }
        groups = snakeGroups(entrants, e => NAT_STR[e.country] || 1);
      }
      if (comp === 'wcl') await buildNatSquads(pool, seasonNo).catch(() => {});

      let pairs;
      if (GROUP_ROUNDS[stage]) {
        // a group day: two ties per group, every group at once
        pairs = [];
        for (const g of groups) for (const [x, y] of GROUP_ROUNDS[stage]) pairs.push([g[x], g[y]]);
      } else if (stage === 'qf') {
        // top two per group cross: A1vB2, B1vA2, C1vD2, D1vC2
        const t = await groupTables(pool, comp, seasonNo, groups);
        pairs = [[t[0][0], t[1][1]], [t[1][0], t[0][1]], [t[2][0], t[3][1]], [t[3][0], t[2][1]]];
      } else {
        const prev = { sf: 'qf', final: 'sf' }[stage];
        const rows = await pool.query('SELECT a,b,result FROM cup_matches WHERE comp=$1 AND season_no=$2 AND stage=$3 ORDER BY gi', [comp, seasonNo, prev]);
        const w = rows.rows.map(r => r.result.winner === r.a.name ? r.a : r.b);
        pairs = stage === 'sf' ? [[w[0], w[2]], [w[1], w[3]]] : [[w[0], w[1]]];
      }
      pairs = pairs.filter(p => p && p[0] && p[1]);
      await playStage(pool, host, comp, seasonNo, stage, pairs);
      await rebuildCupSnapshot(pool, comp, seasonNo, now);
      await pool.query(`UPDATE ticks SET status='done', finished_at=now() WHERE key=$1`, [key]);
      out[comp].push({ stage, played: pairs.length });
    }
  }
  return out;
}

// ============================================================================
// THE FA CUP — every nation's own knockout, all sixteen clubs, on the four
// Sundays (docs/PYRAMID.md §5). The draw is a seeded shuffle per stage, the
// LOWER-DIVISION club hosts (the giant comes to the village green, groundsman
// tilt live), the final is played at the boss's ground. Managers' latest
// banked sheets stand in; bots play their doctrines.
// ============================================================================
// ===========================================================================
// THE COLTS CUP - week four, played by the boys of every club in the nation.
//
// The same laws as every other knockout the umpire runs: a stage plays only
// once its day's window has closed, the tick key makes the stage idempotent,
// and the bracket is derived from the banked ties rather than remembered.
// What is different is that a tie can be decided without a ball - a club that
// cannot name fifteen men under twenty-one forfeits - and that the purse is
// paid out of the final rather than out of a ledger somebody has to maintain.
// ===========================================================================
const COLTS_CUP_STAGES = COLTS_STAGES.map(st => [st, COLTS_DAYS[st]]);
export async function runColtsCup(pool, host, { now = Date.now() } = {}) {
  const seasons = (await pool.query(
    `SELECT DISTINCT ON (country_id) country_id, season_no, start_day
       FROM seasons ORDER BY country_id, season_no DESC`)).rows;
  const out = [];
  for (const s of seasons) {
    const hour = natHour(s.country_id);
    for (const [stage, offset] of COLTS_CUP_STAGES) {
      if (!stageClosed(now, s.start_day, offset, hour)) break;   // days run in order
      const key = 'colts:' + s.country_id + ':s' + s.season_no + ':' + stage;
      const claim = await pool.query(
        `INSERT INTO ticks(key, status) VALUES ($1,'running')
         ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING status`, [key]);
      if (claim.rows[0].status === 'done') continue;
      let played = 0;
      try {
        played = await playColtsStage(pool, host, s.country_id, s, stage, seedOf, ENGINE_VERSION,
          { cupDraw });
      } catch (e) {
        console.error('colts ' + s.country_id + ' ' + stage + ': ' + e.message);
        continue;                                  // leave the tick open; the next run retries
      }
      await pool.query(`UPDATE ticks SET status='done', finished_at=now() WHERE key=$1`, [key]);
      if (played) out.push({ country: s.country_id, stage, played });
    }
    // the bracket, the purse and every boy's own record - derived, so this is
    // safe to re-run on any day of the week
    try {
      const colts = await computeColts(pool, s.country_id, s.season_no);
      await pool.query(
        `INSERT INTO snapshots(key, body) VALUES ($1, $2::jsonb)
         ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`,
        ['colts/' + s.country_id, JSON.stringify(colts)]);
      await coltRecords(pool, s.country_id, s.season_no);
    } catch (eC) { console.error('colts board ' + s.country_id + ': ' + eC.message); }
  }
  return out;
}

const FA_STAGES = [['r16', FA_DAYS.r16], ['qf', FA_DAYS.qf], ['sf', FA_DAYS.sf], ['final', FA_DAYS.final]];
export async function runFaCup(pool, host, { now = Date.now() } = {}) {
  const seasons = (await pool.query(
    `SELECT DISTINCT ON (country_id) country_id, season_no, start_day, divisions
       FROM seasons ORDER BY country_id, season_no DESC`)).rows;
  const played = [];
  for (const s of seasons) {
    const comp = 'fa:' + s.country_id;
    const hour = natHour(s.country_id);
    const divs = (s.divisions && s.divisions['1'])
      ? s.divisions : { 1: [0, 1, 2, 3, 4, 5, 6, 7], 2: [8, 9, 10, 11, 12, 13, 14, 15] };
    const divOf = {}; divs['1'].forEach(x => divOf[x] = 1); (divs['2'] || []).forEach(x => divOf[x] = 2);
    for (const [stage, offset] of FA_STAGES) {
      if (!stageClosed(now, s.start_day, offset, hour)) continue;
      const key = comp + ':s' + s.season_no + ':' + stage;
      const claim = await pool.query(
        `INSERT INTO ticks(key, status) VALUES ($1,'running')
         ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING status`, [key]);
      if (claim.rows[0].status === 'done') continue;
      const clubs = (await pool.query('SELECT slot, name, squad FROM clubs WHERE country_id=$1 ORDER BY slot', [s.country_id])).rows;
      const bySlot = Object.fromEntries(clubs.map(c => [c.slot, c]));
      // the field for this stage
      let field;
      if (stage === 'r16') {
        field = clubs.map(c => c.slot);
      } else {
        const prevStage = { qf: 'r16', sf: 'qf', final: 'sf' }[stage];
        const prevRows = (await pool.query(
          'SELECT a, b, result FROM cup_matches WHERE comp=$1 AND season_no=$2 AND stage=$3 ORDER BY gi',
          [comp, s.season_no, prevStage])).rows;
        if (prevRows.length === 0) { await pool.query(`UPDATE ticks SET status='done', finished_at=now() WHERE key=$1`, [key]); continue; }
        field = prevRows.map(r => (r.result.winner === r.b.name ? r.b : r.a).slot);
      }
      // the draw: every surviving club into the hat, one pull per stage
      const drawn = cupDraw('fa|' + s.country_id + '|s' + s.season_no + '|' + stage, field);
      const ties = [];
      for (let i = 0; i < drawn.length; i += 2) ties.push([drawn[i], drawn[i + 1]]);
      // managers' latest banked sheets ride in, exactly like a friendly
      const ordersOf = {};
      try {
        const or = await pool.query(
          `SELECT cl.name AS club, (SELECT o.orders FROM orders o WHERE o.user_id=c.user_id
             ORDER BY o.submitted_at DESC LIMIT 1) AS orders
             FROM claims c JOIN clubs cl ON cl.country_id=c.country_id AND cl.slot=c.slot
            WHERE c.country_id=$1`, [s.country_id]);
        or.rows.forEach(r => { if (r.orders) ordersOf[r.club] = r.orders; });
      } catch (e) {}
      for (let gi = 0; gi < ties.length; gi++) {
        let [x, y] = ties[gi];
        if (x == null || y == null) continue;
        // the lower-division club hosts; the final belongs to the boss's ground
        let hostSlot = (divOf[y] || 1) > (divOf[x] || 1) ? y : x;
        if (stage === 'final') hostSlot = 0;
        const home = hostSlot === y ? y : x, awaySlot = home === x ? y : x;
        const A = { country: s.country_id, slot: home, name: bySlot[home].name };
        const B = { country: s.country_id, slot: awaySlot, name: bySlot[awaySlot].name };
        const ex = await pool.query('SELECT 1 FROM cup_matches WHERE comp=$1 AND season_no=$2 AND stage=$3 AND gi=$4',
          [comp, s.season_no, stage, gi]);
        if (ex.rowCount) continue;
        const seed = seedOf(comp + '|s' + s.season_no + '|' + stage + '|' + gi);
        const cond = host.condFor(s.country_id, hostSlot === 0 && stage === 'final' ? 0 : home, s.season_no, 900 + offset);
        const tieOrders = {};
        for (const club of [bySlot[home], bySlot[awaySlot]]) {
          if (ordersOf[club.name]) { tieOrders[club.name] = ordersOf[club.name]; continue; }
          const doc = host.doctrineFor(s.country_id, club.slot);
          if (doc) tieOrders[club.name] = doc;
        }
        const resultJson = host.runMatch(
          { name: A.name, players: bySlot[home].squad }, { name: B.name, players: bySlot[awaySlot].squad },
          cond.pitch, seed, tieOrders, cond.weather);
        if (!resultJson) throw new Error('engine failed FA tie ' + key + ':' + gi);
        const living = { [A.name]: livingPatch(bySlot[home].squad), [B.name]: livingPatch(bySlot[awaySlot].squad) };
        await pool.query(
          `INSERT INTO cup_matches(comp, season_no, stage, gi, a, b, seed, engine_version, result, result_canonical, living)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::text,$11::jsonb) ON CONFLICT (comp, season_no, stage, gi) DO NOTHING`,
          [comp, s.season_no, stage, gi, JSON.stringify(A), JSON.stringify(B), seed, ENGINE_VERSION, resultJson, resultJson, JSON.stringify(living)]);
        played.push(key + ':' + gi);
      }
      await rebuildFaSnapshot(pool, s.country_id, s.season_no, now);
      await pool.query(`UPDATE ticks SET status='done', finished_at=now() WHERE key=$1`, [key]);
    }
  }
  return played;
}

async function rebuildFaSnapshot(pool, country, seasonNo, now) {
  const rows = await pool.query(
    `SELECT stage, gi, a, b, result FROM cup_matches WHERE comp=$1 AND season_no=$2 ORDER BY stage, gi`,
    ['fa:' + country, seasonNo]);
  const stages = {};
  let champion = null;
  rows.rows.forEach(r => {
    (stages[r.stage] = stages[r.stage] || []).push({
      gi: r.gi, a: r.a, b: r.b, winner: r.result.winner, text: r.result.text,
      as_: scoreOf(r.result.innings[0]), bs_: scoreOf(r.result.innings[1])
    });
    if (r.stage === 'final') champion = r.result.winner;
  });
  const body = { comp: 'fa', country, seasonNo, stages, champion, engineVersion: ENGINE_VERSION, generatedAtDay: dayIx(now) };
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ($1,$2,now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`,
    ['facup/' + country + '/s' + seasonNo, JSON.stringify(body)]);
}

// THE TURNING OF THE YEAR (di 31, the quiet Thursday of the closing week):
// promotion and relegation are applied, every colt ages, and season s+1 is
// founded at start_day + CYCLE carrying the division map the cricket earned.
//
// PROMOTION & RELEGATION: Division One's bottom two (the fourteen-round
// table) swap with Division Two's shield winner and playoff champion (if
// they are the same club, the beaten finalist takes the second place).
export async function rollSeasons(pool, { now = Date.now() } = {}) {
  const rows = await pool.query(
    `SELECT DISTINCT ON (country_id) country_id, season_no, start_day, divisions FROM seasons ORDER BY country_id, season_no DESC`);
  const rolled = [];
  for (const r of rows.rows) {
    if (dayIx(now) < r.start_day + TRANSITION_DAY) continue;
    if (!daySettled(now, r.start_day + TRANSITION_DAY, r.country_id)) continue;
    const board = await computeLeague(pool, r.country_id, r.season_no, now);
    let divs = (r.divisions && r.divisions['1'])
      ? { 1: r.divisions['1'].slice(), 2: (r.divisions['2'] || []).slice() }
      : { 1: [0, 1, 2, 3, 4, 5, 6, 7], 2: [8, 9, 10, 11, 12, 13, 14, 15] };
    // the swap - only when the season genuinely finished its business
    if (board && board.roundsPlayed >= ROUNDS && board.table.length >= 2 && board.table2.length >= 2) {
      const down = board.table.slice(-2).map(t => t.slot);
      const upShield = board.table2[0].slot;
      let upChamp = null;
      if (board.champion2) {
        const seat = board.table2.find(t => t.name === board.champion2);
        upChamp = seat ? seat.slot : null;
      }
      if (upChamp == null || upChamp === upShield) {
        // the beaten finalist takes the second place; failing that, the runner-up
        const final2 = board.results.filter(x => x.round === 16)
          .map(x => board.table2.find(t => t.name === (x.winner === x.home ? x.away : x.home)))
          .filter(Boolean)[0];
        upChamp = (final2 && final2.slot !== upShield) ? final2.slot : board.table2[1].slot;
      }
      const up = [upShield, upChamp];
      divs = {
        1: divs[1].filter(s => !down.includes(s)).concat(up).sort((a, b) => a - b),
        2: divs[2].filter(s => !up.includes(s)).concat(down).sort((a, b) => a - b)
      };
    }
    await pool.query(
      `INSERT INTO seasons(country_id, season_no, start_day, schedule, divisions) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT DO NOTHING`,
      [r.country_id, r.season_no + 1, r.start_day + CYCLE,
       JSON.stringify(seasonSchedules(r.country_id, r.season_no + 1, divs)), JSON.stringify(divs)]);
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
    // a nation that could not be settled is the loudest thing in this log
    for (const [country, r] of Object.entries(all)) {
      const bad = r.filter(x => x && x.failed);
      if (bad.length) lines.push('!! ' + country + ' DID NOT PLAY: ' + bad.map(x => x.error).join('; '));
    }
    // THE INTERNATIONAL GAME, published once a day rather than once a nation:
    // the squads as named, what each window cost each club, the tours as
    // played and every cap on earth. It is one snapshot for the whole world,
    // so rebuilding it per country would only be the same work nineteen times.
    try { await rebuildNations(pool); }
    catch (eN) { console.error('nations snapshot failed:', eN.message); }
    const lines = [];
    for (const [country, r] of Object.entries(all)) {
      const fresh = r.filter(x => !x.skipped);
      if (fresh.length) lines.push(country + ': ' + fresh.map(x => 'day ' + x.day + ' round ' + x.round + ' (' + x.played + ' played)').join(', '));
    }
    // THE MARKET, world-wide and once a day: the bots do their shopping, the
    // windows that are up have their envelopes opened, and the board is
    // republished. Sealed bids mean the hour this runs at buys nobody
    // anything.
    try {
      const mk = await settleMarket(pool);
      const sold = mk.settled.filter(x => x.sold);
      if (mk.bids) lines.push('market: ' + mk.bids + ' offers from bot clubs');
      if (mk.settled.length) lines.push('market: ' + sold.length + ' sold of ' + mk.settled.length + ' windows closed');
    } catch (eMk) { lines.push('market: ' + eMk.message); }
    // THE INTERNATIONAL WINDOWS, at 18:00 UTC on the rest days that close the
    // first three blocks (days 3, 7 and 11) — after
    // most of the planet's league cricket, and healed up to four days back
    // if the cron was dead for one
    try {
      const tours = await runWindows(pool, host, ENGINE_VERSION);
      if (tours.length) {
        lines.push('internationals played: ' + tours.length);
        await rebuildNations(pool);
      }
    } catch (eW) { lines.push('internationals: ' + eW.message); }
    // THE FA CUP SUNDAYS: every nation's knockout, giant-killing included
    try {
      const fa = await runFaCup(pool, host);
      if (fa.length) lines.push('FA Cup ties played: ' + fa.length);
    } catch (eFA) { lines.push('fa cup: ' + eFA.message); }
    // THE COLTS WEEK: the boys' knockout, four days in week four
    try {
      const cc = await runColtsCup(pool, host);
      if (cc.length) lines.push('Colts Cup: ' + cc.map(x => x.country + ' ' + x.stage + ' (' + x.played + ')').join(', '));
    } catch (eCC) { lines.push('colts cup: ' + eCC.message); }
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
    try {
      const iv = await runComps(pool, host, ENGINE_VERSION);
      if (iv.started.length) lines.push('invitationals started: ' + iv.started.join(', '));
      if (iv.played.length) lines.push('invitational matches: ' + iv.played.length);
    } catch (eI) { lines.push('invitationals: ' + eI.message); }
    console.error(lines.length ? lines.join('\n') : 'nothing due anywhere');
    await pool.end();
  })().catch(e => { console.error(e); process.exit(1); });
}
