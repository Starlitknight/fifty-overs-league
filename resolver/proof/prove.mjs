/* PHASE 0 determinism proof.
   Loads the REAL game file headless, injects the resolve harness, and:
     (A) runs one match twice with identical inputs+seed  -> asserts byte-identical
     (B) runs the same match with a different seed         -> asserts it DIFFERS (RNG drives)
     (C) swaps ONLY the two sides' phaseIntent             -> asserts result changes
                                                              (two-sided orders are honored)
   Exit code 0 = all pass.
*/
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '../../Fifty_Overs_Club_Manager_2026_v11_6.html');
const HARNESS = resolve(__dirname, '../resolve-harness.js');

const sha = s => createHash('sha256').update(s).digest('hex');
const ok  = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) process.exitCode = 1; };

const launchOpts = {};
if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

await page.goto('file://' + GAME, { waitUntil: 'load' });
await page.addScriptTag({ content: readFileSync(HARNESS, 'utf8') });
await page.waitForFunction(() => window.__FO_RESOLVE_READY === true, { timeout: 10000 });

const NEUTRAL = { pp: 0, mid: 0, death: 1 };
const AGGRO   = { pp: 2, mid: 2, death: 2 };

// resolve one match. homeIx/awayIx pick real embedded teams; orders name a legal
// keeper on each side and carry the given phaseIntent. Returns full JSON + summary.
const runInPage = async (homeIx, awayIx, seed, intentHome, intentAway) => page.evaluate(
  ({ homeIx, awayIx, seed, iH, iA }) => {
    const home = GD.teams[homeIx], away = GD.teams[awayIx];
    const keeperOf = t => (t.players.find(p => p.keeper) || t.players[0]).name;
    const ordH = { batOrder: [], captain: null, keeper: keeperOf(home), phaseIntent: iH, compiled: [] };
    const ordA = { batOrder: [], captain: null, keeper: keeperOf(away), phaseIntent: iA, compiled: [] };
    const conds = { pitch: 'balanced', weather: 'Sunny', ground: home.ground, friendly: true, seed };
    const r = window.__resolveMatch(home, away, ordH, ordA, conds);
    return { json: JSON.stringify(r), text: r.result_text,
             firstBat: r.scorecard[0].batTeam, secondBat: r.scorecard[1].batTeam,
             homeName: home.name, awayName: away.name };
  }, { homeIx, awayIx, seed, iH: intentHome, iA: intentAway });

// (A) same seed twice, identical inputs -> byte-identical
const A1 = await runInPage(0, 1, 4242, NEUTRAL, NEUTRAL);
const A2 = await runInPage(0, 1, 4242, NEUTRAL, NEUTRAL);
console.log('\n(A) same inputs + same seed, run twice');
console.log('    run1:', A1.text, ' sha', sha(A1.json).slice(0, 16));
console.log('    run2:', A2.text, ' sha', sha(A2.json).slice(0, 16));
ok(A1.json === A2.json, 'byte-identical result for identical (squads, orders, conds, seed)');

// (B) different seed -> different match
const B = await runInPage(0, 1, 9999, NEUTRAL, NEUTRAL);
console.log('\n(B) seed 4242 vs 9999 (else identical)');
console.log('    4242:', A1.text);
console.log('    9999:', B.text);
ok(A1.json !== B.json, 'different seed produces a different match (RNG genuinely drives outcome)');

// (C) two-sided orders. To avoid the chase-rate clamp masking the second-innings
//     side, we always vary the team batting FIRST, and we run BOTH orderings so
//     EACH of the two teams gets a turn batting first. If per-team routing works,
//     bumping the batting-first team's phaseIntent must change the match.
console.log('\n(C) two-sided phaseIntent — vary the batting-first team, both orderings');
for (const [hIx, aIx, seed] of [[0, 1, 4242], [1, 0, 4242]]) {
  const base = await runInPage(hIx, aIx, seed, NEUTRAL, NEUTRAL);
  const firstIsHome = base.firstBat === base.homeName;
  // bump only the batting-first team's intent
  const bumped = firstIsHome
    ? await runInPage(hIx, aIx, seed, AGGRO,   NEUTRAL)
    : await runInPage(hIx, aIx, seed, NEUTRAL, AGGRO);
  console.log(`    ${base.homeName} v ${base.awayName}: bats-first=${base.firstBat}`);
  console.log(`      neutral: ${base.text}`);
  console.log(`      aggro:   ${bumped.text}`);
  ok(base.json !== bumped.json,
     `${base.firstBat}'s own phaseIntent changes the match (its orders are honored)`);
}

// (D) zero side effects: resolving must not mutate live game globals.
const D = await page.evaluate(() => {
  const before = { results: App.results.length, page: App.page,
                   mNull: (typeof M === 'undefined' || M === null),
                   ordersKeeper: App.orders.keeper };
  window.__resolveMatch(GD.teams[0], GD.teams[1],
    { keeper: null, phaseIntent: { pp: 0, mid: 0, death: 1 } },
    { keeper: null, phaseIntent: { pp: 0, mid: 0, death: 1 } },
    { pitch: 'balanced', seed: 777, friendly: true });
  const after = { results: App.results.length, page: App.page,
                  mNull: (typeof M === 'undefined' || M === null),
                  ordersKeeper: App.orders.keeper };
  return { before, after, resActive: window.__RESOLVE_ACTIVE };
});
console.log('\n(D) side effects on live game state after a resolve');
console.log('    before:', JSON.stringify(D.before));
console.log('    after :', JSON.stringify(D.after));
ok(JSON.stringify(D.before) === JSON.stringify(D.after) && D.resActive === false,
   'App.results / App.page / M / App.orders unchanged; __RESOLVE_ACTIVE reset to false');

// (E) structural sanity of the returned payload
const E = await page.evaluate(() => {
  const r = window.__resolveMatch(GD.teams[0], GD.teams[1],
    { keeper: null, phaseIntent: { pp: 0, mid: 0, death: 1 } },
    { keeper: null, phaseIntent: { pp: 0, mid: 0, death: 1 } },
    { pitch: 'green', weather: 'Chilly', seed: 314159, friendly: false });
  return {
    hasText: !!r.result_text, winner: r.winner_team,
    innings: r.scorecard.filter(Boolean).length,
    inn0runs: r.scorecard[0].runs, inn0bat: r.scorecard[0].batting.length,
    inn0bowl: r.scorecard[0].bowling.length,
    wormPts: (r.worm[0]||[]).length + (r.worm[1]||[]).length,
    logLen: r.log.length, comp: r.meta.comp, pitch: r.pitch
  };
});
console.log('\n(E) structural sanity (green pitch, official comp)');
console.log('   ', JSON.stringify(E));
ok(E.hasText && E.innings === 2 && E.inn0runs > 0 && E.inn0bat >= 2 &&
   E.inn0bowl >= 1 && E.wormPts > 10 && E.logLen > 50 && E.comp === 'league',
   'payload has 2 innings, non-empty scorecard/worm/log, correct comp+pitch');

await browser.close();
console.log('\nDone. exitCode =', process.exitCode || 0);
