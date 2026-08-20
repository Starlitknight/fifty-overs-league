/* tools/stature-laws.mjs — THE CANDIDATE COORDINATES, IN ONE PLACE
 *
 * Every arm this phase measures is defined here and imported by the tools, so
 * two tools can never quietly measure two different laws of the same name.
 * Nothing here is shipped: server/economy.mjs is untouched by this phase.
 */
import { stature, econStature } from '../server/economy.mjs';

// ---------------------------------------------------------------------------
// THE STRENGTH LADDER IS A STAIRCASE, NOT A RAMP, and that is the whole
// finding. Measured over all sixteen nations with the shipped generator
// (tools/stature-ladder.mjs), mean squad rating by seat is:
//
//   slot  0            70,904        flagship
//   slots 1-3          65,608  65,500  65,175     d1a   - flat within 0.5%
//   slots 4-7          59,450  59,296  58,858  58,579   d1b - flat within 1.5%
//   slots 8-11         48,421  49,071  48,792  48,554   d2a - flat within 1.3%
//   slots 12-15        37,858  37,779  37,438  37,783   d2b - flat within 0.9%
//
// and payroll follows it exactly: $449,573 / ~$368,000 / ~$292,000 / ~$179,000
// / ~$96,000 a round. The steps between tiers are -7.5%, -8.8%, -17.3% and
// -22.0%; inside a tier nothing moves more than 1.5%. This is `tierOf` in
// tools/economy-audit.mjs, which is the shipped generator's own tier map.
//
// The income coordinate is a straight line through all of that: 0.86 - 0.035s,
// then 0.62 - 0.022s. It descends smoothly across seats whose squads are
// identical, and it barely notices the cliffs where the squads actually change.
// The floor is a patch on one of those cliffs and mirrors none of them.
//
// So the candidate is not a different floor. It is a coordinate with the shape
// the cost ladder actually has: one value per tier, and the value is the MEAN
// OF THE CURRENT RAW STATURE over that tier's seats - which keeps the world's
// existing commercial scale exactly where it is while removing a within-tier
// gradient that nothing in the game pays for.
export const TIER_OF = slot => (slot === 0 ? 'flagship'
  : slot <= 3 ? 'd1a' : slot <= 7 ? 'd1b' : slot <= 11 ? 'd2a' : 'd2b');

export const TIER_STAT = {
  flagship: 1.000,     // slot 0
  d1a: 0.825,          // mean of 0.860, 0.825, 0.790
  d1b: 0.7025,         // mean of 0.755, 0.720, 0.685, 0.650
  d2a: 0.587,          // mean of 0.620, 0.598, 0.576, 0.554
  d2b: 0.499           // mean of 0.532, 0.510, 0.488, 0.466
};

// A SOFT LANDING rather than a cliff: keep descending below the knee but at
// half the gradient. Nothing new is invented - the knee is the shipped floor
// value and the gradient is half the shipped division-two gradient.
export const KNEE = 0.62, SOFT_K = 0.5;

export const ARMS = {
  // the shipped law
  current: (slot, boss) => econStature(slot, boss),
  // the floor deleted outright
  nofloor: (slot, boss) => stature(slot, boss),
  // the floor softened
  soft: (slot, boss) => {
    const r = stature(slot, boss);
    return r >= KNEE ? r : KNEE - (KNEE - r) * SOFT_K;
  },
  // the coordinate given the shape the cost ladder actually has
  tierflat: (slot, boss) => (boss ? TIER_STAT.flagship : TIER_STAT[TIER_OF(slot | 0)])
};

export const ARM_NAMES = Object.keys(ARMS);
