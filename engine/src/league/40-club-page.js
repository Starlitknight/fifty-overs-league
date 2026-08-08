/* ============================================================================
   THE CLUB DOSSIER (#/team?c={country}&s={slot}) — every club's public face.

   A league of blanks has no strategy in it: you cannot fear a side you know
   nothing about, or plan a season against one. So this page tells you what a
   county's own handbook would - the side's batting, its attack and its hands,
   then every man: how old, which hand, what he bowls, what he costs, what he
   is worth, what his career says and what the game has made of him.

   The page is built like a club programme: a full-bleed navy plate with the
   country behind it and its cricketer standing at the edge, a ticket of
   numbers across the fold, then the First XI card and the roster beneath.

   What stays private is the coaching book: the fifteen raw skills, the
   training plan, the progress toward the next jump. A scout may read a man's
   class from the boundary; he may not read the fifteen numbers underneath.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foClubPg) return; window.__foClubPg = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function cx() { return window.__foCxAPI || null; }
  function ART() { return (typeof FO_ART !== "undefined") ? FO_ART : "client/art/"; }
  function flagOf(rid) { try { return ART() + "flags/" + cx().flagFile(rid) + ".svg"; } catch (e) { return ""; } }
  function region(rid) { try { return (cx().regions() || []).filter(function (x) { return x.id === rid; })[0] || null; } catch (e) { return null; } }
  function natName(rid) { var r = region(rid); return (r && r.nm) || rid; }
  function qs() {
    var q = {}, m = (location.hash || "").split("?")[1] || "";
    m.split("&").forEach(function (kv) { var p = kv.split("="); if (p[0]) q[p[0]] = decodeURIComponent(p[1] || ""); });
    return q;
  }
  function claim() {
    try { return window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (e) { return null; }
  }
  function money(n) {
    n = Math.round(+n || 0);
    if (Math.abs(n) >= 1000000) return "$" + (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + "M";
    if (Math.abs(n) >= 1000) return "$" + Math.round(n / 1000) + "K";
    return "$" + n;
  }
  function num(n) { return String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function ordn(n) { return n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4)] || "th"); }

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

  // ---- THE CHALLENGE ---------------------------------------------------------
  // A friendly is arranged where you meet the club, not in a form on a
  // settings page: you read their side, you fancy it, you name an hour. The
  // state lives here rather than in the markup because the dossier repaints
  // four times as the club, the squad and the honours land - a half-typed
  // kick-off must survive all four.
  var CH = { key: "", when: "", msg: "", list: null, busy: false };
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function dtLocal(ms) {
    var d = new Date(ms);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) +
      "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  var DW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function whenTxt(ms) {
    try {
      var d = new Date(ms);
      return DW[d.getDay()] + " " + d.getDate() + " " + MO[d.getMonth()] + " &middot; " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    } catch (e) { return ""; }
  }

  // every friendly this manager has against THIS club - the post is filtered
  // by the pair's coordinates rather than by name, so two clubs sharing a name
  // in different nations can never show each other's fixtures
  function loadTies(key, cid, slot) {
    rpc("world_my_friendlies", { p_country: cid, p_slot: slot })
      .then(function (rows) {
        if (CH.key !== key) return;
        CH.list = Array.isArray(rows) ? rows : [];
        paintTies();
      })
      .catch(function () { if (CH.key === key) { CH.list = []; paintTies(); } });
  }
  function tieRows() {
    if (!CH.list || !CH.list.length) return "";
    return CH.list.map(function (f) {
      var when = f.playAtMs ? whenTxt(f.playAtMs) : "";
      var live = f.playAtMs && Date.now() >= f.playAtMs;
      var cls = "fo-cp-fr", state, act = "";
      if (f.incoming) {
        cls += " in"; state = "they have challenged you";
        act = "<button type='button' class='fo-cp-fyes' data-id='" + f.id + "'>Accept</button>" +
              "<button type='button' class='fo-cp-fno' data-id='" + f.id + "'>Decline</button>";
      } else if (f.status === "offered") {
        state = "awaiting their reply";
      } else if (f.status === "accepted") {
        cls += " on"; state = live ? "in play" : "arranged";
        act = "<button type='button' class='fo-cp-fwatch' data-id='" + f.id + "'>" + (live ? "Watch" : "Match centre") + "</button>";
      } else if (f.status === "played" && !f.text) {
        // banked by the umpire, but the broadcast is still showing (048
        // withholds the result line until the last ball) - it reads as live
        cls += " on"; state = "in play";
        act = "<button type='button' class='fo-cp-fwatch' data-id='" + f.id + "'>Watch</button>";
      } else if (f.status === "played") {
        cls += " done"; state = f.text || "played";
        act = "<button type='button' class='fo-cp-fwatch' data-id='" + f.id + "'>Watch it back</button>";
      } else {
        cls += " dim"; state = f.status;
      }
      return "<div class='" + cls + "'><b>" + (f.mine ? "You challenged them" : "They challenged you") + "</b>" +
        "<i>" + when + (state ? " &middot; " + E(state) : "") + "</i>" +
        (act ? "<span>" + act + "</span>" : "") + "</div>";
    }).join("");
  }
  function paintTies() {
    var host = document.getElementById("fo-cp-chlist"); if (!host) return;
    host.innerHTML = tieRows();
    host.querySelectorAll(".fo-cp-fwatch").forEach(function (b) {
      // the feed page is the one reader for all cricket now - the umpire
      // played this match; nobody's browser re-simulates it
      b.addEventListener("click", function () {
        location.hash = "#/feed?fr=" + (+b.getAttribute("data-id"));
        if (typeof window.route === "function") try { window.route(); } catch (e) {}
      });
    });
    var answer = function (b, accept) {
      b.disabled = true;
      rpc("world_friendly_respond", { p_id: +b.getAttribute("data-id"), p_accept: accept })
        .then(function () { loadTies(CH.key, CH.key.split(":")[0], +CH.key.split(":")[1]); })
        .catch(function (e) { b.disabled = false; chSay(String(e.message).slice(0, 120)); });
    };
    host.querySelectorAll(".fo-cp-fyes").forEach(function (b) { b.addEventListener("click", function () { answer(b, true); }); });
    host.querySelectorAll(".fo-cp-fno").forEach(function (b) { b.addEventListener("click", function () { answer(b, false); }); });
  }
  function chSay(t) {
    CH.msg = t;
    var el = document.getElementById("fo-cp-chmsg"); if (el) el.innerHTML = E(t);
  }

  // ---- THE EVENTS FEED -----------------------------------------------------
  // A dossier shows three states of the world - a squad, a record, a trophy
  // shelf - and not one moment of how the club got there. This is the club's
  // own diary: matches, men bought and sold, challenges, call-ups, and (for
  // the manager who holds it) the teamsheets he filed and the scouts he paid.
  // Nothing is logged to make it: every source already carries the moment it
  // happened, so the feed is computed off the record and can never drift.
  var EV = {};                                   // "cid:slot" -> {loading, rows, mine}
  function eventsOf(key, cid, slot, onLand) {
    if (EV[key]) return EV[key];
    EV[key] = { loading: true, rows: null, mine: false };
    rpc("world_club_events", { p_country: cid, p_slot: slot, p_limit: 80 })
      .then(function (r) {
        EV[key] = { loading: false, rows: (r && r.events) || [], mine: !!(r && r.mine) };
        try { if (onLand) onLand(); } catch (e) {}
      })
      .catch(function () { EV[key] = { loading: false, rows: [], mine: false }; try { if (onLand) onLand(); } catch (e2) {} });
    return EV[key];
  }
  function evWhen(ms) {
    var d = new Date(Number(ms) || 0), p2 = function (n) { return (n < 10 ? "0" : "") + n; };
    return { day: DW[d.getDay()] + " " + d.getDate() + " " + MO[d.getMonth()] + " " + d.getFullYear(),
      time: p2(d.getHours()) + ":" + p2(d.getMinutes()),
      key: d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) };
  }
  // a club named in an event is a club you can walk to, and so is a player
  function evClub(cid, e) {
    var c2 = e.oppCountry || cid, s2 = e.oppSlot;
    var nm = e.oppName || "a club";
    if (s2 == null) return E(nm);
    return "<a href='#/team?c=" + encodeURIComponent(c2) + "&s=" + s2 + "'>" + E(nm) + "</a>";
  }
  function evPlayer(cid, slot, nm) {
    if (!nm) return "";
    return "<a href='#/player?c=" + encodeURIComponent(cid) + "&s=" + slot + "&n=" + encodeURIComponent(nm) + "'>" + E(nm) + "</a>";
  }
  function evLine(cid, slot, e) {
    // a diary states the figure it was, not a rounding of it
    var mny = function (v) {
      var n = Math.round(+v || 0), neg = n < 0; n = Math.abs(n);
      return (neg ? "-$" : "$") + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };
    switch (e.kind) {
      case "match":
        return (e.won ? "Beat " : "Played ") + evClub(cid, e) +
          (e.home ? " at home" : " away") + (e.note ? " &mdash; " + E(e.note) : "");
      case "buy":
        return "Bought " + evPlayer(cid, slot, e.player) + " from " + evClub(cid, e) +
          (e.amount ? " for " + mny(e.amount) : "");
      case "sell":
        return "Sold " + E(e.player || "a player") + " to " + evClub(cid, e) +
          (e.amount ? " for " + mny(e.amount) : "");
      case "friendly":
        return (e.home ? "Challenged " : "Were challenged by ") + evClub(cid, e) +
          " to a friendly" + (e.note === "declined" ? " &mdash; declined" : e.note === "offered" ? " &mdash; awaiting a reply" : "");
      case "friendly-played":
        return "Friendly with " + evClub(cid, e) + (e.note ? " &mdash; " + E(e.note) : "");
      case "callup":
        return evPlayer(cid, slot, e.player) + " was named in the national squad" +
          (e.round ? " for round " + e.round : "") + (e.amount ? ", worth " + mny(e.amount) : "");
      case "orders":
        return "Filed a teamsheet for round " + (e.round || "?");
      case "scouted":
        return "Paid " + mny(e.amount) + " for a scouting report";
      default:
        return E(e.kind);
    }
  }

  // ---- THE GROUND ----------------------------------------------------------
  // Home advantage in this game is not a number on a card: it is a strip a
  // groundsman prepares and a sky the season deals, and both are PURE
  // FUNCTIONS of the nation, the ground and the round. So a manager can read
  // exactly what he will be walking onto weeks out, from his own device, with
  // nobody online - which is the only kind of information this world is
  // allowed to give him.
  var PITCH_NM = { balanced: "Balanced", flat: "Flat", green: "Green", dry: "Crumbling",
    slow: "Slow", cracked: "Sticky", twoPaced: "Two-paced" };
  // the game's own field guide, in the words the conditions primer uses
  var PITCH_NOTE = {
    balanced: ["A fair contest. Nobody gets favours.", "Pick your best XI on merit."],
    green: ["Seam and swing; the new-ball spell is brutal.", "Stack pace, open the batting with technique."],
    dry: ["Turns square as it wears on.", "Spinners own the middle overs; chasing is hardest."],
    flat: ["A batter's road: boundaries flow, totals balloon.", "Wickets must be bought with attacking bowling."],
    slow: ["Low and grippy; the ball dies in the surface.", "Sixes are dear. Rotate strike and be patient."],
    cracked: ["Unpredictable bounce, wickets for everyone.", "Batting depth is your insurance."],
    twoPaced: ["Some balls hurry, some hold.", "Timing is never safe; big intent costs more here."]
  };
  var PITCH_ORDER = ["balanced", "green", "flat", "dry", "slow", "cracked", "twoPaced"];
  function pitchNm(k) { return PITCH_NM[k] || String(k || ""); }
  // every home round this ground will stage this season, with what it deals
  function groundSeason(cid, slot) {
    var out = [], pl = window.__foPlanet, wt = window.__foWT;
    if (!pl || !pl.condOf || !wt || !wt.schedMirror) return out;
    var cal = null; try { cal = wt.serverCal(Date.now()); } catch (e) { return out; }
    var season = Math.max(1, cal.seasonNo || 1);
    var rounds = wt.schedMirror(cid, season) || [];
    for (var r = 0; r < rounds.length; r++) {
      for (var i = 0; i < rounds[r].length; i++) {
        var f = rounds[r][i];
        if (f[0] !== slot) continue;                       // home matches only
        var c = null; try { c = pl.condOf(cid, slot, season, r + 1); } catch (e2) {}
        out.push({ round: r + 1, foeSlot: f[1], pitch: (c && c.pitch) || "balanced",
          weather: (c && c.weather) || "Sunny", past: (r + 1) < (cal.round || 1) });
      }
    }
    return out;
  }

  // ---- THE TRANSFER HISTORY ------------------------------------------------
  // The diary carries a transfer as one line among the day's business, which
  // answers "what happened on Tuesday". It does not answer "what has this club
  // spent, what has it recouped, and is it a buying club or a selling one" -
  // the question you ask before you deal with somebody. Every sale is already
  // a settled row in the register, so the totals are sums over it and the
  // ledger is the same rows in order.
  var TR = {};                                   // "cid:slot" -> {loading, d}
  function transfersOf(key, cid, slot, onLand) {
    if (TR[key]) return TR[key];
    TR[key] = { loading: true, d: null };
    rpc("world_club_transfers", { p_country: cid, p_slot: slot, p_limit: 200 })
      .then(function (r) { TR[key] = { loading: false, d: r || null }; try { if (onLand) onLand(); } catch (e) {} })
      .catch(function () { TR[key] = { loading: false, d: null }; try { if (onLand) onLand(); } catch (e2) {} });
    return TR[key];
  }
  function trMoney(v) {
    var n = Math.round(+v || 0), neg = n < 0; n = Math.abs(n);
    return (neg ? "-$" : "$") + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function trDate(ms) {
    var d = new Date(Number(ms) || 0);
    return d.getDate() + " " + MO[d.getMonth()] + " " + String(d.getFullYear()).slice(2);
  }

  var CLUB_CACHE = {}, SQ_CACHE = {}, HON_CACHE = null;
  function grab(url, cb) {
    fetch(SB_URL + url, { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) { cb(rows && rows[0] ? rows[0] : null); })
      .catch(function () { cb(null); });
  }
  function fetchClub(cid, slot, cb) {
    var k = cid + ":" + slot;
    if (CLUB_CACHE[k]) { cb(CLUB_CACHE[k]); return; }
    grab("/rest/v1/world_clubs?country_id=eq." + encodeURIComponent(cid) + "&slot=eq." + slot + "&select=name,ground,is_boss,manager,identity,academy,seats",
      function (row) { if (row) CLUB_CACHE[k] = row; cb(row); });
  }
  function fetchSquad(cid, slot, cb) {
    var k = cid + ":" + slot;
    if (SQ_CACHE[k]) { cb(SQ_CACHE[k]); return; }
    grab("/rest/v1/world_squads?country_id=eq." + encodeURIComponent(cid) + "&slot=eq." + slot +
      "&select=players,wage_bill,team_batting,team_bowling,team_fielding",
      function (row) { if (row) SQ_CACHE[k] = row; cb(row); });
  }
  // THE BLOCK MARK: a club's dossier says who is up on the transfer market.
  // One small ask of the open board per club per minute, then a gold chip
  // pinned on each listed man's name - the roster tells you before you bid.
  var SALE_CACHE = {};
  function saleMarks(cid, slot) {
    var k = cid + ":" + slot;
    var apply = function (names) {
      if (!names || !names.length) return;
      [].slice.call(document.querySelectorAll(".fo-cp-row .nm b, .fo-cp-starn b")).forEach(function (el) {
        if (el.querySelector(".fo-cp-sale")) return;
        var nm = (el.textContent || "").trim();
        for (var i = 0; i < names.length; i++) {
          if (nm === names[i] || nm.indexOf(names[i]) === 0) {
            el.insertAdjacentHTML("beforeend", "<span class='fo-cp-sale' title='Listed on the transfer market - the hammer is up'>For sale</span>");
            return;
          }
        }
      });
    };
    if (SALE_CACHE[k] && Date.now() - SALE_CACHE[k].at < 60000) { apply(SALE_CACHE[k].names); return; }
    fetch(SB_URL + "/rest/v1/world_listings?country_id=eq." + encodeURIComponent(cid) + "&slot=eq." + (slot | 0) + "&select=player",
      { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var names = (rows || []).map(function (x) { return x.player; });
        SALE_CACHE[k] = { names: names, at: Date.now() };
        apply(names);
      }).catch(function () {});
  }
  function fetchHonours(cb) {
    if (HON_CACHE) { cb(HON_CACHE); return; }
    grab("/rest/v1/world_snapshots?key=eq.honours&select=body",
      function (row) { HON_CACHE = (row && row.body) || { seasons: {} }; cb(HON_CACHE); });
  }

  // ROLE, in the language of a scorecard rather than a database
  var ROLE_WORD = { opener: "Opener", top: "Top order", topOrder: "Top order", middle: "Middle order",
    middleOrder: "Middle order", finisher: "Finisher", allRounder: "All-rounder", allrounder: "All-rounder",
    wicketkeeper: "Wicketkeeper", keeper: "Wicketkeeper", seamFast: "Fast bowler",
    seamFastMedium: "Seam medium", seamMedium: "Medium pace", seamer: "Seam bowler",
    fingerSpin: "Finger spin", wristSpin: "Wrist spin", spinner: "Spinner", bowler: "Bowler", tail: "Lower order" };
  var TALENT_WORD = { anchor: "Anchor", safeHands: "Safe hands", bigHitter: "Big hitter", deathBowler: "Death bowler",
    newBall: "New ball", partnership: "Partnership", closer: "Closer", enforcer: "Enforcer",
    gun: "Gun fielder", nightwatch: "Nightwatchman", spinKing: "Spin king", swingKing: "Swing king",
    powerplay: "Powerplay", clutch: "Clutch", ironman: "Iron man" };
  function roleWord(r) { return ROLE_WORD[r] || (r ? String(r).replace(/([A-Z])/g, " $1").replace(/^./, function (c) { return c.toUpperCase(); }) : "Cricketer"); }
  function talentWord(t) { return TALENT_WORD[t] || String(t || "").replace(/([A-Z])/g, " $1").replace(/^./, function (c) { return c.toUpperCase(); }); }
  var NAT_ID = { England: "eng", Australia: "aus", India: "sub", Pakistan: "pak", "South Africa": "rsa",
    "New Zealand": "nzl", "Sri Lanka": "slk", "West Indies": "win", Ireland: "ire", Netherlands: "ned",
    Zimbabwe: "zim", Afghanistan: "afg", Bangladesh: "bgd", Nepal: "nep", Scotland: "sco", Wales: "wal",
    Kenya: "ken", "United States": "usa", USA: "usa", Canada: "can" };
  function natFlag(n) { var id = NAT_ID[n]; return id ? flagOf(id) : ""; }
  // FORM as the game's own ladder, drawn as six lamps
  var FORMW = ["abysmal", "poor", "shaky", "steady", "good", "strong", "excellent"];
  function formDots(w) {
    var ix = FORMW.indexOf(String(w || "steady").toLowerCase());
    var lit = Math.max(1, Math.min(6, Math.round(((ix < 0 ? 3 : ix) + 1) * 6 / 7)));
    var out = "";
    for (var i = 0; i < 6; i++) out += "<i" + (i < lit ? " class='on'" : "") + "></i>";
    return out;
  }
  // the painted figure a man wears on his card, by the shipped resolver
  function faceOf(p) {
    try {
      if (window.foPkArt) return ART() + window.foPkArt({
        name: p.name, nat: p.nat, role: p.role, keeper: p.keeper,
        bowlTypeFull: p.type, bowlType: (p.type && p.type !== "none") ? p.type : null
      });
    } catch (e) {}
    return "";
  }
  // the game's own painted silhouettes, not emoji: a batter, a keeper, a
  // seamer at the crease, a spinner in his action
  function roleIcon(p) {
    var f = "bat.png";
    if (p.keeper) f = "keeper.png";
    else if (/wrist/i.test(p.type || "")) f = "spin-wrist.png";
    else if (/spin/i.test(p.type || "")) f = "spin-finger.png";
    else if (p.role === "allRounder") f = "ar.png";
    else if (/seam|pace|fast|medium/i.test(p.type || "")) f = "pace1.png";
    return ART() + f;
  }
  function roleGlyph(p) {
    return "<img class='fo-cp-ico' src='" + roleIcon(p) + "' alt='' onerror=\"this.style.display='none'\">";
  }

  var SORTS = [["ovr", "Strongest first"], ["age", "Youngest first"], ["wage", "Best paid"], ["name", "By name"]];

  // ---- A GROUND FOR EVERY CLUB ----------------------------------------------
  // Only a quarter of the world's grounds are painted. Every club whose own
  // city has no painting - the user's own included - stands in front of Old
  // Trafford: one understudy ground for the whole world, so an unpainted club
  // page never reads as a different club's home by accident. The navy panel
  // stays as the last resort only.
  function fbGroundOf() {
    return ART() + "cities/manchester-ground.webp";
  }
  // A club whose own city IS painted - Mumbai's Wankhede, the MCG, Eden
  // Gardens - hangs its own ground first; Old Trafford stands in only where
  // the gallery is silent. The settled painting is remembered per club so a
  // dossier repaint starts from the answer, never from the fallback walk
  // (whose 404 round-trip is a visible blink).
  var GR_OK = {};
  try { window.__foGrOk = GR_OK; } catch (eGk) {}
  function groundArtOf(cid, slot) {
    var k = cid + ":" + slot;
    if (GR_OK[k]) return GR_OK[k];
    try {
      var sides = (window.__foPlanet && window.__foPlanet.sidesOf(cid)) || [];
      for (var i = 0; i < sides.length; i++) {
        if ((sides[i].slot | 0) === (slot | 0)) {
          var own = window.foGroundArtUrl ? window.foGroundArtUrl(sides[i].city) : null;
          if (own) return own;
          break;
        }
      }
    } catch (e) {}
    return fbGroundOf();
  }

  // ---- your own men, in the shape the public view uses ----------------------
  // The world's squad is already the game's squad (league/37 adopts it), so for
  // your own club the local side IS the served side - read it here and the two
  // pages cannot drift, even before the world has been reached this session.
  function ownSquad() {
    try {
      var t = userTeam(); if (!t || !(t.players || []).length) return null;
      var ag = function (fn, p) { try { return Math.round(fn(p) || 0); } catch (e) { return 0; } };
      var list = t.players.map(function (p) {
        var bowls = !!(p.bowlType && !/does not bowl/i.test(p.btLabel || ""));
        return { name: p.name, nat: p.nat, age: p.age, role: p.role, hand: p.hand,
          bowl: p.btLabel, type: p.bowlTypeFull, keeper: !!p.keeper, rating: p.rating,
          ovr: (window.foPkOvr ? window.foPkOvr(p) : Math.round((p.rating || 0) / 1000)),
          batting: ag(aggBat, p), bowling: bowls ? ag(aggBowl, p) : 0,
          fielding: (p.keeper ? ag(aggKeep, p) : ag(aggField, p)),
          wage: p.wage, value: p.fee, talents: p.talents || [],
          exp: p.expWord, form: p.formWord, fatigue: p.fatWord || p.fatigue, career: p.career || {} };
      });
      list.sort(function (a, b) { return (b.ovr || 0) - (a.ovr || 0); });
      var mean = function (arr) { return arr.length ? Math.round(arr.reduce(function (a, b) { return a + b; }, 0) / arr.length) : 0; };
      var byBat = list.slice().sort(function (a, b) { return b.batting - a.batting; }).slice(0, 7).map(function (x) { return x.batting; });
      var byBowl = list.slice().sort(function (a, b) { return b.bowling - a.bowling; }).slice(0, 5).map(function (x) { return x.bowling; });
      return { players: list, bill: list.reduce(function (a, p) { return a + (+p.wage || 0); }, 0),
        tBat: mean(byBat), tBowl: mean(byBowl), tFld: mean(list.map(function (x) { return x.fielding; })) };
    } catch (e) { return null; }
  }
  // your men open their full dossier; a rival's opens his card
  function playerHref(cid, slot, mine, nm) {
    return mine ? "#/player?n=" + encodeURIComponent(nm)
      : "#/player?c=" + encodeURIComponent(cid) + "&s=" + slot + "&n=" + encodeURIComponent(nm);
  }

  window.foRenderClubPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    foClubCss();
    try { document.body.classList.remove("fo-ov-on", "fo-boss-on", "fo-scb-on", "fo-drs-on", "fo-wt-on", "fo-lore-on"); } catch (e) {}
    // the plate carries its own country art, so the page margins stay clear
    try { if (window.__foSideArt) window.__foSideArt(null); } catch (eSa) {}
    var q = qs(), cid = q.c || "eng", slot = parseInt(q.s || "0", 10) || 0;
    var cl = claim();
    var isMine = !!(cl && cl.country === cid && cl.slot === slot);
    var tab = q.t || "overview", sortKey = q.o || "ovr";

    var lg = null; try { lg = window.__foWorldLg ? window.__foWorldLg.get(cid) : null; } catch (e) {}
    try { if (window.__foWorldLg) window.__foWorldLg.want(cid, function () { if ((location.hash || "").indexOf("#/team") === 0) window.foRenderClubPage(); }); } catch (e) {}
    var rk = null; try { rk = JSON.parse(localStorage.getItem("fo_world_rk") || "null"); } catch (e) {}

    // a different club is a different challenge: forget the last one's hour
    var chKey = cid + ":" + slot;
    var canChallenge = !!(cl && !isMine && jwt());
    if (CH.key !== chKey) {
      var d0 = new Date(Date.now() + 3 * 3600000); d0.setMinutes(0, 0, 0);
      CH = { key: chKey, when: dtLocal(d0.getTime()), msg: "", list: null, busy: false, at: 0 };
    }
    // the dossier paints four times per visit as the club, the squad and the
    // honours land - ask the post once, but ask again on a real return
    if (canChallenge && Date.now() - (CH.at || 0) > 30000) { CH.at = Date.now(); loadTies(chKey, cid, slot); }

    var paint = function (info, sq, hon) {
      // A CLUB LIVES IN ONE OF TWO TABLES. Reading table alone left every
      // Division Two club nameless, positionless and with the wrong opponents
      // on its card - the whole lower flight is in table2.
      var lgRows = lg ? (lg.table || []).concat(lg.table2 || []) : [];
      var name = (info && info.name) || (lgRows.filter(function (t) { return t.slot === slot; })[0] || {}).name;
      if (!name) { try { name = ((window.__foWorldNames && window.__foWorldNames.get(cid)) || {})[slot]; } catch (eN) {} }
      if (!name) {
        try {
          var sd = (window.__foPlanet && window.__foPlanet.sidesOf(cid) || []).filter(function (x) { return x.slot === slot; })[0];
          if (sd) name = sd.name;
        } catch (eS) {}
      }
      if (!name) name = "A world club";
      var boss = !!(info && info.is_boss);
      var mgr = info && info.manager;
      var ident = (info && info.identity) || {};
      // WHAT THIS CLUB WAS BEFORE THE RECORD BEGAN. A seat somebody holds was
      // founded the day they took it; every other seat is an old county, and
      // the whole page - the founding year, the seasons played, the cupboard,
      // the story - reads off this one answer.
      var her = null;
      try {
        var isNewClub = isMine || !!mgr;
        her = (window.__foPlanet && window.__foPlanet.heritageOf)
          ? window.__foPlanet.heritageOf(cid, slot, isNewClub) : null;
      } catch (eHer) { her = null; }
      var players = (sq && sq.players) || [];
      var bill = (sq && +sq.wage_bill) || 0;
      var tBat = (sq && +sq.team_batting) || 0, tBowl = (sq && +sq.team_bowling) || 0, tFld = (sq && +sq.team_fielding) || 0;
      // ONE CLUB, ONE SQUAD. For your own club the game already holds the
      // world's men in full - read them, not the public view, so this page and
      // the squad page can never show two different sides.
      if (isMine) {
        var ownSq = ownSquad();
        if (ownSq && ownSq.players.length) {
          players = ownSq.players; bill = ownSq.bill;
          tBat = ownSq.tBat; tBowl = ownSq.tBowl; tFld = ownSq.tFld;
        }
      }

      var rkRow = rk && rk.clubs ? rk.clubs.filter(function (x) { return x.country === cid && x.slot === slot; })[0] : null;
      // and a club's position is its place in ITS OWN division, not in a
      // sixteen-club list nobody plays in
      var ownTbl = ((lg && lg.table) || []).filter(function (t) { return t.slot === slot; }).length
        ? (lg.table || []) : ((lg && lg.table2) || []);
      var tRow = ownTbl.filter(function (t) { return t.slot === slot; })[0] || null;
      var pos = tRow ? ownTbl.indexOf(tRow) + 1 : 0;

      var played = [];
      if (lg && lg.results && name) played = lg.results.filter(function (r) { return r.home === name || r.away === name; });
      var form = played.slice(-5).reverse().map(function (r) {
        var w = r.winner === null ? "t" : r.winner === name ? "w" : "l";
        return "<i class='" + w + "'>" + w.toUpperCase() + "</i>";
      }).join("");

      // their remaining fixtures, off the schedule the umpire itself uses
      var fixtures = [];
      try {
        var wt = window.__foWT, pl = window.__foPlanet;
        if (wt && wt.schedMirror && pl) {
          var cal = wt.serverCal(Date.now());
          var nmOv = (window.__foWorldNames && window.__foWorldNames.get(cid)) || {};
          var nameAt = function (s2) {
            if (nmOv[s2]) return nmOv[s2];
            var row = lgRows.filter(function (t) { return t.slot === s2; })[0];
            if (row) return row.name;
            try { return (pl.sidesOf(cid) || []).filter(function (x) { return x.slot === s2; })[0].name; } catch (e3) { return "?"; }
          };
          var rounds = wt.schedMirror(cid, Math.max(1, cal.seasonNo));
          for (var ri = Math.max(0, cal.round - 1); ri < rounds.length && fixtures.length < 5; ri++) {
            for (var fi = 0; fi < rounds[ri].length; fi++) {
              var pr = rounds[ri][fi];
              if (pr[0] !== slot && pr[1] !== slot) continue;
              var home = pr[0] === slot;
              fixtures.push({ round: ri + 1, home: home, foe: nameAt(home ? pr[1] : pr[0]),
                foeSlot: home ? pr[1] : pr[0], now: (ri + 1) === cal.round });
            }
          }
        }
      } catch (eFx) {}

      var noted = [];
      if (lg && lg.stats) {
        (lg.stats.bat || []).forEach(function (x) { if (x.club === name) noted.push({ n: x.name, w: num(x.runs) + " runs", d: "at " + x.sr + " per hundred balls" }); });
        (lg.stats.bowl || []).forEach(function (x) { if (x.club === name) noted.push({ n: x.name, w: x.wkts + " wickets", d: "at " + x.econ + " an over" }); });
      }
      var shelf = [];
      if (hon && hon.seasons) Object.keys(hon.seasons).sort().forEach(function (sk) {
        var s5 = hon.seasons[sk], sn = sk.slice(1);
        if (s5.league && s5.league[cid] === name) shelf.push("&#127942; " + E(natName(cid)) + " champions &middot; Season " + sn);
        if (s5.championsCup === name) shelf.push("&#127942; CHAMPIONS CUP &middot; Season " + sn);
      });

      var crest = ""; try { if (boss) crest = cx().crest(cid) || ""; } catch (eC2) {}

      // ---- THE OVERVIEW'S FACTS, all read off state the page already holds -
      // the crest fallback the spec asks for: initials in a navy shield
      var idWords = String(name).split(/\s+/).filter(Boolean);
      var initials = (idWords.length > 1
        ? idWords.map(function (w) { return (w[0] || ""); }).join("")
        : String(idWords[0] || "")).replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "FC";
      var crestOf = function (px) {
        if (crest) return "<img class='fo-cd-crimg' src='" + crest + "' alt='" + E(name) + " crest' onerror=\"this.style.display='none'\">";
        if (window.foClubCrest) return "<span class='fo-cd-arms'>" + window.foClubCrest(name, px) + "</span>";
        return "<span class='fo-cd-crest' aria-hidden='true'><b>" + E(initials) + "</b></span>";
      };
      var crestHTML = crestOf(64);
      var inDiv2 = ((lg && lg.table2) || []).some(function (r) { return (r.slot | 0) === slot; });
      var divLabel = inDiv2 ? "Division Two" : (((lg && lg.table2) || []).length ? "Division One" : "The league");
      var myName = null;
      if (cl && cl.country === cid && !isMine) {
        var myRow0 = lgRows.filter(function (t) { return (t.slot | 0) === (cl.slot | 0); })[0];
        myName = (myRow0 && myRow0.name) || (cl.club || null);
      }
      // the ground, as the groundsman and the register know it
      var gname = (info && info.ground) || (name + " Ground");
      var seats = Number(info && info.seats) || 0;
      var gs = groundSeason(cid, slot);
      var gTally = {}, gMost = null;
      gs.forEach(function (x) { gTally[x.pitch] = (gTally[x.pitch] || 0) + 1; });
      Object.keys(gTally).forEach(function (k) { if (!gMost || gTally[k] > gTally[gMost]) gMost = k; });
      var homeGames = played.filter(function (r) { return r.home === name; });
      var homeW = homeGames.filter(function (r) { return r.winner === name; }).length;
      var homeRec = homeGames.length ? homeW + "&ndash;" + (homeGames.length - homeW) : "&mdash;";
      // the season so far, in the division's own numbers
      var nrCount = tRow ? Math.max(0, (tRow.p | 0) - (tRow.w | 0) - (tRow.l | 0)) : 0;
      var leader = ownTbl[0] || null;
      var gapLine = !tRow ? ""
        : pos === 1 ? "Leads the division" + (ownTbl[1] ? ", " + Math.max(0, (tRow.pts | 0) - (ownTbl[1].pts | 0)) + " pts clear" : "")
        : Math.max(0, ((leader && leader.pts) | 0) - (tRow.pts | 0)) + " pts behind " + E((leader && leader.name) || "the leaders");
      var form5 = played.slice(-5).map(function (r) {
        var w = r.winner === null ? "t" : r.winner === name ? "w" : "l";
        return "<i class='" + w + "'>" + w.toUpperCase() + "</i>";
      }).join("");
      // their fixtures still to come - the rounds the results have not banked
      var lastRound = played.reduce(function (a, r) { return Math.max(a, r.round | 0); }, 0);
      var upcoming = fixtures.filter(function (f) { return f.round > lastRound; });
      var roundWhen = function (r9) {
        try { return (typeof window.foRoundTimeTxt === "function" && window.foRoundTimeTxt(r9)) || ""; } catch (eW9) { return ""; }
      };
      var meetingsWith = function (foe) {
        if (!foe || !lg || !lg.results) return [];
        return lg.results.filter(function (r) {
          return (r.home === name && r.away === foe) || (r.away === name && r.home === foe);
        });
      };
      var seasonNo = (lg && lg.seasonNo) || 1;

      // ---- the challenge ---------------------------------------------------
      // Any club on earth can be played, and this is where you ask. The hour
      // is yours to name; a club with nobody at the wheel takes it on the
      // spot, a managed one has until the teamsheets lock to answer. Nothing
      // here needs the other manager awake: whatever orders he last filed are
      // the side that walks out, which is the only way a friendly can be
      // offered to somebody asleep in another timezone.
      var chHTML = "";
      if (canChallenge) {
        // the earliest legal kick-off - two hours out, because the umpire
        // banks the match at the teamsheet lock (T-1h) and the lineup window
        // before it must be real - rounded UP to a whole local hour so the
        // picker's step and the default both sit on the same grid (a
        // half-hour timezone would otherwise make every offered slot invalid)
        var mn = new Date(Date.now() + 2 * 3600000); mn.setMinutes(0, 0, 0);
        if (mn.getTime() < Date.now() + 2 * 3600000) mn.setTime(mn.getTime() + 3600000);
        var minMs = mn.getTime();
        chHTML = "<div class='fo-cp-ch' id='fo-cp-ch'>" +
          "<div class='fo-cp-chh'>&#9876; Challenge " + E(name) + " to a friendly</div>" +
          "<div class='fo-cp-chrow'>" +
          "<input type='datetime-local' id='fo-cp-chwhen' step='3600'" +
          " min='" + dtLocal(minMs) + "' max='" + dtLocal(Date.now() + 7 * 86400000) + "'" +
          " value='" + E(CH.when) + "' aria-label='Date and hour of the match'>" +
          "<button type='button' id='fo-cp-chgo'" + (CH.busy ? " disabled" : "") + ">" + (CH.busy ? "Sending&hellip;" : "Challenge") + "</button>" +
          "</div>" +
          // WHICH CLOCK. The picker speaks the device's local time while the
          // topbar speaks UTC, and a manager who read the two as one clock
          // filed a challenge, then could not make sense of the countdown.
          // This line pins the pick to both clocks and to now.
          "<div class='fo-cp-chtz' id='fo-cp-chtz'></div>" +
          "<div class='fo-cp-chmsg' id='fo-cp-chmsg'>" + (CH.msg ? E(CH.msg)
            : (mgr ? "Their manager has until an hour before play to accept." : "Nobody manages them - they accept on the spot.") +
              " Your latest orders are the side that plays.") + "</div>" +
          "<div id='fo-cp-chlist'></div></div>";
      }

      var TABS = [["overview", "Overview"], ["squad", "Squad"], ["record", "Results"], ["honours", "Records"]];
      var tabBar = "<div class='fo-cd-tabs' role='tablist'>" + TABS.map(function (t) {
        return "<a role='tab' aria-selected='" + (tab === t[0] ? "true" : "false") + "'" +
          " class='" + (tab === t[0] ? "on" : "") + "' href='#/team?c=" + encodeURIComponent(cid) + "&s=" + slot + "&t=" + t[0] + "'>" + t[1] + "</a>";
      }).join("") + "</div>";

      // ---- the roster ------------------------------------------------------
      var sorted = players.slice();
      if (sortKey === "age") sorted.sort(function (a, b) { return (a.age || 99) - (b.age || 99); });
      else if (sortKey === "wage") sorted.sort(function (a, b) { return (b.wage || 0) - (a.wage || 0); });
      else if (sortKey === "name") sorted.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });

      // the red star, on a rival's men as on your own: a club dossier that does
      // not say who is an international is hiding the thing you scout for
      var natStar = function (nm2) {
        try { return window.foNatStar ? window.foNatStar(nm2, slot, { rid: cid }) : ""; } catch (eNs) { return ""; }
      };
      var star = sorted[0];
      var starCard = star ? "<a class='fo-cp-star' href='" + playerHref(cid, slot, isMine, star.name) + "'>" +
        "<img class='fo-cp-face' src='" + faceOf(star) + "' alt='' onerror=\"this.style.display='none'\">" +
        "<div class='fo-cp-starin'>" +
        "<div class='fo-cp-starn'>" + (natFlag(star.nat) ? "<img src='" + natFlag(star.nat) + "' alt='' onerror=\"this.style.display='none'\">" : "") +
        "<b>" + E(star.name) + natStar(star.name) + "</b></div>" +
        "<div class='fo-cp-starr'>" + E(roleWord(star.role)) + "</div>" +
        "<div class='fo-cp-starf'><i>Form</i><span class='fo-cp-dots'>" + formDots(star.form) + "</span></div>" +
        "<div class='fo-cp-startags'>" + (star.talents || []).slice(0, 2).map(function (t) {
          return "<em>" + E(talentWord(t)) + "</em>"; }).join("") + "</div>" +
        "</div>" +
        "<div class='fo-cp-starnums'>" +
        "<div class='fo-cp-starovr'><i>OVR</i><b>" + (star.ovr || "&mdash;") + "</b></div>" +
        "<div class='fo-cp-starval'><i>Value</i><b>" + money(star.value) + "</b></div>" +
        "</div></a>" : "";

      var rosterRows = sorted.slice(1).map(function (p, i) {
        return "<a class='fo-cp-row' href='" + playerHref(cid, slot, isMine, p.name) + "'>" +
          "<span class='rk'>" + (i + 2) + "</span>" +
          "<span class='rl' title='" + E(roleWord(p.role)) + "'>" + roleGlyph(p) + "</span>" +
          "<span class='nm'><b>" + E(p.name) + natStar(p.name) + "</b><i>" + E(p.bowl && p.bowl !== "Does not bowl" ? p.bowl : roleWord(p.role)) + "</i></span>" +
          "<span class='ov'>" + (p.ovr || "&mdash;") + "</span>" +
          "<span class='fm'>" + formDots(p.form) + "</span>" +
          "<span class='hd'>" + (p.hand === "L" ? "LHB" : "RHB") + "</span>" +
          "<span class='wg'>" + money(p.wage) + "</span>" +
          "</a>";
      }).join("");

      var sortSel = "<select id='fo-cp-sort'>" + SORTS.map(function (s) {
        return "<option value='" + s[0] + "'" + (s[0] === sortKey ? " selected" : "") + ">" + s[1] + "</option>";
      }).join("") + "</select>";

      var bodyHTML;
      if (tab === "overview") {
        var hrefT = function (t9) { return "#/team?c=" + encodeURIComponent(cid) + "&s=" + slot + "&t=" + t9; };
        var sh = function (txt) { return "<div class='fo-cd-sh'>" + txt + "</div>"; };

        // -- identity ------------------------------------------------------
        // EVERY CLUB SAID "FOUNDED: SEASON 1". Nine of the ten sides in any
        // league are counties that were playing long before anybody opened
        // this page; only the seat a person took is new. The founding year
        // and the seasons behind it both come off the heritage now.
        // A SEASON IS NOT A YEAR. A club older than the record has no season
        // number to be founded in, and saying so is truer than inventing one.
        var foundedTxt = !her ? "&mdash;"
          : her.human ? "This season"
          : her.foundedSeason ? "Season " + her.foundedSeason
          : "Before the record";
        var seasonsTxt = her && !her.human ? num(her.seasons + Math.max(0, seasonNo - 1)) : String(seasonNo);
        var idMeta =
          "<span>Manager<b>" + (mgr ? E(mgr) : "Unmanaged") + "</b></span>" +
          "<span>Founded<b>" + foundedTxt + "</b></span>" +
          "<span>Home ground<b>" + E(gname) + "</b></span>" +
          "<span>Division<b>" + E(natName(cid)) + " &middot; " + E(divLabel.replace("Division ", "")) + "</b></span>";
        var userMeets = myName ? meetingsWith(myName) : [];
        var umW = userMeets.filter(function (r) { return r.winner === name; }).length;
        var umL = userMeets.filter(function (r) { return r.winner && r.winner !== name; }).length;
        var vsYou = isMine ? "&mdash;"
          : !myName ? "Never met"
          : !userMeets.length ? "First meeting"
          : umW > umL ? "They lead " + umW + "&ndash;" + umL
          : umL > umW ? "You lead " + umL + "&ndash;" + umW
          : "Level " + umW + "&ndash;" + umL;
        var idFoot =
          "<div class='f'><span>World rank</span><b>" + (rkRow ? "#" + rkRow.rank : "Unrated") + "</b></div>" +
          "<div class='f'><span>Vs your club</span><b>" + vsYou + "</b></div>" +
          "<div class='f'><span>Seasons played</span><b>" + seasonsTxt + "</b></div>";
        var idActs = isMine
          ? "<a class='sec' href='#/squad'>Your squad</a><a class='sec' href='#/orders'>The orders</a>"
          : (canChallenge ? "<button type='button' class='pri' id='fo-cd-chbtn'>Challenge to a friendly</button>" : "") +
            "<a class='sec' href='" + hrefT("squad") + "'>View squad</a>";
        var idCard = "<div class='fo-cd-card fo-cd-id'>" +
          "<div class='top'>" + crestHTML +
          "<div class='nm'><h1>" + E(name) + "</h1>" +
          "<div class='loc'><img src='" + flagOf(cid) + "' alt=''>" + E(natName(cid)) +
          (boss ? " &middot; The flagship" : isMine ? " &middot; Your club" : "") + "</div></div></div>" +
          "<div class='meta'>" + idMeta + "</div>" +
          "<div class='acts'>" + idActs + "</div>" +
          "<div class='foot'>" + idFoot + "</div>" +
          (isMine ? "<div id='fo-cp-mine'></div>" : "") +
          "</div>";

        // -- the ground, art first -----------------------------------------
        var gNote = gMost ? E(pitchNm(gMost)) + " strips &middot; " + E((PITCH_NOTE[gMost] || [""])[0]).replace(/\.$/, "").toLowerCase() : "";
        var gCard = "<div class='fo-cd-card fo-cd-gr'>" +
          "<div class='gwrap'>" +
          "<img src='" + groundArtOf(cid, slot) + "' alt='" + E(gname) + "'" +
          " data-gk='" + E(cid + ":" + slot) + "'" +
          " data-fb='" + fbGroundOf() + "'" +
          " onload=\"try{window.__foGrOk[this.dataset.gk]=this.getAttribute('src')}catch(e){}\"" +
          " onerror=\"if(this.dataset.fb&&this.src.indexOf(this.dataset.fb)<0){this.src=this.dataset.fb}" +
          "else{var g=this.closest('.fo-cd-gr');if(g)g.classList.add('noart');this.parentNode.removeChild(this)}\">" +
          "<div class='gov'><div class='gt'>" + E(gname) + (gNote ? "<u>" + gNote + "</u>" : "") + "</div>" +
          "<a class='gd' href='" + hrefT("ground") + "'>Ground details &rsaquo;</a></div>" +
          "</div>" +
          "<div class='grb'>" +
          "<span>Capacity<b>" + (seats ? num(seats) : "&mdash;") + "</b></span>" +
          "<span>Usual strip<b>" + (gMost ? E(pitchNm(gMost)) : "&mdash;") + "</b></span>" +
          "<span>Home record<b>" + homeRec + "</b></span>" +
          "</div></div>";

        // -- league position, the navy anchor ------------------------------
        var posCard = "<div class='fo-cd-card fo-cd-pos'>" +
          "<div class='lft'><div class='cap'>League position</div>" +
          "<div class='big'>" + (pos || "&mdash;") + "<i>&nbsp;/&nbsp;" + (ownTbl.length || "&mdash;") + "</i></div>" +
          "<div class='pts'>" + (tRow ? (tRow.pts | 0) + " PTS" : "&mdash;") + "</div></div>" +
          "<div class='grid'>" +
          "<span>P<b>" + (tRow ? tRow.p | 0 : "&mdash;") + "</b></span>" +
          "<span>W<b>" + (tRow ? tRow.w | 0 : "&mdash;") + "</b></span>" +
          "<span>L<b>" + (tRow ? tRow.l | 0 : "&mdash;") + "</b></span>" +
          "<span>NR<b>" + (tRow ? nrCount : "&mdash;") + "</b></span>" +
          "<span>NRR<b>" + (tRow ? ((+tRow.nrr >= 0 ? "+" : "") + (+tRow.nrr || 0).toFixed(2)) : "&mdash;") + "</b></span>" +
          "</div>" +
          "<div class='xtra'>" +
          (form5 ? "<div class='fl'>Form</div><div class='fx'>" + form5 + "</div>" : "") +
          (gapLine ? "<div class='gap'>" + gapLine + "</div>" : "") +
          "</div>" +
          "<a class='vt' href='#/nation?n=" + encodeURIComponent(cid) + "'>View table &rsaquo;</a></div>";

        // -- next fixture + the three after it -----------------------------
        var nx = upcoming[0] || null;
        var nfBody;
        if (!nx) {
          nfBody = "<p class='fo-cd-dim'>No fixture currently scheduled.</p>";
        } else {
          var vsUser = !!(myName && nx.foe === myName);
          var meets = meetingsWith(nx.foe);
          var mW = meets.filter(function (r) { return r.winner === name; }).length;
          var mL = meets.filter(function (r) { return r.winner && r.winner !== name; }).length;
          var nxWhen = roundWhen(nx.round);
          var foeIni = String(nx.foe).split(/\s+/).map(function (w) { return w[0] || ""; })
            .join("").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
          nfBody =
            (vsUser ? "<div class='tag'>Your next meeting</div>" : "") +
            "<a class='who' href='#/team?c=" + encodeURIComponent(cid) + "&s=" + nx.foeSlot + "'>" +
            (window.foClubCrest
              ? "<span class='mn arms'>" + window.foClubCrest(nx.foe, 38) + "</span>"
              : "<span class='mn'><b>" + E(foeIni) + "</b></span>") +
            "<h3>" + E(nx.foe) + "<u>Round " + nx.round + " &middot; " + E(natName(cid)) + " " + E(divLabel) + "</u></h3></a>" +
            "<div class='det'>" +
            "<span>When<b>" + (nxWhen ? E(nxWhen) : "Round " + nx.round) + "</b></span>" +
            "<span>Venue<b>" + (nx.home ? E(gname) + " &middot; Home" : "Away") + "</b></span>" +
            "</div>" +
            "<div class='h2h'>Head to head: " + (!meets.length ? "first meeting."
              : mW > mL ? "they lead " + mW + "&ndash;" + mL + "."
              : mL > mW ? "they trail " + mW + "&ndash;" + mL + "."
              : "level at " + mW + "&ndash;" + mL + ".") + "</div>" +
            (vsUser ? "<a class='vf' href='#/preview'>View fixture</a>" : "") +
            (upcoming.length > 1
              ? "<div class='thn'>Then</div>" + upcoming.slice(1, 4).map(function (f) {
                  var w9 = roundWhen(f.round);
                  return "<a class='ur' href='#/team?c=" + encodeURIComponent(cid) + "&s=" + f.foeSlot + "'>" +
                    "<span class='d'>" + (w9 ? E(String(w9).split("&middot;")[0] || w9) : "R" + f.round) + "</span>" +
                    "<span class='o'>" + (f.home ? "vs " : "at ") + E(f.foe) + " <em>" + (f.home ? "home" : "away") + "</em></span>" +
                    "<span class='c'>League &middot; R" + f.round + "</span></a>";
                }).join("")
              : "") +
            "<a class='fo-cd-lnk' href='" + hrefT("record") + "'>All fixtures</a>";
        }
        var nfCard = "<div class='fo-cd-card fo-cd-nf'>" + sh("Next fixture") + nfBody + "</div>";

        // -- recent form ---------------------------------------------------
        var rfRows = played.slice(-5).reverse().map(function (r) {
          var w = r.winner === null ? "t" : r.winner === name ? "w" : "l";
          var home9 = r.home === name;
          return "<div class='r'><i class='" + w + "'>" + w.toUpperCase() + "</i>" +
            "<span class='who'>" + (home9 ? "vs " : "at ") + E(home9 ? r.away : r.home) + " <em>" + (home9 ? "home" : "away") + "</em></span>" +
            "<span class='sc'>" + E(r.text || "") + "</span></div>";
        }).join("");
        var rfCard = "<div class='fo-cd-card fo-cd-rf'>" + sh("Recent form") +
          (rfRows || "<p class='fo-cd-dim'>No completed matches yet this season.</p>") +
          (rfRows ? "<a class='fo-cd-lnk' href='" + hrefT("record") + "'>All results</a>" : "") + "</div>";

        // -- the club diary, off the real events feed ----------------------
        var feed9 = eventsOf(cid + ":" + slot, cid, slot, function () {
          if ((location.hash || "").indexOf("#/team") === 0) window.foRenderClubPage();
        });
        var diBody;
        if (feed9.loading || feed9.rows === null) diBody = "<p class='fo-cd-dim'>Turning back through the club's diary&hellip;</p>";
        else if (!feed9.rows.length) diBody = "<p class='fo-cd-dim'>No recent club activity.</p>";
        else diBody = feed9.rows.slice(0, 5).map(function (e9) {
          var d9 = new Date(Number(e9.at) || 0);
          return "<div class='r'><span class='d'>" + d9.getDate() + " " + MO[d9.getMonth()] + "</span>" +
            "<p>" + evLine(cid, slot, e9) + "</p></div>";
        }).join("");
        var diCard = "<div class='fo-cd-card fo-cd-di'>" + sh("Club diary") + diBody +
          (feed9.rows && feed9.rows.length ? "<a class='fo-cd-lnk' href='" + hrefT("events") + "'>Full diary</a>" : "") + "</div>";

        // -- competitions --------------------------------------------------
        var cmpCard = "<div class='fo-cd-card fo-cd-cmp'>" + sh("Competitions") +
          "<div class='r'><span class='nm'>" + E(natName(cid)) + " " + E(divLabel) + "</span>" +
          "<span class='st'>" + (pos ? "<u>" + ordn(pos) + "</u>" : "<u class='off'>&ndash;</u>") +
          (tRow ? "<em>" + (tRow.pts | 0) + " pts</em>" : "") + "</span></div>" +
          "<a class='r lk' href='#/facup?c=" + encodeURIComponent(cid) + "'><span class='nm'>The National Cup</span><span class='st'><em>The bracket &rsaquo;</em></span></a>" +
          "<a class='r lk' href='#/colts?c=" + encodeURIComponent(cid) + "'><span class='nm'>The Colts Cup</span><span class='st'><em>The bracket &rsaquo;</em></span></a>" +
          "</div>";

        // -- squad snapshot, structure not faces ---------------------------
        var cnt = { bat: 0, ar: 0, seam: 0, spin: 0, wk: 0 }, ageSum = 0, valSum = 0, overseas = 0;
        players.forEach(function (p9) {
          ageSum += (+p9.age || 0); valSum += (+p9.value || 0);
          if (p9.nat && p9.nat !== natName(cid)) overseas++;
          if (p9.keeper) cnt.wk++;
          else if (p9.role === "allRounder") cnt.ar++;
          else if (/spin/i.test(p9.type || "")) cnt.spin++;
          else if (/seam|fast|medium|pace/i.test(p9.type || "")) cnt.seam++;
          else cnt.bat++;
        });
        var snapRow = function (k9, v9) { return "<div class='r'><span>" + k9 + "</span><b>" + v9 + "</b></div>"; };
        var snCard = "<div class='fo-cd-card fo-cd-sn'>" + sh("Squad snapshot") +
          (players.length ? "<div class='snap'>" +
            snapRow("Batters", cnt.bat) + snapRow("Total players", players.length) +
            snapRow("All-rounders", cnt.ar) + snapRow("Average age", players.length ? (ageSum / players.length).toFixed(1) : "&mdash;") +
            snapRow("Seamers", cnt.seam) + snapRow("Overseas", overseas) +
            snapRow("Spinners", cnt.spin) + snapRow("Squad value", valSum ? money(valSum) : "&mdash;") +
            snapRow("Wicketkeepers", cnt.wk) + snapRow("Weekly wages", bill ? money(bill) : "&mdash;") +
            "</div><a class='fo-cd-lnk' href='" + hrefT("squad") + "'>View squad</a>"
          : "<p class='fo-cd-dim'>The squad list is on its way from the World Service&hellip;</p>") + "</div>";

        // -- honours -------------------------------------------------------
        var lgTitles = [], ccTitles = [];
        if (hon && hon.seasons) Object.keys(hon.seasons).sort().forEach(function (sk9) {
          var s9 = hon.seasons[sk9], sn9 = sk9.slice(1);
          if (s9.league && s9.league[cid] === name) lgTitles.push(sn9);
          if (s9.championsCup === name) ccTitles.push(sn9);
        });
        var hnRow = function (k9, arr) {
          return "<div class='r'><span>" + k9 + (arr.length ? " <em>&middot; season " + arr.join(", ") + "</em>" : "") + "</span><b>" + (arr.length || "&ndash;") + "</b></div>";
        };
        /* THE YEARS BEFORE THE RECORD. Every club in the world read as founded
           five minutes ago and holding nothing, flagship included - so beating
           the best side in the country was worth exactly as much as beating
           the worst, because neither had ever won anything. A club that a
           manager has founded genuinely has none of this, and now that is a
           CONTRAST rather than the universal condition. */
        var hrRow = function (k9, n9, note) {
          return "<div class='r'><span>" + k9 + (note ? " <em>&middot; " + note + "</em>" : "") + "</span><b>" + n9 + "</b></div>";
        };
        var hnCard = "<div class='fo-cd-card fo-cd-hn'>" + sh("Club honours") +
          (her && her.human
            ? "<div class='hnE'>Founded this season. No honours yet &mdash; everything is still to be won.</div>"
            : her
              ? hrRow(E(natName(cid)) + " champions", her.titles + lgTitles.length,
                      her.lastTitleYear ? "last won in Season " + her.lastTitleYear : "") +
                hrRow("The National Cup", her.cups, "") +
                hrRow("The Champions Cup", her.crowns + ccTitles.length, "") +
                "<div class='hnFoot'>" + her.seasons + " seasons in the " + E(natName(cid)) +
                " league, first played in Season " + her.leagueFromSeason + "</div>" +
                "<a class='fo-cd-lnk' href='" + hrefT("honours") + "'>The records</a>"
              : ((lgTitles.length || ccTitles.length)
                ? hnRow(E(natName(cid)) + " champions", lgTitles) + hnRow("The Champions Cup", ccTitles) +
                  "<a class='fo-cd-lnk' href='" + hrefT("honours") + "'>The records</a>"
                : "<div class='hnE'>No senior honours yet. Everything is still to be won.</div>")) + "</div>";

        // -- the club's story, desktop only, real events only --------------
        // THE STORY IS THE RECORD, not a summary of it. Founding, then the
        // years the club actually won something, newest first, then this
        // season - because a timeline whose only dated entry is "Season 1" is
        // not a timeline.
        var tlItems = [];
        if (her && !her.human) {
          tlItems.push({ t: her.foundedSeason ? "Season " + her.foundedSeason : "Founded",
            s: "Founded &middot; " + (her.founded < her.leagueFrom
              ? "playing before the " + E(natName(cid)) + " league existed"
              : "joined a competition first played in Season " + her.leagueFromSeason) });
          var marks = [];
          (her.crownYears || []).forEach(function (y9) { marks.push({ y: y9, s: "Champions Cup winners" }); });
          (her.titleYears || []).forEach(function (y9) { marks.push({ y: y9, s: E(natName(cid)) + " champions" }); });
          (her.cupYears || []).forEach(function (y9) { marks.push({ y: y9, s: "National Cup winners" }); });
          marks.sort(function (a, b) { return b.y - a.y; });
          marks.slice(0, 6).forEach(function (m8) { tlItems.push({ t: "Season " + m8.y, s: m8.s }); });
        } else {
          tlItems.push({ t: "Season 1", s: "Founded &middot; a new club in " + E(natName(cid)) + " " + E(divLabel) });
        }
        lgTitles.forEach(function (sn9) { tlItems.push({ t: "Season " + sn9, s: E(natName(cid)) + " champions" }); });
        ccTitles.forEach(function (sn9) { tlItems.push({ t: "Season " + sn9, s: "Champions Cup winners" }); });
        if (played.length) tlItems.push({ t: "Season " + seasonNo, s: played.length + " match" + (played.length === 1 ? "" : "es") + " into the campaign" });
        var tlCard = "<div class='fo-cd-card fo-cd-tl'>" + sh("The club's story") +
          "<div class='tl'>" + tlItems.slice(0, 8).map(function (m9) {
            return "<div class='m'><b>" + m9.t + "</b><span>" + m9.s + "</span></div>";
          }).join("") + "</div></div>";

        bodyHTML =
          "<div class='fo-cd-z1'>" + idCard + gCard + posCard + "</div>" +
          tabBar +
          "<div class='fo-cd-z2'>" + nfCard + rfCard + diCard + "</div>" +
          "<div class='fo-cd-z3'>" + cmpCard + snCard + hnCard + "</div>" +
          tlCard + chHTML;
      } else if (tab === "record") {
        bodyHTML = "<div class='fo-cp-panel'>" +
          "<div class='fo-cp-ph'><h2>&#10022; The record &#10022;</h2>" +
          (form ? "<span class='fo-cp-form'>" + form + "</span>" : "") + "</div>" +
          (played.length ? played.slice(-8).reverse().map(function (r) {
            var w = r.winner === null ? "t" : r.winner === name ? "w" : "l";
            var foe = r.home === name ? r.away : r.home;
            return "<div class='fo-cp-r " + w + "'><i>R" + r.round + "</i><b>" + (r.home === name ? "h" : "a") +
              " v " + E(foe) + "</b><span>" + E(r.text || "") + "</span></div>";
          }).join("") : "<p class='fo-cp-dim'>No cricket played yet this season.</p>") +
          "<div class='fo-cp-sub'>Fixtures</div>" +
          (fixtures.length ? fixtures.map(function (f) {
            return "<a class='fo-cp-r fx' href='#/team?c=" + encodeURIComponent(cid) + "&s=" + f.foeSlot + "'>" +
              "<i>R" + f.round + "</i><b>" + (f.home ? "home" : "away") + " v " + E(f.foe) + "</b>" +
              "<span>" + (f.now ? "today" : "to come") + "</span></a>";
          }).join("") : "<p class='fo-cp-dim'>The season's fixtures are not out yet.</p>") +
          (noted.length ? "<div class='fo-cp-sub'>Names the season made</div>" + noted.map(function (n) {
            return "<div class='fo-cp-note'><b>" + E(n.n) + "</b> &mdash; " + n.w + " <u>" + n.d + "</u></div>"; }).join("") : "") +
          "</div>";
      } else if (tab === "honours") {
        bodyHTML = "<div class='fo-cp-panel'>" +
          "<div class='fo-cp-ph'><h2>&#10022; The trophy shelf &#10022;</h2></div>" +
          // THE SHELF DID NOT START EMPTY for anybody but the club a person
          // founded. What the record holds goes on top; what the club won
          // before the record began goes under it, counted.
          (shelf.length ? shelf.map(function (s) { return "<div class='fo-cp-note'>" + s + "</div>"; }).join("") : "") +
          (function () {
            if (!her) return shelf.length ? "" : "<p class='fo-cp-dim'>Bare, for now. Every season writes the next line.</p>";
            if (her.human) return shelf.length ? "" : "<p class='fo-cp-dim'>Bare, for now &mdash; founded this season. Every season writes the next line.</p>";
            var won = [];
            // WITH THE YEARS ON THEM. A count is a fact; a list of years is a
            // history, and every one of these is a season with a table behind it.
            var yrs = function (a) {
              var l = (a || []).slice().reverse().map(function (x) { return "S" + x; });
              return l.length > 12 ? l.slice(0, 12).join(", ") + " and " + (l.length - 12) + " more" : l.join(", ");
            };
            if (her.titles) won.push("<div class='fo-cp-note'><b>" + her.titles + "</b> &mdash; " + E(natName(cid)) + " championship" + (her.titles === 1 ? "" : "s") + "<u>" + yrs(her.titleYears) + "</u></div>");
            if (her.cups) won.push("<div class='fo-cp-note'><b>" + her.cups + "</b> &mdash; National Cup" + (her.cups === 1 ? "" : "s") + "<u>" + yrs(her.cupYears) + "</u></div>");
            if (her.crowns) won.push("<div class='fo-cp-note'><b>" + her.crowns + "</b> &mdash; Champions Cup" + (her.crowns === 1 ? "" : "s") + "<u>" + yrs(her.crownYears) + "</u></div>");
            return "<div class='fo-cp-sub'>The record</div>" +
              (won.length ? won.join("") : "<p class='fo-cp-dim'>" + her.seasons + " seasons in the competition and nothing to show for them.</p>") +
              "<div class='fo-cp-note'>Founded <b>" + (her.foundedSeason ? "Season " + her.foundedSeason : "before the record") +
              "</b> &middot; " + her.seasons + " seasons played" +
              (her.lastTitleYear ? " &middot; last title in Season " + her.lastTitleYear : "") +
              " &middot; <a href='#/stats?v=hist&n=" + encodeURIComponent(cid) + "'>walk the seasons &rsaquo;</a></div>";
          })() +
          "<div class='fo-cp-sub'>The ground</div>" +
          "<div class='fo-cp-note'><b>" + E((info && info.ground) || "A ground of their own") + "</b></div>" +
          // an academy is a building, and buildings are visible - the level a
          // club pays for is public; who is inside it never is
          "<div class='fo-cp-sub'>The academy</div>" +
          "<div class='fo-cp-note'><b>Level " + Math.max(1, Math.min(5, +(info && info.academy) || 2)) + "</b> of five</div>" +
          (ident && ident.motto ? "<div class='fo-cp-sub'>The motto</div><div class='fo-cp-note'>&ldquo;" + E(ident.motto) + "&rdquo;</div>" : "") +
          "<div class='fo-cp-sub'>Standing</div>" +
          "<div class='fo-cp-note'>World rank <b>" + (rkRow ? "#" + rkRow.rank : "unrated") + "</b>" +
          (rkRow ? " &middot; strength " + (function (v) {
              try { if (window.foRateTxt) return window.foRateTxt(v); } catch (e) {}
              return num(v);
            })(rkRow.strength || rkRow.rating) + " &middot; " + rkRow.w + "-" + rkRow.l + (rkRow.t ? "-" + rkRow.t : "") + " all competitions" : "") + "</div>" +
          "</div>";
      } else if (tab === "ground") {
        var gname = (info && info.ground) || (name + " Ground");
        var seats = Number(info && info.seats) || 0;
        var season9 = groundSeason(cid, slot);
        var toCome = season9.filter(function (x) { return !x.past; });
        // WHAT THIS GROUNDSMAN PREPARES. One strip is an anecdote; a season of
        // them is a character, so the tally is what tells a visitor what to
        // expect from the place.
        var tally = {}, most = null;
        season9.forEach(function (x) { tally[x.pitch] = (tally[x.pitch] || 0) + 1; });
        Object.keys(tally).forEach(function (k) { if (!most || tally[k] > tally[most]) most = k; });
        var nmOv9 = {};
        try { nmOv9 = (window.__foWorldNames && window.__foWorldNames.get(cid)) || {}; } catch (eN9) {}
        var nameAt9 = function (s2) {
          if (nmOv9[s2]) return nmOv9[s2];
          var row9 = lgRows.filter(function (t) { return t.slot === s2; })[0];
          if (row9) return row9.name;
          try { return (window.__foPlanet.sidesOf(cid) || []).filter(function (x) { return x.slot === s2; })[0].name; }
          catch (e9) { return "a club"; }
        };
        var kv9 = function (k, v) {
          return "<div class='fo-cp-gkv'><span>" + k + "</span><b>" + v + "</b></div>";
        };
        bodyHTML = "<div class='fo-cp-panel'>" +
          "<div class='fo-cp-ph'><h2>&#10022; " + E(gname) + " &#10022;</h2></div>" +
          "<div class='fo-cp-gkvs'>" +
          kv9("Country", E(natName(cid))) +
          kv9("Capacity", seats ? seats.toLocaleString() + " seats" : "&mdash;") +
          kv9("Northern end", "The " + E(natName(cid)) + " End") +
          kv9("Southern end", "The Pavilion End") +
          kv9("Usual strip", most ? E(pitchNm(most)) + " &middot; " + tally[most] + " of " + season9.length : "&mdash;") +
          "</div>" +
          (isMine ? "<a class='fo-cp-glink' href='#/finance'>&#127959; Build another stand &mdash; the books hold the plans &rsaquo;</a>" : "") +

          "<div class='fo-cp-sub'>The forecast</div>" +
          (toCome.length
            ? "<div class='fo-cp-gfc'>" + toCome.slice(0, 8).map(function (x) {
                var when = "";
                try { if (typeof window.foRoundTimeTxt === "function") when = window.foRoundTimeTxt(x.round) || ""; } catch (eW) {}
                return "<div class='fo-cp-gfr'>" +
                  "<span class='r'>R" + x.round + "</span>" +
                  "<span class='o'>v " + E(nameAt9(x.foeSlot)) + (when ? "<i>" + E(when) + "</i>" : "") + "</span>" +
                  "<span class='p'>" + E(pitchNm(x.pitch)) + "</span>" +
                  "<span class='w'>" + E(x.weather) + "</span></div>";
              }).join("") + "</div>"
            : "<p class='fo-cp-dim'>No more cricket is due here this season.</p>") +

          "<div class='fo-cp-sub'>What the strips do</div>" +
          "<div class='fo-cp-gp'>" + PITCH_ORDER.map(function (k) {
            var n9 = PITCH_NOTE[k] || ["", ""];
            var hits = tally[k] || 0;
            return "<div class='fo-cp-gpr" + (hits ? " on" : "") + "'>" +
              "<b>" + E(pitchNm(k)) + (hits ? "<u>" + hits + "</u>" : "") + "</b>" +
              "<span>" + E(n9[0]) + "</span><em>" + E(n9[1]) + "</em></div>";
          }).join("") + "</div>" +
          "</div>";
      } else if (tab === "transfers") {
        var tk = cid + ":" + slot;
        var tf = transfersOf(tk, cid, slot, function () {
          if ((location.hash || "").indexOf("#/team") === 0) window.foRenderClubPage();
        });
        var trBody;
        if (tf.loading || !tf.d) {
          trBody = "<p class='fo-cp-dim'>" + (tf.loading ? "Opening the transfer register&hellip;"
            : "The register could not be reached.") + "</p>";
        } else {
          var D = tf.d, deals = D.deals || [];
          var kvT = function (k, v, cls) {
            return "<div class='fo-cp-trk" + (cls ? " " + cls : "") + "'><span>" + k + "</span><b>" + v + "</b></div>";
          };
          var sums = "<div class='fo-cp-trsum'>" +
            kvT("Paid out", trMoney(D.spent)) +
            kvT("Taken in", trMoney(D.received)) +
            kvT("Net", trMoney(D.net), (+D.net >= 0 ? "up" : "dn")) +
            kvT("Transfers", D.transfers) +
            kvT("Average bought", D.avgBuy == null ? "&mdash;" : trMoney(D.avgBuy)) +
            kvT("Average sold", D.avgSell == null ? "&mdash;" : trMoney(D.avgSell)) +
            "</div>";
          trBody = sums + (deals.length
            ? "<div class='fo-cp-scroll'><table class='fo-cp-tr'>" +
              "<thead><tr><th>S</th><th>Date</th><th>Deal</th><th class='nm'>Player</th>" +
              "<th class='nm'>To / from</th><th>Age</th><th>Fee</th></tr></thead><tbody>" +
              deals.map(function (d) {
                var inb = d.way === "in";
                return "<tr class='" + (inb ? "in" : "out") + "'>" +
                  "<td>" + (d.season || "") + "</td>" +
                  "<td class='dt'>" + trDate(d.at) + "</td>" +
                  "<td class='wy'>" + (inb ? "Bought" : "Sold") + "</td>" +
                  "<td class='nm'>" + evPlayer(cid, slot, d.player) + "</td>" +
                  "<td class='nm'>" + evClub(cid, d) + "</td>" +
                  "<td>" + (d.age == null ? "&mdash;" : Math.floor(+d.age)) + "</td>" +
                  "<td class='fe'>" + trMoney(d.fee) + "</td></tr>";
              }).join("") + "</tbody></table></div>"
            : "<p class='fo-cp-dim'>No player has come or gone yet. The register opens with the first deal.</p>");
        }
        bodyHTML = "<div class='fo-cp-panel'>" +
          "<div class='fo-cp-ph'><h2>&#10022; Transfer history &#10022;</h2></div>" + trBody + "</div>";
      } else if (tab === "events") {
        var ek = cid + ":" + slot;
        var feed = eventsOf(ek, cid, slot, function () {
          if ((location.hash || "").indexOf("#/team") === 0) window.foRenderClubPage();
        });
        var evBody;
        if (feed.loading || feed.rows === null) {
          evBody = "<p class='fo-cp-dim'>Turning back through the club's diary&hellip;</p>";
        } else if (!feed.rows.length) {
          evBody = "<p class='fo-cp-dim'>Nothing has happened here yet. The diary opens with the first ball of the season.</p>";
        } else {
          var lastK = "";
          evBody = feed.rows.map(function (e) {
            var w = evWhen(e.at), head = "";
            if (w.key !== lastK) { lastK = w.key; head = "<div class='fo-cp-evday'>" + E(w.day) + "</div>"; }
            return head + "<div class='fo-cp-ev " + E(e.kind) + "'>" +
              "<span class='t'>" + w.time + "</span>" +
              "<span class='w'>" + evLine(cid, slot, e) + "</span></div>";
          }).join("");
        }
        bodyHTML = "<div class='fo-cp-panel'>" +
          "<div class='fo-cp-ph'><h2>&#10022; Recent events &#10022;</h2>" +
          (feed.mine ? "<span class='fo-cp-full'>Your club &middot; <b>teamsheets shown</b></span>" : "") + "</div>" +
          evBody + "</div>";
      } else {
        bodyHTML = "<div class='fo-cp-panel'>" +
          "<div class='fo-cp-ph'><h2>&#10022; First XI &#10022;</h2>" +
          "<span class='fo-cp-full'>Full squad <b>" + players.length + "</b></span>" +
          "<span class='fo-cp-tools'>" + sortSel + "</span></div>" +
          (players.length
            ? starCard +
              "<div class='fo-cp-cols'><span></span><span></span><span>Player</span><span>OVR</span>" +
              "<span>Form</span><span>Hand</span><span>Wage</span></div>" +
              rosterRows
            : "<p class='fo-cp-dim'>The squad list is on its way from the World Service&hellip;</p>") +
          "</div>";
      }

      // the slim billing every non-overview tab wears above its panel
      var slimHead = "";
      if (tab !== "overview") {
        slimHead = "<div class='fo-cd-slim'>" + crestOf(40) +
          "<div class='sb'><h1>" + E(name) + "</h1><i>" + E(natName(cid)) + " &middot; " + E(divLabel) +
          (pos ? " &middot; " + ordn(pos) : "") + "</i></div>" +
          (isMine ? "<div id='fo-cp-mine'></div>" : "") + "</div>";
      }

      var html9 = "<div class='fo-cp fo-cd'>" +
        "<a class='fo-cd-bk' href='#/nation?n=" + encodeURIComponent(cid) + "'>&lsaquo; " + E(natName(cid)) + " league</a>" +
        (tab === "overview" ? bodyHTML : slimHead + tabBar + bodyHTML) +
        "<div class='fo-cp-foot'><a href='#/rankings'>The world rankings &rsaquo;</a><a href='#/nation?n=" + encodeURIComponent(cid) + "'>The league table &rsaquo;</a></div>" +
        "</div>";
      // THE DOSSIER SETTLES, IT DOES NOT BLINK. Boot answers land one by one
      // (the club, the squad, the honours, the snapshot wake-ups) and each
      // used to rebuild the whole page - a dozen teardowns in the first two
      // seconds, every one re-hanging the ground painting from scratch. An
      // answer that changes nothing now changes nothing; and when the words
      // do move, the already-decoded painting is carried across to the new
      // page rather than fetched and decoded again.
      if (page.__foCpSig === html9 && page.querySelector(".fo-cp")) {
        if (canChallenge) { try { paintTies(); } catch (eTs) {} }
        return;
      }
      page.__foCpSig = html9;
      var keep9 = null;
      try {
        var old9 = page.querySelector(".fo-cd-gr img");
        if (old9 && old9.complete && old9.naturalWidth) keep9 = old9;
      } catch (eK9) {}
      page.innerHTML = html9;
      try {
        var new9 = page.querySelector(".fo-cd-gr img");
        if (keep9 && new9 && keep9.src === new9.src) new9.parentNode.replaceChild(keep9, new9);
      } catch (eK8) {}
      try { saleMarks(cid, slot); } catch (eSm) {}

      try {
        var sel = document.getElementById("fo-cp-sort");
        if (sel) sel.addEventListener("change", function () {
          location.hash = "#/team?c=" + encodeURIComponent(cid) + "&s=" + slot + "&t=" + tab + "&o=" + sel.value;
        });
      } catch (eSo) {}
      try {
        var chb = document.getElementById("fo-cd-chbtn");
        if (chb) chb.addEventListener("click", function () {
          var tgt = document.getElementById("fo-cp-ch");
          if (tgt) { tgt.scrollIntoView({ behavior: "smooth", block: "center" }); var w9 = document.getElementById("fo-cp-chwhen"); if (w9) try { w9.focus({ preventScroll: true }); } catch (eF9) {} }
        });
      } catch (eCb) {}

      if (canChallenge) {
        try {
          var whenEl = document.getElementById("fo-cp-chwhen");
          var goEl = document.getElementById("fo-cp-chgo");
          // the pick, read back on both clocks - local and UTC - with the
          // distance from now, so the two clocks can never be mistaken
          var sayWhen = function () {
            var el9 = document.getElementById("fo-cp-chtz"); if (!el9 || !whenEl) return;
            var ms9 = NaN; try { ms9 = new Date(whenEl.value).getTime(); } catch (eW9) {}
            if (!(ms9 > 0)) { el9.innerHTML = ""; return; }
            var d9 = new Date(ms9);
            var tz9 = ""; try { tz9 = (typeof foTzAbbr === "function" && foTzAbbr()) || ""; } catch (eT9) {}
            var lm9 = Math.round((ms9 - Date.now()) / 60000);
            var dist = lm9 < 0 ? "already in the past"
              : lm9 < 120 ? "in " + lm9 + " min &mdash; too soon, two hours is the floor"
              : "in " + Math.floor(lm9 / 60) + "h " + (lm9 % 60) + "m";
            el9.innerHTML = "First ball <b>" +
              E(d9.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) + (tz9 ? " " + E(tz9) : "") +
              " your time</b> &middot; " + E(d9.toISOString().slice(11, 16)) + " UTC &middot; " + dist +
              " &middot; teamsheets lock an hour before.";
          };
          if (whenEl) whenEl.addEventListener("input", function () { CH.when = whenEl.value; sayWhen(); });
          sayWhen();
          if (goEl) goEl.addEventListener("click", function () {
            var ms = NaN; try { ms = new Date(whenEl.value).getTime(); } catch (eW) {}
            if (!(ms > 0)) { chSay("Name a date and hour for the match."); return; }
            if (ms < Date.now() + 2 * 3600000) { chSay("Pick a time at least two hours from now - teamsheets lock an hour before the match, and the lineup window must be real."); return; }
            if (ms > Date.now() + 7 * 86400000) { chSay("Pick a time within the next seven days."); return; }
            CH.busy = true; goEl.disabled = true; goEl.textContent = "Sending…";
            rpc("world_friendly_challenge", { p_country: cid, p_slot: slot, p_play_at_ms: ms })
              .then(function (r) {
                CH.busy = false; goEl.disabled = false; goEl.textContent = "Challenge";
                chSay(r && r.humanOpponent
                  ? "Challenge sent. Their manager has until an hour before the match to accept."
                  : "The match is on. Your latest orders play unless you file a lineup for it.");
                loadTies(CH.key, cid, slot);
              })
              .catch(function (e) {
                CH.busy = false; goEl.disabled = false; goEl.textContent = "Challenge";
                chSay(String(e.message || "The world could not be reached.").slice(0, 140));
              });
          });
          paintTies();
        } catch (eCh) {}
      }

      // YOUR OWN CLUB WEARS THE NAME IT WAS CHRISTENED WITH AT ITS FOUNDING.
      // The world's register is the only register; a device carrying an older
      // name quietly adopts it rather than offering a choice.
      if (isMine) {
        try {
          var host = document.getElementById("fo-cp-mine");
          try {
            var t = userTeam();
            if (t && name && t.name !== name) { t.name = name; if (typeof saveGame === "function") saveGame(false); }
          } catch (eT) {}
          if (host) {
            host.className = "fo-cp-mineact";
            host.innerHTML = "<a href='#/training'>Training &rsaquo;</a><a href='#/academy'>The academy &rsaquo;</a><a href='#/orders'>The orders &rsaquo;</a><a href='#/squad'>Your squad &rsaquo;</a>";
          }
        } catch (eMine) {}
      }
    };

    // the first stroke starts from everything already in hand - a re-render
    // with warm caches then composes the identical page and paints nothing
    paint(CLUB_CACHE[cid + ":" + slot] || null, SQ_CACHE[cid + ":" + slot] || null, HON_CACHE);
    fetchClub(cid, slot, function (info) { paint(info, SQ_CACHE[cid + ":" + slot], HON_CACHE); });
    fetchSquad(cid, slot, function (sq) { paint(CLUB_CACHE[cid + ":" + slot], sq, HON_CACHE); });
    fetchHonours(function (hon) { paint(CLUB_CACHE[cid + ":" + slot], SQ_CACHE[cid + ":" + slot], hon); });
  };

  function foClubCss() {
    if (document.getElementById("fo-cp-css")) return;
    var s = document.createElement("style"); s.id = "fo-cp-css";
    s.textContent = [
      ".fo-cp{min-height:70vh;--navy:#0C1B33;--gold:#C9A24B;--grn:#1F6F4A;--paper:#F7F3E8;--acc:#B44A22;--ink:#14202F;--mut:#67748a;--edge:rgba(20,32,47,.1)}",
      // ---- THE DASHBOARD (overview) -------------------------------------
      ".fo-cd{max-width:1180px;margin:0 auto;padding:12px 12px 80px;display:flex;flex-direction:column;gap:12px}",
      ".fo-cd,.fo-cd .fo-cd-card,.fo-cd .fo-cd-sh,.fo-cd-slim{text-align:left}",
      "html body #page .fo-cd-bk{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;min-height:44px;padding:0 12px;margin:0 -12px;border-radius:12px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--mut) !important;text-decoration:none !important}",
      ".fo-cd-z1,.fo-cd-z2,.fo-cd-z3{display:grid;grid-template-columns:1fr;gap:12px}",
      ".fo-cd-card{background:#FFFEFC;border:1px solid var(--edge);border-radius:13px;padding:15px 16px;box-shadow:0 1px 2px rgba(14,35,63,.05)}",
      ".fo-cd-sh{display:block;font:600 11.5px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--navy);margin:-15px -16px 13px;padding:12px 16px 11px;background:linear-gradient(0deg,rgba(14,35,63,.03),rgba(14,35,63,.06));border-bottom:1px solid var(--edge);border-radius:12px 12px 0 0}",
      ".fo-cd-sh:before{content:'';display:inline-block;width:7px;height:7px;background:var(--acc);border-radius:2px;margin-right:9px;vertical-align:1px}",
      "html body #page .fo-cd-lnk{display:inline-flex;align-items:center;gap:5px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--acc) !important;margin-top:12px;min-height:34px;text-decoration:none !important}",
      ".fo-cd-lnk:after{content:'\\203A';font-size:14px;line-height:0}",
      ".fo-cd-dim{font:420 12.5px/1.6 Fraunces,Georgia,serif;color:rgba(12,27,51,.55);margin:4px 0 0}",
      ".fo-cd-num,.fo-cd-pos .grid b,.fo-cd-pos .big{font-variant-numeric:tabular-nums}",
      // identity
      ".fo-cd-id .top{display:flex;gap:14px;align-items:center}",
      ".fo-cd-crest{flex:none;width:64px;height:74px;background:var(--navy);clip-path:polygon(0 0,100% 0,100% 70%,50% 100%,0 70%);display:flex;align-items:center;justify-content:center;position:relative}",
      ".fo-cd-crest:before{content:'';position:absolute;inset:3px;clip-path:polygon(0 0,100% 0,100% 69%,50% 100%,0 69%);outline:1.5px solid rgba(200,84,47,.85);outline-offset:-5px}",
      ".fo-cd-crest b{font:700 20px/1 Oswald,sans-serif;color:#F1EEE6;letter-spacing:.04em;padding-bottom:8px}",
      ".fo-cd-crimg{flex:none;width:64px;height:74px;object-fit:contain}",
      ".fo-cd-arms{flex:none;display:inline-flex;align-items:center}",
      ".fo-cd-arms svg{display:block}",
      ".fo-cd-nf .mn.arms{background:none;clip-path:none;width:auto;height:auto}",
      ".fo-cd-id h1{font:700 22px/1.1 Oswald,sans-serif;text-transform:uppercase;letter-spacing:.02em;color:var(--navy);margin:0}",
      ".fo-cd-id .loc{display:flex;align-items:center;gap:7px;margin-top:6px;font:600 10px/1.3 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--acc)}",
      ".fo-cd-id .loc img{width:18px;height:12px;object-fit:cover;border-radius:2px}",
      ".fo-cd-id .meta{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;margin-top:13px;border-top:1px solid var(--edge);padding-top:12px}",
      ".fo-cd-id .meta span{font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:#8a93a2}",
      ".fo-cd-id .meta b{display:block;font:600 12.5px/1.3 Inter,sans-serif;color:var(--ink);margin-top:4px;letter-spacing:0;text-transform:none}",
      ".fo-cd-id .acts{display:flex;gap:9px;margin-top:13px}",
      "html body #page .fo-cd-id .acts a,html body #page .fo-cd-id .acts button{flex:1;display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:9px;font:600 10.5px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;text-decoration:none !important;text-align:center;cursor:pointer}",
      "html body #page .fo-cd-id .acts .pri{background:linear-gradient(180deg,#D06035,#B84E28) !important;color:#FFF6EE !important;border:0 !important;box-shadow:0 2px 6px rgba(176,74,44,.25)}",
      "html body #page .fo-cd-id .acts .sec{border:1.5px solid rgba(14,35,63,.3);color:var(--navy) !important;background:#FFFEFC}",
      ".fo-cd-id .foot{display:flex;border-top:1px solid var(--edge);padding-top:13px;margin-top:14px}",
      ".fo-cd-id .foot .f{flex:1;text-align:center;border-left:1px solid var(--edge);padding:2px 8px}",
      ".fo-cd-id .foot .f:first-child{border-left:0}",
      ".fo-cd-id .foot .f span{font:600 8.5px/1.4 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8a93a2;display:block}",
      ".fo-cd-id .foot .f b{display:block;font:600 13px/1.35 Inter,sans-serif;color:var(--navy);margin-top:3px}",
      // the ground: art first, an intentional panel when unpainted
      ".fo-cd-gr{padding:0;overflow:hidden}",
      ".fo-cd-gr .gwrap{position:relative}",
      ".fo-cd-gr .gwrap img{width:100%;display:block;aspect-ratio:16/10.5;object-fit:cover}",
      ".fo-cd-gr .gov{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:26px 15px 13px;background:linear-gradient(180deg,transparent,rgba(9,18,32,.72) 78%)}",
      ".fo-cd-gr.noart .gwrap{background:linear-gradient(158deg,#12294A,#0C1E36);min-height:150px}",
      ".fo-cd-gr.noart .gov{position:static;background:none;padding:16px 15px 14px;align-items:flex-end;min-height:150px}",
      ".fo-cd-gr .gt{font:600 17px/1.1 Oswald,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#FFFEFC;text-shadow:0 1px 6px rgba(6,12,22,.5)}",
      ".fo-cd-gr .gt u{display:block;text-decoration:none;font:400 11px/1.4 Inter,sans-serif;letter-spacing:0;text-transform:none;color:rgba(248,244,236,.88);margin-top:4px}",
      "html body #page .fo-cd-gr .gd{flex:none;border:1.5px solid rgba(255,254,252,.65);border-radius:9px;padding:10px 12px;font:600 9.5px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#FFFEFC !important;background:rgba(9,18,32,.35);white-space:nowrap;text-decoration:none !important;min-height:38px;display:inline-flex;align-items:center}",
      ".fo-cd-gr .grb{display:flex;justify-content:space-between;gap:10px;padding:11px 15px 12px;background:linear-gradient(0deg,#FBF6EA,#FDFAF2)}",
      ".fo-cd-gr .grb span{font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8a93a2}",
      ".fo-cd-gr .grb b{display:block;font:600 12.5px/1.3 Inter,sans-serif;color:var(--ink);margin-top:4px;letter-spacing:0;text-transform:none}",
      // league position: the navy anchor card
      ".fo-cd-pos{display:flex;align-items:center;gap:12px;background:linear-gradient(158deg,#12294A,#0C1E36);border-color:rgba(14,35,63,.5)}",
      ".fo-cd-pos .lft{flex:none;padding-right:14px;border-right:1px solid rgba(244,239,228,.16)}",
      ".fo-cd-pos .cap{font:600 10px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:rgba(244,239,228,.75)}",
      ".fo-cd-pos .big{font:700 30px/1 Inter,sans-serif;color:#F6F2E8;margin-top:7px}",
      ".fo-cd-pos .big i{font-size:13px;font-style:normal;color:rgba(244,239,228,.5);font-weight:600}",
      ".fo-cd-pos .pts{font:600 10.5px/1 Oswald,sans-serif;letter-spacing:.08em;color:#EBC271;margin-top:6px}",
      ".fo-cd-pos .grid{flex:1;display:flex;justify-content:space-around}",
      ".fo-cd-pos .grid span{font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:rgba(244,239,228,.55);text-align:center}",
      ".fo-cd-pos .grid b{display:block;font:600 14px/1.7 Inter,sans-serif;color:#F6F2E8}",
      "html body #page .fo-cd-pos .vt{flex:none;font:600 10px/1.45 Oswald,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#EBC271 !important;text-align:center;text-decoration:none !important;min-height:44px;display:inline-flex;align-items:center}",
      ".fo-cd-pos .xtra{display:none}",
      // tabs
      ".fo-cd-tabs{display:flex;gap:2px;background:#FFFEFC;border:1px solid var(--edge);border-radius:12px;padding:5px;overflow-x:auto}",
      "html body #page .fo-cd-tabs a{flex:1;text-align:center;padding:12px 8px;border-radius:8px;font:600 10.5px/1 Oswald,sans-serif;letter-spacing:.11em;text-transform:uppercase;color:var(--mut) !important;white-space:nowrap;text-decoration:none !important;min-height:40px;display:inline-flex;align-items:center;justify-content:center}",
      "html body #page .fo-cd-tabs a.on{background:var(--navy);color:#F1EEE6 !important}",
      // next fixture
      ".fo-cd-nf .tag{display:inline-block;background:rgba(176,74,44,.1);border:1px solid rgba(176,74,44,.35);color:var(--acc);border-radius:7px;padding:5px 9px;font:600 9px/1 Oswald,sans-serif;letter-spacing:.13em;text-transform:uppercase;margin-bottom:11px}",
      "html body #page .fo-cd-nf .who{display:flex;align-items:center;gap:12px;text-decoration:none !important}",
      ".fo-cd-nf .mn{flex:none;width:46px;height:53px;background:var(--navy);clip-path:polygon(0 0,100% 0,100% 70%,50% 100%,0 70%);display:flex;align-items:center;justify-content:center}",
      ".fo-cd-nf .mn b{font:700 14px/1 Oswald,sans-serif;color:#F1EEE6;padding-bottom:6px}",
      ".fo-cd-nf h3{font:700 16px/1.15 Oswald,sans-serif;text-transform:uppercase;color:var(--navy);margin:0}",
      ".fo-cd-nf h3 u{display:block;text-decoration:none;font:600 9px/1 Oswald,sans-serif;letter-spacing:.12em;color:#8a93a2;margin-top:5px}",
      ".fo-cd-nf .det{display:grid;grid-template-columns:1fr 1fr;gap:9px 14px;margin-top:13px;border-top:1px solid var(--edge);padding-top:12px}",
      ".fo-cd-nf .det span{font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8a93a2}",
      ".fo-cd-nf .det b{display:block;font:600 12.5px/1.35 Inter,sans-serif;color:var(--ink);margin-top:4px;letter-spacing:0;text-transform:none}",
      ".fo-cd-nf .h2h{font:400 11.5px/1.5 Inter,sans-serif;color:var(--mut);margin-top:11px}",
      "html body #page .fo-cd-nf .vf{display:flex;align-items:center;justify-content:center;margin-top:12px;min-height:42px;border-radius:9px;background:var(--navy);color:#F1EEE6 !important;font:600 10.5px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;text-decoration:none !important}",
      ".fo-cd-nf .thn{font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:#8a93a2;margin:14px 0 3px}",
      "html body #page .fo-cd-nf .ur{display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid rgba(20,32,47,.05);text-decoration:none !important}",
      ".fo-cd-nf .ur:last-of-type{border-bottom:0}",
      ".fo-cd-nf .ur .d{flex:none;width:52px;font:600 9.5px/1.35 Oswald,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:var(--acc)}",
      ".fo-cd-nf .ur .o{font:500 12px/1.35 Inter,sans-serif;color:var(--ink);min-width:0}",
      ".fo-cd-nf .ur .o em{font-style:normal;color:#8a93a2;font-size:10px}",
      ".fo-cd-nf .ur .c{margin-left:auto;font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#F1EEE6;background:#41577A;border-radius:6px;padding:5px 7px;white-space:nowrap}",
      // recent form
      ".fo-cd-rf .r{display:flex;align-items:baseline;gap:10px;padding:9px 0;border-bottom:1px solid rgba(20,32,47,.05)}",
      ".fo-cd-rf .r:last-of-type{border-bottom:0}",
      ".fo-cd-rf i,.fo-cd-pos .fx i{align-self:center;width:22px;height:22px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font:700 10px/1 Inter,sans-serif;font-style:normal;flex:none;color:#fff}",
      ".fo-cd-rf i.w,.fo-cd-pos .fx i.w{background:#1F7A50}",
      ".fo-cd-rf i.l,.fo-cd-pos .fx i.l{background:#B23230}",
      ".fo-cd-rf i.t,.fo-cd-pos .fx i.t{background:#8a6d3b}",
      ".fo-cd-rf .who{font:500 12.5px/1.35 Inter,sans-serif;color:var(--ink);min-width:0}",
      ".fo-cd-rf .who em{font-style:normal;color:#8a93a2;font-size:10.5px}",
      ".fo-cd-rf .sc{margin-left:auto;text-align:right;font:400 11px/1.4 Inter,sans-serif;color:#5b6879;max-width:46%}",
      // diary
      ".fo-cd-di .r{display:flex;gap:12px;padding:8.5px 0;border-bottom:1px solid rgba(20,32,47,.05)}",
      ".fo-cd-di .r:last-of-type{border-bottom:0}",
      ".fo-cd-di .d{flex:none;width:42px;font:600 9.5px/1.7 Oswald,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--acc)}",
      ".fo-cd-di p{font:400 12px/1.5 Inter,sans-serif;color:#33415a;margin:0;min-width:0}",
      "html body #page .fo-cd-di p a{color:var(--acc) !important;text-decoration:none !important;font-weight:600}",
      // competitions
      "html body #page .fo-cd-cmp .r{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(20,32,47,.05);text-decoration:none !important;color:inherit}",
      ".fo-cd-cmp .r:last-of-type{border-bottom:0}",
      ".fo-cd-cmp .nm{font:500 12.5px/1.35 Inter,sans-serif;color:var(--ink)}",
      ".fo-cd-cmp .st{margin-left:auto;display:flex;align-items:center;gap:7px;white-space:nowrap}",
      ".fo-cd-cmp .st u{text-decoration:none;font:600 10.5px/1 Inter,sans-serif;background:var(--navy);color:#F1EEE6;border-radius:7px;padding:5px 8px}",
      ".fo-cd-cmp .st u.off{background:rgba(20,32,47,.07);color:#67748a}",
      ".fo-cd-cmp .st em{font-style:normal;font:400 10.5px/1 Inter,sans-serif;color:#8a93a2}",
      "html body #page .fo-cd-cmp a.r em{color:var(--acc);font-weight:600}",
      // squad snapshot
      ".fo-cd-sn .snap{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}",
      ".fo-cd-sn .snap .r{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid rgba(20,32,47,.05);font:400 12px/1.35 Inter,sans-serif;color:#55617a}",
      ".fo-cd-sn .snap .r b{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}",
      // honours
      ".fo-cd-hn .r{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(20,32,47,.05);font:500 12.5px/1.4 Inter,sans-serif;color:var(--ink)}",
      ".fo-cd-hn .r:last-of-type{border-bottom:0}",
      ".fo-cd-hn .r em{font-style:normal;font:400 10.5px/1 Inter,sans-serif;color:#8a93a2}",
      ".fo-cd-hn .r b{margin-left:auto;font-weight:700}",
      "html body #page .fo-cd-hn .hnFoot{margin-top:9px;padding-top:9px;border-top:1px solid rgba(20,28,40,.08);font:500 11px/1.45 Inter,sans-serif;color:rgba(20,28,40,.45);font-variant-numeric:tabular-nums}",
      ".fo-cd-hn .hnE{font:400 12.5px/1.6 Inter,sans-serif;color:#6d6350;background:#FBF6EA;border:1px dashed rgba(176,74,44,.25);border-radius:10px;padding:13px 14px}",
      // the club's story: a desktop ribbon, absent from the phone's first scroll
      ".fo-cd-tl{display:none}",
      // slim head for the inner tabs
      ".fo-cd-slim{display:flex;align-items:center;gap:13px}",
      ".fo-cd-slim .fo-cd-crest{width:46px;height:53px}",
      ".fo-cd-slim .fo-cd-crest b{font-size:15px;padding-bottom:6px}",
      ".fo-cd-slim .fo-cd-crimg{width:46px;height:53px}",
      ".fo-cd-slim h1{font:700 19px/1.1 Oswald,sans-serif;text-transform:uppercase;color:var(--navy);margin:0}",
      ".fo-cd-slim i{display:block;font:600 9.5px/1.4 Oswald,sans-serif;font-style:normal;letter-spacing:.12em;text-transform:uppercase;color:#8a93a2;margin-top:4px}",
      // the desktop's editorial grid
      "@media(min-width:900px){",
      ".fo-cd{padding:16px 16px 80px;gap:14px}",
      ".fo-cd-z1{grid-template-columns:1.1fr 1.55fr .75fr;gap:14px}",
      ".fo-cd-z2{grid-template-columns:1fr 1fr 1.15fr;gap:14px}",
      ".fo-cd-z3{grid-template-columns:1fr 1.15fr 1fr;gap:14px}",
      ".fo-cd-id{display:flex;flex-direction:column}",
      ".fo-cd-id .foot{margin-top:auto}",
      ".fo-cd-id h1{font-size:27px}",
      ".fo-cd-gr{display:flex;flex-direction:column}",
      ".fo-cd-gr .gwrap{flex:1;min-height:0;display:flex}",
      ".fo-cd-gr .gwrap img{flex:1;min-height:0;aspect-ratio:auto}",
      ".fo-cd-gr .grb{flex:none}",
      ".fo-cd-pos{flex-direction:column;align-items:stretch;text-align:center;justify-content:flex-start;gap:0}",
      ".fo-cd-pos .lft{border-right:0;border-bottom:1px solid rgba(244,239,228,.16);padding:0 0 13px}",
      ".fo-cd-pos .big{font-size:34px}",
      ".fo-cd-pos .grid{flex:none;padding:13px 0;border-bottom:1px solid rgba(244,239,228,.16)}",
      ".fo-cd-pos .xtra{display:block;flex:1;padding-top:13px}",
      ".fo-cd-pos .xtra .fl{font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:rgba(244,239,228,.55);margin-bottom:9px}",
      ".fo-cd-pos .xtra .fx{display:flex;justify-content:center;gap:6px}",
      ".fo-cd-pos .xtra .gap{font:400 11.5px/1.55 Inter,sans-serif;color:rgba(244,239,228,.66);margin-top:13px}",
      "html body #page .fo-cd-pos .vt{display:flex;align-items:center;justify-content:center;min-height:40px;border:1.5px solid rgba(235,194,113,.45);border-radius:9px;margin-top:12px}",
      ".fo-cd-tl{display:block}",
      ".fo-cd-tl .tl{position:relative;display:flex;justify-content:flex-start;gap:110px;margin-top:8px}",
      ".fo-cd-tl .tl:before{content:'';position:absolute;left:1.5%;right:30%;top:calc(100% - 4px);height:1.5px;background:rgba(20,32,47,.12)}",
      ".fo-cd-tl .m{text-align:center;position:relative;padding-bottom:18px;max-width:200px}",
      ".fo-cd-tl .m:after{content:'';position:absolute;left:50%;bottom:-7px;transform:translateX(-50%);width:8px;height:8px;border-radius:50%;background:var(--gold)}",
      ".fo-cd-tl .m b{display:block;font:600 13px/1 Oswald,sans-serif;letter-spacing:.04em;color:var(--ink)}",
      ".fo-cd-tl .m span{display:block;font:400 11px/1.45 Inter,sans-serif;color:var(--mut);margin-top:5px}",
      "}",
      ".fo-cp-panel{background:var(--paper);border:1px solid rgba(12,27,51,.14);border-radius:14px;padding:20px 22px 24px;box-shadow:0 10px 28px rgba(12,27,51,.08)}",
      ".fo-cp-ico{width:19px;height:22px;object-fit:contain;opacity:.72}",
      ".fo-cp-ph{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:16px}",
      ".fo-cp-ph h2{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:26px;color:var(--navy);margin:0}",
      ".fo-cp-full{font:600 10.5px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(12,27,51,.5)}",
      ".fo-cp-full b{color:var(--grn);margin-left:5px}",
      ".fo-cp-tools{margin-left:auto}",
      "html body #page .fo-cp-tools select{background:#FFFDF7 !important;color:var(--navy) !important;border:1px solid rgba(12,27,51,.18);border-radius:8px;padding:9px 12px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;-webkit-appearance:menulist;appearance:menulist}",
      ".fo-cp-star{position:relative;display:flex;align-items:stretch;gap:14px;background:linear-gradient(150deg,#16452F,#0E2C1F);border:2px solid var(--gold);border-radius:12px;padding:14px 16px;margin-bottom:16px;overflow:hidden;min-height:140px}",
      ".fo-cp-face{position:absolute;left:0;top:0;height:100%;width:126px;object-fit:cover;object-position:top center;-webkit-mask-image:linear-gradient(90deg,#000 55%,transparent);mask-image:linear-gradient(90deg,#000 55%,transparent)}",
      ".fo-cp-starin{position:relative;z-index:2;margin-left:124px;display:flex;flex-direction:column;justify-content:center;gap:5px;min-width:0}",
      ".fo-cp-starn{display:flex;align-items:center;gap:8px}",
      ".fo-cp-starn img{width:19px;height:13px;object-fit:cover;border-radius:2px}",
      ".fo-cp-starn b{font:700 22px/1.1 Oswald,sans-serif;color:#FFFDF7;text-transform:uppercase}",
      ".fo-cp-starr{font:500 12.5px/1.3 Inter,sans-serif;color:rgba(255,253,247,.7)}",
      ".fo-cp-starf{display:flex;align-items:center;gap:9px;margin-top:2px}",
      ".fo-cp-starf i{font:600 9px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,253,247,.5);font-style:normal}",
      ".fo-cp-dots{display:inline-flex;gap:4px}",
      ".fo-cp-dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,253,247,.22);display:block}",
      ".fo-cp-dots i.on{background:#4FBF85}",
      ".fo-cp-sale{display:inline-block;font:700 7.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#7A5210;background:linear-gradient(120deg,#F3DFA9,#E8B96A);border-radius:5px;padding:3.5px 6px;vertical-align:2px;margin-left:7px;white-space:nowrap}",
      ".fo-cp-startags{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}",
      ".fo-cp-startags em{font-style:normal;font:700 9px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#BFE8CF;background:rgba(79,191,133,.18);border:1px solid rgba(79,191,133,.34);border-radius:6px;padding:5px 8px}",
      ".fo-cp-starnums{position:relative;z-index:2;margin-left:auto;display:flex;align-items:center;gap:22px;padding-left:16px}",
      ".fo-cp-starovr,.fo-cp-starval{text-align:right}",
      ".fo-cp-starovr i,.fo-cp-starval i{display:block;font:600 9px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,253,247,.5);font-style:normal}",
      ".fo-cp-starovr b{display:block;font:700 42px/1 Inter,sans-serif;color:var(--gold);font-variant-numeric:tabular-nums}",
      ".fo-cp-starval b{display:block;font:700 17px/1.2 Oswald,sans-serif;color:#FFFDF7;margin-top:4px}",
      ".fo-cp-cols,.fo-cp-row{display:grid;grid-template-columns:30px 34px minmax(0,1fr) 54px 78px 54px 70px;gap:10px;align-items:center}",
      ".fo-cp-cols{padding:0 12px 8px;font:600 9px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(12,27,51,.42);text-align:center}",
      ".fo-cp-cols span:nth-child(3){text-align:left}",
      ".fo-cp-row{background:#FFFDF7;border:1px solid rgba(12,27,51,.09);border-radius:10px;padding:11px 12px;margin-bottom:6px;text-decoration:none;color:inherit;transition:border-color .14s ease,transform .12s ease}",
      "html body #page a.fo-cp-row{color:#0C1B33;text-decoration:none}",
      "html body #page a.fo-cp-row:hover{border-color:rgba(201,162,75,.7);transform:translateY(-1px);text-decoration:none}",
      "html body #page a.fo-cp-star{text-decoration:none;color:inherit}",
      "html body #page a.fo-cp-star:hover{text-decoration:none}",
      ".fo-cp-row .rk{font:600 12px/1 Oswald,sans-serif;color:rgba(12,27,51,.4);text-align:center}",
      ".fo-cp-row .rl{width:30px;height:30px;border-radius:50%;background:rgba(31,111,74,.1);display:flex;align-items:center;justify-content:center}",
      ".fo-cp-row .nm{min-width:0}",
      ".fo-cp-row .nm b{display:block;font:700 14px/1.2 Oswald,sans-serif;color:var(--navy);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-cp-row .nm i{display:block;font:400 11px/1.3 Inter,sans-serif;font-style:normal;color:rgba(12,27,51,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-cp-row .ov{font:700 19px/1 Inter,sans-serif;color:var(--grn);text-align:center;font-variant-numeric:tabular-nums}",
      ".fo-cp-row .fm{display:flex;gap:4px;justify-content:center}",
      ".fo-cp-row .fm i{width:7px;height:7px;border-radius:50%;background:rgba(12,27,51,.14);display:block}",
      ".fo-cp-row .fm i.on{background:#2E8B5E}",
      ".fo-cp-row .hd,.fo-cp-row .wg{font:600 11.5px/1 Oswald,sans-serif;color:rgba(12,27,51,.62);text-align:center}",
      ".fo-cp-row .wg{color:var(--navy)}",
      ".fo-cp-sub{font:600 10px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(12,27,51,.45);margin:20px 0 10px}",
      ".fo-cp-r{display:grid;grid-template-columns:38px minmax(0,1fr);gap:2px 10px;padding:9px 2px;border-top:1px solid rgba(12,27,51,.08);text-decoration:none;color:var(--navy)}",
      ".fo-cp-r i{grid-row:span 2;font:700 10px/1 Oswald,sans-serif;color:rgba(12,27,51,.38);font-style:normal;padding-top:3px}",
      ".fo-cp-r b{font:600 13px/1.35 Inter,sans-serif}",
      ".fo-cp-r span{font:420 12px/1.4 Fraunces,Georgia,serif;color:rgba(12,27,51,.6)}",
      ".fo-cp-r.w b{color:var(--grn)}.fo-cp-r.l b{color:#B23230}",
      ".fo-cp-form{display:inline-flex;gap:5px}",
      ".fo-cp-form i{font-style:normal;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;font:700 10px/1 Oswald,sans-serif;color:#FFFDF7}",
      ".fo-cp-form i.w{background:var(--grn)}.fo-cp-form i.l{background:#B23230}.fo-cp-form i.t{background:#8a6d3b}",
      ".fo-cp-note{font:500 13px/1.6 Inter,sans-serif;color:var(--navy);padding:3px 0}",
      ".fo-cp-note u{text-decoration:none;font:420 12px/1.5 Fraunces,Georgia,serif;color:rgba(12,27,51,.55)}",
      ".fo-cp-note u{display:block;margin-top:3px;font-variant-numeric:tabular-nums}",
      ".fo-cp-dim{font:420 13px/1.6 Fraunces,Georgia,serif;color:rgba(12,27,51,.55);margin:6px 0 0}",
      ".fo-cp-dim.foot{margin-top:14px;padding-top:12px;border-top:1px solid rgba(12,27,51,.08)}",
      // the challenge: one line of paper above the tabs, the same stock the
      // panel beneath it is printed on
      ".fo-cp-ch{background:var(--paper);border:1px solid rgba(12,27,51,.14);border-left:3px solid #C8542F;border-radius:12px;padding:13px 15px;margin-bottom:12px}",
      ".fo-cp-chh{font:700 11px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--navy)}",
      ".fo-cp-chrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}",
      "html body #page .fo-cp-chrow input{flex:1 1 190px;min-width:0;background:#FFFDF7 !important;color:var(--navy) !important;border:1px solid rgba(12,27,51,.2);border-radius:9px;padding:10px 11px;min-height:44px;font:600 12.5px/1 Inter,sans-serif}",
      "html body #page .fo-cp-chrow button{font:700 11px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#FFFDF7 !important;background:linear-gradient(180deg,#E8894A,#C8542F) !important;border:0 !important;border-radius:9px !important;padding:12px 20px !important;min-height:44px;cursor:pointer}",
      "html body #page .fo-cp-chrow button:disabled{opacity:.55;cursor:default}",
      ".fo-cp-chmsg{margin-top:8px;font:500 11.5px/1.5 Inter,sans-serif;color:rgba(12,27,51,.6)}",
      ".fo-cp-chtz{margin-top:7px;font:600 11.5px/1.5 Inter,sans-serif;color:#14243A}",
      ".fo-cp-chtz b{color:#C9571F}",
      ".fo-cp-fr{display:flex;align-items:center;gap:9px;flex-wrap:wrap;border-top:1px solid rgba(12,27,51,.09);margin-top:9px;padding-top:9px}",
      ".fo-cp-fr b{font:600 12.5px/1.3 Inter,sans-serif;color:var(--navy)}",
      ".fo-cp-fr i{font-style:normal;font:500 11.5px/1.3 Inter,sans-serif;color:rgba(12,27,51,.55)}",
      ".fo-cp-fr.on i{color:var(--grn)}",
      ".fo-cp-fr.dim{opacity:.5}",
      ".fo-cp-fr span{margin-left:auto;display:inline-flex;gap:6px}",
      "html body #page .fo-cp-fr button{font:700 10px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--navy) !important;background:#FFFDF7 !important;border:1px solid rgba(12,27,51,.22) !important;border-radius:999px !important;padding:9px 13px !important;min-height:44px;cursor:pointer}",
      "html body #page .fo-cp-fr .fo-cp-fyes,html body #page .fo-cp-fr .fo-cp-fwatch{color:#FFFDF7 !important;background:var(--grn) !important;border-color:var(--grn) !important}",
      // the ground: a plate of facts, a forecast, and the field guide to what
      // each strip does to a match
      ".fo-cp-gkvs{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}",
      ".fo-cp-gkv{background:#FFFDF7;border:1px solid rgba(12,27,51,.1);border-radius:10px;padding:10px 12px}",
      ".fo-cp-gkv span{display:block;font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(12,27,51,.45)}",
      ".fo-cp-gkv b{display:block;margin-top:5px;font:600 14px/1.3 Inter,sans-serif;color:var(--navy)}",
      "html body #page .fo-cp-glink{display:block;margin-top:12px;padding:12px 14px;background:#FFFDF7 !important;border:1px solid rgba(12,27,51,.14);border-left:3px solid var(--gold);border-radius:11px;font:600 12.5px/1.4 Inter,sans-serif;color:var(--navy) !important;text-decoration:none !important}",
      ".fo-cp-gfr{display:grid;grid-template-columns:34px minmax(0,1fr) 96px 84px;gap:10px;align-items:center;padding:9px 2px;border-bottom:1px solid rgba(12,27,51,.07)}",
      ".fo-cp-gfr .r{font:700 10.5px/1 Oswald,sans-serif;color:rgba(12,27,51,.4)}",
      ".fo-cp-gfr .o{font:600 13px/1.3 Inter,sans-serif;color:var(--navy);min-width:0}",
      ".fo-cp-gfr .o i{display:block;font-style:normal;font:400 11px/1.3 Inter,sans-serif;color:rgba(12,27,51,.5)}",
      ".fo-cp-gfr .p{font:700 11px/1 Oswald,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--grn);text-align:right}",
      ".fo-cp-gfr .w{font:500 12px/1.3 Inter,sans-serif;color:rgba(12,27,51,.62);text-align:right}",
      ".fo-cp-gpr{padding:10px 12px;border:1px solid rgba(12,27,51,.09);border-radius:10px;margin-bottom:7px;background:#FFFDF7}",
      ".fo-cp-gpr.on{border-color:rgba(201,162,75,.6);background:#FFFBEF}",
      ".fo-cp-gpr b{display:flex;align-items:center;gap:8px;font:700 12.5px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--navy)}",
      ".fo-cp-gpr b u{text-decoration:none;font:700 9px/1 Oswald,sans-serif;letter-spacing:.1em;color:#7A5B12;background:rgba(201,162,75,.22);border-radius:999px;padding:4px 8px}",
      ".fo-cp-gpr span{display:block;margin-top:5px;font:400 12.5px/1.5 Inter,sans-serif;color:var(--navy)}",
      ".fo-cp-gpr em{display:block;margin-top:3px;font-style:normal;font:400 11.5px/1.45 Inter,sans-serif;color:rgba(12,27,51,.55)}",
      "@media(max-width:760px){.fo-cp-gfr{grid-template-columns:30px minmax(0,1fr) 76px;gap:8px}",
      ".fo-cp-gfr .w{grid-column:2/4;text-align:right;margin-top:-4px;font-size:11px}}",
      // the transfer register: six figures across the top, then the deals
      ".fo-cp-trsum{display:grid;grid-template-columns:repeat(auto-fit,minmax(126px,1fr));gap:8px;margin-bottom:14px}",
      ".fo-cp-trk{background:#FFFDF7;border:1px solid rgba(12,27,51,.1);border-radius:10px;padding:9px 11px}",
      ".fo-cp-trk span{display:block;font:600 8px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(12,27,51,.45)}",
      ".fo-cp-trk b{display:block;margin-top:5px;font:700 16px/1.15 Inter,sans-serif;color:var(--navy);font-variant-numeric:tabular-nums}",
      ".fo-cp-trk.up b{color:var(--grn)}.fo-cp-trk.dn b{color:#B23230}",
      ".fo-cp-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;padding:0 4px}",
      "html body #page table.fo-cp-tr{border-collapse:collapse;width:100%;min-width:560px;font-variant-numeric:tabular-nums}",
      "html body #page table.fo-cp-tr th{background:var(--navy);color:#FFFDF7;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;text-align:right;padding:9px 7px;white-space:nowrap}",
      "html body #page table.fo-cp-tr th.nm{text-align:left}",
      "html body #page table.fo-cp-tr td{padding:8px 7px;text-align:right;white-space:nowrap;font:600 12px/1.2 Oswald,sans-serif;color:#141C28;border-bottom:1px solid rgba(12,27,51,.07)}",
      "html body #page table.fo-cp-tr td.nm{text-align:left;font-family:Inter,sans-serif;font-weight:500;font-size:12.5px;white-space:normal}",
      "html body #page table.fo-cp-tr td.dt{font-weight:400;color:rgba(12,27,51,.55)}",
      "html body #page table.fo-cp-tr td.nm a{color:#B44A22 !important;text-decoration:none !important;font-weight:600}",
      "html body #page table.fo-cp-tr td.wy{font:700 9px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;text-align:left}",
      "html body #page table.fo-cp-tr tr.in td.wy{color:#B23230}",
      "html body #page table.fo-cp-tr tr.out td.wy{color:var(--grn)}",
      "html body #page table.fo-cp-tr tr.in td.fe{color:#B23230}",
      "html body #page table.fo-cp-tr tr.out td.fe{color:var(--grn)}",
      "html body #page table.fo-cp-tr tbody tr:nth-child(even){background:rgba(12,27,51,.022)}",
      // the diary: a day rule, then a line an hour at a time
      ".fo-cp-evday{margin:14px -22px 0;padding:8px 22px;background:rgba(12,27,51,.05);font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--navy)}",
      ".fo-cp-panel .fo-cp-evday:first-child{margin-top:0}",
      ".fo-cp-ev{display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px;align-items:baseline;padding:9px 0;border-bottom:1px solid rgba(12,27,51,.07)}",
      ".fo-cp-ev .t{font:600 11px/1.4 Inter,sans-serif;color:rgba(12,27,51,.42);font-variant-numeric:tabular-nums}",
      ".fo-cp-ev .w{font:400 13px/1.55 Inter,sans-serif;color:var(--navy)}",
      "html body #page .fo-cp-ev .w a{color:#B44A22 !important;text-decoration:none !important;font-weight:600}",
      "html body #page .fo-cp-ev .w a:hover{text-decoration:underline !important}",
      ".fo-cp-ev.match .w{font-weight:500}",
      ".fo-cp-ev.orders .w,.fo-cp-ev.scouted .w{color:rgba(12,27,51,.6)}",
      "@media(max-width:760px){.fo-cp-evday{margin:12px -12px 0;padding:7px 12px}",
      ".fo-cp-ev{grid-template-columns:38px minmax(0,1fr);gap:8px}}",
      ".fo-cp-mineact{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}",
      "html body #page .fo-cp-mineact a{font:600 11px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#B44A22 !important;background:#FFFDF7;border:1px solid rgba(12,27,51,.14);border-radius:999px;padding:9px 14px;text-decoration:none !important}",
      "html body #page .fo-cp-cta{display:block;text-align:center;font:700 12px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#FFFDF7 !important;background:linear-gradient(180deg,#E8894A,#C8542F);border-radius:12px;padding:14px;text-decoration:none !important;box-shadow:0 10px 26px rgba(200,84,47,.3);margin:14px 0 10px}",
      ".fo-cp-foot{display:flex;justify-content:space-between;gap:10px;padding:8px 4px}",
      "html body #page .fo-cp-foot a{display:inline-flex;align-items:center;min-height:44px;padding:0 13px;margin:0 -13px;border-radius:12px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#B44A22 !important;text-decoration:none !important}",
      "@media(max-width:760px){",
      ".fo-cp-panel{padding:15px 12px 20px;border-radius:12px}",
      ".fo-cp-ph h2{font-size:20px}.fo-cp-tools{margin-left:0;width:100%}",
      "html body #page .fo-cp-tools select{width:100%}",
      ".fo-cp-star{min-height:0;padding:12px;flex-wrap:wrap}",
      ".fo-cp-face{width:92px}.fo-cp-starin{margin-left:88px}",
      ".fo-cp-starn b{font-size:17px}",
      ".fo-cp-starnums{margin-left:88px;gap:18px;padding-left:0;width:100%;justify-content:flex-start;margin-top:8px}",
      ".fo-cp-starovr,.fo-cp-starval{text-align:left}",
      ".fo-cp-starovr b{font-size:30px}",
      ".fo-cp-cols{display:none}",
      ".fo-cp-row{grid-template-columns:22px 28px minmax(0,1fr) 40px 46px;gap:8px}",
      ".fo-cp-row .fm,.fo-cp-row .hd{display:none}",
      ".fo-cp-row .ov{font-size:17px}}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
