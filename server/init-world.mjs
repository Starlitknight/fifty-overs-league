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

export const ENG_CLUBS = [
  { slot: 0, name: "Sir Giles Pemberley's XI", ground: "The Pemberley Oval", boss: true, arch: 'rock' },
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
export function countryConfigs(host) {
  return host.worldConfig().map(r => r.id === 'eng'
    ? {
        id: 'eng', name: 'England', nat: 'England', arch: 'rock', capt: 'talisman', hour: 14,
        clubs: ENG_CLUBS.map(c => ({ slot: c.slot, name: c.name, ground: c.ground, boss: !!c.boss }))
      }
    : {
        id: r.id, name: r.name, nat: r.nat, arch: r.arch, capt: r.capt, hour: r.hour,
        clubs: r.sides.map(s => ({ slot: s.slot, name: s.name, ground: s.city + ' Ground', boss: !!s.boss }))
      });
}

async function foundCountry(c, cfg, host, startDay) {
  await c.query('INSERT INTO countries(id, name, play_hour_utc) VALUES ($1,$2,$3)',
    [cfg.id, cfg.name, cfg.hour]);
  for (const club of cfg.clubs) {
    // squad seeds are position-stable: the same world, the same eleven, forever
    const players = host.genSquad('world1|' + cfg.id + '|' + club.slot, cfg.nat, cfg.arch, club.boss ? cfg.capt : 'general');
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
    await c.query('INSERT INTO worlds(id, epoch_ms, cycle_days, league_rounds, engine_version) VALUES (1,$1,$2,$3,$4)',
      [EPOCH, CYCLE, ROUNDS, ENGINE_VERSION]);
    const startDay = dayIx(now) + 1;
    const cfgs = countryConfigs(h);
    for (const cfg of cfgs) await foundCountry(c, cfg, h, startDay);
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
  const added = [];
  for (const cfg of missing) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await foundCountry(c, cfg, h, startDay);
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
