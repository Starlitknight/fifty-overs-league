// ---- 20-strategy-room.js — The Groundsman -------------------------------------
// What is left of the strategy layer now that The Dossier is retired: the two
// pieces of it that were never a page.
//
//   THE GROUNDSMAN - bot clubs prepare their own square. It writes team.homePitch,
//   which the engine's groundPitch() already honours for every fixture-meta path.
//   A bot's doctrine is a pure function of its (immutable) bowling-type
//   composition, so every client derives the same surface all season and an
//   absent manager is never surprised by a pitch that moved.
//
//   THE NEXT FIXTURE - one shared answer to "who is next, where, and on what",
//   read by the squad room and the match centre. Published as window.foNextFixture.
(function () {
  "use strict";
  function tcOf(t) { try { return typeClass(t); } catch (e) { return (t === "fast" || t === "fastMedium" || t === "medium") ? "pace" : "spin"; } }

  // a human's square is theirs to prepare; only bots get a doctrine written for them
  function humanMap() {
    try { if (window.__foClubMeta) return window.__foClubMeta; } catch (e) {}
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("fol_clubmeta_") === 0) { var m = JSON.parse(localStorage.getItem(k) || "null"); if (m) return m; }
      }
    } catch (e2) {}
    return {};
  }

  // ---- the groundsman's doctrines -------------------------------------------
  // Bots read their own dressing room: three frontline spinners want dust,
  // an all-seam attack wants grass. Based only on bowlType counts - the one
  // squad fact training can never change - so every client derives the same
  // doctrine all season.
  function botDoctrine(t) {
    var spin = 0, pace = 0;
    (t.players || []).forEach(function (p) { if (!p.bowlType) return; if (tcOf(p.bowlType) === "spin") spin++; else pace++; });
    // a doctrine needs a clear identity, not a slight lean - most squads
    // carry a few spinners regardless
    if (spin >= pace + 2) return "dry";
    if (pace >= spin + 3) return "green";
    return null;
  }
  function ensureDoctrines() {
    try {
      if (typeof GD === "undefined" || !GD.teams) return;
      var hm = humanMap();
      GD.teams.forEach(function (t, ix) {
        if (ix === App.teamIx) return;
        if (hm && hm[t.name]) return;
        var d = botDoctrine(t);
        if (d) t.homePitch = d;
      });
    } catch (e) {}
  }

  // ---- next fixture ----------------------------------------------------------
  function nextFixture() {
    try {
      if (typeof seasonInit === "function") seasonInit();
      var S = App.season; if (!S) return null;
      for (var r = S.round; r < S.schedule.length; r++) {
        var rd = S.schedule[r] || [];
        for (var i = 0; i < rd.length; i++) {
          var f = rd[i];
          if (f[0] !== App.teamIx && f[1] !== App.teamIx) continue;
          try { if (S.played && S.played[fixtureKey(r, f)] !== undefined) continue; } catch (eK) {}
          var home = GD.teams[f[0]], away = GD.teams[f[1]];
          return {
            r: r, f: f, home: home, away: away, isHome: f[0] === App.teamIx,
            opp: GD.teams[f[0] === App.teamIx ? f[1] : f[0]],
            ground: home.ground, pitch: groundPitch(home.ground),
            weather: WXLIST[(r * 7 + f[0] * 3) % WXLIST.length]
          };
        }
      }
    } catch (e) {}
    return null;
  }

  window.addEventListener("hashchange", function () { setTimeout(ensureDoctrines, 80); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(ensureDoctrines, 0); });
  else setTimeout(ensureDoctrines, 0);

  window.foNextFixture = nextFixture;
  window.__foStrategy = 1;
})();
