-- 047-broadcast-embargo.sql — NO SPOILERS FROM THE SHELF.
--
-- The umpire now banks a match an hour BEFORE its first ball, and the two
-- read surfaces that hand out banked cricket were written in an age when
-- "banked" could only mean "played and public" (025: "a row in matches
-- exists only because the match has been played"). Prebanking broke that
-- law, so the reads must now keep the broadcast's clock:
--
--   world_match_log : answers from the FIRST BALL. The feed page reveals the
--                     commentary delivery by delivery on the shared clock;
--                     before the window opens there is nothing to watch, so
--                     there is nothing to read.
--   world_match_card: answers from the LAST BALL SHOWN - first ball plus
--                     eighteen seconds a delivery, the same 3h/600 pace the
--                     feed reveals by, capped at the window's three hours.
--                     The full scorecard names the winner, so it stays
--                     sealed until the broadcast has shown the winning run.
--
-- A match with no play window (a friendly detail row, a cup tie outside the
-- league calendar, a pruned commentary past its seven days) serves exactly
-- as before: those are history, not futures.

CREATE OR REPLACE FUNCTION public.world_match_log(p_country text, p_match_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE l record; m record; play_ms bigint;
BEGIN
  SELECT * INTO l FROM match_logs
   WHERE match_id = p_match_id AND country_id = p_country
     AND played_at >= now() - interval '7 days';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('country', p_country, 'id', p_match_id, 'log', null);
  END IF;
  SELECT season_no, round INTO m FROM matches
   WHERE id = p_match_id AND country_id = p_country;
  IF FOUND AND m.round IS NOT NULL THEN
    play_ms := round_play_ms(p_country, m.season_no, m.round);
    IF play_ms IS NOT NULL AND now_ms() < play_ms THEN
      RETURN jsonb_build_object('country', p_country, 'id', p_match_id, 'log', null);
    END IF;
  END IF;
  RETURN jsonb_build_object('country', p_country, 'id', l.match_id, 'log', l.log);
END $$;

CREATE OR REPLACE FUNCTION public.world_match_card(p_country text, p_match_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE m record; play_ms bigint; l record; deliveries int; done_ms bigint;
BEGIN
  SELECT * INTO m FROM matches
   WHERE id = p_match_id AND country_id = p_country AND result IS NOT NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('country', p_country, 'id', p_match_id, 'card', null);
  END IF;
  IF m.round IS NOT NULL THEN
    play_ms := round_play_ms(p_country, m.season_no, m.round);
  END IF;
  IF play_ms IS NOT NULL AND now_ms() < play_ms + 10800000 THEN
    -- inside the window: sealed until the broadcast has shown the last ball.
    -- The pace is the feed page's own - one delivery every 18 seconds, a
    -- delivery being a commentary row with a ball number - so the card
    -- opens at the very moment the reveal completes.
    SELECT * INTO l FROM match_logs
     WHERE match_id = p_match_id AND country_id = p_country;
    IF FOUND THEN
      SELECT count(*) INTO deliveries
        FROM jsonb_array_elements(l.log) e
       WHERE coalesce(e ->> 'no', '') <> ''
         AND NOT (e ? '_top') AND NOT (e ? 'intro');
      done_ms := play_ms + least(deliveries, 600)::bigint * 18000;
    ELSE
      -- no commentary to pace by: hold the card to the window's close
      done_ms := play_ms + 10800000;
    END IF;
    IF now_ms() < done_ms THEN
      RETURN jsonb_build_object('country', p_country, 'id', p_match_id, 'card', null);
    END IF;
  END IF;
  RETURN jsonb_build_object('country', p_country, 'id', m.id,
                            'seasonNo', m.season_no, 'round', m.round,
                            'home', m.home_name, 'away', m.away_name,
                            'card', m.result);
END $$;
