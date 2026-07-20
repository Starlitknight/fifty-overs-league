# BUILD PROMPT — Fifty Overs Multiplayer League

You are a senior full-stack engineer. I have uploaded a single-file HTML browser game (`Fifty_Overs_Club_Manager_*.html`) — a deterministic cricket management sim. Your job is to turn it into an invite-only multiplayer league with a shared backend, without rewriting the game engine.

**Read this whole prompt before writing any code. Then follow the PHASE PROTOCOL exactly. Do not skip to building the backend.**

---

## Hard rules (violating any of these fails the task)

1. **Do not claim code works unless you have run it.** Mark anything you have not executed as `UNTESTED`. If you cannot run it, say so and tell me exactly what to run.
2. **Tag confidence** on non-obvious claims: `[Certain]` (verified against the file), `[Likely]` (strong inference), `[Guessing]` (filling a gap). If you're guessing about how the engine works, say so — do not invent function names.
3. **The trust boundary is absolute:** the server owns every outcome-determining fact (squad state, match results, lock timing, standings). The client is a view + an action submitter. The client must never write a match result, its own squad ratings, or decide whether a lineup edit is still allowed.
4. **Determinism is the anti-cheat.** A match result is a pure function of `(homeSquad, awaySquad, homeOrders, awayOrders, {ground, pitch, weather, seed})`. Preserve this. If your changes make the engine non-deterministic, you have broken the project.
5. **Do not modify the game's match engine logic.** You may ADD an entry point and a resolve mode. You may not change how balls, wickets, or scores are computed — that would desync official and friendly results.
6. **Work against the actual uploaded file.** Grep it, quote real line numbers and real function names. Do not assume an idealized structure. This file uses layered patch scripts where later `<script>` blocks redefine earlier functions — find the LIVE definition (last one wins) before touching anything.

---

## Locked design decisions (do not re-litigate these — build to them)

