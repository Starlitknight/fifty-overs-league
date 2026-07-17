/* core/ids — stable identity for players, clubs, matches and arcs.
 *
 * Engine objects have no ids (players are keyed by display name). We mint an
 * id once per entity and persist the name→id map inside the campaign save so
 * identity survives reloads and container restarts. Minting is
 * non-destructive: engine objects are never required to carry the id — the
 * map is the source of truth — but where a roster object passes through
 * campaign UI we also stamp a __foid convenience field.
 *
 * Known v1 limit (documented in docs/first-summer.md): two squad members with
 * the identical display name and country would share an id; the engine's
 * name banks make this effectively impossible inside one squad.
 */
FOC.ids = (function () {
  var U = FOC.util;

  // mint a stable id from a namespace + natural key; same key → same id
  function mint(map, ns, naturalKey) {
    var key = ns + "|" + naturalKey;
    if (map[key]) return map[key];
    map[key] = ns + "_" + U.hash32(key).toString(36) + "_" + (Object.keys(map).length + 1).toString(36);
    return map[key];
  }

  function playerId(save, p) {
    if (!p || !p.name) return null;
    save.idmap = save.idmap || {};
    return mint(save.idmap, "p", p.name + "|" + (p.country || ""));
  }

  // ensure every player on the roster has a stable id in save.idmap
  function ensurePlayers(save, players) {
    (players || []).forEach(function (p) {
      if (!p || !p.name) return;
      var id = playerId(save, p);
      try { p.__foid = id; } catch (e) {}
    });
    return save.idmap;
  }

  function byId(players, save, id) {
    var hit = null;
    (players || []).forEach(function (p) {
      if (hit || !p) return;
      if (p.__foid === id || playerId(save, p) === id) hit = p;
    });
    return hit;
  }

  // a match result signature: stable for the same completed match, distinct
  // across a season even when two matches share a scoreline
  function matchSig(rec) {
    return "m_" + U.hash32([rec.ch, rec.n, rec.opp, rec.my, rec.op, rec.win ? 1 : 0, rec.topNm, rec.bbNm].join("|")).toString(36);
  }

  return { mint: mint, ensurePlayers: ensurePlayers, playerId: playerId, byId: byId, matchSig: matchSig };
})();
