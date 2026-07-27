-- 007-club-names.sql — YOUR CLUB, YOUR NAME.
-- A human who claims a club may christen it (Orange Club at Headingley);
-- bots keep their real county names. The rename is server-canonical: the
-- clubs row IS the name, orders key by it, snapshots carry it, and the
-- world_clubs view hands it to every phone. Releasing the club restores
-- its default name. Matches bank the names AS PLAYED (home_name/away_name)
-- so standings survive any later rename.

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS default_name text;
UPDATE clubs SET default_name = name WHERE default_name IS NULL;

ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_name text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_name text;
UPDATE matches m SET
  home_name = (SELECT c.name FROM clubs c WHERE c.country_id = m.country_id AND c.slot = m.home_slot),
  away_name = (SELECT c.name FROM clubs c WHERE c.country_id = m.country_id AND c.slot = m.away_slot)
WHERE m.home_name IS NULL;

-- one validator, shared by claim and rename
CREATE OR REPLACE FUNCTION club_name_ok(p_country text, p_slot int, p_name text)
RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE nm text;
BEGIN
  nm := trim(p_name);
  IF nm IS NULL OR length(nm) < 2 OR length(nm) > 28 THEN
    RAISE EXCEPTION 'a club name needs 2-28 characters';
  END IF;
  IF nm !~ '^[[:alnum:] ''&.-]+$' THEN
    RAISE EXCEPTION 'club names use letters, numbers, spaces and ''&.- only';
  END IF;
  IF EXISTS (SELECT 1 FROM clubs c WHERE c.country_id = p_country AND c.slot <> p_slot
               AND (lower(c.name) = lower(nm) OR lower(c.default_name) = lower(nm))) THEN
    RAISE EXCEPTION 'that name is already taken in this league';
  END IF;
  RETURN nm;
END $$;

-- claim gains an optional christening; the old 3-arg shape is dropped so
-- PostgREST never sees an ambiguous overload
DROP FUNCTION IF EXISTS public.world_claim_club(text, int, text);
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
  INSERT INTO claims(user_id, display_name, country_id, slot)
    VALUES (u, left(coalesce(nullif(trim(p_name), ''), 'manager'), 40), p_country, p_slot);
  IF p_club_name IS NOT NULL AND trim(p_club_name) <> '' THEN
    nm := club_name_ok(p_country, p_slot, p_club_name);
    UPDATE clubs SET name = nm WHERE country_id = p_country AND slot = p_slot;
  END IF;
  SELECT * INTO club FROM clubs WHERE country_id = p_country AND slot = p_slot;
  RETURN jsonb_build_object('ok', true, 'country', p_country, 'slot', p_slot, 'club', club.name);
END $$;

-- rename any time you hold the club
CREATE OR REPLACE FUNCTION public.world_rename_club(p_club_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; nm text;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  nm := club_name_ok(c.country_id, c.slot, p_club_name);
  UPDATE clubs SET name = nm WHERE country_id = c.country_id AND slot = c.slot;
  RETURN jsonb_build_object('ok', true, 'club', nm);
END $$;

-- releasing the club hands the county its old name back
CREATE OR REPLACE FUNCTION public.world_release_club()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF FOUND THEN
    UPDATE clubs SET name = default_name WHERE country_id = c.country_id AND slot = c.slot AND default_name IS NOT NULL;
    DELETE FROM claims WHERE user_id = u;
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_claim_club(text, int, text, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_rename_club(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_release_club() TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
