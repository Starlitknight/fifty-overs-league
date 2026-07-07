// Fifty Overs — multiplayer client integration.
//
// The client is a VIEW + action submitter. It never computes a result, its own
// squad state, or lock timing — it reads server-owned state and calls the
// validated action functions. It also enforces the engine-version pin: if the
// client's build hash != the league's pinned hash, multiplayer actions are
// blocked (a stale client must not submit orders or verify against the wrong
// engine logic).
//
// Pure render + guard functions are exported for unit tests; the browser
// bootstrap at the bottom is guarded by `typeof window`.

// BUILD_HASH — sha256 of the exact game engine file this client ships with.
// (Base build Fifty_Overs_Club_Manager_2026_v11_6.html.) Recompute and update
// this constant whenever the engine file changes; the league pins one build.
export const BUILD_HASH =
  "e558745ede94e2502d5cccaa829feb42818cbcb1e779664c4b784a851b3f00ff";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---- client-side hash-pin enforcement -------------------------------------
/** Compare the client's engine build to the league's pin. */
export function guardBuildHash(leaguePin, clientHash = BUILD_HASH) {
  if (!leaguePin) return { ok: false, message: "league has no pinned build hash" };
  if (leaguePin !== clientHash) {
    return {
      ok: false,
      message: `Your game build (${clientHash.slice(0, 12)}…) does not match this ` +
        `league's pinned engine (${leaguePin.slice(0, 12)}…). Update your client to play.`,
    };
  }
  return { ok: true, message: "engine build matches the league pin" };
}

// ---- pure renderers (return HTML strings) ---------------------------------
export function renderStandings(rows, myTeamId) {
  const body = rows.map((r) => `
    <tr class="${r.team_id === myTeamId ? "me" : ""}">
      <td>${r.pos}</td><td>${esc(r.team_name)}</td>
      <td class="n">${r.p}</td><td class="n">${r.w}</td><td class="n">${r.l}</td>
      <td class="n">${r.t}</td>
      <td class="n">${Number(r.nrr) >= 0 ? "+" : ""}${Number(r.nrr).toFixed(3)}</td>
      <td class="n"><b>${r.pts}</b></td>
    </tr>`).join("");
  return `<table class="tbl"><thead><tr><th>#</th><th>Club</th>
    <th class="n">P</th><th class="n">W</th><th class="n">L</th><th class="n">T</th>
    <th class="n">NRR</th><th class="n">Pts</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function renderFixtures(fixtures, teamsById) {
  const nm = (id) => esc(teamsById[id]?.name ?? id);
  const badge = (s) => `<span class="badge ${s}">${s}</span>`;
  const rows = fixtures.map((f) => `
    <tr><td class="n">${f.round}</td><td>${nm(f.home_team_id)}</td>
      <td>${nm(f.away_team_id)}</td>
      <td class="small">${esc((f.resolve_at || "").replace("T", " ").slice(0, 16))}</td>
      <td>${f.result_text ? esc(f.result_text) : badge(f.status)}</td></tr>`).join("");
  return `<table class="tbl"><thead><tr><th>Rd</th><th>Home</th><th>Away</th>
    <th>Kickoff</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** A verification badge for a stored result the client re-resolved locally. */
export function renderVerifyBadge(verify) {
  return verify.ok
    ? `<span class="badge ok" title="${esc(verify.reason)}">✓ verified</span>`
    : `<span class="badge fail" title="${esc(verify.reason)}">⚠ mismatch</span>`;
}

// ---- REST client (browser) ------------------------------------------------
export function makeApi({ url, anonKey, getToken }) {
  const headers = () => ({
    apikey: anonKey,
    Authorization: `Bearer ${getToken() || anonKey}`,
    "content-type": "application/json",
    "Accept-Profile": "app",
    "Content-Profile": "app",
  });
  return {
    async rpc(fn, args = {}) {
      const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: "POST", headers: headers(), body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`);
      return res.json();
    },
    async select(table, query = "") {
      const res = await fetch(`${url}/rest/v1/${table}?${query}`, { headers: headers() });
      if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
      return res.json();
    },
  };
}

// ---- browser bootstrap ----------------------------------------------------
if (typeof window !== "undefined") {
  window.FO_MP = { BUILD_HASH, guardBuildHash, renderStandings, renderFixtures, renderVerifyBadge, makeApi, esc };
}
