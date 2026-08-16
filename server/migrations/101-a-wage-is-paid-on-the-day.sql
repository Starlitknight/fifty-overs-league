-- 101-a-wage-is-paid-on-the-day.sql — THE WAGE BILL BECOMES A FACT OF THE
-- ROUND IT WAS PAID FOR.
--
-- The books charge wages "at the bill as it stands": one figure, today's
-- squad summed, applied to every round the club has ever played. That was an
-- honest simplification when it was written - a squad that trains itself
-- upward "revises its own history slightly" - and the long-run bench
-- (tools/economy-longrun.mjs) measured what it becomes at scale: a transfer
-- or a season in the nets moves TODAY'S bill, and today's bill re-prices the
-- club's whole past. Thirty simulated seasons put the walked treasuries some
-- 35-80% away from a true ledger of the same seasons; clubs that bought or
-- developed players were retro-charged millions they never spent and driven
-- to the administration floor while genuinely cash-positive, and clubs that
-- quietly decayed were minted the difference. The books were transferring
-- paper money from improving clubs to declining ones.
--
-- The repair keeps the walk's whole law: nothing stored that a re-run cannot
-- reuse byte-identically, nothing incremented. When the umpire settles a
-- round he BANKS the bill that round was played under - one row per club per
-- round, written once, ON CONFLICT DO NOTHING - and the walk charges a
-- banked round its banked bill for ever after. A round with no banked row
-- (every round settled before this migration) is charged exactly as it
-- always was, at the standing bill, so no settled bank moves a dollar on
-- deploy; the drift simply stops accruing from the first banked round on.
--
-- The table is PLAY, not world (reseed-squads.mjs classifies it): every row
-- describes a round of cricket, and a redealt world has paid nobody.

CREATE TABLE IF NOT EXISTS wage_rounds (
  country_id text   NOT NULL REFERENCES countries(id),
  slot       int    NOT NULL,
  season_no  int    NOT NULL,
  round      int    NOT NULL,
  bill       bigint NOT NULL,
  banked_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country_id, slot, season_no, round)
);
