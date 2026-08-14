# The server — the umpire

Plays the world forward on a schedule. Nothing here waits for a player to be
online; a manager's absence costs him over time, never in the moment.

## Tests

```bash
node --test --test-concurrency=1 'tests/*.test.mjs'
```

**`--test-concurrency=1` is not optional, and never run two suites at once.**
Each file drops and creates a database by a hard-coded name. Run them in
parallel and they delete each other's world mid-test, which surfaces as dozens
of unrelated failures that look like a real regression.

Needs Postgres: `pg_ctlcluster 16 main start` if `pg_isready` says no.

The full suite takes ~15 minutes. Run the files you touched first; run the
whole thing before committing.

## The living fold

`living.mjs` `evolveCountry()` is the heart of this directory, and the one
place where being careless is expensive, because it decides every cricketer's
career, form, legs, talents and nets from the record.

- It is a **pure function of the record**. Settling twice must land on the same
  world. That property is what makes it safe to run three times an hour, and
  several tests exist only to hold it.
- It **continues from a checkpoint** (`living_checkpoint`) rather than
  replaying from genesis. `evolveCountry(..., { fromGenesis: true })` forces
  the full replay, and that is the **oracle**: continuation must equal genesis.
  `tests/a-country-remembers-where-it-got-to.test.mjs` is that comparison, cut
  at every round there is. If you change the fold, run it first.
- The mark is written **last**, after the world it describes, so a crash leaves
  it behind the record and never ahead. Behind is a harmless re-read; ahead
  would be history nobody folds.
- It needs the engine passed in. **A fold without a host is a different fold** —
  no talent thresholds and no nets — so always pass `host`.

## Watch for

- **Shared query parameters.** `args` in `evolveCountry` grows as the
  checkpoint adds bounds. A query that takes only `$1` must be passed
  `[country]`, not `args`. Getting this wrong throws, and several of these
  queries sit inside a `try/catch` meant for old databases, so it fails
  **silently** — this cost every cricketer his cup talent progress once.
- **jsonb does not preserve key order.** Comparing stored documents needs a
  canonical (sorted-key) compare, or you will rewrite rows that never changed.
  There is a `canon()` for exactly this.
- **N+1 across clubs.** A country is sixteen clubs; anything per-club inside
  the loop runs sixteen times a settle, three times an hour, per country. Batch
  it outside the loop.
- **Migrations are immutable.** New numbered file, always.
