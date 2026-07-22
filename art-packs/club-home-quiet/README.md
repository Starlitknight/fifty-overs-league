# Fifty Overs — Quiet Club-Home Background v2

An environment-led homepage background with only three small figures. The
left 42% and lower edge fade into the game's deep navy so dynamic club details
can sit above the artwork without losing readability.

## Files

- `client/art/home/club-home-quiet-background.webp` — optimized runtime asset, 1915 × 821
- `club_home_quiet_background_master.png` — lossless editing master retained
  outside GitHub to avoid repository bloat

For GitHub and the live game, upload only the 88 KB WebP file.

## Suggested CSS

```css
.club-home-hero {
  background-color: #071a31;
  background-image:
    linear-gradient(90deg,
      rgba(7, 26, 49, .10) 0%,
      rgba(7, 26, 49, .02) 48%,
      rgba(7, 26, 49, .08) 100%),
    url("art/home/club-home-quiet-background.webp");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

@media (max-width: 700px) {
  .club-home-hero {
    background-position: 72% center;
  }
}
```

Keep the club name, crest, statistics and buttons as real HTML above the image.

This is an optional UI-safe alternative. It is deliberately not added to the
live Eleven Arches time-of-day rotation, so uploading it cannot replace the
existing homepage art without an explicit integration change.
