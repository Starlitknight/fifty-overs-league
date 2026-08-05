// market.mjs — THE TRANSFER MARKET.
//
// The biggest thing in a manager's day, and the one the world's founding law
// used to forbid. That law now reads: absence hurts over TIME, not in the
// short term. So the market is built on a WINDOW, not a race.
//
//   a man is listed        by his club (a manager) or by the umpire (a bot
//                          club shedding somebody it does not need)
//   bids are SEALED        nobody sees anybody else's offer, so there is no
//                          reason on earth to sit refreshing the page
//   the window is DAYS     three world days from listing; a manager who
//                          looks in every couple of days is never behind one
//                          who looks in hourly
//   the umpire settles     highest bid at or above the reserve takes him,
//                          the money moves, the man moves, and neither club
//                          had to be awake for any of it
//
// A manager who vanishes for a season, though, watches the market pass him:
// his surplus goes unsold, the boys he wanted go elsewhere, his wage bill
// stays heavy. That is the amended law working exactly as intended.
//
// EVERYTHING DERIVES. Bot listings and bot bids are seeded on the world's own
// facts, so a re-run produces the same market; the money is walked out of the
// deals by the books like every other line; and a settled transfer is a fact
// in a table, never a number quietly written onto a club.
import { dayIx, seedOf, nextRoundAfterDay, ROUNDS, EPOCH, DAY } from './clock.mjs';
import { countryConfigs } from './init-world.mjs';

export const WINDOW_DAYS = 3;              // a listing stands this many world days
export const MIN_BID_PCT = 0.55;           // an offer below this is not an offer
export const BID_STEP = 500;               // the open board moves in steps of this
export const BOT_SELL_CHANCE = 0.22;       // how often a bot club sheds somebody
export const SQUAD_FLOOR = 13;             // nobody sells themselves short of a side
export const SQUAD_CEILING = 18;           // and nobody hoards beyond this
export const SCOUT_PCT = 0.012;            // a proper look costs this much of his value
export const SCOUT_MIN = 4000;
export const FREE_AGENT_SLOT = -1;         // the umpire's own listings: men of no club
export const MARKET_FLOOR = 20;            // the board never stands shorter than this
export const FREE_AGENTS_CAP = 30;         // and the umpire's own men never flood it

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rnd = key => seedOf(key) / 4294967296;

// ---------------------------------------------------------------------------
// WHAT A MAN IS WORTH. The generator prices every cricketer it makes (p.fee);
// the market reads that as the base and then argues with it the way a buyer
// would - what he is doing now, and how many years are left in him.
// ---------------------------------------------------------------------------
export function ageCurve(age) {
  const a = +age || 27;
  if (a <= 21) return 1.18;                // years of him left, and a resale
  if (a <= 25) return 1.12;
  if (a <= 28) return 1.0;
  if (a <= 31) return 0.82;
  if (a <= 33) return 0.6;
  return 0.4;
}
export function valueOf(p) {
  if (!p) return 0;
  const base = +p.fee || Math.round((+p.rating || 30000) / 9);
  const form = 1 + (((p.formIx == null ? 3 : p.formIx) - 3) * 0.05);
  const v = base * ageCurve(p.age) * form;
  return Math.max(5000, Math.round(v / 500) * 500);
}

