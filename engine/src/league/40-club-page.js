/* ============================================================================
   THE CLUB CARD (#/team?c={country}&s={slot}) — every club's public face.

   What a rival is ALLOWED to know: who they are, where they play, who runs
   them, where they stand - world rank and rating, league position and
   record, recent form, the trophies on their shelf, and the names their
   season has made famous. What stays hidden: the squad and its strengths.
   Scouting is earned at the teamsheet hour, never handed out on a page.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foClubPg) return; window.__foClubPg = 1;

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
  function qs() {
    var q = {}, m = (location.hash || "").split("?")[1] || "";
    m.split("&").forEach(function (kv) { var p = kv.split("="); if (p[0]) q[p[0]] = decodeURIComponent(p[1] || ""); });
    return q;
  }
  function claim() {
    try { return window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (e) { return null; }
  }
  var CLUB_CACHE = {};
  function fetchClub(cid, slot, cb) {
    var k = cid + ":" + slot;
    if (CLUB_CACHE[k]) { cb(CLUB_CACHE[k]); return; }
    fetch(SB_URL + "/rest/v1/world_clubs?country_id=eq." + encodeURIComponent(cid) + "&slot=eq." + slot + "&select=name,ground,is_boss,manager", { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) { var row = rows && rows[0]; if (row) CLUB_CACHE[k] = row; cb(row || null); })
      .catch(function () { cb(null); });
  }
  var HON_CACHE = null;
  function fetchHonours(cb) {
    if (HON_CACHE) { cb(HON_CACHE); return; }
    fetch(SB_URL + "/rest/v1/world_snapshots?key=eq.honours&select=body", { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) { HON_CACHE = (rows && rows[0] && rows[0].body) || { seasons: {} }; cb(HON_CACHE); })
      .catch(function () { cb(null); });
  }

  window.foRenderClubPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    foClubCss();
    try { document.body.classList.remove("fo-ov-on", "fo-boss-on", "fo-scb-on", "fo-drs-on", "fo-wt-on"); } catch (e) {}
    var q = qs(), cid = q.c || "eng", slot = parseInt(q.s || "0", 10) || 0;
    var cl = claim();
    var isMine = !!(cl && cl.country === cid && cl.slot === slot);

    // the pieces arrive as they arrive; the page repaints once each lands
    var lg = null; try { lg = window.__foWorldLg ? window.__foWorldLg.get(cid) : null; } catch (e) {}
    try { if (window.__foWorldLg) window.__foWorldLg.want(cid, function () { if ((location.hash || "").indexOf("#/team") === 0) window.foRenderClubPage(); }); } catch (e) {}
    var rk = null; try { rk = JSON.parse(localStorage.getItem("fo_world_rk") || "null"); } catch (e) {}

    var paint = function (info, hon) {
      var name = (info && info.name) || (lg && (lg.table || []).filter(function (t) { return t.slot === slot; })[0] || {}).name || "A world club";
      var boss = !!(info && info.is_boss);
      var mgr = info && info.manager;
      var rkRow = rk && rk.clubs ? rk.clubs.filter(function (x) { return x.country === cid && x.slot === slot; })[0] : null;
      var tRow = lg && lg.table ? (lg.table.filter(function (t) { return t.slot === slot; })[0] || null) : null;
      var pos = tRow && lg.table ? lg.table.indexOf(tRow) + 1 : 0;
      var ordn = function (n) { return n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4)] || "th"); };
      // recent form from the served results, newest first
      var form = "";
      if (lg && lg.results && name) {
        var mine = lg.results.filter(function (r) { return r.home === name || r.away === name; }).slice(-5).reverse();
        form = mine.map(function (r) {
          var w = r.winner === null ? "T" : r.winner === name ? "W" : "L";
          return "<i class='" + w.toLowerCase() + "'>" + w + "</i>";
        }).join("");
      }
      // the names this season has made famous (public honours, never skills)
      var noted = [];
      if (lg && lg.stats) {
        (lg.stats.bat || []).forEach(function (x) { if (x.club === name && noted.length < 2) noted.push(E(x.name) + " &middot; " + x.runs + " runs"); });
        (lg.stats.bowl || []).forEach(function (x) { if (x.club === name && noted.length < 4) noted.push(E(x.name) + " &middot; " + x.wkts + " wickets"); });
      }
      var shelf = [];
      if (hon && hon.seasons) Object.keys(hon.seasons).sort().forEach(function (sk) {
        var s5 = hon.seasons[sk], sn = sk.slice(1);
        if (s5.league && s5.league[cid] === name) shelf.push("&#127942; League champions &middot; Season " + sn);
        if (s5.championsCup === name) shelf.push("&#127942; CHAMPIONS CUP &middot; Season " + sn);
      });
      var mgrLine = mgr
        ? "<span class='fo-cp-mgr human'>&#9733; Managed by " + E(mgr) + "</span>"
        : boss ? "<span class='fo-cp-mgr'>The league's boss club &mdash; never for hire</span>"
        : "<span class='fo-cp-mgr'>Unmanaged &mdash; a steady club of the shires</span>";
      var statCells =
        "<div class='c'><i>World rank</i><b>" + (rkRow ? "#" + rkRow.rank : "&mdash;") + "</b><u>" + (rkRow ? rkRow.rating + " rating" : "") + "</u></div>" +
        "<div class='c'><i>League</i><b>" + (pos ? ordn(pos) : "&mdash;") + "</b><u>" + (tRow ? tRow.pts + " pts &middot; " + tRow.p + " played" : "") + "</u></div>" +
        "<div class='c'><i>Record</i><b>" + (rkRow ? rkRow.w + "-" + rkRow.l + (rkRow.t ? "-" + rkRow.t : "") : "&mdash;") + "</b><u>all competitions</u></div>";
      page.innerHTML = "<div class='fo-cp'><div class='fo-cp-in'>" +
        "<a class='fo-cp-back' href='#/nation?n=" + encodeURIComponent(cid) + "'>&lsaquo; " + E(natName(cid)) + " league</a>" +
        "<div class='fo-cp-hero'>" +
        "<img class='fo-cp-flag' src='" + flagOf(cid) + "' alt='' onerror=\"this.style.display='none'\">" +
        "<div class='fo-cp-id'><div class='fo-cp-k'>" + E(natName(cid)) + " &middot; the served world" + (boss ? " &middot; BOSS" : "") + (isMine ? " &middot; YOUR CLUB" : "") + "</div>" +
        "<h1>" + E(name) + "</h1>" +
        "<p>" + E((info && info.ground) || "") + "</p>" + mgrLine + "</div></div>" +
        "<div class='fo-cp-stats'>" + statCells + "</div>" +
        (form ? "<div class='fo-cp-card'><h3>Form <span>latest first</span></h3><div class='fo-cp-form'>" + form + "</div></div>" : "") +
        (noted.length ? "<div class='fo-cp-card'><h3>Names the season made</h3>" + noted.map(function (n) { return "<div class='fo-cp-note'>" + n + "</div>"; }).join("") + "</div>" : "") +
        "<div class='fo-cp-card'><h3>The trophy shelf</h3>" +
        (shelf.length ? shelf.map(function (s) { return "<div class='fo-cp-note'>" + s + "</div>"; }).join("")
          : "<div class='fo-cp-note dim'>Bare, for now. Every season writes the next line.</div>") + "</div>" +
        "<div class='fo-cp-card dimc'><h3>The squad</h3><div class='fo-cp-note dim'>Their strengths are their business. Teamsheets go public an hour before every match &mdash; that is your scouting window.</div></div>" +
        (!isMine && cl ? "<a class='fo-cp-cta' href='#/worldclub'>&#9876; Challenge " + E(name) + " to a friendly &rsaquo;</a>" : "") +
        "<div class='fo-cp-foot'><a href='#/rankings'>The world rankings &rsaquo;</a></div>" +
        "</div></div>";
    };
    paint(null, null);
    fetchClub(cid, slot, function (info) {
      fetchHonours(function (hon) { paint(info, hon); });
    });
  };

  function foClubCss() {
    if (document.getElementById("fo-cp-css")) return;
    var s = document.createElement("style"); s.id = "fo-cp-css";
    s.textContent = [
      ".fo-cp{min-height:70vh}",
      ".fo-cp-in{max-width:640px;margin:0 auto;padding:16px 14px 80px}",
      "html body #page .fo-cp-back{display:inline-block;font:600 11px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#B44A22 !important;text-decoration:none !important;margin-bottom:10px}",
      ".fo-cp-hero{display:flex;gap:14px;align-items:flex-start;background:#0E1A2F;border-radius:18px;border-bottom:2px solid #C95532;padding:18px 16px;margin-bottom:12px}",
      ".fo-cp-flag{width:44px;height:30px;object-fit:cover;border-radius:4px;flex:none;margin-top:4px}",
      ".fo-cp-k{font:700 9.5px/1.5 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#E8894A}",
      ".fo-cp-id h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:clamp(26px,6.4vw,34px);color:#FFFEFC;margin:4px 0 2px}",
      ".fo-cp-id p{font:italic 400 12.5px/1.4 'Fraunces',Georgia,serif;color:rgba(255,254,252,.65);margin:0 0 7px}",
      ".fo-cp-mgr{display:inline-block;font:600 10.5px/1.4 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,254,252,.55)}",
      ".fo-cp-mgr.human{color:#F3D37A}",
      ".fo-cp-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px}",
      ".fo-cp-stats .c{background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:14px;padding:11px 12px;text-align:center}",
      ".fo-cp-stats .c i{display:block;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.45);font-style:normal}",
      ".fo-cp-stats .c b{display:block;font:700 20px/1.2 Oswald,sans-serif;color:#141C28;margin-top:4px;font-variant-numeric:tabular-nums}",
      ".fo-cp-stats .c u{display:block;text-decoration:none;font:400 9.5px/1.4 Inter,sans-serif;color:rgba(20,28,40,.5)}",
      ".fo-cp-card{background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:14px;padding:12px 14px;margin-bottom:10px}",
      ".fo-cp-card.dimc{background:rgba(255,254,252,.6)}",
      ".fo-cp-card h3{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:14.5px;color:#141C28;margin:0 0 8px}",
      ".fo-cp-card h3 span{font:600 9px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.4);margin-left:6px}",
      ".fo-cp-form{display:flex;gap:6px}",
      ".fo-cp-form i{font-style:normal;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;font:700 12px/1 Oswald,sans-serif;color:#FFFEFC}",
      ".fo-cp-form i.w{background:#177A57}.fo-cp-form i.l{background:#B23230}.fo-cp-form i.t{background:#8a6d3b}",
      ".fo-cp-note{font:500 12.5px/1.6 Inter,sans-serif;color:#141C28;padding:2px 0}",
      ".fo-cp-note.dim{font-style:italic;font-family:'Fraunces',Georgia,serif;color:rgba(20,28,40,.55)}",
      "html body #page .fo-cp-cta{display:block;text-align:center;font:700 12px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#FFFEFC !important;background:linear-gradient(180deg,#E8894A,#C8542F);border-radius:12px;padding:14px;text-decoration:none !important;box-shadow:0 10px 26px rgba(200,84,47,.3);margin:4px 0 10px}",
      ".fo-cp-foot{text-align:right;padding:2px 4px}",
      "html body #page .fo-cp-foot a{font:600 11px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#B44A22 !important;text-decoration:none !important}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
