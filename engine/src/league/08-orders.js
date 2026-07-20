  // =========================================================================
  // ORDERS, REBUILT. A batting list (arrows + C/WK chips - duplicates are
  // impossible) and a paint-the-overs bowling board: pick a bowler as the
  // brush, tap overs to paint his spells - any shape, any length. Everything
  // compiles into the engine's own grid/spells model, so the resolver and
  // the AI captain see exactly what they always saw. Sub-panels re-render
  // in place - no page rebuilds.
  // =========================================================================
  var FO_ORD_COLS = ["#2d6a8f", "#a33328", "#1c5537", "#c08a2b", "#6a4a8f", "#0E6E6A", "#8f5a2d"];
  try {
    // (set-XI honoring — ordersMap / saved user XI — now lives in the
    // engine's pickXI itself)
  } catch (e) {}
  // the chosen XI as player objects; heals itself if names went stale
  function foOrdXI() {
    var t = userTeam();
    var by = {}; (t.players || []).forEach(function (p) { by[p.name] = p; });
    var names = (App.orders.xi || []).filter(function (nm) { return by[nm]; });
    if (names.length !== 11 || names.filter(function (nm) { return by[nm].bowlType; }).length < 5) {
      names = pickXI(t).map(function (p) { return p.name; });
      App.orders.xi = names;
    } else App.orders.xi = names;
    return names.map(function (nm) { return by[nm]; });
  }
  function foOrdTotals() {
    var g = App.orders.grid || [], tot = {};
    for (var o = 1; o <= 50; o++) if (g[o]) tot[g[o]] = (tot[g[o]] || 0) + 1;
    return tot;
  }
  function foOrdSurname(nm) { var b = String(nm || "").split(" "); return b.length > 1 ? b.slice(1).join(" ") : nm; }
  function foOrdPool(withPT) {
    var xi = foOrdXI();
    var pool = xi.filter(function (p) { return p.bowlType; })
      .sort(function (a, b) { return (isPT(a) - isPT(b)) || (aggBowl(b) - aggBowl(a)); });
    return withPT ? pool : pool.filter(function (p) { return !isPT(p); });
  }
  function foOrdColors() {
    var map = {};
    foOrdPool(true).forEach(function (p, i) { map[p.name] = FO_ORD_COLS[i % FO_ORD_COLS.length]; });
    return map;
  }
  function foOrdBatRows() {
    var t = userTeam(), xi = foOrdXI();
    var byName = {}; xi.forEach(function (p) { byName[p.name] = p; });
    // batting order = a permutation of the XI, always: drop strangers, add missing
    App.orders.batOrder = (App.orders.batOrder || []).filter(function (n) { return byName[n]; });
    xi.forEach(function (p) { if (App.orders.batOrder.indexOf(p.name) < 0) App.orders.batOrder.push(p.name); });
    return App.orders.batOrder.slice(0, 11).map(function (nm, i) {
      var p = byName[nm] || {};
      var isC = App.orders.captain === nm, isW = App.orders.keeper === nm;
      var bv = Math.round(aggBat(p) || 0);
      var bc = bv >= 70 ? "#16A34A" : bv >= 50 ? "#4DA6A2" : bv >= 30 ? "#c08a2b" : "#b3402a";
      var tals = (p.talents || []).slice(0, 2).map(function (t2) { return "<span class='fo-sq-talent' title='" + E((typeof TALTIPS !== "undefined" && TALTIPS[t2]) || "") + "'>" + E(typeof ptal === "function" ? ptal(t2) : t2) + "</span>"; }).join("");
      return "<div class='fo-ob-row'>" +
        "<span class='fo-ob-n" + (i < 3 ? " top" : "") + "'>" + (i + 1) + "</span>" +
        "<div class='fo-ob-who'><b>" + E(nm) + (p.keeper ? " <s title='wicketkeeper'>&dagger;</s>" : "") + tals + "</b><span class='small'>" + E(prole(p.role || "")) + " · bat <b style='color:" + bc + "'>" + bv + "</b>" + (p.bowlType ? " · " + E(shortBT(p)) : "") + "</span></div>" +
        "<button class='fo-ob-chip" + (isC ? " on" : "") + "' data-fo-capt='" + E(nm) + "' title='captain'>C</button>" +
        "<button class='fo-ob-chip" + (isW ? " on" : "") + "' data-fo-wk='" + E(nm) + "' title='wicketkeeper'>WK</button>" +
        "<span class='fo-ob-mv'><button data-fo-up='" + i + "' " + (i === 0 ? "disabled" : "") + ">&#9650;</button><button data-fo-dn='" + i + "' " + (i === 10 ? "disabled" : "") + ">&#9660;</button><button class='fo-ob-swap' data-fo-swap='" + E(nm) + "' title='swap with a bench player'>&#8644;</button></span>" +
        "</div>";
    }).join("");
  }
  function foOrdBowlBody() {
    var v = compilePlan();
    var tot = foOrdTotals(), colors = foOrdColors();
    var pool = foOrdPool(true);   // every XI player who can bowl, part-timers included
    if (!window.__foOrdBrush || !pool.some(function (p) { return p.name === window.__foOrdBrush; }))
      window.__foOrdBrush = pool[0] ? pool[0].name : "";
    var chips = pool.map(function (p) {
      var on = window.__foOrdBrush === p.name;
      var bw = Math.round(aggBowl(p) || 0);
      var bwc = bw >= 70 ? "#16A34A" : bw >= 50 ? "#4DA6A2" : bw >= 30 ? "#c08a2b" : "#b3402a";
      var tal = (p.talents || [])[0];
      var talTxt = tal ? " · " + E(typeof ptal === "function" ? ptal(tal) : tal) : "";
      var titleT = (p.talents || []).map(function (t2) { return (typeof ptal === "function" ? ptal(t2) : t2); }).join(", ");
      return "<button class='fo-og-b" + (on ? " on" : "") + "' data-fo-brush='" + E(p.name) + "' title='" + E(p.name) + " · " + E(shortBT(p)) + " · bowl " + bw + (titleT ? " · " + E(titleT) : "") + "'>" +
        "<em style='background:" + (colors[p.name] || "#888") + "'></em>" +
        "<span class='fo-og-bt'><b>" + E(foOrdSurname(p.name)) + (isPT(p) ? " <s>pt</s>" : "") + "</b><i>" + E(shortBT(p)) + " · <n style='color:" + (on ? "#c7cfda" : bwc) + "'>" + bw + "</n>" + talTxt + "</i></span>" +
        "<u>" + (tot[p.name] || 0) + "</u></button>";
    }).join("") +
      "<button class='fo-og-b fo-og-clear' data-fo-clearall title='wipe the whole plan'>&#8709; Clear all</button>";

    var g = App.orders.grid || [], rows = "";
    for (var r0 = 0; r0 < 5; r0++) {
      var cells2 = "";
      for (var c0 = 1; c0 <= 10; c0++) {
        var o = r0 * 10 + c0, nm = g[o];
        cells2 += "<button class='fo-og-c' data-fo-cell='" + o + "' title='over " + o + (nm ? " · " + E(nm) : " · AI decides") + "' style='" + (nm ? "background:" + (colors[nm] || "#888") + " !important;color:#FFFEFC !important;border-color:transparent !important" : "") + "'>" + o + "</button>";
      }
      var hint = r0 === 0 ? "powerplay" : r0 === 4 ? "death" : "";
      rows += "<div class='fo-og-row'><span class='fo-og-l'>" + (r0 * 10 + 1) + "&ndash;" + (r0 * 10 + 10) + (hint ? "<i>" + hint + "</i>" : "") + "</span>" + cells2 + "</div>";
    }
    var tchips = Object.keys(tot).map(function (nm) {
      var over = tot[nm] > 10;
      return "<span class='fo-os-tchip" + (over ? " bad" : "") + "'><i style='background:" + (colors[nm] || "#888") + "'></i>" + E(foOrdSurname(nm)) + " " + tot[nm] + "/10</span>";
    }).join("");
    var covered = v.covered || 0;
    var bad = (v.warns || []).filter(function (w) { return /double-booked|consecutive|max 10|not a/.test(w); });
    return "<div class='fo-og-pal'>" + chips + "</div>" + rows +
      "<div class='fo-os-tot'>" + tchips + "<span class='fo-os-cov'>" + covered + "/50 overs planned" + (covered < 50 ? " · the AI captain covers the rest" : "") + "</span></div>" +
      (bad.length ? "<div class='fo-os-warn'>&#9888; " + bad.map(E).join(" · ") + "</div>" : "");
  }
  function foOrdBenchSheet(outNm) {
    var old = document.getElementById("fo-osheet"); if (old) old.remove();
    var t = userTeam(), xi = foOrdXI();
    var by = {}; xi.forEach(function (p) { by[p.name] = p; });
    var out = by[outNm]; if (!out) return;
    var bowlersLeft = xi.filter(function (p) { return p.bowlType && p.name !== outNm; }).length;
    var bench = (t.players || []).filter(function (p) { return !by[p.name]; });
    var rows = bench.map(function (p) {
      var ok = (bowlersLeft + (p.bowlType ? 1 : 0)) >= 5;
      var bits = [E(prole(p.role || "")), "bat " + Math.round(aggBat(p) || 0)];
      if (p.bowlType) bits.push(E(shortBT(p)) + " " + Math.round(aggBowl(p) || 0));
      if (p.keeper) bits.push("keeper");
      var tals = (p.talents || []).map(function (t2) { return (typeof ptal === "function" ? ptal(t2) : t2); }).join(", ");
      return "<button class='fo-osh-row' data-fo-bench='" + E(p.name) + "' " + (ok ? "" : "disabled") + ">" +
        "<div><b>" + E(p.name) + "</b><span class='small'>" + bits.join(" · ") + (tals ? " · " + E(tals) : "") + "</span></div>" +
        (ok ? "" : "<span class='fo-osh-note bad'>would leave fewer than five bowlers</span>") + "</button>";
    }).join("") || "<div class='small' style='padding:8px 2px'>No one on the bench - the whole squad is in the XI.</div>";
    var m = document.createElement("div"); m.id = "fo-osheet";
    m.innerHTML = "<div class='fo-osh-card'><div class='fo-osh-h'><b>Replace " + E(outNm) + "</b><span class='small'>pick from the bench</span><button id='fo-osh-x'>&#10005;</button></div>" + rows + "</div>";
    document.body.appendChild(m);
    m.addEventListener("click", function (ev) {
      var x = ev.target.closest ? ev.target.closest("#fo-osh-x") : null;
      if (x || ev.target === m) { m.remove(); return; }
      var b = ev.target.closest ? ev.target.closest("[data-fo-bench]") : null;
      if (!b || b.disabled) return;
      var inNm = b.getAttribute("data-fo-bench");
      var ix = App.orders.xi.indexOf(outNm);
      if (ix >= 0) App.orders.xi[ix] = inNm;
      var bix = App.orders.batOrder.indexOf(outNm);
      if (bix >= 0) App.orders.batOrder[bix] = inNm;
      // the departing man leaves the bowling plan and any C/WK armband
      gridState();
      for (var o = 1; o <= 50; o++) if (App.orders.grid[o] === outNm) App.orders.grid[o] = null;
      gridToSpells();
      var xi2 = foOrdXI();
      if (App.orders.captain === outNm) App.orders.captain = xi2.slice().sort(function (a, b2) { return (b2.capt || 0) - (a.capt || 0); })[0].name;
      if (App.orders.keeper === outNm) App.orders.keeper = (xi2.filter(function (p) { return p.keeper; })[0] || xi2[0]).name;
      m.remove();
      foOrdRepaint();
    });
  }
  function foOrdRepaint(which) {
    var b1 = document.getElementById("fo-bat-rows"), b2 = document.getElementById("fo-bowl-body");
    if (b1 && which !== "bowl") b1.innerHTML = foOrdBatRows();
    if (b2 && which !== "bat") b2.innerHTML = foOrdBowlBody();
  }
  function foOrdSheet(phIx, par) {
    var old = document.getElementById("fo-osheet"); if (old) old.remove();
    var t = userTeam(), ph = FO_ORD_PH[phIx];
    var slotN = foOrdSlotOvers(ph, par).length;
    var tot = foOrdTotals();
    var cur = foOrdSlotOwner(ph, par);
    var other = foOrdSlotOwner(ph, par === 1 ? 0 : 1);
    var pool = (t.players || []).filter(function (p) { return p.bowlType; })
      .sort(function (a, b) { return (isPT(a) - isPT(b)) || (aggBowl(b) - aggBowl(a)); });
    var rows = pool.map(function (p) {
      var mine = cur && cur.nm === p.name ? (tot[p.name] || 0) - cur.n : (tot[p.name] || 0);
      var after = mine + slotN;
      var sameEndClash = other && other.nm === p.name;   // both ends of a phase = back-to-back overs
      var dis = sameEndClash || after > 10;
      var why = sameEndClash ? "already bowling the other end this phase" : (after > 10 ? "would pass 10 overs (" + after + ")" : (mine ? mine + " ov planned elsewhere" : ""));
      return "<button class='fo-osh-row' data-fo-pick='" + E(p.name) + "' " + (dis ? "disabled" : "") + ">" +
        "<div><b>" + E(p.name) + (isPT(p) ? " <span class='fo-osh-pt'>part-time</span>" : "") + "</b><span class='small'>" + E(shortBT(p)) + " · bowl " + Math.round(aggBowl(p) || 0) + "</span></div>" +
        "<span class='fo-osh-note" + (dis ? " bad" : "") + "'>" + E(why) + "</span></button>";
    }).join("");
    var m = document.createElement("div"); m.id = "fo-osheet";
    m.innerHTML = "<div class='fo-osh-card'><div class='fo-osh-h'><b>" + ph.lbl + " · " + (par === 1 ? "End A" : "End B") + "</b><span class='small'>" + slotN + " overs, never back-to-back</span><button id='fo-osh-x'>&#10005;</button></div>" +
      "<button class='fo-osh-row fo-osh-ai' data-fo-pick=''><div><b>Let the AI captain decide</b><span class='small'>leave these overs unplanned</span></div></button>" + rows + "</div>";
    document.body.appendChild(m);
    m.addEventListener("click", function (ev) {
      var x = ev.target.closest ? ev.target.closest("#fo-osh-x") : null;
      if (x || ev.target === m) { m.remove(); return; }
      var b = ev.target.closest ? ev.target.closest("[data-fo-pick]") : null;
      if (!b || b.disabled) return;
      foOrdSetSlot(phIx, par, b.getAttribute("data-fo-pick") || null);
      m.remove();
      foOrdRepaint("bowl");
    });
  }
  // The conditions card: what the pitch + weather actually do in the engine,
  // which of YOUR bowlers suit them, and who to fear in their XI. The sim
  // models all of this - the selection screen finally says so.
  function foCondRead(opp) {
    try {
      if (!opp || !App.pending) return "";
      var pitch = String(opp.pitch || "balanced").toLowerCase(), wx = String(opp.weather || "").toLowerCase();
      var P = {
        green: "a green seamer - movement for the quicks, spin does little",
        dry: "a dry turner - it grips and spins more every over",
        cracked: "cracked - uneven bounce brings bowled and lbw into play",
        flat: "flat - a batting paradise, bowlers earn nothing cheap",
        slow: "slow - the ball holds in the pitch, timing is hard",
        balanced: "fair for everyone - skill decides it"
      };
      var W = {
        overcast: "cloud cover helps the seamers all day",
        humid: "heavy air - swing early, and everyone tires faster",
        drizzle: "drizzle about: boundaries are harder, and rain could shorten the chase (DLS)",
        hot: "hot - bowlers tire quicker, rotate your spells",
        scorching: "scorching - fatigue bites hard, a sixth bowling option earns his keep",
        "dew later": "dew later - gripping the ball gets harder, chasing gets easier",
        windy: "windy - big hits are riskier",
        chilly: "chilly - lively for the seamers early",
        misty: "misty - the new ball does a bit extra",
        sunny: "good batting weather"
      };
      var wantSpin = pitch === "dry" || pitch === "slow";
      var wantSeam = pitch === "green" || pitch === "cracked" || wx === "overcast" || wx === "humid" || wx === "misty" || wx === "chilly";
      var me = userTeam();
      var suited = (me.players || []).filter(function (p) {
        if (!p || !p.bowlType || p.bowlType === "none") return false;
        var spin = /spin/i.test(p.bowlTypeFull || p.bowlType);
        return wantSpin ? spin : (wantSeam ? !spin : false);
      }).sort(function (a, b) { return ((b.skills && b.skills.wicket) || 0) - ((a.skills && a.skills.wicket) || 0); }).slice(0, 2)
        .map(function (p) { return p.name.split(" ").slice(-1)[0]; });
      var suitTxt = suited.length ? (" Suits " + (wantSpin ? "your spinners" : "your seamers") + ": <b>" + suited.map(E).join(", ") + "</b>.") : "";
      // their dangermen: top of the opposition's squad by rating
      var oppT = null;
      try { oppT = (GD.teams || []).filter(function (t9) { return t9 && t9.name === App.pending.away; })[0] || GD.teams[App.pending.oppIx]; } catch (e1) {}
      var danger = "";
      if (oppT && oppT.players) {
        var top3 = oppT.players.slice().sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); }).slice(0, 3)
          .map(function (p) { return E(p.name.split(" ").slice(-1)[0]) + " <span class='small'>(" + E((typeof prole === "function" ? prole(p.role) : p.role) || "") + ")</span>"; });
        if (top3.length) danger = "<div style='margin-top:3px'>Their dangermen: " + top3.join(" · ") + "</div>";
      }
      return "<div class='fo-ord-read small'><b>The read:</b> " + (P[pitch] || P.balanced) + (W[wx] ? "; " + W[wx] : "") + "." + suitTxt + danger + "</div>";
    } catch (e) { return ""; }
  }
  // ---- simple mode: the whole sheet is a lot for a new manager. Until
  // they've played a handful of matches (or ask for the full editor), the
  // orders page is one readable Gaffer plan and one button.
  function foOrdMode() {
    var m = lsGet("fo_ord_mode");
    if (m === "simple" || m === "full") return m;
    var n = 0;
    try {
      var t9 = userTeam();
      n = (App.results || []).filter(function (r) { return r && t9 && (r.home === t9.name || r.away === t9.name); }).length;
    } catch (e) {}
    return n >= 6 ? "full" : "simple";
  }
  // the saved plan, in plain cricket language
  function foOrdPlanSummary() {
    try {
      var bo = App.orders.batOrder || [], sn = foOrdSurname;
      var lines = [];
      lines.push("<b>Openers</b> " + E(sn(bo[0] || "")) + " &amp; " + E(sn(bo[1] || "")) + " · <b>captain</b> " + E(sn(App.orders.captain || "")) + " · <b>gloves</b> " + E(sn(App.orders.keeper || "")));
      var W = { "-1": "defend", "0": "steady", "1": "attack", "2": "launch" };
      var pi = App.orders.phaseIntent || {};
      lines.push("<b>Batting</b> " + (W[String(pi.pp || 0)]) + " through the powerplay, " + (W[String(pi.mid || 0)]) + " in the middle, " + (W[String(pi.death || 0)]) + " at the death");
      gridState();
      var g = App.orders.grid || {};
      var uniq = function (a) { var s = [], o = {}; a.forEach(function (x) { if (x && !o[x]) { o[x] = 1; s.push(x); } }); return s; };
      var nb = [], dh = [];
      for (var o1 = 1; o1 <= 10; o1++) nb.push(g[o1]);
      for (var o2 = 50; o2 >= 41; o2--) dh.push(g[o2]);
      nb = uniq(nb).slice(0, 2).map(sn); dh = uniq(dh).slice(0, 2).map(sn);
      if (nb.length) lines.push("<b>New ball</b> " + nb.map(E).join(" &amp; ") + (dh.length ? " · <b>death overs</b> " + dh.map(E).join(" &amp; ") : ""));
      // capitalized on purpose: the legacy conditions decorator title-cases
      // "balanced" in any text node, so lowercase here renders half-capitalized
      var F = { bal: "Balanced", att: "Attacking", def: "Defensive" };
      var fp = App.orders.fieldPlan || {};
      lines.push("<b>Field</b> " + (F[fp.pp] || "Balanced") + " early, " + (F[fp.mid] || "Balanced") + " through the middle, " + (F[fp.death] || "Balanced") + " late · <b>toss</b> " + (App.orders.tossDecision === "bowl" ? "bowl" : "bat") + " first if we win it");
      return "<div class='fo-ord-plan'>" + lines.map(function (l) { return "<div>" + l + "</div>"; }).join("") + "</div>";
    } catch (e) { return ""; }
  }
  function foOrdersUI() {
    var page = document.getElementById("page"); if (!page) return;
    var t = userTeam(), xi = foOrdXI();
    if (!App.orders.batOrder || !App.orders.batOrder.length) App.orders.batOrder = xi.map(function (p) { return p.name; });
    if (!App.orders.tossCall) App.orders.tossCall = "H";
    if (!App.orders.captain) App.orders.captain = xi.slice().sort(function (a, b) { return (b.capt || 0) - (a.capt || 0); })[0].name;
    if (!App.orders.keeper || !xi.some(function (p) { return p.name === App.orders.keeper; }))
      App.orders.keeper = (xi.filter(function (p) { return p.keeper; })[0] || xi[0]).name;
    gridState();
    var opp = App.pending;
    if (!opp) { try { if (App.season && App.season.schedule) opp = foFixtureMeta(App.season.round); } catch (eFm) {} }
    if (!opp) opp = { home: t.name, away: "(practice)", ground: t.ground, pitch: "balanced", weather: "-" };
    var cond = "<div class='fo-ord-cond'><b>" + E(opp.home) + " v " + E(opp.away) + "</b> · " + E(foPitchName(opp.pitch)) + " pitch · " + E(opp.weather || "") + " · " + E(opp.ground || "") + "</div>" + foCondRead(opp);
    var sel2 = function (id, opts, cur) {
      return "<select data-fo-sel='" + id + "'>" + opts.map(function (o2) { return "<option value='" + o2[0] + "'" + (String(cur) === String(o2[0]) ? " selected" : "") + ">" + o2[1] + "</option>"; }).join("") + "</select>";
    };
    var INT = [[-1, "Defend"], [0, "Normal"], [1, "Attack"], [2, "Launch"]];
    var FLD = [["bal", "Balanced"], ["att", "Attacking"], ["def", "Defensive"]];
    var cell2 = function (lbl, inner) { return "<label class='fo-ord-cell'><span>" + lbl + "</span>" + inner + "</label>"; };
    var tac = "<div class='fo-ord-tac'>" +
      "<div class='fo-ord-tach'>Batting intent</div>" +
      "<div class='fo-ord-tr3'>" + cell2("Powerplay", sel2("pi:pp", INT, App.orders.phaseIntent.pp)) + cell2("Middle", sel2("pi:mid", INT, App.orders.phaseIntent.mid)) + cell2("Death", sel2("pi:death", INT, App.orders.phaseIntent.death)) + "</div>" +
      "<div class='fo-ord-tach'>Field when bowling</div>" +
      "<div class='fo-ord-tr3'>" + cell2("Powerplay", sel2("fp:pp", FLD, App.orders.fieldPlan.pp)) + cell2("Middle", sel2("fp:mid", FLD, App.orders.fieldPlan.mid)) + cell2("Death", sel2("fp:death", FLD, App.orders.fieldPlan.death)) + "</div>" +
      "<div class='fo-ord-tach'>Toss</div>" +
      "<div class='fo-ord-tr3'>" + cell2("Call", sel2("toss:call", [["H", "Heads"], ["T", "Tails"]], App.orders.tossCall || "H")) + cell2("If won", sel2("toss:dec", [["bat", "Bat"], ["bowl", "Bowl"]], App.orders.tossDecision || "bat")) + "<span></span></div></div>";
    var prev = null; try { prev = (typeof foPreviousOrders === "function") ? foPreviousOrders() : null; } catch (e) {}
    // ---- simple mode: the Gaffer fills the sheet, the manager reads it -----
    if (foOrdMode() === "simple") {
      try {
        // only auto-plan an EMPTY sheet - a saved or hand-painted plan is kept
        gridState();
        var painted0 = 0; for (var oS = 1; oS <= 50; oS++) if (App.orders.grid && App.orders.grid[oS]) painted0++;
        if (!painted0 && !App.orders.saved) { suggestOrders(); App.orders.grid = null; App.orders.gridBowlers = null; gridState(); gridToSpells(); }
      } catch (eSg) {}
      page.innerHTML = "<div class='crumb'>" + E(opp.home) + " v " + E(opp.away) + " &raquo; Orders</div>" + cond +
        "<div class='panel fo-keep'><h4>The Gaffer's plan</h4><div class='pad'>" +
        "<div class='fo-j-gbox' style='max-width:none;margin:2px 0 10px'><img class='gf' src='" + FO_ART + "gaffer.png' alt=''>" +
        "<span class='bx'><span class='sp'>The Gaffer</span><span class='tx'>&ldquo;I've set the whole sheet for these conditions - eleven picked, order sorted, overs planned. Play it as it is, or open it up and make it yours. You can't break anything; I'll always have a fresh plan.&rdquo;</span></span></div>" +
        foOrdPlanSummary() +
        "<div class='fo-ord-acts' style='margin-top:12px'>" +
        "<button class='primary fo-ord-save'>" + (App.pending ? "Play with this plan &#9654;" : "Save this plan") + "</button>" +
        "<button data-fo-act='reroll'>Fresh suggestion</button>" +
        "<button data-fo-act='fine'>Fine-tune it myself</button>" +
        "<span class='small'>" + (SYNC && SYNC.started && !SYNC.practice && App.pending && !App.pending.__friendly
          ? "League lineups lock an hour before the 9:00 AM ET start."
          : (App.pending ? "The match starts the moment you play." : "Orders apply to your next fixture.")) + "</span></div>" +
        "</div></div>";
      foOrdWire(page);
      return;
    }
    page.innerHTML = "<div class='crumb'>" + E(opp.home) + " v " + E(opp.away) + " &raquo; Orders</div>" + cond +
      "<div class='fo-ord-cols'>" +
      "<div class='panel fo-keep'><h4>Batting order</h4><div class='pad'>" +
      "<div class='small' style='margin-bottom:6px'>Arrows move a batter · tap <b>C</b> for captain, <b>WK</b> for the gloves.</div>" +
      "<div id='fo-bat-rows'>" + foOrdBatRows() + "</div>" + tac + "</div></div>" +
      "<div class='panel fo-keep'><h4>Bowling plan</h4><div class='pad'>" +
      "<div class='fo-og-hint'>Pick a bowler &middot; tap overs to paint his spells &middot; tap again to clear. Ten overs each, never two in a row.</div>" +
      "<div id='fo-bowl-body'>" + foOrdBowlBody() + "</div></div></div></div>" +
      "<div class='fo-ord-acts'>" +
      "<button class='primary fo-ord-save'>Save orders" + (App.pending ? "" : "") + "</button>" +
      "<button data-fo-act='suggest'>Suggest lineup</button>" +
      (prev ? "<button data-fo-act='prev'>Copy previous match</button>" : "") +
      "<button data-fo-act='clear'>Clear</button>" +
      "<button data-fo-act='simplemode'>Gaffer's plan</button>" +
      "<span class='small'>" + (SYNC && SYNC.started && !SYNC.practice && App.pending && !App.pending.__friendly
        ? "League lineups lock an hour before the 9:00 AM ET start."
        : (App.pending ? "The match starts the moment you save." : "Orders apply to your next fixture.")) + "</span></div>";
    foOrdWire(page);
  }
  function foOrdWire(page) {
    if (page.__foOrdWired) return;
    {
      page.__foOrdWired = 1;
      page.addEventListener("click", function (ev) {
        try {
          if (!/^#\/orders/.test(location.hash || "")) return;
          var q = function (sel3) { return ev.target.closest ? ev.target.closest(sel3) : null; };
          var el;
          if ((el = q("[data-fo-up]"))) { var i1 = +el.getAttribute("data-fo-up"); var a1 = App.orders.batOrder; var tmp1 = a1[i1 - 1]; a1[i1 - 1] = a1[i1]; a1[i1] = tmp1; foOrdRepaint("bat"); return; }
          if ((el = q("[data-fo-dn]"))) { var i2 = +el.getAttribute("data-fo-dn"); var a2 = App.orders.batOrder; var tmp2 = a2[i2 + 1]; a2[i2 + 1] = a2[i2]; a2[i2] = tmp2; foOrdRepaint("bat"); return; }
          if ((el = q("[data-fo-swap]"))) { foOrdBenchSheet(el.getAttribute("data-fo-swap")); return; }
          if ((el = q("[data-fo-capt]"))) { App.orders.captain = el.getAttribute("data-fo-capt"); foOrdRepaint("bat"); return; }
          if ((el = q("[data-fo-wk]"))) { App.orders.keeper = el.getAttribute("data-fo-wk"); foOrdRepaint("bat"); return; }
          if ((el = q("[data-fo-clearall]"))) {
            gridState();
            for (var o6 = 1; o6 <= 50; o6++) App.orders.grid[o6] = null;
            gridToSpells();
            foOrdRepaint("bowl");
            return;
          }
          if ((el = q("[data-fo-brush]"))) { window.__foOrdBrush = el.getAttribute("data-fo-brush") || ""; foOrdRepaint("bowl"); return; }
          if ((el = q("[data-fo-cell]"))) {
            gridState();
            var o5 = +el.getAttribute("data-fo-cell");
            var br5 = window.__foOrdBrush || "";
            App.orders.grid[o5] = (!br5 || App.orders.grid[o5] === br5) ? null : br5;
            if (br5 && App.orders.gridBowlers.indexOf(br5) < 0) App.orders.gridBowlers.push(br5);
            gridToSpells();
            foOrdRepaint("bowl");
            return;
          }
          if ((el = q(".fo-ord-save"))) {
            // a first-timer can reach Save with zero overs painted - the AI
            // quietly improvises, which is a lesson nobody gets to learn.
            // Say it once and offer the one-tap fix.
            try {
              gridState();
              var painted = 0; for (var oC = 1; oC <= 50; oC++) if (App.orders.grid && App.orders.grid[oC]) painted++;
              var sp0 = App.orders.spells || {};
              var anyPlan = painted > 0 || ((sp0.north || []).some(function (s9) { return s9 && s9.bowler; })) || ((sp0.south || []).some(function (s9) { return s9 && s9.bowler; }));
              if (!anyPlan && App.pending && !el.__foNudged) {
                el.__foNudged = 1;
                foConfirm({ title: "No bowling plan", body: "You haven't painted any overs, so your AI captain will improvise the bowling. Want a suggested plan first? You can still repaint it before saving.",
                  confirm: "Suggest a plan", cancel: "Play as is" })
                  .then(function (ok) {
                    if (ok) { try { suggestOrders(); App.orders.grid = null; App.orders.gridBowlers = null; gridState(); gridToSpells(); } catch (eS9) {} foOrdersUI(); toast("Plan suggested - look it over, then Save."); }
                    else { var b9 = document.querySelector(".fo-ord-save"); if (b9) { b9.__foNudged = 1; b9.click(); } }
                  });
                return;
              }
            } catch (eNg) {}
            // today's league round locks at 8:00 AM ET while the engine warms up
            try {
              if (SYNC && SYNC.started && !SYNC.practice && LG && !App.pending && !SYNC.planRound) {
                var hET = foETHour(new Date());
                if (hET != null && hET >= 8 && hET < 10) {
                  say("Lineups for today's round locked at 8:00 AM ET \u00b7 the round plays at 9:00 and everything unlocks at stumps. You can still plan future rounds from the Matches page.");
                  return;
                }
              }
            } catch (eLk) {}
            App.orders.saved = true;
            App.defaults = JSON.parse(JSON.stringify(App.orders));
            if (App.pending) { location.hash = "#/match"; if (typeof window.route === "function") window.route(); }
            else { toast("Orders saved."); }
            return;
          }
          if ((el = q("[data-fo-act]"))) {
            var act = el.getAttribute("data-fo-act");
            if (act === "suggest" || act === "reroll") { try { suggestOrders(); App.orders.grid = null; App.orders.gridBowlers = null; gridState(); gridToSpells(); } catch (eS) {} foOrdersUI(); if (act === "reroll") toast("Fresh plan set - same conditions, new thinking."); }
            else if (act === "prev") { try { var pv = foPreviousOrders(); if (pv) foApplyPrevOrders(pv); } catch (eP) {} foOrdersUI(); }
            else if (act === "clear") { App.orders.batOrder = []; App.orders.spells = { north: [], south: [] }; App.orders.grid = null; App.orders.gridBowlers = null; App.orders.captain = null; foOrdersUI(); }
            else if (act === "fine") { try { lsSet("fo_ord_mode", "full"); } catch (eM1) {} foOrdersUI(); }
            else if (act === "simplemode") { try { lsSet("fo_ord_mode", "simple"); } catch (eM2) {} foOrdersUI(); }
            return;
          }
        } catch (e) {}
      });
      page.addEventListener("change", function (ev) {
        try {
          if (!/^#\/orders/.test(location.hash || "")) return;
          var sl = ev.target && ev.target.getAttribute ? ev.target.getAttribute("data-fo-sel") : null;
          if (!sl) return;
          var pr = sl.split(":"), v = ev.target.value;
          if (pr[0] === "pi") App.orders.phaseIntent[pr[1]] = +v;
          else if (pr[0] === "fp") App.orders.fieldPlan[pr[1]] = v;
          else if (sl === "toss:call") App.orders.tossCall = v;
          else if (sl === "toss:dec") App.orders.tossDecision = v;
        } catch (e) {}
      });
    }
  }
  try {
    var foOrdCss = document.createElement("style");
    foOrdCss.textContent =
      ".fo-ord-cond{background:#F0F4F8;border:1px solid rgba(31,78,107,.16);border-radius:10px;padding:9px 13px;font-size:12.5px;color:#243244;margin:6px 0 10px}" +
      ".fo-ord-read{background:#FBF7EC;border:1px solid rgba(201,162,75,.35);border-left:4px solid #C9A24B;border-radius:10px;padding:9px 13px;color:#4a4234;margin:0 0 10px;line-height:1.5}" +
      ".fo-ord-plan{display:flex;flex-direction:column;gap:7px}" +
      ".fo-ord-plan>div{background:#FFFEFC;border:1px solid rgba(28,36,51,.1);border-radius:9px;padding:8px 12px;font-size:13px;color:#243244;line-height:1.5}" +
      ".fo-ord-plan b{color:#0E233F;text-transform:uppercase;font-size:10.5px;letter-spacing:.06em;margin-right:2px}" +
      ".fo-ord-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:14px;align-items:start}" +
      "@media(max-width:860px){.fo-ord-cols{grid-template-columns:1fr}}" +
      ".fo-ob-row{display:flex;align-items:center;gap:8px;padding:6px 8px;background:#FFFEFC;border:1px solid rgba(28,36,51,.08);border-radius:9px;margin:4px 0}" +
      ".fo-ob-n{flex:0 0 22px;height:22px;display:inline-flex;align-items:center;justify-content:center;background:#EEF2F7;color:#41577a;border-radius:50%;font-size:11px;font-weight:800}" +
      ".fo-ob-n.top{background:#F6E9CE;color:#8a5c13}" +
      ".fo-ob-who b s{text-decoration:none;color:#B04A2C;font-weight:800}" +
      ".fo-ob-who{flex:1;min-width:0}.fo-ob-who>b{display:block;font-size:13px;color:#0E233F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fo-ob-who .small{font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}" +
      "html body.ftpskin #page button.fo-ob-chip,html body #page button.fo-ob-chip{flex:0 0 auto;border:1px solid rgba(28,36,51,.2) !important;background:#FFFEFC !important;color:#8a93a3 !important;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:800;cursor:pointer}" +
      "html body.ftpskin #page button.fo-ob-chip.on,html body #page button.fo-ob-chip.on{background:#0E233F !important;color:#FFFEFC !important;border-color:#0E233F !important}" +
      ".fo-ob-mv{display:flex;gap:3px}" +
      "html body.ftpskin #page .fo-ob-mv button,html body #page .fo-ob-mv button{border:1px solid rgba(28,36,51,.14) !important;background:#FBFAF7 !important;color:#5a6472 !important;border-radius:6px;font-size:9px;line-height:1;padding:6px 8px;cursor:pointer}" +
      "html body #page .fo-ob-mv button:disabled{opacity:.25;cursor:default}" +
      "html body.ftpskin #page button.fo-ob-swap,html body #page button.fo-ob-swap{color:#B04A2C !important;font-size:11px !important}" +
      ".fo-os-ph{display:flex;gap:10px;align-items:center;margin:7px 0;padding:8px 10px;background:#FBFAF7;border:1px solid rgba(28,36,51,.08);border-radius:10px}" +
      ".fo-os-phl{flex:0 0 86px}.fo-os-phl b{display:block;font-size:12.5px;color:#0E233F}.fo-os-phl span{font-size:10.5px;color:#8a93a3}" +
      ".fo-os-slots{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
      "html body.ftpskin #page button.fo-os-slot,html body #page button.fo-os-slot{display:block;text-align:left;border:1px solid rgba(28,36,51,.14) !important;background:#FFFEFC !important;border-radius:9px;padding:6px 10px;cursor:pointer;min-width:0}" +
      ".fo-os-slot i{display:block;font-style:normal;font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:#b6bcc7;font-weight:800}" +
      ".fo-os-slot b{display:block;font-size:13px;color:#0E233F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".fo-os-slot b em{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px}" +
      ".fo-os-slot span{display:block;font-size:10.5px;color:#8a93a3}" +
      ".fo-os-ai{color:#8a93a3;font-weight:600}" +
      ".fo-os-tl{display:flex;align-items:center;margin:10px 0 6px}" +
      ".fo-os-tl i{flex:1;height:12px;margin-right:1px;border-radius:2px}" +
      ".fo-os-tl u{flex:0 0 5px}" +
      ".fo-os-tot{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:11px}" +
      ".fo-os-tchip{display:inline-flex;align-items:center;gap:5px;font-weight:700;color:#3a4353}.fo-os-tchip i{width:9px;height:9px;border-radius:2px;display:inline-block}" +
      ".fo-os-tchip.bad{color:#b3402a}" +
      ".fo-os-cov{margin-left:auto;color:#8a93a3}" +
      ".fo-os-warn{margin-top:7px;background:#F6E3B4;border:1px solid #e8cf8c;border-radius:8px;padding:6px 10px;font-size:11.5px;color:#5a4310;font-weight:600}" +
      ".fo-ord-tac{margin-top:12px;border-top:1px dashed rgba(28,36,51,.14);padding-top:8px}" +
      ".fo-ord-tach{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:#41577a;font-weight:800;margin:9px 0 4px}" +
      ".fo-ord-tr3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:2px}" +
      ".fo-ord-cell{display:flex;flex-direction:column;gap:3px;min-width:0}" +
      ".fo-ord-cell span{font-size:10.5px;color:#5a6472;font-weight:700}" +
      ".fo-ord-cell select{width:100%;font-size:12px;padding:4px 6px;border-radius:8px;box-sizing:border-box}" +
      ".fo-ord-acts{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}" +
      "@media(max-width:760px){.fo-ord-acts{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fo-ord-acts button{width:100%;min-height:44px;box-sizing:border-box;margin:0 !important}.fo-ord-acts .small{grid-column:1/-1;text-align:center}}" +
      "#fo-osheet{position:fixed;inset:0;background:rgba(10,18,32,.45);z-index:2600;display:flex;align-items:flex-end;justify-content:center}" +
      "@media(min-width:700px){#fo-osheet{align-items:center}}" +
      ".fo-osh-card{background:#FFFEFC;border-radius:16px 16px 0 0;max-width:520px;width:100%;max-height:72vh;overflow-y:auto;padding:12px 14px 16px;box-shadow:0 -8px 40px rgba(7,22,46,.3)}" +
      "@media(min-width:700px){.fo-osh-card{border-radius:16px}}" +
      ".fo-osh-h{display:flex;align-items:baseline;gap:10px;margin-bottom:8px}.fo-osh-h b{font-size:14px;color:#0E233F}" +
      "html body .fo-osh-h button{margin-left:auto;border:none;background:#E8EAEE;border-radius:8px;padding:4px 9px;cursor:pointer;color:#5a6472}" +
      "html body button.fo-osh-row{display:flex;width:100%;align-items:center;gap:10px;text-align:left;background:#FFFEFC;border:1px solid rgba(28,36,51,.1);border-radius:10px;padding:8px 11px;margin:5px 0;cursor:pointer}" +
      "html body button.fo-osh-row:disabled{opacity:.45;cursor:default}" +
      ".fo-osh-row b{font-size:13px;color:#0E233F}.fo-osh-row .small{display:block}" +
      ".fo-osh-note{margin-left:auto;font-size:10.5px;color:#8a93a3;text-align:right}.fo-osh-note.bad{color:#b3402a}" +
      ".fo-osh-pt{display:inline-block;background:#EEE8FA;color:#5b4a91;border-radius:6px;padding:0 6px;font-size:9.5px;font-weight:700;margin-left:5px}" +
      ".fo-osh-ai b{color:#5a6472}" +
      "html body.ftpskin #page button.fo-og-tgl,html body #page button.fo-og-tgl{border:none !important;background:none !important;color:#B04A2C !important;font-weight:800;font-size:12px;cursor:pointer;padding:0}" +
      ".fo-og-pal{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:6px;margin-bottom:4px}" +
      ".fo-og-note{font-size:10.5px;color:#8a93a3;margin:0 0 9px}" +
      ".fo-og-hint{font-size:12.5px;color:#3a4353;margin-bottom:9px}" +
      "html body.ftpskin #page button.fo-og-b,html body #page button.fo-og-b{display:flex;width:100%;align-items:center;justify-content:flex-start;gap:7px;border:1px solid rgba(28,36,51,.16) !important;background:#FFFEFC !important;color:#0E233F !important;border-radius:11px;padding:6px 10px;font-size:12.5px;font-weight:700;cursor:pointer;min-width:0;white-space:nowrap;overflow:hidden}" +
      ".fo-og-bt{flex:1;min-width:0;text-align:left}" +
      ".fo-og-bt b{display:block;font-size:12.5px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".fo-og-bt i{display:block;font-style:normal;font-size:10px;font-weight:600;color:#8a93a3;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".fo-og-b.on .fo-og-bt i{color:#c7cfda}" +
      ".fo-og-bt n{font-weight:800}" +
      "html body.ftpskin #page button.fo-og-clear,html body #page button.fo-og-clear{border-style:dashed !important;color:#8a3a28 !important;justify-content:center}" +
      "html body.ftpskin #page button.fo-og-b.on,html body #page button.fo-og-b.on{background:#0E233F !important;color:#FFFEFC !important;border-color:#0E233F !important}" +
      ".fo-og-b em{width:9px;height:9px;border-radius:2px;display:inline-block}" +
      ".fo-og-b u{text-decoration:none;color:#8a93a3;font-weight:600}.fo-og-b.on u{color:#c7cfda}" +
      ".fo-og-row{display:flex;gap:4px;align-items:center;margin:4px 0}" +
      ".fo-og-l{flex:0 0 56px;width:56px;max-width:56px;overflow:hidden;font-size:10px;color:#a7aeba;font-weight:700;text-align:right;padding-right:3px;line-height:1.25}" +
      "html body.ftpskin #page button.fo-og-c,html body #page button.fo-og-c{flex:1;min-width:0;height:36px;border:1px solid rgba(28,36,51,.14);background:#FBFAF7;color:#8a93a3;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;padding:0}" +
      ".fo-og-b s{text-decoration:none;background:#EEE8FA;color:#5b4a91;border-radius:5px;padding:0 4px;font-size:9px;font-weight:700}" +
      "html body.ftpskin #page button.fo-og-more,html body #page button.fo-og-more{border-style:dashed !important;color:#8a93a3 !important}" +
      ".fo-og-l i{display:block;font-style:normal;font-size:7.5px;color:#c0b9a8;text-transform:uppercase;letter-spacing:.03em;font-weight:800;white-space:nowrap}" +
      // phone: over cells are true squares - width drives height
      "@media(max-width:760px){" +
        "html body.ftpskin #page button.fo-og-c,html body #page button.fo-og-c{height:auto;min-height:0;padding:0;aspect-ratio:1/1;border-radius:6px;font-size:11px;line-height:1}" +
        ".fo-og-row{gap:3px}" +
      "}";
    document.head.appendChild(foOrdCss);
  } catch (e) {}
  try {
    if (typeof window.pgOrders === "function" && !window.pgOrders.__foNew) {
      var _foPgOrdOld = window.pgOrders;
      window.pgOrders = function () {
        try { foOrdersUI(); return; } catch (e) { console.warn("foOrdersUI", e); }
        return _foPgOrdOld.apply(this, arguments);
      };
      window.pgOrders.__foNew = 1;
    }
  } catch (e) {}

  // The engine repaints the whole Orders page on every control change (each
  // over-cell click in the bowling grid). Keep the manager's scroll position
  // when the page is merely re-rendering, so it stops jumping to the top.
  try {
    if (typeof window.pgOrders === "function" && !window.pgOrders.__foScroll) {
      var _foPgOrd = window.pgOrders;
      window.pgOrders = function () {
        var pgEl = document.getElementById("page");
        var wasOrders = !!(pgEl && /Batting order/.test(pgEl.textContent || ""));
        var y = window.scrollY || document.documentElement.scrollTop || 0;
        var out = _foPgOrd.apply(this, arguments);
        if (wasOrders) { try { window.scrollTo(0, y); } catch (e) {} }
        return out;
      };
      window.pgOrders.__foScroll = 1;
    }
  } catch (e) {}
  function foRefreshLineupButtons() {
    try {
      if (!(SYNC && SYNC.submitted)) return;
      document.querySelectorAll("button.fo-setr[data-r]").forEach(function (b) {
        var done = !!SYNC.submitted[+b.getAttribute("data-r")];
        b.classList.toggle("fo-setr-done", done);
        var want = done ? "\u2713 Orders ready" : (b.classList.contains("fo-setr-later") ? "Plan lineup" : "Set lineup");
        if (b.textContent !== want) b.textContent = want;
        b.title = done ? "Click to edit this round's lineup" : "";
      });
      // the club-home hero CTA answers to the same truth
      document.querySelectorAll("button.fo-next-cta[data-r]").forEach(function (b) {
        var r = +b.getAttribute("data-r");
        var done = !!SYNC.submitted[r] ||
          !!(App.orders && App.orders.saved && App.season && r === App.season.round);
        b.classList.toggle("fo-done", done);
        var want = done ? "Review lineup \u203a" : "Set lineup \u203a";
        if (b.textContent !== want) b.textContent = want;
      });
    } catch (e) {}
  }
  // any bare mention of a club or player becomes a link to their page.
  // Leaf elements only, exact-name match, with vs/at/@ prefixes tolerated.
  function foLinkifyNames() {
    try {
      var page = document.getElementById("page"); if (!page) return;
      var teams = {}, players = {};
      (GD.teams || []).forEach(function (t2, i2) {
        teams[t2.name] = i2;
        (t2.players || []).forEach(function (p2) { players[p2.name] = 1; });
      });
      page.querySelectorAll("td,b,span,em,h1,h2,h3,div").forEach(function (el) {
        if (el.__foLk || el.children.length) return;
        if (el.closest("a,button,select,label,.fo-search,#fo-onb,#fo-bell-panel,.fo-exp-card")) return;
        var txt = (el.textContent || "").trim();
        if (!txt || txt.length > 46) return;
        var m = txt.match(/^(?:vs |at |@ |from )?(.+?)(?:\s*\u2020)?$/);
        var core = m ? m[1] : txt;
        var kind = teams[core] !== undefined ? "t" : (players[core] ? "p" : null);
        if (!kind) return;
        el.__foLk = 1;
        el.classList.add("fo-lk");
        el.addEventListener("click", function (ev) {
          ev.stopPropagation();
          if (kind === "t") location.hash = "#/scout?t=" + teams[core];
          else location.hash = "#/player?n=" + encodeURIComponent(core);
          if (typeof window.route === "function") window.route();
        });
      });
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(foLinkifyNames, 350); setTimeout(foLinkifyNames, 1100); });
  // the live viewer's first seconds: show the welcome line the instant the
  // page opens instead of a blank feed while the slow ticker warms up
  function foMatchIntroTick() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/match") return;
      if (typeof M === "undefined" || !M || M.done) return;
      var feed = document.querySelector("#page .commfeed") || document.querySelector("#page #ftpcomm");
      if (!feed || (feed.textContent || "").trim().length > 25) return;
      var line = null;
      (M.log || []).forEach(function (L) { if (L && L.intro && L.txt) line = L.txt; });
      if (!line) {
        var meta = (M.meta || App.pending || {});
        var home = meta.home || (M.user && M.user.name) || "", away = meta.away || (M.ai && M.ai.name) || "";
        line = "Welcome to " + (meta.ground || "the ground") + ": " + home + " v " + away + ", " + (meta.weather || "clear") + " conditions and a " + foPitchName(M.pitch || meta.pitch || "balanced") + " pitch." + (M.tossWinner ? " " + M.tossWinner + " won the toss." : "") + " The players are ready - let battle commence.";
      }
      var d = document.createElement("div"); d.className = "fo-intro-now"; d.textContent = line;
      feed.insertBefore(d, feed.firstChild);
    } catch (e) {}
  }
  setInterval(foMatchIntroTick, 600);
  // ---- ESPN-style pre-match preview: spoiler-safe, built from settled
  // rounds only (the round on air is excluded from every number here) ----
  function foMatchPreviewHTML(r, hideRd, facts) {
    var sn = App.seasonNo || 1;
    // settled-rounds table: points, wins, losses, position
    var pts = {}, w = {}, l = {}, pl = {};
    var rounds = foLeagueRounds();
    Object.keys(rounds).forEach(function (rd) {
      if (hideRd != null && +rd === hideRd) return;
      (rounds[rd] || []).forEach(function (r0) {
        if (!r0 || !r0.result) return;
        [r0.home, r0.away].forEach(function (nm) { pl[nm] = (pl[nm] || 0) + 1; });
        var wn = r0.result.winner;
        if (!wn) { pts[r0.home] = (pts[r0.home] || 0) + 1; pts[r0.away] = (pts[r0.away] || 0) + 1; }
        else { pts[wn] = (pts[wn] || 0) + 2; w[wn] = (w[wn] || 0) + 1; var ls = wn === r0.home ? r0.away : r0.home; l[ls] = (l[ls] || 0) + 1; }
      });
    });
    var order = (GD.teams || []).map(function (t) { return t.name; }).sort(function (a, b) { return (pts[b] || 0) - (pts[a] || 0) || (w[b] || 0) - (w[a] || 0); });
    var fm = foFormMap();
    var side = function (nm) {
      var t = null; (GD.teams || []).some(function (t0) { if (t0.name === nm) { t = t0; return true; } return false; });
      var pos = order.indexOf(nm) + 1;
      var pips = (fm[nm] || []).map(function (x) { return "<i class='fo-pip fo-" + x + "'></i>"; }).join("") || "<span class='small'>no matches yet</span>";
      // leaders from settled league innings only
      var bat = null, bowl = null;
      ((t && t.players) || []).forEach(function (p2) {
        var runs = 0, wk = 0;
        (((App.playerHist || {})[p2.name]) || []).forEach(function (e2) {
          if (e2.fr || e2.s !== sn) return;
          if (hideRd != null && (e2.r || 0) === hideRd + 1) return;
          runs += +e2.rr || 0; wk += +e2.w || 0;
        });
        if (runs > 0 && (!bat || runs > bat.v)) bat = { n: p2.name, v: runs };
        if (wk > 0 && (!bowl || wk > bowl.v)) bowl = { n: p2.name, v: wk };
      });
      return { bat: bat, bowl: bowl, html: "<div class='fo-pv-team'><b>" + E(nm) + "</b>" +
        "<div class='fo-pv-pos'>" + (pos > 0 && pl[nm] ? foOrdinal(pos) + " &middot; " + (pts[nm] || 0) + " pts &middot; " + (w[nm] || 0) + "&ndash;" + (l[nm] || 0) : "First match of the season") + "</div>" +
        "<div class='fo-pv-k'>Form</div><div class='fo-form'>" + pips + "</div>" +
        (bat ? "<div class='fo-pv-k'>Leading run-scorer</div><div class='fo-pv-p'>" + E(bat.n) + " <span>" + bat.v + " runs</span></div>" : "") +
        (bowl ? "<div class='fo-pv-k'>Leading wicket-taker</div><div class='fo-pv-p'>" + E(bowl.n) + " <span>" + bowl.v + " wkts</span></div>" : "") +
        "</div>" };
    };
    // head to head: settled meetings this season
    var meets = [];
    Object.keys(rounds).forEach(function (rd) {
      if (hideRd != null && +rd === hideRd) return;
      (rounds[rd] || []).forEach(function (r0) {
        if (!r0 || !r0.result) return;
        var pair = [r0.home, r0.away];
        if (pair.indexOf(r.home) >= 0 && pair.indexOf(r.away) >= 0) meets.push(r0);
      });
    });
    var h2hRows = meets.map(function (m2) { return "<div class='fo-pv-h2h'>" + E(m2.result.text) + " <span>R" + ((+m2.round || 0) + 1) + "</span></div>"; });
    // friendlies belong in the rivalry too
    try {
      (window.__foFrAll || []).forEach(function (cF) {
        if (!cF || cF.status !== "played" || !cF.result || !cF.result.result_text) return;
        var pairF = [cF.challenger_club, cF.opponent_club];
        if (!(pairF.indexOf(r.home) >= 0 && pairF.indexOf(r.away) >= 0)) return;
        if (typeof foFrBcastState === "function" && foFrBcastState(cF).phase !== "done") return;
        h2hRows.push("<div class='fo-pv-h2h'>" + E(cF.result.result_text) + " <span>FR</span></div>");
      });
    } catch (eFp) {}
    var h2h = h2hRows.length ? h2hRows.slice(-5).join("") : "<div class='small'>First meeting of the season.</div>";
    var hs = side(r.home), as2 = side(r.away);
    // the contests inside the contest: each side's big gun against the
    // other's most dangerous bowler
    var battles = [];
    if (hs.bat && as2.bowl) battles.push("<div class='fo-pv-h2h'><b>" + E(hs.bat.n) + "</b> (" + hs.bat.v + " runs) faces <b>" + E(as2.bowl.n) + "</b> (" + as2.bowl.v + " wkts)</div>");
    if (as2.bat && hs.bowl) battles.push("<div class='fo-pv-h2h'><b>" + E(as2.bat.n) + "</b> (" + as2.bat.v + " runs) faces <b>" + E(hs.bowl.n) + "</b> (" + hs.bowl.v + " wkts)</div>");
    var battleCard = battles.length ? "<div class='panel fo-keep'><h4>Key battles</h4><div class='pad'>" + battles.join("") + "</div></div>" : "";
    // what these conditions actually mean, in one breath
    var pr9 = FO_PITCH_READ[r.pitch], wr9 = FO_WX_READ[String(r.weather || "").trim().toLowerCase()];
    var condCard = (pr9 || wr9)
      ? "<div class='panel fo-keep'><h4>Reading the conditions</h4><div class='pad' style='font-size:13px;line-height:1.6;color:#3a4353'>" +
        [pr9, wr9 ? wr9.charAt(0).toUpperCase() + wr9.slice(1) + "." : null].filter(Boolean).join(" ") + "</div></div>"
      : "";
    return "<div class='fo-pv'>" +
      "<div class='panel fo-keep'><h4>Match preview</h4><div class='pad'><div class='fo-pv-grid'>" + hs.html + as2.html + "</div></div></div>" +
      "<div class='fo-pv-cols'><div class='panel fo-keep'><h4>Head to head</h4><div class='pad'>" + h2h + "</div></div>" +
      "<div class='panel fo-keep'><h4>Match facts</h4><div class='pad'>" +
      "<div class='fo-pv-fact'><span>Ground</span><b>" + E(r.ground || "&ndash;") + "</b></div>" +
      (r.pitch ? "<div class='fo-pv-fact'><span>Pitch</span><b>" + foPitchName(r.pitch) + "</b></div>" : "") +
      (r.weather ? "<div class='fo-pv-fact'><span>Weather</span><b>" + E(r.weather) + "</b></div>" : "") +
      "<div class='fo-pv-fact'><span>First ball</span><b>" + ((facts && facts.firstBall) || "9:00 AM ET") + "</b></div>" +
      "<div class='fo-pv-fact'><span>Lineups</span><b>" + ((facts && facts.lock) || "Locked at 8:00 AM ET") + "</b></div>" +
      ((facts && facts.extraFacts) || "") +
      "<div class='small' style='margin-top:8px'>Scores tick in ball by ball from " + ((facts && facts.firstBall) || "9:00") + "; the full card, charts and ratings arrive at stumps.</div>" +
      "</div></div>" + battleCard + condCard + "</div></div>";
  }
  // one-line cricket reads for every pitch and sky the league can serve up
  var FO_PITCH_READ = {
    balanced: "A fair surface: runs for batters who apply themselves, help for bowlers who hit their lengths.",
    flat: "A road. Par is high, bowlers need patience and changes of pace, and totals under 250 rarely survive.",
    green: "Grass on it: the new ball will move around, and the first ten overs could decide the whole match.",
    dry: "Dry and crumbling: spin grips harder as the innings wears on - runs on the board look twice as big.",
    slow: "The ball sits in this surface. Timing is hard, cutters and spinners hold it up, big totals are rare.",
    cracked: "A sticky, cracked top: uneven bounce rewards bowlers who attack the stumps and punishes lazy feet.",
    twoPaced: "Two-paced: some balls skid, some stop. Set batters cash in; fresh ones get strangled."
  };
  var FO_WX_READ = {
    sunny: "Fine batting weather - the ball goes soft and the outfield is quick",
    overcast: "cloud cover keeps the ball swinging all day - a gift for the seamers",
    humid: "heavy, humid air: swing early on, and every player's fatigue clock runs faster",
    hot: "energy-sapping heat - deep batting and short, sharp spells pay off",
    scorching: "brutal heat: fatigue is the hidden opponent, and a sixth bowling option is gold",
    drizzle: "drizzle about - just enough nibble to keep the seamers interested",
    windy: "gusty: hard work for flighted spin, and high catches become adventures",
    chilly: "cold hands and zip for the quicks early - watch the first spell",
    misty: "murky and slow to clear - the new ball will talk",
    "dew later": "dew arrives later: the ball gets slippery and chasing gets easier under it"
  };
  // stats-page tables list bare player names: stamp each with his club
  function foStatsClubTags() {
    try {
      if (!/^#\/stats/.test(location.hash || "")) return;
      var page = document.getElementById("page"); if (!page) return;
      var clubOf = {};
      (GD.teams || []).forEach(function (t) { (t.players || []).forEach(function (p2) { clubOf[p2.name] = t.name; }); });
      page.querySelectorAll("table td:first-child").forEach(function (td) {
        if (td.__foClubTag) return;
        var nm = (td.textContent || "").trim();
        if (!clubOf[nm]) return;
        td.__foClubTag = 1;
        var sp = document.createElement("span");
        sp.className = "fo-tclub";
        sp.textContent = clubOf[nm];
        td.appendChild(sp);
      });
    } catch (e) {}
  }
  function foRoundBands() {
    try {
      if (App.page !== "matches") return;
      document.querySelectorAll("#page tr>td:first-child").forEach(function (td) {
        if (/Round \d+ /.test(td.textContent || "") && td.colSpan > 1 && !td.parentNode.classList.contains("fo-rnd-head")) td.parentNode.classList.add("fo-rnd-head");
      });
    } catch (e) {}
  }
  function foPolishSquad() {
    try {
      var page = document.getElementById("page"); if (!page) return;
      // colour every engine skill bar by its value (green-only bars read as noise)
      page.querySelectorAll(".bar>i").forEach(function (i) {
        var v = parseFloat(i.style.width) || 0;
        i.style.background = v >= 75 ? "#16A34A" : v >= 50 ? "#4DA6A2" : v >= 30 ? "#F59E0B" : "#DC2626";
      });
      // the grid's Capt header is hard-coded unsortable · wire it up
      page.querySelectorAll("th").forEach(function (th) {
        if (th.textContent.replace(/[^A-Za-z]/g, "") !== "Capt" || th.__foWired) return;
        th.__foWired = 1; th.style.cursor = "pointer"; th.title = "Captaincy - click to sort";
        th.addEventListener("click", function () { try { window.gridSort("Capt"); } catch (e) {} });
      });
    } catch (e) {}
  }

  function foRenderTraining() {
    if (!/^#\/training/.test(location.hash || "")) return;
    try { bumpBrand(); } catch (e) {}
    try { foTrainingPage(); } catch (e) { console.warn("foTrainingPage", e); }
    try {
      var tb = document.getElementById("topbar");
      tb && tb.querySelectorAll("a").forEach(function (a) { a.classList.toggle("on", a.classList.contains("fo-training")); });
    } catch (e) {}
  }

  // Lift the boot veil (injected by build.sh) now that the brand CSS and the right
  // screen are in place · the engine's original UI never gets a frame to flash.
  try { var _bv = document.getElementById("fo-boot"); if (_bv) _bv.parentNode.removeChild(_bv); } catch (e) {}

  // Debug/test handle for the season planner's engine-facing helpers (no behaviour).
  try { window.__fol = { userFixtures: foUserFixtures, fixtureMeta: foFixtureMeta, plannerHTML: foPlannerHTML, smartBowling: foSmartBowling, countryPool: buildCountryPool, marketPool: foMarketPool, draftPrice: foDraftPrice }; } catch (e) {}

