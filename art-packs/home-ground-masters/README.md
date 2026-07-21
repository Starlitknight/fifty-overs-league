# Eleven Arches rotating homepage collection

## Deliverables

- `masters/` contains six 1672 × 941 lossless PNG files.
- `runtime/` contains six visually matched WebP files, each approximately 130–280 KB.
- `rotation-manifest.json` maps the scenes to local time, weather, season and activity.
- `PROMPTS.md` records the production prompt system.

## Recommended implementation

Choose the background from actual home-ground time and weather first, then use match state to break ties. Do not shuffle on every page load. Hold a selected image for the whole in-game day so returning to the club page feels spatially stable.

Crossfade backgrounds over 700–1000 ms. Apply one shared CSS readability gradient rather than permanently darkening the art. Respect reduced-motion preferences by switching instantly.

The viaduct is more than decoration: use occasional train movement or sound as a lightweight ambient event, refer to the scoreboard end as **The Arches End**, and let supporters nickname the ground **The Eleven Arches**. This turns the visual anchor into remembered club culture.
