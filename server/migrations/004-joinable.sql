-- 004-joinable.sql — P3: THE JOINABLE WORLD (+ P4/P5 storage).
-- Humans claim a bot club in any nation (never the boss, slot 0) and submit
-- orders; the umpire plays them at that nation's hour. Writes go ONLY
-- through the SECURITY DEFINER functions below ("no client trust"): they
-- self-authorize from the caller's JWT, validate everything, and are the
-- entire write surface. Cup matches (Champions Cup of clubs, World Cup of
-- nations) and national squads get their own tables here too.

CREATE TABLE claims (
  user_id     uuid PRIMARY KEY,
  display_name text NOT NULL DEFAULT 'manager',
  country_id  text NOT NULL REFERENCES countries(id),
  slot        int  NOT NULL CHECK (slot BETWEEN 1 AND 9),   -- the boss (0) is never claimable
  claimed_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_id, slot)
);

CREATE TABLE orders (
  user_id     uuid NOT NULL,
  country_id  text NOT NULL REFERENCES countries(id),
  season_no   int  NOT NULL,
  round       int  NOT NULL CHECK (round BETWEEN 1 AND 18),
  orders      jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country_id, season_no, round, user_id)
);

CREATE TABLE cup_matches (
  comp        text NOT NULL CHECK (comp IN ('wcl','wc')),   -- wcl = Champions Cup of clubs, wc = World Cup of nations
  season_no   int  NOT NULL,
  stage       text NOT NULL,
  gi          int  NOT NULL,
  a           jsonb NOT NULL,     -- {country, slot?, name}
  b           jsonb NOT NULL,
  seed        bigint NOT NULL,
  engine_version text NOT NULL,
  result      jsonb NOT NULL,
  result_canonical text NOT NULL,
  played_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comp, season_no, stage, gi)
);

CREATE TABLE nat_squads (
  country_id  text NOT NULL REFERENCES countries(id),
  season_no   int  NOT NULL,
  squad       jsonb NOT NULL,     -- the 15 best real players of that nation's league
  PRIMARY KEY (country_id, season_no)
);

-- the caller's identity, from the JWT PostgREST forwards. No dependency on
-- the auth schema, so local test databases work: tests set the same GUC.
CREATE OR REPLACE FUNCTION _uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
$$;

-- ---- the write surface (public schema: PostgREST exposes it) --------------
CREATE OR REPLACE FUNCTION public.world_claim_club(p_country text, p_slot int, p_name text DEFAULT 'manager')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; club record;
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
  RETURN jsonb_build_object('ok', true, 'country', p_country, 'slot', p_slot, 'club', club.name);
END $$;

CREATE OR REPLACE FUNCTION public.world_release_club()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  DELETE FROM claims WHERE user_id = u;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.world_submit_orders(p_round int, p_orders jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; s record;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  IF p_orders IS NULL OR pg_column_size(p_orders) > 30000 THEN RAISE EXCEPTION 'orders too large'; END IF;
  SELECT * INTO s FROM seasons WHERE country_id = c.country_id ORDER BY season_no DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no season'; END IF;
  IF p_round < 1 OR p_round > 18 THEN RAISE EXCEPTION 'bad round'; END IF;
  INSERT INTO orders(user_id, country_id, season_no, round, orders)
    VALUES (u, c.country_id, s.season_no, p_round, p_orders)
    ON CONFLICT (country_id, season_no, round, user_id)
    DO UPDATE SET orders = EXCLUDED.orders, submitted_at = now();
  RETURN jsonb_build_object('ok', true, 'country', c.country_id, 'season', s.season_no, 'round', p_round);
END $$;

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
    'claim', jsonb_build_object('country', c.country_id, 'slot', c.slot, 'club', club.name, 'name', c.display_name),
    'orders', coalesce(o, '[]'::jsonb),
    'squad', club.squad);
END $$;

-- ---- the read surface -----------------------------------------------------
CREATE OR REPLACE VIEW public.world_clubs AS
  SELECT cl.country_id, cl.slot, cl.name, cl.ground, cl.is_boss,
         c.display_name AS manager
    FROM clubs cl LEFT JOIN claims c
      ON c.country_id = cl.country_id AND c.slot = cl.slot;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_claim_club(text, int, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_release_club() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_submit_orders(int, jsonb) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_my_status() TO authenticated;
    GRANT SELECT ON public.world_clubs TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON public.world_clubs TO anon;
    GRANT EXECUTE ON FUNCTION public.world_my_status() TO anon;
  END IF;
END $$;
