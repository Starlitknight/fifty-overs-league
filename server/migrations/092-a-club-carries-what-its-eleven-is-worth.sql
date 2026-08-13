-- 092 — A CLUB CARRIES WHAT ITS ELEVEN IS WORTH.
--
-- The world rankings need one number per club: the mean rating of the best
-- eleven that club could field. To get it, computeRankings read the squad
-- column of every club on earth - 256 rows of whole cricketers, every ball
-- they have faced and every milestone they have passed - and threw all of it
-- away except one average. In production that was 1.5 million club rows and
-- the better part of a day's egress, to compute 256 integers.
--
-- So the integer is kept. best_xi_strength is exactly what squadStrength() in
-- server/ratings.mjs returns for that club's squad, and nothing else: the
-- fieldable eleven (the best keeper by bat, the five best bowlers by threat
-- and control, filled out to eleven on batting), averaged on rating and
-- rounded. It is a pure function of clubs.squad - no form, no fatigue, no
-- availability, no team sheet - which is what makes it safe to keep beside it.
--
-- NULLABLE ON PURPOSE. A club dealt before this migration has no number yet
-- and must not become invalid; the reader falls back to computing from the
-- squad for those, and the backfill (server/backfill-strength.mjs) fills them
-- in. Once every row is populated the fallback should never fire again, and
-- the tick says so out loud if it does.
--
-- NO TRIGGER. The value could be maintained by a trigger on clubs, but then
-- the one place that defines what a club's strength MEANS would be a pl/pgsql
-- copy of a JavaScript function, and the two would drift the first time
-- fieldableXI changed. The application writes it, in the same statement that
-- writes the squad, so there is one algorithm and one moment.
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS best_xi_strength integer;

COMMENT ON COLUMN clubs.best_xi_strength IS
  'Mean rating of the best fieldable XI - exactly squadStrength(squad) from server/ratings.mjs. Derived from clubs.squad; written in the same statement the squad is. NULL means not yet backfilled.';
