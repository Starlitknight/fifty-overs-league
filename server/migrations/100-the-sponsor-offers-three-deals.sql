-- 100-the-sponsor-offers-three-deals.sql — THE SPONSOR PUTS THREE SHAPES ON
-- THE TABLE, AND THE CLUB SIGNS ONE.
--
-- Era 2 of the economy (server/financeconfig.mjs) restructures sponsorship
-- from a figure the umpire computed into a CONTRACT the club chooses the
-- shape of, once a close season:
--
--   SAFE       ~90% guaranteed, ~10% on results  - low variance
--   BALANCED   ~70% guaranteed, ~30% on results  - the default, and what
--                                                  every bot signs
--   CONTENDER  ~45% guaranteed, ~55% on results  - priced for a side that
--                                                  expects to win: per-win
--                                                  money at a contender's
--                                                  par, playoff and title
--                                                  bonuses
--
-- The VALUE of the deal is still the umpire's (division and last summer's
-- finish); only the SHAPE is the manager's. The pick is a dated decision
-- stored here; the books remain a pure derivation - the walk reads the pick
-- for each season and re-derives every cheque from the match record, so a
-- re-settle pays the same money and can never pay twice.
--
-- WHICH SEASON A PICK BINDS. A deal is signed before a summer's cricket
-- starts: if the club's country has not yet played a match of its latest
-- season, the pick binds that season; once the season has cricket in the
-- record, the pick binds the NEXT one. A club may change its mind freely
-- until the season it binds has begun - the row is simply overwritten.

CREATE TABLE IF NOT EXISTS sponsor_picks (
  country_id text NOT NULL REFERENCES countries(id),
  slot       int  NOT NULL,
  season_no  int  NOT NULL,
  package    text NOT NULL CHECK (package IN ('safe', 'balanced', 'contender')),
  decided_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country_id, slot, season_no)
);

CREATE OR REPLACE FUNCTION public.world_set_sponsor(p_package text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; s record; target int;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  IF p_package IS NULL OR p_package NOT IN ('safe', 'balanced', 'contender') THEN
    RAISE EXCEPTION 'the offers on the table are safe, balanced and contender';
  END IF;
  SELECT season_no, start_day INTO s FROM seasons
   WHERE country_id = c.country_id ORDER BY season_no DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no season exists to sign for'; END IF;
  -- a summer with cricket in the record has a signed deal already; the pick
  -- binds the next one
  IF EXISTS (SELECT 1 FROM matches WHERE country_id = c.country_id AND season_no = s.season_no)
    THEN target := s.season_no + 1;
    ELSE target := s.season_no;
  END IF;
  INSERT INTO sponsor_picks(country_id, slot, season_no, package)
    VALUES (c.country_id, c.slot, target, p_package)
    ON CONFLICT (country_id, slot, season_no)
    DO UPDATE SET package = EXCLUDED.package, decided_at = now();
  RETURN jsonb_build_object('ok', true, 'package', p_package, 'season', target);
END $$;

-- ---------------------------------------------------------------------------
-- world_my_status carries the pending pick, so the page can say what is
-- signed and what is chosen for next summer without a second request. The
-- body is 086's, plus 'sponsorPick'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_my_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; o jsonb; s record; cu jsonb; fin jsonb; owed bigint; spick jsonb;
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

  SELECT jsonb_build_object('season', season_no, 'package', package) INTO spick
    FROM sponsor_picks
   WHERE country_id = c.country_id AND slot = c.slot
   ORDER BY season_no DESC LIMIT 1;

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
    'sponsorPick', spick,
    'bank', club.bank);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_set_sponsor(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_my_status() TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
