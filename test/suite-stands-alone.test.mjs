// test/suite-stands-alone.test.mjs — THE ENGINE SUITE INSTALLS NOTHING.
//
// CI checks the repository out, builds the page and runs `node --test
// test/*.test.mjs`. It does not run `npm install` anywhere, because the game
// has no runtime dependencies: the engine is a single built file and the
// tests read source. That is the whole reason the build is fast and the
// suite is trustworthy on a cold machine.
//
// A test that imports one of the SERVER's modules can quietly break it. The
// server does have dependencies - it talks to Postgres - and importing, say,
// init-world.mjs reaches db.mjs, which reaches `pg`. On a developer's machine
// server/node_modules is sitting right there and everything passes; on the
// runner the whole file fails to load with ERR_MODULE_NOT_FOUND, and a green
// suite reports red for a reason that has nothing to do with the code.
//
// Borrowing from the server is fine where the module is self-contained -
// ratings.mjs is pure arithmetic and the match-ratings test imports it on
// purpose, so that the page and the umpire cannot drift. This holds the line
// at the real boundary: whatever an engine test imports must itself import
// nothing but relative paths and node builtins.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TESTS = readdirSync(join(ROOT, 'test')).filter(f => f.endsWith('.mjs'));

// every `from '...'` in a file, whatever the quote
function importsOf(src) {
  return [...src.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
}
// a bare specifier is a package: not relative, not a node builtin, not a URL
function isPackage(spec) {
  return !/^[./]/.test(spec) && !/^node:/.test(spec) && !/^[a-z]+:/.test(spec);
}

test('no engine test reaches a server module that needs a package installed', () => {
  const offenders = [];
  for (const f of TESTS) {
    const src = readFileSync(join(ROOT, 'test', f), 'utf8');
    for (const spec of importsOf(src)) {
      if (!/^\.\.\/server\//.test(spec)) continue;
      const mod = resolve(join(ROOT, 'test'), spec);
      let modSrc = '';
      try { modSrc = readFileSync(mod, 'utf8'); } catch (e) {
        offenders.push(f + ' imports ' + spec + ', which does not exist');
        continue;
      }
      const pkgs = importsOf(modSrc).filter(isPackage);
      if (pkgs.length) offenders.push(f + ' -> ' + spec + ' -> needs ' + pkgs.join(', '));
    }
  }
  assert.deepEqual(offenders, [], 'the suite must run on a machine with nothing installed');
});

test('the tests themselves ask for nothing but node and this repository', () => {
  const offenders = [];
  for (const f of TESTS) {
    const pkgs = importsOf(readFileSync(join(ROOT, 'test', f), 'utf8')).filter(isPackage);
    if (pkgs.length) offenders.push(f + ' imports ' + pkgs.join(', '));
  }
  assert.deepEqual(offenders, [], 'no engine test may need a package');
});

test('and CI really does run them without installing anything', () => {
  const ci = readFileSync(join(ROOT, '.github', 'workflows', 'ci-pages.yml'), 'utf8');
  assert.match(ci, /node --test test\/\*\.test\.mjs/, 'the suite is what CI runs');
  // if this ever gains an install step the rule above stops being load-bearing,
  // and whoever adds it should have to come here and say so
  assert.ok(!/npm (install|ci)/.test(ci), 'CI installs nothing, which is why this file exists');
});
