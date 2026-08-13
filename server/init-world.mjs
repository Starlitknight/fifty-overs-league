// init-world.mjs — founds the world (idempotent). P2 scope: ALL 19 nations.
// England keeps its named county clubs (the user-facing league); every other
// nation's ten sides are read from the SHIPPED build via the engine host
// (host.worldConfig()), so the served world and the client planet agree by
// construction. expandWorld() upgrades a P1 (England-only) database in
// place: it founds only the countries that are missing and never touches
// an existing country's clubs, seasons or matches.
import { makePool } from './db.mjs';
import { makeHost, ENGINE_VERSION } from './enginehost.mjs';
import { EPOCH, CYCLE, ROUNDS, dayIx, scheduleOf, seasonSchedules, natHour } from './clock.mjs';
import { foundingSeats, foundingBank } from './economy.mjs';
import { expOfYears, expWordOf } from './living.mjs';

// EVERY LEAGUE IS ANCHORED BY A REAL CLUB. Slot 0 is the country's most
// storied side - the name a supporter there would give you first - with its
// real home. It is the one club no manager may take over: the league's
// standing measure, the game everyone else is trying to beat.
export const FLAGSHIPS = {
  eng: { name: 'Essex', ground: 'Chelmsford' },
  ire: { name: 'Leinster Lightning', ground: 'Malahide' },
  ned: { name: 'VOC Rotterdam', ground: 'Hazelaarweg' },
  win: { name: 'Barbados', ground: 'Kensington Oval' },
  rsa: { name: 'Western Province', ground: 'Newlands' },
  zim: { name: 'Mashonaland Eagles', ground: 'Harare Sports Club' },
  aus: { name: 'New South Wales', ground: 'The Sydney Cricket Ground' },
  nzl: { name: 'Canterbury', ground: 'Hagley Oval' },
  slk: { name: 'Sinhalese Sports Club', ground: 'The SSC Ground' },
  sub: { name: 'Cricket Club of India', ground: 'Brabourne Stadium' },
  pak: { name: 'Karachi Whites', ground: 'National Stadium' },
  afg: { name: 'Band-e-Amir Dragons', ground: 'Kabul International' },
  bgd: { name: 'Abahani Limited', ground: 'Sher-e-Bangla Stadium' },
  nep: { name: 'Tribhuvan Army Club', ground: 'The TU Ground' },
  sco: { name: 'The Grange', ground: 'Raeburn Place' },
  usa: { name: 'Philadelphia Cricket Club', ground: "St Martin's" }
};

// England hand-named: Division One is the boss and seven first-flight
// counties; Division Two is the second flight - Glamorgan included, wearing
// the daffodil in an English league, which is where Welsh county cricket has
// always really lived. MUST agree name-for-name with the client's ENG_SIDES
// (27-living-planet.js) or orders keyed by club name would miss.
export const ENG_CLUBS = [
  { slot: 0, name: FLAGSHIPS.eng.name, ground: FLAGSHIPS.eng.ground, boss: true, arch: 'rock' },
  { slot: 1, name: 'Yorkshire', ground: 'Headingley', arch: 'rock' },
  { slot: 2, name: 'Lancashire', ground: 'Old Trafford', arch: 'rock' },
  { slot: 3, name: 'Surrey', ground: 'The Oval', arch: 'rock' },
  { slot: 4, name: 'Middlesex', ground: "Lord's", arch: 'rock' },
  { slot: 5, name: 'Warwickshire', ground: 'Edgbaston', arch: 'rock' },
  { slot: 6, name: 'Nottinghamshire', ground: 'Trent Bridge', arch: 'rock' },
  { slot: 7, name: 'Kent', ground: 'Canterbury', arch: 'rock' },
  { slot: 8, name: 'Durham', ground: 'The Riverside', arch: 'rock' },
  { slot: 9, name: 'Somerset', ground: 'Taunton', arch: 'rock' },
  { slot: 10, name: 'Glamorgan', ground: 'Sophia Gardens', arch: 'rock' },
  { slot: 11, name: 'Sussex', ground: 'Hove', arch: 'rock' },
  { slot: 12, name: 'Gloucestershire', ground: 'Bristol', arch: 'rock' },
  { slot: 13, name: 'Hampshire', ground: 'The Rose Bowl', arch: 'rock' },
  { slot: 14, name: 'Derbyshire', ground: 'Queen\'s Park', arch: 'rock' },
  { slot: 15, name: 'Leicestershire', ground: 'Grace Road', arch: 'rock' }
];

