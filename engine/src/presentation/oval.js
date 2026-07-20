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
      "<span class='ov-need' id='ov-need'></span>" +
      "<div class='ov-strip' id='ov-strip' aria-label='This over'></div>" +
      "</div>" +
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
      "</svg><div class='ov-who' id='ov-who'></div><div class='ov-note'><button type='button' id='ov-snd' class='ov-snd' title='Match sound'>&#128263;</button><span>theatre · live directions · real field setting</span></div></div>";
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

  // render an engine field state (foFieldState): spots arrive with labels
  // and already-mirrored coordinates
  function placeField(st) {
    var g = document.getElementById("ov-field"); if (!g) return;
    if (!g.childNodes.length) {
      var h = "";
      for (var i = 0; i < 9; i++) {
        h += "<g class='ov-f' style='transition:transform .9s ease' transform='translate(200,130)'>" +
          "<circle r='4' fill='#1f4d3a' stroke='#fff' stroke-width='1.2'/>" +
          "<text y='12' class='ov-flbl'></text></g>";
      }
      g.innerHTML = h;
    }
    // the attacking template has one unlabeled second slip; rebuild the
    // full 9-spot list from the engine template so the dot count stays 9
    var raw = (st.setting === "att" && st.spin) ? FO_FIELDS.attSpin : (FO_FIELDS[st.setting] || FO_FIELDS.bal);
    var cs = g.childNodes;
    for (var j = 0; j < cs.length && j < raw.length; j++) {
      var x = st.lhb ? 400 - raw[j][0] : raw[j][0], y = raw[j][1];
      cs[j].setAttribute("transform", "translate(" + x + "," + y + ")");
      var t = cs[j].querySelector("text");
      if (t) t.textContent = raw[j][2] || "";
    }
    var chip = document.getElementById("ov-fld");
    if (chip) {
      var LBL = { att: "attacking", bal: "balanced", def: "defensive" };
      chip.textContent = "field: " + (LBL[st.setting] || st.setting) +
        (st.setting === "att" && st.spin ? " · spin" : "");
      chip.className = "ov-fld f-" + st.setting;
    }
    curField = st.setting + (st.lhb ? "|L" : "|R") + (st.spin ? "|S" : "|P");
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
        var key = st.setting + (st.lhb ? "|L" : "|R") + (st.spin ? "|S" : "|P");
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
  function animate(sym, ballIx, done, lbl, dirDeg) {
    var svg = document.querySelector("#fo-oval .ov-svg");
    var ball = document.getElementById("ov-ball");
    var pop = document.getElementById("ov-pop");
    if (!svg || !ball) { done(); return; }
    if (reduced()) { flashPop(sym, pop); done(); return; }
    var spot = spotFor(lbl);   // the fielder the commentary actually named
    // delivery: bowler end (200,190) to the striker (200,88)
    ball.setAttribute("opacity", "1");
    slide(ball, 200, 190, 200, 92, 220, function () {
      if (sym === "W") {
        if (spot) {
          // caught (or run out) at a named position: the ball travels there
          slide(ball, 200, 92, spot.x, spot.y, 430, function () {
            pulseDot(spot.g, true); flashPop("OUT", pop, "#a3242b"); foSnd("W");
            setTimeout(function () { ball.setAttribute("opacity", "0"); done(); }, 620);
          });
        } else {
          shatter(); flashPop("OUT", pop, "#a3242b"); foSnd("W");
          setTimeout(function () { ball.setAttribute("opacity", "0"); done(); }, 620);
        }
        return;
      }
      if (sym === "·" || sym === "+") {
        if (sym === "·" && spot) {
          // defended or driven straight to the named fielder
          slide(ball, 200, 92, spot.x, spot.y, 300, function () {
            pulseDot(spot.g);
            setTimeout(function () { ball.setAttribute("opacity", "0"); done(); }, 180);
          });
        } else {
          setTimeout(function () { ball.setAttribute("opacity", "0"); if (sym === "+") flashPop("extra", pop, "#5b6472"); done(); }, 160);
        }
        return;
      }
      // a scoring shot: real direction when the line names a position,
      // seeded decoration otherwise
      var a = spot ? Math.atan2(spot.y - 130, spot.x - 200) : (dirDeg != null ? dirDeg * Math.PI / 180 : angleFor(ballIx, sym));
      var dist = sym === "6" ? 1.06 : sym === "4" ? 0.97 : 0.45 + ((ballIx % 3) * 0.1);
      var tx = 200 + Math.cos(a) * 186 * dist;
      var ty = 130 + Math.sin(a) * 116 * dist;
      var runs = sym === "4" ? 0 : sym === "6" ? 0 : parseInt(sym, 10) || 0;
      if (runs && spot) { tx = spot.x; ty = spot.y; }
      if (runs) { swapRunners(runs); foSnd("run"); }
      slide(ball, 200, 92, tx, ty, sym === "6" ? 560 : 440, function () {
        if (sym === "4") { flashPop("FOUR", pop, "#C9A24B"); foSnd("4"); }
        if (sym === "6") { flashPop("SIX", pop, "#C8674A"); foSnd("6"); }
        else if (spot) pulseDot(spot.g);
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
      }, 520);
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
      setTimeout(function () { animating = false; board(); pump(); }, 950);
      return;
    }
    animate(next.sym, next.ix, function () { animating = false; board(); pump(); }, next.lbl, next.dir);
  }

  function ee(s9) { return String(s9 == null ? "" : s9).replace(/[&<>]/g, function (c9) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c9]; }); }
  var whoLast = "";
  // who's on: striker (hand + gold batting stars) and bowler (type + blue
  // bowling stars) as small cards over the top corners of the oval
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
          var shrt = function (nm9) { var a9 = String(nm9).split(" "); return a9.length > 1 ? a9[0].charAt(0) + ". " + a9.slice(1).join(" ") : nm9; };
          if (bp) h += "<span class='ow'><b>" + ee(shrt(bp.name)) + "<i>" + (bp.hand === "L" ? "LHB" : "RHB") + "</i></b>" + F.html(F.stars(F.bat(bp))) + "</span>";
          if (bw) h += "<span class='ow owb'><b>" + ee(shrt(bw.name)) + "<i>" + ee(F.btype(bw) || "BOWLING") + "</i></b>" + F.html(F.stars(F.bowl(bw))) + "</span>";
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
        return;
      }
      if (typeof M === "undefined" || !M || !M.log) return;
      var page = document.getElementById("page");
      if (!page) return;
      if (!document.getElementById("fo-oval")) {
        page.insertAdjacentHTML("afterbegin", stageHTML());
        // the engine re-renders #page on every ball, killing the stage; only
        // a genuinely NEW match joins the broadcast from now — a rebuilt
        // stage for the same match keeps its counters so no ball is skipped
        if (seenM !== M) { seenM = M; seenLogLen = M.log.length; seenInn = M.inns; trails = []; }
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
            dir: (fresh[i].ev && fresh[i].ev.dir != null) ? fresh[i].ev.dir : null });
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
      ".ov-who{display:flex;justify-content:space-between;gap:8px;padding:2px 8px 4px;pointer-events:none}" +
      ".ov-who:empty{display:none}" +
      ".ov-who .ow{background:rgba(255,254,250,.94);border:1px solid rgba(28,36,51,.16);border-radius:9px;padding:4px 9px;display:flex;flex-direction:column;gap:2px;max-width:47%;box-shadow:0 2px 6px rgba(16,27,45,.18)}" +
      ".ov-who .ow b{font-size:10.5px;font-weight:800;color:#14213D;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".ov-who .ow b i{font-style:normal;font-size:7px;color:#8a93a3;font-weight:800;margin-left:5px;letter-spacing:.05em;text-transform:uppercase}" +
      ".ov-who .ow .st{text-decoration:none;font-size:8.5px;letter-spacing:.5px;line-height:1;white-space:nowrap}" +
      ".ov-who .ow .st em{font-style:normal;color:#ddd8ca}" +
      ".ov-who .ow .st em.f{color:#D9A441}" +
      ".ov-who .ow .st em.h{background:linear-gradient(90deg,#D9A441 50%,#ddd8ca 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
      ".ov-who .ow.owb .st em.f{color:#2E7BD1}" +
      ".ov-who .ow.owb .st em.h{background:linear-gradient(90deg,#2E7BD1 50%,#ddd8ca 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
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
      "html body #page.fo-ovalgrid.fo-matchpage #fo-oval{grid-area:moval;position:relative}" +   // relative (not static): the sticky reset must keep anchoring the .ov-who cards
      "html body #page.fo-ovalgrid.fo-matchpage>.crumb{grid-area:mcrumb;margin:0 0 10px}" +
      "html body #page.fo-ovalgrid.fo-matchpage .mc-top{grid-area:mtop;display:flex !important;flex-direction:row !important;align-items:stretch !important;gap:10px;margin:10px 0 0}" +
      "html body #page.fo-ovalgrid.fo-matchpage .mc-top .panel{flex:1 1 0 !important;min-width:0;margin:0;height:auto}" +
      // compact the two cards so the stage keeps the vertical room
      "html body #page.fo-ovalgrid.fo-matchpage .mc-top h4{font-size:10.5px !important;padding:5px 10px !important;letter-spacing:.07em}" +
      "html body #page.fo-ovalgrid.fo-matchpage .mc-score .pad,html body #page.fo-ovalgrid.fo-matchpage .mc-details .pad{padding:6px 10px !important;font-size:11.5px !important;line-height:1.45}" +
      "html body #page.fo-ovalgrid.fo-matchpage .mc-score .scorebig{font-size:20px !important}" +
      "html body #page.fo-ovalgrid.fo-matchpage .mc-top .kv td{padding:2px 6px !important;font-size:11px !important;line-height:1.35}" +
      "html body #page.fo-ovalgrid.fo-matchpage .mc-details table.kv{font-size:11px !important}" +
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
      ".ov-f.ov-hot circle{animation:ovHot .9s ease}" +
      ".ov-f.ov-hotw circle{animation:ovHotW .9s ease}" +
      "@keyframes ovHot{0%{stroke:#C9A24B;stroke-width:1.2}35%{stroke:#C9A24B;stroke-width:5.5}100%{stroke:#fff;stroke-width:1.2}}" +
      "@keyframes ovHotW{0%{stroke:#e04b3a;stroke-width:1.2}35%{stroke:#e04b3a;stroke-width:6}100%{stroke:#fff;stroke-width:1.2}}" +
      ".ov-pop{font-family:Oswald,sans-serif;font-size:30px;letter-spacing:4px;font-weight:600;opacity:0;paint-order:stroke;stroke:#0F1A2E;stroke-width:4px}" +
      ".ov-pop.on{animation:ovPop 1.05s ease}" +
      "@keyframes ovPop{0%{opacity:0;transform:scale(.6)}18%{opacity:1;transform:scale(1.12)}70%{opacity:1;transform:scale(1)}100%{opacity:0}}" +
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
