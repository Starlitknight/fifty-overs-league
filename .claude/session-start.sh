#!/usr/bin/env bash
# .claude/session-start.sh — MAKE THE TESTS RUNNABLE BEFORE ANYBODY TRIES.
#
# Two things are true of this repo at the start of every session and neither is
# obvious from a failure:
#
#   1. The server tests need Postgres. When it is down they fail with dozens of
#      "Connection refused" lines that read exactly like a real regression, and
#      the honest cause is one dead cluster.
#   2. The server runs the BUILT engine (server/enginehost.mjs loads index.html
#      in a VM), so an engine source change that has not been rebuilt is
#      invisible server-side - the tests quietly measure the old engine.
#
# This says both out loud. It never fixes silently and never fails the session:
# a warning a reader can act on beats a repair they did not know happened.
set -u

if command -v pg_isready >/dev/null 2>&1; then
  if ! pg_isready -q 2>/dev/null; then
    pg_ctlcluster 16 main start >/dev/null 2>&1 || true
    if pg_isready -q 2>/dev/null; then
      echo "postgres: was down, started it - server tests can run"
    else
      echo "postgres: DOWN and would not start. Server tests will fail with"
      echo "          'Connection refused'; that is the cluster, not the code."
      echo "          Try: pg_ctlcluster 16 main start"
    fi
  fi
fi

# is the shipped build older than the engine it is built from?
asset=$(grep -oE 'assets/fo-[a-z0-9-]+\.js' index.html 2>/dev/null | head -1)
if [ -n "${asset:-}" ] && [ -f "$asset" ]; then
  newer=$(find engine/src engine/shell.html -newer "$asset" -type f 2>/dev/null | head -3)
  if [ -n "$newer" ]; then
    echo "engine: source is NEWER than the shipped build ($asset)."
    echo "        The server tests load the BUILT engine, so they are measuring"
    echo "        the old one until you run ./build.sh. Changed since the build:"
    echo "$newer" | sed 's/^/          /'
  fi
fi
exit 0
