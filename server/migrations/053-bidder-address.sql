-- 053-bidder-address.sql — THE LEADER'S NAME BECOMES A DOOR.
--
-- The board has named the standing high bidder since 042, but only by name.
-- The owner wants every club name on the market to walk to that club's page,
-- and a door needs an address: the bidder's country and slot join the open
-- view. Same law, two more columns; nothing else moves.

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
           ORDER BY b2.amount DESC, b2.placed_at ASC LIMIT 1) AS high_club,
         (SELECT b3.country_id FROM bids b3 WHERE b3.listing_id = l.id
           ORDER BY b3.amount DESC, b3.placed_at ASC LIMIT 1) AS high_country,
         (SELECT b4.slot FROM bids b4 WHERE b4.listing_id = l.id
           ORDER BY b4.amount DESC, b4.placed_at ASC LIMIT 1) AS high_slot
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

NOTIFY pgrst, 'reload schema';
