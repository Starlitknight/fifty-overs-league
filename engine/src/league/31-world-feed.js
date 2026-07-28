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
  var LG_BODY = {}, LG_TS = {}, LG_BUSY = {}, LG_AT = {};
  var LG_TTL = 45000;                 // a nation's standings, at most this often
  function lgFetch(rid, cb) {
    if (!rid || LG_BUSY[rid]) return;
    // THE WHOLE PLANET AT ONCE. The world page now asks for all nineteen
    // nations' standings, so without a courtesy window a repaint would put
    // nineteen probes on the wire every time it painted.
    if (LG_AT[rid] && Date.now() - LG_AT[rid] < LG_TTL) return;
    LG_BUSY[rid] = 1; LG_AT[rid] = Date.now();
    var done = function () { LG_BUSY[rid] = 0; };
    var take = function (body) {
      if (body && body.results) {
        LG_BODY[rid] = body;
        try { localStorage.setItem("fo_world_lg_" + rid, JSON.stringify(body)); } catch (e) {}
        try { if (cb) cb(body); } catch (e) {}
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
  var NM_BODY = {}, NM_MGR = {}, NM_AT = {}, NM_BUSY = {};
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
    want: function (rid, cb) {
      try {
        if (!rid || NM_BUSY[rid]) return;
        if (NM_AT[rid] && Date.now() - NM_AT[rid] < 60000) return;
        NM_BUSY[rid] = 1;
        var done = function () { NM_BUSY[rid] = 0; NM_AT[rid] = Date.now(); };
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
              if (changed) { try { if (cb) cb(m); } catch (e) {} }
            }
            done();
          }, done).catch(done);
      } catch (e) { NM_BUSY[rid] = 0; }
    }
  };

  window.__foWorldLg = {
    get: function (rid) {
      if (LG_BODY[rid]) return LG_BODY[rid];
      try { var c2 = localStorage.getItem("fo_world_lg_" + rid); if (c2) { LG_BODY[rid] = JSON.parse(c2); return LG_BODY[rid]; } } catch (e) {}
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
        "<b>England, Season " + FEED.seasonNo + " &middot; round " + FEED.roundsPlayed + " of " + FEED.rounds + "</b>" + top3 +
        (FEED.results.length ? "<span>" + E(FEED.results[FEED.results.length - 1].text) + "</span>" : "");
      var own = page.querySelector(".fo-pl-own");
      if (own && own.parentNode) own.parentNode.insertBefore(el, own.nextSibling);
      else host.appendChild(el);
    } catch (e) {}
  }
  var CSS = [
    "html body #page #fo-wsvc{margin-top:14px;background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-left:3px solid #177A57;border-radius:16px;padding:14px 16px}",
    "html body #page #fo-wsvc>i{display:block;font:700 9px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#177A57;font-style:normal}",
    "html body #page #fo-wsvc>b{display:block;font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:15px;margin:6px 0 8px;color:#141C28}",
    "html body #page #fo-wsvc .r{display:flex;gap:8px;align-items:baseline;font:500 12px/1.5 Inter,sans-serif;color:#141C28}",
    "html body #page #fo-wsvc .r i{font-style:normal;color:rgba(20,28,40,.45);width:12px}",
    "html body #page #fo-wsvc .r b{flex:1;font-weight:600}",
    "html body #page #fo-wsvc .r u{text-decoration:none;font:700 8px/1 Oswald,sans-serif;color:#B44A22;letter-spacing:.1em}",
    "html body #page #fo-wsvc .r em{font-style:normal;font-variant-numeric:tabular-nums}",
    "html body #page #fo-wsvc>span{display:block;font:italic 400 11.5px/1.5 'Fraunces',Georgia,serif;color:rgba(20,28,40,.6);margin-top:7px}"
  ].join("\n");
  function mount() {
    try {
      var s = document.getElementById("fo-wsvc-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-wsvc-css"; s.textContent = CSS; document.body.appendChild(s); }
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); setTimeout(refresh, 600); });
  else { setTimeout(mount, 0); setTimeout(refresh, 600); }
  setInterval(refresh, 300000);   // rounds land once a day; five minutes is plenty
  window.addEventListener("hashchange", function () { setTimeout(paint, 200); });
  window.__foWorldFeedRefresh = refresh;
})();
