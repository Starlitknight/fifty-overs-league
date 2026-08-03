/* ============================================================================
   THE NETS — player training, designed from what a real cricket week looks
   like and from this game's one hard law: managers are sometimes asleep when
   the world moves.

   The design:
   - THE WEEK: three group sessions chosen from six (batting nets, bowling
     nets, fielding drills, conditioning, video room, recovery). The whole
     squad attends; each session works its own skills, and always the
     weakest relevant skill first - coaches fix faults, they don't polish
     trophies.
   - THE COACH'S PROJECTS: two individual assignments - one player, one
     named skill, double intensity. This is where a spin problem gets fixed
     or a youngster gets built.
   - THE STAFF: batting, bowling and fielding coaches for hire. Each costs
     a retainer through the club ledger and sharpens his own sessions.
   - THE CURVE: growth odds fall with age. Under-22s fly, mid-20s build,
     late-20s inch. From 30, sessions stop growing a man and start
     PRESERVING him: attended sessions bank maintenance that refunds part
     of the winter's decline in that area. Train your veterans or watch
     them fall off the cliff.
   - Tired players train at half effect; a recovery week freshens everyone.

   Offline-fair: the plan is the decision (like orders); resolution runs
   inside completeRound with a per-round stamp and a seeded RNG, so every
   client - and every absent manager - gets the identical season. Bot squads
   keep the engine's own training so the league's strength balance is
   untouched.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foNets) return; window.__foNets = 1;

  function E(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hashS(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }
  function ready() { return typeof App !== "undefined" && App && typeof GD !== "undefined" && GD && GD.teams && typeof userTeam === "function"; }
  function ART() { return (typeof FO_ART !== "undefined") ? FO_ART : "client/art/"; }
  function TR() {
    if (!App.ls || typeof App.ls !== "object") App.ls = {};
    var t = App.ls.tr;
    if (!t || typeof t !== "object") t = App.ls.tr = {};
    if (!Array.isArray(t.sessions) || !t.sessions.length) t.sessions = ["bat", "bowl", "field"];
    if (!Array.isArray(t.projects)) t.projects = [];
    if (!t.coaches) t.coaches = {};
    if (!Array.isArray(t.log)) t.log = [];
    if (!t.maint) t.maint = {};
    return t;
  }

  // ---- THE LOG THIS CLUB ACTUALLY WROTE --------------------------------------
  // App.ls.tr.log is the LOCAL resolver's record, and it outlives the men it
  // was written about. A world reset re-deals the squad, a transfer moves a
  // man on - and the noticeboard went on celebrating cricketers who are not
  // at this club, beside a plan listing the eleven who are.
  //
  // Worse for a club held in the served world: the local resolver is switched
  // off there (the umpire does the training from the plan the world holds), so
  // EVERY line in that log is from a life this club did not live. The honest
  // report is an empty one until the world has something to report.
  //
  // One reader, so the development report, the noticeboard pops and the club
  // home card cannot disagree about who trained.
  function foNsLog() {
    // the claim is read from the store as well as the live global: on a cold
    // boot the world has not answered yet, and that is exactly the moment the
    // stale board used to flash up
    try {
      var cl = window.__foWorldClaim;
      if (!cl) { try { cl = JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (eS) {} }
      if (cl && cl.country) return [];
    } catch (eW) {}
    try {
      if (!App || !App.ls || !Array.isArray(App.ls.tr && App.ls.tr.log)) return [];
      var here = {}, me = userTeam();
      if (!me) return [];
      (me.players || []).concat(me.youth || []).forEach(function (p) { if (p && p.name) here[p.name] = 1; });
      return App.ls.tr.log.filter(function (l) { return l && here[l.n]; });
    } catch (e) { return []; }
  }
  window.__foTrainLog = foNsLog;

  var FO_NS_SESS = {
    bat:   { nm: "Batting nets",   ic: "&#127951;", sk: ["vsPace", "vsSpin", "rotation", "temperament"], who: "all",   coach: "bat",  sub: "throw-downs, the bowling machine, an hour against the turning ball" },
    bowl:  { nm: "Bowling nets",   ic: "&#9678;",   sk: ["wicket", "economy", "discipline", "variation"], who: "bowl", coach: "bowl", sub: "one stump, a cone on a length, and the keeper calling the seam" },
    field: { nm: "Fielding drills", ic: "&#129354;", sk: ["fielding", "catching"], keeper: ["keeping", "stumping"], who: "all", coach: "field", sub: "high balls, flat catches, attack the ring" },
    cond:  { nm: "Conditioning",   ic: "&#127939;", sk: ["stamina", "power"], who: "all", coach: null, sub: "hills, the gym, and the physio's honest opinions" },
    video: { nm: "Video room",     ic: "&#127909;", sk: ["temperament", "discipline"], who: "all", coach: null, sub: "last week's dismissals, frame by patient frame" },
    rec:   { nm: "Recovery",       ic: "&#9825;",   sk: [], who: "all", coach: null, sub: "pool, massage, feet up - the bravest call a coach can make" }
  };
  var FO_NS_COACH = { bat: { nm: "Batting coach", fee: 4000 }, bowl: { nm: "Bowling coach", fee: 4000 }, field: { nm: "Fielding coach", fee: 4000 } };
  var FO_NS_PROJ_SK = ["vsPace", "vsSpin", "rotation", "temperament", "power", "wicket", "economy", "discipline", "variation", "stamina", "fielding", "catching", "keeping", "stumping"];

  // the age curve: growth odds per attended session
  function foNsBase(age) {
    return age <= 19 ? 0.6 : age <= 21 ? 0.5 : age <= 25 ? 0.38 : age <= 28 ? 0.24 : age <= 30 ? 0.14 : age <= 32 ? 0.08 : 0.05;
  }
  function foNsEnergy(p) {
    try { var w = String(p.fatigue || "rested").toLowerCase();
      if (/exhaust|shatter|clinical/.test(w)) return 0.25;
      if (/weary|listless|tired/.test(w)) return 0.5;
      if (/moderate|satisfactory/.test(w)) return 0.8;
    } catch (e) {}
    return 1;
  }
  function foNsRnd(seed) { var h = hashS(seed); return ((h >>> 8) % 10000) / 10000; }
  function foNsGain(p, pool, why, rd, log) {
    // always the weakest eligible skill: coaching mends faults first
    var best = null;
    pool.forEach(function (k) {
      var v = p.skills && p.skills[k];
      if (v == null || v >= 95) return;
      if (!best || v < best.v) best = { k: k, v: v };
    });
    if (!best) return false;
    p.skills[best.k]++;
    try { if (typeof jsDerive === "function") jsDerive(p); } catch (e) {}
    log.unshift({ r: rd, s: App.seasonNo || 1, n: p.name, k: best.k, why: why });
    if (log.length > 48) log.pop();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Resolution: the user's week, run with the round, exactly once
  // ---------------------------------------------------------------------------
  function foNsSettle() {
    if (!ready() || !App.season) return;
    // ONE TRAINING GROUND: if this club plays in the served world, the umpire
    // does its training from the plan the world holds. The local resolver
    // would only bump skills the World Service is about to overwrite.
    try { if (window.__foWorldClaim) return; } catch (eW) {}
    var doneR = (App.season.round || 0) - 1; if (doneR < 0) return;
    var key = "S" + (App.seasonNo || 1) + "R" + doneR;
    var t = TR();
    if (t.stamp === key) return;
    t.stamp = key;
    var me = userTeam(), acad = 1 + 0.1 * (((me.acadS || 2)) - 2);
    var squad = (me.players || []).concat(me.youth || []);
    var sess = t.sessions.slice(0, 3);
    // recovery week: everyone freshens before anything else is judged
    if (sess.indexOf("rec") >= 0) squad.forEach(function (p) { p.fatigue = "rested"; if (p.fatN != null) p.fatN = 0; });
    squad.forEach(function (p) {
      var base = foNsBase(p.age | 0) * acad * foNsEnergy(p);
      sess.forEach(function (id) {
        var S = FO_NS_SESS[id]; if (!S || !S.sk.length) return;
        if (S.who === "bowl" && (!p.bowlType || p.bowlType === "none")) return;
        var pool = (id === "field" && p.keeper) ? S.sk.concat(S.keeper) : S.sk;
        var ch = base * (S.coach && t.coaches[S.coach] ? 1.3 : 1);
        // past 30 the nets preserve more than they build
        if ((p.age | 0) >= 30) { t.maint[p.name] = t.maint[p.name] || {}; t.maint[p.name][id] = (t.maint[p.name][id] || 0) + 1; }
        if (foNsRnd(key + "|" + p.name + "|" + id) < ch) foNsGain(p, pool, S.nm, doneR, t.log);
      });
    });
    // the coach's projects: one man, one named fault, double the hours
    (t.projects || []).slice(0, 2).forEach(function (pr) {
      if (!pr || !pr.n || !pr.k) return;
      var p = squad.filter(function (q) { return q.name === pr.n; })[0]; if (!p) return;
      var S = null; for (var id in FO_NS_SESS) if (FO_NS_SESS[id].sk.indexOf(pr.k) >= 0) S = FO_NS_SESS[id];
      var ch = Math.min(0.85, 2 * foNsBase(p.age | 0) * acad * foNsEnergy(p) * (S && S.coach && t.coaches[S.coach] ? 1.3 : 1));
      if ((p.age | 0) >= 30 && S) { t.maint[p.name] = t.maint[p.name] || {}; }
      if (foNsRnd(key + "|proj|" + pr.n + "|" + pr.k) < ch) foNsGain(p, [pr.k], "Coach's project", doneR, t.log);
    });
    // the staff invoice their retainers through the club ledger
    if (typeof ledger === "function") {
      for (var c in t.coaches) if (t.coaches[c] && FO_NS_COACH[c]) ledger(FO_NS_COACH[c].nm + " retainer", -FO_NS_COACH[c].fee);
    }
  }
  if (typeof window.completeRound === "function" && !window.completeRound.__foNets) {
    var _cr = window.completeRound;
    window.completeRound = function () {
      var out = _cr.apply(this, arguments);
      try { foNsSettle(); if (typeof saveGame === "function") saveGame(false); } catch (e) {}
      return out;
    };
    window.completeRound.__foNets = 1;
  }

  // the engine's blind auto-trainer stops touching the user's squad - The
  // Nets is their training now - while bot squads keep the engine's own
  // program so the league's strength balance is exactly what it was
  if (typeof window.applyTraining === "function" && !window.applyTraining.__foNets) {
    window.applyTraining = function () {
      var h = (App.season.round * 77797 + App.seasonNo * 13) >>> 0;
      var rnd = function () { return ((h = (h * 1103515245 + 12345) >>> 0) / 4294967296); };
      for (var i = 0; i < GD.teams.length; i++) {
        if (i === App.teamIx) continue;
        var t = GD.teams[i];
        [t.players, t.youth || []].forEach(function (pool) {
          pool.forEach(function (p) {
            if (rnd() > 0.55) return;
            var ks = Object.keys(p.skills || {}); if (!ks.length) return;
            var sk = ks[Math.floor(rnd() * ks.length)];
            if (p.skills[sk] !== undefined && p.skills[sk] < 95) { p.skills[sk]++; try { if (typeof jsDerive === "function") jsDerive(p); } catch (e) {} }
          });
        });
      }
    };
    window.applyTraining.__foNets = 1;
  }

  // the winter dividend: veterans who kept attending decline more gently.
  // Six sessions banked in an area buys back one point of that area's
  // seasonal decline, two at most - upkeep, never improvement.
  if (typeof window.seasonEnd === "function" && !window.seasonEnd.__foNets) {
    var _se = window.seasonEnd;
    window.seasonEnd = function () {
      var t = TR(), maint = t.maint || {};
      var out = _se.apply(this, arguments);
      try {
        var me = userTeam();
        var AREA = { bat: ["vsPace", "vsSpin"], bowl: ["wicket", "economy"], field: ["fielding", "catching"], cond: ["stamina", "power"] };
        (me.players || []).forEach(function (p) {
          if ((p.age | 0) < 31 || !maint[p.name]) return;
          for (var id in AREA) {
            var back = Math.min(2, Math.floor((maint[p.name][id] || 0) / 6));
            if (!back) continue;
            AREA[id].forEach(function (k) { if (p.skills && p.skills[k] != null) p.skills[k] = Math.min(95, p.skills[k] + back); });
            t.log.unshift({ r: -1, s: (App.seasonNo || 1) - 1, n: p.name, k: id, why: "Winter upkeep (+" + back + ")" });
          }
          try { if (typeof jsDerive === "function") jsDerive(p); } catch (e) {}
        });
        t.maint = {}; if (t.log.length > 48) t.log.length = 48;
        if (typeof saveGame === "function") saveGame(false);
      } catch (e) {}
      return out;
    };
    window.seasonEnd.__foNets = 1;
  }

  // ---------------------------------------------------------------------------
  // The page (#/training)
  // ---------------------------------------------------------------------------
  function foSkillLbl(k) {
    return ({ vsPace: "vs pace", vsSpin: "vs spin", rotation: "rotation", temperament: "temperament", power: "power",
      wicket: "wicket threat", economy: "economy", discipline: "discipline", variation: "variation", stamina: "stamina",
      fielding: "ground fielding", catching: "catching", keeping: "keeping", stumping: "stumping" })[k] || k;
  }
  window.foRenderNetsPage = function () {
    try { if (window.foLsCss) window.foLsCss(); } catch (eLs) {}   // this room wears the season sheet's buttons
    var page = document.getElementById("page"); if (!page || !ready()) return;
    foNsCss();
    document.body.classList.add("fo-nets-on");
    var t = TR(), me = userTeam();
    var squad = (me.players || []).concat(me.youth || []);

    // ---- THE NETS ARE THE WORLD'S NETS --------------------------------------
    // One training ground. The plan a manager sets here is a standing order
    // held by the World Service: whatever stands when a round settles is the
    // work that round did, worked by the umpire on the men who actually play,
    // whether or not this phone is on. The programme list and the arithmetic
    // both belong to the shipped engine, so there is only ever one model of
    // what a week in the nets does.
    var world = null;
    try { world = window.__foWorldClaim || null; } catch (eW) {}
    var plan = {};
    try { plan = window.__foWorldPlan || {}; } catch (eP) {}
    var PROGS = (function () {
      try {
        var k = Object.keys(window.FO_TRAIN_PROGS || {});
        if (k.length) return k.filter(function (x) { return x !== "Rest"; }).concat(["Rest"]);
      } catch (e) {}
      return ["Batting", "Power hitting", "Finishing", "Bowling", "New-ball seam", "Spin bowling",
        "Death bowling", "Control bowling", "Keeping", "Fielding", "Fitness", "All-rounder", "Rest"];
    })();
    var planHTML = squad.map(function (p) {
      var cur = plan[p.name] || "";
      var prog = (p.trainProgress || {});
      var best = "", bestPct = 0;
      for (var k in prog) {
        var th = 80 + ((p.skills && p.skills[k]) || 0) * 1.5;
        var pc = Math.min(99, Math.round(100 * (prog[k] || 0) / th));
        if (pc > bestPct) { bestPct = pc; best = k; }
      }
      // A NAME IN THE NETS IS A MAN. The nets is where a manager looks hardest
      // at his own players - and it was the one room where their names were
      // dead text, so checking a career meant leaving and coming back through
      // the squad. The row is a label wrapping a select, so the link sits
      // outside the label's own hit area rather than fighting it for the tap.
      return "<div class='fo-ns-man'>" +
        "<span class='fo-ns-mn'><b><a class='fo-ns-lk' href='#/player?n=" + encodeURIComponent(p.name) + "'>" +
        E(p.name) + "</a></b><i>" + (p.age | 0) + " &middot; " +
        (bestPct ? E(foSkillLbl(best)) + " " + bestPct + "%" : "no work banked yet") + "</i></span>" +
        "<select class='fo-ns-prog' data-p='" + E(p.name) + "'>" +
        "<option value=''>the coach decides</option>" +
        PROGS.map(function (pr) {
          return "<option value=\"" + E(pr) + "\"" + (pr === cur ? " selected" : "") + ">" + E(pr) + "</option>";
        }).join("") + "</select></div>";
    }).join("");
    var planPanel = "<div class='fo-ns-panel'><h3>The plan <span>" +
      (world ? "standing orders &middot; the umpire works them every round" : "sign in to send these to the world") + "</span></h3>" +
      "<div class='fo-ns-men'>" + planHTML + "</div></div>";
    var sessHTML = Object.keys(FO_NS_SESS).map(function (id) {
      var S = FO_NS_SESS[id], on = t.sessions.indexOf(id) >= 0;
      var coachOn = S.coach && t.coaches[S.coach];
      return "<button type='button' class='fo-ns-sess" + (on ? " on" : "") + "' data-ns-sess='" + id + "'>" +
        "<i>" + S.ic + "</i><b>" + S.nm + (coachOn ? " <u title='Coach on staff'>+</u>" : "") + "</b><span>" + S.sub + "</span></button>";
    }).join("");
    var projHTML = [0, 1].map(function (i) {
      var pr = t.projects[i] || {};
      var pOpts = "<option value=''>&mdash; pick a player &mdash;</option>" + squad.map(function (p) {
        return "<option value=\"" + E(p.name) + "\"" + (pr.n === p.name ? " selected" : "") + ">" + E(p.name) + " (" + (p.age | 0) + ")</option>";
      }).join("");
      var kOpts = "<option value=''>&mdash; the fault &mdash;</option>" + FO_NS_PROJ_SK.map(function (k) {
        return "<option value='" + k + "'" + (pr.k === k ? " selected" : "") + ">" + E(foSkillLbl(k)) + "</option>";
      }).join("");
      return "<div class='fo-ns-proj'><em>Project " + (i + 1) + "</em>" +
        "<select data-ns-pn='" + i + "'>" + pOpts + "</select>" +
        "<select data-ns-pk='" + i + "'>" + kOpts + "</select></div>";
    }).join("");
    var staffHTML = Object.keys(FO_NS_COACH).map(function (c) {
      var C = FO_NS_COACH[c], on = !!t.coaches[c];
      return "<button type='button' class='fo-ns-coach" + (on ? " on" : "") + "' data-ns-coach='" + c + "'>" +
        "<b>" + C.nm + "</b><span>" + (on ? "on staff &middot; $" + C.fee.toLocaleString() + " a round" : "hire &middot; $" + C.fee.toLocaleString() + " a round") + "</span></button>";
    }).join("");
    var gains = {}, rows = foNsLog().slice(0, 14).map(function (l) {
      gains[l.n] = (gains[l.n] || 0) + 1;
      return "<div class='fo-ns-line'><b>" + E(l.n) + "</b> " + (l.r >= 0 ? "+1 " + E(foSkillLbl(l.k)) : E(l.why)) +
        " <span>" + (l.r >= 0 ? E(l.why) + " &middot; R" + (l.r + 1) : "season " + l.s) + "</span></div>";
    }).join("");
    page.innerHTML = "<div class='fo-ns'>" +
      "<div class='fo-ns-in'>" +
      "<header class='fo-nvmast'><div class='k'>" + E(me.name) + " &middot; the training ground</div>" +
      "<h1>The Nets</h1></header>" +
      "<div class='fo-ns-grid'>" +
      planPanel +
      "<div class='fo-ns-panel'><h3>Development report</h3>" + (rows || "<p class='fo-ns-note'>No gains recorded yet.</p>") + "</div>" +
      "</div>" +
      "<div class='fo-cer-actions'><a class='fo-ls-btn ghost' href='#/academy'>&lsaquo; The academy</a><a class='fo-ls-btn ghost' href='#/squad'>The squad &rsaquo;</a></div>" +
      "</div></div>";
    // a programme changed is a standing order sent to the world, debounced
    page.querySelectorAll(".fo-ns-prog").forEach(function (sl) {
      sl.addEventListener("change", function () {
        var next = {};
        page.querySelectorAll(".fo-ns-prog").forEach(function (x) {
          if (x.value) next[x.getAttribute("data-p")] = x.value;
        });
        try { window.__foWorldPlan = next; } catch (eS) {}
        if (window.__foWorldPushTraining) window.__foWorldPushTraining(next);
        else { try { toast("Sign in to send the nets to the world."); } catch (eT) {} }
      });
    });
    // if the world has not told us the plan yet, ask and repaint when it does
    try { if (window.__foWorldPlan == null && window.__foWorldRefreshPlan) window.__foWorldRefreshPlan(); } catch (eR) {}

    var save = function () { try { saveGame(false); } catch (e) {} window.foRenderNetsPage(); };
    page.querySelectorAll("[data-ns-sess]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-ns-sess"), ix = t.sessions.indexOf(id);
        if (ix >= 0) t.sessions.splice(ix, 1);
        else { t.sessions.push(id); while (t.sessions.length > 3) t.sessions.shift(); }
        if (!t.sessions.length) t.sessions = ["bat"];
        save();
      });
    });
    page.querySelectorAll("select[data-ns-pn]").forEach(function (s) {
      s.addEventListener("change", function () {
        var i = +s.getAttribute("data-ns-pn"); t.projects[i] = t.projects[i] || {};
        t.projects[i].n = s.value || null; save();
      });
    });
    page.querySelectorAll("select[data-ns-pk]").forEach(function (s) {
      s.addEventListener("change", function () {
        var i = +s.getAttribute("data-ns-pk"); t.projects[i] = t.projects[i] || {};
        t.projects[i].k = s.value || null; save();
      });
    });
    page.querySelectorAll("[data-ns-coach]").forEach(function (b) {
      b.addEventListener("click", function () {
        var c = b.getAttribute("data-ns-coach");
        t.coaches[c] = !t.coaches[c]; save();
      });
    });
  };
  window.addEventListener("hashchange", function () { if ((location.hash || "").split("?")[0] !== "#/training") document.body.classList.remove("fo-nets-on"); });

  // the desk hears about the week
  window.foNetsCard = function () {
    if (!ready()) return "";
    var t = TR();
    var names = t.sessions.map(function (id) { return FO_NS_SESS[id] ? FO_NS_SESS[id].nm : id; }).join(" &middot; ");
    var recent = foNsLog().slice(0, 2).map(function (l) {
      return "<div class='fo-ls-line'><b>" + E(l.n) + "</b> " + (l.r >= 0 ? "+1 " + E(foSkillLbl(l.k)) : E(l.why)) + "</div>";
    }).join("");
    var projN = (t.projects || []).filter(function (p) { return p && p.n && p.k; }).length;
    return "<div class='fo-card fo-ls-card pap alma'><div class='fo-card-h2row'><div class='fo-card-h2'>The nets</div><span class='fo-ls-k'>" + t.sessions.length + " sessions &middot; " + projN + " projects</span></div>" +
      "<div class='fo-alma-sub'>" + names + "</div><div class='fo-card-b'>" +
      (recent || "<div class='fo-ls-line fo-ls-fine'>The week's gains show after the round.</div>") +
      "<a class='fo-ls-btn ghost' href='#/training'>Set the week &rsaquo;</a></div></div>";
  };

  function foNsCss() {
    if (document.getElementById("fo-ns-css")) return;
    var s = document.createElement("style"); s.id = "fo-ns-css";
    s.textContent = [
      "html body.ftpskin.fo-nets-on,html body.fo-nets-on{background:#E9E4D8 !important;isolation:isolate}",
      "html body.fo-nets-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body.fo-nets-on #page{padding:0 !important;margin:0 !important;background:transparent !important}",
      ".fo-ns{position:relative;min-height:100vh;color:#26301F;padding:72px 18px 40px;isolation:isolate}",
      ".fo-ns-bg{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 45%;z-index:-2}",
      ".fo-ns-veil{position:fixed;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(7,10,6,.22),rgba(8,11,7,.10) 32%,rgba(7,10,6,.14) 66%,rgba(5,7,4,.34))}",
      ".fo-ns-in{max-width:1120px;margin:0 auto}",
      ".fo-ns-h1{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;font-size:clamp(40px,6.4vw,72px);line-height:.9;margin:0 0 8px;color:#141C28}",
      ".fo-ns .fo-cer-eyebrow{color:#B44A22 !important;text-shadow:none}",
      ".fo-ns-tag{font-family:Georgia,serif;font-style:italic;font-size:14.5px;color:#fff;margin:0 0 22px;max-width:60ch;text-shadow:0 2px 12px rgba(0,0,0,.65)}",
      ".fo-ns-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:22px}",
      "@media(max-width:900px){.fo-ns-grid{grid-template-columns:minmax(0,1fr)}}",
      ".fo-ns-panel{background:rgba(252,251,246,.9);border:1px solid rgba(60,80,45,.16);border-radius:16px;padding:15px 17px;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 14px 34px rgba(30,40,20,.18)}",
      ".fo-ns-panel h3{margin:0 0 10px;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#8A6A1F;display:flex;justify-content:space-between;align-items:baseline}",
      ".fo-ns-men{display:grid;gap:6px;margin-top:6px}",
      // the man rows sit INSIDE the light .fo-ns-panel, so they carry the same
      // ink as .fo-ns-sess below - white-on-cream left a squad list you could
      // not read at all
      ".fo-ns-man{display:flex;align-items:center;gap:9px;background:rgba(255,255,255,.85);border:1px solid rgba(60,80,45,.22);border-radius:11px;padding:8px 10px;min-width:0}",
      "html body #page .fo-ns-lk{color:inherit !important;text-decoration:none !important;border-bottom:1px dotted rgba(60,80,45,.45)}",
      "html body #page .fo-ns-lk:hover{color:#B44A22 !important;border-bottom-color:rgba(180,74,34,.7)}",
      ".fo-ns-mn{flex:1 1 auto;min-width:0;display:block}",
      ".fo-ns-mn b{display:block;font:600 12.5px/1.25 Inter,sans-serif;color:#26301F;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".fo-ns-mn i{display:block;font:400 10px/1.3 Inter,sans-serif;font-style:normal;color:#6E7E5A}",
      "html body #page .fo-ns-prog{flex:none;max-width:50%;font:500 11px/1.1 Inter,sans-serif !important;border:1px solid rgba(20,28,40,.2) !important;border-radius:9px !important;padding:8px 8px !important;background:#FFFEFC !important;color:#141C28 !important;-webkit-appearance:menulist;appearance:menulist}",
      "html body #page .fo-ns-prog option{color:#141C28;background:#FFFEFC}",
      ".fo-ns-panel h3 span{font-size:9.5px;color:#6E7E5A;letter-spacing:.14em}",
      ".fo-ns-note{font-family:Georgia,serif;font-style:italic;font-size:12px;color:#6E7E5A;margin:0 0 10px}",
      ".fo-ns-sessgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}",
      "html body #page .fo-ns-sess{text-align:left;border:1px solid rgba(60,80,45,.22) !important;border-radius:11px !important;background:rgba(255,255,255,.85) !important;color:#33402a !important;padding:11px 12px !important;cursor:pointer;transition:.15s;font:inherit !important}",
      "html body #page .fo-ns-sess.on{border-color:#C89A2E !important;background:rgba(250,242,218,.95) !important;box-shadow:0 0 0 1px rgba(200,154,46,.4),0 6px 16px rgba(30,40,20,.18)}",
      ".fo-ns-sess i{font-style:normal;font-size:15px;margin-right:6px}",
      ".fo-ns-sess b{font-family:Oswald,sans-serif;font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;color:#26301F}",
      ".fo-ns-sess b u{text-decoration:none;color:#8A6A1F}",
      ".fo-ns-sess span{display:block;font-family:Georgia,serif;font-style:italic;font-size:11px;color:#6E7E5A;margin-top:3px;line-height:1.4}",
      ".fo-ns-proj{display:flex;gap:8px;align-items:center;margin-bottom:9px;flex-wrap:wrap}",
      ".fo-ns-proj em{font-family:Oswald,sans-serif;font-style:normal;font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:#6E7E5A;width:70px}",
      "html body #page .fo-ns-proj select{flex:1;min-width:130px;background:#FFFEFC !important;color:#26301F !important;border:1px solid rgba(60,80,45,.3) !important;border-radius:8px;padding:8px 9px;font:500 12.5px Inter,sans-serif}",
      "html body #page .fo-ns-coach{display:flex;justify-content:space-between;align-items:baseline;width:100%;text-align:left;border:1px solid rgba(60,80,45,.22) !important;border-radius:10px !important;background:rgba(255,255,255,.85) !important;color:#33402a !important;padding:10px 12px !important;margin-bottom:8px;cursor:pointer;font:inherit !important;transition:.15s}",
      "html body #page .fo-ns-coach.on{border-color:#1F9E72 !important;background:rgba(235,249,242,.95) !important;box-shadow:0 0 0 1px rgba(31,158,114,.35)}",
      ".fo-ns-coach b{font-family:Oswald,sans-serif;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#26301F}",
      ".fo-ns-coach span{font-size:11px;color:#6E7E5A}",
      ".fo-ns-coach.on span{color:#1F9E72}",
      ".fo-ns-line{margin:0 0 7px;font-size:12.5px;color:#3d4a30}.fo-ns-line b{color:#1d2417}.fo-ns-line span{color:#75845F;font-size:11px}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
