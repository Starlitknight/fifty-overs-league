// living.mjs — THE LIVING PLAYER.
//
// Every cricketer in the served world used to be frozen at the instant he
// was generated: forever steady, forever rested, forever as experienced as
// the day he was born. This module gives him a life. From the complete
// record of banked matches - and nothing else - it derives, for every man
// in every squad on earth:
//
//   career   what he has actually done: caps, runs, best score, wickets,
//            best figures. Append-only history; the almanack only grows.
//   exp      experience earned by playing. Young men learn faster.
//   formIx   the last five games, 0 (abysmal) to 6 (excellent).
//   fatN     tiredness: a day's work adds to it, a day off takes it away.
//
// It is a PURE FUNCTION of the record plus the world day - recomputed from
// genesis on every tick, so it can never drift, exactly like the standings
// and the rankings. Friendlies leave no mark: they are exhibition matches,
// which also means nobody can farm form in them.
//
// Determinism is protected by RECORDING, not by freezing: each match banks
// the living patch it was played with (name -> {e,f,n}), so the theatre can
// re-derive the generated squad, lay the patch over it, and replay the
// identical match forever after.
import { dayIx } from './clock.mjs';

const FORMW = ['abysmal', 'poor', 'shaky', 'steady', 'good', 'strong', 'excellent'];
const EXPLAD = ['atrocious', 'dreadful', 'poor', 'ordinary', 'average', 'reasonable',
  'capable', 'reliable', 'accomplished', 'expert', 'spectacular', 'elite'];

