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
import { dayIx, dayOfRound } from './clock.mjs';
import { fantasyPoints, ratePoints, squadStrength } from './ratings.mjs';
import { youthPot } from './youth.mjs';

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

// A DAY'S CRICKET COSTS WHAT THE DAY ASKED OF THE MAN, AND EVERY NIGHT
// REPAYS A FRACTION OF WHATEVER STANDS. The old model refunded a flat 17 a
// night against a full bowling shift's ~19 - on a daily calendar nobody ever
// stayed tired, and after two league matches a whole squad still read 100.
// Now the drain is the workload itself, weighted by trade: fast and seam
// bowling costs the most per over, spin less, a day behind the stumps has
// its own bill, facing costs by the ball, everyone pays a base for a
// hundred overs in the field, and the captain pays for carrying the side.
// Recovery is PROPORTIONAL - each night takes back a third of what stands -
// so a hammered fast bowler needs several quiet days, not one, while a
// batsman is near-fresh by morning. Steady states on the daily calendar:
// a seamer bowling his full ten every single day settles around 55-60
// ('weary'), one rest day in three keeps him under 40; a specialist bat
// hovers in the teens. Capped short of the ladder's bottom rungs so an
// unmanaged club degrades, never dies.
const REST_FRACTION = 0.35;
const LOAD_BASE = 6;                       // a full day in the field
const LOAD_PACE_PER_OVER = 2.4;            // fast and seam
const LOAD_SPIN_PER_OVER = 1.5;
const LOAD_PER_BALL_FACED = 0.05;
const LOAD_KEEPING = 7;                    // a hundred overs behind the stumps
const LOAD_CAPTAINCY = 4;                  // the armband is work too
const FAT_CEILING = 80;

