// nations.mjs — THE INTERNATIONAL GAME.
//
// A national team used to be a fiction that appeared for three days a year: a
// fifteen picked by rating at the cup window so the World Cup bracket had
// somebody to run. This module gives the international game a season.
//
// Three REST DAYS a year are window days (clock.mjs WINDOW_DAYS: days 3, 7 and
// 11 of the season, closing the first three blocks). Nobody's club plays that
// day; the men named are away when their clubs next play, which is rounds 4, 7
// and 10 (clock.mjs WINDOWS). On a
// window day:
//
//   the morning  the selectors name a squad of fifteen for every nation, from
//                every club in that nation - flagship, bot and human alike -
//                on what a man IS and how he is going. The squad is banked
//                the moment it is named, so it can never be re-picked.
//   the round    those men are NOT at their clubs. Their league fixture is
//                played without them, and the club is paid for the loss.
//   the evening  at 18:00 UTC the nations play each other, on the real
//                engine, and the caps are real caps.
//
// THE LAWS HOLD. The squad is banked once and read forever after, so a
// re-run picks nobody new. The compensation is derived by the books' own
// walk from genesis rather than paid into a balance. And an absent manager
// loses nothing he would not have lost anyway: a sheet naming a man who has
// gone to his country is COVERED - the umpire sends out the best available
// twelfth man in his place rather than tearing the sheet up.
//
// The one honest simplification: the selectors read a man's form as it
// stands when the window is settled. Settle a window on the day and that is
// exactly his form that morning; heal a window days late and the selectors
// have seen a little cricket the players had not. Once named, it is fixed.
import { dayIx, seedOf, isWindowRound, WINDOWS, WINDOW_DAYS, windowRoundOfDay,
         INTL_HOUR, hourSettled, ROUNDS, isWorldCupSeason, cupDraw } from './clock.mjs';
import { livingPatch, evolveCountry } from './living.mjs';
import { makeHost } from './enginehost.mjs';
import { calibrate, nationTeamStr, BASE_XI } from './init-world.mjs';

export const SQUAD_SIZE = 15;
// THE BOARD WILL NOT GUT A CLUB. However many of a nation's best play for one
// side, only three of them travel: a squad of fifteen always leaves twelve at
// every club, so nobody is ever short of an eleven and there is cover besides.
export const CLUB_LIMIT = 3;
// and the floor beneath it: whatever the limit says, a club is never left
// with fewer than this. Squads are fifteen, so three is what the limit means
// in practice; a club thinned by retirements loses fewer men, not its eleven.
export const MIN_LEFT = 12;
// WHAT A COUNTRY PAYS FOR A MAN'S WEEK (BLUEPRINT/FTP): fifty thousand for a
// senior, twenty for a boy. In practice the U21 rate is what a manager
// collects on a colt he promoted out of the academy early - which is exactly
// the club that deserves it.
export const FEE_SENIOR = 50000;
export const FEE_U21 = 20000;
export const U21_AGE = 21;
export const BOWLERS_WANTED = 6;
// AND THE SAME PROMISE TO THE BATTING. The squad used to be filled on rating
// once the keeper and the six bowlers were in, which is only safe if bowlers
// and batters rate alike - and they do not. In a nation whose bowlers out-rate
// its batters the fill was more bowlers, and the country turned out THIRTEEN
// of fifteen: a national side that could not bat. It showed up as India losing
// 77-23 to an equally-rated Australia, and the Netherlands splitting with its
// own flagship club. Five specialist batters are named before the fill, so
// every country takes a side that can make a score.
export const BATTERS_WANTED = 5;

export function feeFor(age) { return (+age || 99) < U21_AGE ? FEE_U21 : FEE_SENIOR; }
// a tour is identified by the WORLD DAY it was played on, not by anybody's
// round: nations founded at different times can share a window day, and the
// day is the one thing they all agree about
export function natMatchId(day, gi) { return 'nat:d' + day + ':g' + gi; }
export const isBowler = p => !!(p && p.bowlType && p.bowlType !== 'none');

// ---------------------------------------------------------------------------
// THE SELECTORS. A pure function of the men in front of them: what a
// cricketer is, lifted or dropped by the nick he is in. Ties break on the
// name, so the same fifteen comes out of the same squads every time.
//
// The shape is a side, not a list: the gloves first (a nation without a
// keeper has no team), then six bowlers, then the best of the rest. Three
// men from any one club is the limit, so a strong league sends its whole
// depth rather than one club twice over.
// ---------------------------------------------------------------------------
export function selectionScore(p) {
  const form = ((p.formIx == null ? 3 : p.formIx) - 3) * 0.045;
  return (+p.rating || 0) * (1 + form);
}
export function selectSquad(men, { size = SQUAD_SIZE, clubLimit = CLUB_LIMIT, minLeft = MIN_LEFT } = {}) {
  const ranked = (men || []).filter(p => p && p.name)
    .map(p => ({ p, s: selectionScore(p) }))
    .sort((a, b) => b.s - a.s || (a.p.name < b.p.name ? -1 : 1))
    .map(x => x.p);
  const held = {};
  ranked.forEach(p => { held[String(p.slot)] = (held[String(p.slot)] || 0) + 1; });
  const limitAt = k => Math.max(0, Math.min(clubLimit, (held[k] || 0) - minLeft));
  const picked = [], seen = new Set(), perClub = {};
  const take = p => {
    if (!p || seen.has(p.name) || picked.length >= size) return false;
    const k = String(p.slot);
    if ((perClub[k] || 0) >= limitAt(k)) return false;
    seen.add(p.name); perClub[k] = (perClub[k] || 0) + 1; picked.push(p);
    return true;
  };
  for (const p of ranked) if (p.keeper) { if (take(p)) break; }
  let bowlers = 0;
  for (const p of ranked) { if (bowlers >= BOWLERS_WANTED) break; if (isBowler(p) && take(p)) bowlers++; }
  let batters = 0;
  for (const p of ranked) { if (batters >= BATTERS_WANTED) break; if (!isBowler(p) && take(p)) batters++; }
  for (const p of ranked) { if (picked.length >= size) break; take(p); }
  return picked;
}

