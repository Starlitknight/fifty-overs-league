(function () {
  "use strict";
  // =========================================================================
  // SQUAD INTELLIGENCE - the third way to read the squad
  //
  // This is not a page. The squad room owns one address, #/squad, and offers
  // three ways to look at the same men: the Roster (people), the Grid (every
  // attribute, sortable) and Int (the analyst's read - who is worth what, at
  // what age, and where the squad is thin). This module hands the squad
  // renderer a body and a wiring function; the shell, the masthead and the
  // view switch belong to 09-squad-matchlab.js and are shared by all three.
  //
  // The dressing: the Split Desk. A navy band carries the department name,
  // the two filters and the three headline figures; the working area below it
  // is the same daylight paper the Grid uses, so the two read as one room.
  // =========================================================================
  if (window.__foSquadIntel) return;
  var FO_SI_ROLES = { opener: "bat", topOrderBat: "bat", middleOrderBat: "bat", allRounder: "ar",
    wicketkeeper: "wk", seamFast: "bowl", seamFastMedium: "bowl", seamMedium: "bowl",
    wristSpin: "bowl", fingerSpin: "bowl" };
  var FO_SI_NAT = { England: "ENG", Australia: "AUS", India: "IND", "New Zealand": "NZL",
    "South Africa": "RSA", "West Indies": "WI", Pakistan: "PAK", "Sri Lanka": "SLK",
    Afghanistan: "AFG", Netherlands: "NED", Ireland: "IRE", Zimbabwe: "ZIM",
    Bangladesh: "BAN", Scotland: "SCO", Wales: "WAL", Nepal: "NEP", Canada: "CAN",
    Kenya: "KEN", "United States": "USA" };

  function foSiE(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function foSiClamp(n, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(+n || 0))); }
  function foSiRoleKey(p) {
    if (p && (p.keeper || p.role === "wicketkeeper")) return "wk";
    return FO_SI_ROLES[(p && p.role) || ""] || "bat";
  }
  function foSiRoleName(p) {
    var k = foSiRoleKey(p);
    if (k === "wk") return "Wicketkeeper";
    if (k === "ar") return "All-rounder";
    if (k === "bowl") {
      return { seamFast: "Fast bowler", seamFastMedium: "Fast-medium bowler", seamMedium: "Medium pacer",
        wristSpin: "Wrist spinner", fingerSpin: "Finger spinner" }[(p && p.role) || ""] || "Bowler";
    }
    return "Batter";
  }
  function foSiOvr(p) {
    try { if (window.foPkOvr) return window.foPkOvr(p); } catch (e) {}
    return foSiClamp(p && p.rating ? p.rating / 420 : 50, 1, 99);
  }
  function foSiEnergy(p) {
    try { return foEnergyOf(p).pct; } catch (e) {}
    var n = p && p.fatN != null ? +p.fatN : 0;
    return foSiClamp(100 - n, 1, 100);
  }
  function foSiStat(p, k) {
    try {
      if (k === "bat") return foSiClamp(aggBat(p), 0, 100);
      if (k === "bowl") return p.bowlType ? foSiClamp(aggBowl(p), 0, 100) : 0;
      if (k === "keep") return (p.keeper || p.role === "wicketkeeper") ? foSiClamp(aggKeep(p), 0, 100) : 0;
      if (k === "field") return foSiClamp(aggField(p), 0, 100);
      if (k === "exp") return foSiClamp(p.exp != null ? p.exp : (30 + (p.age || 20) * 1.5), 0, 100);
    } catch (e) {}
    return 0;
  }
  function foSiArt(p) {
    try {
      var base = location.pathname.indexOf("/client/") !== -1 ? "art/" :
        (location.pathname.indexOf("/next/") !== -1 ? "../client/art/" : "client/art/");
      return window.foPkArt ? base + window.foPkArt(p) : "";
    } catch (e) { return ""; }
  }
  function foSiNat(p) { return FO_SI_NAT[(p && p.nat) || ""] || String((p && p.nat) || "---").slice(0, 3).toUpperCase(); }
  function foSiShort(n) {
    var a = String(n || "Player").trim().split(/\s+/);
    return a.length > 1 ? a[0].charAt(0) + ". " + a[a.length - 1] : a[0];
  }
  function foSiTrend(p) {
    var f = p && p.formIx != null ? +p.formIx : 3;
    if (f >= 5) return { cls: "up", mark: "↑", word: "Strong" };
    if (f <= 2) return { cls: "down", mark: "↓", word: "Watch" };
    return { cls: "flat", mark: "—", word: "Steady" };
  }
  // A YEAR HERE IS ONE SEASON. The squad module owns that arithmetic; borrow
  // it so a man three-quarters through his thirty-first year plots at 31.75
  // and not at a flat 31 alongside everyone else born that season.
  function foSiAge(p) {
    try {
      var A = window.__foAge;
      if (A && A.parts) {
        var a = A.parts(p), L = 42;
        try { var c = window.__foPlanet && window.__foPlanet.CYCLE; if (c >= 1) L = c | 0; } catch (eC) {}
        return a.y + Math.min(0.98, a.d / L);
      }
    } catch (e) {}
    return +(p && p.age) || 0;
  }
  // THE VALUE LAW: a bar is coloured by what it is worth, never by what it is.
  function foSiTone(v) { return v < 30 ? "t1" : v < 50 ? "t2" : v < 75 ? "t3" : "t4"; }
  // a round number a reader can hold, for an axis of about `want` ticks
  function foSiStep(range, want, pows) {
    var raw = range / Math.max(1, want);
    for (var i = 0; i < pows.length; i++) if (pows[i] >= raw) return pows[i];
    return pows[pows.length - 1];
  }

  function foSiCss() {
    if (document.getElementById("fo-si-css")) return;
    var s = document.createElement("style"); s.id = "fo-si-css";
    s.textContent = [
      ".fo-si{--nv:#14243A;--nv2:#0C1B2E;--cr:#F1EEE6;--pp:#FFFEFC;--gd:#E8B96A;--gdD:#C08A2E;--or:#C9571F;--hair:rgba(27,36,50,.12);--mut:#7B8698}",
      ".fo-si *{box-sizing:border-box}",

      /* ---- the band: navy desk over the daylight working area ---- */
      ".fo-si-band{background:linear-gradient(168deg,#182B44,#0C1B2E);border-radius:14px;padding:18px 20px 20px;margin:0 0 16px}",
      ".fo-si-bhd{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin:0 0 16px}",
      ".fo-si-ey{font:600 11px/1 Manrope,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:var(--gd);margin:0 0 9px}",
      ".fo-si-bhd h2{margin:0;font:600 26px/1.05 Fraunces,Georgia,serif;letter-spacing:-.01em;color:#FFFEFC}",
      ".fo-si-actions{display:flex;align-items:center;gap:8px}",
      "html body #page .fo-si select{appearance:none;-webkit-appearance:none;min-width:118px;height:36px;border:1px solid rgba(232,185,106,.32) !important;border-radius:9px !important;background:rgba(255,253,247,.06) url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='m1 1 4 4 4-4' fill='none' stroke='%23E8B96A' stroke-width='1.4'/%3E%3C/svg%3E\") no-repeat right 12px center/9px 6px !important;color:#F1EEE6 !important;font:600 11px Manrope,sans-serif !important;letter-spacing:.16em;text-transform:uppercase;padding:0 32px 0 13px !important;box-shadow:none !important;cursor:pointer}",
      "html body #page .fo-si select option{color:#14243A;background:#FFFEFC}",
      ".fo-si-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}",
      ".fo-si-kpi{border:1px solid rgba(232,185,106,.18);border-radius:11px;background:rgba(255,253,247,.05);padding:12px 13px 13px}",
      ".fo-si-kpi span{display:block;font:600 11px/1 Manrope,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(241,238,230,.5)}",
      ".fo-si-kpi .v{display:flex;align-items:flex-end;gap:11px;margin-top:10px}",
      ".fo-si-kpi b{font:700 25px/1 Manrope,sans-serif;color:#FFFEFC;font-variant-numeric:tabular-nums}",
      // the note stays beside the figure it qualifies. Pushed to the far edge
      // of a card this wide it read as a separate, unrelated word.
      ".fo-si-kpi em{font-style:normal;font:600 11px/1 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#5FBF98;padding-bottom:3px}",
      ".fo-si-kpi em.watch{color:#E0906F}",

      /* ---- the working area ---- */
      ".fo-si-work{display:grid;grid-template-columns:320px minmax(0,1fr) 306px;gap:14px;align-items:start}",
      ".fo-si-card{background:var(--pp);border:1px solid var(--hair);border-radius:13px;overflow:hidden}",
      ".fo-si-ch{display:flex;align-items:baseline;gap:10px;padding:13px 15px;border-bottom:1px solid var(--hair)}",
      ".fo-si-ch b{font:700 11px/1 Manrope,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:var(--nv)}",
      ".fo-si-ch span{margin-left:auto;font:600 11px/1 Manrope,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}",

      /* ranking - every man on the books, never a silent top-N */
      ".fo-si-list{max-height:600px;overflow:auto;overscroll-behavior:contain}",
      "html body #page button.fo-si-row{display:grid;width:100%;grid-template-columns:36px minmax(0,1fr) auto 34px 18px;gap:9px;align-items:center;margin:0;padding:9px 12px !important;border:0 !important;border-bottom:1px solid rgba(27,36,50,.07) !important;border-radius:0 !important;background:var(--pp) !important;text-align:left;box-shadow:none !important;cursor:pointer}",
      "html body #page button.fo-si-row:hover{background:#F7F4EC !important}",
      "html body #page button.fo-si-row.on{background:linear-gradient(90deg,rgba(232,185,106,.18),rgba(232,185,106,0) 70%) !important;box-shadow:inset 3px 0 0 var(--gd) !important}",
      ".fo-si-thumb{width:36px;height:36px;border-radius:9px;display:block;object-fit:cover;object-position:50% 20%;background:#16283F;box-shadow:0 0 0 1px rgba(27,36,50,.16)}",
      ".fo-si-rid{min-width:0}",
      ".fo-si-rid b{display:block;font:650 13.5px/1.2 Manrope,sans-serif;color:var(--nv);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}",
      ".fo-si-rid b:hover{color:#B44A22;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}",
      ".fo-si-rid b:focus-visible{outline:2px solid #C9571F;outline-offset:1px;border-radius:3px}",
      ".fo-si-rid i{display:block;margin-top:3px;font:600 11px/1 Manrope,sans-serif;font-style:normal;letter-spacing:.15em;text-transform:uppercase;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-si-trend{font:600 11px/1 Manrope,sans-serif;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;color:#4E8A72}",
      ".fo-si-trend.up{color:#177A57}.fo-si-trend.down{color:#B4432C}",
      ".fo-si-rat{text-align:right;font:700 17px/1 Manrope,sans-serif;color:var(--nv);font-variant-numeric:tabular-nums;letter-spacing:-.02em}",
      ".fo-si-go{display:flex;align-items:center;justify-content:center;width:18px;height:26px;border-radius:6px;font:400 17px/1 Manrope,sans-serif;color:rgba(27,36,50,.3);cursor:pointer;transition:color .12s ease,background .12s ease}",
      ".fo-si-go:hover{color:#B44A22;background:rgba(201,87,31,.1)}",
      ".fo-si-go:focus-visible{outline:2px solid #C9571F;outline-offset:1px}",
      ".fo-si-open{color:inherit !important;text-decoration:none !important}",
      ".fo-si-open:hover{color:#B44A22 !important}",
      ".fo-si-empty{padding:22px 16px;font:400 13px/1.6 Fraunces,Fraunces,Georgia,serif;color:var(--mut)}",

      /* the chart: age across, rating up */
      ".fo-si-chart{position:relative;padding:16px 16px 44px 52px;height:452px}",
      ".fo-si-plot{position:relative;height:100%;border-left:1px solid rgba(27,36,50,.22);border-bottom:1px solid rgba(27,36,50,.22)}",
      ".fo-si-gl{position:absolute;background:rgba(27,36,50,.07)}",
      ".fo-si-gl.v{top:0;bottom:0;width:1px}.fo-si-gl.h{left:0;right:0;height:1px}",
      ".fo-si-tk{position:absolute;font:600 10px/1 Manrope,sans-serif;letter-spacing:.1em;color:var(--mut);font-variant-numeric:tabular-nums}",
      ".fo-si-tk.x{bottom:-19px;transform:translateX(-50%)}",
      ".fo-si-tk.y{left:-11px;transform:translate(-100%,-50%)}",
      ".fo-si-axl{position:absolute;font:600 11px/1 Manrope,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:var(--nv)}",
      ".fo-si-axl.x{left:52px;right:16px;bottom:14px;text-align:center}",
      ".fo-si-axl.y{left:14px;top:50%;transform:translate(-50%,-50%) rotate(-90deg);transform-origin:center}",
      // min-width/min-height are held down on purpose: the phone skin gives
      // every button a 38px minimum, which turned a 28px round dot into an
      // egg. A dot is a dot at every width.
      "html body #page button.fo-si-dot{position:absolute;width:34px !important;height:34px !important;min-width:0 !important;min-height:0 !important;margin:-17px 0 0 -17px;padding:0 !important;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,254,252,.9) !important;border-radius:50% !important;font:700 13px/1 Manrope,sans-serif !important;font-variant-numeric:tabular-nums;color:#F1EEE6 !important;background:var(--nv) !important;box-shadow:0 2px 7px rgba(20,36,58,.2) !important;cursor:pointer;z-index:3;transition:transform .14s ease}",
      "html body #page button.fo-si-dot.bat{background:#C9571F !important}",
      "html body #page button.fo-si-dot.ar{background:#177A57 !important}",
      "html body #page button.fo-si-dot.wk{background:#C08A2E !important}",
      "html body #page button.fo-si-dot:hover{transform:scale(1.1);z-index:5}",
      "html body #page button.fo-si-dot.on{box-shadow:0 0 0 3px var(--gd),0 2px 9px rgba(20,36,58,.3) !important;z-index:6}",
      ".fo-si-dl{position:absolute;margin:-.5em 0 0 20px;font:500 10px/1 Manrope,sans-serif;color:#4C5867;white-space:nowrap;z-index:4;pointer-events:none;text-shadow:0 0 3px #FFFEFC,0 0 3px #FFFEFC,0 0 3px #FFFEFC}",
      ".fo-si-dl.lf{margin-left:-20px;transform:translateX(-100%)}",
      ".fo-si-key{display:flex;flex-wrap:wrap;gap:14px;padding:0 16px 15px}",
      ".fo-si-key span{display:inline-flex;align-items:center;gap:6px;font:600 11px/1 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--mut)}",
      ".fo-si-key i{width:9px;height:9px;border-radius:50%;background:var(--nv)}",
      ".fo-si-key i.bat{background:#C9571F}.fo-si-key i.ar{background:#177A57}.fo-si-key i.wk{background:#C08A2E}",

      ".fo-si-bar{height:6px;border-radius:4px;background:#E7E1D3;overflow:hidden}",
      ".fo-si-bar i{display:block;height:100%;border-radius:4px;background:#177A57}",
      ".fo-si-bar i.t1{background:#C05B45}.fo-si-bar i.t2{background:#D9A441}.fo-si-bar i.t3{background:#4E8A72}.fo-si-bar i.t4{background:#177A57}",

      /* the selected man */
      ".fo-si-hero{position:relative;padding:18px 18px 20px;min-height:230px;overflow:hidden;background:linear-gradient(168deg,#182B44,#0C1B2E)}",
      ".fo-si-hero .lb{position:relative;z-index:3;display:block;font:600 11px/1 Manrope,sans-serif;letter-spacing:.21em;text-transform:uppercase;color:var(--gd)}",
      ".fo-si-idw{position:relative;z-index:3;width:150px}",
      ".fo-si-hero h3{margin:13px 0 4px;font:600 25px/.98 Fraunces,Fraunces,Georgia,serif;color:#FFFEFC}",
      ".fo-si-hero .mt{font:400 10px/1.45 Manrope,sans-serif;color:rgba(246,239,223,.6)}",
      ".fo-si-hero .big{position:relative;z-index:3;margin-top:16px;font:700 50px/.8 Manrope,sans-serif;color:#FFFEFC;font-variant-numeric:tabular-nums}",
      ".fo-si-hero .big span{display:block;margin-top:9px;font:600 11px/1 Manrope,sans-serif;letter-spacing:.19em;text-transform:uppercase;color:rgba(246,239,223,.55)}",
      ".fo-si-plate{position:absolute;right:14px;bottom:0;z-index:2;width:110px;height:186px;object-fit:cover;object-position:50% 22%;border-radius:9px 9px 0 0;box-shadow:0 0 0 1px rgba(232,185,106,.34),0 -6px 26px rgba(0,0,0,.4)}",
      ".fo-si-stats{padding:15px 17px 17px}",
      ".fo-si-st{display:grid;grid-template-columns:74px minmax(0,1fr) 30px;gap:10px;align-items:center;padding:7px 0}",
      ".fo-si-st span{font:600 11px/1 Manrope,sans-serif;letter-spacing:.17em;text-transform:uppercase;color:var(--mut)}",
      ".fo-si-st b{text-align:right;font:700 13px/1 Manrope,sans-serif;color:var(--nv);font-variant-numeric:tabular-nums}",

      "@media(max-width:1240px){.fo-si-work{grid-template-columns:290px minmax(0,1fr) 280px}}",
      "@media(max-width:1040px){.fo-si-work{grid-template-columns:290px minmax(0,1fr)}.fo-si-player{grid-column:1/-1;display:grid;grid-template-columns:330px minmax(0,1fr)}}",
      // THE PHONE. align-items:stretch is not decoration. The desktop grid
      // above sets align-items:start, and when this rule turns that same box
      // into a column flexbox the start makes every card shrink to its own
      // content - the cards stood inset with dead air either side and the
      // chart lost a fifth of its width. Stretch puts them back on the edges.
      "@media(max-width:760px){.fo-si-band{padding:14px 13px 15px;border-radius:12px;margin-bottom:12px}" +
        ".fo-si-bhd{display:block;margin-bottom:12px}.fo-si-bhd h2{font-size:21px}.fo-si-ey{font-size:10px;margin-bottom:7px}" +
        ".fo-si-actions{margin-top:11px;display:grid;grid-template-columns:1fr 1fr;gap:7px}" +
        "html body #page .fo-si select{min-width:0;height:34px;font-size:10px !important;padding:0 24px 0 10px !important;background-position:right 9px center !important}" +
        ".fo-si-kpis{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}" +
        ".fo-si-kpi{padding:9px 9px 10px;border-radius:9px}.fo-si-kpi span{font-size:10px;letter-spacing:.13em}" +
        ".fo-si-kpi .v{display:block;margin-top:6px}.fo-si-kpi b{font-size:19px}" +
        ".fo-si-kpi em{display:block;margin:5px 0 0;padding:0;font-size:10px}" +
        ".fo-si-work{display:flex;flex-direction:column;align-items:stretch}.fo-si-player{display:block}" +
        ".fo-si-chart{padding:14px 14px 40px 34px;height:380px}" +
        ".fo-si-tk{font-size:10px}.fo-si-tk.y{left:-8px}" +
        ".fo-si-axl{font-size:10px;letter-spacing:.16em}.fo-si-axl.y{left:9px}.fo-si-axl.x{left:34px;bottom:12px}" +
        ".fo-si-key{gap:9px;padding:0 14px 14px}.fo-si-key span{font-size:10px}" +
        /* on a phone the plot is barely wider than the dots: the ratings stay,
           the names go, and a tap still opens the man */
        ".fo-si-dl{display:none}html body #page button.fo-si-dot{width:28px !important;height:28px !important;margin:-14px 0 0 -14px;font-size:10px !important}.fo-si-list{max-height:none}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  // -------------------------------------------------------------------------
  // the body. `sv` is the squad room's own view state, so the role filter and
  // the selected man survive a repaint and a trip to the Grid and back.
  // -------------------------------------------------------------------------
  function foSiBody(sv) {
    foSiCss();
    var t = userTeam();
    var all = (t.players || []).slice();
    sv.iRole = ["all", "bat", "ar", "bowl", "wk"].indexOf(sv.iRole) >= 0 ? sv.iRole : "all";
    sv.iSort = ["ovr", "age", "wage", "fitness"].indexOf(sv.iSort) >= 0 ? sv.iSort : "ovr";

    var pool = all.filter(function (p) { return sv.iRole === "all" || foSiRoleKey(p) === sv.iRole; });
    pool.sort(function (a, b) {
      if (sv.iSort === "age") return foSiAge(a) - foSiAge(b) || foSiOvr(b) - foSiOvr(a);
      if (sv.iSort === "wage") return (+b.wage || 0) - (+a.wage || 0);
      if (sv.iSort === "fitness") return foSiEnergy(b) - foSiEnergy(a) || foSiOvr(b) - foSiOvr(a);
      return foSiOvr(b) - foSiOvr(a);
    });
    if (!pool.length) pool = all.slice().sort(function (a, b) { return foSiOvr(b) - foSiOvr(a); });
    var byName = {}; all.forEach(function (p) { byName[p.name] = p; });
    if (!sv.iSel || !byName[sv.iSel] || pool.indexOf(byName[sv.iSel]) < 0) sv.iSel = pool[0] && pool[0].name;
    var selected = byName[sv.iSel] || pool[0] || all[0];
    if (!selected) return "<section class='fo-si'><div class='fo-si-card'><div class='fo-si-empty'>There is nobody on the books yet.</div></div></section>";

    // ---- the headline figures ----
    // Three, and only three. Role balance and wage efficiency were invented
    // indices - a number the manager could not check against anything in the
    // game - so they are gone, and the squad-construction card with them.
    var age = all.length ? all.reduce(function (n, p) { return n + foSiAge(p); }, 0) / all.length : 0;
    var available = all.length ? Math.round(100 * all.filter(function (p) { return foSiEnergy(p) >= 65; }).length / all.length) : 0;
    var clubLabel = (t.name || "Your club").toUpperCase();

    function kpi(lbl, val, note, watch) {
      return "<div class='fo-si-kpi'><span>" + lbl + "</span><div class='v'><b>" + val + "</b>" +
        "<em" + (watch ? " class='watch'" : "") + ">" + note + "</em></div></div>";
    }
    var kpis = kpi("Squad size", all.length, all.length >= 16 ? "Full" : "Thin", all.length < 15) +
      kpi("Availability", available + "%", available >= 90 ? "Healthy" : available >= 75 ? "Manage" : "Watch", available < 75) +
      kpi("Average age", age.toFixed(1), age > 31 ? "Watch" : age < 25 ? "Young" : "Balanced", age > 31);

    var SEL = function (id, val, opts) {
      return "<select id='" + id + "'>" + opts.map(function (o) {
        return "<option value='" + o[0] + "'" + (val === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
      }).join("") + "</select>";
    };
    var band =
      "<div class='fo-si-band'>" +
      "<div class='fo-si-bhd'><div><div class='fo-si-ey'>" + foSiE(clubLabel) + " &middot; PERFORMANCE DEPARTMENT</div>" +
      "<h2>Squad Intelligence</h2></div>" +
      "<div class='fo-si-actions'>" +
      SEL("fo-si-role", sv.iRole, [["all", "All roles"], ["bat", "Batters"], ["ar", "All-rounders"], ["bowl", "Bowlers"], ["wk", "Wicketkeepers"]]) +
      SEL("fo-si-sort", sv.iSort, [["ovr", "Overall rating"], ["age", "Age curve"], ["wage", "Weekly wage"], ["fitness", "Availability"]]) +
      "</div></div>" +
      "<div class='fo-si-kpis'>" + kpis + "</div></div>";

    // ---- the ranking ----
    var ranking = pool.map(function (p) {
      var tr = foSiTrend(p);
      return "<button type='button' class='fo-si-row" + (selected.name === p.name ? " on" : "") + "' data-si-player='" + foSiE(p.name) + "'>" +
        "<img class='fo-si-thumb' src='" + foSiE(foSiArt(p)) + "' alt='' loading='lazy' decoding='async'>" +
        // his NAME is a door too, not only the chevron: a reader taps the
        // word he is looking at, and here that word did nothing but select
        "<span class='fo-si-rid'><b data-si-open='" + foSiE(p.name) + "' role='link' tabindex='0'>" + foSiE(p.name) + "</b><i>" +
        foSiE(foSiRoleName(p).replace("Wicketkeeper", "WK").replace("All-rounder", "AR")) +
        " &middot; AGE " + Math.floor(foSiAge(p)) + " &middot; " + foSiNat(p) + "</i></span>" +
        "<span class='fo-si-trend " + tr.cls + "'>" + tr.mark + " " + tr.word + "</span>" +
        "<b class='fo-si-rat'>" + foSiOvr(p) + "</b>" +
        // THE ROW SELECTS; THE CHEVRON OPENS. Reading a man in the panel and
        // going to his page are two different intentions, and this room only
        // ever offered the first - the analyst's list was the one place in the
        // game where a player's name was not a way to reach him.
        "<span class='fo-si-go' data-si-open='" + foSiE(p.name) + "' role='link' tabindex='0'" +
        " aria-label='Open " + foSiE(p.name) + "&#39;s profile'>&rsaquo;</span></button>";
    }).join("") || "<div class='fo-si-empty'>No players match this role.</div>";

    // ---- the map: age across the bottom, rating up the side ----
    var ages = pool.map(foSiAge), ovrs = pool.map(foSiOvr);
    var a0 = Math.floor(Math.min.apply(null, ages) - 1), a1 = Math.ceil(Math.max.apply(null, ages) + 1);
    if (a1 - a0 < 6) { var padA = (6 - (a1 - a0)) / 2; a0 = Math.floor(a0 - padA); a1 = Math.ceil(a1 + padA); }
    var r0 = Math.max(0, Math.floor((Math.min.apply(null, ovrs) - 4) / 5) * 5);
    var r1 = Math.min(100, Math.ceil((Math.max.apply(null, ovrs) + 4) / 5) * 5);
    if (r1 - r0 < 20) { r0 = Math.max(0, r0 - 10); r1 = Math.min(100, r1 + 10); }
    // a squad spans a dozen years at most, so age wants a tick every couple of
    // them; ratings want the fives and tens a reader already thinks in
    var xStep = (a1 - a0) <= 20 ? 2 : 5;
    var yStep = foSiStep(r1 - r0, 5, [5, 10, 20, 25]);
    var xPct = function (v) { return (v - a0) / (a1 - a0) * 100; };
    var yPct = function (v) { return 100 - (v - r0) / (r1 - r0) * 100; };

    var gl = "", xt = "", yt = "", v;
    for (v = Math.ceil(a0 / xStep) * xStep; v <= a1; v += xStep) {
      gl += "<span class='fo-si-gl v' style='left:" + xPct(v).toFixed(2) + "%'></span>";
      xt += "<span class='fo-si-tk x' style='left:" + xPct(v).toFixed(2) + "%'>" + v + "</span>";
    }
    for (v = Math.ceil(r0 / yStep) * yStep; v <= r1; v += yStep) {
      gl += "<span class='fo-si-gl h' style='top:" + yPct(v).toFixed(2) + "%'></span>";
      yt += "<span class='fo-si-tk y' style='top:" + yPct(v).toFixed(2) + "%'>" + v + "</span>";
    }
    // Two men of the same age and the same rating would sit exactly on top of
    // one another and one of them would vanish. A few hundredths of a year of
    // spread - far less than a tick - keeps both of them visible.
    var seen = {};
    var dots = pool.map(function (p) {
      var a = foSiAge(p), o = foSiOvr(p), k = Math.round(a * 2) + ":" + o;
      var n = seen[k] = (seen[k] || 0) + 1;
      var x = foSiClamp(xPct(a + (n - 1) * 0.22) * 100, 100, 9900) / 100;
      var y = yPct(o);
      var rk = foSiRoleKey(p);
      return "<button type='button' class='fo-si-dot " + rk + (selected.name === p.name ? " on" : "") + "'" +
        " data-si-player='" + foSiE(p.name) + "' title='" + foSiE(p.name) + "'" +
        " style='left:" + x.toFixed(2) + "%;top:" + y.toFixed(2) + "%'>" + o + "</button>" +
        // the name reads out to the side, not underneath: dots stack vertically
        // far more often than they sit side by side, and a label under a dot
        // lands on the man below it. Near the right edge it flips inward.
        "<span class='fo-si-dl" + (x > 76 ? " lf" : "") + "' style='left:" + x.toFixed(2) + "%;top:" + y.toFixed(2) + "%'>" + foSiE(foSiShort(p.name)) + "</span>";
    }).join("");

    var map =
      "<article class='fo-si-card'><div class='fo-si-ch'><b>Squad performance map</b><span>Click a player to inspect</span></div>" +
      "<div class='fo-si-chart'><span class='fo-si-axl y'>Rating</span><span class='fo-si-axl x'>Age</span>" +
      "<div class='fo-si-plot'>" + gl + yt + xt + dots + "</div></div>" +
      "<div class='fo-si-key'><span><i class='bat'></i>Batter</span><span><i></i>Bowler</span>" +
      "<span><i class='ar'></i>All-rounder</span><span><i class='wk'></i>Wicketkeeper</span></div></article>";

    // ---- the selected man ----
    var keep = foSiStat(selected, "keep"), bowl = foSiStat(selected, "bowl");
    var stats = [["Batting", foSiStat(selected, "bat")], keep ? ["Keeping", keep] : ["Bowling", bowl],
      ["Fielding", foSiStat(selected, "field")], ["Experience", foSiStat(selected, "exp")],
      ["Fitness", foSiEnergy(selected)]].map(function (x) {
        return "<div class='fo-si-st'><span>" + x[0] + "</span>" +
          "<div class='fo-si-bar'><i class='" + foSiTone(x[1]) + "' style='width:" + x[1] + "%'></i></div>" +
          "<b>" + x[1] + "</b></div>";
      }).join("");

    var player = "<aside class='fo-si-card fo-si-player'>" +
      "<div class='fo-si-hero'><span class='lb'>Selected player</span>" +
      "<div class='fo-si-idw'><h3><a class='fo-si-open' href='#/player?n=" + encodeURIComponent(selected.name) + "'>" +
        foSiE(selected.name) + "</a></h3>" +
      "<div class='mt'>" + foSiE(foSiRoleName(selected)) + " &middot; " + (selected.hand === "L" ? "LHB" : "RHB") + " &middot; " + foSiNat(selected) + "</div></div>" +
      "<div class='big'>" + foSiOvr(selected) + "<span>Overall</span></div>" +
      "<img class='fo-si-plate' src='" + foSiE(foSiArt(selected)) + "' alt='' decoding='async'></div>" +
      "<div class='fo-si-stats'>" + stats + "</div></aside>";

    return "<section class='fo-si'>" + band +
      "<div class='fo-si-work'>" +
      "<article class='fo-si-card'><div class='fo-si-ch'><b>Player ranking</b><span>" +
      ({ ovr: "Overall", age: "Age", wage: "Wage", fitness: "Availability" }[sv.iSort] || "Overall") + " ↓</span></div>" +
      "<div class='fo-si-list'>" + ranking + "</div></article>" +
      map + player +
      "</div></section>";
  }

  // -------------------------------------------------------------------------
  // KEEPING THE DOTS APART
  //
  // Two men of the same age and a rating within a point of each other land on
  // top of one another and one of them disappears. Nudging them by a fraction
  // of a year cannot fix that: on a phone the whole plot is 300px wide, so a
  // dot is worth about two years of the axis and no honest jitter is large
  // enough. So the spreading is done in pixels, after layout, where the real
  // geometry is known: each dot in turn is fanned right, then left, in whole
  // dot-widths until it clears everything already placed. The vertical
  // position - the rating, the thing being read - is never touched.
  // -------------------------------------------------------------------------
  function foSiSpread(page) {
    var plot = page.querySelector(".fo-si-plot"); if (!plot) return;
    var W = plot.clientWidth, H = plot.clientHeight; if (!W || !H) return;
    var dots = [].slice.call(plot.querySelectorAll(".fo-si-dot"));
    if (dots.length < 2) return;
    var d = dots[0].offsetWidth || 30, half = d / 2, placed = [];
    dots.forEach(function (el) {
      var x = parseFloat(el.style.left) / 100 * W;
      var y = parseFloat(el.style.top) / 100 * H;
      var dx = 0, guard = 0;
      while (guard++ < 30) {
        var clash = 0;
        for (var i = 0; i < placed.length; i++) {
          if (Math.abs(placed[i].x - (x + dx)) < d * .94 && Math.abs(placed[i].y - y) < d * .82) { clash = 1; break; }
        }
        if (!clash) break;
        dx = dx > 0 ? -dx : (-dx + d * .94);          // right, left, wider right...
        if (x + dx < half || x + dx > W - half) dx = dx > 0 ? -dx : (-dx + d * .94);
      }
      placed.push({ el: el, x: x + dx, y: y, dx: dx });
      if (dx) el.style.marginLeft = (dx - half) + "px";
    });

    // Second pass: the names. A label sits twenty pixels to the right of its
    // dot and can be sixty wide, so on a crowded row it lands squarely on
    // whoever stands next along. Put it on the side that is free, and only
    // drop it when both sides are taken.
    var GAP = 20;
    placed.forEach(function (p) {
      var lab = p.el.nextElementSibling;
      if (!lab || lab.className.indexOf("fo-si-dl") < 0) return;
      var lw = lab.offsetWidth; if (!lw) return;                  // hidden on phones
      var free = function (from, to) {
        for (var i = 0; i < placed.length; i++) {
          var o = placed[i];
          if (o === p || Math.abs(o.y - p.y) > d * .6) continue;
          if (o.x + half > from && o.x - half < to) return 0;
        }
        return 1;
      };
      if (p.x + half + GAP + lw <= W && free(p.x + half, p.x + half + GAP + lw)) {
        lab.style.marginLeft = (GAP + p.dx) + "px"; lab.style.transform = "none"; return;
      }
      if (p.x - half - GAP - lw >= 0 && free(p.x - half - GAP - lw, p.x - half)) {
        lab.style.marginLeft = (-GAP + p.dx) + "px"; lab.style.transform = "translateX(-100%)"; return;
      }
      lab.style.display = "none";
    });
  }

  // wiring. `repaint` is the squad room's own repainter, so a filter change or
  // a click on a dot redraws the whole room and keeps the switch where it was.
  function foSiWire(page, sv, repaint) {
    try { foSiSpread(page); } catch (eS) {}
    var role = page.querySelector("#fo-si-role");
    if (role) role.addEventListener("change", function () { sv.iRole = role.value; sv.iSel = null; repaint(); });
    var sort = page.querySelector("#fo-si-sort");
    if (sort) sort.addEventListener("change", function () { sv.iSort = sort.value; repaint(); });
    var open = function (n) { if (n) { location.hash = "#/player?n=" + encodeURIComponent(n); try { if (typeof window.route === "function") window.route(); } catch (eR) {} } };
    page.querySelectorAll("[data-si-open]").forEach(function (g) {
      g.addEventListener("click", function (ev) { ev.stopPropagation(); open(g.getAttribute("data-si-open")); });
      g.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); open(g.getAttribute("data-si-open")); }
      });
    });
    page.querySelectorAll("[data-si-player]").forEach(function (b) {
      b.addEventListener("click", function () { sv.iSel = b.getAttribute("data-si-player"); repaint(); });
    });
  }

  window.__foSquadIntel = { body: foSiBody, wire: foSiWire };
})();
