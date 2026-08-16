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
import { foundingSeats, foundingBankFor, era2Season } from './economy.mjs';
import { expOfYears, expWordOf } from './living.mjs';
import { squadStrength } from './ratings.mjs';

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
// THE LEAGUE TABLE IS DESIGNED, NOT DEALT, AND B2 CHANGED WHAT "DESIGNED"
// MEANS. The generator's raw output varies hugely with the seed - the old
// world's strongest club sat 90% above its weakest, PURE LUCK, and at that
// spread the "match" between them was a 99.8% procession. Real one-day cricket
// never produces a favourite past ~88%. So a club's standing has always been a
// design decision somebody was making, and the only question was how.
//
// It used to be a MULTIPLIER: every club was dealt and then calibrate() scaled
// every skill of every man, four passes, until the squad's XI RATING hit a
// number on a ten-point ladder anchored at BASE_XI = 36,000, the old world's
// median. That is gone, all of it - the ladder, the anchor, the multiplier and
// the four passes. A club now names a TIER (tierOfClub below) and its men are
// dealt onto that tier's own distribution of canonical overalls, which is a
// statement about cricketers rather than about a metric.
//
// WHAT WENT WITH IT, and why none of it can be quietly restored:
//
//   BASE_XI (36,000)      the old world's median XI rating. Rating is the
//                         canonical card times a thousand now, so the world's
//                         median XI reads about 60,000 and this constant names
//                         a quantity that no longer exists.
//   PT / PT4 / pt()       the ten-point club ladder, in rating multiples.
//   HUMAN_STR (pt(2))     the newcomer's rung on it. A claimed club is laid on
//                         the newcomer TIER now (tick.mjs levelNewClaims).
//   NAT_TEAM_XI,          what a national side was declared to be worth. A
//   ASSOC_TEAM_XI,        country's rating is measured off the eleven it can
//   nationTeamStr()       actually field now (tick.mjs natRating), so a
//                         declared figure would only measure itself.
//   calibrate()           the four-pass scaling itself.
//
// WHAT SURVIVES, and what it is for. NAT_STR is the last place a nation's
// standing is still written down rather than measured, and it has exactly one
// job left: SEEDING. A snake draw for a continental cup needs the countries in
// a stated order before any squad exists, and "full members are seeded above
// associates" is a competition rule, not a claim about how good anybody is. It
// never touches a skill, a card or a price. Where the nation genuinely does
// make a club stronger, it does it by moving the club a TIER (see tierOfClub),
// which is the difference between "an Australian club is a Dutch club times
// 1.3" and "an Australian club is one rung of the world's ladder above a Dutch
// one" - and B1 measured why it has to be the second: a uniform squad-wide edge
// of five raw points wins more than nine matches in ten, so a world built on
// multipliers has no upsets anywhere in it.
export const STR_FALLBACK = 1;

// FULL MEMBERS AND ASSOCIATES. Two bands, not nineteen rungs: a nation is
// either one of the ten countries that have always played the long form or it
// is an associate. Under B2 the difference is one tier of the club ladder, so
// the best club in the Netherlands is about a mid-table Division One side in
// England - which is what it is.
export const FULL_MEMBERS = ['eng', 'aus', 'sub', 'pak', 'rsa', 'nzl', 'slk', 'bgd', 'win', 'zim'];
const FULL = new Set(FULL_MEMBERS);
export const isFullMember = id => FULL.has(id);
// the seeding key, and nothing else - see the note above. It is a rank rather
// than a ratio now, and the only property any caller may rely on is that a full
// member sorts above an associate.
export const ASSOC_STR = 0.885;
export const NAT_STR = Object.fromEntries(
  ['eng', 'ire', 'ned', 'win', 'rsa', 'zim', 'aus', 'nzl', 'slk', 'sub', 'pak', 'afg',
   'bgd', 'nep', 'sco', 'usa'].map(id => [id, FULL.has(id) ? 1 : ASSOC_STR]));

