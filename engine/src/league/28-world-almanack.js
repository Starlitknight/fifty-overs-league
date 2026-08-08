// ---- 28-world-almanack.js — the people of the planet, and its book of record --
// The living planet (module 27) gave every nation a running league. This layer
// gives those leagues PEOPLE: every world club carries a real, deterministic
// squad (drawn by the same generator that builds circuit sides, so an
// Afghan club fields Afghan names bowling Afghan cricket), and every result
// now knows who made the runs and who took the wickets.
//
// On top of the people, two institutions:
//   THE WORLD ALMANACK (#/almanack) - the planet's book of record: all-time
//     records, the roll of champions season by season, and the current
//     season's leading run-scorers and wicket-takers.
//   THE WINTER WINDOW - between the last league round and the next season
//     (days 15-21 of each cycle), six world stars are open to a cross-border
//     move. You may sign ONE per season, for real money, into your real squad.
//
// Same law as the rest of the planet: performances, records, leaders and the
// market listing are pure functions of (world calendar, seeds). Only the act
// of SIGNING touches state - and it touches only YOUR club, like any other
// transfer, so offline managers lose nothing.
(function () {
  "use strict";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function h32(s) { var h = 2166136261 >>> 0; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rnd01(s) { return h32(s) / 4294967296; }
  function P() { return window.__foPlanet || null; }
  function cx() { return window.__foCxAPI || null; }
  function fmtMoney(n) { return "$" + Math.round(n || 0).toLocaleString("en-US"); }
  function shortName(nm) { var ps = String(nm || "").split(" "); return ps.length < 2 ? nm : ps[0].charAt(0) + ". " + ps[ps.length - 1]; }
  function myNation() { try { return (window.__foLgAPI && window.__foLgAPI.nation()) || "eng"; } catch (e) { return "eng"; } }
  function regionList() { var c = cx(); return c ? (c.regions() || []).filter(function (r) { return !r.final; }) : []; }
  function regionById(rid) { var L = regionList(); for (var i = 0; i < L.length; i++) if (L[i].id === rid) return L[i]; return null; }
  function genFn() { try { if (typeof window.__foGenArchetypeSquad === "function") return window.__foGenArchetypeSquad; } catch (e) {} try { if (typeof foGenArchetypeSquad === "function") return foGenArchetypeSquad; } catch (e2) {} return null; }
  function ovrOf(p) { try { if (typeof foPkOvr === "function") return foPkOvr(p); } catch (e) {} return (p && p.rating ? Math.round(p.rating / 1000) : 50); }

  // ---- every world club, fully peopled - in GENERATIONS ----------------------
  // A world career lasts one era (three seasons). Each club's clock is
  // staggered, so every off-season a third of the planet's dressing rooms
  // turn over: the almanack's leaders retire, and new names rise. Past
  // seasons keep their past people - a record set in season 2 belongs to
  // season 2's generation forever.
  var ERA_LEN = 3;
  // every season number this page prints continues the record rather than
  // starting a second count at one
  function sNo2(n) {
    try { var P9 = P(); return (P9 && P9.seasonNo) ? P9.seasonNo(n) : n; } catch (e) { return n; }
  }
  function eraOf(rid, slot, season) { return Math.floor((Math.max(1, season) - 1 + (h32("stag|" + rid + "|" + slot) % ERA_LEN)) / ERA_LEN); }
  var SQ = {};
  function squadOf(rid, slot, season) {
    var era = eraOf(rid, slot, season || 1);
    var k = rid + "|" + slot + "|e" + era;
    if (SQ[k]) return SQ[k];
    var r = regionById(rid); if (!r) return (SQ[k] = null);
    var out = null;
    var yearsIn = (Math.max(1, season || 1) - 1 + (h32("stag|" + rid + "|" + slot) % ERA_LEN)) % ERA_LEN;
    try {
      var GEN = genFn();
      if (GEN) {
        var g = GEN("ws2|" + rid + "|" + slot + "|e" + era, r.cty || r.nm, r.arch || "engine", "general");
        out = (g && g.players || []).map(function (p0) {
          var p = JSON.parse(JSON.stringify(p0)); delete p.fee;
          p.fatigue = "rested"; p.formIx = 3;
          if (p.age) p.age = Math.min(40, p.age + yearsIn);
          try { if (typeof jsDerive === "function") jsDerive(p); } catch (eD) {}
          return p;
        });
      }
    } catch (eG) {}
    if (!out || !out.length) {
      // name-only fallback: still nation-true names, still deterministic
      out = [];
      try {
        var seed = h32("wsf|" + rid + "|" + slot + "|e" + era), used = new Set();
        var rr = function () { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        for (var i = 0; i < 8; i++) {
          var nm = (typeof natName === "function") ? natName(r.cty || "England", rr, used) : (r.nm + " Player " + (i + 1));
          used.add(nm);
          out.push({ name: nm, role: i < 5 ? "topOrderBat" : "fastBowler", bowlType: i < 5 ? null : "RF", rating: 40000 + Math.floor(rr() * 30000) });
        }
      } catch (eF) {}
    }
    return (SQ[k] = out);
  }
  function batsOf(rid, slot, season) {
    var s = squadOf(rid, slot, season) || [];
    return s.slice().sort(function (a, b) { return ovrOf(b) - ovrOf(a); }).slice(0, 5);
  }
  function bowlsOf(rid, slot, season) {
    var s = (squadOf(rid, slot, season) || []).filter(function (p) { return p.bowlType; });
    return s.slice().sort(function (a, b) { return ovrOf(b) - ovrOf(a); }).slice(0, 5);
  }
  // the off-season's farewells: clubs whose era turns over lose their best
  function retirees(season) {
    var out = [], my = myNation();
    regionList().forEach(function (r) {
      if (r.id === my) return;
      for (var slot = 0; slot < 10; slot++) {
        if (eraOf(r.id, slot, season + 1) === eraOf(r.id, slot, season)) continue;
        var best = batsOf(r.id, slot, season)[0];
        var sides = P() ? P().sidesOf(r.id) : [];
        if (best && sides[slot]) out.push({ name: best.name, club: sides[slot].name, nat: r.nm, h: h32("ret|" + season + "|" + best.name) });
      }
    });
    return out.sort(function (a, b) { return a.h - b.h; }).slice(0, 5);
  }

  // ---- who did it: deterministic performances for any world match ------------
  function perf(rid, season, round, m) {
    var key = "pf|" + rid + "|" + season + "|" + round + "|" + m.home.slot + "|" + m.away.slot;
    var pick = function (list, tag) { return list.length ? list[Math.floor(Math.pow(rnd01(key + tag), 1.6) * list.length)] : null; };
    var mk = function (batSide, bowlSide, total, wkts, tag) {
      var bat = pick(batsOf(rid, batSide.slot, season), tag + "b");
      var bowl = pick(bowlsOf(rid, bowlSide.slot, season), tag + "w");
      var runs = Math.max(16, Math.min(186, Math.round(total * (0.24 + rnd01(key + tag + "r") * 0.27))));
      if (runs > total) runs = Math.max(10, total - 4);
      var w = Math.max(1, Math.min(wkts >= 10 ? 6 : Math.max(1, wkts - 1), 2 + Math.floor(rnd01(key + tag + "k") * 4)));
      var rc = 18 + Math.floor(rnd01(key + tag + "c") * 45);
      return { bat: bat ? { n: bat.name, r: runs, p: bat } : null, bowl: bowl ? { n: bowl.name, w: w, rc: rc, p: bowl } : null };
    };
    return { h: mk(m.home, m.away, m.first, m.fw, "h"), a: mk(m.away, m.home, m.second, m.sw, "a") };
  }
  // " — H. Cole 87, T. Ashworth 4/38" for the winning side
  function suffix(rid, season, round, m) {
    try {
      var pf = perf(rid, season, round, m);
      var side = m.winner === m.away ? pf.a : pf.h, other = m.winner === m.away ? pf.h : pf.a;
      var bits = [];
      if (side.bat) bits.push(shortName(side.bat.n) + " " + side.bat.r);
      if (other.bowl && m.winner) { } // the loser's bowler toiled; the winner's bowler gets the line
      if (side.bowl) bits.push(shortName(side.bowl.n) + " " + side.bowl.w + "/" + side.bowl.rc);
      return bits.length ? " — " + bits.join(", ") : "";
    } catch (e) { return ""; }
  }

  // ---- the aggregates: leaders and all-time records (cached per world tick) --
  var CACHE = {};
  function sweep(now) {
    var pl = P(); if (!pl) return null;
    var p = pl.phaseOf(now), my = myNation();
    var rd = pl.roundsDone(now, p.season);
    var sig = p.season + "|" + rd + "|" + my + "|" + ((App && App.results && App.results.length) || 0);
    if (CACHE.sig === sig) return CACHE.v;
    var bySeason = {}, rec = {
      total: null, margin: null, chase: null, indBat: null, indBowl: null
    };
    var agg = function (s) { return bySeason[s] || (bySeason[s] = { runs: {}, wkts: {} }); };
    var note = function (map, k, add, meta) { var e = map[k] || (map[k] = { n: 0, meta: meta }); e.n += add; };
    for (var s = 1; s <= p.season; s++) {
      var WR = pl.ROUNDS || 18;
      var upto = s < p.season ? WR : pl.roundsDone(now, s, null);
      regionList().forEach(function (r) {
        if (r.id === my) return;
        for (var rr = 1; rr <= (s < p.season ? WR : pl.roundsDone(now, s, r.id)); rr++) {
          pl.fixturesOf(r.id, s, rr).forEach(function (m) {
            if (!rec.total || m.first > rec.total.v) rec.total = { v: m.first, line: m.home.name + " " + m.hs + " v " + m.away.name, where: r.nm + ", Season " + sNo2(s) };
            if (m.winner === m.home && (!rec.margin || (m.first - m.second) > rec.margin.v)) rec.margin = { v: m.first - m.second, line: m.text + " (" + m.hs + " v " + m.as + ")", where: r.nm + ", Season " + sNo2(s) };
            if (m.winner === m.away && (!rec.chase || m.second > rec.chase.v)) rec.chase = { v: m.second, line: m.away.name + " chase " + (m.first + 1) + " — " + m.as, where: r.nm + ", Season " + sNo2(s) };
            var pfx = perf(r.id, s, rr, m);
            [["h", m.home], ["a", m.away]].forEach(function (side) {
              var x = pfx[side[0]];
              // keyed by player AND club, so two same-named men in different
              // dressing rooms never pool their tallies
              if (x.bat) note(agg(s).runs, x.bat.n + "|" + r.id + "|" + side[1].slot, x.bat.r, { club: side[1].name, nat: r.nm, rid: r.id, slot: side[1].slot, nm: x.bat.n });
              if (x.bowl) note(agg(s).wkts, x.bowl.n + "|" + r.id + "|" + side[1].slot, x.bowl.w, { club: side[1].name, nat: r.nm, rid: r.id, slot: side[1].slot, nm: x.bowl.n });
              if (x.bat && (!rec.indBat || x.bat.r > rec.indBat.v)) rec.indBat = { v: x.bat.r, line: x.bat.n + " " + x.bat.r + " for " + side[1].name, where: r.nm + ", Season " + sNo2(s) };
              if (x.bowl && (!rec.indBowl || x.bowl.w > rec.indBowl.v || (x.bowl.w === rec.indBowl.v && x.bowl.rc < rec.indBowl.rc))) rec.indBowl = { v: x.bowl.w, rc: x.bowl.rc, line: x.bowl.n + " " + x.bowl.w + "/" + x.bowl.rc + " for " + side[1].name, where: r.nm + ", Season " + sNo2(s) };
            });
          });
        }
      });
    }
    var top = function (map) {
      return Object.keys(map).map(function (k) { return { n: (map[k].meta && map[k].meta.nm) || k, v: map[k].n, meta: map[k].meta }; })
        .sort(function (a, b) { return b.v - a.v; }).slice(0, 6);
    };
    // THE ROLL OPENS WITH THE RECORD, not with this week. The almanack called
    // itself "everything that has ever happened" and began at Season 1 of a
    // world that has a hundred and thirty-six seasons behind it. The history
    // is read from the same derivation the club pages and the record room use,
    // so a champion named here is the champion named there.
    var roll = [];
    try {
      if (pl.histSeasons && pl.histYear && pl.seasonOne) {
        var hN = pl.histSeasons(), yr0 = pl.seasonOne();
        for (var hs = Math.max(1, hN - 11); hs <= hN; hs++) {
          var yr = yr0 + hs - 1, hch = [];
          regionList().forEach(function (r) {
            var hy = pl.histYear(r.id, yr); if (!hy) return;
            var sd = pl.sidesOf(r.id) || [], nm9 = "";
            for (var q = 0; q < sd.length; q++) if ((sd[q].slot | 0) === (hy.champion | 0)) nm9 = sd[q].name;
            if (nm9) hch.push({ nat: r.nm, club: nm9 });
          });
          var cr9 = pl.crownYear ? pl.crownYear(yr) : null, wc9 = pl.wcYear ? pl.wcYear(yr) : null;
          roll.push({ season: hs, no: hs, past: true, champs: hch,
                      wc: wc9 ? { nm: wc9.name } : null,
                      crown: cr9 ? regionById(cr9.rid) : null, live: false });
        }
      }
    } catch (eH9) {}
    for (var s2 = 1; s2 <= p.season; s2++) {
      var done = s2 < p.season || p.di >= (pl.ROUNDS || 18);
      var champs = [];
      if (done) regionList().forEach(function (r) { if (r.id === my) return; var c = pl.championOf(r.id, s2); if (c) champs.push({ nat: r.nm, club: c.name }); });
      var wcDone = s2 < p.season || pl.wcStagesDone(now, s2) >= 4;
      roll.push({ season: s2, no: sNo2(s2), wc: wcDone ? pl.wcChampion(s2) : null, champs: champs, live: s2 === p.season && !done });
    }
    // YOUR league is the twentieth nation: when one of your real matches
    // outdoes the planet, the record book bows to it - marked in gold
    try {
      var myReg = regionById(my);
      var myLeague = ((myReg && myReg.nm) || "Your nation") + " · your league";
      (typeof App !== "undefined" && App && App.results ? App.results : []).forEach(function (r0) {
        if (!r0 || r0.comp !== "league" || !r0.innings) return;
        var sn = r0.seasonNo != null ? ", Season " + sNo2(r0.seasonNo) : "";
        r0.innings.forEach(function (inn) {
          if (!inn) return;
          if (rec.total && (inn.runs | 0) > rec.total.v) rec.total = { v: inn.runs | 0, line: inn.batTeam + " " + inn.runs + (inn.wkts >= 10 ? " all out" : "/" + inn.wkts) + " v " + (inn.bowlTeam || ""), where: myLeague + sn, mine: true };
          (inn.bat || []).forEach(function (b2) {
            if (rec.indBat && (+b2.r || 0) > rec.indBat.v) rec.indBat = { v: +b2.r, line: b2.p + " " + b2.r + " for " + inn.batTeam, where: myLeague + sn, mine: true };
          });
          var bw = inn.bowlers || {};
          Object.keys(bw).forEach(function (nm2) {
            var e2 = bw[nm2] || {}, w2 = +e2.w || 0;
            if (rec.indBowl && (w2 > rec.indBowl.v || (w2 === rec.indBowl.v && (+e2.r || 999) < rec.indBowl.rc))) rec.indBowl = { v: w2, rc: +e2.r || 0, line: nm2 + " " + w2 + "/" + (+e2.r || 0) + " for " + inn.bowlTeam, where: myLeague + sn, mine: true };
          });
        });
      });
    } catch (eMy) {}

    // the World XI of a completed season: six batters and five bowlers who
    // owned it, picked purely from the season's own aggregates
    var xiOf = function (s3) {
      var a = bySeason[s3]; if (!a) return null;
      var bats = top(a.runs), bowls = top(a.wkts).slice(0, 5);
      if (bats.length < 4 || bowls.length < 3) return null;
      return { season: s3, bats: bats.slice(0, 6), bowls: bowls };
    };
    var xiSeason = (p.di >= (pl.ROUNDS || 18) ? p.season : p.season - 1);
    var cur = agg(p.season);
    // THE ALL-TIME LISTS. The panels for these have been on the page since it
    // was built and have never had a name in them, because nothing kept a
    // career. The record does now: every figure below is the sum of seasons a
    // reader can walk one at a time in the Stats Centre.
    var allBat = [], allBowl = [];
    try {
      var cw = pl.careerWorld ? pl.careerWorld() : [];
      allBat = cw.filter(function (c) { return c.inns >= 30; })
        .sort(function (a, b) { return b.runs - a.runs; }).slice(0, 8);
      allBowl = cw.filter(function (c) { return c.wkts >= 30; })
        .sort(function (a, b) { return b.wkts - a.wkts; }).slice(0, 8);
    } catch (eAT) {}
    var v = { phase: p, rd: rd, runs: top(cur.runs), wkts: top(cur.wkts), rec: rec, roll: roll.reverse(),
              allBat: allBat, allBowl: allBowl, xi: xiSeason >= 1 ? xiOf(xiSeason) : null };
    CACHE.sig = sig; CACHE.v = v;
    return v;
  }

  // ---- the winter window: six stars, one signing, your money -----------------
  // the winter window opens when the league is done - the closing week
  function windowOpen(p) { try { return p.di >= (P().LEAGUE_DAYS || 24); } catch (e) { return p.di >= 24; } }
  function marketOf(season) {
    var rids = regionList().map(function (r) { return r.id; }).filter(function (rid) { return rid !== myNation(); });
    rids.sort(function (a, b) { return rnd01("mkt|" + season + "|" + a) - rnd01("mkt|" + season + "|" + b); });
    var out = [];
    rids.slice(0, 6).forEach(function (rid, i) {
      var slot = h32("mktslot|" + season + "|" + rid) % 10;
      var sides = P().sidesOf(rid); if (!sides.length) return;
      var sq = squadOf(rid, slot, season); if (!sq || !sq.length) return;
      var star = sq.slice().sort(function (a, b) { return ovrOf(b) - ovrOf(a); })[0];
      var ovr = ovrOf(star);
      out.push({ rid: rid, nat: (regionById(rid) || {}).nm, club: sides[slot].name, p: star, ovr: ovr, fee: 6000 + ovr * 380 });
    });
    return out;
  }
  function signedThisSeason(season) { try { return App.wmkt && App.wmkt["s" + season]; } catch (e) { return null; } }
  // no dialogs: a refusal is said beside the button that asked, and the
  // signing itself is agreed on the row it is offered from
  function signSay(el, m) {
    if (window.foSayAt) { window.foSayAt(el, m, "error"); return; }
    try { console.warn("[fifty-overs] " + m); } catch (e) {}
  }
  function signStar(season, idx, el) {
    try {
      var p = P().phaseOf(Date.now());
      if (p.season !== season || !windowOpen(p)) { signSay(el, "The window is closed."); return; }
      if (signedThisSeason(season)) { signSay(el, "One overseas signing per season - you have already made yours."); return; }
      var lst = marketOf(season), item = lst[idx]; if (!item) return;
      var t = userTeam();
      if (t.players.some(function (q) { return q.name === item.p.name; })) { signSay(el, item.p.name + " is already at your club."); return; }
      if (!App.fin || App.fin.bank < item.fee) { signSay(el, "The board will not sanction it - you need " + fmtMoney(item.fee) + "."); return; }
      if (el && window.foDecide) {
        window.foDecide(el, {
          q: "Sign " + item.p.name + " (" + item.nat + ") from " + item.club + "?",
          note: "The fee is " + fmtMoney(item.fee) + ", and it is your one overseas signing this season.",
          ok: "Sign him", cancel: "Not this one",
          onYes: function () { signStarDo(season, item); }
        });
        return;
      }
      signStarDo(season, item);
    } catch (e) { try { console.warn("signStar", e); } catch (e2) {} }
  }
  function signStarDo(season, item) {
    try {
      var t = userTeam();
      var np = JSON.parse(JSON.stringify(item.p));
      np.fatigue = "rested"; np.formIx = 3;
      try { if (typeof jsDerive === "function") jsDerive(np); } catch (eD) {}
      t.players.push(np);
      ledger("World market - signed " + np.name + " from " + item.club, -item.fee);
      App.wmkt = App.wmkt || {}; App.wmkt["s" + season] = np.name;
      try { saveGame(false); } catch (eS) {}
      var pg = document.getElementById("page"); if (pg) pg.__foAlmSig = null;
      foRenderAlmanackPage();
    } catch (e) { try { console.warn("signStar", e); } catch (e2) {} }
  }

  // ---- the page ---------------------------------------------------------------
  function artBase() {
    if (typeof FO_ART !== "undefined") return FO_ART;
    return (location.pathname.indexOf("/client/") !== -1) ? "art/" : "client/art/";
  }
  function foRenderAlmanackPage() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/almanack") return;
      if (!P() || !cx()) return;
      var page = document.getElementById("page"); if (!page) return;
      try { document.body.classList.remove("fo-ov-on", "fo-boss-on", "fo-scb-on", "fo-drs-on"); } catch (eB) {}
      var now = Date.now();
      var v = sweep(now); if (!v) return;
      var p = v.phase;
      var flagOf = function (rid) { return artBase() + "flags/" + cx().flagFile(rid) + ".svg"; };
      var natRid = {}; regionList().forEach(function (r) { natRid[r.nm] = r.id; });

      var recRow = function (label, r) {
        return r ? "<div class='fo-al-rec" + (r.mine ? " mine" : "") + "'><i>" + label + (r.mine ? " &middot; yours" : "") + "</i><b>" + E(r.line) + "</b><span>" + E(r.where) + "</span></div>" : "";
      };
      var recHTML = recRow("Highest total", v.rec.total) + recRow("Biggest win", v.rec.margin) +
        recRow("Greatest chase", v.rec.chase) + recRow("Highest score", v.rec.indBat) + recRow("Best bowling", v.rec.indBowl);

      var ldr = function (list, unit, seasonQ) {
        return list.map(function (x, i) {
          var href = (x.meta && x.meta.rid != null)
            ? " href='#/star?r=" + encodeURIComponent(x.meta.rid) + "&sl=" + (x.meta.slot | 0) + "&s=" + seasonQ + "&n=" + encodeURIComponent(x.n) + "'" : "";
          var tag = href ? "a" : "div";
          return "<" + tag + " class='fo-al-ld'" + href + "><i>" + (i + 1) + "</i>" +
            (natRid[x.meta.nat] ? "<img src='" + flagOf(natRid[x.meta.nat]) + "' alt=''>" : "") +
            "<span><b>" + E(x.n) + "</b><em>" + E(x.meta.club) + " &middot; " + E(x.meta.nat) + "</em></span><u>" + x.v + unit + "</u></" + tag + ">";
        }).join("") || "<p class='fo-al-none'>The season's first ball is yet to be bowled.</p>";
      };

      var rollHTML = v.roll.map(function (rw) {
        var champBits = rw.champs.slice(0, 3).map(function (c) { return E(c.club) + " (" + E(c.nat) + ")"; }).join(", ");
        return "<div class='fo-al-roll" + (rw.past ? " past" : "") + "'><i>Season " + (rw.no || rw.season) + "</i>" +
          (rw.live ? "<b class='live'>In play &middot; round " + v.rd + " of " + ((P() && P().ROUNDS) || 18) + "</b>" :
            // BOTH TROPHIES, when both were won. The World Cup comes round
            // every fourth season and the Champions Cup every one, so showing
            // only the first found hid a club competition in the very seasons
            // that had the most cricket in them.
            "<b>" + (function () {
              var bits = [];
              if (rw.wc) bits.push("&#127942; " + E(rw.wc.nm) + " won the World Cup");
              if (rw.crown) bits.push("&#127942; " + E(rw.crown.nm) + " took the Champions Cup");
              return bits.length ? bits.join(" &middot; ")
                : rw.past ? "No world tournament that season" : "World Cup to come";
            })() + "</b>") +
          (champBits ? "<span>League pennants: " + champBits + (rw.champs.length > 3 ? " &amp; " + (rw.champs.length - 3) + " more" : "") + "</span>" : "") +
          "</div>";
      }).join("");

      // the all-time books, off the whole planet's record
      var natNm9 = {}; try { regionList().forEach(function (r) { natNm9[r.id] = r.nm; }); } catch (eNN) {}
      /* THE LEDGER. The almanack's job is that you can look something up, so
         the all-time lists are a ruled table that fits a phone whole rather
         than a stack of cards that runs off the side of it. The country is a
         FLAG, not a word: "South Africa" is thirteen characters of column
         width spent on something a two-centimetre picture says instantly, and
         with the word gone the name, the span and the figures all fit. */
      var shortName = function (n) {
        var a = String(n || "").trim().split(/\s+/);
        return a.length < 2 ? n : a[0].charAt(0) + ". " + a.slice(1).join(" ");
      };
      var ldgRow = function (x, i, isBat) {
        var span = "";
        try { span = "S" + P().sIdx(x.from) + "\u2013S" + P().sIdx(x.to); } catch (eSp) {}
        var ave = isBat
          ? ((x.inns - x.no) > 0 ? (x.runs / (x.inns - x.no)).toFixed(1) : "\u2014")
          : (x.wkts ? (x.rc / x.wkts).toFixed(1) : "\u2014");
        var best = isBat ? (x.hs + (x.hsNo ? "*" : "")) : (x.bbW ? x.bbW + "/" + x.bbR : "\u2014");
        return "<tr onclick=\"location.hash='#/stats?v=career&n=" + E(x.rid) +
          "&b=" + (isBat ? "bat" : "bowl") + "&sc=world'\">" +
          "<td class='rk'>" + (i + 1) + "</td>" +
          "<td class='who'><div class='wr'><img src='" + flagOf(x.rid) + "' alt='" + E(natNm9[x.rid] || "") +
            "' title='" + E(natNm9[x.rid] || "") + "'>" +
            "<span><b>" + E(shortName(x.name)) + "</b><em>" + span + "</em></span></div></td>" +
          "<td class='big'>" + (isBat ? x.runs.toLocaleString() : x.wkts) + "</td>" +
          "<td>" + ave + "</td><td>" + best + "</td></tr>";
      };
      var ldg = function (title, rows, isBat) {
        if (!rows.length) return "<div class='fo-al-sec'><h2>" + title +
          "</h2><p class='fo-al-none'>The record is still being read.</p></div>";
        return "<div class='fo-al-sec'><h2>" + title + "</h2>" +
          "<table class='fo-al-ldg'><thead><tr><th class='rk'>#</th><th>" +
          (isBat ? "Batsman" : "Bowler") + "</th><th>" + (isBat ? "Runs" : "Wkts") +
          "</th><th>Ave</th><th>" + (isBat ? "HS" : "BB") + "</th></tr></thead><tbody>" +
          rows.map(function (x, i) { return ldgRow(x, i, isBat); }).join("") + "</tbody></table>" +
          "<a class='fo-al-more' href='#/stats?v=career&sc=world&b=" + (isBat ? "bat" : "bowl") +
          "'>The whole book &rsaquo;</a></div>";
      };
      var allTimeHTML = ldg("All-time run scorers", v.allBat, true) +
                        ldg("All-time wicket takers", v.allBowl, false);

      // the winter window
      var mktHTML = "";
      var open = windowOpen(p);
      var signed = signedThisSeason(p.season);
      var canGen = !!genFn();
      if (canGen) {
        var listings = marketOf(p.season);
        var body = listings.map(function (it, i) {
          var mine = signed === it.p.name;
          var btn = mine ? "<b class='got'>Signed &#10003;</b>" :
            !open ? "<b class='shut'>Window closed</b>" :
            signed ? "<b class='shut'>Quota used</b>" :
            "<button type='button' class='fo-al-sign' data-i='" + i + "'>Sign &middot; " + fmtMoney(it.fee) + "</button>";
          return "<div class='fo-al-mk" + (mine ? " mine" : "") + "'>" +
            "<img src='" + flagOf(it.rid) + "' alt=''>" +
            "<span><b>" + E(it.p.name) + "</b><em>" + E(it.club) + " &middot; " + E(it.nat) + " &middot; rated " + it.ovr + (it.p.age ? " &middot; age " + it.p.age : "") + "</em></span>" + btn + "</div>";
        }).join("");
        mktHTML = "<div class='fo-al-sec'><h2>The Winter Window</h2>" +
          "<p class='fo-al-sub'>" + (open ? "Open until the new season. One overseas signing per season - choose with care." :
            "Opens once the season's pennants are settled. Six names will be on the list.") + "</p>" +
          (open ? body : "") + "</div>";
      }

      var sig = "al|" + CACHE.sig + "|" + (signed || "") + "|" + open;
      if (page.__foAlmSig === sig && page.querySelector(".fo-al")) return;
      page.__foAlmSig = sig;

      page.innerHTML =
        "<div class='fo-al'>" +
        "<header class='fo-nvmast'>" +
        "<div class='k'>The book of record &middot; Season " + sNo2(p.season) + "</div>" +
        "<h1>The World Almanack</h1>" +
        "</header>" +
        "<div class='fo-al-sec'><h2>All-time records</h2>" + recHTML + "</div>" +
        "<div class='fo-al-sec cols'><div><h2>Most runs this season</h2>" + ldr(v.runs, "", p.season) + "</div>" +
        "<div><h2>Most wickets</h2>" + ldr(v.wkts, "", p.season) + "</div></div>" +
        (v.xi ? "<div class='fo-al-sec'><h2>World XI of Season " + sNo2(v.xi.season) + "</h2>" +
          ldr(v.xi.bats, " runs", v.xi.season) + ldr(v.xi.bowls, " wkts", v.xi.season) + "</div>" : "") +
        mktHTML +
        allTimeHTML +
        "<div class='fo-al-sec'><h2>The roll of champions</h2>" + rollHTML +
        "<p class='fo-al-none'><a href='#/stats?v=hist'>Walk every season in the record &rsaquo;</a></p></div>" +
        "<div class='fo-al-foot'><a href='#/planet'>World cricket today &rsaquo;</a><a href='#/league'>My league &rsaquo;</a><a href='#/milestones'>My honours &rsaquo;</a></div>" +
        "</div>";

      page.querySelectorAll(".fo-al-sign").forEach(function (b) {
        b.addEventListener("click", function () { signStar(p.season, +b.getAttribute("data-i"), b); });
      });
    } catch (e) { try { console.warn("foRenderAlmanackPage", e); } catch (e2) {} }
  }

  var CSS = [
    "html body #page .fo-al{max-width:680px;margin:26px auto 44px;padding:0 14px;color:#141C28}",
    "html body #page .fo-al-mast{background:linear-gradient(150deg,#FFFEFB,#F6F1E4 70%,#F0E9D6) !important;border:1px solid rgba(20,28,40,.1);border-radius:22px;padding:26px 28px 22px;box-shadow:0 22px 50px rgba(30,38,52,.12)}",
    "html body #page .fo-al-kick{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:#B44A22}",
    "html body #page .fo-al-kick:after{content:'';display:block;width:34px;border-top:2px solid #C95532;margin-top:7px}",
    "html body #page .fo-al-mast h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:36px;letter-spacing:-.015em;margin:8px 0 8px;line-height:1.02}",
    "html body #page .fo-al-mast p{font:420 13.5px/1.6 Fraunces,Georgia,serif;color:rgba(20,28,40,.6);margin:0;max-width:54ch}",
    "html body #page .fo-al-sec{margin-top:16px;background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:18px;padding:16px 18px;box-shadow:0 8px 26px rgba(30,38,52,.07)}",
    "html body #page .fo-al-sec h2{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:17px;margin:0 0 10px}",
    "html body #page .fo-al-sec.cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}",
    "@media(max-width:560px){html body #page .fo-al-sec.cols{grid-template-columns:1fr}}",
    "html body #page .fo-al-rec{padding:8px 0;border-top:1px solid rgba(20,28,40,.06)}",
    "html body #page .fo-al-rec.mine{background:linear-gradient(90deg,rgba(176,132,9,.1),rgba(176,132,9,0));border-radius:10px;padding:8px 10px}",
    "html body #page .fo-al-rec.mine i{color:#B08409}",
    /* ---- THE LEDGER: one ruled table that fits a phone whole ------------
       Fixed layout so the name column takes what is left and the four
       figure columns are never squeezed off the right-hand edge - which is
       exactly how the old card list failed. The flag stands in for the
       country: a picture in twenty-two pixels where the word wanted a
       hundred, and the row still says which nation at a glance. */
    "html body #page .fo-al-ldg{width:100%;table-layout:fixed;border-collapse:collapse;margin-top:4px;font-variant-numeric:tabular-nums}",
    "html body #page .fo-al-ldg th{padding:8px 3px;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.42);border-bottom:1px solid rgba(20,28,40,.5);text-align:right}",
    "html body #page .fo-al-ldg th:nth-child(2){text-align:left}",
    "html body #page .fo-al-ldg td{padding:9px 3px;border-bottom:1px solid rgba(20,28,40,.08);text-align:right;font:500 13px/1.35 Inter,system-ui,sans-serif;color:rgba(20,28,40,.72)}",
    "html body #page .fo-al-ldg tbody tr{cursor:pointer}",
    "html body #page .fo-al-ldg tbody tr:nth-child(odd) td{background:rgba(20,28,40,.022)}",
    "html body #page .fo-al-ldg tbody tr:hover td{background:rgba(201,85,47,.06)}",
    "html body #page .fo-al-ldg .rk{width:20px;text-align:right;color:rgba(20,28,40,.38);font-size:11.5px}",
    "html body #page .fo-al-ldg td.who{text-align:left;overflow:hidden}",
      "html body #page .fo-al-ldg td.who .wr{display:flex;align-items:center;gap:8px;min-width:0}",
    "html body #page .fo-al-ldg td.who img{width:22px;height:15px;flex:none;object-fit:cover;border-radius:2px;box-shadow:0 0 0 1px rgba(20,28,40,.14)}",
    "html body #page .fo-al-ldg td.who span{min-width:0}",
    "html body #page .fo-al-ldg td.who b{display:block;font:600 13.5px/1.2 Inter,system-ui,sans-serif;color:#141C28;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    "html body #page .fo-al-ldg td.who em{font-style:normal;font:400 10.5px/1.4 Inter,system-ui,sans-serif;color:rgba(20,28,40,.42);font-variant-numeric:tabular-nums}",
    "html body #page .fo-al-ldg td.big{font-weight:700;color:#141C28;width:52px}",
    "html body #page .fo-al-ldg th:nth-child(4),html body #page .fo-al-ldg td:nth-child(4){width:42px}",
    "html body #page .fo-al-ldg th:nth-child(5),html body #page .fo-al-ldg td:nth-child(5){width:48px}",
    "html body #page a.fo-al-more{display:inline-block;margin-top:11px;font:600 11.5px/1 Inter,system-ui,sans-serif;color:#B44A22 !important;text-decoration:none}",
    "html body #page a.fo-al-ld{text-decoration:none;color:#141C28}",
    "html body #page a.fo-al-ld:hover b{color:#B44A22}",
    "html body #page .fo-al-rec i{display:block;font:700 9px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#B44A22;font-style:normal}",
    "html body #page .fo-al-rec b{display:block;font:600 13px/1.35 Inter,sans-serif;margin-top:3px}",
    "html body #page .fo-al-rec span{display:block;font:400 11px/1.3 Fraunces,Georgia,serif;color:rgba(20,28,40,.5);margin-top:2px}",
    "html body #page .fo-al-ld{display:flex;align-items:center;gap:9px;padding:7px 0;border-top:1px solid rgba(20,28,40,.06)}",
    "html body #page .fo-al-ld i{font:700 11px/1 Inter,sans-serif;color:rgba(20,28,40,.4);font-style:normal;width:14px}",
    "html body #page .fo-al-ld img{width:22px;height:15px;object-fit:cover;border-radius:2px}",
    "html body #page .fo-al-ld span{flex:1;min-width:0}",
    "html body #page .fo-al-ld b{display:block;font:600 12.5px/1.2 Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "html body #page .fo-al-ld em{display:block;font:400 10.5px/1.2 Inter,sans-serif;font-style:normal;color:rgba(20,28,40,.5)}",
    "html body #page .fo-al-ld u{text-decoration:none;font-family:Inter,sans-serif;font-weight:700;font-size:15px;font-variant-numeric:tabular-nums}",
    "html body #page .fo-al-none{font:400 12px/1.4 Fraunces,Georgia,serif;color:rgba(20,28,40,.5)}",
    "html body #page .fo-al-roll{padding:9px 0;border-top:1px solid rgba(20,28,40,.06)}",
    "html body #page .fo-al-roll i{display:block;font:700 9px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(20,28,40,.45);font-style:normal}",
    "html body #page .fo-al-roll b{display:block;font:600 13px/1.3 Inter,sans-serif;margin-top:3px}",
    "html body #page .fo-al-roll b.live{color:#B44A22}",
    "html body #page .fo-al-roll span{display:block;font:400 11.5px/1.4 Fraunces,Georgia,serif;color:rgba(20,28,40,.55);margin-top:2px}",
    "html body #page .fo-al-sub{font:420 12.5px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.6);margin:0 0 10px}",
    "html body #page .fo-al-mk{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid rgba(20,28,40,.06)}",
    "html body #page .fo-al-mk.mine{background:rgba(31,158,114,.07);border-radius:10px;padding:9px 10px}",
    "html body #page .fo-al-mk img{width:24px;height:16px;object-fit:cover;border-radius:2px}",
    "html body #page .fo-al-mk span{flex:1;min-width:0}",
    "html body #page .fo-al-mk b{display:block;font:600 13px/1.2 Inter,sans-serif}",
    "html body #page .fo-al-mk em{display:block;font:400 11px/1.25 Inter,sans-serif;font-style:normal;color:rgba(20,28,40,.55);margin-top:2px}",
    "html body #page .fo-al-mk b.got{color:#177A57;font-size:11px}",
    "html body #page .fo-al-mk b.shut{color:rgba(20,28,40,.4);font-size:11px;font-weight:600}",
    "html body #page .fo-al-sign{font:700 11px/1 Inter,sans-serif;color:#FFFEFC;background:#C95532;border:0;border-radius:999px;padding:9px 14px;cursor:pointer}",
    "html body #page .fo-al-sign:hover{background:#B44A22}",
    "html body #page .fo-al-foot{display:flex;gap:10px;justify-content:space-between;margin-top:18px;flex-wrap:wrap}",
    "html body #page .fo-al-foot a{font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
    "html body #page .fo-al-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5);text-decoration:none}",
    "@media(max-width:520px){html body #page .fo-al-mast h1{font-size:29px}}"
  ].join("\n");
  function mount() {
    try {
      var s = document.getElementById("fo-al-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-al-css"; s.textContent = CSS; }
      document.body.appendChild(s);
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); });
  else setTimeout(mount, 0);
  window.addEventListener("hashchange", function () {
    if ((location.hash || "").split("?")[0] === "#/almanack") setTimeout(foRenderAlmanackPage, 40);
  });

  window.foRenderAlmanackPage = foRenderAlmanackPage;
  window.__foStars = { squadOf: squadOf, perf: perf, suffix: suffix, sweep: sweep, marketOf: marketOf, signStar: signStar, retirees: retirees, eraOf: eraOf };
})();
