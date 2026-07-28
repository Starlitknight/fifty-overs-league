// One-shot snapshot compaction.
//
// The shared league snapshot used to be published in its FULL form, which keeps
// the ball-by-ball log of every match ever played. It grew about three and a
// half megabytes a round — 44 MB by round twelve — and every member downloads
// the whole thing to open the game, so a phone eventually cannot get in at all.
//
// round.mjs now publishes the slimmed form, but that only helps the NEXT round.
// This script fixes what is already stored: load each league's snapshot into the
// real engine, take snapshot(false) of it, and publish that. Nothing is played
// and nothing is decided — it is the same world with the old ball-by-ball logs
// dropped, which is exactly what the engine's own three-tier history was
// designed to keep. The last two matches keep their full log, so "replay my
// last match" still works.
//
//   node compact.mjs            every league
//   node compact.mjs <id>       one league
import { openEngine } from './resolve.mjs';
import { assertEnv, rpc, rest } from './sbrest.mjs';

const kb = n => Math.round(n / 1024).toLocaleString() + ' KB';

async function compactOne(page, lg) {
  const rows = await rest(`league_state?league_id=eq.${lg.id}&select=snapshot,version,round`);
  const st = rows && rows[0];
  if (!st || !st.snapshot) { console.log(`${lg.id}  ${lg.name}: no snapshot, skipped`); return; }

  const beforeBytes = JSON.stringify(st.snapshot).length;
  const slim = await page.evaluate(({ snap }) => {
    window.restoreFrom(snap);
    if (typeof window.mpInit === 'function') window.mpInit();
    return window.snapshot(false);
  }, { snap: st.snapshot });

  // carry forward the stamp the client uses to date rounds truthfully
  try { if (st.snapshot.__foAdvDate) slim.__foAdvDate = st.snapshot.__foAdvDate; } catch (e) {}

  const afterBytes = JSON.stringify(slim).length;
  const before = st.snapshot.results ? st.snapshot.results.length : 0;
  const after = slim.results ? slim.results.length : 0;

  // Refuse to publish anything that lost a RESULT. Dropping ball-by-ball logs
  // is the point; dropping a match is a corrupted league, and it is better to
  // leave the fat snapshot in place than to publish a thinner wrong one.
  if (after !== before) {
    console.error(`${lg.id}  ${lg.name}: REFUSED — results ${before} -> ${after}`);
    return;
  }
  if (afterBytes >= beforeBytes) {
    console.log(`${lg.id}  ${lg.name}: already slim (${kb(beforeBytes)}), left alone`);
    return;
  }

  await rpc('push_league_state', {
    p_league_id: lg.id,
    p_snapshot: slim,
    p_round: (slim.season && typeof slim.season.round === 'number') ? slim.season.round : (st.round | 0)
  });
  console.log(`${lg.id}  ${lg.name}: ${kb(beforeBytes)} -> ${kb(afterBytes)} ` +
              `(${Math.round(100 * (beforeBytes - afterBytes) / beforeBytes)}% smaller, ${after} results kept)`);
}

(async () => {
  assertEnv();
  const only = process.argv[2] || null;
  const leagues = await rest('leagues?select=id,name');
  const list = only ? (leagues || []).filter(l => l.id === only) : (leagues || []);
  if (!list.length) { console.log('no leagues to compact'); return; }
  const eng = await openEngine();
  try {
    for (const lg of list) {
      try { await compactOne(eng.page, lg); }
      catch (e) { console.error(`${lg.id}: failed —`, (e && e.message) || e); }
    }
  } finally { await eng.close(); }
})();
