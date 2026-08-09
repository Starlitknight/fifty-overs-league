# DESIGN.md — Fifty Overs, codified (polish pass)

**Stance.** This codifies the identity that already exists — cream ground, navy surfaces, orange accent, serif display over sans data, eyebrow → headline → data — into explicit rules. Nothing here restyles the game; every rule below is the existing look with its exceptions removed. (Supersedes the earlier redesign-era draft; the token names carry over.)

---

## 1 · Color tokens (semantic, both grounds)

Canonical set — all already shipping in `30-brand.css` as `--fo-*`:

| Token | Light rooms | Dark rooms | Use |
|---|---|---|---|
| `bg` | `#F1EEE6` | `#0C1B2E` | page ground |
| `surface` | `#FFFEFC` | `#14243A` | cards, panels |
| `surface-tint` | `#F4EFE3` | `#1B3050` | bands, hover, raised rows |
| `border` | `rgba(27,36,50,.12)` | `rgba(241,238,230,.14)` | hairlines |
| `text-primary` | `#1B2432` | `#F1EEE6` | |
| `text-muted` | `#6A6354` [5.1:1] | `#9FB0C6` [7.1:1] | the one muted |
| `accent-orange` | `#C9571F` (fills, ≥18px) · `#A63D14` (small text) | `#E06A32` | interactive + eyebrows **only** |
| `gold` | `#8F6A1C` (text) · `#E8B96A` (fills) | `#E8B96A` | **pending / attention** |
| `success-green` | `#177A57` | `#4CC38A` | positive outcomes only |
| `danger-red` | `#B23230` | `#FF8A7A` | negative outcomes only |
| `teal` | `#22635F` | `#4DA6A2` | bowling craft, boundary-four (domain color, not status) |

### Hardcoded colors outside the set — disposition list
Every literal at ≥20 occurrences plus the named offenders; **map** = replace with the token, **promote** = it earns a name.

| Literal | Where | Disposition |
|---|---|---|
| `#14313A → #0C2420` gradient | **the dark-green auction panel** (market "The bidding stands with") | **Map** to the navy surface gradient (`#14243A → #0C1B2E`) with a `success-green` accent strip for the leading-bid state. One fewer surface family. *Defensible alternative:* promote as `surface-deal` — keeps the "money on the table" mood at the cost of an eleventh color. Recommend map. |
| `#C9A24B` ×83 | old gold text (schedule kickers, medals) | Map → `gold` text `#8F6A1C` / fills `#C08A2E` |
| `#F3D37A` ×66 | pale gold washes | Map → `#E8B96A` at reduced opacity |
| `#C8674A` ×54 | terracotta fills | Map → `accent-orange` |
| `#FFFDF7` ×45 | warm white | Map → `surface #FFFEFC` |
| `#F59E0B` ×30 | bright amber statuses | Map → `gold` (this *is* the pending color, drifted) |
| `#2B6B68` ×30 | second teal | Map → `teal #22635F` |
| `#DDD8CF` / `#E3DCCB` ×56 | solid hairlines where rgba can't paint | **Promote** one: `border-solid #E3DCCB` |
| `#15803D` ×26 | bright green | Map → `success-green` |
| `#A33328` ×25 | third red | Map → `danger-red` |
| `#F5EFDC` ×25 | cream band | Map → `surface-tint #F4EFE3` |
| `#B8933A` ×22 | academy gold | Map → `gold` |
| `#98A0AE`, `#8FA8CC` | label greys | Map → `text-muted` (light/dark respectively) |
| ~1,300 sub-20-count tints | washes, one-off shades | Rule: new code may not add any; existing ones fall to the nearest token whenever their file is next touched. Art-derived sets (pitch-condition swatches, kit colors, flag art) are **exempt by name** — they are content. |

### Semantic discipline (the audit's violations, now rules)
- **Green = positive outcome only** (won, money in, bid leading, fit). Never decoration.
- **Red = negative outcome only** (lost, money out, wicket against you, injured).
- **Gold = pending / attention** ("awaiting the draw", hammer countdown, unbroken stand, "in play"). The schedule's "Final (upcoming)" rows and the market hammer already behave this way — codified.
- **Orange = interactive + eyebrows, never status.** Current violations to correct in Phase 2: the feed's live-pulse dot (status → gold), squad "watched player" names (status → gold), any orange WIN/LOSS-adjacent chip.

