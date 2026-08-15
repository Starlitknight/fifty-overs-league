-- 098-the-money-moves-on-the-canonical-card.sql — THE THIRD MIRROR OF THE WAGE
-- CURVE, WHICH WAS LEFT BEHIND.
--
-- B2 redefined `rating` as the canonical card times a thousand. That moved the
-- world's median rating from about 25,700 to about 50,000, and the wage curve is
-- stated entirely in terms of that median - so the curve had to be rebased or
-- every price in the game would be quoted around a landmark that had been moved.
-- It was rebased in two of the three places it lives:
--
--   engine/src/00-core.js  foWageOf   FO_WAGE_OVR50 50, MID 9290, K 3.0
--   server/market.mjs      wageFromRating   the same three
--   065 world_market_quicksell       9290 * power(rating / 25704, 2.0)   <- HERE
--
-- The third is the one that actually moves money. 065's own header says it
-- plainly - "if any of the four move, all four move" - and then only three did,
-- because nothing failed: the stale line is a FALLBACK, reached only when a man
-- carries no stored wage, and every cricketer the generator deals carries one.
-- So it sat there priced on a dead scale, waiting for the first player whose
-- wage had been dropped - a hand-inserted row, a migration that rebuilt a squad,
-- a save restored from before wages were stored - to be sold for the wrong money.
--
-- WHAT IT WOULD HAVE PAID. A median professional is OVR 50, so rating 50,000. On
-- the old fallback that is 9290 * (50000/25704)^2 = $35,150 a round, against the
-- $9,290 the rest of the game says he earns - and a quicksell is priced straight
-- off it, so the bank would have paid $13.7m for a man worth $207,000. Not a
-- rounding error: a factor of 3.8, in the club's favour, on a function any
-- manager can call.
--
-- The curve below is 00-core.js foWageOf, written out for plpgsql the way 065
-- wrote out its predecessor. The default rating for a man carrying none is the
-- world's median card rather than the old median rating, for the same reason.
--
-- Nothing here touches a stored squad or a settled book. It changes what a
-- future sale is worth, and the books recompute from the record as they always
-- have.
CREATE OR REPLACE FUNCTION public.world_market_quicksell(p_player text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; man jsonb; n_squad int; today int;
        wage numeric; rating numeric; tal int; age int; curve numeric; price int;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  SELECT p INTO man FROM jsonb_array_elements(club.squad) p WHERE p->>'name' = p_player;
  IF man IS NULL THEN RAISE EXCEPTION 'he does not play for you'; END IF;
  SELECT jsonb_array_length(club.squad) INTO n_squad;
  IF n_squad <= 13 THEN RAISE EXCEPTION 'you cannot sell below a squad of fourteen'; END IF;
  IF EXISTS (SELECT 1 FROM listings WHERE country_id = c.country_id AND slot = c.slot
               AND player = p_player AND status = 'open')
    THEN RAISE EXCEPTION 'he is on the board - withdraw him or let the window run'; END IF;
  IF EXISTS (SELECT 1 FROM callups cu
              WHERE cu.country_id = c.country_id AND cu.slot = c.slot AND cu.player = p_player
                AND cu.round >= (SELECT coalesce(max(round), 0) FROM callups WHERE country_id = c.country_id))
    THEN RAISE EXCEPTION 'he is away with his country this week'; END IF;
  today  := (world_day())::int;
  age    := coalesce((man->>'age')::int, 27);
  -- the world's median cricketer is OVR 50 by the semantic ladder's own meaning,
  -- and rating is the card times a thousand
  rating := greatest(1, coalesce((man->>'rating')::numeric, 50000));
  tal    := coalesce(jsonb_array_length(man->'talents'), 0);
  -- his wage if the world knows it, else the same curve the engine derives it
  -- from: 9290 x (rating / 50000)^3, with a talent worth six per cent
  wage := coalesce(nullif((man->>'wage')::numeric, 0),
                   greatest(400, round(9290 * power(rating / 50000.0, 3.0) * (1 + 0.06 * tal) / 10) * 10));
  curve := CASE WHEN age <= 21 THEN 1.18 WHEN age <= 25 THEN 1.12 WHEN age <= 28 THEN 1.0
                WHEN age <= 31 THEN 0.82 WHEN age <= 33 THEN 0.6 ELSE 0.4 END;
  -- a season of matchdays, the buyer's multiple, and half of it for the haste
  price := greatest(3000, (round(wage * 18 * 2.4 * curve * 0.5 / 500) * 500)::int);
  UPDATE clubs SET squad = coalesce(
      (SELECT jsonb_agg(p) FROM jsonb_array_elements(squad) p WHERE p->>'name' <> p_player),
      '[]'::jsonb)
    WHERE country_id = c.country_id AND slot = c.slot;
  INSERT INTO listings(country_id, slot, player, player_json, asking, reserve,
                       opened_day, closes_day, status, buyer_country, buyer_slot,
                       fee, settled_day, by_user)
    VALUES (c.country_id, c.slot, p_player, man, price, price,
            today, today, 'sold', 'bank', -1, price, today, u);
  RETURN jsonb_build_object('ok', true, 'player', p_player, 'fee', price,
                            'note', 'the fee lands with the next settle of the books');
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_market_quicksell(text) TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
