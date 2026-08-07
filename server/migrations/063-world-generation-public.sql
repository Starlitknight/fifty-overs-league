-- 063-world-generation-public.sql — THE WORLD SAYS WHICH HAND IT IS PLAYING.
--
-- A club's squad is derivable on any device from the seed the umpire dealt it
-- with; that is how a replay fields the same eleven the server did, and how a
-- manager looking at Pakistan's fifteen can be told who those men are without
-- fetching nineteen leagues. The seed is
--
--     genSquad('world' + generation + '|' + country + '|' + slot, ...)
--
-- and 029 added the generation so that a redeal could deal somebody new.
--
-- It added it to a table nobody outside the service can read. The browser went
-- on deriving from the string 'world1' - correct on the day 029 shipped, and
-- wrong from the first reseed onward. Since then every client-side derivation
-- of a foreign club has produced fifteen cricketers who do not exist: the
-- international squad list could not open a single one of its men, because the
-- name it was asked to find was not in the squad it derived.
--
-- So the generation is published. It is one small integer and it is not a
-- secret - it is part of the address of every cricketer in the world.
CREATE OR REPLACE VIEW public.world_world AS
  SELECT id, generation FROM worlds;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON public.world_world TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON public.world_world TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