// ---------------------------------------------------------------------------
// WHO A CLUB DOES NOT NEED. A side is a shape, not a heap: two keepers is one
// too many, six seamers is two too many, and a thirty-four-year-old behind
// three better men in his own position is a wage nobody is enjoying paying.
// The umpire reads the shape and picks the most surplus man - which is also
// the honest answer for a human wondering who to let go.
// ---------------------------------------------------------------------------
export function roleOf(p) {
  if (!p) return 'bat';
  if (p.keeper || p.role === 'wicketkeeper') return 'keeper';
  const t = String(p.bowlTypeFull || p.bowlType || '');
  if (p.role === 'allRounder') return 'allrounder';
  if (/spin/i.test(t)) return 'spin';
  if (t && t !== 'none') return 'seam';
  return 'bat';
}
const WANT = { keeper: 2, seam: 5, spin: 3, allrounder: 3, bat: 7 };
export function surplusRank(squad) {
  const men = (squad || []).filter(p => p && p.name);
  const by = {};
  men.forEach(p => { const r = roleOf(p); (by[r] = by[r] || []).push(p); });
  const out = [];
  for (const r in by) {
    // best first, so depth beyond what the shape wants is at the tail
    const line = by[r].slice().sort((a, b) => (+b.rating || 0) - (+a.rating || 0));
    const want = WANT[r] || 4;
    line.forEach((p, i) => {
      const over = Math.max(0, (i + 1) - want);
      const wageWeight = (+p.wage || 0) / 1000;
      // deeper than the shape wants, older, and dearer: that is the man
      const score = over * 40 + Math.max(0, (+p.age || 27) - 29) * 9 + wageWeight * 1.5 - (+p.rating || 0) / 6000;
      out.push({ p, role: r, depth: i + 1, over, score });
    });
  }
  return out.sort((a, b) => b.score - a.score || (a.p.name < b.p.name ? -1 : 1));
}
// and the other half of the same question: what is this club short of?
export function needRank(squad) {
  const men = (squad || []).filter(p => p && p.name);
  const by = {};
  men.forEach(p => { const r = roleOf(p); (by[r] = by[r] || []).push(p); });
  const out = [];
  for (const r in WANT) {
    const line = (by[r] || []).slice().sort((a, b) => (+b.rating || 0) - (+a.rating || 0));
    const have = line.length, want = WANT[r];
    const best = line[0] ? (+line[0].rating || 0) : 0;
    out.push({ role: r, have, want, short: Math.max(0, want - have), best });
  }
  return out.sort((a, b) => b.short - a.short || a.best - b.best);
}

// ---------------------------------------------------------------------------
// THE UMPIRE PUTS MEN UP. A bot club sheds its most surplus cricketer now and
// then, so the board is never empty in a world where most clubs have nobody
// behind them. Seeded on the club and the round: the same world lists the
// same man, however many times the day is settled.
// ---------------------------------------------------------------------------
export async function openBotListings(pool, country, seasonNo, round, now = Date.now()) {
  const clubs = (await pool.query(
    `SELECT cl.slot, cl.name, cl.squad, (c.user_id IS NOT NULL) AS managed
       FROM clubs cl LEFT JOIN claims c ON c.country_id=cl.country_id AND c.slot=cl.slot
      WHERE cl.country_id=$1 ORDER BY cl.slot`, [country])).rows;
  const today = dayIx(now);
  const opened = [];
  for (const cl of clubs) {
    if (cl.managed) continue;                       // a manager sells his own men
    const squad = cl.squad || [];
    if (squad.length <= SQUAD_FLOOR) continue;      // never sell yourself short of a side
    const key = 'list|' + country + '|' + cl.slot + '|s' + seasonNo + '|r' + round;
    if (rnd(key) > BOT_SELL_CHANCE) continue;
    const live = (await pool.query(
      `SELECT count(*)::int AS n FROM listings
        WHERE country_id=$1 AND slot=$2 AND status='open'`, [country, cl.slot])).rows[0].n;
    if (live >= 2) continue;                        // a club is not a jumble sale
    const cand = surplusRank(squad)[0];
    if (!cand) continue;
    const dup = await pool.query(
      `SELECT 1 FROM listings WHERE country_id=$1 AND slot=$2 AND player=$3 AND status='open'`,
      [country, cl.slot, cand.p.name]);
    if (dup.rowCount) continue;
    const ask = valueOf(cand.p);
    const r = await pool.query(
      `INSERT INTO listings(country_id, slot, player, player_json, asking, reserve,
                            opened_day, closes_day, closes_ms, status, by_user)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,'open',NULL)
       ON CONFLICT DO NOTHING RETURNING id`,
      [country, cl.slot, cand.p.name, JSON.stringify(cand.p), ask,
       // the umpire's own listings close on the day boundary they always did
       // - deterministic, so a healed day opens the same board - and the
       // minute hand still runs: anti-snipe extensions move closes_ms out
       Math.round(ask * 0.8), today, today + WINDOW_DAYS, EPOCH + (today + WINDOW_DAYS) * DAY]);
    if (r.rowCount) opened.push({ id: r.rows[0].id, country, slot: cl.slot, player: cand.p.name, asking: ask });
  }
  return opened;
}