// WHAT AN ELEVEN IS WORTH: the mean rating of a squad's best eleven, which
// under B2 is the mean canonical OVR of its best eleven times a thousand. It is
// a reading of the men, not a target anybody aims at. (ratings.mjs
// squadStrength is the stricter reading - the eleven a club can actually FIELD,
// keeper and five bowlers included - and is what the world rankings stand on.)
export const xiOf = sq => {
  const best = sq.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 11);
  return best.reduce((s, p) => s + (p.rating || 0), 0) / Math.max(1, best.length);
};

// WHAT EACH TIER IS SUPPOSED TO LOOK LIKE, AS A BAND OF BEST-XI CARDS.
//
// This is B2's brief, written down where the world and the tests can both read
// it, and it is the thing that replaced "every club calibrates onto its rung".
// A tier is a DISTRIBUTION (engine 00-core.js FO_TIERS: a stated best player, a
// median, a floor, a drift and a chance of a genuine star), so a club drawn from
// one is not a club at a number - it is a club somewhere in a band, and two
// clubs of one tier are meant to differ. Every band overlaps its neighbours,
// which is the point: a 78 at a weak second-division side and a 52 at a flagship
// are both ordinary draws.
//
// TWO READINGS, because two different questions are asked of a tier and they do
// not have the same answer. A club's SQUAD mean is what the B2 brief states its
// tier bands in; its BEST ELEVEN runs about six cards higher, because a squad is
// fifteen and the bottom four of it never play. Quoting one where the other was
// meant is how a band comes to look breached when nothing is wrong.
//
// TIER_SQUAD_BAND is the brief itself, unchanged.
// TIER_XI_BAND is MEASURED, over all 256 clubs of generation 1:
//
//     tier      best-XI  min - max     squad mean
//     flagship     77.5  76.5 - 78.7   70.9
//     d1a          71.9  69.9 - 73.3   65.0
//     d1b          66.3  61.7 - 68.4   58.7
//     d2a          56.4  53.7 - 58.8   48.8
//     d2b          44.3  41.4 - 46.1   37.0
//     newcomer     36.4  34.6 - 38.2   29.4
//
// AND THE SPREAD WIDENED WHEN AGEING ARRIVED, which is why the tolerance below
// is five cards rather than four. The means have not moved - every one of them
// is within half a card of the figures this table first recorded - but a club's
// CURRENT XI now carries its age structure: men are dealt at their tier's mark
// adjusted for how far through their careers they are, so a club that happens
// to hold three thirty-four-year-olds really is weaker this season than the same
// club holding three twenty-seven-year-olds. Measured, that took d1b's weakest
// XI from 64.3 to 61.7. It is a fact about the world rather than a tier missing
// its mark, and the band has to be able to say so.
//
// and the bands below are those means with five cards of tolerance either side -
// wide enough that a redeal or a tuning change does not fail them for being a
// different draw, narrow enough that a club in the wrong tier's world cannot
// hide. Adjacent bands overlap, which is deliberate and is the whole design:
// the strongest d1b club out-fields the weakest d1a one.
export const TIER_SQUAD_BAND = {
  flagship: [68, 74], d1a: [62, 68], d1b: [54, 60],
  d2a: [44, 50], d2b: [32, 38], newcomer: [22, 30]
};
export const TIER_XI_BAND = {
  flagship: [72, 83], d1a: [67, 77], d1b: [61, 71],
  d2a: [51, 61], d2b: [39, 49], newcomer: [31, 41]
};

// THE FOUNDING CAST. A Division Two club is not a weaker copy of a county -
// it is what a new club actually is: one Old Pro on his way down (the oldest
// man becomes the 35-plus captain-mentor), a spine of local lads in their
// prime, and a bench of raw kids with everything still ahead of them. The
// weakness has causes you can see, and every cause has a cure: the kids grow,
// the old pro teaches, the lads get replaced one honest signing at a time.
// Deterministic - same seed, same cast - and the TIER owns the club's net
// strength, so the AGES are the story, not a hidden buff.
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

