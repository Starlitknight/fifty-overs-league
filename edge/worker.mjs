// ---- edge/worker.mjs — THE EDGE PAYS THE EGRESS -----------------------------
// Nineteen players burned nineteen gigabytes of Supabase's five-gigabyte
// free month, because every open tab pulled the same world snapshots straight
// from the origin. This worker sits in front of the static site and adds one
// route: /sb/* proxies GET reads to Supabase through Cloudflare's edge cache.
//
//   - a read served from cache costs Supabase NOTHING; the cache answers a
//     whole town's polling with one origin fetch per key per minute
//   - only anonymous public reads are cached: a request carrying a user's
//     Authorization token bypasses the cache entirely, both ways, so one
//     manager's rows can never be served to another
//   - when Supabase is throttled or down, a stale cached copy beats an error:
//     entries are kept a day and served past their freshness on origin failure
//
// Everything that is not /sb/* falls through to the static assets exactly as
// before; cache behaviour for those still lives in _headers.
const SB = "https://egaipdksvztqqgouriyc.supabase.co";
const FRESH_MS = 60 * 1000;            // how long a cached read is served as-is

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/sb/") && request.method === "GET") {
      return sbRead(request, url, ctx);
    }
    return env.ASSETS.fetch(request);
  }
};

async function sbRead(request, url, ctx) {
  const upstream = SB + url.pathname.slice(3) + url.search;
  const fwd = pickHeaders(request.headers);

  // a personalised read is none of the cache's business
  if (fwd.authorization) {
    try { return await fetch(upstream, { headers: fwd }); }
    catch (e) { return new Response("upstream unreachable", { status: 502 }); }
  }

  // the profile header selects the Postgres schema, so it is part of identity
  const keyUrl = upstream + (upstream.indexOf("?") >= 0 ? "&" : "?") +
    "__profile=" + encodeURIComponent(fwd["accept-profile"] || "public");
  const cacheKey = new Request(keyUrl, { method: "GET" });
  const cache = caches.default;

  const hit = await cache.match(cacheKey);
  if (hit) {
    const at = Number(hit.headers.get("x-fo-cached-at") || 0);
    if (Date.now() - at < FRESH_MS) return hit;
  }

  let res = null;
  try { res = await fetch(upstream, { headers: fwd }); } catch (e) { res = null; }
  if (res && res.ok) {
    const body = await res.arrayBuffer();
    const out = new Response(body, {
      status: 200,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
        // the Cache API's own expiry is set long; freshness is judged by
        // x-fo-cached-at above so a stale copy stays available for fallback
        "cache-control": "public, max-age=86400",
        "x-fo-cached-at": String(Date.now()),
        "access-control-allow-origin": "*"
      }
    });
    ctx.waitUntil(cache.put(cacheKey, out.clone()));
    return out;
  }
  if (hit) return hit;                  // stale beats an outage
  return res || new Response("upstream unreachable", { status: 502 });
}

function pickHeaders(h) {
  const out = {};
  for (const k of ["apikey", "authorization", "accept", "accept-profile", "range", "prefer", "range-unit"]) {
    const v = h.get(k);
    if (v) out[k] = v;
  }
  return out;
}
