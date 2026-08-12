-- 087-a-tour-has-a-scorecard-too.sql — THE INTERNATIONAL GETS ITS CARD BACK.
--
-- A league round is published three ways: the fixture, the ball-by-ball, and
-- the card the umpire settled it on (world_match_card, 025/047). A friendly
-- is published the same three ways (048). A tour was published twice - the
-- fixture and, since 085, the ball-by-ball - and the card was kept back. So
-- an international could be watched from the first ball to the last and then
-- had nowhere to go: no scorecard, no partnerships, no man of the match, no
-- report. The one match in the game a manager did not pick the side for was
-- also the one match he could not read afterwards.
--
-- The card is returned now, under the same law the league card lives by: it
-- is SEALED while the broadcast is still reading the afternoon out. A tour is
-- played at INTL_HOUR (18:00 UTC) on its world day and revealed one delivery
-- every eighteen seconds from that hour, so the seal lifts at exactly the
-- moment the last ball is shown - not a minute of the window earlier, and not
-- the whole three hours later. A tour with no commentary banked (anything
-- played before 085) has nothing to pace by and is held to the window's close.
--
-- Everything the RPC already answered is answered unchanged; a page that does
-- not ask for the card cannot tell the difference.

CREATE OR REPLACE FUNCTION public.world_nat_match(p_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE m record; play_ms bigint; l record; deliveries int; done_ms bigint; card jsonb;
BEGIN
  SELECT * INTO m FROM nat_matches WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such international'; END IF;

  -- the hour the umpire played it: the world's epoch, its own world day, and
  -- the one hour every tour in the game starts at (INTL_HOUR, clock.mjs)
  SELECT w.epoch_ms + (m.world_day::bigint * 86400000) + (18::bigint * 3600000)
    INTO play_ms FROM worlds w WHERE w.id = 1;

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
    'card', card,
    'winner', m.result ->> 'winner', 'text', m.result ->> 'text');
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_nat_match(text) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_nat_match(text) TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
