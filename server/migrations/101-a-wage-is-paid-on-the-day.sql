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
-- banked round its banked bill for ever after.
--
-- AND HISTORY IS FROZEN AT THE CUTOVER, in the same breath. Leaving the
-- pre-migration rounds to fall back to the standing bill would have left
-- every one of them permanently mutable - the very bug this migration
-- retires, kept alive for all history that predates it: a club with ninety
-- settled rounds signing a $30k-a-round man the day AFTER deploy would
-- still have been retro-charged 90 x $30k. The payrolls those rounds were
-- actually played under were never stored and cannot be recovered, and the
-- honest transition does not pretend otherwise: it preserves the one figure
-- the old economy believed at the moment of cutover - the standing bill -
-- and freezes every already-charged round at it, below. Three laws hold:
--
--   1. deploy moves no bank by a dollar: the backfilled bill IS the bill
--      the old law was charging those rounds at that moment;
--   2. every pre-cutover round is immutable from here on, at that figure;
--   3. every post-cutover round is banked at its real bill when the umpire
--      settles it (tick.mjs), and immutable from then on.
--
-- WHICH ROUNDS COUNT AS CHARGED AT CUTOVER. The walk reads the matches
-- table with no settlement cut (economy.mjs: every match row of the country
-- is walked), so "a round the old law was charging" is exactly "a round
-- with match rows" - home AND away, since both clubs pay wages for a round
-- played. That includes a round prebanked for today's broadcast and not yet
-- day-settled: the walk was already charging it at the standing bill, so
-- freezing it there changes nothing at cutover; the one residual is that
-- its banked figure is the cutover bill rather than the bill a few hours
-- later at its day-settle - one round, once, bounded by the prebank window.
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

-- THE CUTOVER FREEZE. One row for every (club, round) the walk is already
-- charging, at the standing bill - seniors and boys, the same sum the walk
-- charges (economy.mjs) and the tick banks (tick.mjs). ON CONFLICT DO
-- NOTHING so a world that somehow carries banked rounds already keeps them:
-- a banked figure is never revised, not even by this migration.
-- (the regression suite executes this statement verbatim; keep the marker)
-- CUTOVER-BACKFILL-BEGIN
INSERT INTO wage_rounds(country_id, slot, season_no, round, bill)
SELECT r.country_id, r.slot, r.season_no, r.round,
       round(coalesce((SELECT sum((p->>'wage')::numeric)
                         FROM jsonb_array_elements(c.squad) p), 0)
           + coalesce((SELECT sum((y->>'wage')::numeric)
                         FROM jsonb_array_elements(c.youth) y), 0))::bigint
  FROM (SELECT country_id, season_no, round, home_slot AS slot FROM matches
        UNION
        SELECT country_id, season_no, round, away_slot FROM matches) r
  JOIN clubs c ON c.country_id = r.country_id AND c.slot = r.slot
ON CONFLICT (country_id, slot, season_no, round) DO NOTHING;
-- CUTOVER-BACKFILL-END
