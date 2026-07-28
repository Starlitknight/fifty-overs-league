-- 024-market.sql — THE TRANSFER MARKET.
--
-- The owner's brief puts this first: scouting, buying, and selling the men
-- who do not fit is the biggest thing in a manager's day. The world's old law
-- - an absent manager loses nothing mechanical - would have made it
-- impossible, because a market rewards being there. That law now reads:
-- absence hurts over TIME, not in the short term. So this market runs on a
-- WINDOW rather than a race.
--
--   * bids are SEALED. Nobody can see anybody else's offer, so there is
--     nothing whatever to be gained by refreshing the page.
--   * a listing stands THREE WORLD DAYS. A manager who looks in every couple
--     of days is never behind one who looks in hourly.
--   * the umpire opens the envelopes. Highest offer at or above the seller's
--     reserve takes him; the money moves and the man moves with neither club
--     awake. A seller does not have to accept anything: he sets the reserve
--     when he lists, and that is his whole decision.
--
-- Stored here: the DECISIONS. Who was listed, at what reserve, who offered
-- what, who paid for a scout's opinion. The valuations, the bot clubs' own
-- shopping and the settlement are the umpire's, derived and idempotent.

CREATE TABLE IF NOT EXISTS listings (
  id            bigserial PRIMARY KEY,
  country_id    text NOT NULL,
  slot          int  NOT NULL,               -- the selling club
  player        text NOT NULL,
  player_json   jsonb NOT NULL,              -- the man as he stood when he went up
  asking        int  NOT NULL,
  reserve       int  NOT NULL,               -- below this he does not go
  opened_day    int  NOT NULL,
  closes_day    int  NOT NULL,
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'sold', 'unsold', 'withdrawn')),
  buyer_country text,
  buyer_slot    int,
  fee           int,
  settled_day   int,
  by_user       uuid,                        -- NULL: the umpire listed him for a bot club
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS listings_one_open
  ON listings (country_id, slot, player) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS listings_open ON listings (status, closes_day);
CREATE INDEX IF NOT EXISTS listings_seller ON listings (country_id, slot);
CREATE INDEX IF NOT EXISTS listings_buyer ON listings (buyer_country, buyer_slot);

-- ONE OFFER A CLUB. Not one an hour: a sealed bid is a decision, and a
-- manager who wants to raise his replaces it rather than stacking them.
CREATE TABLE IF NOT EXISTS bids (
  listing_id bigint NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  country_id text NOT NULL,
  slot       int  NOT NULL,
  amount     int  NOT NULL,
  user_id    uuid,                           -- NULL: a bot club shopping
  placed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, country_id, slot)
);

-- WHAT A MANAGER HAS PAID TO LOOK AT. The report itself is derived; this is
-- only the receipt, and the books walk it like every other line.
CREATE TABLE IF NOT EXISTS scouted (
  user_id    uuid   NOT NULL,
  listing_id bigint NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  country_id text   NOT NULL,
  slot       int    NOT NULL,                -- the club that paid for it
  paid       int    NOT NULL,
  day        int    NOT NULL,
  PRIMARY KEY (user_id, listing_id)
);
CREATE INDEX IF NOT EXISTS scouted_club ON scouted (country_id, slot);

