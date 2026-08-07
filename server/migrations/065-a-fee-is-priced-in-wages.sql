-- 065-a-fee-is-priced-in-wages.sql — THE QUICKSELL PAYS WHAT THE MARKET PAYS.
--
-- 042 priced a quicksell off the man's stored fee, falling back to a flat
-- 40,000, and halved it. That was consistent with the market of the day, when
-- a fee was rating/9 and the best cricketer alive was worth about eleven
-- thousand pounds.
--
-- A wage is on a curve now, and a fee with it: what a buyer pays is the
-- seasons of him he is buying, which is his wage times a season times a
-- multiple, bent by the years he has left. 042's arithmetic was left behind by
-- that, and 042 cannot be edited - it has run in production - so the function
-- is replaced here.
--
-- THE THREE PLACES THIS SUM LIVES must agree, or a manager is quoted one price
-- and paid another:
--   server/market.mjs  valueOf()   - the umpire's own arithmetic
--   engine 55-market   qsPrice()   - what the page promises before the button
--   this function                  - what actually moves the money
-- The constants below are those of 00-core.js foWageOf and market.mjs, written
-- out because plpgsql cannot import them. If any of the four move, all four
-- move.
--
-- Nothing here touches a stored squad or a settled book: it changes what a
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
  rating := greatest(1, coalesce((man->>'rating')::numeric, 25704));
  tal    := coalesce(jsonb_array_length(man->'talents'), 0);
  -- his wage if the world knows it, else the same curve the engine derives it
  -- from: 9290 x (rating / 25704)^2, with a talent worth six per cent
  wage := coalesce(nullif((man->>'wage')::numeric, 0),
                   greatest(400, round(9290 * power(rating / 25704.0, 2.0) * (1 + 0.06 * tal) / 10) * 10));
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
