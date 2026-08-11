// test/ground-square.test.mjs — THE SQUARE IS THE HOME CLUB'S.
//
// A fixture's pitch is dealt by the nation's climate and the home groundsman's
// own leaning, and the umpire has always bowled on exactly what the fixtures
// page promised. That is a good rule and it stays: the whole conditions system
// is knowable in advance, on any device, with nobody online.
//
// What it left out is that the home club prepares the square. Migration 083
// hands that over - a pitch per home fixture, called once, shut forty-eight
// hours before the first ball - and the risk it creates is not in the calling.
// It is that half the game goes on printing the forecast for a match that will
// be played on something else. Six surfaces read conditions off condOf: the
// fixtures page, the orders room, the prematch, the ground, the club page, the
// broadcast. The call reaches all six or the game tells two stories.
//
// So the call is not a second source of truth beside condOf. It is handed to
// condOf, and these hold that line: the register lives in the planet, the
// planet answers with the call, and the ground board is the one room that can
// write one.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');
const strip = s => s.split('\n').filter(l => !/^\s*(\/\/|--)/.test(l)).join('\n');

const PLANET = read('engine/src/league/27-living-planet.js');
const FIN = read('engine/src/league/43-finance.js');
const TRUTH = read('engine/src/league/52-served-truth.js');
const CLUB = read('engine/src/league/40-club-page.js');
const M83 = read('server/migrations/083-the-home-club-calls-the-pitch.sql');
const TICK = read('server/tick.mjs');
const fin = strip(FIN), planet = strip(PLANET), tick = strip(TICK), m83 = strip(M83);

