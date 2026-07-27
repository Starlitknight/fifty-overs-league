/* ============================================================================
   JOIN THE WORLD (#/worldclub) + NATIONAL TEAMS (#/natteams) — P3/P5 client.

   The served world became joinable: any signed-in manager can claim a bot
   club in any of the 19 nations (never the boss) and submit orders; the
   umpire plays them at that nation's hour on the real engine. This module
   is the client of that write surface - every call goes through the
   server's SECURITY DEFINER RPCs, which re-validate everything ("no
   client trust"): this page could lie all it wants and the server would
   shrug.

   #/natteams reads the season's national squads - the 15 best REAL
   players of each nation's league, assembled server-side for the World
   Cup - and marks any that play for YOUR world club.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foWJ) return; window.__foWJ = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function jwt() { try { return (window.__foJWT && window.__foJWT()) || ""; } catch (e) { return ""; } }
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
      var mgr = "manager"; try { mgr = (SYNC && SYNC.me && SYNC.me.display_name) || ((clubNm || "The") + " manager"); } catch (eM) {}
      rpc("world_my_status").then(function (st) {
        if (!st || st.signedIn === false) return;
        if (st.claim) {
          window.__foWorldClaim = st.claim;
          try { localStorage.setItem("fo_world_claim", JSON.stringify(st.claim)); } catch (eS) {}
          return;
        }
        rpc("world_auto_claim", { p_country: nat, p_name: mgr, p_club_name: clubNm || null }).then(function (r) {
          if (!r || !r.ok) return;
          var cl = { country: r.country, slot: r.slot, club: r.club, name: mgr };
          window.__foWorldClaim = cl;
          try { localStorage.setItem("fo_world_claim", JSON.stringify(cl)); localStorage.removeItem("fo_world_nm_" + r.country); } catch (eS2) {}
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
      "<div class='fo-wj-foot'><a href='#/planet'>&lsaquo; World cricket</a><a href='#/natteams'>National teams &rsaquo;</a></div>" +
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
        var state = c.is_boss ? "<u class='boss'>THE BOSS</u>"
          : c.manager ? "<u class='taken'>" + E(c.manager) + "</u>"
          : "<button type='button' class='fo-wj-claim' data-slot='" + c.slot + "' data-club='" + E(c.name) + "'>Claim</button>";
        return "<div class='fo-wj-club'><b>" + E(c.name) + "</b><span>" + E(c.ground || "") + "</span>" + state + "</div>";
      }).join("");
      box.querySelectorAll(".fo-wj-claim").forEach(function (b) {
        b.addEventListener("click", function () {
          if (b.disabled) return; b.disabled = true; b.textContent = "Claiming…";
          var mgr = "manager";
          try { mgr = (SYNC && SYNC.me && SYNC.me.display_name) || (userTeam().name + " manager"); } catch (e) {}
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
      if (!ST.picked.length) ST.picked = squad.slice(0, 11).map(function (p) { return p.name; });
      // keep the five/captain/keeper coherent with the XI
      ST.five = ST.five.filter(function (nm) { return ST.picked.indexOf(nm) >= 0 && isBowler(nm); });
      if (ST.five.length < 5) ST.picked.forEach(function (nm) { if (ST.five.length < 5 && isBowler(nm) && ST.five.indexOf(nm) < 0) ST.five.push(nm); });
      if (!ST.keep || ST.picked.indexOf(ST.keep) < 0) ST.keep = (ST.picked.filter(function (nm) { return byName[nm] && byName[nm].keeper; })[0]) || ST.picked[0];
      if (!ST.capt || ST.picked.indexOf(ST.capt) < 0) ST.capt = ST.picked[0];

      var men = squad.map(function (p) {
        var ix2 = ST.picked.indexOf(p.name);
        return "<button type='button' class='fo-wj-man" + (ix2 >= 0 ? " on" : "") + "' data-nm='" + E(p.name) + "'>" +
          "<i>" + (ix2 >= 0 ? (ix2 + 1) : "&middot;") + "</i><b>" + E(p.name) + "</b>" +
          "<span>" + (p.bowlType && p.bowlType !== "none" ? "bowls" : p.keeper ? "keeper" : "bats") + " &middot; " + (p.rating || "") + "</span></button>";
      }).join("");
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
        "<h4 class='fo-wj-h4'>The eleven, in batting order</h4>" +
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

  // ---- #/natteams -----------------------------------------------------------
  window.foRenderNatTeamsPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    foWjCss();
    page.innerHTML = "<div class='fo-wj'><div class='fo-wj-in'>" +
      "<div class='fo-wj-hero'><div class='fo-wj-k'>The international game</div>" +
      "<h1>The National Squads</h1>" +
      "<p>Each nation's fifteen best real players, selected from its league's clubs for the World Cup window. Wear your league form well and the selectors notice.</p></div>" +
      "<div id='fo-wj-nats'><div class='fo-wj-note'>Asking the selectors&hellip;</div></div>" +
      "<div class='fo-wj-foot'><a href='#/planet'>&lsaquo; World cricket</a><a href='#/worldclub'>Your world club &rsaquo;</a></div>" +
      "</div></div>";
    snapshot("world/today").then(function (today) {
      var sN = (today && today.countries && today.countries[0] && today.countries[0].seasonNo) || 1;
      return snapshot("nats/s" + sN).then(function (nats) { return { nats: nats, sN: sN }; });
    }).then(function (d) {
      var box = document.getElementById("fo-wj-nats"); if (!box) return;
      if (!d || !d.nats) {
        box.innerHTML = "<div class='fo-wj-card'><p class='fo-wj-p'>The selectors meet when the season's leagues are done - squads are announced at the cup window, then the World Cup plays on the real engine. Check back after day 18 of the season.</p></div>";
        return;
      }
      var ids = Object.keys(d.nats).sort();
      box.innerHTML = ids.map(function (rid) {
        var n = d.nats[rid];
        return "<div class='fo-wj-card'><h3><img class='fo-wj-fl' src='" + flagOf(rid) + "' alt=''> " + E(n.nation) + " <span>season " + d.sN + "</span></h3>" +
          "<div class='fo-wj-natsq'>" + (n.squad || []).map(function (nm) { return "<span>" + E(nm) + "</span>"; }).join("") + "</div></div>";
      }).join("");
    }).catch(function () {});
  };

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
      "html body #page .fo-wj-man{display:flex;align-items:center;gap:8px;text-align:left;background:rgba(255,255,255,.85) !important;border:1px solid rgba(20,28,40,.14) !important;border-radius:10px !important;padding:8px 10px !important;cursor:pointer;font:inherit !important}",
      "html body #page .fo-wj-man.on{border-color:#C95532 !important;background:rgba(250,238,230,.9) !important}",
      "html body #page .fo-wj-man i{font-style:normal;font:700 11px/1 Oswald,sans-serif;color:#C95532;width:16px;text-align:center}",
      "html body #page .fo-wj-man b{display:block;font:600 12px/1.2 Inter,sans-serif;color:#141C28;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "html body #page .fo-wj-man span{font-size:9.5px;color:rgba(20,28,40,.5);white-space:nowrap}",
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
