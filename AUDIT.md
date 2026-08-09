# AUDIT.md — Fifty Overs UI, Phase 1

**Method.** Three passes, all measured rather than eyeballed:
1. **Token census** over every style-bearing source — `engine/shell.html`, 3 skin CSS files, 66 league/presentation JS modules (styles live as strings inside JS).
2. **Computed-style pass** with headless Chromium over 23 routes at 1280px and 393px: distinct rendered font sizes, text under 11px, WCAG contrast of up to 400 text elements per page (against nearest painted ancestor), interactive targets under 32px, page height in screens.
3. **Screenshot review** of the worst-scoring pages, plus the four live phone screenshots supplied.

**Mapping the brief's surfaces to this codebase** (the brief names features from a sibling game; these are the equivalents):
| Brief surface | Fifty Overs reality |
|---|---|
| Match engine / broadcast | `#/feed` (live + stumps, score bug, tabs), `#/watch`, `#/report` (5 tabs), `#/preview` |
| Squad spreadsheet | `#/squad` (Roster/Grid/Int), `#/player`, `#/training`, `#/market` |
| World map / watercolor identity | `#/world`, `#/planet`, `#/nations`, `#/team`, `#/lore` (boss characters), cup pages |
| Newspaper / advisor | `#/paper` (the Gazette), `#/almanack`, `#/stats` (Statsguru) |

---

## 1 · Inventory of screens and states

**Shell (every page):** topbar (brand, bell, season/clock chip) · sub-nav rail with four dropdowns (CLUB / TOURNAMENTS / WORLD / RECORD) + LOG OUT · phone drawer · login overlay (`folWrap`) · inline decision strip (`foDecide` — the game has no modals by design) · toast messages.

**Rooms (~27 routes, each with signed-out / no-club / loading / error states on top of what's listed):**

- **Match:** `#/feed?fr=` and `#/feed?n=` — pre-match build-up, live (score bug + LIVE/SCORECARD/CHARTS/LINEUPS tabs), stumps; `#/watch` theatre; `#/report` — Summary / Scorecard / Commentary (key-moments vs every-ball) / Charts / Fantasy; `#/preview`; `#/matches` archive; legacy local `#/match`, `#/scorecard`.
- **Club ops:** `#/home`; `#/squad` Roster/Grid/Int; `#/player` overview + story + the office (list/quick-sell/release); `#/training` senior/youth + focus dropdowns; `#/academy` (Broadcast scout page); `#/market` all/bat/bowl/ar/wk × nation filter × sort, my-sales states (on the block, bids, withdraw); `#/finance` (the Sheet); `#/statement` (all/in/out + pagination); `#/ground` (expand decision); `#/fixtures`; `#/schedule`; `#/notifications`.
- **World:** `#/world`, `#/planet`, `#/nations`, `#/team?c=&s=`, `#/league`, `#/rankings`, `#/facup`, `#/champions`, `#/colts`, `#/lore` (cover + 19 boss features).
- **Editorial:** `#/paper` (Gazette front page + stories), `#/almanack` (records, leaders, all-time books, roll of champions), `#/stats` Data Wall + drill-downs (`?v=bat&sc=league` etc.).

---

## 2 · Visual hierarchy failures

1. ~~The scrolled sub-nav goes transparent on desktop.~~ **CORRECTED in Phase 3:** this was an artifact of the audit's own test harness (it force-hid the login overlay without running its close path, leaving the overlay's intended scroll-lock behind, which broke `position:sticky`). With the overlay closed properly the masthead sticks and the nav keeps its ground — confirmed by re-test and by the live phone screenshots. No player-facing defect.
2. **Topbar right corner is a pile-up.** The status toast ("New club setup pending") renders on top of the season/clock chip; bell, chip and toast all fight for the same corner (visible in all four phone screenshots).
3. **Squad roster buries the numbers it exists to compare.** Names truncate ("Sebastian …", badge clipped to "ROCK…"), a dangling "–" placeholder follows every age, and a 10-star row (mostly empty stars) takes half of each row to encode one number that's already printed beside it. The one column a manager scans — rating — is right-most and duplicated.
4. **Lore on desktop is a wall.** 18.1 screens tall, 17 distinct type sizes from 10px eyebrows to 110px display, no index or fold (mobile got the fold treatment; desktop never did).
5. **Market card stacks three competing surfaces** — cream page, white card, navy bid panel — and leads with an unlabelled "60" tile (rating chip with no caption; every other figure on the card is captioned).
6. **Training rows put controls above identity.** Two full-width selects per player dominate; the player is 10px uppercase metadata under his own name. 15 rows of identical "Batting / Auto" selects read as noise (a table with a changed-state exception would scan better).
7. **Schedule desktop spends 64px-tall cards on one-line facts** (42 rows → 2.9 screens), and introduces accent colors that exist nowhere else in the game (purple competition bars, blue-ish "Final" links — the palette rule says no blue).
8. **Almanack legend cards collide** — the gold "RECORD ›" ribbon overlaps player names at 1280 (screenshot: Shaheen Raza).

