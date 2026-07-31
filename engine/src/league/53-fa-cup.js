// ---- 53-fa-cup.js — THE FA CUP PAGE (#/facup) -------------------------------
// Every nation's own knockout: all sixteen clubs, four Sundays, the lower-
// division club hosting with its groundsman's pitch, the final at the boss's
// ground. This page draws the bracket AS BANKED - the umpire's cup_matches
// rows served via the facup/<nation>/s<season> snapshot - and, before a tie
// is played, names the drawn field so a manager can see who stands between
// his club and the trophy. Deterministic draw = knowable offline; results
// only ever come from the served record.
(function () {
  "use strict";
  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function P() { return window.__foPlanet || null; }
  function hashPath() { return (location.hash || "").split("?")[0]; }
  function onPage() { return hashPath() === "#/facup"; }
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

  // ---- the served bracket, cached per nation+season -------------------------
  var CUP = {};                    // rid -> { body, at } | { missing: true }
  function want(rid, seasonNo, cb) {
    var key = rid + "|s" + seasonNo;
    if (CUP[key] && Date.now() - CUP[key].at < 120000) return cb(CUP[key].body || null);
    fetch(SB_URL + "/rest/v1/world_snapshots?key=eq." + encodeURIComponent("facup/" + rid + "/s" + seasonNo) + "&select=body",
      { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        CUP[key] = { body: (j && j[0] && j[0].body) || null, at: Date.now() };
        cb(CUP[key].body);
      })
      .catch(function () { CUP[key] = { body: null, at: Date.now() }; cb(null); });
  }

  var STAGE_NM = { r16: "Round of 16", qf: "Quarter-finals", sf: "Semi-finals", final: "THE FINAL" };
  var STAGE_ORDER = ["r16", "qf", "sf", "final"];
  function stageDay(st) {
    var p = P(); if (!p) return "";
    var FA = { r16: 6, qf: 13, sf: 20, final: 27 };
    return "Sunday, day " + (FA[st] + 1) + " of the season";
  }

  function render() {
    try {
      if (!onPage()) return;
      var page = document.getElementById("page"); if (!page) return;
      var rid = qparam("n") || myNation();
      var seasonNo = 1;
      try {
        var cal = P() && P().phaseOf ? P().phaseOf(Date.now()) : null;
        if (cal && cal.season >= 1) seasonNo = cal.season;
      } catch (e) {}
      var body = null, key = rid + "|s" + seasonNo;
      if (CUP[key]) body = CUP[key].body || null;
      else want(rid, seasonNo, function () { if (onPage()) render(); });

      var natNm = rid.toUpperCase();
      try { natNm = (window.__foCxAPI.regions() || []).filter(function (r) { return r.id === rid; })[0].nm || natNm; } catch (e2) {}

      var mine = null;
      try {
        var c = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null");
        if (c && c.country === rid) mine = c.slot;
      } catch (e3) {}

      var html = "<div class='fo-fa-page'>" +
        "<div class='fo-fa-hero'><span class='fo-fa-eyebrow'>The national knockout &middot; season " + seasonNo + "</span>" +
        "<h1>The " + E(natNm) + " Cup</h1>" +
        "<p>All sixteen clubs of the pyramid in one draw. The small club hosts the giant; the final is played at the flagship's ground. " +
        "Four Sundays decide it.</p></div>";

      if (!body || !body.stages || !Object.keys(body.stages).length) {
        html += "<div class='fo-fa-card'><h3>The draw awaits</h3><p class='dim'>" +
          "No cup cricket has been banked for this season yet. The Round of 16 is played on the first Sunday " +
          "of the season, the quarter-finals a week on, the semis a week after that, and the final on the last " +
          "Sunday before the Champions Cup week.</p></div>";
      } else {
        var champion = body.champion;
        if (champion) {
          html += "<div class='fo-fa-champ'><span>&#127942;</span><div><i>Cup winners, season " + seasonNo + "</i><b>" +
            E(champion) + "</b></div></div>";
        }
        STAGE_ORDER.forEach(function (st) {
          var ties = body.stages[st];
          if (!ties || !ties.length) return;
          html += "<div class='fo-fa-card'><h3>" + STAGE_NM[st] + "<span>" + stageDay(st) + "</span></h3>";
          ties.forEach(function (t) {
            var aWin = t.winner === (t.a && t.a.name), bWin = t.winner === (t.b && t.b.name);
            var meA = mine != null && t.a && (t.a.slot | 0) === (mine | 0);
            var meB = mine != null && t.b && (t.b.slot | 0) === (mine | 0);
            html += "<div class='fo-fa-tie'>" +
              "<span class='side" + (aWin ? " w" : "") + (meA ? " me" : "") + "'>" + E(t.a && t.a.name) +
                "<u>" + E(t.as_ || "") + "</u></span>" +
              "<span class='vs'>v</span>" +
              "<span class='side" + (bWin ? " w" : "") + (meB ? " me" : "") + "'>" + E(t.b && t.b.name) +
                "<u>" + E(t.bs_ || "") + "</u></span>" +
              "</div>" +
              (t.text ? "<p class='fo-fa-line'>" + E(t.text) + "</p>" : "");
          });
          html += "</div>";
        });
      }
      html += "</div>";
      page.innerHTML = html;
      css();
    } catch (e) { /* a cup page must never take the shell down */ }
  }

  function css() {
    var CSS = [
      "html body #page .fo-fa-page{max-width:760px;margin:0 auto;padding:12px 14px 40px}",
      "html body #page .fo-fa-hero{padding:18px 4px 10px}",
      "html body #page .fo-fa-eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a6d3b}",
      "html body #page .fo-fa-hero h1{font-family:Fraunces,serif;font-size:34px;margin:4px 0 6px}",
      "html body #page .fo-fa-hero p{color:#5b5b56;max-width:56ch}",
      "html body #page .fo-fa-champ{display:flex;gap:12px;align-items:center;background:#fdf6e3;border:1px solid #e8d9ab;border-radius:12px;padding:12px 16px;margin:10px 0}",
      "html body #page .fo-fa-champ span{font-size:28px}",
      "html body #page .fo-fa-champ i{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a6d3b;font-style:normal}",
      "html body #page .fo-fa-champ b{font-family:Fraunces,serif;font-size:20px}",
      "html body #page .fo-fa-card{background:#fff;border:1px solid #e6e3da;border-radius:12px;padding:14px 16px;margin:12px 0}",
      "html body #page .fo-fa-card h3{display:flex;justify-content:space-between;align-items:baseline;font-family:Fraunces,serif;font-size:17px;margin:0 0 8px}",
      "html body #page .fo-fa-card h3 span{font-size:11px;color:#98938a;font-weight:400}",
      "html body #page .fo-fa-tie{display:flex;gap:10px;align-items:center;padding:7px 0;border-top:1px solid #f0ede4}",
      "html body #page .fo-fa-tie .side{flex:1;display:flex;justify-content:space-between;gap:8px;color:#6a675f}",
      "html body #page .fo-fa-tie .side u{text-decoration:none;font-variant-numeric:tabular-nums;color:#98938a}",
      "html body #page .fo-fa-tie .side.w{color:#1d1c19;font-weight:600}",
      "html body #page .fo-fa-tie .side.w u{color:#177A57}",
      "html body #page .fo-fa-tie .side.me{box-shadow:inset 3px 0 0 var(--nac,#C95532);padding-left:6px}",
      "html body #page .fo-fa-tie .vs{font-size:11px;color:#b5b0a5}",
      "html body #page .fo-fa-line{font-size:12px;color:#8a867d;margin:2px 0 6px}",
      "html body #page .fo-fa-card .dim{color:#8a867d}"
    ].join("\n");
    var s = document.getElementById("fo-fa-css");
    if (!s) { s = document.createElement("style"); s.id = "fo-fa-css"; document.head.appendChild(s); }
    s.textContent = CSS;
  }

  // ---- THE CHAMPIONS CUP, AS BANKED ----------------------------------------
  // #/cup's own module still draws the old synthetic bracket. When the World
  // Service HAS banked the real thing - four groups of four, then quarters,
  // semis, the final - this paints over it with the served record. Absent a
  // snapshot (offline, old world), the synthetic page stands untouched.
  var CC = {};
  function wantCC(seasonNo, cb) {
    var key = "s" + seasonNo;
    if (CC[key] && Date.now() - CC[key].at < 120000) return cb(CC[key].body || null);
    fetch(SB_URL + "/rest/v1/world_snapshots?key=eq." + encodeURIComponent("cup/s" + seasonNo) + "&select=body",
      { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.json(); })
      .then(function (j) { CC[key] = { body: (j && j[0] && j[0].body) || null, at: Date.now() }; cb(CC[key].body); })
      .catch(function () { CC[key] = { body: null, at: Date.now() }; cb(null); });
  }
  function renderCC() {
    try {
      if (hashPath() !== "#/cup") return;
      var page = document.getElementById("page"); if (!page) return;
      var seasonNo = 1;
      try { var cal = P() && P().phaseOf ? P().phaseOf(Date.now()) : null; if (cal && cal.season >= 1) seasonNo = cal.season; } catch (e) {}
      var key = "s" + seasonNo, body = CC[key] ? CC[key].body : undefined;
      if (body === undefined) { wantCC(seasonNo, function () { renderCC(); }); return; }
      if (!body || !body.stages || !body.stages.g1) return;   // nothing served: synthetic page stands
      var html = "<div class='fo-fa-page'>" +
        "<div class='fo-fa-hero'><span class='fo-fa-eyebrow'>The sixteen champions &middot; season " + seasonNo + "</span>" +
        "<h1>The Champions Cup</h1>" +
        "<p>Every nation's playoff champion, in four groups of four. Group cricket Monday to Wednesday of the " +
        "closing week; the top two go through to Friday's quarter-finals, and the final is played on the last " +
        "Sunday of the year.</p></div>";
      if (body.champion) {
        html += "<div class='fo-fa-champ'><span>&#127942;</span><div><i>Champions of the world, season " + seasonNo +
          "</i><b>" + E(body.champion) + "</b></div></div>";
      }
      // the groups: ties gi 0..7 per group day, floor(gi/2) is the group
      var groups = [[], [], [], []];
      ["g1", "g2", "g3"].forEach(function (st) {
        (body.stages[st] || []).forEach(function (t) { groups[Math.floor((t.gi | 0) / 2)].push(t); });
      });
      var GN = ["Group A", "Group B", "Group C", "Group D"];
      groups.forEach(function (ties, gx) {
        if (!ties.length) return;
        html += "<div class='fo-fa-card'><h3>" + GN[gx] + "<span>Mon&ndash;Wed, closing week</span></h3>";
        ties.forEach(function (t) {
          var aWin = t.winner === (t.a && t.a.name), bWin = t.winner === (t.b && t.b.name);
          html += "<div class='fo-fa-tie'>" +
            "<span class='side" + (aWin ? " w" : "") + "'>" + E(t.a && t.a.name) + "<u>" + E(t.as_ || "") + "</u></span>" +
            "<span class='vs'>v</span>" +
            "<span class='side" + (bWin ? " w" : "") + "'>" + E(t.b && t.b.name) + "<u>" + E(t.bs_ || "") + "</u></span></div>";
        });
        html += "</div>";
      });
      [["qf", "Quarter-finals", "Friday"], ["sf", "Semi-finals", "Saturday"], ["final", "THE FINAL", "Sunday"]].forEach(function (sd) {
        var ties = body.stages[sd[0]];
        if (!ties || !ties.length) return;
        html += "<div class='fo-fa-card'><h3>" + sd[1] + "<span>" + sd[2] + ", closing week</span></h3>";
        ties.forEach(function (t) {
          var aWin = t.winner === (t.a && t.a.name), bWin = t.winner === (t.b && t.b.name);
          html += "<div class='fo-fa-tie'>" +
            "<span class='side" + (aWin ? " w" : "") + "'>" + E(t.a && t.a.name) + "<u>" + E(t.as_ || "") + "</u></span>" +
            "<span class='vs'>v</span>" +
            "<span class='side" + (bWin ? " w" : "") + "'>" + E(t.b && t.b.name) + "<u>" + E(t.bs_ || "") + "</u></span></div>" +
            (t.text ? "<p class='fo-fa-line'>" + E(t.text) + "</p>" : "");
        });
        html += "</div>";
      });
      html += "</div>";
      page.innerHTML = html;
      css();
    } catch (e) { /* never take the shell down */ }
  }

  function paint() { render(); renderCC(); }
  window.addEventListener("hashchange", function () { setTimeout(paint, 30); });
  document.addEventListener("DOMContentLoaded", function () { setTimeout(paint, 60); });
  setTimeout(paint, 120);
  window.__foFaCup = { render: render, renderCC: renderCC };
})();
