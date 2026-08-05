-- 052-market-hammer.sql — THE HAMMER GETS A MINUTE HAND, AND THE CARD OPENS.
--
-- The market becomes From the Pavilion's, by the owner's decision:
--
--   * every listing carries an EXACT closing moment (closes_ms), not just a
--     world-day. The board can print "hammer in 2h 05m" and mean it.
--   * ANTI-SNIPE: a bid landed inside the final ten minutes pushes the
--     hammer back to ten minutes out. Auctions end in bidding wars, never in
--     a snipe - and because the umpire still settles on his next pass,
--     nobody has to be awake to WIN, only to fight.
--   * THE CARD IS OPEN. A listed man's full skills are public (the board
--     snapshot carries them; server/market.mjs). Scout fees on listings are
--     retired - the fog now lives only where it belongs, in the academy.
--
-- Rows already open carry closes_ms backfilled to their old day boundary, so
-- nothing shuts earlier or later than it was always going to.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS closes_ms bigint;
UPDATE listings
   SET closes_ms = (SELECT epoch_ms FROM worlds WHERE id = 1) + closes_day * 86400000
 WHERE closes_ms IS NULL AND status = 'open';

-- THE LIVE BOARD carries the minute hand too (the 042 view, plus closes_ms) -
-- the anti-snipe moves a hammer between snapshot rebuilds, and the countdown
-- must not lie about it.
DROP VIEW IF EXISTS public.world_listings;
CREATE VIEW public.world_listings AS
  SELECT l.id, l.country_id, l.slot,
         CASE WHEN l.slot < 0 THEN 'Free agent' ELSE cl.name END AS club,
         l.player, l.asking, l.reserve, l.opened_day, l.closes_day, l.closes_ms, l.status,
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
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON public.world_listings TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON public.world_listings TO anon;
  END IF;
END $$;

-- LISTING: same law as 024, plus the minute hand.
CREATE OR REPLACE FUNCTION public.world_market_list(p_player text, p_reserve int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; man jsonb; n_open int; n_squad int; today int; ask int; lid bigint; shut bigint;
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
  SELECT count(*) INTO n_open FROM listings
   WHERE country_id = c.country_id AND slot = c.slot AND status = 'open';
  IF n_open >= 3 THEN RAISE EXCEPTION 'three men on the board at once is the limit'; END IF;
  IF EXISTS (SELECT 1 FROM callups cu
              WHERE cu.country_id = c.country_id AND cu.slot = c.slot AND cu.player = p_player
                AND cu.round >= (SELECT coalesce(max(round), 0) FROM callups WHERE country_id = c.country_id))
    THEN RAISE EXCEPTION 'he is away with his country this week'; END IF;
  today := (world_day())::int;
  shut := (now_ms())::bigint + 3 * 86400000;
  ask := greatest(5000, coalesce((man->>'fee')::int, 40000));
  IF p_reserve IS NULL OR p_reserve < 1000 THEN RAISE EXCEPTION 'name a reserve'; END IF;
  IF p_reserve > ask * 4 THEN RAISE EXCEPTION 'no club on earth will pay that'; END IF;
  INSERT INTO listings(country_id, slot, player, player_json, asking, reserve,
                       opened_day, closes_day, closes_ms, status, by_user)
    VALUES (c.country_id, c.slot, p_player, man, ask, p_reserve, today, today + 3, shut, 'open', u)
    RETURNING id INTO lid;
  RETURN jsonb_build_object('ok', true, 'id', lid, 'asking', ask, 'reserve', p_reserve,
                            'closes', today + 3, 'closesMs', shut);
END $$;

-- BIDDING: same law as 043, plus the fallen hammer and the anti-snipe.
CREATE OR REPLACE FUNCTION public.world_market_bid(p_id bigint, p_amount int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; L record; club record; n_squad int; floor_bid int; cur_high int; shut bigint;
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
  IF cur_high IS NOT NULL THEN floor_bid := greatest(floor_bid, cur_high + 500); END IF;
  IF p_amount IS NULL OR p_amount < floor_bid THEN
    RAISE EXCEPTION 'the board stands at more - offer at least %', floor_bid; END IF;
  IF p_amount > club.bank THEN RAISE EXCEPTION 'your bank will not cover that'; END IF;
  INSERT INTO bids(listing_id, country_id, slot, amount, user_id)
    VALUES (p_id, c.country_id, c.slot, p_amount, u)
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
  RETURN jsonb_build_object('ok', true, 'id', p_id, 'amount', p_amount,
                            'closes', L.closes_day, 'closesMs', shut, 'leading', true);
END $$;

NOTIFY pgrst, 'reload schema';
