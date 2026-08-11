// 45-live-scores.js — THE WHOLE WORLD'S CRICKET, ON ONE PAGE.
//
// Sixteen nations play on sixteen different clocks, and until now the only way
// to find the cricket in progress was to guess which league was awake, open its
// fixtures and read down. The header has said "3 LIVE" for a long time without
// anywhere to click. This is that click: every match on earth today, sorted the
// way a scores page sorts - what is in play, then what is about to start, then
// what has finished - with a real score on the live ones.
//
// THE SCORE IS THE BROADCAST'S OWN. A card here must never disagree with the
// feed it links to, so it does not compute anything itself: it borrows the
// umpire's book from the feed (__foFeedKit) and reads it with the same clock.
// One record, one reconstruction, two ways of looking at it.
(function () {
  // NOT __foLive - that name is taken, by the live-state helper the club room
  // and the matchday centre both call. Guarding on it meant this whole file
  // returned at its first line and the route rendered nothing, silently.
  if (window.__foLiveScores) return; window.__foLiveScores = 1;
  var E = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var P = function () { return window.__foPlanet || null; };
  var T = { timer: null, sig: null, scores: {} };

  // ---- what the world is doing right now -----------------------------------
  // Every nation's day, classified against its own hour. This is the same
  // three-way split the league room uses per nation; it is simply asked of all
  // of them at once.
  function worldToday(now) {
    var pl = P(), wt = window.__foWT;
    if (!pl || !wt || !wt.serverFixtures || !pl.nations) return null;
    var hNow = (now - (pl.EPOCH + pl.dayIx(now) * 86400000)) / 3600000;
    var LEN = pl.LIVE_LEN || 3;
    var out = [];
    (pl.nations() || []).forEach(function (r) {
      var sv;
      try { sv = wt.serverFixtures(r.id, now); } catch (e) { return; }
      var fx = (sv && sv.fx) || [];
      if (!fx.length) return;                       // a rest day in this league
      var h0 = pl.natHour(r.id);
      var state = hNow < h0 ? "up" : hNow < h0 + LEN ? "live" : "fin";
      out.push({ id: r.id, nm: r.nm || r.id.toUpperCase(), hour: h0, state: state,
        cal: sv.cal, fx: fx,
        winStart: pl.EPOCH + pl.dayIx(now) * 86400000 + h0 * 3600000 });
    });
    return out;
  }

  // A CLUB WEARS SOMETHING. The dossier already dresses every club - a real
  // crest where the world has one, an arms mark where it does not, initials in
  // a shield as the last resort - so a scores page asks it rather than drawing
  // its own. Two words of a name become the fallback letters.
  function crest(nm, px) {
    try { if (window.foClubCrest) return "<span class='fo-lv-cr'>" + window.foClubCrest(nm, px || 38) + "</span>"; } catch (e) {}
    var w = String(nm || "").split(/\s+/).filter(Boolean);
    var ini = (w.length > 1 ? w.map(function (x) { return x[0] || ""; }).join("") : String(w[0] || ""))
      .replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "FC";
    return "<span class='fo-lv-cr ini'>" + E(ini) + "</span>";
  }
  function flagOf(id) {
    try {
      var nm = { eng: "England", aus: "Australia", sub: "India", pak: "Pakistan", rsa: "South Africa",
        nzl: "New Zealand", slk: "Sri Lanka", bgd: "Bangladesh", win: "West Indies", zim: "Zimbabwe",
        ire: "Ireland", afg: "Afghanistan", sco: "Scotland", ned: "Netherlands", nep: "Nepal", usa: "USA" }[id];
      if (nm && typeof foFlag === "function") return foFlag(nm) || "";
    } catch (e) {}
    return "";
  }

  function matchId(n, m) {
    return n.id + ":s" + n.cal.seasonNo + ":r" + n.cal.round + ":h" + m.home.slot + "a" + m.away.slot;
  }

  // ---- the live score for one match, off the umpire's own book --------------
  function wantScore(n, m, idx, repaint) {
    var kit = window.__foFeedKit; if (!kit) return null;
    var id = matchId(n, m);
    if (T.scores[id] !== undefined) return T.scores[id];
    T.scores[id] = null;                            // asked; do not ask twice
    kit.logFetch(n.id, id).then(function (log) {
      if (!log) { T.scores[id] = false; return; }   // sealed, or not banked yet
      T.scores[id] = { log: log };
      repaint();
    });
    return null;
  }
  function readScore(n, m, now) {
    var kit = window.__foFeedKit, id = matchId(n, m), got = T.scores[id];
    if (!kit || !got || !got.log) return null;
    var BALL_MS = ((P().LIVE_LEN || 3) * 3600000) / 600;
    var at = kit.seenAt(got.log, n.winStart, BALL_MS, now);
    var inns = kit.bookState(at.seen);
    var i = inns[1].open || (inns[1].bats && inns[1].bats.length) ? 1 : 0;
    var I = inns[i], tp = I.top ? kit.parseTop(I.top.txt) : null;
    var runs = tp ? tp.runs : null, wkts = tp ? tp.wkts : null;
    // the over summary lags the last ball, so the closing figure comes off the
    // innings itself when the umpire has moved on past his own tally
    if (I.close) { runs = I.close.runs; wkts = I.close.wkts; }
    return { inn: i, team: I.team || (i ? m.away.name : m.home.name),
      runs: runs, wkts: wkts, ovs: I.lastNo || (tp ? tp.over + ".0" : null),
      bats: (I.bats || []).filter(function (b) { return b && !b.out; }).slice(0, 2),
      bowler: I.bowler, live: at.live, done: at.done, first: inns[0] };
  }

  // ---- the cards -----------------------------------------------------------
  function scoreLine(s) {
    if (!s || s.runs == null) return "<span class='fo-lv-wait'>The umpire is walking out</span>";
    return "<b>" + s.runs + "/" + s.wkts + "</b>" + (s.ovs ? "<u>" + E(s.ovs) + " ov</u>" : "");
  }
  function chaseLine(s, m) {
    if (!s || s.inn !== 1 || !s.first || !s.first.close) return "";
    var target = (s.first.close.runs | 0) + 1, need = target - (s.runs | 0);
    if (need <= 0 || s.runs == null) return "";
    var ovs = String(s.ovs || "0.0").split("."), left = 300 - ((+ovs[0] || 0) * 6 + (+ovs[1] || 0));
    if (left <= 0) return "";
    return "<div class='fo-lv-need'><b>" + need + "</b> needed off <b>" + left + "</b>" +
      "<em>" + (need / (left / 6)).toFixed(2) + " an over</em></div>";
  }
  function card(n, m, idx, now, mine) {
    var s = n.state === "live" ? readScore(n, m, now) : null;
    var href = "#/feed?n=" + encodeURIComponent(n.id) + "&f=" + idx;
    // A SIDE IS A CREST, A NAME AND A SCORE, on a grid rather than a flex row.
    // Flex let the name decide where everything after it began, so the crest on
    // the row WITH a score and the crest on the row without it started at
    // different places - two badges an inch apart down a card that is meant to
    // read as one column. Three fixed tracks, and they cannot drift.
    var side = function (nm, isBat) {
      return "<div class='fo-lv-side" + (isBat ? " bat" : "") + "'>" + crest(nm) +
        "<span class='nm'>" + E(nm) + "</span>" +
        (isBat && s && s.runs != null
          ? "<span class='sc'><b>" + s.runs + "/" + s.wkts + "</b>" +
            (s.ovs ? "<u>" + E(s.ovs) + "</u>" : "") + "</span>"
          : "<span class='sc'></span>") + "</div>";
    };
    var homeBat = s && s.team === m.home.name;
    var body = side(m.home.name, !!s && homeBat) + side(m.away.name, !!s && !homeBat);
    if (n.state === "live") body += chaseLine(s, m);
    else if (n.state === "up") body += "<div class='fo-lv-when'>First ball " +
      (P().hhTxt ? P().hhTxt(n.hour) : n.hour + ":00") + "</div>";
    return "<a class='fo-lv-card" + (n.state === "live" ? " on" : "") + (mine ? " mine" : "") +
      "' href='" + href + "'>" + body + "</a>";
  }

  function block(n, now, claim) {
    var flag = n.state === "live"
      ? "<s class='fo-lv-dot'></s>LIVE"
      : n.state === "fin" ? "Stumps" : (P().hhTxt ? P().hhTxt(n.hour) : n.hour + ":00");
    return "<section class='fo-lv-blk " + n.state + "'>" +
      "<div class='fo-lv-bh'>" + flagOf(n.id) + "<h2>" + E(n.nm) + "</h2>" +
      "<span class='fo-lv-rd'>Round " + (n.cal.round | 0) + "</span>" +
      "<span class='fo-lv-st'>" + flag + "</span></div>" +
      "<div class='fo-lv-grid'>" + n.fx.map(function (m, i) {
        var mine = !!(claim && claim.country === n.id && (m.home.name === claim.club || m.away.name === claim.club));
        return card(n, m, i, now, mine);
      }).join("") + "</div></section>";
  }

  window.foRenderLiveScores = function () {
    var page = document.getElementById("page"); if (!page) return;
    css();
    document.body.classList.add("fo-lv-on");
    var now = Date.now(), world = worldToday(now);
    if (!world) { page.innerHTML = "<div class='fo-lv'><div class='fo-lv-in'><p class='fo-lv-load'>Reaching the world&hellip;</p></div></div>";
      setTimeout(window.foRenderLiveScores, 600); return; }
    var claim = null; try { claim = window.__foClaim || null; } catch (e) {}
    var repaint = function () {
      if ((location.hash || "").split("?")[0] !== "#/live") return;
      T.sig = null; window.foRenderLiveScores();
    };
    // ask for the book behind every live match; each answer repaints
    world.forEach(function (n) {
      if (n.state !== "live") return;
      n.fx.forEach(function (m, i) { wantScore(n, m, i, repaint); });
    });
    var live = world.filter(function (n) { return n.state === "live"; });
    var up = world.filter(function (n) { return n.state === "up"; }).sort(function (a, b) { return a.hour - b.hour; });
    var fin = world.filter(function (n) { return n.state === "fin"; });
    var nMatches = live.reduce(function (s, n) { return s + n.fx.length; }, 0);
    var head = "<div class='fo-lv-hd'><div class='eb'>Around the world</div>" +
      "<h1>Live scores</h1><div class='ty'>" +
      (nMatches ? "<b>" + nMatches + "</b> match" + (nMatches === 1 ? "" : "es") + " in play in <b>" + live.length + "</b> " +
        (live.length === 1 ? "league" : "leagues")
        : up.length ? "Nothing in play &middot; first ball " + (P().hhTxt ? P().hhTxt(up[0].hour) : up[0].hour + ":00")
        : "No cricket anywhere today") + "</div></div>";
    // A SCORES PAGE SHOWS WHAT IS ON. Finished matches were a third of the page
    // and none of the point - the record keeps them, the league room lists them,
    // and a reader who came here came for cricket in progress. They are gone.
    // What is still to come is kept only when nothing is live, because the one
    // thing worse than a finished match on a scores page is an empty one.
    var body = live.map(function (n) { return block(n, now, claim); }).join("");
    if (!live.length && up.length) {
      body = "<div class='fo-lv-rule'><span>First ball " +
        (P().hhTxt ? P().hhTxt(up[0].hour) : up[0].hour + ":00") + "</span></div>" +
        up.map(function (n) { return block(n, now, claim); }).join("");
    }
    if (!body) body = "<div class='fo-lv-rest'><b>" +
      (world.length ? "Every league has finished for the day." : "A rest day across the whole world.") + "</b>" +
      "<span>" + (world.length ? "Today&rsquo;s results are in the league room; the next round bowls tomorrow."
                               : "Nobody is playing today. The next round bowls tomorrow.") + "</span>" +
      "<a href='#/league'>Your league &rsaquo;</a><a href='#/schedule'>The calendar &rsaquo;</a></div>";
    page.innerHTML = "<div class='fo-lv'><div class='fo-lv-in'>" + head + body +
      "<div class='fo-lv-foot'><a href='#/world'>&larr; The world</a><a href='#/league'>Your league</a></div>" +
      "</div></div>";
    clearInterval(T.timer);
    T.timer = setInterval(function () {
      if ((location.hash || "").split("?")[0] !== "#/live") { clearInterval(T.timer); return; }
      window.foRenderLiveScores();
    }, 12000);
  };

  window.addEventListener("hashchange", function () {
    if ((location.hash || "").split("?")[0] !== "#/live") {
      document.body.classList.remove("fo-lv-on");
      try { clearInterval(T.timer); } catch (e) {}
    }
  });

  function css() {
    if (document.getElementById("fo-lv-css")) return;
    var s = document.createElement("style"); s.id = "fo-lv-css";
    s.textContent = [
      "html body.fo-lv-on{background:#F1EEE6 !important}",
      "html body.fo-lv-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body.fo-lv-on #page{padding:0 !important;background:transparent !important}",
      ".fo-lv{--ink:#1B2432;--paper:#FFFEFC;--brd:#e3dccb;--mut:#8a8272;--brand:#C9571F;--navy:#14243A;--live:#177A57;",
      "  color:var(--ink);font-family:Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
      ".fo-lv-in{max-width:1180px;margin:0 auto;padding:22px 20px 48px}",
      ".fo-lv-hd{padding:6px 0 16px;border-bottom:1px solid var(--brd);margin-bottom:18px}",
      ".fo-lv-hd .eb{font:700 11px Manrope,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:var(--brand)}",
      ".fo-lv-hd h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:34px;line-height:1.1;margin:6px 0 4px;color:var(--navy)}",
      // the masthead sits on a rule the way a board does, not a hairline
      ".fo-lv-hd{border-bottom-width:2px;border-bottom-color:var(--navy)}",
      ".fo-lv-hd .ty{font:500 13.5px Manrope,sans-serif;color:var(--mut)}",
      ".fo-lv-hd .ty b{color:var(--ink);font-weight:800}",
      ".fo-lv-blk{margin-bottom:20px}",
      ".fo-lv-bh{display:flex;align-items:center;gap:10px;margin:0 0 9px;padding-bottom:7px;border-bottom:1px solid rgba(27,36,50,.09)}",
      // the nation's own flag, at the size the world map uses
      ".fo-lv-bh img{width:26px;height:18px;object-fit:cover;border-radius:3px;flex:none;box-shadow:0 1px 3px rgba(20,36,58,.22)}",
      ".fo-lv-bh h2{font:800 15px Manrope,sans-serif;letter-spacing:.02em;margin:0;color:var(--navy)}",
      ".fo-lv-rd{font:600 11px Manrope,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--mut)}",
      ".fo-lv-st{margin-left:auto;font:800 11px Manrope,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--mut);display:flex;align-items:center;gap:6px}",
      ".fo-lv-blk.live .fo-lv-st{color:var(--brand)}",
      ".fo-lv-dot{width:7px;height:7px;border-radius:50%;background:var(--brand);display:inline-block;animation:foLvP 1.6s ease-in-out infinite}",
      ".fo-lv-card.on{border-left-color:var(--brand)}",
      "@keyframes foLvP{0%,100%{opacity:1}50%{opacity:.25}}",
      "@media(prefers-reduced-motion:reduce){.fo-lv-dot{animation:none}}",
      ".fo-lv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(272px,1fr));gap:12px}",
      // WIDER CARDS, FEWER OF THEM. At 272px a county name had nowhere to go and
      // every card in the world ended in an ellipsis - "Band-e...", "Kunduz...".
      // A name is the one thing on the card that cannot be abbreviated.
      ".fo-lv-grid{grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:13px}",
      ".fo-lv-card{display:grid;gap:7px;position:relative;text-decoration:none;color:inherit;background:var(--paper);border:1px solid var(--brd);border-radius:12px;padding:15px 17px 14px;box-shadow:0 1px 3px rgba(20,36,58,.05);transition:box-shadow .16s,border-color .16s}",
      ".fo-lv-card:hover,.fo-lv-card:focus-visible{box-shadow:0 6px 20px rgba(20,36,58,.11);border-color:#cfc6b2;outline:none}",
      ".fo-lv-card.on{border-left:3px solid var(--brand);padding-left:15px}",
      ".fo-lv-card.mine{border-color:#C89A2E;box-shadow:0 2px 14px rgba(200,154,46,.18)}",
      ".fo-lv-mine{position:absolute;top:-8px;right:13px;background:#C89A2E;color:#FFFEFC;font:800 9px/1 Manrope,sans-serif;letter-spacing:.14em;padding:3px 8px;border-radius:3px;font-style:normal}",
      // three fixed tracks: the badge, the name, the figures. Both rows of a
      // card sit on the same grid, so the crests line up down the column.
      ".fo-lv-side{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:12px}",
      ".fo-lv-cr{width:38px;height:38px;display:flex;align-items:center;justify-content:center;overflow:hidden}",
      ".fo-lv-cr>*,.fo-lv-cr img,.fo-lv-cr svg{width:100%;height:100%;object-fit:contain;display:block}",
      ".fo-lv-cr.ini{background:var(--navy);color:#FFFEFC;border-radius:7px;font:800 13px/1 Manrope,sans-serif;letter-spacing:.03em}",
      ".fo-lv-side .nm{min-width:0;font:600 15px/1.2 Manrope,sans-serif;color:#6E6656;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".fo-lv-side.bat .nm{color:var(--ink);font-weight:800}",
      ".fo-lv-side .sc{display:flex;align-items:baseline;gap:7px;font-variant-numeric:tabular-nums;white-space:nowrap}",
      ".fo-lv-side .sc b{font:600 24px/1 Fraunces,Georgia,serif;letter-spacing:-.015em;color:var(--navy)}",
      ".fo-lv-side .sc u{text-decoration:none;font:600 11px/1 Manrope,sans-serif;color:var(--mut)}",
      ".fo-lv-need,.fo-lv-when{margin-top:1px;padding-top:9px;border-top:1px solid rgba(27,36,50,.08);font:600 12.5px/1 Manrope,sans-serif;color:var(--brand);display:flex;align-items:baseline;gap:9px}",
      ".fo-lv-need b{font-weight:800}",
      ".fo-lv-need em{font-style:normal;color:var(--mut);font-weight:500;margin-left:auto}",
      ".fo-lv-when{color:var(--mut);font-weight:600}",
      ".fo-lv-rule{display:flex;align-items:center;gap:12px;margin:26px 0 14px;color:var(--mut)}",
      ".fo-lv-rule span{font:700 10.5px Manrope,sans-serif;letter-spacing:.2em;text-transform:uppercase;white-space:nowrap}",
      ".fo-lv-rule:after{content:'';flex:1;height:1px;background:var(--brd)}",
      ".fo-lv-rest,.fo-lv-load{background:var(--paper);border:1px solid var(--brd);border-radius:13px;padding:22px;text-align:center}",
      ".fo-lv-rest b{display:block;font:800 16px Manrope,sans-serif;color:var(--navy);margin-bottom:5px}",
      ".fo-lv-rest span{display:block;font:500 13px Manrope,sans-serif;color:var(--mut);margin-bottom:11px}",
      ".fo-lv-rest a,.fo-lv-foot a{font:700 12px Manrope,sans-serif;color:var(--brand);text-decoration:none;margin-right:16px}",
      ".fo-lv-foot{margin-top:26px;padding-top:14px;border-top:1px solid var(--brd)}",
      "@media(max-width:640px){.fo-lv-in{padding:16px 12px 36px}.fo-lv-hd h1{font-size:27px}.fo-lv-grid{grid-template-columns:1fr}}"
    ].join("");
    document.head.appendChild(s);
  }
})();
