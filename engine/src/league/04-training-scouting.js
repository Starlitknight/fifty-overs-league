  // ===========================================================================
  //  TRAINING & YOUTH SCOUTING (From-the-Pavilion-style)
  //  The engine already carries the training MODEL (weighted programs, potential
  //  tiers, age/fatigue/academy factors, progress thresholds) · this adds the UI
  //  and the multiplayer plumbing: choices ride the order packet (fo_training /
  //  fo_youth) and the resolver applies them even-handedly for every club.
  // ===========================================================================
  var FO_TR_PROGS = ["Batting", "New-ball batting", "Spin batting", "Power hitting", "Finishing",
    "Bowling", "New-ball seam", "Spin bowling", "Death bowling", "Control bowling",
    "Keeping", "Fielding", "Fitness", "All-rounder", "Rest"];
  var FO_TR_INT = ["Light", "Normal", "Intense", "Rest"];
  var FO_TR_PROGMAP = {
    "Batting": { vsPace: 25, vsSpin: 25, rotation: 20, temperament: 20, stamina: 10 },
    "New-ball batting": { vsPace: 45, temperament: 25, rotation: 15, stamina: 15 },
    "Spin batting": { vsSpin: 45, rotation: 20, temperament: 20, power: 15 },
    "Power hitting": { power: 50, vsPace: 15, vsSpin: 15, temperament: 10, stamina: 10 },
    "Finishing": { power: 35, temperament: 25, rotation: 20, vsPace: 10, vsSpin: 10 },
    "Bowling": { wicket: 25, economy: 25, discipline: 20, moveTurn: 15, variation: 10, stamina: 5 },
    "New-ball seam": { moveTurn: 30, wicket: 25, discipline: 20, economy: 15, stamina: 10 },
    "Spin bowling": { moveTurn: 30, wicket: 25, variation: 20, economy: 15, discipline: 10 },
    "Death bowling": { economy: 30, discipline: 30, variation: 20, stamina: 15, wicket: 5 },
    "Control bowling": { economy: 40, discipline: 30, variation: 15, stamina: 15 },
    "Keeping": { keeping: 30, catching: 25, stumping: 25, fielding: 15, stamina: 5 },
    "Fielding": { fielding: 40, catching: 30, stamina: 20, power: 10 },
    "Fitness": { stamina: 65, power: 25, fielding: 10 },
    "All-rounder": { vsPace: 15, vsSpin: 15, wicket: 15, economy: 15, fielding: 20, stamina: 20 },
    "Rest": {}
  };
  // what each program actually trains, rendered straight from the weight map
  // so the explanation can never drift from the mechanics
  var FO_SK_COLOR = {
    vsPace: "#C95532", vsSpin: "#D98B5F", rotation: "#E8B08C", temperament: "#A34A28", power: "#F59E0B",
    wicket: "#0E233F", economy: "#2E4A73", discipline: "#4A6B99", moveTurn: "#6E8FBD", variation: "#98B3D9",
    stamina: "#16A34A", fielding: "#2F7A6B", catching: "#4DA6A2", keeping: "#1F5F58", stumping: "#6BBFA3"
  };
  function foProgExplainHTML() {
    var groups = [
      ["Batting schools", ["Batting", "New-ball batting", "Spin batting", "Power hitting", "Finishing"]],
      ["Bowling schools", ["Bowling", "New-ball seam", "Spin bowling", "Death bowling", "Control bowling"]],
      ["Glove, field & body", ["Keeping", "Fielding", "Fitness"]],
      ["Everything else", ["All-rounder", "Rest"]]
    ];
    var card = function (prog) {
      var w = FO_TR_PROGMAP[prog] || {};
      var keys = Object.keys(w).sort(function (a2, b2) { return w[b2] - w[a2]; });
      if (prog === "Rest") return "<div class='fo-trx'><b>Rest</b><div class='fo-trx-rest'>No skill work: the week goes to recovery. Fatigue falls instead of rising.</div></div>";
      var segs = keys.map(function (k) {
        var c = FO_SK_COLOR[k] || "#667085";
        return "<i style='width:" + w[k] + "%;background:" + c + "' title='" + E(foSkillLabel(k)) + " " + w[k] + "%'>" + (w[k] >= 20 ? "<em>" + w[k] + "</em>" : "") + "</i>";
      }).join("");
      var leg = keys.map(function (k) {
        return "<span class='fo-trx-lg'><u style='background:" + (FO_SK_COLOR[k] || "#667085") + "'></u>" + E(foSkillLabel(k)) + " <b>" + w[k] + "%</b></span>";
      }).join("");
      return "<div class='fo-trx'><b>" + E(prog) + "</b><div class='fo-trx-stack'>" + segs + "</div><div class='fo-trx-legend'>" + leg + "</div></div>";
    };
    return groups.map(function (g) {
      return "<div class='fo-trx-gh'>" + g[0] + "</div><div class='fo-trx-grid'>" + g[1].map(card).join("") + "</div>";
    }).join("");
  }
  // energy flips the fatigue framing: high = good, like every game they know.
  // The engine's own vocabulary survives in the tooltip.
  var FO_FAT_LADDER = ["rested", "revived", "energetic", "passable", "satisfactory", "moderate", "weary", "listless", "exhausted", "shattered", "clinically dead"];
  function foEnergyOf(p) {
    var w = String(p.fatigue || "rested").toLowerCase();
    var ix = FO_FAT_LADDER.indexOf(w); if (ix < 0) ix = (w === "tired" ? 7 : 0);
    return { pct: Math.max(6, 100 - ix * 10), word: ix <= 2 ? "fresh" : ix <= 5 ? "rested" : "tired", raw: w, tired: ix >= 6 };
  }
  // the safe choice, marked where the choice happens: tired players are
  // suggested Rest before any skill program
  function foTrSuggest(p) { return foEnergyOf(p).tired ? "Rest" : foTrDefault(p); }
  // honest pace band - the per-matchday rate is shaped by age, energy and
  // intensity, so we band it rather than fake a precise matchday count
  function foTrPace(p, tr) {
    if (tr.program === "Rest") return "recovering";
    var en = foEnergyOf(p);
    var v = (p.age <= 21 ? 3 : p.age <= 25 ? 2.2 : p.age <= 29 ? 1.4 : 0.7);
    v *= en.tired ? 0.45 : (en.word === "rested" ? 0.85 : 1);
    return v >= 2.4 ? "training fast" : v >= 1.3 ? "training steadily" : v >= 0.7 ? "training slowly" : "barely moving";
  }
  function foTrKey() { return "fol_train_" + (LG ? LG.id : "solo"); }
  function foTrainState() {
    var raw = lsGet(foTrKey()), s = null;
    try { s = JSON.parse(raw || "null"); } catch (e) {}
    if (!s || typeof s !== "object") s = {};
    if (!s.training) s.training = {};
    if (!s.youthPending) s.youthPending = [];
    if (s.lastSignRound == null) s.lastSignRound = -99;
    return s;
  }
  function foTrainSave(s) { lsSet(foTrKey(), JSON.stringify(s)); }
  function foIsPace(p) {
    if (!p) return false;
    if (p.bowlTypeFull && p.bowlTypeFull !== "none") return /seam/i.test(p.bowlTypeFull);
    try { return typeClass(p.bowlType) === "pace"; } catch (e) { return false; }
  }
  // West Indies has no national emoji/flag: use the canonical cricket look,
  // a palm tree on an island against maroon, wherever the WI flag appears.
  var FO_WI_FLAG = "data:image/svg+xml," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 40'>" +
    "<rect width='60' height='40' rx='3' fill='#7B1F3A'/>" +
    "<circle cx='20' cy='15' r='8' fill='#F4A61D'/>" +
    "<path d='M12 35c9-3 27-3 36 0v5H12z' fill='#E8D9A0'/>" +
    "<path d='M37 34c1-6 0-11-2-15l4-1c2 5 2 11 1 16z' fill='#6B4A2B'/>" +
    "<path d='M38 18c-7-4-13-3-17 1 7 0 12 1 17 2z' fill='#2F7A3D'/>" +
    "<path d='M38 18c7-4 13-3 17 1-7 0-12 1-17 2z' fill='#2F7A3D'/>" +
    "<path d='M38 18c-5-6-10-8-15-6 5 2 10 4 15 8z' fill='#16A34A'/>" +
    "<path d='M38 18c5-6 10-8 15-6-5 2-10 4-15 8z' fill='#16A34A'/>" +
    "<path d='M38 18c0-7-2-11-7-13 2 4 4 9 7 13z' fill='#2F7A3D'/>" +
    "</svg>");
  function foWIFlagImg() { return '<img class="foflag" src="' + FO_ART + 'flags/wi.svg" alt="West Indies" title="West Indies">'; }
  // overlay render sites go through this wrapper; engine-rendered pages are
  // swept by foFixWIFlags() on every route
  // every nationality flies its REAL flag (SVGs under art/flags/); the West
  // Indies keep their painted maroon standard - there is no ISO flag to fly
  var FO_FLAG_ART = {
    England: "eng", ENG: "eng", Australia: "aus", AUS: "aus", India: "ind", IND: "ind",
    Pakistan: "pak", PAK: "pak", "Sri Lanka": "sri", SRI: "sri", "New Zealand": "nz", NZ: "nz",
    "South Africa": "saf", SAF: "saf", Netherlands: "ned", NED: "ned",
    Afghanistan: "afg", AFG: "afg", Ireland: "ire", IRE: "ire", Zimbabwe: "zim", ZIM: "zim",
    Canada: "can", CAN: "can", USA: "usa", "United States": "usa", Kenya: "ken", KEN: "ken",
    Nepal: "nep", NEP: "nep", Namibia: "nam", NAM: "nam", Oman: "oma", OMA: "oma",
    Scotland: "sco", SCO: "sco", Bangladesh: "ban", BAN: "ban", UAE: "uae", Wales: "wal", WAL: "wal",
    "West Indies": "wi", WI: "wi"
  };
  function foRealFlagSrc(nat) {
    var f = FO_FLAG_ART[(nat || "") + ""];
    return f ? (FO_ART + "flags/" + f + ".svg") : null;
  }
  try {
    var _foFlagOrig = (typeof foFlag === "function") ? foFlag : null;
    window.foFlag = function (nat) {
      var src = foRealFlagSrc(nat);
      if (src) return '<img class="foflag" src="' + src + '" alt="' + nat + '" title="' + nat + '">';
      if (/west indies/i.test((nat || "") + "")) return foWIFlagImg();
      return _foFlagOrig ? _foFlagOrig.apply(this, arguments) : "";
    };
    foFlag = window.foFlag;
  } catch (e) {}
  // engine-rendered pages emit the old baked-in flags; sweep them to the
  // real ones by their title (which carries the nationality/NORM code)
  function foFixWIFlags() {
    try {
      document.querySelectorAll("img.foflag[title]").forEach(function (i) {
        var src = foRealFlagSrc(i.getAttribute("title"));
        if (src && i.getAttribute("src") !== src) i.src = src;
      });
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(foFixWIFlags, 80); });

  function foMyClub() { try { return GD.teams[App.teamIx]; } catch (e) { return null; } }
  function foTrDefault(p) {
    if (p.keeper) return "Keeping";
    if (p.role === "allRounder") return "All-rounder";
    if (p.bowlTypeFull && p.bowlTypeFull !== "none") return foIsPace(p) ? "New-ball seam" : "Spin bowling";
    return p.role === "middleOrderBat" ? "Finishing" : "Batting";
  }
  function foTrOf(p) {
    var st = foTrainState(), o = st.training[p.name] || {};
    var prog = o.program || (p.training && p.training.program) || foTrDefault(p);
    // intensity is retired as a concept: Rest is a program, everything else
    // trains at the one honest speed
    return { program: prog, intensity: prog === "Rest" ? "Rest" : "Normal" };
  }
  function foPotential(p) {
    if (p.training && p.training.potential) return p.training.potential;
    var v = ((p.talent === "gifted" || (p.talents || []).length >= 2) ? 2 : 0) + (p.age <= 20 ? 2 : p.age <= 24 ? 1 : 0) + ((p.rating || 0) > 3600 ? 1 : 0);
    return v >= 4 ? "Star" : v >= 3 ? "High" : v >= 1 ? "Useful" : "Limited";
  }
  var FO_SKILL_LABELS = { vsPace: "vs pace", vsSpin: "vs spin", rotation: "strike rotation", temperament: "temperament", power: "power", stamina: "stamina", wicket: "wicket threat", economy: "economy", discipline: "discipline", moveTurn: "movement/turn", variation: "variation", keeping: "keeping", catching: "catching", stumping: "stumping", fielding: "fielding" };
  function foSkillLabel(k) { return FO_SKILL_LABELS[k] || k; }
  function foTrProgress(p) {
    // best progress toward the next +1 across the player's trained skills
    var tr = p.training || {}, prog = tr.progressBySkill || {}, best = 0, bestSk = "";
    for (var sk in prog) {
      var th = 80 + ((p.skills && p.skills[sk]) || 0) * 1.5;
      var pc = 100 * (prog[sk] || 0) / th;
      if (pc > best) { best = pc; bestSk = sk; }
    }
    if (!bestSk) {
      var w = FO_TR_PROGMAP[foTrOf(p).program] || {};
      var ks = Object.keys(w).sort(function (a, b) { return (w[b] || 0) - (w[a] || 0); });
      bestSk = ks[0] || "stamina";
    }
    return { skill: bestSk, pct: Math.min(99, Math.round(best)) };
  }
  function foSetTraining(name, field, value) {
    var st = foTrainState();
    st.training[name] = st.training[name] || {};
    st.training[name][field] = value;
    foTrainSave(st);
    // apply locally so the squad/office pages reflect it immediately
    try {
      var t = foMyClub(), p = t && t.players.find(function (x) { return x.name === name; });
      if (p) {
        if (!p.training) p.training = { program: null, intensity: "Normal", progressBySkill: {} };
        if (field === "program") { p.training.program = value; p.trainFocus = value; }
        else p.training.intensity = value;
        if (typeof window.saveGame === "function") window.saveGame(false);
      }
    } catch (e) {}
  }
  // Reapply my saved choices whenever a fresh snapshot lands (the snapshot only
  // carries choices the resolver has already seen).
  function foReapplyTraining() {
    try {
      var st = foTrainState(), t = foMyClub(); if (!t) return;
      for (var nm in st.training) {
        var p = t.players.find(function (x) { return x.name === nm; }); if (!p) continue;
        if (!p.training) p.training = { program: null, intensity: "Normal", progressBySkill: {} };
        if (st.training[nm].program) { p.training.program = st.training[nm].program; p.trainFocus = st.training[nm].program; }
        if (st.training[nm].intensity) p.training.intensity = st.training[nm].intensity;
      }
      // youth + market: drop pending signings that made it into the squad
      var before = st.youthPending.length + (st.marketPending || []).length;
      st.youthPending = st.youthPending.filter(function (y) { return !t.players.find(function (x) { return x.name === y.name; }); });
      st.marketPending = (st.marketPending || []).filter(function (y) { return !t.players.find(function (x) { return x.name === y.name; }); });
      if (st.youthPending.length + st.marketPending.length !== before) { foTrainSave(st); toast("Your new signing has joined the squad."); }
    } catch (e) {}
  }

  // ---- youth scouting: deterministic shortlist of 18-20 year olds ------------
  function foScoutSeed() {
    var r = (App.season && App.season.round) || 0;
    var t = foMyClub();
    return (LG ? LG.id : "solo") + "-scout-" + ((t && t.name) || "club") + "-" + r;
  }
  var FO_SCOUT_REVEAL_GAP = 3;   // matchdays between shortlist reveals
  function foScoutDefaultNat() { return (SYNC && SYNC.myTeam && SYNC.myTeam.country) || "Netherlands"; }
  function foScoutNats() {
    try { return Object.keys(NATNAMES).filter(function (k) { return k !== "NED" && NATNAMES[k] && Array.isArray(NATNAMES[k].fn); }); } catch (e) { return ["Netherlands", "England", "Australia", "India"]; }
  }
  // the shortlist only exists once revealed; it is deterministic from the
  // reveal round + chosen country, so it stays stable until the next reveal
  function foScoutList() {
    var t = foMyClub(); if (!t) return [];
    var st = foTrainState();
    if (!st.scoutReveal) return [];
    var nat = st.scoutReveal.nat || foScoutDefaultNat();
    var seedBase = (LG ? LG.id : "solo") + "-scout-" + ((t && t.name) || "club") + "-" + st.scoutReveal.round + "-" + nat;
    var picks = [], used = {};
    var take = function (p) { if (p && !used[p.name] && picks.length < 3 && !t.players.find(function (x) { return x.name === p.name; })) { used[p.name] = 1; picks.push(p); } };
    for (var k = 0; k < 6 && picks.length < 3; k++) {
      var pool = [];
      try { pool = buildCountryPool(seedBase + "-" + k, nat); } catch (e) { break; }
      var young = pool.filter(function (p) { return (p.age || 99) <= 20; });
      young.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
      if (k === 0) {
        take(young.find(function (p) { return p.keeper; }));
        take(young.find(function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none" && !p.keeper; }));
      }
      young.forEach(take);
    }
    return picks.map(function (p) {
      var q = JSON.parse(JSON.stringify(p));
      // the scout's lottery: every signing is FREE - quality is the gamble.
      // Tiers roll deterministically from the reveal seed: mostly raw kids,
      // the good ones rare, and once in a generation a genuine jewel.
      var roll = foHash32(seedBase + "-tier-" + p.name) % 1000;
      // a conquered Circuit nation's academy takes your calls: the same free
      // lottery, but the good tickets come up two-and-a-half times as often
      var acad = false;
      try { acad = foCxAcademyNats().indexOf(nat) >= 0; } catch (eAc) {}
      var tier = acad
        ? (roll < 30 ? "gen" : roll < 210 ? "gift" : roll < 520 ? "prom" : "raw")
        : (roll < 12 ? "gen" : roll < 95 ? "gift" : roll < 345 ? "prom" : "raw");
      foYouthBless(q, tier, seedBase);
      q.fee = 0;
      return q;
    });
  }
  // tier config: skill lift + talents granted. Talents also raise Potential,
  // so blessed youth train into their billing rather than just starting hot.
  var FO_YT = {
    gen: { lbl: "&#9670; Once in a generation", add: 16, tal: 2 },
    gift: { lbl: "&#9733; Gifted", add: 9, tal: 1 },
    prom: { lbl: "Promising", add: 4, tal: 0 },
    raw: { lbl: "Raw", add: 0, tal: 0 }
  };
  function foYouthBless(q, tier, seedBase) {
    q._ytier = tier;
    var c = FO_YT[tier] || FO_YT.raw;
    if (!c.add && !c.tal) return q;
    for (var k in (q.skills || {})) {
      if (typeof q.skills[k] === "number" && q.skills[k] > 8)
        q.skills[k] = Math.min(76, q.skills[k] + c.add + (foHash32(seedBase + q.name + k) % 4));
    }
    var want = c.tal;
    if (want) {
      var isB = q.bowlTypeFull && q.bowlTypeFull !== "none";
      var bank = q.keeper ? ["lightningHands", "safeHands", "fastStarter", "busyRunner"]
        : isB ? ["newBallSpecialist", "goldenArm", "miser", "deathSpecialist", "mysteryBall", "partnershipBreaker"]
        : ["fastStarter", "anchor", "finisher", "sixMachine", "spinKiller", "paceHunter", "busyRunner"];
      q.talents = (q.talents || []).slice();
      var h = foHash32(seedBase + "-tal-" + q.name);
      for (var a = 0; a < bank.length && want > 0; a++) {
        var t2 = bank[(h + a * 7) % bank.length];
        if (q.talents.indexOf(t2) < 0) { q.talents.push(t2); want--; }
      }
    }
    try { if (typeof window.jsDerive === "function") window.jsDerive(q); } catch (e) {}
    return q;
  }
  window.__folScoutPreview = function (round, nat) {
    try {
      var st = foTrainState(), prev = st.scoutReveal;
      st.scoutReveal = { round: round, nat: nat || "England" }; foTrainSave(st);
      var out = foScoutList();
      var st2 = foTrainState(); st2.scoutReveal = prev; foTrainSave(st2);
      return out;
    } catch (e) { return { err: String(e && e.message || e) }; }
  };   // debug/test hook (harmless)
  var FO_SCOUT_COOLDOWN = 3;   // matchdays between signings
  function foSignYouth(cand) {
    var st = foTrainState(), t = foMyClub(); if (!t) return;
    var round = (App.season && App.season.round) || 0;
    if (st.youthPending.length) { say("You already have a signing awaiting confirmation · it completes after the next matchday."); return; }
    if (round - st.lastSignRound < FO_SCOUT_COOLDOWN) { say("Your scout needs " + (FO_SCOUT_COOLDOWN - (round - st.lastSignRound)) + " more matchday(s) before the next signing."); return; }
    if ((t.players || []).length >= 18) { say("Squad is full (18) · release someone first."); return; }
    foConfirm({
      title: "Sign " + cand.name + "?",
      body: "Age " + cand.age + " · " + foRoleShort(cand) + " · free signing, then " + FO$(foDailyWage(cand)) + "/matchday wages. Young players train the fastest in the game.",
      confirm: "Sign " + cand.name.split(" ")[0], cancel: "Not yet"
    }).then(function (ok) {
      if (!ok) return;
      st.lastSignRound = round;
      cand._prov = { how: "youth", s: App.seasonNo || 1, r: round + 1, nat: (st.scoutReveal && st.scoutReveal.nat) || null };
      st.youthPending = [cand];
      foTrainSave(st);
      if (SYNC && SYNC.started && !SYNC.practice) {
        toast(cand.name + " agreed terms · the signing completes after the next matchday.");
      } else {
        // solo / practice: apply immediately through the engine's own books
        try {
          var p = JSON.parse(JSON.stringify(cand)); delete p.fee;
          p.fatigue = "rested"; p.formIx = 3;
          t.players.push(p);
          st.youthPending = []; foTrainSave(st);
          if (typeof window.saveGame === "function") window.saveGame(false);
          toast(cand.name + " joins the squad!");
        } catch (e) { say(e); }
      }
      foTrainingPage();
    });
  }

  // Full detail card for a scouted youngster (same layout as the draft popover).
  // The signing pitch IS the trading card: the same full holo card as the
  // player page and the pack rip, with the money and the Sign button under it.
  function foYouthDetail(p, isMarket) {
    if (!p) return;
    var old = document.getElementById("fo-pd"); if (old) old.remove();
    var built = foHoloCardHTML(p);
    var d = document.createElement("div"); d.id = "fo-pd";
    d.innerHTML = "<div class='fo-pd-back'><div class='fo-pd-holo ph-" + built.tier + "' style='--tc:" + built.ac[0] + ";--tcD:" + built.ac[1] + "'>" +
      "<button class='fo-pd-x fo-pd-hx'>&#10005;</button>" +
      "<div class='fo-phw'>" + built.html + "</div>" +
      "<div class='fo-pd-hmoney'><span>Signing fee<b>" + FO$(p.fee) + "</b></span><span>Wage / matchday<b>" + FO$(foDailyWage(p)) + "</b></span><span>Season wages<b>" + FO$(foDailyWage(p) * FO_FIN.seasonLength) + "</b></span></div>" +
      "<div class='fo-pd-act'><button class='fo-pd-add'>Sign " + E(p.name.split(" ")[0]) + " &middot; " + FO$(p.fee) + "</button></div>" +
      "</div></div>";
    document.body.appendChild(d);
    foHoloTilt(d.querySelector(".fo-phw"));
    d.querySelector(".fo-pd-x").addEventListener("click", function () { d.remove(); });
    d.querySelector(".fo-pd-back").addEventListener("click", function (e) { if (e.target.classList.contains("fo-pd-back")) d.remove(); });
    d.querySelector(".fo-pd-add").addEventListener("click", function () { d.remove(); if (isMarket) foMarketClaim(p); else foSignYouth(p); });
  }

