// init-world.mjs — founds the world (idempotent). P1 scope: England only —
// ten clubs (boss in slot 0), engine-generated squads, season 1 scheduled
// to begin on the NEXT world day at init time.
import { makePool } from './db.mjs';
import { makeHost, ENGINE_VERSION } from './enginehost.mjs';
import { EPOCH, CYCLE, ROUNDS, dayIx, scheduleOf, seedOf } from './clock.mjs';

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

export async function initWorld(pool, { now = Date.now(), host = null } = {}) {
  const h = host || makeHost();
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const w = await c.query('SELECT 1 FROM worlds WHERE id=1');
    if (w.rowCount) { await c.query('ROLLBACK'); return { created: false }; }
    await c.query('INSERT INTO worlds(id, epoch_ms, cycle_days, league_rounds, engine_version) VALUES (1,$1,$2,$3,$4)',
      [EPOCH, CYCLE, ROUNDS, ENGINE_VERSION]);
    await c.query("INSERT INTO countries(id, name, play_hour_utc) VALUES ('eng','England',14)");
    for (const club of ENG_CLUBS) {
      const players = h.genSquad('world1|eng|' + club.slot, 'England', club.arch, club.boss ? 'talisman' : 'general');
      await c.query(
        'INSERT INTO clubs(country_id, slot, name, ground, is_boss, squad) VALUES ($1,$2,$3,$4,$5,$6)',
        ['eng', club.slot, club.name, club.ground, !!club.boss, JSON.stringify(players)]);
    }
    const startDay = dayIx(now) + 1;
    await c.query('INSERT INTO seasons(country_id, season_no, start_day, schedule) VALUES ($1,$2,$3,$4)',
      ['eng', 1, startDay, JSON.stringify(scheduleOf('eng', 1))]);
    await c.query('COMMIT');
    return { created: true, startDay };
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const pool = makePool();
  initWorld(pool).then(r => { console.error(r.created ? 'world founded, season 1 begins day ' + r.startDay : 'world already exists'); return pool.end(); })
    .catch(e => { console.error(e); process.exit(1); });
}
