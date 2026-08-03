-- 043-market-no-doubles.sql — NO CLUB EMPLOYS TWO MEN OF ONE NAME.
--
-- The world keys a cricketer by his name: squad lookups, the nets, the
-- scorecards, the living layer - all of it. So a club that bought a man
-- whose name it already employs would watch the transfer's arrival SHADOW
-- the man it had, and the dedupe on arrival would quietly discard one of
-- them. Caught by the market tests the day the free-agent trickle went in.
--
-- Two guards, either of which is sufficient, both of which are cheap:
-- the trickle never lists a name the league already employs (server/
-- market.mjs), and this migration makes the bid itself refuse - covering
-- club listings and any name that arrives by a path not yet written.
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
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(club.squad) p WHERE p->>'name' = L.player)
    THEN RAISE EXCEPTION 'a man of that name is already on your staff'; END IF;
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

NOTIFY pgrst, 'reload schema';
