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

-- ...and the claims table learns the pyramid's seat map. It was born when
-- slots 1-9 were the only claimable seats; the founding seats are now 8-15
-- (the claim DOORS enforce that), and a promoted manager's club can sit
-- anywhere from slot 1 up. The table admits any real non-boss seat; policy
-- lives in world_claim_club/world_auto_claim, not in the schema.
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_slot_check;
ALTER TABLE claims ADD CONSTRAINT claims_slot_check CHECK (slot BETWEEN 1 AND 15);

NOTIFY pgrst, 'reload schema';
