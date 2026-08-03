/* ============================================================================
   THE WORLD RANKINGS (#/rankings) — the ladder every club on earth stands on.

   Every match in Fifty Overs is already marked at stumps - the Match ratings
   tab on any scorecard: six units a side against real-ODI par, on the club
   rating scale. That is the rating this page ranks on. A club's place in the
   world is the mean of its LAST THREE match ratings, so this is a ladder of how
   sides are playing now, and a club that goes off the boil slides down it
   within a fortnight.

   Computed by the World Service from the banked cards and served as one
   snapshot: 190 clubs on one ladder, and a country ladder beside it. Your
   claimed club is picked out wherever it stands. A side that has not played
   three matches yet is presumed ordinary - 3,500, the middle of the scale - for
   the ones it is missing.

   TWO LENSES, AND THE PAGE SAYS WHICH IS WHICH. The club ladder is FORM: the
   last three, because that is what a manager wants to know before Saturday.
   The nations table is STRENGTH: every mark a nation's clubs have ever earned,
   because ten clubs' form averages back to the middle of the scale and would
   say nothing about whether one league is harder than another.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foRk) return; window.__foRk = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function cx() { return window.__foCxAPI || null; }
  function flagOf(rid) {
    var base = (typeof FO_ART !== "undefined") ? FO_ART : "client/art/";
    try { return base + "flags/" + cx().flagFile(rid) + ".svg"; } catch (e) { return ""; }
  }
  function natName(rid) {
    try { var r = (cx().regions() || []).filter(function (x) { return x.id === rid; })[0]; return (r && r.nm) || rid; } catch (e) { return rid; }
  }
  function claim() {
    try { return window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (e) { return null; }
  }

  var RK = null, RK_TS = null, BUSY = false;
  // A ladder cached before the rankings became match ratings is an Elo body -
  // no marks behind the figure - and would paint a rating that means nothing on
  // this page for a second before the fetch landed. A body that cannot name its
  // window is from that era; drop it and wait for the world.
  try {
    var c0 = localStorage.getItem("fo_world_rk");
    if (c0) { var b0 = JSON.parse(c0); if (b0 && b0.window) RK = b0; else localStorage.removeItem("fo_world_rk"); }
  } catch (e) {}
  function fetchRk() {
    if (BUSY) return;
    BUSY = true;
    var done = function () { BUSY = false; };
    try {
      var q = "/rest/v1/world_snapshots?key=eq.rankings";
      fetch(SB_URL + q + "&select=updated_at", { headers: { apikey: SB_ANON } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (rows) {
          var ts = rows && rows[0] && rows[0].updated_at;
          if (!ts || ts === RK_TS) { done(); return; }
          RK_TS = ts;
          fetch(SB_URL + q + "&select=body", { headers: { apikey: SB_ANON } })
            .then(function (r2) { return r2.ok ? r2.json() : null; })
            .then(function (rows2) {
              var body = rows2 && rows2[0] && rows2[0].body;
              if (body && body.clubs) {
                RK = body;
                try { localStorage.setItem("fo_world_rk", JSON.stringify(body)); } catch (e) {}
                if ((location.hash || "").split("?")[0] === "#/rankings") window.foRenderRankingsPage();
              }
              done();
            }, done);
        }, done).catch(done);
    } catch (e) { done(); }
  }

  window.foRenderRankingsPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    foRkCss();
    try { document.body.classList.remove("fo-ov-on", "fo-boss-on", "fo-scb-on", "fo-drs-on", "fo-wt-on"); } catch (e) {}
    fetchRk();
    var cl = claim();
    var body;
    if (!RK || !RK.clubs || !RK.clubs.length) {
      body = "<div class='fo-rk-card'><p class='fo-rk-note'>Reaching the World Service for the ladder&hellip;</p></div>";
    } else {
      var moved = RK.clubs.some(function (c) { return c.p > 0; });
      var mine = cl ? RK.clubs.filter(function (c) { return c.country === cl.country && c.slot === cl.slot; })[0] : null;
      // four digits on the club rating scale, the way every other rating in the
      // game is printed - a decimal place on a figure this size is noise
      var fmt = function (v) { return Math.round(Number(v) || 0).toLocaleString(); };
      // the three marks behind the figure, oldest first, so a side on the way
      // up and a side on the way down are told apart at a glance
      var formOf = function (c) {
        var f = c.form || [];
        if (!f.length) return "<span class='frm none'>no cricket yet</span>";
        return "<span class='frm'>" + f.map(function (v) {
          var n = Number(v);
          return "<em class='" + (n >= 3900 ? "g" : n >= 3200 ? "m" : "b") + "'>" + fmt(n) + "</em>";
        }).join("") + "</span>";
      };
      var mineChip = mine
        ? "<div class='fo-rk-mine'>&#127942; <b>" + E(mine.name) + "</b> stand <u>#" + mine.rank + "</u> of " + RK.clubs.length + " in the world &middot; rated " + fmt(mine.rating) +
          ((mine.form && mine.form.length) ? " from " + mine.form.map(fmt).join(", ") : " &mdash; no cricket played yet") + "</div>"
        : "";
      var rowOf = function (c) {
        var isMine = !!(cl && c.country === cl.country && c.slot === cl.slot);
        return "<a class='fo-rk-row" + (isMine ? " mine" : "") + (c.boss ? " boss" : "") + "' href='#/team?c=" + encodeURIComponent(c.country) + "&s=" + c.slot + "'>" +
          "<i>" + c.rank + "</i>" +
          "<img src='" + flagOf(c.country) + "' alt='' onerror=\"this.style.display='none'\">" +
          "<b>" + E(c.name) + (isMine ? " <em>YOU</em>" : (c.boss ? " <em class='bs'>FLAGSHIP</em>" : "")) + "</b>" +
          "<u>" + E(natName(c.country)) + "</u>" +
          formOf(c) +
          "<span class='rec'>" + c.w + "-" + c.l + (c.t ? "-" + c.t : "") + "</span>" +
          "<span class='pts'>" + fmt(c.rating) + "</span></a>";
      };
      var top = RK.clubs.slice(0, 30).map(rowOf).join("");
      var mineExtra = (mine && mine.rank > 30)
        ? "<div class='fo-rk-gap'>&middot;&middot;&middot;</div>" + rowOf(mine)
        : "";
      var natRows = (RK.countries || []).map(function (n) {
        var isMineN = !!(cl && cl.country === n.id);
        var lg = ""; try { lg = window.foNatLogo ? window.foNatLogo(n.id) : ""; } catch (eLg) {}
        return "<a class='fo-rk-row nat" + (isMineN ? " mine" : "") + "' href='#/nation?n=" + encodeURIComponent(n.id) + "'>" +
          "<i>" + n.rank + "</i>" +
          "<img" + (lg ? " class='natlogo'" : "") + " src='" + (lg || flagOf(n.id)) + "' alt='' onerror=\"this.style.display='none'\">" +
          "<b>" + E(n.name) + "</b>" +
          "<u>XI " + fmt(n.natRating) + (n.natP ? "" : " &middot; unproven") + "</u>" +
          "<span class='pts'>" + fmt(n.clubRating) + "</span></a>";
      }).join("");
      body = mineChip +
        (moved ? "" : "<div class='fo-rk-card'><p class='fo-rk-note'>Every club on earth stands level on <b>3,500</b>. The ladder first moves the night the world plays its opening round.</p></div>") +
        "<div class='fo-rk-card'><h3>The club ladder <span>top 30 of " + RK.clubs.length + " &middot; last three match ratings</span></h3>" + top + mineExtra + "</div>" +
        "<div class='fo-rk-card'><h3>The nations <span>league strength &middot; national XI</span></h3>" +
        natRows + "</div>";
    }
    page.innerHTML = "<div class='fo-rk'><div class='fo-rk-in'>" +
      "<div class='fo-rk-hero'><div class='fo-rk-k'>World cricket &middot; the ladder</div>" +
      "<h1>The World Rankings</h1>" +
      "</div>" +
      body +
      "<div class='fo-rk-foot'><a href='#/planet'>&lsaquo; World cricket</a><a href='#/almanack'>The world almanack &rsaquo;</a></div>" +
      "</div></div>";
  };

  function foRkCss() {
    if (document.getElementById("fo-rk-css")) return;
    var s = document.createElement("style"); s.id = "fo-rk-css";
    s.textContent = [
      ".fo-rk{min-height:70vh}",
      ".fo-rk-in{max-width:680px;margin:0 auto;padding:18px 14px 80px}",
      ".fo-rk-hero{background:#0E1A2F;border-radius:18px;padding:20px 18px;margin-bottom:14px;border-bottom:2px solid #C95532}",
      ".fo-rk-k{font:700 10px/1 Oswald,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#E8894A}",
      ".fo-rk-hero h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:clamp(30px,7vw,40px);color:#FFFEFC;margin:6px 0 6px}",
      ".fo-rk-hero p{font:italic 400 13.5px/1.55 'Fraunces',Georgia,serif;color:rgba(255,254,252,.72);max-width:34em;margin:0}",
      ".fo-rk-mine{background:#FFFEFC;border:1px solid rgba(217,85,42,.4);border-left:3px solid #C8542F;border-radius:14px;padding:13px 15px;margin-bottom:12px;font:500 13.5px/1.5 Inter,sans-serif;color:#141C28}",
      ".fo-rk-mine u{text-decoration:none;font-family:Oswald,sans-serif;font-weight:700;color:#B44A22}",
      ".fo-rk-card{background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:16px;padding:14px 14px 10px;margin-bottom:14px;box-shadow:0 6px 18px rgba(30,38,52,.06)}",
      ".fo-rk-card h3{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:16px;color:#141C28;margin:0 0 10px}",
      ".fo-rk-card h3 span{display:block;font:600 9.5px/1.6 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.45)}",
      ".fo-rk-note{font:italic 400 13px/1.6 'Fraunces',Georgia,serif;color:rgba(20,28,40,.6);margin:2px 0 6px}",
      "html body #page .fo-rk-row{display:flex;align-items:center;gap:9px;padding:8px 6px;border-top:1px solid rgba(20,28,40,.07);text-decoration:none !important;color:#141C28 !important}",
      ".fo-rk-row:first-of-type{border-top:none}",
      ".fo-rk-row i{font:700 11px/1 Oswald,sans-serif;font-style:normal;color:rgba(20,28,40,.4);width:24px;text-align:right;flex:none}",
      ".fo-rk-row img{width:22px;height:15px;object-fit:cover;border-radius:2px;flex:none}",
      ".fo-rk-row img.natlogo{width:22px;height:20px;object-fit:contain;border-radius:0}",
      ".fo-rk-row b{font:600 13px/1.25 Inter,sans-serif;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".fo-rk-row b em{font-style:normal;font:700 8px/1 Oswald,sans-serif;letter-spacing:.12em;color:#C8542F;border:1px solid rgba(200,84,47,.45);border-radius:999px;padding:2px 6px;vertical-align:1px}",
      ".fo-rk-row b em.bs{color:#8a6d3b;border-color:rgba(138,109,59,.4)}",
      ".fo-rk-row u{text-decoration:none;font:400 10.5px/1 Inter,sans-serif;color:rgba(20,28,40,.45);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}",
      ".fo-rk-row .rec{font:500 10.5px/1 Inter,sans-serif;color:rgba(20,28,40,.45);flex:none;font-variant-numeric:tabular-nums}",
      // the three marks behind the figure - oldest on the left, as a scorebook reads
      "html body #page .fo-rk-row .frm{display:flex;gap:3px;flex:none}",
      "html body #page .fo-rk-row .frm em{font:600 9.5px/1 Oswald,sans-serif;font-style:normal;font-variant-numeric:tabular-nums;border-radius:4px;padding:3px 4px;min-width:26px;text-align:center;background:rgba(20,28,40,.06);color:rgba(20,28,40,.55)}",
      "html body #page .fo-rk-row .frm em.g{background:rgba(22,140,99,.14);color:#12684A}",
      "html body #page .fo-rk-row .frm em.b{background:rgba(176,58,42,.12);color:#9C3324}",
      "html body #page .fo-rk-row .frm.none{font:italic 400 10px/1 'Fraunces',Georgia,serif;color:rgba(20,28,40,.35);display:block}",
      // A phone has room for the club's NAME or for its whole record, not both -
      // four figures on the club scale are wide. The name wins, the won-lost is on
      // the club's own page, and the form drops to the last two marks: anything
      // that is not one of the final two goes, so a club with a single mark keeps it.
      "@media(max-width:620px){" +
        "html body #page .fo-rk-row u{display:none}" +
        "html body #page .fo-rk-row .rec{display:none}" +
        "html body #page .fo-rk-row .frm em:not(:nth-last-child(-n+2)){display:none}" +
        "html body #page .fo-rk-row .frm em{min-width:0;padding:3px 4px;font-size:9px}" +
        "html body #page .fo-rk-row .pts{width:38px;font-size:13px}" +
      "}",
      ".fo-rk-row .pts{font:700 14px/1 Oswald,sans-serif;color:#141C28;width:44px;text-align:right;flex:none;font-variant-numeric:tabular-nums}",
      ".fo-rk-row.mine{background:rgba(217,85,42,.07);border-radius:10px}",
      ".fo-rk-row.mine .pts{color:#B44A22}",
      ".fo-rk-gap{text-align:center;color:rgba(20,28,40,.35);font:700 12px/1 Oswald,sans-serif;padding:4px 0}",
      ".fo-rk-foot{display:flex;justify-content:space-between;padding:4px 6px}",
      "html body #page .fo-rk-foot a{display:inline-flex;align-items:center;min-height:44px;padding:0 13px;margin:0 -13px;border-radius:12px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#B44A22 !important;text-decoration:none !important}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
