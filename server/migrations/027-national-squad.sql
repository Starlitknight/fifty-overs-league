-- 027-national-squad.sql — EVERY NATION HAS A SIDE, ALL SEASON.
--
-- Until now a national squad existed only on the three WINDOW rounds, and only
-- for a nation the day's draw gave a fixture to. Everywhere else in the game
-- the answer to "who plays for England?" was nobody: no squad had been named,
-- so no player could be marked as an international, and the selectors' work was
-- invisible for fifteen rounds out of eighteen.
--
-- The selectors now sit BETWEEN EVERY MATCH. Before round one is bowled they
-- name a fifteen from the founding squads; before every round after it they
-- name it again, having seen the cricket since. A man plays his way in and out
-- of his country's side over a season, which is what a national side IS.
--
-- ONE ROW A NAMING, and named once: the squad standing before round R is a
-- decision taken at that moment on the form of that moment, and a re-run of the
-- day must not re-take it. That is the same law the callups keep, for the same
-- reason - the world has to settle the same way however often it is healed.
--
-- The tour squad (callups) is unchanged and still governs who actually misses
-- his club's round and what the club is paid. On a window round the callups are
-- simply the standing squad of that round, so the two can never disagree.
CREATE TABLE IF NOT EXISTS nat_squad (
  country_id text NOT NULL,
  season_no  int  NOT NULL,
  round      int  NOT NULL,               -- the squad STANDING BEFORE this round
  squad      jsonb NOT NULL,              -- [{pick, slot, club, name, age, rating, keeper, bowler}]
  named_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country_id, season_no, round)
);

-- the public read side: any device may see any nation's current fifteen, which
-- is how a player anywhere in the world earns his red star
DROP VIEW IF EXISTS public.world_nat_squad;
CREATE VIEW public.world_nat_squad AS
  SELECT country_id, season_no, round, squad, named_at FROM nat_squad;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON public.world_nat_squad TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON public.world_nat_squad TO anon;
  END IF;
END $$;
