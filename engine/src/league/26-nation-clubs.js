// ---- 26-nation-clubs.js — the league takes its nation's colours ---------------
// An England league used to line up Prairie Pioneers, Harbour Hawks and other
// generated drifters - clubs of nowhere. This layer deterministically renames
// BOT clubs to the counties of the league's nation (Yorkshire at Headingley,
// Lancashire at Old Trafford...), and rewrites the save's own history so every
// past scorecard, standing and honour still adds up.
//
// The rules of the road, in order:
//   - a human manager's club is NEVER touched (fol_clubmeta / __foClubMeta);
//   - your own club is never touched;
//   - a bot already carrying a pool name keeps it;
//   - assignment is a pure function of (team order, pool order), so every
//     device - online or offline - derives the identical league. No packets,
//     no coordination: the multiplayer constraint is satisfied by determinism.
(function () {
  "use strict";

  // the county championship, ground and all - enough for a full league of bots
  var POOLS = {
    eng: [
      { n: "Yorkshire", g: "Headingley" },
      { n: "Lancashire", g: "Old Trafford" },
      { n: "Surrey", g: "The Oval" },
      { n: "Middlesex", g: "Lord's" },
      { n: "Warwickshire", g: "Edgbaston" },
      { n: "Nottinghamshire", g: "Trent Bridge" },
      { n: "Kent", g: "Canterbury" },
      { n: "Durham", g: "The Riverside" },
      { n: "Somerset", g: "Taunton" },
      { n: "Sussex", g: "Hove" },
      { n: "Essex", g: "Chelmsford" },
      { n: "Hampshire", g: "The Rose Bowl" },
      { n: "Worcestershire", g: "New Road" },
      { n: "Leicestershire", g: "Grace Road" },
      { n: "Gloucestershire", g: "Bristol" },
      { n: "Derbyshire", g: "Derby" }
    ]
  };

  function metaMap() {
    try { if (window.__foClubMeta) return window.__foClubMeta; } catch (e) {}
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("fol_clubmeta_") === 0) {
          var m = JSON.parse(localStorage.getItem(k) || "null");
          if (m) return m;
        }
      }
    } catch (e2) {}
    return {};
  }
  function natId() {
    try { return (window.__foLgAPI && window.__foLgAPI.nation && window.__foLgAPI.nation()) || "eng"; } catch (e) { return "eng"; }
  }
  function ready() {
    return typeof App !== "undefined" && App && App.teamIx != null &&
      typeof GD !== "undefined" && GD && GD.teams && GD.teams.length > 1;
  }

  function anglicise() {
    try {
      if (!ready()) return false;
      // never shuffle identities under a live match
      try { if (typeof M !== "undefined" && M && !M.done) return false; } catch (eM) {}
      var pool = POOLS[natId()]; if (!pool) return false;
      var hm = metaMap();
      var taken = {}, poolNames = {}, groundCount = {};
      GD.teams.forEach(function (t) {
        taken[String(t.name || "").toLowerCase()] = 1;
        var g = String(t.ground || "");
        groundCount[g] = (groundCount[g] || 0) + 1;
      });
      pool.forEach(function (p) { poolNames[p.n.toLowerCase()] = 1; });

      var renames = [], pi = 0;
      GD.teams.forEach(function (t, ix) {
        if (ix === App.teamIx) return;
        var nm = String(t.name || "");
        if (hm && hm[nm]) return;
        if (poolNames[nm.toLowerCase()]) return;
        while (pi < pool.length && taken[pool[pi].n.toLowerCase()]) pi++;
        if (pi >= pool.length) return;
        var e = pool[pi]; pi++;
        taken[e.n.toLowerCase()] = 1;
        renames.push({ ix: ix, oldN: nm, newN: e.n, oldG: String(t.ground || ""), newG: e.g });
      });
      if (!renames.length) return false;

      // history rewrite: substitute longest names first, so a short name can
      // never chew through a longer one that contains it
      var subs = [];
      renames.forEach(function (r) {
        if (r.oldN) subs.push([r.oldN, r.newN]);
        // a ground shared by two clubs is ambiguous - leave it be
        if (r.oldG && r.oldG !== r.newG && groundCount[r.oldG] === 1) subs.push([r.oldG, r.newG]);
      });
      subs.sort(function (a, b) { return b[0].length - a[0].length; });
      var fix = function (s) {
        if (typeof s !== "string" || !s) return s;
        for (var i = 0; i < subs.length; i++) if (s.indexOf(subs[i][0]) >= 0) s = s.split(subs[i][0]).join(subs[i][1]);
        return s;
      };

      renames.forEach(function (r) {
        var t = GD.teams[r.ix];
        t.name = r.newN;
        if (r.oldG && groundCount[r.oldG] === 1) t.ground = r.newG;
      });
      (App.results || []).forEach(function (r) {
        if (!r) return;
        r.home = fix(r.home); r.away = fix(r.away); r.ground = fix(r.ground);
        if (r.result) { r.result.winner = fix(r.result.winner); r.result.text = fix(r.result.text); }
        (r.innings || []).forEach(function (inn) {
          if (!inn) return;
          inn.batTeam = fix(inn.batTeam); inn.bowlTeam = fix(inn.bowlTeam);
        });
        if (Array.isArray(r.log)) for (var i = 0; i < r.log.length; i++) r.log[i] = fix(r.log[i]);
      });
      if (App.pending) {
        App.pending.home = fix(App.pending.home);
        App.pending.away = fix(App.pending.away);
        App.pending.ground = fix(App.pending.ground);
      }
      try { if (typeof saveGame === "function") saveGame(false); } catch (eS) {}
      // let every signature-cached page repaint with the county names
      try {
        var pg = document.getElementById("page");
        if (pg) { pg.__foLgSig = null; pg.__foHomeSig = null; pg.__scoutSig = null; pg.__foSideSig = null; }
      } catch (eP) {}
      try { if (typeof window.route === "function") window.route(); } catch (eR) {}
      return true;
    } catch (e) { try { console.warn("foNationClubs", e); } catch (e2) {} return false; }
  }

  // run at boot, then a few more times while late hydration (cloud saves,
  // multiplayer club metadata) lands; after that every navigation re-checks.
  // Each pass is a cheap no-op once the league already wears its colours.
  var tries = 0;
  function tick() { tries++; anglicise(); if (tries < 8) setTimeout(tick, 1500); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(tick, 300); });
  else setTimeout(tick, 300);
  window.addEventListener("hashchange", function () { setTimeout(anglicise, 60); });

  window.foAngliciseClubs = anglicise;
})();
