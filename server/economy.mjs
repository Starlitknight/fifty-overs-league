// economy.mjs — THE BOOKS
//
// A club's money used to be four flat numbers. It is now a ledger, walked
// round by round from the day the world was founded, and every line of it is
// derived from the record: who played whom, who won, where each club stood
// that morning, and how many people fancied going.
//
//   supporters -> a crowd that grows on winning and drifts away on losing
//   mood       -> what those supporters think, from recent form and position
//   the gate   -> attendance x the ticket, split two thirds home, one third away
//   sponsors   -> paid by the round, worth more the higher you finish
//   wages      -> the bill as it stands, every round played
//   the academy-> upkeep by the round, and what its upgrades cost
//   the ground -> seats you paid for, and the ceiling they put on a crowd
//   the bank   -> and interest on it when it is the wrong side of nothing
//
// THE LAW HOLDS: nothing here is incremented imperatively and nothing is
// stored that a re-run could not rebuild. Settle it twice and it settles the
// same figure, which is what lets an offline manager trust it.
import { seedOf } from './clock.mjs';

export const FOUNDING_BANK = 2500000;
export const FOUNDING_SUPPORT = 12000;
export const FOUNDING_SEATS = 15000;
export const MAX_SEATS = 45000;
export const TICKET = 26;                    // what a seat costs at the gate
export const HOME_CUT = 2 / 3;               // the old two-thirds, one-third split
export const DEBT_ROUND = 0.03;              // what an overdraft costs a round
// THE HARD CAP. A club may not sink further than the money it was founded
// with. Reach that floor and it is in ADMINISTRATION: the losses below the
// line are written off - there is no deeper hole to dig - but the sponsor
// halves his cheque while the club is under, and nothing gets built. It is a
// floor with a price, not a forgiveness.
export const DEBT_LIMIT = 2500000;
export const ADMIN_SPONSOR = 0.5;
export const ACADEMY_UPKEEP = 900;           // a level, a round
export const MOOD_WORD = ['mutinous', 'restless', 'patient', 'settled', 'pleased', 'delighted', 'ecstatic'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// THE DAY AT THE GROUND. A pure function of the fixture, so every device
// works out the same weather for the same match without anyone storing it.
// It moves the turnstiles, not the cricket - the pitch is what the engine
// plays on.
const WEATHER = [
  { word: 'fine', mult: 1.00 }, { word: 'warm', mult: 1.09 }, { word: 'grey', mult: 0.94 },
  { word: 'blustery', mult: 0.89 }, { word: 'showery', mult: 0.77 }, { word: 'close', mult: 1.03 }
];
export function weatherOf(matchIdOrSeed) {
  const n = typeof matchIdOrSeed === 'string' && /[^0-9]/.test(matchIdOrSeed)
    ? seedOf(matchIdOrSeed) : Math.abs(Number(matchIdOrSeed) || 0);
  return WEATHER[n % WEATHER.length];
}

// WHAT THE SUPPORTERS THINK, from the last five results and where the club
// stands. Not a counter that drifts - a reading, taken fresh each round.
export function moodOf(last5, pos, clubs) {
  const rate = last5.length ? last5.reduce((s, p) => s + p, 0) / (2 * last5.length) : 0.5;
  const posF = clubs > 1 ? (clubs - pos) / (clubs - 1) : 0.5;
  return clamp(Math.round((rate * 0.65 + posF * 0.35) * 6), 0, 6);
}
// how full a ground gets: a settled crowd is most of the support, a mutinous
// one stays home, and an ecstatic one brings the neighbours
const moodMult = m => 0.72 + m * 0.08;
// and who is visiting matters - the flagship and the leaders draw a crowd
const drawMult = (opp, oppPos) => (opp.is_boss ? 1.22 : 1) * (oppPos <= 3 ? 1.09 : 1);

// WHAT A CROWD BECOMES. Support drifts toward what the club deserves rather
// than jumping to it, so a good season builds a following and a bad one
// costs you one slowly enough to hurt.
function supportTarget(mood, pos, clubs) {
  const posF = clubs > 1 ? (clubs - pos) / (clubs - 1) : 0.5;
  return Math.round(7000 + mood * 2600 + posF * 7000);
}

// WHAT THE NEXT SEATS COST. Building gets dearer the bigger the ground is:
// each further thousand costs more per seat than the last.
export function seatBlockPrice(fromSeats) {
  const block = Math.max(0, Math.floor((fromSeats - FOUNDING_SEATS) / 1000));
  return 1000 * (260 + block * 30);
}
export function stadiumCost(fromSeats, toSeats) {
  let cost = 0;
  for (let s = fromSeats; s < toSeats; s += 1000) cost += seatBlockPrice(s);
  return cost;
}

// the sponsor pays by the round, and reads the table before he signs
export function sponsorOf(pos, mood, clubs) {
  const posF = clubs > 1 ? (clubs - pos) / (clubs - 1) : 0.5;
  return Math.round(18000 + posF * 15000 + (mood - 3) * 3000);
}

// ---------------------------------------------------------------------------
// THE WALK. Every round this country has ever played, in order, for every
// club at once - because a club's gate depends on who visited and where the
// visitor stood that morning.
// ---------------------------------------------------------------------------
export async function computeFinance(pool, country) {
  const clubs = (await pool.query(
    `SELECT slot, name, is_boss, squad, academy, academy_paid, seats, seats_paid
       FROM clubs WHERE country_id=$1 ORDER BY slot`, [country])).rows;
  if (!clubs.length) return [];
  // EXTRACT IN THE DATABASE: a season of result blobs is tens of megabytes and
  // all the books need from them is who won.
  const ms = (await pool.query(
    `SELECT id, season_no, round, home_slot, away_slot, home_name, away_name, seed,
            result->>'winner' AS winner
       FROM matches WHERE country_id=$1 ORDER BY season_no, round, home_slot`, [country])).rows;
  // WHAT THE BOARD PAYS FOR A MAN'S WEEK. An international window takes a
  // club's best men and pays for them by the head - fifty thousand a senior,
  // twenty for a boy under twenty-one. Derived from the squads as named, so
  // the cheque is walked from genesis with everything else and re-settling
  // can never pay it twice.
  let fees = [];
  try {
    fees = (await pool.query(
      `SELECT season_no, round, slot, sum(fee)::int AS paid, count(*)::int AS men
         FROM callups WHERE country_id=$1 GROUP BY season_no, round, slot`, [country])).rows;
  } catch (eF) { fees = []; }                    // pre-023 database: no windows yet
  const feeAt = {};
  for (const f of fees) feeAt[f.season_no + ':' + f.round + ':' + f.slot] = f;

  const N = clubs.length;
  const S = {};
  for (const c of clubs) {
    const wages = (c.squad || []).reduce((s, p) => s + (p.wage || 0), 0);
    S[c.slot] = {
      slot: c.slot, name: c.name, is_boss: c.is_boss, wages,
      academy: c.academy || 2, seats: c.seats || FOUNDING_SEATS,
      // what a manager has already spent is a fact; the books carry it from
      // the founding, so nobody can hide a purchase in an overdraft
      bank: FOUNDING_BANK - (+c.academy_paid || 0) - (+c.seats_paid || 0),
      sup: FOUNDING_SUPPORT, mood: 3, pts: 0, played: 0, form: [],
      gate: 0, awayCut: 0, sponsor: 0, wagesPaid: 0, upkeep: 0, interest: 0,
      compensation: 0, capsAway: 0,
      writtenOff: 0, admin: false, adminRounds: 0,
      atts: [], rounds: 0
    };
  }
  // the table as it stood that morning: 1 is top
  const posMap = () => {
    const order = clubs.map(c => S[c.slot]).sort((a, b) =>
      b.pts - a.pts || b.played - a.played || a.slot - b.slot);
    const m = {}; order.forEach((x, i) => { m[x.slot] = i + 1; });
    return m;
  };

  // group the matches into rounds, because a whole round settles at once
  const byRound = [];
  for (const m of ms) {
    const k = m.season_no + ':' + m.round;
    const last = byRound[byRound.length - 1];
    if (last && last.k === k) last.ms.push(m); else byRound.push({ k, ms: [m] });
  }

  for (const R of byRound) {
    const pos = posMap();
    const takings = {};                                   // slot -> money this round
    for (const c of clubs) takings[c.slot] = 0;
    for (const m of R.ms) {
      const H = S[m.home_slot], A = S[m.away_slot];
      if (!H || !A) continue;
      const w = weatherOf(m.seed != null ? m.seed : m.id);
      const att = clamp(Math.round(H.sup * moodMult(H.mood) * drawMult(A, pos[A.slot]) * w.mult), 600, H.seats);
      const gate = att * TICKET;
      const home = Math.round(gate * HOME_CUT), away = gate - Math.round(gate * HOME_CUT);
      H.gate += home; H.atts.push(att); H.lastAtt = att; H.lastWeather = w.word;
      A.awayCut += away;
      takings[H.slot] += home; takings[A.slot] += away;
    }
    // every club that played takes its sponsor money, pays its men and its
    // academy, and then answers to the bank
    const playing = new Set();
    for (const m of R.ms) { playing.add(m.home_slot); playing.add(m.away_slot); }
    for (const slot of playing) {
      const c = S[slot];
      // a club already under administration signs a distressed deal: the
      // sponsor stays, but for half of what he would otherwise pay
      const sp = Math.round(sponsorOf(pos[slot], c.mood, N) * (c.admin ? ADMIN_SPONSOR : 1));
      const up = c.academy * ACADEMY_UPKEEP;
      const f = feeAt[R.ms[0].season_no + ':' + R.ms[0].round + ':' + slot];
      const comp = f ? f.paid : 0;
      c.sponsor += sp; c.wagesPaid += c.wages; c.upkeep += up; c.rounds++;
      c.compensation += comp; c.capsAway += f ? f.men : 0;
      if (c.admin) c.adminRounds++;
      c.bank += takings[slot] + sp + comp - c.wages - up;
      if (c.bank < 0) { const i = Math.round(-c.bank * DEBT_ROUND); c.interest += i; c.bank -= i; }
      // THE FLOOR. Nothing sinks past what the club was founded with; what
      // would have gone deeper is written off, and the club is under.
      if (c.bank < -DEBT_LIMIT) { c.writtenOff += (-DEBT_LIMIT) - c.bank; c.bank = -DEBT_LIMIT; }
      c.admin = c.bank <= -DEBT_LIMIT;
    }
    // the result, and what it does to the mood and the crowd
    for (const m of R.ms) {
      const H = S[m.home_slot], A = S[m.away_slot];
      if (!H || !A) continue;
      const wn = m.winner;
      const hp = wn == null ? 1 : wn === m.home_name ? 2 : 0;
      const ap = wn == null ? 1 : wn === m.away_name ? 2 : 0;
      H.pts += hp; A.pts += ap; H.played++; A.played++;
      H.form.push(hp); A.form.push(ap);
      if (H.form.length > 5) H.form.shift();
      if (A.form.length > 5) A.form.shift();
    }
    const pos2 = posMap();
    for (const slot of playing) {
      const c = S[slot];
      c.mood = moodOf(c.form, pos2[slot], N);
      const t = supportTarget(c.mood, pos2[slot], N);
      c.sup = clamp(Math.round(c.sup + (t - c.sup) * 0.18), 4000, 60000);
    }
  }

  return clubs.map(c => {
    const s = S[c.slot];
    const avg = s.atts.length ? Math.round(s.atts.reduce((a, b) => a + b, 0) / s.atts.length) : 0;
    return {
      slot: c.slot, bank: Math.round(s.bank),
      finance: {
        supporters: s.sup, mood: s.mood, moodWord: MOOD_WORD[s.mood],
        seats: s.seats, lastAttendance: s.lastAtt || 0, lastWeather: s.lastWeather || null,
        avgAttendance: avg, ticket: TICKET,
        gate: s.gate, awayCut: s.awayCut, sponsor: s.sponsor,
        compensation: s.compensation, capsAway: s.capsAway,
        wages: s.wagesPaid, wageBill: s.wages, upkeep: s.upkeep, interest: s.interest,
        academyPaid: +c.academy_paid || 0, seatsPaid: +c.seats_paid || 0,
        writtenOff: s.writtenOff, administration: s.admin, adminRounds: s.adminRounds,
        debtLimit: DEBT_LIMIT,
        founded: FOUNDING_BANK, rounds: s.rounds,
        nextSeats: s.seats < MAX_SEATS ? s.seats + 1000 : null,
        nextSeatsCost: s.seats < MAX_SEATS ? seatBlockPrice(s.seats) : null
      }
    };
  });
}

// settle it into the clubs table: the bank a manager reads and the books
// behind it, both rebuilt from the record and never incremented
export async function settleMoney(pool, country) {
  const rows = await computeFinance(pool, country);
  for (const r of rows) {
    await pool.query('UPDATE clubs SET bank=$3, finance=$4::jsonb WHERE country_id=$1 AND slot=$2',
      [country, r.slot, r.bank, JSON.stringify(r.finance)]);
  }
  return rows.length;
}
