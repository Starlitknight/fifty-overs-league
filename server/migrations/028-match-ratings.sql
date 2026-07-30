-- 028-match-ratings.sql — THE LADDER STOPS READING THE CARDS.
--
-- The world rankings are the mean of each club's last three MATCH RATINGS, and
-- a match rating is derived from the card: six units a side, scored against
-- real-ODI par. Deriving it is cheap. FETCHING THE CARD IS NOT.
--
-- A fifty-over card is 38 KB of ball-by-ball batting and bowling, and the
-- ladder is rebuilt from genesis every hour - so the umpire was pulling every
-- card ever played out of the database, every hour, for a number it had already
-- worked out the last twenty-three times. At a full season that is gigabytes a
-- day of egress to compute a few hundred small numbers, and it grows for as
-- long as the world keeps playing.
--
-- The rating is now worked out ONCE, when the card is banked, and kept beside
-- it: two numbers and the unit count, a few dozen bytes. The ladder reads those
-- and never touches a card again, so its cost stops growing with the record.
--
-- NOTHING IS TAKEN ON TRUST. The column is derived data, not a source of truth:
-- it is written by the same ratings code the scorecard uses, and any row that
-- lacks it is filled from its card the next time the umpire runs. Drop the
-- column and the world rebuilds it; the record itself is still the cards.
ALTER TABLE matches     ADD COLUMN IF NOT EXISTS ratings jsonb;
ALTER TABLE cup_matches ADD COLUMN IF NOT EXISTS ratings jsonb;
ALTER TABLE nat_matches ADD COLUMN IF NOT EXISTS ratings jsonb;

-- the backfill walks rows that have none, oldest first
CREATE INDEX IF NOT EXISTS matches_needs_rating ON matches (season_no, round)
  WHERE ratings IS NULL;
