-- 067 · AUTO BID IS THE UMPIRE'S SUM
--
-- The Auto bid button promised "the next lawful raise" but computed it on
-- the phone, from the board as of the last repaint. Between paint and press
-- a rival's raise could land, and the button then carried yesterday's
-- minimum: the umpire refused it, and the one button whose whole promise
-- was "never think about the number" made the manager think about the
-- number.
--
-- The sum moves inside the transaction. p_amount NULL now means AUTO: the
-- umpire computes the smallest bid the three-percent law (054) permits at
-- the moment the bid lands - the 55% floor on a clean board, the standing
-- high plus max($500, 3%) otherwise - and places exactly that. A manager
-- who already leads is told so rather than being made to raise against
-- himself. Every other clause - the bank, the full staff, the fallen
-- hammer, the going-going-gone rule - is 054's law, unchanged.
CREATE OR REPLACE FUNCTION public.world_market_bid(p_id bigint, p_amount int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; L record; club record; n_squad int; floor_bid int; cur_high int;
        high_mine boolean := false; amt int; shut bigint;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT * INTO L FROM listings WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such listing'; END IF;
  IF L.status <> 'open' THEN RAISE EXCEPTION 'that window has shut'; END IF;
  IF L.closes_ms IS NOT NULL AND (now_ms())::bigint >= L.closes_ms THEN
    RAISE EXCEPTION 'the hammer has fallen - the umpire is opening the envelopes';
  END IF;
  IF L.country_id = c.country_id AND L.slot = c.slot THEN RAISE EXCEPTION 'he already plays for you'; END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  SELECT jsonb_array_length(club.squad) INTO n_squad;
  IF n_squad >= 18 THEN RAISE EXCEPTION 'eighteen men is a full staff - sell before you buy'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(club.squad) p WHERE p->>'name' = L.player)
    THEN RAISE EXCEPTION 'a man of that name is already on your staff'; END IF;
  floor_bid := ceil(L.asking * 0.55);
  SELECT max(amount) INTO cur_high FROM bids WHERE listing_id = p_id;
  IF cur_high IS NOT NULL THEN
    floor_bid := greatest(floor_bid, cur_high + greatest(500, ceil(cur_high * 0.03)::int));
    SELECT EXISTS (SELECT 1 FROM bids WHERE listing_id = p_id AND amount = cur_high
                     AND country_id = c.country_id AND slot = c.slot) INTO high_mine;
  END IF;
  IF p_amount IS NULL THEN
    -- AUTO: the umpire's own minimum, at the moment the bid lands
    IF high_mine THEN RAISE EXCEPTION 'you already lead the bidding'; END IF;
    amt := floor_bid;
  ELSE
    IF p_amount < floor_bid THEN
      RAISE EXCEPTION 'the board stands at more - offer at least %', floor_bid; END IF;
    amt := p_amount;
  END IF;
  IF amt > club.bank THEN RAISE EXCEPTION 'your bank will not cover that'; END IF;
  INSERT INTO bids(listing_id, country_id, slot, amount, user_id)
    VALUES (p_id, c.country_id, c.slot, amt, u)
    ON CONFLICT (listing_id, country_id, slot)
    DO UPDATE SET amount = EXCLUDED.amount, placed_at = now(), user_id = EXCLUDED.user_id
    WHERE bids.amount < EXCLUDED.amount;
  -- THE GOING-GOING-GONE RULE: a blow landed in the final ten minutes moves
  -- the hammer back to ten minutes out, so the answer always has time to come
  shut := L.closes_ms;
  IF shut IS NOT NULL AND shut - (now_ms())::bigint < 600000 THEN
    shut := (now_ms())::bigint + 600000;
    UPDATE listings SET closes_ms = shut WHERE id = p_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', p_id, 'amount', amt,
                            'closes', L.closes_day, 'closesMs', shut, 'leading', true);
END $$;
