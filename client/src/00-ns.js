/* Fifty Overs — presentation & engine-model layer.
 *
 * Modular sources concatenated by build.sh (manifest order) into a single
 * IIFE appended after the league overlay. Nothing here leaks globals except
 * the intentional window.__foSummer probe surface (boot.js), the
 * window.__foField field-truth export (oval.js) and the wrapped engine
 * globals (ballDist, renderMatch).
 *
 * Ground rules:
 *  - Gameplay is guarded by golden-master replays (test/replay.test.mjs):
 *    any change must reproduce the recorded ball logs bit-for-bit, or be
 *    an intentional model change re-blessed via tools/record-masters.mjs
 *    and passed through the bench gate. Balance changes stay symmetric
 *    (never keyed to the user's team) and seed-deterministic.
 *  - Matches are always real engine matches; results are never fabricated.
 */
var FOC = {};
