-- 031-pyramid.sql — THE WORLD BECOMES A PYRAMID (docs/PYRAMID.md).
--
-- Sixteen nations, sixteen clubs each, in two divisions of eight. Division
-- membership is SEASONAL - promotion and relegation redraw it - so the map of
-- who plays where lives on the seasons row, next to the schedules it shapes.
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS divisions jsonb;

-- A HUMAN FOUNDS A CLUB, in Division Two. The founding seats are slots 8-15;
-- the established counties and the boss (slots 0-7) are never claimable. A
-- promoted human club keeps its manager and its slot - the restriction is on
-- CLAIMING, not on where the pyramid later carries you.
CREATE OR REPLACE FUNCTION public.world_claim_club(p_country text, p_slot int, p_name text DEFAULT 'manager', p_club_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; club record; nm text;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in to claim a club'; END IF;
  IF p_slot < 8 OR p_slot > 15 THEN RAISE EXCEPTION 'only a Division Two club can be founded - the counties are not for sale'; END IF;
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

-- ...and the auto-claim seats a new manager at the first free FOUNDING seat.
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
  FOR s IN 8..15 LOOP
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
    RAISE EXCEPTION '% is full - every founding seat already has a manager. Pick another country.', ctry.name;
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
