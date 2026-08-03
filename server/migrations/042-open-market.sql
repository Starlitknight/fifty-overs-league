-- 042-open-market.sql — THE MARKET GOES TO OPEN OUTCRY.
--
-- The sealed envelope is retired by decree: the owner wants a market where
-- the current price is public and a manager can see he has been outbid. So:
--
--   * the board now shows the HIGH BID and who holds it, and the reserve.
--   * a new offer must BEAT the standing one by at least the step ($500).
--   * an offer made in the open STANDS - there is no taking it back, because
--     a public high bid that can vanish is not a price.
--   * the window is unchanged: three world days, the umpire settles, highest
--     at or above the reserve takes him. Absence still only costs you the
--     auctions you chose not to enter.
--
-- And two decisions a manager makes alone, no auction needed:
--   * QUICK-SELL: the bank buys any of his men, instantly, at half the
--     market's own valuation. The fee walks through the books like any deal.
--   * RELEASE: a man is let go for nothing, freeing his shirt and his wage.
--
-- Free agents (slot -1) are the umpire's listings: men of no club, trickled
-- onto the board daily by the service (server/market.mjs). Selling nobody,
-- they need no seller-side handling here - only the views must name them.

-- ---------------------------------------------------------------------------
-- THE BOARD, open edition. What was hidden is now the point: reserve, high
-- bid, and the club holding it. Player skills stay private - the scout trade
-- is untouched.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.world_listings;
CREATE VIEW public.world_listings AS
  SELECT l.id, l.country_id, l.slot,
         CASE WHEN l.slot < 0 THEN 'Free agent' ELSE cl.name END AS club,
         l.player, l.asking, l.reserve, l.opened_day, l.closes_day, l.status,
         (l.by_user IS NOT NULL) AS managed,
         (SELECT count(*) FROM bids b WHERE b.listing_id = l.id) AS offers,
         (SELECT max(b.amount) FROM bids b WHERE b.listing_id = l.id) AS high,
         (SELECT coalesce(c2.name, 'a club')
            FROM bids b2 LEFT JOIN clubs c2
              ON c2.country_id = b2.country_id AND c2.slot = b2.slot
           WHERE b2.listing_id = l.id
           ORDER BY b2.amount DESC, b2.placed_at ASC LIMIT 1) AS high_club
    FROM listings l LEFT JOIN clubs cl ON cl.country_id = l.country_id AND cl.slot = l.slot
   WHERE l.status = 'open';

DROP VIEW IF EXISTS public.world_deals;
CREATE VIEW public.world_deals AS
  SELECT l.id, l.player, l.fee, l.settled_day,
         l.country_id AS from_country,
         CASE WHEN l.slot < 0 THEN 'Free agent' ELSE s.name END AS from_club,
         l.buyer_country AS to_country,
         CASE WHEN l.buyer_country = 'bank' THEN 'the bank'
              WHEN l.buyer_country = 'released' THEN 'released'
              ELSE b.name END AS to_club
    FROM listings l
    LEFT JOIN clubs s ON s.country_id = l.country_id AND s.slot = l.slot
    LEFT JOIN clubs b ON b.country_id = l.buyer_country AND b.slot = l.buyer_slot
   WHERE l.status = 'sold';