test('the call is answered by condOf itself, not beside it', () => {
  assert.match(planet, /var called = pitchCall\(rid, homeSlot, seasonNo, round\);/,
    'condOf asks the register before it answers');
  assert.match(planet, /pitch: called \|\| pickWeighted\(p, rnd01\(key \+ "\|p"\)\) \|\| "balanced"/,
    'a call beats the forecast; no call and the forecast stands untouched');
  assert.match(planet, /weather: pickWeighted\(prof\.w, rnd01\(key \+ "\|w"\)\) \|\| "Sunny"/,
    'and the sky is nobody\'s to call');
  assert.match(planet, /called: !!called/, 'the answer says whether it was asked for');
  // handed in, never computed here - the arithmetic in this file must stay a
  // pure function of the fixture
  assert.match(planet, /function setPitchCalls\(rid, slot, rows\)/, 'the register is filled from outside');
  assert.ok(!/fetch\(/.test(planet), 'the planet never goes to the network to answer a question');
  assert.match(planet, /pitchCall: pitchCall, setPitchCalls: setPitchCalls/, 'both cross the wall');
});

test('an empty register is the forecast, which is what actually gets bowled', () => {
  // this is the whole compatibility story: a world before 083, a device that
  // has not heard yet, and a ground that called nothing are one answer
  assert.match(planet, /return CALLED\[callKey\(rid, slot, seasonNo, round\)\] \|\| null;/);
  assert.match(planet, /var CALLED = \{\};/, 'and it starts empty');
});

test('the world fills the register once per ground, for anyone', () => {
  assert.match(TRUTH, /rpc\/world_pitch_calls/, 'from the world\'s own board');
  assert.match(TRUTH, /if \(P && P\.setPitchCalls\) P\.setPitchCalls\(country, slot \| 0, rows \|\| \[\]\);/,
    'handed to the planet, so every surface reads it without knowing this happened');
  assert.match(TRUTH, /window\.foPitchCalls = pitchCalls;/, 'and any room may ask');
  assert.match(TRUTH, /try \{ var c0 = claim\(\); if \(c0\) pitchCalls\(c0\.country, c0\.slot\); \} catch/,
    'the manager\'s own square is asked for at boot, so the orders room is right the first time');
});

test('the ground board offers a call only where one can still be made', () => {
  assert.match(fin, /var SQ_NOTICE = 48 \* 3600000;/, 'two days, the same two the RPC keeps');
  assert.match(fin, /var shut = x\.t0 - SQ_NOTICE, locked = now >= shut, left = shut - now;/);
  assert.match(fin, /if \(!said && !locked && heard\) \{/,
    'no picker for a match already called, already shut, or not yet heard about');
  // "heard" is the difference between no call and no answer - a board that
  // confused them would offer a manager a decision he has already spent
  assert.match(fin, /var heard = sqCalls\(cl\) != null;/);
  assert.match(fin, /PCH\.rows = Array\.isArray\(rows\) \? rows : \[\];/, 'and null until the world answers');
  assert.match(fin, /var PCH = \{ rows: null, at: 0, busy: false \};/);
});

test('the board draws the home fixtures and reads the pitch off the planet', () => {
  assert.match(fin, /\.filter\(function \(x\) \{ return x\.home && \(!sNow \|\| x\.season === sNow\); \}\)\.slice\(0, 8\)/,
    'his own ground, and only this season - the schedule reaches into next ' +
    'summer, which the world has no first ball for and the RPC must refuse');
  assert.match(fin, /var sNow = 0; try \{ sNow = \(PL\.phaseOf\(Date\.now\(\)\) \|\| \{\}\)\.season \| 0; \} catch/);
  assert.match(fin, /c = PL\.condOf\(cl\.country, cl\.slot \| 0, x\.season, x\.round\)/,
    'the surface printed is the one condOf answers with, call or forecast');
  assert.match(fin, /var pitch = \(c && c\.pitch\) \|\| "balanced", said = !!\(c && c\.called\);/);
  // the field guide is borrowed, so two rooms cannot name one surface twice
  assert.match(CLUB, /window\.__foPitchKit = \{ nm: PITCH_NM, note: PITCH_NOTE, order: PITCH_ORDER, name: pitchNm \};/,
    'the club page lends its own table');
  assert.match(fin, /var K = window\.__foPitchKit \|\| null;/, 'and the ground room takes it');
});

// EVERY ROOM THAT PROMISES A SURFACE MUST PROMISE THE SAME ONE. The call is
// public and condOf answers with it, so a page only has to ask for the ground
// it is drawing. The ground room asks for its own; the club page asks for
// whichever ground a reader opened, because a rival's season of pitches is
// printed there too.
test('a rival ground is drawn with its own calls, not the forecast it ignored', () => {
  const gs = CLUB.slice(CLUB.indexOf('function groundSeason(cid, slot)'),
                        CLUB.indexOf('function groundSeason(cid, slot)') + 900);
  assert.match(gs, /if \(window\.foPitchCalls\) window\.foPitchCalls\(cid, slot, function \(\) \{/,
    'the club page asks for the ground it is drawing');
  assert.match(gs, /window\.foRenderClubPage\(\);/, 'and repaints when the world answers');
  assert.match(gs, /c = pl\.condOf\(cid, slot, season, r \+ 1\)/,
    'the surface itself still comes from condOf, which is where the call lands');
});

test('a call is spent, so the page asks before it spends it', () => {
  assert.match(fin, /rpc\("world_call_pitch", \{ p_season: \+sr\[0\], p_round: \+sr\[1\], p_pitch: p \}\)/);
  assert.match(fin, /Your groundsman takes his orders once: this cannot be changed, and it shuts 48 hours before the first ball\./,
    'and the question says both rules on its face');
  assert.match(fin, /\.then\(function \(\) \{ PCH\.rows = null; PCH\.at = 0; reload\(page\); \}\)/,
    'a landed call clears the cache, so the board repaints as prepared');
});

test('the umpire reads the call under the host key, which is the whole guard', () => {
  assert.match(tick, /SELECT slot, pitch FROM pitch_calls WHERE country_id=\$1 AND season_no=\$2 AND round=\$3/);
  assert.match(tick, /const pitch = called\.get\(hs \| 0\) \|\| cond\.pitch;/,
    'the HOME slot, so a call for a match you do not host is read by nothing');
  assert.match(tick, /host\.runMatch\(\{ name: home\.name, players: H\.players \}, \{ name: away\.name, players: A\.players \}, pitch, seed, tieOrders, cond\.weather\)/,
    'and it is what the engine is handed');
  assert.match(tick, /ENGINE_VERSION, pitch, JSON\.stringify\(tieOrders\)/, 'and what the card banks');
  // a database without the table is a world before 083 and must still bowl
  assert.match(tick, /\} catch \(e\) \{ return new Map\(\); \}/, 'a missing table is an empty map, not a dead round');
});

test('the rules are enforced where they cannot be argued with', () => {
  // the client counts the same 48 hours, but the client is not the authority
  assert.match(m83, /IF now_ms\(\) >= shut THEN/, 'the deadline is checked in the database');
  assert.match(m83, /shut := play_ms - world_pitch_notice\(\);/);
  assert.match(m83, /play_ms := round_play_ms\(c\.country_id, p_season, p_round\);/,
    'counted from the same first ball the teamsheet lock counts from');
  assert.match(m83, /PRIMARY KEY \(country_id, slot, season_no, round\)/, 'said once, by the key');
  assert.match(m83, /IF FOUND THEN\n\s*RAISE EXCEPTION 'your groundsman already has his orders/,
    'and refused rather than replaced');
  assert.match(m83, /SELECT \* INTO c FROM claims WHERE user_id = u;/,
    'the club is the caller\'s own - it is never named in the arguments');
  assert.match(m83, /NOT \(p_pitch = ANY \(world_pitch_kinds\(\)\)\)/, 'and only a surface the engine bowls on');
  // the seven are the engine's own ids, in the engine's own spelling
  const kinds = /ARRAY\['balanced', 'flat', 'green', 'dry', 'slow', 'cracked', 'twoPaced'\]/;
  assert.match(m83, kinds, 'the shipped pitch ids');
  assert.match(read('engine/src/league/00-boot-auth.js'),
    /var FO_PITCHES = \["balanced", "flat", "green", "dry", "slow", "cracked", "twoPaced"\];/,
    'which is the list the client has always carried');
});
