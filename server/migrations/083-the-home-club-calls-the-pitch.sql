-- 083 · THE HOME CLUB CALLS THE PITCH
--
-- The square was the weather's business. condOf gives every fixture a pitch
-- from the nation's climate and the home club's own leaning - England green,
-- India turning, a pace battery's groundsman leaving the grass on - and the
-- umpire has always bowled on exactly what the fixtures page promised.
--
-- That is the ground the manager does not own. He picks the eleven and the
-- orders and then plays them on whatever the soil felt like; the one lever
-- every home captain in cricket actually pulls is the one he did not have.
-- So the pitch for a HOME fixture becomes his call.
--
-- Three rules, and they are the whole design.
--
--   IT IS HIS OWN GROUND. A row is keyed by the caller's own country and
--   slot, and the umpire reads the call under the HOST's key. A call for a
--   match you do not host is a row nothing ever looks at, which is why this
--   needs no fixture table to check against: the key does the checking.
--
--   IT CLOSES 48 HOURS OUT. A square takes days to prepare, and a pitch
--   chosen the night before is not preparation, it is a trick played on a
--   visiting side that has already picked its spinners. round_play_ms is the
--   same first ball the teamsheet lock counts from, so the two deadlines can
--   never drift apart.
--
--   IT IS SAID ONCE. The primary key is the match, and the insert refuses a
--   second row rather than replacing the first. A groundsman told to prepare
--   a green top and then a turner on Wednesday prepares neither.
--
-- The call is PUBLIC, like the ticket price 073 made public before it. A
-- pitch is a physical thing at a ground; the fixtures page has promised the
-- surface openly since the day conditions existed, and a decision that made
-- that promise a lie would be worse than one a rival can read.
CREATE TABLE IF NOT EXISTS pitch_calls (
  country_id text   NOT NULL,
  slot       int    NOT NULL,
  season_no  int    NOT NULL,
  round      int    NOT NULL,
  pitch      text   NOT NULL,
  called_ms  bigint NOT NULL,
  PRIMARY KEY (country_id, slot, season_no, round)
);

-- the seven surfaces the engine bowls on, and nothing else. The names are the
-- shipped client's own ids (FO_PITCHES in 00-boot-auth.js); a pitch the engine
-- does not know would be handed to newMatch and quietly play as balanced.
CREATE OR REPLACE FUNCTION world_pitch_kinds()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['balanced', 'flat', 'green', 'dry', 'slow', 'cracked', 'twoPaced']
$$;

-- HOW LONG THE GROUNDSMAN NEEDS. Two days, in milliseconds, counted back from
-- the first ball.
CREATE OR REPLACE FUNCTION world_pitch_notice()
RETURNS bigint LANGUAGE sql IMMUTABLE AS $$ SELECT 172800000::bigint $$;

CREATE OR REPLACE FUNCTION public.world_call_pitch(p_season int, p_round int, p_pitch text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; play_ms bigint; shut bigint; had record;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  IF p_pitch IS NULL OR NOT (p_pitch = ANY (world_pitch_kinds())) THEN
    RAISE EXCEPTION 'no groundsman can prepare that';
  END IF;
  play_ms := round_play_ms(c.country_id, p_season, p_round);
  IF play_ms IS NULL THEN RAISE EXCEPTION 'that is not a fixture on your calendar'; END IF;
  shut := play_ms - world_pitch_notice();
  IF now_ms() >= shut THEN
    RAISE EXCEPTION 'the square is already being prepared - a pitch is called at least 48 hours before the first ball';
  END IF;
  SELECT * INTO had FROM pitch_calls
   WHERE country_id = c.country_id AND slot = c.slot AND season_no = p_season AND round = p_round;
  IF FOUND THEN
    RAISE EXCEPTION 'your groundsman already has his orders for this match: %', had.pitch;
  END IF;
  INSERT INTO pitch_calls(country_id, slot, season_no, round, pitch, called_ms)
    VALUES (c.country_id, c.slot, p_season, p_round, p_pitch, now_ms());
  RETURN jsonb_build_object('ok', true, 'pitch', p_pitch, 'season', p_season,
                            'round', p_round, 'shuts', shut);
END $$;

-- every call standing at a ground, with the instant each one shuts, so a page
-- can draw the board without doing the calendar twice
CREATE OR REPLACE FUNCTION public.world_pitch_calls(p_country text, p_slot int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = world, public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'season', season_no, 'round', round, 'pitch', pitch, 'at', called_ms,
           'shuts', round_play_ms(country_id, season_no, round) - world_pitch_notice())
         ORDER BY season_no, round), '[]'::jsonb)
    FROM pitch_calls WHERE country_id = p_country AND slot = p_slot;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_call_pitch(int, int, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_pitch_calls(text, int) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_pitch_calls(text, int) TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
