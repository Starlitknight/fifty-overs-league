#!/usr/bin/env node
// backfill-history.mjs — EVERY MAN ALREADY ON THE BOOKS GETS HIS CARD.
//
// 094 gave a cricketer's past a row of its own. The fold fills it from the next
// settle onward; this fills it for the world as it stands, so no page has to
// wait for a country's turn to come round before it can draw a man's life.
//
// Idempotent by construction. It reads clubs.squad, writes what it finds, and
// the upsert only touches rows whose history has actually moved - so running it
// twice writes nothing the second time, and running it after the fold has
// already been through writes nothing at all.
//
//   node backfill-history.mjs            # say what would happen, change nothing
//   node backfill-history.mjs --write    # do it
//   node backfill-history.mjs --verify   # compare the two spellings, man by man
//
// --verify is the gate on the strip: while the squad blob still carries the
// embedded fields, every man must read the same from both places. It reports
// mismatches, men with no card, and ids held by more than one club, and exits
// non-zero if any of them are found - so a deploy can refuse to go further.
import { makePool } from './db.mjs';
import { writeHistory, coldOf } from './player-history.mjs';

// SEMANTIC, NOT SERIALISED. jsonb does not keep the key order it was given, so
// two documents that say the same thing come back spelled differently; this is
// the same canonical comparison the squad's own dirty-check uses.
function canon(v) {
  return JSON.stringify(v === undefined ? null : v, (k, val) =>
    (val && typeof val === 'object' && !Array.isArray(val))
      ? Object.keys(val).sort().reduce((o, kk) => { o[kk] = val[kk]; return o; }, {})
      : val);
}

