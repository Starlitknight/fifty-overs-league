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

build() {
  { cat "$ENGINE"; printf '\n<script id="fo-league-overlay">\n'; cat "$OVERLAY"; printf '\n</script>\n'; } > "$1"
  echo "built $1 ($(wc -c < "$1") bytes)"
}

build index.html
build client/game.html

echo "engine sha256: $(sha256sum "$ENGINE" | cut -d' ' -f1)"
