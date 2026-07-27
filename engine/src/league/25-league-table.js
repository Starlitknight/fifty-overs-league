// ---- 25-league-table.js — The League, the real one ---------------------------
// One design for every league in the world. #/league is your nation's table and
// #/nation?n=<id> is anybody else's - the SAME page, the same daylight almanack
// type, the same served data. There is no second-class league: the world runs
// nineteen of them under one set of rules, and they should read that way.
// The painted country portrait (map, art, boss) lives on at #/atlas.
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
  // EVERY LEAGUE LOOKS LIKE ITS OWN COUNTRY. One accent, one flag, one
  // painted horizon - the same almanack, wearing the nation's colours.
  var NAT_LINE = {
    eng: "The old game, played where it was written.",
    aus: "Hard light, hard cricket, no quarter given.",
    sub: "A billion eyes on every ball.",
    pak: "Raw pace and rawer nerve.",
    rsa: "The long summer and the southeaster.",
    win: "Calypso and thunder.",
    nzl: "Cricket under the long white cloud.",
    slk: "Spin, sorcery and sea air.",
    ned: "The low country, playing above itself.",
    ire: "Green, damp and defiant.",
    zim: "Flame lilies and hard yards.",
    afg: "Mountain fire, learned in exile.",
    bgd: "The tigers, and a country that roars with them.",
    nep: "Cricket on the roof of the world.",
    sco: "Highland steel, in a cold wind.",
    wal: "Dragons at the crease.",
    ken: "The rift valley game.",
    usa: "The new frontier of an old sport.",
    can: "True north, and a short summer to prove it."
  };

  // older saves recorded results before seasonNo existed on the record; a
  // stampless result belongs to this season exactly when the season's own
  // played-map points at its index
  function thisSeasonHas(r) {
    var cur = (App.seasonNo || 1);
    if (r.seasonNo != null) return r.seasonNo === cur;
    try {
      var P = (App.season && App.season.played) || {};
      for (var k in P) if (P[k] === r.ix) return true;
    } catch (e) {}
    return false;
  }

  function formBeads(name) {
    try {
      var seq = (App.results || []).filter(function (r) {
        return r && r.comp === "league" && r.result && r.result.winner !== undefined &&
          thisSeasonHas(r) && (r.home === name || r.away === name);
      }).slice(-5).map(function (r) {
        return r.result.winner === name ? "w" : r.result.winner === null ? "t" : "l";
      });
      return seq.map(function (k) {
        return "<i class='" + k + "'>" + k.toUpperCase() + "</i>";
      }).join("") || "<span class='none'>&mdash;</span>";
    } catch (e) { return ""; }
  }

  function hh(h) { return (h < 10 ? "0" : "") + h + ":00 UTC"; }

  // ---- THE MARGINS ARE THE COUNTRY --------------------------------------
  // A reading column on a wide screen leaves two empty gutters, and art
  // stretched behind a headline only makes the headline harder to read. So
  // the art moves out into the margins and becomes furniture: the nation's
  // painted map hangs as a framed plate on the left (a door to its atlas),
  // its own cricketer stands on the right. The header goes back to clean
  // paper, and a phone - which has no margins - sees neither.
  var ART_FOR = "", ART_KEY = "";
  function sideArt(natId) {
    try {
      var host = document.getElementById("fo-sideart");
      if (!host) {
        host = document.createElement("div");
        host.id = "fo-sideart";
        host.innerHTML =
          "<a class='fo-sa-map' href='#/atlas'><img alt='' loading='lazy' onerror=\"this.parentElement.style.display='none'\">" +
          "<span></span></a>" +
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
      // the page column has to sit ABOVE the art: <html> carries a dark
      // background of its own, so body paints its cream over anything at a
      // negative z-index. The margins ride at 0 and the column at 1.
      try { document.body.classList.add("fo-sa-on"); } catch (eB3) {}
      ART_FOR = location.hash || "";
    } catch (e) {}
  }
  window.__foSideArt = sideArt;
  // any page that does not claim the margins gets them back
  window.addEventListener("hashchange", function () {
    setTimeout(function () { if (ART_FOR !== (location.hash || "")) sideArt(null); }, 80);
  });

  function foRenderLeagueTablePage() {
    try {
      if (!ready()) return;
      if (!onPage()) return;
      var page = document.getElementById("page"); if (!page) return;
      var me = null; try { me = userTeam(); } catch (e) {}
      if (!me) return;
      // the atlas and the boss shrines paint themselves full-bleed and dark;
      // the almanack is daylight, so shed their marks on the way in
      try { document.body.classList.remove("fo-scb-on", "fo-drs-on", "fo-boss-on", "fo-ov-on", "fo-lore-on"); } catch (eB) {}

      var myNat = "";
      try { myNat = (window.__foLgAPI && window.__foLgAPI.nation && window.__foLgAPI.nation()) || ""; } catch (eNid) {}
      var natId = qparam("n") || myNat;
      if (!natName(natId)) natId = myNat;
      var own = (natId === myNat);
      var natNm = natName(natId) || "";

      var claim = null;
      try { claim = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (eC) {}
      var myClub = (claim && claim.country === natId && claim.club) || (own ? me.name : "");

      // THE CLUBS TABLE IS THE NAMING AUTHORITY. A snapshot is only rebuilt
      // when a round settles, so a club christened this morning would wear its
      // old name until tonight's cricket. These ten little rows are current.
      var nmBySlot = null, mgrBySlot = null;
      try {
        if (window.__foWorldNames) {
          nmBySlot = window.__foWorldNames.get(natId);
          if (window.__foWorldNames.mgr) mgrBySlot = window.__foWorldNames.mgr(natId);
          window.__foWorldNames.want(natId, function () { if (onPage()) foRenderLeagueTablePage(); });
        }
      } catch (eN0) {}

      // THE LEAGUE IS THE WORLD'S LEAGUE. The served snapshot is the table -
      // the real ten clubs and their real points. Absent the service we keep
      // the engine's own standings for your own nation so nothing breaks
      // offline; a rival nation simply waits for the wire.
      var rows = [], srvRows = null, snap = null, snapSeason = 0;
      try {
        if (window.__foWorldLg) {
          window.__foWorldLg.want(natId, function () { if (onPage()) foRenderLeagueTablePage(); });
          snap = window.__foWorldLg.get(natId);
        }
      } catch (eS) {}
      if (snap && snap.table && snap.table.length) {
        snapSeason = snap.seasonNo || 0;
        srvRows = snap.table.map(function (x) {
          var live = (nmBySlot && x.slot != null && nmBySlot[x.slot]) || x.name;
          // the record speaks the snapshot's name; the page speaks the current one
          return { nm: live, recNm: x.name, p: x.p, w: x.w, l: x.l, t: x.t, pts: x.pts, nrr: x.nrr, slot: x.slot, boss: !!x.boss,
            mine: !!(claim && claim.country === natId && claim.slot === x.slot) };
        });
        // form beads from the served results, newest last
        var seq = {};
        (snap.results || []).forEach(function (rr) {
          [rr.home, rr.away].forEach(function (nm) {
            if (!nm) return;
            (seq[nm] = seq[nm] || []).push(rr.winner === null ? "t" : rr.winner === nm ? "w" : "l");
          });
        });
        srvRows.forEach(function (r) {
          var s5 = (seq[r.recNm] || []).slice(-5);
          r.beads = s5.length
            ? s5.map(function (k) { return "<i class='" + k + "'>" + k.toUpperCase() + "</i>"; }).join("")
            : "<span class='none'>&mdash;</span>";
        });
      }
      if (srvRows) rows = srvRows;
      else if (own) { try { rows = leagueRows(); } catch (eL) { rows = []; } }

      var myPos = 0;
      rows.forEach(function (r, i) {
        if (r.mine != null ? r.mine : (r.nm === me.name)) myPos = i + 1;
      });
      var ord = function (n) { return n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"); };

      // EVERY ROW IS A DOOR, snapshot or no snapshot. The served table names
      // its slots outright; without it we still know which seat a club sits
      // in - from the names the world has published, and failing that from
      // the nation's own ten - so the club page is always one tap away.
      var slotOf = {};
      try { if (nmBySlot) for (var s0 in nmBySlot) slotOf[nmBySlot[s0]] = +s0; } catch (eN) {}
      try {
        var sides = window.__foPlanet && window.__foPlanet.sidesOf(natId);
        (sides || []).forEach(function (sd) { if (slotOf[sd.name] == null) slotOf[sd.name] = sd.slot; });
      } catch (eSd) {}
      try { if (claim && claim.country === natId && claim.club) slotOf[claim.club] = claim.slot; } catch (eCl) {}

      var body = rows.map(function (r, i) {
        var mine = r.mine != null ? r.mine : (r.nm === me.name);
        var slot = r.slot != null ? r.slot : slotOf[r.nm];
        // a human behind a club is the most useful fact on the page
        var human = (!mine && mgrBySlot && slot != null) ? mgrBySlot[slot] : "";
        var href = (natId && slot != null)
          ? "#/team?c=" + encodeURIComponent(natId) + "&s=" + slot
          : "#/milestones?c=" + encodeURIComponent(r.nm);
        return "<a class='fo-lt-row" + (mine ? " mine" : "") + "' href='" + href + "'>" +
          "<i>" + (i + 1) + "</i>" +
          "<span class='fo-lt-nm'><b>" + E(r.nm) +
          (mine ? " <u>you</u>" : (r.boss ? " <s>flagship</s>" : (human ? " <s class='hum'>&#9733; " + E(human) + "</s>" : ""))) + "</b>" +
          "<span class='fo-lt-beads'>" + (r.beads != null ? r.beads : formBeads(r.nm)) + "</span></span>" +
          "<em>" + (r.p | 0) + "</em><em class='w'>" + (r.w | 0) + "</em><em>" + (r.l | 0) + "</em>" +
          "<em class='nrr'>" + ((r.nrr >= 0 ? "+" : "") + (+r.nrr || 0).toFixed(2)) + "</em>" +
          "<b class='pts'>" + (r.pts | 0) + "</b></a>";
      }).join("");
      if (!body) {
        body = "<div class='fo-lt-wait'>The " + (natNm ? E(natNm) + " " : "") + "table is on its way from the World Service&hellip;</div>";
      }

      // ---- the day's cricket, straight off the world clock -----------------
      // Every nation plays at its own hour. The round in play, its five
      // fixtures, and - once the wire has them - the results they settled on.
      var pl = null, wt = null, cal = null, fx = [], hour = 0, state = "none", preDays = 0;
      try { pl = window.__foPlanet || null; wt = (window.__foWT && window.__foWT.serverFixtures) ? window.__foWT : null; } catch (eP) {}
      if (pl && wt) {
        try {
          var now = Date.now(), sv = wt.serverFixtures(natId, now);
          cal = sv.cal; fx = sv.fx || [];
          hour = pl.natHour(natId);
          var hNow = (now - (pl.EPOCH + pl.dayIx(now) * 86400000)) / 3600000;
          if (cal.seasonNo < 1 || cal.dayInSeason < 0) { state = "pre"; preDays = Math.max(1, -cal.dayInSeason); }
          else if (!fx.length) state = "none";
          else state = hNow < hour ? "up" : hNow < hour + (pl.LIVE_LEN || 3) ? "live" : "fin";
        } catch (eC2) { cal = null; }
      }
      // ONE NAME PER CLUB. The fixture mirror names its sides from the painted
      // world; the served table is the naming authority. Bind the fixtures to
      // the table by slot so a club never appears under two names on one page.
      var nameAt = function (side) {
        if (!side) return "";
        if (srvRows && side.slot != null) {
          for (var i2 = 0; i2 < srvRows.length; i2++) if (srvRows[i2].slot === side.slot) return srvRows[i2].nm;
        }
        return side.name;
      };
      // a result was banked under the name the club wore that day; the page
      // speaks its name today, so translate the record on the way out
      var liveOf = {};
      (srvRows || []).forEach(function (r) { if (r.recNm && r.recNm !== r.nm) liveOf[r.recNm] = r.nm; });
      var say = function (nm) { return liveOf[nm] || nm; };
      // one pass, longest name first: a club renamed to another club's old name
      // must not be renamed twice on its way through the line
      var sayRe = null;
      try {
        var keys = Object.keys(liveOf).sort(function (a, b) { return b.length - a.length; });
        if (keys.length) sayRe = new RegExp(keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|"), "g");
      } catch (eRe) { sayRe = null; }
      var sayLine = function (t) {
        var out = String(t || "");
        return sayRe ? out.replace(sayRe, function (m) { return liveOf[m] || m; }) : out;
      };
      // the round's own results, if the umpire has already banked them
      var roundRes = {};
      if (snap && cal) (snap.results || []).forEach(function (rr) {
        if (rr.round === cal.round) roundRes[say(rr.home) + "|" + say(rr.away)] = rr;
      });

      var todayHTML = "";
      if (state === "pre") {
        todayHTML = "<div class='fo-lt-note'>The season opens in " + preDays + " day" + (preDays === 1 ? "" : "s") +
          ". Ten clubs, all on nought, first ball at " + hh(hour) + ".</div>";
      } else if (fx.length) {
        var lab = state === "live" ? "Playing now" : state === "fin" ? "Today's results" : "Today's fixtures";
        todayHTML = "<div class='fo-lt-sec'><h2>" + lab + "</h2><span>Round " + cal.round + " &middot; " + hh(hour) + "</span></div>" +
          "<div class='fo-lt-fxlist'>" + fx.map(function (m, i) {
            var hN = nameAt(m.home), aN = nameAt(m.away);
            var got = roundRes[hN + "|" + aN];
            var mineFx = myClub && (hN === myClub || aN === myClub);
            var tail = got
              ? "<span class='fo-lt-fxres'>" + E(sayLine(got.text)) + "</span>"
              : "<span class='fo-lt-fxst" + (state === "live" ? " live" : "") + "'>" + (state === "live" ? "LIVE" : state === "fin" ? "Awaiting the wire" : hh(hour)) + "</span>";
            return "<a class='fo-lt-fx" + (mineFx ? " mine" : "") + "' href='#/watch?n=" + encodeURIComponent(natId) + "&f=" + i + "'>" +
              "<span class='fo-lt-fxt'><b>" + E(hN) + "</b><i>v</i><b>" + E(aN) + "</b></span>" +
              tail + "</a>";
          }).join("") + "</div>";
      } else if (cal) {
        todayHTML = "<div class='fo-lt-note'>No league cricket in " + (natNm ? E(natNm) : "this nation") + " today &mdash; the season is between rounds.</div>";
      }

      // ---- the record: every result already banked, newest first -----------
      var resHTML = "";
      if (snap && (snap.results || []).length) {
        var byRound = {};
        snap.results.forEach(function (rr) { (byRound[rr.round] = byRound[rr.round] || []).push(rr); });
        var rnds = Object.keys(byRound).map(Number).sort(function (a, b) { return b - a; }).slice(0, 3);
        resHTML = "<div class='fo-lt-sec'><h2>Results</h2><span>" + snap.roundsPlayed + " of " + (snap.rounds || 18) + " rounds played</span></div>" +
          rnds.map(function (rn) {
            return "<div class='fo-lt-rnd'><div class='fo-lt-rndh'>Round " + rn + "</div>" +
              byRound[rn].map(function (rr) {
                var hR = say(rr.home), aR = say(rr.away);
                var mineR = myClub && (hR === myClub || aR === myClub);
                return "<div class='fo-lt-res" + (mineR ? " mine" : "") + "'>" +
                  "<span class='fo-lt-fxt'><b>" + E(hR) + "</b><i>v</i><b>" + E(aR) + "</b></span>" +
                  "<span class='fo-lt-resv'>" + E(sayLine(rr.text) || (rr.winner ? say(rr.winner) + " won" : "Tied")) + "</span></div>";
              }).join("") + "</div>";
          }).join("");
      }

      // the painted country atlas (map + league boss) rides below the record
      var atlasCard = "";
      try {
        var artBase = (typeof FO_ART !== "undefined") ? FO_ART :
          ((location.pathname.indexOf("/client/") !== -1) ? "art/" : "client/art/");
        if (natId) {
          atlasCard = "<a class='fo-lt-atl' href='#/atlas?n=" + encodeURIComponent(natId) + "'>" +
            "<img src='" + artBase + "circuit/" + natId + ".webp' alt='' loading='lazy' onerror=\"this.style.display='none'\">" +
            "<span class='fo-lt-atlv'></span>" +
            "<span class='fo-lt-atlt'><i>The Grand Tour</i><b>The " + (natNm ? E(natNm) + " " : "") + "Atlas</b>" +
            "<em>The painted map, the grounds, the country &rsaquo;</em></span></a>";
        }
      } catch (eAtl) {}

      // one league is nineteen leagues: hop to any of them from here
      var hop = "<label class='fo-lt-hop'><span>Another league</span><select id='fo-lt-nat'>" +
        regions().map(function (r) {
          return "<option value='" + E(r.id) + "'" + (r.id === natId ? " selected" : "") + ">" + E(r.nm) + "</option>";
        }).join("") + "</select></label>";

      var kick = (own ? "Your league" : "The world &middot; away") + " &middot; Season " + (snapSeason || (cal && cal.seasonNo > 0 ? cal.seasonNo : 1)) +
        (own && myClub ? " &middot; " + E(myClub) + (myPos ? " &middot; " + ord(myPos) : "") : (rows.length ? " &middot; " + E(rows[0].nm) + " lead" : ""));

      // the nation's own colours: its accent, its flag, its painted country
      var reg = regionOf(natId) || {};
      var accent = reg.ac || "#C95532";
      var natArt = ART() + "circuit/" + (reg.bg || (natId + ".webp"));
      var line = NAT_LINE[natId] || "Ten clubs, one pennant.";

      sideArt(natId);
      page.innerHTML =
        "<div class='fo-lt' style='--nac:" + E(accent) + "'>" +
        "<div class='fo-lt-mast'>" +
        "<div class='fo-lt-mastin'>" +
        "<div class='fo-lt-kick'><img src='" + flagOf(natId) + "' alt='' onerror=\"this.style.display='none'\">" + kick + "</div>" +
        "<h1>The " + (natNm ? E(natNm) + " " : "") + "League</h1>" +
        "<p>" + E(line) + " Ten clubs, eighteen rounds, one pennant &mdash; two points a win, net run rate to break hearts.</p>" +
        hop +
        "</div></div>" +
        "<div class='fo-lt-head'><i>#</i><span>Club &middot; form</span><em>P</em><em>W</em><em>L</em><em>NRR</em><b>Pts</b></div>" +
        "<div class='fo-lt-list'>" + body + "</div>" +
        todayHTML +
        resHTML +
        atlasCard +
        "<div class='fo-lt-foot'>" +
        (own ? "<a href='#/fixtures'>My fixtures &rsaquo;</a>" : "<a href='#/league'>My own league &rsaquo;</a>") +
        "<a href='#/records'>The record book &rsaquo;</a><a href='#/planet'>World cricket &rsaquo;</a>" +
        "<a class='atlas' href='#/atlas?n=" + encodeURIComponent(natId) + "'>" + (natNm ? "The " + E(natNm) + " atlas" : "The nation atlas") + " &rsaquo;</a></div>" +
        "</div>";

      try {
        var sel = document.getElementById("fo-lt-nat");
        if (sel) sel.addEventListener("change", function () {
          var v = sel.value; if (!v) return;
          location.hash = (v === myNat) ? "#/league" : ("#/nation?n=" + encodeURIComponent(v));
        });
      } catch (eSel) {}
    } catch (e) { try { console.warn("foRenderLeagueTablePage", e); } catch (e2) {} }
  }

  var CSS = [
    "html body #page .fo-lt{position:relative;max-width:680px;margin:26px auto 44px;padding:0 14px;color:#141C28;--nac:#C95532}",
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
    "html body #page .fo-lt-mast{position:relative;overflow:hidden;background:linear-gradient(150deg,#FFFEFB,#F6F1E4 70%,#F0E9D6) !important;border:1px solid rgba(20,28,40,.1);border-radius:22px;box-shadow:0 22px 50px rgba(30,38,52,.12)}",
    "html body #page .fo-lt-mast:before{content:'';position:absolute;left:0;right:0;top:0;height:4px;background:var(--nac);z-index:2}",
    "html body #page .fo-lt-mastin{position:relative;padding:26px 28px 22px}",
    "html body #page .fo-lt-kick{display:flex;align-items:center;gap:8px;font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:#8A3A1B;flex-wrap:wrap}",
    "html body #page .fo-lt-kick img{width:22px;height:15px;object-fit:cover;border-radius:2px;box-shadow:0 1px 4px rgba(20,28,40,.3)}",
    "html body #page .fo-lt-kick:after{content:'';display:block;width:100%;border-top:2px solid var(--nac);margin-top:5px}",
    "html body #page .fo-lt-mast h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:38px;letter-spacing:-.015em;margin:8px 0 8px;color:#141C28;line-height:1.02}",
    "html body #page .fo-lt-mast p{font:italic 420 13.5px/1.6 'Fraunces',Georgia,serif;color:rgba(20,28,40,.6);margin:0;max-width:52ch}",
    "html body #page .fo-lt-hop{display:flex;align-items:center;gap:9px;margin-top:16px;flex-wrap:wrap}",
    "html body #page .fo-lt-hop span{font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(20,28,40,.5)}",
    "html body #page .fo-lt-hop select{background:#FFFEFC !important;color:#141C28 !important;border:1px solid rgba(20,28,40,.18);border-radius:999px;padding:7px 12px;font:600 12px/1 Inter,sans-serif;-webkit-appearance:menulist;appearance:menulist}",
    "html body #page .fo-lt-head{display:grid;grid-template-columns:24px minmax(0,1fr) 28px 28px 28px 52px 34px;gap:8px;align-items:baseline;padding:14px 16px 6px;font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.45)}",
    "html body #page .fo-lt-head em,html body #page .fo-lt-head b{text-align:right;font-style:normal}",
    "html body #page .fo-lt-list{display:flex;flex-direction:column;gap:6px}",
    "html body #page .fo-lt-wait{background:#FFFEFC;border:1px dashed rgba(20,28,40,.18);border-radius:13px;padding:18px 16px;font:italic 420 13px/1.5 'Fraunces',Georgia,serif;color:rgba(20,28,40,.6);text-align:center}",
    "html body #page .fo-lt-row{display:grid;grid-template-columns:24px minmax(0,1fr) 28px 28px 28px 52px 34px;gap:8px;align-items:center;background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:13px;padding:10px 16px;text-decoration:none;color:#141C28;box-shadow:0 4px 14px rgba(30,38,52,.06);transition:border-color .15s ease,transform .12s ease}",
    "html body #page .fo-lt-row:hover{border-color:var(--nac);transform:translateY(-1px);text-decoration:none}",
    "html body #page .fo-lt-row.mine{border-left:3px solid var(--nac)}",
    "html body #page .fo-lt>*{position:relative;z-index:1}",
    "html body #page .fo-lt-row>i{font:700 12px/1 Inter,sans-serif;color:rgba(20,28,40,.45);font-style:normal;font-variant-numeric:tabular-nums}",
    "html body #page .fo-lt-nm{min-width:0}",
    "html body #page .fo-lt-nm b{display:block;font:600 13.5px/1.25 Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "html body #page .fo-lt-nm b u{text-decoration:none;font:700 8.5px/1 Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#B44A22;margin-left:5px;vertical-align:1px}",
    "html body #page .fo-lt-nm b s{text-decoration:none;font:700 8.5px/1 Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:rgba(20,28,40,.38);margin-left:5px;vertical-align:1px}",
    "html body #page .fo-lt-nm b s.hum{color:#1F6F4A;background:rgba(31,111,74,.1);border-radius:5px;padding:3px 5px}",
    "html body #page .fo-lt-beads{display:flex;gap:3px;margin-top:4px}",
    "html body #page .fo-lt-beads i{width:15px;height:15px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;font:800 8.5px/1 Inter,sans-serif;font-style:normal}",
    "html body #page .fo-lt-beads i.w{background:rgba(31,158,114,.14);color:#177A57}",
    "html body #page .fo-lt-beads i.l{background:rgba(200,60,58,.1);color:#B23230}",
    "html body #page .fo-lt-beads i.t{background:rgba(20,28,40,.07);color:rgba(20,28,40,.55)}",
    "html body #page .fo-lt-beads .none{font-size:10px;color:rgba(20,28,40,.35)}",
    "html body #page .fo-lt-row em{font:500 12.5px/1 Inter,sans-serif;color:rgba(20,28,40,.6);text-align:right;font-style:normal;font-variant-numeric:tabular-nums}",
    "html body #page .fo-lt-row em.w{color:#177A57;font-weight:700}",
    "html body #page .fo-lt-row em.nrr{font-size:11.5px}",
    "html body #page .fo-lt-row b.pts{font-family:Oswald,sans-serif;font-weight:700;font-size:16px;text-align:right;font-variant-numeric:tabular-nums;color:#141C28}",
    // --- the day's cricket + the record, same daylight almanack ------------
    "html body #page .fo-lt-sec{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:26px 0 10px;padding:0 4px;flex-wrap:wrap}",
    "html body #page .fo-lt-sec h2{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:20px;margin:0;color:#141C28}",
    "html body #page .fo-lt-sec span{font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.45)}",
    "html body #page .fo-lt-note{margin-top:20px;background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:13px;padding:15px 18px;font:italic 420 13.5px/1.55 'Fraunces',Georgia,serif;color:rgba(20,28,40,.65)}",
    "html body #page .fo-lt-fxlist{display:flex;flex-direction:column;gap:6px}",
    "html body #page .fo-lt-fx{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:13px;padding:11px 16px;text-decoration:none;color:#141C28;box-shadow:0 4px 14px rgba(30,38,52,.06)}",
    "html body #page .fo-lt-fx:hover{border-color:rgba(217,85,42,.5);text-decoration:none}",
    "html body #page .fo-lt-fx.mine,html body #page .fo-lt-res.mine{border-left:3px solid var(--nac)}",
    "html body #page .fo-lt-fxt{display:flex;align-items:center;gap:7px;min-width:0;flex-wrap:wrap}",
    "html body #page .fo-lt-fxt b{font:600 13px/1.3 Inter,sans-serif}",
    "html body #page .fo-lt-fxt i{font:italic 400 11.5px/1 'Fraunces',Georgia,serif;color:rgba(20,28,40,.4)}",
    "html body #page .fo-lt-fxst{font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.45);white-space:nowrap}",
    "html body #page .fo-lt-fxst.live{color:#B23230}",
    "html body #page .fo-lt-fxres{font:italic 420 12px/1.4 'Fraunces',Georgia,serif;color:rgba(20,28,40,.62);text-align:right}",
    "html body #page .fo-lt-rnd{margin-bottom:12px}",
    "html body #page .fo-lt-rndh{font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.4);padding:0 4px 6px}",
    "html body #page .fo-lt-res{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#FFFEFC;border:1px solid rgba(20,28,40,.08);border-radius:11px;padding:9px 16px;margin-bottom:5px}",
    "html body #page .fo-lt-resv{font:italic 420 12px/1.4 'Fraunces',Georgia,serif;color:rgba(20,28,40,.6);text-align:right}",
    "html body #page .fo-lt-atl{position:relative;display:block;margin-top:22px;border-radius:18px;overflow:hidden;min-height:120px;border:1px solid rgba(20,28,40,.16);box-shadow:0 16px 38px rgba(30,38,52,.16);text-decoration:none}",
    "html body #page .fo-lt-atl img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 30%}",
    "html body #page .fo-lt-atlv{position:absolute;inset:0;background:linear-gradient(92deg,rgba(7,22,46,.82) 0%,rgba(7,22,46,.5) 46%,rgba(7,22,46,.08) 100%)}",
    "html body #page .fo-lt-atlt{position:relative;display:block;padding:20px 22px 18px;max-width:34ch}",
    "html body #page .fo-lt-atlt i{display:block;font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#E8B96A;font-style:normal}",
    "html body #page .fo-lt-atlt b{display:block;font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:21px;color:#FFFEFC;margin-top:6px;line-height:1.1}",
    "html body #page .fo-lt-atlt em{display:block;font:italic 420 12.5px/1.45 'Fraunces',Georgia,serif;color:rgba(255,254,252,.82);margin-top:5px}",
    "html body #page .fo-lt-atl:hover{border-color:rgba(217,85,42,.55)}",
    "html body #page .fo-lt-foot{display:flex;gap:10px;justify-content:space-between;margin-top:18px;flex-wrap:wrap}",
    "html body #page .fo-lt-foot a{font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
    "html body #page .fo-lt-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5);text-decoration:none}",
    "@media(max-width:520px){html body #page .fo-lt-mast h1{font-size:30px}",
    "html body #page .fo-lt-head,html body #page .fo-lt-row{grid-template-columns:20px minmax(0,1fr) 24px 44px 30px}",
    "html body #page .fo-lt-fx,html body #page .fo-lt-res{flex-direction:column;align-items:flex-start;gap:5px}",
    "html body #page .fo-lt-fxres,html body #page .fo-lt-resv{text-align:left}",
    "html body #page .fo-lt-head em:nth-of-type(2),html body #page .fo-lt-row em:nth-of-type(2),html body #page .fo-lt-head em:nth-of-type(3),html body #page .fo-lt-row em:nth-of-type(3){display:none}}"
  ].join("\n");

  function mount() {
    try {
      var s = document.getElementById("fo-lt-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-lt-css"; s.textContent = CSS; }
      document.body.appendChild(s);
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); });
  else setTimeout(mount, 0);

  window.foRenderLeagueTablePage = foRenderLeagueTablePage;
  // #/nation is the same almanack through its second door - any nation's league
  window.foRenderNation = foRenderLeagueTablePage;
  window.__foLeagueTable = 1;
})();
