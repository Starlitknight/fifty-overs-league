-- 044-absent-patch-twins.sql — TWO CLUBS OF ONE NAME BOTH SEND THEIR MEN.
--
-- The founding generator can hand a country two clubs of the same name in
-- different divisions (Bangladesh fields a Comilla CC in each). The absent
-- patch of 023 aggregated per club row and then keyed the result by club
-- NAME - jsonb_object_agg keeps the last duplicate key, so one twin's
-- called-up men silently vanished from the parcel and the broadcast would
-- have fielded a man his country had taken. Caught by the nations tests the
-- day the tour draw first sent Bangladesh on the road.
--
-- The client looks the patch up by club name and drops only men whose OWN
-- names match, so the honest shape is a union: group by name, aggregate the
-- twins' men into the one entry both clubs will read. The remaining corner -
-- a man wrongly dropped because his twin club's namesake was called up - asks
-- for two clubs of one name each employing a man of one name, a coincidence
-- an order smaller than the one this migration repairs.
CREATE OR REPLACE FUNCTION world_absent_patch(p_country text, p_season int, p_round int)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_object_agg(g.name, g.men), '{}'::jsonb)
    FROM (
      SELECT cl.name, jsonb_object_agg(cu.player, jsonb_build_object('a', true)) AS men
        FROM clubs cl
        JOIN callups cu ON cu.country_id = cl.country_id AND cu.slot = cl.slot
         AND cu.season_no = p_season AND cu.round = p_round
       WHERE cl.country_id = p_country
       GROUP BY cl.name
    ) g;
$$;