// The patch also carries ABSENCE. A man away with his country was not in the
// eleven the umpire picked from, and the broadcast rebuilds squads from their
// world seeds - so unless the parcel says he was gone, a phone would field
// him. {a:true} means he was not there; applyLiving takes him off the sheet.
export function livingPatch(squad, absent) {
  const o = {};
  const away = absent instanceof Set ? absent : new Set(absent || []);
  (squad || []).forEach(p => {
    if (!p || !p.name) return;
    const rec = { e: Math.round(p.exp ?? 55), f: p.formIx ?? 3, n: Math.round(p.fatN ?? 0) };
    if (away.has(p.name)) rec.a = true;
    // the nets change what a man IS, so any skill that has moved off its
    // generated baseline rides in the patch too - otherwise a broadcast
    // would field the untrained version of a trained cricketer
    if (p.baseSkills && p.skills) {
      const s = {};
      for (const k in p.skills) if (p.skills[k] !== p.baseSkills[k]) s[k] = p.skills[k];
      if (Object.keys(s).length) rec.s = s;
    }
    // AND WHAT HE IS PART OF THE WAY TO. A half-learnt talent fires on a
    // fraction of the balls it suits, so it is part of the cricket that was
    // played: a replay without it is a different match, and the almanack's
    // "every ball of the replay is the banked match" says so at once. The
    // earned one rides in p.talents already, but it is named here too so a
    // broadcast can show the man who has just come by his.
    if (p.talProg && Object.keys(p.talProg).length) rec.tp = p.talProg;
    if (p.talEarned) rec.te = p.talEarned;
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
  // THE PATCH IS THE WHOLE TRUTH ABOUT TALENT STATE THAT DAY, for every man in
  // the side and not only the ones it happens to mention. A replay is laid over
  // the club's squad AS IT STANDS NOW: a man may have earned a talent since, or
  // have progress the record has credited him since, or have joined after the
  // match and have no patch entry at all. Any of those puts a cricketer on the
  // field who is not the one who played. So everything talent is stripped first
  // and then restored from the patch - it is the only version that cannot leak.
  squad.forEach(p => {
    if (!p) return;
    if (p.talEarned && Array.isArray(p.talents))
      p.talents = p.talents.filter(t => t !== p.talEarned);
    delete p.talEarned; delete p.talProg;
  });
  // anyone the patch marks as away was not available to be picked
  const away = squad.filter(p => p && patch[p.name] && patch[p.name].a);
  if (away.length) {
    const gone = new Set(away.map(p => p.name));
    squad = squad.filter(p => !gone.has(p && p.name));
  }
  squad.forEach(p => {
    const L = patch[p && p.name]; if (!L) return;
    if (L.e != null) { p.exp = L.e; p.expWord = expWordOf(L.e); }
    if (L.f != null) { p.formIx = L.f; p.formWord = FORMW[L.f] || 'steady'; }
    if (L.n != null) { p.fatN = L.n; p.fatWord = fatWordOf(L.n); p.fatigue = p.fatWord; }
    // AND THE WHOLE TRUTH ABOUT WHAT HE COULD DO, for exactly the reason the
    // talent state below is. The patch carries only the skills that had
    // ALREADY moved off his generated baseline by that afternoon - so a skill
    // he was still at baseline for THEN, and has trained up SINCE, has no
    // entry to correct him with, and the replay quietly fields the improved
    // cricketer. Put him back on his baseline first and lay the patch over
    // that: it is the same shape the talent strip-and-restore uses, and the
    // only one a later net cannot leak through. p3 said so - a whole innings
    // apart, and two clubs batting in a different order from the one the
    // book recorded, because a batting skill trained in September had walked
    // backwards into a match played in June.
    if (p.skills && (p.baseSkills || L.s)) {
      // and never write THROUGH the object we were handed: callers pass squads
      // built with a shallow spread, so the skills map is shared with the club
      // the replay was laid over
      p.skills = Object.assign({}, p.skills);
      if (p.baseSkills)
        for (const k in p.baseSkills)
          if (p.skills[k] !== p.baseSkills[k]) { p.skills[k] = p.baseSkills[k]; skilled = true; }
      if (L.s) { skilled = true; for (const k in L.s) p.skills[k] = L.s[k]; }
    }
    // THE PATCH IS THE AUTHORITY ON WHAT HE HAD LEARNED THAT DAY, in both
    // directions. Adding a talent back is the easy half; the half that matters
    // is taking one AWAY. A replay is laid over the club's squad AS IT STANDS
    // NOW, and a man who has earned a talent since carries it in his list - so
    // without this he bowls the replay with a gift he had not yet been given,
    // and the recorded card and the broadcast disagree. p3 said so: five
    // wickets in the replay against four in the book.
    if (L.tp) p.talProg = L.tp;
    if (L.te) {
      p.talEarned = L.te;
      if (!Array.isArray(p.talents)) p.talents = [];
      if (p.talents.indexOf(L.te) < 0) p.talents = p.talents.concat([L.te]);
    }
  });
  if (skilled && host && host.derive) {
    const out = host.derive(squad);
    out.forEach((q, i) => Object.assign(squad[i], q));
  }
  return squad;
}

// WHAT ONE MAN'S DAY WAS WORTH - the fantasy points a phone shows him on the
// ratings page, scored onto the scale form has always used. The two can never
// disagree, because there is only one number: a manager reading why his
// batsman is out of nick is reading the same arithmetic that put him there.
// Only innings he was actually part of count, so a specialist batsman is never
// marked down for not bowling.
function ratePerformance(a) {
  const line = { bat: [], bowlers: {}, fielding: {} };
  let touched = false;
  if (a.balls >= 8 || a.out) {
    touched = true;
    line.bat.push({ p: { name: a.name }, r: a.runs, b: a.balls, f4: a.f4 || 0, f6: a.f6 || 0, out: a.out || null });
  }
  if (a.ovb >= 12) { touched = true; line.bowlers[a.name] = { w: a.wkts, r: a.conc, b: a.ovb }; }
  if (a.ct || a.st || a.ro) { touched = true; line.fielding[a.name] = { ct: a.ct, st: a.st, ro: a.ro }; }
  if (!touched) return ratePoints(0, false);
  // one man alone on a card: every point scored here is his own
  const got = fantasyPoints([{ batTeam: 'x', bowlTeam: 'y', bat: line.bat, bowlers: line.bowlers, fielding: line.fielding }]);
  const mine = got.filter(g => g.n === a.name)[0];
  return ratePoints(mine ? mine.pts : 0, true);
}
function formIxOf(apps) {
  if (!apps.length) return 3;
  const last = apps.slice(-5);
  const avg = last.reduce((s, a) => s + a.pts, 0) / last.length;
  return avg < 0.12 ? 0 : avg < 0.35 ? 1 : avg < 0.7 ? 2 : avg < 1.3 ? 3
    : avg < 2.1 ? 4 : avg < 3.0 ? 5 : 6;   // the scale ratePoints maps onto
}
// ---- EXPERIENCE IS THE YEARS, NOT THE DEAL --------------------------------
//
// A cricketer's experience used to be whatever number he was handed the
// instant he was made, and nothing ever reconciled it with his age again.
// Two things pulled the two apart:
//
//   - the founding cast (init-world.foundingCast) re-deals a new club's AGES
//     into a shape - one old pro, four local lads, a bench of raw kids - and
//     left every man's dealt experience where it was. It sorts oldest-first
//     before re-assigning, so the sixth-oldest man, dealt at twenty-six, came
//     out nineteen years old still carrying a twenty-six-year-old's
//     experience, and the youngest came out twenty-three carrying an
//     eighteen-year-old's. Anti-correlated, not merely uncorrelated.
//   - every rollover adds a year to every man (youth.ageYouth) and touches
//     nothing else, so the gap widened by a season every season.
//
// The generator was never wrong about it: foGenExp is (age-17) * 6.5 plus a
// little for quality and a little noise. A ladder rung is 9 points, so that
// is about three quarters of a rung a year with under two rungs of scatter -
// exactly the shape experience should have. Nothing downstream honoured it.
//
// So experience is derived here now, from the same slope, at the age the man
// IS today. It is the years he has been at it, plus a small fixed share of
// his own, plus what he has actually done. Because this module recomputes
// every squad on earth from genesis on every tick, the whole world comes
// right on the next fold without a migration touching a single row.
const EXP_START_AGE = 17;                  // a boy's first season in the game
const EXP_PER_YEAR = 6.5;                  // the generator's own slope: 0.72 of a rung
const EXP_PRIME_AGE = 30;                  // the oldest man the generator deals
const EXP_LATE = 1 / 3;                    // and the slope past him
const EXP_OWN = 7;                         // his own character, held inside a rung
const EXP_EARNED = 12;                     // and what the caps are worth: 1.3 rungs
// THE YEARS ALONE, on the 0-99 ladder. Straight at the generator's slope to
// thirty, which is the oldest man it deals, and a third of it after: cricket
// stops being new to a man long before he stops playing it, so the tail
// climbs without flattening into a wall of nine-nines from thirty-two on -
// and a veteran only reaches the top of the ladder by having played, which
// is what the caps below are for.
function expOfAge(age) {
  const a = clamp(+age || 27, EXP_START_AGE, 38);
  const yrs = a - EXP_START_AGE, prime = EXP_PRIME_AGE - EXP_START_AGE;
  return (Math.min(yrs, prime) + Math.max(0, yrs - prime) * EXP_LATE) * EXP_PER_YEAR;
}
// TWO MEN OF AN AGE ARE NOT IDENTICAL, but they are within a rung of each
// other. Seeded on the man's NAME, which is what this whole module keys a
// cricketer by and the one thing about him that never moves: a pid can be
// absent and backfilled later (backfill-pids runs every tick), and seeding on
// one would step a man's experience the morning his id arrived.
function expOwn(p) {
  let h = 2166136261 >>> 0;
  const s = String((p && (p.name || p.pid)) || '');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return ((h >>> 0) % 2001) / 1000 * EXP_OWN - EXP_OWN;      // -7 .. +7
}
// what a man reads at before he has played a ball for anybody: his years and
// his own share of it. The founding cast deals ages of its own choosing, so
// it asks this the moment it does, and a squad is never stored disagreeing
// with the number this module would derive for it anyway.
export function expOfYears(p) {
  return Math.round(clamp(expOfAge(p && p.age) + expOwn(p), 2, 99));
}
// AND WHAT HE HAS ACTUALLY DONE. Young men learn faster, but no number of
// caps can carry a boy past the men: a season of first-team cricket is worth
// a rung and a bit, never the four rungs it used to be able to reach.
function expGain(age, caps) {
  const per = age < 24 ? 0.5 : age < 30 ? 0.35 : 0.2;
  return Math.min(EXP_EARNED, caps * per);
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
// THE BOOK OF THE NETS, kept without keeping anything.
//
// The charts on the training page want a man's whole past: what he was ten
// rounds ago, who has grown this season, where the work actually went. The
// obvious build is a new table the umpire writes to every round - and it
// would have no past in it on the day it shipped, and would be a second
// record of something the first record already determines.
//
// It does not need one. The replay below ALREADY walks every round this club
// has ever trained, in order, from the founding. Every step up a man ever
// took passes through it. So the history is collected on the way past: a step
// is { s, r, n, k, to } - season, round, man, skill, the figure he reached -
// and the programme each man worked that round is tallied alongside. From the
// baseline skills plus the steps, any round's squad can be reconstructed
// exactly, which means every chart draws from genesis on the day it ships and
// nothing new is stored that a re-run could not rebuild.
//
// Steps are sparse by nature - a skill needs eighty to two hundred points to
// move and a session banks about twenty-four - so a club's whole book is a
// few hundred entries, not tens of thousands.
const HIST_STEPS = 4000;                       // a hard ceiling, oldest dropped
//
// AND THE BOYS TRAIN TOO (059). The academy was a waiting room: the umpire
// replayed club.squad and nothing else, so a colt aged a year at every
// rollover and walked out at twenty-one exactly the cricketer who walked in -
// while the training page happily took a programme for him and filed it, and
// the umpire silently threw it away. docs/ACADEMY.md always said a boy
// becomes what the ordinary training curve makes of him. Now he does.
//
// Both crews are replayed against the SAME banked rounds, in one pass, so a
// boy's academy years and a man's senior years are the same nets by the same
// arithmetic - and the boys, being sixteen to twenty, sit on the steepest part
// of the age curve, which is the whole reason to own an academy.
async function trainedSquad(pool, host, country, slot, squad, hist = null, youth = null) {
  if (!host || !host.trainRound) return { squad: squad, youth: youth || [] };
  const rounds = (await pool.query(
    `SELECT season_no, round, plan, academy, coach, xi FROM training_rounds WHERE country_id=$1 AND slot=$2
      ORDER BY season_no, round`, [country, slot])).rows;
  // A MAN WORKS EACH ROUND AT THE AGE HE WAS THAT ROUND. The nets rate is
  // steeply age-dependent, and a cricketer ages a year at every rollover - so
  // replaying his whole history at today's age would quietly re-rate every
  // session he ever did, and a squad would get weaker retroactively as it got
  // older. Everybody ages once a season, so the age he was in season S is
  // simply today's age less the seasons since. Training is a pure function of
  // the record again.
  const latest = +(await pool.query(
    'SELECT max(season_no) AS s FROM seasons WHERE country_id=$1', [country])).rows[0].s || 1;
  // and a man with his country did not work in his club's nets that week
  let away = new Set();
  try {
    away = new Set((await pool.query(
      `SELECT season_no, round, player FROM callups WHERE country_id=$1 AND slot=$2`, [country, slot]))
      .rows.map(r => r.season_no + '|' + r.round + '|' + r.player));
  } catch (eC) { away = new Set(); }             // pre-023 database: nobody has been called up
  let men = (squad || []).map(baseline);
  let boys = (youth || []).map(baseline);
  for (const r of rounds) {
    const back = Math.max(0, latest - r.season_no);
    // THE NETS REPLAY IS TIMELESS. The engine's nets rate reads a man's
    // legs, and these crews would otherwise carry TODAY'S legs - a replay
    // of last month's session re-rated by how tired he happens to be this
    // morning, and the squad stops being a pure function of the record
    // (harmless while everyone was always rested; fatal now that fatigue
    // is real). Every replayed session works a rested copy of the man;
    // the standing plan-intensity load below is where tiredness and the
    // nets actually meet.
    // ONE ROUND, RUN FOR A CREW. The men and the boys are two crews because
    // the match-day rule is a fact about SELECTION: a senior left out of the
    // eleven trained at half pace that day, and a sixteen-year-old was never
    // in contention to be left out of anything. So the boys are worked with
    // no teamsheet at all - full session, every round they were here for.
    const runCrew = (pool2, xi, isBoys) => {
      const here = [];
      pool2.forEach((p, i) => {
        if (wasHere(p, r) && !away.has(r.season_no + '|' + r.round + '|' + p.name)) here.push(i);
      });
      if (!here.length) return null;
      const crew = here.map(i => Object.assign({}, pool2[i],
        back ? { age: Math.max(16, (pool2[i].age || 27) - back) } : null,
        { fatN: 0, fatWord: 'rested', fatigue: 'rested' },
        // THE HIDDEN RATE rides the crew copy and only the crew copy: a boy
        // trains at his seeded pace, and the rate is stripped again below so
        // no read surface ever serves it. Seniors never carry one.
        isBoys ? { __ypot: youthPot(pool2[i]) } : null));
      const res = host.trainRound(crew, r.plan || {},
        academyRate(r.academy) * coachRate(r.coach), xi);
      // the work is his; the age he is today is still today's - and the
      // rate goes back in the drawer
      here.forEach((i, k) => {
        pool2[i] = Object.assign({}, res.players[k], { age: pool2[i].age });
        delete pool2[i].__ypot;
      });
      return res;
    };
    const out = runCrew(men, Array.isArray(r.xi) ? r.xi : null, false);
    const outY = boys.length ? runCrew(boys, null, true) : null;
    if (!out && !outY) continue;
    if (hist) {
      for (const res of [out, outY]) {
        for (const g of ((res && res.gains) || [])) {
          hist.steps.push({ s: r.season_no, r: r.round, n: g.name, k: g.skill, to: g.to });
        }
      }
      // and what the squad was set to that round, so "where the work went" is
      // read off the sessions actually worked. The engine REPORTS this rather
      // than the walk inferring it from the plan: a plan need not name every
      // man, and re-deriving the fallback here would be a second copy of the
      // engine's defaultProg waiting to disagree with the first.
      const tally = {};
      for (const res of [out, outY]) {
        for (const nm in ((res && res.worked) || {})) {
          const pg = res.worked[nm] && res.worked[nm].p;
          if (pg) tally[pg] = (tally[pg] || 0) + 1;
        }
      }
      if (Object.keys(tally).length) hist.rounds.push({ s: r.season_no, r: r.round, p: tally, a: r.academy });
    }
  }
  if (hist && hist.steps.length > HIST_STEPS) hist.steps = hist.steps.slice(-HIST_STEPS);
  return { squad: men, youth: boys };
}
// WHAT THE ACADEMY BUYS IN THE NETS. Level two is the rate the world was
// founded at, so it is the unit; every level either side is eight per cent.
// The level in force is banked with the plan in force, round by round, which
// is the only reason a building can change training and the squad still be a
// pure function of the record.
// THE LADDER RUNS TO TEN. One to five keep their exact former rates - not a
// courtesy, a requirement: every round already banked carries the level in
// force that week and is replayed through this function, so moving any rung
// below six would silently re-price sessions worked months ago. Six upward is
// new ground nobody has stood on, and each is five per cent on the one below.
export const ACADEMY_MAX = 10;
export function academyRate(level) {
  const lv = Math.max(1, Math.min(ACADEMY_MAX, +level || 2));
  return lv <= 5 ? 1 + 0.08 * (lv - 2) : 1.24 + 0.05 * (lv - 5);
}
// WHAT THE HEAD COACH BUYS IN THE NETS (051). Seven per cent a level, on top
// of the building: no coach is the unit, so every round banked before he was
// hired replays exactly as it always did. The level in force is banked with
// the plan in force, round by round, same as the academy.
export function coachRate(level) {
  return 1 + 0.07 * Math.max(0, Math.min(5, +level || 0));
}

// A CAREER FOLLOWS THE MAN. The living layer derives a cricketer's book from
// the matches his CURRENT club has played, so a transfer would otherwise hand
// him a blank page at his new ground - four hundred first-class runs erased
// by a cheque. The market freezes what he had onto him as a carry when he
// moves; this adds it back on top of whatever he does from here.
const CAR_SUM = ['m', 'inns', 'no', 'runs', 'balls', 'f4', 'f6', 'h50', 'h100',
  'wkts', 'conc', 'ovb', 'mdn', 'w3', 'w5', 'ctf', 'ctwk', 'st', 'ro'];
export function withCarry(book, carry) {
  const b = book || { m: 0, runs: 0, balls: 0, hs: 0, wkts: 0, conc: 0, ovb: 0, bb: null };
  if (!carry || !carry.m) return b;
  // a carried record from before the fold knew these columns simply has none
  // of them, which adds nothing - the truth about a man nobody was counting
  const o = { hs: Math.max(b.hs || 0, carry.hs || 0), bb: b.bb || null };
  for (const k of CAR_SUM) o[k] = (b[k] || 0) + (carry[k] || 0);
  const cb = carry.bb;
  if (cb && (!o.bb || cb.w > o.bb.w || (cb.w === o.bb.w && cb.r < o.bb.r))) o.bb = cb;
  return o;
}

// EVERY MAN'S LIFE, RECOMPUTED FROM THE WHOLE RECORD OF ONE COUNTRY.
// WHAT HE HAS LEARNED, AND WHETHER HE HAS LEARNED IT.
//
// Progress is a pure fold of the record - the triggers this club's matches
// credited him with - so it is recomputed from nothing on every settle and a
// re-settle lands on the same figure. Crossing a threshold turns the talent
// from a chance into his: it joins the list on his card, and the ball engine
// stops rolling for it because he simply has it.
//
// ONE A CAREER. A man accrues toward several at once - an opener is inside
// the first twelve balls, playing pace, and running singles, all on the same
// delivery - and the one he earns is the one he crossed most decisively.
// After that the engine stops counting for him entirely, so the second is
// never in reach: what is rare has to stay rare to be worth anything.
export function talentsEarned(q, prog, talT) {
  // WHAT HE BROUGHT WITH HIM. A club's fold only sees the matches THIS club
  // has played, so a man who was bought, or a boy who was handed a senior
  // shirt, would arrive with his progress wiped - exactly the reason a career
  // is frozen onto a transfer as a carry. talCarry is that same freeze: it is
  // added to the fold, never recomputed, and it is what makes two seasons of
  // Colts Cup mean something on the morning he is promoted.
  const carry = (q.talCarry && typeof q.talCarry === 'object') ? q.talCarry : null;
  if (carry) {
    prog = Object.assign({}, prog || {});
    for (const t of Object.keys(carry)) prog[t] = (prog[t] | 0) + (carry[t] | 0);
  }
  if (!prog || !Object.keys(prog).length) { delete q.talProg; return q; }
  const own = Array.isArray(q.talents) ? q.talents : [];
  const kept = {};
  for (const t of Object.keys(prog)) if (own.indexOf(t) < 0) kept[t] = prog[t] | 0;
  if (!Object.keys(kept).length) { delete q.talProg; return q; }
  q.talProg = kept;
  if (q.talEarned) return q;                     // he has had his
  let best = null, bestR = 1;
  for (const t of Object.keys(kept)) {
    const T = talT[t] || 0; if (!T) continue;
    const r = kept[t] / T;
    if (r >= 1 && r > bestR - 1e-9 && (best === null || r > bestR || (r === bestR && t < best))) { best = t; bestR = r; }
  }
  if (!best) return q;
  q.talEarned = best;
  q.talents = own.concat([best]);
  // the progress that earned it stops being progress - it is a talent now
  delete q.talProg[best];
  if (!Object.keys(q.talProg).length) delete q.talProg;
  return q;
}

// THE FOLD HAS A VERSION, AND WHEN IT CHANGES THE WORLD IS REFOLDED.
//
// Everything below is a derivation: it replays a country's whole record on
// every settle, which is what lets a column added today arrive filled for
// matches played a hundred seasons ago. That promise is only kept if the
// derivation is actually redone - and it runs INSIDE a day's settle, behind
// a per-day lock that never reruns a day already marked done. So on the day
// the fold learns to write something new, every club in the world goes on
// serving the old shape until its next world day comes due, which can be
// most of a day away. A man who played yesterday reads as a man who has
// never played.
//
// Bump this whenever the fold's OUTPUT changes, and runDue refolds each
// country once - one cheap read per tick forever after. Do not bump it for
// a change that cannot alter what a squad row says.
//   1  the fold as it stood
//   2  a man's milestones (his story so far) ride with his record
//   3  experience is the years a man has been at it, not the number he was
//      dealt the day he was made
export const LIVING_VERSION = 3;

// THE SAME CRICKETER, WRITTEN THE SAME WAY TWICE.
//
// jsonb does not keep the key order it was given - it stores its own - so a
// squad read back and a squad rebuilt in JavaScript serialise to different
// bytes while being the same squad in every respect. A plain string compare
// therefore called every club changed on every settle and saved nothing,
// which is exactly what the first cut of this did.
//
// So the comparison sorts keys at every level before it looks. It is used for
// NOTHING but the comparison: what gets written is still ordinary
// JSON.stringify, so the stored shape is untouched.
function canon(v) {
  return JSON.stringify(v, (k, val) =>
    (val && typeof val === 'object' && !Array.isArray(val))
      ? Object.keys(val).sort().reduce((o, kk) => { o[kk] = val[kk]; return o; }, {})
      : val);
}

export async function evolveCountry(pool, country, now = Date.now(), host = null) {
  const clubs = (await pool.query(
    'SELECT slot, name, squad, youth, training, best_xi_strength FROM clubs WHERE country_id=$1 ORDER BY slot',
    [country])).rows;
  if (!clubs.length) return 0;
  // whose clubs are managed - the nets report is written for them alone
  let claimedSlots = new Set();
  try {
    claimedSlots = new Set((await pool.query(
      'SELECT slot FROM claims WHERE country_id=$1', [country])).rows.map(r => r.slot));
  } catch (eCl) { claimedSlots = new Set(); }
  const seasons = (await pool.query(
    'SELECT season_no, start_day FROM seasons WHERE country_id=$1', [country])).rows;
  const startOf = Object.fromEntries(seasons.map(s => [s.season_no, s.start_day]));
  // EXTRACT IN THE DATABASE, NOT OVER THE WIRE. A season's match blobs are
  // tens of megabytes (each carries whole player objects); the scorecard
  // lines we need are a few hundred kilobytes. Postgres unpacks them.
  const args = [country];
  const teamSlot = which => `CASE WHEN inn->>'${which}' = coalesce(m.home_name, h.name) THEN m.home_slot
                                  WHEN inn->>'${which}' = coalesce(m.away_name, a.name) THEN m.away_slot END`;
  // the same resolution for a key that is already a side's name rather than a
  // field inside the innings blob
  const teamSlot2 = expr => `CASE WHEN ${expr} = coalesce(m.home_name, h.name) THEN m.home_slot
                                  WHEN ${expr} = coalesce(m.away_name, a.name) THEN m.away_slot END`;
  const from = `FROM matches m
      JOIN clubs h ON h.country_id = m.country_id AND h.slot = m.home_slot
      JOIN clubs a ON a.country_id = m.country_id AND a.slot = m.away_slot,
      LATERAL jsonb_array_elements(m.result->'innings') inn`;
  const bats = (await pool.query(
    `SELECT m.season_no, m.round, ${teamSlot('batTeam')} AS slot, b->'p'->>'name' AS name,
            coalesce((b->>'r')::int, 0) AS runs, coalesce((b->>'b')::int, 0) AS balls,
            coalesce((b->>'f4')::int, 0) AS f4, coalesce((b->>'f6')::int, 0) AS f6,
            b->>'out' AS out,
            -- the gloves, so a catch can be credited behind the stumps or in
            -- the field. The card banks the whole player object, so this has
            -- been readable on every match ever played.
            coalesce((b->'p'->>'keeper')::boolean, b->'p'->>'role' = 'wicketkeeper', false) AS wk
       ${from}, LATERAL jsonb_array_elements(inn->'bat') b
      WHERE m.country_id = $1 AND m.result IS NOT NULL AND b->'p'->>'name' IS NOT NULL`, args)).rows;
  const bowls = (await pool.query(
    `SELECT m.season_no, m.round, ${teamSlot('bowlTeam')} AS slot, bw.key AS name,
            coalesce((bw.value->>'w')::int, 0) AS wkts,
            coalesce((bw.value->>'r')::int, 0) AS conc,
            coalesce((bw.value->>'b')::int, 0) AS ovb,
            coalesce((bw.value->>'mdn')::int, 0) AS mdn
       ${from}, LATERAL jsonb_each(inn->'bowlers') bw
      WHERE m.country_id = $1 AND m.result IS NOT NULL`, args)).rows;
  const fields = (await pool.query(
    `SELECT m.season_no, m.round, ${teamSlot('bowlTeam')} AS slot, fd.key AS name,
            coalesce((fd.value->>'ct')::int, 0) AS ct,
            coalesce((fd.value->>'st')::int, 0) AS st,
            coalesce((fd.value->>'ro')::int, 0) AS ro
       ${from}, LATERAL jsonb_each(coalesce(inn->'fielding', '{}'::jsonb)) fd
      WHERE m.country_id = $1 AND m.result IS NOT NULL`, args)).rows;
  // WHAT THE MEN LEARNED, match by match. The card carries a tally keyed by
  // side and then by man - the same side key the innings use, so a slot
  // resolves the same way and a transfer between the match and this settle
  // cannot credit the wrong club. Cards banked before earned talents existed
  // have no tally at all, which folds to no progress: the truth about them.
  const tals = (await pool.query(
    `SELECT ${teamSlot2('side.key')} AS slot, man.key AS name, man.value AS tal
       FROM matches m
       JOIN clubs h ON h.country_id = m.country_id AND h.slot = m.home_slot
       JOIN clubs a ON a.country_id = m.country_id AND a.slot = m.away_slot,
       LATERAL jsonb_each(coalesce(m.result->'tal', '{}'::jsonb)) side,
       LATERAL jsonb_each(side.value) man
      WHERE m.country_id = $1 AND m.result IS NOT NULL`, args)).rows;

  // WHO WORE THE ARMBAND, match by match: the captain the banked orders name,
  // where a manager filed one. Clubs that filed nothing fall back below to
  // the engine's own default - the squad's best captaincy score.
  const capOf = new Map();
  try {
    const caps = (await pool.query(
      `SELECT m.season_no, m.round, m.home_slot, m.away_slot,
              coalesce(m.home_name, h.name) AS hn, coalesce(m.away_name, a.name) AS an, m.orders
         FROM matches m
         JOIN clubs h ON h.country_id = m.country_id AND h.slot = m.home_slot
         JOIN clubs a ON a.country_id = m.country_id AND a.slot = m.away_slot
        WHERE m.country_id = $1 AND m.result IS NOT NULL AND m.orders IS NOT NULL`, args)).rows;
    for (const r of caps) {
      const o = r.orders || {};
      const ho = o[r.hn], ao = o[r.an];
      if (ho && ho.captain) capOf.set(r.season_no + '|' + r.round + '|' + r.home_slot, ho.captain);
      if (ao && ao.captain) capOf.set(r.season_no + '|' + r.round + '|' + r.away_slot, ao.captain);
    }
  } catch (eCp) {}
  const today = dayIx(now);
  // the thresholds come off the shipped engine, never a copy: the ball loop
  // and the umpire have to agree about when a man has crossed
  const talT = host && host.talThresholds ? host.talThresholds() : {};

  // slot -> name -> { caps, career, apps[] }
  const book = new Map();
  const rec = (slot, name) => {
    if (!book.has(slot)) book.set(slot, new Map());
    const m = book.get(slot);
    // THE WHOLE OF A CAREER, not the headline of one. A record that could only
    // say matches, runs, best and wickets could never draw the two tables a
    // reader of cricket expects, and every figure below is already in the
    // banked cards - so the fold, which replays the entire record on every
    // settle, brings the past along with it.
    if (!m.has(name)) m.set(name, { caps: 0, apps: [], mile: [],
      car: { m: 0, inns: 0, no: 0, runs: 0, balls: 0, hs: 0, f4: 0, f6: 0, h50: 0, h100: 0,
        wkts: 0, conc: 0, ovb: 0, mdn: 0, w3: 0, w5: 0, bb: null,
        ctf: 0, ctwk: 0, st: 0, ro: 0 },
      intl: { m: 0, inns: 0, no: 0, runs: 0, balls: 0, hs: 0, f4: 0, f6: 0, h50: 0, h100: 0,
        wkts: 0, conc: 0, ovb: 0, mdn: 0, w3: 0, w5: 0, bb: null,
        ctf: 0, ctwk: 0, st: 0, ro: 0 } });
    return m.get(name);
  };

  // one man, one match, one line - however many innings he appeared in
  const lines = new Map();
  const at = (r, extra) => {
    if (r.slot == null || !r.name) return null;
    const k = r.season_no + '|' + r.round + '|' + r.slot + '|' + r.name;
    if (!lines.has(k)) lines.set(k, { season: r.season_no, round: r.round, slot: r.slot, name: r.name,
      runs: 0, balls: 0, hs: 0, wkts: 0, conc: 0, ovb: 0, mdn: 0,
      f4: 0, f6: 0, out: null, ct: 0, st: 0, ro: 0, wk: false, batted: false });
    return Object.assign(lines.get(k), extra);
  };
  for (const r of bats) {
    const L = at(r); if (!L) continue;
    L.runs += r.runs; L.balls += r.balls;
    L.f4 += r.f4 || 0; L.f6 += r.f6 || 0;
    if (r.wk) L.wk = true;
    // an innings is a man going out to bat, which the card shows as a ball
    // faced or a dismissal - the rest of the eleven are down as did not bat
    if ((r.balls | 0) > 0 || r.out) L.batted = true;
    if (r.out) L.out = r.out;
    if (r.runs > L.hs) L.hs = r.runs;
  }
  for (const r of fields) {
    const L = at(r); if (!L) continue;
    L.ct += r.ct || 0; L.st += r.st || 0; L.ro += r.ro || 0;
  }
  for (const r of bowls) {
    const L = at(r); if (!L) continue;
    L.wkts += r.wkts; L.conc += r.conc; L.ovb += r.ovb; L.mdn += r.mdn || 0;
  }
  // TRIGGERS, summed over everything he has played for this club. This is the
  // whole of "he is learning it": no state is carried forward, the record is
  // added up again from scratch on every settle, and a re-settle lands on the
  // identical number.
  const talBook = new Map();          // slot -> name -> {talent: triggers}
  for (const r of tals) {
    if (r.slot == null || !r.name || !r.tal) continue;
    if (!talBook.has(r.slot)) talBook.set(r.slot, new Map());
    const m = talBook.get(r.slot);
    const cur = m.get(r.name) || {};
    for (const t of Object.keys(r.tal)) cur[t] = (cur[t] | 0) + (r.tal[t] | 0);
    m.set(r.name, cur);
  }

  // AND THE CUPS. The Champions Cup and every nation's knockout are the same
  // fifty overs as a league round - the rule the manager was given is
  // "everything except a friendly" - and a cup tie names its two sides with a
  // country and a slot, so the credit lands on the right club without going
  // near a name.
  let cupRows = [];
  try {
    cupRows = (await pool.query(
      `SELECT a, b, result->'tal' AS tal FROM cup_matches
        WHERE result IS NOT NULL AND comp NOT LIKE 'colts:%'
          AND (a->>'country' = $1 OR b->>'country' = $1)`, args)).rows;
  } catch (eCu) { cupRows = []; }   // pre-cup database
  for (const r of cupRows) {
    if (!r.tal) continue;
    for (const side of [r.a, r.b]) {
      if (!side || side.country !== country || side.slot == null) continue;
      const men = r.tal[side.name]; if (!men) continue;
      if (!talBook.has(side.slot)) talBook.set(side.slot, new Map());
      const bk = talBook.get(side.slot);
      for (const nm of Object.keys(men)) {
        const cur = bk.get(nm) || {};
        for (const t of Object.keys(men[nm])) cur[t] = (cur[t] | 0) + (men[nm][t] | 0);
        bk.set(nm, cur);
      }
    }
  }


  // THE WEEK HE SPENT WITH HIS COUNTRY counts too. A cap is a different book
  // from a club career - a man's county record is not swollen by a tour - but
  // it is the same fifty overs: it tires his legs and it moves his form,
  // which is why a manager notices when the selectors take his opener. The
  // tours are few (nine ties a window), so they are read whole rather than
  // unpacked in SQL like a season of league blobs. And two cricketers in one
  // league can share a name, so a cap is credited from the CALLUP that
  // produced it - the selectors named a slot as well as a man - and never
  // from a guess off the name alone.
  let natRows = [], fromSlot = new Map();
  try {
    natRows = (await pool.query(
      `SELECT season_no, round, a_country, b_country, a_name, b_name, result
         FROM nat_matches WHERE a_country=$1 OR b_country=$1 ORDER BY season_no, round, id`, [country])).rows;
    (await pool.query(
      `SELECT season_no, round, slot, player FROM callups WHERE country_id=$1`, [country])).rows
      .forEach(r => fromSlot.set(r.season_no + '|' + r.round + '|' + r.player, r.slot));
  } catch (eN) { natRows = []; }                 // pre-023 database: no tours yet
  for (const m of natRows) {
    const mine = m.a_country === country ? m.a_name : m.b_name;
    const seen = new Map();
    const iat = name => {
      const slot = fromSlot.get(m.season_no + '|' + m.round + '|' + name);
      if (slot == null) return null;
      const k = m.season_no + '|' + m.round + '|' + slot + '|' + name;
      if (!seen.has(k)) seen.set(k, { season: m.season_no, round: m.round, slot, name, intl: true,
        runs: 0, balls: 0, hs: 0, wkts: 0, conc: 0, ovb: 0, f4: 0, f6: 0, out: null, ct: 0, st: 0, ro: 0 });
      return seen.get(k);
    };
    // A WEEK WITH HIS COUNTRY IS STILL FIFTY OVERS. It counts toward a talent
    // exactly as a league round does - everything except a friendly does - and
    // the credit goes to the CLUB he was called up from, which the callup row
    // names. A tour cannot teach a man something on somebody else's books.
    for (const nm of Object.keys((m.result && m.result.tal && m.result.tal[mine]) || {})) {
      const slot = fromSlot.get(m.season_no + '|' + m.round + '|' + nm);
      if (slot == null) continue;
      if (!talBook.has(slot)) talBook.set(slot, new Map());
      const bk = talBook.get(slot), cur = bk.get(nm) || {};
      const add = m.result.tal[mine][nm] || {};
      for (const t of Object.keys(add)) cur[t] = (cur[t] | 0) + (add[t] | 0);
      bk.set(nm, cur);
    }
    for (const inn of ((m.result && m.result.innings) || [])) {
      if (!inn) continue;
      // SELECTION IS THE APPEARANCE, not what came of it. Every line below adds
      // a man because he DID something, so a cricketer picked in the eleven who
      // was not needed with the bat, got no over and had nothing come to him was
      // never recorded as having played at all - nought matches, and a story
      // page telling him his first cap was still to come. The eleven is opened
      // first and every name in it gets its line; the figures then land on men
      // who already exist. Cards banked before the elevens were kept have none,
      // and those matches stay as they were recorded.
      const xiOf = inn.batTeam === mine ? inn.xi : inn.bowlTeam === mine ? inn.bxi : null;
      if (xiOf) for (const q of xiOf) { const nq = (q && q.name) || q; if (nq) iat(nq); }
      if (inn.batTeam === mine) for (const b of (inn.bat || [])) {
        const nm = (b.p && b.p.name) || b.p; const L = nm && iat(nm); if (!L) continue;
        L.runs += b.r || 0; L.balls += b.b || 0; L.f4 += b.f4 || 0; L.f6 += b.f6 || 0;
        if (b.out) L.out = b.out;
        if ((b.r || 0) > L.hs) L.hs = b.r || 0;
      }
      if (inn.bowlTeam === mine) {
        for (const nm of Object.keys(inn.bowlers || {})) {
          const bw = inn.bowlers[nm], L = iat(nm); if (!L) continue;
          L.wkts += bw.w || 0; L.conc += bw.r || 0; L.ovb += bw.b || 0;
        }
        for (const nm of Object.keys(inn.fielding || {})) {
          const fd = inn.fielding[nm], L = iat(nm); if (!L) continue;
          L.ct += fd.ct || 0; L.st += fd.st || 0; L.ro += fd.ro || 0;
        }
      }
    }
    for (const [k, L] of seen) lines.set(k + '|i', L);
  }

  const ordered = Array.from(lines.values()).sort((x, y) =>
    x.season - y.season || x.round - y.round || x.slot - y.slot ||
    (x.name < y.name ? -1 : x.name > y.name ? 1 : 0) || (x.intl ? 1 : 0) - (y.intl ? 1 : 0));
  for (const L of ordered) {
    const day = (startOf[L.season] ?? 0) + (dayOfRound(L.round) ?? (L.round - 1));
    const e = rec(L.slot, L.name);
    e.caps++;
    const c = L.intl ? e.intl : e.car;
    c.m++; c.runs += L.runs; c.balls += L.balls; c.wkts += L.wkts; c.conc += L.conc; c.ovb += L.ovb;
    c.mdn += L.mdn | 0; c.f4 += L.f4 | 0; c.f6 += L.f6 | 0;
    if (L.batted) { c.inns++; if (!L.out) c.no++; }
    if (L.runs >= 100) c.h100++; else if (L.runs >= 50) c.h50++;
    if (L.wkts >= 5) c.w5++; else if (L.wkts >= 3) c.w3++;
    // a catch behind the stumps is the keeper's, and one in the field is not
    if (L.wk) c.ctwk += L.ct | 0; else c.ctf += L.ct | 0;
    c.st += L.st | 0; c.ro += L.ro | 0;
    // THE STORY SO FAR, written as it happens. The record says a man's highest
    // score is 87; it cannot say the afternoon he made it, and so his page had
    // a heading with nothing under it. Every line below is a moment the fold
    // is ALREADY deciding - the first cap, a new best, a maiden hundred - and
    // it costs nothing to write down which round it happened in on the way
    // past. Because this replays the whole record on every settle, a page
    // opened tomorrow carries the moments of every match ever played, not just
    // the ones played since the day this was written.
    //
    // EVERY MOMENT CARRIES ITS OWN FIGURE. This book is the CLUB's book - it
    // starts at nought for everyone who walks in - so a man bought mid-career
    // makes a "highest score" of 5 on his first afternoon here with 143
    // already on his record. The number rides with the line so the serve can
    // measure it against what he brought with him (see story() below) and
    // throw away the ones that were never firsts at all.
    const cls = L.intl ? 'international' : 'league';
    const mile = (k, txt, x) => {
      if (e.mile.length < 60) e.mile.push({ d: day, s: L.season, r: L.round, k, txt, ...(x || {}) });
    };
    if (c.m === 1) mile('debut', 'Made his ' + cls + ' debut', { intl: !!L.intl });
    if (L.batted && L.hs > 0 && L.hs > c.hs)
      mile('hs', 'Made his highest ' + cls + ' score of ' + L.hs, { intl: !!L.intl, v: L.hs });
    if (L.hs > c.hs) c.hs = L.hs;
    if (L.runs >= 100 && c.h100 === 1)
      mile('hundred', 'Maiden ' + cls + ' century: ' + L.runs + ' off ' + L.balls, { intl: !!L.intl });
    else if (L.runs >= 50 && c.h50 === 1 && !c.h100)
      mile('fifty', 'Maiden ' + cls + ' fifty: ' + L.runs + ' off ' + L.balls, { intl: !!L.intl });
    if (L.ovb > 0 && (!c.bb || L.wkts > c.bb.w || (L.wkts === c.bb.w && L.conc < c.bb.r))) {
      if (L.wkts > 0) mile('bb', 'Achieved his best ' + cls + ' bowling figures of ' + L.wkts + '-' + L.conc,
        { intl: !!L.intl, w: L.wkts, r: L.conc });
      c.bb = { w: L.wkts, r: L.conc };
    }
    if (L.wkts >= 5 && c.w5 === 1)
      mile('fivefor', 'Maiden ' + cls + ' five-for: ' + L.wkts + '-' + L.conc, { intl: !!L.intl });
    // the workload rides raw: the fold below prices it against the MAN -
    // his trade sets the per-over rate, his gloves and his armband add bills
    // the scorecard line alone cannot know
    e.apps.push({ day, pts: ratePerformance(L), ovb: L.ovb, balls: L.balls,
      intl: !!L.intl, captNm: L.intl ? null : (capOf.get(L.season + '|' + L.round + '|' + L.slot) || null) });
  }

  // THE FRIENDLIES BOOK. An exhibition leaves no mark on the career, the
  // form or the legs - that law stands - but a match a manager staged and
  // watched should still be findable on the man's page. So it gets a book
  // of its OWN, folded from the banked friendlies the way the career is
  // folded from the banked rounds, and served beside the career without
  // ever touching it: nothing here feeds exp, form, fatigue or talents.
  const frBook = new Map();                        // slot -> name -> book
  try {
    const frRows = (await pool.query(
      `SELECT id, play_at_ms, c_country, c_slot, c_name, o_country, o_slot, o_name, result
         FROM friendlies WHERE status='played' AND result IS NOT NULL
          AND (c_country=$1 OR o_country=$1) ORDER BY id`, args)).rows;
    const frAt = (slot, nm) => {
      if (!frBook.has(slot)) frBook.set(slot, new Map());
      const m = frBook.get(slot);
      if (!m.has(nm)) m.set(nm, { m: 0, inns: 0, no: 0, runs: 0, balls: 0, hs: 0, outs: 0,
        f4: 0, f6: 0, h50: 0, h100: 0, wkts: 0, conc: 0, ovb: 0, mdn: 0, w3: 0, w5: 0,
        ctf: 0, ctwk: 0, ct: 0, st: 0, ro: 0, bb: null, log: [] });
      return m.get(nm);
    };
    for (const f of frRows) {
      const sides = [];
      if (f.c_country === country && f.c_slot != null) sides.push({ slot: f.c_slot, nm: f.c_name, opp: f.o_name });
      if (f.o_country === country && f.o_slot != null) sides.push({ slot: f.o_slot, nm: f.o_name, opp: f.c_name });
      for (const side of sides) {
        const played = new Map();                  // name -> this match's figures
        const tally = nm => {
          if (!played.has(nm)) played.set(nm, { r: 0, b: 0, out: null, wkts: 0, conc: 0, ovb: 0,
            batted: false, wk: false, ct: 0, st: 0, ro: 0 });
          return played.get(nm);
        };
        for (const inn of ((f.result && f.result.innings) || [])) {
          if (!inn) continue;
          if (inn.batTeam === side.nm) for (const b of (inn.bat || [])) {
            const nm = (b.p && b.p.name) || b.p; if (!nm || !((b.b || 0) > 0 || b.out)) continue;
            const e = frAt(side.slot, nm), t = tally(nm);
            e.runs += b.r || 0; e.balls += b.b || 0;
            e.f4 += b.f4 || 0; e.f6 += b.f6 || 0;
            if (b.out) { e.outs++; t.out = b.out; }
            if ((b.r || 0) > e.hs) e.hs = b.r || 0;
            t.r += b.r || 0; t.b += b.b || 0; t.batted = true;
            if (b.p && (b.p.keeper || b.p.role === 'wicketkeeper')) t.wk = true;
          }
          if (inn.bowlTeam === side.nm) {
            for (const nm of Object.keys(inn.bowlers || {})) {
              const bw = inn.bowlers[nm]; if (!((bw.b || 0) > 0)) continue;
              const e = frAt(side.slot, nm), t = tally(nm);
              e.wkts += bw.w || 0; e.conc += bw.r || 0; e.ovb += bw.b || 0; e.mdn += bw.mdn || 0;
              t.wkts += bw.w || 0; t.conc += bw.r || 0; t.ovb += bw.b || 0;
            }
            for (const nm of Object.keys(inn.fielding || {})) {
              const fd = inn.fielding[nm] || {};
              if (!((fd.ct || 0) || (fd.st || 0) || (fd.ro || 0))) continue;
              const e = frAt(side.slot, nm), t = tally(nm);
              e.ct += fd.ct || 0; e.st += fd.st || 0; e.ro += fd.ro || 0;
              t.ct += fd.ct || 0; t.st += fd.st || 0; t.ro += fd.ro || 0;
            }
          }
        }
        for (const [nm, t] of played) {
          const e = frAt(side.slot, nm);
          e.m++;
          if (t.batted) { e.inns++; if (!t.out) e.no++; }
          if (t.r >= 100) e.h100++; else if (t.r >= 50) e.h50++;
          if (t.wkts >= 5) e.w5++; else if (t.wkts >= 3) e.w3++;
          if (t.wk) e.ctwk += t.ct | 0; else e.ctf += t.ct | 0;
          if (t.ovb > 0 && (!e.bb || t.wkts > e.bb.w || (t.wkts === e.bb.w && t.conc < e.bb.r))) e.bb = { w: t.wkts, r: t.conc };
          // the last dozen exhibitions, newest first, for the page's match log
          e.log.unshift({ id: f.id, at: f.play_at_ms || null, opp: side.opp || '',
            win: f.result && f.result.winner != null ? f.result.winner === side.nm : null,
            r: t.r, b: t.b, out: !!t.out, w: t.wkts, conc: t.conc, ovb: t.ovb });
          if (e.log.length > 12) e.log.length = 12;
        }
      }
    }
  } catch (eFr) { /* pre-friendlies database: no exhibitions to read */ }

  // HOW HE GOT HERE IS PART OF THE STORY. Every settled deal this country's
  // clubs have done is on the board already, with the day it settled and the
  // fee - so a man's page can say who signed him and what he cost without a
  // second table and without anything new being written down. A deal where the
  // other end is the open market, the bank or a release has no club to name
  // (see migration 079 for the same four kinds, on the club diary).
  const dealsBySlot = new Map();
  try {
    const rows = (await pool.query(
      `SELECT player, fee, settled_day, country_id, slot, buyer_country, buyer_slot
         FROM listings WHERE status = 'sold' AND settled_day IS NOT NULL
          AND (country_id = $1 OR buyer_country = $1) ORDER BY settled_day`, [country])).rows;
    const put = (slot, r) => {
      if (slot == null || slot < 0) return;
      if (!dealsBySlot.has(slot)) dealsBySlot.set(slot, new Map());
      const m = dealsBySlot.get(slot);
      if (!m.has(r.player)) m.set(r.player, []);
      m.get(r.player).push(r);
    };
    const nameOf = new Map(clubs.map(c => [c.slot, c.name]));
    for (const r of rows) {
      if (r.buyer_country !== country) continue;              // he was bought INTO this world
      const from = r.country_id === country ? (nameOf.get(r.slot) || null) : null;
      const how = r.slot == null || r.slot < 0 ? 'free' : 'club';
      put(r.buyer_slot, { player: r.player, day: r.settled_day | 0, fee: r.fee | 0, from, how });
    }
  } catch (eDl) { dealsBySlot.clear(); }   // a database without a board simply has no deals

  let touched = 0;
  for (const club of clubs) {
    const men = book.get(club.slot) || new Map();
    const deals = dealsBySlot.get(club.slot) || new Map();
    // his moments and his deals, one list, oldest first. The page reads this
    // as the whole story so far; sixty lines is a long career and a cap the
    // squad blob will never notice.
    const story = (q, mile) => {
      // A MAN BOUGHT MID-CAREER DID NOT DEBUT THE DAY HE ARRIVED, and the 5 he
      // made that afternoon was not the highest score of his life. The book
      // above is this CLUB's book - nought for everybody who walks in - so
      // every first it recorded was a first HERE. What he brought with him is
      // the carry the market froze onto him: where there is one, his first
      // match is a first appearance for the club, and any "best" his own
      // record already beats is not a moment at all and is struck out.
      const said = [];
      for (const m of mile) {
        const car = m.intl ? q.carryIntl : q.carry;
        if (!car || !car.m) { said.push(m); continue; }
        if (m.k === 'debut') { said.push({ ...m, txt: 'First appearance for ' + club.name }); continue; }
        if (m.k === 'hs' && (m.v | 0) <= (car.hs | 0)) continue;
        if (m.k === 'bb' && car.bb && ((m.w | 0) < (car.bb.w | 0) ||
          ((m.w | 0) === (car.bb.w | 0) && (m.r | 0) >= (car.bb.r | 0)))) continue;
        if (m.k === 'hundred' && (car.h100 | 0) > 0) continue;
        if (m.k === 'fifty' && ((car.h50 | 0) > 0 || (car.h100 | 0) > 0)) continue;
        if (m.k === 'fivefor' && (car.w5 | 0) > 0) continue;
        said.push(m);
      }
      const all = said.concat((deals.get(q.name) || []).map(d => ({
        d: d.day, k: 'buy',
        txt: d.how === 'club' && d.from
          ? 'Transferred from ' + d.from + ' for $' + (d.fee | 0).toLocaleString('en-US')
          : 'Signed off the open market for $' + (d.fee | 0).toLocaleString('en-US')
      }))).sort((x, y) => (x.d | 0) - (y.d | 0));
      if (all.length) q.mile = all.slice(-60); else delete q.mile;
    };
    // the nets first: skills are the baseline plus every round genuinely
    // worked, so what the man is comes before what the season did to him
    // a managed club's replay collects its book of the nets on the way past;
    // an unmanaged one has nobody to read a chart, so it costs nothing
    const hist = claimedSlots.has(club.slot) ? { steps: [], rounds: [] } : null;
    const worked = await trainedSquad(pool, host, country, club.slot, club.squad, hist,
      Array.isArray(club.youth) ? club.youth : []);
    const trained = worked.squad;
    // the engine's default skipper where no orders named one (00-core picks
    // the best captaincy score the same way)
    const defCapt = (trained.slice().sort((x, y) => (y.capt || 0) - (x.capt || 0))[0] || {}).name || null;
    const squad = trained.map(p => {
      const q = { ...p };
      // what his years alone have given him: the floor his caps build on, and
      // the number a man who has never played a game reads at
      const base = expOfYears(q);
      q.baseExp = base;
      // the friendlies book rides beside the career on every man who has one
      const fb = (frBook.get(club.slot) || new Map()).get(q.name);
      if (fb && fb.m) q.friendly = fb; else delete q.friendly;
      const e = men.get(q.name);
      if (!e) {
        q.exp = Math.round(base); q.expWord = expWordOf(q.exp);
        q.formIx = 3; q.formWord = FORMW[3];
        q.fatN = 0; q.fatWord = fatWordOf(0); q.fatigue = q.fatWord;
        // a man who has not played for THIS club may still have a book: he
        // was bought, and his record travelled with him
        if (q.carry && q.carry.m) q.career = withCarry(null, q.carry); else delete q.career;
        if (q.carryIntl && q.carryIntl.m) q.intl = withCarry(null, q.carryIntl); else delete q.intl;
        // he has played nothing for this club, but he was still signed, and
        // the day he walked in is a story with one line in it
        story(q, []);
        return q;
      }
      q.exp = Math.round(clamp(base + expGain(q.age || 27, e.caps), 0, 99));
      q.expWord = expWordOf(q.exp);
      q.formIx = formIxOf(e.apps);
      q.formWord = FORMW[q.formIx];
      // the price of each appearance, on the man's own terms
      const spin = /spin|wrist|finger/i.test(String(q.bowlTypeFull || q.bowlType || ''));
      const perOver = spin ? LOAD_SPIN_PER_OVER : LOAD_PACE_PER_OVER;
      const keeps = !!(q.keeper || q.role === 'wicketkeeper');
      let fat = 0, last = null;
      for (const a of e.apps) {
        if (last != null) fat *= Math.pow(1 - REST_FRACTION, Math.max(0, a.day - last));
        let load = LOAD_BASE + (a.ovb / 6) * perOver + a.balls * LOAD_PER_BALL_FACED;
        if (keeps) load += LOAD_KEEPING;
        if (!a.intl && (a.captNm || defCapt) === q.name) load += LOAD_CAPTAINCY;
        fat = Math.min(FAT_CEILING, fat + load);
        last = a.day;
      }
      // today's match shows its drain TODAY - the manager who just watched
      // his opening bowler send down ten wants to see it in his legs -
      // and tonight's sleep is credited by tomorrow's settle, which redoes
      // this same fold with one more night in it
      if (last != null) fat *= Math.pow(1 - REST_FRACTION, Math.max(0, today - last));
      q.fatN = Math.round(clamp(fat, 0, FAT_CEILING));
      q.fatWord = fatWordOf(q.fatN); q.fatigue = q.fatWord;
      q.career = withCarry(e.car, q.carry);
      const iBook = withCarry(e.intl, q.carryIntl);
      if (iBook.m) q.intl = iBook; else delete q.intl;
      story(q, e.mile);
      return q;
    }).map(q => talentsEarned(q, (talBook.get(club.slot) || new Map()).get(q.name), talT));
    // THE STANDING LOAD OF THE NETS (training v2). A unit training light
    // freshens; high and intensive bank more work but carry load into the
    // next morning. Recomputed from the CURRENT plan on every settle, so it
    // is a pure function of what stands - change the plan, the load follows.
    try {
      const v2 = club.training && club.training.__v2;
      if (v2 && v2.units) {
        const INT_LOAD = { light: -6, normal: 0, high: 8, intensive: 16 };
        const unitKey = p => {
          if (p.keeper || p.role === 'wicketkeeper') return 'wk';
          if (p.role === 'allRounder') return 'ar';
          const bt = String(p.bowlTypeFull || p.bowlType || '');
          if (/spin|wrist|finger/i.test(bt)) return 'spin';
          if (bt && !/none/i.test(bt)) return 'seam';
          return 'bat';
        };
        squad.forEach(q => {
          const u = v2.units[unitKey(q)];
          const d = (u && INT_LOAD[u.i]) || 0;
          if (!d) return;
          q.fatN = Math.round(clamp((q.fatN || 0) + d, 0, FAT_CEILING));
          q.fatWord = fatWordOf(q.fatN); q.fatigue = q.fatWord;
        });
      }
    } catch (eV2) {}
    // TODAY AT THE NETS - the report, for a MANAGED club only. Real diffs:
    // a line per man whose skill genuinely stepped up this settle, plus who
    // is carrying load from intensive work. Written into the club's own
    // training blob under __report, where world_my_status already delivers.
    try {
      if (claimedSlots.has(club.slot)) {
        const before = new Map((club.squad || []).map(p => [p.name, p.skills || {}]));
        const SKN = { vsPace: 'playing pace', vsSpin: 'playing spin', rotation: 'strike rotation',
          temperament: 'temperament', power: 'power', stamina: 'stamina', wicket: 'wicket threat',
          economy: 'economy', discipline: 'discipline', moveTurn: 'movement and turn',
          variation: 'variation', keeping: 'keeping', catching: 'catching', stumping: 'stumping', fielding: 'fielding' };
        const lines = [];
        for (const q of squad) {
          const was = before.get(q.name); if (!was) continue;
          for (const k in (q.skills || {})) {
            const a = Math.round(was[k] || 0), b = Math.round(q.skills[k] || 0);
            if (b > a) lines.push(q.name + ' stepped up in ' + (SKN[k] || k) + ': ' + a + ' → ' + b);
          }
        }
        const v2r = club.training && club.training.__v2;
        if (v2r && v2r.units) {
          const heavy = [], rested = [];
          const unitKey2 = p => {
            if (p.keeper || p.role === 'wicketkeeper') return 'wk';
            if (p.role === 'allRounder') return 'ar';
            const bt = String(p.bowlTypeFull || p.bowlType || '');
            if (/spin|wrist|finger/i.test(bt)) return 'spin';
            if (bt && !/none/i.test(bt)) return 'seam';
            return 'bat';
          };
          squad.forEach(q => {
            const u = v2r.units[unitKey2(q)];
            if (u && u.i === 'intensive') heavy.push(q.name);
            if (u && u.i === 'light' && (q.fatN || 0) === 0) rested.push(q.name);
          });
          if (heavy.length) lines.push(heavy.slice(0, 3).join(', ') + ' trained intensively and ' + (heavy.length === 1 ? 'is' : 'are') + ' carrying extra load.');
          if (rested.length >= 2) lines.push('The light programme has ' + rested.slice(0, 3).join(', ') + ' fully freshened.');
        }
        if (lines.length) {
          await pool.query(
            `UPDATE clubs SET nets_report = $3::jsonb WHERE country_id=$1 AND slot=$2`,
            [country, club.slot, JSON.stringify({ day: dayIx(now), lines: lines.slice(0, 6) })]);
        }
      }
    } catch (eRp) {}
    // THE BOOK OF THE NETS, banked for the charts. Rebuilt whole from the
    // replay every settle, so it is never appended to and never drifts: it is
    // a cache of a derivation, not a second record. A database that has not
    // had 058 yet simply has nowhere to put it, and the page draws nothing.
    if (hist) {
      try {
        await pool.query(
          `UPDATE clubs SET nets_history = $3::jsonb WHERE country_id=$1 AND slot=$2`,
          [country, club.slot, JSON.stringify(hist)]);
      } catch (eHs) { /* pre-058 database: no book yet */ }
    }
    // EVERY MAN GETS A SHIRT NUMBER, once, and keeps it. Assigned from a hash
    // of his name with linear probing over the squad (name order), so every
    // device computes the same number the umpire banks. A number already on a
    // shirt is never reassigned while its owner is in the squad.
    try {
      const h32s = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
      const takenNo = {};
      const byName = squad.slice().sort((a, b) => a.name < b.name ? -1 : 1);
      byName.forEach(q => { const n = q.no | 0; if (n >= 1 && n <= 99 && !takenNo[n]) takenNo[n] = q.name; });
      byName.forEach(q => {
        const n = q.no | 0;
        if (n >= 1 && n <= 99 && takenNo[n] === q.name) return;
        let v = (h32s(q.name) % 99) + 1, guard = 0;
        while (takenNo[v] && guard++ < 120) v = (v % 99) + 1;
        takenNo[v] = q.name; q.no = v;
      });
    } catch (eNo) {}
    // THE HANDS A MAN PLAYS WITH FOLLOW THE HANDS HE HAS.
    //
    // A cricketer carries his hands twice: in skills, and again at the top
    // level as field and keeping, which jsDerive mirrors out of the skills
    // when he is made. The BALL ENGINE READS THE TOP LEVEL FIRST -
    // foFieldSkill(p) = p.field || p.skills.fielding || 50 - so the two
    // drifting apart is not cosmetic: the man fields at one number while
    // every page in the game shows him another.
    //
    // They drifted once already. 084 rescaled the world's hands in skills and
    // nothing re-derived the top level, so a world whose cards read a healthy
    // 55 was fielding at the number it had before, and the banked ball-by-ball
    // came back three good pieces of fielding to 117 misfields. 091 repairs
    // the men on the books; this is what stops it happening again, because
    // every squad in the world passes through here.
    squad.forEach(q => {
      const sk = q && q.skills;
      if (!sk) return;
      if (sk.fielding != null) q.field = sk.fielding;
      if (sk.keeping != null) q.keeping = sk.keeping;
    });
    // AND THE BOYS GO BACK TOO. A colt has no career, no form and no tired
    // legs - he plays one competition a season and it keeps its own book - so
    // he carries nothing the fold above adds to a senior. What the academy
    // changes about him is the nets, and that is what is written here.
    // A FOLD THAT CHANGED NOTHING WRITES NOTHING.
    //
    // The fold runs on every settle - three an hour - and rewrote every club's
    // squad and youth every time, whether or not a ball had been bowled since
    // the last one. That is 256 whole-squad blobs an hour going back over the
    // wire to be stored on top of what was already there, and most of them are
    // the same bytes: a man's form, legs and career only move when he plays,
    // and the world plays once a day.
    //
    // The old blob is already in hand - the SELECT above fetched it - so this
    // costs one string comparison and not one extra read. What it saves is the
    // write, the WAL behind it and the bloat that follows.
    //
    // It compares the SERIALISED value, which is the same thing the database
    // would store, so it can never call two different squads equal. It can
    // call two equal squads different (if a key ever came back in another
    // order) - which costs a write nobody needed, exactly what happened before
    // this, and never a wrong answer.
    const sqJson = JSON.stringify(squad), yhJson = JSON.stringify(worked.youth || []);
    const str = squadStrength(squad);
    if (canon(squad) === canon(club.squad || []) &&
        canon(worked.youth || []) === canon(club.youth || []) &&
        club.best_xi_strength === str) continue;
    await pool.query(
      // the eleven's worth goes down with the squad, in the one statement, so
      // a ranking can never read a strength that belongs to a squad that has
      // moved on (see migration 092)
      'UPDATE clubs SET squad=$3::jsonb, youth=$4::jsonb, best_xi_strength=$5 WHERE country_id=$1 AND slot=$2',
      [country, club.slot, sqJson, yhJson, str]);
    touched++;
  }
  return touched;
}