// the same ladders the engine reads (engine/src/09-up4.js, 00-core.js)
export function fatWordOf(n) {
  n = +n || 0;
  return n >= 96 ? 'clinically dead' : n >= 88 ? 'shattered' : n >= 78 ? 'exhausted'
    : n >= 68 ? 'listless' : n >= 56 ? 'weary' : n >= 44 ? 'moderate'
    : n >= 34 ? 'satisfactory' : n >= 24 ? 'passable' : n >= 14 ? 'energetic'
    : n >= 5 ? 'revived' : 'rested';
}
export function expWordOf(e) {
  return EXPLAD[Math.max(0, Math.min(EXPLAD.length - 1, Math.floor((e || 0) / 9)))];
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// A DAY'S CRICKET COSTS SOMETHING, A NIGHT'S REST PAYS MOST OF IT BACK.
// Calibrated on the daily calendar: a batsman recovers faster than he tires,
// so he is always fresh; a bowler who sends down his full ten every round of
// an 18-round season drifts to 'satisfactory' and beyond, and one rest day
// in four keeps him sharp. Rotation is an edge a manager can take, never a
// cliff an absent one falls off - which is why it is capped well short of
// the ladder's bottom rungs.
const REST_PER_DAY = 17;
const LOAD_BASE = 6, LOAD_PER_OVER = 1.3, LOAD_PER_BALL_FACED = 0.025;
const FAT_CEILING = 80;

export function livingPatch(squad) {
  const o = {};
  (squad || []).forEach(p => {
    if (!p || !p.name) return;
    const rec = { e: Math.round(p.exp ?? 55), f: p.formIx ?? 3, n: Math.round(p.fatN ?? 0) };
    // the nets change what a man IS, so any skill that has moved off its
    // generated baseline rides in the patch too - otherwise a broadcast
    // would field the untrained version of a trained cricketer
    if (p.baseSkills && p.skills) {
      const s = {};
      for (const k in p.skills) if (p.skills[k] !== p.baseSkills[k]) s[k] = p.skills[k];
      if (Object.keys(s).length) rec.s = s;
    }
    o[p.name] = rec;
  });
  return o;
}

// lay a recorded patch back over a generated squad — the client does exactly
// this before replaying a broadcast, so both sides run the identical men.
// Pass the host when skills may have moved: every rating derived from them
// has to be remade by the engine's own mapping.
export function applyLiving(squad, patch, host) {
  if (!squad || !patch) return squad;
  let skilled = false;
  squad.forEach(p => {
    const L = patch[p && p.name]; if (!L) return;
    if (L.e != null) { p.exp = L.e; p.expWord = expWordOf(L.e); }
    if (L.f != null) { p.formIx = L.f; p.formWord = FORMW[L.f] || 'steady'; }
    if (L.n != null) { p.fatN = L.n; p.fatWord = fatWordOf(L.n); p.fatigue = p.fatWord; }
    if (L.s) { skilled = true; for (const k in L.s) if (p.skills) p.skills[k] = L.s[k]; }
  });
  if (skilled && host && host.derive) {
    const out = host.derive(squad);
    out.forEach((q, i) => Object.assign(squad[i], q));
  }
  return squad;
}

// what one man did in one match, scored as a performance: roughly 0 (did
// nothing) to 4 (a match-winning day). Only innings he was actually part of
// count - a specialist batsman is never marked down for not bowling.
function ratePerformance(a) {
  let pts = 0, touched = false;
  if (a.balls >= 8) {
    touched = true;
    pts += Math.min(2.4, a.runs / 25);
    if (a.runs >= 50) pts += 0.4;
    if (a.runs < 8) pts -= 0.5;
  }
  if (a.ovb >= 12) {
    touched = true;
    const econ = 6 * a.conc / a.ovb;
    pts += a.wkts * 0.8 + (econ <= 4.5 ? 0.6 : econ >= 7.5 ? -0.5 : 0);
  }
  return touched ? Math.max(-0.5, pts) : 0.6;   // played, never got a chance
}
function formIxOf(apps) {
  if (!apps.length) return 3;
  const last = apps.slice(-5);
  const avg = last.reduce((s, a) => s + a.pts, 0) / last.length;
  return avg < 0.12 ? 0 : avg < 0.35 ? 1 : avg < 0.7 ? 2 : avg < 1.3 ? 3
    : avg < 2.1 ? 4 : avg < 3.0 ? 5 : 6;
}
function expGain(age, caps) {
  const per = age < 24 ? 0.5 : age < 30 ? 0.35 : 0.2;
  return Math.min(25, caps * per);
}

// THE NETS, RUN FROM THE RECORD OF PLANS ACTUALLY WORKED.
// A club's skills are its generated baseline plus every round of training it
// has genuinely done - the plan in force each round is banked by the umpire,
// so this is recomputable from genesis like everything else. The arithmetic
// itself belongs to the shipped engine (host.trainRound), so the nets a
// manager reads about and the nets the umpire runs are the same nets.
function baseline(p) {
  const q = { ...p };
  q.baseSkills = q.baseSkills || JSON.parse(JSON.stringify(q.skills || {}));
  q.skills = JSON.parse(JSON.stringify(q.baseSkills));
  delete q.trainProgress;
  return q;
}
// a man works the rounds he was at the club for and no others: a boy who comes
// up out of the academy in season three is not handed three seasons of other
// men's nets. Everyone the world made at the founding has no joining round and
// so has been there all along.
function wasHere(p, r) {
  const j = p.joined;
  if (!j) return true;
  return r.season_no > j.s || (r.season_no === j.s && r.round >= j.r);
}
async function trainedSquad(pool, host, country, slot, squad) {
  if (!host || !host.trainRound) return squad;
  const rounds = (await pool.query(
    `SELECT season_no, round, plan FROM training_rounds WHERE country_id=$1 AND slot=$2
      ORDER BY season_no, round`, [country, slot])).rows;
  let men = (squad || []).map(baseline);
  for (const r of rounds) {
    const here = [];
    men.forEach((p, i) => { if (wasHere(p, r)) here.push(i); });
    if (!here.length) continue;
    const worked = host.trainRound(here.map(i => men[i]), r.plan || {}).players;
    here.forEach((i, k) => { men[i] = worked[k]; });
  }
  return men;
}

// EVERY MAN'S LIFE, RECOMPUTED FROM THE WHOLE RECORD OF ONE COUNTRY.
export async function evolveCountry(pool, country, now = Date.now(), host = null) {
  const clubs = (await pool.query(
    'SELECT slot, name, squad FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  if (!clubs.length) return 0;
  const seasons = (await pool.query(
    'SELECT season_no, start_day FROM seasons WHERE country_id=$1', [country])).rows;
  const startOf = Object.fromEntries(seasons.map(s => [s.season_no, s.start_day]));
  // EXTRACT IN THE DATABASE, NOT OVER THE WIRE. A season's match blobs are
  // tens of megabytes (each carries whole player objects); the scorecard
  // lines we need are a few hundred kilobytes. Postgres unpacks them.
  const args = [country];
  const teamSlot = which => `CASE WHEN inn->>'${which}' = coalesce(m.home_name, h.name) THEN m.home_slot
                                  WHEN inn->>'${which}' = coalesce(m.away_name, a.name) THEN m.away_slot END`;
  const from = `FROM matches m
      JOIN clubs h ON h.country_id = m.country_id AND h.slot = m.home_slot
      JOIN clubs a ON a.country_id = m.country_id AND a.slot = m.away_slot,
      LATERAL jsonb_array_elements(m.result->'innings') inn`;
  const bats = (await pool.query(
    `SELECT m.season_no, m.round, ${teamSlot('batTeam')} AS slot, b->'p'->>'name' AS name,
            coalesce((b->>'r')::int, 0) AS runs, coalesce((b->>'b')::int, 0) AS balls
       ${from}, LATERAL jsonb_array_elements(inn->'bat') b
      WHERE m.country_id = $1 AND m.result IS NOT NULL AND b->'p'->>'name' IS NOT NULL`, args)).rows;
  const bowls = (await pool.query(
    `SELECT m.season_no, m.round, ${teamSlot('bowlTeam')} AS slot, bw.key AS name,
            coalesce((bw.value->>'w')::int, 0) AS wkts,
            coalesce((bw.value->>'r')::int, 0) AS conc,
            coalesce((bw.value->>'b')::int, 0) AS ovb
       ${from}, LATERAL jsonb_each(inn->'bowlers') bw
      WHERE m.country_id = $1 AND m.result IS NOT NULL`, args)).rows;
  const today = dayIx(now);

  // slot -> name -> { caps, career, apps[] }
  const book = new Map();
  const rec = (slot, name) => {
    if (!book.has(slot)) book.set(slot, new Map());
    const m = book.get(slot);
    if (!m.has(name)) m.set(name, { caps: 0, apps: [],
      car: { m: 0, runs: 0, balls: 0, hs: 0, wkts: 0, conc: 0, ovb: 0, bb: null } });
    return m.get(name);
  };

  // one man, one match, one line - however many innings he appeared in
  const lines = new Map();
  const at = (r, extra) => {
    if (r.slot == null || !r.name) return null;
    const k = r.season_no + '|' + r.round + '|' + r.slot + '|' + r.name;
    if (!lines.has(k)) lines.set(k, { season: r.season_no, round: r.round, slot: r.slot, name: r.name,
      runs: 0, balls: 0, hs: 0, wkts: 0, conc: 0, ovb: 0 });
    return Object.assign(lines.get(k), extra);
  };
  for (const r of bats) {
    const L = at(r); if (!L) continue;
    L.runs += r.runs; L.balls += r.balls;
    if (r.runs > L.hs) L.hs = r.runs;
  }
  for (const r of bowls) {
    const L = at(r); if (!L) continue;
    L.wkts += r.wkts; L.conc += r.conc; L.ovb += r.ovb;
  }
  const ordered = Array.from(lines.values()).sort((x, y) =>
    x.season - y.season || x.round - y.round || x.slot - y.slot || (x.name < y.name ? -1 : 1));
  for (const L of ordered) {
    const day = (startOf[L.season] ?? 0) + L.round - 1;
    const e = rec(L.slot, L.name);
    e.caps++;
    const c = e.car;
    c.m++; c.runs += L.runs; c.balls += L.balls; c.wkts += L.wkts; c.conc += L.conc; c.ovb += L.ovb;
    if (L.hs > c.hs) c.hs = L.hs;
    if (L.ovb > 0 && (!c.bb || L.wkts > c.bb.w || (L.wkts === c.bb.w && L.conc < c.bb.r))) c.bb = { w: L.wkts, r: L.conc };
    e.apps.push({ day, pts: ratePerformance(L),
      load: LOAD_BASE + (L.ovb / 6) * LOAD_PER_OVER + L.balls * LOAD_PER_BALL_FACED });
  }

  let touched = 0;
  for (const club of clubs) {
    const men = book.get(club.slot) || new Map();
    // the nets first: skills are the baseline plus every round genuinely
    // worked, so what the man is comes before what the season did to him
    const trained = await trainedSquad(pool, host, country, club.slot, club.squad);
    const squad = trained.map(p => {
      const q = { ...p };
      const base = q.baseExp == null ? (q.exp ?? 55) : q.baseExp;
      q.baseExp = base;
      const e = men.get(q.name);
      if (!e) {
        q.exp = Math.round(base); q.expWord = expWordOf(q.exp);
        q.formIx = 3; q.formWord = FORMW[3];
        q.fatN = 0; q.fatWord = fatWordOf(0); q.fatigue = q.fatWord;
        delete q.career;
        return q;
      }
      q.exp = Math.round(clamp(base + expGain(q.age || 27, e.caps), 0, 99));
      q.expWord = expWordOf(q.exp);
      q.formIx = formIxOf(e.apps);
      q.formWord = FORMW[q.formIx];
      let fat = 0, last = null;
      for (const a of e.apps) {
        if (last != null) fat = Math.max(0, fat - REST_PER_DAY * (a.day - last));
        fat = Math.min(FAT_CEILING, fat + a.load);
        last = a.day;
      }
      // credited to the NEXT day of cricket, because a man sleeps before he
      // plays again - so the state we store IS the state he walks out with,
      // and it equals what this same loop computes for that next match
      if (last != null) fat = Math.max(0, fat - REST_PER_DAY * Math.max(0, today + 1 - last));
      q.fatN = Math.round(clamp(fat, 0, FAT_CEILING));
      q.fatWord = fatWordOf(q.fatN); q.fatigue = q.fatWord;
      q.career = e.car;
      return q;
    });
    await pool.query('UPDATE clubs SET squad=$3::jsonb WHERE country_id=$1 AND slot=$2',
      [country, club.slot, JSON.stringify(squad)]);
    touched++;
  }
  return touched;
}

export async function evolveWorld(pool, now = Date.now()) {
  const cs = (await pool.query('SELECT id FROM countries ORDER BY id')).rows;
  let n = 0;
  for (const c of cs) n += await evolveCountry(pool, c.id, now);
  return n;
}
