/* features/oval — the animated oval: a top-down ground where every delivery
 * of a LIVE match plays out visually. Outcomes are the engine's real ball
 * log; only the shot DIRECTION is seeded decoration (never used as data —
 * the stage says so). Batters run, the ball races the rope for four, clears
 * it for six, stumps shatter for a wicket. Reduced motion collapses every
 * animation to its end state.
 */
FOC.oval = (function () {
  var U = FOC.util;
  var seenLogLen = 0, seenInn = -1, queue = [], animating = false, lastSig = null;

  function reduced() {
    try { return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }
  function esc(s) { return U.esc(s); }
  function nmS(nm) { return nm ? String(nm).split(" ").slice(-1)[0] : ""; }

  // classify a log entry exactly the way the engine's own ticker does
  function symOf(L) {
    if (!L || L.mile || L.no === "" || L.no == null) return null;
    var o = L.out;
    if (o === "4" || o === "6") return o;
    if (o === "dot") return "·";
    if (o === "1" || o === "2" || o === "3") return o;
    try { if (typeof isWkt === "function" && isWkt(o)) return "W"; } catch (e) {}
    return "+";
  }

  // seeded, deterministic decoration: the same ball always goes the same way
  function angleFor(ballIx, sym) {
    var h = U.hash32(((typeof M !== "undefined" && M && M.seed) || 0) + "|" + ballIx + "|" + sym);
    return (h % 360) * Math.PI / 180;
  }

  function stageHTML() {
    return "<div id='fo-oval' title='Ball-by-ball theatre — outcomes are real; shot directions are illustrative.'>" +
      "<div class='ov-board'>" +
      "<div class='ov-score'><span id='ov-team'></span><b id='ov-runs'></b><span id='ov-ov'></span></div>" +
      "<div class='ov-bats' id='ov-bats'></div>" +
      "<div class='ov-bowl' id='ov-bowl'></div>" +
      "<span class='ov-fld' id='ov-fld'></span>" +
      "<div class='ov-strip' id='ov-strip' aria-label='This over'></div>" +
      "</div>" +
      "<svg viewBox='0 0 400 260' class='ov-svg' aria-hidden='true'>" +
      "<ellipse cx='200' cy='130' rx='192' ry='122' fill='url(#ovg)' stroke='#e8e2cc' stroke-width='3'/>" +
      "<defs><radialGradient id='ovg'><stop offset='0%' stop-color='#7ea86c'/><stop offset='72%' stop-color='#5d8a4e'/><stop offset='100%' stop-color='#4c7440'/></radialGradient></defs>" +
      "<ellipse cx='200' cy='130' rx='186' ry='116' fill='none' stroke='rgba(255,255,255,.5)' stroke-width='1.5' stroke-dasharray='3 6'/>" +
      "<rect x='188' y='78' width='24' height='104' rx='3' fill='#d9c9a3'/>" +
      "<line x1='190' y1='90' x2='210' y2='90' stroke='#fff' stroke-width='1'/>" +
      "<line x1='190' y1='170' x2='210' y2='170' stroke='#fff' stroke-width='1'/>" +
      "<g id='ov-stumps-b'><line x1='197' y1='84' x2='197' y2='78' stroke='#f5efdd' stroke-width='1.6'/><line x1='200' y1='84' x2='200' y2='78' stroke='#f5efdd' stroke-width='1.6'/><line x1='203' y1='84' x2='203' y2='78' stroke='#f5efdd' stroke-width='1.6'/></g>" +
      "<g id='ov-stumps-a'><line x1='197' y1='182' x2='197' y2='176' stroke='#f5efdd' stroke-width='1.6'/><line x1='200' y1='182' x2='200' y2='176' stroke='#f5efdd' stroke-width='1.6'/><line x1='203' y1='182' x2='203' y2='176' stroke='#f5efdd' stroke-width='1.6'/></g>" +
      "<g id='ov-field'></g>" +
      "<circle id='ov-keeper' r='4' fill='#1f4d3a' stroke='#fff' stroke-width='1.2' style='transition:transform .9s ease' transform='translate(200,66)'/>" +
      "<circle id='ov-batter' cx='206' cy='86' r='5' fill='#C8674A' stroke='#fff' stroke-width='1.4'/>" +
      "<circle id='ov-nonstriker' cx='192' cy='174' r='5' fill='#C8674A' stroke='#fff' stroke-width='1.4' opacity='.75'/>" +
      "<circle id='ov-bowler' cx='200' cy='196' r='5' fill='#14213D' stroke='#fff' stroke-width='1.4'/>" +
      "<circle id='ov-ball' cx='200' cy='190' r='3.2' fill='#a3242b' stroke='#fff' stroke-width='.8' opacity='0'/>" +
      "<text id='ov-pop' x='200' y='128' text-anchor='middle' class='ov-pop'></text>" +
      "</svg><div class='ov-note'>theatre · field &amp; directions illustrative</div></div>";
  }

  // nine placements per setting (angle°, radius fraction): attacking crowds
  // the bat, balanced holds the ring, defensive rides the rope. The SETTING
  // is real (the compiled spell plan / the engine's own aiField); the exact
  // spots are illustrative templates.
  var FIELDS = {
    att: [[-75, .32], [-60, .30], [-45, .34], [0, .42], [30, .45], [60, .5], [120, .5], [150, .45], [180, .42]],
    bal: [[-70, .30], [-35, .85], [0, .55], [40, .6], [70, .6], [110, .6], [140, .6], [180, .55], [-145, .85]],
    def: [[-35, .92], [0, .9], [40, .9], [70, .85], [60, .45], [110, .85], [140, .9], [180, .9], [-145, .92]]
  };
  var curField = null;
  function fieldSetting(inn) {
    try {
      var over = Math.floor((inn.legal || 0) / 6) + 1;
      var userBowling = M.isUserMatch && inn.bowlTeam === M.user.name;
      var orders = userBowling ? App.orders : (typeof ordersFor === "function" ? ordersFor(inn.bowlTeam) : null);
      if (orders) {
        var sp = [].concat((orders.spells || {}).north || [], (orders.spells || {}).south || []);
        for (var i = 0; i < sp.length; i++) {
          if (sp[i] && sp[i].field && over >= sp[i].first && over < sp[i].first + (sp[i].n || 0)) return sp[i].field;
        }
        if (orders.fieldPlan) {
          var ph = over <= 10 ? "pp" : (over > 40 ? "death" : "mid");
          return orders.fieldPlan[ph] || "bal";
        }
      }
      if (typeof aiField === "function") return aiField(inn);
    } catch (e) {}
    return "bal";
  }
  function placeField(setting) {
    var g = document.getElementById("ov-field"); if (!g) return;
    if (!g.childNodes.length) {
      var h = "";
      for (var i = 0; i < 9; i++) h += "<circle r='4' fill='#1f4d3a' stroke='#fff' stroke-width='1.2' style='transition:transform .9s ease' transform='translate(200,130)'/>";
      g.innerHTML = h;
    }
    var spots = FIELDS[setting] || FIELDS.bal;
    var cs = g.childNodes;
    for (var j = 0; j < cs.length && j < spots.length; j++) {
      var a = spots[j][0] * Math.PI / 180, r = spots[j][1];
      var x = 200 + Math.cos(a) * 186 * r, y = 130 + Math.sin(a) * 116 * r;
      cs[j].setAttribute("transform", "translate(" + x.toFixed(1) + "," + y.toFixed(1) + ")");
    }
    var chip = document.getElementById("ov-fld");
    if (chip) {
      var LBL = { att: "attacking", bal: "balanced", def: "defensive" };
      chip.textContent = "field: " + (LBL[setting] || setting);
      chip.className = "ov-fld f-" + setting;
    }
    curField = setting;
  }

  function board() {
    try {
      var inn = M.innings[M.inns]; if (!inn) return;
      var el = function (id) { return document.getElementById(id); };
      if (!el("ov-team")) return;
      el("ov-team").textContent = inn.batTeam;
      el("ov-runs").textContent = (inn.runs || 0) + "/" + (inn.wkts || 0);
      el("ov-ov").textContent = Math.floor((inn.legal || 0) / 6) + "." + ((inn.legal || 0) % 6) +
        " ov" + (M.target ? " · target " + M.target : "");
      var s1 = inn.bat[inn.striker], s2 = inn.bat[inn.nonstriker];
      el("ov-bats").textContent =
        (s1 && s1.p ? nmS(s1.p.name) + " " + s1.r + "* (" + s1.b + ")" : "") +
        (s2 && s2.p ? "  ·  " + nmS(s2.p.name) + " " + s2.r + " (" + s2.b + ")" : "");
      var bw = inn.bowlers && inn.bowlers[inn.curBowlerName];
      el("ov-bowl").textContent = bw ? nmS(inn.curBowlerName) + "  " + Math.floor((bw.b || 0) / 6) + "-" + (bw.r || 0) + "-" + (bw.w || 0) : "";
      var fs = fieldSetting(inn);
      if (fs !== curField) placeField(fs);
      // this over: the last balls since the over began
      var balls = [];
      (M.log || []).slice(0, 30).forEach(function (L) {
        var s = symOf(L); if (s && L.inn === M.inns) balls.push(s);
      });
      balls = balls.slice(0, (inn.legal % 6) === 0 && balls.length ? 6 : (inn.legal % 6) || 6).reverse();
      el("ov-strip").innerHTML = balls.map(function (s) {
        var cls = s === "4" ? "b4" : s === "6" ? "b6" : s === "W" ? "bw" : s === "·" ? "bd" : "br";
        return "<i class='" + cls + "'>" + esc(s) + "</i>";
      }).join("");
    } catch (e) {}
  }

  // ---- the theatre ----------------------------------------------------------
  function animate(sym, ballIx, done) {
    var svg = document.querySelector("#fo-oval .ov-svg");
    var ball = document.getElementById("ov-ball");
    var pop = document.getElementById("ov-pop");
    if (!svg || !ball) { done(); return; }
    if (reduced()) { flashPop(sym, pop); done(); return; }
    // delivery: bowler end (200,190) to the striker (200,88)
    ball.setAttribute("opacity", "1");
    slide(ball, 200, 190, 200, 92, 220, function () {
      if (sym === "W") {
        shatter(); flashPop("OUT", pop, "#a3242b");
        setTimeout(function () { ball.setAttribute("opacity", "0"); done(); }, 620);
        return;
      }
      if (sym === "·" || sym === "+") {
        setTimeout(function () { ball.setAttribute("opacity", "0"); if (sym === "+") flashPop("extra", pop, "#5b6472"); done(); }, 160);
        return;
      }
      // a scoring shot: seeded direction, distance by outcome
      var a = angleFor(ballIx, sym);
      var dist = sym === "6" ? 1.06 : sym === "4" ? 0.97 : 0.45 + ((ballIx % 3) * 0.1);
      var tx = 200 + Math.cos(a) * 186 * dist;
      var ty = 130 + Math.sin(a) * 116 * dist;
      var runs = sym === "4" ? 0 : sym === "6" ? 0 : parseInt(sym, 10) || 0;
      if (runs) swapRunners(runs);
      slide(ball, 200, 92, tx, ty, sym === "6" ? 560 : 440, function () {
        if (sym === "4") flashPop("FOUR", pop, "#C9A24B");
        if (sym === "6") flashPop("SIX", pop, "#C8674A");
        setTimeout(function () { ball.setAttribute("opacity", "0"); done(); }, sym === "4" || sym === "6" ? 480 : 140);
      }, sym === "6");
    });
  }
  function slide(el2, x0, y0, x1, y1, ms, then, lob) {
    var t0 = null;
    function step(ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / ms);
      var x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
      el2.setAttribute("cx", x); el2.setAttribute("cy", y);
      el2.setAttribute("r", lob ? (3.2 + Math.sin(k * Math.PI) * 2.4).toFixed(1) : "3.2");
      if (k < 1) requestAnimationFrame(step); else then();
    }
    requestAnimationFrame(step);
  }
  function swapRunners(runs) {
    var b1 = document.getElementById("ov-batter"), b2 = document.getElementById("ov-nonstriker");
    if (!b1 || !b2) return;
    b1.style.transition = b2.style.transition = "transform .5s ease";
    var n = 0;
    (function leg() {
      n++;
      var off = (n % 2) ? 86 : 0;
      b1.style.transform = "translateY(" + off + "px)";
      b2.style.transform = "translateY(" + (-off) + "px)";
      if (n < runs) setTimeout(leg, 480);
      else setTimeout(function () { b1.style.transform = b2.style.transform = ""; }, 520);
    })();
  }
  function shatter() {
    var st = document.getElementById("ov-stumps-b");
    if (!st) return;
    st.style.transition = "transform .3s ease";
    st.style.transformOrigin = "200px 84px";
    st.style.transform = "rotate(-24deg) translateX(-5px)";
    setTimeout(function () { st.style.transition = "transform .4s ease"; st.style.transform = ""; }, 700);
  }
  function flashPop(txt, pop, color) {
    if (!pop) return;
    pop.textContent = txt;
    pop.setAttribute("fill", color || "#F1EADA");
    pop.classList.remove("on");
    void pop.getBBox && pop.getBoundingClientRect();
    pop.classList.add("on");
    setTimeout(function () { pop.classList.remove("on"); pop.textContent = ""; }, 1100);
  }

  function pump() {
    if (animating) return;
    // a fast-forwarded burst: keep only the last few so the stage stays live
    if (queue.length > 5) queue = queue.slice(-2);
    var next = queue.shift();
    if (!next) return;
    animating = true;
    animate(next.sym, next.ix, function () { animating = false; board(); pump(); });
  }

  function tick() {
    try {
      if (location.hash.indexOf("#/match") !== 0) {
        seenLogLen = 0; curField = null;
        var pg0 = document.getElementById("page");
        if (pg0 && pg0.classList.contains("fo-ovalgrid")) pg0.classList.remove("fo-ovalgrid");
        return;
      }
      if (typeof M === "undefined" || !M || !M.log) return;
      var page = document.getElementById("page");
      if (!page) return;
      if (!document.getElementById("fo-oval")) {
        page.insertAdjacentHTML("afterbegin", stageHTML());
        seenLogLen = M.log.length;   // join the broadcast from now
        seenInn = M.inns;
        curField = null;
      }
      page.classList.add("fo-ovalgrid");
      if (M.inns !== seenInn) { seenInn = M.inns; seenLogLen = M.log.length; }
      if (M.log.length > seenLogLen) {
        // engine unshifts: new entries are at the FRONT
        var fresh = M.log.slice(0, M.log.length - seenLogLen);
        seenLogLen = M.log.length;
        for (var i = fresh.length - 1; i >= 0; i--) {
          var s = symOf(fresh[i]);
          if (s) queue.push({ sym: s, ix: seenLogLen - i });
        }
        pump();
      }
      board();
    } catch (e) {}
  }

  function css() {
    if (document.getElementById("fo-oval-css")) return;
    var st = document.createElement("style"); st.id = "fo-oval-css";
    st.textContent =
      "#fo-oval{max-width:640px;margin:0 auto 14px;background:#0F1A2E;border:1px solid #24334f;border-radius:14px;overflow:hidden}" +
      "@media(min-width:1020px){" +
      // Generic split: oval left, everything else right. Used on match pages
      // that don't carry the overlay's own .fo-matchpage grid.
      "html body #page.fo-ovalgrid{display:grid;grid-template-columns:minmax(430px,46%) minmax(0,1fr);gap:0 20px;align-items:start}" +
      "html body #page.fo-ovalgrid #fo-oval{grid-column:1;grid-row:1/span 40;position:sticky;top:64px;max-width:none;margin:0}" +
      "html body #page.fo-ovalgrid:not(.fo-matchpage)>*:not(#fo-oval){grid-column:2}" +
      // Match centre: the overlay lays #page out as a named-area grid
      // (mlinks|mbody|mside). Re-template it with the oval as its own left
      // area and stack crumb / score+details / tab links / commentary right.
      "html body #page.fo-ovalgrid.fo-matchpage{grid-template-columns:minmax(430px,46%) minmax(0,1fr);grid-template-rows:auto auto auto auto 1fr;grid-template-areas:'moval mcrumb' 'moval mtop' 'moval mlinks' 'moval mbody' 'moval mrest'}" +
      "html body #page.fo-ovalgrid.fo-matchpage #fo-oval{grid-area:moval}" +
      "html body #page.fo-ovalgrid.fo-matchpage>.crumb{grid-area:mcrumb}" +
      "html body #page.fo-ovalgrid.fo-matchpage .mc-top{grid-area:mtop;display:flex !important;flex-direction:row !important;align-items:stretch;gap:12px;margin:0 0 12px}" +
      "html body #page.fo-ovalgrid.fo-matchpage .mc-top .panel{flex:1 1 0 !important;min-width:0;margin:0}" +
      "html body #page.fo-ovalgrid.fo-matchpage .ftp-match-links{grid-area:mlinks;display:flex;flex-direction:row;flex-wrap:wrap;gap:6px;padding:6px;margin:0 0 12px;position:static}" +
      "html body #page.fo-ovalgrid.fo-matchpage .ftp-match-links h4{display:none}" +
      "html body #page.fo-ovalgrid.fo-matchpage .ftp-match-links a{white-space:nowrap;border-bottom:none !important;border-radius:8px}" +
      "html body #page.fo-ovalgrid.fo-matchpage .ftp-match-body{grid-area:mbody;min-width:0;margin:0}" +
      "}" +
      ".ov-fld{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;border-radius:99px;padding:3px 10px;background:#1f2d4a;color:#cfd6e4}" +
      ".ov-fld.f-att{background:#C8674A;color:#fff}.ov-fld.f-def{background:#2E5A7A;color:#fff}.ov-fld.f-bal{background:#4E7A4E;color:#fff}" +
      ".ov-board{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;padding:9px 14px;background:#14213D;color:#F1EADA}" +
      ".ov-score{display:flex;gap:8px;align-items:baseline}" +
      ".ov-score span{font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#b9c2d4}" +
      ".ov-score b{font-family:Oswald,sans-serif;font-size:22px;letter-spacing:1px;color:#fff;font-variant-numeric:tabular-nums}" +
      ".ov-bats,.ov-bowl{font-size:12px;color:#d5dcea;font-variant-numeric:tabular-nums}" +
      ".ov-strip{margin-left:auto;display:flex;gap:4px}" +
      ".ov-strip i{font-style:normal;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:#1f2d4a;color:#cfd6e4}" +
      ".ov-strip .b4{background:#C9A24B;color:#14213D}.ov-strip .b6{background:#C8674A;color:#fff}" +
      ".ov-strip .bw{background:#a3242b;color:#fff}.ov-strip .bd{opacity:.75}" +
      ".ov-svg{display:block;width:100%;height:auto;background:#0F1A2E}" +
      ".ov-pop{font-family:Oswald,sans-serif;font-size:30px;letter-spacing:4px;font-weight:600;opacity:0;paint-order:stroke;stroke:#0F1A2E;stroke-width:4px}" +
      ".ov-pop.on{animation:ovPop 1.05s ease}" +
      "@keyframes ovPop{0%{opacity:0;transform:scale(.6)}18%{opacity:1;transform:scale(1.12)}70%{opacity:1;transform:scale(1)}100%{opacity:0}}" +
      ".ov-note{text-align:right;font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:#5b6a85;padding:3px 10px 5px}" +
      "@media(prefers-reduced-motion:reduce){.ov-pop.on{animation:none;opacity:1}}";
    document.head.appendChild(st);
  }

  function init() {
    if (typeof window === "undefined") return;
    css();
    setInterval(tick, 300);
  }

  return { init: init, tick: tick, symOf: symOf, angleFor: angleFor };
})();
