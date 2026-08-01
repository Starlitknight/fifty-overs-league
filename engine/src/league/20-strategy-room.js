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
  // ONE WORLD, ONE ANSWER. This read App.season - the retired local sim - and
  // nothing else, so a manager held in the served world was told about a match
  // that does not exist: another round, another opponent, at a ground called
  // Neutral Park. Worse, it was the answer BOTH the club home's NEXT MATCH
  // button and the matchday build-up were built on, so the game showed two
  // different next fixtures and two different pre-match pages at once.
  //
  // Where the world holds a club, the umpire's schedule IS the fixture list -
  // the same schedule the league page and the fixture card deal from - and the
  // answer carries the world address, so a caller can open the served preview
  // instead of inventing a build-up of its own.
  function servedNext() {
    try {
      var cl = window.__foWorldClaim;
      if (!cl) { try { cl = JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (eC) {} }
      if (!cl || !cl.country || cl.slot == null) return null;
      var lg = window.__foWorldLg, wt = window.__foWT;
      if (!lg || !wt || !wt.schedMirror) return null;
      try { lg.want(cl.country); } catch (eW) {}
      var snap = lg.get(cl.country); if (!snap) return null;
      var season = snap.seasonNo || 1;
      var sched = wt.schedMirror(cl.country, season) || [];
      var names = null, mgr = null;
      try {
        if (window.__foWorldNames) { names = window.__foWorldNames.get(cl.country); mgr = window.__foWorldNames.mgr(cl.country); }
      } catch (eN) {}
      var bySlot = {};
      (snap.table || []).concat(snap.table2 || []).forEach(function (row) {
        bySlot[row.slot] = (names && names[row.slot]) || row.name;
      });
      for (var r0 = (snap.roundsPlayed || 0); r0 < sched.length; r0++) {
        var rd = sched[r0] || [];
        for (var i = 0; i < rd.length; i++) {
          var f = rd[i];
          if (f[0] !== cl.slot && f[1] !== cl.slot) continue;
          var isHome = f[0] === cl.slot, oppSlot = isHome ? f[1] : f[0];
          var href = null;
          try { href = window.foPreviewHref ? window.foPreviewHref(cl.country, r0 + 1, f[0], f[1]) : null; } catch (eH) {}
          return {
            served: true, r: r0 + 1, round: r0 + 1, isHome: isHome, href: href,
            world: { nat: cl.country, season: season, round: r0 + 1, h: f[0], a: f[1] },
            opp: { name: bySlot[oppSlot] || "a club", slot: oppSlot },
            ground: (mgr && mgr["g" + f[0]]) || ((bySlot[f[0]] || "the ground") + "'s ground")
          };
        }
      }
      // held in the world, and the season is played out: there is no next
      // match, which is a truer answer than one off the retired sim
      return null;
    } catch (e) { return null; }
  }
  function nextFixture() {
    var sv = servedNext(); if (sv) return sv;
    try {
      // a device that has never claimed anything still plays its own season
      var cl0 = window.__foWorldClaim;
      if (!cl0) { try { cl0 = JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (eC0) {} }
      if (cl0 && cl0.country && cl0.slot != null) return null;
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
