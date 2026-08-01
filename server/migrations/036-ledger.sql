-- 036-ledger.sql — THE STATEMENT. A manager could read what his club had
-- taken and spent in total, but never a line of it: no dates, no entries, no
-- way to answer "where did that go". The books are walked from the founding
-- every settle, so every entry already exists in order - it was simply thrown
-- away once counted. This is where the umpire now writes it down.
--
-- The table is a derived record, not a source of truth: it is deleted and
-- rewritten whole each settle, exactly like the totals beside it, so a
-- re-settled day can neither double an entry nor lose one. seq is the
-- entry's place in the walk, which is also its place in time.
--
-- A statement is private. The reading function serves the caller's OWN club
-- and nothing else - a rival may read your wage bill off your dossier, but
-- not your bank.

CREATE TABLE IF NOT EXISTS ledger (
  country_id text   NOT NULL,
  slot       int    NOT NULL,
  seq        int    NOT NULL,
  at_ms      bigint NOT NULL,
  kind       text   NOT NULL,
  label      text   NOT NULL,
  amount     bigint NOT NULL,          -- positive is money in, negative is money out
  balance    bigint NOT NULL,          -- what the club held after this entry
  PRIMARY KEY (country_id, slot, seq)
);

CREATE OR REPLACE FUNCTION public.world_my_statement(p_limit int DEFAULT 60, p_before int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; me record; club record; n int; lim int; o jsonb;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO me FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT name, bank INTO club FROM clubs WHERE country_id = me.country_id AND slot = me.slot;
  lim := least(greatest(coalesce(p_limit, 60), 1), 200);
  SELECT count(*) INTO n FROM ledger WHERE country_id = me.country_id AND slot = me.slot;
  SELECT coalesce(jsonb_agg(row ORDER BY seq DESC), '[]'::jsonb) INTO o FROM (
    SELECT seq, jsonb_build_object(
      'seq', seq, 'at', at_ms, 'kind', kind, 'label', label,
      'amount', amount, 'balance', balance) AS row
      FROM ledger
     WHERE country_id = me.country_id AND slot = me.slot
       AND (p_before IS NULL OR seq < p_before)
     ORDER BY seq DESC LIMIT lim) q;
  RETURN jsonb_build_object(
    'ok', true, 'club', club.name, 'bank', club.bank, 'entries', n,
    'lines', o,
    'more', (SELECT count(*) > 0 FROM ledger
              WHERE country_id = me.country_id AND slot = me.slot
                AND seq < coalesce((SELECT min((x->>'seq')::int) FROM jsonb_array_elements(o) x), 0)));
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_my_statement(int, int) TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