// one uniform founding shape per country: England hand-named, the rest
// exactly as the shipped client's planet seats them
// EVERY CLUB CARRIES ITS OWN CRICKET. arch (which side they are) and str (how
// good they are) ride in per club, read off the planet's table - not one
// archetype for a whole nation, which is what made ten clubs feel like one club
// ten times over. England keeps its hand-named counties; their identities and
// standings come from the same table, seated by slot.
export function countryConfigs(host) {
  return host.worldConfig().map(r => {
    const byIx = {};
    (r.sides || []).forEach(s => { byIx[s.slot] = s; });
    if (r.id === 'eng') return {
      id: 'eng', name: 'England', nat: 'England', arch: 'rock', capt: 'talisman', hour: 14,
      clubs: ENG_CLUBS.map(c => ({
        slot: c.slot, name: c.name, ground: c.ground, boss: !!c.boss,
        div: (byIx[c.slot] || {}).div || (c.slot < 8 ? 1 : 2),
        arch: (byIx[c.slot] || {}).arch, str: (byIx[c.slot] || {}).str
      }))
    };
    return {
      id: r.id, name: r.name, nat: r.nat, arch: r.arch, capt: r.capt, hour: r.hour,
      clubs: r.sides.map(s => Object.assign(
        { slot: s.slot, boss: !!s.boss, arch: s.arch, str: s.str, div: s.div || (s.slot < 8 ? 1 : 2) },
        (s.boss && FLAGSHIPS[r.id])
          ? { name: FLAGSHIPS[r.id].name, ground: FLAGSHIPS[r.id].ground }
          // a founded small club plays on a green, not at a Ground
          : { name: s.name, ground: s.city + (s.slot >= 8 ? ' Green' : ' Ground') }))
    };
  });
}

// ONE PLACE THAT SAYS WHAT SQUAD A CLUB HAS. Founding and reseeding both come
// through here, so a club refounded today is the club it would have been on day
// one: same seed, same identity, same standing, same eleven.
//
// WITHIN A GENERATION. The seed used to be a constant - a club's eleven was a
// pure function of its position, forever - which made the world reproducible
// and made a REDEAL impossible: reseeding called this with the same arguments
// and necessarily dealt the same men back. The generation is what a reseed
// moves, so position-stability holds inside a generation (an expansion founds
// a country as it would have been on day one) and a redeal genuinely redeals.
// Generation 1 spells 'world1', the seed every club alive today was dealt from.
//
// THE LEAGUE TABLE IS DESIGNED, NOT DEALT. The generator's raw output varies
// hugely with the seed - the old world's strongest club sat 90% above its
// weakest, PURE LUCK, and at that spread the "match" between them was a 99.8%
// procession. Real one-day cricket never produces a favourite past ~88%, and
// a league drawn from one talent pool spans nothing like 90%. So every squad
// is CALIBRATED after it is dealt: scaled onto a deliberate ladder of club
// strengths, anchored at the old world's median so wages and prices stay
// where they were. WHO the men are - names, roles, archetypes, who bowls,
// who keeps - is still entirely the deal; the ladder only says how good each
// CLUB is, which is a design decision someone was always making (previously:
// the dice).
//
// The ladder itself is the PLANET'S OWN (27-living-planet.js): every club's
// standing is already designed there, boss 1.2 down to 0.8, and the client
// shows those standings on every dossier - so the umpire calibrates to the
// same table the phones display. The fallback below only catches a club the
// planet forgot to grade, so a missing row degrades to "ordinary" rather
// than to luck.
export const STR_FALLBACK = 1;

