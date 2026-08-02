  // =================================================================
  //  ACCOUNT AUTH + THE COUNTRY PLAYER POOL.
  //
  //  This file used to be the in-game multiplayer sync engine: the league
  //  lobby, the shared-snapshot poller, the practice worlds, the relaunch
  //  machinery. That stack is retired - the served world (world_* RPCs,
  //  the umpire, 52-served-truth) is the only multiplayer now - and the
  //  sync engine's practice() could replace the whole world with generated
  //  bot clubs, which is how a Dutch XI once turned up wearing your shirt.
  //
  //  What remains is the two things the live game still needs from here:
  //    - account signup and password reset (Supabase auth, used by the
  //      sign-in overlay in 01-club-home)
  //    - buildCountryPool and the bowler-batting laws: the deterministic,
  //      country-flavoured player generator that onboarding, scouting and
  //      the transfer market all draw from
  // =================================================================
  function doJoinSignup() {
    var email = val("folEmail"), password = wrap.querySelector("#folPass").value;
    var code = val("folCode"), dn = val("folDn"), tn = val("folTn");
    if (!email || !password) { say("Enter your email and password"); return; }
    if (!code || !dn) { say("Enter your invite code and manager name"); return; }
    // Remember the invite so we can finish joining after email confirmation + login.
    lsSet(PEND, JSON.stringify({ code: code, dn: dn, tn: tn }));
    busyBtn("joinNew", "Creating account\u2026");
    fetch(URL + "/auth/v1/signup?redirect_to=" + encodeURIComponent(APP_URL), { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email: email, password: password, options: { email_redirect_to: APP_URL } }) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error_description || d.msg || d.error || ("HTTP " + r.status)); return d; }); })
      .then(function (d) {
        if (!d.access_token) { say("Account created! Check your email, tap the confirmation link, then log in. We'll drop you straight into your league."); renderLogin(); return; }
        JWT = d.access_token; saveSession(d); wrap.querySelector("#folWho").textContent = email;
        return enterApp();
      }).catch(function (e) { unbusyBtn("joinNew"); say(e); });
  }

  function sendReset() {
    var email = val("folEmail");
    if (!email) { say("Enter your email"); return; }
    busyBtn("sendReset", "Sending\u2026");
    fetch(URL + "/auth/v1/recover?redirect_to=" + encodeURIComponent(APP_URL), { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email: email }) })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || ("HTTP " + r.status)); }); })
      .then(function () { say("If that email has an account, a reset link is on its way."); renderLogin(); }).catch(function (e) { unbusyBtn("sendReset"); say(e); });
  }


  // The orders screen still offers window.__foGame.pushPacket (module 12
  // exports it eagerly, so the name must exist). The league it pushed to is
  // retired; the served world takes orders through world_* RPCs instead.
  function foPushCurrentPacket() { return false; }

  // 42 balanced players (same tier structure for everyone), all set to the
  // manager's country with country names, deterministic from their draft_seed.
  // Bowling styles have a pecking order: genuine quicks are the rarest thing
  // in the game, wrist spinners close behind (the engine backs this up with a
  // real wicket-threat edge for both). Pools get hard caps; the weakest
  // surplus is demoted to the nearest common style, deterministically.
  var FO_STYLE = {
    seamFast: { bt: "fast", label: "fast" },
    seamFastMedium: { bt: "fastMedium", label: "fast medium" },
    seamMedium: { bt: "medium", label: "medium" },
    wristSpin: { bt: "wristSpin", label: "wrist spin" },
    fingerSpin: { bt: "fingerSpin", label: "finger spin" }
  };
  function foSetBowlStyle(p, style) {
    var oldSt = FO_STYLE[p.bowlTypeFull], newSt = FO_STYLE[style];
    if (!oldSt || !newSt) return;
    if (p.btLabel) p.btLabel = p.btLabel.replace(oldSt.label, newSt.label);
    if (p.role === p.bowlTypeFull) p.role = style;
    p.bowlTypeFull = style;
    p.bowlType = newSt.bt;
  }
  function foEnforceStyleRarity(pool) {
    var caps = { seamFast: 0.05, wristSpin: 0.08, fingerSpin: 0.30 };
    var demoteTo = { seamFast: "seamFastMedium", wristSpin: "fingerSpin", fingerSpin: "seamMedium" };
    ["seamFast", "wristSpin", "fingerSpin"].forEach(function (style) {
      var frontline = pool.filter(function (p) { return FO_STYLE[p.bowlTypeFull]; });
      var have = frontline.filter(function (p) { return p.bowlTypeFull === style; });
      var max = Math.max(1, Math.floor(frontline.length * caps[style]));
      if (have.length <= max) return;
      have.sort(function (a, b) { return (a.rating || 0) - (b.rating || 0); });
      have.slice(0, have.length - max).forEach(function (p) { foSetBowlStyle(p, demoteTo[style]); });
    });
    return pool;
  }
  function buildCountryPool(seedInt, country) {
    // string seeds (league ids, "<club>-scout-3", …) hash to a real uint32 –
    // `str >>> 0` is always 0, which made every string-seeded pool identical
    if (typeof seedInt === "string") {
      var h = 2166136261;
      for (var si = 0; si < seedInt.length; si++) { h ^= seedInt.charCodeAt(si); h = Math.imul(h, 16777619); }
      seedInt = h >>> 0;
    }
    var prev = App.founder;
    App.founder = { identity: "Balanced XI" };   // neutral tilt so pools are equally strong
    var pool;
    try { pool = window.genDraftPool("league-" + (seedInt >>> 0)); }
    finally { App.founder = prev; }
    var rnd = window.rng((seedInt >>> 0) ^ 0x9e3779b9), used = new Set();
    pool.forEach(function (p) {
      p.nat = country;
      var nm = window.natName(country, rnd, used); used.add(nm); p.name = nm;
      fixTechniquePower(p, rnd);
    });
    foEnforceStyleRarity(pool);
    return pool;
  }

  // ---- pure bowlers bat like bowlers ---------------------------------------
  // A specialist bowler's batting comes from a bottom-heavy curve: mostly
  // dreadful or atrocious, often poor, sometimes ordinary, average at the very
  // best (and rare). Everything derives from the player's NAME, so every
  // client and the resolver agree exactly and re-applying changes nothing.
  function foPureBowler(p) {
    if (!p || p.keeper) return false;
    if (p.role === "allRounder" || p.role === "wicketkeeper") return false;
    return /^(seamFast|seamFastMedium|seamMedium|wristSpin|fingerSpin)$/.test(p.bowlTypeFull || "");
  }
  function foBowlerBatTarget(name) {
    var h = 2166136261, i;
    name = String(name || "");
    for (i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); }
    var x = (h >>> 0) || 1;
    var rr = function () { x = (x * 1103515245 + 12345) >>> 0; return x / 4294967296; };
    var u = rr(), lvl;
    if (u < 0.28) lvl = 2 + rr() * 6;         // atrocious
    else if (u < 0.58) lvl = 6 + rr() * 6;    // dreadful
    else if (u < 0.82) lvl = 11 + rr() * 6;   // poor
    else if (u < 0.95) lvl = 17 + rr() * 6;   // ordinary
    else lvl = 24 + rr() * 6;                 // average - as good as a specialist gets
    return { lvl: lvl, j1: (rr() - 0.5) * 6, j2: (rr() - 0.5) * 6, j3: (rr() - 0.5) * 6, j4: (rr() - 0.5) * 8 };
  }
  function foApplyBowlerBat(p, keepWage) {
    var s = p.skills || (p.skills = {});
    var t = foBowlerBatTarget(p.name);
    var cl = function (v) { return Math.max(4, Math.min(95, Math.round(v))); };
    s.vsPace = cl(t.lvl + t.j1);
    s.vsSpin = cl(t.lvl + t.j2);
    s.rotation = cl(t.lvl - 2 + t.j3);
    s.temperament = cl(t.lvl + 6 + t.j4);     // grit outlasts talent
    s.power = cl(Math.min(s.power == null ? 16 : s.power, t.lvl + 4));
    var w = p.wage;
    if (typeof window.jsDerive === "function") window.jsDerive(p);
    if (keepWage && w != null) p.wage = w;    // a signed contract does not shrink
  }
  // Lower-only, idempotent sweep for squads that already exist (drafted before
  // this rule): any specialist bowler batting well above his name-derived
  // ceiling is brought back down. Applying twice is a no-op.
  function foRepairBowlerBatting() {
    try {
      if (typeof GD === "undefined" || !GD.teams) return 0;
      // THE WORLD'S MEN ARE NOT THIS DEVICE'S TO REPAIR. This sweep exists for
      // squads THIS BROWSER drafted before the bowler-batting rule was written:
      // it re-derives a specialist's batting from his name and writes it over
      // whatever the draft gave him. Run against a served club it is not a
      // repair, it is a disagreement - the umpire published a bowler who bats
      // 47, the device decided he bats 4, and every figure on the squad page
      // then contradicted the server that actually plays his matches. (It also
      // calls jsDerive, which recomputes rating and wage - so the published
      // price of a man could drift too.)
      //
      // If this device holds a claim in the served world, its own squad comes
      // from the world and is the world's to describe. Everybody else's teams
      // in GD are local bot sides and still want the repair.
      var mine = null;
      try {
        if (window.__foServed && window.__foServed.on() && typeof userTeam === "function") mine = userTeam();
      } catch (eS) {}
      var n = 0;
      GD.teams.forEach(function (t) {
        if (mine && t === mine) return;
        (t.players || []).concat(t.injured || [], t.youth || []).forEach(function (p) {
          if (!foPureBowler(p)) return;
          if (p.__card) return;              // a public card is the world's word
          var s = p.skills || {};
          var agg = 0.25 * (s.vsPace || 0) + 0.25 * (s.vsSpin || 0) + 0.2 * (s.rotation || 0) + 0.15 * (s.temperament || 0) + 0.15 * (s.power || 0);
          // only true anomalies (above the "average" band): sane specialists stay
          if (agg > 32) { foApplyBowlerBat(p, true); n++; }
        });
      });
      return n;
    } catch (e) { return 0; }
  }
  setTimeout(function () { try { foRepairBowlerBatting(); } catch (e) {} }, 1500);

  // Enforce realistic technique/power relationships on a generated player, using
  // the game's own aggregate formulas (aggBat/aggBowl/aggTech). A "level" = 6.25.
  //   technique  = within 2 levels BELOW the headline batting/bowling skill
  //   power      = equal to, or 1–4 levels below, technique
  // Pure bowlers skip this path entirely: pulling their technique (vsPace/
  // vsSpin/temperament) toward the BOWLING headline is what quietly made every
  // drafted bowler a capable batter.
  function fixTechniquePower(p, rnd) {
    if (foPureBowler(p)) { foApplyBowlerBat(p); return; }
    var LV = 6.25, s = p.skills || {};
    var clamp = function (v) { return Math.max(5, Math.min(95, Math.round(v))); };
    var isBowler = p.bowlTypeFull && p.bowlTypeFull !== "none";
    var batAgg = 0.25 * s.vsPace + 0.25 * s.vsSpin + 0.2 * s.rotation + 0.15 * s.temperament + 0.15 * s.power;
    var bowlAgg = isBowler ? (s.wicket + s.economy + s.discipline + s.moveTurn + s.variation + s.stamina) / 6 : 0;
    var headline = Math.max(batAgg, bowlAgg);

    // technique target: at least ~1 level below headline (ideally lower), and no
    // more than 2 levels below. The 1-level cap absorbs the aggregate's slight
    // self-reference so technique lands reliably below the headline.
    var curTech = (s.vsPace + s.vsSpin + s.temperament) / 3;
    var techTarget = Math.max(headline - 2 * LV, Math.min(headline - 1.0 * LV, curTech));
    var dTech = techTarget - curTech;
    s.vsPace = clamp(s.vsPace + dTech); s.vsSpin = clamp(s.vsSpin + dTech); s.temperament = clamp(s.temperament + dTech);

    // power: equal to or 1–4 levels below the new technique
    var newTech = (s.vsPace + s.vsSpin + s.temperament) / 3;
    s.power = clamp(Math.max(newTech - 4 * LV, Math.min(newTech - (rnd() < 0.5 ? 0 : LV * (1 + rnd() * 3)), s.power)));

    if (typeof window.jsDerive === "function") window.jsDerive(p);   // recompute rating
  }

  window.__folBuildPool = buildCountryPool;   // debug/test hook (harmless)
  window.__folRepairBowlerBat = foRepairBowlerBatting;


