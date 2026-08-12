// test/fielding-contest.test.mjs — THE FIELD IS A CONTEST, NOT A THRESHOLD.
//
// Fielding used to be four gates. A diving stop needed a fielding skill of 58,
// an attacking pick-up 64; a misfield needed under 44 and a fumble under 40.
// Measured over twelve thousand deliveries, the world produced 8.95 errors an
// innings and 0.00 good pieces - because the world's fielding ran 20 to 56 and
// the best fielder alive was a 56. The good branches were not rare, they were
// UNREACHABLE, and "Great fielding" was a menu item that could never have
// content.
//
// Two things were pressing the scale flat, and both were scaling a skill they
// were never buying: the generator's equal-budget pass and the server's
// calibration, each multiplying every skill a man has to seat his club on its
// rung. Worse, it was a loop - fielding feeds a man's rating, so widening the
// bell raised the rating, so the passes scaled harder.
//
// Now the hands are dealt on their own bell, held out of both passes, and a
// chance is decided by a contest: the ball is given a difficulty and the man
// is put against it. One rule, both halves of fielding, and no number in it
// that nobody can reach.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeEngine } from './engine-vm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = readFileSync(join(ROOT, 'engine', 'src', '00-core.js'), 'utf8');
// the prose in this file quotes the code it replaced, so the bans below read
// the code alone - a comment saying what went wrong is not the thing going wrong
const CODE = CORE.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
const ONB = readFileSync(join(ROOT, 'engine', 'src', 'league', '03-onboarding.js'), 'utf8');
const INIT = readFileSync(join(ROOT, 'server', 'init-world.mjs'), 'utf8');
const M84 = readFileSync(join(ROOT, 'server', 'migrations', '084-the-hands-get-their-own-scale.sql'), 'utf8');

const eng = makeEngine();
// the world's own fielding, off the generator every squad in the game comes from
const FIELD = [];
for (let s = 1; s <= 40; s++)
  (eng.genSquad(7000 + s, 'England', s % 3 === 0 ? 'express' : s % 3 === 1 ? 'wizard' : 'rock').players || [])
    .forEach(p => FIELD.push((p.skills || {}).fielding || 0));
FIELD.sort((a, b) => a - b);
const q = p => FIELD[Math.floor(p * (FIELD.length - 1))];

test('the world fields on a real scale, with real tails', () => {
  assert.ok(FIELD.length > 400, 'a world to measure (' + FIELD.length + ')');
  assert.ok(q(0.5) >= 44 && q(0.5) <= 56, 'the median cricketer is an average fielder: ' + q(0.5));
  assert.ok(q(0.05) <= 30, 'and there are genuinely poor ones: p5 ' + q(0.05));
  assert.ok(q(0.95) >= 70, 'and genuinely brilliant ones: p95 ' + q(0.95));
  assert.ok(FIELD[0] >= 1 && FIELD[FIELD.length - 1] <= 99, 'nobody is a 0 or a 100');
  // the old world could not produce a man good enough to dive
  assert.ok(FIELD[FIELD.length - 1] > 56, 'the ceiling is past the old one: ' + FIELD[FIELD.length - 1]);
});

