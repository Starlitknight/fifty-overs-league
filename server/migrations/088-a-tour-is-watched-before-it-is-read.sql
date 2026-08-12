-- 088-a-tour-is-watched-before-it-is-read.sql — THE TOUR'S VERDICT WAITS FOR
-- THE BROADCAST, THE WAY ITS CARD ALREADY DOES.
--
-- A league round is banked an hour BEFORE its first ball: the team sheets lock
-- then, so the match's inputs are frozen and simulating it early is exactly as
-- correct. That early bank IS the broadcast - the phone reveals the umpire's
-- own book one delivery every eighteen seconds from the hour - and everything
-- the round decides is embargoed until its window shuts (settledRound).
--
-- A tour was played only once its whole window had ALREADY SHUT. So the
-- ball-by-ball it banks did not exist until the match was over, and an
-- international could not be watched at all: a manager who opened it at the
-- hour found a preview saying "scheduled" and no way in, and by the time
-- anything existed the result was on the scores page.
--
-- Tours are banked at window-open now, like a round. Which means this table
-- holds afternoons still being played, and everything that reads it has to
-- learn the same manners the league already has. 087 sealed the CARD. This
-- seals the rest: the winner and the umpire's verdict.
--
-- What stays public while a tour is on air is its FIXTURE - the two sides, the
-- day, and the id the broadcast is addressed by - because that is exactly what
-- is public about a league match in progress, and without the id there is no
-- door to watch it through.

-- the hour a tour's window shuts: its own world day, the one hour every tour
-- in the game starts at, plus the three the broadcast runs for
CREATE OR REPLACE FUNCTION public.nat_window_shut(p_day int)
RETURNS bigint LANGUAGE sql STABLE SET search_path = world, public AS $$
  SELECT w.epoch_ms + (p_day::bigint * 86400000) + (21::bigint * 3600000)
    FROM worlds w WHERE w.id = 1
$$;

-- ---------------------------------------------------------------------------
-- THE LIST. Named while it is played; silent about the outcome until it is not.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.world_nat_matches AS
  SELECT id, world_day, season_no, round, a_country, b_country, a_name, b_name,
         seed, engine_version,
         CASE WHEN now_ms() >= nat_window_shut(world_day)
              THEN result ->> 'winner' END AS winner,
         CASE WHEN now_ms() >= nat_window_shut(world_day)
              THEN result ->> 'text' END AS text,
         (now_ms() < nat_window_shut(world_day)) AS live
    FROM nat_matches;

-- ---------------------------------------------------------------------------
-- AND THE ONE TOUR. The card was already sealed to the reveal's own pace (087);
-- the verdict now waits for the window, which is always the later of the two.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_nat_match(p_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE m record; play_ms bigint; l record; deliveries int; done_ms bigint; card jsonb; shut bigint;
BEGIN
  SELECT * INTO m FROM nat_matches WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such international'; END IF;

  SELECT w.epoch_ms + (m.world_day::bigint * 86400000) + (18::bigint * 3600000)
    INTO play_ms FROM worlds w WHERE w.id = 1;
  shut := nat_window_shut(m.world_day);

  card := m.result;
  IF play_ms IS NOT NULL AND now_ms() < play_ms + 10800000 THEN
    SELECT * INTO l FROM match_logs WHERE match_id = m.id;
    IF FOUND THEN
      SELECT count(*) INTO deliveries
        FROM jsonb_array_elements(l.log) e
       WHERE coalesce(e ->> 'no', '') <> ''
         AND NOT (e ? '_top') AND NOT (e ? 'intro');
      done_ms := play_ms + least(deliveries, 600)::bigint * 18000;
    ELSE
      done_ms := play_ms + 10800000;
    END IF;
    IF now_ms() < done_ms THEN card := NULL; END IF;
  END IF;

  RETURN jsonb_build_object('id', m.id, 'day', m.world_day, 'seasonNo', m.season_no,
    'round', m.round, 'a', m.a_name, 'b', m.b_name,
    'aCountry', m.a_country, 'bCountry', m.b_country,
    'seed', m.seed, 'engineVersion', m.engine_version,
    'living', coalesce(m.living, '{}'::jsonb),
    'playAtMs', play_ms,
    'live', now_ms() < shut,
    'card', card,
    'winner', CASE WHEN now_ms() >= shut THEN m.result ->> 'winner' END,
    'text',   CASE WHEN now_ms() >= shut THEN m.result ->> 'text' END);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_nat_match(text) TO authenticated;
    GRANT SELECT ON public.world_nat_matches TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_nat_match(text) TO anon;
    GRANT SELECT ON public.world_nat_matches TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
