/* ============================================================================
   THE WORLD SERVICE CLIENT — no page of its own any more.

   The served world is joinable: a signed-in manager holds a club in one of
   the 19 nations, and the umpire plays that club at its nation's hour on the
   real engine. This module is the client of that write surface - every call
   goes through the server's SECURITY DEFINER RPCs, which re-validate
   everything ("no client trust"): this file could lie all it wants and the
   server would shrug.

   It used to carry a room as well (#/worldclub - claim, rename, release,
   friendlies, the pending teamsheet). That room is retired, and what stayed
   is the plumbing every other room depends on and nobody sees:

     autoClaim            a seat is taken automatically on the first load, and
                          reconciled on every load after it
     adoptWorldSquad      the world's men become the club's men, everywhere
     __foWorldPushOrders  the sheet you set is the sheet the umpire plays
     __foWorldPushTraining / __foWorldRefreshPlan
     __foWorldFinance     the bank, one number, quoted from the umpire
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foWJ) return; window.__foWJ = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  function jwt() { try { return (window.__foJWT && window.__foJWT()) || ""; } catch (e) { return ""; } }
  // ---- THE BANK, ONE NUMBER, EVERYWHERE ------------------------------------
  // The Office had its own money: FoFinance, the retired local sim's ledger,
  // which is the same figure the deleted #/ledger page showed and the same
  // reason it disagreed with the Books. Every room that says how much is in
  // the bank must say what the umpire says. world_my_status already carries
  // it, and this module already asks for that on every load, so the answer is
  // cached here for anyone to read rather than fetched again per room.
  function foWorldFinCache(st) {
    try {
      if (!st || st.bank == null) return;
      window.__foWorldFin = { bank: Number(st.bank) || 0, finance: st.finance || {}, at: Date.now() };
    } catch (e) {}
  }
  window.__foWorldFinance = {
    get: function () { return window.__foWorldFin || null; },
    // ask the world again, and tell the caller when it has answered
    want: function (cb) {
      try {
        if (!jwt()) { if (cb) cb(null); return; }
        rpc("world_my_status").then(function (st) {
          foWorldFinCache(st);
          if (cb) cb(window.__foWorldFin || null);
        }).catch(function () { if (cb) cb(window.__foWorldFin || null); });
      } catch (e) { if (cb) cb(null); }
    }
  };
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
    if (!nm) { try { var L = window.__foLeague && window.__foLeague(); nm = (L && L.me && L.me.display_name) || ""; } catch (e3) {} }
    nm = String(nm || "").trim();
    return (nm && nm.toLowerCase() !== "manager") ? nm.slice(0, 24) : "";
  };
  function mgrForClaim() {
    var nm = window.foMgrName();
    if (nm) return nm;
    try { return (userTeam().name || "The") + " manager"; } catch (e) { return "manager"; }
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
  function applyWorldSquad(st) {
    try {
      var t = null; try { t = userTeam(); } catch (eT) { return false; }
      if (!t) return false;
      // COMPARE AGAINST THE MEN WHO ARE ACTUALLY HERE, not against a note we
      // left ourselves last time. This used to keep a signature of the squad it
      // had adopted ON THE TEAM OBJECT - which saveGame then wrote into the
      // browser, and restoreFrom read back with the rest of the blob. So a save
      // carrying an OLD eleven could carry a signature saying that eleven was
      // already the world's, and every login after that matched the note,
      // skipped the adoption and painted the old squad again. The device
      // agreed with itself forever and never once asked the men's names.
      //
      // The served squad is the squad. The only question worth asking is
      // whether the eleven in front of us IS that squad, and that is answered
      // by looking at it - so any drift, whatever caused it, corrects itself on
      // the next status the world sends.
      var names = st.squad.map(function (p) { return p && p.name; });
      var have = (t.players || []).map(function (p) { return p && p.name; });
      // THE SAME MEN IS NOT THE SAME SQUAD. The world describes a cricketer at
      // two resolutions - the engine player world_my_status sends, and the
      // public card world_squads sends - and both arrive here, unordered,
      // whichever the network answers first. Comparing NAMES alone made the two
      // roads indistinguishable, so whichever landed first won and the other
      // was turned away as "already exactly these men". A card landing first
      // therefore locked the real squad out for the rest of the session, and
      // the squad page rendered NaN down the Bat column.
      //
      // So the question is not only WHO but HOW WELL KNOWN: a fuller account of
      // the same fifteen always replaces a thinner one, and never the reverse.
      var thin = function (list) {
        return (list || []).some(function (p) { return p && p.__card; });
      };
      var sameMen = names.length === have.length && names.join("|") === have.join("|");
      // THE BOYS RIDE THE SAME STATUS. The academy's signings live on the
      // squad page now, so the world's youth list is adopted the way the
      // seniors are - and it must happen BEFORE the same-men early return,
      // because a signing changes the boys without moving a single senior,
      // and their skills grow in the nets between visits.
      if (Array.isArray(st.youth)) {
        try {
          var yNew = JSON.stringify(st.youth);
          if (JSON.stringify(t.youth || []) !== yNew) {
            t.youth = JSON.parse(yNew);
            try { if (typeof ensureTraining === "function") t.youth.forEach(ensureTraining); } catch (eY2) {}
            try { if (typeof saveGame === "function") saveGame(false); } catch (eY3) {}
            // a signing or release changes the boys without moving a senior,
            // so the squad room repaints here or shows a ghost till next visit
            try {
              if ((location.hash || "").split("?")[0] === "#/squad" && typeof window.route === "function") window.route();
            } catch (eY4) {}
          }
        } catch (eY) {}
      }
      if (sameMen && !(thin(t.players) && !thin(st.squad))) {
        if (t.__worldSig != null) { try { delete t.__worldSig; saveGame(false); } catch (eD) {} }
        return false;                       // these men, known at least as well
      }
      t.players = JSON.parse(JSON.stringify(st.squad));
      if (st.claim.club) t.name = st.claim.club;
      if (st.claim.ground) t.ground = st.claim.ground;
      t.youth = t.youth || [];
      // the note is retired: shed it so no old save keeps asserting anything
      try { delete t.__worldSig; } catch (eD2) {}
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

  // A manager still mid-conversation with the chairman has no club yet - the
  // ink is not dry, and the commit gate is about to write the squad the
  // journey generated. Pouring the world's men in first would simply be
  // overwritten a moment later, so hold the status while the dialogue is up
  // and lay it down the instant the door closes.
  function clubReady() {
    try {
      var t = userTeam();
      if (!(t && Array.isArray(t.players) && t.players.length)) return false;
      var founded = false;
      try { founded = !!(typeof window.store === "function" ? window.store("fo_onb_done") : localStorage.getItem("fo_onb_done")); } catch (eF) {}
      if (founded) return true;               // the club exists; later dialogues are just talk
      var o = document.getElementById("fo-onb");
      return !(o && o.style.display === "block");
    } catch (e) { return false; }
  }
  var PEND = null, PEND_T = null, PEND_N = 0;
  function pendStop() { if (PEND_T) clearInterval(PEND_T); PEND_T = null; PEND = null; PEND_N = 0; }
  function adoptWorldSquad(st) {
    if (!st || !st.claim || !Array.isArray(st.squad) || st.squad.length < 11) return false;
    if (clubReady()) { pendStop(); return applyWorldSquad(st); }
    PEND = st; PEND_N = 0;
    if (!PEND_T) PEND_T = setInterval(function () {
      if (!PEND || ++PEND_N > 200) return pendStop();     // ten minutes is patience enough
      if (!clubReady()) return;
      var s2 = PEND; pendStop(); applyWorldSquad(s2);
    }, 3000);
    return false;
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
      // a round the umpire has already banked can never take a sheet - on the
      // evening of a match day the calendar still says today's round, and
      // filing for it is a guaranteed rejection
      try {
        var lgB = window.__foWorldLg && window.__foWorldLg.get(window.__foWorldClaim.country);
        var rp = (lgB && lgB.roundsPlayed) | 0;
        if (rp >= from) from = Math.min(18, rp + 1);
      } catch (eR) {}
      // each round files on its own account: one locked round (inside its
      // final hour) must not cost every round after it
      var chain = Promise.resolve(), sent = 0, firstErr = null;
      for (var r = from; r <= 18; r++) {
        (function (r2) {
          chain = chain.then(function () {
            return rpc("world_submit_orders", { p_round: r2, p_orders: body })
              .then(function () { sent++; })
              .catch(function (e) {
                if (/teamsheets are in|lock/i.test(String((e && e.message) || e))) return;
                if (!firstErr) firstErr = e;
              });
          });
        })(r);
      }
      chain.then(function () {
        try {
          if (sent > 0) { if (cb) cb(null, sent); }
          else if (cb) cb(firstErr || new Error("no round was open to take the sheet"));
        } catch (e) {}
      });
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

  // the Nets asks for the standing plan when it does not have it yet
  window.__foWorldRefreshPlan = function () {
    try {
      if (!jwt()) return;
      rpc("world_my_status").then(function (st) {
        if (!st || !st.claim) return;
        window.__foWorldPlan = st.training || {};
        try { window.__foNetsReport = st.netsReport || null; } catch (eNR) {}
      foWorldFinCache(st);
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
      var nat = "eng";
      try { nat = (window.__foLgAPI && window.__foLgAPI.nation && window.__foLgAPI.nation()) || "eng"; } catch (eN) {}
      var clubNm = ""; try { clubNm = userTeam().name || ""; } catch (eC) {}
      var mgr = mgrForClaim();
      // TWO SQUADS, ONE CLUB. This used to stop at the door - "already
      // seated, nothing to do" - and go home without ever asking the world
      // what it thinks the club's players are. So the squad the manager
      // browsed and trained stayed the one onboarding generated for him,
      // while the eleven the umpire actually fielded every round were the
      // world's, generated from a different seed in a different country. He
      // had a squad of Dutchmen and a scorecard full of Englishmen.
      //
      // The seat is claimed once; the squad is reconciled every time the game
      // loads. adoptWorldSquad is idempotent - it signs its work and returns
      // early when the men have not moved - so this costs one small request
      // and settles the question for good.
      rpc("world_my_status").then(function (st) {
        if (!st || st.signedIn === false) return;
        if (st.claim) {
          window.__foWorldClaim = st.claim;
          try { localStorage.setItem("fo_world_claim", JSON.stringify(st.claim)); } catch (eS) {}
          window.__foWorldPlan = st.training || {};
        try { window.__foNetsReport = st.netsReport || null; } catch (eNR) {}
      foWorldFinCache(st);
          adoptWorldSquad(st);
          return;
        }
        // the server holds no seat for this account: a cached claim is a
        // ghost of a reset world and must not stop a fresh one being taken
        try { localStorage.removeItem("fo_world_claim"); window.__foWorldClaim = null; } catch (eG) {}
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
          // Every seat in the manager's own country is taken. There is no
          // picker page to send them to any more, so say it once and leave
          // them where they are - the next load tries again, and a released
          // club is claimed the moment one frees up.
          if (/full/i.test(String(e.message || ""))) {
            try { alert(String(e.message).slice(0, 200)); } catch (eA) {}
          }
        });
      }).catch(function () {});
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(autoClaim, 3000); });
  else setTimeout(autoClaim, 3000);

})();