// ---------------------------------------------------------------------------
// THE TEN-POINT LADDER (see 27-living-planet.js, which holds the club rungs).
//
// One rung is 10.4% of an XI rating, and it is set by how a player READS on
// his card rather than by a win rate. The world used to live between 39 and 60
// on the nought-to-ninety-nine scale: the top half was never used, so an
// international looked like a slightly-better club player - which is exactly
// what he was, because a national side is picked from clubs. Seven rungs is
// now exactly 2x, which lands a full member's XI near 78 with a genuine 99
// among them and a bottom second-division side near 38.
//
// This is close to the ceiling. Skills cap at 99, and past about 60,000 the
// cards flatten - at 72,000 an XI averages 91 with a quarter of all skills
// pegged, and at 90,000 every card reads 99 and the top three tiers become
// the same team. The engine also saturates at about 1.7x for RESULTS, so the
// span above buys separation on the card, not in the scorebook.
//
// Point 4 is 1.00: the old world's median club, so wages, transfer prices and
// the books stay calibrated where they were.
export const PT = 1.093;
// what point 4 is worth against BASE_XI. The ladder no longer hangs off 1.00
// at the median, because the band the engine still answers in tops out near
// 39,000 for a club - see 27-living-planet.js for the measurement.
// Re-anchored when the ladder was lifted off the floor: point 4 is now the
// seam between the two divisions, which is where the club ladder's own
// FO_D2_LADDER[0] sits. pt() stays the documented points-to-strength mapping.
export const PT4 = 0.950;
export function pt(points) { return PT4 * Math.pow(PT, points - 4); }
// THE NEWCOMER'S RUNG. Every human-claimed club is dealt (and, on a fresh
// claim, levelled) to this strength x the nation tier: a solid Division Two
// side - competitive at once among its own kind, with the whole pyramid still
// to climb. The seating chart decides a bot's class; it never again decides
// a person's.
//
// IT DROPPED A RUNG WHEN THE LADDER WAS STRETCHED. The club world used to
// span 1.24x from floor to summit, and a flagship beat a newcomer only 72
// times in 100 - the summit of the pyramid a three-in-four favourite over its
// floor. The rungs in 27-living-planet.js now fill the band the engine really
// answers in, and the newcomer sits at the foot of them where he always did:
// a point below the second division's last rung, with the whole climb ahead.
// He is not weaker against the clubs he actually plays - his own division
// came down with him - he is further from the top, which is the point.
export const HUMAN_STR = pt(2);                // 0.795: a club founded this morning
export const BASE_XI = 36000;                 // the old world's median XI rating

// A LEAGUE IS AS STRONG AS ITS CRICKET CULTURE. Every nation's ten clubs used
// to draw from one identical talent pool, so a Dutch mid-table side was the
// equal of an Australian one and the World Cup was a coin toss between giants
// and minnows. Each nation now carries a tier calibrated loosely against real
// one-day standing: the subcontinent and the big three at the top, the
// associates below. WITHIN a league nothing changes - the same ladder rides
// on top of the tier, so every domestic season is exactly as competitive as
// every other. The tier shows where leagues MEET: continental cups, the World
// Cup windows, a friendly across borders - there an Australian club really
// does outgun a Canadian one, and national sides inherit their true pecking
// order from the domestic talent they are picked from.
// FULL MEMBERS AND ASSOCIATES. Two bands, not nineteen rungs: a nation is
// either one of the ten countries that have always played the long form or it
// is an associate. The difference is three and a half rungs of the club
// ladder, so the best club in the Netherlands is about a mid-table Division
// One side in England - which is what it is. The size is not a taste call: a
// national XI is capped near 47,500 because run-scoring saturates above that,
// so the only way an associate's own country can out-rank its own best club
// is for the associate's clubs to sit further down. At a rung and a half the
// Dutch national side beat the best Dutch club 53 times in 100 - a coin toss
// between a country and a club. At three and a half it is 71, the same real
// contest Australia's country gives Australia's best club (69).
export const FULL_MEMBERS = ['eng', 'aus', 'sub', 'pak', 'rsa', 'nzl', 'slk', 'bgd', 'win', 'zim'];
const FULL = new Set(FULL_MEMBERS);
export const isFullMember = id => FULL.has(id);
// The tier is a MULTIPLIER on the club's own rung, not a rung of its own, so
// it is a RATIO between two points on the ladder and never the ladder's base.
// (It was once written pt(2.5), which silently folded PT4 in and moved every
// associate club whenever the club ladder was re-anchored.)
// AND IT CANNOT BE BIG, because the whole world has to fit above the floor.
// Three and a half rungs put an associate's second division at 18,200 with its
// skills pegged at 2 - inside the band where the ladder inverts (see
// 27-living-planet.js). One and a quarter rungs is what the band affords: it
// keeps the weakest club in the world at 28,400, where a rung still converts.
export const ASSOC_STR = 0.885;                // ~1.25 rungs
export const NAT_STR = Object.fromEntries(
  ['eng', 'ire', 'ned', 'win', 'rsa', 'zim', 'aus', 'nzl', 'slk', 'sub', 'pak', 'afg',
   'bgd', 'nep', 'sco', 'usa'].map(id => [id, FULL.has(id) ? 1 : ASSOC_STR]));

