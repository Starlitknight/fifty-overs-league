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
  function foPmH2H(g, hSlot, aSlot) {
    var hn = foPmName(g, hSlot), an = foPmName(g, aSlot), out = [];
    try {
      ((g.snap && g.snap.results) || []).forEach(function (r) {
        if ((r.home === hn && r.away === an) || (r.home === an && r.away === hn)) out.push(r);
      });
    } catch (e) {}
    return out;
  }

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
    var won = [];
    if (h.titles) won.push(foPmPl(h.titles, "league title", "league titles"));
    if (h.cups) won.push(foPmPl(h.cups, "national cup", "national cups"));
    if (h.crowns) won.push(foPmPl(h.crowns, "Champions Cup", "Champions Cups"));
    return "<span class='fo-pm-her'>Est. " + h.founded + " &middot; " +
      foPmPl(h.seasons, "season", "seasons") + " played" +
      (won.length ? " &middot; " + won.join(", ") : " &middot; no honours") + "</span>";
  }
  function foPmSideRow(natId, slot, nm, boss, st, isMine, mgrs) {
    return "<a class='fo-pm-sl" + (isMine ? " mine" : "") +
      "' href='#/team?c=" + encodeURIComponent(natId) + "&s=" + slot + "'>" +
      foPmShield(nm, boss, natId) +
      "<b>" + foPmE(nm) + " <i>" + foPmPosOrd(st.pos) +
      (st.p ? " &middot; " + st.pts + " pts" : "") + "</i></b>" +
      foPmHonours(natId, slot, isMine, mgrs) +
      "<span class='fo-pm-beads'>" + foPmBeads(st) + "</span>" +
      "<span class='fo-pm-slst'>" +
      "<u>P<b>" + st.p + "</b></u><u>W<b>" + st.w + "</b></u><u>L<b>" + st.l + "</b></u>" +
      "<u>PTS<b>" + st.pts + "</b></u><u>NRR<b>" + (st.p ? (st.nrr >= 0 ? "+" : "") + st.nrr.toFixed(2) : "&mdash;") + "</b></u>" +
      "</span>" +
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
  var FO_PM_FA = { r16: "Cup round of 16", qf: "Cup quarter-final", sf: "Cup semi-final", final: "The Cup final" };
  var FO_PM_WP_N = 40;              // how many times the fixture is played out
  var FO_PM_WP_CHUNK = 4;           // per tick, so a phone never locks up
  var FO_PM_WP = {};                // this session, by fixture id
  function foPmWpLoad(key) {
    if (FO_PM_WP[key]) return FO_PM_WP[key];
    try {
      var raw = localStorage.getItem("fo_wp_" + key);
      if (raw) { var v = JSON.parse(raw); if (v && v.n === FO_PM_WP_N) { FO_PM_WP[key] = v; return v; } }
    } catch (e) {}
    return null;
  }
  function foPmWpSave(key, v) {
    FO_PM_WP[key] = v;
    try { localStorage.setItem("fo_wp_" + key, JSON.stringify(v)); } catch (e) {}
  }
  function foPmWpPaint(host, v, done) {
    if (!host) return;
    var n = v.h + v.a + v.t; if (!n) return;
    var ph = Math.round(100 * v.h / n), pa = Math.round(100 * v.a / n);
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
    host.classList.toggle("settled", !!done);
  }
  // each side carries its own nation: a league fixture's two clubs share one,
  // a friendly's may not, and the forty playings must field the right squads
  function foPmWpRun(host, sig, key, hS, aS, ground) {
    var G = window.__foGame, WT = window.__foWT;
    if (!G || !G.simWorld || !G.hash || !WT || !WT.serverSquad) { host.style.display = "none"; return; }
    var sqH = WT.serverSquad(hS.nat, hS.slot), sqA = WT.serverSquad(aS.nat, aS.slot);
    if (!sqH || !sqA) { host.style.display = "none"; return; }
    var hN = hS.name, aN = aS.name;
    var H = { name: hN, ground: ground, players: sqH }, A = { name: aN, players: sqA };
    var v = { h: 0, a: 0, t: 0, n: FO_PM_WP_N }, i = 0;
    var step = function () {
      if (location.hash !== sig) return;                       // the reader moved on
      for (var c = 0; c < FO_PM_WP_CHUNK && i < FO_PM_WP_N; c++, i++) {
        var out = null;
        try { out = G.simWorld(H, A, "balanced", "Sunny", (G.hash(key + "|wp|" + i) >>> 0) || 1, null); } catch (eS) {}
        if (!out || !out.result) { v.t++; continue; }
        var w = out.result.winner;
        if (w === hN) v.h++; else if (w === aN) v.a++; else v.t++;
      }
      var done = i >= FO_PM_WP_N;
      foPmWpPaint(host, v, done);
      if (done) { foPmWpSave(key, v); return; }
      setTimeout(step, 0);
    };
    step();
  }

  // ---- the countdown --------------------------------------------------------
  // A fixture is a time as much as a pairing. This says how long, in the units
  // a person actually thinks in, and re-reads itself every second so the page
  // is never quietly stale.
  function foPmCountText(g, now) {
    if (now >= g.stop) return { k: "done", big: "Stumps", sub: "This one is in the book" };
    if (now >= g.start) return { k: "live", big: "Playing now", sub: "The middle of the day's cricket" };
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
      var h2h = foPmH2H(g, hSlot, aSlot);
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

      var h2hHTML = h2h.length
        ? h2h.map(function (r) {
            var href = "#/report?n=" + encodeURIComponent(natId) + "&w=" + encodeURIComponent(r.id || "");
            return "<a class='fo-pm-h2h' href='" + href + "'>" +
              "<i>R" + (r.round | 0) + "</i>" +
              "<b>" + foPmE(r.home) + " v " + foPmE(r.away) + "</b>" +
              "<span>" + foPmE(r.text || "") + "</span><s>&#8250;</s></a>";
          }).join("")
        : "<p class='fo-pm-dim'>They have not met yet this season. This is the first time of asking.</p>";

      // THE CONDITIONS: the strip the groundsman prepared and the sky the
      // season deals, both pure functions of the world - the same weather the
      // umpire will play this fixture under.
      var PITCH_W = { balanced: "Balanced", flat: "Flat", green: "Green", dry: "Crumbling",
        slow: "Slow", cracked: "Sticky", twoPaced: "Two-paced" };
      var PITCH_N = {
        balanced: "A fair contest; nobody gets favours.",
        green: "Seam and swing; the new-ball spell is brutal.",
        dry: "Turns square as it wears on; spinners own the middle.",
        flat: "A batter's road: boundaries flow, totals balloon.",
        slow: "Low and grippy; sixes are dear, rotation pays.",
        cracked: "Unpredictable bounce, wickets for everyone.",
        twoPaced: "Some balls hurry, some hold; timing is never safe."
      };
      // What each sky actually does in the engine (00-core ballDist weather
      // block): stated as effects, not scenery.
      var WEATHER_N = {
        Sunny: "Nothing in it for anyone: true conditions, an honest fight.",
        Overcast: "Cloud keeps the seamers interested all day; boundaries come harder.",
        Humid: "Heavy air swings the new ball; survive the opening spell and it eases.",
        Hot: "Bowlers wilt in the heat; wickets are dearer and runs flow freer.",
        Scorching: "Brutal on bowlers: scoring surges and wickets are hard-won.",
        Drizzle: "A damp ball is hard to time; boundaries dry up and scoring crawls.",
        Windy: "Sixes die in the crosswind; the runs come in hard-run twos instead.",
        Chilly: "Cold cramps the strokeplay; boundaries are scarce and dots pile up.",
        Misty: "The new ball stays a menace in the murk; early wickets for the seamers.",
        "Dew later": "Evening dew blunts the spinners; the chasing side bats the easier half."
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
        "<span class='fo-pm-wph'>" + foPmShield(hN, hBoss, natId) + "<u>" + foPmE(hN) + "</u><b>&mdash;</b></span>" +
        "<span class='fo-pm-wpa'><b>&mdash;</b><u>" + foPmE(aN) + "</u>" + foPmShield(aN, aBoss, natId) + "</span>" +
        "</div>" +
        "<div class='fo-pm-wpbar'><span class='h'></span><span class='t'></span><span class='a'></span></div>" +
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
          // the key is the fixture and nothing else: what was known can no
          // longer change what the bar says, so a cached number is never stale
          var wpKey = natId + ":s" + g.seasonNo + ":" + (stage ? "fa" + stage : "r" + round) + ":h" + hSlot + "a" + aSlot;
          var cached = foPmWpLoad(wpKey);
          if (cached) foPmWpPaint(wpHost, cached, true);
          else foPmWpRun(wpHost, location.hash, wpKey,
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
        balanced: "A fair contest; nobody gets favours.",
        green: "Seam and swing; the new-ball spell is brutal.",
        dry: "Turns square as it wears on; spinners own the middle.",
        flat: "A batter's road: boundaries flow, totals balloon.",
        slow: "Low and grippy; sixes are dear, rotation pays.",
        cracked: "Unpredictable bounce, wickets for everyone.",
        twoPaced: "Some balls hurry, some hold; timing is never safe."
      };
      var WEATHER_N = {
        Sunny: "Nothing in it for anyone: true conditions, an honest fight.",
        Overcast: "Cloud keeps the seamers interested all day; boundaries come harder.",
        Humid: "Heavy air swings the new ball; survive the opening spell and it eases.",
        Hot: "Bowlers wilt in the heat; wickets are dearer and runs flow freer.",
        Scorching: "Brutal on bowlers: scoring surges and wickets are hard-won.",
        Drizzle: "A damp ball is hard to time; boundaries dry up and scoring crawls.",
        Windy: "Sixes die in the crosswind; the runs come in hard-run twos instead.",
        Chilly: "Cold cramps the strokeplay; boundaries are scarce and dots pile up.",
        Misty: "The new ball stays a menace in the murk; early wickets for the seamers.",
        "Dew later": "Evening dew blunts the spinners; the chasing side bats the easier half."
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
        "<p class='fo-pm-dim'>A friendly &mdash; nothing is banked. No points, no table, no place in the record; the sheet you file is the side that walks out.</p>" +
        "</div>" +

        "<div class='fo-pm-rail'>" +
        "<div id='fo-pm-wp' class='fo-pm-wp'>" +
        "<div class='fo-pm-cap'>Win probability &middot; projected</div>" +
        "<div class='fo-pm-wptop'>" +
        "<span class='fo-pm-wph'>" + foPmShield(hN, hSlot === 0, hNat) + "<u>" + foPmE(hN) + "</u><b>&mdash;</b></span>" +
        "<span class='fo-pm-wpa'><b>&mdash;</b><u>" + foPmE(aN) + "</u>" + foPmShield(aN, aSlot === 0, aNat) + "</span>" +
        "</div>" +
        "<div class='fo-pm-wpbar'><span class='h'></span><span class='t'></span><span class='a'></span></div>" +
        "</div>" +

        "<div class='fo-pm-cap'>Team status</div>" +
        "<div class='fo-pm-two'>" +
        foPmSideRow(hNat, hSlot, hN, hSlot === 0, hSt, mineH, mgrsH) +
        foPmSideRow(aNat, aSlot, aN, aSlot === 0, aSt, mineA, mgrsA) +
        "</div>" +

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

      // the bar: the same forty playings, keyed to the friendly itself
      try {
        var wpHost = document.getElementById("fo-pm-wp");
        if (wpHost) {
          var wpKey = "fr" + frId + ":" + hNat + hSlot + "v" + aNat + aSlot;
          var cached = foPmWpLoad(wpKey);
          if (cached) foPmWpPaint(wpHost, cached, true);
          else foPmWpRun(wpHost, location.hash, wpKey,
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

  function foPmCss() {
    if (document.getElementById("fo-pm-css")) return;
    var css = [
      // THE DAYLIGHT PREVIEW: the same room, with the lights on. Cream page,
      // white card, navy ink, the club-dashboard's orange - the night skin
      // retired with the rest of the dark pages.
      "#page .fo-pm{--acc:#C9571F;--navy:#14243A;--ink:#1B2432;--mut:#67748a;--edge:rgba(27,36,50,.09);--grn:#136A4B;position:relative;min-height:60vh;background:#F1EEE6;color:var(--ink);overflow-x:clip;padding:clamp(10px,2vw,20px) 0 clamp(30px,5vw,56px)}",
      "#page .fo-pm *{box-sizing:border-box}",
      "body.fo-pm-on #page{padding:0;max-width:none}",
      "html body.ftpskin.fo-pm-on,html body.fo-pm-on{background:#F1EEE6 !important}",
      "body.fo-pm-on #page{background:#F1EEE6}",
      ".fo-pm-in{width:min(720px,100%);margin:0 auto;padding:0 clamp(10px,2.6vw,16px)}",
      ".fo-pm-card{background:#FFFEFC;border:1px solid var(--edge);border-radius:16px;padding:clamp(12px,2.4vw,17px);display:flex;flex-direction:column;gap:clamp(11px,1.8vw,14px);box-shadow:0 1px 3px rgba(14,35,63,.05)}",
      ".fo-pm-main,.fo-pm-rail{display:flex;flex-direction:column;gap:clamp(11px,1.8vw,14px);min-width:0}",
      // THE DESKTOP SPREAD. A 720px card on a wide monitor was a column of
      // cream either side of it. Past 980px the card takes the width: billing
      // across the top, the ground and its facts filling the left, the
      // probability, status, head-to-head and conditions as a right rail, the
      // actions across the bottom.
      "@media(min-width:980px){",
      ".fo-pm-in{width:min(1150px,100%)}",
      ".fo-pm-card{display:grid;grid-template-columns:1.3fr .95fr;gap:15px 18px;padding:20px 22px;align-items:start}",
      ".fo-pm-folio,.fo-pm-bill,.fo-pm-foot{grid-column:1/-1}",
      ".fo-pm-main{grid-column:1;align-self:stretch}",
      ".fo-pm-rail{grid-column:2}",
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
      ".fo-pm-folio span{font-family:Inter,sans-serif;text-transform:uppercase;letter-spacing:.18em;font-size:10px;color:var(--navy)}",
      ".fo-pm-bill{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:clamp(7px,2vw,14px)}",
      ".fo-pm-billside{display:flex;align-items:center;gap:10px;min-width:0}",
      ".fo-pm-billside.a{flex-direction:row-reverse;text-align:right}",
      ".fo-pm-billside>div{min-width:0}",
      ".fo-pm-billside b{display:block;font-family:Inter,sans-serif;font-weight:700;text-transform:uppercase;line-height:1.04;letter-spacing:.005em;font-size:clamp(14px,3.9vw,21px);color:var(--navy);overflow-wrap:anywhere}",
      ".fo-pm-billside i{display:block;margin-top:3px;font-family:Inter,sans-serif;font-style:normal;text-transform:uppercase;letter-spacing:.22em;font-size:10px;color:#9FB0C6}",
      ".fo-pm-v{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;border:1.5px solid rgba(201,87,31,.55);flex:0 0 auto}",
      ".fo-pm-v span{font-family:Inter,sans-serif;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--acc);line-height:1}",
      ".fo-pm-sh{display:grid;place-items:center;width:29px;height:29px;border-radius:7px;background:var(--sc,#14243A);color:#fff;font:700 11px/1 Inter,sans-serif;letter-spacing:.04em;flex:0 0 auto}",
      ".fo-pm-sh.big{width:clamp(36px,9.5vw,44px);height:clamp(36px,9.5vw,44px);border-radius:9px;font-size:clamp(12px,3.2vw,15px)}",
      ".fo-pm-sh.crest{background:none;object-fit:contain}",
      ".fo-pm-sh.arms,.fo-pm-sh.arms.big{background:none;width:auto;height:auto;border-radius:0;display:inline-flex;align-items:center}",
      ".fo-pm-sh.arms svg{display:block}",
      ".fo-pm-plate{margin:0;line-height:0;background:#EBE6DA;border-radius:12px;overflow:hidden}",
      ".fo-pm-plate img{display:block;width:100%;height:auto;aspect-ratio:32/12.5;object-fit:cover;object-position:center 45%}",
      "@media(max-width:760px){.fo-pm-plate img{aspect-ratio:16/8}}",
      ".fo-pm-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:linear-gradient(0deg,#FBF6EA,#FDFAF2);border:1px solid var(--edge);border-radius:12px}",
      ".fo-pm-fact{display:flex;align-items:center;gap:9px;padding:11px 11px;min-width:0;border-left:1px solid var(--edge)}",
      ".fo-pm-fact:first-child{border-left:0}",
      ".fo-pm-fact>div{min-width:0}",
      ".fo-pm-ic{flex:0 0 auto;color:#9FB0C6;opacity:.9}",
      ".fo-pm-fact b{display:block;font-family:Inter,sans-serif;font-weight:600;font-size:clamp(11.5px,3vw,15px);line-height:1.2;color:var(--navy);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}",
      ".fo-pm-fact i{display:block;margin-top:3px;font-family:Inter,sans-serif;font-style:normal;text-transform:uppercase;letter-spacing:.14em;font-size:10px;color:#9FB0C6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#page .fo-pm-fact[data-k=live] b{color:#B23230}",
      "#page .fo-pm-fact[data-k=live] .fo-pm-ic{color:#B23230;opacity:1}",
      "@media(max-width:430px){.fo-pm-fact{flex-direction:column;align-items:flex-start;gap:6px;padding:10px 8px}}",
      ".fo-pm-cap{font-family:Inter,sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:10px;color:var(--navy);font-weight:600}",
      ".fo-pm-cap:before{content:'';display:inline-block;width:7px;height:7px;background:var(--acc);border-radius:2px;margin-right:8px;vertical-align:1px}",
      ".fo-pm-wp{padding:13px 14px;border-radius:12px;background:linear-gradient(0deg,#FBF6EA,#FDFAF2);border:1px solid var(--edge);display:flex;flex-direction:column;gap:9px}",
      ".fo-pm-wp .fo-pm-cap{text-align:center}",
      ".fo-pm-wptop{display:flex;align-items:center;justify-content:space-between;gap:10px}",
      ".fo-pm-wph,.fo-pm-wpa{display:flex;align-items:center;gap:8px;min-width:0}",
      ".fo-pm-wph u,.fo-pm-wpa u{text-decoration:none;font-family:Inter,sans-serif;text-transform:uppercase;letter-spacing:.08em;font-size:10px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}",
      ".fo-pm-wph b,.fo-pm-wpa b{font-family:Inter,sans-serif;font-weight:700;font-size:clamp(20px,5vw,26px);line-height:1;font-variant-numeric:tabular-nums}",
      ".fo-pm-wph b{color:var(--grn)}",
      ".fo-pm-wpa b{color:var(--acc)}",
      ".fo-pm-wpbar{display:flex;height:12px;border-radius:999px;overflow:hidden;background:#EBE6DA}",
      ".fo-pm-wpbar span{display:block;height:100%;width:0;transition:width .5s cubic-bezier(.2,.7,.2,1)}",
      ".fo-pm-wpbar .h{background:linear-gradient(90deg,#136A4B,#177A57)}",
      ".fo-pm-wpbar .t{background:rgba(27,36,50,.18)}",
      ".fo-pm-wpbar .a{background:linear-gradient(90deg,#C9571F,#C9571F)}",
      "@media(prefers-reduced-motion:reduce){.fo-pm-wpbar span{transition:none}}",
      ".fo-pm-two{display:flex;flex-direction:column;gap:7px}",
      "#page a.fo-pm-sl{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-rows:auto auto auto auto;column-gap:11px;row-gap:4px;align-items:center;padding:11px 12px;border-radius:11px;background:#FFFEFC;border:1px solid var(--edge);text-decoration:none}",
      "#page a.fo-pm-sl:hover{border-color:rgba(201,87,31,.5)}",
      "#page a.fo-pm-sl.mine{border-color:rgba(201,87,31,.45);background:#FBF6EA}",
      "#page a.fo-pm-sl .fo-pm-sh{grid-row:span 4}",
      "#page a.fo-pm-sl b{font-family:Inter,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.02em;font-size:14px;color:var(--navy);overflow-wrap:anywhere}",
      "#page a.fo-pm-sl b{grid-column:2;grid-row:1}",
      "#page a.fo-pm-sl b i{font-family:Inter,sans-serif;font-style:normal;font-weight:600;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--acc);margin-left:5px}",
      "#page a.fo-pm-sl b i u{text-decoration:none;font-size:10px}",
      "#page a.fo-pm-sl .fo-pm-her{grid-column:2;grid-row:2;font:500 12px/1.35 Inter,sans-serif;color:rgba(27,36,50,.55)}",
      "#page a.fo-pm-sl .fo-pm-beads{grid-column:2;grid-row:3}",
      "#page a.fo-pm-sl .fo-pm-slst{grid-column:2;grid-row:4;display:flex;gap:14px}",
      "#page a.fo-pm-sl .fo-pm-slst u{text-decoration:none;font:600 11px/1 Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#9FB0C6}",
      "#page a.fo-pm-sl .fo-pm-slst u b{display:block;grid-column:auto;grid-row:auto;font:600 12.5px/1.5 Inter,sans-serif;color:var(--ink);letter-spacing:0;margin:0;font-variant-numeric:tabular-nums}",
      "#page a.fo-pm-sl .fo-pm-chev{grid-column:3;grid-row:span 4;text-decoration:none;font:400 20px/1 Fraunces,Georgia,serif;color:rgba(27,36,50,.4)}",
      ".fo-pm-beads{display:flex;gap:4px}",
      ".fo-pm-beads i{display:grid;place-items:center;width:19px;height:19px;border-radius:4px;font:700 10px/1 Inter,sans-serif;font-style:normal;color:#fff}",
      ".fo-pm-beads i.w{background:#1F7A50}.fo-pm-beads i.l{background:#B23230}.fo-pm-beads i.t{background:#9FB0C6}",
      ".fo-pm-none{font-family:Fraunces,Georgia,serif;font-style:normal;font-size:12px;color:var(--mut)}",
      ".fo-pm-h2hs{display:flex;flex-direction:column;gap:6px}",
      "#page a.fo-pm-h2h{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:2px 10px;align-items:center;padding:9px 12px;border-radius:10px;background:#FFFEFC;border:1px solid var(--edge);text-decoration:none;color:var(--ink)}",
      "#page a.fo-pm-h2h:hover{border-color:rgba(201,87,31,.5)}",
      "#page a.fo-pm-h2h i{grid-row:span 2;font:700 11px/1 Inter,sans-serif;font-style:normal;color:#9FB0C6}",
      "#page a.fo-pm-h2h b{font:600 12.5px/1.3 Inter,sans-serif;color:var(--navy)}",
      "#page a.fo-pm-h2h span{grid-column:2;font:400 13px/1.4 Fraunces,Georgia,serif;color:var(--mut)}",
      "#page a.fo-pm-h2h s{grid-column:3;grid-row:span 2;text-decoration:none;font:400 18px/1 Fraunces,Georgia,serif;color:rgba(27,36,50,.4)}",
      ".fo-pm-duo{display:grid;grid-template-columns:1fr;gap:9px}",
      "@media(min-width:560px){.fo-pm-duo{grid-template-columns:1fr 1.2fr}}",
      ".fo-pm-box{padding:12px 14px;border-radius:12px;background:linear-gradient(0deg,#FBF6EA,#FDFAF2);border:1px solid var(--edge);display:flex;flex-direction:column;gap:9px}",
      ".fo-pm-big{font:700 24px/1.05 Inter,sans-serif;color:var(--navy);letter-spacing:-.3px}",
      ".fo-pm-prn{margin:0;font:400 13px/1.55 Inter,sans-serif;color:#3c4757}",
      ".fo-pm-dim{margin:0;font-family:Fraunces,Georgia,'Times New Roman',serif;font-style:normal;font-size:13px;line-height:1.5;color:var(--mut)}",
      ".fo-pm-lost{font-family:Inter,sans-serif;font-weight:700;text-transform:uppercase;font-size:clamp(24px,3.4vw,40px);color:var(--navy);margin:14px 0 8px}",
      ".fo-pm-mast{font-family:Inter,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:10px;color:var(--acc)}",
      ".fo-pm-foot{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding-top:clamp(12px,2vw,16px);border-top:1px solid var(--edge)}",
      "#page .fo-pm-cta,#page .fo-pm-back{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:48px;padding:10px 14px;border-radius:12px;text-decoration:none;font-family:Inter,sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:10.5px;font-weight:600;text-align:center;transition:transform .16s ease,background .16s ease,border-color .16s ease}",
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
