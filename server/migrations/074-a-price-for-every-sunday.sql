-- 074 · A PRICE FOR EVERY SUNDAY
--
-- One dial priced every gate at once. The manager wants to price each home
-- Sunday on its own - the flagship's visit dear, a dead rubber cheap - so a
-- price decision now names its match. A row with season 0, round 0 is the
-- club's STANDING price, exactly what 073 stored; a row naming a season and
-- round prices that match alone, and beats the standing price for it from
-- the moment it is set. Sales days already sold stay sold at what they sold
-- at, and the 24-hour lock is untouched - both fall out of the dated walk.
ALTER TABLE ticket_prices ADD COLUMN IF NOT EXISTS season_no int NOT NULL DEFAULT 0;
ALTER TABLE ticket_prices ADD COLUMN IF NOT EXISTS round int NOT NULL DEFAULT 0;
ALTER TABLE ticket_prices DROP CONSTRAINT IF EXISTS ticket_prices_pkey;
ALTER TABLE ticket_prices ADD PRIMARY KEY (country_id, slot, season_no, round, set_ms);

DROP FUNCTION IF EXISTS public.world_set_ticket(int);
CREATE OR REPLACE FUNCTION public.world_set_ticket(p_price int, p_season int DEFAULT 0, p_round int DEFAULT 0)
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
  IF (coalesce(p_season, 0) = 0) <> (coalesce(p_round, 0) = 0) THEN
    RAISE EXCEPTION 'a match price names its season and its round together';
  END IF;
  INSERT INTO ticket_prices(country_id, slot, season_no, round, set_ms, price)
    VALUES (c.country_id, c.slot, coalesce(p_season, 0), coalesce(p_round, 0), now_ms(), p_price)
    ON CONFLICT (country_id, slot, season_no, round, set_ms) DO UPDATE SET price = excluded.price;
  RETURN jsonb_build_object('ok', true, 'price', p_price,
    'season', coalesce(p_season, 0), 'round', coalesce(p_round, 0));
END $$;

CREATE OR REPLACE FUNCTION public.world_ticket_prices(p_country text, p_slot int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = world, public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'at', set_ms, 'price', price, 'season', season_no, 'round', round) ORDER BY set_ms), '[]'::jsonb)
    FROM ticket_prices WHERE country_id = p_country AND slot = p_slot;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_set_ticket(int, int, int) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_ticket_prices(text, int) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_ticket_prices(text, int) TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