-- ---------------------------------------------------------------------------
-- THE OPEN BID. Beat the standing price by the step or hold your tongue. The
-- first offer must clear the market's floor; every later one must clear the
-- board. Affordability and the eighteen-man staff are checked as before.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_market_bid(p_id bigint, p_amount int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; L record; club record; n_squad int; floor_bid int; cur_high int;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT * INTO L FROM listings WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such listing'; END IF;
  IF L.status <> 'open' THEN RAISE EXCEPTION 'that window has shut'; END IF;
  IF L.country_id = c.country_id AND L.slot = c.slot THEN RAISE EXCEPTION 'he already plays for you'; END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  SELECT jsonb_array_length(club.squad) INTO n_squad;
  IF n_squad >= 18 THEN RAISE EXCEPTION 'eighteen men is a full staff - sell before you buy'; END IF;
  floor_bid := ceil(L.asking * 0.55);
  SELECT max(amount) INTO cur_high FROM bids WHERE listing_id = p_id;
  IF cur_high IS NOT NULL THEN floor_bid := greatest(floor_bid, cur_high + 500); END IF;
  IF p_amount IS NULL OR p_amount < floor_bid THEN
    RAISE EXCEPTION 'the board stands at more - offer at least %', floor_bid; END IF;
  IF p_amount > club.bank THEN RAISE EXCEPTION 'your bank will not cover that'; END IF;
  INSERT INTO bids(listing_id, country_id, slot, amount, user_id)
    VALUES (p_id, c.country_id, c.slot, p_amount, u)
    ON CONFLICT (listing_id, country_id, slot)
    DO UPDATE SET amount = EXCLUDED.amount, placed_at = now(), user_id = EXCLUDED.user_id
    WHERE bids.amount < EXCLUDED.amount;
  RETURN jsonb_build_object('ok', true, 'id', p_id, 'amount', p_amount,
                            'closes', L.closes_day, 'leading', true);
END $$;

-- an offer made in the open STANDS
CREATE OR REPLACE FUNCTION public.world_market_unbid(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
BEGIN
  RAISE EXCEPTION 'open bidding - an offer made in the open stands until the hammer';
END $$;

-- ---------------------------------------------------------------------------
-- QUICK-SELL. The bank buys any man, now, at half the market's valuation of
-- him - the same age-curved figure the umpire prices listings with, so the
-- number is knowable before the button is pressed. Recorded as a settled
-- listing with the bank as buyer: the books walk the fee in like any deal,
-- and the register reads it honestly.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_market_quicksell(p_player text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; man jsonb; n_squad int; today int;
        base int; age int; curve numeric; price int;
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
  today := (world_day())::int;
  base  := greatest(5000, coalesce((man->>'fee')::int, 40000));
  age   := coalesce((man->>'age')::int, 27);
  curve := CASE WHEN age <= 21 THEN 1.18 WHEN age <= 25 THEN 1.12 WHEN age <= 28 THEN 1.0
                WHEN age <= 31 THEN 0.82 WHEN age <= 33 THEN 0.6 ELSE 0.4 END;
  price := greatest(3000, (round(base * curve * 0.5 / 500) * 500)::int);
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

-- RELEASE. A shirt freed for nothing: the man simply goes. Recorded at a fee
-- of zero so the register remembers he was let go, not sold.
CREATE OR REPLACE FUNCTION public.world_market_release(p_player text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; man jsonb; n_squad int; today int;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  SELECT p INTO man FROM jsonb_array_elements(club.squad) p WHERE p->>'name' = p_player;
  IF man IS NULL THEN RAISE EXCEPTION 'he does not play for you'; END IF;
  SELECT jsonb_array_length(club.squad) INTO n_squad;
  IF n_squad <= 13 THEN RAISE EXCEPTION 'you cannot go below a squad of fourteen'; END IF;
  IF EXISTS (SELECT 1 FROM listings WHERE country_id = c.country_id AND slot = c.slot
               AND player = p_player AND status = 'open')
    THEN RAISE EXCEPTION 'he is on the board - withdraw him first'; END IF;
  today := (world_day())::int;
  UPDATE clubs SET squad = coalesce(
      (SELECT jsonb_agg(p) FROM jsonb_array_elements(squad) p WHERE p->>'name' <> p_player),
      '[]'::jsonb)
    WHERE country_id = c.country_id AND slot = c.slot;
  INSERT INTO listings(country_id, slot, player, player_json, asking, reserve,
                       opened_day, closes_day, status, buyer_country, buyer_slot,
                       fee, settled_day, by_user)
    VALUES (c.country_id, c.slot, p_player, man, 0, 0,
            today, today, 'sold', 'released', -1, 0, today, u);
  RETURN jsonb_build_object('ok', true, 'player', p_player);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_market_quicksell(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_market_release(text) TO authenticated;
    GRANT SELECT ON public.world_listings, public.world_deals TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON public.world_listings, public.world_deals TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
