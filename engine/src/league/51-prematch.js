// ---- 51-prematch.js — THE MATCH PREVIEW (#/preview) -------------------------
// Every fixture in the world was a line of text you could not press. A result
// opens its report; the match that has not been played yet opened nothing, so
// the half of the season still to come was the half you could not look at.
//
// This is the room for that half. One fixture, named and dated: the ground it
// is played at, the hour the first ball is bowled and how long that is from
// now, where the two clubs stand, the form they carry in, what happened the
// last time they met, and the men most likely to decide it. All of it is read
// off things the world already publishes - the served table, the served
// results, the umpire's own schedule and the squads the seed generates - so a
// preview costs one page and no new request.
//
// It is the Journal's front page for a match not yet played, and it is built
// in the Journal's language: the ground painted at the top, bounded and
// untouched, the billing beneath it in the mast face, and the reading below
// that on solid ground.
// ===========================================================================
(function () {
  "use strict";
  var FO_PM_ON = false;

  function foPmE(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function foPmArt() {
    return (typeof FO_ART !== "undefined") ? FO_ART
      : ((location.pathname.indexOf("/client/") !== -1) ? "art/" : "client/art/");
  }
  function foPmSlug(c) { return String(c || "").toLowerCase().replace(/\s+/g, "-"); }
  function foPmQ(k) {
    var m = new RegExp("[?&]" + k + "=([^&]*)").exec(location.hash || "");
    return m ? decodeURIComponent(m[1]) : "";
  }
  function foPmH32(s) {
    var h = 2166136261 >>> 0; s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function foPmHH(h) { return (h < 10 ? "0" : "") + h + ":00"; }
  // the engine's own field names are camelCase and its bowling label is a
  // bowling label - printing btLabel under a BATTER announced "does not bowl"
  // beside the best batsman at the club, which is true and useless
  function foPmWords(s) {
    return String(s || "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ")
      .toLowerCase().replace(/^./, function (c) { return c.toUpperCase(); }).trim();
  }

  // EVERY CLUB WEARS A SHIELD - the flagship its painted crest, the rest a
  // monogram in the colours their own name draws. Same rule as the table, so a
  // club is recognisable in whichever room you meet it.
  var FO_PM_SH = ["#8C2B2B", "#14243A", "#136A4B", "#6B3E8F", "#A8571C", "#2B6E7A", "#7A2E52", "#3E5C1E", "#3D3A6B", "#8A6A1F"];
  function foPmShield(name, isBoss, natId, big) {
    var cls = "fo-pm-sh" + (big ? " big" : "");
    if (isBoss) {
      var c = ""; try { c = window.__foCxAPI.crest(natId) || ""; } catch (e) {}
      if (c) return "<img class='" + cls + " crest' src='" + c + "' alt='' onerror=\"this.style.display='none'\">";
    }
    if (window.foClubCrest) return "<span class='" + cls + " arms'>" + window.foClubCrest(name, big ? 44 : 25) + "</span>";
    var ini = String(name || "?").replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean)
      .map(function (w) { return w.charAt(0).toUpperCase(); }).slice(0, 2).join("");
    var col = FO_PM_SH[foPmH32(name || "") % FO_PM_SH.length];
    return "<span class='" + cls + "' style='--sc:" + col + "'>" + foPmE(ini || "?") + "</span>";
  }

  // ---- what the world knows about this fixture ------------------------------
  function foPmGather(natId, round, stage) {
    var PL = window.__foPlanet, WT = window.__foWT;
    if (!PL || !WT) return null;
    var snap = null;
    try { snap = window.__foWorldLg && window.__foWorldLg.get(natId); } catch (e) {}
    var names = null, mgrs = null;
    try {
      if (window.__foWorldNames) { names = window.__foWorldNames.get(natId); mgrs = window.__foWorldNames.mgr(natId); }
    } catch (e2) {}
    var sides = PL.sidesOf(natId) || [];
    var bySlot = {}; sides.forEach(function (s) { bySlot[s.slot] = s; });
    var cal = null; try { cal = WT.serverCal(Date.now()); } catch (e3) {}
    var seasonNo = (snap && snap.seasonNo) || (cal && cal.seasonNo) || 1;
    var hour = PL.natHour(natId);
    // THE HOUR THIS MATCH IS PLAYED, to the minute. Round R of season S falls
    // on one world day, and that day opens at the nation's own hour.
    // A CUP TIE IS PLAYED ON A SUNDAY, NOT IN A ROUND. Where a stage is named
    // the day comes off the cup calendar; otherwise off the league round.
    var day = stage && PL.faDayOf ? PL.faDayOf(seasonNo, stage)
           : PL.dayOfSeasonRound ? PL.dayOfSeasonRound(seasonNo, round)
           : ((PL.anchorOf ? PL.anchorOf().start : 0) + (seasonNo - 1) * (PL.CYCLE | 0) + (round - 1));
    var start = PL.EPOCH + day * PL.DAY + hour * 3600000;
    var stop = start + (PL.LIVE_LEN || 3) * 3600000;
    return { snap: snap, names: names, mgrs: mgrs, sides: sides, bySlot: bySlot,
      seasonNo: seasonNo, hour: hour, start: start, stop: stop, natId: natId, round: round, stage: stage || null };
  }
  function foPmName(g, slot) {
    if (g.names && g.names[slot]) return g.names[slot];
    var s = g.bySlot[slot];
    return (s && s.name) || "A club";
  }
  function foPmGround(g, slot) {
    try { if (g.mgrs && g.mgrs["g" + slot]) return g.mgrs["g" + slot]; } catch (e) {}
    var s = g.bySlot[slot];
    return ((s && s.city) || foPmName(g, slot)) + " Ground";
  }
  function foPmMgr(g, slot) { try { return (g.mgrs && g.mgrs[slot]) || ""; } catch (e) { return ""; } }
  // the ground, painted. Never veiled and never cropped to fit - the plate is
  // bounded by its own box and the writing begins under it.
  // Only about a quarter of the world's grounds are painted. A club whose
  // city has no painting must not leave a bare hero, so the plate falls back
  // to a generic ground under a summer-noon sky - once, and then gives up
  // rather than looping.
  function foPmGroundArt(g, slot) {
    var s = g.bySlot[slot], base = foPmArt();
    var city = (s && s.city) || "";
    var alt = base + "home/arches-summer-noon.webp";
    return { src: city ? base + "cities/" + foPmSlug(city) + "-ground.webp" : alt, alt: alt };
  }
  // where a club stands, and the last five it has played
  function foPmStanding(g, slot) {
    var out = { pos: 0, p: 0, w: 0, l: 0, t: 0, pts: 0, nrr: 0, form: [] };
    try {
      // BOTH FLIGHTS. A Division Two club is in table2, and a preview that
      // read only table showed it unplaced and pointless in its own match.
      // The place is its place in its own division, so each table is walked
      // whole rather than the two run together.
      var tbls = [(g.snap && g.snap.table) || [], (g.snap && g.snap.table2) || []];
      for (var d = 0; d < tbls.length; d++) {
        var tbl = tbls[d], hit = false;
        for (var i = 0; i < tbl.length; i++) {
          if (tbl[i].slot !== slot) continue;
          out.pos = i + 1; out.p = tbl[i].p | 0; out.w = tbl[i].w | 0; out.l = tbl[i].l | 0;
          out.t = tbl[i].t | 0; out.pts = tbl[i].pts | 0; out.nrr = +tbl[i].nrr || 0;
          hit = true; break;
        }
        if (hit) break;
      }
      var nm = foPmName(g, slot), rec = (g.snap && g.snap.results) || [];
      rec.forEach(function (r) {
        if (r.home !== nm && r.away !== nm) return;
        out.form.push(r.winner === null ? "t" : (r.winner === nm ? "w" : "l"));
      });
      out.form = out.form.slice(-5);
    } catch (e) {}
    return out;
  }
  // what happened the last times these two met
  // WHAT HAPPENED THE LAST TIMES THESE TWO MET, as rows a reader can open.
  //
  // EVERY OFFICIAL MEETING COUNTS, and only official ones: the league's own
  // results, the nation's cup, and the Champions Cup. A friendly is an
  // arrangement between two clubs rather than a fixture the world dealt them,
  // and it appears in none of those three books - which is exactly why it does
  // not count here.
  var PM_H2H_ASK = {};
  function foPmH2HSnap(key, again) {
    var v = foPmSnap(key, function () {
      if (PM_H2H_ASK[key]) return;
      PM_H2H_ASK[key] = 1;
      try { if (again) again(); } catch (e) {}
    });
    return v || null;
  }
  // one tie from a cup's bracket, if these two are the pair in it
  function foPmCupTie(t, hn, an, comp) {
    var A = (t && t.a && t.a.name) || "", B = (t && t.b && t.b.name) || "";
    if (!((A === hn && B === an) || (A === an && B === hn))) return null;
    if (!t.winner && !t.text) return null;               // drawn but not played
    return { comp: comp, home: A, away: B, text: t.text || "", id: t.id || "" };
  }
  window.foPmH2HRows = function (natId, seasonNo, hn, an, again) {
    var out = [];
    try {
      var snap = window.__foWorldLg && window.__foWorldLg.get(natId);
      ((snap && snap.results) || []).forEach(function (r) {
        if ((r.home === hn && r.away === an) || (r.home === an && r.away === hn)) {
          out.push({ comp: "League", home: r.home, away: r.away, text: r.text || "",
                     id: r.id || "", round: r.round | 0, nat: natId });
        }
      });
    } catch (e) {}
    var sn = (seasonNo | 0) || 1;
    [["facup/" + natId + "/s" + sn, "Cup"], ["cup/s" + sn, "Champions Cup"]].forEach(function (pair) {
      try {
        var body = foPmH2HSnap(pair[0], again);
        var st = (body && body.stages) || null;
        if (!st) return;
        Object.keys(st).forEach(function (k) {
          (st[k] || []).forEach(function (t) {
            var row = foPmCupTie(t, hn, an, pair[1]);
            if (row) { row.stage = k; out.push(row); }
          });
        });
      } catch (e2) {}
    });
    return out;
  };
  window.foPmH2HHTML = function (natId, rows, hn, an) {
    if (!rows || !rows.length) {
      return "<p class='fo-pm-dim'>They have not yet met.</p>";
    }
    var w = 0, l = 0, d = 0;
    rows.forEach(function (r) {
      var t = String(r.text || "");
      if (t.indexOf(hn) === 0) w++; else if (t.indexOf(an) === 0) l++; else d++;
    });
    var tally = "<p class='fo-pm-dim'>" + foPmE(hn) + " " + w + " &middot; " +
      foPmE(an) + " " + l + (d ? " &middot; " + d + " drawn" : "") + "</p>";
    return tally + rows.map(function (r) {
      var tag = r.comp === "League" ? "R" + (r.round | 0) : foPmE(r.comp);
      var inner = "<i>" + tag + "</i>" +
        "<b>" + foPmE(r.home) + " v " + foPmE(r.away) + "</b>" +
        "<span>" + foPmE(r.text || "") + "</span>";
      // a league result opens its report; a cup tie is only a door where the
      // world published an id for it
      if (r.comp === "League" && r.id) {
        return "<a class='fo-pm-h2h' href='#/report?n=" + encodeURIComponent(r.nat || natId) +
          "&w=" + encodeURIComponent(r.id) + "'>" + inner + "<s>&#8250;</s></a>";
      }
      return "<div class='fo-pm-h2h flat'>" + inner + "</div>";
    }).join("");
  };

  // ---- A CLUB IN ONE LINE, shared by both front pages -----------------------
  // The league preview built these inside its own render; the friendly's
  // front page needs the same rows for clubs that may stand in two different
  // nations, so the builders live at module level and take the nation along.
  function foPmBeads(st) {
    if (!st.form.length) return "<span class='fo-pm-none'>no cricket yet</span>";
    return st.form.map(function (k) { return "<i class='" + k + "'>" + k.toUpperCase() + "</i>"; }).join("");
  }
  function foPmPosOrd(n) {
    if (!n) return "&mdash;";
    var s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th";
    return n + "<u>" + s + "</u>";
  }
  function foPmPl(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function foPmHonours(natId, slot, isMine, mgrs) {
    var h = null;
    try {
      var PLh = window.__foPlanet;
      if (!PLh || !PLh.heritageOf) return "";
      if (isMine) h = PLh.heritageOf(natId, slot, true);
      else if (mgrs) h = PLh.heritageOf(natId, slot, !!mgrs[slot]);
    } catch (eHr) { return ""; }
    if (!h) return "";
    if (h.human) return "<span class='fo-pm-her'>Founded this season &middot; first campaign</span>";
    // WHEN THE CLUB STARTED, and nothing else. The trophy cabinet used to be
    // read out here - three league titles, seven national cups - which is the
    // club's whole history in a row that is meant to say who is in front of
    // you today. It lives on the club's own page, which this row opens.
    return "<span class='fo-pm-her'>Est. " + h.founded + " &middot; " +
      foPmPl(h.seasons, "season", "seasons") + " played</span>";
  }
  function foPmSideRow(natId, slot, nm, boss, st, isMine, mgrs) {
    // WHO THEY ARE AND HOW THEY ARE GOING. This carried the league table as
    // well - played, won, lost, points, net run rate - which is a second copy
    // of a table the reader can reach in one tap, printed in numerals too
    // small to read, under a heading that says "team status". The status is
    // the form: five results, in order, in colour.
    return "<a class='fo-pm-sl" + (isMine ? " mine" : "") +
      "' href='#/team?c=" + encodeURIComponent(natId) + "&s=" + slot + "'>" +
      foPmShield(nm, boss, natId) +
      "<b>" + foPmE(nm) + "</b>" +
      foPmHonours(natId, slot, isMine, mgrs) +
      "<span class='fo-pm-beads'>" + foPmBeads(st) + "</span>" +
      "<s class='fo-pm-chev'>&#8250;</s></a>";
  }

  // ---- HOW IT SHOULD GO ------------------------------------------------------
  // A win probability is the easiest number in a football game to invent, and
  // the house rule here is that every figure must be traceable to something
  // real. So this one is not modelled at all: the fixture is PLAYED, forty
  // times, on the same engine the umpire uses, with the same two squads the
  // world generates - and the bar is simply how often each side won.
  //
  // Three things follow from doing it that way rather than with a formula.
  // Home advantage, the shape of a batting order, a thin attack on a true
  // pitch: all of it is already in there, because the cricket is real. The
  // seeds come from the fixture's own id, so the forty matches are the SAME
  // forty on every device in the world and nobody sees a different number.
  // And because it is deterministic, it can be cached and never recomputed.
  //
  // WHOSE ELEVEN? THE ENGINE'S, ALWAYS - AND DELIBERATELY.
  // A manager who files a sheet fields his own eleven, not the engine's, so a
  // simulation could in principle be sharpened with whatever sheets happen to
  // be readable. It is not, on purpose. Odds that improved as sheets arrived
  // would be a number that MOVED - different before and after you set your
  // orders, different for the manager who looked at teatime and the one who
  // looked at dawn, and different again the moment an opponent changed his
  // mind. That is a worse thing to put in front of a reader than a rougher
  // figure that never lies to him twice.
  //
  // So both sides are always picked the way the engine picks them. The
  // consequences are the ones worth having: the number is FIXED from the day
  // the fixture is drawn, it is the same on every device on earth, it cannot
  // be moved by anybody's team sheet, and it cannot break when a sheet is
  // sealed, missing or malformed. It is an approximation and the note under
  // the bar says so.
  //
  // For the many fixtures where nobody manages either club it is not even an
  // approximation: the umpire files a sheet only where one exists and lets the
  // engine pick the rest, which is exactly what happens here.
  // ---- THE ODDS, OFF WHAT THE TWO SIDES ARE ON PAPER -----------------------
  //
  // This used to PLAY the fixture forty times and report how often each side
  // won. The thinking was that a played-out number cannot be argued with, and
  // for a lopsided fixture that held. For an even one it was a lottery: the
  // same tour, played forty times, came out anywhere between 32% and 65%
  // depending only on which forty seeds it drew, and the page printed whichever
  // it got as though it meant something. Two readers, two answers, one match.
  //
  // A win probability does not have to name the winner. It has to say who is
  // stronger and by how much, the same way every time - 99-to-1 still loses one
  // time in a hundred and nobody calls that bar wrong. So the odds are read off
  // the two squads directly, and they never move.
  //
  // NOTHING HERE IS INVENTED. The curve is the ENGINE'S OWN, measured: 72
  // 184 pairings spanning the whole strength band from 0.70x to 1.30x of a
  // baked side plus ordinary generated squads, every pairing played both ways
  // round - 12,880 matches - and the win rate fitted against the rating gap by
  // maximum likelihood. It lands within about six points of the engine on
  // average, against thirty for assuming every match is even.
  // FO_PM_ODDS_S is the gap worth ten to one;
  // FO_PM_ODDS_H is what the ground is worth in the same currency, taken from a
  // separate 1,600-fixture measurement of two equal sides (51.6% to the host).
  // Across nine gap bands the curve sits within about two points of what the
  // engine actually does - test/win-odds.test.mjs replays that check.
  var FO_PM_FA = { r16: "Cup round of 16", qf: "Cup quarter-final", sf: "Cup semi-final", final: "The Cup final" };
  var FO_PM_ODDS_S = 16250;         // rating points worth 10:1
  var FO_PM_ODDS_H = 525;           // and what being at home is worth
  var FO_PM_ODDS_TIE = 0.02;        // the engine ties about one match in fifty

  // THE ELEVEN A SIDE CAN ACTUALLY FIELD, and what it averages. pickXI is the
  // engine's own selector - the very one that will pick the side on the day -
  // so this is the strength of the team that takes the field, not of fifteen
  // names on a list.
  window.foPmStrength = function (players) {
    try {
      var men = (players || []).filter(function (p) { return p && p.name; });
      if (!men.length) return null;
      var xi = men;
      if (men.length > 11 && typeof pickXI === "function") {
        try { xi = pickXI({ name: " odds", players: men }) || men; } catch (eP) { xi = men; }
      }
      if (xi.length > 11) {
        xi = xi.slice().sort(function (a, b) { return (+b.rating || 0) - (+a.rating || 0); }).slice(0, 11);
      }
      var n = 0, t = 0;
      xi.forEach(function (p) { var r = +p.rating || 0; if (r > 0) { t += r; n++; } });
      return n ? t / n : null;
    } catch (e) { return null; }
  };
  // the two figures the bar prints, from two strengths. A neutral tie passes
  // `neutral` and nobody collects the ground.
  window.foPmOdds = function (sHome, sAway, neutral) {
    if (!(sHome > 0) || !(sAway > 0)) return null;
    var d = sHome - sAway + (neutral ? 0 : FO_PM_ODDS_H);
    var p = 1 / (1 + Math.pow(10, -d / FO_PM_ODDS_S));
    var live = 1 - FO_PM_ODDS_TIE;
    return { home: p * live, away: (1 - p) * live, tie: FO_PM_ODDS_TIE };
  };
  // and the verdict beneath it, in the language a preview speaks
  window.foPmOddsSay = function (o, homeNm, awayNm) {
    if (!o) return "";
    var gap = Math.abs(o.home - o.away) * 100;
    if (gap < 4) return "Evenly matched";
    var who = o.home > o.away ? homeNm : awayNm;
    return who + (gap < 12 ? " slightly favoured" : gap < 30 ? " favoured" : " strongly favoured");
  };
  function foPmWpPaint(host, o, homeNm, awayNm) {
    if (!host || !o) { if (host) host.style.display = "none"; return; }
    var ph = Math.round(100 * o.home), pa = Math.round(100 * o.away);
    var pt = Math.max(0, 100 - ph - pa);
    var bar = host.querySelector(".fo-pm-wpbar");
    if (bar) {
      bar.querySelector(".h").style.width = ph + "%";
      bar.querySelector(".t").style.width = pt + "%";
      bar.querySelector(".a").style.width = pa + "%";
    }
    var hp = host.querySelector(".fo-pm-wph b"), ap = host.querySelector(".fo-pm-wpa b");
    if (hp) hp.textContent = ph + "%";
    if (ap) ap.textContent = pa + "%";
    var say = host.querySelector(".fo-pm-wpsay");
    if (say) say.textContent = window.foPmOddsSay(o, homeNm, awayNm);
    host.classList.add("settled");
  }
  // A LEAGUE FIXTURE OR A FRIENDLY: each side carries its own nation, because a
  // friendly's two clubs may stand in different ones.
  function foPmWpRun(host, sig, key, hS, aS, ground) {
    var WT = window.__foWT;
    if (!WT || !WT.serverSquad) { host.style.display = "none"; return; }
    var sqH = WT.serverSquad(hS.nat, hS.slot), sqA = WT.serverSquad(aS.nat, aS.slot);
    if (!sqH || !sqA) { host.style.display = "none"; return; }
    foPmWpPaint(host, window.foPmOdds(window.foPmStrength(sqH), window.foPmStrength(sqA)),
      foPmSideCode(hS.name), foPmSideCode(aS.name));
  }

  // ---- the countdown --------------------------------------------------------
  // A fixture is a time as much as a pairing. This says how long, in the units
  // a person actually thinks in, and re-reads itself every second so the page
  // is never quietly stale.
  function foPmCountText(g, now) {
    if (now >= g.stop) return { k: "done", big: "Stumps", sub: "The match is complete" };
    if (now >= g.start) return { k: "live", big: "In play", sub: "Play is under way" };
    var ms = g.start - now, s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60), ss = s % 60;
    var big = d > 0 ? (d + "d " + h + "h " + m + "m")
      : h > 0 ? (h + "h " + m + "m " + ss + "s")
      : (m + "m " + ss + "s");
    return { k: "soon", big: big, sub: "Until the first ball" };
  }
  function foPmTick() {
    try {
      if (!FO_PM_ON) return;
      // the count card is the guard, not the address: this same clock now
      // serves the friendly's front page on #/feed, so the tick asks only
      // whether a count is on screen
      var host = document.getElementById("fo-pm-count"); if (!host) return;
      var g = host.__g; if (!g) return;
      var c = foPmCountText(g, Date.now());
      var b = host.querySelector("b"), s = host.querySelector("i");
      if (b && b.textContent !== c.big) b.textContent = c.big;
      if (s && s.textContent !== c.sub) s.textContent = c.sub;
      // keep the fact styling: this element IS a fact card, the k class rides along
      host.className = "fo-pm-fact " + c.k;
    } catch (e) {}
  }

  // ---- the page -------------------------------------------------------------
  window.foRenderPreviewPage = function () {
    try {
      try { if (typeof window.foCxNav === "function") window.foCxNav(); } catch (eN) {}
      if ((location.hash || "").split("?")[0] !== "#/preview") return;
      var page = document.getElementById("page"); if (!page) return;
      foPmCss();

      var natId = foPmQ("n") || "eng";
      var round = parseInt(foPmQ("r") || "0", 10) | 0;
      // A TOUR NAMES BOTH NATIONS, not a nation and two slots - there are no
      // clubs in it. Same address, same room, its own reading.
      var pair = foPmQ("nat");
      if (pair) {
        var two = String(pair).split("-");
        var sigI = "pmi|" + pair + "|" + round;
        if (page.__foPmSig === sigI && page.querySelector(".fo-pm")) return;
        if (two.length !== 2 || !two[0] || !two[1] || !round) {
          foPmLost(page, "That tour is not on the calendar."); return;
        }
        var nb = foPmSnap("nations", function () {
          page.__foPmSig = null;
          try { window.foRenderPreviewPage(); } catch (e) {}
        });
        if (nb === null) {
          foPmCss();
          page.innerHTML = "<div class='fo-pm'><div class='fo-pm-in fo-pm-body'>" +
            "<p class='fo-pm-dim'>Asking the selectors&hellip;</p></div></div>";
          document.body.classList.add("fo-pm-on");
          return;
        }
        if (!nb || !window.foRenderIntlPreview(page, nb, two[0], two[1], round)) {
          foPmLost(page, "That tour is not on the calendar."); return;
        }
        page.__foPmSig = sigI;
        return;
      }
      var stage = foPmQ("fa") || "";
      if (stage && !FO_PM_FA[stage]) stage = "";
      var hSlot = parseInt(foPmQ("h") || "-1", 10);
      var aSlot = parseInt(foPmQ("a") || "-1", 10);
      var sig = "pm|" + natId + "|" + (stage || round) + "|" + hSlot + "|" + aSlot;
      if (page.__foPmSig === sig && page.querySelector(".fo-pm")) return;

      if ((!round && !stage) || hSlot < 0 || aSlot < 0) { foPmLost(page, "That fixture is not on the card."); return; }

      var g = foPmGather(natId, round, stage);
      if (!g) { foPmLost(page, "The world clock is still waking up. Try again in a moment."); return; }

      // THE BOOK MAY NOT BE ON THE DEVICE YET. get() reads a cache and never
      // fills it, so a preview opened cold would show a fixture with no table
      // and no form behind it. Ask, once, and paint again when it lands.
      if (!g.snap && window.__foWorldLg && window.__foWorldLg.want && !page.__foPmAsked) {
        page.__foPmAsked = 1;
        window.__foWorldLg.want(natId, function () { page.__foPmSig = null; try { window.foRenderPreviewPage(); } catch (e) {} });
        setTimeout(function () { page.__foPmSig = null; try { window.foRenderPreviewPage(); } catch (e) {} }, 4000);
      }
      if (!g.names && window.__foWorldNames && window.__foWorldNames.want && !page.__foPmAskedNm) {
        page.__foPmAskedNm = 1;
        window.__foWorldNames.want(natId, function () { page.__foPmSig = null; try { window.foRenderPreviewPage(); } catch (e) {} });
      }

      page.__foPmSig = sig;
      FO_PM_ON = true;
      document.body.classList.add("fo-pm-on");

      var natNm = "";
      try { natNm = (window.__foCxAPI.regions() || []).filter(function (r) { return r.id === natId; })[0].nm || ""; } catch (eR) {}
      var hN = foPmName(g, hSlot), aN = foPmName(g, aSlot);
      var hBoss = hSlot === 0, aBoss = aSlot === 0;
      var ground = foPmGround(g, hSlot);
      var hSt = foPmStanding(g, hSlot), aSt = foPmStanding(g, aSlot);
      var againH2H = function () {
        page.__foPmSig = null;
        try { window.foRenderPreviewPage(); } catch (e) {}
      };
      var h2h = window.foPmH2HRows(natId, g.seasonNo, hN, aN, againH2H);
      var now = Date.now(), c0 = foPmCountText(g, now);
      var art = foPmGroundArt(g, hSlot);

      // is one of these mine?
      var mySlot = -1, myNat = "";
      try {
        var cl = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null");
        if (cl) { myNat = cl.country; if (cl.country === natId) mySlot = cl.slot; }
      } catch (eC) {}
      var mine = (mySlot === hSlot || mySlot === aSlot);

      // A CLUB IN ONE LINE. This was a card apiece - four labelled numbers, a
      // manager's name, a form strip and a caption - and then a second pair of
      // cards naming four cricketers with their roles and their hands. Before
      // a ball has been bowled every one of those numbers is a nought, and a
      // page of noughts is a page of nothing. Where they stand, what they have
      // won, and how they are going: that is the whole of a preview.
      // The builders live at module level now (foPmSideRow and friends), so
      // the friendly's front page reads off the very same rows.
      var sideLine = function (slot, nm, boss, st) {
        return foPmSideRow(natId, slot, nm, boss, st, slot === mySlot, g.mgrs);
      };

      var h2hHTML = window.foPmH2HHTML(natId, h2h, hN, aN);

      // THE CONDITIONS: the strip the groundsman prepared and the sky the
      // season deals, both pure functions of the world - the same weather the
      // umpire will play this fixture under.
      var PITCH_W = { balanced: "Balanced", flat: "Flat", green: "Green", dry: "Crumbling",
        slow: "Slow", cracked: "Sticky", twoPaced: "Two-paced" };
      var PITCH_N = {
        balanced: "No advantage or disadvantage to batters or bowlers.",
        green: "Strong help for seam bowlers, biggest with the new ball - fast-medium gains most, then fast; medium least. Moderate disadvantage to spin bowlers. Boundaries moderately harder.",
        dry: "Strong help for spin bowlers - finger spin far more than wrist - growing as the pitch wears. Weak disadvantage to seam bowlers in the middle overs.",
        flat: "Strong advantage to batters: boundaries flow and wickets are dear. Strong disadvantage to all bowlers.",
        slow: "Moderate help for spin bowlers and medium-pace cutters in the middle overs. Strong cut to six-hitting; scoring is slower. Weak disadvantage to fast and fast-medium bowlers.",
        cracked: "Strong help for all bowlers - wrist spin notably more from the bounce - and more again in the second innings. Strong disadvantage to batters.",
        twoPaced: "Weak wicket help for all bowlers, moderate for spin and medium-pace cutters in the middle overs. Boundaries moderately harder; batters find timing difficult."
      };
      // What each sky actually does in the engine (00-core ballDist weather
      // block): stated as effects, not scenery.
      var WEATHER_N = {
        Sunny: "No effect on batters or bowlers.",
        Overcast: "Moderate help for seam bowlers all innings - fast-medium swing gains most, express pace least. Moderate cut to boundaries. No effect on spin bowlers.",
        Humid: "Strong help for seam bowlers while the ball is new - fast-medium swing most - fading to nothing as it ages. No effect on spin bowlers. Weak extra fatigue, heaviest on quicks.",
        Hot: "Weak advantage to batters: slightly fewer wickets, slightly more boundaries. Moderate extra fatigue for bowlers, heaviest on quicks.",
        Scorching: "Moderate advantage to batters: fewer wickets, more boundaries. Strong extra fatigue for bowlers, heaviest on quicks.",
        Drizzle: "Moderate cut to boundaries; scoring is slower. No effect on wickets, for seam or spin.",
        Windy: "Strong cut to six-hitting; more runs come from hard-run twos. No effect on wickets.",
        Chilly: "Weak cut to boundaries; scoring is slower. No effect on wickets, for seam or spin.",
        Misty: "Strong help for seam bowlers while the ball is new - fast-medium swing most - fading as it ages. Moderate cut to boundaries. No effect on spin bowlers.",
        "Dew later": "In the chase only: moderate disadvantage to spin bowlers - finger spin hardest, wrist spin less - and easier scoring. Helps the side batting second."
      };
      var condHTML = "";
      try {
        if (!stage && window.__foPlanet && window.__foPlanet.condOf) {
          var cond = window.__foPlanet.condOf(natId, hSlot, g.seasonNo, round);
          if (cond) {
            var pk = String(cond.pitch || "balanced");
            var wk = String(cond.weather || "Sunny");
            condHTML = "<div class='fo-pm-duo'>" +
              "<div class='fo-pm-box'><div class='fo-pm-cap'>The weather</div>" +
              "<div class='fo-pm-big'>" + foPmE(wk) + "</div>" +
              "<p class='fo-pm-prn'>" + foPmE(WEATHER_N[wk] || "Match-day conditions.") + "</p></div>" +
              "<div class='fo-pm-box'><div class='fo-pm-cap'>Pitch report</div>" +
              "<div class='fo-pm-big'>" + foPmE(PITCH_W[pk] || pk) + "</div>" +
              "<p class='fo-pm-prn'>" + foPmE(PITCH_N[pk] || "") + "</p></div>" +
              "</div>";
          }
        }
      } catch (eCd) {}

      var ACT = {
        sheet: "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='9' cy='8' r='3'/><path d='M3 20a6 6 0 0 1 12 0'/><path d='M17 11h4M19 9v4'/></svg>",
        bars: "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M5 20V11M12 20V4M19 20v-6'/></svg>",
        cal: "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><rect x='3.5' y='5' width='17' height='16' rx='2.5'/><path d='M3.5 10h17M8 3v4M16 3v4'/></svg>",
        play: "<svg viewBox='0 0 24 24' width='16' height='16' fill='currentColor'><path d='M8 5v14l11-7z'/></svg>",
        check: "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg>"
      };
      var actions = [];
      if (c0.k === "live") {
        // straight into THIS match's broadcast - never the theatre hub
        var lvHref = null;
        try { if (window.foWtGoHref) lvHref = window.foWtGoHref(natId, hSlot, aSlot); } catch (eLh) {}
        actions.push("<a class='fo-pm-cta live' href='" + (lvHref || ("#/watch?n=" + encodeURIComponent(natId))) + "'>" + ACT.play + "Watch it live</a>");
      }
      // A DONE TASK LOOKS DONE. Saving the orders page files the sheet with
      // the World Service for every open round (37-world-club), so once it is
      // saved this button has nothing left to ask - it turns green and offers
      // a review instead of an instruction.
      if (mine && c0.k === "soon") {
        var ordIn = false;
        try { ordIn = !!(typeof App !== "undefined" && App && App.orders && App.orders.saved); } catch (eOi) {}
        actions.push("<a class='fo-pm-cta" + (ordIn ? " done" : "") + "' href='#/orders'>" +
          (ordIn ? ACT.check + "Lineup set &middot; review" : ACT.sheet + "Set your team sheet") + "</a>");
      }
      if (c0.k === "done") actions.push("<a class='fo-pm-cta' href='#/league?t=results'>" + ACT.bars + "Read the report</a>");
      actions.push(stage
        ? "<a class='fo-pm-back' href='#/facup'>" + ACT.bars + "The whole draw</a>"
        : "<a class='fo-pm-back' href='" + (natId === myNat ? "#/league?t=fixtures&r=" + round
          : "#/nation?n=" + encodeURIComponent(natId) + "&t=fixtures&r=" + round) + "'>" + ACT.bars + "All of round " + round + "</a>");
      actions.push("<a class='fo-pm-back' href='#/fixtures'>" + ACT.cal + "The fixture list</a>");

      var ic = function (d) {
        return "<svg class='fo-pm-ic' viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' " +
          "stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + d + "</svg>";
      };
      var flagSrc = "";
      try {
        var artB = (typeof FO_ART !== "undefined" && FO_ART) ? FO_ART : "client/art/";
        var ff = window.__foCxAPI && window.__foCxAPI.flagFile ? window.__foCxAPI.flagFile(natId) : natId;
        if (ff) flagSrc = artB + "flags/" + ff + ".svg";
      } catch (eFl) { flagSrc = ""; }

      // THE BILLING, READ ACROSS. Crest, club, and which end of the fixture it
      // is - then the same on the other side of the V. Stacked and centred, a
      // long name and its crest were on different lines and the two sides ran
      // into each other; side by side they are one legible row.
      var billSide = function (nm, boss, tag, away) {
        return "<div class='fo-pm-billside" + (away ? " a" : "") + "'>" +
          foPmShield(nm, boss, natId, true) +
          "<div><b>" + foPmE(nm) + "</b><i>" + tag + "</i></div></div>";
      };

      page.innerHTML =
        "<div class='fo-pm'><div class='fo-pm-in'><div class='fo-pm-card'>" +

        "<div class='fo-pm-folio'>" +
        (flagSrc ? "<img src='" + flagSrc + "' alt='' onerror=\"this.style.display='none'\">" : "") +
        "<span>" + (stage ? FO_PM_FA[stage] : "Round " + round) +
        (natNm ? " &middot; " + foPmE(natNm) : "") + "</span></div>" +

        "<div class='fo-pm-bill'>" +
        billSide(hN, hBoss, "Home", false) +
        "<div class='fo-pm-v'><span>vs</span></div>" +
        billSide(aN, aBoss, "Away", true) +
        "</div>" +

        "<div class='fo-pm-main'>" +
        "<figure class='fo-pm-plate'><img src='" + art.src + "' alt='' data-alt='" + art.alt + "' " +
        "onerror=\"if(this.src.indexOf(this.dataset.alt)<0){this.src=this.dataset.alt}else{this.parentNode.style.display=&#39;none&#39;}\"></figure>" +

        // THE THREE FACTS a manager checks on the way in: how long, where, and
        // when the first ball is. One rank, one rule between them - not a
        // boxed countdown beside a cramped pair of labelled fields.
        "<div class='fo-pm-facts'>" +
        "<div class='fo-pm-fact' id='fo-pm-count' data-k='" + c0.k + "'>" +
        ic("<circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 2'/>") +
        "<div><b>" + foPmE(c0.big) + "</b><i>" + foPmE(c0.sub) + "</i></div></div>" +
        "<div class='fo-pm-fact'>" +
        ic("<path d='M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11z'/><circle cx='12' cy='10' r='2.6'/>") +
        "<div><b>" + foPmE(ground) + "</b><i>" + foPmE(natNm || "") + "</i></div></div>" +
        "<div class='fo-pm-fact'>" +
        ic("<circle cx='12' cy='12' r='9'/><path d='M5.4 8.2c4 1.6 9.2 1.6 13.2 0M5.4 15.8c4-1.6 9.2-1.6 13.2 0'/>") +
        "<div><b>" + (function () { try { return window.__foPlanet.hhTxt(g.hour); } catch (e) { return foPmHH(g.hour); } })() + "</b><i>First ball</i></div></div>" +
        "</div>" +
        "</div>" +

        "<div class='fo-pm-rail'>" +
        "<div id='fo-pm-wp' class='fo-pm-wp'>" +
        "<div class='fo-pm-cap'>Win probability &middot; projected</div>" +
        "<div class='fo-pm-wptop'>" +
        "<span class='fo-pm-wph'>" + foPmShield(hN, hBoss, natId) + "<u>" + foPmE(foPmSideCode(hN)) + "</u><b>&mdash;</b></span>" +
        "<span class='fo-pm-wpa'><b>&mdash;</b><u>" + foPmE(foPmSideCode(aN)) + "</u>" + foPmShield(aN, aBoss, natId) + "</span>" +
        "</div>" +
        "<div class='fo-pm-wpbar'><span class='h'></span><span class='t'></span><span class='a'></span></div>" +
        "<div class='fo-pm-wpsay'></div>" +
        "</div>" +

        "<div class='fo-pm-cap'>Team status</div>" +
        "<div class='fo-pm-two'>" + sideLine(hSlot, hN, hBoss, hSt) + sideLine(aSlot, aN, aBoss, aSt) + "</div>" +

        "<div class='fo-pm-cap'>Head to head</div>" +
        "<div class='fo-pm-h2hs'>" + h2hHTML + "</div>" +

        condHTML +
        "</div>" +

        "<div class='fo-pm-foot'>" + actions.join("") + "</div>" +
        "</div></div></div>";

      var host = document.getElementById("fo-pm-count");
      if (host) host.__g = g;

      // the bar: served from the cache when this fixture has been played out
      // before, otherwise played out now, a few matches at a time
      try {
        var wpHost = document.getElementById("fo-pm-wp");
        if (wpHost) {
          // no key and no cache any more: the odds are a function of the two
          // squads, so they are the same every time this page is opened
          foPmWpRun(wpHost, location.hash, "",
            { nat: natId, slot: hSlot, name: hN }, { nat: natId, slot: aSlot, name: aN }, ground);
        }
      } catch (eWp) {
        // an empty catch here hid a missing helper behind a bar that just said
        // "playing it out" forever. If the odds cannot be worked out, say so
        // where a developer will see it and take the panel off the page.
        try { console.error("preview: win probability failed", eWp); } catch (eL) {}
        try { var wpDead = document.getElementById("fo-pm-wp"); if (wpDead) wpDead.style.display = "none"; } catch (eD) {}
      }
      try { if (window.__foPmTimer) clearInterval(window.__foPmTimer); } catch (eT) {}
      window.__foPmTimer = setInterval(foPmTick, 1000);
    } catch (e) {
      try { console.error("foRenderPreviewPage", e); } catch (e2) {}
    }
  };
  function foPmLost(page, why) {
    foPmCss();
    page.innerHTML = "<div class='fo-pm'><div class='fo-pm-in fo-pm-body'>" +
      "<div class='fo-pm-mast'>The Fifty Overs Journal</div>" +
      "<h1 class='fo-pm-lost'>No preview for that one</h1>" +
      "<p class='fo-pm-dim'>" + foPmE(why) + "</p>" +
      "<div class='fo-pm-foot'><a class='fo-pm-back' href='#/fixtures'>The fixture list</a>" +
      "<a class='fo-pm-back' href='#/league'>The league</a></div></div></div>";
  }
  window.addEventListener("hashchange", function () {
    var h = (location.hash || "").split("?")[0];
    if (h === "#/preview") setTimeout(window.foRenderPreviewPage, 40);
    else {
      FO_PM_ON = false;
      try { document.body.classList.remove("fo-pm-on"); } catch (e) {}
      try { if (window.__foPmTimer) clearInterval(window.__foPmTimer); } catch (e2) {}
    }
  });

  // A FIXTURE ROW IS A DOOR. Anything that lists a match still to be played
  // links here; this writes the address so no caller has to know the shape.
  window.foPreviewHref = function (natId, round, hSlot, aSlot) {
    return "#/preview?n=" + encodeURIComponent(natId) + "&r=" + (round | 0) +
      "&h=" + (hSlot | 0) + "&a=" + (aSlot | 0);
  };
  // A CUP TIE IS A MATCH LIKE ANY OTHER and deserves the same room. It has no
  // league round, so it is addressed by its stage.
  window.foCupPreviewHref = function (natId, stage, hSlot, aSlot) {
    return "#/preview?n=" + encodeURIComponent(natId) + "&fa=" + encodeURIComponent(stage || "r16") +
      "&h=" + (hSlot | 0) + "&a=" + (aSlot | 0);
  };

  // ---- A FRIENDLY GETS THE SAME FRONT PAGE ----------------------------------
  // The friendly's build-up was a navy stage and a card of sentences while a
  // league fixture two clicks away got the full billing - crests, the ground
  // painted, the facts in a rank, the bar of forty played-out matches. One
  // design for a match not yet played, whoever arranged it. The feed page
  // (44) still owns the address and the fetch; it hands the detail here and
  // keeps its own refetch clock, and the moment the umpire's book opens the
  // broadcast takes the room back.
  //
  // Two things differ from a round, and both are the friendly's own truth:
  // the clubs may stand in two different nations (each row reads its own
  // league), and the conditions come off condOf with the FRIENDLY'S ID for a
  // round - the exact call the umpire banks it with (tick.mjs runFriendlies),
  // where the old build-up asked for round nought and promised a wrong sky.
  window.foRenderFriendlyPreview = function (page, fr, frId, opts) {
    try {
      var PL = window.__foPlanet;
      if (!page || !fr || !fr.home || !PL) return false;
      foPmCss();
      opts = opts || {};
      var hNat = fr.home.country, aNat = fr.away.country;
      var hSlot = fr.home.slot | 0, aSlot = fr.away.slot | 0;
      var hN = fr.home.name || "A club", aN = fr.away.name || "A club";
      var infoOf = function (nat, slot) {
        try {
          var all = PL.sidesOf(nat) || [];
          for (var i = 0; i < all.length; i++) if ((all[i].slot | 0) === (slot | 0)) return all[i];
        } catch (eI) {}
        return null;
      };
      var hInfo = infoOf(hNat, hSlot);
      var mgrsH = null, mgrsA = null;
      try {
        if (window.__foWorldNames) {
          mgrsH = window.__foWorldNames.mgr(hNat); mgrsA = window.__foWorldNames.mgr(aNat);
          if (window.__foWorldNames.want) {
            if (!mgrsH && !page.__foPmFrAskNmH) { page.__foPmFrAskNmH = 1; window.__foWorldNames.want(hNat, function () { try { window.foRenderFeedPage(); } catch (e) {} }); }
            if (!mgrsA && aNat !== hNat && !page.__foPmFrAskNmA) { page.__foPmFrAskNmA = 1; window.__foWorldNames.want(aNat, function () { try { window.foRenderFeedPage(); } catch (e) {} }); }
          }
        }
      } catch (eNm) {}
      var ground = (mgrsH && mgrsH["g" + hSlot]) || (((hInfo && hInfo.city) || hN) + " Ground");
      var base = foPmArt(), city = (hInfo && hInfo.city) || "";
      var altArt = base + "home/arches-summer-noon.webp";
      var art = { src: city ? base + "cities/" + foPmSlug(city) + "-ground.webp" : altArt, alt: altArt };
      var g = { start: +fr.playAtMs || 0, stop: (+fr.playAtMs || 0) + (PL.LIVE_LEN || 3) * 3600000 };
      var c0 = foPmCountText(g, Date.now());

      var mySlot = -1, myNat = "";
      try {
        var cl = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null");
        if (cl) { myNat = cl.country; mySlot = cl.slot; }
      } catch (eC) {}
      var mineH = myNat === hNat && mySlot === hSlot, mineA = myNat === aNat && mySlot === aSlot;
      // which season's cup books to look in
      var seasonNoFr = 1;
      try {
        var calFr = window.__foWT && window.__foWT.serverCal && window.__foWT.serverCal(Date.now());
        if (calFr && calFr.seasonNo) seasonNoFr = calFr.seasonNo | 0;
      } catch (eSn) {}
      var mine = mineH || mineA;

      // each club's standing, read out of ITS OWN league's snapshot; a book
      // not on the device yet is asked for once and the page repaints
      var stOf = function (nat, slot, nm, askFlag) {
        var snap = null;
        try { snap = window.__foWorldLg && window.__foWorldLg.get(nat); } catch (eS) {}
        if (!snap && window.__foWorldLg && window.__foWorldLg.want && !page[askFlag]) {
          page[askFlag] = 1;
          window.__foWorldLg.want(nat, function () { try { window.foRenderFeedPage(); } catch (e) {} });
        }
        var names = {}; names[slot] = nm;
        return foPmStanding({ snap: snap, names: names, bySlot: {} }, slot);
      };
      var hSt = stOf(hNat, hSlot, hN, "__foPmFrAskH"), aSt = stOf(aNat, aSlot, aN, "__foPmFrAskA");

      var natNm = function (nat) {
        try { return (window.__foCxAPI.regions() || []).filter(function (r) { return r.id === nat; })[0].nm || ""; } catch (eR) { return ""; }
      };
      var flagSrc = "";
      try {
        var ff = window.__foCxAPI && window.__foCxAPI.flagFile ? window.__foCxAPI.flagFile(hNat) : hNat;
        if (ff) flagSrc = base + "flags/" + ff + ".svg";
      } catch (eFl) {}

      // the first ball, on the reader's own clock - a friendly is arranged
      // between time zones, so the hour is pinned to the phone and to UTC
      var whenT = g.start ? new Date(g.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
      var tzA = ""; try { tzA = (typeof foTzAbbr === "function" && foTzAbbr()) || ""; } catch (eTz) {}
      var utcT = g.start ? new Date(g.start).toISOString().slice(11, 16) : "";

      var billSide = function (nm, nat, slot, away) {
        return "<div class='fo-pm-billside" + (away ? " a" : "") + "'>" +
          foPmShield(nm, slot === 0, nat, true) +
          "<div><b>" + foPmE(nm) + "</b><i>" + (away ? "Away" : "Home") + "</i></div></div>";
      };

      var ic = function (d) {
        return "<svg class='fo-pm-ic' viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' " +
          "stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + d + "</svg>";
      };
      var ACT = {
        sheet: "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='9' cy='8' r='3'/><path d='M3 20a6 6 0 0 1 12 0'/><path d='M17 11h4M19 9v4'/></svg>",
        check: "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg>",
        home: "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M4 11l8-7 8 7'/><path d='M6 9.5V20h12V9.5'/></svg>",
        cal: "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><rect x='3.5' y='5' width='17' height='16' rx='2.5'/><path d='M3.5 10h17M8 3v4M16 3v4'/></svg>"
      };

      // THE TRUE CONDITIONS: the same call the umpire banks this friendly
      // with - the friendly's id stands in for the round (runFriendlies)
      var PITCH_W = { balanced: "Balanced", flat: "Flat", green: "Green", dry: "Crumbling",
        slow: "Slow", cracked: "Sticky", twoPaced: "Two-paced" };
      var PITCH_N = {
        balanced: "No advantage or disadvantage to batters or bowlers.",
        green: "Strong help for seam bowlers, biggest with the new ball - fast-medium gains most, then fast; medium least. Moderate disadvantage to spin bowlers. Boundaries moderately harder.",
        dry: "Strong help for spin bowlers - finger spin far more than wrist - growing as the pitch wears. Weak disadvantage to seam bowlers in the middle overs.",
        flat: "Strong advantage to batters: boundaries flow and wickets are dear. Strong disadvantage to all bowlers.",
        slow: "Moderate help for spin bowlers and medium-pace cutters in the middle overs. Strong cut to six-hitting; scoring is slower. Weak disadvantage to fast and fast-medium bowlers.",
        cracked: "Strong help for all bowlers - wrist spin notably more from the bounce - and more again in the second innings. Strong disadvantage to batters.",
        twoPaced: "Weak wicket help for all bowlers, moderate for spin and medium-pace cutters in the middle overs. Boundaries moderately harder; batters find timing difficult."
      };
      var WEATHER_N = {
        Sunny: "No effect on batters or bowlers.",
        Overcast: "Moderate help for seam bowlers all innings - fast-medium swing gains most, express pace least. Moderate cut to boundaries. No effect on spin bowlers.",
        Humid: "Strong help for seam bowlers while the ball is new - fast-medium swing most - fading to nothing as it ages. No effect on spin bowlers. Weak extra fatigue, heaviest on quicks.",
        Hot: "Weak advantage to batters: slightly fewer wickets, slightly more boundaries. Moderate extra fatigue for bowlers, heaviest on quicks.",
        Scorching: "Moderate advantage to batters: fewer wickets, more boundaries. Strong extra fatigue for bowlers, heaviest on quicks.",
        Drizzle: "Moderate cut to boundaries; scoring is slower. No effect on wickets, for seam or spin.",
        Windy: "Strong cut to six-hitting; more runs come from hard-run twos. No effect on wickets.",
        Chilly: "Weak cut to boundaries; scoring is slower. No effect on wickets, for seam or spin.",
        Misty: "Strong help for seam bowlers while the ball is new - fast-medium swing most - fading as it ages. Moderate cut to boundaries. No effect on spin bowlers.",
        "Dew later": "In the chase only: moderate disadvantage to spin bowlers - finger spin hardest, wrist spin less - and easier scoring. Helps the side batting second."
      };
      var condHTML = "";
      try {
        var cond = PL.condOf ? PL.condOf(hNat, hSlot, 0, (+frId | 0)) : null;
        if (cond) {
          var pk = String(cond.pitch || "balanced"), wk = String(cond.weather || "Sunny");
          condHTML = "<div class='fo-pm-duo'>" +
            "<div class='fo-pm-box'><div class='fo-pm-cap'>The weather</div>" +
            "<div class='fo-pm-big'>" + foPmE(wk) + "</div>" +
            "<p class='fo-pm-prn'>" + foPmE(WEATHER_N[wk] || "Match-day conditions.") + "</p></div>" +
            "<div class='fo-pm-box'><div class='fo-pm-cap'>Pitch report</div>" +
            "<div class='fo-pm-big'>" + foPmE(PITCH_W[pk] || pk) + "</div>" +
            "<p class='fo-pm-prn'>" + foPmE(PITCH_N[pk] || "") + "</p></div>" +
            "</div>";
        }
      } catch (eCd) {}

      var actions = [];
      if (mine && c0.k === "soon") {
        if (g.start - Date.now() > 3600000) {
          var ordIn = !!opts.myOrders;
          actions.push("<a class='fo-pm-cta" + (ordIn ? " done" : "") + "' id='fo-pm-frord' href='#/orders'>" +
            (ordIn ? ACT.check + "Lineup set &middot; review" : ACT.sheet + "Set your team sheet") + "</a>");
        }
        // inside the final hour the sheets are sealed; a button that can only
        // be refused is not offered
      }
      actions.push("<a class='fo-pm-back' href='#/home'>" + ACT.home + "Back to the club</a>");
      actions.push("<a class='fo-pm-back' href='#/schedule'>" + ACT.cal + "The season&rsquo;s calendar</a>");

      // this markup shares #page with the league preview; the sig cache there
      // must never mistake this page for its own
      page.__foPmSig = null;
      page.innerHTML =
        "<div class='fo-pm'><div class='fo-pm-in'><div class='fo-pm-card'>" +

        "<div class='fo-pm-folio'>" +
        (flagSrc ? "<img src='" + flagSrc + "' alt='' onerror=\"this.style.display='none'\">" : "") +
        "<span>Friendly" + (natNm(hNat) ? " &middot; " + foPmE(natNm(hNat)) : "") + "</span></div>" +

        "<div class='fo-pm-bill'>" +
        billSide(hN, hNat, hSlot, false) +
        "<div class='fo-pm-v'><span>vs</span></div>" +
        billSide(aN, aNat, aSlot, true) +
        "</div>" +

        "<div class='fo-pm-main'>" +
        "<figure class='fo-pm-plate'><img src='" + art.src + "' alt='' data-alt='" + art.alt + "' " +
        "onerror=\"if(this.src.indexOf(this.dataset.alt)<0){this.src=this.dataset.alt}else{this.parentNode.style.display=&#39;none&#39;}\"></figure>" +

        "<div class='fo-pm-facts'>" +
        "<div class='fo-pm-fact' id='fo-pm-count' data-k='" + c0.k + "'>" +
        ic("<circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 2'/>") +
        "<div><b>" + foPmE(c0.big) + "</b><i>" + foPmE(c0.sub) + "</i></div></div>" +
        "<div class='fo-pm-fact'>" +
        ic("<path d='M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11z'/><circle cx='12' cy='10' r='2.6'/>") +
        "<div><b>" + foPmE(ground) + "</b><i>" + foPmE(natNm(hNat) || "") + "</i></div></div>" +
        "<div class='fo-pm-fact'>" +
        ic("<circle cx='12' cy='12' r='9'/><path d='M5.4 8.2c4 1.6 9.2 1.6 13.2 0M5.4 15.8c4-1.6 9.2-1.6 13.2 0'/>") +
        "<div><b>" + foPmE(whenT + (tzA ? " " + tzA : "")) + "</b><i>First ball &middot; " + foPmE(utcT) + " UTC</i></div></div>" +
        "</div>" +
        "</div>" +

        "<div class='fo-pm-rail'>" +
        "<div id='fo-pm-wp' class='fo-pm-wp'>" +
        "<div class='fo-pm-cap'>Win probability &middot; projected</div>" +
        "<div class='fo-pm-wptop'>" +
        "<span class='fo-pm-wph'>" + foPmShield(hN, hSlot === 0, hNat) + "<u>" + foPmE(foPmSideCode(hN)) + "</u><b>&mdash;</b></span>" +
        "<span class='fo-pm-wpa'><b>&mdash;</b><u>" + foPmE(foPmSideCode(aN)) + "</u>" + foPmShield(aN, aSlot === 0, aNat) + "</span>" +
        "</div>" +
        "<div class='fo-pm-wpbar'><span class='h'></span><span class='t'></span><span class='a'></span></div>" +
        "<div class='fo-pm-wpsay'></div>" +
        "</div>" +

        "<div class='fo-pm-cap'>Team status</div>" +
        "<div class='fo-pm-two'>" +
        foPmSideRow(hNat, hSlot, hN, hSlot === 0, hSt, mineH, mgrsH) +
        foPmSideRow(aNat, aSlot, aN, aSlot === 0, aSt, mineA, mgrsA) +
        "</div>" +

        // THE PAIR'S OWN RECORD. Only where the two stand in the same league,
        // because the record is that league's results book - two clubs from
        // different nations have never met in anything it holds.
        (hNat === aNat
          ? "<div class='fo-pm-cap'>Head to head</div>" +
            "<div class='fo-pm-h2hs'>" +
            window.foPmH2HHTML(hNat, window.foPmH2HRows(hNat, seasonNoFr, hN, aN, function () {
              page.__foPmSig = null;
              try { window.foRenderPreviewPage(); } catch (e) {}
            }), hN, aN) + "</div>"
          : "") +

        condHTML +
        "</div>" +

        "<div class='fo-pm-foot'>" + actions.join("") + "</div>" +
        "</div></div></div>";

      document.body.classList.add("fo-pm-on");
      FO_PM_ON = true;
      var host = document.getElementById("fo-pm-count");
      if (host) host.__g = g;
      try { if (window.__foPmTimer) clearInterval(window.__foPmTimer); } catch (eT) {}
      window.__foPmTimer = setInterval(foPmTick, 1000);

      // the bar: the two squads, read the same way a league fixture reads them
      try {
        var wpHost = document.getElementById("fo-pm-wp");
        if (wpHost) {
          foPmWpRun(wpHost, location.hash, "",
            { nat: hNat, slot: hSlot, name: hN }, { nat: aNat, slot: aSlot, name: aN }, ground);
        }
      } catch (eWp) {
        try { console.error("friendly preview: win probability failed", eWp); } catch (eL) {}
        try { var wpDead = document.getElementById("fo-pm-wp"); if (wpDead) wpDead.style.display = "none"; } catch (eD) {}
      }
      return true;
    } catch (e) {
      try { console.error("foRenderFriendlyPreview", e); } catch (e2) {}
      return false;
    }
  };

  // ---- AND SO DOES A TOUR ----------------------------------------------------
  //
  // A league fixture has a room before it and a report after it. A friendly
  // has both. A tour had neither - it appeared on the live-scores page at
  // 18:00 already being bowled, and vanished into a scoreline when it was
  // done. The international is the one week of the season a manager watches
  // rather than plays, which is an argument for MORE build-up than a round
  // gets, not less.
  //
  // The one thing this room does not have, and must not pretend to, is a team
  // sheet. The selectors are autonomous: ensureCallups names the fifteen the
  // morning of the series' first game and they stand for all three, so there
  // is nothing to file and nothing to lock. What there IS to read is who they
  // named, which club each man was taken from, how many caps he carries, where
  // the series stands after the games already bowled, and how the two nations
  // are going. All of that is in the nations snapshot, so this is one fetch.
  var PM_SNAP = {};
  function foPmSnap(key, cb) {
    if (PM_SNAP[key] !== undefined) return PM_SNAP[key];
    PM_SNAP[key] = null;
    var SB = "https://egaipdksvztqqgouriyc.supabase.co";
    var AK = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
    fetch(SB + "/rest/v1/world_snapshots?key=eq." + encodeURIComponent(key) + "&select=body",
      { headers: { apikey: AK } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { PM_SNAP[key] = (j && j[0] && j[0].body) || false; if (cb) cb(); })
      .catch(function () { PM_SNAP[key] = false; if (cb) cb(); });
    return null;
  }
  function foPmNatFlag(rid) {
    try {
      var ff = window.__foCxAPI && window.__foCxAPI.flagFile ? window.__foCxAPI.flagFile(rid) : rid;
      return ff ? (foPmArt() + "flags/" + ff + ".svg") : "";
    } catch (e) { return ""; }
  }
  // THE CODE A SCOREBOARD USES. "South Africa" does not fit a two-column
  // probability strip and was being cut to "SOUTH AF..." - a broadcast never
  // does that, it writes RSA. These are the official three-letter codes, by
  // the world's own region ids.
  var FO_PM_ABBR = { eng: "ENG", aus: "AUS", sub: "IND", pak: "PAK", rsa: "RSA",
    nzl: "NZ", slk: "SL", bgd: "BAN", win: "WI", zim: "ZIM", ire: "IRE",
    afg: "AFG", sco: "SCO", ned: "NED", nep: "NEP", usa: "USA" };
  function foPmNatCode(rid, nm) {
    var c = FO_PM_ABBR[String(rid || "").toLowerCase()];
    if (c) return c;
    // an id the table does not know: initials off the name, never an ellipsis
    var w = String(nm || rid || "").replace(/[^A-Za-z ]/g, "").trim().split(/\s+/);
    return (w.length > 1 ? w.map(function (x) { return x.charAt(0); }).join("")
                         : (w[0] || "").slice(0, 3)).toUpperCase();
  }
  // A SCOREBOARD CODE FOR A CLUB. Nations have official three-letter codes;
  // clubs do not, so one is made the way a scoreboard would - and it is made
  // rather than clipped, because "GLOUCESTERSH..." is not a name.
  function foPmSideCode(nm) {
    var w = String(nm || "").replace(/[^A-Za-z ]/g, "").trim().split(/\s+/).filter(Boolean);
    if (!w.length) return "?";
    if (w.length > 1) return w.map(function (x) { return x.charAt(0); }).join("").slice(0, 3).toUpperCase();
    return w[0].slice(0, 3).toUpperCase();
  }
  function foPmNatShield(rid, big) {
    var src = foPmNatFlag(rid);
    if (!src) return "<span class='fo-pm-sh" + (big ? " big" : "") + "'>" + foPmE(String(rid || "?").toUpperCase()) + "</span>";
    return "<img class='fo-pm-sh" + (big ? " big" : "") + " crest' src='" + src +
      "' alt='' onerror=\"this.style.display='none'\">";
  }
  // THE TIE THIS ADDRESS NAMES. The calendar publishes every series of the
  // season with the three window rounds it is played over; a preview is one
  // of those series at one of those rounds.
  window.foPmIntlTie = function (snap, away, host, round) {
    try {
      var ser = (snap && snap.calendar && snap.calendar.series) || [];
      for (var i = 0; i < ser.length; i++) {
        var t = ser[i];
        if (t.away !== away || t.home !== host) continue;
        var leg = (t.rounds || []).indexOf(round | 0);
        if (leg < 0) continue;
        return { tie: t, leg: leg + 1, of: (t.rounds || []).length,
                 st: t.series || {},
                 game: ((t.series && t.series.games) || []).filter(function (g) {
                   return (g.round | 0) === (round | 0); })[0] || null };
      }
    } catch (e) {}
    return null;
  };
  // when the first ball of a tour round is bowled: the window day the calendar
  // deals that round, in the season it belongs to, at the one hour every tour
  // in the game starts at
  window.foPmIntlStart = function (seasonNo, round, hourUtc) {
    try {
      var PL = window.__foPlanet; if (!PL) return 0;
      var i = (PL.WINDOW_DAYS && PL.WINDOWS) ? PL.WINDOWS.indexOf(round | 0) : -1;
      if (i < 0) return 0;
      var day = PL.seasonStart(seasonNo | 0) + PL.WINDOW_DAYS[i];
      return PL.EPOCH + day * PL.DAY + (hourUtc == null ? 18 : hourUtc | 0) * 3600000;
    } catch (e) { return 0; }
  };

  function foPmIntlSquadRows(men, rid, mySlot, myNat) {
    if (!men || !men.length) {
      return "<p class='fo-pm-dim'>The selectors have not named this party yet. Fifteen are picked the morning of the series&rsquo; first game.</p>";
    }
    return "<div class='fo-pm-party'>" + men.map(function (m, i) {
      var mine = (rid === myNat && (m.slot | 0) === (mySlot | 0));
      var can = false;
      try {
        can = !!(window.foFindAnyPlayer && window.foFindAnyPlayer(m.name, rid, m.slot == null ? null : (m.slot | 0)));
      } catch (e) {}
      // EVERY MAN WEARS THE FLAG HE IS PLAYING UNDER, the same as he does in
      // the caps book and on the nations page
      var fl = foPmNatFlag(rid);
      var inner = "<i>" + (i + 1) + "</i>" +
        (fl ? "<img class='fo-pm-mfl' src='" + fl + "' alt='' onerror=\"this.style.display='none'\">" : "") +
        "<b>" + foPmE(m.name) + "</b>" +
        "<span>" + foPmE(m.club || "") + (m.age ? " &middot; " + (m.age | 0) : "") + "</span>" +
        "<u>" + (m.caps ? m.caps + " cap" + (m.caps === 1 ? "" : "s") : "uncapped") + "</u>";
      if (!can) return "<div class='fo-pm-cap-man" + (mine ? " mine" : "") + "'>" + inner + "</div>";
      return "<a class='fo-pm-cap-man go" + (mine ? " mine" : "") + "' href='#/player?n=" +
        encodeURIComponent(m.name) + "&r=" + encodeURIComponent(rid) + "&s=" + (m.slot | 0) + "'>" +
        inner + "<s>&#8250;</s></a>";
    }).join("") + "</div>";
  }
  // a nation's recent form, off its own banked tours - newest last, the way
  // the beads read everywhere else in the game
  function foPmIntlForm(n) {
    try {
      // THE SIDE IS "SCOTLAND XI"; THE NATION IS "SCOTLAND". The umpire banks
      // a tour under the side names, so a bare nation name matches nothing in
      // this book and every nation reads as having played no cricket at all.
      var us = n.name, usXI = n.name + " XI";
      var isUs = function (s) { return s === us || s === usXI; };
      return (n.tours || []).map(function (t) {
        if (!isUs(t.a) && !isUs(t.b)) return "";
        return !t.winner ? "t" : isUs(t.winner) ? "w" : "l";
      }).filter(Boolean).slice(-5);
    } catch (e) { return []; }
  }
  function foPmIntlRow(rid, n, role, rank, mine) {
    var form = foPmIntlForm(n);
    var men = (n.tourSquad && n.tourSquad.length) ? n.tourSquad : (n.squad || []);
    return "<a class='fo-pm-sl nat" + (mine ? " mine" : "") + "' href='#/nations?n=" + encodeURIComponent(rid) + "'>" +
      foPmNatShield(rid) +
      "<b>" + foPmE(n.name || rid) + " <i>" + foPmE(role) + (rank ? " &middot; #" + (rank | 0) + " in the world" : "") + "</i></b>" +
      "<span class='fo-pm-beads'>" + (form.length
        ? form.map(function (k) { return "<i class='" + k + "'>" + k.toUpperCase() + "</i>"; }).join("")
        : "<span class='fo-pm-none'>no tours yet</span>") + "</span>" +
      "<span class='fo-pm-slst'><u>SQUAD<b>" + men.length + "</b></u></span>" +
      "<s class='fo-pm-chev'>&#8250;</s></a>";
  }

  // ---- WHEN, IN WORDS ------------------------------------------------------
  // A tour is a date as much as a pairing, and every place this page names one
  // it names it the same way: the day in the reader's own week, and the hour
  // on his own clock.
  function foPmDay(ms) {
    if (!ms) return "";
    try { return new Date(ms).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }); }
    catch (e) { return ""; }
  }
  function foPmClock(ms) {
    if (!ms) return "";
    try { return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return ""; }
  }

  // ---- FORTY PLAYINGS, WITH THE MEN THE SELECTORS ACTUALLY NAMED -----------
  //
  // The league fixture's bar is not modelled: the match is PLAYED forty times
  // on the engine the umpire uses, and the bar is how often each side won. A
  // tour gets the same treatment and it must, because a formula off two world
  // rankings would be the one invented number on a page where everything else
  // was earned.
  //
  // The only difficulty is whose men. A national side has no club seat to
  // generate a squad from - it is fifteen cricketers drawn out of a whole
  // league - so the squads are read from world_squads, the public card every
  // club's men are published as, and turned into engine players through the
  // one door that conversion has (__foCardToPlayer). Two requests, one per
  // nation, and both are cached for the session.
  var PM_NAT_MEN = {};
  function foPmNatMen(rid, cb) {
    if (PM_NAT_MEN[rid] !== undefined) return PM_NAT_MEN[rid];
    PM_NAT_MEN[rid] = null;
    var SB = "https://egaipdksvztqqgouriyc.supabase.co";
    var AK = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
    fetch(SB + "/rest/v1/world_squads?country_id=eq." + encodeURIComponent(rid) + "&select=slot,players",
      { headers: { apikey: AK } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        var by = {};
        (rows || []).forEach(function (row) {
          (row.players || []).forEach(function (c) {
            if (c && c.name) by[(row.slot | 0) + "|" + c.name] = c;
          });
        });
        PM_NAT_MEN[rid] = Object.keys(by).length ? by : false;
        if (cb) cb();
      })
      .catch(function () { PM_NAT_MEN[rid] = false; if (cb) cb(); });
    return null;
  }
  // the fifteen the selectors named, as engine players
  function foPmNatXI(rid, party, book) {
    if (!book) return null;
    var out = [];
    (party || []).forEach(function (m) {
      var c = book[(m.slot | 0) + "|" + m.name];
      if (!c) return;
      var p = null;
      try { p = window.__foCardToPlayer ? window.__foCardToPlayer(c) : null; } catch (e) {}
      if (p) out.push(p);
    });
    return out.length >= 11 ? out : null;
  }
  // THE ROOM ITSELF. Same card, same dress, same clock as a round's preview.
  window.foRenderIntlPreview = function (page, snap, away, host, round) {
    try {
      if (!page || !snap || !snap.nations) return false;
      foPmCss();
      var found = window.foPmIntlTie(snap, away, host, round);
      if (!found) return false;
      var t = found.tie, st = found.st, hourUtc = snap.hourUtc == null ? 18 : snap.hourUtc | 0;
      var nA = snap.nations[away] || {}, nH = snap.nations[host] || {};
      var seasonNo = (snap.calendar && snap.calendar.seasonNo) || nH.seasonNo || nA.seasonNo || 1;
      var PL = window.__foPlanet;
      // EVERY DATE ON THIS PAGE COMES OFF THE WORLD'S CALENDAR, and until the
      // world has said when its season opened that calendar is a guess. This
      // room is reached straight from a link and never asks for a league book,
      // which is what anchors it - so it was dating a tour a week early, off a
      // season assumed to open on day nought when it really opens on day seven.
      // Ask, once, and paint again when the answer lands.
      try {
        if (PL && PL.anchored && !PL.anchored() && window.__foWorldLg && window.__foWorldLg.want && !page.__foPmAnch) {
          page.__foPmAnch = 1;
          var anchNat = "eng";
          try { if (window.__foWorldLg.anchorNation) anchNat = window.__foWorldLg.anchorNation(); } catch (eA0) {}
          window.__foWorldLg.want(anchNat, function () {
            page.__foPmSig = null;
            try { window.foRenderPreviewPage(); } catch (e) {}
          });
        }
      } catch (eAn) {}
      var start = window.foPmIntlStart(seasonNo, round, hourUtc);
      var g = { start: start, stop: start + ((PL && PL.LIVE_LEN) || 3) * 3600000 };
      var c0 = foPmCountText(g, Date.now());

      var mySlot = -1, myNat = "";
      try {
        var cl = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null");
        if (cl) { myNat = cl.country; mySlot = cl.slot; }
      } catch (eC) {}
      var rankOf = function (rid) {
        try {
          var rk = JSON.parse(localStorage.getItem("fo_world_rk") || "null");
          var list = (rk && (rk.countries || rk.nations)) || [];
          var hit = list.filter(function (x) { return x.id === rid || x.country === rid; })[0];
          return hit && hit.rank ? hit.rank | 0 : 0;
        } catch (e) { return 0; }
      };
      // MY OWN MEN, ON EITHER SIDE. The one thing a manager cares about in a
      // window is which of his cricketers is missing and who has him.
      var minesA = ((nA.tourSquad && nA.tourSquad.length) ? nA.tourSquad : (nA.squad || []))
        .filter(function (m) { return away === myNat && (m.slot | 0) === (mySlot | 0); });
      var minesH = ((nH.tourSquad && nH.tourSquad.length) ? nH.tourSquad : (nH.squad || []))
        .filter(function (m) { return host === myNat && (m.slot | 0) === (mySlot | 0); });
      var myMen = minesA.concat(minesH);

      var ga = { art: "", name: "" };
      try { if (window.foNatGround) ga = window.foNatGround(host) || ga; } catch (eG) {}
      var art = ga.art || (foPmArt() + "home/arches-summer-noon.webp");

      var whenT = start ? new Date(start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
      var utcT = start ? new Date(start).toISOString().slice(11, 16) : "";
      var tzA = ""; try { tzA = (typeof foTzAbbr === "function" && foTzAbbr()) || ""; } catch (eTz) {}

      var ic = function (d) {
        return "<svg class='fo-pm-ic' viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' " +
          "stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + d + "</svg>";
      };
      var billSide = function (rid, nm, isAway) {
        return "<div class='fo-pm-billside" + (isAway ? " a" : "") + "'>" +
          foPmNatShield(rid, true) +
          "<div><b>" + foPmE(nm) + "</b><i>" + (isAway ? "Touring" : "Hosts") + "</i></div></div>";
      };

      // THE SERIES, GAME BY GAME. Best of three over three window rounds: what
      // has been bowled says its result and opens its report, what has not says
      // which round it falls on. This is the whole shape of an international
      // season and it has never been printed anywhere a reader could reach it.
      var played = {};
      ((st.games) || []).forEach(function (x) { played[x.round | 0] = x; });
      // EVERY GAME IS A DATE. A row that said only "round 5" made the reader
      // do calendar arithmetic to find out when his cricketers are away; each
      // one carries the day it is bowled on and the hour, in his own clock.
      var seriesRows = (t.rounds || []).map(function (r, i) {
        var gm = played[r | 0];
        var when = window.foPmIntlStart(seasonNo, r | 0, hourUtc);
        var stamp = when ? foPmDay(when) + " &middot; " + foPmClock(when) : "Round " + (r | 0);
        if (gm) {
          return "<a class='fo-pm-h2h' href='#/report?nat=" + encodeURIComponent(gm.id || "") + "'>" +
            "<i>" + (i + 1) + "</i><b>Game " + (i + 1) + "<u>" + stamp + "</u></b>" +
            "<span>" + foPmE(gm.text || "") + "</span><s>&#8250;</s></a>";
        }
        var here = (r | 0) === (round | 0);
        // a fixture list says SCHEDULED, not "to come" or "this one"; the row
        // being previewed is marked by the accent it already wears
        return "<div class='fo-pm-h2h flat" + (here ? " now" : "") + "'>" +
          "<i>" + (i + 1) + "</i><b>Game " + (i + 1) + "<u>" + stamp + "</u></b>" +
          "<span>Scheduled</span></div>";
      }).join("");

      // THE SERIES AS A SCORELINE. "Nothing has been bowled in this series
      // yet" is a sentence where a reader wants a number; a best-of-three
      // stands at nought-all before it starts, exactly as it stands at 1-0
      // after a game, and the two should be read the same way. The touring
      // side leads the figure because it leads the billing.
      // The server counts the wins, but an older cached snapshot may carry the
      // verdict sentence without them - and a figure that quietly said 0-0
      // above a sentence saying "Scotland lead the series 1-0" is exactly the
      // kind of self-contradiction this page must not print. Where the counts
      // are missing they are walked off the games themselves, matching the
      // side name the umpire banks a tour under as well as the bare nation.
      var wA9 = st.winsAway, wH9 = st.winsHome;
      if (wA9 == null || wH9 == null) {
        var isNat9 = function (s, n) { return !!s && (s === n.name || s === n.name + " XI"); };
        wA9 = 0; wH9 = 0;
        ((st.games) || []).forEach(function (gm) {
          if (!gm || !gm.winner) return;
          if (isNat9(gm.winner, nA)) wA9++;
          else if (isNat9(gm.winner, nH)) wH9++;
        });
      }
      var standing = (wA9 | 0) + "&#8211;" + (wH9 | 0);
      var standSub = st.verdict || "";

      var actions = [];
      if (found.game && found.game.id) {
        actions.push("<a class='fo-pm-cta' href='#/feed?nat=" + encodeURIComponent(found.game.id) + "'>" +
          "Watch the broadcast</a>");
      }
      actions.push("<a class='fo-pm-back' href='#/nations?n=" + encodeURIComponent(myNat || host) + "'>The international game</a>");
      actions.push("<a class='fo-pm-back' href='#/live'>Live scores</a>");

      page.__foPmSig = null;
      page.innerHTML =
        "<div class='fo-pm'><div class='fo-pm-in'><div class='fo-pm-card'>" +

        // THE DATE BELONGS AT THE TOP. The folio named the tour and left the
        // reader to hunt for when it is bowled; it now says the day and the
        // hour in his own clock, which is the second thing anybody wants off
        // a fixture and was four cards down the page.
        "<div class='fo-pm-folio'>" +
        (foPmNatFlag(host) ? "<img src='" + foPmNatFlag(host) + "' alt='' onerror=\"this.style.display='none'\">" : "") +
        "<span>" + foPmE(t.title || "International") + "</span>" +
        (start ? "<em>" + foPmDay(start) + " &middot; " + foPmClock(start) +
          (tzA ? " " + foPmE(tzA) : "") + "</em>" : "") + "</div>" +

        "<div class='fo-pm-bill'>" +
        billSide(away, (t.names || [])[0] || away, true) +
        "<div class='fo-pm-v'><span>at</span></div>" +
        billSide(host, (t.names || [])[1] || host, false) +
        "</div>" +

        "<div class='fo-pm-main'>" +
        "<figure class='fo-pm-plate'><img src='" + art + "' alt='' " +
        "onerror=\"this.parentNode.style.display='none'\"></figure>" +

        // FOUR FACTS, TWO BY TWO. The round's preview has three and lays them
        // in a rank; a tour has a fourth - which game of the series - and a
        // fourth in a three-column rank is one card alone on a second row with
        // its caption clipped.
        "<div class='fo-pm-facts four'>" +
        "<div class='fo-pm-fact' id='fo-pm-count' data-k='" + c0.k + "'>" +
        ic("<circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 2'/>") +
        "<div><b>" + foPmE(c0.big) + "</b><i>" + foPmE(c0.sub) + "</i></div></div>" +
        "<div class='fo-pm-fact'>" +
        ic("<path d='M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11z'/><circle cx='12' cy='10' r='2.6'/>") +
        "<div><b>" + foPmE(ga.name || ((nH.name || host) + " at home")) + "</b><i>" + foPmE(nH.name || host) + "</i></div></div>" +
        "<div class='fo-pm-fact'>" +
        ic("<rect x='3.5' y='5' width='17' height='16' rx='2.5'/><path d='M3.5 10h17M8 3v4M16 3v4'/>") +
        "<div><b>Game " + found.leg + " of " + found.of + "</b><i>Round " + (round | 0) + " &middot; the window</i></div></div>" +
        "<div class='fo-pm-fact'>" +
        ic("<circle cx='12' cy='12' r='9'/><path d='M5.4 8.2c4 1.6 9.2 1.6 13.2 0M5.4 15.8c4-1.6 9.2-1.6 13.2 0'/>") +
        "<div><b>" + foPmE(whenT + (tzA ? " " + tzA : "")) + "</b><i>First ball &middot; " + foPmE(utcT) + " UTC</i></div></div>" +
        "</div>" +
        "</div>" +

        "<div class='fo-pm-rail'>" +
        // THE TOURING SIDE TAKES THE FIRST SLOT, because that is the slot the
        // umpire plays a tour in (runTours passes the tourist as homeTeam), and
        // a bar that projects a different fixture from the one that will be
        // bowled is projecting nothing.
        "<div id='fo-pm-wp' class='fo-pm-wp'>" +
        "<div class='fo-pm-cap'>Win probability &middot; projected</div>" +
        "<div class='fo-pm-wptop'>" +
        "<span class='fo-pm-wph'>" + foPmNatShield(away) + "<u>" + foPmE(foPmNatCode(away, nA.name)) + "</u><b>&mdash;</b></span>" +
        "<span class='fo-pm-wpa'><b>&mdash;</b><u>" + foPmE(foPmNatCode(host, nH.name)) + "</u>" + foPmNatShield(host) + "</span>" +
        "</div>" +
        "<div class='fo-pm-wpbar'><span class='h'></span><span class='t'></span><span class='a'></span></div>" +
        "<div class='fo-pm-wpsay' id='fo-pm-wpsay'></div>" +
        "</div>" +

        "<div class='fo-pm-box'><div class='fo-pm-cap'>The series</div>" +
        "<div class='fo-pm-big'>" + standing +
        " <em>(Best of " + ((snap.seriesLen || found.of || 3) | 0) + ")</em></div>" +
        (standSub ? "<p class='fo-pm-prn'>" + foPmE(standSub) + "</p>" : "") +
        "<div class='fo-pm-h2hs'>" + seriesRows + "</div></div>" +

        "<div class='fo-pm-cap'>The two sides</div>" +
        "<div class='fo-pm-two'>" +
        foPmIntlRow(away, nA, "Touring", rankOf(away), away === myNat) +
        foPmIntlRow(host, nH, "Hosts", rankOf(host), host === myNat) +
        "</div>" +

        // THE CONDITIONS, AND THEY ARE NOT A GUESS. runTours plays every
        // international on a BALANCED pitch under a clear sky - the umpire
        // passes both literally - so that is what this says, and it says why
        // it will never say anything else rather than inventing weather to
        // make the panel look busier.
        "<div class='fo-pm-duo'>" +
        "<div class='fo-pm-box'><div class='fo-pm-cap'>The weather</div>" +
        "<div class='fo-pm-big'>Sunny</div>" +
        "<p class='fo-pm-prn'>No effect on batters or bowlers.</p></div>" +
        "<div class='fo-pm-box'><div class='fo-pm-cap'>Pitch report</div>" +
        "<div class='fo-pm-big'>Balanced</div>" +
        "<p class='fo-pm-prn'>No advantage or disadvantage to batters or bowlers. " +
        "Every tour is played on a true pitch in clear weather - a neutral ground " +
        "for a neutral contest, the same for both sides and the same every window.</p></div>" +
        "</div>" +

        (myMen.length
          ? "<div class='fo-pm-box'><div class='fo-pm-cap'>Your men in this one</div>" +
            "<p class='fo-pm-prn'>" + foPmE(myMen.map(function (m) { return m.name; }).join(", ")) +
            " &mdash; " + foPmPl(myMen.length, "cricketer", "cricketers") +
            " of yours " + (myMen.length === 1 ? "is" : "are") + " away with the selectors" +
            " while this is bowled. The board pays you for every round they miss.</p></div>"
          : "") +
        "</div>" +

        // THE TWO PARTIES GO ACROSS THE PAGE, not down the rail. Thirty names
        // in a column the width of a scoreline is a page nobody reads; the
        // card's two halves both belong to them here.
        "<div class='fo-pm-wide'>" +
        "<div class='fo-pm-sq'>" +
        "<div class='fo-pm-cap'>" + foPmE((t.names || [])[0] || away) + " &middot; the touring party</div>" +
        foPmIntlSquadRows((nA.tourSquad && nA.tourSquad.length) ? nA.tourSquad : nA.squad, away, mySlot, myNat) +
        "</div>" +
        "<div class='fo-pm-sq'>" +
        "<div class='fo-pm-cap'>" + foPmE((t.names || [])[1] || host) + " &middot; the hosts&rsquo; squad</div>" +
        foPmIntlSquadRows((nH.tourSquad && nH.tourSquad.length) ? nH.tourSquad : nH.squad, host, mySlot, myNat) +
        "</div>" +
        "</div>" +

        "<div class='fo-pm-foot'>" + actions.join("") + "</div>" +
        "</div></div></div>";

      document.body.classList.add("fo-pm-on");
      FO_PM_ON = true;
      var host9 = document.getElementById("fo-pm-count");
      if (host9) host9.__g = g;
      try { if (window.__foPmTimer) clearInterval(window.__foPmTimer); } catch (eT) {}
      window.__foPmTimer = setInterval(foPmTick, 1000);

      // THE BAR, off the two parties the selectors actually named. The men are
      // read out of world_squads - the public card every club's men are
      // published as - and the two books are asked for once; when they land the
      // page repaints and this runs.
      try {
        var wpHost9 = document.getElementById("fo-pm-wp");
        if (wpHost9) {
          var again9 = function () {
            page.__foPmSig = null;
            try { window.foRenderPreviewPage(); } catch (e) {}
          };
          var bkA9 = foPmNatMen(away, again9), bkH9 = foPmNatMen(host, again9);
          var partyA9 = (nA.tourSquad && nA.tourSquad.length) ? nA.tourSquad : nA.squad;
          var partyH9 = (nH.tourSquad && nH.tourSquad.length) ? nH.tourSquad : nH.squad;
          var menA9 = foPmNatXI(away, partyA9, bkA9), menH9 = foPmNatXI(host, partyH9, bkH9);
          if (menA9 && menH9) {
            // the HOST is at home and collects the ground, so the odds are
            // worked from its side; the bar leads with the tourist, as the
            // billing does, so the two are handed over the other way round
            var o9 = window.foPmOdds(window.foPmStrength(menH9), window.foPmStrength(menA9));
            if (o9) {
              foPmWpPaint(wpHost9, { home: o9.away, away: o9.home, tie: o9.tie },
                foPmNatCode(away, nA.name), foPmNatCode(host, nH.name));
            }
          } else if (bkA9 === false || bkH9 === false) {
            wpHost9.style.display = "none";      // the books cannot be had
          }
        }
      } catch (eWp9) {
        try { console.error("tour preview: win probability failed", eWp9); } catch (eL9) {}
        try { var wpDead9 = document.getElementById("fo-pm-wp"); if (wpDead9) wpDead9.style.display = "none"; } catch (eD9) {}
      }
      return true;
    } catch (e) {
      try { console.error("foRenderIntlPreview", e); } catch (e2) {}
      return false;
    }
  };
  // A TOUR IS A DOOR TOO. The address names the tie and the window round, so
  // it stands whether the game has been bowled or not.
  window.foIntlPreviewHref = function (away, host, round) {
    return "#/preview?nat=" + encodeURIComponent(away + "-" + host) + "&r=" + (round | 0);
  };

  function foPmCss() {
    if (document.getElementById("fo-pm-css")) return;
    var css = [
      // THE DAYLIGHT PREVIEW: the same room, with the lights on. Cream page,
      // white card, navy ink, the club-dashboard's orange - the night skin
      // retired with the rest of the dark pages.
      "#page .fo-pm{--acc:#C9571F;--navy:#14243A;--ink:#1B2432;--mut:#4A5668;--edge:rgba(27,36,50,.09);--grn:#136A4B;position:relative;min-height:60vh;background:#F1EEE6;color:var(--ink);overflow-x:clip;padding:clamp(10px,2vw,20px) 0 clamp(30px,5vw,56px)}",
      "#page .fo-pm *{box-sizing:border-box}",
      "body.fo-pm-on #page{padding:0;max-width:none}",
      "html body.ftpskin.fo-pm-on,html body.fo-pm-on{background:#F1EEE6 !important}",
      "body.fo-pm-on #page{background:#F1EEE6}",
      ".fo-pm-in{width:min(720px,100%);margin:0 auto;padding:0 clamp(10px,2.6vw,16px)}",
      ".fo-pm-card{background:#FFFEFC;border:1px solid var(--edge);border-radius:16px;padding:clamp(12px,2.4vw,17px);display:flex;flex-direction:column;gap:clamp(11px,1.8vw,14px);box-shadow:0 1px 3px rgba(14,35,63,.05)}",
      ".fo-pm-main,.fo-pm-rail{display:flex;flex-direction:column;gap:clamp(11px,1.8vw,14px);min-width:0}",
      // the tour's two touring parties: stacked on a phone, side by side once
      // the card takes the width (the desktop rule is in the media block below)
      ".fo-pm-wide{display:grid;grid-template-columns:1fr;gap:14px;min-width:0}",
      ".fo-pm-sq{display:flex;flex-direction:column;gap:8px;min-width:0}",
      // THE DESKTOP SPREAD. A 720px card on a wide monitor was a column of
      // cream either side of it. Past 980px the card takes the width: billing
      // across the top, the ground and its facts filling the left, the
      // probability, status, head-to-head and conditions as a right rail, the
      // actions across the bottom.
      "@media(min-width:980px){",
      ".fo-pm-in{width:min(1150px,100%)}",
      ".fo-pm-card{display:grid;grid-template-columns:1.3fr .95fr;gap:15px 18px;padding:20px 22px;align-items:start}",
      ".fo-pm-folio,.fo-pm-bill,.fo-pm-foot,.fo-pm-wide{grid-column:1/-1}",
      ".fo-pm-main{grid-column:1;align-self:stretch}",
      ".fo-pm-rail{grid-column:2}",
      ".fo-pm-wide{grid-template-columns:1fr 1fr;gap:18px}",
      // the painting absorbs whatever height the rail sets: absolutely
      // positioned inside its plate, it contributes no height of its own, so
      // the row is the rail's and the left column is all art down to the facts
      ".fo-pm-main .fo-pm-plate{position:relative;flex:1;min-height:320px}",
      ".fo-pm-main .fo-pm-plate img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;aspect-ratio:auto;max-height:none}",
      ".fo-pm-rail .fo-pm-duo{grid-template-columns:1fr 1fr}",
      ".fo-pm-foot{grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}",
      "}",
      ".fo-pm-folio{display:inline-flex;align-items:center;gap:9px;align-self:flex-start;background:rgba(20,36,58,.05);border:1px solid var(--edge);border-radius:999px;padding:6px 14px 6px 7px}",
      ".fo-pm-folio img{width:20px;height:14px;object-fit:cover;border-radius:3px;flex:0 0 auto}",
      // the date rides in the folio, divided off the tour's name
      ".fo-pm-folio em{font:700 10.5px/1 Manrope,sans-serif;font-style:normal;letter-spacing:.1em;text-transform:uppercase;color:var(--acc);padding-left:11px;margin-left:2px;border-left:1px solid rgba(27,36,50,.14);white-space:nowrap}",
      ".fo-pm-folio span{font-family:Manrope,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.16em;font-size:10.5px;color:var(--navy)}",
      ".fo-pm-bill{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:clamp(7px,2vw,14px)}",
      ".fo-pm-billside{display:flex;align-items:center;gap:10px;min-width:0}",
      ".fo-pm-billside.a{flex-direction:row-reverse;text-align:right}",
      ".fo-pm-billside>div{min-width:0}",
      ".fo-pm-billside b{display:block;font-family:Manrope,sans-serif;font-weight:700;text-transform:uppercase;line-height:1.04;letter-spacing:.005em;font-size:clamp(14px,3.9vw,21px);color:var(--navy);overflow-wrap:anywhere}",
      ".fo-pm-billside i{display:block;margin-top:3px;font-family:Manrope,sans-serif;font-weight:700;font-style:normal;text-transform:uppercase;letter-spacing:.2em;font-size:10.5px;color:#5A6B84}",
      ".fo-pm-v{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;border:1.5px solid rgba(201,87,31,.55);flex:0 0 auto}",
      ".fo-pm-v span{font-family:Manrope,sans-serif;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--acc);line-height:1}",
      ".fo-pm-sh{display:grid;place-items:center;width:29px;height:29px;border-radius:7px;background:var(--sc,#14243A);color:#fff;font:700 11px/1 Manrope,sans-serif;letter-spacing:.04em;flex:0 0 auto}",
      ".fo-pm-sh.big{width:clamp(36px,9.5vw,44px);height:clamp(36px,9.5vw,44px);border-radius:9px;font-size:clamp(12px,3.2vw,15px)}",
      ".fo-pm-sh.crest{background:none;object-fit:contain}",
      ".fo-pm-sh.arms,.fo-pm-sh.arms.big{background:none;width:auto;height:auto;border-radius:0;display:inline-flex;align-items:center}",
      ".fo-pm-sh.arms svg{display:block}",
      ".fo-pm-plate{margin:0;line-height:0;background:#EBE6DA;border-radius:12px;overflow:hidden}",
      ".fo-pm-plate img{display:block;width:100%;height:auto;aspect-ratio:32/12.5;object-fit:cover;object-position:center 45%}",
      "@media(max-width:760px){.fo-pm-plate img{aspect-ratio:16/8}}",
      ".fo-pm-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:linear-gradient(0deg,#FBF6EA,#FDFAF2);border:1px solid var(--edge);border-radius:12px}",
      ".fo-pm-facts.four{grid-template-columns:repeat(2,minmax(0,1fr))}",
      ".fo-pm-fact{display:flex;align-items:center;gap:9px;padding:11px 11px;min-width:0;border-left:1px solid var(--edge)}",
      ".fo-pm-fact:first-child{border-left:0}",
      ".fo-pm-fact>div{min-width:0}",
      ".fo-pm-ic{flex:0 0 auto;color:#5A6B84;opacity:1}",
      ".fo-pm-fact b{display:block;font-family:Manrope,sans-serif;font-weight:600;font-size:clamp(11.5px,3vw,15px);line-height:1.2;color:var(--navy);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}",
      ".fo-pm-fact i{display:block;margin-top:3px;font-family:Manrope,sans-serif;font-weight:700;font-style:normal;text-transform:uppercase;letter-spacing:.12em;font-size:10.5px;color:#5A6B84;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#page .fo-pm-fact[data-k=live] b{color:#B23230}",
      "#page .fo-pm-fact[data-k=live] .fo-pm-ic{color:#B23230;opacity:1}",
      "@media(max-width:430px){.fo-pm-fact{flex-direction:column;align-items:flex-start;gap:6px;padding:10px 8px}",
      // the stacked fact's inner block must take the cell's width, not its
      // text's - shrink-wrapped, a long ground name or label painted straight
      // across the neighbouring cell
      ".fo-pm-fact>div{width:100%}",
      ".fo-pm-fact i{white-space:normal;overflow:visible;text-overflow:clip}}",
      ".fo-pm-cap{font-family:Manrope,sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:10px;color:var(--navy);font-weight:600}",
      ".fo-pm-cap:before{content:'';display:inline-block;width:7px;height:7px;background:var(--acc);border-radius:2px;margin-right:8px;vertical-align:1px}",
      ".fo-pm-wp{padding:13px 14px;border-radius:12px;background:linear-gradient(0deg,#FBF6EA,#FDFAF2);border:1px solid var(--edge);display:flex;flex-direction:column;gap:9px}",
      ".fo-pm-wp .fo-pm-cap{text-align:center}",
      // A GRID, NOT A FLEX ROW. Two flexible halves meeting in the middle let a
      // long club name walk straight over the percentage beside it - which is
      // exactly what "MASHED POTATOES 58%" did. Three columns: each side gets
      // its own, the middle is empty air, and nothing can reach across.
      ".fo-pm-wptop{display:grid;grid-template-columns:minmax(0,1fr) 14px minmax(0,1fr);align-items:center;gap:0}",
      ".fo-pm-wph,.fo-pm-wpa{display:flex;align-items:center;gap:8px;min-width:0}",
      ".fo-pm-wpa{grid-column:3;justify-content:flex-end}",
      // a code, never a clipped name: no ellipsis is allowed in this strip
      ".fo-pm-wph u,.fo-pm-wpa u{text-decoration:none;font-family:Manrope,sans-serif;text-transform:uppercase;letter-spacing:.1em;font-size:11.5px;color:var(--ink);white-space:nowrap;font-weight:800}",
      ".fo-pm-wpsay{text-align:center;font:700 10.5px/1 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#4A5668}",
      ".fo-pm-wph b,.fo-pm-wpa b{font-family:Manrope,sans-serif;font-weight:700;font-size:clamp(19px,4.4vw,25px);line-height:1;font-variant-numeric:tabular-nums;flex:0 0 auto;white-space:nowrap}",
      ".fo-pm-wph u,.fo-pm-wpa u{flex:0 1 auto}",
      ".fo-pm-wpsay{margin-top:2px}",
      ".fo-pm-wph b{color:var(--grn)}",
      ".fo-pm-wpa b{color:var(--acc)}",
      ".fo-pm-wpbar{display:flex;height:12px;border-radius:999px;overflow:hidden;background:#EBE6DA}",
      ".fo-pm-wpbar span{display:block;height:100%;width:0;transition:width .5s cubic-bezier(.2,.7,.2,1)}",
      ".fo-pm-wpbar .h{background:linear-gradient(90deg,#136A4B,#177A57)}",
      ".fo-pm-wpbar .t{background:rgba(27,36,50,.18)}",
      ".fo-pm-wpbar .a{background:linear-gradient(90deg,#C9571F,#C9571F)}",
      "@media(prefers-reduced-motion:reduce){.fo-pm-wpbar span{transition:none}}",
      ".fo-pm-two{display:flex;flex-direction:column;gap:7px}",
      "#page a.fo-pm-sl{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-rows:auto auto auto;column-gap:11px;row-gap:4px;align-items:center;padding:11px 12px;border-radius:11px;background:#FFFEFC;border:1px solid var(--edge);text-decoration:none}",
      "#page a.fo-pm-sl:hover{border-color:rgba(201,87,31,.5)}",
      "#page a.fo-pm-sl.mine{border-color:rgba(201,87,31,.45);background:#FBF6EA}",
      "#page a.fo-pm-sl .fo-pm-sh{grid-row:span 3}",
      "#page a.fo-pm-sl b{font-family:Manrope,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.02em;font-size:14px;color:var(--navy);overflow-wrap:anywhere}",
      "#page a.fo-pm-sl b{grid-column:2;grid-row:1}",
      "#page a.fo-pm-sl b i{font-family:Manrope,sans-serif;font-style:normal;font-weight:600;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--acc);margin-left:5px}",
      "#page a.fo-pm-sl b i u{text-decoration:none;font-size:10px}",
      "#page a.fo-pm-sl .fo-pm-her{grid-column:2;grid-row:2;font:600 12.5px/1.35 Manrope,sans-serif;color:#4A5668}",
      "#page a.fo-pm-sl .fo-pm-beads{grid-column:2;grid-row:3}",
      "#page a.fo-pm-sl .fo-pm-slst{grid-column:2;grid-row:4;display:flex;gap:14px}",
      // a national side has no founding line, so its two lines close up
      "#page a.fo-pm-sl.nat .fo-pm-beads{grid-row:2}",
      "#page a.fo-pm-sl.nat .fo-pm-slst{grid-row:3}",
      "#page a.fo-pm-sl .fo-pm-slst u{text-decoration:none;font:700 11px/1 Manrope,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#5A6B84}",
      "#page a.fo-pm-sl .fo-pm-slst u b{display:block;grid-column:auto;grid-row:auto;font:600 12.5px/1.5 Manrope,sans-serif;color:var(--ink);letter-spacing:0;margin:0;font-variant-numeric:tabular-nums}",
      "#page a.fo-pm-sl .fo-pm-chev{grid-column:3;grid-row:span 3;text-decoration:none;font:400 20px/1 Fraunces,Georgia,serif;color:rgba(27,36,50,.4)}",
      ".fo-pm-beads{display:flex;gap:4px}",
      ".fo-pm-beads i{display:grid;place-items:center;width:19px;height:19px;border-radius:4px;font:700 10px/1 Manrope,sans-serif;font-style:normal;color:#fff}",
      ".fo-pm-beads i.w{background:#1F7A50}.fo-pm-beads i.l{background:#B23230}.fo-pm-beads i.t{background:#9FB0C6}",
      ".fo-pm-none{font:600 11.5px/1.2 Manrope,sans-serif;color:#4A5668}",
      ".fo-pm-h2hs{display:flex;flex-direction:column;gap:6px}",
      "#page a.fo-pm-h2h{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:2px 10px;align-items:center;padding:9px 12px;border-radius:10px;background:#FFFEFC;border:1px solid var(--edge);text-decoration:none;color:var(--ink)}",
      "#page a.fo-pm-h2h:hover{border-color:rgba(201,87,31,.5)}",
      "#page a.fo-pm-h2h i{grid-row:span 2;font:800 12px/1 Manrope,sans-serif;font-style:normal;color:#5A6B84}",
      "#page a.fo-pm-h2h b{font:700 12.5px/1.3 Manrope,sans-serif;color:var(--navy);display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}",
      "#page a.fo-pm-h2h span{grid-column:2;font:600 12.5px/1.4 Manrope,sans-serif;color:#4A5668}",
      "#page a.fo-pm-h2h s{grid-column:3;grid-row:span 2;text-decoration:none;font:400 18px/1 Fraunces,Georgia,serif;color:rgba(27,36,50,.4)}",
      // A GAME OF THE SERIES THAT HAS NOT BEEN BOWLED IS NOT A DOOR, so it is
      // not a link - the same row, without the hover and without the chevron.
      // The one being previewed wears the accent so the reader knows where in
      // the three he is standing.
      "#page .fo-pm-h2h.flat{display:grid;grid-template-columns:34px minmax(0,1fr);gap:2px 10px;align-items:center;padding:9px 12px;border-radius:10px;background:#FBF8F1;border:1px dashed var(--edge);color:var(--ink)}",
      "#page .fo-pm-h2h.flat i{grid-row:span 2;font:800 12px/1 Manrope,sans-serif;font-style:normal;color:#5A6B84}",
      "#page .fo-pm-h2h.flat b{font:700 12.5px/1.3 Manrope,sans-serif;color:var(--navy);display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}",
      "#page .fo-pm-h2h.flat span{grid-column:2;font:600 12.5px/1.4 Manrope,sans-serif;color:#4A5668}",
      "#page .fo-pm-h2h.flat.now{background:#FBF6EA;border:1px solid rgba(201,87,31,.45)}",
      "#page .fo-pm-h2h.flat.now i,#page .fo-pm-h2h.flat.now span{color:var(--acc)}",
      // THE TOURING PARTY. Fifteen names, the club each was taken from and
      // what he has already won - a list a manager reads down looking for his
      // own, which is why his own are marked.
      ".fo-pm-party{display:grid;grid-template-columns:repeat(auto-fill,minmax(228px,1fr));gap:6px}",
      "#page .fo-pm-cap-man{display:grid;grid-template-columns:20px 22px minmax(0,1fr) auto;gap:1px 8px;align-items:baseline;padding:8px 11px;border-radius:10px;background:#FFFEFC;border:1px solid var(--edge);text-decoration:none;color:var(--ink)}",
      "#page a.fo-pm-cap-man:hover{border-color:rgba(201,87,31,.5)}",
      "#page .fo-pm-cap-man.mine{border-color:rgba(201,87,31,.45);background:#FBF6EA}",
      "#page .fo-pm-cap-man i{grid-row:span 3;font:800 11px/1.4 Manrope,sans-serif;font-style:normal;color:#5A6B84;font-variant-numeric:tabular-nums}",
      "#page .fo-pm-cap-man b{font:600 12.5px/1.3 Manrope,sans-serif;color:var(--navy);overflow-wrap:anywhere}",
      "#page .fo-pm-cap-man span{grid-column:3;grid-row:2;font:600 11.5px/1.35 Manrope,sans-serif;color:#4A5668;overflow-wrap:anywhere}",
      "#page .fo-pm-cap-man u{grid-column:4;grid-row:1;text-decoration:none;font:700 9.5px/1.3 Manrope,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--grn);white-space:nowrap}",
      "#page .fo-pm-cap-man s{grid-column:4;grid-row:2;text-decoration:none;font:400 15px/1 Fraunces,Georgia,serif;color:rgba(27,36,50,.45);text-align:right}",
      // THE FLAG HE PLAYS UNDER, beside his number
      "#page .fo-pm-mfl{grid-column:2;grid-row:span 2;width:22px;height:15px;object-fit:cover;border-radius:3px;align-self:center;box-shadow:0 0 0 1px rgba(27,36,50,.1)}",
      ".fo-pm-duo{display:grid;grid-template-columns:1fr;gap:9px}",
      "@media(min-width:560px){.fo-pm-duo{grid-template-columns:1fr 1.2fr}}",
      ".fo-pm-box{padding:12px 14px;border-radius:12px;background:linear-gradient(0deg,#FBF6EA,#FDFAF2);border:1px solid var(--edge);display:flex;flex-direction:column;gap:9px}",
      ".fo-pm-big{font:700 24px/1.05 Manrope,sans-serif;color:var(--navy);letter-spacing:-.3px;font-variant-numeric:tabular-nums}",
      // the series scoreline's tail: 1-0 (Best of 3)
      ".fo-pm-big em{font:700 12px/1 Manrope,sans-serif;font-style:normal;letter-spacing:.06em;text-transform:uppercase;color:#4A5668;margin-left:7px;vertical-align:2px}",
      // the day and hour a game of the series is bowled on, beside its name
      "#page .fo-pm-h2h b u{text-decoration:none;font:700 10.5px/1 Manrope,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#5A6B84;white-space:nowrap;font-variant-numeric:tabular-nums}",
      "#page .fo-pm-h2h.now b u{color:var(--acc)}",
      ".fo-pm-prn{margin:0;font:400 13px/1.55 Manrope,sans-serif;color:#3c4757}",
      ".fo-pm-dim{margin:0;font-family:Fraunces,Georgia,'Times New Roman',serif;font-style:normal;font-size:13px;line-height:1.5;color:var(--mut)}",
      ".fo-pm-lost{font-family:Manrope,sans-serif;font-weight:700;text-transform:uppercase;font-size:clamp(24px,3.4vw,40px);color:var(--navy);margin:14px 0 8px}",
      ".fo-pm-mast{font-family:Manrope,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:10px;color:var(--acc)}",
      ".fo-pm-foot{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding-top:clamp(12px,2vw,16px);border-top:1px solid var(--edge)}",
      "#page .fo-pm-cta,#page .fo-pm-back{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:48px;padding:10px 14px;border-radius:12px;text-decoration:none;font-family:Manrope,sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:10.5px;font-weight:600;text-align:center;transition:transform .16s ease,background .16s ease,border-color .16s ease}",
      "#page .fo-pm-cta svg,#page .fo-pm-back svg{flex:0 0 auto}",
      "@media(max-width:430px){.fo-pm-foot{grid-template-columns:1fr}}",
      "html body #page .fo-pm-cta{background:linear-gradient(180deg,#C9571F,#B4441C);color:#FFF6EE !important;box-shadow:0 2px 8px rgba(184,78,40,.28);text-decoration:none !important}",
      ".fo-pm-cta:hover{transform:translateY(-1px)}",
      "html body #page .fo-pm-cta.live{background:linear-gradient(180deg,#C9571F,#B4441C);color:#FFF6EE !important}",
      // the filed sheet: green means done, and the button asks nothing more
      "html body #page .fo-pm-cta.done{background:linear-gradient(180deg,#177A57,#136A4B);box-shadow:0 2px 8px rgba(31,111,74,.28);color:#EFFAF3 !important}",
      ".fo-pm-cta.live:before{content:'';width:8px;height:8px;border-radius:50%;background:#FFE9E0;flex:0 0 auto;animation:foPmLiveDot 1.2s ease-in-out infinite}",
      "@keyframes foPmLiveDot{0%,100%{opacity:1}50%{opacity:.3}}",
      "@media(prefers-reduced-motion:reduce){.fo-pm-cta.live:before{animation:none}}",
      "html body #page .fo-pm-back{border:1.5px solid rgba(20,36,58,.3);color:#14243A !important;background:#FFFEFC;text-decoration:none !important}",
      ".fo-pm-back:hover{border-color:var(--acc);color:var(--acc)}",
      "@media(max-width:560px){.fo-pm-bill{grid-template-columns:1fr;justify-items:center;gap:8px;text-align:center}",
      ".fo-pm-billside,.fo-pm-billside.a{align-items:center;text-align:center}",
      ".fo-pm-billside b{font-size:clamp(24px,7.4vw,36px);word-break:normal;overflow-wrap:anywhere}",
      ".fo-pm-v{width:38px;height:38px}.fo-pm-v span{font-size:17px}}",
      "@media(prefers-reduced-motion:reduce){.fo-pm-h2h,.fo-pm-cta,.fo-pm-back{transition:none}}",
      "@media(max-width:760px){",
      "#page .fo-pm{min-height:0}",
      ".fo-pm-card{padding:11px;gap:10px;border-radius:14px}",
      ".fo-pm-folio{padding:5px 12px 5px 6px}",
      ".fo-pm-folio span{font-size:10px;letter-spacing:.15em}",
      ".fo-pm-bill{gap:6px}",
      ".fo-pm-billside{gap:8px}",
      ".fo-pm-billside b{font-size:clamp(13px,4.2vw,18px)}",
      ".fo-pm-billside i{font-size:10px;letter-spacing:.18em}",
      ".fo-pm-sh.big{width:34px;height:34px;border-radius:8px;font-size:12px}",
      ".fo-pm-v{width:34px;height:34px}.fo-pm-v span{font-size:10px}",
      ".fo-pm-wp{padding:11px 11px;gap:8px}",
      ".fo-pm-wph b,.fo-pm-wpa b{font-size:20px}",
      ".fo-pm-wph u,.fo-pm-wpa u{font-size:10px}",
      ".fo-pm-sh{width:24px;height:24px;border-radius:6px;font-size:10px}",
      "#page a.fo-pm-sl{padding:9px 10px;column-gap:9px}",
      "#page a.fo-pm-sl b{font-size:12.5px}",
      ".fo-pm-beads i{width:16px;height:16px;border-radius:3px;font-size:10px}",
      "#page a.fo-pm-sl .fo-pm-slst{gap:10px}",
      "#page .fo-pm-cta,#page .fo-pm-back{min-height:44px;font-size:10px;letter-spacing:.1em;gap:7px}",
      "}"
    ].join("\n");
    var st = document.createElement("style");
    st.id = "fo-pm-css"; st.textContent = css;
    document.head.appendChild(st);
  }
})();
