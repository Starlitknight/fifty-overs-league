// nations.mjs — THE INTERNATIONAL GAME.
//
// A national team used to be a fiction that appeared for three days a year: a
// fifteen picked by rating at the cup window so the World Cup bracket had
// somebody to run. This module gives the international game a season.
//
// Three rounds a year are WINDOW DAYS (clock.mjs WINDOWS: 5, 9 and 13). On a
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
import { dayIx, seedOf, isWindowRound, WINDOWS, INTL_HOUR, hourSettled, ROUNDS } from './clock.mjs';
import { livingPatch, evolveCountry } from './living.mjs';

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
  for (const p of ranked) { if (picked.length >= size) break; take(p); }
  return picked;
}

// the world day a nation's round falls on, and whether that day's draw gave
// it a fixture at all
export async function touringOn(pool, country, seasonNo, round) {
  const s = (await pool.query(
    'SELECT start_day FROM seasons WHERE country_id=$1 AND season_no=$2', [country, seasonNo])).rows[0];
  if (!s) return false;
  const day = s.start_day + round - 1;
  const inWindow = await windowsOn(pool, day);
  if (inWindow.length < 2) return false;
  return tourPairs(day, inWindow.map(w => w.country)).some(p => p[0] === country || p[1] === country);
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
  const squad = selectSquad(await nationMen(pool, country));
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

// ---------------------------------------------------------------------------
// THE TOURS. Whoever is in a window on the same world day plays somebody else
// who is: shuffled on the day's own seed, so the fixtures are stable across
// re-runs and different every window. An odd nation out has the window off.
// ---------------------------------------------------------------------------
export function tourPairs(day, ids) {
  const key = 'tour|d' + day;
  const ranked = (ids || []).slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map(id => ({ id, k: seedOf(key + '|' + id) }))
    .sort((a, b) => a.k - b.k || (a.id < b.id ? -1 : 1))
    .map(x => x.id);
  const pairs = [];
  for (let i = 0; i + 1 < ranked.length; i += 2) pairs.push([ranked[i], ranked[i + 1]]);
  return pairs;
}

// the fifteen as men, not names: the banked squad looked up in the squads
// they came from. A man who has since left cricket simply is not there.
export async function squadPlayers(pool, country, seasonNo, round) {
  const rows = (await pool.query(
    'SELECT slot, player FROM callups WHERE country_id=$1 AND season_no=$2 AND round=$3 ORDER BY pick',
    [country, seasonNo, round])).rows;
  if (!rows.length) return [];
  const clubs = (await pool.query(
    'SELECT slot, squad FROM clubs WHERE country_id=$1', [country])).rows;
  const bySlot = Object.fromEntries(clubs.map(c => [c.slot, c.squad || []]));
  const out = [];
  for (const r of rows) {
    const p = (bySlot[r.slot] || []).find(x => x && x.name === r.player);
    if (p) out.push(p);
  }
  return out;
}

// THE WORLD CUP SQUAD IS THE SEASON'S SQUAD. The nations that meet in the
// off-season knockout are the sides that played the windows, not a fresh
// fifteen picked the morning of the draw - so a man who held his place all
// year goes to the World Cup, which is the whole point of holding it.
export async function seasonSquad(pool, country, seasonNo) {
  for (const round of WINDOWS.slice().reverse()) {
    const men = await squadPlayers(pool, country, seasonNo, round);
    if (men.length) return men;
  }
  return selectSquad(await nationMen(pool, country));
}

// which nations are in a window on a given world day, and on what round
export async function windowsOn(pool, day) {
  const rows = (await pool.query(
    `SELECT s.country_id, s.season_no, (($1::int - s.start_day) + 1) AS round, c.name
       FROM seasons s JOIN countries c ON c.id = s.country_id
      WHERE (($1::int - s.start_day) + 1) = ANY($2::int[])
      ORDER BY s.country_id`, [day, WINDOWS])).rows;
  return rows.map(r => ({ country: r.country_id, seasonNo: r.season_no, round: r.round, name: r.name }));
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
    const pairs = tourPairs(day, ready.map(r => r.country));
    const menOf = Object.fromEntries(ready.map(r => [r.country, r]));
    for (let gi = 0; gi < pairs.length; gi++) {
      const [aId, bId] = pairs[gi];
      const A = menOf[aId], B = menOf[bId];
      if (!A || !B) continue;
      const id = natMatchId(day, gi);
      if ((await pool.query('SELECT 1 FROM nat_matches WHERE id=$1', [id])).rowCount) continue;
      const aName = (byId[aId] || {}).name + ' XI', bName = (byId[bId] || {}).name + ' XI';
      const seed = seedOf(id + '|' + aId + '|' + bId);
      const resultJson = host.runMatch(
        { name: aName, players: A.men }, { name: bName, players: B.men }, 'balanced', seed, null);
      if (!resultJson) throw new Error('engine failed international ' + id);
      const living = { [aName]: livingPatch(A.men), [bName]: livingPatch(B.men) };
      await pool.query(
        `INSERT INTO nat_matches(id, world_day, season_no, round, a_country, b_country, a_name, b_name,
                                 seed, engine_version, result, result_canonical, living)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::text,$13::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [id, day, A.seasonNo, A.round, aId, bId, aName, bName, seed, engineVersion,
         resultJson, resultJson, JSON.stringify(living)]);
      played.push(id);
    }
    // a cap tires the legs and moves the form, so the men who toured are
    // re-derived tonight rather than at their club's next round - what the
    // manager reads tomorrow is what the selectors did to his squad
    for (const r of ready) {
      try { await evolveCountry(pool, r.country, now, host); }
      catch (eE) { console.error('evolve after the window failed for ' + r.country + ':', eE.message); }
    }
    await pool.query(`UPDATE ticks SET status='done', finished_at=now(), detail=$2 WHERE key=$1`,
      [key, JSON.stringify({ day, ties: pairs.length })]);
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
    const squad = rows.filter(r => r.round === latest).map(r => ({
      name: r.player, club: clubName[c.id + ':' + r.slot] || null, slot: r.slot,
      age: r.age, fee: r.fee,
      caps: (book.get(c.id + '|' + r.player) || { caps: 0 }).caps
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
    nations[c.id] = {
      id: c.id, name: c.name, seasonNo: s.season_no, window: latest, squad, caps, record,
      compensation: Object.keys(paid).map(slot => ({ slot: +slot, club: clubName[c.id + ':' + slot], paid: paid[slot] }))
        .sort((a, b) => b.paid - a.paid),
      tours: tours.filter(t => t.aCountry === c.id || t.bCountry === c.id).slice(0, 8)
    };
  }
  return {
    day: dayIx(now), windows: WINDOWS, hourUtc: INTL_HOUR, rounds: ROUNDS,
    nations, tours: tours.slice(0, 40), generatedAtDay: dayIx(now)
  };
}

export async function rebuildNations(pool, now = Date.now()) {
  const body = await computeNations(pool, now);
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ('nations',$1,now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`, [JSON.stringify(body)]);
  return body;
}
