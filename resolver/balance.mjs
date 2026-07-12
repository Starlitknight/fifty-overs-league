// ============================================================================
// DEV-ONLY archetype balance harness (quick-start onboarding).
// Generates one squad per archetype with the overlay's real generator, then
// plays a full double round-robin between all ten in the REAL engine
// (__resolveMatch, default orders) and prints the win-rate matrix.
//
//   node balance.mjs --reps 200 --pitch balanced --workers 8
//
// PASS (neutral pitch): every archetype's overall win rate in [40%, 60%]
// (The Prodigy is allowed at the low end - it runs ~9% under the strength
// budget by design, paid back in age, talents and training speed.)
// Sweeps on green / dry confirm the intended pitch identities appear.
// ============================================================================
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '../client/game.html');
const HARNESS = resolve(__dirname, 'resolve-harness.js');

const arg = (k, d) => {
  const ix = process.argv.indexOf('--' + k);
  return ix >= 0 && process.argv[ix + 1] != null ? process.argv[ix + 1] : d;
};
const REPS = +arg('reps', 200);
const PITCH = arg('pitch', 'balanced');
const WORKERS = Math.max(1, Math.min(+arg('workers', Math.max(1, os.cpus().length - 2)), 12));
const SEED0 = arg('seed', 'bal');

async function openPage() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('file://' + GAME, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__foGenArchetypeSquad === 'function', { timeout: 15000 });
  await page.addScriptTag({ content: readFileSync(HARNESS, 'utf8') });
  await page.waitForFunction(() => window.__FO_RESOLVE_READY === true, { timeout: 10000 });
  await page.evaluate(() => { const w = document.getElementById('folWrap'); if (w) w.remove(); });
  return { browser, page };
}

// one rep = fresh squads (new seed) + full double round-robin (90 matches)
async function playRep(page, rep) {
  return page.evaluate(({ rep, pitch, seed0 }) => {
    const A = window.__foArchetypes.map(a => a.id);
    const squads = {};
    for (const id of A) squads[id] = {
      name: id, ground: 'Neutral Ground',
      players: window.__foGenArchetypeSquad(seed0 + '-r' + rep, 'England', id).players
    };
    const out = [];
    for (let i = 0; i < A.length; i++) for (let j = 0; j < A.length; j++) {
      if (i === j) continue;
      const h = A[i], aw = A[j];
      const seed = ((rep * 100003 + i * 1009 + j * 101) % 2147483647) >>> 0;
      const r = window.__resolveMatch(squads[h], squads[aw], null, null,
        { pitch, weather: 'Sunny', ground: 'Neutral Ground', friendly: true, seed });
      out.push([h, aw, r.winner_team === h ? 1 : (r.winner_team === aw ? 0 : 0.5)]);
    }
    return out;
  }, { rep, pitch: PITCH, seed0: SEED0 });
}

const ids = [];
const wins = {};   // wins[a][b] = points a took off b (win 1, tie .5), any venue
const games = {};
function tally(res) {
  for (const [h, aw, w] of res) {
    (wins[h] = wins[h] || {})[aw] = (wins[h][aw] || 0) + w;
    (wins[aw] = wins[aw] || {})[h] = (wins[aw][h] || 0) + (1 - w);
    (games[h] = games[h] || {})[aw] = (games[h][aw] || 0) + 1;
    (games[aw] = games[aw] || {})[h] = (games[aw][h] || 0) + 1;
  }
}

const t0 = Date.now();
const reps = [...Array(REPS).keys()];
let done = 0;
await Promise.all([...Array(WORKERS).keys()].map(async wIx => {
  const { browser, page } = await openPage();
  if (!ids.length) {
    const a = await page.evaluate(() => window.__foArchetypes.map(x => x.id));
    if (!ids.length) ids.push(...a);
  }
  for (let r = wIx; r < REPS; r += WORKERS) {
    tally(await playRep(page, r));
    done++;
    if (done % 10 === 0) console.log(`  rep ${done}/${REPS} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await browser.close();
}));

console.log(`\n=== ${PITCH.toUpperCase()} pitch · ${REPS} double round-robins · ${REPS * 90} matches · ${((Date.now() - t0) / 1000).toFixed(0)}s ===`);
const pct = (a, b) => games[a] && games[a][b] ? (100 * wins[a][b] / games[a][b]) : NaN;
const pad = (s, n) => String(s).padStart(n);
console.log(pad('', 10) + ids.map(b => pad(b.slice(0, 6), 7)).join('') + pad('OVERALL', 9));
let pass = true;
const overall = {};
for (const a of ids) {
  let W = 0, G = 0;
  for (const b of ids) if (b !== a) { W += wins[a][b] || 0; G += games[a][b] || 0; }
  overall[a] = 100 * W / G;
  const row = ids.map(b => b === a ? pad('-', 7) : pad(pct(a, b).toFixed(0), 7)).join('');
  console.log(pad(a, 10) + row + pad(overall[a].toFixed(1) + '%', 9));
  if (overall[a] > 60 || overall[a] < 40) pass = false;
}
const spread = Math.min(...Object.values(overall)).toFixed(1) + '% .. ' + Math.max(...Object.values(overall)).toFixed(1) + '%';
if (PITCH === 'balanced') console.log('\nPASS band 40-60% (neutral-pitch criterion):', pass ? 'PASS' : 'FAIL', '· spread', spread);
else console.log('\nIdentity sweep on ' + PITCH + ' (the 40-60 band applies to neutral only) · spread', spread);