// ---------------------------------------------------------------------------
// THE SHELF NEVER RUNS SHORT. The owner's law: at any point there are at
// least twenty names on a league's board. Each daily settle counts what
// stands open - clubs' listings and free agents together - and walks men of
// no club on until the floor is met, plus a fresh face or two on top so the
// board breathes even when it is full. Everything is seeded on the league
// and the day: the same world offers the same men however often the day is
// settled, and a manager reading the calendar knows when new names arrive.
// ---------------------------------------------------------------------------
export async function openFreeAgents(pool, host, country, seasonNo, day) {
  if (!host || !host.genSquad) return [];
  const cfg = countryConfigs(host).find(c => c.id === country);
  if (!cfg) return [];
  const counts = (await pool.query(
    `SELECT count(*)::int AS all_open,
            count(*) FILTER (WHERE slot=$2)::int AS fa_open
       FROM listings WHERE country_id=$1 AND status='open'`,
    [country, FREE_AGENT_SLOT])).rows[0];
  const key = 'fa|' + country + '|s' + seasonNo + '|d' + day;
  const fresh = 1 + (seedOf(key) % 2);           // the daily breath: one or two
  let n = Math.max(fresh, MARKET_FLOOR - counts.all_open);
  n = Math.min(n, FREE_AGENTS_CAP - counts.fa_open);
  if (n <= 0) return [];
  const opened = [];
  // a generated name can collide with a man already on the board; spare
  // seeds cover the gap so the floor is met regardless
  for (let i = 0; i < n + 8 && opened.length < n; i++) {
    const seed = key + '|' + i;
    let men = [];
    try { men = host.genSquad(seed, cfg.nat, cfg.arch || 'balanced', 'general') || []; } catch (e) { continue; }
    if (!men.length) continue;
    men.sort((a, b) => (+b.rating || 0) - (+a.rating || 0) || (a.name < b.name ? -1 : 1));
    // a free agent is a useful cricketer, not a star: mid-order of the sample
    const man = JSON.parse(JSON.stringify(men[Math.min(men.length - 1, 3 + seedOf(seed + '|pick') % 6)]));
    man.nat = man.nat || cfg.nat;
    // NO DOUBLES. The world keys a cricketer by his name, so a free agent who
    // shares one with a man already contracted in this league would replace
    // him on arrival. Such a man simply never walks on; a spare seed does.
    const taken = await pool.query(
      `SELECT 1 FROM clubs, jsonb_array_elements(squad) p
        WHERE country_id=$1 AND p->>'name' = $2 LIMIT 1`, [country, man.name]);
    if (taken.rowCount) continue;
    const ask = valueOf(man);
    const r = await pool.query(
      `INSERT INTO listings(country_id, slot, player, player_json, asking, reserve,
                            opened_day, closes_day, closes_ms, status, by_user)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,'open',NULL)
       ON CONFLICT DO NOTHING RETURNING id`,
      [country, FREE_AGENT_SLOT, man.name, JSON.stringify(man), ask,
       Math.round(ask * 0.7), day, day + WINDOW_DAYS, EPOCH + (day + WINDOW_DAYS) * DAY]);
    if (r.rowCount) opened.push({ id: r.rows[0].id, country, player: man.name, asking: ask });
  }
  return opened;
}

// ---------------------------------------------------------------------------
// AND BOT CLUBS BID. A club with a hole in its shape and money in the bank
// will go after a man who fills it - which is what stops a human simply
// hoovering up every listing on earth unopposed. Seeded on the listing and
// the bidder, so the same auction resolves the same way forever.
// ---------------------------------------------------------------------------
export function botBid(listing, buyerSquad, bank, player) {
  const need = needRank(buyerSquad);
  const role = roleOf(player);
  const mine = need.find(n => n.role === role) || { short: 0, best: 0, have: 9, want: 4 };
  // does he actually improve them? either they are short of his trade, or he
  // is better than what they have
  const better = (+player.rating || 0) > mine.best * 1.04;
  if (!mine.short && !better) return 0;
  if ((buyerSquad || []).length >= SQUAD_CEILING) return 0;
  const ask = +listing.asking || 0;
  const appetite = 0.86 + rnd('bid|' + listing.id + '|' + listing.buyerKey) * 0.34;   // 0.86 .. 1.20
  const keen = (mine.short ? 1.06 : 1) * (better ? 1.05 : 1);
  let offer = Math.round(ask * appetite * keen / 500) * 500;
  // nobody bids past the wall: a quarter of the bank is the most any club
  // will put on one cricketer, and nothing is bought into an overdraft
  const ceiling = Math.floor(Math.max(0, bank) * 0.25 / 500) * 500;
  offer = Math.min(offer, ceiling);
  return offer >= Math.round(ask * MIN_BID_PCT) ? offer : 0;
}