// ---------------------------------------------------------------------------
// THE TOUR CALENDAR. Real cricket does not send every nation on the road
// every rest day - it plays TOURS: India tour of Australia, a SERIES, and
// the rest of the world gets on with its league. So does this one.
//
// A tour is a THREE-MATCH SERIES played over three tour days - Wednesday,
// Saturday, Wednesday, the way a real ODI series breathes. A season carries
// FOUR tours: two in the first half (games on the rest days before rounds
// 3, 5 and 7) and two in the second (before rounds 9, 11 and 13). So eight
// nations tour a season and eight rest entirely - and next season they swap.
//
// The rotation is a two-season CYCLE over the playable (non-World-Cup)
// seasons: one Fisher-Yates over the whole field per cycle, first half of
// the shuffle tours in the cycle's first season, second half in its second.
// Every nation tours exactly once every two playable seasons; a World Cup
// year suspends the rotation rather than costing anybody their turn. The
// SECOND nation of each pair hosts: the tie is "A tour of B". All of it is
// pure arithmetic on the season number - knowable seasons ahead, offline.
//
// ONE SQUAD PER TOUR: the fifteen named before game one flies for the whole
// series, and its clubs are paid the board rate per man per robbed round -
// three times. A resting nation loses nobody and earns nothing.
// ---------------------------------------------------------------------------
export const SERIES_LEN = 3;
export const HALF_WINDOWS = [[0, 1, 2], [3, 4, 5]];    // window indices of each half's games

// how many playable (non-World-Cup) seasons preceded this one
export function playableIx(seasonNo) {
  let t = 0;
  for (let s = 1; s < seasonNo; s++) if (!isWorldCupSeason(s)) t++;
  return t;
}

export function seasonTourPlan(seasonNo, ids) {
  const plan = { seasonNo, series: [], byCountry: {}, resting: [] };
  if (isWorldCupSeason(seasonNo)) { plan.resting = (ids || []).slice().sort(); return plan; }
  const field = (ids || []).slice().sort();
  const t = playableIx(seasonNo), cycle = t >> 1, pod = t & 1;
  const order = cupDraw('intltours|c' + cycle, field);
  const half = Math.floor(order.length / 2);
  const eight = pod ? order.slice(half) : order.slice(0, half);
  const rest = (pod ? order.slice(0, half) : order.slice(half)).slice();
  const nSeries = Math.floor(eight.length / 2);
  for (let i = 0; i + 1 < eight.length; i += 2) {
    const hIx = (i / 2) < Math.ceil(nSeries / 2) ? 0 : 1;
    const tie = { kind: 'series', hIx, windows: HALF_WINDOWS[hIx].slice(),
      away: eight[i], home: eight[i + 1], teams: [eight[i], eight[i + 1]], host: eight[i + 1] };
    plan.series.push(tie);
    plan.byCountry[eight[i]] = tie; plan.byCountry[eight[i + 1]] = tie;
  }
  // the odd man of an odd-sized pod rests with the other half
  if (eight.length % 2) rest.push(eight[eight.length - 1]);
  plan.resting = rest.sort();
  return plan;
}

// a nation's NEXT tour at or after a season - for the page that has to tell
// a resting nation when its cricket comes
export function nextTourOf(country, seasonNo, ids) {
  for (let s = seasonNo; s < seasonNo + 8; s++) {
    if (isWorldCupSeason(s)) continue;
    const tie = seasonTourPlan(s, ids).byCountry[country];
    if (tie) return { seasonNo: s, tie };
  }
  return null;
}

// whether this round's window is one of the three the calendar dealt this
// nation's series. Pure calendar arithmetic - a manager can read his
// country's tour seasons ahead, offline, which is the standing law here.
export async function touringOn(pool, country, seasonNo, round) {
  const wIx = WINDOWS.indexOf(round);
  if (wIx < 0 || isWorldCupSeason(seasonNo)) return false;
  const ids = (await pool.query('SELECT id FROM countries')).rows.map(r => r.id);
  const mine = seasonTourPlan(seasonNo, ids).byCountry[country];
  return !!mine && mine.windows.indexOf(wIx) >= 0;
}