export async function backfillHistory(pool, { write = false, verify = false, quiet = false } = {}) {
  const say = (...a) => { if (!quiet) console.log(...a); };
  const clubs = (await pool.query(
    'SELECT country_id, slot, squad FROM clubs ORDER BY country_id, slot')).rows;

  const men = [];                         // every identified cricketer on the books
  const seen = new Map();                 // pid -> "country/slot" of the first club holding him
  const dupes = [], unidentified = [];
  for (const c of clubs) {
    for (const p of (c.squad || [])) {
      if (!p || !p.name) continue;
      const where = c.country_id + '/' + c.slot;
      if (!p.pid) { unidentified.push(p.name + ' at ' + where); continue; }
      if (seen.has(p.pid)) { dupes.push(p.pid + ' at ' + seen.get(p.pid) + ' and ' + where); continue; }
      seen.set(p.pid, where);
      men.push(p);
    }
  }
  // WHAT THERE IS TO LIFT. This tool moves EMBEDDED history onto its own card,
  // so a man whose row no longer carries any is not a man with an empty life -
  // he is a man whose life has already moved. Writing him would put an empty
  // book on top of a real one, which is the one way a backfill for a derived
  // table can destroy something. So the population is the men who still have
  // something embedded, and after the strip that is nobody and this does
  // nothing at all - which is exactly right, and is what makes it safe to
  // leave wired into a deployment.
  const EMB = ['career', 'intl', 'mile'];
  const liftable = men.filter(p => EMB.some(f => p[f] !== undefined));
  say('clubs ' + clubs.length + ', cricketers with an id ' + men.length +
      ', still carrying history on the hot row ' + liftable.length +
      (unidentified.length ? ', without an id ' + unidentified.length : '') +
      (dupes.length ? ', ids held twice ' + dupes.length : ''));
  for (const d of dupes.slice(0, 10)) say('  duplicate id: ' + d);
  for (const u of unidentified.slice(0, 10)) say('  no id: ' + u);

  if (verify) {
    const have = new Map((await pool.query(
      'SELECT pid, career, intl, mile FROM player_history')).rows.map(r => [r.pid, r]));
    // COVERAGE is asked of every man; AGREEMENT only of the ones who still have
    // both spellings to compare. Once the strip has happened there is nothing
    // left to disagree with, and a verify that then reported four thousand
    // mismatches would be reporting its own obsolescence.
    const missing = men.filter(p => !have.has(p.pid)).map(p => p.name + ' (' + p.pid + ')');
    const mismatched = [];
    for (const p of liftable) {
      const row = have.get(p.pid); if (!row) continue;
      const want = coldOf(p);
      for (const f of EMB) {
        if (p[f] === undefined) continue;          // this half never left the blob
        if (canon(want[f]) !== canon(row[f]))
          mismatched.push(p.name + ' (' + p.pid + ') ' + f + ': squad ' +
            canon(want[f]).slice(0, 90) + ' vs card ' + canon(row[f]).slice(0, 90));
      }
    }
    const orphans = [...have.keys()].filter(pid => !seen.has(pid));
    say('checked ' + men.length + ' cricketers against ' + have.size + ' cards' +
        ' (' + liftable.length + ' still comparable against an embedded copy)');
    say('  missing a card:  ' + missing.length);
    say('  disagreeing:     ' + mismatched.length);
    say('  duplicate ids:   ' + dupes.length);
    say('  cards for men no club holds: ' + orphans.length + ' (retired, sold on, or a squad since regenerated)');
    for (const m of mismatched.slice(0, 20)) say('  ! ' + m);
    for (const m of missing.slice(0, 20)) say('  ? no card: ' + m);
    return { checked: men.length, comparable: liftable.length, cards: have.size,
             missing: missing.length, mismatched: mismatched.length,
             dupes: dupes.length, orphans: orphans.length,
             ok: !missing.length && !mismatched.length && !dupes.length };
  }

  if (!write) {
    const have = +(await pool.query('SELECT count(*)::int c FROM player_history')).rows[0].c;
    say('would lift ' + liftable.length + ' cards; ' + have + ' exist. Nothing changed (pass --write).');
    return { would: liftable.length, existing: have, written: 0, rows: liftable.length, dupes: dupes.length };
  }
  // AND EVERY OTHER MAN GETS AN EMPTY CARD. A cricketer who has never played
  // has no history to lift and, until his country's first settle, no row - so a
  // page asking after him gets nothing back and has to tell "he has done
  // nothing" from "he does not exist". DO NOTHING on conflict, so this can
  // never touch a card that already says something: the only rows it creates
  // are for men who have none.
  const seeded = await pool.query(
    `INSERT INTO player_history (pid)
     SELECT x.pid FROM jsonb_to_recordset($1::jsonb) AS x(pid text)
     ON CONFLICT (pid) DO NOTHING`,
    [JSON.stringify(men.map(p => ({ pid: p.pid })))]);
  if (seeded.rowCount) say('opened ' + seeded.rowCount + ' empty cards for men who have played nothing yet');

  if (!liftable.length) {
    say('nothing embedded to lift - every history is already on its own card');
    return { written: 0, rows: 0, opened: seeded.rowCount | 0,
             dupes: dupes.length, unidentified: unidentified.length };
  }
  // MERGED, NOT OVERWRITTEN. A man part of the way through the move - his story
  // already on a card, his book still on the blob - must not have the half that
  // has moved wiped by the half that has not. Whatever is embedded wins for its
  // own field; every other field keeps what the card already says.
  const have = new Map((await pool.query(
    'SELECT pid, career, intl, mile FROM player_history WHERE pid = ANY($1::text[])',
    [liftable.map(p => p.pid)])).rows.map(r => [r.pid, r]));
  const merged = liftable.map(p => {
    const row = have.get(p.pid), out = { name: p.name, pid: p.pid, ...coldOf(p) };
    if (row) for (const f of EMB) if (p[f] === undefined) out[f] = row[f];
    return out;
  });
  const r = await writeHistory(pool, merged);
  say('wrote ' + r.written + ' of ' + r.rows + ' cards (the rest were already right)');
  return { ...r, opened: seeded.rowCount | 0, dupes: r.dupes + dupes.length };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const pool = makePool();
  const res = await backfillHistory(pool, {
    write: process.argv.includes('--write'),
    verify: process.argv.includes('--verify')
  });
  await pool.end();
  if (res.ok === false) { console.error('history does not agree with the squads - do not strip'); process.exit(1); }
}
