// ---- 44-feed-match.js — THE LIVE FEED (#/feed?n=rid&f=fi) -------------------
// From The Pavilion's law, client side: the match was simulated on the server
// at the first ball, so the live page is a READER, not an engine. One fetch of
// the umpire's banked ball-by-ball, each delivery revealed on the world clock,
// and every number on screen printed by the umpire himself - the end-of-over
// rows carry the running score, the batters' tallies and the bowlers' figures,
// and the innings-break row carries the target. Joining at any minute is
// instant on any device: there is nothing to catch up, nothing is computed.
// The dress is the broadcast theatre's own - the navy bug, the gold score,
// the crease line, the over of circles - worn by a reader instead of a sim.
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
    var m = /End of over (\d+)[^-]*-\s*(.+?)\s+(\d+)\/(\d+)\./.exec(txt || "");
    return m ? { over: +m[1], team: m[2], runs: +m[3], wkts: +m[4] } : null;
  }
  // the umpire's who-line: "<strong>N. Dunn</strong> 44 (57b), ... <strong>
  // J. Mercer (rfm)</strong> 7-24-2" -> the men at the crease and the bowler
  function parseWho(oversumTop) {
    var out = { bats: [], bowl: null };
    String(oversumTop || "").split(/,\s*(?=<strong>)/).forEach(function (seg) {
      var f = /<strong>([^<]+?)<\/strong>\s*(\d+)-(\d+)-(\d+)\s*$/.exec(seg);
      if (f) { out.bowl = { nm: f[1], fig: f[2] + "-" + f[3] + "-" + f[4] }; return; }
      var b = /<strong>([^<]+?)<\/strong>\s*(\d+)\s*\((\d+)b\)/.exec(seg);
      if (b) out.bats.push({ nm: b[1], r: +b[2], b: +b[3] });
    });
    return out;
  }
  function surname(nm) { var p = String(nm || "").trim().split(/\s+/); return p[p.length - 1] || ""; }
  var T = { id: null, timer: null };
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
      paint(page, log, m, rid, cal, winStart, BALL_MS, id);
      clearTimeout(T.timer);
      T.timer = setInterval(function () {
        if ((location.hash || "").split("?")[0] !== "#/feed" || T.id !== id) { clearInterval(T.timer); return; }
        paint(page, log, m, rid, cal, winStart, BALL_MS, id);
      }, 6000);
    });
  };
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
    // one pass down the umpire's book: his latest printed score, the men his
    // who-line named, the innings-break line, and who holds bat and ball now
    var top = null, who = null, brk = null, striker = null, bowlerNm = null, lastTxt = null;
    var sinceTop = [];
    for (var j = 0; j < seen.length; j++) {
      var s9 = seen[j];
      if (!s9) continue;
      if (s9._top) { top = s9; who = parseWho(s9.oversumTop); sinceTop = []; continue; }
      if (s9.no !== "" && !s9.intro) {
        sinceTop.push(s9);
        if (s9.strikerNm) striker = s9.strikerNm;
        if (s9.bowlerNm) bowlerNm = s9.bowlerNm;
      }
      if (s9.out === "-" && /Innings break/.test(s9.txt || "")) brk = s9.txt;
      if (s9.txt) lastTxt = s9.txt;
    }
    var tp = top ? parseTop(top.txt) : null;
    var innNow = seen.length ? (seen[seen.length - 1].inn | 0) : 0;
    var batNow = innNow ? (tp ? tp.team : m.away.name) : (tp ? tp.team : null);
    // the crease line: the who-line's men, the strike dot on the striker; a
    // new man mid-over is named without a number - the umpire has not printed
    // one for him yet
    var creaseHtml = "";
    if (who && who.bats.length) {
      var sn = surname(striker);
      var names = who.bats.map(function (b9) {
        var onStrike = sn && surname(b9.nm) === sn;
        return "<u>" + E(b9.nm) + (onStrike ? " &#9679;" : "") + "</u> " + b9.r + " (" + b9.b + "b)";
      });
      if (sn && !who.bats.some(function (b9) { return surname(b9.nm) === sn; }))
        names.push("<u>" + E(striker) + " &#9679;</u> new man");
      var bowlSide = who.bowl ? "<span><u>" + E(who.bowl.nm) + "</u> " + who.bowl.fig + "</span>" : "";
      creaseHtml = "<div class='fd-crease'><span>" + names.join(" &middot; ") + "</span>" + bowlSide + "</div>";
    } else if (striker || bowlerNm) {
      creaseHtml = "<div class='fd-crease'><span>" + (striker ? "<u>" + E(striker) + " &#9679;</u>" : "") + "</span>" +
        (bowlerNm ? "<span><u>" + E(bowlerNm) + "</u> bowling</span>" : "") + "</div>";
    }
    // the target line, in the umpire's own words from the innings break
    var chase = "";
    if (innNow && brk) {
      var tb = /Innings break\.\s*(.+?)\s*Target (\d+)\./.exec(brk);
      if (tb) chase = "<div class='fd-chase'>" + E(tb[1]) + " Target " + tb[2] + ".</div>";
    }
    var scoreLine = tp
      ? "<div class='fd-score'>" + E(tp.team).toUpperCase() + " <em>" + tp.runs + "/" + tp.wkts + "</em><span>after " + tp.over + " overs</span></div>"
      : "<div class='fd-score'>" + E(batNow || m.home.name).toUpperCase() + "<span>the innings is under way</span></div>";
    var overHtml = sinceTop.length
      ? "<div class='fd-over'><span>this over</span>" + sinceTop.map(function (r3) { return ring(r3.out); }).join("") + "</div>" : "";
    var lastLine = lastTxt ? "<div class='fd-last'>" + E(lastTxt) + "</div>" : "";
    var bug =
      "<div class='fd-bug'>" +
      "<div class='fd-teams'><b>" + E(m.home.name) + "</b><i>v</i><b>" + E(m.away.name) + "</b></div>" +
      scoreLine + chase + creaseHtml + overHtml + lastLine +
      (done ? "<a class='fd-enter' href='#/report?n=" + encodeURIComponent(rid) + "&w=" + encodeURIComponent(id) + "'>The full report and scorecard &rsaquo;</a>" : "") +
      "</div>";
    var comm = seen.slice(-160).reverse().map(function (r4) {
      if (r4._top) {
        // the banner carries the umpire's who-line too: the man on strike and
        // his partner, runs and balls, exactly as printed at the over's end
        var wb = parseWho(r4.oversumTop).bats;
        return "<div class='fd-row top'><div class='w'>" + E(r4.txt) +
          (wb.length ? "<span class='os'>" + wb.map(function (b9) { return "<strong>" + E(b9.nm) + "</strong> " + b9.r + " (" + b9.b + "b)"; }).join(" &middot; ") + "</span>" : "") +
          "</div></div>";
      }
      // the umpire's notes between deliveries - toss, fall of wicket,
      // milestone, drinks - arrive with no ball number; they read as marginalia
      if (r4.intro || r4.no === "") return "<div class='fd-row in'><div class='w'>" +
        (r4.out && r4.out !== "▶" ? "<b class='sg'>" + E(r4.out) + "</b> " : "") + E(r4.txt) + "</div></div>";
      var wk4 = r4.out && r4.out[0] === "w" && r4.out !== "wide";
      return "<div class='fd-row" + (r4.out === "4" || r4.out === "6" ? " big" : "") + (wk4 ? " wkt" : "") + "'>" +
        "<span class='n'>" + E(r4.no) + "</span><span class='bb'>" + ring(r4.out) + "</span>" +
        "<div class='w'>" + E(r4.txt) + "</div></div>";
    }).join("");
    var state = live ? "live" : done ? "fin" : "up";
    page.innerHTML = shell(rid, cal, state,
      "<div class='fd-ground'>" + E(m.home.name) + "&rsquo;s ground" + (m.home.city ? " &middot; " + E(m.home.city) : "") + "</div>" +
      bug +
      "<div class='fd-comm'><div class='fd-ch'>Ball by ball &middot; the umpire's own book</div>" + (comm || "<p class='fd-dim'>The first ball is moments away.</p>") + "</div>" +
      "<div class='fd-foot'><a href='#/league?t=fixtures'>&#8592; The round</a><a href='#/home'>The club &rsaquo;</a></div>");
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
      ".fo-fd .fd-crease{display:flex;justify-content:space-between;gap:10px;margin-top:10px;font:400 11.5px/1.5 Inter,sans-serif;color:rgba(255,254,252,.85);flex-wrap:wrap}",
      ".fo-fd .fd-crease u{text-decoration:none;color:#FFFEFC;font-weight:600}",
      ".fo-fd .fd-over{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;align-items:center}",
      ".fo-fd .fd-over span{font:700 8.5px Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,254,252,.45);margin-right:4px}",
      ".fo-fd .fd-over i,.fo-fd .fd-comm .bb i{font-style:normal;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,254,252,.1);border:1px solid rgba(255,254,252,.18);font:700 11px/1 Oswald,sans-serif;color:#E8DFCE}",
      ".fo-fd .fd-over i.b{background:rgba(232,185,106,.2);border-color:#E8B96A;color:#E8B96A}",
      ".fo-fd .fd-over i.w{background:rgba(255,107,94,.22);border-color:#FF6B5E;color:#FF6B5E}",
      ".fo-fd .fd-last{font:italic 400 12px/1.5 'Fraunces',Georgia,serif;color:rgba(255,254,252,.65);margin-top:9px}",
      "html body #page .fo-fd .fd-enter{display:block;width:100%;margin-top:12px;font:700 12px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#FFFEFC !important;background:#C95532 !important;border:none;border-radius:999px;padding:13px 16px;cursor:pointer;text-align:center;text-decoration:none !important}",
      // the book, on paper below the broadcast
      ".fo-fd .fd-comm{background:#FFFEFC;border:1px solid #e3dccb;border-radius:14px;box-shadow:0 2px 10px rgba(20,36,58,.05);padding:12px 14px;margin-top:14px}",
      ".fo-fd .fd-ch{font:700 10px Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#8a8272;margin:2px 0 8px}",
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
      ".fo-fd .fd-sub{font:italic 400 13px/1.6 'Fraunces',Georgia,serif;color:rgba(255,254,252,.75);margin-top:8px}",
      ".fo-fd .fd-dim{font:italic 400 13.5px Georgia,serif;color:#8a8272;padding:30px 6px}",
      ".fo-fd .fd-foot{display:flex;justify-content:space-between;margin-top:14px}",
      "html body #page .fo-fd .fd-foot a{font:700 10px Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#C9571F !important;text-decoration:none !important}",
      "@media(max-width:430px){.fo-fd .fd-teams b{font-size:16px}.fo-fd .fd-score em{font-size:26px}}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
