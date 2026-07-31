// init-world.mjs — founds the world (idempotent). P2 scope: ALL 19 nations.
// England keeps its named county clubs (the user-facing league); every other
// nation's ten sides are read from the SHIPPED build via the engine host
// (host.worldConfig()), so the served world and the client planet agree by
// construction. expandWorld() upgrades a P1 (England-only) database in
// place: it founds only the countries that are missing and never touches
// an existing country's clubs, seasons or matches.
import { makePool } from './db.mjs';
import { makeHost, ENGINE_VERSION } from './enginehost.mjs';
import { EPOCH, CYCLE, ROUNDS, dayIx, scheduleOf, natHour } from './clock.mjs';

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
  wal: { name: 'Glamorgan', ground: 'Sophia Gardens' },
  ken: { name: 'Nairobi Gymkhana', ground: 'The Gymkhana Ground' },
  usa: { name: 'Philadelphia Cricket Club', ground: "St Martin's" },
  can: { name: 'Ontario', ground: 'Maple Leaf Ground' }
};

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
  { slot: 9, name: 'Somerset', ground: 'Taunton', arch: 'rock' }
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
        arch: (byIx[c.slot] || {}).arch, str: (byIx[c.slot] || {}).str
      }))
    };
    return {
      id: r.id, name: r.name, nat: r.nat, arch: r.arch, capt: r.capt, hour: r.hour,
      clubs: r.sides.map(s => Object.assign(
        { slot: s.slot, boss: !!s.boss, arch: s.arch, str: s.str },
        (s.boss && FLAGSHIPS[r.id])
          ? { name: FLAGSHIPS[r.id].name, ground: FLAGSHIPS[r.id].ground }
          : { name: s.name, ground: s.city + ' Ground' }))
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
export const NAT_STR = {
  sub: 1.10, aus: 1.08, eng: 1.07, pak: 1.05, rsa: 1.05, nzl: 1.04, slk: 1.02,
  afg: 1.00, bgd: 0.98, win: 0.97, zim: 0.93, ire: 0.92, sco: 0.90, ned: 0.89,
  wal: 0.88, ken: 0.87, usa: 0.87, nep: 0.86, can: 0.85
};

const xiOf = sq => {
  const best = sq.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 11);
  return best.reduce((s, p) => s + (p.rating || 0), 0) / Math.max(1, best.length);
};

// scale every man's skills until the XI lands on target; ratings and wages are
// re-derived by the engine's own mapping, so nothing is hand-set
function calibrate(host, squad, target) {
  let men = squad;
  for (let i = 0; i < 4; i++) {
    const have = xiOf(men);
    const f = target / Math.max(1, have);
    if (Math.abs(f - 1) < 0.004) break;
    men.forEach(p => {
      for (const k in (p.skills || {}))
        p.skills[k] = Math.max(2, Math.min(99, Math.round(p.skills[k] * f)));
    });
    men = host.derive(men);
  }
  return men;
}

export function squadFor(host, cfg, club, gen = 1) {
  const raw = host.genSquad('world' + ((gen | 0) || 1) + '|' + cfg.id + '|' + club.slot, cfg.nat,
    club.arch || cfg.arch, club.boss ? cfg.capt : 'general');
  const str = club.str || STR_FALLBACK;
  return calibrate(host, raw, BASE_XI * (NAT_STR[cfg.id] || 1) * str);
}

// what generation this world is dealing from; 1 for a world founded before the
// counter existed, which is the generation those clubs were in fact dealt from
export async function worldGeneration(pool) {
  try {
    const r = await pool.query('SELECT generation FROM worlds WHERE id=1');
    return (r.rows[0] && r.rows[0].generation) | 0 || 1;
  } catch (e) { return 1; }
}

async function foundCountry(c, cfg, host, startDay, gen = 1) {
  await c.query('INSERT INTO countries(id, name, play_hour_utc) VALUES ($1,$2,$3)',
    [cfg.id, cfg.name, cfg.hour]);
  for (const club of cfg.clubs) {
    // squad seeds are position-stable WITHIN A GENERATION: the same world, the
    // same eleven, until somebody deliberately redeals the world
    const players = squadFor(host, cfg, club, gen);
    // default_name is the club's birth name - a human rename never loses it
    await c.query(
      'INSERT INTO clubs(country_id, slot, name, default_name, ground, is_boss, squad) VALUES ($1,$2,$3,$3,$4,$5,$6)',
      [cfg.id, club.slot, club.name, club.ground, !!club.boss, JSON.stringify(players)]);
  }
  await c.query('INSERT INTO seasons(country_id, season_no, start_day, schedule) VALUES ($1,$2,$3,$4)',
    [cfg.id, 1, startDay, JSON.stringify(scheduleOf(cfg.id, 1))]);
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
    const startDay = dayIx(now) + 1;
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
