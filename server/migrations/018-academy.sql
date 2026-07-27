-- 018-academy.sql — THE ACADEMY
--
-- Every club keeps an academy: a level it pays for, and a handful of colts on
-- the books. The umpire brings a new boy in when there is room, ages them at
-- the rollover and hands a twenty-one-year-old his senior shirt whether the
-- manager is watching or not - a club that never logs in still produces
-- cricketers.
--
-- The state here is only what a DECISION changes: the level a manager bought,
-- what he has spent on it, and the colts currently on the books. Everything
-- else - who each boy is, how good he is - is a pure function of
-- (country, slot, season, index, level), so a re-run of any tick produces the
-- same young cricketers, and the treasury still recomputes from genesis.

-- ---------------------------------------------------------------------------
-- FIRST, A CORRECTION. 017 wrote the manager's name to clubs.manager, and
-- there is no such column: the name a rival reads is claims.display_name,
-- which is what world_clubs has always served. The functions 017 created
-- compiled but would have failed on their first call, and world_my_status is
-- called on every world page - so both are rewritten here against the real
-- column. History is immutable; corrections are new files.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_set_manager(p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; nm text;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  nm := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  IF length(nm) < 2 THEN RAISE EXCEPTION 'a name is two letters or more'; END IF;
  IF length(nm) > 24 THEN RAISE EXCEPTION 'a name is 24 characters at most'; END IF;
  IF nm !~ '^[A-Za-z0-9][A-Za-z0-9 ''\.\-]*$' THEN
    RAISE EXCEPTION 'letters, numbers, spaces, apostrophes, dots and hyphens only';
  END IF;
  UPDATE claims SET display_name = nm WHERE user_id = u;
  RETURN jsonb_build_object('ok', true, 'manager', nm, 'country', c.country_id, 'slot', c.slot);
END $$;

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS academy int NOT NULL DEFAULT 2;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS academy_paid bigint NOT NULL DEFAULT 0;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS youth jsonb NOT NULL DEFAULT '[]'::jsonb;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clubs_academy_range') THEN
    ALTER TABLE clubs ADD CONSTRAINT clubs_academy_range CHECK (academy BETWEEN 1 AND 5) NOT VALID;
  END IF;
END $$;

-- an upgrade costs the treasury and is remembered, so the money still settles
-- from genesis: bank = gate - wages - upkeep - what the academy cost
CREATE OR REPLACE FUNCTION public.world_set_academy(p_level int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; cost bigint := 0; lv int;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  IF p_level IS NULL OR p_level < 1 OR p_level > 5 THEN RAISE EXCEPTION 'an academy runs from 1 to 5'; END IF;
  IF p_level <= club.academy THEN RAISE EXCEPTION 'an academy is never sold back'; END IF;
  -- each step up costs 60k times the level you are leaving, as the old office did
  FOR lv IN club.academy..(p_level - 1) LOOP cost := cost + lv * 60000; END LOOP;
  IF club.bank < cost THEN
    RAISE EXCEPTION 'that costs %, and the treasury holds %', cost, club.bank;
  END IF;
  UPDATE clubs SET academy = p_level, academy_paid = academy_paid + cost, bank = bank - cost
    WHERE country_id = c.country_id AND slot = c.slot;
  RETURN jsonb_build_object('ok', true, 'academy', p_level, 'cost', cost);
END $$;

-- a manager may bring a boy up early, or let him go. Auto-promotion at 21 is
-- the umpire's job and needs no button.
CREATE OR REPLACE FUNCTION public.world_colt(p_name text, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; colt jsonb; rest jsonb; s_no int; r_no int;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  IF p_action NOT IN ('promote', 'release') THEN RAISE EXCEPTION 'promote or release'; END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  SELECT y INTO colt FROM jsonb_array_elements(club.youth) y WHERE y->>'name' = p_name LIMIT 1;
  IF colt IS NULL THEN RAISE EXCEPTION 'no colt of that name'; END IF;
  SELECT coalesce(jsonb_agg(y), '[]'::jsonb) INTO rest
    FROM jsonb_array_elements(club.youth) y WHERE y->>'name' <> p_name;
  IF p_action = 'promote' THEN
    IF jsonb_array_length(club.squad) >= 20 THEN RAISE EXCEPTION 'the senior squad is full at twenty'; END IF;
    -- he stops being a colt the moment he is handed a senior shirt, and the
    -- round he first wore it is remembered, so the nets he was never at are
    -- never worked into him
    SELECT coalesce(max(season_no), 1) INTO s_no FROM seasons WHERE country_id = c.country_id;
    SELECT coalesce(max(round), 0) + 1 INTO r_no FROM training_rounds
      WHERE country_id = c.country_id AND slot = c.slot AND season_no = s_no;
    UPDATE clubs SET youth = rest,
                     squad = club.squad || jsonb_build_array(
                       ((colt - 'colt') - 'promise')
                       || jsonb_build_object('joined', jsonb_build_object('s', s_no, 'r', r_no)))
      WHERE country_id = c.country_id AND slot = c.slot;
  ELSE
    UPDATE clubs SET youth = rest WHERE country_id = c.country_id AND slot = c.slot;
  END IF;
  RETURN jsonb_build_object('ok', true, 'action', p_action, 'name', p_name);
END $$;

-- your own status carries the academy: the level, and the boys on the books
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
    'manager', c.display_name,
    'orders', coalesce(o, '[]'::jsonb),
    'squad', club.squad,
    'training', coalesce(club.training, '{}'::jsonb),
    'identity', club.identity,
    'academy', club.academy,
    'youth', coalesce(club.youth, '[]'::jsonb),
    'bank', club.bank);
END $$;

-- the public club view says what LEVEL a rival's academy is - that is a
-- building, and buildings are visible - but never who is in it
DROP VIEW IF EXISTS public.world_clubs;
CREATE VIEW public.world_clubs AS
  SELECT cl.country_id, cl.slot, cl.name, cl.ground, cl.is_boss, cl.identity, cl.academy,
         c.display_name AS manager
    FROM clubs cl
    LEFT JOIN claims c ON c.country_id = cl.country_id AND c.slot = cl.slot;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_set_academy(int) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_colt(text, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_my_status() TO authenticated;
    GRANT SELECT ON public.world_clubs TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON public.world_clubs TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
