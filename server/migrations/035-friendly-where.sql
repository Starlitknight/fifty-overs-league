-- 035-friendly-where.sql — A FRIENDLY KNOWS WHICH TWO CLUBS IT IS BETWEEN.
-- Challenges are issued from a club's own dossier now, so that page has to
-- be able to ask "which of my friendlies are against THIS club" - and a name
-- is not an answer: two nations may each field a Durham, and the post only
-- ever carried names. So the post carries both clubs' coordinates, and takes
-- an optional pair to filter by. A dossier asks for its own fixtures and gets
-- only those; the club office still calls it bare and gets the lot.

DROP FUNCTION IF EXISTS public.world_my_friendlies();
CREATE OR REPLACE FUNCTION public.world_my_friendlies(p_country text DEFAULT NULL, p_slot int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; o jsonb;
BEGIN
  u := _uid();
  IF u IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT coalesce(jsonb_agg(row ORDER BY (row->>'id')::bigint DESC), '[]'::jsonb) INTO o FROM (
    SELECT jsonb_build_object(
      'id', f.id, 'status', f.status, 'playAtMs', f.play_at_ms,
      'home', f.c_name, 'away', f.o_name,
      'cCountry', f.c_country, 'cSlot', f.c_slot,
      'oCountry', f.o_country, 'oSlot', f.o_slot,
      'mine', f.challenger = u, 'incoming', f.opponent = u AND f.status = 'offered',
      'myOrders', CASE WHEN f.challenger = u THEN f.c_orders IS NOT NULL ELSE f.o_orders IS NOT NULL END,
      'text', f.result->>'text') AS row
      FROM friendlies f
     WHERE (f.challenger = u OR f.opponent = u)
       AND (p_country IS NULL OR p_slot IS NULL
            OR (f.c_country = p_country AND f.c_slot = p_slot)
            OR (f.o_country = p_country AND f.o_slot = p_slot))
     ORDER BY f.id DESC LIMIT 20) q;
  RETURN o;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_my_friendlies(text, int) TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
