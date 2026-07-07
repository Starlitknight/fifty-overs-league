// Tiny HTTP surface for the resolver container. POST /genpool { count } returns a
// master pool of unique engine players (used by the deal_draft Edge Function).
// POST /resolve { home, away, homeOrders, awayOrders, conds, pinnedHash } resolves
// one match on demand. Auth: a shared RESOLVER_TOKEN bearer.
// UNTESTED-live; genMasterPool / resolveMatch are exercised in the test suite.
import { createServer } from 'node:http';
import { openEngine, resolveMatch, genMasterPool, buildHash } from './resolve.mjs';

const PORT = Number(process.env.PORT ?? 8080);
const TOKEN = process.env.RESOLVER_TOKEN;

const eng = await openEngine();
console.log(`resolver http up on :${PORT}, build ${buildHash().slice(0, 12)}…`);

const body = (req) => new Promise((resolve) => {
  let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => resolve(d ? JSON.parse(d) : {}));
});

createServer(async (req, res) => {
  const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  try {
    if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'unauthorized' });
    if (req.method !== 'POST') return send(405, { error: 'POST only' });
    const b = await body(req);
    if (req.url === '/genpool') {
      const players = await genMasterPool(eng.page, b.seed_base ?? ('pool-' + (b.league_id ?? 'x')), b.count ?? 60);
      return send(200, { players });
    }
    if (req.url === '/resolve') {
      const payload = await resolveMatch(eng.page, b, { pinnedHash: b.pinnedHash });
      return send(200, payload);
    }
    if (req.url === '/health') return send(200, { ok: true, build: buildHash() });
    return send(404, { error: 'not found' });
  } catch (e) {
    send(500, { error: String(e.message ?? e) });
  }
}).listen(PORT);
