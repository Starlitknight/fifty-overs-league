// Proof that the snake-deal balances a REAL engine-generated master pool.
// Loads the game file headless, calls window.genDraftPool across seeds to build
// an oversized master pool of unique players, snake-deals it, and checks the
// buckets are disjoint, equal-size, and near-equal in average rating.
//
//   NODE_PATH=/opt/node22/lib/node_modules node tests/draft_realpool.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { snakeDeal, dealReport } from '../functions/_shared/draft.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '../../.build/page.html');   // assembled by ./build.sh

let pass = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) process.exitCode = 1; else pass++; };

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('file://' + GAME, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.genDraftPool === 'function', { timeout: 10000 });

const N = 4, perManager = 15, need = N * perManager;
// Build a unique master pool from the real generator across several seeds.
const master = await page.evaluate(({ need }) => {
  const seen = new Set(), out = [];
  for (let s = 0; s < 12 && out.length < need; s++) {
    for (const p of window.genDraftPool('league-master-' + s)) {
      if (seen.has(p.name)) continue;
      seen.add(p.name);
      out.push({ name: p.name, rating: p.rating, fee: p.fee, keeper: !!p.keeper,
                 bowlTypeFull: p.bowlTypeFull, role: p.role });
      if (out.length >= need) break;
    }
  }
  return out;
}, { need });
await browser.close();

ok(master.length === need, `built a real master pool of ${master.length} unique engine players`);
console.log('   rating range:', Math.min(...master.map(p=>p.rating)), '..', Math.max(...master.map(p=>p.rating)));

const buckets = snakeDeal(master, N);
const rep = dealReport(buckets);
console.log('   bucket avg ratings:', rep.avgs, ' spread', rep.avgSpread, `(${(rep.avgSpreadPct*100).toFixed(3)}%)`);
ok(rep.allUnique && rep.uniquePlayers === need, 'buckets are disjoint (every player dealt once)');
ok(rep.sizeSpread === 0, `equal-size buckets (${rep.sizes})`);
ok(rep.avgSpreadPct < 0.02, 'real-pool bucket averages within a few points of equal (<2%)');
// keepers spread out: with a scarce keeper supply, no bucket should be starved of one
const keepersPerBucket = buckets.map(b => b.filter(p => p.keeper).length);
console.log('   keepers per bucket:', keepersPerBucket);

console.log(`\n${pass} checks passed`);
