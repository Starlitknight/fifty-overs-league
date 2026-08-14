#!/usr/bin/env node
// print-gazette.mjs — RUN THE PRESS.
//
// A workflow step rather than a hook inside the settle, for the same reason
// the backfills are: it must run AFTER every nation has settled, and the tick
// settles them one at a time. Hanging it off the last country would mean
// knowing which country is last, which is a fact about the schedule and not
// about the paper.
//
//   node print-gazette.mjs            # print today's issue
//
// Idempotent. Three ticks an hour call this; only one of them is a new day,
// and the other two find the issue unchanged and write nothing.
import { makePool } from './db.mjs';
import { printGazette } from './gazette.mjs';

const pool = makePool();
try {
  const r = await printGazette(pool, Date.now());
  console.log('gazette: day ' + r.day + ', ' + r.stories + ' stories, ' +
    (r.printed ? 'printed' : 'unchanged') + (r.thin ? ' (thin - no cricket to report)' : '') +
    (r.lead ? ' — ' + r.lead : ''));
} catch (e) {
  // A PAPER IS NOT WORTH A TICK. If the press jams the world still turns; the
  // reader gets yesterday's issue, which the row's own world_day admits to.
  console.error('gazette: press failed, yesterday stands — ' + e.message);
} finally {
  await pool.end();
}
