/* tools/ops-laws.mjs — CANDIDATE CLUB-SCALE OPERATIONS LAWS
 *
 * NOT SHIPPED. Nothing here is imported by the server. These are candidate
 * shapes for `operationsPerRound`, kept in the measurement tree so a sweep can
 * run them against the shipped one without a single line of the game changing
 * while the evidence is still being gathered.
 *
 * THE SHIPPED LAW, for reference:
 *
 *     ops = OPS_BASE_ROUND + seats x OPS_PER_SEAT_ROUND + (div 1 ? premium)
 *         = 58,000 + seats x 3.1 + (div 1 ? 30,000)
 *
 * WHAT ops-map.mjs MEASURED, and why these candidates look the way they do.
 * The per-seat term reads CAPACITY, and capacity is dealt almost flat on
 * purpose: `foundingSeats` was deliberately NOT steepened with standing
 * (economy.mjs:112 - steepening it broke stadium building), so nine of the
 * sixteen clubs in a nation are dealt exactly 24,000 seats. For those nine the
 * "variable" term is a second fixed charge. Club-scale operations therefore
 * span 1.117x from flagship to bottom club while the payroll they are set
 * against spans 4.64x.
 *
 * So the coordinate is the problem, not the base. A candidate has to scale on
 * something that actually differs between a giant and a minnow.
 *
 * THE COORDINATE. `support` - the club's following - is the one existing
 * quantity that means "how large an organisation is this":
 *
 *   - it is not revenue and not payroll, so it cannot be gamed by spending;
 *   - its structural target spans 2.45x across the ladder (supportTarget on
 *     RAW stature: 15,300 at the flagship down to 6,254 at slot 15), which is
 *     real separation rather than the 1.21x the ground gives;
 *   - it already moves with success, which is the behaviour section 14 asks
 *     for: a club that grows gradually becomes more expensive to run;
 *   - it is smooth. It drifts 18% of the gap toward its target each round, so
 *     nothing here can produce a cliff.
 *
 * Support is a stabiliser rather than a spiral: a club that falls loses
 * following and its operations fall with it, which is negative feedback on
 * exactly the tail this phase is about.
 */
import {
  OPS_BASE_ROUND, OPS_PER_SEAT_ROUND, OPS_TOPFLIGHT_ROUND
} from '../server/financeconfig.mjs';

// The shipped law, re-expressed so a sweep can run it through the same door
// as every candidate. Must agree with financeconfig.operationsPerRound to the
// dollar; tools/ops-sweep.mjs asserts that it does.
export const shipped = ({ seats, div, natOps }) =>
  Math.round((OPS_BASE_ROUND + (seats | 0) * OPS_PER_SEAT_ROUND
    + (div === 1 ? OPS_TOPFLIGHT_ROUND : 0)) * (natOps == null ? 1 : natOps));

/* THE CANDIDATE FAMILY.
 *
 *     ops = BASE + seats x PER_SEAT + support x PER_SUPPORTER + premium
 *
 * Three terms, each with an economic job, none of them invented:
 *
 *   BASE          what a club costs to exist at all, whatever its size: the
 *                 travelling party, the core administration, the fixtures it
 *                 has to fulfil. Genuinely flat, and deliberately smaller than
 *                 today's - today's base is carrying work that belongs to the
 *                 other two terms.
 *   PER_SEAT      the ground's running cost. Unchanged in kind: a stand costs
 *                 the same to light and steward whoever is sitting in it.
 *   PER_SUPPORTER the organisation the following requires - the staff, the
 *                 match-day operation, the commercial department. THIS is the
 *                 term the shipped law is missing, and the reason a minnow and
 *                 a giant currently inherit near-identical burdens.
 *   premium       the division cost premium. Untouched at $30,000: Phase 2
 *                 fitted it against what the division guarantees and this
 *                 phase has no evidence that it should itself scale.
 *
 * The constants are fitted in tools/ops-sweep.mjs, not chosen here.
 */
export function scaled({ base, perSeat, perSupporter, premium = OPS_TOPFLIGHT_ROUND }) {
  return ({ seats, div, natOps, support }) =>
    Math.round((base + (seats | 0) * perSeat + (support | 0) * perSupporter
      + (div === 1 ? premium : 0)) * (natOps == null ? 1 : natOps));
}

/* A CONTROL THAT TESTS THE OTHER READING OF THE SAME EVIDENCE. If the trouble
 * really is only that the BASE is too big, then simply lowering the base and
 * steepening the existing per-seat term should do the same work. It almost
 * certainly cannot - nine clubs share one capacity, so steepening a term they
 * all pay identically moves all nine together - but that is a measurement, not
 * an assumption, and the sweep runs it.
 */
export function steeperGround({ base, perSeat, premium = OPS_TOPFLIGHT_ROUND }) {
  return ({ seats, div, natOps }) =>
    Math.round((base + (seats | 0) * perSeat + (div === 1 ? premium : 0))
      * (natOps == null ? 1 : natOps));
}
