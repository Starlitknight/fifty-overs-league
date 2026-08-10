/* ============================================================================
   THE ACADEMY (#/academy) — the scout, and what a club pays for his finds.

   The youth system is retired for now (075): no colts list, no Colts Cup.
   What remains is the SCOUT - posted to a country, filing a report each rest
   day - and his find signs STRAIGHT INTO THE SENIOR SQUAD, one decision at
   one price. The academy's level still sets how good a boy he brings back.

   What a MANAGER decides is only ever two things: how good an academy to pay
   for, and whether to sign the man on the table. Both go through the world's
   own RPCs, which re-validate everything; this page could lie all it liked
   and the server would shrug.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foAcad) return; window.__foAcad = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  var UPKEEP = 900;                       // a level costs this much a round
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function jwt() { try { return (window.__foJWT && window.__foJWT()) || ""; } catch (e) { return ""; } }
  function rpc(fn, args) {
    return fetch(SB_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: "Bearer " + (jwt() || SB_ANON), "content-type": "application/json" },
      body: JSON.stringify(args || {})
    }).then(function (r) { return r.text().then(function (t) {
      var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {}
      if (!r.ok) throw new Error((d && (d.message || d.hint)) || t || ("HTTP " + r.status));
      return d;
    }); });
  }
  function sel(path) {
    return fetch(SB_URL + "/rest/v1/" + path, { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.ok ? r.json() : null; });
  }
  function snapshot(key) {
    return sel("world_snapshots?key=eq." + encodeURIComponent(key) + "&select=body")
      .then(function (rows) { return rows && rows[0] && rows[0].body; })
      .catch(function () { return null; });
  }
  function money(v) {
    if (window.foMoney) return window.foMoney(v);
    var n = Number(v);
    if (!isFinite(n)) return "&mdash;";
    var neg = n < 0; n = Math.abs(n);
    var s = n >= 1000000 ? (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + "m"
          : n >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n));
    return (neg ? "-$" : "$") + s;
  }
  // THE UMPIRE'S OWN RULES, mirrored so the page can say them out loud before
  // the manager spends anything. docs/ACADEMY.md is the authority and
  // server/economy.mjs is the arithmetic; these must not drift from either.
  // THE LADDER RUNS TO TEN (058). One to five keep their exact former prices
  // - rounds were worked and banks were settled at them - and six upward is
  // new ground: dearer to build every rung, and dear enough to RUN that the
  // upkeep, not the fee, is what stops a small club overreaching.
  var ACAD_MAX = 10;
  var UPKEEP = [0, 6000, 14000, 26000, 44000, 70000,
                90000, 112000, 136000, 162000, 190000];      // by level, a round
  var BUILD = [0, 400000, 900000, 1800000, 3200000,
               3600000, 4200000, 4900000, 5700000, 6600000]; // from level n to n+1
  // A WAGE IS PRINTED IN FULL. money() rounds to the nearest thousand, which is
  // right for a transfer fee and wrong here: a boy at 1,310 a round and a boy
  // at 1,490 are a different decision, and both read "$1k".
  function wage(v) {
    var n = Math.round(Number(v) || 0);
    return "$" + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function ovrOf(p) {
    try { if (typeof window.foPkOvr === "function") return window.foPkOvr(p); } catch (e) {}
    return null;
  }
  function roleOf(p) {
    var r = String((p && p.role) || "").toLowerCase();
    if (p && p.keeper) return "Wicketkeeper";
    if (/open/.test(r)) return "Opener";
    if (/allround|all-round/.test(r)) return "All-rounder";
    if (/seam|pace|spin|bowl/.test(r)) return "Bowler";
    if (/finish|middle|anchor|bat/.test(r)) return "Batter";
    return r ? r.charAt(0).toUpperCase() + r.slice(1) : "Cricketer";
  }
  // the fifteen skills, grouped the way a coach would read them out
  var SKILLS = [
    ["Batting", ["vsPace", "vsSpin", "rotation", "power", "temperament"]],
    ["Bowling", ["wicket", "economy", "discipline", "moveTurn", "variation", "stamina"]],
    ["In the field", ["fielding", "catching", "keeping", "stumping"]]
  ];
  var SKILL_NM = {
    vsPace: "against pace", vsSpin: "against spin", rotation: "strike rotation",
    power: "power", temperament: "temperament", wicket: "wicket-taking",
    economy: "economy", discipline: "discipline", moveTurn: "movement", variation: "variation",
    stamina: "stamina", fielding: "ground fielding", catching: "catching",
    keeping: "keeping", stumping: "stumping"
  };
  // THE SCOUT'S BANDS. A report carries a [lo, hi] range per skill, never the
  // number itself (migration 050): the band is drawn where it sits on the
  // 0-99 rail, so a wide gold smear at the top of the scale reads exactly as
  // it should - "could be special, could merely be good".
  function bandGrid(p) {
    var sb = (p && p.skillBands) || {}, out = "";
    for (var g = 0; g < SKILLS.length; g++) {
      var rows = "";
      for (var i = 0; i < SKILLS[g][1].length; i++) {
        var k = SKILLS[g][1][i], b = sb[k];
        if (!b || !isFinite(+b.lo) || !isFinite(+b.hi)) continue;
        var lo = Math.max(0, Math.min(100, +b.lo)), hi = Math.max(lo + 2, Math.min(100, +b.hi));
        rows += "<div class='fo-ac-sk'><i>" + E(SKILL_NM[k] || k) + "</i>" +
          "<s class='rail'><u class='bnd' style='left:" + lo + "%;width:" + (hi - lo) + "%'></u></s>" +
          "<b class='rng'>" + Math.round(lo) + "&ndash;" + Math.round(hi) + "</b></div>";
      }
      if (rows) out += "<div class='fo-ac-skg'><h5>" + E(SKILLS[g][0]) + "</h5>" + rows + "</div>";
    }
    return out ? "<div class='fo-ac-skills'>" + out + "</div>" : "";
  }
  function skillGrid(p) {
    var sk = (p && p.skills) || {}, out = "";
    for (var g = 0; g < SKILLS.length; g++) {
      var rows = "";
      for (var i = 0; i < SKILLS[g][1].length; i++) {
        var k = SKILLS[g][1][i], v = +sk[k];
        if (!isFinite(v)) continue;
        rows += "<div class='fo-ac-sk'><i>" + E(SKILL_NM[k] || k) + "</i>" +
          "<s><u style='width:" + Math.max(2, Math.min(100, v)) + "%'></u></s><b>" + Math.round(v) + "</b></div>";
      }
      if (rows) out += "<div class='fo-ac-skg'><h5>" + E(SKILLS[g][0]) + "</h5>" + rows + "</div>";
    }
    return out ? "<div class='fo-ac-skills'>" + out + "</div>" : "";
  }

  // --------------------------------------------------------------------------
  window.foRenderAcademyPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    css();
    page.innerHTML = shell("<div class='fo-ac-note'>Walking down to the academy&hellip;</div>");
    if (!jwt()) {
      page.innerHTML = shell("<div class='fo-ac-card'><p class='fo-ac-p'>" +
        (window.__foAuthPending
          ? "Reaching your club&hellip;"
          : "The academy belongs to your club. Sign in and the boys are here." +
            "<br><button type='button' class='fo-door-btn' data-fo-door>Sign in</button>") +
        "</p></div>");
      return;
    }
    rpc("world_my_academy").then(function (ac) {
      if (!ac || ac.signedIn === false) {
        page.innerHTML = shell("<div class='fo-ac-card'><p class='fo-ac-p'>Sign in first - the academy is your club&rsquo;s, and the world keeps it." +
          "<br><button type='button' class='fo-door-btn' data-fo-door>Sign in</button></p></div>");
        return;
      }
      if (!ac.country) {
        page.innerHTML = shell("<div class='fo-ac-card'><p class='fo-ac-p'>You don&rsquo;t hold a club in the served world yet. One is claimed for you on the next load, and its academy comes with it, boys and all.</p></div>");
        return;
      }
      render(page, ac);
      // The Colts Cup bracket and the squad-naming panel used to be fetched
      // here and hung at the foot of the page. Both belong to the competition,
      // which has a room of its own; the academy no longer waits on a request
      // it has nowhere to put.
    }).catch(function (e) {
      page.innerHTML = shell("<div class='fo-ac-note'>The world could not be reached (" + E(String(e.message).slice(0, 90)) +
        "). The boys are training regardless - try again in a minute.</div>");
    });
  };


  function shell(body) {
    // the room keeps its own table: the club that matters here is the one in
    // the served world, not whatever the device calls home.
    // The navy hero that said "Your club / Youth Academy" said nothing the
    // navigation had not already said - the Broadcast dress (the manager's
    // pick of three mock-ups) opens straight on the scout's card.
    return "<div class='fo-ac' data-fo-owntable><div class='fo-ac-in'>" +
      body +
      "<div class='fo-ac-foot'><a href='#/squad'>&lsaquo; The squad</a><a href='#/training'>Training &rsaquo;</a></div>" +
      "</div></div>";
  }

  function flagOf(rid) {
    var base = (typeof FO_ART !== "undefined") ? FO_ART : "client/art/";
    try { return base + "flags/" + window.__foCxAPI.flagFile(rid) + ".svg"; } catch (e) { return ""; }
  }
  // THE POSTED SCOUT (068), the way From the Pavilion runs him: a man with a
  // suitcase, not a button. He works in ONE country until you move him; each
  // rest day's boy comes from where he stands. The Broadcast dress says all
  // of it without a sentence: the flag is the posting, the tiles are the
  // fee, the next report and the academy - the old board's three notes
  // ("Cricket on today...", "Today's report is in...", "A country leans
  // toward...") are retired; the tiles say the same thing in two words.

  // THE BOY ON THE TABLE. Everything about him, and two buttons.
  function recruitHTML(pend, ac) {
    var p = pend.recruit;
    var nat = (ac.nations || []).filter(function (n) { return n.id === pend.nation; })[0];
    // the scout's report (050): ranges, not numbers - the signature is the reveal
    // HIS CONTRACT IS A SENIOR CONTRACT (075): one signing fee, and he stands
    // in the squad room from the next round - no colts list in between.
    var feeCell = "<span><i>Senior contract</i><b>" +
      (ac.promoteFee != null ? money(ac.promoteFee) : "&mdash;") +
      "</b><u>paid once, and the shirt is his</u></span>";
    if (p && p.scouted) {
      var rb = p.ratingBand;
      return "<div class='fo-ac2-rep'>" +
        "<div class='fo-ac2-rh'><div><b>" + E(p.name) + "</b>" +
          "<i>" + E(roleOf(p)) + " &middot; " + E(p.age) + " &middot; found in " + E((nat && nat.name) || pend.nation) + "</i></div>" +
          (rb ? "<div class='bd'><b>" + (+rb.lo) + "&ndash;" + (+rb.hi) + "</b><i>Estimate</i></div>" : "") + "</div>" +
        // THE WHISPER - the scout's one sentence on how much growing is left.
        // It is an opinion sharpened by the academy's level, never a number.
        (p.whisper ? "<div class='fo-ac2-q'>&ldquo;" + E(p.whisper) + "&rdquo;<i>&mdash; your scout</i></div>" : "") +
        bandGrid(p) +
        // the estimate label carries the uncertainty; the fifty-eight-word
        // paragraph that explained a range is a range is gone
        "<div class='fo-ac-orow'>" +
          "<span><i>Wage if signed</i><b>" + wage(p.wage) + "</b><u>a round, every round</u></span>" +
          feeCell +
        "</div>" +
        "<div class='fo-ac-obtns'>" +
          "<button type='button' class='fo-ac-btn' data-fo-rec='sign'>Sign him &middot; find out</button>" +
          "<button type='button' class='fo-ac-btn ghost' data-fo-rec='release'>Let him go</button>" +
        "</div></div>";
    }
    var o = ovrOf(p);
    return "<div class='fo-ac-offer'>" +
      "<div class='fo-ac-oh'><div><b>" + E(p.name) + "</b>" +
        "<i>" + E(roleOf(p)) + " &middot; " + E(p.age) + " years old &middot; found in " + E((nat && nat.name) || pend.nation) + "</i></div>" +
        (o == null ? "" : "<u>" + o + "</u>") + "</div>" +
      "<div class='fo-ac-orow'>" +
        "<span><i>Wage if signed</i><b>" + wage(p.wage) + "</b><u>a round, every round</u></span>" +
        feeCell +
      "</div>" +
      skillGrid(p) +
      "<div class='fo-ac-obtns'>" +
        "<button type='button' class='fo-ac-btn' data-fo-rec='sign'>Sign him &middot; a senior shirt</button>" +
        "<button type='button' class='fo-ac-btn ghost' data-fo-rec='release'>Let him go</button>" +
      "</div></div>";
  }

  function render(page, ac) {
    var top = Math.max(5, Math.min(ACAD_MAX, +ac.maxLevel || ACAD_MAX));
    var lv = Math.max(1, Math.min(top, +ac.level || 2));
    var bank = Number(ac.bank || 0);
    var pend = ac.pending && ac.pending.recruit ? ac.pending : null;

    // ---- THE BROADCAST DRESS: one card, the same grammar as the match
    // preview - folio, billing, a rank of facts, what is on the table, and
    // the academy as one strip. Where the old page explained, this one shows.
    var posted = ac.scoutNation || ac.country;
    var nations = ac.nations || [];
    var here = nations.filter(function (n) { return n.id === posted; })[0] || { id: posted, name: posted, fee: 0 };
    var opts = nations.map(function (n) {
      return "<option value='" + E(n.id) + "'" + (n.id === posted ? " selected" : "") + ">" +
        E(n.name) + (Number(n.fee) ? " · " + money(n.fee) : " · home, free") + "</option>";
    }).join("");
    var fl = flagOf(posted);

    var stateTag = pend ? "Report in" : ac.restDay ? (ac.scoutedToday ? "Report filed" : "Rest day") : "Cricket on";
    // the fact is a countdown: how long until the next boy can be brought
    // in. Rest days carry the reports, and the schedule's own day taxonomy
    // says when the next one falls.
    var nextRep = pend ? { b: "On the table", cls: " class='go'" }
      : (ac.restDay && !ac.scoutedToday) ? { b: "Today", cls: " class='go'" }
      : { b: "&mdash;", cls: "", cd: true };
    try {
      if (nextRep.cd && window.foDayPhase && window.__foPlanet) {
        var pl9 = window.__foPlanet, ph9 = pl9.phaseOf(Date.now());
        for (var dd = ph9.di + 1; dd <= ph9.di + 45; dd++) {
          var season9 = ph9.season, di9 = dd, cyc9 = pl9.CYCLE || 42;
          if (di9 >= cyc9) { season9 += Math.floor(di9 / cyc9); di9 = di9 % cyc9; }
          var k9 = window.foDayPhase(season9, di9);
          if (k9 && k9.kind === "rest") {
            var at9 = pl9.EPOCH + (pl9.seasonStart(season9) + di9) * pl9.DAY;
            var lf9 = at9 - Date.now();
            nextRep.b = lf9 > 0 ? (Math.floor(lf9 / 86400000) ? Math.floor(lf9 / 86400000) + "d " : "") +
              Math.floor(lf9 % 86400000 / 3600000) + "h " + Math.floor(lf9 % 3600000 / 60000) + "m" : "Today";
            break;
          }
        }
      }
    } catch (eCd) {}

    var folio = "<div class='fo-ac2-folio'>" +
      (fl ? "<img src='" + fl + "' alt='' onerror=\"this.style.display='none'\">" : "") +
      "<span>Youth scout &middot; " + stateTag + "</span></div>";
    var bill = "<div class='fo-ac2-bill'>" +
      (fl ? "<img class='bf' src='" + fl + "' alt='' onerror=\"this.style.visibility='hidden'\">" : "") +
      "<div class='bw'><b>" + E(here.name || posted) + "</b><i>Your scout is posted here</i></div>" +
      "<label class='mv'><select id='fo-ac-nat' aria-label='Post the scout'>" + opts + "</select><em>Move him</em></label>" +
      "</div>";
    var facts = "<div class='fo-ac2-facts'>" +
      "<div><b" + nextRep.cls + ">" + nextRep.b + "</b><i>Next recruit</i></div>" +
      "<div><b>" + (Number(here.fee) ? money(here.fee) : "Free") + "</b><i>Report fee" + (Number(here.fee) ? "" : " &middot; home") + "</i></div>" +
      "<div><b>Level " + lv + "</b><i>Academy &middot; " + money(bank) + " banked</i></div>" +
      "</div>";

    var mid = "";
    if (pend) mid = "<div class='fo-ac2-cap'>On the table</div>" + recruitHTML(pend, ac);
    else if (ac.restDay && !ac.scoutedToday)
      mid = "<div class='fo-ac2-go'><button type='button' class='fo-ac-btn' id='fo-ac-go'>Bring me his report</button></div>";

    // the academy as ONE strip: the ladder, what it costs to run, and the
    // next rung where there is one - not a second card of repeated numbers
    var pips = "";
    for (var i = 1; i <= top; i++) pips += "<s class='fo-ac-pip" + (i <= lv ? " on" : "") + "'></s>";
    var upBtn = "";
    if (lv < top) {
      var cost = Number(ac.nextCost || BUILD[lv]), can = bank >= cost && bank >= 0;
      upBtn = "<button type='button' class='fo-ac-btn sm" + (can ? "" : " off") + "' data-fo-acup='" + (lv + 1) + "'" + (can ? "" : " disabled") + ">" +
        (can ? "Level " + (lv + 1) + " &middot; " + money(cost) : "Level " + (lv + 1) + " needs " + money(cost)) + "</button>";
    }
    var strip = "<div class='fo-ac2-strip'>" +
      "<div class='tx'><span class='fo-ac-pips'>" + pips + "</span></div>" +
      upBtn + "</div>";

    page.innerHTML = shell(
      "<div class='fo-ac2-card'>" + folio + bill + facts + mid +
      "<div class='fo-ac2-hr'></div>" + strip + "</div>");

    // moving the scout is its own deed: the select IS the control
    var natSel = document.getElementById("fo-ac-nat");
    if (natSel) natSel.addEventListener("change", function () {
      rpc("world_scout_post", { p_nation: natSel.value })
        .then(function () { window.foRenderAcademyPage && foRenderAcademyPage(); })
        .catch(function (e2) { try { window.foSayAt && foSayAt(natSel, String((e2 && e2.message) || e2), "error"); } catch (e3) {} });
    });
    var go = document.getElementById("fo-ac-go");
    if (go) go.addEventListener("click", function () {
      go.disabled = true; go.textContent = "Travelling…";
      rpc("world_scout", { p_nation: null })
        .then(function () { window.foRenderAcademyPage(); })
        .catch(function (e) { go.disabled = false; go.textContent = "Bring me his report"; sayAt(go, String(e.message).slice(0, 200)); });
    });
    page.querySelectorAll("[data-fo-rec]").forEach(function (b) {
      b.addEventListener("click", function () {
        var act = b.getAttribute("data-fo-rec");
        var run = function () {
          b.disabled = true; b.textContent = act === "sign" ? "Signing…" : "Letting him go…";
          rpc("world_recruit", { p_action: act })
            .then(function () {
              // he stands in the squad room now, so the world's copy of the
              // squad must be re-read before any page shows the old twenty
              try { if (window.__foWorldRefreshPlan) window.__foWorldRefreshPlan(); } catch (e2) {}
              window.foRenderAcademyPage();
            })
            .catch(function (e) { b.disabled = false; window.foRenderAcademyPage(); sayAt(b, String(e.message).slice(0, 200)); });
        };
        if (act !== "release") {
          decide(b, { q: "Hand him a senior contract" +
                         (ac.promoteFee != null ? " for " + money(ac.promoteFee) : "") + "?",
                      note: "The fee comes out of the treasury, and he stands with the seniors from the next round.",
                      ok: "Sign him", cancel: "Not yet", onYes: run });
          return;
        }
        decide(b, { q: "Let him go?", note: "He walks away and you will not see him again.",
                    ok: "Let him go", cancel: "Keep him", danger: true, onYes: run });
      });
    });
    var upBtn = page.querySelector("[data-fo-acup]");
    if (upBtn) upBtn.addEventListener("click", function () {
      if (upBtn.disabled) return;
      upBtn.disabled = true; upBtn.textContent = "Building…";
      rpc("world_set_academy", { p_level: +upBtn.getAttribute("data-fo-acup") })
        .then(function () { window.foRenderAcademyPage(); })
        .catch(function (e) { upBtn.disabled = false; upBtn.textContent = "Try again"; sayAt(upBtn, String(e.message).slice(0, 200)); });
    });
  }

  // THE SHIRT IS WRITTEN FROM THE SQUAD PAGE. The boys stand with the rest of
  // the squad now, but the contract is still the academy's to price: this
  // answers the squad page's promote/release taps against the world, quoting
  // the real fee before anything is signed. Returns false when no world club
  // is signed in, so the caller can fall back to the local game's own books.
  // the shared in-page decision strip and the inline note beside a control;
  // both degrade to doing the thing / writing to the console if the boot
  // module has not landed yet
  function decide(el, o) {
    if (window.foDecide) { window.foDecide(el, o); return; }
    try { if (o && o.onYes) o.onYes(); } catch (e) {}
  }
  function sayAt(el, m) {
    if (window.foSayAt) { window.foSayAt(el, m, "error"); return; }
    try { console.warn("[fifty-overs] " + m); } catch (e) {}
  }

  var COLT_FEE = null;
  window.__foColtAction = function (name, action, done, el) {
    var after = function () { try { if (done) done(); } catch (eD) {} };
    try { if (!jwt()) return false; } catch (e0) { return false; }
    var ask = function (fee) {
      var q = action === "release" ? "Let " + name + " go?"
        : fee != null ? "Hand " + name + " a senior contract for " + money(fee) + "?"
                      : "Hand " + name + " a senior contract?";
      var nt = action === "release" ? "He leaves the club for good."
        : "The fee comes out of the treasury, and the shirt is his from the next round.";
      // the question opens under the button on the squad page; with no button
      // to open under, the contract is not signed by guesswork - it is dropped
      if (!window.foDecide || !el) { after(); return; }
      window.foDecide(el, {
        q: q, note: nt, danger: action === "release",
        ok: action === "release" ? "Let him go" : "Sign him",
        cancel: action === "release" ? "Keep him" : "Not yet",
        onYes: function () { commit(); }
      });
    };
    var commit = function () {
      rpc("world_colt", { p_name: name, p_action: action })
        .then(function () {
          if (el) sayAt(el, action === "promote" ? name + " pulls on a senior shirt." : name + " leaves the club.");
          else note(action === "promote" ? name + " pulls on a senior shirt." : name + " leaves the club.");
          // the senior squad has changed, so the world's copy of it must be
          // re-read before any other page shows the old fifteen
          try { if (window.__foWorldRefreshPlan) window.__foWorldRefreshPlan(); } catch (e2) {}
          after();
        })
        .catch(function (e) {
          if (el) sayAt(el, String((e && e.message) || e).replace(/^error:\s*/i, "").slice(0, 180));
          else note(String((e && e.message) || e).replace(/^error:\s*/i, "").slice(0, 180));
          after();
        });
    };
    if (action !== "promote") { ask(null); return true; }
    if (COLT_FEE != null) { ask(COLT_FEE); return true; }
    rpc("world_my_academy").then(function (ac) {
      COLT_FEE = (ac && ac.promoteFee != null) ? Number(ac.promoteFee) : null;
      ask(COLT_FEE);
    }).catch(function () { ask(null); });
    return true;
  };

  // THE LAST FLOATING SLAB. It slid up over the bottom of whatever you were
  // reading to tell you what you had just plainly done. Where there is a
  // control to speak beside, foSayAt speaks beside it; where there is not,
  // this writes to the console and puts nothing over the page.
  function note(msg) {
    try { console.info("[fifty-overs] " + String(msg || "")); } catch (e) {}
  }

  // (The Colts Cup bracket, its tie cards and its squad picker lived here
  //  until 075 retired the competition. The CSS below keeps the shared
  //  classes other rooms borrowed; the bracket's own JS went with the cup.)

  // The academy was the first of the world rooms, and its plate-and-cards
  // became the house style for the rest of them. Other rooms call this and
  // add only what is their own, so there is one stylesheet, not five.
  window.__foRoomCss = function () { css(); };
  function css() {
    if (document.getElementById("fo-ac-css")) return;
    var s = document.createElement("style"); s.id = "fo-ac-css";
    s.textContent = [
      "html body #page .fo-ac{max-width:680px;margin:26px auto 44px;padding:0 14px;color:#1B2432}",
      "html body #page .fo-ac-hero{background:linear-gradient(150deg,#0B1D3A,#07162E 70%) !important;border-radius:22px;padding:24px 26px 22px;color:#FFFEFC;box-shadow:0 22px 50px rgba(7,22,46,.35);border-bottom:3px solid #C9571F}",
      "html body #page .fo-ac-k{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:#E8B96A}",
      "html body #page .fo-ac-hero h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:30px;letter-spacing:-.015em;margin:8px 0;color:#FFFEFC;line-height:1.05}",
      "html body #page .fo-ac-hero p{font:420 13px/1.6 Fraunces,Georgia,serif;color:rgba(255,254,252,.78);margin:0;max-width:52ch}",
      "html body #page .fo-ac-card{margin-top:14px;background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:16px;padding:14px 16px}",
      "html body #page .fo-ac-card h3{margin:0 0 10px;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#8A6A1F;display:flex;align-items:center;gap:8px}",
      "html body #page .fo-ac-card h3 span{margin-left:auto;font-size:10px;color:rgba(20,28,40,.45);letter-spacing:.12em}",
      "html body #page .fo-ac-p{font:400 13px/1.6 Oswald,sans-serif;color:rgba(20,28,40,.72);margin:0 0 10px}",
      "html body #page .fo-ac-p:last-child{margin-bottom:0}",
      "html body #page .fo-ac-note{font:400 12.5px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.55);margin-top:10px}",
      // the scout's board: a navy plate, his flag, and one ghost control
      "html body #page .fo-ac-post{display:flex;align-items:center;gap:12px 14px;flex-wrap:wrap;background:linear-gradient(135deg,#0B1D33,#132E4E);border-radius:14px;padding:14px 16px;box-shadow:0 12px 28px rgba(11,29,51,.24)}",
      "html body #page .fo-ac-post .pw{flex:1 1 150px}",
      "html body #page .fo-ac-post .pw i{white-space:nowrap}",
      "html body #page .fo-ac-post .pw u{white-space:normal}",
      "html body #page .fo-ac-post .mv{margin-left:auto}",
      "html body #page .fo-ac-post .pf{width:44px;height:30px;object-fit:cover;border-radius:3px;box-shadow:0 0 0 1.5px rgba(235,194,113,.5);flex:none}",
      "html body #page .fo-ac-post .pw{min-width:0}",
      "html body #page .fo-ac-post .pw i{display:block;font:600 11px/1 Oswald,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#E8B96A;font-style:normal;margin-bottom:4px}",
      "html body #page .fo-ac-post .pw b{display:block;font:600 19px/1.1 Fraunces,Georgia,serif;color:#FFFEFC;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      "html body #page .fo-ac-post .pw u{display:block;text-decoration:none;font:400 13px/1.5 Oswald,system-ui,sans-serif;color:rgba(244,239,228,.62);margin-top:2px}",
      "html body #page .fo-ac-post .mv{position:relative;flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:4px}",
      "html body #page .fo-ac-post .mv select{appearance:none!important;-webkit-appearance:none!important;max-width:150px;min-height:34px!important;padding:0 16px 0 4px!important;border:0!important;border-bottom:1px solid rgba(235,194,113,.5)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;font:600 13px/1 Oswald,system-ui,sans-serif!important;color:#F4EFE4!important;cursor:pointer;text-overflow:ellipsis}",
      "html body #page .fo-ac-post .mv:after{content:'\\25BE';position:absolute;right:2px;top:10px;pointer-events:none;font-size:10px;color:#E8B96A}",
      "html body #page .fo-ac-post .mv select option{color:#1B2432;background:#FFFEFC}",
      "html body #page .fo-ac-post .mv s{text-decoration:none;font:700 11px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,239,228,.5)}",
      "html body #page .fo-ac-srow.one{margin-top:12px}",
      // the whisper: the scout speaks, and the page keeps his voice
      "html body #page .fo-ac-whisper{font:400 14.5px/1.55 Fraunces,Georgia,serif;font-style:italic;color:#2A2519;border-left:3px solid #C9571F;padding:6px 2px 6px 12px;margin:10px 0 2px}",
      "html body #page .fo-ac-whisper i{display:block;font-size:11px;font-style:normal;color:rgba(20,28,40,.5);margin-top:3px}",
      "html body #page .fo-ac-lvl{display:flex;align-items:center;gap:12px;flex-wrap:wrap}",
      "html body #page .fo-ac-pips{display:flex;flex-wrap:wrap;gap:4px}",
      "html body #page .fo-ac-pip{display:block;width:15px;height:15px;border-radius:5px;background:rgba(20,28,40,.1);border:1px solid rgba(20,28,40,.14)}",
      "html body #page .fo-ac-pip.on{background:linear-gradient(180deg,#E8B96A,#C08A2E);border-color:rgba(138,106,31,.6)}",
      "html body #page .fo-ac-lvt b{display:block;font:700 17px/1.1 Oswald,sans-serif;color:#1B2432}",
      "html body #page .fo-ac-lvt i{display:block;font-style:normal;font:500 13px/1.4 Oswald,sans-serif;color:rgba(20,28,40,.55);margin-top:2px}",
      "html body #page .fo-ac-money{display:flex;gap:10px;margin:12px 0 4px}",
      "html body #page .fo-ac-money>div{flex:1;background:rgba(255,255,255,.85);border:1px solid rgba(20,28,40,.12);border-radius:12px;padding:9px 11px;min-width:0}",
      "html body #page .fo-ac-money i{display:block;font:600 11px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.45);font-style:normal}",
      "html body #page .fo-ac-money b{display:block;font:700 17px/1.2 Oswald,sans-serif;color:#1B2432;margin-top:4px;font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac-money u{display:block;text-decoration:none;font:500 12px/1.2 Oswald,sans-serif;color:rgba(20,28,40,.45);margin-top:1px}",
      "html body #page .fo-ac-uprow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;padding-top:11px;border-top:1px solid rgba(20,28,40,.08)}",
      "html body #page .fo-ac-uprow>div{flex:1 1 190px;min-width:0}",
      "html body #page .fo-ac-uprow b{display:block;font:700 13px/1.2 Oswald,sans-serif;letter-spacing:.04em;color:#1B2432}",
      "html body #page .fo-ac-uprow i{display:block;font-style:normal;font:400 13px/1.45 Oswald,sans-serif;color:rgba(20,28,40,.55);margin-top:3px}",
      "html body #page .fo-ac-btn{display:inline-block;font:700 11px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#FFFEFC !important;background:linear-gradient(180deg,#E8894A,#C9571F) !important;border:0 !important;border-radius:999px !important;padding:11px 17px !important;cursor:pointer;text-decoration:none !important}",
      "html body #page .fo-ac-btn.off{background:rgba(20,28,40,.12) !important;color:rgba(20,28,40,.5) !important;cursor:default}",
      "html body #page .fo-ac-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}",
      "html body #page a.fo-ac-sqlink{display:flex;align-items:center;gap:14px;background:#FFFEFC;border:1px solid rgba(201,85,50,.42);border-left:5px solid #C9571F;border-radius:16px;padding:15px 18px;margin:14px 0 0;text-decoration:none;color:#1B2432;box-shadow:0 10px 26px rgba(201,85,50,.10)}",
      "html body #page a.fo-ac-sqlink span{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}",
      "html body #page a.fo-ac-sqlink b{font:600 14.5px/1.3 Oswald,sans-serif;color:#1B2432}",
      "html body #page a.fo-ac-sqlink i{font:500 13px/1.5 Oswald,sans-serif;font-style:normal;color:rgba(20,28,40,.55)}",
      "html body #page a.fo-ac-sqlink s{flex:none;text-decoration:none;font:600 20px/1 Oswald,sans-serif;color:#C9571F}",
      ".fo-ac-toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,14px);opacity:0;z-index:9999;background:#14243A;color:#FFFEFC;font:600 13px/1.4 Oswald,sans-serif;border-radius:12px;border-bottom:3px solid #C9571F;padding:11px 16px;max-width:min(92vw,420px);box-shadow:0 14px 34px rgba(7,22,46,.35);transition:opacity .25s ease,transform .25s ease;pointer-events:none}",
      ".fo-ac-toast.on{opacity:1;transform:translate(-50%,0)}",
      "html body #page .fo-ac-colt{background:rgba(250,246,238,.9);border:1px solid rgba(20,28,40,.12);border-radius:13px;padding:11px 12px}",
      "html body #page .fo-ac-ch{display:flex;align-items:baseline;gap:8px}",
      "html body #page .fo-ac-ch b{flex:1;min-width:0;font:600 13.5px/1.25 Oswald,sans-serif;color:#1B2432;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "html body #page .fo-ac-ch u{flex:none;text-decoration:none;font:700 13px/1 Oswald,sans-serif;color:#8A6A1F;font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac-cm{font:500 12px/1.45 Oswald,sans-serif;color:rgba(20,28,40,.55);margin-top:3px}",
      "html body #page .fo-ac-cm em{font-style:normal;font-weight:700;color:#B44A22;text-transform:uppercase;letter-spacing:.08em;font-size:10px}",
      "html body #page .fo-ac-bar{height:6px;border-radius:999px;background:rgba(20,28,40,.09);margin:8px 0 5px;overflow:hidden}",
      "html body #page .fo-ac-bar s{display:block;height:100%;text-decoration:none;background:linear-gradient(90deg,#E8B96A,#C9571F)}",
      "html body #page .fo-ac-cbtns{display:flex;gap:6px;margin-top:9px}",
      // THE SCOUT, THE OFFER AND THE WARNINGS
      "html body #page .fo-ac-srow{display:flex;gap:8px;align-items:stretch;flex-wrap:wrap}",
      "html body #page .fo-ac-sel{flex:1 1 190px;min-width:0;font:500 13px/1.2 Oswald,sans-serif;color:#1B2432;background:#FFFEFC;border:1px solid rgba(20,28,40,.2);border-radius:10px;padding:10px 11px;cursor:pointer}",
      "html body #page .fo-ac-note.thin{font-size:11.5px;line-height:1.55;color:rgba(20,28,40,.55);margin-top:9px}",
      "html body #page .fo-ac-warn{background:#FFF6DA;border:1px solid rgba(200,84,47,.28);border-left:3px solid #C9571F;border-radius:11px;padding:11px 13px;margin:0 0 12px;font:500 12.5px/1.55 Oswald,sans-serif;color:#5A3410}",
      // THE BRACKET. Four columns that scroll sideways in their own box, never
      // the page - a knockout is wide and a phone is not.
      "html body #page .fo-ac-bracket{display:flex;gap:10px;overflow-x:auto;padding:2px 0 6px;-webkit-overflow-scrolling:touch}",
      "html body #page .fo-ac-bcol{flex:0 0 172px;min-width:172px}",
      "html body #page .fo-ac-bcol h4{margin:0 0 6px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#8A7F70}",
      "html body #page .fo-ac-tie{background:#FBF8F2;border:1px solid rgba(20,28,40,.10);border-radius:9px;padding:7px 9px;margin:0 0 6px;font:500 13px/1.5 Oswald,sans-serif;position:relative}",
      "html body #page .fo-ac-tie.mine{background:#FFF6DA;border-color:rgba(200,84,47,.32)}",
      "html body #page .fo-ac-tie b{display:block;color:#1B2432}",
      "html body #page .fo-ac-tie a.fo-ac-tl{text-decoration:none;color:inherit}",
      "html body #page .fo-ac-tie a.fo-ac-tl:hover b{color:#C9571F}",
      "html body #page .fo-ac-tie b.out{color:#9A9187;text-decoration:line-through;text-decoration-thickness:1px}",
      "html body #page .fo-ac-tie b.won{font-weight:700}",
      "html body #page .fo-ac-tie b.me{color:#C9571F}",
      "html body #page .fo-ac-tie em{display:block;font:600 11px/1 Oswald,sans-serif;letter-spacing:.16em;color:#B4A996;margin:2px 0;font-style:normal}",
      "html body #page .fo-ac-ff{position:absolute;top:6px;right:8px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#C9571F;font-style:normal}",
      "html body #page .fo-ac-champ{display:flex;align-items:center;gap:9px;background:linear-gradient(120deg,#0B1D3A,#12325C);border-radius:12px;padding:11px 14px;margin:0 0 12px;color:#FFFEFC}",
      "html body #page .fo-ac-champ i{font-style:normal;font-size:17px;color:#E8B96A}",
      "html body #page .fo-ac-champ b{font:700 14px/1.2 Fraunces,Fraunces,Georgia,serif}",
      "html body #page .fo-ac-champ em{margin-left:auto;font:600 11px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#E8B96A;font-style:normal}",
      // THE SQUAD PICKER
      "html body #page .fo-ac-sqd{background:#FBF8F2;border:1px solid rgba(20,28,40,.10);border-radius:12px;padding:12px 13px;margin:0 0 12px}",
      "html body #page .fo-ac-sqh{display:flex;align-items:baseline;gap:10px;margin:0 0 9px}",
      "html body #page .fo-ac-sqh b{font:700 13px/1.2 Fraunces,Fraunces,Georgia,serif;color:#1B2432}",
      "html body #page .fo-ac-sqh i{margin-left:auto;font:500 13px/1.4 Oswald,sans-serif;color:#8A7F70;font-style:normal;text-align:right}",
      "html body #page .fo-ac-sqm{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:5px}",
      "html body #page .fo-ac-sqp{display:flex;align-items:center;gap:6px;background:#FFFEFC;border:1px solid rgba(20,28,40,.10);border-radius:8px;padding:5px 8px;font:500 13px/1.3 Oswald,sans-serif;cursor:pointer}",
      "html body #page .fo-ac-sqp.on{background:#FFF6DA;border-color:rgba(200,84,47,.30)}",
      "html body #page .fo-ac-sqp input{margin:0;accent-color:#C9571F;flex:0 0 auto}",
      "html body #page .fo-ac-sqp b{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:#1B2432}",
      "html body #page .fo-ac-sqp i{font-style:normal;color:#8A7F70;font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac-sqp u{text-decoration:none;font-weight:700;color:#0B1D3A;font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac-sqf{display:flex;align-items:center;gap:10px;margin:10px 0 0}",
      "html body #page .fo-ac-sqf span{font:500 13px/1.4 Oswald,sans-serif;color:#8A7F70}",
      "html body #page .fo-ac-sqf button{margin-left:auto}",
      "html body #page .fo-ac-warn b{display:block;font:700 13px/1.4 Oswald,sans-serif;color:#1B2432;margin-bottom:2px}",
      "html body #page .fo-ac-warn.cup{background:#F3F6FA;border-left-color:#2F5FC8;color:#20304A}",
      "html body #page .fo-ac-offer{background:#FFFEFC;border:1px solid rgba(20,28,40,.14);border-radius:13px;padding:13px 14px}",
      "html body #page .fo-ac-oh{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}",
      "html body #page .fo-ac-oh b{display:block;font:600 19px/1.15 Fraunces,Fraunces,Georgia,serif;color:#1B2432}",
      "html body #page .fo-ac-oh i{display:block;margin-top:3px;font:500 13px/1.4 Oswald,sans-serif;font-style:normal;color:rgba(20,28,40,.55)}",
      "html body #page .fo-ac-oh u{flex:0 0 auto;text-decoration:none;font:700 20px/1 Oswald,sans-serif;color:#C9571F;font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac-orow{display:flex;gap:10px;margin:12px 0 4px}",
      "html body #page .fo-ac-orow span{flex:1;background:rgba(250,246,238,.9);border-radius:10px;padding:9px 10px}",
      "html body #page .fo-ac-orow i{display:block;font:700 11px/1 Oswald,sans-serif;font-style:normal;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.42)}",
      "html body #page .fo-ac-orow b{display:block;margin-top:4px;font:700 17px/1 Oswald,sans-serif;color:#1B2432;font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac-orow u{display:block;margin-top:2px;text-decoration:none;font:500 12px/1.3 Oswald,sans-serif;color:rgba(20,28,40,.5)}",
      "html body #page .fo-ac-skills{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;margin:12px 0 2px}",
      "html body #page .fo-ac-skg h5{margin:0 0 5px;font:700 11px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.42)}",
      "html body #page .fo-ac-sk{display:flex;align-items:center;gap:7px;margin:0 0 3px}",
      "html body #page .fo-ac-sk i{flex:0 0 86px;font:500 12px/1.3 Oswald,sans-serif;font-style:normal;color:rgba(20,28,40,.6)}",
      "html body #page .fo-ac-sk s{flex:1;height:5px;border-radius:999px;background:rgba(20,28,40,.09);text-decoration:none;overflow:hidden}",
      "html body #page .fo-ac-sk s u{display:block;height:100%;text-decoration:none;background:linear-gradient(90deg,#E8B96A,#C9571F)}",
      "html body #page .fo-ac-sk b{flex:0 0 20px;text-align:right;font:600 12px/1 Oswald,sans-serif;color:#1B2432;font-variant-numeric:tabular-nums}",
      // the scout's band: a gold smear WHERE the truth lives, not a fill
      "html body #page .fo-ac-sk s.rail{position:relative;overflow:hidden}",
      "html body #page .fo-ac-sk s.rail u.bnd{position:absolute;top:0;bottom:0;height:auto;border-radius:999px;background:linear-gradient(90deg,rgba(232,185,106,.55),#C9571F,rgba(232,185,106,.55))}",
      "html body #page .fo-ac-sk b.rng{flex:0 0 42px}",
      "html body #page .fo-ac-oh u.rng{font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac-obtns{display:flex;gap:8px;margin-top:13px;flex-wrap:wrap}",
      "html body #page .fo-ac-obtns .fo-ac-btn{flex:1 1 150px}",
      "html body #page .fo-ac-btn.ghost{background:transparent !important;border:1px solid rgba(20,28,40,.22) !important;color:rgba(20,28,40,.62) !important}",
      "html body #page .fo-ac-colt.going{border-color:rgba(200,84,47,.35);background:#FFF9EC}",
      "html body #page .fo-ac-cm.going{color:#C9571F;font-weight:600}",
      "@media(max-width:480px){html body #page .fo-ac-skills{grid-template-columns:1fr}html body #page .fo-ac-sk i{flex-basis:78px}" +
        "html body #page .fo-ac-cbtns{flex-direction:column}html body #page .fo-ac-mini{padding:8px 4px !important}}",
      "html body #page .fo-ac-mini{flex:1;font:700 11px/1 Oswald,sans-serif;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;color:#FFFEFC !important;background:#1B2432 !important;border:0 !important;border-radius:999px !important;padding:9px 4px !important;cursor:pointer}",
      "html body #page .fo-ac-mini.ghost{background:transparent !important;border:1px solid rgba(20,28,40,.22) !important;color:rgba(20,28,40,.6) !important}",
      "html body #page .fo-ac-cm.cup{color:#8A6A1F;font-weight:600;margin-top:5px}",
      "html body #page .fo-ac-sub{margin:14px 0 7px;font:700 11px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(20,28,40,.42)}",
      "html body #page .fo-ac-tw{overflow-x:auto;-webkit-overflow-scrolling:touch}",
      "html body #page .fo-ac-tbl{width:100%;border-collapse:collapse;font:500 13px/1.3 Oswald,sans-serif;font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac-tbl th{font:700 11px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.42);text-align:right;padding:0 0 7px}",
      "html body #page .fo-ac-tbl th.nm{text-align:left}",
      "html body #page .fo-ac-tbl td{text-align:right;padding:6px 0;border-top:1px solid rgba(20,28,40,.07);color:rgba(20,28,40,.7);white-space:nowrap}",
      "html body #page .fo-ac-tbl td.nm{text-align:left;width:99%;padding-right:12px;color:#1B2432;white-space:nowrap}",
      "html body #page .fo-ac-tbl tr{border:0 !important;box-shadow:none !important;background:transparent}",
      "html body #page .fo-ac-tbl td,html body #page .fo-ac-tbl th{border-left:0 !important;border-right:0 !important}",
      "html body #page .fo-ac-tbl td.pt{font-weight:700;color:#1B2432;padding-left:10px}",
      "html body #page .fo-ac-tbl td.nrr,html body #page .fo-ac-tbl th.nrr{padding-left:10px;color:rgba(20,28,40,.45)}",
      "html body #page .fo-ac-tbl tr.me td{background:rgba(232,185,106,.16)}",
      "html body #page .fo-ac-tbl tr.me td.nm{font-weight:700}",
      "html body #page .fo-ac-res{display:flex;align-items:center;gap:6px;padding:6px 0;border-top:1px solid rgba(20,28,40,.07);font:500 13px/1.3 Oswald,sans-serif;flex-wrap:wrap}",
      "html body #page .fo-ac-res i{flex:none;font-style:normal;font:700 11px/1 Oswald,sans-serif;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;border-radius:5px;color:#FFFEFC;background:#B23230}",
      "html body #page .fo-ac-res i.w{background:#177A57}",
      "html body #page .fo-ac-res i.t{background:#8a6d3b}",
      "html body #page .fo-ac-res b{color:#1B2432;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      "html body #page .fo-ac-res u{text-decoration:none;color:rgba(20,28,40,.55);font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac-res em{font-style:normal;color:rgba(20,28,40,.35);font-size:10px}",
      "html body #page .fo-ac-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:18px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase}",
      // a room door is a thumb target, not a caption: 44px of it, with the
      // hit area the phone actually needs
      "html body #page .fo-ac-foot a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;margin:0 -14px;border-radius:12px;color:#B44A22 !important;text-decoration:none !important}",
      "html body #page .fo-ac-foot a:hover{background:rgba(176,74,44,.09)}",
      "html body #page .fo-ac-foot a:active{background:rgba(176,74,44,.16)}",
      "@media(max-width:480px){html body #page .fo-ac-hero h1{font-size:25px}html body #page .fo-ac-grid{grid-template-columns:1fr 1fr;gap:8px}html body #page .fo-ac-colt{padding:9px 10px}html body #page .fo-ac-ch b{font-size:12.5px}" +
        "html body #page .fo-ac-tbl td.nrr,html body #page .fo-ac-tbl th.nrr{display:none}}",
      // ---- THE BROADCAST DRESS (the manager's pick of three) --------------
      "html body #page .fo-ac2-card{margin-top:16px;background:#FFFEFC;border:1px solid rgba(27,36,50,.09);border-radius:16px;padding:clamp(12px,2.4vw,17px);display:flex;flex-direction:column;gap:12px;box-shadow:0 1px 3px rgba(14,35,63,.05)}",
      "html body #page .fo-ac2-folio{display:inline-flex;align-items:center;gap:9px;align-self:flex-start;background:rgba(20,36,58,.05);border:1px solid rgba(27,36,50,.09);border-radius:999px;padding:6px 14px 6px 7px}",
      "html body #page .fo-ac2-folio img{width:20px;height:14px;object-fit:cover;border-radius:3px;flex:none}",
      "html body #page .fo-ac2-folio span{font:700 11px/1 Oswald,sans-serif;text-transform:uppercase;letter-spacing:.18em;color:#14243A}",
      "html body #page .fo-ac2-bill{display:flex;align-items:center;gap:12px}",
      "html body #page .fo-ac2-bill .bf{width:52px;height:36px;object-fit:cover;border-radius:6px;box-shadow:0 0 0 1px rgba(27,36,50,.12);flex:none}",
      "html body #page .fo-ac2-bill .bw{min-width:0;flex:1}",
      "html body #page .fo-ac2-bill b{display:block;font:700 21px/1.05 Oswald,sans-serif;text-transform:uppercase;color:#14243A;overflow-wrap:anywhere}",
      "html body #page .fo-ac2-bill i{display:block;margin-top:4px;font:600 11px/1.4 Oswald,sans-serif;font-style:normal;letter-spacing:.16em;text-transform:uppercase;color:#9FB0C6}",
      "html body #page .fo-ac2-bill .mv{position:relative;flex:none;text-align:right}",
      "html body #page .fo-ac2-bill .mv select{appearance:none!important;-webkit-appearance:none!important;max-width:96px;border:0!important;border-bottom:1px solid rgba(201,87,31,.5)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;font:600 12.5px/1.4 Oswald,sans-serif!important;color:#14243A!important;padding:2px 15px 3px 2px!important;cursor:pointer;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}",
      "html body #page .fo-ac2-bill .mv:after{content:'\\25BE';position:absolute;right:1px;top:5px;pointer-events:none;font-size:10px;color:#C9571F}",
      "html body #page .fo-ac2-bill .mv em{display:block;font:700 11px/1 Oswald,sans-serif;font-style:normal;letter-spacing:.16em;text-transform:uppercase;color:#9FB0C6;margin-top:4px}",
      "html body #page .fo-ac2-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:linear-gradient(0deg,#FBF6EA,#FDFAF2);border:1px solid rgba(27,36,50,.09);border-radius:12px}",
      "html body #page .fo-ac2-facts>div{padding:11px 10px;border-left:1px solid rgba(27,36,50,.09);min-width:0}",
      "html body #page .fo-ac2-facts>div:first-child{border-left:0}",
      "html body #page .fo-ac2-facts b{display:block;font:600 13.5px/1.2 Oswald,sans-serif;color:#14243A;font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac2-facts b.go{color:#1F6F4A;font-weight:700}",
      "html body #page .fo-ac2-facts i{display:block;margin-top:3px;font:700 11px/1.35 Oswald,sans-serif;font-style:normal;text-transform:uppercase;letter-spacing:.12em;color:#9FB0C6}",
      "html body #page .fo-ac2-cap{font:700 11px/1 Oswald,sans-serif;text-transform:uppercase;letter-spacing:.14em;color:#14243A;margin-top:2px}",
      "html body #page .fo-ac2-cap:before{content:'';display:inline-block;width:7px;height:7px;background:#C9571F;border-radius:2px;margin-right:8px;vertical-align:1px}",
      "html body #page .fo-ac2-rep{border:1px solid rgba(27,36,50,.09);border-radius:13px;padding:13px 14px;background:#FFFEFC}",
      "html body #page .fo-ac2-rh{display:flex;align-items:flex-start;gap:12px}",
      "html body #page .fo-ac2-rh>div:first-child{min-width:0;flex:1}",
      "html body #page .fo-ac2-rh b{display:block;font:600 21px/1.1 Fraunces,Georgia,serif;color:#14243A}",
      "html body #page .fo-ac2-rh i{display:block;font:500 13px/1.4 Oswald,sans-serif;font-style:normal;color:#67748a;margin-top:3px}",
      "html body #page .fo-ac2-rh .bd{flex:none;text-align:right}",
      "html body #page .fo-ac2-rh .bd b{font:700 22px/1 Oswald,sans-serif;color:#C9571F;font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac2-rh .bd i{font:700 11px/1 Oswald,sans-serif;letter-spacing:.15em;text-transform:uppercase;color:#9FB0C6;margin-top:4px}",
      "html body #page .fo-ac2-q{background:#F8F6EF;border-left:3px solid rgba(180,74,34,.5);border-radius:0 9px 9px 0;padding:9px 12px;margin:11px 0 2px;font:italic 400 14px/1.5 Fraunces,Georgia,serif;color:#2A2519}",
      "html body #page .fo-ac2-q i{display:block;font:400 12px/1.3 Oswald,sans-serif;font-style:normal;color:#67748a;margin-top:4px}",
      "html body #page .fo-ac2-go{display:flex}",
      "html body #page .fo-ac2-go .fo-ac-btn{flex:1;text-align:center;padding:13px 17px !important}",
      "html body #page .fo-ac2-hr{height:1px;background:rgba(27,36,50,.08)}",
      "html body #page .fo-ac2-strip{display:flex;align-items:center;gap:12px;flex-wrap:wrap}",
      "html body #page .fo-ac2-strip .tx{flex:1 1 200px;min-width:0}",
      "html body #page .fo-ac2-strip i{display:block;font:500 12px/1.5 Oswald,sans-serif;font-style:normal;color:#67748a;margin-top:6px}",
      "html body #page .fo-ac-btn.sm{padding:9px 14px !important;font-size:10px}",
      "@media(max-width:480px){html body #page .fo-ac2-bill b{font-size:17px}html body #page .fo-ac2-bill .bf{width:44px;height:31px}}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
