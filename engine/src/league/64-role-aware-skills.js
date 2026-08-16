// ---- 64-role-aware-skills.js -----------------------------------------------
// WHAT A CRICKETER'S PAGE LEADS WITH, BY WHAT HE IS.
//
// The old "Technique" headline was a presentation aggregate only:
// (vsPace + vsSpin + temperament) / 3. The ball engine never consumes that
// number. On a specialist bowler it therefore read as "Limited technique" when
// what it really meant was "limited batting technique" - the wrong story on
// exactly the page where a manager is trying to understand the player. And a
// single generic list of headline abilities told every cricketer's story in
// the same words, which is no story at all.
//
// This file is the ONE definition of the role-aware summary: which readings
// lead a batter's page, a bowler's, a keeper's, an all-rounder's, and which
// six of them make his radar. It defines and exports; the player page renders.
// It began life also patching the squad Grid and rewriting the page by
// MutationObserver - but the Grid's columns live inside the league layer's
// shared scope where this module cannot see them (that patch was dead on
// arrival), and the observer could only reach players in GD.teams, which is
// the local game and not the served world. The Grid change lives in
// 09-squad-matchlab now, and 41-player-page consumes the profile below
// directly, so every player - local, served, rival - gets the same treatment
// from the same definition.
//
// Composure is the user-facing name for the engine's temperament facet: same
// number, no new aggregate, a word a manager actually says.
//
// The radar deliberately never plots an aggregate beside its own ingredients:
// six independent dimensions per role, so the shape describes a style rather
// than double-counting a summary.
(function () {
  "use strict";

  function sk(p) { return (p && p.skills) || {}; }
  function n(v) {
    var m = window.FO_LATENT_MAX || 250;
    return Math.max(0, Math.min(m, Math.round(Number(v) || 0)));
  }
  function val(fn, p) {
    try { return n(fn(p)); } catch (e) { return 0; }
  }
  function raw(k) { return function (p) { return sk(p)[k] || 0; }; }
  function bat(p) { try { return aggBat(p); } catch (e) { return 0; } }
  function bowl(p) { try { return aggBowl(p); } catch (e) { return 0; } }
  function field(p) { try { return aggField(p); } catch (e) { return 0; } }
  function keep(p) { try { return aggKeep(p); } catch (e) { return 0; } }

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

  // Eight readings that answer "why is this particular cricketer good?", and
  // the six of them that make his shape.
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

  // resolved for a renderer: [label, value] pairs, the shape every bar and
  // radar in the game already eats
  function read(p) {
    var P = profile(p);
    var pair = function (x) { return [x.l, val(x.f, p)]; };
    var pairR = function (x) { return [x.r, val(x.f, p)]; };
    return { cls: cls(p), all: P.all.map(pair), radar: P.radar.map(pairR) };
  }

  try { window.foRoleSkills = { cls: cls, profile: profile, read: read }; } catch (e) {}
})();