// AND WHAT A COUNTRY IS WORTH WHEN IT PLAYS AS A COUNTRY. A national side used
// to have no strength of its own at all: nations.mjs picks the best fifteen
// men out of that country's clubs, so an XI could never be better than the
// clubs it came from - which is exactly why a second-division side from a
// small nation read as the near-equal of a great one. Pulling on the shirt is
// now worth something, and what it is worth is the nation's own rung.
// A NATION IS NOT ON THE CLUB LADDER. The band the engine answers in is only
// so wide, and it has to hold a second division, a first, a flagship and two
// tiers of country. Placing the countries on the club ladder made Australia
// and Canada a coin toss; they are placed directly instead, far enough apart
// that a rung converts - 47,500 against 38,000, which measures 91 wins in 100
// over 100 matches. A flagship at 39,000 still gets a real game against
// either: it takes 31 off Australia's country and 29 off the Netherlands'.
// EVERY COUNTRY ITS OWN RUNG, not two bands. The full members used to share
// one number, so Australia against India was a coin toss decided by which
// squad the generator happened to deal - a pecking order the world implied
// and never expressed. They are placed directly, loosely against real one-day
// standing. The spread is DELIBERATELY NARROW: a national XI is capped near
// 47,500 (run-scoring saturates above it) and has to stay above its own best
// club at 39,000, so the ten of them share about 44,000 to 47,500. That buys
// roughly 55-60% for the top nation over the bottom one - a real edge, not a
// procession, which is as much as the band allows.
export const NAT_TEAM_XI = {
  sub: 47500, aus: 47500, rsa: 46500, eng: 46500, nzl: 46000,
  pak: 45500, slk: 45000, win: 44500, bgd: 44000, zim: 44000
};
export const ASSOC_TEAM_XI = 41000;
export function nationTeamStr(id) {
  return (FULL.has(id) ? (NAT_TEAM_XI[id] || 44000) : ASSOC_TEAM_XI) / BASE_XI;
}

export const xiOf = sq => {
  const best = sq.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 11);
  return best.reduce((s, p) => s + (p.rating || 0), 0) / Math.max(1, best.length);
};

// scale every man's skills until the XI lands on target; ratings and wages are
// re-derived by the engine's own mapping, so nothing is hand-set. Exported:
// the reseed deals with it, and the umpire levels a fresh claim with it -
// same men, same names, same careers, raised (or trimmed) to the rung.
// THE GLOVES AND THE HANDS ARE NOT SCALED. Calibration exists to seat a club
// at a league's strength, and it did that by multiplying EVERY skill a man
// has - including the four that have nothing to do with how hard he is to bowl
// at. That is why the world's fielding lived in a band from 20 to 56: the
// generator dealt a bell and calibration pressed it flat, four times a club,
// again at every levelling.
//
// Worse, it was a loop. Fielding feeds a man's rating, so widening the bell
// raised the rating, so calibration scaled harder, so the bell came out
// narrower than it went in.
//
// The first answer was to hold these four out of the pass entirely, on the
// reasoning that the bell is the same for every club so its contribution is
// the same for every club. That reasoning was wrong in one word - "same". It
// meant a flagship's cordon was no better than a bottom club's, which is not
// what anybody believes about cricket, and once catches began converting
// properly it started costing giants matches: p3 caught flagships going down
// in three nations of sixteen. They take HALF a club's factor now, which
// breaks the loop without flattening the ladder. world-ladder measures both
// ends of that trade in a second, so neither can drift again.
// the hands: dealt on the world's own bell, and scaled at HAND_SCALE of a
// club's factor rather than the full one (see calibrate below)
const NOT_SCALED = { fielding: 1, catching: 1, keeping: 1, stumping: 1 };
const HAND_SCALE = 0.5;
export function calibrate(host, squad, target) {
  let men = squad;
  for (let i = 0; i < 4; i++) {
    const have = xiOf(men);
    const f = target / Math.max(1, have);
    if (Math.abs(f - 1) < 0.004) break;
    // THE HANDS MOVE WITH THE CLUB, BUT ONLY HALF AS FAR. Holding them out of
    // this pass entirely was too blunt an answer to a real problem. The problem
    // was that fielding was dealt off a man's BATTING level and then multiplied
    // here as well, which squashed the whole world into a band of 20 to 56 and
    // put every good-fielding branch out of reach. The generator deals it on
    // its own bell now, so that cause is gone - and excluding it outright cost
    // something else: a flagship's cordon became no better than a bottom club's,
    // which p3 caught the moment catches started converting properly (flagships
    // relegated in three nations of sixteen, against a ladder that is supposed
    // to mean something). A stronger league genuinely does field better. It
    // just must not be the whole of the club's edge, or the absolute scale goes
    // flat again - so the hands take half the club's factor and keep their own
    // spread.
    const fh = 1 + (f - 1) * HAND_SCALE;
    men.forEach(p => {
      for (const k in (p.skills || {})) {
        const g = NOT_SCALED[k] ? fh : f;
        p.skills[k] = Math.max(2, Math.min(99, Math.round(p.skills[k] * g)));
      }
    });
    men = host.derive(men);
  }
  return men;
}

