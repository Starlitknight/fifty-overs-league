# ART_REQUIREMENTS — illustrated-world vertical slice

Every asset below is referenced in code **only by its stable ID** (see
`src/assets.js`). Swapping a placeholder for final art is a one-line
manifest change. Specs follow the production brief (Part II).

## Status legend
- **FINAL** — existing commissioned art, already wired.
- **PLACEHOLDER** — CSS-painted composition (layered gradients/silhouettes),
  clearly provisional, safe to ship, listed here for replacement.

## A. Full-screen location backgrounds (source 2560×1440, WebP runtime, layered)

| Stable ID | Status | Needed |
| --- | --- | --- |
| `loc.station.home.morning` | PLACEHOLDER | Home-town railway station, grey morning brightening |
| `loc.home.exterior.morning` | PLACEHOLDER | **The golden scene**: overgrown square through open gates, pavilion distant, morning |
| `loc.home.exterior.dusk` | PLACEHOLDER | Same composition at dusk, post-match variant |
| `loc.pavilion.interior` | PLACEHOLDER | Pavilion social room, honours boards, tea urn |
| `loc.dressing.room` | PLACEHOLDER | Team room with magnetic lineup board wall |
| `loc.nets` | PLACEHOLDER | Practice lanes, netting, morning light |
| `loc.secretary.office` | PLACEHOLDER | Margaret's office: files, stamp, committee papers |
| `loc.trophy.room` | PLACEHOLDER | Sparse history room, one measured empty shelf |
| `loc.willowmere.town` | PLACEHOLDER | Village establishing view (best-kept-village energy) |
| `loc.willowmere.ground` | PLACEHOLDER | The Meadow exterior, soft green, ringed by willows |
| `loc.willowmere.dressing` | PLACEHOLDER | Away preparation room, unfamiliar and tidy |
| `loc.willowmere.entry` | PLACEHOLDER | Players' gate, walk to the field |

## B. Overlays (separable, transparent)
All PLACEHOLDER (none wired yet — the dusk variant is a full scene swap):
overcast, light rain, heavy rain streaks, warm afternoon, dusk grade,
crowd sparse/medium/full, victory bunting, defeat empty-ground, newspaper
prop, construction props, fixture poster, foreground depth edges.

## C. Core cast portraits (1024×1024, transparent, head-and-shoulders)

| Character | Status | Missing expressions |
| --- | --- | --- |
| Gaffer | **FINAL** (neutral `gaffer.png`, serious, amused/laugh, wry/wink) | angry, proud, tired |
| Reggie Thorne | **FINAL** (composed `thorne.png`) | dismissive, angry, reflective, grudging respect |
| Margaret Hobb | PLACEHOLDER (monogram) | neutral, brisk, concerned, pleased, disapproving |
| Priya Raman | PLACEHOLDER (monogram) | neutral, competitive, amused, frustrated, vulnerable |
| Captain / Prospect / Reporter | PLACEHOLDER (role art / monogram) | full sets per brief |
| Willowmere manager (Ted Marsh) | PLACEHOLDER (monogram) | welcoming, competitive, disappointed |

## D. Anchor-player identity art
Currently role cutouts (`bat.png`, `ar.png`, `keeper.png`, `pace1.png`,
`spin-finger.png`) — **FINAL art but shared**, so anchors are visually
interchangeable. Needed: neutral + one emotional variant for captain, star
batter, prospect, wicketkeeper, strike bowler, veteran; then the modular
generated-player portrait system (faces × hair × age × kit recolour).

## E. Scene cutouts
Core cast half-body cutouts (1200–1800px, transparent): all PLACEHOLDER
(portraits are used at 120px in-scene meanwhile).

## F. England map
`map.england.day` — **FINAL-adjacent**: the existing illustrated England
day-map is wired. Needed for full spec: railway/route layer, dynamic
club-node spacing, weather-overlay compatibility, 3000×2000 master without
baked labels.

## G. Crests
Existing soul-crest set is wired for archetypes. Needed: ten distinct club
crests (SVG masters, readable at 32px) + user crest-builder components
(shields, fields, motifs, ribbons, two-colour selection). The founding
choices (lantern / crossed bats / railway wheel) currently store the choice
without bespoke art.

## H–J. UI, props, animation
Dialogue frame, hotspots, notebook, travel card: **built in CSS/SVG-free
DOM** (shippable, replaceable). Props (scorebook, newspaper variants,
magnetic name cards, rain covers, boundary flags, station signage):
PLACEHOLDER — the newspaper and photograph exist as hotspots with dialogue
only. Animation: hotspot pulse, typed text, travel card fade are in;
blinking/breathing/parallax await final art layers.
