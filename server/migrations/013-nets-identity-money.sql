-- 013-nets-identity-money.sql — WHAT A CLUB IS, THE WORLD NOW HOLDS.
-- Three things still lived on the manager's phone, where the world could not
-- see them and nothing stopped them being edited: the training the players
-- do, the club's own face, and its money. All three move here.
--
--   training  a plan per club (player -> programme). The umpire captures the
--             plan in force each round into training_rounds, so a squad's
--             skills are a pure function of the plans it has actually run -
--             recomputable from genesis, exactly like everything else.
--   identity  the crest, the colour and the motto rivals see on your page.
--   money     a treasury settled by the umpire from gate takings and the
--             wage bill, never written by a device.

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS training jsonb;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS identity jsonb;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS bank bigint;

CREATE TABLE IF NOT EXISTS training_rounds (
  country_id text NOT NULL,
  slot       int  NOT NULL,
  season_no  int  NOT NULL,
  round      int  NOT NULL,
  plan       jsonb NOT NULL,
  PRIMARY KEY (country_id, slot, season_no, round)
);

-- THE NETS: a manager sets what their men work on. No lock and no window -
-- training is a standing instruction, not a teamsheet; whatever stands when
-- a round settles is the work that round did.
CREATE OR REPLACE FUNCTION public.world_set_training(p_plan jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  IF p_plan IS NULL OR jsonb_typeof(p_plan) <> 'object' THEN RAISE EXCEPTION 'a training plan is an object'; END IF;
  IF pg_column_size(p_plan) > 20000 THEN RAISE EXCEPTION 'training plan too large'; END IF;
  UPDATE clubs SET training = p_plan WHERE country_id = c.country_id AND slot = c.slot;
  RETURN jsonb_build_object('ok', true, 'players', (SELECT count(*) FROM jsonb_object_keys(p_plan)));
END $$;

-- THE CLUB'S FACE: colours and a motto the whole world reads on your page.
CREATE OR REPLACE FUNCTION public.world_set_identity(p_identity jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; col text; motto text; crest text; out_id jsonb;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  IF p_identity IS NULL OR jsonb_typeof(p_identity) <> 'object' THEN RAISE EXCEPTION 'an identity is an object'; END IF;
  col := coalesce(p_identity->>'colour', '#C8542F');
  IF col !~ '^#[0-9A-Fa-f]{6}$' THEN RAISE EXCEPTION 'a colour is a hex like #C8542F'; END IF;
  motto := trim(coalesce(p_identity->>'motto', ''));
  IF length(motto) > 60 THEN RAISE EXCEPTION 'a motto is 60 characters at most'; END IF;
  crest := coalesce(p_identity->>'crest', '');
  IF length(crest) > 8 THEN RAISE EXCEPTION 'a crest is a short mark'; END IF;
  out_id := jsonb_build_object('colour', upper(col), 'motto', motto, 'crest', crest);
  UPDATE clubs SET identity = out_id WHERE country_id = c.country_id AND slot = c.slot;
  RETURN jsonb_build_object('ok', true, 'identity', out_id);
END $$;

-- your own status now carries the three things that came in from the phone
CREATE OR REPLACE FUNCTION public.world_my_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; o jsonb;
BEGIN
  u := _uid();
  IF u IS NULL THEN RETURN jsonb_build_object('signedIn', false); END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RETURN jsonb_build_object('signedIn', true, 'claim', null); END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  SELECT jsonb_agg(jsonb_build_object('round', round, 'at', submitted_at) ORDER BY round)
    INTO o FROM orders WHERE user_id = u AND country_id = c.country_id;
  RETURN jsonb_build_object('signedIn', true,
    'claim', jsonb_build_object('country', c.country_id, 'slot', c.slot, 'club', club.name,
                                'name', c.display_name, 'ground', club.ground),
    'orders', coalesce(o, '[]'::jsonb),
    'squad', club.squad,
    'training', coalesce(club.training, '{}'::jsonb),
    'identity', club.identity,
    'bank', club.bank);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_set_training(jsonb) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_set_identity(jsonb) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_my_status() TO authenticated;
  END IF;
END $$;

-- the public club view carries the club's face (never its squad's strength)
-- identity is appended, never inserted: CREATE OR REPLACE may only add
-- columns at the end of an existing view
CREATE OR REPLACE VIEW public.world_clubs AS
  SELECT cl.country_id, cl.slot, cl.name, cl.ground, cl.is_boss,
         c.display_name AS manager, cl.identity
    FROM clubs cl LEFT JOIN claims c
      ON c.country_id = cl.country_id AND c.slot = cl.slot;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON public.world_clubs TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON public.world_clubs TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
