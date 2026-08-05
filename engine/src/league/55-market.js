/* ============================================================================
   THE TRANSFER MARKET (#/market) — open outcry, three-day windows.

   The board is the world's: free agents trickled on daily by the umpire, and
   men listed by clubs - bot clubs shedding surplus, managers naming a
   reserve. Every listing is an open auction with an OPEN CARD (the man's own
   stars, age and wages ride the board snapshot) and an EXACT closing moment:
   the standing high bid and the club holding it are public, a new offer must
   beat the board by the step, and a bid landed in the final ten minutes
   pushes the hammer back to ten minutes out (052). When it falls, the
   umpire's next pass settles it - highest at or above the reserve takes him,
   the money walks through the books, the man moves.

   Alongside the auctions a manager has two doors of his own: QUICK-SELL, the
   bank buying any of his men instantly at half valuation, and RELEASE, a
   shirt freed for nothing. Both go through the world's RPCs, which
   re-validate everything; this page could lie all it liked and the server
   would shrug. Nothing here is random and nothing needs the manager online:
   deadlines are world days, prices are pure functions of the man.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foMkt) return; window.__foMkt = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  var STEP = 500;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
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
  function sel(path) {
    return fetch(SB_URL + "/rest/v1/" + path, { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.ok ? r.json() : null; });
  }
  function snapshot(key) {
    return sel("world_snapshots?key=eq." + encodeURIComponent(key) + "&select=body")
      .then(function (rows) { return rows && rows[0] && rows[0].body; })
      .catch(function () { return null; });
  }
  function money(v) {
    var n = Number(v);
    if (!isFinite(n)) return "&mdash;";
    var neg = n < 0; n = Math.abs(n);
    var s = n >= 1000000 ? (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + "m"
          : n >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n));
    return (neg ? "-$" : "$") + s;
  }
  function claim() {
    try { return window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); }
    catch (e) { return null; }
  }
  function dayTxt(d) {
    try { return window.__foPlanet.dateTxt(d) || ("day " + d); } catch (e) { return "day " + d; }
  }
  function toastMsg(m) { try { toast(m); } catch (e) { try { alert(m); } catch (e2) {} } }
  function sayErr(e) { toastMsg(String((e && e.message) || e).replace(/^error:\s*/i, "")); }

  // THE UMPIRE'S OWN ARITHMETIC, mirrored so the page can say a price before
  // the button is pressed. server/market.mjs (valueOf) and migration 042
  // (world_market_quicksell) are the authorities; this must not drift.
  function ageCurve(a) {
    a = +a || 27;
    return a <= 21 ? 1.18 : a <= 25 ? 1.12 : a <= 28 ? 1.0 : a <= 31 ? 0.82 : a <= 33 ? 0.6 : 0.4;
  }
  function qsPrice(p) {
    var base = Math.max(5000, +(p && p.fee) || 40000);
    return Math.max(3000, Math.round(base * ageCurve(p && p.age) * 0.5 / 500) * 500);
  }

  // ---- the data on the desk -------------------------------------------------
  var MK = { listings: null, deals: null, mine: null, snap: null, at: 0, busy: 0, tab: "board", role: "all", sort: "close", nat: "all", shown: 40, open: {} };
  function refetch(force) {
    if (MK.busy) return;
    if (!force && MK.at && Date.now() - MK.at < 30000) return;
    var cl = claim(); if (!cl || !cl.country) return;
    MK.busy = 1;
    // THE WHOLE WORLD'S BOARD. Every nation's listings in one room - the
    // server has always allowed a cross-border deal (moveMan carries a man
    // between countries, the books count both sides); only this fetch ever
    // narrowed the view to home.
    var qs = [
      sel("world_listings?order=closes_day.asc,id.asc"),
      sel("world_deals?or=(from_country.eq." + encodeURIComponent(cl.country) + ",to_country.eq." + encodeURIComponent(cl.country) + ")&order=settled_day.desc,id.desc&limit=24"),
      snapshot("market"),
      jwt() ? rpc("world_market_mine", {}).catch(function () { return null; }) : Promise.resolve(null)
    ];
    Promise.all(qs).then(function (out) {
      MK.listings = out[0] || []; MK.deals = out[1] || [];
      MK.snap = out[2] || null; MK.mine = out[3] || null;
      MK.at = Date.now(); MK.busy = 0;
      paint();
    }, function () { MK.busy = 0; MK.at = Date.now(); paint(); });
  }

  // the board snapshot's copy of a listing: the open card (man), the scout's
  // old one-liner, the hammer moment as the umpire last published it
  function snapOf(id) {
    try {
      return ((MK.snap && MK.snap.listings) || []).filter(function (x) { return Number(x.id) === Number(id); })[0] || null;
    } catch (e) { return null; }
  }
  function impressionOf(id) {
    var L = snapOf(id);
    return L ? { scout: L.scout, fee: L.fee } : null;
  }
  // a live view row knows closes_ms (052) but not the card; a snapshot row
  // knows both but goes stale between the umpire's passes. Marry them: the
  // view's clock wins, the snapshot's card fills in.
  function dress(L) {
    var sn = snapOf(L.id) || {};
    if (L.man == null && sn.man) L.man = sn.man;
    if (L.closesMs == null) L.closesMs = L.closes_ms != null ? +L.closes_ms : (sn.closesMs != null ? +sn.closesMs : null);
    return L;
  }

  // ---- the rooms ------------------------------------------------------------
  // which shelf of the board a man sits on, off the scout's public word
  function roleBucket(sc) {
    var r = String((sc && sc.role) || "").toLowerCase();
    if (!r) return "";
    if (/keeper|wicket/.test(r)) return "wk";
    if (/allround|all-round/.test(r)) return "ar";
    if (/seam|fast|medium|spin|bowl/.test(r)) return "bowl";
    return "bat";
  }
  // the shelf a man sits on, read off his OPEN card first (052), the scout's
  // word only for boards snapshotted before the card opened
  function bucketOf(L) {
    var man = L.man || (snapOf(L.id) || {}).man;
    if (man && man.role) return roleBucket({ role: man.role === "allRounder" ? "all-rounder" : man.role });
    return roleBucket(((impressionOf(L.id) || {}).scout) || {});
  }
  // THE HAMMER IS A CLOCK YOU CAN WATCH. Every listing wears a countdown
  // plate that ticks once a second: quiet while days remain, claret inside
  // the hour, and in the final ten minutes - the anti-snipe window - a
  // filled, beating plate with the seconds running. Urgency you can feel.
  function hmTier(left) { return left <= 0 ? "gone" : left < 600000 ? "final" : left < 3600000 ? "soon" : "calm"; }
  // the reading: days out it says "1d 12h 05m"; inside a day the seconds
  // run - "12h 05m 33s" - so the plate reads as a LIVE clock, not a label
  function hmParts(left) {
    var s = Math.max(0, Math.floor(left / 1000));
    var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    var p2 = function (n) { return (n < 10 ? "0" : "") + n; };
    if (d >= 1) return d + "d " + p2(h) + "h " + p2(m) + "m";
    return h + "h " + p2(m) + "m " + p2(ss) + "s";
  }
  function hammerPlate(ms) {
    var left = ms - Date.now();
    var tier = hmTier(left);
    if (tier === "gone") {
      return "<b class='clk gone'>FALLEN</b><i class='hnote'>the umpire is opening the envelopes</i>";
    }
    return "<b class='clk " + tier + "'>" + hmParts(left) + "</b>" +
      (tier === "final" ? "<i class='hnote'>a late bid moves it back ten</i>" : "");
  }
  // the ticking: one clock for the whole board, updating every plate in
  // place - no repaint, so menus and selections are never yanked away
  setInterval(function () {
    try {
      if ((location.hash || "").split("?")[0] !== "#/market") return;
      [].slice.call(document.querySelectorAll("span[data-mk-hh]")).forEach(function (el) {
        var ms = +el.getAttribute("data-mk-hh"); if (!ms) return;
        el.innerHTML = hammerPlate(ms);
        // the moment it falls, ask the world what happened - once
        if (ms - Date.now() <= 0 && !el.__foFell) {
          el.__foFell = 1;
          setTimeout(function () { try { refetch(true); } catch (e2) {} }, 5000);
        }
      });
    } catch (e) {}
  }, 1000);
  // THE OPEN CARD, in full: the game's own seven summary reads (the draft
  // card's aggregates, engine/src/00-core.js), each a number and a toned bar.
  // These are the SUMMARY figures, never the raw engine skills.
  // the man's job, in plain words - the game's own role names (00-core ROLEN)
  var MK_ROLE = { opener: "Opener", topOrderBat: "Top-order bat", middleOrderBat: "Middle-order bat",
    wicketkeeper: "Wicketkeeper", keeper: "Wicketkeeper", allRounder: "All-rounder", batter: "Batsman", bowler: "Bowler",
    seamFast: "Fast bowler", seamFastMedium: "Fast-medium bowler", seamMedium: "Medium pacer",
    wristSpin: "Wrist spinner", fingerSpin: "Finger spinner" };
  var MK_BT = { seamFast: "fast", seamFastMedium: "fast-medium", seamMedium: "medium",
    wristSpin: "wrist spin", fingerSpin: "finger spin", partTimeSeam: "part-time seam", partTimeSpin: "part-time spin" };
  function roleLbl(man) {
    var r = MK_ROLE[man.role] || (man.role ? E(man.role) : "a cricketer");
    var bt = MK_BT[man.bowlTypeFull];
    // a batsman who turns his arm over is worth saying so
    if (bt && !/bowler|pacer|spinner/i.test(r)) r += ", " + bt;
    return r;
  }
  function skTone(v) { return v >= 75 ? "t4" : v >= 50 ? "t3" : v >= 30 ? "t2" : "t1"; }
  function skWord(v) { try { return (typeof word === "function" && word(v)) || ""; } catch (e) { return ""; } }
  // THE BID RAIL CARD (the owner's pick): three role-picked gauges up front,
  // the full seven reads behind a Full-card fold, the money in a navy rail.
  var READ_LBL = { bat: "Batting", bowl: "Bowling", keep: "Keeping", field: "Fielding",
    tech: "Technique", pow: "Power", end: "Endurance" };
  // which three reads a man is BOUGHT for, by the shelf he sits on
  function readPicks(man) {
    var b = man ? roleBucket({ role: man.role === "allRounder" ? "all-rounder" : man.role }) : "";
    if (b === "wk") return ["keep", "bat", "field"];
    if (b === "bowl") return ["bowl", "end", "field"];
    if (b === "ar") return ["bat", "bowl", "field"];
    return ["bat", "tech", "pow"];
  }
  function gaugesHtml(man) {
    if (!man || !man.skills) return "";
    try {
      return "<div class='gg'>" + readPicks(man).map(function (k, i) {
        var v = readOf(man, k), off = v < 0;
        return "<span class='g" + (i === 0 ? " lead" : "") + (off ? " off" : "") +
          "' title='" + READ_LBL[k] + (off ? "" : " &middot; " + E(skWord(v))) + "'>" +
          "<span class='lb'>" + READ_LBL[k] + "</span>" +
          "<span class='vl'>" + (off ? "&ndash;" : v) + "</span>" +
          "<span class='tr'><span class='fl' style='width:" + Math.max(3, Math.max(0, v)) + "%'></span></span>" +
          "</span>";
      }).join("") + "</div>";
    } catch (e) { return ""; }
  }
  // the fold: all seven reads as toned bars, dashes for trades he lacks
  function fullCardHtml(man) {
    if (!man || !man.skills) return "";
    try {
      return "<div class='fo-mk-full'>" + ["bat", "bowl", "keep", "field", "tech", "pow", "end"].map(function (k) {
        var v = readOf(man, k), off = v < 0;
        return "<span class='fb" + (off ? " off" : "") + "' title='" + READ_LBL[k] + (off ? "" : " &middot; " + E(skWord(v))) + "'>" +
          "<i>" + READ_LBL[k] + "</i>" +
          "<u>" + (off ? "" : "<s class='" + skTone(v) + "' style='width:" + Math.max(3, v) + "%'></s>") + "</u>" +
          "<b>" + (off ? "&ndash;" : v) + "</b>" +
          "</span>";
      }).join("") + "</div>";
    } catch (e) { return ""; }
  }
  function rowHtml(L, cl, myBids) {
    // THE OPEN CARD (052): a listed man's own facts, straight off the board
    // snapshot - age, hand, role, wage, experience and the seven summary
    // reads. The paid scout is retired; the scout's one-line impression
    // still colours the read where it rode an older snapshot.
    var man = dress(L).man || null;
    var imp = impressionOf(L.id) || {};
    var sc = imp.scout || {};
    var meta = [];
    if (man) {
      if (man.nat) meta.push("<span class='natc'>" + natFlag(man.nat) + E(String(man.nat).toUpperCase()) + "</span>");
      if (man.age) meta.push((man.age | 0) + " yrs");
      if (man.hand) meta.push(man.hand === "L" ? "left-hand" : "right-hand");
      meta.push(roleLbl(man));
      if (man.expWord) meta.push("exp " + E(man.expWord));
      if (man.wage) meta.push(money(man.wage) + "/rd wages");
    } else {
      if (sc.age) meta.push(sc.age);
      if (sc.hand) meta.push(E(sc.hand));
      if (sc.role) meta.push(E(sc.role === "allrounder" ? "all-rounder" : sc.role === "keeper" ? "wicketkeeper" : sc.role));
    }
    var ovr = null; try { ovr = (man && window.foPkOvr) ? foPkOvr(man) : null; } catch (eO) {}
    var high = +L.high || 0;
    var minBid = high ? high + STEP : Math.ceil((+L.asking || 0) * 0.55);
    var myBid = (myBids || []).filter(function (b) { return Number(b.id) === Number(L.id); })[0];
    var lead = myBid && high && +myBid.amount >= high;
    var mineSelling = cl && L.country_id === cl.country && L.slot === cl.slot;
    var fa = L.slot < 0;
    var state = lead ? "high bid &middot; you lead"
      : high ? "high bid &middot; " + E(L.highClub || L.high_club || "a club") + " lead"
      : "no bids yet &middot; reserve " + money(L.reserve);
    var hmMs = +(L.closesMs != null ? L.closesMs : L.closes_ms) || 0;
    // EVERY NAME IS A DOOR (the feed's rule): a listed club man opens his own
    // dossier. A free agent has no club page to stand on, so he stays print.
    var door = L.slot >= 0 && L.country_id
      ? "#/player?c=" + encodeURIComponent(L.country_id) + "&s=" + (L.slot | 0) + "&n=" + encodeURIComponent(L.player)
      : "";
    var open = !!MK.open[L.id];
    var chev = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.4' " +
      "stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>";
    return "<div class='fo-mk-row" + (lead ? " lead" : "") + "' data-id='" + L.id + "'>" +
      "<div class='bd'>" +
      "<div class='tp'>" +
      (ovr != null ? "<span class='ovr' title='Overall'>" + ovr + "</span>" : "") +
      "<span class='nm'>" +
      (door ? "<a class='pdoor' href='" + door + "'><b>" + E(L.player) + (man && man.keeper ? " &dagger;" : "") + "</b></a>"
            : "<b>" + E(L.player) + (man && man.keeper ? " &dagger;" : "") + "</b>") +
      "<span class='mt'>" + (meta.length ? meta.join(" &nbsp;&middot;&nbsp; ") : "a cricketer") + "</span></span>" +
      "</div>" +
      gaugesHtml(man) +
      (man && man.skills
        ? "<button class='fold" + (open ? " on" : "") + "' data-mk-full='" + L.id + "'>" +
          "<span>" + (open ? "Close card" : "Full card") + "</span>" + chev + "</button>" +
          (open ? fullCardHtml(man) : "")
        : "") +
      "<div class='prov'>" +
      "<span class='tag" + (fa ? " fa" : "") + "'>" +
      (fa ? "Free agent" : "Listed by " + E(L.club || "a club")) +
      (L.country_id ? " &middot; " + E(natNm(L.country_id)) : "") + "</span>" +
      (sc.impression ? "<span class='imp'>&ldquo;" + E(sc.impression) + "&rdquo;</span>" : "") +
      "</div>" +
      "</div>" +
      "<div class='rail'>" +
      "<span class='lb'>" + (high ? (lead ? "High bid &middot; you lead" : "High bid") : "No bids yet") + "</span>" +
      "<span class='amt'>" + money(high || L.asking) + "</span>" +
      "<span class='ld" + (lead ? " you" : "") + "'>" +
      (lead ? "your offer stands" : high ? E(L.highClub || L.high_club || "a club") + " lead" : "reserve " + money(L.reserve)) +
      "</span>" +
      (hmMs
        ? "<span class='hmwrap' data-mk-hh='" + hmMs + "'>" + hammerPlate(hmMs) + "</span>"
        : "<span class='hmwrap'><b class='clk calm'>" + E(dayTxt(L.closes != null ? L.closes : L.closes_day)) + "</b></span>") +
      (mineSelling
        ? "<button class='act ghost' data-mk-withdraw='" + L.id + "'>Withdraw</button>"
        : "<button class='act" + (myBid && !lead ? " hot" : "") + "' data-mk-bid='" + L.id + "' data-min='" + minBid + "'>" +
          (myBid ? (lead ? "Raise your bid" : "Outbid them") : "Make a bid") + "</button>") +
      "</div>" +
      "</div>";
  }

  var ROLE_TABS = [["all", "All"], ["bat", "Batsmen"], ["bowl", "Bowlers"], ["ar", "All-rounders"], ["wk", "Keepers"]];
  // the sort shelf: the board's own orders, then the man's, then the seven
  // reads - one dropdown, grouped like an almanack index
  var SORTS = [
    ["The board", [["close", "Closing soon"], ["new", "Newest"], ["hi", "Price high"], ["lo", "Price low"]]],
    ["The man", [["ovr", "Overall"], ["young", "Age &middot; youngest"], ["old", "Age &middot; oldest"]]],
    ["The reads", [["s:bat", "Batting"], ["s:bowl", "Bowling"], ["s:keep", "Keeping"], ["s:field", "Fielding"],
      ["s:tech", "Technique"], ["s:pow", "Power"], ["s:end", "Endurance"]]]
  ];
  // the man behind a listing, wherever his card rides
  function manOf(L) { return L.man || (snapOf(L.id) || {}).man || null; }
  // one summary read off the open card; -1 where he has no such trade (or no
  // card at all), so the unreadable sink to the bottom of any skill sort
  function readOf(man, k) {
    if (!man || !man.skills) return -1;
    try {
      if (k === "bat") return Math.round(aggBat(man));
      if (k === "bowl") {
        var isB = man.bowlTypeFull ? man.bowlTypeFull !== "none" : !!man.bowlType;
        return isB ? Math.round(aggBowl(man)) : -1;
      }
      if (k === "keep") return man.keeper ? Math.round(aggKeep(man)) : -1;
      if (k === "field") return Math.round(aggField(man));
      if (k === "tech") return Math.round(aggTech(man));
      if (k === "pow") return Math.round((man.skills && man.skills.power) || 0);
      if (k === "end") return Math.round(aggEnd(man));
    } catch (e) {}
    return -1;
  }
  function ovrOf(L) {
    var m = manOf(L);
    try { return m && window.foPkOvr ? (foPkOvr(m) | 0) : -1; } catch (e) { return -1; }
  }
  function ageOf(L) { var m = manOf(L); return m && m.age ? +m.age : 0; }
  function closeKey(L) {
    var ms = +(L.closesMs != null ? L.closesMs : L.closes_ms) || 0;
    return ms || (+L.closes_day || 0) * 86400000;
  }
  // a league's plain name off the atlas; the id in capitals when it is shy
  function natNm(id) {
    try {
      var rs = window.__foCxAPI.regions();
      for (var i = 0; i < rs.length; i++) if (rs[i].id === id) return rs[i].nm;
    } catch (e) {}
    return String(id || "").toUpperCase();
  }
  function natFlag(nat) {
    try { return (window.foFlag && nat) ? foFlag(nat) : ""; } catch (e) { return ""; }
  }
  function boardHtml(cl) {
    if (!MK.listings) return "<div class='fo-mk-none'>Reading the board&hellip;</div>";
    if (!MK.listings.length) return "<div class='fo-mk-none'>The board is bare today. The umpire trickles new names on daily &mdash; look in tomorrow.</div>";
    var myBids = (MK.mine && MK.mine.bids) || [];
    var rows = MK.listings.slice();
    if (MK.nat !== "all") rows = rows.filter(function (L) { return L.country_id === MK.nat; });
    if (MK.role !== "all") rows = rows.filter(function (L) { return bucketOf(L) === MK.role; });
    if (MK.sort === "close") rows.sort(function (a, b) { return closeKey(a) - closeKey(b); });
    else if (MK.sort === "new") rows.sort(function (a, b) { return (b.id | 0) - (a.id | 0); });
    else if (MK.sort === "hi") rows.sort(function (a, b) { return (+(b.high || b.asking) || 0) - (+(a.high || a.asking) || 0); });
    else if (MK.sort === "lo") rows.sort(function (a, b) { return (+(a.high || a.asking) || 0) - (+(b.high || b.asking) || 0); });
    else if (MK.sort === "ovr") rows.sort(function (a, b) { return ovrOf(b) - ovrOf(a); });
    else if (MK.sort === "young") rows.sort(function (a, b) { return (ageOf(a) || 99) - (ageOf(b) || 99); });
    else if (MK.sort === "old") rows.sort(function (a, b) { return ageOf(b) - ageOf(a); });
    else if (MK.sort.indexOf("s:") === 0) {
      var k9 = MK.sort.slice(2);
      rows.sort(function (a, b) { return readOf(manOf(b), k9) - readOf(manOf(a), k9); });
    }
    // the nations actually on the board today, alphabetised by name
    var natIds = {};
    MK.listings.forEach(function (L) { if (L.country_id) natIds[L.country_id] = 1; });
    var natList = Object.keys(natIds).map(function (id) { return [id, natNm(id)]; })
      .sort(function (a, b) { return a[1] < b[1] ? -1 : 1; });
    var bar = "<div class='fo-mk-bar'>" +
      "<div class='fo-mk-rtabs'>" + ROLE_TABS.map(function (t) {
        return "<button class='" + (MK.role === t[0] ? "on" : "") + "' data-mk-role='" + t[0] + "'>" + t[1] + "</button>";
      }).join("") + "</div>" +
      "<span class='cnt'>" + rows.length + " of " + MK.listings.length + " names</span>" +
      "<label class='dd'>League" +
      "<select id='fo-mk-nat'><option value='all'>All nations</option>" + natList.map(function (n) {
        return "<option value='" + E(n[0]) + "'" + (MK.nat === n[0] ? " selected" : "") + ">" + E(n[1]) + "</option>";
      }).join("") + "</select></label>" +
      "<label class='dd'>Sort" +
      "<select id='fo-mk-sort'>" + SORTS.map(function (g) {
        return "<optgroup label='" + g[0] + "'>" + g[1].map(function (s2) {
          return "<option value='" + s2[0] + "'" + (MK.sort === s2[0] ? " selected" : "") + ">" + s2[1] + "</option>";
        }).join("") + "</optgroup>";
      }).join("") + "</select></label>" +
      "</div>";
    var vis = rows.slice(0, MK.shown);
    var more = rows.length > vis.length
      ? "<button class='fo-mk-more' data-mk-more>Show " + Math.min(40, rows.length - vis.length) +
        " more &middot; " + (rows.length - vis.length) + " still on the board</button>"
      : "";
    return bar +
      (vis.length ? vis.map(function (L) { return rowHtml(L, cl, myBids); }).join("")
        : "<div class='fo-mk-none'>Nobody of that kind on the board today.</div>") +
      more +
      "<p class='fo-mk-note'>Every listed man's card is open &mdash; age, wages and all seven summary reads sit on the board for all to see. " +
      "The hammer has a minute hand: a bid landed inside the final ten minutes pushes it back to ten minutes out, " +
      "so an auction ends in a bidding war, never a snipe. The umpire settles the sale on his next pass; " +
      "the highest offer at or above the reserve takes the man whether you are awake or not.</p>";
  }

  function sellHtml(cl) {
    var me = null; try { me = userTeam(); } catch (e) {}
    var men = (me && me.players) || [];
    if (!jwt()) return "<div class='fo-mk-none'>Sign in to the account that holds your club to deal." +
      "<br><button type='button' class='fo-door-btn' data-fo-door>Sign in</button></div>";
    if (!men.length) return "<div class='fo-mk-none'>No squad on the device yet.</div>";
    var listedNames = {};
    ((MK.mine && MK.mine.sales) || []).forEach(function (s) { if (s.status === "open") listedNames[s.player] = s; });
    var rows = men.map(function (p) {
      var open = listedNames[p.name];
      var qp = qsPrice(p);
      return "<div class='fo-mk-srow'>" +
        "<div class='fo-mk-swho'><b>" + E(p.name) + "</b><span>" + (p.age ? p.age + " yrs &middot; " : "") + "worth about " + money(Math.max(5000, +p.fee || 40000)) + "</span></div>" +
        (open
          ? "<span class='fo-mk-on'>On the board &middot; reserve " + money(open.reserve) + " &middot; " + (open.bids || 0) + " offers</span>"
          : "<div class='fo-mk-sbtns'>" +
            "<button class='fo-mk-b' data-mk-list='" + E(p.name) + "'>List&hellip;</button>" +
            "<button class='fo-mk-b ghost' data-mk-qs='" + E(p.name) + "' data-fee='" + qp + "'>Quick-sell " + money(qp) + "</button>" +
            "<button class='fo-mk-b danger' data-mk-rel='" + E(p.name) + "'>Release</button>" +
            "</div>") +
        "</div>";
    }).join("");
    var myBids = ((MK.mine && MK.mine.bids) || []).map(function (b) {
      return "<div class='fo-mk-srow slim'><div class='fo-mk-swho'><b>" + E(b.player) + "</b>" +
        "<span>your offer " + money(b.amount) + " &middot; hammer " + E(dayTxt(b.closes)) + "</span></div></div>";
    }).join("");
    return (myBids ? "<div class='fo-mk-k'>Offers you have out</div>" + myBids : "") +
      "<div class='fo-mk-k'>Your men</div>" + rows +
      "<p class='fo-mk-note'>Listing puts him up for exactly three days at a reserve you name &mdash; his full card open on the board &mdash; and late bids stretch the hammer, ten minutes at a time. Unsold, he simply comes home. " +
      "A quick-sell is the bank's money, instantly, at half his valuation &mdash; it lands with the next settle of the books. A release is for nothing.</p>";
  }

  function registerHtml() {
    if (!MK.deals || !MK.deals.length) return "<div class='fo-mk-none'>No deals done yet in this league.</div>";
    return MK.deals.map(function (d) {
      var to = d.to_club === "the bank" ? "quick-sold to the bank"
             : d.to_club === "released" ? "released"
             : "to <b>" + E(d.to_club || "a club") + "</b>";
      return "<div class='fo-mk-deal'><b>" + E(d.player) + "</b> &middot; " + E(d.from_club || "Free agent") +
        " " + (d.to_club === "released" ? to : "&rarr; " + to) +
        "<span>" + (Number(d.fee) ? money(d.fee) : "no fee") + " &middot; " + E(dayTxt(d.settled_day)) + "</span></div>";
    }).join("");
  }

  // ---- the page -------------------------------------------------------------
  function foRenderMarketPage() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/market") return;
      var page = document.getElementById("page"); if (!page) return;
      document.body.classList.remove("fo-scb-on", "fo-drs-on", "fo-boss-on");
      css();
      var cl = claim();
      if (!cl || !cl.country) {
        page.innerHTML = "<div class='fo-mk'>" + mast() +
          "<div class='fo-mk-none'>The market is the served world's. Claim a club in the world and the board opens.</div></div>";
        return;
      }
      refetch();
      paint();
    } catch (e) { try { console.warn("foRenderMarketPage", e); } catch (e2) {} }
  }
  function mast() {
    var n = MK.listings ? MK.listings.length : null;
    return "<div class='fo-mk-hd'><div><h1>Transfer market</h1>" +
      "<p>Open outcry, open cards, a hammer with a minute hand &mdash; a bid in the final ten minutes moves it back ten.</p></div>" +
      "<div class='chip'><span>On the board</span><b>" + (n == null ? "&hellip;" : n + " name" + (n === 1 ? "" : "s")) + "</b></div></div>";
  }
  function paint() {
    var page = document.getElementById("page"); if (!page) return;
    if ((location.hash || "").split("?")[0] !== "#/market") return;
    var cl = claim();
    var t = MK.tab;
    var html = "<div class='fo-mk'>" + mast() +
      "<div class='fo-mk-tabs'>" +
      "<button class='" + (t === "board" ? "on" : "") + "' data-mk-tab='board'>The board" + (MK.listings ? " &middot; " + MK.listings.length : "") + "</button>" +
      "<button class='" + (t === "sell" ? "on" : "") + "' data-mk-tab='sell'>My dealings</button>" +
      "<button class='" + (t === "reg" ? "on" : "") + "' data-mk-tab='reg'>The register</button>" +
      "</div>" +
      (t === "board" ? boardHtml(cl) : t === "sell" ? sellHtml(cl) : registerHtml()) +
      "<div class='fo-mk-foot'><a href='#/home'>&#8592; The club</a><a href='#/squad'>The squad &rsaquo;</a><a href='#/finance'>The books &rsaquo;</a></div>" +
      "</div>";
    if (page.__foMkHtml === html && page.querySelector(".fo-mk")) return;
    page.__foMkHtml = html;
    page.innerHTML = html;
    try {
      var so = document.getElementById("fo-mk-sort");
      if (so) so.addEventListener("change", function () { MK.sort = so.value; paint(); });
      var no = document.getElementById("fo-mk-nat");
      if (no) no.addEventListener("change", function () { MK.nat = no.value; MK.shown = 40; paint(); });
    } catch (e9) {}
  }

  // ---- the deeds ------------------------------------------------------------
  document.addEventListener("click", function (ev) {
    var t9 = ev.target && ev.target.closest ? ev.target : null; if (!t9) return;
    var b;
    if ((b = t9.closest("[data-mk-tab]"))) { MK.tab = b.getAttribute("data-mk-tab"); paint(); return; }
    if ((b = t9.closest("[data-mk-role]"))) { MK.role = b.getAttribute("data-mk-role"); MK.shown = 40; paint(); return; }
    if ((b = t9.closest("[data-mk-more]"))) { MK.shown += 40; paint(); return; }
    if ((b = t9.closest("[data-mk-full]"))) {
      var idF = +b.getAttribute("data-mk-full");
      MK.open[idF] = !MK.open[idF];
      paint(); return;
    }
    if ((b = t9.closest("[data-mk-bid]"))) {
      var id = +b.getAttribute("data-mk-bid"), min = +b.getAttribute("data-min") || STEP;
      var amt = prompt("Your offer (the board wants at least " + min + "):", String(min));
      if (amt == null) return;
      amt = Math.round(+String(amt).replace(/[^0-9]/g, ""));
      if (!(amt > 0)) return;
      rpc("world_market_bid", { p_id: id, p_amount: amt }).then(function () {
        toastMsg("Offer in: $" + amt.toLocaleString() + ". Highest when the hammer falls takes him.");
        refetch(true);
      }).catch(sayErr);
      return;
    }
    if ((b = t9.closest("[data-mk-withdraw]"))) {
      rpc("world_market_withdraw", { p_id: +b.getAttribute("data-mk-withdraw") })
        .then(function () { toastMsg("Withdrawn. He stays yours."); refetch(true); }).catch(sayErr);
      return;
    }
    if ((b = t9.closest("[data-mk-list]"))) {
      var nm = b.getAttribute("data-mk-list");
      var res = prompt("Reserve for " + nm + " — the least you will accept:", "20000");
      if (res == null) return;
      res = Math.round(+String(res).replace(/[^0-9]/g, ""));
      if (!(res > 0)) return;
      rpc("world_market_list", { p_player: nm, p_reserve: res }).then(function (r) {
        toastMsg(nm + " is on the board · the hammer falls in three days");
        refetch(true);
      }).catch(sayErr);
      return;
    }
    if ((b = t9.closest("[data-mk-qs]"))) {
      var nm2 = b.getAttribute("data-mk-qs"), fee = +b.getAttribute("data-fee");
      if (!confirm("Quick-sell " + nm2 + " to the bank for $" + fee.toLocaleString() + "? This is immediate and final.")) return;
      rpc("world_market_quicksell", { p_player: nm2 }).then(function (r) {
        toastMsg(nm2 + " sold to the bank for $" + ((r && r.fee) || fee).toLocaleString() + ". The fee lands with the next settle.");
        refetch(true);
      }).catch(sayErr);
      return;
    }
    if ((b = t9.closest("[data-mk-rel]"))) {
      var nm3 = b.getAttribute("data-mk-rel");
      if (!confirm("Release " + nm3 + " for nothing? He walks, and he does not come back.")) return;
      rpc("world_market_release", { p_player: nm3 }).then(function () {
        toastMsg(nm3 + " released."); refetch(true);
      }).catch(sayErr);
      return;
    }
  });

  // the board breathes while you watch it
  setInterval(function () {
    try { if ((location.hash || "").split("?")[0] === "#/market") refetch(); } catch (e) {}
  }, 45000);

  // ---- the clothes ----------------------------------------------------------
  function css() {
    if (document.getElementById("fo-mkt-css")) return;
    var s = document.createElement("style"); s.id = "fo-mkt-css";
    s.textContent = [
      "html body #page .fo-mk{max-width:880px;margin:26px auto 44px;padding:0 14px;color:#141C28}",
      // the masthead: an almanack page-head, ruled off like a ledger
      "html body #page .fo-mk-hd{display:flex;align-items:flex-end;gap:12px;padding-bottom:14px;margin-bottom:2px;border-bottom:3px double rgba(20,36,58,.22)}",
      "html body #page .fo-mk-hd h1{font:700 31px/1 Oswald,sans-serif;text-transform:uppercase;color:#14243A;margin:0;letter-spacing:.015em}",
      "html body #page .fo-mk-hd p{font:italic 400 12.5px/1.5 Georgia,serif;color:rgba(20,28,40,.55);margin:7px 0 0;max-width:56ch}",
      "html body #page .fo-mk-hd .chip{margin-left:auto;flex:none;text-align:right;padding-bottom:2px}",
      "html body #page .fo-mk-hd .chip span{display:block;font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#8a93a2}",
      "html body #page .fo-mk-hd .chip b{display:block;font:600 19px/1.3 'Fraunces',Georgia,serif;color:#14243A;font-variant-numeric:tabular-nums}",
      // the rooms: ink tabs under the rule, the active one underscored in orange
      "html body #page .fo-mk-tabs{display:flex;gap:26px;margin:0 0 16px;border-bottom:1px solid rgba(20,36,58,.12);overflow-x:auto}",
      "html body #page .fo-mk-tabs button{font:600 10.5px/1 Oswald,sans-serif !important;letter-spacing:.13em;text-transform:uppercase;color:#8a93a2 !important;background:transparent !important;border:0 !important;border-bottom:2px solid transparent !important;border-radius:0 !important;padding:13px 2px 12px !important;margin-bottom:-1px;cursor:pointer;white-space:nowrap;transition:color .15s}",
      "html body #page .fo-mk-tabs button:hover{color:#1B2432 !important;background:transparent !important}",
      "html body #page .fo-mk-tabs button.on{color:#14243A !important;border-bottom-color:#C9571F !important}",
      // one quiet toolbar: role shelves, the count, the sort
      "html body #page .fo-mk-bar{display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}",
      "html body #page .fo-mk-rtabs{display:inline-flex;gap:0;background:#FFFEFC;border:1px solid rgba(27,36,50,.12);border-radius:999px;padding:3px;overflow-x:auto}",
      "html body #page .fo-mk-rtabs button{padding:8px 15px !important;border:0 !important;background:transparent !important;border-radius:999px !important;font:600 9.5px/1 Oswald,sans-serif !important;letter-spacing:.1em;text-transform:uppercase;color:#67748a !important;white-space:nowrap;cursor:pointer;min-height:32px;transition:color .15s}",
      "html body #page .fo-mk-rtabs button:hover{color:#1B2432 !important;background:transparent !important}",
      "html body #page .fo-mk-rtabs button.on{background:#14243A !important;color:#F1EEE6 !important}",
      "html body #page .fo-mk-bar .cnt{margin-left:auto;font:600 9px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8a93a2;font-variant-numeric:tabular-nums}",
      "html body #page .fo-mk-bar .dd{display:inline-flex;align-items:center;gap:7px;font:600 9px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8a93a2}",
      "html body #page .fo-mk-bar select{border:1px solid rgba(27,36,50,.14) !important;border-radius:8px !important;background:#FFFEFC !important;font:500 11px/1.4 Inter,sans-serif !important;color:#14243A !important;min-height:32px;padding:0 8px !important}",
      // THE BID RAIL CARD: identity and reads on paper, the money in navy
      "html body #page .fo-mk-row{display:grid;grid-template-columns:1fr 225px;background:#FFFEFC;border:1px solid rgba(27,36,50,.1);border-radius:16px;overflow:hidden;margin-bottom:13px;box-shadow:0 3px 12px rgba(14,35,63,.06)}",
      "html body #page .fo-mk-row.lead{border-color:rgba(23,122,87,.4)}",
      "html body #page .fo-mk-row .bd{padding:19px 26px 15px;min-width:0}",
      "html body #page .fo-mk-row .tp{display:flex;align-items:center;gap:13px}",
      "html body #page .fo-mk-row .ovr{flex:none;width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:#14243A;color:#F6EFDF;border-radius:11px;font:600 17px/1 Oswald,sans-serif;font-variant-numeric:tabular-nums}",
      "html body #page .fo-mk-row .nm{min-width:0}",
      "html body #page .fo-mk-row .nm b{display:block;font:600 19px/1.15 'Fraunces',Georgia,serif;color:#141C28;letter-spacing:.005em}",
      "html body #page .fo-mk-row .nm a.pdoor{text-decoration:none;color:inherit}",
      "html body #page .fo-mk-row .nm a.pdoor:hover b{color:#C9571F;text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:3px}",
      "html body #page .fo-mk-row .nm .mt{display:block;font:400 11px/1.6 Inter,sans-serif;color:#7d8798;margin-top:2px}",
      "html body #page .fo-mk-row .mt .natc{display:inline-flex;align-items:center;gap:5px;font:600 10.5px/1 Inter,sans-serif;color:#4a5568;vertical-align:middle}",
      "html body #page .fo-mk-row .mt .natc img{width:18px;height:12px;object-fit:cover;border-radius:2px;box-shadow:0 0 0 1px rgba(27,36,50,.14);display:inline-block}",
      // three role-picked gauges: what he is BOUGHT for, big and calm
      "html body #page .fo-mk-row .gg{display:flex;gap:34px;margin-top:16px}",
      "html body #page .fo-mk-row .gg .g{width:96px;min-width:0}",
      "html body #page .fo-mk-row .gg .lb{display:block;font:600 8px/1 Oswald,sans-serif;letter-spacing:.17em;text-transform:uppercase;color:#98a0ae}",
      "html body #page .fo-mk-row .gg .vl{display:block;font:600 26px/1.2 Oswald,sans-serif;color:#14243A;font-variant-numeric:tabular-nums}",
      "html body #page .fo-mk-row .gg .g.lead .vl{color:#C9571F}",
      "html body #page .fo-mk-row .gg .tr{display:block;height:3.5px;border-radius:2px;background:#EDE8DC;margin-top:3px;overflow:hidden}",
      "html body #page .fo-mk-row .gg .fl{display:block;height:100%;border-radius:2px;background:#4E8A72}",
      "html body #page .fo-mk-row .gg .g.lead .fl{background:#C9571F}",
      "html body #page .fo-mk-row .gg .g.off .vl{color:#c3c9d2}",
      "html body #page .fo-mk-row .gg .g.off .fl{background:#E3DECF}",
      // the fold: Full card opens the seven reads as toned bars
      "html body #page .fo-mk-row .fold{display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:2px 0 !important;font:600 8.5px/1 Oswald,sans-serif !important;letter-spacing:.16em;text-transform:uppercase;color:#C9571F !important;background:transparent !important;border:0 !important;border-radius:0 !important;cursor:pointer;box-shadow:none !important}",
      "html body #page .fo-mk-row .fold:hover{color:#A64426 !important;background:transparent !important}",
      "html body #page .fo-mk-row .fold svg{width:11px;height:11px;transition:transform .18s}",
      "html body #page .fo-mk-row .fold.on svg{transform:rotate(180deg)}",
      "html body #page .fo-mk-full{margin-top:11px;padding:13px 0 3px;border-top:1px dashed rgba(27,36,50,.18);display:grid;grid-template-columns:1fr 1fr;gap:7px 34px}",
      "html body #page .fo-mk-full .fb{display:grid;grid-template-columns:72px 1fr 30px;gap:10px;align-items:center}",
      "html body #page .fo-mk-full .fb i{font-style:normal;font:600 8px/1 Oswald,sans-serif;letter-spacing:.15em;text-transform:uppercase;color:#98a0ae}",
      "html body #page .fo-mk-full .fb u{display:block;height:6px;background:#EDE8DC;border-radius:3px;overflow:hidden;text-decoration:none}",
      "html body #page .fo-mk-full .fb u s{display:block;height:100%;border-radius:3px;text-decoration:none}",
      "html body #page .fo-mk-full .fb u s.t1{background:#C05B45}",
      "html body #page .fo-mk-full .fb u s.t2{background:#D9A441}",
      "html body #page .fo-mk-full .fb u s.t3{background:#4E8A72}",
      "html body #page .fo-mk-full .fb u s.t4{background:#177A57}",
      "html body #page .fo-mk-full .fb b{font:600 12.5px/1 Inter,sans-serif;text-align:right;color:#2a3444;font-variant-numeric:tabular-nums}",
      "html body #page .fo-mk-full .fb.off i,html body #page .fo-mk-full .fb.off b{color:#c9ceda}",
      // provenance: whose man, which league, the scout's word
      "html body #page .fo-mk-row .prov{display:flex;align-items:center;gap:11px;margin-top:13px;flex-wrap:wrap}",
      "html body #page .fo-mk-row .prov .tag{flex:none;font:600 8px/1 Oswald,sans-serif;letter-spacing:.11em;text-transform:uppercase;color:#7A5480;background:rgba(122,84,128,.07);border:1px solid rgba(122,84,128,.22);border-radius:6px;padding:5px 8px}",
      "html body #page .fo-mk-row .prov .tag.fa{color:#1F6F4A;background:rgba(31,111,74,.07);border-color:rgba(31,111,74,.22)}",
      "html body #page .fo-mk-row .prov .imp{flex:1;min-width:0;font:italic 400 11px/1.5 Georgia,serif;color:rgba(20,28,40,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      // THE RAIL: one navy field holding everything about the money
      "html body #page .fo-mk-row .rail{background:linear-gradient(170deg,#14243A,#0C1C31);color:#F6EFDF;padding:20px;display:flex;flex-direction:column;gap:7px;justify-content:center}",
      "html body #page .fo-mk-row.lead .rail{background:linear-gradient(170deg,#14313A,#0C2420)}",
      "html body #page .fo-mk-row .rail .lb{font:600 7.5px/1.4 Oswald,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:rgba(246,239,223,.5)}",
      "html body #page .fo-mk-row .rail .amt{font:600 29px/1 Oswald,sans-serif;color:#FFFDF7;font-variant-numeric:tabular-nums}",
      "html body #page .fo-mk-row .rail .ld{font:400 10.5px/1.5 Inter,sans-serif;color:rgba(246,239,223,.62);margin-top:-2px}",
      "html body #page .fo-mk-row .rail .ld.you{color:#8FD6B5;font-weight:600}",
      "html body #page .fo-mk-row .rail .hmwrap{display:block;margin-top:4px}",
      "html body #page .fo-mk-row .rail .clk{display:block;font:600 19px/1.15 Oswald,sans-serif;letter-spacing:.07em;font-variant-numeric:tabular-nums;color:#E8B96A}",
      "html body #page .fo-mk-row .rail .clk.soon{color:#FF9E86}",
      "html body #page .fo-mk-row .rail .clk.final{color:#FF9E86;animation:fo-mk-beat 1.1s ease-in-out infinite}",
      "html body #page .fo-mk-row .rail .clk.gone{color:rgba(246,239,223,.8);letter-spacing:.18em}",
      "html body #page .fo-mk-row .rail .hnote{display:block;font:italic 400 10px/1.45 Georgia,serif;color:rgba(255,180,160,.85);margin-top:3px}",
      "@keyframes fo-mk-beat{0%,100%{opacity:1}50%{opacity:.55}}",
      "@media(prefers-reduced-motion:reduce){html body #page .fo-mk-row .rail .clk.final{animation:none}}",
      "html body #page .fo-mk-row .rail .act{margin-top:10px;font:600 9.5px/1 Oswald,sans-serif !important;letter-spacing:.16em;text-transform:uppercase;color:#FFFEFC !important;background:#C9571F !important;border:0 !important;border-radius:999px !important;padding:12px 0 !important;width:100%;cursor:pointer;transition:background .15s}",
      "html body #page .fo-mk-row .rail .act:hover{background:#A64426 !important}",
      "html body #page .fo-mk-row .rail .act.hot{background:#8E1F13 !important}",
      "html body #page .fo-mk-row .rail .act.hot:hover{background:#6F160D !important}",
      "html body #page .fo-mk-row .rail .act.ghost{color:rgba(246,239,223,.85) !important;background:transparent !important;border:1px solid rgba(246,239,223,.35) !important}",
      "html body #page .fo-mk-row .rail .act.ghost:hover{background:rgba(255,255,255,.08) !important}",
      // the door to the rest of a big board
      "html body #page .fo-mk-more{display:block;width:100%;margin:2px 0 0;padding:13px !important;font:600 10px/1 Oswald,sans-serif !important;letter-spacing:.13em;text-transform:uppercase;color:#67748a !important;background:#FFFEFC !important;border:1px dashed rgba(27,36,50,.25) !important;border-radius:12px !important;cursor:pointer}",
      "html body #page .fo-mk-more:hover{color:#B44A22 !important;border-color:rgba(201,87,31,.5) !important;background:#FFFEFC !important}",
      // the manager's own desk + the register, kept in the same voice
      "html body #page .fo-mk-k{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#B44A22;margin:22px 2px 9px}",
      "html body #page .fo-mk-k:after{content:'';display:block;width:34px;border-top:2px solid #C95532;margin-top:6px}",
      "html body #page .fo-mk-srow{display:flex;align-items:center;gap:12px;background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:12px;padding:11px 15px;margin-bottom:8px}",
      "html body #page .fo-mk-srow.slim{border-style:dashed}",
      "html body #page .fo-mk-swho{min-width:0;flex:1}",
      "html body #page .fo-mk-swho b{font:600 14px/1.25 'Fraunces',Georgia,serif;color:#141C28}",
      "html body #page .fo-mk-swho span{display:block;font:400 11px/1.4 Inter,sans-serif;color:rgba(20,28,40,.5);margin-top:2px}",
      "html body #page .fo-mk-sbtns{display:flex;gap:7px;flex:0 0 auto;flex-wrap:wrap;justify-content:flex-end}",
      "html body #page .fo-mk-b{font:600 9px/1 Oswald,sans-serif !important;letter-spacing:.11em;text-transform:uppercase;color:#FFFEFC !important;background:#C9571F !important;border:1px solid #C9571F !important;border-radius:999px !important;padding:9px 14px !important;cursor:pointer;min-height:32px;transition:background .15s,color .15s}",
      "html body #page .fo-mk-b:hover{background:#A64426 !important;border-color:#A64426 !important}",
      "html body #page .fo-mk-b.ghost{background:#FFFEFC !important;color:#67748a !important;border-color:rgba(27,36,50,.2) !important}",
      "html body #page .fo-mk-b.ghost:hover{color:#B44A22 !important;border-color:rgba(201,87,31,.5) !important;background:#FFFEFC !important}",
      "html body #page .fo-mk-b.danger{background:#FFFEFC !important;color:#B23230 !important;border-color:rgba(200,60,58,.35) !important}",
      "html body #page .fo-mk-b.danger:hover{background:rgba(200,60,58,.06) !important}",
      "html body #page .fo-mk-on{font:600 11px/1.3 Inter,sans-serif;color:#177A57}",
      "html body #page .fo-mk-deal{background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:12px;padding:11px 15px;margin-bottom:8px;font:400 12.5px/1.5 Inter,sans-serif;color:rgba(20,28,40,.75)}",
      "html body #page .fo-mk-deal b{color:#141C28;font-family:'Fraunces',Georgia,serif}",
      "html body #page .fo-mk-deal span{display:block;font-size:10.5px;color:rgba(20,28,40,.5)}",
      "html body #page .fo-mk-note{font:italic 400 12px/1.65 Georgia,serif;color:rgba(20,28,40,.52);max-width:66ch;margin:16px 2px}",
      "html body #page .fo-mk-none{background:#FFFEFC;border:1px dashed rgba(20,28,40,.2);border-radius:14px;padding:28px;text-align:center;font:italic 400 13px/1.5 Georgia,serif;color:rgba(20,28,40,.55)}",
      "html body #page .fo-mk-foot{display:flex;gap:10px;justify-content:space-between;margin-top:20px;flex-wrap:wrap}",
      "html body #page .fo-mk-foot a{font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
      "html body #page .fo-mk-foot a:hover{color:#B44A22;text-decoration:none}",
      // narrower grounds: the rail becomes the card's foot, gauges close ranks
      "@media(max-width:640px){",
      "html body #page .fo-mk-row{grid-template-columns:1fr}",
      "html body #page .fo-mk-row .rail{padding:16px 20px}",
      "html body #page .fo-mk-row .gg{gap:20px}",
      "html body #page .fo-mk-row .gg .g{flex:1 1 0;width:auto}",
      "html body #page .fo-mk-full{grid-template-columns:1fr;gap:7px}",
      "html body #page .fo-mk-srow{flex-wrap:wrap}",
      "html body #page .fo-mk-tabs{gap:18px}",
      "}"
    ].join("\n");
    document.body.appendChild(s);
  }

  window.foRenderMarketPage = foRenderMarketPage;
})();
