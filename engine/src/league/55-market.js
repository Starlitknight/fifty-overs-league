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
  // THE THREE PERCENT LAW (054): a raise clears the standing high by at
  // least 3% (never under $500); the first offer opens at 55% of asking.
  // Mirror of world_market_bid - this must not drift from the umpire's law.
  function minRaise(high, asking) {
    return high ? high + Math.max(STEP, Math.ceil(high * 0.03))
                : Math.ceil((+asking || 0) * 0.55);
  }
  // exact dollars, for the sums where "$1k" hides the truth of a wage or bid
  function exact(v) { var n = Math.round(+v || 0); return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US"); }
  // AGE RUNS ON THE WORLD'S OWN CALENDAR: one year is one season, to the
  // day. The squad module's __foAge is the single authority (name-hashed
  // birthday, day-of-season off the planet clock) - the market defers to
  // it so every page in the game reads the same figure for the same man.
  function ageTxt(man) {
    if (!man || !man.age) return "";
    try {
      var A = window.__foAge;
      if (A && A.parts) { var a = A.parts(man); return a.y + "y " + a.d + "d"; }
    } catch (e) {}
    return (man.age | 0) + " yrs";
  }
  // a talent, in the scout's words rather than the database's
  var TALENT_LBL = { bigMatch: "Big-match", anchor: "Anchor", finisher: "Finisher", sixMachine: "Six machine",
    busyRunner: "Busy runner", spinKiller: "Spin killer", paceHunter: "Pace hunter", goldenArm: "Golden arm",
    deathBowler: "Death bowler", newBall: "New-ball", partnership: "Partnership man", ironLungs: "Iron lungs" };
  function talentLbl(t) {
    return TALENT_LBL[t] || String(t || "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()
      .replace(/^./, function (c) { return c.toUpperCase(); });
  }

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
    if (window.foMoney) return window.foMoney(v);
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
  /* THE SPINE: which country a man comes from, said in colour.
   *
   * The market is the only room in the game where cricketers from sixteen
   * nations stand side by side on one board, and a border round a card is
   * mostly there to say where one lot ends and the next begins. This one does
   * that and one useful thing more - a solid edge down the left in the man's
   * own country's colour, so a manager scanning forty lots finds the Afghan
   * spinners without reading a single line.
   *
   * The colours are not invented here: they are the accents each nation
   * already wears on its crest and its boss plate, so the board agrees with
   * every other room the reader has been in.
   */
  var NAT_SPINE = {
    eng: "#2F6B45", ire: "#2E8B67", ned: "#D06A19", win: "#B78926", rsa: "#B7352B",
    zim: "#D15B22", aus: "#D59600", nzl: "#079B99", slk: "#216DB5", sub: "#7A44C5",
    pak: "#1E7F5C", afg: "#5B4A91", bgd: "#177A57", nep: "#B5304C", sco: "#2B5AA6",
    wal: "#A62A2E", ken: "#237A46", usa: "#33366E", can: "#C2483B"
  };
  function spineOf(rid) { return NAT_SPINE[rid] || "#6A6354"; }

  function toastMsg(m) { try { toast(m); } catch (e) { try { console.info("[fifty-overs] " + m); } catch (e2) {} } }
  // the market's decisions are taken on the board itself
  function decide(el, o) {
    if (window.foDecide) { window.foDecide(el, o); return; }
    try { if (o && o.onYes) o.onYes(o.input ? o.input.value : undefined); } catch (e) {}
  }
  function sayErrAt(el, m) {
    if (window.foSayAt) { window.foSayAt(el, m, "error"); return; }
    try { console.warn("[fifty-overs] " + m); } catch (e) {}
  }
  function sayErr(e) { toastMsg(String((e && e.message) || e).replace(/^error:\s*/i, "")); }

  // THE UMPIRE'S OWN ARITHMETIC, mirrored so the page can say a price before
  // the button is pressed. server/market.mjs (valueOf) and migration 042
  // (world_market_quicksell) are the authorities; this must not drift.
  function ageCurve(a) {
    a = +a || 27;
    return a <= 21 ? 1.18 : a <= 25 ? 1.12 : a <= 28 ? 1.0 : a <= 31 ? 0.82 : a <= 33 ? 0.6 : 0.4;
  }
  // A FEE IS PRICED IN WAGES NOW, so this mirrors that and not the old
  // rating/9. server/market.mjs (valueOf) and the migration below it are the
  // authorities; a quicksell is half what he is worth.
  var FEE_ROUNDS = 18, FEE_MULT = 2.4, W_R50 = 25704, W_MID = 9290, W_K = 2.0;
  function wageOfMan(p) {
    if (p && +p.wage > 0) return +p.wage;
    var r = Math.max(1, (p && +p.rating) || W_R50);
    var t = (p && p.talents && p.talents.length) | 0;
    return Math.max(400, Math.round(W_MID * Math.pow(r / W_R50, W_K) * (1 + 0.06 * t) / 10) * 10);
  }
  function qsPrice(p) {
    var worth = wageOfMan(p) * FEE_ROUNDS * FEE_MULT * ageCurve(p && p.age);
    return Math.max(3000, Math.round(worth * 0.5 / 500) * 500);
  }
  // THE OFFICE, LENT OUT. The player's own page (41) carries the same three
  // deeds - board, quick sale, release - so the price law, the RPC plumbing
  // and the inline decision strip are handed over rather than copied; one
  // arithmetic, wherever the deed is done.
  try { window.__foMktOffice = { qsPrice: qsPrice, rpc: rpc, decide: decide, toast: toastMsg }; } catch (eOf) {}

  // ---- the data on the desk -------------------------------------------------
  var MK = { listings: null, deals: null, mine: null, snap: null, at: 0, busy: 0, tab: "board", role: "all", sort: "close", nat: "all", shown: 40, open: {},
    view: (function () { try { return localStorage.getItem("fo_mkt_view") === "table" ? "table" : "cards"; } catch (e) { return "cards"; } })() };
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
      // every gauge is toned by its VALUE - red is weak, green is strong,
      // wherever the bar sits. Position never lies about quality.
      return "<div class='gg'>" + readPicks(man).map(function (k) {
        var v = readOf(man, k), off = v < 0;
        return "<span class='g" + (off ? " off" : "") +
          "' title='" + READ_LBL[k] + (off ? "" : " &middot; " + E(skWord(v))) + "'>" +
          "<span class='lb'>" + READ_LBL[k] + "</span>" +
          "<span class='vl'>" + (off ? "&ndash;" : v) + "</span>" +
          "<span class='tr'><span class='fl " + skTone(Math.max(0, v)) + "' style='width:" + Math.max(3, Math.max(0, v)) + "%'></span></span>" +
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
      if (man.age) meta.push(ageTxt(man));
      if (man.hand) meta.push(man.hand === "L" ? "left-hand" : "right-hand");
      meta.push(roleLbl(man));
      if (man.expWord) meta.push("exp " + E(man.expWord));
      if (man.wage) meta.push(exact(man.wage) + "/rd wages");
    } else {
      if (sc.age) meta.push(sc.age);
      if (sc.hand) meta.push(E(sc.hand));
      if (sc.role) meta.push(E(sc.role === "allrounder" ? "all-rounder" : sc.role === "keeper" ? "wicketkeeper" : sc.role));
    }
    var ovr = null; try { ovr = (man && window.foPkOvr) ? foPkOvr(man) : null; } catch (eO) {}
    var high = +L.high || 0;
    var minBid = minRaise(high, L.asking);
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
    // the lister's door and the bidder's door: every club name walks
    var clubDoor = (!fa && L.country_id != null && L.slot >= 0)
      ? "#/team?c=" + encodeURIComponent(L.country_id) + "&s=" + (L.slot | 0) : null;
    var provTxt = (fa ? "Free agent" : "Listed by " + E(L.club || "a club")) +
      (L.country_id ? " &middot; " + E(natNm(L.country_id)) : "");
    var hc = L.high_country != null ? L.high_country : L.highCountry;
    var hs = L.high_slot != null ? L.high_slot : L.highSlot;
    // the lead is a name, and the name is a door - YOUR name, your club home
    var bidder = lead ? "<a class='club you' href='#/club'>" + E((cl && cl.club) || "You") + "</a>"
      : high ? ((hc != null && hs != null && hs >= 0)
          ? "<a class='club' href='#/team?c=" + encodeURIComponent(hc) + "&s=" + (hs | 0) + "'>" + E(L.highClub || L.high_club || "a club") + "</a>"
          : "<span class='club'>" + E(L.highClub || L.high_club || "a club") + "</span>")
      : "<span class='club none'>Nobody yet</span>";
    // THE DOSSIER FOOT: talents as gold marks, then the almanack facts that
    // used to be dead white space - asking, reserve, exact wages, offers in
    var talentChips = (man && man.talents && man.talents.length)
      ? "<div class='tlts'>" + man.talents.map(function (t) {
          return "<em title='A talent the scouts know him for'>" + E(talentLbl(t)) + "</em>";
        }).join("") + "</div>" : "";
    var facts = "<div class='facts'>" +
      "<span><i>Asking</i><b>" + money(L.asking) + "</b></span>" +
      "<span><i>Reserve</i><b>" + money(L.reserve) + "</b></span>" +
      (man && man.wage ? "<span><i>Wages</i><b>" + exact(man.wage) + "/rd</b></span>" : "") +
      "<span><i>Offers</i><b>" + (L.offers | 0) + "</b></span>" +
      (man && man.expWord ? "<span><i>Experience</i><b>" + E(man.expWord) + "</b></span>" : "") +
      "</div>";
    // one press placed, the word lands ON the card - never a popup (MK.ok)
    var okStrip = (MK.ok && Number(MK.ok.id) === Number(L.id) && Date.now() - MK.ok.at < 12000)
      ? "<div class='bidok'>&#10003; Offer in: " + exact(MK.ok.amt) + " &mdash; you lead until someone answers</div>" : "";
    return "<div class='fo-mk-row" + (lead ? " lead" : "") + "' data-id='" + L.id +
      "' style='--sp:" + spineOf(L.country_id) + "'>" +
      "<div class='bd'>" +
      "<div class='tp'>" +
      (ovr != null ? "<span class='ovr' title='Overall'><b>" + ovr + "</b><i>OVR</i></span>" : "") +
      "<span class='nm'>" +
      (door ? "<a class='pdoor' href='" + door + "'><b>" + E(L.player) + (man && man.keeper ? " &dagger;" : "") + "</b></a>"
            : "<span class='pdoor fa' data-mk-fa='" + L.id + "' title='Open his full card'><b>" + E(L.player) + (man && man.keeper ? " &dagger;" : "") + "</b></span>") +
      (man && man.age && man.age <= 21 ? "<span class='yth'>Youth &middot; " + (man.age | 0) + "</span>" : "") +
      "<span class='mt'>" + (meta.length ? meta.join(" &nbsp;&middot;&nbsp; ") : "a cricketer") + "</span></span>" +
      "</div>" +
      gaugesHtml(man) +
      talentChips +
      (man && man.skills
        ? "<button class='fold" + (open ? " on" : "") + "' data-mk-full='" + L.id + "'>" +
          "<span>" + (open ? "Close card" : "Full card") + "</span>" + chev + "</button>" +
          (open ? fullCardHtml(man) : "")
        : "") +
      facts +
      "<div class='prov'>" +
      (clubDoor
        ? "<a class='tag' href='" + clubDoor + "'>" + provTxt + " &rsaquo;</a>"
        : "<span class='tag" + (fa ? " fa" : "") + "'>" + provTxt + "</span>") +
      "</div>" +
      "</div>" +
      // THE AUCTIONEER'S LINE (B3): the bidder gets top billing, the price
      // is the biggest thing on the card, and the deed happens right here -
      // AUTO BID at the next minimum, or a figure of your own on one line.
      "<div class='rail'>" +
      "<span class='lb2'>The bidding stands with</span>" +
      bidder +
      "<span class='amt'>" + money(high || L.asking) + "<i>" + (high ? "HIGH" : "ASK") + "</i></span>" +
      (!high ? "<span class='rsv'>reserve " + money(L.reserve) + "</span>" : "") +
      "<span class='lb2 hm'>Hammer</span>" +
      (hmMs
        ? "<span class='hmwrap' data-mk-hh='" + hmMs + "'>" + hammerPlate(hmMs) + "</span>"
        : "<span class='hmwrap'><b class='clk calm'>" + E(dayTxt(L.closes != null ? L.closes : L.closes_day)) + "</b></span>") +
      okStrip +
      (mineSelling
        ? "<button class='act ghost' data-mk-withdraw='" + L.id + "'>Withdraw</button>"
        : "<button class='go' data-mk-bid-auto='" + L.id + "' data-min='" + minBid + "' title='Bid the next minimum, " + money(minBid) + "'>Auto bid</button>" +
          "<div class='cust'><input class='fo-mk-in' id='fo-mk-in-" + L.id + "' inputmode='numeric' placeholder='or your own figure&hellip;'>" +
          "<button class='snd' data-mk-place='" + L.id + "' data-min='" + minBid + "' aria-label='Place your bid'>&rarr;</button></div>" +
          "<div class='bidmsg' id='fo-mk-msg-" + L.id + "'></div>") +
      "</div>" +
      "</div>";
  }

  var ROLE_TABS = [["all", "All"], ["bat", "Bat"], ["bowl", "Bowl"], ["ar", "AR"], ["wk", "WK"]];
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
  /* THE BOARD IS NOT SORTED BY WHERE A MAN IS FROM.
   *
   * Every free agent walked on for a given world day is given the SAME closing
   * day, and the umpire builds them one country at a time - so they arrive
   * with consecutive ids in national blocks. Sort by "closing soon" and every
   * one of those ties compares equal; a stable sort then keeps the order they
   * arrived in, and the board reads as sixteen national squads stacked on top
   * of one another rather than as a market.
   *
   * So every comparison ends in a seeded shuffle of the listing's own id. It
   * is deterministic - the same board draws the same order on every repaint
   * and every device, nothing jumps under a thumb mid-scroll - and it is
   * blind to nationality, which is the whole point. A reader who DOES want
   * one country still has the league filter; he should just never get it by
   * accident.
   */
  function mixOf(L) {
    var s2 = "mix|" + ((L && L.id) | 0), h = 2166136261 >>> 0;
    for (var i = 0; i < s2.length; i++) { h ^= s2.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 3266489917) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }
  function mixed(cmp) {
    return function (a, b) { return cmp(a, b) || (mixOf(a) - mixOf(b)); };
  }
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
    if (MK.sort === "close") rows.sort(mixed(function (a, b) { return closeKey(a) - closeKey(b); }));
    else if (MK.sort === "new") rows.sort(function (a, b) { return (b.id | 0) - (a.id | 0); });
    else if (MK.sort === "hi") rows.sort(mixed(function (a, b) { return (+(b.high || b.asking) || 0) - (+(a.high || a.asking) || 0); }));
    else if (MK.sort === "lo") rows.sort(mixed(function (a, b) { return (+(a.high || a.asking) || 0) - (+(b.high || b.asking) || 0); }));
    else if (MK.sort === "ovr") rows.sort(mixed(function (a, b) { return ovrOf(b) - ovrOf(a); }));
    else if (MK.sort === "young") rows.sort(mixed(function (a, b) { return (ageOf(a) || 99) - (ageOf(b) || 99); }));
    else if (MK.sort === "old") rows.sort(mixed(function (a, b) { return ageOf(b) - ageOf(a); }));
    else if (MK.sort === "wage") rows.sort(mixed(function (a, b) {
      var wa = (manOf(a) || {}).wage || 0, wb = (manOf(b) || {}).wage || 0; return wb - wa;
    }));
    else if (MK.sort.indexOf("s:") === 0) {
      var k9 = MK.sort.slice(2);
      rows.sort(mixed(function (a, b) { return readOf(manOf(b), k9) - readOf(manOf(a), k9); }));
    }
    // AND THE ORDER THE BOARD ARRIVED IN IS NEVER THE ORDER IT IS READ IN.
    // "Newest" is the one sort where the id genuinely IS the answer, so it
    // keeps its own order; everything else - including a board with no sort
    // chosen at all - is shuffled off nationality by the tiebreak above.
    else rows.sort(mixed(function () { return 0; }));
    if (MK.view === "table") return tableHtml(rows, cl, myBids);
    var vis = rows.slice(0, MK.shown);
    var more = rows.length > vis.length
      ? "<button class='fo-mk-more' data-mk-more>Show " + Math.min(40, rows.length - vis.length) +
        " more &middot; " + (rows.length - vis.length) + " still on the board</button>"
      : "";
    return (vis.length ? vis.map(function (L) { return rowHtml(L, cl, myBids); }).join("")
        : "<div class='fo-mk-none'>Nobody of that kind on the board today.</div>") +
      more +
      "<p class='fo-mk-note'>A bid inside the final ten minutes pushes the hammer back to ten minutes out. The highest offer at or above the reserve takes the man whether you are awake or not.</p>";
  }

  // THE TABLE: the whole board as one sortable page of the books. Every
  // name and club is a door, weak reads print ghost-grey like the cards,
  // the hammer column ticks, and one press bids the next minimum.
  var TH_COLS = [["", "The man"], ["age", "Age"], ["ovr", "OVR"], ["s:bat", "Bat"], ["s:bowl", "Bowl"],
    ["s:keep", "Keep"], ["s:field", "Fld"], ["s:tech", "Tec"], ["s:pow", "Pwr"], ["s:end", "End"],
    ["wage", "Wage"], ["hi", "High bid"], ["close", "Hammer"], ["", ""]];
  function tableHtml(rows, cl, myBids) {
    var head = TH_COLS.map(function (c) {
      var on = c[0] && (MK.sort === c[0] || (c[0] === "age" && (MK.sort === "young" || MK.sort === "old")));
      return "<th" + (c[0] ? " data-mk-th='" + c[0] + "'" : "") + (on ? " class='on'" : "") + ">" + c[1] +
        (on ? " <span class='ar'>" + (MK.sort === "old" ? "&#9650;" : MK.sort === "young" ? "&#9660;" : "&#9660;") + "</span>" : "") + "</th>";
    }).join("");
    var body = rows.map(function (L) {
      var man = dress(L).man || null;
      var picks = man ? readPicks(man) : [];
      var high = +L.high || 0;
      var minBid = minRaise(high, L.asking);
      var mineSelling = cl && L.country_id === cl.country && L.slot === cl.slot;
      var myBid = (myBids || []).filter(function (x) { return Number(x.id) === Number(L.id); })[0];
      var lead = myBid && high && +myBid.amount >= high;
      var fa = L.slot < 0;
      var door = L.slot >= 0 && L.country_id
        ? "#/player?c=" + encodeURIComponent(L.country_id) + "&s=" + (L.slot | 0) + "&n=" + encodeURIComponent(L.player) : "";
      var clubDoor = (!fa && L.country_id != null && L.slot >= 0)
        ? "#/team?c=" + encodeURIComponent(L.country_id) + "&s=" + (L.slot | 0) : null;
      var hc = L.high_country != null ? L.high_country : L.highCountry;
      var hs = L.high_slot != null ? L.high_slot : L.highSlot;
      var cells = ["bat", "bowl", "keep", "field", "tech", "pow", "end"].map(function (k) {
        var v = man ? readOf(man, k) : -1;
        if (v < 0) return "<td class='dim'>&ndash;</td>";
        return "<td class='" + (k === picks[0] ? "hot" : v <= 20 ? "dim" : "") + "'>" + v + "</td>";
      }).join("");
      var subBits = [];
      if (man && man.nat) subBits.push(natFlag(man.nat) + " " + E(String(man.nat).toUpperCase()));
      if (man) subBits.push(roleLbl(man));
      subBits.push(fa ? "Free agent" : (clubDoor ? "<a class='cl' href='" + clubDoor + "'>" + E(L.club || "a club") + "</a>" : E(L.club || "a club")));
      var okHere = MK.ok && Number(MK.ok.id) === Number(L.id) && Date.now() - MK.ok.at < 12000;
      return "<tr data-id='" + L.id + "'>" +
        "<td>" + (door ? "<a class='pn' href='" + door + "'>" : "<span class='pn lk' data-mk-fa='" + L.id + "' title='Open his full card'>") + E(L.player) +
        (man && man.keeper ? " &dagger;" : "") + (door ? "</a>" : "</span>") +
        (man && man.age && man.age <= 21 ? "<span class='yth'>Youth</span>" : "") +
        "<span class='sub'>" + subBits.join(" &middot; ") + "</span></td>" +
        "<td>" + (man && man.age ? ageTxt(man) : "&ndash;") + "</td>" +
        "<td>" + (ovrOf(L) > 0 ? "<b class='ovch'>" + ovrOf(L) + "</b>" : "&ndash;") + "</td>" +
        cells +
        "<td>" + (man && man.wage ? exact(man.wage) : "&ndash;") + "</td>" +
        "<td><span class='hb" + (high ? "" : " dim") + "'>" + (high ? money(high) : "no bids") + "</span>" +
        "<span class='hbc'>" + (lead ? "<a class='you' href='#/club'>" + E((cl && cl.club) || "you") + " lead</a>"
          : high ? ((hc != null && hs != null && hs >= 0)
              ? "<a href='#/team?c=" + encodeURIComponent(hc) + "&s=" + (hs | 0) + "'>" + E(L.highClub || L.high_club || "a club") + "</a>"
              : E(L.highClub || L.high_club || "a club"))
          : "reserve " + money(L.reserve)) + "</span></td>" +
        "<td>" + (function () {
          var ms = +(L.closesMs != null ? L.closesMs : L.closes_ms) || 0;
          return ms ? "<span class='hmwrap tbl' data-mk-hh='" + ms + "'>" + hammerPlate(ms) + "</span>"
                    : "<b class='clk calm'>" + E(dayTxt(L.closes != null ? L.closes : L.closes_day)) + "</b>";
        })() + "</td>" +
        "<td>" + (okHere ? "<span class='qok'>&#10003; Offer in</span>"
          : mineSelling
          ? "<button class='qb gh' data-mk-withdraw='" + L.id + "'>Withdraw</button>"
          : "<button class='qb' data-mk-bid-auto='" + L.id + "' data-min='" + minBid + "' title='Bid the next minimum, " + money(minBid) + "'>Auto bid</button>") + "</td>" +
        "</tr>";
    }).join("");
    return "<div class='fo-mk-tblwrap'><table class='fo-mk-tbl'><thead><tr>" + head + "</tr></thead>" +
      "<tbody>" + (body || "<tr><td colspan='14' class='dim' style='text-align:center;padding:26px'>Nobody of that kind on the board today.</td></tr>") + "</tbody></table>" +
      "<div class='tbf'>" + rows.length + " men on the board &middot; Auto bid places the lawful next raise</div></div>";
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
    // OFFERS YOU HAVE OUT, told properly: the man is a door, the offer is
    // the exact figure, the standing of it is coloured, and the hammer ticks
    var myBids = ((MK.mine && MK.mine.bids) || []).map(function (b) {
      var L = (MK.listings || []).filter(function (x) { return Number(x.id) === Number(b.id); })[0];
      var high = L ? +L.high || 0 : 0;
      var leadB = high && +b.amount >= high;
      var door = L && L.slot >= 0 && L.country_id
        ? "#/player?c=" + encodeURIComponent(L.country_id) + "&s=" + (L.slot | 0) + "&n=" + encodeURIComponent(b.player) : "";
      var ms = L ? +(L.closes_ms != null ? L.closes_ms : L.closesMs) || 0 : 0;
      var standing = !L ? "<i class='st gone'>the window has shut &mdash; the umpire settles it on his next pass</i>"
        : leadB ? "<i class='st lead'>you lead &middot; the board stands at " + exact(high) + "</i>"
        : high > +b.amount ? "<i class='st out'>outbid &mdash; " + E(L.highClub || L.high_club || "a rival") + " stand at " + exact(high) + "</i>"
        : "<i class='st lead'>your offer stands</i>";
      return "<div class='fo-mk-srow slim'><div class='fo-mk-swho'>" +
        (door ? "<a class='bdoor' href='" + door + "'><b>" + E(b.player) + "</b></a>" : "<b>" + E(b.player) + "</b>") +
        "<span>your offer <b class='amt2'>" + exact(b.amount) + "</b></span>" + standing + "</div>" +
        "<div class='fo-mk-shammer'><i>Hammer</i>" +
        (ms ? "<span class='hmwrap deal' data-mk-hh='" + ms + "'>" + hammerPlate(ms) + "</span>"
            : "<b class='clk calm'>" + E(dayTxt(b.closes)) + "</b>") + "</div></div>";
    }).join("");
    return (myBids ? "<div class='fo-mk-k'>Offers you have out</div>" + myBids : "") +
      "<div class='fo-mk-k'>Your men</div>" + rows +
      "<p class='fo-mk-note'>Listing puts him up for exactly three days at a reserve you name &mdash; his full card open on the board &mdash; and late bids stretch the hammer, ten minutes at a time. Unsold, he simply comes home. " +
      "A quick-sell pays half his valuation at the next settle. A release is for nothing.</p>";
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
  // THE CATALOGUE HEAD: a gilt eyebrow, the title, and three almanack
  // figures where a chip once floated - the numbers a manager checks before
  // reading a single lot. One count on the whole page, and it lives here.
  function mast() {
    var eb = "Fifty Overs &middot; the world's board";
    try {
      var ph = window.__foPlanet.phaseOf(Date.now());
      // THE BOARD DOES NOT SHUT BETWEEN SEASONS. Cricket stops; buying and
      // selling is exactly what a close season is for, and the auctions run on
      // their own three-day clock rather than on the fixture list. The eyebrow
      // says so instead of printing a day number that means nothing in a break.
      var lab = (window.__foPlanet.seasonLabel ? window.__foPlanet.seasonLabel(ph && ph.season) : ("Season " + (ph && ph.season)));
      if (ph && ph.kind === "league") eb = "Fifty Overs &middot; " + lab + " &middot; day " + ((ph.di | 0) + 1);
      else eb = "Fifty Overs &middot; the close season &middot; the board stays open";
    } catch (e) {}
    var n = MK.listings ? MK.listings.length : null;
    var soon = 0, now = Date.now();
    (MK.listings || []).forEach(function (L) {
      var ms = +L.closes_ms || 0;
      if (ms && ms > now && ms - now < 86400000) soon++;
    });
    // the third figure is YOUR fighting money - the bank the world last
    // served for this club (37-world-club keeps it fresh with each status)
    var bank = null;
    try { if (window.__foWorldBank != null) bank = +window.__foWorldBank; } catch (e) {}
    return "<div class='fo-mk-hd'>" +
      "<div class='eb'>" + eb + "</div>" +
      "<div class='row'><h1>Transfer market</h1>" +
      "<div class='figs'>" +
      "<span class='f'><b>" + (n == null ? "&hellip;" : n) + "</b><i>On the board</i></span>" +
      "<span class='f hot'><b>" + (n == null ? "&hellip;" : soon) + "</b><i>Close today</i></span>" +
      "<span class='f you'><b>" + (bank == null ? "&mdash;" : money(bank)) + "</b><i>Your purse</i></span>" +
      "</div></div>" +
      "<div class='rule'></div></div>";
  }
  // the deck's filter half: role links + the two dressed selects, built from
  // whatever nations actually have men up today
  function deckFilters() {
    var natIds = {};
    (MK.listings || []).forEach(function (L) { if (L.country_id) natIds[L.country_id] = 1; });
    var natList = Object.keys(natIds).map(function (id) { return [id, natNm(id)]; })
      .sort(function (a, b) { return a[1] < b[1] ? -1 : 1; });
    var icoCards = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><rect x='3.5' y='4' width='17' height='7' rx='2'/><rect x='3.5' y='14' width='17' height='7' rx='2'/></svg>";
    var icoTable = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M4 6.5h16M4 12h16M4 17.5h16'/></svg>";
    return "<span class='dv'></span>" +
      "<div class='fo-mk-vt'>" +
      "<button class='" + (MK.view === "cards" ? "on" : "") + "' data-mk-view='cards'>" + icoCards + "Cards</button>" +
      "<button class='" + (MK.view === "table" ? "on" : "") + "' data-mk-view='table'>" + icoTable + "Table</button>" +
      "</div>" +
      "<span class='dv'></span>" +
      "<div class='fo-mk-rlinks'>" + ROLE_TABS.map(function (t) {
        return "<button class='" + (MK.role === t[0] ? "on" : "") + "' data-mk-role='" + t[0] + "'>" + t[1] + "</button>";
      }).join("") + "</div>" +
      "<span class='sel nat'><select id='fo-mk-nat'><option value='all'>All nations</option>" + natList.map(function (nn) {
        return "<option value='" + E(nn[0]) + "'" + (MK.nat === nn[0] ? " selected" : "") + ">" + E(nn[1]) + "</option>";
      }).join("") + "</select></span>" +
      "<span class='sel'><select id='fo-mk-sort'>" + SORTS.map(function (g) {
        return "<optgroup label='" + g[0] + "'>" + g[1].map(function (s2) {
          return "<option value='" + s2[0] + "'" + (MK.sort === s2[0] ? " selected" : "") + ">" + s2[1] + "</option>";
        }).join("") + "</optgroup>";
      }).join("") + "</select></span>";
  }
  // walk to the listing a wire line spoke of and let it glow for a breath
  function flashListing() {
    try {
      var lid = sessionStorage.getItem("fo_mkt_flash"); if (lid == null) return;
      var el = document.querySelector(".fo-mk-row[data-id='" + lid + "'], .fo-mk-tbl tr[data-id='" + lid + "']");
      if (!el) return;
      sessionStorage.removeItem("fo_mkt_flash");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash");
      setTimeout(function () { try { el.classList.remove("flash"); } catch (e) {} }, 2600);
    } catch (e) {}
  }
  function paint() {
    var page = document.getElementById("page"); if (!page) return;
    if ((location.hash || "").split("?")[0] !== "#/market") return;
    // never yank a half-typed bid out of a manager's hands: postpone this
    // repaint; the next refetch cycle will catch the board up
    var ae = document.activeElement;
    if (ae && ae.classList && ae.classList.contains("fo-mk-in") && page.contains(ae)) return;
    var cl = claim();
    var t = MK.tab;
    // the whole book needs a broadsheet: the table view widens the page -
    // and the app's 980px #wrap girdle with it, or the wide room is a wish
    var wide = MK.view === "table" && t === "board";
    try { document.body.classList.toggle("fo-mk-wide", !!wide); } catch (eW) {}
    var html = "<div class='fo-mk" + (wide ? " wide" : "") + "'>" + mast() +
      "<div class='fo-mk-deck'>" +
      "<div class='fo-mk-tabs'>" +
      "<button class='" + (t === "board" ? "on" : "") + "' data-mk-tab='board'>The board</button>" +
      "<button class='" + (t === "sell" ? "on" : "") + "' data-mk-tab='sell'>My dealings</button>" +
      "<button class='" + (t === "reg" ? "on" : "") + "' data-mk-tab='reg'>The register</button>" +
      "</div>" +
      (t === "board" && cl && cl.country ? deckFilters() : "") +
      "</div>" +
      (t === "board" ? boardHtml(cl) : t === "sell" ? sellHtml(cl) : registerHtml()) +
      "<div class='fo-mk-foot'><a href='#/home'>&#8592; The club</a><a href='#/squad'>The squad &rsaquo;</a><a href='#/finance'>The books &rsaquo;</a></div>" +
      "</div>";
    if (page.__foMkHtml === html && page.querySelector(".fo-mk")) return;
    page.__foMkHtml = html;
    // a sort must not snap the book back to its first column: remember how
    // far the reader had leafed across, and put the page back exactly there
    var oldWrap = page.querySelector(".fo-mk-tblwrap");
    var leafX = oldWrap ? oldWrap.scrollLeft : 0;
    page.innerHTML = html;
    if (leafX) {
      try { var newWrap = page.querySelector(".fo-mk-tblwrap"); if (newWrap) newWrap.scrollLeft = leafX; } catch (eL) {}
    }
    try {
      var so = document.getElementById("fo-mk-sort");
      if (so) so.addEventListener("change", function () { MK.sort = so.value; paint(); });
      var no = document.getElementById("fo-mk-nat");
      if (no) no.addEventListener("change", function () { MK.nat = no.value; MK.shown = 40; paint(); });
    } catch (e9) {}
    setTimeout(flashListing, 60);
  }

  // ---- the deeds ------------------------------------------------------------
  // one door for both bidding paths: validate, place, log on the wire
  function placeBid(id, amt, min, inEl, isRetry) {
    var nm = "";
    try { nm = ((MK.listings || []).filter(function (L) { return Number(L.id) === Number(id); })[0] || {}).player || ""; } catch (e) {}
    rpc("world_market_bid", { p_id: id, p_amount: amt == null ? null : amt }).then(function (r) {
      // the word lands ON the card, not in a popup: MK.ok paints a green
      // strip in this listing's own rail for the next few repaints - and the
      // figure it speaks is the one the UMPIRE placed, not the one predicted
      var placed = (r && +r.amount) || amt || 0;
      MK.ok = { id: id, amt: placed, at: Date.now() };
      wireAdd("in", "Your offer of " + money(placed) + " on " + (nm || "a listed man") + " is in &mdash; you lead", { lid: id });
      if (inEl) inEl.value = "";
      paint();
      refetch(true);
      setTimeout(wireCheck, 1500);
      setTimeout(function () { try { if (MK.ok && Number(MK.ok.id) === Number(id)) { MK.ok = null; paint(); } } catch (e) {} }, 12500);
    }).catch(function (e) {
      // an umpire still on the old law answers an auto bid with the exact
      // figure he wants - take him at his word, once
      if (amt == null && !isRetry) {
        var m9 = /offer at least (\d+)/.exec(String((e && e.message) || e));
        if (m9) { placeBid(id, +m9[1], min, inEl, true); return; }
      }
      // refusals land inline too - under the input on the very card
      var msg = String((e && e.message) || e).replace(/^error:\s*/i, "");
      var el = document.getElementById("fo-mk-msg-" + id);
      if (el) { el.textContent = msg; el.classList.add("on"); setTimeout(function () { try { el.classList.remove("on"); } catch (e2) {} }, 6000); }
      else toastMsg(msg);
    });
  }

  /* ==========================================================================
     THE WIRE — market notifications behind a bell in the masthead.
     Outbid, offer placed, hammer won, hammer gone: each lands as a line in
     a small ledger kept on the device, with an unread count on the bell.
     The world serves state on the umpire's clock and this poller re-asks it
     roughly once a minute wherever you are in the game - so word arrives
     within the minute, honestly, rather than "instantly" dishonestly.
     ======================================================================== */
  var WIRE_KEY = "fo_mkt_wire";
  function wireLoad() {
    try { return JSON.parse(localStorage.getItem(WIRE_KEY) || "") || { items: [], st: {} }; }
    catch (e) { return { items: [], st: {} }; }
  }
  function wireSave(w) { try { localStorage.setItem(WIRE_KEY, JSON.stringify(w)); } catch (e) {} }
  function wireAdd(kind, text, extra) {
    var w = wireLoad();
    var it = { k: kind, t: text, at: Date.now(), r: false };
    // every line on the wire knows where its story lives: a listing to
    // flash on the board, or a page to walk to
    if (extra && extra.lid != null) it.lid = extra.lid;
    if (extra && extra.href) it.href = extra.href;
    w.items.unshift(it);
    w.items = w.items.slice(0, 30);
    wireSave(w);
    bellBadge();
    var pop = document.getElementById("fo-wire-pop");
    if (pop && pop.classList.contains("on")) bellPaint();
  }
  function agoTxt(at) {
    var m = Math.max(0, Math.round((Date.now() - at) / 60000));
    if (m < 1) return "just now";
    if (m < 60) return m + (m === 1 ? " minute ago" : " minutes ago");
    var h = Math.round(m / 60);
    if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    var d = Math.round(h / 24);
    return d === 1 ? "yesterday" : d + " days ago";
  }
  // the poll: my open offers vs the board's standing highs
  var wireBusy = 0;
  function wireCheck() {
    try {
      if (wireBusy) return;
      var cl = claim(); if (!cl || !cl.country || !jwt()) return;
      wireBusy = 1;
      rpc("world_market_mine", {}).then(function (mine) {
        var bids = (mine && mine.bids) || [];
        if (!bids.length) { wireBusy = 0; var w0 = wireLoad(); w0.st = {}; wireSave(w0); return; }
        var ids = bids.map(function (x) { return Number(x.id); }).filter(function (x) { return x > 0; });
        sel("world_listings?id=in.(" + ids.join(",") + ")&select=id,player,high,high_club").then(function (rows) {
          rows = rows || [];
          var byId = {}; rows.forEach(function (r) { byId[Number(r.id)] = r; });
          var w = wireLoad(); var st = w.st || {};
          bids.forEach(function (bd) {
            var idb = Number(bd.id), row = byId[idb], prev = st[idb];
            if (!row) {
              // the window shut while we watched: ask the register who won
              if (prev && !prev.done) {
                st[idb] = { done: 1 };
                sel("world_deals?id=eq." + idb + "&select=player,fee,to_club").then(function (ds) {
                  var d = ds && ds[0];
                  if (d && d.to_club === cl.club) {
                    wireAdd("won", "The hammer fell: " + E(d.player) + " is yours for " + money(d.fee), { href: "#/squad" });
                  } else if (d) {
                    wireAdd("gone", "The hammer fell on " + E(d.player) + " &mdash; he went to " + E(d.to_club || "another club") + " for " + money(d.fee));
                  } else {
                    wireAdd("gone", "The hammer fell on " + E(bd.player || "a man you bid for"));
                  }
                  var w2 = wireLoad(); delete (w2.st || {})[idb]; wireSave(w2);
                }).catch(function () {});
              }
              return;
            }
            var leadNow = +bd.amount >= +(row.high || 0);
            if (prev && prev.lead && !leadNow) {
              wireAdd("out", E(row.high_club || "A rival") + " outbid you on " + E(row.player) +
                " &mdash; the board stands at " + money(row.high), { lid: idb });
            }
            st[idb] = { lead: leadNow, amt: +bd.amount };
          });
          // reload before saving: any wireAdd() fired during this sweep wrote
          // items the snapshot above does not carry, and saving that stale
          // copy back would quietly erase them
          var wf = wireLoad(); wf.st = st; wireSave(wf); wireBusy = 0;
        }, function () { wireBusy = 0; });
      }, function () { wireBusy = 0; });
    } catch (e) { wireBusy = 0; }
  }
  try { setInterval(wireCheck, 60000); setTimeout(wireCheck, 4000); } catch (eW) {}

  // the bell itself, kept alive in the masthead like the menu button is
  function bellBadge() {
    var el = document.getElementById("fo-wire-bdg"); if (!el) return;
    // THE NUMBER IS MAIL AND THE DOT IS DUTY. The first cut counted the
    // standing asks into the number, and asks survive being read by design -
    // so a manager with an unfiled teamsheet read his news and watched the
    // badge refuse to budge, which reads as a bug however principled it is.
    // The number now counts only what reading clears: fresh news and unread
    // wire lines. Standing asks light a quiet ember dot instead - "something
    // needs you" - which goes out when the asks are actually done.
    var n = wireLoad().items.filter(function (x) { return !x.r; }).length;
    var asks = 0;
    try {
      var N9 = window.__foNews && __foNews.get();
      if (N9) {
        n += (N9.news || []).filter(function (x) { return x.fresh; }).length;
        asks = (N9.asks || []).length;
      }
    } catch (e9) {}
    el.textContent = n > 9 ? "9+" : String(n);
    el.style.display = n ? "" : "none";
    var dot = document.getElementById("fo-wire-ask");
    if (dot) dot.style.display = (asks && !n) ? "" : "none";
  }
  try { window.__foMktBell = bellBadge; } catch (eMB) {}
  function bellPaint() {
    var pop = document.getElementById("fo-wire-pop"); if (!pop) return;
    var w = wireLoad();
    var ic = { out: ["&#9660;", "out"], in: ["&#10003;", "in"], won: ["&#9733;", "won"], gone: ["&#8212;", "gone"] };
    // THE ONE BELL'S LIST: the served asks stand pinned at the top - they are
    // things to DO, with a clock on some of them - then the served news and
    // the market's own wire run together, newest first.
    var N9 = null; try { N9 = window.__foNews && __foNews.get(); } catch (e9) {}
    var askRows = ((N9 && N9.asks) || []).map(function (x) {
      return "<div class='it ask" + (x.urgent ? " urgent" : "") + "' data-href='" + E(x.go || "#/news") + "'>" +
        "<span class='ic ask'>&#9873;</span>" +
        "<div class='tx'><b>" + E(x.title || "") + "</b>" + E(x.body || "") + "</div></div>";
    }).join("");
    var merged = ((N9 && N9.news) || []).map(function (x) {
      return { at: +x.at || 0, unread: !!x.fresh, href: x.go || "#/news", ic: ic.gone,
               html: "<b>" + E(x.title || "") + "</b>" + E(x.body || "") };
    }).concat((w.items || []).map(function (it) {
      return { at: +it.at || 0, unread: !it.r, lid: it.lid, href: it.href, ic: ic[it.k] || ic.gone, html: it.t };
    })).sort(function (a, b) { return b.at - a.at; }).slice(0, 14);
    pop.innerHTML = "<div class='ph'><b>The wire</b><span id='fo-wire-clear'>Mark all read</span></div>" +
      askRows +
      (merged.length ? merged.map(function (it) {
        return "<div class='it" + (it.unread ? " unread" : "") + "'" +
          (it.lid != null ? " data-lid='" + it.lid + "'" : "") +
          (it.href ? " data-href='" + E(it.href) + "'" : "") +
          "><span class='ic " + it.ic[1] + "'>" + it.ic[0] + "</span>" +
          "<div class='tx'>" + it.html + "<i>" + agoTxt(it.at) + "</i></div></div>";
      }).join("") : (askRows ? "" : "<div class='none'>Nothing on the wire yet. Play a round, or bid on a man.</div>")) +
      "<a class='pf' href='#/news'>The whole news page &rsaquo;</a>";
    var mk = document.getElementById("fo-wire-clear");
    if (mk) mk.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var w2 = wireLoad(); (w2.items || []).forEach(function (x) { x.r = true; }); wireSave(w2);
      try { window.__foNews && __foNews.markSeen(); } catch (eS) {}
      bellBadge(); bellPaint();
    });
  }
  function bellToggle(btn) {
    var pop = document.getElementById("fo-wire-pop");
    if (!pop) {
      pop = document.createElement("div"); pop.id = "fo-wire-pop";
      document.body.appendChild(pop);
      pop.addEventListener("click", function (ev) {
        var it = ev.target.closest(".it"); if (!it) return;
        pop.classList.remove("on");
        // a line on the wire walks you to its own story: the listing it
        // speaks of (flashed on the board), or the page where it ended
        var href = it.getAttribute("data-href"), lid = it.getAttribute("data-lid");
        if (lid != null) {
          try { sessionStorage.setItem("fo_mkt_flash", lid); } catch (eF) {}
          if ((location.hash || "").split("?")[0] === "#/market") { paint(); flashListing(); }
          else location.hash = "#/market";
        } else location.hash = href || "#/market";
      });
      document.addEventListener("click", function (ev) {
        if (!pop.classList.contains("on")) return;
        if (pop.contains(ev.target) || ev.target.closest("#fo-wire-btn")) return;
        pop.classList.remove("on");
      });
      window.addEventListener("hashchange", function () { pop.classList.remove("on"); });
    }
    if (pop.classList.contains("on")) { pop.classList.remove("on"); return; }
    bellPaint();
    var rc = btn.getBoundingClientRect();
    var w = Math.min(360, (window.innerWidth || 360) - 16);
    pop.style.width = w + "px";
    pop.style.left = Math.max(8, Math.min(rc.right - w, (window.innerWidth || 360) - w - 8)) + "px";
    pop.style.top = (rc.bottom + 8) + "px";
    pop.classList.add("on");
    // opening the wire reads it - the local ledger and the served news both;
    // the asks keep their place, as they always have
    var w2 = wireLoad(); (w2.items || []).forEach(function (x) { x.r = true; }); wireSave(w2);
    try { window.__foNews && __foNews.markSeen(); } catch (eS2) {}
    setTimeout(bellBadge, 600);
  }
  function bellMount() {
    try {
      css();
      var tb = document.getElementById("topbar"); if (!tb) return;
      if (document.getElementById("fo-wire-btn")) { bellBadge(); return; }
      var btn = document.createElement("button");
      btn.id = "fo-wire-btn"; btn.type = "button";
      btn.setAttribute("aria-label", "Market notifications");
      btn.innerHTML = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' " +
        "stroke-linecap='round' stroke-linejoin='round'><path d='M6 8.6a6 6 0 0 1 12 0c0 6 2.4 7.4 2.4 7.4H3.6S6 14.6 6 8.6'/><path d='M10.2 20a2 2 0 0 0 3.6 0'/></svg>" +
        "<span id='fo-wire-bdg' style='display:none'></span>" +
        "<u id='fo-wire-ask' style='display:none'></u>";
      btn.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); bellToggle(btn); });
      // the masthead's right edge is a group, and the bell belongs in it, just
      // to the left of the date and time; the group asserts the order itself,
      // so this only has to get the bell into the right box
      var rt = document.getElementById("fo-hdr-right");
      if (rt) rt.insertBefore(btn, rt.firstChild); else tb.appendChild(btn);
      try { if (typeof foHdrRight === "function") foHdrRight(tb); } catch (eH) {}
      bellBadge();
    } catch (e) {}
  }
  try { setInterval(bellMount, 1500); } catch (eB) {}
  setTimeout(bellMount, 500);

  document.addEventListener("click", function (ev) {
    var t9 = ev.target && ev.target.closest ? ev.target : null; if (!t9) return;
    var b;
    if ((b = t9.closest("[data-mk-tab]"))) { MK.tab = b.getAttribute("data-mk-tab"); paint(); return; }
    if ((b = t9.closest("[data-mk-role]"))) { MK.role = b.getAttribute("data-mk-role"); MK.shown = 40; paint(); return; }
    if ((b = t9.closest("[data-mk-view]"))) {
      MK.view = b.getAttribute("data-mk-view") === "table" ? "table" : "cards";
      try { localStorage.setItem("fo_mkt_view", MK.view); } catch (eV) {}
      paint(); return;
    }
    if ((b = t9.closest("[data-mk-th]"))) {
      var kT = b.getAttribute("data-mk-th");
      if (kT === "age") MK.sort = (MK.sort === "young" ? "old" : "young");
      else MK.sort = kT;
      paint(); return;
    }
    if ((b = t9.closest("[data-mk-more]"))) { MK.shown += 40; paint(); return; }
    // a free agent has no dossier page, but his card is fully open: his
    // name opens the full card on the board (from the table, via the cards)
    if ((b = t9.closest("[data-mk-fa]"))) {
      var idFa = +b.getAttribute("data-mk-fa");
      MK.open[idFa] = 1;
      if (MK.view === "table") { MK.view = "cards"; try { localStorage.setItem("fo_mkt_view", "cards"); } catch (eV2) {} }
      try { sessionStorage.setItem("fo_mkt_flash", String(idFa)); } catch (eF2) {}
      paint(); flashListing();
      return;
    }
    if ((b = t9.closest("[data-mk-full]"))) {
      var idF = +b.getAttribute("data-mk-full");
      MK.open[idF] = !MK.open[idF];
      paint(); return;
    }
    // AUTO BID: one press, and the UMPIRE names the figure (067). The
    // button used to send the minimum it computed at paint time, and a raise
    // landing between paint and press left it carrying yesterday's number -
    // refused by the very law it was quoting. Sending null asks the server
    // for the smallest lawful raise at the moment the bid lands.
    if ((b = t9.closest("[data-mk-bid-auto]"))) {
      placeBid(+b.getAttribute("data-mk-bid-auto"), null, +b.getAttribute("data-min") || STEP, null);
      return;
    }
    // or a figure of your own, typed on the card itself
    if ((b = t9.closest("[data-mk-place]"))) {
      var idP = +b.getAttribute("data-mk-place"), minP = +b.getAttribute("data-min") || STEP;
      var inEl = document.getElementById("fo-mk-in-" + idP);
      var amtP = inEl ? Math.round(+String(inEl.value).replace(/[^0-9]/g, "")) : 0;
      if (!(amtP > 0)) { if (inEl) { inEl.classList.add("no"); setTimeout(function () { inEl.classList.remove("no"); }, 450); inEl.focus(); } return; }
      if (amtP < minP) {
        if (inEl) { inEl.classList.add("no"); setTimeout(function () { inEl.classList.remove("no"); }, 450); }
        // the refusal lands on the card, under the very input (no popups)
        var msgEl = document.getElementById("fo-mk-msg-" + idP);
        if (msgEl) {
          msgEl.textContent = "The law wants at least " + exact(minP) + " — 3% over the standing bid.";
          msgEl.classList.add("on");
          setTimeout(function () { try { msgEl.classList.remove("on"); } catch (e2) {} }, 6000);
        }
        return;
      }
      placeBid(idP, amtP, minP, inEl);
      return;
    }
    if ((b = t9.closest("[data-mk-withdraw]"))) {
      rpc("world_market_withdraw", { p_id: +b.getAttribute("data-mk-withdraw") })
        .then(function () { toastMsg("Withdrawn. He stays yours."); refetch(true); }).catch(sayErr);
      return;
    }
    if ((b = t9.closest("[data-mk-list]"))) {
      var nm = b.getAttribute("data-mk-list");
      decide(b, {
        q: "Reserve for " + nm, note: "The least you will accept. Below it the hammer does not fall.",
        input: { value: "20000", placeholder: "20000" }, ok: "Put him on the board", cancel: "Not yet",
        onYes: function (v) {
          var res = Math.round(+String(v == null ? "" : v).replace(/[^0-9]/g, ""));
          if (!(res > 0)) { sayErrAt(b, "A reserve has to be a figure above nothing."); return; }
          rpc("world_market_list", { p_player: nm, p_reserve: res }).then(function () {
            toastMsg(nm + " is on the board · the hammer falls in three days");
            refetch(true);
          }).catch(sayErr);
        }
      });
      return;
    }
    if ((b = t9.closest("[data-mk-qs]"))) {
      var nm2 = b.getAttribute("data-mk-qs"), fee = +b.getAttribute("data-fee");
      decide(b, {
        q: "Sell " + nm2 + " to the bank for $" + fee.toLocaleString() + "?",
        note: "Immediate and final. No auction, no counter-offer, and he does not come back.",
        ok: "Sell him", cancel: "Keep him", danger: true,
        onYes: function () {
          rpc("world_market_quicksell", { p_player: nm2 }).then(function (r) {
            toastMsg(nm2 + " sold to the bank for $" + ((r && r.fee) || fee).toLocaleString() + ". The fee lands with the next settle.");
            refetch(true);
          }).catch(sayErr);
        }
      });
      return;
    }
    if ((b = t9.closest("[data-mk-rel]"))) {
      var nm3 = b.getAttribute("data-mk-rel");
      decide(b, {
        q: "Release " + nm3 + " for nothing?",
        note: "He walks, the club gets no fee, and he does not come back.",
        ok: "Release him", cancel: "Keep him", danger: true,
        onYes: function () {
          rpc("world_market_release", { p_player: nm3 }).then(function () {
            toastMsg(nm3 + " released."); refetch(true);
          }).catch(sayErr);
        }
      });
      return;
    }
  });

  // the board breathes while you watch it
  setInterval(function () {
    try { if ((location.hash || "").split("?")[0] === "#/market") refetch(); } catch (e) {}
  }, 45000);
  // leaving the market hands the room back its ordinary walls
  window.addEventListener("hashchange", function () {
    try { if ((location.hash || "").split("?")[0] !== "#/market") document.body.classList.remove("fo-mk-wide"); } catch (e) {}
  });

  // ---- the clothes ----------------------------------------------------------
  function css() {
    if (document.getElementById("fo-mkt-css")) return;
    var s = document.createElement("style"); s.id = "fo-mkt-css";
    s.textContent = [
      "html body #page .fo-mk{max-width:880px;margin:26px auto 44px;padding:0 14px;color:#1B2432}",
      // the broadsheet: table view earns the full width of the room - the
      // app-wide 980px #wrap girdle is loosened only while the book is open
      "html body #page .fo-mk.wide{max-width:1280px}",
      "html body.fo-mk-wide .wrap,html body.ftpskin.fo-mk-wide .wrap{max-width:1330px !important;width:auto !important}",
      "html body.fo-mk-wide #page{max-width:1310px !important;width:auto !important}",
      // the flags fly at full mast - flavour first
      "html body #page .fo-mk-row .natc img,html body #page .fo-mk-row .natc svg{width:27px;height:18px;object-fit:cover;border-radius:2.5px;vertical-align:-4px;box-shadow:0 1px 3px rgba(10,22,42,.3),0 0 0 1px rgba(27,36,50,.14);margin-right:2px}",
      // a wire line's listing, found and lit for a breath
      "html body #page .fo-mk-row.flash{outline:3px solid #E8B96A;outline-offset:3px;border-radius:18px;transition:outline .3s}",
      "html body #page .fo-mk-tbl tr.flash td{background:#FBF3DF !important}",
      // the free agent's name is a door too - it opens his card
      "html body #page .fo-mk-row .pdoor.fa{cursor:pointer}",
      "html body #page .fo-mk-row .pdoor.fa:hover b{color:#C9571F}",
      // TALENTS, in gold - the marks the scouts trade in
      "html body #page .fo-mk-row .tlts{display:flex;gap:7px;flex-wrap:wrap;margin-top:2px}",
      "html body #page .fo-mk-row .tlts em{font-style:normal;font:700 11px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#7A5210;background:linear-gradient(120deg,#F6E7C0,#EED9A0);border:1px solid rgba(184,147,58,.35);border-radius:6px;padding:5px 8px}",
      // THE DOSSIER FOOT: the almanack facts that fill the card's floor
      "html body #page .fo-mk-row .facts{display:flex;gap:0;margin-top:4px;border-top:1px solid rgba(27,36,50,.08);padding-top:10px;flex-wrap:wrap}",
      "html body #page .fo-mk-row .facts span{padding:0 18px 0 0;margin-right:18px;border-right:1px solid rgba(27,36,50,.1)}",
      "html body #page .fo-mk-row .facts span:last-child{border-right:0}",
      "html body #page .fo-mk-row .facts i{display:block;font:600 11px/1 Inter,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#6A6354;font-style:normal;margin-bottom:4px}",
      "html body #page .fo-mk-row .facts b{font:650 13px/1 Inter,sans-serif;color:#14243A;font-variant-numeric:tabular-nums}",
      // the deed's word, ON the card: a green strip, never a popup
      "html body #page .fo-mk-row .rail .bidok{margin-top:10px;font:600 13px/1.5 Inter,sans-serif;color:#8FD6B5;background:rgba(23,122,87,.22);border:1px solid rgba(143,214,181,.35);border-radius:8px;padding:9px 11px;animation:fo-mk-drop2 .2s ease}",
      "html body #page .fo-mk-row .rail .bidmsg{display:none;font:500 12px/1.5 Inter,sans-serif;color:#FFB4A0;margin-top:7px}",
      "html body #page .fo-mk-row .rail .bidmsg.on{display:block;animation:fo-mk-drop2 .2s ease}",
      // THE CATALOGUE HEAD: gilt eyebrow, title, three almanack figures,
      // one double rule - then a single deck for tabs, roles and sorts.
      "html body #page .fo-mk-hd .eb{font:600 11px/1 Inter,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#C08A2E;margin-bottom:9px}",
      "html body #page .fo-mk-hd .row{display:flex;align-items:flex-end;gap:30px;flex-wrap:wrap}",
      "html body #page .fo-mk-hd h1{font:700 31px/1 Inter,sans-serif;text-transform:uppercase;color:#14243A;margin:0;letter-spacing:.015em}",
      "html body #page .fo-mk-hd .figs{margin-left:auto;display:flex;text-align:right}",
      "html body #page .fo-mk-hd .f{padding-left:26px;margin-left:26px;border-left:1px solid rgba(27,36,50,.14)}",
      "html body #page .fo-mk-hd .f:first-child{border-left:0;margin-left:0;padding-left:0}",
      "html body #page .fo-mk-hd .f b{display:block;font:600 21px/1 Fraunces,Georgia,serif;color:#14243A;font-variant-numeric:tabular-nums}",
      "html body #page .fo-mk-hd .f.hot b{color:#8E1F13}",
      "html body #page .fo-mk-hd .f.you b{color:#177A57}",
      "html body #page .fo-mk-hd .f i{display:block;font:600 11px/1 Inter,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#6A6354;font-style:normal;margin-top:5px}",
      "html body #page .fo-mk-hd .rule{border-bottom:3px double rgba(20,36,58,.25);margin-top:14px}",
      // the deck: rooms, shelves and sorts on one baseline, no boxes
      "html body #page .fo-mk-deck{display:flex;align-items:center;gap:22px;padding:12px 0 14px;flex-wrap:wrap;overflow:visible}",
      "html body #page .fo-mk-tabs{display:flex;gap:22px}",
      "html body #page .fo-mk-tabs button{font:600 11px/1 Inter,sans-serif !important;letter-spacing:.13em;text-transform:uppercase;color:#9FB0C6 !important;background:transparent !important;border:0 !important;border-radius:0 !important;padding:6px 0 !important;cursor:pointer;white-space:nowrap;box-shadow:none !important;transition:color .15s}",
      "html body #page .fo-mk-tabs button:hover{color:#1B2432 !important;background:transparent !important}",
      "html body #page .fo-mk-tabs button.on{color:#14243A !important;box-shadow:0 2.5px 0 #C9571F !important}",
      "html body #page .fo-mk-deck .dv{width:1px;height:20px;background:rgba(27,36,50,.14);flex:none}",
      "html body #page .fo-mk-rlinks{display:flex;gap:18px}",
      "html body #page .fo-mk-rlinks button{font:600 11px/1 Inter,sans-serif !important;letter-spacing:.11em;text-transform:uppercase;color:#9FB0C6 !important;background:transparent !important;border:0 !important;border-radius:0 !important;padding:6px 0 !important;cursor:pointer;box-shadow:none !important;transition:color .15s}",
      "html body #page .fo-mk-rlinks button:hover{color:#1B2432 !important;background:transparent !important}",
      "html body #page .fo-mk-rlinks button.on{color:#C9571F !important;box-shadow:0 2.5px 0 #C9571F !important}",
      // the dressed select: no OS chrome, a drawn chevron
      "html body #page .fo-mk-deck .sel{position:relative;display:inline-flex;align-items:center}",
      "html body #page .fo-mk-deck .sel.nat{margin-left:auto}",
      "html body #page .fo-mk-deck .sel select{appearance:none !important;-webkit-appearance:none !important;border:0 !important;background:transparent !important;font:600 13px/1.4 Inter,sans-serif !important;color:#14243A !important;padding:6px 16px 6px 0 !important;cursor:pointer;min-height:0 !important;box-shadow:none !important}",
      "html body #page .fo-mk-deck .sel:after{content:'';position:absolute;right:2px;top:50%;width:7px;height:7px;border-right:1.8px solid #6A6354;border-bottom:1.8px solid #6A6354;transform:translateY(-70%) rotate(45deg);pointer-events:none}",
      // THE BID RAIL CARD: identity and reads on paper, the money in navy
      // the spine is a real left border, not an inner bar: the card's own edge
      // carries the colour, so nothing inside has to move to make room for it
      "html body #page .fo-mk-row{position:relative;display:grid;grid-template-columns:1fr 225px;background:#FFFEFC;border:1px solid rgba(27,36,50,.14);border-left:4px solid var(--sp,#6A6354);border-radius:3px 16px 16px 3px;overflow:hidden;margin-bottom:13px;box-shadow:0 3px 12px rgba(14,35,63,.06)}",
      "html body #page .fo-mk-row.lead{border-color:rgba(27,36,50,.2);border-left-color:var(--sp,#6A6354);box-shadow:0 4px 16px rgba(14,35,63,.10)}",
      "html body #page .fo-mk-row.lead{border-color:rgba(23,122,87,.4)}",
      "html body #page .fo-mk-row .bd{padding:19px 26px 15px;min-width:0}",
      "html body #page .fo-mk-row .tp{display:flex;align-items:center;gap:13px}",
      "html body #page .fo-mk-row .ovr{flex:none;width:44px;height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;background:#14243A;color:#F6EFDF;border-radius:11px;font:600 16px/1 Inter,sans-serif;font-variant-numeric:tabular-nums}.fo-mk-row .ovr b{font-weight:700}.fo-mk-row .ovr i{font-style:normal;font:700 11px/1 Inter,sans-serif;letter-spacing:.06em;color:#9FB0C6}",
      "html body #page .fo-mk-row .nm{min-width:0}",
      "html body #page .fo-mk-row .nm b{display:block;font:600 19px/1.15 Fraunces,Georgia,serif;color:#1B2432;letter-spacing:.005em}",
      "html body #page .fo-mk-row .nm a.pdoor{text-decoration:none;color:inherit}",
      "html body #page .fo-mk-row .nm a.pdoor:hover b{color:#C9571F;text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:3px}",
      "html body #page .fo-mk-row .nm .mt{display:block;font:400 13px/1.6 Inter,sans-serif;color:#7d8798;margin-top:2px}",
      "html body #page .fo-mk-row .mt .natc{display:inline-flex;align-items:center;gap:5px;font:600 12px/1 Inter,sans-serif;color:#4a5568;vertical-align:middle}",
      "html body #page .fo-mk-row .mt .natc img{width:18px;height:12px;object-fit:cover;border-radius:2px;box-shadow:0 0 0 1px rgba(27,36,50,.14);display:inline-block}",
      // three role-picked gauges: what he is BOUGHT for, big and calm
      "html body #page .fo-mk-row .gg{display:flex;gap:34px;margin-top:16px}",
      "html body #page .fo-mk-row .gg .g{width:96px;min-width:0}",
      "html body #page .fo-mk-row .gg .lb{display:block;font:600 11px/1 Inter,sans-serif;letter-spacing:.17em;text-transform:uppercase;color:#6A6354}",
      "html body #page .fo-mk-row .gg .vl{display:block;font:600 26px/1.2 Inter,sans-serif;color:#14243A;font-variant-numeric:tabular-nums}",
      "html body #page .fo-mk-row .gg .tr{display:block;height:3.5px;border-radius:2px;background:#EDE8DC;margin-top:3px;overflow:hidden}",
      "html body #page .fo-mk-row .gg .fl{display:block;height:100%;border-radius:2px}",
      "html body #page .fo-mk-row .gg .fl.t1{background:#C05B45}",
      "html body #page .fo-mk-row .gg .fl.t2{background:#D9A441}",
      "html body #page .fo-mk-row .gg .fl.t3{background:#4E8A72}",
      "html body #page .fo-mk-row .gg .fl.t4{background:#177A57}",
      "html body #page .fo-mk-row .gg .g.off .vl{color:#c3c9d2}",
      "html body #page .fo-mk-row .gg .g.off .fl{background:#E3DECF}",
      // the fold: Full card opens the seven reads as toned bars
      "html body #page .fo-mk-row .fold{display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:2px 0 !important;font:600 11px/1 Inter,sans-serif !important;letter-spacing:.16em;text-transform:uppercase;color:#C9571F !important;background:transparent !important;border:0 !important;border-radius:0 !important;cursor:pointer;box-shadow:none !important}",
      "html body #page .fo-mk-row .fold:hover{color:#B44A22 !important;background:transparent !important}",
      "html body #page .fo-mk-row .fold svg{width:11px;height:11px;transition:transform .18s}",
      "html body #page .fo-mk-row .fold.on svg{transform:rotate(180deg)}",
      "html body #page .fo-mk-full{margin-top:11px;padding:13px 0 3px;border-top:1px dashed rgba(27,36,50,.18);display:grid;grid-template-columns:1fr 1fr;gap:7px 34px}",
      "html body #page .fo-mk-full .fb{display:grid;grid-template-columns:72px 1fr 30px;gap:10px;align-items:center}",
      "html body #page .fo-mk-full .fb i{font-style:normal;font:600 11px/1 Inter,sans-serif;letter-spacing:.15em;text-transform:uppercase;color:#6A6354}",
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
      "html body #page .fo-mk-row .prov .tag{flex:none;font:600 11px/1 Inter,sans-serif;letter-spacing:.11em;text-transform:uppercase;color:#7A5480;background:rgba(122,84,128,.07);border:1px solid rgba(122,84,128,.22);border-radius:6px;padding:5px 8px}",
      "html body #page .fo-mk-row .prov .tag.fa{color:#1F6F4A;background:rgba(31,111,74,.07);border-color:rgba(31,111,74,.22)}",
      "html body #page .fo-mk-row .prov .imp{flex:1;min-width:0;font:400 13px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      // THE AUCTIONEER'S LINE (B3): cream carries every fact, gold is spent
      // on the clock alone, orange on the one button alone
      "html body #page .fo-mk-row .rail{background:linear-gradient(170deg,#14243A,#0C1C31);color:#F6EFDF;padding:18px 20px;display:flex;flex-direction:column;gap:5px;justify-content:center}",
      "html body #page .fo-mk-row.lead .rail{background:linear-gradient(170deg,#14243A,#0C1B2E)}",
      "html body #page .fo-mk-row .rail .lb2{font:600 11px/1 Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(246,239,223,.42)}",
      "html body #page .fo-mk-row .rail .lb2.hm{margin-top:7px}",
      "html body #page .fo-mk-row .rail .club{font:600 13px/1.4 Inter,sans-serif;color:#FFFEFC;text-decoration:none;border-bottom:1px solid rgba(255,253,247,.3);align-self:flex-start}",
      "html body #page .fo-mk-row .rail a.club:hover{border-bottom-color:#FFFEFC;color:#FFFEFC}",
      "html body #page .fo-mk-row .rail .club.you{color:#8FD6B5;border-bottom-color:transparent}",
      "html body #page .fo-mk-row .rail .club.none{color:rgba(246,239,223,.5);border-bottom-color:transparent;font-weight:400}",
      "html body #page .fo-mk-row .rail .amt{font:600 32px/1 Inter,sans-serif;color:#FFFEFC;font-variant-numeric:tabular-nums;margin-top:5px}",
      "html body #page .fo-mk-row .rail .amt i{font:600 11px/1 Inter,sans-serif;font-style:normal;color:rgba(246,239,223,.5);letter-spacing:.08em;margin-left:6px}",
      "html body #page .fo-mk-row .rail .rsv{font:400 12px/1.4 Inter,sans-serif;color:rgba(246,239,223,.55)}",
      "html body #page .fo-mk-row .rail .hmwrap{display:block}",
      "html body #page .fo-mk-row .rail .clk{display:block;font:600 18px/1.15 Inter,sans-serif;letter-spacing:.06em;font-variant-numeric:tabular-nums;color:#E8B96A}",
      "html body #page .fo-mk-row .rail .clk.soon{color:#FF9E86}",
      "html body #page .fo-mk-row .rail .clk.final{color:#FF9E86;animation:fo-mk-beat 1.1s ease-in-out infinite}",
      "html body #page .fo-mk-row .rail .clk.gone{color:rgba(246,239,223,.8);letter-spacing:.18em}",
      "html body #page .fo-mk-row .rail .hnote{display:block;font:400 12px/1.45 Fraunces,Georgia,serif;color:rgba(255,180,160,.85);margin-top:2px}",
      "@keyframes fo-mk-beat{0%,100%{opacity:1}50%{opacity:.55}}",
      "@media(prefers-reduced-motion:reduce){html body #page .fo-mk-row .rail .clk.final{animation:none}}",
      // the deed: AUTO BID at the next minimum, or a figure on one line
      "html body #page .fo-mk-row .rail .go{margin-top:10px;font:600 13px/1 Inter,sans-serif !important;letter-spacing:.14em;text-transform:uppercase;color:#FFFEFC !important;background:#C9571F !important;border:0 !important;border-radius:9px !important;padding:13px 0 !important;width:100%;cursor:pointer;transition:background .15s}",
      "html body #page .fo-mk-row .rail .go:hover{background:#B44A22 !important}",
      "html body #page .fo-mk-row .rail .cust{display:flex;align-items:center;gap:8px;margin-top:8px}",
      "html body #page .fo-mk-row .rail .cust input.fo-mk-in{flex:1;min-width:0;background:transparent !important;border:0 !important;border-bottom:1px solid rgba(246,239,223,.28) !important;border-radius:0 !important;color:#FFFEFC !important;font:600 13px/1 Inter,sans-serif !important;padding:8px 2px !important;font-variant-numeric:tabular-nums;box-shadow:none !important;min-height:0 !important}",
      "html body #page .fo-mk-row .rail .cust input.fo-mk-in::placeholder{color:rgba(246,239,223,.35);font-weight:400}",
      "html body #page .fo-mk-row .rail .cust input.fo-mk-in:focus{outline:none !important;border-bottom-color:#E8B96A !important}",
      "html body #page .fo-mk-row .rail .cust input.fo-mk-in.no{animation:fo-mk-shake .4s}",
      "@keyframes fo-mk-shake{0%,100%{transform:none}25%{transform:translateX(-4px)}50%{transform:translateX(4px)}75%{transform:translateX(-3px)}}",
      "html body #page .fo-mk-row .rail .cust .snd{flex:none;width:34px;height:34px;border-radius:8px !important;background:transparent !important;border:1px solid rgba(246,239,223,.32) !important;color:#F6EFDF !important;cursor:pointer;font-size:14px;padding:0 !important;box-shadow:none !important}",
      "html body #page .fo-mk-row .rail .cust .snd:hover{background:rgba(255,255,255,.08) !important}",
      "html body #page .fo-mk-row .rail .act.ghost{margin-top:10px;font:600 11px/1 Inter,sans-serif !important;letter-spacing:.14em;text-transform:uppercase;color:rgba(246,239,223,.85) !important;background:transparent !important;border:1px solid rgba(246,239,223,.35) !important;border-radius:999px !important;padding:12px 0 !important;width:100%;cursor:pointer}",
      "html body #page .fo-mk-row .rail .act.ghost:hover{background:rgba(255,255,255,.08) !important}",
      // the gold youth mark for the under-21s
      // SCOPED TO THE MARKET, and it must stay that way. Unscoped, this rule
      // read "any .yth anywhere on any page" - and the squad grid marks its
      // academy rows <tr class='fo-sqg-r yth'>, so every colt in the Youth
      // and Everyone views became an inline-flex gold chip, fell out of the
      // table, and took the column widths with it.
      "html body #page .fo-mk .yth{display:inline-flex;font:700 11px/1 Inter,sans-serif;letter-spacing:.14em;color:#7A5210;background:linear-gradient(120deg,#F3DFA9,#E8B96A);border-radius:5px;padding:3.5px 6px;vertical-align:3px;margin-left:8px;text-transform:uppercase;white-space:nowrap}",
      // the door to the rest of a big board
      "html body #page .fo-mk-more{display:block;width:100%;margin:2px 0 0;padding:13px !important;font:600 11px/1 Inter,sans-serif !important;letter-spacing:.13em;text-transform:uppercase;color:#67748a !important;background:#FFFEFC !important;border:1px dashed rgba(27,36,50,.25) !important;border-radius:12px !important;cursor:pointer}",
      "html body #page .fo-mk-more:hover{color:#B44A22 !important;border-color:rgba(201,87,31,.5) !important;background:#FFFEFC !important}",
      // the manager's own desk + the register, kept in the same voice
      "html body #page .fo-mk-k{font-family:Inter,sans-serif;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#B44A22;margin:22px 2px 9px}",
      "html body #page .fo-mk-k:after{content:'';display:block;width:34px;border-top:2px solid #C9571F;margin-top:6px}",
      "html body #page .fo-mk-srow{display:flex;align-items:center;gap:12px;background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:12px;padding:11px 15px;margin-bottom:8px}",
      "html body #page .fo-mk-srow.slim{border-style:solid;border-left:3px solid #E8B96A}",
      // MY DEALINGS, told properly: the man is a door, the figure is exact,
      // the standing is coloured, and the hammer ticks beside it
      "html body #page .fo-mk-swho a.bdoor{text-decoration:none}",
      "html body #page .fo-mk-swho a.bdoor b{border-bottom:1px dotted rgba(201,87,31,.5)}",
      "html body #page .fo-mk-swho a.bdoor:hover b{color:#C9571F;border-bottom-color:#C9571F}",
      "html body #page .fo-mk-swho .amt2{font:650 12.5px/1 Inter,sans-serif;color:#14243A;font-variant-numeric:tabular-nums}",
      "html body #page .fo-mk-swho .st{display:block;font:600 12px/1.5 Inter,sans-serif;font-style:normal;margin-top:3px}",
      "html body #page .fo-mk-swho .st.lead{color:#177A57}",
      "html body #page .fo-mk-swho .st.out{color:#8E1F13}",
      "html body #page .fo-mk-swho .st.gone{color:#6A6354}",
      "html body #page .fo-mk-shammer{flex:0 0 auto;text-align:right}",
      "html body #page .fo-mk-shammer i{display:block;font:600 11px/1 Inter,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#6A6354;font-style:normal;margin-bottom:4px}",
      "html body #page .fo-mk-shammer .clk{font:600 14px/1.15 Inter,sans-serif;letter-spacing:.05em;color:#C08A2E;font-variant-numeric:tabular-nums}",
      "html body #page .fo-mk-shammer .clk.soon,html body #page .fo-mk-shammer .clk.final{color:#8E1F13;animation:none}",
      "html body #page .fo-mk-shammer .clk.gone{color:#6A6354}",
      "html body #page .fo-mk-shammer .hnote{display:none}",
      "html body #page .fo-mk-swho{min-width:0;flex:1}",
      "html body #page .fo-mk-swho b{font:600 14px/1.25 Fraunces,Georgia,serif;color:#1B2432}",
      "html body #page .fo-mk-swho span{display:block;font:400 13px/1.4 Inter,sans-serif;color:rgba(20,28,40,.5);margin-top:2px}",
      "html body #page .fo-mk-sbtns{display:flex;gap:7px;flex:0 0 auto;flex-wrap:wrap;justify-content:flex-end}",
      "html body #page .fo-mk-b{font:600 11px/1 Inter,sans-serif !important;letter-spacing:.11em;text-transform:uppercase;color:#FFFEFC !important;background:#C9571F !important;border:1px solid #C9571F !important;border-radius:999px !important;padding:9px 14px !important;cursor:pointer;min-height:32px;transition:background .15s,color .15s}",
      "html body #page .fo-mk-b:hover{background:#B44A22 !important;border-color:#B44A22 !important}",
      "html body #page .fo-mk-b.ghost{background:#FFFEFC !important;color:#67748a !important;border-color:rgba(27,36,50,.2) !important}",
      "html body #page .fo-mk-b.ghost:hover{color:#B44A22 !important;border-color:rgba(201,87,31,.5) !important;background:#FFFEFC !important}",
      "html body #page .fo-mk-b.danger{background:#FFFEFC !important;color:#B23230 !important;border-color:rgba(200,60,58,.35) !important}",
      "html body #page .fo-mk-b.danger:hover{background:rgba(200,60,58,.06) !important}",
      "html body #page .fo-mk-on{font:600 13px/1.3 Inter,sans-serif;color:#177A57}",
      "html body #page .fo-mk-deal{background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:12px;padding:11px 15px;margin-bottom:8px;font:400 12.5px/1.5 Inter,sans-serif;color:rgba(20,28,40,.75)}",
      "html body #page .fo-mk-deal b{color:#1B2432;font-family:Fraunces,Georgia,serif}",
      "html body #page .fo-mk-deal span{display:block;font-size:10.5px;color:rgba(20,28,40,.5)}",
      "html body #page .fo-mk-note{font:400 13px/1.65 Fraunces,Georgia,serif;color:rgba(20,28,40,.52);max-width:66ch;margin:16px 2px}",
      "html body #page .fo-mk-none{background:#FFFEFC;border:1px dashed rgba(20,28,40,.2);border-radius:14px;padding:28px;text-align:center;font:400 13px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.55)}",
      "html body #page .fo-mk-foot{display:flex;gap:10px;justify-content:space-between;margin-top:20px;flex-wrap:wrap}",
      "html body #page .fo-mk-foot a{font:600 13px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
      "html body #page .fo-mk-foot a:hover{color:#B44A22;text-decoration:none}",
      // the view toggle: cards or the whole book
      "html body #page .fo-mk-vt{display:inline-flex;gap:2px;background:#FFFEFC;border:1px solid rgba(27,36,50,.14);border-radius:9px;padding:3px}",
      "html body #page .fo-mk-vt button{display:inline-flex;align-items:center;gap:6px;font:600 11px/1 Inter,sans-serif !important;letter-spacing:.12em;text-transform:uppercase;color:#67748a !important;background:transparent !important;border:0 !important;border-radius:7px !important;padding:7px 11px !important;cursor:pointer;box-shadow:none !important}",
      "html body #page .fo-mk-vt button svg{width:12px;height:12px}",
      "html body #page .fo-mk-vt button.on{background:#14243A !important;color:#F1EEE6 !important}",
      // THE TABLE: the whole board as one sortable page of the books
      // THE BROADSHEET TABLE: navy masthead row (defended with !important -
      // a global th skin was outbidding the plain rule), zebra paper below,
      // roomy rows, and every number set in tabular figures
      "html body #page .fo-mk-tblwrap{background:#FFFEFC;border:1px solid rgba(27,36,50,.14);border-radius:16px;overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:4px;box-shadow:0 22px 48px rgba(10,22,42,.09)}",
      "html body #page .fo-mk-tbl{border-collapse:collapse;width:100%;min-width:1080px}",
      "html body #page .fo-mk-tbl thead th{background:linear-gradient(180deg,#1A2C47,#0E1E33) !important;color:#D9CBA8 !important;font:600 11px/1.3 Inter,sans-serif !important;letter-spacing:.15em;text-transform:uppercase;padding:14px 10px !important;text-align:right;white-space:nowrap;cursor:pointer;position:sticky;top:0;z-index:2;border:0 !important;box-shadow:inset 0 -3px 0 rgba(201,87,31,.55)}",
      "html body #page .fo-mk-tbl thead th:first-child{text-align:left;padding-left:18px !important;border-top-left-radius:15px}",
      "html body #page .fo-mk-tbl thead th:last-child{border-top-right-radius:15px}",
      "html body #page .fo-mk-tbl thead th:hover{color:#F6EFDF !important}",
      "html body #page .fo-mk-tbl thead th.on{color:#E8B96A !important;box-shadow:inset 0 -3px 0 #E8B96A}",
      "html body #page .fo-mk-tbl th .ar{font-size:10px}",
      "html body #page .fo-mk-tbl td{padding:11px 10px;border-top:1px solid rgba(27,36,50,.06);font:500 13px/1.35 Inter,sans-serif;color:#2a3444;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}",
      "html body #page .fo-mk-tbl td:first-child{text-align:left;padding-left:18px}",
      "html body #page .fo-mk-tbl tbody tr:nth-child(even) td{background:#FBFAF4}",
      "html body #page .fo-mk-tbl tbody tr:hover td{background:#F6F1E4}",
      "html body #page .fo-mk-tbl td .ovch{display:inline-block;min-width:30px;background:#14243A;color:#F6EFDF;font:700 12.5px/1 Inter,sans-serif;border-radius:8px;padding:6px 5px;text-align:center;font-variant-numeric:tabular-nums}",
      "html body #page .fo-mk-tbl td .pn{font:600 14.5px/1.25 Fraunces,Georgia,serif;color:#1B2432;text-decoration:none}",
      "html body #page .fo-mk-tbl td a.pn:hover,html body #page .fo-mk-tbl td .pn.lk:hover{color:#C9571F;text-decoration:underline;text-underline-offset:3px;cursor:pointer}",
      "html body #page .fo-mk-tbl td .sub{display:block;font:400 12px/1.6 Inter,sans-serif;color:#9FB0C6;margin-top:1px}",
      "html body #page .fo-mk-tbl td .sub img{width:19px;height:13px;object-fit:cover;border-radius:2px;vertical-align:-2.5px;box-shadow:0 1px 2px rgba(10,22,42,.25),0 0 0 1px rgba(27,36,50,.12)}",
      "html body #page .fo-mk-tbl .tbf,html body #page .fo-mk-tblwrap .tbf{padding:12px 18px;font:400 13px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.5);border-top:1px solid rgba(27,36,50,.08)}",
      "html body #page .fo-mk-tbl td .qok{font:700 11px/1 Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#177A57}",
      "html body #page .fo-mk-tbl td .sub a.cl{color:#7A5480;text-decoration:none;border-bottom:1px dotted rgba(122,84,128,.5)}",
      "html body #page .fo-mk-tbl td .sub a.cl:hover{color:#C9571F;border-bottom-color:#C9571F}",
      "html body #page .fo-mk-tbl td.hot{color:#14243A;font-weight:700}",
      "html body #page .fo-mk-tbl td.dim,html body #page .fo-mk-tbl td .hb.dim{color:#c3c9d2;font-weight:400}",
      "html body #page .fo-mk-tbl td .hb{font-weight:700;color:#14243A}",
      "html body #page .fo-mk-tbl td .hbc{display:block;font:600 12px/1.5 Inter,sans-serif}",
      "html body #page .fo-mk-tbl td .hbc a{color:#7A5480;text-decoration:none;border-bottom:1px dotted rgba(122,84,128,.5)}",
      "html body #page .fo-mk-tbl td .hbc a:hover{color:#C9571F;border-bottom-color:#C9571F}",
      "html body #page .fo-mk-tbl td .hbc .you{color:#177A57}",
      "html body #page .fo-mk-tbl td .yth{vertical-align:1px;margin-left:6px}",
      "html body #page .fo-mk-tbl .hmwrap.tbl .clk{display:inline;font:600 12.5px/1.2 Inter,sans-serif;letter-spacing:.04em;color:#14243A;font-variant-numeric:tabular-nums}",
      "html body #page .fo-mk-tbl .hmwrap.tbl .clk.soon,html body #page .fo-mk-tbl .hmwrap.tbl .clk.final{color:#8E1F13;animation:none}",
      "html body #page .fo-mk-tbl .hmwrap.tbl .clk.gone{color:#6A6354}",
      "html body #page .fo-mk-tbl .hmwrap.tbl .hnote{display:none}",
      "html body #page .fo-mk-tbl .qb{font:600 11px/1 Inter,sans-serif !important;letter-spacing:.1em;text-transform:uppercase;color:#FFFEFC !important;background:#C9571F !important;border:0 !important;border-radius:999px !important;padding:8px 12px !important;cursor:pointer;box-shadow:none !important}",
      "html body #page .fo-mk-tbl .qb:hover{background:#B44A22 !important}",
      "html body #page .fo-mk-tbl .qb.gh{color:#67748a !important;background:transparent !important;border:1px solid rgba(27,36,50,.25) !important}",
      // THE WIRE: the bell in the masthead and its ledger
      "html body #topbar #fo-wire-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px !important;background:rgba(255,255,255,.08) !important;border:0 !important;color:#F6EFDF !important;cursor:pointer;margin:0 6px;padding:0 !important;box-shadow:none !important;vertical-align:middle;flex:none;align-self:center}",
      "html body #topbar #fo-wire-btn:hover{background:rgba(255,255,255,.16) !important}",
      "html body #topbar #fo-wire-btn svg{width:17px;height:17px;display:block}",
      "html body #topbar #fo-wire-btn #fo-wire-bdg{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;border-radius:8px;background:#8E1F13;color:#fff;font:700 10px/16px Inter,sans-serif;text-align:center;padding:0 4px;box-shadow:0 0 0 2px #14243A}",
      "html body #topbar #fo-wire-btn #fo-wire-ask{position:absolute;top:-2px;right:-2px;width:9px;height:9px;border-radius:50%;background:#C9571F;box-shadow:0 0 0 2px #14243A}",
      "#fo-wire-pop{position:fixed;z-index:460;display:none;background:#FFFEFC;border:1px solid rgba(27,36,50,.16);border-radius:14px;box-shadow:0 26px 60px rgba(10,22,42,.3);overflow:hidden;color:#1B2432;max-height:70vh;overflow-y:auto}",
      "#fo-wire-pop.on{display:block;animation:fo-mk-drop2 .15s ease}",
      "@keyframes fo-mk-drop2{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}",
      "#fo-wire-pop .ph{display:flex;align-items:baseline;gap:10px;padding:13px 16px;border-bottom:1px solid rgba(27,36,50,.1);position:sticky;top:0;background:#FFFEFC}",
      "#fo-wire-pop .ph b{font:600 13.5px/1 Fraunces,Georgia,serif}",
      "#fo-wire-pop .ph span{margin-left:auto;font:600 11px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#C9571F;cursor:pointer}",
      "#fo-wire-pop .it{display:flex;gap:11px;padding:12px 16px;border-bottom:1px solid rgba(27,36,50,.06);cursor:pointer}",
      "#fo-wire-pop .it:hover{background:#FBFAF5}",
      "#fo-wire-pop .it.unread{background:#FBF7EE}",
      "#fo-wire-pop .ic{flex:none;width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:12px}",
      "#fo-wire-pop .ic.out{background:rgba(142,31,19,.1);color:#8E1F13}",
      "#fo-wire-pop .ic.in{background:rgba(23,122,87,.1);color:#177A57}",
      "#fo-wire-pop .ic.won{background:rgba(232,185,106,.2);color:#C08A2E}",
      "#fo-wire-pop .ic.gone{background:rgba(27,36,50,.07);color:#67748a}",
      "#fo-wire-pop .tx{min-width:0;font:400 13px/1.5 Inter,sans-serif;color:#2a3444;white-space:normal}",
      "#fo-wire-pop .tx i{display:block;font-style:normal;font:400 12px/1.5 Inter,sans-serif;color:#6A6354;margin-top:2px}",
      "#fo-wire-pop .none{padding:24px 18px;font:400 12.5px/1.6 Fraunces,Georgia,serif;color:rgba(20,28,40,.5);text-align:center}",
      // the pinned asks: things to do, with the urgent ones wearing the ember
      "#fo-wire-pop .it.ask{background:#F8F6EF;border-left:3px solid rgba(180,74,34,.4)}",
      "#fo-wire-pop .it.ask.urgent{border-left-color:#B4351F;background:#FBF3EC}",
      "#fo-wire-pop .ic.ask{background:rgba(180,74,34,.12);color:#B4351F}",
      "#fo-wire-pop .tx b{display:block;font:600 12.5px/1.4 Inter,sans-serif;color:#1B2432}",
      "html body #fo-wire-pop a.pf{display:block;padding:12px 16px;text-align:center;font:600 11px/1 Inter,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#C9571F !important;text-decoration:none;border-top:1px solid rgba(27,36,50,.08)}",
      // narrower grounds: the rail becomes the card's foot, gauges close ranks
      "@media(max-width:640px){",
      "html body #page .fo-mk-row{grid-template-columns:1fr}",
      "html body #page .fo-mk-row .rail{padding:16px 20px}",
      "html body #page .fo-mk-row .gg{gap:20px}",
      "html body #page .fo-mk-row .gg .g{flex:1 1 0;width:auto}",
      "html body #page .fo-mk-full{grid-template-columns:1fr;gap:7px}",
      "html body #page .fo-mk-srow{flex-wrap:wrap}",
      "html body #page .fo-mk-shammer{text-align:left;flex-basis:100%}",
      "html body #page .fo-mk-tabs{gap:18px}",
      "html body #page .fo-mk-row .facts{gap:0;row-gap:10px}",
      "html body #page .fo-mk-row .facts span{padding-right:12px;margin-right:12px}",
      "html body #page .fo-mk-row .natc img,html body #page .fo-mk-row .natc svg{width:22px;height:15px}",
      "}"
    ].join("\n");
    document.body.appendChild(s);
  }

  window.foRenderMarketPage = foRenderMarketPage;
})();
