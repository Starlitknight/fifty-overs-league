// gazette-desk.mjs — THE REPORTERS. Where the paper's stories come from.
//
// gazette.mjs is the editor and reads no database; this is the desk that hands
// it candidates. Everything here reads the SERVED record - the matches the
// umpire actually played - which is the whole point of the rewrite. The old
// paper read this device's local save and module 27's client-derived planet,
// so its lead was the reader's own last match and its wire described a world
// the server does not play. Nothing in the client read world_nat_matches at
// all: the internationals this world stages every window appeared on no page.
//
// EXTRACT IN THE DATABASE, NOT OVER THE WIRE. A match blob carries whole
// player objects - every skill, every figure - and a season of them is tens of
// megabytes. Every query below pulls out the handful of numbers a headline
// needs and leaves the rest in Postgres, the same discipline living.mjs learned
// the hard way.
//
// AND ONLY THE LAST FEW DAYS. Freshness decays hard (0.55 a day), so cricket
// older than about a week cannot lead whatever else is true of it. Reading it
// would be work spent on stories that cannot print.
import { dayIx, dayOfRound, roundOfDay, CYCLE } from './clock.mjs';

export const LOOKBACK_DAYS = 3;      // beyond this, freshness has already killed it

// ---------------------------------------------------------------------------
// WHAT COUNTS AS A SHOCK
//
// The upset modifier wants two ratings. For a club it is the best-eleven
// strength the world already keeps (092); for a nation it is the rung its
// selectors' XI is built to, which is what computeRankings publishes.
// ---------------------------------------------------------------------------
const ratingOfClub = (byKey, country, slot) =>
  (byKey.get(country + ':' + slot) || {}).strength || 0;

// how a margin reads in a headline, off the card's own text where it has one
function marginOf(result) {
  const t = (result && result.text) || '';
  const m = /by (\d+) (runs?|wickets?)/i.exec(t);
  return m ? { n: +m[1], unit: /wicket/i.test(m[2]) ? 'wickets' : 'runs' } : null;
}

// AND HOW CLOSE IT WAS, which is most of what makes a game worth reading about.
// A two-wicket win with a ball left is a story; ninety runs is a result.
function tension(result) {
  const mg = marginOf(result);
  if (!mg) return 0.5;                                   // a tie, or a card we cannot parse
  if (mg.unit === 'wickets') return mg.n <= 2 ? 1 : mg.n <= 4 ? 0.7 : mg.n <= 6 ? 0.4 : 0.15;
  return mg.n <= 10 ? 1 : mg.n <= 25 ? 0.7 : mg.n <= 60 ? 0.35 : 0.1;
}

// ---------------------------------------------------------------------------
// THE INTERNATIONALS, which lead the paper on the days they are played.
// nat_matches carries world_day outright, so the window is exact.
// ---------------------------------------------------------------------------
export async function intlStories(pool, today, rankOf) {
  const rows = (await pool.query(
    `SELECT id, world_day, season_no, round, a_country, b_country, a_name, b_name,
            result->>'text'   AS text,
            result->>'winner' AS winner,
            result->'innings' AS innings
       FROM nat_matches
      WHERE result IS NOT NULL AND world_day > $1
      ORDER BY world_day, id`, [today - LOOKBACK_DAYS])).rows;
  const out = [];
  for (const m of rows) {
    const aR = rankOf(m.a_country), bR = rankOf(m.b_country);
    const won = m.winner === m.a_name ? 'a' : m.winner === m.b_name ? 'b' : null;
    const wRat = won === 'a' ? aR.natRating : won === 'b' ? bR.natRating : 0;
    const lRat = won === 'a' ? bR.natRating : won === 'b' ? aR.natRating : 0;
    const best = won === 'a' ? aR : won === 'b' ? bR : aR;
    out.push({
      kind: 'intlResult', day: m.world_day,
      headline: m.text || (m.a_name + ' v ' + m.b_name),
      standing: { rank: best.rank, of: rankOf.count },
      upset: { winner: wRat, loser: lRat },
      stakes: tension({ text: m.text }),
      facts: { sort: 'intl', id: m.id, a: m.a_name, b: m.b_name,
               aCountry: m.a_country, bCountry: m.b_country,
               winner: m.winner, text: m.text, innings: brief(m.innings) }
    });
    // AND THE MEN. A hundred or a five-for for your country is a story in its
    // own right, and it is the only place in the paper where an individual
    // outranks a result - which is how cricket is actually reported.
    for (const f of featsOf(m.innings, m.world_day, { runs: 100, wkts: 5 })) {
      out.push({ ...f, kind: 'intlFeat',
        standing: { rank: best.rank, of: rankOf.count },
        facts: { ...f.facts, sort: 'intlFeat', id: m.id } });
    }
  }
  return out;
}

