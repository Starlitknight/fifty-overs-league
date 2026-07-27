// ---- 25-league-table.js — The League, the real one ---------------------------
// The League page used to open on a painted atlas of fictional sides while the
// fixtures were played against the actual clubs of the save - two worlds that
// never matched, and managers noticed. #/league now shows THE league: the real
// table of the ten clubs you actually play, straight from the engine's own
// standings. The painted nation atlas lives on at #/nation, one link away.
(function () {
  "use strict";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function ready() { return typeof App !== "undefined" && App && typeof GD !== "undefined" && GD && GD.teams && typeof userTeam === "function"; }

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

  function foRenderLeagueTablePage() {
    try {
      if (!ready()) return;
      var page = document.getElementById("page"); if (!page) return;
      var me = null; try { me = userTeam(); } catch (e) {}
      if (!me) return;
      document.body.classList.remove("fo-scb-on", "fo-drs-on");
      var rows = [];
      try { rows = leagueRows(); } catch (eL) {}
      var myPos = 0;
      rows.forEach(function (r, i) { if (r.nm === me.name) myPos = i + 1; });
      var ord = function (n) { return n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"); };
      // the league is played under a nation's flag (chosen at onboarding,
      // England by default) - say so, so nobody has to wonder where they play
      var natNm = "", natId = "";
      try { natNm = (window.__foLgAPI && window.__foLgAPI.regionName && window.__foLgAPI.regionName()) || ""; } catch (eNat) {}
      try { natId = (window.__foLgAPI && window.__foLgAPI.nation && window.__foLgAPI.nation()) || ""; } catch (eNid) {}
      // the painted country atlas (map + league boss) rides below the table
      var atlasCard = "";
      try {
        var artBase = (typeof FO_ART !== "undefined") ? FO_ART :
          ((location.pathname.indexOf("/client/") !== -1) ? "art/" : "client/art/");
        if (natId) {
          atlasCard = "<a class='fo-lt-atl' href='#/atlas'>" +
            "<img src='" + artBase + "circuit/" + natId + ".webp' alt='' loading='lazy' onerror=\"this.style.display='none'\">" +
            "<span class='fo-lt-atlv'></span>" +
            "<span class='fo-lt-atlt'><i>The Grand Tour</i><b>The " + (natNm ? E(natNm) + " " : "") + "Atlas</b>" +
            "<em>The painted map, the league boss, the grounds &rsaquo;</em></span></a>";
        }
      } catch (eAtl) {}

      // THE LEAGUE IS THE WORLD'S LEAGUE. When the World Service has served
      // this nation's table, that is the table - the real ten clubs, their
      // real points - and every row opens onto that club's own page. Absent
      // the service we keep the engine's own standings, and rows still open
      // onto the club's honours board.
      var srvRows = null, claim = null, snapSeason = 0;
      try { claim = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (eC) {}
      try {
        if (natId && window.__foWorldLg) {
          window.__foWorldLg.want(natId, function () {
            if ((location.hash || "").split("?")[0] === "#/league") foRenderLeagueTablePage();
          });
          var snap = window.__foWorldLg.get(natId);
          if (snap && snap.table && snap.table.length) {
            snapSeason = snap.seasonNo || 0;
            srvRows = snap.table.map(function (x) {
              return { nm: x.name, p: x.p, w: x.w, l: x.l, t: x.t, pts: x.pts, nrr: x.nrr, slot: x.slot,
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
              var s5 = (seq[r.nm] || []).slice(-5);
              r.beads = s5.length
                ? s5.map(function (k) { return "<i class='" + k + "'>" + k.toUpperCase() + "</i>"; }).join("")
                : "<span class='none'>&mdash;</span>";
            });
          }
        }
      } catch (eS) {}
      if (srvRows) { rows = srvRows; myPos = 0; rows.forEach(function (r, i) { if (r.mine) myPos = i + 1; }); }

      var body = rows.map(function (r, i) {
        var mine = r.mine != null ? r.mine : (r.nm === me.name);
        var href = (srvRows && r.slot != null)
          ? "#/team?c=" + encodeURIComponent(natId) + "&s=" + r.slot
          : "#/milestones?c=" + encodeURIComponent(r.nm);
        return "<a class='fo-lt-row" + (mine ? " mine" : "") + "' href='" + href + "'>" +
          "<i>" + (i + 1) + "</i>" +
          "<span class='fo-lt-nm'><b>" + E(r.nm) + (mine ? " <u>you</u>" : "") + "</b>" +
          "<span class='fo-lt-beads'>" + (r.beads != null ? r.beads : formBeads(r.nm)) + "</span></span>" +
          "<em>" + (r.p | 0) + "</em><em class='w'>" + (r.w | 0) + "</em><em>" + (r.l | 0) + "</em>" +
          "<em class='nrr'>" + ((r.nrr >= 0 ? "+" : "") + (+r.nrr || 0).toFixed(2)) + "</em>" +
          "<b class='pts'>" + (r.pts | 0) + "</b></a>";
      }).join("");

      page.innerHTML =
        "<div class='fo-lt'>" +
        "<div class='fo-lt-mast'>" +
        "<div class='fo-lt-kick'>" + (natNm ? E(natNm) + " &middot; " : "") + "Season " + ((srvRows && snapSeason) || App.seasonNo || 1) + " &middot; " + E((claim && claim.club) || me.name) + (myPos ? " &middot; " + ord(myPos) : "") + "</div>" +
        "<h1>The " + (natNm ? E(natNm) + " " : "") + "League</h1>" +
        "<p>Ten clubs, eighteen rounds, one pennant. Two points a win, net run rate to break hearts. Every club opens onto its own page.</p>" +
        "</div>" +
        "<div class='fo-lt-head'><i>#</i><span>Club &middot; form</span><em>P</em><em>W</em><em>L</em><em>NRR</em><b>Pts</b></div>" +
        "<div class='fo-lt-list'>" + body + "</div>" +
        atlasCard +
        "<div class='fo-lt-foot'><a href='#/fixtures'>My fixtures &rsaquo;</a><a href='#/records'>The record book &rsaquo;</a><a href='#/planet'>World cricket &rsaquo;</a><a class='atlas' href='#/atlas'>" + (natNm ? "The " + E(natNm) + " atlas" : "The nation atlas") + " &rsaquo;</a></div>" +
        "</div>";
    } catch (e) { try { console.warn("foRenderLeagueTablePage", e); } catch (e2) {} }
  }

  var CSS = [
    "html body #page .fo-lt{max-width:680px;margin:26px auto 44px;padding:0 14px;color:#141C28}",
    "html body #page .fo-lt-mast{background:linear-gradient(150deg,#FFFEFB,#F6F1E4 70%,#F0E9D6) !important;border:1px solid rgba(20,28,40,.1);border-radius:22px;padding:26px 28px 22px;box-shadow:0 22px 50px rgba(30,38,52,.12)}",
    "html body #page .fo-lt-kick{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:#B44A22}",
    "html body #page .fo-lt-kick:after{content:'';display:block;width:34px;border-top:2px solid #C95532;margin-top:7px}",
    "html body #page .fo-lt-mast h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:38px;letter-spacing:-.015em;margin:8px 0 8px;color:#141C28;line-height:1.02}",
    "html body #page .fo-lt-mast p{font:italic 420 13.5px/1.6 'Fraunces',Georgia,serif;color:rgba(20,28,40,.6);margin:0;max-width:52ch}",
    "html body #page .fo-lt-head{display:grid;grid-template-columns:24px minmax(0,1fr) 28px 28px 28px 52px 34px;gap:8px;align-items:baseline;padding:14px 16px 6px;font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.45)}",
    "html body #page .fo-lt-head em,html body #page .fo-lt-head b{text-align:right;font-style:normal}",
    "html body #page .fo-lt-list{display:flex;flex-direction:column;gap:6px}",
    "html body #page .fo-lt-row{display:grid;grid-template-columns:24px minmax(0,1fr) 28px 28px 28px 52px 34px;gap:8px;align-items:center;background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:13px;padding:10px 16px;text-decoration:none;color:#141C28;box-shadow:0 4px 14px rgba(30,38,52,.06);transition:border-color .15s ease,transform .12s ease}",
    "html body #page .fo-lt-row:hover{border-color:rgba(217,85,42,.5);transform:translateY(-1px);text-decoration:none}",
    "html body #page .fo-lt-row.mine{border-left:3px solid #C95532}",
    "html body #page .fo-lt-row>i{font:700 12px/1 Inter,sans-serif;color:rgba(20,28,40,.45);font-style:normal;font-variant-numeric:tabular-nums}",
    "html body #page .fo-lt-nm{min-width:0}",
    "html body #page .fo-lt-nm b{display:block;font:600 13.5px/1.25 Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "html body #page .fo-lt-nm b u{text-decoration:none;font:700 8.5px/1 Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#B44A22;margin-left:5px;vertical-align:1px}",
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
    "html body #page .fo-lt-atl{position:relative;display:block;margin-top:16px;border-radius:18px;overflow:hidden;min-height:120px;border:1px solid rgba(20,28,40,.16);box-shadow:0 16px 38px rgba(30,38,52,.16);text-decoration:none}",
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
  window.__foLeagueTable = 1;
})();
