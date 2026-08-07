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
# PHASE 0 DELIVERY SHAPE — the page and the program are separate files now.
# One 4 MB self-contained page meant every deploy was an all-or-nothing 4 MB
# refetch, every CDN cache hit was a chance to serve a stale GAME, and nobody
# could say which build a stuck screen was running. Now:
#
#   index.html / client/game.html   small, served with Cache-Control: no-cache
#                                   (see _headers) — every load asks the origin
#   assets/fo-<BUILD_ID>.js         ALL the JavaScript, in one fingerprinted
#                                   file — cached forever, safely, because a
#                                   new build has a new name
#
# The last few asset files are kept so an HTML copy cached for a few minutes
# by a lagging CDN node still finds the exact program it names. Gameplay is
# guarded by the golden-master replay suite (test/replay.test.mjs, which loads
# the built page THROUGH the same tags a browser follows), balance by
# tools/engine-bench.mjs.
set -euo pipefail
cd "$(dirname "$0")"

# Boot veil, injected into <head>: hides the page in brand navy while the
# document parses so the base teal UI never flashes before the skin lands.
# The league layer removes the veil; a 4s CSS failsafe reveals regardless.
#
# IT DOES NOTHING ELSE. It briefly also hung the last home-ground painting -
# and a tiny inlined thumbnail of it - as the document background, to try to
# put pixels on the first frame of a refresh. It went with a service worker
# that answered navigations from a cache. Together they made the thing they
# were built to fix worse: the reader got a blurred thumbnail sharpening into
# the painting instead of a clean load, and the worker turned every cache miss
# on a flaky connection into a "site cannot be reached" page. Both are gone.
# The kill script below is what remains of the worker: it exists to uninstall
# the copies already sitting in readers' browsers, because a worker that is
# merely deleted from the server keeps running forever in the clients that
# already have it.
BOOT='<style id="fo-boot">html{background:#0B1322}html>body{visibility:hidden;animation:fo-boot-reveal .01s 4s forwards}@keyframes fo-boot-reveal{to{visibility:visible}}</style><script>try{if("serviceWorker"in navigator&&navigator.serviceWorker.getRegistrations){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()})}).catch(function(){})}if(window.caches&&caches.keys){caches.keys().then(function(ks){ks.forEach(function(k){if(k.indexOf("fo-")===0)caches.delete(k)})}).catch(function(){})}}catch(e){}try{localStorage.removeItem("fo_hg_lqip");localStorage.removeItem("fo_hg_last")}catch(e){}</script>'

# ONE GAME, ONE ADDRESS. The site is published twice - GitHub Pages, which
# still serves the old bookmarks, and the host below, which is the real one.
# Two live origins is not a spare tyre, it is a split brain: a browser keeps
# localStorage PER ORIGIN, so the same manager on the two links has two
# device sessions, two cached careers and two cloud-save pulls, and every
# link they share sends friends to whichever one they happened to copy.
#
# So the old address forwards to the new one, before the program is even
# fetched: this runs in <head>, so a redirected visit never downloads the
# four-megabyte bundle twice. The decision is a pure function so it can be
# tested; the hostname guard is what makes a loop impossible, since the
# destination host contains no "github.io" and returns the empty string.
REDIR='<script>window.__foHome=function(h,p,s,x){try{if(String(h).indexOf("github.io")<0)return"";return"https://fifty-overs-league.s-rananaware.workers.dev/"+String(p).replace(/^\/[^\/]*\//,"")+(s||"")+(x||"")}catch(e){return""}};(function(){try{var u=window.__foHome(location.hostname,location.pathname,location.search,location.hash);if(u)location.replace(u)}catch(e){}})();</script>'

# Unique build stamp (UTC time + source hash). The league layer shows it and
# polls version.json to offer one-tap updates when a newer build is deployed.
BUILD_ID="$(date -u +%Y%m%d-%H%M)-$(cat engine/src/league/*.js engine/src/presentation/*.js engine/src/skin/*.css | sha256sum | cut -c1-6)"

mkdir -p .build assets
# THE WORKER CARRIES THE BUILD. Its shell cache is named after it, so shipping
# a new build retires the old shell on activation rather than hoping it expires.
# The source is engine/sw.js and the root sw.js is an OUTPUT - stamping the
# source in place would freeze the cache name at whatever build ran first.
python3 - "$BUILD_ID" <<'PYSW'
import sys
src = open('engine/sw.js', encoding='utf-8').read()
open('sw.js', 'w', encoding='utf-8').write(src.replace('__FO_BUILD__', sys.argv[1], 1))
PYSW
FO_BUILD_ID="$BUILD_ID" FO_BOOT="$BOOT" FO_REDIR="$REDIR" python3 - <<'PYASM'
import os, re
build_id = os.environ['FO_BUILD_ID']
boot = os.environ['FO_BOOT']
redir = os.environ['FO_REDIR']