-- ---------------------------------------------------------------------------
-- PUTTING A MAN UP. A manager lists one of his own, and sets the reserve -
-- the only decision in the whole transaction, and one he makes once. He may
-- not strip his club below a side, and he may not sell a man his country has
-- taken for an international window that week.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_market_list(p_player text, p_reserve int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; man jsonb; n_open int; n_squad int; today int; ask int; lid bigint;
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
  ask := greatest(5000, coalesce((man->>'fee')::int, 40000));
  IF p_reserve IS NULL OR p_reserve < 1000 THEN RAISE EXCEPTION 'name a reserve'; END IF;
  IF p_reserve > ask * 4 THEN RAISE EXCEPTION 'no club on earth will pay that'; END IF;
  INSERT INTO listings(country_id, slot, player, player_json, asking, reserve,
                       opened_day, closes_day, status, by_user)
    VALUES (c.country_id, c.slot, p_player, man, ask, p_reserve, today, today + 3, 'open', u)
    RETURNING id INTO lid;
  RETURN jsonb_build_object('ok', true, 'id', lid, 'asking', ask, 'reserve', p_reserve,
                            'closes', today + 3);
END $$;

-- TAKING HIM BACK OFF, while nobody has offered for him yet. Once a club has
-- bid, the window runs: a market you can pull out of the moment somebody
-- wants your player is not a market.
CREATE OR REPLACE FUNCTION public.world_market_withdraw(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; L record; n int;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT * INTO L FROM listings WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such listing'; END IF;
  IF L.country_id <> c.country_id OR L.slot <> c.slot THEN RAISE EXCEPTION 'he is not yours to withdraw'; END IF;
  IF L.status <> 'open' THEN RAISE EXCEPTION 'that window has shut'; END IF;
  SELECT count(*) INTO n FROM bids WHERE listing_id = p_id;
  IF n > 0 THEN RAISE EXCEPTION 'somebody has offered for him - the window runs its course'; END IF;
  UPDATE listings SET status = 'withdrawn', settled_day = (world_day())::int WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ---------------------------------------------------------------------------
-- THE SEALED BID. One offer a club; naming a new one replaces the old, and
-- nobody - not the seller, not another bidder, not this function - can see
-- what anyone else has offered until the umpire opens them.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_market_bid(p_id bigint, p_amount int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; L record; club record; n_squad int; floor_bid int;
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
  IF p_amount IS NULL OR p_amount < floor_bid THEN
    RAISE EXCEPTION 'an offer under % will not be read', floor_bid; END IF;
  -- THE MONEY MUST BE THERE. A club cannot bid what it has not got, and
  -- nothing is bought into an overdraft: money bites in this world.
  IF p_amount > club.bank THEN RAISE EXCEPTION 'your bank will not cover that'; END IF;
  INSERT INTO bids(listing_id, country_id, slot, amount, user_id)
    VALUES (p_id, c.country_id, c.slot, p_amount, u)
    ON CONFLICT (listing_id, country_id, slot)
    DO UPDATE SET amount = EXCLUDED.amount, placed_at = now(), user_id = EXCLUDED.user_id;
  RETURN jsonb_build_object('ok', true, 'id', p_id, 'amount', p_amount, 'closes', L.closes_day);
END $$;

-- and pulling an offer, while the envelopes are still shut
CREATE OR REPLACE FUNCTION public.world_market_unbid(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; L record;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT * INTO L FROM listings WHERE id = p_id;
  IF NOT FOUND OR L.status <> 'open' THEN RAISE EXCEPTION 'that window has shut'; END IF;
  DELETE FROM bids WHERE listing_id = p_id AND country_id = c.country_id AND slot = c.slot;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ---------------------------------------------------------------------------
-- PAYING A SCOUT. Your own numbers are yours; a rival's man is somebody's
-- opinion until you pay for a better one. The receipt is stored; the report
-- itself is derived by the service, and this hands back the man's card so
-- the room can write it out.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_market_scout(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; L record; club record; fee int; already int;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT * INTO L FROM listings WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such listing'; END IF;
  SELECT count(*) INTO already FROM scouted WHERE user_id = u AND listing_id = p_id;
  IF already > 0 THEN
    RETURN jsonb_build_object('ok', true, 'paid', true, 'player', L.player_json, 'again', true);
  END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  fee := greatest(4000, round(greatest(5000, coalesce((L.player_json->>'fee')::int, 40000)) * 0.012 / 100.0) * 100);
  IF fee > club.bank THEN RAISE EXCEPTION 'you cannot afford the scout'; END IF;
  INSERT INTO scouted(user_id, listing_id, country_id, slot, paid, day)
    VALUES (u, p_id, c.country_id, c.slot, fee, (world_day())::int)
    ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'paid', true, 'fee', fee, 'player', L.player_json);
END $$;

-- what a manager may read back: his own bids, his own sales, his own reports
CREATE OR REPLACE FUNCTION public.world_market_mine()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; out_bids jsonb; out_sales jsonb; out_scout jsonb;
BEGIN
  u := _uid();
  IF u IS NULL THEN RETURN jsonb_build_object('signedIn', false); END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RETURN jsonb_build_object('signedIn', true, 'claim', null); END IF;
  SELECT jsonb_agg(jsonb_build_object('id', b.listing_id, 'amount', b.amount,
                                      'player', l.player, 'closes', l.closes_day, 'status', l.status)
                   ORDER BY l.closes_day)
    INTO out_bids FROM bids b JOIN listings l ON l.id = b.listing_id
   WHERE b.country_id = c.country_id AND b.slot = c.slot AND l.status = 'open';
  SELECT jsonb_agg(jsonb_build_object('id', l.id, 'player', l.player, 'reserve', l.reserve,
                                      'asking', l.asking, 'closes', l.closes_day, 'status', l.status,
                                      'fee', l.fee,
                                      'bids', (SELECT count(*) FROM bids b2 WHERE b2.listing_id = l.id))
                   ORDER BY l.id DESC)
    INTO out_sales FROM listings l
   WHERE l.country_id = c.country_id AND l.slot = c.slot AND l.status IN ('open', 'sold', 'unsold');
  SELECT jsonb_agg(jsonb_build_object('id', s.listing_id, 'paid', s.paid, 'player', l.player_json)
                   ORDER BY s.listing_id)
    INTO out_scout FROM scouted s JOIN listings l ON l.id = s.listing_id
   WHERE s.user_id = u AND l.status = 'open';
  RETURN jsonb_build_object('signedIn', true,
    'claim', jsonb_build_object('country', c.country_id, 'slot', c.slot),
    'bids', coalesce(out_bids, '[]'::jsonb),
    'sales', coalesce(out_sales, '[]'::jsonb),
    'reports', coalesce(out_scout, '[]'::jsonb));
END $$;

-- THE PUBLIC BOARD. Note what is NOT here: player_json, reserve, and every
-- bid amount on earth. The board says who is up, from where, what the club
-- wants, when the window shuts and how many have offered - and not one thing
-- more, because the sealed bid is the whole design.
DROP VIEW IF EXISTS public.world_listings;
CREATE VIEW public.world_listings AS
  SELECT l.id, l.country_id, l.slot, cl.name AS club, l.player,
         l.asking, l.opened_day, l.closes_day, l.status,
         (l.by_user IS NOT NULL) AS managed,
         (SELECT count(*) FROM bids b WHERE b.listing_id = l.id) AS offers
    FROM listings l LEFT JOIN clubs cl ON cl.country_id = l.country_id AND cl.slot = l.slot
   WHERE l.status = 'open';
DROP VIEW IF EXISTS public.world_deals;
CREATE VIEW public.world_deals AS
  SELECT l.id, l.player, l.fee, l.settled_day,
         l.country_id AS from_country, s.name AS from_club,
         l.buyer_country AS to_country, b.name AS to_club
    FROM listings l
    LEFT JOIN clubs s ON s.country_id = l.country_id AND s.slot = l.slot
    LEFT JOIN clubs b ON b.country_id = l.buyer_country AND b.slot = l.buyer_slot
   WHERE l.status = 'sold';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_market_list(text, int) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_market_withdraw(bigint) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_market_bid(bigint, int) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_market_unbid(bigint) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_market_scout(bigint) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_market_mine() TO authenticated;
    GRANT SELECT ON public.world_listings, public.world_deals TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON public.world_listings, public.world_deals TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
