# Fifty Overs — Distinctive live-match city art v2

This set replaces the repeated full-oval composition with six different live-match viewpoints. Every image depicts an actual delivery or running play, so it can sit beneath an ongoing-match interface.

## The six visual identities

| City | Match moment | Camera | Weather and feeling |
|---|---|---|---|
| Dublin | Grounded cover drive | High oblique scorebox view | Cool, calm morning; precision and tradition |
| Belfast | Fast bowler charging in | Grass-level behind the bowler | Dry hard wind; pressure and defiance |
| Cork | Lofted shot toward the river | Across the River Lee | Golden late afternoon; communal joy and suspense |
| Amsterdam | Batter advancing to spin | Low behind the wicketkeeper | Crisp blue-sky noon; intelligence and playfulness |
| Utrecht | Dangerous quick single | High rooftop bird's-eye | Still amber evening; strategy and sudden risk |
| Rotterdam | Final-over fast delivery | Low side-on square-leg view | Windy harbor sunset; speed and ambition |

## Files

- `masters/`: lossless 1672 × 941 PNG masters.
- `runtime/`: GitHub-ready WebP files at the same dimensions.
- `city_live_match_art_overview.png`: labelled review sheet only.
- `asset_manifest.json`: stable IDs, live-match moments and suggested overlay zones.
- `PROMPT_SET.md`: reusable visual specification.

The discarded pre-match Dublin-gate experiment is stored separately under `story_concepts/` and is intentionally excluded from both match-art packages.

## Integration guidance

- Use the WebP files as scene backgrounds beneath the live commentary, score and decision interface.
- Use `object-fit: cover`; avoid portrait crops narrower than about 4:3.
- Add a localized translucent gradient beneath text instead of darkening the entire illustration.
- Respect each asset's suggested overlay zone in `asset_manifest.json`; the open space deliberately moves between cities.
- Do not attempt to synchronize the illustrated ball with simulation ball-by-ball events. Treat each image as venue mood art for a passage of play.
- If you later add variants, make the match moment broad enough to remain believable for several overs: pressure spell, spin duel, running phase, boundary assault or closing overs.
