// ---- 41-player-page.js — the player's own pages -----------------------------
// A cricketer is the smallest thing a manager gets attached to, and until now
// his page was a stack of tables under a trading card. This is his dossier
// instead: the painted card beside his name, the numbers a scout reads first,
// and four rooms - who he is, what he has done, what he is about to do, and
// what the training ground is making of him.
//
// The engine still renders #/player; this module runs after it, files what the
// engine and the chronicle produced into the rooms, and writes the rest. Two
// rules hold:
//   - a rival's raw skills stay in his own club's coaching book. Opponents get
//     the scout's summary - the same three numbers the club dossier shows.
//   - nothing here is invented. Every number is one the engine already keeps.
(function () {
  "use strict";
  if (window.__foPP2) return;
  window.__foPP2 = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function hashPath() { return (location.hash || "").split("?")[0]; }
  function onPage() { return hashPath() === "#/player"; }
  function qName() { var m = /[?&]n=([^&]+)/.exec(location.hash || ""); return m ? decodeURIComponent(m[1]) : ""; }
  // THE RED STAR. A man named in his country's current fifteen wears it
  // wherever his name is written - the same mark the squad room and the
  // teamsheets use, so an international is recognisable in every room.
  function natStar(name, rid, slot, big) {
    try {
      if (!window.foNatStar) return "";
      return window.foNatStar(name, slot == null ? null : slot, { rid: rid || undefined, big: !!big });
    } catch (e) { return ""; }
  }
  // which seat in the world this device holds - the address of your own club
  function worldClaim() {
    try { return window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); }
    catch (e) { return null; }
  }
  // AGE IN YEARS AND DAYS, because in this world a year IS a season - thirty
  // days - and a whole number hides most of what a manager wants to see. Two
  // men both "29" can be most of a season apart; a colt watching his birthday
  // come is worth looking at. The squad page has read ages this way since it
  // was rebuilt; the page a manager opens to study one cricketer should not be
  // the coarser of the two. __foAge is the squad module's own arithmetic - one
  // reckoning of a birthday for the whole game.
  function ageHTML(p) {
    try {
      var A = window.__foAge;
      if (A && A.parts) {
        var a = A.parts(p);
        return a.y + "<span class='fo-pp-ud'>y</span> " + a.d + "<span class='fo-pp-ud'>d</span>";
      }
    } catch (e) {}
    return String(p && (p.age | 0));
  }
  function ageTitle(p) {
    try { var A = window.__foAge; if (A && A.long) return E(A.long(p)); } catch (e) {}
    return "";
  }
  function ART() { try { return FO_ART; } catch (e) { return (location.pathname.indexOf("/client/") !== -1) ? "art/" : "client/art/"; } }
  function money(n) {
    if (window.foMoney) return window.foMoney(n);
    n = Math.round(n || 0); return "$" + (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K" : n);
  }
  function num(v) { return Math.max(0, Math.min(99, Math.round(v || 0))); }
  function h32(s) { var h = 2166136261 >>> 0; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function cap(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }

  function ovrOf(p) { try { return window.foPkOvr ? window.foPkOvr(p) : Math.round((p.rating || 0) / 1000); } catch (e) { return 0; } }
  function artOf(p) { try { return window.foPkArt ? (ART() + window.foPkArt(p)) : ""; } catch (e) { return ""; } }
  function agg(fn, p) { try { return Math.round(fn(p) || 0); } catch (e) { return 0; } }
  function skills(p) { try { return S(p) || {}; } catch (e) { return (p && p.skills) || {}; } }
  // the fallback derives from the same curve the world does, not from a fee
  // times 0.028 - a ratio that was true when both were straight lines
  function wageOf(p) {
    if (p && p.wage != null) return p.wage;
    try { if (window.foWageOf) return window.foWageOf((p && p.rating) || 25704, ((p && p.talents) || []).length, 1); } catch (e) {}
    return 9290;
  }
  function myClub() { try { return userTeam(); } catch (e) { return null; } }
  function isMine(name) {
    var t = myClub(); if (!t) return false;
    return (t.players || []).concat(t.youth || []).some(function (x) { return x.name === name; });
  }
  // the role words the rest of the game uses, without importing its closures
  var ROLE_LBL = { opener: "Opener", topOrder: "Top order", middle: "Middle order", middleOrder: "Middle order",
    finisher: "Finisher", allRounder: "All-rounder", allrounder: "All-rounder", wicketkeeper: "Wicketkeeper",
    keeper: "Wicketkeeper", seamer: "Seam bowler", spinner: "Spin bowler", bowler: "Bowler" };
  function roleLbl(p) {
    if (p.keeper || p.role === "wicketkeeper") return "Wicketkeeper";
    return ROLE_LBL[p.role] || cap(String(p.role || "Player").replace(/([A-Z])/g, " $1"));
  }
  function kindLbl(p) {
    if (p.keeper || p.role === "wicketkeeper") return "Wicketkeeper";
    if (p.role === "allRounder" || p.role === "allrounder") return "All-rounder";
    if (p.bowlType && !/does not bowl/i.test(p.btLabel || "")) return "Bowler";
    return "Batsman";
  }
  var ROLE_ICON = { bat: "bat.png", pace: "pace1.png", keeper: "keeper.png", finger: "spin-finger.png", wrist: "spin-wrist.png", ar: "ar.png" };
  function iconOf(p) {
    if (p.keeper || p.role === "wicketkeeper") return ROLE_ICON.keeper;
    if (p.role === "allRounder" || p.role === "allrounder") return ROLE_ICON.ar;
    var bt = String(p.bowlType || "").toLowerCase(), lb = String(p.btLabel || "").toLowerCase();
    if (/wrist|leg|chinaman/.test(bt + lb)) return ROLE_ICON.wrist;
    if (/spin|orthodox|finger|off/.test(bt + lb)) return ROLE_ICON.finger;
    if (bt && !/does not bowl/.test(lb)) return ROLE_ICON.pace;
    return ROLE_ICON.bat;
  }

  // ---- the numbers a scout reads first --------------------------------------
  function scoutRow(p) {
    return [
      ["Batting", agg(aggBat, p)],
      ["Bowling", (p.bowlType && !/does not bowl/i.test(p.btLabel || "")) ? agg(aggBowl, p) : 0],
      ["Fielding", (p.keeper || p.role === "wicketkeeper") ? agg(aggKeep, p) : agg(aggField, p)]
    ];
  }
  // THE SHAPE IS THE JOB. Batting and bowling belong on it - a shape without
  // them describes a cricketer you never picked - but a number nobody judges
  // him on is noise: a spinner's batting, an opener's keeping. Each kind of
  // cricketer shows what he is picked for, and the rest waits in the advanced
  // engine view, where nothing is ever hidden.
  function allFacets(p) {
    var bowls = !!(p.bowlType && !/does not bowl/i.test(p.btLabel || ""));
    return [["Batting", agg(aggBat, p)], ["Bowling", bowls ? agg(aggBowl, p) : 0],
      ["Technique", agg(aggTech, p)], ["Power", num(skills(p).power)], ["Endurance", agg(aggEnd, p)],
      ["Fielding", agg(aggField, p)], ["Keeping", agg(aggKeep, p)]];
  }
  function hiddenFacetNames(p) {
    var k = kindLbl(p);
    if (k === "Wicketkeeper") return ["Bowling"];
    if (k === "All-rounder") return ["Keeping"];
    if (k === "Bowler") return ["Batting", "Keeping"];
    return ["Bowling", "Keeping"];                       // a batter, pure and simple
  }
  function facets(p) {
    var drop = hiddenFacetNames(p);
    return allFacets(p).filter(function (f) { return drop.indexOf(f[0]) < 0; });
  }
  function restFacets(p) {
    var drop = hiddenFacetNames(p);
    return allFacets(p).filter(function (f) { return drop.indexOf(f[0]) >= 0; });
  }
  // tired legs, in words the dressing room uses and a colour anyone can read
  function fatOf(word) {
    var w = String(word || "fresh");
    var pct = /shatter|exhaust|spent/i.test(w) ? 82 : /tired|weary|heavy/i.test(w) ? 46
      : /little/i.test(w) ? 22 : 8;
    return { word: w, pct: pct, tone: pct >= 60 ? "hot" : pct >= 30 ? "warm" : "cool" };
  }

  // ---- the pentagon ---------------------------------------------------------
  function radar(vals) {
    var R = 62, cx = 78, cy = 74, n = vals.length;
    var pt = function (i, r) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [(cx + r * Math.cos(a)).toFixed(1), (cy + r * Math.sin(a)).toFixed(1)];
    };
    var ring = function (f) {
      return vals.map(function (_, i) { return pt(i, R * f).join(","); }).join(" ");
    };
    var web = [1, 0.66, 0.33].map(function (f) {
      return "<polygon points='" + ring(f) + "' fill='none' stroke='rgba(20,28,40,.14)' stroke-width='1'></polygon>";
    }).join("");
    var spokes = vals.map(function (_, i) {
      var q = pt(i, R); return "<line x1='" + cx + "' y1='" + cy + "' x2='" + q[0] + "' y2='" + q[1] + "' stroke='rgba(20,28,40,.1)'></line>";
    }).join("");
    var shape = vals.map(function (v, i) { return pt(i, R * Math.max(0.06, Math.min(1, (v[1] || 0) / 100))).join(","); }).join(" ");
    var dots = vals.map(function (v, i) {
      var q = pt(i, R * Math.max(0.06, Math.min(1, (v[1] || 0) / 100)));
      return "<circle cx='" + q[0] + "' cy='" + q[1] + "' r='2.6' fill='#8F6A1C'></circle>";
    }).join("");
    var labs = vals.map(function (v, i) {
      var q = pt(i, R + 15), a = -Math.PI / 2 + i * 2 * Math.PI / n;
      var anc = Math.abs(Math.cos(a)) < 0.3 ? "middle" : (Math.cos(a) > 0 ? "start" : "end");
      return "<text x='" + q[0] + "' y='" + (+q[1] + 3).toFixed(1) + "' text-anchor='" + anc + "' class='fo-pp-rlab'>" + E(v[0].toUpperCase()) + "</text>";
    }).join("");
    return "<svg class='fo-pp-radar' viewBox='-34 -10 224 172' role='img' aria-label='Skill shape'>" + web + spokes +
      "<polygon points='" + shape + "' fill='rgba(201,162,75,.28)' stroke='#8F6A1C' stroke-width='1.6'></polygon>" +
      dots + labs + "</svg>";
  }

  function bars(list) {
    return "<div class='fo-pp-bars'>" + list.map(function (b) {
      var v = num(b[1]);
      return "<div class='fo-pp-bar'><i>" + E(b[0].toUpperCase()) + "</i><u><b style='width:" + v + "%'></b></u><em>" + v + "</em></div>";
    }).join("") + "</div>";
  }

  // ---- the club's next day out ----------------------------------------------
  function nextFixtureFor(clubName) {
    try {
      var wt = window.__foWT, pl = window.__foPlanet;
      var nat = ""; try { nat = (window.__foLgAPI && window.__foLgAPI.nation && window.__foLgAPI.nation()) || ""; } catch (eN) {}
      if (wt && wt.serverFixtures && nat) {
        var sv = wt.serverFixtures(nat, Date.now());
        var hit = (sv.fx || []).filter(function (m) { return m.home.name === clubName || m.away.name === clubName; })[0];
        if (hit) {
          var home = hit.home.name === clubName;
          var hour = pl ? pl.natHour(nat) : 14;
          return { opp: home ? hit.away.name : hit.home.name, home: home, round: sv.cal.round,
            hour: (hour < 10 ? "0" : "") + hour + ":00 UTC", ground: home ? clubGround(clubName) : clubGround(hit.home.name) };
        }
      }
    } catch (e) {}
    // the local mirror, for a season the world service has not reached
    try {
      var S0 = App.season; if (!S0) return null;
      var rd = S0.schedule[S0.round] || [];
      for (var i = 0; i < rd.length; i++) {
        var a = GD.teams[rd[i][0]], b = GD.teams[rd[i][1]];
        if (!a || !b) continue;
        if (a.name === clubName) return { opp: b.name, home: true, round: S0.round + 1, hour: "", ground: a.ground };
        if (b.name === clubName) return { opp: a.name, home: false, round: S0.round + 1, hour: "", ground: a.ground };
      }
    } catch (e2) {}
    return null;
  }
  function clubGround(nm) {
    try {
      var t = (GD.teams || []).filter(function (x) { return x.name === nm; })[0];
      if (t && t.ground) return t.ground;
    } catch (e) {}
    return "";
  }

  // ---- the batting order he is down for -------------------------------------
  function xiSpot(p, team) {
    try {
      var mine = isMine(p.name);
      if (mine && App.orders && App.orders.batOrder && App.orders.batOrder.length) {
        var ix = App.orders.batOrder.indexOf(p.name);
        if (ix >= 0 && ix < 11) return { n: ix + 1, src: "your teamsheet" };
      }
    } catch (e) {}
    // no teamsheet yet: the squad's own order is the club's default XI
    try {
      var list = (team && team.players) || [];
      var ix2 = list.indexOf(p);
      if (ix2 >= 0 && ix2 < 11) return { n: ix2 + 1, src: "the club's usual order" };
    } catch (e2) {}
    return null;
  }

  // ---- form, fatigue and the mood of the man --------------------------------
  function condition(p) {
    var fatWord = String(p.fatWord || p.fatigue || "fresh");
    var fatPct = /shatter|exhaust|spent/i.test(fatWord) ? 82 : /tired|weary|heavy/i.test(fatWord) ? 46
      : /little/i.test(fatWord) ? 22 : 8;
    var formWord = String(p.formWord || "steady");
    var formPct = /superb|flying|red.hot|excellent/i.test(formWord) ? 92 : /good|strong/i.test(formWord) ? 74
      : /steady|fair/i.test(formWord) ? 58 : /shaky|poor|out of/i.test(formWord) ? 30 : 58;
    return { fatWord: fatWord, fatPct: fatPct, formWord: formWord, formPct: formPct, fitPct: 100 - fatPct };
  }

  // ---- the story so far ------------------------------------------------------
  function moments(p) {
    var out = [];
    try {
      (p._career || []).slice(0, 6).forEach(function (c) {
        var when = "Season " + c.s;
        try { var wd = window.foRoundDate ? window.foRoundDate(c.s, c.r) : null; if (wd && !/^S\d+ R\d+$/.test(wd)) when = wd; } catch (eW) {}
        out.push({ when: when, txt: c.txt, done: true });
      });
    } catch (e) {}
    return out;
  }
  function provLine(p, team) {
    var prov = p._prov, born = "";
    try { born = window.foHometown ? (" &middot; born in " + E(window.foHometown(p))) : ""; } catch (eH) {}
    var est = ""; try { est = window.foClubEst ? window.foClubEst(team) : ""; } catch (eE) {}
    var how = !prov ? "Founding squad"
      : prov.how === "market" ? "Signed from the transfer market"
      : prov.how === "youth" ? "An academy find" + (prov.nat ? " from " + E(prov.nat) : "")
      : "Draft-day original";
    return { how: how, born: born, signed: (prov && prov.r != null && window.foRoundDate) ? window.foRoundDate(prov.s, prov.r) : est };
  }

  // ---- the shell -------------------------------------------------------------
  // A CAP KEEPS ITS OWN BOOK. International runs never swell a club record, so
  // they were a four-figure footnote at the bottom of somebody else's page.
  // They get a page.
  // Talents sits second, not last: it is about the cricketer himself rather
  // than his record, and a sixth tab appended to this bar falls off the right
  // of a phone into a scroll nobody goes looking for.
  var TABS = [["overview", "Overview"], ["story", "Story"], ["talents", "Talents"], ["career", "Career"], ["country", "Country"], ["matches", "Matches"], ["dev", "Development"]];
  var TAB = "overview";
  var MINE_LAST = "";
  function qp(k) { var m = new RegExp("[?&]" + k + "=([^&]*)").exec(location.hash || ""); return m ? decodeURIComponent(m[1]) : ""; }

  // THE MATCH ON SCREEN KNOWS WHOSE MEN THESE ARE. The theatre records the
  // two clubs it is broadcasting; if the name belongs to either of them, the
  // world serves his card exactly as it would from a club page. Deep-linking
  // #/player?n=X into a cold tab still cannot know, which is what the ?c=/?s=
  // form is for - so this is a rescue, not a replacement.
  function fromTheatre(name) {
    var ctx = null; try { ctx = window.__foWtCtx; } catch (e) {}
    if (!ctx || !ctx.sides || !ctx.sides.length) return false;
    for (var i = 0; i < ctx.sides.length; i++) {
      var s = ctx.sides[i];
      var row = servedSquad(s.country, s.slot, function () { if (onPage()) build(); });
      if (row && (row.players || []).some(function (x) { return x && x.name === name; })) {
        buildCard(s.country, s.slot, name);
        return true;
      }
    }
    // still fetching: hold the page rather than printing a lie about him
    var pending = ctx.sides.some(function (s) {
      return !servedSquadFailed(s.country, s.slot) && !servedSquad(s.country, s.slot, function () { if (onPage()) build(); });
    });
    if (pending) {
      var pg = document.getElementById("page");
      if (pg) pg.innerHTML = "<div class='fo-pp'><div class='fo-pp-card'><h3>" + E(name) +
        "</h3><p class='fo-pp-dim'>Sending for his card&hellip;</p></div></div>";
      return true;
    }
    // THE WORLD IS OUT OF REACH, but the broadcast regenerates both squads
    // from their world seeds, so we still know exactly who he is and who he
    // plays for. Say that much rather than pretending he does not exist -
    // and do not invent a card, because his record lives with the service.
    for (var j = 0; j < ctx.sides.length; j++) {
      var side = ctx.sides[j], gen = null;
      try { gen = window.__foWT && window.__foWT.serverSquad(side.country, side.slot); } catch (eG) {}
      if (!gen || !gen.some(function (x) { return x && x.name === name; })) continue;
      var pg2 = document.getElementById("page"); if (!pg2) return true;
      var nat = String(side.country || "").toUpperCase();
      try {
        var reg = (window.__foCxAPI.regions() || []).filter(function (x) { return x.id === side.country; })[0];
        if (reg && reg.nm) nat = reg.nm;
      } catch (eN) {}
      pg2.innerHTML = "<div class='fo-pp'><a class='fo-pp-back' href='#/watch?n=" + E(side.country) + "'>&lsaquo; The match</a>" +
        "<div class='fo-pp-card'><h3>" + E(name) + "</h3>" +
        "<p class='fo-pp-dim'>He plays for <b>" + E(side.name || ("club " + side.slot)) + "</b> in the " + E(nat) +
        " league. His card &mdash; the numbers, the form, the record &mdash; is kept by the World Service, " +
        "which cannot be reached just now. Try him again in a minute.</p></div></div>";
      return true;
    }
    return false;
  }
  // and when nobody on earth has heard of him, say so like a cricket book
  function notInRecord(name) {
    var pg = document.getElementById("page"); if (!pg) return;
    pg.innerHTML = "<div class='fo-pp'><a class='fo-pp-back' href='#/squad'>&lsaquo; The squad</a>" +
      "<div class='fo-pp-card'><h3>" + E(name || "This cricketer") + "</h3>" +
      "<p class='fo-pp-dim'>No club on the books carries that name. If you followed him out of a broadcast, " +
      "open the match again and tap him from the card &mdash; the world will send his page down with him.</p></div></div>";
  }

  function build() {
    if (!onPage()) return;
    var page = document.getElementById("page"); if (!page) return;
    var name = qName(); if (!name) return;
    // A CRICKETER THIS DEVICE EMPLOYS, or - when the link names his club -
    // anybody in the world, derived from the seed the umpire built him with.
    // A national squad is fifteen men from ten clubs, and a manager reading
    // Pakistan's side wants those men to open like any other.
    var ridQ = qp("r"), slotQ = qp("s");
    var hit = null;
    try {
      hit = (typeof window.foFindAnyPlayer === "function")
        ? window.foFindAnyPlayer(name, ridQ || null, slotQ == null || slotQ === "" ? null : (parseInt(slotQ, 10) | 0))
        : findPlayer(name);
    } catch (e) { try { hit = findPlayer(name); } catch (e2) {} }
    var cidQ = qp("c");
    // a man from another club: the world serves his card, and only his card
    if (cidQ && !isMine(name)) { buildCard(cidQ, parseInt(qp("s"), 10) || 0, name); return; }
    // A NAME OFF A BROADCAST. Every name on a scorecard is a link, but the
    // engine's own playerLink can only write the name - so a South African or
    // an Indian watched from the world theatre arrived here as a bare ?n=,
    // matched nobody in the local league, and the engine printed "Player not
    // found." at a cricketer who plays every week. The theatre leaves the
    // match's two clubs behind it; ask them who he is.
    if (!hit || !hit.p) { if (fromTheatre(name)) return; }
    if (!hit || !hit.p) { notInRecord(name); return; }
    var p = hit.p, team = hit.team || {}, mine = isMine(p.name);
    // MINE DOES NOT FLAP. Between two served snapshots the local mirror can
    // briefly hold another shape and isMine answers false for a man this
    // manager employs - so a tap on Development rebuilt the page without its
    // Development tab, the strip ended at Career, and the tap read as landing
    // on the wrong one. A man whose club is the claim's club is mine; and a
    // man this page has already treated as mine stays mine for the visit.
    try {
      if (!mine && hit.world) {
        var clM = worldClaim();
        if (clM && clM.country === hit.world.rid && (clM.slot | 0) === (hit.world.slot | 0)) mine = true;
      }
    } catch (eMn) {}
    if (mine) MINE_LAST = p.name;
    else if (MINE_LAST === p.name) mine = true;
    // the dark dossier stage is retired; make sure its backdrop goes with it
    try { document.body.classList.remove("fo-pl-on"); var bg = document.getElementById("fo-pl-bg"); if (bg) bg.remove(); } catch (eB) {}
    if (!mine && TAB === "dev") TAB = "overview";

    var ovr = ovrOf(p), art = artOf(p);
    var no = ("00" + (h32("cardno|" + p.name) % 199 + 1)).slice(-3);
    var flag = ""; try { flag = window.foFlag ? window.foFlag(p.nat) : ""; } catch (eF) {}
    var pv = provLine(p, team);
    var cond = condition(p);
    var fat0 = fatOf(p.fatWord || p.fatigue);
    var sc = scoutRow(p);

    // EVERY MAN CAME FROM SOMEWHERE, AND YOU CAN GO THERE. A cricketer's club
    // was a word on his card and nothing more - a dead end on the one page a
    // reader arrives at knowing only his name. It is a door now: the world's
    // men carry the club the world found them at, and your own carry yours.
    var clubHref = "";
    try {
      if (hit.world && hit.world.rid) clubHref = "#/team?c=" + encodeURIComponent(hit.world.rid) + "&s=" + (hit.world.slot | 0);
      else if (mine) {
        var cl0 = worldClaim();
        if (cl0 && cl0.country && cl0.slot != null) clubHref = "#/team?c=" + encodeURIComponent(cl0.country) + "&s=" + (cl0.slot | 0);
      }
    } catch (eCh) {}
    var clubCell = function (nm) {
      var body = "<b>" + E(nm || "") + "</b><i>Club" + (clubHref ? " &rsaquo;" : "") + "</i>";
      return "<div>" + (clubHref ? "<a class='fo-pp-clubl' href='" + clubHref + "'>" + body + "</a>" : body) + "</div>";
    };

    var talents = (p.talents || []).slice(0, 3).map(function (t) {
      var nm = t, tip = "";
      try { nm = (typeof TALN !== "undefined" && TALN[t]) || t; } catch (e1) {}
      try { tip = (typeof TALTIPS !== "undefined" && TALTIPS[t]) || ""; } catch (e2) {}
      return "<div class='fo-pp-tal'><span class='fo-pp-talk'>Talent</span><div><b>" + E(nm) + "</b>" +
        (tip ? "<p>" + E(tip) + "</p>" : "") + "</div></div>";
    }).join("");

    var hero =
      "<div class='fo-pp-plate'>" +
      "<div class='fo-pp-cardart'>" + (art ? "<img src='" + E(art) + "' alt='' onerror=\"this.style.display='none'\">" : "") +
      "<span class='fo-pp-no'>No. " + no + "/199</span></div>" +
      "<div class='fo-pp-id'>" +
      // WHAT HE BOWLS, ON THE CARD. It was shown in exactly one place - the
      // Role in the XI card on the Overview - and when that card went, a
      // cricketer's own page stopped saying whether he was seam or spin at
      // all. It belongs in this line, beside the hand he bats with: those two
      // facts are what the eyebrow is for.
      "<div class='fo-pp-k'>" + E(kindLbl(p).toUpperCase()) + " &middot; " + (p.hand === "L" ? "LHB" : "RHB") +
      (p.btLabel && !/does not bowl/i.test(p.btLabel) ? " &middot; " + E(String(p.btLabel).toUpperCase()) : "") +
      " &middot; " + E(String(p.nat || "").toUpperCase()) + "</div>" +
      "<h1>" + E(p.name) + natStar(p.name, (hit.world && hit.world.rid) || null, (hit.world && hit.world.slot), true) +
      (flag ? " <span class='fo-pp-fl'>" + flag + "</span>" : "") + "</h1>" +
      "<p class='fo-pp-prov'>" + E(pv.how) + pv.born + "</p>" +
      "<div class='fo-pp-strip'>" +
      "<div title='" + ageTitle(p) + "'><b>" + ageHTML(p) + "</b><i>Age</i></div>" +
      "<div><b>" + E(cap(cond.formWord)) + "</b><i>Form</i></div>" +
      "<div><b>" + E(cap(p.expWord || "")) + "</b><i>Experience</i></div>" +
      clubCell(team.name) +
      "</div>" +
      "<div class='fo-pp-strip three'>" +
      "<div><b>" + money(wageOf(p)) + "</b><i>Wage</i></div>" +
      "<div><b>" + E(cap((typeof word === "function" ? word(p.capt || 30) : "steady"))) + "</b><i>Leadership</i></div>" +
      "<div><b class='fo-pp-fat " + fat0.tone + "'><s></s>" + E(cap(fat0.word)) + "</b><i>Fatigue</i></div>" +
      "</div>" +
      // The batting/bowling/fielding bars that used to sit under this strip
      // are gone: The player card on the Overview states the same three
      // numbers a few inches below, in a shape you can actually read them
      // against. Two printings of one fact is one too many.
      (talents ? "<div class='fo-pp-tals'>" + talents + "</div>" : "") +
      "</div>" +
      "<div class='fo-pp-ovr'><b>" + ovr + "</b><i>OVR</i></div>" +
      "</div>";

    var tabBar = "<div class='fo-pp-tabs'>" + TABS.filter(function (t) { return t[0] !== "dev" || mine; }).map(function (t) {
      return "<a class='" + (TAB === t[0] ? "on" : "") + "' data-t='" + t[0] + "' href='javascript:void 0'>" + t[1] + "</a>";
    }).join("") + "</div>";

    // ---- the rooms ----------------------------------------------------------
    var room = "";
    if (TAB === "career") {
      var idChips = [];
      idChips.push(["One-club player", "&#127963;"]);
      if (!p._prov || p._prov.how === "draft") idChips.push(["Draft-day original", "&#128395;"]);
      else if (p._prov.how === "youth") idChips.push(["Academy graduate", "&#127793;"]);
      else if (p._prov.how === "market") idChips.push(["Bought in", "&#128176;"]);
      try { if (App.orders && App.orders.captain === p.name) idChips.push(["Captain", "&#128081;"]); } catch (eCp) {}
      room =
        "<div class='fo-pp-col'>" +
        "<div class='fo-pp-slot' data-slot='record'></div>" +
        "<div class='fo-pp-slot' data-slot='career'></div>" +
        "</div>" +
        // Club history said one club and one season - the club is in the
        // masthead - and career identity was a row of chips repeating the
        // provenance line under his name. Honours is the record here.
        "<div class='fo-pp-rail'>" +
        "<div class='fo-pp-card'><h3>Honours</h3>" + honoursHtml(p, team) + "</div>" +
        "</div>";
    } else if (TAB === "country") {
      var myCid = "";
      try {
        var cl9 = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null");
        myCid = (hit.world && hit.world.rid) || (cl9 && cl9.country) || "";
      } catch (eCi) {}
      room = countryRoom(myCid, p, function () { if (onPage()) build(); });
    } else if (TAB === "matches") {
      var fx = nextFixtureFor(team.name || "");
      var spot = xiSpot(p, team);
      setTimeout(function () { try { ppFillLog(p, hit, team); } catch (eL) {} }, 30);
      room =
        "<div class='fo-pp-col'>" +
        "<div class='fo-pp-card pad0'><div class='fo-pp-ph'><h3>Match log</h3>" +
        "<span class='fo-pp-filt'><a data-f='all' class='on'>All</a><a data-f='lg'>League</a><a data-f='fr'>Friendly</a></span></div>" +
        "<div class='fo-pp-slot' data-slot='recent'></div></div>" +
        "</div>" +
        "<div class='fo-pp-rail'>" +
        (fx ? "<div class='fo-pp-card dark'><h3>Next assignment</h3>" +
          "<div class='fo-pp-nx'><b>" + E(team.name || "") + "</b><i>v</i><b>" + E(fx.opp) + "</b></div>" +
          "<div class='fo-pp-nxm'>Round " + fx.round + (fx.hour ? " &middot; " + E(fx.hour) : "") + " &middot; " + (fx.home ? "home" : "away") + "</div>" +
          (fx.ground ? "<div class='fo-pp-nxm'>" + E(fx.ground) + "</div>" : "") +
          (spot ? "<div class='fo-pp-nxbat'>Batting at " + spot.n + "<span>" + E(spot.src) + "</span></div>" : "") +
          "</div>" : "") +
        "<div class='fo-pp-card'><h3>Match readiness</h3>" +
        meter("Form", cap(cond.formWord), cond.formPct) +
        meter("Fitness", cond.fitPct + "%", cond.fitPct) +
        meter("Freshness", cap(cond.fatWord), 100 - cond.fatPct) +
        "</div>" +
        "</div>";
    } else if (TAB === "talents") {
      // WHAT HE HAS, AND WHAT HE IS ON HIS WAY TO.
      //
      // A talent is rare - about one man in nine is dealt one - and it is also
      // earnable: a cricketer who keeps finding himself in the situation one
      // describes, and keeps doing the job, eventually comes by it. That is a
      // slow thing, two or three seasons of regular cricket, and a manager who
      // cannot watch it happening has no reason to keep picking the man for the
      // job that is teaching him. This room is the watching.
      var T9 = {}; try { T9 = window.FO_TAL_T || {}; } catch (eT9) {}
      var talNm = function (t) { try { return (typeof TALN !== "undefined" && TALN[t]) || t; } catch (e) { return t; } };
      var talTip = function (t) { try { return (typeof TALTIPS !== "undefined" && TALTIPS[t]) || ""; } catch (e) { return ""; } };
      var has = (p.talents || []).slice();
      var earned = p.talEarned || null;
      var hasRows = has.length ? has.map(function (t) {
        return "<div class='fo-pp-tal'><span class='fo-pp-talk" + (t === earned ? " won" : "") + "'>" +
          (t === earned ? "Earned" : "Born with") + "</span><div><b>" + E(talNm(t)) + "</b>" +
          (talTip(t) ? "<p>" + E(talTip(t)) + "</p>" : "") + "</div></div>";
      }).join("") : "";

      // everything he is part of the way to, closest first
      var prog = (p.talProg && typeof p.talProg === "object") ? p.talProg : {};
      var carr = (p.talCarry && typeof p.talCarry === "object") ? p.talCarry : {};
      var all = {}, k9;
      for (k9 in prog) all[k9] = (all[k9] | 0) + (prog[k9] | 0);
      for (k9 in carr) all[k9] = (all[k9] | 0) + (carr[k9] | 0);
      // EVERY TALENT HE COULD EVER EARN, NOT ONLY THE ONES HE HAS STARTED.
      //
      // Listing only the talents already counting answered "what is he close
      // to" but never "what is he FOR" - a keeper could not see that Lightning
      // Hands was his to chase, and a man with an empty page was told "nothing
      // yet" with no hint of what nothing was measured against. So the room
      // lists the whole set he is eligible for, at zero or otherwise.
      //
      // Eligibility is not decided here. foTalElig is the engine's own table,
      // read by the ball loop that awards these talents, so a page can never
      // promise a man something the match would refuse him.
      var elig = function (t) {
        try { return window.foTalElig ? window.foTalElig(p, t) : true; } catch (eE9) { return true; }
      };
      var learning = Object.keys(T9).filter(function (t) {
        return has.indexOf(t) < 0 && (T9[t] || 0) > 0 && elig(t);
      }).map(function (t) {
        var n9 = all[t] | 0, cap9 = T9[t] | 0;
        var ch = window.foTalChance ? window.foTalChance(n9, cap9) : Math.min(1, n9 / (cap9 || 1));
        return { t: t, n: n9, cap: cap9, r: Math.min(1, n9 / (cap9 || 1)), ch: ch };
      }).sort(function (x, y) {
        if (y.r !== x.r) return y.r - x.r;               // closest first
        return talNm(x.t) < talNm(y.t) ? -1 : 1;          // then alphabetical, so nothing jumps about
      });

      var learnBody;
      var earnedNote = earned
        ? "<p class='fo-pp-dim'>He has earned his one. A cricketer comes by a talent once in a career - what is rare " +
          "has to stay rare to be worth anything - so these stand where they stopped.</p>"
        : "";
      if (!learning.length) {
        learnBody = earnedNote || "<p class='fo-pp-dim'>There is nothing here he is eligible for - his role puts every " +
          "remaining talent out of reach.</p>";
      } else {
        learnBody = earnedNote + learning.map(function (L) {
          // the BAR is how far along he is; the number is what that is worth
          // on the field this week, which moves a tenth at a time
          var pctN = Math.round(L.r * 100), chN = Math.round(L.ch * 100);
          return "<div class='fo-pp-learn' title='" + E(talTip(L.t)) + "'>" +
            "<i>" + E(talNm(L.t)) + "</i>" +
            "<em>" + chN + "%</em>" +
            "<u><b style='width:" + Math.max(2, pctN) + "%'></b></u>" +
            "</div>";
        }).join("");
      }

      // once he has had his, the counting has stopped: a percentage in the
      // heading would be advertising a bar that can never fill
      var top = earned ? null : learning[0];
      room =
        "<div class='fo-pp-col'>" +
        "<div class='fo-pp-card'><h3>On his way to" +
          (top ? "<span>" + Math.round(top.ch * 100) + "% &middot; " + E(talNm(top.t)) + "</span>" : "") +
        "</h3>" + learnBody +
        "</div></div>" +
        "<div class='fo-pp-rail'>" +
        (hasRows ? "<div class='fo-pp-card'><h3>What he has<span>" + has.length + "</span></h3>" +
        hasRows + "</div>" : "") +
        (Object.keys(carr).length
          ? "<div class='fo-pp-card'><h3>Brought with him</h3>" +
            "<p class='fo-pp-dim'>Work he did at another club, or in the academy before he was signed. It counts " +
            "toward what he is learning here - a move does not make a cricketer forget.</p></div>"
          : "") +
        "</div>";
    } else if (TAB === "dev" && mine) {
      var pops = []; try { pops = (window.__foPops && window.__foPops.forPlayer(p.name)) || []; } catch (eP) {}
      var thisSeason = pops.filter(function (l) { return l && l.s === (App.seasonNo || 1); }).length;
      room =
        "<div class='fo-pp-col'>" +
        "<div class='fo-pp-card'><h3>Growth<span>" + thisSeason + " jump" + (thisSeason === 1 ? "" : "s") + " this season</span></h3>" +
        bars(facets(p)) +
        "<p class='fo-pp-dim'>" + (p.age >= 30 ? "Past thirty the numbers move slowly, but experience holds his form steady."
          : p.age <= 22 ? "Young enough that a good winter changes what he is." : "In his prime: what he learns now, he keeps.") + "</p></div>" +
        "<div class='fo-pp-slot' data-slot='dev'></div>" +
        "</div>" +
        "<div class='fo-pp-rail'>" +
        "<div class='fo-pp-card'><h3>Condition</h3>" +
        meter("Fitness", cond.fitPct + "%", cond.fitPct) +
        meter("Fatigue", cap(cond.fatWord), cond.fatPct) +
        meter("Form", cap(cond.formWord), cond.formPct) +
        "<p class='fo-pp-dim'>" + (cond.fatPct > 40 ? "He needs a quiet week more than a hard one." : "Fresh enough for a full week's work.") + "</p></div>" +
        "<div class='fo-pp-card dark'><h3>The training ground</h3>" +
        "<a class='fo-pp-more' href='#/training'>Set this week's work &rsaquo;</a></div>" +
        "</div>";
    } else if (TAB === "story") {
      // THE STORY HAS ITS OWN TAB. It is the one part of the page that is read
      // rather than scanned, and it was sharing a column with a batting-order
      // picker. Its own moments are fetched here rather than borrowed from the
      // Overview's scope, so the tab stands on its own.
      var ms1 = moments(p);
      room =
        "<div class='fo-pp-col fo-pp-wide'>" +
        "<div class='fo-pp-card'><h3>The story so far</h3>" +
        (ms1.length ? "<div class='fo-pp-story'>" + ms1.map(function (m) {
          return "<div class='fo-pp-ev done'><i></i><span><u>" + E(m.when) + "</u>" + E(m.txt) + "</span></div>";
        }).join("") + "</div>"
          : "<div class='fo-pp-story'><div class='fo-pp-ev'><i></i><span><u>Next match</u>League debut</span></div></div>") +
        "</div>" +
        "</div>";
    } else {
      var ms = moments(p);
      var adv = "";
      // A CARD DOES NOT HAVE FIFTEEN NUMBERS, SO THE PAGE MUST NOT PRINT FIFTEEN.
      //
      // The world describes a cricketer at two resolutions. world_my_status
      // sends the engine player - the real fifteen-facet skills block.
      // world_squads sends the PUBLIC CARD: batting, bowling, fielding and
      // nothing else. A card is turned into an engine player by spreading each
      // aggregate flat across its group, which is right for sorting and for
      // the aggregate bars - they give the published figures back exactly -
      // but it is NOT fifteen measurements, and the advanced view was showing
      // it as though it were. That is why every batting facet read the same
      // number and every bowling facet read another: the flat spread, printed
      // as engine truth.
      //
      // The man is stamped __card when that happens, so the view says what it
      // actually knows rather than inventing a shape he does not have.
      if (mine && p.__card) {
        // A PARAGRAPH WHERE A WORD WOULD DO. The long version explained the two
        // resolutions the world describes a cricketer at, which is a thing the
        // reader neither asked nor needs: the facets are on their way, and the
        // only honest thing to say is that they are not here yet.
        adv = "<details class='fo-pp-adv'><summary>Advanced engine view</summary>" +
          "<p class='fo-pp-dim'>Loading&hellip; try refreshing the page if this doesn't load in 30 seconds.</p></details>";
      } else if (mine) {
        var sk = skills(p);
        adv = "<details class='fo-pp-adv'><summary>Advanced engine view</summary>" +
          "<div class='fo-pp-advg rest'>" + restFacets(p).map(function (f) {
            return "<span><i>" + E(f[0].toLowerCase()) + "</i><b>" + num(f[1]) + "</b></span>";
          }).join("") + "</div>" +
          "<div class='fo-pp-advg'>" +
          ["vsPace", "vsSpin", "power", "rotation", "temperament", "wicket", "economy", "discipline", "moveTurn",
            "variation", "stamina", "fielding", "catching", "keeping", "stumping"].map(function (k) {
            return "<span><i>" + k + "</i><b>" + num(sk[k]) + "</b></span>";
          }).join("") + "</div></details>";
      }
      room =
        "<div class='fo-pp-col'>" +
        "<div class='fo-pp-card'><h3>The player</h3>" +
        (mine ? "<div class='fo-pp-shape'>" + radar(facets(p)) + bars(facets(p)) + "</div>" + adv
          : bars(scoutRow(p))) +
        "</div>" +
        "<div class='fo-pp-card'><h3>Career record</h3><div class='fo-pp-mini' data-mini='1'>" + miniCareer(p) + "</div></div>" +
        (mine ? officeHTML(p) : "") +
        "</div>" +
        "";
      // ROLE IN THE XI IS GONE. It printed the batting order twice - once as a
      // row of eleven numbers, once as a label - for a decision made on the
      // orders page and true only until the next teamsheet. His role is already
      // the first line of this page, above his name.
    }

    // keep whatever the engine and the chronicle rendered: the attic holds it
    // until a room asks for it, and the decorators keep finding it in #page
    var attic = page.querySelector(".fo-pp-attic");
    if (!attic) {
      attic = document.createElement("div");
      attic.className = "fo-pp-attic";
      var kids = Array.prototype.slice.call(page.children);
      kids.forEach(function (k) { attic.appendChild(k); });
    } else if (attic.parentNode) attic.parentNode.removeChild(attic);

    var wrap = document.createElement("div");
    wrap.className = "fo-pp";
    wrap.setAttribute("data-n", name);
    wrap.innerHTML =
      "<a class='fo-pp-back' href='#/squad'>&lsaquo; The squad</a>" + hero + tabBar +
      "<div class='fo-pp-body'>" + room + "</div>";
    page.innerHTML = "";
    page.appendChild(wrap);
    page.appendChild(attic);

    wrap.querySelectorAll(".fo-pp-tabs a").forEach(function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        TAB = a.getAttribute("data-t");
        build(); harvest();
      });
    });
    // THE STRIP KEEPS ITS PLACE. On a phone the tab rail scrolls, and a
    // rebuild reset it to the left edge - so tapping Development painted the
    // right room but the rail snapped back to Overview..Career and the tap
    // read as landing on the wrong tab. The active tab stays under the finger.
    try {
      var bar9 = wrap.querySelector(".fo-pp-tabs"), on9 = bar9 && bar9.querySelector("a.on");
      if (bar9 && on9) bar9.scrollLeft = Math.max(0, on9.offsetLeft - (bar9.clientWidth - on9.offsetWidth) / 2);
    } catch (eSb) {}
    wrap.querySelectorAll(".fo-pp-filt a").forEach(function (a) {
      a.addEventListener("click", function () {
        wrap.querySelectorAll(".fo-pp-filt a").forEach(function (b) { b.classList.remove("on"); });
        a.classList.add("on");
        filterLog(a.getAttribute("data-f"));
      });
    });
    harvest();
    try { if (mine && wrap.querySelector(".fo-pp-office")) officeWire(wrap, p); } catch (eOw) {}
  }

  /* ---- THE OFFICE ----------------------------------------------------------
     From the Pavilion puts the paperwork on the man's own page - sell, price,
     release - and this game made you walk to the market's sell desk for the
     same three deeds. The deeds, the price law and the confirmations are the
     market's (window.__foMktOffice, one arithmetic everywhere); this card
     only stands them next to the man they are about.

     A SENIOR is the market's business: the board, the bank's half-price
     quick sale, or a free release - and Withdraw when he is already up.
     A COLT's papers are the academy's: a senior shirt or a release, through
     the same __foColtAction the squad room uses. */
  var OFF = { at: 0, sales: null, busy: 0 };
  function isColt(name) {
    try { return ((userTeam() || {}).youth || []).some(function (x) { return x && x.name === name; }); }
    catch (e) { return false; }
  }
  function officeHTML(p) {
    var api = window.__foMktOffice;
    if (!api) return "";
    if (isColt(p.name)) {
      return "<div class='fo-pp-card'><h3>The office</h3><div class='fo-pp-office'>" +
        "<p class='fo-pp-dim'>His papers are the academy&rsquo;s: he walks at twenty-one unless a senior shirt comes first.</p>" +
        "<div class='fo-pp-obrow'>" +
        "<button type='button' class='fo-pp-ob' data-pp-colt='promote'>Hand him a senior shirt</button>" +
        "<button type='button' class='fo-pp-ob danger' data-pp-colt='release'>Let him go</button>" +
        "</div></div></div>";
    }
    var open = null;
    if (OFF.sales) for (var i = 0; i < OFF.sales.length; i++) {
      var s9 = OFF.sales[i];
      if (s9 && s9.player === p.name && s9.status === "open") { open = s9; break; }
    }
    var inner;
    if (open) {
      inner = "<div class='fo-pp-onbd'><b>He is on the board</b>" +
        "<i>Reserve $" + (+open.reserve || 0).toLocaleString() + " &middot; " +
        (open.bids | 0) + ((open.bids | 0) === 1 ? " bid" : " bids") +
        " &middot; the hammer falls on day " + (open.closes | 0) + "</i></div>" +
        "<div class='fo-pp-obrow'>" +
        "<button type='button' class='fo-pp-ob ghost' data-pp-withdraw='" + (open.id | 0) + "'>Withdraw him</button>" +
        "</div>";
    } else {
      inner = "<div class='fo-pp-obrow'>" +
        "<button type='button' class='fo-pp-ob' data-pp-list='1'>Put him on the board</button>" +
        "<button type='button' class='fo-pp-ob ghost' data-pp-qs='1'>Quick sale &middot; $" + api.qsPrice(p).toLocaleString() + "</button>" +
        "<button type='button' class='fo-pp-ob danger' data-pp-rel='1'>Release him</button>" +
        "</div>";
    }
    return "<div class='fo-pp-card'><h3>The office</h3><div class='fo-pp-office'>" + inner + "</div></div>";
  }
  function officeWire(wrap, p) {
    var api = window.__foMktOffice;
    if (!api) return;
    var nm = p.name;
    // whether he is already up: asked once a visit, never in a loop - the
    // fetch marks itself started before build() can run again
    if (!isColt(nm) && !OFF.busy && (!OFF.sales || Date.now() - OFF.at > 30000)) {
      OFF.busy = 1; OFF.at = Date.now();
      api.rpc("world_market_mine").then(function (d) {
        OFF.busy = 0; OFF.sales = (d && d.sales) || [];
        if (onPage()) build();
      }).catch(function () { OFF.busy = 0; OFF.sales = OFF.sales || []; });
    }
    var gone = function (msg) {
      api.toast(msg);
      OFF.sales = null;
      try { if (window.__foWorldRefreshPlan) window.__foWorldRefreshPlan(); } catch (e) {}
      location.hash = "#/squad";
    };
    // one variable per button: a shared `var b` reassigned down the chain
    // left every handler closing over the LAST lookup (null, usually), and
    // foDecide(null) falls back to running onYes with nothing typed
    var bL = wrap.querySelector("[data-pp-list]");
    if (bL) bL.addEventListener("click", function () {
      var b = bL;
      api.decide(b, {
        q: "Reserve for " + nm, note: "The least you will accept. Below it the hammer does not fall.",
        input: { value: "20000", placeholder: "20000" }, ok: "Put him on the board", cancel: "Not yet",
        onYes: function (v) {
          var res = Math.round(+String(v == null ? "" : v).replace(/[^0-9]/g, ""));
          if (!(res > 0)) { try { window.foSayAt && foSayAt(b, "A reserve has to be a figure above nothing.", "error"); } catch (e) {} return; }
          api.rpc("world_market_list", { p_player: nm, p_reserve: res }).then(function () {
            api.toast(nm + " is on the board · the hammer falls in three days");
            OFF.sales = null; build();
          }).catch(function (e) { try { window.foSayAt && foSayAt(b, String((e && e.message) || e).slice(0, 160), "error"); } catch (e2) {} });
        }
      });
    });
    var bQ = wrap.querySelector("[data-pp-qs]");
    if (bQ) bQ.addEventListener("click", function () {
      var b = bQ;
      var fee = api.qsPrice(p);
      api.decide(b, {
        q: "Sell " + nm + " to the bank for $" + fee.toLocaleString() + "?",
        note: "Immediate and final. No auction, no counter-offer, and he does not come back.",
        ok: "Sell him", cancel: "Keep him", danger: true,
        onYes: function () {
          api.rpc("world_market_quicksell", { p_player: nm }).then(function (r) {
            gone(nm + " sold to the bank for $" + (((r && r.fee) || fee)).toLocaleString() + ". The fee lands with the next settle.");
          }).catch(function (e) { try { window.foSayAt && foSayAt(b, String((e && e.message) || e).slice(0, 160), "error"); } catch (e2) {} });
        }
      });
    });
    var bR = wrap.querySelector("[data-pp-rel]");
    if (bR) bR.addEventListener("click", function () {
      var b = bR;
      api.decide(b, {
        q: "Release " + nm + " for nothing?",
        note: "He walks, the club gets no fee, and he does not come back.",
        ok: "Release him", cancel: "Keep him", danger: true,
        onYes: function () {
          api.rpc("world_market_release", { p_player: nm }).then(function () {
            gone(nm + " released.");
          }).catch(function (e) { try { window.foSayAt && foSayAt(b, String((e && e.message) || e).slice(0, 160), "error"); } catch (e2) {} });
        }
      });
    });
    var bW = wrap.querySelector("[data-pp-withdraw]");
    if (bW) bW.addEventListener("click", function () {
      var b = bW;
      api.rpc("world_market_withdraw", { p_id: +b.getAttribute("data-pp-withdraw") }).then(function () {
        api.toast("Withdrawn. He stays yours.");
        OFF.sales = null; build();
      }).catch(function (e) { try { window.foSayAt && foSayAt(b, String((e && e.message) || e).slice(0, 160), "error"); } catch (e2) {} });
    });
    wrap.querySelectorAll("[data-pp-colt]").forEach(function (cb) {
      cb.addEventListener("click", function () {
        var act = cb.getAttribute("data-pp-colt");
        try {
          if (window.__foColtAction) __foColtAction(nm, act, function () {
            if (act === "release") location.hash = "#/squad"; else build();
          }, cb);
        } catch (e) {}
      });
    });
  }

  // ---- THE SCOUT'S CARD: a rival's player page -------------------------------
  // Another manager's cricketer is not yours to read. What the world serves is
  // what a scout sees over the fence: who he is, what he is worth with bat,
  // ball and in the field, and the record he has actually put together. No raw
  // skills, no coaching book, no training ground.
  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  var SQ_CACHE = {}, SQ_BUSY = {}, SQ_DEAD = {};
  // SQ_DEAD: a squad the world refused to send. Without it a page waiting on
  // a fetch that will never land sits on "sending for his card" forever
  // instead of admitting the world is out of reach.
  function servedSquadFailed(cid, slot) { return !!SQ_DEAD[cid + ":" + slot]; }
  function servedSquad(cid, slot, cb) {
    var k = cid + ":" + slot;
    if (SQ_CACHE[k]) return SQ_CACHE[k];
    if (SQ_BUSY[k]) return null;
    SQ_BUSY[k] = 1;
    var done = function (ok) { SQ_BUSY[k] = 0; if (!ok) SQ_DEAD[k] = 1; try { if (cb) cb(); } catch (e) {} };
    try {
      fetch(SB_URL + "/rest/v1/world_squads?country_id=eq." + encodeURIComponent(cid) + "&slot=eq." + slot +
        "&select=name,players", { headers: { apikey: SB_ANON } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (rows) {
          if (rows && rows[0]) { SQ_CACHE[k] = rows[0]; done(true); } else done(false);
        }, function () { done(false); });
    } catch (e) { done(false); }
    return null;
  }
  // THE OTHER CAREER. A man who has played for his country has a second book
  // that his club record never touches, and this is the page people come to
  // for it. The nations snapshot carries every capped cricketer still on a
  // club's books, keyed by name, so one fetch answers for the whole world.
  var NAT_SNAP = null, NAT_BUSY = 0;
  function servedIntl(cid, name, cb) {
    if (NAT_SNAP === null && !NAT_BUSY) {
      NAT_BUSY = 1;
      try {
        fetch(SB_URL + "/rest/v1/world_snapshots?key=eq.nations&select=body", { headers: { apikey: SB_ANON } })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (rows) {
            NAT_BUSY = 0;
            NAT_SNAP = (rows && rows[0] && rows[0].body) || false;
            try { if (cb) cb(); } catch (e) {}
          }, function () { NAT_BUSY = 0; NAT_SNAP = false; });
      } catch (e) { NAT_BUSY = 0; NAT_SNAP = false; }
    }
    if (!NAT_SNAP || !NAT_SNAP.nations) return null;
    var n = NAT_SNAP.nations[cid];
    return (n && n.record && n.record[name]) || null;
  }
  // ---- THE COUNTRY ROOM ------------------------------------------------------
  // What a cap is worth, on its own page: the caps, the runs, the wickets, and
  // whether the selectors have him in the fifteen as it stands.
  function countryRoom(cid, pl, again) {
    var kv = function (k, v) { return "<div><b>" + v + "</b><i>" + k + "</i></div>"; };
    var nm = (pl && pl.name) || "";
    var rec = cid ? servedIntl(cid, nm, again) : null;
    var inSquad = "";
    try { inSquad = window.foNatStar ? window.foNatStar(nm, null, { rid: cid || undefined }) : ""; } catch (e) {}
    var natNm = "";
    try {
      var r0 = (window.__foCxAPI.regions() || []).filter(function (x) { return x.id === cid; })[0];
      natNm = (r0 && r0.nm) || "";
    } catch (e2) {}
    var flag = ""; try { flag = window.foFlag ? window.foFlag(pl && pl.nat) : ""; } catch (e3) {}
    var head = "<h3>" + (natNm ? E(natNm) : "For his country") +
      "<span>" + (inSquad ? "in the current fifteen" : "not in the current fifteen") + "</span></h3>";
    if (!rec || !rec.caps) {
      return "<div class='fo-pp-col'><div class='fo-pp-card'>" + head +
        "<p class='fo-pp-dim'>" + (cid ? "Uncapped." : "The world has not answered for this club yet.") + "</p>" +
        "</div></div>" +
        "<div class='fo-pp-rail'><div class='fo-pp-card'><h3>The windows</h3>" +
        "<p class='fo-pp-dim'>Selectors name a fifteen at rounds 5, 9 and 13.</p>" +
        "<a class='fo-pp-more' href='#/nations'>The international game &rsaquo;</a></div></div>";
    }
    var sr = rec.balls ? Math.round(1000 * (rec.runs || 0) / rec.balls) / 10 : null;
    return "<div class='fo-pp-col'><div class='fo-pp-card'>" + head +
      "<div class='fo-pp-mini wide'>" +
      kv("Caps", rec.caps) + kv("Runs", rec.runs || 0) + kv("Best", rec.hs || 0) +
      (sr == null ? "" : kv("Strike rate", sr)) +
      kv("Wickets", rec.wkts || 0) +
      kv("Best bowling", rec.bb ? rec.bb.w + "/" + rec.bb.r : "&mdash;") +
      "</div></div></div>" +
      "<div class='fo-pp-rail'><div class='fo-pp-card'><h3>" + (flag || "") + " The cap</h3>" +
      "<p class='fo-pp-dim'>A cap keeps its own book.</p>" +
      "<a class='fo-pp-more' href='#/nations'>The international game &rsaquo;</a></div></div>";
  }

  function servedFace(sp) {
    try {
      if (window.foPkArt) return ART() + window.foPkArt({
        name: sp.name, nat: sp.nat, role: sp.role, keeper: sp.keeper,
        bowlTypeFull: sp.type, bowlType: (sp.type && sp.type !== "none") ? sp.type : null });
    } catch (e) {}
    return "";
  }
  var CARD_TAB = "overview";
  function buildCard(cid, slot, name) {
    try {
      var page = document.getElementById("page"); if (!page) return;
      try { document.body.classList.remove("fo-pl-on"); var bg0 = document.getElementById("fo-pl-bg"); if (bg0) bg0.remove(); } catch (eB) {}
      var row = servedSquad(cid, slot, function () { if (onPage()) buildCard(cid, slot, name); });
      var sp = row && (row.players || []).filter(function (x) { return x && x.name === name; })[0];
      if (!sp) {
        page.innerHTML = "<div class='fo-pp'><a class='fo-pp-back' href='#/team?c=" + E(cid) + "&s=" + slot + "'>&lsaquo; The club</a>" +
          "<div class='fo-pp-card'><h3>" + E(name) + "</h3><p class='fo-pp-dim'>" +
          (row ? "He is not on that club's teamsheet any more." : "Reaching the world for his card&hellip;") + "</p></div></div>";
        return;
      }
      var clubNm = (row && row.name) || "";
      try { var nmO = window.__foWorldNames && window.__foWorldNames.get(cid); if (nmO && nmO[slot]) clubNm = nmO[slot]; } catch (eN) {}
      var no = ("00" + (h32("cardno|" + sp.name) % 199 + 1)).slice(-3);
      var flag = ""; try { flag = window.foFlag ? window.foFlag(sp.nat) : ""; } catch (eF) {}
      var fat = fatOf(sp.fatigue);
      var bowls = !!(sp.bowl && !/does not bowl/i.test(sp.bowl));
      var kind = (sp.keeper || sp.role === "wicketkeeper") ? "Wicketkeeper"
        : (sp.role === "allRounder" || sp.role === "allrounder") ? "All-rounder" : bowls ? "Bowler" : "Batsman";
      var sc = [["Batting", +sp.batting || 0], ["Bowling", bowls ? (+sp.bowling || 0) : 0], ["Fielding", +sp.fielding || 0]];
      var tals = (sp.talents || []).slice(0, 3).map(function (t) {
        var nm2 = t, tip = "";
        try { nm2 = (typeof TALN !== "undefined" && TALN[t]) || t; } catch (e1) {}
        try { tip = (typeof TALTIPS !== "undefined" && TALTIPS[t]) || ""; } catch (e2) {}
        return "<div class='fo-pp-tal'><span class='fo-pp-talk'>Talent</span><div><b>" + E(nm2) + "</b>" +
          (tip ? "<p>" + E(tip) + "</p>" : "") + "</div></div>";
      }).join("");
      var art = servedFace(sp);
      var plate =
        "<div class='fo-pp-plate'>" +
        "<div class='fo-pp-cardart'>" + (art ? "<img src='" + E(art) + "' alt='' onerror=\"this.style.display='none'\">" : "") +
        "<span class='fo-pp-no'>No. " + no + "/199</span></div>" +
        "<div class='fo-pp-id'>" +
        "<div class='fo-pp-k'>" + E(kind.toUpperCase()) + " &middot; " + (sp.hand === "L" ? "LHB" : "RHB") + " &middot; " + E(String(sp.nat || "").toUpperCase()) + "</div>" +
        "<h1>" + E(sp.name) + natStar(sp.name, cid, slot, true) +
        (flag ? " <span class='fo-pp-fl'>" + flag + "</span>" : "") + "</h1>" +
        "<p class='fo-pp-prov'>Scouted from the boundary &middot; " + E(clubNm || "a world club") + "</p>" +
        "<div class='fo-pp-strip'>" +
        "<div title='" + ageTitle(sp) + "'><b>" + ageHTML(sp) + "</b><i>Age</i></div>" +
        "<div><b>" + E(cap(sp.form || "steady")) + "</b><i>Form</i></div>" +
        "<div><b>" + E(cap(sp.exp || "")) + "</b><i>Experience</i></div>" +
        "<div><a class='fo-pp-clubl' href='#/team?c=" + E(cid) + "&s=" + slot + "'><b>" + E(clubNm) + "</b><i>Club &rsaquo;</i></a></div>" +
        "</div>" +
        "<div class='fo-pp-strip three'>" +
        "<div><b>" + money(sp.wage) + "</b><i>Wage</i></div>" +
        "<div><b>" + money(sp.value) + "</b><i>Value</i></div>" +
        "<div><b class='fo-pp-fat " + fat.tone + "'><s></s>" + E(cap(fat.word)) + "</b><i>Fatigue</i></div>" +
        "</div>" +
        "<div class='fo-pp-sc'>" + sc.map(function (x) {
          return "<div class='fo-pp-scv'><i>" + E(x[0].toUpperCase()) + "</i><em>" + x[1] + "</em><u><b style='width:" + num(x[1]) + "%'></b></u></div>";
        }).join("") + "</div>" +
        (tals ? "<div class='fo-pp-tals'>" + tals + "</div>" : "") +
        "</div>" +
        "<div class='fo-pp-ovr'><b>" + (sp.ovr || "&mdash;") + "</b><i>OVR</i></div>" +
        "</div>";

      var c = sp.career || {};
      var caps = +c.m || 0;
      var sr = c.balls ? (100 * (c.runs || 0) / c.balls).toFixed(1) : "&mdash;";
      var econ = c.ovb ? ((c.conc || 0) / (c.ovb / 6)).toFixed(2) : "&mdash;";
      var kv = function (k, v) { return "<div><b>" + v + "</b><i>" + k + "</i></div>"; };
      var intl = servedIntl(cid, sp.name, function () { if (onPage()) buildCard(cid, slot, name); });
      var intlCard = !intl ? "" :
        "<div class='fo-pp-card'><h3>For his country<span>" + intl.caps + " cap" + (intl.caps === 1 ? "" : "s") + "</span></h3>" +
        "<div class='fo-pp-mini'>" + kv("Caps", intl.caps) + kv("Runs", intl.runs || 0) +
        kv("Best", intl.hs || 0) + kv("Wickets", intl.wkts || 0) + "</div>" +
        "</div>";
      var room;
      if (CARD_TAB === "country") {
        room = countryRoom(cid, sp, function () { if (onPage()) buildCard(cid, slot, name); });
      } else if (CARD_TAB === "career") {
        room = "<div class='fo-pp-col'><div class='fo-pp-card'><h3>Career record<span>All league cricket</span></h3>" +
          (caps ? "<div class='fo-pp-mini wide'>" + kv("Matches", caps) + kv("Runs", c.runs || 0) +
            kv("Best", c.hs || 0) + kv("Strike rate", sr) +
            kv("Wickets", c.wkts || 0) + kv("Best bowling", c.bb ? c.bb.w + "/" + c.bb.r : "&mdash;") +
            kv("Economy", econ) + kv("Overs", c.ovb ? Math.floor(c.ovb / 6) : 0) + "</div>"
            : "<p class='fo-pp-dim'>He has not played a league match yet. The record starts the day he is picked.</p>") +
          "</div>" + intlCard + "</div>" +
          "<div class='fo-pp-rail'><div class='fo-pp-card dark'><h3>The book is public</h3>" +
          "</div></div>";
      } else {
        room = "<div class='fo-pp-col'>" +
          "<div class='fo-pp-card'><h3>The scout's read</h3>" + bars(sc) +
          "</div>" +
          "<div class='fo-pp-card'><h3>Career record</h3><div class='fo-pp-mini'>" +
          kv("Matches", caps) + kv("Runs", c.runs || 0) + kv("Best", c.hs || 0) + kv("Wickets", c.wkts || 0) +
          (caps ? "" : "<p class='fo-pp-dim'>The record starts the day he is picked.</p>") + "</div></div>" +
          "</div>" +
          "<div class='fo-pp-rail'>" +
          "<div class='fo-pp-card'><h3>Role</h3>" +
          "<div class='fo-pp-role'><img src='" + ART() + iconOf({ role: sp.role, keeper: sp.keeper, bowlType: sp.type, btLabel: sp.bowl }) + "' alt='' onerror=\"this.style.display='none'\">" +
          "<div><b>" + E(kind) + "</b><i>" + (sp.hand === "L" ? "Left-hand bat" : "Right-hand bat") + "</i>" +
          "<i>" + E(bowls ? sp.bowl : "Does not bowl") + "</i></div></div></div>" +
          "<div class='fo-pp-card'><h3>His club</h3><p>He plays for " + E(clubNm || "a world club") + ".</p>" +
          "<a class='fo-pp-more' href='#/team?c=" + E(cid) + "&s=" + slot + "'>The club dossier &rsaquo;</a></div>" +
          "</div>";
      }

      var wrap = document.createElement("div");
      wrap.className = "fo-pp fo-pp-scout";
      wrap.innerHTML = "<a class='fo-pp-back' href='#/team?c=" + E(cid) + "&s=" + slot + "'>&lsaquo; " + E(clubNm || "The club") + "</a>" +
        plate +
        "<div class='fo-pp-tabs'>" +
        [["overview", "Overview"], ["career", "Career"], ["country", "Country"]].map(function (t) {
          return "<a class='" + (CARD_TAB === t[0] ? "on" : "") + "' data-t='" + t[0] + "' href='javascript:void 0'>" + t[1] + "</a>";
        }).join("") + "</div>" +
        "<div class='fo-pp-body'>" + room + "</div>";
      page.innerHTML = "";
      page.appendChild(wrap);
      wrap.querySelectorAll(".fo-pp-tabs a").forEach(function (a) {
        a.addEventListener("click", function (ev) { ev.preventDefault(); CARD_TAB = a.getAttribute("data-t"); buildCard(cid, slot, name); });
      });
    } catch (e) { try { console.warn("foPlayerCard", e); } catch (e2) {} }
  }

  // ---- what the engine keeps: the career in four numbers ---------------------
  // THE FRIENDLIES LINE. Exhibitions keep a book of their OWN (living.mjs):
  // they never touch the career, the form or the legs, but a match a manager
  // staged should still be findable on the man's page.
  function frLine(p) {
    try {
      var fb = p && p.friendly;
      if (!fb || !fb.m) return "";
      var bits = [fb.runs + " run" + (fb.runs === 1 ? "" : "s") + (fb.hs ? " (HS " + fb.hs + ")" : "")];
      if (fb.wkts) bits.push(fb.wkts + " wkt" + (fb.wkts === 1 ? "" : "s") + (fb.bb ? " (best " + fb.bb.w + "/" + fb.bb.r + ")" : ""));
      if (fb.ct || fb.st) bits.push(((fb.ct || 0) + (fb.st || 0)) + " ct");
      return "<p class='fo-pp-frline'><b>Friendlies</b> &middot; " + fb.m + " match" + (fb.m === 1 ? "" : "es") +
        " &middot; " + bits.join(" &middot; ") + "</p>";
    } catch (e) { return ""; }
  }
  function miniCareer(p) {
    // THE UMPIRE'S BOOK FIRST. A claimed club's matches are played on the
    // server, so nothing lands in the local record - but the adopted squad
    // carries each man's served career, refreshed after every round.
    try {
      var sc = p && p.career;
      if (sc && sc.m) {
        return [["Matches", sc.m], ["Runs", sc.runs || 0], ["Best", sc.hs || 0], ["Wickets", sc.wkts || 0]].map(function (x) {
          return "<div><b>" + x[1] + "</b><i>" + x[0] + "</i></div>";
        }).join("") + frLine(p);
      }
      // no league record yet, but exhibitions already played read out here
      if (p && p.friendly && p.friendly.m) {
        return frLine(p) + "<p class='fo-pp-dim'>His league record starts the day he is picked.</p>";
      }
    } catch (eSv) {}
    var h = [];
    try { h = (App.playerHist && App.playerHist[p.name]) || []; } catch (e) {}
    var lg = h.filter(function (e) { return !(e.fr || e.s == null); });
    var inns = 0, runs = 0, outs = 0, ct = 0;
    lg.forEach(function (e) {
      var rr = +e.rr || 0, bb = +e.bb || 0;
      if (bb > 0 || rr > 0 || e.o) { inns++; runs += rr; outs += e.o ? 1 : 0; }
    });
    try { ct = ((App.fieldStats && App.fieldStats[p.name]) || {}).ct || 0; } catch (e2) {}
    var ave = outs ? (runs / outs).toFixed(1) : "&mdash;";
    return [["Innings", inns], ["Runs", runs], ["Average", ave], ["Catches", ct]].map(function (x) {
      return "<div><b>" + x[1] + "</b><i>" + x[0] + "</i></div>";
    }).join("") + (inns ? "" : "<p class='fo-pp-dim'>The record starts on the next matchday.</p>");
  }
  // ---- THE MATCH LOG THE UMPIRE KEEPS ---------------------------------------
  // A world club's matches are played on the server, so the engine's "Recent
  // matches" panel (the local record) never fills for them - the log sat empty
  // for men who had played. The nation's book lists every settled fixture, and
  // migration 025 banks the full card; this reads the club's matches from the
  // book and the man's own lines from the cards - batting, bowling, catches -
  // every number as banked on the day.
  var PP_SB = "https://egaipdksvztqqgouriyc.supabase.co";
  var PP_KEY = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  var PP_CARDS = {};
  function ppCard(nat, id) {
    var k = nat + "|" + id;
    if (PP_CARDS[k]) return PP_CARDS[k];
    var pr = fetch(PP_SB + "/rest/v1/rpc/world_match_card", {
      method: "POST",
      headers: { apikey: PP_KEY, Authorization: "Bearer " + PP_KEY, "content-type": "application/json" },
      body: JSON.stringify({ p_country: nat, p_match_id: id })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.card) ? j.card : null; })
      .catch(function () { return null; });
    PP_CARDS[k] = pr;
    return pr;
  }
  function ppOvers(balls) { balls = balls | 0; return Math.floor(balls / 6) + (balls % 6 ? "." + (balls % 6) : ""); }
  function ppWorldRid(hit) {
    try { if (hit.world && hit.world.rid) return hit.world.rid; } catch (e) {}
    try {
      if (isMine(hit.p.name)) {
        var cl = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null");
        return (cl && cl.country) || null;
      }
    } catch (e2) {}
    return null;
  }
  function ppServedLog(p, hit, team) {
    var rid = ppWorldRid(hit); if (!rid) return null;
    var book = null;
    try { book = window.__foWorldLg && window.__foWorldLg.get && window.__foWorldLg.get(rid); } catch (e) {}
    var results = (book && book.results) || [];
    var names = {};
    if (team && team.name) names[team.name] = 1;
    try {
      var slot = hit.world && hit.world.slot;
      if (slot != null) {
        (window.__foPlanet.sidesOf(rid) || []).forEach(function (sd) { if (sd.slot === (slot | 0)) names[sd.name] = 1; });
        var nm = window.__foWorldNames && window.__foWorldNames.get(rid);
        if (nm && nm[slot] != null) names[nm[slot]] = 1;
      }
    } catch (e2) {}
    var ms = results.filter(function (m) { return names[m.home] || names[m.away]; });
    if (!ms.length) return null;
    ms.sort(function (a, b) { return (b.round | 0) - (a.round | 0); });
    return { rid: rid, names: names, ms: ms.slice(0, 24) };
  }
  function ppLineFromCard(card, names, pname) {
    var out = { bat: "", bowl: "", ct: 0 };
    try {
      (card.innings || []).forEach(function (inn) {
        if (names[inn.batTeam]) (inn.bat || []).forEach(function (r) {
          if (r && r.p && r.p.name === pname) out.bat = r.r + (r.out ? "" : "*") + " (" + r.b + ")";
        });
        if (names[inn.bowlTeam]) {
          var bw = inn.bowlers && inn.bowlers[pname];
          if (bw) out.bowl = bw.w + "-" + bw.r + " (" + ppOvers(bw.b) + ")";
          var f = inn.fielding && inn.fielding[pname];
          if (f) out.ct += (f.ct | 0) + (f.st | 0);
        }
      });
    } catch (e) {}
    return out;
  }
  function ppFillLog(p, hit, team) {
    var got = ppServedLog(p, hit, team);
    if (!got) {
      // the book may simply not be on this device yet - send for it, once
      try {
        var rid0 = ppWorldRid(hit), LGx = window.__foWorldLg;
        if (rid0 && LGx && LGx.want && !ppFillLog.__asked) {
          ppFillLog.__asked = 1;
          LGx.want(rid0, function () { try { if (onPage() && TAB === "matches") ppFillLog(p, hit, team); } catch (eW) {} });
        }
      } catch (e) {}
      return false;
    }
    var sig = location.hash;
    Promise.all(got.ms.map(function (m) { return ppCard(got.rid, m.id); })).then(function (cards) {
      if (location.hash !== sig || !onPage() || TAB !== "matches") return;
      var slot = document.querySelector("#page .fo-pp-slot[data-slot='recent']"); if (!slot) return;
      var rows = got.ms.map(function (m, i) {
        var mineHome = !!got.names[m.home];
        var opp = mineHome ? m.away : m.home;
        var res = !m.winner ? "&mdash;" : got.names[m.winner] ? "Won" : "Lost";
        var line = cards[i] ? ppLineFromCard(cards[i], got.names, p.name) : null;
        var bits = [];
        if (line && line.bat) bits.push(line.bat);
        if (line && line.bowl) bits.push(line.bowl);
        if (line && line.ct) bits.push(line.ct + " ct");
        var his = bits.length ? bits.join(" &middot; ") : (cards[i] ? "no recorded involvement" : "card on its way");
        // EVERY LINE IS A DOOR. A man's match log named the fixture and then
        // left the reader to go and find it; the report is one address away
        // and the log has always known it - nation plus the World Service's
        // match id, the same address the fixtures list uses.
        var to = (got.rid && m.id)
          ? "#/report?n=" + encodeURIComponent(got.rid) + "&w=" + encodeURIComponent(m.id) : "";
        var fix = (mineHome ? "v " : "at ") + E(opp);
        return "<tr><td>R" + (m.round | 0) + "</td><td>" +
          (to ? "<a class='fo-pp-mlink' href='" + to + "'>" + fix + "<i>&rsaquo;</i></a>" : fix) + "</td>" +
          "<td class='" + (res === "Won" ? "w" : res === "Lost" ? "l" : "") + "'>" + res + "</td>" +
          "<td>" + his + "</td><td class='sm'>League</td></tr>";
      }).join("");
      // THE EXHIBITIONS TOO. The umpire folds every banked friendly into a
      // book of its own (living.mjs) - the man's lines ride the squad, so
      // the log can list them long after the ball-by-ball is purged.
      var frRows = "";
      try {
        frRows = ((p.friendly && p.friendly.log) || []).map(function (l) {
          var bits = [];
          if ((l.b | 0) > 0 || (l.r | 0) > 0) bits.push(l.r + (l.out ? "" : "*") + " (" + l.b + ")");
          if ((l.ovb | 0) > 0) bits.push(l.w + "-" + l.conc + " (" + ppOvers(l.ovb) + ")");
          // play_at_ms is a bigint, and a bigint crosses the wire as a STRING -
          // new Date("1786881600000") is not a timestamp to JS, it is a date
          // string it cannot parse, and every friendly in the log read
          // "Invalid Date". Number it first, and refuse anything that is not
          // a real instant rather than printing the words.
          var dt = "&mdash;";
          try {
            var ms = +l.at, dd = ms ? new Date(ms) : null;
            if (dd && isFinite(dd.getTime())) dt = dd.toLocaleDateString([], { day: "numeric", month: "short" });
          } catch (eD) {}
          var res9 = l.win === true ? "Won" : l.win === false ? "Lost" : "&mdash;";
          var toF = l.id ? "#/report?fr=" + encodeURIComponent(l.id) : "";
          var fixF = "v " + E(l.opp || "");
          return "<tr><td>" + dt + "</td><td>" +
            (toF ? "<a class='fo-pp-mlink' href='" + toF + "'>" + fixF + "<i>&rsaquo;</i></a>" : fixF) + "</td>" +
            "<td class='" + (l.win === true ? "w" : l.win === false ? "l" : "") + "'>" + res9 + "</td>" +
            "<td>" + (bits.length ? bits.join(" &middot; ") : "no recorded involvement") + "</td>" +
            "<td class='sm'>Friendly</td></tr>";
        }).join("");
      } catch (eFr) {}
      slot.innerHTML = "<div class='panel' data-fo-servedlog><h4>Recent matches</h4><div class='pad'>" +
        "<table class='fo-pp-log'><tr><th>Rd</th><th>Fixture</th><th>Result</th><th>His match</th><th></th></tr>" + rows + frRows + "</table>" +
        "<p class='fo-pp-dim'>From the umpire's book &middot; every line as banked on the day.</p></div></div>";
      try { filterLog(activeFilter()); } catch (eF2) {}
    });
    return true;
  }
  function honoursHtml(p, team) {
    var got = [];
    try {
      (p._career || []).forEach(function (c) {
        if (/award|player of|cap|honour|champion/i.test(c.txt || "")) got.push(c.txt);
      });
    } catch (e) {}
    if (!got.length) return "<div class='fo-pp-empty'><b>No honours yet</b><span>Every cabinet begins empty.</span></div>";
    return "<div class='fo-pp-story'>" + got.slice(0, 6).map(function (t) {
      return "<div class='fo-pp-ev done'><i></i><span>" + E(t) + "</span></div>";
    }).join("") + "</div>";
  }
  function meter(lbl, val, pct) {
    return "<div class='fo-pp-meter'><i>" + E(lbl) + "</i><em>" + E(val) + "</em><u><b style='width:" +
      Math.max(3, Math.min(100, Math.round(pct || 0))) + "%'></b></u></div>";
  }

  // ---- filing: the chronicle's panels move into the rooms --------------------
  function pick(re) {
    var page = document.getElementById("page"); if (!page) return null;
    return Array.prototype.filter.call(page.querySelectorAll(".panel"), function (pn) {
      var h = pn.querySelector("h4"); return h && re.test((h.textContent || "").trim());
    })[0] || null;
  }
  function harvest() {
    try {
      if (!onPage()) return;
      var wrap = document.querySelector("#page .fo-pp"); if (!wrap) return;
      var want = { career: document.getElementById("fo-career"), recent: pick(/^Recent matches/i),
        dev: document.querySelector("#page .fo-pop-dev"), record: document.querySelector("#page .fo-ls-career") };
      wrap.querySelectorAll(".fo-pp-slot").forEach(function (slot) {
        // the umpire's own log stands; the empty local panel must not join it
        if (slot.getAttribute("data-slot") === "recent" && slot.querySelector("[data-fo-servedlog]")) return;
        var node = want[slot.getAttribute("data-slot")];
        if (node && node.parentNode !== slot) slot.appendChild(node);
        if (slot.getAttribute("data-slot") === "recent") filterLog(activeFilter());
      });
    } catch (e) {}
  }
  function activeFilter() {
    var a = document.querySelector("#page .fo-pp-filt a.on");
    return a ? a.getAttribute("data-f") : "all";
  }
  function filterLog(f) {
    try {
      var slot = document.querySelector("#page .fo-pp-slot[data-slot='recent']"); if (!slot) return;
      slot.querySelectorAll("table tr").forEach(function (tr, ix) {
        if (!ix || tr.querySelector("th")) return;
        var fr = /friendly/i.test(tr.textContent || "");
        tr.style.display = (f === "lg" && fr) || (f === "fr" && !fr) ? "none" : "";
      });
    } catch (e) {}
  }

  // ---- the page paints after the engine, and files after the decorators -----
  if (typeof window.pgPlayer === "function" && !window.pgPlayer.__foPP2) {
    var prev = window.pgPlayer;
    var PG_LAST = null;
    window.pgPlayer = function () {
      var out = prev.apply(this, arguments);
      try {
        // THE TAB SURVIVES A REPAINT. The engine re-routes for reasons of its
        // own - a snapshot landing, a decorator's route() - and this wrapper
        // was resetting the tab to Overview on every one of them, so a tap on
        // Development held for the ~50ms until the next repaint threw it
        // away. A NEW man starts on Overview; the same man keeps his room.
        var nm9 = qName();
        if (nm9 !== PG_LAST) { PG_LAST = nm9; TAB = "overview"; }
        build();
      } catch (e) { try { console.warn("foPlayerPage", e); } catch (e2) {} }
      return out;
    };
    window.pgPlayer.__foPP2 = 1;
  }
  var prevAfter = window.foAfterRoute;
  window.foAfterRoute = function () {
    if (typeof prevAfter === "function") { try { prevAfter.apply(this, arguments); } catch (e) {} }
    try { harvest(); } catch (e2) {}
  };
  window.addEventListener("hashchange", function () { setTimeout(harvest, 120); setTimeout(harvest, 400); });

  var CSS = [
    "html body #page .fo-pp{position:relative;max-width:1000px;margin:14px auto 44px;padding:0 12px;color:#1B2432;--navy:#0C1B2E;--gold:#8F6A1C;--nac:#C9571F}",
    "html body #page .fo-pp-attic{display:none}",
    // ---- the umpire's match log --------------------------------------------
    "html body #page .fo-pp-slot[data-slot='recent'] .pad{overflow-x:auto}",
    "html body #page .fo-pp-log{width:100%;border-collapse:collapse;font:500 12.5px Manrope,sans-serif}",
    "html body #page .fo-pp-log th{font:700 11px Manrope,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#8a8272;text-align:left;padding:6px 8px;border-bottom:1px solid #eee7d9;white-space:nowrap}",
    "html body #page .fo-pp-log td{padding:9px 8px;border-bottom:1px solid #f3eee1;color:#1B2432}",
    "html body #page .fo-pp-log tr:last-child td{border-bottom:none}",
    "html body #page .fo-pp-log td.w{color:#177A57;font-weight:700}",
    "html body #page .fo-pp-log td.l{color:#8E1F13;font-weight:700}",
    // the fixture is the door: a link that reads as one, with the chevron
    // that every other door in the game wears
    "html body #page .fo-pp-log a.fo-pp-mlink{color:#B44A22 !important;text-decoration:none !important;display:inline-flex;align-items:center;gap:5px;min-height:24px}",
    "html body #page .fo-pp-log a.fo-pp-mlink:hover{text-decoration:underline !important;text-underline-offset:3px}",
    "html body #page .fo-pp-log a.fo-pp-mlink i{font-style:normal;color:#C9A24B}",
    "html body #page .fo-pp-log td.sm{font-size:10.5px;color:#8a8272;white-space:nowrap}",
    "html body #page a.fo-pp-back{display:inline-flex;align-items:center;min-height:44px;padding:0 12px;margin:0 -12px 6px;border-radius:12px;font:700 11px/1 Manrope,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:var(--nac);text-decoration:none}",
    // ---- the hero -----------------------------------------------------------
    "html body #page .fo-pp-plate{position:relative;display:grid;grid-template-columns:236px minmax(0,1fr) auto;gap:20px;align-items:start;background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:18px;padding:16px 18px;box-shadow:0 10px 30px rgba(30,38,52,.07)}",
    // THE HEAD IS NEVER CROPPED, WHATEVER SHAPE THE ART IS.
    //
    // The player art arrives in two families - 74 tall portraits (556x941 and
    // near, aspect 0.55-0.62) and 54 squares (512x512) - and one rule with one
    // object-position was serving both through a LANDSCAPE window. Cover scales
    // to the width, so a 0.55 portrait shows only 41% of its own height in a
    // 4:3 frame and 34% in the 16:10 phone banner; pushing that band DOWN by
    // 12% and 22% respectively started it below the chin. Rendered all twelve
    // sample crops side by side: heads cut on the portraits at both settings,
    // and worst on the phone - which is exactly the card that was reported.
    //
    // The band is anchored to the TOP instead. The head is at the top of every
    // one of these paintings, so 0% is the one position that cannot cut it, in
    // either family, at any frame ratio.
    "html body #page .fo-pp-cardart{position:relative;border-radius:12px;overflow:hidden;background:linear-gradient(160deg,#12294A,#0A1526 70%);box-shadow:inset 0 0 0 2px rgba(201,162,75,.55);aspect-ratio:4/3}",
    "html body #page .fo-pp-cardart img{width:100%;height:100%;object-fit:cover;object-position:50% 0%;display:block}",
    // THREE PAINTINGS ARE COMPOSED THE OTHER WAY UP.
    //
    // "The head is at the top" holds for 126 of the 129: the batting, bowling
    // and national keeper arts all put the man's face in the top of the frame,
    // and anchoring there is what stopped them being cropped. These three do
    // not. leg_wk, vb_wk and vc_wk hang a great chalk glove across the upper
    // two thirds and put the keeper crouching UNDER it, so the one anchor that
    // saves every other painting is the one that frames a glove and squeezes
    // the man off the bottom edge - which is exactly what was reported.
    //
    // Rendered all fifteen keeper arts at five anchors to find out which ones
    // actually needed it rather than moving the whole family: the twelve
    // national ones are right at the top and only these three are not. Named
    // individually, because a rule that moved all of them would break twelve
    // to fix three.
    "html body #page .fo-pp-cardart img[src$='leg_wk.webp']," +
    "html body #page .fo-pp-cardart img[src$='vb_wk.webp']," +
    "html body #page .fo-pp-cardart img[src$='vc_wk.webp']{object-position:50% 38%}",
    "html body #page .fo-pp-no{position:absolute;z-index:2;left:9px;bottom:7px;text-shadow:0 1px 4px rgba(6,12,24,.9);font:700 11px/1 Manrope,sans-serif;letter-spacing:.16em;color:rgba(232,214,168,.85)}",
    "html body #page .fo-pp-id{min-width:0}",
    "html body #page .fo-pp-k{font:700 11px/1 Manrope,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:var(--nac)}",
    "html body #page .fo-pp h1{margin:6px 0 3px;font-family:Fraunces,Georgia,serif;font-weight:600;font-variant-caps:small-caps;font-size:38px;line-height:1;letter-spacing:.01em;color:#1B2432}",
    "html body #page .fo-pp h1 .fo-pp-fl img{width:26px;vertical-align:-2px}",
    "html body #page .fo-pp-prov{margin:0;font:420 12.5px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.6)}",
    "html body #page .fo-pp-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;margin:13px 0 0;border-top:1px solid rgba(20,28,40,.1);border-bottom:1px solid rgba(20,28,40,.1)}",
    "html body #page .fo-pp-strip.two{grid-template-columns:repeat(2,minmax(0,1fr));border-top:0}",
    "html body #page .fo-pp-strip.three{grid-template-columns:repeat(3,minmax(0,1fr));border-top:0}",
    "html body #page .fo-pp-strip b.fo-pp-fat{display:inline-flex;align-items:center;gap:6px;justify-content:center}",
    "html body #page .fo-pp-fat s{display:inline-block;width:9px;height:9px;border-radius:50%;text-decoration:none;flex:0 0 auto;vertical-align:0}",
    "html body #page .fo-pp-fat.cool s{background:#177A57}",
    "html body #page .fo-pp-fat.warm s{background:#D08A1E}",
    "html body #page .fo-pp-fat.hot s{background:#B23230}",
    "html body #page .fo-pp-mini.wide{grid-template-columns:repeat(4,minmax(0,1fr));row-gap:14px}",
    "html body #page .fo-pp-strip>div{padding:9px 10px;text-align:center;border-right:1px solid rgba(20,28,40,.08);min-width:0}",
    "html body #page .fo-pp-strip>div:last-child{border-right:0}",
    "html body #page .fo-pp-strip b{display:block;font:600 13px/1.25 Manrope,sans-serif;color:#1B2432;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    "html body #page .fo-pp-strip b .fo-pp-ud{font-size:.68em;font-weight:600;opacity:.5;margin:0 .12em 0 .04em}",
    "html body #page .fo-pp-strip i{display:block;margin-top:4px;font:700 11px/1 Manrope,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.42);font-style:normal}",
    // a man's club is a door: it reads like the cells beside it until you
    // touch it, and the whole cell is the tap target
    "html body #page a.fo-pp-clubl{display:block;margin:-9px -10px;padding:9px 10px;text-decoration:none;color:inherit;border-radius:9px}",
    "html body #page a.fo-pp-clubl:hover,html body #page a.fo-pp-clubl:focus-visible{background:rgba(201,85,50,.07);text-decoration:none}",
    "html body #page a.fo-pp-clubl:hover b,html body #page a.fo-pp-clubl:focus-visible b{color:#B44A22}",
    "html body #page a.fo-pp-clubl i{color:#B44A22}",
    "html body #page .fo-pp-sc{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:13px 0 0}",
    "html body #page .fo-pp-scv i{font:700 11px/1 Manrope,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.45);font-style:normal}",
    "html body #page .fo-pp-scv em{float:right;font:700 13px/1 Manrope,sans-serif;font-style:normal;color:#1B2432;font-variant-numeric:tabular-nums}",
    "html body #page .fo-pp-scv u{display:block;clear:both;height:5px;border-radius:999px;background:rgba(20,28,40,.09);margin-top:6px;text-decoration:none;overflow:hidden}",
    "html body #page .fo-pp-scv u b{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#12294A,#2C5C93)}",
    "html body #page .fo-pp-ovr{flex:0 0 auto;text-align:center;background:linear-gradient(160deg,#12294A,#0A1526);border:1.5px solid rgba(201,162,75,.6);border-radius:12px;padding:8px 14px 7px;line-height:1}",
    "html body #page .fo-pp-ovr b{display:block;font:600 34px/1 Manrope,sans-serif;color:#E8C06A}",
    "html body #page .fo-pp-ovr i{font-style:normal;font:600 11px/1 Manrope,sans-serif;letter-spacing:.2em;color:rgba(232,214,168,.7)}",
    "html body #page .fo-pp-tals{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-top:13px}",
    "html body #page .fo-pp-tal{display:flex;gap:9px;align-items:flex-start;border:1px solid rgba(201,162,75,.4);border-radius:10px;padding:8px 10px;background:rgba(201,162,75,.06)}",
    "html body #page .fo-pp-talk{flex:0 0 auto;font:700 11px/1 Manrope,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#0C1B2E;background:var(--gold);border-radius:5px;padding:3px 6px;margin-top:1px}",
    "html body #page .fo-pp-tal b{display:block;font:600 13px/1.3 Manrope,sans-serif;color:#1B2432}",
    "html body #page .fo-pp-tal p{margin:2px 0 0;font:400 13px/1.4 Manrope,sans-serif;color:rgba(20,28,40,.55)}",
    // ---- the rooms ----------------------------------------------------------
    "html body #page .fo-pp-tabs{display:flex;gap:2px;margin:14px 0 14px;border-bottom:1px solid rgba(20,28,40,.12);overflow-x:auto}",
    // a tab with no rail beside it: the column takes the whole width
    "html body #page .fo-pp-wide{grid-column:1 / -1}",
    "html body #page .fo-pp-tabs a{flex:0 0 auto;padding:9px 15px 10px;font:700 11px/1 Manrope,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.46);text-decoration:none;border-bottom:2px solid transparent;margin-bottom:-1px;cursor:pointer}",
    "html body #page .fo-pp-tabs a.on{color:#1B2432;border-bottom-color:#177A57}",
    // THE TALENTS ROOM. A bar per talent he is on his way to, because the one
    // number that matters is how close he is - it is both the progress and,
    // read straight off, the chance the talent fires on the next ball that
    // suits it. The count underneath is there so it reads as cricket he has
    // played rather than a loading bar.
    "html body #page .fo-pp-learn{display:grid;grid-template-columns:1fr auto;gap:3px 10px;margin:0 0 11px}",
    "html body #page .fo-pp-learn i{font:600 12.5px/1.3 Manrope,sans-serif;font-style:normal;color:#1B2432}",
    "html body #page .fo-pp-learn em{font:700 12.5px/1.3 Manrope,sans-serif;font-style:normal;color:#B08409;font-variant-numeric:tabular-nums;text-align:right}",
    "html body #page .fo-pp-learn u{grid-column:1/-1;display:block;height:5px;border-radius:3px;background:rgba(20,28,40,.09);text-decoration:none;overflow:hidden}",
    "html body #page .fo-pp-learn u b{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#E8B96A,#8F6A1C)}",
    // a talent he EARNED is not a talent he was dealt, and the card says which
    "html body #page .fo-pp-talk.won{background:#14243A;color:#E8B96A}",
    "html body #page .fo-pp-body{display:block}",
    "html body #page .fo-pp-rail{margin-top:12px}",
    "html body #page .fo-pp-card{background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:14px;padding:15px 16px;margin-bottom:12px;box-shadow:0 6px 18px rgba(30,38,52,.05)}",
    "html body #page .fo-pp-card.pad0{padding:0}",
    "html body #page .fo-pp-card h3{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0 0 11px;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:17px;color:#1B2432}",
    "html body #page .fo-pp-card h3 span{font:700 11px/1 Manrope,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.42)}",
    "html body #page .fo-pp-card p{margin:9px 0 0;font:420 12.5px/1.55 Fraunces,Georgia,serif;color:rgba(20,28,40,.6)}",
    "html body #page .fo-pp-card.dark{background:linear-gradient(150deg,#0C1B2E,#16304F);border-color:rgba(12,27,51,.4);color:#FFFEFC}",
    "html body #page .fo-pp-card.dark h3{color:#E8C06A}",
    "html body #page .fo-pp-card.dark p{color:rgba(255,254,252,.72)}",
    "html body #page .fo-pp-card.dark a{color:#E8C06A}",
    "html body #page .fo-pp-dim{margin:9px 0 0;font:420 13px/1.55 Fraunces,Georgia,serif;color:rgba(20,28,40,.55)}",
    "html body #page .fo-pp-frline{grid-column:1/-1;margin:8px 0 0;padding-top:8px;border-top:1px solid rgba(20,28,40,.08);font:500 12.5px/1.5 Manrope,sans-serif;color:rgba(20,28,40,.62)}",
    "html body #page .fo-pp-frline b{font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:10.5px;color:#8A6A1F}",
    "html body #page a.fo-pp-more{display:inline-block;margin-top:10px;font:600 13px/1 Manrope,sans-serif;color:var(--nac);text-decoration:none}",
    "html body #page .fo-pp-ph{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:14px 16px 8px}",
    "html body #page .fo-pp-ph h3{margin:0}",
    "html body #page .fo-pp-filt{display:flex;gap:4px}",
    "html body #page .fo-pp-filt a{font:700 11px/1 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.5);border:1px solid rgba(20,28,40,.14);border-radius:999px;padding:6px 11px;cursor:pointer;text-decoration:none}",
    "html body #page .fo-pp-filt a.on{background:#0C1B2E;border-color:#0C1B2E;color:#FFFEFC}",
    // shape + bars
    "html body #page .fo-pp-shape{display:grid;grid-template-columns:198px minmax(0,1fr);gap:16px;align-items:center}",
    "html body #page .fo-pp-radar{width:100%;height:auto;overflow:visible}",
    "html body #page .fo-pp-radar .fo-pp-rlab{font:700 11px Manrope,sans-serif;letter-spacing:.1em;fill:rgba(20,28,40,.45)}",
    "html body #page .fo-pp-bars{display:flex;flex-direction:column;gap:7px}",
    "html body #page .fo-pp-bar{display:grid;grid-template-columns:74px minmax(0,1fr) 26px;align-items:center;gap:9px}",
    "html body #page .fo-pp-bar i{font:700 11px/1 Manrope,sans-serif;letter-spacing:.12em;color:rgba(20,28,40,.5);font-style:normal}",
    "html body #page .fo-pp-bar u{display:block;height:6px;border-radius:999px;background:rgba(20,28,40,.08);overflow:hidden;text-decoration:none}",
    "html body #page .fo-pp-bar u b{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#8F6A1C,#E8C06A)}",
    "html body #page .fo-pp-bar em{text-align:right;font:600 13px/1 Manrope,sans-serif;font-style:normal;color:#1B2432;font-variant-numeric:tabular-nums}",
    "html body #page .fo-pp-adv{margin-top:12px}",
    "html body #page .fo-pp-adv summary{font:600 13px/1 Manrope,sans-serif;color:var(--nac);cursor:pointer}",
    // WHICH NUMBER BELONGS TO WHICH LABEL.
    //
    // The pairs were ruled rows in a two-column grid with five pixels between
    // the columns, and the value was pushed hard to the right of its own cell -
    // so on a phone "vsPace 50" sat flush against "vsSpin", and the 50 read as
    // the spin figure. Reported from a phone, and it was right: nothing in the
    // layout said where one pair ended and the next began.
    //
    // Each pair is a block of its own now, with its own ground and its own
    // border. The reading is unambiguous however many columns the width
    // happens to give, which a wider gutter alone could not promise.
    "html body #page .fo-pp-advg{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:6px;margin-top:9px}",
    "html body #page .fo-pp-advg span{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font:500 13px/1.4 Manrope,sans-serif;color:rgba(20,28,40,.62);background:rgba(20,28,40,.04);border:1px solid rgba(20,28,40,.08);border-radius:8px;padding:5px 10px}",
    "html body #page .fo-pp-advg.rest{margin:9px 0 4px}",
    "html body #page .fo-pp-advg.rest span{color:#1B2432;background:rgba(201,162,75,.13);border-color:rgba(201,162,75,.42)}",
    "html body #page .fo-pp-advg.rest i{color:rgba(20,28,40,.5)}",
    "html body #page .fo-pp-advg b{color:#1B2432;font-variant-numeric:tabular-nums}",
    // mini career, meters, story, positions
    "html body #page .fo-pp-mini{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;text-align:center}",
    "html body #page .fo-pp-mini b{display:block;font:600 21px/1 Manrope,sans-serif;color:#1B2432;font-variant-numeric:tabular-nums}",
    "html body #page .fo-pp-mini i{display:block;margin-top:5px;font:700 11px/1 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.42);font-style:normal}",
    "html body #page .fo-pp-mini p{grid-column:1/-1}",
    "html body #page .fo-pp-meter{display:grid;grid-template-columns:70px minmax(0,1fr);gap:4px 10px;margin-bottom:10px}",
    "html body #page .fo-pp-meter i{font:700 11px/1.2 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.5);font-style:normal;align-self:center}",
    "html body #page .fo-pp-meter em{font:600 13px/1.2 Manrope,sans-serif;font-style:normal;color:#1B2432;text-align:right}",
    "html body #page .fo-pp-meter u{grid-column:1/-1;display:block;height:6px;border-radius:999px;background:rgba(20,28,40,.08);overflow:hidden;text-decoration:none}",
    "html body #page .fo-pp-meter u b{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#12294A,#2C5C93)}",
    "html body #page .fo-pp-card.dark .fo-pp-meter i{color:rgba(255,254,252,.6)}",
    "html body #page .fo-pp-card.dark .fo-pp-meter em{color:#FFFEFC}",
    "html body #page .fo-pp-story{display:flex;flex-direction:column;gap:0}",
    "html body #page .fo-pp-ev{display:flex;gap:10px;align-items:flex-start;padding:7px 0}",
    "html body #page .fo-pp-ev i{flex:0 0 auto;width:15px;height:15px;border-radius:50%;border:2px solid rgba(20,28,40,.18);margin-top:2px}",
    "html body #page .fo-pp-ev.done i{background:#177A57;border-color:#177A57;position:relative}",
    "html body #page .fo-pp-ev.done i:after{content:'';position:absolute;left:4px;top:1.5px;width:4px;height:7px;border:solid #FFFEFC;border-width:0 2px 2px 0;transform:rotate(45deg)}",
    "html body #page .fo-pp-ev span{font:420 12.5px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.7)}",
    "html body #page .fo-pp-ev u{display:block;text-decoration:none;font:700 11px/1 Manrope,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--nac);font-style:normal;margin-bottom:3px}",
    "html body #page .fo-pp-pos{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}",
    "html body #page .fo-pp-pos span{width:23px;height:23px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font:600 11px/1 Manrope,sans-serif;color:rgba(20,28,40,.4);background:rgba(20,28,40,.05)}",
    "html body #page .fo-pp-pos span.on{background:#0C1B2E;color:#E8C06A;box-shadow:0 0 0 3px rgba(12,27,51,.12)}",
    "html body #page .fo-pp-role{display:flex;gap:11px;align-items:center}",
    "html body #page .fo-pp-role img{width:38px;height:38px;object-fit:contain;opacity:.85}",
    "html body #page .fo-pp-role b{display:block;font:600 13px/1.3 Manrope,sans-serif;color:#1B2432}",
    "html body #page .fo-pp-role i{display:block;font:420 13px/1.45 Fraunces,Georgia,serif;color:rgba(20,28,40,.55)}",
    "html body #page .fo-pp-nx{display:flex;align-items:center;justify-content:center;gap:10px;font:600 13px/1.3 Manrope,sans-serif;color:#FFFEFC;text-align:center}",
    "html body #page .fo-pp-nx i{font:400 13px/1 Fraunces,Georgia,serif;color:rgba(255,254,252,.45)}",
    "html body #page .fo-pp-nxm{margin-top:6px;text-align:center;font:700 11px/1.5 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,254,252,.6)}",
    "html body #page .fo-pp-nxbat{margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,254,252,.14);text-align:center;font:600 13px/1.3 Manrope,sans-serif;color:#E8C06A}",
    "html body #page .fo-pp-nxbat span{display:block;margin-top:3px;font:420 13px/1.4 Fraunces,Georgia,serif;color:rgba(255,254,252,.55)}",
    "html body #page .fo-pp-track{display:flex;flex-wrap:wrap;gap:6px}",
    "html body #page .fo-pp-track span{font:700 11px/1 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.55);background:rgba(20,28,40,.05);border-radius:999px;padding:7px 11px}",
    "html body #page .fo-pp-hist{display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:10px;align-items:baseline;padding:9px 0;border-top:1px solid rgba(20,28,40,.08)}",
    "html body #page .fo-pp-hist .se{font:700 11px/1 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.45)}",
    "html body #page .fo-pp-hist .cl{font:600 13px/1.2 Manrope,sans-serif;color:#1B2432}",
    "html body #page .fo-pp-hist .st{font:420 13px/1.4 Fraunces,Georgia,serif;color:rgba(20,28,40,.55);text-align:right}",
    "html body #page .fo-pp-chips{display:flex;flex-wrap:wrap;gap:7px}",
    "html body #page .fo-pp-chips span{display:inline-flex;align-items:center;gap:6px;font:600 13px/1 Manrope,sans-serif;color:rgba(20,28,40,.7);border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:7px 12px}",
    "html body #page .fo-pp-chips i{font-style:normal;font-size:12px}",
    "html body #page .fo-pp-empty{text-align:center;padding:12px 0 4px}",
    "html body #page .fo-pp-empty b{display:block;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:16px;color:#1B2432}",
    "html body #page .fo-pp-empty span{display:block;margin-top:4px;font:420 13px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.5)}",
    // the harvested panels wear the almanack too
    "html body #page .fo-pp-slot>.panel{background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:14px;box-shadow:0 6px 18px rgba(30,38,52,.05);margin:0 0 12px;color:#1B2432}",
    "html body #page .fo-pp-card.pad0 .fo-pp-slot>.panel{border:0;box-shadow:none;margin:0;border-radius:0}",
    "html body #page .fo-pp-card.pad0 .fo-pp-slot>.panel>h4{display:none}",
    "html body #page .fo-pp .fo-pp-slot>.panel>h4{margin:0 !important;padding:14px 16px 0 !important;font-family:Fraunces,Georgia,serif !important;font-weight:600;font-size:17px !important;color:#1B2432 !important;background:transparent !important;border:0 !important;box-shadow:none !important;letter-spacing:0;text-transform:none}",
    "html body #page .fo-pp .fo-pp-slot .fo-cp-prov{background:transparent !important;border:0 !important;padding:0 !important}",
    "html body #page .fo-pp-card.pad0 .fo-pp-slot{overflow-x:auto}",
    "html body #page .fo-pp-slot>.panel>.pad{padding:10px 16px 14px}",
    "html body #page .fo-pp-slot .panel table{width:100%;border-collapse:collapse;font:500 13px/1.4 Manrope,sans-serif;color:#1B2432}",
    "html body #page .fo-pp-slot .panel table th{font:700 11px/1 Manrope,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:rgba(20,28,40,.42);text-align:left;padding:6px 7px;border-bottom:1px solid rgba(20,28,40,.1)}",
    "html body #page .fo-pp-slot .panel table td{padding:7px;border-bottom:1px solid rgba(20,28,40,.06)}",
    "html body #page .fo-pp-slot .panel table td.n,html body #page .fo-pp-slot .panel table th.n{text-align:right;font-variant-numeric:tabular-nums}",
    "html body #page .fo-pp-slot .panel .small{font:420 13px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.55)}",
    "html body #page .fo-pp-slot .fo-cp-prov{font:420 12.5px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.6);margin-bottom:10px}",
    "html body #page .fo-pp-slot .fo-cp-tabs{display:flex;gap:4px;margin-bottom:10px}",
    "html body #page .fo-pp-slot .fo-cp-tab{font:700 11px/1 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.5);border:1px solid rgba(20,28,40,.14);border-radius:999px;padding:6px 11px;cursor:pointer;text-decoration:none}",
    "html body #page .fo-pp-slot .fo-cp-tab.on{background:#0C1B2E;border-color:#0C1B2E;color:#FFFEFC}",
    "html body #page .fo-pp-slot .fo-cp-scroll{overflow-x:auto}",
    "html body #page .fo-pp-slot .fo-cp-ev{display:flex;gap:9px;align-items:baseline;padding:5px 0;font:420 13px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.65)}",
    "html body #page .fo-pp-slot .fo-cp-ev i{font:700 11px/1 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--nac);font-style:normal;flex:0 0 auto}",
    "html body #page .fo-pp-slot .fo-pop-devln{color:rgba(20,28,40,.7)}",
    "html body #page .fo-pp-slot .fo-pop-devln i{color:rgba(20,28,40,.35)}",
    "html body #page .fo-pp-slot .fo-pop-devln b{color:#1B2432}",
    "html body #page .fo-pp-slot .fo-pop-devln span{color:rgba(20,28,40,.45)}",
    "html body #page .fo-pp-slot .fo-pop-devln.fresh i,html body #page .fo-pp-slot .fo-pop-devln.fresh b{color:#177A57}",
    "html body #page .fo-pp-slot .fo-cp-fld{font:420 13px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.55)}",
    // ---- the desk: rooms read two columns ----------------------------------
    "@media(min-width:960px){html body #page .fo-pp-body{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}",
    "html body #page .fo-pp-rail{margin-top:0}}",
    // ---- the office: the paperwork, on the man's own page -------------------
    "html body #page .fo-pp-office{display:flex;flex-direction:column;gap:10px}",
    "html body #page .fo-pp-obrow{display:flex;gap:8px;flex-wrap:wrap}",
    "html body #page button.fo-pp-ob{flex:1 1 150px;display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 14px !important;border-radius:12px !important;border:0 !important;cursor:pointer;font:700 11px/1.2 Manrope,sans-serif !important;letter-spacing:.12em;text-transform:uppercase;text-align:center;background:linear-gradient(180deg,#D06035,#B84E28) !important;color:#FFF6EE !important;box-shadow:0 2px 8px rgba(184,78,40,.25)}",
    "html body #page button.fo-pp-ob.ghost{background:#FFFEFC !important;border:1.5px solid rgba(20,36,58,.3) !important;color:#14243A !important;box-shadow:none}",
    "html body #page button.fo-pp-ob.danger{background:transparent !important;border:1.5px solid rgba(178,50,48,.45) !important;color:#B23230 !important;box-shadow:none}",
    "html body #page button.fo-pp-ob.danger:hover{background:rgba(178,50,48,.07) !important}",
    "html body #page .fo-pp-onbd{background:#FBF6EA;border:1px solid rgba(201,87,31,.35);border-left:3px solid #C9571F;border-radius:11px;padding:11px 13px}",
    "html body #page .fo-pp-onbd b{display:block;font:700 12.5px/1.2 Manrope,sans-serif;color:#14243A}",
    "html body #page .fo-pp-onbd i{display:block;margin-top:4px;font:500 13px/1.5 Manrope,sans-serif;font-style:normal;color:rgba(20,28,40,.6);font-variant-numeric:tabular-nums}",
    // ---- the phone ----------------------------------------------------------
    "@media(max-width:700px){html body #page .fo-pp{padding:0 9px}",
    // the phone reads the card as a poster: the painted man across the top,
    // his name and numbers under him
    "html body #page .fo-pp-plate{grid-template-columns:minmax(0,1fr);gap:13px;padding:0 0 14px;overflow:hidden}",
    // the phone banner was the shallowest frame of all and took the most off
    // the top; it stands a little taller now and anchors to the head like the rest
    "html body #page .fo-pp-cardart{aspect-ratio:4/3;border-radius:17px 17px 0 0}",
    "html body #page .fo-pp-cardart img{object-position:50% 0%}",
    "html body #page .fo-pp h1{font-size:27px}",
    "html body #page .fo-pp-ovr{position:absolute;right:11px;top:11px;padding:5px 10px 4px}",
    "html body #page .fo-pp-ovr b{font-size:23px}",
    "html body #page .fo-pp-id{padding:0 13px}",
    "html body #page .fo-pp-strip{grid-template-columns:repeat(2,minmax(0,1fr))}",
    "html body #page .fo-pp-strip>div:nth-child(2n){border-right:0}",
    "html body #page .fo-pp-strip>div:nth-child(-n+2){border-bottom:1px solid rgba(20,28,40,.08)}",
    "html body #page .fo-pp-shape{grid-template-columns:minmax(0,1fr)}",
    "html body #page .fo-pp-radar{max-width:210px;margin:0 auto}",
    "html body #page .fo-pp-mini,html body #page .fo-pp-mini.wide{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 6px}",
    "html body #page .fo-pp-strip.three{grid-template-columns:repeat(3,minmax(0,1fr))}",
    "html body #page .fo-pp-strip.three>div{border-bottom:0}",
    "html body #page .fo-pp-strip.three>div:nth-child(3){border-right:0}}"
  ].join("\n");

  function mount() {
    try {
      var s = document.getElementById("fo-pp-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-pp-css"; s.textContent = CSS; document.body.appendChild(s); }
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); });
  else setTimeout(mount, 0);

  window.foRenderPlayerPage = build;
})();
