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

      // THE BRACKET BOARD. Same knockout idiom as the FA Cup page - columns
      // left to right - but this bracket is drawn ONCE and holds, so the
      // columns wear connector elbows: your path to the Friday final is a
      // line you can trace with a thumb from day one.
      var stages = { r16: null, qf: null, sf: null, final: null };
      if (body && body.stages) STAGE_ORDER.forEach(function (st) {
        if (body.stages[st] && body.stages[st].length) stages[st] = body.stages[st];
      });
      var ties1 = [], bySlot1 = {};
      if (!stages.r16) {
        try {
          var lg1 = window.__foWorldLg ? window.__foWorldLg.get(rid) : null;
          if (!lg1 && window.__foWorldLg && window.__foWorldLg.want)
            window.__foWorldLg.want(rid, function () { if (onPage()) render(); });
          if (lg1) ((lg1.table || []).concat(lg1.table2 || [])).forEach(function (r) { bySlot1[r.slot] = r.name; });
          try {
            var nmMap1 = window.__foWorldNames && window.__foWorldNames.get(rid);
            if (nmMap1) Object.keys(nmMap1).forEach(function (k) { bySlot1[k] = nmMap1[k]; });
          } catch (eNm1) {}
          if (!Object.keys(bySlot1).length && P() && P().sidesOf)
            (P().sidesOf(rid) || []).forEach(function (s1) { bySlot1[s1.slot] = s1.name; });
          if (P() && P().cupDraw) {
            var drawn1 = P().cupDraw("colts|" + rid + "|s" + seasonNo,
              [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            for (var i1 = 0; i1 + 1 < drawn1.length; i1 += 2) ties1.push([drawn1[i1], drawn1[i1 + 1]]);
          }
        } catch (eD1) {}
      }

      var html = "<div class='fo-cc-page'>" +
        "<div class='fo-kb-hero'><div><span class='eb'>The academies&rsquo; week &middot; season&nbsp;" + (window.foSeasonN ? foSeasonN(seasonNo) : seasonNo) + "</span>" +
        "<h1>The " + E(natNm) + " Colts Cup</h1>" +
        "<p>Sixteen clubs, both divisions, one hat. Name fifteen men under twenty-one or forfeit the tie.</p></div>" +
        "<span class='tro' aria-hidden='true'>&#127942;</span></div>" +
        (window.__foKbNatRail ? window.__foKbNatRail(rid, "#/colts") : "");
      if (body && body.champion) {
        html += "<div class='fo-cc-champ'><span>&#127942;</span><div><i>Colts Cup champions, season " + (window.foSeasonN ? foSeasonN(seasonNo) : seasonNo) + "</i><b>" +
          E(body.champion) + "</b></div></div>";
      }
      // THE PURSE. Not a footnote: it is the reason a club that cannot buy
      // players still runs an academy.
      if (body && body.purse && body.purse.length) {
        var mineP = body.purse.filter(function (p) { return me != null && p.slot === me; })[0];
        html += "<div class='fo-cc-purse'><h4>The purse</h4><div class='fo-cc-prow'>" +
          body.purse.map(function (p) {
            return "<span" + (mineP && p === mineP ? " class='me'" : "") + "><i>" + (PURSE_NM[p.kind] || p.kind) +
              "</i><b>" + money(p.amount) + "</b></span>";
          }).join("") + "</div></div>";
      }

      var TIE_N = { r16: 8, qf: 4, sf: 2, final: 1 };
      // every boy's club on the bracket is a door to that club's page
      var row = function (nm, tag, win, me2, dim, slot) {
        var href = slot == null ? "" : "#/team?c=" + encodeURIComponent(rid) + "&s=" + (slot | 0);
        var el = href ? "a" : "span";
        return "<" + el + " class='t" + (win ? " w" : "") + (me2 ? " me" : "") + (dim ? " d" : "") + "'" +
          (href ? " href='" + href + "'" : "") + ">" +
          "<b>" + E(nm) + "</b>" + (tag ? "<u class='ff'>" + tag + "</u>" : "") + "</" + el + ">";
      };
      var colOf = function (st) {
        var inner = "", i;
        if (stages[st]) {
          inner = stages[st].map(function (t) {
            var hWin = t.winnerSlot === t.homeSlot, aWin = t.winnerSlot === t.awaySlot;
            var done = t.winnerSlot != null;
            var meH = me != null && t.homeSlot === me, meA = me != null && t.awaySlot === me;
            var short = (t.forfeit && t.forfeit.short) || [];
            return "<div class='fo-kb-tw'><div class='fo-kb-tie'>" +
              row(t.home, short.indexOf(t.homeSlot) >= 0 ? "short" : "", hWin, meH, done && !hWin, t.homeSlot) +
              row(t.away, short.indexOf(t.awaySlot) >= 0 ? "short" : "", aWin, meA, done && !aWin, t.awaySlot) +
              (t.forfeit ? "<i class='ln'>Forfeit &mdash; fifteen under twenty-one could not be named.</i>" :
                t.text ? "<i class='ln'>" + E(t.text) + "</i>" : "") + "</div></div>";
          }).join("");
        } else if (st === "r16" && ties1.length && Object.keys(bySlot1).length) {
          inner = ties1.map(function (t1) {
            var meH1 = me != null && t1[0] === me, meA1 = me != null && t1[1] === me;
            return "<div class='fo-kb-tw'><div class='fo-kb-tie'>" +
              row(bySlot1[t1[0]] || "Club " + t1[0], "", false, meH1, false, t1[0]) +
              row(bySlot1[t1[1]] || "Club " + t1[1], "", false, meA1, false, t1[1]) + "</div></div>";
          }).join("");
        } else {
          for (i = 0; i < TIE_N[st]; i++)
            inner += "<div class='fo-kb-tw'><div class='fo-kb-tie tbd'><span>" +
              (st === "r16" ? "The draw awaits" : "&mdash;") + "</span></div></div>";
        }
        return "<div class='fo-kb-col kb-" + st + "'><h4>" + STAGE_NM[st] + "<span>" + WEEKDAY[st] + "</span></h4>" +
          "<div class='fo-kb-ties'>" + inner + "</div></div>";
      };
      html += "<div class='fo-kb'><div class='fo-kb-in linked'>" + STAGE_ORDER.map(colOf).join("") + "</div></div>" +
        "<p class='fo-kb-note'>Drawn once; the bracket holds. Winners of neighbouring ties meet in the next round. " +
        "Every prize in the purse is real money, paid the night the final is banked.</p>";

      if (body && ((body.runs && body.runs.length) || (body.wickets && body.wickets.length))) {
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
      html += "<div class='fo-cc-foot'><a href='#/academy'>&lsaquo; Your academy</a>" +
        "<a href='#/facup'>The National Cup &rsaquo;</a></div></div>";
      page.innerHTML = html;
      css();
      // the knockout board's stylesheet lives with the FA Cup page; both cups wear it
      try { if (window.__foFaCup && window.__foFaCup.css) window.__foFaCup.css(); } catch (eCss) {}
    } catch (e) { /* never take the shell down */ }
  }

  function css() {
    if (document.getElementById("fo-cc-css")) return;
    var s = document.createElement("style"); s.id = "fo-cc-css";
    s.textContent = [
      "html body #page .fo-cc-page{max-width:980px;margin:0 auto;padding:12px 14px 40px}",
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
      "html body #page .fo-cc-tie .side.w .nm{color:#1B2432;font-weight:600}",
      "html body #page .fo-cc-tie .side.me .nm{color:#C9571F}",
      "html body #page .fo-cc-tie .side u{flex:none;text-decoration:none;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#C9571F}",
      "html body #page .fo-cc-tie .vs{flex:none;font-size:10.5px;color:#b4aa98;font-style:normal}",
      "html body #page .fo-cc-tie .ff{flex:none;font:600 10px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#C9571F;font-style:normal}",
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