// ---- B2: WHICH TIER OF THE WORLD A CLUB IS ---------------------------------
//
// A club's quality used to be a MULTIPLIER on a rating target, and the squad was
// scaled at it four times over until its XI landed. That is gone. A club now
// names a tier - a distribution of overalls with a stated best player, median
// and floor - and the generator deals its men onto it.
//
// The tier is read off the two things that already describe a club: which
// division it plays in and where it sits in that division. A flagship is the
// boss seat; the rest of Division One splits into a stronger and a weaker half;
// Division Two does the same; and the bottom of Division Two in an associate
// nation is where a genuinely new club lives.
//
// THE NATION STILL MATTERS, and it matters the way it always did - a full
// member's cricket is better than an associate's - but it now moves a club by a
// TIER rather than by a factor on every skill of every man. That is the
// difference between "an Australian club is a Dutch club times 1.3" and "an
// Australian club is one rung of the world's ladder above a Dutch one", and B1
// measured why it has to be the second: a uniform squad-wide edge of five raw
// points wins more than nine matches in ten, so a world built on multipliers
// has no upsets in it anywhere.
const TIER_LADDER = ['newcomer', 'd2b', 'd2a', 'd1b', 'd1a', 'flagship'];
export function tierOfClub(cfg, club) {
  const div = club.div || (club.slot < 8 ? 1 : 2);
  let ix;
  if (club.boss) ix = 5;                                   // flagship
  else if (div === 1) ix = club.slot <= 3 ? 4 : 3;         // D1 tier A / tier B
  else ix = club.slot <= 11 ? 2 : 1;                       // D2 tier A / tier B
  // an associate's cricket sits a rung below a full member's, and the bottom of
  // an associate's second division is where the newly founded clubs are
  if (!isFullMember(cfg.id)) ix -= 1;
  return TIER_LADDER[Math.max(0, Math.min(5, ix))];
}
// claimed: the reseed says so for a club a person holds, and that club is dealt
// the newcomer's world rather than the seat's. It used to be spelled by passing
// HUMAN_STR - a strength MULTIPLIER - which had already stopped meaning anything
// when the tier replaced it and survived only as a truthy flag. A flag is what
// it is, so a flag is what it says.
export function squadFor(host, cfg, club, gen = 1, claimed = false) {
  // A HUMAN'S FRESH CLAIM IS A NEW CLUB, whatever seat it inherited - the same
  // tier a newly founded club is dealt, by the same curve.
  const tier = claimed ? 'newcomer' : tierOfClub(cfg, club);
  const men = host.genSquad('world' + ((gen | 0) || 1) + '|' + cfg.id + '|' + club.slot, cfg.nat,
    club.arch || cfg.arch, club.boss ? cfg.capt : 'general', 1, tier);
  // NO CALIBRATION PASS. The generator placed every man on the tier's curve by
  // a single scaling of his own skills, which is a similarity transform and
  // preserves his shape exactly. There is nothing left to correct, and the four
  // clamping iterations that used to run here were what flattened the world's
  // fielding into a band from 20 to 56.
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
      'INSERT INTO clubs(country_id, slot, name, default_name, ground, is_boss, squad, youth, seats, bank, best_xi_strength)'
      + ' VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10)',
      [cfg.id, club.slot, club.name, club.ground, !!club.boss,
       JSON.stringify(players), JSON.stringify(boys),
       // a club is founded with the ground and the capital its standing is
       // worth. Both are derived from the slot, so the books rebuild them; the
       // row carries them so a world reads right before its first settlement.
       // Which economy the country opens under decides the capital: a club
       // founded in era 2 starts on working capital sized to the new
       // turnover, not the old one (financeconfig.mjs).
       foundingSeats(club.slot, !!club.boss), foundingBankFor(club.slot, !!club.boss, era2Season(startDay)),
       // a club is born knowing what its eleven is worth, so a world founded
       // this morning never needs the backfill (migration 092)
       squadStrength(players)]);
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