export async function placeBotBids(pool, now = Date.now()) {
  const today = dayIx(now);
  const open = (await pool.query(
    `SELECT * FROM listings WHERE status='open'
      AND ((closes_ms IS NOT NULL AND closes_ms > $2) OR (closes_ms IS NULL AND closes_day > $1))
      ORDER BY id`, [today, now])).rows;
  const placed = [];
  for (const L of open) {
    // OPEN OUTCRY. botBid() is the club's CAP, seeded once and forever. On
    // the board it opens low - the floor, or one step over the standing high
    // - and each settle it raises one step past whoever has outbid it, up to
    // its cap and never further. Deterministic given the board's state, so a
    // re-settled day places the same money.
    const board = (await pool.query(
      'SELECT country_id, slot, amount FROM bids WHERE listing_id=$1', [L.id])).rows;
    let high = 0; board.forEach(b => { if (+b.amount > high) high = +b.amount; });
    const clubs = (await pool.query(
      `SELECT cl.country_id, cl.slot, cl.squad, cl.bank, (c.user_id IS NOT NULL) AS managed
         FROM clubs cl LEFT JOIN claims c ON c.country_id=cl.country_id AND c.slot=cl.slot
        WHERE cl.country_id=$1 AND NOT (cl.country_id=$1 AND cl.slot=$2)
        ORDER BY cl.slot`,
      [L.country_id, L.slot])).rows;
    for (const cl of clubs) {
      if (cl.managed) continue;                   // a manager bids for himself
      const cap = botBid({ ...L, buyerKey: cl.country_id + ':' + cl.slot }, cl.squad || [], Number(cl.bank || 0), L.player_json);
      if (!cap) continue;
      const mine = board.find(b => b.country_id === cl.country_id && b.slot === cl.slot);
      const floor = Math.round((+L.asking || 0) * MIN_BID_PCT);
      let offer = 0;
      if (!mine) offer = Math.min(cap, Math.max(floor, high ? high + BID_STEP : floor));
      else if (+mine.amount < high && +mine.amount < cap) offer = Math.min(cap, high + BID_STEP);
      if (!offer || offer <= (+((mine || {}).amount) || 0) || offer < floor) continue;
      await pool.query(
        `INSERT INTO bids(listing_id, country_id, slot, amount, user_id)
         VALUES ($1,$2,$3,$4,NULL)
         ON CONFLICT (listing_id, country_id, slot)
         DO UPDATE SET amount = EXCLUDED.amount, placed_at = now()
         WHERE bids.amount < EXCLUDED.amount`,
        [L.id, cl.country_id, cl.slot, offer]);
      if (offer > high) high = offer;
      placed.push({ id: L.id, by: cl.country_id + ':' + cl.slot, amount: offer });
    }
  }
  return placed;
}

// ---------------------------------------------------------------------------
// THE HAMMER. Sealed bids, opened by the umpire when the window shuts: the
// highest offer at or above the reserve takes him. A tie goes to the club
// that would be more improved by him, and then to the seed, so it is never
// whoever happened to click first.
// ---------------------------------------------------------------------------
export function pickWinner(listing, bids) {
  const live = (bids || []).filter(b => +b.amount >= (+listing.reserve || 0));
  if (!live.length) return null;
  const top = Math.max(...live.map(b => +b.amount));
  const tied = live.filter(b => +b.amount === top);
  if (tied.length === 1) return tied[0];
  return tied.slice().sort((a, b) =>
    rnd('tie|' + listing.id + '|' + a.country_id + '|' + a.slot) -
    rnd('tie|' + listing.id + '|' + b.country_id + '|' + b.slot))[0];
}