---

## 2 · Typography — the serif/sans rule

Two faces (Fraunces, Inter — both self-hosted, italic Fraunces real since the last pass). The ambiguity ends with one sentence:

> **Fraunces** for: page headlines, club and player names *when they are the display element* (heroes, scout folios, Gazette bylines), narrative/flavor prose, pull quotes, the treasurer's asides.
> **Inter** for: **every data value including money**, labels, buttons, navigation, tabs, table content, chips, and any name *inside a table row*.

Named strays to converge in Phase 2 (all currently serif data):
- market card fact figures (`.fo-mk-row .facts b` — asking/reserve/wages in Fraunces)
- market sale strip amounts (`.fo-mk-swho .amt2`)
- player-page office figures (quick-sell/reserve values)
- academy report estimate figures
Conversely, sans headlines that should be serif: none found — headlines already conform.

Scale unchanged from the shipped system: 11 label / 13 data / 14 body / 16 emph / 20 h3 / 26 h2 / 36 h1 / display clamp / 15 prose. Floor stays 11px. Tabular numerals on every column of figures.

---

## 3 · Number formatting — one standard, applied globally

- **Currency:** full figures with commas **below $1m** (`$54,320`, `$690,000` — the market's "$690k" becomes `$690,000`); **compact at ≥$1m** with one decimal (`$1.4m`, `$2.4m`). Signed money always carries its sign (`+$186,400`, `−$54,320`).
  *One flagged exception, your call:* the finance Sheet's headline bank figure currently prints in full (`$2,412,600`) as the page's thesis. Strict rule says `$2.4m`. **Option A (recommended):** the single largest numeral on a page may print in full — a treasurer's flourish, one exception, defined here. **Option B:** no exceptions, `$2.4m` everywhere. A: keeps the Sheet's drama / B: zero ambiguity.
- **Percentages:** integers, no decimals (`61%`, `78%`); one decimal only under 10 overs-style rates where the decimal is the signal (`4.65 an over`, econ `5.2`).
- **Counts:** thousands commas from 1,000 (`9,400`, `12,000 seats`); never compacted below 100,000; crowds and seats never compacted at all.

Implementation note: the engine already owns `M()` (full) and `Mk()` (compact) in each money-printing module — Phase 2 routes every call through one shared formatter implementing the rule, so the standard is a function, not a convention.

---

## 4 · Label hierarchy — two quieter levels under the eyebrow

Today nearly everything uppercase-shouts. Three levels, strictly assigned:

| Level | Treatment | Reserved for |
|---|---|---|
| **L1 · eyebrow** | 11px / 700 / UPPERCASE / +0.08–0.14em / muted or accent | Eyebrows and stat captions **only** ("AT THE BANK", "PER ROUND · OPERATING", "IN", "OUT") |
| **L2 · title** | 13px / 700 / sentence case / +0.01em / ink | Card titles, section heads inside cards, door labels ("The full ledger" not "THE FULL LEDGER"), tab items |
| **L3 · control** | 14px / 600 / sentence case / normal tracking | Buttons ("The full report ›" not "THE FULL REPORT AND SCORECARD ›"), nav items ("Club", "Cups", "World", "Record"), select values |

Consequences enforced in Phase 2: the topbar nav re-cases to sentence case (and "Tournaments" shortens to "Cups", killing the "TOURNAM…" truncation at its root); the feed hero CTA, the Sheet's doors, the market chips and every fd/fo button drop full-caps; stat captions and eyebrows keep theirs — they are the identity and they stop competing the moment everything else quiets down.

---

*Phase 1 ends here. No code touched. Two calls for you before Phase 2: (1) currency headline exception — Option A flourish vs Option B strict; (2) auction panel — map to navy (recommended) vs promote `surface-deal`. Phase 2 then runs the defect list in order: mobile chrome collapse, truncation kills, number normalization, card-nesting flatten, button triage, SVG trophy, table polish, semantic-color corrections.*