**What already works (protect it):** the watercolor art and its dark-navy framing (`#/home`, lore cover); the live score bug; the new finance Sheet (giant numeral → KPI strip → flat ledger) — it's the strongest hierarchy in the game and a proven direction; the core palette's top eight colors are genuinely coherent.

---

## 3 · Inconsistencies — actual values found

**Typefaces: 3 families in use** — `Oswald` ×869 declarations, `Inter` ×511, `Fraunces` ×268. ~~and none loaded~~ **CORRECTED in Phase 3:** the fonts *are* self-hosted (`client/fonts/*.woff2`) and declared by a runtime injector in `00-boot-auth.js`; the census searched only the shell and skin CSS and missed it. Two real findings survive the correction: (a) **three families is one over the brief's maximum** — DESIGN.md retires Oswald in favor of Inter label styles; (b) **the italic Fraunces files sit on disk undeclared**, so every italic (the treasurer's asides, Gazette prose) has been a synthesized slant, not the real face. Stragglers: Courier New, Verdana, Futura, Spline Sans, ui-monospace (one-offs).

**Font sizes: 51 distinct px values.** 10px ×715 · 13 ×460 · 11 ×312 · 12 ×301 · 12.5 ×266 · 10.5 ×193 · 11.5 ×121 · 13.5 ×97 · 14.5 ×29 · plus 7.5, 8, 8.5, 9, 9.5, 15.5, 16.5 … Half-pixel steps between 10 and 14 mean six "different" sizes within 2px of each other.

**Colors: 1,462 distinct hex values.** The head is coherent — `#FFFEFC` ×448, `#C9571F` ×346, `#14243A` ×306, `#1B2432` ×227, `#E8B96A` ×155, `#B44A22` ×141 — then a 1,400-value tail. Concrete drift, visible on single screens:
- two muted greys: `#8A93A2` ×93 vs `#667085` ×91 (plus `#5A6472`, `#8A8272`, `#9A9484`)
- four golds: `#E8B96A`, `#C9A24B`, `#F0B94E`, `#C8A13A`
- two reds: `#B23230` ×45 vs `#DC2626` ×28
- two teals: `#4DA6A2` ×44 vs `#2B6B68` ×30
- legacy FTP blue `#2D6A8F` ×34 still shipping (violates the standing "no blue" rule)

**Spacing: 76 distinct px values** — every integer 1–22 is in use, plus 2.5, 19, 58, 90…

**Radii: 28 distinct** — 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 65, 72, 99, 110, 999.

