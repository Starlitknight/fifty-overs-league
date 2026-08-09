/* ============================================================================
   THE BELL (#/news) — WHAT HAPPENED, AND WHAT IS WAITING FOR YOU.

   The world had a bell before this. It was gated on SYNC.started && LG - the
   retired private-league mode - so in the served world it never appeared at
   all; it knew about friendly challenges and nothing else; and it kept what
   you had read in localStorage, so reading your news on a phone left it
   unread on a laptop. A manager could be relegated, sold a player, called up
   for his country and left with an unanswered scout on the table, and the
   game would not have said a word to him.

   HOW FROM THE PAVILION DOES IT. FTP's News is an inbox of dated, categorised
   messages written at the update - your match, your training, your transfers,
   your youth, your money, your call-ups - and the categories are not
   decoration, they are how a manager decides what to read when he has thirty
   seconds. Hitwicket adds the other half: the things that need a decision
   NOW, pinned above the news, because a management game whose deadlines pass
   quietly is a management game you stop opening.

   So this has two halves and the difference between them is the design:

     ASKS are what is waiting on you. Reading one does not answer it - only
     doing it does - so they stay pinned at the top until they are done, and
     they keep their place in the badge. The urgent ones (a match today with
     no teamsheet, an unanswered challenge, an outbid, administration) wear
     rust; the rest wear gold.

     NEWS is what happened. It is read once and goes quiet, newest first,
     each entry a door to the room it came from.

   NOTHING HERE IS INVENTED. Every line is server_my_notifications', which is
   a UNION over the record (server/migrations/060) - the match row, the book
   of the nets, the scout with a null decision. The page cannot tell you
   something that did not happen, because it has nothing to tell you WITH.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foNotif) return; window.__foNotif = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function jwt() { try { return (window.__foJWT && window.__foJWT()) || localStorage.getItem("fo_jwt") || ""; } catch (e) { return ""; } }
  function claimed() {
    try { return !!(window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null")); }
    catch (e) { return false; }
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

  var N = { asks: [], news: [], unread: 0, at: 0, loading: false };
  window.__foNotifState = N;

  // WHAT EACH KIND LOOKS LIKE. One glyph a category, the way an inbox has to
  // be scannable before it is readable - a manager should know from the shape
  // of the row whether this is his cricket, his money or his academy.
  var ICON = {
    "no-xi": "M4 4h16v4H4z M4 11h10v2H4z M4 16h7v2H4z",
    "scout-waiting": "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4",
    "friendly-waiting": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3.5 9h17 M3.5 15h17 M12 3c3 4 3 14 0 18 M12 3c-3 4-3 14 0 18",
    "outbid": "M3 20h11 M6 12l6-6 5 5-6 6z M14 5l5 5",
    "money": "M12 2v20 M17 6.5c0-2-2.2-3-5-3s-5 .8-5 3 2.5 2.8 5 3.4 5 1.2 5 3.6-2.2 3-5 3-5-1-5-3",
    "colts-short": "M8 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M2 20c0-4 3-6 6-6s6 2 6 6 M17 9v6 M20 12h-6",
    "boys-leaving": "M9 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M3 21c0-4 3-7 6-7 M15 12l4 4-4 4 M11 16h8",
    "match": "M4 20L20 4 M7 17l-3 3 M14.5 4.5a4 4 0 1 1 5 5",
    "training": "M2 12h4 M18 12h4 M6 8v8 M18 8v8 M6 12h12",
    "sold": "M20 12H8 M13 5l-7 7 7 7",
    "bought": "M4 12h12 M11 5l7 7-7 7",
    "callup": "M4 21V4h13l-1.5 3L17 10H4",
    "friendly-played": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3.5 9h17 M3.5 15h17"
  };
  function icon(kind) {
    var d = ICON[kind] || "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z";
    return "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' " +
      "stroke-linecap='round' stroke-linejoin='round'>" +
      d.split(" M").map(function (seg, i) { return "<path d='" + (i ? "M" + seg : seg) + "'/>"; }).join("") +
      "</svg>";
  }
  // WHEN, in the only units a manager thinks in.
  function ago(ms) {
    var d = Date.now() - (+ms || 0);
    if (!(+ms) || d < 0) return "";
    var m = Math.floor(d / 60000), h = Math.floor(m / 60), dy = Math.floor(h / 24);
    if (dy >= 2) return dy + " days ago";
    if (dy === 1) return "yesterday";
    if (h >= 1) return h + (h === 1 ? " hour ago" : " hours ago");
    if (m >= 1) return m + (m === 1 ? " minute ago" : " minutes ago");
    return "just now";
  }

  // ---- fetching -------------------------------------------------------------
  function refresh(cb) {
    if (!jwt() || !claimed()) { N.asks = []; N.news = []; N.unread = 0; badge(); if (cb) cb(); return; }
    if (N.loading) return;
    N.loading = true;
    rpc("world_my_notifications", { p_limit: 40 }).then(function (d) {
      N.loading = false;
      if (!d || !d.ok) return;
      N.asks = d.asks || []; N.news = d.news || []; N.unread = +d.unread || 0; N.at = Date.now();
      badge(); try { window.__foMktBell && __foMktBell(); } catch (eB) {} if (cb) cb();
      if ((location.hash || "").split("?")[0] === "#/news") draw();
    }).catch(function () { N.loading = false; if (cb) cb(); });
  }
  window.__foNotifRefresh = refresh;
  // the news desk, for the one bell (55-market) to read
  window.__foNews = {
    get: function () { return N; },
    refresh: refresh,
    markSeen: function () {
      var fresh = (N.news || []).some(function (x) { return x.fresh; });
      if (!fresh) return;
      // READING IS LOCAL AND INSTANT. The first cut cleared the flags only
      // after world_notifications_seen came back, so the popover repainted
      // with everything still unread and "Mark all read" looked dead - and
      // on a phone that dropped the request it WAS dead for the session.
      // The reader has read: the list and the badge go quiet now, and the
      // watermark write follows. If it fails, the next refresh honestly
      // brings the flags back rather than lying that the server knows.
      (N.news || []).forEach(function (x) { x.fresh = false; });
      N.unread = (N.asks || []).length;
      badge();
      try { window.__foMktBell && __foMktBell(); } catch (e) {}
      rpc("world_notifications_seen").catch(function () {});
    }
  };

  // ---- the bell in the topbar ----------------------------------------------
  function badge() {
    var b = document.getElementById("fo-nbell-n");
    if (!b) return;
    if (N.unread > 0) { b.textContent = N.unread > 99 ? "99+" : String(N.unread); b.style.display = ""; }
    else b.style.display = "none";
    var bell = document.getElementById("fo-nbell");
    if (bell) bell.classList.toggle("has", N.unread > 0);
  }
  function wire() {
    // ONE BELL. This module used to hang its own bell (#fo-nbell) beside the
    // market's, and the masthead wore two identical glyphs for two halves of
    // the same idea. The market's bell survives - it owns the popover - and
    // THIS module becomes its news desk: the served asks and news are exposed
    // below and the market bell folds them into its badge and its list. Any
    // bell an older session left in the DOM is taken down.
    var old = document.getElementById("fo-nbell"); if (old) old.remove();
    if (!jwt() || !claimed()) return;
    css();
    // (the click wiring for the retired #fo-nbell used to live here, and its
    // ghost - a listener on an element no longer made - threw on every call
    // and silently killed the poll that shares its interval)
    badge();
  }
  window.__foNotifWire = wire;

  // ---- the page -------------------------------------------------------------
  function row(x, isAsk) {
    var urgent = isAsk && x.urgent;
    return "<a class='fo-nt-row" + (isAsk ? " ask" : "") + (urgent ? " urgent" : "") +
      (!isAsk && x.fresh ? " fresh" : "") + "' href='" + E(x.go || "#/club") + "'>" +
      "<s class='ic'>" + icon(x.kind) + "</s>" +
      "<span class='tx'><b>" + E(x.title) + "</b>" +
      (x.body ? "<i>" + E(x.body) + "</i>" : "") + "</span>" +
      "<span class='wh'>" + (isAsk ? (urgent ? "Now" : "Waiting") : E(ago(x.at))) + "</span></a>";
  }
  // THE ROUTER MUST KNOW THIS ROOM EXISTS. route() dispatches a page either
  // from P (a pgX function) or from OV (a window.foRenderXPage name), and its
  // last line is `else { location.hash = '#/home'; return }`. A hash it has
  // never heard of is therefore not an empty page - it is a REDIRECT. So
  // #/news went to the bell, the bell went to route(), route() sent the hash
  // home, and the wrapper below then read location.hash, found '#/home', and
  // correctly declined to draw the news. The bell led nowhere, on every
  // device. Registering the renderer under the name OV expects is what makes
  // #/news an address instead of a typo.
  function draw() {
    var page = document.getElementById("page"); if (!page) return;
    css();
    try { document.body.classList.add("fo-nt-on"); } catch (e) {}
    if (!jwt() || !claimed()) {
      page.innerHTML = "<div class='fo-nt'><div class='fo-nt-in'>" + hero(0) +
        "<div class='fo-nt-card'><div class='fo-nt-empty'>Claim a club and the world starts talking to you.</div></div>" +
        "</div></div>";
      return;
    }
    var asks = N.asks || [], news = N.news || [];
    var body = "";
    if (asks.length) {
      body += "<div class='fo-nt-card'><div class='fo-nt-ck'>Waiting on you<i>" + asks.length + "</i></div>" +
        asks.map(function (x) { return row(x, true); }).join("") + "</div>";
    }
    body += "<div class='fo-nt-card'><div class='fo-nt-ck'>The club diary</div>" +
      (news.length ? news.map(function (x) { return row(x, false); }).join("")
                   : "<div class='fo-nt-empty'>Nothing has happened yet. Play a round.</div>") +
      "</div>";
    if (!asks.length && !news.length) {
      body = "<div class='fo-nt-card'><div class='fo-nt-empty'>Nothing to report. " +
        "Everything at this club is in hand.</div></div>";
    }
    page.innerHTML = "<div class='fo-nt'><div class='fo-nt-in'>" + hero(asks.length) + body + "</div></div>";

    // OPENING THE PAGE READS THE NEWS - and only the news. The asks keep
    // their place in the badge until they are actually done, which is the
    // whole distinction the old localStorage bell never made.
    if (news.some(function (x) { return x.fresh; })) {
      // read now, tell the server after - the same law as markSeen above
      news.forEach(function (x) { x.fresh = false; });
      N.unread = asks.length; badge();
      try { window.__foMktBell && __foMktBell(); } catch (eMk) {}
      rpc("world_notifications_seen").catch(function () {});
    } else { N.unread = asks.length; badge(); }
  }
  function hero(nAsk) {
    var club = "";
    try { club = (window.__foWorldClaim && window.__foWorldClaim.club) || (userTeam() || {}).name || ""; } catch (e) {}
    return "<div class='fo-nt-hero'><i>" + E(String(club).toUpperCase()) + (club ? " &middot; " : "") + "THE POST" +
      "</i><h1>News</h1>" +
      (nAsk ? "<u>" + nAsk + (nAsk === 1 ? " thing needs you" : " things need you") + "</u>" : "") +
      "</div>";
  }
  window.foRenderNewsPage = function () {
    draw();
    // and ask the world again on the way in, so a page opened cold is current
    refresh();
  };

  function css() {
    if (document.getElementById("fo-nt-css")) return;
    var s = document.createElement("style"); s.id = "fo-nt-css";
    s.textContent = [
      // the bell
      "#topbar #fo-nbell{position:relative;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;color:#dce9f2;text-decoration:none;flex:0 0 auto;align-self:center}",
      "#topbar #fo-nbell svg{width:18px;height:18px}",
      "#topbar #fo-nbell:hover{background:rgba(255,255,255,.12)}",
      "#topbar #fo-nbell.has{color:#E8B96A}",
      "#topbar #fo-nbell i{position:absolute;top:2px;right:1px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#C9571F;color:#fff;font:800 10px/16px Oswald,sans-serif;text-align:center;font-style:normal;box-shadow:0 0 0 2px rgba(9,25,50,.9)}",
      // the page
      "html body.fo-nt-on #page{background:#F1EEE6}",
      ".fo-nt-in{max-width:760px;margin:0 auto;padding:14px 12px 40px}",
      ".fo-nt-hero{background:linear-gradient(135deg,#14243A,#14243A);border-radius:16px;padding:20px 22px;margin-bottom:12px;border-left:4px solid #C9571F}",
      ".fo-nt-hero i{font:700 10px Oswald,sans-serif;letter-spacing:.22em;color:#E8B96A;font-style:normal}",
      ".fo-nt-hero h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:34px;color:#FFFEFC;margin:4px 0 0}",
      ".fo-nt-hero u{display:inline-block;margin-top:8px;text-decoration:none;font:600 11px Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#F1B27A}",
      ".fo-nt-card{background:#FFFEFC;border:1px solid #e3dccb;border-radius:14px;box-shadow:0 2px 10px rgba(20,36,58,.05);padding:6px 14px 8px;margin-bottom:12px}",
      ".fo-nt-ck{display:flex;align-items:center;gap:8px;font:600 10px Oswald,sans-serif;letter-spacing:.19em;text-transform:uppercase;color:#a49b86;padding:11px 0 9px;border-bottom:1px solid #efe9dc}",
      ".fo-nt-ck i{font:700 10px Oswald,sans-serif;font-style:normal;color:#C9571F}",
      "html body #page a.fo-nt-row{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:11px;align-items:center;padding:11px 0;border-bottom:1px solid #f4efe3;text-decoration:none;color:#14243A !important}",
      "html body #page a.fo-nt-row:last-of-type{border-bottom:none}",
      "html body #page a.fo-nt-row:hover{background:#FBF8F0}",
      ".fo-nt-row .ic{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;background:#F4F0E5;color:#8a8272;text-decoration:none}",
      ".fo-nt-row .ic svg{width:16px;height:16px}",
      ".fo-nt-row .tx{min-width:0}",
      ".fo-nt-row b{display:block;font:650 13.5px/1.3 Inter,sans-serif;color:#14243A}",
      ".fo-nt-row i{display:block;margin-top:2px;font:400 13px/1.45 Inter,sans-serif;color:#6d6455;font-style:normal}",
      ".fo-nt-row .wh{font:600 10px Oswald,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:#b3aa96;white-space:nowrap;align-self:start;padding-top:3px}",
      // an ask reads as a thing to do, not a thing that happened
      ".fo-nt-row.ask .ic{background:#FBF2E2;color:#B8933A}",
      ".fo-nt-row.ask .wh{color:#B8933A}",
      ".fo-nt-row.urgent .ic{background:#FBEAE0;color:#C9571F}",
      ".fo-nt-row.urgent .wh{color:#C9571F}",
      ".fo-nt-row.urgent b{color:#B44A22}",
      // and unread news carries a quiet mark rather than a shout
      ".fo-nt-row.fresh .ic{background:#E7F1EC;color:#177A57}",
      ".fo-nt-row.fresh b:after{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:#C9571F;margin-left:7px;vertical-align:middle}",
      ".fo-nt-empty{padding:22px 4px;text-align:center;font:400 12.5px Fraunces,Georgia,serif;color:#a49b86}",
      "@media(max-width:560px){.fo-nt-hero h1{font-size:27px}.fo-nt-row b{font-size:12.5px}.fo-nt-row i{font-size:11px}",
      "html body #page a.fo-nt-row{grid-template-columns:26px minmax(0,1fr);gap:9px}.fo-nt-row .wh{display:none}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  // ---- keep it alive --------------------------------------------------------
  // The bell is rebuilt whenever the topbar is, and the count is refreshed on
  // a slow poll and whenever the tab comes back - a manager who leaves the
  // game open should not have to reload to learn he has been outbid.
  // THE ROUTER IS WRAPPED, NOT REPLACED. Every room in this game hangs its
  // own renderer off the end of route() rather than editing a switch nobody
  // owns; #/news does the same, so nothing else has to know it exists.
  function hook() {
    if (typeof window.route !== "function" || window.route.__foNt) return;
    var prev = window.route;
    window.route = function () {
      var r = prev.apply(this, arguments);
      try {
        if (/^#\/news/.test(location.hash || "")) draw();
        else { try { document.body.classList.remove("fo-nt-on"); } catch (eC) {} }
      } catch (e) {}
      return r;
    };
    window.route.__foNt = 1;
  }
  function boot() {
    try { hook(); } catch (eH) {}
    try { wire(); } catch (e) {}
    refresh();
    if (/^#\/news/.test(location.hash || "")) draw();
  }
  try {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else setTimeout(boot, 400);
  } catch (eB) {}
  setInterval(function () {
    try { hook(); } catch (eH2) {}
    try { if (document.hidden) return; } catch (e) {}
    wire(); refresh();
  }, 90000);
  try {
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && Date.now() - N.at > 30000) { wire(); refresh(); }
    });
  } catch (eV) {}
})();
