/* ============================================================================
   THE WORLD RANKINGS (#/rankings) — the ladder every club on earth stands on.

   Rolling Elo over every banked match, computed by the World Service and
   served as one snapshot: 190 clubs on one ladder (league matches move 24
   points' worth, Champions Cup ties 40), and a country ladder beside it -
   each nation's league strength (average club rating) with its national
   XI's own World Cup rating. Your claimed club is picked out wherever it
   stands. Before the first ball, every club on earth sits on 1000 - the
   ladder first moves the night the world plays.
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
  try { var c0 = localStorage.getItem("fo_world_rk"); if (c0) RK = JSON.parse(c0); } catch (e) {}
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

  function A() { return window.AL || null; }
  function onRk() { return (location.hash || "").split("?")[0] === "#/rankings"; }

  // PHASE 4 OF THE ALMANACK. A ladder is a table, and the shell has one. The
  // flags stay - a world ranking without them reads as a spreadsheet - but the
  // dark hero and the rounded cards are gone, and a manager's own club is
  // marked exactly the way it is marked in the league table.
  window.foRenderRankingsPage = function () {
    if (!onRk()) return;
    var page = document.getElementById("page"); if (!page) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e) {}
    fetchRk();

    var cl = claim();
    var body = al.mast("World cricket · the ladder", "The World Rankings",
      "Rolling ratings over every match the umpire has ever banked. League wins move the needle; " +
      "Champions Cup nights move it harder.");
    body += al.subnav("rankings");

    if (!RK || !RK.clubs || !RK.clubs.length) {
      page.innerHTML = al.page({ body: body + al.empty("Reaching the World Service",
        "Every club on earth starts on 1000. The ladder first moves the night the world plays.") });
      return;
    }

    var mine = cl ? RK.clubs.filter(function (c) { return c.country === cl.country && c.slot === cl.slot; })[0] : null;
    var moved = RK.clubs.some(function (c) { return c.p > 0; });

    body += al.decide({
      kind: mine ? "" : "",
      title: mine
        ? mine.name + " stand " + mine.rank + " of " + RK.clubs.length + " in the world"
        : RK.clubs[0].name + " lead the world",
      note: mine ? "rating " + mine.rating + " · " + mine.w + "-" + mine.l + (mine.t ? "-" + mine.t : "")
                 : (moved ? "rating " + RK.clubs[0].rating : "Every club on earth stands level on 1000 until the world plays."),
    });

    function clubRow(c) {
      var isMine = !!(cl && c.country === cl.country && c.slot === cl.slot);
      return "<tr" + (isMine ? " class='al-you'" : "") + ">" +
        "<td class='al-pos'>" + c.rank + "</td>" +
        "<td class='l al-club'><img class='al-flag' src='" + flagOf(c.country) + "' alt='' " +
          "onerror=\"this.style.display='none'\">" + E(c.name) +
          (isMine ? "<span class='al-you__tag'>YOU</span>" : (c.boss ? "<span class='al-you__tag'>FLAGSHIP</span>" : "")) + "</td>" +
        "<td class='l al-s'>" + E(natName(c.country)) + "</td>" +
        "<td class='al-s'>" + c.w + "-" + c.l + (c.t ? "-" + c.t : "") + "</td>" +
        "<td class='al-pts'>" + c.rating + "</td></tr>";
    }
    var rows = RK.clubs.slice(0, 30).map(clubRow).join("");
    if (mine && mine.rank > 30) rows += "<tr><td colspan='5' class='l al-s'>…</td></tr>" + clubRow(mine);

    body += al.sec("The club ladder · top 30 of " + RK.clubs.length,
      "<div class='al-tblwrap'><table class='al-tbl'><thead><tr><th></th><th class='l'>Club</th>" +
      "<th class='l al-s'>Nation</th><th class='al-s'>W-L</th><th>Rating</th></tr></thead><tbody>" +
      rows + "</tbody></table></div>" +
      (moved ? "" : '<p class="al-read">Every club on earth stands level on 1000. The ladder first moves the ' +
        "night the world plays its opening round.</p>"));

    body += al.sec("The nations · league strength and national XI",
      "<div class='al-tblwrap'><table class='al-tbl'><thead><tr><th></th><th class='l'>Nation</th>" +
      "<th class='al-s'>XI</th><th>Clubs</th></tr></thead><tbody>" +
      (RK.countries || []).map(function (n) {
        var isMineN = !!(cl && cl.country === n.id);
        return "<tr" + (isMineN ? " class='al-you'" : "") + "><td class='al-pos'>" + n.rank + "</td>" +
          "<td class='l al-club'><img class='al-flag' src='" + flagOf(n.id) + "' alt='' " +
            "onerror=\"this.style.display='none'\">" + E(n.name) +
            (isMineN ? "<span class='al-you__tag'>YOU</span>" : "") + "</td>" +
          "<td class='al-s'>" + n.natRating + (n.natP ? "" : "*") + "</td>" +
          "<td class='al-pts'>" + n.clubRating + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="al-read">A starred national rating is unproven — that side has not played enough yet.</p>');

    page.innerHTML = al.page({ body: body });
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
      ".fo-rk-row b{font:600 13px/1.25 Inter,sans-serif;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".fo-rk-row b em{font-style:normal;font:700 8px/1 Oswald,sans-serif;letter-spacing:.12em;color:#C8542F;border:1px solid rgba(200,84,47,.45);border-radius:999px;padding:2px 6px;vertical-align:1px}",
      ".fo-rk-row b em.bs{color:#8a6d3b;border-color:rgba(138,109,59,.4)}",
      ".fo-rk-row u{text-decoration:none;font:400 10.5px/1 Inter,sans-serif;color:rgba(20,28,40,.45);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}",
      ".fo-rk-row .rec{font:500 10.5px/1 Inter,sans-serif;color:rgba(20,28,40,.45);flex:none;font-variant-numeric:tabular-nums}",
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
