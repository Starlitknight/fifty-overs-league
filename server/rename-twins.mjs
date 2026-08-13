// rename-twins.mjs — NO TWO CLUBS IN ONE COUNTRY ANSWER TO THE SAME NAME.
//
// Ten pairs of clubs in this world share a name with a club in their own
// league: two Galway CCs in Ireland, two Chicago CCs in the States, two
// Deventer CCs and two Groningen CCs in the Netherlands. Every pair is a
// Division One club and a Division Two club from the same town - one plays at
// the Ground, the other on the Green - because a county is "<city> CC" and so
// is the first entry of DIV2_STYLE.
//
// A shared name is not only untidy. The game keys a great deal on a club's
// name - a teamsheet, an order, the fallback in the tick's own slotOf - and
// name-to-slot for those twenty clubs is a coin toss. It is the same fault as
// two cricketers of one name, one storey up.
//
// THE GENERATOR ALREADY FIXED THIS. sidesOf() seeds Division Two with the
// names Division One holds and div2Name steps the newcomer aside, so a world
// founded today has no clash in any nation - measured on the shipped build,
// 256 clubs, none repeated. What it cannot do is reach back: this world was
// founded before that guard existed and nothing renames a club afterwards. So
// the clubs table is the only thing still carrying the clash, and this brings
// it into line with the code that would deal it now.
//
// WHAT IT WILL NOT TOUCH:
//
//   A CLUB SOMEBODY MANAGES. A manager names his own club, and the generator
//   has an opinion about that slot which is none of its business - eng/8 is
//   Durham to the generator and Mashed Potatoes to the man who runs it.
//
//   A CLUB WHOSE NAME IS ITS OWN. Only a name shared with another club in the
//   same country is a defect; everything else is the world as dealt.
//
// The history stays attached. The tick reads every innings back to a SLOT
// through the names as played on the day (tick.mjs, "names AS PLAYED"), so a
// renamed club keeps its whole record and the books simply start speaking its
// current name at the next fold.
//
//   node server/rename-twins.mjs           # report only, writes nothing
//   node server/rename-twins.mjs --write   # give the newcomer its own name

import { makePool } from './db.mjs';
import { makeHost } from './enginehost.mjs';

// the name the shipped generator would deal this seat today
function bornAs(cfgs, rid, slot) {
  const r = cfgs.find(x => x.id === rid);
  if (!r) return null;
  const s = (r.sides || []).find(y => (y.slot | 0) === (slot | 0));
  return (s && s.name) || null;
}

export async function renameTwins(pool, host, { write = false, quiet = false } = {}) {
  const cfgs = host.worldConfig();
  // A CLUB IS MANAGED BY A CLAIM, not by a column on the club - world_clubs
  // only shows a manager because it joins one on. Reading the base table alone
  // would call every club in the world unmanaged and rename somebody's.
  const clubs = (await pool.query(`
    SELECT cl.country_id, cl.slot, cl.name, cl.default_name, c.display_name AS manager
      FROM clubs cl LEFT JOIN claims c
        ON c.country_id = cl.country_id AND c.slot = cl.slot
     ORDER BY cl.country_id, cl.slot`)).rows;

  // who shares a name with whom, within one country
  const byName = new Map();
  for (const c of clubs) {
    const k = c.country_id + '|' + c.name;
    (byName.get(k) || byName.set(k, []).get(k)).push(c);
  }

  const done = [], stuck = [];
  for (const [, twins] of byName) {
    if (twins.length < 2) continue;
    const free = twins.filter(c => {
      // a managed club's name is its manager's word, whatever the generator
      // thinks of that seat
      if (c.manager) return false;
      const want = bornAs(cfgs, c.country_id, c.slot);
      // the generator agreeing with the clash is no help: leave it visible
      // rather than inventing a name of our own
      return !!want && want !== c.name;
    });
    free.forEach(c => done.push({ ...c, want: bornAs(cfgs, c.country_id, c.slot) }));
    // N clubs of one name need N-1 of them to move. Any short of that and the
    // clash survives - which must be SAID, not left to be noticed later.
    if (free.length < twins.length - 1) stuck.push(twins);
  }

  if (write) {
    for (const d of done) {
      // DEFAULT_NAME MOVES TOO. It is the club's birth name and a released
      // claim restores it (migration 007), so leaving the clash there would
      // hand it straight back the first time a manager walked away.
      await pool.query(
        'UPDATE clubs SET name=$3, default_name=$3 WHERE country_id=$1 AND slot=$2',
        [d.country_id, d.slot, d.want]);
    }
  }

  if (!quiet) {
    done.forEach(d => console.log(
      `${d.country_id}/${d.slot} ${d.name} -> ${d.want}`));
    stuck.forEach(t => console.log(
      `! ${t[0].country_id} ${t[0].name}: ${t.length} clubs, none of them free to move`));
    console.log(`\n${write ? 'RENAMED' : 'DRY RUN'}: ${done.length} club${done.length === 1 ? '' : 's'} ` +
      `out of ${clubs.length}, in ${new Set(done.map(d => d.country_id)).size} countries`);
    if (!write && done.length) console.log('nothing written - pass --write to rename them');
  }
  return { renamed: done.length, stuck: stuck.length, clubs: clubs.length, moves: done };
}

// run from the command line, or from the tick; imported by a test, it does
// nothing until it is called
if (import.meta.url === ('file://' + process.argv[1])) {
  const pool = makePool();
  renameTwins(pool, makeHost(), { write: process.argv.includes('--write') })
    .then(() => pool.end())
    .catch(e => { console.error(e); process.exit(1); });
}
