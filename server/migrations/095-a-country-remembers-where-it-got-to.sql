-- 095-a-country-remembers-where-it-got-to.sql — THE FOLD STOPS STARTING AGAIN.
--
-- evolveCountry replays a country's ENTIRE record on every settle: every ball
-- ever bowled, added up again from nothing, three times an hour. That was a
-- deliberate and good decision - it is why the living world has no drift, why
-- a re-settle lands on the same figure, and why a bug in the fold is fixed by
-- fixing the fold rather than by repairing a million rows. It is also, by
-- construction, work that grows with the age of the world and never stops.
--
-- Measured, England alone, cloned seasons:
--
--     world days   matches   training rounds   one settle
--        40          118           256            332 ms
--       100          354           768            793 ms
--       365        1,062         2,304          2,239 ms
--     1,000        2,832         6,144          5,675 ms
--
-- Sixteen countries at a thousand days is a minute and a half of replay, three
-- times an hour, to advance the world by one day. The slope is the problem,
-- not the constant.
--
-- So a country writes down where it got to. The checkpoint is the fold's own
-- accumulator - nothing more - frozen at a round boundary, and the next settle
-- adds only the rounds played since. THE FULL REPLAY IS NOT DELETED: it is
-- what runs when there is no checkpoint, when the fold's version has moved,
-- and whenever the record no longer matches what the checkpoint was built
-- from. It is also kept as the oracle the tests measure continuation against,
-- because a checkpoint that silently disagrees with genesis is the only real
-- danger here.
--
-- WHAT THIS CHANGES is how the world arrives at today, never what today is.

CREATE TABLE IF NOT EXISTS living_checkpoint (
  country_id     text PRIMARY KEY,
  living_version int  NOT NULL,
  -- THE BOUNDARY. Rounds are the world's own sequence: a match, a tour tie and
  -- a training session all name (season_no, round), and the fold sorts by
  -- exactly that before it accumulates. So "through (season, round)" is a
  -- prefix of the fold's own order - never a timestamp, never an arrival time,
  -- and never ambiguous when six matches land in the same round together,
  -- because a whole round is always on one side of the line.
  through_season int  NOT NULL,
  through_round  int  NOT NULL,
  -- AND WHAT THE RECORD LOOKED LIKE UNDERNEATH IT. A watermark alone trusts
  -- that history never changes below the line. It mostly does not - but a
  -- healed day, a repaired card, a backfill or a hand-edited blob would all
  -- leave the checkpoint describing a past that no longer exists, and the
  -- continuation would be silently wrong forever after. These are the counts
  -- of the records at or below the watermark when it was written; if they do
  -- not match at the next settle, the checkpoint is not used and the country
  -- folds from genesis. Cheap to check, and it turns a silent corruption into
  -- a slow settle.
  seen_matches   int  NOT NULL DEFAULT 0,
  seen_nat       int  NOT NULL DEFAULT 0,
  seen_training  int  NOT NULL DEFAULT 0,
  state          jsonb NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE living_checkpoint IS
  'Where a country''s living fold got to: the accumulator itself, frozen at a '
  '(season, round) boundary, so the next settle folds only the rounds since. '
  'Derived and disposable - deleting a row costs one slow settle and nothing '
  'else, which is the intended repair for anything that looks wrong.';

-- No index beyond the key: one row a country, always fetched by country.
