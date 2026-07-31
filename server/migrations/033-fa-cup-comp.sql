-- 033-fa-cup-comp.sql — THE FA CUP GETS A SEAT AT THE TABLE.
--
-- cup_matches was born knowing exactly two competitions ('wcl','wc'). The
-- pyramid adds a national knockout per nation, banked as comp 'fa:<nation>'
-- in the same table under the same laws (immutable results, idempotent
-- stages, snapshots derived). The check widens to admit them - still a
-- check, so a typo'd comp never lands.
ALTER TABLE cup_matches DROP CONSTRAINT IF EXISTS cup_matches_comp_check;
ALTER TABLE cup_matches ADD CONSTRAINT cup_matches_comp_check
  CHECK (comp IN ('wcl', 'wc') OR comp LIKE 'fa:%');

NOTIFY pgrst, 'reload schema';
