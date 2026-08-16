// matchday-net-mirror.test.mjs — ONE NET SHARE, ON BOTH SIDES OF THE WIRE.
//
// Era 2 banks a home gate at MATCHDAY_NET of the gross sale. The umpire's
// copy lives in server/financeconfig.mjs and is what the treasury settles;
// the client carries a mirror (TK.NET in engine/src/league/43-finance.js) so
// the ground page can quote a take before the server has said anything.
//
// A mirrored constant is a standing invitation for a future retune to move
// one side and not the other - at which point The Books quote gates the
// treasury will never bank, which is the exact class of bug the ledger
// design exists to make impossible. Two defences, and this file proves both:
//
//   1. at runtime the umpire SERVES the constant (finance.matchdayNet) and
//      the client prefers the served figure - economy.mjs and 43-finance.js;
//   2. statically, the mirrored fallback must EQUAL the server constant, in
//      the source fragment AND in the built asset the page actually ships -
//      which is this test, so a drift cannot survive `node --test`.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MATCHDAY_NET } from '../server/financeconfig.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// the TK table's NET entry, wherever the text came from
function netOf(text, what) {
  const m = /var TK = \{[\s\S]*?NET:\s*([0-9.]+)\s*\}/.exec(text);
  assert.ok(m, what + ': the TK table and its NET entry exist');
  return Number(m[1]);
}

test('the client fallback mirrors MATCHDAY_NET, in the source fragment', () => {
  const src = readFileSync(join(root, 'engine/src/league/43-finance.js'), 'utf8');
  assert.equal(netOf(src, 'source'), MATCHDAY_NET,
    'engine/src/league/43-finance.js TK.NET must equal financeconfig MATCHDAY_NET - ' +
    'if you retuned the economy, change both, then rebuild');
});

test('and in the built asset the page actually ships', () => {
  const page = readFileSync(join(root, 'index.html'), 'utf8');
  const m = /<script src="(assets\/fo-[^"]+\.js)"/.exec(page);
  assert.ok(m, 'index.html names its asset');
  const bundle = readFileSync(join(root, m[1]), 'utf8');
  assert.equal(netOf(bundle, 'built asset'), MATCHDAY_NET,
    m[1] + ' ships a stale TK.NET - run ./build.sh');
});

test('and the client prefers the served figure to the mirror', () => {
  // the wiring, held by text: the walk serves matchdayNet, the page reads it
  // into TK.NET before any money is derived from a sale
  const eco = readFileSync(join(root, 'server/economy.mjs'), 'utf8');
  assert.ok(/matchdayNet:\s*curEra2 \? MATCHDAY_NET : null/.test(eco),
    'economy.mjs serves finance.matchdayNet');
  const src = readFileSync(join(root, 'engine/src/league/43-finance.js'), 'utf8');
  assert.ok(/if \(Number\(f\.matchdayNet\) > 0\) TK\.NET = Number\(f\.matchdayNet\)/.test(src),
    '43-finance.js adopts the served figure');
});
