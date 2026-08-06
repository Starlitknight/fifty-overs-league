-- 056-no-coach.sql — THE HEAD COACH IS WITHDRAWN.
--
-- 051 hired a coach whose level multiplied every net session, on top of the
-- academy. It was a second building with a different name: another number to
-- buy upward, another wage line, and no decision in it - there was never a
-- reason to own a worse coach than you could afford. From the Pavilion, the
-- model this world follows, has no coach at all. The academy sets the rate,
-- the man's age sets what a session is worth to him, and the only decision
-- on the training ground is which programme each player works.
--
-- WHAT HAPPENS TO A COACH ALREADY HIRED. Two records, treated differently
-- and deliberately so:
--
--   THE MONEY IS GIVEN BACK. coach_paid returns to the bank and the level
--   goes to zero, so no club pays another round's wages for a man who no
--   longer exists, and the books re-derive with no coach anywhere in them.
--
--   THE NETS HISTORY IS NOT TOUCHED. training_rounds.coach is the level in
--   force the week each session was worked, and living.mjs replays those
--   rounds to rebuild a squad. Rewriting it would quietly re-rate every
--   session a coached club ever did - a squad getting weaker overnight with
--   no cricket played to explain it. The record stands; only the product is
--   withdrawn. From this migration on the umpire banks 0, so the coach fades
--   out of the replay by never appearing in it again.
--
-- The hiring door is bolted first, so nobody can buy one between the refund
-- and the next deploy.

DROP FUNCTION IF EXISTS public.world_set_coach(int);

-- refund what was spent, and stand every club down to no coach
UPDATE clubs
   SET bank = coalesce(bank, 0) + coalesce(coach_paid, 0),
       coach_paid = 0,
       coach = 0
 WHERE coalesce(coach, 0) <> 0 OR coalesce(coach_paid, 0) <> 0;

-- ---------------------------------------------------------------------------
-- world_my_status without the coach keys (051's body, three keys lighter).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_my_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; o jsonb; s record; cu jsonb;
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
  RETURN jsonb_build_object('signedIn', true,
    'claim', jsonb_build_object('country', c.country_id, 'slot', c.slot, 'club', club.name,
                                'name', c.display_name, 'ground', club.ground),
    'manager', c.display_name,
    'orders', coalesce(o, '[]'::jsonb),
    'squad', club.squad,
    'training', coalesce(club.training, '{}'::jsonb),
    'netsReport', club.nets_report,
    'identity', club.identity,
    'academy', club.academy,
    'youth', coalesce(club.youth, '[]'::jsonb),
    'seats', club.seats,
    'finance', coalesce(club.finance, '{}'::jsonb),
    'callups', coalesce(cu, '[]'::jsonb),
    'windows', to_jsonb(world_window_rounds()),
    'bank', club.bank);
END $$;

NOTIFY pgrst, 'reload schema';
