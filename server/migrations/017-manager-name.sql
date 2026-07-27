-- 017-manager-name.sql — A MANAGER IS CALLED WHAT HE CALLS HIMSELF
--
-- The world stored a manager's name at claim time, and when the account had
-- no display name on it the club got a placeholder - "Orange Club manager".
-- The name a human types when he founds his club is the name the world should
-- use, on the table, on his club page and in every fixture list; and if it is
-- wrong, he should be able to correct it without releasing his club.
--
-- Bots have no manager row at all, so nothing here can touch them.

CREATE OR REPLACE FUNCTION public.world_set_manager(p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; nm text;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  nm := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  IF length(nm) < 2 THEN RAISE EXCEPTION 'a name is two letters or more'; END IF;
  IF length(nm) > 24 THEN RAISE EXCEPTION 'a name is 24 characters at most'; END IF;
  IF nm !~ '^[A-Za-z0-9][A-Za-z0-9 ''\.\-]*$' THEN
    RAISE EXCEPTION 'letters, numbers, spaces, apostrophes, dots and hyphens only';
  END IF;
  UPDATE clubs SET manager = nm WHERE country_id = c.country_id AND slot = c.slot;
  RETURN jsonb_build_object('ok', true, 'manager', nm, 'country', c.country_id, 'slot', c.slot);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_set_manager(text) TO authenticated;
  END IF;
END $$;


-- the status a client reads now carries the name the world uses, so the
-- account page can show it and correct it
CREATE OR REPLACE FUNCTION public.world_my_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; o jsonb;
BEGIN
  u := _uid();
  IF u IS NULL THEN RETURN jsonb_build_object('signedIn', false); END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RETURN jsonb_build_object('signedIn', true, 'claim', null); END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  SELECT jsonb_agg(jsonb_build_object('round', round, 'at', submitted_at) ORDER BY round)
    INTO o FROM orders WHERE user_id = u AND country_id = c.country_id;
  RETURN jsonb_build_object('signedIn', true,
    'claim', jsonb_build_object('country', c.country_id, 'slot', c.slot, 'club', club.name,
                                'name', c.display_name, 'ground', club.ground),
    'manager', club.manager,
    'orders', coalesce(o, '[]'::jsonb),
    'squad', club.squad,
    'training', coalesce(club.training, '{}'::jsonb),
    'identity', club.identity,
    'bank', club.bank);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_my_status() TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
