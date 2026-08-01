/* ============================================================================
   THE CLUB DOSSIER (#/team?c={country}&s={slot}) — every club's public face.

   A league of blanks has no strategy in it: you cannot fear a side you know
   nothing about, or plan a season against one. So this page tells you what a
   county's own handbook would - the side's batting, its attack and its hands,
   then every man: how old, which hand, what he bowls, what he costs, what he
   is worth, what his career says and what the game has made of him.

   The page is built like a club programme: a full-bleed navy plate with the
   country behind it and its cricketer standing at the edge, a ticket of
   numbers across the fold, then the First XI card and the roster beneath.

   What stays private is the coaching book: the fifteen raw skills, the
   training plan, the progress toward the next jump. A scout may read a man's
   class from the boundary; he may not read the fifteen numbers underneath.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foClubPg) return; window.__foClubPg = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function cx() { return window.__foCxAPI || null; }
  function ART() { return (typeof FO_ART !== "undefined") ? FO_ART : "client/art/"; }
  function flagOf(rid) { try { return ART() + "flags/" + cx().flagFile(rid) + ".svg"; } catch (e) { return ""; } }
  function region(rid) { try { return (cx().regions() || []).filter(function (x) { return x.id === rid; })[0] || null; } catch (e) { return null; } }
  function natName(rid) { var r = region(rid); return (r && r.nm) || rid; }
  function qs() {
    var q = {}, m = (location.hash || "").split("?")[1] || "";
    m.split("&").forEach(function (kv) { var p = kv.split("="); if (p[0]) q[p[0]] = decodeURIComponent(p[1] || ""); });
    return q;
  }
  function claim() {
    try { return window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (e) { return null; }
  }
  function money(n) {
    n = Math.round(+n || 0);
    if (Math.abs(n) >= 1000000) return "$" + (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + "M";
    if (Math.abs(n) >= 1000) return "$" + Math.round(n / 1000) + "K";
    return "$" + n;
  }
  function num(n) { return String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function ordn(n) { return n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4)] || "th"); }

  function jwt() { try { return (window.__foJWT && window.__foJWT()) || ""; } catch (e) { return ""; } }
  function rpc(fn, args) {
    return fetch(SB_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: "Bearer " + (jwt() || SB_ANON), "content-type": "application/json" },
      body: JSON.stringify(args || {})
    }).then(function (r) { return r.text().then(function (t) {
      var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {}
      if (!r.ok) throw new Error((d && (d.message || d.hint)) || t || ("HTTP " + r.status));
      return d;
    }); });
  }

  // ---- THE CHALLENGE ---------------------------------------------------------
  // A friendly is arranged where you meet the club, not in a form on a
  // settings page: you read their side, you fancy it, you name an hour. The
  // state lives here rather than in the markup because the dossier repaints
  // four times as the club, the squad and the honours land - a half-typed
  // kick-off must survive all four.
  var CH = { key: "", when: "", msg: "", list: null, busy: false };
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function dtLocal(ms) {
    var d = new Date(ms);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) +
      "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  var DW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function whenTxt(ms) {
    try {
      var d = new Date(ms);
      return DW[d.getDay()] + " " + d.getDate() + " " + MO[d.getMonth()] + " &middot; " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    } catch (e) { return ""; }
  }

  // every friendly this manager has against THIS club - the post is filtered
  // by the pair's coordinates rather than by name, so two clubs sharing a name
  // in different nations can never show each other's fixtures
  function loadTies(key, cid, slot) {
    rpc("world_my_friendlies", { p_country: cid, p_slot: slot })
      .then(function (rows) {
        if (CH.key !== key) return;
        CH.list = Array.isArray(rows) ? rows : [];
        paintTies();
      })
      .catch(function () { if (CH.key === key) { CH.list = []; paintTies(); } });
  }
  function tieRows() {
    if (!CH.list || !CH.list.length) return "";
    return CH.list.map(function (f) {
      var when = f.playAtMs ? whenTxt(f.playAtMs) : "";
      var live = f.playAtMs && Date.now() >= f.playAtMs;
      var cls = "fo-cp-fr", state, act = "";
      if (f.incoming) {
        cls += " in"; state = "they have challenged you";
        act = "<button type='button' class='fo-cp-fyes' data-id='" + f.id + "'>Accept</button>" +
              "<button type='button' class='fo-cp-fno' data-id='" + f.id + "'>Decline</button>";
      } else if (f.status === "offered") {
        state = "awaiting their reply";
      } else if (f.status === "accepted") {
        cls += " on"; state = live ? "in play" : "arranged";
        if (live) act = "<button type='button' class='fo-cp-fwatch' data-id='" + f.id + "'>Watch</button>";
      } else if (f.status === "played") {
        cls += " done"; state = f.text || "played";
        act = "<button type='button' class='fo-cp-fwatch' data-id='" + f.id + "'>Watch it back</button>";
      } else {
        cls += " dim"; state = f.status;
      }
      return "<div class='" + cls + "'><b>" + (f.mine ? "You challenged them" : "They challenged you") + "</b>" +
        "<i>" + when + (state ? " &middot; " + E(state) : "") + "</i>" +
        (act ? "<span>" + act + "</span>" : "") + "</div>";
    }).join("");
  }
  function paintTies() {
    var host = document.getElementById("fo-cp-chlist"); if (!host) return;
    host.innerHTML = tieRows();
    host.querySelectorAll(".fo-cp-fwatch").forEach(function (b) {
      b.addEventListener("click", function () { try { window.foWtFriendly(+b.getAttribute("data-id")); } catch (e) {} });
    });
    var answer = function (b, accept) {
      b.disabled = true;
      rpc("world_friendly_respond", { p_id: +b.getAttribute("data-id"), p_accept: accept })
        .then(function () { loadTies(CH.key, CH.key.split(":")[0], +CH.key.split(":")[1]); })
        .catch(function (e) { b.disabled = false; chSay(String(e.message).slice(0, 120)); });
    };
    host.querySelectorAll(".fo-cp-fyes").forEach(function (b) { b.addEventListener("click", function () { answer(b, true); }); });
    host.querySelectorAll(".fo-cp-fno").forEach(function (b) { b.addEventListener("click", function () { answer(b, false); }); });
  }
  function chSay(t) {
    CH.msg = t;
    var el = document.getElementById("fo-cp-chmsg"); if (el) el.innerHTML = E(t);
  }

  var CLUB_CACHE = {}, SQ_CACHE = {}, HON_CACHE = null;
  function grab(url, cb) {
    fetch(SB_URL + url, { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) { cb(rows && rows[0] ? rows[0] : null); })
      .catch(function () { cb(null); });
  }
  function fetchClub(cid, slot, cb) {
    var k = cid + ":" + slot;
    if (CLUB_CACHE[k]) { cb(CLUB_CACHE[k]); return; }
    grab("/rest/v1/world_clubs?country_id=eq." + encodeURIComponent(cid) + "&slot=eq." + slot + "&select=name,ground,is_boss,manager,identity,academy",
      function (row) { if (row) CLUB_CACHE[k] = row; cb(row); });
  }
  function fetchSquad(cid, slot, cb) {
    var k = cid + ":" + slot;
    if (SQ_CACHE[k]) { cb(SQ_CACHE[k]); return; }
    grab("/rest/v1/world_squads?country_id=eq." + encodeURIComponent(cid) + "&slot=eq." + slot +
      "&select=players,wage_bill,team_batting,team_bowling,team_fielding",
      function (row) { if (row) SQ_CACHE[k] = row; cb(row); });
  }
  function fetchHonours(cb) {
    if (HON_CACHE) { cb(HON_CACHE); return; }
    grab("/rest/v1/world_snapshots?key=eq.honours&select=body",
      function (row) { HON_CACHE = (row && row.body) || { seasons: {} }; cb(HON_CACHE); });
  }

  // ROLE, in the language of a scorecard rather than a database
  var ROLE_WORD = { opener: "Opener", top: "Top order", topOrder: "Top order", middle: "Middle order",
    middleOrder: "Middle order", finisher: "Finisher", allRounder: "All-rounder", allrounder: "All-rounder",
    wicketkeeper: "Wicketkeeper", keeper: "Wicketkeeper", seamFast: "Fast bowler",
    seamFastMedium: "Seam medium", seamMedium: "Medium pace", seamer: "Seam bowler",
    fingerSpin: "Finger spin", wristSpin: "Wrist spin", spinner: "Spinner", bowler: "Bowler", tail: "Lower order" };
  var TALENT_WORD = { anchor: "Anchor", safeHands: "Safe hands", bigHitter: "Big hitter", deathBowler: "Death bowler",
    newBall: "New ball", partnership: "Partnership", closer: "Closer", enforcer: "Enforcer",
    gun: "Gun fielder", nightwatch: "Nightwatchman", spinKing: "Spin king", swingKing: "Swing king",
    powerplay: "Powerplay", clutch: "Clutch", ironman: "Iron man" };
  function roleWord(r) { return ROLE_WORD[r] || (r ? String(r).replace(/([A-Z])/g, " $1").replace(/^./, function (c) { return c.toUpperCase(); }) : "Cricketer"); }
  function talentWord(t) { return TALENT_WORD[t] || String(t || "").replace(/([A-Z])/g, " $1").replace(/^./, function (c) { return c.toUpperCase(); }); }
  var NAT_ID = { England: "eng", Australia: "aus", India: "sub", Pakistan: "pak", "South Africa": "rsa",
    "New Zealand": "nzl", "Sri Lanka": "slk", "West Indies": "win", Ireland: "ire", Netherlands: "ned",
    Zimbabwe: "zim", Afghanistan: "afg", Bangladesh: "bgd", Nepal: "nep", Scotland: "sco", Wales: "wal",
    Kenya: "ken", "United States": "usa", USA: "usa", Canada: "can" };
  function natFlag(n) { var id = NAT_ID[n]; return id ? flagOf(id) : ""; }
  // FORM as the game's own ladder, drawn as six lamps
  var FORMW = ["abysmal", "poor", "shaky", "steady", "good", "strong", "excellent"];
  function formDots(w) {
    var ix = FORMW.indexOf(String(w || "steady").toLowerCase());
    var lit = Math.max(1, Math.min(6, Math.round(((ix < 0 ? 3 : ix) + 1) * 6 / 7)));
    var out = "";
    for (var i = 0; i < 6; i++) out += "<i" + (i < lit ? " class='on'" : "") + "></i>";
    return out;
  }
  // the painted figure a man wears on his card, by the shipped resolver
  function faceOf(p) {
    try {
      if (window.foPkArt) return ART() + window.foPkArt({
        name: p.name, nat: p.nat, role: p.role, keeper: p.keeper,
        bowlTypeFull: p.type, bowlType: (p.type && p.type !== "none") ? p.type : null
      });
    } catch (e) {}
    return "";
  }
  // the game's own painted silhouettes, not emoji: a batter, a keeper, a
  // seamer at the crease, a spinner in his action
  function roleIcon(p) {
    var f = "bat.png";
    if (p.keeper) f = "keeper.png";
    else if (/wrist/i.test(p.type || "")) f = "spin-wrist.png";
    else if (/spin/i.test(p.type || "")) f = "spin-finger.png";
    else if (p.role === "allRounder") f = "ar.png";
    else if (/seam|pace|fast|medium/i.test(p.type || "")) f = "pace1.png";
    return ART() + f;
  }
  function roleGlyph(p) {
    return "<img class='fo-cp-ico' src='" + roleIcon(p) + "' alt='' onerror=\"this.style.display='none'\">";
  }

  var SORTS = [["ovr", "Strongest first"], ["age", "Youngest first"], ["wage", "Best paid"], ["name", "By name"]];

  // ---- your own men, in the shape the public view uses ----------------------
  // The world's squad is already the game's squad (league/37 adopts it), so for
  // your own club the local side IS the served side - read it here and the two
  // pages cannot drift, even before the world has been reached this session.
  function ownSquad() {
    try {
      var t = userTeam(); if (!t || !(t.players || []).length) return null;
      var ag = function (fn, p) { try { return Math.round(fn(p) || 0); } catch (e) { return 0; } };
      var list = t.players.map(function (p) {
        var bowls = !!(p.bowlType && !/does not bowl/i.test(p.btLabel || ""));
        return { name: p.name, nat: p.nat, age: p.age, role: p.role, hand: p.hand,
          bowl: p.btLabel, type: p.bowlTypeFull, keeper: !!p.keeper, rating: p.rating,
          ovr: (window.foPkOvr ? window.foPkOvr(p) : Math.round((p.rating || 0) / 1000)),
          batting: ag(aggBat, p), bowling: bowls ? ag(aggBowl, p) : 0,
          fielding: (p.keeper ? ag(aggKeep, p) : ag(aggField, p)),
          wage: p.wage, value: p.fee, talents: p.talents || [],
          exp: p.expWord, form: p.formWord, fatigue: p.fatWord || p.fatigue, career: p.career || {} };
      });
      list.sort(function (a, b) { return (b.ovr || 0) - (a.ovr || 0); });
      var mean = function (arr) { return arr.length ? Math.round(arr.reduce(function (a, b) { return a + b; }, 0) / arr.length) : 0; };
      var byBat = list.slice().sort(function (a, b) { return b.batting - a.batting; }).slice(0, 7).map(function (x) { return x.batting; });
      var byBowl = list.slice().sort(function (a, b) { return b.bowling - a.bowling; }).slice(0, 5).map(function (x) { return x.bowling; });
      return { players: list, bill: list.reduce(function (a, p) { return a + (+p.wage || 0); }, 0),
        tBat: mean(byBat), tBowl: mean(byBowl), tFld: mean(list.map(function (x) { return x.fielding; })) };
    } catch (e) { return null; }
  }
  // your men open their full dossier; a rival's opens his card
  function playerHref(cid, slot, mine, nm) {
    return mine ? "#/player?n=" + encodeURIComponent(nm)
      : "#/player?c=" + encodeURIComponent(cid) + "&s=" + slot + "&n=" + encodeURIComponent(nm);
  }

  window.foRenderClubPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    foClubCss();
    try { document.body.classList.remove("fo-ov-on", "fo-boss-on", "fo-scb-on", "fo-drs-on", "fo-wt-on", "fo-lore-on"); } catch (e) {}
    // the plate carries its own country art, so the page margins stay clear
    try { if (window.__foSideArt) window.__foSideArt(null); } catch (eSa) {}
    var q = qs(), cid = q.c || "eng", slot = parseInt(q.s || "0", 10) || 0;
    var cl = claim();
    var isMine = !!(cl && cl.country === cid && cl.slot === slot);
    var tab = q.t || "squad", sortKey = q.o || "ovr";

    var lg = null; try { lg = window.__foWorldLg ? window.__foWorldLg.get(cid) : null; } catch (e) {}
    try { if (window.__foWorldLg) window.__foWorldLg.want(cid, function () { if ((location.hash || "").indexOf("#/team") === 0) window.foRenderClubPage(); }); } catch (e) {}
    var rk = null; try { rk = JSON.parse(localStorage.getItem("fo_world_rk") || "null"); } catch (e) {}

    // a different club is a different challenge: forget the last one's hour
    var chKey = cid + ":" + slot;
    var canChallenge = !!(cl && !isMine && jwt());
    if (CH.key !== chKey) {
      var d0 = new Date(Date.now() + 3 * 3600000); d0.setMinutes(0, 0, 0);
      CH = { key: chKey, when: dtLocal(d0.getTime()), msg: "", list: null, busy: false, at: 0 };
    }
    // the dossier paints four times per visit as the club, the squad and the
    // honours land - ask the post once, but ask again on a real return
    if (canChallenge && Date.now() - (CH.at || 0) > 30000) { CH.at = Date.now(); loadTies(chKey, cid, slot); }

    var paint = function (info, sq, hon) {
      // A CLUB LIVES IN ONE OF TWO TABLES. Reading table alone left every
      // Division Two club nameless, positionless and with the wrong opponents
      // on its card - the whole lower flight is in table2.
      var lgRows = lg ? (lg.table || []).concat(lg.table2 || []) : [];
      var name = (info && info.name) || (lgRows.filter(function (t) { return t.slot === slot; })[0] || {}).name;
      if (!name) { try { name = ((window.__foWorldNames && window.__foWorldNames.get(cid)) || {})[slot]; } catch (eN) {} }
      if (!name) {
        try {
          var sd = (window.__foPlanet && window.__foPlanet.sidesOf(cid) || []).filter(function (x) { return x.slot === slot; })[0];
          if (sd) name = sd.name;
        } catch (eS) {}
      }
      if (!name) name = "A world club";
      var boss = !!(info && info.is_boss);
      var mgr = info && info.manager;
      var ident = (info && info.identity) || {};
      var players = (sq && sq.players) || [];
      var bill = (sq && +sq.wage_bill) || 0;
      var tBat = (sq && +sq.team_batting) || 0, tBowl = (sq && +sq.team_bowling) || 0, tFld = (sq && +sq.team_fielding) || 0;
      // ONE CLUB, ONE SQUAD. For your own club the game already holds the
      // world's men in full - read them, not the public view, so this page and
      // the squad page can never show two different sides.
      if (isMine) {
        var ownSq = ownSquad();
        if (ownSq && ownSq.players.length) {
          players = ownSq.players; bill = ownSq.bill;
          tBat = ownSq.tBat; tBowl = ownSq.tBowl; tFld = ownSq.tFld;
        }
      }

      var rkRow = rk && rk.clubs ? rk.clubs.filter(function (x) { return x.country === cid && x.slot === slot; })[0] : null;
      // and a club's position is its place in ITS OWN division, not in a
      // sixteen-club list nobody plays in
      var ownTbl = ((lg && lg.table) || []).filter(function (t) { return t.slot === slot; }).length
        ? (lg.table || []) : ((lg && lg.table2) || []);
      var tRow = ownTbl.filter(function (t) { return t.slot === slot; })[0] || null;
      var pos = tRow ? ownTbl.indexOf(tRow) + 1 : 0;

      var played = [];
      if (lg && lg.results && name) played = lg.results.filter(function (r) { return r.home === name || r.away === name; });
      var form = played.slice(-5).reverse().map(function (r) {
        var w = r.winner === null ? "t" : r.winner === name ? "w" : "l";
        return "<i class='" + w + "'>" + w.toUpperCase() + "</i>";
      }).join("");

      // their remaining fixtures, off the schedule the umpire itself uses
      var fixtures = [];
      try {
        var wt = window.__foWT, pl = window.__foPlanet;
        if (wt && wt.schedMirror && pl) {
          var cal = wt.serverCal(Date.now());
          var nmOv = (window.__foWorldNames && window.__foWorldNames.get(cid)) || {};
          var nameAt = function (s2) {
            if (nmOv[s2]) return nmOv[s2];
            var row = lgRows.filter(function (t) { return t.slot === s2; })[0];
            if (row) return row.name;
            try { return (pl.sidesOf(cid) || []).filter(function (x) { return x.slot === s2; })[0].name; } catch (e3) { return "?"; }
          };
          var rounds = wt.schedMirror(cid, Math.max(1, cal.seasonNo));
          for (var ri = Math.max(0, cal.round - 1); ri < rounds.length && fixtures.length < 5; ri++) {
            for (var fi = 0; fi < rounds[ri].length; fi++) {
              var pr = rounds[ri][fi];
              if (pr[0] !== slot && pr[1] !== slot) continue;
              var home = pr[0] === slot;
              fixtures.push({ round: ri + 1, home: home, foe: nameAt(home ? pr[1] : pr[0]),
                foeSlot: home ? pr[1] : pr[0], now: (ri + 1) === cal.round });
            }
          }
        }
      } catch (eFx) {}

      var noted = [];
      if (lg && lg.stats) {
        (lg.stats.bat || []).forEach(function (x) { if (x.club === name) noted.push({ n: x.name, w: num(x.runs) + " runs", d: "at " + x.sr + " per hundred balls" }); });
        (lg.stats.bowl || []).forEach(function (x) { if (x.club === name) noted.push({ n: x.name, w: x.wkts + " wickets", d: "at " + x.econ + " an over" }); });
      }
      var shelf = [];
      if (hon && hon.seasons) Object.keys(hon.seasons).sort().forEach(function (sk) {
        var s5 = hon.seasons[sk], sn = sk.slice(1);
        if (s5.league && s5.league[cid] === name) shelf.push("&#127942; " + E(natName(cid)) + " champions &middot; Season " + sn);
        if (s5.championsCup === name) shelf.push("&#127942; CHAMPIONS CUP &middot; Season " + sn);
      });

      var natArt = ART() + "circuit/" + ((region(cid) || {}).bg || (cid + ".webp"));
      var figure = ART() + "circuit/boss-" + cid + "-cutout.webp";
      var crest = ""; try { if (boss) crest = cx().crest(cid) || ""; } catch (eC2) {}
      var tagline = boss ? "The league's flagship &mdash; never for hire"
        : mgr ? "Managed by " + E(mgr)
        : "Unmanaged &mdash; a steady club of the shires";

      // ---- the ticket of numbers across the fold ---------------------------
      var meter = function (label, v, icon) {
        return "<div class='fo-cp-m'><img class='ic' src='" + ART() + icon + "' alt='' onerror=\"this.style.display='none'\">" +
          "<div class='mv'><i>" + label + "</i><b>" + (v || "&mdash;") + "</b>" +
          "<span class='bar'><u style='width:" + Math.max(3, Math.min(100, v)) + "%'></u></span></div></div>";
      };
      var chip = function (label, v) {
        return "<div class='fo-cp-c'><div class='mv'><i>" + label + "</i><b>" + v + "</b></div></div>";
      };
      var ticket =
        meter("Batting", tBat, "bat.png") + meter("Bowling", tBowl, "pace1.png") + meter("Fielding", tFld, "keeper.png") +
        "<span class='fo-cp-div'></span>" +
        chip("League", pos ? ordn(pos).toUpperCase() : "&mdash;") +
        chip("Squad", players.length || "&mdash;") +
        chip("Wage", bill ? money(bill) : "&mdash;");

      // ---- the roster ------------------------------------------------------
      var sorted = players.slice();
      if (sortKey === "age") sorted.sort(function (a, b) { return (a.age || 99) - (b.age || 99); });
      else if (sortKey === "wage") sorted.sort(function (a, b) { return (b.wage || 0) - (a.wage || 0); });
      else if (sortKey === "name") sorted.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });

      // the red star, on a rival's men as on your own: a club dossier that does
      // not say who is an international is hiding the thing you scout for
      var natStar = function (nm2) {
        try { return window.foNatStar ? window.foNatStar(nm2, slot, { rid: cid }) : ""; } catch (eNs) { return ""; }
      };
      var star = sorted[0];
      var starCard = star ? "<a class='fo-cp-star' href='" + playerHref(cid, slot, isMine, star.name) + "'>" +
        "<img class='fo-cp-face' src='" + faceOf(star) + "' alt='' onerror=\"this.style.display='none'\">" +
        "<div class='fo-cp-starin'>" +
        "<div class='fo-cp-starn'>" + (natFlag(star.nat) ? "<img src='" + natFlag(star.nat) + "' alt='' onerror=\"this.style.display='none'\">" : "") +
        "<b>" + E(star.name) + natStar(star.name) + "</b></div>" +
        "<div class='fo-cp-starr'>" + E(roleWord(star.role)) + "</div>" +
        "<div class='fo-cp-starf'><i>Form</i><span class='fo-cp-dots'>" + formDots(star.form) + "</span></div>" +
        "<div class='fo-cp-startags'>" + (star.talents || []).slice(0, 2).map(function (t) {
          return "<em>" + E(talentWord(t)) + "</em>"; }).join("") + "</div>" +
        "</div>" +
        "<div class='fo-cp-starnums'>" +
        "<div class='fo-cp-starovr'><i>OVR</i><b>" + (star.ovr || "&mdash;") + "</b></div>" +
        "<div class='fo-cp-starval'><i>Value</i><b>" + money(star.value) + "</b></div>" +
        "</div></a>" : "";

      var rosterRows = sorted.slice(1).map(function (p, i) {
        return "<a class='fo-cp-row' href='" + playerHref(cid, slot, isMine, p.name) + "'>" +
          "<span class='rk'>" + (i + 2) + "</span>" +
          "<span class='rl' title='" + E(roleWord(p.role)) + "'>" + roleGlyph(p) + "</span>" +
          "<span class='nm'><b>" + E(p.name) + natStar(p.name) + "</b><i>" + E(p.bowl && p.bowl !== "Does not bowl" ? p.bowl : roleWord(p.role)) + "</i></span>" +
          "<span class='ov'>" + (p.ovr || "&mdash;") + "</span>" +
          "<span class='fm'>" + formDots(p.form) + "</span>" +
          "<span class='hd'>" + (p.hand === "L" ? "LHB" : "RHB") + "</span>" +
          "<span class='wg'>" + money(p.wage) + "</span>" +
          "</a>";
      }).join("");

      var sortSel = "<select id='fo-cp-sort'>" + SORTS.map(function (s) {
        return "<option value='" + s[0] + "'" + (s[0] === sortKey ? " selected" : "") + ">" + s[1] + "</option>";
      }).join("") + "</select>";

      var bodyHTML;
      if (tab === "record") {
        bodyHTML = "<div class='fo-cp-panel'>" +
          "<div class='fo-cp-ph'><h2>&#10022; The record &#10022;</h2>" +
          (form ? "<span class='fo-cp-form'>" + form + "</span>" : "") + "</div>" +
          (played.length ? played.slice(-8).reverse().map(function (r) {
            var w = r.winner === null ? "t" : r.winner === name ? "w" : "l";
            var foe = r.home === name ? r.away : r.home;
            return "<div class='fo-cp-r " + w + "'><i>R" + r.round + "</i><b>" + (r.home === name ? "h" : "a") +
              " v " + E(foe) + "</b><span>" + E(r.text || "") + "</span></div>";
          }).join("") : "<p class='fo-cp-dim'>No cricket played yet this season.</p>") +
          "<div class='fo-cp-sub'>Fixtures</div>" +
          (fixtures.length ? fixtures.map(function (f) {
            return "<a class='fo-cp-r fx' href='#/team?c=" + encodeURIComponent(cid) + "&s=" + f.foeSlot + "'>" +
              "<i>R" + f.round + "</i><b>" + (f.home ? "home" : "away") + " v " + E(f.foe) + "</b>" +
              "<span>" + (f.now ? "today" : "to come") + "</span></a>";
          }).join("") : "<p class='fo-cp-dim'>The season's fixtures are not out yet.</p>") +
          (noted.length ? "<div class='fo-cp-sub'>Names the season made</div>" + noted.map(function (n) {
            return "<div class='fo-cp-note'><b>" + E(n.n) + "</b> &mdash; " + n.w + " <u>" + n.d + "</u></div>"; }).join("") : "") +
          "</div>";
      } else if (tab === "honours") {
        bodyHTML = "<div class='fo-cp-panel'>" +
          "<div class='fo-cp-ph'><h2>&#10022; The trophy shelf &#10022;</h2></div>" +
          (shelf.length ? shelf.map(function (s) { return "<div class='fo-cp-note'>" + s + "</div>"; }).join("")
            : "<p class='fo-cp-dim'>Bare, for now. Every season writes the next line.</p>") +
          "<div class='fo-cp-sub'>The ground</div>" +
          "<div class='fo-cp-note'><b>" + E((info && info.ground) || "A ground of their own") + "</b></div>" +
          // an academy is a building, and buildings are visible - the level a
          // club pays for is public; who is inside it never is
          "<div class='fo-cp-sub'>The academy</div>" +
          "<div class='fo-cp-note'><b>Level " + Math.max(1, Math.min(5, +(info && info.academy) || 2)) + "</b> of five</div>" +
          (ident && ident.motto ? "<div class='fo-cp-sub'>The motto</div><div class='fo-cp-note'>&ldquo;" + E(ident.motto) + "&rdquo;</div>" : "") +
          "<div class='fo-cp-sub'>Standing</div>" +
          "<div class='fo-cp-note'>World rank <b>" + (rkRow ? "#" + rkRow.rank : "unrated") + "</b>" +
          (rkRow ? " &middot; " + num(rkRow.rating) + " rating &middot; " + rkRow.w + "-" + rkRow.l + (rkRow.t ? "-" + rkRow.t : "") + " all competitions" : "") + "</div>" +
          "</div>";
      } else {
        bodyHTML = "<div class='fo-cp-panel'>" +
          "<div class='fo-cp-ph'><h2>&#10022; First XI &#10022;</h2>" +
          "<span class='fo-cp-full'>Full squad <b>" + players.length + "</b></span>" +
          "<span class='fo-cp-tools'>" + sortSel + "</span></div>" +
          (players.length
            ? starCard +
              "<div class='fo-cp-cols'><span></span><span></span><span>Player</span><span>OVR</span>" +
              "<span>Form</span><span>Hand</span><span>Wage</span></div>" +
              rosterRows
            : "<p class='fo-cp-dim'>The squad list is on its way from the World Service&hellip;</p>") +
          "</div>";
      }

      // ---- the challenge ---------------------------------------------------
      // Any club on earth can be played, and this is where you ask. The hour
      // is yours to name; a club with nobody at the wheel takes it on the
      // spot, a managed one has until the teamsheets lock to answer. Nothing
      // here needs the other manager awake: whatever orders he last filed are
      // the side that walks out, which is the only way a friendly can be
      // offered to somebody asleep in another timezone.
      var chHTML = "";
      if (canChallenge) {
        // the earliest legal kick-off, rounded UP to a whole local hour so the
        // picker's step and the default both sit on the same grid (a half-hour
        // timezone would otherwise make every offered slot invalid)
        var mn = new Date(Date.now() + 90 * 60000); mn.setMinutes(0, 0, 0);
        if (mn.getTime() < Date.now() + 90 * 60000) mn.setTime(mn.getTime() + 3600000);
        var minMs = mn.getTime();
        chHTML = "<div class='fo-cp-ch'>" +
          "<div class='fo-cp-chh'>&#9876; Challenge " + E(name) + " to a friendly</div>" +
          "<div class='fo-cp-chrow'>" +
          "<input type='datetime-local' id='fo-cp-chwhen' step='3600'" +
          " min='" + dtLocal(minMs) + "' max='" + dtLocal(Date.now() + 7 * 86400000) + "'" +
          " value='" + E(CH.when) + "' aria-label='Date and hour of the match'>" +
          "<button type='button' id='fo-cp-chgo'" + (CH.busy ? " disabled" : "") + ">" + (CH.busy ? "Sending&hellip;" : "Challenge") + "</button>" +
          "</div>" +
          "<div class='fo-cp-chmsg' id='fo-cp-chmsg'>" + (CH.msg ? E(CH.msg)
            : (mgr ? "Their manager has until an hour before play to accept." : "Nobody manages them - they accept on the spot.") +
              " Your latest orders are the side that plays.") + "</div>" +
          "<div id='fo-cp-chlist'></div></div>";
      }

      var TABS = [["squad", "Squad"], ["record", "Record"], ["honours", "Honours"]];
      var tabBar = "<div class='fo-cp-tabs'>" + TABS.map(function (t) {
        return "<a class='" + (tab === t[0] ? "on" : "") + "' href='#/team?c=" + encodeURIComponent(cid) + "&s=" + slot + "&t=" + t[0] + "'>" + t[1] + "</a>";
      }).join("") + "</div>";

      page.innerHTML = "<div class='fo-cp'>" +
        "<div class='fo-cp-plate'>" +
        "<img class='fo-cp-map' src='" + natArt + "' alt='' onerror=\"this.style.display='none'\">" +
        "<img class='fo-cp-fig' src='" + figure + "' alt='' onerror=\"this.style.display='none'\">" +
        "<div class='fo-cp-plin'>" +
        "<div class='fo-cp-k'>" + E(natName(cid)) + (boss ? " &middot; The flagship" : (isMine ? " &middot; Your club" : "")) + "</div>" +
        "<div class='fo-cp-title'>" +
        (crest ? "<img class='fo-cp-crest' src='" + crest + "' alt='' onerror=\"this.style.display='none'\">"
               : "<span class='fo-cp-shield'><img src='" + flagOf(cid) + "' alt='' onerror=\"this.style.display='none'\"></span>") +
        "<div class='fo-cp-namebox'><h1>" + E(name) + "</h1><p>" + E((info && info.ground) || "") + "</p></div></div>" +
        "<div class='fo-cp-rule'></div>" +
        "<div class='fo-cp-tag'>" + tagline + "</div>" +
        "</div></div>" +
        "<div class='fo-cp-ticket'>" + ticket + "</div>" +
        "<div class='fo-cp-in'>" +
        "<a class='fo-cp-back' href='#/nation?n=" + encodeURIComponent(cid) + "'>&lsaquo; " + E(natName(cid)) + " league</a>" +
        (isMine ? "<div id='fo-cp-mine'></div>" : "") +
        chHTML +
        tabBar + bodyHTML +
        "<div class='fo-cp-foot'><a href='#/rankings'>The world rankings &rsaquo;</a><a href='#/nation?n=" + encodeURIComponent(cid) + "'>The league table &rsaquo;</a></div>" +
        "</div></div>";

      try {
        var sel = document.getElementById("fo-cp-sort");
        if (sel) sel.addEventListener("change", function () {
          location.hash = "#/team?c=" + encodeURIComponent(cid) + "&s=" + slot + "&t=" + tab + "&o=" + sel.value;
        });
      } catch (eSo) {}

      if (canChallenge) {
        try {
          var whenEl = document.getElementById("fo-cp-chwhen");
          var goEl = document.getElementById("fo-cp-chgo");
          if (whenEl) whenEl.addEventListener("input", function () { CH.when = whenEl.value; });
          if (goEl) goEl.addEventListener("click", function () {
            var ms = NaN; try { ms = new Date(whenEl.value).getTime(); } catch (eW) {}
            if (!(ms > 0)) { chSay("Name a date and hour for the match."); return; }
            if (ms < Date.now() + 90 * 60000) { chSay("Pick a time at least 90 minutes from now - lineups need their window."); return; }
            if (ms > Date.now() + 7 * 86400000) { chSay("Pick a time within the next seven days."); return; }
            CH.busy = true; goEl.disabled = true; goEl.textContent = "Sending…";
            rpc("world_friendly_challenge", { p_country: cid, p_slot: slot, p_play_at_ms: ms })
              .then(function (r) {
                CH.busy = false; goEl.disabled = false; goEl.textContent = "Challenge";
                chSay(r && r.humanOpponent
                  ? "Challenge sent. Their manager has until an hour before the match to accept."
                  : "The match is on. Your latest orders play unless you file a lineup for it.");
                loadTies(CH.key, cid, slot);
              })
              .catch(function (e) {
                CH.busy = false; goEl.disabled = false; goEl.textContent = "Challenge";
                chSay(String(e.message || "The world could not be reached.").slice(0, 140));
              });
          });
          paintTies();
        } catch (eCh) {}
      }

      // YOUR OWN CLUB WEARS THE NAME IT WAS CHRISTENED WITH AT ITS FOUNDING.
      // The world's register is the only register; a device carrying an older
      // name quietly adopts it rather than offering a choice.
      if (isMine) {
        try {
          var host = document.getElementById("fo-cp-mine");
          try {
            var t = userTeam();
            if (t && name && t.name !== name) { t.name = name; if (typeof saveGame === "function") saveGame(false); }
          } catch (eT) {}
          if (host) {
            host.className = "fo-cp-mineact";
            host.innerHTML = "<a href='#/training'>The nets &rsaquo;</a><a href='#/academy'>The academy &rsaquo;</a><a href='#/orders'>The orders &rsaquo;</a><a href='#/squad'>Your squad &rsaquo;</a>";
          }
        } catch (eMine) {}
      }
    };

    paint(null, null, null);
    fetchClub(cid, slot, function (info) { paint(info, SQ_CACHE[cid + ":" + slot], HON_CACHE); });
    fetchSquad(cid, slot, function (sq) { paint(CLUB_CACHE[cid + ":" + slot], sq, HON_CACHE); });
    fetchHonours(function (hon) { paint(CLUB_CACHE[cid + ":" + slot], SQ_CACHE[cid + ":" + slot], hon); });
  };

  function foClubCss() {
    if (document.getElementById("fo-cp-css")) return;
    var s = document.createElement("style"); s.id = "fo-cp-css";
    s.textContent = [
      ".fo-cp{min-height:70vh;--navy:#0C1B33;--gold:#C9A24B;--grn:#1F6F4A;--paper:#F7F3E8}",
      ".fo-cp-plate{position:relative;width:100vw;margin-left:calc(50% - 50vw);min-height:280px;background:linear-gradient(160deg,#12294A,#0A1526 62%);overflow:hidden;display:flex;align-items:center}",
      ".fo-cp-map{position:absolute;left:0;top:0;height:100%;width:auto;max-width:46%;object-fit:cover;object-position:left center;opacity:.5;-webkit-mask-image:linear-gradient(90deg,#000 40%,transparent);mask-image:linear-gradient(90deg,#000 40%,transparent)}",
      ".fo-cp-fig{position:absolute;right:0;bottom:0;height:104%;width:auto;object-fit:contain;object-position:bottom right;-webkit-mask-image:linear-gradient(270deg,#000 62%,transparent);mask-image:linear-gradient(270deg,#000 62%,transparent)}",
      ".fo-cp-plin{position:relative;z-index:2;width:100%;max-width:760px;margin:0 auto;padding:34px 20px 44px;text-align:center}",
      ".fo-cp-k{font:600 11px/1 Oswald,sans-serif;letter-spacing:.28em;text-transform:uppercase;color:var(--gold)}",
      ".fo-cp-title{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:12px}",
      ".fo-cp-namebox{text-align:left;min-width:0}",
      ".fo-cp-crest{width:88px;height:88px;object-fit:contain;flex:none;filter:drop-shadow(0 6px 16px rgba(0,0,0,.5))}",
      ".fo-cp-shield{width:64px;height:78px;flex:none;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#16345C,#0D2144);border:2px solid var(--gold);border-radius:8px 8px 26px 26px;box-shadow:0 6px 16px rgba(0,0,0,.45)}",
      ".fo-cp-shield img{width:34px;height:23px;object-fit:cover;border-radius:2px}",
      ".fo-cp-title h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:clamp(36px,7.4vw,64px);line-height:.98;color:#FFFDF7;margin:0;text-shadow:0 4px 22px rgba(0,0,0,.5)}",
      ".fo-cp-title p{font:italic 400 clamp(15px,2.2vw,21px)/1.2 'Fraunces',Georgia,serif;color:rgba(255,253,247,.66);margin:4px 0 0}",
      ".fo-cp-rule{height:1px;background:linear-gradient(90deg,transparent,rgba(201,162,75,.75),transparent);margin:18px auto 12px;max-width:560px}",
      ".fo-cp-tag{font:600 11px/1.5 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,253,247,.72)}",
      ".fo-cp-ticket{position:relative;z-index:3;max-width:1080px;margin:-26px auto 0;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;background:var(--paper);border:1px solid rgba(12,27,51,.14);border-bottom:3px solid var(--grn);border-radius:6px;padding:14px 22px;box-shadow:0 18px 40px rgba(12,27,51,.22);clip-path:polygon(14px 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%,0 14px)}",
      ".fo-cp-m,.fo-cp-c{display:flex;align-items:center;gap:9px;padding:2px 14px}",
      ".fo-cp-m .ic{width:26px;height:30px;object-fit:contain;object-position:bottom;opacity:.82}",
      ".fo-cp-ico{width:19px;height:22px;object-fit:contain;opacity:.72}",
      ".fo-cp-m .mv i,.fo-cp-c .mv i{display:block;font:600 9.5px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(12,27,51,.5);font-style:normal}",
      ".fo-cp-m .mv b{display:block;font:700 26px/1.1 Oswald,sans-serif;color:var(--grn);font-variant-numeric:tabular-nums}",
      ".fo-cp-c .mv b{display:block;font:700 22px/1.15 Oswald,sans-serif;color:var(--grn);font-variant-numeric:tabular-nums}",
      ".fo-cp-m .bar{display:block;height:4px;width:118px;background:rgba(12,27,51,.12);border-radius:3px;margin-top:5px;overflow:hidden}",
      ".fo-cp-m .bar u{display:block;height:100%;background:linear-gradient(90deg,#2E8B5E,#1F6F4A);text-decoration:none}",
      ".fo-cp-div{width:1px;align-self:stretch;background:repeating-linear-gradient(180deg,rgba(12,27,51,.22) 0 3px,transparent 3px 7px)}",
      ".fo-cp-in{position:relative;max-width:1080px;margin:0 auto;padding:16px 14px 80px}",
      "html body #page .fo-cp-back{display:inline-flex;align-items:center;min-height:44px;padding:0 12px;border-radius:12px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#B44A22 !important;text-decoration:none !important;margin:2px -12px 6px}",
      ".fo-cp-tabs{display:flex;gap:8px;margin-bottom:-1px}",
      "html body #page .fo-cp-tabs a{font:700 11.5px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(12,27,51,.6) !important;background:#EFE9DA;border:1px solid rgba(12,27,51,.14);border-bottom:0;border-radius:10px 10px 0 0;padding:13px 26px;text-decoration:none !important}",
      "html body #page .fo-cp-tabs a.on{color:#FFFDF7 !important;background:var(--grn);border-color:var(--grn)}",
      ".fo-cp-panel{background:var(--paper);border:1px solid rgba(12,27,51,.14);border-radius:0 12px 12px 12px;padding:20px 22px 24px;box-shadow:0 10px 28px rgba(12,27,51,.08)}",
      ".fo-cp-ph{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:16px}",
      ".fo-cp-ph h2{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:26px;color:var(--navy);margin:0}",
      ".fo-cp-full{font:600 10.5px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(12,27,51,.5)}",
      ".fo-cp-full b{color:var(--grn);margin-left:5px}",
      ".fo-cp-tools{margin-left:auto}",
      "html body #page .fo-cp-tools select{background:#FFFDF7 !important;color:var(--navy) !important;border:1px solid rgba(12,27,51,.18);border-radius:8px;padding:9px 12px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;-webkit-appearance:menulist;appearance:menulist}",
      ".fo-cp-star{position:relative;display:flex;align-items:stretch;gap:14px;background:linear-gradient(150deg,#16452F,#0E2C1F);border:2px solid var(--gold);border-radius:12px;padding:14px 16px;margin-bottom:16px;overflow:hidden;min-height:140px}",
      ".fo-cp-face{position:absolute;left:0;top:0;height:100%;width:126px;object-fit:cover;object-position:top center;-webkit-mask-image:linear-gradient(90deg,#000 55%,transparent);mask-image:linear-gradient(90deg,#000 55%,transparent)}",
      ".fo-cp-starin{position:relative;z-index:2;margin-left:124px;display:flex;flex-direction:column;justify-content:center;gap:5px;min-width:0}",
      ".fo-cp-starn{display:flex;align-items:center;gap:8px}",
      ".fo-cp-starn img{width:19px;height:13px;object-fit:cover;border-radius:2px}",
      ".fo-cp-starn b{font:700 22px/1.1 Oswald,sans-serif;color:#FFFDF7;text-transform:uppercase}",
      ".fo-cp-starr{font:500 12.5px/1.3 Inter,sans-serif;color:rgba(255,253,247,.7)}",
      ".fo-cp-starf{display:flex;align-items:center;gap:9px;margin-top:2px}",
      ".fo-cp-starf i{font:600 9px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,253,247,.5);font-style:normal}",
      ".fo-cp-dots{display:inline-flex;gap:4px}",
      ".fo-cp-dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,253,247,.22);display:block}",
      ".fo-cp-dots i.on{background:#4FBF85}",
      ".fo-cp-startags{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}",
      ".fo-cp-startags em{font-style:normal;font:700 9px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#BFE8CF;background:rgba(79,191,133,.18);border:1px solid rgba(79,191,133,.34);border-radius:6px;padding:5px 8px}",
      ".fo-cp-starnums{position:relative;z-index:2;margin-left:auto;display:flex;align-items:center;gap:22px;padding-left:16px}",
      ".fo-cp-starovr,.fo-cp-starval{text-align:right}",
      ".fo-cp-starovr i,.fo-cp-starval i{display:block;font:600 9px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,253,247,.5);font-style:normal}",
      ".fo-cp-starovr b{display:block;font:700 42px/1 Oswald,sans-serif;color:var(--gold);font-variant-numeric:tabular-nums}",
      ".fo-cp-starval b{display:block;font:700 17px/1.2 Oswald,sans-serif;color:#FFFDF7;margin-top:4px}",
      ".fo-cp-cols,.fo-cp-row{display:grid;grid-template-columns:30px 34px minmax(0,1fr) 54px 78px 54px 70px;gap:10px;align-items:center}",
      ".fo-cp-cols{padding:0 12px 8px;font:600 9px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(12,27,51,.42);text-align:center}",
      ".fo-cp-cols span:nth-child(3){text-align:left}",
      ".fo-cp-row{background:#FFFDF7;border:1px solid rgba(12,27,51,.09);border-radius:10px;padding:11px 12px;margin-bottom:6px;text-decoration:none;color:inherit;transition:border-color .14s ease,transform .12s ease}",
      "html body #page a.fo-cp-row{color:#0C1B33;text-decoration:none}",
      "html body #page a.fo-cp-row:hover{border-color:rgba(201,162,75,.7);transform:translateY(-1px);text-decoration:none}",
      "html body #page a.fo-cp-star{text-decoration:none;color:inherit}",
      "html body #page a.fo-cp-star:hover{text-decoration:none}",
      ".fo-cp-row .rk{font:600 12px/1 Oswald,sans-serif;color:rgba(12,27,51,.4);text-align:center}",
      ".fo-cp-row .rl{width:30px;height:30px;border-radius:50%;background:rgba(31,111,74,.1);display:flex;align-items:center;justify-content:center}",
      ".fo-cp-row .nm{min-width:0}",
      ".fo-cp-row .nm b{display:block;font:700 14px/1.2 Oswald,sans-serif;color:var(--navy);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-cp-row .nm i{display:block;font:400 11px/1.3 Inter,sans-serif;font-style:normal;color:rgba(12,27,51,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-cp-row .ov{font:700 19px/1 Oswald,sans-serif;color:var(--grn);text-align:center;font-variant-numeric:tabular-nums}",
      ".fo-cp-row .fm{display:flex;gap:4px;justify-content:center}",
      ".fo-cp-row .fm i{width:7px;height:7px;border-radius:50%;background:rgba(12,27,51,.14);display:block}",
      ".fo-cp-row .fm i.on{background:#2E8B5E}",
      ".fo-cp-row .hd,.fo-cp-row .wg{font:600 11.5px/1 Oswald,sans-serif;color:rgba(12,27,51,.62);text-align:center}",
      ".fo-cp-row .wg{color:var(--navy)}",
      ".fo-cp-sub{font:600 10px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(12,27,51,.45);margin:20px 0 10px}",
      ".fo-cp-r{display:grid;grid-template-columns:38px minmax(0,1fr);gap:2px 10px;padding:9px 2px;border-top:1px solid rgba(12,27,51,.08);text-decoration:none;color:var(--navy)}",
      ".fo-cp-r i{grid-row:span 2;font:700 10px/1 Oswald,sans-serif;color:rgba(12,27,51,.38);font-style:normal;padding-top:3px}",
      ".fo-cp-r b{font:600 13px/1.35 Inter,sans-serif}",
      ".fo-cp-r span{font:italic 420 12px/1.4 'Fraunces',Georgia,serif;color:rgba(12,27,51,.6)}",
      ".fo-cp-r.w b{color:var(--grn)}.fo-cp-r.l b{color:#B23230}",
      ".fo-cp-form{display:inline-flex;gap:5px}",
      ".fo-cp-form i{font-style:normal;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;font:700 10px/1 Oswald,sans-serif;color:#FFFDF7}",
      ".fo-cp-form i.w{background:var(--grn)}.fo-cp-form i.l{background:#B23230}.fo-cp-form i.t{background:#8a6d3b}",
      ".fo-cp-note{font:500 13px/1.6 Inter,sans-serif;color:var(--navy);padding:3px 0}",
      ".fo-cp-note u{text-decoration:none;font:italic 420 12px/1.5 'Fraunces',Georgia,serif;color:rgba(12,27,51,.55)}",
      ".fo-cp-dim{font:italic 420 13px/1.6 'Fraunces',Georgia,serif;color:rgba(12,27,51,.55);margin:6px 0 0}",
      ".fo-cp-dim.foot{margin-top:14px;padding-top:12px;border-top:1px solid rgba(12,27,51,.08)}",
      // the challenge: one line of paper above the tabs, the same stock the
      // panel beneath it is printed on
      ".fo-cp-ch{background:var(--paper);border:1px solid rgba(12,27,51,.14);border-left:3px solid #C8542F;border-radius:12px;padding:13px 15px;margin-bottom:12px}",
      ".fo-cp-chh{font:700 11px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--navy)}",
      ".fo-cp-chrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}",
      "html body #page .fo-cp-chrow input{flex:1 1 190px;min-width:0;background:#FFFDF7 !important;color:var(--navy) !important;border:1px solid rgba(12,27,51,.2);border-radius:9px;padding:10px 11px;min-height:44px;font:600 12.5px/1 Inter,sans-serif}",
      "html body #page .fo-cp-chrow button{font:700 11px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#FFFDF7 !important;background:linear-gradient(180deg,#E8894A,#C8542F) !important;border:0 !important;border-radius:9px !important;padding:12px 20px !important;min-height:44px;cursor:pointer}",
      "html body #page .fo-cp-chrow button:disabled{opacity:.55;cursor:default}",
      ".fo-cp-chmsg{margin-top:8px;font:500 11.5px/1.5 Inter,sans-serif;color:rgba(12,27,51,.6)}",
      ".fo-cp-fr{display:flex;align-items:center;gap:9px;flex-wrap:wrap;border-top:1px solid rgba(12,27,51,.09);margin-top:9px;padding-top:9px}",
      ".fo-cp-fr b{font:600 12.5px/1.3 Inter,sans-serif;color:var(--navy)}",
      ".fo-cp-fr i{font-style:normal;font:500 11.5px/1.3 Inter,sans-serif;color:rgba(12,27,51,.55)}",
      ".fo-cp-fr.on i{color:var(--grn)}",
      ".fo-cp-fr.dim{opacity:.5}",
      ".fo-cp-fr span{margin-left:auto;display:inline-flex;gap:6px}",
      "html body #page .fo-cp-fr button{font:700 10px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--navy) !important;background:#FFFDF7 !important;border:1px solid rgba(12,27,51,.22) !important;border-radius:999px !important;padding:9px 13px !important;min-height:44px;cursor:pointer}",
      "html body #page .fo-cp-fr .fo-cp-fyes,html body #page .fo-cp-fr .fo-cp-fwatch{color:#FFFDF7 !important;background:var(--grn) !important;border-color:var(--grn) !important}",
      ".fo-cp-mineact{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}",
      "html body #page .fo-cp-mineact a{font:600 11px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#B44A22 !important;background:#FFFDF7;border:1px solid rgba(12,27,51,.14);border-radius:999px;padding:9px 14px;text-decoration:none !important}",
      "html body #page .fo-cp-cta{display:block;text-align:center;font:700 12px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#FFFDF7 !important;background:linear-gradient(180deg,#E8894A,#C8542F);border-radius:12px;padding:14px;text-decoration:none !important;box-shadow:0 10px 26px rgba(200,84,47,.3);margin:14px 0 10px}",
      ".fo-cp-foot{display:flex;justify-content:space-between;gap:10px;padding:8px 4px}",
      "html body #page .fo-cp-foot a{display:inline-flex;align-items:center;min-height:44px;padding:0 13px;margin:0 -13px;border-radius:12px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#B44A22 !important;text-decoration:none !important}",
      "@media(max-width:760px){.fo-cp-plate{min-height:215px}",
      ".fo-cp-fig{height:86%;opacity:.55}",
      ".fo-cp-map{max-width:62%;opacity:.4}",
      ".fo-cp-plin{padding:22px 14px 34px}",
      ".fo-cp-title{gap:11px}.fo-cp-crest{width:56px;height:56px}.fo-cp-shield{width:44px;height:54px}",
      // THE TICKET ON A PHONE: two rows of three, every cell the same width,
      // labels on one baseline and figures on the next - a scoreboard, not a
      // squeezed line of odds and ends
      ".fo-cp-ticket{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin:-16px 10px 0;padding:0;border-radius:8px;clip-path:none;overflow:hidden}",
      ".fo-cp-m,.fo-cp-c{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:5px;padding:12px 4px 11px;border-right:1px solid rgba(12,27,51,.09);border-bottom:1px solid rgba(12,27,51,.09)}",
      ".fo-cp-m:nth-child(3n),.fo-cp-c:nth-child(3n){border-right:0}",
      ".fo-cp-c{border-bottom:0}",
      ".fo-cp-m .ic{width:22px;height:24px}",
      ".fo-cp-m .mv,.fo-cp-c .mv{width:100%;text-align:center}",
      ".fo-cp-m .mv i,.fo-cp-c .mv i{font-size:8.5px;letter-spacing:.14em}",
      ".fo-cp-m .mv b,.fo-cp-c .mv b{font-size:23px;line-height:1.05;margin-top:3px}",
      ".fo-cp-m .bar{width:64px;margin:6px auto 0}",
      // the three facts sit under the three strengths, on their own baseline
      ".fo-cp-c .mv{padding-top:26px}",
      ".fo-cp-div{display:none}",
      "html body #page .fo-cp-tabs a{flex:1;text-align:center;padding:12px 4px;letter-spacing:.08em}",
      ".fo-cp-panel{padding:15px 12px 20px;border-radius:0 10px 10px 10px}",
      ".fo-cp-ph h2{font-size:20px}.fo-cp-tools{margin-left:0;width:100%}",
      "html body #page .fo-cp-tools select{width:100%}",
      ".fo-cp-star{min-height:0;padding:12px;flex-wrap:wrap}",
      ".fo-cp-face{width:92px}.fo-cp-starin{margin-left:88px}",
      ".fo-cp-starn b{font-size:17px}",
      ".fo-cp-starnums{margin-left:88px;gap:18px;padding-left:0;width:100%;justify-content:flex-start;margin-top:8px}",
      ".fo-cp-starovr,.fo-cp-starval{text-align:left}",
      ".fo-cp-starovr b{font-size:30px}",
      ".fo-cp-cols{display:none}",
      ".fo-cp-row{grid-template-columns:22px 28px minmax(0,1fr) 40px 46px;gap:8px}",
      ".fo-cp-row .fm,.fo-cp-row .hd{display:none}",
      ".fo-cp-row .ov{font-size:17px}}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
