-- 078 · AN EXHIBITION SAYS WHO WON, NOT ONLY THAT IT WAS PLAYED
--
-- A man's match log lists every league fixture his club played, whether he was
-- in the side or not: the club's book names the fixture, the banked card names
-- his part in it, and where there is no part it says so. The exhibitions were
-- listed a different way - from the man's OWN friendlies book, which the
-- umpire only opens for someone who actually batted, bowled or fielded. So a
-- club could play six friendlies and a squad man see none of them, while the
-- league round he sat out was listed in full. Two rules for the same shelf.
--
-- The club-level list already exists: world_my_friendlies is what the club
-- page reads to draw its ties. It carries the fixture, the hour, both sides
-- and the result line - everything the log needs except the one fact a result
-- column is made of, which is WHO WON.
--
-- 048's body with the winner added, under exactly the gate its result line
-- already sits behind: while the broadcast is still showing, a played friendly
-- is 'in play' and says nothing about how it ended. Nothing else moves.
DROP FUNCTION IF EXISTS public.world_my_friendlies(text, int);
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
      'winner', CASE WHEN f.status = 'played'
                      AND now_ms() >= coalesce(friendly_done_ms(f.id, f.c_country, f.play_at_ms), 0)
                     THEN f.result->>'winner' ELSE NULL END,
      'text', CASE WHEN f.status = 'played'
                    AND now_ms() >= coalesce(friendly_done_ms(f.id, f.c_country, f.play_at_ms), 0)
                   THEN f.result->>'text' ELSE NULL END) AS row
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
