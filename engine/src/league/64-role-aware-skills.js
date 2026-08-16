// ---- 64-role-aware-skills.js -----------------------------------------------
// The old "Technique" headline was a presentation aggregate only:
// (vsPace + vsSpin + temperament) / 3. The ball engine never consumes that
// number. On a specialist bowler it therefore read as "Limited technique" when
// what it really meant was "limited batting technique" — the wrong story on
// exactly the page where a manager is trying to understand the player.
//
// Keep the engine model intact. This file changes only what the manager sees:
//   * squad Grid swaps Tech for End (persistent stamina), preserving width;
//   * the player dossier becomes role-aware before Advanced engine view;
//   * Advanced engine view remains the exhaustive source of raw attributes.
//
// Fitness and Endurance are deliberately different. Fitness is current energy;
// Endurance is the persistent stamina skill that decides how quickly fatigue
// accumulates during a match.
(function () {
  "use strict";

  function sk(p) { return (p && p.skills) || {}; }
  function n(v) {
    var m = window.FO_LATENT_MAX || 250;
    return Math.max(0, Math.min(m, Math.round(Number(v) || 0)));
  }
  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function val(fn, p) {
    try { return n(fn(p)); } catch (e) { return 0; }
  }
  function raw(k) { return function (p) { return sk(p)[k] || 0; }; }
  function bat(p) { try { return aggBat(p); } catch (e) { return 0; } }
  function bowl(p) { try { return aggBowl(p); } catch (e) { return 0; } }
  function field(p) { try { return aggField(p); } catch (e) { return 0; } }
  function keep(p) { try { return aggKeep(p); } catch (e) { return 0; } }

  // ---- Squad Grid ----------------------------------------------------------
  // There were six persistent ability columns already. Keep exactly six so
  // the table does not get wider: Bat, Bowl, End, Power, Field, WK.
  // "Fit" remains later in the table as the live energy/condition reading.
  try {
    if (typeof FO_SQ_ABIL !== "undefined" && typeof FO_SQ_COLS !== "undefined") {
      delete FO_SQ_ABIL.tech;
      FO_SQ_ABIL.end = 1;
      FO_SQ_COLS = FO_SQ_COLS.map(function (c) {
        if (!c || c.k !== "tech") return c;
        return {
          k: "end", l: "End", s: "End",
          tip: "Endurance: persistent stamina — slows in-match fatigue. Fitness is the energy he has left today.",
          num: 1,
          v: function (p) { return n(sk(p).stamina); }
        };
      });
    }
  } catch (eGrid) {
    try { console.warn("foRoleSkills grid", eGrid); } catch (eGrid2) {}
  }

  // ---- Player dossier ------------------------------------------------------
  // A summary should answer "what kind of cricketer is he?" rather than repeat
  // one synthetic number for every role. Each role gets eight useful readings;
  // the radar uses six independent dimensions so aggregate + component are not
  // plotted twice on the same shape.
  function cls(p) {
    try {
      if (typeof foSqClass === "function") return foSqClass(p);
    } catch (e) {}
    if (p && (p.keeper || p.role === "wicketkeeper")) return "wk";
    if (p && (p.role === "allRounder" || p.role === "allrounder")) return "ar";
    if (p && p.bowlType) return "bowl";
    return "bat";
  }
  function item(label, short, fn) { return { l: label, r: short || label, f: fn }; }

  function profile(p) {
    var c = cls(p), all, radar;
    if (c === "bowl") {
      all = [
        item("Bowling", "Bowling", bowl),
        item("Wicket threat", "Wicket", raw("wicket")),
        item("Economy", "Economy", raw("economy")),
        item("Discipline", "Discipline", raw("discipline")),
        item("Movement / turn", "Movement", raw("moveTurn")),
        item("Variation", "Variation", raw("variation")),
        item("Endurance", "Endurance", raw("stamina")),
        item("Fielding", "Fielding", field)
      ];
      radar = all.slice(1, 7);
    } else if (c === "wk") {
      all = [
        item("Batting", "Batting", bat),
        item("Keeping", "Keeping", keep),
        item("Catching", "Catching", raw("catching")),
        item("Stumping", "Stumping", raw("stumping")),
        item("vs Pace", "vs Pace", raw("vsPace")),
        item("vs Spin", "vs Spin", raw("vsSpin")),
        item("Power", "Power", raw("power")),
        item("Endurance", "Endurance", raw("stamina"))
      ];
      radar = [all[1], all[2], all[3], all[4], all[5], all[6]];
    } else if (c === "ar") {
      all = [
        item("Batting", "Batting", bat),
        item("Bowling", "Bowling", bowl),
        item("Power", "Power", raw("power")),
        item("Rotation", "Rotation", raw("rotation")),
        item("Wicket threat", "Wicket", raw("wicket")),
        item("Economy", "Economy", raw("economy")),
        item("Endurance", "Endurance", raw("stamina")),
        item("Fielding", "Fielding", field)
      ];
      radar = [all[0], all[1], all[2], all[4], all[5], all[7]];
    } else {
      all = [
        item("Batting", "Batting", bat),
        item("vs Pace", "vs Pace", raw("vsPace")),
        item("vs Spin", "vs Spin", raw("vsSpin")),
        item("Rotation", "Rotation", raw("rotation")),
        item("Power", "Power", raw("power")),
        item("Composure", "Composure", raw("temperament")),
        item("Endurance", "Endurance", raw("stamina")),
        item("Fielding", "Fielding", field)
      ];
      radar = all.slice(1, 6).concat([all[7]]);
    }
    return { all: all, radar: radar };
  }

  function readings(items, p) {
    return items.map(function (x) { return { l: x.l, r: x.r, v: val(x.f, p) }; });
  }

  function bars(items) {
    return "<div class='fo-pp-bars fo-role-bars'>" + items.map(function (x) {
      var v = x.v;
      var w = (typeof foSkBar === "function") ? foSkBar(v) : Math.min(100, v);
      var lbl = (typeof foSkillLabel === "function") ? foSkillLabel(v) : String(v);
      var g = (typeof foSkillCls === "function") ? foSkillCls(v) : "";
      return "<div class='fo-pp-bar'><i>" + esc(x.l.toUpperCase()) + "</i><u><b class='skfill " + g +
        "' style='width:" + w + "%'></b></u><em class='skg " + g + "'>" + esc(lbl) + "</em></div>";
    }).join("") + "</div>";
  }

  function radar(items) {
    var R = 62, cx = 78, cy = 74, count = items.length;
    if (!count) return "";
    var pt = function (i, r) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / count;
      return [(cx + r * Math.cos(a)).toFixed(1), (cy + r * Math.sin(a)).toFixed(1)];
    };
    var ring = function (f) {
      return items.map(function (_, i) { return pt(i, R * f).join(","); }).join(" ");
    };
    var web = [1, 0.66, 0.33].map(function (f) {
      return "<polygon points='" + ring(f) + "' fill='none' stroke='rgba(20,28,40,.14)' stroke-width='1'></polygon>";
    }).join("");
    var spokes = items.map(function (_, i) {
      var q = pt(i, R);
      return "<line x1='" + cx + "' y1='" + cy + "' x2='" + q[0] + "' y2='" + q[1] + "' stroke='rgba(20,28,40,.1)'></line>";
    }).join("");
    var frac = function (v) {
      var pct = (typeof foSkBar === "function") ? foSkBar(v) : Math.min(100, v);
      return Math.max(0.06, Math.min(1, pct / 100));
    };
    var shape = items.map(function (x, i) { return pt(i, R * frac(x.v)).join(","); }).join(" ");
    var dots = items.map(function (x, i) {
      var q = pt(i, R * frac(x.v));
      return "<circle cx='" + q[0] + "' cy='" + q[1] + "' r='2.6' fill='#8F6A1C'></circle>";
    }).join("");
    var labs = items.map(function (x, i) {
      var q = pt(i, R + 15), a = -Math.PI / 2 + i * 2 * Math.PI / count;
      var anc = Math.abs(Math.cos(a)) < 0.3 ? "middle" : (Math.cos(a) > 0 ? "start" : "end");
      return "<text x='" + q[0] + "' y='" + (+q[1] + 3).toFixed(1) + "' text-anchor='" + anc +
        "' class='fo-pp-rlab'>" + esc(x.r.toUpperCase()) + "</text>";
    }).join("");
    return "<svg class='fo-pp-radar' viewBox='-56 -12 284 176' role='img' aria-label='Role skill shape'>" + web + spokes +
      "<polygon points='" + shape + "' fill='rgba(201,162,75,.28)' stroke='#8F6A1C' stroke-width='1.6'></polygon>" +
      dots + labs + "</svg>";
  }

  function queryName() {
    var m = /[?&]n=([^&]+)/.exec(location.hash || "");
    try { return m ? decodeURIComponent(m[1]) : ""; } catch (e) { return m ? m[1] : ""; }
  }
  function currentPlayer() {
    var name = queryName(); if (!name) return null;
    try {
      var hit = (typeof findPlayer === "function") ? findPlayer(name) : null;
      return hit && hit.p ? hit.p : null;
    } catch (e) { return null; }
  }

  function applyPlayerSummary() {
    if ((location.hash || "").split("?")[0] !== "#/player") return;
    var p = currentPlayer(); if (!p) return; // rival/served cards keep scout view
    var P = profile(p), all = readings(P.all, p), rad = readings(P.radar, p);

    // Overview: keep the existing card and Advanced engine details, replace only
    // the misleading pre-advanced shape.
    var shapes = document.querySelectorAll("#page .fo-pp-shape");
    for (var i = 0; i < shapes.length; i++) {
      var shape = shapes[i];
      var sig = cls(p) + ":" + all.map(function (x) { return x.v; }).join(",");
      if (shape.getAttribute("data-role-skill-sig") === sig) continue;
      shape.innerHTML = radar(rad) + bars(all);
      shape.setAttribute("data-role-skill-sig", sig);
    }

    // Development/Growth reuses the old facets without a radar. Keep that page
    // role-aware too, otherwise Technique reappears the moment the tab changes.
    var cards = document.querySelectorAll("#page .fo-pp-card");
    for (var j = 0; j < cards.length; j++) {
      var h = cards[j].querySelector("h3");
      if (!h || String(h.textContent || "").toLowerCase().indexOf("growth") !== 0) continue;
      var old = cards[j].querySelector(".fo-pp-bars");
      if (!old || old.classList.contains("fo-role-bars")) continue;
      var box = document.createElement("div");
      box.innerHTML = bars(all);
      if (box.firstChild) old.parentNode.replaceChild(box.firstChild, old);
    }
  }

  // Player tabs repaint inside the private player-page IIFE, so a route wrapper
  // alone cannot see every rebuild. Observe only the page container and make the
  // transform idempotent; our own replacement schedules one harmless no-op.
  var pending = 0;
  function schedule() {
    if (pending) return;
    pending = setTimeout(function () { pending = 0; try { applyPlayerSummary(); } catch (e) {} }, 0);
  }
  try {
    var page = document.getElementById("page");
    if (page && typeof MutationObserver !== "undefined") {
      new MutationObserver(schedule).observe(page, { childList: true, subtree: true });
    }
  } catch (eObs) {}
  try {
    var prevPg = window.pgPlayer;
    if (typeof prevPg === "function" && !prevPg.__foRoleSkills) {
      window.pgPlayer = function () { var out = prevPg.apply(this, arguments); schedule(); return out; };
      window.pgPlayer.__foRoleSkills = 1;
    }
  } catch (ePg) {}
  schedule();
})();
