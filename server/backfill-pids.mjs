// backfill-pids.mjs — GIVE THE MEN ALREADY ON THE BOOKS THE IDS THEY WERE
// BORN WITH.
//
// Every cricketer generated from now on is stamped with a pid at the moment he
// is made: a hash of the seed his squad came from plus his place in it. Both
// this server and every phone derive the same squad from the same seed, so
// both arrive at the same id without one ever being sent.
//
// The world already running was dealt before that line existed, so its men
// carry no id - and an id nobody has is an id nothing can match on. This walks
// every squad in the world and RE-DERIVES the clean generated squad it came
// from, which hands back the very ids those men would have been stamped with.
// Matched by name inside their own club and in order, so a squad that has been
// traded, aged and rebuilt still lands each man on his own id.
//
// A man the clean squad does not hold was not generated with it - a graduate
// from the academy, a signing off the market, a free agent. He gets a minted
// id instead, seeded on where he is and who he is so a second run of this
// script gives him the same one.
//
// IDEMPOTENT AND ADDITIVE. A player who already has a pid is left exactly as
// he is; nothing else about any man is touched. Run it as many times as you
// like.
//
//   node server/backfill-pids.mjs           # report only, writes nothing
//   node server/backfill-pids.mjs --write   # stamp them

import { makePool } from './db.mjs';
import { makeHost } from './enginehost.mjs';
import { countryConfigs, worldGeneration } from './init-world.mjs';

// the same avalanche the engine's own hash is, so a minted id cannot collide
// with a generated one: they wear different prefixes and always will
function h32(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function mintedPid(country, slot, p, i) {
  return 'x' + h32([country, slot, p.name || '', p.age || '', i].join('|')).toString(36);
}

// walk one stored squad against the clean one it was generated from
function stampSquad(clean, stored, country, slot) {
  const free = new Map();                      // name -> generated ids not yet claimed
  (clean || []).forEach(p => {
    if (!p || !p.name || !p.pid) return;
    if (!free.has(p.name)) free.set(p.name, []);
    free.get(p.name).push(p.pid);
  });
  let matched = 0, minted = 0, already = 0;
  (stored || []).forEach((p, i) => {
    if (!p) return;
    if (p.pid) { already++; return; }
    const q = free.get(p.name);
    if (q && q.length) { p.pid = q.shift(); matched++; return; }
    p.pid = mintedPid(country, slot, p, i);
    minted++;
  });
  return { matched, minted, already };
}

async function main() {
  const write = process.argv.includes('--write');
  const pool = makePool();
  const host = makeHost();
  const gen = await worldGeneration(pool);
  const cfgs = countryConfigs(host);
  const tot = { matched: 0, minted: 0, already: 0, clubs: 0 };

  for (const cfg of cfgs) {
    const clubs = (await pool.query(
      'SELECT slot, name, squad, youth FROM clubs WHERE country_id=$1 ORDER BY slot',
      [cfg.id])).rows;
    for (const c of clubs) {
      const squad0 = c.squad || [], youth0 = c.youth || [];
      // A CLUB WHERE EVERY MAN ALREADY HAS ONE COSTS NOTHING. Re-deriving a
      // squad runs the whole generator, and this script is wired into the
      // tick, which runs every hour - so the pass that has nothing to do must
      // not do any work. Once the world is stamped, and it stays stamped
      // because every man made after this carries an id from birth, the run
      // is one cheap read per club for ever after.
      if (squad0.every(p => !p || p.pid) && youth0.every(p => !p || p.pid)) {
        tot.already += squad0.length + youth0.length;
        continue;
      }
      // THE CLEAN SQUAD IS THE ONE THE SEED MAKES, and the seed is the club's
      // own address in this generation - the same string init-world founds
      // with and every phone re-derives from.
      // ARCHETYPE AND ALL: the archetype is mixed into the seed, so deriving
      // with the wrong one derives a different club's men entirely. These are
      // squadFor()'s own arguments, taken from the same config it founds from.
      const spec = (cfg.clubs || []).find(x => x.slot === c.slot) || {};
      let clean = [];
      try {
        clean = host.genSquad('world' + gen + '|' + cfg.id + '|' + c.slot, cfg.nat,
          spec.arch || cfg.arch, spec.boss ? cfg.capt : 'general') || [];
      } catch (e) { clean = []; }
      const squad = squad0, youth = youth0;
      const a = stampSquad(clean, squad, cfg.id, c.slot);
      // a colt was never in the clean squad - he is minted, which is right:
      // the academy made him and his id says so
      const b = stampSquad([], youth, cfg.id, c.slot);
      const touched = a.matched + a.minted + b.matched + b.minted;
      tot.matched += a.matched + b.matched;
      tot.minted += a.minted + b.minted;
      tot.already += a.already + b.already;
      if (touched) {
        tot.clubs++;
        if (write) {
          await pool.query(
            'UPDATE clubs SET squad=$3::jsonb, youth=$4::jsonb WHERE country_id=$1 AND slot=$2',
            [cfg.id, c.slot, JSON.stringify(squad), JSON.stringify(youth)]);
        }
      }
      console.log(`${cfg.id}/${c.slot} ${c.name}: ${a.matched} matched, ` +
        `${a.minted + b.minted} minted, ${a.already + b.already} already had one`);
    }
  }
  console.log(`\n${write ? 'STAMPED' : 'DRY RUN'}: ${tot.clubs} clubs, ` +
    `${tot.matched} matched to their generated id, ${tot.minted} minted, ` +
    `${tot.already} already had one`);
  if (!write) console.log('nothing written - pass --write to stamp');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
