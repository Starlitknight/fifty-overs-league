/* ============================================================================
   SERVED TRUTH — the league facts come from the world, or they do not come.

   THE BUG THIS EXISTS TO KILL. This game grew out of a single-player engine
   that kept everything in one localStorage blob: the fixtures, the results,
   the table, the lot. The World Service replaced all of that - the umpire
   plays every round on a server and publishes a snapshot - but the club home
   went on reading the OLD blob. leagueRows() built a table from App.results;
   foFormMap() built the form strip from App.results; foUserFixtures() read
   App.season.schedule. So the front page could tell a manager he was third
   after six matches in round three of eighteen, while the world he actually
   plays in had just been restarted and had not bowled a ball. Nothing was
   broken on the server; the page simply was not looking at it.

   That class of bug cannot be fixed one page at a time, because the next
   surface to be written will reach for the same familiar globals. So this is
   a rule with a switch behind it:

     WHEN THIS DEVICE HOLDS A CLAIM IN THE SERVED WORLD, EVERY LEAGUE FACT
     COMES FROM THE SERVED SNAPSHOT. The local save is not consulted, not
     preferred, not merged with, not fallen back to.

   window.leagueRows is REPLACED here rather than read, so every caller in the
   codebase - written or yet to be written - gets served rows without knowing
   this file exists. That is the point: correctness that does not depend on
   the next author remembering.

   WHAT LOCAL STORAGE IS STILL ALLOWED TO HOLD. Three things, none of them
   game state:
     - who you are: the session token and the cached claim, both re-fetched;
     - what you were looking at: view toggles, sort orders, dismissed nudges;
     - a copy of something the server already said, used only to paint before
       the fetch lands, and overwritten by it.
   Anything the umpire decides - a result, a table, a fixture, a squad - is
   read from the world every time. If the world cannot be reached, the honest
   answer is "not yet", which every accessor here returns as null or empty.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foServedTruth) return; window.__foServedTruth = 1;

  function claim() {
    try {
      if (window.__foWorldClaim) return window.__foWorldClaim;
      var c = JSON.parse(localStorage.getItem("fo_world_claim") || "null");
      return (c && c.country != null && c.slot != null) ? c : null;
    } catch (e) { return null; }
  }
  function nation() { var c = claim(); return c ? c.country : null; }
  function planet() { try { return window.__foPlanet || null; } catch (e) { return null; } }

  // the nation's league snapshot, and a nudge to refresh it. get() answers from
  // whatever the feed last received; want() asks the world for a newer one.
  function snap() {
    var n = nation(); if (!n) return null;
    try {
      var L = window.__foWorldLg; if (!L) return null;
      try { L.want(n, function () {}); } catch (eW) {}
      return L.get(n) || null;
    } catch (e) { return null; }
  }
  // ON means: this device plays in the served world AND the world has spoken.
  // Both halves matter - a claim with no snapshot yet is "not yet", not "use
  // the old blob instead".
  function on() { return !!(nation() && snap()); }

  function mySlot() { var c = claim(); return c ? (c.slot | 0) : -1; }
  function myRow() {
    var b = snap(); if (!b) return null;
    var sl = mySlot();
    var rows = b.table || [];
    for (var i = 0; i < rows.length; i++) if ((rows[i].slot | 0) === sl) return rows[i];
    return null;
  }
  function myName() { var r = myRow(); return r ? r.name : null; }

  // THE TABLE, in the shape every caller in this codebase already expects from
  // leagueRows(): nm, p, w, l, t, pts, nrr - sorted as the world sorted it.
  function rows() {
    var b = snap(); if (!b) return [];
    return (b.table || []).map(function (r) {
      return { nm: r.name, p: r.p | 0, w: r.w | 0, l: r.l | 0, t: r.t | 0,
        pts: r.pts | 0, nrr: +r.nrr || 0, slot: r.slot | 0, boss: !!r.boss };
    });
  }

  // FORM, oldest first, from the banked results and nothing else. A club that
  // has played nothing has an empty strip - which is the correct answer for a
  // season that has just restarted, and the one the old code could not give.
  function formOf(name) {
    var b = snap(); if (!b || !name) return [];
    return (b.results || [])
      .filter(function (r) { return r && (r.home === name || r.away === name); })
      .sort(function (a, c) { return (a.round | 0) - (c.round | 0); })
      .map(function (r) { return !r.winner ? "T" : (r.winner === name ? "W" : "L"); });
  }
  function form() { return formOf(myName()); }

  // THE DAY THE SUMMER OPENED, as the umpire recorded it - not as the date
  // implies. A world that is redealt and restarted opens its season 1 on the
  // day it was restarted, and every page that counts rounds from the calendar
  // rather than from this is a fortnight out.
  function startDay() { var b = snap(); return (b && b.startDay != null) ? (b.startDay | 0) : null; }
  // days until the first ball; 0 once the season is under way
  function opensIn() {
    var sd = startDay(); if (sd == null) return 0;
    try { return Math.max(0, sd - window.__foPlanet.dayIx(Date.now())); } catch (e) { return 0; }
  }
  // ---- THE NATIONAL SIDE ----------------------------------------------------
  // The umpire's selectors name a fifteen for every nation before every round
  // and the naming rides in the league snapshot. So "does this man play for his
  // country?" is a question every surface in the game can answer for free, off
  // the document it already holds - no second request, and never a guess.
  //
  // Membership is keyed by CLUB SLOT AND NAME together. Two cricketers in one
  // league can share a name; only one of them is in the squad, and starring the
  // wrong man is worse than starring nobody. A caller who knows only the name
  // still gets an answer (isNat), it is simply the looser one.
  function natOf(rid) {
    var b = rid == null ? snap() : lgOf(rid);
    return (b && b.nat) ? b.nat : null;
  }
  function lgOf(rid) {
    try { var L = window.__foWorldLg; if (!L) return null; L.want(rid, function () {}); return L.get(rid) || null; }
    catch (e) { return null; }
  }
  var CAP_AT = null, CAP_KEY = null, CAP_NM = null;
  function capSets(rid) {
    var n = natOf(rid), key = (rid || nation()) + '|' + (n ? n.round : 'x') + '|' + (n ? n.squad.length : 0);
    if (CAP_AT === key) return { slots: CAP_KEY, names: CAP_NM };
    CAP_KEY = {}; CAP_NM = {}; CAP_AT = key;
    ((n && n.squad) || []).forEach(function (m) {
      if (!m || !m.name) return;
      CAP_KEY[(m.slot | 0) + '|' + m.name] = 1; CAP_NM[m.name] = 1;
    });
    return { slots: CAP_KEY, names: CAP_NM };
  }
  // name alone: right whenever a league holds one man of that name, which is
  // the ordinary case and every case the generator produces
  function isNat(name, rid) { return !!(name && capSets(rid).names[name]); }
  // name AND club: exact, for a surface that knows which club it is drawing
  function isNatAt(slot, name, rid) { return !!(name && capSets(rid).slots[(slot | 0) + '|' + name]); }
  function natSquad(rid) { var n = natOf(rid); return (n && n.squad) || []; }
  function natRound(rid) { var n = natOf(rid); return n ? n.round : null; }

  function roundsPlayed() { var b = snap(); return b ? (b.roundsPlayed | 0) : 0; }
  function totalRounds() { var b = snap(); return (b && b.rounds) ? (b.rounds | 0) : 18; }
  function seasonNo() { var b = snap(); return b ? (b.seasonNo | 0) || 1 : 1; }
  // the round about to be played, 1-based, capped at the last one
  function round() { return Math.min(roundsPlayed() + 1, totalRounds()); }

  // WHEN A ROUND IS PLAYED — the one answer every surface that dates a fixture
  // must ask for. Round index is 0-based, as the club home counts. The old
  // answer was "today, plus however many rounds away it is" off the LOCAL
  // season's round counter: wrong twice over, because a served round bears no
  // relation to the local one, and because every fourth world day is a rest day
  // so rounds are not one per day. Returns the moment of the first ball, at the
  // nation's own hour, or null if the world has not spoken.
  function ballAt(round0) {
    var b = snap(), P = planet(), n = nation();
    if (!b || !P || !P.dayOfSeasonRound || n == null) return null;
    try {
      var d = P.dayOfSeasonRound(seasonNo(), (round0 | 0) + 1);
      if (d == null) return null;
      return P.EPOCH + d * P.DAY + P.natHour(n) * 3600000;
    } catch (e) { return null; }
  }

  // THE NEXT FIXTURE, from the world's own draw. schedOf() is the same circle
  // method the umpire schedules with, so the opponent named here is the
  // opponent the umpire will actually send out.
  function fixtures(limit) {
    var out = [], b = snap(), P = planet(), n = nation(), sl = mySlot();
    if (!b || !P || !P.schedOf || !P.sidesOf || n == null || sl < 0) return out;
    try {
      var sched = P.schedOf(n, seasonNo()) || [];
      var sides = P.sidesOf(n) || [];
      var byName = {}; (b.table || []).forEach(function (r) { byName[r.slot | 0] = r.name; });
      var nameOf = function (s) { return byName[s] || (sides[s] && sides[s].name) || ("Slot " + s); };
      for (var r0 = roundsPlayed(); r0 < sched.length && out.length < (limit || 6); r0++) {
        var rd = sched[r0] || [];
        for (var i = 0; i < rd.length; i++) {
          var f = rd[i];
          if (f[0] !== sl && f[1] !== sl) continue;
          var isHome = f[0] === sl, oppSlot = isHome ? f[1] : f[0];
          out.push({
            round: r0,                       // 0-based, as the club home counts
            roundNo: r0 + 1,                 // 1-based, as a human counts
            isHome: isHome, oppSlot: oppSlot,
            opp: { name: nameOf(oppSlot), slot: oppSlot },
            home: { name: nameOf(f[0]), slot: f[0] },
            away: { name: nameOf(f[1]), slot: f[1] }
          });
        }
      }
    } catch (e) {}
    return out;
  }

  window.__foServed = {
    on: on, claim: claim, nation: nation, slot: mySlot, snapshot: snap,
    rows: rows, me: myRow, name: myName, form: form, formOf: formOf,
    round: round, roundsPlayed: roundsPlayed, totalRounds: totalRounds,
    seasonNo: seasonNo, startDay: startDay, opensIn: opensIn,
    ballAt: ballAt, fixtures: fixtures,
    nat: natOf, natSquad: natSquad, natRound: natRound, isNat: isNat, isNatAt: isNatAt
  };

  // ---- THE RED STAR ---------------------------------------------------------
  // One mark, one meaning, everywhere a cricketer's name appears: this man is
  // in his country's fifteen as it stands today. It is drawn from the served
  // squad and from nothing else, so it appears the morning the selectors first
  // meet and goes the morning a man is left out - no local flag to fall stale.
  //
  // A global rather than a per-module helper because the surfaces that draw a
  // player are scattered across a dozen files and the next one will be too.
  // Callers who know the club pass its slot and get the exact answer.
  function starCss() {
    if (document.getElementById("fo-nat-star-css")) return;
    var s = document.createElement("style");
    s.id = "fo-nat-star-css";
    s.textContent =
      ".fo-nat{display:inline-block;color:#C8102E;font-size:.82em;line-height:1;" +
      "margin-left:.34em;vertical-align:.06em;text-shadow:0 1px 0 rgba(0,0,0,.18);" +
      "font-style:normal;font-weight:400;cursor:help}" +
      ".fo-nat-lg{font-size:.9em;margin-left:.42em}";
    (document.head || document.documentElement).appendChild(s);
  }
  function star(name, slot, opts) {
    try {
      if (!name) return "";
      // A NAMED NATION NEEDS NO CLAIM. Drawing my own club asks whether this
      // device plays in the served world at all; drawing somebody else's - a
      // teamsheet on the world stage - only needs that nation to have spoken,
      // so a spectator who has joined nothing still sees who the internationals
      // are.
      var rid = opts && opts.rid;
      if (rid ? !natOf(rid) : !on()) return "";
      var yes = (slot == null) ? isNat(name, rid) : isNatAt(slot, name, rid);
      if (!yes) return "";
      starCss();
      var nm = (opts && opts.nation) || "";
      return "<i class='fo-nat" + (opts && opts.big ? " fo-nat-lg" : "") + "'" +
        " title='" + (nm ? nm + " " : "") + "international &middot; named in the current squad'" +
        " aria-label='international'>&#9733;</i>";
    } catch (e) { return ""; }
  }
  window.foNatStar = star;
  window.__foServed.star = star;

  // ---- ANY CRICKETER IN THE WORLD, BY NAME ----------------------------------
  // findPlayer searches the clubs THIS DEVICE holds - the ten of its own
  // league. That is the right scope for training, orders and the market, which
  // may only touch a man you employ. It is the wrong scope for READING: a
  // manager looking at Pakistan's fifteen wants to know who those men are, and
  // being told "player not found" because they play in another country is not
  // an answer.
  //
  // Every world club's squad is derivable on this device from the seed the
  // umpire generated it with - that is how a replay fields the same eleven the
  // server did - so a foreign cricketer can be looked up rather than fetched.
  // The caller must say WHICH club (nation + slot); a bare name is not enough
  // to find a man in nineteen leagues, and guessing would show the wrong one.
  //
  // Deliberately a separate function, not a widening of findPlayer: nothing
  // that SPENDS money or SETS training should be able to reach a man who plays
  // for somebody else, and a global fallback would quietly hand him over.
  function clubNameAt(rid, slot) {
    try {
      var nm = null, ov = window.__foWorldNames && window.__foWorldNames.get(rid);
      if (ov && ov[slot]) return ov[slot];
      (planet().sidesOf(rid) || []).forEach(function (s) { if (s.slot === (slot | 0)) nm = s.name; });
      return nm;
    } catch (e) { return null; }
  }
  function findAny(name, rid, slot) {
    if (!name) return null;
    try {
      // findPlayer is a top-level `const` in the engine, which makes it a
      // global LEXICAL binding: reachable by name from any script, and not a
      // property of window. Testing window.findPlayer finds nothing and
      // silently skips the local lookup - which is how every cricketer,
      // including the ones this device employs, briefly stopped opening.
      var local = (typeof findPlayer === "function") ? findPlayer(name) : null;
      if (local && local.p) return local;
    } catch (e) {}
    if (!rid || slot == null || slot < 0) return null;
    try {
      var sq = (window.__foWT && window.__foWT.serverSquad) ? window.__foWT.serverSquad(rid, slot | 0) : null;
      if (!sq) return null;
      for (var i = 0; i < sq.length; i++) {
        if (sq[i] && sq[i].name === name) {
          return { p: sq[i], team: { name: clubNameAt(rid, slot) || ("Club " + slot) },
                   world: { rid: rid, slot: slot | 0 } };
        }
      }
    } catch (e2) {}
    return null;
  }
  window.foFindAnyPlayer = findAny;
  window.__foServed.findAny = findAny;

  // ---- THE SQUAD IS THE WORLD'S, SIGNED IN OR NOT ---------------------------
  // The served squad reached this device down one road only: world_my_status,
  // which is an authenticated call. So a browser holding a claim but no live
  // session never adopted anything, and went on showing the ELEVEN IT MADE UP
  // AT FOUNDING - men who exist in no club on earth - for as long as it was
  // left alone. That is the same bug as the league table reading the old blob,
  // wearing different clothes.
  //
  // world_squads is public, exactly like the standings: any device may read any
  // club's men. So the squad is fetched the way the table is, needs no login,
  // and is adopted through the existing path - which keeps the club-ready wait,
  // the stale-lineup guard and the repaint that all belong to it.
  var SQ_AT = 0, SQ_BUSY = 0;
  function pullSquad(force) {
    var c = claim(); if (!c || !c.country || c.slot == null) return;
    if (SQ_BUSY) return;
    if (!force && SQ_AT && Date.now() - SQ_AT < 120000) return;
    SQ_BUSY = 1; SQ_AT = Date.now();
    var url = "https://egaipdksvztqqgouriyc.supabase.co/rest/v1/world_squads" +
      "?country_id=eq." + encodeURIComponent(c.country) + "&slot=eq." + (c.slot | 0) +
      "&select=name,players";
    // a throw here must not wedge the flag on: a device that failed once has to
    // be free to ask again on the next focus, or one bad minute costs it the
    // squad for the rest of the session
    try {
      fetch(url, { headers: { apikey: "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc" } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (rows) {
          SQ_BUSY = 0;
          var row = rows && rows[0];
          if (!row || !Array.isArray(row.players) || row.players.length < 11) return;
          // hand it to the adopter in the shape it already understands, so the
          // careful parts - waiting for the club, tearing up a lineup that names
          // men who have gone, saving, repainting - are not written twice
          try {
            if (window.__foAdoptWorldSquad) {
              window.__foAdoptWorldSquad({
                claim: { country: c.country, slot: c.slot | 0, club: row.name || c.club },
                squad: row.players
              });
            }
          } catch (eA) {}
        }, function () { SQ_BUSY = 0; })
        .catch(function () { SQ_BUSY = 0; });
    } catch (eF) { SQ_BUSY = 0; }
  }
  window.__foPullServedSquad = pullSquad;
  try {
    pullSquad(true);
    // and again when the page is come back to, in case a round has been played
    window.addEventListener("focus", function () { try { pullSquad(false); } catch (e) {} });
  } catch (eP) {}

  // ---- THE SWITCH -----------------------------------------------------------
  // leagueRows() is the table every surface in the game asks for. Replacing it
  // once here means no page can accidentally show the local blob's table again,
  // including pages nobody has written yet. The local implementation is kept
  // for the solo and practice worlds, which have no served counterpart.
  try {
    if (typeof window.leagueRows === "function" && !window.leagueRows.__foServed) {
      var local = window.leagueRows;
      window.leagueRows = function (comp) {
        if ((comp || "league") === "league" && on()) return rows();
        return local.apply(this, arguments);
      };
      window.leagueRows.__foServed = 1;
    }
  } catch (e) {}
})();
