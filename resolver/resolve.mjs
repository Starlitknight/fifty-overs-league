// Reusable engine caller for the resolver service. Loads the REAL game file
// headless, injects the resolve harness, verifies the build hash matches the
// league's pinned hash (aborts otherwise — engine-version pinning), and runs
// __resolveMatch. Used by the Phase 3 friendly test and the Phase 4 container.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '../Fifty_Overs_Club_Manager_2026_v11_6.html');
const HARNESS = resolve(__dirname, 'resolve-harness.js');

/** sha256 of the game file the resolver will actually run. */
export function buildHash() {
  return createHash('sha256').update(readFileSync(GAME)).digest('hex');
}

/** Open one headless engine page. Returns { page, close, hash }. */
export async function openEngine() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('ENGINE PAGEERROR:', e.message));
  await page.goto('file://' + GAME, { waitUntil: 'load' });
  await page.addScriptTag({ content: readFileSync(HARNESS, 'utf8') });
  await page.waitForFunction(() => window.__FO_RESOLVE_READY === true, { timeout: 10000 });
  return { page, hash: buildHash(), close: () => browser.close() };
}

/** Generate a master pool of `count` unique engine players (for the draft). */
export async function genMasterPool(page, seedBase, count) {
  return page.evaluate(({ seedBase, count }) => {
    const seen = new Set(), out = [];
    for (let s = 0; s < 40 && out.length < count; s++) {
      for (const p of window.genDraftPool(seedBase + '-' + s)) {
        if (seen.has(p.name)) continue;
        seen.add(p.name); out.push(p);
        if (out.length >= count) break;
      }
    }
    return out;
  }, { seedBase, count });
}

/**
 * Resolve one match. `inputs` is exactly what app.friendly_inputs / the fixture
 * loader returns: { home:{name,players}, away:{name,players}, homeOrders,
 * awayOrders, conds:{pitch,weather,seed,ground,friendly} }.
 * Returns the payload to store: result_text, winner_team, scorecard, worm, log,
 * plus per-team runs/balls for NRR.
 */
export async function resolveMatch(page, inputs, { pinnedHash } = {}) {
  if (pinnedHash && pinnedHash !== buildHash()) {
    throw new Error(`ENGINE HASH MISMATCH: resolver build ${buildHash()} != pinned ${pinnedHash}`);
  }
  // friendlies play at full freshness - fatigue only matters in league play
  if (inputs && inputs.conds && inputs.conds.friendly) {
    const rested = (club) => ({ ...club, players: (club.players || []).map(p => (p ? { ...p, fatigue: 'rested' } : p)) });
    inputs = { ...inputs, home: rested(inputs.home), away: rested(inputs.away) };
  }
  const r = await page.evaluate(({ home, away, homeOrders, awayOrders, conds }) =>
    window.__resolveMatch(home, away, homeOrders, awayOrders, conds),
    inputs);

  // derive per-team runs/balls (for standings NRR) from the scorecard by name
  const byTeam = {};
  for (const inn of r.scorecard.filter(Boolean)) byTeam[inn.batTeam] = { runs: inn.runs, balls: inn.legal };
  const hn = inputs.home.name, an = inputs.away.name;
  return {
    result_text: r.result_text,
    winner_team: r.winner_team,          // team NAME (mapped to id at store time)
    mom: r.mom,
    scorecard: r.scorecard,
    worm: r.worm,
    log: r.log,
    consequences: r.consequences,        // per-player form/fatigue (official only)
    seed: r.seed,
    pitch: r.pitch,
    home_runs: byTeam[hn]?.runs ?? 0, home_balls: byTeam[hn]?.balls ?? 0,
    away_runs: byTeam[an]?.runs ?? 0, away_balls: byTeam[an]?.balls ?? 0,
  };
}

/** Season rollover for one squad via the engine's aging model (age++, 31+
 *  decline + jsDerive, retirement, fresh-season reset). Deterministic per
 *  (seasonNo, teamKey). Returns { players, retired }. */
export async function ageSquad(page, players, seasonNo, teamKey) {
  return page.evaluate(({ players, seasonNo, teamKey }) =>
    window.__ageSquad(players, seasonNo, teamKey), { players, seasonNo, teamKey });
}

/**
 * Client-side verification: recompute the match from the SAME server inputs and
 * compare to a stored result. Returns { ok, reason }. This is what a client runs
 * to flag a tampered/forged result — determinism makes an honest result match
 * byte-for-byte. Compares the outcome-bearing fields (result_text + scorecard +
 * worm); key order is normalized so jsonb round-tripping doesn't false-flag.
 */
export async function verifyResult(page, inputs, stored, { pinnedHash } = {}) {
  const fresh = await resolveMatch(page, inputs, { pinnedHash });
  const sortKeys = (x) => Array.isArray(x) ? x.map(sortKeys)
    : (x && typeof x === 'object')
      ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sortKeys(x[k])])) : x;
  const canon = (x) => JSON.stringify(sortKeys(x));
  if (stored.result_text !== fresh.result_text)
    return { ok: false, reason: `result_text mismatch: stored "${stored.result_text}" vs recomputed "${fresh.result_text}"` };
  if (canon(stored.scorecard) !== canon(fresh.scorecard))
    return { ok: false, reason: 'scorecard mismatch' };
  if (canon(stored.worm) !== canon(fresh.worm))
    return { ok: false, reason: 'worm mismatch' };
  return { ok: true, reason: 'recomputed result matches stored result' };
}
