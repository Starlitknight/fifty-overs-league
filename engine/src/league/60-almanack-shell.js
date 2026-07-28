/* ============================================================================
   THE LIVING ALMANACK — the global shell.

   Phase 1 of the redesign. This module owns the frame every redesigned screen
   lives inside: the navy header with the round countdown, the five-section
   navigation, and the helpers that build a page in the order the brief
   demands - masthead, decision strip, evidence, archive.

   IT DOES NOT TOUCH THE GAME. No engine state is written here; the screens
   read App/GD exactly as the old ones did and call the same actions. The
   redesign replaces composition and CSS, not logic.

   Routes are taken over one at a time (the brief is explicit: establish the
   language on a few screens first). A route in AL_OWNS renders in this shell;
   every other route still renders the way it does today, and the shell stays
   out of its way entirely.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foAl) return; window.__foAl = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function path() { return (location.hash || "").split("?")[0]; }
  function lg() { try { return window.__foLeague ? window.__foLeague() : null; } catch (e) { return null; } }
  function team() { try { return userTeam() || null; } catch (e) { return null; } }

  // ---- the five sections ---------------------------------------------------
  // Every route in the game belongs to exactly one of them. The dock shows
  // where you are even on routes this redesign has not reached yet, so the
  // navigation is coherent from the first commit.
  var SECTIONS = [
    { id: "today",  label: "Today",  home: "#/today",  routes: ["today", "home", "desk", "matchday", "watch", "match"] },
    { id: "team",   label: "Team",   home: "#/team",   routes: ["team", "squad", "orders", "training", "academy", "player", "dossier"] },
    { id: "league", label: "League", home: "#/table",  routes: ["table", "league", "fixtures", "records", "planet", "world", "rankings", "cup", "comps", "nations", "nation", "atlas", "scorecard", "reports"] },
    { id: "market", label: "Market", home: "#/market", routes: ["market", "team-page"] },
    { id: "club",   label: "Club",   home: "#/club-h", routes: ["club-h", "finance", "milestones", "lore", "paper", "wire", "guide", "ledger", "almanack"] },
  ];
  // routes this redesign currently OWNS. Everything else keeps its old page.
  var AL_OWNS = {
    today: 1, team: 1, matchday: 1, table: 1, fixtures: 1,
    market: 1, finance: 1, academy: 1, training: 1, dossier: 1, desk: 1,
  };

  // A section is bigger than one screen, and the dock only has five slots. The
  // rest of a section's rooms hang off a rule under the masthead - the same
  // place a newspaper puts the rest of its section.
  var SUB = {
    team: [
      { id: "team", label: "The eleven", href: "#/team" },
      { id: "training", label: "Nets", href: "#/training" },
      { id: "academy", label: "Academy", href: "#/academy" },
      { id: "dossier", label: "Scout", href: "#/dossier" },
    ],
    club: [
      { id: "club-h", label: "The club", href: "#/club-h" },
      { id: "finance", label: "The books", href: "#/finance" },
      { id: "milestones", label: "Honours", href: "#/milestones" },
      { id: "paper", label: "Gazette", href: "#/paper" },
    ],
    league: [
      { id: "table", label: "Table", href: "#/table" },
      { id: "fixtures", label: "Fixtures", href: "#/fixtures" },
      { id: "records", label: "Record book", href: "#/records" },
      { id: "planet", label: "World", href: "#/planet" },
    ],
  };

  var ICON = {
    today:  '<path d="M4 5h16v15H4z"/><path d="M4 9h16"/><path d="M8 3v4M16 3v4"/>',
    team:   '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M17 11a2.5 2.5 0 1 0 0-5"/><path d="M18 20c0-2.2-.9-4.2-2.3-5.6"/>',
    league: '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/><path d="M12 13v4M9 20h6"/>',
    market: '<path d="M4 8h16l-1 12H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    club:   '<path d="M4 20V9l8-5 8 5v11z"/><path d="M10 20v-6h4v6"/>',
  };
  function svg(id) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[id] || "") + "</svg>";
  }

  function sectionOf(p) {
    var r = (p || path()).replace("#/", "");
    for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].routes.indexOf(r) >= 0) return SECTIONS[i];
    return SECTIONS[0];
  }
  window.__foAlSection = sectionOf;

  // ---- the round clock -----------------------------------------------------
  // A daily game's most useful readout is not the time, it is how long is
  // left. Rounds resolve at 9:00 AM New York; this is that, in the header,
  // on every screen.
  function nextRoundMs() {
    try {
      var now = new Date();
      var f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false });
      var p = Object.fromEntries(f.formatToParts(now).map(function (x) { return [x.type, x.value]; }));
      var mins = (parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10));
      var left = (9 * 60) - mins; if (left <= 0) left += 24 * 60;
      return left * 60000;
    } catch (e) { return 0; }
  }
  function clockText() {
    var ms = nextRoundMs(), h = Math.floor(ms / 3600000), m = Math.round((ms % 3600000) / 60000);
    if (m === 60) { h += 1; m = 0; }
    var rd = 0; try { rd = ((App.season && App.season.round) | 0) + 1; } catch (e) {}
    return { top: (h ? h + "H " : "") + m + "M", sub: rd ? "ROUND " + rd : "NEXT ROUND" };
  }
  window.__foAlClock = clockText;

  // ---- the shell -----------------------------------------------------------
  function ensure() {
    var head = document.getElementById("al-head");
    if (!head) {
      head = document.createElement("header");
      head.id = "al-head"; head.className = "al-head";
      document.body.insertBefore(head, document.body.firstChild);
    }
    var dock = document.getElementById("al-dock");
    if (!dock) {
      dock = document.createElement("nav");
      dock.id = "al-dock"; dock.className = "al-dock";
      dock.setAttribute("aria-label", "Sections");
      dock.innerHTML = SECTIONS.map(function (s) {
        return '<a href="' + s.home + '" data-al-sec="' + s.id + '">' + svg(s.id) + "<span>" + s.label + "</span></a>";
      }).join("");
      document.body.appendChild(dock);
      dock.addEventListener("click", function (e) {
        var a = e.target.closest ? e.target.closest("a[data-al-sec]") : null;
        if (!a) return;
        e.preventDefault();
        location.hash = a.getAttribute("href").slice(1);
        if (typeof window.route === "function") window.route();
      });
    }
    return { head: head, dock: dock };
  }

  function paintShell() {
    try {
      var el = ensure(), sec = sectionOf(), c = clockText(), t = team();
      var club = (t && t.name) || "Fifty Overs";
      var nav = SECTIONS.map(function (s) {
        return '<a href="' + s.home + '" data-al-sec="' + s.id + '"' +
          (s.id === sec.id ? ' aria-current="page"' : "") + ">" + E(s.label) + "</a>";
      }).join("");
      el.head.innerHTML =
        '<div class="al-head__mark">FO</div>' +
        '<div class="al-head__where"><i>' + E(sec.label) + "</i><b>" + E(club) + "</b></div>" +
        '<div class="al-head__spacer"></div>' +
        '<div class="al-head__nav">' + nav + "</div>" +
        '<div class="al-head__clock"><span>' + E(c.sub) + "</span><b>" + E(c.top) + "</b></div>";
      var links = el.dock.querySelectorAll("a[data-al-sec]");
      for (var i = 0; i < links.length; i++) {
        if (links[i].getAttribute("data-al-sec") === sec.id) links[i].setAttribute("aria-current", "page");
        else links[i].removeAttribute("aria-current");
      }
      if (!el.head.__wired) {
        el.head.__wired = 1;
        el.head.addEventListener("click", function (e) {
          var a = e.target.closest ? e.target.closest("a[data-al-sec]") : null;
          if (!a) return;
          e.preventDefault(); location.hash = a.getAttribute("href").slice(1);
          if (typeof window.route === "function") window.route();
        });
      }
    } catch (e) {}
  }

  // The shell is only worn on routes the redesign owns; elsewhere the old
  // chrome stays, unchanged and unbroken, until its screen is rebuilt.
  function owns() { return !!AL_OWNS[path().replace("#/", "")]; }
  window.__foAlOwns = owns;

  function apply() {
    try {
      var on = owns();
      document.body.classList.toggle("al-on", on);
      var head = document.getElementById("al-head"), dock = document.getElementById("al-dock");
      if (!on) { if (head) head.style.display = "none"; if (dock) dock.style.display = "none"; return; }
      ensure();
      document.getElementById("al-head").style.display = "";
      document.getElementById("al-dock").style.display = "";
      paintShell();
    } catch (e) {}
  }
  window.__foAlApply = apply;

  // ---- the words a player is described in ----------------------------------
  // Every roster surface in the Almanack prints the same three things about a
  // player, so they are said once, here. Two of them were being got wrong:
  // `p.rating` is the engine's internal points value (five figures), not the
  // overall a manager reads; and a player has no `form` field at all - the
  // word is `formWord`, which the rest of the game has always printed.
  var ROLE = {
    opener: "Opener", topOrderBat: "Top order", topOrder: "Top order",
    middleOrderBat: "Middle order", middleOrder: "Middle order", middle: "Middle order",
    finisher: "Finisher", allRounder: "All-rounder", wicketkeeper: "Wicketkeeper",
    keeper: "Wicketkeeper", seamFast: "Fast bowler", seamMedium: "Medium pacer",
    seam: "Seamer", spinOff: "Off spinner", spinLeg: "Leg spinner", spin: "Spinner",
  };
  function cap(x) { return String(x == null ? "" : x).replace(/^\w/, function (c) { return c.toUpperCase(); }); }
  function roleWord(p) {
    if (!p) return "Player";
    var k = p.role || p.roleFull || "";
    return ROLE[k] || cap(String(k).replace(/([A-Z])/g, " $1").trim()) || "Player";
  }
  function formWord(p) {
    var f = (p && (p.formWord || p.form)) || "";
    if (typeof f === "number") return f > 60 ? "Good form" : f < 40 ? "Out of form" : "Steady";
    return cap(f) || "Steady";
  }
  function ovr(p) {
    try { if (typeof window.foPkOvr === "function") return window.foPkOvr(p) | 0; } catch (e) {}
    return Math.round(((p && p.rating) || 0) / 1000);
  }

  // ---- page builders -------------------------------------------------------
  // Every redesigned screen is assembled from these, in this order, so the
  // publication reads the same way on every route.
  var AL = {
    page: function (parts) {
      return '<div class="al-page' + (parts.acting ? " al-page--acting" : "") + '"><div class="al-page__in">' +
        (parts.body || "") + "</div></div>" + (parts.sticky || "");
    },
    mast: function (eyebrow, title, line) {
      return '<div class="al-mast">' +
        (eyebrow ? '<div class="al-mast__eyebrow">' + E(eyebrow) + "</div>" : "") +
        "<h1>" + E(title) + "</h1>" +
        (line ? "<p>" + E(line) + "</p>" : "") + "</div>";
    },
    // Artwork is a plate: natural ratio, full brightness, nothing over it.
    plate: function (src, caption) {
      if (!src) return "";
      return '<figure class="al-plate">' +
        (caption ? "<figcaption>" + E(caption) + "</figcaption>" : "") +
        '<img src="' + E(src) + '" alt="" loading="lazy">' + "</figure>";
    },
    decide: function (o) {
      var kind = o.kind === "act" ? " al-decide--act" : (o.kind === "done" ? " al-decide--done" : "");
      return '<div class="al-decide' + kind + '"><div class="al-decide__txt"><b>' + E(o.title) + "</b>" +
        (o.note ? "<i>" + E(o.note) + "</i>" : "") + "</div>" +
        (o.action ? '<a class="al-btn ' + (o.primary ? "al-btn--primary" : "") + '" href="' + E(o.action.href) + '">' + E(o.action.label) + "</a>" : "") +
        "</div>";
    },
    sec: function (title, inner, link) {
      return '<section class="al-sec"><div class="al-sec__head"><h2>' + E(title) + "</h2>" +
        (link ? '<a href="' + E(link.href) + '">' + E(link.label) + " &rsaquo;</a>" : "") +
        "</div>" + inner + "</section>";
    },
    ledger: function (rows) {
      return '<div class="al-ledger">' + rows.map(function (r) {
        return '<div><span class="k">' + E(r[0]) + '</span><span class="v' + (r[2] ? " v--" + r[2] : "") + '">' + E(r[1]) + "</span></div>";
      }).join("") + "</div>";
    },
    sticky: function (note, label, act) {
      return '<div class="al-sticky"><div class="al-sticky__in">' +
        '<div class="al-sticky__note">' + E(note) + "</div>" +
        '<button class="al-btn al-btn--primary" data-al-act="' + E(act) + '">' + E(label) + "</button>" +
        "</div></div>";
    },
    subnav: function (cur) {
      var items = SUB[sectionOf().id]; if (!items) return "";
      return '<nav class="al-subnav" aria-label="Section">' + items.map(function (x) {
        return '<a href="' + x.href + '"' + (x.id === cur ? ' aria-current="page"' : "") + ">" + E(x.label) + "</a>";
      }).join("") + "</nav>";
    },
    // in-page tabs wear the section navigation's dress: same rule, same
    // measure, so a reader never has to learn two ways of switching view
    tabs: function (items, cur) {
      return '<nav class="al-subnav al-subnav--tabs" aria-label="View">' + items.map(function (x) {
        return '<button type="button" data-al-tab="' + E(x.id) + '"' +
          (x.id === cur ? ' aria-current="page"' : "") + ">" + E(x.label) +
          (x.count ? ' <b>' + E(x.count) + "</b>" : "") + "</button>";
      }).join("") + "</nav>";
    },
    meter: function (pct, kind) {
      var v = Math.max(0, Math.min(100, Math.round(pct || 0)));
      return '<div class="al-meter' + (kind ? " al-meter--" + kind : "") +
        '" role="img" aria-label="' + v + ' per cent"><s style="width:' + v + '%"></s></div>';
    },
    msg: function (id) { return '<p class="al-msg" id="' + E(id) + '"></p>'; },
    tag: function (text, kind) { return '<span class="al-tag' + (kind ? " al-tag--" + kind : "") + '">' + E(text) + "</span>"; },
    empty: function (title, line) { return '<div class="al-empty"><h3>' + E(title) + "</h3><p>" + E(line) + "</p></div>"; },
    E: E, section: sectionOf, clock: clockText, league: lg, team: team,
    role: roleWord, form: formWord, ovr: ovr, cap: cap,
  };
  window.AL = AL;

  // keep the header honest: the countdown moves, so it repaints on the minute
  setInterval(function () { try { if (owns()) paintShell(); } catch (e) {} }, 30000);
  window.addEventListener("hashchange", apply);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
})();