// THE FOUNDING CAST. A Division Two club is not a weaker copy of a county -
// it is what a new club actually is: one Old Pro on his way down (the oldest
// man becomes the 35-plus captain-mentor), a spine of local lads in their
// prime, and a bench of raw kids with everything still ahead of them. The
// weakness has causes you can see, and every cause has a cure: the kids grow,
// the old pro teaches, the lads get replaced one honest signing at a time.
// Deterministic - same seed, same cast - and calibration still owns the
// club's net strength, so the AGES are the story, not a hidden buff.
//
// AND EXPERIENCE GOES WITH THE AGE. It used to not: the men were sorted
// oldest-first and handed new ages, and every man kept the experience the
// generator dealt him for the age he no longer had. The sixth-oldest, dealt
// at twenty-six, walked out nineteen years old with a twenty-six-year-old's
// experience; the youngest walked out twenty-three with an eighteen-year-old's.
// Not merely uncorrelated with age - reversed. So the cast asks living.mjs
// for the number a man of that age reads at, which is the same number it
// would derive for him on the next fold anyway.
function foundingCast(squad) {
  const men = squad.slice().sort((a, b) => (b.age || 27) - (a.age || 27));
  men.forEach((p, i) => {
    if (i === 0) p.age = 36;                                  // the Old Pro
    else if (i <= 4) p.age = 27 + (i % 4);                    // the local lads
    else p.age = 19 + (i % 5);                                // the raw kids
    p.exp = expOfYears(p);
    p.expWord = expWordOf(p.exp);
  });
  return squad;
}

// strOverride: the reseed passes HUMAN_STR for a claimed club, so every
// human's fresh deal lands on the newcomer rung instead of the seat's
export function squadFor(host, cfg, club, gen = 1, strOverride = null) {
  const raw = host.genSquad('world' + ((gen | 0) || 1) + '|' + cfg.id + '|' + club.slot, cfg.nat,
    club.arch || cfg.arch, club.boss ? cfg.capt : 'general');
  const str = strOverride || club.str || STR_FALLBACK;
  const men = calibrate(host, raw, BASE_XI * (NAT_STR[cfg.id] || 1) * str);
  return (club.div === 2 || club.slot >= 8) ? foundingCast(men) : men;
}

// what generation this world is dealing from; 1 for a world founded before the
// counter existed, which is the generation those clubs were in fact dealt from
export async function worldGeneration(pool) {
  try {
    const r = await pool.query('SELECT generation FROM worlds WHERE id=1');
    return (r.rows[0] && r.rows[0].generation) | 0 || 1;
  } catch (e) { return 1; }
}

// the founding division map: div 1 = slots 0-7, div 2 = slots 8-15. Only the
// FIRST season is founded with it - every season after carries the map that
// promotion and relegation actually produced.
export function foundingDivisions(cfg) {
  const d = { 1: [], 2: [] };
  for (const club of cfg.clubs) d[club.div === 2 ? 2 : 1].push(club.slot);
  return d;
}

