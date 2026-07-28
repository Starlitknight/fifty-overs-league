# Resolver container: headless Chromium (Playwright) running the REAL game engine.
# Runs the cron worker (due matches) and/or the HTTP server (genpool/resolve).
FROM mcr.microsoft.com/playwright:v1.56.1-jammy

WORKDIR /app

# deps
COPY resolver/package.json ./resolver/package.json
RUN cd resolver && npm install --omit=dev playwright@1.56.1

# the PINNED engine build + resolver code (build hash is computed over this file)
COPY index.html ./index.html
COPY resolver/resolve-harness.js ./resolver/resolve-harness.js
COPY resolver/resolve.mjs ./resolver/resolve.mjs
COPY resolver/worker.mjs ./resolver/worker.mjs
COPY resolver/server.mjs ./resolver/server.mjs

WORKDIR /app/resolver

# Default: the polling worker (officials daily + friendlies at kickoff).
# Override CMD with ["node","server.mjs"] to run the HTTP surface instead, or run
# both as separate services. For a platform cron, use: node worker.mjs --once
CMD ["node", "worker.mjs"]