**`!important`: 2,754 occurrences.** Top offenders: `12-scorecard-analysis.js` 382, `30-brand.css` 333, `07-matchday-centre.js` 325, `shell.html` 249, `09-squad-matchlab.js` 176. This is the mechanism by which every new screen has had to shout over the last one (this session's finance page needed an *inline style on `<body>`* to win the background war — evidence the cascade is spent).

**Breakpoints: 12 distinct** max-widths (760 ×41, 640 ×30, 820 ×22, 700 ×18, 560 ×16, 900 ×14, 520, 480, 430, 600, 1180, 860). "Mobile" starts at five different widths depending on the room.

**Components:** ≥6 coexisting button dialects (`shell button`/`button.primary`, `.fo-me-btn`, `.fo-door-btn`, `.fd-viewsc`, `.fo-tri-btn`, `.fo-tre-act`) and ≥5 table dialects (`shell table/th/td`, `.fo-sct`, `.fd-tb`, `.fo-st-row` grid-rows, `.fo-al-ldg`).

---

## 4 · Information density

Measured page height (desktop / phone, in screens):

| Page | 1280px | 393px | Verdict |
|---|---|---|---|
| Lore | **18.1** | 3.6 (folded) | Wall on desktop; the fold never shipped there |
| Almanack | **5.7** | 2.2 (folded) | Same pattern |
| Schedule | 2.9 | 3.3 | Card-per-line wastes ~50% vertical |
| Team page | 1.9 | 2.9 | Acceptable |
| Feed (stumps) | 2.1 | 2.5 | Good |
| Squad | 1.7 | 1.5 | Wrong kind of density: one wide list, stars eat the width; FM-style multi-column table would show 2× players per screen |
| World / Planet | 1.0 | 1.0 | **Underfilled** — hero + a handful of links, 4 type sizes; the watercolor surface with the least watercolor confidence |

The brief's ask — "dense data stays dense, make it scannable" — is currently inverted in two places: the data screens (squad, schedule) are *loose*, while the reading screens (lore, almanack desktop) are *endless*.

---

## 5 · Accessibility basics

- **Contrast (WCAG AA, sampled 400 elements/page).** Real failures, excluding text-over-art: squad eyebrow `eb` 10px at **2.3:1**; roster meta at 3.8:1; feed conditions line `fd-cond` 13.5px at **2.1:1**; report ground line `gr` at 3.3:1; stats centre 19 flagged; almanack kicker `k` 10.5px at 1.6:1. The whole muted-ink-on-cream family (`#8a8272`, `#a09a8d`, `#9a9484` on `#F1EEE6`) sits between 2.9 and 4.2 — below AA for the small sizes it's used at.
- **Text over watercolor with no scrim** — lore hero lede, training header, feed hero details all measure 1.1–1.5:1 against their painted ancestor; legibility currently depends on the artwork happening to be dark in the right place.
- **Tap/click targets under 32px:** training desktop **49** (the per-player selects and links), colts 22, facup 20, lore 19, champions/market 12–15. (44px is the floor the system itself declared in `30-brand.css` — these rooms predate or bypass it.)
- **Tiny text:** 10px uppercase Oswald is the house eyebrow — **715 declarations**; on a phone the squad page renders 78 sub-11px nodes. At 10px with .18em tracking in a *fallback* sans (see fonts, above) these are markedly less legible than the same label would be in actual Oswald.
- **Focus & motion:** 54 `:focus` rules and 47 `prefers-reduced-motion` guards exist — partial, room-by-room coverage; most interactive elements fall back to the browser default ring, which is nearly invisible on the navy surfaces. 86 `aria-` attributes total.

---

## 6 · The five worst offenders, by player impact

1. ~~No fonts are actually loaded~~ — **withdrawn** (the loader lives in the league layer; see §3). The surviving type findings: three families where the brief allows two, and italics synthesized because the italic files were never declared.
2. ~~The scrolled sub-nav has no ground on desktop~~ — **withdrawn** (test-harness artifact; see §2.1). Replacing it in the ranking: **the topbar's right corner pile-up** — status toasts render over the season/clock chip on every surface.
3. **Color and cascade entropy (1,462 hexes, 2,754 !important)** — the reason screens visibly drift (two greys, four golds, two reds on the same page) and the reason every new room needs `!important` or inline styles to render as designed.
4. **The squad screen fails its one job** — truncated names, placeholder dashes, half-empty star rows, and the comparison numbers pushed to the edge; this is the screen a manager opens most after match day.
5. **10px-uppercase-everywhere (715 uses) on cream at 2–4:1 contrast** — the system's own label style is below legibility and below AA at the sizes and colors it ships at.

---

*Phase 1 ends here. No code has been changed. Awaiting approval (or edits) before Phase 2 — DESIGN.md: one type scale with the two faces actually embedded, one spacing scale, semantic tokens over the existing top-eight palette, component specs for the six shared components, and the three things deliberately left untouched.*
