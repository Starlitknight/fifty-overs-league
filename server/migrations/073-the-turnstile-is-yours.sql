-- 073 · THE TURNSTILE IS YOURS
--
-- The league set one price for every gate in the world: $26, a constant in
-- the economy. It becomes the home club's own decision. A price is a DATED
-- decision - the books walk every gate from the founding, so the walk must
-- know what a seat cost on the day each crowd bought it, or the statement
-- stops reproducing. Nothing else is stored: how many tickets a future
-- match has sold is DERIVED (six daily tranches of the would-be crowd,
-- priced at the price in force on each sale day, ending 24 hours before
-- the first ball) - so the board of advance sales needs no table, cannot
-- drift from the banked gate, and locks itself a day out because no sale
-- day remains for a late price to touch.
CREATE TABLE IF NOT EXISTS ticket_prices (
  country_id text   NOT NULL,
  slot       int    NOT NULL,
  set_ms     bigint NOT NULL,
  price      int    NOT NULL CHECK (price BETWEEN 10 AND 100),
  PRIMARY KEY (country_id, slot, set_ms)
);

CREATE OR REPLACE FUNCTION public.world_set_ticket(p_price int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  IF p_price IS NULL OR p_price < 10 OR p_price > 100 THEN
    RAISE EXCEPTION 'a ticket sells between $10 and $100';
  END IF;
  INSERT INTO ticket_prices(country_id, slot, set_ms, price)
    VALUES (c.country_id, c.slot, now_ms(), p_price)
    ON CONFLICT (country_id, slot, set_ms) DO UPDATE SET price = excluded.price;
  RETURN jsonb_build_object('ok', true, 'price', p_price);
END $$;

-- the price history is public - a gate is a public thing, and the client
-- derives the advance-sales board from these rows and the world's clock
CREATE OR REPLACE FUNCTION public.world_ticket_prices(p_country text, p_slot int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = world, public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('at', set_ms, 'price', price) ORDER BY set_ms), '[]'::jsonb)
    FROM ticket_prices WHERE country_id = p_country AND slot = p_slot;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_set_ticket(int) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_ticket_prices(text, int) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_ticket_prices(text, int) TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
