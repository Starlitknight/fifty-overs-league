// ---- 44-feed-match.js — THE LIVE FEED (#/feed?n=rid&f=fi) -------------------
// From The Pavilion's law, client side: the match was simulated on the server
// at the first ball, so the live page is a READER, not an engine. One fetch of
// the umpire's banked ball-by-ball, each delivery revealed on the world clock,
// and every number on screen printed by the umpire himself - the end-of-over
// rows carry the running score, the batters' tallies and the bowlers' figures,
// the fall-of-wicket rows carry the partnerships, and the innings-break row
// carries the target. From those prints alone the page keeps a LIVE SCORECARD,
// the worm and the manhattan, the partnership ladder and the filed teamsheets,
// under the broadcast theatre's own dress. Nothing simulated, nothing invented:
// arithmetic on the umpire's numbers, never numbers of our own.
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
  // the over circles, in the theatre's own coding: gold for a boundary,
  // red for a wicket, quiet rings for the rest
  function ring(o) {
    var wk = o && o[0] === "w" && o !== "wide";
    var cls = (o === "4" || o === "6") ? " b" : wk ? " w" : "";
    var sym = o === "dot" ? "&middot;" : wk ? "W" : o === "wide" ? "wd" : o === "noball" ? "nb" : (o === "bye" || o === "legbye") ? "b" : E(o);
    return "<i class='" + cls.trim() + "'>" + sym + "</i>";
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
  function bKey(nm) { var c = String(nm || "").trim(); return (c[0] || "") .toLowerCase() + "|" + surname(c).toLowerCase(); }
  var HOW = { wB: "bowled", wC: "caught", wLBW: "lbw", wRO: "run out", wST: "stumped" };

  // ---- ONE PASS DOWN THE BOOK: everything the tabs need, per innings -------
  function bookState(seen) {
    var mk = function () { return { bats: [], byKey: {}, bowls: [], bowlByKey: {}, overs: [], fow: [], top: null, who: null, team: null, brk: null, target: null, striker: null, bowler: null, sinceTop: [], open: false }; };
    var inns = [mk(), mk()], pendingWk = null;
    for (var i = 0; i < seen.length; i++) {
      var r = seen[i]; if (!r) continue;
      var I = inns[(r.inn | 0) === 1 ? 1 : 0];
      // the umpire's opening line names the day: the weather, the pitch and
      // who called the toss right - it becomes the bug's conditions line
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
        if (r.strikerNm) {
          I.striker = r.strikerNm;
          var ks = bKey(r.strikerNm);
          if (!I.byKey[ks]) { var ne = { nm: r.strikerNm, r: null, b: null, out: null }; I.byKey[ks] = ne; I.bats.push(ne); }
        }
        if (r.bowlerNm) I.bowler = r.bowlerNm;
        if (r.out && r.out[0] === "w" && r.out !== "wide")
          pendingWk = { code: r.out, bowler: r.bowlerNm, fld: r.ev && r.ev.fldNm, no: r.no };
        continue;
      }
      if (r.out === "✕") {
        var fx = /Partnership ends at (\d+)\s*-\s*(.+?) out for (\d+)\s*\((\d+)\)\.\s*(.+?)\s+(\d+)\/(\d+)\./.exec(r.txt || "");
        if (fx) {
          var kd = bKey(fx[2]), ed = I.byKey[kd];
          if (!ed) { ed = { nm: fx[2], out: null }; I.byKey[kd] = ed; I.bats.push(ed); }
          ed.nm = fx[2]; ed.r = +fx[3]; ed.b = +fx[4];
          ed.out = pendingWk ? { how: HOW[pendingWk.code] || "out", bowler: pendingWk.bowler, fld: pendingWk.fld } : { how: "out" };
          I.fow.push({ p: +fx[1], nm: fx[2], r: +fx[3], b: +fx[4], score: +fx[6], w: +fx[7], no: pendingWk ? pendingWk.no : "" });
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

  var T = { id: null, timer: null, tab: "live", filter: "all", args: null, ord: {}, ordBusy: {} };
  window.foRenderFeedPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    var pl = P(), wt = window.__foWT;
    if (!pl || !wt || !wt.serverFixtures) { setTimeout(window.foRenderFeedPage, 600); return; }
    css();
    document.body.classList.add("fo-fd-on");
    var q = qs(), rid = q.n || "eng";
    var sv = wt.serverFixtures(rid, Date.now());
    var fx = sv.fx || [], cal = sv.cal;
    if (!fx.length || !cal.round) { page.innerHTML = shell(rid, cal, null, "<p class='fd-dim'>No round on today's card.</p>"); return; }
    var fi = Math.max(0, Math.min(fx.length - 1, parseInt(q.f || "0", 10) || 0));
    var m = fx[fi];
    var id = rid + ":s" + cal.seasonNo + ":r" + cal.round + ":h" + m.home.slot + "a" + m.away.slot;
    var winStart = pl.EPOCH + pl.dayIx(Date.now()) * 86400000 + pl.natHour(rid) * 3600000;
    var winLen = (pl.LIVE_LEN || 3) * 3600000, BALL_MS = winLen / 600;
    if (T.id !== id) { T.tab = "live"; T.filter = "all"; }
    T.id = id;
    page.innerHTML = shell(rid, cal, null, mast(m, "Opening the umpire's book&hellip;"));
    logFetch(rid, id).then(function (log) {
      if (T.id !== id || (location.hash || "").split("?")[0] !== "#/feed") return;
      if (!log) {
        // sealed until the first ball (migration 047), or the prebank has not
        // landed yet: either way the umpire walks out shortly - ask again
        var mins = Math.max(1, Math.ceil((winStart - Date.now()) / 60000));
        page.innerHTML = shell(rid, cal, "up",
          mast(m, Date.now() < winStart
            ? "Round " + cal.round + " &middot; the first ball at " + hh(pl.natHour(rid)) + " UTC &mdash; about " + mins + " minute" + (mins === 1 ? "" : "s") + " away."
            : "Round " + cal.round + " &middot; the umpire is walking out &mdash; the first deliveries arrive in a minute or two."));
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
  function hh(h) { return (h < 10 ? "0" : "") + h + ":00"; }
  function mast(m, sub) {
    return "<div class='fd-bug'><div class='fd-teams'><b>" + E(m.home.name) + "</b><i>v</i><b>" + E(m.away.name) + "</b></div>" +
      "<div class='fd-sub'>" + sub + "</div></div>";
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
    // the bug keeps to what the book below does NOT already say: the score,
    // the chase, the day's conditions, and the over in progress. The crease
    // tallies and the last ball live in the over banners and the scorecard.
    var meta = inns.meta, condBits = [];
    if (meta) {
      if (meta.wx) condBits.push(E(meta.wx));
      if (meta.pitch) condBits.push(E(meta.pitch) + " pitch");
      if (meta.tossWin) condBits.push(E(meta.tossWin) + " won the toss" + (meta.tossDo ? ", chose to " + E(meta.tossDo) : ""));
    }
    var condLine = condBits.length ? "<div class='fd-cond'>" + condBits.join(" &middot; ") + "</div>" : "";
    var chase = innNow && inns[0].brk
      ? "<div class='fd-chase'>" + E(inns[0].brk.replace(/^Innings break\.\s*/, "")) + "</div>" : "";
    var scoreLine = tp
      ? "<div class='fd-score'>" + E(tp.team).toUpperCase() + " <em>" + tp.runs + "/" + tp.wkts + "</em><span>after " + tp.over + " overs</span></div>"
      : "<div class='fd-score'>" + E(innNow ? m.away.name : m.home.name).toUpperCase() + "<span>the innings is under way</span></div>";
    var overHtml = I.sinceTop.length
      ? "<div class='fd-over'><span>this over</span>" + I.sinceTop.map(function (r3) { return ring(r3.out); }).join("") + "</div>" : "";
    var bug =
      "<div class='fd-bug'>" +
      "<div class='fd-teams'><b>" + E(m.home.name) + "</b><i>v</i><b>" + E(m.away.name) + "</b></div>" +
      condLine + scoreLine + chase + overHtml +
      (done ? "<a class='fd-enter' href='#/report?n=" + encodeURIComponent(rid) + "&w=" + encodeURIComponent(id) + "'>The full report and scorecard &rsaquo;</a>" : "") +
      "</div>";
    var tabs = ["live|The book", "card|Scorecard", "charts|Charts", "teams|Teams"].map(function (t9) {
      var p9 = t9.split("|");
      return "<button type='button' class='" + (T.tab === p9[0] ? "on" : "") + "' onclick='foFeedTab(\"" + p9[0] + "\")'>" + p9[1] + "</button>";
    }).join("");
    var body = T.tab === "card" ? cardPanel(inns, m)
      : T.tab === "charts" ? chartsPanel(inns, m)
      : T.tab === "teams" ? teamsPanel(m, rid)
      : livePanel(seen);
    var state = live ? "live" : done ? "fin" : "up";
    page.innerHTML = shell(rid, cal, state,
      "<div class='fd-ground'>" + E(m.home.name) + "&rsquo;s ground" + (m.home.city ? " &middot; " + E(m.home.city) : "") + "</div>" +
      bug +
      "<div class='fd-tabs'>" + tabs + "</div>" +
      body +
      "<div class='fd-foot'><a href='#/league?t=fixtures'>&#8592; The round</a><a href='#/home'>The club &rsaquo;</a></div>");
  }

  // ---- THE BOOK, with filters ----------------------------------------------
  function livePanel(seen) {
    var f = T.filter;
    var keep = function (r) {
      if (f === "b46") return r.out === "4" || r.out === "6";
      if (f === "wk") return (r.out && r.out[0] === "w" && r.out !== "wide") || r.out === "✕";
      if (f === "ov") return !!r._top;
      if (f === "fld") return r.ev && r.ev.fldNm;
      if (f === "note") return r.no === "" && !r._top;
      return true;
    };
    var rows = seen.filter(keep);
    if (f === "all") rows = rows.slice(-160);
    var chips = ["all|The lot", "b46|4s &amp; 6s", "wk|Wickets", "fld|In the field", "ov|Overs", "note|The notes"].map(function (c9) {
      var p9 = c9.split("|");
      return "<button type='button' class='" + (T.filter === p9[0] ? "on" : "") + "' onclick='foFeedFilter(\"" + p9[0] + "\")'>" + p9[1] + "</button>";
    }).join("");
    var comm = rows.reverse().map(function (r4) {
      if (r4._top) {
        // the banner carries the umpire's who-line too: the man on strike and
        // his partner, runs and balls, exactly as printed at the over's end
        var wb = parseWho(r4.oversumTop).bats;
        return "<div class='fd-row top'><div class='w'>" + E(r4.txt) +
          (wb.length ? "<span class='os'>" + wb.map(function (b9) { return "<strong>" + E(b9.nm) + "</strong> " + b9.r + " (" + b9.b + "b)"; }).join(" &middot; ") + "</span>" : "") +
          "</div></div>";
      }
      if (r4.intro || r4.no === "") return "<div class='fd-row in'><div class='w'>" +
        (r4.out && r4.out !== "▶" ? "<b class='sg'>" + E(r4.out) + "</b> " : "") + E(r4.txt) + "</div></div>";
      var wk4 = r4.out && r4.out[0] === "w" && r4.out !== "wide";
      return "<div class='fd-row" + (r4.out === "4" || r4.out === "6" ? " big" : "") + (wk4 ? " wkt" : "") + "'>" +
        "<span class='n'>" + E(r4.no) + "</span><span class='bb'>" + ring(r4.out) + "</span>" +
        "<div class='w'>" + E(r4.txt) + "</div></div>";
    }).join("");
    return "<div class='fd-comm'><div class='fd-ch'>Ball by ball &middot; the umpire's own book</div>" +
      "<div class='fd-chips'>" + chips + "</div>" +
      (comm || "<p class='fd-dim'>" + (T.filter === "all" ? "The first ball is moments away." : "Nothing under that heading yet.") + "</p>") + "</div>";
  }

  // ---- THE LIVE SCORECARD, from the umpire's prints ------------------------
  function innTitle(I, m, ix) {
    var nm = I.team || (ix ? m.away.name : m.home.name);
    var sc = I.close ? I.close.runs + "/" + I.close.wkts
      : I.top ? (function (t9) { return t9 ? t9.runs + "/" + t9.wkts : ""; })(parseTop(I.top.txt)) : "";
    return "<div class='fd-ih'><b>" + E(nm) + "</b><span>" + sc + (I.close ? "" : I.open ? " &middot; batting" : "") + "</span></div>";
  }
  function cardPanel(inns, m) {
    var out = "";
    for (var ix = 0; ix < 2; ix++) {
      var I = inns[ix];
      if (!I.open && !I.bats.length) continue;
      out += innTitle(I, m, ix);
      out += "<table class='fd-tb'><tr><th>Batting</th><th></th><th class='r'>R</th><th class='r'>B</th><th class='r'>SR</th></tr>" +
        I.bats.map(function (b9) {
          var how = b9.out
            ? (b9.out.how === "caught" && b9.out.fld ? "c " + E(surname(b9.out.fld)) + " b " + E(surname(b9.out.bowler || "")) :
               b9.out.how === "bowled" ? "b " + E(surname(b9.out.bowler || "")) :
               b9.out.how === "lbw" ? "lbw b " + E(surname(b9.out.bowler || "")) :
               b9.out.how === "stumped" ? "st &dagger; b " + E(surname(b9.out.bowler || "")) : E(b9.out.how))
            : "not out";
          var sr = (b9.r != null && b9.b > 0) ? Math.round(b9.r / b9.b * 100) : null;
          return "<tr class='" + (b9.out ? "o" : "no") + "'><td>" + E(b9.nm) + "</td><td class='h'>" + how + "</td>" +
            "<td class='r'>" + (b9.r != null ? b9.r + (b9.out ? "" : "*") : "&mdash;") + "</td>" +
            "<td class='r'>" + (b9.b != null ? b9.b : "&mdash;") + "</td>" +
            "<td class='r'>" + (sr != null ? sr : "&mdash;") + "</td></tr>";
        }).join("") + "</table>";
      if (I.bowls.length)
        out += "<table class='fd-tb'><tr><th>Bowling</th><th class='r'>O</th><th class='r'>R</th><th class='r'>W</th></tr>" +
          I.bowls.map(function (w9) {
            return "<tr><td>" + E(w9.nm) + "</td><td class='r'>" + w9.o + "</td><td class='r'>" + w9.r + "</td><td class='r'>" + w9.w + "</td></tr>";
          }).join("") + "</table>";
      if (I.fow.length || I.top) out += partHtml(I);
      if (ix === 0 && I.brk) out += "<div class='fd-note'>" + E(I.brk) + "</div>";
    }
    if (!out) out = "<p class='fd-dim'>The umpire prints the first tallies at the end of over one.</p>";
    return "<div class='fd-comm'><div class='fd-ch'>The live scorecard &middot; as the umpire prints it</div>" + out +
      "<div class='fd-note'>Current batters read as at the umpire&rsquo;s last end-of-over print; dismissed men are final.</div></div>";
  }
  // the partnership ladder: every stand from the umpire's fall-of-wicket
  // lines, and the unbroken stand as the difference of his two latest scores
  function partHtml(I) {
    var tp = I.close || (I.top ? (function (t9) { return t9 ? { runs: t9.runs, wkts: t9.wkts } : null; })(parseTop(I.top.txt)) : null);
    var items = I.fow.map(function (fw, k) {
      return { lbl: ordinal(fw.w) + " wicket", p: fw.p, note: E(fw.nm) + " " + fw.r + " (" + fw.b + "b) &middot; fell at " + fw.score + "/" + fw.w + (fw.no ? " &middot; ov " + fw.no : "") };
    });
    if (tp && (!I.close)) {
      var lastF = I.fow.length ? I.fow[I.fow.length - 1].score : 0;
      var cur = tp.runs - lastF;
      if (cur >= 0 && (!I.fow.length || tp.wkts === I.fow[I.fow.length - 1].w))
        items.push({ lbl: ordinal(tp.wkts + 1) + " wicket", p: cur, note: "unbroken", live: true });
    }
    if (!items.length) return "";
    var mx = Math.max.apply(null, items.map(function (x) { return x.p; }).concat([1]));
    return "<div class='fd-ph'>Partnerships</div>" + items.map(function (x) {
      return "<div class='fd-pr" + (x.live ? " lv" : "") + "'><span class='l'>" + x.lbl + "</span>" +
        "<span class='bar'><i style='width:" + Math.max(3, Math.round(x.p / mx * 100)) + "%'></i></span>" +
        "<span class='v'>" + x.p + "</span><span class='nt'>" + x.note + "</span></div>";
    }).join("");
  }
  function ordinal(n) { return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : n + "th"; }

  // ---- THE CHARTS: worm and manhattan from the end-of-over prints ----------
  function chartsPanel(inns, m) {
    var any = inns[0].overs.length || inns[1].overs.length;
    if (!any) return "<div class='fd-comm'><div class='fd-ch'>The charts</div><p class='fd-dim'>The worm starts crawling at the end of over one.</p></div>";
    var W = 640, H = 240, padL = 34, padB = 22, padT = 12, padR = 10;
    var maxOv = 50;
    var maxSc = 20;
    inns.forEach(function (I) { I.overs.forEach(function (o) { if (o.runs > maxSc) maxSc = o.runs; }); });
    if (inns[1].target && inns[1].target > maxSc) maxSc = inns[1].target;
    maxSc = Math.ceil((maxSc + 10) / 20) * 20;
    var X = function (ov) { return padL + (W - padL - padR) * ov / maxOv; };
    var Y = function (sc) { return H - padB - (H - padB - padT) * sc / maxSc; };
    var grid = "";
    for (var g = 0; g <= maxSc; g += Math.max(20, Math.ceil(maxSc / 5 / 20) * 20))
      grid += "<line x1='" + padL + "' y1='" + Y(g) + "' x2='" + (W - padR) + "' y2='" + Y(g) + "' class='gl'/><text x='" + (padL - 5) + "' y='" + (Y(g) + 3) + "' class='ax e'>" + g + "</text>";
    for (var gx = 10; gx <= maxOv; gx += 10)
      grid += "<text x='" + X(gx) + "' y='" + (H - 7) + "' class='ax m'>" + gx + "</text>";
    var COL = ["#14243A", "#C9571F"];
    var worm = "", dots = "";
    inns.forEach(function (I, ix) {
      if (!I.overs.length) return;
      // o.runs is the cumulative score the umpire printed at that over's end
      var pts = "M" + X(0) + " " + Y(0) + I.overs.map(function (o) { return "L" + X(o.over) + " " + Y(o.runs); }).join("");
      worm += "<path d='" + pts + "' class='wl' style='stroke:" + COL[ix] + "'/>";
      I.fow.forEach(function (fw) {
        var ov9 = parseFloat(fw.no) || null;
        if (ov9 != null) dots += "<circle cx='" + X(ov9) + "' cy='" + Y(fw.score) + "' r='4' class='wd' style='fill:" + COL[ix] + "'/>";
      });
    });
    var tgt = "";
    if (inns[1].target) tgt = "<line x1='" + padL + "' y1='" + Y(inns[1].target) + "' x2='" + (W - padR) + "' y2='" + Y(inns[1].target) + "' class='tl'/><text x='" + (W - padR) + "' y='" + (Y(inns[1].target) - 4) + "' class='ax t'>target " + inns[1].target + "</text>";
    var leg = inns.map(function (I, ix) {
      if (!I.overs.length) return "";
      return "<span class='lg'><i style='background:" + COL[ix] + "'></i>" + E(I.team || (ix ? m.away.name : m.home.name)) + "</span>";
    }).join("");
    var wormSvg = "<svg viewBox='0 0 " + W + " " + H + "' class='fd-svg'>" + grid + tgt + worm + dots + "</svg>";
    // the manhattan: the umpire's "(N runs)" per over, wickets flagged above
    var mh = "";
    var maxR = 1; inns.forEach(function (I) { I.overs.forEach(function (o) { if (o.ovRuns > maxR) maxR = o.ovRuns; }); });
    var H2 = 170, bw = (W - padL - padR) / maxOv / 2 - 1;
    var Y2 = function (v) { return H2 - padB - (H2 - padB - padT) * v / (maxR + 2); };
    var bars = "";
    for (var g2 = 0; g2 <= maxR + 2; g2 += 5)
      bars += "<line x1='" + padL + "' y1='" + Y2(g2) + "' x2='" + (W - padR) + "' y2='" + Y2(g2) + "' class='gl'/><text x='" + (padL - 5) + "' y='" + (Y2(g2) + 3) + "' class='ax e'>" + g2 + "</text>";
    for (var gx2 = 10; gx2 <= maxOv; gx2 += 10)
      bars += "<text x='" + X(gx2) + "' y='" + (H2 - 7) + "' class='ax m'>" + gx2 + "</text>";
    inns.forEach(function (I, ix) {
      I.overs.forEach(function (o) {
        var x0 = X(o.over - 1) + (ix ? bw + 1 : 0);
        bars += "<rect x='" + x0 + "' y='" + Y2(o.ovRuns) + "' width='" + bw + "' height='" + (Y2(0) - Y2(o.ovRuns)) + "' rx='1.5' style='fill:" + COL[ix] + (ix ? "" : "") + "' opacity='" + (ix ? "0.95" : "0.85") + "'/>";
      });
      I.fow.forEach(function (fw) {
        var ov9 = Math.ceil(parseFloat(fw.no)) || null;
        if (ov9 != null) bars += "<circle cx='" + (X(ov9 - 1) + (ix ? bw + 1 : 0) + bw / 2) + "' cy='" + (padT + 4 + (ix ? 10 : 0)) + "' r='3.5' class='wd' style='fill:#8E1F13'/>";
      });
    });
    var mhSvg = "<svg viewBox='0 0 " + W + " " + H2 + "' class='fd-svg'>" + bars + "</svg>";
    return "<div class='fd-comm'><div class='fd-ch'>The worm &middot; from the end-of-over prints</div>" +
      "<div class='fd-leg'>" + leg + "</div>" + wormSvg +
      "<div class='fd-ch' style='margin-top:16px'>The manhattan &middot; runs each over, wickets flagged</div>" + mhSvg + "</div>";
  }

  // ---- THE TEAMS: the sheets the managers filed ----------------------------
  function teamsPanel(m, rid) {
    var ord = T.ord[T.id];
    if (!ord) return "<div class='fd-comm'><div class='fd-ch'>The teamsheets</div><p class='fd-dim'>Fetching the named elevens&hellip;</p></div>";
    var col = function (nm) {
      var o = ord[nm];
      var list = o && (o.batOrder || o.xi);
      if (!list || !list.length) return "<div class='c'><b>" + E(nm) + "</b><u>no sheet filed &middot; the engine names the XI at the toss</u></div>";
      return "<div class='c'><b>" + E(nm) + "</b><u>manager&rsquo;s named order</u>" +
        list.slice(0, 11).map(function (p9, k) {
          var n9 = typeof p9 === "string" ? p9 : (p9 && p9.name) || "";
          return "<span><i>" + (k + 1) + "</i>" + E(n9) +
            (o.captain === n9 ? " <em>C</em>" : "") + (o.keeper === n9 ? " &dagger;" : "") + "</span>";
        }).join("") +
        (o.tossCall ? "<u class='t2'>toss call " + (o.tossCall === "H" ? "heads" : "tails") + (o.tossDecision ? " &middot; would " + E(o.tossDecision) + " first" : "") + "</u>" : "") +
        "</div>";
    };
    return "<div class='fd-comm'><div class='fd-ch'>The teamsheets &middot; public from an hour before the first ball</div>" +
      "<div class='fd-xic'>" + col(m.home.name) + col(m.away.name) + "</div></div>";
  }

  function shell(rid, cal, state, inner) {
    var wt = window.__foWT, flag = "";
    try { if (wt && wt.flagOf) flag = "<img class='fd-flag' src='" + wt.flagOf(rid) + "' alt=''>"; } catch (eF) {}
    var chip = state === "live" ? "<span class='fd-live'><i></i>LIVE</span>"
      : state === "fin" ? "<span class='fd-fin'>STUMPS</span>"
      : state === "up" ? "<span class='fd-fin'>FIRST BALL SOON</span>" : "";
    return "<div class='fo-fd'><div class='fd-in'>" +
      "<div class='fd-top'><a class='fd-back' href='#/league?t=fixtures'>&larr; Fixtures</a>" + flag +
      "<span class='fd-lg'>" + E(rid).toUpperCase() + (cal && cal.round ? " &middot; round " + cal.round : "") + "</span>" + chip + "</div>" +
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
      // the theatre's clean white room: cream paper, one block of navy
      "html body.ftpskin.fo-fd-on,html body.fo-fd-on{background:#F1EEE6 !important}",
      "html body.fo-fd-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body.fo-fd-on #page{padding:0 !important;margin:0 !important;background:transparent !important}",
      ".fo-fd{position:relative;min-height:70vh;color:#14202F;font-family:Inter,-apple-system,sans-serif}",
      ".fo-fd .fd-in{max-width:680px;margin:0 auto;padding:18px 16px 60px}",
      ".fo-fd .fd-top{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:14px}",
      "html body #page .fo-fd .fd-back{font:600 12px/1 Inter,sans-serif;color:#3a4353 !important;text-decoration:none !important;border:1px solid rgba(14,35,63,.22);border-radius:999px;padding:7px 13px;background:#fff}",
      ".fo-fd .fd-flag{width:26px;height:18px;object-fit:cover;border-radius:3px;box-shadow:0 1px 3px rgba(14,35,63,.25)}",
      ".fo-fd .fd-lg{font:700 10.5px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#14202F}",
      ".fo-fd .fd-live{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font:800 10px/1 Oswald,sans-serif;letter-spacing:.14em;color:#B23230}",
      ".fo-fd .fd-live i{width:8px;height:8px;border-radius:50%;background:#B23230;animation:foFdPulse 1.2s ease-in-out infinite}",
      "@keyframes foFdPulse{0%,100%{opacity:1}50%{opacity:.25}}",
      ".fo-fd .fd-fin{margin-left:auto;font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.14em;color:rgba(20,32,47,.55)}",
      ".fo-fd .fd-ground{font:600 11px/1.4 Inter,sans-serif;color:rgba(20,32,47,.55);margin-bottom:7px}",
      // THE BUG - the theatre's navy, terracotta spine, gold score
      ".fo-fd .fd-bug{background:#0E233F;border-left:3px solid #C95532;border-radius:16px;padding:15px 17px;color:#FFFEFC;box-shadow:0 8px 24px rgba(14,35,63,.18)}",
      ".fo-fd .fd-teams{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}",
      ".fo-fd .fd-teams b{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:18px;color:#FFFEFC}",
      ".fo-fd .fd-teams i{font-style:italic;font-size:11px;color:rgba(255,254,252,.5)}",
      ".fo-fd .fd-score{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;font:700 15px/1.3 Oswald,sans-serif;letter-spacing:.06em;color:#E8B96A;margin-top:8px}",
      ".fo-fd .fd-score em{font-style:normal;font-size:30px;color:#FFFEFC;font-variant-numeric:tabular-nums}",
      ".fo-fd .fd-score span{font:600 11px Inter,sans-serif;letter-spacing:0;color:rgba(255,254,252,.6)}",
      ".fo-fd .fd-chase{font:italic 400 12px/1.5 'Fraunces',Georgia,serif;color:#E8B96A;margin-top:6px}",
      ".fo-fd .fd-cond{font:600 10.5px/1.6 Inter,sans-serif;letter-spacing:.02em;color:rgba(255,254,252,.55);margin-top:5px}",
      ".fo-fd .fd-over{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;align-items:center}",
      ".fo-fd .fd-over span{font:700 8.5px Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,254,252,.45);margin-right:4px}",
      ".fo-fd .fd-over i,.fo-fd .fd-comm .bb i{font-style:normal;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,254,252,.1);border:1px solid rgba(255,254,252,.18);font:700 11px/1 Oswald,sans-serif;color:#E8DFCE}",
      ".fo-fd .fd-over i.b{background:rgba(232,185,106,.2);border-color:#E8B96A;color:#E8B96A}",
      ".fo-fd .fd-over i.w{background:rgba(255,107,94,.22);border-color:#FF6B5E;color:#FF6B5E}",
      "html body #page .fo-fd .fd-enter{display:block;width:100%;margin-top:12px;font:700 12px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#FFFEFC !important;background:#C95532 !important;border:none;border-radius:999px;padding:13px 16px;cursor:pointer;text-align:center;text-decoration:none !important}",
      // the tab rail: an almanack rule with an underline, not a row of pills
      ".fo-fd .fd-tabs{display:flex;gap:2px;margin:18px 0 0;border-bottom:1px solid #d8d0bd;overflow-x:auto;scrollbar-width:none}",
      ".fo-fd .fd-tabs::-webkit-scrollbar{display:none}",
      "html body #page .fo-fd .fd-tabs button{flex:0 0 auto;font:600 11px Oswald,sans-serif !important;letter-spacing:.16em;text-transform:uppercase;color:#8a8272 !important;background:transparent !important;border:none !important;border-bottom:2px solid transparent !important;border-radius:0 !important;box-shadow:none !important;padding:10px 14px 9px !important;margin:0 0 -1px !important;cursor:pointer;transition:color .15s}",
      "html body #page .fo-fd .fd-tabs button.on{color:#14243A !important;font-weight:700 !important;border-bottom-color:#C9571F !important}",
      "html body #page .fo-fd .fd-tabs button:hover{color:#14243A !important}",
      // the book, on paper below the broadcast
      ".fo-fd .fd-comm{background:#FFFEFC;border:1px solid #e3dccb;border-radius:14px;box-shadow:0 2px 10px rgba(20,36,58,.05);padding:12px 14px;margin-top:12px}",
      ".fo-fd .fd-ch{font:700 10px Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#8a8272;margin:2px 0 8px}",
      // the filters read as a line of the page, not a second row of buttons
      ".fo-fd .fd-chips{display:flex;gap:16px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:2px 0 10px;padding-bottom:9px;border-bottom:1px dashed #e8e1cf}",
      ".fo-fd .fd-chips::-webkit-scrollbar{display:none}",
      ".fo-fd .fd-chips button{white-space:nowrap}",
      "html body #page .fo-fd .fd-chips button{font:400 11.5px Inter,sans-serif !important;color:#8a8272 !important;background:transparent !important;border:none !important;border-bottom:2px solid transparent !important;border-radius:0 !important;box-shadow:none !important;padding:0 0 3px !important;margin:0 !important;cursor:pointer;transition:color .15s}",
      "html body #page .fo-fd .fd-chips button.on{color:#C9571F !important;font-weight:600 !important;border-bottom-color:#C9571F !important}",
      "html body #page .fo-fd .fd-chips button:hover{color:#14243A !important}",
      ".fo-fd .fd-row{display:flex;align-items:flex-start;gap:9px;padding:8px 2px;border-bottom:1px solid #f3eee1;font:400 13px/1.55 Inter,sans-serif}",
      ".fo-fd .fd-row:last-child{border-bottom:none}",
      ".fo-fd .fd-row .n{flex:0 0 34px;font:700 11px Oswald,sans-serif;color:#8a8272;font-variant-numeric:tabular-nums;padding-top:4px}",
      ".fo-fd .fd-row .bb i{width:22px;height:22px;font-size:10.5px;background:#F1EEE6;border-color:#e3dccb;color:#8a8272}",
      ".fo-fd .fd-row .bb i.b{background:#C9571F;border-color:#C9571F;color:#fff}",
      ".fo-fd .fd-row .bb i.w{background:#8E1F13;border-color:#8E1F13;color:#fff}",
      ".fo-fd .fd-row .w{flex:1;min-width:0}",
      ".fo-fd .fd-row.big{background:#FDF6EC;border-radius:8px}",
      ".fo-fd .fd-row.wkt{background:#FBEFEA;border-radius:8px}",
      ".fo-fd .fd-row.top .w{font:700 12px Inter,sans-serif;color:#14243A;background:#F6F3EB;border-radius:8px;padding:7px 10px}",
      ".fo-fd .fd-row.top .w .os{display:block;margin-top:4px;font:400 11.5px/1.5 Inter,sans-serif;color:#6d6455}",
      ".fo-fd .fd-row.top .w .os strong{font-weight:600;color:#14243A}",
      ".fo-fd .fd-row.in .w{font:italic 400 12.5px Georgia,serif;color:#6d6455}",
      ".fo-fd .fd-row.in .sg{font-style:normal;color:#C9571F;margin-right:2px}",
      // the scorecard tables
      ".fo-fd .fd-ih{display:flex;align-items:baseline;gap:10px;margin:12px 0 6px}",
      ".fo-fd .fd-ih b{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:16px;color:#14243A}",
      ".fo-fd .fd-ih span{font:700 13px Oswald,sans-serif;color:#C9571F}",
      ".fo-fd .fd-tb{width:100%;border-collapse:collapse;margin:4px 0 10px;font:400 12.5px/1.5 Inter,sans-serif}",
      ".fo-fd .fd-tb th{font:700 9.5px Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#8a8272;text-align:left;padding:4px 6px;border-bottom:1px solid #e3dccb}",
      ".fo-fd .fd-tb td{padding:5px 6px;border-bottom:1px solid #f3eee1;color:#14243A}",
      ".fo-fd .fd-tb .r{text-align:right;font-variant-numeric:tabular-nums}",
      ".fo-fd .fd-tb td.h{font-size:11.5px;color:#8a8272;font-style:italic}",
      ".fo-fd .fd-tb tr.no td:first-child{font-weight:600}",
      ".fo-fd .fd-note{font:italic 400 11.5px/1.6 Georgia,serif;color:#8a8272;margin:8px 0 2px}",
      // partnerships
      ".fo-fd .fd-ph{font:700 9.5px Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#8a8272;margin:10px 0 6px}",
      ".fo-fd .fd-pr{display:grid;grid-template-columns:74px 1fr 34px;gap:4px 10px;align-items:center;padding:3px 0;font:400 12px Inter,sans-serif}",
      ".fo-fd .fd-pr .l{font:700 10px Oswald,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#5b5344}",
      ".fo-fd .fd-pr .bar{height:9px;background:#F1EEE6;border-radius:99px;overflow:hidden}",
      ".fo-fd .fd-pr .bar i{display:block;height:100%;background:#14243A;border-radius:99px}",
      ".fo-fd .fd-pr.lv .bar i{background:#C9571F}",
      ".fo-fd .fd-pr .v{text-align:right;font:700 12.5px Oswald,sans-serif;color:#14243A;font-variant-numeric:tabular-nums}",
      ".fo-fd .fd-pr .nt{grid-column:2/4;font:italic 400 11px Georgia,serif;color:#8a8272;margin-top:-2px}",
      // charts
      ".fo-fd .fd-svg{width:100%;height:auto;display:block}",
      ".fo-fd .fd-svg .gl{stroke:#efe9d9;stroke-width:1}",
      ".fo-fd .fd-svg .ax{font:600 9px Inter,sans-serif;fill:#8a8272}",
      ".fo-fd .fd-svg .ax.e{text-anchor:end}",
      ".fo-fd .fd-svg .ax.m{text-anchor:middle}",
      ".fo-fd .fd-svg .ax.t{text-anchor:end;fill:#8a6a1f}",
      ".fo-fd .fd-svg .wl{fill:none;stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round}",
      ".fo-fd .fd-svg .wd{stroke:#FFFEFC;stroke-width:1.4}",
      ".fo-fd .fd-svg .tl{stroke:#E8B96A;stroke-width:1.6;stroke-dasharray:5 4}",
      ".fo-fd .fd-leg{display:flex;gap:14px;margin:0 0 6px;flex-wrap:wrap}",
      ".fo-fd .fd-leg .lg{display:inline-flex;align-items:center;gap:6px;font:600 11px Inter,sans-serif;color:#5b5344}",
      ".fo-fd .fd-leg .lg i{width:14px;height:4px;border-radius:2px;display:inline-block}",
      // teamsheets
      ".fo-fd .fd-xic{display:grid;grid-template-columns:1fr 1fr;gap:14px}",
      ".fo-fd .fd-xic .c b{display:block;font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:14px;color:#14243A;margin-bottom:2px}",
      ".fo-fd .fd-xic .c u{display:block;text-decoration:none;font:700 8.5px Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#C9571F;margin-bottom:6px}",
      ".fo-fd .fd-xic .c u.t2{margin-top:8px;color:#8a8272}",
      ".fo-fd .fd-xic .c span{display:flex;align-items:baseline;gap:6px;font:400 12px/1.6 Inter,sans-serif;color:#14243A}",
      ".fo-fd .fd-xic .c span i{font-style:normal;font:700 9px/1 Oswald,sans-serif;color:#b3ab99;width:13px;text-align:right}",
      ".fo-fd .fd-xic .c span em{font-style:normal;font:700 9px Oswald,sans-serif;color:#C9571F}",
      "@media(max-width:430px){.fo-fd .fd-xic{grid-template-columns:1fr}}",
      ".fo-fd .fd-sub{font:italic 400 13px/1.6 'Fraunces',Georgia,serif;color:rgba(255,254,252,.75);margin-top:8px}",
      ".fo-fd .fd-dim{font:italic 400 13.5px Georgia,serif;color:#8a8272;padding:30px 6px}",
      ".fo-fd .fd-foot{display:flex;justify-content:space-between;margin-top:14px}",
      "html body #page .fo-fd .fd-foot a{font:700 10px Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#C9571F !important;text-decoration:none !important}",
      "@media(max-width:430px){.fo-fd .fd-teams b{font-size:16px}.fo-fd .fd-score em{font-size:26px}}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
