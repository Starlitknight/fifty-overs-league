// ---- 19-modern-shell.js — the modern app shell -------------------------------
// The game's pages got art; the chrome around them stayed 2012. This module is
// the product-design pass: a glass topbar, a phone tab dock, motion on route
// changes, real press/hover/focus states, and a live match-centre where the
// dead "No match selected" panel used to be. Pure overlay: it restyles and
// augments the existing DOM, never replaces engine markup.
(function () {
  "use strict";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  var ACCENT = "#FF7A50";

  // ---- the phone tab dock ----------------------------------------------------
  // Five destinations cover 90% of sessions; the hamburger keeps the rest.
  var DOCK = [
    { k: "club", label: "Club", hash: "#/club", ic: "<path d='M3.5 10.6 12 3.4l8.5 7.2'/><path d='M5.5 9.4V20a.6.6 0 0 0 .6.6h11.8a.6.6 0 0 0 .6-.6V9.4'/><path d='M9.8 20.4v-5.6h4.4v5.6'/>" },
    { k: "league", label: "League", hash: "#/league", ic: "<path d='M8 21.2h8'/><path d='M12 17.4v3.8'/><path d='M7.2 3.6h9.6v4.6a4.8 4.8 0 0 1-9.6 0z'/><path d='M7.2 5H4.4v1.8a3 3 0 0 0 3 3'/><path d='M16.8 5h2.8v1.8a3 3 0 0 1-3 3'/>" },
    { k: "squad", label: "Squad", hash: "#/squad", ic: "<circle cx='9.2' cy='7.8' r='3.4'/><path d='M3.6 20.2c0-3.1 2.5-5.2 5.6-5.2s5.6 2.1 5.6 5.2'/><path d='M15.4 4.8a3.4 3.4 0 0 1 0 6'/><path d='M16.8 15.2c2.3.5 3.9 2.3 3.9 5'/>" },
    { k: "nets", label: "Nets", hash: "#/training", ic: "<circle cx='12' cy='12' r='8.4'/><circle cx='12' cy='12' r='4.4'/><circle cx='12' cy='12' r='.9' fill='currentColor' stroke='none'/>" },
    { k: "desk", label: "Desk", hash: "#/desk", ic: "<path d='M20.8 12.4v6a1 1 0 0 1-1 1H4.2a1 1 0 0 1-1-1v-6'/><path d='M3.2 12.4 6 5.6a1 1 0 0 1 .9-.6h10.2a1 1 0 0 1 .9.6l2.8 6.8'/><path d='M3.2 12.4h5.4l1.5 2.6h3.8l1.5-2.6h5.4'/>" }
  ];
  // which dock lamp lights up for which route
  var DOCK_MAP = {
    club: ["club", "home"],
    league: ["league", "nation", "cup", "world", "city", "side", "boss", "tour"],
    squad: ["squad", "player", "matchlab"],
    nets: ["training"],
    desk: ["desk", "ledger", "journal", "report", "ceremony", "wire", "lore", "dossier"]
  };
  // immersive rooms keep the whole stage: no dock over the broadcast
  var DOCK_HIDE = { match: 1, matchday: 1, friendly: 1, welcome: 1, create: 1, scorecard: 1, orders: 1 };

  function curRoute() { return ((location.hash || "#/club").split("?")[0] || "").replace("#/", ""); }

  function ensureDock() {
    try {
      var d = document.getElementById("fo-dock");
      if (!d) {
        d = document.createElement("nav");
        d.id = "fo-dock";
        d.setAttribute("aria-label", "Primary");
        d.innerHTML = DOCK.map(function (t) {
          return "<a data-dock='" + t.k + "' href='" + t.hash + "'>" +
            "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'>" + t.ic + "</svg>" +
            "<span>" + E(t.label) + "</span></a>";
        }).join("");
        document.body.appendChild(d);
        d.addEventListener("click", function (ev) {
          var a = ev.target && ev.target.closest ? ev.target.closest("a[data-dock]") : null;
          if (!a) return;
          ev.preventDefault();
          location.hash = a.getAttribute("href");
          if (typeof window.route === "function") window.route();
        });
      }
      var r = curRoute();
      var tb = document.getElementById("topbar");
      var tbGone = !tb || !tb.offsetParent; // door / theatre hide the topbar; the dock follows
      var hide = tbGone || DOCK_HIDE[r] === 1 || document.body.classList.contains("fo-mnav-lock");
      d.classList.toggle("off", !!hide);
      document.body.classList.toggle("fo-dock-on", !hide);
      var lit = null;
      for (var k in DOCK_MAP) if (DOCK_MAP[k].indexOf(r) !== -1) { lit = k; break; }
      [].slice.call(d.querySelectorAll("a[data-dock]")).forEach(function (a) {
        a.classList.toggle("on", a.getAttribute("data-dock") === lit);
      });
    } catch (e) {}
  }

  // ---- route-change motion ---------------------------------------------------
  // A short fade on every route; opacity only, so fixed-position page art
  // (which lives inside #page) never gets re-parented into a containing block.
  var animOk = true;
  try { animOk = !window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  function pageIn() {
    if (!animOk) return;
    try {
      var p = document.getElementById("page"); if (!p) return;
      p.classList.remove("fo-page-in");
      void p.offsetWidth;
      p.classList.add("fo-page-in");
    } catch (e) {}
  }

  // ---- the match centre where "No match selected" used to be -----------------
  function matchCentre() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/scorecard") return;
      var page = document.getElementById("page"); if (!page) return;
      if (page.textContent.indexOf("No match selected") === -1) return;
      var res = [];
      try { if (typeof App !== "undefined" && App && App.results) res = App.results.slice(-10).reverse(); } catch (eA) {}
      var rows = res.map(function (o) {
        var txt = (o.result && o.result.text) || "";
        var mine = false;
        try { var my = userTeam().name; mine = (o.home === my || o.away === my); } catch (e0) {}
        return "<a class='fo-mc-row" + (mine ? " mine" : "") + "' href='#/report?i=" + o.ix + "'>" +
          "<i>" + E(o.date || "") + "</i>" +
          "<b>" + E(o.home) + " <em>v</em> " + E(o.away) + "</b>" +
          "<span>" + E(txt) + "</span><u>&#8250;</u></a>";
      }).join("");
      page.innerHTML =
        "<div class='fo-mc'>" +
        "<div class='fo-mc-hero'><div class='fo-mc-kick'>Fifty Overs</div>" +
        "<h1>Match Centre</h1>" +
        "<p>Every finished match, written up and scored. Pick one to open the report.</p></div>" +
        (rows ? "<div class='fo-mc-list'>" + rows + "</div>" :
          "<div class='fo-mc-empty'>No cricket yet. The first round writes the first page.</div>") +
        "<div class='fo-mc-foot'><a href='#/club'>&#8592; Club home</a><a href='#/journal'>The journal &#8250;</a></div>" +
        "</div>";
    } catch (e) {}
  }

  // ---- wiring ---------------------------------------------------------------
  function afterRoute() { ensureDock(); matchCentre(); }
  function wireRoute() {
    try {
      if (typeof window.route === "function" && !window.route.__foMs) {
        var r0 = window.route;
        window.route = function () { var out = r0.apply(this, arguments); pageIn(); afterRoute(); return out; };
        window.route.__foMs = 1;
      }
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(afterRoute, 60); });

  // ---- the sheet -------------------------------------------------------------
  var CSS = [
    // == glass topbar ==========================================================
    "#topbar#topbar{position:sticky;top:0;z-index:320;background:rgba(9,14,24,.84) !important;-webkit-backdrop-filter:blur(20px) saturate(1.5);backdrop-filter:blur(20px) saturate(1.5);border-bottom:1px solid rgba(255,255,255,.08) !important;box-shadow:0 10px 34px rgba(2,6,14,.38);padding:5px 12px;gap:4px;align-items:center}",
    "@supports not (backdrop-filter:blur(1px)){#topbar#topbar{background:rgba(9,14,24,.96) !important}}",
    "#topbar#topbar .brand{font:700 13.5px/1 Inter,sans-serif;letter-spacing:.2px;color:#F2F6FC;padding:7px 10px 7px 2px}",
    "#topbar#topbar .fo-brandicon{width:26px;height:26px;border-radius:8px;vertical-align:-8px;margin-right:8px;box-shadow:0 2px 8px rgba(0,0,0,.4)}",
    "#topbar#topbar a{border-radius:999px;padding:7px 13px;font:600 12px/1 Inter,sans-serif;color:rgba(233,238,246,.7);transition:background .15s ease,color .15s ease}",
    "#topbar#topbar a:hover{background:rgba(255,255,255,.08) !important;color:#fff;text-decoration:none}",
    "#topbar#topbar a.on{background:rgba(255,255,255,.13) !important;color:#fff !important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.09) !important;font-weight:700}",
    "#topbar#topbar a.fo-logout{color:rgba(233,238,246,.42)}",
    "#topbar#topbar #fo-clock{border-left:none;color:rgba(233,238,246,.5);font:500 11px/1 Inter,sans-serif;font-variant-numeric:tabular-nums}",
    "#topbar#topbar #fo-top-status{color:rgba(233,238,246,.6)}",
    "#topbar#topbar #fo-top-status span{border-left:1px solid rgba(255,255,255,.1);padding-left:10px}",
    // live pill: quiet glass by default, red only when something is on air
    "#topbar#topbar #fo-mlive{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.06) !important;border:1px solid rgba(255,255,255,.1);color:rgba(233,238,246,.55) !important;font:700 11px/1 Inter,sans-serif;letter-spacing:.4px;padding:6px 12px;border-radius:999px}",
    "#topbar#topbar #fo-mlive .live-dot{width:7px;height:7px;border-radius:50%;background:rgba(233,238,246,.35);display:inline-block}",
    "#topbar#topbar #fo-mlive.on{background:rgba(229,57,53,.18) !important;border-color:rgba(229,57,53,.55);color:#ffd9d4 !important}",
    "#topbar#topbar #fo-mlive.on .live-dot{background:#ff5347;box-shadow:0 0 0 0 rgba(255,83,71,.55);animation:foMsPulse 1.8s infinite}",
    "@keyframes foMsPulse{0%{box-shadow:0 0 0 0 rgba(255,83,71,.55)}70%{box-shadow:0 0 0 7px rgba(255,83,71,0)}100%{box-shadow:0 0 0 0 rgba(255,83,71,0)}}",
    "#topbar#topbar #fo-mnav-btn{background:transparent;border:none;color:#E9EEF6;border-radius:12px;padding:6px;cursor:pointer}",
    "#topbar#topbar #fo-mnav-btn:hover{background:rgba(255,255,255,.08)}",
    // == the drawer, glassed ===================================================
    "#fo-mdrawer#fo-mdrawer .fo-mdp{background:rgba(10,15,26,.92) !important;-webkit-backdrop-filter:blur(26px) saturate(1.4);backdrop-filter:blur(26px) saturate(1.4);border-right:1px solid rgba(255,255,255,.08)}",
    "#fo-mdrawer#fo-mdrawer .fo-mdl{border-radius:12px;margin:2px 8px;font:600 13.5px/1 Inter,sans-serif;color:rgba(233,238,246,.78) !important;border:none !important}",
    "#fo-mdrawer#fo-mdrawer .fo-mdl:hover{background:rgba(255,255,255,.07) !important}",
    "#fo-mdrawer#fo-mdrawer .fo-mdl.on{background:rgba(255,122,80,.16) !important;color:#ffc4ad !important}",
    // == the phone tab dock ====================================================
    "#fo-dock{display:none}",
    "@media(max-width:820px){",
    "#fo-dock{position:fixed;left:12px;right:12px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:340;display:flex;align-items:stretch;background:rgba(9,14,24,.84);-webkit-backdrop-filter:blur(24px) saturate(1.5);backdrop-filter:blur(24px) saturate(1.5);border:1px solid rgba(255,255,255,.1);border-radius:24px;box-shadow:0 18px 44px rgba(2,6,14,.55),inset 0 1px 0 rgba(255,255,255,.06);padding:7px 6px calc(7px + env(safe-area-inset-bottom,0px)*0)}",
    "#fo-dock.off{display:none}",
    "#fo-dock a,body.ftpskin #fo-dock a{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px 0 3px;border-radius:16px;color:rgba(233,238,246,.55) !important;text-decoration:none;transition:color .15s ease,transform .12s ease}",
    "#fo-dock a svg{width:22px;height:22px}",
    "#fo-dock a span{font:600 9.5px/1 Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase}",
    "#fo-dock a:active{transform:scale(.94)}",
    "#fo-dock a.on,body.ftpskin #fo-dock a.on{color:" + ACCENT + " !important}",
    "#fo-dock a.on svg{filter:drop-shadow(0 0 8px rgba(255,122,80,.55))}",
    // room to scroll past the dock
    "body.fo-dock-on #page{padding-bottom:88px}",
    // full-bleed heroes pin a quick-link bar to the viewport floor; the dock
    // covers those destinations, so the old bar retires on phones
    "body.fo-dock-on .fo-home2 .hg-bar{display:none}",
    "}",
    // == motion ================================================================
    "@media (prefers-reduced-motion:no-preference){",
    "#page.fo-page-in{animation:foMsPageIn .22s ease-out}",
    "@keyframes foMsPageIn{from{opacity:.25}to{opacity:1}}",
    "#page button{transition:transform .12s ease,box-shadow .15s ease,background .15s ease,border-color .15s ease}",
    "#page button:not(.coin):not([class*='coin']):active{transform:scale(.97)}",
    "}",
    // == modern focus, selection, scrollbars ==================================
    ":focus-visible{outline:2px solid " + ACCENT + ";outline-offset:2px}",
    "::selection{background:rgba(255,122,80,.32)}",
    "::-webkit-scrollbar{width:10px;height:10px}",
    "::-webkit-scrollbar-thumb{background:rgba(128,138,156,.38);border-radius:8px;border:3px solid transparent;background-clip:content-box}",
    "::-webkit-scrollbar-thumb:hover{background:rgba(128,138,156,.6);border:3px solid transparent;background-clip:content-box}",
    "::-webkit-scrollbar-track{background:transparent}",
    // == the match centre ======================================================
    "html body #page .fo-mc{max-width:760px;margin:26px auto 40px;padding:0 14px}",
    "html body #page .fo-mc-hero{background:linear-gradient(150deg,#0D1626,#12213B 65%,#16304c);border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:30px 30px 26px;color:#E9EEF6;box-shadow:0 24px 60px rgba(7,16,32,.35)}",
    "html body #page .fo-mc-kick{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:rgba(233,238,246,.55)}",
    "html body #page .fo-mc-hero h1{font-family:Oswald,sans-serif;font-weight:600;font-size:34px;letter-spacing:.04em;text-transform:uppercase;margin:6px 0 8px;color:#fff}",
    "html body #page .fo-mc-hero p{font:400 14px/1.55 Georgia,serif;font-style:italic;color:rgba(233,238,246,.72);margin:0;max-width:46ch}",
    "html body #page .fo-mc-list{margin-top:14px;display:flex;flex-direction:column;gap:8px}",
    "html body #page .fo-mc-row{display:grid;grid-template-columns:auto 1fr auto 14px;gap:12px;align-items:baseline;background:rgba(13,22,38,.92);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:13px 16px;color:#E9EEF6;text-decoration:none;transition:border-color .15s ease,transform .12s ease}",
    "html body #page .fo-mc-row:hover{border-color:rgba(255,122,80,.45);transform:translateY(-1px);text-decoration:none}",
    "html body #page .fo-mc-row.mine{border-left:3px solid " + ACCENT + "}",
    "html body #page .fo-mc-row i{font:500 10.5px/1 Inter,sans-serif;color:rgba(233,238,246,.45);font-style:normal;font-variant-numeric:tabular-nums;white-space:nowrap}",
    "html body #page .fo-mc-row b{font:600 13.5px/1.35 Inter,sans-serif;color:#fff;min-width:0}",
    "html body #page .fo-mc-row b em{font-style:normal;color:rgba(233,238,246,.4);font-weight:400;padding:0 2px}",
    "html body #page .fo-mc-row span{font:400 12px/1.35 Georgia,serif;font-style:italic;color:rgba(233,238,246,.6);text-align:right}",
    "html body #page .fo-mc-row u{text-decoration:none;color:rgba(233,238,246,.4)}",
    "html body #page .fo-mc-empty{margin-top:14px;background:rgba(13,22,38,.92);border:1px dashed rgba(255,255,255,.15);border-radius:14px;padding:26px;text-align:center;font:400 13.5px/1.5 Georgia,serif;font-style:italic;color:rgba(233,238,246,.6)}",
    "html body #page .fo-mc-foot{display:flex;justify-content:space-between;margin-top:16px}",
    "html body #page .fo-mc-foot a{font:600 12px/1 Inter,sans-serif;color:rgba(233,238,246,.65);background:rgba(13,22,38,.85);border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:9px 16px;text-decoration:none}",
    "html body #page .fo-mc-foot a:hover{color:#fff;border-color:rgba(255,122,80,.5);text-decoration:none}",
    "@media(max-width:640px){html body #page .fo-mc-hero h1{font-size:27px}html body #page .fo-mc-row{grid-template-columns:1fr 14px}html body #page .fo-mc-row i{order:1}html body #page .fo-mc-row span{text-align:left;order:3}html body #page .fo-mc-row u{order:2}html body #page .fo-mc-row b{order:0}}"
  ].join("\n");

  function mount() {
    try {
      var s = document.getElementById("fo-ms-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-ms-css"; s.textContent = CSS; }
      document.body.appendChild(s);
      wireRoute();
      afterRoute();
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); });
  else setTimeout(mount, 0);
  window.__foModernShell = 1;
})();
