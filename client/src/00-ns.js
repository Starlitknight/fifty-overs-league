/* Fifty Overs — The First Summer (England solo campaign)
 *
 * Modular campaign sources. Each file attaches one module to the shared FOC
 * namespace; build.sh concatenates them (in manifest order) into a single
 * IIFE appended after the league overlay, so nothing here leaks globals
 * except the intentional window.__foSummer test/debug surface set in boot.
 *
 * Ground rules (mirrors docs/first-summer.md):
 *  - The pristine engine FILE is never edited. The only balance changes
 *    live in features/engine-tuning.js: a documented runtime layer that is
 *    symmetric (never keyed to the user's team) and seed-deterministic.
 *  - Matches are always real engine matches; results are never fabricated.
 *  - Story effects live in the campaign save only — they never touch player
 *    skills, so solo narrative can't create multiplayer advantages.
 */
var FOC = {};
