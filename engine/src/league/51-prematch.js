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

      var beads = function (st) {
        if (!st.form.length) return "<span class='fo-pm-none'>no cricket yet</span>";
        return st.form.map(function (k) { return "<i class='" + k + "'>" + k.toUpperCase() + "</i>"; }).join("");
      };
      var posOrd = function (n) {
        if (!n) return "&mdash;";
        var s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th";
        return n + "<u>" + s + "</u>";
      };
      // A CLUB IN ONE LINE. This was a card apiece - four labelled numbers, a
      // manager's name, a form strip and a caption - and then a second pair of
      // cards naming four cricketers with their roles and their hands. Before
      // a ball has been bowled every one of those numbers is a nought, and a
      // page of noughts is a page of nothing. Where they stand, what they have
      // won, and how they are going: that is the whole of a preview.
      var sideLine = function (slot, nm, boss, st) {
        return "<a class='fo-pm-sl" + (slot === mySlot ? " mine" : "") +
          "' href='#/team?c=" + encodeURIComponent(natId) + "&s=" + slot + "'>" +
          foPmShield(nm, boss, natId) +
          "<b>" + foPmE(nm) + " <i>" + posOrd(st.pos) +
          (st.p ? " &middot; " + st.pts + " pts" : "") + "</i></b>" +
          "<span class='fo-pm-beads'>" + beads(st) + "</span>" +
          "<s class='fo-pm-chev'>&#8250;</s></a>";
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

      var ACT = {
        sheet: "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='9' cy='8' r='3'/><path d='M3 20a6 6 0 0 1 12 0'/><path d='M17 11h4M19 9v4'/></svg>",
        bars: "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M5 20V11M12 20V4M19 20v-6'/></svg>",
        cal: "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><rect x='3.5' y='5' width='17' height='16' rx='2.5'/><path d='M3.5 10h17M8 3v4M16 3v4'/></svg>",
        play: "<svg viewBox='0 0 24 24' width='16' height='16' fill='currentColor'><path d='M8 5v14l11-7z'/></svg>"
      };
      var actions = [];
      if (c0.k === "live") actions.push("<a class='fo-pm-cta live' href='#/watch?n=" + encodeURIComponent(natId) + "'>" + ACT.play + "Watch it live</a>");
      if (mine && c0.k === "soon") actions.push("<a class='fo-pm-cta' href='#/orders'>" + ACT.sheet + "Set your team sheet</a>");
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
        "<div><b>" + foPmHH(g.hour) + " UTC</b><i>First ball</i></div></div>" +
        "</div>" +

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
  // A CUP TIE IS A MATCH LIKE ANY OTHER and deserves the same room. It has no
  // league round, so it is addressed by its stage.
  window.foCupPreviewHref = function (natId, stage, hSlot, aSlot) {
    return "#/preview?n=" + encodeURIComponent(natId) + "&fa=" + encodeURIComponent(stage || "r16") +
      "&h=" + (hSlot | 0) + "&a=" + (aSlot | 0);
  };

  function foPmCss() {
    if (document.getElementById("fo-pm-css")) return;
    var css = [
      "#page .fo-pm{--gold:#E6B15E;--paper:#F4EFE4;--steel:#8ea3c4;--edge:rgba(150,180,225,.16);position:relative;min-height:100vh;background:#070c16;color:#e9eefa;overflow-x:clip;padding:clamp(10px,2vw,20px) 0 clamp(30px,5vw,56px)}",
      "#page .fo-pm *{box-sizing:border-box}",
      "body.fo-pm-on #page{padding:0;max-width:none}",
      // the page owns its night: no cream frame peeking around the card's
      // edges. The daylight skin asserts its cream with !important at
      // html body.ftpskin strength, so this must out-rank it, not just tie.
      "html body.ftpskin.fo-pm-on,html body.fo-pm-on{background:#070c16 !important}",
      "body.fo-pm-on #page{background:#070c16}",
      ".fo-pm-in{width:min(720px,100%);margin:0 auto;padding:0 clamp(10px,2.6vw,16px)}",
      // ONE CARD. This was a full-bleed plate with a body hanging off the
      // bottom of it, so nothing shared an edge with anything and the eye had
      // no column to run down. Everything sits on one rounded sheet now, at
      // one indent, with the sections spaced by a single gap.
      ".fo-pm-card{background:#0C1524;border:1px solid var(--edge);border-radius:18px;padding:clamp(12px,2.4vw,17px);display:flex;flex-direction:column;gap:clamp(11px,1.8vw,14px)}",
      // the folio: a chip with its flag, not small caps adrift on a rule
      ".fo-pm-folio{display:inline-flex;align-items:center;gap:9px;align-self:flex-start;background:rgba(150,180,225,.1);border:1px solid var(--edge);border-radius:999px;padding:6px 14px 6px 7px}",
      ".fo-pm-folio img{width:20px;height:14px;object-fit:cover;border-radius:3px;flex:0 0 auto}",
      ".fo-pm-folio span{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.18em;font-size:9.5px;color:#cddcf2}",
      ".fo-pm-bill{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:clamp(7px,2vw,14px)}",
      ".fo-pm-billside{display:flex;align-items:center;gap:10px;min-width:0}",
      ".fo-pm-billside.a{flex-direction:row-reverse;text-align:right}",
      ".fo-pm-billside>div{min-width:0}",
      ".fo-pm-billside b{display:block;font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;line-height:1.04;letter-spacing:.005em;font-size:clamp(14px,3.9vw,21px);color:var(--paper);overflow-wrap:anywhere}",
      ".fo-pm-billside i{display:block;margin-top:3px;font-family:Oswald,sans-serif;font-style:normal;text-transform:uppercase;letter-spacing:.22em;font-size:8px;color:var(--steel)}",
      ".fo-pm-v{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;border:1px solid rgba(230,177,94,.42);flex:0 0 auto}",
      ".fo-pm-v span{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);line-height:1}",
      ".fo-pm-sh{display:grid;place-items:center;width:29px;height:29px;border-radius:7px;background:var(--sc,#1D3F6E);color:#fff;font:700 11px/1 Oswald,sans-serif;letter-spacing:.04em;flex:0 0 auto}",
      ".fo-pm-sh.big{width:clamp(36px,9.5vw,44px);height:clamp(36px,9.5vw,44px);border-radius:9px;font-size:clamp(12px,3.2vw,15px)}",
      ".fo-pm-sh.crest{background:none;object-fit:contain}",
      // the ground, bounded and untouched, between the billing and the facts
      ".fo-pm-plate{margin:0;line-height:0;background:#0b1424;border-radius:12px;overflow:hidden}",
      ".fo-pm-plate img{display:block;width:100%;height:auto;aspect-ratio:32/11;object-fit:cover;object-position:center 45%}",
      "@media(max-width:760px){.fo-pm-plate img{aspect-ratio:16/7}}",
      ".fo-pm-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:rgba(150,180,225,.055);border:1px solid var(--edge);border-radius:12px}",
      ".fo-pm-fact{display:flex;align-items:center;gap:9px;padding:11px 11px;min-width:0;border-left:1px solid var(--edge)}",
      ".fo-pm-fact:first-child{border-left:0}",
      ".fo-pm-fact>div{min-width:0}",
      ".fo-pm-ic{flex:0 0 auto;color:var(--steel);opacity:.9}",
      ".fo-pm-fact b{display:block;font-family:Oswald,sans-serif;font-weight:600;font-size:clamp(11.5px,3vw,15px);line-height:1.2;color:var(--paper);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}",
      ".fo-pm-fact i{display:block;margin-top:3px;font-family:Oswald,sans-serif;font-style:normal;text-transform:uppercase;letter-spacing:.14em;font-size:7.5px;color:var(--steel);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#page .fo-pm-fact[data-k=live] b{color:#fff}",
      "#page .fo-pm-fact[data-k=live] .fo-pm-ic{color:#FF3355;opacity:1}",
      "@media(max-width:430px){.fo-pm-fact{flex-direction:column;align-items:flex-start;gap:6px;padding:10px 8px}}",
      // a section says what it is before it shows you anything
      ".fo-pm-cap{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:9px;color:var(--steel)}",
      ".fo-pm-wp{padding:13px 14px;border-radius:12px;background:rgba(150,180,225,.055);border:1px solid var(--edge);display:flex;flex-direction:column;gap:9px}",
      ".fo-pm-wptop{display:flex;align-items:center;justify-content:space-between;gap:10px}",
      ".fo-pm-wph,.fo-pm-wpa{display:flex;align-items:center;gap:8px;min-width:0}",
      ".fo-pm-wph u,.fo-pm-wpa u{text-decoration:none;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.08em;font-size:9.5px;color:var(--steel);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".fo-pm-wph b,.fo-pm-wpa b{font-family:Oswald,sans-serif;font-weight:700;font-size:clamp(19px,5vw,26px);line-height:1;font-variant-numeric:tabular-nums;color:var(--paper)}",
      ".fo-pm-wph b{color:var(--gold)}",
      ".fo-pm-wpa b{color:#9fc0ee}",
      ".fo-pm-wpbar{display:flex;height:10px;border-radius:999px;overflow:hidden;background:rgba(150,180,225,.12)}",
      ".fo-pm-wpbar span{display:block;height:100%;width:0;transition:width .5s cubic-bezier(.2,.7,.2,1)}",
      ".fo-pm-wpbar .h{background:linear-gradient(90deg,#C98A2A,var(--gold))}",
      ".fo-pm-wpbar .t{background:rgba(150,180,225,.4)}",
      ".fo-pm-wpbar .a{background:linear-gradient(90deg,#5C86C4,#9fc0ee)}",
      "@media(prefers-reduced-motion:reduce){.fo-pm-wpbar span{transition:none}}",
      // TEAM STATUS: two rows that look like rows you can open, because they
      // are. Crest, club and where it stands, how it is going underneath, and
      // the chevron that says there is a page behind this.
      ".fo-pm-two{display:flex;flex-direction:column;gap:7px}",
      "#page a.fo-pm-sl{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-rows:auto auto;column-gap:11px;row-gap:2px;align-items:center;padding:10px 12px;border-radius:11px;background:rgba(150,180,225,.055);border:1px solid var(--edge);text-decoration:none}",
      "#page a.fo-pm-sl:hover{border-color:rgba(230,177,94,.5)}",
      "#page a.fo-pm-sl.mine{border-color:rgba(230,177,94,.42);background:rgba(230,177,94,.07)}",
      "#page a.fo-pm-sl .fo-pm-sh{grid-row:span 2}",
      "#page a.fo-pm-sl b{font-family:Oswald,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.02em;font-size:14px;color:var(--paper);overflow-wrap:anywhere}",
      "#page a.fo-pm-sl b{grid-column:2;grid-row:1}",
      "#page a.fo-pm-sl b i{font-family:Oswald,sans-serif;font-style:normal;font-weight:400;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin-left:5px}",
      "#page a.fo-pm-sl b i u{text-decoration:none;font-size:8px}",
      "#page a.fo-pm-sl .fo-pm-beads{grid-column:2;grid-row:2}",
      "#page a.fo-pm-sl .fo-pm-chev{grid-column:3;grid-row:span 2;text-decoration:none;font:400 20px/1 Georgia,serif;color:rgba(150,180,225,.55)}",
      ".fo-pm-clubtop{display:flex;align-items:center;gap:11px;margin-bottom:13px}",
      ".fo-pm-clubtop>div{display:flex;flex-direction:column;gap:3px;min-width:0}",
      ".fo-pm-clubnm{font-family:Oswald,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.02em;font-size:16px;color:var(--paper);text-decoration:none}",
      ".fo-pm-clubnm:hover{color:var(--gold)}",
      ".fo-pm-clubsub{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:8.5px;color:var(--steel)}",
      ".fo-pm-form>span{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:8.5px;color:var(--steel)}",
      ".fo-pm-beads{display:flex;gap:4px}",
      ".fo-pm-beads i{display:grid;place-items:center;width:19px;height:19px;border-radius:4px;font:700 9.5px/1 Oswald,sans-serif;font-style:normal;color:#08101f}",
      ".fo-pm-beads i.w{background:#5FBF7E}.fo-pm-beads i.l{background:#C2566A}.fo-pm-beads i.t{background:#8ea3c4}",
      ".fo-pm-none{font-family:Georgia,serif;font-style:italic;font-size:12px;color:var(--steel)}",
      ".fo-pm-manrole svg{width:15px;height:15px;display:block}",
      ".fo-pm-mannm{display:flex;flex-direction:column;gap:2px;min-width:0}",
      ".fo-pm-mannm b{font-family:Georgia,'Times New Roman',serif;font-size:14px;color:var(--paper);overflow-wrap:anywhere}",
      ".fo-pm-mannm i{font-family:Oswald,sans-serif;font-style:normal;text-transform:uppercase;letter-spacing:.14em;font-size:8px;color:var(--steel)}",
      ".fo-pm-dim{margin:0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:13.5px;line-height:1.5;color:#c3d0e6}",
      ".fo-pm-lost{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;font-size:clamp(24px,3.4vw,40px);color:var(--paper);margin:14px 0 8px}",
      // THE ACTIONS. Pills of whatever width their words happened to need, in
      // a ragged row. They are a grid now: two to a line, the one that matters
      // filled, each carrying the glyph of what it opens.
      ".fo-pm-foot{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding-top:clamp(12px,2vw,16px);border-top:1px solid var(--edge)}",
      "#page .fo-pm-cta,#page .fo-pm-back{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:48px;padding:10px 14px;border-radius:12px;text-decoration:none;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:10.5px;font-weight:600;text-align:center;transition:transform .16s ease,background .16s ease,border-color .16s ease}",
      "#page .fo-pm-cta svg,#page .fo-pm-back svg{flex:0 0 auto}",
      "@media(max-width:430px){.fo-pm-foot{grid-template-columns:1fr}}",
      "#page .fo-pm-cta{background:var(--gold);color:#08101f}",
      ".fo-pm-cta:hover{transform:translateY(-1px);background:#F0C075}",
      // live wears the page's own gold, not a siren: the pulsing red dot
      // carries the LIVE signal while the button stays in the family
      "#page .fo-pm-cta.live{background:var(--gold);color:#08101f}",
      ".fo-pm-cta.live:hover{background:#F0C075}",
      ".fo-pm-cta.live:before{content:'';width:8px;height:8px;border-radius:50%;background:#D8342B;flex:0 0 auto;animation:foPmLiveDot 1.2s ease-in-out infinite}",
      "@keyframes foPmLiveDot{0%,100%{opacity:1}50%{opacity:.3}}",
      "@media(prefers-reduced-motion:reduce){.fo-pm-cta.live:before{animation:none}}",
      "#page .fo-pm-back{border:1px solid rgba(150,180,225,.28);color:#cddaf0}",
      ".fo-pm-back:hover{border-color:var(--gold);color:var(--gold)}",
      "@media(max-width:700px){.fo-pm-when{grid-template-columns:1fr}.fo-pm-where{grid-template-columns:repeat(3,minmax(0,1fr))}}",
      // A POSTER STACKS ON A PHONE. Side by side, a long club name had a
      // column barely wider than itself and broke in half - WARWICKSHI/RE.
      // Given the whole width one at a time, every name in the world fits.
      "@media(max-width:560px){.fo-pm-bill{grid-template-columns:1fr;justify-items:center;gap:8px;text-align:center}",
      ".fo-pm-billside,.fo-pm-billside.a{align-items:center;text-align:center}",
      ".fo-pm-billside b{font-size:clamp(24px,7.4vw,36px);word-break:normal;overflow-wrap:anywhere}",
      ".fo-pm-v{width:38px;height:38px}.fo-pm-v span{font-size:17px}}",
      "@media(prefers-reduced-motion:reduce){.fo-pm-h2h,.fo-pm-cta,.fo-pm-back{transition:none}}",

      // ---- THE PHONE ---------------------------------------------------------
      // This card used to be squeezed until the whole preview fitted one
      // screen without scrolling, and the ground photograph was the thing cut
      // to buy the room. That was the right answer to a page carrying four
      // panels of noughts; it is the wrong answer to this one. The card is
      // short enough now to be read in a single flick, and the photograph is
      // the reason a fixture feels like a place - so it stays, and the sizes
      // come down instead.
      "@media(max-width:760px){",
      "#page .fo-pm{min-height:0}",
      ".fo-pm-card{padding:11px;gap:10px;border-radius:15px}",
      ".fo-pm-folio{padding:5px 12px 5px 6px}",
      ".fo-pm-folio span{font-size:9px;letter-spacing:.15em}",
      ".fo-pm-bill{gap:6px}",
      ".fo-pm-billside{gap:8px}",
      ".fo-pm-billside b{font-size:clamp(13px,4.2vw,18px)}",
      ".fo-pm-billside i{font-size:7.5px;letter-spacing:.18em}",
      ".fo-pm-sh.big{width:34px;height:34px;border-radius:8px;font-size:12px}",
      ".fo-pm-v{width:34px;height:34px}.fo-pm-v span{font-size:9.5px}",
      ".fo-pm-wp{padding:11px 11px;gap:8px}",
      ".fo-pm-wph b,.fo-pm-wpa b{font-size:20px}",
      ".fo-pm-wph u,.fo-pm-wpa u{font-size:8.5px}",
      ".fo-pm-sh{width:24px;height:24px;border-radius:6px;font-size:9.5px}",
      "#page a.fo-pm-sl{padding:9px 10px;column-gap:9px}",
      "#page a.fo-pm-sl b{font-size:12.5px}",
      ".fo-pm-beads i{width:16px;height:16px;border-radius:3px;font-size:8px}",
      "#page .fo-pm-cta,#page .fo-pm-back{min-height:44px;font-size:9.5px;letter-spacing:.1em;gap:7px}",
      "}"
    ].join("\n");
    var st = document.createElement("style");
    st.id = "fo-pm-css"; st.textContent = css;
    document.head.appendChild(st);
  }
})();