export async function closeListings(pool, { now = Date.now() } = {}) {
  const today = dayIx(now);
  // the minute hand rules (052): a listing with an exact closing moment is
  // due when that moment passes - anti-snipe extensions included. Rows from
  // before the minute hand fall back to the day boundary they always used.
  const due = (await pool.query(
    `SELECT * FROM listings WHERE status='open'
      AND ((closes_ms IS NOT NULL AND closes_ms <= $2) OR (closes_ms IS NULL AND closes_day <= $1))
      ORDER BY id`, [today, now])).rows;
  const settled = [];
  for (const L of due) {
    const bids = (await pool.query(
      'SELECT * FROM bids WHERE listing_id=$1 ORDER BY country_id, slot', [L.id])).rows;
    const win = pickWinner(L, bids);
    if (!win) {
      await pool.query(
        `UPDATE listings SET status='unsold', settled_day=$2 WHERE id=$1 AND status='open'`, [L.id, today]);
      settled.push({ id: L.id, sold: false });
      continue;
    }
    const moved = await moveMan(pool, L, win, today);
    if (!moved) {
      await pool.query(
        `UPDATE listings SET status='unsold', settled_day=$2 WHERE id=$1 AND status='open'`, [L.id, today]);
      settled.push({ id: L.id, sold: false, reason: moved === false ? 'gone' : 'error' });
      continue;
    }
    await pool.query(
      `UPDATE listings SET status='sold', buyer_country=$2, buyer_slot=$3, fee=$4, settled_day=$5
        WHERE id=$1 AND status='open'`,
      [L.id, win.country_id, win.slot, win.amount, today]);
    settled.push({ id: L.id, sold: true, to: win.country_id + ':' + win.slot, fee: +win.amount });
  }
  return settled;
}

// THE MAN HIMSELF. A transfer is two squads changing, and a career that has
// to survive the journey: his record so far is frozen onto him as a carry,
// because the living layer derives a man's book from the matches his CURRENT
// club has played and would otherwise hand him a blank page at his new one.
// He also carries the round he arrived, so the nets never work him through
// weeks he was not there for.
async function moveMan(pool, L, win, today) {
  const freeAgent = L.slot === FREE_AGENT_SLOT;   // the umpire's man: nobody to leave
  const seller = freeAgent ? null : (await pool.query(
    'SELECT slot, squad FROM clubs WHERE country_id=$1 AND slot=$2', [L.country_id, L.slot])).rows[0];
  const buyer = (await pool.query(
    'SELECT slot, squad FROM clubs WHERE country_id=$1 AND slot=$2', [win.country_id, win.slot])).rows[0];
  if ((!freeAgent && !seller) || !buyer) return false;
  const squad = freeAgent ? [] : (seller.squad || []);
  const ix = freeAgent ? -1 : squad.findIndex(p => p && p.name === L.player);
  if (!freeAgent && ix < 0) return false;         // he has already gone somewhere
  if (!freeAgent && squad.length <= SQUAD_FLOOR) return false;  // and no club is stripped below a side
  const man = JSON.parse(JSON.stringify(freeAgent ? L.player_json : squad[ix]));
  const season = (await pool.query(
    'SELECT season_no, start_day FROM seasons WHERE country_id=$1 ORDER BY season_no DESC LIMIT 1',
    [win.country_id])).rows[0];
  const round = season ? nextRoundAfterDay(today - season.start_day) : 1;   // he is available from the NEXT round
  const prior = man.career || null, priorI = man.intl || null;
  man.carry = addCarry(man.carry, prior);
  if (priorI) man.carryIntl = addCarry(man.carryIntl, priorI);
  man.joined = { s: season ? season.season_no : 1, r: round };
  man.from = { country: L.country_id, slot: L.slot, day: today };
  delete man.career; delete man.intl;
  // the nets he did at his old club are his; the baseline he is rebuilt from
  // has to be what he IS today, not what he was generated as
  man.baseSkills = JSON.parse(JSON.stringify(man.skills || man.baseSkills || {}));
  delete man.trainProgress;

  if (!freeAgent) {
    const left = squad.slice(0, ix).concat(squad.slice(ix + 1));
    await pool.query('UPDATE clubs SET squad=$3::jsonb WHERE country_id=$1 AND slot=$2',
      [L.country_id, L.slot, JSON.stringify(left)]);
  }
  const bs = (buyer.squad || []).filter(p => p && p.name !== man.name).concat([man]);
  await pool.query('UPDATE clubs SET squad=$3::jsonb WHERE country_id=$1 AND slot=$2',
    [win.country_id, win.slot, JSON.stringify(bs)]);
  return true;
}
function addCarry(a, b) {
  const z = { m: 0, runs: 0, balls: 0, hs: 0, wkts: 0, conc: 0, ovb: 0, bb: null };
  const s = { ...z, ...(a || {}) };
  if (!b) return s;
  s.m += b.m || 0; s.runs += b.runs || 0; s.balls += b.balls || 0;
  s.wkts += b.wkts || 0; s.conc += b.conc || 0; s.ovb += b.ovb || 0;
  if ((b.hs || 0) > s.hs) s.hs = b.hs || 0;
  if (b.bb && (!s.bb || b.bb.w > s.bb.w || (b.bb.w === s.bb.w && b.bb.r < s.bb.r))) s.bb = b.bb;
  return s;
}