async function foundCountry(c, cfg, host, startDay, gen = 1) {
  await c.query('INSERT INTO countries(id, name, play_hour_utc) VALUES ($1,$2,$3)',
    [cfg.id, cfg.name, cfg.hour]);
  for (const club of cfg.clubs) {
    // squad seeds are position-stable WITHIN A GENERATION: the same world, the
    // same eleven, until somebody deliberately redeals the world
    const players = squadFor(host, cfg, club, gen);
    // AND NO BOYS. The youth system is retired for now (075): a club is
    // founded with an empty academy list, and the scout's finds go straight
    // to the senior squad. foundAcademy stays in youth.mjs for the day the
    // Colts Cup comes back.
    const boys = [];
    // default_name is the club's birth name - a human rename never loses it
    await c.query(
      'INSERT INTO clubs(country_id, slot, name, default_name, ground, is_boss, squad, youth, seats, bank)'
      + ' VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9)',
      [cfg.id, club.slot, club.name, club.ground, !!club.boss,
       JSON.stringify(players), JSON.stringify(boys),
       // a club is founded with the ground and the capital its standing is
       // worth. Both are derived from the slot, so the books rebuild them; the
       // row carries them so a world reads right before its first settlement.
       foundingSeats(club.slot, !!club.boss), foundingBank(club.slot, !!club.boss)]);
  }
  // the seasons row carries the season's OWN division map and both divisions'
  // schedules - membership is seasonal, so the record of who played where
  // lives with the season that seated them
  const divs = foundingDivisions(cfg);
  await c.query('INSERT INTO seasons(country_id, season_no, start_day, schedule, divisions) VALUES ($1,$2,$3,$4,$5)',
    [cfg.id, 1, startDay, JSON.stringify(seasonSchedules(cfg.id, 1, divs)), JSON.stringify(divs)]);
}

export async function initWorld(pool, { now = Date.now(), host = null } = {}) {
  const h = host || makeHost();
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const w = await c.query('SELECT 1 FROM worlds WHERE id=1');
    if (w.rowCount) { await c.query('ROLLBACK'); return { created: false }; }
    await c.query('INSERT INTO worlds(id, epoch_ms, cycle_days, league_rounds, engine_version, generation) VALUES (1,$1,$2,$3,$4,1)',
      [EPOCH, CYCLE, ROUNDS, ENGINE_VERSION]);
    // a world founded BEFORE its epoch opens on day 0 - Monday 3 August 2026,
    // the first Monday of the first five-week season. Founded later, the
    // season starts tomorrow as ever.
    const startDay = Math.max(0, dayIx(now) + 1);
    const cfgs = countryConfigs(h);
    for (const cfg of cfgs) await foundCountry(c, cfg, h, startDay, 1);
    await c.query('COMMIT');
    return { created: true, startDay, countries: cfgs.map(x => x.id) };
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

// the in-place upgrade: found ONLY the countries this database is missing.
// Each new country lands in its own transaction; existing countries — their
// clubs, seasons, matches, standings — are never touched.
export async function expandWorld(pool, { now = Date.now(), host = null } = {}) {
  const h = host || makeHost();
  const have = new Set((await pool.query('SELECT id FROM countries')).rows.map(r => r.id));
  const missing = countryConfigs(h).filter(cfg => !have.has(cfg.id));
  const startDay = dayIx(now) + 1;
  // a country joining late joins THIS world, so it is dealt from the generation
  // the rest of the world is living in - not from generation one
  const gen = await worldGeneration(pool);
  const added = [];
  for (const cfg of missing) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await foundCountry(c, cfg, h, startDay, gen);
      await c.query('COMMIT');
      added.push(cfg.id);
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  return { added, startDay: added.length ? startDay : null };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pool = makePool();
  (async () => {
    const r = await initWorld(pool);
    if (r.created) {
      console.error('world founded with ' + r.countries.length + ' leagues, season 1 begins day ' + r.startDay);
    } else {
      const x = await expandWorld(pool);
      console.error(x.added.length
        ? 'world expanded: ' + x.added.join(', ') + ' founded, their season 1 begins day ' + x.startDay
        : 'world already complete');
    }
    await pool.end();
  })().catch(e => { console.error(e); process.exit(1); });
}
