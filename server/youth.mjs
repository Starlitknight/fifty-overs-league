// youth.mjs — THE YOUTH ACADEMY
//
// docs/ACADEMY.md is the authority. In short: the club's scout stands POSTED
// in one nation (068) and files one report per rest day from there - bands
// and a whisper, not the boy's file (050). The manager signs him onto the
// wage bill or lets him go. He trains in the ordinary nets at his own hidden
// rate, and leaves at twenty-one whether or not anyone gave him a senior
// shirt.
//
// THE HIDDEN RATE (068). A boy carries a growth multiplier seeded at his
// birth - youthPot, below - stored nowhere and served to nobody; the umpire
// computes it when the nets replay. A tier decides WHERE HE STARTS; the rate
// decides how fast the nets move him; the scout's WHISPER is the one clue a
// manager is given, and it is words through noise, never the number. The
// full account is docs/ACADEMY.md section 1.
//
// The consequence is worth stating plainly, because it is the design and not
// an accident: the nets move a boy about a tenth of his rating over four
// seasons, so they CONFIRM a signing rather than transform it. A boy who
// arrives forty per cent short of your first XI will still be short of it when
// he turns twenty-one. That is why a dud is readable at the moment you sign
// him, and why age is half the read - a sixteen-year-old rates lower than a
// twenty-year-old of the same tier and is the better prospect, because he has
// five seasons of academy in front of him rather than one.
import { countryConfigs } from './init-world.mjs';
// the same derivation the seniors use - one rule about when a man has crossed,
// so a boy and the man he becomes are never judged by two different tables
import { talentsEarned, expOfYears, expWordOf } from './living.mjs';

// a boy is sixteen to twenty when he is found, and he is gone at twenty-one
export const RECRUIT_MIN_AGE = 16;
export const RECRUIT_AGES = 5;                // 16, 17, 18, 19, 20
export const LEAVE_AT = 21;
// the Colts Cup bar, and so also what the world founds an academy with and
// what the umpire keeps an UNMANAGED club topped up to
export const ACADEMY_FLOOR = 15;
// a senior staff is twenty men, the same number world_colt refuses to exceed
export const SQUAD_CAP = 20;
// and a cricketer does not go on forever
export const RETIRE_AT = 38;
// what a level costs is the books' business, not the academy's
export { academyUpkeep, ACADEMY_BUILD, SCOUT_FEE_ABROAD, PROMOTE_FEE } from './economy.mjs';