// ---------------------------------------------------------------------------
// WHAT A SCOUT SEES. The law: your own numbers are yours, a rival's man is
// somebody's opinion. Everyone can read the free impression - his trade, his
// age, roughly his class. Pay a scout and the report sharpens: bands rather
// than adjectives, his nick, his legs, and what he is likely to cost. Nobody
// ever gets his skill values. It is a pure function of the man and the tier,
// so the same money always buys the same report.
// ---------------------------------------------------------------------------
const CLASS = ['club standard', 'useful', 'a good player', 'very good', 'outstanding', 'the best in the land'];
export function classOf(rating) {
  const r = +rating || 0;
  return CLASS[clamp(Math.floor((r - 26000) / 4500), 0, CLASS.length - 1)];
}
const FORMW = ['abysmal', 'poor', 'shaky', 'steady', 'good', 'strong', 'excellent'];
function band(v, width) {
  const lo = Math.max(0, Math.round((v - width / 2) / 5) * 5);
  return lo + '-' + (lo + width);
}
export function scoutReport(p, paid) {
  if (!p) return null;
  const role = roleOf(p);
  const free = {
    name: p.name, age: p.age || null, role,
    hand: p.hand === 'L' ? 'left-hand bat' : 'right-hand bat',
    bowl: p.btLabel || (role === 'seam' || role === 'spin' ? 'bowls' : 'does not bowl'),
    impression: classOf(p.rating),
    talents: (p.talents || []).length ? (p.talents || []).length + ' noted' : 'none noted'
  };
  if (!paid) return { ...free, paid: false };
  const bat = Math.round(0.25 * (p.skills?.vsPace || 0) + 0.25 * (p.skills?.vsSpin || 0)
    + 0.2 * (p.skills?.rotation || 0) + 0.15 * (p.skills?.temperament || 0) + 0.15 * (p.skills?.power || 0));
  const bowl = (p.bowlType && p.bowlType !== 'none')
    ? Math.round(((p.skills?.wicket || 0) + (p.skills?.economy || 0) + (p.skills?.discipline || 0)
      + (p.skills?.moveTurn || 0) + (p.skills?.variation || 0) + (p.skills?.stamina || 0)) / 6) : 0;
  const fld = Math.round(((p.skills?.fielding || 0) + (p.skills?.catching || 0)) / 2);
  return {
    ...free, paid: true,
    batting: band(bat, 10), bowling: bowl ? band(bowl, 10) : null, fielding: band(fld, 12),
    form: FORMW[p.formIx == null ? 3 : p.formIx], legs: p.fatWord || p.fatigue || 'rested',
    experience: p.expWord || null,
    talentNames: (p.talents || []).slice(0, 3),
    wage: p.wage || 0, worth: valueOf(p)
  };
}
export function scoutFee(p) { return Math.max(SCOUT_MIN, Math.round(valueOf(p) * SCOUT_PCT / 100) * 100); }

