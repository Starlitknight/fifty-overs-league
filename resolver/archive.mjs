// Lifting the ball-by-ball out of the shared league state.
//
// The snapshot is the whole league in one document, and every member's phone
// downloads all of it every time the round moves. Measured on a real league —
// 10 clubs, 27 matches played — it is 1,897 KB, and 1,090 KB of that is the
// ball-by-ball commentary of the two most recent matches. Sixty per cent of
// what everyone downloads, for a page that is opened by at most two of them,
// occasionally, deliberately.
//
// So the log goes to app.league_archive, one row per match, and the client
// fetches it only when a manager actually opens that match's commentary. The
// snapshot keeps everything a screen is drawn from: table, fixtures, squads,
// scorecards, worms, season aggregates.
//
// Nothing here is required. If the 0023 migration has not been run the split
// is skipped and the snapshot goes out exactly as it did before.
import { upsert } from './sbrest.mjs';

/**
 * Proof that an archive row is the match the client thinks it is. results[] is
 * append-only in normal play, but a league relaunch rebuilds it, and then the
 * row stored at index 12 belongs to a match that no longer sits there. The
 * client checks this before splicing anything in, so the worst case is a
 * missing commentary rather than another match's.
 *
 * NO CLUB NAMES IN HERE. The client renames bot clubs to suit the league's
 * nation (module 26 turns Wellington into Sussex in an English league) and
 * rewrites its own result history to match, so home and away simply do not
 * agree between the umpire and the phone. What both sides do agree on is the
 * match's own seed, and the round and season it was played in - which
 * identify it exactly, and survive any renaming.
 */
export function resultSig(r) {
  if (!r) return '';
  return [r.comp || '', r.round ?? '', r.seasonNo ?? '', r.seed ?? ''].join('|');
}

/**
 * Take the heavy per-match fields out of a snapshot, in place.
 * Returns the rows to store. The snapshot is left ready to publish.
 */
export function splitHeavy(leagueId, snap) {
  const rows = [];
  if (!snap || !Array.isArray(snap.results)) return rows;
  snap.results.forEach((r, i) => {
    if (!r || !r.log || !r.log.length) return;
    // KEYED BY POSITION, NOT BY r.ix. Results carry their own `ix` field, and
    // it is NOT always the array position - the two drift (seen: position 26
    // holding the match whose ix is 24). The client reads App.results[i] by
    // position, so that is the name the archive must answer to. The signature
    // below is what makes it safe either way.
    rows.push({
      league_id: leagueId,
      ix: i,
      sig: resultSig(r),
      heavy: { log: r.log },
    });
    delete r.log;
  });
  return rows;
}

/**
 * Split, store, and report. Publishing the slim snapshot is the caller's job —
 * but only ever AFTER this resolves, so a manager can never be shown a league
 * whose commentary has not been written down yet.
 * If the archive cannot be written, the logs are put back and the snapshot is
 * published whole: slower, and exactly as correct as it was yesterday.
 */
export async function archiveHeavy(leagueId, snap) {
  const before = JSON.stringify(snap).length;
  const kept = [];
  if (!snap || !Array.isArray(snap.results)) return { split: 0, saved: 0 };
  // remember what we lifted, so a failed write can be undone
  snap.results.forEach((r, i) => { if (r && r.log && r.log.length) kept.push([r, r.log]); });
  const rows = splitHeavy(leagueId, snap);
  if (!rows.length) return { split: 0, saved: 0 };
  let ok = false;
  try { ok = await upsert('league_archive', rows, 'league_id,ix'); } catch (e) { ok = false; console.log('archive write failed:', e.message); }
  if (!ok) {
    kept.forEach(([r, log]) => { r.log = log; });
    console.log('archive unavailable (0023 not run?) — publishing the snapshot whole');
    return { split: 0, saved: 0 };
  }
  const after = JSON.stringify(snap).length;
  return { split: rows.length, saved: before - after };
}