// every senior cricketer in a nation, with the club he belongs to
export async function nationMen(pool, country) {
  const clubs = (await pool.query(
    'SELECT slot, name, squad FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  const men = [];
  for (const c of clubs) for (const p of (c.squad || [])) {
    if (p && p.name) men.push({ ...p, slot: c.slot, club: c.name });
  }
  return men;
}

// ---------------------------------------------------------------------------
// THE STANDING SQUAD. The selectors used to meet three times a year, and only
// for a nation the draw had given a fixture to - so for fifteen rounds out of
// eighteen the answer to "who plays for England?" was nobody at all, and no
// cricketer anywhere could be shown as an international.
//
// They sit BETWEEN EVERY MATCH now. Before round one is bowled they name a
// fifteen from the founding squads; before every round after it they name it
// again, having watched the cricket since - the previous day's tick evolved
// every man who played it before it closed, so the form they read is the form
// the round produced. A man plays his way into his country's side over a
// season and out of it again, which is what a national side IS. Nothing else
// changes: the same selectors, the same laws, the same three-from-a-club limit.
//
// NAMED ONCE, LIKE EVERYTHING ELSE IN THIS WORLD. The fifteen standing before
// round R was decided at that moment on the form of that moment; a re-run of
// the day reads the decision back rather than taking it again on cricket the
// selectors could not have seen.
export async function ensureNatSquad(pool, country, seasonNo, round) {
  const key = [country, seasonNo, round];
  const have = await pool.query(
    'SELECT squad FROM nat_squad WHERE country_id=$1 AND season_no=$2 AND round=$3', key);
  if (have.rowCount) return have.rows[0].squad;
  const picked = selectSquad(await nationMen(pool, country)).map((p, i) => ({
    pick: i, slot: p.slot, club: p.club || null, name: p.name,
    age: p.age == null ? null : (p.age | 0), rating: Math.round(+p.rating || 0),
    keeper: !!p.keeper, bowler: isBowler(p), fee: feeFor(p.age)
  }));
  await pool.query(
    `INSERT INTO nat_squad(country_id, season_no, round, squad) VALUES ($1,$2,$3,$4)
     ON CONFLICT (country_id, season_no, round) DO NOTHING`,
    [country, seasonNo, round, JSON.stringify(picked)]);
  return (await pool.query(
    'SELECT squad FROM nat_squad WHERE country_id=$1 AND season_no=$2 AND round=$3', key)).rows[0].squad;
}

// The fifteen as it stands, and what the selectors did when they last met: the
// two most recent namings, diffed. A nation whose selectors have met once has
// changed nothing - which is the correct answer, not a missing one.
export async function natSquadNow(pool, country, seasonNo) {
  const rows = (await pool.query(
    `SELECT round, squad FROM nat_squad WHERE country_id=$1 AND season_no=$2
      ORDER BY round DESC LIMIT 2`, [country, seasonNo])).rows;
  if (!rows.length) return { round: null, squad: [], in: [], out: [] };
  const now = rows[0].squad || [], was = rows[1] ? (rows[1].squad || []) : null;
  const names = list => new Set((list || []).map(m => m.name));
  const A = names(now), B = was ? names(was) : null;
  return {
    round: rows[0].round, squad: now,
    in: B ? now.filter(m => !B.has(m.name)).map(m => m.name) : [],
    out: B ? (was || []).filter(m => !A.has(m.name)).map(m => m.name) : []
  };
}

// ---------------------------------------------------------------------------
// THE SQUAD IS NAMED, ONCE. Banked the first time a window round is settled
// and read from the book every time after - a re-run of the day cannot pick
// a different fifteen, however much cricket has happened since.
// ---------------------------------------------------------------------------
export async function ensureCallups(pool, country, seasonNo, round) {
  if (!isWindowRound(round)) return [];
  const have = await pool.query(
    'SELECT * FROM callups WHERE country_id=$1 AND season_no=$2 AND round=$3 ORDER BY pick',
    [country, seasonNo, round]);
  if (have.rowCount) return have.rows;
  // A WINDOW WITH NO FIXTURE TAKES NOBODY. Nineteen nations make nine ties
  // and one week off; whoever draws the bye leaves his men at their clubs
  // rather than calling them up to sit about. The draw is a pure function of
  // the world day, so the selectors and the umpire that plays the tours that
  // evening always agree about who is playing.
  if (!(await touringOn(pool, country, seasonNo, round))) return [];
  // ONE SQUAD PER TOUR. A real series takes one touring party: the fifteen
  // that flies is the standing squad as it stood before the series' FIRST
  // game, and games two and three are played by the same men - however the
  // selectors' standing side moves on at home in the meantime. Deriving it
  // fresh per game is how a tour comes home with three different squads.
  const ids0 = (await pool.query('SELECT id FROM countries')).rows.map(r => r.id);
  const tie0 = seasonTourPlan(seasonNo, ids0).byCountry[country];
  const firstRound = tie0 ? WINDOWS[tie0.windows[0]] : round;
  const squad = await ensureNatSquad(pool, country, seasonNo, firstRound);
  for (let i = 0; i < squad.length; i++) {
    const p = squad[i];
    await pool.query(
      `INSERT INTO callups(country_id, season_no, round, pick, slot, player, age, fee)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
      [country, seasonNo, round, i, p.slot, p.name, p.age || null, feeFor(p.age)]);
  }
  return (await pool.query(
    'SELECT * FROM callups WHERE country_id=$1 AND season_no=$2 AND round=$3 ORDER BY pick',
    [country, seasonNo, round])).rows;
}

// who is away from which club this round: slot -> Set(names)
export async function absentBySlot(pool, country, seasonNo, round) {
  const out = new Map();
  if (!isWindowRound(round)) return out;
  const rows = (await pool.query(
    'SELECT slot, player FROM callups WHERE country_id=$1 AND season_no=$2 AND round=$3',
    [country, seasonNo, round])).rows;
  for (const r of rows) {
    if (!out.has(r.slot)) out.set(r.slot, new Set());
    out.get(r.slot).add(r.player);
  }
  return out;
}

// ---------------------------------------------------------------------------
// THE TWELFTH MAN. A manager who filed his sheet a fortnight ago should not be
// punished because his country wanted his opener: the umpire covers the gap
// the way a coach would, and the rest of the sheet stands exactly as written.
// A bowler is replaced by a bowler, anyone else by the best man left out;
// the replacement bats in the missing man's place and, if he can, bowls his
// overs. If the sheet cannot be made into a legal eleven the engine picks
// the side itself, which is what an unfiled sheet gets anyway.
// ---------------------------------------------------------------------------
export function coverSheet(orders, present, gone) {
  if (!orders || !gone || !gone.length) return orders;
  const goneNames = new Set(gone.map(p => p.name));
  const named = new Set((orders.xi || []).filter(n => !goneNames.has(n)));
  if (!(orders.xi || []).some(n => goneNames.has(n))) return orders;
  const bench = (present || []).filter(p => !named.has(p.name))
    .sort((a, b) => (+b.rating || 0) - (+a.rating || 0) || (a.name < b.name ? -1 : 1));
  const sub = {};
  for (const g of gone) {
    if (!(orders.xi || []).includes(g.name)) continue;
    let ix = isBowler(g) ? bench.findIndex(isBowler) : 0;
    if (ix < 0) ix = 0;
    const rep = bench.splice(ix, 1)[0];
    if (!rep) return null;                       // nobody left: let the engine pick
    sub[g.name] = rep.name; named.add(rep.name);
  }
  const swap = n => sub[n] || n;
  const o = { ...orders };
  ['xi', 'batOrder', 'bat'].forEach(k => { if (Array.isArray(orders[k])) o[k] = orders[k].map(swap); });
  if (orders.captain) o.captain = swap(orders.captain);
  if (orders.keeper) o.keeper = swap(orders.keeper);
  if (orders.spells) {
    o.spells = {};
    for (const end in orders.spells) {
      o.spells[end] = (orders.spells[end] || []).map(s => ({ ...s, bowler: swap(s.bowler) }));
    }
  }
  // a sheet the engine will honour: eleven real men, five of whom bowl
  const by = Object.fromEntries((present || []).map(p => [p.name, p]));
  const xi = (o.xi || []).filter(n => by[n]);
  if (xi.length !== 11 || xi.filter(n => isBowler(by[n])).length < 5) return null;
  return o;
}

// the series games the calendar has dealt to a given world day: every
// scheduled tie whose members are all in a window that day at one of that
// tie's own window indices, with WHICH game of the series it is. Sorted for
// stable match ids across re-runs.
export function tiesOnDay(plan, inWindow) {
  const wIxOf = {};
  inWindow.forEach(w => { wIxOf[w.country] = WINDOWS.indexOf(w.round); });
  const out = [], seen = new Set();
  for (const w of inWindow) {
    const tie = plan.byCountry[w.country];
    if (!tie) continue;
    const game = tie.windows.indexOf(wIxOf[w.country]);
    if (game < 0) continue;
    const key = tie.teams.join('|');
    if (seen.has(key)) continue;
    if (!tie.teams.every(id => wIxOf[id] === wIxOf[w.country])) continue;
    seen.add(key); out.push({ tie, game });
  }
  return out.sort((a, b) => (a.tie.teams[0] < b.tie.teams[0] ? -1 : 1));
}

// a banked list of {slot, player} as MEN, looked up in the squads they came
// from. A man who has since left cricket simply is not there.
// THE BADGE.
//
// A national side used to have no strength of its own: these fifteen are
// looked up in the club squads they were picked from, so an XI could never be
// better than the clubs it came out of. That is the whole reason a second
// division side from a small nation read as the near-equal of a great one -
// the great one WAS its clubs. Pulling on the shirt is now worth something,
// and what it is worth is the nation's own rung on the ten-point ladder: a 9
// for a full member, an 8 for an associate, against a flagship club's 7.
//
// It is applied here because this is the one place an international XI is ever
// assembled - the tours, the World Cup and every page that shows a squad all
// come through it, so what a phone displays is what the umpire plays.
let BADGE_HOST = null;
function badgeHost() { return (BADGE_HOST = BADGE_HOST || makeHost()); }
export function badgeUp(country, men) {
  if (!men || men.length < 11) return men;
  try {
    const best = men.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 11);
    const have = best.reduce((s, p) => s + (p.rating || 0), 0) / Math.max(1, best.length);
    const want = BASE_XI * nationTeamStr(country);
    if (!(have > 0) || Math.abs(want / have - 1) < 0.01) return men;
    // the men are copied first: these objects are the club's own players, and
    // a country lifting them must not lift the club they go back to
    return calibrate(badgeHost(), men.map(p => ({ ...p, skills: { ...(p.skills || {}) } })), want);
  } catch (e) { return men; }
}

async function menFor(pool, country, named) {
  if (!named || !named.length) return [];
  const clubs = (await pool.query(
    'SELECT slot, squad FROM clubs WHERE country_id=$1', [country])).rows;
  const bySlot = Object.fromEntries(clubs.map(c => [c.slot, c.squad || []]));
  const out = [];
  for (const r of named) {
    const p = (bySlot[r.slot] || []).find(x => x && x.name === r.player);
    if (p) out.push(p);
  }
  return badgeUp(country, out);
}

// the fifteen as men, not names: the banked squad looked up in the squads
// they came from.
export async function squadPlayers(pool, country, seasonNo, round) {
  const rows = (await pool.query(
    'SELECT slot, player FROM callups WHERE country_id=$1 AND season_no=$2 AND round=$3 ORDER BY pick',
    [country, seasonNo, round])).rows;
  return menFor(pool, country, rows);
}

// THE WORLD CUP SQUAD IS THE SIDE AS IT STANDS. The nations that meet in the
// off-season knockout are the sides their selectors last named, not a fresh
// fifteen picked the morning of the draw - so a man who played his way in over
// the closing weeks goes, and a man who played his way out does not. Falling
// back through the windows keeps a world whose standing squads predate this
// answering exactly as it always did.
export async function seasonSquad(pool, country, seasonNo) {
  const standing = (await pool.query(
    `SELECT squad FROM nat_squad WHERE country_id=$1 AND season_no=$2
      ORDER BY round DESC LIMIT 1`, [country, seasonNo])).rows[0];
  if (standing) {
    const men = await menFor(pool, country,
      (standing.squad || []).map(m => ({ slot: m.slot, player: m.name })));
    if (men.length) return men;
  }
  for (const round of WINDOWS.slice().reverse()) {
    const men = await squadPlayers(pool, country, seasonNo, round);
    if (men.length) return men;
  }
  return selectSquad(await nationMen(pool, country));
}

// which nations are in a window on a given world day, and which club round each
// one's call-ups will rob. The calendar owns the day->window mapping, so this
// asks it rather than doing arithmetic in SQL.
export async function windowsOn(pool, day) {
  const rows = (await pool.query(
    `SELECT s.country_id, s.season_no, s.start_day, c.name
       FROM seasons s JOIN countries c ON c.id = s.country_id
      ORDER BY s.country_id, s.season_no DESC`)).rows;
  const out = [], seen = new Set();
  for (const r of rows) {
    if (seen.has(r.country_id)) continue;                 // the latest season only
    const round = windowRoundOfDay(day - r.start_day);
    if (round == null) continue;
    seen.add(r.country_id);
    out.push({ country: r.country_id, seasonNo: r.season_no, round, name: r.name });
  }
  return out;
}

// ---------------------------------------------------------------------------
// THE EVENING'S CRICKET, on the real engine. One idempotency key a day: a
// tick killed halfway leaves its played ties banked and replays only the gap.
// ---------------------------------------------------------------------------
export async function runWindows(pool, host, engineVersion, { now = Date.now(), backDays = 4 } = {}) {
  const today = dayIx(now);
  const played = [];
  for (let day = today - backDays; day <= today; day++) {
    if (!hourSettled(now, day, INTL_HOUR)) continue;
    const inWindow = await windowsOn(pool, day);
    if (inWindow.length < 2) continue;
    // EVERY FOURTH SEASON THE TOUR DAYS ARE THE WORLD CUP'S (docs/PYRAMID.md
    // §7) - the bilateral calendar stands aside for it
    if (isWorldCupSeason(inWindow[0].seasonNo)) continue;
    const key = 'nat:day:' + day;
    const claim = await pool.query(
      `INSERT INTO ticks(key, status) VALUES ($1,'running')
       ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING status`, [key]);
    if (claim.rows[0].status === 'done') continue;
    const byId = Object.fromEntries(inWindow.map(w => [w.country, w]));
    // A NATION LATE IN THE DAY still tours. Most leagues have played by
    // 18:00 UTC and named their squads on the way; the two hour-slots that
    // have not are named here instead. ensureCallups is banked and
    // idempotent, so whichever reaches the selectors first, the fifteen is
    // the same fifteen and the club round that follows still loses them.
    const ready = [];
    for (const w of inWindow) {
      await ensureCallups(pool, w.country, w.seasonNo, w.round);
      const men = await squadPlayers(pool, w.country, w.seasonNo, w.round);
      if (men.length >= 11) ready.push({ ...w, men });
    }
    // THE DAY'S GAMES COME OFF THE CALENDAR, not out of a hat: the season
    // plan says who tours whom, and each tour day plays ONE game of every
    // series whose cast is in window and fit to field a side - game one,
    // two or three of the tie, over its three days.
    const idsAll = (await pool.query('SELECT id FROM countries ORDER BY id')).rows.map(r => r.id);
    const menOf = Object.fromEntries(ready.map(r => [r.country, r]));
    const bySeason = {};
    ready.forEach(r => { bySeason[r.seasonNo] = bySeason[r.seasonNo] || seasonTourPlan(r.seasonNo, idsAll); });
    const games = [];
    for (const sn of Object.keys(bySeason)) {
      for (const g of tiesOnDay(bySeason[sn], ready.filter(r => String(r.seasonNo) === sn))) {
        if (!g.tie.teams.every(id => menOf[id])) continue;
        games.push([g.tie.away, g.tie.home]);
      }
    }
    for (let gi = 0; gi < games.length; gi++) {
      const [aId, bId] = games[gi];
      const A = menOf[aId], B = menOf[bId];
      if (!A || !B) continue;
      const id = natMatchId(day, gi);
      if ((await pool.query('SELECT 1 FROM nat_matches WHERE id=$1', [id])).rowCount) continue;
      const aName = (byId[aId] || {}).name + ' XI', bName = (byId[bId] || {}).name + ' XI';
      const seed = seedOf(id + '|' + aId + '|' + bId);
      // THE HOST IS AT HOME, which matters now that being at home is worth
      // something (FO_HOME_EDGE). This had the TOURING side in the home slot,
      // so a tour of South Africa would have handed the visitors the ground's
      // advantage. b is the host throughout this file - it is bId that owns
      // the fixture - so b goes first.
      const resultJson = host.runMatch(
        { name: bName, players: B.men }, { name: aName, players: A.men }, 'balanced', seed, null);
      if (!resultJson) throw new Error('engine failed international ' + id);
      const living = { [aName]: livingPatch(A.men), [bName]: livingPatch(B.men) };
      await pool.query(
        `INSERT INTO nat_matches(id, world_day, season_no, round, a_country, b_country, a_name, b_name,
                                 seed, engine_version, result, result_canonical, living)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::text,$13::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [id, day, A.seasonNo, A.round, aId, bId, aName, bName, seed, engineVersion,
         resultJson, resultJson, JSON.stringify(living)]);
      // AND THE BALL-BY-BALL, so a tour can be WATCHED. A league round and a
      // friendly have both banked their commentary beside the card since 045,
      // and that log is the whole broadcast: the phone reveals one delivery
      // every eighteen seconds from the hour it was played, so what a manager
      // follows is the umpire's own afternoon and not a re-run of it. An
      // international was the one competition in the world that banked a
      // result and threw the afternoon away, which is why the live scores
      // page could only ever say the sides were out in the middle.
      //
      // It is filed under the HOST's country, which is the pair the reader
      // asks with, and it is pruned by the same forty-five-day sweep as
      // everything else in the table.
      try {
        const natLog = host.lastMatchLog();
        if (natLog && natLog.length) {
          await pool.query(
            `INSERT INTO match_logs(match_id, country_id, log) VALUES ($1,$2,$3::jsonb)
             ON CONFLICT (match_id) DO NOTHING`, [id, bId, JSON.stringify(natLog)]);
        }
      } catch (eLog) { /* the card is the record; the commentary is a luxury */ }
      played.push(id);
    }
    // a cap tires the legs and moves the form, so the men who toured are
    // re-derived tonight rather than at their club's next round - what the
    // manager reads tomorrow is what the selectors did to his squad
    const playedIds = new Set(games.flat());
    for (const r of ready) {
      if (!playedIds.has(r.country)) continue;
      try { await evolveCountry(pool, r.country, now, host); }
      catch (eE) { console.error('evolve after the window failed for ' + r.country + ':', eE.message); }
    }
    await pool.query(`UPDATE ticks SET status='done', finished_at=now(), detail=$2 WHERE key=$1`,
      [key, JSON.stringify({ day, ties: games.length })]);
  }
  return played;
}

// ---------------------------------------------------------------------------
// THE INTERNATIONAL BOOK, derived from the banked tours alone: what every
// capped man has done for his country. A separate career from his club's -
// a Test cap is not a county cap - but the same arithmetic.
// ---------------------------------------------------------------------------
export async function intlBook(pool, country = null) {
  const args = country ? [country] : [];
  const where = country ? 'WHERE m.a_country=$1 OR m.b_country=$1' : '';
  const rows = (await pool.query(
    `SELECT m.id, m.season_no, m.round, m.world_day, m.a_country, m.b_country, m.a_name, m.b_name, m.result
       FROM nat_matches m ${where} ORDER BY m.season_no, m.round, m.id`, args)).rows;
  const book = new Map();
  const at = (nat, name) => {
    const k = nat + '|' + name;
    if (!book.has(k)) book.set(k, { country: nat, name, caps: 0, runs: 0, balls: 0, hs: 0,
      wkts: 0, conc: 0, ovb: 0, bb: null, ct: 0, st: 0, ro: 0, days: [] });
    return book.get(k);
  };
  for (const m of rows) {
    const natOf = side => side === m.a_name ? m.a_country : side === m.b_name ? m.b_country : null;
    const seen = new Map();                       // one man, one cap, however many innings
    const line = (nat, name) => {
      const k = nat + '|' + name;
      if (!seen.has(k)) seen.set(k, { runs: 0, balls: 0, hs: 0, wkts: 0, conc: 0, ovb: 0,
        f4: 0, f6: 0, out: null, ct: 0, st: 0, ro: 0 });
      return seen.get(k);
    };
    for (const inn of ((m.result && m.result.innings) || [])) {
      if (!inn) continue;
      const bat = natOf(inn.batTeam), bowl = natOf(inn.bowlTeam);
      if (bat) for (const b of (inn.bat || [])) {
        const nm = (b.p && b.p.name) || b.p; if (!nm) continue;
        const L = line(bat, nm);
        L.runs += b.r || 0; L.balls += b.b || 0; L.f4 += b.f4 || 0; L.f6 += b.f6 || 0;
        if (b.out) L.out = b.out;
        if ((b.r || 0) > L.hs) L.hs = b.r || 0;
      }
      if (bowl) {
        for (const nm of Object.keys(inn.bowlers || {})) {
          const bw = inn.bowlers[nm], L = line(bowl, nm);
          L.wkts += bw.w || 0; L.conc += bw.r || 0; L.ovb += bw.b || 0;
        }
        for (const nm of Object.keys(inn.fielding || {})) {
          const fd = inn.fielding[nm], L = line(bowl, nm);
          L.ct += fd.ct || 0; L.st += fd.st || 0; L.ro += fd.ro || 0;
        }
      }
    }
    for (const [k, L] of seen) {
      const [nat, name] = k.split('|');
      const e = at(nat, name);
      e.caps++;
      e.runs += L.runs; e.balls += L.balls; e.wkts += L.wkts; e.conc += L.conc; e.ovb += L.ovb;
      e.ct += L.ct; e.st += L.st; e.ro += L.ro;
      if (L.hs > e.hs) e.hs = L.hs;
      if (L.ovb > 0 && (!e.bb || L.wkts > e.bb.w || (L.wkts === e.bb.w && L.conc < e.bb.r))) e.bb = { w: L.wkts, r: L.conc };
      e.days.push({ day: m.world_day, season: m.season_no, round: m.round, line: L });
    }
  }
  return book;
}

// ---------------------------------------------------------------------------
// THE SNAPSHOT a phone reads: every nation's current fifteen, what the window
// cost each club, the tours as they were played, and the caps book.
// ---------------------------------------------------------------------------
export async function computeNations(pool, now = Date.now()) {
  const countries = (await pool.query('SELECT id, name FROM countries ORDER BY id')).rows;
  const seasons = (await pool.query(
    `SELECT DISTINCT ON (country_id) country_id, season_no, start_day
       FROM seasons ORDER BY country_id, season_no DESC`)).rows;
  const seasonOf = Object.fromEntries(seasons.map(s => [s.country_id, s]));
  const clubs = (await pool.query('SELECT country_id, slot, name FROM clubs')).rows;
  const clubName = {};
  clubs.forEach(c => { clubName[c.country_id + ':' + c.slot] = c.name; });
  const book = await intlBook(pool);

  // THE SEASON'S TOUR CALENDAR, resolved to names a page can print. One plan
  // per season number in play (in practice one for the whole world).
  const idsAll = countries.map(c => c.id);
  const nameOf = Object.fromEntries(countries.map(c => [c.id, c.name]));
  const planCache = {};
  const planFor = sn => planCache[sn] || (planCache[sn] = seasonTourPlan(sn, idsAll));
  const tieView = t => ({ kind: 'series', half: t.hIx + 1,
    rounds: t.windows.map(w => WINDOWS[w]), teams: t.teams,
    away: t.away, home: t.home, host: t.home,
    names: [nameOf[t.away] || t.away, nameOf[t.home] || t.home],
    title: (nameOf[t.away] || t.away) + ' tour of ' + (nameOf[t.home] || t.home) });
  // THE SERIES AS IT STANDS, from the banked games alone: won 2-1, leads
  // 1-0, shared - said by the server so no page has to do arithmetic. The
  // banked winner is the SIDE NAME ("England XI"), so wins are counted by
  // matching it back to the country that side belonged to in that game.
  const seriesState = (t, sn) => {
    const pair = t.teams.slice().sort().join('|');
    const games = tours.filter(g => g.seasonNo === sn &&
      [g.aCountry, g.bCountry].sort().join('|') === pair)
      .sort((a, b) => a.round - b.round);
    const winsOf = id => games.filter(g =>
      (g.winner === g.a && g.aCountry === id) || (g.winner === g.b && g.bCountry === id)).length;
    const wA = winsOf(t.away), wH = winsOf(t.home);
    const done = games.length >= SERIES_LEN;
    const lead = wA > wH ? t.away : wH > wA ? t.home : null;
    const score = Math.max(wA, wH) + '-' + Math.min(wA, wH);
    const verdict = !games.length ? null
      : done ? (lead ? (nameOf[lead] || lead) + ' win the series ' + score
                     : 'The series is shared ' + wA + '-' + wH)
      : lead ? (nameOf[lead] || lead) + ' lead the series ' + score
             : 'The series stands level at ' + wA + '-' + wH;
    return { played: games.length, of: SERIES_LEN, winsAway: wA, winsHome: wH, done, verdict,
      games: games.map(g => ({ id: g.id, round: g.round, text: g.text, winner: g.winner })) };
  };

  const ties = (await pool.query(
    `SELECT id, world_day, season_no, round, a_country, b_country, a_name, b_name, result
       FROM nat_matches ORDER BY season_no DESC, round DESC, id`)).rows;
  const scoreOf = inn => inn ? inn.runs + (inn.wkts >= 10 ? ' all out' : '/' + inn.wkts) : '';
  const tours = ties.map(m => ({
    id: m.id, day: m.world_day, seasonNo: m.season_no, round: m.round,
    a: m.a_name, b: m.b_name, aCountry: m.a_country, bCountry: m.b_country,
    as_: scoreOf(m.result.innings[0]), bs_: scoreOf(m.result.innings[1]),
    winner: m.result.winner, text: m.result.text
  }));

  // WHO IS STILL ON THE BOOKS. The by-name caps book is bounded to
  // cricketers a club still holds, so it cannot grow without limit as the
  // seasons pile up. One query for the whole world - and none at all before
  // anybody has been capped, which is most of a first season.
  const onBooks = new Map();
  if (book.size) {
    for (const r of (await pool.query(
      `SELECT country_id, p->>'name' AS name FROM clubs, jsonb_array_elements(squad) p`)).rows) {
      if (!onBooks.has(r.country_id)) onBooks.set(r.country_id, new Set());
      onBooks.get(r.country_id).add(r.name);
    }
  }

  const nations = {};
  for (const c of countries) {
    const s = seasonOf[c.id];
    if (!s) continue;
    const rows = (await pool.query(
      `SELECT round, pick, slot, player, age, fee FROM callups
        WHERE country_id=$1 AND season_no=$2 ORDER BY round DESC, pick`, [c.id, s.season_no])).rows;
    const latest = rows.length ? rows[0].round : null;
    const capsOf = nm => (book.get(c.id + '|' + nm) || { caps: 0 }).caps;
    // THE SIDE AS IT STANDS - a thing that exists all season now, not only in a
    // window. The TOUR squad rides alongside it: those are the men who actually
    // flew, whose clubs were paid and who won caps.
    const now = await natSquadNow(pool, c.id, s.season_no);
    const squad = now.squad.map(m => ({
      name: m.name, club: clubName[c.id + ':' + m.slot] || m.club || null, slot: m.slot,
      age: m.age, fee: m.fee == null ? feeFor(m.age) : m.fee,
      rating: m.rating, keeper: !!m.keeper, bowler: !!m.bowler, caps: capsOf(m.name)
    }));
    const tourSquad = rows.filter(r => r.round === latest).map(r => ({
      name: r.player, club: clubName[c.id + ':' + r.slot] || null, slot: r.slot,
      age: r.age, fee: r.fee, caps: capsOf(r.player)
    }));
    const paid = {};
    rows.forEach(r => { paid[r.slot] = (paid[r.slot] || 0) + r.fee; });
    const mine = Array.from(book.values()).filter(x => x.country === c.id)
      .sort((a, b) => b.caps - a.caps || b.runs - a.runs || (a.name < b.name ? -1 : 1));
    const slim = x => ({ name: x.name, caps: x.caps, runs: x.runs, hs: x.hs, wkts: x.wkts, bb: x.bb });
    const caps = mine.slice(0, 12).map(slim);
    // the same book keyed by name, for a page that wants ONE man's record
    const here = onBooks.get(c.id) || new Set();
    const record = {};
    mine.forEach(x => { if (here.has(x.name)) record[x.name] = slim(x); });
    // the series the calendar dealt this nation this season - or its rest
    // year with the NEXT tour named, or the World Cup, which owns the tour
    // days every fourth year
    const wc9 = isWorldCupSeason(s.season_no);
    const mine9 = wc9 ? null : planFor(s.season_no).byCountry[c.id];
    let next9 = null;
    if (!mine9) {
      const nt = nextTourOf(c.id, s.season_no + 1, idsAll);
      if (nt) next9 = { seasonNo: nt.seasonNo, ...tieView(nt.tie), hosting: nt.tie.host === c.id,
        opp: nt.tie.teams.filter(id => id !== c.id).map(id => nameOf[id] || id).join(' and ') };
    }
    nations[c.id] = {
      id: c.id, name: c.name, seasonNo: s.season_no, window: latest, squad, caps, record,
      // when the selectors last met, and what they did when they met
      namedBefore: now.round, changes: { in: now.in, out: now.out }, tourSquad,
      worldCup: wc9,
      tour: mine9 ? { ...tieView(mine9), hosting: mine9.host === c.id,
        opp: mine9.teams.filter(id => id !== c.id).map(id => nameOf[id] || id).join(' and '),
        series: seriesState(mine9, s.season_no) } : null,
      nextTour: next9,
      compensation: Object.keys(paid).map(slot => ({ slot: +slot, club: clubName[c.id + ':' + slot], paid: paid[slot] }))
        .sort((a, b) => b.paid - a.paid),
      tours: tours.filter(t => t.aCountry === c.id || t.bCountry === c.id).slice(0, 8)
    };
  }
  // the whole season's calendar, once, for the pages that print it. The modal
  // season number across the world - in practice the only one.
  const snAll = seasons.map(s => s.season_no);
  const snTop = snAll.length ? snAll.sort((a, b) =>
    snAll.filter(x => x === a).length - snAll.filter(x => x === b).length || a - b).pop() : 1;
  const planTop = planFor(snTop);
  const calendar = {
    seasonNo: snTop, worldCup: isWorldCupSeason(snTop),
    series: planTop.series.map(t => ({ ...tieView(t), series: seriesState(t, snTop) })),
    resting: planTop.resting.map(id => nameOf[id] || id)
  };
  return {
    day: dayIx(now), windows: WINDOWS, windowDays: WINDOW_DAYS, hourUtc: INTL_HOUR, rounds: ROUNDS,
    seriesLen: SERIES_LEN, nations, tours: tours.slice(0, 40), calendar, generatedAtDay: dayIx(now)
  };
}

export async function rebuildNations(pool, now = Date.now()) {
  const body = await computeNations(pool, now);
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ('nations',$1,now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`, [JSON.stringify(body)]);
  return body;
}
