// ---- 24-fixture-list.js — The Fixture List -----------------------------------
// The season, laid out like the card on the pavilion noticeboard: every match
// already played (each one a door to its report) and every match still to
// come, with venue, forecast pitch and weather - all read from the shared
// season state, so every client prints the identical card.
(function () {
  "use strict";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function ready() { return typeof App !== "undefined" && App && typeof GD !== "undefined" && GD && GD.teams && typeof userTeam === "function"; }
  var PITCH_NM = { balanced: "True", flat: "Flat", green: "Green", dry: "Dry", slow: "Slow", cracked: "Cracked", twoPaced: "Two-paced" };

  function foRenderFixturesPage() {
    try {
      if (!ready()) return;
      var page = document.getElementById("page"); if (!page) return;
      var me = null; try { me = userTeam(); } catch (e) {}
      if (!me) return;
      document.body.classList.remove("fo-scb-on", "fo-drs-on");
      try { if (typeof seasonInit === "function") seasonInit(); } catch (eS) {}
      var S = App.season;
      var my = me.name;

      // ---- what has been played ----
      var played = (App.results || []).filter(function (r) {
        return r && r.comp === "league" && r.result && (r.home === my || r.away === my) && r.seasonNo === (App.seasonNo || 1);
      }).sort(function (a, b) { return (a.round || 0) - (b.round || 0); });
      var w = 0, l = 0, t = 0;
      played.forEach(function (r) {
        if (!r.result || r.result.winner === undefined) return;
        if (r.result.winner === my) w++; else if (r.result.winner === null) t++; else l++;
      });
      var resRows = played.map(function (r) {
        var homeGame = r.home === my;
        var opp = homeGame ? r.away : r.home;
        var won = r.result.winner === my, tie = r.result.winner === null;
        var live = /LIVE/.test(r.result.text || "") || r.result.winner === undefined;
        return "<a class='fo-fl-row' href='#/report?i=" + r.ix + "'>" +
          "<i>R" + ((r.round | 0) + 1) + "</i>" +
          "<u class='" + (live ? "lv" : won ? "w" : tie ? "t" : "l") + "'>" + (live ? "&#9679;" : won ? "W" : tie ? "T" : "L") + "</u>" +
          "<span class='fo-fl-who'><b>" + (homeGame ? "v " : "at ") + E(opp) + "</b>" +
          "<span>" + E(r.ground || "") + "</span></span>" +
          "<em>" + E((r.result.text || "").replace(/\s*\(.*\)$/, "")) + "</em><s>&#8250;</s></a>";
      }).join("");

      // ---- what is still to come ----
      var upRows = "";
      if (S && S.schedule) {
        var ups = [];
        for (var r2 = S.round; r2 < S.schedule.length; r2++) {
          (S.schedule[r2] || []).forEach(function (f) {
            if (f[0] !== App.teamIx && f[1] !== App.teamIx) return;
            try { if (S.played && S.played[fixtureKey(r2, f)] !== undefined) return; } catch (eK) {}
            var home = GD.teams[f[0]], away = GD.teams[f[1]];
            ups.push({
              r: r2, isHome: f[0] === App.teamIx,
              opp: f[0] === App.teamIx ? away : home,
              ground: home.ground,
              pitch: (typeof groundPitch === "function") ? groundPitch(home.ground) : "",
              wx: (typeof WXLIST !== "undefined") ? WXLIST[(r2 * 7 + f[0] * 3) % WXLIST.length] : ""
            });
          });
        }
        upRows = ups.map(function (u, i) {
          return "<div class='fo-fl-row up" + (i === 0 ? " next" : "") + "'>" +
            "<i>R" + (u.r + 1) + "</i>" +
            "<u class='n'>" + (u.isHome ? "H" : "A") + "</u>" +
            "<span class='fo-fl-who'><b>" + (u.isHome ? "v " : "at ") + E(u.opp.name) + "</b>" +
            "<span>" + E(u.ground) + " &middot; " + E(PITCH_NM[u.pitch] || u.pitch) + " pitch &middot; " + E(u.wx) + "</span></span>" +
            (i === 0 ? "<a class='fo-fl-act' href='#/dossier'>Dossier &rsaquo;</a>" : "<em></em>") +
            "</div>";
        }).join("");
        if (!ups.length) upRows = "<div class='fo-fl-none'>The season is played out. Awards night awaits.</div>";
      }

      page.innerHTML =
        "<div class='fo-fl'>" +
        "<div class='fo-fl-mast'>" +
        "<div class='fo-fl-kick'>" + E(my) + " &middot; season " + (App.seasonNo || 1) + "</div>" +
        "<h1>The Fixture List</h1>" +
        "<p>Every match of the summer on one card - the played ones open their reports, the coming ones show the ground, the square and the sky.</p>" +
        "<div class='fo-fl-rec'><b>" + w + "</b> won" + (t ? " &middot; <b>" + t + "</b> tied" : "") + " &middot; <b>" + l + "</b> lost &middot; <b>" + (played.length) + "</b> of " + (S && S.schedule ? S.schedule.length : 18) + " played</div>" +
        "</div>" +
        (resRows ? "<div class='fo-fl-k'>Results</div><div class='fo-fl-list'>" + resRows + "</div>" : "") +
        "<div class='fo-fl-k'>Still to play</div><div class='fo-fl-list'>" + upRows + "</div>" +
        "<div class='fo-fl-foot'><a href='#/home'>&#8592; The club</a><a href='#/scorecard'>Match centre &rsaquo;</a><a href='#/cup'>The cup &rsaquo;</a></div>" +
        "</div>";
    } catch (e) { try { console.warn("foRenderFixturesPage", e); } catch (e2) {} }
  }

  // a Fixtures pill in the masthead, beside League where a coach would look
  function ensureNavLink() {
    try {
      var wrap = document.querySelector("#topbar .fo-nav-scroll"); if (!wrap) return;
      var a = wrap.querySelector("a.fo-fixtures");
      if (!a) {
        a = document.createElement("a"); a.className = "fo-fixtures"; a.href = "#/fixtures"; a.textContent = "Fixtures";
        a.addEventListener("click", function (ev) { ev.preventDefault(); location.hash = "#/fixtures"; if (typeof window.route === "function") window.route(); });
        var lg = wrap.querySelector("a.fo-lg-nav") || wrap.querySelector("a[data-nav='squad']");
        if (lg && lg.nextSibling) wrap.insertBefore(a, lg.nextSibling); else wrap.appendChild(a);
      }
      a.classList.toggle("on", (location.hash || "").split("?")[0] === "#/fixtures");
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(ensureNavLink, 90); });

  var CSS = [
    "html body #page .fo-fl{max-width:720px;margin:26px auto 44px;padding:0 14px;color:#141C28}",
    "html body #page .fo-fl-mast{background:linear-gradient(150deg,#FFFEFB,#F6F1E4 70%,#F0E9D6) !important;border:1px solid rgba(20,28,40,.1);border-radius:22px;padding:26px 28px 22px;box-shadow:0 22px 50px rgba(30,38,52,.12)}",
    "html body #page .fo-fl-kick{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:#B44A22}",
    "html body #page .fo-fl-kick:after{content:'';display:block;width:34px;border-top:2px solid #C95532;margin-top:7px}",
    "html body #page .fo-fl-mast h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:38px;letter-spacing:-.015em;margin:8px 0 8px;color:#141C28;line-height:1.02}",
    "html body #page .fo-fl-mast p{font:italic 420 13.5px/1.6 'Fraunces',Georgia,serif;color:rgba(20,28,40,.6);margin:0;max-width:56ch}",
    "html body #page .fo-fl-rec{margin-top:12px;font:500 12px/1 Inter,sans-serif;color:rgba(20,28,40,.7);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;display:inline-block;padding:9px 15px}",
    "html body #page .fo-fl-rec b{color:#141C28}",
    "html body #page .fo-fl-k{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:#B44A22;margin:20px 2px 8px}",
    "html body #page .fo-fl-k:after{content:'';display:block;width:34px;border-top:2px solid #C95532;margin-top:6px}",
    "html body #page .fo-fl-list{display:flex;flex-direction:column;gap:7px}",
    "html body #page .fo-fl-row{display:grid;grid-template-columns:34px 26px minmax(0,1fr) auto 12px;gap:10px;align-items:center;background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:14px;padding:10px 14px;text-decoration:none;color:#141C28;box-shadow:0 4px 14px rgba(30,38,52,.06);transition:border-color .15s ease,transform .12s ease}",
    "html body #page a.fo-fl-row:hover{border-color:rgba(217,85,42,.5);transform:translateY(-1px);text-decoration:none}",
    "html body #page .fo-fl-row.up{grid-template-columns:34px 26px minmax(0,1fr) auto}",
    "html body #page .fo-fl-row.next{border-color:rgba(201,85,50,.55);box-shadow:0 6px 18px rgba(201,85,50,.14)}",
    "html body #page .fo-fl-row i{font:700 11px/1 Inter,sans-serif;color:rgba(20,28,40,.45);font-style:normal;font-variant-numeric:tabular-nums}",
    "html body #page .fo-fl-row u{width:24px;height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font:800 11px/1 Inter,sans-serif;text-decoration:none}",
    "html body #page .fo-fl-row u.w{background:rgba(31,158,114,.14);color:#177A57;border:1px solid rgba(31,158,114,.4)}",
    "html body #page .fo-fl-row u.l{background:rgba(200,60,58,.1);color:#B23230;border:1px solid rgba(200,60,58,.35)}",
    "html body #page .fo-fl-row u.t{background:rgba(20,28,40,.07);color:rgba(20,28,40,.6);border:1px solid rgba(20,28,40,.2)}",
    "html body #page .fo-fl-row u.lv{background:rgba(229,57,53,.1);color:#C22823;border:1px solid rgba(229,57,53,.4);font-size:8px}",
    "html body #page .fo-fl-row u.n{background:rgba(20,28,40,.05);color:rgba(20,28,40,.55);border:1px solid rgba(20,28,40,.15)}",
    "html body #page .fo-fl-who{min-width:0}",
    "html body #page .fo-fl-who b{display:block;font:600 13.5px/1.25 Inter,sans-serif;color:#141C28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "html body #page .fo-fl-who>span{display:block;font:400 11px/1.35 Inter,sans-serif;color:rgba(20,28,40,.5);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "html body #page .fo-fl-row em{font:italic 400 12px/1.35 Georgia,serif;color:rgba(20,28,40,.6);text-align:right;white-space:nowrap}",
    "html body #page .fo-fl-row s{text-decoration:none;color:rgba(20,28,40,.35)}",
    "html body #page .fo-fl-act{font:700 11px/1 Inter,sans-serif;color:#FFFEFC;background:#C95532;border-radius:999px;padding:8px 13px;text-decoration:none;white-space:nowrap}",
    "html body #page .fo-fl-act:hover{background:#A64426;color:#FFFEFC;text-decoration:none}",
    "html body #page .fo-fl-none{background:#FFFEFC;border:1px dashed rgba(20,28,40,.2);border-radius:14px;padding:22px;text-align:center;font:italic 400 13px/1.5 Georgia,serif;color:rgba(20,28,40,.55)}",
    "html body #page .fo-fl-foot{display:flex;gap:10px;justify-content:space-between;margin-top:18px;flex-wrap:wrap}",
    "html body #page .fo-fl-foot a{font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
    "html body #page .fo-fl-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5);text-decoration:none}",
    "@media(max-width:520px){html body #page .fo-fl-mast h1{font-size:30px}html body #page .fo-fl-row em{display:none}html body #page .fo-fl-row{grid-template-columns:30px 24px minmax(0,1fr) 12px}html body #page .fo-fl-row.up{grid-template-columns:30px 24px minmax(0,1fr) auto}}"
  ].join("\n");

  function mount() {
    try {
      var s = document.getElementById("fo-fl-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-fl-css"; s.textContent = CSS; }
      document.body.appendChild(s);
      ensureNavLink();
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); });
  else setTimeout(mount, 0);

  window.foRenderFixturesPage = foRenderFixturesPage;
  window.__foFixtureList = 1;
})();
