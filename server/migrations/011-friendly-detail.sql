-- 011-friendly-detail.sql — A FRIENDLY IS A BROADCAST TOO.
-- From one hour before play (when lineups lock), anyone may read a
-- friendly's fixture card: both clubs by their CURRENT names, the sealed
-- lineups exactly as the umpire will use them (friendly lineup first, the
-- manager's latest league orders second), the kick-off and the seed inputs.
-- The theatre replays the identical match from these - watched == recorded,
-- friendlies included. Before T-1h it refuses: teamsheets stay sealed.

CREATE OR REPLACE FUNCTION public.world_friendly_detail(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE f record; hc record; ac record; o jsonb := '{}'::jsonb; fb jsonb;
BEGIN
  SELECT * INTO f FROM friendlies WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such friendly'; END IF;
  IF f.status NOT IN ('accepted','played') THEN RAISE EXCEPTION 'this friendly is %', f.status; END IF;
  IF now_ms() < f.play_at_ms - 3600000 THEN
    RAISE EXCEPTION 'teamsheets are sealed until an hour before the match';
  END IF;
  SELECT * INTO hc FROM clubs WHERE country_id = f.c_country AND slot = f.c_slot;
  SELECT * INTO ac FROM clubs WHERE country_id = f.o_country AND slot = f.o_slot;
  -- the umpire's exact order of precedence, keyed by current club names
  IF f.c_orders IS NOT NULL THEN o := o || jsonb_build_object(hc.name, f.c_orders);
  ELSIF f.challenger IS NOT NULL THEN
    SELECT orders INTO fb FROM orders WHERE user_id = f.challenger ORDER BY submitted_at DESC LIMIT 1;
    IF fb IS NOT NULL THEN o := o || jsonb_build_object(hc.name, fb); END IF;
  END IF;
  fb := NULL;
  IF f.o_orders IS NOT NULL THEN o := o || jsonb_build_object(ac.name, f.o_orders);
  ELSIF f.opponent IS NOT NULL THEN
    SELECT orders INTO fb FROM orders WHERE user_id = f.opponent ORDER BY submitted_at DESC LIMIT 1;
    IF fb IS NOT NULL THEN o := o || jsonb_build_object(ac.name, fb); END IF;
  END IF;
  RETURN jsonb_build_object(
    'id', f.id, 'status', f.status, 'playAtMs', f.play_at_ms,
    'home', jsonb_build_object('country', f.c_country, 'slot', f.c_slot, 'name', hc.name),
    'away', jsonb_build_object('country', f.o_country, 'slot', f.o_slot, 'name', ac.name),
    'orders', o, 'text', f.result->>'text');
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_friendly_detail(bigint) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_friendly_detail(bigint) TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
