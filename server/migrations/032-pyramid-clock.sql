-- 032-pyramid-clock.sql — THE SQL CALENDAR JOINS THE PYRAMID (docs/PYRAMID.md).
--
-- The five-week season in SQL: the exact mirror of clock.mjs dayOfRound and
-- the client planet's. League rounds fall Mon Tue Thu Fri (di%7 in 0,1,3,4)
-- for four weeks; the playoffs are rounds 15 (di 24, Thursday) and 16
-- (di 25, Friday of the closing weeks).
CREATE OR REPLACE FUNCTION world_day_of_round(p_round int)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_round = 15 THEN 24
    WHEN p_round = 16 THEN 25
    WHEN p_round BETWEEN 1 AND 14
      THEN ((p_round - 1) / 4) * 7 + (ARRAY[0, 1, 3, 4])[((p_round - 1) % 4) + 1]
  END
$$;

-- the six rounds an international tour day takes men out of: the league
-- round after each Wednesday and Saturday of weeks one to three
CREATE OR REPLACE FUNCTION world_window_rounds()
RETURNS int[] LANGUAGE sql IMMUTABLE AS $$ SELECT ARRAY[3, 5, 7, 9, 11, 13] $$;

-- THE WORLD'S DAY COMES FROM THE WORLD, not from a constant. world_day()
-- carried the old epoch as a literal; the pyramid moves day 0 to Monday
-- 3 August 2026, and any future move must never require this function to
-- remember it - the worlds row already knows.
CREATE OR REPLACE FUNCTION world_day()
RETURNS int LANGUAGE sql STABLE SET search_path = world, public AS $$
  SELECT floor((now_ms() - (SELECT epoch_ms FROM worlds WHERE id = 1)) / 86400000.0)::int
$$;

NOTIFY pgrst, 'reload schema';
