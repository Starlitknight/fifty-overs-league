# Roster Continuity Safety — every active club can field a side

**Branch** `claude/roster-continuity-safety`, from `main` at `d7e935f`.
**Not merged, not deployed.**

The invariant: **an active club must always be able to field a legal XI.** Until
this repair, one could not — and the world could settle a club into a state the
match engine cannot play.

---

## 1. What exact lifecycle creates a sub-11 club?

One asymmetry, four steps:

1. **`market.mjs` guards `SQUAD_FLOOR = 13` in two places, and both are about a
   club *choosing* to lose a man** — a bot will not list itself below it
   (`:210`), and a sale will not complete if the seller would drop under it
   (`:644`).
2. **Retirement is not a transaction.** `youth.ageYouth` filters out everyone who
   reaches `RETIRE_AT = 38`, writes the shorter squad back, and had **no
   replacement path at all**. It passes neither guard because neither guard is
   looking.
3. **The one mechanism that could refill is switched off for exactly the clubs
   this happens to.** `botBid` returns `0` when posture is `dangerous` or
   `critical` — and that check fires *before* squad shortage is ever consulted.
   A club in trouble buys nobody, including the eleventh man it needs.
4. **So the squad shrinks monotonically**, and the world settles a club that
   cannot take the field.

Reproduced on the real path (`tools/roster-failure-proof.mjs`, run against
main's own `ageYouth`):

```
club eng/15, 12 men, 3 at retirement age, bank -$2,400,000
posture critical (buys: none) → botBid on a cheap man = 0
after ageYouth → 9 men
a season of 14 fixtures → 9 CRASHED, 5 played
```

## 2–3. Why 11, and what happens below it

**11 is the simulator's own number**, measured (`tools/roster-legality.mjs`),
192 trials at each size:

| squad | crashes | rate |
|---|---|---|
| 15 · 14 · 13 · 12 · **11** | 0 each | **0.0%** |
| 10 | 126 | **65.6%** |
| 9 | 151 | 78.6% |
| 8 | 165 | 85.9% |

**Below eleven a squad enters a probabilistically invalid simulation state** —
it does not fail every time, it fails most times. Eleven and above never failed.

**Role does not enter into it.** At eleven men: no keeper → plays; no specialist
bowler → plays; eleven batters → plays. The invariant is a **count**, not a
composition, so nothing here touches roles, selection or XI legality.

## 4. Where the repair is inserted

`server/youth.mjs`:

- **`ROSTER_MIN = 11`** — a new constant, documented against `SQUAD_FLOOR`.
- **`ensurePlayableSquad(host, country, squad, seed)`** — one pure helper: hand
  it a squad, get back one that can take the field plus the men that had to be
  found.
- Called inside **`ageYouth`**, after the ageing and **before the write**, so the
  world never holds a settled club that cannot play.

It sits after `host.ageDecline` rather than beside the retirement filter for one
reason: the men who walk in are **new**, and ageing a cricketer who has not had a
season yet would be wrong. The shortfall is still created at step 1 and repaired
before anything reads the squad.

## 5. Why it stops at 11 and not 13

Because they are different concepts and must stay different:

| | |
|---|---|
| `SQUAD_FLOOR = 13` | **transaction** safety — what a club refuses to *choose* |
| `ROSTER_MIN = 11` | **simulation** safety — what the world needs after an *involuntary* retirement |

Restoring to thirteen would hand a financially distressed club **two free bench
players it never earned**. That is a subsidy wearing a safety fix's clothes. A
test asserts both constants and that `ROSTER_MIN < SQUAD_FLOOR`.

## 6–8. What is generated, how strong, what it costs

`makeRecruit(..., 'poor', ...)` — the academy's own worst construct, nothing
invented — with the `colt` flag and hidden growth seed stripped, because he is a
senior. Measured over **1,200 draws**:

| | OVR median | OVR max | wage | value | age | exp |
|---|---|---|---|---|---|---|
| **emergency man** | **4** | **13** | $400 | $20,500 | 18 | 7 |
| free agent | 50 | 97 | $9,290 | $422,250 | 25.5 | 61 |

In the ten-season run the men actually generated were **median OVR 3, best ever
drawn 6**.

**Economic consequence, exactly:** he is a real player on the canonical wage law
and the club pays him. No cash grant, no waived wage, no debt forgiven. Across
1,280 club-seasons the entire world spent **$11,600 a round** on emergency men —
**$162,400 over a whole season, across all 128 clubs** — averaging **$1,055 a
round** for an affected club. Transfer value introduced: $594,500, all of it at
the `valueOf` floor.

## 9. Can it be exploited?

**No, and the sharpest form of the question makes it clearest.** The right
comparison is not against the *median* free agent — a manager needing a body
would never buy the median. It is against the **cheapest decile of the board**:

| | OVR median | wage | value | exp |
|---|---|---|---|---|
| cheapest normal replacement | **17** | $400 | $20,500 | 61 |
| emergency man | **4** | $400 | $20,500 | 7 |

**P(emergency beats even the cheapest normal man) = 4.5%.**

He is **not cheaper** — both sit on the $400 wage floor and the $20,500 value
floor. The emergency path is economically *identical* to signing the worst man
available and sportingly far worse. There is no version of "let the squad shrink
and take the free men" that pays.

## 10. How often it triggers — and the deeper cause

Ten seasons, 8 nations, real cricket, real finances, real promotion/relegation:

| | |
|---|---|
| club-seasons | 1,280 |
| emergency recruits | 29 |
| **club-seasons using the repair** | **12 — 0.94%** |
| clubs receiving ≥1 | 11 of 128 |
| clubs receiving in >1 season | 4 |
| per affected club-season | median 1, **P90 9, max 9** |

**Classification: rare. Accept as a safety valve.** Under one percent of
club-seasons, and 117 of 128 clubs never needed it.

**But the P90 is the diagnostic, and it should not be tuned away.** The smallest
squad reached before repair was **two men**. A club needing nine men at once has
gone years unable to replace anybody — that is the *retirement-replacement
economics for distressed clubs*, not a roster bug. `botBid`'s `buys: 'none'` is
correct as an economic rule and is deliberately untouched here; the consequence
is that a club in long-term distress has no replacement path at all. **Recorded
as the next question, not compensated for by generating more players.**

## 11–12. Does any club remain below 11? Does any match fail?

Both arms of the same run, identical seeds:

| | old (main's law) | new (repaired) |
|---|---|---|
| **clubs left under 11** | **7 of 128** | **0** |
| **fixtures forfeited for a short side** | **54** | **0** |
| emergency recruits | 0 | 29 |

Both hard requirements met. The 54 forfeits are the *harness* being merciful — it
forfeits a short side rather than dying. **Production has no forfeit**, so those
54 fixtures are the crash path.

## 13. Does it alter competitive mobility?

**No.** Promotions per seat are **identical in all sixteen seats** across the two
arms — 0/8, 3/8, 1/8, 1/8, 7/8, 5/8, 7/8, 5/8, 8/8, 8/8, 6/8, 6/8, 0/8, 1/8,
0/8, 0/8. The bottom four seats remain **31 of 32 never promoted** in *both*
arms: **the repair does not touch the tier cliff**, which is what §8 requires.

Whole-pyramid: clubs ever promoted 58 → 58, relegated 58 → 56, never changed
division 68 → 70. The small movements come from two clubs whose tables were
decided by forfeits in the old arm — the repaired tables are *more* honest, not
differently biased.

> **One number needs care rather than a headline.** Mean best-XI at season ten
> falls at a few seats (flagship 62.7 → 58.9, seat 4 56.6 → 54.2). That is **not
> the repair weakening clubs**. In the old arm those clubs had *fewer than eleven
> men*, so "best XI" was a mean over two or three survivors; in the new arm it is
> a mean over eleven, nine of whom are OVR 3. Comparing a mean over 2 men with a
> mean over 11 is comparing two different quantities.

## 14. Economic impact

Total $11,600 a round world-wide; $1,055 a round per affected club; $594,500 of
transfer value, all at the floor. Against a Division Two payroll of ~$100,670 a
round, an emergency man is **0.4% of one club's bill**. No hidden subsidy.

## 15. Are the market guards unchanged?

**Exactly unchanged, and asserted.** `SQUAD_FLOOR === 13`;
`POSTURE_POLICY.dangerous.buys === 'none'`; `POSTURE_POLICY.critical.buys ===
'none'`; a distressed club still bids **0** and a healthy one still bids. The
repair creates no listings and touches no transfer logic.

## 16. Gates

| | |
|---|---|
| server suite | see `gates.txt` |
| engine suite | see `gates.txt` |
| `calibration-check` | see `gates.txt` |
| roster legality | 6/6 in `a-club-can-always-field-a-side.test.mjs` |
| long-run pyramid | both arms, above |

Changed files: `server/youth.mjs`, one new test, tools and docs. The engine, the
market, the economy and the tier bands are untouched.

## 17. Ready to ship?

**Yes**, subject to your review of one judgement: the repair guarantees a
*playable* side, not a *competitive* one. A club that fell to two men comes back
with nine OVR-3 cricketers and will be beaten heavily — which is the honest
outcome for a club that lost its entire roster, and strictly better than a
fixture that cannot be played.

---

## Corrections made during this phase

Recorded because two of them reached the frozen findings.

1. **"Ten players always crashes" was one draw, not a law.** Over 192 trials it
   is 65.6%. The first failure-proof ran a single fixture, drew the surviving
   third at nine men, and printed "NOT REPRODUCED". It runs a season of fourteen
   now, and the language everywhere is "probabilistically invalid".
2. **A tie is not a crash.** Both tools scored a case as passing only if the
   result carried a winner, so a tied match (`winner: null`) counted as a
   failure — which is how a twelve-man side once appeared to crash. Only a throw
   is a crash now, in the tools and in the test's `canPlay`.
3. **The regression was flaky and is not any more.** It used to assert that a
   short side throws, which would have passed by luck a third of the time. It
   asserts the invalid squad state instead — that *is* the defect.
4. **A role test with a confound.** The first bowler-less case filtered one squad
   and left *eight* men, so it tested a short side and wrongly concluded that
   missing bowlers fail. Held at eleven, every role case plays.

## Evidence

| file | what |
|---|---|
| `failure-on-main.txt` | the defect on the real lifecycle, against main's `ageYouth` |
| `legality.txt` | what the engine requires: size, and roles not mattering |
| `emergency-primitive.txt` | 1,200 draws per pool, and the cheapest-replacement comparison |
| `longrun-new.txt` / `longrun-old.txt` | ten seasons, both arms, identical seeds |
| `gates.txt` | the full battery |

Tools: `roster-legality.mjs`, `roster-emergency-audit.mjs`,
`roster-failure-proof.mjs`, `roster-longrun.mjs`.
