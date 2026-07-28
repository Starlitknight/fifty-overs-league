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
  function A() { return window.AL || null; }
  function onNets() { return (location.hash || "").split("?")[0] === "#/training"; }

  // ---------------------------------------------------------------------------
  // THE NETS ARE THE WORLD'S NETS. The plan a manager sets here is a standing
  // order held by the World Service: whatever stands when a round settles is
  // the work that round did, worked by the umpire on the men who actually
  // play, whether or not this phone is on. The programme list and the
  // arithmetic both belong to the shipped engine, so there is only ever one
  // model of what a week in the nets does.
  //
  // PHASE 3 OF THE ALMANACK. The room used to compute a week of sessions,
  // coach's projects and hired staff, and then not render any of it - three
  // panels of dead code and a stylesheet for a screen nobody could see. What
  // it actually is, and all it ever was after the world took the nets over,
  // is one standing order per man and the report of what that work bought.
  // ---------------------------------------------------------------------------
  function progs() {
    try {
      var k = Object.keys(window.FO_TRAIN_PROGS || {});
      if (k.length) return k.filter(function (x) { return x !== "Rest"; }).concat(["Rest"]);
    } catch (e) {}
    return ["Batting", "Power hitting", "Finishing", "Bowling", "New-ball seam", "Spin bowling",
      "Death bowling", "Control bowling", "Keeping", "Fielding", "Fitness", "All-rounder", "Rest"];
  }
  // how far a man is through his current piece of work, in his own best area
  function banked(p) {
    var prog = p.trainProgress || {}, best = "", pct = 0;
    for (var k in prog) {
      var th = 80 + ((p.skills && p.skills[k]) || 0) * 1.5;
      var v = Math.min(99, Math.round(100 * (prog[k] || 0) / th));
      if (v > pct) { pct = v; best = k; }
    }
    return { skill: best, pct: pct };
  }

  window.foRenderNetsPage = function () {
    if (!onNets()) return;
    var page = document.getElementById("page"); if (!page || !ready()) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e) {}

    var t = TR(), me = userTeam();
    var squad = (me.players || []).concat(me.youth || []);
    var world = null; try { world = window.__foWorldClaim || null; } catch (eW) {}
    var plan = {}; try { plan = window.__foWorldPlan || {}; } catch (eP) {}
    var PROGS = progs();
    var named = squad.filter(function (p) { return plan[p.name]; }).length;

    var body = al.mast("The training ground", "The Nets",
      "Name what each man works on. The World Service holds the plan and the umpire runs it with every round, " +
      "whether you watch it or not.") + al.subnav("training");

    body += al.decide({
      kind: world ? (named ? "done" : "act") : "act",
      title: world
        ? named + " of " + squad.length + " men have a programme"
        : "The plan is not going anywhere yet",
      note: world
        ? "Standing orders. The umpire works them every round, awake or asleep — the rest train to their trade."
        : "Sign in to the account that holds your club and these become standing orders in the served world.",
    });

    // ---- one standing order per man ----------------------------------------
    var rows = squad.map(function (p) {
      var b = banked(p), cur = plan[p.name] || "";
      return '<label class="al-prow al-prow--static al-prow--pick">' +
        '<span class="al-prow__no">' + (p.age | 0) + "</span>" +
        '<span class="al-prow__who"><b>' + E(p.name) + "</b><i>" +
          (b.pct ? E(foSkillLbl(b.skill)) + " " + b.pct + "% of the way" : "no work banked yet") + "</i>" +
          (b.pct ? al.meter(b.pct, "warm") : "") + "</span>" +
        '<span class="al-prow__act"><select class="al-field fo-ns-prog" data-p="' + E(p.name) + '" aria-label="Programme for ' + E(p.name) + '">' +
        '<option value="">the coach decides</option>' +
        PROGS.map(function (pr) {
          return '<option value="' + E(pr) + '"' + (pr === cur ? " selected" : "") + ">" + E(pr) + "</option>";
        }).join("") + "</select></span></label>";
    }).join("");
    body += al.sec("The plan · " + squad.length + " men",
      squad.length ? '<div class="al-players">' + rows + "</div>"
                   : al.empty("No squad yet", "Your men arrive with your club."));

    // ---- what the work bought ----------------------------------------------
    var log = (t.log || []).slice(0, 14);
    body += al.sec("Development report", log.length
      ? al.ledger(log.map(function (l) {
          return [l.n + " · " + (l.r >= 0 ? l.why + " · R" + (l.r + 1) : "season " + l.s),
            l.r >= 0 ? "+1 " + foSkillLbl(l.k) : l.why, l.r >= 0 ? "pos" : "neg"];
        }))
      : al.empty("Nothing banked yet", "The first week's work shows after the round settles."));

    page.innerHTML = al.page({ body: body });

    // a programme changed is a standing order sent to the world
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
  };

  // the desk hears about the week
  window.foNetsCard = function () {
    if (!ready()) return "";
    var t = TR();
    var names = t.sessions.map(function (id) { return FO_NS_SESS[id] ? FO_NS_SESS[id].nm : id; }).join(" &middot; ");
    var recent = (t.log || []).slice(0, 2).map(function (l) {
      return "<div class='fo-ls-line'><b>" + E(l.n) + "</b> " + (l.r >= 0 ? "+1 " + E(foSkillLbl(l.k)) : E(l.why)) + "</div>";
    }).join("");
    var projN = (t.projects || []).filter(function (p) { return p && p.n && p.k; }).length;
    return "<div class='fo-card fo-ls-card pap alma'><div class='fo-card-h2row'><div class='fo-card-h2'>The nets</div><span class='fo-ls-k'>" + t.sessions.length + " sessions &middot; " + projN + " projects</span></div>" +
      "<div class='fo-alma-sub'>" + names + "</div><div class='fo-card-b'>" +
      (recent || "<div class='fo-ls-line fo-ls-fine'>The week's gains show after the round.</div>") +
      "<a class='fo-ls-btn ghost' href='#/training'>Set the week &rsaquo;</a></div></div>";
  };

})();
