# DESIGN.md — Fifty Overs design system (Phase 2)

The system's job, given the audit: **keep the watercolor identity, collapse the entropy.**
1,462 colors → 24 tokens · 51 font sizes → 9 steps · 76 spacing values → 10 steps · 28 radii → 4 · 12 breakpoints → 2.
Every ratio quoted below was computed, not assumed.

**The law of the system:** if a value isn't in this file, it doesn't ship. A new need = add the token here first, in Phase 3 review, then use it. `!important` is a defect being paid down, never a technique.

---

## 1 · Type

**Two faces.** *(Phase 3 correction: the audit's "no fonts load" was wrong — a runtime loader in `00-boot-auth.js` serves self-hosted woff2 for all three families. What stands is the max-two rule: Oswald retires in favor of Inter label styles, and the italic Fraunces faces — on disk but never declared — get their `@font-face`.)*

**Chosen pairing — "the illustrated county annual":**
- **Display: Fraunces** (weights 500, 600 + italic). Headlines, club and player names in heroes, narrative surfaces, the treasurer's asides. It harmonizes with the painterly art the way the current Georgia fallback already hints at, and it is the face the Gazette/almanack identity depends on.
- **Workhorse: Inter** (variable, 400–800). All data, UI, labels, and **numerals everywhere** (`font-variant-numeric: tabular-nums` on any column of figures). The current 869 Oswald declarations become Inter styled as labels (below) — condensed-face energy comes from weight + tracking + uppercase, not a third family.

*Alternative considered:* Oswald + Inter (broadcast-led — punchier score bug, but the newspaper/lore surfaces lose their serif soul and the watercolor reads sportier than it is). Recommendation stands with Fraunces; say the word if you want the sportier cut.

**The scale — 9 steps, no half-pixels, nothing else:**

| Token | Size / line | Face & case | Use |
|---|---|---|---|
| `t-label` | 11 / 1.2 | Inter 700, uppercase, +0.08em | Eyebrows, column heads, section labels — **replaces every 10px Oswald** |
| `t-data` | 13 / 1.45 | Inter 400–600, tabular | Table cells, stat rows |
| `t-body` | 14 / 1.5 | Inter 400 | Default UI prose |
| `t-emph` | 16 / 1.45 | Inter 600 / Fraunces 500 | Row leads, KPI values |
| `t-h3` | 20 / 1.3 | Inter 700 or Fraunces 600 | Card titles |
| `t-h2` | 26 / 1.25 | Fraunces 600 | Section heads |
| `t-h1` | 36 / 1.15 | Fraunces 600 | Page titles |
| `t-display` | clamp(44, 7vw, 76) / 1.02 | Fraunces 600 (narrative) · Inter 800 (scoreboard) | Heroes, the bank, the score |
| `t-prose` | 15 / 1.6 | Fraunces 500 or Inter 400 | Gazette & lore reading text (65ch measure) |

Floor: nothing under 11px, ever. Labels that "need" 10px get shorter copy instead.

---

## 2 · Space, radius, elevation, breakpoints

**Spacing — 4px base, ten steps, nothing outside them:**
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`
(2px exists only as a border width, never as a gap or padding.)

**Radii — four:** `r-chip 6` (chips, small controls) · `r-card 12` (cards, panels, buttons) · `r-hero 18` (heroes, full-bleed art frames) · `r-pill 999`.

**Elevation — three:** flat (border only) · `e-card: 0 1px 3px rgba(14,35,63,.06)` · `e-float: 0 18px 44px rgba(10,26,52,.25)` (dark heroes, score bug). No other shadows.

**Breakpoints — two:** `≤760px` phone (the majority breakpoint already), `≥1100px` wide (multi-column). Everything between flexes fluidly. The other ten breakpoints get migrated onto these.

---

## 3 · Color tokens

Semantic names over the *existing* top-of-census palette — the eight coherent colors stay exactly what they are; the 1,400-value tail resolves onto them. Two grounds (paper rooms and broadcast rooms), each with a complete set. Measured contrast in brackets.

### Neutral
| Token | Light rooms | Dark rooms | Notes |
|---|---|---|---|
| `background` | `#F1EEE6` cream | `#0C1B2E` navy-deep | page ground |
| `surface` | `#FFFEFC` paper | `#14243A` navy | cards, panels |
| `surface-raised` | `#FFFFFF` + `e-card` | `#1B3050` | hover rows, raised tiles |
| `border` | `rgba(27,36,50,.12)` | `rgba(241,238,230,.14)` | hairlines |
| `text-primary` | `#1B2432` ink **[13.5:1]** | `#F1EEE6` cream **[13.5:1]** | |
| `text-muted` | `#6A6354` **[5.1:1]** | `#9FB0C6` **[7.1:1]** | **the one muted grey** — replaces #8A93A2/#667085/#5A6472/#8A8272/#9A9484 |
| `text-faint` | `#8A8272` [3.3:1] | `#6E7F96` | decorative only: ≥18px, or non-informational |

### Accent
| Token | Value | Rule |
|---|---|---|
| `accent` | `#C9571F` | fills, bars, ≥18px display text; as *small* text on cream use `accent-text` |
| `accent-text` | `#A63D14` **[5.5:1 on cream]** | small orange text on light grounds |
| `accent-deep` | `#B4441C` | pressed states, gradient feet; white on it = **[5.5:1]** |
| `accent-dark-rooms` | `#E06A32` **[4.7:1 on navy]** | orange as text on navy |
| `gold` | `#E8B96A` **[8.6:1 on navy]** | the dark-room highlight (labels, net lines, trims) |
| `gold-text-light` | `#8F6A1C` [4.3:1] | gold as text on cream — **bold or ≥16px only** |

### Cricket semantics (one hue each, light-room text / dark-room text / fill)
| State | Light text | Dark text | Fill | |
|---|---|---|---|---|
| `wicket` | `#B23230` **[5.3:1]** | `#FF8A7A` **[6.8:1]** | `#B23230` | dismissals, FoW dots |
| `boundary-four` | `#22635F` **[6.0:1]** | `#4DA6A2` | teal | the four |
| `boundary-six` | `#8F6A1C` | `#E8B96A` | gold | the six |
| `dot-ball` | `#6A6354` | `#9FB0C6` | — | quiet by design |
| `win` | `#177A57` **[4.6:1]** | `#4CC38A` **[7.1:1]** | `#177A57` | money-in shares the hue |
| `loss` | `#B23230` | `#FF8A7A` | — | shares wicket hue deliberately |
| `injured` | `#B23230` + icon | `#FF8A7A` + icon | — | never color alone |
| `low-energy` | `#8F6A1C` + meter | `#E8B96A` + meter | amber bar | never color alone |

Banned: `#2D6A8F` and all FTP blues (34 live uses die in Phase 4); `#DC2626` folds into `wicket`; the three stray golds fold into `gold`.

**Text over watercolor:** always on a scrim — `linear-gradient(transparent, rgba(7,22,46,.82))` (bottom third) or the navy hero panel. Never bare text on art; the audit measured 1.1:1 where the paint happened to be light.

---

## 4 · Components

**Stat table** (squad, scorecards, almanack ledgers, statsguru) — one dialect replaces the five found:
- Row height 36px desktop / 44px phone; header `t-label` muted with 2px ink underline on the sorted column; cells `t-data` tabular; numerals right-aligned, names left, name column `min-width` + ellipsis *with title attr*.
- Zebra: none. Hover: `surface-raised`. Dense mode (squad, statsguru) 32px rows.
- Phone: the table keeps its columns and scrolls inside its own `overflow-x` container (never the page); the 2 leftmost identity columns sticky.
- Empty numeric cells print `·` in `text-faint`, never a dangling "–" beside real data.

**Player card** (market, academy, Int view):
- Grid: `[rating chip 44px] [identity] [figures right]`. Rating chip = navy square, `r-chip`, Inter 800 20px, **captioned** (`t-label` "OVR" under or beside — the unlabelled "60" dies).
- Identity: name `t-emph` (Fraunces in scouting/market, Inter in tables), one metadata line `t-data` muted — never 10px uppercase.
- Skill bars: 4px tracks, token fills (`accent` batting, `boundary-four` teal bowling, `gold` fielding); label + value always printed, bar is redundant encoding.

**Buttons** — three, replacing six dialects:
- `primary`: `accent`→`accent-deep` gradient, white `t-label` (13px), 44px min-height, `r-card`; one per view.
- `secondary`: `surface`, 1px `border`, ink `t-label`; 44px.
- `ghost`: no box, `accent-text` label with `›`; for doors and inline actions (the Sheet's INVEST pattern).
- Disabled = 40% opacity + `not-allowed`, never a new grey. Focus: 2px `gold` ring, both grounds.

**"Modal"** — the game correctly has none; the spec is the **decision strip** (`foDecide`): expands in place under the triggering control, `surface-raised`, `r-card`, question `t-emph`, note `t-data` muted, `primary` + `ghost` pair. This is a protected pattern, now with tokens.

**Tab bar** (feed LIVE/SCORECARD/CHARTS/LINEUPS, report tabs, squad Roster/Grid/Int):
- One style: underline tabs — `t-label` muted, active = ink + 2px `accent` underline, 44px hit area, horizontal scroll on phone with fade. (The pill-segment control on squad migrates to this; one fewer dialect.)

**Badge / pill:**
- `badge`: `t-label` 11px on tinted ground at 12% opacity of its semantic hue, `r-pill`, 20px tall — WIN/LOSS/FREE AGENT/INJURED.
- `chip` (interactive filter): as badge but 32px tall, 44px hit area via padding, pressed = filled.

**Score bug** (protected, tokenized):
- Navy-deep panel, `e-float`, gold accent dot for batting side, Inter 800 tabular score `t-display`, chase line `t-data` in `gold`; weather/pitch/toss chips = `badge` spec. Identical dress on feed live, watch, and (condensed, sticky) phone match view.

---

## 5 · How the system flexes per surface

- **Match engine (feed/watch/report):** the one surface allowed the full dark ground at daytime — broadcast navy, gold labels, orange only for the live pulse and the batting side. Charts: worm/manhattan/ladders keep team hues navy-vs-orange; wickets always `wicket` red dots. Density priority: score bug always visible; on phone it condenses and sticks under the topbar.
- **Squad & club ops:** paper rooms. Fraunces only for the page title; everything else Inter. Dense-mode tables, 32px rows, comparison columns adjacent (OVR next to identity, not far-right). Controls (training selects) demote to ghost style inside rows; identity leads.
- **World / Circuit (world, planet, nations, team, lore):** the watercolor is loudest here — full-bleed art in `r-hero` frames, scrim rule for all text, Fraunces display large, stat strips kept to the Sheet grammar. Lore desktop gets the mobile fold (cover + first legend, the rest behind their own names) plus an index rail ≥1100px.
- **Newspaper & records (Gazette, almanack, statsguru):** cream paper, hairlines, Fraunces `t-prose` at 65ch, drop-cap allowed on Gazette leads only. Numbers columns stay Inter tabular even mid-prose tables. No cards-within-cards: rules and whitespace do the structure (the Sheet is the exemplar).

---

## 6 · Three things deliberately NOT changed

1. **The watercolor/anime art and its navy framing** — every painting, boss portrait, ground scene, and the dark-hero composition around them stay pixel-identical. The system exists to frame the art, not compete with it.
2. **The no-modal, decisions-on-the-page principle and the game's written voice** (the umpire's honest ledger, the treasurer's asides, "the boys", the Gazette's prose). Copy is design material here and it is already right.
3. **The finance Sheet and the live score bug as shipped** — they are the two proofs the direction works; Phase 3 only swaps their hardcoded values for the tokens they already visually match, and then holds every other room to their standard.

---

## 7 · Phase 3 mechanics (for approval, not execution yet)

- **Step 0:** embed the two faces (self-hosted woff2 subsets, fingerprinted, SW-cached) and fix the scrolled sub-nav ground — the two whole-game fixes.
- **One token sheet** at the top of `30-brand.css` (`--fo-*` custom properties already exist for 13 colors; extend to the full table above). Rooms consume tokens; the census scripts from Phase 1 become the Phase 4 regression harness (color/size/spacing counts must go *down* every PR).
- **Order per brief:** match engine → squad screen → world/lore → Gazette + almanack/stats → remaining rooms. Each surface ships with its own before/after screenshots and a 3-item self-critique.

*Phase 2 ends here. No code changed. Awaiting your approval or edits — the one open taste call is the type pairing (Fraunces-led as recommended, vs Oswald-led sportier).*