- **Integrity:** server owns squad state; clients submit only validated actions (sign player, set orders, confirm squad).
- **Official match engine:** a server-side headless-browser resolver loads the real game file in a `?resolve=` mode and runs the real engine. Official results NEVER come from a client.
- **Draft:** one-time before the season. Independent play. Squads fixed all season (no transfers). A single master pool is snake-dealt by rating into N near-equal, unique-player buckets after the manager count locks; each manager drafts privately from their bucket. Budget: $1,000,000, tight on purpose (can't buy a full-strength 16-man squad).
- **Auth:** Supabase Auth, but every game action keys off `manager_id` behind ONE swappable identity function `resolveManagerId(request)`. Invite-only: founder generates invite codes; redeeming a code binds it to a Supabase Auth account. Founder role is a `role` column checked server-side.
- **Friendlies:** Player A challenges B with chosen pitch/weather and a kickoff ≥1hr out. B accepts. Both may edit lineups until kickoff − 5min, when the SERVER locks them. Resolver simulates at kickoff. Consequence-free (no fatigue/exp/standings). Result is stored and each player watches it as a deterministic REPLAY (not a live stream).
- **No-shows:** if a manager hasn't set orders by lock, auto-fill their last-used lineup, else the game's auto-generated legal default XI; the match still happens and (for official) still counts. An unaccepted challenge expires at its kickoff time.
- **Season:** double round-robin, one match per team per day at a league-configured time (default 17:00 league-local).
- **One match at a time:** a team cannot be in two matches at once; a friendly cannot overlap an official match. Enforce at challenge-ACCEPTANCE, not at kickoff, via a team-availability window check.
- **Engine version pinning:** compute `BUILD_HASH = sha256(game file)`, embed it as a constant, store it on the league, and make the resolver ABORT if its loaded build's hash ≠ the league's pinned hash. A league is frozen to one engine build for the whole season.

Target stack (use unless you find a blocking reason, then tell me): **Supabase** (Postgres + Auth + Edge Functions) for state/identity/API; **Fly.io or Railway** container running **Playwright** headless Chromium for the resolver; the existing single-file HTML as the client.

---

## PHASE PROTOCOL — follow in order. STOP at each checkpoint and report. Do not proceed past a checkpoint until I reply "continue."

### PHASE 0 — Feasibility probe (do this FIRST, before any backend)
This is the highest-risk part of the entire project. The match engine may be entangled with UI/global state and may not be extractable as a pure function.
- Inspect the uploaded file. Identify the exact functions that run a full match (e.g. the code path behind `simBackground` / `startLeagueMatch`).
- Determine whether you can expose `window.__resolveMatch(homeSquad, awaySquad, homeOrders, awayOrders, conds)` that returns `{result_text, scorecard, worm, log, winner_team}` using the SAME code path, with NO dependence on DOM or mutable `App` globals beyond what's passed in.
- **Deliver:** a written feasibility verdict — `CLEAN` (pure extraction possible), `NEEDS REFACTOR` (list exactly what global/DOM state leaks in and how you'd isolate it), or `BLOCKED` (why). Include a minimal proof: the `?resolve=` entry point + a Node/Playwright script that runs ONE match headless twice with the same seed and shows byte-identical results.
- **CHECKPOINT 0:** Report the verdict and the determinism proof. Do not build the backend until I confirm.

### PHASE 1 — Schema + identity boundary
- Create the Supabase schema: `leagues, members, teams, squads, draft_pools, fixtures, orders, results, challenges`, and a `standings` view derived from `results` (add a `winner_team` column written by the resolver; do not string-parse result text).
- Implement `resolveManagerId(request)` as the single identity seam (Supabase Auth JWT → `members.auth_uid` → `manager_id`).
- Implement invite redeem + founder role gating.
- **Deliver:** migration SQL, the identity function, and a test that a redeemed invite maps to a manager and that a founder-only action rejects a non-founder.
- **CHECKPOINT 1.**

### PHASE 2 — Constrained-action API + draft
- Edge Functions: `create_team, sign_player, drop_player, confirm_squad, submit_orders, issue_challenge, accept_challenge, founder_edit`.
- The two load-bearing validations MUST be server-side and tested: `sign_player` verifies the player is in THAT manager's dealt pool and within remaining budget; `submit_orders` rejects writes when `server_now` is past the lock time.
- Implement `confirm_squad` reusing the game's existing legal-squad rules (≥11, a keeper, ≥5 bowling options, budget) and writing server-owned `squads.roster`.
- Implement the snake-deal that partitions one oversized master pool (≈2.5–3× signings per manager) into N unique near-equal buckets.
- **Deliver:** the functions + tests proving (a) you cannot sign a player outside your pool, (b) you cannot overspend, (c) you cannot submit orders after lock, (d) buckets are unique and within a few rating points of equal.
- **CHECKPOINT 2.**

### PHASE 3 — Friendly loop end-to-end (lowest stakes, full pipeline)
- Wire challenge → accept (with availability-window conflict check) → edit-until-lock → server lock → resolver simulates at kickoff → result stored → client replays deterministically.
- Resolver runs `__resolveMatch` with `friendly=true` (skips all consequences).
- **Deliver:** a working friendly between two test accounts, plus proof the replay a client renders matches the resolver's stored result exactly.
- **CHECKPOINT 3 — this is the alpha gate. I will playtest before you continue.**

### PHASE 4 — Official league
- Generate a double round-robin fixture list with per-fixture seeds and `resolve_at` timestamps at the league match time.
- Stand up the resolver container (Playwright) with a daily cron; enforce the engine-hash abort; apply consequences (age/fatigue/exp) for official matches only; enforce team-locking so no team resolves two matches concurrently.
- Implement auto-fill-and-count for official no-shows (last-used lineup, else legal default).
- Add client-side result verification (recompute from server inputs, flag mismatch).
- **CHECKPOINT 4.**

### PHASE 5 — Founder tools, standings UI, polish, hash-pin enforcement on clients.
- **CHECKPOINT 5.**

---

## Working method
- At the start of each phase, first grep the uploaded file and quote the real functions/lines you will touch. Do not write code against assumed APIs.
- Prefer the smallest change that satisfies the phase. Do not refactor the game's UI.
- When a decision is genuinely ambiguous and blocks you, ask ONE specific question with options. Otherwise proceed on a stated assumption and label it.
- End every phase with: what you built, what you TESTED (and the command to reproduce), what is UNTESTED, and what you're unsure about.
- Do not produce a giant untested code dump. Phase, verify, checkpoint.

Begin with **PHASE 0**. Inspect the uploaded file and report the feasibility verdict with a determinism proof. Do not build anything else yet.
