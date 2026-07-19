/* Fifty Overs — presentation & engine-model layer.
 *
 * Modular sources concatenated by build.sh (manifest order) into a single
 * IIFE appended after the league overlay. Nothing here leaks globals except
 * the intentional window.__foSummer probe surface (boot.js), the
 * window.__foField field-truth export (oval.js) and the wrapped engine
 * globals (ballDist, renderMatch).
 *
 * Ground rules:
 *  - The pristine engine FILE is never edited (until the P0 golden-master
 *    replay net replaces the hash-lock). The only balance changes live in
 *    features/engine-tuning.js: a documented runtime layer that is
 *    symmetric (never keyed to the user's team) and seed-deterministic.
 *  - Matches are always real engine matches; results are never fabricated.
 */
var FOC = {};