// ---------------------------------------------------------------------------
// THE BOARD, as a phone reads it. Open listings with the free impression; the
// paid detail is served only to the manager who paid for it, by the RPC.
// ---------------------------------------------------------------------------
export async function computeMarket(pool, now = Date.now()) {
  const open = (await pool.query(
    `SELECT l.*, cl.name AS club FROM listings l
       LEFT JOIN clubs cl ON cl.country_id=l.country_id AND cl.slot=l.slot
      WHERE l.status='open' ORDER BY l.closes_day, l.id`)).rows;
  const done = (await pool.query(
    `SELECT l.id, l.country_id, l.slot, l.player, l.asking, l.fee, l.settled_day, l.status,
            l.buyer_country, l.buyer_slot,
            s.name AS from_club, b.name AS to_club
       FROM listings l
       LEFT JOIN clubs s ON s.country_id=l.country_id AND s.slot=l.slot
       LEFT JOIN clubs b ON b.country_id=l.buyer_country AND b.slot=l.buyer_slot
      WHERE l.status='sold' ORDER BY l.settled_day DESC, l.id DESC LIMIT 40`)).rows;
  return {
    day: dayIx(now), windowDays: WINDOW_DAYS, step: BID_STEP,
    listings: open.map(L => ({
      id: L.id, country: L.country_id, slot: L.slot,
      club: L.slot === FREE_AGENT_SLOT ? 'Free agent' : L.club,
      free: L.slot === FREE_AGENT_SLOT || undefined,
      asking: L.asking, reserve: L.reserve, opened: L.opened_day, closes: L.closes_day,
      closesMs: L.closes_ms != null ? +L.closes_ms : null,
      bids: 0, high: 0, highClub: null,
      scout: scoutReport(L.player_json, false), fee: scoutFee(L.player_json),
      // THE OPEN CARD (052): a listed man's full skills are public - the
      // From the Pavilion rule the owner chose. Bidding is informed
      // strategy; the fog stays where it belongs, in the academy.
      man: (p => p ? {
        name: p.name, age: p.age, nat: p.nat, hand: p.hand, role: p.role,
        bowlType: p.bowlType, bowlTypeFull: p.bowlTypeFull, keeper: p.keeper,
        wage: p.wage, exp: p.exp, expWord: p.expWord, skills: p.skills,
        talents: p.talents, rating: p.rating
      } : null)(L.player_json)
    })),
    deals: done.map(d => ({
      id: d.id, player: d.player,
      from: d.slot === FREE_AGENT_SLOT ? 'Free agent' : d.from_club,
      to: d.buyer_country === 'bank' ? 'the bank'
        : d.buyer_country === 'released' ? 'released' : d.to_club,
      fromCountry: d.country_id, toCountry: d.buyer_country, fee: d.fee, day: d.settled_day
    })),
    generatedAtDay: dayIx(now)
  };
}

export async function rebuildMarket(pool, now = Date.now()) {
  const body = await computeMarket(pool, now);
  // THE OPEN BOARD: how many offers, how high the board stands, and who
  // holds it - public by decree. Skills stay the scout's trade.
  const tops = (await pool.query(
    `SELECT DISTINCT ON (b.listing_id) b.listing_id, b.amount, b.country_id, b.slot,
            coalesce(cl.name, 'a club') AS club,
            (SELECT count(*)::int FROM bids b3 WHERE b3.listing_id = b.listing_id) AS n
       FROM bids b LEFT JOIN clubs cl ON cl.country_id=b.country_id AND cl.slot=b.slot
      ORDER BY b.listing_id, b.amount DESC, b.placed_at ASC`)).rows;
  const byId = Object.fromEntries(tops.map(t => [t.listing_id, t]));
  body.listings.forEach(L => {
    const t = byId[L.id];
    if (t) { L.bids = t.n; L.high = +t.amount; L.highClub = t.club; }
  });
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ('market',$1,now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`, [JSON.stringify(body)]);
  return body;
}

// one call for the umpire: put men up, settle nothing. Bot clubs shed men on
// league rounds only; the free-agent trickle walks on every day the world
// turns, rest days included - fresh names are the market's pulse.
export async function runMarket(pool, country, seasonNo, round, { now = Date.now(), host = null } = {}) {
  const opened = (round >= 1 && round <= ROUNDS)
    ? await openBotListings(pool, country, seasonNo, round, now) : [];
  const agents = await openFreeAgents(pool, host, country, seasonNo, dayIx(now));
  return { opened, agents };
}
export async function settleMarket(pool, { now = Date.now() } = {}) {
  const bids = await placeBotBids(pool, now);
  const settled = await closeListings(pool, { now });
  if (bids.length || settled.length) await rebuildMarket(pool, now);
  return { bids: bids.length, settled };
}
