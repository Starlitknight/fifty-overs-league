(function () {
  "use strict";
  // =========================================================================
  // SQUAD INTELLIGENCE
  // A second, read-only way to understand the club's players. The operational
  // squad room remains at #/squad; this page turns the same live state into a
  // clean performance workspace for comparison and succession decisions.
  // =========================================================================
  if (window.__foSquadIntelligencePage) return;
  window.__foSquadIntelligencePage = 1;
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
    if (f >= 5) return { cls: "up", mark: "\u2191", word: "Strong" };
    if (f <= 2) return { cls: "down", mark: "\u2193", word: "Watch" };
    return { cls: "flat", mark: "\u2014", word: "Steady" };
  }
  function foSiDecision(p, rank, total) {
    var age = p.age | 0, fit = foSiEnergy(p), ovr = foSiOvr(p), role = foSiRoleName(p).toLowerCase();
    if (rank === 0) return "Your highest-rated player and the standard-setter in this squad. Build the strongest XI around " + foSiShort(p.name) + ".";
    if (age <= 22 && ovr >= 55) return "A high-value young " + role + ". Protect minutes for development without overloading him on crowded matchdays.";
    if (age >= 32 && ovr >= 65) return "Elite short-term value, but the age curve is narrowing. Begin succession planning while his influence is still strong.";
    if (fit < 65) return "Current ability is being limited by availability. Rest and rotation will return more value than another intensive training block.";
    if (rank >= Math.max(5, total - 3)) return "A depth option today. Define one specialist role for him or consider whether the wage can be used more efficiently elsewhere.";
    return "A reliable squad option with a clear role. Compare him against adjacent players before locking the next First XI.";
  }

  function foSiCss() {
    if (document.getElementById("fo-si-css")) return;
    var s = document.createElement("style"); s.id = "fo-si-css";
    s.textContent = [
      "html body.fo-si-on{background:#F1F4F8 !important}",
      "html body.fo-si-on #page.fo-si-page{box-sizing:border-box;max-width:none !important;width:100% !important;min-height:calc(100vh - var(--fo-tbh,68px));margin:0 !important;padding:0 28px 26px !important;background:#F1F4F8 !important;color:#1B273B;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
      ".fo-si{max-width:1500px;margin:0 auto;padding-top:17px}",
      ".fo-si *{box-sizing:border-box}",
      ".fo-si-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:0 0 22px}",
      ".fo-si-ey{font:700 9px/1.2 Oswald,Inter,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#3488E2;margin:0 0 8px}",
      ".fo-si-head h1{margin:0;color:#1B273B;font:800 38px/.98 Inter,sans-serif;letter-spacing:-.045em}",
      ".fo-si-sub{margin:9px 0 0;color:#8190A4;font-size:11px;line-height:1.5}",
      ".fo-si-actions{display:flex;align-items:center;gap:9px;padding-top:1px}",
      "html body #page .fo-si select{appearance:none;-webkit-appearance:none;min-width:102px;height:39px;border:1px solid #D6DEE8 !important;border-radius:9px !important;background:#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='m1 1 4 4 4-4' fill='none' stroke='%237D8CA2' stroke-width='1.4'/%3E%3C/svg%3E\") no-repeat right 12px center/9px 6px !important;color:#65748A !important;font:700 9px Oswald,Inter,sans-serif !important;letter-spacing:.17em;text-transform:uppercase;padding:0 32px 0 14px !important;box-shadow:none !important}",
      "html body #page .fo-si .fo-si-compare{height:39px;border:0 !important;border-radius:9px !important;background:#F25D34 !important;color:#fff !important;font:700 9px Oswald,Inter,sans-serif !important;letter-spacing:.19em;text-transform:uppercase;padding:0 18px !important;box-shadow:none !important;white-space:nowrap}",
      "html body #page .fo-si .fo-si-compare:hover{background:#DF4D27 !important}",
      "html body #page .fo-si .fo-si-compare.on{background:#142C4C !important}",
      ".fo-si-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:0 0 14px}",
      ".fo-si-kpi{height:76px;border:1px solid #D6DEE8;border-radius:11px;background:#fff;padding:13px 14px;box-shadow:0 1px 1px rgba(18,36,61,.02)}",
      ".fo-si-kpi span{display:block;color:#8492A6;font:700 9px/1 Oswald,Inter,sans-serif;letter-spacing:.21em;text-transform:uppercase}",
      ".fo-si-kpi .v{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin-top:7px}",
      ".fo-si-kpi b{font-size:23px;line-height:1;font-weight:800;color:#1B273B;font-variant-numeric:tabular-nums}",
      ".fo-si-kpi em{font-size:8px;font-style:normal;color:#2AA775;white-space:nowrap;margin-bottom:2px}.fo-si-kpi em.watch{color:#F25D34}",
      ".fo-si-work{display:grid;grid-template-columns:350px minmax(520px,1fr) 300px;gap:14px;align-items:stretch}",
      ".fo-si-card{background:#fff;border:1px solid #D5DEE9;border-radius:13px;overflow:hidden;box-shadow:0 1px 1px rgba(18,36,61,.025)}",
      ".fo-si-rank{min-height:594px}",
      ".fo-si-cardhead{height:49px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #DFE5ED}",
      ".fo-si-cardhead b,.fo-si-title{color:#1A2940;font:700 9px/1 Oswald,Inter,sans-serif;letter-spacing:.21em;text-transform:uppercase}",
      ".fo-si-cardhead span{color:#92A0B2;font:500 7.5px/1 Oswald,Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase}",
      ".fo-si-list{padding:4px 10px 10px}",
      "html body #page .fo-si-row{width:100%;height:62px;display:grid;grid-template-columns:38px minmax(0,1fr) 53px 29px;gap:7px;align-items:center;margin:0;padding:0 7px;border:0 !important;border-bottom:1px solid #E8EDF3 !important;border-radius:0 !important;background:#fff !important;color:#1D2A40 !important;text-align:left;box-shadow:none !important;cursor:pointer}",
      "html body #page .fo-si-row:hover,html body #page .fo-si-row.on{background:#F5F8FB !important}",
      "html body #page .fo-si-row.on{box-shadow:inset 3px 0 0 #398FE5 !important}",
      ".fo-si-thumb{width:36px;height:36px;border-radius:9px;overflow:hidden;background:#102846;display:block}",
      ".fo-si-thumb img{width:100%;height:100%;display:block;object-fit:cover;object-position:50% 22%}",
      ".fo-si-rid{min-width:0}.fo-si-rid b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:1.15;color:#1C2B42}.fo-si-rid span{display:block;margin-top:3px;color:#8593A5;font:700 7.5px/1 Oswald,Inter,sans-serif;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-si-trend{font-size:7.5px;white-space:nowrap}.fo-si-trend.up{color:#21A676}.fo-si-trend.down{color:#F25D34}.fo-si-trend.flat{color:#54B89A}",
      ".fo-si-rat{text-align:right;font-size:17px;font-weight:800;color:#1A2940;font-variant-numeric:tabular-nums}",
      ".fo-si-mid{display:grid;grid-template-rows:388px 1fr;gap:14px;min-width:0}",
      ".fo-si-mapcard{padding:0 14px 13px}",
      ".fo-si-mapcard .fo-si-cardhead{margin:0 -14px;padding:0 14px}",
      ".fo-si-map{position:relative;height:324px;margin-top:0;border-left:1px solid #DDE5EE;border-bottom:1px solid #D5DEE8;background-image:linear-gradient(#E6ECF2 1px,transparent 1px),linear-gradient(90deg,#E6ECF2 1px,transparent 1px);background-size:16.666% 25%;overflow:hidden}",
      ".fo-si-axis{position:absolute;left:0;top:3px;color:#9AA8B9;font:700 8px/1 Oswald,Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase;z-index:1}",
      ".fo-si-hint{position:absolute;right:10px;top:10px;padding:7px 9px;border:1px solid #D9E2EC;border-radius:8px;background:rgba(255,255,255,.9);color:#8796A9;font-size:7px;z-index:2}",
      "html body #page .fo-si-dot{position:absolute;width:39px;height:39px;margin:-19px 0 0 -19px;border:3px solid rgba(255,255,255,.92) !important;border-radius:50% !important;color:#fff !important;background:#4E9BE8 !important;font-size:10px !important;font-weight:800 !important;box-shadow:0 0 0 1px rgba(45,103,168,.16),0 3px 7px rgba(26,60,98,.12) !important;padding:0 !important;z-index:3;cursor:pointer;transition:transform .14s ease}",
      "html body #page .fo-si-dot:hover,html body #page .fo-si-dot.on{transform:scale(1.11)}",
      "html body #page .fo-si-dot.gold{background:#E4B23D !important}html body #page .fo-si-dot.green{background:#35B98F !important}html body #page .fo-si-dot.orange{background:#EF6A3A !important}",
      ".fo-si-dotlabel{position:absolute;transform:translate(-50%,23px);font-size:6.5px;font-weight:700;color:#53647A;white-space:nowrap;z-index:2}",
      ".fo-si-build{padding:0 14px 13px}",
      ".fo-si-build .fo-si-cardhead{height:42px;margin:0 -14px;border-bottom:0;padding:0 14px}",
      ".fo-si-buildgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}",
      ".fo-si-buildbox{height:118px;border:1px solid #D9E1EA;border-radius:10px;padding:14px 13px;background:#fff}",
      ".fo-si-buildbox span{display:block;color:#8896A8;font:700 8.5px/1 Oswald,Inter,sans-serif;letter-spacing:.18em;text-transform:uppercase}",
      ".fo-si-buildbox b{display:block;margin:9px 0 12px;font-size:27px;line-height:1;font-weight:800;color:#1B273B}",
      ".fo-si-bar{height:6px;border-radius:999px;background:#E8EDF2;overflow:hidden}.fo-si-bar i{display:block;height:100%;border-radius:inherit;background:#35AF85}",
      ".fo-si-bar.orange i{background:#EF6942}.fo-si-bar.blue i{background:#3D91E5}.fo-si-bar.gold i{background:#D4A73E}.fo-si-bar.purple i{background:#7D62DC}",
      ".fo-si-player{min-height:594px;background:#fff}",
      ".fo-si-hero{position:relative;height:225px;padding:18px 17px;background:#102948;color:#fff;overflow:hidden}",
      ".fo-si-hero:after{content:'';position:absolute;right:-28px;top:17px;width:215px;height:215px;border:1px solid rgba(225,177,61,.22);border-radius:50%;box-shadow:0 0 0 22px rgba(225,177,61,.035),0 0 0 44px rgba(225,177,61,.025)}",
      ".fo-si-selected{position:relative;z-index:3;color:#55A8F7;font:700 8px/1 Oswald,Inter,sans-serif;letter-spacing:.21em;text-transform:uppercase}",
      ".fo-si-hero h2{position:relative;z-index:3;width:132px;margin:14px 0 3px;font-size:23px;line-height:.92;letter-spacing:-.025em;color:#fff}",
      ".fo-si-meta{position:relative;z-index:3;color:#9AAAC0;font-size:7.5px;line-height:1.4}",
      ".fo-si-big{position:relative;z-index:3;margin-top:17px;font-size:50px;line-height:.8;font-weight:800;color:#fff}.fo-si-big span{display:block;margin-top:9px;color:#8EA1B8;font:700 8px/1 Oswald,Inter,sans-serif;letter-spacing:.19em;text-transform:uppercase}",
      ".fo-si-art{position:absolute;z-index:2;right:-4px;bottom:0;width:190px;height:198px;object-fit:cover;object-position:50% 23%;clip-path:ellipse(47% 49% at 53% 51%)}",
      ".fo-si-detail{padding:17px 15px 15px}",
      ".fo-si-stat{display:grid;grid-template-columns:85px minmax(0,1fr) 25px;gap:10px;align-items:center;height:32px}",
      ".fo-si-stat span{color:#8B99AB;font:700 8px/1 Oswald,Inter,sans-serif;letter-spacing:.19em;text-transform:uppercase}.fo-si-stat b{text-align:right;color:#233147;font-size:8.5px}",
      ".fo-si-note{margin-top:10px;padding:10px 11px;border-radius:9px;background:#F3F6FA;color:#77869A;font-size:7.5px;line-height:1.55}",
      ".fo-si-comparetray{display:none;position:fixed;left:50%;bottom:22px;z-index:360;transform:translateX(-50%);align-items:center;gap:10px;min-width:340px;padding:9px 12px;border-radius:13px;background:#102948;color:#fff;box-shadow:0 16px 44px rgba(16,41,72,.28)}",
      ".fo-si-comparetray.show{display:flex}.fo-si-comparetray span{flex:1;font-size:10px;color:#C7D2DF}",
      "html body #page .fo-si-comparetray button{border:1px solid rgba(255,255,255,.2) !important;border-radius:8px !important;background:rgba(255,255,255,.08) !important;color:#fff !important;font-size:9px !important;padding:7px 10px !important}",
      "@media(max-width:1210px){.fo-si-work{grid-template-columns:310px minmax(470px,1fr) 270px}.fo-si-stat{grid-template-columns:72px minmax(0,1fr) 24px}.fo-si-art{width:170px}.fo-si-row{grid-template-columns:38px minmax(0,1fr) 47px 26px !important}}",
      "@media(max-width:980px){html body.fo-si-on #page.fo-si-page{padding:0 18px 24px !important}.fo-si-work{grid-template-columns:310px minmax(0,1fr)}.fo-si-player{grid-column:1/-1;min-height:0;display:grid;grid-template-columns:330px 1fr}.fo-si-hero{height:260px}.fo-si-kpis{grid-template-columns:repeat(3,1fr)}}",
      "@media(max-width:720px){html body.fo-si-on #page.fo-si-page{padding:0 12px 88px !important}.fo-si{padding-top:14px}.fo-si-head{display:block;padding-bottom:15px}.fo-si-head h1{font-size:32px}.fo-si-actions{margin-top:15px;display:grid;grid-template-columns:1fr 1fr}.fo-si-actions .fo-si-compare{grid-column:1/-1}.fo-si-kpis{grid-template-columns:repeat(2,1fr)}.fo-si-kpi:last-child{grid-column:1/-1}.fo-si-work{display:flex;flex-direction:column}.fo-si-rank{min-height:0}.fo-si-list{max-height:410px;overflow:auto}.fo-si-mid{display:flex;flex-direction:column}.fo-si-mapcard{height:390px}.fo-si-map{height:325px}.fo-si-buildgrid{grid-template-columns:1fr}.fo-si-buildbox{height:92px}.fo-si-player{display:block}.fo-si-hero{height:235px}.fo-si-art{width:190px}.fo-si-comparetray{min-width:0;width:calc(100% - 24px);bottom:76px}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function foSiRender() {
    try {
      foSiCss();
      var page = document.getElementById("page"); if (!page) return;
      document.body.classList.add("fo-si-on");
      page.classList.add("fo-si-page");
      var t = userTeam();
      var all = (t.players || []).slice();
      window.squadIntelligence = window.squadIntelligence || {};
      var st = window.squadIntelligence;
      st.role = ["all", "bat", "ar", "bowl", "wk"].indexOf(st.role) >= 0 ? st.role : "all";
      st.sort = ["ovr", "age", "wage", "fitness"].indexOf(st.sort) >= 0 ? st.sort : "ovr";
      st.compare = !!st.compare; st.picks = st.picks || [];

      var pool = all.filter(function (p) { return st.role === "all" || foSiRoleKey(p) === st.role; });
      pool.sort(function (a, b) {
        if (st.sort === "age") return (a.age | 0) - (b.age | 0) || foSiOvr(b) - foSiOvr(a);
        if (st.sort === "wage") return (+b.wage || 0) - (+a.wage || 0);
        if (st.sort === "fitness") return foSiEnergy(b) - foSiEnergy(a) || foSiOvr(b) - foSiOvr(a);
        return foSiOvr(b) - foSiOvr(a);
      });
      if (!pool.length) pool = all.slice().sort(function (a, b) { return foSiOvr(b) - foSiOvr(a); });
      var byName = {}; all.forEach(function (p) { byName[p.name] = p; });
      if (!st.selected || !byName[st.selected] || pool.indexOf(byName[st.selected]) < 0) st.selected = pool[0] && pool[0].name;
      var selected = byName[st.selected] || pool[0] || all[0];

      var wage = all.reduce(function (n, p) { return n + (+p.wage || 0); }, 0);
      var age = all.length ? all.reduce(function (n, p) { return n + (+p.age || 0); }, 0) / all.length : 0;
      var available = all.length ? Math.round(100 * all.filter(function (p) { return foSiEnergy(p) >= 65; }).length / all.length) : 0;
      var counts = { bat: 0, ar: 0, bowl: 0, wk: 0 };
      all.forEach(function (p) { counts[foSiRoleKey(p)] += 1; });
      var balance = foSiClamp(100 - Math.max(0, 5 - counts.bat) * 7 - Math.max(0, 4 - counts.bowl) * 8 - Math.max(0, 2 - counts.ar) * 6 - (counts.wk ? 0 : 18), 30, 100);
      var ageCurve = foSiClamp(100 - Math.abs(age - 27) * 8, 28, 100);
      var avgOvr = all.length ? all.reduce(function (n, p) { return n + foSiOvr(p); }, 0) / all.length : 0;
      var avgWage = all.length ? wage / all.length : 0;
      var wageEff = foSiClamp(58 + (avgOvr - 50) * .8 - Math.max(0, avgWage - 1600) / 120, 35, 96);
      var clubLabel = (t.name || "Your club").toUpperCase();

      function kpi(lbl, val, note, watch) {
        return "<div class='fo-si-kpi'><span>" + lbl + "</span><div class='v'><b>" + val + "</b><em" + (watch ? " class='watch'" : "") + ">" + note + "</em></div></div>";
      }
      var kpis = kpi("Squad size", all.length, all.length >= 16 ? "Full" : "Thin", all.length < 15) +
        kpi("Availability", available + "%", available >= 90 ? "Healthy" : available >= 75 ? "Manage" : "Watch", available < 75) +
        kpi("Role balance", balance, balance >= 85 ? "Strong" : "Review", balance < 75) +
        kpi("Average age", age.toFixed(1), age > 31 ? "Watch" : age < 25 ? "Young" : "Balanced", age > 31) +
        kpi("Wage efficiency", wageEff, wageEff >= 72 ? "Good" : "Review", wageEff < 60);

      var ranking = pool.slice(0, 8).map(function (p) {
        var tr = foSiTrend(p), on = selected && selected.name === p.name;
        return "<button type='button' class='fo-si-row" + (on ? " on" : "") + "' data-si-player='" + foSiE(p.name) + "'>" +
          "<span class='fo-si-thumb'><img src='" + foSiE(foSiArt(p)) + "' alt='' loading='lazy'></span>" +
          "<span class='fo-si-rid'><b>" + foSiE(p.name) + "</b><span>" + foSiE(foSiRoleName(p).replace("Wicketkeeper", "WK").replace("All-rounder", "AR")) + " &middot; AGE " + (p.age | 0) + " &middot; " + foSiNat(p) + "</span></span>" +
          "<span class='fo-si-trend " + tr.cls + "'>" + tr.mark + " " + tr.word + "</span><b class='fo-si-rat'>" + foSiOvr(p) + "</b></button>";
      }).join("") || "<div class='fo-si-note'>No players match this role.</div>";

      var mapPlayers = pool.slice().sort(function (a, b) { return foSiOvr(b) - foSiOvr(a); }).slice(0, 7);
      var hi = mapPlayers.length ? foSiOvr(mapPlayers[0]) : 100;
      var lo = mapPlayers.length ? foSiOvr(mapPlayers[mapPlayers.length - 1]) : 0;
      var xpos = [75, 59, 86, 69, 43, 54, 81];
      var dots = mapPlayers.map(function (p, i) {
        var y = 25 + (hi === lo ? i * 7 : (hi - foSiOvr(p)) / Math.max(1, hi - lo) * 57);
        var x = xpos[i % xpos.length];
        var rk = foSiRoleKey(p), cls = i === 0 ? " gold" : rk === "ar" ? " green" : rk === "bat" && i > 4 ? " orange" : "";
        return "<button type='button' class='fo-si-dot" + cls + (selected && selected.name === p.name ? " on" : "") + "' data-si-player='" + foSiE(p.name) + "' style='left:" + x + "%;top:" + y.toFixed(1) + "%'>" + foSiOvr(p) + "</button>" +
          "<span class='fo-si-dotlabel' style='left:" + x + "%;top:" + y.toFixed(1) + "%'>" + foSiE(foSiShort(p.name)) + "</span>";
      }).join("");

      var selRank = all.slice().sort(function (a, b) { return foSiOvr(b) - foSiOvr(a); }).indexOf(selected);
      var chosenOvr = foSiOvr(selected), keep = foSiStat(selected, "keep"), bowl = foSiStat(selected, "bowl");
      var skill2 = keep ? ["Keeping", keep, "gold"] : ["Bowling", bowl, "gold"];
      var stats = [["Batting", foSiStat(selected, "bat"), "blue"], skill2,
        ["Fielding", foSiStat(selected, "field"), ""], ["Experience", foSiStat(selected, "exp"), "purple"],
        ["Fitness", foSiEnergy(selected), ""]].map(function (x) {
          return "<div class='fo-si-stat'><span>" + x[0] + "</span><div class='fo-si-bar " + x[2] + "'><i style='width:" + x[1] + "%'></i></div><b>" + x[1] + "</b></div>";
        }).join("");

      var pageHtml = "<main class='fo-si'>" +
        "<header class='fo-si-head'><div><div class='fo-si-ey'>" + foSiE(clubLabel) + " &middot; PERFORMANCE DEPARTMENT</div><h1>Squad Intelligence</h1><p class='fo-si-sub'>Make faster decisions with role-fit, performance and availability in one workspace.</p></div>" +
        "<div class='fo-si-actions'><select id='fo-si-role' aria-label='Filter roles'><option value='all'>All roles</option><option value='bat'>Batters</option><option value='ar'>All-rounders</option><option value='bowl'>Bowlers</option><option value='wk'>Wicketkeepers</option></select>" +
        "<select id='fo-si-sort' aria-label='Sort players'><option value='ovr'>Overall rating</option><option value='age'>Age curve</option><option value='wage'>Weekly wage</option><option value='fitness'>Availability</option></select>" +
        "<button type='button' id='fo-si-compare' class='fo-si-compare" + (st.compare ? " on" : "") + "'>" + (st.compare ? "Finish comparison" : "Compare players") + "</button></div></header>" +
        "<section class='fo-si-kpis'>" + kpis + "</section>" +
        "<section class='fo-si-work'>" +
          "<article class='fo-si-card fo-si-rank'><div class='fo-si-cardhead'><b>Player ranking</b><span>" + (st.sort === "ovr" ? "Overall \u2193" : foSiE(st.sort) + " \u2193") + "</span></div><div class='fo-si-list'>" + ranking + "</div></article>" +
          "<div class='fo-si-mid'>" +
            "<article class='fo-si-card fo-si-mapcard'><div class='fo-si-cardhead'><b>Squad performance map</b><span>Click a player to inspect</span></div><div class='fo-si-map'><span class='fo-si-axis'>Current ability</span><span class='fo-si-hint'>Upper-right = strongest value</span>" + dots + "</div></article>" +
            "<article class='fo-si-card fo-si-build'><div class='fo-si-cardhead'><b>Squad construction</b></div><div class='fo-si-buildgrid'>" +
              "<div class='fo-si-buildbox'><span>Role balance</span><b>" + balance + "</b><div class='fo-si-bar'><i style='width:" + balance + "%'></i></div></div>" +
              "<div class='fo-si-buildbox'><span>Age curve</span><b>" + ageCurve + "</b><div class='fo-si-bar orange'><i style='width:" + ageCurve + "%'></i></div></div>" +
              "<div class='fo-si-buildbox'><span>Fitness</span><b>" + available + "</b><div class='fo-si-bar'><i style='width:" + available + "%'></i></div></div>" +
            "</div></article>" +
          "</div>" +
          "<aside class='fo-si-card fo-si-player'><div class='fo-si-hero'><div class='fo-si-selected'>Selected player</div><h2>" + foSiE(selected.name) + "</h2><div class='fo-si-meta'>" + foSiE(foSiRoleName(selected)) + " &middot; " + (selected.hand === "L" ? "LHB" : "RHB") + " &middot; " + foSiNat(selected) + "</div><div class='fo-si-big'>" + chosenOvr + "<span>Overall</span></div><img class='fo-si-art' src='" + foSiE(foSiArt(selected)) + "' alt=''></div>" +
            "<div class='fo-si-detail'>" + stats + "<div class='fo-si-note'>Decision signal: " + foSiE(foSiDecision(selected, selRank, all.length)) + "</div></div></aside>" +
        "</section>" +
        "<div class='fo-si-comparetray" + (st.compare ? " show" : "") + "'><span>" + (st.picks.length ? st.picks.map(foSiE).join(" vs ") : "Select two players from the ranking") + "</span><button type='button' id='fo-si-clear'>Clear</button></div>" +
      "</main>";
      page.innerHTML = pageHtml;

      var role = page.querySelector("#fo-si-role"), sort = page.querySelector("#fo-si-sort");
      if (role) { role.value = st.role; role.addEventListener("change", function () { st.role = role.value; st.selected = null; foSiRender(); }); }
      if (sort) { sort.value = st.sort; sort.addEventListener("change", function () { st.sort = sort.value; foSiRender(); }); }
      var compare = page.querySelector("#fo-si-compare");
      if (compare) compare.addEventListener("click", function () { st.compare = !st.compare; if (!st.compare) st.picks = []; foSiRender(); });
      var clear = page.querySelector("#fo-si-clear");
      if (clear) clear.addEventListener("click", function () { st.picks = []; foSiRender(); });
      [].slice.call(page.querySelectorAll("[data-si-player]")).forEach(function (b) {
        b.addEventListener("click", function () {
          var name = b.getAttribute("data-si-player"); st.selected = name;
          if (st.compare) {
            var ix = st.picks.indexOf(name);
            if (ix >= 0) st.picks.splice(ix, 1);
            else { if (st.picks.length >= 2) st.picks.shift(); st.picks.push(name); }
          }
          foSiRender();
        });
      });
    } catch (e) {
      try { console.error("Squad Intelligence", e); foPageFailed("squad intelligence", e, "Squad Intelligence could not be drawn."); } catch (e2) {}
    }
  }
  window.foRenderSquadIntelligence = foSiRender;

  // On a cold deep link the core router deliberately keeps this hash until
  // the league module is ready. Ask it to paint now that the renderer exists.
  if ((location.hash || "").split("?")[0] === "#/squad-intelligence") {
    setTimeout(function () { if (typeof window.route === "function") window.route(); }, 0);
  }
  window.addEventListener("hashchange", function () {
    if ((location.hash || "").split("?")[0] !== "#/squad-intelligence") {
      document.body.classList.remove("fo-si-on");
      var p = document.getElementById("page"); if (p) p.classList.remove("fo-si-page");
    }
  });
})();