shell = open('engine/shell.html', encoding='utf-8').read()
names = [n for n in open('engine/src/manifest.txt').read().split('\n') if n]

# ---- the program: every script, in exactly the order the page ran them ----
js = []
for i, n in enumerate(names):
    js.append('/* ==== engine:%s ==== */\n' % n +
              open('engine/src/' + n + '.js', encoding='utf-8').read())
    # the marker script tag leaves the page entirely; the code now lives in
    # the bundle at the same relative position
    tag = re.compile(r'<script[^>]*>/\*FO_ENGINE_BLOCK_' + str(i) + r'\*/</script>')
    assert tag.search(shell), 'missing marker %d' % i
    shell = tag.sub('', shell, count=1)

# The Living World snapshot (a real, engine-played season) is baked in as a
# global so the World Desk renders instantly with no fetch (works on file://
# and any static host alike). Regenerate with tools/build-world-snapshot.mjs.
try:
    world_snapshot = open('world-snapshot.json', encoding='utf-8').read().strip() or '{}'
except Exception:
    world_snapshot = '{}'
js.append('/* ==== world snapshot ==== */\nwindow.FO_WORLD_SNAPSHOT=' + world_snapshot + ';')

league_names = [n for n in open('engine/src/league/manifest.txt').read().split('\n') if n]
js.append('/* ==== league layer ==== */\n' +
          ''.join(open('engine/src/league/' + n, encoding='utf-8').read() for n in league_names))

pres_names = [n for n in open('engine/src/presentation/manifest.txt').read().split('\n') if n]
pres = '(function(){\n"use strict";\n'
for n in pres_names:
    pres += '\n/* ---- presentation:%s ---- */\n' % n
    pres += open('engine/src/presentation/' + n, encoding='utf-8').read()
pres += '\n})();\n'
js.append(pres)

# the blocks were separate <script> elements sharing the global scope; joined
# into one file the semantics are the same, and the ';' guards the seams
bundle = '\n;\n'.join(js).replace('__FO_BUILD__', build_id)
asset = 'assets/fo-%s.js' % build_id
open(asset, 'w', encoding='utf-8').write(bundle)

# ---- the page: markup + styles, no JavaScript of its own -------------------
skin = lambda f: open('engine/src/skin/' + f, encoding='utf-8').read()
head_css = ('<style id="fo-skin-login">' + skin('10-login.css') + '</style>' +
            '<style id="fo-skin-modal">' + skin('20-modal.css') + '</style>')
tail = '\n<style id="fo-brand">' + skin('30-brand.css') + '</style>\n'
assert shell.count('</body></html>') == 1
page = shell.replace('</body></html>', tail + '__FO_SCRIPT__</body></html>')
page = page.replace('<head>', '<head>' + redir + boot, 1)
page = page.replace('</head>', head_css + '</head>', 1)
page = page.replace('__FO_BUILD__', build_id)

# index.html sits at the root; client/game.html one level down
open('index.html', 'w', encoding='utf-8').write(
    page.replace('__FO_SCRIPT__', '<script src="' + asset + '"></script>\n'))
open('client/game.html', 'w', encoding='utf-8').write(
    page.replace('__FO_SCRIPT__', '<script src="../' + asset + '"></script>\n'))

# keep the last few program files so an HTML copy a lagging cache holds for a
# few more minutes still finds the exact program it names; prune the rest
import glob
assets = sorted(glob.glob('assets/fo-*.js'))
for old in assets[:-5]:
    os.remove(old)

# headless tooling (the resolver harness, the draft-pool proof) loads ONE
# self-contained page over file:// - keep emitting it for them; it never ships
open('.build/page.html', 'w', encoding='utf-8').write(
    page.replace('__FO_SCRIPT__', '<script>\n' + bundle + '\n</script>\n'))
PYASM

printf '{"build":"%s"}\n' "$BUILD_ID" > version.json

echo "built index.html ($(wc -c < index.html) bytes) + assets/fo-$BUILD_ID.js ($(wc -c < assets/fo-$BUILD_ID.js) bytes)"
echo "build id: $BUILD_ID"
