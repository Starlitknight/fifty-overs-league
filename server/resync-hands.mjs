// resync-hands.mjs — PUT EVERY MAN'S HANDS BACK ON THE BELL THE GENERATOR
// DEALS THEM FROM.
//
// 084 put the world's hands on a real scale. It did not stick. The nets are a
// derivation - living.mjs rebuilds a squad from baseSkills and replays the
// training it has done - and no migration has ever written baseSkills, so the
// first refold after 084 restored every man from before it. Reproduced on a
// founded world: stretch a squad to 69.8, one refold, back to 49.7.
//
// The proof is on the live world, in the one place a refold cannot reach.
// A listing is a SNAPSHOT of a man taken when he was put up for sale, and
// nothing refolds it - so listings kept the stretch while the clubs they came
// from lost it. Of 74 men who appear both on the open market and on their
// club's card, 73 disagree about their own hands, and they disagree by exactly
// one application of 084's map:
//
//     card 40 -> 50 + (40 - 36) * 1.44 = 55.8, and the listing says 55
//     card 31 ->                          42.8, and the listing says 42
//     card 47 ->                          65.8, and the listing says 66
//
// So the clubs are still on the old scale: a world whose fielding averages
// about 40 where a squad dealt today averages 50, which is why the contest
// needed a floor under it to behave at all.
//
// THIS RE-DERIVES RATHER THAN RE-STRETCHES, and that is the whole of the care
// in it. Stretching again would need to know which men had already been
// stretched and which had not, and there is no way to tell one from the other
// by looking - the two ranges overlap, and a wrong guess doubles a man's
// hands for ever. Every generated cricketer instead has his hands read off the
// clean squad his seed makes, matched BY ID, which is exact, idempotent, and
// impossible to apply twice.
//
// A man the clean squad does not hold was made after the founding - a graduate
// out of an academy, a signing off the market - and he was made by the CURRENT
// generator, so his hands are already on the current bell. He is left alone.
//
// What it costs is what 091's did: a man who has genuinely trained his hands
// has that gain folded away rather than replayed. Until tonight no bot
// programme trained fielding at all, so there is next to nothing to lose.
//
//   node server/resync-hands.mjs           # report only, writes nothing
//   node server/resync-hands.mjs --write   # put them back

import { makePool } from './db.mjs';
import { makeHost } from './enginehost.mjs';
import { countryConfigs, worldGeneration } from './init-world.mjs';

const HANDS = ['fielding', 'catching', 'keeping', 'stumping'];

// one man, against the man his seed makes.
//
// IT LIFTS, IT NEVER LOWERS, and that is what makes it safe to leave running.
// Setting a man's hands EQUAL to his clean ones would be right exactly once:
// the moment the nets give him a point of fielding he has earned, the next run
// would take it straight back off him, and this runs every tick - fielding
// would be capped at its dealt value for ever, which is the very complaint
// that started all of this.
//
// So what moves is the BASELINE, and his skills move with it by the same step.
// A man whose baseline is below the bell is a man the old scale left there; he
// is shifted up onto it and keeps every point he has trained above it. A man
// already at or above the bell is not touched at all - and after one pass his
// baseline IS the bell, so the step is nought and it never fires again.
// the corruption guard, the same number the shipped engine defines it as
const LATENT_MAX = 250;
export function resyncMan(p, clean) {
  if (!p || !p.skills || !clean || !clean.skills) return 0;
  let moved = 0;
  for (const k of HANDS) {
    const want = clean.skills[k];
    if (want == null) continue;
    const base = (p.baseSkills && p.baseSkills[k] != null) ? p.baseSkills[k] : p.skills[k];
    const step = want - base;
    if (!(step > 0)) continue;                 // he is on the bell, or above it
    if (p.baseSkills) p.baseSkills[k] = want;
    // BOUNDED BY THE CORRUPTION GUARD, not by the old ceiling. A gloveman whose
    // baseline lift would carry him past 99 is an ordinary cricketer now, and
    // clamping him here would put back the exact ceiling the latent model was
    // built to remove - one module at a time, where nobody would look for it.
    if (p.skills[k] != null) p.skills[k] = Math.max(1, Math.min(LATENT_MAX, p.skills[k] + step));
    moved++;
  }
  return moved;
}