// the same 32-bit hash the client and the world generator use
function h32(s) {
  let h = 2166136261 >>> 0;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
const rnd01 = s => h32(s) / 4294967296;

// ---------------------------------------------------------------------------
// THE LOTTERY
//
// Four tiers. The headline rates - a jewel under one in a hundred, a good boy
// under one in twenty, average about forty-five per cent and the rest never
// worth a shirt - are the rates a LEVEL THREE academy turns out. A level one
// academy is meaner and a level five kinder, which is the whole of what a
// level buys you besides the bill.
// ---------------------------------------------------------------------------
export const TIERS = ['jewel', 'good', 'average', 'poor'];
//
// SIX TO TEN (058) are the same ladder carried on. A boy is a pure function
// of (country, slot, season, index, level), and no club has ever held a level
// above five, so no recruit who has ever walked through a door is re-dealt by
// these rows existing. At ten, one boy in ten is a jewel and only one in
// fifteen is never worth a shirt - which, against an upkeep of 190k a round,
// is the trade the whole building is for.
export const ACADEMY_MAX = 10;
const TIER_ODDS = {
  1:  [0.002, 0.020, 0.380],
  2:  [0.005, 0.035, 0.430],
  3:  [0.009, 0.050, 0.470],
  4:  [0.015, 0.070, 0.510],
  5:  [0.025, 0.100, 0.550],
  6:  [0.035, 0.125, 0.570],
  7:  [0.048, 0.150, 0.585],
  8:  [0.062, 0.178, 0.595],
  9:  [0.078, 0.206, 0.601],
  10: [0.095, 0.235, 0.605]
};
export function tierOdds(level) { return TIER_ODDS[Math.max(1, Math.min(ACADEMY_MAX, +level || 2))]; }
export function tierOf(level, seed) {
  const [jewel, good, average] = tierOdds(level);
  const r = rnd01(seed + '|tier');
  if (r < jewel) return 'jewel';
  if (r < jewel + good) return 'good';
  if (r < jewel + good + average) return 'average';
  return 'poor';
}

// WHAT A TIER IS WORTH, in the only currency there is: how much of a grown
// cricketer the boy already is. `pools` is how many generated squads he is
// picked out of - three squads to find a jewel, one to find anybody - `rank`
// is where in that field he stands, and `share` is how much of that man has
// arrived.
//
// A BOY IS ALWAYS WEAKER THAN A SENIOR. Calibrated against the generator's
// own floors: the weakest senior of the weakest generated squad rates about
// 28.6k, and the strongest possible jewel source (best of three squads)
// about 53k - so even a twenty-year-old jewel on his best day lands near
// 26.5k, under every senior at every club. What a tier buys is HOW CLOSE to
// the seniors a boy starts, never past them; the rest is four seasons of
// nets before he walks at twenty-one.
const TIER_CUT = {
  jewel:   { pools: 3, rank: 'best',  share: 0.50 },
  good:    { pools: 1, rank: 'best',  share: 0.46 },
  average: { pools: 1, rank: 'mid',   share: 0.56 },
  poor:    { pools: 1, rank: 'worst', share: 0.52 }
};
// and a year of growing is worth five per cent of the man, so a sixteen-year-
// old of any tier reads lower than a twenty-year-old of the same one
const ageShare = age => 0.80 + 0.05 * (age - RECRUIT_MIN_AGE);

// A RECRUIT. A pure function of (nation, archetype, tier, seed), so the same
// boy appears on every re-run and the umpire and the manager never disagree
// about who walked through the door.
export function makeRecruit(host, nat, arch, tier, seed) {
  const cut = TIER_CUT[tier] || TIER_CUT.poor;
  let men = [];
  for (let i = 0; i < cut.pools; i++) {
    const got = host.genSquad(seed + '|pool' + i, nat, arch || 'balanced', 'general');
    if (got && got.length) men = men.concat(got);
  }
  if (!men.length) return null;
  men.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (a.name < b.name ? -1 : 1));
  const man = cut.rank === 'best' ? men[0]
            : cut.rank === 'mid' ? men[men.length >> 1]
            : men[men.length - 1];
  const age = RECRUIT_MIN_AGE + h32(seed + '|age') % RECRUIT_AGES;
  const share = cut.share * ageShare(age);

  const p = JSON.parse(JSON.stringify(man));
  const sk = {};
  for (const k in (p.skills || {})) sk[k] = Math.max(1, Math.round(p.skills[k] * share));
  p.skills = sk;
  p.age = age;
  p.colt = true;
  p.nat = nat;
  p.from = nat;                                   // where he was found, for his card
  // and his experience is his own age's, not the age of the man he was cut
  // from: a boy of sixteen has seen sixteen years of cricket whoever the pool
  // handed up, and scaling a twenty-eight-year-old's experience down by a
  // skill share was never the same thing
  p.exp = expOfYears(p);
  p.expWord = expWordOf(p.exp);
  // the fifteen skills are the man; his batting, his threat, his rating and
  // his WAGE are the engine's function of them, so let the engine work them
  // out rather than scaling the answers by hand. A boy is cheap because a boy
  // is small, not because anybody discounted him.
  const boy = host.derive([p])[0] || p;
  // the cricketer he was made IS the boy, not the man he was cut down from -
  // so the nets build on the boy, and nothing he does in the academy is ever
  // mistaken for training he has not done
  boy.baseSkills = JSON.parse(JSON.stringify(boy.skills || {}));
  boy.baseExp = boy.exp;
  // HIS BIRTH SEED RIDES WITH HIM. The hidden growth rate (youthPot) is a
  // pure function of this seed - stored like matches.seed is stored, as the
  // input to a derivation, never the answer. The formula lives only on the
  // server, so the seed on his card tells a reader nothing.
  boy.yseed = seed;
  // AND HIS OWN IDENTITY, NOT THE ONE HE WAS CUT FROM. A recruit is a copy of
  // a man out of a throwaway pool, so without this he would walk in wearing
  // that man's id - and two boys cut from the same pool at two academies would
  // be, to every lookup in the game, the same cricketer. His birth seed is his
  // alone, so it names him too.
  boy.pid = 'y' + (h32(seed + '|pid') >>> 0).toString(36);
  delete boy.career; delete boy.formIx; delete boy.formWord;
  delete boy.fatN; delete boy.fatWord; delete boy.trainProgress;
  return boy;
}

// the nation config the world was founded from: an England boy is an England
// cricketer, and a nation's ARCHETYPE is its flavour - rsa turns out express
// bowlers, sub and slk turn out wizards. Every nation still produces every
// kind of cricketer; it only leans.
// THE ROUND A BOY WALKED IN. living.mjs replays every banked training round
// to rebuild a squad, and works a man only from the round he JOINED - or a
// cricketer signed last week is handed three seasons of somebody else's nets.
// Colts never needed one while the academy was a waiting room. Now that they
// train (059) they do, and it is stamped at the door: the round about to be
// banked, so a boy's first session is his first session.
export async function joinedNow(pool, country, slot) {
  const s = +(await pool.query(
    'SELECT coalesce(max(season_no), 1) AS s FROM seasons WHERE country_id=$1', [country])).rows[0].s || 1;
  const r = +(await pool.query(
    `SELECT coalesce(max(round), 0) + 1 AS r FROM training_rounds
      WHERE country_id=$1 AND slot=$2 AND season_no=$3`, [country, slot, s])).rows[0].r || 1;
  return { s, r };
}

export function nationsOf(host) {
  return countryConfigs(host).map(r => ({ id: r.id, name: r.name, nat: r.nat, arch: r.arch }));
}
function archOf(host, country) {
  const r = countryConfigs(host).filter(x => x.id === country)[0];
  return r ? { nat: r.nat, arch: r.arch } : { nat: 'England', arch: 'balanced' };
}

