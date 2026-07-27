-- 008-auto-claim.sql — SIGNING UP IS CLAIMING A CLUB.
-- A new manager doesn't hunt for a "claim" button: the act of signing up
-- seats them at the first free club in their chosen country, christened
-- with their own club name (best-effort - a taken or bad name never blocks
-- the claim; the club just keeps its county name). Idempotent: a manager
-- who already holds a club gets that claim back. When every claimable slot
-- in the country is human, the error says so plainly - pick another country.

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
      INSERT INTO claims(user_id, display_name, country_id, slot)
        VALUES (u, left(coalesce(nullif(trim(p_name), ''), 'manager'), 40), p_country, s);
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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_auto_claim(text, text, text) TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
