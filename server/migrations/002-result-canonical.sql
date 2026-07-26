-- 002 — the byte-exact canonical result string, as the engine emitted it.
-- jsonb normalizes key order, which breaks byte-identity proofs; the law
-- (BLUEPRINT 1/3) demands verbatim reproducibility, so we keep BOTH: jsonb
-- for querying, text for proof. Additive only.
ALTER TABLE matches ADD COLUMN result_canonical text;