// ---------------------------------------------------------------------------
// THE HIDDEN RATE — the one thing about a boy nobody is shown.
//
// Until now the academy's whole game was the starting card: the nets moved
// every boy at the same lawful pace, so what he was at sixteen was what he
// would be at twenty-one, give or take a tenth. From the Pavilion's academy
// plays a deeper game, and this world now plays it too: every boy carries a
// GROWTH RATE, seeded at birth, never stored, never served. Most boys train
// at about the ordinary pace. A rare one is a late bloomer who gains at
// better than twice it - a boy whose card undersold him. A few are already
// close to their ceiling. Seniors are untouched: the rate expires with the
// academy, at twenty-one, like everything else about being a boy.
//
// The rate is a pure function of the boy's birth seed (yseed, stamped at
// makeRecruit). Nothing writes it anywhere; the umpire computes it at the
// moment the nets are replayed, and the formula lives in this file only -
// not in the shipped client - so no card, no read RPC and no bundle betrays
// it. A manager learns a boy's rate the only honest way: by watching him
// season over season. Boys signed before the seed existed fall back to a
// hash of who they are, so their rate is just as fixed and just as hidden.
// ---------------------------------------------------------------------------
// FNV alone clusters on near-identical keys (the planet learned this the
// hard way); the rate must be honestly uniform, so its draw is avalanched
function mix01(s) {
  let h = h32(s);
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 3266489917) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function youthPot(boy) {
  const seed = (boy && boy.yseed) || ('ypotfb|' + ((boy && boy.name) || '') + '|' + ((boy && (boy.from || boy.nat)) || ''));
  const r = mix01('ypot|' + seed);
  // mass at the ordinary pace, a thin honest tail of late bloomers:
  // r=0 -> 0.75x, median ~1.0x, one boy in fourteen over 2x, best ~2.9x
  return Math.round((0.75 + 0.5 * r + 1.65 * Math.pow(r, 9)) * 100) / 100;
}

// THE SCOUT'S WHISPER - his opinion of the hidden rate, in words.
//
// From the Pavilion's scouts never hand you a number; they hand you a
// sentence, and the sentence is right more often from a better academy.
// The whisper is the hidden rate read through seeded noise: a level-one
// academy's man mishears by up to a third, a level-ten's by a twentieth.
// The WORDS are stored on the boy's card (words carry no formula); the rate
// itself still exists nowhere but the derivation.
const WHISPERS = [
  [2.1,  'the best young talent I have seen in years - sign him and clear a shirt'],
  [1.6,  'he will grow far past this card, mark me'],
  [1.25, 'there is real growth left in him'],
  [0.95, 'he will come along at the usual pace'],
  [0.8,  'what you see is close to what you will get'],
  [0,    'near the finished article already, for better or worse']
];
export function whisperOf(pot, level, seed) {
  const noise = 0.7 - 0.06 * Math.max(1, Math.min(10, +level || 1));
  const heard = pot * (1 + (mix01('wn|' + seed) - 0.5) * noise);
  for (const [cut, words] of WHISPERS) if (heard >= cut) return words;
  return WHISPERS[WHISPERS.length - 1][1];
}
export function withWhisper(boy, level) {
  if (boy) boy.whisper = whisperOf(youthPot(boy), level, boy.yseed || boy.name || '');
  return boy;
}

// THE SEED A SCOUTING TRIP RUNS ON. One boy per club per world day per nation,
// and the academy level is in it - so a club that builds a better academy is
// not handed the same boys it would have been handed anyway.
export function scoutSeed(country, slot, worldDay, nation, level) {
  return 'scout|' + country + '|' + slot + '|d' + worldDay + '|' + nation + '|L' + level;
}
export function scoutRecruit(host, { country, slot, worldDay, nation, level }) {
  const cfg = archOf(host, nation);
  const seed = scoutSeed(country, slot, worldDay, nation, level);
  const tier = tierOf(level, seed);
  const boy = withWhisper(makeRecruit(host, cfg.nat, cfg.arch, tier, seed), level);
  return boy ? { tier, nation, recruit: boy } : null;
}

// ---------------------------------------------------------------------------
// FOUNDING AND KEEPING THE WORLD'S ACADEMIES STOCKED
//
// Every club in the world is founded with fifteen boys, so the first Colts Cup
// is a real competition rather than sixteen walkovers. After that the umpire
// keeps UNMANAGED clubs topped up to fifteen - they are the world's furniture
// and have to keep turning up - and never touches a club with a human in
// charge. A manager scouts, signs, pays, and forfeits if he lets the list slip.
// ---------------------------------------------------------------------------
export function foundAcademy(host, country, slot, level, tag) {
  const cfg = archOf(host, country);
  const out = [];
  // KEEP GOING UNTIL THERE ARE FIFTEEN. The name banks are finite, so two of
  // the first fifteen seeds sometimes turn out the same lad - and a club that
  // was founded with fourteen boys would forfeit its first Colts Cup tie
  // through no decision of anybody's. Walk on past the collision instead.
  for (let i = 0; out.length < ACADEMY_FLOOR && i < ACADEMY_FLOOR * 6; i++) {
    const seed = 'academy|' + country + '|' + slot + '|' + (tag || 'found') + '|' + i;
    const boy = withWhisper(makeRecruit(host, cfg.nat, cfg.arch, tierOf(level, seed), seed), level);
    if (boy && !out.some(y => y.name === boy.name)) out.push(boy);
  }
  return out;
}

