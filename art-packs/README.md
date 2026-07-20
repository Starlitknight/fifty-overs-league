# Art packs (source archives)

Original uploaded art packs for player figures and page backdrops. These are
kept as the source of record — the game itself never reads from this folder.

The extracted, game-ready assets live in `client/art/`:

- `client/art/players/<role>_<nation>.webp` — player figures used by squad
  cards, the transfer market, orders modals, and the player-page hero card.
  Roles: `bat`, `ar`, `wk`, `f` (fast), `fm` (fast-medium), `mp` (medium
  pacer), `fs` (finger spin), `ws` (wrist spin).
  Nations: `eng`, `aus`, `ind`, `nzl`, `rsa`, `win`.
- `client/art/orders-room.webp` — the orders-page backdrop, compressed from
  `orders-room-source.png` in this folder.

To add a new pack: drop the zip here, extract the figures to
`client/art/players/` following the naming scheme above, and wire any new
role/nation codes into `foPkArt` in `engine/src/league/03-onboarding.js`.
