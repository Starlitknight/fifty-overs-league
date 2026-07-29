// ---- 25-league-table.js — The League, the real one ---------------------------
// One design for every league in the world. #/league is your nation's table and
// #/nation?n=<id> is anybody else's - the SAME page, the same four rooms, the
// same served data. There is no second-class league: the world runs nineteen of
// them under one set of rules, and they should read that way.
//
// The page is a club programme: a navy plate with the country painted behind
// it and the pennant on it, the round pips counting out the season, then four
// rooms - the pennant race, the fixtures, the results and the season's numbers
// - each with a rail of the things a manager checks on the way past.
(function () {
  "use strict";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function ready() { return typeof App !== "undefined" && App && typeof GD !== "undefined" && GD && GD.teams && typeof userTeam === "function"; }
  function hashPath() { return (location.hash || "").split("?")[0]; }
  function onPage() { var h = hashPath(); return h === "#/league" || h === "#/nation"; }
  function qparam(k) {
    var m = new RegExp("[?&]" + k + "=([^&]*)").exec(location.hash || "");
    return m ? decodeURIComponent(m[1]) : "";
  }
  function regions() { try { return (window.__foCxAPI.regions() || []).filter(function (r) { return !r.final; }); } catch (e) { return []; } }
  function regionOf(id) { return regions().filter(function (r) { return r.id === id; })[0] || null; }
  function natName(id) { var hit = regionOf(id); return (hit && hit.nm) || ""; }
  function ART() { return (typeof FO_ART !== "undefined") ? FO_ART : ((location.pathname.indexOf("/client/") !== -1) ? "art/" : "client/art/"); }
  function flagOf(id) { try { return ART() + "flags/" + window.__foCxAPI.flagFile(id) + ".svg"; } catch (e) { return ""; } }
  function hh(h) { return (h < 10 ? "0" : "") + h + ":00"; }
  function h32(s) { var h = 2166136261 >>> 0; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  var NAT_LINE = {
    eng: "The old game, played where it was written.", aus: "Hard light, hard cricket, no quarter given.",
    sub: "A billion eyes on every ball.", pak: "Raw pace and rawer nerve.",
    rsa: "The long summer and the southeaster.", win: "Calypso and thunder.",
    nzl: "Cricket under the long white cloud.", slk: "Spin, sorcery and sea air.",
    ned: "The low country, playing above itself.", ire: "Green, damp and defiant.",
    zim: "Flame lilies and hard yards.", afg: "Mountain fire, learned in exile.",
    bgd: "The tigers, and a country that roars with them.", nep: "Cricket on the roof of the world.",
    sco: "Highland steel, in a cold wind.", wal: "Dragons at the crease.",
    ken: "The rift valley game.", usa: "The new frontier of an old sport.",
    can: "True north, and a short summer to prove it."
  };
  // EVERY CLUB WEARS A SHIELD. The flagship has a painted crest; the rest get
  // a monogram in the colours their own name draws - stable, distinct, and
  // never a blank square where a badge should be.
  var SH_COL = ["#8C2B2B", "#1D3F6E", "#1F6F4A", "#6B3E8F", "#A8571C", "#2B6E7A", "#7A2E52", "#3E5C1E", "#3D3A6B", "#8A6A1F"];
  function shield(name, isBoss, cid) {
    if (isBoss) {
      var c = ""; try { c = window.__foCxAPI.crest(cid) || ""; } catch (e) {}
      if (c) return "<img class='fo-lgx-cr' src='" + c + "' alt='' onerror=\"this.style.display='none'\">";
    }
    var ini = String(name || "?").replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean)
      .map(function (w) { return w.charAt(0).toUpperCase(); }).slice(0, 2).join("");
    var col = SH_COL[h32(name || "") % SH_COL.length];
    return "<span class='fo-lgx-sh' style='--sc:" + col + "'>" + E(ini || "?") + "</span>";
  }

  // ---- the margins are the country (shared with the club dossier) ---------
  var ART_FOR = "", ART_KEY = "";
  function sideArt(natId) {
    try {
      try { document.body.classList.remove("fo-lgx-page"); } catch (eLg) {}
      var host = document.getElementById("fo-sideart");
      if (!host) {
        host = document.createElement("div");
        host.id = "fo-sideart";
        host.innerHTML =
          "<a class='fo-sa-map' href='#/atlas'><img alt='' loading='lazy' onerror=\"this.parentElement.style.display='none'\"><span></span></a>" +
          "<div class='fo-sa-fig'><img alt='' loading='lazy' onerror=\"this.parentElement.style.display='none'\"></div>";
        document.body.appendChild(host);
      }
      if (!natId) {
        host.classList.remove("on");
        try { document.body.classList.remove("fo-sa-on"); } catch (eB2) {}
        ART_FOR = ""; return;
      }
      if (natId !== ART_KEY) {
        ART_KEY = natId;
        var map = host.querySelector(".fo-sa-map"), fig = host.querySelector(".fo-sa-fig");
        var reg = regionOf(natId) || {};
        map.style.display = ""; fig.style.display = "";
        map.href = "#/atlas?n=" + encodeURIComponent(natId);
        map.querySelector("img").src = ART() + "circuit/" + (reg.bg || (natId + ".webp"));
        map.querySelector("span").textContent = (reg.nm || "") + " ›";
        fig.querySelector("img").src = ART() + "circuit/boss-" + natId + "-cutout.webp";
      }
      host.classList.add("on");
      try { document.body.classList.add("fo-sa-on"); } catch (eB3) {}
      ART_FOR = location.hash || "";
    } catch (e) {}
  }
  window.__foSideArt = sideArt;
  window.addEventListener("hashchange", function () {
    setTimeout(function () { if (ART_FOR !== (location.hash || "")) sideArt(null); }, 80);
  });

  var TABS = [["table", "Standings"], ["fixtures", "Fixtures"], ["results", "Results"], ["stats", "Stats"]];

  function foRenderLeagueTablePage() {
    try {
      if (!ready()) return;
      if (!onPage()) return;
      var page = document.getElementById("page"); if (!page) return;
      var me = null; try { me = userTeam(); } catch (e) {}
      if (!me) return;
      try { document.body.classList.remove("fo-scb-on", "fo-drs-on", "fo-boss-on", "fo-ov-on", "fo-lore-on"); } catch (eB) {}

      var myNat = "";
      try { myNat = (window.__foLgAPI && window.__foLgAPI.nation && window.__foLgAPI.nation()) || ""; } catch (eNid) {}
      var natId = qparam("n") || myNat;
      if (!natName(natId)) natId = myNat;
      var own = (natId === myNat), natNm = natName(natId) || "";
      var tab = qparam("t") || "table";
      var reg = regionOf(natId) || {};

      var claim = null;
      try { claim = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (eC) {}
      var mySlot = (claim && claim.country === natId) ? claim.slot : -1;

      // the naming authority, the managers and the grounds - one small request
      var nmBySlot = null, mgrBySlot = null;
      try {
        if (window.__foWorldNames) {
          nmBySlot = window.__foWorldNames.get(natId);
          if (window.__foWorldNames.mgr) mgrBySlot = window.__foWorldNames.mgr(natId);
          window.__foWorldNames.want(natId, function () { if (onPage()) foRenderLeagueTablePage(); });
        }
      } catch (eN0) {}
      var groundOf = function (s) { return (mgrBySlot && mgrBySlot["g" + s]) || ""; };
      var mgrOf = function (s) { return (mgrBySlot && mgrBySlot[s]) || ""; };

      var snap = null;
      try {
        if (window.__foWorldLg) {
          window.__foWorldLg.want(natId, function () { if (onPage()) foRenderLeagueTablePage(); });
          snap = window.__foWorldLg.get(natId);
        }
      } catch (eS) {}

      var rows = [];
      if (snap && snap.table && snap.table.length) {
        rows = snap.table.map(function (x) {
          return { nm: (nmBySlot && nmBySlot[x.slot]) || x.name, recNm: x.name, p: x.p, w: x.w, l: x.l, t: x.t,
            pts: x.pts, nrr: x.nrr, slot: x.slot, boss: !!x.boss, mine: x.slot === mySlot };
        });
      }
      var myClub = "";
      rows.forEach(function (r) { if (r.mine) myClub = r.nm; });
      if (!myClub && own) myClub = me.name;
      var liveOf = {};
      rows.forEach(function (r) { if (r.recNm && r.recNm !== r.nm) liveOf[r.recNm] = r.nm; });
      var say = function (n) { return liveOf[n] || n; };
      var sayRe = null;
      try {
        var keys = Object.keys(liveOf).sort(function (a, b) { return b.length - a.length; });
        if (keys.length) sayRe = new RegExp(keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|"), "g");
      } catch (eRe) {}
      var sayLine = function (t) {
        var o = String(t || "");
        return sayRe ? o.replace(sayRe, function (m) { return liveOf[m] || m; }) : o;
      };

      // form beads, newest last, off the served results
      var seq = {};
      (snap && snap.results || []).forEach(function (rr) {
        [rr.home, rr.away].forEach(function (nm) {
          if (!nm) return;
          (seq[nm] = seq[nm] || []).push(rr.winner === null ? "t" : rr.winner === nm ? "w" : "l");
        });
      });

      // the world clock: which round is in play, and at what hour
      var pl = null, wt = null, cal = null, fx = [], hour = 13, state = "none", preDays = 0, rounds = (snap && snap.rounds) || 18;
      try { pl = window.__foPlanet || null; wt = (window.__foWT && window.__foWT.serverFixtures) ? window.__foWT : null; } catch (eP) {}
      if (pl && wt) {
        try {
          var now = Date.now(), sv = wt.serverFixtures(natId, now);
          cal = sv.cal; fx = sv.fx || []; hour = pl.natHour(natId);
          var hNow = (now - (pl.EPOCH + pl.dayIx(now) * 86400000)) / 3600000;
          if (cal.seasonNo < 1 || cal.dayInSeason < 0) { state = "pre"; preDays = Math.max(1, -cal.dayInSeason); }
          else if (!fx.length) state = "none";
          else state = hNow < hour ? "up" : hNow < hour + (pl.LIVE_LEN || 3) ? "live" : "fin";
        } catch (eC2) { cal = null; }
      }
      var playedRounds = (snap && snap.roundsPlayed) || 0;
      var curRound = cal && cal.round >= 1 ? Math.min(cal.round, rounds) : Math.min(playedRounds + 1, rounds);

      // ---- THE STUMPS ARE DRAWN, THE BOOK IS NOT YET WRITTEN -----------------
      // The clock and the ledger are two different things. Stumps come at a
      // nation's own hour, and the whole game knows it at once - the live pill
      // goes out, the match is watchable, the post-match page is there. But the
      // TABLE is the umpire's book, and the umpire keeps his own hours: he
      // settles the round on the World Service some time after the close.
      //
      // Standings that quietly sit a round behind read as broken. Say it
      // instead: the cricket is over, the scorer is still writing it up.
      var awaiting = 0;
      try {
        if (pl && pl.roundsDone && cal && cal.seasonNo >= 1) {
          var doneByClock = Math.min(rounds, pl.roundsDone(Date.now(), cal.seasonNo, natId) | 0);
          awaiting = Math.max(0, doneByClock - playedRounds);
        }
      } catch (eAw) { awaiting = 0; }
      var scorerLine = awaiting
        ? "Round " + Math.min(rounds, playedRounds + awaiting) + " in " + E(natNm) + " finished at " +
          hh((hour + ((pl && pl.LIVE_LEN) || 3)) % 24) + " UTC. The umpire settles it on the World Service " +
          "within a couple of hours of the close &mdash; until then this page still reads " +
          (playedRounds ? "after round " + playedRounds : "the start of the season") + "."
        : "";

      // ---- the plate ------------------------------------------------------
      sideArt(natId);
      // the league reads two columns wide on a desk, so its margins are narrower
      try { document.body.classList.add("fo-lgx-page"); } catch (eLp) {}
      var pips = "";
      for (var i = 1; i <= rounds; i++) {
        var cls = i <= playedRounds ? "done" : (i === curRound ? "now" : "");
        pips += "<i class='" + cls + "'>" + (i <= playedRounds ? "&#10003;" : i) + "</i>";
      }
      var hop = regions().map(function (r) {
        return "<option value='" + E(r.id) + "'" + (r.id === natId ? " selected" : "") + ">" + E(r.nm) + "</option>";
      }).join("");

      var plate =
        "<div class='fo-lgx-plate'>" +
        "<span class='fo-lgx-glow'></span>" +
        "<img class='fo-lgx-cup' src='" + ART() + "circuit/trophy-" + E(natId) + ".webp' alt='' onerror=\"this.style.display='none'\">" +
        "<div class='fo-lgx-plin'>" +
        "<div class='fo-lgx-mark'>" +
        "<span class='fo-lgx-pennant'><img src='" + flagOf(natId) + "' alt='' onerror=\"this.style.display='none'\"></span>" +
        "<div class='fo-lgx-titles'>" +
        "<div class='fo-lgx-k'>" + E(natNm) + " &middot; Season " + ((snap && snap.seasonNo) || (cal && cal.seasonNo > 0 ? cal.seasonNo : 1)) + "</div>" +
        "<h1>The " + E(natNm) + " League</h1>" +
        "<p>Ten clubs. Eighteen rounds. One pennant.</p>" +
        "</div></div>" +
        "<div class='fo-lgx-clock'>" +
        "<div class='fo-lgx-rk'>Round " + curRound + " of " + rounds + "</div>" +
        "<div class='fo-lgx-pips'>" + pips + "</div>" +
        "<label class='fo-lgx-hop'><span>Change league</span><select id='fo-lt-nat'>" + hop + "</select></label>" +
        "</div></div></div>";

      var tabBar = "<div class='fo-lgx-tabs'>" + TABS.map(function (t) {
        var href = (own ? "#/league?" : "#/nation?n=" + encodeURIComponent(natId) + "&") + "t=" + t[0];
        return "<a class='" + (tab === t[0] ? "on" : "") + "' href='" + href + "'>" + t[1] + "</a>";
      }).join("") + "</div>";

      // ---- the rooms ------------------------------------------------------
      var main = "", rail = "";

      if (tab === "fixtures") {
        var rd = parseInt(qparam("r") || "", 10);
        if (!rd || rd < 1 || rd > rounds) rd = curRound;
        var sched = null;
        try { if (wt && wt.schedMirror) sched = wt.schedMirror(natId, Math.max(1, (cal && cal.seasonNo) || 1)); } catch (eSc) {}
        var nameAt = function (s2) {
          if (nmBySlot && nmBySlot[s2]) return nmBySlot[s2];
          var row = rows.filter(function (r) { return r.slot === s2; })[0];
          if (row) return row.nm;
          try { return (pl.sidesOf(natId) || []).filter(function (x) { return x.slot === s2; })[0].name; } catch (e3) { return "?"; }
        };
        var bossAt = function (s2) { var r = rows.filter(function (x) { return x.slot === s2; })[0]; return r ? r.boss : (s2 === 0); };
        var pairs = (sched && sched[rd - 1]) || [];
        var stepper = function (r2, lbl) {
          var href = (own ? "#/league?" : "#/nation?n=" + encodeURIComponent(natId) + "&") + "t=fixtures&r=" + r2;
          return "<a class='fo-lgx-step' href='" + href + "'>" + lbl + "</a>";
        };
        main = "<div class='fo-lgx-panel'>" +
          "<div class='fo-lgx-ph'><h2>Season fixtures</h2>" +
          "<span class='fo-lgx-rdnav'>" +
          (rd > 1 ? stepper(rd - 1, "&lsaquo;") : "<span class='fo-lgx-step off'>&lsaquo;</span>") +
          "<b>Round " + rd + "</b>" +
          (rd < rounds ? stepper(rd + 1, "&rsaquo;") : "<span class='fo-lgx-step off'>&rsaquo;</span>") +
          "</span></div>" +
          // EVERY FIXTURE IS A DOOR. A result has opened its report for a
          // while; the match still to be played opened nothing at all, which
          // made half the season unreadable. Each row is now the way into that
          // match's own preview - the ground, the hour, the form, the men.
          (pairs.length ? pairs.map(function (pr) {
            var hs = pr[0], as = pr[1], mine = (hs === mySlot || as === mySlot);
            var pv = ""; try { pv = window.foPreviewHref(natId, rd, hs, as); } catch (ePv) {}
            var inner =
              (mine ? "<span class='fo-lgx-yours'>Your match</span>" : "") +
              "<span class='fo-lgx-side'>" + shield(nameAt(hs), bossAt(hs), natId) + "<b>" + E(nameAt(hs)) + "</b></span>" +
              "<span class='fo-lgx-vs'><i>v</i><u>" + hh(hour) + "</u>" + (groundOf(hs) ? "<em>" + E(groundOf(hs)) + "</em>" : "") + "</span>" +
              "<span class='fo-lgx-side a'><b>" + E(nameAt(as)) + "</b>" + shield(nameAt(as), bossAt(as), natId) + "</span>" +
              (pv ? "<u class='fo-lgx-go'>&rsaquo;</u>" : "");
            return pv
              ? "<a class='fo-lgx-fx open" + (mine ? " mine" : "") + "' href='" + pv + "'>" + inner + "</a>"
              : "<div class='fo-lgx-fx" + (mine ? " mine" : "") + "'>" + inner + "</div>";
          }).join("") : "<p class='fo-lgx-dim'>No fixtures for this round yet.</p>") +
          "</div>";

        // the run-in: your next five, home or away
        var runIn = [];
        if (sched && mySlot >= 0) {
          for (var ri = curRound - 1; ri < sched.length && runIn.length < 5; ri++) {
            (sched[ri] || []).forEach(function (pr2) {
              if (runIn.length >= 5) return;
              if (pr2[0] !== mySlot && pr2[1] !== mySlot) return;
              var h2 = pr2[0] === mySlot;
              runIn.push({ r: ri + 1, foe: nameAt(h2 ? pr2[1] : pr2[0]), foeSlot: h2 ? pr2[1] : pr2[0], home: h2 });
            });
          }
        }
        rail = (runIn.length ? "<div class='fo-lgx-card dark'><h3>Your run-in</h3>" +
          runIn.map(function (x) {
            return "<a class='fo-lgx-run' href='#/team?c=" + encodeURIComponent(natId) + "&s=" + x.foeSlot + "'>" +
              "<i>R" + x.r + "</i>" + shield(x.foe, bossAt(x.foeSlot), natId) + "<b>" + E(x.foe) + "</b>" +
              "<u class='" + (x.home ? "h" : "a") + "'>" + (x.home ? "H" : "A") + "</u></a>";
          }).join("") + "</div>" : "") +
          "<div class='fo-lgx-card'><h3>Round at a glance</h3><div class='fo-lgx-glance'>" +
          "<div><b>" + (pairs.length || 5) + "</b><i>Matches</i></div>" +
          "<div><b>" + (rows.length || 10) + "</b><i>Clubs</i></div>" +
          "<div><b>" + hh(hour) + "</b><i>First ball</i></div></div></div>";

      } else if (tab === "results") {
        var all = (snap && snap.results) || [];
        var byRound = {};
        all.forEach(function (rr) { (byRound[rr.round] = byRound[rr.round] || []).push(rr); });
        var have = Object.keys(byRound).map(Number).sort(function (a, b) { return b - a; });
        var rdR = parseInt(qparam("r") || "", 10);
        if (!rdR || !byRound[rdR]) rdR = have[0] || 0;
        var list = byRound[rdR] || [];
        var stepR = function (r2, lbl, cls) {
          var href = (own ? "#/league?" : "#/nation?n=" + encodeURIComponent(natId) + "&") + "t=results&r=" + r2;
          return "<a class='fo-lgx-step " + (cls || "") + "' href='" + href + "'>" + lbl + "</a>";
        };
        var sc = function (s) { return s ? (s.r + (s.w >= 10 ? "" : "/" + s.w)) : ""; };
        main = "<div class='fo-lgx-panel'>" +
          "<div class='fo-lgx-ph'><h2>" + (rdR ? "Round " + rdR + " results" : "Results") + "</h2>" +
          "<span class='fo-lgx-rdnav'>" +
          (byRound[rdR - 1] ? stepR(rdR - 1, "&lsaquo; Prev") : "<span class='fo-lgx-step off'>&lsaquo; Prev</span>") +
          (byRound[rdR + 1] ? stepR(rdR + 1, "Next &rsaquo;") : "<span class='fo-lgx-step off'>Next &rsaquo;</span>") +
          "</span></div>" +
          (scorerLine ? "<p class='fo-lgx-wait'><i></i><span>" + scorerLine + "</span></p>" : "") +
          (list.length ? list.map(function (rr) {
            var hN = say(rr.home), aN = say(rr.away);
            var mine = myClub && (hN === myClub || aN === myClub);
            var won = rr.winner === null ? null : say(rr.winner) === myClub;
            // A ROUND OF RESULTS YOU COULD NOT OPEN. These rows are the most
            // natural thing in the game to tap and they went nowhere. Every
            // one this device holds a card for is now a way into the match
            // report; the rest - other nations' cricket, which this device
            // never played - stay as plain rows rather than dead links.
            // the served feed counts rounds from 1 and the engine from 0, so
            // the round has to be translated or nothing ever matches
            // The card this device holds is the richer read - scorecard,
            // commentary, fantasy - so it wins when there is one. There almost
            // never is: these are the World Service's matches, resolved on the
            // server, and the device played none of them. So every row that
            // found no card falls through to the served report, built from the
            // scoreline the snapshot publishes. Either way the row opens; a row
            // that opened nothing was the whole complaint.
            var href = "";
            try { href = foMatchHref({ home: hN, away: aN, round: (rr.round | 0) - 1 }); } catch (eH) {}
            if (!href && rr.id != null) href = "#/report?n=" + encodeURIComponent(natId) + "&w=" + encodeURIComponent(rr.id);
            var body =
              "<span class='fo-lgx-side'>" + shield(hN, false, natId) + "<b>" + E(hN) + "</b>" +
              (rr.hs ? "<u>" + sc(rr.hs) + "</u>" : "") + "</span>" +
              "<span class='fo-lgx-vs'><i>v</i>" + (rr.hs && rr.hs.ov ? "<em>" + rr.hs.ov + " ov</em>" : "") + "</span>" +
              "<span class='fo-lgx-side a'>" + (rr.as ? "<u>" + sc(rr.as) + "</u>" : "") +
              "<b>" + E(aN) + "</b>" + shield(aN, false, natId) + "</span>" +
              "<span class='fo-lgx-verdict" + (mine ? (won ? " w" : won === false ? " l" : "") : "") + "'>" + E(sayLine(rr.text)) +
              (href ? "<u class='fo-lgx-go'>&rsaquo;</u>" : "") + "</span>";
            var cls = "fo-lgx-res" + (mine ? " mine" : "") + (href ? " open" : "");
            return href
              ? "<a class='" + cls + "' href='" + href + "'>" + body + "</a>"
              : "<div class='" + cls + "'>" + body + "</div>";
          }).join("") : "<p class='fo-lgx-dim'>No cricket has been played yet. The first round settles at " + hh(hour) + " UTC.</p>") +
          "</div>";

        // match of the round: the narrowest margin the round produced
        var margin = function (t) {
          var m = /by (\d+) (run|wicket)/i.exec(t || "");
          if (!m) return 1e6;
          return (m[2].toLowerCase() === "wicket" ? +m[1] * 12 : +m[1]);
        };
        var best = list.slice().sort(function (a, b) { return margin(a.text) - margin(b.text); })[0];
        var myRow = rows.filter(function (r) { return r.mine; })[0];
        var myPos = 0; rows.forEach(function (r, ix) { if (r.mine) myPos = ix + 1; });
        rail = (best ? "<div class='fo-lgx-card dark'><h3>Match of the round</h3>" +
          "<div class='fo-lgx-mor'><b>" + (best.hs ? sc(best.hs) : "") + "</b><i>&mdash;</i><b>" + (best.as ? sc(best.as) : "") + "</b></div>" +
          "<p>" + E(sayLine(best.text)) + "</p>" +
          "<div class='fo-lgx-morf'><span>" + E(say(best.home)) + "</span><span>" + E(say(best.away)) + "</span></div></div>" : "") +
          (myRow ? "<div class='fo-lgx-card'><h3>Your season</h3><div class='fo-lgx-glance'>" +
            "<div><b>" + myRow.pts + "</b><i>Pts</i></div>" +
            "<div><b>" + ((myRow.nrr >= 0 ? "+" : "") + (+myRow.nrr || 0).toFixed(2)) + "</b><i>NRR</i></div>" +
            "<div><b>" + (myPos ? myPos : "&mdash;") + "</b><i>Table</i></div></div></div>" : "");

      } else if (tab === "stats") {
        var st = (snap && snap.stats) || { bat: [], bowl: [], sr: [], econ: [] };
        var lead = function (title, row, big, unit, sub) {
          if (!row) return "";
          return "<div class='fo-lgx-lead'><i>" + title + "</i>" +
            "<b>" + E(say(row.name)) + "</b><u>" + E(say(row.club)) + "</u>" +
            "<span class='fo-lgx-big'>" + big + "<em>" + unit + "</em></span>" +
            "<span class='fo-lgx-leadsub'>" + sub + "</span></div>";
        };
        var bat0 = (st.bat || [])[0], bowl0 = (st.bowl || [])[0], sr0 = (st.sr || [])[0];
        main = "<div class='fo-lgx-panel'>" +
          "<div class='fo-lgx-ph'><h2>League leaders</h2><span class='fo-lgx-sub'>Season " +
          ((snap && snap.seasonNo) || 1) + " &middot; after round " + playedRounds + "</span></div>" +
          ((bat0 || bowl0) ? "<div class='fo-lgx-leads'>" +
            lead("Most runs", bat0, bat0 ? bat0.runs : "", "runs", bat0 ? ("best " + bat0.hs + " &middot; SR " + bat0.sr) : "") +
            lead("Most wickets", bowl0, bowl0 ? bowl0.wkts : "", "wkts", bowl0 ? ("econ " + bowl0.econ + (bowl0.bb ? " &middot; best " + bowl0.bb.w + "-" + bowl0.bb.r : "")) : "") +
            lead("Fastest scoring", sr0, sr0 ? sr0.sr : "", "SR", sr0 ? (sr0.runs + " runs") : "") +
            "</div>" : "<p class='fo-lgx-dim'>Nobody has faced a ball yet. The numbers begin at " + hh(hour) + " UTC.</p>") +
          ((st.bat || []).length ? "<div class='fo-lgx-sub2'>Batting leaders</div>" +
            "<div class='fo-lgx-cols5'><span>#</span><span>Player</span><span>Club</span><span>Runs</span><span>SR</span></div>" +
            st.bat.map(function (x, ix) {
              var top = st.bat[0].runs || 1;
              return "<div class='fo-lgx-statrow'><span class='rk'>" + (ix + 1) + "</span>" +
                "<span class='nm'>" + E(say(x.name)) + "</span>" +
                "<span class='cl'>" + E(say(x.club)) + "</span>" +
                "<span class='vv'>" + x.runs + "<u style='width:" + Math.round(100 * x.runs / top) + "%'></u></span>" +
                "<span class='sr'>" + x.sr + "</span></div>";
            }).join("") : "") +
          ((st.bowl || []).length ? "<div class='fo-lgx-sub2'>Bowling leaders</div>" +
            "<div class='fo-lgx-cols5'><span>#</span><span>Player</span><span>Club</span><span>Wkts</span><span>Econ</span></div>" +
            st.bowl.map(function (x, ix) {
              var topW = st.bowl[0].wkts || 1;
              return "<div class='fo-lgx-statrow'><span class='rk'>" + (ix + 1) + "</span>" +
                "<span class='nm'>" + E(say(x.name)) + "</span>" +
                "<span class='cl'>" + E(say(x.club)) + "</span>" +
                "<span class='vv'>" + x.wkts + "<u style='width:" + Math.round(100 * x.wkts / topW) + "%'></u></span>" +
                "<span class='sr'>" + x.econ + "</span></div>";
            }).join("") : "") +
          "</div>";
        rail = "<div class='fo-lgx-card dark'><h3>Milestones</h3>" +
          "<div class='fo-lgx-mile'><i>Highest score</i><b>" + (bat0 ? bat0.hs : "&mdash;") + "</b></div>" +
          "<div class='fo-lgx-mile'><i>Best bowling</i><b>" + (bowl0 && bowl0.bb ? bowl0.bb.w + "/" + bowl0.bb.r : "&mdash;") + "</b></div>" +
          "<div class='fo-lgx-mile'><i>Rounds played</i><b>" + playedRounds + " of " + rounds + "</b></div></div>" +
          "<div class='fo-lgx-card'><h3>The book</h3><p class='fo-lgx-dim'>Every run and every wicket here was scored in a match the umpire played and banked. Nothing is estimated.</p>" +
          "<a class='fo-lgx-more' href='#/records'>The record book &rsaquo;</a></div>";

      } else {
        // ---- the pennant race ---------------------------------------------
        var body = rows.map(function (r, ix) {
          var s5 = (seq[r.recNm] || []).slice(-5);
          var beads = s5.length ? s5.map(function (k) { return "<i class='" + k + "'>" + k.toUpperCase() + "</i>"; }).join("")
            : "<span class='none'>&mdash;</span>";
          var chip = r.mine ? "<em class='you'>You</em>"
            : r.boss ? "<em class='fl'>Flagship</em>"
            : mgrOf(r.slot) ? "<em class='hu'>" + E(mgrOf(r.slot)) + "</em>" : "";
          return "<a class='fo-lgx-row" + (r.mine ? " mine" : "") + (ix < 4 ? " q" : "") + "' href='#/team?c=" +
            encodeURIComponent(natId) + "&s=" + r.slot + "'>" +
            "<span class='rk'>" + (ix + 1) + "</span>" +
            "<span class='cb'>" + shield(r.nm, r.boss, natId) + "</span>" +
            "<span class='nm'><b>" + E(r.nm) + "</b>" + chip + "</span>" +
            "<span class='fm'>" + beads + "</span>" +
            "<span class='n'>" + (r.p | 0) + "</span><span class='n'>" + (r.w | 0) + "</span><span class='n'>" + (r.l | 0) + "</span>" +
            "<span class='n nrr'>" + ((r.nrr >= 0 ? "+" : "") + (+r.nrr || 0).toFixed(2)) + "</span>" +
            "<span class='pt'>" + (r.pts | 0) + "</span></a>";
        }).join("");
        main = "<div class='fo-lgx-panel'>" +
          "<div class='fo-lgx-ph'><h2>The pennant race</h2>" +
          "<span class='fo-lgx-sub'>" + (playedRounds ? "Standings after round " + playedRounds : "Before a ball is bowled") + "</span></div>" +
          (scorerLine ? "<p class='fo-lgx-wait'><i></i><span>" + scorerLine + "</span></p>" : "") +
          (rows.length ? "<div class='fo-lgx-cols'><span>#</span><span></span><span>Club</span><span>Form</span>" +
            "<span>P</span><span>W</span><span>L</span><span>NRR</span><span>Pts</span></div>" + body
            : "<p class='fo-lgx-dim'>The " + E(natNm) + " table is on its way from the World Service&hellip;</p>") +
          "</div>";

        // NEXT ROUND MEANS NEXT. Once the day's play is finished this card was
        // still offering the round that had just ended as the one to come, at
        // an hour already hours past. The clock knows which of the three it is
        // - not started, in play, or done - so let it name the round honestly.
        var nextRd = Math.min(rounds, curRound + (state === "fin" ? 1 : 0));
        var nextTtl = state === "live" ? "Round " + curRound + ", in play"
          : state === "fin" ? "Round " + nextRd + ", tomorrow" : "Round " + nextRd + " today";
        var nextWhen = hh(hour) + " UTC";
        var nextPairs = [];
        try {
          var sc2 = wt && wt.schedMirror ? wt.schedMirror(natId, Math.max(1, (cal && cal.seasonNo) || 1)) : null;
          nextPairs = (nextRd > curRound && state === "fin" && curRound >= rounds) ? [] : ((sc2 && sc2[nextRd - 1]) || []);
        } catch (eNp) {}
        var nmA = function (s2) {
          if (nmBySlot && nmBySlot[s2]) return nmBySlot[s2];
          var row = rows.filter(function (r) { return r.slot === s2; })[0];
          return row ? row.nm : "?";
        };
        var lead0 = rows[0] ? rows[0].pts : 0;
        rail =
          (nextPairs.length ? "<div class='fo-lgx-card'><h3>" + E(nextTtl) + "<span>" + nextWhen + "</span></h3>" +
            nextPairs.map(function (pr) {
              var mine = (pr[0] === mySlot || pr[1] === mySlot);
              var pv2 = ""; try { pv2 = window.foPreviewHref(natId, nextRd, pr[0], pr[1]); } catch (eP2) {}
              var in2 =
                "<span>" + shield(nmA(pr[0]), pr[0] === 0, natId) + "<b>" + E(nmA(pr[0])) + "</b></span>" +
                "<i>v</i>" +
                "<span class='a'><b>" + E(nmA(pr[1])) + "</b>" + shield(nmA(pr[1]), pr[1] === 0, natId) + "</span>" +
                (mine ? "<u>Your match</u>" : "");
              return pv2
                ? "<a class='fo-lgx-nx open" + (mine ? " mine" : "") + "' href='" + pv2 + "'>" + in2 + "</a>"
                : "<div class='fo-lgx-nx" + (mine ? " mine" : "") + "'>" + in2 + "</div>";
            }).join("") + "</div>" : "") +
          (rows.length ? "<div class='fo-lgx-card dark'><h3>The chase</h3>" +
            rows.slice(0, 3).map(function (r) {
              var pc = lead0 ? Math.round(100 * r.pts / lead0) : 0;
              return "<div class='fo-lgx-chase'><span>" + E(r.nm) + "</span>" +
                "<u><i style='width:" + Math.max(4, pc) + "%'></i></u><b>" + r.pts + "</b></div>";
            }).join("") + "</div>" : "") +
          "<div class='fo-lgx-card note'><h3>League note</h3><p>" +
          (state === "pre" ? "The season opens in " + preDays + " day" + (preDays === 1 ? "" : "s") + ". Ten clubs, all on nought."
            : rows.length > 1 ? (rows[0].pts - rows[1].pts) + " point" + ((rows[0].pts - rows[1].pts) === 1 ? "" : "s") + " separate the leading pack."
            : E(NAT_LINE[natId] || "Ten clubs, one pennant.")) + "</p></div>";
      }

      page.innerHTML = "<div class='fo-lgx' style='--nac:" + E(reg.ac || "#C95532") + "'>" +
        plate + tabBar +
        "<div class='fo-lgx-body'><div class='fo-lgx-main'>" + main + "</div>" +
        "<div class='fo-lgx-rail'>" + rail + "</div></div>" +
        "<div class='fo-lgx-foot'>" +
        (own ? "<a href='#/fixtures'>My fixtures &rsaquo;</a>" : "<a href='#/league'>My own league &rsaquo;</a>") +
        "<a href='#/planet'>World cricket &rsaquo;</a>" +
        "<a href='#/atlas?n=" + encodeURIComponent(natId) + "'>The " + E(natNm) + " atlas &rsaquo;</a></div>" +
        "</div>";

      try {
        var sel = document.getElementById("fo-lt-nat");
        if (sel) sel.addEventListener("change", function () {
          var v = sel.value; if (!v) return;
          location.hash = (v === myNat) ? ("#/league?t=" + tab) : ("#/nation?n=" + encodeURIComponent(v) + "&t=" + tab);
        });
      } catch (eSel) {}
    } catch (e) { try { console.warn("foRenderLeagueTablePage", e); } catch (e2) {} }
  }

  var CSS = [
    "html body #page .fo-lgx{position:relative;max-width:680px;margin:20px auto 44px;padding:0 12px;color:#141C28;--nac:#C95532;--ink:#0C1B33;--gold:#E8B96A}",
    "html body #page .fo-lgx>*{position:relative;z-index:1}",
    // THE MARGINS ARE THE COUNTRY. Not wallpaper - furniture: the nation's
    // painted map hangs like a framed plate on one side and the country's own
    // cricketer stands on the other, both clear of the reading column. Below
    // 1080px there are no margins to fill, so neither is there.
    "#fo-sideart{display:none}",
    "@media(min-width:1080px){#fo-sideart.on{display:block;position:fixed;inset:0;z-index:0;pointer-events:none}",
    "html body.fo-sa-on .wrap{position:relative;z-index:1;box-shadow:none !important}",
    "#fo-sideart .fo-sa-map{position:fixed;top:92px;left:0;width:calc(50vw - 344px);display:flex;flex-direction:column;align-items:center;gap:9px;text-decoration:none;pointer-events:auto}",
    "#fo-sideart .fo-sa-map img{width:min(84%,300px);border-radius:10px;box-shadow:0 18px 44px rgba(20,28,40,.22);opacity:.95;transition:opacity .2s ease,transform .2s ease}",
    "#fo-sideart .fo-sa-map:hover img{opacity:1;transform:translateY(-2px)}",
    "html body #page a.fo-sa-map span,#fo-sideart .fo-sa-map span{font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:rgba(20,28,40,.42)}",
    "#fo-sideart .fo-sa-fig{position:fixed;right:0;bottom:0;width:calc(50vw - 344px);display:flex;justify-content:center;align-items:flex-end}",
    "#fo-sideart .fo-sa-fig img{height:min(66vh,690px);width:auto;max-width:98%;object-fit:contain;object-position:bottom;filter:drop-shadow(0 18px 34px rgba(20,28,40,.28));-webkit-mask-image:linear-gradient(180deg,#000 82%,transparent);mask-image:linear-gradient(180deg,#000 82%,transparent)}",
    "@media(max-width:1300px){#fo-sideart .fo-sa-fig img{height:min(54vh,520px)}}}",

    // ---- the plate: the country behind the name of its league --------------
    "html body #page .fo-lgx-plate{position:relative;overflow:hidden;border-radius:20px;background:linear-gradient(135deg,#0C1B33,#173257 62%,#0E2140);box-shadow:0 22px 50px rgba(12,27,51,.26)}",
    // THE PENNANT IS A CUP. Every nation's league plays for its own trophy -
    // the nineteen painted cups, standing in the plate where the map used to be
    "html body #page .fo-lgx-cup{position:absolute;right:20px;bottom:4px;height:calc(100% - 12px);width:auto;max-width:30%;object-fit:contain;object-position:bottom right;filter:drop-shadow(0 14px 26px rgba(0,0,0,.45))}",
    "html body #page .fo-lgx-glow{position:absolute;right:0;top:-30%;width:44%;height:160%;background:radial-gradient(closest-side,rgba(232,185,106,.22),transparent 72%);pointer-events:none}",
    "html body #page .fo-lgx-plate:after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--gold)}",
    "html body #page .fo-lgx-plin{position:relative;padding:20px 22px 18px;padding-right:clamp(118px,24%,210px);display:flex;flex-direction:column;gap:15px}",
    "html body #page .fo-lgx-mark{display:flex;gap:14px;align-items:flex-start}",
    "html body #page .fo-lgx-pennant{flex:0 0 auto;width:46px;height:46px;border-radius:11px;background:rgba(255,254,252,.07);border:1px solid rgba(232,185,106,.42);display:flex;align-items:center;justify-content:center}",
    "html body #page .fo-lgx-pennant img{width:30px;height:21px;object-fit:cover;border-radius:2px;box-shadow:0 1px 5px rgba(0,0,0,.45)}",
    "html body #page .fo-lgx-k{font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:var(--gold)}",
    "html body #page .fo-lgx-titles h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:29px;line-height:1.04;margin:8px 0 5px;color:#FFFEFC;letter-spacing:-.012em}",
    "html body #page .fo-lgx-titles p{margin:0;font:italic 420 12.5px/1.5 'Fraunces',Georgia,serif;color:rgba(255,254,252,.6)}",
    "html body #page .fo-lgx-clock{border-top:1px solid rgba(255,254,252,.13);padding-top:13px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px}",
    "html body #page .fo-lgx-rk{font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,254,252,.72)}",
    "html body #page .fo-lgx-pips{display:flex;gap:3px;flex:1 1 210px;flex-wrap:wrap}",
    "html body #page .fo-lgx-pips i{width:17px;height:17px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;font:700 8.5px/1 Inter,sans-serif;font-style:normal;background:rgba(255,254,252,.08);color:rgba(255,254,252,.4)}",
    "html body #page .fo-lgx-pips i.done{background:rgba(232,185,106,.92);color:#0C1B33}",
    "html body #page .fo-lgx-pips i.now{background:transparent;box-shadow:inset 0 0 0 1px var(--gold);color:var(--gold)}",
    "html body #page .fo-lgx-hop{display:flex;align-items:center;gap:8px}",
    "html body #page .fo-lgx-hop span{font:700 9px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,254,252,.48)}",
    "html body #page .fo-lgx-hop select{background:rgba(255,254,252,.1) !important;color:#FFFEFC !important;border:1px solid rgba(255,254,252,.22);border-radius:999px;padding:6px 10px;font:600 11.5px/1 Inter,sans-serif;-webkit-appearance:menulist;appearance:menulist}",
    "html body #page .fo-lgx-hop select option{color:#141C28;background:#FFFEFC}",

    // ---- the four rooms ----------------------------------------------------
    "html body #page .fo-lgx-tabs{display:flex;gap:2px;margin:15px 0 14px;border-bottom:1px solid rgba(20,28,40,.12);overflow-x:auto;-webkit-overflow-scrolling:touch}",
    "html body #page .fo-lgx-tabs a{flex:0 0 auto;padding:9px 14px 10px;font:700 10px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.46);text-decoration:none;border-bottom:2px solid transparent;margin-bottom:-1px}",
    "html body #page .fo-lgx-tabs a.on{color:#141C28;border-bottom-color:var(--nac)}",
    "html body #page .fo-lgx-tabs a:hover{color:#141C28;text-decoration:none}",
    "html body #page .fo-lgx-body{display:block}",
    "html body #page .fo-lgx-rail{margin-top:14px}",
    "html body #page .fo-lgx-panel{background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:16px;padding:14px 14px 16px;box-shadow:0 8px 24px rgba(30,38,52,.06)}",
    "html body #page .fo-lgx-ph{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}",
    "html body #page .fo-lgx-ph h2{margin:0;font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:19px;color:#141C28}",
    "html body #page .fo-lgx-sub{font:700 9px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.42)}",
    "html body #page .fo-lgx-sub2{margin:16px 0 4px;padding-top:12px;border-top:1px solid rgba(20,28,40,.08);font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(20,28,40,.5)}",
    "html body #page .fo-lgx-rdnav{display:flex;align-items:center;gap:6px}",
    "html body #page .fo-lgx-rdnav b{font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.6)}",
    "html body #page .fo-lgx-step{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;padding:0 9px;border-radius:999px;border:1px solid rgba(20,28,40,.14);background:#FFFEFC;font:700 10.5px/1 Inter,sans-serif;color:rgba(20,28,40,.65);text-decoration:none}",
    "html body #page .fo-lgx-step:hover{border-color:var(--nac);color:var(--nac);text-decoration:none}",
    "html body #page .fo-lgx-step.off{opacity:.32}",
    "html body #page .fo-lgx-dim{margin:0;font:italic 420 12.5px/1.55 'Fraunces',Georgia,serif;color:rgba(20,28,40,.55)}",
    // the scorer's desk: stumps drawn, the book not yet written up
    "html body #page .fo-lgx-wait{display:flex;align-items:flex-start;gap:9px;margin:0 0 12px;padding:9px 11px;border-radius:3px;background:rgba(201,138,42,.09);border-left:3px solid #C98A2A}",
    "html body #page .fo-lgx-wait i{flex:0 0 auto;width:7px;height:7px;margin-top:5px;border-radius:50%;background:#C98A2A;animation:foLgxPen 2.2s ease-in-out infinite}",
    "html body #page .fo-lgx-wait span{font:italic 420 12.5px/1.55 'Fraunces',Georgia,serif;color:rgba(20,28,40,.74)}",
    "@keyframes foLgxPen{0%,100%{opacity:1}50%{opacity:.28}}",
    "@media(prefers-reduced-motion:reduce){html body #page .fo-lgx-wait i{animation:none}}",

    // every club wears a shield
    "html body #page .fo-lgx-cr{width:22px;height:22px;object-fit:contain;flex:0 0 auto}",
    "html body #page .fo-lgx-sh{width:22px;height:22px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font:800 8.5px/1 Inter,sans-serif;color:#FFFEFC;background:var(--sc,#1D3F6E);flex:0 0 auto}",

    // ---- the pennant race --------------------------------------------------
    "html body #page .fo-lgx-cols,html body #page .fo-lgx-row{display:grid;grid-template-columns:22px 26px minmax(0,1fr) 86px 26px 26px 26px 46px 32px;gap:6px;align-items:center}",
    "html body #page .fo-lgx-cols{padding:4px 8px 7px;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:rgba(20,28,40,.4)}",
    "html body #page .fo-lgx-cols span:nth-child(n+5){text-align:right}",
    "html body #page .fo-lgx-row{padding:8px;border-radius:10px;text-decoration:none;color:#141C28;border-bottom:1px solid rgba(20,28,40,.07)}",
    "html body #page .fo-lgx-row:hover{background:rgba(20,28,40,.03);text-decoration:none}",
    "html body #page .fo-lgx-row.q .rk{color:#177A57}",
    "html body #page .fo-lgx-row.mine{background:rgba(201,85,50,.06);border-bottom-color:transparent;box-shadow:inset 3px 0 0 var(--nac)}",
    "html body #page .fo-lgx-row .rk{font:700 12px/1 Oswald,sans-serif;color:rgba(20,28,40,.45);font-variant-numeric:tabular-nums}",
    "html body #page .fo-lgx-row .cb{display:flex;align-items:center;justify-content:center}",
    "html body #page .fo-lgx-row .nm{min-width:0}",
    "html body #page .fo-lgx-row .nm b{display:block;font:600 12.5px/1.25 Inter,sans-serif;color:#141C28;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    "html body #page .fo-lgx-row .nm em{display:block;margin-top:3px;font:700 8px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;font-style:normal;color:rgba(20,28,40,.4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    "html body #page .fo-lgx-row .nm em.you{color:var(--nac)}",
    "html body #page .fo-lgx-row .nm em.fl{color:#8A6A1F}",
    "html body #page .fo-lgx-row .nm em.hu{color:#177A57}",
    "html body #page .fo-lgx-row .fm{display:flex;gap:3px}",
    "html body #page .fo-lgx-row .fm i{width:14px;height:14px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font:800 8px/1 Inter,sans-serif;font-style:normal}",
    "html body #page .fo-lgx-row .fm i.w{background:rgba(31,158,114,.16);color:#177A57}",
    "html body #page .fo-lgx-row .fm i.l{background:rgba(200,60,58,.12);color:#B23230}",
    "html body #page .fo-lgx-row .fm i.t{background:rgba(20,28,40,.08);color:rgba(20,28,40,.5)}",
    "html body #page .fo-lgx-row .fm .none{font:600 10px/1 Inter,sans-serif;color:rgba(20,28,40,.3)}",
    "html body #page .fo-lgx-row .n{text-align:right;font:500 12px/1 Inter,sans-serif;color:rgba(20,28,40,.6);font-variant-numeric:tabular-nums}",
    "html body #page .fo-lgx-row .n.nrr{font-size:11px}",
    "html body #page .fo-lgx-row .pt{text-align:right;font:700 15px/1 Oswald,sans-serif;font-variant-numeric:tabular-nums;color:#141C28}",

    // ---- fixtures and results ---------------------------------------------
    "html body #page .fo-lgx-fx,html body #page .fo-lgx-res{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:7px;background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:12px;padding:11px 12px;margin-bottom:6px;box-shadow:0 4px 14px rgba(30,38,52,.05)}",
    "html body #page .fo-lgx-fx.mine,html body #page .fo-lgx-res.mine{border-color:rgba(201,85,50,.42);box-shadow:0 6px 18px rgba(201,85,50,.09)}",
    // a fixture that opens its preview says so the way the results rows do
    "html body #page .fo-lgx-fx.open{text-decoration:none;color:inherit;cursor:pointer;transition:border-color .16s ease,transform .16s ease,box-shadow .16s ease}",
    "html body #page .fo-lgx-fx.open:hover{border-color:var(--nac);transform:translateY(-1px);box-shadow:0 8px 20px rgba(30,38,52,.1)}",
    "html body #page .fo-lgx-nx.open{text-decoration:none;color:inherit;cursor:pointer}",
    "html body #page .fo-lgx-nx.open:hover b{color:var(--nac)}",
    "@media(prefers-reduced-motion:reduce){html body #page .fo-lgx-fx.open{transition:none}}",
    // a result you can open says so with a chevron and lifts under the finger;
    // it keeps the row's own type colour rather than turning link-blue
    "html body #page a.fo-lgx-res.open{text-decoration:none;color:inherit;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease}",
    "html body #page a.fo-lgx-res.open:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(30,38,52,.11)}",
    "html body #page a.fo-lgx-res.open:focus-visible{outline:2px solid var(--nac);outline-offset:2px}",
    "html body #page .fo-lgx-go{text-decoration:none;margin-left:6px;opacity:.5;font-weight:700}",
    "html body #page .fo-lgx-yours{grid-column:1/-1;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--nac)}",
    "html body #page .fo-lgx-side{display:flex;align-items:center;gap:7px;min-width:0}",
    "html body #page .fo-lgx-side.a{justify-content:flex-end}",
    "html body #page .fo-lgx-side b{font:600 12.5px/1.25 Inter,sans-serif;color:#141C28;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    "html body #page .fo-lgx-side u{text-decoration:none;font:700 12.5px/1 Oswald,sans-serif;font-variant-numeric:tabular-nums;color:#141C28;flex:0 0 auto}",
    "html body #page .fo-lgx-vs{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:54px}",
    "html body #page .fo-lgx-vs i{font:italic 400 11px/1 'Fraunces',Georgia,serif;color:rgba(20,28,40,.38)}",
    "html body #page .fo-lgx-vs u,html body #page .fo-lgx-vs em{text-decoration:none;font:600 9px/1.25 Inter,sans-serif;color:rgba(20,28,40,.42);font-style:normal;text-align:center}",
    "html body #page .fo-lgx-verdict{grid-column:1/-1;margin-top:2px;padding-top:7px;border-top:1px dashed rgba(20,28,40,.1);font:italic 420 11.5px/1.45 'Fraunces',Georgia,serif;color:rgba(20,28,40,.6)}",
    "html body #page .fo-lgx-verdict.w{color:#177A57}",
    "html body #page .fo-lgx-verdict.l{color:#B23230}",

    // ---- the season's numbers ---------------------------------------------
    "html body #page .fo-lgx-leads{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:6px}",
    "html body #page .fo-lgx-lead{background:linear-gradient(150deg,#0C1B33,#16304F);border-radius:12px;padding:13px 14px;color:#FFFEFC}",
    "html body #page .fo-lgx-lead i{display:block;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);font-style:normal}",
    "html body #page .fo-lgx-lead b{display:block;margin-top:7px;font:600 13.5px/1.25 Inter,sans-serif}",
    "html body #page .fo-lgx-lead u{display:block;margin-top:2px;text-decoration:none;font:500 10.5px/1.3 Inter,sans-serif;color:rgba(255,254,252,.55)}",
    "html body #page .fo-lgx-big{display:block;margin-top:8px;font:700 26px/1 Oswald,sans-serif;font-variant-numeric:tabular-nums}",
    "html body #page .fo-lgx-big em{margin-left:5px;font:600 10px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,254,252,.5);font-style:normal}",
    "html body #page .fo-lgx-leadsub{display:block;margin-top:4px;font:italic 420 10.5px/1.4 'Fraunces',Georgia,serif;color:rgba(255,254,252,.6)}",
    "html body #page .fo-lgx-cols5,html body #page .fo-lgx-statrow{display:grid;grid-template-columns:20px minmax(0,1.15fr) minmax(0,1fr) 70px 42px;gap:8px;align-items:center}",
    "html body #page .fo-lgx-cols5{padding:4px 8px;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.4)}",
    "html body #page .fo-lgx-cols5 span:nth-child(4),html body #page .fo-lgx-cols5 span:nth-child(5){text-align:right}",
    "html body #page .fo-lgx-statrow{padding:8px;border-bottom:1px solid rgba(20,28,40,.07)}",
    "html body #page .fo-lgx-statrow:last-child{border-bottom:0}",
    "html body #page .fo-lgx-statrow .rk{font:700 11px/1 Oswald,sans-serif;color:rgba(20,28,40,.4)}",
    "html body #page .fo-lgx-statrow .nm{font:600 12px/1.25 Inter,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    "html body #page .fo-lgx-statrow .cl{font:500 11px/1.25 Inter,sans-serif;color:rgba(20,28,40,.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    "html body #page .fo-lgx-statrow .vv{position:relative;text-align:right;padding-bottom:7px;font:700 12.5px/1 Oswald,sans-serif;font-variant-numeric:tabular-nums}",
    "html body #page .fo-lgx-statrow .vv u{position:absolute;left:0;bottom:0;height:3px;border-radius:2px;background:var(--nac);opacity:.5;text-decoration:none;display:block}",
    "html body #page .fo-lgx-statrow .sr{text-align:right;font:500 11.5px/1 Inter,sans-serif;color:rgba(20,28,40,.55);font-variant-numeric:tabular-nums}",

    // ---- the rail ----------------------------------------------------------
    "html body #page .fo-lgx-card{background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:14px;padding:14px 15px;margin-bottom:12px;box-shadow:0 5px 16px rgba(30,38,52,.05)}",
    "html body #page .fo-lgx-card h3{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0 0 10px;font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(20,28,40,.5)}",
    "html body #page .fo-lgx-card h3 span{font:600 9px/1 Inter,sans-serif;letter-spacing:.06em;color:rgba(20,28,40,.4)}",
    "html body #page .fo-lgx-card p{margin:0;font:italic 420 12.5px/1.55 'Fraunces',Georgia,serif;color:rgba(20,28,40,.62)}",
    "html body #page .fo-lgx-card.note{border-left:3px solid var(--nac)}",
    "html body #page .fo-lgx-card.dark{background:linear-gradient(150deg,#0C1B33,#16304F);border-color:rgba(12,27,51,.35);color:#FFFEFC;box-shadow:0 10px 26px rgba(12,27,51,.2)}",
    "html body #page .fo-lgx-card.dark h3{color:var(--gold)}",
    "html body #page .fo-lgx-card.dark h3 span{color:rgba(255,254,252,.5)}",
    "html body #page .fo-lgx-card.dark p{color:rgba(255,254,252,.72)}",
    "html body #page .fo-lgx-run{display:flex;align-items:center;gap:8px;padding:7px 0;text-decoration:none;color:#FFFEFC;border-bottom:1px solid rgba(255,254,252,.08)}",
    "html body #page .fo-lgx-run:last-child{border-bottom:0}",
    "html body #page .fo-lgx-run:hover{text-decoration:none}",
    "html body #page .fo-lgx-run i{width:22px;font:700 9px/1 Oswald,sans-serif;color:var(--gold);font-style:normal}",
    "html body #page .fo-lgx-run b{flex:1;min-width:0;font:600 12px/1.25 Inter,sans-serif;color:#FFFEFC;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    "html body #page .fo-lgx-run u{flex:0 0 auto;width:18px;height:18px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font:800 9px/1 Inter,sans-serif;background:rgba(255,254,252,.12);color:rgba(255,254,252,.8)}",
    "html body #page .fo-lgx-run u.h{background:rgba(232,185,106,.9);color:#0C1B33}",
    "html body #page .fo-lgx-glance{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center}",
    "html body #page .fo-lgx-glance div{padding:5px 2px}",
    "html body #page .fo-lgx-glance b{display:block;font:700 19px/1 Oswald,sans-serif;font-variant-numeric:tabular-nums;color:#141C28}",
    "html body #page .fo-lgx-glance i{display:block;margin-top:5px;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.45);font-style:normal}",
    "html body #page .fo-lgx-mor{display:flex;align-items:center;justify-content:center;gap:10px;font:700 22px/1 Oswald,sans-serif;color:#FFFEFC;font-variant-numeric:tabular-nums}",
    "html body #page .fo-lgx-mor i{font:400 14px/1 Inter,sans-serif;color:rgba(255,254,252,.4);font-style:normal}",
    "html body #page .fo-lgx-card.dark .fo-lgx-mor+p{margin-top:8px;text-align:center}",
    "html body #page .fo-lgx-morf{display:flex;justify-content:space-between;gap:10px;margin-top:8px;font:600 10px/1.3 Inter,sans-serif;color:rgba(255,254,252,.58)}",
    "html body #page .fo-lgx-morf span:last-child{text-align:right}",
    "html body #page .fo-lgx-mile{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,254,252,.08)}",
    "html body #page .fo-lgx-mile:last-child{border-bottom:0}",
    "html body #page .fo-lgx-mile i{font:500 11px/1 Inter,sans-serif;color:rgba(255,254,252,.6);font-style:normal}",
    "html body #page .fo-lgx-mile b{font:700 13px/1 Oswald,sans-serif;color:#FFFEFC;font-variant-numeric:tabular-nums}",
    "html body #page .fo-lgx-more{display:inline-block;margin-top:9px;font:600 11.5px/1 Inter,sans-serif;color:var(--nac);text-decoration:none}",
    "html body #page .fo-lgx-nx{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:6px;padding:7px 0;border-bottom:1px solid rgba(20,28,40,.07)}",
    "html body #page .fo-lgx-nx:last-child{border-bottom:0}",
    "html body #page .fo-lgx-nx span{display:flex;align-items:center;gap:6px;min-width:0}",
    "html body #page .fo-lgx-nx span.a{justify-content:flex-end}",
    "html body #page .fo-lgx-nx b{font:600 11.5px/1.2 Inter,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    "html body #page .fo-lgx-nx i{font:italic 400 10px/1 'Fraunces',Georgia,serif;color:rgba(20,28,40,.35)}",
    "html body #page .fo-lgx-nx u{grid-column:1/-1;text-decoration:none;font:700 8px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--nac)}",
    "html body #page .fo-lgx-nx.mine{background:rgba(201,85,50,.06);border-radius:9px;padding:7px 7px}",
    "html body #page .fo-lgx-chase{display:grid;grid-template-columns:minmax(0,92px) minmax(0,1fr) 26px;align-items:center;gap:8px;padding:5px 0}",
    "html body #page .fo-lgx-chase span{font:600 11px/1.2 Inter,sans-serif;color:rgba(255,254,252,.85);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    "html body #page .fo-lgx-chase u{display:block;height:7px;border-radius:999px;background:rgba(255,254,252,.12);overflow:hidden;text-decoration:none}",
    "html body #page .fo-lgx-chase u i{display:block;height:100%;background:var(--gold);font-style:normal}",
    "html body #page .fo-lgx-chase b{text-align:right;font:700 12px/1 Oswald,sans-serif;color:#FFFEFC;font-variant-numeric:tabular-nums}",

    "html body #page .fo-lgx-foot{display:flex;gap:8px;justify-content:space-between;margin-top:16px;flex-wrap:wrap}",
    "html body #page .fo-lgx-foot a{font:600 11.5px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 15px;text-decoration:none}",
    "html body #page .fo-lgx-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5);text-decoration:none}",

    // ---- the phone: the same league, one column ---------------------------
    "@media(max-width:560px){html body #page .fo-lgx-titles h1{font-size:25px}",
    "html body #page .fo-lgx{padding:0 9px}",
    "html body #page .fo-lgx-plin{padding:17px 15px 15px}",
    "html body #page .fo-lgx-plin{padding-right:88px}",
    "html body #page .fo-lgx-cup{right:7px;bottom:10px;height:auto;width:72px;max-width:72px}",
    "html body #page .fo-lgx-panel{padding:12px 10px 14px}",
    "html body #page .fo-lgx-cols{padding:4px 5px 7px}",
    "html body #page .fo-lgx-row{padding:8px 5px}",
    "html body #page .fo-lgx-row .fm{gap:2px}",
    "html body #page .fo-lgx-row .fm i{width:12px;height:12px;border-radius:3px;font-size:7.5px}",
    "html body #page .fo-lgx-cols,html body #page .fo-lgx-row{grid-template-columns:20px 24px minmax(0,1fr) 66px 24px 24px 32px}",
    "html body #page .fo-lgx-cols span:nth-child(7),html body #page .fo-lgx-cols span:nth-child(8),html body #page .fo-lgx-row .n:nth-child(7),html body #page .fo-lgx-row .n.nrr{display:none}",
    "html body #page .fo-lgx-cols5,html body #page .fo-lgx-statrow{grid-template-columns:18px minmax(0,1fr) 62px 40px}",
    "html body #page .fo-lgx-cols5 span:nth-child(3),html body #page .fo-lgx-statrow .cl{display:none}",
    "html body #page .fo-lgx-vs{min-width:46px}",
    "html body #page .fo-lgx-foot a{flex:1 1 auto;text-align:center}}",

    // ---- the desk: the rail comes alongside -------------------------------
    "@media(min-width:1440px){html body #page .fo-lgx{max-width:1000px}",
    "html body #page .fo-lgx .fo-lgx-body{display:grid;grid-template-columns:minmax(0,1fr) 292px;gap:18px;align-items:start}",
    "html body #page .fo-lgx .fo-lgx-rail{margin-top:0}",
    "html body.fo-lgx-page #fo-sideart .fo-sa-map,html body.fo-lgx-page #fo-sideart .fo-sa-fig{width:calc(50vw - 524px)}}"
  ].join("\n");

  function mount() {
    try {
      var s = document.getElementById("fo-lt-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-lt-css"; s.textContent = CSS; }
      else s.textContent = CSS;
      document.body.appendChild(s);
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); });
  else setTimeout(mount, 0);

  window.foRenderLeagueTablePage = foRenderLeagueTablePage;
  // #/nation is the same league through its second door - anybody else's season
  window.foRenderNation = foRenderLeagueTablePage;
  window.__foLeagueTable = 1;
})();
