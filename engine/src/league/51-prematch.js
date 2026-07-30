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
  function foPmBatLine(p) {
    var hand = (p.hand === "L" ? "left" : "right") + "-hand";
    var r = foPmWords(p.role || "batter");
    return (p.keeper ? "Wicket-keeper" : r) + " \u00b7 " + hand;
  }
  function foPmBowlLine(p) {
    var b = String(p.btLabel || "");
    if (b && !/does not bowl/i.test(b)) return b;
    return foPmWords(p.bowlTypeFull || p.bowlType || "bowler");
  }

  // EVERY CLUB WEARS A SHIELD - the flagship its painted crest, the rest a
  // monogram in the colours their own name draws. Same rule as the table, so a
  // club is recognisable in whichever room you meet it.
  var FO_PM_SH = ["#8C2B2B", "#1D3F6E", "#1F6F4A", "#6B3E8F", "#A8571C", "#2B6E7A", "#7A2E52", "#3E5C1E", "#3D3A6B", "#8A6A1F"];
  function foPmShield(name, isBoss, natId, big) {
    var cls = "fo-pm-sh" + (big ? " big" : "");
    if (isBoss) {
      var c = ""; try { c = window.__foCxAPI.crest(natId) || ""; } catch (e) {}
      if (c) return "<img class='" + cls + " crest' src='" + c + "' alt='' onerror=\"this.style.display='none'\">";
    }
    var ini = String(name || "?").replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean)
      .map(function (w) { return w.charAt(0).toUpperCase(); }).slice(0, 2).join("");
    var col = FO_PM_SH[foPmH32(name || "") % FO_PM_SH.length];
    return "<span class='" + cls + "' style='--sc:" + col + "'>" + foPmE(ini || "?") + "</span>";
  }

  // ---- what the world knows about this fixture ------------------------------
  function foPmGather(natId, round) {
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
    var day = PL.dayOfSeasonRound ? PL.dayOfSeasonRound(seasonNo, round)
           : ((PL.WORLD_START | 0) + (seasonNo - 1) * (PL.CYCLE | 0) + (round - 1));
    var start = PL.EPOCH + day * PL.DAY + hour * 3600000;
    var stop = start + (PL.LIVE_LEN || 3) * 3600000;
    return { snap: snap, names: names, mgrs: mgrs, sides: sides, bySlot: bySlot,
      seasonNo: seasonNo, hour: hour, start: start, stop: stop, natId: natId, round: round };
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
  // to the room every side waits in before it walks out - once, and then gives
  // up rather than looping.
  function foPmGroundArt(g, slot) {
    var s = g.bySlot[slot], base = foPmArt();
    var city = (s && s.city) || "";
    var alt = base + "home/hgm-dressing-room.webp";
    return { src: city ? base + "cities/" + foPmSlug(city) + "-ground.webp" : alt, alt: alt };
  }
  // where a club stands, and the last five it has played
  function foPmStanding(g, slot) {
    var out = { pos: 0, p: 0, w: 0, l: 0, t: 0, pts: 0, nrr: 0, form: [] };
    try {
      var tbl = (g.snap && g.snap.table) || [];
      for (var i = 0; i < tbl.length; i++) {
        if (tbl[i].slot !== slot) continue;
        out.pos = i + 1; out.p = tbl[i].p | 0; out.w = tbl[i].w | 0; out.l = tbl[i].l | 0;
        out.t = tbl[i].t | 0; out.pts = tbl[i].pts | 0; out.nrr = +tbl[i].nrr || 0;
        break;
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
  // THE MEN MOST LIKELY TO DECIDE IT. The squads are generated from the world
  // seed, so a preview can name them without asking the server a thing; the
  // stars are the same ladder the team sheet rates everyone on.
  function foPmKeyMen(natId, slot) {
    var out = { bat: [], bowl: [] };
    try {
      var S = window.__foStarLadder; if (!S) return out;
      var sq = window.__foWT && window.__foWT.serverSquad ? window.__foWT.serverSquad(natId, slot) : null;
      if (!sq || !sq.length) return out;
      var bat = sq.slice().sort(function (a, b) { return S.bat(b) - S.bat(a); });
      var bwl = sq.filter(function (p) { return p.bowlType && p.bowlType !== "none"; })
        .sort(function (a, b) { return S.bowl(b) - S.bowl(a); });
      out.bat = bat.slice(0, 2).map(function (p) { return { p: p, st: S.stars(S.bat(p)) }; });
      out.bowl = bwl.slice(0, 2).map(function (p) { return { p: p, st: S.stars(S.bowl(p)) }; });
    } catch (e) {}
    return out;
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
    var note = host.querySelector(".fo-pm-wpnote");
    if (note) {
      note.textContent = done
        ? ("A rough guide, not a forecast: " + n + " runs of this fixture on the match engine, " +
           "both sides picked the way the engine picks them. Team sheets are not in it, so the " +
           "number never moves - it is the same " + n + " matches on every device, from the day the " +
           "fixture is drawn." + (v.t ? " " + v.t + " ended level." : ""))
        : ("Playing it out\u2026 " + n + " of " + FO_PM_WP_N + " done.");
    }
    host.classList.toggle("settled", !!done);
  }
  function foPmWpRun(host, sig, key, natId, hSlot, aSlot, hN, aN, ground) {
    var G = window.__foGame, WT = window.__foWT;
    if (!G || !G.simWorld || !G.hash || !WT || !WT.serverSquad) { host.style.display = "none"; return; }
    var sqH = WT.serverSquad(natId, hSlot), sqA = WT.serverSquad(natId, aSlot);
    if (!sqH || !sqA) { host.style.display = "none"; return; }
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
      if ((location.hash || "").split("?")[0] !== "#/preview") return;
      var host = document.getElementById("fo-pm-count"); if (!host) return;
      var g = host.__g; if (!g) return;
      var c = foPmCountText(g, Date.now());
      var b = host.querySelector(".big"), s = host.querySelector(".sub");
      if (b && b.textContent !== c.big) b.textContent = c.big;
      if (s && s.textContent !== c.sub) s.textContent = c.sub;
      host.className = "fo-pm-count " + c.k;
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
      var hSlot = parseInt(foPmQ("h") || "-1", 10);
      var aSlot = parseInt(foPmQ("a") || "-1", 10);
      var sig = "pm|" + natId + "|" + round + "|" + hSlot + "|" + aSlot;
      if (page.__foPmSig === sig && page.querySelector(".fo-pm")) return;

      if (!round || hSlot < 0 || aSlot < 0) { foPmLost(page, "That fixture is not on the card."); return; }

      var g = foPmGather(natId, round);
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

      var beads = function (st) {
        if (!st.form.length) return "<span class='fo-pm-none'>no cricket yet</span>";
        return st.form.map(function (k) { return "<i class='" + k + "'>" + k.toUpperCase() + "</i>"; }).join("");
      };
      var posOrd = function (n) {
        if (!n) return "&mdash;";
        var s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th";
        return n + "<u>" + s + "</u>";
      };
      var sideCard = function (slot, nm, boss, st, homeSide) {
        var mg = foPmMgr(g, slot);
        return "<div class='fo-pm-club" + (slot === mySlot ? " mine" : "") + "'>" +
          "<div class='fo-pm-clubtop'>" + foPmShield(nm, boss, natId, true) +
          "<div><a class='fo-pm-clubnm' href='#/team?c=" + encodeURIComponent(natId) + "&s=" + slot + "'>" + foPmE(nm) + "</a>" +
          "<span class='fo-pm-clubsub'>" + (homeSide ? "Home" : "Away") +
          (mg ? " &middot; " + foPmE(mg) : boss ? " &middot; the flagship" : " &middot; the umpire picks") + "</span></div></div>" +
          "<div class='fo-pm-stats'>" +
          "<div><b>" + posOrd(st.pos) + "</b><i>Table</i></div>" +
          "<div><b>" + st.pts + "</b><i>Points</i></div>" +
          "<div><b>" + st.w + "&ndash;" + st.l + (st.t ? "&ndash;" + st.t : "") + "</b><i>W&ndash;L</i></div>" +
          "<div><b>" + (st.nrr >= 0 ? "+" : "") + st.nrr.toFixed(2) + "</b><i>NRR</i></div>" +
          "</div>" +
          "<div class='fo-pm-form'><span>Form</span><div class='fo-pm-beads'>" + beads(st) + "</div></div>" +
          "</div>";
      };

      var manRow = function (m, bowl) {
        var p = m.p;
        return "<div class='fo-pm-man'>" +
          "<span class='fo-pm-manrole'>" + ((window.__foStarLadder && window.__foStarLadder.roleIcon(p)) || "") + "</span>" +
          "<span class='fo-pm-mannm'><b>" + foPmE(p.name) + "</b><i>" +
          foPmE(bowl ? foPmBowlLine(p) : foPmBatLine(p)) + "</i></span>" +
          "<span class='fo-pm-star" + (bowl ? " w" : "") + "'>&#9733; " + m.st + "</span>" +
          "</div>";
      };
      var menCard = function (slot, nm) {
        var k = foPmKeyMen(natId, slot);
        if (!k.bat.length && !k.bowl.length) return "";
        return "<div class='fo-pm-men'><h4>" + foPmE(nm) + "</h4>" +
          k.bat.map(function (m) { return manRow(m, false); }).join("") +
          k.bowl.map(function (m) { return manRow(m, true); }).join("") +
          "</div>";
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

      var actions = [];
      if (c0.k === "live") actions.push("<a class='fo-pm-cta live' href='#/watch?n=" + encodeURIComponent(natId) + "'>Watch it live</a>");
      if (mine && c0.k === "soon") actions.push("<a class='fo-pm-cta' href='#/orders'>Set your team sheet</a>");
      if (c0.k === "done") actions.push("<a class='fo-pm-cta' href='#/league?t=results'>Read the report</a>");
      actions.push("<a class='fo-pm-back' href='" + (natId === myNat ? "#/league?t=fixtures&r=" + round
        : "#/nation?n=" + encodeURIComponent(natId) + "&t=fixtures&r=" + round) + "'>All of round " + round + "</a>");
      actions.push("<a class='fo-pm-back' href='#/fixtures'>The fixture list</a>");

      page.innerHTML =
        "<div class='fo-pm'>" +
        "<header class='fo-pm-hero'>" +
        "<figure class='fo-pm-plate'><img src='" + art.src + "' alt='' data-alt='" + art.alt + "' " +
        "onerror=\"if(this.src.indexOf(this.dataset.alt)<0){this.src=this.dataset.alt}else{this.parentNode.style.display='none'}\"></figure>" +
        "<div class='fo-pm-in'>" +
        "<div class='fo-pm-mast'>The Fifty Overs Journal <em>&middot; Match Preview</em></div>" +
        "<div class='fo-pm-folio'>Round " + round + " &middot; Season " + g.seasonNo +
        (natNm ? " &middot; " + foPmE(natNm) : "") + "</div>" +

        // THE BILLING. Two clubs facing each other across a gold V - the way a
        // fixture is written on a poster outside a ground, not a table row.
        "<div class='fo-pm-bill'>" +
        "<div class='fo-pm-billside'>" + foPmShield(hN, hBoss, natId, true) +
        "<b>" + foPmE(hN) + "</b><i>Home</i></div>" +
        "<div class='fo-pm-v'><span>v</span></div>" +
        "<div class='fo-pm-billside a'>" + foPmShield(aN, aBoss, natId, true) +
        "<b>" + foPmE(aN) + "</b><i>Away</i></div>" +
        "</div>" +

        "<div class='fo-pm-when'>" +
        "<div id='fo-pm-count' class='fo-pm-count " + c0.k + "'>" +
        "<b class='big'>" + foPmE(c0.big) + "</b><span class='sub'>" + foPmE(c0.sub) + "</span></div>" +
        "<div class='fo-pm-where'>" +
        "<div><i>Ground</i><b>" + foPmE(ground) + "</b></div>" +
        "<div><i>First ball</i><b>" + foPmHH(g.hour) + " UTC</b></div>" +
        "<div><i>Overs</i><b>50 a side</b></div>" +
        "</div></div>" +
        "</div></header>" +

        "<div class='fo-pm-in fo-pm-body'>" +
        "<section class='fo-pm-sec'><div class='fo-pm-rule'><span>" +
        (c0.k === "soon" ? "How it should go" : "Before a ball was bowled") + "</span></div>" +
        "<div id='fo-pm-wp' class='fo-pm-wp'>" +
        "<div class='fo-pm-wptop'>" +
        "<span class='fo-pm-wph'>" + foPmShield(hN, hBoss, natId) + "<u>" + foPmE(hN) + "</u><b>&mdash;</b></span>" +
        "<span class='fo-pm-wpa'><b>&mdash;</b><u>" + foPmE(aN) + "</u>" + foPmShield(aN, aBoss, natId) + "</span>" +
        "</div>" +
        "<div class='fo-pm-wpbar'><span class='h'></span><span class='t'></span><span class='a'></span></div>" +
        "<p class='fo-pm-wpnote'>Playing it out&hellip;</p>" +
        "</div></section>" +

        "<section class='fo-pm-sec'><div class='fo-pm-rule'><span>The two sides</span></div>" +
        "<div class='fo-pm-clubs'>" + sideCard(hSlot, hN, hBoss, hSt, true) + sideCard(aSlot, aN, aBoss, aSt, false) + "</div>" +
        "</section>" +

        "<section class='fo-pm-sec'><div class='fo-pm-rule'><span>Men to watch</span></div>" +
        "<div class='fo-pm-mengrid'>" + menCard(hSlot, hN) + menCard(aSlot, aN) + "</div>" +
        "</section>" +

        "<section class='fo-pm-sec'><div class='fo-pm-rule'><span>When they last met</span></div>" +
        h2hHTML + "</section>" +

        "<div class='fo-pm-foot'>" + actions.join("") + "</div>" +
        "</div></div>";

      var host = document.getElementById("fo-pm-count");
      if (host) host.__g = g;

      // the bar: served from the cache when this fixture has been played out
      // before, otherwise played out now, a few matches at a time
      try {
        var wpHost = document.getElementById("fo-pm-wp");
        if (wpHost) {
          // the key is the fixture and nothing else: what was known can no
          // longer change what the bar says, so a cached number is never stale
          var wpKey = natId + ":s" + g.seasonNo + ":r" + round + ":h" + hSlot + "a" + aSlot;
          var cached = foPmWpLoad(wpKey);
          if (cached) foPmWpPaint(wpHost, cached, true);
          else foPmWpRun(wpHost, location.hash, wpKey, natId, hSlot, aSlot, hN, aN, ground);
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

  function foPmCss() {
    if (document.getElementById("fo-pm-css")) return;
    var css = [
      "#page .fo-pm{--gold:#E6B15E;--paper:#F4EFE4;--steel:#8ea3c4;position:relative;min-height:100vh;background:#070c16;color:#e9eefa;overflow-x:clip}",
      "#page .fo-pm *{box-sizing:border-box}",
      "body.fo-pm-on #page{padding:0;max-width:none}",
      ".fo-pm-in{width:min(1120px,100%);margin:0 auto;padding:0 clamp(16px,4vw,40px)}",
      // the ground, bounded and untouched
      ".fo-pm-hero{position:relative;background:#070c16;padding-bottom:clamp(20px,3vw,34px)}",
      ".fo-pm-plate{margin:0 0 clamp(18px,2.6vw,30px);line-height:0;background:#0b1424}",
      ".fo-pm-plate img{display:block;width:100%;height:auto;aspect-ratio:32/9;max-height:340px;object-fit:cover;object-position:center 45%}",
      "@media(max-width:760px){.fo-pm-plate img{aspect-ratio:2/1;max-height:230px}}",
      ".fo-pm-mast{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.4em;font-size:clamp(9px,1vw,11.5px);font-weight:600;color:var(--gold)}",
      ".fo-pm-mast em{font-style:normal;color:var(--steel);letter-spacing:.28em}",
      ".fo-pm-folio{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.22em;font-size:10.5px;color:var(--steel);margin-top:7px;padding-bottom:13px;border-bottom:1px solid rgba(150,180,225,.16)}",
      // the billing
      ".fo-pm-bill{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:clamp(10px,2.4vw,26px);margin:clamp(18px,2.6vw,30px) 0 0}",
      ".fo-pm-billside{display:flex;flex-direction:column;align-items:flex-end;text-align:right;gap:9px;min-width:0}",
      ".fo-pm-billside.a{align-items:flex-start;text-align:left}",
      ".fo-pm-billside b{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;line-height:.9;letter-spacing:-.004em;font-size:clamp(22px,3.9vw,52px);color:var(--paper);word-break:break-word}",
      ".fo-pm-billside i{font-family:Oswald,sans-serif;font-style:normal;text-transform:uppercase;letter-spacing:.28em;font-size:9px;color:var(--steel)}",
      ".fo-pm-v{display:grid;place-items:center;width:clamp(44px,6vw,74px);height:clamp(44px,6vw,74px);border-radius:50%;border:1px solid rgba(230,177,94,.42);flex:0 0 auto}",
      ".fo-pm-v span{font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:clamp(18px,2.4vw,30px);color:var(--gold);line-height:1}",
      ".fo-pm-sh{display:grid;place-items:center;width:34px;height:34px;border-radius:7px;background:var(--sc,#1D3F6E);color:#fff;font:700 12px/1 Oswald,sans-serif;letter-spacing:.04em;flex:0 0 auto}",
      ".fo-pm-sh.big{width:clamp(40px,4.6vw,60px);height:clamp(40px,4.6vw,60px);border-radius:10px;font-size:clamp(14px,1.6vw,19px)}",
      ".fo-pm-sh.crest{background:none;object-fit:contain}",
      // the clock
      ".fo-pm-when{display:grid;grid-template-columns:auto 1fr;gap:clamp(14px,2.4vw,28px);align-items:center;margin-top:clamp(18px,2.6vw,28px);padding-top:clamp(16px,2.2vw,22px);border-top:1px solid rgba(150,180,225,.16)}",
      ".fo-pm-count{display:flex;flex-direction:column;gap:4px;padding:12px 18px;border-radius:12px;border:1px solid rgba(230,177,94,.3);background:linear-gradient(180deg,rgba(16,27,50,.85),rgba(8,14,26,.85));min-width:min(240px,44vw)}",
      ".fo-pm-count .big{font-family:Oswald,sans-serif;font-weight:700;font-size:clamp(20px,2.6vw,32px);color:var(--paper);font-variant-numeric:tabular-nums;letter-spacing:.01em;line-height:1}",
      ".fo-pm-count .sub{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.24em;font-size:9px;color:var(--steel)}",
      ".fo-pm-count.live{border-color:#FF0033;background:linear-gradient(180deg,rgba(70,10,22,.9),rgba(30,6,12,.9))}",
      ".fo-pm-count.live .big{color:#fff}",
      ".fo-pm-count.done{border-color:rgba(150,180,225,.2)}",
      ".fo-pm-where{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}",
      ".fo-pm-where div{display:flex;flex-direction:column;gap:4px;min-width:0}",
      ".fo-pm-where i{font-family:Oswald,sans-serif;font-style:normal;text-transform:uppercase;letter-spacing:.22em;font-size:8.5px;color:var(--steel)}",
      ".fo-pm-where b{font-family:Georgia,'Times New Roman',serif;font-size:14px;color:var(--paper);overflow-wrap:anywhere}",
      // body
      ".fo-pm-body{padding-top:clamp(18px,2.6vw,30px);padding-bottom:clamp(34px,5vw,64px)}",
      ".fo-pm-sec{margin-bottom:clamp(22px,3vw,36px)}",
      ".fo-pm-rule{display:flex;align-items:center;gap:12px;margin-bottom:14px}",
      ".fo-pm-rule:after{content:'';flex:1;height:1px;background:rgba(150,180,225,.16)}",
      ".fo-pm-rule span{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.26em;font-size:9.5px;font-weight:600;color:var(--gold)}",
      // the probability bar
      ".fo-pm-wp{padding:16px 17px;border-radius:13px;background:linear-gradient(180deg,rgba(16,27,50,.82),rgba(8,14,26,.82));border:1px solid rgba(150,180,225,.16)}",
      ".fo-pm-wptop{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:11px}",
      ".fo-pm-wph,.fo-pm-wpa{display:flex;align-items:center;gap:9px;min-width:0}",
      ".fo-pm-wph u,.fo-pm-wpa u{text-decoration:none;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.1em;font-size:10px;color:var(--steel);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".fo-pm-wph b,.fo-pm-wpa b{font-family:Oswald,sans-serif;font-weight:700;font-size:clamp(20px,2.4vw,28px);line-height:1;font-variant-numeric:tabular-nums;color:var(--paper)}",
      ".fo-pm-wph b{color:var(--gold)}",
      ".fo-pm-wpa b{color:#9fc0ee}",
      ".fo-pm-wpbar{display:flex;height:12px;border-radius:999px;overflow:hidden;background:rgba(150,180,225,.12)}",
      ".fo-pm-wpbar span{display:block;height:100%;width:0;transition:width .5s cubic-bezier(.2,.7,.2,1)}",
      ".fo-pm-wpbar .h{background:linear-gradient(90deg,#C98A2A,var(--gold))}",
      ".fo-pm-wpbar .t{background:rgba(150,180,225,.4)}",
      ".fo-pm-wpbar .a{background:linear-gradient(90deg,#5C86C4,#9fc0ee)}",
      ".fo-pm-wpnote{margin:10px 0 0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:12px;line-height:1.5;color:var(--steel)}",
      ".fo-pm-wp.settled .fo-pm-wpnote{color:#c3d0e6}",
      "@media(prefers-reduced-motion:reduce){.fo-pm-wpbar span{transition:none}}",
      ".fo-pm-clubs,.fo-pm-mengrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(10px,1.6vw,18px)}",
      "@media(max-width:700px){.fo-pm-clubs,.fo-pm-mengrid{grid-template-columns:1fr}}",
      ".fo-pm-club,.fo-pm-men{padding:16px 17px;border-radius:13px;background:linear-gradient(180deg,rgba(16,27,50,.82),rgba(8,14,26,.82));border:1px solid rgba(150,180,225,.16)}",
      ".fo-pm-club.mine{border-color:rgba(230,177,94,.42)}",
      ".fo-pm-clubtop{display:flex;align-items:center;gap:11px;margin-bottom:13px}",
      ".fo-pm-clubtop>div{display:flex;flex-direction:column;gap:3px;min-width:0}",
      ".fo-pm-clubnm{font-family:Oswald,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.02em;font-size:16px;color:var(--paper);text-decoration:none}",
      ".fo-pm-clubnm:hover{color:var(--gold)}",
      ".fo-pm-clubsub{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:8.5px;color:var(--steel)}",
      ".fo-pm-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:11px 0;border-top:1px solid rgba(150,180,225,.12);border-bottom:1px solid rgba(150,180,225,.12)}",
      ".fo-pm-stats div{display:flex;flex-direction:column;gap:3px;min-width:0}",
      ".fo-pm-stats b{font-family:Oswald,sans-serif;font-weight:700;font-size:17px;color:var(--paper);font-variant-numeric:tabular-nums;line-height:1}",
      ".fo-pm-stats b u{text-decoration:none;font-size:10px;color:var(--steel)}",
      ".fo-pm-stats i{font-family:Oswald,sans-serif;font-style:normal;text-transform:uppercase;letter-spacing:.18em;font-size:8px;color:var(--steel)}",
      ".fo-pm-form{display:flex;align-items:center;gap:10px;margin-top:11px}",
      ".fo-pm-form>span{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:8.5px;color:var(--steel)}",
      ".fo-pm-beads{display:flex;gap:4px}",
      ".fo-pm-beads i{display:grid;place-items:center;width:19px;height:19px;border-radius:4px;font:700 9.5px/1 Oswald,sans-serif;font-style:normal;color:#08101f}",
      ".fo-pm-beads i.w{background:#5FBF7E}.fo-pm-beads i.l{background:#C2566A}.fo-pm-beads i.t{background:#8ea3c4}",
      ".fo-pm-none{font-family:Georgia,serif;font-style:italic;font-size:12px;color:var(--steel)}",
      ".fo-pm-men h4{margin:0 0 10px;font-family:Oswald,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.16em;font-size:11px;color:var(--gold)}",
      ".fo-pm-man{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:8px 0;border-top:1px solid rgba(150,180,225,.1)}",
      ".fo-pm-man:first-of-type{border-top:0}",
      ".fo-pm-manrole svg{width:15px;height:15px;display:block}",
      ".fo-pm-mannm{display:flex;flex-direction:column;gap:2px;min-width:0}",
      ".fo-pm-mannm b{font-family:Georgia,'Times New Roman',serif;font-size:14px;color:var(--paper);overflow-wrap:anywhere}",
      ".fo-pm-mannm i{font-family:Oswald,sans-serif;font-style:normal;text-transform:uppercase;letter-spacing:.14em;font-size:8px;color:var(--steel)}",
      ".fo-pm-star{font-family:Oswald,sans-serif;font-weight:700;font-size:12.5px;color:var(--gold);font-variant-numeric:tabular-nums;white-space:nowrap}",
      ".fo-pm-star.w{color:#9fc0ee}",
      ".fo-pm-h2h{display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:12px;padding:12px 14px;margin-bottom:8px;border-radius:11px;text-decoration:none;background:rgba(16,27,50,.6);border:1px solid rgba(150,180,225,.14);transition:border-color .16s ease,transform .16s ease}",
      ".fo-pm-h2h:hover{border-color:rgba(230,177,94,.4);transform:translateY(-1px)}",
      ".fo-pm-h2h i{font-family:Oswald,sans-serif;font-style:normal;font-size:10px;letter-spacing:.14em;color:var(--steel)}",
      ".fo-pm-h2h b{font-family:Georgia,serif;font-size:14px;color:var(--paper);min-width:0;overflow-wrap:anywhere}",
      ".fo-pm-h2h span{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.12em;font-size:9.5px;color:var(--gold);text-align:right}",
      ".fo-pm-h2h s{text-decoration:none;color:var(--steel)}",
      ".fo-pm-dim{margin:0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:13.5px;line-height:1.5;color:#c3d0e6}",
      ".fo-pm-lost{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;font-size:clamp(24px,3.4vw,40px);color:var(--paper);margin:14px 0 8px}",
      ".fo-pm-foot{display:flex;flex-wrap:wrap;gap:10px;padding-top:clamp(16px,2.4vw,24px);border-top:1px solid rgba(150,180,225,.16)}",
      ".fo-pm-cta,.fo-pm-back{display:inline-flex;align-items:center;padding:10px 18px;border-radius:999px;text-decoration:none;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.16em;font-size:10px;font-weight:600;transition:transform .16s ease,background .16s ease,border-color .16s ease}",
      ".fo-pm-cta{background:var(--gold);color:#08101f}",
      ".fo-pm-cta:hover{transform:translateY(-1px);background:#F0C075}",
      ".fo-pm-cta.live{background:#FF0033;color:#fff}",
      ".fo-pm-cta.live:hover{background:#E4002B}",
      ".fo-pm-back{border:1px solid rgba(150,180,225,.28);color:#cddaf0}",
      ".fo-pm-back:hover{border-color:var(--gold);color:var(--gold)}",
      "@media(max-width:700px){.fo-pm-when{grid-template-columns:1fr}.fo-pm-where{grid-template-columns:repeat(3,minmax(0,1fr))}}",
      // A POSTER STACKS ON A PHONE. Side by side, a long club name had a
      // column barely wider than itself and broke in half - WARWICKSHI/RE.
      // Given the whole width one at a time, every name in the world fits.
      "@media(max-width:560px){.fo-pm-bill{grid-template-columns:1fr;justify-items:center;gap:8px;text-align:center}",
      ".fo-pm-billside,.fo-pm-billside.a{align-items:center;text-align:center}",
      ".fo-pm-billside b{font-size:clamp(24px,7.4vw,36px);word-break:normal;overflow-wrap:anywhere}",
      ".fo-pm-v{width:38px;height:38px}.fo-pm-v span{font-size:17px}}",
      "@media(prefers-reduced-motion:reduce){.fo-pm-h2h,.fo-pm-cta,.fo-pm-back{transition:none}}"
    ].join("\n");
    var st = document.createElement("style");
    st.id = "fo-pm-css"; st.textContent = css;
    document.head.appendChild(st);
  }
})();
