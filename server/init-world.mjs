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
export function squadFor(host, cfg, club, gen = 1) {
  return host.genSquad('world' + ((gen | 0) || 1) + '|' + cfg.id + '|' + club.slot, cfg.nat,
    club.arch || cfg.arch, club.boss ? cfg.capt : 'general', club.str || 1);
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
