// ---- 44-feed-match.js — THE LIVE FEED (#/feed?n=rid&f=fi) -------------------
// From The Pavilion's law, client side: the match was simulated on the server
// at the first ball, so the live page is a READER, not an engine. One fetch of
// the umpire's banked ball-by-ball, each delivery revealed on the world clock,
// and every number on screen printed by the umpire himself - the end-of-over
// rows carry the running score, the batters' tallies and the bowlers' figures,
// the fall-of-wicket rows carry the partnerships, and the innings-break row
// carries the target. From those prints alone the page keeps a LIVE SCORECARD,
// the worm and the manhattan, the partnership ladder and the filed teamsheets.
// The dress is a broadcast stage over the home ground's own artwork, a
// timeline of the umpire's book, and the situation at the crease beside it.
// Nothing simulated, nothing invented: arithmetic on the umpire's numbers.
(function () {
  "use strict";
  if (window.__foFeed) return; window.__foFeed = 1;
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  var SB = "https://egaipdksvztqqgouriyc.supabase.co";
  var KEY = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  function P() { return window.__foPlanet || null; }
  function qs() {
    var q = {}, m = (location.hash || "").split("?")[1] || "";
    m.split("&").forEach(function (kv) { var p2 = kv.split("="); if (p2[0]) q[p2[0]] = decodeURIComponent(p2[1] || ""); });
    return q;
  }
  var LOGS = {};                                     // one fetch per match, kept
  function logFetch(nat, id, fresh) {
    var k = nat + "|" + id;
    if (LOGS[k] && !fresh) return LOGS[k];
    var pr = fetch(SB + "/rest/v1/rpc/world_match_log", {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + KEY, "content-type": "application/json" },
      body: JSON.stringify({ p_country: nat, p_match_id: id })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.log && j.log.length) ? j.log.slice().reverse() : null; })   // chronological
      .catch(function () { return null; });
    LOGS[k] = pr;
    return pr;
  }
  // the outcome circle, one coding everywhere: gold for a boundary, wicket
  // red for a wicket, quiet rings for the rest
  function ring(o) {
    var wk = o && o[0] === "w" && o !== "wide";
    var cls = (o === "4" || o === "6") ? " b" : wk ? " w" : "";
    var sym = o === "dot" ? "&middot;" : wk ? "W" : o === "wide" ? "wd" : o === "noball" ? "nb" : (o === "bye" || o === "legbye") ? "b" : E(o);
    return "<i class='" + cls.trim() + "'>" + sym + "</i>";
  }
  // THE FIELDING, NAMED. The engine prints a fixed vocabulary for work in
  // the field - 'Brilliant stop by', 'Rocket Arm!', 'Misfield by', 'Fumble
  // from', 'DROPPED!', 'Stumping chance missed' - and the wicket codes name
  // the catches, run outs and stumpings. Each phrase becomes a tag on the
  // delivery, and the fielding filter can serve them apart.
  function fldTag(r) {
    var t = (r && r.txt) || "", o = r && r.out;
    if (o === "wRO") return { k: "ro", lbl: "RUN OUT", good: 1 };
    if (o === "wST") return { k: "ro", lbl: "STUMPED", good: 1 };
    if (o === "wC") return { k: "ct", lbl: "CATCH", good: 1 };
    if (/Stumping chance missed/i.test(t)) return { k: "ms", lbl: "MISSED STUMPING", good: 0 };
    if (/DROPPED!/i.test(t)) return { k: "ms", lbl: "DROPPED CATCH", good: 0 };
    if (/Misfield by|Fumble from/i.test(t)) return { k: "ms", lbl: "MISFIELD", good: 0 };
    if (/Brilliant stop|Rocket Arm|attacks the ball/i.test(t)) return { k: "gr", lbl: "GREAT FIELDING", good: 1 };
    return null;
  }
  // "End of over 12 (5 runs) - Yorkshire 61/2. ..." -> the umpire's own score
  function parseTop(txt) {
    var m = /End of over (\d+)\s*\((\d+) runs?[^)]*\)[^-]*-\s*(.+?)\s+(\d+)\/(\d+)\./.exec(txt || "");
    return m ? { over: +m[1], ovRuns: +m[2], team: m[3], runs: +m[4], wkts: +m[5] } : null;
  }
  // the umpire's who-line: "<strong>N. Dunn</strong> 44 (57b), ... <strong>
  // J. Mercer (rfm)</strong> 7-24-2" -> the men at the crease and the bowler
  function parseWho(oversumTop) {
    var out = { bats: [], bowl: null };
    String(oversumTop || "").split(/,\s*(?=<strong>)/).forEach(function (seg) {
      var f = /<strong>([^<]+?)<\/strong>\s*(\d+)-(\d+)-(\d+)\s*$/.exec(seg);
      if (f) { out.bowl = { nm: f[1], o: +f[2], r: +f[3], w: +f[4] }; return; }
      var b = /<strong>([^<]+?)<\/strong>\s*(\d+)\s*\((\d+)b\)/.exec(seg);
      if (b) out.bats.push({ nm: b[1], r: +b[2], b: +b[3] });
    });
    return out;
  }
  function surname(nm) { var p = String(nm || "").replace(/\s*\([^)]*\)\s*$/, "").trim().split(/\s+/); return p[p.length - 1] || ""; }
  function bKey(nm) { var c = String(nm || "").trim(); return (c[0] || "").toLowerCase() + "|" + surname(c).toLowerCase(); }
  var HOW = { wB: "bowled", wC: "caught", wLBW: "lbw", wRO: "run out", wST: "stumped" };
  // the home ground's own artwork, resolved by the scorecard module's shared
  // helper; no art of our own - a missing city simply keeps the navy
  function stageArt(city) {
    try { return window.foGroundArtUrl ? window.foGroundArtUrl(city) : null; } catch (e) { return null; }
  }
  // THE INTERNATIONAL'S STAR, the same mark every other surface wears. The
  // umpire's who-line abbreviates a man ("N. Dunn") while the named fifteen
  // holds his full name, so an abbreviation is expanded against the squad
  // before asking the game's own star renderer - never a star by guesswork.
  function pstar(nm, rid) {
    try {
      if (!nm || !window.foNatStar) return "";
      var full = String(nm).replace(/\s*\([^)]*\)\s*$/, "").trim();
      var direct = window.foNatStar(full, null, { rid: rid });
      if (direct) return direct;
      var ab = /^([A-Za-z])\.\s+(.+)$/.exec(full);
      if (!ab) return "";
      var L = window.__foWorldLg; if (!L) return "";
      var b = L.get ? L.get(rid) : null;
      var sq = (b && b.nat && b.nat.squad) || [];
      for (var i = 0; i < sq.length; i++) {
        var n9 = (sq[i] && sq[i].name) || "";
        if (n9 && n9[0].toLowerCase() === ab[1].toLowerCase() && surname(n9).toLowerCase() === ab[2].toLowerCase())
          return window.foNatStar(n9, null, { rid: rid }) || "";
      }
      return "";
    } catch (e) { return ""; }
  }

  // ---- ONE PASS DOWN THE BOOK: everything the panels need, per innings -----
  // ---- WHAT A DELIVERY WAS WORTH ------------------------------------------
  // The umpire prints a tally at the end of each over and nothing in between,
  // so any score read off his last summary stands still for up to six balls.
  // These are his own codes; summing them across a completed match reproduces
  // every one of his over tallies exactly, both innings, so this is reading
  // the book rather than guessing at it. A code it cannot read counts nothing,
  // which leaves the score short rather than inventing runs.
  function ballRuns(r) {
    var o = r && r.out, t = (r && r.txt) || "";
    if (!o) return 0;
    if (/^[0-9]+$/.test(o)) return +o;
    if (o === "dot") return 0;
    if (o === "wide") return /\bfour\b/i.test(t) ? 5 : 1;
    if (o === "noball") return /\bsix\b/i.test(t) ? 7 : /\bfour\b/i.test(t) ? 5 : 1;
    if (o === "bye" || o === "legbye") return /\bfour\b/i.test(t) ? 4 : /\btwo\b/i.test(t) ? 2 : 1;
    return 0;                                   // a wicket, and no run with it
  }
  function isWicket(r) { return !!(r && r.out && r.out[0] === "w" && r.out !== "wide"); }

  function bookState(seen) {
    var mk = function () { return { bats: [], byKey: {}, bowls: [], bowlByKey: {}, exBy: {}, overs: [], fow: [], top: null, who: null, team: null, brk: null, target: null, striker: null, bowler: null, sinceTop: [], open: false, lastNo: null, pshipBalls: 0 }; };
    var inns = [mk(), mk()], pendingWk = null;
    for (var i = 0; i < seen.length; i++) {
      var r = seen[i]; if (!r) continue;
      var I = inns[(r.inn | 0) === 1 ? 1 : 0];
      // the umpire's opening line names the day: the weather, the pitch and
      // who called the toss right - it becomes the stage's conditions line
      if (r.out === "▶" && !inns.meta) {
        var cw = /with (.+?) conditions and an? (.+?) pitch/.exec(r.txt || "");
        var ct = /([A-Za-z0-9 '&-]+?) won the toss and chose to (\w+)/.exec(r.txt || "");
        if (cw || ct) inns.meta = { wx: cw && cw[1], pitch: cw && cw[2], tossWin: ct && ct[1].trim(), tossDo: ct && ct[2] };
      }
      if (r._top) {
        I.top = r; I.sinceTop = [];
        var tp = parseTop(r.txt);
        if (tp) { I.team = tp.team; I.overs.push(tp); }
        var w9 = parseWho(r.oversumTop);
        I.who = w9;
        w9.bats.forEach(function (b9) {
          var k = bKey(b9.nm), e = I.byKey[k];
          if (!e) { e = { nm: b9.nm, r: b9.r, b: b9.b, out: null }; I.byKey[k] = e; I.bats.push(e); }
          else { e.r = b9.r; e.b = b9.b; if (b9.nm.length > (e.nm || "").length) e.nm = b9.nm; }
        });
        if (w9.bowl) {
          var kb = bKey(w9.bowl.nm), eb = I.bowlByKey[kb];
          if (!eb) { eb = { nm: w9.bowl.nm, o: w9.bowl.o, r: w9.bowl.r, w: w9.bowl.w }; I.bowlByKey[kb] = eb; I.bowls.push(eb); }
          else { eb.o = w9.bowl.o; eb.r = w9.bowl.r; eb.w = w9.bowl.w; }
        }
        continue;
      }
      if (r.no !== "" && !r.intro) {
        I.open = true;
        I.sinceTop.push(r);
        I.lastNo = r.no;
        I.lastDel = r;
        I.pshipBalls++;
        if (r.strikerNm) {
          I.striker = r.strikerNm;
          var ks = bKey(r.strikerNm);
          if (!I.byKey[ks]) { var ne = { nm: r.strikerNm, r: null, b: null, out: null }; I.byKey[ks] = ne; I.bats.push(ne); }
        }
        if (r.bowlerNm) I.bowler = r.bowlerNm;
        // WHAT A BOWLER GAVE AWAY. The umpire's figure line is overs, runs
        // and wickets and never says how much of the runs was his own wide.
        // The deliveries do, so the wides and no-balls are counted here as
        // they go by. Byes are not counted: a ball the keeper missed is not
        // the bowler's, and charging him for it would be a new lie in place
        // of the old silence.
        if (r.bowlerNm && (r.out === "wide" || r.out === "noball")) {
          var ke = bKey(r.bowlerNm);
          I.exBy[ke] = (I.exBy[ke] || 0) + ballRuns(r);
        }
        if (r.out && r.out[0] === "w" && r.out !== "wide")
          pendingWk = { code: r.out, bowler: r.bowlerNm, fld: r.ev && r.ev.fldNm, no: r.no };
        continue;
      }
      if (r.out === "\u2602") inns.rain = true;
      if (r.out === "✕") {
        var fx = /Partnership ends at (\d+)\s*-\s*(.+?) out for (\d+)\s*\((\d+)\)\.\s*(.+?)\s+(\d+)\/(\d+)\./.exec(r.txt || "");
        if (fx) {
          var kd = bKey(fx[2]), ed = I.byKey[kd];
          if (!ed) { ed = { nm: fx[2], out: null }; I.byKey[kd] = ed; I.bats.push(ed); }
          ed.nm = fx[2]; ed.r = +fx[3]; ed.b = +fx[4];
          ed.out = pendingWk ? { how: HOW[pendingWk.code] || "out", bowler: pendingWk.bowler, fld: pendingWk.fld } : { how: "out" };
          I.fow.push({ p: +fx[1], nm: fx[2], r: +fx[3], b: +fx[4], score: +fx[6], w: +fx[7], no: pendingWk ? pendingWk.no : "" });
          I.pshipBalls = 0;
          pendingWk = null;
        }
      }
      if (r.out === "-" && /Innings break/.test(r.txt || "")) {
        I.brk = r.txt;
        var tg = /Target (\d+)\./.exec(r.txt); if (tg) inns[1].target = +tg[1];
        var cl = /Innings break\.\s*(.+?)\s+(\d+)\/(\d+)\./.exec(r.txt);
        if (cl) { I.team = cl[1]; I.close = { runs: +cl[2], wkts: +cl[3] }; }
      }
    }
    return inns;
  }

  // STRENGTH, ON THE SAME LADDER AS EVERYWHERE ELSE. The roster's absolute
  // ten-star scale (foStarsFor: composite 15 -> 0 stars, 92 -> 10), read off
  // the same served squads the umpire fields. Gold for the bat, teal for the
  // ball. A man the seed cannot derive (a mid-season signing on a claimed
  // club) simply shows no stars - never the wrong ones.
  function squadMap(rid, m) {
    // a league fixture's two clubs share a nation; a friendly's may not -
    // each side carries its own country (__c) and the map remembers, per
    // man, which flag and which slot his player page lives under
    var key = (m.home.__c || rid) + ":" + m.home.slot + "|" + (m.away.__c || rid) + ":" + m.away.slot;
    if (T.sq && T.sqKey === key) return T.sq;
    var mp = {};
    try {
      var wt = window.__foWT;
      [m.home, m.away].forEach(function (side) {
        var nat = side.__c || rid;
        ((wt && wt.serverSquad && wt.serverSquad(nat, side.slot)) || []).forEach(function (p) {
          if (!p || !p.name) return;
          p.__fdSlot = side.slot; p.__fdNat = nat;
          mp[p.name.toLowerCase()] = p;
          var ab = (p.name[0] + ". " + surname(p.name)).toLowerCase();
          if (!mp[ab]) mp[ab] = p;
        });
      });
    } catch (e) {}
    T.sq = mp; T.sqKey = key;
    return mp;
  }
  function sStars(nm, mode) {
    try {
      var FS = window.foStarsFor; if (!FS || !T.args) return "";
      var p = squadMap(T.args[3], T.args[2])[String(nm || "").replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase()];
      if (!p) return "";
      var comp = mode === "bowl" ? FS.bowl(p) : FS.bat(p);
      if (!(comp > 0)) return "";
      // a strip of ten hollow stars says nothing a blank cannot say better
      var n9 = FS.stars(comp);
      if (!(n9 >= 0.5)) return "";
      return "<span class='fd-strn " + (mode === "bowl" ? "bw" : "bt") + "'>" + FS.html(n9) + "</span>";
    } catch (e) { return ""; }
  }
  // EVERY NAME IS A DOOR. A player named anywhere outside the commentary
  // prose links to his page, resolved through the served squads to the club
  // he actually plays for; a name the seed cannot place stays plain text.
  function plink(nm, label) {
    try {
      var clean = String(nm || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
      var lbl = label != null ? label : nm;
      var p = T.args ? squadMap(T.args[3], T.args[2])[clean.toLowerCase()] : null;
      if (!p || p.__fdSlot == null) return E(lbl);
      return "<a class='fd-plink' href='#/player?c=" + encodeURIComponent(p.__fdNat || T.args[3]) + "&s=" + p.__fdSlot + "&n=" + encodeURIComponent(p.name) + "'>" + E(lbl) + "</a>";
    } catch (e) { return E(nm); }
  }
  function tlink(nm, slot, rid) {
    if (slot == null) return E(nm);
    return "<a class='fd-plink' href='#/team?c=" + encodeURIComponent(rid) + "&s=" + (slot | 0) + "'>" + E(nm) + "</a>";
  }
  var T = { id: null, timer: null, tab: "live", filter: "all", args: null, ord: {}, ordBusy: {} };
  // ---- A FRIENDLY IS WATCHED HERE TOO (#/feed?fr=<id>) ---------------------
  // The umpire banks the match at the teamsheet lock (tick.mjs) and its
  // commentary rides the same bank as a league round's; this page reads it
  // at the same eighteen-seconds-a-delivery pace from the named hour. One
  // reader for all cricket - nothing is ever simulated in a browser again.
  var FRS = {};
  function frFetch(frId, fresh) {
    var k = "fr:" + frId;
    if (FRS[k] && !fresh) return FRS[k];
    var pr = fetch(SB + "/rest/v1/rpc/world_friendly_log", {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + KEY, "content-type": "application/json" },
      body: JSON.stringify({ p_id: +frId })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
    FRS[k] = pr;
    return pr;
  }
  // THE RESULT LINE, once the broadcast has shown its last ball. The server
  // withholds it until friendly_done_ms (048), so asking early just gets
  // null and the page asks again on its next paint. Cached per friendly;
  // when the line lands the stage repaints with it.
  function frResult(frId) {
    var k = "frtx:" + frId;
    if (FRS[k] !== undefined) return FRS[k];
    FRS[k] = null;
    var tok = ""; try { tok = (window.__foJWT && window.__foJWT()) || ""; } catch (e) {}
    fetch(SB + "/rest/v1/rpc/world_friendly_detail", {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + (tok || KEY), "content-type": "application/json" },
      body: JSON.stringify({ p_id: +frId })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var tx = (d && d.text) || null;
        if (tx) {
          FRS[k] = tx;
          if (T.args && T.id === "fr:" + frId) { try { paint.apply(null, T.args); } catch (e2) {} }
        } else delete FRS[k];               // not sealed-open yet: ask again next paint
      })
      .catch(function () { delete FRS[k]; });
    return null;
  }
  function frSide(side) {
    var city = null;
    try {
      var sides = (P() && P().sidesOf(side.country)) || [];
      for (var i = 0; i < sides.length; i++) if ((sides[i].slot | 0) === (side.slot | 0)) { city = sides[i].city; break; }
    } catch (e) {}
    return { name: side.name, slot: side.slot, city: city, __c: side.country };
  }
  function renderFriendly(page, frId) {
    css();
    document.body.classList.add("fo-fd-on");
    var id = "fr:" + frId;
    if (T.id !== id) { T.tab = "live"; T.filter = "all"; T.full = false; T.tabAuto = true; }
    T.id = id;
    if (!page.querySelector(".fo-fd")) page.innerHTML = "<div class='fo-fd'><div class='fd-in'><p class='fd-dim'>Opening the umpire's book&hellip;</p></div></div>";
    frFetch(frId).then(function (j) {
      if (T.id !== id || (location.hash || "").split("?")[0] !== "#/feed") return;
      if (!j || !j.home) {
        page.innerHTML = "<div class='fo-fd'><div class='fd-in'><p class='fd-dim'>This friendly could not be found - it may have lapsed unanswered.</p>" +
          "<div class='fd-foot'><a href='#/home'>&#8592; The club</a></div></div></div>";
        return;
      }
      var m = { home: frSide(j.home), away: frSide(j.away) };
      var rid = j.home.__c || j.home.country;
      T.rid = rid;
      var winStart = +j.playAtMs || 0, BALL_MS = 18000;
      var cal = { round: 0, seasonNo: 0, __fr: true };
      if (!j.log) {
        // THE SAME FRONT PAGE AS A ROUND. The preview room (51) paints the
        // friendly's build-up in the league fixture's own dress - billing,
        // ground plate, facts, the bar of forty playings - so the two
        // pre-match pages are one design. This page keeps the address, the
        // fetch and the refetch clock; the moment the umpire's book opens,
        // the broadcast below takes the room back.
        if (window.foRenderFriendlyPreview) {
          // whether MY sheet is on this friendly's card, asked once per
          // friendly so the teamsheet button can wear its green
          var myO = FRS["myord:" + frId];
          var tokMy = ""; try { tokMy = (window.__foJWT && window.__foJWT()) || ""; } catch (eT9) {}
          if (myO === undefined && tokMy) {
            FRS["myord:" + frId] = null;
            fetch(SB + "/rest/v1/rpc/world_my_friendlies", {
              method: "POST",
              headers: { apikey: KEY, Authorization: "Bearer " + tokMy, "content-type": "application/json" },
              body: "{}"
            }).then(function (r) { return r.ok ? r.json() : null; })
              .then(function (list) {
                var hit = (list || []).filter(function (x) { return x && +x.id === +frId; })[0];
                FRS["myord:" + frId] = !!(hit && hit.myOrders);
                if (T.id === id && (location.hash || "").split("?")[0] === "#/feed") window.foRenderFeedPage();
              }).catch(function () { delete FRS["myord:" + frId]; });
          }
          document.body.classList.remove("fo-fd-on");
          if (foRenderFriendlyPreview(page, j, frId, { myOrders: FRS["myord:" + frId] === true })) {
            clearTimeout(T.timer);
            T.timer = setTimeout(function () { frFetch(frId, true).then(function () { window.foRenderFeedPage(); }); },
              winStart - Date.now() > 150000 ? 60000 : 20000);
            return;
          }
          document.body.classList.add("fo-fd-on");
        }
        var mins = Math.max(1, Math.ceil((winStart - Date.now()) / 60000));
        // BOTH CLOCKS, NAMED. The topbar speaks UTC and the phone speaks its
        // own timezone; a kick-off printed bare read as whichever clock the
        // manager happened to be looking at. Every friendly hour is now
        // pinned to both, with the exact distance from this moment.
        var whenT = winStart ? new Date(winStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
        var utcT = winStart ? new Date(winStart).toISOString().slice(11, 16) : "";
        var tz9 = ""; try { tz9 = (typeof foTzAbbr === "function" && foTzAbbr()) || ""; } catch (eTz9) {}
        var dist9 = mins >= 90 ? Math.floor(mins / 60) + "h " + (mins % 60) + "m" : mins + " minute" + (mins === 1 ? "" : "s");
        page.innerHTML = shell(rid, cal, "up", m,
          stageShell(m, null, Date.now() < winStart
            ? "Friendly &middot; first ball <b>" + E(whenT) + (tz9 ? " " + E(tz9) : "") + " your time</b> (" + E(utcT) + " UTC)"
            : "Friendly &middot; the umpire is walking out") +
          preMatch(rid, cal, m, winStart, "") +
          teamsPanel(m, rid));
        clearTimeout(T.timer);
        T.timer = setTimeout(function () { frFetch(frId, true).then(function () { window.foRenderFeedPage(); }); },
          winStart - Date.now() > 150000 ? 60000 : 20000);
        return;
      }
      // the book is open: the broadcast takes the room back from the preview
      document.body.classList.remove("fo-pm-on");
      document.body.classList.add("fo-fd-on");
      T.args = [page, j.log.slice().reverse(), m, rid, cal, winStart, BALL_MS, id];
      paint.apply(null, T.args);
      clearTimeout(T.timer);
      T.timer = setInterval(function () {
        if ((location.hash || "").split("?")[0] !== "#/feed" || T.id !== id) { clearInterval(T.timer); return; }
        paint.apply(null, T.args);
      }, 6000);
    });
  }
  window.foRenderFeedPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    var pl = P(), wt = window.__foWT;
    if (!pl || !wt || !wt.serverFixtures) { setTimeout(window.foRenderFeedPage, 600); return; }
    css();
    document.body.classList.add("fo-fd-on");
    document.body.classList.remove("fo-pm-on");   // in case the friendly preview held the room
    var q = qs(), rid = q.n || "eng";
    if (q.fr) { renderFriendly(page, q.fr); return; }
    var sv = wt.serverFixtures(rid, Date.now());
    var fx = sv.fx || [], cal = sv.cal;
    if (!fx.length || !cal.round) {
      // a rest day is still a page, not a shrug: say when play resumes and
      // hand the reader somewhere to go
      var rest9 = "";
      try {
        var pl9 = P(), ph9 = pl9.phaseOf(Date.now());
        var nxh9 = pl9.natHour(rid);
        rest9 = "<div class='fd-rest'><b>A rest day in this league.</b>" +
          "<span>The next round bowls at " + (pl9.hhTxt ? pl9.hhTxt(nxh9) : (nxh9 + ":00")) + " on the next match day.</span>" +
          "<a href='#/schedule'>The season&rsquo;s calendar &rsaquo;</a><a href='#/league'>The table as it stands &rsaquo;</a></div>";
      } catch (e9) { rest9 = "<p class='fd-dim'>No round on today's card.</p>"; }
      page.innerHTML = shell(rid, cal, null, null, rest9);
      return;
    }
    var fi = Math.max(0, Math.min(fx.length - 1, parseInt(q.f || "0", 10) || 0));
    var m = fx[fi];
    var id = rid + ":s" + cal.seasonNo + ":r" + cal.round + ":h" + m.home.slot + "a" + m.away.slot;
    var winStart = pl.EPOCH + pl.dayIx(Date.now()) * 86400000 + pl.natHour(rid) * 3600000;
    var winLen = (pl.LIVE_LEN || 3) * 3600000, BALL_MS = winLen / 600;
    if (T.id !== id) { T.tab = "live"; T.filter = "all"; T.full = false; T.tabAuto = true; }
    T.id = id; T.rid = rid;
    page.innerHTML = shell(rid, cal, null, m, stageShell(m, null, "Opening the umpire's book&hellip;"));
    logFetch(rid, id).then(function (log) {
      if (T.id !== id || (location.hash || "").split("?")[0] !== "#/feed") return;
      if (!log) {
        // sealed until the first ball (migration 047), or the prebank has not
        // landed yet: either way the umpire walks out shortly - ask again
        var mins = Math.max(1, Math.ceil((winStart - Date.now()) / 60000));
        page.innerHTML = shell(rid, cal, "up", m,
          stageShell(m, null, Date.now() < winStart
            ? "Round " + cal.round + " &middot; first ball " + (function () { try { return pl.hhTxt(pl.natHour(rid)); } catch (e) { return hh(pl.natHour(rid)); } })()
            : "Round " + cal.round + " &middot; the umpire is walking out") +
          preMatch(rid, cal, m, winStart, "") +
          teamsPanel(m, rid));
        clearTimeout(T.timer);
        T.timer = setTimeout(function () { logFetch(rid, id, true).then(function () { window.foRenderFeedPage(); }); }, 45000);
        return;
      }
      T.args = [page, log, m, rid, cal, winStart, BALL_MS, id];
      paint.apply(null, T.args);
      clearTimeout(T.timer);
      T.timer = setInterval(function () {
        if ((location.hash || "").split("?")[0] !== "#/feed" || T.id !== id) { clearInterval(T.timer); return; }
        paint.apply(null, T.args);
      }, 6000);
    });
  };
  window.foFeedTab = function (t) {
    T.tab = t;
    if (T.args) paint.apply(null, T.args);
    // the teamsheets arrive from the World Service on first opening
    if (t === "teams" && T.args && !T.ord[T.id] && !T.ordBusy[T.id]) {
      var wt = window.__foWT, cal9 = T.args[4], rid9 = T.args[3], id9 = T.id;
      if (cal9 && cal9.__fr) {
        // a friendly's sheets come off its own fixture card (public from
        // the teamsheet lock, migration 048), keyed by club name like the
        // round's own orders
        T.ordBusy[id9] = 1;
        fetch(SB + "/rest/v1/rpc/world_friendly_detail", {
          method: "POST",
          headers: { apikey: KEY, Authorization: "Bearer " + KEY, "content-type": "application/json" },
          body: JSON.stringify({ p_id: +String(id9).slice(3) })
        }).then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            T.ord[id9] = (d && d.orders) || {};
            if (T.id === id9 && T.tab === "teams" && T.args) paint.apply(null, T.args);
          }).catch(function () { T.ord[id9] = {}; });
        return;
      }
      if (wt && wt.roundState) {
        T.ordBusy[id9] = 1;
        wt.roundState(rid9, cal9.round).then(function (st) {
          T.ord[id9] = (st && st.orders) || {};
          if (T.id === id9 && T.tab === "teams" && T.args) paint.apply(null, T.args);
        });
      }
    }
  };
  window.foFeedFilter = function (f) { T.filter = f; if (T.args) paint.apply(null, T.args); };
  window.foFeedAll = function () { T.full = true; if (T.args) paint.apply(null, T.args); };
  function hh(h) { return (h < 10 ? "0" : "") + h + ":00"; }

  /* ---- THE BUILD-UP -----------------------------------------------------
     Before the first ball this page was a headline and one sentence: two club
     names, a kick-off time, and eighty per cent of the screen left blank. A
     friendly was the worst of it - "FIRST BALL SOON" and nothing whatever to
     read while you waited.

     Everything below is already knowable an hour out and none of it needed
     asking the server for: the square and the sky come from the planet's own
     condOf (the same call the umpire settles by, so what is promised here is
     what is played), the sides come from sidesOf, and the teamsheets come
     from the orders the world publishes at the lock. So the wait now has the
     things a manager actually wants in it. */
  function preMatch(rid, cal, m, winStart, note) {
    var pl = P(); var out = "";
    // ---- the clock ------------------------------------------------------
    var left = winStart ? winStart - Date.now() : 0;
    var cd = "";
    if (left > 0) {
      var mins = Math.floor(left / 60000), hrs = Math.floor(mins / 60);
      cd = "<div class='fd-pmc'><span>First ball in</span><b>" +
        (hrs > 0 ? hrs + "h " + (mins % 60) + "m" : Math.max(1, mins) + " min") + "</b></div>";
    } else {
      cd = "<div class='fd-pmc'><span>Now</span><b>The umpire is walking out</b></div>";
    }

    // ---- the square and the sky -----------------------------------------
    var cond = null;
    try { cond = pl && pl.condOf ? pl.condOf(rid, m.home.slot, (cal && cal.seasonNo) || 0, (cal && cal.round) || 0) : null; } catch (eC) {}
    var PITCH = { balanced: "Balanced", flat: "Flat", green: "Green", dry: "Crumbling",
                  slow: "Slow and low", cracked: "Cracked", twoPaced: "Two-paced" };
    var TIP = { balanced: "Nothing given, nothing denied.", flat: "A road. Bat first and bat long.",
                green: "The seamers talk all morning.", dry: "It will turn, and turn more after tea.",
                slow: "Hard to hit through the line.", cracked: "Variable bounce brings edges.",
                twoPaced: "The pace off the pitch never settles." };
    if (cond) {
      out += "<div class='fd-pmrow'>" +
        "<div class='fd-pmk'><span>The square</span><b>" + E(PITCH[cond.pitch] || cond.pitch || "Balanced") + "</b>" +
        "<u>" + E(TIP[cond.pitch] || "") + "</u></div>" +
        "<div class='fd-pmk'><span>The sky</span><b>" + E(cond.weather || "Fair") + "</b>" +
        "<u>" + E(typeof wxTip === "function" ? wxTip(cond.weather) : "") + "</u></div>" +
        "<div class='fd-pmk'><span>The ground</span><b>" + E(m.home.name) + "</b>" +
        "<u>" + (m.home.city ? E(m.home.city) + " &middot; " : "") + "home advantage to the hosts</u></div>" +
        "</div>";
    }

    // ---- the two sides, and the men who decide it ------------------------
    // sidesOf is the planet's own account of a club, so this reads the same
    // eleven the umpire will pick from rather than a guess at one
    // WHAT THE PLANET ACTUALLY KNOWS ABOUT A CLUB. sidesOf carries a club's
    // identity and its standing - name, city, division, flagship, strength -
    // and NOT its players; the squads live behind a separate fetch this page
    // has no business making before a ball is bowled. So the card says what is
    // in hand rather than an empty list where an eleven should be.
    var sideCard = function (side, tag) {
      var info = null;
      try {
        var all = (pl && pl.sidesOf(side.__c)) || [];
        for (var i = 0; i < all.length; i++) if ((all[i].slot | 0) === (side.slot | 0)) { info = all[i]; break; }
      } catch (eS) {}
      var bits = [];
      if (info) {
        if (info.boss) bits.push("<em class='fl'>Flagship</em>");
        bits.push("<em>Division " + (info.div === 2 ? "Two" : "One") + "</em>");
        if (info.city) bits.push("<em>" + E(info.city) + "</em>");
      }
      // WHAT THIS CLUB HAS WON, which is most of what a build-up is for. The
      // planet derives it from the seat, so it costs nothing to ask and cannot
      // disagree with the club's own page.
      // A SEAT SOMEBODY HOLDS HAS NO CUPBOARD - it was founded the day they
      // took it - so the manager map decides which account is told. Where the
      // map is not on the device the club is left plain rather than handed a
      // history that may belong to nobody.
      try {
        var mm9 = null;
        try { mm9 = window.__foWorldNames && window.__foWorldNames.mgr ? window.__foWorldNames.mgr(side.__c) : null; } catch (eM) {}
        var human9 = !mm9 || !!mm9[side.slot];
        var h9 = (pl && pl.heritageOf && !human9) ? pl.heritageOf(side.__c, side.slot, false) : null;
        if (h9 && !h9.human) {
          if (h9.titles) bits.push("<em class='tt'>" + h9.titles + "&times; champions</em>");
          if (h9.crowns) bits.push("<em class='tt'>" + h9.crowns + "&times; Champions Cup</em>");
          if (!h9.titles && !h9.cups && !h9.crowns) bits.push("<em>Est. " + h9.founded + "</em>");
        }
      } catch (eH) {}
      // form, when the world's league snapshot is already on the device - it
      // is not fetched for this, because a build-up is not worth a round trip
      var form = "";
      try {
        var lg = window.__foWorldLg && window.__foWorldLg.get(side.__c);
        var res = (lg && lg.results) || [];
        var f5 = [];
        for (var r = res.length - 1; r >= 0 && f5.length < 5; r--) {
          var x = res[r];
          if (x.home !== side.name && x.away !== side.name) continue;
          f5.unshift(x.winner === null ? "t" : x.winner === side.name ? "w" : "l");
        }
        if (f5.length) form = "<div class='fd-pmform'>" + f5.map(function (k) {
          return "<i class='" + k + "'>" + k.toUpperCase() + "</i>"; }).join("") + "</div>";
      } catch (eL) {}
      return "<div class='fd-pmside'><div class='fd-pmst'>" + tag + "</div>" +
        "<a class='fd-pmsn' href='#/team?c=" + encodeURIComponent(side.__c) + "&s=" + side.slot + "'>" + E(side.name) + "</a>" +
        (bits.length ? "<div class='fd-pmtags'>" + bits.join("") + "</div>" : "") + form +
        "</div>";
    };
    out += "<div class='fd-pmsides'>" + sideCard(m.home, "Home") +
      "<span class='fd-pmv'>v</span>" + sideCard(m.away, "Away") + "</div>";

    return "<div class='fd-panel fd-pm'>" + cd +
      (note ? "<p class='fd-pmnote'>" + note + "</p>" : "") + out + "</div>";
  }

  function stageShell(m, inner, sub) {
    return "<div class='fd-stage'><div class='fd-stagein'>" +
      "<div class='fd-teams'><b>" + E(m.home.name) + "</b><i>vs</i><b>" + E(m.away.name) + "</b></div>" +
      (inner || "") + (sub ? "<div class='fd-sub'>" + sub + "</div>" : "") +
      "</div></div>";
  }

  function paint(page, log, m, rid, cal, winStart, BALL_MS, id) {
    var now = Date.now();
    var over = now >= winStart + 600 * BALL_MS;
    // deliveries reveal on the clock; the umpire's notes (toss, fall of
    // wicket, drinks, the over summary) travel with the delivery they precede
    var nBalls = over ? 1e9 : Math.max(0, Math.floor((now - winStart) / BALL_MS));
    var seen = [], balls = 0;
    for (var i = 0; i < log.length; i++) {
      var r = log[i];
      var isBall = r && r.no !== "" && !r._top && !r.intro;
      if (isBall && balls >= nBalls) break;
      seen.push(r);
      if (isBall) balls++;
    }
    var totalBalls = log.filter(function (r2) { return r2 && r2.no !== "" && !r2._top && !r2.intro; }).length;
    var live = !over && balls > 0 && balls < totalBalls;
    var done = over || balls >= totalBalls;
    var inns = bookState(seen);
    var innNow = inns[1].open ? 1 : 0, I = inns[innNow];
    var tp = I.top ? parseTop(I.top.txt) : null;
    // THE BALLS SINCE THE LAST OVER WERE CALLED. A chase ends on the winning
    // run, and no over-summary follows it, so the last tally the umpire
    // printed is the score BEFORE the shot that won the match: this friendly
    // finished 159/4 chasing 159, and the stage said 158/4 - one short of the
    // target it had just passed, under a headline saying they had won by six
    // wickets. Live it was the same fault at a smaller scale, the big number
    // frozen for six balls at a time.
    if (tp) {
      var addR = 0, addW = 0;
      I.sinceTop.forEach(function (r9) { addR += ballRuns(r9); if (isWicket(r9)) addW++; });
      tp.runs += addR; tp.wkts += addW;
    }
    // THE LAST BALL COUNTS. The over-summary rides BEFORE a delivery, so an
    // innings that ends mid-over leaves the top a ball stale - the book read
    // 192/9 while the umpire's fall note said 193/10, and the match never
    // looked finished. The fall note carries the true tally; it stays as the
    // floor under the sum above, so an unreadable code can never leave the
    // score behind a figure the umpire has already written down.
    if (tp && I.fow.length) {
      var lf9 = I.fow[I.fow.length - 1];
      if (lf9.score >= tp.runs && lf9.w >= tp.wkts) { tp.runs = lf9.score; tp.wkts = lf9.w; }
    }
    // THE CHASE IS NEVER GIVEN AN INNINGS BREAK, so nothing in the umpire's
    // book ever closes it. close is written from the "Innings break" note,
    // and the second innings does not get one - it ends because somebody has
    // won. Every read that asks "is this innings still going?" therefore said
    // yes forever: the scorecard headed the chase "batting", the stage kept
    // its run rate and its fifty-over strip, and the men who finished the
    // match were still standing at the crease an hour after stumps.
    // The last delivery IS the close. Say so, once the reveal is complete.
    if (done && I && !I.close && tp) I.close = { runs: tp.runs, wkts: tp.wkts };
    // A MATCH THAT IS ALREADY OVER WHEN IT IS OPENED IS NOT A BROADCAST.
    // It opens on the card, the way a report does. One shot, on the first
    // paint of this match only - a match that finishes while somebody is
    // watching the ball-by-ball must not have the page pulled out from under
    // them at the moment of the winning run.
    var firstPaint = !!T.tabAuto; T.tabAuto = false;
    if (done && firstPaint) T.tab = "card";

    // ---- THE MATCH STAGE ---------------------------------------------------
    var meta = inns.meta, condBits = [];
    if (meta) {
      if (meta.wx) condBits.push(E(meta.wx));
      if (meta.pitch) condBits.push(E(meta.pitch) + " pitch");
      if (meta.tossWin) condBits.push(E(meta.tossWin) + " won the toss" + (meta.tossDo ? " and chose to " + E(meta.tossDo) : ""));
    }
    // the stage wears the home ground's art; a ground the seed cannot dress
    // wears the day's weather instead - and once real rain has stopped play,
    // the rain scene overrules everything
    var wxArt = window.foWeatherArtUrl ? window.foWeatherArtUrl(inns.rain ? "rain" : (meta && meta.wx)) : null;
    var art = (inns.rain && wxArt) ? wxArt : (stageArt(m.home.city) || wxArt);
    // the exact position of the innings: the last delivery's own number
    var posOv = I.lastNo ? parseFloat(I.lastNo) : (tp ? tp.over : 0);
    var ovLabel = I.lastNo ? I.lastNo : (tp ? tp.over + ".0" : "0.0");
    // WHOSE RUNS ARE THESE? The stage printed 111/3 and left the reader to
    // deduce the batting side and the innings from the toss line. The over
    // summaries name the side; before the first of them arrives the toss
    // decides it - the winner who chose to bat is the side batting, and the
    // one who chose to bowl is not. Never guessed from home/away, which is
    // wrong half the time.
    var batNm = I.team || null;
    if (!batNm && meta && meta.tossWin && meta.tossDo) {
      var batFirst = /bat/i.test(meta.tossDo) ? meta.tossWin
        : (meta.tossWin === m.home.name ? m.away.name : m.home.name);
      batNm = innNow ? (batFirst === m.home.name ? m.away.name : m.home.name) : batFirst;
    }
    var scoreHtml;
    if (tp) {
      scoreHtml = "<div class='fd-scorerow'><em>" + tp.runs + "/" + tp.wkts + "</em><span>" + ovLabel + " <u>OV</u></span></div>";
    } else {
      scoreHtml = "<div class='fd-scorerow'><span class='op'>The innings is under way&hellip;</span></div>";
    }

    // ---- THE SCORE BUG (the manager's pick of three) -----------------------
    // Television's bug, full size: while the cricket is on, the BATTING side
    // owns the header with a gold dot, the opponent drops to one small caps
    // line, and the conditions and the toss stop being a sentence - a sky
    // glyph, a pitch swatch and a three-letter toss chip say the same thing
    // in a tenth of the ink. At stumps the two-team billing returns, because
    // nobody is batting a finished match.
    var abbr9 = function (nm) {
      return String(nm || "").replace(/[^A-Za-z ]/g, "").trim().split(/\s+/)
        .map(function (w) { return (w[0] || "").toUpperCase(); }).join("").slice(0, 3);
    };
    var WX_IC = {
      sun: "<svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='#E8C97A' stroke-width='2' stroke-linecap='round'><circle cx='12' cy='12' r='4.2'/><path d='M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9L19 19M19 5l-2.1 2.1M7.1 16.9L5 19'/></svg>",
      cloud: "<svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='#9FB0C6' stroke-width='2' stroke-linejoin='round'><path d='M6.5 19a4.5 4.5 0 1 1 .9-8.9A6 6 0 0 1 19 12.2 3.5 3.5 0 0 1 18 19z'/></svg>",
      rain: "<svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='#9FB0C6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M6.5 15a4.5 4.5 0 1 1 .9-8.9A6 6 0 0 1 19 8.2 3.5 3.5 0 0 1 18 15z'/><path d='M8 18.5v2M12 18.5v2M16 18.5v2'/></svg>"
    };
    var PITCH_DOT = { green: "#3E8A5A", flat: "#C8B98A", dry: "#C08A2E", crumbling: "#C08A2E",
      balanced: "#7BA37B", slow: "#8A8A6F", cracked: "#A0693C", sticky: "#A0693C", "two-paced": "#9B8262" };
    var bugHead = "";
    if (!done && batNm) {
      var oppNm = batNm === m.home.name ? m.away.name : m.home.name;
      var oppSlot = batNm === m.home.name ? m.away.slot : m.home.slot;
      var oppNat = batNm === m.home.name ? (m.away.__c || rid) : (m.home.__c || rid);
      var batSlot = batNm === m.home.name ? m.home.slot : m.away.slot;
      var batNat = batNm === m.home.name ? (m.home.__c || rid) : (m.away.__c || rid);
      var chips9 = [];
      if (meta && meta.wx) {
        var wk9 = /sun|hot|scorch|dew/i.test(meta.wx) ? "sun" : /drizzle|rain/i.test(meta.wx) ? "rain" : "cloud";
        chips9.push("<span class='ch'>" + WX_IC[wk9] + E(meta.wx) + "</span>");
      }
      if (meta && meta.pitch) {
        var pk9 = String(meta.pitch).toLowerCase();
        chips9.push("<span class='ch'><i style='background:" + (PITCH_DOT[pk9] || "#7BA37B") + "'></i>" + E(meta.pitch) + "</span>");
      }
      if (meta && meta.tossWin && meta.tossDo)
        chips9.push("<span class='ch toss'>" + E(abbr9(meta.tossWin)) + " " + (/bat/i.test(meta.tossDo) ? "bat" : "bowl") + " first</span>");
      var subBits = innNow
        ? ((inns[1].target ? "Chasing " + inns[1].target + " &middot; " : "2nd innings &middot; ") + "v " + tlink(oppNm, oppSlot, oppNat))
        : "1st innings &middot; v " + tlink(oppNm, oppSlot, oppNat);
      bugHead =
        (chips9.length ? "<div class='fd-bugchips'>" + chips9.join("") + "</div>" : "") +
        "<div class='fd-bug'><b>" + tlink(batNm, batSlot, batNat) + "</b><s></s></div>" +
        "<div class='fd-bugsub'>" + subBits + "</div>";
    }
    // the three reads under the score, all arithmetic on the umpire's prints
    var mets = "";
    // AT STUMPS THEY ARE THE WRONG THREE READS. A run rate and a last-five
    // are questions about an innings in progress; the question after the last
    // ball is what the two sides made, so that is what the stage prints.
    var innScore = function (II) {
      if (II.close) return II.close.runs + "/" + II.close.wkts;
      if (!II.top) return null;
      var t9 = parseTop(II.top.txt);
      return t9 ? t9.runs + "/" + t9.wkts : null;
    };
    if (done) {
      var fin9 = [];
      for (var ix9 = 0; ix9 < 2; ix9++) {
        var II9 = inns[ix9], sc9 = innScore(II9);
        if (!sc9) continue;
        fin9.push("<div class='mt wide'><u>" + E(II9.team || (ix9 ? m.away.name : m.home.name)) +
          "</u><b>" + sc9 + "</b></div>");
      }
      if (fin9.length) mets = "<div class='fd-mets'>" + fin9.join("") + "</div>";
    } else if (tp && tp.over > 0) {
      var rr = tp.runs / tp.over;
      var l5 = I.overs.slice(-5);
      var l5r = 0; l5.forEach(function (o) { l5r += o.ovRuns; });
      var l5from = tp.over - l5.length;
      var l5w = I.fow.filter(function (fw) { var o9 = parseFloat(fw.no) || 0; return o9 > l5from && o9 <= tp.over + 1; }).length;
      var third;
      if (done) {
        // the match is over: a NEEDED or PROJECTED read is a question with
        // no innings left to answer it
        third = "";
      } else if (innNow && inns[1].target) {
        var need = inns[1].target - tp.runs, bLeft = (50 - tp.over) * 6;
        third = need > 0 ? "<div class='mt'><u>NEEDED</u><b>" + need + " <s>off " + bLeft + "b</s></b></div>" : "";
      } else {
        third = "<div class='mt'><u>PROJECTED</u><b>" + Math.round(rr * 50) + "</b></div>";
      }
      mets = "<div class='fd-mets'>" +
        "<div class='mt'><u>RUN RATE</u><b>" + rr.toFixed(2) + "</b></div>" +
        "<div class='mt'><u>LAST " + l5.length + "</u><b>" + l5r + "/" + l5w + "</b></div>" +
        third + "</div>";
    }
    var strip = "";
    if (!done && (tp || I.open)) {
      var pc = Math.max(0, Math.min(100, posOv / 50 * 100));
      strip = "<div class='fd-strip'><span class='s0'>1</span><span class='bar'><i style='width:" + pc.toFixed(1) + "%'></i>" +
        "<em style='left:" + pc.toFixed(1) + "%'>" + Math.max(1, Math.ceil(posOv || 1)) + "</em></span><span class='s1'>50</span></div>";
    }
    var stage =
      "<div class='fd-stage" + (art ? " hasart" : "") + "'" +
      (art ? " style=\"background-image:linear-gradient(90deg,rgba(10,26,48,.97) 0%,rgba(10,26,48,.9) 48%,rgba(10,26,48,.68) 100%),url('" + art + "')\"" : "") + ">" +
      "<div class='fd-stagein'>" +
      (bugHead ||
        ("<div class='fd-teams'><b>" + tlink(m.home.name, m.home.slot, m.home.__c || rid) + "</b><i>vs</i><b>" +
         tlink(m.away.name, m.away.slot, m.away.__c || rid) + "</b></div>" +
         (condBits.length ? "<div class='fd-cond'>" + condBits.join(" &middot; ") + "</div>" : ""))) +
      scoreHtml + mets +
      (done && cal.__fr ? (function () {
        // the post-match read the page was missing: FULL TIME and the
        // umpire's own result line, fetched once the server unseals it
        var rTx = frResult(String(id).replace(/^fr:/, ""));
        return "<div class='fd-ftime'><u>FULL TIME</u><b>" +
          (rTx ? E(rTx) : "the umpire is signing the card&hellip;") + "</b></div>";
      })() : "") +
      (done && !cal.__fr ? "<a class='fd-enter' href='#/report?n=" + encodeURIComponent(rid) + "&w=" + encodeURIComponent(id) + "'>The full report &rsaquo;</a>" : "") +
      // A FRIENDLY GETS THE FULL REPORT NOW, the same Journal page a league
      // match opens - so the stage sends the reader there rather than to a tab
      (done && cal.__fr ? "<a class='fd-enter' href='#/report?fr=" + E(String(id).replace(/^fr:/, "")) + "'>The full report &rsaquo;</a>" : "") +
      strip +
      "</div></div>";

    // ---- TABS + WORKSPACE --------------------------------------------------
    // the first tab tells the truth about the state of play: it is only
    // "Live" while the umpire is still reading the overs out
    var tabs = [(done ? "live|Stumps" : "live|Live"), "card|Scorecard", "charts|Charts", "teams|Lineups"].map(function (t9) {
      var p9 = t9.split("|");
      return "<button type='button' class='" + (T.tab === p9[0] ? "on" : "") + "' onclick='foFeedTab(\"" + p9[0] + "\")'>" + p9[1] + "</button>";
    }).join("");
    var body;
    if (T.tab === "card") body = cardPanel(inns, m, done);
    else if (T.tab === "charts") body = chartsPanel(inns, m, live);
    else if (T.tab === "teams") body = teamsPanel(m, rid);
    else body = "<div class='fd-work'>" +
      "<div class='fd-wfeed'>" + livePanel(seen, done, I, tp) + "</div>" +
      "<div class='fd-wside'>" + (done ? closePanel(inns, m) : creasePanel(inns, innNow, tp, live)) + "</div>" +
      "</div>";
    page.innerHTML = shell(rid, cal, live ? "live" : done ? "fin" : "up", m,
      stage +
      "<div class='fd-tabs'>" + tabs + "</div>" +
      body +
      (cal.__fr
        ? "<div class='fd-foot'><a href='#/home'>&#8592; The club</a><a href='#/team?c=" + encodeURIComponent(m.away.__c || rid) + "&s=" + (m.away.slot | 0) + "'>The visitors &rsaquo;</a></div>"
        : "<div class='fd-foot'><a href='#/league?t=fixtures'>&#8592; The round</a><a href='#/home'>The club &rsaquo;</a></div>"));
  }

  // ---- BALL-BY-BALL, a timeline of the umpire's book -----------------------
  function livePanel(seen, done, I, tp) {
    var f = T.filter;
    var keep = function (r) {
      if (f === "b46") return r.out === "4" || r.out === "6";
      if (f === "wk") return (r.out && r.out[0] === "w" && r.out !== "wide") || r.out === "✕";
      if (f === "ov") return !!r._top;
      if (f === "fld") return !!fldTag(r);
      if (f === "fldg") { var tg = fldTag(r); return !!(tg && tg.k === "gr"); }
      if (f === "flde") { var te = fldTag(r); return !!(te && te.k === "ms"); }
      if (f === "fldw") { var tw = fldTag(r); return !!(tw && (tw.k === "ct" || tw.k === "ro")); }
      if (f === "note") return r.no === "" && !r._top;
      return true;
    };
    var rows = seen.filter(keep);
    // while the broadcast runs, the book keeps to the recent play - but one
    // press opens the whole thing, back to the toss, first innings and all;
    // at stumps it opens in full on its own
    var clipped = false;
    if (f === "all" && !done && !T.full && rows.length > 160) { rows = rows.slice(-160); clipped = true; }
    // the fall-of-wicket line rides inside its wicket's event
    var items = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.out === "✕" && items.length) {
        var prev = items[items.length - 1];
        if (prev.r.out && prev.r.out[0] === "w" && prev.r.out !== "wide") { prev.fow = r.txt; continue; }
      }
      items.push({ r: r });
    }
    var comm = items.reverse().map(function (it) {
      var r4 = it.r;
      if (r4._top) {
        var wb = parseWho(r4.oversumTop).bats;
        return "<div class='fd-ev top'><div class='w'>" + E(r4.txt) +
          (wb.length ? "<span class='os'>" + wb.map(function (b9) { return "<strong>" + E(b9.nm) + "</strong> " + b9.r + " (" + b9.b + "b)"; }).join(" &middot; ") + "</span>" : "") +
          "</div></div>";
      }
      if (r4.intro || r4.no === "") return "<div class='fd-ev note'><span class='ic'>" + (r4.out && r4.out !== "▶" ? E(r4.out) : "&#9873;") + "</span><div class='w'>" + E(window.foMrMend ? foMrMend(r4.txt) : r4.txt) + "</div></div>";
      var wk4 = r4.out && r4.out[0] === "w" && r4.out !== "wide";
      var txt = r4.txt || "", head = "", body9 = txt;
      var ci = txt.indexOf(" : ");
      if (ci > 0) { head = txt.slice(0, ci); body9 = txt.slice(ci + 3); }
      if (wk4) {
        var hb = surname(r4.bowlerNm), hs = surname(r4.strikerNm);
        var hl = (hb && hs)
          ? plink(r4.bowlerNm, hb.toUpperCase()) + " GETS " + plink(r4.strikerNm, hs.toUpperCase())
          : E((head || "WICKET").toUpperCase());
        body9 = body9.replace(/^WICKET\s*-\s*/, "");
        var wtg = fldTag(r4);
        return "<div class='fd-ev wkt'><span class='dot'>" + ring(r4.out) + "</span>" +
          "<div class='w'><span class='no'>" + E(r4.no) + "</span><b class='hl'>" + hl + "</b>" +
          (wtg && wtg.k !== "ct" ? "<span class='fdtag g'>" + wtg.lbl + "</span>" : "") +
          "<p>" + E(body9) + "</p>" +
          (it.fow ? "<span class='fowchip'>&#10007; " + E(it.fow) + "</span>" : "") + "</div></div>";
      }
      var dtg = fldTag(r4);
      var headHtml = (r4.bowlerNm && r4.strikerNm)
        ? plink(r4.bowlerNm, surname(r4.bowlerNm)) + " to " + plink(r4.strikerNm, surname(r4.strikerNm))
        : E(head);
      return "<div class='fd-ev'><span class='dot'>" + ring(r4.out) + "</span>" +
        "<div class='w'><span class='no'>" + E(r4.no) + "</span><b>" + headHtml + "</b>" +
        (dtg ? "<span class='fdtag " + (dtg.good ? "g" : "b") + "'>" + dtg.lbl + "</span>" : "") +
        "<p>" + E(body9) + "</p></div></div>";
    }).join("");
    // the header's right hand: the over in progress and the last over's line
    var curOv = I && I.lastNo ? Math.ceil(parseFloat(I.lastNo)) : (tp ? tp.over : null);
    var lastLn = "";
    if (I && I.top) {
      var lw = /\((\d+) runs?(?:, (\d+) wkts?)?\)/.exec(I.top.txt || "");
      if (lw) lastLn = "<span class='lo'>last over " + lw[1] + " run" + (lw[1] === "1" ? "" : "s") + (lw[2] ? " &middot; " + lw[2] + " wkt" : "") + "</span>";
    }
    var ovRings = I && I.sinceTop.length ? "<span class='seq'>" + I.sinceTop.map(function (r3) { return ring(r3.out); }).join("") + "</span>" : "";
    var sel = ["all|The lot", "b46|4s &amp; 6s", "wk|Wickets", "fld|In the field &middot; all", "fldg|&nbsp;&nbsp;Great fielding", "flde|&nbsp;&nbsp;Misfields &amp; drops", "fldw|&nbsp;&nbsp;Catches &amp; run outs", "ov|Overs", "note|The notes"].map(function (c9) {
      var p9 = c9.split("|");
      return "<option value='" + p9[0] + "'" + (T.filter === p9[0] ? " selected" : "") + ">" + p9[1] + "</option>";
    }).join("");
    return "<div class='fd-panel fd-bbb'>" +
      "<div class='fd-bh'><div class='tl'><b>BALL-BY-BALL</b><span>The Umpire&rsquo;s Book</span></div>" +
      "<div class='tr'>" + (curOv ? "<span class='ov9'>OVER " + curOv + "</span>" : "") + lastLn + ovRings +
      "<select class='fd-fsel' onchange='foFeedFilter(this.value)'>" + sel + "</select></div></div>" +
      "<div class='fd-tl'>" + (comm || "<p class='fd-dim'>" + (T.filter === "all" ? "The first ball is moments away." : "Nothing under that heading yet.") + "</p>") +
      (clipped ? "<button type='button' class='fd-allbtn' onclick='foFeedAll()'>Read the whole book &middot; back to the toss</button>" : "") + "</div></div>";
  }

  // WHO TAKES THE NEXT BALL. Read off the umpire's book by the laws of the
  // game itself: an odd number of batted runs crosses the batters, the end
  // of an over (the banner just printed) swaps the ends, and a wicket means
  // the new man is still walking out - no dot until the umpire names him.
  function nextStriker(I) {
    var last = I.sinceTop.length ? I.sinceTop[I.sinceTop.length - 1] : null;
    var overEnded = false;
    if (!last) { last = I.lastDel || null; overEnded = true; }
    if (!last || !last.strikerNm) return null;
    var S = last.strikerNm, o = last.out, t = last.txt || "";
    if (o && o[0] === "w" && o !== "wide") return null;
    var crossed = false;
    if (o === "1" || o === "3") crossed = true;
    else if ((o === "bye" || o === "legbye") && !/\btwo\b|\bfour\b/i.test(t)) crossed = true;
    else if (o === "wide" && /they cross|come back|single/i.test(t)) crossed = true;
    var other = crossed !== overEnded;                 // one swap flips, two cancel
    if (!other) return S;
    if (I.who && I.who.bats) {
      for (var k = 0; k < I.who.bats.length; k++)
        if (surname(I.who.bats[k].nm).toLowerCase() !== surname(S).toLowerCase()) return I.who.bats[k].nm;
    }
    return null;
  }

  // ---- HOW IT FINISHED, the panel that replaces the crease at stumps -------
  // "At the crease" beside a match that ended an hour ago is the single
  // loudest way a finished page can still look live: two men not out, a
  // bowler mid-spell, a partnership still growing. After the last ball the
  // same corner answers the only question left - who made the runs and who
  // took the wickets - one innings at a time, in the order they were played.
  function closePanel(inns, m) {
    var best = function (arr, cmp) {
      var b = null;
      (arr || []).forEach(function (x) { if (!b || cmp(x, b) > 0) b = x; });
      return b;
    };
    var out = "";
    for (var ix = 0; ix < 2; ix++) {
      var I = inns[ix];
      if (!I.open && !I.bats.length) continue;
      var nm = I.team || (ix ? m.away.name : m.home.name);
      var sc = I.close ? I.close.runs + "/" + I.close.wkts : "";
      var tb = best(I.bats.filter(function (b9) { return b9.r != null; }),
        function (a, b) { return (a.r | 0) - (b.r | 0); });
      // the wickets in this innings were taken by the OTHER side, so the
      // bowling line is labelled rather than left to sit under a club name
      // it does not belong to
      var tw = best(I.bowls.filter(function (b9) { return b9.w != null; }),
        function (a, b) { return ((a.w | 0) - (b.w | 0)) || ((b.r | 0) - (a.r | 0)); });
      if (!tb && !tw) continue;
      // the fielding side is simply the other innings' batting side, named
      // from the umpire's own print wherever he has made one
      var oth = inns[ix ? 0 : 1];
      var fieldNm = oth.team || (ix ? m.home.name : m.away.name);
      out += (out ? "<div class='dv'></div>" : "") +
        "<div class='sh'>" + E(nm) + (sc ? " &middot; " + sc : "") + "</div>";
      if (tb) out += "<div class='cb'><span class='nm'>" + plink(tb.nm) + pstar(tb.nm, T.rid) + "</span>" +
        "<span class='rv'>" + tb.r + (tb.out ? "" : "*") + "</span>" +
        "<span class='bv'>" + (tb.b == null ? "" : "(" + tb.b + ")") + "</span></div>";
      if (tw) out += "<div class='cb bw'><span class='nm'>" + plink(tw.nm) + pstar(tw.nm, T.rid) + "</span>" +
        "<span class='rv'>" + tw.o + "&ndash;" + tw.r + "</span><span class='wv'>" + tw.w + "</span></div>";
      out += "<div class='lbl cap'><span>" + (tb ? "Top score" : "") +
        (tb && tw ? ", and best bowling for " + E(fieldNm) : tw ? "Best bowling for " + E(fieldNm) : "") +
        "</span></div>";
    }
    if (!out) {
      return "<div class='fd-panel fd-crease'><div class='fd-bh'><div class='tl'><b>HOW IT FINISHED</b></div></div>" +
        "<p class='fd-dim'>The card carries the full account of it.</p>" +
        "<button type='button' class='fd-viewsc' onclick='foFeedTab(\"card\")'>View the scorecard</button></div>";
    }
    return "<div class='fd-panel fd-crease'>" +
      "<div class='fd-bh'><div class='tl'><b>HOW IT FINISHED</b></div></div>" +
      out +
      "<button type='button' class='fd-viewsc' onclick='foFeedTab(\"card\")'>View the scorecard</button>" +
      "</div>";
  }

  // ---- AT THE CREASE, the situation beside the book ------------------------
  function creasePanel(inns, innNow, tp, live) {
    var I = inns[innNow];
    var rows = "";
    var nxt = nextStriker(I), sn = surname(nxt || "");
    if (I.who && I.who.bats.length) {
      rows = I.who.bats.map(function (b9) {
        var onStrike = sn && surname(b9.nm) === sn;
        return "<div class='cb'><span class='nm'>" + (onStrike ? "<i class='st' title='takes the next ball'></i>" : "") + plink(b9.nm) + pstar(b9.nm, T.rid) + "<span class='ss'>" + sStars(b9.nm, "bat") + "</span></span><span class='rv'>" + b9.r + "*</span><span class='bv'>(" + b9.b + ")</span></div>";
      }).join("");
      // a fresh man at the crease the umpire has not printed a tally for yet
      var fsn = surname(I.striker || "");
      if (fsn && !I.who.bats.some(function (b9) { return surname(b9.nm) === fsn; }))
        rows += "<div class='cb'><span class='nm'>" + (sn && fsn === sn ? "<i class='st' title='takes the next ball'></i>" : "") + E(I.striker) + pstar(I.striker, T.rid) + "</span><span class='rv new'>new man</span></div>";
    } else if (I.striker) {
      rows = "<div class='cb'><span class='nm'>" + (sn && surname(I.striker) === sn ? "<i class='st' title='takes the next ball'></i>" : "") + E(I.striker) + pstar(I.striker, T.rid) + "</span><span class='rv new'>at the crease</span></div>";
    }
    var bowl = "";
    if (I.who && I.who.bowl) {
      bowl = "<div class='sh'>BOWLING</div><div class='cb bw'><span class='nm'>" + plink(I.who.bowl.nm) + pstar(I.who.bowl.nm, T.rid) + "<span class='ss'>" + sStars(I.who.bowl.nm, "bowl") + "</span></span>" +
        "<span class='rv'>" + I.who.bowl.o + "&ndash;" + I.who.bowl.r + "</span><span class='wv'>" + I.who.bowl.w + "</span></div>" +
        "<div class='lbl'><span></span><span>O&ndash;R</span><span>W</span></div>";
    } else if (I.bowler) {
      bowl = "<div class='sh'>BOWLING</div><div class='cb bw'><span class='nm'>" + E(I.bowler) + pstar(I.bowler, T.rid) + "</span><span class='rv new'>opening spell</span></div>";
    }
    // the stand: runs from the umpire's two latest prints, balls counted
    // straight off the book. Between a wicket and the next print the runs are
    // unprinted, so only the balls are shown.
    var pship = "";
    if (I.open && !I.close) {
      var lastF = I.fow.length ? I.fow[I.fow.length - 1] : null;
      var pr = (tp && (!lastF || tp.wkts === lastF.w)) ? tp.runs - (lastF ? lastF.score : 0) : null;
      var parts = [];
      if (pr != null && pr >= 0) parts.push(pr + " RUN" + (pr === 1 ? "" : "S"));
      parts.push(I.pshipBalls + " BALL" + (I.pshipBalls === 1 ? "" : "S"));
      pship = "<div class='sh'>PARTNERSHIP</div><div class='pv'>" + parts.join(" &middot; ") + "</div>";
    }
    var curOv = I.sinceTop.length ? "<div class='sh'>CURRENT OVER</div><div class='seq'>" + I.sinceTop.map(function (r3) { return ring(r3.out); }).join("") + "</div>" : "";
    if (!rows && !bowl) {
      return "<div class='fd-panel fd-crease'><div class='fd-bh'><div class='tl'><b>AT THE CREASE</b></div></div>" +
        "<p class='fd-dim'>The umpire names the men at the crease from the first over.</p>" +
        "<button type='button' class='fd-viewsc' onclick='foFeedTab(\"card\")'>View the scorecard</button></div>";
    }
    return "<div class='fd-panel fd-crease'>" +
      "<div class='fd-bh'><div class='tl'><b>AT THE CREASE</b></div></div>" +
      rows +
      (bowl ? "<div class='dv'></div>" + bowl : "") +
      ((pship || curOv) ? "<div class='dv'></div>" + pship + curOv : "") +
      "<button type='button' class='fd-viewsc' onclick='foFeedTab(\"card\")'>View the scorecard</button>" +
      "</div>";
  }

  // ---- THE LIVE SCORECARD, from the umpire's prints ------------------------
  // THE CARD, SET AS A CARD RATHER THAN AS A TABLE. It was five columns of a
  // plain table: a man's name wrapped onto two lines, his dismissal wrapped
  // onto two more, and a batter took ninety pixels of a phone. Nine of them
  // and five bowlers ran past three screens, which is why the room read long
  // and flat however good the cricket was.
  //
  // A row is one line a man now - name over dismissal in the small print,
  // figures in three tight columns - so the whole innings fits a screen. What
  // colour there is, is doing work: the pair AT THE CREASE carry an indigo
  // rail, a hundred goes bronze, and the bowler in his spell carries a green
  // dot. Nothing here is a new measurement: the striker, the bowler and every
  // figure are already in the umpire's prints.
  function howOut(b9) {
    if (!b9.out) return "not out";
    var o = b9.out, bw = E(surname(o.bowler || ""));
    return o.how === "caught" && o.fld ? "c " + E(surname(o.fld)) + " b " + bw
      : o.how === "bowled" ? "b " + bw
      : o.how === "lbw" ? "lbw b " + bw
      : o.how === "stumped" ? "st &dagger; b " + bw : E(o.how);
  }
  function cardPanel(inns, m, done) {
    var out = "";
    for (var ix = 0; ix < 2; ix++) {
      var I = inns[ix];
      if (!I.open && !I.bats.length) continue;
      var nm9 = I.team || (ix ? m.away.name : m.home.name);
      var tp9 = I.close ? { runs: I.close.runs, wkts: I.close.wkts } : (I.top ? parseTop(I.top.txt) : null);
      var ov9 = I.lastNo ? String(I.lastNo) : (tp9 && tp9.over != null ? tp9.over + ".0" : "");
      var rr9 = (tp9 && ov9) ? (function (o8) {
        var w8 = Math.floor(o8), b8 = Math.round((o8 - w8) * 10);
        var balls = w8 * 6 + b8;
        return balls > 0 ? (tp9.runs / (balls / 6)).toFixed(2) : null;
      })(parseFloat(ov9)) : null;
      var live9 = !I.close && I.open && !done;
      var crease = {};
      // the two men not out are the two at the crease; the striker is the one
      // the last delivery was bowled to
      I.bats.forEach(function (b8) { if (!b8.out) crease[bKey(b8.nm)] = 1; });
      out += "<div class='fd-sc'>" +
        "<div class='fd-sc-h'><div><b>" + E(nm9) + "</b>" +
          (ov9 ? "<u>" + E(ov9) + " overs" + (rr9 ? " &middot; RR " + rr9 : "") + "</u>" : "") + "</div>" +
          "<div class='sc'><em>" + (tp9 ? tp9.runs + "/" + tp9.wkts : "&mdash;") + "</em>" +
          (live9 ? "<span class='lv'><s></s>LIVE</span>" : I.close ? "<span class='cl'>CLOSED</span>" : "") +
          "</div></div>" +
        "<div class='fd-sc-c'><span>Batting</span><span>R</span><span>B</span><span>SR</span></div>" +
        I.bats.map(function (b9) {
          var sr = (b9.r != null && b9.b > 0) ? Math.round(b9.r / b9.b * 100) : null;
          var on = !b9.out && live9, ton = (b9.r | 0) >= 100, fifty = (b9.r | 0) >= 50 && !ton;
          return "<div class='fd-sc-r" + (on ? " on" : "") + (ton ? " ton" : fifty ? " fifty" : "") + "'>" +
            "<div class='w'><b>" + plink(b9.nm) + pstar(b9.nm, T.rid) +
              "<span class='ss'>" + sStars(b9.nm, "bat") + "</span></b>" +
              "<i>" + howOut(b9) + (on ? " &middot; at the crease" : "") + "</i></div>" +
            "<div class='r'>" + (b9.r != null ? b9.r + (b9.out ? "" : "*") : "&mdash;") + "</div>" +
            "<div class='b'>" + (b9.b != null ? b9.b : "&mdash;") + "</div>" +
            "<div class='s'>" + (sr != null ? sr : "&mdash;") + "</div></div>";
        }).join("") +
        // EXTRAS, SO THE CARD ADDS UP. The umpire's total counts wides,
        // no-balls, byes and leg byes and the rows above never did, so the
        // batting came up short of the score with nothing to say where the
        // difference went. This book keeps no breakdown - the over summaries
        // it is read from carry the score and the batters, not the byes - but
        // extras ARE the score less the batting, so the figure is exact.
        //
        // A SUBTRACTION IS ONLY EXTRAS IF NOBODY IS MISSING FROM IT. This book
        // is read off the umpire's running commentary, and a card built from a
        // book the broadcast has not finished - or one whose early overs have
        // been pruned - is short of batters. Subtracting then does not measure
        // the byes, it measures whoever is not on the card.
        //
        // So the card has to account for every man who has been to the middle:
        // that is one per wicket plus the two at the crease, and ten or more
        // once the side is bowled out. And every one of them needs a tally the
        // umpire has actually published - mid-over a new batter is named with
        // no figures yet. Fail either and the row is left off, because a
        // missing line is better than a wrong number.
        (function () {
          if (!tp9 || !I.bats.length) return "";
          var w8 = tp9.wkts | 0, want = w8 >= 10 ? 10 : w8 + 2;
          if (I.bats.length < want) return "";
          if (!I.bats.every(function (b8) { return b8.r != null; })) return "";
          var exN = (tp9.runs | 0) - I.bats.reduce(function (t, b8) { return t + (b8.r | 0); }, 0);
          if (exN < 0) return "";
          return "<div class='fd-sc-r fd-sc-ex'><div class='w'><b>Extras</b></div>" +
            "<div class='r'>" + exN + "</div><div class='b'></div><div class='s'></div></div>";
        })() +
        (tp9 ? "<div class='fd-sc-t'><span>" + tp9.wkts + " wicket" + (tp9.wkts === 1 ? "" : "s") +
          (ov9 ? " &middot; " + E(ov9) + " overs" : "") + "</span><b>" + tp9.runs + "</b></div>" : "") +
        // WHO IS LEFT. Under the total, the way a card has always carried it:
        // the men still padded up while the innings is alive, and the men who
        // never got in once it is over.
        (function () {
          var yet = fdYetToBat(nm9, m, T.rid, I.bats.map(function (b8) { return b8.nm; }));
          if (!yet.length) return "";
          return "<div class='fd-sc-yet'><span>" + (live9 ? "Yet to bat" : "Did not bat") + "</span>" +
            "<div>" + yet.map(function (n9) { return plink(n9) + pstar(n9, T.rid); }).join(", ") + "</div></div>";
        })() +
        (I.bowls.length ? "<div class='fd-sc-c bwl'><span>Bowling</span><span>O</span><span>R</span>" +
          "<span>W</span><span title='wides and no-balls charged to him'>Ex</span><span>Econ</span></div>" +
          I.bowls.map(function (w9) {
            // the umpire's figure line carries whole overs; runs over overs
            // is the economy, printed to one decimal like every broadcast
            var ec9 = w9.o > 0 ? (w9.r / w9.o).toFixed(1) : null;
            var onB = live9 && I.bowler && bKey(I.bowler) === bKey(w9.nm);
            var ex9 = (I.exBy && I.exBy[bKey(w9.nm)]) || 0;
            return "<div class='fd-sc-b" + (onB ? " on" : "") + "'>" +
              "<b>" + plink(w9.nm) + pstar(w9.nm, T.rid) + "<span class='ss'>" + sStars(w9.nm, "bowl") + "</span></b>" +
              "<span>" + w9.o + "</span><span>" + w9.r + "</span><span class='wk'>" + w9.w + "</span>" +
              "<span class='ex" + (ex9 ? " sm" : "") + "'>" + ex9 + "</span>" +
              "<span>" + (ec9 != null ? ec9 : "&mdash;") + "</span></div>";
          }).join("") : "") +
        "</div>";
      if (ix === 0 && I.brk) out += "<div class='fd-note'>" + E(I.brk) + "</div>";
    }
    if (!out) out = "<p class='fd-dim'>The umpire prints the first tallies at the end of over one.</p>";
    // AT STUMPS IT IS NOT A LIVE SCORECARD, it is the card. The caption and
    // the footnote below it both describe a book still being written, and
    // both were still saying so an hour after the last ball.
    return "<div class='fd-panel'><div class='fd-ch'>" +
      (done ? "The scorecard" : "The live scorecard") + "</div>" + out +
      
      "</div>";
  }
  // the partnership ladder: every stand from the umpire's fall-of-wicket
  // lines, and the unbroken stand as the difference of his two latest scores.
  // It lives on the charts tab - it IS a chart - so the scorecard stays the
  // two tables a card is.
  function partHtml(I) {
    var tp = I.close || (I.top ? (function (t9) { return t9 ? { runs: t9.runs, wkts: t9.wkts } : null; })(parseTop(I.top.txt)) : null);
    var items = I.fow.map(function (fw) {
      return { lbl: ordinal(fw.w) + " wicket", p: fw.p, note: E(fw.nm) + " " + fw.r + " (" + fw.b + "b) &middot; fell at " + fw.score + "/" + fw.w + (fw.no ? " &middot; ov " + fw.no : "") };
    });
    // the stand still standing - and at stumps the stand that WON, which the
    // old guard dropped the moment the innings closed. An all-out innings has
    // no unbroken stand: its last fall IS the total.
    if (tp && tp.wkts < 10) {
      var lastF = I.fow.length ? I.fow[I.fow.length - 1].score : 0;
      var cur = tp.runs - lastF;
      if (cur >= 0 && (!I.fow.length || tp.wkts === I.fow[I.fow.length - 1].w))
        items.push({ lbl: ordinal(tp.wkts + 1) + " wicket", p: cur, note: "unbroken", live: !I.close });
    }
    if (!items.length) return "";
    var mx = Math.max.apply(null, items.map(function (x) { return x.p; }).concat([1]));
    return items.map(function (x) {
      return "<div class='fd-pr" + (x.live ? " lv" : "") + "'><span class='l'>" + x.lbl + "</span>" +
        "<span class='bar'><i style='width:" + Math.max(3, Math.round(x.p / mx * 100)) + "%'></i></span>" +
        "<span class='v'>" + x.p + "</span><span class='nt'>" + x.note + "</span></div>";
    }).join("");
  }
  function ordinal(n) { return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : n + "th"; }

  // ---- THE CHARTS: worm and manhattan from the end-of-over prints ----------
  function chartsPanel(inns, m, live) {
    var any = inns[0].overs.length || inns[1].overs.length;
    if (!any) return "<div class='fd-panel'><div class='fd-ch'>The charts</div><p class='fd-dim'>The worm starts crawling at the end of over one.</p></div>";
    var W = 640, H = 270, padL = 36, padB = 26, padT = 18, padR = 14;
    var maxOv = 50;
    var maxSc = 20;
    inns.forEach(function (I) { I.overs.forEach(function (o) { if (o.runs > maxSc) maxSc = o.runs; }); });
    if (inns[1].target && inns[1].target > maxSc) maxSc = inns[1].target;
    maxSc = Math.ceil((maxSc + 12) / 20) * 20;
    var X = function (ov) { return padL + (W - padL - padR) * ov / maxOv; };
    var Y = function (sc) { return H - padB - (H - padB - padT) * sc / maxSc; };
    var COL = ["#14243A", "#C9571F"];
    // the gradients that make the paper glow a little
    var defs = "<defs>" +
      "<linearGradient id='fdA0' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#14243A' stop-opacity='.20'/><stop offset='1' stop-color='#14243A' stop-opacity='0'/></linearGradient>" +
      "<linearGradient id='fdA1' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#C9571F' stop-opacity='.22'/><stop offset='1' stop-color='#C9571F' stop-opacity='0'/></linearGradient>" +
      "<linearGradient id='fdB0' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#2C4467'/><stop offset='1' stop-color='#14243A'/></linearGradient>" +
      "<linearGradient id='fdB1' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#E8894A'/><stop offset='1' stop-color='#C9571F'/></linearGradient>" +
      "</defs>";
    var grid = "";
    for (var g = 0; g <= maxSc; g += Math.max(20, Math.ceil(maxSc / 5 / 20) * 20))
      grid += "<line x1='" + padL + "' y1='" + Y(g) + "' x2='" + (W - padR) + "' y2='" + Y(g) + "' class='gl'/><text x='" + (padL - 6) + "' y='" + (Y(g) + 3) + "' class='ax e'>" + g + "</text>";
    for (var gx = 10; gx <= maxOv; gx += 10)
      grid += "<line x1='" + X(gx) + "' y1='" + padT + "' x2='" + X(gx) + "' y2='" + (H - padB) + "' class='gv'/><text x='" + X(gx) + "' y='" + (H - 8) + "' class='ax m'>" + gx + "</text>";
    // a smooth hand for the same printed points: the curve passes through
    // every end-of-over score the umpire wrote, softened between them
    function smoothPath(pts) {
      if (pts.length < 2) return "M" + pts[0][0] + " " + pts[0][1];
      var d = "M" + pts[0][0] + " " + pts[0][1];
      for (var k = 1; k < pts.length; k++) {
        var mx = (pts[k - 1][0] + pts[k][0]) / 2, my = (pts[k - 1][1] + pts[k][1]) / 2;
        d += "Q" + pts[k - 1][0] + " " + pts[k - 1][1] + " " + mx + " " + my;
      }
      d += "L" + pts[pts.length - 1][0] + " " + pts[pts.length - 1][1];
      return d;
    }
    var areas = "", worm = "", dots = "", chips = "";
    inns.forEach(function (I, ix) {
      if (!I.overs.length) return;
      var pts = [[X(0), Y(0)]].concat(I.overs.map(function (o) { return [X(o.over), Y(o.runs)]; }));
      var line = smoothPath(pts);
      var last = pts[pts.length - 1];
      areas += "<path d='" + line + "L" + last[0] + " " + Y(0) + "L" + X(0) + " " + Y(0) + "Z' fill='url(#fdA" + ix + ")'/>";
      worm += "<path d='" + line + "' class='wl' style='stroke:" + COL[ix] + "'/>";
      I.fow.forEach(function (fw) {
        var ov9 = parseFloat(fw.no) || null;
        if (ov9 != null) dots += "<circle cx='" + X(ov9) + "' cy='" + Y(fw.score) + "' r='4.5' class='wd' style='fill:#B23230'/>";
      });
      // the endpoint wears its score: a chip at the head of the worm, and a
      // pulse while that innings is still being read out
      var lastO = I.overs[I.overs.length - 1];
      var isLive = live && I.open && !I.close && (ix === 1 || !inns[1].open);
      var lbl = lastO.runs + "/" + lastO.wkts;
      var cw = 16 + lbl.length * 7.5;
      var cx9 = Math.min(last[0], W - padR - cw - 2), cy9 = Math.max(padT + 10, last[1] - 22);
      chips += (isLive ? "<circle cx='" + last[0] + "' cy='" + last[1] + "' r='9' style='fill:" + COL[ix] + "' opacity='.18' class='lvp'/>" : "") +
        "<circle cx='" + last[0] + "' cy='" + last[1] + "' r='4.5' style='fill:" + COL[ix] + "' class='ep'/>" +
        "<rect x='" + cx9 + "' y='" + (cy9 - 12) + "' width='" + cw + "' height='17' rx='8.5' style='fill:" + COL[ix] + "'/>" +
        "<text x='" + (cx9 + cw / 2) + "' y='" + cy9 + "' class='chip'>" + lbl + "</text>";
    });
    var tgt = "";
    if (inns[1].target) {
      var tw = 52 + String(inns[1].target).length * 6;
      tgt = "<line x1='" + padL + "' y1='" + Y(inns[1].target) + "' x2='" + (W - padR) + "' y2='" + Y(inns[1].target) + "' class='tl'/>" +
        "<rect x='" + (W - padR - tw) + "' y='" + (Y(inns[1].target) - 20) + "' width='" + tw + "' height='15' rx='7.5' class='tchip'/>" +
        "<text x='" + (W - padR - tw / 2) + "' y='" + (Y(inns[1].target) - 9) + "' class='ttxt'>TARGET " + inns[1].target + "</text>";
    }
    var leg = inns.map(function (I, ix) {
      if (!I.overs.length) return "";
      var lastO = I.overs[I.overs.length - 1];
      var rr = lastO.over > 0 ? (lastO.runs / lastO.over) : null;
      return "<span class='lg'><i style='background:" + COL[ix] + "'></i>" + E(I.team || (ix ? m.away.name : m.home.name)) +
        (rr != null ? "<b>" + rr.toFixed(2) + " an over</b>" : "") + "</span>";
    }).join("");
    // the ask: what the chase still needs of every remaining over
    var ask = "";
    if (live && inns[1].open && !inns[1].close && inns[1].target && inns[1].overs.length) {
      var lo = inns[1].overs[inns[1].overs.length - 1];
      var need = inns[1].target - lo.runs, left = maxOv - lo.over;
      if (need > 0 && left > 0) ask = "<span class='lg ask'><b>needs " + need + " from " + (left * 6) + " balls &middot; " + (need / left).toFixed(2) + " an over</b></span>";
    }
    var wormSvg = "<svg viewBox='0 0 " + W + " " + H + "' class='fd-svg'>" + defs + grid + areas + tgt + worm + dots + chips + "</svg>";
    // the manhattan: the umpire's "(N runs)" per over, every wicket flagged
    // above the over it fell in, the biggest over crowned in gold
    var maxR = 1, best = null;
    inns.forEach(function (I, ix) { I.overs.forEach(function (o) { if (o.ovRuns > maxR) { maxR = o.ovRuns; best = ix + ":" + o.over; } }); });
    var H2 = 190, bw = (W - padL - padR) / maxOv / 2 - 1;
    var Y2 = function (v) { return H2 - padB - (H2 - padB - padT) * v / (maxR + 3); };
    var bars = "";
    for (var g2 = 0; g2 <= maxR + 2; g2 += 5)
      bars += "<line x1='" + padL + "' y1='" + Y2(g2) + "' x2='" + (W - padR) + "' y2='" + Y2(g2) + "' class='gl'/><text x='" + (padL - 6) + "' y='" + (Y2(g2) + 3) + "' class='ax e'>" + g2 + "</text>";
    for (var gx2 = 10; gx2 <= maxOv; gx2 += 10)
      bars += "<text x='" + X(gx2) + "' y='" + (H2 - 8) + "' class='ax m'>" + gx2 + "</text>";
    inns.forEach(function (I, ix) {
      var wkByOver = {};
      I.fow.forEach(function (fw) { var o9 = Math.ceil(parseFloat(fw.no)) || 0; wkByOver[o9] = (wkByOver[o9] || 0) + 1; });
      I.overs.forEach(function (o) {
        var x0 = X(o.over - 1) + (ix ? bw + 1 : 0);
        var crown = best === (ix + ":" + o.over);
        bars += "<rect x='" + x0 + "' y='" + Y2(o.ovRuns) + "' width='" + bw + "' height='" + Math.max(0, Y2(0) - Y2(o.ovRuns)) + "' rx='2.5' fill='url(#fdB" + ix + ")'" + (crown ? " class='crown'" : "") + "/>";
        var nw = wkByOver[o.over] || 0;
        for (var w9 = 0; w9 < nw; w9++)
          bars += "<circle cx='" + (x0 + bw / 2) + "' cy='" + (Y2(o.ovRuns) - 7 - w9 * 9) + "' r='3.4' class='wd' style='fill:#B23230'/>";
      });
    });
    var mhSvg = "<svg viewBox='0 0 " + W + " " + H2 + "' class='fd-svg'>" + defs + bars + "</svg>";
    // the partnership ladders, one per innings that has begun
    var psh = "";
    inns.forEach(function (I, ix) {
      if (!I.fow.length && !I.top) return;
      var lad = partHtml(I);
      if (lad) psh += "<div class='fd-ch' style='margin-top:18px'>Partnerships &middot; " +
        E(I.team || (ix ? m.away.name : m.home.name)) + "</div>" + lad;
    });
    return "<div class='fd-panel'><div class='fd-ch'>The worm &middot; from the end-of-over prints</div>" +
      "<div class='fd-leg'>" + leg + ask + "</div>" + wormSvg +
      "<div class='fd-ch' style='margin-top:18px'>The manhattan &middot; runs each over, wickets flagged</div>" + mhSvg + psh + "</div>";
  }

  // ---- THE LINEUPS: the sheets the managers filed --------------------------
  // A BOT CLUB FIELDS ELEVEN MEN LIKE ANYBODY ELSE. Only a claimed club files
  // a sheet, so this panel had nothing to print for the other nine and said
  // the engine would name the XI at the toss - which is true, and useless to
  // a reader looking at the side his club is playing. The engine's pick is a
  // pure function of the squad (keeper, the five best bowlers, the best bats,
  // in mpos order), the same function the watch page has always shown, so the
  // eleven can be named here too. Captain and gloves come out the same way
  // the engine takes them: the coolest head in the XI, the best-batting
  // keeper in it.
  function fdEngineXI(slot, nat) {
    try {
      var wt = window.__foWT;
      if (!wt || !wt.actualXI || !wt.serverSquad || slot == null) return null;
      var men = wt.serverSquad(nat, slot);
      if (!men || men.length < 11) return null;
      var xi = wt.actualXI(men, null);
      if (!xi || xi.length !== 11) return null;
      var kp = null, capt = null, cv = -1;
      xi.forEach(function (p) {
        if (p.keeper && (!kp || (p.bat || 0) > (kp.bat || 0))) kp = p;
        var c = p.capt || 50; if (c > cv) { cv = c; capt = p.name; }
      });
      return { names: xi.map(function (p) { return p.name; }), captain: capt, keeper: kp ? kp.name : null };
    } catch (e) { return null; }
  }
  // WHO IS STILL PADDED UP. A card that lists only the men who have been in
  // answers "what has happened" and never "what is left", and the second is
  // the question a reader watching a collapse is actually asking. The order
  // is the one the teamsheets panel already prints - the manager's own if he
  // filed one, the engine's pick if he did not - so the two rooms name the
  // same eleven in the same order or neither does.
  //
  // Matching is by initial-and-surname, because the umpire abbreviates in his
  // over summaries ("R. Whitehead") and a teamsheet does not. A name that
  // cannot be matched stays on the list, which reads as one man too many; a
  // looser match would drop a man who is genuinely still to bat, which reads
  // as a side with nobody left.
  function fdYetToBat(teamNm, m, rid, onCard) {
    try {
      var ord = (T.ord && T.ord[T.id]) || {};
      var o = ord[teamNm], list = o && (o.batOrder || o.xi), names = null;
      if (list && list.length) {
        names = list.slice(0, 11).map(function (p9) { return typeof p9 === "string" ? p9 : (p9 && p9.name) || ""; });
      } else {
        var side = m && m.home && m.home.name === teamNm ? m.home
                 : (m && m.away && m.away.name === teamNm ? m.away : null);
        var eng = side ? fdEngineXI(side.slot, side.__c || rid) : null;
        names = eng ? eng.names : null;
      }
      if (!names || !names.length) return [];
      var seen = {};
      (onCard || []).forEach(function (n9) { seen[bKey(n9)] = 1; });
      return names.filter(function (n9) { return n9 && !seen[bKey(n9)]; });
    } catch (e) { return []; }
  }

  function teamsPanel(m, rid) {
    var ord = T.ord[T.id];
    if (!ord) return "<div class='fd-panel'><div class='fd-ch'>The teamsheets</div><p class='fd-dim'>Fetching the named elevens&hellip;</p></div>";
    var col = function (nm, slot, nat) {
      var o = ord[nm];
      var list = o && (o.batOrder || o.xi);
      var named = !!(list && list.length), eng = named ? null : fdEngineXI(slot, nat || rid);
      if (!named && !eng) return "<div class='c'><b>" + tlink(nm, slot, nat || rid) + "</b><u>no sheet filed &middot; the engine names the XI at the toss</u></div>";
      var men = named ? list.slice(0, 11).map(function (p9) { return typeof p9 === "string" ? p9 : (p9 && p9.name) || ""; })
                      : eng.names;
      var capt = named ? o.captain : eng.captain, keep = named ? o.keeper : eng.keeper;
      return "<div class='c'><b>" + tlink(nm, slot, nat || rid) + "</b>" +
        "<u>" + (named ? "manager&rsquo;s named order" : "no sheet filed &middot; the engine&rsquo;s XI") + "</u>" +
        men.map(function (n9, k) {
          return "<span><i>" + (k + 1) + "</i>" + plink(n9) + pstar(n9, rid) + "<u class='ssin'>" + sStars(n9, "bat") + "</u>" +
            (capt === n9 ? " <em>C</em>" : "") + (keep === n9 ? " &dagger;" : "") + "</span>";
        }).join("") +
        (named && o.tossCall ? "<u class='t2'>toss call " + (o.tossCall === "H" ? "heads" : "tails") + (o.tossDecision ? " &middot; would " + E(o.tossDecision) + " first" : "") + "</u>" : "") +
        "</div>";
    };
    return "<div class='fd-panel'><div class='fd-ch'>The teamsheets &middot; public from an hour before the first ball</div>" +
      "<div class='fd-xic'>" + col(m.home.name, m.home.slot, m.home.__c) + col(m.away.name, m.away.slot, m.away.__c) + "</div></div>";
  }

  function shell(rid, cal, state, m, inner) {
    var wt = window.__foWT, flag = "";
    try { if (wt && wt.flagOf) flag = "<img class='fd-flag' src='" + wt.flagOf(rid) + "' alt=''>"; } catch (eF) {}
    var chip = state === "live" ? "<span class='fd-live'><i></i>LIVE</span>"
      : state === "fin" ? "<span class='fd-fin'>STUMPS</span>"
      : state === "up" ? "<span class='fd-fin'>FIRST BALL SOON</span>" : "";
    var ground = m && m.home ? "<span class='vd'></span><span class='gr'>" + E(m.home.name) + "&rsquo;s ground" + (m.home.city ? " &middot; " + E(m.home.city) : "") + "</span>" : "";
    var fr = cal && cal.__fr;
    return "<div class='fo-fd'><div class='fd-in'>" +
      "<div class='fd-meta'><a class='fd-back' href='" + (fr ? "#/home" : "#/league?t=fixtures") + "'>&larr; " + (fr ? "Back to the club" : "Back to Fixtures") + "</a>" + flag +
      "<span class='fd-lg'>" + E(rid).toUpperCase() + (fr ? " &middot; FRIENDLY" : (cal && cal.round ? " &middot; ROUND " + cal.round : "")) + "</span>" + ground + chip + "</div>" +
      inner + "</div></div>";
  }
  window.addEventListener("hashchange", function () {
    if ((location.hash || "").split("?")[0] !== "#/feed") {
      document.body.classList.remove("fo-fd-on");
      try { clearInterval(T.timer); clearTimeout(T.timer); } catch (e) {}
    }
  });
  function css() {
    if (document.getElementById("fo-fd-css")) return;
    var s = document.createElement("style"); s.id = "fo-fd-css";
    s.textContent = [
      // the page's tokens, drawn from the game's standing palette
      ".fo-fd{--fon9:#0A1A30;--fon:#14243A;--focream:#F1EEE6;--fopaper:#FFFEFC;--foor:#C9571F;--fogold:#E8B96A;--fowkt:#B23230;--foink:#14243A;--fomut:#8a8272;--fobrd:#e3dccb;--fosoftred:#FBEFEA}",
      // the theatre's clean cream room, given the full width of the house
      "html body.ftpskin.fo-fd-on,html body.fo-fd-on{background:#F1EEE6 !important}",
      "html body.fo-fd-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body.fo-fd-on #page{padding:0 !important;margin:0 !important;background:transparent !important}",
      // the nav stands a little taller here, and the day box speaks quietly
      "html body.fo-fd-on #topbar#topbar{min-height:68px}",
      "html body.fo-fd-on #topbar#topbar #fo-wclock{background:transparent !important;border-color:transparent !important;box-shadow:none !important;opacity:.85}",
      ".fo-fd{position:relative;min-height:70vh;color:var(--foink);font-family:Manrope,-apple-system,sans-serif}",
      ".fo-fd .fd-in{max-width:1240px;margin:0 auto;padding:16px 24px 60px}",
      "@media(min-width:1400px){.fo-fd .fd-in{padding-left:44px;padding-right:44px}}",
      // ---- the build-up, before a ball is bowled
      ".fo-fd .fd-pm{margin-top:14px;padding:18px 20px 20px}",
      ".fo-fd .fd-pmc{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid var(--fobrd)}",
      ".fo-fd .fd-pmc span{font:600 11px/1 Manrope,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:var(--fomut)}",
      ".fo-fd .fd-pmc b{font:700 26px/1 Manrope,sans-serif;letter-spacing:-.02em;color:var(--foink);font-variant-numeric:tabular-nums}",
      ".fo-fd .fd-pmnote{margin:13px 0 0;font:400 13px/1.6 Manrope,sans-serif;color:#5d6472;max-width:66ch}",
      ".fo-fd .fd-pmrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-top:16px}",
      ".fo-fd .fd-pmk{border-left:3px solid var(--foor);padding:2px 0 2px 12px}",
      ".fo-fd .fd-pmk span{display:block;font:600 11px/1 Manrope,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:var(--fomut)}",
      ".fo-fd .fd-pmk b{display:block;margin-top:7px;font:600 16px/1.15 Manrope,sans-serif;letter-spacing:-.01em;color:var(--foink)}",
      ".fo-fd .fd-pmk u{display:block;margin-top:5px;font:400 13px/1.5 Manrope,sans-serif;color:#6c7382;text-decoration:none}",
      ".fo-fd .fd-pmsides{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:start;margin-top:20px;padding-top:18px;border-top:1px solid var(--fobrd)}",
      ".fo-fd .fd-pmv{align-self:center;font:600 12px/1 Manrope,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--fomut)}",
      ".fo-fd .fd-pmst{font:600 11px/1 Manrope,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:var(--fomut)}",
      "html body #page .fo-fd .fd-pmsn{display:block;margin-top:7px;font:600 17px/1.15 Manrope,sans-serif;letter-spacing:-.015em;color:var(--foink) !important;text-decoration:none !important}",
      "html body #page .fo-fd .fd-pmsn:hover{color:#B44A22 !important}",
      ".fo-fd .fd-pmmen{margin-top:11px;display:flex;flex-direction:column;gap:6px}",
      ".fo-fd .fd-pmmen span{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font:500 12.5px/1.3 Manrope,sans-serif;color:#3c4453;border-bottom:1px solid rgba(20,36,58,.06);padding-bottom:5px}",
      ".fo-fd .fd-pmmen span:last-child{border-bottom:0}",
      ".fo-fd .fd-pmmen u{text-decoration:none;font:700 12.5px/1 Manrope,sans-serif;color:var(--foink);font-variant-numeric:tabular-nums}",
      ".fo-fd .fd-pmtags{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}",
      ".fo-fd .fd-pmtags em{font:600 11px/1 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--fomut);background:rgba(20,36,58,.05);border-radius:999px;padding:6px 10px 5px}",
      ".fo-fd .fd-pmtags em.fl{color:#8a6a1f;background:rgba(232,185,106,.2)}",
      ".fo-fd .fd-pmtags em.tt{color:#2F6B45;background:rgba(47,107,69,.11)}",
      ".fo-fd .fd-pmform{display:flex;gap:4px;margin-top:11px}",
      ".fo-fd .fd-pmform i{width:20px;height:20px;border-radius:5px;display:flex;align-items:center;justify-content:center;font:700 11px/1 Manrope,sans-serif;color:#FFFEFC}",
      ".fo-fd .fd-pmform i.w{background:#2F6B45}.fo-fd .fd-pmform i.l{background:#8C2B2B}.fo-fd .fd-pmform i.t{background:#8a8272}",
      ".fo-fd .fd-pmnone{color:var(--fomut);font:400 13px/1.4 Manrope,sans-serif}",
      "@media(max-width:640px){.fo-fd .fd-pm{padding:15px 14px 16px}.fo-fd .fd-pmc b{font-size:22px}",
      ".fo-fd .fd-pmsides{grid-template-columns:1fr;gap:16px}.fo-fd .fd-pmv{display:none}}",
      // ---- the metadata row, one line above the stage
      ".fo-fd .fd-meta{display:flex;align-items:center;gap:11px;flex-wrap:wrap;min-height:46px;margin-bottom:10px}",
      "html body #page .fo-fd .fd-back{display:inline-flex;align-items:center;min-height:44px;font:600 13px/1 Manrope,sans-serif;color:#14243A !important;text-decoration:none !important;white-space:nowrap}",
      ".fo-fd .fd-flag{width:24px;height:16px;object-fit:cover;border-radius:2.5px;box-shadow:0 1px 3px rgba(14,35,63,.25)}",
      ".fo-fd .fd-lg{font:700 12px/1 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--foink);white-space:nowrap}",
      ".fo-fd .fd-meta .vd{width:1px;height:16px;background:rgba(20,36,58,.18)}",
      ".fo-fd .fd-meta .gr{font:400 13.5px/1.3 Manrope,sans-serif;color:var(--fomut)}",
      ".fo-fd .fd-live{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font:800 11px/1 Manrope,sans-serif;letter-spacing:.16em;color:#B23230}",
      ".fo-fd .fd-live i{width:8px;height:8px;border-radius:50%;background:#B23230;animation:foFdPulse 1.6s ease-in-out infinite}",
      "@keyframes foFdPulse{0%,100%{opacity:1}50%{opacity:.3}}",
      ".fo-fd .fd-fin{margin-left:auto;font:700 11px/1 Manrope,sans-serif;letter-spacing:.14em;color:rgba(20,32,47,.55)}",
      // ---- THE MATCH STAGE: home ground behind a deep navy wash
      ".fo-fd .fd-stage{position:relative;overflow:hidden;min-height:250px;border-radius:16px;background:linear-gradient(120deg,var(--fon9),var(--fon));background-size:cover;background-position:center;color:#FFFEFC;box-shadow:0 10px 30px rgba(14,35,63,.2);display:flex;align-items:stretch}",
      ".fo-fd .fd-stagein{position:relative;flex:1;display:flex;flex-direction:column;padding:26px 30px 18px;min-width:0}",
      ".fo-fd .fd-teams{display:flex;align-items:baseline;gap:11px;flex-wrap:wrap}",
      ".fo-fd .fd-teams b{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:clamp(22px,2.4vw,30px);color:#FFFEFC;letter-spacing:.01em}",
      ".fo-fd .fd-teams i{font-style:normal;font-family:Fraunces,Georgia,serif;font-size:15px;color:var(--foor)}",
      ".fo-fd .fd-cond{font:500 13.5px/1.6 Manrope,sans-serif;color:#F1EEE6;text-shadow:0 1px 10px rgba(7,22,46,.65);margin-top:4px}",
      // THE SCORE BUG: while the cricket is on, the batting side owns the
      // header with a gold dot; the opponent is one small caps line; the sky,
      // the square and the toss are chips, not a sentence
      ".fo-fd .fd-bugchips{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:0 0 13px}",
      ".fo-fd .fd-bugchips .ch{display:inline-flex;align-items:center;gap:6px;font:700 11px/1 Manrope,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:rgba(244,239,228,.75);background:rgba(255,253,247,.08);border:1px solid rgba(255,253,247,.14);border-radius:999px;padding:6px 10px;white-space:nowrap}",
      ".fo-fd .fd-bugchips .ch svg{display:block;flex:none}",
      ".fo-fd .fd-bugchips .ch i{width:9px;height:9px;border-radius:3px;flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}",
      ".fo-fd .fd-bugchips .ch.toss{margin-left:auto}",
      ".fo-fd .fd-bug{display:flex;align-items:center;gap:10px}",
      ".fo-fd .fd-bug b{font:700 clamp(24px,6.4vw,32px)/1 Manrope,sans-serif;text-transform:uppercase;letter-spacing:.02em;color:#FFFEFC;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".fo-fd .fd-bug b a{color:inherit !important;text-decoration:none !important}",
      ".fo-fd .fd-bug s{width:9px;height:9px;border-radius:50%;background:var(--fogold);text-decoration:none;flex:none}",
      ".fo-fd .fd-bugsub{margin-top:6px;font:600 11px/1.5 Manrope,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(244,239,228,.55)}",
      ".fo-fd .fd-bugsub a{color:rgba(244,239,228,.75) !important;text-decoration:none !important}",
      ".fo-fd .fd-bugsub a:hover{color:#FFFEFC !important}",
      ".fo-fd .fd-scorerow{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-top:8px}",
      ".fo-fd .fd-scorerow em{font-style:normal;font:700 clamp(48px,6vw,68px)/1 Manrope,sans-serif;color:#FFFEFC;font-variant-numeric:tabular-nums;letter-spacing:.01em}",
      ".fo-fd .fd-scorerow span{font:700 21px/1 Manrope,sans-serif;color:var(--fogold);font-variant-numeric:tabular-nums}",
      ".fo-fd .fd-scorerow span u{text-decoration:none;font-size:13px;letter-spacing:.16em}",
      ".fo-fd .fd-scorerow .op{font:400 15px/1.5 Fraunces,Georgia,serif;color:rgba(255,254,252,.8)}",
      ".fo-fd .fd-mets{display:flex;gap:0;margin-top:14px;flex-wrap:wrap}",
      ".fo-fd .fd-mets .mt{padding:0 22px;border-left:1px solid rgba(255,254,252,.16)}",
      ".fo-fd .fd-mets .mt:first-child{padding-left:0;border-left:none}",
      ".fo-fd .fd-mets u{display:block;text-decoration:none;font:700 11px/1 Manrope,sans-serif;letter-spacing:.2em;color:rgba(255,254,252,.5);margin-bottom:5px}",
      ".fo-fd .fd-mets b{font:700 21px/1 Manrope,sans-serif;color:#FFFEFC;font-variant-numeric:tabular-nums}",
      ".fo-fd .fd-mets b s{text-decoration:none;font-size:13px;color:var(--fogold)}",
      // the final totals name two clubs rather than three short captions,
      // so their labels are given room to be read and to wrap
      ".fo-fd .fd-mets .mt.wide{max-width:52%}",
      ".fo-fd .fd-mets .mt.wide u{font-size:10px;line-height:1.3;letter-spacing:.12em;white-space:normal;overflow-wrap:anywhere}",
      // the innings-progress strip along the stage floor
      ".fo-fd .fd-strip{display:flex;align-items:center;gap:10px;margin-top:auto;padding-top:18px}",
      ".fo-fd .fd-strip .s0,.fo-fd .fd-strip .s1{font:700 11px Manrope,sans-serif;color:rgba(255,254,252,.45)}",
      ".fo-fd .fd-strip .bar{position:relative;flex:1;height:4px;border-radius:99px;background:rgba(143,168,204,.28)}",
      ".fo-fd .fd-strip .bar i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:linear-gradient(90deg,var(--fogold),var(--foor))}",
      ".fo-fd .fd-strip .bar em{position:absolute;top:50%;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;background:var(--fogold);color:var(--fon9);font:700 11px/24px Manrope,sans-serif;font-style:normal;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.35)}",
      ".fo-fd .fd-sub{font:400 14px/1.6 Fraunces,Georgia,serif;color:rgba(255,254,252,.78);margin-top:10px}",
      "html body #page .fo-fd .fd-enter{display:inline-block;margin-top:14px;font:600 14px/1 Manrope,sans-serif;letter-spacing:.01em;color:#FFFEFC !important;background:var(--foor) !important;border:none;border-radius:999px;padding:12px 22px;cursor:pointer;text-align:center;text-decoration:none !important;align-self:flex-start}",
      "html body #page .fo-fd .fd-ftime{display:flex;align-items:baseline;gap:11px;flex-wrap:wrap;margin:12px 0 0}",
      "html body #page .fo-fd .fd-ftime u{text-decoration:none;flex:none;font:700 11px/1 Manrope,sans-serif;letter-spacing:.22em;color:#E8B96A}",
      "html body #page .fo-fd .fd-ftime b{font:600 16px/1.35 Fraunces,Georgia,serif;font-weight:600;color:#FFFEFC}",
      // ---- the tab rail: an almanack rule with an underline
      ".fo-fd .fd-tabs{display:flex;gap:2px;margin:18px 0 0;border-bottom:1px solid #d8d0bd;overflow-x:auto;scrollbar-width:none}",
      ".fo-fd .fd-tabs::-webkit-scrollbar{display:none}",
      "html body #page .fo-fd .fd-tabs button{flex:0 0 auto;font:700 13px Manrope,sans-serif !important;letter-spacing:.01em;color:#6A6354 !important;background:transparent !important;border:none !important;border-bottom:2px solid transparent !important;border-radius:0 !important;box-shadow:none !important;padding:14px 16px 12px !important;margin:0 0 -1px !important;cursor:pointer;transition:color .15s}",
      "html body #page .fo-fd .fd-tabs button.on{color:#14243A !important;font-weight:700 !important;border-bottom-color:#C9571F !important}",
      "html body #page .fo-fd .fd-tabs button:hover{color:#14243A !important}",
      // ---- the two-column live workspace
      ".fo-fd .fd-work{display:grid;grid-template-columns:1fr;grid-template-areas:'side' 'feed';gap:18px;margin-top:14px;align-items:start}",
      "@media(min-width:900px){.fo-fd .fd-work{grid-template-columns:minmax(0,2.15fr) minmax(300px,1fr);grid-template-areas:'feed side';gap:28px}}",
      ".fo-fd .fd-wfeed{grid-area:feed;min-width:0}",
      ".fo-fd .fd-wside{grid-area:side;min-width:0}",
      "@media(min-width:900px){.fo-fd .fd-wside{position:sticky;top:84px}}",
      ".fo-fd .fd-panel{background:rgba(255,254,250,.96);border:1px solid #ddd5c7;border-radius:14px;box-shadow:0 8px 24px rgba(22,31,42,.06);padding:16px 18px;margin-top:14px}",
      ".fo-fd .fd-work .fd-panel{margin-top:0}",
      // ---- the ball-by-ball header
      ".fo-fd .fd-bh{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}",
      ".fo-fd .fd-bh .tl b{font:700 13px Manrope,sans-serif;letter-spacing:.18em;color:var(--foink)}",
      ".fo-fd .fd-bh .tl span{display:block;font:400 13px Fraunces,Georgia,serif;color:var(--fomut);margin-top:2px}",
      ".fo-fd .fd-bh .tr{display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
      ".fo-fd .fd-bh .ov9{font:700 11px Manrope,sans-serif;letter-spacing:.14em;color:var(--foor)}",
      ".fo-fd .fd-bh .lo{font:400 13px Manrope,sans-serif;color:var(--fomut)}",
      ".fo-fd .seq{display:inline-flex;gap:5px;flex-wrap:wrap}",
      ".fo-fd .seq i,.fo-fd .fd-ev .dot i{font-style:normal;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:#F1EEE6;border:1px solid var(--fobrd);font:700 11px/1 Manrope,sans-serif;color:#6d6455}",
      // boundaries ring green, wickets ring red - the reading at a glance
      ".fo-fd .seq i.b,.fo-fd .fd-ev .dot i.b{background:#177A57;border-color:#177A57;color:#fff}",
      ".fo-fd .seq i.w,.fo-fd .fd-ev .dot i.w{background:#B23230;border-color:#B23230;color:#fff}",
      "html body #page .fo-fd .fd-fsel{font:600 13px Manrope,sans-serif;color:#6A6354;background:#F6F3EB;border:1px solid var(--fobrd);border-radius:8px;padding:6px 9px;cursor:pointer}",
      // ---- the timeline of events
      ".fo-fd .fd-tl{position:relative;padding-left:2px}",
      ".fo-fd .fd-tl:before{content:'';position:absolute;left:14px;top:10px;bottom:10px;width:1px;background:#ece5d3}",
      ".fo-fd .fd-ev{position:relative;display:flex;align-items:flex-start;gap:13px;padding:10px 2px;border-bottom:1px solid #f3eee1}",
      ".fo-fd .fd-ev:last-child{border-bottom:none}",
      ".fo-fd .fd-ev .dot{position:relative;z-index:1;flex:0 0 26px}",
      ".fo-fd .fd-ev .w{flex:1;min-width:0}",
      ".fo-fd .fd-ev .no{font:700 13px Manrope,sans-serif;color:var(--fomut);font-variant-numeric:tabular-nums;margin-right:8px}",
      ".fo-fd .fd-ev b{font:600 13.5px Manrope,sans-serif;color:var(--foink)}",
      ".fo-fd .fd-ev p{margin:3px 0 0;font:400 13px/1.55 Manrope,sans-serif;color:#4a4436}",
      // wickets: restrained fire
      ".fo-fd .fd-ev.wkt{background:var(--fosoftred);border-radius:10px;border-bottom:none;padding:13px 12px;margin:4px 0}",
      ".fo-fd .fd-ev.wkt .hl{font:700 13px Manrope,sans-serif;letter-spacing:.08em;color:var(--fowkt)}",
      ".fo-fd .fd-ev.wkt .fowchip{display:inline-block;margin-top:8px;font:600 13px Manrope,sans-serif;color:#6d4a42;background:rgba(255,254,252,.72);border:1px solid #e8c9b8;border-radius:8px;padding:5px 9px}",
      // notes: marginalia, not cards
      ".fo-fd .fd-ev.note{border-bottom:none;padding:6px 2px}",
      ".fo-fd .fd-ev.note .ic{position:relative;z-index:1;flex:0 0 26px;text-align:center;color:var(--foor);font-size:12px;line-height:22px}",
      ".fo-fd .fd-ev.note .w{font:400 12.5px/1.55 Fraunces,Georgia,serif;color:#a05f2e}",
      // over banners
      ".fo-fd .fd-ev.top{border-bottom:none;padding:8px 0}",
      ".fo-fd .fd-ev.top .w{position:relative;z-index:1;font:700 13px Manrope,sans-serif;color:var(--foink);background:#F6F3EB;border-radius:8px;padding:8px 11px}",
      ".fo-fd .fd-ev.top .w .os{display:block;margin-top:4px;font:400 13px/1.5 Manrope,sans-serif;color:#6d6455}",
      ".fo-fd .fd-ev.top .w .os strong{font-weight:600;color:var(--foink)}",
      // ---- at the crease
      ".fo-fd .fd-crease .cb{display:flex;align-items:baseline;gap:8px;padding:6px 0;font:400 13.5px Manrope,sans-serif}",
      ".fo-fd .fd-crease .cb .nm{flex:1;font-weight:600;color:var(--foink);display:flex;align-items:center;gap:7px;min-width:0;flex-wrap:wrap}",
      ".fo-fd .fd-crease .cb .nm i.st{width:7px;height:7px;border-radius:50%;background:var(--foor);flex:0 0 7px}",
      ".fo-fd .fd-crease .cb .rv{font:700 14px Manrope,sans-serif;color:var(--foink);font-variant-numeric:tabular-nums}",
      ".fo-fd .fd-crease .cb .rv.new{font:400 13px Fraunces,Georgia,serif;color:var(--fomut)}",
      ".fo-fd .fd-crease .cb .bv{font:400 12.5px Manrope,sans-serif;color:var(--fomut);font-variant-numeric:tabular-nums}",
      ".fo-fd .fd-crease .cb .wv{font:700 16px Manrope,sans-serif;color:var(--foor)}",
      ".fo-fd .fd-crease .lbl{display:flex;justify-content:flex-end;gap:14px;font:700 11px Manrope,sans-serif;letter-spacing:.14em;color:#b3ab99}",
      ".fo-fd .fd-crease .lbl.cap{justify-content:flex-start;letter-spacing:.08em;text-transform:none;font:400 12px/1.4 Manrope,sans-serif;color:var(--fomut);margin-top:3px}",
      ".fo-fd .fd-crease .lbl span:first-child{flex:1}",
      ".fo-fd .fd-crease .dv{height:1px;background:#efe9d9;margin:10px 0}",
      ".fo-fd .fd-crease .sh{font:700 11px Manrope,sans-serif;letter-spacing:.18em;color:var(--fomut);margin:2px 0 6px}",
      ".fo-fd .fd-crease .pv{font:700 13px Manrope,sans-serif;letter-spacing:.06em;color:var(--foink);margin-bottom:10px}",
      "html body #page .fo-fd .fd-allbtn{display:block;width:100%;margin-top:10px;font:700 11px Manrope,sans-serif !important;letter-spacing:.16em;text-transform:uppercase;color:#C9571F !important;background:transparent !important;border:1px dashed #e0b9a4 !important;border-radius:10px;padding:11px;cursor:pointer}",
      "html body #page .fo-fd .fd-allbtn:hover{border-style:solid !important}",
      "html body #page .fo-fd .fd-viewsc{display:block;width:100%;margin-top:14px;font:600 13px Manrope,sans-serif !important;letter-spacing:.01em;color:var(--foink) !important;background:transparent !important;border:1px solid rgba(20,36,58,.3) !important;border-radius:12px;padding:11px;min-height:44px;background:#FFFEFC !important;cursor:pointer;text-align:center;transition:border-color .15s}",
      "html body #page .fo-fd .fd-viewsc:hover{border-color:var(--foor) !important;color:var(--foor) !important}",
      // ---- the scorecard tables
      ".fo-fd .fd-ch{font:700 11px Manrope,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:var(--fomut);margin:2px 0 8px}",
      // ---- THE CARD, SET AS A CARD (the "Court" treatment) ----------------
      // A white ground, cool graphite type and ONE strong accent. The old
      // table is gone: a batter is a row 44px tall with his dismissal in the
      // small print under his name, so an innings fits a screen instead of
      // running past three. Indigo marks a man at the crease, bronze marks a
      // hundred, green marks the bowler in his spell - three jobs, three
      // colours, and no colour that is not doing one of them.
      ".fo-fd{--fdind:#3D4EE0;--fdgrn:#0EA47A;--fdbrz:#B07C22;--fdline:#EAECF2;--fdalt:#F7F8FB;--fdink:#0F1522;--fdmut:#79808E}",
      ".fo-fd .fd-sc{background:#FFFFFF;border:1px solid var(--fdline);border-radius:14px;overflow:hidden;margin:10px 0 14px}",
      ".fo-fd .fd-sc-h{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:14px 16px 12px;border-bottom:1px solid var(--fdline)}",
      ".fo-fd .fd-sc-h b{display:block;font:700 16px Manrope,sans-serif;letter-spacing:-.01em;color:var(--fdink)}",
      ".fo-fd .fd-sc-h u{display:block;text-decoration:none;font:600 11px Manrope,sans-serif;color:var(--fdmut);margin-top:2px;font-variant-numeric:tabular-nums}",
      ".fo-fd .fd-sc-h .sc{text-align:right;flex:none}",
      ".fo-fd .fd-sc-h em{font-style:normal;font:800 25px/1 Manrope,sans-serif;color:var(--fdind);font-variant-numeric:tabular-nums;letter-spacing:-.02em}",
      ".fo-fd .fd-sc-h .lv,.fo-fd .fd-sc-h .cl{display:flex;align-items:center;justify-content:flex-end;gap:5px;font:800 9.5px Manrope,sans-serif;letter-spacing:.14em;margin-top:5px;color:var(--fdgrn)}",
      ".fo-fd .fd-sc-h .cl{color:var(--fdmut)}",
      ".fo-fd .fd-sc-h .lv s{width:6px;height:6px;border-radius:50%;background:var(--fdgrn);text-decoration:none;animation:fdPulse 1.4s ease-in-out infinite}",
      "@keyframes fdPulse{0%,100%{opacity:1}50%{opacity:.3}}",
      "@media(prefers-reduced-motion:reduce){.fo-fd .fd-sc-h .lv s{animation:none}}",
      ".fo-fd .fd-sc-c,.fo-fd .fd-sc-r{display:grid;grid-template-columns:minmax(0,1fr) 38px 30px 38px;gap:8px;align-items:center;padding:0 16px}",
      ".fo-fd .fd-sc-c{height:28px;background:var(--fdalt);border-bottom:1px solid var(--fdline)}",
      ".fo-fd .fd-sc-c span{font:800 9px Manrope,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--fdmut);text-align:right}",
      ".fo-fd .fd-sc-c span:first-child{text-align:left}",
      ".fo-fd .fd-sc-r{min-height:44px;padding-top:5px;padding-bottom:5px;border-bottom:1px solid var(--fdline)}",
      ".fo-fd .fd-sc-r .w{min-width:0}",
      ".fo-fd .fd-sc-r .w b{display:flex;align-items:center;gap:5px;font:600 13.5px/1.25 Manrope,sans-serif;color:var(--fdink);min-width:0}",
      ".fo-fd .fd-sc-r .w b>a,.fo-fd .fd-sc-b b>a{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".fo-fd .fd-sc-r .w i{display:block;font-style:normal;font:400 10.5px/1.35 Manrope,sans-serif;color:var(--fdmut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-fd .fd-sc-r .r{font:800 14.5px Manrope,sans-serif;text-align:right;color:var(--fdink);font-variant-numeric:tabular-nums}",
      ".fo-fd .fd-sc-r .b,.fo-fd .fd-sc-r .s{font:500 12.5px Manrope,sans-serif;text-align:right;color:var(--fdmut);font-variant-numeric:tabular-nums}",
      // extras is a line of the card, not a man on it: no face, no strike rate
      ".fo-fd .fd-sc-ex{min-height:38px}",
      ".fo-fd .fd-sc-ex .w b{font-weight:500;color:var(--fdmut)}",
      ".fo-fd .fd-sc-ex .r{font-weight:600;color:var(--fdmut)}",
      ".fo-fd .fd-sc-r.on{background:#F4F6FF;box-shadow:inset 3px 0 0 var(--fdind)}",
      ".fo-fd .fd-sc-r.on .r{color:var(--fdind)}",
      ".fo-fd .fd-sc-r.ton .r,.fo-fd .fd-sc-r.on.ton .r{color:var(--fdbrz)}",
      ".fo-fd .fd-sc-r.fifty .r{color:var(--fdink)}",
      ".fo-fd .fd-sc-t{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 16px;background:var(--fdalt)}",
      ".fo-fd .fd-sc-t span{font:700 10px Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--fdmut)}",
      ".fo-fd .fd-sc-t b{font:800 15px Manrope,sans-serif;color:var(--fdink);font-variant-numeric:tabular-nums}",
      ".fo-fd .fd-sc-yet{display:grid;grid-template-columns:96px minmax(0,1fr);gap:10px;align-items:baseline;padding:11px 16px;border-top:1px solid var(--fdline)}",
      ".fo-fd .fd-sc-yet>span{font:800 9px Manrope,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--fdmut)}",
      ".fo-fd .fd-sc-yet>div{font:500 12.5px/1.5 Manrope,sans-serif;color:var(--fdink)}",
      "@media(max-width:560px){.fo-fd .fd-sc-yet{grid-template-columns:minmax(0,1fr);gap:4px;padding-left:13px;padding-right:13px}}",
      ".fo-fd .fd-sc-b,.fo-fd .fd-sc-c.bwl{display:grid;grid-template-columns:minmax(0,1fr) 30px 32px 22px 26px 40px;gap:8px;align-items:center}",
      ".fo-fd .fd-sc-b{padding:9px 16px;border-top:1px solid var(--fdline)}",
      // a column of figures with no heading is a column of guesses
      ".fo-fd .fd-sc-c.bwl{padding:0 16px;border-top:1px solid var(--fdline)}",
      ".fo-fd .fd-sc-b span.ex{color:#B0B6C2}",
      ".fo-fd .fd-sc-b span.ex.sm{color:var(--fdmut)}",
      ".fo-fd .fd-sc-b b{display:flex;align-items:center;gap:5px;font:600 12.5px Manrope,sans-serif;color:var(--fdink);min-width:0}",
      ".fo-fd .fd-sc-b span{text-align:right;font:500 12px Manrope,sans-serif;color:var(--fdmut);font-variant-numeric:tabular-nums}",
      ".fo-fd .fd-sc-b span.wk{font-weight:800;color:var(--fdink)}",
      ".fo-fd .fd-sc-b.on{background:#F1FBF7}",
      ".fo-fd .fd-sc-b.on b:before{content:'';flex:none;width:6px;height:6px;border-radius:50%;background:var(--fdgrn)}",
      // the ten-star strip is what a reader needs least beside the runs when
      // the screen is narrow, and it is what made the old table too wide
      "@media(max-width:560px){.fo-fd .fd-sc .ss{display:none}",
      ".fo-fd .fd-sc-c,.fo-fd .fd-sc-r{grid-template-columns:minmax(0,1fr) 36px 28px 34px;padding-left:13px;padding-right:13px}",
      ".fo-fd .fd-sc-h,.fo-fd .fd-sc-t{padding-left:13px;padding-right:13px}}",
      ".fo-fd .fd-note{font:400 13px/1.6 Fraunces,Georgia,serif;color:var(--fomut);margin:8px 0 2px}",
      // partnerships
      ".fo-fd .fd-ph{font:700 11px Manrope,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--fomut);margin:10px 0 6px}",
      ".fo-fd .fd-pr{display:grid;grid-template-columns:74px 1fr 34px;gap:4px 10px;align-items:center;padding:3px 0;font:400 13px Manrope,sans-serif}",
      ".fo-fd .fd-pr .l{font:700 11px Manrope,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6A6354}",
      ".fo-fd .fd-pr .bar{height:9px;background:#F1EEE6;border-radius:99px;overflow:hidden}",
      ".fo-fd .fd-pr .bar i{display:block;height:100%;background:var(--foink);border-radius:99px}",
      ".fo-fd .fd-pr.lv .bar i{background:var(--foor)}",
      ".fo-fd .fd-pr .v{text-align:right;font:700 12.5px Manrope,sans-serif;color:var(--foink);font-variant-numeric:tabular-nums}",
      ".fo-fd .fd-pr .nt{grid-column:2/4;font:400 13px Fraunces,Georgia,serif;color:var(--fomut);margin-top:-2px}",
      // charts
      ".fo-fd .fd-svg{width:100%;height:auto;display:block}",
      ".fo-fd .fd-svg .gl{stroke:#efe9d9;stroke-width:1}",
      ".fo-fd .fd-svg .gv{stroke:#f4efe2;stroke-width:1}",
      ".fo-fd .fd-svg .ax{font:600 10px Manrope,sans-serif;fill:#8a8272}",
      ".fo-fd .fd-svg .ax.e{text-anchor:end}",
      ".fo-fd .fd-svg .ax.m{text-anchor:middle}",
      ".fo-fd .fd-svg .wl{fill:none;stroke-width:2.8;stroke-linejoin:round;stroke-linecap:round}",
      ".fo-fd .fd-svg .wd{stroke:#FFFEFC;stroke-width:1.6}",
      ".fo-fd .fd-svg .ep{stroke:#FFFEFC;stroke-width:1.6}",
      ".fo-fd .fd-svg .lvp{animation:fdPing 1.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}",
      "@keyframes fdPing{0%,100%{transform:scale(.6);opacity:.28}50%{transform:scale(1.25);opacity:.1}}",
      "@media(prefers-reduced-motion:reduce){.fo-fd .fd-svg .lvp,.fo-fd .fd-live i{animation:none}}",
      ".fo-fd .fd-svg .chip{font:700 11px Manrope,sans-serif;letter-spacing:.06em;fill:#FFFEFC;text-anchor:middle}",
      ".fo-fd .fd-svg .tl{stroke:#E8B96A;stroke-width:1.8;stroke-dasharray:6 5}",
      ".fo-fd .fd-svg .tchip{fill:#F8ECD4;stroke:#E8B96A;stroke-width:1}",
      ".fo-fd .fd-svg .ttxt{font:700 11px Manrope,sans-serif;letter-spacing:.12em;fill:#8a6a1f;text-anchor:middle}",
      ".fo-fd .fd-svg .crown{stroke:#E8B96A;stroke-width:1.6}",
      ".fo-fd .fd-leg{display:flex;gap:12px;margin:0 0 8px;flex-wrap:wrap;align-items:center}",
      ".fo-fd .fd-leg .lg{display:inline-flex;align-items:center;gap:6px;font:600 13px Manrope,sans-serif;color:#6A6354;background:#F6F3EB;border:1px solid #e8e1cf;border-radius:999px;padding:4px 11px}",
      ".fo-fd .fd-leg .lg i{width:14px;height:4px;border-radius:2px;display:inline-block}",
      ".fo-fd .fd-leg .lg b{font:700 11px Manrope,sans-serif;letter-spacing:.04em;color:#14243A;margin-left:2px}",
      ".fo-fd .fd-leg .lg.ask{background:#FBEFEA;border-color:#e8c9b8}",
      ".fo-fd .fd-leg .lg.ask b{color:#B23230}",
      // lineups
      ".fo-fd .fd-xic{display:grid;grid-template-columns:1fr 1fr;gap:14px}",
      ".fo-fd .fd-xic .c b{display:block;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:14px;color:var(--foink);margin-bottom:2px}",
      ".fo-fd .fd-xic .c u{display:block;text-decoration:none;font:700 11px Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--foor);margin-bottom:6px}",
      ".fo-fd .fd-xic .c u.t2{margin-top:8px;color:var(--fomut)}",
      ".fo-fd .fd-xic .c span{display:flex;align-items:baseline;gap:6px;font:400 13px/1.6 Manrope,sans-serif;color:var(--foink)}",
      ".fo-fd .fd-xic .c span i{font-style:normal;font:700 11px/1 Manrope,sans-serif;color:#b3ab99;width:13px;text-align:right}",
      // THE CAPTAIN'S MARK, AND ONLY THE CAPTAIN'S. A ten-star rating is ten
      // <em>s - the earned ones gold, the rest a faint stone - and this rule
      // was written for the single <em>C</em> beside a name. Being three
      // classes deep it outranked the strip's own colour, so every unearned
      // star came out in the house terracotta and a four-star batsman read as
      // six red ones. The direct-child mark reaches the C and nothing inside
      // the strip.
      ".fo-fd .fd-xic .c span > em{font-style:normal;font:700 11px Manrope,sans-serif;color:var(--foor)}",
      // strength stars: the roster's ladder, gold for the bat, teal for the ball
      ".fo-fd .fd-strn{display:inline-flex;line-height:1}",
      ".fo-fd .fd-strn .st{display:inline-flex;text-decoration:none}",
      ".fo-fd .fd-strn em{font-style:normal;font-size:13px;line-height:1;color:#ddd5c7;letter-spacing:.5px}",
      ".fo-fd .fdtag{display:inline-block;margin-left:8px;vertical-align:1px;font:700 11px Manrope,sans-serif;letter-spacing:.14em;border-radius:5px;padding:2.5px 6px}",
      ".fo-fd .fdtag.g{color:#177A57;background:#E8F3ED;border:1px solid #bfdccf}",
      ".fo-fd .fdtag.b{color:#B23230;background:#FBEFEA;border:1px solid #e8c9b8}",
      ".fo-fd .fd-strn.bt em.f{color:#E8B96A}",
      ".fo-fd .fd-strn.bt em.h{color:#E8B96A;opacity:.45}",
      ".fo-fd .fd-strn.bw em.f{color:#0FB4C4}",
      ".fo-fd .fd-strn.bw em.h{color:#0FB4C4;opacity:.45}",
      ".fo-fd .ss{display:block;flex-basis:100%;margin-top:1px}",
      // IN A CARD ROW THE STRIP IS NOT A LINE OF ITS OWN. flex-basis:100%
      // was written for the crease box, where the strip belongs under the
      // name. A card row does not wrap, so the strip claimed the entire
      // column and the anchor beside it - the NAME, the one thing on the row
      // a reader cannot do without - was shrunk to its minimum and clipped:
      // a hundred pixels of name in a column thirteen hundred wide. The
      // strip takes what it needs here, and if the two genuinely will not
      // fit the row wraps rather than eating him.
      ".fo-fd .fd-sc-r .ss,.fo-fd .fd-sc-b .ss{flex:0 0 auto;margin-top:0}",
      ".fo-fd .fd-sc-r .w b,.fo-fd .fd-sc-b b{flex-wrap:wrap}",
      ".fo-fd .ss:empty{display:none}",
      ".fo-fd .fd-xic .c span u.ssin{display:inline-flex;margin:0 0 0 4px;text-decoration:none}",
      "html body #page .fo-fd a.fd-plink,html body #page .fo-fd a.fd-plink:visited{color:inherit !important;text-decoration:none !important;border-bottom:none !important}",
      "html body #page .fo-fd a.fd-plink:hover{color:#C9571F !important}",
      "html body #page .fo-fd .fd-teams a.fd-plink:hover{color:#E8B96A !important}",
      ".fo-fd .fd-dim{font:400 13.5px Fraunces,Georgia,serif;color:var(--fomut);padding:24px 6px}",
      ".fo-fd .fd-rest{display:flex;flex-direction:column;gap:8px;padding:34px 6px 10px;max-width:430px}",
      ".fo-fd .fd-rest b{font:600 21px/1.25 Fraunces,Georgia,serif;color:var(--foink)}",
      ".fo-fd .fd-rest span{font:400 13.5px/1.6 Manrope,system-ui,sans-serif;color:var(--fomut)}",
      "html body #page .fo-fd .fd-rest a{font:600 11.5px/1 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#C9571F !important;text-decoration:none;margin-top:4px}",
      ".fo-fd .fd-foot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px 14px;margin-top:16px}",
      "html body #page .fo-fd .fd-foot a{font:700 11px Manrope,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#C9571F !important;text-decoration:none !important}",
      // ---- the phone: stacked, the crease first, the stage tighter
      "@media(max-width:640px){",
      ".fo-fd .fd-in{padding:12px 16px 50px}",
      ".fo-fd .fd-meta{min-height:0;gap:8px}",
      ".fo-fd .fd-meta .gr{display:none}",
      ".fo-fd .fd-stage{min-height:0}",
      ".fo-fd .fd-stagein{padding:18px 18px 14px}",
      ".fo-fd .fd-scorerow em{font-size:50px}",
      ".fo-fd .fd-scorerow span{font-size:17px}",
      ".fo-fd .fd-mets .mt{padding:0 13px}",
      ".fo-fd .fd-mets b{font-size:18px}",
      ".fo-fd .fd-xic{grid-template-columns:1fr}",
      ".fo-fd .fd-bh .tr{width:100%;justify-content:flex-start}",
      "}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
