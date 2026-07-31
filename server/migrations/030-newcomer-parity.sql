-- 030-newcomer-parity.sql — EVERY NEW MANAGER FOUNDS ON THE SAME FOOTING.
--
-- The strength ladder deals the nine claimable clubs of every league rungs
-- from 1.04 down to 0.80, shuffled onto slots per nation. Texture for the
-- table - but a lottery for a newcomer, whose auto-claim takes the first free
-- seat: joining Scotland handed you the wooden-spoon squad (0.80), joining
-- Pakistan the second seed (1.04). Two people starting the same game on the
-- same day held clubs half a class apart through no choice of their own.
--
-- New teams are now all dealt NEAR-EQUAL STRENGTH: every claimed club is
-- calibrated once to the standard newcomer rung (HUMAN_STR in init-world.mjs,
-- 0.97 x the nation tier) - competitive at once, still an underdog to the
-- boss, and identical to every other newcomer in the league. Bots keep the
-- ladder; human differences come from management, not the seating chart.
--
-- The column: a claim starts un-levelled, and the umpire's next tick scales
-- the club's existing men (same names, same careers - the board's new
-- investment raises the squad, it does not replace it) onto the newcomer rung
-- exactly once. Rows that already exist default to LEVELLED - their squads
-- are the reseed's business, not a surprise rewrite on the next tick.
ALTER TABLE claims ADD COLUMN IF NOT EXISTS levelled boolean NOT NULL DEFAULT true;

-- the claim function marks a NEW claim as waiting for its levelling
CREATE OR REPLACE FUNCTION public.world_claim_club(p_country text, p_slot int, p_name text DEFAULT 'manager', p_club_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; club record; nm text;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in to claim a club'; END IF;
  IF p_slot < 1 OR p_slot > 9 THEN RAISE EXCEPTION 'the boss club is never claimable'; END IF;
  SELECT * INTO club FROM clubs WHERE country_id = p_country AND slot = p_slot;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such club'; END IF;
  IF EXISTS (SELECT 1 FROM claims WHERE user_id = u) THEN
    RAISE EXCEPTION 'you already manage a world club - release it first';
  END IF;
  IF EXISTS (SELECT 1 FROM claims WHERE country_id = p_country AND slot = p_slot) THEN
    RAISE EXCEPTION 'that club already has a manager';
  END IF;
  INSERT INTO claims(user_id, display_name, country_id, slot, levelled)
    VALUES (u, left(coalesce(nullif(trim(p_name), ''), 'manager'), 40), p_country, p_slot, false);
  IF p_club_name IS NOT NULL AND trim(p_club_name) <> '' THEN
    nm := club_name_ok(p_country, p_slot, p_club_name);
    UPDATE clubs SET name = nm WHERE country_id = p_country AND slot = p_slot;
  END IF;
  SELECT * INTO club FROM clubs WHERE country_id = p_country AND slot = p_slot;
  RETURN jsonb_build_object('ok', true, 'country', p_country, 'slot', p_slot, 'club', club.name);
END $$;

-- ...and so does the auto-claim, which is how nearly every manager actually
-- arrives: signing up seats them at the first free club, and that seat's
-- squad is exactly the lottery the levelling exists to end.
CREATE OR REPLACE FUNCTION public.world_auto_claim(p_country text, p_name text DEFAULT 'manager', p_club_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; ctry record; s int; nm text; claimed boolean := false;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF FOUND THEN
    SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
    RETURN jsonb_build_object('ok', true, 'existing', true, 'country', c.country_id, 'slot', c.slot, 'club', club.name);
  END IF;
  SELECT * INTO ctry FROM countries WHERE id = p_country;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such country'; END IF;
  FOR s IN 1..9 LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM claims cl WHERE cl.country_id = p_country AND cl.slot = s);
    BEGIN
      INSERT INTO claims(user_id, display_name, country_id, slot, levelled)
        VALUES (u, left(coalesce(nullif(trim(p_name), ''), 'manager'), 40), p_country, s, false);
      claimed := true;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- the slot (or this user, from another device) raced us; look again
      SELECT * INTO c FROM claims WHERE user_id = u;
      IF FOUND THEN
        SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
        RETURN jsonb_build_object('ok', true, 'existing', true, 'country', c.country_id, 'slot', c.slot, 'club', club.name);
      END IF;
    END;
  END LOOP;
  IF NOT claimed THEN
    RAISE EXCEPTION '% is full - every club there already has a manager. Pick another country.', ctry.name;
  END IF;
  SELECT slot INTO s FROM claims WHERE user_id = u;
  IF p_club_name IS NOT NULL AND trim(p_club_name) <> '' THEN
    BEGIN
      nm := club_name_ok(p_country, s, p_club_name);
      UPDATE clubs SET name = nm WHERE country_id = p_country AND slot = s;
    EXCEPTION WHEN OTHERS THEN NULL;   -- best-effort christening only
    END;
  END IF;
  SELECT * INTO club FROM clubs WHERE country_id = p_country AND slot = s;
  RETURN jsonb_build_object('ok', true, 'country', p_country, 'slot', s, 'club', club.name);
END $$;

NOTIFY pgrst, 'reload schema';
