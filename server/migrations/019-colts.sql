-- 019-colts.sql — THE COLTS CUP, and what an academy is actually FOR
--
-- Two things finish the youth system.
--
-- FIRST, the academy has to be worth its upkeep in the nets as well as at the
-- door. The rate a squad improves is the shipped engine's arithmetic, so the
-- only honest way to let a building change it is to BANK the level in force
-- each round beside the plan in force each round - then the whole squad is
-- still a pure function of the record and every replay lands on the same
-- cricketer. Rounds already banked default to level two, which is the rate
-- they were actually worked at, so no history moves.
--
-- SECOND, the boys need somewhere to play. The Colts Cup is a single round
-- robin - nine fixtures, one on every second league round - played by the
-- umpire on the real engine from a side nobody has to pick: the colts, plus
-- the youngest men on the senior staff. No orders, no deadline, nothing an
-- offline manager can lose. It is its own competition with its own table and
-- its own champion, and it never touches a senior first-class record.

ALTER TABLE training_rounds ADD COLUMN IF NOT EXISTS academy int NOT NULL DEFAULT 2;

CREATE TABLE IF NOT EXISTS youth_matches (
  id              text PRIMARY KEY,                 -- 'eng:s1:y3:h4a7' — the seed derives from this
  country_id      text NOT NULL REFERENCES countries(id),
  season_no       int  NOT NULL,
  round           int  NOT NULL,                    -- 1..9, the Colts round (not the league round)
  league_round    int  NOT NULL,                    -- the league day it was played on
  home_slot       int  NOT NULL,
  away_slot       int  NOT NULL,
  home_name       text NOT NULL,
  away_name       text NOT NULL,
  seed            bigint NOT NULL,
  engine_version  text NOT NULL,
  result          jsonb NOT NULL,
  result_canonical text NOT NULL,
  played_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_id, season_no, round, home_slot, away_slot)
);
CREATE INDEX IF NOT EXISTS youth_matches_season ON youth_matches (country_id, season_no, round);

NOTIFY pgrst, 'reload schema';
