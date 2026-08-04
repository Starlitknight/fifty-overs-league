/* ============================================================================
   THE TRANSFER MARKET (#/market) — open outcry, three-day windows.

   The board is the world's: free agents trickled on daily by the umpire, and
   men listed by clubs - bot clubs shedding surplus, managers naming a
   reserve. Every listing is an open auction: the standing high bid and the
   club holding it are public, a new offer must beat the board by the step,
   and at the third daily settle the hammer falls - highest at or above the
   reserve takes him, the money walks through the books, the man moves.

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
  var MK = { listings: null, deals: null, mine: null, snap: null, at: 0, busy: 0, tab: "board", role: "all", sort: "close" };
  function refetch(force) {
    if (MK.busy) return;
    if (!force && MK.at && Date.now() - MK.at < 30000) return;
    var cl = claim(); if (!cl || !cl.country) return;
    MK.busy = 1;
    var qs = [
      sel("world_listings?country_id=eq." + encodeURIComponent(cl.country) + "&order=closes_day.asc,id.asc"),
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

  function impressionOf(id) {
    try {
      var L = ((MK.snap && MK.snap.listings) || []).filter(function (x) { return Number(x.id) === Number(id); })[0];
      return L ? { scout: L.scout, fee: L.fee } : null;
    } catch (e) { return null; }
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
  function flagSrc() {
    try { var cl = claim(); return (typeof FO_ART !== "undefined" ? FO_ART : "client/art/") + "flags/" + window.__foCxAPI.flagFile(cl.country) + ".svg"; }
    catch (e) { return ""; }
  }
  function rowHtml(L, cl, myBids) {
    var imp = impressionOf(L.id) || {};
    var sc = imp.scout || {};
    var meta = [];
    if (sc.hand) meta.push(E(sc.hand));
    if (sc.role) meta.push(E(sc.role === "allrounder" ? "all-rounder" : sc.role === "keeper" ? "wicketkeeper" : sc.role));
    if (sc.age) meta.push(sc.age);
    var high = +L.high || 0;
    var minBid = high ? high + STEP : Math.ceil((+L.asking || 0) * 0.55);
    var myBid = (myBids || []).filter(function (b) { return Number(b.id) === Number(L.id); })[0];
    var lead = myBid && high && +myBid.amount >= high;
    var mineSelling = cl && L.country_id === cl.country && L.slot === cl.slot;
    var fa = L.slot < 0;
    var state = lead ? "high bid &middot; you lead"
      : high ? "high bid &middot; " + E(L.highClub || L.high_club || "a club") + " lead"
      : "no bids yet &middot; reserve " + money(L.reserve);
    var fl = flagSrc();
    return "<div class='fo-mk-row" + (lead ? " lead" : "") + "' data-id='" + L.id + "'>" +
      "<span class='rk" + (fa ? " fa" : "") + "'>" + (fa ? "FA" : "B") + "</span>" +
      "<span class='who'><b>" + E(L.player) + "</b>" +
      "<i>" + (meta.length ? meta.join(" &middot; ") : "an unscouted man") + "</i>" +
      "<u class='" + (fa ? "" : "sell") + "'>" + (fa ? "Free agent" : "Listed by " + E(L.club || "a club")) + "</u>" +
      (sc.impression ? "<em>" + E(sc.impression) + "</em>" : "") +
      "</span>" +
      (fl ? "<span class='mid'><img src='" + fl + "' alt=''></span>" : "") +
      "<span class='pr'><b>" + money(high || L.asking) + "</b>" +
      "<i>" + state + "</i><i>hammer " + E(dayTxt(L.closes_day)) + "</i>" +
      "<span class='btns'>" +
      (mineSelling
        ? "<button class='act ghost' data-mk-withdraw='" + L.id + "'>Withdraw</button>"
        : "<button class='act' data-mk-bid='" + L.id + "' data-min='" + minBid + "'>" + (myBid ? (lead ? "Raise" : "Outbid!") : "Bid") + "</button>") +
      "<button class='act ghost' data-mk-scout='" + L.id + "'>Scout " + money(imp.fee || 4000) + "</button>" +
      "</span></span>" +
      "</div>";
  }

  var ROLE_TABS = [["all", "All players"], ["bat", "Batters"], ["bowl", "Bowlers"], ["ar", "All-rounders"], ["wk", "Keepers"]];
  var SORTS = [["close", "Closing soon"], ["new", "Newest"], ["hi", "Price high"], ["lo", "Price low"]];
  function boardHtml(cl) {
    if (!MK.listings) return "<div class='fo-mk-none'>Reading the board&hellip;</div>";
    if (!MK.listings.length) return "<div class='fo-mk-none'>The board is bare today. The umpire trickles new names on daily &mdash; look in tomorrow.</div>";
    var myBids = (MK.mine && MK.mine.bids) || [];
    var rows = MK.listings.slice();
    if (MK.role !== "all") rows = rows.filter(function (L) {
      var b9 = roleBucket((impressionOf(L.id) || {}).scout);
      return b9 === MK.role || (MK.role !== "all" && !b9 && false);
    });
    if (MK.sort === "new") rows.sort(function (a, b) { return (b.id | 0) - (a.id | 0); });
    else if (MK.sort === "hi") rows.sort(function (a, b) { return (+(b.high || b.asking) || 0) - (+(a.high || a.asking) || 0); });
    else if (MK.sort === "lo") rows.sort(function (a, b) { return (+(a.high || a.asking) || 0) - (+(b.high || b.asking) || 0); });
    var tabs = "<div class='fo-mk-rtabs'>" + ROLE_TABS.map(function (t) {
      return "<button class='" + (MK.role === t[0] ? "on" : "") + "' data-mk-role='" + t[0] + "'>" + t[1] + "</button>";
    }).join("") + "</div>";
    var sortSel = "<div class='fo-mk-ftr'><label class='dd'>Sort" +
      "<select id='fo-mk-sort'>" + SORTS.map(function (s2) {
        return "<option value='" + s2[0] + "'" + (MK.sort === s2[0] ? " selected" : "") + ">" + s2[1] + "</option>";
      }).join("") + "</select></label>" +
      "<span class='cnt'>" + rows.length + " of " + MK.listings.length + " names</span></div>";
    return tabs + sortSel +
      (rows.length ? rows.map(function (L) { return rowHtml(L, cl, myBids); }).join("")
        : "<div class='fo-mk-none'>Nobody of that kind on the board today.</div>");
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
      "<p class='fo-mk-note'>Listing puts him up for three world days at a reserve you name; unsold, he simply comes home. " +
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
      "<p>Open outcry, three-day windows &mdash; the hammer falls with the daily settle.</p></div>" +
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
    } catch (e9) {}
  }

  // ---- the deeds ------------------------------------------------------------
  document.addEventListener("click", function (ev) {
    var t9 = ev.target && ev.target.closest ? ev.target : null; if (!t9) return;
    var b;
    if ((b = t9.closest("[data-mk-tab]"))) { MK.tab = b.getAttribute("data-mk-tab"); paint(); return; }
    if ((b = t9.closest("[data-mk-role]"))) { MK.role = b.getAttribute("data-mk-role"); paint(); return; }
    if ((b = t9.closest("[data-mk-bid]"))) {
      var id = +b.getAttribute("data-mk-bid"), min = +b.getAttribute("data-min") || STEP;
      var amt = prompt("Your offer (the board wants at least " + min + "):", String(min));
      if (amt == null) return;
      amt = Math.round(+String(amt).replace(/[^0-9]/g, ""));
      if (!(amt > 0)) return;
      rpc("world_market_bid", { p_id: id, p_amount: amt }).then(function () {
        toastMsg("Offer in: $" + amt.toLocaleString() + ". The hammer falls with the daily settle.");
        refetch(true);
      }).catch(sayErr);
      return;
    }
    if ((b = t9.closest("[data-mk-scout]"))) {
      var id2 = +b.getAttribute("data-mk-scout");
      rpc("world_market_scout", { p_id: id2 }).then(function (r) {
        var p = r && r.player;
        if (!p) { toastMsg("The scout came back with nothing."); return; }
        var lines = ["Age " + (p.age || "?") + " · " + (p.hand === "L" ? "left-hand bat" : "right-hand bat"),
          p.btLabel || "", "Wage about $" + (p.wage || 0).toLocaleString() + " a day",
          (p.talents || []).length ? "Talents: " + (p.talents || []).slice(0, 3).join(", ") : "No noted talents"];
        alert("SCOUT'S REPORT — " + p.name + "\n\n" + lines.filter(Boolean).join("\n"));
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
        toastMsg(nm + " is on the board · hammer " + dayTxt(r && r.closes));
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
      "html body #page .fo-mk{max-width:860px;margin:26px auto 44px;padding:0 14px;color:#141C28}",
      // the dashboard masthead + the board's list rows
      "html body #page .fo-mk-hd{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}",
      "html body #page .fo-mk-hd h1{font:700 30px/1 Oswald,sans-serif;text-transform:uppercase;color:#14243A;margin:0;letter-spacing:.01em}",
      "html body #page .fo-mk-hd p{font:400 12.5px/1.4 Inter,sans-serif;color:#67748a;margin:7px 0 0}",
      "html body #page .fo-mk-hd .chip{margin-left:auto;flex:none;background:#FFFEFC;border:1px solid rgba(27,36,50,.09);border-radius:11px;padding:10px 13px;text-align:right}",
      "html body #page .fo-mk-hd .chip span{display:block;font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:#8a93a2}",
      "html body #page .fo-mk-hd .chip b{display:block;font:700 15px/1.4 Inter,sans-serif;color:#14243A}",
      "html body #page .fo-mk-rtabs{display:flex;gap:2px;background:#FFFEFC;border:1px solid rgba(27,36,50,.09);border-radius:12px;padding:5px;overflow-x:auto;margin-bottom:9px}",
      "html body #page .fo-mk-rtabs button{flex:1;text-align:center;padding:11px 8px;border:0;background:transparent;border-radius:8px;font:600 10px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#67748a;white-space:nowrap;cursor:pointer;min-height:40px}",
      "html body #page .fo-mk-rtabs button.on{background:#14243A;color:#F1EEE6}",
      "html body #page .fo-mk-ftr{display:flex;align-items:center;gap:10px;margin-bottom:10px}",
      "html body #page .fo-mk-ftr .dd{display:flex;align-items:center;gap:8px;background:#FFFEFC;border:1px solid rgba(27,36,50,.09);border-radius:10px;padding:6px 8px 6px 12px;font:600 9.5px/1 Oswald,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#1B2432}",
      "html body #page .fo-mk-ftr select{border:0;background:transparent;font:600 11px/1.4 Inter,sans-serif;color:#14243A;min-height:32px}",
      "html body #page .fo-mk-ftr .cnt{margin-left:auto;font:600 9.5px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#8a93a2}",
      "html body #page .fo-mk-row{display:flex;align-items:flex-start;gap:11px;background:#FFFEFC;border:1px solid rgba(27,36,50,.09);border-radius:12px;padding:12px 13px;margin-bottom:9px;box-shadow:0 1px 2px rgba(14,35,63,.04)}",
      "html body #page .fo-mk-row.lead{border-color:rgba(23,122,87,.45)}",
      "html body #page .fo-mk-row .rk{flex:none;width:24px;height:24px;border-radius:50%;background:#C9571F;color:#fff;font:700 9.5px/1 Inter,sans-serif;display:flex;align-items:center;justify-content:center;margin-top:2px}",
      "html body #page .fo-mk-row .rk.fa{background:#1F6F4A}",
      "html body #page .fo-mk-row .who{min-width:0;flex:1}",
      "html body #page .fo-mk-row .who b{display:block;font:600 14px/1.2 Inter,sans-serif;color:#1B2432}",
      "html body #page .fo-mk-row .who i{display:block;font-style:normal;font:400 10.5px/1.4 Inter,sans-serif;color:#8a93a2;margin-top:2px;text-transform:capitalize}",
      "html body #page .fo-mk-row .who u{display:inline-block;text-decoration:none;font:600 8px/1 Oswald,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#1F6F4A;background:rgba(31,111,74,.08);border:1px solid rgba(31,111,74,.25);border-radius:6px;padding:4px 6px;margin-top:6px}",
      "html body #page .fo-mk-row .who u.sell{color:#7A5480;background:rgba(122,84,128,.08);border-color:rgba(122,84,128,.25)}",
      "html body #page .fo-mk-row .who em{display:block;font:italic 400 11px/1.4 Georgia,serif;color:rgba(20,28,40,.6);margin-top:5px}",
      "html body #page .fo-mk-row .mid{flex:none;margin-top:3px}",
      "html body #page .fo-mk-row .mid img{width:20px;height:14px;object-fit:cover;border-radius:2px}",
      "html body #page .fo-mk-row .pr{flex:none;text-align:right;max-width:46%}",
      "html body #page .fo-mk-row .pr b{display:block;font:700 17px/1.1 Oswald,sans-serif;color:#C9571F;font-variant-numeric:tabular-nums}",
      "html body #page .fo-mk-row .pr i{display:block;font-style:normal;font:400 9.5px/1.4 Inter,sans-serif;color:#8a93a2;margin-top:2px}",
      "html body #page .fo-mk-row.lead .pr i:first-of-type{color:#177A57;font-weight:600}",
      "html body #page .fo-mk-row .btns{display:flex;gap:6px;justify-content:flex-end;margin-top:7px}",
      "html body #page .fo-mk-row .act{font:600 9.5px/1 Oswald,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#C9571F;background:#FFFEFC;border:1.5px solid rgba(201,87,31,.55);border-radius:8px;padding:8px 12px;cursor:pointer;min-height:34px}",
      "html body #page .fo-mk-row .act:hover{background:rgba(201,87,31,.06)}",
      "html body #page .fo-mk-row .act.ghost{color:#67748a;border-color:rgba(27,36,50,.18)}",
      "html body #page .fo-mk-tabs{display:flex;gap:8px;margin:0 0 14px}",
      "html body #page .fo-mk-tabs button{font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.14);border-radius:999px;padding:9px 16px;cursor:pointer}",
      "html body #page .fo-mk-tabs button.on{background:#0E233F;color:#FFFEFC;border-color:#0E233F}",
      "html body #page .fo-mk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px}",
      "html body #page .fo-mk-card{background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:14px;padding:13px 15px;box-shadow:0 4px 14px rgba(30,38,52,.06)}",
      "html body #page .fo-mk-card.fa{border-left:4px solid #C95532}",
      "html body #page .fo-mk-card.lead{border-color:rgba(23,122,87,.5)}",
      "html body #page .fo-mk-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}",
      "html body #page .fo-mk-who b{font:600 15px/1.2 'Fraunces',Georgia,serif;color:#141C28}",
      "html body #page .fo-mk-who span{display:block;font:400 11px/1.4 Inter,sans-serif;color:rgba(20,28,40,.55);margin-top:3px}",
      "html body #page .fo-mk-who i{display:block;font:italic 400 11.5px/1.4 Georgia,serif;color:rgba(20,28,40,.6);margin-top:3px}",
      "html body #page .fo-mk-who .fatag{font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.12em;color:#B44A22;background:rgba(201,85,50,.1);border:1px solid rgba(201,85,50,.3);border-radius:6px;padding:2px 6px;text-decoration:none;font-style:normal}",
      "html body #page .fo-mk-px{text-align:right;flex:0 0 auto}",
      "html body #page .fo-mk-px .lb{display:block;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.45)}",
      "html body #page .fo-mk-px b{font:700 18px/1.2 Inter,sans-serif;color:#0E233F;font-variant-numeric:tabular-nums}",
      "html body #page .fo-mk-px .by{display:block;font:600 10px/1.3 Inter,sans-serif;color:#B44A22}",
      "html body #page .fo-mk-card.lead .fo-mk-px .by{color:#177A57}",
      "html body #page .fo-mk-meta{display:flex;gap:12px;margin:9px 0 10px;font:500 10.5px/1 Inter,sans-serif;color:rgba(20,28,40,.55)}",
      "html body #page .fo-mk-meta .cl{margin-left:auto;color:#B44A22;font-weight:700}",
      "html body #page .fo-mk-act{display:flex;gap:8px}",
      "html body #page .fo-mk-b{font:700 11px/1 Inter,sans-serif;color:#FFFEFC;background:#C95532;border:0;border-radius:999px;padding:9px 14px;cursor:pointer}",
      "html body #page .fo-mk-b:hover{background:#A64426}",
      "html body #page .fo-mk-b.ghost{background:#FFFEFC;color:rgba(20,28,40,.7);border:1px solid rgba(20,28,40,.16)}",
      "html body #page .fo-mk-b.ghost:hover{color:#B44A22;border-color:rgba(217,85,42,.5);background:#FFFEFC}",
      "html body #page .fo-mk-b.danger{background:#FFFEFC;color:#B23230;border:1px solid rgba(200,60,58,.4)}",
      "html body #page .fo-mk-b.danger:hover{background:rgba(200,60,58,.06)}",
      "html body #page .fo-mk-k{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:#B44A22;margin:20px 2px 8px}",
      "html body #page .fo-mk-k:after{content:'';display:block;width:34px;border-top:2px solid #C95532;margin-top:6px}",
      "html body #page .fo-mk-srow{display:flex;align-items:center;gap:12px;background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:12px;padding:10px 14px;margin-bottom:7px}",
      "html body #page .fo-mk-srow.slim{border-style:dashed}",
      "html body #page .fo-mk-swho{min-width:0;flex:1}",
      "html body #page .fo-mk-swho b{font:600 13.5px/1.25 Inter,sans-serif;color:#141C28}",
      "html body #page .fo-mk-swho span{display:block;font:400 11px/1.35 Inter,sans-serif;color:rgba(20,28,40,.5);margin-top:2px}",
      "html body #page .fo-mk-sbtns{display:flex;gap:7px;flex:0 0 auto;flex-wrap:wrap;justify-content:flex-end}",
      "html body #page .fo-mk-on{font:600 11px/1.3 Inter,sans-serif;color:#177A57}",
      "html body #page .fo-mk-deal{background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:12px;padding:10px 14px;margin-bottom:7px;font:400 12.5px/1.5 Inter,sans-serif;color:rgba(20,28,40,.75)}",
      "html body #page .fo-mk-deal b{color:#141C28}",
      "html body #page .fo-mk-deal span{display:block;font-size:10.5px;color:rgba(20,28,40,.5)}",
      "html body #page .fo-mk-note{font:italic 400 12px/1.6 Georgia,serif;color:rgba(20,28,40,.55);max-width:64ch;margin:14px 2px}",
      "html body #page .fo-mk-none{background:#FFFEFC;border:1px dashed rgba(20,28,40,.2);border-radius:14px;padding:26px;text-align:center;font:italic 400 13px/1.5 Georgia,serif;color:rgba(20,28,40,.55)}",
      "html body #page .fo-mk-foot{display:flex;gap:10px;justify-content:space-between;margin-top:18px;flex-wrap:wrap}",
      "html body #page .fo-mk-foot a{font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
      "html body #page .fo-mk-foot a:hover{color:#B44A22;text-decoration:none}",
      "@media(max-width:560px){html body #page .fo-mk-grid{grid-template-columns:1fr}html body #page .fo-mk-srow{flex-wrap:wrap}}"
    ].join("\n");
    document.body.appendChild(s);
  }

  window.foRenderMarketPage = foRenderMarketPage;
})();
