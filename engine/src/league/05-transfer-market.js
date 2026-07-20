  // ===========================================================================
  //  TRANSFER MARKET · computer-generated free agents, one shared pool per
  //  league. Claims are first-come-first-served through the database (0014);
  //  the roster change itself rides the order packet (fo_market) and is
  //  applied by the resolver after the fair money settle.
  // ===========================================================================
  // Transfer fee: the same skill-value core as the draft at roughly double
  // the money (mid-season premium), plus age, talents and style rarity.
  function foMarketFee(p) {
    var base = foSkillValue(p) * 10;
    var ageF = foAgeFactor(p.age);
    var talF = 1 + 0.10 * ((p.talents || []).length);
    var roleF = p.keeper ? 1.15 : 1;
    var styleF = { seamFast: 1.30, wristSpin: 1.20, seamFastMedium: 1.08 }[p.bowlTypeFull] || 1;
    return Math.max(12000, Math.round(base * ageF * talF * roleF * styleF / 500) * 500);
  }
  function foMarketCls(p) {
    if (p.keeper || p.role === "wicketkeeper") return "keep";
    if (p.role === "allRounder") return "ar";
    if (p.bowlTypeFull && p.bowlTypeFull !== "none") return foIsPace(p) ? "pace" : "spin";
    return "bat";
  }
  function foOnAnyRoster(name) {
    try { return GD.teams.some(function (t2) { return (t2.players || []).concat(t2.youth || []).some(function (x) { return x.name === name; }); }); } catch (e) { return false; }
  }
  var FO_MARKET_REFRESH = 3;   // matchdays between full restocks
  function foMarketWindow() { return Math.floor((((App.season && App.season.round) || 0)) / FO_MARKET_REFRESH); }
  function foMarketRefreshIn() { return FO_MARKET_REFRESH - ((((App.season && App.season.round) || 0)) % FO_MARKET_REFRESH); }
  function foMarketPool() {
    var t = foMyClub(); if (!t) return [];
    var season = (typeof App !== "undefined" && App.seasonNo) || 1;
    var seed = (LG ? LG.id : "solo") + "-market-s" + season + "-w" + foMarketWindow();
    var seen = {}, byCls = { bat: [], pace: [], spin: [], keep: [], ar: [] };
    var countries = [(SYNC && SYNC.myTeam && SYNC.myTeam.country) || "England", "Australia", "India", "South Africa", "New Zealand", "West Indies"];
    for (var c = 0; c < countries.length; c++) {
      var pool = [];
      try { pool = buildCountryPool(seed + "-" + countries[c], countries[c]); } catch (e) { continue; }
      for (var i = 0; i < pool.length; i++) {
        var p = pool[i];
        if ((p.age || 0) < 21 || seen[p.name] || foOnAnyRoster(p.name)) continue;
        seen[p.name] = 1;
        byCls[foMarketCls(p)].push(p);
      }
    }
    // a market with a shape: specialists first, all-rounders as the garnish.
    // Rare styles stay rare on the shelf too: at most ONE genuine quick and
    // ONE wrist spinner may be listed, and only in some seasons at all (the
    // seeded coin below), so an express-pace listing is an event.
    var QUOTA = { bat: 5, pace: 4, spin: 3, keep: 2, ar: 4 };
    var seedH = foHash32(seed);
    var styleCap = {
      seamFast: (seedH % 100) < 40 ? 1 : 0,
      wristSpin: (Math.floor(seedH / 100) % 100) < 40 ? 1 : 0
    };
    var out = [];
    Object.keys(QUOTA).forEach(function (cls) {
      byCls[cls].sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
      var taken = 0;
      for (var bi = 0; bi < byCls[cls].length && taken < QUOTA[cls]; bi++) {
        var p = byCls[cls][bi];
        var st = p.bowlTypeFull;
        if (styleCap[st] != null) {
          if (styleCap[st] <= 0) continue;
          styleCap[st]--;
        }
        var q = JSON.parse(JSON.stringify(p));
        q.fee = foMarketFee(p);
        out.push(q);
        taken++;
      }
    });
    out.sort(function (a, b) { return (b.fee || 0) - (a.fee || 0); });
    out = out.slice(0, 18);
    // the Circuit's conquest signing headlines the shelf until he's taken
    try {
      var mq = foCxState().marquee;
      if (mq && mq.p && !foOnAnyRoster(mq.p.name)) {
        var q0 = JSON.parse(JSON.stringify(mq.p));
        q0.fee = Math.max(20000, Math.round(foMarketFee(q0) * 1.2 / 500) * 500);
        q0.__marquee = (foCxRegionByIx(mq.ri) || {}).nm || "the Circuit";
        out.unshift(q0);
      }
    } catch (eMq) {}
    return out;
  }
  function foMarketPage() {
    var page = document.getElementById("page"); if (!page) return;
    if (!document.getElementById("fo-mk-css")) {
      var mkCss = document.createElement("style"); mkCss.id = "fo-mk-css";
      mkCss.textContent =
        ".fo-mk-rare{position:relative;border-color:#F59E0B !important;box-shadow:0 0 0 2px rgba(217,164,65,.28),0 4px 16px rgba(217,164,65,.18) !important;background:linear-gradient(180deg,#FFFDF6,#fff)}" +
        ".fo-mk-rareband{position:absolute;top:-9px;right:10px;background:linear-gradient(135deg,#F59E0B,#c08a2b);color:#fff;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:3px 10px;box-shadow:0 2px 6px rgba(160,110,20,.35)}" +
        ".fo-mk-rare .fo-yc-h b{color:#8a5a10}";
      document.head.appendChild(mkCss);
    }
    var t = foMyClub();
    if (!t || !t.players || !t.players.length) { page.innerHTML = "<div class='crumb'>Transfers</div><div class='panel'><h4>Transfer market</h4><div class='pad'>No squad yet · finish your draft first.</div></div>"; return; }
    var pool = foMarketPool();
    var renderList = function (claims) {
      var byName = {}; (claims || []).forEach(function (c) { byName[c.player_name] = c; });
      var st = foTrainState();
      var pendingNames = {}; (st.marketPending || []).forEach(function (m) { pendingNames[m.name] = 1; });
      var bank = (App.fin && App.fin.bank) || t.bank || 0;
      var cards = pool.map(function (p, i) {
        var claim = byName[p.name];
        var mine = claim && SYNC && SYNC.myMid && claim.manager_id === SYNC.myMid;
        var pending = pendingNames[p.name];
        var rare = p.__marquee ? "Marquee &middot; " + E(p.__marquee) : p.bowlTypeFull === "seamFast" ? "Rare &middot; genuine pace" : p.bowlTypeFull === "wristSpin" ? "Rare &middot; wrist spin" : null;
        var act;
        if (claim) act = "<span class='pkm-gone'>" + (mine ? "Joining your club" : "Signed by <b>" + E(claim.club) + "</b>") + "</span>";
        else if (pending) act = "<span class='pkm-gone'>Joining after next matchday</span>";
        else act = "<button class='pkm-act fo-mk-claim' data-i='" + i + "'" + (bank < p.fee ? " disabled title='Not enough in the bank'" : "") + ">Sign</button>";
        return "<div class='pkm-cell' data-i='" + i + "'>" + foPkMini(p, { fee: p.fee, wage: foDailyWage(p), tag: (rare && !claim) ? rare : null, action: act, dim: !!claim || !!pending }) + "</div>";
      }).join("");
      page.innerHTML =
        "<div class='crumb'>" + E(t.name) + " &raquo; Transfers</div>" +
        "<div class='page-head'><div><div class='eyebrow'>Free agents</div><h1>Transfer market</h1><p>One shared pool &middot; signed players are gone for everyone &middot; fresh names every " + FO_MARKET_REFRESH + " matchdays.</p></div></div>" +
        "<div class='panel'><h4>On the market &middot; restocks in " + foMarketRefreshIn() + " matchday" + (foMarketRefreshIn() === 1 ? "" : "s") + (SYNC && SYNC.started && !SYNC.practice ? " &middot; <span id='fo-mk-cd'></span>" : "") + "</h4><div class='pad'>" +
        "<div class='fo-yc-note'>Bank <b>" + FO$(bank) + "</b> &middot; Squad <b>" + t.players.length + "/18</b> &middot; signings join after the next matchday</div>" +
        "<div class='pkm-grid'>" + cards + "</div></div></div>";
      // tick a real clock down to the restock: N-1 full days plus the time to
      // the next 9:00 AM ET resolution
      var cdEl = page.querySelector("#fo-mk-cd");
      if (cdEl) {
        var mkTick = function () {
          if (!document.getElementById("fo-mk-cd")) { clearInterval(window.__foMkCd); window.__foMkCd = null; return; }
          var ms = (foNextMatchdayMs() || 0) + (foMarketRefreshIn() - 1) * 86400000;
          var s2 = Math.max(0, Math.floor(ms / 1000));
          var d = Math.floor(s2 / 86400), h = Math.floor((s2 % 86400) / 3600), m = Math.floor((s2 % 3600) / 60), ss = s2 % 60;
          var pad2 = function (n) { return (n < 10 ? "0" : "") + n; };
          document.getElementById("fo-mk-cd").textContent = (d ? d + "d " : "") + h + ":" + pad2(m) + ":" + pad2(ss);
        };
        if (window.__foMkCd) clearInterval(window.__foMkCd);
        window.__foMkCd = setInterval(mkTick, 1000); mkTick();
      }
      page.querySelectorAll(".fo-mk-claim").forEach(function (b) { b.addEventListener("click", function (ev) { ev.stopPropagation(); foMarketClaim(pool[+b.getAttribute("data-i")]); }); });
      page.querySelectorAll(".pkm-cell").forEach(function (c) { c.addEventListener("click", function (ev) { if (ev.target.closest("button")) return; foYouthDetail(pool[+c.getAttribute("data-i")], true); }); });
    };
    if (SYNC && SYNC.started && !SYNC.practice && LG) {
      sel("league_market", "league_id=eq." + LG.id + "&select=player_name,club,manager_id").then(renderList).catch(function () { renderList([]); });
    } else renderList([]);
  }
  function foMarketClaim(p) {
    var t = foMyClub(); if (!t || !p) return;
    if ((t.players || []).length >= 18) { say("Squad is full (18) · release someone first."); return; }
    var bank = (App.fin && App.fin.bank) || t.bank || 0;
    if (bank < p.fee) { say("Not enough in the bank · the fee is " + FO$(p.fee) + "."); return; }
    foConfirm({
      title: "Sign " + p.name + "?",
      body: "Age " + p.age + " · " + foRoleShort(p) + " · " + FO$(p.fee) + " transfer fee, then " + FO$(foDailyWage(p)) + "/matchday wages. First club to sign gets the player.",
      confirm: "Sign · " + FO$(p.fee), cancel: "Not yet"
    }).then(function (ok) {
      if (!ok) return;
      p._prov = { how: "market", s: App.seasonNo || 1, r: ((App.season && App.season.round) || 0) + 1, fee: p.fee };
      if (SYNC && SYNC.started && !SYNC.practice && LG) {
        rpc("market_claim", { p_league_id: LG.id, p_player_name: p.name, p_player: p, p_price: p.fee, p_club: t.name })
          .then(function () {
            var st = foTrainState();
            (st.marketPending = st.marketPending || []).push(p);
            foTrainSave(st);
            if (p.__marquee) { try { var stq2 = foCxState(); if (stq2.marquee && stq2.marquee.p && stq2.marquee.p.name === p.name) { delete stq2.marquee; foCxSave(stq2); } } catch (eQc2) {} }
            toast(p.name + " is yours! The signing completes after the next matchday.");
            foMarketPage();
          })
          .catch(function (e) {
            var msg = ((e && e.message) || e) + "";
            if (/already claimed/i.test(msg)) { toast("Too slow · another club signed " + p.name + " first.", "error"); foMarketPage(); }
            else if (/Could not find the function|market_claim/i.test(msg)) say("The transfer market needs the 0014 SQL run in Supabase first (ask your commissioner).");
            else say(e);
          });
      } else {
        // solo/practice: instant
        try {
          var q = JSON.parse(JSON.stringify(p)); delete q.fee; delete q.__marquee;
          q.fatigue = "rested"; q.formIx = 3;
          t.players.push(q);
          if (p.__marquee) { try { var stq = foCxState(); if (stq.marquee && stq.marquee.p && stq.marquee.p.name === p.name) { delete stq.marquee; foCxSave(stq); } } catch (eQc) {} }
          if (typeof window.ledger === "function" && window.ledger.length >= 3) window.ledger("Transfer", "Signed " + q.name, -p.fee);
          else if (App.fin) App.fin.bank -= p.fee;
          if (typeof window.saveGame === "function") window.saveGame(false);
          toast(p.name + " joins the squad!");
          foMarketPage();
        } catch (e) { say(e); }
      }
    });
  }
  window.addEventListener("hashchange", function () { setTimeout(foRenderMarket, 15); });
  function foRenderMarket() {
    if (!/^#\/transfers/.test(location.hash || "")) return;
    try { bumpBrand(); } catch (e) {}
    try { foMarketPage(); } catch (e) { console.warn("foMarketPage", e); }
    try {
      var tb = document.getElementById("topbar");
      tb && tb.querySelectorAll("a").forEach(function (a) { a.classList.toggle("on", a.classList.contains("fo-transfers")); });
    } catch (e) {}
  }