// a scoreboard line, and nothing more: two totals and who won
function brief(innings) {
  return (innings || []).slice(0, 2).map(i => i && ({
    team: i.batTeam, runs: i.runs, wkts: i.wkts, legal: i.legal
  })).filter(Boolean);
}

// THE FEATS, read off the card. Only the ones a paper would actually print:
// a hundred, a five-for. Fifties and three-fors are the scoreboard's business.
function featsOf(innings, day, bar) {
  // WHAT COUNTS AS NOTABLE DEPENDS ON WHERE. A hundred for your country is
  // always a story; a hundred in a second division is a good afternoon. Read
  // against a real world, the club bar at 100/5 buried every result in the
  // paper under a dozen bowling analyses.
  const RUNS = (bar && bar.runs) || 100, WKTS = (bar && bar.wkts) || 5;
  const out = [];
  for (const inn of (innings || [])) {
    if (!inn) continue;
    for (const b of (inn.bat || [])) {
      const nm = (b.p && b.p.name) || b.p, r = b.r | 0;
      if (nm && r >= RUNS) out.push({
        day, headline: nm + ' ' + r + (b.out ? '' : ' not out'),
        rarity: r >= 150 ? 0 : 1, over: r - 100, typical: 100,
        facts: { man: nm, runs: r, balls: b.b | 0, pid: (b.p && b.p.pid) || null, feat: 'hundred' }
      });
    }
    for (const nm of Object.keys(inn.bowlers || {})) {
      const bw = inn.bowlers[nm];
      if ((bw.w | 0) >= WKTS) out.push({
        day, headline: nm + ' ' + bw.w + '-' + bw.r,
        rarity: 0, over: (bw.w | 0) - 5, typical: 5,
        facts: { man: nm, wkts: bw.w | 0, conc: bw.r | 0, feat: 'fiveFor' }
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// THE DOMESTIC ROUNDS. Sixteen countries, and the paper wants the ones that
// mattered - so a result is only a candidate if it was close, or a shock, or
// between the top two. The rest fill the scoreboard, which is where an
// ordinary Tuesday afternoon belongs.
// ---------------------------------------------------------------------------
export async function leagueStories(pool, today, clubsByKey, rankOf, seasons) {
  // which (season, round) pairs fall inside the window, per country
  const want = [];
  for (const s of seasons) {
    for (let r = 1; r <= 20; r++) {
      const d = (s.start_day | 0) + (dayOfRound(r) ?? (r - 1));
      if (d > today - LOOKBACK_DAYS && d <= today) want.push({ c: s.country_id, s: s.season_no, r, d });
    }
  }
  if (!want.length) return { stories: [], scoreboard: [] };
  const rows = (await pool.query(
    `SELECT m.country_id, m.season_no, m.round, m.home_slot, m.away_slot,
            coalesce(m.home_name, h.name) AS home_name,
            coalesce(m.away_name, a.name) AS away_name,
            m.result->>'text' AS text, m.result->>'winner' AS winner,
            m.result->'innings' AS innings
       FROM matches m
       JOIN clubs h ON h.country_id=m.country_id AND h.slot=m.home_slot
       JOIN clubs a ON a.country_id=m.country_id AND a.slot=m.away_slot
      WHERE m.result IS NOT NULL
        AND (m.country_id, m.season_no, m.round) IN (
          SELECT * FROM unnest($1::text[], $2::int[], $3::int[]))
      ORDER BY m.country_id, m.season_no, m.round, m.home_slot`,
    [want.map(w => w.c), want.map(w => w.s), want.map(w => w.r)])).rows;
  const dayOf = new Map(want.map(w => [w.c + '|' + w.s + '|' + w.r, w.d]));

  const stories = [], scoreboard = [];
  for (const m of rows) {
    const day = dayOf.get(m.country_id + '|' + m.season_no + '|' + m.round) ?? today;
    const hR = ratingOfClub(clubsByKey, m.country_id, m.home_slot);
    const aR = ratingOfClub(clubsByKey, m.country_id, m.away_slot);
    const homeWon = m.winner === m.home_name;
    const nat = rankOf(m.country_id);
    // THE PRESS WRITES THE SENTENCE, INCLUDING THIS ONE. `text` off the result
    // names only the winner - "Essex win by 38 runs" - which was fine while the
    // scoreboard was a two-column list with the fixture beside it, and became a
    // hole the moment the page ran the results on as prose: eight lines of who
    // won and not one of whom they beat. The page must not have to work the
    // loser out from home/away, because then the page is writing prose, and two
    // readers on two builds get two different sentences.
    scoreboard.push({ country: m.country_id, round: m.round, text: m.text,
                      home: m.home_name, away: m.away_name,
                      line: resultLine(m.text, m.winner, m.home_name, m.away_name) });
    const tense = tension({ text: m.text });
    const shock = homeWon ? { winner: hR, loser: aR } : { winner: aR, loser: hR };
    // ONLY WHAT A PAPER WOULD PRINT. A comfortable win between two mid-table
    // sides is a scoreboard line; it does not need a story object, and making
    // one for every match in sixteen countries is how a front page fills up
    // with cricket nobody cares about.
    const worthIt = tense >= 0.7 || (shock.loser - shock.winner) > 2500;
    if (worthIt) stories.push({
      kind: 'leagueResult', day,
      headline: m.text || (m.home_name + ' v ' + m.away_name),
      standing: { rank: nat.rank, of: rankOf.count },
      upset: shock, stakes: tense,
      facts: { sort: 'league', country: m.country_id, round: m.round,
               home: m.home_name, away: m.away_name, winner: m.winner,
               text: m.text, innings: brief(m.innings) }
    });
    for (const f of featsOf(m.innings, day, { runs: 130, wkts: 7 })) stories.push({
      ...f, kind: 'milestone',
      standing: { rank: nat.rank, of: rankOf.count },
      facts: { ...f.facts, sort: 'clubFeat', country: m.country_id }
    });
    // AND THE ODDITIES, which are what a reader tells somebody else about.
    for (const o of oddities(m, day, nat, rankOf.count)) stories.push(o);
  }
  return { stories, scoreboard };
}

// "Essex beat Durham by 38 runs" out of "Essex win by 38 runs" plus the two
// sides. The engine writes the result text in one shape - "<winner> win by
// <margin>" - so the margin is everything after the first " win ", and anything
// that does not match that shape (a tie, an abandonment, a shape a future engine
// invents) falls back to naming the fixture and quoting the text verbatim. It
// never guesses: an unrecognised result prints as itself rather than as a
// confidently wrong sentence.
// AND A MATCH WITH NO WINNER IS STILL A MATCH BETWEEN TWO CLUBS.
//
// A tie banks with winner NULL, and this used to hand back the engine's text on
// its own for that case - "Match tied", a results-column line that names neither
// side and tells a reader nothing he can use. It was invisible for as long as
// the world produced no ties in the fixtures the paper happened to print;
// redistributing the world produced one, and the line it printed was the same
// half-sentence the "beat" rewrite was written to abolish.
//
// So the no-winner case falls into the same shape as every other result this
// function does not recognise: name the fixture, then quote the text verbatim.
// It still never guesses - an unrecognised result prints as itself rather than
// as a confidently wrong sentence - it simply says who was playing first.
export function resultLine(text, winner, home, away) {
  const t = String(text || '');
  if (!home || !away) return t;
  const fixture = home + ' v ' + away;
  if (!winner) return t ? fixture + ', ' + t : fixture;
  const cut = t.indexOf(' win ');
  const loser = winner === home ? away : home;
  if (cut <= 0 || t.slice(0, cut) !== winner) return fixture + ', ' + t;
  return winner + ' beat ' + loser + ' ' + t.slice(cut + 5);
}

// A TIE, A TEN-WICKET WIN, A SIDE BOWLED OUT FOR NOTHING. Rare by construction,
// so the rarity modifier does most of the work; all this has to do is notice.
function oddities(m, day, nat, of) {
  const out = [], inns = m.innings || [];
  const st = { rank: nat.rank, of };
  if (m.winner == null && m.text) out.push({
    kind: 'oddity', day, headline: 'Tied: ' + m.text, standing: st,
    facts: { sort: 'oddity', why: 'tie', country: m.country_id, text: m.text }
  });
  const mg = marginOf({ text: m.text });
  if (mg && mg.unit === 'wickets' && mg.n === 10) out.push({
    kind: 'oddity', day, headline: m.text, standing: st,
    facts: { sort: 'oddity', why: 'tenWicket', country: m.country_id, text: m.text }
  });
  for (const i of inns) {
    if (i && (i.runs | 0) < 90 && (i.wkts | 0) >= 10) out.push({
      kind: 'oddity', day, headline: i.batTeam + ' all out ' + i.runs,
      standing: st,
      // the collapse is the only oddity with no `text` of its own, so it says
      // what the match was: a headline reading "Derbyshire all out 79" with no
      // opponent under it is half a story, and the almanack sets that line as
      // the caption under every entry.
      facts: { sort: 'oddity', why: 'collapse', country: m.country_id,
               team: i.batTeam, runs: i.runs,
               text: m.home_name + ' v ' + m.away_name + (m.text ? '; ' + m.text : '') }
    });
    if (i && (i.runs | 0) >= 380) out.push({
      kind: 'worldRecord', day, headline: i.batTeam + ' ' + i.runs + '/' + i.wkts,
      standing: st, over: (i.runs | 0) - 380, typical: 60,
      facts: { sort: 'record', why: 'bigTotal', country: m.country_id,
               team: i.batTeam, runs: i.runs, wkts: i.wkts }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// THE CUPS. Few a season and keyed by stage rather than round, so they are
// read whole and cheaply. A FINAL IS NOT AN ORDINARY STORY - it takes the
// front page, which gazette.makeIssue honours by kind.
// ---------------------------------------------------------------------------
export async function cupStories(pool, today, seasonNo) {
  let rows = [];
  try {
    rows = (await pool.query(
      `SELECT comp, season_no, stage, gi, a, b,
              result->>'text' AS text, result->>'winner' AS winner,
              result->'innings' AS innings
         FROM cup_matches
        WHERE result IS NOT NULL AND season_no = $1 AND comp NOT LIKE 'colts:%'
        ORDER BY stage, gi`, [seasonNo])).rows;
  } catch (e) { return []; }                       // a database with no cups yet
  return rows.map(r => ({
    kind: r.stage === 'final' ? 'cupFinal' : 'cupTie',
    day: today,                                    // cup ties settle on the day they are read
    headline: r.text || ((r.a && r.a.name) + ' v ' + (r.b && r.b.name)),
    stakes: r.stage === 'final' ? 1 : r.stage === 'sf' ? 0.7 : 0.4,
    seenLately: r.stage === 'final' ? 0 : 2,
    facts: { sort: 'cup', comp: r.comp, stage: r.stage,
             a: r.a && r.a.name, b: r.b && r.b.name,
             winner: r.winner, text: r.text, innings: brief(r.innings) }
  }));
}
