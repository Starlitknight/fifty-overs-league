// test/table-skin-optout.test.mjs — A SHEET THAT SHOUTS AT EVERY TABLE.
//
// Two house sheets dress every table in the game: the old FTP theme inlined in
// the shell, and the modern skin layer the league adds on top. Both were
// written to beat the base stylesheet, so nearly every declaration in them
// carries !important - which means no component can be heard over them by
// specificity alone. The career record asked for a navy head band with gold
// caps, wrote a rule five selectors deep, and still came out cream-on-grey on
// the reader's phone, because "html body #page table th{background:#FFFEFC
// !important}" outranks anything that does not shout back.
//
// The settlement is an opt-out: a table that carries its own paint says so
// with class fo-own, and the house sheets step around it. This file holds both
// halves of that bargain - the sheets must ask, and the tables that depend on
// being skipped must be marked.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shell = readFileSync(join(ROOT, 'engine', 'shell.html'), 'utf8');
const skin = readFileSync(join(ROOT, 'engine', 'src', 'league', '12-scorecard-analysis.js'), 'utf8');
const page = readFileSync(join(ROOT, 'engine', 'src', 'league', '41-player-page.js'), 'utf8');

test('the FTP theme steps around a table that dresses itself', () => {
  for (const bare of ['body.ftpskin th{', 'body.ftpskin td{', 'body.ftpskin table{']) {
    assert.ok(!shell.includes(bare),
      'the shell still dresses every table with "' + bare + '"; scope it with table:not(.fo-own)');
  }
  for (const scoped of ['body.ftpskin table:not(.fo-own) th{', 'body.ftpskin table:not(.fo-own) td{']) {
    assert.ok(shell.includes(scoped), 'the shell should carry "' + scoped + '"');
  }
});

test('the modern skin layer steps around it too', () => {
  assert.ok(!/#page table (th|td)\{/.test(skin),
    'the skin layer still stamps every table cell; scope it with table:not(.fo-own)');
  assert.ok(skin.includes('#page table:not(.fo-own) th{'), 'the skin layer should skip fo-own heads');
  assert.ok(skin.includes('#page table:not(.fo-own) td{'), 'the skin layer should skip fo-own cells');
});

// A table only needs the mark if the page paints its own header. Read both
// facts off the file itself: which table classes it renders, and which of
// those it gives a background or a colour to.
test('every player-page table that paints its own header is marked fo-own', () => {
  const opens = [...page.matchAll(/<table class='([^']+)'/g)];
  assert.ok(opens.length >= 2, 'the player page should still render its tables');
  for (const m of opens) {
    const classes = m[1].split(/\s+/);
    const own = classes.filter(c => c !== 'fo-own');
    const paints = own.some(c => new RegExp(
      '\\.' + c + '[^"]*\\b(?:thead )?th\\{[^"]*(?:background|color):').test(page));
    if (!paints) continue;
    assert.ok(classes.includes('fo-own'),
      'table.' + own.join('.') + ' paints its own header but is not marked fo-own, ' +
      'so the house sheets will overrule it');
  }
});
