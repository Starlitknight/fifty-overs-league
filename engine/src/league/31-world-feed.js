// ---- 31-world-feed.js — the client reads the SERVED world -----------------
// P1 deliverable (f): when a World Service is configured, England's league
// on the planet comes from the server's snapshots - real persisted matches
// run by the umpire - instead of the local deterministic sim. Configure via
//   localStorage.fo_world_api = "https://your-service"   (no trailing slash)
// Absent or unreachable, the client falls back silently to local sim: the
// static game never breaks because a server is down.
(function () {
  "use strict";
  // the game's own Supabase project doubles as the default World Service:
  // the world-tick workflow writes snapshots there and PostgREST serves the
  // read-only world_snapshots view to this (public-by-design) anon key
  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  function base() {
    try { return (localStorage.getItem("fo_world_api") || window.FO_WORLD_API || "").replace(/\/$/, ""); } catch (e) { return ""; }
  }
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  var FEED = null;
  function accept(j) {
    if (!j || !j.table) return;
    FEED = j; window.__foWorldFeed = j;
    try { localStorage.setItem("fo_world_feed_cache", JSON.stringify(j)); } catch (e) {}
    paint();
  }
  var SEEN_TS = null;
  function refresh() {
    try { if (document.hidden) return; } catch (eH) {}
    var b = base();
    try {
      if (b) {
        // an explicitly configured service keeps the P1 JSON shape
        fetch(b + "/league/eng.json", { mode: "cors" }).then(function (r) { return r.ok ? r.json() : null; }).then(accept).catch(function () {});
      } else {
        // egress manners: probe the tiny updated_at first and download the
        // body only when the umpire actually wrote something new
        var q = "/rest/v1/world_snapshots?key=eq." + encodeURIComponent("league/eng");
        fetch(SB_URL + q + "&select=updated_at", { headers: { apikey: SB_ANON } })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (rows) {
            var ts = rows && rows[0] && rows[0].updated_at;
            if (!ts || ts === SEEN_TS) return null;
            SEEN_TS = ts;
            return fetch(SB_URL + q + "&select=body", { headers: { apikey: SB_ANON } })
              .then(function (r2) { return r2.ok ? r2.json() : null; })
              .then(function (rows2) { accept(rows2 && rows2[0] && rows2[0].body); });
          }).catch(function () {});
      }
    } catch (e) {}
  }
  try { var c = localStorage.getItem("fo_world_feed_cache"); if (c) { FEED = JSON.parse(c); window.__foWorldFeed = FEED; } } catch (e) {}

  // ---- any nation's served league record, fetched on demand ----------------
  // Nation pages want the REAL season - the matches the umpire banked - for
  // any of the 19 leagues. Same egress manners as the England feed: probe the
  // tiny updated_at, download the body only when the umpire wrote something
  // new, and keep the last copy in localStorage so the page paints instantly.
  var LG_BODY = {}, LG_TS = {}, LG_BUSY = {}, LG_AT = {}, LG_WAIT = {};
  var LG_TTL = 45000;                 // a nation's standings, at most this often
  // EVERY CALLER GETS ITS ANSWER. Two screens ask for the same nation - the
  // club home wants your form and your position, the league page wants the
  // table - and the second one used to arrive while the first one's probe was
  // still in the air, hit the busy flag or the courtesy window, and have its
  // repaint dropped on the floor. It then painted from whatever was in
  // localStorage at that instant and was never told the body had landed. That
  // is how the home page could show a defeat the table had not heard about.
  // Waiters are queued instead, and flushed together when the fetch settles.
  // A WAITER IS TOLD LATER, NEVER DURING THE ASK. Every callback handed to
  // want()/lgFetch is some page's "repaint me when the data lands" - and that
  // repaint calls want() again. Answering a callback SYNCHRONOUSLY therefore
  // re-enters the very function that is mid-answer: repaint -> want -> repaint
  // -> want, forever. With a cold cache the loop never ignites (no body, no
  // callback), which is why no local test ever saw it - but on the live
  // backend the cache warms on the first fetch, and from then on every visit
  // to the home, league or fixtures page recursed until the stack blew, then
  // did it again on the next tick until the page froze solid. Measured live:
  // "RangeError: Maximum call stack size exceeded" in foRenderHome, then a
  // renderer pinned at 106% CPU with every menu dead.
  // So: flushes are deferred to their own task, and a warm cache answers
  // NOBODY - the caller already holds the data (it called get() first; that
  // is the contract every caller follows), so there is nothing to announce.
  function lgFlush(rid) {
    var ws = LG_WAIT[rid] || []; LG_WAIT[rid] = [];
    if (!ws.length) return;
    setTimeout(function () {
      for (var i = 0; i < ws.length; i++) { try { ws[i](LG_BODY[rid] || null); } catch (e) {} }
    }, 0);
  }
  // ---- THE CALENDAR IS SET BY THE WORLD, NOT BY THE DATE ---------------------
  // Every snapshot says which season it is and which world day that season
  // opened on. The planet used to assume season 1 opened on day 0, which was
  // true only for the world as first founded: a world restarted on day 2 then
  // had every page counting rounds two days ahead of the umpire, so a league
  // that had not bowled a ball was announced as round three. Handing the
  // snapshot's own start_day to the planet the moment it lands settles that for
  // every surface at once, including the ones that only do date arithmetic.
  // The anchor is taken from THIS DEVICE'S NATION where there is one - a
  // manager's own league is the calendar he lives by - and from England, the
  // reference nation the cup schedule is cut from, where there is not.
  // get() runs for all nineteen nations on every planet repaint, so this must
  // not parse storage each time: the claim in memory answers for free, and the
  // cached one is read once per page.
  var ANCH_NAT = null, ANCH_READ = 0;
  function anchorNation() {
    try { if (window.__foWorldClaim && window.__foWorldClaim.country) return window.__foWorldClaim.country; } catch (e) {}
    if (ANCH_READ) return ANCH_NAT;
    ANCH_READ = 1; ANCH_NAT = "eng";
    try {
      var c = JSON.parse(localStorage.getItem("fo_world_claim") || "null");
      if (c && c.country) ANCH_NAT = c.country;
    } catch (e2) {}
    return ANCH_NAT;
  }
  function anchorTo(rid, body) {
    try {
      if (!body || body.startDay == null || !(body.seasonNo >= 1)) return;
      if (rid !== anchorNation()) return;
      if (window.__foPlanet && window.__foPlanet.anchorWorld) {
        window.__foPlanet.anchorWorld(body.startDay, body.seasonNo);
      }
    } catch (e) {}
  }
  function lgFetch(rid, cb) {
    if (!rid) return;
    // THE WHOLE PLANET AT ONCE. The world page now asks for all nineteen
    // nations' standings, so without a courtesy window a repaint would put
    // nineteen probes on the wire every time it painted. Inside that window
    // the copy already in hand IS the answer - the caller has it from get() -
    // and no callback fires (see the note above lgFlush).
    if (!LG_BUSY[rid] && LG_AT[rid] && Date.now() - LG_AT[rid] < LG_TTL) return;
    if (cb) (LG_WAIT[rid] = LG_WAIT[rid] || []).push(cb);
    if (LG_BUSY[rid]) return;                    // in flight: the flush will reach us
    LG_BUSY[rid] = 1; LG_AT[rid] = Date.now();
    var done = function () { LG_BUSY[rid] = 0; lgFlush(rid); };
    var take = function (body) {
      if (body && body.results) {
        LG_BODY[rid] = body;
        anchorTo(rid, body);
        try { localStorage.setItem("fo_world_lg_" + rid, JSON.stringify(body)); } catch (e) {}
        // THE PAGE HEARS THE UMPIRE. A fresh body only reaches here when
        // updated_at moved - the umpire genuinely wrote something new - and
        // most surfaces ask with a no-op callback, so without this the page a
        // manager is LOOKING AT kept its stale round until they navigated.
        // One event, announced after the flush settles, and the open league
        // surface repaints itself (listener below).
        try { window.dispatchEvent(new CustomEvent("fo-world-fresh", { detail: { rid: rid } })); } catch (eEv) {}
      }
      done();
    };
    var b = base();
    try {
      if (b) { fetch(b + "/league/" + rid + ".json", { mode: "cors" }).then(function (r) { return r.ok ? r.json() : null; }).then(take, done); return; }
      var q = "/rest/v1/world_snapshots?key=eq." + encodeURIComponent("league/" + rid);
      fetch(SB_URL + q + "&select=updated_at", { headers: { apikey: SB_ANON } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (rows) {
          var ts = rows && rows[0] && rows[0].updated_at;
          if (!ts || ts === LG_TS[rid]) { done(); return; }
          LG_TS[rid] = ts;
          fetch(SB_URL + q + "&select=body", { headers: { apikey: SB_ANON } })
            .then(function (r2) { return r2.ok ? r2.json() : null; })
            .then(function (rows2) { take(rows2 && rows2[0] && rows2[0].body); }, done);
        }, done).catch(done);
    } catch (e) { done(); }
  }
  // ---- served club names: humans christen their clubs -----------------------
  // The clubs table is the naming authority (a claimed club may be renamed;
  // bots keep county names). Ten tiny rows per nation from the world_clubs
  // view, cached with a courtesy TTL, so fixtures/orders/spectate all speak
  // the CURRENT names.
  // The same ten rows also say WHO RUNS EACH CLUB. In a world where humans and
  // bots share a league, that is the most useful fact on the page: a manager
  // wants to know which of the nine opponents has somebody behind it. It costs
  // one more column on a request the game already makes.
  var NM_BODY = {}, NM_MGR = {}, NM_AT = {}, NM_BUSY = {}, NM_WAIT = {};
  window.__foWorldNames = {
    get: function (rid) {
      if (NM_BODY[rid]) return NM_BODY[rid];
      try { var c3 = localStorage.getItem("fo_world_nm_" + rid); if (c3) { NM_BODY[rid] = JSON.parse(c3); return NM_BODY[rid]; } } catch (e) {}
      return null;
    },
    // slot -> manager display name for claimed clubs, and "g"+slot -> ground
    mgr: function (rid) {
      if (NM_MGR[rid]) return NM_MGR[rid];
      try { var c4 = localStorage.getItem("fo_world_mgr_" + rid); if (c4) { NM_MGR[rid] = JSON.parse(c4); return NM_MGR[rid]; } } catch (e) {}
      return null;
    },
    // same waiting-room as the standings above: a caller asking mid-flight is
    // queued rather than ignored, and told in a task of its own - see the
    // recursion note above lgFlush; inside the courtesy window the names the
    // caller already read via get() ARE the answer, and no callback fires
    want: function (rid, cb) {
      try {
        if (!rid) return;
        if (!NM_BUSY[rid] && NM_AT[rid] && Date.now() - NM_AT[rid] < 60000) return;
        if (cb) (NM_WAIT[rid] = NM_WAIT[rid] || []).push(cb);
        if (NM_BUSY[rid]) return;
        NM_BUSY[rid] = 1;
        var done = function () {
          NM_BUSY[rid] = 0; NM_AT[rid] = Date.now();
          var ws = NM_WAIT[rid] || []; NM_WAIT[rid] = [];
          if (!ws.length) return;
          setTimeout(function () {
            for (var i = 0; i < ws.length; i++) { try { ws[i](NM_BODY[rid] || null); } catch (e) {} }
          }, 0);
        };
        fetch(SB_URL + "/rest/v1/world_clubs?country_id=eq." + encodeURIComponent(rid) + "&select=slot,name,manager,ground", { headers: { apikey: SB_ANON } })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (rows) {
            if (rows && rows.length) {
              var m = {}, g = {};
              rows.forEach(function (r2) {
                m[r2.slot] = r2.name;
                if (r2.manager) g[r2.slot] = r2.manager;
                if (r2.ground) g["g" + r2.slot] = r2.ground;
              });
              var changed = JSON.stringify(m) !== JSON.stringify(NM_BODY[rid] || null) ||
                            JSON.stringify(g) !== JSON.stringify(NM_MGR[rid] || null);
              NM_BODY[rid] = m; NM_MGR[rid] = g;
              try {
                localStorage.setItem("fo_world_nm_" + rid, JSON.stringify(m));
                localStorage.setItem("fo_world_mgr_" + rid, JSON.stringify(g));
              } catch (e) {}
              if (!changed) { /* nothing moved; done() still answers the waiters */ }
            }
            done();
          }, done).catch(done);
      } catch (e) { NM_BUSY[rid] = 0; }
    }
  };

  window.__foWorldLg = {
    // the cached copy anchors the calendar too: it is something the world
    // already said, and the first paint of a cold page happens before the
    // fetch lands. It is overwritten by the live body the moment that arrives.
    get: function (rid) {
      if (LG_BODY[rid]) { anchorTo(rid, LG_BODY[rid]); return LG_BODY[rid]; }
      try {
        var c2 = localStorage.getItem("fo_world_lg_" + rid);
        if (c2) { LG_BODY[rid] = JSON.parse(c2); anchorTo(rid, LG_BODY[rid]); return LG_BODY[rid]; }
      } catch (e) {}
      return null;
    },
    want: function (rid, cb) { try { lgFetch(rid, cb); } catch (e) {} }
  };

  // the served-world card on the planet page: the SERVER's England league
  function paint() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/planet") return;
      if (!FEED) return;
      var page = document.getElementById("page"); if (!page) return;
      var host = page.querySelector(".fo-pl"); if (!host) return;
      var ex = page.querySelector("#fo-wsvc"); if (ex) ex.remove();
      var top3 = FEED.table.slice(0, 3).map(function (r, i) {
        return "<div class='r'><i>" + (i + 1) + "</i><b>" + E(r.name) + (r.boss ? " <u>FLAGSHIP</u>" : "") + "</b><em>" + r.pts + " pts</em></div>";
      }).join("");
      var el = document.createElement("div");
      el.id = "fo-wsvc";
      el.innerHTML = "<i>The World Service &middot; served world &middot; engine " + E(FEED.results.length ? FEED.results[0].engineVersion : "v1") + "</i>" +
        "<b>England, Season " + (window.foSeasonN ? foSeasonN(FEED.seasonNo) : FEED.seasonNo) + " &middot; round " + FEED.roundsPlayed + " of " + FEED.rounds + "</b>" + top3 +
        (FEED.results.length ? "<span>" + E(FEED.results[FEED.results.length - 1].text) + "</span>" : "");
      var own = page.querySelector(".fo-pl-own");
      if (own && own.parentNode) own.parentNode.insertBefore(el, own.nextSibling);
      else host.appendChild(el);
    } catch (e) {}
  }
  var CSS = [
    "html body #page #fo-wsvc{margin-top:14px;background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-left:3px solid #177A57;border-radius:16px;padding:14px 16px}",
    "html body #page #fo-wsvc>i{display:block;font:700 11px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#177A57;font-style:normal}",
    "html body #page #fo-wsvc>b{display:block;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:15px;margin:6px 0 8px;color:#1B2432}",
    "html body #page #fo-wsvc .r{display:flex;gap:8px;align-items:baseline;font:500 13px/1.5 Oswald,sans-serif;color:#1B2432}",
    "html body #page #fo-wsvc .r i{font-style:normal;color:rgba(20,28,40,.45);width:12px}",
    "html body #page #fo-wsvc .r b{flex:1;font-weight:600}",
    "html body #page #fo-wsvc .r u{text-decoration:none;font:700 11px/1 Oswald,sans-serif;color:#B44A22;letter-spacing:.1em}",
    "html body #page #fo-wsvc .r em{font-style:normal;font-variant-numeric:tabular-nums}",
    "html body #page #fo-wsvc>span{display:block;font:400 13px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.6);margin-top:7px}"
  ].join("\n");
  function mount() {
    try {
      var s = document.getElementById("fo-wsvc-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-wsvc-css"; s.textContent = CSS; document.body.appendChild(s); }
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); setTimeout(refresh, 600); });
  else { setTimeout(mount, 0); setTimeout(refresh, 600); }
  // AN OPEN PAGE MUST LEARN THE ROUND WAS PLAYED. Every league surface asks
  // via want() when it paints - but a page left sitting open paints nothing,
  // so nobody asked, and the club home said "next match v Glamorgan" for hours
  // after Glamorgan had been and gone. The idle heartbeat asks for MY nation's
  // snapshot too (a tiny updated_at probe; the body only downloads when the
  // umpire wrote), and asks again the moment the tab is brought back.
  function nudgeMine() {
    try { if (document.hidden) return; } catch (eH) {}
    try { lgFetch(anchorNation()); } catch (e) {}
  }
  setInterval(function () { refresh(); nudgeMine(); }, 300000);   // rounds land a few times a day; five minutes is plenty
  window.addEventListener("focus", nudgeMine);
  document.addEventListener("visibilitychange", function () { try { if (!document.hidden) nudgeMine(); } catch (e) {} });
  window.addEventListener("hashchange", function () { setTimeout(paint, 200); });
  window.__foWorldFeedRefresh = refresh;

  // ---- repaint the open surface when fresh truth lands ----------------------
  // The surfaces that speak league facts re-render whole from state, so the
  // correct reaction to a fresh snapshot is simply "paint this page again".
  // Scoped to the pages that read the served world, debounced so a burst of
  // nations landing together paints once - and never during a live broadcast,
  // whose own renderer owns the screen.
  var FRESH_PAGES = { "#/home": 1, "": 1, "#/": 1, "#/fixtures": 1, "#/league": 1, "#/matches": 1, "#/planet": 1, "#/facup": 1, "#/champions": 1, "#/records": 1 };
  var FRESH_T = null;
  window.addEventListener("fo-world-fresh", function () {
    clearTimeout(FRESH_T);
    FRESH_T = setTimeout(function () {
      try {
        var h = (location.hash || "").split("?")[0];
        if (!FRESH_PAGES[h]) return;
        if (typeof window.route === "function") window.route();
      } catch (e) {}
    }, 350);
  });
})();
