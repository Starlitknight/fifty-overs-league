// ---- 29-star-pages.js — every name on the planet opens ------------------------
// Two pages that make the world's people and its biggest days tappable:
//
//   THE STAR PAGE (#/star?r=&sl=&s=&n=) - a world cricketer's career, told from
//     the era they belong to: season-by-season runs and wickets, best score
//     and best figures, their club's pennants while they wore the shirt, and
//     any world record still standing in their name. Reached from the
//     almanack's leader boards and the World XI.
//
//   THE CUP MATCH PAGE (#/wcmatch?s=&st=&g=) - a World Cup tie in full: the
//     two nations, the innings as they unfolded (checkpoint by checkpoint),
//     and the named performances that decided it - national XIs drawn from
//     the best of each country's clubs. Reached from the bracket.
//
// Both are, as ever, pure functions of the world calendar and its seeds.
(function () {
  "use strict";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function h32(s) { var h = 2166136261 >>> 0; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rnd01(s) { return h32(s) / 4294967296; }
  function P() { return window.__foPlanet || null; }
  function S() { return window.__foStars || null; }
  function cx() { return window.__foCxAPI || null; }
  function artBase() {
    if (typeof FO_ART !== "undefined") return FO_ART;
    return (location.pathname.indexOf("/client/") !== -1) ? "art/" : "client/art/";
  }
  function flagOf(rid) { return artBase() + "flags/" + cx().flagFile(rid) + ".svg"; }
  function q(name) { var m = new RegExp("[?&]" + name + "=([^&]+)").exec(location.hash || ""); return m ? decodeURIComponent(m[1]) : null; }
  function regionList() { var c = cx(); return c ? (c.regions() || []).filter(function (r) { return !r.final; }) : []; }
  function regionById(rid) { var L = regionList(); for (var i = 0; i < L.length; i++) if (L[i].id === rid) return L[i]; return null; }
  function ovrOf(p) { try { if (typeof foPkOvr === "function") return foPkOvr(p); } catch (e) {} return (p && p.rating ? Math.round(p.rating / 1000) : 50); }
  function roleName(p) {
    if (!p) return "";
    if (p.keeper || p.role === "wicketkeeper") return "Wicketkeeper";
    if (p.role === "allRounder") return "All-rounder";
    if (p.bowlType) return /spin|break|SLA|LB|OB/i.test(String(p.bowlTypeFull || p.bowlType)) ? "Spin bowler" : "Pace bowler";
    return "Batsman";
  }
  function stageName(st) { return { r16: "The Last Sixteen", qf: "Quarter-final", sf: "Semi-final", final: "The World Cup Final" }[st] || st; }
  function parseScore(s) {
    var m = /^(\d+)(?:\/(\d+))?( all out)?/.exec(String(s || ""));
    if (!m) return { runs: 0, wkts: 10 };
    return { runs: +m[1], wkts: m[3] ? 10 : (m[2] != null ? +m[2] : 10) };
  }

  // ============================ THE STAR PAGE =================================
  function eraSeasons(rid, sl, seenSeason, curSeason) {
    var era = S().eraOf(rid, sl, seenSeason), out = [];
    for (var s2 = Math.max(1, seenSeason - 4); s2 <= curSeason; s2++) if (S().eraOf(rid, sl, s2) === era) out.push(s2);
    return out;
  }
  function starSeason(rid, sl, season, name, rounds) {
    var agg = { season: season, runs: 0, wkts: 0, best: 0, bb: null, inns: 0 };
    for (var r3 = 1; r3 <= rounds; r3++) {
      P().fixturesOf(rid, season, r3).forEach(function (m) {
        if (m.home.slot !== sl && m.away.slot !== sl) return;
        var pf = S().perf(rid, season, r3, m);
        var x = m.home.slot === sl ? pf.h : pf.a;
        if (x.bat && x.bat.n === name) { agg.runs += x.bat.r; agg.inns++; if (x.bat.r > agg.best) agg.best = x.bat.r; }
        if (x.bowl && x.bowl.n === name) { agg.wkts += x.bowl.w; if (!agg.bb || x.bowl.w > agg.bb.w || (x.bowl.w === agg.bb.w && x.bowl.rc < agg.bb.rc)) agg.bb = { w: x.bowl.w, rc: x.bowl.rc }; }
      });
    }
    return agg;
  }
  function foRenderStarPage() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/star") return;
      if (!P() || !S() || !cx()) return;
      var page = document.getElementById("page"); if (!page) return;
      try { document.body.classList.remove("fo-ov-on", "fo-boss-on", "fo-scb-on", "fo-drs-on"); } catch (eB) {}
      var rid = q("r"), sl = +(q("sl") || 0), seen = +(q("s") || 1), name = q("n");
      var reg = regionById(rid); if (!reg || !name) { page.innerHTML = "<div class='fo-star'><p style='padding:40px 20px'>This cricketer has slipped out of the record.</p></div>"; return; }
      var now = Date.now(), p = P().phaseOf(now);
      var sq = S().squadOf(rid, sl, seen) || [];
      var me = null; sq.forEach(function (pl) { if (pl.name === name) me = pl; });
      var sides = P().sidesOf(rid); var club = sides[sl] ? sides[sl].name : reg.nm;
      var seasons = eraSeasons(rid, sl, seen, p.season);
      var rows = seasons.map(function (s2) {
        var rounds = s2 < p.season ? (P().ROUNDS || 18) : P().roundsDone(now, p.season, rid);
        return starSeason(rid, sl, s2, name, rounds);
      });
      var tot = { runs: 0, wkts: 0, best: 0, bb: null, inns: 0 };
      rows.forEach(function (a) {
        tot.runs += a.runs; tot.wkts += a.wkts; tot.inns += a.inns;
        if (a.best > tot.best) tot.best = a.best;
        if (a.bb && (!tot.bb || a.bb.w > tot.bb.w || (a.bb.w === tot.bb.w && a.bb.rc < tot.bb.rc))) tot.bb = a.bb;
      });
      // pennants while they wore the shirt
      var pennants = [];
      seasons.forEach(function (s2) {
        var done = s2 < p.season || p.di >= 14;
        if (!done) return;
        var c = P().championOf(rid, s2);
        if (c && c.slot === sl) pennants.push(s2);
      });
      // records still standing in their name
      var chips = [];
      try {
        var v = S().sweep(now);
        if (v.rec.indBat && v.rec.indBat.line.indexOf(name + " ") === 0) chips.push("Holds the world record score &middot; " + v.rec.indBat.v);
        if (v.rec.indBowl && v.rec.indBowl.line.indexOf(name + " ") === 0) chips.push("Holds the world's best bowling &middot; " + v.rec.indBowl.v + "/" + v.rec.indBowl.rc);
        if (v.xi && (v.xi.bats.some(function (x) { return x.n === name; }) || v.xi.bowls.some(function (x) { return x.n === name; }))) chips.push("World XI of Season " + v.xi.season);
      } catch (eC) {}
      pennants.forEach(function (s2) { chips.push(reg.nm + " champion &middot; Season " + s2); });
      var retired = seasons[seasons.length - 1] < p.season;

      var seasonRows = rows.map(function (a) {
        return "<div class='fo-star-row'><i>S" + a.season + "</i>" +
          "<em>" + a.runs + " runs</em><em>best " + (a.best || "&mdash;") + "</em>" +
          "<em>" + a.wkts + " wkts</em><em>" + (a.bb ? "best " + a.bb.w + "/" + a.bb.rc : "&mdash;") + "</em></div>";
      }).join("");

      page.innerHTML =
        "<div class='fo-star'>" +
        "<div class='fo-star-mast'>" +
        "<div class='fo-star-kick'><img src='" + flagOf(rid) + "' alt=''> " + E(reg.nm) + " &middot; " + E(club) + (retired ? " &middot; retired" : "") + "</div>" +
        "<h1>" + E(name) + "</h1>" +
        "<p>" + E(roleName(me)) + (me && me.age ? " &middot; age " + me.age : "") + (me ? " &middot; rated " + ovrOf(me) : "") +
        " &middot; seasons " + seasons[0] + "&ndash;" + seasons[seasons.length - 1] + "</p>" +
        (chips.length ? "<div class='fo-star-chips'>" + chips.map(function (c) { return "<span>" + c + "</span>"; }).join("") + "</div>" : "") +
        "</div>" +
        "<div class='fo-star-sec'><h2>The career, season by season</h2>" +
        "<div class='fo-star-row hd'><i></i><em>Runs</em><em>Best</em><em>Wickets</em><em>Best</em></div>" +
        seasonRows +
        "<div class='fo-star-row tot'><i>All</i><em>" + tot.runs + " runs</em><em>best " + (tot.best || "&mdash;") + "</em><em>" + tot.wkts + " wkts</em><em>" + (tot.bb ? "best " + tot.bb.w + "/" + tot.bb.rc : "&mdash;") + "</em></div>" +
        "</div>" +
        "<div class='fo-star-foot'><a href='#/almanack'>The world almanack &rsaquo;</a><a href='#/nation?n=" + encodeURIComponent(rid) + "'>" + E(reg.nm) + " &rsaquo;</a><a href='#/planet'>World cricket &rsaquo;</a></div>" +
        "</div>";
    } catch (e) { try { console.warn("foRenderStarPage", e); } catch (e2) {} }
  }

  // ========================== THE CUP MATCH PAGE ==============================
  // a nation's XI for the cup: the best bats and bowls across all its clubs
  function natPool(rid, season) {
    var bats = [], bowls = [];
    for (var sl = 0; sl < 10; sl++) {
      var sq = S().squadOf(rid, sl, season) || [];
      sq.forEach(function (pl) { (pl.bowlType ? bowls : bats).push(pl); });
    }
    var byOvr = function (a, b) { return ovrOf(b) - ovrOf(a); };
    return { bats: bats.sort(byOvr).slice(0, 6), bowls: bowls.sort(byOvr).slice(0, 4) };
  }
  function cupPerf(season, stage, gi, natA, natB, sa, sb) {
    var key = "wcpf|" + season + "|" + stage + "|" + gi;
    // walk forward from the seeded index so a collision never eats a slot
    var pickFrom = function (list, tag, used) {
      if (!list.length) return null;
      var ix = Math.floor(Math.pow(rnd01(key + tag), 1.4) * list.length);
      for (var t2 = 0; t2 < list.length; t2++) {
        var cand = list[(ix + t2) % list.length];
        if (cand && !used[cand.name]) { used[cand.name] = 1; return cand; }
      }
      return null;
    };
    var innings = function (batNat, bowlNat, sc, tag) {
      var pool = natPool(batNat, season), opp = natPool(bowlNat, season);
      var shares = [0.34, 0.22, 0.14], out = [], used = {};
      shares.forEach(function (sh, i2) {
        var pick = pickFrom(pool.bats, tag + "b" + i2, used);
        if (!pick) return;
        out.push({ n: pick.name, r: Math.max(8, Math.round(sc.runs * (sh * (0.75 + rnd01(key + tag + "v" + i2) * 0.5)))) });
      });
      var bl = [], usedB = {};
      [0, 1].forEach(function (i3) {
        var pick = pickFrom(opp.bowls, tag + "w" + i3, usedB);
        if (!pick) return;
        bl.push({ n: pick.name, w: Math.max(1, Math.min(5, Math.floor(sc.wkts / 2) + (i3 === 0 ? 1 : 0))), rc: 22 + Math.floor(rnd01(key + tag + "c" + i3) * 40) });
      });
      return { bats: out.sort(function (a, b) { return b.r - a.r; }), bowls: bl };
    };
    return { a: innings(natA, natB, sa, "a"), b: innings(natB, natA, sb, "b") };
  }
  function checkpoints(key, total, wkts) {
    var out = [], overs = [10, 20, 30, 40, 50];
    overs.forEach(function (ov, i2) {
      var f = ov / 50, ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      var frac = f * 0.75 + ease * 0.25 + (rnd01(key + "cp" + i2) - 0.5) * 0.05;
      out.push({ ov: ov, r: Math.min(total, Math.max(0, Math.round(total * Math.min(1, frac)))), w: Math.min(wkts, Math.floor(f * wkts + rnd01(key + "cw" + i2) * 1.4)) });
    });
    out[out.length - 1] = { ov: 50, r: total, w: wkts };
    return out;
  }
  function foRenderWcMatchPage() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/wcmatch") return;
      if (!P() || !S() || !cx()) return;
      var page = document.getElementById("page"); if (!page) return;
      try { document.body.classList.remove("fo-ov-on", "fo-boss-on", "fo-scb-on", "fo-drs-on"); } catch (eB) {}
      var season = +(q("s") || 1), st = q("st") || "final", gi = +(q("g") || 0);
      var stIx = { r16: 0, qf: 1, sf: 2, final: 3 }[st] || 0;
      var now = Date.now();
      if (P().wcStagesDone(now, season) <= stIx) { page.innerHTML = "<div class='fo-wm'><div class='fo-wm-mast'><h1>Not yet played</h1><p>This tie is still to come on the world calendar.</p></div></div>"; return; }
      var stg = P().wcBracket(season)[stIx]; var m = stg.matches[gi]; if (!m) return;
      var sa = parseScore(m.hs), sb = parseScore(m.as);
      var pf = cupPerf(season, st, gi, m.a.rid, m.b.rid, sa, sb);
      var key = "wcm|" + season + "|" + st + "|" + gi;
      var innBlock = function (nat, rid2, sc, x, win) {
        var cps = checkpoints(key + rid2, sc.runs, sc.wkts >= 10 ? 10 : sc.wkts);
        return "<div class='fo-wm-inn" + (win ? " win" : "") + "'>" +
          "<div class='fo-wm-innh'><img src='" + flagOf(rid2) + "' alt=''><b>" + E(nat) + "</b><u>" + sc.runs + (sc.wkts >= 10 ? " all out" : "/" + sc.wkts) + "</u></div>" +
          "<div class='fo-wm-cps'>" + cps.map(function (c) { return "<span><i>" + c.ov + " ov</i><b>" + c.r + "/" + c.w + "</b></span>"; }).join("") + "</div>" +
          "<div class='fo-wm-perf'>" +
          x.bats.map(function (b2) { return "<div><b>" + E(b2.n) + "</b><u>" + b2.r + "</u></div>"; }).join("") +
          "</div></div>";
      };
      var bowlBlock = function (label, bl) {
        return bl.length ? "<div class='fo-wm-bowl'><i>" + label + "</i>" + bl.map(function (b2) { return "<span>" + E(b2.n) + " " + b2.w + "/" + b2.rc + "</span>"; }).join("") + "</div>" : "";
      };
      page.innerHTML =
        "<div class='fo-wm'>" +
        "<div class='fo-wm-mast'>" +
        "<div class='fo-wm-kick'>Season " + season + " World Cup &middot; " + E(stageName(st)) + "</div>" +
        "<h1>" + E(m.a.nm) + " v " + E(m.b.nm) + "</h1>" +
        "<p>" + E(m.winner.nm) + " through &middot; " + E(m.hs) + " plays " + E(m.as) + "</p>" +
        "</div>" +
        innBlock(m.a.nm, m.a.rid, sa, pf.a, m.winner === m.a) +
        bowlBlock("With the ball for " + m.b.nm, pf.a.bowls) +
        innBlock(m.b.nm, m.b.rid, sb, pf.b, m.winner === m.b) +
        bowlBlock("With the ball for " + m.a.nm, pf.b.bowls) +
        "<div class='fo-wm-foot'><a href='#/planet'>The bracket &rsaquo;</a><a href='#/almanack'>The almanack &rsaquo;</a></div>" +
        "</div>";
    } catch (e) { try { console.warn("foRenderWcMatchPage", e); } catch (e2) {} }
  }

  var CSS = [
    "html body #page .fo-star,html body #page .fo-wm{max-width:680px;margin:26px auto 44px;padding:0 14px;color:#141C28}",
    "html body #page .fo-star-mast,html body #page .fo-wm-mast{background:linear-gradient(150deg,#FFFEFB,#F6F1E4 70%,#F0E9D6) !important;border:1px solid rgba(20,28,40,.1);border-radius:22px;padding:24px 26px 20px;box-shadow:0 22px 50px rgba(30,38,52,.12)}",
    "html body #page .fo-star-kick,html body #page .fo-wm-kick{display:flex;align-items:center;gap:7px;font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:#B44A22}",
    "html body #page .fo-star-kick img{width:22px;height:15px;object-fit:cover;border-radius:2px}",
    "html body #page .fo-star-mast h1,html body #page .fo-wm-mast h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:32px;letter-spacing:-.015em;margin:8px 0 6px;line-height:1.05}",
    "html body #page .fo-star-mast p,html body #page .fo-wm-mast p{font:420 13px/1.55 Fraunces,Georgia,serif;color:rgba(20,28,40,.6);margin:0}",
    "html body #page .fo-star-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}",
    "html body #page .fo-star-chips span{font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#8A6606;background:rgba(176,132,9,.12);border-radius:999px;padding:7px 11px}",
    "html body #page .fo-star-sec{margin-top:16px;background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:18px;padding:16px 18px;box-shadow:0 8px 26px rgba(30,38,52,.07)}",
    "html body #page .fo-star-sec h2{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:17px;margin:0 0 10px}",
    "html body #page .fo-star-row{display:grid;grid-template-columns:36px 1fr 1fr 1fr 1fr;gap:6px;align-items:baseline;padding:8px 0;border-top:1px solid rgba(20,28,40,.06);font:500 12.5px/1.2 Inter,sans-serif}",
    "html body #page .fo-star-row i{font:700 10px/1 Oswald,sans-serif;letter-spacing:.08em;color:rgba(20,28,40,.5);font-style:normal}",
    "html body #page .fo-star-row em{font-style:normal;font-variant-numeric:tabular-nums}",
    "html body #page .fo-star-row.hd{border-top:0;padding:0 0 2px;font:700 9px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.45)}",
    "html body #page .fo-star-row.tot{border-top:2px solid rgba(20,28,40,.14);font-weight:700}",
    "html body #page .fo-star-foot,html body #page .fo-wm-foot{display:flex;gap:10px;justify-content:space-between;margin-top:18px;flex-wrap:wrap}",
    "html body #page .fo-star-foot a,html body #page .fo-wm-foot a{font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
    "html body #page .fo-star-foot a:hover,html body #page .fo-wm-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5);text-decoration:none}",
    "html body #page .fo-wm-inn{margin-top:16px;background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:18px;padding:16px 18px;box-shadow:0 8px 26px rgba(30,38,52,.07)}",
    "html body #page .fo-wm-inn.win{border-left:3px solid #C95532}",
    "html body #page .fo-wm-innh{display:flex;align-items:center;gap:9px}",
    "html body #page .fo-wm-innh img{width:26px;height:18px;object-fit:cover;border-radius:3px}",
    "html body #page .fo-wm-innh b{flex:1;font:600 15px/1.2 Inter,sans-serif}",
    "html body #page .fo-wm-innh u{text-decoration:none;font-family:Inter,sans-serif;font-weight:700;font-size:19px;font-variant-numeric:tabular-nums}",
    "html body #page .fo-wm-cps{display:flex;gap:6px;margin-top:12px;overflow-x:auto;padding-bottom:2px}",
    "html body #page .fo-wm-cps span{flex:none;background:#F6F1E4;border-radius:10px;padding:7px 10px;text-align:center}",
    "html body #page .fo-wm-cps i{display:block;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:rgba(20,28,40,.45);font-style:normal}",
    "html body #page .fo-wm-cps b{display:block;font:700 12.5px/1 Inter,sans-serif;margin-top:4px;font-variant-numeric:tabular-nums}",
    "html body #page .fo-wm-perf{margin-top:10px}",
    "html body #page .fo-wm-perf div{display:flex;justify-content:space-between;font:500 12.5px/1.3 Inter,sans-serif;padding:5px 0;border-top:1px solid rgba(20,28,40,.06)}",
    "html body #page .fo-wm-perf u{text-decoration:none;font-weight:700;font-variant-numeric:tabular-nums}",
    "html body #page .fo-wm-bowl{margin-top:8px;padding:0 4px;font:400 11.5px/1.5 Inter,sans-serif;color:rgba(20,28,40,.6)}",
    "html body #page .fo-wm-bowl i{font:700 9px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;font-style:normal;margin-right:8px;color:#B44A22}",
    "html body #page .fo-wm-bowl span{margin-right:12px;white-space:nowrap}",
    "@media(max-width:520px){html body #page .fo-star-mast h1,html body #page .fo-wm-mast h1{font-size:26px}}"
  ].join("\n");
  function mount() {
    try {
      var s = document.getElementById("fo-star-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-star-css"; s.textContent = CSS; }
      document.body.appendChild(s);
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); });
  else setTimeout(mount, 0);
  window.addEventListener("hashchange", function () {
    var h = (location.hash || "").split("?")[0];
    if (h === "#/star") setTimeout(foRenderStarPage, 40);
    if (h === "#/wcmatch") setTimeout(foRenderWcMatchPage, 40);
  });
  window.foRenderStarPage = foRenderStarPage;
  window.foRenderWcMatchPage = foRenderWcMatchPage;
})();
