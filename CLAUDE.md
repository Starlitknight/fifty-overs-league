# Fifty Overs

A narrative cricket-management game. A browser client and a server that plays
the world forward whether or not anybody is watching.

This file is the things that are **surprising or expensive to rediscover**.
Everything else is explained where it lives — the file headers in this repo are
long on purpose and are the real documentation. Read the head of `living.mjs`,
of a migration, or of a test before changing it.

## The build is not the source

- `engine/shell.html` is the SOURCE. `engine/src/**/*.js` are **fragments** —
  they are concatenated into it. `node --check` fails on them by design; that
  is not a bug to fix.
- `./build.sh` writes `index.html`, `client/game.html`,
  `assets/fo-<buildid>.js`, `version.json`, `sw.js`.
- **The asset ritual.** Keep only the asset `index.html` actually names. After
  a build: `git rm --cached` the old one, delete it, `git add` the new one.
  Two assets in the tree means one is dead weight in every clone forever.
- The server runs the SAME engine through `server/enginehost.mjs`, which loads
  the BUILT `index.html` in a VM. So **an engine source change does nothing
  server-side until you rebuild.**

## Running the tests

```bash
node --test 'test/*.test.mjs'                  # engine — needs a fresh ./build.sh
cd server && node --test --test-concurrency=1 'tests/*.test.mjs'
node tools/calibration-check.mjs               # the engine's frozen contract
```

- **Server tests must run with `--test-concurrency=1`**, and never two suites
  at once: each file creates its own database by a fixed name and they collide.
- They need Postgres up. If it is not: `pg_ctlcluster 16 main start`.
- `calibration-check` is the gate on engine behaviour. Run it after any change
  to `engine/src/00-core.js` or the tuning constants.

## Measure before you call something a regression

The engine tests are **statistical**, and several assert on proxies rather
than on the thing they name. This has produced at least one confident, wrong
diagnosis (see `5fef572`): a batting order was declared broken because the
TEAM TOTAL did not move, when the instructed batsman had in fact gone from
97 off 110 to 46 off 43 and the rest of the innings made the runs back.

So, before concluding the engine has changed behaviour:

- **Check the sample size.** A 260-match test cannot resolve a 52% effect;
  the standard error is over three points. Re-run at N=1000 before believing a
  number.
- **Compare the quantity the claim is about.** Not a total that happens to
  correlate with it.
- **Bisect against the engine, not against reasoning.** Tuning constants live
  in `GD.cal` and can be zeroed at runtime inside the test VM, which turns any
  single term on and off without a rebuild. That is how a term is proven
  responsible.

## Things that never change

- **`server/migrations/*.sql` are immutable once applied.** Never edit one.
  Add a new numbered file — including to redefine a view.
- The living fold is a **derivation, not a ledger**. `career`, `mile` and
  `intl` are recomputed from the whole match record on every settle and are
  never read back; they live in `player_history`. `living_checkpoint` is
  likewise disposable — deleting a row costs one slow settle and nothing else,
  and that is the intended repair for anything that looks wrong with it.
- The authority is the scorecards plus `squad[].carry` (what a transfer
  freezes onto a man). Everything else about a cricketer's past is derived.
- `reseed-squads.mjs` refuses to run if the schema grows a table it has not
  been taught about. When you add a table, classify it there as play or world.

## Deploying

```bash
git push -u origin <feature-branch>
git push origin <feature-branch>:main        # main IS the deploy
```

`.github/workflows/world-tick.yml` runs three times an hour: migrate, then the
idempotent backfills, then settle every nation. A migration reaches production
on the next tick; there is no separate release step.

## House style

- Comments explain **why**, at length, and name the failure that motivated the
  code. Match the surrounding density — this repo is deliberately heavy on
  prose and light on cleverness.
- Commit messages are written the same way: what was wrong, how it was
  measured, what it now does.
- Never put a model identifier in a commit message, a PR, a comment, or
  anything else that gets pushed.
