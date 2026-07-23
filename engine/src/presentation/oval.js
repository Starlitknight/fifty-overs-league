/* features/oval — the animated oval: a top-down ground where every delivery
 * of a LIVE match plays out visually. Outcomes are the engine's real ball
 * log; only the shot DIRECTION is seeded decoration (never used as data —
 * the stage says so). Batters run, the ball races the rope for four, clears
 * it for six, stumps shatter for a wicket. Reduced motion collapses every
 * animation to its end state.
 */
FOC.oval = (function () {
  var U = FOC.util;
  var seenLogLen = 0, seenInn = -1, queue = [], animating = false, lastSig = null; var seenM = null;
  // set true the moment the viewer leaves #/match; the next time the stage is
  // rebuilt we SNAP to the current ball instead of animating everything that
  // happened while they were away (a per-ball page re-render never sets this,
  // so live play still animates each delivery)
  var leftMatch = false;

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
    return "<div id='fo-oval' title='Ball-by-ball theatre — a faithful map: every ball travels the exact line the engine played it, to the fielder who fielded it.'>" +
      "<div class='ov-board'>" +
      "<div class='ov-score'><span id='ov-team'></span><b id='ov-runs'></b><span id='ov-ov'></span></div>" +
      "<div class='ov-bats' id='ov-bats'></div>" +
      "<div class='ov-bowl' id='ov-bowl'></div>" +
      "<span class='ov-fld' id='ov-fld'></span>" +
      "<span class='ov-need' id='ov-need'></span>" +
      "<div class='ov-strip' id='ov-strip' aria-label='This over'></div>" +
      "</div>" +
      "<div class='ov-who' id='ov-who'></div>" +
      "<svg viewBox='0 0 400 260' class='ov-svg' aria-hidden='true'>" +
      "<ellipse cx='200' cy='130' rx='192' ry='122' fill='url(#ovg)' stroke='#e8e2cc' stroke-width='3'/>" +
      "<defs><radialGradient id='ovg'><stop offset='0%' stop-color='#7ea86c'/><stop offset='72%' stop-color='#5d8a4e'/><stop offset='100%' stop-color='#4c7440'/></radialGradient></defs>" +
      "<ellipse cx='200' cy='130' rx='186' ry='116' fill='none' stroke='rgba(255,255,255,.5)' stroke-width='1.5' stroke-dasharray='3 6'/>" +
      "<ellipse cx='200' cy='130' rx='110' ry='80' fill='none' stroke='rgba(255,255,255,.32)' stroke-width='1.1' stroke-dasharray='2 5'/>" +
      "<g id='ov-trails'></g>" +
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
      "<text id='ov-pop2' x='200' y='150' text-anchor='middle' class='ov-pop2'></text>" +
      "</svg><div class='ov-note'><button type='button' id='ov-snd' class='ov-snd' title='Match sound'>&#128263;</button><span>theatre · live directions · real fielders at real posts</span></div></div>";
  }

  // ---- sound: tiny synthesized crowd + bat, no assets, off by default ------
  var sndOn = (function () { try { return localStorage.getItem("fo_sound") === "1"; } catch (e) { return false; } })();
  var AC = null;
  function ac() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (AC && AC.state === "suspended") { try { AC.resume(); } catch (e) {} }
    return AC;
  }
  function crowd(vol, dur, freq) {
    var c = ac(); if (!c) return;
    var len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) { var env = Math.sin(Math.PI * (i / len)); d[i] = (Math.random() * 2 - 1) * env; }
    var n = c.createBufferSource(); n.buffer = buf;
    var f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq || 900; f.Q.value = 0.6;
    var g = c.createGain(); g.gain.value = vol;
    n.connect(f); f.connect(g); g.connect(c.destination); n.start();
  }
  function knock() {
    var c = ac(); if (!c) return;
    var o = c.createOscillator(); o.type = "square"; o.frequency.value = 190;
    var g = c.createGain(); g.gain.setValueAtTime(0.10, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.06);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.07);
  }
  function chime() {
    var c = ac(); if (!c) return;
    var o = c.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(880, c.currentTime); o.frequency.linearRampToValueAtTime(1318, c.currentTime + 0.18);
    var g = c.createGain(); g.gain.setValueAtTime(0.09, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.45);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.5);
  }
  function foSnd(kind) {
    if (!sndOn) return;
    try {
      if (kind === "4") { knock(); crowd(0.22, 0.7, 900); }
      else if (kind === "6") { knock(); crowd(0.34, 1.1, 700); }
      else if (kind === "W") { crowd(0.38, 1.0, 1400); }
      else if (kind === "mile") { chime(); crowd(0.18, 0.8, 1000); }
      else if (kind === "run") { knock(); }
    } catch (e) {}
  }
  function wireSnd() {
    var btn = document.getElementById("ov-snd");
    if (!btn || btn.__foW) return;
    btn.__foW = 1;
    btn.textContent = sndOn ? "🔊" : "🔇";
    btn.addEventListener("click", function () {
      sndOn = !sndOn;
      try { localStorage.setItem("fo_sound", sndOn ? "1" : "0"); } catch (e) {}
      btn.textContent = sndOn ? "🔊" : "🔇";
      if (sndOn) { ac(); crowd(0.12, 0.4, 900); }   // the user gesture unlocks audio
    });
  }

  var curField = null;

  // field truth lives in the ENGINE now (foFieldState / FO_FIELDS); the
  // stage only renders it and consumes per-ball events from the log.
  function spotFor(lbl) {
    if (!lbl) return null;
    var gs = document.querySelectorAll("#ov-field g");
    for (var i = 0; i < gs.length; i++) {
      var t = gs[i].querySelector("text");
      if (t && t.textContent === lbl) {
        var m = /translate\((-?[\d.]+),(-?[\d.]+)\)/.exec(gs[i].getAttribute("transform") || "");
        if (m) return { g: gs[i], x: +m[1], y: +m[2] };
      }
    }
    return null;
  }
  function pulseDot(g, wicket) {
    try {
      g.classList.remove("ov-hot", "ov-hotw");
      void g.getBoundingClientRect();
      g.classList.add(wicket ? "ov-hotw" : "ov-hot");
      setTimeout(function () { g.classList.remove("ov-hot", "ov-hotw"); }, 950);
    } catch (e) {}
  }

  // the ENGINE posts real players to the nine spots (foFieldAssign) -
  // the stage renders that exact assignment, ratings and all
  function fieldLvl(p) {
    var f = (p.skills && p.skills.fielding) || 50, c = (p.skills && p.skills.catching) || 55;
    return Math.round((f + c) / 2);
  }
  // render an engine field state (foFieldState): spots arrive with labels
  // and already-mirrored coordinates
  function placeField(st) {
    var g = document.getElementById("ov-field"); if (!g) return;
    if (!g.childNodes.length) {
      var h = "";
      for (var i = 0; i < 9; i++) {
        h += "<g class='ov-f' style='transition:transform .9s ease' transform='translate(200,130)'>" +
          "<circle r='4' fill='#1f4d3a' stroke='#fff' stroke-width='1.2'/>" +
          "<text y='12' class='ov-flbl'></text><text y='21' class='ov-fplr'></text></g>";
      }
      g.innerHTML = h;
    }
    // the attacking template has one unlabeled second slip; rebuild the
    // full 9-spot list from the engine template so the dot count stays 9
    var raw = (st.setting === "att" && st.spin) ? FO_FIELDS.attSpin : (FO_FIELDS[st.setting] || FO_FIELDS.bal);
    var who = null;
    try { var A = (typeof foFieldAssign === "function") ? foFieldAssign(M.innings[M.inns]) : null; who = A && A.byIx; } catch (eA) {}
    var cs = g.childNodes;
    for (var j = 0; j < cs.length && j < raw.length; j++) {
      var x = st.lhb ? 400 - raw[j][0] : raw[j][0], y = raw[j][1];
      cs[j].setAttribute("transform", "translate(" + x + "," + y + ")");
      var t = cs[j].querySelector("text");
      if (t) t.textContent = raw[j][2] || "";
      var pl = who && who[j], t2 = cs[j].querySelector(".ov-fplr");
      var tier = "";
      if (pl) {
        var lv = fieldLvl(pl);
        tier = lv >= 72 ? "f-hi" : lv >= 58 ? "f-ok" : lv >= 45 ? "" : "f-lo";
        if (t2) t2.textContent = nmS(pl.name) + " " + lv;
      } else if (t2) t2.textContent = "";
      cs[j].setAttribute("class", "ov-f " + tier);
    }
    var chip = document.getElementById("ov-fld");
    if (chip) {
      var LBL = { att: "attacking", bal: "balanced", def: "defensive" };
      chip.textContent = "field: " + (LBL[st.setting] || st.setting) +
        (st.setting === "att" && st.spin ? " · spin" : "");
      chip.className = "ov-fld f-" + st.setting;
    }
    curField = st.setting + (st.lhb ? "|L" : "|R") + (st.spin ? "|S" : "|P") + "|" + (((M.innings || [])[M.inns] || {}).curBowlerName || "") + "|" + M.inns;
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
      if (typeof foFieldState === "function") {
        var st = foFieldState(inn, (s1 && s1.p && s1.p.hand) || "R");
        var key = st.setting + (st.lhb ? "|L" : "|R") + (st.spin ? "|S" : "|P") + "|" + (inn.curBowlerName || "") + "|" + M.inns;
        if (key !== curField) placeField(st);
      }
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
      // the death of a chase gets its own heartbeat
      var nd = el("ov-need");
      if (nd) {
        var showNeed = false;
        if (M.target && M.inns === 1 && !M.done) {
          var left = (typeof foBallCap === "function" ? foBallCap() : 300) - (inn.legal || 0);
          var need = M.target - (inn.runs || 0);
          if (left <= 30 && left > 0 && need > 0 && inn.wkts < 10) {
            nd.textContent = "NEED " + need + " OFF " + left;
            nd.classList.add("on"); showNeed = true;
          }
        }
        if (!showNeed) { nd.classList.remove("on"); nd.textContent = ""; }
      }
    } catch (e) {}
  }

  // ---- the theatre ----------------------------------------------------------
  // every duration honours the broadcast speed control (1x/2x/4x)
  function sp(ms) { return Math.max(60, Math.round(ms / (window.__foThMult || 1))); }
  var SVGNS = "http://www.w3.org/2000/svg";
  function fx(tag, attrs) {
    try {
      var svg = document.querySelector("#fo-oval .ov-svg"); if (!svg) return null;
      var e = document.createElementNS(SVGNS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      svg.appendChild(e); return e;
    } catch (err) { return null; }
  }
  // a small pulse where the delivery pitched
  function pitchPulse(x, y) {
    var c = fx("circle", { cx: x, cy: y, r: 2.5, "class": "ov-pit" });
    if (c) setTimeout(function () { try { c.remove(); } catch (e) {} }, 700);
  }
  // the rope ripples where a boundary crosses it
  function ripple(x, y, col, big) {
    var c = fx("circle", { cx: x, cy: y, r: 3, "class": "ov-rip" + (big ? " big" : ""), style: "stroke:" + col });
    if (c) setTimeout(function () { try { c.remove(); } catch (e) {} }, 950);
  }
  // the dismissal detail line under the OUT pop (CAUGHT · POINT, LBW, ...)
  function pop2(t) {
    var p2 = document.getElementById("ov-pop2"); if (!p2) return;
    p2.textContent = t;
    p2.classList.remove("on");
    void p2.getBoundingClientRect();
    p2.classList.add("on");
    setTimeout(function () { p2.classList.remove("on"); p2.textContent = ""; }, 1500);
  }
  // lbw: the projected continuation onto the stumps
  function lbwFlash() {
    var l = fx("line", { x1: 200, y1: 94, x2: 200, y2: 80, "class": "ov-lbw" });
    if (l) setTimeout(function () { try { l.remove(); } catch (e) {} }, 750);
  }
  function animate(n, done) {
    var sym = n.sym, ballIx = n.ix, lbl = n.lbl, dirDeg = n.dir, wk = n.wk;
    var svg = document.querySelector("#fo-oval .ov-svg");
    var ball = document.getElementById("ov-ball");
    var pop = document.getElementById("ov-pop");
    if (!svg || !ball) { done(); return; }
    if (reduced()) { flashPop(sym === "W" ? "OUT" : sym, pop); done(); return; }
    var spot = spotFor(lbl);   // the fielder the commentary actually named
    // THE MAP IS FAITHFUL: the one true angle for this delivery comes from the
    // engine — its recorded landing point (ex,ey), else the posted fielder it
    // reached, else its sampled line. There is no decorative guess.
    var trueA = (n.ex != null && n.ey != null) ? Math.atan2(n.ey - 130, n.ex - 200)
      : spot ? Math.atan2(spot.y - 130, spot.x - 200)
      : (dirDeg != null ? dirDeg * Math.PI / 180 : null);
    // one controlled sequence per delivery:
    // release -> pitch (pulse) -> batter -> contact -> shot -> result -> settle
    ball.setAttribute("opacity", "1");
    slide(ball, 200, 190, 200, 138, sp(430), function () {
      pitchPulse(200, 138);
      slide(ball, 200, 138, 200, 94, sp(210), function () { contact(); });
    });
    function finish(ms) { setTimeout(function () { ball.setAttribute("opacity", "0"); done(); }, sp(ms)); }
    function contact() {
      if (sym === "W") {
        // each mode of dismissal plays its own truth - the engine's, always
        if (wk === "wB" || wk === "wLBW") {
          if (wk === "wLBW") lbwFlash();
          shatter(); flashPop("OUT", pop, "#a3242b"); pop2(wk === "wLBW" ? "LBW" : "BOWLED"); foSnd("W");
          finish(650);
        } else if (wk === "wST") {
          // beaten, and the keeper does the rest
          slide(ball, 200, 94, 200, 66, sp(190), function () {
            shatter(); flashPop("OUT", pop, "#a3242b"); pop2("STUMPED"); foSnd("W");
            finish(650);
          });
        } else if (wk === "wRO" && spot) {
          // into the field, the return throw, the direct hit
          slide(ball, 200, 94, spot.x, spot.y, sp(380), function () {
            pulseDot(spot.g, true);
            var endY = spot.y < 130 ? 84 : 178;
            slide(ball, spot.x, spot.y, 200, endY, sp(300), function () {
              shatter(); flashPop("OUT", pop, "#a3242b"); pop2("RUN OUT"); foSnd("W");
              finish(650);
            });
          });
        } else if (spot) {
          // caught at the named position
          slide(ball, 200, 94, spot.x, spot.y, sp(430), function () {
            pulseDot(spot.g, true); flashPop("OUT", pop, "#a3242b"); pop2("CAUGHT" + (lbl ? " · " + lbl : "")); foSnd("W");
            finish(620);
          });
        } else {
          // an edge with no man posted at the line: it carried behind to the
          // keeper (caught behind / c&b), NOT bowled — the ball must travel
          var kx = (trueA != null) ? 200 + Math.cos(trueA) * 26 : 200;
          var ky = 70;
          slide(ball, 200, 94, kx, ky, sp(240), function () {
            flashPop("OUT", pop, "#a3242b"); pop2("CAUGHT" + (n.fld ? " · " + n.fld : " behind")); foSnd("W");
            finish(620);
          });
        }
        return;
      }
      if (sym === "·" || sym === "+") {
        if (sym === "+") { setTimeout(function () { ball.setAttribute("opacity", "0"); flashPop("extra", pop, "#5b6472"); done(); }, sp(160)); return; }
        // a dot still went SOMEWHERE — draw it to the fielder / line the engine
        // recorded, so even defended balls read as real deliveries on the map
        var dtx = spot ? spot.x : (trueA != null ? 200 + Math.cos(trueA) * 186 * 0.4 : 200);
        var dty = spot ? spot.y : (trueA != null ? 130 + Math.sin(trueA) * 116 * 0.4 : 138);
        slide(ball, 200, 94, dtx, dty, sp(300), function () {
          if (spot) pulseDot(spot.g);
          finish(180);
        });
        return;
      }
      // a scoring shot: always the engine's true line — the fielder it reached,
      // or its recorded landing angle. Never a decorative guess.
      var a = (trueA != null) ? trueA : 0;
      var dist = sym === "6" ? 1.1 : sym === "4" ? 0.97 : 0.45 + ((ballIx % 3) * 0.1);
      var tx = 200 + Math.cos(a) * 186 * dist;
      var ty = 130 + Math.sin(a) * 116 * dist;
      var runs = sym === "4" ? 0 : sym === "6" ? 0 : parseInt(sym, 10) || 0;
      if (runs && spot) { tx = spot.x; ty = spot.y; }
      if (runs) { swapRunners(runs); foSnd("run"); }
      slide(ball, 200, 94, tx, ty, sp(sym === "6" ? 700 : 520), function () {
        if (sym === "4") { ripple(tx, ty, "#C9A24B"); flashPop("FOUR", pop, "#C9A24B"); foSnd("4"); }
        if (sym === "6") { ripple(tx, ty, "#C8674A", true); flashPop("SIX", pop, "#C8674A"); foSnd("6"); }
        else if (spot) pulseDot(spot.g);
        finish(sym === "4" || sym === "6" ? 520 : 140);
      }, sym === "6");
    }
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
    b1.style.transition = b2.style.transition = "transform " + (sp(500) / 1000) + "s ease";
    var n = 0;
    (function leg() {
      n++;
      var off = (n % 2) ? 86 : 0;
      b1.style.transform = "translateY(" + off + "px)";
      b2.style.transform = "translateY(" + (-off) + "px)";
      if (n < runs) setTimeout(leg, sp(480));
      else setTimeout(function () {
        if (runs % 2) {
          // odd runs: the batters genuinely swapped ends. Snap the markers home
          // WITHOUT the transition - animating the return read as an extra run.
          b1.style.transition = b2.style.transition = "none";
          b1.style.transform = b2.style.transform = "";
          void b1.getBoundingClientRect();
          b1.style.transition = b2.style.transition = "";
        } else {
          b1.style.transform = b2.style.transform = "";
        }
      }, sp(520));
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
    if (next.pop) {   // a milestone moment: FIFTY! / HUNDRED!
      flashPop(next.pop, document.getElementById("ov-pop"), next.col || "#C9A24B");
      foSnd("mile");
      setTimeout(function () { animating = false; board(); pump(); }, sp(950));
      return;
    }
    // the LIVE BALL pane header reads the delivery + region as it plays
    try {
      var hs = document.getElementById("fo-ovhd-sub");
      // no outcome words up front - the region alone, like a camera cut
      if (hs) hs.textContent = (next.no ? next.no + " · " : "") + (next.reg || "");
    } catch (eH) {}
    animate(next, function () {
      animating = false;
      try { if (window.__foOvalBallDone) window.__foOvalBallDone(); } catch (eD) {}
      board(); pump();
    });
  }

  function ee(s9) { return String(s9 == null ? "" : s9).replace(/[&<>]/g, function (c9) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c9]; }); }
  var whoLast = "";
  // the broadcast lower-third, but on TOP: the two men in the middle right now —
  // the STRIKER (hand + live score + gold batting stars) and the BOWLER (type +
  // live figures + teal bowling stars) as big, prominent cards above the field.
  function whoSync() {
    try {
      var el = document.getElementById("ov-who"); if (!el) return;
      var F = window.foStarsFor;
      var h = "";
      if (F && typeof M !== "undefined" && M && M.innings) {
        var inn = M.innings[M.inns];
        if (inn && inn.bat) {
          var sb = inn.bat[inn.striker], bp = sb && !sb.out && sb.p;
          var bw = null;
          if (inn.curBowlerName && inn.bxi) inn.bxi.forEach(function (p9) { if (p9.name === inn.curBowlerName) bw = p9; });
          var bf = inn.bowlers && inn.curBowlerName && inn.bowlers[inn.curBowlerName];
          var shrt = function (nm9) { var a9 = String(nm9).split(" "); return a9.length > 1 ? a9[0].charAt(0) + ". " + a9.slice(1).join(" ") : nm9; };
          if (bp) {
            var bscore = (sb.r || 0) + "<em>*</em> (" + (sb.b || 0) + ")";
            h += "<span class='ow ow-bat'>" +
              "<span class='owr'>On strike</span>" +
              "<b class='own'>" + ee(shrt(bp.name)) + "<i>" + (bp.hand === "L" ? "LHB" : "RHB") + "</i></b>" +
              "<span class='ows'>" + bscore + "</span>" +
              "<span class='owstars'>" + F.html(F.stars(F.bat(bp))) + "</span></span>";
          }
          if (bw) {
            var fig = bf ? (Math.floor((bf.b || 0) / 6) + "." + ((bf.b || 0) % 6) + "-" + (bf.r || 0) + "-" + (bf.w || 0)) : "";
            h += "<span class='ow owb'>" +
              "<span class='owr'>Bowling</span>" +
              "<b class='own'>" + ee(shrt(bw.name)) + "<i>" + ee(F.btype(bw) || "BOWLING") + "</i></b>" +
              "<span class='ows'>" + ee(fig) + "</span>" +
              "<span class='owstars'>" + F.html(F.stars(F.bowl(bw))) + "</span></span>";
          }
        }
      }
      if (h !== whoLast) { whoLast = h; el.innerHTML = h; }
    } catch (e) {}
  }
  function tick() {
    whoSync();
    try {
      // EXACT path: "#/matches" and "#/matchday" also start with "#/match",
      // and the prefix test used to mount the whole stage on the Matches page
      if ((location.hash || "").split("?")[0] !== "#/match") {
        curField = null;
        var pg0 = document.getElementById("page");
        if (pg0 && pg0.classList.contains("fo-ovalgrid")) pg0.classList.remove("fo-ovalgrid");
        var ov0 = document.getElementById("fo-oval");
        if (ov0) ov0.remove();
        leftMatch = true;   // on return, pick up the live ball — don't replay the gap
        return;
      }
      if (typeof M === "undefined" || !M || !M.log) return;
      var page = document.getElementById("page");
      if (!page) return;
      if (!document.getElementById("fo-oval")) {
        page.insertAdjacentHTML("afterbegin", stageHTML());
        // the engine re-renders #page on every ball, killing the stage; only
        // a genuinely NEW match joins the broadcast from now — a rebuilt
        // stage for the same match keeps its counters so no ball is skipped.
        // But if the viewer navigated AWAY and came back (leftMatch), snap to
        // the live ball: replaying the overs they missed, all at once, felt wrong.
        if (seenM !== M || leftMatch) {
          seenM = M; seenLogLen = M.log.length; seenInn = M.inns; trails = [];
          queue = []; animating = false; leftMatch = false;
        }
        curField = null;
        drawTrails();
      }
      page.classList.add("fo-ovalgrid");
      wireSnd();
      if (M.inns !== seenInn) { seenInn = M.inns; seenLogLen = M.log.length; trails = []; drawTrails(); }
      if (M.log.length > seenLogLen) {
        // engine unshifts: new entries are at the FRONT
        var fresh = M.log.slice(0, M.log.length - seenLogLen);
        seenLogLen = M.log.length;
        for (var i = fresh.length - 1; i >= 0; i--) {
          var s = symOf(fresh[i]);
          if (s) queue.push({ sym: s, ix: seenLogLen - i,
            lbl: (fresh[i].ev && fresh[i].ev.pos) || null,
            dir: (fresh[i].ev && fresh[i].ev.dir != null) ? fresh[i].ev.dir : null,
            // the engine's OWN landing coordinates for this ball — the map is
            // drawn to these, never to a decorative guess
            ex: (fresh[i].ev && fresh[i].ev.x != null) ? fresh[i].ev.x : null,
            ey: (fresh[i].ev && fresh[i].ev.y != null) ? fresh[i].ev.y : null,
            fld: (fresh[i].ev && fresh[i].ev.fldNm) || null,
            wk: s === "W" ? fresh[i].out : null,
            no: fresh[i].no || "",
            reg: (fresh[i].ev && fresh[i].ev.region) || "" });
          else if (fresh[i].mile) {   // milestone lines become on-field moments
            var mt = fresh[i].txt || "";
            if (/HUNDRED|CENTURY/i.test(mt)) queue.push({ pop: "HUNDRED!", col: "#C8674A" });
            else if (/FIFTY/i.test(mt)) queue.push({ pop: "FIFTY!", col: "#C9A24B" });
          }
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
      "#fo-oval{max-width:640px;margin:0 auto 14px;background:#0F1A2E;border:1px solid #24334f;border-radius:14px;overflow:hidden;position:relative}" +
      // the prominent broadcast cards, on top, on the navy header ground
      ".ov-who{display:flex;gap:9px;padding:11px 11px 9px;background:#0F1A2E;pointer-events:none}" +
      ".ov-who:empty{display:none}" +
      ".ov-who .ow{flex:1 1 0;min-width:0;background:linear-gradient(180deg,#1d2c4d,#16233d);border:1px solid #2b3c60;border-left:4px solid #D9A441;border-radius:12px;padding:9px 13px;display:flex;flex-direction:column;gap:3px;box-shadow:0 3px 10px rgba(9,15,28,.35)}" +
      ".ov-who .ow.owb{border-left-color:#14C0CE}" +
      ".ov-who .owr{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#8ea0c0;font-weight:800}" +
      ".ov-who .own{font-size:18px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.1;letter-spacing:.1px}" +
      ".ov-who .own i{font-style:normal;font-size:9.5px;font-weight:800;color:#aeb9d0;margin-left:7px;letter-spacing:.06em;vertical-align:middle}" +
      ".ov-who .ows{font-size:15px;font-weight:800;color:#eef2fa;font-variant-numeric:tabular-nums;letter-spacing:.3px}" +
      ".ov-who .ows em{font-style:normal;color:#C8674A;font-weight:800}" +
      ".ov-who .owstars{font-size:13px;letter-spacing:1.2px;line-height:1;white-space:nowrap}" +
      ".ov-who .owstars .st{text-decoration:none}" +
      ".ov-who .owstars em{font-style:normal;color:#394561}" +
      ".ov-who .ow-bat .owstars em.f{color:#F0B94E}" +
      ".ov-who .ow-bat .owstars em.h{background:linear-gradient(90deg,#F0B94E 50%,#394561 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
      ".ov-who .owb .owstars em.f{color:#22D3E0}" +
      ".ov-who .owb .owstars em.h{background:linear-gradient(90deg,#22D3E0 50%,#394561 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
      "@media(max-width:520px){.ov-who .own{font-size:16px}.ov-who .ows{font-size:13.5px}.ov-who .ow{padding:8px 11px}}" +
      // the board's small striker/bowler text is now the big cards' job
      ".ov-board .ov-bats,.ov-board .ov-bowl{display:none}" +
      // the engine's raw main column duplicates the scoreboard + commentary the
      // tab shell already presents - dead weight below the fold on desktop, a
      // visible duplicate on mobile
      "html body #page.fo-ovalgrid .mc-main{display:none!important}" +   // !important: a legacy visible-fix rule forces display:block!important
      "@media(min-width:1020px){" +
      // Generic split: oval left, everything else right. Used on match pages
      // that don't carry the overlay's own .fo-matchpage grid.
      "html body #page.fo-ovalgrid{display:grid;grid-template-columns:minmax(430px,46%) minmax(0,1fr);gap:0 20px;align-items:start}" +
      "html body #page.fo-ovalgrid #fo-oval{grid-column:1;grid-row:1/span 40;position:sticky;top:64px;max-width:none;margin:0}" +
      "html body #page.fo-ovalgrid:not(.fo-matchpage)>*:not(#fo-oval){grid-column:2}" +
      // Match centre: the overlay lays #page out as a named-area grid
      // (mlinks|mbody|mside). Re-template it: the oval fills the left half
      // with scoreboard + match details tucked under it, while the right
      // half is all reading — crumb, tab links, then full-height commentary.
      // crumb and tab bar span the full width; the oval and the commentary
      // panel then open on the same row, flush at the top
      "html body #page.fo-ovalgrid.fo-matchpage{grid-template-columns:minmax(500px,55%) minmax(0,1fr);grid-template-rows:auto auto auto auto 1fr;grid-template-areas:'mcrumb mcrumb' 'mlinks mlinks' 'moval mbody' 'mtop mbody' 'mrest mbody'}" +
      "html body #page.fo-ovalgrid.fo-matchpage #fo-oval{grid-area:moval;position:relative;top:0}" +   // relative anchors the .ov-who cards; top:0 undoes the generic split's sticky top:64px (which was pushing the stage 64px below the scorecard header)
      "html body #page.fo-ovalgrid.fo-matchpage>.crumb{grid-area:mcrumb;margin:0 0 10px}" +
      // the scoreboard + match-details cards under the stage are RETIRED: the
      // stage's own board and the Scorecard/Details tabs carry everything
      "html body #page.fo-ovalgrid .mc-top{display:none !important}" +
      // tab links: one tight pill row in the UI face, not the roomy sidebar list
      "html body #page.fo-ovalgrid.fo-matchpage .ftp-match-links{grid-area:mlinks;display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:4px;padding:5px;margin:0 0 14px;position:static}" +
      "html body #page.fo-ovalgrid.fo-matchpage .ftp-match-links h4{display:none}" +
      "html body #page.fo-ovalgrid.fo-matchpage .ftp-match-links a{white-space:nowrap;font-family:Inter,-apple-system,'Segoe UI',sans-serif !important;font-size:12.5px !important;font-weight:600;line-height:1.2;letter-spacing:0;padding:8px 14px !important;border:none !important;border-radius:8px}" +
      "html body #page.fo-ovalgrid.fo-matchpage .ftp-match-body{grid-area:mbody;min-width:0;margin:0}" +
      "html body #page.fo-ovalgrid.fo-matchpage .ftp-match-body>.panel:first-child,html body #page.fo-ovalgrid.fo-matchpage .ftp-match-body>:first-child{margin-top:0 !important}" +
      "html body #page.fo-ovalgrid.fo-matchpage .ftp-match-body .commfeed,html body #page.fo-ovalgrid.fo-matchpage .ftp-match-body #ftpcomm{max-height:calc(100vh - 280px) !important;min-height:46vh !important}" +
      // the engine's full-screen FOUR/SIX/WICKET splash straddles the column
      // seam on the split stage, and the oval pops the same event on-field
      "body:has(#page.fo-ovalgrid) .bigflash{display:none}" +
      "}" +
      // Mobile: stack as menu -> oval -> crumb -> scoreboard -> commentary.
      // The tab shell dissolves (display:contents) so the pill menu can sit
      // above the animation while the body keeps its place below.
      "@media(max-width:1019.98px){" +
      "html body #page.fo-ovalgrid{display:flex;flex-direction:column}" +
      "html body #page.fo-ovalgrid .ftp-match-shell{display:contents}" +
      "html body #page.fo-ovalgrid .ftp-match-links{order:-3;display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:4px;padding:5px;margin:0 0 10px;position:static}" +
      "html body #page.fo-ovalgrid .ftp-match-links h4{display:none}" +
      "html body #page.fo-ovalgrid .ftp-match-links a{white-space:nowrap;font-size:12.5px !important;font-weight:600;line-height:1.2;padding:8px 12px !important;border:none !important;border-radius:8px}" +
      "html body #page.fo-ovalgrid #fo-oval{order:-2}" +
      "html body #page.fo-ovalgrid>.crumb{order:-1;margin:0 0 8px}" +
      // cap the feed so the page stops growing every ball (the growth shoved
      // everything below down a row per delivery - read as a page refresh)
      "html body #page.fo-ovalgrid .ftp-match-body .commfeed,html body #page.fo-ovalgrid .ftp-match-body #ftpcomm{max-height:56vh!important;overflow-y:auto!important}" +
      "}" +
      // a freshly-inserted commentary row grows in smoothly instead of
      // teleporting the rows below it
      ".fo-teamtalk{display:flex;flex-wrap:wrap;align-items:center;gap:6px;background:#14213D;border-radius:10px;padding:8px 10px;margin:0 0 8px}" +
      ".fo-teamtalk .tt-l{flex-basis:100%;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#b9c2d4}" +
      ".fo-teamtalk .tt-b{border:1px solid #33415e;background:#1f2d4a;color:#dfe5f0;border-radius:8px;padding:7px 13px;font-size:12.5px;font-weight:600;cursor:pointer}" +
      ".fo-teamtalk .tt-b.on{background:#C8674A;border-color:#C8674A;color:#fff}" +
      ".fo-rowin{animation:foRowIn .38s ease;overflow:hidden}" +
      "@keyframes foRowIn{0%{opacity:0;max-height:0}100%{opacity:1;max-height:200px}}" +
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
      ".ov-flbl{font:600 7px Inter,-apple-system,sans-serif;fill:rgba(241,234,218,.78);letter-spacing:.05em;text-anchor:middle;text-transform:uppercase}" +
      ".ov-fplr{font:600 6.5px Inter,-apple-system,sans-serif;fill:rgba(241,234,218,.5);text-anchor:middle}" +
      ".ov-f.f-hi circle{fill:#C9A24B}.ov-f.f-hi .ov-fplr{fill:#F3D37A}" +
      ".ov-f.f-ok circle{fill:#1F6E74}.ov-f.f-ok .ov-fplr{fill:#7fd7de}" +
      ".ov-f.f-lo circle{fill:#7B3B2E}.ov-f.f-lo .ov-fplr{fill:#e0937f}" +
      ".ov-f.ov-hot circle{animation:ovHot .9s ease}" +
      ".ov-f.ov-hotw circle{animation:ovHotW .9s ease}" +
      "@keyframes ovHot{0%{stroke:#C9A24B;stroke-width:1.2}35%{stroke:#C9A24B;stroke-width:5.5}100%{stroke:#fff;stroke-width:1.2}}" +
      "@keyframes ovHotW{0%{stroke:#e04b3a;stroke-width:1.2}35%{stroke:#e04b3a;stroke-width:6}100%{stroke:#fff;stroke-width:1.2}}" +
      ".ov-pop{font-family:Oswald,sans-serif;font-size:30px;letter-spacing:4px;font-weight:600;opacity:0;paint-order:stroke;stroke:#0F1A2E;stroke-width:4px}" +
      ".ov-pop.on{animation:ovPop 1.05s ease}" +
      "@keyframes ovPop{0%{opacity:0;transform:scale(.6)}18%{opacity:1;transform:scale(1.12)}70%{opacity:1;transform:scale(1)}100%{opacity:0}}" +
      // delivery grammar: pitch pulse, boundary ripple, dismissal detail, lbw ray
      ".ov-pit{fill:none;stroke:#f5efdd;stroke-width:1.4;transform-box:fill-box;transform-origin:center;animation:ovPit .6s ease-out forwards}" +
      "@keyframes ovPit{0%{opacity:.9;transform:scale(.6)}100%{opacity:0;transform:scale(3)}}" +
      ".ov-rip{fill:none;stroke-width:2;transform-box:fill-box;transform-origin:center;animation:ovRip .85s ease-out forwards}" +
      ".ov-rip.big{stroke-width:2.6;animation-duration:1s}" +
      "@keyframes ovRip{0%{opacity:.95;transform:scale(.7)}100%{opacity:0;transform:scale(4.4)}}" +
      ".ov-pop2{font-family:Oswald,sans-serif;font-size:11px;letter-spacing:2.6px;font-weight:600;fill:#F1EADA;text-transform:uppercase;opacity:0;paint-order:stroke;stroke:#0F1A2E;stroke-width:3px}" +
      ".ov-pop2.on{animation:ovPop 1.45s ease}" +
      ".ov-lbw{stroke:#e04b3a;stroke-width:1.6;stroke-dasharray:3 3;animation:ovLbw .7s ease forwards}" +
      "@keyframes ovLbw{0%{opacity:0}30%{opacity:1}100%{opacity:0}}" +
      "@media(prefers-reduced-motion:reduce){.ov-pit,.ov-rip,.ov-lbw{animation:none;opacity:0}}" +
      ".ov-note{display:flex;align-items:center;justify-content:flex-end;gap:8px;text-align:right;font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:#5b6a85;padding:3px 10px 5px}" +
      ".ov-snd{background:none;border:1px solid #24334f;border-radius:7px;color:#8fa0bd;font-size:12px;line-height:1;padding:3px 7px;cursor:pointer;margin-right:auto}" +
      ".ov-need{font-family:Oswald,sans-serif;font-size:13px;letter-spacing:1.5px;color:#fff;background:#a3242b;border-radius:8px;padding:3px 10px;display:none}" +
      ".ov-need.on{display:inline-block;animation:ovNeed 1.1s ease infinite}" +
      "@keyframes ovNeed{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.06);opacity:.85}}" +
      "@media(prefers-reduced-motion:reduce){.ov-pop.on{animation:none;opacity:1}}";
    document.head.appendChild(st);
  }

  function init() {
    if (typeof window === "undefined") return;
    css();
    setInterval(tick, 300);
  }

  return { init: init, tick: tick, symOf: symOf, angleFor: angleFor,
    __test: { placeField: placeField, trailCount: function () { return trails.length; } } };
})();
