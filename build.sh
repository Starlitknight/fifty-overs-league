#!/usr/bin/env bash
# Build the playable site from ONE source tree: engine/.
#
#   engine/shell.html            the page: HTML + inline CSS, with one marker
#                                per core script block at its original position
#   engine/src/00..12-*.js       the simulation + base-UI core blocks
#   engine/src/20-league.js      the league layer: brand skin, auth/multiplayer,
#                                Circuit, broadcasts, rich commentary voice
#   engine/src/presentation/*    the presentation modules (oval stage, smooth
#                                renderer, boot), one IIFE, manifest order
#
# The assembler splices everything into a single self-contained page. Gameplay
# is guarded by the golden-master replay suite (test/replay.test.mjs), balance
# by tools/engine-bench.mjs. Emits two identical entry points:
#   index.html        -> https://<user>.github.io/<repo>/            (clean URL)
#   client/game.html  -> .../client/game.html                        (kept stable)
set -euo pipefail
cd "$(dirname "$0")"

# Boot veil, injected into <head>: hides the page in brand navy while the
# document parses so the base teal UI never flashes before the skin lands.
# The league layer removes the veil; a 4s CSS failsafe reveals regardless.
BOOT='<style id="fo-boot">html{background:#0B1322}html>body{visibility:hidden;animation:fo-boot-reveal .01s 4s forwards}@keyframes fo-boot-reveal{to{visibility:visible}}</style>'

# Unique build stamp (UTC time + source hash). The league layer shows it and
# polls version.json to offer one-tap updates when a newer build is deployed.
BUILD_ID="$(date -u +%Y%m%d-%H%M)-$(cat engine/src/20-league.js engine/src/presentation/*.js | sha256sum | cut -c1-6)"

mkdir -p .build
FO_BUILD_ID="$BUILD_ID" FO_BOOT="$BOOT" python3 - <<'PYASM'
import os
build_id = os.environ['FO_BUILD_ID']
boot = os.environ['FO_BOOT']

shell = open('engine/shell.html', encoding='utf-8').read()
names = [n for n in open('engine/src/manifest.txt').read().split('\n') if n]
for i, n in enumerate(names):
    shell = shell.replace('/*FO_ENGINE_BLOCK_' + str(i) + '*/',
                          open('engine/src/' + n + '.js', encoding='utf-8').read(), 1)

league = open('engine/src/20-league.js', encoding='utf-8').read()
pres_names = [n for n in open('engine/src/presentation/manifest.txt').read().split('\n') if n]
pres = '(function(){\n"use strict";\n'
for n in pres_names:
    pres += '\n/* ---- presentation:%s ---- */\n' % n
    pres += open('engine/src/presentation/' + n, encoding='utf-8').read()
pres += '\n})();\n'

tail = ('\n<script id="fo-league">\n' + league + '\n</script>\n' +
        '<script id="fo-presentation">\n' + pres + '\n</script>\n')
assert shell.count('</body></html>') == 1
page = shell.replace('</body></html>', tail + '</body></html>')
page = page.replace('<head>', '<head>' + boot, 1)
page = page.replace('__FO_BUILD__', build_id)

open('.build/page.html', 'w', encoding='utf-8').write(page)
PYASM

cp .build/page.html index.html
cp .build/page.html client/game.html
printf '{"build":"%s"}\n' "$BUILD_ID" > version.json

echo "built index.html + client/game.html ($(wc -c < index.html) bytes)"
echo "build id: $BUILD_ID"
