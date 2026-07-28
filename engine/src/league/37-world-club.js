/* ============================================================================
   JOIN THE WORLD (#/worldclub) — the P3 client of the served world.

   The served world became joinable: any signed-in manager can claim a bot
   club in any of the 19 nations (never the boss) and submit orders; the
   umpire plays them at that nation's hour on the real engine. This module
   is the client of that write surface - every call goes through the
   server's SECURITY DEFINER RPCs, which re-validate everything ("no
   client trust"): this page could lie all it wants and the server would
   shrug.

   The international game itself - the windows, the squads, the tours and
   the caps - has its own room now (module 46, #/nations). What lives here
   is the part a MANAGER meets: on a window round the sheet knows which of
   his men his country has taken, greys them out, and tells him what the
   board is paying him for the week.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foWJ) return; window.__foWJ = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function jwt() { try { return (window.__foJWT && window.__foJWT()) || ""; } catch (e) { return ""; } }
  // the programmes the shipped engine actually knows how to work
  function PROGS() {
    try {
      var k = Object.keys(window.FO_TRAIN_PROGS || {});
      if (k.length) return k.filter(function (x) { return x !== "Rest"; }).concat(["Rest"]);
    } catch (e) {}
    return ["Batting", "Power hitting", "Finishing", "Bowling", "New-ball seam",
      "Spin bowling", "Death bowling", "Control bowling", "Keeping", "Fielding", "Fitness", "All-rounder", "Rest"];
  }
  function money0(v) {
    var n = Number(v);
    if (!isFinite(n)) return "&mdash;";
    var neg = n < 0; n = Math.abs(n);
    var s = n >= 1000000 ? (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + "m"
          : n >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n));
    return (neg ? "-$" : "$") + s;
  }
  function cx() { return window.__foCxAPI || null; }
  function flagOf(rid) {
    var base = (typeof FO_ART !== "undefined") ? FO_ART : "client/art/";
    try { return base + "flags/" + cx().flagFile(rid) + ".svg"; } catch (e) { return ""; }
  }
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
      .then(function (rows) { return rows && rows[0] && rows[0].body; });
  }

  var ST = { view: null, nation: "eng", picked: [], five: [], capt: null, keep: null, toss: "bat", allRounds: false, busy: "" };

  // ---- A MANAGER IS CALLED WHAT HE CALLS HIMSELF -----------------------------
  // The name typed on the founding certificate is the name the world uses. It
  // is kept on the device (the account's display name is the old private
  // league's, and is usually empty here), so a claim never falls back to a
  // placeholder like "Orange Club manager" when the man has already told us
  // who he is.
  window.foMgrName = function () {
    var nm = "";
    try { nm = (App && App.founder && App.founder.mgr) || ""; } catch (e) {}
    if (!nm) { try { nm = localStorage.getItem("fo_mgr") || ""; } catch (e2) {} }
    if (!nm) { try { nm = (SYNC && SYNC.me && SYNC.me.display_name) || ""; } catch (e3) {} }
    nm = String(nm || "").trim();
    return (nm && nm.toLowerCase() !== "manager") ? nm.slice(0, 24) : "";
  };
  function mgrForClaim() {
    var nm = window.foMgrName();
    if (nm) return nm;
    try { return (userTeam().name || "The") + " manager"; } catch (e) { return "manager"; }
  }

  // the engine's own spell template, built from YOUR ordered five: openers
  // attack with the new ball, the middle grinds, the closers defend the death
  function spellsOf(five) {
    if (five.length < 5) return { north: [], south: [] };
    var b1 = five[0], b2 = five[1], b3 = five[2], b4 = five[3], b5 = five[4];
    return {
      north: [{ bowler: b1, first: 1, n: 5, field: "att" }, { bowler: b3, first: 11, n: 10, field: "bal" }, { bowler: b5, first: 31, n: 5, field: "bal" }, { bowler: b1, first: 41, n: 5, field: "def" }],
      south: [{ bowler: b2, first: 2, n: 5, field: "att" }, { bowler: b4, first: 12, n: 10, field: "bal" }, { bowler: b2, first: 32, n: 5, field: "bal" }, { bowler: b5, first: 42, n: 5, field: "def" }]
    };
  }

  // ---- ONE CLUB, ONE SQUAD -------------------------------------------------
  // There is only one world, so there is only one set of men. The World
  // Service owns your club's squad - it is the eleven that walks out at your
  // nation's hour, the names that accumulate caps and form and tired legs -
  // and this pulls them down into the club the whole game reads. Squad page,
  // club home, player cards: all of them now show the cricketers who
  // actually play for you, carrying the lives the season has given them.
  //
  // The world is the authority: whatever is here is replaced by whatever the
  // service says. Nothing local is lost that the world would not overwrite
  // anyway - and any saved lineup naming men who no longer wear the shirt is
  // cleared, so you never send out a teamsheet of ghosts.
  function adoptWorldSquad(st) {
    try {
      if (!st || !st.claim || !Array.isArray(st.squad) || st.squad.length < 11) return false;
      var t = null; try { t = userTeam(); } catch (eT) { return false; }
      if (!t) return false;
      var names = st.squad.map(function (p) { return p && p.name; });
      var sig = st.claim.country + ":" + st.claim.slot + ":" + names.join("|");
      if (t.__worldSig === sig) return false;              // already these men
      t.players = JSON.parse(JSON.stringify(st.squad));
      if (st.claim.club) t.name = st.claim.club;
      if (st.claim.ground) t.ground = st.claim.ground;
      t.youth = t.youth || [];
      t.__worldSig = sig;
      try { if (typeof ensureTraining === "function") t.players.forEach(ensureTraining); } catch (eE) {}
      // a lineup that names men who have gone is no lineup at all
      try {
        var have = {}; names.forEach(function (n) { have[n] = 1; });
        var stale = function (o) {
          if (!o) return false;
          var list = (o.xi || []).concat(o.batOrder || []);
          return list.some(function (n) { return n && !have[n]; });
        };
        if (stale(App.orders)) { App.orders = null; }
        if (stale(App.defaults)) { App.defaults = null; }
      } catch (eO) {}
      try { if (typeof saveGame === "function") saveGame(false); } catch (eS) {}
      // repaint whatever is on screen so the new men appear at once
      try {
        var pg = document.getElementById("page");
        if (pg) pg.__foLgSig = null;
        if (typeof window.route === "function") window.route();
      } catch (eR) {}
      return true;
    } catch (e) { return false; }
  }
  window.__foAdoptWorldSquad = adoptWorldSquad;

  // ---- THE SHEET YOU SET IS THE SHEET THE UMPIRE PLAYS -----------------------
  // The orders page is the manager's voice. Saving it files that exact sheet
  // with the World Service for every round still to come this season, so the
  // resolver plays HIS plan - the order, the instructions, the spells, the
  // fields, the toss - whether or not he is awake at his nation's hour. Only
  // the parts the engine reads are sent; the page's own scratch state stays
  // on the device.
  function trimOrders(o) {
    if (!o) return null;
    var out = {};
    ["xi", "batOrder", "captain", "keeper", "tossCall", "tossDecision",
      "phaseIntent", "fieldPlan", "spells", "manBat", "manBowl"].forEach(function (k) {
      if (o[k] != null) out[k] = o[k];
    });
    return out;
  }
  window.__foWorldPushOrders = function (orders, cb) {
    try {
      if (!jwt() || !window.__foWorldClaim) return false;
      var body = trimOrders(orders);
      if (!body || !(body.batOrder || body.xi)) return false;
      var from = 1;
      try {
        var cal = window.__foWT && window.__foWT.serverCal ? window.__foWT.serverCal(Date.now()) : null;
        if (cal && cal.round >= 1) from = Math.min(18, cal.round);
      } catch (eC) {}
      var chain = Promise.resolve(), sent = 0;
      for (var r = from; r <= 18; r++) {
        (function (r2) { chain = chain.then(function () { sent++; return rpc("world_submit_orders", { p_round: r2, p_orders: body }); }); })(r);
      }
      chain.then(function () { try { if (cb) cb(null, sent); } catch (e) {} })
        .catch(function (e) { try { if (cb) cb(e); } catch (e2) {} });
      return true;
    } catch (e) { return false; }
  };

  // the nets hand their plan to the World Service, debounced - a manager
  // flicking through programmes should not write once per flick
  var TR_T = null, TR_LAST = "";
  window.__foWorldPushTraining = function (plan) {
    try {
      if (!jwt() || !window.__foWorldClaim) return;
      var body = JSON.stringify(plan || {});
      if (body === TR_LAST) return;
      if (TR_T) clearTimeout(TR_T);
      TR_T = setTimeout(function () {
        TR_LAST = body;
        rpc("world_set_training", { p_plan: plan || {} })
          .then(function () { try { toast("The nets are set - the umpire takes it from here."); } catch (e) {} })
          .catch(function () { TR_LAST = ""; });
      }, 900);
    } catch (e) {}
  };

  // ONE CLUB, ONE NAME. The world is the naming authority, so christening
  // has to be reachable from wherever a manager notices the mismatch - the
  // club dossier, not just this page's rename button.
  window.__foWorldRename = function (nm, cb) {
    try {
      nm = String(nm || "").trim();
      if (!nm) { if (cb) cb(false, "no name given"); return; }
      if (!jwt()) { if (cb) cb(false, "sign in first"); return; }
      rpc("world_rename_club", { p_club_name: nm })
        .then(function () {
          try {
            var c9 = window.__foWorldClaim;
            if (c9) { c9.club = nm; localStorage.setItem("fo_world_claim", JSON.stringify(c9)); }
            if (c9 && c9.country) localStorage.removeItem("fo_world_nm_" + c9.country);
          } catch (e2) {}
          if (cb) cb(true);
        })
        .catch(function (e) { if (cb) cb(false, e && e.message); });
    } catch (e) { if (cb) cb(false, e && e.message); }
  };

  // the Nets asks for the standing plan when it does not have it yet
  window.__foWorldRefreshPlan = function () {
    try {
      if (!jwt()) return;
      rpc("world_my_status").then(function (st) {
        if (!st || !st.claim) return;
        window.__foWorldPlan = st.training || {};
        window.__foWorldClaim = st.claim;
        adoptWorldSquad(st);
        if ((location.hash || "").split("?")[0] === "#/training" && window.foRenderNetsPage) window.foRenderNetsPage();
      }).catch(function () {});
    } catch (e) {}
  };

  // ---- signing up IS claiming a club ---------------------------------------
  // No hunt for a claim button: once the account is signed in and no world
  // club is held, the first free club in the manager's own country is
  // claimed automatically, christened with their club name. If the country
  // is full, say so and open the nation picker.
  function autoClaim() {
    try {
      if (!jwt()) return;
      if (localStorage.getItem("fo_world_claim")) return;    // already seated
      var nat = "eng";
      try { nat = (window.__foLgAPI && window.__foLgAPI.nation && window.__foLgAPI.nation()) || "eng"; } catch (eN) {}
      var clubNm = ""; try { clubNm = userTeam().name || ""; } catch (eC) {}
      var mgr = mgrForClaim();
      rpc("world_my_status").then(function (st) {
        if (!st || st.signedIn === false) return;
        if (st.claim) {
          window.__foWorldClaim = st.claim;
          try { localStorage.setItem("fo_world_claim", JSON.stringify(st.claim)); } catch (eS) {}
          window.__foWorldPlan = st.training || {};
          adoptWorldSquad(st);
          return;
        }
        rpc("world_auto_claim", { p_country: nat, p_name: mgr, p_club_name: clubNm || null }).then(function (r) {
          if (!r || !r.ok) return;
          var cl = { country: r.country, slot: r.slot, club: r.club, name: mgr };
          window.__foWorldClaim = cl;
          try { localStorage.setItem("fo_world_claim", JSON.stringify(cl)); localStorage.removeItem("fo_world_nm_" + r.country); } catch (eS2) {}
          rpc("world_my_status").then(adoptWorldSquad).catch(function () {});
          try {
            if ((location.hash || "").indexOf("#/nation") === 0) {
              var pg = document.getElementById("page"); if (pg) pg.__foLgSig = null;
              if (window.foRenderNation) window.foRenderNation();
            }
          } catch (eR) {}
        }).catch(function (e) {
          if (/full/i.test(String(e.message || ""))) {
            try {
              alert(String(e.message).slice(0, 200));
              ST.view = null; location.hash = "#/worldclub";
              if (typeof window.route === "function") window.route();
            } catch (eA) {}
          }
        });
      }).catch(function () {});
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(autoClaim, 3000); });
  else setTimeout(autoClaim, 3000);

  // ---- #/worldclub ----------------------------------------------------------
  window.foRenderWorldClubPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    foWjCss();
    page.innerHTML = shell("Your club in the served world", "<div class='fo-wj-note'>Reaching the world&hellip;</div>");
    rpc("world_my_status").then(function (st) {
      // the whole game wants to know which world club is yours - cache it
      try {
        window.__foWorldClaim = (st && st.claim) || null;
        if (st && st.claim) localStorage.setItem("fo_world_claim", JSON.stringify(st.claim));
        else localStorage.removeItem("fo_world_claim");
      } catch (eCl) {}
      if (!st || st.signedIn === false || !jwt()) return renderSignIn(page);
      if (!st.claim) return renderBrowse(page);
      window.__foWorldPlan = st.training || {};
      adoptWorldSquad(st);          // the world's men are your men, everywhere
      renderMyClub(page, st);
    }).catch(function (e) {
      page.innerHTML = shell("Your club in the served world",
        "<div class='fo-wj-note'>The world could not be reached (" + E(String(e.message).slice(0, 90)) + "). The leagues play on regardless - try again in a minute.</div>");
    });
  };

  function shell(sub, body) {
    return "<div class='fo-wj'><div class='fo-wj-in'>" +
      "<div class='fo-wj-hero'><div class='fo-wj-k'>The joinable world</div>" +
      "<h1>A Club of Your Own, Anywhere</h1>" +
      "<p>" + E(sub) + "</p></div>" + body +
      "<div class='fo-wj-foot'><a href='#/planet'>&lsaquo; World cricket</a><a href='#/nations'>The international game &rsaquo;</a></div>" +
      "</div></div>";
  }
  function renderSignIn(page) {
    page.innerHTML = shell("Nineteen leagues, one club with your name on it",
      "<div class='fo-wj-card'><p class='fo-wj-p'>Claim a club in any nation's served league - Ireland, the West Indies, Nepal, anywhere. The umpire plays your orders at that nation's hour whether you're awake or not. Sign in to your Fifty Overs account first (the same one that saves your game), then come back here.</p></div>");
  }

  function renderBrowse(page) {
    var regions = (cx() && cx().regions() || []).filter(function (r) { return !r.final; });
    var tabs = regions.map(function (r) {
      return "<button type='button' class='fo-wj-nat" + (r.id === ST.nation ? " on" : "") + "' data-nat='" + r.id + "'>" +
        "<img src='" + flagOf(r.id) + "' alt=''><span>" + E(r.nm) + "</span></button>";
    }).join("");
    page.innerHTML = shell("Pick a nation, pick a club, and the world is yours to manage",
      "<div class='fo-wj-card'><h3>The nations</h3><div class='fo-wj-natrow'>" + tabs + "</div></div>" +
      "<div class='fo-wj-card' id='fo-wj-clubs'><h3>The clubs</h3><div class='fo-wj-note'>Loading the league&hellip;</div></div>");
    page.querySelectorAll("[data-nat]").forEach(function (b) {
      b.addEventListener("click", function () { ST.nation = b.getAttribute("data-nat"); renderBrowse(page); });
    });
    sel("world_clubs?country_id=eq." + ST.nation + "&select=slot,name,ground,is_boss,manager&order=slot").then(function (rows) {
      var box = page.querySelector("#fo-wj-clubs"); if (!box) return;
      if (!rows || !rows.length) { box.innerHTML = "<h3>The clubs</h3><div class='fo-wj-note'>The served world hasn't founded this league yet.</div>"; return; }
      var fullNote = rows.filter(function (c) { return !c.is_boss && !c.manager; }).length === 0
        ? "<div class='fo-wj-note'><b>This country is full</b> - every club already has a manager. Pick another nation above; the umpire plays your orders at that nation's hour wherever you settle.</div>" : "";
      box.innerHTML = "<h3>The clubs</h3>" + fullNote + rows.map(function (c) {
        var state = c.is_boss ? "<u class='boss'>THE FLAGSHIP</u>"
          : c.manager ? "<u class='taken'>" + E(c.manager) + "</u>"
          : "<button type='button' class='fo-wj-claim' data-slot='" + c.slot + "' data-club='" + E(c.name) + "'>Claim</button>";
        return "<div class='fo-wj-club'><b>" + E(c.name) + "</b><span>" + E(c.ground || "") + "</span>" + state + "</div>";
      }).join("");
      box.querySelectorAll(".fo-wj-claim").forEach(function (b) {
        b.addEventListener("click", function () {
          if (b.disabled) return; b.disabled = true; b.textContent = "Claiming…";
          var mgr = mgrForClaim();
          // christen the club: your own club name rides in as the default
          var defNm = ""; try { defNm = userTeam().name || ""; } catch (eD) {}
          var clubNm = null;
          try { clubNm = prompt("Name your club (the whole world will see it):", defNm || b.getAttribute("data-club") || ""); } catch (ePr) {}
          if (clubNm === null) { b.disabled = false; b.textContent = "Claim"; return; }
          rpc("world_claim_club", { p_country: ST.nation, p_slot: +b.getAttribute("data-slot"), p_name: mgr, p_club_name: String(clubNm).trim() || null })
            .then(function () { try { localStorage.removeItem("fo_world_nm_" + ST.nation); } catch (e) {} window.foRenderWorldClubPage(); })
            .catch(function (e) { b.disabled = false; b.textContent = "Claim"; alert(String(e.message).slice(0, 140)); });
        });
      });
    }).catch(function () {});
  }

  function renderMyClub(page, st) {
    var c = st.claim, squad = st.squad || [];
    var sent = {}; (st.orders || []).forEach(function (o) { sent[o.round] = 1; });
    snapshot("league/" + c.country).then(function (lg) {
      var nextRound = lg ? Math.min(18, (lg.roundsPlayed || 0) + 1) : 1;
      // teamsheets go in an hour before the first ball (the umpire enforces
      // it server-side): inside that hour, the next orderable round is
      // tomorrow's
      try {
        var wt9 = window.__foWT, pl9 = window.__foPlanet;
        if (wt9 && wt9.serverCal && pl9) {
          var now9 = Date.now(), cal9 = wt9.serverCal(now9);
          if (cal9.seasonNo >= 1 && cal9.dayInSeason >= 0 && cal9.dayInSeason <= 17) {
            var hN9 = (now9 - (pl9.EPOCH + pl9.dayIx(now9) * 86400000)) / 3600000;
            var minOpen = cal9.round + (hN9 >= pl9.natHour(c.country) - 1 ? 1 : 0);
            nextRound = Math.min(18, Math.max(nextRound, minOpen));
          }
        }
      } catch (eLk) {}
      var pos = "";
      if (lg && lg.table) {
        var ix = lg.table.findIndex(function (t) { return t.name === c.club; });
        if (ix >= 0) pos = (ix + 1) + (["th", "st", "nd", "rd"][((ix + 1) % 100 > 10 && (ix + 1) % 100 < 14) ? 0 : Math.min((ix + 1) % 10, 4)] || "th") + " · " + lg.table[ix].pts + " pts";
      }
      var byName = {}; squad.forEach(function (p) { byName[p.name] = p; });
      var isBowler = function (nm) { var p = byName[nm]; return p && p.bowlType && p.bowlType !== "none"; };
      // THE INTERNATIONAL WINDOW. Three rounds a season your country takes
      // its best men and pays you for the week. They are not available for
      // this round - so the sheet greys them out rather than letting you pick
      // an eleven that cannot take the field.
      var away = {}, awayFee = 0, awayMen = [];
      var windows = st.windows || [5, 9, 13];
      var isWindow = windows.indexOf(+nextRound) >= 0;
      (st.callups || []).forEach(function (cu) {
        if (+cu.round !== +nextRound) return;
        away[cu.player] = 1; awayFee += (+cu.fee || 0); awayMen.push(cu.player);
      });
      var here = squad.filter(function (p) { return !away[p.name]; });
      if (!ST.picked.length) ST.picked = here.slice(0, 11).map(function (p) { return p.name; });
      ST.picked = ST.picked.filter(function (nm) { return !away[nm]; });
      // keep the five/captain/keeper coherent with the XI
      ST.five = ST.five.filter(function (nm) { return ST.picked.indexOf(nm) >= 0 && isBowler(nm); });
      if (ST.five.length < 5) ST.picked.forEach(function (nm) { if (ST.five.length < 5 && isBowler(nm) && ST.five.indexOf(nm) < 0) ST.five.push(nm); });
      if (!ST.keep || ST.picked.indexOf(ST.keep) < 0) ST.keep = (ST.picked.filter(function (nm) { return byName[nm] && byName[nm].keeper; })[0]) || ST.picked[0];
      if (!ST.capt || ST.picked.indexOf(ST.capt) < 0) ST.capt = ST.picked[0];

      // THE LIVING SQUAD: the World Service carries every man's form, his
      // tired legs and his caps, and the sheet shows them - because who is
      // fresh and who is flying is the whole of team selection.
      var FORMW = ["abysmal", "poor", "shaky", "steady", "good", "strong", "excellent"];
      var men = squad.map(function (p) {
        var ix2 = ST.picked.indexOf(p.name);
        var fi = p.formIx == null ? 3 : p.formIx;
        var fat = +p.fatN || 0;
        var tired = fat >= 44 ? " tired" : "";
        var caps = (p.career && p.career.m) || 0;
        var intl = (p.intl && p.intl.m) || 0;
        var line = (p.bowlType && p.bowlType !== "none" ? "bowls" : p.keeper ? "keeper" : "bats") +
          " &middot; " + (p.rating || "") + (caps ? " &middot; " + caps + " cap" + (caps === 1 ? "" : "s") : "") +
          (intl ? " &middot; " + intl + " for his country" : "");
        if (away[p.name]) return "<button type='button' class='fo-wj-man gone' disabled>" +
          "<i>&#9992;</i><b>" + E(p.name) + "</b><span>" + line + "</span>" +
          "<u class='fo-wj-form t'>away with his country</u></button>";
        return "<button type='button' class='fo-wj-man" + (ix2 >= 0 ? " on" : "") + "' data-nm='" + E(p.name) + "'>" +
          "<i>" + (ix2 >= 0 ? (ix2 + 1) : "&middot;") + "</i><b>" + E(p.name) + "</b>" +
          "<span>" + line + "</span>" +
          "<u class='fo-wj-form f" + fi + (tired ? " t" : "") + "'>" + E(FORMW[fi] || "steady") +
          (tired ? " &middot; " + E(p.fatWord || "tired") : "") + "</u></button>";
      }).join("");
      var windowNote = !isWindow ? ""
        : "<div class='fo-wj-window'><b>&#9992; International window &middot; round " + nextRound + "</b>" +
          (awayMen.length
            ? "<i>" + awayMen.length + " of your men " + (awayMen.length === 1 ? "is" : "are") +
              " with their country: " + E(awayMen.join(", ")) + ". The board pays you $" +
              awayFee.toLocaleString() + " for the week. Pick around them &mdash; and if an old sheet still names one, " +
              "the umpire sends out the best man left rather than tearing it up.</i>"
            : "<i>The selectors meet on the morning of this round. If they want your men you will be told here, and paid for them.</i>") +
          "</div>";
      var fiveBtns = ST.picked.filter(isBowler).map(function (nm) {
        var fx = ST.five.indexOf(nm);
        return "<button type='button' class='fo-wj-five" + (fx >= 0 ? " on" : "") + "' data-bw='" + E(nm) + "'>" +
          "<i>" + (fx >= 0 ? (fx + 1) : "&middot;") + "</i>" + E(nm) + "</button>";
      }).join("");
      var selOf = function (id, cur) {
        return "<select id='" + id + "' class='fo-wj-sel'>" + ST.picked.map(function (nm) {
          return "<option value=\"" + E(nm) + "\"" + (nm === cur ? " selected" : "") + ">" + E(nm) + "</option>";
        }).join("") + "</select>";
      };
      var tossBtns = ["bat", "bowl"].map(function (t) {
        return "<button type='button' class='fo-wj-toss" + (ST.toss === t ? " on" : "") + "' data-toss='" + t + "'>" + (t === "bat" ? "Bat first" : "Bowl first") + "</button>";
      }).join("");

      page.innerHTML = shell("Round " + nextRound + " of the " + c.country.toUpperCase() + " league awaits your orders",
        "<div class='fo-wj-card fo-wj-mine'><h3>" + E(c.club) + " <span>" + E(c.country.toUpperCase()) + (pos ? " · " + pos : "") + "</span></h3>" +
        "<p class='fo-wj-p'>Submitted orders " +
        ((st.orders || []).length ? "on file for round" + ((st.orders || []).length > 1 ? "s" : "") + " " + (st.orders || []).map(function (o) { return o.round; }).join(", ") : "none yet") + ".</p>" +
        "<div id='fo-wj-cab' class='fo-wj-note'>Opening the trophy cabinet&hellip;</div>" +
        // THE COUNTING HOUSE: a treasury the umpire settles from gate takings
        // and the wage bill, and a face the rest of the world reads
        "<h4 class='fo-wj-h4'>The counting house <span>settled by the umpire, gate less wages</span></h4>" +
        "<div class='fo-wj-money'><div><i>Treasury</i><b>" + money0(st.bank) + "</b></div>" +
        "<div><i>Weekly wages</i><b>" + money0(squad.reduce(function (a, p) { return a + (p.wage || 0); }, 0)) + "</b></div></div>" +
        // the nets live at #/training - one training ground, not two
        "<a class='fo-wj-netslink' href='#/training'>&#127951; The nets &mdash; set what your men work on &rsaquo;</a>" +
        // the academy is the club's other standing decision: what you pay to
        // bring boys through, and which of them is ready early
        "<a class='fo-wj-netslink' href='#/academy'>&#127775; The academy &mdash; the colts on your books &rsaquo;</a>" +
        // and the books: the crowd, the gate and how big a ground to build
        "<a class='fo-wj-netslink' href='#/finance'>&#128176; The books &mdash; the gate, the crowd and the ground &rsaquo;</a>" +
        // and cricket you organise yourself, outside the league
        "<a class='fo-wj-netslink' href='#/comps'>&#127942; The invitationals &mdash; put on a competition of your own &rsaquo;</a>" +
        // and the game above the club game: who your country has taken, and
        // what it pays you for them
        "<a class='fo-wj-netslink' href='#/nations'>&#9992; The international game &mdash; the windows, the squads and the caps &rsaquo;</a>" +
        // your own name: the table, your club page and every fixture list use it
        "<h4 class='fo-wj-h4'>Your name <span>what the world calls the manager of this club</span></h4>" +
        "<div class='fo-wj-idrow'>" +
        "<input id='fo-wj-mgr' maxlength='24' placeholder='Your name' value='" + E(st.manager || window.foMgrName() || "") + "' aria-label='Manager name'>" +
        "<button type='button' id='fo-wj-mgrsave'>Save</button></div>" +
        "<h4 class='fo-wj-h4'>The club's face <span>what every rival sees on your page</span></h4>" +
        "<div class='fo-wj-idrow'>" +
        "<input id='fo-wj-idcrest' maxlength='4' placeholder='YO' value='" + E((st.identity && st.identity.crest) || "") + "' aria-label='Crest mark'>" +
        "<input id='fo-wj-idcol' type='color' value='" + E((st.identity && st.identity.colour) || "#C8542F") + "' aria-label='Club colour'>" +
        "<input id='fo-wj-idmotto' maxlength='60' placeholder='A motto for the shirt' value='" + E((st.identity && st.identity.motto) || "") + "' aria-label='Motto'>" +
        "<button type='button' id='fo-wj-idsave'>Save</button></div>" +
        "<h4 class='fo-wj-h4'>Friendlies <span>manager v manager &middot; no stakes, just cricket</span></h4>" +
        "<div id='fo-wj-frlist' class='fo-wj-note'>Checking the post&hellip;</div>" +
        "<div class='fo-wj-frnew'><select id='fo-wj-frnat' aria-label='Nation'></select>" +
        "<select id='fo-wj-frclub' aria-label='Club'><option>Pick a nation&hellip;</option></select>" +
        "<input type='datetime-local' id='fo-wj-frwhen' aria-label='Match date and time'>" +
        "<button type='button' id='fo-wj-frgo' class='fo-wj-frbtn'>&#9876; Challenge</button></div>" +
        "<div class='fo-wj-note'>You name the date and hour. Both managers can set a lineup for the friendly until <b>one hour before</b> play, when teamsheets lock; an unanswered challenge dies at the same moment and is never played.</div>" +
        "<h4 class='fo-wj-h4'>The eleven, in batting order</h4>" +
        windowNote +
        "<div class='fo-wj-sq'>" + men + "</div>" +
        "<h4 class='fo-wj-h4'>The bowling five, in spell order <span>openers attack &middot; middle grinds &middot; closers defend</span></h4>" +
        "<div class='fo-wj-fiverow'>" + (fiveBtns || "<span class='fo-wj-note'>Pick bowlers into the XI first.</span>") + "</div>" +
        "<div class='fo-wj-row'><label>Captain</label>" + selOf("fo-wj-capt", ST.capt) + "<label>Keeper</label>" + selOf("fo-wj-keep", ST.keep) + "</div>" +
        "<div class='fo-wj-row'><label>Win the toss</label>" + tossBtns + "</div>" +
        "<label class='fo-wj-chk'><input type='checkbox' id='fo-wj-all'" + (ST.allRounds ? " checked" : "") + "> Use these orders for every remaining round</label>" +
        "<div class='fo-wj-act'><button type='button' id='fo-wj-send' class='fo-wj-send'>" + (sent[nextRound] ? "Update" : "Submit") + " orders &middot; R" + nextRound + " (" + ST.picked.length + "/11 &middot; " + ST.five.length + "/5)</button>" +
        "<button type='button' id='fo-wj-ren' class='fo-wj-rel'>Rename club</button>" +
        "<button type='button' id='fo-wj-rel' class='fo-wj-rel'>Release club</button></div>" +
        "<div class='fo-wj-note' id='fo-wj-msg'></div></div>");

      var idBtn = page.querySelector("#fo-wj-idsave");
      if (idBtn) idBtn.addEventListener("click", function () {
        idBtn.disabled = true;
        rpc("world_set_identity", { p_identity: {
          crest: (page.querySelector("#fo-wj-idcrest") || {}).value || "",
          colour: (page.querySelector("#fo-wj-idcol") || {}).value || "#C8542F",
          motto: (page.querySelector("#fo-wj-idmotto") || {}).value || ""
        } }).then(function () {
          idBtn.disabled = false;
          try { toast("Your colours are up - the whole world can see them."); } catch (e) {}
        }).catch(function (e) {
          idBtn.disabled = false;
          alert(String(e.message || "The world could not be reached.").slice(0, 140));
        });
      });

      page.querySelectorAll(".fo-wj-man").forEach(function (b) {
        b.addEventListener("click", function () {
          var nm = b.getAttribute("data-nm"), ix3 = ST.picked.indexOf(nm);
          if (ix3 >= 0) ST.picked.splice(ix3, 1); else if (ST.picked.length < 11) ST.picked.push(nm);
          renderMyClub(page, st);
        });
      });
      page.querySelectorAll(".fo-wj-five").forEach(function (b) {
        b.addEventListener("click", function () {
          var nm = b.getAttribute("data-bw"), fx = ST.five.indexOf(nm);
          if (fx >= 0) ST.five.splice(fx, 1); else if (ST.five.length < 5) ST.five.push(nm);
          renderMyClub(page, st);
        });
      });
      page.querySelectorAll("[data-toss]").forEach(function (b) {
        b.addEventListener("click", function () { ST.toss = b.getAttribute("data-toss"); renderMyClub(page, st); });
      });
      try {
        var mgEl = page.querySelector("#fo-wj-mgr"), mgSv = page.querySelector("#fo-wj-mgrsave");
        if (mgSv && mgEl) mgSv.addEventListener("click", function () {
          var nm9 = (mgEl.value || "").trim();
          mgSv.disabled = true; mgSv.textContent = "Saving…";
          rpc("world_set_manager", { p_name: nm9 }).then(function (r9) {
            mgSv.disabled = false; mgSv.textContent = "Save";
            try { localStorage.setItem("fo_mgr", (r9 && r9.manager) || nm9); } catch (e9) {}
            try { if (App.founder) App.founder.mgr = (r9 && r9.manager) || nm9; } catch (e8) {}
            try { localStorage.removeItem("fo_world_mgr_" + c.country); } catch (e7) {}
            try { if (window.__foWorldNames) window.__foWorldNames.want(c.country); } catch (e6) {}
            // this module lives outside the toast helper's closure, so the
            // button itself says it: a confirmation nobody can miss
            mgSv.textContent = "Saved \u2713";
            setTimeout(function () { try { mgSv.textContent = "Save"; } catch (e0) {} }, 2200);
          }).catch(function (e4) {
            mgSv.disabled = false; mgSv.textContent = "Save";
            try { alert(String(e4.message || e4).slice(0, 160)); } catch (e3) {}
          });
        });
      } catch (eMg9) {}
      var captEl = page.querySelector("#fo-wj-capt"), keepEl = page.querySelector("#fo-wj-keep"), allEl = page.querySelector("#fo-wj-all");
      if (captEl) captEl.addEventListener("change", function () { ST.capt = captEl.value; });
      if (keepEl) keepEl.addEventListener("change", function () { ST.keep = keepEl.value; });
      if (allEl) allEl.addEventListener("change", function () { ST.allRounds = allEl.checked; });

      var msg = function (t) { var el = page.querySelector("#fo-wj-msg"); if (el) el.textContent = t; };
      page.querySelector("#fo-wj-send").addEventListener("click", function () {
        if (ST.picked.length !== 11) { msg("Pick exactly eleven."); return; }
        if (ST.five.length !== 5) { msg("Order exactly five bowlers."); return; }
        var payload = {
          xi: ST.picked, batOrder: ST.picked, bat: ST.picked,
          captain: ST.capt, keeper: ST.keep,
          tossDecision: ST.toss, spells: spellsOf(ST.five),
          fieldPlan: { pp: "att", mid: "bal", death: "def" }
        };
        var rounds = ST.allRounds ? [] : [nextRound];
        if (ST.allRounds) for (var r = nextRound; r <= 18; r++) rounds.push(r);
        msg("Submitting…");
        var chain = Promise.resolve();
        rounds.forEach(function (r2) {
          chain = chain.then(function () { return rpc("world_submit_orders", { p_round: r2, p_orders: payload }); });
        });
        chain.then(function () { msg("Orders on file for round" + (rounds.length > 1 ? "s " + rounds[0] + "-" + rounds[rounds.length - 1] : " " + rounds[0]) + ". The umpire has them."); })
          .catch(function (e) { msg("Failed: " + String(e.message).slice(0, 120)); });
      });
      // ---- friendlies: the post, the fixtures, the results ----------------
      var frWhen = function (ms) {
        try {
          var d9 = new Date(ms), DW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          var mm = d9.getMinutes();
          return DW[d9.getDay()] + " " + d9.getDate() + " " + MO[d9.getMonth()] + " &middot; " + (d9.getHours() < 10 ? "0" : "") + d9.getHours() + ":" + (mm < 10 ? "0" : "") + mm;
        } catch (e9) { return ""; }
      };
      var frLineupBtn = function (f) {
        if (Date.now() >= (f.playAtMs || 0) - 3600000) return "";
        return "<button type='button' class='fo-wj-frbtn ghost fo-wj-frlu' data-id='" + f.id + "'>" +
          (f.myOrders ? "Lineup set &#10003; &middot; update" : "Use sheet as lineup") + "</button>";
      };
      var frPaint = function () {
        rpc("world_my_friendlies").then(function (list) {
          var el = page.querySelector("#fo-wj-frlist"); if (!el) return;
          if (!list || !list.length) { el.innerHTML = "No friendlies yet &mdash; challenge any club on earth below."; return; }
          el.innerHTML = list.map(function (f) {
            var when = f.playAtMs ? frWhen(f.playAtMs) : "";
            if (f.incoming) return "<div class='fo-wj-frrow in'><b>" + E(f.home) + "</b> challenge you &middot; " + when +
              "<span><button type='button' class='fo-wj-frbtn fo-wj-fracc' data-id='" + f.id + "'>Accept</button>" +
              "<button type='button' class='fo-wj-frbtn ghost fo-wj-frdec' data-id='" + f.id + "'>Decline</button></span></div>";
            if (f.status === "offered") return "<div class='fo-wj-frrow'><b>" + E(f.away) + "</b><i>" + when + " &middot; awaiting their reply</i><span>" + frLineupBtn(f) + "</span></div>";
            if (f.status === "accepted") {
              var liveNow = Date.now() >= (f.playAtMs || 0);
              return "<div class='fo-wj-frrow on'><b>" + E(f.home) + " v " + E(f.away) + "</b><i>" + when + " &middot; " + (liveNow ? "in play" : "lineups lock an hour before") + "</i><span>" +
                (liveNow ? "<button type='button' class='fo-wj-frbtn fo-wj-frth' data-id='" + f.id + "'>&#127916; Watch LIVE</button>" : frLineupBtn(f)) + "</span></div>";
            }
            if (f.status === "played") return "<div class='fo-wj-frrow done'><b>" + E(f.home) + " v " + E(f.away) + "</b><i>" + E(f.text || "played") + "</i><span><button type='button' class='fo-wj-frbtn ghost fo-wj-frth' data-id='" + f.id + "'>Watch it back &rsaquo;</button></span></div>";
            return "<div class='fo-wj-frrow dim'><b>" + E(f.home) + " v " + E(f.away) + "</b><i>" + f.status + "</i></div>";
          }).join("");
          el.querySelectorAll(".fo-wj-frlu").forEach(function (b9) {
            b9.addEventListener("click", function () {
              if (ST.picked.length !== 11) { msg("Pick exactly eleven on the sheet above first."); return; }
              if (ST.five.length !== 5) { msg("Order exactly five bowlers on the sheet above first."); return; }
              var pay9 = { xi: ST.picked, batOrder: ST.picked, bat: ST.picked, captain: ST.capt, keeper: ST.keep,
                tossDecision: ST.toss, spells: spellsOf(ST.five), fieldPlan: { pp: "att", mid: "bal", death: "def" } };
              rpc("world_friendly_orders", { p_id: +b9.getAttribute("data-id"), p_orders: pay9 })
                .then(function () { msg("Friendly lineup on file."); frPaint(); })
                .catch(function (e9) { msg(String(e9.message).slice(0, 120)); });
            });
          });
          el.querySelectorAll(".fo-wj-frth").forEach(function (b9) {
            b9.addEventListener("click", function () { try { window.foWtFriendly(+b9.getAttribute("data-id")); } catch (e9) {} });
          });
          el.querySelectorAll(".fo-wj-fracc").forEach(function (b9) {
            b9.addEventListener("click", function () { rpc("world_friendly_respond", { p_id: +b9.getAttribute("data-id"), p_accept: true }).then(frPaint).catch(function (e9) { msg(String(e9.message).slice(0, 100)); }); });
          });
          el.querySelectorAll(".fo-wj-frdec").forEach(function (b9) {
            b9.addEventListener("click", function () { rpc("world_friendly_respond", { p_id: +b9.getAttribute("data-id"), p_accept: false }).then(frPaint).catch(function (e9) { msg(String(e9.message).slice(0, 100)); }); });
          });
        }).catch(function () { var el = page.querySelector("#fo-wj-frlist"); if (el) el.textContent = "The post could not be reached - try again in a minute."; });
      };
      frPaint();
      try {
        var natSel = page.querySelector("#fo-wj-frnat"), clubSel = page.querySelector("#fo-wj-frclub");
        var regs = (cx() && cx().regions() || []).filter(function (r9) { return !r9.final; });
        natSel.innerHTML = regs.map(function (r9) { return "<option value='" + E(r9.id) + "'" + (r9.id === c.country ? " selected" : "") + ">" + E(r9.nm) + "</option>"; }).join("");
        var loadClubs = function () {
          sel("world_clubs?country_id=eq." + natSel.value + "&select=slot,name,manager&order=slot").then(function (rows9) {
            clubSel.innerHTML = (rows9 || []).filter(function (x9) { return !(natSel.value === c.country && x9.slot === c.slot); })
              .map(function (x9) { return "<option value='" + x9.slot + "'>" + E(x9.name) + (x9.manager ? " · " + E(x9.manager) : "") + "</option>"; }).join("");
          }).catch(function () {});
        };
        natSel.addEventListener("change", loadClubs);
        loadClubs();
        // default kick-off: three hours from now, on the hour, in local time
        var whenEl = page.querySelector("#fo-wj-frwhen");
        try {
          var dDef = new Date(Date.now() + 3 * 3600000); dDef.setMinutes(0, 0, 0);
          var p2 = function (n9) { return (n9 < 10 ? "0" : "") + n9; };
          whenEl.value = dDef.getFullYear() + "-" + p2(dDef.getMonth() + 1) + "-" + p2(dDef.getDate()) + "T" + p2(dDef.getHours()) + ":00";
        } catch (eDef) {}
        page.querySelector("#fo-wj-frgo").addEventListener("click", function () {
          var whenMs = NaN;
          try { whenMs = new Date(whenEl.value).getTime(); } catch (eW9) {}
          if (!(whenMs > 0)) { msg("Pick a date and time for the match."); return; }
          if (whenMs < Date.now() + 90 * 60000) { msg("Pick a time at least 90 minutes from now - lineups need their window."); return; }
          rpc("world_friendly_challenge", { p_country: natSel.value, p_slot: +clubSel.value, p_play_at_ms: whenMs })
            .then(function (r9) {
              msg(r9.humanOpponent ? "Challenge sent - their manager has until an hour before the match to accept." : "The bot accepts on the spot - set your lineup any time up to an hour before play.");
              frPaint();
            })
            .catch(function (e9) { msg(String(e9.message).slice(0, 120)); });
        });
      } catch (eFr) {}

      // the cabinet: every crown this club has ever worn, from the honours book
      sel("world_snapshots?key=eq.honours&select=body").then(function (rows) {
        var el = page.querySelector("#fo-wj-cab"); if (!el) return;
        var H = rows && rows[0] && rows[0].body, lines = [];
        if (H && H.seasons) Object.keys(H.seasons).sort().forEach(function (sk) {
          var s5 = H.seasons[sk], sn = sk.slice(1);
          if (s5.league && s5.league[c.country] === c.club) lines.push("&#127942; League champions &middot; Season " + sn);
          if (s5.championsCup === c.club) lines.push("&#127942; CHAMPIONS CUP WINNERS &middot; Season " + sn);
        });
        el.innerHTML = lines.length
          ? "<b>The trophy cabinet</b><br>" + lines.join("<br>")
          : "The trophy cabinet stands empty &mdash; win the league and it will never forget.";
      }).catch(function () { var el = page.querySelector("#fo-wj-cab"); if (el) el.textContent = ""; });

      page.querySelector("#fo-wj-ren").addEventListener("click", function () {
        var nn = null;
        try { nn = prompt("Rename your club (2-28 characters - the whole world will see it):", c.club || ""); } catch (ePr) {}
        if (nn === null || !String(nn).trim()) return;
        rpc("world_rename_club", { p_club_name: String(nn).trim() })
          .then(function () { try { localStorage.removeItem("fo_world_nm_" + c.country); } catch (e) {} window.foRenderWorldClubPage(); })
          .catch(function (e) { msg("Rename failed: " + String(e.message).slice(0, 120)); });
      });
      page.querySelector("#fo-wj-rel").addEventListener("click", function () {
        if (!confirm("Release " + c.club + "? Another manager can claim it immediately.")) return;
        rpc("world_release_club").then(function () { ST.picked = []; ST.five = []; window.foRenderWorldClubPage(); }).catch(function () {});
      });
    });
  }

  function foWjCss() {
    if (document.getElementById("fo-wj-css")) return;
    var s = document.createElement("style"); s.id = "fo-wj-css";
    s.textContent = [
      "html body #page .fo-wj{max-width:680px;margin:26px auto 44px;padding:0 14px;color:#141C28}",
      "html body #page .fo-wj-hero{background:linear-gradient(150deg,#0B1D3A,#07162E 70%) !important;border-radius:22px;padding:24px 26px 22px;color:#FFFEFC;box-shadow:0 22px 50px rgba(7,22,46,.35);border-bottom:3px solid #C95532}",
      "html body #page .fo-wj-k{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:#E8B96A}",
      "html body #page .fo-wj-hero h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:30px;letter-spacing:-.015em;margin:8px 0;color:#FFFEFC;line-height:1.05}",
      "html body #page .fo-wj-hero p{font:italic 420 13px/1.6 'Fraunces',Georgia,serif;color:rgba(255,254,252,.78);margin:0;max-width:52ch}",
      "html body #page .fo-wj-card{margin-top:14px;background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:16px;padding:14px 16px}",
      "html body #page .fo-wj-card h3{margin:0 0 10px;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#8A6A1F;display:flex;align-items:center;gap:8px}",
      "html body #page .fo-wj-card h3 span{margin-left:auto;font-size:9px;color:rgba(20,28,40,.45);letter-spacing:.12em}",
      "html body #page .fo-wj-fl{width:22px;height:16px;object-fit:cover;border-radius:3px}",
      "html body #page .fo-wj-p{font:400 13px/1.6 Inter,sans-serif;color:rgba(20,28,40,.72);margin:0 0 10px}",
      "html body #page .fo-wj-note{font:italic 400 12.5px/1.5 'Fraunces',Georgia,serif;color:rgba(20,28,40,.55);margin-top:8px}",
      "html body #page .fo-wj-natrow{display:flex;gap:7px;overflow-x:auto;padding-bottom:4px}",
      ".fo-wj-frrow{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;border-top:1px solid rgba(20,28,40,.07);padding:8px 2px;font:500 12.5px/1.4 Inter,sans-serif;color:#141C28}",
      ".fo-wj-frrow i{font-style:normal;font-size:11px;color:rgba(20,28,40,.5)}",
      ".fo-wj-frrow.in{background:rgba(217,85,42,.06);border-radius:10px;padding:9px 10px}",
      ".fo-wj-frrow.on i{color:#177A57}",
      ".fo-wj-frrow.dim{opacity:.55}",
      ".fo-wj-frrow span{display:inline-flex;gap:6px}",
      ".fo-wj-frnew{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}",
      ".fo-wj-frnew select{flex:1;min-width:110px;font:500 12px/1.2 Inter,sans-serif;padding:9px 10px;border:1px solid rgba(20,28,40,.18);border-radius:10px;background:#FFFEFC;color:#141C28}",
      "html body #page .fo-wj-frbtn{font:700 10.5px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#FFFEFC !important;background:linear-gradient(180deg,#E8894A,#C8542F) !important;border:0 !important;border-radius:999px;padding:9px 14px;cursor:pointer}",
      "html body #page .fo-wj-frbtn.ghost{background:transparent !important;border:1px solid rgba(20,28,40,.25) !important;color:rgba(20,28,40,.6) !important}",
      "html body #page .fo-wj-nat{flex:none;display:flex;flex-direction:column;align-items:center;gap:4px;background:transparent !important;border:none !important;cursor:pointer;padding:4px 2px !important}",
      "html body #page .fo-wj-nat img{width:30px;height:21px;object-fit:cover;border-radius:4px;border:2px solid transparent}",
      "html body #page .fo-wj-nat.on img{border-color:#C95532;box-shadow:0 0 0 3px rgba(201,85,50,.2)}",
      "html body #page .fo-wj-nat span{font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.04em;color:rgba(20,28,40,.6);text-transform:uppercase}",
      "html body #page .fo-wj-club{display:flex;align-items:baseline;gap:10px;padding:9px 0;border-bottom:1px solid rgba(20,28,40,.06)}",
      "html body #page .fo-wj-club:last-child{border-bottom:none}",
      "html body #page .fo-wj-club b{font:600 13.5px/1.2 Inter,sans-serif}",
      "html body #page .fo-wj-club span{flex:1;font-size:11px;color:rgba(20,28,40,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "html body #page .fo-wj-club u{text-decoration:none;font:700 9px/1 Oswald,sans-serif;letter-spacing:.12em}",
      "html body #page .fo-wj-club u.boss{color:#8A6A1F}",
      "html body #page .fo-wj-club u.taken{color:#177A57}",
      "html body #page .fo-wj-claim{font:700 11px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#FFFEFC !important;background:#C95532 !important;border:none !important;border-radius:999px !important;padding:8px 15px !important;cursor:pointer}",
      "html body #page .fo-wj-sq{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}",
      "html body #page .fo-wj-man{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;text-align:left;background:rgba(255,255,255,.85) !important;border:1px solid rgba(20,28,40,.14) !important;border-radius:10px !important;padding:8px 10px !important;cursor:pointer;font:inherit !important;min-width:0;overflow:hidden}",
      "html body #page .fo-wj-man.on{border-color:#C95532 !important;background:rgba(250,238,230,.9) !important}",
      "html body #page .fo-wj-man.gone{opacity:.5;cursor:default;background:rgba(20,28,40,.05) !important;border-style:dashed !important}",
      "html body #page .fo-wj-window{margin:2px 0 10px;padding:11px 13px;background:rgba(11,29,58,.05);border:1px solid rgba(11,29,58,.2);border-left:3px solid #0B1D3A;border-radius:12px}",
      "html body #page .fo-wj-window b{display:block;font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#0B1D3A}",
      "html body #page .fo-wj-window i{display:block;margin-top:6px;font:italic 400 12px/1.55 'Fraunces',Georgia,serif;color:rgba(20,28,40,.72)}",
      "html body #page .fo-wj-man i{font-style:normal;font:700 11px/1 Oswald,sans-serif;color:#C95532;width:16px;text-align:center}",
      "html body #page .fo-wj-man b{display:block;font:600 12px/1.2 Inter,sans-serif;color:#141C28;flex:1 1 auto;min-width:76px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "html body #page .fo-wj-man span{flex:1 0 100%;order:3;font-size:9.5px;color:rgba(20,28,40,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}",
      "html body #page .fo-wj-form{flex:none;margin-left:auto;text-decoration:none;font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:rgba(20,28,40,.45);white-space:nowrap}",
      "html body #page .fo-wj-netslink{display:block;margin:4px 0 8px;padding:11px 13px;background:rgba(250,238,230,.85) !important;border:1px solid rgba(200,84,47,.35);border-radius:12px;font:600 12px/1.3 Inter,sans-serif;color:#B44A22 !important;text-decoration:none !important}",
      ".fo-wj-money{display:flex;gap:10px;margin:2px 0 4px}",
      ".fo-wj-money>div{flex:1;background:rgba(255,255,255,.85);border:1px solid rgba(20,28,40,.12);border-radius:12px;padding:9px 11px;min-width:0}",
      ".fo-wj-money i{display:block;font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.45);font-style:normal}",
      ".fo-wj-money b{display:block;font:700 17px/1.2 Oswald,sans-serif;color:#141C28;margin-top:4px;font-variant-numeric:tabular-nums}",
      ".fo-wj-idrow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:2px 0 6px}",
      "html body #page .fo-wj-idrow input{font:500 12px/1 Inter,sans-serif;border:1px solid rgba(20,28,40,.16);border-radius:9px;padding:8px 9px;background:#fff;color:#141C28;min-width:0}",
      "html body #page .fo-wj-idrow input#fo-wj-idcrest{width:52px;text-align:center;text-transform:uppercase}",
      "html body #page .fo-wj-idrow input#fo-wj-idcol{width:44px;padding:3px;height:34px}",
      "html body #page .fo-wj-idrow input#fo-wj-idmotto{flex:1 1 140px}",
      "html body #page .fo-wj-idrow button{font:600 10px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;background:#141C28 !important;color:#FFFEFC !important;border:0 !important;border-radius:9px !important;padding:10px 14px !important;cursor:pointer}",
      "html body #page .fo-wj-form.f0,html body #page .fo-wj-form.f1{color:#B23230}",
      "html body #page .fo-wj-form.f2{color:#8a6d3b}",
      "html body #page .fo-wj-form.f4{color:#177A57}",
      "html body #page .fo-wj-form.f5,html body #page .fo-wj-form.f6{color:#0E6B4C;font-weight:700}",
      "html body #page .fo-wj-form.t{color:#B23230}",
      "html body #page .fo-wj-h4{margin:14px 0 8px;font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(20,28,40,.55);display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}",
      "html body #page .fo-wj-h4 span{font-size:8.5px;color:rgba(20,28,40,.4);letter-spacing:.1em}",
      "html body #page .fo-wj-fiverow{display:flex;flex-wrap:wrap;gap:6px}",
      "html body #page .fo-wj-five{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.85) !important;border:1px solid rgba(20,28,40,.14) !important;border-radius:999px !important;padding:7px 11px !important;cursor:pointer;font:600 11.5px/1 Inter,sans-serif !important;color:#141C28 !important}",
      "html body #page .fo-wj-five.on{border-color:#177A57 !important;background:rgba(235,249,242,.95) !important}",
      "html body #page .fo-wj-five i{font-style:normal;font:700 10px/1 Oswald,sans-serif;color:#177A57}",
      "html body #page .fo-wj-row{display:flex;align-items:center;gap:8px;margin-top:11px;flex-wrap:wrap}",
      "html body #page .fo-wj-row label{font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.5)}",
      "html body #page .fo-wj-sel{flex:1;min-width:120px;background:#FFFEFC !important;color:#141C28 !important;border:1px solid rgba(20,28,40,.2) !important;border-radius:8px;padding:8px 9px;font:500 12px Inter,sans-serif}",
      "html body #page .fo-wj-toss{font:700 10.5px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:rgba(20,28,40,.6) !important;background:rgba(255,255,255,.85) !important;border:1px solid rgba(20,28,40,.16) !important;border-radius:999px !important;padding:9px 14px !important;cursor:pointer}",
      "html body #page .fo-wj-toss.on{color:#FFFEFC !important;background:#C95532 !important;border-color:#C95532 !important}",
      "html body #page .fo-wj-chk{display:flex;align-items:center;gap:8px;margin-top:12px;font:500 12px/1.4 Inter,sans-serif;color:rgba(20,28,40,.7)}",
      "html body #page .fo-wj-act{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}",
      "html body #page .fo-wj-send{flex:1;font:700 12px/1 Oswald,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#FFFEFC !important;background:#0B1D3A !important;border:none !important;border-radius:999px !important;padding:12px 16px !important;cursor:pointer}",
      "html body #page .fo-wj-rel{font:600 11px/1 Inter,sans-serif;color:rgba(20,28,40,.55) !important;background:transparent !important;border:1px solid rgba(20,28,40,.18) !important;border-radius:999px !important;padding:10px 14px !important;cursor:pointer}",
      "html body #page .fo-wj-natsq{display:flex;flex-wrap:wrap;gap:6px}",
      "html body #page .fo-wj-natsq span{font:500 11.5px/1 Inter,sans-serif;color:#26301F;background:rgba(20,28,40,.05);border-radius:999px;padding:6px 10px}",
      "html body #page .fo-wj-foot{display:flex;gap:10px;justify-content:space-between;margin-top:18px;flex-wrap:wrap}",
      "html body #page .fo-wj-foot a{font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
      "html body #page .fo-wj-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5)}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