// Fill every UNMANAGED academy back to the floor. Idempotent by name, and
// keyed on the world day so a re-run of the same tick makes the same boys.
export async function stockAcademies(pool, host, country, { worldDay }) {
  const clubs = (await pool.query(
    `SELECT c.slot, c.academy, c.youth, (cl.user_id IS NOT NULL) AS managed
       FROM clubs c LEFT JOIN claims cl ON cl.country_id = c.country_id AND cl.slot = c.slot
      WHERE c.country_id = $1 ORDER BY c.slot`, [country])).rows;
  const cfg = archOf(host, country);
  let added = 0;
  for (const c of clubs) {
    if (c.managed) continue;                      // his academy is his own affair
    const youth = Array.isArray(c.youth) ? c.youth : [];
    if (youth.length >= ACADEMY_FLOOR) continue;
    let n = 0;
    const joined = await joinedNow(pool, country, c.slot);
    while (youth.length < ACADEMY_FLOOR && n < ACADEMY_FLOOR * 3) {
      const seed = 'stock|' + country + '|' + c.slot + '|d' + worldDay + '|' + (n++);
      const boy = withWhisper(makeRecruit(host, cfg.nat, cfg.arch, tierOf(c.academy, seed), seed), c.academy);
      if (boy && !youth.some(y => y && y.name === boy.name)) { boy.joined = joined; youth.push(boy); added++; }
    }
    await pool.query('UPDATE clubs SET youth=$3::jsonb WHERE country_id=$1 AND slot=$2',
      [country, c.slot, JSON.stringify(youth)]);
  }
  return added;
}

