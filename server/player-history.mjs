// player-history.mjs — A LIFE IS NOT KIT.
//
// A cricketer's row in clubs.squad is what the ball engine needs to bowl him a
// delivery: his skills, his legs, his form, his talents. Two of the fields on
// it are not that at all. `career` is every run he has ever scored and `mile`
// is the story of how - and between them, on a club that has played a season,
// they are thirty per cent of the blob. Neither is read while a match is being
// simulated. Both grow for as long as the man plays: `mile` is capped at sixty
// entries and a settled world is only six deep into it, so the share climbs
// from here rather than settling.
//
// So they move off the hot row and into a card of their own, keyed by the id
// the man carries. THE HOT ROW STAYS THE HOT ROW - nothing about the shape of
// a player object changes for anyone who reads one, because the two places
// that genuinely need his history hydrate it back onto him before they look.
//
// WHAT THIS IS AND IS NOT. It is not a relocation of truth: `career` and `mile`
// are DERIVED, recomputed from the whole match record on every settle by
// living.mjs, which never reads their previous value. The truth is the
// scorecards, and beside them the transfer freeze (`carry`) that survives a
// man changing clubs. This table is a second derivation of the same record,
// kept because the pages that draw a life should not have to replay a season
// to get one - the same bargain `snapshots` already makes. Losing it entirely
// would cost one settle, not one memory.

// the fields that are a man's past rather than his present. `intl` travels
// with `career` - it is the same book kept for his country, written and wiped
// by the same two lines of the fold - so splitting them would leave the job
// half done and the smaller half still growing on the hot row.
export const COLD = ['career', 'intl', 'mile'];

// WHAT HE IS, WITHOUT WHAT HE DID. Copies rather than deletes: the arrays
// handed to this function are engine-facing player objects that other code is
// still holding, and a strip that mutated them would quietly empty a man's
// page in the same tick that saved him.
export function stripCold(men) {
  return (men || []).map(p => {
    if (!p) return p;
    let has = false;
    for (const k of COLD) if (p[k] !== undefined) { has = true; break; }
    if (!has) return p;
    const q = { ...p };
    for (const k of COLD) delete q[k];
    return q;
  });
}

// and the other direction, for the two callers that genuinely need a life:
// the transfer freeze, and any page building a full card server-side.
export function hydrateCold(men, byPid) {
  return (men || []).map(p => {
    const h = p && p.pid && byPid && byPid.get(p.pid);
    if (!h) return p;
    const q = { ...p };
    if (h.career && h.career.m) q.career = h.career;
    if (h.intl && h.intl.m) q.intl = h.intl;
    if (h.mile && h.mile.length) q.mile = h.mile;
    return q;
  });
}

// the cold half of one man, in the shape the table stores. A man with nothing
// to say still gets a row - an empty book and an empty story are answers, and
// a page that has to tell "no history" from "no row" is a page with a bug in
// it waiting to happen.
export function coldOf(p) {
  return {
    pid: p.pid,
    career: (p.career && typeof p.career === 'object') ? p.career : {},
    intl: (p.intl && typeof p.intl === 'object') ? p.intl : {},
    mile: Array.isArray(p.mile) ? p.mile : []
  };
}

// ONE STATEMENT FOR A WHOLE COUNTRY, not one for each of two hundred and forty
// cricketers. The fold already holds every man it has just recomputed, so the
// write is a single upsert over a list - and the ON CONFLICT carries the same
// discipline the squad write got in Phase 3: a row whose history has not moved
// is not rewritten, so a settle that changed nothing touches nothing.
//
// A man appearing twice in one list would make Postgres refuse the whole
// statement ("cannot affect row a second time"), so the list is deduplicated
// here - last writer wins, and the count of collisions is returned rather than
// swallowed, because two clubs holding one id is a fact somebody should hear.
export async function writeHistory(pool, men) {
  const byPid = new Map();
  let dupes = 0, unidentified = 0;
  for (const p of (men || [])) {
    if (!p || !p.name) continue;
    if (!p.pid) { unidentified++; continue; }     // backfill-pids will name him tonight
    if (byPid.has(p.pid)) dupes++;
    byPid.set(p.pid, coldOf(p));
  }
  if (!byPid.size) return { written: 0, rows: 0, dupes, unidentified };
  const rows = [...byPid.values()];
  const r = await pool.query(
    `INSERT INTO player_history AS h (pid, career, intl, mile)
     SELECT x.pid, x.career, x.intl, x.mile
       FROM jsonb_to_recordset($1::jsonb) AS x(pid text, career jsonb, intl jsonb, mile jsonb)
     ON CONFLICT (pid) DO UPDATE
        SET career = EXCLUDED.career, intl = EXCLUDED.intl,
            mile = EXCLUDED.mile, updated_at = now()
      WHERE h.career IS DISTINCT FROM EXCLUDED.career
         OR h.intl   IS DISTINCT FROM EXCLUDED.intl
         OR h.mile   IS DISTINCT FROM EXCLUDED.mile`,
    [JSON.stringify(rows)]);
  return { written: r.rowCount | 0, rows: rows.length, dupes, unidentified };
}

// and the batched read, for a fold or a page that needs several men's lives at
// once. One query however many are asked for.
export async function readHistory(pool, pids) {
  const want = [...new Set((pids || []).filter(Boolean))];
  const out = new Map();
  if (!want.length) return out;
  const r = await pool.query(
    'SELECT pid, career, intl, mile FROM player_history WHERE pid = ANY($1::text[])', [want]);
  for (const row of r.rows) out.set(row.pid, { career: row.career, intl: row.intl, mile: row.mile });
  return out;
}

// one man, for the paths that move exactly one - a transfer is the whole list
export async function historyOf(pool, pid) {
  if (!pid) return null;
  const r = await pool.query(
    'SELECT career, intl, mile FROM player_history WHERE pid=$1', [pid]);
  return r.rows[0] || null;
}
