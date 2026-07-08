#!/usr/bin/env bash
# Build the playable site: the pristine engine + the league overlay, concatenated.
# The pristine engine is never edited (its sha256 is pinned as BUILD_HASH); the
# overlay is simply appended as a <script>. Emits two identical entry points:
#   index.html        -> https://<user>.github.io/<repo>/            (clean URL)
#   client/game.html  -> .../client/game.html                        (kept stable)
set -euo pipefail
cd "$(dirname "$0")"

ENGINE="Fifty_Overs_Club_Manager_2026_v11_6.html"
OVERLAY="client/league-overlay.js"

# Boot veil, injected into the OUTPUT's <head> (the engine file itself is untouched,
# so its pinned sha256 is unaffected): hides the page in brand navy while the 1MB
# document parses, so the engine's original teal UI never flashes before the overlay
# restyles it. The overlay removes the veil once its CSS + screen are in place; a 4s
# CSS failsafe reveals the page regardless, so a script failure can't blank the site.
BOOT='<style id="fo-boot">html{background:#0B1322}html>body{visibility:hidden;animation:fo-boot-reveal .01s 4s forwards}@keyframes fo-boot-reveal{to{visibility:visible}}</style>'

build() {
  { sed "s|<head>|<head>$BOOT|" "$ENGINE"; printf '\n<script id="fo-league-overlay">\n'; cat "$OVERLAY"; printf '\n</script>\n'; } > "$1"
  echo "built $1 ($(wc -c < "$1") bytes)"
}

build index.html
build client/game.html

echo "engine sha256: $(sha256sum "$ENGINE" | cut -d' ' -f1)"