export async function resyncWorld(pool, host, { write = false, quiet = false } = {}) {
  const gen = await worldGeneration(pool);
  const cfgs = countryConfigs(host);
  const tot = { men: 0, moved: 0, skipped: 0, clubs: 0, before: 0, after: 0, n: 0 };

  for (const cfg of cfgs) {
    const clubs = (await pool.query(
      'SELECT slot, name, squad, youth FROM clubs WHERE country_id=$1 ORDER BY slot',
      [cfg.id])).rows;
    for (const c of clubs) {
      const squad = c.squad || [], youth = c.youth || [];
      const spec = (cfg.clubs || []).find(x => x.slot === c.slot) || {};
      let clean = [];
      try {
        clean = host.genSquad('world' + gen + '|' + cfg.id + '|' + c.slot, cfg.nat,
          spec.arch || cfg.arch, spec.boss ? cfg.capt : 'general') || [];
      } catch (e) { clean = []; }
      const byPid = new Map();
      clean.forEach(p => { if (p && p.pid) byPid.set(p.pid, p); });

      let moved = 0;
      for (const p of squad.concat(youth)) {
        if (!p || !p.skills) continue;
        tot.men++;
        if (p.skills.fielding != null) { tot.before += p.skills.fielding; tot.n++; }
        const clean1 = p.pid ? byPid.get(p.pid) : null;
        if (!clean1) { tot.skipped++; if (p.skills.fielding != null) tot.after += p.skills.fielding; continue; }
        moved += resyncMan(p, clean1);
        if (p.skills.fielding != null) tot.after += p.skills.fielding;
      }
      // AND THE ENGINE'S OWN NUMBERS ARE RE-DERIVED, BY THE ENGINE.
      //
      // resyncMan used to finish by copying p.skills.fielding onto p.field and
      // p.skills.keeping onto p.keeping, which was exactly right while the two
      // were the same number. They are not any more: p.field is the EFFECTIVE
      // fielding the ball model reads and p.skills.fielding is the latent one
      // stored on him, and above 99 they differ by design. So the copy declared
      // a man out of step with himself on every pass, and a resync with nothing
      // to do reported fifty-nine clubs moved and wrote them all back - an
      // idempotence failure that would have run on every tick for ever.
      //
      // jsDerive is the only thing that may compute those numbers, so it does.
      if (moved) {
        try {
          const all = squad.concat(youth);
          const d = host.derive(all);
          all.forEach((q, i) => {
            if (!d[i]) return;
            q.field = d[i].field; q.keeping = d[i].keeping;
            q.bat = d[i].bat; q.threat = d[i].threat; q.control = d[i].control;
            q.rating = d[i].rating; q.wage = d[i].wage;
          });
        } catch (eD) { /* an older host without derive leaves them as they were */ }
      }
      if (moved) {
        tot.moved += moved; tot.clubs++;
        if (write) {
          await pool.query(
            'UPDATE clubs SET squad=$3::jsonb, youth=$4::jsonb WHERE country_id=$1 AND slot=$2',
            [cfg.id, c.slot, JSON.stringify(squad), JSON.stringify(youth)]);
        }
        if (!quiet) console.log(`${cfg.id}/${c.slot} ${c.name}: ${moved} numbers put back`);
      }
    }
  }
  const mean = v => tot.n ? (v / tot.n).toFixed(1) : '-';
  if (!quiet) {
    console.log(`\n${write ? 'RESYNCED' : 'DRY RUN'}: ${tot.clubs} clubs, ${tot.moved} numbers, ` +
      `${tot.men} men (${tot.skipped} made after the founding, left alone)`);
    console.log(`world mean fielding: ${mean(tot.before)} -> ${mean(tot.after)}`);
    if (!write) console.log('nothing written - pass --write to put them back');
  }
  return { ...tot, meanBefore: +mean(tot.before), meanAfter: +mean(tot.after) };
}

// run from the command line, or from the tick; imported by a test, it does
// nothing until it is called
if (import.meta.url === ('file://' + process.argv[1])) {
  const pool = makePool();
  resyncWorld(pool, makeHost(), { write: process.argv.includes('--write') })
    .then(() => pool.end())
    .catch(e => { console.error(e); process.exit(1); });
}