test('the hands are dealt, not bought - by either pass that scales a squad', () => {
  assert.match(ONB, /var FO_QS_UNBOUGHT = \{ fielding: 1, catching: 1, keeping: 1, stumping: 1 \};/,
    'the generator holds them out of its budget pass');
  assert.match(ONB, /if \(FO_QS_UNBOUGHT\[k2\]\) continue;/);
  assert.match(INIT, /const NOT_SCALED = \{ fielding: 1, catching: 1, keeping: 1, stumping: 1 \};/,
    'and the world knows which skills they are');
  // HALF, NOT NONE. Holding them out of calibration altogether was the first
  // answer and it went too far: a flagship's cordon became no better than a
  // bottom club's, and p3 caught it as flagships going down in three nations
  // of sixteen. A stronger league does field better - it just must not be the
  // whole of the club's edge, or the absolute scale goes flat again.
  assert.match(INIT, /const HAND_SCALE = 0\.5;/);
  assert.match(INIT, /const fh = 1 \+ \(f - 1\) \* HAND_SCALE;/);
  assert.match(INIT, /const g = NOT_SCALED\[k\] \? fh : f;/);
  assert.ok(!/if \(NOT_SCALED\[k\]\) continue;/.test(INIT), 'they are no longer skipped outright');
  // fielding is drawn on its own, not off what a man does with the bat
  assert.ok(!/fielding:gg\(tgt/.test(CODE), 'no role takes its fielding off its batting level');
  assert.ok(!/fielding:gg\(two/.test(CODE));
  assert.equal((CORE.match(/fielding:gg\(50,26\)/g) || []).length, 4, 'every role deals from the same bell');
});

test('a chance is a difficulty and a man, and the angle is part of it', () => {
  assert.match(CORE, /function foChanceDiff\(band,ang,gate\)\{/);
  assert.match(CORE, /var d=100\*Math\.pow\(M\.rand\(\),FO_FLD\.skew\)\+\(FO_FLD\.band\[band\]\|\|0\)/,
    'skewed toward the routine, lifted by what the ball was worth');
  assert.match(CORE, /\+FO_FLD\.ang\*Math\.min\(1,ang\/\(gate\|\|FO_FLD\.gate\)\)/,
    'and by how far he had to go');
  assert.match(CORE, /const fs=foFieldSkill\(pick\)\+foLvlShift\('field'\), diff=foChanceDiff\(out,near\.ang\), won=fs>=diff;/,
    'his fielding against the chance - one comparison, no thresholds');
  assert.match(CORE, /if\(!near\|\|!pick\|\|near\.ang>FO_FLD\.gate\)return out;/, 'and nothing at all beyond the gate');
});

test('winning means different things depending on what the ball was worth', () => {
  // a ring fielder cuts a four off dead; a boundary rider has already let
  // three past him and can only save two
  assert.match(CORE, /if\(deep\)\{say\('Brilliant stop by '\+pick\.name\+' at '\+at\+' saves two\.'/);
  assert.match(CORE, /const kept=M\.rand\(\)<0\.55\?'dot':'1';/, 'in the ring it is stopped dead');
  assert.match(CORE, /if\(out==='3'&&won\)\{say\('Brilliant stop/);
  assert.match(CORE, /'Great fielding by '\+pick\.name\+' at '\+at\+' keeps it to one\.'/,
    'a two saved is great fielding, which is what it is called now');
  assert.ok(!/attacks the ball/.test(CODE), 'and never "attacks the ball" again - the filters were still matching on it');
  assert.match(CORE, /if\(out==='1'&&!won\)\{say\('Misfield/);
  assert.match(CORE, /if\(out==='dot'&&!won\)\{say\('Fumble/);
  // losing on a four is not an event: it was always going to be four
  assert.match(CORE, /if\(out==='6'\)return out;\s*\/\/ it cleared them all/);
});

test('a catch is the same contest, and a beaten fielder is not a dropper', () => {
  assert.match(CORE, /const cSkill=cat\+foLvlShift\('catch'\)\+\(TF\('safeHands'\)\?11:0\)\+\(\(TF\('lightningHands'\)&&f\.keeper\)\?10:0\);/,
    'a talent is worth points on the chance, so it is worth most on a hard one');
  assert.match(CORE, /const cDiff=foChanceDiff\('catch',\(M\._fieldPos!=null&&near\)\?near\.ang:0,FO_FLD\.cgate\);/);
  assert.match(CORE, /else if\(cDiff-cSkill<=FO_FLD\.drop\)\{/, 'lose narrowly and he put it down');
  assert.match(CORE, /M\._dropped=\{by:f\.name\};/);
  assert.match(CORE, /can only watch it past him at /, 'lose heavily and it simply beat him');
  assert.match(CORE, /cgate:34,/, 'a ball in the air gives men longer to converge than one along the ground');
});

test('every posted man fields, so catches and stops spread', () => {
  assert.match(CORE, /function foNearestFielder\(FS,dir,deepOnly,ringOnly\)\{\n  let best=null,bd=1e9;\n  for\(const sp of FS\.spots\)\{\n/,
    'the cordon is no longer skipped outright');
  assert.ok(!/if\(FO_CLOSE_POS\[sp\.label\]&&sp\.label!=='short leg'\)continue;/.test(CORE));
  // and the ball goes where a wagon wheel says it goes
  assert.match(CORE, /dot:\{point:4,cover:4,midOff:3/, 'a defensive shot goes into the off side');
  assert.match(CORE, /'6':\{straight:4,midwicket:4,midOn:3/, 'and a six goes straight or over the leg side');
  assert.match(CORE, /slipCorr:1\}/, 'an edge through the cordon is a real four');
});

test('the world that already exists is stretched onto the scale, not re-rolled', () => {
  assert.match(M84, /UPDATE clubs SET squad = world_stretch_squad\(squad\);/);
  assert.match(M84, /round\(50 \+ \(\(sk->>'fielding'\)::numeric - 36\) \* 1\.44\)/,
    'a monotone map: every ranking in the world survives it');
  assert.match(M84, /sk \? 'keeping' AND \(sk->>'keeping'\)::numeric >= 20/,
    'and a number eleven does not become a wicketkeeper');
  ['listings', 'academy_candidates', 'nat_squad'].forEach(t =>
    assert.ok(M84.indexOf(t) > 0, 'every store of a man is stretched: ' + t));
});

test('the keeper is measured against a par the world can actually reach', () => {
  assert.match(CORE, /const FO_KQ_PAR=74;/);
  assert.match(CORE, /const kq=\(ctx\.keeperQuality-FO_KQ_PAR\);/,
    'byes, wides and stumpings hang off the world median, not off 55');
  assert.match(CORE, /miss=foClamp\(0\.20-0\.0038\*\(kq-FO_KQ_PAR\),0\.014,0\.30\);/);
  assert.ok(!/keeperQuality-55/.test(CODE), 'nothing counts from a number nothing reaches');
});

// AND THE OFFSETS ARE NOT ALLOWED TO BE ABSOLUTE FOR EVER.
//
// They were solved against freshly generated cricketers who field 50. A world
// that runs for a hundred seasons does not stay there - the live one fell to a
// median club fielding of 36 - and because a good stop must BEAT a +37 or +44
// offset while a misfield need only lose to a -59, the drift switched the good
// half off and turned the bad half up. Measured per innings before the fix:
// 5.5 good stops at 51, 1.4 at 37, 0.3 at 31.
//
// ONE-SIDED, deliberately. A field better than the standard is judged exactly
// as it always was, because that edge is real and it is what a manager buys -
// and because pulling elite sides down to par broke the frozen calibration on
// the spot (267 in the first innings against a golden 251).
test('the chance offsets know what standard of cricket they are judging', () => {
  assert.match(CORE, /par:50,/, 'the fielding the offsets were solved against');
  assert.match(CORE, /cpar:51,/, 'and the catching');
  assert.match(CORE, /_fldLvl:foFieldLevel\(userTeam,aiTeam\),/,
    'read off the two squads at the toss, so both ends of a replay agree');
  assert.match(CORE, /return Math\.max\(0,Math\.min\(FO_FLD\.lvlCap,d\)\);/,
    'it only ever lifts a world that has fallen below the standard');
  assert.ok(!/Math\.max\(-FO_FLD\.lvlCap/.test(CODE),
    'and never blunts one that is above it');
});
