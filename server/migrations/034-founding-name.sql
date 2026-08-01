-- 034 — A CLUB IS CHRISTENED ONCE, AT ITS FOUNDING.
--
-- The name a manager gives a club when they found it is the club's name for
-- as long as they hold it: it goes into the register, into fourteen rounds of
-- fixtures, into the Cup draws and onto the honours board, and a league whose
-- names move under it is a league with no memory. world_claim_club and
-- world_auto_claim still take the founding name; the rename door closes.
--
-- The function itself stays, unreachable from any signed-in manager, so the
-- world's keeper can still strike a name that should never have been taken.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE EXECUTE ON FUNCTION public.world_rename_club(text) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE EXECUTE ON FUNCTION public.world_rename_club(text) FROM anon;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.world_rename_club(text) FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
