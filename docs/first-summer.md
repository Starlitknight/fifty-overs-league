# The First Summer — England solo narrative campaign

Playable now: open the game, click **The First Summer** in the nav (or go to
`#/summer`). Solo-first; multiplayer is untouched and unaffected.

## How to play / reset / resume

- **Play**: https://starlitknight.github.io/fifty-overs-league/ → *The First
  Summer* in the top nav. The prologue takes ~2 minutes; Chapter 1 sends you
  to the Lineup Room and then a real, live engine match against Willowmere.
- **Resume**: just come back — the hub always reopens on the exact beat you
  left, with a direct **Continue**. The save lives in the browser
  (`localStorage`, key `fo_summer_<manager-id>`), survives reloads, and is
  versioned for future migration.
- **Reset**: the *Reset campaign* button on the hub. It archives the old
  save under `fo_summer_<id>_archived_*` — nothing is ever silently erased.
  A corrupt save is likewise backed up (`…_backup_*`) before a fresh start.
- **Share**: the game itself is the link above; campaign saves are local to
  the device by design (no server writes, no service-role credentials
  anywhere near the browser).

## Architecture

The pristine engine (`Fifty_Overs_Club_Manager_2026_v11_6.html`, sha256
`e558745e…`) is never edited; CI verifies the hash on every push. The
campaign is **modular source** under `client/src/`, concatenated by
`build.sh` (order = `client/src/manifest.txt`) into one extra `<script>`
IIFE after the league overlay:

| Module | Job |
| --- | --- |
| `core/util.js` | hash/esc/clamp/deep-copy helpers |
| `core/ids.js` | stable ids for players/matches; name→id map in the save |
| `core/events.js` | canonical append-only event log (ClubFounded, CaptainAppointed, LineupConfirmed, PlayerSelected/Dropped, PromiseMade/Fulfilled/Broken, MatchCompleted, RegionEntered, RegionalBossDefeated, …) |
| `core/save.js` | versioned save (v1) + migration chain + backup-not-erase |
| `legacy/adapter.js` | the ONLY module touching engine globals: reads rosters, writes the exact `App.orders` structure the engine's own `suggestOrders()` produces, starts campaign ties on the friendly plumbing, extracts honest facts from finished matches |
| `story/england.js` | prologue + 10 chapters + epilogue variants (content as code; the save stores only chapter/beat/choices) |
| `story/engine.js` | beat state machine, promises ledger, fail-forward losses, write-once epilogue, Thorne's real-history prep |
| `features/lineup.js` | the Lineup Room (`#/lineup`) |
| `features/campaign-ui.js` | the hub (`#/summer`) + nav entry |
| `boot.js` | waits for the engine, starts keepers, exposes `__foSummer` for probes |

The overlay exports a small intentional bridge (`window.__foGame`) — squad
generator, friendly plumbing, art base — so the campaign never reaches into
the overlay's IIFE.

**Hard rules enforced in code**
- Matches are real engine matches (toss, live match centre, scorecard);
  results are never fabricated. Post-match dialogue quotes the actual card.
- Story effects live in the campaign save only — player skills are never
  modified, so solo choices cannot create multiplayer advantages.
  (Solo-opponent generation may adapt to your real history — e.g.
  Bellminster counter your wicket pattern — which changes *their* generated
  squad, never yours.)
- Campaign ties ride the friendly plumbing (`__camp` meta) which the
  overlay's competition-scope guard excludes from league packets: a campaign
  XI can never leak into a multiplayer round (regression-probed).
- The Lineup Room holds a draft; only **Confirm** mutates `App.orders` and
  emits `LineupConfirmed`. Validation is neutral and factual.

## Campaign spine

Prologue (selection table: philosophy, captain from evidence, match ball,
cast intro) → 1 Willowmere (openers; first-fifty/duck/three-for recognition;
reporter headline; Thorne's jab quotes real numbers) → 2 Ironbridge (bowling
plan read back from real figures) → 3 Moorland (conditions dilemma +
dropped-player conversation + first Gaffer–Thorne clue) → 4 A Place in the
Side (promise with a real deadline; broken promises demand replacement or
apology) → 5 Bellminster (they counter your actual wicket pattern — facts,
not recommendations) → 6 The Setback (four responses, none "correct",
philosophy echoed) → 7 The Captain's Side (five options; the story reads the
next real team sheet back at you either way) → 8 The Qualifier (peripheral
player surfaced by evidence: selections count + vs-spin numbers) → 9 Gaffer
and Thorne (two truthful, incompatible versions of 2006) → 10 The Crown
Ground (Thorne's prep computed from your real sheets: most-picked names,
opening pair, dependence, last-two-sheet changes) → Epilogue (victory /
loyalty / narrow / heavy / damaged variants; losses fail forward — the
fixture stands; the first final outcome is recorded permanently).

## Tests

`node --test test/*.test.mjs` — 19 tests: save versioning/migration/backup,
reset-archives, stable identity, neutral validation, draft-vs-confirm
mutation boundary, engine-exact spell shape, captain/keeper/selection
events, campaign-vs-league lineup tagging, honest fact extraction
(ducks/fifties/three-fors/pace-spin), distinct stable result signatures,
prologue completion, win/loss progression + fail-forward, promise
fulfilled/broken/replacement, chapter-7 both-ways callback, crown-loss
permanent epilogue + rematch completion, notes persistence, Thorne-prep
real-history quotes (incl. the required Gaffer line). Playwright E2E probes
(`resolver/_summer.mjs`, `_summerm.mjs`, untracked by convention) cover the
fresh-user desktop and mobile journeys through a real Willowmere match.

## Deployment

Live site continues to publish from committed root files (unchanged — no
downtime risk). `.github/workflows/ci-pages.yml` runs syntax checks, unit
tests, the build, and the pinned-engine hash check on every push, and
uploads a Pages artifact. **Follow-up migration**: switch the repo's Pages
source to "GitHub Actions" and set the repository variable
`PAGES_VIA_ACTIONS=true`; the gated deploy job then serves the tested
artifact from `main` only.

## Known v1 limitations

- Two squad members with identical name+country would share a stable id
  (the engine's name banks make this effectively impossible in one squad).
- The prologue's optional trial points at the existing Match Lab rather
  than a bespoke trial flow.
- Bowling spells: the Lineup Room keeps your existing spell plan when its
  bowlers are all still in the XI, otherwise rebuilds the engine's default;
  fine-grained spell editing stays on the legacy orders page (linked flow).
- Phase-usage data isn't recorded per innings yet, so Thorne's prep covers
  selections/openers/dependence/changes but not death-overs usage.
- Epilogue "damaged relationship" thresholds are simple rapport cutoffs.
