// ---- 54-colts-cup.js — THE COLTS CUP PAGE (#/colts) -------------------------
// Week four of the season belongs to the academies: the league stands down and
// all sixteen clubs of a nation go into one hat, both divisions together, so a
// Division Two academy can knock out the champions. Four days - the last
// sixteen on the Monday, quarters Tuesday, semis Thursday, the final Friday -
// and a club that cannot name fifteen men under twenty-one forfeits its tie in
// public. docs/ACADEMY.md is the law.
//
// This page draws the bracket AS BANKED, from the colts/<nation> snapshot the
// umpire derives from cup_matches. It is a sibling of the FA Cup page in every
// way that matters: same shell, same idiom, results only ever from the served
// record. What it adds is the forfeit - the one result in the world reached
// without a ball - and the purse, which is why a poor club runs an academy.
(function () {
  "use strict";
  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function P() { return window.__foPlanet || null; }
  function hashPath() { return (location.hash || "").split("?")[0]; }
  function onPage() { return hashPath() === "#/colts"; }
  function qparam(k) {
    var q = (location.hash.split("?")[1] || "").split("&");
    for (var i = 0; i < q.length; i++) { var kv = q[i].split("="); if (kv[0] === k) return decodeURIComponent(kv[1] || ""); }
    return "";
  }
  function myNation() {
    try {
      var c = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null");
      if (c && c.country) return c.country;
    } catch (e) {}
    try { return (window.__foLgAPI && window.__foLgAPI.nation && window.__foLgAPI.nation()) || "eng"; } catch (e2) { return "eng"; }
  }
  function mySlot(rid) {
    try {
      var c = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null");
      if (c && c.country === rid) return c.slot | 0;
    } catch (e) {}
    return null;
  }
  function money(v) {
    var n = Number(v);
    if (!isFinite(n) || !n) return "";
    return n >= 1000000 ? "£" + (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + "m"
         : n >= 1000 ? "£" + Math.round(n / 1000) + "k" : "£" + Math.round(n);
  }

  // ---- the served bracket, cached per nation ---------------------------------
  var CUP = {};
  function want(rid, cb) {
    if (CUP[rid] && Date.now() - CUP[rid].at < 120000) return cb(CUP[rid].body || null);
    fetch(SB_URL + "/rest/v1/world_snapshots?key=eq." + encodeURIComponent("colts/" + rid) + "&select=body",
      { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        CUP[rid] = { body: (j && j[0] && j[0].body) || null, at: Date.now() };
        cb(CUP[rid].body);
      })
      .catch(function () { CUP[rid] = { body: null, at: Date.now() }; cb(null); });
  }

  var STAGE_NM = { r16: "The last sixteen", qf: "Quarter-finals", sf: "Semi-finals", final: "THE FINAL" };
  var STAGE_ORDER = ["r16", "qf", "sf", "final"];
  var WEEKDAY = { r16: "Colts Week, Monday", qf: "Colts Week, Tuesday", sf: "Colts Week, Thursday", final: "Colts Week, Friday" };
  var PURSE_NM = { winner: "Winners", finalist: "Beaten finalist", semi: "Losing semi-finalist" };

  function render() {
    try {
      if (!onPage()) return;
      var page = document.getElementById("page"); if (!page) return;
      var rid = qparam("n") || myNation();
      var body = null;
      if (CUP[rid]) body = CUP[rid].body || null;
      else want(rid, function () { if (onPage()) render(); });

      var natNm = rid.toUpperCase();
      try { natNm = (window.__foCxAPI.regions() || []).filter(function (r) { return r.id === rid; })[0].nm || natNm; } catch (e2) {}
      var me = mySlot(rid);
      var seasonNo = (body && body.seasonNo) || 1;
      try {
        var cal = P() && P().phaseOf ? P().phaseOf(Date.now()) : null;
        if (!body && cal && cal.season >= 1) seasonNo = cal.season;
      } catch (e) {}

      var html = "<div class='fo-cc-page'>" +
        "<div class='fo-cc-hero'><span class='fo-cc-eyebrow'>The academies&rsquo; week &middot; season " + seasonNo + "</span>" +
        "<h1>The " + E(natNm) + " Colts Cup</h1>" +
        "<p>Sixteen clubs, both divisions, one hat. Name fifteen men under twenty-one or forfeit the tie.</p></div>";

      if (!body || !body.stages || !Object.keys(body.stages).length) {
        html += "<div class='fo-cc-card'><h3>The draw awaits</h3><p class='dim'>" +
          "No colts cricket has been banked for this season yet. The league stands down for week four and the boys " +
          "play four days: the last sixteen on the Monday, the quarter-finals on the Tuesday, the semi-finals on " +
          "the Thursday and the final on the Friday. The draw is made once and the bracket holds, so you will be " +
          "able to see your path to the final on the Monday morning.</p></div>";
      } else {
        if (body.champion) {
          html += "<div class='fo-cc-champ'><span>&#127942;</span><div><i>Colts Cup champions, season " + seasonNo + "</i><b>" +
            E(body.champion) + "</b></div></div>";
        }
        // THE PURSE. Not a footnote: it is the reason a club that cannot buy
        // players still runs an academy.
        if (body.purse && body.purse.length) {
          var mineP = body.purse.filter(function (p) { return me != null && p.slot === me; })[0];
          html += "<div class='fo-cc-purse'><h4>The purse</h4><div class='fo-cc-prow'>" +
            body.purse.map(function (p) {
              return "<span" + (mineP && p === mineP ? " class='me'" : "") + "><i>" + (PURSE_NM[p.kind] || p.kind) +
                "</i><b>" + money(p.amount) + "</b></span>";
            }).join("") + "</div></div>";
        }
        STAGE_ORDER.forEach(function (st) {
          var ties = body.stages[st];
          if (!ties || !ties.length) return;
          html += "<div class='fo-cc-card'><h3>" + STAGE_NM[st] + "<span>" + WEEKDAY[st] + "</span></h3>";
          ties.forEach(function (t) {
            var hWin = t.winnerSlot === t.homeSlot, aWin = t.winnerSlot === t.awaySlot;
            var meH = me != null && t.homeSlot === me, meA = me != null && t.awaySlot === me;
            var short = (t.forfeit && t.forfeit.short) || [];
            // the club's name ellipsises; the SHORT tag beside it never does -
            // it is the whole reason the tie went the way it did
            var sideHTML = function (nm, win, mine2, isShort) {
              return "<span class='side" + (win ? " w" : "") + (mine2 ? " me" : "") + "'>" +
                "<b class='nm'>" + E(nm) + "</b>" + (isShort ? "<u>short</u>" : "") + "</span>";
            };
            html += "<div class='fo-cc-tie" + (meH || meA ? " mine" : "") + "'>" +
              sideHTML(t.home, hWin, meH, short.indexOf(t.homeSlot) >= 0) +
              "<span class='vs'>v</span>" +
              sideHTML(t.away, aWin, meA, short.indexOf(t.awaySlot) >= 0) +
              (t.forfeit ? "<em class='ff'>forfeit</em>" : "") + "</div>" +
              (t.text ? "<p class='fo-cc-line'>" + E(t.text) + "</p>" : "");
          });
          html += "</div>";
        });
        if ((body.runs && body.runs.length) || (body.wickets && body.wickets.length)) {
          html += "<div class='fo-cc-card'><h3>The boys who did it<span>from the cards themselves</span></h3><div class='fo-cc-lead'>";
          (body.runs || []).slice(0, 5).forEach(function (p) {
            html += "<div class='fo-cc-lrow'><b>" + E(p.name) + "</b><i>" + E(p.club) + "</i><u>" + p.runs + " runs" +
              (p.hs ? " (" + p.hs + " best)" : "") + "</u></div>";
          });
          (body.wickets || []).slice(0, 5).forEach(function (p) {
            html += "<div class='fo-cc-lrow'><b>" + E(p.name) + "</b><i>" + E(p.club) + "</i><u>" + p.wkts + " wickets</u></div>";
          });
          html += "</div></div>";
        }
      }
      html += "<div class='fo-cc-foot'><a href='#/academy'>&lsaquo; Your academy</a>" +
        "<a href='#/facup'>The FA Cup &rsaquo;</a></div></div>";
      page.innerHTML = html;
      css();
    } catch (e) { /* never take the shell down */ }
  }

  function css() {
    if (document.getElementById("fo-cc-css")) return;
    var s = document.createElement("style"); s.id = "fo-cc-css";
    s.textContent = [
      "html body #page .fo-cc-page{max-width:760px;margin:0 auto;padding:12px 14px 40px}",
      "html body #page .fo-cc-hero{padding:18px 4px 10px}",
      "html body #page .fo-cc-eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a6d3b}",
      "html body #page .fo-cc-hero h1{font-family:Fraunces,serif;font-size:34px;margin:4px 0 6px}",
      "html body #page .fo-cc-hero p{color:#5b5b56;max-width:56ch;margin:0}",
      "html body #page .fo-cc-champ{display:flex;gap:12px;align-items:center;background:#fdf6e3;border:1px solid #e8d9ab;border-radius:12px;padding:12px 16px;margin:10px 0}",
      "html body #page .fo-cc-champ span{font-size:28px}",
      "html body #page .fo-cc-champ i{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a6d3b;font-style:normal}",
      "html body #page .fo-cc-champ b{font-family:Fraunces,serif;font-size:20px}",
      "html body #page .fo-cc-purse{background:#fff;border:1px solid #e6e3da;border-radius:12px;padding:12px 16px;margin:12px 0}",
      "html body #page .fo-cc-purse h4{margin:0 0 8px;font:600 10px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#8a6d3b}",
      "html body #page .fo-cc-prow{display:flex;flex-wrap:wrap;gap:8px}",
      "html body #page .fo-cc-prow span{flex:1 1 120px;background:#faf8f2;border:1px solid #eee9dc;border-radius:9px;padding:8px 10px}",
      "html body #page .fo-cc-prow span.me{background:#fdf6e3;border-color:#e8d9ab}",
      "html body #page .fo-cc-prow i{display:block;font-size:10.5px;color:#98938a;font-style:normal}",
      "html body #page .fo-cc-prow b{font-family:Fraunces,serif;font-size:16px;font-variant-numeric:tabular-nums}",
      "html body #page .fo-cc-card{background:#fff;border:1px solid #e6e3da;border-radius:12px;padding:14px 16px;margin:12px 0}",
      "html body #page .fo-cc-card h3{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-family:Fraunces,serif;font-size:17px;margin:0 0 8px}",
      "html body #page .fo-cc-card h3 span{font-size:11px;color:#98938a;font-weight:400;white-space:nowrap}",
      "html body #page .fo-cc-card p.dim{color:#5b5b56;margin:0}",
      "html body #page .fo-cc-tie{display:flex;gap:10px;align-items:center;padding:7px 0;border-top:1px solid #f0ede4;position:relative}",
      "html body #page .fo-cc-tie.mine{background:#fdf6e3;margin:0 -16px;padding-left:16px;padding-right:16px}",
      "html body #page .fo-cc-tie .side{display:flex;align-items:baseline;gap:6px;flex:1 1 0;min-width:0;font-size:13.5px;color:#6b6862}",
      "html body #page .fo-cc-tie .side .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:400}",
      "html body #page .fo-cc-tie .side.w .nm{color:#141C28;font-weight:600}",
      "html body #page .fo-cc-tie .side.me .nm{color:#C8542F}",
      "html body #page .fo-cc-tie .side u{flex:none;text-decoration:none;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#C8542F}",
      "html body #page .fo-cc-tie .vs{flex:none;font-size:10.5px;color:#b4aa98;font-style:italic}",
      "html body #page .fo-cc-tie .ff{flex:none;font:600 9.5px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#C8542F;font-style:normal}",
      "html body #page .fo-cc-line{margin:0 0 6px;font-size:12px;color:#8a857c}",
      "html body #page .fo-cc-lead{display:grid;gap:4px}",
      "html body #page .fo-cc-lrow{display:flex;gap:8px;align-items:baseline;padding:5px 0;border-top:1px solid #f0ede4}",
      "html body #page .fo-cc-lrow b{font-size:13.5px}",
      "html body #page .fo-cc-lrow i{flex:1 1 0;min-width:0;font-size:11.5px;color:#98938a;font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      "html body #page .fo-cc-lrow u{text-decoration:none;font-size:12px;color:#6b6862;font-variant-numeric:tabular-nums;white-space:nowrap}",
      "html body #page .fo-cc-foot{display:flex;justify-content:space-between;gap:10px;margin:18px 0 0;font:600 11px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase}",
      "html body #page .fo-cc-foot a{color:#8a6d3b;text-decoration:none}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function paint() { render(); }
  window.addEventListener("hashchange", function () { setTimeout(paint, 30); });
  document.addEventListener("DOMContentLoaded", function () { setTimeout(paint, 60); });
  setTimeout(paint, 120);
  window.__foColtsCup = { render: render, want: want };
  window.foRenderColtsPage = render;
})();