// THE FOUNDING DEAL. Sixteen boys to EVERY club - managed and unmanaged both -
// so the first Colts Week is played rather than forfeited wall to wall. This
// is a one-time gift by decree, not the standing rule: after it, a manager's
// academy is his own affair again. Idempotent by ticks row, and the boys come
// out of the seeded hat - a different sixteen at every club, the same sixteen
// if the deal is ever re-run.
export async function dealYouthToAll(pool, host, country, { count = 16 } = {}) {
  const key = country + ':youth:deal16:v1';
  const claim = await pool.query(
    `INSERT INTO ticks(key, status) VALUES ($1,'running')
     ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING status`, [key]);
  if (claim.rows[0].status === 'done') return 0;
  const clubs = (await pool.query(
    'SELECT slot, academy, youth FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  const cfg = archOf(host, country);
  let added = 0;
  for (const c of clubs) {
    const youth = Array.isArray(c.youth) ? c.youth : [];
    let n = 0;
    // the founding gift arrives with the world, so these boys carry no joining
    // round at all - like every cricketer the world was made with, they have
    // been here all along and work every round the club has ever banked
    while (youth.length < count && n < count * 4) {
      const seed = 'deal16|' + country + '|' + c.slot + '|' + (n++);
      const boy = withWhisper(makeRecruit(host, cfg.nat, cfg.arch, tierOf(c.academy, seed), seed), c.academy);
      if (boy && !youth.some(y => y && y.name === boy.name)) { youth.push(boy); added++; }
    }
    await pool.query('UPDATE clubs SET youth=$3::jsonb WHERE country_id=$1 AND slot=$2',
      [country, c.slot, JSON.stringify(youth)]);
  }
  await pool.query(`UPDATE ticks SET status='done', finished_at=now() WHERE key=$1`, [key]);
  return added;
}

// ---------------------------------------------------------------------------
// THE ROLLOVER. A year on everybody, and then the two things a year does:
//
//   1. a man who has reached thirty-eight hangs them up.
//   2. a boy who has reached twenty-one LEAVES. Not promoted, not listed, not
//      placed elsewhere - gone, and the wages his club paid him were the price
//      of finding out. A week before the turning of the year the manager is
//      told which boys are about to walk, which is the whole of the warning he
//      gets and the whole of the warning he needs.
//
// Nothing is promoted automatically any more. A senior shirt costs a flat fee
// and is a decision, so the umpire has no business handing them out.
//
// Keyed by season, so a re-run never ages anybody twice.
// ---------------------------------------------------------------------------
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
  let retired = 0, released = 0;
  for (const c of clubs) {
    // A YEAR OLDER IS A YEAR WISER. The rollover used to add a year to the age
    // and leave experience where it was, so the two drifted a season further
    // apart every season; a man's stored experience is the years he has been
    // at it, so it turns over with them.
    const older = (p, floor) => {
      const q = Object.assign({}, p, { age: (p.age || floor) + 1 });
      q.exp = expOfYears(q);
      q.expWord = expWordOf(q.exp);
      return q;
    };
    // 1. a year on the professionals, and the oldest hang them up
    const aged = (c.squad || []).map(p => older(p, 27));
    const squad = aged.filter(p => (p.age || 0) < RETIRE_AT);
    retired += aged.length - squad.length;

    // 2. a year on the boys, and the twenty-one-year-olds walk out of the world
    const youth = (Array.isArray(c.youth) ? c.youth : []).map(y => older(y, 18));
    const stay = youth.filter(y => y.age < LEAVE_AT);
    released += youth.length - stay.length;

    await pool.query('UPDATE clubs SET youth=$3::jsonb, squad=$4::jsonb WHERE country_id=$1 AND slot=$2',
      [country, c.slot, JSON.stringify(stay), JSON.stringify(squad)]);
  }
  await pool.query(`UPDATE ticks SET status='done', finished_at=now() WHERE key=$1`, [key]);
  return { skipped: false, promoted: 0, retired, released, madeWay: 0 };
}

// who walks at the next turning of the year - the list the warning is built
// from. A pure read of the boys on the books.
export function leavingAt(youth) {
  return (Array.isArray(youth) ? youth : []).filter(y => y && (y.age || 0) + 1 >= LEAVE_AT);
}

// THE REDEAL OF 2026. The first crops were dealt under the old pricing,
// which let a lucky boy read level with a senior pro - and the board ruled
// that a boy is always weaker than a senior. So one time only, by decree:
// every club's youth list - managed and unmanaged alike - is torn up and
// dealt fresh from the recalibrated hat, sixteen boys apiece. Everything
// priced under the old model goes with them: unanswered scout reports,
// prebanked candidates (relaid by the same tick under the new pricing), and
// named Colts squads that would name boys who no longer exist. Idempotent by
// ticks row; the boys come out of the seeded hat, so a re-run deals the same
// sixteen.
export async function redealYouth(pool, host, country, { count = 16 } = {}) {
  const key = country + ':youth:redeal:v2';
  const claim = await pool.query(
    `INSERT INTO ticks(key, status) VALUES ($1,'running')
     ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING status`, [key]);
  if (claim.rows[0].status === 'done') return 0;
  const clubs = (await pool.query(
    'SELECT slot, academy, squad FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  const cfg = archOf(host, country);
  let dealt = 0;
  for (const c of clubs) {
    const taken = new Set((Array.isArray(c.squad) ? c.squad : []).map(p => p && p.name));
    const youth = [];
    let n = 0;
    // a redeal replaces the boys mid-world, so these ones start from today:
    // without the stamp they would be handed every round already banked
    const joined = await joinedNow(pool, country, c.slot);
    while (youth.length < count && n < count * 4) {
      const seed = 'redeal2|' + country + '|' + c.slot + '|' + (n++);
      const boy = makeRecruit(host, cfg.nat, cfg.arch, tierOf(c.academy, seed), seed);
      if (boy && !taken.has(boy.name) && !youth.some(y => y && y.name === boy.name)) {
        boy.joined = joined; youth.push(boy); dealt++;
      }
    }
    await pool.query('UPDATE clubs SET youth=$3::jsonb WHERE country_id=$1 AND slot=$2',
      [country, c.slot, JSON.stringify(youth)]);
  }
  await pool.query('DELETE FROM academy_scouts WHERE country_id=$1 AND decision IS NULL', [country]);
  await pool.query('DELETE FROM academy_candidates WHERE country_id=$1', [country]);
  await pool.query('DELETE FROM colts_squads WHERE country_id=$1', [country]);
  await pool.query(`UPDATE ticks SET status='done', finished_at=now() WHERE key=$1`, [key]);
  return dealt;
}

// ---------------------------------------------------------------------------
// LAYING OUT THE CANDIDATES
//
// The scout button has to answer instantly, and a recruit can only be made by
// the cricket engine, which the database cannot run. So the umpire lays out
// every boy a manager could possibly be shown - one per nation, for each rest
// day within reach - and world_scout only reveals the one he paid to see.
//
// Only CLAIMED clubs get candidates: nobody else presses the button, and
// laying them for two hundred and fifty bot clubs would be work for nothing.
// Everything is a pure function of (club, day, nation, level), so a re-run of
// any tick lays out exactly the same boys.
// ---------------------------------------------------------------------------
export async function layCandidates(pool, host, country, { worldDay, restDays, startDay, ahead = 2 }) {
  const clubs = (await pool.query(
    `SELECT c.slot, c.academy FROM clubs c
       JOIN claims cl ON cl.country_id = c.country_id AND cl.slot = c.slot
      WHERE c.country_id = $1 ORDER BY c.slot`, [country])).rows;
  if (!clubs.length) return 0;
  const nations = nationsOf(host);
  // the rest days from here on, today included, and only the next few
  const days = (restDays || [])
    .map(di => startDay + di)
    .filter(d => d >= worldDay)
    .slice(0, ahead);
  if (!days.length) return 0;
  let laid = 0;
  for (const c of clubs) {
    for (const day of days) {
      for (const n of nations) {
        const seed = scoutSeed(country, c.slot, day, n.id, c.academy);
        const tier = tierOf(c.academy, seed);
        const boy = makeRecruit(host, n.nat, n.arch, tier, seed);
        if (!boy) continue;
        const r = await pool.query(
          `INSERT INTO academy_candidates(country_id, slot, world_day, nation, tier, recruit)
                VALUES ($1,$2,$3,$4,$5,$6::jsonb)
           ON CONFLICT (country_id, slot, world_day, nation) DO NOTHING`,
          [country, c.slot, day, n.id, tier, JSON.stringify(boy)]);
        laid += r.rowCount;
      }
    }
  }
  // a boy nobody was ever going to be shown is not worth keeping
  await pool.query('DELETE FROM academy_candidates WHERE country_id=$1 AND world_day < $2',
    [country, worldDay - 1]);
  return laid;
}

// ===========================================================================
// THE COLTS CUP
//
// Week four of the season belongs to the academies. All sixteen clubs of a
// nation go into one hat - both divisions together, so a Division Two academy
// can knock out the champions - and a straight knockout runs over four days:
// the last sixteen on the Monday, quarter-finals Tuesday, semi-finals
// Thursday, THE FINAL on the Friday. The draw is made once, at the last
// sixteen, and the bracket holds from there: a manager can see his side's
// path to the final on the Monday morning.
//
// A CLUB MUST BE ABLE TO FIELD A SIDE. Fifteen men under twenty-one, from the
// academy list or the senior staff, and no more than eighteen may be named.
// A club that cannot raise fifteen forfeits its tie, publicly. That bar is
// checked on the morning of the tie against the club as it actually stands,
// so it is a fact about the club and never about who logged in.
//
// THE MANAGER NAMES THE SQUAD, or the umpire names it for him: the youngest
// men who qualify, in a fixed order, so an offline club still walks out. A
// named squad is a better squad - that is the edge for turning up - but
// nobody ever loses a fixture for being away, which is the world's founding
// constraint.
//
// Nothing here touches a senior first-class record. What youth cricket leaves
// behind is the bracket, the champion, the purse, and each boy's own Colts
// record - all recomputed from the banked scorecards, so none of it can drift
// from the cricket that produced it.
// ===========================================================================
export const COLTS_STAGES = ['r16', 'qf', 'sf', 'final'];
export const COLTS_FLOOR = 15;             // a side, or a forfeit
export const COLTS_CEILING = 18;           // and no more than this may be named
export const COLTS_AGE = 21;               // under this, on the day

// what the winner, the beaten finalist and the losing semi-finalists take.
// A season's upkeep at level three is 26,000 x 14 = 364,000, so a club that
// wins its cup has run its academy for nothing that year - which is the point:
// a poor club that develops well has a way of funding itself that isn't
// selling its best player.
export const COLTS_PURSE = { winner: 750000, finalist: 300000, semi: 120000 };

// EVERY BOY ON THE BOOKS, from either list. One definition, mirrored by
// world_colts_eligible in SQL so the page and the umpire cannot disagree.
export function coltsEligible(club) {
  const out = [];
  for (const p of (Array.isArray(club.youth) ? club.youth : [])) {
    if (p && (p.age || 99) < COLTS_AGE) out.push(p);
  }
  for (const p of (club.squad || [])) {
    if (p && (p.age || 99) < COLTS_AGE) out.push(p);
  }
  // youngest first, then by name: a fixed order, so the umpire's autopick is
  // the same eighteen on every replay of the same morning
  return out.sort((a, b) => (a.age || 99) - (b.age || 99) || (a.name < b.name ? -1 : 1));
}

// THE SIDE THAT WALKS OUT. The manager's named men if he named any and they
// are still on the books this morning; the youngest who qualify otherwise.
// Returns null when the club cannot raise fifteen - the caller turns that
// into a forfeit rather than a match.
export function coltsSide(club, named) {
  const elig = coltsEligible(club);
  if (elig.length < COLTS_FLOOR) return null;
  if (Array.isArray(named) && named.length) {
    const want = new Set(named);
    const picked = elig.filter(p => want.has(p.name));
    // a squad that has shrunk below the bar since it was named is topped up
    // from the youngest available rather than refused: he named a side, and
    // the world is not entitled to punish him for a boy turning twenty-one
    if (picked.length >= COLTS_FLOOR) return picked.slice(0, COLTS_CEILING);
    const rest = elig.filter(p => !want.has(p.name));
    return picked.concat(rest.slice(0, COLTS_FLOOR - picked.length));
  }
  return elig.slice(0, COLTS_CEILING);
}

// THE BRACKET. Drawn once from one seed, then fixed: the winners of ties
// 2k and 2k+1 meet in the next round. Pure - the same nation and season
// always produce the same last sixteen, so a client can draw the bracket
// without asking the server which ties exist.
export function coltsDraw(cupDraw, country, seasonNo, field) {
  const drawn = cupDraw('colts|' + country + '|s' + seasonNo, field);
  const ties = [];
  for (let i = 0; i < drawn.length; i += 2) ties.push([drawn[i], drawn[i + 1]]);
  return ties;
}
export function coltsMatchId(country, seasonNo, stage, gi) {
  return 'colts|' + country + '|s' + seasonNo + '|' + stage + '|' + gi;
}

// ONE STAGE OF THE CUP, if its day has closed. Idempotent per tie: the row is
// the claim, exactly as the FA Cup and the Champions Cup do it.
export async function playColtsStage(pool, host, country, season, stage, seedOf, engineVersion, opts = {}) {
  const comp = 'colts:' + country;
  const seasonNo = season.season_no;
  const clubs = (await pool.query(
    'SELECT slot, name, squad, youth FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  if (clubs.length < 2) return 0;
  const bySlot = Object.fromEntries(clubs.map(c => [c.slot, c]));

  // the field for this stage: the whole nation at the last sixteen, the
  // survivors after that
  let ties;
  if (stage === 'r16') {
    ties = coltsDraw(opts.cupDraw, country, seasonNo, clubs.map(c => c.slot));
  } else {
    const prev = COLTS_STAGES[COLTS_STAGES.indexOf(stage) - 1];
    const rows = (await pool.query(
      'SELECT gi, a, b, result FROM cup_matches WHERE comp=$1 AND season_no=$2 AND stage=$3 ORDER BY gi',
      [comp, seasonNo, prev])).rows;
    if (!rows.length) return 0;                       // the previous day has not been played
    const through = rows.map(r => (r.result.winner === r.b.name ? r.b : r.a).slot);
    ties = [];
    for (let i = 0; i < through.length; i += 2) ties.push([through[i], through[i + 1]]);
  }

  // the squads a manager named for this season, if he named any
  const namedBy = {};
  try {
    const nr = await pool.query(
      'SELECT slot, names FROM colts_squads WHERE country_id=$1 AND season_no=$2', [country, seasonNo]);
    nr.rows.forEach(r => { namedBy[r.slot] = r.names; });
  } catch (e) { /* before 041 there is no such table; the umpire names them all */ }

  let played = 0;
  for (let gi = 0; gi < ties.length; gi++) {
    const [x, y] = ties[gi];
    if (x == null || y == null) continue;
    if ((await pool.query(
      'SELECT 1 FROM cup_matches WHERE comp=$1 AND season_no=$2 AND stage=$3 AND gi=$4',
      [comp, seasonNo, stage, gi])).rowCount) continue;

    // the first-drawn hosts; the final is the showpiece at the boss's ground
    const homeSlot = stage === 'final' ? (bySlot[0] ? 0 : x) : x;
    const awaySlot = homeSlot === x ? y : x;
    const home = bySlot[homeSlot], away = bySlot[awaySlot];
    if (!home || !away) continue;
    const A = { country, slot: homeSlot, name: home.name + ' Colts' };
    const B = { country, slot: awaySlot, name: away.name + ' Colts' };

    const hSide = coltsSide(home, namedBy[homeSlot]);
    const aSide = coltsSide(away, namedBy[awaySlot]);
    const seed = seedOf(coltsMatchId(country, seasonNo, stage, gi));

    let result, forfeit = null;
    if (!hSide || !aSide) {
      // A FORFEIT. Nobody bowls a ball. If neither club can raise a side the
      // one closer to a side goes through, and an exact tie falls to the club
      // drawn first - a rule, not a coin, so every device agrees.
      const hN = coltsEligible(home).length, aN = coltsEligible(away).length;
      const winner = !hSide && !aSide ? (aN > hN ? B : A) : (hSide ? A : B);
      const loser = winner === A ? B : A;
      forfeit = { short: [!hSide ? homeSlot : null, !aSide ? awaySlot : null].filter(v => v != null),
                  home: hN, away: aN };
      result = { winner: winner.name, loser: loser.name, forfeit: true, innings: [],
                 text: loser.name + ' could not name fifteen men under twenty-one: ' +
                       winner.name + ' go through without a ball bowled' };
      await pool.query(
        `INSERT INTO cup_matches(comp, season_no, stage, gi, a, b, seed, engine_version,
                                 result, result_canonical, forfeit)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9::jsonb,$10::text,$11::jsonb)
         ON CONFLICT (comp, season_no, stage, gi) DO NOTHING`,
        [comp, seasonNo, stage, gi, JSON.stringify(A), JSON.stringify(B), seed, engineVersion,
         JSON.stringify(result), JSON.stringify(result), JSON.stringify(forfeit)]);
      played++;
      continue;
    }

    const cond = host.condFor(country, homeSlot, seasonNo, 800 + COLTS_STAGES.indexOf(stage));
    const resultJson = host.runMatch(
      { name: A.name, players: hSide }, { name: B.name, players: aSide },
      cond.pitch, seed, null, cond.weather);
    if (!resultJson) throw new Error('engine failed to complete ' + coltsMatchId(country, seasonNo, stage, gi));
    await pool.query(
      `INSERT INTO cup_matches(comp, season_no, stage, gi, a, b, seed, engine_version,
                               result, result_canonical)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9::jsonb,$10::text)
       ON CONFLICT (comp, season_no, stage, gi) DO NOTHING`,
      [comp, seasonNo, stage, gi, JSON.stringify(A), JSON.stringify(B), seed, engineVersion,
       resultJson, resultJson]);
    played++;
  }
  return played;
}

// THE BRACKET AND THE PURSE, derived purely from the banked ties - re-runnable,
// never drifting, and speaking the clubs' CURRENT names.
export async function computeColts(pool, country, seasonNo) {
  const clubs = (await pool.query(
    'SELECT slot, name FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  const bySlot = Object.fromEntries(clubs.map(c => [c.slot, c]));
  const ms = (await pool.query(
    `SELECT stage, gi, a, b, result, forfeit FROM cup_matches
      WHERE comp=$1 AND season_no=$2 ORDER BY stage, gi`, ['colts:' + country, seasonNo])).rows;
  const nameOf = side => (bySlot[side.slot] ? bySlot[side.slot].name : side.name) + ' Colts';

  const stages = {}, PS = {};
  let champion = null, finalist = null;
  const semiLosers = [];
  for (const m of ms) {
    const won = m.result.winner === m.b.name ? m.b : m.a;
    const lost = won === m.a ? m.b : m.a;
    (stages[m.stage] = stages[m.stage] || []).push({
      gi: m.gi, home: nameOf(m.a), away: nameOf(m.b),
      homeSlot: m.a.slot, awaySlot: m.b.slot,
      winner: nameOf(won), winnerSlot: won.slot,
      forfeit: m.forfeit || null, text: m.result.text || null
    });
    if (m.stage === 'final') { champion = won; finalist = lost; }
    if (m.stage === 'sf') semiLosers.push(lost);

    // every boy's runs and wickets, from the cards themselves
    const slotOf = nm => nm === m.a.name ? m.a.slot : nm === m.b.name ? m.b.slot : null;
    for (const inn of (m.result.innings || [])) {
      if (!inn) continue;
      const bs = slotOf(inn.batTeam), os = slotOf(inn.bowlTeam);
      for (const b of (inn.bat || [])) {
        const nm = b.p && b.p.name; if (!nm || bs == null) continue;
        const e = PS[nm] = PS[nm] || { name: nm, club: bySlot[bs].name, runs: 0, hs: 0, wkts: 0, conc: 0 };
        e.runs += (b.r || 0); if ((b.r || 0) > e.hs) e.hs = b.r || 0;
      }
      for (const nm in (inn.bowlers || {})) {
        if (os == null) continue;
        const bw = inn.bowlers[nm];
        const e = PS[nm] = PS[nm] || { name: nm, club: bySlot[os].name, runs: 0, hs: 0, wkts: 0, conc: 0 };
        e.wkts += (bw.w || 0); e.conc += (bw.r || 0);
      }
    }
  }
  const players = Object.values(PS);
  // THE PURSE, as a function of the bracket rather than a thing paid and
  // remembered: recompute it and you get the same answer.
  const purse = [];
  if (champion) purse.push({ slot: champion.slot, kind: 'winner', amount: COLTS_PURSE.winner });
  if (finalist) purse.push({ slot: finalist.slot, kind: 'finalist', amount: COLTS_PURSE.finalist });
  for (const s of semiLosers) purse.push({ slot: s.slot, kind: 'semi', amount: COLTS_PURSE.semi });

  return {
    country, seasonNo, stages,
    stagesDone: COLTS_STAGES.filter(k => (stages[k] || []).length).length,
    champion: champion ? nameOf(champion) : null,
    championSlot: champion ? champion.slot : null,
    finalist: finalist ? nameOf(finalist) : null,
    purse,
    runs: players.filter(p => p.runs > 0).sort((a, b) => b.runs - a.runs).slice(0, 5),
    wickets: players.filter(p => p.wkts > 0).sort((a, b) => b.wkts - a.wkts || a.conc - b.conc).slice(0, 5)
  };
}

// EVERY BOY'S OWN RECORD, recomputed from the same banked cards and written
// back onto the colt so his card can show what he has actually done. Pure
// function of the banked ties; running it twice writes the same numbers.
export async function coltRecords(pool, country, seasonNo, host) {
  const talT = host && host.talThresholds ? host.talThresholds() : {};
  const ms = (await pool.query(
    'SELECT a, b, result FROM cup_matches WHERE comp=$1 AND season_no=$2',
    ['colts:' + country, seasonNo])).rows;
  const book = new Map();                                     // slot -> name -> record
  const rec = (slot, name) => {
    if (!book.has(slot)) book.set(slot, new Map());
    const m = book.get(slot);
    if (!m.has(name)) m.set(name, { m: 0, runs: 0, hs: 0, wkts: 0, conc: 0 });
    return m.get(name);
  };
  // AND WHAT THE BOYS LEARNED. The Colts Cup is fifty overs of real cricket -
  // the rule the manager set was "everything except a friendly" - so a boy is
  // credited for the situations he keeps finding himself in exactly as a
  // senior is. It matters more for him than for anybody: two seasons of colts
  // cricket is how a nineteen-year-old turns up to his senior shirt with
  // something the draft never gave him.
  const talBook = new Map();                                  // slot -> name -> {talent: n}
  for (const mt of ms) {
    const tal = (mt.result || {}).tal || {};
    for (const side of [mt.a, mt.b]) {
      const men = side && tal[side.name]; if (!men || side.slot == null) continue;
      if (!talBook.has(side.slot)) talBook.set(side.slot, new Map());
      const bk = talBook.get(side.slot);
      for (const nm of Object.keys(men)) {
        const cur = bk.get(nm) || {};
        for (const t of Object.keys(men[nm])) cur[t] = (cur[t] | 0) + (men[nm][t] | 0);
        bk.set(nm, cur);
      }
    }
  }
  for (const mt of ms) {
    const slotOf = nm => nm === mt.a.name ? mt.a.slot : nm === mt.b.name ? mt.b.slot : null;
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
    const boysTal = talBook.get(c.slot) || new Map();
    const youth = (Array.isArray(c.youth) ? c.youth : []).map(y => {
      const q = Object.assign({}, y), r = men.get(y.name);
      if (r && r.m) q.colts = r; else delete q.colts;
      // a boy can cross a threshold and come by a talent in the academy, and
      // the same fold decides it: summed from the record, never incremented
      return talentsEarned(q, boysTal.get(y.name), talT);
    });
    await pool.query('UPDATE clubs SET youth=$3::jsonb WHERE country_id=$1 AND slot=$2',
      [country, c.slot, JSON.stringify(youth)]);
    touched++;
  }
  return touched;
}
