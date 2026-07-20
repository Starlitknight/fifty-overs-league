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
  // the plan screen IS the orders editor now (drag the order, tap the
  // overs) - everyone lands here; the legacy full editor stays reachable
  // only for anyone with a stored 'full' preference
  function foOrdMode() {
    return lsGet("fo_ord_mode") === "full" ? "full" : "simple";
  }
  // Stars are RELATIVE to this club's own squad (quintiles): a new manager
  // can't read a 0-100 skill number, but five gold stars on his best player
  // and one on his weakest needs no manual.
  // The score behind them is a COMPOSITE: the discipline aggregate is the
  // main ingredient (60%), technique and power season it (20% each) - so a
  // low-technique big hitter and a low-power technician rate the same.
  function foOrdBatComp(p) {
    var sk = p.skills || {};
    return 0.6 * (aggBat(p) || 0) + 0.2 * (((sk.vsPace || 0) + (sk.vsSpin || 0)) / 2) + 0.2 * (sk.power || 0);
  }
  function foOrdBowlComp(p) {
    var sk = p.skills || {};
    return 0.6 * (aggBowl(p) || 0) + 0.2 * (sk.wicket || 0) + 0.2 * (sk.economy || 0);
  }
  // the batting order shows BATTING stars for everyone (a tail-ender must
  // never out-star the opener); bowling stars live on the bowler cards
  // ABSOLUTE calibration, out of ten: composite 15 or below (dreadful in
  // everything) is 0 stars, 92+ (legendary in all three ingredients) is 10,
  // linear between. The same ladder for every player in the world - a
  // starting club reads ~4-5 stars with the whole climb ahead of it.
  function foOrdStars(comp) {
    return Math.max(0, Math.min(10, Math.round(((comp - 15) / 77 * 10) * 2) / 2));
  }
  function foOrdStarHTML(n) {
    var full = Math.floor(n), half = (n - full) >= 0.5;
    var s = "";
    for (var i = 1; i <= 10; i++) s += "<em class='" + (i <= full ? "f" : (half && i === full + 1 ? "h" : "")) + "'>&#9733;</em>";
    return "<s class='st' title='" + n + " / 10'>" + s + "</s>";
  }
  // one plain-language line on WHY this player is in the sheet
  function foOrdWhy(p, boIx) {
    try {
      var bits = [];
      if (App.orders.captain === p.name) bits.push("The captain - coolest head at the club.");
      if (App.orders.keeper === p.name) bits.push("Your best gloves - he keeps wicket.");
      if (boIx === 0 || boIx === 1) bits.push("Opens the innings - he faces the new ball.");
      else if (p.bowlType && p.bowlType !== "none") bits.push(/spin/i.test(p.bowlTypeFull || p.bowlType) ? "Part of the attack - the spin option." : "Part of the seam attack.");
      var bestK = null, bestV = -1;
      for (var k in (p.skills || {})) if (typeof p.skills[k] === "number" && p.skills[k] > bestV) { bestV = p.skills[k]; bestK = k; }
      if (bestK) bits.push("Strongest suit: " + (foSkillLabel(bestK) || bestK) + ".");
      return bits.join(" ");
    } catch (e) { return ""; }
  }
  // micro-bars: three tiny value-coloured columns that read red/green at a
  // glance - the depth of a skill table in the footprint of a word
  function foOrdVCol(v) { return v >= 75 ? "#3E9455" : v >= 55 ? "#7BA23F" : v >= 38 ? "#D9A441" : "#C0552E"; }
  var FO_ORD_BT = { seamFast: "Fast", seamFastMedium: "Fast-medium", seamMedium: "Medium", wristSpin: "Wrist spin", fingerSpin: "Finger spin", partTimeSeam: "Part-time seam", partTimeSpin: "Part-time spin" };
  function foOrdBType(p) {
    var lbl = FO_ORD_BT[p.bowlTypeFull] || (p.bowlType ? String(p.bowlType) : "");
    return lbl ? ((p.hand === "L" ? "Left-arm " : "") + lbl).replace("Left-arm Fast", "Left-arm fast").replace("Left-arm Wrist", "Left-arm wrist").replace("Left-arm Finger", "Left-arm finger").replace("Left-arm Medium", "Left-arm medium").replace("Left-arm Part", "Left-arm part") : "";
  }
  function foOrdTalPills(p, max) {
    return (p.talents || []).slice(0, max || 2).map(function (t2) {
      var tip = (typeof TALTIPS !== "undefined" && TALTIPS[t2]) || "";
      return "<span class='fo-ord-tp' title='" + E(tip) + "'>" + E(typeof ptal === "function" ? ptal(t2) : t2) + "</span>";
    }).join("");
  }
  // tap a chip: the full trading card, so names grow into players
  function foOrdPlayerCard(nm) {
    try {
      var t = userTeam(), p = ((t && t.players) || []).filter(function (x) { return x.name === nm; })[0];
      if (!p) return;
      var boIx = (App.orders.batOrder || []).indexOf(nm);
      var tals = (p.talents || []).map(function (t2) {
        var lbl = (typeof ptal === "function" ? ptal(t2) : t2);
        var tip = (typeof TALTIPS !== "undefined" && TALTIPS[t2]) || "";
        return "<div class='tl'><b>" + E(lbl) + "</b>" + (tip ? " - " + E(tip) : "") + "</div>";
      }).join("");
      var form = "";
      try { if (p.formIx != null && typeof FORMW_UI !== "undefined") form = "Form: <b>" + E(FORMW_UI[p.formIx] || "") + "</b> · "; } catch (eF) {}
      var why = foOrdWhy(p, boIx);
      var ex = document.getElementById("fo-ord-pc"); if (ex) ex.remove();
      var m = document.createElement("div"); m.id = "fo-ord-pc"; m.className = "fo-modal";
      m.innerHTML = "<div class='fo-modal-card' style='max-width:340px'>" +
        "<div class='fo-modal-eyebrow'>" + (boIx >= 0 && boIx < 11 ? "Batting at #" + (boIx + 1) : "The bench") + "</div>" +
        foPkMini(p, { foot: "" }) +
        (why ? "<div class='fo-j-gbox' style='max-width:none;margin:10px 0 0'><img class='gf' src='" + FO_ART + "gaffer.png' alt=''>" +
          "<span class='bx'><span class='sp'>The Gaffer</span><span class='tx'>&ldquo;" + E(why) + "&rdquo;</span></span></div>" : "") +
        (tals ? "<div class='fo-ord-pctal'>" + tals + "</div>" : "") +
        "<div class='small' style='margin-top:7px;color:#8a93a3'>" + form + "Fatigue: <b>" + E(String(p.fatigue || "rested")) + "</b> · age " + (p.age | 0) + "</div>" +
        (boIx >= 0 && boIx < 11 ? "<div class='fo-ord-pcx2'>" +
          (App.orders.captain !== p.name ? "<button type='button' id='fo-ord-mkc'>Make captain</button>" : "") +
          (p.keeper && App.orders.keeper !== p.name ? "<button type='button' id='fo-ord-mkk'>Give him the gloves</button>" : "") +
          "</div>" : "") +
        "<div class='fo-modal-act'><button class='fo-su-go primary' id='fo-ord-pcx'>Got it ▸</button></div></div>";
      document.body.appendChild(m);
      m.querySelector("#fo-ord-pcx").addEventListener("click", function () { m.remove(); });
      m.addEventListener("click", function (ev) { if (ev.target === m) m.remove(); });
      // the name on the card is a doorway: open the full player page fresh
      try {
        var nmEl = m.querySelector(".pkm-nm");
        if (nmEl) {
          nmEl.style.cursor = "pointer"; nmEl.style.textDecoration = "underline"; nmEl.title = "Open full profile";
          nmEl.addEventListener("click", function (e9) {
            e9.stopPropagation();
            window.open(location.href.split("#")[0] + "#/player?n=" + encodeURIComponent(p.name), "_blank");
          });
        }
      } catch (eNl) {}
      var mkC = m.querySelector("#fo-ord-mkc"), mkK = m.querySelector("#fo-ord-mkk");
      if (mkC) mkC.addEventListener("click", function () { App.orders.captain = p.name; m.remove(); foOrdersUI(); toast(p.name + " takes the captaincy."); });
      if (mkK) mkK.addEventListener("click", function () { App.orders.keeper = p.name; m.remove(); foOrdersUI(); toast(p.name + " takes the gloves."); });
    } catch (e) {}
  }
  // the saved plan as a matchday visual: game-plan cards, the XI strip,
  // a tempo curve, and the fifty overs of bowling as a coloured timeline
  function foOrdPlanVisual() {
    try {
      gridState();
      var bo = App.orders.batOrder || [], sn = foOrdSurname;
      var t = userTeam(), by = {}; ((t && t.players) || []).forEach(function (p) { by[p.name] = p; });
      var pi = App.orders.phaseIntent || {}, fp = App.orders.fieldPlan || {};
      // quality is visible: stars relative to this squad, role words, and a
      // bench row so the XI reads as a CHOICE the manager can question
      var ROLE_W = { pace: "Seam", spin: "Spin", wk: "Keeper", bat: "Batter" };
      // one name format everywhere: first initial, dot, surname
      var dispNm = function (nm) { return nm.charAt(0) + ". " + sn(nm); };
      var chip = function (nm, i, dim) {
        var p = by[nm] || {}, sk = p.skills || {};
        // C and the gloves live ON the cards: filled on the holder, ghost on
        // everyone eligible - one tap moves the armband
        var isC = App.orders.captain === nm, isK = App.orders.keeper === nm;
        var tag = dim ? "" :
          "<i class='bdg" + (isC ? " on" : "") + "' data-fo-mkc='" + E(nm) + "' title='" + (isC ? "Captain" : "Make captain") + "'>C</i>" +
          (p.keeper ? "<i class='bdg" + (isK ? " on" : "") + "' data-fo-mkk='" + E(nm) + "' title='" + (isK ? "Wicket-keeper" : "Give him the gloves") + "'>WK</i>" : "");
        var role = p.bowlType && p.bowlType !== "none" ? (/spin/i.test(p.bowlTypeFull || p.bowlType) ? "spin" : "pace") : (p.keeper ? "wk" : "bat");
        var pills = foOrdTalPills(p, 2);
        return "<button type='button' class='xc xc-" + role + (dim ? " xc-dim" : "") + "' data-fo-pc='" + E(nm) + "'>" +
          "<span class='r1'>" + (i != null ? "<u>" + (i + 1) + "</u>" : "") + "<b>" + E(dispNm(nm)) + "</b>" + tag +
          "<span class='hd'>" + (p.hand === "L" ? "LHB" : "RHB") + "</span>" +
          "<span class='ov' title='Overall rating'><b>" + foPkOvr(p) + "</b></span></span>" +
          "<span class='r2'>" + foOrdStarHTML(foOrdStars(foOrdBatComp(p))) + "</span>" +
          "<span class='r3'>" + (pills || "") + "</span></button>";
      };
      var xiNames = bo.slice(0, 11);
      var benchNames = ((t && t.players) || []).map(function (p9) { return p9.name; }).filter(function (nm) { return xiNames.indexOf(nm) < 0; });
      // vertical, editable: the XI as a draggable list, the bench beside it
      var xiChips = "<div class='fo-ord-xiwrap'>" +
        "<div><div class='fo-ord-vzh' style='margin-top:2px'>Batting order <span>&middot; drag to reorder</span></div><div class='fo-ord-xis' id='fo-ord-xi-list'>" + xiNames.map(function (nm, i) { return chip(nm, i, false); }).join("") + "</div></div>" +
        "<div><div class='fo-ord-vzh' style='margin-top:2px'>Bench</div><div class='fo-ord-xis' id='fo-ord-bench-list'>" + benchNames.map(function (nm) { return chip(nm, null, true); }).join("") + "</div></div>" +
        "</div>";
      var bench = "";
      // one lane per bowling option (even the unused sixth): filled blocks
      // are his overs, and every cell is a BUTTON - tap an empty over to
      // hand it to that bowler, tap his own to take it back
      var g = App.orders.grid || {}, tot = {}, first = {};
      for (var o = 1; o <= 50; o++) {
        var nm2 = g[o];
        if (nm2) { tot[nm2] = (tot[nm2] || 0) + 1; if (first[nm2] == null) first[nm2] = o; }
      }
      var bowlNames = xiNames.filter(function (nm9) { var p9 = by[nm9]; return p9 && p9.bowlType && p9.bowlType !== "none"; })
        .sort(function (a, b) { return (first[a] || 99) - (first[b] || 99); });
      var lanes = "<div class='fo-ord-lanes'>" +
        "<div class='fo-ord-lane lax'><span class='ln'></span><span class='lt lnum'>" +
        [1, 10, 20, 30, 40, 50].map(function (o9) { return "<em style='left:" + (((o9 - 0.5) / 50) * 100).toFixed(1) + "%'>" + o9 + "</em>"; }).join("") +
        "</span><u></u></div>" +
        bowlNames.map(function (nmL) {
          var cellsL = "";
          for (var oL = 1; oL <= 50; oL++)
            cellsL += "<i class='" + (g[oL] === nmL ? "f" : "") + (oL <= 10 ? " pp" : oL >= 41 ? " dth" : "") + "' data-lo='" + oL + "' data-ln='" + E(nmL) + "' title='Over " + oL + " &rarr; " + E(dispNm(nmL)) + "'></i>";
          return "<div class='fo-ord-lane'><span class='ln'>" + E(dispNm(nmL)) + "</span><span class='lt'>" + cellsL + "</span><u>" + (tot[nmL] || 0) + "</u></div>";
        }).join("") +
        "<div class='fo-ord-lane lax'><span class='ln'></span><span class='lt'><em style='flex:10'>Powerplay</em><em style='flex:30'>Middle</em><em style='flex:10'>Death</em></span><u></u></div></div>";
      // each bowler as a small card: type, overs, bowling stars (ranked
      // against the club's other bowlers), stamina, and his talents
      // bowler cards mirror the batting cards: name row with OVR right,
      // stars beneath (navy = with the ball), talents last
      var legend = "<div class='fo-ord-bws'>" + bowlNames.map(function (nm3) {
        var p3 = by[nm3] || {};
        var pills3 = foOrdTalPills(p3, 2);
        return "<button type='button' class='bw' data-fo-pc='" + E(nm3) + "'>" +
          "<span class='bw-h'><b>" + E(dispNm(nm3)) + "</b><span class='bt'>" + E(foOrdBType(p3)) + " &middot; " + (tot[nm3] || 0) + " ov</span>" +
          "<span class='ov' title='Overall rating'><b>" + foPkOvr(p3) + "</b></span></span>" +
          "<span class='r2'>" + foOrdStarHTML(foOrdStars(foOrdBowlComp(p3))) + "</span>" +
          "<span class='r3'>" + (pills3 || "") + "</span></button>";
      }).join("") + "</div>";
      var toss = "<div class='fo-ord-vzh' style='margin-top:2px'>Toss</div><div class='fo-ord-toss'>" +
        "<span class='tl'>Call</span>" +
        "<button type='button' data-fo-toss='call:H' class='" + ((App.orders.tossCall || "H") === "H" ? "on" : "") + "'>Heads</button>" +
        "<button type='button' data-fo-toss='call:T' class='" + (App.orders.tossCall === "T" ? "on" : "") + "'>Tails</button>" +
        "<span class='tl'>If we win it</span>" +
        "<button type='button' data-fo-toss='dec:bat' class='" + (App.orders.tossDecision !== "bowl" ? "on" : "") + "'>Bat first</button>" +
        "<button type='button' data-fo-toss='dec:bowl' class='" + (App.orders.tossDecision === "bowl" ? "on" : "") + "'>Bowl first</button>" +
        "</div>";
      return toss + xiChips + bench +
        "<div class='fo-ord-vzh'>Bowling</div>" + lanes + legend;
    } catch (e) { return ""; }
  }
  // scorecards speak the same star language: gold batting stars on the
  // batting card, navy bowling stars on the bowling card, talents removed.
  // Players whose club has left the world (old circuit visitors) simply
  // show no stars - the lookup is by live rosters.
  function foScStars(root) {
    try {
      root = root || document.getElementById("page") || document;
      var by9 = {};
      (GD.teams || []).forEach(function (t9) { ((t9.players || []).concat(t9.youth || [])).forEach(function (p9) { by9[p9.name] = p9; }); });
      root.querySelectorAll("table.fo-sct td.fo-sci-nm, table.ftp-scorecard tbody td:first-child, table.ftp-bowling tbody td:first-child").forEach(function (td) {
        td.querySelectorAll(".fo-tal-tag").forEach(function (x9) { x9.remove(); });
        if (td.querySelector(".fo-scst")) return;
        var a9 = td.querySelector("a"); if (!a9) return;
        var nm9 = null;
        try { nm9 = decodeURIComponent((a9.getAttribute("href") || "").split("n=")[1] || ""); } catch (e0) {}
        var p9 = nm9 && by9[nm9]; if (!p9) return;
        var tb9 = td.closest("table");
        var bowl9 = !!(tb9 && (tb9.classList.contains("fo-sct-bowl") || tb9.classList.contains("ftp-bowling")));
        var s9 = document.createElement("span");
        s9.className = "fo-scst " + (bowl9 ? "fo-scst-w" : "fo-scst-b");
        s9.innerHTML = foOrdStarHTML(foOrdStars(bowl9 ? foOrdBowlComp(p9) : foOrdBatComp(p9)));
        a9.insertAdjacentElement("afterend", s9);
      });
    } catch (e) {}
  }
  // decorate now AND a tick later: the hook fires from the core renderer,
  // but the patch layer rebuilds the live tab shell after core returns -
  // the deferred pass stars the freshly rebuilt tables without waiting for
  // the safety-net interval (which reads as flicker mid-broadcast)
  try { if (typeof foMatchRenderHooks !== "undefined") foMatchRenderHooks.push(function () { foScStars(); setTimeout(foScStars, 0); }); } catch (eH) {}
  // #/match: the live Scorecard tab is appended AFTER the core render (the
  // patch layer builds the tab shell around it), so the render hook fires too
  // early there - the interval is what actually stars the live tables.
  setInterval(function () {
    try { if (/^#\/(scorecard|reports|match|friendly|matchday)/.test(location.hash || "")) foScStars(); } catch (e) {}
  }, 800);
  // the oval's who-cards borrow the star language
  try { window.foStarsFor = { bat: foOrdBatComp, bowl: foOrdBowlComp, stars: foOrdStars, html: foOrdStarHTML, btype: foOrdBType }; } catch (eSF) {}
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
      // the fixture IS the occasion: a broadcast-sized matchup title, the
      // conditions in one quiet line beneath, and no conditions essay
      page.innerHTML = "<div class='crumb'>" + E(opp.home) + " v " + E(opp.away) + " &raquo; Orders</div>" +
        "<div class='fo-ord-hero'><span class='h-t'>" + E(opp.home) + "</span><span class='h-v'>v</span><span class='h-t'>" + E(opp.away) + "</span></div>" +
        "<div class='fo-ord-herosub'>" + E(foPitchName(opp.pitch)) + " pitch &middot; " + E(opp.weather || "") + " &middot; " + E(opp.ground || "") + "</div>" +
        "<div class='panel fo-keep'><h4>The Gaffer's plan</h4><div class='pad'>" +
        "<div class='fo-j-gbox' style='max-width:none;margin:2px 0 10px'><img class='gf' src='" + FO_ART + "gaffer.png' alt=''>" +
        "<span class='bx'><span class='sp'>The Gaffer</span><span class='tx'>&ldquo;My plan for these conditions, boss. Move anything you like - it's all live.&rdquo;</span></span></div>" +
        foOrdPlanVisual() +
        "<div class='fo-ord-acts' style='margin-top:12px'>" +
        "<button class='primary fo-ord-save'>" + (App.pending ? "Play with this plan &#9654;" : "Save this plan") + "</button>" +
        (SYNC && SYNC.started && !SYNC.practice && App.pending && !App.pending.__friendly
          ? "<span class='small'>League lineups lock an hour before the 9:00 AM ET start.</span>"
          : (App.pending ? "" : "<span class='small'>Orders apply to your next fixture.</span>")) + "</div>" +
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
            // eleven men and nobody to stand behind the stumps? Not on my watch
            try {
              if (!foOrdXI().some(function (p9) { return p9.keeper; })) {
                toast("You can't take the field without a wicket-keeper - swap one into the XI.");
                return;
              }
            } catch (eWk) {}
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
          // the click fired by a just-finished drag must not read as a tap -
          // the flag self-expires so it can never swallow a LATER real click
          if (window.__foOrdDragged) return;
          if ((el = q("[data-fo-mkc]"))) { App.orders.captain = el.getAttribute("data-fo-mkc"); foOrdersUI(); return; }
          if ((el = q("[data-fo-mkk]"))) { App.orders.keeper = el.getAttribute("data-fo-mkk"); foOrdersUI(); return; }
          if ((el = q("[data-fo-toss]"))) {
            var pr9 = el.getAttribute("data-fo-toss").split(":");
            if (pr9[0] === "call") App.orders.tossCall = pr9[1];
            else App.orders.tossDecision = pr9[1];
            foOrdersUI();
            return;
          }
          // tap an over cell: give it to that lane's bowler, or take it back
          if ((el = q("[data-lo]"))) {
            var oT = +el.getAttribute("data-lo"), nmT = el.getAttribute("data-ln");
            gridState();
            var gT = App.orders.grid;
            if (gT[oT] === nmT) gT[oT] = null;
            else {
              var cT = 0; for (var oC9 = 1; oC9 <= 50; oC9++) if (gT[oC9] === nmT) cT++;
              if (cT >= 10) { toast("Ten overs is the limit for one bowler."); return; }
              if (gT[oT - 1] === nmT || gT[oT + 1] === nmT) { toast("No bowler can bowl two overs in a row."); return; }
              gT[oT] = nmT;
              if (App.orders.gridBowlers && App.orders.gridBowlers.indexOf(nmT) < 0) App.orders.gridBowlers.push(nmT);
            }
            gridToSpells();
            foOrdersUI();
            return;
          }
          if ((el = q("[data-fo-pc]"))) { foOrdPlayerCard(el.getAttribute("data-fo-pc")); return; }
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
      // drag ANYWHERE on a card to reorder; a plain tap still opens the
      // player card. Mouse: a 6px move starts the drag. Touch: a short hold
      // starts it (so the list still scrolls naturally); wandering off
      // during the hold cancels it and lets the scroll through. Dragging a
      // bench man onto an XI slot swaps him in (five bowling options kept).
      page.addEventListener("pointerdown", function (ev) {
        try {
          if (!/^#\/orders/.test(location.hash || "")) return;
          var chipEl = ev.target.closest ? ev.target.closest(".fo-ord-xis .xc") : null;
          if (!chipEl) return;
          var list = document.getElementById("fo-ord-xi-list"); if (!list) return;
          var fromBench = chipEl.classList.contains("xc-dim");
          var nm = chipEl.getAttribute("data-fo-pc");
          var sx = ev.clientX, sy = ev.clientY;
          var isTouch = ev.pointerType === "touch";
          var r0 = chipEl.getBoundingClientRect();
          var dragging = false, tgtIx = -1, ghost = null, holdT = null;
          var blockScroll = function (e3) { e3.preventDefault(); };
          var begin = function () {
            if (dragging) return;
            dragging = true;
            ghost = chipEl.cloneNode(true);
            ghost.classList.add("xc-ghost");
            ghost.style.width = r0.width + "px";
            document.body.appendChild(ghost);
            chipEl.classList.add("xc-src");
            document.addEventListener("touchmove", blockScroll, { passive: false });
          };
          if (isTouch) holdT = setTimeout(begin, 260);
          var place = function (x, y) {
            ghost.style.left = (x - 24) + "px";
            ghost.style.top = (y - r0.height / 2) + "px";
            var chips9 = [].slice.call(list.querySelectorAll(".xc"));
            tgtIx = -1;
            chips9.forEach(function (c9, i9) {
              c9.classList.remove("xc-tgt");
              var r9 = c9.getBoundingClientRect();
              if (y >= r9.top && y <= r9.bottom) tgtIx = i9;
            });
            if (tgtIx >= 0) chips9[tgtIx].classList.add("xc-tgt");
          };
          var cleanup = function () {
            clearTimeout(holdT);
            document.removeEventListener("pointermove", mv);
            document.removeEventListener("pointerup", up);
            document.removeEventListener("touchmove", blockScroll);
            if (ghost) ghost.remove();
            chipEl.classList.remove("xc-src");
          };
          var mv = function (e2) {
            var dx = e2.clientX - sx, dy = e2.clientY - sy, d2 = dx * dx + dy * dy;
            if (!dragging) {
              if (!isTouch && d2 > 36) begin();
              else if (isTouch && d2 > 120) { cleanup(); return; }   // scroll intent
              if (!dragging) return;
            }
            place(e2.clientX, e2.clientY);
          };
          var up = function () {
            var was = dragging;
            cleanup();
            if (!was) return;   // plain tap: the native click opens the card
            window.__foOrdDragged = true; setTimeout(function () { window.__foOrdDragged = false; }, 250);
            if (tgtIx < 0) { foOrdersUI(); return; }
            var bo9 = App.orders.batOrder;
            if (!fromBench) {
              var from9 = bo9.indexOf(nm);
              if (from9 >= 0 && tgtIx !== from9) { bo9.splice(from9, 1); bo9.splice(tgtIx, 0, nm); }
            } else {
              var outNm = bo9[tgtIx];
              var t9 = userTeam(), by9 = {}; ((t9 && t9.players) || []).forEach(function (p9) { by9[p9.name] = p9; });
              var xiAfter = bo9.slice(0, 11).map(function (n9) { return n9 === outNm ? nm : n9; });
              var bowlN9 = xiAfter.filter(function (n9) { return by9[n9] && by9[n9].bowlType && by9[n9].bowlType !== "none"; }).length;
              if (bowlN9 < 5) { toast("That leaves fewer than five bowling options - swap him for a bowler instead."); foOrdersUI(); return; }
              if (!xiAfter.some(function (n9) { return by9[n9] && by9[n9].keeper; })) { toast("That leaves no wicket-keeper in the XI - keep one in."); foOrdersUI(); return; }
              bo9[tgtIx] = nm;
              // the man coming out loses his overs; captaincy and gloves self-heal
              try { gridState(); for (var o9 = 1; o9 <= 50; o9++) if (App.orders.grid[o9] === outNm) App.orders.grid[o9] = null; gridToSpells(); } catch (e9) {}
              if (App.orders.captain === outNm) App.orders.captain = xiAfter.map(function (n9) { return by9[n9]; }).filter(Boolean).sort(function (a, b) { return (b.capt || 0) - (a.capt || 0); })[0].name;
              if (App.orders.keeper === outNm) { var k9 = xiAfter.map(function (n9) { return by9[n9]; }).filter(function (p9) { return p9 && p9.keeper; })[0]; App.orders.keeper = (k9 || by9[xiAfter[0]]).name; }
            }
            foOrdersUI();
          };
          document.addEventListener("pointermove", mv);
          document.addEventListener("pointerup", up);
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
      ".fo-ord-strat{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:2px 0 4px}" +
      "@media(max-width:640px){.fo-ord-strat{grid-template-columns:1fr}}" +
      "html body.ftpskin #page button.fo-ord-pcard,html body #page button.fo-ord-pcard{text-align:left;border:2px solid rgba(28,36,51,.12) !important;background:#FFFEFC !important;border-radius:12px;padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:3px;min-width:0}" +
      "html body.ftpskin #page button.fo-ord-pcard.on,html body #page button.fo-ord-pcard.on{border-color:#B04A2C !important;background:#FFF6F2 !important;box-shadow:0 3px 0 rgba(176,74,44,.22)}" +
      ".fo-ord-pcard .ic{font-size:19px;line-height:1}" +
      ".fo-ord-pcard b{font-size:13.5px;color:#0E233F}" +
      ".fo-ord-pcard.on b{color:#B04A2C}" +
      ".fo-ord-pcard .sub{font-size:11px;color:#6b7280;line-height:1.4;font-weight:500}" +
      ".fo-ord-xinote{background:#F0F4F8;border:1px solid rgba(31,78,107,.14);border-radius:9px;padding:7px 11px;font-size:11.5px;color:#3a4353;margin:0 0 8px;line-height:1.5}" +
      ".fo-ord-xiwrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start;max-width:820px}" +
      "@media(max-width:700px){.fo-ord-xiwrap{grid-template-columns:1fr}}" +
      ".fo-ord-xis{display:flex;flex-direction:column;gap:5px}" +
      ".fo-ord-xis .xc.xc-src{opacity:.35}" +
      ".fo-ord-xis .xc.xc-tgt{border-color:#B04A2C !important;box-shadow:0 0 0 2px rgba(176,74,44,.25)}" +
      ".xc-ghost{position:fixed;z-index:9999;pointer-events:none;opacity:.92;transform:rotate(1.5deg);box-shadow:0 10px 24px rgba(16,27,45,.3) !important;background:#FFFEFC;border:1px solid rgba(28,36,51,.2);border-radius:10px;display:flex;padding:6px 9px;gap:6px;list-style:none}" +
      "html body.ftpskin #page button.fo-ord-xis-btn,html body #page .fo-ord-xis button.xc{display:flex;flex-direction:column;align-items:stretch;gap:2px;background:#FFFEFC !important;border:1px solid rgba(28,36,51,.12) !important;border-radius:9px;padding:4px 9px;cursor:grab;min-width:0;text-align:left;width:100%}" +
      "html body #page .fo-ord-xis button.xc:hover{border-color:#B04A2C !important}" +
      ".fo-ord-xis .xc.xc-dim{opacity:.62}" +
      ".fo-ord-xis .xc .r1{display:flex;align-items:center;gap:6px;min-width:0;width:100%}" +
      ".fo-ord-xis .xc .r1 .hd{font-size:8px;font-weight:800;color:#9aa3af;letter-spacing:.04em;flex:0 0 auto}" +
      ".fo-ord-xis .xc .r1 .ov,.fo-ord-bws .bw .bw-h .ov{margin-left:auto;display:inline-flex;align-items:baseline;gap:2px;flex:0 0 auto}" +
      ".fo-ord-xis .xc .ov b,.fo-ord-bws .bw .ov b{font-size:16.5px;font-weight:800;color:#B04A2C}" +
      ".fo-ord-xis .xc .r2,.fo-ord-bws .bw .r2{margin-top:-1px}" +
      ".fo-ord-pcx2{display:flex;gap:7px;margin-top:9px;flex-wrap:wrap}" +
      "html body #page .fo-ord-pcx2 button,html body .fo-modal .fo-ord-pcx2 button{border:1px solid rgba(28,36,51,.2);background:#FFFEFC;color:#0E233F;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer}" +
      ".fo-ord-xis .xc .r1 b{font-size:11.5px;font-weight:800;color:#243244;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".fo-ord-xis .xc u{width:17px;height:17px;background:#EEF2F7;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-size:9px;font-weight:800;color:#41577a;flex:0 0 auto}" +
      ".fo-ord-xis .xc i{font-style:normal;font-size:8px;background:#0E233F;color:#FFFEFC;border-radius:4px;padding:1px 4px;font-weight:800;flex:0 0 auto}" +
      ".fo-ord-xis .xc i.bdg{background:transparent;color:#c3c9d2;border:1px solid rgba(28,36,51,.16);cursor:pointer}" +
      ".fo-ord-xis .xc i.bdg:hover{border-color:#B04A2C;color:#B04A2C}" +
      ".fo-ord-xis .xc i.bdg.on{background:#0E233F;color:#FFFEFC;border-color:#0E233F}" +
      ".fo-ord-xis .xc .r2{display:flex;align-items:center;gap:6px;width:100%}" +
      ".fo-ord-xis .xc .st,.fo-ord-bws .bw .st{text-decoration:none;font-size:13px;letter-spacing:1.2px;line-height:1;white-space:nowrap}" +
      ".fo-ord-xis .xc .st em,.fo-ord-bws .bw .st em{font-style:normal;color:#d8d3c6}.fo-ord-xis .xc .st em.f{color:#D9A441}.fo-ord-bws .bw .st em.f{color:#0FB4C4}" +
      ".fo-ord-xis .xc .st em.h{background:linear-gradient(90deg,#D9A441 50%,#d8d3c6 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
      ".fo-scst{white-space:nowrap;margin-left:7px;display:inline-block;vertical-align:1px}" +
      ".fo-scst .st{text-decoration:none;font-size:12px;letter-spacing:.9px;line-height:1;white-space:nowrap}" +
      ".fo-scst .st em{font-style:normal;color:#e2ddd2}" +
      ".fo-scst-b .st em.f{color:#D9A441}" +
      ".fo-scst-b .st em.h{background:linear-gradient(90deg,#D9A441 50%,#e2ddd2 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
      ".fo-scst-w .st em.f{color:#0FB4C4}" +
      ".fo-scst-w .st em.h{background:linear-gradient(90deg,#0FB4C4 50%,#e2ddd2 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
      ".fo-ord-bws .bw .st em.h{background:linear-gradient(90deg,#0FB4C4 50%,#d8d3c6 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
      ".fo-ord-xis .xc .rl{font-size:9px;letter-spacing:.05em;text-transform:uppercase;font-weight:800;color:#8a93a3;margin-left:auto}" +
                  ".fo-ord-pctal{margin-top:8px;display:flex;flex-direction:column;gap:4px}" +
      ".fo-ord-pctal .tl{background:#FBF7EC;border:1px solid rgba(201,162,75,.3);border-radius:8px;padding:5px 9px;font-size:11.5px;color:#4a4234;line-height:1.4}" +
      ".fo-ord-vzh{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:#41577a;font-weight:800;margin:13px 0 6px}" +
      ".fo-ord-vzh span{color:#9aa3af;letter-spacing:.02em;text-transform:none;font-weight:600}" +
      ".fo-ord-curve{width:100%;height:56px;display:block;background:#FBFAF7;border:1px solid rgba(28,36,51,.08);border-radius:10px}" +
      ".fo-ord-ph3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:7px}" +
      ".fo-ord-ph3>div{background:#FFFEFC;border:1px solid rgba(28,36,51,.1);border-radius:9px;padding:6px 9px;min-width:0}" +
      ".fo-ord-ph3 b{display:block;font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:#8a93a3;font-weight:800}" +
      ".fo-ord-ph3 span{display:block;font-size:12px;font-weight:700;color:#0E233F;margin-top:1px}" +
      ".fo-ord-ph3 span.f{font-weight:600;color:#41577a;font-size:11px}" +
      "@media(max-width:480px){.fo-ord-ph3{grid-template-columns:repeat(3,minmax(0,1fr))}.fo-ord-ph3 span{font-size:11px}}" +
      ".fo-ord-lanes{display:flex;flex-direction:column;gap:3px;background:#FBFAF7;border:1px solid rgba(28,36,51,.08);border-radius:10px;padding:9px 10px}" +
      ".fo-ord-lane{display:flex;align-items:center;gap:8px}" +
      ".fo-ord-lane .ln{flex:0 0 78px;font-size:10.5px;font-weight:800;color:#243244;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}" +
      ".fo-ord-lane .lt{flex:1;display:flex;gap:1px;height:13px;min-width:0}" +
      ".fo-ord-lane .lt i{flex:1;min-width:0;background:rgba(28,36,51,.05);border-radius:1px;cursor:pointer}" +
      ".fo-ord-lane .lt i:hover{outline:1px solid #B04A2C}" +
      ".fo-ord-lane .lt{height:15px}" +
      ".fo-ord-lane .lt i.pp,.fo-ord-lane .lt i.dth{background:rgba(201,162,75,.15)}" +
      ".fo-ord-lane .lt i.f{background:#41577a}" +
      ".fo-ord-lane u{flex:0 0 22px;text-decoration:none;font-size:9.5px;color:#8a93a3;font-weight:700}" +
      ".fo-ord-lane.lax .lt{height:auto;gap:1px}" +
      ".fo-ord-lane.lax em{font-style:normal;font-size:8px;letter-spacing:.06em;text-transform:uppercase;font-weight:800;color:#b0a67f;text-align:center;min-width:0;overflow:hidden;white-space:nowrap}" +
      ".fo-ord-lane .lt.lnum{position:relative;display:block;height:10px}" +
      ".fo-ord-lane .lt.lnum em{position:absolute;top:0;transform:translateX(-50%);font-style:normal;font-size:7.5px;font-weight:700;color:#8a93a3;letter-spacing:0;text-transform:none}" +
      "html body #page .fo-ord-hero,html body.ftpskin #page .fo-ord-hero{display:flex;align-items:baseline;justify-content:center;gap:14px;flex-wrap:wrap;margin:16px 0 3px;text-align:center;background:transparent !important;border:none !important;box-shadow:none !important;padding:0 !important}" +
      "html body #page .fo-ord-hero .h-t{font-family:Oswald,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.6px;font-size:31px;color:#0E233F !important;line-height:1.08}" +
      "html body #page .fo-ord-hero .h-v{font-family:Oswald,sans-serif;font-size:14px;color:#B04A2C !important;font-weight:600;text-transform:uppercase;letter-spacing:2px}" +
      "html body #page .fo-ord-herosub,html body.ftpskin #page .fo-ord-herosub{text-align:center;font-family:Oswald,sans-serif;letter-spacing:2.2px;text-transform:uppercase;font-size:10.5px;color:#8a93a3 !important;margin:0 0 14px;background:transparent !important;border:none !important;box-shadow:none !important;padding:0 !important}" +
      "@media(max-width:600px){.fo-ord-hero .h-t{font-size:21px}.fo-ord-hero{gap:9px}}" +
      "@media(max-width:480px){.fo-ord-lane .ln{flex-basis:62px;font-size:9.5px}.fo-ord-lane.lax em{font-size:6.5px}.fo-ord-lane .lt.lnum em{font-size:6.5px}}" +
      ".fo-ord-tp{display:inline;background:none;border:none;padding:0;color:#b3bac4;font-size:7.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}" +
      ".fo-ord-tp + .fo-ord-tp:before{content:'· ';color:#d3d8de}" +
      ".fo-ord-xis .xc .r2{justify-content:space-between}" +
      ".fo-ord-xis .xc .r3,.fo-ord-bws .bw .r3{display:flex;flex-wrap:wrap;gap:3px;width:100%;min-height:11px;align-items:center}" +
      ".fo-ord-bws{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:6px;margin-top:8px}" +
      "html body.ftpskin #page .fo-ord-bws button.bw,html body #page .fo-ord-bws button.bw{display:flex;flex-direction:column;gap:3px;background:#FFFEFC !important;border:1px solid rgba(28,36,51,.12) !important;border-radius:9px;padding:5px 10px;cursor:pointer;text-align:left;min-width:0}" +
      ".fo-ord-toss{display:flex;align-items:center;gap:7px;flex-wrap:wrap}" +
      ".fo-ord-toss .tl{font-size:10px;letter-spacing:.06em;text-transform:uppercase;font-weight:800;color:#8a93a3}" +
      "html body.ftpskin #page .fo-ord-toss button,html body #page .fo-ord-toss button{border:1px solid rgba(28,36,51,.16) !important;background:#FFFEFC !important;color:#3a4353 !important;border-radius:99px;padding:4px 13px;font-size:11.5px;font-weight:700;cursor:pointer}" +
      "html body.ftpskin #page .fo-ord-toss button.on,html body #page .fo-ord-toss button.on{background:#0E233F !important;color:#FFFEFC !important;border-color:#0E233F !important}" +
      "html body #page .fo-ord-bws button.bw:hover{border-color:#B04A2C !important}" +
      ".fo-ord-bws .bw-h{display:flex;align-items:center;gap:6px;width:100%;min-width:0}" +
      ".fo-ord-bws .bw-h i{width:10px;height:10px;border-radius:3px;flex:0 0 auto}" +
      ".fo-ord-bws .bw-h b{font-size:11.5px;font-weight:800;color:#243244;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".fo-ord-bws .bw-h .bt{font-size:9px;letter-spacing:.04em;text-transform:uppercase;font-weight:800;color:#a06a2c;white-space:nowrap}" +
      ".fo-ord-bws .bw-h u{text-decoration:none;font-size:10px;color:#8a93a3;font-weight:700;margin-left:auto;flex:0 0 auto}" +
      ".fo-ord-bws .bw-r{display:flex;align-items:flex-end;gap:6px;flex-wrap:wrap;width:100%}" +
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

