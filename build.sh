#!/usr/bin/env bash
# Build the playable site: the engine (assembled from engine/src modules into
# its HTML shell) + the league overlay + the presentation bundle. Gameplay is
# guarded by the golden-master replay suite, not a pinned hash. Emits two
# identical entry points:
#   index.html        -> https://<user>.github.io/<repo>/            (clean URL)
#   client/game.html  -> .../client/game.html                        (kept stable)
set -euo pipefail
cd "$(dirname "$0")"

# assemble the engine from its source modules (exact-split extraction of the
# former single file; markers in the shell are replaced in manifest order)
mkdir -p .build
python3 - <<'PYASM'
import re
shell = open('engine/shell.html', encoding='utf-8').read()
names = [n for n in open('engine/src/manifest.txt').read().split('\n') if n]
for i, n in enumerate(names):
    shell = shell.replace('/*FO_ENGINE_BLOCK_' + str(i) + '*/',
                          open('engine/src/' + n + '.js', encoding='utf-8').read(), 1)
open('.build/engine.html', 'w', encoding='utf-8').write(shell)
PYASM
ENGINE=".build/engine.html"
OVERLAY="client/league-overlay.js"

# The First Summer campaign ships as modular sources (client/src/**), listed
# in dependency order by client/src/manifest.txt and concatenated into ONE
# extra <script> wrapped in an IIFE — no toolchain, no external requests,
# and the pristine engine stays byte-identical.
CAMPAIGN_DIR="client/src"
campaign_js() {
  printf '(function(){\n"use strict";\n'
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    printf '\n/* ---- %s ---- */\n' "$f"
    cat "$CAMPAIGN_DIR/$f"
  done < "$CAMPAIGN_DIR/manifest.txt"
  printf '\n})();\n'
}

# Boot veil, injected into the OUTPUT's <head> (the engine file itself is untouched,
# so its pinned sha256 is unaffected): hides the page in brand navy while the 1MB
# document parses, so the engine's original teal UI never flashes before the overlay
# restyles it. The overlay removes the veil once its CSS + screen are in place; a 4s
# CSS failsafe reveals the page regardless, so a script failure can't blank the site.
BOOT='<style id="fo-boot">html{background:#0B1322}html>body{visibility:hidden;animation:fo-boot-reveal .01s 4s forwards}@keyframes fo-boot-reveal{to{visibility:visible}}</style>'

# Every build gets a unique stamp (UTC time + overlay content hash). The overlay
# shows it (console + clock tooltip) and polls version.json to offer one-tap
# updates when the deployed build is newer than the one the CDN handed out.
BUILD_ID="$(date -u +%Y%m%d-%H%M)-$( (cat "$OVERLAY"; campaign_js) | sha256sum | cut -c1-6)"

build() {
  { sed "s|<head>|<head>$BOOT|" "$ENGINE"; printf '\n<script id="fo-league-overlay">\n'; sed "s|__FO_BUILD__|$BUILD_ID|g" "$OVERLAY"; printf '\n</script>\n<script id="fo-campaign">\n'; campaign_js; printf '\n</script>\n'; } > "$1"
  echo "built $1 ($(wc -c < "$1") bytes)"
}

build index.html
build client/game.html
printf '{"build":"%s"}\n' "$BUILD_ID" > version.json

echo "build id: $BUILD_ID"
echo "engine sha256: $(sha256sum "$ENGINE" | cut -d' ' -f1)"
