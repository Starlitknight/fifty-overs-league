-- 089-a-cricketer-is-not-his-name.sql — EVERY MAN GETS AN IDENTITY.
--
-- The name banks are small and every squad in the world is drawn from them
-- independently, so the same name comes up again and again. Measured on the
-- live world: England holds EIGHTEEN names shared by two different counties,
-- Nepal seventy-five, and in the smallest banks one name is held by six clubs
-- at once - twice inside a single squad, where the no-duplicates draw gives up
-- rather than loop for ever.
--
-- So a name has never been an identity, and everything that asked "is this the
-- same cricketer?" by comparing names has been quietly answering for whoever
-- happened to share it. The visible symptom was a red international star on a
-- Gloucestershire batsman who had never been picked: somebody with his name
-- had been, at another county.
--
-- Each man now carries a `pid`, stamped on him the moment he is generated and
-- derived from the seed that made his squad plus his place in it. Every device
-- and this server derive the same squad from the same seed, so both arrive at
-- the same id without anybody storing or sending one; it then rides in the
-- player object for life, through transfers and into the archive.
--
-- The ids live in the squad JSON, which needs no migration. What needs one is
-- the callups book, where the selectors write down who they took. NULL is a
-- legal answer here and means "written before ids existed" - those rows fall
-- back to club-and-name, exactly as they always resolved.

ALTER TABLE callups ADD COLUMN IF NOT EXISTS pid text;

NOTIFY pgrst, 'reload schema';
