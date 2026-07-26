// api.mjs — the read API. Serves the world as static-cacheable JSON straight
// from the snapshots/matches tables. READ-ONLY by construction: this process
// contains no write paths at all, so "no client trust" (law 6) holds
// trivially in P1 — hostile payloads have nothing to speak to. Writes
// (orders, claims) arrive in P3 as a separate, authenticated surface.
//
//   PORT=8787 node api.mjs
//   GET /world/today.json     GET /league/eng.json     GET /match/{id}.json
import http from 'node:http';
import { makePool } from './db.mjs';

const pool = makePool();
const PORT = parseInt(process.env.PORT || '8787', 10);
const MATCH_ID = /^[a-z]{2,4}:s\d+:r\d+:h\d+a\d+$/;   // strict — nothing else reaches SQL

async function snapshot(key) {
  const r = await pool.query('SELECT body, updated_at FROM snapshots WHERE key=$1', [key]);
  return r.rowCount ? r.rows[0] : null;
}
const server = http.createServer(async (req, res) => {
  const send = (code, body, maxAge) => {
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=' + (maxAge || 60),
      'Access-Control-Allow-Origin': '*'
    });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
  try {
    if (req.method !== 'GET') return send(405, { error: 'read-only' });
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/world/today.json') {
      const s = await snapshot('world/today');
      return s ? send(200, s.body, 60) : send(404, { error: 'world not founded' });
    }
    const mL = /^\/league\/([a-z]{2,4})\.json$/.exec(url.pathname);
    if (mL) {
      const s = await snapshot('league/' + mL[1]);
      return s ? send(200, s.body, 60) : send(404, { error: 'unknown league' });
    }
    const mM = /^\/match\/(.+)\.json$/.exec(url.pathname);
    if (mM) {
      const id = decodeURIComponent(mM[1]);
      if (!MATCH_ID.test(id)) return send(400, { error: 'bad match id' });
      const r = await pool.query('SELECT id, country_id, season_no, round, seed, engine_version, pitch, result_canonical FROM matches WHERE id=$1', [id]);
      if (!r.rowCount) return send(404, { error: 'unknown match' });
      const m = r.rows[0];
      // matches are immutable once played — cache hard
      return send(200, '{"id":' + JSON.stringify(m.id) + ',"seed":' + String(m.seed) +
        ',"engineVersion":' + JSON.stringify(m.engine_version) + ',"pitch":' + JSON.stringify(m.pitch) +
        ',"result":' + m.result_canonical + '}', 86400);
    }
    if (url.pathname === '/healthz') return send(200, { ok: true }, 0);
    return send(404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    return send(500, { error: 'internal' });
  }
});
server.listen(PORT, () => console.error('world api listening on :' + PORT));
