// ---- 22-time-machine.js — The Time Machine -----------------------------------
// The engine is deterministic and every result in the book keeps its seed,
// pitch and weather. That is a time machine waiting to be built: any played
// match can be re-entered and forked.
//
// Two instruments:
//   REPLAY THE DAY — the same afternoon run twelve more times on perturbed
//   seeds. How often does the real winner still win? A luck meter for
//   history, computed by Monte Carlo in the browser.
//   THE ONE CHANGE — flip who batted first, or hand the groundsman a
//   different pitch, and re-run the day on the ORIGINAL seed. The alternate
//   is compared against a baseline replay (same seed, no change), so the
//   difference you see is caused by the lever alone.
//
// Sandboxed to the bone: each ghost sim swaps the global match object out,
// stubs onMatchEnd (the only path to saveMatch), runs the real engine loop,
// and restores everything in a finally. The shared record is never touched -
// this is analysis, not play, so offline-fairness is untouched by design.
(function () {
  "use strict";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function ready() { return typeof App !== "undefined" && App && typeof GD !== "undefined" && GD && GD.teams && typeof newMatch === "function" && typeof stepBall === "function"; }
  function q(name) { var m = new RegExp("[?&]" + name + "=([^&]+)").exec(location.hash || ""); return m ? decodeURIComponent(m[1]) : null; }
  var PITCH_NM = { balanced: "True surface", flat: "Flat road", green: "Green seamer", dry: "Dry turner", slow: "Slow & low", cracked: "Cracked", twoPaced: "Two-paced" };

  // ---- the ghost chamber -----------------------------------------------------
  // one full match, run headless on the real engine, leaving no footprint
  function ghostSim(o) {
    var pM = null, pToss = null, pEnd = null, pUB, pInt, pFld;
    try { pM = M; } catch (e) {}
    try { pToss = App.tossState; } catch (e) {}
    pEnd = window.onMatchEnd;
    try { pUB = UI.userBowler; pInt = UI.intent; pFld = UI.field; } catch (e) {}
    window.onMatchEnd = function () {};
    try {
      M = newMatch(GD.teams[o.aIx], GD.teams[o.bIx], o.pitch, o.seed >>> 0 || 1);
      M.meta = { home: GD.teams[o.aIx].name, away: GD.teams[o.bIx].name, ground: o.ground || "", weather: o.weather || "Sunny", comp: "ghost" };
      M.isUserMatch = false;
      try { M.ordersMap = (typeof mpOrdersMap === "function") ? mpOrdersMap(o.aIx, o.bIx) : {}; } catch (eO) { M.ordersMap = {}; }
      App.tossState = { stage: "x" };
      var aBats = aiTossDecision();
      applyToss(o.flip ? !aBats : aBats);
      var g = 0;
      while (!M.done && g++ < 3000) { autoPick(); stepBall(); }
      return {
        result: M.result || null,
        batFirst: M.batFirstTeam,
        inns: (M.innings || []).map(function (inn) {
          return inn ? { team: inn.batTeam, runs: inn.runs, wkts: inn.wkts, ov: (inn.legal / 6) } : null;
        }),
        worm: M.worm
      };
    } catch (e) { return null; }
    finally {
      try { M = pM; } catch (e2) {}
      try { App.tossState = pToss; } catch (e3) {}
      window.onMatchEnd = pEnd;
      try { UI.userBowler = pUB; UI.intent = pInt; UI.field = pFld; } catch (e4) {}
    }
  }
  // jobs run one per frame so a dozen timelines never freeze the page
  function runQueue(jobs, onStep, onDone) {
    var i = 0, out = [];
    (function tick() {
      if (i >= jobs.length) { onDone(out); return; }
      out.push(jobs[i]());
      i++;
      onStep(i, jobs.length);
      setTimeout(tick, 16);
    })();
  }

  // ---- prose -----------------------------------------------------------------
  function scoreline(g) {
    if (!g || !g.inns || !g.inns[0]) return "no play";
    var a = g.inns[0], b = g.inns[1];
    var s = E(a.team) + " " + a.runs + "/" + a.wkts;
    if (b) s += " &middot; " + E(b.team) + " " + b.runs + "/" + b.wkts;
    return s;
  }
  function luckLine(realWinner, k, n, my) {
    var share = k / n;
    if (realWinner == null) return "A tie in the record book, and the reruns cannot agree either - some afternoons are simply owed to nobody.";
    var w = E(realWinner);
    if (share >= 0.75) return w + " win " + k + " of " + n + " rerun afternoons. That result was never in doubt - the better side won, whatever the coin did.";
    if (share >= 0.45) return w + " win " + k + " of " + n + " reruns. A fair result on a fair day - but this fixture could have gone either way.";
    if (share >= 0.25) return w + " win only " + k + " of " + n + " reruns. The record book is kind to them - most timelines tell a different story" + (my === realWinner ? "." : " - including several of yours.");
    return w + " win just " + k + " of " + n + " rerun afternoons. Daylight robbery, preserved forever in the scorebook.";
  }
  function divergeLine(base, alt, lever) {
    if (!base || !alt || !base.result || !alt.result) return "";
    var bw = base.result.winner, aw = alt.result.winner;
    var b1 = base.inns[0], a1 = alt.inns[0];
    var bits = [];
    if (bw !== aw) bits.push("<b>The " + lever + " flips the match.</b> " + (aw ? E(aw) + " win the day instead" : "It ends in a tie"));
    else bits.push("<b>Same winner, different road.</b> " + (bw ? E(bw) + " still win" : "Still a tie") + " - the " + lever + " changes the story, not the ending");
    if (b1 && a1) {
      var d = a1.runs - b1.runs;
      if (Math.abs(d) >= 25) bits.push("the first innings moves " + (d > 0 ? "up" : "down") + " by " + Math.abs(d) + " runs");
    }
    bits.push("alternate verdict: <i>" + E((alt.result && alt.result.text) || "") + "</i>");
    return bits.join("; ") + ".";
  }

  // ---- the worm overlay ------------------------------------------------------
  function drawWorms(cv, base, alt) {
    try {
      var dpr = window.devicePixelRatio || 1;
      var W = cv.clientWidth || 600, H = 210;
      cv.width = W * dpr; cv.height = H * dpr;
      var c = cv.getContext("2d"); c.scale(dpr, dpr);
      var series = [];
      var add = function (g, dash) {
        if (!g || !g.worm) return;
        g.worm.forEach(function (w, i) {
          if (w && w.length) series.push({ pts: w, dash: dash, inn: i });
        });
      };
      add(base, null); add(alt, [6, 5]);
      var mxR = 60, mxO = 50;
      series.forEach(function (s) { s.pts.forEach(function (p) { if (p[1] > mxR) mxR = p[1]; if (p[0] > mxO) mxO = p[0]; }); });
      mxR = Math.ceil(mxR / 50) * 50;
      var L = 34, R = 8, T = 8, B = 22;
      var x = function (ov) { return L + (ov / mxO) * (W - L - R); };
      var y = function (r) { return T + (1 - r / mxR) * (H - T - B); };
      // grid
      c.strokeStyle = "rgba(20,28,40,.1)"; c.lineWidth = 1; c.font = "10px Inter,sans-serif"; c.fillStyle = "rgba(20,28,40,.45)";
      for (var rr = 0; rr <= mxR; rr += 50) { c.beginPath(); c.moveTo(L, y(rr)); c.lineTo(W - R, y(rr)); c.stroke(); c.fillText(rr, 6, y(rr) + 3); }
      for (var oo = 0; oo <= mxO; oo += 10) { c.beginPath(); c.moveTo(x(oo), T); c.lineTo(x(oo), H - B); c.stroke(); c.fillText(oo, x(oo) - 5, H - 8); }
      var COL = ["#26436B", "#C95532"];
      series.forEach(function (s) {
        c.beginPath();
        c.setLineDash(s.dash || []);
        c.strokeStyle = COL[s.inn] || "#26436B";
        c.globalAlpha = s.dash ? 0.85 : 1;
        c.lineWidth = s.dash ? 1.6 : 2.2;
        s.pts.forEach(function (p, i) { var px = x(p[0]), py = y(p[1]); if (i === 0) c.moveTo(px, py); else c.lineTo(px, py); });
        c.stroke();
        // wickets
        c.setLineDash([]);
        s.pts.forEach(function (p, i) {
          if (i > 0 && p[2] > s.pts[i - 1][2]) {
            c.beginPath(); c.arc(x(p[0]), y(p[1]), s.dash ? 2.2 : 2.8, 0, 7);
            c.fillStyle = s.dash ? "rgba(20,28,40,.45)" : "#A72F2F"; c.fill();
          }
        });
        c.globalAlpha = 1;
      });
    } catch (e) {}
  }

  // ---- the page --------------------------------------------------------------
  var lastOut = null; // survives re-renders within a visit
  function foRenderTimeMachinePage() {
    try {
      if (!ready()) return;
      var page = document.getElementById("page"); if (!page) return;
      document.body.classList.remove("fo-scb-on", "fo-drs-on", "fo-mr-on");
      var ix = parseInt(q("i"), 10);
      var rec = App.results && App.results[ix];
      var my = null; try { my = userTeam().name; } catch (e) {}
      if (!rec || !rec.result) {
        page.innerHTML = "<div class='fo-tm'><div class='fo-tm-mast'><div class='fo-tm-kick'>The long room</div><h1>The Time Machine</h1>" +
          "<p>Pick any played match from a report or the match centre, and the machine will re-enter that afternoon.</p>" +
          "<div class='fo-tm-foot'><a href='#/scorecard'>Match centre &rsaquo;</a></div></div></div>";
        return;
      }
      var aIx = -1, bIx = -1;
      GD.teams.forEach(function (t, i) { if (t.name === rec.home) aIx = i; if (t.name === rec.away) bIx = i; });
      var canSim = aIx >= 0 && bIx >= 0;
      var mine = my && (rec.home === my || rec.away === my);

      page.innerHTML =
        "<div class='fo-tm'>" +
        "<div class='fo-tm-mast'>" +
        "<div class='fo-tm-kick'>" + E(rec.date || "") + " &middot; " + E(rec.ground || "") + " &middot; " + E(PITCH_NM[rec.pitch] || rec.pitch || "") + " &middot; seed " + E(String(rec.seed)) + "</div>" +
        "<h1>The Time Machine</h1>" +
        "<div class='fo-tm-real'><b>" + E(rec.home) + " v " + E(rec.away) + "</b><span>" + E(rec.result.text || "") + "</span><u>the recorded history</u></div>" +
        "<p>Every match keeps its seed. Re-run the afternoon as it was, twelve times over to weigh the luck in it - or change exactly one thing and watch the other timeline play out. Nothing here touches the record book.</p>" +
        "</div>" +
        (canSim ?
          "<div class='fo-tm-levers'>" +
          "<button class='fo-tm-lv big' data-lv='mc'><b>Replay the day &times;12</b><span>how much of it was luck?</span></button>" +
          "<button class='fo-tm-lv' data-lv='flip'><b>Flip who bats first</b><span>the other side takes first knock</span></button>" +
          ["green", "dry", "flat", "slow", "balanced"].filter(function (p) { return p !== rec.pitch; }).slice(0, 4).map(function (p) {
            return "<button class='fo-tm-lv' data-lv='pitch' data-p='" + p + "'><b>" + E(PITCH_NM[p]) + "</b><span>the groundsman prepares it differently</span></button>";
          }).join("") +
          "</div>" +
          "<div id='fo-tm-out'></div>"
          : "<div class='fo-tm-gone'>One of these clubs is no longer in the league - the machine cannot rebuild that afternoon.</div>") +
        "<div class='fo-tm-foot'><a href='#/report?i=" + ix + "'>&#8592; The report</a><a href='#/scorecard'>Match centre &rsaquo;</a></div>" +
        "</div>";

      if (!canSim) return;
      var out = document.getElementById("fo-tm-out");
      if (lastOut && lastOut.ix === ix) { out.innerHTML = lastOut.html; redrawStored(); }

      var baseOpts = { aIx: aIx, bIx: bIx, pitch: rec.pitch || "balanced", weather: rec.weather || "Sunny", seed: rec.seed, ground: rec.ground };
      var storedWorms = null;
      function redrawStored() {
        try {
          var cv = document.getElementById("fo-tm-cv");
          if (cv && lastOut && lastOut.worms) drawWorms(cv, lastOut.worms[0], lastOut.worms[1]);
        } catch (e) {}
      }

      function progress(k, n, label) {
        out.innerHTML = "<div class='fo-tm-run'><div class='fo-tm-spin'></div>" + E(label) + " &middot; timeline " + k + " of " + n + "</div>";
      }

      function showMc(runs) {
        runs = runs.filter(Boolean);
        var homeW = 0, awayW = 0, ties = 0, t1 = 0, n = runs.length;
        runs.forEach(function (g) {
          var w = g.result && g.result.winner;
          if (w === rec.home) homeW++; else if (w === rec.away) awayW++; else ties++;
          if (g.inns[0]) t1 += g.inns[0].runs;
        });
        var realW = rec.result.winner;
        var realK = realW === rec.home ? homeW : realW === rec.away ? awayW : ties;
        var hp = Math.round(100 * homeW / n), ap = Math.round(100 * awayW / n);
        var rows = runs.map(function (g, i) {
          var w = g.result && g.result.winner;
          return "<div class='fo-tm-tl" + (w === realW ? "" : " odd") + "'><i>#" + (i + 1) + "</i><b>" + scoreline(g) + "</b><span>" + E((g.result && g.result.text) || "") + "</span></div>";
        }).join("");
        var html =
          "<div class='fo-tm-card'><div class='fo-tm-k'>The luck meter</div>" +
          "<div class='fo-tm-bar'><u style='width:" + hp + "%'></u><s style='width:" + (100 - hp - ap) + "%'></s></div>" +
          "<div class='fo-tm-barlbl'><span>" + E(rec.home) + " " + homeW + "</span>" + (ties ? "<span>ties " + ties + "</span>" : "") + "<span>" + E(rec.away) + " " + awayW + "</span></div>" +
          "<p class='fo-tm-say'>" + luckLine(realW, realK, n, my) + " Average first innings across the timelines: " + Math.round(t1 / n) + ".</p>" +
          "<div class='fo-tm-tls'>" + rows + "</div></div>";
        out.innerHTML = html;
        lastOut = { ix: ix, html: html, worms: null };
      }

      function showWhatIf(base, alt, leverLabel) {
        if (!base || !alt) { out.innerHTML = "<div class='fo-tm-gone'>The machine misfired. Try again.</div>"; return; }
        var html =
          "<div class='fo-tm-card'><div class='fo-tm-k'>One change: " + E(leverLabel) + "</div>" +
          "<div class='fo-tm-duo'>" +
          "<div class='fo-tm-uni'><i>Baseline replay</i><b>" + scoreline(base) + "</b><span>" + E((base.result && base.result.text) || "") + "</span></div>" +
          "<div class='fo-tm-uni alt'><i>" + E(leverLabel) + "</i><b>" + scoreline(alt) + "</b><span>" + E((alt.result && alt.result.text) || "") + "</span></div>" +
          "</div>" +
          "<canvas id='fo-tm-cv'></canvas>" +
          "<div class='fo-tm-leg'><span class='l1'>innings 1</span><span class='l2'>innings 2</span><span class='l3'>dashed = the other timeline</span></div>" +
          "<p class='fo-tm-say'>" + divergeLine(base, alt, leverLabel) + "</p>" +
          "<p class='fo-tm-fine'>Both timelines run on the original seed with today&rsquo;s squads; only the " + E(leverLabel) + " differs, so the gap between them is the cost of that one decision.</p>" +
          "</div>";
        out.innerHTML = html;
        lastOut = { ix: ix, html: html, worms: [base, alt] };
        var cv = document.getElementById("fo-tm-cv");
        if (cv) drawWorms(cv, base, alt);
      }

      page.querySelectorAll(".fo-tm-lv").forEach(function (b) {
        b.addEventListener("click", function () {
          var lv = b.getAttribute("data-lv");
          if (lv === "mc") {
            var jobs = [];
            for (var k = 1; k <= 12; k++) (function (k2) {
              jobs.push(function () { return ghostSim(Object.assign({}, baseOpts, { seed: ((rec.seed >>> 0) * 31 + k2 * 1013904223) >>> 0 })); });
            })(k);
            runQueue(jobs, function (k, n) { progress(k, n, "Replaying the day"); }, showMc);
          } else if (lv === "flip") {
            runQueue([
              function () { return ghostSim(baseOpts); },
              function () { return ghostSim(Object.assign({}, baseOpts, { flip: true })); }
            ], function (k, n) { progress(k, n, "Opening the other timeline"); },
              function (r) { showWhatIf(r[0], r[1], "flipped toss"); });
          } else if (lv === "pitch") {
            var p2 = b.getAttribute("data-p");
            runQueue([
              function () { return ghostSim(baseOpts); },
              function () { return ghostSim(Object.assign({}, baseOpts, { pitch: p2 })); }
            ], function (k, n) { progress(k, n, "Re-laying the square"); },
              function (r) { showWhatIf(r[0], r[1], (PITCH_NM[p2] || p2).toLowerCase()); });
          }
        });
      });
    } catch (e) { try { console.warn("foRenderTimeMachinePage", e); } catch (e2) {} }
  }

  // ---- entry from the match report -------------------------------------------
  function decorateReport() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/report") return;
      var ix = parseInt(q("i"), 10); if (isNaN(ix)) return;
      var foot = document.querySelector(".fo-mr-foot");
      if (!foot || foot.querySelector(".fo-tm-go")) return;
      var a = document.createElement("a");
      a.className = "fo-mr-back fo-tm-go"; a.href = "#/whatif?i=" + ix;
      a.innerHTML = "&#8986; The time machine";
      foot.appendChild(a);
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(decorateReport, 350); setTimeout(decorateReport, 1100); });

  // ---- sheet -----------------------------------------------------------------
  var CSS = [
    "html body #page .fo-tm{max-width:820px;margin:26px auto 44px;padding:0 14px;color:#141C28}",
    "html body #page .fo-tm-mast{background:linear-gradient(150deg,#FFFEFB,#F6F1E4 70%,#EFE8D4) !important;border:1px solid rgba(20,28,40,.1);border-radius:22px;padding:26px 28px 22px;box-shadow:0 22px 50px rgba(30,38,52,.12)}",
    "html body #page .fo-tm-kick,html body #page .fo-tm-k{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#B44A22}",
    "html body #page .fo-tm-mast h1{font-family:Oswald,sans-serif;font-weight:600;font-size:34px;letter-spacing:.04em;text-transform:uppercase;margin:6px 0 10px;color:#141C28}",
    "html body #page .fo-tm-mast p{font:italic 400 13px/1.55 Georgia,serif;color:rgba(20,28,40,.6);margin:10px 0 0;max-width:62ch}",
    "html body #page .fo-tm-real{background:#FFFEFC;border:1px solid rgba(176,132,9,.4);border-radius:14px;padding:12px 16px;display:inline-block}",
    "html body #page .fo-tm-real b{display:block;font:600 15px/1.3 Inter,sans-serif}",
    "html body #page .fo-tm-real span{display:block;font:italic 400 12.5px/1.4 Georgia,serif;color:rgba(20,28,40,.65);margin-top:2px}",
    "html body #page .fo-tm-real u{display:block;text-decoration:none;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#8A6A1F;margin-top:7px}",
    "html body #page .fo-tm-levers{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:9px;margin-top:14px}",
    "html body #page button.fo-tm-lv{text-align:left;background:#FFFEFC !important;border:1px solid rgba(20,28,40,.12) !important;border-radius:13px !important;padding:12px 14px !important;cursor:pointer;color:#141C28 !important;transition:border-color .15s ease,transform .12s ease}",
    "html body #page button.fo-tm-lv:hover{border-color:rgba(217,85,42,.55) !important;transform:translateY(-1px)}",
    "html body #page button.fo-tm-lv b{display:block;font:700 12.5px/1.2 Inter,sans-serif}",
    "html body #page button.fo-tm-lv span{display:block;font:italic 400 11px/1.4 Georgia,serif;color:rgba(20,28,40,.55);margin-top:3px}",
    "html body #page button.fo-tm-lv.big{background:linear-gradient(135deg,#26436B,#173350) !important;color:#fff !important;border-color:#26436B !important}",
    "html body #page button.fo-tm-lv.big b{color:#fff}html body #page button.fo-tm-lv.big span{color:rgba(233,238,246,.7)}",
    "html body #page .fo-tm-card{background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:18px;padding:18px 20px;margin-top:14px;box-shadow:0 8px 22px rgba(30,38,52,.08)}",
    "html body #page .fo-tm-run{display:flex;align-items:center;gap:10px;margin-top:16px;font:600 12.5px/1 Inter,sans-serif;color:rgba(20,28,40,.7)}",
    "html body #page .fo-tm-spin{width:16px;height:16px;border-radius:50%;border:2.5px solid rgba(20,28,40,.15);border-top-color:#C95532;animation:foTmSpin .7s linear infinite}",
    "@keyframes foTmSpin{to{transform:rotate(360deg)}}",
    "html body #page .fo-tm-bar{display:flex;height:14px;border-radius:8px;overflow:hidden;background:#C95532;margin-top:12px}",
    "html body #page .fo-tm-bar u{display:block;background:#26436B}html body #page .fo-tm-bar s{display:block;background:rgba(20,28,40,.25)}",
    "html body #page .fo-tm-barlbl{display:flex;justify-content:space-between;font:600 11px/1 Inter,sans-serif;color:rgba(20,28,40,.65);margin-top:6px}",
    "html body #page .fo-tm-say{font:400 13.5px/1.6 Inter,sans-serif;color:rgba(20,28,40,.82);margin:12px 0 0}",
    "html body #page .fo-tm-say b{color:#141C28}",
    "html body #page .fo-tm-fine{font:italic 400 11.5px/1.5 Georgia,serif;color:rgba(20,28,40,.5);margin:10px 0 0}",
    "html body #page .fo-tm-tls{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:5px 16px}",
    "html body #page .fo-tm-tl{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;border-bottom:1px solid rgba(20,28,40,.06);padding:6px 0}",
    "html body #page .fo-tm-tl i{font:700 10px/1.5 Inter,sans-serif;color:rgba(20,28,40,.4);font-style:normal}",
    "html body #page .fo-tm-tl b{font:600 11.5px/1.35 Inter,sans-serif;color:#141C28}",
    "html body #page .fo-tm-tl span{grid-column:2;font:italic 400 10.5px/1.3 Georgia,serif;color:rgba(20,28,40,.55)}",
    "html body #page .fo-tm-tl.odd b{color:#B44A22}",
    "html body #page .fo-tm-duo{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}",
    "html body #page .fo-tm-uni{border:1px solid rgba(20,28,40,.12);border-radius:13px;padding:12px 14px}",
    "html body #page .fo-tm-uni.alt{border-color:rgba(217,85,42,.5);background:rgba(232,102,60,.05)}",
    "html body #page .fo-tm-uni i{display:block;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(20,28,40,.45);font-style:normal;margin-bottom:6px}",
    "html body #page .fo-tm-uni.alt i{color:#B44A22}",
    "html body #page .fo-tm-uni b{display:block;font:600 13.5px/1.35 Inter,sans-serif}",
    "html body #page .fo-tm-uni span{display:block;font:italic 400 11.5px/1.4 Georgia,serif;color:rgba(20,28,40,.6);margin-top:3px}",
    "html body #page #fo-tm-cv{width:100%;height:210px;display:block;margin-top:14px;background:#FDFCF7;border:1px solid rgba(20,28,40,.08);border-radius:12px}",
    "html body #page .fo-tm-leg{display:flex;gap:14px;font:600 10px/1 Inter,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:rgba(20,28,40,.55);margin-top:7px}",
    "html body #page .fo-tm-leg .l1:before,html body #page .fo-tm-leg .l2:before{content:'';display:inline-block;width:16px;height:3px;border-radius:2px;margin-right:5px;vertical-align:2px}",
    "html body #page .fo-tm-leg .l1:before{background:#26436B}html body #page .fo-tm-leg .l2:before{background:#C95532}",
    "html body #page .fo-tm-gone{margin-top:14px;background:#FFFEFC;border:1px dashed rgba(20,28,40,.25);border-radius:14px;padding:22px;text-align:center;font:italic 400 13px/1.5 Georgia,serif;color:rgba(20,28,40,.55)}",
    "html body #page .fo-tm-foot{display:flex;gap:10px;justify-content:space-between;margin-top:16px;flex-wrap:wrap}",
    "html body #page .fo-tm-foot a{font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
    "html body #page .fo-tm-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5);text-decoration:none}",
    "@media(max-width:640px){html body #page .fo-tm-mast h1{font-size:26px}html body #page .fo-tm-duo,html body #page .fo-tm-tls{grid-template-columns:1fr}}"
  ].join("\n");

  function mount() {
    try {
      var s = document.getElementById("fo-tm-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-tm-css"; s.textContent = CSS; }
      document.body.appendChild(s);
      decorateReport();
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); });
  else setTimeout(mount, 0);

  window.foRenderTimeMachinePage = foRenderTimeMachinePage;
  window.__foTimeMachine = 1;
})();
