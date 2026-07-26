// ---- 20-strategy-room.js — The Scout's Dossier + The Groundsman --------------
// The strategy layer. Orders already run deep (spell grids, phase intents,
// batting orders) but the manager plays them blind: no opposition intel, and a
// home pitch frozen at onboarding. This module adds both halves of real cricket
// strategy:
//   THE DOSSIER (#/dossier) - a pre-match intelligence report on the next
//   opponent, computed entirely from shared season results and squad shapes,
//   so every client derives the identical report and an absent manager loses
//   nothing mechanical by never reading it.
//   THE GROUNDSMAN - a standing instruction for how your square is prepared.
//   It writes team.homePitch, which the engine's groundPitch() already honours
//   for every fixture-meta path. Bots get doctrines too - a pure function of
//   their (immutable) bowling-type composition, so all clients agree.
(function () {
  "use strict";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function tcOf(t) { try { return typeClass(t); } catch (e) { return (t === "fast" || t === "fastMedium" || t === "medium") ? "pace" : "spin"; } }

  var PITCH_NM = { balanced: "True surface", flat: "Flat road", green: "Green seamer", dry: "Dry turner", slow: "Slow & low", cracked: "Cracked", twoPaced: "Two-paced" };
  var PITCH_LINE = {
    balanced: "an even contest - bat, ball and nerve in equal parts",
    flat: "runs everywhere; 320 plays 320 and bowlers buy their wickets",
    green: "the new ball talks all morning; edges carry, drives are a dare",
    dry: "it turns from over one and gets worse; spin bowls the death of it",
    slow: "strokeless grind; the ball dies in the surface and power means little",
    cracked: "demons in the cracks; survival first, style later",
    twoPaced: "one ball climbs, the next crawls; timing is a rumour"
  };
  // what a groundsman can actually be told to prepare
  var DOCTRINES = [
    { k: "", nm: "Ground default", why: "let the square be what it has always been" },
    { k: "green", nm: "Green seamer", why: "leave the grass on - suits a pace attack under cloud" },
    { k: "dry", nm: "Dry turner", why: "shave and bake it - bring two spinners and sweep hard" },
    { k: "flat", nm: "Flat road", why: "roll it dead - back your batters to out-gun anyone" },
    { k: "slow", nm: "Slow & low", why: "starve the strokemakers - kills power hitting" },
    { k: "balanced", nm: "True surface", why: "a fair fight - trust the better XI to win it" }
  ];

  // ---- who is human (never assign a bot doctrine over a person's choice) -----
  function humanMap() {
    try { if (window.__foClubMeta) return window.__foClubMeta; } catch (e) {}
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("fol_clubmeta_") === 0) { var m = JSON.parse(localStorage.getItem(k) || "null"); if (m) return m; }
      }
    } catch (e2) {}
    return {};
  }

  // ---- the groundsman's doctrines -------------------------------------------
  // Bots read their own dressing room: three frontline spinners want dust,
  // an all-seam attack wants grass. Based only on bowlType counts - the one
  // squad fact training can never change - so every client derives the same
  // doctrine all season.
  function botDoctrine(t) {
    var spin = 0, pace = 0;
    (t.players || []).forEach(function (p) { if (!p.bowlType) return; if (tcOf(p.bowlType) === "spin") spin++; else pace++; });
    // a doctrine needs a clear identity, not a slight lean - most squads
    // carry a few spinners regardless
    if (spin >= pace + 2) return "dry";
    if (pace >= spin + 3) return "green";
    return null;
  }
  function ensureDoctrines() {
    try {
      if (typeof GD === "undefined" || !GD.teams) return;
      var hm = humanMap();
      GD.teams.forEach(function (t, ix) {
        if (ix === App.teamIx) return;
        if (hm && hm[t.name]) return;
        var d = botDoctrine(t);
        if (d) t.homePitch = d;
      });
    } catch (e) {}
  }

  // ---- next fixture ----------------------------------------------------------
  function nextFixture() {
    try {
      if (typeof seasonInit === "function") seasonInit();
      var S = App.season; if (!S) return null;
      for (var r = S.round; r < S.schedule.length; r++) {
        var rd = S.schedule[r] || [];
        for (var i = 0; i < rd.length; i++) {
          var f = rd[i];
          if (f[0] !== App.teamIx && f[1] !== App.teamIx) continue;
          try { if (S.played && S.played[fixtureKey(r, f)] !== undefined) continue; } catch (eK) {}
          var home = GD.teams[f[0]], away = GD.teams[f[1]];
          return {
            r: r, f: f, home: home, away: away, isHome: f[0] === App.teamIx,
            opp: GD.teams[f[0] === App.teamIx ? f[1] : f[0]],
            ground: home.ground, pitch: groundPitch(home.ground),
            weather: WXLIST[(r * 7 + f[0] * 3) % WXLIST.length]
          };
        }
      }
    } catch (e) {}
    return null;
  }

  // ---- season stats from the shared record ----------------------------------
  function teamSeason(name) {
    var out = { bat: {}, bowl: {}, paceB: 0, spinB: 0, form: [], runs: 0 };
    try {
      (App.results || []).forEach(function (rec) {
        if (!rec || !rec.innings) return;
        var mine = rec.home === name || rec.away === name;
        if (!mine) return;
        if (rec.result && rec.result.winner !== undefined) {
          out.form.push({ w: rec.result.winner === name, txt: rec.result.text || "", ix: rec.ix });
        }
        rec.innings.forEach(function (inn) {
          if (!inn) return;
          if (inn.batTeam === name) {
            (inn.bat || []).forEach(function (b) {
              if (!b || !b.p || !b.p.name || (!b.b && !b.r)) return;
              var a = out.bat[b.p.name] || (out.bat[b.p.name] = { r: 0, b: 0, outs: 0, best: 0 });
              a.r += b.r || 0; a.b += b.b || 0; if (b.out) a.outs++;
              if ((b.r || 0) > a.best) a.best = b.r || 0;
              out.runs += b.r || 0;
            });
          }
          if (inn.bowlTeam === name && inn.bowlers) {
            Object.keys(inn.bowlers).forEach(function (nm) {
              var w = inn.bowlers[nm]; if (!w) return;
              var a = out.bowl[nm] || (out.bowl[nm] = { w: 0, r: 0, b: 0 });
              a.w += w.w || 0; a.r += w.r || 0; a.b += w.b || 0;
            });
          }
        });
      });
    } catch (e) {}
    return out;
  }
  function topN(map, score, n) {
    return Object.keys(map).map(function (k) { return { nm: k, s: map[k] }; })
      .sort(function (a, b) { return score(b.s) - score(a.s); }).slice(0, n);
  }

  // ---- scouted grades: coarse letters, never raw numbers ---------------------
  function gradeOf(v) { return v >= 76 ? "A" : v >= 69 ? "B" : v >= 62 ? "C" : v >= 55 ? "D" : "E"; }
  var GRADE_C = { A: "#1F9E72", B: "#6FA32C", C: "#B08F1D", D: "#C86F1F", E: "#C43B38" };
  function batSplits(t) {
    var men = (t.players || []).slice().sort(function (a, b) {
      var sa = ((a.skills || {}).vsPace || 0) + ((a.skills || {}).vsSpin || 0);
      var sb = ((b.skills || {}).vsPace || 0) + ((b.skills || {}).vsSpin || 0);
      return sb - sa;
    }).slice(0, 7);
    var vp = 0, vs = 0, n = men.length || 1;
    men.forEach(function (p) { vp += (p.skills || {}).vsPace || 55; vs += (p.skills || {}).vsSpin || 55; });
    return { vsPace: vp / n, vsSpin: vs / n };
  }
  function attackShape(t, seas) {
    var byType = { pace: 0, spin: 0 };
    var typeByName = {};
    (t.players || []).forEach(function (p) { if (p.bowlType) typeByName[p.name] = tcOf(p.bowlType); });
    var balls = 0;
    Object.keys(seas.bowl).forEach(function (nm) {
      var cl = typeByName[nm]; if (!cl) return;
      byType[cl] += seas.bowl[nm].b || 0; balls += seas.bowl[nm].b || 0;
    });
    if (!balls) { // no cricket yet: read the squad instead
      Object.keys(typeByName).forEach(function (nm) { byType[typeByName[nm]]++; balls++; });
    }
    return { pacePct: balls ? Math.round(100 * byType.pace / balls) : 50, balls: balls };
  }

  // ---- the scout's recommendations ------------------------------------------
  function recommend(nx, me, opp, oppSeas, mySplits, oppSplits, oppAtk) {
    var recs = [];
    var edge = oppSplits.vsSpin - oppSplits.vsPace;
    if (edge <= -5) recs.push("Their batting grades <b>" + gradeOf(oppSplits.vsSpin) + " against spin</b> but " + gradeOf(oppSplits.vsPace) + " against pace. Load the middle overs with your slow bowlers" + (nx.isHome ? " - and the groundsman can leave the square dry" : "") + ".");
    else if (edge >= 5) recs.push("They play spin well (" + gradeOf(oppSplits.vsSpin) + ") but the seamers trouble them (" + gradeOf(oppSplits.vsPace) + " vs pace). Keep your quicks on" + (nx.isHome ? ", and ask for grass on the pitch" : "") + ".");
    if (oppAtk.pacePct <= 55 && oppAtk.balls > 60) {
      var line = "Nearly half their overs are spin (" + (100 - oppAtk.pacePct) + "%).";
      if (mySplits.vsSpin < 62) line += " Your own middle order grades " + gradeOf(mySplits.vsSpin) + " against it - a watchful middle-overs plan may save the innings.";
      else line += " Your batting grades " + gradeOf(mySplits.vsSpin) + " against the turning ball - sweep hard and take them on.";
      recs.push(line);
    }
    var scorers = topN(oppSeas.bat, function (s) { return s.r; }, 1);
    if (scorers.length && oppSeas.runs > 0 && scorers[0].s.r >= Math.max(120, oppSeas.runs * 0.24)) {
      recs.push("<b>" + E(scorers[0].nm) + "</b> carries their batting - " + scorers[0].s.r + " runs this season. Get him early and the rest fold.");
    }
    var keepers = topN(oppSeas.bowl, function (s) { return s.w; }, 1);
    if (keepers.length && keepers[0].s.b >= 60) {
      var ec = keepers[0].s.b ? (keepers[0].s.r / (keepers[0].s.b / 6)) : 0;
      recs.push("<b>" + E(keepers[0].nm) + "</b> is the dangerman with the ball (" + keepers[0].s.w + " wickets" + (ec ? ", " + ec.toFixed(1) + " an over" : "") + "). See him off; score at the other end.");
    }
    var tired = (me.players || []).filter(function (p) { var w = String(p.fatigue || "rested").toLowerCase(); return /weary|listless|exhaust|shatter|clinical/.test(w); });
    if (tired.length >= 2) recs.push(tired.length + " of your squad are running on fumes (" + tired.slice(0, 3).map(function (p) { return E(p.name); }).join(", ") + (tired.length > 3 ? "…" : "") + "). A recovery week at the nets costs one session and wins the next fortnight.");
    if (!recs.length) recs.push("No glaring weakness in their game. Win the toss, read the pitch, and trust your best XI - matches like this are decided by the sharper plan at the death.");
    return recs.slice(0, 4);
  }
  function tossHint(pitch, wx) {
    if (pitch === "green") return (/Overcast|Drizzle|Misty/.test(wx) ? "Under that sky, bowl first - the morning is the match." : "Bowl first while the grass is fresh; it flattens by the chase.");
    if (pitch === "dry") return "Bat first. It only gets uglier - fourth-innings spin on this is a sentence.";
    if (pitch === "flat") return "Bat first and post a mountain; scoreboard pressure is the only demon in this pitch.";
    if (pitch === "slow") return "Chasing is easier when you know the number - bowl first and drag the game long.";
    if (/Dew later/.test(wx)) return "Dew later: bowl first - the ball will be soap after dark.";
    return "No strong bias - take the toss on gut and team balance.";
  }

  // ---- desk card -------------------------------------------------------------
  function foScoutCard() {
    try {
      var nx = nextFixture(); if (!nx) return "";
      var os = batSplits(nx.opp);
      return "<a class='fo-ls-card fo-sd-card' href='#/dossier'>" +
        "<div class='fo-ls-kick'>The scouting wire</div>" +
        "<div class='fo-sd-line'><b>R" + (nx.r + 1) + " &middot; v " + E(nx.opp.name) + "</b> " + (nx.isHome ? "at home" : "away") + "</div>" +
        "<div class='fo-sd-sub'>They grade " + gradeOf(os.vsPace) + " vs pace, " + gradeOf(os.vsSpin) + " vs spin &middot; " + E(PITCH_NM[nx.pitch] || nx.pitch) + " forecast</div>" +
        "<span class='fo-ls-go'>Read the dossier &rsaquo;</span></a>";
    } catch (e) { return ""; }
  }

  // ---- the page --------------------------------------------------------------
  function bead(f) { return "<i class='fo-sd-bead " + (f.w ? "w" : "l") + "' title='" + E(f.txt) + "'>" + (f.w ? "W" : "L") + "</i>"; }
  function gchip(v) { var g = gradeOf(v); return "<em class='fo-sd-g' style='color:" + GRADE_C[g] + ";border-color:" + GRADE_C[g] + "55'>" + g + "</em>"; }
  function meter(v) { var w = Math.max(8, Math.min(96, Math.round(v))); return "<span class='fo-sd-m'><u style='width:" + w + "%'></u></span>"; }

  function foRenderScoutPage() {
    try {
      ensureDoctrines();
      var page = document.getElementById("page"); if (!page) return;
      var me = null; try { me = userTeam(); } catch (eU) {}
      if (!me) return;
      var nx = nextFixture();
      document.body.classList.remove("fo-scb-on", "fo-drs-on");

      if (!nx) {
        page.innerHTML = "<div class='fo-sd'><div class='fo-sd-hero'><div class='fo-sd-kick'>" + E(me.name) + " &middot; the war room</div>" +
          "<h1>The Scout&rsquo;s Dossier</h1><p>No fixture ahead. The season is done - the scout is at the beach, and the groundsman is re-seeding the square for spring.</p>" +
          "<div class='fo-sd-foot'><a href='#/desk'>&#8592; The desk</a><a href='#/ceremony'>Awards night &rsaquo;</a></div></div></div>";
        return;
      }

      var opp = nx.opp;
      var hm = humanMap();
      var oppHuman = !!(hm && hm[opp.name]);
      var oppSeas = teamSeason(opp.name), mySeas = teamSeason(me.name);
      var oppSplits = batSplits(opp), mySplits = batSplits(me);
      var oppAtk = attackShape(opp, oppSeas);
      var rows = [];
      try { rows = leagueRows(); } catch (eL) {}
      var posOf = function (nm) { for (var i = 0; i < rows.length; i++) if (rows[i].nm === nm) return { pos: i + 1, pts: rows[i].pts, nrr: rows[i].nrr }; return null; };
      var meP = posOf(me.name), opP = posOf(opp.name);
      var ord = function (n) { return n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"); };

      // head-to-head this season
      var h2h = (App.results || []).filter(function (rec) {
        return rec && rec.result && ((rec.home === me.name && rec.away === opp.name) || (rec.home === opp.name && rec.away === me.name));
      }).slice(-3);

      var scorers = topN(oppSeas.bat, function (s) { return s.r; }, 4);
      var wickets = topN(oppSeas.bowl, function (s) { return s.w; }, 3);

      var recs = recommend(nx, me, opp, oppSeas, mySplits, oppSplits, oppAtk);
      var doctrine = me.homePitch || "";
      var nextHome = null;
      try {
        var S = App.season;
        for (var r2 = S.round; r2 < S.schedule.length && !nextHome; r2++) {
          (S.schedule[r2] || []).forEach(function (f2) {
            if (nextHome) return;
            if (f2[0] !== App.teamIx) return;
            try { if (S.played && S.played[fixtureKey(r2, f2)] !== undefined) return; } catch (eK2) {}
            nextHome = { r: r2, opp: GD.teams[f2[1]] };
          });
        }
      } catch (eNH) {}

      page.innerHTML =
        "<div class='fo-sd'>" +
        "<div class='fo-sd-hero'>" +
        "<div class='fo-sd-kick'>Round " + (nx.r + 1) + " &middot; " + (nx.isHome ? "at " + E(nx.ground) : "away at " + E(nx.ground)) + "</div>" +
        "<h1>v " + E(opp.name) + "</h1>" +
        "<p>" + (oppHuman ? "A human hand on their tiller - expect the unexpected. " : "") +
        "The scout has been to their nets, read their scorecards, and filed this before breakfast.</p>" +
        (opP && meP ? "<div class='fo-sd-tale'><span>" + E(me.name) + " &middot; " + ord(meP.pos) + " &middot; " + meP.pts + " pts</span><b>v</b><span>" + E(opp.name) + " &middot; " + ord(opP.pos) + " &middot; " + opP.pts + " pts</span></div>" : "") +
        "</div>" +

        "<div class='fo-sd-grid'>" +

        // form
        "<section class='fo-sd-card'><div class='fo-sd-k'>Recent form</div>" +
        "<div class='fo-sd-formrow'><span>" + E(opp.name) + "</span><span class='fo-sd-beads'>" + (oppSeas.form.slice(-5).map(bead).join("") || "<i class='fo-sd-none'>no cricket yet</i>") + "</span></div>" +
        "<div class='fo-sd-formrow'><span>" + E(me.name) + "</span><span class='fo-sd-beads'>" + (mySeas.form.slice(-5).map(bead).join("") || "<i class='fo-sd-none'>no cricket yet</i>") + "</span></div>" +
        (h2h.length ? "<div class='fo-sd-h2h'>" + h2h.map(function (rec) { return "<a href='#/report?i=" + rec.ix + "'>" + E((rec.result && rec.result.text) || "") + " &rsaquo;</a>"; }).join("") + "</div>" : "") +
        "</section>" +

        // their batting
        "<section class='fo-sd-card'><div class='fo-sd-k'>Their batting</div>" +
        "<div class='fo-sd-split'><span>vs pace</span>" + meter(oppSplits.vsPace) + gchip(oppSplits.vsPace) + "</div>" +
        "<div class='fo-sd-split'><span>vs spin</span>" + meter(oppSplits.vsSpin) + gchip(oppSplits.vsSpin) + "</div>" +
        (scorers.length ? "<div class='fo-sd-men'>" + scorers.map(function (o) {
          var sr = o.s.b ? Math.round(100 * o.s.r / o.s.b) : 0;
          return "<div class='fo-sd-man'><b>" + E(o.nm) + "</b><span>" + o.s.r + " runs &middot; best " + o.s.best + (sr ? " &middot; SR " + sr : "") + "</span></div>";
        }).join("") + "</div>" : "<div class='fo-sd-none2'>No innings on record - the scout is guessing from the nets.</div>") +
        "</section>" +

        // their bowling
        "<section class='fo-sd-card'><div class='fo-sd-k'>Their attack</div>" +
        "<div class='fo-sd-mix'><u style='width:" + oppAtk.pacePct + "%'></u></div>" +
        "<div class='fo-sd-mixlbl'><span>pace " + oppAtk.pacePct + "%</span><span>spin " + (100 - oppAtk.pacePct) + "%</span></div>" +
        (wickets.length ? "<div class='fo-sd-men'>" + wickets.map(function (o) {
          var ov = o.s.b ? (o.s.b / 6) : 0, ec = ov ? (o.s.r / ov) : 0;
          return "<div class='fo-sd-man'><b>" + E(o.nm) + "</b><span>" + o.s.w + " wkts" + (ec ? " &middot; " + ec.toFixed(1) + " rpo" : "") + "</span></div>";
        }).join("") + "</div>" : "<div class='fo-sd-none2'>No bowling record yet this season.</div>") +
        "</section>" +

        // conditions
        "<section class='fo-sd-card'><div class='fo-sd-k'>The conditions</div>" +
        "<div class='fo-sd-cond'><b>" + E(nx.ground) + "</b><span>" + E(PITCH_NM[nx.pitch] || nx.pitch) + " &middot; " + E(nx.weather) + "</span></div>" +
        "<p class='fo-sd-say'>" + E(PITCH_LINE[nx.pitch] || "") + ".</p>" +
        "<p class='fo-sd-toss'><b>The toss:</b> " + E(tossHint(nx.pitch, nx.weather)) + "</p>" +
        "</section>" +

        // recommendations
        "<section class='fo-sd-card fo-sd-wide'><div class='fo-sd-k'>The scout recommends</div>" +
        "<ol class='fo-sd-recs'>" + recs.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ol>" +
        "</section>" +

        // groundsman
        "<section class='fo-sd-card fo-sd-wide'><div class='fo-sd-k'>The groundsman</div>" +
        "<p class='fo-sd-say'>A standing instruction for how " + E(me.ground || "your ground") + " is prepared. It holds until you change it, and applies to every home fixture still to be played" +
        (nextHome ? " - next: <b>R" + (nextHome.r + 1) + " v " + E(nextHome.opp.name) + "</b>" : "") + ".</p>" +
        "<div class='fo-sd-docs'>" + DOCTRINES.map(function (d) {
          var on = (doctrine || "") === d.k;
          return "<button class='fo-sd-doc" + (on ? " on" : "") + "' data-doc='" + d.k + "'><b>" + E(d.nm) + "</b><span>" + E(d.why) + "</span></button>";
        }).join("") + "</div>" +
        "</section>" +

        "</div>" +
        "<div class='fo-sd-foot'><a href='#/desk'>&#8592; The desk</a><a href='#/orders'>Set the orders &rsaquo;</a><a href='#/training'>The nets &rsaquo;</a></div>" +
        "</div>";

      // groundsman wiring
      page.querySelectorAll(".fo-sd-doc").forEach(function (b) {
        b.addEventListener("click", function () {
          try {
            var k = b.getAttribute("data-doc") || "";
            if (k) me.homePitch = k; else delete me.homePitch;
            if (typeof saveGame === "function") saveGame(false);
          } catch (eS) {}
          foRenderScoutPage();
        });
      });
    } catch (e) { try { console.warn("foRenderScoutPage", e); } catch (e2) {} }
  }

  // ---- topbar link -----------------------------------------------------------
  function ensureNavLink() {
    try {
      var tb = document.getElementById("topbar"); if (!tb) return;
      var wrap = tb.querySelector(".fo-nav-scroll"); if (!wrap) return;
      var a = wrap.querySelector("a.fo-dossier");
      if (!a) {
        a = document.createElement("a"); a.className = "fo-dossier"; a.href = "#/dossier"; a.textContent = "Scout";
        a.addEventListener("click", function (ev) { ev.preventDefault(); location.hash = "#/dossier"; if (typeof window.route === "function") window.route(); });
        // sit beside Squad, where a coach would look for it
        var sq = wrap.querySelector("a[data-nav='squad']");
        if (sq && sq.nextSibling) wrap.insertBefore(a, sq.nextSibling); else wrap.appendChild(a);
      }
      a.classList.toggle("on", (location.hash || "").split("?")[0] === "#/dossier");
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(function () { ensureNavLink(); ensureDoctrines(); }, 80); });

  // ---- sheet -----------------------------------------------------------------
  var CSS = [
    "html body #page .fo-sd{max-width:880px;margin:26px auto 44px;padding:0 14px;color:#141C28}",
    "html body #page .fo-sd-hero{background:linear-gradient(150deg,#FFFEFB,#F7F3E9 70%,#F0EADA) !important;border:1px solid rgba(20,28,40,.09);border-radius:22px;padding:28px 30px 24px;box-shadow:0 22px 50px rgba(30,38,52,.13)}",
    "html body #page .fo-sd-kick,html body #page .fo-sd-k{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:#B44A22}",
    "html body #page .fo-sd-hero h1{font-family:Oswald,sans-serif;font-weight:600;font-size:36px;letter-spacing:.03em;text-transform:uppercase;margin:6px 0 8px;color:#141C28}",
    "html body #page .fo-sd-hero p{font:italic 400 13.5px/1.55 Georgia,serif;color:rgba(20,28,40,.6);margin:0;max-width:60ch}",
    "html body #page .fo-sd-tale{display:flex;gap:14px;align-items:baseline;margin-top:14px;font:600 12.5px/1 Inter,sans-serif;color:#141C28;flex-wrap:wrap}",
    "html body #page .fo-sd-tale b{color:rgba(20,28,40,.4);font-weight:400}",
    "html body #page .fo-sd-tale span{background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:999px;padding:8px 14px}",
    "html body #page .fo-sd-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}",
    "html body #page .fo-sd-card{background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:18px;padding:18px 20px;box-shadow:0 6px 18px rgba(30,38,52,.07)}",
    "html body #page .fo-sd-wide{grid-column:1/-1}",
    "html body #page .fo-sd-k{margin-bottom:12px}",
    "html body #page .fo-sd-formrow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(20,28,40,.07);font:600 13px/1 Inter,sans-serif}",
    "html body #page .fo-sd-beads{display:flex;gap:5px}",
    "html body #page .fo-sd-bead{width:22px;height:22px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;font:700 10.5px/1 Inter,sans-serif;font-style:normal}",
    "html body #page .fo-sd-bead.w{background:rgba(31,158,114,.12);color:#177A57;border:1px solid rgba(31,158,114,.4)}",
    "html body #page .fo-sd-bead.l{background:rgba(200,60,58,.1);color:#B23230;border:1px solid rgba(200,60,58,.35)}",
    "html body #page .fo-sd-none,html body #page .fo-sd-none2{font:italic 400 12px/1.4 Georgia,serif;color:rgba(20,28,40,.45)}",
    "html body #page .fo-sd-none2{margin-top:10px}",
    "html body #page .fo-sd-h2h{margin-top:10px;display:flex;flex-direction:column;gap:4px}",
    "html body #page .fo-sd-h2h a{font:italic 400 12.5px/1.4 Georgia,serif;color:rgba(20,28,40,.62);text-decoration:none}",
    "html body #page .fo-sd-h2h a:hover{color:#B44A22}",
    "html body #page .fo-sd-split{display:flex;align-items:center;gap:10px;margin:8px 0;font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.75)}",
    "html body #page .fo-sd-split>span{width:56px;flex:none}",
    "html body #page .fo-sd-m{flex:1;height:7px;border-radius:6px;background:rgba(20,28,40,.08);overflow:hidden;display:block}",
    "html body #page .fo-sd-m u{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#3E6DB2,#7FB4E8)}",
    "html body #page .fo-sd-g{flex:none;width:24px;height:24px;border-radius:8px;border:1px solid;display:inline-flex;align-items:center;justify-content:center;font:800 12px/1 Inter,sans-serif;font-style:normal;background:rgba(20,28,40,.03)}",
    "html body #page .fo-sd-mix{height:10px;border-radius:6px;background:#7FB4E8;overflow:hidden}",
    "html body #page .fo-sd-mix u{display:block;height:100%;background:#E8985C}",
    "html body #page .fo-sd-mixlbl{display:flex;justify-content:space-between;font:600 10.5px/1 Inter,sans-serif;color:rgba(20,28,40,.55);margin-top:5px;letter-spacing:.04em;text-transform:uppercase}",
    "html body #page .fo-sd-men{margin-top:12px;display:flex;flex-direction:column;gap:7px}",
    "html body #page .fo-sd-man{display:flex;justify-content:space-between;gap:10px;align-items:baseline;border-bottom:1px solid rgba(20,28,40,.07);padding-bottom:6px}",
    "html body #page .fo-sd-man b{font:600 13px/1.3 Inter,sans-serif;color:#141C28}",
    "html body #page .fo-sd-man span{font:400 11.5px/1.3 Inter,sans-serif;color:rgba(20,28,40,.55);font-variant-numeric:tabular-nums;white-space:nowrap}",
    "html body #page .fo-sd-cond b{font:600 14px/1.3 Inter,sans-serif;display:block;color:#141C28}",
    "html body #page .fo-sd-cond span{font:600 11px/1.6 Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#B44A22}",
    "html body #page .fo-sd-say{font:italic 400 13px/1.55 Georgia,serif;color:rgba(20,28,40,.62);margin:9px 0 0}",
    "html body #page .fo-sd-toss{font:400 12.5px/1.5 Inter,sans-serif;color:rgba(20,28,40,.72);margin:10px 0 0}",
    "html body #page .fo-sd-recs{margin:0;padding-left:19px;display:flex;flex-direction:column;gap:9px;font:400 13.5px/1.55 Inter,sans-serif;color:rgba(20,28,40,.8)}",
    "html body #page .fo-sd-recs b{color:#141C28}",
    "html body #page .fo-sd-docs{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:9px;margin-top:12px}",
    "html body #page button.fo-sd-doc{text-align:left;background:#FDFCF8 !important;border:1px solid rgba(20,28,40,.12) !important;border-radius:13px !important;padding:11px 13px !important;cursor:pointer;color:#141C28 !important;transition:border-color .15s ease}",
    "html body #page button.fo-sd-doc b{display:block;font:700 12.5px/1 Inter,sans-serif;letter-spacing:.02em;color:#141C28}",
    "html body #page button.fo-sd-doc span{display:block;font:italic 400 11px/1.4 Georgia,serif;color:rgba(20,28,40,.55);margin-top:4px}",
    "html body #page button.fo-sd-doc:hover{border-color:rgba(217,85,42,.5) !important}",
    "html body #page button.fo-sd-doc.on{border-color:#D9552A !important;background:rgba(232,102,60,.08) !important;box-shadow:0 0 0 1px rgba(217,85,42,.35)}",
    "html body #page .fo-sd-foot{display:flex;gap:10px;justify-content:space-between;margin-top:16px;flex-wrap:wrap}",
    "html body #page .fo-sd-foot a{font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
    "html body #page .fo-sd-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5);text-decoration:none}",
    "@media(max-width:700px){html body #page .fo-sd-grid{grid-template-columns:1fr}html body #page .fo-sd-hero h1{font-size:27px}}",
    // desk card accents
    ".fo-sd-card.fo-ls-card{display:block;text-decoration:none}",
    ".fo-sd-line{font:600 13.5px/1.4 Inter,sans-serif}",
    ".fo-sd-sub{font:italic 400 12px/1.45 Georgia,serif;opacity:.75;margin-top:3px}"
  ].join("\n");

  function mount() {
    try {
      var s = document.getElementById("fo-sd-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-sd-css"; s.textContent = CSS; }
      document.body.appendChild(s);
      ensureDoctrines();
      ensureNavLink();
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); });
  else setTimeout(mount, 0);

  window.foRenderScoutPage = foRenderScoutPage;
  window.foScoutCard = foScoutCard;
  window.__foStrategy = 1;
})();
