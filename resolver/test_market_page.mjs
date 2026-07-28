// Probe: the built game renders the #/transfers market page (pool cards,
// bank line, sign buttons) once a squad exists.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '../index.html');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('file://' + GAME, { waitUntil: 'load' });
await page.waitForTimeout(800);

const r = await page.evaluate(async () => {
  // stand up a local practice-style world straight through the engine
  App.teamIx = 0; seasonInit(); econInit();
  location.hash = '#/transfers';
  await new Promise(res => setTimeout(res, 400));
  const pg = document.getElementById('page');
  const html = pg ? pg.innerHTML : '';
  return {
    hasTitle: /Transfer market/.test(html),
    cards: pg ? pg.querySelectorAll('.fo-yc').length : 0,
    signBtns: pg ? pg.querySelectorAll('.fo-mk-claim').length : 0,
    hasBankLine: /Bank:/.test(html),
    navHasTransfers: !!document.querySelector('#topbar a.fo-transfers'),
  };
});
await page.screenshot({ path: resolve(__dirname, '_transfers_page.png'), fullPage: false });
await browser.close();

const checks = [
  ['page titled Transfer market', r.hasTitle],
  ['pool cards rendered (>= 10)', r.cards >= 10],
  ['sign buttons present', r.signBtns > 0],
  ['bank / squad line present', r.hasBankLine],
  ['Transfers nav link present', r.navHasTransfers],
];
let fail = 0;
for (const [nm, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${nm}`); if (!ok) fail++; }
console.log('cards:', r.cards, 'sign buttons:', r.signBtns);
process.exit(fail ? 1 : 0);
