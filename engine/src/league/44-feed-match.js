// ---- 44-feed-match.js — THE LIVE FEED (#/feed?n=rid&f=fi) -------------------
// From The Pavilion's law, client side: the match was simulated on the server
// at the first ball, so the live page is a READER, not an engine. One fetch of
// the umpire's banked ball-by-ball, each delivery revealed on the world clock,
// and every number on screen printed by the umpire himself - the end-of-over
// rows carry the running score, the batters' tallies and the bowlers' figures.
// Joining at any minute is instant on any device: there is nothing to catch
// up, because nothing is computed here.
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
  // the ball badge, same coding the rest of the game speaks
  function ball(o) {
    var wk = o && o[0] === "w" && o !== "wide";
    var cls = o === "4" ? "r4" : o === "6" ? "r6" : wk ? "wk" : (o === "dot" || o === "●") ? "" : "r1";
    var sym = o === "dot" ? "&middot;" : wk ? "W" : o === "wide" ? "wd" : o === "noball" ? "nb" : (o === "bye" || o === "legbye") ? "b" : E(o);
    return "<i class='fd-b " + cls + "'>" + sym + "</i>";
  }
  // "End of over 12 (5 runs) - Yorkshire 61/2. ..." -> the umpire's own score
  function parseTop(txt) {
    var m = /End of over (\d+)[^-]*-\s*(.+?)\s+(\d+)\/(\d+)\./.exec(txt || "");
    return m ? { over: +m[1], team: m[2], runs: +m[3], wkts: +m[4] } : null;
  }
  var T = { id: null, timer: null };
  window.foRenderFeedPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    var pl = P(), wt = window.__foWT;
    if (!pl || !wt || !wt.serverFixtures) { setTimeout(window.foRenderFeedPage, 600); return; }
    css();
    var q = qs(), rid = q.n || "eng";
    var sv = wt.serverFixtures(rid, Date.now());
    var fx = sv.fx || [], cal = sv.cal;
    if (!fx.length || !cal.round) { page.innerHTML = shell("<p class='fd-dim'>No round on today's card.</p>"); return; }
    var fi = Math.max(0, Math.min(fx.length - 1, parseInt(q.f || "0", 10) || 0));
    var m = fx[fi];
    var id = rid + ":s" + cal.seasonNo + ":r" + cal.round + ":h" + m.home.slot + "a" + m.away.slot;
    var winStart = pl.EPOCH + pl.dayIx(Date.now()) * 86400000 + pl.natHour(rid) * 3600000;
    var winLen = (pl.LIVE_LEN || 3) * 3600000, BALL_MS = winLen / 600;
    T.id = id;
    page.innerHTML = shell("<p class='fd-dim'>Opening the umpire's book&hellip;</p>");
    logFetch(rid, id).then(function (log) {
      if (T.id !== id || (location.hash || "").split("?")[0] !== "#/feed") return;
      if (!log) {
        // the window is open but the prebank has not landed yet - the umpire
        // walks out within minutes of the first ball; ask again shortly
        page.innerHTML = shell(
          "<div class='fd-mast'><h1>" + E(m.home.name) + " <i>v</i> " + E(m.away.name) + "</h1>" +
          "<p class='fd-sub'>Round " + cal.round + " &middot; the umpire is walking out &mdash; the first deliveries arrive in a minute or two.</p></div>");
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
  function paint(page, log, m, rid, cal, winStart, BALL_MS, id) {
    var now = Date.now();
    var over = now >= winStart + 600 * BALL_MS;
    // deliveries reveal on the clock; the special rows (toss, over summaries)
    // travel with the delivery they precede
    var nBalls = over ? 1e9 : Math.max(0, Math.floor((now - winStart) / BALL_MS));
    var seen = [], balls = 0;
    for (var i = 0; i < log.length; i++) {
      var r = log[i];
      var isBall = r && r.no !== "" && !r._top && !r.intro;
      if (isBall && balls >= nBalls) break;
      seen.push(r);
      if (isBall) balls++;
    }
    var live = !over && balls > 0;
    var done = over || balls >= log.filter(function (r2) { return r2 && r2.no !== "" && !r2._top && !r2.intro; }).length;
    // the umpire's latest printed score, and the balls bowled since he printed it
    var top = null, sinceTop = [];
    for (var j = seen.length - 1; j >= 0; j--) {
      if (seen[j] && seen[j]._top) { top = seen[j]; break; }
      if (seen[j] && seen[j].no !== "" && !seen[j].intro) sinceTop.unshift(seen[j]);
    }
    var tp = top ? parseTop(top.txt) : null;
    var innNow = seen.length ? (seen[seen.length - 1].inn | 0) : 0;
    var bug =
      "<div class='fd-bug'>" +
      (tp
        ? "<div class='t'><b>" + E(tp.team) + "</b><span class='sc'>" + tp.runs + "/" + tp.wkts + "</span><i>after " + tp.over + " overs</i></div>"
        : "<div class='t'><b>" + E(innNow ? m.away.name : m.home.name) + "</b><i>the innings is under way</i></div>") +
      (sinceTop.length ? "<div class='ov'><span>this over</span>" + sinceTop.map(function (r3) { return ball(r3.out); }).join("") + "</div>" : "") +
      (top && top.oversumTop ? "<div class='who'>" + top.oversumTop + "</div>" : "") +
      "</div>";
    var comm = seen.slice(-160).reverse().map(function (r4) {
      if (r4._top) return "<div class='fd-row top'><div class='w'>" + E(r4.txt) + "</div></div>";
      // the umpire's notes between deliveries - toss, fall of wicket, milestone,
      // drinks - arrive with no ball number; they read as marginalia
      if (r4.intro || r4.no === "") return "<div class='fd-row in'><div class='w'>" +
        (r4.out && r4.out !== "▶" ? "<b class='sg'>" + E(r4.out) + "</b> " : "") + E(r4.txt) + "</div></div>";
      return "<div class='fd-row" + (r4.out === "4" || r4.out === "6" ? " big" : "") + (r4.out && r4.out[0] === "w" && r4.out !== "wide" ? " wkt" : "") + "'>" +
        "<span class='n'>" + E(r4.no) + "</span>" + ball(r4.out) +
        "<div class='w'>" + E(r4.txt) + "</div></div>";
    }).join("");
    var st = live ? "<span class='fd-live'><b></b>LIVE</span>"
      : done ? "<span class='fd-fin'>STUMPS</span>"
      : "<span class='fd-fin'>FIRST BALL SOON</span>";
    page.innerHTML = shell(
      "<div class='fd-mast'><div class='fd-k'>Round " + cal.round + " &middot; " + st + "</div>" +
      "<h1>" + E(m.home.name) + " <i>v</i> " + E(m.away.name) + "</h1></div>" +
      bug +
      (done ? "<a class='fd-rep' href='#/report?n=" + encodeURIComponent(rid) + "&w=" + encodeURIComponent(id) + "'>The full report and scorecard &rsaquo;</a>" : "") +
      "<div class='fd-comm'><div class='fd-ch'>Ball by ball &middot; the umpire's own book</div>" + (comm || "<p class='fd-dim'>The first ball is moments away.</p>") + "</div>" +
      "<div class='fd-foot'><a href='#/league?t=fixtures'>&#8592; The round</a><a href='#/home'>The club &rsaquo;</a></div>");
  }
  function shell(inner) { return "<div class='fo-fd'>" + inner + "</div>"; }
  function css() {
    if (document.getElementById("fo-fd-css")) return;
    var s = document.createElement("style"); s.id = "fo-fd-css";
    s.textContent = [
      "html body #page .fo-fd{max-width:760px;margin:14px auto 44px;padding:0 12px;font-family:Inter,-apple-system,sans-serif;color:#14243A}",
      ".fo-fd .fd-mast{margin:6px 0 12px}",
      ".fo-fd .fd-k{font:700 10px Oswald,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#8a8272;display:flex;align-items:center;gap:8px}",
      ".fo-fd .fd-live{display:inline-flex;align-items:center;gap:5px;font:700 9.5px Oswald,sans-serif;letter-spacing:.14em;color:#fff;background:#C0392E;border-radius:5px;padding:3px 7px}",
      ".fo-fd .fd-live b{width:5px;height:5px;border-radius:50%;background:#fff;animation:fdLv 1.4s ease-in-out infinite}",
      "@keyframes fdLv{0%,100%{opacity:1}50%{opacity:.25}}",
      ".fo-fd .fd-fin{font:700 9.5px Oswald,sans-serif;letter-spacing:.14em;color:#8a6a1f;background:#F8ECD4;border:1px solid #e8d5a8;border-radius:5px;padding:3px 7px}",
      ".fo-fd h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:clamp(24px,4vw,36px);margin:6px 0 0;letter-spacing:-.01em}",
      ".fo-fd h1 i{font-style:italic;color:#C9571F;font-size:.6em;margin:0 6px}",
      ".fo-fd .fd-sub{font:italic 400 13.5px Georgia,serif;color:#6d6455;margin:8px 0 0}",
      ".fo-fd .fd-bug{background:linear-gradient(160deg,#14243A,#0E2246);border-radius:16px;padding:16px 18px;color:#F6F3EB;box-shadow:0 10px 30px rgba(20,36,58,.18);border-bottom:3px solid #C9571F}",
      ".fo-fd .fd-bug .t{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}",
      "html body #page .fo-fd .fd-bug b{font:700 15px Oswald,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#F6F3EB}",
      "html body #page .fo-fd .fd-bug .sc{font:700 34px Oswald,sans-serif;color:#FFFEFC;font-variant-numeric:tabular-nums}",
      "html body #page .fo-fd .fd-bug i{font:600 11px Inter,sans-serif;color:#E8B96A;font-style:normal}",
      ".fo-fd .fd-bug .ov{display:flex;align-items:center;gap:5px;margin-top:10px}",
      ".fo-fd .fd-bug .ov span{font:700 8.5px Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#8FA8CC;margin-right:4px}",
      ".fo-fd .fd-bug .who{margin-top:10px;padding-top:10px;border-top:1px solid rgba(246,243,235,.18);font:500 12px Inter,sans-serif;color:#D8E2F2;line-height:1.6}",
      ".fo-fd .fd-bug .who strong{color:#FFFEFC}",
      "html body #page .fo-fd .fd-rep{display:block;margin:12px 0 0;text-align:center;font:700 11px Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#fff !important;background:#C9571F;border-radius:11px;padding:13px;text-decoration:none}",
      ".fo-fd .fd-comm{background:#FFFEFC;border:1px solid #e3dccb;border-radius:14px;box-shadow:0 2px 10px rgba(20,36,58,.05);padding:12px 14px;margin-top:12px}",
      ".fo-fd .fd-ch{font:700 10px Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#8a8272;margin:2px 0 8px}",
      ".fo-fd .fd-row{display:flex;align-items:flex-start;gap:9px;padding:8px 2px;border-bottom:1px solid #f3eee1;font:400 13px/1.55 Inter,sans-serif}",
      ".fo-fd .fd-row:last-child{border-bottom:none}",
      ".fo-fd .fd-row .n{flex:0 0 34px;font:700 11px Oswald,sans-serif;color:#8a8272;font-variant-numeric:tabular-nums;padding-top:2px}",
      ".fo-fd .fd-row .w{flex:1;min-width:0}",
      ".fo-fd .fd-row.big{background:#FDF6EC;border-radius:8px}",
      ".fo-fd .fd-row.wkt{background:#FBEFEA;border-radius:8px}",
      ".fo-fd .fd-row.top .w{font:700 12px Inter,sans-serif;color:#14243A;background:#F6F3EB;border-radius:8px;padding:7px 10px}",
      ".fo-fd .fd-row.in .w{font:italic 400 12.5px Georgia,serif;color:#6d6455}",
      ".fo-fd .fd-row.in .sg{font-style:normal;color:#C9571F;margin-right:2px}",
      ".fo-fd .fd-b{flex:0 0 22px;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font:700 10.5px Oswald,sans-serif;background:#F1EEE6;color:#8a8272;border:1px solid #e3dccb;font-style:normal}",
      ".fo-fd .fd-b.r1{color:#14243A;background:#FFFEFC}",
      ".fo-fd .fd-b.r4{background:#C9571F;border-color:#C9571F;color:#fff}",
      ".fo-fd .fd-b.r6{background:#14243A;border-color:#14243A;color:#E8B96A}",
      ".fo-fd .fd-b.wk{background:#8E1F13;border-color:#8E1F13;color:#fff}",
      ".fo-fd .fd-dim{font:italic 400 13.5px Georgia,serif;color:#8a8272;padding:30px 6px}",
      ".fo-fd .fd-foot{display:flex;justify-content:space-between;margin-top:14px}",
      "html body #page .fo-fd .fd-foot a{font:700 10px Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#C9571F !important;text-decoration:none}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
