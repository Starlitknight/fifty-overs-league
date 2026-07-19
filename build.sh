#!/usr/bin/env bash
# Build the playable site from ONE source tree: engine/.
#
#   engine/shell.html            the page: HTML + inline CSS, with one marker
#                                per core script block at its original position
#   engine/src/00..12-*.js       the simulation + base-UI core blocks
#   engine/src/league/*.js       the league layer as domain chunks (auth, club
#                                home, sync, onboarding, market, orders, ...)
#                                concatenated in manifest order — one closure
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
BUILD_ID="$(date -u +%Y%m%d-%H%M)-$(cat engine/src/league/*.js engine/src/presentation/*.js engine/src/skin/*.css | sha256sum | cut -c1-6)"

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

league_names = [n for n in open('engine/src/league/manifest.txt').read().split('\n') if n]
league = ''.join(open('engine/src/league/' + n, encoding='utf-8').read() for n in league_names)
pres_names = [n for n in open('engine/src/presentation/manifest.txt').read().split('\n') if n]
pres = '(function(){\n"use strict";\n'
for n in pres_names:
    pres += '\n/* ---- presentation:%s ---- */\n' % n
    pres += open('engine/src/presentation/' + n, encoding='utf-8').read()
pres += '\n})();\n'

skin = lambda f: open('engine/src/skin/' + f, encoding='utf-8').read()
head_css = ('<style id="fo-skin-login">' + skin('10-login.css') + '</style>' +
            '<style id="fo-skin-modal">' + skin('20-modal.css') + '</style>')
tail = ('\n<style id="fo-brand">' + skin('30-brand.css') + '</style>\n' +
        '<script id="fo-league">\n' + league + '\n</script>\n' +
        '<script id="fo-presentation">\n' + pres + '\n</script>\n')
assert shell.count('</body></html>') == 1
page = shell.replace('</body></html>', tail + '</body></html>')
page = page.replace('<head>', '<head>' + boot, 1)
page = page.replace('</head>', head_css + '</head>', 1)
page = page.replace('__FO_BUILD__', build_id)

open('.build/page.html', 'w', encoding='utf-8').write(page)
PYASM

cp .build/page.html index.html
cp .build/page.html client/game.html
printf '{"build":"%s"}\n' "$BUILD_ID" > version.json

echo "built index.html + client/game.html ($(wc -c < index.html) bytes)"
echo "build id: $BUILD_ID"
