-- 086-the-money-shows-the-moment-it-moves.sql — A DECISION THAT COSTS MONEY IS
-- ON THE BOOKS BEFORE THE HOUR IS UP.
--
-- The books are DERIVED: every settle walks a club's whole record from the
-- founding and rewrites the totals and the statement from scratch. That is why
-- they can never drift, and it is right. But a settle runs on the world's
-- clock, and two of a manager's decisions move his bank the instant he makes
-- them - a scouting trip abroad, and the senior contract that takes a boy out
-- of the academy. Both are written to academy_spend at once and both debit the
-- bank at once; neither reaches the ledger or the totals until the next tick.
--
-- So a manager signed a colt for $250,000, watched his bank fall by it, opened
-- his Finances and found no line for it anywhere - and the page, which checks
-- the bank against the books because a missing line used to be a real bug,
-- told him "the bank and the ledger disagree by -$250,000 - a line has gone
-- missing from the books". Nothing was missing. The books were an hour behind
-- his own decision, and the page accused the umpire of losing his money.
--
-- Both reading functions now add what has been spent and not yet settled. It
-- is arrived at by difference, not by bookkeeping: what academy_spend holds,
-- less what the ledger has already counted. So it cannot double an entry - the
-- moment a settle writes those lines the difference is nought - and it needs no
-- record of its own to fall out of step with.

-- ---------------------------------------------------------------------------
-- THE STATEMENT. The settled lines, and above them anything paid since.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_my_statement(p_limit int DEFAULT 60, p_before int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; me record; club record; n int; lim int; o jsonb; fresh jsonb; run bigint;
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

  -- WHAT HAS BEEN PAID SINCE THE LAST SETTLE, by difference: what the academy
  -- has spent against what the statement has already counted of it. Only on
  -- the newest page - an older page of the statement is history and history
  -- does not gain a line at the top.
  IF p_before IS NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'seq', n + d.rn, 'at', now_ms(), 'kind', d.kind,
             'label', CASE d.kind WHEN 'contract' THEN 'Senior contracts out of the academy'
                                  WHEN 'scouting' THEN 'Scouting trips'
                                  ELSE 'The academy' END,
             'amount', d.owed, 'balance', club.bank) ORDER BY d.kind), '[]'::jsonb)
      INTO fresh
      FROM (SELECT x.kind, x.owed, row_number() OVER (ORDER BY x.kind) AS rn
              FROM (SELECT s.kind,
                           s.paid - coalesce((SELECT sum(l.amount) FROM ledger l
                             WHERE l.country_id = me.country_id AND l.slot = me.slot
                               AND l.kind = s.kind), 0) AS owed
                      FROM (SELECT kind, sum(amount) AS paid FROM academy_spend
                             WHERE country_id = me.country_id AND slot = me.slot
                             GROUP BY kind) s) x
             WHERE x.owed <> 0) d;
    IF jsonb_array_length(fresh) > 0 THEN o := fresh || o; END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'club', club.name, 'bank', club.bank, 'entries', n,
    'lines', o,
    'more', (SELECT count(*) > 0 FROM ledger
              WHERE country_id = me.country_id AND slot = me.slot
                AND seq < coalesce((SELECT min((x->>'seq')::int) FROM jsonb_array_elements(o) x
                                     WHERE (x->>'seq')::int <= n), 0)));
END $$;

-- ---------------------------------------------------------------------------
-- AND THE TOTALS, so the season's net owns the same money the statement does.
-- academySpend is held POSITIVE on the books (it is a cost) while the spend
-- rows are signed, which is why the difference is subtracted rather than added.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_my_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; o jsonb; s record; cu jsonb; fin jsonb; owed bigint;
BEGIN
  u := _uid();
  IF u IS NULL THEN RETURN jsonb_build_object('signedIn', false); END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RETURN jsonb_build_object('signedIn', true, 'claim', null); END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  SELECT jsonb_agg(jsonb_build_object('round', round, 'at', submitted_at) ORDER BY round)
    INTO o FROM orders WHERE user_id = u AND country_id = c.country_id;
  SELECT * INTO s FROM seasons WHERE country_id = c.country_id ORDER BY season_no DESC LIMIT 1;
  SELECT jsonb_agg(jsonb_build_object('round', round, 'player', player, 'fee', fee) ORDER BY round, pick)
    INTO cu FROM callups
   WHERE country_id = c.country_id AND slot = c.slot AND season_no = coalesce(s.season_no, 0);

  fin := coalesce(club.finance, '{}'::jsonb);
  SELECT coalesce((SELECT sum(amount) FROM academy_spend
                    WHERE country_id = c.country_id AND slot = c.slot), 0)
       - coalesce((SELECT sum(amount) FROM ledger
                    WHERE country_id = c.country_id AND slot = c.slot
                      AND kind IN ('contract', 'scouting')), 0)
    INTO owed;
  IF owed <> 0 THEN
    fin := fin || jsonb_build_object('academySpend',
             coalesce((fin->>'academySpend')::bigint, 0) - owed);
  END IF;

  RETURN jsonb_build_object('signedIn', true,
    'claim', jsonb_build_object('country', c.country_id, 'slot', c.slot, 'club', club.name,
                                'name', c.display_name, 'ground', club.ground),
    'manager', c.display_name,
    'orders', coalesce(o, '[]'::jsonb),
    'squad', club.squad,
    'training', coalesce(club.training, '{}'::jsonb),
    'netsReport', club.nets_report,
    'netsHistory', club.nets_history,
    'identity', club.identity,
    'academy', club.academy,
    'academyMax', academy_max(),
    'youth', coalesce(club.youth, '[]'::jsonb),
    'seats', club.seats,
    'finance', fin,
    'callups', coalesce(cu, '[]'::jsonb),
    'windows', to_jsonb(world_window_rounds()),
    'bank', club.bank);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_my_statement(int, int) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_my_status() TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
